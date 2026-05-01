# Home Center — Architecture Decisions Log

Append-only. Each decision gets a date, context, decision, consequence.
Newest at top.

---

## 2026-05-01 — Add AgentCI deterministic replay layer

**Context**
Home Center now has deterministic derivations, deterministic intervention
selection, and optional agent enhancement. Regression testing needed to cover
agent-facing workflows without depending on live voice/audio or LLM behavior.

**Decision**
Add AgentCI under `src/core/agentci/` plus repo-local fixtures, run snapshots,
and reports under `agentci/`. AgentCI records raw data plus normalized
`CommandEvent` fixtures, recomputes derived state and cards offline, diffs
runs, explains card decisions from deterministic reason objects, and gates the
golden School Updates Digest scenario.

**Consequence**
AgentCI starts after inputs are normalized. It does not own wakeword detection,
speech recognition, OpenClaw calls, external agent adapters, or production
monitoring. Any future agent integration must preserve replayable deterministic
snapshots and reason traces.

---

## 2026-04-30 — Centralize derivations and intervention decisions under `src/core`

**Context**
The codebase had the right architectural documents, but state flags, card
visibility, and OpenClaw enhancement were still partially coupled through
legacy UI registries and components.

**Decision**
Move deterministic derivations to `src/core/derivations/`, add
`src/core/state/store.js` for `{ rawData, derivedState }` snapshots, and make
`src/core/interventions/engine.js` the only card-selection layer. OpenClaw now
runs through `src/core/agents/clawAdapter.js` only after cards have been
selected.

**Consequence**
`src/state/deriveState.js` and legacy card wrappers remain as compatibility
surfaces during migration, but new state/card work should target `src/core`
first and UI renderers should consume engine card objects from `src/ui/cards/`.

---

## 2026-04-17 — Remove World Clock, Timers, and OpenClaw Tasks from TV dashboard

**Context**
The TV dashboard was visually busy: five top-row cards (Calendar, Birthdays,
Weather, World Clock, Fun Fact) and a right column stacked with Timers,
OpenClaw Tasks, and Fun Fact. World Clock was cosmetic, Timers duplicated
information already surfaced by `AlarmOverlay` (which is how voice-set timers
actually fire), and the "OpenClaw Tasks" panel (`AgentTasksPanel`) was a
dev-oriented queue view — not useful on a family TV.

**Decision**
Removed three cards from `src/App.jsx` (mobile + desktop layouts):
`WorldClockPanel`, `TimersPanel`, `AgentTasksPanel`. `useTimers` stays —
voice-set timers still fire via `AlarmOverlay` on expiry; we just don't
show the pending queue as a card. Pencil design (`home-center.pen`, frame
`8pkH2`) updated to match: nodes `oeqaR` (World Clock), `Sog3C` (Timers),
and `WvqUf` (OpenClaw Tasks) deleted.

**Consequence**
- Top row is now 3 cards (Calendar | Birthdays | Weather); right column
  shows Claw Suggestions / Fun Fact via the existing registry slot.
- Spatial gesture nav map shrinks — WorldClock/Timers/AgentTasks targets
  removed from the grid.
- Voice timer UX unchanged — `AlarmOverlay` still covers create + dismiss.
- `src/components/AgentTasksPanel.jsx` and `src/hooks/useAgentTasks.js`
  remain in-repo but unreferenced; future cleanup can delete them outright
  if nothing else imports them.

---

## 2026-04-20 — School updates go through OpenClaw, not direct SDK calls

**Context**
Three separate places held school-email logic: `email-triage/` (general
classifier with "school" as one of 9 categories, direct OpenAI/Anthropic
SDK), `school-updates/` (dedicated school pipeline, direct SDK), and
`src/data/schoolHeuristics.js` (client-side regex baseline). Two of them
called LLM APIs directly from the Mac Mini, each with its own model ID,
each with its own API key. The user asked that only *actionable* school
emails reach Telegram — not the general noise email-triage was firing.

**Decision**
Route all new service-side LLM calls through the worker's
`/api/claw/enhance` endpoint — the single enhancement surface we already
standardized on for UI cards. Specifically:

1. Added `schoolUpdates` feature to `CLAW_ENHANCERS` in the worker.
   Per-email input; structured output including `isRelevant` (default
   false — the model must justify surfacing). Validators clamp every
   string and refuse invalid kinds.
2. Rewrote `school-updates/agent.py`: fetch via Gmail pre-filter → POST
   to `/api/claw/enhance` per candidate → publish batch to
   `/api/school-updates` → fire one Telegram ping per actionable item.
   No `openai`/`anthropic` imports on the Mac Mini side for this service.
3. Disabled `email-triage/`'s Telegram notifier. It keeps feeding the TV
   Notifications card but no longer pings the phone. Only
   `school-updates/` reaches Telegram.
4. `email-triage/` stays on direct SDK calls for now. Migration path
   below.
5. `src/data/schoolHeuristics.js` untouched. Client-side regex baseline
   remains the deterministic safety net per the 2026-04-19 "OpenClaw is
   enrichment, not dependency" decision.

**Consequence**
- Single source of model config: `OPENAI_ENHANCE_MODEL` on the worker.
- Single LLM-key surface: worker's `OPENAI_API_KEY` secret.
- Free dedup: `/api/claw/enhance` caches by `(feature, stateHash)` 1 h.
- Poll cadence: school-updates runs every **30 min** (explicit user
  decision). Lower than email-triage's 5-min cadence — school mail is
  less time-sensitive and LLM cost stays bounded.

**Migration path for `email-triage/`**
Add an `emailTriage` feature to `CLAW_ENHANCERS` mirroring its classifier
output, rewrite `classifier.py` to POST instead of calling SDKs, drop
`openai` + `anthropic` from `requirements.txt`, remove the `provider:`
key from `config.yaml`. Not in scope today.

---

## 2026-04-20 — Product decisions for the next feature pass

Three design questions locked before implementation:

### No phone-push reminders
Dashboard is the only reminder surface. No Telegram push (or other
phone notification) at the 16:30 takeout cutoff, the 18:00 lunch
prompt, or 30 min before bedtime. The derived-state flags stay the
source of truth; if the TV is off, the reminder doesn't fire —
acceptable. Removes ~2 hr of scheduled-worker / cron work from the
backlog.

### Gift-ideas entry point is a Claw Suggestions row
When `derived.birthdayGiftNeeded` is true, the Claw Suggestions card
surfaces an "Order gift for {name}" row. Tapping it opens an ideas
view populated by `/api/claw/enhance`. Birthdays card stays read-only
for gift content — the click-cycle pill is the only action there. No
"Find ideas" button, no fullscreen birthday detail page.

### School lunch ingestion stays manual
`scripts/school-lunch/ingest.sh` is the official update path. RBUSD's
PDF URLs embed a fresh random token per month, so a scheduled worker
would still need human input every month — same effort, more
machinery to drift silently. No scheduled ingestion worker in scope.

### A2 (`/api/claw/enhance`) uses OpenAI GPT 5.4-mini
Enhancement calls hit OpenAI, not Anthropic. Default model
`gpt-5.4-mini`, configurable via `OPENAI_ENHANCE_MODEL` env var on
the worker (per the "model IDs never hardcoded" decision). Worker
already has `OPENAI_API_KEY` as a secret — no new credential surface.

---

## 2026-04-20 — Cloudflare API token leak — incident closed

**Context**
A Cloudflare user-scoped API token (`Wk6MoCA1…`, id
`088c3b03…`) was committed into `deploy-worker.sh` on 2026-02-22 and
sat in the public repo until 2026-04-19, when the repo boundary
cleanup surfaced it. ~2-month public exposure.

**Response**
- 2026-04-20: verified via `/client/v4/user/tokens/verify` → still
  live. Cloudflare's own secret-scanning partnership had not
  auto-revoked it.
- 2026-04-20: deleted via the Cloudflare dashboard (User API Tokens,
  not the account-scoped page the token's deploy script implied). The
  token's scopes did not include "User API Tokens: Write", so it
  could not self-delete via API — required the owner's dashboard
  session.
- Post-revocation: `verify` returned 1000 / "Invalid API Token" —
  confirmed dead.
- Audit log review covering the exposure window showed **only the
  owner (Peter) and Cloudflare's own system activity**. No
  unrecognized IPs, no unexpected mutations (workers, DNS, zones).
  Incident closed with zero observed abuse.

**Decision**
Treat this as a near-miss rather than an active breach. No downstream
cleanup (no credentials rotated on other services, no worker rollback)
is required.

**Preventive measures added in follow-ups**
- PR #9 (\`claude/gitleaks-ci\`) — blocking gitleaks CI step on every
  PR. Default ruleset + narrow allowlist documented in
  `.gitleaks.toml`. Diff-only scan; runs alongside the existing
  Architecture Test Suite + Build Verification jobs.
- GitHub secret-scanning + push-protection were already enabled at
  the repo level, verified via API. Optional hardening
  (`secret_scanning_validity_checks`,
  `secret_scanning_non_provider_patterns`) toggled on via Settings →
  Code security.
- PR #9 also migrated `PHOTOS_ALBUM_TOKEN` from the plaintext
  `[vars]` block in `worker/wrangler.toml` to `wrangler secret put`,
  removing the last tracked plaintext secret from the repo.

**Lessons** (for the next time a secret tries to slip in)
- Inline-secret convenience patterns compound: `CF_TOKEN=` and
  `SSHPASS=` and a plaintext photos token all came from the same
  "skip the setup step, inline the value" instinct.
- The only durable fix is prevention at push time. Post-hoc git-history
  cleanup cannot invalidate a live credential; only rotation can.
- CI diff-scanning is cheap insurance; pair it with provider
  push-protection for defense in depth.

**Residual risk — accepted**
The iCloud Shared Album token `B1o5nhQST2MGod` is still live in git
history at commit 54092ba3 and still accepts traffic on Apple's side.
Evaluated and accepted as-is on 2026-04-20 because:

- The token is **view-only on one personal shared album** — not a
  credential. Blast radius is "whoever reads the git history can see
  that album's photos."
- Opportunistic GitHub secret scrapers target credentials (AWS, CF,
  OAuth). Passive view tokens for personal albums aren't on their
  target list.
- The album's contents are benign family material; no identifiable
  sensitive content where the calculus would flip.
- The rotation path stays easy if the content profile ever changes:
  Photos app → shared album → toggle "Public Website" off/on →
  `wrangler secret put PHOTOS_ALBUM_TOKEN` → drop the allowlist
  entry in `.gitleaks.toml`.

This is a conscious acceptance, not a forgotten follow-up.

---

## 2026-04-19 — Product repo boundary cleanup

**Context**
The repo had grown to hold three overlapping concerns: the Home Center
product (dashboard, worker, Telegram bridge, gbrain), a personal
developer-agent orchestrator ("Homer CI") under `.openclaw/`, and
workspace/audit/launchd clutter from the Mac Mini that ran all three.
An audit turned up concrete hazards: a leaked Cloudflare API token in a
tracked `deploy-worker.sh`, direct-to-main PAT instructions in
`CLAUDE.md` that contradicted the PR workflow, repeated references to
the old project name (`phdev/accel-driv`), hardcoded user paths in
`.pencil-watcher.sh`, and a `.claude/settings.json` auto-starting
`http-server` on `/home/user/accel-driv`.

**Decision**
Cut the repo down to the Home Center product plus a clean `deploy/`
surface. Specifically:

- Removed the obsolete `deploy-worker.sh` (leaked token; replaced by
  `wrangler deploy`), `PLAN-openclaw-swarm.md` (superseded by the gbrain
  docs), `.claude/settings.json` (wrong-project hook), the pencil
  watcher/queue residue, and the entire `.openclaw/` subtree (personal
  dev-agent orchestration + runtime state).
- Promoted the OpenClaw bot prompts (persona, operating instructions,
  family-assistant skill) to versioned product artifacts at
  `openclaw/prompts/`. The family Telegram bot is a product surface; its
  prompts belong in the repo.
- Moved Mac Mini launchd plist templates + a sanitized bridge setup
  script to `deploy/mac-mini/`. No personal Apple IDs, no hardcoded
  chat IDs — all real values substituted at install time.
- Rewrote the Git Workflow section of `CLAUDE.md` to require PRs, not
  direct-to-main PAT pushes. Removed the Homer CI section entirely and
  replaced it with a short pointer noting that personal dev-agent
  orchestration lives outside this repo.
- Extended `.gitignore` to cover `.claude/`, `.openclaw/`,
  `.pencil-queue.json`, `.pencil-watcher.sh`, and `**/__pycache__/` so
  these can't drift back in.

**Consequence**
The repo boundary is now product-only: dashboard, worker, Telegram
bridge with its prompts, integration services (email-triage,
school-updates, pi, deploy). Contributors (human or AI) see only
reviewable product artifacts. Personal developer-agent automation
integrates via the bridge's public API (`/send`, `/messages`,
`/messages/ack`) from a separate repo or local-only directory — the
contract surface is stable, the personal-state coupling is gone.

**Action item (manual, not code)** The Cloudflare API token that was
hardcoded in `deploy-worker.sh` is already in git history. **Rotate it
at Cloudflare** before relying on the cleanup alone.

---

## 2026-04-19 — Model IDs never hardcoded; OpenClaw must survive model changes

**Context**
LLM providers retire dated model IDs on short notice. A hardcoded
`"gpt-4o-mini"` or `"claude-haiku-4-5-20251001"` means that when the
provider deprecates it, every surface using that string silently breaks
until someone redeploys. The worker already reads `OPENAI_MODEL` from
env, but `email-triage/email_triage/cloud_llm.py` pins both the OpenAI
and Anthropic model names in source.

**Decision**
Every place that names a model reads it from config with a safe fallback
— never from a literal in source. Concretely:

1. Worker (`worker/src/index.js`) — already OK; `env.OPENAI_MODEL` +
   default. Any future model pin (e.g. `ANTHROPIC_MODEL` for
   `/api/claw/enhance`) must follow the same pattern.
2. `email-triage/email_triage/cloud_llm.py` — replace the two hardcoded
   model IDs with config values loaded from `config.yaml` under
   `llm.cloud.openai_model` and `llm.cloud.anthropic_model`, each with
   a safe default.
3. `openclaw/index.js` Telegram bridge — no model pin today (it forwards
   to the worker's `/api/ask`). This is the pattern: the bridge stays
   thin and the worker is the only place model choice is configured.

**Consequence**
When a model deprecates, updating a single config value (worker secret
or `email-triage/config.yaml`) keeps everything running — no code push,
no redeploy of the Telegram bridge. If someone adds a new LLM-calling
surface in the future, code review rejects any PR that hardcodes a
model name.

**Action items** (backlog):
- [ ] Move `email-triage` model IDs from code into `config.yaml` with
  defaults read via `config.get("llm.cloud.*_model", "…")`
- [ ] When implementing `POST /api/claw/enhance` (feature A2), use
  `env.ANTHROPIC_MODEL` with a current safe default
- [ ] Add a grep-based CI guard (optional) that fails PRs containing
  literal strings matching `/(gpt|claude|sonnet|haiku|opus)-[\d.-]+/`
  outside of tests and this decisions log

---

## 2026-04-19 — Gbrain is an active part of the workflow

**Context**
The four docs in `docs/` described the architecture accurately, but nothing
in the repo made it clear they should be *read before* and *updated after*
meaningful changes. Drift between code and docs was one rebase away.

**Decision**
- Add `docs/README.md` as the explicit gbrain contract — lists the four docs,
  the rules, and the before/after workflow.
- Add a "Project Brain (gbrain) — READ FIRST" section at the top of
  `CLAUDE.md` so AI assistants see the contract immediately.
- Add a PR template (`.github/pull_request_template.md`) that asks
  contributors whether they updated the relevant doc(s).
- Add a contributor section to the repo `README.md` pointing at the docs.
- Add inline pointers in key state/registry files so developers who grep
  find the docs.

**Consequence**
Docs and code are expected to stay in sync in the same PR. An architectural
change that doesn't log an entry here is a regression.

---

## 2026-04-19 — Worker-backed persistence with local fallback

**Context**
Takeout / lunch decisions and birthday gift-status were localStorage-only.
Decisions made on the TV never reached a phone and vice-versa. Long-term
this would be confusing for the family.

**Decision**
Introduce `src/data/_storage.js` (`readWithFallback` / `writeWithFallback`)
as the **only** place that knows about worker-vs-local routing. All
adapters (takeout, lunch, school-lunch, birthday gift) route through it.
Worker endpoints (`POST /api/takeout/today`, `POST /api/lunch/decisions`,
`GET /api/school-lunch`, `PATCH /api/birthdays/:id`) are KV-backed behind
Bearer auth.

**Consequence**
Components remain storage-source-agnostic (invariant, not coincidence).
Decisions sync across devices when the worker is up, survive reloads
when it isn't. The fallback path is tested — if someone adds a new
adapter they must use this helper or violate the invariant visibly.

---

## 2026-04-19 — Scheduling uses nextMeaningfulTransition

**Context**
A 30 s generic tick wastes cycles and can miss sharp flag edges by up to
30 s. A purely transition-driven schedule leaves the dashboard stuck if
`nextMeaningfulTransition` is missing or invalid.

**Decision**
`src/state/useDerivedState.js` runs **both**:
- A precise `setTimeout` against `derived.nextMeaningfulTransition` when
  it's valid, in the future, and ≤ 10 min away.
- A 60 s fallback interval that always runs.

Invalid / far-future transitions are ignored silently; the interval
carries us forward.

**Consequence**
Flag edges land within ~1 s, CPU stays low. Missing / malformed
transitions never deadlock the scheduler.

---

## 2026-04-19 — Adopt three-layer state-driven architecture

**Context**
The OpenClaw Telegram bridge is now live. We're adding many new family cards
(calendar conflicts, morning checklist, takeout, lunch, bedtime, birthdays,
school updates, claw suggestions). Without discipline this will turn into a
pile of ad-hoc `if (emails[i].subject.includes("permission"))` conditions
sprayed across components.

**Decision**
Every new feature flows through three layers:
1. `src/data/` adapters normalize raw inputs.
2. `src/state/deriveState.js` is the single source of truth for **whether a
   card shows** and **what data it gets**.
3. `src/cards/` + `src/components/` render read-only view models.

**Consequence**
Components cannot compute visibility rules. `computeDerivedState` is pure and
unit-testable. Features die by removing a branch in `deriveState` rather than
greps across the tree.

---

## 2026-04-19 — OpenClaw is enrichment, not dependency

**Context**
Tempting to let the LLM decide "does the morning checklist show today?".
Outages, latency, drift, and cost make this fragile — and quietly drifting UI
is a terrible TV experience.

**Decision**
OpenClaw enhances **copy** and **ranks within a tier** only. It cannot:
- decide whether a card appears
- decide when a reminder fires
- be the sole parser of any structured field (regex + fallback must exist)

Every enhancement call has a deterministic fallback that keeps the UI usable.

**Consequence**
Every card renders correctly with OpenClaw unreachable. Tests don't need an
LLM. LLM cost is bounded (we only call per-render, not per-poll).

---

## 2026-04-19 — Reminder timing is deterministic

**Context**
Bedtime at 21:00 minus 30 = 20:30. This is arithmetic, not an LLM call.

**Decision**
Time-bound triggers (bedtime reminder, 16:30 takeout, 18:00 lunch prompt) are
computed from settings + the clock in `deriveState`. OpenClaw may wrap
prettier words around the resulting state, nothing more.

**Consequence**
Reminders fire even if the worker is down. "OpenClaw didn't respond" never
causes a silent miss of bedtime.

---

## 2026-04-19 — Semantic email interpretation may use OpenClaw

**Context**
School email parsing has a long tail: permission slips, book fair signups,
early-dismissal notices, class updates. Regex breaks on every new template.

**Decision**
For the **classification** stage (action vs event vs reminder vs info) and
**structured extraction** (due dates, required actions, child/class/teacher),
we combine:
- Deterministic regex for obvious patterns (`due (Monday|tomorrow|MM/DD)`,
  `sign and return by …`).
- OpenClaw for the semantic layer.
- Any date it extracts gets a regex cross-check before trusting it.

Explainability is preserved: every `SchoolItem` carries `raw.snippet` and
`source = 'regex' | 'openclaw' | 'both'`.

**Consequence**
We accept some LLM cost here; cached per email ID so re-parsing is rare.
If OpenClaw is down the card still shows best-effort items with regex-only
extraction.

---

## 2026-04-19 — TV-friendly card design

**Context**
The dashboard lives on a 1080p TV 6–10 ft away, typically read at a glance
with coffee in one hand. Not a phone, not a desktop.

**Decision**
Cards stay **simple, glanceable, low cognitive load**:
- At most one primary action per card
- At most one OpenClaw paragraph per card
- Bulleted structured data stays deterministic
- Never "Loading…" as the visible state (fallback copy always available)
- Typography: 22 px minimum on visible text
- At most one contextual card visible at a time in the contextual slot

**Consequence**
Cards that want more UI shrink their detail view into a fullscreen route
(which we already have patterns for — e.g. Full Calendar Page).

---

## 2026-04-19 — Separate ingestion from rendering

**Context**
Components currently fetch and render in the same file. Adding derived state
on top of that would create cross-coupling everywhere.

**Decision**
- `src/services/` talks to APIs (no React).
- `src/data/` normalizes raw shapes (pure).
- `src/hooks/` is the React wiring layer (subscribes to services/data).
- `src/state/` derives — **pure function, no React**.
- `src/cards/` + `src/components/` render from view models.
- `src/ai/openclaw.js` handles LLM calls w/ timeout + fallback.

**Consequence**
Unit tests target `state/` and `data/` directly without React. Server-side
rendering or later static generation becomes possible.

---

## 2026-04-19 — Keep existing hooks/services, add state + cards + ai

**Context**
The project already has `src/hooks/` (17 hooks), `src/services/` (6 services)
and `src/components/` (30+ components). A wholesale refactor would be noisy
and risky on a live TV.

**Decision**
- Keep `src/hooks/*` and `src/services/*` as-is; they are the ingestion layer.
- **Add** `src/state/`, `src/cards/`, `src/ai/` without renaming anything.
- Existing hooks feed a new `useRawState()` hook that flows into
  `computeDerivedState` via `useDerivedState()`.
- New feature cards live in `src/cards/*`; enhancements to existing cards
  (Calendar, Birthdays) stay in their current component files but consume
  the new derived state.

**Consequence**
Zero breaking changes to current TV render. New features plug in via the
contextual slot + the registry pattern.

---

## 2026-04-19 — Claw Suggestions are suggestions, not actions

**Context**
The LLM generates reasonable suggestions ("Move standup to 9"). It also
sometimes hallucinates. An autonomous "yes, I moved your meeting" flow would
be unacceptable on a shared family TV.

**Decision**
Every Claw Suggestion row ends at a user-confirmed action (tap → perform,
dismiss → hide). No suggestion modifies shared state silently. Homer CI's
autonomous code flow is a separate system with its own guardrails.

**Consequence**
Worst case for a hallucinated suggestion: the user dismisses it. No one's
calendar is touched without a tap.

---

## Template for future decisions

```
## YYYY-MM-DD — <short decision>

**Context** what prompted the decision, what was hurting

**Decision** what we decided

**Consequence** what breaks, what stays, what's now forbidden
```
