# Replay And Determinism

AgentCI run snapshots use this schema:

```json
{
  "runId": "school-updates-digest-20260501T190000000Z",
  "timestamp": "2026-05-01T19:00:00.000Z",
  "rawData": {},
  "commandEvents": [],
  "derivedState": {},
  "cards": [],
  "agentRuns": [],
  "metadata": {
    "version": "agentci.v1",
    "scenarioId": "school-updates-digest",
    "timeContext": {
      "now": "2026-05-01T19:00:00.000Z",
      "user": { "isPeter": true }
    }
  }
}
```

Determinism guarantees:

- Replay uses only `rawData`, normalized `commandEvents`, and
  `metadata.timeContext`.
- Replay recomputes `derivedState` through `src/core/derivations/`.
- Replay recomputes cards through `src/core/interventions/engine.js`.
- Replay carries recorded `agentRuns` as audit artifacts but never calls
  OpenClaw, network APIs, microphone APIs, or speech APIs.
- JSON output is stable: object keys are sorted, raw inputs are normalized, and
  volatile timestamps are normalized or excluded.

Normalization rules:

- Timestamps are represented as ISO strings.
- Raw calendar events are sorted by start, end, and id.
- Raw school items and school updates are sorted by id.
- Command events are normalized to `{ source, transcript, wakewordDetected,
  confidenceBucket, locale, deviceType }`.
- Card reason fields are normalized to arrays and strings.
- Agent runs are sorted by `agentRunId`; their trace uses deterministic step
  labels, not live timestamps.
- Agent output artifacts are normalized before storage and comparison by
  removing volatile request/timestamp fields, sorting object keys, and
  collapsing repeated whitespace in strings.

Live voice and audio are outside replay scope. A separate system owns wakeword
detection and speech recognition. AgentCI records only the normalized
`CommandEvent` result that arrives after that live processing.
