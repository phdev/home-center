#!/usr/bin/env bash
set -euo pipefail

# Migrate services from Pi to Mac Mini
#
# Run this AFTER setup.sh and AFTER verifying Mac Mini services are working.
# This stops and disables the migrated services on the Pi, leaving only:
#   - home-center-kiosk (display)
#   - wake-word (voice detection + CEC)
#
# Usage:
#   bash .openclaw/mac-mini/migrate-from-pi.sh

PI_HOST="pi@homecenter.local"

echo "=== Migrating services from Pi to Mac Mini ==="
echo ""
echo "This will STOP and DISABLE on the Pi:"
echo "  - openclaw (Telegram bridge → now on Mac Mini)"
echo "  - email-triage (→ now on Mac Mini)"
echo "  - school-updates (→ now on Mac Mini)"
echo "  - llama-server (→ not needed, Mac Mini uses cloud LLM)"
echo ""
echo "The Pi will keep running:"
echo "  - home-center-kiosk (Chromium dashboard display)"
echo "  - wake-word (voice detection + HDMI-CEC)"
echo ""
read -p "Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "--- Stopping Pi services ---"

ssh "$PI_HOST" bash << 'REMOTE'
set -euo pipefail

# Stop and disable services being migrated
for svc in openclaw email-triage school-updates llama-server; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    echo "Stopping $svc..."
    sudo systemctl stop "$svc"
  fi
  if systemctl is-enabled --quiet "$svc" 2>/dev/null; then
    echo "Disabling $svc..."
    sudo systemctl disable "$svc"
  fi
done

# Verify remaining services
echo ""
echo "--- Pi services still running ---"
for svc in home-center-kiosk wake-word; do
  status=$(systemctl is-active "$svc" 2>/dev/null || echo "inactive")
  echo "  $svc: $status"
done

echo ""
echo "--- Pi services stopped ---"
for svc in openclaw email-triage school-updates llama-server; do
  status=$(systemctl is-active "$svc" 2>/dev/null || echo "inactive")
  echo "  $svc: $status"
done
REMOTE

echo ""
echo "--- Updating Pi wake word service ---"

# Update wake word service to know OpenClaw is on the Mac Mini now
# (only needed if wake word sends Telegram notifications directly)
echo "The Pi wake word service still points to the Cloudflare Worker for commands."
echo "No changes needed unless you want voice → Mac Mini direct routing."

echo ""
echo "=== Migration complete ==="
echo ""
echo "Pi is now display-only (kiosk + wake word)."
echo "Mac Mini runs: OpenClaw bridge, Homer CI, email-triage, school-updates."
echo ""
echo "Verify Mac Mini services:"
echo "  curl http://localhost:3100/status"
echo "  launchctl list | grep -E 'openclaw|homerci|homecenter'"
