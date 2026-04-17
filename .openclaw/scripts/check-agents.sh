#!/usr/bin/env bash
set -euo pipefail

# Homer CI cron monitor: checks agent status, detects PRs, reads CI gate results,
# sends Telegram notifications to your personal chat.
# All reviews and security scans run in GitHub Actions — this script only reads results.
#
# Schedule: */15 6-23 * * *

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TASKS_FILE="$REPO_ROOT/.openclaw/active-tasks.json"
AUDIT_LOG="$REPO_ROOT/.openclaw/audit.log"
NOTIFY_SCRIPT="$REPO_ROOT/.openclaw/scripts/notify-telegram.sh"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] CHECK $*" >> "$AUDIT_LOG"
}

if [ ! -f "$TASKS_FILE" ]; then
  exit 0
fi

cd "$REPO_ROOT"

python3 << 'PYEOF'
import json
import subprocess
import os
import sys
from datetime import datetime, timezone

REPO = os.environ.get("REPO_ROOT", os.getcwd())
tasks_file = os.path.join(REPO, ".openclaw", "active-tasks.json")
notify = os.path.join(REPO, ".openclaw", "scripts", "notify-telegram.sh")
audit_log = os.path.join(REPO, ".openclaw", "audit.log")

def log(msg):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(audit_log, "a") as f:
        f.write(f"[{ts}] CHECK {msg}\n")

def run(cmd, **kwargs):
    return subprocess.run(cmd, capture_output=True, text=True, cwd=REPO, **kwargs)

try:
    data = json.load(open(tasks_file))
except (FileNotFoundError, json.JSONDecodeError):
    sys.exit(0)

changed = False

for task in data["tasks"]:
    if task["status"] not in ("in_progress", "pr_open"):
        continue

    tid = task["id"]
    session = task["tmux_session"]
    branch = task["branch"]

    # Check if tmux session is alive
    alive = run(["tmux", "has-session", "-t", session]).returncode == 0

    if task["status"] == "in_progress":
        if not alive:
            # Agent exited — check if a PR was created
            pr_check = run(["gh", "pr", "list", "--head", branch,
                           "--json", "number,state", "--limit", "1"])
            try:
                prs = json.loads(pr_check.stdout)
            except json.JSONDecodeError:
                prs = []

            if prs and prs[0]["state"] == "OPEN":
                task["status"] = "pr_open"
                task["pr_number"] = prs[0]["number"]
                task["updated_at"] = datetime.now(timezone.utc).isoformat()
                changed = True
                log(f"AGENT_DONE {tid} pr={prs[0]['number']}")
                # CI checks run automatically via GitHub Actions — no local review triggered
            else:
                task["status"] = "agent_exited"
                task["updated_at"] = datetime.now(timezone.utc).isoformat()
                changed = True
                log(f"AGENT_CRASHED {tid}")
                subprocess.run([notify,
                    f"🔴 Homer CI — Agent Exited\n\nTask: {tid}\nBranch: {branch}\n"
                    f"No PR found — agent may have crashed.\n"
                    f"Check logs: .openclaw/logs/{tid}.log"])

    elif task["status"] == "pr_open" and task.get("pr_number"):
        pr_num = task["pr_number"]

        # Read GitHub Actions check results — all verification happens in CI, not locally
        checks = run(["gh", "pr", "checks", str(pr_num),
                      "--json", "name,state,conclusion"])
        try:
            check_list = json.loads(checks.stdout)
        except json.JSONDecodeError:
            check_list = []

        # If checks are still running, skip this task
        if any(c.get("state") == "IN_PROGRESS" for c in check_list):
            log(f"CHECKS_PENDING {tid} pr={pr_num}")
            continue

        # Read gate results from CI
        gates = task["gates"]

        for check in check_list:
            name = check.get("name", "").lower()
            conclusion = check.get("conclusion", "")

            if "build" in name:
                gates["build"] = "passed" if conclusion == "success" else "failed"
            elif "code review" in name or "review" in name:
                gates["review_claude"] = "passed" if conclusion == "success" else "failed"
            elif "security" in name:
                gates["lint"] = "passed" if conclusion == "success" else "failed"

        # Check if all required gates passed
        all_passed = (
            gates.get("build") == "passed" and
            gates.get("review_claude") == "passed" and
            gates.get("lint") != "failed"  # security scan: pass or not-run are both ok
        )

        any_failed = any(v == "failed" for v in gates.values() if v is not None)

        if all_passed and task["status"] != "ready_for_review":
            task["status"] = "ready_for_review"
            task["updated_at"] = datetime.now(timezone.utc).isoformat()
            changed = True
            log(f"READY {tid} pr={pr_num}")

            gate_lines = []
            for g, v in gates.items():
                if v == "passed":
                    gate_lines.append(f"✅ {g}")
                elif v == "failed":
                    gate_lines.append(f"❌ {g}")
            gate_str = "\n".join(gate_lines)

            subprocess.run([notify,
                f"🟢 Homer CI — PR Ready\n\n"
                f"Task: {task['description']}\n"
                f"PR: #{pr_num}\n\n"
                f"Gates:\n{gate_str}\n\n"
                f"https://github.com/phdev/accel-driv/pull/{pr_num}"])

        elif any_failed and task["status"] != "gates_failed":
            task["status"] = "gates_failed"
            task["updated_at"] = datetime.now(timezone.utc).isoformat()
            changed = True
            log(f"GATES_FAILED {tid} pr={pr_num}")

            gate_lines = []
            for g, v in gates.items():
                if v == "passed":
                    gate_lines.append(f"✅ {g}")
                elif v == "failed":
                    gate_lines.append(f"❌ {g}")
            gate_str = "\n".join(gate_lines)

            subprocess.run([notify,
                f"🔴 Homer CI — PR Gates Failed\n\n"
                f"Task: {task['description']}\n"
                f"PR: #{pr_num}\n\n"
                f"Gates:\n{gate_str}\n\n"
                f"https://github.com/phdev/accel-driv/pull/{pr_num}"])

if changed:
    json.dump(data, open(tasks_file, "w"), indent=2)

log("completed")
PYEOF
