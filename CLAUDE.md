# CLAUDE.md - Home Center Operating Contract

## Project Brain - Read First

Before meaningful Home Center changes, read the project brain docs:

1. [`docs/README.md`](docs/README.md) - gbrain contract
2. [`docs/home_center_state_model.md`](docs/home_center_state_model.md) - raw sources -> derived state -> UI map
3. [`docs/home_center_derived_states.md`](docs/home_center_derived_states.md) - derived flag contracts
4. [`docs/home_center_ui_card_contracts.md`](docs/home_center_ui_card_contracts.md) - card contracts
5. [`docs/home_center_decisions_log.md`](docs/home_center_decisions_log.md) - architecture decisions

## Five Rules

1. **Raw data -> derived state -> UI is the only flow.** Do not bypass it.
2. **UI visibility is driven only by derived state.** Components must not decide card visibility from clocks, fetch results, LLM output, or ad-hoc conditions.
3. **OpenClaw enhances, it does not decide.** It can provide copy, summaries, ordering hints, and conversation help. It cannot directly drive card visibility, reminder timing, flag truth values, or UI behavior.
4. **Storage source is invisible to components.** Worker-vs-localStorage routing belongs in `src/data/_storage.js` and adapter wrappers.
5. **Reminder timing is deterministic arithmetic.** Bedtime, lunch, takeout, and similar thresholds are not LLM calls.

## Workflow

Before implementing:

- Start with `git status --short --branch`.
- If dirty state spans multiple concerns, split it into small reviewable commits before continuing.
- Name the intended commit bucket before editing.
- Skim the relevant gbrain doc(s) and runbook(s).
- If the request changes a contract, update the contract doc as part of the same work.

While implementing:

- Put derived-state logic in `src/core/derivations/`.
- Put card selection in `src/core/interventions/engine.js`.
- Put new engine-card renderers in `src/ui/cards/*`.
- Keep legacy `src/cards/*` and `src/components/*` wrappers working while migration callers remain.
- Put storage routing in `src/data/*` adapters.
- Put enhancement calls behind `useEnhancement(...)` with deterministic fallback.

After implementing:

- Update the relevant gbrain doc(s).
- Add a dated `docs/home_center_decisions_log.md` entry when an invariant, boundary, or architecture pattern changes.
- Run the smallest meaningful verification. For normal app changes, run `npm test` and `npm run build`.
- For feature work Peter expects on `main`, commit coherent changes, push `origin main`, and confirm `git status --short --branch` has no ahead/behind state unless told otherwise.

## Where Things Live

| Area | Path |
|---|---|
| Vite app entry and TV grid | `src/App.jsx`, `src/main.jsx` |
| Theme definitions | `src/themes/index.js` |
| External API clients | `src/services/` |
| Raw data adapters and storage routing | `src/data/` |
| Existing React hooks | `src/hooks/` |
| Pure derived-state engine | `src/core/derivations/` |
| Card selection engine | `src/core/interventions/engine.js` |
| Derived-state compatibility exports | `src/state/` |
| New engine-card renderers | `src/ui/cards/` |
| Legacy cards and wrappers | `src/cards/`, `src/components/` |
| OpenClaw enhancement helper | `src/ai/openclaw.js` |
| Worker API | `worker/src/index.js` |
| Pi kiosk, command server, mic stream | `pi/` and [`pi/README.md`](pi/README.md) |
| Mac mini services and launchd templates | `deploy/mac-mini/` and [`deploy/mac-mini/README.md`](deploy/mac-mini/README.md) |
| Voice service | `voice-service/` and [`voice-service/README.md`](voice-service/README.md) |
| Pencil design workflow | [`docs/runbooks/pencil-designs.md`](docs/runbooks/pencil-designs.md) |
| TV dashboard and gesture notes | [`docs/runbooks/tv-dashboard.md`](docs/runbooks/tv-dashboard.md) |
| AgentCI and deterministic replay | `agentci/`, `scripts/agentci.js`, `docs/agentci_overview.md` |

## Git Workflow

- Branch off `origin/main` for PR work unless Peter explicitly asks to work directly on `main`.
- CI runs Vitest and build through `.github/workflows/openclaw-checks.yml`.
- GitHub Pages deploys from `main` and is for remote/mobile access only.
- The Pi kiosk is not updated by GitHub Pages. Use the deploy loop in [`pi/README.md`](pi/README.md).
- Keep generated artifacts separate from implementation commits.
- Regenerate `docs/status/devon-project-index.md` only after intentional commits are made.

## Gstack + OpenClaw Agents

Home Center documents a gstack workflow where Devon is PM/QA/eval manager,
David is design/frontend implementation agent, and Codex is Devon's
repo-editing harness. This augments the rules above; it does not replace the
raw data -> derived state -> UI boundary.

See:

- [`docs/gstack_openclaw_devon_david.md`](docs/gstack_openclaw_devon_david.md)
- [`agents/devon_gstack.md`](agents/devon_gstack.md)
- [`agents/david_gstack.md`](agents/david_gstack.md)
- [`docs/commands/gstack_home_center_examples.md`](docs/commands/gstack_home_center_examples.md)

## Runbooks

- Pi setup, deploy, service management, and kiosk verification: [`pi/README.md`](pi/README.md)
- Mac mini launchd services and setup: [`deploy/mac-mini/README.md`](deploy/mac-mini/README.md)
- Voice service install, tuning, debugging, and validation: [`voice-service/README.md`](voice-service/README.md)
- Pencil designs and TV Preview: [`docs/runbooks/pencil-designs.md`](docs/runbooks/pencil-designs.md)
- TV dashboard display/layout/gesture reference: [`docs/runbooks/tv-dashboard.md`](docs/runbooks/tv-dashboard.md)
