# Home Center — Derived States

Every flag below is computed by pure functions in `src/core/derivations/`,
composed by `computeDerivedState(raw, context)`. `src/state/deriveState.js`
re-exports that implementation for existing callers. Components never compute
these. Adding a new card? Add its flag here first, then wire display through
`src/core/interventions/engine.js`.

`context = { now: Date, user: { isPeter } }` — all time math uses `context.now`
so the function is fully testable.

---

## `has_morning_overlap`

**Description** Two or more calendar events overlap between 06:00 and 12:00 **today**.

**Inputs** `raw.calendar.events`, `context.now`.

**Deterministic rule**
1. Filter events to `start >= startOfDay(now) && start < noon`.
2. Sort by `start`. Any pair where `a.end > b.start` is an overlap.
3. Flag `true` if at least one overlap exists. Emit `conflicts: {eventA, eventB, at: ISO}[]`.

**Enhancement fields (optional)** `enhanced.summary` (1-sentence OpenClaw copy),
`enhanced.suggestion` (resolution tip).

**Dependent cards** Calendar card (banner), Claw Suggestions.

**Edge cases**
- All-day events: ignored for overlap detection (they always overlap).
- Back-to-back with 0-min gap: not an overlap.
- Declined events (`status: declined`): excluded.

---

## `has_weekday_8_to_9_risk_for_peter`

**Description** Peter has something scheduled within 08:00–09:00 on a weekday **today**. Raises a "watch out while working" flag.

**Inputs** `raw.calendar.events`, `context.now`, `context.user.isPeter`.

**Deterministic rule**
1. `isWeekday = [1..5].includes(now.getDay())`.
2. Filter events overlapping `[todayAt(8), todayAt(9))` **AND** attendees include Peter (by email match) OR owner is Peter's calendar.
3. `true` iff `isWeekday && matches.length > 0`.

**Enhancement fields** none required; Calendar summary copy can note it.

**Dependent cards** Calendar card (extra flag line).

**Edge cases**
- Event fully inside the hour (most likely): still counts.
- Event starts 07:45 and ends 08:30: counts (overlaps the window).
- Weekend: always false.

---

## `show_morning_checklist`

**Description** Time to show the "before you head out" checklist.

**Inputs** `context.now`, `raw.schoolCalendar` (to suppress on school holidays).

**Deterministic rule**
`isWeekday(now) && now.getHours() >= 6 && now.getHours() < 9 && !isSchoolHoliday(now)`.

**Enhancement fields** `enhanced.intro` (OpenClaw opener line).

**Dependent cards** Morning Checklist card.

**Edge cases**
- Early-dismissal days: checklist still shows.
- School holidays: checklist hidden.
- Snow day override: `settings.forceMorningChecklist` can override.

---

## `school_checklist_weather_variant`

**Description** Contextual modifier for the checklist based on weather.

**Inputs** `raw.weather.today`, `raw.checklistConfig`.

**Deterministic rule** Returns an object shaped
`{ highTempF, needsJacket: highTempF < 60, hotDay: highTempF >= 80, rain: precipProb >= 0.5 }`.
Items filtered via `raw.checklistConfig.items.filter(i => matches(i.condition, variant))`.

**Enhancement fields** none.

**Dependent cards** Morning Checklist card (item list).

**Edge cases**
- No forecast: default variant `{ needsJacket: false, hotDay: false, rain: false }` and only base items appear.

---

## `has_school_action_items`

**Description** Any open action-item school updates exist.

**Inputs** `raw.schoolItems[]`.

**Deterministic rule** `schoolItems.some(i => i.kind === 'action' && !i.dismissedAt)`.

**Enhancement fields** none (classification already applied in the item pipeline).

**Dependent cards** School Updates card, Claw Suggestions.

---

## `has_urgent_school_item`

**Description** Any school item with due date ≤ 24 h OR `urgency >= 0.7`.

**Inputs** `raw.schoolItems[]`, `context.now`.

**Deterministic rule**
```
items.some(i =>
  !i.dismissedAt &&
  (
    (i.dueDate && diffHours(i.dueDate, now) <= 24) ||
    i.urgency >= 0.7
  )
)
```

**Enhancement fields** OpenClaw-provided `urgency` is clamped `[0,1]`; deterministic floor of `0.7` applies to `due<=24h` regardless.

**Dependent cards** School Updates card (red tint), Claw Suggestions (top priority).

---

## `show_claw_suggestions`

**Description** Whether the Claw Suggestions card should render.

**Inputs** any other derived state that produces a suggestion.

**Deterministic rule** `suggestions.length > 0`. Always shows when there is at least one suggestion; swaps copy if zero.

**Enhancement fields** `enhanced.suggestions[]` — OpenClaw may re-rank within a tier, never across tiers (urgent > opportunity > nice-to-have).

**Dependent cards** Claw Suggestions card.

---

## `birthday_gift_needed`

**Description** Upcoming birthday whose `giftStatus != 'ready' && giftStatus != 'ordered'`.

**Inputs** `raw.birthdays[]`, `context.now`.

**Deterministic rule**
1. Filter `birthdays.where(daysUntil(date) <= 30)`.
2. Map to `{person, daysUntil, giftStatus}`.
3. Flag is `true` if any has `giftStatus in {'needed','unknown'}`.

**Enhancement fields** `enhanced.gift_ideas[]` per person (optional).

**Dependent cards** Birthdays card, Claw Suggestions.

**Edge cases**
- `giftStatus = 'unknown'` still triggers the flag (we assume gift needed).
- Flip to `'ordered'` via UI CTA → immediate removal from flag.

---

## `bedtime_reminder_active`

**Description** True in the 30-minute window before bedtime (per-child aggregated → earliest).

**Inputs** `raw.bedtime`, `context.now`.

**Deterministic rule**
1. For each child, resolve today's bedtime (weekday vs weekend schedule).
2. `windowStart = bedtime - reminderLeadMin` (default 30).
3. Flag `true` iff `now` is within `[windowStart, bedtime)` for any child.
4. Cleared on `settings.bedtimeDismissedUntil` (until epoch).

**Enhancement fields** `enhanced.copy` — softer phrasing.

**Dependent cards** Bedtime Toast.

**Edge cases**
- Overlapping kids with different bedtimes: the earliest window controls; card lists all kids in range.
- Snooze: pushes `dismissedUntil` forward 10 min.

---

## `takeout_decision_pending`

**Description** Tonight's dinner decision is unmade and the cutoff (16:30 local) has passed or is approaching.

**Inputs** `raw.takeout.today`, `context.now`.

**Deterministic rule**
```
decisionEmpty = !raw.takeout.today || raw.takeout.today.decision === null
reminderTime  = todayAt(16, 30)
flag = decisionEmpty && now >= reminderTime && now.getHours() < 20
```

**Enhancement fields** `enhanced.suggested_vendors[]`, `enhanced.reasoning`.

**Dependent cards** Takeout Decision card, Claw Suggestions.

**Edge cases**
- Decision made later and then cleared: reappears.
- Past 20:00: suppressed (assume decided by action, not app state).

---

## `lunch_decision_needed`

**Description** At 18:00 local, prompt for tomorrow's lunch type if unset.

**Inputs** `raw.lunchDecisions[tomorrow]`, `raw.schoolLunch.menu[tomorrow]`, `context.now`.

**Deterministic rule**
```
tomorrow = dateString(now + 1 day)
unset = !raw.lunchDecisions[tomorrow] || raw.lunchDecisions[tomorrow].decision === null
flag = unset && now.getHours() >= 18 && now.getHours() < 22 && isSchoolDay(tomorrow)
```

**Enhancement fields** `enhanced.kidPreferenceHint`.

**Dependent cards** Lunch Decision card.

**Edge cases**
- Weekend tomorrow: false.
- Holiday tomorrow: false.
- Menu missing: card still shows but menu section renders "Menu not loaded yet — check with school".

---

## `peter_morning_work_block_risk` *(already covered: see `has_weekday_8_to_9_risk_for_peter`)*

## `school_day_early_dismissal`

**Description** Today ends earlier than normal for one or more kids.

**Inputs** `raw.schoolCalendar.today`, `raw.schoolItems`.

**Deterministic rule** If any calendar event with `type='early_dismissal'` OR a school item with `special_context='early_dismissal'`.

**Dependent cards** School Updates card (banner).

---

## `next_meaningful_transition`

**Description** The next time a derived flag will flip. Used to schedule the recompute tick intelligently (not polled every second).

**Inputs** all time-bound flag definitions.

**Deterministic rule** Minimum of the upcoming flip times (bedtime window, 16:30 takeout cutoff, 18:00 lunch prompt, midnight rollover, next event start, etc.).

**Dependent cards** none directly — used by `useDerivedState` hook to throttle.

---

## Adding a new derived state — checklist

1. Add an entry above with: inputs, rule, enhancement fields, dependent cards, edge cases.
2. Add the type in `src/state/types.js` under `DerivedState`.
3. Implement in `src/state/deriveState.js`.
4. Write a unit test in `src/state/__tests__/deriveState.test.js` with fixture inputs.
5. Wire card visibility in `src/cards/registry.js`.
6. Update `home_center_ui_card_contracts.md` with the card contract.
