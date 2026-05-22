#!/usr/bin/env python3
"""Benchmark Home Center command transcription backends.

The default fixture set is synthesized with macOS `say` into a temporary
directory and deleted after the run. Real household recordings can be supplied
with --fixture-manifest, but the script never writes audio into the repo.
"""

from __future__ import annotations

import argparse
import aifc
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests


DEFAULT_PHRASES = [
    "Hey Homer, turn on",
    "Hey Homer, open calendar",
    "Hey Homer, show the weather",
    "Hey Homer, set a timer for ten seconds",
    "Hey Homer, stop",
    "Hey Homer, go back",
    "Hey Homer, go home",
    "Hey Homer, close calendar",
    "Hey Homer, open photos",
    "Hey Homer, back please",
]

LOCAL_PROMPT = (
    "Hey Homer, turn on. Hey Homer, open calendar. "
    "Hey Homer, show the weather. Hey Homer, set a timer for ten seconds. "
    "Hey Homer, go back. Hey Homer, go home. Hey Homer, stop. "
    "Hey Homer, I like this design. Hey Homer, I don't like this design. Turn off."
)

CLOUD_PRICE_PER_MINUTE = {
    "gpt-4o-mini-transcribe": None,
    "gpt-4o-transcribe": None,
}

OPENAI_AUDIO_MIME_TYPES = {
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".mp4": "audio/mp4",
    ".mpeg": "audio/mpeg",
    ".mpga": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".webm": "audio/webm",
}


@dataclass
class Fixture:
    id: str
    expected: str
    path: Path
    seconds: float
    source: str


def normalize_words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", text.lower())


def edit_distance(a: list[str], b: list[str]) -> int:
    previous = list(range(len(b) + 1))
    for i, left in enumerate(a, start=1):
        current = [i]
        for j, right in enumerate(b, start=1):
            current.append(
                min(
                    previous[j] + 1,
                    current[j - 1] + 1,
                    previous[j - 1] + (0 if left == right else 1),
                )
            )
        previous = current
    return previous[-1]


def wer(expected: str, actual: str) -> float:
    words = normalize_words(expected)
    if not words:
        return 0.0 if not normalize_words(actual) else 1.0
    return edit_distance(words, normalize_words(actual)) / len(words)


def duration_seconds(path: Path) -> float:
    if path.suffix.lower() in {".aif", ".aiff"}:
        try:
            with aifc.open(str(path), "rb") as audio:
                return audio.getnframes() / float(audio.getframerate())
        except Exception:
            afinfo = shutil.which("afinfo")
            if afinfo:
                output = subprocess.check_output([afinfo, str(path)], text=True)
                match = re.search(r"estimated duration:\s*([0-9.]+)\s*sec", output)
                if match:
                    return float(match.group(1))
    return 0.0


def synthesize_fixtures(phrases: list[str], directory: Path, voice: str) -> list[Fixture]:
    say = shutil.which("say")
    if not say:
        raise SystemExit("macOS `say` is required for synthetic fixtures")
    directory.mkdir(parents=True, exist_ok=True)
    fixtures: list[Fixture] = []
    for index, phrase in enumerate(phrases, start=1):
        path = directory / f"synthetic-{index:02d}.aiff"
        subprocess.run([say, "-v", voice, "-o", str(path), phrase], check=True)
        fixtures.append(
            Fixture(
                id=f"synthetic-{index:02d}",
                expected=phrase,
                path=path,
                seconds=duration_seconds(path),
                source=f"macos-say:{voice}",
            )
        )
    return fixtures


def load_manifest(path: Path) -> list[Fixture]:
    data = json.loads(path.read_text(encoding="utf-8"))
    fixtures = []
    for item in data.get("fixtures", []):
        audio_path = Path(item["path"]).expanduser()
        if not audio_path.is_absolute():
            audio_path = (path.parent / audio_path).resolve()
        fixtures.append(
            Fixture(
                id=item["id"],
                expected=item["expected"],
                path=audio_path,
                seconds=float(item.get("seconds") or duration_seconds(audio_path)),
                source=item.get("source", "manifest"),
            )
        )
    return fixtures


def transcribe_local(fixtures: list[Fixture], model_name: str) -> dict[str, Any]:
    from faster_whisper import WhisperModel

    started = time.perf_counter()
    model = WhisperModel(model_name, compute_type="int8", device="cpu")
    load_ms = (time.perf_counter() - started) * 1000
    results = []
    for fixture in fixtures:
        started = time.perf_counter()
        segments, _ = model.transcribe(
            str(fixture.path),
            beam_size=1,
            language="en",
            condition_on_previous_text=False,
            no_speech_threshold=0.45,
            vad_filter=False,
            initial_prompt=LOCAL_PROMPT,
        )
        transcript = " ".join(seg.text.strip() for seg in segments).strip()
        elapsed_ms = (time.perf_counter() - started) * 1000
        results.append(result_row(fixture, transcript, elapsed_ms))
    return summarize_backend(f"faster-whisper:{model_name}", results, {"load_ms": round(load_ms, 1)})


def transcribe_cloud(fixtures: list[Fixture], model_name: str, api_key: str) -> dict[str, Any]:
    results = []
    for fixture in fixtures:
        started = time.perf_counter()
        upload_path, cleanup_path = openai_upload_audio_path(fixture.path)
        try:
            with upload_path.open("rb") as audio:
                response = requests.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    data={
                        "model": model_name,
                        "response_format": "text",
                        "language": "en",
                        "prompt": LOCAL_PROMPT,
                    },
                    files={"file": (upload_path.name, audio, openai_audio_mime_type(upload_path))},
                    timeout=60,
                )
        finally:
            if cleanup_path:
                cleanup_path.unlink(missing_ok=True)
        elapsed_ms = (time.perf_counter() - started) * 1000
        if response.status_code >= 400:
            transcript = ""
            error = f"openai-{response.status_code}:{response.text[:240]}"
        else:
            transcript = response.text.strip()
            error = None
        row = result_row(fixture, transcript, elapsed_ms)
        if error:
            row["error"] = error
        results.append(row)
    total_minutes = sum(fixture.seconds for fixture in fixtures) / 60.0
    return summarize_backend(
        f"openai:{model_name}",
        results,
        {
            "audio_minutes": round(total_minutes, 4),
            "pricing_note": "Request-response transcription pricing was not hardcoded; check current OpenAI pricing before production use.",
        },
    )


def openai_audio_mime_type(path: Path) -> str:
    return OPENAI_AUDIO_MIME_TYPES.get(path.suffix.lower(), "application/octet-stream")


def openai_upload_audio_path(path: Path) -> tuple[Path, Path | None]:
    if path.suffix.lower() in OPENAI_AUDIO_MIME_TYPES:
        return path, None

    afconvert = shutil.which("afconvert")
    if not afconvert:
        raise RuntimeError(f"OpenAI does not support {path.suffix}; install afconvert or provide a supported audio format")

    fd, output_name = tempfile.mkstemp(prefix=f"{path.stem}-", suffix=".wav")
    os.close(fd)
    output = Path(output_name)
    subprocess.run([afconvert, "-f", "WAVE", "-d", "LEI16", str(path), str(output)], check=True)
    return output, output


def result_row(fixture: Fixture, transcript: str, elapsed_ms: float) -> dict[str, Any]:
    return {
        "id": fixture.id,
        "source": fixture.source,
        "seconds": round(fixture.seconds, 3),
        "expected": fixture.expected,
        "transcript": transcript,
        "wer": round(wer(fixture.expected, transcript), 4),
        "latency_ms": round(elapsed_ms, 1),
    }


def summarize_backend(name: str, rows: list[dict[str, Any]], extra: dict[str, Any] | None = None) -> dict[str, Any]:
    wers = [row["wer"] for row in rows]
    latencies = [row["latency_ms"] for row in rows]
    exact = sum(1 for row in rows if row["wer"] == 0)
    return {
        "backend": name,
        "fixtures": len(rows),
        "exact": exact,
        "mean_wer": round(sum(wers) / len(wers), 4) if wers else None,
        "max_wer": max(wers) if wers else None,
        "median_latency_ms": percentile(latencies, 50),
        "p95_latency_ms": percentile(latencies, 95),
        "extra": extra or {},
        "results": rows,
    }


def percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((pct / 100.0) * (len(ordered) - 1))))
    return round(ordered[index], 1)


def write_markdown(path: Path, payload: dict[str, Any]) -> None:
    lines = [
        "# Voice STT Benchmark",
        "",
        f"Generated: {payload['generated_at']}",
        f"Fixture source: {payload['fixture_source']}",
        f"Audio retained: {payload['audio_retained']}",
        "",
        "## Summary",
        "",
        "| Backend | Exact | Mean WER | P95 latency | Notes |",
        "| --- | ---: | ---: | ---: | --- |",
    ]
    for backend in payload["backends"]:
        note = ""
        if backend["backend"].startswith("openai:"):
            note = backend["extra"].get("pricing_note", "")
        elif backend["extra"].get("load_ms") is not None:
            note = f"model load {backend['extra']['load_ms']}ms"
        lines.append(
            f"| {backend['backend']} | {backend['exact']}/{backend['fixtures']} | "
            f"{backend['mean_wer']} | {backend['p95_latency_ms']}ms | {note} |"
        )
    if payload.get("skipped"):
        lines.extend(["", "## Skipped", ""])
        for item in payload["skipped"]:
            lines.append(f"- {item}")
    lines.extend(["", "## Per-Phrase Results", ""])
    for backend in payload["backends"]:
        lines.extend([f"### {backend['backend']}", ""])
        for row in backend["results"]:
            lines.append(
                f"- `{row['id']}` WER `{row['wer']}`, {row['latency_ms']}ms: "
                f"{row['transcript']!r}"
            )
        lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark local and cloud STT on Home Center command phrases")
    parser.add_argument("--fixture-manifest", type=Path)
    parser.add_argument("--voice", default="Alex")
    parser.add_argument("--local-model", default="base.en")
    parser.add_argument("--include-cloud", action="store_true")
    parser.add_argument(
        "--cloud-model",
        action="append",
        default=[],
        help="OpenAI transcription model. Repeatable. Defaults to gpt-4o-mini-transcribe when --include-cloud is set.",
    )
    parser.add_argument("--keep-audio", action="store_true")
    parser.add_argument("--json-out", type=Path, default=Path("voice-service/benchmark_outputs/transcription-summary.json"))
    parser.add_argument("--md-out", type=Path, default=Path("docs/status/voice-stt-benchmark.md"))
    args = parser.parse_args()

    temp_dir = Path(tempfile.mkdtemp(prefix="home-center-voice-bench-"))
    skipped: list[str] = []
    try:
        if args.fixture_manifest:
            fixtures = load_manifest(args.fixture_manifest)
            fixture_source = str(args.fixture_manifest)
        else:
            fixtures = synthesize_fixtures(DEFAULT_PHRASES, temp_dir / "audio", args.voice)
            fixture_source = f"synthetic macOS say voice {args.voice}"

        backends = [transcribe_local(fixtures, args.local_model)]
        if args.include_cloud:
            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                skipped.append("OpenAI cloud transcription: OPENAI_API_KEY was not present in this shell.")
            else:
                models = args.cloud_model or ["gpt-4o-mini-transcribe"]
                for model in models:
                    backends.append(transcribe_cloud(fixtures, model, api_key))

        payload = {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "fixture_source": fixture_source,
            "audio_retained": bool(args.keep_audio),
            "backends": backends,
            "skipped": skipped,
        }
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        write_markdown(args.md_out, payload)
        print(json.dumps({k: payload[k] for k in ("generated_at", "fixture_source", "skipped")}, indent=2))
        for backend in backends:
            print(
                f"{backend['backend']}: exact={backend['exact']}/{backend['fixtures']} "
                f"mean_wer={backend['mean_wer']} p95={backend['p95_latency_ms']}ms"
            )
    finally:
        if args.keep_audio:
            print(f"Audio retained in {temp_dir}")
        else:
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
