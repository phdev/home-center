# Diff And Replay

AgentCI replay compares a stored run to a recomputed run:

```text
stored rawData + timeContext
-> recomputed derivedState
-> recomputed cards
-> diff against stored snapshot
```

Diff output schema:

```json
{
  "stateChanges": [
    { "path": "derivedState.hasUrgentSchoolItem", "from": true, "to": false }
  ],
  "cardChanges": {
    "added": [],
    "removed": [],
    "modified": [
      {
        "id": "school-updates",
        "type": "SchoolUpdatesCard",
        "changes": [
          { "field": "priority", "from": "urgent", "to": "important" }
        ]
      }
    ]
  },
  "agentChanges": {
    "added": [],
    "removed": [],
    "modified": [
      {
        "agentRunId": "agentrun-0001-summary-sample",
        "cardId": "school-updates",
        "purpose": "summary",
        "changes": [
          { "field": "output_artifacts", "from": {}, "to": {} }
        ]
      }
    ],
    "byCardId": [
      {
        "cardId": "school-updates",
        "summary": "Summary text changed",
        "added": [],
        "removed": [],
        "modified": ["agentrun-0001-summary-sample: Summary text changed"]
      }
    ]
  }
}
```

State changes are stable, human-readable path changes under `derivedState`.
Timestamp-only noise is ignored.

Card diffs detect:

- Added cards
- Removed cards
- Modified priority
- Modified title
- Modified reason
- Modified visibility

Agent diffs detect:

- Added AgentRuns
- Removed AgentRuns
- Modified purpose
- Modified normalized output artifacts
- Modified token metrics
- Latency changes outside the configured noise window

Agent changes include `cardId` and are grouped by `cardId` so a changed summary
or suggestion can be traced back to the card it enhanced. Each grouped entry has
a deterministic `summary`:

- `Summary text changed` when `output_artifacts.fields.summary` changed.
- `Agent output fields changed` when output fields were added or removed.
- `Agent output changed` for all other AgentRun changes.

Output artifacts are normalized before comparison: volatile timestamps and
request ids are removed, object keys are sorted, and repeated string whitespace
is collapsed.

The AgentCI gate uses replay and diff output to fail when:

- The freshly recomputed run differs from the stored golden run
- Replay does not match the original snapshot
- An expected card is missing
- A reason object is incomplete
- A card priority changes unexpectedly
- Agent output attempts to carry deterministic decision fields
- AgentRun `cardId` points at a card that does not exist in the run
- AgentRun `determinism.affects_decisions` is true
- Forbidden APIs are called during replay or gate execution

The latest gate report is written to `agentci/reports/latest.md`.
