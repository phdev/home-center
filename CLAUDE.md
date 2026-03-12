# CLAUDE.md — Project Memory

## Git Workflow

- **Always push and merge into `main`** for every change.
- GitHub Pages deploys automatically from `main` via GitHub Actions (`.github/workflows/deploy.yml`).

### Push & Merge Process (Direct to Main via PAT)

Bypass pull requests entirely using two sequential pushes:

1. Commit changes on the `claude/` feature branch.
2. Push the feature branch to origin:
   ```
   git push -u origin claude/<branch-name>
   ```
3. Push the feature branch directly onto `main` via PAT-authenticated URL:
   ```
   git push https://x-access-token:<PAT>@github.com/phdev/accel-driv.git claude/<branch-name>:main
   ```
   - `x-access-token` is the username GitHub expects for PAT-based HTTPS auth.
   - The refspec `branch:main` fast-forwards `main` to the feature branch tip.
   - No PR, no merge commit, no review step.
   - GitHub Pages deploys immediately after push succeeds.

**PAT is stored outside the repo (never committed).** Use the token provided at session start.

### Retry Policy

- If push fails due to network errors, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s).

## Project Overview

- Vite-based project deployed to GitHub Pages.
- Build output goes to `./dist`.
- Node LTS with npm for dependency management.

## TV Dashboard UI

### Display Target

- **Physical display:** Samsung TV, 3840x2160 (4K) via HDMI
- **Logical resolution:** 1920x1080 — Chromium runs with `--force-device-scale-factor=2` in `~/.config/labwc/autostart`, so all CSS is authored for 1080p and rendered at 2x sharpness
- **Platform:** Chromium kiosk mode on Raspberry Pi (labwc Wayland compositor, lightdm)
- **Viewport:** Fixed position, no scrolling (`position: fixed; inset: 0; overflow: hidden`)
- **Mobile breakpoint:** 768px (switches to single-column scrollable layout)

### Layout

- **Desktop grid:** Two rows
  - Top row (36% height): Calendar (1fr) | Weather (1.3fr) | Photos (1fr) | Facts (0.8fr)
  - Bottom row (64% height): Notifications+AgentTasks | Events+Timers | Birthdays | Search/Ask Anything
- **Gaps:** 14px between panels, 20px 44px 12px padding

### Typography

- **Display fonts:** Fraunces (default), Playfair Display, VT323, Baloo 2, Cormorant Garamond (per theme)
- **Body fonts:** DM Sans (default), Source Serif 4, Space Mono, Nunito, Outfit (per theme)
- **Current font sizes (rem):** Header title 1.5–1.6, clock 2.4–2.8, panel headers 0.8–0.9, content text 0.75–0.82, buttons 0.62–0.9, labels 0.5–0.65, micro text 0.45–0.6

### Themes (5 available)

1. **Midnight Observatory** — dark blue, cyan accent, serif, ambient glow
2. **Morning Paper** — light beige, red accent, serif, no glow
3. **Retro Terminal** — black/green monospace, CRT scanlines
4. **Soft Playroom** — pastel gradients, pink accent, rounded
5. **Glass Noir** — dark gradient, gold accent, backdrop blur

### Key UI Files

| File | Purpose |
|---|---|
| `src/App.jsx` | Main dashboard grid layout |
| `src/themes/index.js` | Theme definitions (colors, fonts, effects) |
| `src/hooks/usePreviewMode.js` | TV resolution constants (1920x1080) |
| `src/components/` | 17 panel/widget components |
| `index.html` | Viewport config, font imports, dark background |

### HandController (Meta Glasses Gesture Control)

**iOS app** (`phdev/HandController`) streams video from Meta Ray-Ban glasses, detects hand gestures via Apple Vision, and POSTs to the Cloudflare Worker.

**Connection flow:**
1. HandController iOS app → POST `/api/notifications` (with `type: "gesture"`, `from: "HandController"`)
2. Worker extracts gesture from title (e.g. `"R Hand: Wave Right"` → `waveRight`), stores in KV as `gesture_latest`
3. Dashboard polls `GET /api/gesture` every 500ms → processes gesture → green glasses icon appears in top nav

**Worker URL:** `https://home-center-api.phhowell.workers.dev` (no AUTH_TOKEN currently configured)

**Spatial navigation** (dashboard only):
```
Row 0:  Calendar → Birthdays → Weather → WorldClock → Timers
Row 1:  Calendar → Photos    → Events  →             → AgentTasks
Row 2:  Calendar →           →         →             → Fact
```
- Wave right/left/up/down navigates spatially between panels
- Calendar is selected by default on load
- Index-thumb pinch opens fullscreen page (Calendar, Weather, Photos)
- Middle-thumb pinch returns to dashboard from any fullscreen page
- Selected panel: **5px blue (#3B82F6) border**

**Photo page gestures:** Two-hand pinch in/out zooms, pinchDrag up/down scrolls

**Key files:**

| File | Purpose |
|---|---|
| `src/hooks/useHandController.js` | Gesture polling, spatial nav, connection state |
| `src/components/GlassesIndicator.jsx` | Green glasses icon for top nav (all pages) |
| `src/components/Panel.jsx` | Panel wrapper with selected border style |
| `worker/src/index.js` | Worker: `/api/notifications` → `/api/gesture` relay |

## Pencil Designs & TV Preview

### Workflow (ALWAYS follow when creating/updating pencil designs)

When you create or modify a pencil design in `home-center.pen`, you MUST also:

1. **Add to `src/TVPreview.jsx` PENCIL_PAGES array** — add a `{ slug, label, nodeId }` entry so it appears in the TV Preview dropdown under "Pencil Designs".
2. **Add to `scripts/update-pencil-screenshots.mjs` pages array** — add a `{ slug, nodeId }` entry matching the TVPreview slug.
3. **Run the screenshot script** — `node scripts/update-pencil-screenshots.mjs` to generate static PNGs in `public/pencil-screenshots/`.
4. **If it's a live page, add to LIVE_VIEWS too** — add `{ slug, label, params }` entry in TVPreview.

Do this automatically without being asked. Every pencil design must be viewable in the TV Preview at `192.168.1.103:5174/home-center/tv-preview/`.

### Current Pencil Designs

| Design | Node ID | Slug |
|--------|---------|------|
| Family TV Dashboard | `8pkH2` | `family-tv-dashboard` |
| Full Calendar Page | `85GSD` | `full-calendar-page` |
| Weekly Calendar Page | `ZPJSg` | `weekly-calendar-design` |
| Daily Calendar Page | `jRHG1` | `daily-calendar-design` |
| Full Weather Page | `VD32B` | `full-weather-page` |
| Full Photos Page | `ZOFqi` | `full-photos-page` |
| LLM Response Page | `dMUil` | `full-llm-response-page` |
| History Page | `Tbtje` | `full-history-page` |
| Transcription Overlay | `DeP7G` | `transcription-overlay` |

### Key Files

| File | Purpose |
|---|---|
| `home-center.pen` | Pencil design file (in ~/Documents/) |
| `src/TVPreview.jsx` | TV Preview page — PENCIL_PAGES + LIVE_VIEWS arrays |
| `scripts/update-pencil-screenshots.mjs` | Generates static PNGs from pencil designs via MCP |
| `public/pencil-screenshots/` | Generated PNG files served by TV Preview |

## Wake Word Service (Raspberry Pi)

### Architecture

A Python service (`pi/wake_word_service.py`) runs on a Raspberry Pi, continuously listening for voice commands via a ReSpeaker 2-Mic Pi HAT. On detection, it controls a TV via HDMI-CEC (`cec-client`).

**Commands:**
- "Hey Homer" → Turn TV on + set Pi as active HDMI source
- "Hey Homer, turn off" → Put TV in standby
- "Hey Homer, turn on" → Turn TV on (explicit variant)

### Pi Access

- **SSH:** `ssh pi@homecenter.local`
- **Service:** `sudo systemctl {start|stop|restart|status} wake-word`
- **Logs:** `sudo journalctl -u wake-word -f`
- **Venv:** `/home/pi/home-center/pi/.venv/`
- **Service unit:** `/etc/systemd/system/wake-word.service`
- **Audio device:** ReSpeaker 2-Mic HAT (WM8960 codec, typically `hw:2,0`)

### Key Files

| File | Purpose |
|---|---|
| `pi/wake_word_service.py` | Main service — audio capture, wake word detection, CEC control, chime playback |
| `pi/train_hey_homer.py` | Training script for openWakeWord custom models |
| `pi/models/` | ONNX/PT model files for openWakeWord |
| `pi/sounds/acknowledge.wav` | Two-tone chime (C5+E5) played on detection |

### Current Status (as of 2026-03-12)

Uses openWakeWord with custom ONNX models trained via `pi/train_hey_homer.py`. After wake word detection, uses faster-whisper (tiny model, int8, local) for speech-to-text to parse voice commands.

**Commands (via STT after wake word):**
- "Hey Homer, set a timer for X minutes for Y" → creates timer via worker API
- "Hey Homer, stop" → dismisses all expired timers
- "Hey Homer, turn off" → TV standby via HDMI-CEC
- "Hey Homer, show calendar/weather/photos" → navigates to page
- "Hey Homer, go back" → returns to dashboard
- "Hey Homer, [question]" → sends to LLM via worker `/api/ask-query`
- "Hey Homer" (no command) → turns on TV

**Two-stage detection (DNN → Whisper verification):**
1. openWakeWord DNN detects wake word candidate
2. Rolling 2.5s audio buffer is fed to Whisper to verify "homer" was actually spoken
3. Only if Whisper confirms → chime plays and command recording begins
4. This eliminates false positives from ambient noise/TV audio

**Audio preprocessing pipeline:**
- **High-pass filter** (85 Hz cutoff) — removes TV bass, HVAC rumble, fan noise before DNN inference
- **Adaptive noise floor tracking** — continuously estimates ambient noise level
- **Energy-adaptive threshold** — lowers DNN threshold to 85% when strong speech detected (4× RMS minimum)

**Robustness mitigations against false positives:**
- **Whisper verification gate** — two-stage: DNN triggers → Whisper confirms "homer" in rolling buffer before acting
- **Phonetic pattern matching** — Whisper tiny often mis-transcribes "hey homer" as "homework", "home", etc. Verification accepts these phonetic near-matches
- **No-speech threshold raised to 0.95** — prevents Whisper from discarding short/quiet utterances as silence
- RMS energy gate (configurable via `/api/wake-config`, default 200)
- Consecutive frame requirement (default 3 consecutive high-scoring frames)
- Score smoothing — averages last N prediction scores (default 3)
- Post-action mute (default 8s) to prevent TV audio feedback loops
- Model reset after each detection to clear prediction buffer
- Cooldown window (default 5s) between triggers
- High-confidence DNN bypass (≥0.8) skips Whisper verification for speed

**Training (for retraining the DNN):**
- `python pi/train_hey_homer.py --negative-samples 2000 --positive-samples 500 --augments 6`
- Training script includes noise, silence, music, and phonetically-similar negatives
- Use `--clip-duration 2.0` for "hey homer"
- **Real voice recording:** `--record 50` records samples from the ReSpeaker mic interactively
- **Reuse recorded samples:** `--real-samples models/real_samples_positive_*.npz`
- **Record negatives:** `--record-negative 30` for non-wake-word samples
- **Augmentation:** time-stretching, room reverb simulation, variable SNR noise (down to 5 dB)
- Real samples get 20× augmentation by default (`--real-augments 20`)

**Voice sample recording mode (via HandController app):**
- Worker endpoint: `POST /api/wake-record` with `{action: "toggle"|"start"|"stop"|"set_type"|"reset_totals", type: "positive"|"negative"}`
- Status: `GET /api/wake-record` → `{active, type, count, totalPositive, totalNegative}`
- When active, the wake word service auto-records speech clips above the noise floor
- Clips saved to `pi/models/recorded_samples/`, merged to `.npz` on stop
- Audio feedback: ascending chime (start), beep (each clip saved), descending tone (stop)
- Wake word detection is paused during recording mode
- Worker tracks cumulative `totalPositive`/`totalNegative` across sessions (goal: 50 each)
- Dashboard shows red pulsing `RecordingIndicator` in header when active (session count + progress toward 50)
- When idle, shows persistent totals if any samples exist (e.g. "12+ 5−")

**Key UI files for recording mode:**

| File | Purpose |
|---|---|
| `src/components/RecordingIndicator.jsx` | Red pulsing mic + counter in header |
| `src/hooks/useWakeRecord.js` | Polls `/api/wake-record` every 2s |

The systemd service runs with `--debug` for diagnostics. Worker URL is configured via `--worker-url`.

### Deploying to Pi

```bash
# Copy a file to the Pi
scp pi/wake_word_service.py pi@homecenter.local:/home/pi/home-center/pi/

# Restart the service after changes
ssh pi@homecenter.local "sudo systemctl restart wake-word"

# Install a Python package in the Pi's venv
ssh pi@homecenter.local "/home/pi/home-center/pi/.venv/bin/pip install <package>"
```

## OpenClaw (Family WhatsApp Assistant)

### Architecture

A Node.js service (`openclaw/index.js`) running on the Pi provides a WhatsApp bridge using `whatsapp-web.js`. It exposes a local HTTP API for sending messages and forwards incoming messages to the worker's `/api/ask` LLM endpoint for bot replies.

**OpenClaw is the family-facing assistant.** Family members scan the QR code on the TV dashboard, text questions ("when's Emma's science fair?"), and get LLM-powered answers. It also delivers email triage notifications and school updates to a family group chat.

**Homer CI** (see below) is the separate dev-facing orchestrator that uses this same bridge as transport for build/PR notifications to Peter's personal chat.

### API Endpoints (localhost:3100)

- `GET /status` — connection health, QR pending state
- `GET /qr` — QR code data for pairing
- `GET /chats` — list recent chats (for finding chat IDs)
- `POST /send` — send message: `{ chatId, message }`

### Pi Access

- **Service:** `sudo systemctl {start|stop|restart|status} openclaw`
- **Logs:** `sudo journalctl -u openclaw -f`
- **Service unit:** `/etc/systemd/system/openclaw.service`
- **Working dir:** `/home/pi/home-center/openclaw/`
- **Auth data:** `/home/pi/home-center/openclaw/.wwebjs_auth/` (persists WhatsApp session)
- **Browser:** Uses system Chromium (`/usr/bin/chromium`) via `PUPPETEER_EXECUTABLE_PATH` env var

### Key Files

| File | Purpose |
|---|---|
| `openclaw/index.js` | Main service — Express API + whatsapp-web.js client |
| `openclaw/package.json` | Dependencies (whatsapp-web.js, express, qrcode-terminal) |
| `openclaw/openclaw.service` | Systemd unit file |

### Integration with Other Services

- **Email triage** (`email-triage/email_triage/notifier.py`) — posts to `http://localhost:3100/send` when `whatsapp.enabled` is true in config
- **Dashboard QR code** (`src/components/FactPanel.jsx`) — "Chat with OpenClaw" QR links to WhatsApp
- **Dashboard panel** (`src/components/AgentTasksPanel.jsx`) — header labeled "OpenClaw"
- **Incoming messages** — forwarded to worker `/api/ask` for LLM-powered replies (when `--llm-url` is set)
- **Homer CI** — dev orchestrator sends build/PR notifications via `POST /send` to Peter's personal chat

### Setup

1. Start the service: `sudo systemctl start openclaw`
2. Watch logs for QR code: `sudo journalctl -u openclaw -f`
3. Scan QR with WhatsApp on your phone
4. Check connection: `curl http://localhost:3100/status`
5. Find chat IDs: `curl http://localhost:3100/chats`
6. Set `chat_id` in `email-triage/config.yaml` and enable WhatsApp

### Deploying Changes

```bash
# Copy updated files to Pi
scp openclaw/index.js pi@homecenter.local:/home/pi/home-center/openclaw/

# Restart service
ssh pi@homecenter.local "sudo systemctl restart openclaw"

# Install new npm deps (if package.json changed)
ssh pi@homecenter.local "cd /home/pi/home-center/openclaw && npm install"
```

## Homer CI (Dev Agent Orchestrator)

### Architecture

Homer CI is the dev-facing agent orchestrator that spawns coding agents, monitors their progress via cron, and sends WhatsApp notifications when PRs are ready. It runs on the Mac (not the Pi).

**Homer CI is NOT OpenClaw.** OpenClaw is the family assistant. Homer CI uses the OpenClaw WhatsApp bridge as transport but targets Peter's personal chat, not the family group.

### How It Works

1. Write a task prompt file describing the feature to build
2. `spawn-agent.sh` creates a branch, launches Claude Code or Codex in tmux
3. Agent commits, pushes, opens PR
4. GitHub Actions (`openclaw-checks.yml`) runs build, code review, security scan
5. `check-agents.sh` (cron, every 15 min) reads CI results, sends WhatsApp notification

### Key Files

| File | Purpose |
|---|---|
| `.openclaw/orchestrator-prompt.md` | Homer CI system prompt with architecture + rules |
| `.openclaw/active-tasks.json` | Task registry (status, gates, PR numbers) |
| `.openclaw/audit.log` | All agent actions logged here |
| `.openclaw/scripts/spawn-agent.sh` | Launch agent in tmux with branch isolation |
| `.openclaw/scripts/check-agents.sh` | Cron monitor — reads CI, sends notifications |
| `.openclaw/scripts/notify-whatsapp.sh` | Send dev notifications via OpenClaw bridge |
| `.openclaw/scripts/review-pr.sh` | Manual fallback for local PR review |
| `.openclaw/scripts/build-context.sh` | Generate module map from codebase |
| `.openclaw/scripts/detect-tasks.sh` | Proactive task suggestions from family context |
| `.openclaw/templates/frontend-agent.md` | Prompt template for UI tasks (Claude Code) |
| `.openclaw/templates/backend-agent.md` | Prompt template for worker/Pi tasks (Codex) |
| `.openclaw/context/module-map.md` | Auto-generated codebase map |
| `.github/workflows/openclaw-checks.yml` | CI: build + code review + security scan |

### Environment Variables

```bash
HOMER_CI_CHAT_ID="<your-personal-whatsapp-id>@c.us"
HOMER_CI_OPENCLAW_URL="http://homecenter.local:3100"
```

### Spawning an Agent

```bash
# Write a task prompt
cat > /tmp/task.md << 'EOF'
# Add sunrise/sunset to WeatherPanel
...
EOF

# Spawn
bash .openclaw/scripts/spawn-agent.sh task-001 weather-sunrise frontend /tmp/task.md

# Watch
tmux attach -t agent-task-001
```

### Security

- Agents get ZERO access to family data
- Agents never SSH to Pi or deploy
- All quality gates run in GitHub Actions (not locally)
- External data wrapped in `<UNTRUSTED_EXTERNAL_CONTEXT>` tags
- Everything logged to `.openclaw/audit.log`
