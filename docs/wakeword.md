# Wakeword Boundary

Wakeword detection is live input plumbing. It must not decide Home Center state
or dashboard policy.

The wakeword layer can decide whether speech recognition should run, and it can
set `wakewordDetected` on a CommandEvent. After recognition, the only object
that crosses into Home Center core logic is the normalized CommandEvent:

```text
wakeword detector -> speech recognizer -> CommandEvent -> core command logic
```

Do not pass through raw wake scores, DNN metadata, timestamps, microphone device
IDs, audio buffers, provider alternatives, or word timings. Confidence is
bucketed by `normalizeCommandEvent(event)` so replays are stable.

AgentCI should replay CommandEvents from fixtures. It must not call microphone,
wakeword, speech recognition, browser speech, or live voice services.
