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
- **UI presentation** consumes derived state and renders cards. Components
  contain zero visibility logic.
- **OpenClaw** enhances copy, summaries, suggested actions. It runs in
  parallel and is **opt-in per card**. If it times out or fails, the card
  still renders with the deterministic fallback copy.

## Raw data sources

| Source | Owner | Adapter | Refresh | Notes |
|---|---|---|---|---|
| Howell Family iCloud calendar | Cloudflare Worker `/api/calendar` | `src/hooks/useCalendar.js` → `src/data/calendar.js` normalizer | 5 min | Already live |
| Weather | Worker `/api/weather` | `src/hooks/useWeather.js` → `src/data/weather.js` | 15 min | Already live |
| Birthday records | User-owned JSON in worker KV (`/api/birthdays`) | `src/hooks/useBirthdays.js` → `src/data/birthdays.js` | 1 h | Add `gift_ordered` field + audit (see §Gift status) |
| Meal plan / takeout decisions | Worker KV (`/api/takeout/today`) + local quick-set | `src/data/takeout.js` | on write | New endpoint; store `{date, decision: 'takeout'|'home'|null, vendor?, decidedAt, decidedBy}` |
| Bedtime settings | `src/services/settings.js` | `src/data/bedtime.js` | on change | Per-child schedule `{weekday, weekend, reminderLeadMin}` |
| Checklist config | Static + overrides in settings | `src/data/checklist.js` | on change | Base items + context-conditional items |
| School emails | `email-triage` service → Worker `/api/school-updates` | `src/hooks/useSchoolUpdates.js` → `src/data/schoolUpdates.js` | 5 min | Semantic pipeline — see Feature Pass 2 |
| School lunch menus | Static PDFs ingested into worker KV (`/api/school-lunch?date=…`) | `src/data/schoolLunch.js` | weekly | Source: district menu PDFs; ingest monthly via worker cron |

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
| Normalization + shape guarantees | `src/data/*` adapters |
| React data wiring | `src/hooks/*` (wraps adapters, triggers refresh) |
| **Derived state computation** | `src/state/deriveState.js` — **only place** |
| OpenClaw enhancement | `src/ai/openclaw.js` |
| Card visibility rules | derived state only (never components) |
| Card rendering | `src/cards/*` + existing `src/components/*` |

## Deterministic vs OpenClaw-enhanced logic

| Concern | Who decides |
|---|---|
| Does a card show? | Deterministic (derived state) |
| When does a reminder fire? | Deterministic (clock + setting) |
| What items are on the morning checklist? | Deterministic base + deterministic weather overrides |
| Which emails are "school-related"? | Deterministic sender/domain heuristics **first**, then OpenClaw for ambiguous |
| Kind classification (action/event/reminder/info) | OpenClaw with deterministic regex fallback for due dates |
| Copy on a card header/summary | OpenClaw-enhanced (optional) with deterministic fallback string |
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
| Worker down | Cached last-known raw data; stale badge in top nav |
| OpenClaw down | Deterministic copy shown; no silent failure messages |
| Time source drift | Derived state recomputes on every tick (~30s); clock-bound cards hide/show correctly |
| Adapter throws | Isolated — its derived slice = `null`, dependent cards hide; unrelated cards unaffected |

## Related docs

- `home_center_derived_states.md` — per-flag spec
- `home_center_ui_card_contracts.md` — per-card contract
- `home_center_decisions_log.md` — architecture decisions log
