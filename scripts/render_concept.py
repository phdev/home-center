#!/usr/bin/env python3
"""
Home Center — Design Claw concept renderer.

Takes a daily JSON artifact and produces two more artifacts alongside it:
  - <date>-<screen>.html  — a structural mockup generated via the
                            design_html_renderer.md prompt
  - <date>-<screen>.png   — a 1920×1080 headless-Chromium screenshot

The HTML + PNG are intentionally grayscale box-and-label diagrams —
hierarchy and grouping only, no styling polish.

Usage (standalone):
    python scripts/render_concept.py design_outputs/daily/2026-04-21-dashboard-morning.json

As a library:
    from render_concept import render_concept
    html_path, png_path = render_concept(json_path, openai_client())
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Tuple

from _design_claw import (
    CLAWS,
    call_responses,
    openai_client,
    read_json,
    read_text,
    write_text,
)


def _strip_html_fences(text: str) -> str:
    """Model may wrap in ```html …``` — peel it off, keep raw doc."""
    match = re.search(r"```(?:html)?\s*(.+?)```", text, re.DOTALL)
    candidate = match.group(1).strip() if match else text.strip()
    # Drop any trailing prose after </html>
    end = candidate.lower().rfind("</html>")
    if end != -1:
        candidate = candidate[: end + len("</html>")]
    return candidate


def generate_html(payload: dict[str, Any], client) -> str:
    prompt = read_text(CLAWS / "design_html_renderer.md")
    raw = call_responses(
        client,
        prompt,
        payload_blocks=[
            ("Concept", json.dumps(payload.get("concept", {}), indent=2)),
            ("Topic", json.dumps(payload.get("topic", {}), indent=2)),
        ],
    )
    return _strip_html_fences(raw)


def screenshot(html_path: Path, png_path: Path) -> None:
    """Render html_path to png_path at 1920×1080 using headless Chromium."""
    # Imported lazily so the daily flow doesn't pay the import cost when
    # --render isn't requested.
    from playwright.sync_api import sync_playwright

    url = html_path.absolute().as_uri()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page(
                viewport={"width": 1920, "height": 1080},
                device_scale_factor=1,
            )
            page.goto(url, wait_until="load")
            page.screenshot(path=str(png_path), full_page=False, type="png")
        finally:
            browser.close()


def render_concept(json_path: Path, client) -> Tuple[Path, Path]:
    """Render <stem>.html + <stem>.png next to json_path. Returns both paths."""
    payload = read_json(json_path)
    html = generate_html(payload, client)
    if not html.lower().startswith("<!doctype html"):
        html = "<!doctype html>\n" + html
    html_path = json_path.with_suffix(".html")
    png_path = json_path.with_suffix(".png")
    write_text(html_path, html)
    screenshot(html_path, png_path)
    return html_path, png_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("json_path", type=Path, help="path to a daily JSON artifact")
    args = parser.parse_args()

    if not args.json_path.exists():
        print(f"error: {args.json_path} does not exist", file=sys.stderr)
        return 2

    client = openai_client()
    html_path, png_path = render_concept(args.json_path, client)
    print(f"saved: {html_path}")
    print(f"saved: {png_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
