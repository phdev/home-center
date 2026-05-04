#!/usr/bin/env python3
"""
Fetch school-related emails from Gmail and output as JSON.

Uses Howie's shared `gog` Gmail auth instead of this service's old
token.json, so there is a single read-only Gmail authorization path.

Usage:
    python fetch_gmail.py [--days 7] [--max 20]
"""

import argparse
import json
import logging
import os
import shutil
import subprocess
from email.utils import parseaddr

logger = logging.getLogger(__name__)

DEFAULT_GOG_ACCOUNT = "phhowell@gmail.com"
GOG_PASSWORD_FILE = os.path.expanduser("~/.openclaw/credentials/gog-keyring-password")

SCHOOL_QUERY = (
    "("
    "from:rbusd.org OR from:jeffersonptarb.org OR from:parentsquare.com "
    "OR from:school OR from:teacher OR from:classroom "
    "OR subject:homework OR subject:school OR subject:class "
    "OR subject:assignment OR subject:\"field trip\" "
    "OR subject:PTA OR subject:\"report card\" OR subject:grade "
    "OR subject:teacher OR subject:classroom OR subject:lunch "
    "OR subject:bus OR subject:dismissal OR subject:conference "
    "OR subject:volunteer OR subject:\"book fair\" "
    "OR subject:\"Weekly Update\" OR subject:DDYK"
    ")"
)


def gog_env():
    """Return an environment that can unlock Howie's gog Gmail token."""
    env = os.environ.copy()
    env.setdefault("GOG_ACCOUNT", DEFAULT_GOG_ACCOUNT)
    if not env.get("GOG_KEYRING_PASSWORD") and os.path.exists(GOG_PASSWORD_FILE):
        with open(GOG_PASSWORD_FILE, encoding="utf-8") as f:
            env["GOG_KEYRING_PASSWORD"] = f.read().strip()
    return env


def run_gog_search(query, max_results):
    gog = shutil.which("gog") or "/opt/homebrew/bin/gog"
    if not os.path.exists(gog):
        return {"error": f"gog not found at {gog}", "emails": []}

    account = os.environ.get("GOG_ACCOUNT", DEFAULT_GOG_ACCOUNT)
    cmd = [
        gog,
        "gmail",
        "messages",
        "search",
        query,
        "--account",
        account,
        "--max",
        str(max_results),
        "--json",
        "--include-body",
        "--no-input",
    ]
    try:
        proc = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            text=True,
            env=gog_env(),
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        return {"error": "gog Gmail query timed out", "emails": []}
    except OSError as exc:
        return {"error": f"gog Gmail query failed to start: {exc}", "emails": []}

    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip()
        return {"error": f"gog Gmail query failed ({proc.returncode}): {detail}", "emails": []}

    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        return {"error": f"gog Gmail query returned invalid JSON: {exc}", "emails": []}


def fetch_school_emails(days=7, max_results=20):
    """Fetch recent school-related emails."""
    query = f"newer_than:{days}d {SCHOOL_QUERY}"
    results = run_gog_search(query, max_results)
    if "error" in results:
        return {"error": results["error"], "emails": []}

    emails = []
    for msg in results.get("messages", []) or []:
        try:
            from_header = msg.get("from", "")
            _, from_addr = parseaddr(from_header)
            from_name = from_header.split("<")[0].strip().strip('"')
            body = msg.get("body", "") or ""
            if len(body) > 1500:
                body = body[:1500] + "..."

            emails.append({
                "id": msg["id"],
                "from": from_name or from_addr,
                "from_addr": from_addr,
                "subject": msg.get("subject", "(no subject)"),
                "snippet": msg.get("snippet", ""),
                "body": body,
                "date": msg.get("date", ""),
            })
        except Exception as e:
            logger.warning("Failed to normalize email %s: %s", msg.get("id"), e)

    return {"emails": emails, "count": len(emails), "query": query}


def main():
    parser = argparse.ArgumentParser(description="Fetch school emails from Gmail")
    parser.add_argument("--days", type=int, default=7, help="Look back N days (default: 7)")
    parser.add_argument("--max", type=int, default=20, help="Max emails to fetch (default: 20)")
    args = parser.parse_args()

    result = fetch_school_emails(days=args.days, max_results=args.max)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
