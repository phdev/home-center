# Home Center — Architecture Decisions Log

Append-only. Each decision gets a date, context, decision, consequence.
Newest at top.

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
