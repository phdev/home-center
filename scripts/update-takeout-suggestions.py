#!/usr/bin/env python3
"""Update takeout restaurant suggestions from recent Gmail order receipts.

The script sends only aggregate restaurant names and dates to the Worker. It
does not persist or print email bodies.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path


DEFAULT_ACCOUNT = "phhowell@gmail.com"
DEFAULT_WORKER_URL = "https://home-center-api.phhowell.workers.dev"
GOG_PASSWORD_FILE = Path.home() / ".openclaw" / "credentials" / "gog-keyring-password"

KNOWN_VENDORS = [
    "Mickey's Deli",
    "Rascals",
    "Chipotle",
    "In-N-Out",
    "Sushi",
    "Chicken Maison",
    "California Chicken Cafe",
    "El Tarasco",
    "Thai Dishes",
    "Sweetgreen",
    "Mendocino Farms",
    "Urban Plates",
    "Cava",
    "Panda Express",
]

ORDER_QUERY = (
    "newer_than:{days}d ("
    "from:doordash.com OR from:ubereats.com OR from:postmates.com OR "
    "from:grubhub.com OR from:toasttab.com OR from:toasttakeout.com OR "
    "from:chownow.com OR "
    "\"Mickey's Deli\" OR Rascals OR Chipotle OR \"In-N-Out\" OR Sushi OR "
    "\"Chicken Maison\" OR \"California Chicken Cafe\" OR \"El Tarasco\" OR "
    "\"Thai Dishes\" OR Sweetgreen OR \"Mendocino Farms\" OR \"Urban Plates\" OR Cava"
    ")"
)

FOOD_PLATFORM_RE = re.compile(
    r"(doordash|ubereats|uber\s*eats|postmates|grubhub|toasttab|toasttakeout|chownow)",
    re.IGNORECASE,
)
BAD_VENDOR_RE = re.compile(
    r"^(next|no[-\s]?contact|delivery|pickup|order|receipt|confirmation|scheduled|gift card|purchase)$",
    re.IGNORECASE,
)


def env_with_gog_password() -> dict[str, str]:
    env = os.environ.copy()
    env["HOME"] = str(Path.home())
    if not env.get("GOG_KEYRING_PASSWORD") and GOG_PASSWORD_FILE.exists():
        env["GOG_KEYRING_PASSWORD"] = GOG_PASSWORD_FILE.read_text(encoding="utf-8").strip()
    return env


def parse_accounts(value: str | None) -> list[str]:
    raw = value or os.environ.get("TAKEOUT_GMAIL_ACCOUNTS") or DEFAULT_ACCOUNT
    return [account.strip() for account in raw.split(",") if account.strip()]


def run_gog(account: str, query: str, max_results: int) -> tuple[list[dict], str | None]:
    cmd = [
        "gog",
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
    proc = subprocess.run(cmd, capture_output=True, text=True, env=env_with_gog_password(), timeout=90)
    if proc.returncode != 0:
        return [], (proc.stderr or proc.stdout or f"gog exited {proc.returncode}").strip()
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        return [], f"gog returned invalid JSON: {exc}"
    return data.get("messages", []) or [], None


def message_date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return parsedate_to_datetime(value).astimezone(timezone.utc).date().isoformat()
    except Exception:
        match = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", value)
        return match.group(1) if match else None


def normalize_vendor(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", value).strip(" -:|.,\t\r\n")
    for vendor in KNOWN_VENDORS:
        if cleaned.lower() == vendor.lower():
            return vendor
    return cleaned


def extract_vendor(msg: dict) -> str | None:
    subject = msg.get("subject") or ""
    sender = msg.get("from") or ""
    body = (msg.get("body") or "")[:2500]
    haystack = f"{subject}\n{sender}\n{body}"

    for vendor in KNOWN_VENDORS:
        if re.search(rf"\b{re.escape(vendor)}\b", haystack, re.IGNORECASE):
            return vendor

    if not FOOD_PLATFORM_RE.search(sender):
        return None

    patterns = [
        r"order\s+(?:from|at)\s+([A-Z][A-Za-z0-9&' .-]{2,50})",
        r"receipt\s+(?:from|for)\s+([A-Z][A-Za-z0-9&' .-]{2,50})",
        r"thanks\s+for\s+ordering\s+from\s+([A-Z][A-Za-z0-9&' .-]{2,50})",
        r"your\s+([A-Z][A-Za-z0-9&' .-]{2,50})\s+order",
    ]
    for pattern in patterns:
        match = re.search(pattern, haystack, re.IGNORECASE)
        if match:
            candidate = normalize_vendor(match.group(1))
            if not BAD_VENDOR_RE.search(candidate) and not re.search(r"\b(order|receipt|confirmation|delivery|pickup|doordash|uber|grubhub)\b", candidate, re.IGNORECASE):
                return candidate
    return None


def build_suggestions(messages_by_account: dict[str, list[dict]]) -> dict:
    counts: Counter[str] = Counter()
    last_seen: dict[str, str] = {}
    accounts_seen: defaultdict[str, set[str]] = defaultdict(set)

    for account, messages in messages_by_account.items():
        for msg in messages:
            vendor = extract_vendor(msg)
            if not vendor:
                continue
            date = message_date(msg.get("date"))
            counts[vendor] += 1
            accounts_seen[vendor].add(account)
            if date and (vendor not in last_seen or date > last_seen[vendor]):
                last_seen[vendor] = date

    recent_ranked = sorted(
        counts,
        key=lambda vendor: (last_seen.get(vendor, ""), counts[vendor], vendor.lower()),
        reverse=True,
    )
    recent_set = {vendor.lower() for vendor in recent_ranked[:8]}
    candidates = [vendor for vendor in KNOWN_VENDORS if vendor.lower() not in recent_set]
    candidates.extend(vendor for vendor in KNOWN_VENDORS if vendor.lower() in recent_set)

    return {
        "suggestedVendors": candidates[:8],
        "recentVendors": [
            {
                "name": vendor,
                "lastOrderedDate": last_seen.get(vendor),
                "count": counts[vendor],
                "accounts": sorted(accounts_seen[vendor]),
            }
            for vendor in recent_ranked[:12]
        ],
        "suggestionsSource": "gmail:" + ",".join(sorted(messages_by_account)),
    }


def post_worker(worker_url: str, token: str | None, payload: dict) -> dict:
    req = urllib.request.Request(
        worker_url.rstrip("/") + "/api/takeout/suggestions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "home-center-takeout-suggestions/1.0",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Worker returned HTTP {exc.code}: {detail}") from exc


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--accounts", help="Comma-separated Gmail accounts. Defaults to TAKEOUT_GMAIL_ACCOUNTS or Peter's account.")
    parser.add_argument("--days", type=int, default=45)
    parser.add_argument("--max", type=int, default=50)
    parser.add_argument("--worker-url", default=os.environ.get("WORKER_URL", DEFAULT_WORKER_URL))
    parser.add_argument("--worker-token", default=os.environ.get("WORKER_TOKEN", ""))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    query = ORDER_QUERY.format(days=args.days)
    messages_by_account: dict[str, list[dict]] = {}
    errors: dict[str, str] = {}
    for account in parse_accounts(args.accounts):
        messages, error = run_gog(account, query, args.max)
        messages_by_account[account] = messages
        if error:
            errors[account] = error

    payload = build_suggestions(messages_by_account)
    if errors:
        payload["accountErrors"] = errors

    if args.dry_run:
        print(json.dumps(payload, indent=2))
        return 1 if errors and not payload["suggestedVendors"] else 0

    result = post_worker(args.worker_url, args.worker_token or None, payload)
    print(json.dumps({
        "ok": result.get("ok", False),
        "suggestedVendors": result.get("record", {}).get("suggestedVendors", []),
        "recentVendorCount": len(result.get("record", {}).get("recentVendors", [])),
        "accountErrors": errors,
    }, indent=2))
    return 1 if errors and not payload["suggestedVendors"] else 0


if __name__ == "__main__":
    sys.exit(main())
