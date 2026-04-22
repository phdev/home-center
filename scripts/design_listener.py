#!/usr/bin/env python3
"""
Home Center — Design Claw Telegram listener.

Polls Telegram's getUpdates for messages from the configured chat,
treats each batch of new text as design feedback, merges it into
`design_memory/` via the same pipeline as `parse_design_feedback.py`,
and replies with a short ack.

Stateless per-invocation — the launchd job fires every 5 minutes,
processes whatever's queued, advances the offset pointer, and exits.
State lives in `design_outputs/.last_telegram_update.json`.

Usage:
    OPENAI_API_KEY=... TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... \\
        python scripts/design_listener.py
"""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from _design_claw import (
    CLAWS,
    DESIGN_OUTPUTS,
    call_responses,
    ensure_dirs,
    extract_json_block,
    openai_client,
    read_json,
    read_text,
    require_env,
    with_retries,
    write_json,
)
from update_design_memory import apply_update

TELEGRAM_API = "https://api.telegram.org"
STATE_PATH = DESIGN_OUTPUTS / ".last_telegram_update.json"
IGNORE_TEXTS = {"/start", "/help", "/ack"}
MAX_FEEDBACK_CHARS = 4000  # sanity bound per-batch


def fetch_updates(token: str, offset: int) -> list[dict[str, Any]]:
    """Short-poll Telegram getUpdates from `offset`. Returns [] when idle."""
    url = f"{TELEGRAM_API}/bot{token}/getUpdates?offset={offset}&timeout=0"
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if not data.get("ok"):
        raise RuntimeError(f"getUpdates failed: {data}")
    return data.get("result", []) or []


def send_message(token: str, chat_id: str, text: str) -> None:
    url = f"{TELEGRAM_API}/bot{token}/sendMessage"
    body = urllib.parse.urlencode({"chat_id": chat_id, "text": text}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read().decode("utf-8"))
    if not result.get("ok"):
        raise RuntimeError(f"sendMessage failed: {result}")


def parse_feedback(feedback: str, client) -> dict[str, list[str]]:
    """Same shape as parse_design_feedback.py emits."""
    prompt = read_text(CLAWS / "design_feedback_parser.md")
    raw = call_responses(client, prompt, payload_blocks=[("Feedback", feedback)])
    parsed = extract_json_block(raw)
    if not isinstance(parsed, dict):
        raise ValueError(f"feedback parser returned non-object: {type(parsed).__name__}")
    for key in (
        "accepted_patterns",
        "rejected_patterns",
        "principle_updates",
        "preference_updates",
        "open_questions",
    ):
        parsed.setdefault(key, [])
    return parsed


def format_ack(added: dict[str, int]) -> str:
    parts: list[str] = []
    labels = [
        ("accepted_patterns", "accepted"),
        ("rejected_patterns", "rejected"),
        ("principle_updates", "principle"),
        ("preference_updates", "preference"),
        ("open_questions", "open"),
    ]
    for key, label in labels:
        count = added.get(key, 0) or 0
        if count:
            parts.append(f"{count} {label}")
    if not parts:
        return "🪶 noted — nothing new to memory (already captured or low signal)"
    return "🪶 merged into memory: " + " · ".join(parts)


def collect_incoming(updates: list[dict[str, Any]], chat_id: str) -> tuple[list[str], int]:
    """Filter updates to the configured chat; return (texts, new_offset)."""
    texts: list[str] = []
    new_offset = 0
    for u in updates:
        update_id = u.get("update_id", 0)
        if update_id + 1 > new_offset:
            new_offset = update_id + 1

        message = u.get("message") or u.get("edited_message")
        if not message:
            continue
        if str(message.get("chat", {}).get("id")) != str(chat_id):
            continue
        text = (message.get("text") or "").strip()
        if not text or text in IGNORE_TEXTS:
            continue
        texts.append(text)
    return texts, new_offset


def main() -> int:
    token = require_env("TELEGRAM_BOT_TOKEN")
    chat_id = require_env("TELEGRAM_CHAT_ID")
    ensure_dirs()

    state = read_json(STATE_PATH) if STATE_PATH.exists() else {"offset": 0}
    offset = int(state.get("offset", 0))

    updates = with_retries(lambda: fetch_updates(token, offset))
    if not updates:
        return 0

    texts, new_offset = collect_incoming(updates, chat_id)
    if new_offset > offset:
        state["offset"] = new_offset
        write_json(STATE_PATH, state)

    if not texts:
        # Nothing from the configured chat (maybe someone else messaged the
        # bot, which we ignore). Offset was advanced above.
        return 0

    # Batch all new messages from this poll cycle into one feedback blob.
    feedback = "\n\n---\n\n".join(texts)[:MAX_FEEDBACK_CHARS]

    try:
        client = openai_client()
        parsed = parse_feedback(feedback, client)
        added = apply_update(parsed, source="telegram", feedback=feedback)
        ack = format_ack(added)
    except Exception as exc:
        ack = f"🪶 couldn't parse that — {type(exc).__name__}: {exc}"
        print(f"error: {exc}", file=sys.stderr)
        # Still ack so you know the listener is alive
        with_retries(lambda: send_message(token, chat_id, ack))
        return 1

    with_retries(lambda: send_message(token, chat_id, ack))
    print(f"processed {len(texts)} message(s) → {ack}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
