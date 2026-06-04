#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
LOG_DIR="$REPO/logs"
STATUS_PATH="$LOG_DIR/homecenter-node-health-status.json"
LAST_OUTPUT="$LOG_DIR/homecenter-node-health-last.json"
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$LOG_DIR"
cd "$REPO"

run_monitor() {
  npm run monitor:homecenters >"$1" 2>&1
}

TMP_OUTPUT="$(mktemp)"
if run_monitor "$TMP_OUTPUT"; then
  cp "$TMP_OUTPUT" "$LAST_OUTPUT"
  python3 - "$STATUS_PATH" <<'PY'
import json
import sys
from datetime import datetime, timezone

Path = __import__("pathlib").Path
Path(sys.argv[1]).write_text(json.dumps({
    "ok": True,
    "checkedAt": datetime.now(timezone.utc).isoformat(),
}, indent=2) + "\n")
PY
  rm -f "$TMP_OUTPUT"
  exit 0
fi

sleep 10
if run_monitor "$TMP_OUTPUT"; then
  cp "$TMP_OUTPUT" "$LAST_OUTPUT"
  python3 - "$STATUS_PATH" <<'PY'
import json
import sys
from datetime import datetime, timezone

Path = __import__("pathlib").Path
Path(sys.argv[1]).write_text(json.dumps({
    "ok": True,
    "checkedAt": datetime.now(timezone.utc).isoformat(),
    "recoveredAfterRetry": True,
}, indent=2) + "\n")
PY
  rm -f "$TMP_OUTPUT"
  exit 0
fi

cp "$TMP_OUTPUT" "$LAST_OUTPUT"
python3 - "$TMP_OUTPUT" "$STATUS_PATH" <<'PY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

raw = Path(sys.argv[1]).read_text(errors="replace")
summary = {
    "ok": False,
    "checkedAt": datetime.now(timezone.utc).isoformat(),
    "message": "Home Center node health check failed",
    "outputTail": raw[-4000:],
}
Path(sys.argv[2]).write_text(json.dumps(summary, indent=2) + "\n")
PY

osascript -e 'display notification "Run logs/homecenter-node-health-last.json for details." with title "Home Center monitor failed"' >/dev/null 2>&1 || true
rm -f "$TMP_OUTPUT"
exit 1
