# Decision Trace Model

Every card emitted by `src/core/interventions/engine.js` must include a reason
object:

```json
{
  "triggeredBy": ["hasUrgentSchoolItem", "rankedSchoolItems"],
  "suppressedBy": [],
  "priorityReason": "Urgent school item is due soon or high urgency."
}
```

`triggeredBy` lists the derived-state keys that caused the card to appear.
These keys must exist on the derived state object or be direct card-selection
inputs produced by the deterministic derivation layer.

`suppressedBy` lists deterministic suppressions considered for the card. It is
an empty array when no suppression applied. Suppressed cards are usually absent
from final card output, but visible cards still record the suppression context
that shaped their selection.

`priorityReason` is a human-readable deterministic sentence explaining why the
card received its priority.

Examples:

- School Updates: triggered by `rankedSchoolItems`, `hasSchoolActionItems`, and
  `hasUrgentSchoolItem`; urgent because a due date is soon or urgency is high.
- Takeout: triggered by `takeoutDecisionPending` and `takeoutState`; important
  because the 16:30 reminder cutoff has passed.
- Calendar Conflict: triggered by `hasMorningOverlap`, `conflicts`, and
  optionally `peter0800_0900Risk`; priority increases when the conflict starts
  within 15 minutes.

No LLM or agent system may author or alter reason objects.
