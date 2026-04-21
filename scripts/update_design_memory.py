#!/usr/bin/env python3
"""
Home Center — Design Claw memory merger.

Reads a parsed feedback JSON (same shape as `parse_design_feedback.py`
emits) and merges it into `design_memory/`. Dedupes on case-insensitive
trimmed text. Appends an entry to `iteration_log.jsonl`.

Usage:
    # From a file:
    python scripts/update_design_memory.py --input /tmp/parsed.json

    # Piped:
    cat /tmp/parsed.json | python scripts/update_design_memory.py
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from _design_claw import (
    DESIGN_MEMORY,
    MEMORY_FILES,
    append_iteration_log,
    ensure_dirs,
    now_iso,
    read_json,
    today_str,
    write_json,
)


# Map the feedback-parser output keys → memory files.
KEY_TO_FILE: dict[str, str] = {
    "accepted_patterns": "accepted_patterns.json",
    "rejected_patterns": "rejected_patterns.json",
    "principle_updates": "principles.json",
    "preference_updates": "preferences.json",
    "open_questions": "open_questions.json",
}


def _norm(text: str) -> str:
    return " ".join(text.strip().lower().split())


def _slug(text: str, limit: int = 40) -> str:
    keep = "".join(c if c.isalnum() else "-" for c in text.strip().lower())
    return "-".join(filter(None, keep.split("-")))[:limit]


def _existing_norms(items: list[dict[str, Any]]) -> set[str]:
    out: set[str] = set()
    for e in items:
        text = e.get("text") if isinstance(e, dict) else str(e)
        if text:
            out.add(_norm(text))
    return out


def apply_update(
    parsed: dict[str, list[str]],
    source: str = "feedback",
    feedback: str | None = None,
) -> dict[str, int]:
    """Merge a parsed update into design_memory/. Returns per-key added counts."""
    ensure_dirs()
    added: dict[str, int] = {}
    today = today_str()

    for feedback_key, fname in KEY_TO_FILE.items():
        entries = [e for e in (parsed.get(feedback_key) or []) if isinstance(e, str) and e.strip()]
        if not entries:
            added[feedback_key] = 0
            continue

        path = DESIGN_MEMORY / fname
        doc = read_json(path) if path.exists() else {"items": []}
        items = doc.setdefault("items", [])
        seen = _existing_norms(items)

        new_count = 0
        for text in entries:
            norm = _norm(text)
            if norm in seen:
                continue
            seen.add(norm)
            prefix = {
                "accepted_patterns": "ap-",
                "rejected_patterns": "rp-",
                "principle_updates": "p-",
                "preference_updates": "pref-",
                "open_questions": "oq-",
            }[feedback_key]
            date_key = "raised" if feedback_key == "open_questions" else "added"
            items.append(
                {
                    "id": f"{prefix}{_slug(text) or today}",
                    "text": text,
                    date_key: today,
                    "source": source,
                }
            )
            new_count += 1

        write_json(path, doc)
        added[feedback_key] = new_count

    total = sum(added.values())
    append_iteration_log(
        "feedback_merge" if source == "feedback" else f"{source}_merge",
        f"Merged {total} new items into design memory.",
        feedback=feedback,
        added=added,
    )
    return added


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="path to parsed-feedback JSON")
    parser.add_argument("--source", default="feedback", help="source label for log (default: feedback)")
    args = parser.parse_args()

    if args.input:
        parsed = json.loads(args.input.read_text(encoding="utf-8"))
    elif not sys.stdin.isatty():
        parsed = json.loads(sys.stdin.read())
    else:
        raise SystemExit("error: provide --input <path> or pipe JSON on stdin")

    added = apply_update(parsed, source=args.source)
    print(json.dumps({"added": added}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
