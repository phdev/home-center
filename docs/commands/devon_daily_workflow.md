# Devon Daily Workflow

Use this prompt for a daily Devon leverage pass over Home Center. It can be
invoked manually, through OpenClaw, through cron, or through a macOS
LaunchAgent. This file documents the automation prompt only; it does not
install or enable any scheduler.

Suggested schedule: daily at 7:00am local time.

## Daily Prompt

```text
Devon, run the Home Center daily leverage workflow using the documented gstack + OpenClaw process.

Today's goal is not only QA. It is to evaluate whether the gstack workflow materially improves Home Center development quality, speed, clarity, and architectural discipline.

Select 1-2 high-leverage gstack workflows appropriate for the current repo state.
Prefer the Devon skill map below when choosing workflows; do not treat every
command as equally appropriate.

Preferred Devon skills:
- /office-hours for weekly product framing
- /plan-ceo-review for major direction decisions
- /autoplan for scoped work planning
- /plan-eng-review before implementation
- /plan-eng-review before any design output becomes deterministic card behavior
- /review before merge
- /qa-only for architecture/derived-state validation
- /qa and /browse for visual/browser validation
- /pair-agent when coordinating David
- /codex for scoped implementation
- /retro weekly
- /cso before permission/security-sensitive releases
- /ship later, once release flow is mature

Review:
- recent commits
- active branches
- unfinished work
- UI polish opportunities
- workflow friction
- architectural risks
- stale experiments
- eval/test gaps
- repo health
- opportunities for David
- opportunities for Codex

Run only lightweight scoped work unless explicitly asked.

You may:
- identify UX problems, UI risks, design-readiness gaps, and product/architecture
  alignment issues
- delegate meaningful visual exploration, kiosk UX refinement, frontend
  presentation work, and UI/design review to David
- generate design artifacts atomically as one coherent artifact set
- generate scoped implementation plans
- recommend cleanup/refactors
- identify architectural drift
- identify missing eval coverage
- recommend workflow improvements
- archive stale work conceptually

You must preserve:
raw data -> derived state -> UI presentation

Do not:
- change runtime behavior without approval
- publish partial daily design artifacts or update `.last_daily` before the
  generated artifact set is coherent
- merge branches automatically
- deploy to the Pi
- invent new architecture layers
- allow presentation agents to own decision logic
- act as the primary design exploration agent
- generate speculative UI redesigns by default
- create unsolicited visual concepts
- bypass David for meaningful presentation exploration
- treat presentation ideas as approved behavior
- convert a design output into card visibility, priority, suppression, ordering,
  or fallback behavior until `/plan-eng-review` has accepted the derived-state
  contract, tests, and docs impact

Produce:
- workflows exercised today
- whether they were genuinely useful
- useful findings
- noise/problems
- workflow friction observations
- whether David added value
- whether Codex added value
- whether the workflow reduced cognitive load
- whether architecture boundaries remained healthy
- recommended follow-up actions
- recommendation:
  - keep workflow
  - modify workflow
  - stop workflow
```

## Operating Flow

1. Devon reviews branch/repo state.
2. Devon runs a lightweight QA pass.
3. Devon checks whether any UI/card flow needs David.
4. If yes, Devon delegates to David using the documented agent-mode gstack
   prompts. Devon frames the problem, risks, constraints, and acceptance
   criteria; David owns meaningful presentation exploration.
5. David may produce design artifacts, but generation must be atomic: stage the
   Markdown/JSON/render outputs first, then publish the coherent set and update
   pointers/logs after the set is complete.
6. Devon classifies any design behavior proposal. If it would affect
   deterministic card visibility, priority, suppression, ordering, fallback
   copy, reminder timing, or derived-state flags, Devon must run
   `/plan-eng-review` before implementation planning or Codex work.
7. David proposes or implements scoped UI-only changes only after that boundary
   is clear.
8. Devon runs `/qa-only` style validation.
9. Codex is used only as the repo-editing harness.
10. Nothing merges without tests/gates and derived-state review.

## Devon Skill Preferences

- `/office-hours` for weekly product framing.
- `/plan-ceo-review` for major direction decisions.
- `/autoplan` for scoped work planning.
- `/plan-eng-review` before implementation.
- `/plan-eng-review` before design output becomes deterministic card behavior.
- `/review` before merge.
- `/qa-only` for architecture/derived-state validation.
- `/qa` and `/browse` for visual/browser validation.
- `/pair-agent` when coordinating David.
- `/codex` for scoped implementation.
- `/retro` weekly.
- `/cso` before permission/security-sensitive releases.
- `/ship` later, once release flow is mature.

## Examples

Manual:

```text
Devon, run the Home Center daily leverage workflow using docs/commands/devon_daily_workflow.md.
```

OpenClaw-style recurring task:

```text
Every day at 7:00am, run the Home Center daily Devon leverage workflow.
```

macOS LaunchAgent concept:

If later automated through LaunchAgent, the job should invoke Devon/OpenClaw
from the Mac mini and SSH into the MacBook Pro repo only as needed.

## Automation Note

This repo documents the daily automation prompt, but does not install or enable
a scheduler unless explicitly requested. Devon/OpenClaw should wire this into
the Mac mini scheduler separately.
