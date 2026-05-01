# AgentCI Overview

AgentCI is the Home Center reliability layer for deterministic agent-facing
workflows. It records a normalized Home Center run, replays it offline, diffs
the result, explains card decisions, and gates regressions before agent or LLM
enhancements are involved.

The boundary is:

```text
Raw data / normalized CommandEvent
-> deterministic derived state
-> deterministic card selection
-> deterministic decision trace
-> optional agent enhancement
```

AgentCI exists because Home Center now has multiple inputs and optional agent
enhancements. The system needs a way to prove that the deterministic layer is
stable before wording, summarization, or suggestion systems run.

AgentCI records normalized `CommandEvent` fixtures when command input matters.
It never records raw audio and never calls wakeword, microphone, or
speech-recognition APIs. If live voice systems produce a command, AgentCI starts
after that command has already been normalized.

AgentCI currently supports:

- Run snapshots in `agentci/runs/`
- AgentRun audit records for OpenClaw calls
- Offline replay through `src/core/agentci/replayRunner.js`
- Stable diffs through `src/core/agentci/diff.js`
- Card and AgentRun explanations through `src/core/agentci/explainer.js`
- A minimal gate that writes `agentci/reports/latest.md`

Recorded AgentRuns are replay inputs only in the sense that they are preserved
and diffed. AgentCI replay never re-executes OpenClaw and never lets agent
output alter derived state, card visibility, or card priority.
Card-level AgentRuns carry a `cardId`, and their output artifacts are normalized
before diffing so timestamps, request ids, and whitespace noise do not create
false regressions.

## AgentCI vs AgentRun

AgentCI is deterministic and replayable. It owns run snapshots, offline replay,
diffing, decision traces, and regression gates for the decision path.

AgentRun is observational. It records what OpenClaw was asked to do and what it
returned after deterministic cards already exist. AgentRun output is not
replayed, and it never influences derived state, card visibility, or card
priority.

Key rule: Home Center must produce correct output with the agent layer disabled.

AgentCI does not yet include Claude, OpenAI Agents, LangGraph, production
monitoring, raw audio fixtures, or an external framework adapter. Those are
intentionally deferred until the deterministic Home Center slice is stable.
