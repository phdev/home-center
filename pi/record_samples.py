#!/usr/bin/env python3
"""
Record real voice samples for wake word training.

Records audio clips from the ReSpeaker mic on the Pi and saves them as
labeled WAV files for use with train_hey_homer.py.

Usage (on the Pi):
    python pi/record_samples.py --type positive --count 20
    python pi/record_samples.py --type negative --count 20
    python pi/record_samples.py --type background --duration 60

Positive samples: Say "Hey Homer" when prompted (records 2.5s clips).
Negative samples: Say confusable phrases when prompted (records 2.5s clips).
Background samples: Records ambient room noise for augmentation.

Output goes to pi/samples/{positive,negative,background}/ as WAV files.
"""

import argparse
import logging
import subprocess
import sys
import time
import wave
from pathlib import Path

import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("record")

SAMPLE_RATE = 16000
CHANNELS = 2  # ReSpeaker 2-Mic HAT
SAMPLES_DIR = Path(__file__).parent / "samples"

NEGATIVE_PROMPTS = [
    "hey there", "hey honey", "hey brother", "homework",
    "hey hooper", "hey cooper", "home run", "humor",
    "hey siri", "hey google", "good morning", "hey home",
    "homer simpson", "say something random", "hey mother",
    "hey hummer", "hey holmer", "hey mover",
]


def find_respeaker_device() -> str | None:
    try:
        result = subprocess.run(
            ["arecord", "-l"], capture_output=True, text=True, timeout=5,
        )
        for line in result.stdout.splitlines():
            lower = line.lower()
            if lower.startswith("card") and any(
                kw in lower for kw in ("respeaker", "seeed", "wm8960", "2mic")
            ):
                card_num = lower.split(":")[0].replace("card", "").strip()
                return f"hw:{card_num},0"
    except Exception as e:
        log.warning("Error scanning for ReSpeaker: %s", e)
    return None


def record_clip(device: str, duration: float) -> np.ndarray:
    """Record a clip using arecord and return mono int16 array."""
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as f:
        cmd = [
            "arecord", "-D", device, "-f", "S16_LE",
            "-r", str(SAMPLE_RATE), "-c", str(CHANNELS),
            "-d", str(int(duration + 1)),  # slight overrecord
            "-q", f.name,
        ]
        subprocess.run(cmd, timeout=int(duration + 5))
        with wave.open(f.name, "r") as wf:
            frames = wf.readframes(wf.getnframes())
            audio = np.frombuffer(frames, dtype=np.int16)
            if wf.getnchannels() > 1:
                audio = audio.reshape(-1, wf.getnchannels()).mean(axis=1).astype(np.int16)
            target_len = int(SAMPLE_RATE * duration)
            return audio[:target_len]


def save_wav(audio: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(audio.tobytes())


def record_prompted_clips(device: str, sample_type: str, count: int, duration: float):
    out_dir = SAMPLES_DIR / sample_type
    out_dir.mkdir(parents=True, exist_ok=True)

    # Find next index
    existing = list(out_dir.glob("*.wav"))
    start_idx = len(existing)

    if sample_type == "positive":
        print(f"\n{'='*50}")
        print(f"Recording {count} POSITIVE samples (say 'Hey Homer')")
        print(f"Duration: {duration}s per clip")
        print(f"Vary your distance, volume, and speaking style!")
        print(f"{'='*50}\n")
    else:
        print(f"\n{'='*50}")
        print(f"Recording {count} NEGATIVE samples")
        print(f"Say the prompted phrase, or something random")
        print(f"{'='*50}\n")

    for i in range(count):
        idx = start_idx + i
        if sample_type == "positive":
            prompt = "Hey Homer"
            # Suggest variations
            variations = [
                "(normal voice)", "(whisper)", "(loud)",
                "(from far away)", "(quickly)", "(slowly)",
                "(different pitch)", "(casual)", "(excited)",
            ]
            var = variations[i % len(variations)]
            print(f"  [{idx+1}] Say: '{prompt}' {var}")
        else:
            prompt = NEGATIVE_PROMPTS[i % len(NEGATIVE_PROMPTS)]
            print(f"  [{idx+1}] Say: '{prompt}'")

        input("  Press ENTER when ready, then speak...")
        print("  Recording...", end="", flush=True)

        audio = record_clip(device, duration)
        rms = np.sqrt(np.mean(audio.astype(np.float64) ** 2))
        path = out_dir / f"{sample_type}_{idx:04d}.wav"
        save_wav(audio, path)
        print(f" done (RMS={rms:.0f}) -> {path.name}")

    print(f"\nRecorded {count} {sample_type} samples to {out_dir}/")


def record_background(device: str, duration: float):
    out_dir = SAMPLES_DIR / "background"
    out_dir.mkdir(parents=True, exist_ok=True)

    existing = list(out_dir.glob("*.wav"))
    idx = len(existing)

    print(f"\n{'='*50}")
    print(f"Recording {duration}s of BACKGROUND audio")
    print(f"Leave the room as-is (TV on, normal ambient noise)")
    print(f"{'='*50}\n")

    input("Press ENTER to start recording...")
    print("Recording...", end="", flush=True)

    # Record in 10s chunks for manageability
    chunk_duration = 10.0
    chunks_needed = int(duration / chunk_duration) + 1
    for c in range(chunks_needed):
        remaining = min(chunk_duration, duration - c * chunk_duration)
        if remaining <= 0:
            break
        audio = record_clip(device, remaining)
        path = out_dir / f"background_{idx + c:04d}.wav"
        save_wav(audio, path)
        print(".", end="", flush=True)

    print(f" done!")
    print(f"Saved {chunks_needed} background clips to {out_dir}/")


def main():
    parser = argparse.ArgumentParser(description="Record voice samples for wake word training")
    parser.add_argument("--type", choices=["positive", "negative", "background"],
                        required=True, help="Type of samples to record")
    parser.add_argument("--count", type=int, default=20,
                        help="Number of clips to record (for positive/negative)")
    parser.add_argument("--duration", type=float, default=2.5,
                        help="Duration per clip in seconds (or total for background)")
    parser.add_argument("--device", type=str, default=None,
                        help="ALSA device (auto-detected if not specified)")
    args = parser.parse_args()

    device = args.device or find_respeaker_device()
    if not device:
        log.error("No ReSpeaker mic found. Specify --device manually.")
        sys.exit(1)
    log.info("Using device: %s", device)

    if args.type == "background":
        record_background(device, args.duration)
    else:
        record_prompted_clips(device, args.type, args.count, args.duration)

    print(f"\nNext steps:")
    print(f"  1. Record more samples if needed (aim for 50-100 positive)")
    print(f"  2. Train with real data:")
    print(f"     python pi/train_hey_homer.py --use-real-samples --positive-samples 500 --augments 6")


if __name__ == "__main__":
    main()
