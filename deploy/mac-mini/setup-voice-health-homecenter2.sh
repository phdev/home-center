#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
USER_HOME="${USER_HOME:-$(dscl . -read "/Users/$(id -un)" NFSHomeDirectory | awk '{print $2}')}"
REPO="${REPO:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PLIST="$USER_HOME/Library/LaunchAgents/com.homecenter.voice-health.homecenter2.plist"
LABEL="com.homecenter.voice-health.homecenter2"

mkdir -p "$USER_HOME/Library/LaunchAgents" "$REPO/voice-service/logs"

if [ ! -x "$REPO/voice-service/.venv/bin/python3" ]; then
  echo "voice-service venv is missing; run deploy/mac-mini/setup-voice-service.sh first" >&2
  exit 1
fi

sed -e "s#__REPO__#$REPO#g" \
  "$REPO/deploy/mac-mini/com.homecenter.voice-health-homecenter2.plist" > "$PLIST"
chmod 600 "$PLIST"
plutil -lint "$PLIST"

VOICE_LAUNCHD_LABEL="com.homecenter.voice.homecenter2" \
PI_COMMAND_URL="http://homecenter2.local:8765" \
VOICE_RELIABILITY_LOG="$REPO/voice-service/logs/voice-reliability-homecenter2.jsonl" \
VOICE_HEALTH_STATUS_PATH="$REPO/voice-service/logs/voice-health-status-homecenter2.json" \
"$REPO/voice-service/.venv/bin/python3" "$REPO/voice-service/health_check.py"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load "$PLIST"
launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null | sed -n '1,40p' || true
