#!/usr/bin/env python3
"""Turn on the Home Center TV for the 4 PM takeout decision window.

This script is deliberately narrow: it reads the Worker takeout state, verifies
that no dinner decision has been made and that Gmail-derived receipt history
shows at least three days since the last takeout order, then turns on the
configured Pi TV endpoint.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date, datetime


DEFAULT_WORKER_URL = "https://home-center-api.phhowell.workers.dev"
DEFAULT_PI_URL = "http://homecenter.local:8765"
MIN_DAYS_SINCE_LAST_ORDER = 3


def get_json(url: str, token: str | None = None) -> dict | None:
    headers = {"Accept": "application/json", "User-Agent": "home-center-takeout-tv-trigger/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as res:
        if res.status == 204:
            return None
        text = res.read().decode("utf-8")
        return json.loads(text) if text else None


def post_json(url: str) -> dict | None:
    req = urllib.request.Request(
        url,
        data=b"{}",
        headers={"Content-Type": "application/json", "User-Agent": "home-center-takeout-tv-trigger/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        text = res.read().decode("utf-8")
        return json.loads(text) if text else {"ok": True}


def days_since_last_order(state: dict | None, today: date) -> int | None:
    if not state:
        return None
    last = state.get("lastOrderDate")
    if not last and isinstance(state.get("recentVendors"), list):
        dates = [
            item.get("lastOrderedDate")
            for item in state["recentVendors"]
            if isinstance(item, dict) and isinstance(item.get("lastOrderedDate"), str)
        ]
        last = max(dates) if dates else None
    if not last:
        return None
    try:
        parsed = datetime.strptime(last, "%Y-%m-%d").date()
    except ValueError:
        return state.get("daysSinceLastOrder") if isinstance(state.get("daysSinceLastOrder"), int) else None
    return (today - parsed).days


def should_turn_on_tv(state: dict | None, today: date) -> tuple[bool, str]:
    if not state:
        return False, "no_takeout_state"
    if state.get("decision") is not None:
        return False, "decision_already_set"
    days = days_since_last_order(state, today)
    if days is None:
        return False, "missing_email_history"
    if days < MIN_DAYS_SINCE_LAST_ORDER:
        return False, f"last_takeout_{days}_days_ago"
    return True, f"last_takeout_{days}_days_ago"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--worker-url", default=os.environ.get("WORKER_URL", DEFAULT_WORKER_URL))
    parser.add_argument("--worker-token", default=os.environ.get("WORKER_TOKEN", ""))
    parser.add_argument("--pi-url", default=os.environ.get("PI_URL", DEFAULT_PI_URL))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    state = get_json(args.worker_url.rstrip("/") + "/api/takeout/today", args.worker_token or None)
    ok, reason = should_turn_on_tv(state, date.today())
    payload = {
        "eligible": ok,
        "reason": reason,
        "suggestedVendors": (state or {}).get("suggestedVendors", []),
    }
    if ok and not args.dry_run:
        payload["tv"] = post_json(args.pi_url.rstrip("/") + "/api/tv/on")
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
