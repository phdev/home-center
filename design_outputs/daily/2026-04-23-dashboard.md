# Design Claw — 2026-04-23 — dashboard

**Topic.** prioritization when 3+ derived flags are simultaneously true — which one owns the hero slot  
**Topic id.** `multi-flag-prioritization`

## Concept — Single Hero, Sidecar Queue

### Layout idea
Use one full-width hero slot at the top center of the dashboard that is occupied by exactly one deterministic derived-state card chosen by precedence: takeoutDecisionPending wins over birthdayGiftNeeded, which wins over lunchDecisionNeeded, while showMorningChecklist only wins in Morning mode. Directly below it, keep a narrow secondary row of smaller background cards for calendar, weather, and schoolUpdates, with clawSuggestions only appearing when it does not compete with the hero. The hero card owns the screen focus and contains the actionable decision; the smaller cards are purely contextual and never expand into a second primary prompt. If multiple flags are true, the layout does not stack prompts; it surfaces one hero and leaves the rest queued as small, passive indicators in their own cards.

### Why it fits
This fits the snapshot because derived_state already has three simultaneous flags true in the same session: takeoutDecisionPending, birthdayGiftNeeded, and showClawSuggestions, while lunchDecisionNeeded, bedtimeReminderActive, and showMorningChecklist are false. The current stacked_cards structure is already close to this, but it needs a stricter ownership rule so the top row does not compete with the mid-row contextualSlot. Today's theme is explicitly about prioritization when 3+ derived flags are simultaneously true, so the central design move is to make one card own the hero slot and demote everything else to background. That matches the memory rule 'one primary thing, clearly, before any secondary things' and the accepted pattern 'a single contextual slot that swaps its card based on the highest-tier active flag.'

### Tradeoff
The cost is that lower-priority needs can feel delayed or hidden when several are active at once, especially if the family expected to see birthday planning alongside dinner decisions. This concept is worse when users want a broader situation overview rather than a single next action, because it intentionally sacrifices coverage to keep the 2-second scan path clean.

### Implementation hint
- Create a pure priority resolver for derived_state that returns one hero card id from an ordered list of active flags, with takeoutDecisionPending > birthdayGiftNeeded > lunchDecisionNeeded > showMorningChecklist.
- Render the hero as one full-width card and render all other eligible items only as smaller background cards in the secondary row; do not allow more than one prompt-style card visible at once.
- Keep clawSuggestions as either a small passive card or hidden when the hero is already a decision prompt, so it never competes for the primary slot.

### Prototype first
Build the priority resolver and a two-region dashboard with one full-width hero card plus a secondary row of smaller cards, then test whether users can name the current action in under two seconds.

### Memory alignment
**Reinforces.**
- one primary thing, clearly, before any secondary things
- Actionable beats informational
- deterministic derived state drives UI visibility
- accepted_patterns: A single contextual slot that swaps its card based on the highest-tier active flag

**Avoids rejected.**
- Rendering secondary items alongside a primary prompt (they compete for attention and dilute the decision)
- Information-dense screens that trade clarity for coverage
- Dense multi-column dashboards that trade glanceability for information density
- Too much text
