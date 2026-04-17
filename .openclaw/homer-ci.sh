#!/usr/bin/env bash
set -euo pipefail

# Homer CI — Autonomous Dev Orchestrator
#
# Persistent daemon that:
# 1. Polls OpenClaw bridge for incoming Telegram messages from you
# 2. Runs proactive task detection from family context (hourly)
# 3. Uses Claude to plan tasks, write prompts, pick agent type
# 4. Spawns agents, monitors progress, sends Telegram notifications
#
# Usage:
#   bash .openclaw/homer-ci.sh
#   # Or via launchd (see com.homerci.daemon.plist)
#
# Environment:
#   HOMER_CI_CHAT_ID       — your numeric Telegram chat ID (required)
#   HOMER_CI_OPENCLAW_URL  — OpenClaw bridge URL (default: http://localhost:3100)

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$REPO_ROOT/.openclaw/scripts"
AUDIT_LOG="$REPO_ROOT/.openclaw/audit.log"
TASKS_FILE="$REPO_ROOT/.openclaw/active-tasks.json"
CONTEXT_DIR="$REPO_ROOT/.openclaw/context"
OPENCLAW_URL="${HOMER_CI_OPENCLAW_URL:-http://localhost:3100}"
CHAT_ID="${HOMER_CI_CHAT_ID:-}"
POLL_INTERVAL=30        # seconds between message polls
DETECT_INTERVAL=3600    # seconds between proactive task detection
CHECK_INTERVAL=900      # seconds between agent status checks

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] HOMER $*" >> "$AUDIT_LOG"
  echo "[$(date +%H:%M:%S)] $*"
}

notify() {
  bash "$SCRIPTS/notify-telegram.sh" "$1" 2>/dev/null || true
}

# --- Task counter ---
get_next_task_id() {
  local count
  count=$(python3 -c "
import json
try:
    data = json.load(open('$TASKS_FILE'))
    print(len(data.get('tasks', [])) + 1)
except:
    print(1)
")
  printf "task-%03d" "$count"
}

# --- Count active agents ---
active_agent_count() {
  python3 -c "
import json
try:
    data = json.load(open('$TASKS_FILE'))
    count = sum(1 for t in data.get('tasks', []) if t['status'] in ('in_progress', 'pr_open'))
    print(count)
except:
    print(0)
"
}

# --- Plan and spawn a task using Claude ---
plan_and_spawn() {
  local request="$1"

  log "Planning task: $request"

  # Check agent capacity
  local active
  active=$(active_agent_count)
  if [ "$active" -ge 2 ]; then
    log "SKIP — already $active agents running (max 2)"
    notify "⏸️ Homer CI — Queue Full\n\n$active agents already running. Will retry later:\n$request"
    return 1
  fi

  # Generate module map if stale (older than 1 hour)
  if [ ! -f "$CONTEXT_DIR/module-map.md" ] || \
     [ "$(find "$CONTEXT_DIR/module-map.md" -mmin +60 2>/dev/null)" ]; then
    bash "$SCRIPTS/build-context.sh" > /dev/null 2>&1 || true
  fi

  local module_map=""
  if [ -f "$CONTEXT_DIR/module-map.md" ]; then
    module_map=$(cat "$CONTEXT_DIR/module-map.md")
  fi

  local task_id
  task_id=$(get_next_task_id)

  # Ask Claude to plan the task
  local plan
  plan=$(claude --print -p "You are Homer CI, a dev orchestrator for the home-center dashboard.

A task has been requested. Plan it and output EXACTLY this format (no other text):

TASK_TITLE: <short title, no special characters>
BRANCH_SLUG: <lowercase-kebab-case, max 30 chars>
AGENT_TYPE: frontend OR backend
RELEVANT_FILES:
- <file1>
- <file2>
REQUIREMENTS:
<detailed requirements for the agent, 3-10 lines>
PR_TITLE: <short PR title under 70 chars>

Rules for choosing agent type:
- frontend (Claude Code): anything touching src/components/, src/hooks/, src/themes/, src/App.jsx
- backend (Codex): anything touching worker/, pi/, email-triage/, school-updates/, openclaw/

Here is the codebase module map:
$module_map

Task request:
$request" 2>/dev/null) || {
    log "ERROR — Claude planning failed"
    return 1
  }

  # Parse the plan
  local title slug agent_type files requirements pr_title
  title=$(echo "$plan" | grep '^TASK_TITLE:' | sed 's/^TASK_TITLE: *//')
  slug=$(echo "$plan" | grep '^BRANCH_SLUG:' | sed 's/^BRANCH_SLUG: *//')
  agent_type=$(echo "$plan" | grep '^AGENT_TYPE:' | sed 's/^AGENT_TYPE: *//' | tr '[:upper:]' '[:lower:]')
  pr_title=$(echo "$plan" | grep '^PR_TITLE:' | sed 's/^PR_TITLE: *//')

  # Extract files (lines starting with "- " after RELEVANT_FILES:)
  files=$(echo "$plan" | sed -n '/^RELEVANT_FILES:/,/^[A-Z]/p' | grep '^\- ' | sed 's/^\- //')

  # Extract requirements (everything after REQUIREMENTS: until PR_TITLE:)
  requirements=$(echo "$plan" | sed -n '/^REQUIREMENTS:/,/^PR_TITLE:/p' | grep -v '^REQUIREMENTS:' | grep -v '^PR_TITLE:')

  if [ -z "$title" ] || [ -z "$slug" ] || [ -z "$agent_type" ]; then
    log "ERROR — could not parse plan"
    log "Plan output: $plan"
    return 1
  fi

  # Validate agent type
  if [ "$agent_type" != "frontend" ] && [ "$agent_type" != "backend" ]; then
    agent_type="frontend"
  fi

  local branch="openclaw/${task_id}-${slug}"

  log "Planned: $title (${agent_type}, branch: $branch)"

  # Choose template
  local template
  if [ "$agent_type" = "frontend" ]; then
    template="$REPO_ROOT/.openclaw/templates/frontend-agent.md"
  else
    template="$REPO_ROOT/.openclaw/templates/backend-agent.md"
  fi

  # Build the prompt from template
  local prompt_file="/tmp/homer-ci-${task_id}.md"
  local files_formatted
  files_formatted=$(echo "$files" | sed 's/^/- /')

  sed -e "s|{{TASK_TITLE}}|$title|g" \
      -e "s|{{BRANCH}}|$branch|g" \
      -e "s|{{PR_TITLE}}|$pr_title|g" \
      -e "s|{{PR_BODY}}|$title|g" \
      "$template" > "$prompt_file"

  # Replace multi-line placeholders
  python3 -c "
import sys
content = open('$prompt_file').read()
content = content.replace('{{RELEVANT_FILES}}', '''$files_formatted''')
content = content.replace('{{REQUIREMENTS}}', '''$requirements''')
open('$prompt_file', 'w').write(content)
"

  # Notify that we're starting
  notify "🔨 Homer CI — Spawning Agent\n\nTask: $title\nType: $agent_type\nBranch: $branch"

  # Spawn the agent
  log "Spawning agent: $task_id ($agent_type)"
  bash "$SCRIPTS/spawn-agent.sh" "$task_id" "$slug" "$agent_type" "$prompt_file" 2>&1 | \
    while IFS= read -r line; do log "spawn: $line"; done

  log "Agent $task_id spawned successfully"
}

# --- Poll for Telegram messages ---
poll_messages() {
  local response
  response=$(curl -s "$OPENCLAW_URL/messages" 2>/dev/null) || return 0

  local messages
  messages=$(echo "$response" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    msgs = data.get('messages', [])
    for m in msgs:
        # Only process messages from the dev chat
        chat_id = '${CHAT_ID}'
        if chat_id and m['from'] != chat_id:
            continue
        print(m['id'] + '|||' + m['body'])
except:
    pass
" 2>/dev/null) || return 0

  if [ -z "$messages" ]; then
    return 0
  fi

  local ids_to_ack=""

  while IFS= read -r line; do
    local msg_id="${line%%|||*}"
    local msg_body="${line#*|||}"

    if [ -z "$msg_body" ]; then
      continue
    fi

    log "Telegram message: $msg_body"

    # Check for commands
    case "$msg_body" in
      status|Status|STATUS)
        local status_msg
        status_msg=$(python3 -c "
import json
try:
    data = json.load(open('$TASKS_FILE'))
    tasks = data.get('tasks', [])
    active = [t for t in tasks if t['status'] in ('in_progress', 'pr_open')]
    recent = [t for t in tasks if t['status'] in ('ready_for_review', 'gates_failed')][-3:]
    lines = []
    if active:
        lines.append('🔄 Active:')
        for t in active:
            lines.append(f\"  {t['id']}: {t['description']} ({t['status']})\")
    else:
        lines.append('No active agents.')
    if recent:
        lines.append('')
        lines.append('Recent:')
        for t in recent:
            pr = f\" PR #{t.get('pr_number', '?')}\" if t.get('pr_number') else ''
            lines.append(f\"  {t['id']}: {t['description']} ({t['status']}{pr})\")
    print('\n'.join(lines))
except Exception as e:
    print(f'Error reading tasks: {e}')
")
        notify "📊 Homer CI — Status\n\n$status_msg"
        ;;

      stop|Stop|STOP)
        log "Stop command received"
        notify "🛑 Homer CI — Stopping all agents"
        # Kill all agent tmux sessions
        python3 -c "
import json, subprocess
try:
    data = json.load(open('$TASKS_FILE'))
    for t in data['tasks']:
        if t['status'] == 'in_progress':
            subprocess.run(['tmux', 'kill-session', '-t', t['tmux_session']], capture_output=True)
            t['status'] = 'stopped'
    json.dump(data, open('$TASKS_FILE', 'w'), indent=2)
except:
    pass
"
        ;;

      *)
        # Treat as a task request
        plan_and_spawn "$msg_body" || true
        ;;
    esac

    # Build ack list
    if [ -z "$ids_to_ack" ]; then
      ids_to_ack="\"$msg_id\""
    else
      ids_to_ack="$ids_to_ack,\"$msg_id\""
    fi
  done <<< "$messages"

  # Acknowledge processed messages
  if [ -n "$ids_to_ack" ]; then
    curl -s -X POST "$OPENCLAW_URL/messages/ack" \
      -H "Content-Type: application/json" \
      -d "{\"ids\":[$ids_to_ack]}" > /dev/null 2>&1 || true
  fi
}

# --- Main loop ---

main() {
  log "Homer CI starting"
  log "  Repo: $REPO_ROOT"
  log "  OpenClaw: $OPENCLAW_URL"
  log "  Chat ID: ${CHAT_ID:-NOT SET}"
  log "  Poll: ${POLL_INTERVAL}s / Check: ${CHECK_INTERVAL}s / Detect: ${DETECT_INTERVAL}s"

  if [ -z "$CHAT_ID" ]; then
    echo "WARNING: HOMER_CI_CHAT_ID not set — will process all incoming messages"
  fi

  notify "🟢 Homer CI is online\n\nCommands:\n• Send a feature request to spawn an agent\n• \"status\" — check active agents\n• \"stop\" — kill all running agents"

  local last_check=0
  local last_detect=0
  local counter=0

  # Handle shutdown gracefully
  trap 'log "Homer CI shutting down"; notify "🔴 Homer CI is offline"; exit 0' INT TERM

  while true; do
    local now
    now=$(date +%s)

    # Poll for Telegram messages
    poll_messages

    # Check agent status (every CHECK_INTERVAL)
    if [ $((now - last_check)) -ge $CHECK_INTERVAL ]; then
      bash "$SCRIPTS/check-agents.sh" 2>/dev/null || true
      last_check=$now
    fi

    # Proactive task detection (every DETECT_INTERVAL)
    if [ $((now - last_detect)) -ge $DETECT_INTERVAL ]; then
      log "Running proactive task detection"
      bash "$SCRIPTS/detect-tasks.sh" > /dev/null 2>&1 || true

      # Check if there are suggestions and no active agents
      local active
      active=$(active_agent_count)
      if [ "$active" -eq 0 ] && [ -f "$CONTEXT_DIR/family-context.md" ]; then
        local suggestions
        suggestions=$(grep -A2 '^### Task:' "$CONTEXT_DIR/family-context.md" 2>/dev/null | head -20 || true)
        if [ -n "$suggestions" ]; then
          notify "💡 Homer CI — Task Suggestions\n\nNo agents running. Found these from family context:\n\n$suggestions\n\nReply with a task to start, or ignore."
        fi
      fi
      last_detect=$now
    fi

    sleep "$POLL_INTERVAL"
  done
}

main "$@"
