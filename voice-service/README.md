# Home Center Voice Service

Mac mini service for the Home Center voice path.

## Pipeline

1. Pi streams the XVF3800 PipeWire `pulse` capture over TCP `:8766`.
2. Mac mini runs the configured local wake engine. The default is Vosk/Kaldi
   because it measured 0 TV false positives in the first hardware run; the
   service also supports a purpose-built `openwakeword` DNN engine via
   `WAKE_ENGINE=openwakeword`, a confirmed-command `WAKE_ENGINE=speech`
   trial mode, and a brute-force local-STT benchmark via
   `WAKE_ENGINE=always-stt`.
3. In the default Vosk path, a wake hit still posts the Pi chime immediately.
   In confirmed-command trials (`WAKE_CONFIRM_COMMAND=1`), wake hits are only
   candidates: the service posts a soft `stage=verifying` transcription update
   and does not chime or dispatch yet.
4. If Vosk already heard a complete command and confirmed-command mode is off,
   `intent.py` dispatches it as a fast path.
5. Otherwise local `faster-whisper` transcribes the rolling pre-wake buffer
   plus the short post-wake tail, so one-shot commands like "Hey Homer, open
   calendar" are captured as one utterance. In `WAKE_ENGINE=speech` and
   `WAKE_ENGINE=always-stt` trials, the RMS segment detector hands Whisper the
   exact completed speech segment plus a short pre-roll instead of a generic
   rolling tail.
6. `intent.py` deterministically maps text to one of the supported actions and
   rejects incomplete command payloads before dispatch. In confirmed-command
   mode, only a dispatchable parse gets the hard wake caption, chime, and
   action dispatch; empty/non-command candidates are cleared with no action.

Whisper is not used for wake detection. Empty “Hey Homer” does not turn on the
TV; the user must say an explicit command.

## Install

```bash
cd ~/home-center/voice-service
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

The launchd plist template lives in `deploy/mac-mini/com.homecenter.voice.plist`.
Download the small English Vosk model once:

```bash
mkdir -p models
cd models
curl -L -o vosk-small.zip https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-small.zip
rm vosk-small.zip
```

## Run Manually

```bash
. ~/home-center/voice-service/.venv/bin/activate
python voice_service.py \
  --mic-host homecenter.local \
  --pi-base http://homecenter.local:8765 \
  --worker-url https://home-center-api.phhowell.workers.dev \
  --vosk-model-dir ./models/vosk-model-small-en-us-0.15 \
  --whisper-model base.en
```

Use `--dry-run --debug` to inspect wake scores and parsed commands without
posting actions back to the Pi.

To exercise the DNN wake path:

```bash
WAKE_ENGINE=openwakeword \
OPENWAKEWORD_MODEL=../pi/models/hey_homer.onnx \
OPENWAKEWORD_THRESHOLD=0.92 \
OPENWAKEWORD_MIN_CONSECUTIVE=3 \
python voice_service.py --dry-run --debug
```

To exercise openWakeWord as a candidate-only trigger:

```bash
WAKE_ENGINE=openwakeword \
WAKE_CONFIRM_COMMAND=1 \
CONFIRM_PRE_WAKE_SECONDS=5.0 \
CONFIRM_POST_WAKE_SECONDS=2.0 \
POST_ACTION_MUTE_SECONDS=0.5 \
OPENWAKEWORD_MODEL=../pi/models/hey_homer.onnx \
OPENWAKEWORD_THRESHOLD=0.92 \
OPENWAKEWORD_MIN_CONSECUTIVE=3 \
OPENWAKEWORD_MIN_RECENT_PEAK_RMS=250 \
OPENWAKEWORD_AUDIO_HEARTBEAT_SECONDS=2.0 \
OPENWAKEWORD_AUDIO_LOG_MIN_RMS=180 \
OPENWAKEWORD_AUDIO_LOG_INTERVAL_SECONDS=1.0 \
OPENWAKEWORD_SCORE_LOG_MIN=0.05 \
OPENWAKEWORD_SEGMENT_END_SILENCE_SECONDS=0.8 \
OPENWAKEWORD_EMPTY_CONFIRM_COOLDOWN_SECONDS=4.0 \
python voice_service.py --dry-run --debug
```

To bypass the current DNN and test speech segments as candidate triggers:

```bash
WAKE_ENGINE=speech \
WAKE_CONFIRM_COMMAND=1 \
CONFIRM_PRE_WAKE_SECONDS=4.0 \
CONFIRM_POST_WAKE_SECONDS=0.4 \
CONFIRM_MIN_POST_WAKE_SECONDS=0.1 \
SPEECH_CANDIDATE_MIN_PEAK_RMS=450 \
SPEECH_CANDIDATE_END_SILENCE_SECONDS=0.65 \
SPEECH_CANDIDATE_COOLDOWN_SECONDS=0.5 \
SPEECH_CANDIDATE_PRE_ROLL_SECONDS=0.45 \
SPEECH_CANDIDATE_MAX_SEGMENT_SECONDS=6.0 \
SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS=30.0 \
SPEECH_CANDIDATE_EMPTY_BACKOFF_SECONDS=8.0 \
SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_PEAK_RMS=1800 \
SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_ACTIVE_CHUNKS=8 \
CONFIRM_MULTI_COMMAND_DISPATCH=1 \
POST_ACTION_MUTE_SECONDS=0.5 \
python voice_service.py --dry-run --debug
```

To run the brute-force local-STT benchmark:

```bash
WAKE_ENGINE=always-stt \
WAKE_CONFIRM_COMMAND=1 \
CONFIRM_MULTI_COMMAND_DISPATCH=1 \
WHISPER_MODEL=base.en \
SPEECH_CANDIDATE_MIN_PEAK_RMS=450 \
SPEECH_CANDIDATE_MIN_ACTIVE_CHUNKS=3 \
SPEECH_CANDIDATE_END_SILENCE_SECONDS=0.65 \
SPEECH_CANDIDATE_PRE_ROLL_SECONDS=0.45 \
SPEECH_CANDIDATE_MAX_SEGMENT_SECONDS=6.0 \
SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS=0 \
SPEECH_CANDIDATE_EMIT_VERIFYING=0 \
python voice_service.py --dry-run --debug
```

Speech candidate and `always-stt` modes are not wake detectors and must stay
behind `WAKE_CONFIRM_COMMAND=1`: RMS only decides when to run local Whisper,
and the transcript must contain a wake phrase plus a dispatchable command before
chime or dispatch. `WAKE_ENGINE=always-stt` is the brute-force benchmark: every
qualifying speech segment is sent to local Whisper with no empty max-segment
backoff. Raw local-STT candidates do not post `stage=verifying` by default, so
non-command speech stays internal unless `SPEECH_CANDIDATE_EMIT_VERIFYING=1`
is set for UI debugging.

When a local-STT candidate fires, Whisper receives the completed RMS segment
plus `SPEECH_CANDIDATE_PRE_ROLL_SECONDS` of leading quiet audio. The detector
freezes its ambient noise estimate during active speech so a loud preamble or
TV burst does not raise the gate and cause short commands like "stop" to be
missed. It also caps active speech segments at
`SPEECH_CANDIDATE_MAX_SEGMENT_SECONDS` before running local confirmation. In
speech candidate mode, `SPEECH_CANDIDATE_COOLDOWN_SECONDS` intentionally stays
shorter than the normal wake cooldown so rapid 5-phrase validation does not
drop adjacent commands like `open calendar` -> `show the weather`.
`WHISPER_NO_SPEECH_THRESHOLD` should stay at the default `0.45` unless a
targeted short-command trial proves otherwise; `0.95` recovered one 5-phrase
run but caused too many passive Whisper confirmations and hallucinated
non-command transcripts. In
`WAKE_ENGINE=speech`, if a max-length segment confirms no command, speech mode
backs off further max-length confirmations for
`SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS`; shorter silence-ended command
segments can still confirm during that window. `WAKE_ENGINE=always-stt` does
not apply that backoff.
For noisy rooms, `SPEECH_CANDIDATE_EMPTY_BACKOFF_SECONDS` can also back off
after any empty/non-command speech confirmation. Strong speech segments can
still break through that window when they meet
`SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_PEAK_RMS` and
`SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_ACTIVE_CHUNKS`, which keeps short
real commands like "stop" eligible after ambient speech.

Confirmed-command mode dispatches one command per transcript by default. Dry-run
validation can set `CONFIRM_MULTI_COMMAND_DISPATCH=1` so one merged speech
segment dispatches every wake-qualified command candidate in order; keep that
off for normal launchd service behavior until multi-command UX is intentionally
validated.

Confirmed-command transcript parsing accepts a narrow set of local Whisper wake
variants such as `Day Homer` and `8-homer` after a candidate trigger. Those
variants are only for confirmation parsing; they do not broaden the live Vosk
or openWakeWord trigger itself.
In confirmed-command mode, open-ended `ask` commands must use an explicit cue
such as `ask`, `tell me`, `explain`, or `describe`; bare questions like `Hey
Homer, what is ...` are ignored in that mode because passive TV speech can make
local Whisper hallucinate a wake phrase before unrelated questions.

Run the 5-phrase dry-run before any 20-command validation:

- "Hey Homer, turn on"
- "Hey Homer, open calendar"
- "Hey Homer, show the weather"
- "Hey Homer, set a timer for ten seconds"
- "Hey Homer, stop"

Confirmed-command dry-runs log `OpenWakeWord audio heartbeat ...` summaries
every `OPENWAKEWORD_AUDIO_HEARTBEAT_SECONDS` even when the input is quiet. They
also log `OpenWakeWord audio probe ...` lines whenever the recent mic RMS
reaches `OPENWAKEWORD_AUDIO_LOG_MIN_RMS`, even if the DNN score stays near
zero, and `OpenWakeWord score probe ...` lines during active speech when the
DNN score is above `OPENWAKEWORD_SCORE_LOG_MIN`. Use those lines to separate an
upstream audio/mic issue from a DNN threshold miss or second-stage RMS gate
rejection.

Confirmed-command mode also debounces openWakeWord candidates to one Whisper
confirmation per active speech segment, including the audio consumed during the
5s/2s confirmation capture. If that capture ends in real silence, the next
phrase can confirm immediately; if speech is still active, further DNN hits in
that segment log as `Skipping openWakeWord wake ...`. Empty transcripts start
`OPENWAKEWORD_EMPTY_CONFIRM_COOLDOWN_SECONDS`. Dry-run logs include
`Confirmed-command candidates=[...]` so merged transcripts can report every
dispatchable command heard without executing multiple actions. If the latest
wake body is incomplete but a dispatchable candidate exists in the same local
STT transcript, the service falls back to the latest dispatchable candidate.
Candidate reporting also keeps a leading clipped command like `Homer, open
calendar` when Whisper drops the initial "Hey". The wake splitter accepts
punctuated Whisper variants like `Okay, Homer, ...`.

Do not make `openwakeword` the launchd default until it passes the same
30-minute TV false-positive test as Vosk.

Do not make `WAKE_ENGINE=speech` the launchd default unless it passes the
5-phrase validation and then the same ambient-TV false-dispatch checks. It is a
local-only fallback candidate source for measuring confirmed-command behavior
without depending on the current openWakeWord model.

Do not make `WAKE_ENGINE=always-stt` the launchd default. It is the brute-force
benchmark for responsiveness and STT accuracy: every qualifying speech segment
goes to local Whisper, but dispatch still requires a wake phrase and valid
command. Use it to answer whether the remaining misses come from wake detection
or from local STT/parser behavior.

Current 5-phrase dry-run baseline: `WAKE_ENGINE=speech`,
`WAKE_CONFIRM_COMMAND=1`, `CONFIRM_MULTI_COMMAND_DISPATCH=1`,
`WHISPER_MODEL=base.en`, `SPEECH_CANDIDATE_MIN_ACTIVE_CHUNKS=3`,
`SPEECH_CANDIDATE_PRE_ROLL_SECONDS=0.45`,
`SPEECH_CANDIDATE_MAX_SEGMENT_SECONDS=6.0`,
`SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS=12.0`, and
`SPEECH_CANDIDATE_EMIT_VERIFYING=0`. On 2026-05-01, after the noise-floor
freeze and max-segment cap, this reached 5/5 dispatches with about 276-298 ms
STT/action latency, including the short `stop` command. A stricter
`SPEECH_CANDIDATE_MIN_ACTIVE_CHUNKS=8` trial missed `stop`, so do not use that
as the next baseline.

Rejected tuning candidate: `SPEECH_CANDIDATE_PRE_ROLL_SECONDS=0.8`. The
post-backoff 5-phrase run on 2026-05-01 regressed to 3/5; local Whisper missed
the wake phrase on `turn on` and `open calendar`, so the safety gate correctly
refused them. Do not broaden the parser to accept command-only speech in
speech-candidate mode.

Current passive dry-run baseline: a 2-minute `WAKE_ENGINE=speech` dry-run on
2026-05-01 produced 0 dispatches and 0 command candidates. Adding
`SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS=12.0` reduced local Whisper
confirmations from 18 to 6 over a comparable 2-minute ambient-speech sample;
skipped max-length segments are logged as `reason=max_empty_backoff`.

Current brute-force baseline: a clean `WAKE_ENGINE=always-stt` dry-run on
2026-05-01 passed the 5-phrase validation at 5/5 with median local STT/action
latency around 281 ms after segment end. The matching 2-minute passive run
produced 0 dispatches and 0 command candidates, but it still ran 16 internal
Whisper confirmations on ambient speech/TV. That makes the brute-force path a
strong accuracy/safety ceiling, not yet a production default.

Current production-shaped backoff baseline: `WAKE_ENGINE=speech`,
`WAKE_CONFIRM_COMMAND=1`, `CONFIRM_MULTI_COMMAND_DISPATCH=1`,
`SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS=30.0`,
`SPEECH_CANDIDATE_EMPTY_BACKOFF_SECONDS=12.0`,
`SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_PEAK_RMS=1800`,
`SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_ACTIVE_CHUNKS=12`,
`SPEECH_CANDIDATE_PRE_ROLL_SECONDS=0.45`, and `WHISPER_MODEL=base.en`.
After preserving the max-empty backoff window across non-max empty candidates,
the 2026-05-03 5-phrase dry-run passed 5/5 with median local STT/action latency
around 285 ms after segment end and no ignored candidate wakes. The matching
2026-05-01 2-minute passive run produced 0 dispatches and 0 command candidates
with 6 internal Whisper confirmations and 13 skipped candidates.

Current follow-up baseline: the 2026-05-03 post-merge speech dry-run initially
reached 3/5 because speech mode inherited the generic 3s wake cooldown and
dropped adjacent commands. With `SPEECH_CANDIDATE_COOLDOWN_SECONDS=0.5`,
`SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS=30.0`, and the default
`WHISPER_NO_SPEECH_THRESHOLD=0.45`, the final 5-phrase dry-run passed 5/5 with
median wake-to-action latency around 288 ms and p95 around 335 ms. After the
confirmed-command `stop` and explicit-ask guards, `SPEECH_CANDIDATE_EMPTY_BACKOFF_SECONDS=8.0`
with strong override peak `1800`/active chunks `8` also passed the 5-phrase
dry-run at 5/5 with median wake-to-action latency around 290 ms. The matching
10-minute passive run produced 0 dispatches and 0 command candidates with 30
internal Whisper confirmations and 20 `empty_backoff` skips, down from 71
internal confirmations in the previous 10-minute passive baseline.

Longer passive follow-up: the 2026-05-03 10-minute passive run produced one
dry-run false command candidate from a local Whisper hallucination,
`Hey Homer, stop the perfect`. The intent parser now only accepts `stop`,
`dismiss`, `cancel`, and timer-control variants when there are no arbitrary
trailing words. The repeat passive run then exposed a second false candidate,
`Hey Homer, what's going on? That was very enthusiastic`, which reached the
open-ended `ask` path. Confirmed-command mode now requires explicit `ask`,
`tell me`, `explain`, or `describe` cues for ask dispatches. Keep these guards
before repeating the longer passive check.

## Debug

Use the Mac logs first:

```bash
tail -f ~/home-center/voice-service/logs/voice-stderr.log
```

Use the Pi logs for the mic stream and command endpoints:

```bash
ssh pi@homecenter.local 'sudo journalctl -u mic-streamer -f'
ssh pi@homecenter.local 'sudo journalctl -u wake-word -f'
```

For false-positive tests, measure from the last `Ready: wake=...` log marker or
from a recorded file byte offset. The log file contains historical runs and only
HH:MM:SS timestamps, so filtering by clock time alone is not reliable.

Mark the start offset before a validation run:

```bash
python validate_voice.py --log logs/voice-stderr.log --mark-start
```

Summarize a 20-command run from that offset:

```bash
python validate_voice.py --log logs/voice-stderr.log --offset <bytes> --expected-count 20
```
