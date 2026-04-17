#!/usr/bin/env bash
set -euo pipefail

# Usage: notify-telegram.sh "message text"
# Homer CI dev notifications — sends to your personal Telegram chat.
# Uses the OpenClaw Telegram bridge on the Mac Mini as transport.
#
# Requires:
#   HOMER_CI_CHAT_ID       — your Telegram numeric chat ID (e.g. "123456789")
#   HOMER_CI_OPENCLAW_URL  — OpenClaw bridge URL (default: http://localhost:3100)

MESSAGE="${1:-}"

if [ -z "$MESSAGE" ]; then
  echo "Usage: notify-telegram.sh \"message text\""
  exit 1
fi

CHAT_ID="${HOMER_CI_CHAT_ID:-}"
HOMER_CI_OPENCLAW_URL="${HOMER_CI_OPENCLAW_URL:-http://localhost:3100}"

if [ -z "$CHAT_ID" ]; then
  echo "WARNING: HOMER_CI_CHAT_ID not set, printing message instead:"
  echo "$MESSAGE"
  exit 0
fi

# Check if jq is available
if ! command -v jq &>/dev/null; then
  # Fallback without jq — manual JSON escaping
  ESCAPED_MSG=$(echo "$MESSAGE" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read().strip()))")
  PAYLOAD="{\"chatId\":\"$CHAT_ID\",\"message\":$ESCAPED_MSG}"
else
  PAYLOAD=$(jq -n --arg chatId "$CHAT_ID" --arg message "$MESSAGE" \
    '{chatId: $chatId, message: $message}')
fi

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$HOMER_CI_OPENCLAW_URL/send" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" 2>&1) || true

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "Telegram notification sent"
else
  echo "WARNING: Failed to send Telegram notification (HTTP $HTTP_CODE)"
  echo "$BODY"
fi
