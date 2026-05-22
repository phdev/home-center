#!/usr/bin/env python3
"""
Home Center — Design Claw Telegram listener.

Polls Telegram's getUpdates for messages from the configured chat.
Explicit memory-feedback messages are merged into `design_memory/` via the
same pipeline as `parse_design_feedback.py`; ordinary messages receive a
short David design/frontend response.

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
    load_memory,
    memory_summary_for_prompt,
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
MEMORY_PREFIXES = (
    "/feedback",
    "/remember",
    "/memory",
    "feedback:",
    "remember:",
    "memory:",
)
MAX_FEEDBACK_CHARS = 4000  # sanity bound per-batch
MAX_CHAT_CHARS = 3000
MAX_REPLY_CHARS = 3500


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


def david_chat_response(message: str, client) -> str:
    """Generate a bounded conversational David response for ordinary messages."""
    prompt = read_text(CLAWS / "david_chat.md")
    memory = load_memory()
    raw = call_responses(
        client,
        prompt,
        payload_blocks=[
            ("Peter's message", message[:MAX_CHAT_CHARS]),
            ("Design memory (summary)", memory_summary_for_prompt(memory)),
        ],
    ).strip()
    if not raw:
        return "I’m here. Send me a design/frontend question or ask Devon to scope a task for me."
    return raw[:MAX_REPLY_CHARS]


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


def explicit_memory_feedback(text: str) -> str | None:
    """Return feedback content only when the message explicitly asks for memory."""
    lowered = text.lower()
    for prefix in MEMORY_PREFIXES:
        if lowered == prefix:
            return ""
        if lowered.startswith(prefix + " "):
            return text[len(prefix) :].strip()
    for prefix in ("feedback:", "remember:", "memory:"):
        if lowered.startswith(prefix):
            return text[len(prefix) :].strip()
    return None


def collect_incoming(updates: list[dict[str, Any]], chat_id: str) -> tuple[list[str], list[str], int]:
    """Filter updates to configured chat; return (memory_texts, chat_texts, new_offset)."""
    memory_texts: list[str] = []
    chat_texts: list[str] = []
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
        feedback = explicit_memory_feedback(text)
        if feedback is None:
            chat_texts.append(text)
            continue
        if feedback:
            memory_texts.append(feedback)
    return memory_texts, chat_texts, new_offset


def main() -> int:
    token = require_env("TELEGRAM_BOT_TOKEN")
    chat_id = require_env("TELEGRAM_CHAT_ID")
    ensure_dirs()

    state = read_json(STATE_PATH) if STATE_PATH.exists() else {"offset": 0}
    offset = int(state.get("offset", 0))

    updates = with_retries(lambda: fetch_updates(token, offset))
    if not updates:
        return 0

    memory_texts, chat_texts, new_offset = collect_incoming(updates, chat_id)
    if new_offset > offset:
        state["offset"] = new_offset
        write_json(STATE_PATH, state)

    if not memory_texts and not chat_texts:
        return 0

    client = openai_client()

    if memory_texts:
        # Batch explicit memory messages from this poll cycle into one feedback blob.
        feedback = "\n\n---\n\n".join(memory_texts)[:MAX_FEEDBACK_CHARS]

        try:
            parsed = parse_feedback(feedback, client)
            added = apply_update(parsed, source="telegram", feedback=feedback)
            ack = format_ack(added)
        except Exception as exc:
            ack = f"🪶 couldn't parse that — {type(exc).__name__}: {exc}"
            print(f"error: {exc}", file=sys.stderr)
            # Still ack so you know the listener is alive.
            with_retries(lambda: send_message(token, chat_id, ack))
            return 1

        with_retries(lambda: send_message(token, chat_id, ack))
        print(f"processed {len(memory_texts)} memory message(s) → {ack}")

    if chat_texts:
        chat_message = "\n\n---\n\n".join(chat_texts)[:MAX_CHAT_CHARS]
        try:
            reply = david_chat_response(chat_message, client)
        except Exception as exc:
            reply = f"I’m here, but I couldn’t answer that cleanly ({type(exc).__name__})."
            print(f"error: {exc}", file=sys.stderr)
        with_retries(lambda: send_message(token, chat_id, reply))
        print(f"processed {len(chat_texts)} chat message(s) → {reply[:120]}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
