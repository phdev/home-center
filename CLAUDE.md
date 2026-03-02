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

### Current Status (as of 2026-03-01)

Uses openWakeWord with custom ONNX models trained via `pi/train_hey_homer.py`. After wake word detection, uses faster-whisper (tiny model, int8, local) for speech-to-text to parse voice commands.

**Commands (via STT after wake word):**
- "Hey Homer, set a timer for X minutes for Y" → creates timer via worker API
- "Hey Homer, stop" → dismisses all expired timers
- "Hey Homer, turn off" → TV standby via HDMI-CEC
- "Hey Homer" (no command) → does nothing (previously defaulted to turn_on)

**Two-stage detection (DNN → Whisper verification):**
1. openWakeWord DNN detects wake word candidate
2. Rolling 2.5s audio buffer is fed to Whisper to verify "homer" was actually spoken
3. Only if Whisper confirms → chime plays and command recording begins
4. This eliminates false positives from ambient noise/TV audio

**Robustness mitigations against false positives:**
- **Whisper verification gate** — two-stage: DNN triggers → Whisper confirms "homer" in rolling buffer before acting
- **Phonetic pattern matching** — Whisper tiny often mis-transcribes "hey homer" as "homework", "home", etc. Verification accepts these phonetic near-matches
- **No-speech threshold raised to 0.95** — prevents Whisper from discarding short/quiet utterances as silence
- RMS energy gate (MIN_RMS_ENERGY=300) — ignores low-energy audio chunks
- Consecutive frame requirement — needs 5+ consecutive high-scoring frames (raised from 3)
- Score smoothing — averages last 3 prediction scores
- Post-action mute — 15s silence after trigger to prevent TV audio feedback loops (raised from 3s)
- Model reset after each detection to clear prediction buffer
- Cooldown window (10s) between triggers
- Empty transcription returns "none" action (no longer defaults to turn_on)

**Training (for retraining the DNN):**
- `python pi/train_hey_homer.py --negative-samples 2000 --positive-samples 500 --augments 6`
- Training script includes noise, silence, music, and phonetically-similar negatives
- Use `--clip-duration 2.0` for "hey homer"

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
