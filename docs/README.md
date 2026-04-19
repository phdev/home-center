# Home Center — Project Brain (gbrain)

This folder is the **source of truth** for how Home Center thinks about state,
UI, and architecture. It is not decorative — code and docs are expected to stay
in sync, and contributors (human or AI) are expected to read these before
making meaningful changes and update them after.

## When to read

Before doing any of the following, read the relevant doc(s) below:

- Adding or changing a dashboard card
- Adding, renaming, or removing a derived-state flag
- Changing when a card appears or disappears
- Changing how raw data is fetched, normalized, or stored
- Wiring a new OpenClaw enhancement
- Shipping a new worker endpoint
- Introducing a new architectural pattern (storage layer, adapter, etc.)

## The four docs

| Doc | What it is | When to consult |
|---|---|---|
| [`home_center_state_model.md`](./home_center_state_model.md) | Canonical map of raw sources → derived state → UI. Includes ownership and failure modes. | Whenever you're touching data ingestion, normalization, or the overall pipeline |
| [`home_center_derived_states.md`](./home_center_derived_states.md) | Per-flag contracts — inputs, deterministic rule, optional enhancement fields, dependent cards, edge cases | Whenever you're adding or changing a derived flag |
| [`home_center_ui_card_contracts.md`](./home_center_ui_card_contracts.md) | Per-card contracts — visibility conditions, required data, optional OpenClaw fields, actions, tier | Whenever you're adding, removing, or modifying a card |
| [`home_center_decisions_log.md`](./home_center_decisions_log.md) | Append-only log of architectural decisions with context, decision, consequence | Before making a decision that breaks an existing invariant; after making any architectural change |

## The gbrain contract

These are the non-negotiable rules every change must respect.

### 1. Raw data → derived state → UI is the canonical flow
- `src/services/` + `src/data/*` adapters produce normalized `RawState`
- `src/state/deriveState.js` is the **only** place that computes `DerivedState`
- Cards in `src/cards/*` and panels in `src/components/*` read `DerivedState`
  and never compute visibility rules themselves

### 2. UI visibility is driven only by derived state
- Every card's `visible(derived)` predicate reads only from `DerivedState`
- Components must not call `fetch`, read the clock, check localStorage, or
  inspect refs to decide whether to show themselves
- This is enforced by tests in `src/cards/registry.test.js` and
  `src/__tests__/fallback.integration.test.js`

### 3. OpenClaw enhances, it does not decide
- OpenClaw may enhance: copy, summaries, prioritization hints, suggested
  phrasing
- OpenClaw may **not** decide: whether a card appears, when a reminder fires,
  whether a flag flips, what the deterministic fallback copy is
- Every enhancement call has a deterministic fallback. Tests in
  `src/ai/openclaw.test.js` verify the fallback contract

### 4. Storage source is invisible to components
- Worker-vs-localStorage routing lives in `src/data/_storage.js` and the
  per-adapter wrappers
- Components and cards call adapter hooks/writers. They never see URLs,
  KV keys, or Bearer tokens

### 5. Reminder timing is deterministic
- All time-bound flags (bedtime, 16:30 takeout, 18:00 lunch) are arithmetic
  on settings + clock, computed in `deriveState.js`
- LLM calls do not gate reminder firing

### 6. Docs and code must stay in sync
- If you change behavior, update the relevant doc(s) in the same PR
- If you change an architectural rule, add an entry to
  `home_center_decisions_log.md`
- If code and docs conflict, either the docs are out of date (fix them) or
  the code is drifting (refactor it). The docs are the spec.

## Before shipping a change — checklist

- [ ] Relevant doc(s) updated (flag contract, card contract, state model)
- [ ] If an invariant or pattern changed, an entry in `decisions_log.md`
- [ ] Tests cover the new behavior (`npm test`)
- [ ] Build still passes (`npm run build`)
- [ ] CI green on PR (blocking `Build Verification` + `Architecture Test Suite`)

## For AI assistants (Claude Code, etc.)

See the top-level [`CLAUDE.md`](../CLAUDE.md) for the workflow assistants are
expected to follow. In short: read the four docs before meaningful changes,
preserve the three-layer flow, log architectural decisions.

## Scope of this folder

These docs describe **dashboard state + UI behavior**. Not in scope:

- Pi hardware details → see `pi/` + root `CLAUDE.md`
- Wake-word service internals → root `CLAUDE.md`
- OpenClaw Telegram bridge details → root `CLAUDE.md`

If you're unsure whether a change warrants a gbrain update, it probably does.
