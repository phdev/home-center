#!/usr/bin/env python3
"""
Wake Word Detection Service for Home Center

Listens continuously for the wake word "Hey Homer" using openWakeWord,
then turns on the TV via HDMI-CEC.

Hardware: ReSpeaker 2-Mics Pi HAT (or any ALSA-compatible microphone)
"""

import argparse
import logging
import subprocess
import sys
import time
import wave
from pathlib import Path

import numpy as np
import pyaudio
from openwakeword.model import Model


def _inference_framework() -> str:
    """Return the best available inference framework for openWakeWord."""
    try:
        import tflite_runtime  # noqa: F401
        return "tflite"
    except ImportError:
        pass
    try:
        import onnxruntime  # noqa: F401
        return "onnx"
    except ImportError:
        pass
    return "tflite"  # let openwakeword raise a clear error

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
WAKE_WORD = "hey_homer"
SAMPLE_RATE = 16000
CHUNK_SIZE = 1280  # 80ms at 16kHz — required by openWakeWord
CHANNELS = 1
FORMAT = pyaudio.paInt16
DETECTION_THRESHOLD = 0.5
COOLDOWN_SECONDS = 10  # Prevent repeated triggers

SOUNDS_DIR = Path(__file__).parent / "sounds"
CHIME_PATH = SOUNDS_DIR / "acknowledge.wav"

CEC_DEVICE = "0"  # TV logical address on CEC bus
CEC_ON_CMD = "on {dev}"
CEC_ACTIVE_CMD = "as"  # Set Pi as active source

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("wake-word")


# ---------------------------------------------------------------------------
# HDMI-CEC helpers
# ---------------------------------------------------------------------------

def cec_send(command: str) -> bool:
    """Send a CEC command via cec-client. Returns True on success."""
    try:
        proc = subprocess.run(
            ["cec-client", "-s", "-d", "1"],
            input=command + "\n",
            capture_output=True,
            text=True,
            timeout=10,
        )
        log.debug("CEC response: %s", proc.stdout.strip())
        return proc.returncode == 0
    except FileNotFoundError:
        log.error("cec-client not found. Install with: sudo apt install cec-utils")
        return False
    except subprocess.TimeoutExpired:
        log.warning("CEC command timed out")
        return False


def turn_on_tv() -> None:
    """Turn on the TV and set the Pi as the active HDMI source."""
    log.info("Turning TV ON via HDMI-CEC...")
    cec_send(CEC_ON_CMD.format(dev=CEC_DEVICE))
    time.sleep(1)
    cec_send(CEC_ACTIVE_CMD)
    log.info("TV should now be on and showing this Pi's HDMI output.")


def is_tv_on() -> bool:
    """Check if the TV is currently powered on."""
    try:
        proc = subprocess.run(
            ["cec-client", "-s", "-d", "1"],
            input="pow 0\n",
            capture_output=True,
            text=True,
            timeout=10,
        )
        return "power status: on" in proc.stdout.lower()
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Audio acknowledgement
# ---------------------------------------------------------------------------

def generate_chime(path: Path) -> None:
    """Generate a two-tone acknowledgement chime WAV file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    sr = 22050

    def tone(freq: float, duration: float) -> np.ndarray:
        t = np.linspace(0, duration, int(sr * duration), endpoint=False)
        attack = np.minimum(t / 0.01, 1.0)
        decay = np.maximum(1.0 - t / (duration * 1.2), 0.0)
        env = attack * decay
        signal = env * (np.sin(2 * np.pi * freq * t)
                        + 0.3 * np.sin(4 * np.pi * freq * t))
        return signal

    chime = np.concatenate([
        tone(523.25, 0.12),          # C5
        np.zeros(int(sr * 0.03)),    # 30 ms gap
        tone(659.25, 0.18),          # E5
    ])
    chime = (chime / np.max(np.abs(chime)) * 28000).astype(np.int16)

    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(chime.tobytes())
    log.info("Generated acknowledgement chime: %s", path)


def find_speaker_device() -> str | None:
    """Find the ALSA playback device for the ReSpeaker HAT / WM8960."""
    try:
        result = subprocess.run(
            ["aplay", "-l"],
            capture_output=True, text=True, timeout=5,
        )
        for line in result.stdout.splitlines():
            lower = line.lower()
            if lower.startswith("card") and any(
                kw in lower for kw in ("respeaker", "seeed", "wm8960")
            ):
                card_num = lower.split(":")[0].replace("card", "").strip()
                return f"plughw:{card_num},0"
    except Exception:
        pass
    return None


def play_acknowledgement() -> None:
    """Play a short chime through the ReSpeaker HAT speaker (non-blocking)."""
    if not CHIME_PATH.exists():
        generate_chime(CHIME_PATH)

    device = find_speaker_device()
    cmd = ["aplay", "-q"]
    if device:
        cmd.extend(["-D", device])
    cmd.append(str(CHIME_PATH))

    try:
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.info("Playing acknowledgement chime")
    except FileNotFoundError:
        log.warning("aplay not found — cannot play acknowledgement sound")
    except Exception as e:
        log.warning("Failed to play acknowledgement: %s", e)


# ---------------------------------------------------------------------------
# Microphone helpers
# ---------------------------------------------------------------------------

def find_mic_index(pa: pyaudio.PyAudio) -> int | None:
    """Find the best input device index. Prefers ReSpeaker, falls back to default."""
    respeaker_idx = None
    default_idx = None

    for i in range(pa.get_device_count()):
        info = pa.get_device_info_by_index(i)
        if info["maxInputChannels"] < 1:
            continue

        name = info["name"].lower()
        log.debug("Audio device %d: %s (%d ch)", i, info["name"], info["maxInputChannels"])

        # Prefer ReSpeaker / seeed / wm8960
        if any(kw in name for kw in ("respeaker", "seeed", "wm8960", "2mic")):
            respeaker_idx = i
        elif default_idx is None:
            default_idx = i

    if respeaker_idx is not None:
        log.info("Using ReSpeaker mic (device %d)", respeaker_idx)
        return respeaker_idx

    if default_idx is not None:
        log.info("ReSpeaker not found — using default mic (device %d)", default_idx)
        return default_idx

    return None


# ---------------------------------------------------------------------------
# Custom wake word model setup
# ---------------------------------------------------------------------------

def get_or_train_model() -> Model:
    """
    Load the openWakeWord model.

    openWakeWord ships with several pre-trained models. For a custom wake word
    like "Hey Homer", we use openWakeWord's built-in text-to-speech generated
    model training. If a pre-trained model path is supplied, it uses that.
    Otherwise, it attempts on-the-fly generation (requires internet on first run).
    """
    custom_model_dir = Path(__file__).parent / "models"
    custom_model_dir.mkdir(exist_ok=True)

    custom_model = custom_model_dir / "hey_homer.tflite"

    framework = _inference_framework()
    log.info("Using inference framework: %s", framework)

    if custom_model.exists():
        log.info("Loading custom wake word model: %s", custom_model)
        return Model(wakeword_models=[str(custom_model)], inference_framework=framework)

    # Use openWakeWord's automatic model generation for custom phrases.
    # This generates synthetic training data via text-to-speech and trains
    # a small model on-device.
    log.info("No pre-trained model found. Training 'hey homer' model on-device...")
    log.info("This uses openWakeWord's automatic training and may take a few minutes on first run.")

    try:
        from openwakeword.train import train_custom_model

        model_path = train_custom_model(
            phrase="hey homer",
            output_dir=str(custom_model_dir),
            num_samples=1500,
            epochs=50,
        )
        log.info("Custom model saved to: %s", model_path)
        return Model(wakeword_models=[str(model_path)], inference_framework=framework)
    except (ImportError, Exception) as e:
        log.warning("Auto-training not available (%s). Falling back to built-in models.", e)
        log.info("Using 'hey jarvis' as a stand-in. See pi/README.md to train a custom model.")
        # Fall back to a built-in model for demo purposes
        return Model(inference_framework=framework)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Wake word listener for Home Center")
    parser.add_argument("--threshold", type=float, default=DETECTION_THRESHOLD,
                        help="Detection confidence threshold (0-1)")
    parser.add_argument("--cooldown", type=int, default=COOLDOWN_SECONDS,
                        help="Seconds to wait between triggers")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print detections without sending CEC commands")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    # Pre-generate acknowledgement chime so first trigger is instant
    if not CHIME_PATH.exists():
        generate_chime(CHIME_PATH)

    # Load wake word model
    model = get_or_train_model()

    # List the wake words the model is listening for
    wake_words = list(model.models.keys())
    log.info("Listening for wake words: %s (threshold=%.2f)", wake_words, args.threshold)

    # Setup audio
    pa = pyaudio.PyAudio()
    mic_idx = find_mic_index(pa)
    if mic_idx is None:
        log.error("No microphone found! Check your ReSpeaker HAT or plug in a USB mic.")
        pa.terminate()
        sys.exit(1)

    stream = pa.open(
        format=FORMAT,
        channels=CHANNELS,
        rate=SAMPLE_RATE,
        input=True,
        input_device_index=mic_idx,
        frames_per_buffer=CHUNK_SIZE,
    )

    log.info("Microphone stream open. Listening...")
    last_trigger = 0.0

    try:
        while True:
            audio_data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
            audio_array = np.frombuffer(audio_data, dtype=np.int16)

            # Feed audio to the model
            model.predict(audio_array)

            # Check each wake word score
            for ww_name in wake_words:
                score = model.prediction_buffer[ww_name][-1]

                if args.debug and score > 0.1:
                    log.debug("%s score: %.3f", ww_name, score)

                if score >= args.threshold:
                    now = time.time()
                    if now - last_trigger < args.cooldown:
                        log.debug("Cooldown active, ignoring detection")
                        continue

                    last_trigger = now
                    log.info("Wake word '%s' detected! (score=%.3f)", ww_name, score)

                    if args.dry_run:
                        log.info("[DRY RUN] Would turn on TV via CEC")
                    else:
                        play_acknowledgement()
                        turn_on_tv()

    except KeyboardInterrupt:
        log.info("Shutting down...")
    finally:
        stream.stop_stream()
        stream.close()
        pa.terminate()


if __name__ == "__main__":
    main()
