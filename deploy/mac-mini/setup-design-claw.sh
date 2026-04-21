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

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
PLIST="$LAUNCH_DIR/com.homecenter.design-claw.plist"

echo "Repo:   $REPO_DIR"
echo "Plist:  $PLIST"
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

# ─── 2. Install the one runtime dependency ───────────────────────────
"$PYTHON_BIN" -m pip install --quiet --upgrade openai

# ─── 3. Ensure output directory exists (launchd writes its logs here) ─
mkdir -p "$LAUNCH_DIR" "$REPO_DIR/design_outputs/daily" "$REPO_DIR/design_outputs/weekly"

# ─── 4. Render plist from template ───────────────────────────────────
esc() { printf '%s' "$1" | sed -e 's/[\/&|]/\\&/g'; }

sed \
    -e "s|__REPO_DIR__|$(esc "$REPO_DIR")|g" \
    -e "s|__PYTHON_BIN__|$(esc "$PYTHON_BIN")|g" \
    -e "s|__OPENAI_API_KEY__|$(esc "$OPENAI_API_KEY")|g" \
    -e "s|__TELEGRAM_BOT_TOKEN__|$(esc "$TELEGRAM_BOT_TOKEN")|g" \
    -e "s|__TELEGRAM_CHAT_ID__|$(esc "$TELEGRAM_CHAT_ID")|g" \
    "$SCRIPT_DIR/com.homecenter.design-claw.plist" > "$PLIST"

chmod 600 "$PLIST"
plutil -lint "$PLIST"

# ─── 5. (Re)load launchd agent ───────────────────────────────────────
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo ""
echo "Design Claw launchd agent loaded."
echo "  Daily at 08:15 local."
echo "  Logs: $REPO_DIR/design_outputs/.launchd.{stdout,stderr}.log"
echo ""
echo "Test-fire once now? (optional — sends a real Telegram digest):"
echo "  launchctl start com.homecenter.design-claw"
echo "  tail -f $REPO_DIR/design_outputs/.launchd.stderr.log"
