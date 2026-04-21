# Design Claw — 2026-04-21 — dashboard-morning

**Topic.** reduce morning overload — show only what the family must see between 7am–9am  
**Topic id.** `reduce-morning-overload`

## Concept — Single Runway Morning Card

### Layout idea
Use one full-width primary card in the middle of the TV for the morning runway: since showMorningChecklist is true and peter0800_0900Risk is true, the checklist card becomes the single dominant region, with a short inline risk line attached at the bottom of that same card for the 8:00–9:00 conflict. Everything else in current_structure moves out of view in Morning mode: calendar, birthdays, weather, and schoolUpdates are suppressed rather than stacked, because the screen’s job from 7am–9am is to clear the runway, not summarize the day. If a secondary item must remain, it appears only as a tiny, non-competing footer note beneath the main card, never as a second card.

### Why it fits
This matches the snapshot’s goal to help the family clear the morning runway without adding noise, and it respects the 4K shared TV constraint by keeping the primary signal readable from across the kitchen in under 2 seconds. The derived_state says showMorningChecklist is true and peter0800_0900Risk is true, while all other urgency flags are false; that makes the morning checklist the one thing that must be shown, with the Peter risk line as the only secondary callout. The current_structure already places morningChecklist in the mid region and notes it renders via ContextualSlot, which supports the accepted pattern of a single contextual slot that swaps based on the highest-tier active flag. Hiding calendar, birthdays, weather, and schoolUpdates avoids the rejected dense multi-column / information-dense pattern and avoids rendering secondary items alongside the primary prompt.

### Tradeoff
This concept gives up visibility into the rest of the day, so it is worse when the family needs a fuller situational overview or when multiple non-morning decisions are active; it intentionally chooses omission over coverage.

### Implementation hint
- Render one full-width ContextualSlot card for Morning mode, selecting morningChecklist whenever showMorningChecklist is true, and suppress sibling cards in the same viewport.
- Inside that card, reserve a single inline risk strip for peter0800_0900Risk so the conflict is visible without becoming a second card.
- If any other flags become true later, do not add more visible cards in Morning mode; keep a single primary card plus at most one secondary inline note.

### Prototype first
Build a single full-width morningChecklist card with an attached Peter 8–9 risk line and hide all other dashboard cards.

### Memory alignment
**Reinforces.**
- show only the essential information at this moment
- One primary thing, clearly, before secondary things
- Card visibility is driven by deterministic derived-state flags, never by LLM output
- accepted_patterns: A single contextual slot that swaps its card based on the highest-tier active flag
- accepted_patterns: Keep the Single Runway Card direction (morning dashboard = one full-width checklist card + inline risk line)

**Avoids rejected.**
- rejected_patterns: Information-dense screens that trade clarity for coverage
- rejected_patterns: Rendering secondary items alongside a primary prompt (they compete for attention and dilute the decision)
- rejected_patterns: Rendering family items as a checkable to-do list
- rejected_patterns: Dense multi-column dashboards that trade glanceability for information density
- rejected_patterns: Progress bars on the dashboard (they signal a productivity app, not a home)
