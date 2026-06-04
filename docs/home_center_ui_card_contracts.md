# Home Center — UI Card Contracts

Each card has a contract: what makes it show, what data it needs, what copy is
OpenClaw-enhanced, and what actions it exposes. A card may not render anything
the contract does not declare.

Card selection is centralized in `src/core/interventions/engine.js`. The
engine consumes derived state, emits at most three visible card objects, and
orders them urgent > important > ambient. UI components consume those card
objects and do not decide visibility.

Every emitted card must include:

```json
{
  "reason": {
    "triggeredBy": ["derivedStateKey"],
    "suppressedBy": [],
    "priorityReason": "Human-readable deterministic priority explanation."
  }
}
```

The reason object is part of the UI card contract and the AgentCI regression
surface.

**TV context:** 1920×1080 logical, viewed from 6–10 ft. Default to low text
volume, tall affordances, one primary action per card.

**Priority tiers** (used by the contextual slot + Claw Suggestions ranking):

| Tier | Meaning | Examples |
|---|---|---|
| 1 — Blocking | Must act now | Bedtime Toast (during window), Urgent school action-item |
| 2 — Time-bound | Decide today | Takeout Decision past 16:30, Lunch Decision past 18:00 |
| 3 — This-week | Plan ahead | Birthday gift needed, non-urgent school action |
| 4 — Glance | Nice to know | Morning Checklist (routine), Calendar conflict summary |

## Calendar Conflict Card

| Field | Value |
|---|---|
| **Purpose** | Surface scheduling clashes so the day stays on track |
| **Location** | Lives inside the existing Calendar card — a banner at top of the events list |
| **Visibility** | `derived.hasMorningOverlap === true` OR `derived.peter0800_0900Risk === true` |
| **Required data** | `derived.conflicts[]`, `derived.peter0800_0900Risk` |
| **Optional OpenClaw fields** | `enhanced.summary` (≤120 chars), `enhanced.suggestion` (≤140 chars) |
| **Deterministic fallback copy** | Title: `Heads up — {time} overlap`. Body: `{eventA.title} and {eventB.title} both at {time}.` |
| **Actions** | `Dismiss` (hides for 2 h), `Open calendar detail` |
| **Priority** | Tier 4 normally; Tier 2 if the conflict starts within 15 minutes |

## Calendar Conflict Needs Action

| Field | Value |
|---|---|
| **Purpose** | Put calendar overlaps that already have a reschedule suggestion into the actionable queue |
| **Location** | Needs Action panel and Worker `/api/needs-action/done` matching surface |
| **Visibility** | `derived.hasMorningOverlap === true` with at least one `derived.conflicts[]` row |
| **Required data** | First conflict pair: `a.id`, `a.title`, `b.id`, `b.title`, `at` |
| **Deterministic fallback copy** | Title: `Resolve calendar conflict`. Detail: `{eventA.title} overlaps {eventB.title}. Confirm before rescheduling.` |
| **Actions** | Open/review calendar detail only. Completion returns `confirm_required`; never silently moves or edits a calendar event. |
| **Priority** | Important; urgent only when the conflict starts in the next 15 minutes |

## Morning School Checklist Card

| Field | Value |
|---|---|
| **Purpose** | Low-friction pre-school reminders; weather-aware |
| **Location** | Contextual slot (replaces Photos card 06:00–09:00 on school days) |
| **Visibility** | `derived.showMorningChecklist === true` |
| **Required data** | `derived.checklistItems[] = {id, label, done, conditionReason?}` |
| **Optional OpenClaw fields** | `enhanced.intro` (≤100 chars, varied phrasing per render) |
| **Deterministic fallback copy** | Intro: `Quick check before heading out.` |
| **Actions** | Toggle item `done`; double-click to reset all |
| **Priority** | Tier 4 |

## School Updates Card

| Field | Value |
|---|---|
| **Purpose** | Surface only the school email items that matter this week |
| **Location** | Mid-bottom grid slot (right of Photos) — already present as Email School Card; content swapped |
| **Visibility** | Always mounted if `raw.schoolItems.length > 0`; tinted red if `derived.hasUrgentSchoolItem === true` |
| **Required data** | `derived.rankedSchoolItems[] = {id, kind, title, summary, suggestedAction?, dueDate?, eventDate?, child?, class?, teacher?, urgency}` |
| **Optional OpenClaw fields** | per item: `suggestedAction`, `class`, `teacher`, `enhanced.summary`; card-level `enhanced.intro` |
| **Deterministic fallback copy** | Item summary = first 120 chars of email snippet |
| **Actions** | Tap an item → open fullscreen email view; inline `Done` to dismiss |
| **Priority** | Tier 1 (urgent) · Tier 2 (others) |

## Claw Suggestions Card

| Field | Value |
|---|---|
| **Purpose** | A single always-visible place for suggested next actions across all derived state |
| **Location** | Right column, replaces Fun Fact |
| **Visibility** | `derived.showClawSuggestions === true` (i.e. any suggestions) |
| **Required data** | `derived.clawSuggestions[] = {id, tier, icon, title, detail, actionKind, targetRef?}` |
| **Optional OpenClaw fields** | per item: `enhanced.title`, `enhanced.detail`; card-level `enhanced.intro` |
| **Deterministic fallback copy** | Item title = derived default (e.g. `Resolve 8:30 conflict`) |
| **Actions** | Tap row → performs `actionKind` (`openEventDetail`, `orderGift`, `markTakeoutDecided`, etc.). All actions are suggestions — never silent mutations of shared state |
| **Priority** | Ranking: Tier 1 first, then 2, then 3/4; within tier, OpenClaw may re-order |

## Birthdays Card

| Field | Value |
|---|---|
| **Purpose** | See who's up next + whether gifts are handled |
| **Location** | Mid-top slot (existing Birthdays card) |
| **Visibility** | Always (when `raw.birthdays.length > 0`); individual pill tints based on `giftStatus` |
| **Required data** | `derived.birthdaysRanked[] = {id, name, daysUntil, giftStatus}` |
| **Optional OpenClaw fields** | `enhanced.giftIdeas[]` per person: `[{idea, priceEstimate, rationale}]` |
| **Deterministic fallback copy** | `Find ideas` button still enabled — OpenClaw call happens on click |
| **Actions** | Clicking the pill cycles `giftStatus`: `unknown → needed → ordered → ready → unknown`. Optimistic update; persists via `useBirthdayGiftWriter` → `PATCH /api/birthdays/:id` with localStorage fallback. |
| **Priority** | Tier 3 when `giftStatus in {needed,unknown}` within 14 days |

## Bedtime Card (Toast Overlay)

| Field | Value |
|---|---|
| **Purpose** | Gentle reminder 30 min before bedtime |
| **Location** | Floating toast, bottom-right; does not steal focus |
| **Visibility** | `derived.bedtimeReminderActive === true` |
| **Required data** | `derived.bedtimeWindow = {bedtimeAt, minutesUntil, kidsInRange[]}` |
| **Optional OpenClaw fields** | `enhanced.copy` — softer phrasing (≤160 chars) |
| **Deterministic fallback copy** | `Winding down in {min} minutes — bedtime at {bedtime}.` |
| **Actions** | `Snooze 10 min` (deterministic), `Start bedtime` (sets `bedtimeDismissedUntil`) |
| **Priority** | Tier 1 while active |

## Wake-Up Log Needs Action

| Field | Value |
|---|---|
| **Purpose** | Capture Lucy/Livy wake times so bedtime is derived from the actual day |
| **Location** | Needs Action panel and Worker `/api/wake-times/today` |
| **Visibility** | `derived.wakeLogNeeded === true` while either child is missing today's wake time |
| **Required data** | `derived.wakeLogStatus = {children, missing}`; Worker KV record `hc:wake-times:{date}` |
| **Deterministic fallback copy** | Title: `Log wake-up times`. Detail: `Say "Hey Homer, both girls woke up at 7:00."` |
| **Actions** | Voice command auto-records stated facts: `both girls woke up at <time>` or `Lucy woke up at <time> and Livy woke up at <time>` |
| **Priority** | Tier 2 until both wake times are logged |

## Wake-Derived Bedtime

| Field | Value |
|---|---|
| **Purpose** | Compute bedtime from actual wake times rather than a fixed schedule when today's wake log exists |
| **Visibility** | Feeds Bedtime Card; no standalone card |
| **Required data** | `derived.wakeDerivedBedtimes[] = {childId, childName, wakeAt, bedtimeAt, source}` |
| **Deterministic rule** | `bedtimeAt = wakeAt + 13.5 hours`; `cleanupAt = earliest bedtimeAt - 1 hour` |
| **Actions** | None; presentation-only derived state |
| **Priority** | Bedtime toast priority still comes from the Bedtime Card |

## Takeout Card

| Field | Value |
|---|---|
| **Purpose** | Prompt dinner decision at 16:00 when email receipt history shows 3+ days since the last takeout order, surface habit-aware suggestions |
| **Location** | Contextual slot (replaces Photos 16:00–20:00 if undecided and eligible) |
| **Visibility** | `derived.takeoutDecisionPending === true` |
| **Required data** | `derived.takeoutState = {decision, vendor?, suggestedVendors: string[], recentVendors?, lastOrderDate?, daysSinceLastOrder?}` |
| **Optional OpenClaw fields** | `enhanced.topPicks[]` w/ reasoning, `enhanced.intro` |
| **Deterministic fallback copy** | Suggestions use Worker-provided Gmail receipt history from `scripts/update-takeout-suggestions.py`, ranking restaurants not ordered recently. If email history is missing, the takeout Needs Action does not fire. |
| **Actions** | Tap vendor → sets `takeout.today.decision = 'takeout'` + `vendor`; `Cook tonight` sets `decision='home'` |
| **Priority** | Tier 2 |

## Lunch Decision Card

| Field | Value |
|---|---|
| **Purpose** | At 18:00, lock in school-vs-home lunch for tomorrow |
| **Location** | Contextual slot (replaces Photos 18:00–22:00 if undecided) |
| **Visibility** | `derived.lunchDecisionNeeded === true` |
| **Required data** | `derived.lunchContext = {dateLabel, isSchoolDay, menu?: string[]}`; `raw.lunchDecisions[tomorrow]` |
| **Optional OpenClaw fields** | `enhanced.kidPreferenceHint` |
| **Deterministic fallback copy** | Menu from ingested PDFs, literal bullet list |
| **Actions** | Two big buttons: `School lunch` / `Home lunch` per child; persist to `raw.lunchDecisions[tomorrow]` |
| **Priority** | Tier 2 |

## Ordering in the "contextual slot"

The Photos panel's mid-bottom slot is reserved for **one** contextual card.
When multiple contextual cards are eligible at once, pick the highest tier; on
ties, prefer the one whose deadline is closer.

```
if bedtimeReminderActive          → nothing competes; Bedtime is a floating toast, separate
else if lunchDecisionNeeded       → Lunch Decision       (tier 2, deadline 22:00)
else if takeoutDecisionPending    → Takeout Decision     (tier 2, deadline 20:00)
else if showMorningChecklist      → Morning Checklist    (tier 4, deadline 09:00)
else                              → Photos (default)
```

## Accessibility / TV-friendliness rules

- Minimum font size on any always-visible card: 22 px (before 2× scale).
- Minimum tap target: 72 px square (HandController gestures + voice select it).
- Each card displays at most one OpenClaw-generated paragraph; bulleted lists
  stay deterministic.
- Copy fallback always works offline — never "Loading…" as the visible state.
