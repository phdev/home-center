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

In confirmed-command live capture, the wakeword layer treats local STT as a
candidate source. It should only hand off dispatchable commands, and open-ended
`ask` commands should use explicit `ask`, `tell me`, `explain`, or `describe`
cues so passive speech plus a hallucinated wake phrase does not become a live
action.

## Live Reliability Notes

As of 2026-05-04, production voice runs on the Mac mini `voice-service`
using `WAKE_ENGINE=vosk`, then local faster-whisper for command text. The Pi
hosts the dashboard API, kiosk, chime, timers, and mic stream.

Known working voice commands:

- `Hey Homer, open calendar` -> `navigate` page `calendar`
- `Hey Homer, go back` -> `navigate` page `dashboard`
- `Hey Homer, go home` -> `navigate` page `dashboard`

Observed reliability issue: sometimes a spoken `Hey Homer` command leaves no
normal log entry, so the first question is whether the mic stream heard speech,
Vosk emitted wake-like text, Whisper produced a command transcript, or the
parser rejected the body.

To make misses diagnosable, `voice-service` writes structured non-audio events
to:

```text
voice-service/logs/voice-reliability.jsonl
```

This JSONL log records service startup, loud speech windows, Vosk detector
text, wake hits/skips/rejections, Whisper transcripts, parsed commands, ignored
commands, and dispatches. It intentionally does not write raw audio.

Real-world parser fallback added on 2026-05-04: if Whisper drops `go` from
`go back`, bare `back` and `back please` now route to dashboard.

Observed Vosk wake miss on 2026-05-05: Peter said `Hey Homer, open calendar`,
but Vosk emitted `hey i'm robyn calendar`. That means the command word can be
heard while the wake phrase fails, so do not assume a navigation miss is a
Worker/Pi routing problem. Check `voice-reliability.jsonl` detector text first.
`voice-service/intent.py` now treats the narrow Vosk alias
`hey i'm robyn ...` as a wake phrase and strips it before parsing the command.
