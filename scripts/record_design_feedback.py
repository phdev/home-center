#!/usr/bin/env python3
"""Record terse like/dislike feedback for the current Design Claw concept.

This is intentionally deterministic so the voice service can call it without
an OpenAI key. Rich Telegram feedback still goes through design_listener.py.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from _design_claw import load_last_daily, read_json
from update_design_memory import apply_update


def current_concept_name() -> str:
    state = load_last_daily()
    if not state:
        return "current daily design"
    try:
        payload = read_json(Path(state["path"]).with_suffix(".json"))
        concept = payload.get("concept") or {}
        return concept.get("concept_name") or "current daily design"
    except Exception:
        return "current daily design"


def feedback_text(sentiment: str, notes: str) -> str:
    name = current_concept_name()
    notes = " ".join(notes.strip().split())
    if notes:
        return f"{name}: {notes}"
    if sentiment == "like":
        return f"{name} is worth keeping as a liked direction."
    return f"{name} should be avoided as a disliked direction."


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sentiment", choices=("like", "dislike"), required=True)
    parser.add_argument("--notes", default="")
    args = parser.parse_args()

    text = feedback_text(args.sentiment, args.notes)
    parsed = {
        "accepted_patterns": [text] if args.sentiment == "like" else [],
        "rejected_patterns": [text] if args.sentiment == "dislike" else [],
        "principle_updates": [],
        "preference_updates": [],
        "open_questions": [],
    }
    added = apply_update(parsed, source="voice", feedback=text)
    print({"feedback": text, "added": added})
    return 0


if __name__ == "__main__":
    sys.exit(main())
