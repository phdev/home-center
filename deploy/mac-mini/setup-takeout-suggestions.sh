#!/usr/bin/env bash
set -euo pipefail

USER_HOME="${USER_HOME:-$(dscl . -read "/Users/$(id -un)" NFSHomeDirectory | awk '{print $2}')}"
REPO="${REPO:-$USER_HOME/home-center}"
TAKEOUT_GMAIL_ACCOUNTS="${TAKEOUT_GMAIL_ACCOUNTS:-phhowell@gmail.com}"
PLIST="$USER_HOME/Library/LaunchAgents/com.homecenter.takeout-suggestions.plist"

mkdir -p "$REPO/logs" "$USER_HOME/Library/LaunchAgents"

sed \
  -e "s#__REPO__#$REPO#g" \
  -e "s#__HOME__#$USER_HOME#g" \
  -e "s#__TAKEOUT_GMAIL_ACCOUNTS__#$TAKEOUT_GMAIL_ACCOUNTS#g" \
  "$REPO/deploy/mac-mini/com.homecenter.takeout-suggestions.plist" > "$PLIST"
chmod 600 "$PLIST"

launchctl bootout "gui/$(id -u)/com.homecenter.takeout-suggestions" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/com.homecenter.takeout-suggestions"
launchctl list | grep com.homecenter.takeout-suggestions || true
