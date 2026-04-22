#!/usr/bin/env bash
#
# deploy/mac-mini/setup-design-claw.sh
#
# Sanitized, repeatable setup for the Home Center Design Claw daily
# launchd job on the Mac Mini. See docs/design_claw.md for the full story.
#
# Prerequisites:
#   - Homebrew installed
#   - python3 available (system, Homebrew, or pyenv — any absolute path works)
#   - Clone of this repo at $REPO_DIR (defaults to the script's grandparent)
#   - These env vars exported before running:
#       OPENAI_API_KEY         OpenAI API key
#       TELEGRAM_BOT_TOKEN     Design Claw bot token from @BotFather
#                              (NOT the OpenClaw family-bot token)
#       TELEGRAM_CHAT_ID       Your personal DM chat id with the bot
#
# Usage:
#   export OPENAI_API_KEY="sk-..."
#   export TELEGRAM_BOT_TOKEN="<from @BotFather>"
#   export TELEGRAM_CHAT_ID="<numeric chat id>"
#   bash deploy/mac-mini/setup-design-claw.sh

set -euo pipefail

: "${OPENAI_API_KEY:?must be exported before running}"
: "${TELEGRAM_BOT_TOKEN:?must be exported before running}"
: "${TELEGRAM_CHAT_ID:?must be exported before running}"
# Model override — defaults to gpt-5.4-mini. Override by exporting
# DESIGN_CLAW_MODEL before running this script (e.g. to try a newer model
# without editing code). Change later by editing the rendered plist.
DESIGN_CLAW_MODEL="${DESIGN_CLAW_MODEL:-gpt-5.4-mini}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
DAILY_PLIST="$LAUNCH_DIR/com.homecenter.design-claw.plist"
LISTENER_PLIST="$LAUNCH_DIR/com.homecenter.design-claw-listener.plist"

echo "Repo:           $REPO_DIR"
echo "Daily plist:    $DAILY_PLIST"
echo "Listener plist: $LISTENER_PLIST"
echo ""

# ─── 1. Python dependency ────────────────────────────────────────────
PYTHON_BIN="${PYTHON_BIN:-$(command -v python3 || true)}"
if [[ -z "$PYTHON_BIN" ]]; then
  echo "error: python3 not found; install via Homebrew or pyenv, or export PYTHON_BIN" >&2
  exit 1
fi
# Resolve pyenv shims to the real binary — launchd can't invoke shims.
if [[ "$PYTHON_BIN" == *"/.pyenv/shims/"* ]]; then
  PYTHON_BIN="$(pyenv which python3)"
fi
echo "Python: $PYTHON_BIN ($($PYTHON_BIN --version))"

# ─── 2. Install Python runtime deps ──────────────────────────────────
# openai → Responses API client
# playwright + chromium → HTML mockup → PNG screenshot for Telegram digest
"$PYTHON_BIN" -m pip install --quiet --upgrade openai playwright
"$PYTHON_BIN" -m playwright install --with-deps chromium >/dev/null 2>&1 || \
  "$PYTHON_BIN" -m playwright install chromium

# ─── 3. Ensure output directory exists (launchd writes its logs here) ─
mkdir -p "$LAUNCH_DIR" "$REPO_DIR/design_outputs/daily" "$REPO_DIR/design_outputs/weekly"

# ─── 4. Render both plists from templates ────────────────────────────
esc() { printf '%s' "$1" | sed -e 's/[\/&|]/\\&/g'; }

render() {
  local template="$1"
  local output="$2"
  sed \
    -e "s|__REPO_DIR__|$(esc "$REPO_DIR")|g" \
    -e "s|__PYTHON_BIN__|$(esc "$PYTHON_BIN")|g" \
    -e "s|__OPENAI_API_KEY__|$(esc "$OPENAI_API_KEY")|g" \
    -e "s|__TELEGRAM_BOT_TOKEN__|$(esc "$TELEGRAM_BOT_TOKEN")|g" \
    -e "s|__TELEGRAM_CHAT_ID__|$(esc "$TELEGRAM_CHAT_ID")|g" \
    -e "s|__DESIGN_CLAW_MODEL__|$(esc "$DESIGN_CLAW_MODEL")|g" \
    "$template" > "$output"
  chmod 600 "$output"
  plutil -lint "$output"
}

render "$SCRIPT_DIR/com.homecenter.design-claw.plist"           "$DAILY_PLIST"
render "$SCRIPT_DIR/com.homecenter.design-claw-listener.plist"  "$LISTENER_PLIST"

# ─── 5. (Re)load both launchd agents ─────────────────────────────────
for plist in "$DAILY_PLIST" "$LISTENER_PLIST"; do
  launchctl unload "$plist" 2>/dev/null || true
  launchctl load "$plist"
done

echo ""
echo "Design Claw launchd agents loaded:"
echo "  com.homecenter.design-claw          — daily digest at 08:15 local"
echo "  com.homecenter.design-claw-listener — feedback polling every 5 min"
echo ""
echo "Logs:"
echo "  Daily:    $REPO_DIR/design_outputs/.launchd.{stdout,stderr}.log"
echo "  Listener: $REPO_DIR/design_outputs/.launchd-listener.{stdout,stderr}.log"
echo ""
echo "Test-fire the daily now? (sends a real Telegram digest):"
echo "  launchctl start com.homecenter.design-claw"
echo ""
echo "The listener RunAtLoad=true, so it fires immediately after this"
echo "script — send David a message to verify it's alive."
