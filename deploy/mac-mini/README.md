# Mac Mini deploy templates

Sanitized provisioning templates for the Home Center services that run on a
Mac Mini. These are **reproducible, generic**, and contain no secrets or
machine-specific paths — all real values are supplied at install time via
environment variables or sed substitution.

## What runs here

| Service | Purpose | launchd label |
|---|---|---|
| OpenClaw Telegram bridge | Family-facing chat bot (persona + skill live in `openclaw/prompts/`) | `com.openclaw.bridge` |
| Email triage | Classify Gmail, fan out to worker + Telegram | `com.homecenter.email-triage` |
| School updates | Pull school emails into the worker | `com.homecenter.school-updates` |
| Design Claw | Daily design-exploration digest to Telegram (runs once at 08:15) | `com.homecenter.design-claw` |
| Design Claw listener | Polls Telegram DMs every 5 min; parses replies as design feedback, merges into memory | `com.homecenter.design-claw-listener` |
| Home Center voice | Vosk wake gate, local Whisper command STT, Pi command dispatch | `com.homecenter.voice` |

## What does **not** live here

Personal developer-agent automation (PR review bots, agent spawners,
"Homer CI") is out of scope for this product repo. If you had code here
for that, it has been relocated outside the repo.

## First-time setup

### OpenClaw Telegram bridge

1. Create a bot with [@BotFather](https://t.me/BotFather), copy the token.
2. From the repo root:

   ```bash
   export TELEGRAM_BOT_TOKEN="<token-from-botfather>"
   export WORKER_URL="https://home-center-api.<you>.workers.dev"
   bash deploy/mac-mini/setup-openclaw-bridge.sh
   ```

   The script installs dependencies, substitutes the placeholders in
   `com.openclaw.bridge.plist`, writes a locked-down copy to
   `~/Library/LaunchAgents/`, loads the agent, and hits `/status` to verify.

3. Get your numeric chat ID (message the bot, then):
   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates" \
     | python3 -c "import json,sys; print([u['message']['chat']['id'] for u in json.load(sys.stdin)['result']])"
   ```

### Email triage / school updates

Each of these services has its own secrets (Gmail OAuth + worker auth
token) — the plist templates here do **not** include them. Copy
`email-triage/config.example.yaml` → `email-triage/config.yaml`, drop in
your worker `AUTH_TOKEN` and chat ID, then:

```bash
# Substitute __REPO_DIR__ and __WORKER_URL__ and install the plist
sed \
  -e "s|__REPO_DIR__|$PWD|g" \
  -e "s|__WORKER_URL__|$WORKER_URL|g" \
  deploy/mac-mini/com.homecenter.email-triage.plist \
  > ~/Library/LaunchAgents/com.homecenter.email-triage.plist

launchctl load ~/Library/LaunchAgents/com.homecenter.email-triage.plist
```

Same pattern for `com.homecenter.school-updates.plist`.

### Home Center voice

The voice service reads the Pi XVF3800 mic stream at `homecenter.local:8766`,
runs the configured local wake detector, transcribes rolling pre-wake +
post-wake command audio with `faster-whisper`, and dispatches actions back to
the Pi command server on `:8765`.

```bash
cd ~/home-center
bash deploy/mac-mini/setup-voice-service.sh
tail -f voice-service/logs/voice-stderr.log
```

Optional environment variables:

- `REPO`: checkout path, default `~/home-center`
- `PYTHON_BIN`: Python executable for the venv, default `python3`
- `WORKER_TOKEN`: optional bearer token for worker `/api/ask-query`
- `WAKE_ENGINE`: `vosk` by default; `openwakeword` enables the purpose-built
  DNN path after hardware validation; `speech` is a confirmed-command dry-run
  mode that uses RMS speech segments as local Whisper candidates;
  `always-stt` is the brute-force local-STT benchmark that sends every
  qualifying speech segment to local Whisper
- `OPENWAKEWORD_MODEL`: defaults to `pi/models/hey_homer.onnx`
- `WAKE_CONFIRM_COMMAND`: `0` by default; set to `1` for openWakeWord dry-runs
  where the DNN is only a candidate trigger and local Whisper must parse a
  dispatchable command before chime/dispatch. Required for `WAKE_ENGINE=speech`
  and `WAKE_ENGINE=always-stt`
- `CONFIRM_PRE_WAKE_SECONDS` / `CONFIRM_POST_WAKE_SECONDS`: confirmed-command
  capture window, default `5.0` pre + `2.0` post
- `POST_ACTION_MUTE_SECONDS`: default `3.0`; use `0.5` for dry-run phrase
  validation where no real chime or TV feedback can occur
- `OPENWAKEWORD_AUDIO_HEARTBEAT_SECONDS`: default `2.0`; logs quiet-window
  mic RMS summaries in openWakeWord confirmed-command dry-runs; set `0` to
  disable
- `OPENWAKEWORD_AUDIO_LOG_MIN_RMS`: default `180`; emits raw mic activity
  probes even when openWakeWord scores remain near zero
- `OPENWAKEWORD_AUDIO_LOG_INTERVAL_SECONDS`: default `1.0`; rate limit for
  raw mic activity probe logs
- `OPENWAKEWORD_SCORE_LOG_MIN`: default `0.20`; use `0.05` in dry-run tuning
  to log near-threshold openWakeWord scores during active speech
- `OPENWAKEWORD_SEGMENT_END_SILENCE_SECONDS`: default `0.8`; confirmed-command
  mode allows only one local Whisper confirmation per active speech segment
- `OPENWAKEWORD_EMPTY_CONFIRM_COOLDOWN_SECONDS`: default `4.0`; suppresses
  repeated STT confirmations after empty/non-command candidate wakes
- `SPEECH_CANDIDATE_MIN_PEAK_RMS`: default `450`; minimum segment peak RMS for
  `WAKE_ENGINE=speech`
- `SPEECH_CANDIDATE_END_SILENCE_SECONDS`: default `0.65`; quiet audio needed
  before a speech candidate segment is sent to local Whisper
- `SPEECH_CANDIDATE_PRE_ROLL_SECONDS`: default `0.45`; quiet audio included
  before the RMS speech segment so Whisper does not lose the first syllable
- `SPEECH_CANDIDATE_MAX_SEGMENT_SECONDS`: default `6.0`; maximum active speech
  segment before local confirmation runs even without trailing silence
- `SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS`: default `12.0`; suppresses
  repeated max-length ambient confirmations after an empty result while still
  allowing silence-ended candidates in `WAKE_ENGINE=speech`; `always-stt`
  intentionally does not apply this backoff
- `SPEECH_CANDIDATE_EMPTY_BACKOFF_SECONDS`: default `0`; when set, suppresses
  weak speech candidates for this many seconds after any empty/non-command
  confirmation
- `SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_PEAK_RMS`: default `2000`; peak
  RMS needed to bypass all-empty backoff
- `SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_ACTIVE_CHUNKS`: default `12`;
  active chunk count needed to bypass all-empty backoff
- `SPEECH_CANDIDATE_EMIT_VERIFYING`: default `0`; set to `1` only when
  debugging UI state for raw speech candidates
- `CONFIRM_MULTI_COMMAND_DISPATCH`: default `0`; set to `1` only for dry-run
  validation to dispatch every wake-qualified command candidate from one
  merged transcript

### Design Claw (daily + listener)

A separate **design-focused** bot (not the OpenClaw family bot) and a
separate OpenAI key. One script installs both launchd jobs (the 08:15
daily and the 5-minute feedback poller). See
[`docs/design_claw.md`](../../docs/design_claw.md) for the workflow.

```bash
export OPENAI_API_KEY="sk-..."
export TELEGRAM_BOT_TOKEN="<design-bot token from @BotFather>"
export TELEGRAM_CHAT_ID="<your DM chat id>"
bash deploy/mac-mini/setup-design-claw.sh
```

The script installs `openai` + `playwright` (with Chromium), renders
both plists into `~/Library/LaunchAgents/` at mode `600`, and loads
both agents. After that, replying to David in Telegram is a valid
feedback channel — the listener picks up the message within 5 minutes,
parses it via the feedback prompt, merges into `design_memory/`, and
acks.

## Troubleshooting

- **Bridge won't start** — check `openclaw/logs/bridge-stderr.log`. Common
  causes: wrong `NODE_PATH` in the plist (Apple Silicon Homebrew puts node
  at `/opt/homebrew/bin/node`), missing `TELEGRAM_BOT_TOKEN`, stale plist
  owned by a previous user.
- **Bridge returns 503 "Telegram not connected"** — token is wrong or the
  bot has been revoked. Check `@BotFather` → `/mybots`.
- **Token rotation** — regenerate in `@BotFather`, re-run
  `setup-openclaw-bridge.sh` with the new token. The script
  unloads/reloads the agent.

## Security notes

- The rendered `~/Library/LaunchAgents/com.openclaw.bridge.plist` contains
  the Telegram bot token in plaintext. `setup-openclaw-bridge.sh` `chmod 600`s
  it so only the current user can read it. Do **not** commit a rendered plist.
- Gmail `credentials.json` and `token.json` files in `email-triage/` and
  `school-updates/` are covered by the root `.gitignore`; confirm with
  `git check-ignore` before assuming.
- The rendered `~/Library/LaunchAgents/com.homecenter.voice.plist` may contain
  `WORKER_TOKEN` if one is supplied. The setup script writes it at mode `600`.
- The Cloudflare worker URL itself is not secret, but the `AUTH_TOKEN` you
  configure is. Set it with `wrangler secret put AUTH_TOKEN` on the
  worker side, not in source.
