#!/usr/bin/env bash
# ==============================================================================
# Chromium Kiosk Launcher for Home Center
#
# Launches Chromium in full-screen kiosk mode pointing at the local Vite
# preview server (production build). Falls back to the dev server if the
# build directory doesn't exist.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
PORT=4173
URL="http://localhost:$PORT/home-center/"

# ---------- Start the web server ----------
if [ -d "$REPO_DIR/dist" ]; then
  # Serve the production build
  cd "$REPO_DIR"
  npx vite preview --host 0.0.0.0 --port "$PORT" &
  SERVER_PID=$!
else
  # Fall back to dev server
  PORT=5173
  URL="http://localhost:$PORT/home-center/"
  cd "$REPO_DIR"
  npm run dev &
  SERVER_PID=$!
fi

# Wait for the server to be ready
for i in $(seq 1 30); do
  if curl -s "http://localhost:$PORT" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# ---------- Hide the cursor ----------
unclutter -idle 0.5 -root &

# ---------- Launch Chromium in kiosk mode ----------
# Remove any crash flags from previous unclean shutdowns
CHROMIUM_DIR="$HOME/.config/chromium"
if [ -d "$CHROMIUM_DIR/Default" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' \
    "$CHROMIUM_DIR/Default/Preferences" 2>/dev/null || true
  sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' \
    "$CHROMIUM_DIR/Default/Preferences" 2>/dev/null || true
fi

exec chromium-browser \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --kiosk \
  --incognito \
  --disable-translate \
  --disable-features=TranslateUI \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  "$URL"
