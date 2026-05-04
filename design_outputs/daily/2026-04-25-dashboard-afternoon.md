# Design Claw — 2026-04-25 — dashboard-afternoon

**Topic.** afternoon takeout decision — surface the choice early enough to act without cluttering the screen  
**Topic id.** `afternoon-takeout-lead-time`

## Concept — Single Decision Runway

### Layout idea
Use a single full-width primary card in the middle of the TV for the active decision, and push everything else into smaller background cards only if they do not compete. Here, `takeoutDecisionPending` wins the contextual slot, so the screen should center one large takeout chooser with one-tap vendor options directly in the card; `schoolUpdates` can remain as a smaller secondary card below or beside it only if there is room under the 4-card limit, while `calendar`, `birthdays`, and `weather` stay visually recessed in the top row as background context. `birthdayGiftNeeded` should not become a competing card in this moment; it is only allowed as a tiny secondary alert line or deferred until the takeout decision is resolved. The flow is deterministic: highest-tier active flag occupies the runway, and all other visible items are subordinate and non-interactive unless they are the next immediate family action.

### Why it fits
This matches the 16:30 afternoon goal to surface the one dinner decision early enough to act without clutter, and it fits the snapshot because `takeoutDecisionPending: true` is the clearest actionable flag while `showClawSuggestions: true` can support the choice without becoming a separate competing surface. The current structure already has a `takeoutDecision` contextual slot that displaces Photos, which aligns with making the decision the center of the screen. It also respects the shared 4K TV constraint and the under-2-second glanceability requirement by keeping one dominant card and minimizing the number of competing regions. `birthdayGiftNeeded: true` is important but not tonight's primary action, so it should stay secondary rather than stealing the runway from dinner.

### Tradeoff
When multiple urgent flags are true, this concept intentionally suppresses secondary needs, so a family might not notice a birthday task or other non-dinner item until after the takeout choice is made. That is the cost of preserving a single clear action on a shared TV; it is worse if the family expects a broad overview of everything pending at once.

### Implementation hint
- Build a deterministic priority resolver that maps active flags to exactly one primary slot, with `takeoutDecisionPending` outranking `birthdayGiftNeeded`, `calendar`, `weather`, and `schoolUpdates` for the afternoon screen.
- Render the primary slot as one full-width decision card with 2-4 vendor choices and a single tap target per vendor; keep all other cards smaller and visually backgrounded.
- If `birthdayGiftNeeded` is true while takeout is pending, show it only as a compact secondary line below the primary card, not as its own card or overlay.

### Prototype first
Prototype only the full-width takeout decision card occupying the main runway with one-tap vendor choices, and hide all other competing cards except tiny background context.

### Memory alignment
**Reinforces.**
- Show only the essential information at this moment.
- Clarity beats completeness — prefer leaving something out to crowding the primary signal.
- The primary signal must be readable in under two seconds from across a room.
- One primary thing, clearly, before any secondary things.
- Card visibility is driven by deterministic derived-state flags, never by LLM output.
- A prompt that produces a decision beats pure information.
- accepted_patterns: A single contextual slot that swaps its card based on the highest-tier active flag.
- accepted_patterns: Keep the Single Runway Card direction (morning dashboard = one full-width checklist card + inline risk line).
- preferences: Show dinner voting UI directly.

**Avoids rejected.**
- Rendering secondary items alongside a primary prompt (they compete for attention and dilute the decision).
- Information-dense screens that trade clarity for coverage.
- Dense multi-column dashboards that trade glanceability for information density.
- Rendering family items as a checkable to-do list.
- Progress bars on the dashboard (they signal a productivity app, not a home).
- Do not present dinner voting UI as a suggested action.
