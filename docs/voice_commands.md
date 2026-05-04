# Voice Commands

Voice input is an adapter into Home Center, not a place for dashboard decisions.

After speech recognition, voice input must normalize the result with
`normalizeCommandEvent(event)` from `src/core/commands/commandEvent.js`. Home
Center logic receives only the normalized CommandEvent shape documented in
`docs/command_event_contract.md`.

The voice layer may keep wake scores, local recognizer metadata, and other
implementation details internally for diagnostics, but those fields must not be
handed to core logic. Core logic is responsible for deterministic command
interpretation and dashboard behavior.

Browser speech input currently emits:

```js
{
  source: "voice",
  transcript: "show the weather",
  wakewordDetected: false,
  confidenceBucket: "unknown",
  locale: "en-US",
  deviceType: "browser"
}
```

Pi and Mac wakeword services should use the same CommandEvent boundary before
handing recognized text to Home Center logic.

For live confirmed-command capture, open-ended `ask` commands are intentionally
explicit. Use phrases like `Hey Homer, ask what is ...`, `Hey Homer, tell me
...`, `Hey Homer, explain ...`, or `Hey Homer, describe ...`. Bare questions
after a wake phrase are ignored in confirmed-command mode because passive TV
speech can cause local STT to hallucinate a wake phrase before unrelated
questions.
