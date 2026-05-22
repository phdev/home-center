# CommandEvent Contract

Home Center treats live voice as an input adapter, not as policy logic.

The boundary is:

```text
wakeword / speech input -> normalized CommandEvent -> Home Center core logic
```

## Schema

```js
{
  source: "voice" | "text" | "fixture",
  transcript: string,
  wakewordDetected: boolean,
  confidenceBucket: "high" | "medium" | "low" | "unknown",
  locale: string,
  deviceType: string
}
```

`normalizeCommandEvent(event)` is the only normalization entry point. It trims
and normalizes transcript whitespace, strips volatile fields, buckets confidence,
and returns stable JSON-compatible data.

`validateCommandEvent(event)` checks that only the schema fields are present and
that each field has an allowed deterministic value.

## Excluded Data

CommandEvent intentionally excludes:

- timestamps
- raw audio
- microphone device IDs
- provider-specific speech metadata
- provider alternatives, word timings, or model internals
- volatile confidence floats

Voice confidence is stored as a bucket to avoid flaky replay:

- `confidence >= 0.85` -> `high`
- `confidence >= 0.6` -> `medium`
- `confidence < 0.6` -> `low`
- missing or null confidence -> `unknown`

## Ownership

The wakeword and voice layer may collect implementation-specific data while it
is listening, but that data must not cross into Home Center core logic. The only
crossing object is CommandEvent.

Home Center core logic consumes CommandEvent and remains responsible for
deterministic command interpretation and behavior. The voice layer must not
decide derived state, card visibility, card priority, policy boundaries,
automations, or dashboard behavior.

AgentCI records and replays CommandEvent. AgentCI must never call microphones,
wakeword models, speech APIs, browser speech recognition, or live voice
services. Replays should use `source: "fixture"` CommandEvents.
