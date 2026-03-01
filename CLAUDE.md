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
| `pi/train_hey_homer.py` | Training script for openWakeWord custom models (deprecated — switching to Porcupine) |
| `pi/models/` | ONNX/PT model files for openWakeWord |
| `pi/sounds/acknowledge.wav` | Two-tone chime (C5+E5) played on detection |

### Current Status (as of 2026-02-27)

**The service currently uses openWakeWord but is being migrated to Picovoice Porcupine.**

Reason for migration: openWakeWord models trained on synthetic TTS data produce excessive false positives (0.98+ confidence on ambient noise). Multiple mitigations were added (VAD gating, consecutive-frame requirements, post-action muting, model.reset()) but the fundamental model quality issue persists.

The systemd service is currently running in `--debug --dry-run` mode for diagnostics. Remove those flags from the ExecStart line when ready for production.

### Next Step: Porcupine Migration

1. Install `pvporcupine` in the Pi venv
2. Create a Picovoice access key (free tier, personal/non-commercial)
3. Train custom wake words ("Hey Homer", "Hey Homer turn off/on") via Porcupine Console → produces `.ppn` keyword files
4. Replace openWakeWord model loading and `model.predict()` / `model.prediction_buffer` with Porcupine's `porcupine.process()` API
5. Keep all existing infrastructure: CEC control, chime, ALSA capture, VAD, debounce logic
6. Remove `--debug --dry-run` from systemd ExecStart once working

### Deploying to Pi

```bash
# Copy a file to the Pi
scp pi/wake_word_service.py pi@homecenter.local:/home/pi/home-center/pi/

# Restart the service after changes
ssh pi@homecenter.local "sudo systemctl restart wake-word"

# Install a Python package in the Pi's venv
ssh pi@homecenter.local "/home/pi/home-center/pi/.venv/bin/pip install <package>"
```
