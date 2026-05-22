#!/usr/bin/env python3
"""
Train a custom wake word model for openWakeWord.

Generates synthetic speech samples using edge-tts, computes audio features
using openwakeword's AudioFeatures pipeline (melspec → embedding), trains a
small DNN, and exports to ONNX format.

Usage:
    python train_hey_homer.py [--samples 1500] [--epochs 100] [--output-dir models]
    python train_hey_homer.py --name hey_homer_turn_off \\
        --positive-phrases "hey homer turn off,hey homer off" \\
        --negative-phrases "hey homer,turn off,turn on" \\
        --clip-duration 3.0
"""

import argparse
import asyncio
import copy
import io
import logging
import os
import random
import struct
import tempfile
import wave
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from tqdm import tqdm

from openwakeword.utils import AudioFeatures

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("train")

# ---------------------------------------------------------------------------
# TTS sample generation
# ---------------------------------------------------------------------------

# Diverse set of edge-tts voices for variety
VOICES = [
    "en-US-GuyNeural",
    "en-US-JennyNeural",
    "en-US-AriaNeural",
    "en-US-DavisNeural",
    "en-US-AmberNeural",
    "en-US-AndrewNeural",
    "en-US-BrandonNeural",
    "en-US-ChristopherNeural",
    "en-US-CoraNeural",
    "en-US-ElizabethNeural",
    "en-US-EricNeural",
    "en-US-JacobNeural",
    "en-US-MichelleNeural",
    "en-US-MonicaNeural",
    "en-US-RogerNeural",
    "en-US-SteffanNeural",
    "en-GB-SoniaNeural",
    "en-GB-RyanNeural",
    "en-AU-NatashaNeural",
    "en-AU-WilliamNeural",
]

# Positive phrase variations
POSITIVE_PHRASES = [
    "hey homer",
    "Hey Homer",
    "hey homer.",
    "Hey Homer!",
    # Casual/mumbled variations TTS can approximate
    "hey, homer",
    "Hey Homer?",
    "hey homer!",
    "hey Homer",
    # With slight lead-in (more realistic utterance context)
    "um hey homer",
    "okay hey homer",
    "uh hey homer",
]

# Negative phrases — things that should NOT trigger
NEGATIVE_PHRASES = [
    # Phonetically similar — most important for reducing false positives
    "hey", "homer", "hi homer", "hey home", "hey holmer", "hey hummer",
    "hey humor", "hey hooper", "hey cooper", "hey mover", "hey rover",
    "hey honey", "hey mother", "hey brother", "hay bale", "home run",
    "homework", "homer simpson", "hey roamer", "hey comer", "hey gopher",
    "hey over", "hey omer", "heyommer", "hey ohmer", "hey hamer",
    "hey hammer", "hey hamper", "hey harbor", "hey holler", "hey honor",
    # Other wake words / assistant triggers
    "hey siri", "hey google", "hey alexa", "okay google", "hey cortana",
    "hey jarvis", "hey computer",
    # Common household speech (TV/conversation false positive sources)
    "hello", "hey there", "hey john", "good morning", "good night",
    "what's the weather", "turn on the lights", "play some music",
    "set a timer", "how are you", "tell me a joke", "open the door",
    "the quick brown fox", "testing one two three",
    "what time is it", "can you hear me", "are you there",
    "come here", "over here", "go home", "I'm home", "welcome home",
    "let's go", "dinner's ready", "time for bed", "hurry up",
    "what's for dinner", "pass the remote", "change the channel",
    "turn it up", "turn it down", "pause it", "stop that",
    # TV/movie dialogue that could cause false positives
    "hey man", "hey buddy", "hey dude", "hey boss", "hey partner",
    "hey kid", "hey chief", "hey doc", "hey coach",
    "oh my god", "what happened", "look at that", "did you see",
    "I don't know", "let me think", "wait a minute", "hold on",
]

# Speech rate/pitch variations for data augmentation
RATE_VARIATIONS = ["-10%", "-5%", "+0%", "+5%", "+10%", "+15%", "-15%"]
PITCH_VARIATIONS = ["-5Hz", "+0Hz", "+5Hz", "-10Hz", "+10Hz"]


# ---------------------------------------------------------------------------
# Real voice recording
# ---------------------------------------------------------------------------

def record_real_samples(n_samples: int, label: str, duration: float = 2.5,
                        device: str | None = None) -> list[np.ndarray]:
    """Record real voice samples from the microphone interactively.

    Prompts the user to speak the phrase, records each sample, and returns
    a list of int16 mono 16kHz numpy arrays.
    """
    import alsaaudio

    if device is None:
        # Try to find ReSpeaker
        import subprocess
        result = subprocess.run(["arecord", "-l"], capture_output=True, text=True, timeout=5)
        for line in result.stdout.splitlines():
            lower = line.lower()
            if lower.startswith("card") and any(
                kw in lower for kw in ("respeaker", "seeed", "wm8960", "2mic")
            ):
                card_num = lower.split(":")[0].replace("card", "").strip()
                device = f"hw:{card_num},0"
                break
        if device is None:
            device = "default"

    channels = 2  # ReSpeaker is stereo
    sample_rate = 16000
    chunk_size = 1280

    log.info("Recording %d samples of '%s' (%.1fs each) from %s", n_samples, label, duration, device)
    log.info("Press Enter to start each recording, or 'q' to stop early.\n")

    clips = []
    for i in range(n_samples):
        user_input = input(f"  [{i+1}/{n_samples}] Say \"{label}\" — press Enter to record (q to quit): ")
        if user_input.strip().lower() == "q":
            break

        pcm = alsaaudio.PCM(
            type=alsaaudio.PCM_CAPTURE, mode=alsaaudio.PCM_NORMAL,
            device=device, channels=channels, rate=sample_rate,
            format=alsaaudio.PCM_FORMAT_S16_LE, periodsize=chunk_size,
        )

        print(f"    Recording {duration:.1f}s...", end="", flush=True)
        chunks = []
        total_samples = int(sample_rate * duration)
        collected = 0
        while collected < total_samples:
            length, data = pcm.read()
            if length <= 0:
                continue
            audio = np.frombuffer(data, dtype=np.int16)
            if channels > 1:
                audio = audio.reshape(-1, channels).mean(axis=1).astype(np.int16)
            chunks.append(audio)
            collected += len(audio)

        pcm.close()
        clip = np.concatenate(chunks)[:total_samples]
        rms = np.sqrt(np.mean(clip.astype(np.float64) ** 2))
        print(f" done (RMS={rms:.0f})")

        if rms < 50:
            print("    ⚠ Very quiet — try speaking louder or closer to the mic")
        clips.append(clip)

    log.info("Recorded %d real samples", len(clips))
    return clips


def save_real_samples(clips: list[np.ndarray], output_dir: Path, label: str) -> Path:
    """Save recorded clips as a .npz file for reuse in future training runs."""
    output_dir.mkdir(exist_ok=True)
    safe_label = label.replace(" ", "_").lower()
    path = output_dir / f"real_samples_{safe_label}.npz"
    np.savez(path, *clips)
    log.info("Saved %d real samples to %s", len(clips), path)
    return path


def load_real_samples(path: Path) -> list[np.ndarray]:
    """Load previously recorded real samples from .npz file."""
    data = np.load(path)
    clips = [data[k] for k in data.files]
    log.info("Loaded %d real samples from %s", len(clips), path)
    return clips


async def generate_tts_clip(text: str, voice: str, rate: str = "+0%",
                            pitch: str = "+0Hz") -> np.ndarray | None:
    """Generate a single TTS clip and return as 16kHz int16 numpy array."""
    import edge_tts

    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    audio_data = b""
    try:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
    except Exception as e:
        log.warning("TTS failed for voice=%s text=%s: %s", voice, text, e)
        return None

    if not audio_data:
        return None

    # edge-tts returns MP3; decode to PCM
    try:
        import soundfile as sf
        audio_array, sr = sf.read(io.BytesIO(audio_data), dtype="int16")
        # Resample to 16kHz if needed
        if sr != 16000:
            import soxr
            audio_float = audio_array.astype(np.float32)
            if audio_float.ndim > 1:
                audio_float = audio_float.mean(axis=1)
            audio_float = soxr.resample(audio_float, sr, 16000)
            audio_array = (audio_float).astype(np.int16)
        elif audio_array.ndim > 1:
            audio_array = audio_array.mean(axis=1).astype(np.int16)
        return audio_array
    except Exception as e:
        log.warning("Failed to decode audio: %s", e)
        return None


async def generate_samples(phrases: list[str], n_samples: int,
                           desc: str = "Generating") -> list[np.ndarray]:
    """Generate TTS clips for the given phrases."""
    clips = []
    pbar = tqdm(total=n_samples, desc=desc)

    while len(clips) < n_samples:
        phrase = random.choice(phrases)
        voice = random.choice(VOICES)
        rate = random.choice(RATE_VARIATIONS)
        pitch = random.choice(PITCH_VARIATIONS)

        clip = await generate_tts_clip(phrase, voice, rate, pitch)
        if clip is not None and len(clip) > 1600:  # at least 100ms
            clips.append(clip)
            pbar.update(1)

    pbar.close()
    return clips


# ---------------------------------------------------------------------------
# Audio augmentation
# ---------------------------------------------------------------------------

def add_noise(audio: np.ndarray, snr_db: float = 20.0) -> np.ndarray:
    """Add Gaussian noise at the specified SNR."""
    signal_power = np.mean(audio.astype(np.float64) ** 2)
    noise_power = signal_power / (10 ** (snr_db / 10))
    noise = np.random.normal(0, np.sqrt(noise_power), len(audio))
    return np.clip(audio + noise, -32768, 32767).astype(np.int16)


def random_gain(audio: np.ndarray, min_db: float = -6, max_db: float = 6) -> np.ndarray:
    """Apply random gain."""
    gain_db = random.uniform(min_db, max_db)
    gain = 10 ** (gain_db / 20)
    return np.clip(audio * gain, -32768, 32767).astype(np.int16)


def pad_or_trim(audio: np.ndarray, target_len: int) -> np.ndarray:
    """Pad with silence or trim to target length."""
    if len(audio) >= target_len:
        # Random offset for trimming
        max_start = len(audio) - target_len
        start = random.randint(0, max_start)
        return audio[start:start + target_len]
    else:
        # Pad with silence, random position
        pad_total = target_len - len(audio)
        pad_before = random.randint(0, pad_total)
        pad_after = pad_total - pad_before
        return np.pad(audio, (pad_before, pad_after), mode="constant")


def time_stretch(audio: np.ndarray, rate: float) -> np.ndarray:
    """Simple time-stretch via linear interpolation (no pitch shift)."""
    indices = np.arange(0, len(audio), rate)
    indices = indices[indices < len(audio) - 1].astype(np.float64)
    idx_floor = indices.astype(int)
    frac = indices - idx_floor
    stretched = audio[idx_floor] * (1 - frac) + audio[np.minimum(idx_floor + 1, len(audio) - 1)] * frac
    return stretched.astype(np.int16)


def simulate_reverb(audio: np.ndarray, decay: float = 0.3, delay_ms: float = 20) -> np.ndarray:
    """Add simple early reflections to simulate room acoustics."""
    sr = 16000
    delay_samples = int(sr * delay_ms / 1000)
    output = audio.astype(np.float64).copy()
    # 2-3 early reflections at different delays
    for i, (mult, d) in enumerate([(decay, delay_samples),
                                    (decay * 0.5, delay_samples * 2),
                                    (decay * 0.25, delay_samples * 3)]):
        if d < len(output):
            output[d:] += audio[:len(output) - d].astype(np.float64) * mult
    return np.clip(output, -32768, 32767).astype(np.int16)


def highpass_filter(audio: np.ndarray, cutoff_hz: float = 80, sr: int = 16000) -> np.ndarray:
    """Simple first-order high-pass filter to remove low-frequency rumble."""
    rc = 1.0 / (2.0 * np.pi * cutoff_hz)
    dt = 1.0 / sr
    alpha = rc / (rc + dt)
    output = np.zeros_like(audio, dtype=np.float64)
    output[0] = audio[0]
    for i in range(1, len(audio)):
        output[i] = alpha * (output[i - 1] + audio[i] - audio[i - 1])
    return np.clip(output, -32768, 32767).astype(np.int16)


def augment_clip(audio: np.ndarray, target_len: int) -> np.ndarray:
    """Apply random augmentation pipeline."""
    audio = audio.copy()

    # Random gain
    if random.random() < 0.7:
        audio = random_gain(audio, -8, 8)

    # Time stretch (slight speed variation)
    if random.random() < 0.4:
        rate = random.uniform(0.85, 1.15)
        audio = time_stretch(audio, rate)

    # Simulate room reverb
    if random.random() < 0.3:
        decay = random.uniform(0.1, 0.4)
        delay = random.uniform(10, 40)
        audio = simulate_reverb(audio, decay, delay)

    # Add noise
    if random.random() < 0.5:
        snr = random.uniform(5, 30)  # Lower SNR floor for harder examples
        audio = add_noise(audio, snr)

    # Pad or trim
    audio = pad_or_trim(audio, target_len)

    return audio


# ---------------------------------------------------------------------------
# Feature computation
# ---------------------------------------------------------------------------


def compute_features_streaming(clips: list[np.ndarray], clip_duration_samples: int,
                               n_augments: int = 3) -> np.ndarray:
    """
    Compute features by running clips through the same AudioFeatures pipeline
    that the wake word model uses at inference time.

    Returns shape (n_total, 16, 96) matching openWakeWord's model input.
    """
    all_features = []
    chunk_size = 1280  # 80ms at 16kHz

    for clip in tqdm(clips, desc="Computing features"):
        for _ in range(n_augments):
            augmented = augment_clip(clip, clip_duration_samples)

            # Create fresh AudioFeatures instance for each clip
            af = AudioFeatures(inference_framework="onnx")

            # Feed audio in streaming 80ms chunks
            for i in range(0, len(augmented) - chunk_size + 1, chunk_size):
                af(augmented[i:i + chunk_size])

            # feature_buffer is an ndarray of shape (n_frames, 96)
            if len(af.feature_buffer) >= 16:
                feat_window = af.feature_buffer[-16:]  # last 16 frames
                all_features.append(feat_window)

    if not all_features:
        raise RuntimeError("No features could be computed. Check AudioFeatures internals.")

    result = np.array(all_features, dtype=np.float32)
    log.info("Feature shape: %s", result.shape)
    return result


# ---------------------------------------------------------------------------
# Model definition (matches openWakeWord architecture)
# ---------------------------------------------------------------------------

class WakeWordDNN(nn.Module):
    """Small DNN matching openwakeword's architecture for wake word detection."""

    def __init__(self, input_shape=(16, 96), n_layers=3, layer_dim=128):
        super().__init__()
        flat_dim = input_shape[0] * input_shape[1]

        layers = []
        layers.append(nn.Flatten())
        layers.append(nn.Linear(flat_dim, layer_dim))
        layers.append(nn.ReLU())

        for _ in range(n_layers - 1):
            layers.append(nn.Linear(layer_dim, layer_dim))
            layers.append(nn.ReLU())

        layers.append(nn.Linear(layer_dim, 1))
        layers.append(nn.Sigmoid())

        self.net = nn.Sequential(*layers)

    def forward(self, x):
        return self.net(x)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train(pos_features: np.ndarray, neg_features: np.ndarray,
          epochs: int = 100, lr: float = 0.001, batch_size: int = 128) -> WakeWordDNN:
    """Train the wake word model."""
    # Create labels
    pos_labels = np.ones(len(pos_features), dtype=np.float32)
    neg_labels = np.zeros(len(neg_features), dtype=np.float32)

    X = np.concatenate([pos_features, neg_features])
    y = np.concatenate([pos_labels, neg_labels])

    # Shuffle
    indices = np.random.permutation(len(X))
    X = X[indices]
    y = y[indices]

    # Split train/val (90/10)
    split = int(0.9 * len(X))
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    log.info("Training set: %d positive, %d negative",
             (y_train == 1).sum(), (y_train == 0).sum())
    log.info("Validation set: %d positive, %d negative",
             (y_val == 1).sum(), (y_val == 0).sum())

    # Create dataloaders
    train_ds = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train))
    val_ds = TensorDataset(torch.from_numpy(X_val), torch.from_numpy(y_val))
    train_dl = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_dl = DataLoader(val_ds, batch_size=batch_size)

    # Model
    input_shape = (X.shape[1], X.shape[2])
    model = WakeWordDNN(input_shape=input_shape)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.BCELoss()

    best_model = None
    best_val_loss = float("inf")

    for epoch in range(epochs):
        model.train()
        train_loss = 0
        for xb, yb in train_dl:
            pred = model(xb).squeeze()
            loss = criterion(pred, yb)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            train_loss += loss.item()

        # Validation
        model.eval()
        val_loss = 0
        correct = 0
        total = 0
        tp = fp = tn = fn = 0
        with torch.no_grad():
            for xb, yb in val_dl:
                pred = model(xb).squeeze()
                val_loss += criterion(pred, yb).item()
                predicted = (pred >= 0.5).float()
                correct += (predicted == yb).sum().item()
                total += yb.size(0)
                tp += ((predicted == 1) & (yb == 1)).sum().item()
                fp += ((predicted == 1) & (yb == 0)).sum().item()
                tn += ((predicted == 0) & (yb == 0)).sum().item()
                fn += ((predicted == 0) & (yb == 1)).sum().item()

        val_loss /= len(val_dl)
        accuracy = correct / total if total > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0

        if epoch % 10 == 0 or epoch == epochs - 1:
            log.info("Epoch %3d/%d — train_loss=%.4f val_loss=%.4f acc=%.3f "
                     "recall=%.3f precision=%.3f",
                     epoch + 1, epochs, train_loss / len(train_dl),
                     val_loss, accuracy, recall, precision)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_model = copy.deepcopy(model)

    log.info("Best validation loss: %.4f", best_val_loss)
    return best_model


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def export_onnx(model: WakeWordDNN, output_path: str, input_shape=(16, 96)):
    """Export trained model to ONNX format.

    Tries torch.onnx.export first; falls back to manual ONNX graph construction
    if onnxscript is missing (torch >= 2.10).
    """
    model.eval()
    dummy_input = torch.randn(1, *input_shape)

    try:
        torch.onnx.export(
            model,
            dummy_input,
            output_path,
            opset_version=13,
            input_names=["input"],
            output_names=["output"],
            dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}},
        )
        log.info("Model exported to %s (torch.onnx.export)", output_path)
        return
    except (ImportError, ModuleNotFoundError) as e:
        log.warning("torch.onnx.export failed (%s), using manual ONNX export", e)

    # Fallback: manually build ONNX graph using the onnx package
    _export_onnx_manual(model, output_path, input_shape)


def _export_onnx_manual(model: WakeWordDNN, output_path: str, input_shape=(16, 96)):
    """Build ONNX graph manually from the Sequential DNN weights."""
    import onnx
    from onnx import TensorProto, helper

    model.eval()
    params = dict(model.named_parameters())

    nodes = []
    initializers = []
    prev_output = "input"

    # Walk the Sequential layers
    layer_idx = 0
    for name, layer in model.net.named_children():
        if isinstance(layer, nn.Flatten):
            flat_name = f"flatten_{layer_idx}"
            nodes.append(helper.make_node(
                "Reshape", [prev_output, f"{flat_name}_shape"], [flat_name],
            ))
            shape_val = np.array([0, -1], dtype=np.int64)  # 0 = keep batch dim
            initializers.append(helper.make_tensor(
                f"{flat_name}_shape", TensorProto.INT64, [2], shape_val,
            ))
            prev_output = flat_name
            layer_idx += 1

        elif isinstance(layer, nn.Linear):
            w_name = f"net.{name}.weight"
            b_name = f"net.{name}.bias"
            matmul_out = f"linear_{layer_idx}_matmul"
            add_out = f"linear_{layer_idx}"

            w = params[w_name].detach().numpy()
            b = params[b_name].detach().numpy()

            # ONNX MatMul: (batch, in) @ (in, out) -> transpose weight
            initializers.append(helper.make_tensor(
                w_name, TensorProto.FLOAT, list(w.T.shape), w.T.flatten().tolist(),
            ))
            initializers.append(helper.make_tensor(
                b_name, TensorProto.FLOAT, list(b.shape), b.flatten().tolist(),
            ))

            nodes.append(helper.make_node("MatMul", [prev_output, w_name], [matmul_out]))
            nodes.append(helper.make_node("Add", [matmul_out, b_name], [add_out]))
            prev_output = add_out
            layer_idx += 1

        elif isinstance(layer, nn.ReLU):
            relu_out = f"relu_{layer_idx}"
            nodes.append(helper.make_node("Relu", [prev_output], [relu_out]))
            prev_output = relu_out
            layer_idx += 1

        elif isinstance(layer, nn.Sigmoid):
            sig_out = f"sigmoid_{layer_idx}"
            nodes.append(helper.make_node("Sigmoid", [prev_output], [sig_out]))
            prev_output = sig_out
            layer_idx += 1

    # Rename last output to "output"
    if nodes:
        nodes[-1].output[0] = "output"

    graph = helper.make_graph(
        nodes,
        "hey_homer",
        [helper.make_tensor_value_info("input", TensorProto.FLOAT, [None, *input_shape])],
        [helper.make_tensor_value_info("output", TensorProto.FLOAT, [None, 1])],
        initializers,
    )
    onnx_model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)])
    onnx_model.ir_version = 7
    onnx.checker.check_model(onnx_model)
    onnx.save(onnx_model, output_path)
    log.info("Model exported to %s (manual ONNX build)", output_path)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Train a custom wake word model")
    parser.add_argument("--name", type=str, default="hey_homer",
                        help="Model name (used for output filenames, e.g. 'hey_homer_turn_off')")
    parser.add_argument("--positive-phrases", type=str, default=None,
                        help="Comma-separated positive phrases (overrides built-in defaults)")
    parser.add_argument("--negative-phrases", type=str, default=None,
                        help="Comma-separated negative phrases (overrides built-in defaults)")
    parser.add_argument("--positive-samples", type=int, default=500,
                        help="Number of positive TTS clips to generate")
    parser.add_argument("--negative-samples", type=int, default=2000,
                        help="Number of negative TTS clips to generate")
    parser.add_argument("--augments", type=int, default=4,
                        help="Augmented versions per clip")
    parser.add_argument("--epochs", type=int, default=100,
                        help="Training epochs")
    parser.add_argument("--clip-duration", type=float, default=2.0,
                        help="Clip duration in seconds")
    parser.add_argument("--output-dir", type=str, default="models",
                        help="Output directory for model")
    parser.add_argument("--export-only", action="store_true",
                        help="Skip training, just export from saved .pt checkpoint")
    parser.add_argument("--record", type=int, default=0,
                        help="Record N real voice samples from the mic before training")
    parser.add_argument("--record-negative", type=int, default=0,
                        help="Record N negative (non-wake-word) samples from the mic")
    parser.add_argument("--real-samples", type=str, default=None,
                        help="Path to .npz file with previously recorded real samples to include")
    parser.add_argument("--real-negative-samples", type=str, default=None,
                        help="Path to .npz file with previously recorded negative real samples")
    parser.add_argument("--record-device", type=str, default=None,
                        help="ALSA device for recording (auto-detected if not set)")
    parser.add_argument("--real-augments", type=int, default=20,
                        help="Augmented copies per real voice sample (default: 20, since real data is scarce)")
    args = parser.parse_args()

    output_dir = Path(__file__).parent / args.output_dir
    output_dir.mkdir(exist_ok=True)

    model_name = args.name

    # Export-only mode: load checkpoint and export
    if args.export_only:
        checkpoint_path = output_dir / f"{model_name}.pt"
        if not checkpoint_path.exists():
            log.error("No checkpoint found at %s", checkpoint_path)
            return
        log.info("Loading checkpoint from %s", checkpoint_path)
        ckpt = torch.load(checkpoint_path, weights_only=True)
        input_shape = ckpt["input_shape"]
        model = WakeWordDNN(input_shape=input_shape)
        model.load_state_dict(ckpt["state_dict"])
        output_path = output_dir / f"{model_name}.onnx"
        export_onnx(model, str(output_path), input_shape=input_shape)
        log.info("Done! Model saved to %s", output_path)
        return

    # Resolve phrase lists: CLI overrides > built-in defaults
    if args.positive_phrases:
        pos_phrases = [p.strip() for p in args.positive_phrases.split(",")]
    else:
        pos_phrases = list(POSITIVE_PHRASES)

    if args.negative_phrases:
        neg_phrases = [p.strip() for p in args.negative_phrases.split(",")]
    else:
        neg_phrases = list(NEGATIVE_PHRASES)

    log.info("Training model '%s'", model_name)
    log.info("Positive phrases: %s", pos_phrases)
    log.info("Negative phrases: %s", neg_phrases)

    clip_duration_samples = int(args.clip_duration * 16000)

    # Step 0: Record real voice samples (if requested)
    real_pos_clips = []
    real_neg_clips = []

    if args.record > 0:
        log.info("=== Recording %d real positive samples ===", args.record)
        real_pos_clips = record_real_samples(args.record, "Hey Homer",
                                             duration=args.clip_duration + 0.5,
                                             device=args.record_device)
        if real_pos_clips:
            saved = save_real_samples(real_pos_clips, output_dir, "hey_homer_positive")
            log.info("Saved for reuse: %s", saved)

    if args.record_negative > 0:
        log.info("=== Recording %d real negative samples ===", args.record_negative)
        log.info("Say anything EXCEPT 'Hey Homer' — random speech, similar words, etc.")
        real_neg_clips = record_real_samples(args.record_negative, "(NOT hey homer)",
                                             duration=args.clip_duration + 0.5,
                                             device=args.record_device)
        if real_neg_clips:
            saved = save_real_samples(real_neg_clips, output_dir, "hey_homer_negative")
            log.info("Saved for reuse: %s", saved)

    if args.real_samples:
        loaded = load_real_samples(Path(args.real_samples))
        real_pos_clips.extend(loaded)

    if args.real_negative_samples:
        loaded = load_real_samples(Path(args.real_negative_samples))
        real_neg_clips.extend(loaded)

    if real_pos_clips:
        log.info("Will include %d real positive samples (×%d augments = %d features)",
                 len(real_pos_clips), args.real_augments, len(real_pos_clips) * args.real_augments)
    if real_neg_clips:
        log.info("Will include %d real negative samples (×%d augments = %d features)",
                 len(real_neg_clips), args.real_augments, len(real_neg_clips) * args.real_augments)

    # Step 1: Generate positive samples
    log.info("=== Generating %d positive TTS samples ===", args.positive_samples)
    pos_clips = asyncio.run(generate_samples(pos_phrases, args.positive_samples,
                                             desc="Positive clips"))
    log.info("Generated %d positive TTS clips", len(pos_clips))

    # Step 2: Generate negative samples
    log.info("=== Generating %d negative TTS samples ===", args.negative_samples)
    neg_clips = asyncio.run(generate_samples(neg_phrases, args.negative_samples,
                                             desc="Negative clips"))

    # Also add non-speech negative clips (noise, silence, tones)
    log.info("Adding non-speech negative clips...")
    # Pure Gaussian noise at various levels
    for _ in range(300):
        amplitude = random.uniform(100, 3000)
        noise = np.random.normal(0, amplitude, clip_duration_samples).astype(np.int16)
        neg_clips.append(noise)
    # Silence with low-level noise (ambient room)
    for _ in range(200):
        silence = np.zeros(clip_duration_samples, dtype=np.int16)
        silence = add_noise(silence, snr_db=random.uniform(10, 40))
        neg_clips.append(silence)
    # Pink-ish noise (more realistic ambient than white noise)
    for _ in range(100):
        white = np.random.normal(0, 1, clip_duration_samples)
        # Simple 1/f approximation via cumulative filtering
        pink = np.cumsum(white)
        pink = pink - np.mean(pink)
        pink = pink / (np.max(np.abs(pink)) + 1e-8) * random.uniform(500, 3000)
        neg_clips.append(pink.astype(np.int16))
    # Sine wave hum (TV/appliance hum at 50/60 Hz harmonics)
    for _ in range(100):
        freq = random.choice([50, 60, 100, 120, 180, 240])
        t = np.linspace(0, clip_duration_samples / 16000, clip_duration_samples)
        hum = np.sin(2 * np.pi * freq * t) * random.uniform(500, 2000)
        hum = add_noise(hum.astype(np.int16), snr_db=random.uniform(10, 25))
        neg_clips.append(hum)
    log.info("Total negative clips: %d", len(neg_clips))

    # Step 3: Compute features
    log.info("=== Computing features ===")
    log.info("Computing positive features...")
    pos_features = compute_features_streaming(pos_clips, clip_duration_samples,
                                              n_augments=args.augments)
    log.info("Computing negative features...")
    neg_features = compute_features_streaming(neg_clips, clip_duration_samples,
                                              n_augments=args.augments)

    # Compute real sample features with higher augmentation factor
    if real_pos_clips:
        log.info("Computing real positive features (×%d augments)...", args.real_augments)
        real_pos_features = compute_features_streaming(
            real_pos_clips, clip_duration_samples, n_augments=args.real_augments)
        pos_features = np.concatenate([pos_features, real_pos_features])
        log.info("Added %d real positive features (total: %d)", len(real_pos_features), len(pos_features))

    if real_neg_clips:
        log.info("Computing real negative features (×%d augments)...", args.real_augments)
        real_neg_features = compute_features_streaming(
            real_neg_clips, clip_duration_samples, n_augments=args.real_augments)
        neg_features = np.concatenate([neg_features, real_neg_features])
        log.info("Added %d real negative features (total: %d)", len(real_neg_features), len(neg_features))

    log.info("Positive features: %s, Negative features: %s",
             pos_features.shape, neg_features.shape)

    # Step 4: Train
    log.info("=== Training model ===")
    model = train(pos_features, neg_features, epochs=args.epochs)

    # Step 5: Save checkpoint (so model is never lost if export fails)
    checkpoint_path = output_dir / f"{model_name}.pt"
    input_shape = (pos_features.shape[1], pos_features.shape[2])
    torch.save({"state_dict": model.state_dict(), "input_shape": input_shape}, checkpoint_path)
    log.info("Checkpoint saved to %s", checkpoint_path)

    # Step 6: Export to ONNX
    output_path = output_dir / f"{model_name}.onnx"
    export_onnx(model, str(output_path), input_shape=input_shape)
    log.info("Done! Model saved to %s", output_path)
    log.info("Restart wake-word service to use the new model:")
    log.info("  sudo systemctl restart wake-word")


if __name__ == "__main__":
    main()
