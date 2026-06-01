#!/usr/bin/env bash
# ==============================================================================
# HDMI-CEC TV Control Helper
#
# Standalone utility for testing CEC commands without the wake word service.
#
# Usage:
#   ./cec_control.sh on      # Turn TV on
#   ./cec_control.sh off     # Turn TV off (standby)
#   ./cec_control.sh status  # Check TV power status
#   ./cec_control.sh active  # Set Pi as active HDMI source
#   ./cec_control.sh scan    # Scan for CEC devices
# ==============================================================================
set -euo pipefail

CMD="${1:-status}"
CEC_POWER_ON_WAIT_SECONDS="${CEC_POWER_ON_WAIT_SECONDS:-20}"
CEC_POWER_ON_POLL_SECONDS="${CEC_POWER_ON_POLL_SECONDS:-2}"

cec_send() {
  echo "$1" | cec-client -s -d 1 2>/dev/null
}

tv_power_status() {
  RESULT=$(echo "pow 0" | cec-client -s -d 1 2>/dev/null)
  if echo "$RESULT" | grep -qi "power status: on"; then
    echo "on"
  elif echo "$RESULT" | grep -qi "power status: standby"; then
    echo "standby"
  elif echo "$RESULT" | grep -qi "power status: in transition"; then
    echo "transition"
  elif echo "$RESULT" | grep -qi "power status: unknown"; then
    echo "unknown"
  else
    echo "unknown"
  fi
}

case "$CMD" in
  on)
    echo "Turning TV on..."
    cec_send "on 0"
    deadline=$((SECONDS + CEC_POWER_ON_WAIT_SECONDS))
    status="unknown"
    while (( SECONDS <= deadline )); do
      cec_send "as"
      status="$(tv_power_status)"
      if [[ "$status" == "on" ]]; then
        echo "Done. TV is on and showing this Pi."
        exit 0
      fi
      if [[ "$status" == "standby" ]]; then
        cec_send "on 0"
      fi
      sleep "$CEC_POWER_ON_POLL_SECONDS"
    done
    echo "Warning: TV did not verify as on after ${CEC_POWER_ON_WAIT_SECONDS}s (status=${status})." >&2
    exit 1
    ;;
  off|standby)
    echo "Sending TV to standby..."
    cec_send "standby 0"
    echo "Done."
    ;;
  status)
    echo "Checking TV power status..."
    RESULT=$(echo "pow 0" | cec-client -s -d 1 2>/dev/null)
    if echo "$RESULT" | grep -qi "power status: on"; then
      echo "TV is ON"
    elif echo "$RESULT" | grep -qi "power status: standby"; then
      echo "TV is in STANDBY"
    elif echo "$RESULT" | grep -qi "power status: in transition"; then
      echo "TV is transitioning power state"
    else
      echo "TV status unknown. Response:"
      echo "$RESULT"
    fi
    ;;
  active)
    echo "Setting Pi as active HDMI source..."
    cec_send "as"
    echo "Done."
    ;;
  scan)
    echo "Scanning CEC bus for devices..."
    echo "scan" | cec-client -s -d 1
    ;;
  *)
    echo "Usage: $0 {on|off|status|active|scan}"
    exit 1
    ;;
esac
