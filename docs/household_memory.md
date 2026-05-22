# Household Memory

Household memory is the canonical v1 source-backed memory layer for Howie. It
stores explicit family-facing facts, routines, preferences, places, school
context, corrections, and source records that Howie may use in conversation.

Household memory can inform Howie’s conversation and suggestions, but cannot
directly drive UI behavior. Any UI behavior must be modeled through derived
state, docs, tests, and AgentCI.

## Boundary

Allowed uses:

- Conversation: answer questions with known household context.
- Suggestion: suggest next steps while making it clear they are suggestions.
- Explanation: explain why Howie remembers something and where it came from.
- Dashboard context: provide non-decisive copy or explanation context only.

Disallowed uses:

- Card visibility without derived state.
- Reminder timing without derived state.
- Priority without the intervention engine.
- Derived-state truth values without a documented contract.

OpenClaw and Howie may read household memory for conversation, explanation, and
suggestions. They must not use memory to decide whether dashboard cards appear,
when reminders fire, whether cards are suppressed, how cards are ordered, or
which derived-state flags are true.

## Storage

Canonical files live in `memory/household/`:

- `people.json`
- `routines.json`
- `preferences.json`
- `places.json`
- `school.json`
- `facts.json`
- `sources.jsonl`
- `corrections.jsonl`

The category files store arrays of normalized memory items. `sources.jsonl` and
`corrections.jsonl` are append-only audit logs.

Committed category files must contain empty skeleton data only. Do not commit
real household or private family facts.

## Memory Item Schema

Every memory item must include:

```json
{
  "id": "hm_preferences_example_snack",
  "type": "preference",
  "subject": "Example Child",
  "claim": "Example Child likes apples as an after-school snack.",
  "source": {
    "kind": "user_request",
    "ref": "telegram:example-message-id",
    "captured_at": "2026-05-20T22:00:00.000Z"
  },
  "confidence": "user_confirmed",
  "created_at": "2026-05-20T22:00:00.000Z",
  "updated_at": "2026-05-20T22:00:00.000Z",
  "valid_from": "2026-05-20T22:00:00.000Z",
  "valid_until": null,
  "status": "active",
  "allowed_uses": ["conversation", "suggestion", "explanation"],
  "disallowed_uses": [
    "card_visibility_without_derived_state",
    "reminder_timing_without_derived_state",
    "priority_without_intervention_engine"
  ]
}
```

`claim` may be replaced by JSON-safe `value` when structured data is more
appropriate.

Confidence values:

- `unverified`
- `inferred`
- `user_confirmed`
- `system_confirmed`

Statuses:

- `active`
- `corrected`
- `inactive`

## Write Rules

Writes must be explicit. There is no passive or autonomous “remember
everything” behavior in v1.

Supported service-layer operations:

- Remember an explicit fact.
- Correct an existing fact.
- Forget/deactivate a fact.
- List memory by category.
- Show source for a memory item.
- Query memory by subject, type, category, or free text.

Forget is a soft deactivation, not deletion. Corrections append to
`corrections.jsonl` and mark the old fact `corrected` or `inactive`.

## Howie Command Adapter

`src/core/memory/householdMemoryAdapter.js` is the v1 adapter for explicit
Howie memory commands. It recognizes narrow command shapes and calls the
service-layer APIs above:

- “Remember that Example Child likes apples.”
- “Correct Example Child likes apples to Example Child likes pears.”
- “Forget that Example Pool is near the library.”
- “What do you remember about Example Child?”
- “Where did you learn that?”

The adapter returns structured conversational results. It does not drive card
visibility, reminder timing, priority, ordering, suppression, or derived-state
truth values. Ambiguous corrections and forget requests return an explicit
ambiguous status instead of guessing.

`openclaw/household-memory-live.js` wires the same adapter into the Telegram
bridge behind explicit command detection only. Non-memory Telegram messages
continue through the existing Howie/OpenClaw path unchanged.

## Future Work

Deferred from v1:

- GBrain mirroring.
- Gmail, calendar, or school-email ingestion.
- Passive memory extraction from conversations.
- Dashboard behavior driven by memory.
