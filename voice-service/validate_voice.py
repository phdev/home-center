#!/usr/bin/env python3
"""Summarize Home Center voice validation runs from the Mac service log."""

from __future__ import annotations

import argparse
import ast
import json
import math
import re
import statistics
from collections import Counter
from pathlib import Path
from typing import Any


CHIME_RE = re.compile(r"Chime request completed in ([0-9.]+)ms")
WAKE_RE = re.compile(r"Wake hit via\b")
FAST_RE = re.compile(r"Fast command .* command=(\{.*\}) total=([0-9.]+)ms")
COMMAND_RE = re.compile(r"Command transcript=.* command=(\{.*\}) .* total=([0-9.]+)ms")
CONFIRMED_RE = re.compile(r"Confirmed-command transcript=.* command=(\{.*\}) .* total=([0-9.]+)ms")
DISPATCH_RE = re.compile(r"Dispatching: (\{.*\})")
REJECT_RE = re.compile(r"Rejecting incomplete")
NO_COMMAND_RE = re.compile(r"No valid command after wake")
IGNORED_CANDIDATE_RE = re.compile(r"Ignoring candidate wake after confirmation")
SCORE_PROBE_RE = re.compile(
    r"OpenWakeWord score probe score=([0-9.]+).*recentPeak=([0-9.]+) activeChunks=(\d+) gate=([0-9.]+)"
)
AUDIO_PROBE_RE = re.compile(
    r"OpenWakeWord audio probe score=([0-9.]+).*rms=([0-9.]+) noise=([0-9.]+) "
    r"recentPeak=([0-9.]+) activeChunks=(\d+) gate=([0-9.]+)"
)
AUDIO_HEARTBEAT_RE = re.compile(
    r"OpenWakeWord audio heartbeat window=([0-9.]+)s chunks=(\d+) "
    r"maxRms=([0-9.]+) avgRms=([0-9.]+) noise=([0-9.]+) lastScore=([0-9.]+)"
)
SKIP_WAKE_RE = re.compile(r"Skipping (?:openWakeWord wake|speech candidate) .* reason=([a-z_]+)")
CANDIDATES_RE = re.compile(r"Confirmed-command candidates=(\[.*\])")


def _literal_dict(text: str) -> dict[str, Any]:
    value = ast.literal_eval(text)
    return value if isinstance(value, dict) else {}


def _command_key(command: dict[str, Any]) -> str:
    action = command.get("action", "unknown")
    if action == "navigate":
        return f"navigate:{command.get('page') or command.get('view') or 'unknown'}"
    return str(action)


def percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, math.ceil((pct / 100.0) * len(ordered)) - 1)
    return ordered[index]


def summarize_log(text: str, expected_count: int | None = None) -> dict[str, Any]:
    chime_ms: list[float] = []
    wake_to_action_ms: list[float] = []
    dispatches: list[dict[str, Any]] = []
    fast_path_count = 0
    command_transcript_count = 0
    confirmed_transcript_count = 0
    rejected_count = 0
    no_command_count = 0
    ignored_candidate_count = 0
    audio_probes: list[dict[str, Any]] = []
    audio_heartbeats: list[dict[str, Any]] = []
    score_probes: list[dict[str, Any]] = []
    skipped_wakes: Counter[str] = Counter()
    command_candidates: list[dict[str, Any]] = []
    wake_hits = 0

    for line in text.splitlines():
        if WAKE_RE.search(line):
            wake_hits += 1

        if match := CHIME_RE.search(line):
            chime_ms.append(float(match.group(1)))

        if match := FAST_RE.search(line):
            fast_path_count += 1
            wake_to_action_ms.append(float(match.group(2)))

        if match := COMMAND_RE.search(line):
            command_transcript_count += 1
            wake_to_action_ms.append(float(match.group(2)))

        if match := CONFIRMED_RE.search(line):
            confirmed_transcript_count += 1
            command = _literal_dict(match.group(1))
            if command.get("action") != "none":
                wake_to_action_ms.append(float(match.group(2)))

        if match := DISPATCH_RE.search(line):
            dispatches.append(_literal_dict(match.group(1)))

        if REJECT_RE.search(line):
            rejected_count += 1

        if NO_COMMAND_RE.search(line):
            no_command_count += 1

        if IGNORED_CANDIDATE_RE.search(line):
            ignored_candidate_count += 1

        if match := SKIP_WAKE_RE.search(line):
            skipped_wakes[match.group(1)] += 1

        if match := SCORE_PROBE_RE.search(line):
            score_probes.append({
                "score": float(match.group(1)),
                "recentPeak": float(match.group(2)),
                "activeChunks": int(match.group(3)),
                "gate": float(match.group(4)),
            })

        if match := AUDIO_PROBE_RE.search(line):
            audio_probes.append({
                "score": float(match.group(1)),
                "rms": float(match.group(2)),
                "noise": float(match.group(3)),
                "recentPeak": float(match.group(4)),
                "activeChunks": int(match.group(5)),
                "gate": float(match.group(6)),
            })

        if match := AUDIO_HEARTBEAT_RE.search(line):
            audio_heartbeats.append({
                "window": float(match.group(1)),
                "chunks": int(match.group(2)),
                "maxRms": float(match.group(3)),
                "avgRms": float(match.group(4)),
                "noise": float(match.group(5)),
                "lastScore": float(match.group(6)),
            })

        if match := CANDIDATES_RE.search(line):
            try:
                parsed = ast.literal_eval(match.group(1))
            except (SyntaxError, ValueError):
                parsed = []
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict) and isinstance(item.get("command"), dict):
                        command_candidates.append(item["command"])

    action_counts = Counter(_command_key(command) for command in dispatches)
    heard_action_counts = Counter(_command_key(command) for command in command_candidates)
    expected = expected_count if expected_count is not None else len(dispatches)
    miss_count = max(expected - len(dispatches), 0) if expected else 0
    miss_rate = (miss_count / expected) if expected else 0.0
    candidate_miss_count = max(expected - len(command_candidates), 0) if expected else 0
    candidate_miss_rate = (candidate_miss_count / expected) if expected else 0.0

    return {
        "expected_count": expected,
        "wake_hits": wake_hits,
        "command_transcripts": command_transcript_count,
        "confirmed_command_transcripts": confirmed_transcript_count,
        "fast_path_commands": fast_path_count,
        "dispatches": len(dispatches),
        "rejected_commands": rejected_count,
        "no_command_after_wake": no_command_count,
        "ignored_candidate_wakes": ignored_candidate_count,
        "skipped_candidate_wakes": dict(sorted(skipped_wakes.items())),
        "openwakeword_score_probes": {
            "count": len(score_probes),
            "max_score": max((probe["score"] for probe in score_probes), default=None),
            "max_recent_peak": max((probe["recentPeak"] for probe in score_probes), default=None),
            "samples": score_probes,
        },
        "openwakeword_audio_probes": {
            "count": len(audio_probes),
            "max_score": max((probe["score"] for probe in audio_probes), default=None),
            "max_rms": max((probe["rms"] for probe in audio_probes), default=None),
            "max_recent_peak": max((probe["recentPeak"] for probe in audio_probes), default=None),
            "samples": audio_probes,
        },
        "openwakeword_audio_heartbeats": {
            "count": len(audio_heartbeats),
            "max_rms": max((heartbeat["maxRms"] for heartbeat in audio_heartbeats), default=None),
            "max_avg_rms": max((heartbeat["avgRms"] for heartbeat in audio_heartbeats), default=None),
            "max_score": max((heartbeat["lastScore"] for heartbeat in audio_heartbeats), default=None),
            "samples": audio_heartbeats,
        },
        "commands_by_action": dict(sorted(action_counts.items())),
        "heard_commands_by_action": dict(sorted(heard_action_counts.items())),
        "heard_command_candidates": len(command_candidates),
        "chime_request_ms": {
            "median": statistics.median(chime_ms) if chime_ms else None,
            "p95": percentile(chime_ms, 95),
            "values": chime_ms,
        },
        "wake_to_action_ms": {
            "median": statistics.median(wake_to_action_ms) if wake_to_action_ms else None,
            "p95": percentile(wake_to_action_ms, 95),
            "values": wake_to_action_ms,
        },
        "miss_count": miss_count,
        "miss_rate": miss_rate,
        "candidate_miss_count": candidate_miss_count,
        "candidate_miss_rate": candidate_miss_rate,
    }


def read_log(path: Path, offset: int | None = None) -> str:
    with path.open("rb") as fh:
        if offset:
            fh.seek(offset)
        return fh.read().decode(errors="replace")


def main() -> None:
    parser = argparse.ArgumentParser(description="Summarize a Home Center voice validation log segment")
    parser.add_argument("--log", default="logs/voice-stderr.log", help="voice-stderr.log path")
    parser.add_argument("--offset", type=int, default=None, help="byte offset to start reading from")
    parser.add_argument("--expected-count", type=int, default=20, help="number of spoken validation commands")
    parser.add_argument("--mark-start", action="store_true", help="print current log byte offset and exit")
    args = parser.parse_args()

    log_path = Path(args.log).expanduser()
    if args.mark_start:
        print(json.dumps({"path": str(log_path), "offset": log_path.stat().st_size}, indent=2))
        return

    text = read_log(log_path, args.offset)
    print(json.dumps(summarize_log(text, expected_count=args.expected_count), indent=2))


if __name__ == "__main__":
    main()
