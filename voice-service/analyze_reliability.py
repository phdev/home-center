#!/usr/bin/env python3
"""Analyze Home Center voice reliability JSONL logs."""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

from intent import WAKE_PHRASE_RE, is_dispatchable_command, parse_command


DEFAULT_LOG = Path(__file__).resolve().parent / "logs/voice-reliability.jsonl"

COMMANDS = [
    "Hey Homer, open calendar",
    "Hey Homer, go back",
    "Hey Homer, show the weather",
    "Hey Homer, go home",
    "Hey Homer, open calendar",
    "Hey Homer, back",
    "Hey Homer, set a timer for ten seconds",
    "Hey Homer, stop",
    "Hey Homer, open calendar",
    "Hey Homer, go back",
    "Hey Homer, turn on",
    "Hey Homer, turn off",
    "Hey Homer, open calendar",
    "Hey Homer, close calendar",
    "Hey Homer, show the weather",
    "Hey Homer, go home",
    "Hey Homer, open photos",
    "Hey Homer, go back",
    "Hey Homer, open calendar",
    "Hey Homer, back please",
]


def format_ts(ts: float | None) -> str:
    if not ts:
        return "unknown"
    return datetime.fromtimestamp(ts).strftime("%H:%M:%S")


def percentile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    rank = (len(ordered) - 1) * q / 100
    lower = math.floor(rank)
    upper = math.ceil(rank)
    if lower == upper:
        return ordered[int(rank)]
    return ordered[lower] * (upper - rank) + ordered[upper] * (rank - lower)


def latency_line(label: str, values: list[float]) -> str:
    if not values:
        return f"- {label}: none"
    return (
        f"- {label}: n={len(values)} "
        f"p50={percentile(values, 50):.0f}ms "
        f"p90={percentile(values, 90):.0f}ms "
        f"p95={percentile(values, 95):.0f}ms "
        f"max={max(values):.0f}ms"
    )


def read_events(path: Path) -> list[dict]:
    events = []
    if not path.exists():
        return events
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError as exc:
            print(f"Skipping invalid JSON line {line_number}: {exc}", file=sys.stderr)
    return events


def append_marker(path: Path, label: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "ts": time.time(),
        "event": "test_marker",
        "label": label,
    }
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n")
    print(f"Marked {label!r} at {format_ts(payload['ts'])} in {path}")


def append_miss_marker(path: Path, phrase: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = command_body_from_text(phrase)
    command = parse_command(body, allow_bare_ask=False)
    payload = {
        "ts": time.time(),
        "event": "miss_marker",
        "phrase": phrase,
        "body": body,
        "expectedCommand": command,
        "dispatchable": is_dispatchable_command(command),
    }
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n")

    target = command_target(command) if payload["dispatchable"] else "not-dispatchable"
    print(f"Marked miss {phrase!r} ({target}) at {format_ts(payload['ts'])} in {path}")


def latest_marker_ts(events: list[dict], label: str) -> float | None:
    for event in reversed(events):
        if event.get("event") == "test_marker" and event.get("label") == label:
            return float(event.get("ts", 0))
    return None


def filtered_events(events: list[dict], since: float | None, until: float | None) -> list[dict]:
    result = []
    for event in events:
        ts = float(event.get("ts", 0))
        if since is not None and ts < since:
            continue
        if until is not None and ts > until:
            continue
        result.append(event)
    return result


def print_commands() -> None:
    print("Controlled voice reliability pass:")
    for index, command in enumerate(COMMANDS, start=1):
        print(f"{index:2d}. {command}")
    print()
    print("Speak each phrase normally. Pause until the dashboard reacts or about 3 seconds pass.")


def command_body_from_text(text: str) -> str:
    matches = list(WAKE_PHRASE_RE.finditer(text))
    if matches:
        return text[matches[-1].end():].strip(" ,.:;!?-")
    return text.strip(" ,.:;!?-")


def expected_script_commands() -> list[dict]:
    commands = []
    for phrase in COMMANDS:
        command = parse_command(command_body_from_text(phrase), allow_bare_ask=False)
        if is_dispatchable_command(command):
            commands.append(command)
    return commands


def command_target(command: dict) -> str:
    if not isinstance(command, dict):
        return "none"
    action = command.get("action", "none")
    target = command.get("page") or command.get("view") or command.get("duration") or command.get("query")
    return f"{action}:{target}" if target is not None else str(action)


def score_expected_dispatches(dispatches: list[dict]) -> tuple[int, list[str]]:
    expected = expected_script_commands()
    actual = [event.get("command", {}) for event in dispatches]
    matched = 0
    misses = []
    search_from = 0
    for command in expected:
        for index in range(search_from, len(actual)):
            if actual[index] == command:
                matched += 1
                search_from = index + 1
                break
        else:
            misses.append(command_target(command))
    return matched, misses


def hybrid_recovery_candidates(events: list[dict]) -> list[dict]:
    recoveries = []
    for event in events:
        if event.get("event") not in {"command_transcript", "confirmed_transcript"}:
            continue
        if event.get("dispatchable"):
            continue
        wake_body = command_body_from_text(str(event.get("wakeText", "")))
        transcript_body = command_body_from_text(str(event.get("transcript", "")))
        if not wake_body or not transcript_body:
            continue
        combined = f"{wake_body} {transcript_body}".strip()
        command = parse_command(combined, allow_bare_ask=False)
        if is_dispatchable_command(command):
            recoveries.append({**event, "hybridBody": combined, "hybridCommand": command})
    return recoveries


def estimated_wake_to_dispatch_ms(events: list[dict]) -> list[float]:
    wakes = sorted(
        [event for event in events if event.get("event") == "wake_hit" and isinstance(event.get("ts"), (int, float))],
        key=lambda event: event["ts"],
    )
    dispatches = sorted(
        [event for event in events if event.get("event") == "dispatch" and isinstance(event.get("ts"), (int, float))],
        key=lambda event: event["ts"],
    )
    latencies = []
    wake_index = 0
    for dispatch in dispatches:
        while wake_index + 1 < len(wakes) and wakes[wake_index + 1]["ts"] <= dispatch["ts"]:
            wake_index += 1
        if not wakes or wakes[wake_index]["ts"] > dispatch["ts"]:
            continue
        latency_ms = (dispatch["ts"] - wakes[wake_index]["ts"]) * 1000
        if 0 <= latency_ms <= 10000:
            latencies.append(latency_ms)
    return latencies


def summarize(events: list[dict]) -> int:
    if not events:
        print("No events in the selected window.")
        return 1

    start = min(float(event.get("ts", 0)) for event in events)
    end = max(float(event.get("ts", 0)) for event in events)
    counts = Counter(event.get("event", "unknown") for event in events)

    print(f"Window: {format_ts(start)} -> {format_ts(end)} ({end - start:.1f}s)")
    print("Counts:")
    for name, count in sorted(counts.items()):
        print(f"- {name}: {count}")

    dispatches = [event for event in events if event.get("event") == "dispatch"]
    ignored = [event for event in events if event.get("event") == "ignored"]
    miss_markers = [event for event in events if event.get("event") == "miss_marker"]
    transcripts = [
        event
        for event in events
        if event.get("event") in {"command_transcript", "confirmed_transcript"}
    ]
    detector_text = [event for event in events if event.get("event") == "detector_text"]
    activity = [event for event in events if event.get("event") == "speech_activity"]
    recoveries = hybrid_recovery_candidates(events)

    if dispatches:
        print("\nDispatches:")
        for event in dispatches:
            command = event.get("command", {})
            target = command.get("page") or command.get("view") or command.get("action")
            print(f"- {format_ts(event.get('ts'))} {command.get('action')} {target} body={event.get('body')!r}")

        matched, misses = score_expected_dispatches(dispatches)
        expected_count = len(expected_script_commands())
        print(f"\nControlled-script score: {matched}/{expected_count} expected dispatches matched in order")
        if misses:
            print("Missing expected commands:")
            for miss in misses[:8]:
                print(f"- {miss}")

    if transcripts or dispatches:
        print("\nLatency:")
        print(latency_line("wake->STT total", [event.get("totalMs") for event in transcripts if event.get("totalMs") is not None]))
        print(latency_line("post-wake capture", [event.get("postMs") for event in transcripts if event.get("postMs") is not None]))
        print(latency_line("captured audio length", [event.get("captureMs") for event in transcripts if event.get("captureMs") is not None]))
        print(latency_line("estimated wake->dispatch", estimated_wake_to_dispatch_ms(events)))

    if miss_markers:
        print("\nExplicit miss markers:")
        for event in miss_markers:
            command = event.get("expectedCommand", {})
            target = command_target(command) if event.get("dispatchable") else "not-dispatchable"
            print(
                f"- {format_ts(event.get('ts'))} phrase={event.get('phrase')!r} "
                f"expected={target} body={event.get('body')!r}"
            )

    if transcripts:
        print("\nTranscripts:")
        for event in transcripts:
            command = event.get("command", {})
            print(
                f"- {format_ts(event.get('ts'))} dispatchable={event.get('dispatchable')} "
                f"body={event.get('body')!r} command={command} transcript={event.get('transcript')!r}"
            )

    if ignored:
        print("\nIgnored commands:")
        for event in ignored:
            print(
                f"- {format_ts(event.get('ts'))} reason={event.get('reason')} "
                f"body={event.get('body')!r} transcript={event.get('transcript')!r}"
            )

    if recoveries:
        print("\nHybrid fallback recovery candidates:")
        for event in recoveries[-8:]:
            print(
                f"- {format_ts(event.get('ts'))} body={event.get('hybridBody')!r} "
                f"command={event.get('hybridCommand')} wake={event.get('wakeText')!r} "
                f"transcript={event.get('transcript')!r}"
            )

    if detector_text:
        print("\nDetector text without wake hit:")
        for event in detector_text[-12:]:
            print(
                f"- {format_ts(event.get('ts'))} source={event.get('source')} "
                f"wakeLike={event.get('wakeLike')} commandLike={event.get('commandLike')} "
                f"rms={event.get('rms')} text={event.get('text')!r}"
            )

    loud_windows = [event for event in activity if event.get("maxRms", 0) >= 1000]
    if loud_windows:
        print("\nLoud speech windows:")
        for event in loud_windows[-12:]:
            print(
                f"- {format_ts(event.get('ts'))} maxRms={event.get('maxRms')} "
                f"avgRms={event.get('avgRms')} noise={event.get('noise')} gate={event.get('gate')}"
            )

    print("\nReadout:")
    if len(dispatches) == 0 and loud_windows:
        print("- Loud speech was heard, but no command dispatched. Wake detection is the first suspect.")
    elif ignored:
        print("- Wake/transcription happened, but at least one command was ignored. Inspect parser/capture timing.")
    elif dispatches:
        print("- Commands dispatched. Compare dispatch count with the number of phrases spoken.")
    else:
        print("- No loud speech or dispatch in this window. Check mic stream and test timing.")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log", type=Path, default=DEFAULT_LOG)
    parser.add_argument("--commands", action="store_true", help="Print the controlled 20-command script.")
    parser.add_argument("--mark", help="Append a marker label to the JSONL log.")
    parser.add_argument("--mark-miss", help="Append an explicit missed intended phrase to the JSONL log.")
    parser.add_argument("--since-marker", help="Analyze events after the latest marker with this label.")
    parser.add_argument("--until-marker", help="Analyze events before the latest marker with this label.")
    parser.add_argument("--since", type=float, help="Analyze events after this epoch timestamp.")
    parser.add_argument("--last-seconds", type=float, help="Analyze events from the last N seconds.")
    args = parser.parse_args()

    if args.commands:
        print_commands()
        return 0

    if args.mark:
        append_marker(args.log, args.mark)
        return 0
    if args.mark_miss:
        append_miss_marker(args.log, args.mark_miss)
        return 0

    events = read_events(args.log)
    since = args.since
    until = None
    if args.last_seconds is not None:
        since = time.time() - args.last_seconds
    if args.since_marker:
        since = latest_marker_ts(events, args.since_marker)
        if since is None:
            print(f"No marker found with label {args.since_marker!r}.", file=sys.stderr)
            return 1
    if args.until_marker:
        until = latest_marker_ts(events, args.until_marker)
        if until is None:
            print(f"No marker found with label {args.until_marker!r}.", file=sys.stderr)
            return 1

    return summarize(filtered_events(events, since, until))


if __name__ == "__main__":
    raise SystemExit(main())
