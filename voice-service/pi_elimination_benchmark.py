#!/usr/bin/env python3
"""Benchmark whether the Pi can replace the Mac mini voice compute tier.

The benchmark is intentionally componentized:

- wake: openWakeWord candidate latency on fixture audio
- transcription: local faster-whisper command transcription latency/quality
- local model: small local model latency through Ollama's OpenAI-compatible API

It can run directly on a target, or orchestrate an isolated SSH run with
synthetic command fixtures generated on macOS and copied to /tmp on the Pi.
No recorded household audio is written into the repo.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_PHRASES = [
    "Hey Homer, turn on",
    "Hey Homer, open calendar",
    "Hey Homer, show the weather",
    "Hey Homer, set a timer for ten seconds",
    "Hey Homer, stop",
]

LOCAL_MODEL_PROMPTS = [
    "Classify this command as one short JSON object: Hey Homer, turn on",
    "Classify this command as one short JSON object: Hey Homer, open calendar",
    "Classify this command as one short JSON object: Hey Homer, set a timer for ten seconds",
]

PASS_BUDGETS = {
    "wake_p95_ms": 100.0,
    "stt_p95_ms": 1000.0,
    "local_model_p95_ms": 2000.0,
    "pipeline_p95_ms": 3000.0,
    "max_mean_wer": 0.05,
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
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (left != right)))
        previous = current
    return previous[-1]


def wer(expected: str, actual: str) -> float:
    words = normalize_words(expected)
    if not words:
        return 0.0 if not normalize_words(actual) else 1.0
    return edit_distance(words, normalize_words(actual)) / len(words)


def percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((pct / 100.0) * (len(ordered) - 1))))
    return round(ordered[index], 1)


def duration_seconds(path: Path) -> float:
    try:
        with wave.open(str(path), "rb") as audio:
            return audio.getnframes() / float(audio.getframerate())
    except Exception:
        return 0.0


def synthesize_wav_fixtures(directory: Path, voice: str) -> list[Fixture]:
    say = shutil.which("say")
    afconvert = shutil.which("afconvert")
    if not say or not afconvert:
        raise SystemExit("Synthetic fixtures require macOS `say` and `afconvert`; pass --fixture-manifest instead.")

    directory.mkdir(parents=True, exist_ok=True)
    fixtures: list[Fixture] = []
    for index, phrase in enumerate(DEFAULT_PHRASES, start=1):
        aiff_path = directory / f"synthetic-{index:02d}.aiff"
        wav_path = directory / f"synthetic-{index:02d}.wav"
        subprocess.run([say, "-v", voice, "-o", str(aiff_path), phrase], check=True)
        subprocess.run([afconvert, "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", str(aiff_path), str(wav_path)], check=True)
        aiff_path.unlink(missing_ok=True)
        fixtures.append(
            Fixture(
                id=f"synthetic-{index:02d}",
                expected=phrase,
                path=wav_path,
                seconds=duration_seconds(wav_path),
                source=f"macos-say:{voice}",
            )
        )
    return fixtures


def write_manifest(path: Path, fixtures: list[Fixture]) -> None:
    path.write_text(
        json.dumps(
            {
                "fixtures": [
                    {
                        "id": fixture.id,
                        "expected": fixture.expected,
                        "path": str(fixture.path.name),
                        "seconds": fixture.seconds,
                        "source": fixture.source,
                    }
                    for fixture in fixtures
                ]
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )


def load_manifest(path: Path) -> list[Fixture]:
    data = json.loads(path.read_text(encoding="utf-8"))
    fixtures = []
    for item in data["fixtures"]:
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


def import_status(name: str) -> dict[str, Any]:
    try:
        module = __import__(name)
        return {"name": name, "available": True, "version": getattr(module, "__version__", None)}
    except Exception as exc:
        return {"name": name, "available": False, "error": f"{type(exc).__name__}: {str(exc)[:180]}"}


def probe_system(target_label: str) -> dict[str, Any]:
    mem_total_mb = None
    meminfo = Path("/proc/meminfo")
    if meminfo.exists():
        match = re.search(r"^MemTotal:\s+(\d+)", meminfo.read_text(encoding="utf-8", errors="ignore"), re.MULTILINE)
        if match:
            mem_total_mb = round(int(match.group(1)) / 1024)
    return {
        "target": target_label,
        "hostname": socket.gethostname(),
        "platform": platform.platform(),
        "machine": platform.machine(),
        "python": sys.version.split()[0],
        "cpu_count": os.cpu_count(),
        "mem_total_mb": mem_total_mb,
        "imports": [
            import_status("openwakeword"),
            import_status("onnxruntime"),
            import_status("faster_whisper"),
            import_status("numpy"),
        ],
        "commands": {
            "ollama": shutil.which("ollama"),
        },
    }


def benchmark_wake(fixtures: list[Fixture], model_path: Path | None) -> dict[str, Any]:
    if not model_path:
        return {"status": "skipped", "reason": "No --openwakeword-model was supplied."}
    if not model_path.exists():
        return {"status": "blocked", "reason": f"openWakeWord model not found: {model_path}"}
    try:
        import numpy as np
        from openwakeword.model import Model
    except Exception as exc:
        return {"status": "blocked", "reason": f"openWakeWord runtime unavailable: {type(exc).__name__}: {exc}"}

    try:
        started = time.perf_counter()
        model = Model(wakeword_models=[str(model_path)])
        load_ms = (time.perf_counter() - started) * 1000
    except Exception as exc:
        return {"status": "blocked", "reason": f"openWakeWord model load failed: {type(exc).__name__}: {exc}"}

    rows = []
    for fixture in fixtures:
        try:
            with wave.open(str(fixture.path), "rb") as audio:
                frames = audio.readframes(audio.getnframes())
            pcm = np.frombuffer(frames, dtype=np.int16)
            scores = []
            started = time.perf_counter()
            for offset in range(0, len(pcm), 1280):
                chunk = pcm[offset : offset + 1280]
                if len(chunk) < 1280:
                    chunk = np.pad(chunk, (0, 1280 - len(chunk)))
                prediction = model.predict(chunk)
                if isinstance(prediction, dict):
                    scores.extend(float(v) for v in prediction.values())
            elapsed_ms = (time.perf_counter() - started) * 1000
            rows.append(
                {
                    "id": fixture.id,
                    "latency_ms": round(elapsed_ms, 1),
                    "audio_seconds": round(fixture.seconds, 3),
                    "max_score": round(max(scores), 4) if scores else None,
                }
            )
        except Exception as exc:
            rows.append({"id": fixture.id, "error": f"{type(exc).__name__}: {exc}", "latency_ms": None})

    latencies = [row["latency_ms"] for row in rows if isinstance(row.get("latency_ms"), (int, float))]
    return {
        "status": "ok" if len(latencies) == len(fixtures) else "partial",
        "model": str(model_path),
        "load_ms": round(load_ms, 1),
        "p50_ms": percentile(latencies, 50),
        "p95_ms": percentile(latencies, 95),
        "rows": rows,
    }


def benchmark_stt(fixtures: list[Fixture], model_name: str) -> dict[str, Any]:
    try:
        from faster_whisper import WhisperModel
    except Exception as exc:
        return {"status": "blocked", "reason": f"faster-whisper unavailable: {type(exc).__name__}: {exc}"}

    try:
        started = time.perf_counter()
        model = WhisperModel(model_name, compute_type="int8", device="cpu")
        load_ms = (time.perf_counter() - started) * 1000
    except Exception as exc:
        return {"status": "blocked", "reason": f"Whisper model load failed: {type(exc).__name__}: {exc}"}

    rows = []
    for fixture in fixtures:
        try:
            started = time.perf_counter()
            segments, _ = model.transcribe(
                str(fixture.path),
                beam_size=1,
                language="en",
                condition_on_previous_text=False,
                no_speech_threshold=0.45,
                vad_filter=False,
                initial_prompt="Hey Homer, turn on. Hey Homer, open calendar. Hey Homer, show the weather.",
            )
            transcript = " ".join(seg.text.strip() for seg in segments).strip()
            elapsed_ms = (time.perf_counter() - started) * 1000
            rows.append(
                {
                    "id": fixture.id,
                    "expected": fixture.expected,
                    "transcript": transcript,
                    "wer": round(wer(fixture.expected, transcript), 4),
                    "latency_ms": round(elapsed_ms, 1),
                }
            )
        except Exception as exc:
            rows.append({"id": fixture.id, "error": f"{type(exc).__name__}: {exc}", "wer": None, "latency_ms": None})

    latencies = [row["latency_ms"] for row in rows if isinstance(row.get("latency_ms"), (int, float))]
    wers = [row["wer"] for row in rows if isinstance(row.get("wer"), (int, float))]
    exact = sum(1 for row in rows if row.get("wer") == 0)
    return {
        "status": "ok" if len(latencies) == len(fixtures) else "partial",
        "model": model_name,
        "load_ms": round(load_ms, 1),
        "exact": exact,
        "fixtures": len(fixtures),
        "mean_wer": round(sum(wers) / len(wers), 4) if wers else None,
        "p50_ms": percentile(latencies, 50),
        "p95_ms": percentile(latencies, 95),
        "rows": rows,
    }


def post_json(url: str, payload: dict[str, Any], timeout: float) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def get_json(url: str, timeout: float) -> dict[str, Any]:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def benchmark_local_model(ollama_host: str, model_name: str, timeout: float) -> dict[str, Any]:
    try:
        tags = get_json(f"{ollama_host.rstrip('/')}/api/tags", timeout=2.0)
    except Exception as exc:
        return {"status": "blocked", "reason": f"Ollama unavailable at {ollama_host}: {type(exc).__name__}: {exc}"}

    available_models = sorted(item.get("name", "") for item in tags.get("models", []))
    rows = []
    for prompt in LOCAL_MODEL_PROMPTS:
        try:
            started = time.perf_counter()
            data = post_json(
                f"{ollama_host.rstrip('/')}/v1/chat/completions",
                {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": "Return terse command classification JSON only."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0,
                    "max_tokens": 48,
                },
                timeout=timeout,
            )
            elapsed_ms = (time.perf_counter() - started) * 1000
            rows.append(
                {
                    "prompt": prompt,
                    "latency_ms": round(elapsed_ms, 1),
                    "response_chars": len(data.get("choices", [{}])[0].get("message", {}).get("content", "")),
                }
            )
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, socket.timeout, Exception) as exc:
            rows.append({"prompt": prompt, "error": f"{type(exc).__name__}: {exc}", "latency_ms": None})

    latencies = [row["latency_ms"] for row in rows if isinstance(row.get("latency_ms"), (int, float))]
    return {
        "status": "ok" if len(latencies) == len(rows) else "blocked",
        "host": ollama_host,
        "model": model_name,
        "available_models": available_models,
        "p50_ms": percentile(latencies, 50),
        "p95_ms": percentile(latencies, 95),
        "rows": rows,
    }


def decide(payload: dict[str, Any]) -> dict[str, Any]:
    wake = payload["components"]["wake"]
    stt = payload["components"]["stt"]
    model = payload["components"]["local_model"]
    blocked = [name for name, value in payload["components"].items() if value.get("status") in {"blocked", "partial"}]
    if blocked:
        return {
            "verdict": "keep_mac_mini",
            "reason": f"Pi benchmark path is not runnable end-to-end yet; blocked components: {', '.join(blocked)}.",
        }

    pipeline_p95 = round((wake.get("p95_ms") or 0) + (stt.get("p95_ms") or 0) + (model.get("p95_ms") or 0), 1)
    mean_wer = stt.get("mean_wer")
    passing = (
        (wake.get("p95_ms") or 999999) <= PASS_BUDGETS["wake_p95_ms"]
        and (stt.get("p95_ms") or 999999) <= PASS_BUDGETS["stt_p95_ms"]
        and (model.get("p95_ms") or 999999) <= PASS_BUDGETS["local_model_p95_ms"]
        and pipeline_p95 <= PASS_BUDGETS["pipeline_p95_ms"]
        and mean_wer is not None
        and mean_wer <= PASS_BUDGETS["max_mean_wer"]
    )
    return {
        "verdict": "candidate_to_eliminate_mac_mini" if passing else "keep_mac_mini",
        "pipeline_p95_ms": pipeline_p95,
        "reason": "Pi meets the benchmark budget." if passing else "Pi does not meet the benchmark budget.",
    }


def write_markdown(path: Path, payload: dict[str, Any]) -> None:
    decision = payload["decision"]
    lines = [
        "# Mac Mini Elimination Benchmark",
        "",
        f"Generated: {payload['generated_at']}",
        f"Target: {payload['system']['target']} (`{payload['system']['hostname']}`)",
        f"Verdict: `{decision['verdict']}`",
        "",
        "## Method",
        "",
        "The benchmark profiles the voice path that would have to move from the Mac mini to the Pi:",
        "",
        "1. openWakeWord wake-candidate inference on synthetic Home Center commands.",
        "2. local `faster-whisper` transcription of the same commands.",
        "3. small local model classification through Ollama's OpenAI-compatible API.",
        "",
        "Pass budget: wake p95 <= 100ms, STT p95 <= 1000ms, local model p95 <= 2000ms, combined p95 <= 3000ms, mean WER <= 0.05.",
        "",
        "## Result",
        "",
        f"- Decision: `{decision['verdict']}`",
        f"- Reason: {decision['reason']}",
    ]
    if "pipeline_p95_ms" in decision:
        lines.append(f"- Combined p95: {decision['pipeline_p95_ms']}ms")

    lines.extend(
        [
            "",
            "## Component Summary",
            "",
            "| Component | Status | P95 | Notes |",
            "| --- | --- | ---: | --- |",
        ]
    )
    for name, component in payload["components"].items():
        p95 = component.get("p95_ms")
        note = component.get("reason") or component.get("model") or component.get("host") or ""
        lines.append(f"| {name} | `{component.get('status')}` | {p95 if p95 is not None else 'n/a'} | {note} |")

    lines.extend(
        [
            "",
            "## Target Probe",
            "",
            f"- Platform: `{payload['system']['platform']}`",
            f"- CPU count: `{payload['system']['cpu_count']}`",
            f"- Memory: `{payload['system']['mem_total_mb']} MB`",
            "",
            "Runtime imports:",
        ]
    )
    for item in payload["system"]["imports"]:
        suffix = item.get("version") or item.get("error") or ""
        lines.append(f"- `{item['name']}`: `{item['available']}` {suffix}")

    lines.extend(["", "## Fixture Results", ""])
    for name, component in payload["components"].items():
        if component.get("rows"):
            lines.extend([f"### {name}", ""])
            for row in component["rows"]:
                if row.get("error"):
                    lines.append(f"- `{row.get('id') or row.get('prompt')}` error: {row['error']}")
                else:
                    details = []
                    if row.get("latency_ms") is not None:
                        details.append(f"{row['latency_ms']}ms")
                    if row.get("wer") is not None:
                        details.append(f"WER {row['wer']}")
                    if row.get("max_score") is not None:
                        details.append(f"max score {row['max_score']}")
                    lines.append(f"- `{row.get('id') or row.get('prompt')}`: {', '.join(details)}")
            lines.append("")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def run_local(args: argparse.Namespace) -> dict[str, Any]:
    fixtures = load_manifest(args.fixture_manifest)
    payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "mode": "mac-mini-elimination",
        "budgets": PASS_BUDGETS,
        "system": probe_system(args.target_label),
        "fixture_source": str(args.fixture_manifest),
        "components": {},
    }
    payload["components"]["wake"] = benchmark_wake(fixtures, args.openwakeword_model)
    payload["components"]["stt"] = benchmark_stt(fixtures, args.whisper_model)
    payload["components"]["local_model"] = benchmark_local_model(args.ollama_host, args.ollama_model, args.ollama_timeout)
    payload["decision"] = decide(payload)

    args.json_out.parent.mkdir(parents=True, exist_ok=True)
    args.json_out.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    write_markdown(args.md_out, payload)
    return payload


def sh(command: list[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, text=True, capture_output=True, **kwargs)


def run_remote(args: argparse.Namespace) -> dict[str, Any]:
    temp_dir = Path(tempfile.mkdtemp(prefix="home-center-pi-bench-"))
    try:
        fixtures_dir = temp_dir / "fixtures"
        fixtures = synthesize_wav_fixtures(fixtures_dir, args.voice)
        manifest = fixtures_dir / "manifest.json"
        write_manifest(manifest, fixtures)

        remote_tmp = sh(["ssh", args.remote_host, "mktemp -d /tmp/home-center-pi-bench.XXXXXX"]).stdout.strip()
        script_name = Path(__file__).name
        sh(["scp", str(Path(__file__).resolve()), f"{args.remote_host}:{remote_tmp}/{script_name}"])
        sh(["scp", "-r", str(fixtures_dir) + "/", f"{args.remote_host}:{remote_tmp}/fixtures"])

        remote_json = f"{remote_tmp}/result.json"
        remote_md = f"{remote_tmp}/result.md"
        remote_cmd = [
            "cd",
            remote_tmp,
            "&&",
            "python3",
            script_name,
            "--fixture-manifest",
            f"{remote_tmp}/fixtures/manifest.json",
            "--json-out",
            remote_json,
            "--md-out",
            remote_md,
            "--target-label",
            args.remote_host,
            "--whisper-model",
            args.whisper_model,
            "--ollama-host",
            args.ollama_host,
            "--ollama-model",
            args.ollama_model,
            "--ollama-timeout",
            str(args.ollama_timeout),
        ]
        if args.openwakeword_model:
            remote_cmd.extend(["--openwakeword-model", str(args.openwakeword_model)])
        proc = sh(["ssh", args.remote_host, " ".join(remote_cmd)])
        if proc.stdout.strip():
            print(proc.stdout.strip())
        sh(["scp", f"{args.remote_host}:{remote_json}", str(args.json_out)])
        sh(["scp", f"{args.remote_host}:{remote_md}", str(args.md_out)])
        payload = json.loads(args.json_out.read_text(encoding="utf-8"))
        sh(["ssh", args.remote_host, f"rm -rf {remote_tmp}"])
        return payload
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Benchmark Pi viability for replacing Mac mini voice compute")
    parser.add_argument("--remote-host", help="SSH host to run the target benchmark in /tmp")
    parser.add_argument("--fixture-manifest", type=Path, help="Fixture manifest for direct target runs")
    parser.add_argument("--target-label", default=socket.gethostname())
    parser.add_argument("--voice", default="Alex")
    parser.add_argument("--openwakeword-model", type=Path)
    parser.add_argument("--whisper-model", default="base.en")
    parser.add_argument("--ollama-host", default="http://localhost:11434")
    parser.add_argument("--ollama-model", default="gemma4:e4b")
    parser.add_argument("--ollama-timeout", type=float, default=60.0)
    parser.add_argument("--json-out", type=Path, default=Path("voice-service/benchmark_outputs/pi-elimination-summary.json"))
    parser.add_argument("--md-out", type=Path, default=Path("docs/status/mac-mini-elimination-benchmark-2026-06-04.md"))
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if args.remote_host:
        payload = run_remote(args)
    else:
        if not args.fixture_manifest:
            parser.error("--fixture-manifest is required unless --remote-host is used")
        payload = run_local(args)
    print(json.dumps({"verdict": payload["decision"]["verdict"], "reason": payload["decision"]["reason"]}, indent=2))


if __name__ == "__main__":
    main()
