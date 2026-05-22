# Home Center — State Model

Source-of-truth for how data flows through the dashboard. Every new feature
follows the **raw → derived → UI** pipeline described here. If an
implementation deviates, either this doc is wrong (update it) or the
implementation is wrong (refactor it).

## Three layers

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  RAW DATA   │ ──▶ │  DERIVED STATE   │ ──▶ │  UI PRESENTATION  │
│ (adapters)  │     │ (pure, testable) │     │ (cards, read-only)│
└─────────────┘     └──────────────────┘     └───────────────────┘
                            ▲
                            │ optional
                    ┌───────┴────────┐
                    │   OPENCLAW     │  (enrichment only —
                    │  enhancement   │   never a hard dep)
                    └────────────────┘
```

- **Raw data** is read via typed adapters, normalized to a canonical shape.
- **Derived state** is a single pure function of `raw + context` (time, user
  prefs) that produces boolean flags and structured view data.
- **State must be serializable and replayable.** Raw inputs, derived state, and
  selected cards must be JSON-safe so AgentCI can record and replay runs.
- **UI presentation** consumes derived state and renders cards. Components
  contain zero visibility logic.
- **OpenClaw** enhances copy, summaries, suggested actions. It runs in
  parallel and is **opt-in per card**. If it times out or fails, the card
  still renders with the deterministic fallback copy.

## Raw data sources

| Source | Owner | Adapter | Refresh | Notes |
|---|---|---|---|---|
| Howell Family iCloud calendar | Cloudflare Worker `/api/calendar` (CalDAV backend) | `src/hooks/useCalendar.js` → `src/data/calendar.js` normalizer | 5 min | Live |
| Weather | Worker `/api/weather` | `src/hooks/useWeather.js` → `src/data/weather.js` | 15 min | Live |
| Birthday records | Worker `/api/birthdays` — CalDAV feed merged with KV gift overrides (`PATCH /api/birthdays/:id`) | `src/hooks/useBirthdays.js` → `src/data/birthdays.js`; gift writer `src/data/useBirthdayGift.js` | 1 h + on write | Live |
| Takeout decisions | Worker `GET`/`POST /api/takeout/today` (KV) with localStorage fallback via `src/data/_storage.js` | `src/data/useTakeout.js` (reader + `useTakeoutWriter`) | on write | Live |
| Lunch decisions | Worker `GET`/`POST /api/lunch/decisions` (KV-indexed by date, 14-day retention) with localStorage fallback | `src/data/useLunch.js` (reader + `useLunchWriter`) | on write | Live |
| School lunch menus | Worker `GET /api/school-lunch` (KV read-only) with localStorage fallback | `src/data/useSchoolLunch.js` | weekly | **Read live; ingestion (PDF → KV) still TODO** — stub in `worker/src/index.js` |
| Bedtime settings | `useSettings()` + `src/data/useBedtime.js` default | `src/data/useBedtime.js` | on change | Per-child schedule `{weekday, weekend, reminderLeadMin}` |
| Checklist config | `useSettings()` override + `src/data/useChecklist.js` default | `src/data/useChecklist.js` | on change | Base items + condition-gated items (`always` / `cold` / `hot` / `rain`) |
| School emails | `email-triage` service → Worker `/api/school-updates` → derived ranking + `src/data/schoolHeuristics.js` (pre-LLM kind/urgency/dueDate/dedup) | `src/hooks/useSchoolUpdates.js` → `src/data/schoolUpdates.js` | 5 min | Live. Regex heuristics applied first; LLM classifier results (when present) override |

## Normalization contracts

Every adapter returns canonical shapes (JSDoc typedefs in `src/state/types.js`).
Adapters are responsible for all parsing/coercion — derived state does not
touch raw payloads.

Examples:

- `CalendarEvent = { id, start: ISO, end: ISO, title, attendees[], allDay }`
- `Birthday = { id, name, relation, date: 'MM-DD', giftStatus: 'ready'|'ordered'|'needed'|'unknown', giftNotes? }`
- `SchoolItem = { id, kind: 'action'|'event'|'reminder'|'info', title, summary, dueDate?, eventDate?, child?, class?, teacher?, location?, urgency: 0..1, source: 'emailId…', rawSnippet? }`

Full catalog lives in `src/state/types.js`.

## Ownership

| Concern | Owner |
|---|---|
| External API integration | `src/services/` |
| Caching + retries | service layer |
| Worker-vs-localStorage routing | `src/data/_storage.js` + per-adapter wrappers — the **only** place that knows about both sources |
| Normalization + shape guarantees | `src/data/*` adapters |
| React data wiring | `src/hooks/*` (wraps adapters, triggers refresh) |
| **Derived state computation** | `src/core/derivations/` — **only place**. `src/state/deriveState.js` is a compatibility export. |
| State store/snapshot | `src/core/state/store.js` owns `{ rawData, derivedState }` snapshots |
| Recompute scheduling | `src/state/useDerivedState.js` — precise `setTimeout` off `nextMeaningfulTransition` + 60 s fallback interval |
| Card visibility / intervention decisions | `src/core/interventions/engine.js` — max 3 cards, urgent > important > ambient |
| OpenClaw enhancement | `src/core/agents/clawAdapter.js` after intervention decisions, backed by `src/ai/openclaw.js` |
| Card rendering | `src/ui/cards/*` for engine-card renderers, plus legacy `src/cards/*` + `src/components/*` wrappers during migration |

## Deterministic vs OpenClaw-enhanced logic

| Concern | Who decides |
|---|---|
| Does a card show? | Deterministic intervention engine over derived state |
| When does a reminder fire? | Deterministic (clock + setting) |
| What items are on the morning checklist? | Deterministic base + deterministic weather overrides |
| Which emails are "school-related"? | Deterministic sender/domain heuristics **first**, then OpenClaw for ambiguous |
| Kind classification (action/event/reminder/info) | OpenClaw with deterministic regex fallback for due dates |
| Copy on a card header/summary | OpenClaw-enhanced after card selection (optional) with deterministic fallback string |
| Claw Suggestions ranking | Deterministic priority floor (urgent ahead of nice-to-have), OpenClaw re-ranks within tier |
| Takeout vendor suggestion | Deterministic history rotation; OpenClaw adds flavor copy |
| Bedtime reminder phrasing | Deterministic default; OpenClaw softens if available |
| Gift ideas | OpenClaw-only (optional) — absence of ideas does not hide the card |

## Mapping table — raw → derived → UI

| Raw | Derived state | UI card(s) |
|---|---|---|
| calendar events | `morningConflicts`, `peter_0800_0900_risk` | Calendar card (badge), Claw Suggestions |
| calendar + now | `showMorningChecklist` | Morning Checklist card |
| weather + checklistConfig | `checklistItems[]` | Morning Checklist card |
| birthdays | `birthdayGiftNeeded[]` | Birthdays card, Claw Suggestions |
| bedtime + now | `bedtimeReminderActive` | Bedtime Toast |
| takeout + now | `takeoutDecisionPending` | Takeout Decision card, Claw Suggestions |
| lunch menu + now | `lunchDecisionNeeded`, `lunchMenu` | Lunch Decision card |
| school items | `schoolActionItems[]`, `schoolUrgent` | School Updates card, Claw Suggestions |
| all of the above | `clawSuggestions[]` | Claw Suggestions card |

## Failure modes

| Failure | Behavior |
|---|---|
| Worker down | `src/data/_storage.js` → `readWithFallback` returns localStorage value; `writeWithFallback` persists to localStorage so a later read works. No user-visible error. |
| OpenClaw down | `src/ai/openclaw.js` → `enhance()` returns `{fields: {}, source: 'fallback'}`. Cards render deterministic fallback copy. |
| Time source drift | Derived state recomputes on a 60 s safety-net interval and on every precise `nextMeaningfulTransition` (when in the future + ≤ 10 min away). |
| Adapter throws | Isolated — adapter returns `null`/`[]`, dependent cards hide or render their empty state. Unrelated cards unaffected. |

## Related docs

- [`README.md`](./README.md) — the gbrain contract (read first)
- `home_center_derived_states.md` — per-flag spec
- `home_center_ui_card_contracts.md` — per-card contract
- `home_center_decisions_log.md` — architecture decisions log
- `agentci_overview.md` — deterministic replay and regression gate overview
