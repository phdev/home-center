# AgentRun Schema

`AgentRun` records an OpenClaw call after deterministic Home Center decisions
have already been made. It is an audit artifact, not a decision input.

```ts
AgentRun {
  agentRunId: string
  purpose: "summary" | "extraction" | "suggestion"
  cardId: string | null
  input_snapshot: object
  model_config: object
  trace: array
  output_artifacts: object
  metrics: {
    latency_ms: number
    tokens?: number
  }
  determinism: {
    replayable: boolean
    affects_decisions: false
    notes?: string
  }
}
```

Field meanings:

- `agentRunId`: stable identifier for diffing the same recorded call. It must
  be unique within a run snapshot.
- `purpose`: the allowed class of agent work.
- `cardId`: the UI card enhanced by the OpenClaw call. It must match an
  existing card in the run when the call enhances a card. It may be `null` only
  for non-UI agent tasks.
- `input_snapshot`: the exact deterministic card or feature context sent to
  OpenClaw. It must not contain raw audio or live provider events.
- `model_config`: non-secret runtime configuration such as provider, endpoint,
  timeout, and whether a worker URL was configured. Tokens are never stored.
- `trace`: deterministic step labels for the call. Trace entries must not use
  volatile timestamps.
- `output_artifacts`: normalized returned enhancement fields, source, and
  optional error. Agent output is always optional.
- `metrics`: call timing and optional token counts. Diffs ignore small latency
  noise.
- `determinism`: whether this agent output itself is replayable and whether it
  affects deterministic decisions. Live OpenClaw calls are normally
  `replayable: false`; `affects_decisions` must always be `false`; AgentCI
  replay never re-runs them.

Output normalization:

- Object keys are sorted recursively.
- Volatile `timestamp`, `timestamps`, `requestId`, `requestIds`, and
  `transientMetadata` fields are removed before storage and diffing.
- Strings are trimmed and repeated whitespace is collapsed.

Boundary rules:

- AgentRuns may explain summaries, extractions, suggestions, and wording.
- AgentRuns must not compute canonical state.
- AgentRuns must not decide card visibility or card priority.
- AgentRuns must not decide policy boundaries or automation allow/deny status.
- Removing every AgentRun from a snapshot must still leave valid deterministic
  derived state and cards.
- AgentRun output must not carry `derivedState`, new card definitions,
  `priority`, `shouldDisplay`, or `visibility` fields.
