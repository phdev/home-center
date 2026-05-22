#!/usr/bin/env bash
#
# deploy/mac-mini/setup-devon-morning.sh
#
# Configure Devon in the OpenClaw Gateway scheduler on the Mac Mini.
# This uses the OpenClaw CLI's Codex-backed agent runtime; it does not
# create a custom tmux/Codex wrapper.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
OPENCLAW_CODEX_BIN="${OPENCLAW_CODEX_BIN:-$(command -v openclaw || true)}"
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/opt/homebrew/sbin:$PATH"
export PATH

if [[ -z "$OPENCLAW_CODEX_BIN" ]]; then
  echo "error: OpenClaw CLI not found." >&2
  echo "Set OPENCLAW_CODEX_BIN to the absolute OpenClaw CLI path and rerun." >&2
  exit 1
fi

case "$OPENCLAW_CODEX_BIN" in
  /*) ;;
  *)
    echo "error: OPENCLAW_CODEX_BIN must be an absolute path: $OPENCLAW_CODEX_BIN" >&2
    exit 1
    ;;
esac

cd "$REPO_DIR"
mkdir -p docs/status

node scripts/validate_devon_config.js
bash scripts/devon_index_project.sh >/dev/null

if "$OPENCLAW_CODEX_BIN" agents list --json | python3 -c 'import json,sys; raise SystemExit(0 if any(a.get("id")=="devon" for a in json.load(sys.stdin)) else 1)'; then
  echo "Devon agent already exists; refreshing identity."
else
  "$OPENCLAW_CODEX_BIN" agents add devon \
    --workspace "$REPO_DIR" \
    --model openai-codex/gpt-5.5 \
    --non-interactive \
    --json >/dev/null
fi

"$OPENCLAW_CODEX_BIN" agents set-identity \
  --agent devon \
  --name Devon \
  --emoji "🛠️" \
  --json >/dev/null

prompt="$(python3 -c 'import json; print(json.load(open("openclaw/tasks/devon-morning-brief.json"))["prompt"])')"

job_json="$("$OPENCLAW_CODEX_BIN" cron show devon-morning-brief --json 2>/dev/null || true)"
job_id="$(printf '%s' "$job_json" | python3 -c 'import json,sys; text=sys.stdin.read().strip(); print(json.loads(text).get("id","") if text else "")')"

if [[ -n "$job_id" ]]; then
  "$OPENCLAW_CODEX_BIN" cron edit "$job_id" \
    --description "Devon daily PM morning brief" \
    --agent devon \
    --cron "15 8 * * *" \
    --tz America/Los_Angeles \
    --message "$prompt" \
    --model openai-codex/gpt-5.5 \
    --thinking medium \
    --timeout-seconds 900 \
    --expect-final \
    --no-deliver \
    --tools exec,read \
    --enable >/dev/null
else
  "$OPENCLAW_CODEX_BIN" cron add \
    --name devon-morning-brief \
    --description "Devon daily PM morning brief" \
    --agent devon \
    --cron "15 8 * * *" \
    --tz America/Los_Angeles \
    --message "$prompt" \
    --model openai-codex/gpt-5.5 \
    --thinking medium \
    --timeout-seconds 900 \
    --expect-final \
    --no-deliver \
    --tools exec,read \
    --json >/dev/null
fi

echo "Devon OpenClaw agent and morning cron are active:"
"$OPENCLAW_CODEX_BIN" agents list --json | python3 -c 'import json,sys; print(json.dumps([a for a in json.load(sys.stdin) if a.get("id")=="devon"], indent=2))'
"$OPENCLAW_CODEX_BIN" cron show devon-morning-brief --json
