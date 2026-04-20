#!/usr/bin/env bash
#
# deploy/mac-mini/setup-openclaw-bridge.sh
#
# Sanitized, repeatable setup for the OpenClaw Telegram bridge on a Mac Mini.
# Covers ONLY the Home Center product integration. Personal developer-agent
# orchestration (Homer CI, PR review automation, etc.) lives outside this repo.
#
# Prerequisites:
#   - Homebrew installed
#   - Telegram bot token from @BotFather exported as TELEGRAM_BOT_TOKEN
#   - Home Center Cloudflare Worker URL exported as WORKER_URL
#   - Clone of this repo at $REPO_DIR (defaults to the script's grandparent)
#
# Usage:
#   export TELEGRAM_BOT_TOKEN="<token>"
#   export WORKER_URL="https://home-center-api.<you>.workers.dev"
#   bash deploy/mac-mini/setup-openclaw-bridge.sh

set -euo pipefail

: "${TELEGRAM_BOT_TOKEN:?must be exported before running}"
: "${WORKER_URL:?must be exported before running, e.g. https://home-center-api.<you>.workers.dev}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
PLIST="$LAUNCH_DIR/com.openclaw.bridge.plist"

echo "Repo:   $REPO_DIR"
echo "Plist:  $PLIST"
echo ""

# ─── 1. Dependencies ─────────────────────────────────────────────────
command -v brew  >/dev/null || { echo "Install Homebrew first: https://brew.sh" >&2; exit 1; }
command -v node  >/dev/null || brew install node
command -v gh    >/dev/null || brew install gh

NODE_PATH="$(command -v node)"
echo "Node:   $NODE_PATH ($(node --version))"

# ─── 2. Install bridge dependencies ──────────────────────────────────
(cd "$REPO_DIR/openclaw" && npm install)

# ─── 3. Render plist from template ───────────────────────────────────
mkdir -p "$LAUNCH_DIR" "$REPO_DIR/openclaw/logs"
# Escape replacement strings for sed
esc() { printf '%s' "$1" | sed -e 's/[\/&|]/\\&/g'; }

sed \
    -e "s|__REPO_DIR__|$(esc "$REPO_DIR")|g" \
    -e "s|__NODE_PATH__|$(esc "$NODE_PATH")|g" \
    -e "s|__TELEGRAM_BOT_TOKEN__|$(esc "$TELEGRAM_BOT_TOKEN")|g" \
    -e "s|__WORKER_URL__|$(esc "$WORKER_URL")|g" \
    "$SCRIPT_DIR/com.openclaw.bridge.plist" > "$PLIST"

chmod 600 "$PLIST"
plutil -lint "$PLIST"

# ─── 4. (Re)load launchd agent ───────────────────────────────────────
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load   "$PLIST"

# ─── 5. Smoke test ───────────────────────────────────────────────────
sleep 3
if curl -sf http://localhost:3100/status | grep -q '"ready":true'; then
    echo ""
    echo "✅ Bridge is live. /status reports ready."
    curl -s http://localhost:3100/status
    echo ""
else
    echo "⚠️  Bridge didn't report ready — check $REPO_DIR/openclaw/logs/" >&2
    exit 1
fi
