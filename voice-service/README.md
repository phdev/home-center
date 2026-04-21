# voice-service (Mac mini)

Wake-word + speech-to-text service. Connects to the Pi's `mic_streamer`
over TCP, runs openWakeWord ("hey homer") and faster-whisper on the
stream, and dispatches commands back to the Pi's `:8765` command server
(CEC, timers, dashboard navigation, chime) and to the Cloudflare worker
(LLM queries).

Replaces the old Pi-resident wake-word service, which was bottlenecked
by the Pi's CPU and a base-sized Whisper model.

## Layout

```
Pi (homecenter.local)              Mac mini
─────────────────────              ────────────────────
XVF3800 USB mic                    voice-service/
  │                                  ├─ voice_service.py   (main)
  ▼                                  ├─ requirements.txt
mic_streamer.py  ──TCP:8766──▶   voice_service.py
wake_word_service.py (stripped)  ◀──HTTP:8765──  voice_service.py
  └─ /api/chime, /api/tv/on…
```

## Install

```bash
export WORKER_URL="https://home-center-api.<you>.workers.dev"
export WORKER_TOKEN="..."         # optional
export MIC_HOST="homecenter.local"
export WHISPER_MODEL="medium.en"  # or small.en / large-v3 on M-series
bash deploy/mac-mini/setup-voice-service.sh
```

The script creates `voice-service/.venv`, installs the deps, renders
`~/Library/LaunchAgents/com.homecenter.voice.plist`, and loads it.

## Logs

```bash
tail -f voice-service/logs/voice-stdout.log
tail -f voice-service/logs/voice-stderr.log
```

## Manual run (dry-run / debugging)

```bash
voice-service/.venv/bin/python voice-service/voice_service.py \
  --mic-host homecenter.local --debug --dry-run
```

## Models

Reads `pi/models/hey_homer.onnx` for the custom wake word. The path is
set via `MODEL_DIR`; defaults to `voice-service/models` if you'd rather
keep a Mac-local copy.
