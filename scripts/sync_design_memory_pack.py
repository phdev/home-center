#!/usr/bin/env python3
"""Generate the shared David design memory pack.

This is the bridge between David's structured design memory and other
OpenClaw/Home Center chats. It intentionally writes markdown, not JSON, so
agents can read it quickly without knowing David's internal schema.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from _design_claw import DESIGN_MEMORY, DESIGN_OUTPUTS_DAILY, REPO_ROOT

OPENCLAW_PACK_PATH = Path("/Users/peter/.openclaw/workspace/DAVID_DESIGN_MEMORY.md")
HOME_CENTER_PACK_PATH = REPO_ROOT / "docs" / "DESIGN_MEMORY.md"

MEMORY_SECTIONS = [
    ("principles", "Design Principles", "principles.json", "added"),
    ("preferences", "Peter Preferences", "preferences.json", "added"),
    ("accepted_patterns", "Accepted Patterns", "accepted_patterns.json", "added"),
    ("rejected_patterns", "Rejected Patterns", "rejected_patterns.json", "added"),
    ("open_questions", "Open Questions", "open_questions.json", "raised"),
]


def _read_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def _items(filename: str) -> list[dict[str, Any]]:
    doc = _read_json(DESIGN_MEMORY / filename, {"items": []})
    items = doc.get("items") if isinstance(doc, dict) else doc
    return [item for item in items or [] if isinstance(item, dict)]


def _date_for(item: dict[str, Any], date_key: str) -> str:
    value = item.get(date_key) or item.get("added") or item.get("raised") or ""
    return str(value).strip()


def _line_for_item(item: dict[str, Any], date_key: str) -> str | None:
    text = str(item.get("text") or "").strip()
    if not text:
        return None
    source = str(item.get("source") or "").strip()
    date = _date_for(item, date_key)
    meta = ", ".join(part for part in (date, source) if part)
    return f"- {text}" + (f" ({meta})" if meta else "")


def _truncate(value: str, limit: int = 420) -> str:
    text = " ".join(value.strip().split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "..."


def _recent_designs(limit: int = 8) -> list[dict[str, Any]]:
    designs: list[dict[str, Any]] = []
    for path in sorted(DESIGN_OUTPUTS_DAILY.glob("*.json"), reverse=True):
        payload = _read_json(path, None)
        if not isinstance(payload, dict):
            continue
        concept = payload.get("concept") if isinstance(payload.get("concept"), dict) else {}
        topic = payload.get("topic") if isinstance(payload.get("topic"), dict) else {}
        stem = path.with_suffix("")
        designs.append(
            {
                "date": str(payload.get("date") or path.stem[:10]),
                "screen": str(topic.get("screen") or ""),
                "theme": str(topic.get("theme") or ""),
                "concept_name": str(concept.get("concept_name") or path.stem),
                "layout_idea": str(concept.get("layout_idea") or ""),
                "why_it_fits": str(concept.get("why_it_fits") or ""),
                "tradeoff": str(concept.get("tradeoff") or ""),
                "md_path": stem.with_suffix(".md"),
                "json_path": path,
                "png_path": stem.with_suffix(".png"),
                "polish_path": Path(f"{stem}-polish.png"),
            }
        )
        if len(designs) >= limit:
            break
    return designs


def _path_line(label: str, path: Path) -> str | None:
    if not path.exists():
        return None
    return f"  - {label}: `{path}`"


def render_design_memory_pack() -> str:
    generated = datetime.now().astimezone().isoformat(timespec="seconds")
    lines = [
        "# David Design Memory",
        "",
        f"Generated: {generated}",
        "",
        "This file is generated from David's structured design memory.",
        "Do not edit it by hand; run `python scripts/sync_design_memory_pack.py` from `/Users/peter/home-center`.",
        "",
        "## How Other Chats Should Use This",
        "",
        "- For Home Center UI, dashboard, family-screen, or design questions, read this file before proposing UI changes.",
        "- Treat principles, preferences, accepted patterns, and rejected patterns as binding guidance unless Peter explicitly overrides them.",
        "- Use recent design artifacts as examples and source material, not as automatically approved final specs.",
        "- In group chats, use this to shape design answers; do not dump private file paths or long design history unless Peter asks.",
        "",
        "## Source Paths",
        "",
        f"- Structured memory: `{DESIGN_MEMORY}`",
        f"- Daily artifacts: `{DESIGN_OUTPUTS_DAILY}`",
        f"- Home Center copy: `{HOME_CENTER_PACK_PATH}`",
        f"- OpenClaw copy: `{OPENCLAW_PACK_PATH}`",
        "",
    ]

    for _key, title, filename, date_key in MEMORY_SECTIONS:
        entries = _items(filename)
        lines.extend([f"## {title}", ""])
        rendered = [_line_for_item(item, date_key) for item in entries]
        rendered = [line for line in rendered if line]
        lines.extend(rendered or ["- None captured yet."])
        lines.append("")

    lines.extend(["## Recent Design Artifacts", ""])
    designs = _recent_designs()
    if not designs:
        lines.extend(["- None generated yet.", ""])
    for design in designs:
        title = design["concept_name"]
        date = design["date"]
        screen = design["screen"]
        theme = design["theme"]
        lines.append(f"### {date} - {title}")
        lines.append("")
        if screen or theme:
            lines.append(f"- Context: {screen or 'unknown screen'}" + (f" - {theme}" if theme else ""))
        if design["layout_idea"]:
            lines.append(f"- Layout idea: {_truncate(design['layout_idea'])}")
        if design["why_it_fits"]:
            lines.append(f"- Why it fits: {_truncate(design['why_it_fits'])}")
        if design["tradeoff"]:
            lines.append(f"- Tradeoff: {_truncate(design['tradeoff'])}")
        for label, path_key in (
            ("Markdown", "md_path"),
            ("JSON", "json_path"),
            ("Structural PNG", "png_path"),
            ("Polish PNG", "polish_path"),
        ):
            path_line = _path_line(label, design[path_key])
            if path_line:
                lines.append(path_line)
        lines.append("")

    lines.extend(
        [
            "## Implementation Note",
            "",
            "David's memory currently stores approved guidance as patterns, preferences, and principles.",
            "It does not yet store a separate per-artifact `approved` flag, so ask Peter before treating a daily artifact as final implementation direction.",
            "",
        ]
    )
    return "\n".join(lines)


def write_shared_design_memory_pack() -> list[Path]:
    content = render_design_memory_pack()
    written: list[Path] = []
    for path in (OPENCLAW_PACK_PATH, HOME_CENTER_PACK_PATH):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        written.append(path)
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true", help="suppress path output")
    args = parser.parse_args()
    written = write_shared_design_memory_pack()
    if not args.quiet:
        for path in written:
            print(f"wrote: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
