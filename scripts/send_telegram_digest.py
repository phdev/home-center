#!/usr/bin/env python3
"""
Home Center — Design Claw Telegram digest sender.

Reads a daily artifact (JSON preferred — falls back to the most recent
via `design_outputs/.last_daily.json`) and sends a short plain-text
digest through the Telegram Bot API. Uses urllib from stdlib — no extra
dependency.

Env vars (required):
    TELEGRAM_BOT_TOKEN
    TELEGRAM_CHAT_ID

Usage:
    python scripts/send_telegram_digest.py                         # last daily
    python scripts/send_telegram_digest.py --json design_outputs/daily/2026-04-20-dashboard.json
    python scripts/send_telegram_digest.py --dry-run               # print, don't send
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from _design_claw import (
    DESIGN_OUTPUTS_DAILY,
    load_last_daily,
    read_json,
    require_env,
    with_retries,
)

TELEGRAM_API = "https://api.telegram.org"
MAX_LEN = 3800  # Telegram hard cap is 4096; leave headroom.


def resolve_json_path(cli_path: Path | None) -> Path:
    if cli_path:
        if cli_path.suffix == ".md":
            cli_path = cli_path.with_suffix(".json")
        if not cli_path.exists():
            raise SystemExit(f"error: {cli_path} does not exist")
        return cli_path

    state = load_last_daily()
    if state:
        md_path = Path(state["path"])
        json_path = md_path.with_suffix(".json")
        if json_path.exists():
            return json_path

    # Fall back: most recent JSON in design_outputs/daily/
    candidates = sorted(DESIGN_OUTPUTS_DAILY.glob("*.json"))
    if not candidates:
        raise SystemExit("error: no daily artifacts found in design_outputs/daily/")
    return candidates[-1]


def build_digest(payload: dict[str, Any]) -> str:
    topic = payload.get("topic") or {}
    concept = payload.get("concept") or {}
    lines = [
        f"🪶 Design Claw — {payload.get('date', '')}",
        f"Topic: {topic.get('theme') or topic.get('id', '')}",
        "",
        f"Concept: {concept.get('concept_name', '(unnamed)')}",
        "",
        "Why it matters:",
        (concept.get("why_it_fits") or "").strip(),
        "",
        "Tradeoff:",
        (concept.get("tradeoff") or "").strip(),
        "",
        f"Prototype first: {(concept.get('prototype_first') or '').strip()}",
    ]
    message = "\n".join(line for line in lines if line is not None)
    if len(message) > MAX_LEN:
        message = message[: MAX_LEN - 1] + "…"
    return message


def send_message(token: str, chat_id: str, text: str) -> dict[str, Any]:
    url = f"{TELEGRAM_API}/bot{token}/sendMessage"
    body = urllib.parse.urlencode(
        {"chat_id": chat_id, "text": text, "disable_web_page_preview": "true"}
    ).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, help="path to a daily JSON artifact")
    parser.add_argument("--dry-run", action="store_true", help="print the digest, do not send")
    args = parser.parse_args()

    json_path = resolve_json_path(args.json)
    payload = read_json(json_path)
    digest = build_digest(payload)

    if args.dry_run:
        print(digest)
        return 0

    token = require_env("TELEGRAM_BOT_TOKEN")
    chat_id = require_env("TELEGRAM_CHAT_ID")
    result = with_retries(lambda: send_message(token, chat_id, digest))
    if not result.get("ok"):
        print(f"error: Telegram API returned: {result}", file=sys.stderr)
        return 1

    print(f"sent digest for: {json_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
