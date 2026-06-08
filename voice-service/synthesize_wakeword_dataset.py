#!/usr/bin/env python3
"""Generate synthetic wake-word WAV fixtures and a manifest.

This uses licensed system TTS voices through macOS `say`. It does not clone
family members and writes generated audio only to ignored local paths.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import shutil
import subprocess
import wave
from pathlib import Path
from typing import Any

import numpy as np

SAMPLE_RATE = 16000
ROOT = Path(__file__).resolve().parent
DEFAULT_CORPUS = ROOT / "wakeword_corpus.json"
DEFAULT_OUTPUT = ROOT / "wakeword-data/generated"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def duration_seconds(path: Path) -> float:
    with wave.open(str(path), "rb") as audio:
        return audio.getnframes() / float(audio.getframerate())


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as audio:
        if audio.getnchannels() != 1 or audio.getsampwidth() != 2:
            raise ValueError(f"{path} must be mono 16-bit PCM")
        frames = audio.readframes(audio.getnframes())
    return np.frombuffer(frames, dtype=np.int16).copy()


def write_wav(path: Path, pcm: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(SAMPLE_RATE)
        audio.writeframes(pcm.astype(np.int16, copy=False).tobytes())


def augment_audio(pcm: np.ndarray, gain: float, snr_db: float | None, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    audio = pcm.astype(np.float32) * gain
    if snr_db is not None and len(audio):
        signal_rms = max(float(np.sqrt(np.mean(audio**2))), 1.0)
        noise_rms = signal_rms / (10 ** (snr_db / 20.0))
        noise = rng.normal(0.0, noise_rms, size=len(audio)).astype(np.float32)
        audio = audio + noise
    return np.clip(audio, -32768, 32767).astype(np.int16)


def synthesize_phrase(say: str, afconvert: str, voice: str, rate: int, phrase: str, wav_path: Path) -> None:
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_aiff = wav_path.with_suffix(".aiff")
    subprocess.run([say, "-v", voice, "-r", str(rate), "-o", str(tmp_aiff), phrase], check=True)
    subprocess.run([afconvert, "-f", "WAVE", "-d", f"LEI16@{SAMPLE_RATE}", "-c", "1", str(tmp_aiff), str(wav_path)], check=True)
    tmp_aiff.unlink(missing_ok=True)


def available_voice_names() -> set[str]:
    say = shutil.which("say")
    if not say:
        return set()
    result = subprocess.run([say, "-v", "?"], check=True, text=True, capture_output=True)
    names = set()
    for line in result.stdout.splitlines():
        if " #" not in line:
            continue
        names.add(line.split(" #", 1)[0].rsplit(None, 1)[0].strip())
    return names


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--max-per-bucket", type=int, default=120)
    parser.add_argument("--seed", type=int, default=20260608)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    say = shutil.which("say")
    afconvert = shutil.which("afconvert")
    if not say or not afconvert:
        raise SystemExit("Synthetic generation requires macOS `say` and `afconvert`.")

    corpus = load_json(args.corpus)
    phrases = [("positive", p) for p in corpus["positiveTemplates"]] + [("negative", p) for p in corpus["negativeTemplates"]]
    rates = corpus["rates"]
    gains = corpus["gainFactors"]
    noises = corpus["noiseProfiles"]
    voices = available_voice_names()
    rng = random.Random(args.seed)
    manifest = {
        "schema": "home-center.wakeword-fixtures.v1",
        "sourceCorpus": str(args.corpus),
        "audioRetained": True,
        "privacy": "synthetic licensed system voices only; no cloned family voices",
        "fixtures": []
    }

    for bucket in corpus["voiceBuckets"]:
        choices = [voice for voice in bucket["macosVoices"] if voice in voices]
        if not choices:
            print(f"Skipping {bucket['id']}: none of {bucket['macosVoices']} are installed.")
            continue
        combos = []
        for label, phrase in phrases:
            for voice in choices:
                for rate in rates:
                    for gain in gains:
                        for noise in noises:
                            combos.append((label, phrase, voice, rate, gain, noise))
        rng.shuffle(combos)
        for index, (label, phrase, voice, rate, gain, noise) in enumerate(combos[: args.max_per_bucket], start=1):
            fixture_id = f"{bucket['id']}-{index:04d}"
            rel_path = Path(bucket["id"]) / f"{fixture_id}.wav"
            wav_path = args.output_dir / rel_path
            if args.dry_run:
                seconds = 0.0
            else:
                base_path = args.output_dir / bucket["id"] / f"{fixture_id}.base.wav"
                synthesize_phrase(say, afconvert, voice, rate, phrase, base_path)
                pcm = augment_audio(read_wav(base_path), gain, noise["snrDb"], args.seed + index)
                write_wav(wav_path, pcm)
                base_path.unlink(missing_ok=True)
                seconds = duration_seconds(wav_path)
            manifest["fixtures"].append({
                "id": fixture_id,
                "label": label,
                "expectedWake": label == "positive",
                "phrase": phrase,
                "voiceBucket": bucket["id"],
                "voice": voice,
                "rate": rate,
                "gain": gain,
                "noiseProfile": noise["id"],
                "snrDb": noise["snrDb"],
                "path": str(rel_path),
                "seconds": round(seconds, 3),
            })

    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {len(manifest['fixtures'])} fixtures to {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
