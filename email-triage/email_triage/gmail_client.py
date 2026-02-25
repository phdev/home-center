"""Gmail API client with OAuth2 refresh token support."""

import os
import base64
import logging
from email.utils import parseaddr

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


class GmailClient:
    def __init__(self, credentials_file="credentials.json", token_file="token.json"):
        self.credentials_file = credentials_file
        self.token_file = token_file
        self.service = None

    def authenticate(self):
        """Authenticate with Gmail API. Runs interactive OAuth flow on first use."""
        creds = None
        if os.path.exists(self.token_file):
            creds = Credentials.from_authorized_user_file(self.token_file, SCOPES)

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                logger.info("Refreshing expired Gmail token")
                creds.refresh(Request())
            else:
                if not os.path.exists(self.credentials_file):
                    raise FileNotFoundError(
                        f"Gmail credentials not found: {self.credentials_file}\n"
                        "Download from Google Cloud Console > APIs & Services > Credentials"
                    )
                logger.info("Running OAuth flow (first-time setup)")
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_file, SCOPES
                )
                creds = flow.run_local_server(port=0)

            with open(self.token_file, "w") as f:
                f.write(creds.to_json())
            logger.info("Gmail token saved to %s", self.token_file)

        self.service = build("gmail", "v1", credentials=creds)
        logger.info("Gmail API authenticated successfully")

    def fetch_new_emails(self, max_results=20):
        """Fetch recent unread emails from the inbox."""
        if not self.service:
            self.authenticate()

        results = self.service.users().messages().list(
            userId="me",
            labelIds=["INBOX"],
            q="is:unread",
            maxResults=max_results,
        ).execute()

        messages = results.get("messages", [])
        emails = []

        for msg_info in messages:
            try:
                msg = self.service.users().messages().get(
                    userId="me",
                    id=msg_info["id"],
                    format="full",
                ).execute()
                emails.append(self._parse_message(msg))
            except Exception as e:
                logger.warning("Failed to fetch email %s: %s", msg_info["id"], e)

        logger.info("Fetched %d new emails", len(emails))
        return emails

    def _parse_message(self, msg):
        """Extract relevant fields from a Gmail message."""
        headers = {h["name"].lower(): h["value"] for h in msg["payload"]["headers"]}
        _, from_addr = parseaddr(headers.get("from", ""))
        from_name = headers.get("from", "").split("<")[0].strip().strip('"')

        body = self._extract_body(msg["payload"])
        # Truncate body to ~2000 chars for classification
        if len(body) > 2000:
            body = body[:2000] + "..."

        return {
            "id": msg["id"],
            "thread_id": msg["threadId"],
            "from_addr": from_addr,
            "from_name": from_name,
            "to": headers.get("to", ""),
            "subject": headers.get("subject", "(no subject)"),
            "snippet": msg.get("snippet", ""),
            "body": body,
            "date": headers.get("date", ""),
            "labels": msg.get("labelIds", []),
        }

    def _extract_body(self, payload):
        """Recursively extract text body from MIME parts."""
        if payload.get("body", {}).get("data"):
            return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

        parts = payload.get("parts", [])
        for part in parts:
            mime = part.get("mimeType", "")
            if mime == "text/plain":
                data = part.get("body", {}).get("data", "")
                if data:
                    return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

        # Fallback: try first part with data
        for part in parts:
            body = self._extract_body(part)
            if body:
                return body

        return ""
