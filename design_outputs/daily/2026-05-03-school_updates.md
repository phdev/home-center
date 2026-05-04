# Design Claw — 2026-05-03 — school_updates

**Topic.** school updates as a deadline-first layout — earliest due date drives the hero slot  
**Topic id.** `deadline-first-school`

## Concept — Earliest School Deadline Hero

### Layout idea
Replace the current stacked priority order with one upper-left hero card for schoolUpdates whenever it contains the earliest actionable due date today or tomorrow; the hero shows only that one school deadline and its single next action. The existing contextualSlot remains secondary when takeoutDecisionPending is true, birthdays becomes a small background card because birthdayGiftNeeded is true, and clawSuggestions is shown only as a small supporting card because showClawSuggestions is true. Calendar stays left-side support, weather is omitted if the six-card limit is pressured.

### Why it fits
Today’s theme is deadline-first school updates, but the snapshot currently places schoolUpdates in the mid row at priority 3 while clawSuggestions and contextualSlot both have priority 1. This concept makes the earliest school due date the primary scan target, instead of burying it below top-row cards. It still respects the active snapshot flags: takeoutDecisionPending remains actionable but secondary, birthdayGiftNeeded remains passive planning, and showMorningChecklist/lunchDecisionNeeded/bedtimeReminderActive stay hidden because their flags are false.

### Tradeoff
This is worse when dinner really needs an immediate family decision before any school deadline; promoting schoolUpdates can delay the takeout prompt even though takeoutDecisionPending is true.

### Implementation hint
- Add a deterministic `primaryHero` selector that compares `schoolUpdates.items[].dueAt` against active actionable flags and returns `schoolDeadline` only when it is the earliest due item in the configured window.
- Render exactly one large hero region first; do not render clawSuggestions or contextualSlot as competing primary cards when the school deadline wins.
- Keep secondary cards to a tight list: contextualSlot for Dinner Tonight, birthdays, calendar, and optional clawSuggestions, capped by `max_visible_cards`.

### Prototype first
Build a dashboard state where schoolUpdates has one assignment due tonight and verify it replaces the mid-row school card with a single upper-left hero while Dinner Tonight becomes secondary.

### Memory alignment
**Reinforces.**
- One primary thing, clearly, before any secondary things.
- Priority should map to visual position in the upper-left.
- Card visibility is driven by deterministic derived-state flags, never by LLM output.
- A prompt that produces a decision beats pure information.
- Place the calendar on the left.

**Avoids rejected.**
- Rendering secondary items alongside a primary prompt (they compete for attention and dilute the decision).
- Information-dense screens that trade clarity for coverage.
- Dense multi-column dashboards that trade glanceability for information density.
- Too much text.
