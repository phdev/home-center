#!/usr/bin/env python3
"""
Home Center — Design Claw polish-pass renderer.

Takes a daily artifact that already has a structural PNG and produces
a photographic-quality `<stem>-polish.png` via OpenAI Images 2.0
(`gpt-image-1` by default). The structural PNG is fed in as a reference
so the polished image preserves the exact regions, hierarchy, and
proportions we committed to in the structural pass.

Intended to run as an optional second step after `render_concept.py`.
Model configurable via `DESIGN_CLAW_IMAGE_MODEL`.

Usage:
    python scripts/render_polish.py design_outputs/daily/2026-04-21-dashboard-morning.json
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from pathlib import Path
from typing import Any

from _design_claw import (
    CLAWS,
    openai_client,
    read_json,
    read_text,
    with_retries,
)

IMAGE_MODEL = os.environ.get("DESIGN_CLAW_IMAGE_MODEL", "gpt-image-1")
# gpt-image-1 accepts 1024x1024 / 1024x1536 / 1536x1024. 1536x1024 is the
# closest widescreen option to the 1920x1080 TV target.
IMAGE_SIZE = os.environ.get("DESIGN_CLAW_IMAGE_SIZE", "1536x1024")


def build_prompt(payload: dict[str, Any]) -> str:
    """Prompt = polish renderer text + concept/topic/snapshot context."""
    base = read_text(CLAWS / "design_polish_renderer.md")
    concept = payload.get("concept", {}) or {}
    topic = payload.get("topic", {}) or {}
    snapshot_path = payload.get("snapshot_path")

    parts = [base.strip(), "", "## Concept", json.dumps(concept, indent=2), "", "## Topic", json.dumps(topic, indent=2)]

    if snapshot_path:
        try:
            snapshot = read_json(Path(snapshot_path))
            parts += ["", "## Screen snapshot", json.dumps(snapshot, indent=2)]
        except (FileNotFoundError, json.JSONDecodeError):
            pass

    return "\n".join(parts)


def generate_polish(payload: dict[str, Any], structural_png: Path, client) -> bytes:
    """Call images.edit with the structural PNG as reference."""
    prompt = build_prompt(payload)
    with structural_png.open("rb") as img:
        response = with_retries(
            lambda: client.images.edit(
                model=IMAGE_MODEL,
                image=img,
                prompt=prompt,
                size=IMAGE_SIZE,
            )
        )

    # gpt-image-1 returns b64_json in response.data[0].b64_json.
    data = response.data[0]
    b64 = getattr(data, "b64_json", None)
    if b64:
        return base64.b64decode(b64)
    # Some models/configurations return a URL instead — fetch it.
    url = getattr(data, "url", None)
    if url:
        import urllib.request

        with urllib.request.urlopen(url, timeout=30) as resp:
            return resp.read()
    raise RuntimeError("images.edit response had neither b64_json nor url")


def render_polish(json_path: Path, client) -> Path:
    """Write `<stem>-polish.png` next to `<stem>.png`. Returns the new path."""
    payload = read_json(json_path)
    structural = json_path.with_suffix(".png")
    if not structural.exists():
        raise FileNotFoundError(
            f"structural PNG missing (run render_concept first): {structural}"
        )
    png_bytes = generate_polish(payload, structural, client)
    polish_path = json_path.parent / f"{json_path.stem}-polish.png"
    polish_path.write_bytes(png_bytes)
    return polish_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("json_path", type=Path, help="path to a daily JSON artifact")
    args = parser.parse_args()

    if not args.json_path.exists():
        print(f"error: {args.json_path} does not exist", file=sys.stderr)
        return 2

    client = openai_client()
    polish_path = render_polish(args.json_path, client)
    print(f"saved: {polish_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
