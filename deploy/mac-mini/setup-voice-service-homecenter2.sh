#!/usr/bin/env bash
set -euo pipefail

USER_HOME="${USER_HOME:-$(dscl . -read "/Users/$(id -un)" NFSHomeDirectory | awk '{print $2}')}"
REPO="${REPO:-$USER_HOME/home-center}"
WORKER_TOKEN="${WORKER_TOKEN:-}"
OPENCLAW_CHAT_ID="${OPENCLAW_CHAT_ID:-${TELEGRAM_CHAT_ID:-}}"
PLIST="$USER_HOME/Library/LaunchAgents/com.homecenter.voice.homecenter2.plist"

if [ ! -x "$REPO/voice-service/.venv/bin/python3" ]; then
  echo "voice-service venv is missing; run deploy/mac-mini/setup-voice-service.sh first" >&2
  exit 1
fi

mkdir -p "$REPO/voice-service/logs" "$USER_HOME/Library/LaunchAgents"

sed \
  -e "s#__REPO__#$REPO#g" \
  -e "s#__WORKER_TOKEN__#$WORKER_TOKEN#g" \
  -e "s#__OPENCLAW_CHAT_ID__#$OPENCLAW_CHAT_ID#g" \
  "$REPO/deploy/mac-mini/com.homecenter.voice-homecenter2.plist" > "$PLIST"
chmod 600 "$PLIST"

launchctl bootout "gui/$(id -u)/com.homecenter.voice.homecenter2" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/com.homecenter.voice.homecenter2"
launchctl list | grep com.homecenter.voice.homecenter2 || true
