#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
USER_HOME="${USER_HOME:-$(dscl . -read "/Users/$(id -un)" NFSHomeDirectory | awk '{print $2}')}"
REPO="${REPO:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PLIST="$USER_HOME/Library/LaunchAgents/com.homecenter.openclaw-devon-health.plist"
LABEL="com.homecenter.openclaw-devon-health"

mkdir -p "$USER_HOME/Library/LaunchAgents" "$REPO/logs"
chmod +x "$REPO/scripts/openclaw-devon-health-launchd.sh"

sed -e "s#__REPO__#$REPO#g" \
  "$REPO/deploy/mac-mini/com.homecenter.openclaw-devon-health.plist" > "$PLIST"
chmod 600 "$PLIST"
plutil -lint "$PLIST"

"$REPO/scripts/openclaw-devon-health-launchd.sh"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load "$PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null | sed -n '1,50p' || true
