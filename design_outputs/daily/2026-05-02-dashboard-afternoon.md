# Design Claw — 2026-05-02 — dashboard-afternoon

**Topic.** afternoon takeout decision — surface the choice early enough to act without cluttering the screen  
**Topic id.** `afternoon-takeout-lead-time`

## Concept — Dinner Decision Lead Card

### Layout idea
Replace the current stacked_cards competition with one pinned primary region in the upper-left/upper band: a large takeoutDecision card shown because takeoutDecisionPending is true. Inside it, show the dinner choice directly as one-tap vendor options, not as a suggestion. Secondary cards are limited to a small background row after the primary decision: birthdays only if birthdayGiftNeeded remains true, plus calendar or schoolUpdates if space remains, capped at 4 visible cards total. clawSuggestions is hidden while the takeoutDecision card is primary, even though showClawSuggestions is true, because it competes with the actionable dinner prompt.

### Why it fits
At 16:30 the stated goal is to surface the one decision before dinner, and the snapshot has takeoutDecisionPending: true with ambient primary / one tap to choose a vendor. The current structure puts clawSuggestions and takeoutDecision at equal priority 1 in separate regions, which violates the theme by splitting attention. This concept makes takeoutDecision the single primary item, keeps birthdayGiftNeeded as passive secondary context, and demotes calendar, weather, and schoolUpdates unless they fit after the dinner decision.

### Tradeoff
This is worse when the family expects the TV to be a broad afternoon status board, because weather, calendar, school updates, and Claw suggestions may be hidden or reduced while dinner is pending.

### Implementation hint
- Add a deterministic priority resolver: if takeoutDecisionPending is true, primaryCard = 'takeoutDecision' and suppress clawSuggestions from visibleCards.
- Render primaryCard in a pinned top/upper-left region with direct vendor buttons; keep interaction to one tap and no modal.
- Build secondaryCards from birthdayGiftNeeded, calendar, and schoolUpdates after the primary card, enforcing max_visible_cards: 4.

### Prototype first
Build only the afternoon state where takeoutDecisionPending and birthdayGiftNeeded are both true, with takeoutDecision as the pinned primary card and birthdays as the first small secondary card.

### Memory alignment
**Reinforces.**
- One primary thing, clearly, before any secondary things.
- A prompt that produces a decision beats pure information.
- Card visibility is driven by deterministic derived-state flags, never by LLM output.
- Place urgent items in the upper-left of the screen.
- Show dinner voting UI directly.

**Avoids rejected.**
- Rendering secondary items alongside a primary prompt (they compete for attention and dilute the decision).
- Do not present dinner voting UI as a suggested action.
- Information-dense screens that trade clarity for coverage.
- Too much text.
