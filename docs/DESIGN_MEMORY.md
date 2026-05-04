# David Design Memory

Generated: 2026-05-03T20:33:01-07:00

This file is generated from David's structured design memory.
Do not edit it by hand; run `python scripts/sync_design_memory_pack.py` from `/Users/peter/home-center`.

## How Other Chats Should Use This

- For Home Center UI, dashboard, family-screen, or design questions, read this file before proposing UI changes.
- Treat principles, preferences, accepted patterns, and rejected patterns as binding guidance unless Peter explicitly overrides them.
- Use recent design artifacts as examples and source material, not as automatically approved final specs.
- In group chats, use this to shape design answers; do not dump private file paths or long design history unless Peter asks.

## Source Paths

- Structured memory: `/Users/peter/home-center/design_memory`
- Daily artifacts: `/Users/peter/home-center/design_outputs/daily`
- Home Center copy: `/Users/peter/home-center/docs/DESIGN_MEMORY.md`
- OpenClaw copy: `/Users/peter/.openclaw/workspace/DAVID_DESIGN_MEMORY.md`

## Design Principles

- Show only the essential information at this moment. Every element on screen must justify its presence. (2026-04-21, seed)
- Clarity beats completeness — prefer leaving something out to crowding the primary signal. (2026-04-21, seed)
- The primary signal must be readable in under two seconds from across a room. (2026-04-20, seed)
- One primary thing, clearly, before any secondary things. (2026-04-20, seed)
- Card visibility is driven by deterministic derived-state flags, never by LLM output. (2026-04-20, seed)
- A prompt that produces a decision beats pure information. (2026-04-20, seed)
- Avoid patterns that make the interface feel like a checklist app rather than a home. (2026-04-21, feedback)
- Keep the screen visually concise. (2026-04-22, telegram)
- Prioritize wind-down items for tonight only. (2026-04-22, telegram)
- Priority should map to visual position in the upper-left. (2026-04-25, telegram)
- Avoid excessive internal whitespace in card layouts. (2026-04-25, telegram)
- Prioritized cards should be space-efficient. (2026-04-26, telegram)
- Prioritize dinner first. (2026-05-03, telegram)

## Peter Preferences

- Prefer cards, lists, and a single overlay over novel components. (2026-04-20, seed)
- The dashboard should not feel like a productivity app (no todo lists, progress bars, streaks). (2026-04-20, seed)
- Use smaller cards in the background. (2026-04-22, telegram)
- Show dinner voting UI directly. (2026-04-23, telegram)
- This direction is liked. (2026-05-01, telegram)

## Accepted Patterns

- A single contextual slot that swaps its card based on the highest-tier active flag. (2026-04-20, seed)
- Interruptive behavior is a single overlay (e.g. bedtime toast), never multiple simultaneous modals. (2026-04-20, seed)
- Keep the Single Runway Card direction (morning dashboard = one full-width checklist card + inline risk line). (2026-04-21, feedback)
- In Morning mode, hide the clock in the header — the kitchen already has one. (2026-04-21, feedback)
- Place urgent items in the upper-left of the screen. (2026-04-25, telegram)
- Keep cards tight with minimal empty space. (2026-04-25, telegram)
- Use passive gift planning. (2026-04-28, telegram)
- Present varied gift ideas. (2026-04-28, telegram)
- Place the calendar on the left. (2026-05-02, telegram)

## Rejected Patterns

- Information-dense screens that trade clarity for coverage. (2026-04-21, seed)
- Rendering secondary items alongside a primary prompt (they compete for attention and dilute the decision). (2026-04-21, seed)
- Rendering family items as a checkable to-do list. (2026-04-20, seed)
- Dense multi-column dashboards that trade glanceability for information density. (2026-04-20, seed)
- Progress bars on the dashboard (they signal a productivity app, not a home). (2026-04-21, feedback)
- Too much text. (2026-04-22, telegram)
- Show smaller cards in the foreground. (2026-04-22, telegram)
- Show tomorrow items in the night wind-down view. (2026-04-22, telegram)
- Do not present dinner voting UI as a suggested action. (2026-04-23, telegram)
- Use overly spacious cards for prioritized items. (2026-04-26, telegram)
- Leave lots of empty space inside prioritized cards. (2026-04-26, telegram)
- Avoid unnecessary text. (2026-04-28, telegram)
- Do not place other content before dinner. (2026-05-03, telegram)

## Open Questions

- How should the dashboard behave when 3+ primary flags are simultaneously true? (2026-04-20, seed)
- Whether to send a design daily. (2026-04-21, telegram)
- Need the design regenerated with the provided feedback incorporated. (2026-04-23, telegram)
- Whether those designs were accepted. (2026-04-25, telegram)
- Respond to user questions. (2026-04-25, telegram)
- Clarify whether those designs were accepted. (2026-04-25, telegram)
- Clarify what “this” refers to. (2026-04-28, telegram)
- Clarify which specific pattern in this design should be preserved. (2026-04-29, telegram)
- What specific pattern does "this" refer to? (2026-04-30, telegram)

## Recent Design Artifacts

### 2026-05-03 - Earliest School Deadline Hero

- Context: school_updates - school updates as a deadline-first layout — earliest due date drives the hero slot
- Layout idea: Replace the current stacked priority order with one upper-left hero card for schoolUpdates whenever it contains the earliest actionable due date today or tomorrow; the hero shows only that one school deadline and its single next action. The existing contextualSlot remains secondary when takeoutDecisionPending is true, birthdays becomes a small background card because birthdayGiftNeeded is true, and clawSuggestions i...
- Why it fits: Today’s theme is deadline-first school updates, but the snapshot currently places schoolUpdates in the mid row at priority 3 while clawSuggestions and contextualSlot both have priority 1. This concept makes the earliest school due date the primary scan target, instead of burying it below top-row cards. It still respects the active snapshot flags: takeoutDecisionPending remains actionable but secondary, birthdayGiftN...
- Tradeoff: This is worse when dinner really needs an immediate family decision before any school deadline; promoting schoolUpdates can delay the takeout prompt even though takeoutDecisionPending is true.
  - Markdown: `/Users/peter/home-center/design_outputs/daily/2026-05-03-school_updates.md`
  - JSON: `/Users/peter/home-center/design_outputs/daily/2026-05-03-school_updates.json`
  - Structural PNG: `/Users/peter/home-center/design_outputs/daily/2026-05-03-school_updates.png`
  - Polish PNG: `/Users/peter/home-center/design_outputs/daily/2026-05-03-school_updates-polish.png`

### 2026-05-02 - Dinner Decision Lead Card

- Context: dashboard-afternoon - afternoon takeout decision — surface the choice early enough to act without cluttering the screen
- Layout idea: Replace the current stacked_cards competition with one pinned primary region in the upper-left/upper band: a large takeoutDecision card shown because takeoutDecisionPending is true. Inside it, show the dinner choice directly as one-tap vendor options, not as a suggestion. Secondary cards are limited to a small background row after the primary decision: birthdays only if birthdayGiftNeeded remains true, plus calendar...
- Why it fits: At 16:30 the stated goal is to surface the one decision before dinner, and the snapshot has takeoutDecisionPending: true with ambient primary / one tap to choose a vendor. The current structure puts clawSuggestions and takeoutDecision at equal priority 1 in separate regions, which violates the theme by splitting attention. This concept makes takeoutDecision the single primary item, keeps birthdayGiftNeeded as passiv...
- Tradeoff: This is worse when the family expects the TV to be a broad afternoon status board, because weather, calendar, school updates, and Claw suggestions may be hidden or reduced while dinner is pending.
  - Markdown: `/Users/peter/home-center/design_outputs/daily/2026-05-02-dashboard-afternoon.md`
  - JSON: `/Users/peter/home-center/design_outputs/daily/2026-05-02-dashboard-afternoon.json`
  - Structural PNG: `/Users/peter/home-center/design_outputs/daily/2026-05-02-dashboard-afternoon.png`
  - Polish PNG: `/Users/peter/home-center/design_outputs/daily/2026-05-02-dashboard-afternoon-polish.png`

### 2026-05-01 - Weekend Dinner Runway

- Context: dashboard - weekend vs weekday dashboards — which cards disappear, which expand
- Layout idea: Use one upper-left primary runway card for the highest active weekend action. In this snapshot, `takeoutDecisionPending: true` makes the contextual slot expand into a large `Dinner Tonight` decision card and move ahead of the existing `clawSuggestions` card, even though `showClawSuggestions: true`. Secondary cards become a tight supporting row after the primary: `birthdays` appears as passive gift planning because `...
- Why it fits: The snapshot has two active actionable/prompt-like states: `takeoutDecisionPending: true` and `birthdayGiftNeeded: true`, plus `showClawSuggestions: true`. For the weekend-vs-weekday theme, the concept makes the weekend dashboard drop inactive weekday structure such as Morning Checklist, Lunch, morning overlap, and school-first emphasis, while expanding the weekend dinner decision. It also corrects the current struc...
- Tradeoff: This is worse when the family expects a broad overview of calendar, weather, school updates, and suggestions all at once; the design intentionally suppresses or shrinks secondary information whenever a weekend decision is pending, so completeness is sacrificed for a faster shared decision.
  - Markdown: `/Users/peter/home-center/design_outputs/daily/2026-05-01-dashboard.md`
  - JSON: `/Users/peter/home-center/design_outputs/daily/2026-05-01-dashboard.json`
  - Structural PNG: `/Users/peter/home-center/design_outputs/daily/2026-05-01-dashboard.png`
  - Polish PNG: `/Users/peter/home-center/design_outputs/daily/2026-05-01-dashboard-polish.png`

### 2026-04-30 - Deterministic Dinner-First Hero

- Context: dashboard - prioritization when 3+ derived flags are simultaneously true — which one owns the hero slot
- Layout idea: Replace the current equal-weight stacked_cards structure with one pinned upper-left hero region plus a compact secondary row. A deterministic hero resolver chooses exactly one owner: interruptive tonight reminders first, then immediate household decisions, then schedule risk, then passive relationship planning, then general suggestions. In this snapshot, takeoutDecisionPending owns the hero slot and renders Dinner T...
- Why it fits: The snapshot has three true flags at once: takeoutDecisionPending, birthdayGiftNeeded, and showClawSuggestions. The current structure gives both clawSuggestions and contextualSlot priority 1 in different regions, which creates two competing primaries. This concept resolves that conflict by making the actionable dinner decision the single hero because the memory says a prompt that produces a decision beats pure infor...
- Tradeoff: This is worse when the family expects broad situational awareness from the TV, because weather, calendar, or school updates may be pushed down or hidden while a decision flag is active. It also makes the priority resolver more opinionated: a birthday gift may feel underplayed if the family considers it urgent, but the design intentionally favors the decision that can be completed immediately.
  - Markdown: `/Users/peter/home-center/design_outputs/daily/2026-04-30-dashboard.md`
  - JSON: `/Users/peter/home-center/design_outputs/daily/2026-04-30-dashboard.json`
  - Structural PNG: `/Users/peter/home-center/design_outputs/daily/2026-04-30-dashboard.png`
  - Polish PNG: `/Users/peter/home-center/design_outputs/daily/2026-04-30-dashboard-polish.png`

### 2026-04-29 - Bedtime Gate, Lunch Queue

- Context: dashboard-evening - evening wind-down — strip the screen to kids' bedtime + tomorrow's setup only
- Layout idea: At 20:45, `bedtimeReminderActive` owns the screen as the single primary overlay: the bedtime toast is the only visible card and it visually gates the dashboard. The current top-row `calendar` and `weather` cards are suppressed because they are informational tomorrow items, and the `lunchDecision` card is queued rather than shown beside bedtime. After the one allowed tap dismisses `bedtimeToast`, the layout resolves...
- Why it fits: This fits the snapshot because the active flags are specifically `bedtimeReminderActive: true` and `lunchDecisionNeeded: true`, while morning, calendar-risk, takeout, birthday, and Claw suggestion flags are false. The current structure already gives `bedtimeToast` priority 1 in the overlay and `lunchDecision` priority 2 in the mid region; this concept makes that priority strict by not rendering the priority-2 lunch...
- Tradeoff: The cost is that tomorrow's calendar and forecast are not visible during wind-down, even though they exist in the current top region. This is worse for a family that expects the evening TV to preview the next day passively, but it protects the under-2-second bedtime signal and avoids making the screen feel like a general dashboard at 20:45.
  - Markdown: `/Users/peter/home-center/design_outputs/daily/2026-04-29-dashboard-evening.md`
  - JSON: `/Users/peter/home-center/design_outputs/daily/2026-04-29-dashboard-evening.json`
  - Structural PNG: `/Users/peter/home-center/design_outputs/daily/2026-04-29-dashboard-evening.png`
  - Polish PNG: `/Users/peter/home-center/design_outputs/daily/2026-04-29-dashboard-evening-polish.png`

### 2026-04-28 - Morning Runway With Peter Risk Line

- Context: dashboard-morning - reduce morning overload — show only what the family must see between 7am–9am
- Layout idea: Use a single upper-left primary Runway card as the first and largest region: because showMorningChecklist is true at 07:30, it replaces the current stacked mid-row placement and becomes the screen’s main scan target. Inside that card, show the morning checklist as a short non-checkable family runway list, with peter0800_0900Risk rendered as one inline risk line at the top or bottom of the same card rather than as a...
- Why it fits: The snapshot is explicitly a 07:30 morning dashboard whose goal is to clear the morning runway without noise, and the true flags are showMorningChecklist and peter0800_0900Risk. The current structure buries morningChecklist in the mid region while Calendar, Birthdays, and Weather occupy the top row; this concept moves the active primary morning flag to the upper-left and folds Peter’s 08:00–09:00 risk into that same...
- Tradeoff: This is worse when the family expects the TV to be a broad ambient information board, because Weather and Birthdays disappear even though they exist in the current top row. It favors morning actionability over completeness, so low-urgency information may feel absent between 7am and 9am.
  - Markdown: `/Users/peter/home-center/design_outputs/daily/2026-04-28-dashboard-morning.md`
  - JSON: `/Users/peter/home-center/design_outputs/daily/2026-04-28-dashboard-morning.json`
  - Structural PNG: `/Users/peter/home-center/design_outputs/daily/2026-04-28-dashboard-morning.png`
  - Polish PNG: `/Users/peter/home-center/design_outputs/daily/2026-04-28-dashboard-morning-polish.png`

### 2026-04-27 - Primary Prompt with Calmer Side Rail

- Context: birthdays - passive gift planning — birthdays compound into a calm lead-time signal, not a prompt
- Layout idea: Use a single dominant card in the upper-left as the one thing the room should notice first: the highest-tier active flag becomes the primary prompt, and when multiple flags are true the screen resolves by deterministic priority rather than stacking competing prompts. In this snapshot, birthdayGiftNeeded should occupy that primary slot because today's theme is passive gift planning and birthdays compound into a lead-...
- Why it fits: The snapshot already says birthdayGiftNeeded is true, showClawSuggestions is true, and takeoutDecisionPending is also true, so this concept answers the open question of how to behave when multiple primary flags are simultaneously true: it makes one deterministic winner. That matches the memory rule that a prompt that produces a decision beats pure information, and it fits the theme by treating birthdays as a calm le...
- Tradeoff: This is worse when several important family decisions truly need equal attention, because the layout intentionally suppresses everything except the single highest-priority prompt. It can also feel under-informative if someone expects to see all active family signals at once, but that is the deliberate cost of keeping the screen readable from across a room.
  - Markdown: `/Users/peter/home-center/design_outputs/daily/2026-04-27-birthdays.md`
  - JSON: `/Users/peter/home-center/design_outputs/daily/2026-04-27-birthdays.json`
  - Structural PNG: `/Users/peter/home-center/design_outputs/daily/2026-04-27-birthdays.png`
  - Polish PNG: `/Users/peter/home-center/design_outputs/daily/2026-04-27-birthdays-polish.png`

### 2026-04-26 - Deadline Ladder with Single Hero Slot

- Context: school_updates - school updates as a deadline-first layout — earliest due date drives the hero slot
- Layout idea: Use a two-tier stack with one dominant hero card pinned in the upper-left and a narrow supporting column beneath/adjacent it. The hero slot is always occupied by the earliest-due school update when `school_updates` is the theme, so the school item with the nearest deadline becomes the one primary thing. If multiple school deadlines are active, they collapse into a short ranked list inside that same hero card, ordere...
- Why it fits: This matches the theme directly: `deadline-first-school` says the earliest due date drives the hero slot, and the snapshot already has a dedicated `schoolUpdates` card plus a `contextualSlot` that can be deterministically swapped. It also fits the TV constraint by keeping one primary signal readable in under 2 seconds and using the upper-left placement the memory prefers for urgent items. Because `takeoutDecisionPen...
- Tradeoff: This is worse when the family has several equally urgent concerns outside school, because the design intentionally suppresses secondary context to preserve a single scan path. It can feel sparse if the school update is only mildly urgent, since lower-priority items may disappear entirely until the hero is resolved.
  - Markdown: `/Users/peter/home-center/design_outputs/daily/2026-04-26-school_updates.md`
  - JSON: `/Users/peter/home-center/design_outputs/daily/2026-04-26-school_updates.json`
  - Structural PNG: `/Users/peter/home-center/design_outputs/daily/2026-04-26-school_updates.png`
  - Polish PNG: `/Users/peter/home-center/design_outputs/daily/2026-04-26-school_updates-polish.png`

## Implementation Note

David's memory currently stores approved guidance as patterns, preferences, and principles.
It does not yet store a separate per-artifact `approved` flag, so ask Peter before treating a daily artifact as final implementation direction.
