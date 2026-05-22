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

if (( day > 5 || total_minutes < start_minutes || total_minutes >= end_minutes )); then
  echo "Outside weekday morning dashboard window; skipping HDMI-CEC activation."
  exit 0
fi

"$(dirname "$0")/cec_control.sh" on
