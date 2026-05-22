#!/usr/bin/env python3
"""
One-time Gmail OAuth setup.

Run this on a machine with a browser to authorize Gmail read-only access.
After authorization, copy the generated token.json to the Pi.

Usage:
    pip install -r requirements.txt
    python setup_gmail.py

This will:
1. Open a browser for Google OAuth consent
2. Save token.json in the current directory
3. Test the connection by listing recent emails
"""

import os
import sys

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
CREDENTIALS_FILE = "credentials.json"
TOKEN_FILE = "token.json"


def main():
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"Error: {CREDENTIALS_FILE} not found.")
        print()
        print("To get this file:")
        print("1. Go to https://console.cloud.google.com")
        print("2. Create a project (or select existing)")
        print("3. Enable the Gmail API:")
        print("   APIs & Services → Library → search 'Gmail API' → Enable")
        print("4. Create OAuth credentials:")
        print("   APIs & Services → Credentials → Create Credentials → OAuth client ID")
        print("   Application type: Desktop app")
        print("5. Download the JSON and save as 'credentials.json' in this directory")
        sys.exit(1)

    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refreshing expired token...")
            creds.refresh(Request())
        else:
            print("Starting OAuth flow — a browser will open for authorization.")
            print("Grant read-only access to Gmail when prompted.")
            print()
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
        print(f"Token saved to {TOKEN_FILE}")

    # Test the connection
    service = build("gmail", "v1", credentials=creds)
    results = service.users().messages().list(
        userId="me", labelIds=["INBOX"], maxResults=5
    ).execute()
    count = len(results.get("messages", []))
    print(f"Gmail connection successful — found {count} recent messages.")
    print()
    print("Next steps:")
    print(f"1. Copy {CREDENTIALS_FILE} and {TOKEN_FILE} to the Pi:")
    print(f"   scp {CREDENTIALS_FILE} {TOKEN_FILE} pi@homecenter.local:/home/pi/home-center/school-updates/")
    print("2. The NanoClaw agent will use these for scheduled Gmail polling.")


if __name__ == "__main__":
    main()
