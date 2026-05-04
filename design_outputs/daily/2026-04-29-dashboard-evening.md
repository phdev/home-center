# Design Claw — 2026-04-29 — dashboard-evening

**Topic.** evening wind-down — strip the screen to kids' bedtime + tomorrow's setup only  
**Topic id.** `evening-wind-down`

## Concept — Bedtime Gate, Lunch Queue

### Layout idea
At 20:45, `bedtimeReminderActive` owns the screen as the single primary overlay: the bedtime toast is the only visible card and it visually gates the dashboard. The current top-row `calendar` and `weather` cards are suppressed because they are informational tomorrow items, and the `lunchDecision` card is queued rather than shown beside bedtime. After the one allowed tap dismisses `bedtimeToast`, the layout resolves to one tight contextual card: `lunchDecision`, because `lunchDecisionNeeded` is the only remaining actionable wind-down setup flag. If both flags are false, the evening dashboard falls back to an empty/quiet ambient state rather than filling space with tomorrow calendar or weather.

### Why it fits
This fits the snapshot because the active flags are specifically `bedtimeReminderActive: true` and `lunchDecisionNeeded: true`, while morning, calendar-risk, takeout, birthday, and Claw suggestion flags are false. The current structure already gives `bedtimeToast` priority 1 in the overlay and `lunchDecision` priority 2 in the mid region; this concept makes that priority strict by not rendering the priority-2 lunch prompt until the bedtime overlay is dismissed. It also fits today's evening wind-down theme by stripping the TV to kids' bedtime first, then one tomorrow setup decision, instead of showing the current `calendar` and `weather` cards for tomorrow.

### Tradeoff
The cost is that tomorrow's calendar and forecast are not visible during wind-down, even though they exist in the current top region. This is worse for a family that expects the evening TV to preview the next day passively, but it protects the under-2-second bedtime signal and avoids making the screen feel like a general dashboard at 20:45.

### Implementation hint
- Add a deterministic evening render order: if `bedtimeReminderActive` is true, render only `bedtimeToast` in the overlay and suppress all ambient cards.\n- On the single tap dismiss, clear or locally acknowledge the bedtime overlay, then re-evaluate flags; if `lunchDecisionNeeded` is true, render only the existing `ContextualSlot` with `lunchDecision`.\n- In `dashboard-evening`, gate `calendar` and `weather` behind a false condition while either `bedtimeReminderActive` or `lunchDecisionNeeded` is true, rather than letting the stacked top row remain visible.

### Prototype first
Build the two-state flow: bedtime-only overlay at 20:45, then one tap reveals the existing `lunchDecision` card with no calendar or weather cards.

### Memory alignment
**Reinforces.**
- One primary thing, clearly, before any secondary things.
- The primary signal must be readable in under two seconds from across a room.
- Card visibility is driven by deterministic derived-state flags, never by LLM output.
- A prompt that produces a decision beats pure information.
- Interruptive behavior is a single overlay (e.g. bedtime toast), never multiple simultaneous modals.
- A single contextual slot that swaps its card based on the highest-tier active flag.

**Avoids rejected.**
- Rendering secondary items alongside a primary prompt (they compete for attention and dilute the decision).
- Information-dense screens that trade clarity for coverage.
- Dense multi-column dashboards that trade glanceability for information density.
- Show tomorrow items in the night wind-down view.
- Too much text.
- Avoid unnecessary text.
