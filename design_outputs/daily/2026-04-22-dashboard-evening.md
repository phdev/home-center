# Design Claw — 2026-04-22 — dashboard-evening

**Topic.** evening wind-down — strip the screen to kids' bedtime + tomorrow's setup only  
**Topic id.** `evening-wind-down`

## Concept — Bedtime Gate + Tomorrow Strip

### Layout idea
Use one full-width primary overlay region for the active bedtime reminder and suppress all other content until it is dismissed; underneath, keep a single slim secondary strip with exactly one contextual slot that shows tomorrow setup only. The layout is a two-tier stack: top layer is the bedtime toast as the only interruptive element, because bedtimeReminderActive is true; below it, the main dashboard reduces to a single tomorrow panel that can host either the calendar or the lunchDecision card, but never both at once. Since showMorningChecklist is false and hasMorningOverlap is false, there is no checklist region, and because showClawSuggestions is false, no suggestion block appears. This keeps one scan path: first acknowledge bedtime, then glance at the one tomorrow-action card that the derived state promotes via deterministic priority.

### Why it fits
This matches the evening wind-down theme exactly: the snapshot says "goal: wind the house down — only kids' bedtime and tomorrow's setup matter" and the constraint says the primary signal must be readable in under 2 seconds. The current_structure already contains a single overlay card, bedtimeToast, which should remain the only interruptive surface while bedtimeReminderActive is true. The midday-style clutter is avoided by collapsing the mid region into a single contextual slot instead of showing both calendar and lunchDecision together; that respects "one primary thing, clearly, before secondary things" and "show only the essential information at this moment." It also honors the state flags: lunchDecisionNeeded is true, but showMorningChecklist, hasMorningOverlap, peter0800_0900Risk, birthdayGiftNeeded, takeoutDecisionPending, and showClawSuggestions are all false, so the UI should not imply urgency beyond bedtime and one tomorrow setup action.

### Tradeoff
This concept deliberately hides potentially useful secondary tomorrow context, so if families want to review both calendar and lunch decisions at once, they must dismiss the overlay or accept that only one tomorrow card is visible. It is worse on nights when multiple non-bedtime decisions become equally urgent, because it forces strict prioritization rather than comparison.

### Implementation hint
- Render bedtimeToast as a single full-screen or full-width overlay region whenever bedtimeReminderActive is true; allow one tap to dismiss and do not stack any other modal on top.
- Behind the overlay, drive a single ContextualSlot from derived-state priority so only one secondary card can exist at a time: calendar if tomorrow setup is the only relevant item, otherwise lunchDecision when lunchDecisionNeeded is true.
- Hide all checklist-style content entirely because showMorningChecklist is false and the design memory rejects family items as a checkable to-do list.

### Prototype first
Build the bedtime overlay with a single dismiss action and one underneath contextual slot that switches between calendar and lunchDecision based only on derived-state flags.

### Memory alignment
**Reinforces.**
- Show only the essential information at this moment
- One primary thing, clearly, before any secondary things
- Card visibility is driven by deterministic derived-state flags, never by LLM output
- accepted_patterns: A single contextual slot that swaps its card based on the highest-tier active flag
- accepted_patterns: Interruptive behavior is a single overlay (e.g. bedtime toast), never multiple simultaneous modals

**Avoids rejected.**
- Information-dense screens that trade clarity for coverage
- Rendering secondary items alongside a primary prompt (they compete for attention and dilute the decision)
- Rendering family items as a checkable to-do list
- Dense multi-column dashboards that trade glanceability for information density
- Progress bars on the dashboard (they signal a productivity app, not a home)
