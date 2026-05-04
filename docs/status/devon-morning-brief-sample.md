# Devon Morning Brief

Date: 2026-05-03

## Current project state
- Branch: `claude/voice-reliability-rewrite` behind `origin/main` by 1 commit.
- Latest commit: `eaca225` - Wire deterministic state intervention engine.
- Dirty files: existing voice/reliability work plus Devon config, docs, task, validator, and project index artifacts.
- Test status: `npm run validate:devon` passed. Full `npm test` and `npm run build` still need to run after review.

## What changed recently
- Devon was added as a non-family-facing OpenClaw agent configured for the Codex runtime.
- Devon operating rules, morning task config, launchd template, project index script, validator, and PM docs were added.
- Existing uncommitted voice/reliability changes are present and should be reviewed separately from Devon.

## David design ideas reviewed
- Reviewed existing David artifact locations: `design_outputs/daily/`, `design_outputs/weekly/`, and `design_memory/`.
- Latest daily artifact available: `design_outputs/daily/2026-04-21-dashboard-morning.md`.

## Build-worthy opportunities
- Build now: none without Peter approval.
- Consider later: translate the latest dashboard-morning concept into scoped implementation tasks after product review.
- Needs product decision: whether any David concept should affect card priority or layout, because that touches family-facing UI behavior.

## Recommended next steps
1. Review and separate the pre-existing voice/reliability work from the Devon-only change set.
2. Run `npm test` and `npm run build` after the worktree scope is confirmed.
3. Confirm the OpenClaw Codex harness command path before installing `com.homecenter.devon-morning`.
4. Review David's latest daily concept and decide whether Devon should write an implementation plan.

## Best next action
- Run the full test/build gate after confirming the mixed worktree is intentional.

## Risks / blockers
- The repo has many pre-existing uncommitted voice/reliability changes; they increase merge-review risk for a Devon-only PR.
- The branch is behind `origin/main` by 1 commit.
- The actual OpenClaw Codex harness binary path is not validated until Mac Mini setup.

## Needs Peter's decision
- Approve installing Devon's 08:15 Mac Mini launchd job once the harness path is known.
- Decide whether Devon should turn the latest David dashboard concept into an implementation plan.
