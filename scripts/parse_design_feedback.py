#!/usr/bin/env python3
"""
Home Center — Design Claw feedback parser.

Takes natural-language feedback and returns a normalized JSON object
(`accepted_patterns`, `rejected_patterns`, `principle_updates`,
`preference_updates`, `open_questions`). Optionally applies the update
straight into design_memory/ via --apply.

Usage:
    python scripts/parse_design_feedback.py --feedback "Avoid anything that feels like a productivity app."
    echo "One primary thing" | python scripts/parse_design_feedback.py
    python scripts/parse_design_feedback.py --feedback "..." --apply
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from _design_claw import (
    CLAWS,
    call_responses,
    ensure_dirs,
    extract_json_block,
    openai_client,
    read_text,
)


def read_feedback(cli_value: str | None) -> str:
    if cli_value:
        return cli_value.strip()
    if not sys.stdin.isatty():
        return sys.stdin.read().strip()
    raise SystemExit("error: provide feedback via --feedback '...' or stdin")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feedback", help="feedback string (or pass via stdin)")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="also merge the parsed update into design_memory/ via update_design_memory.py",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="optional path to write the parsed JSON to",
    )
    args = parser.parse_args()

    feedback = read_feedback(args.feedback)
    ensure_dirs()
    prompt = read_text(CLAWS / "design_feedback_parser.md")
    client = openai_client()
    raw = call_responses(client, prompt, payload_blocks=[("Feedback", feedback)])
    parsed = extract_json_block(raw)
    # Normalize shape: every key should be a list.
    for key in ("accepted_patterns", "rejected_patterns", "principle_updates", "preference_updates", "open_questions"):
        parsed.setdefault(key, [])

    out_text = json.dumps(parsed, indent=2)
    print(out_text)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(out_text + "\n", encoding="utf-8")

    if args.apply:
        # Defer to update_design_memory.py so memory-merge logic lives in one place.
        from update_design_memory import apply_update

        summary = apply_update(parsed, source="feedback", feedback=feedback)
        print("", file=sys.stderr)
        print(f"merged into design_memory/: {summary}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
