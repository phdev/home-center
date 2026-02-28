#!/usr/bin/env python3
"""
Fetch school-related emails from Gmail and output as JSON.

Used by the NanoClaw agent as a tool to read school emails.
Outputs a JSON array of recent school-related emails to stdout.

Usage:
    python fetch_gmail.py [--days 7] [--max 20]
"""

import argparse
import base64
import json
import os
import sys
import logging
from email.utils import parseaddr
from datetime import datetime

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

# Look for credentials in script directory or /workspace/extra/
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SEARCH_PATHS = [SCRIPT_DIR, "/workspace/extra", "."]

SCHOOL_QUERY = (
    "("
    "from:school OR from:edu OR from:teacher OR from:classroom "
    "OR subject:homework OR subject:school OR subject:class "
    "OR subject:assignment OR subject:\"field trip\" "
    "OR subject:PTA OR subject:\"report card\" OR subject:grade "
    "OR subject:teacher OR subject:classroom OR subject:lunch "
    "OR subject:bus OR subject:dismissal OR subject:conference "
    "OR subject:volunteer OR subject:book fair"
    ")"
)


def find_file(filename):
    """Find a file in known search paths."""
    for path in SEARCH_PATHS:
        full = os.path.join(path, filename)
        if os.path.exists(full):
            return full
    return None


def get_gmail_service():
    """Authenticate and return Gmail API service."""
    creds_file = find_file("credentials.json")
    token_file = find_file("token.json")

    if not creds_file:
        print(json.dumps({"error": "credentials.json not found"}))
        sys.exit(1)

    creds = None
    if token_file:
        creds = Credentials.from_authorized_user_file(token_file, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            # Save refreshed token
            token_path = token_file or os.path.join(SCRIPT_DIR, "token.json")
            with open(token_path, "w") as f:
                f.write(creds.to_json())
        else:
            print(json.dumps({"error": "token.json missing or invalid. Run setup_gmail.py first."}))
            sys.exit(1)

    return build("gmail", "v1", credentials=creds)


def extract_body(payload):
    """Recursively extract text body from MIME parts."""
    if payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

    parts = payload.get("parts", [])
    for part in parts:
        if part.get("mimeType") == "text/plain":
            data = part.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

    for part in parts:
        body = extract_body(part)
        if body:
            return body

    return ""


def fetch_school_emails(days=7, max_results=20):
    """Fetch recent school-related emails."""
    service = get_gmail_service()

    query = f"newer_than:{days}d {SCHOOL_QUERY}"

    try:
        results = service.users().messages().list(
            userId="me",
            q=query,
            maxResults=max_results,
        ).execute()
    except Exception as e:
        return {"error": f"Gmail query failed: {e}", "emails": []}

    messages = results.get("messages", [])
    emails = []

    for msg_info in messages:
        try:
            msg = service.users().messages().get(
                userId="me",
                id=msg_info["id"],
                format="full",
            ).execute()

            headers = {h["name"].lower(): h["value"] for h in msg["payload"]["headers"]}
            _, from_addr = parseaddr(headers.get("from", ""))
            from_name = headers.get("from", "").split("<")[0].strip().strip('"')

            body = extract_body(msg["payload"])
            # Truncate for summarization
            if len(body) > 1500:
                body = body[:1500] + "..."

            emails.append({
                "id": msg["id"],
                "from": from_name or from_addr,
                "from_addr": from_addr,
                "subject": headers.get("subject", "(no subject)"),
                "snippet": msg.get("snippet", ""),
                "body": body,
                "date": headers.get("date", ""),
            })
        except Exception as e:
            logger.warning("Failed to fetch email %s: %s", msg_info["id"], e)

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
