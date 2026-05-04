# Design Claw — 2026-04-24 — dashboard

**Topic.** weekend vs weekday dashboards — which cards disappear, which expand  
**Topic id.** `weekend-vs-weekday`

## Concept — Single Runway with Weekend Swap

### Layout idea
Use one dominant full-width contextual runway card in the center that is chosen by deterministic priority from the active flags, with all other content reduced to a small supporting strip beneath it. In this snapshot, takeoutDecisionPending=true and birthdayGiftNeeded=true, so the runway becomes the dinner decision card and shows the dinner voting UI directly as the primary action; the birthday gift need is demoted to a compact reminder chip in the support strip, while calendar, weather, and schoolUpdates stay as smaller background cards only if room remains under the 6-card limit. On weekends, the structure should remove weekday-only urgency cards like school updates when they are not actionable, and expand the family-planning card that is actually live right now; on weekdays, the runway can swap to morning checklist or school timing when those flags are active. The state flow is simple: highest-priority true flag fills the runway, any second true flag becomes a secondary chip, and everything else is suppressed until the primary decision is resolved.

### Why it fits
This matches the snapshot because the screen is a shared 4K TV with under-2-second glanceability, and the derived state already says the important live decision is takeoutDecisionPending=true while birthdayGiftNeeded=true is secondary. The current_structure already contains a 'contextualSlot' that swaps between Dinner Tonight / Lunch / Morning Checklist, so this concept formalizes that into a single runway instead of competing cards. It also fits the theme 'weekend vs weekday dashboards' by explicitly changing what disappears: weekday-oriented schoolUpdates and other informational cards shrink or drop out on weekends, while the one family decision card expands. It respects the memory item 'show dinner voting UI directly' and avoids rendering secondary items alongside a primary prompt, which is especially important here because clawSuggestions is also active and would otherwise compete.

### Tradeoff
This is less complete when multiple family needs are genuinely important at once, because it intentionally hides non-primary items instead of showing them all. If the family expects to see calendar, birthdays, weather, and school updates at a glance every time, this concept will feel more sparse on weekends, but that sparseness is the point: it protects the decision from being diluted.

### Implementation hint
- Render a single 'runway' region that selects one card from derived_state by priority order: takeoutDecisionPending -> morning checklist -> lunchDecisionNeeded -> birthdayGiftNeeded -> bedtimeReminderActive, with all others suppressed from the main scan path.
- Add a compact secondary strip that can hold at most 1-2 small background cards or chips (for example birthdayGiftNeeded and weather), but never place a second actionable prompt beside the runway.
- Drive all visibility from flags only: if takeoutDecisionPending is true, mount the dinner voting card directly; if it is false, unmount that card and let the next active flag take over.
- On weekend mode, omit weekday-only informational cards such as schoolUpdates unless they are the only remaining active signal.

### Prototype first
Build the single runway card swap with takeoutDecisionPending and birthdayGiftNeeded as the only test flags, and verify the secondary item stays out of the primary scan path.

### Memory alignment
**Reinforces.**
- one primary thing, clearly, before secondary things
- Actionable beats informational
- Deterministic derived state drives UI visibility
- accepted_pattern: A single contextual slot that swaps its card based on the highest-tier active flag
- accepted_pattern: Keep the Single Runway Card direction
- memory preference: Show dinner voting UI directly

**Avoids rejected.**
- rejected_pattern: Rendering secondary items alongside a primary prompt (they compete for attention and dilute the decision)
- rejected_pattern: Dense multi-column dashboards that trade glanceability for information density
- rejected_pattern: Information-dense screens that trade clarity for coverage
- rejected_pattern: Too much text
- rejected_pattern: Show tomorrow items in the night wind-down view
- rejected_pattern: Do not present dinner voting UI as a suggested action
