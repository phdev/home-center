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
import os
import sys
from datetime import datetime
from pathlib import Path

from openai import OpenAI

MODEL = "gpt-5.4-mini"
REPO_ROOT = Path(__file__).resolve().parent.parent
PROMPT_PATH = REPO_ROOT / "claws" / "design_explorer.md"
INPUT_PATH = REPO_ROOT / "design_inputs" / "dashboard.json"
OUTPUT_DIR = REPO_ROOT / "design_outputs"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def extract_output_text(response) -> str:
    """Robustly pull the text out of a Responses API result.

    Prefer the SDK's convenience accessor; fall back to walking `output`.
    """
    text = getattr(response, "output_text", None)
    if text:
        return text.strip()

    chunks: list[str] = []
    for item in getattr(response, "output", []) or []:
        for part in getattr(item, "content", []) or []:
            value = getattr(part, "text", None)
            if isinstance(value, str):
                chunks.append(value)
            elif value is not None:
                value_text = getattr(value, "value", None)
                if isinstance(value_text, str):
                    chunks.append(value_text)
    joined = "\n".join(chunks).strip()
    if joined:
        return joined
    raise RuntimeError("No text content found in Responses API result")


def main() -> int:
    if not os.environ.get("OPENAI_API_KEY"):
        print("error: OPENAI_API_KEY is not set", file=sys.stderr)
        return 2

    prompt = read_text(PROMPT_PATH)
    snapshot = json.loads(read_text(INPUT_PATH))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # The Responses API accepts a single input string; we frame the
    # snapshot as an explicit block after the system-style prompt.
    input_text = (
        f"{prompt}\n\n"
        "## Screen state snapshot\n"
        "```json\n"
        f"{json.dumps(snapshot, indent=2)}\n"
        "```\n"
    )

    client = OpenAI()
    response = client.responses.create(model=MODEL, input=input_text)
    output_text = extract_output_text(response)

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_path = OUTPUT_DIR / f"dashboard-exploration-{timestamp}.md"
    output_path.write_text(output_text + "\n", encoding="utf-8")

    print(f"saved: {output_path}")
    print()
    print(output_text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
