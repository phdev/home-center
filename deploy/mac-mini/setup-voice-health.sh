#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="${REPO:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
USER_HOME="${USER_HOME:-$(eval echo "~$(id -un)")}"
PLIST="$USER_HOME/Library/LaunchAgents/com.homecenter.voice-health.plist"

mkdir -p "$USER_HOME/Library/LaunchAgents" "$REPO/voice-service/logs"

if [ ! -x "$REPO/voice-service/.venv/bin/python3" ]; then
  echo "voice-service venv is missing; run deploy/mac-mini/setup-voice-service.sh first" >&2
  exit 1
fi

sed -e "s#__REPO__#$REPO#g" \
  "$REPO/deploy/mac-mini/com.homecenter.voice-health.plist" > "$PLIST"
chmod 600 "$PLIST"
plutil -lint "$PLIST"

"$REPO/voice-service/.venv/bin/python3" "$REPO/voice-service/health_check.py"

launchctl bootout "gui/$(id -u)/com.homecenter.voice-health" 2>/dev/null || true
launchctl unload "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load "$PLIST"
launchctl print "gui/$(id -u)/com.homecenter.voice-health" 2>/dev/null | sed -n '1,40p' || true
