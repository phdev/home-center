#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
LOG_DIR="$REPO/logs"
STATUS_PATH="$LOG_DIR/openclaw-devon-health-status.json"
LAST_OUTPUT="$LOG_DIR/openclaw-devon-health-last.json"
PATH="/opt/homebrew/bin:/opt/homebrew/opt/node/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$LOG_DIR"
cd "$REPO"

TMP_OUTPUT="$(mktemp)"
if npm run monitor:openclaw-devon -- --repair --json >"$TMP_OUTPUT" 2>&1; then
  cp "$TMP_OUTPUT" "$LAST_OUTPUT"
  python3 - "$TMP_OUTPUT" "$STATUS_PATH" <<'PY'
import json
import sys
from pathlib import Path

raw = Path(sys.argv[1]).read_text(errors="replace")
start = raw.find("{")
payload = json.loads(raw[start:]) if start >= 0 else {"ok": True}
Path(sys.argv[2]).write_text(json.dumps(payload, indent=2) + "\n")
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
    "message": "OpenClaw Devon health check failed",
    "outputTail": raw[-4000:],
}
Path(sys.argv[2]).write_text(json.dumps(summary, indent=2) + "\n")
PY

osascript -e 'display notification "Run logs/openclaw-devon-health-last.json for details." with title "OpenClaw Devon monitor failed"' >/dev/null 2>&1 || true
rm -f "$TMP_OUTPUT"
exit 1
