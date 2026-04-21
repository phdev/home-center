#!/usr/bin/env bash
# Install the Home Center voice service on a Mac mini.
#
# Usage:
#   export WORKER_URL="https://home-center-api.<you>.workers.dev"
#   export WORKER_TOKEN="..."          # optional
#   export MIC_HOST="homecenter.local" # Pi hostname
#   export WHISPER_MODEL="medium.en"   # or base.en, small.en, large-v3
#   bash deploy/mac-mini/setup-voice-service.sh
#
# Creates a venv under voice-service/.venv, installs deps, renders the
# launchd plist, and loads it. Safe to re-run.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV_DIR="$REPO_DIR/voice-service/.venv"
PLIST_SRC="$REPO_DIR/deploy/mac-mini/com.homecenter.voice.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.homecenter.voice.plist"
LOG_DIR="$REPO_DIR/voice-service/logs"

MIC_HOST="${MIC_HOST:-homecenter.local}"
WORKER_URL="${WORKER_URL:-}"
WORKER_TOKEN="${WORKER_TOKEN:-}"
WHISPER_MODEL="${WHISPER_MODEL:-medium.en}"

echo "==> Setting up voice-service in $REPO_DIR"

mkdir -p "$LOG_DIR"

if [ ! -d "$VENV_DIR" ]; then
  echo "==> Creating venv at $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

echo "==> Installing Python dependencies"
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$REPO_DIR/voice-service/requirements.txt"

PYTHON_PATH="$VENV_DIR/bin/python3"

echo "==> Rendering launchd plist → $PLIST_DST"
sed \
  -e "s|__REPO_DIR__|$REPO_DIR|g" \
  -e "s|__PYTHON_PATH__|$PYTHON_PATH|g" \
  -e "s|__MIC_HOST__|$MIC_HOST|g" \
  -e "s|__WORKER_URL__|$WORKER_URL|g" \
  -e "s|__WORKER_TOKEN__|$WORKER_TOKEN|g" \
  -e "s|__WHISPER_MODEL__|$WHISPER_MODEL|g" \
  "$PLIST_SRC" > "$PLIST_DST"

echo "==> Reloading launchd agent"
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"

echo "==> Done. Logs:"
echo "    tail -f $LOG_DIR/voice-stdout.log"
echo "    tail -f $LOG_DIR/voice-stderr.log"
