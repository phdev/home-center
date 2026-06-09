#!/usr/bin/env python3
"""Replay wake-word WAV fixtures through LiveKitWakeWordDetector."""

from __future__ import annotations

import argparse
import json
import sys
import time
import wave
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parent
DEFAULT_MANIFEST = ROOT / "wakeword-data/generated/manifest.json"
DEFAULT_MODEL = ROOT.parent / "pi/models/hey_homer.onnx"
CHUNK_SIZE = 1280


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as audio:
        if audio.getnchannels() != 1 or audio.getsampwidth() != 2:
            raise ValueError(f"{path} must be mono 16-bit PCM")
        frames = audio.readframes(audio.getnframes())
    return np.frombuffer(frames, dtype=np.int16).copy()


def replay(detector: Any, pcm: np.ndarray, preroll_samples: int = 0) -> dict[str, Any]:
    hit = False
    max_score = 0.0
    hit_source = ""
    started = time.perf_counter()
    if preroll_samples > 0:
        pcm = np.concatenate([np.zeros(preroll_samples, dtype=np.int16), pcm])
    for offset in range(0, len(pcm), CHUNK_SIZE):
        chunk = pcm[offset : offset + CHUNK_SIZE]
        if len(chunk) < CHUNK_SIZE:
            chunk = np.pad(chunk, (0, CHUNK_SIZE - len(chunk)))
        chunk_hit, _text, source = detector.accept(chunk)
        try:
            max_score = max(max_score, float(source.rsplit(":", 1)[-1]))
        except ValueError:
            pass
        if chunk_hit and not hit:
            hit = True
            hit_source = source
    return {
        "hit": hit,
        "source": hit_source,
        "maxScore": round(max_score, 4),
        "latencyMs": round((time.perf_counter() - started) * 1000, 1),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--threshold", type=float, default=0.995)
    parser.add_argument("--min-consecutive", type=int, default=3)
    parser.add_argument(
        "--preroll-seconds",
        type=float,
        default=2.0,
        help="Silence prepended before each fixture to simulate production rolling audio.",
    )
    parser.add_argument("--output", type=Path, default=ROOT / "wakeword-data/eval-results/latest-livekit.json")
    args = parser.parse_args()

    sys.path.insert(0, str(ROOT))
    from voice_service import LiveKitWakeWordDetector

    manifest = json.loads(args.manifest.read_text())
    rows = []
    counts = defaultdict(int)
    base = args.manifest.parent
    detector = LiveKitWakeWordDetector(
        args.model,
        cooldown=0.0,
        threshold=args.threshold,
        min_consecutive=args.min_consecutive,
    )
    try:
        for fixture in manifest["fixtures"]:
            reset = getattr(detector, "reset", None)
            if callable(reset):
                reset()
            result = replay(
                detector,
                read_wav(base / fixture["path"]),
                preroll_samples=max(0, int(args.preroll_seconds * 16000)),
            )
            expected = bool(fixture["expectedWake"])
            actual = bool(result["hit"])
            if expected and actual:
                bucket = "true_positive"
            elif expected and not actual:
                bucket = "false_negative"
            elif not expected and actual:
                bucket = "false_positive"
            else:
                bucket = "true_negative"
            counts[bucket] += 1
            rows.append({**fixture, **result, "result": bucket})
    finally:
        close = getattr(detector, "close", None)
        if callable(close):
            close()

    positives = counts["true_positive"] + counts["false_negative"]
    negatives = counts["true_negative"] + counts["false_positive"]
    summary = {
        "schema": "home-center.wakeword-eval.v1",
        "manifest": str(args.manifest),
        "model": str(args.model),
        "threshold": args.threshold,
        "minConsecutive": args.min_consecutive,
        "prerollSeconds": args.preroll_seconds,
        "counts": dict(counts),
        "recall": round(counts["true_positive"] / positives, 4) if positives else None,
        "falsePositiveRate": round(counts["false_positive"] / negatives, 4) if negatives else None,
        "rows": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps({k: summary[k] for k in ["counts", "recall", "falsePositiveRate"]}, indent=2))
    return 1 if counts["false_positive"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
