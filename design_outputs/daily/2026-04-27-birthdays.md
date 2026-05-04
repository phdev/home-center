# Design Claw — 2026-04-27 — birthdays

**Topic.** passive gift planning — birthdays compound into a calm lead-time signal, not a prompt  
**Topic id.** `passive-gift-planning`

## Concept — Primary Prompt with Calmer Side Rail

### Layout idea
Use a single dominant card in the upper-left as the one thing the room should notice first: the highest-tier active flag becomes the primary prompt, and when multiple flags are true the screen resolves by deterministic priority rather than stacking competing prompts. In this snapshot, birthdayGiftNeeded should occupy that primary slot because today's theme is passive gift planning and birthdays compound into a lead-time signal. The current secondary prompt surface stays a narrow side rail or lower strip with only the next two smallest cards: calendar and weather as background context, with schoolUpdates only if space remains under the max_visible_cards cap. The contextualSlot remains a single swap region, but it should not compete with the birthday card when birthdayGiftNeeded is true; instead it becomes the place for the next actionable non-birthday item when no birthday gift prompt is active. showClawSuggestions stays as a tiny secondary card or hidden if it would add noise, since the primary signal must stay readable in under two seconds.

### Why it fits
The snapshot already says birthdayGiftNeeded is true, showClawSuggestions is true, and takeoutDecisionPending is also true, so this concept answers the open question of how to behave when multiple primary flags are simultaneously true: it makes one deterministic winner. That matches the memory rule that a prompt that produces a decision beats pure information, and it fits the theme by treating birthdays as a calm lead-time cue instead of a demand. It also preserves the TV constraint by keeping one large, glanceable primary region and only a small amount of supporting context, avoiding the rejected dense multi-column dashboard pattern. The current_structure already has a top row and a contextualSlot, so this concept uses the existing structure rather than inventing a new component system.

### Tradeoff
This is worse when several important family decisions truly need equal attention, because the layout intentionally suppresses everything except the single highest-priority prompt. It can also feel under-informative if someone expects to see all active family signals at once, but that is the deliberate cost of keeping the screen readable from across a room.

### Implementation hint
- Treat `birthdayGiftNeeded` as the top-priority selector for the primary card when true; otherwise fall through to the existing contextualSlot priority order.
- Render one large primary card in the upper-left and keep all other active cards as small background cards in a secondary rail or lower strip, capped by `max_visible_cards`.
- Keep `showClawSuggestions` as a secondary, non-competing card or hide it when any primary prompt is active, so the screen never shows multiple equal prompts at once.

### Prototype first
Build just the deterministic card-picker that swaps the single upper-left card to the birthday gift prompt when `birthdayGiftNeeded` is true, with two small background cards beside or below it.

### Memory alignment
**Reinforces.**
- one primary thing, clearly, before secondary things
- Actionable beats informational
- Card visibility is driven by deterministic derived-state flags, never by LLM output
- Place urgent items in the upper-left of the screen
- accepted_patterns: A single contextual slot that swaps its card based on the highest-tier active flag

**Avoids rejected.**
- Rendering secondary items alongside a primary prompt (they compete for attention and dilute the decision)
- Dense multi-column dashboards that trade glanceability for information density
- Too much text
- Do not present dinner voting UI as a suggested action
- Show smaller cards in the foreground
