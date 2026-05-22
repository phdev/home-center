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

cec_send() {
  echo "$1" | cec-client -s -d 1 2>/dev/null
}

case "$CMD" in
  on)
    echo "Turning TV on..."
    cec_send "on 0"
    sleep 1
    cec_send "as"
    echo "Done. TV should be on and showing this Pi."
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
