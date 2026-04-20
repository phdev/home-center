#!/usr/bin/env python3
"""
School Updates Agent — OpenClaw-centric.

Flow:
    Gmail fetch (pre-filtered by school-ish search query, see fetch_gmail.py)
      ↓
    Per-email POST to worker /api/claw/enhance?feature=schoolUpdates
      ↓  (keep only isRelevant=true)
    Publish the structured batch to /api/school-updates  → TV School Updates card
      ↓
    Fire an individual Telegram ping for each actionable item  → family phone

No direct OpenAI/Anthropic calls from here — all LLM work goes through the
worker's single enhancement surface. Dedup via a small on-disk JSON file of
seen email IDs so the same email is never announced twice.

Config via config.yaml (see school-updates/config.example.yaml):
    worker_url, auth_token, telegram_target_chat,
    openclaw_url (default http://localhost:3100),
    poll_interval_seconds, gmail.days, gmail.max_results

Usage:
    python3 agent.py                 # loop on interval
    python3 agent.py --once          # run one cycle, exit
"""

import argparse
import json
import logging
import os
import signal
import sys
import time
from pathlib import Path

import requests
import yaml

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
from fetch_gmail import fetch_school_emails  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [school-agent] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

SEEN_PATH = Path(SCRIPT_DIR) / "seen.json"
running = True


def handle_signal(sig, frame):
    global running
    logger.info("Shutdown signal received")
    running = False


# ─── State ──────────────────────────────────────────────────────────

def load_seen():
    try:
        return set(json.loads(SEEN_PATH.read_text()))
    except Exception:
        return set()


def save_seen(seen):
    # Trim to last 1000 to keep file small.
    try:
        SEEN_PATH.write_text(json.dumps(sorted(seen)[-1000:]))
    except Exception as e:
        logger.warning("Couldn't persist seen.json: %s", e)


# ─── Config ─────────────────────────────────────────────────────────

def load_config():
    cfg_path = Path(SCRIPT_DIR) / "config.yaml"
    if not cfg_path.exists():
        logger.error(
            "Missing %s — copy config.example.yaml and fill in your values.",
            cfg_path,
        )
        sys.exit(2)
    with cfg_path.open() as f:
        cfg = yaml.safe_load(f) or {}

    required = ["worker_url", "auth_token"]
    for k in required:
        if not cfg.get(k):
            logger.error("config.yaml missing required key: %s", k)
            sys.exit(2)
    cfg.setdefault("openclaw_url", "http://localhost:3100")
    cfg.setdefault("poll_interval_seconds", 1800)  # 30 min default
    cfg.setdefault("gmail", {})
    cfg["gmail"].setdefault("days", 7)
    cfg["gmail"].setdefault("max_results", 25)
    cfg.setdefault("telegram_target_chat", None)
    return cfg


# ─── Worker calls ───────────────────────────────────────────────────

def enhance_email(email, cfg):
    """Ask the worker to classify + extract. Returns the fields dict or None."""
    snippet = email.get("body") or email.get("snippet") or ""
    body = {
        "feature": "schoolUpdates",
        "state": {
            "from": email.get("from", ""),
            "subject": email.get("subject", ""),
            "snippet": snippet[:1500],
            "receivedAt": email.get("date", ""),
        },
    }
    try:
        res = requests.post(
            f"{cfg['worker_url']}/api/claw/enhance",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {cfg['auth_token']}",
            },
            json=body,
            timeout=30,
        )
        if not res.ok:
            logger.warning(
                "Enhance returned %d for %s: %s",
                res.status_code,
                email.get("id"),
                res.text[:200],
            )
            return None
        return res.json().get("fields", {}) or {}
    except requests.RequestException as e:
        logger.warning("Enhance request failed for %s: %s", email.get("id"), e)
        return None


def publish_updates(items, cfg):
    """Push the full batch to /api/school-updates so the TV card sees them."""
    try:
        payload = {"updates": [{
            # Client normalizer accepts this shape directly.
            "id": it["id"],
            "kind": it["kind"],
            "title": it["title"],
            "summary": it["summary"],
            "dueDate": it.get("dueDate"),
            "eventDate": it.get("eventDate"),
            "child": it.get("child"),
            "location": it.get("location"),
            "urgency": it.get("urgency", 0.5),
            "suggestedAction": it.get("suggestedAction"),
            "classifier": "llm",
            "sourceEmailId": it["id"],
        } for it in items]}
        res = requests.post(
            f"{cfg['worker_url']}/api/school-updates",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {cfg['auth_token']}",
            },
            json=payload,
            timeout=10,
        )
        if res.ok:
            logger.info("Posted %d items to /api/school-updates", len(items))
        else:
            logger.error(
                "POST /api/school-updates failed (%d): %s",
                res.status_code,
                res.text[:200],
            )
    except requests.RequestException as e:
        logger.error("Failed to post updates: %s", e)


def notify_telegram(item, cfg):
    """Send an actionable item to the family phone via the OpenClaw bridge."""
    chat_id = cfg.get("telegram_target_chat")
    if not chat_id:
        return
    icon = {"action": "📝", "event": "📅", "reminder": "⏰", "info": "📣"}.get(
        item.get("kind", "info"), "🏫"
    )
    lines = [f"{icon} School — {item.get('title', '')}"]
    if item.get("child"):
        lines.append(f"Child: {item['child']}")
    if item.get("dueDate"):
        lines.append(f"Due: {item['dueDate']}")
    elif item.get("eventDate"):
        lines.append(f"When: {item['eventDate']}")
    if item.get("summary"):
        lines.append("")
        lines.append(item["summary"])
    if item.get("suggestedAction"):
        lines.append("")
        lines.append(f"→ {item['suggestedAction']}")
    try:
        res = requests.post(
            f"{cfg['openclaw_url']}/send",
            headers={"Content-Type": "application/json"},
            json={"chatId": str(chat_id), "message": "\n".join(lines)},
            timeout=10,
        )
        if not res.ok:
            logger.warning(
                "Telegram send failed (%d): %s",
                res.status_code,
                res.text[:200],
            )
    except requests.RequestException as e:
        logger.warning("Telegram send threw: %s", e)


# ─── One cycle ──────────────────────────────────────────────────────

def run_once(cfg, seen):
    logger.info("Fetching school-ish emails (last %sd)…", cfg["gmail"]["days"])
    result = fetch_school_emails(
        days=cfg["gmail"]["days"],
        max_results=cfg["gmail"]["max_results"],
    )
    if "error" in result and not result.get("emails"):
        logger.error("Gmail fetch error: %s", result["error"])
        return

    emails = result.get("emails", []) or []
    fresh = [e for e in emails if e.get("id") and e["id"] not in seen]
    logger.info(
        "Candidates: %d fetched, %d new (after dedup).",
        len(emails),
        len(fresh),
    )

    relevant_items = []
    for email in fresh:
        eid = email["id"]
        fields = enhance_email(email, cfg)
        if fields is None:
            # Worker unreachable — don't mark as seen so we retry next cycle.
            continue
        seen.add(eid)
        if not fields.get("isRelevant"):
            continue
        item = dict(fields)
        item["id"] = eid
        relevant_items.append(item)

    if relevant_items:
        logger.info("Relevant items: %d", len(relevant_items))
        publish_updates(relevant_items, cfg)
        for item in relevant_items:
            notify_telegram(item, cfg)
    else:
        logger.info("No new relevant items this cycle.")

    save_seen(seen)


# ─── Main ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="School Updates Agent (OpenClaw-centric)")
    parser.add_argument("--once", action="store_true", help="Run one cycle and exit")
    parser.add_argument(
        "--interval",
        type=int,
        default=None,
        help="Poll interval in seconds (overrides config.yaml; default 1800 = 30 min)",
    )
    args = parser.parse_args()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    cfg = load_config()
    interval = args.interval or cfg["poll_interval_seconds"]
    seen = load_seen()

    if args.once:
        run_once(cfg, seen)
        return

    logger.info("School updates agent starting (interval: %ds)", interval)
    while running:
        try:
            run_once(cfg, seen)
        except Exception as e:
            logger.exception("run_once failed: %s", e)
        for _ in range(interval):
            if not running:
                break
            time.sleep(1)
    logger.info("School updates agent stopped")


if __name__ == "__main__":
    main()
