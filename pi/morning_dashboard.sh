#!/usr/bin/env bash
set -euo pipefail

# Weekday school-runway wakeup: turn on the TV if needed and make this Pi the
# active HDMI-CEC source. Guard the window so a delayed timer does not fire late.
export TZ="${TZ:-America/Los_Angeles}"
day="$(date +%u)"
hour="$(date +%H)"
minute="$(date +%M)"
total_minutes=$((10#$hour * 60 + 10#$minute))
start_minutes=$((7 * 60 + 50))
end_minutes=$((8 * 60 + 30))
navigate_url="${MORNING_DASHBOARD_NAVIGATE_URL:-http://127.0.0.1:8765/api/navigate}"

reset_dashboard_navigation() {
  if curl -fsS --max-time 2 \
    -H "Content-Type: application/json" \
    -d '{"page":"dashboard","view":null}' \
    "$navigate_url" >/dev/null; then
    echo "Reset dashboard navigation state."
  else
    echo "Warning: failed to reset dashboard navigation state at $navigate_url." >&2
  fi
}

if (( day > 5 || total_minutes < start_minutes || total_minutes >= end_minutes )); then
  echo "Outside weekday morning dashboard window; skipping HDMI-CEC activation."
  exit 0
fi

reset_dashboard_navigation
"$(dirname "$0")/cec_control.sh" on
