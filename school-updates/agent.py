#!/usr/bin/env python3
"""
School Updates Agent — lightweight email summarizer for the family dashboard.

Fetches school-related emails from Gmail, summarizes them via the worker's
OpenAI proxy, and posts structured updates to the dashboard.

Runs as a cron job or systemd timer on the Pi. No API keys needed on the Pi —
summarization goes through the Cloudflare Worker's /api/ask endpoint.

Usage:
    python3 agent.py [--once] [--interval 900]
"""

import argparse
import json
import logging
import os
import signal
import sys
import time

import requests

# Add script directory to path for fetch_gmail import
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from fetch_gmail import fetch_school_emails

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [school-agent] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

WORKER_URL = os.environ.get(
    "WORKER_URL", "https://home-center-api.phhowell.workers.dev"
)

SUMMARIZE_PROMPT = """\
You are a family dashboard assistant. Given these school-related emails, extract \
the most important upcoming items for parents to see on their TV dashboard.

For each actionable item, output a JSON object with:
- "label": one of "DUE", "EVENT", "HOMEWORK", "INFO"
- "date": short date like "Mar 4" (use the most relevant date from the email)
- "title": concise title under 40 chars, include child's name if mentioned
- "desc": one-line description under 60 chars

Return ONLY a JSON array of items (max 6), sorted by urgency (soonest first).
If no actionable items, return an empty array [].
Do not include any text outside the JSON array.

Emails:
"""

running = True


def handle_signal(sig, frame):
    global running
    logger.info("Shutdown signal received")
    running = False


def summarize_via_worker(emails):
    """Send emails to worker's /api/ask for OpenAI summarization."""
    if not emails:
        return []

    # Build email summaries for the prompt
    email_text = ""
    for e in emails:
        email_text += f"\n---\nFrom: {e['from']}\n"
        email_text += f"Subject: {e['subject']}\n"
        email_text += f"Date: {e['date']}\n"
        email_text += f"Snippet: {e['snippet']}\n"
        if e.get("body"):
            # Use first 500 chars of body
            email_text += f"Body: {e['body'][:500]}\n"

    prompt = SUMMARIZE_PROMPT + email_text

    try:
        res = requests.post(
            f"{WORKER_URL}/api/ask",
            json={"query": prompt},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        if not res.ok:
            logger.error("Worker /api/ask returned %d: %s", res.status_code, res.text[:200])
            return []

        data = res.json()
        text = data.get("text", "")

        # Parse JSON from the response (handle markdown code blocks)
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1]
            text = text.rsplit("```", 1)[0]
        text = text.strip()

        updates = json.loads(text)
        if isinstance(updates, list):
            return updates[:6]

        logger.warning("Unexpected response format: %s", text[:200])
        return []

    except json.JSONDecodeError as e:
        logger.error("Failed to parse LLM response as JSON: %s", e)
        return []
    except requests.RequestException as e:
        logger.error("Failed to reach worker: %s", e)
        return []


def post_updates(updates):
    """Post structured updates to the worker."""
    try:
        res = requests.post(
            f"{WORKER_URL}/api/school-updates",
            json={"updates": updates},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        if res.ok:
            data = res.json()
            logger.info("Posted %d updates to dashboard", data.get("count", 0))
        else:
            logger.error("POST /api/school-updates failed (%d): %s", res.status_code, res.text[:200])
    except requests.RequestException as e:
        logger.error("Failed to post updates: %s", e)


def run_once():
    """Run one cycle: fetch → summarize → post."""
    logger.info("Fetching school emails...")
    result = fetch_school_emails(days=14, max_results=20)

    if "error" in result and not result.get("emails"):
        logger.error("Gmail fetch error: %s", result["error"])
        return

    emails = result.get("emails", [])
    logger.info("Found %d school-related emails", len(emails))

    if not emails:
        # Post empty updates to clear stale data
        post_updates([])
        return

    logger.info("Summarizing with LLM...")
    updates = summarize_via_worker(emails)
    logger.info("Got %d actionable items", len(updates))

    post_updates(updates)


def main():
    parser = argparse.ArgumentParser(description="School Updates Agent")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    parser.add_argument("--interval", type=int, default=900, help="Poll interval in seconds (default: 900 = 15 min)")
    args = parser.parse_args()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    if args.once:
        run_once()
    else:
        logger.info("School updates agent starting (interval: %ds)", args.interval)
        while running:
            run_once()
            for _ in range(args.interval):
                if not running:
                    break
                time.sleep(1)
        logger.info("School updates agent stopped")


if __name__ == "__main__":
    main()
