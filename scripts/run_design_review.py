#!/usr/bin/env python3
"""
Home Center — Design Claw weekly review.

Concatenates the last N daily artifacts and the current memory, asks
the Responses API to synthesize a strategic review, and saves it to
`design_outputs/weekly/<date>-review.md`.

Usage:
    python scripts/run_design_review.py
    python scripts/run_design_review.py --days 7
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from _design_claw import (
    CLAWS,
    DESIGN_OUTPUTS_DAILY,
    DESIGN_OUTPUTS_WEEKLY,
    append_iteration_log,
    call_responses,
    ensure_dirs,
    load_memory,
    memory_summary_for_prompt,
    openai_client,
    read_text,
    today_str,
    write_text,
)


def recent_dailies(days: int) -> list[Path]:
    cutoff = datetime.now() - timedelta(days=days)
    out: list[Path] = []
    for md in sorted(DESIGN_OUTPUTS_DAILY.glob("*.md")):
        # Filename: YYYY-MM-DD-<screen>.md
        stem_date = md.stem[:10]
        try:
            d = datetime.strptime(stem_date, "%Y-%m-%d")
        except ValueError:
            continue
        if d >= cutoff:
            out.append(md)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=7, help="look-back window in days (default 7)")
    args = parser.parse_args()

    ensure_dirs()
    dailies = recent_dailies(args.days)
    if not dailies:
        print("note: no daily artifacts in window; generating review from memory only", file=sys.stderr)

    prompt = read_text(CLAWS / "design_review.md")
    memory = load_memory()

    concatenated = "\n\n---\n\n".join(p.read_text(encoding="utf-8") for p in dailies) or "(no recent daily concepts)"

    client = openai_client()
    raw = call_responses(
        client,
        prompt,
        payload_blocks=[
            ("Recent daily concepts", concatenated),
            ("Current design memory", memory_summary_for_prompt(memory)),
        ],
    )

    date = today_str()
    out_path = DESIGN_OUTPUTS_WEEKLY / f"{date}-review.md"
    write_text(out_path, raw.strip() + "\n")
    append_iteration_log(
        "weekly_review",
        f"Weekly review generated from {len(dailies)} daily concept(s) over {args.days} days.",
        output=str(out_path),
        daily_count=len(dailies),
    )

    print(f"saved: {out_path}")
    print()
    print(raw.strip())
    return 0


if __name__ == "__main__":
    sys.exit(main())
