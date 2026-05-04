#!/usr/bin/env python3
"""
Home Center — Daily Design Claw runner.

Loads today's topic + screen snapshot + design memory, calls the OpenAI
Responses API for ONE concept (strict JSON), and writes both a JSON
artifact and a human-readable markdown artifact to
`design_outputs/daily/<date>-<screen>.md`.

Rotation is deterministic: day-of-year modulo the topic list length.

Usage:
    OPENAI_API_KEY=sk-... python scripts/run_daily_design_claw.py
    python scripts/run_daily_design_claw.py --topic-id deadline-first-school
    python scripts/run_daily_design_claw.py --snapshot design_inputs/dashboard.json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from _design_claw import (
    CLAWS,
    DESIGN_INPUTS,
    DESIGN_OUTPUTS_DAILY,
    append_iteration_log,
    call_responses,
    ensure_dirs,
    extract_json_block,
    load_memory,
    memory_summary_for_prompt,
    openai_client,
    read_json,
    read_text,
    save_last_daily,
    today_str,
    write_json,
    write_text,
)


def pick_topic(topics: list[dict[str, Any]], topic_id: str | None) -> dict[str, Any]:
    if topic_id:
        for t in topics:
            if t.get("id") == topic_id:
                return t
        raise SystemExit(f"error: topic_id '{topic_id}' not found in daily_topics.json")
    idx = datetime.now().timetuple().tm_yday % len(topics)
    return topics[idx]


def default_snapshot_for(topic: dict[str, Any]) -> Path:
    screen = topic.get("screen", "dashboard")
    candidate = DESIGN_INPUTS / f"{screen}.json"
    if candidate.exists():
        return candidate
    return DESIGN_INPUTS / "dashboard.json"


REQUIRED_CONCEPT_FIELDS = (
    "concept_name",
    "layout_idea",
    "why_it_fits",
    "tradeoff",
    "prototype_first",
)


def validate_concept(concept: Any) -> str | None:
    """Return None if the concept has all required non-empty string fields,
    otherwise a reason string suitable for stderr."""
    if not isinstance(concept, dict):
        return f"expected a JSON object, got {type(concept).__name__}"
    for key in REQUIRED_CONCEPT_FIELDS:
        value = concept.get(key)
        if not isinstance(value, str) or not value.strip():
            return f"required field '{key}' is missing, empty, or not a string"
    return None


def render_markdown(concept: dict[str, Any], topic: dict[str, Any], date: str) -> str:
    hint = concept.get("implementation_hint", "")
    reinforces = concept.get("memory_alignment", {}).get("reinforces", []) or []
    avoids = concept.get("memory_alignment", {}).get("avoids_rejected", []) or []
    reinforces_lines = [f"- {r}" for r in reinforces] or ["- (none cited)"]
    avoids_lines = [f"- {a}" for a in avoids] or ["- (none cited)"]
    lines = [
        f"# Design Claw — {date} — {topic.get('screen', 'dashboard')}",
        "",
        f"**Topic.** {topic.get('theme', '')}  ",
        f"**Topic id.** `{topic.get('id', '')}`",
        "",
        f"## Concept — {concept.get('concept_name', '(unnamed)')}",
        "",
        "### Layout idea",
        concept.get("layout_idea", "").strip(),
        "",
        "### Why it fits",
        concept.get("why_it_fits", "").strip(),
        "",
        "### Tradeoff",
        concept.get("tradeoff", "").strip(),
        "",
        "### Implementation hint",
        hint.strip() if isinstance(hint, str) else "\n".join(f"- {h}" for h in hint),
        "",
        "### Prototype first",
        concept.get("prototype_first", "").strip(),
        "",
        "### Memory alignment",
        "**Reinforces.**",
        *reinforces_lines,
        "",
        "**Avoids rejected.**",
        *avoids_lines,
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--topic-id", help="override today's rotation")
    parser.add_argument(
        "--snapshot",
        type=Path,
        help="override the screen snapshot path (defaults to design_inputs/<screen>.json)",
    )
    parser.add_argument(
        "--render",
        action="store_true",
        help="also generate <stem>.html + <stem>.png (requires playwright + chromium)",
    )
    parser.add_argument(
        "--no-polish",
        action="store_true",
        help="skip the Images 2.0 polish pass even when --render is set",
    )
    args = parser.parse_args()

    ensure_dirs()
    prompt = read_text(CLAWS / "design_daily.md")
    topics_doc = read_json(DESIGN_INPUTS / "daily_topics.json")
    topics = topics_doc.get("topics") or []
    if not topics:
        raise SystemExit("error: design_inputs/daily_topics.json has no topics")

    topic = pick_topic(topics, args.topic_id)
    snapshot_path = args.snapshot or default_snapshot_for(topic)
    snapshot = read_json(snapshot_path)
    memory = load_memory()

    client = openai_client()
    raw = call_responses(
        client,
        prompt,
        payload_blocks=[
            ("Today's theme", json.dumps(topic, indent=2)),
            ("Screen snapshot", json.dumps(snapshot, indent=2)),
            ("Design memory (summary)", memory_summary_for_prompt(memory)),
        ],
    )

    try:
        concept = extract_json_block(raw)
    except Exception:
        debug_path = DESIGN_OUTPUTS_DAILY / f"{today_str()}-raw-error.txt"
        write_text(debug_path, raw)
        print(f"error: could not parse JSON from model output; raw saved to {debug_path}", file=sys.stderr)
        return 3

    schema_error = validate_concept(concept)
    if schema_error:
        debug_path = DESIGN_OUTPUTS_DAILY / f"{today_str()}-schema-error.txt"
        write_text(debug_path, f"Schema error: {schema_error}\n\n---RAW MODEL OUTPUT---\n{raw}")
        print(
            f"error: concept schema invalid — {schema_error}; raw saved to {debug_path}",
            file=sys.stderr,
        )
        return 3

    date = today_str()
    screen = topic.get("screen", "dashboard")
    md_path = DESIGN_OUTPUTS_DAILY / f"{date}-{screen}.md"
    json_path = DESIGN_OUTPUTS_DAILY / f"{date}-{screen}.json"

    write_json(
        json_path,
        {"date": date, "topic": topic, "concept": concept, "snapshot_path": str(snapshot_path)},
    )
    write_text(md_path, render_markdown(concept, topic, date))
    save_last_daily(md_path, topic)
    append_iteration_log(
        "daily_concept",
        f"Daily concept '{concept.get('concept_name', '(unnamed)')}' for topic '{topic.get('id')}'",
        topic_id=topic.get("id"),
        concept_name=concept.get("concept_name"),
        md_path=str(md_path),
    )

    print(f"saved: {md_path}")
    print(f"saved: {json_path}")

    if args.render:
        # Lazy import so non-render runs don't require playwright.
        from render_concept import render_concept

        structural_ok = False
        try:
            html_path, png_path = render_concept(json_path, client)
            print(f"saved: {html_path}")
            print(f"saved: {png_path}")
            append_iteration_log(
                "daily_render",
                f"Rendered concept '{concept.get('concept_name', '(unnamed)')}'",
                png_path=str(png_path),
            )
            structural_ok = True
        except Exception as exc:
            # Structural render is a nice-to-have; the text concept still
            # counts as a successful daily. Log and continue.
            print(f"warning: structural render failed ({type(exc).__name__}): {exc}", file=sys.stderr)

        # Polish pass — only runs when the structural mockup succeeded.
        # Different failure domain (image model vs text model), so its
        # own try/except and its own --no-polish opt-out.
        if structural_ok and not args.no_polish:
            from render_polish import render_polish

            try:
                polish_path = render_polish(json_path, client)
                print(f"saved: {polish_path}")
                append_iteration_log(
                    "daily_polish",
                    f"Polished mockup for '{concept.get('concept_name', '(unnamed)')}'",
                    polish_path=str(polish_path),
                )
            except Exception as exc:
                # Polish failure leaves the structural mockup as the sole
                # image — Telegram delivery still works via the existing
                # single-photo path.
                print(
                    f"warning: polish pass failed ({type(exc).__name__}): {exc}",
                    file=sys.stderr,
                )

    try:
        from sync_design_memory_pack import write_shared_design_memory_pack

        written = write_shared_design_memory_pack()
        print(f"synced: {written[0]}")
    except Exception as exc:
        print(f"warning: design memory pack sync failed ({type(exc).__name__}): {exc}", file=sys.stderr)

    print()
    print(f"concept: {concept.get('concept_name', '(unnamed)')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
