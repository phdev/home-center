# Agent Contracts

Agents and OpenClaw are enhancement layers. They may improve presentation, but
they do not own Home Center policy or deterministic state.

Allowed agent usage:

- Summarization
- Extraction
- Suggestions
- Wording

Forbidden agent usage:

- Canonical state computation
- Card visibility decisions
- Card priority decisions
- Policy boundary decisions
- Automation allow/deny decisions

Agent-provided enhancement output must use this shape:

```json
{
  "type": "summary",
  "confidence": 0.8,
  "data": {}
}
```

`type` must be one of `summary`, `suggestion`, or `extraction`.
`confidence` is a number from 0 to 1. `data` contains feature-specific fields.

Agent output is optional. If it is absent, times out, or fails validation, Home
Center must still render deterministic cards with deterministic fallback copy.

Every OpenClaw call is captured as an `AgentRun` audit record. Card-level calls
must include a `cardId` that points at the card being enhanced. AgentRuns may be
stored, diffed, and explained, but they must not become inputs to deterministic
state derivation, card visibility, card priority, policy boundaries, or
automation allow/deny decisions. `determinism.affects_decisions` must remain
`false`.
