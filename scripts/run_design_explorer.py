#!/usr/bin/env python3
"""
Home Center — Design Explorer runner.

Offline/manual design workflow tool. Not part of the runtime dashboard.

Flow:
    claws/design_explorer.md          (prompt)
    design_inputs/dashboard.json      (state snapshot)
        ↓  OpenAI Responses API (gpt-5.4-mini)
    design_outputs/dashboard-exploration-<ts>.md

Usage:
    OPENAI_API_KEY=sk-... python scripts/run_design_explorer.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime

from _design_claw import (
    CLAWS,
    DESIGN_INPUTS,
    DESIGN_OUTPUTS,
    call_responses,
    ensure_dirs,
    openai_client,
    read_json,
    read_text,
    write_text,
)


def main() -> int:
    ensure_dirs()
    prompt = read_text(CLAWS / "design_explorer.md")
    snapshot = read_json(DESIGN_INPUTS / "dashboard.json")

    client = openai_client()
    output_text = call_responses(
        client,
        prompt,
        payload_blocks=[("Screen state snapshot", json.dumps(snapshot, indent=2))],
    )

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_path = DESIGN_OUTPUTS / f"dashboard-exploration-{timestamp}.md"
    write_text(output_path, output_text + "\n")

    print(f"saved: {output_path}")
    print()
    print(output_text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
