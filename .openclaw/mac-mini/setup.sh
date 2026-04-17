#!/usr/bin/env bash
set -euo pipefail

# Mac Mini Setup Script for OpenClaw + Homer CI
#
# Run this once on the new Mac Mini after cloning the repo:
#   git clone https://github.com/phdev/accel-driv.git home-center
#   cd home-center
#   bash .openclaw/mac-mini/setup.sh
#
# Prerequisites:
#   - macOS with Homebrew installed
#   - Git configured
#   - Node.js (LTS) installed

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST_DIR="$REPO_ROOT/.openclaw/mac-mini/plists"
LAUNCH_DIR="$HOME/Library/LaunchAgents"

echo "=== Mac Mini Setup for Home Center ==="
echo "Repo: $REPO_ROOT"
echo ""

# --- 1. System dependencies ---
echo "--- Installing dependencies ---"

if ! command -v brew &>/dev/null; then
  echo "ERROR: Homebrew not found. Install it first: https://brew.sh"
  exit 1
fi

# Node.js (for OpenClaw bridge)
if ! command -v node &>/dev/null; then
  echo "Installing Node.js..."
  brew install node
fi

# Python 3 (for email-triage, school-updates, detect-tasks)
if ! command -v python3 &>/dev/null; then
  echo "Installing Python 3..."
  brew install python@3
fi

# tmux (for agent sessions)
if ! command -v tmux &>/dev/null; then
  echo "Installing tmux..."
  brew install tmux
fi

# GitHub CLI (for PR management)
if ! command -v gh &>/dev/null; then
  echo "Installing GitHub CLI..."
  brew install gh
fi

# Claude Code CLI
if ! command -v claude &>/dev/null; then
  echo "WARNING: Claude Code CLI not found. Install it: npm install -g @anthropic-ai/claude-code"
fi

echo "Dependencies OK"
echo ""

# --- 2. OpenClaw (real project — https://openclaw.ai) ---
echo "--- Installing OpenClaw ---"

# Install OpenClaw globally
if ! command -v openclaw &>/dev/null; then
  echo "Installing OpenClaw..."
  npm install -g openclaw@latest
else
  echo "OpenClaw already installed: $(openclaw --version 2>/dev/null || echo 'unknown version')"
fi

# Run onboarding if not already configured
OPENCLAW_DIR="$HOME/.openclaw"
if [ ! -f "$OPENCLAW_DIR/openclaw.json" ]; then
  echo ""
  echo "Running OpenClaw onboarding..."
  echo "This will set up your model provider, API key, and Gateway daemon."
  openclaw onboard --install-daemon
else
  echo "OpenClaw already configured at $OPENCLAW_DIR"
fi

# Install Telegram plugin (replaces the former WhatsApp plugin)
echo "Installing OpenClaw Telegram plugin..."
openclaw plugins install @openclaw/telegram 2>/dev/null || echo "WARNING: Telegram plugin install failed — run manually: openclaw plugins install @openclaw/telegram"

# Link family-assistant skill
echo "Linking family-assistant skill..."
SKILL_SRC="$REPO_ROOT/.openclaw/skills/family-assistant"
SKILL_DST="$OPENCLAW_DIR/skills/family-assistant"
mkdir -p "$OPENCLAW_DIR/skills"
if [ -L "$SKILL_DST" ]; then
  rm "$SKILL_DST"
fi
ln -sf "$SKILL_SRC" "$SKILL_DST"
echo "Skill linked: $SKILL_DST → $SKILL_SRC"

echo "OpenClaw setup complete"
echo ""

# --- 2b. Telegram bridge (for Homer CI transport) ---
echo "--- Setting up Telegram bridge (Homer CI transport) ---"

cd "$REPO_ROOT/openclaw"
npm install
echo "Telegram bridge dependencies installed (Homer CI uses this for dev notifications)"
echo "Remember to set TELEGRAM_BOT_TOKEN in the bridge plist before loading it."
echo ""

# --- 3. Email triage ---
echo "--- Setting up email-triage ---"

cd "$REPO_ROOT/email-triage"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -q -r requirements.txt 2>/dev/null || echo "WARNING: email-triage pip install failed (may need credentials first)"
echo "Email triage venv ready"
echo ""

# --- 4. School updates ---
echo "--- Setting up school-updates ---"

cd "$REPO_ROOT/school-updates"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -q -r requirements.txt 2>/dev/null || echo "WARNING: school-updates pip install failed (may need credentials first)"
echo "School updates venv ready"
echo ""

# --- 5. Homer CI context ---
echo "--- Generating Homer CI module map ---"

cd "$REPO_ROOT"
mkdir -p .openclaw/{logs,context}
bash .openclaw/scripts/build-context.sh
echo ""

# --- 6. Install launchd services ---
echo "--- Installing launchd services ---"

mkdir -p "$LAUNCH_DIR"

for plist in "$PLIST_DIR"/*.plist; do
  [ -f "$plist" ] || continue
  name=$(basename "$plist")
  dest="$LAUNCH_DIR/$name"

  # Replace __REPO_DIR__ and __USER__ placeholders
  sed -e "s|__REPO_DIR__|$REPO_ROOT|g" \
      -e "s|__USER__|$(whoami)|g" \
      -e "s|__HOME__|$HOME|g" \
      "$plist" > "$dest"

  echo "Installed: $dest"
done

echo ""

# --- 7. SSH key for Pi access ---
echo "--- SSH setup ---"

if [ ! -f "$HOME/.ssh/id_ed25519" ] && [ ! -f "$HOME/.ssh/id_rsa" ]; then
  echo "No SSH key found. Generating one..."
  ssh-keygen -t ed25519 -f "$HOME/.ssh/id_ed25519" -N "" -C "macmini-homecenter"
  echo ""
  echo "Copy this public key to the Pi:"
  echo "  ssh-copy-id -i ~/.ssh/id_ed25519.pub pi@homecenter.local"
else
  echo "SSH key exists. Make sure the Pi trusts it:"
  echo "  ssh-copy-id pi@homecenter.local"
fi

echo ""

# --- 8. Final instructions ---
cat << 'EOF'
=== Setup Complete ===

Before starting services, you need to:

1. Connect OpenClaw to Telegram:
   # Create a bot via @BotFather on Telegram and copy the bot token, then:
   openclaw channels login --channel telegram
   # Paste the bot token when prompted.

2. Verify the family-assistant skill is loaded:
   openclaw skills list
   # Should show "family-assistant" with the 🏠 emoji

3. Set up OpenClaw cron jobs for family context:
   openclaw cron add --name "family-context" \
     --schedule "0 7,12,17 * * *" \
     --session isolated \
     --message "Run: bash ~/.openclaw/skills/family-assistant/fetch-context.sh"

4. Set your Homer CI Telegram chat ID (for dev notifications):
   - Create a bot via @BotFather and set TELEGRAM_BOT_TOKEN on the bridge plist.
   - Start the bridge: TELEGRAM_BOT_TOKEN=... node openclaw/index.js --port 3100
   - Message the bot, then fetch your numeric chat ID via:
       curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
     and copy the "chat.id" value.
   - Edit each plist in ~/Library/LaunchAgents/ and replace REPLACE_WITH_YOUR_CHAT_ID

5. Copy Gmail credentials (for email-triage + school-updates):
   - Copy credentials.json and token.json to email-triage/ and school-updates/
   - Or run: python3 school-updates/setup_gmail.py

6. Authenticate GitHub CLI:
   gh auth login

7. Set the Mac Mini hostname (optional but recommended):
   sudo scutil --set HostName macmini
   sudo scutil --set LocalHostName macmini

8. Start services:
   # OpenClaw Gateway (manages Telegram, skills, cron — replaces the old bridge for family use)
   openclaw gateway start

   # Homer CI + Telegram bridge (dev automation)
   launchctl load ~/Library/LaunchAgents/com.openclaw.bridge.plist
   launchctl load ~/Library/LaunchAgents/com.homerci.daemon.plist

   # Background services
   launchctl load ~/Library/LaunchAgents/com.homecenter.email-triage.plist
   launchctl load ~/Library/LaunchAgents/com.homecenter.school-updates.plist

9. Verify:
   openclaw gateway status                    # OpenClaw Gateway
   openclaw skills list                       # Skills (should show family-assistant)
   curl http://localhost:3100/status           # Telegram bridge (Homer CI)
   tail -f .openclaw/audit.log                # Homer CI audit trail

10. Test the family assistant:
    Send a Telegram message to the bot: "What's on the calendar today?"
    OpenClaw should respond using the family-assistant skill.

EOF
