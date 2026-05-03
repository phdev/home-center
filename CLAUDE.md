# CLAUDE.md — Project Memory

## Project Brain (gbrain) — READ FIRST

Before making meaningful changes to Home Center — adding a card, changing a
derived-state flag, touching data ingestion, wiring an enhancement — read
the four docs in `docs/`:

1. [`docs/README.md`](docs/README.md) — the gbrain contract (rules everything follows)
2. [`docs/home_center_state_model.md`](docs/home_center_state_model.md) — raw sources → derived state → UI map
3. [`docs/home_center_derived_states.md`](docs/home_center_derived_states.md) — per-flag contracts
4. [`docs/home_center_ui_card_contracts.md`](docs/home_center_ui_card_contracts.md) — per-card contracts
5. [`docs/home_center_decisions_log.md`](docs/home_center_decisions_log.md) — decisions log

### Rules (non-negotiable)

1. **Raw data → derived state → UI is the only flow.** Do not bypass it.
2. **UI visibility is driven only by derived state.** Never put visibility
   logic (`if now.hour >= …`, `if fetch result …`) inside a component. If a
   card needs a new trigger, add a flag in `src/state/deriveState.js` first.
3. **OpenClaw enhances, it does not decide.** Copy, summaries, ordering
   hints — yes. Card visibility, reminder timing, flag truth value — no.
   Every enhancement call must degrade gracefully to deterministic copy.
4. **Storage source is invisible to components.** Worker-vs-localStorage
   routing stays in `src/data/_storage.js` + adapter wrappers.
5. **Reminder timing is deterministic arithmetic**, not an LLM call.

### Workflow — what to do before/after a change

**Before implementing:**
- Skim the relevant doc(s) to confirm contracts and edge cases.
- If the change doesn't fit the existing contract, decide whether to
  extend the contract (update the doc) or rethink the change.

**While implementing:**
- Put state logic in `src/state/deriveState.js` (pure, testable).
- Put visibility predicates in `src/cards/registry.js`.
- Put storage routing in `src/data/*` adapters.
- Put enhancement calls behind `useEnhancement(...)` with fallback.

**After implementing:**
- Update the relevant gbrain doc(s). At minimum: the flag contract or card
  contract for what you changed.
- If you changed an invariant, rule, or architectural pattern, add an
  entry to `docs/home_center_decisions_log.md` with **Context / Decision /
  Consequence**.
- Run `npm test` + `npm run build`. Both must pass.

### Compound Step (capture what was learned)

After any meaningful change, capture what the repo just learned so the next
change starts from a better baseline. Small fixes don't need this; anything
that adds, renames, moves, or changes behavior of a flag, card, adapter, or
invariant does.

Before you open the PR, update the gbrain docs with three things:

1. **What changed.** The flag/card/adapter and its new shape — update
   `docs/home_center_state_model.md`, `docs/home_center_derived_states.md`,
   or `docs/home_center_ui_card_contracts.md` as relevant.
2. **What new rule, invariant, or pattern should be reused.** If this change
   establishes a pattern ("adapters always do X") or an invariant ("cards
   never do Y"), say so — so the next similar change doesn't reinvent it.
3. **Any new edge cases you hit.** Add them to the flag's "Edge cases"
   section so tests and future callers stay aware.

If the change involves an architecture-level insight — a new boundary, a
reversed assumption, a pattern that should be repeated — add a dated entry
in `docs/home_center_decisions_log.md` with **Context / Decision /
Consequence**. One paragraph is enough. The point is that an architectural
choice lives in the decisions log, not in a commit message.

Do not let the Compound Step block small bug fixes or cleanup. Use judgment:
if the change produced a lesson, capture it.

## Git Workflow

- **Open a PR. Don't push directly to `main`.**
- Branch off `origin/main` with a `claude/<slug>` branch name.
- Push, then `gh pr create` — the PR template in
  `.github/pull_request_template.md` carries the gbrain + Compound Step
  checklists.
- CI (`.github/workflows/openclaw-checks.yml`) runs the Vitest suite + build.
  Both are blocking.
- Merge only after CI is green and the gbrain checklist is honored. Squash
  merges keep `main` history readable.
- GitHub Pages deploys automatically from `main` via
  `.github/workflows/deploy.yml` after merge. **Pages is for remote/mobile
  access only — it does NOT update the Pi kiosk.** See "Deploying to the Pi"
  below for the kiosk path.

Never bypass the PR — the test gate is the enforcement mechanism for the
architectural invariants described in `docs/`.

## Deploying to the Pi

The Pi's Chromium kiosk loads `http://localhost:8080/home-center/`, served
by `dashboard-local.service` (a `python3 -m http.server 8080`) out of
`/home/pi/home-center/dashboard-local/`. So the kiosk reads
**`/home/pi/home-center/dashboard-local/home-center/`** on disk — that is
the deploy target.

**Things that look like the deploy target but aren't:**
- `phdev.github.io/home-center/` (GitHub Pages auto-deploy) — for remote/mobile access only; the kiosk never hits it.
- `/home/pi/home-center/dist/` — produced by `npm run build` on the Pi but not served to the kiosk.

Chromium itself is launched by `~/.config/labwc/autostart` (not by systemd), so the reload knob is `sudo systemctl restart lightdm` rather than a kiosk-service restart. The dashboard HTTP server (`dashboard-local.service`) sends `Cache-Control: no-store` via `pi/dashboard_serve.py`, so a fresh Chromium load always picks up the latest bundle without browser-cache fights.

**Pi git divergence:** The Pi was reconciled to main on 2026-04-24 by
pulling cleanly and marking Pi-local service files with
`git update-index --skip-worktree`:
`pi/wake_word_service.py`,
`openclaw/{index.js,package.json,package-lock.json,openclaw.service}`.
Those files have intentional divergence (the Pi runs an older single-file
OpenClaw bridge; main has the router architecture). Don't unmark
skip-worktree without thinking — those files run live Pi services.

Standard flow (after a PR merges to main):

```bash
cd ~/home-center
git checkout main && git pull
npm run build
rsync -av --delete dist/ pi@homecenter.local:/home/pi/home-center/dashboard-local/home-center/
ssh pi@homecenter.local 'sudo systemctl restart lightdm'
```

The `lightdm` restart bounces the graphical session, which retriggers
`~/.config/labwc/autostart` and relaunches Chromium against the new bundle.
Expect ~10s of black screen. Trying to relaunch Chromium directly over SSH
hangs the SSH session — `lightdm` is the reliable knob.

Verify the deploy:

```bash
ssh pi@homecenter.local 'grep -oE "index-[A-Za-z0-9_-]+\.js" /home/pi/home-center/dashboard-local/home-center/index.html'
# must equal: ls dist/assets/ | grep "^index-"

ssh pi@homecenter.local 'sudo journalctl -u dashboard-local --since "30 seconds ago" --no-pager | tail'
# expect: GET /home-center/ ... 200 and GET /home-center/assets/index-*.js ... 200
```

Build-on-the-Pi (over SSH) also works since reconciliation:

```bash
ssh pi@homecenter.local 'cd /home/pi/home-center && git pull --ff-only origin main && npm install && npm run build && rsync -av --delete dist/ /home/pi/home-center/dashboard-local/home-center/ && sudo systemctl restart lightdm'
```

A `deploy-pi` skill captures this flow — see `.claude/skills/deploy-pi/`.

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
  - Bottom row (64% height): Notifications | Events | Birthdays+Weather | Claw Suggestions/Facts
- **Gaps:** 14px between panels, 20px 44px 12px padding
- **Removed cards (2026-04-17):** World Clock, Timers panel (voice-set timers still fire via AlarmOverlay), and OpenClaw Tasks (AgentTasksPanel) were removed from the dashboard for a cleaner TV layout.
- **Left column stack (2026-04-24):** Calendar (flex 1) + HolidaysPanel (240px). HolidaysPanel reads from `src/data/holidays.js` (hardcoded US/hallmark dates) — no fetch, no derived flag. FullCalendarPage sidebar also renders Upcoming Holidays + Upcoming Birthdays sections below the events list.
- **Wake word debug overlay (2026-04-24):** WakeWordDebug now defaults to `minimized: true` so it renders as a small chip in the bottom-left instead of a 35vh panel — click to expand.

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

**iOS app** (`phdev/HandController`) streams video from Meta Ray-Ban glasses, detects hand gestures via Apple Vision, and POSTs directly to the Pi over local WiFi.

**Connection flow (local WiFi, no worker):**
1. HandController iOS app → POST `http://<pi-ip>:8765/gesture` (same payload as before: `type: "gesture"`, `title: "Right Hand: Wave Right"`, etc.)
2. Pi's wake word service HTTP server extracts gesture from title, normalizes to camelCase, stores in memory
3. Dashboard (Chromium on Pi) polls `GET http://localhost:8765/gesture` every 500ms → processes gesture → green glasses icon appears in top nav

**Pi gesture endpoint:** `http://192.168.1.162:8765/gesture` (same HTTP server as wake word recording)

**Spatial navigation** (dashboard only):
```
Row 0:  Calendar → Birthdays → Weather
Row 1:  Calendar → Photos    → Events  → ClawSuggestions/Fact
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
| `src/hooks/useHandController.js` | Gesture polling (Pi localhost:8765), spatial nav, connection state |
| `src/components/GlassesIndicator.jsx` | Green glasses icon for top nav (all pages) |
| `src/components/Panel.jsx` | Panel wrapper with selected border style |
| `pi/wake_word_service.py` | Pi HTTP server: `POST /gesture` (receive) + `GET /gesture` (poll) |

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
| OpenClaw UI Additions | `ONYZi` | `openclaw-ui-additions` |

### OpenClaw-driven Derived State

The upcoming cards (morning checklist, takeout/lunch decisions, claw suggestions, etc.) are driven by derived-state flags, not ad-hoc conditions. Three layers:

1. **Raw data** — iCloud calendar events, meal plan, birthday records, bedtime settings, school emails (via email-triage), takeout history.
2. **Derived state** (the real UI driver) — boolean/structured flags evaluated on a tick:
   `has_morning_overlap`, `warn_peter_0800_0900`, `show_morning_checklist`, `checklist_context {weather, hot}`, `school_items[] {kind, urgency, due, child, action}`, `birthday_gift_needed_for[]`, `claw_suggestions[] (ranked)`, `takeout_decision_pending`, `suggested_vendors[]`, `lunch_decision_pending`, `school_lunch_option`, `bedtime_reminder_active`.
3. **UI presentation** — React components render based on flags; OpenClaw enhances title/summary/suggested-action/explanation strings at request time via the worker's `/api/ask`.

Rule of thumb: a card mounts/unmounts on a flag, then fills in OpenClaw-authored copy once the flag flips true. Never embed decision logic inside components.

### Key Files

| File | Purpose |
|---|---|
| `home-center.pen` | Pencil design file (in ~/Documents/) |
| `src/TVPreview.jsx` | TV Preview page — PENCIL_PAGES + LIVE_VIEWS arrays |
| `scripts/update-pencil-screenshots.mjs` | Generates static PNGs from pencil designs via MCP |
| `public/pencil-screenshots/` | Generated PNG files served by TV Preview |

## Wake Word + Voice Service

### Architecture

The production voice path is split between the Pi 5 and the Mac mini:

1. `mic-streamer` on the Pi reads the ReSpeaker XVF3800 through the PipeWire `pulse` ALSA PCM and streams 16 kHz mono S16 PCM on TCP `:8766`.
2. `com.homecenter.voice` on the Mac mini runs the configured local wake engine. The launchd default remains Vosk/Kaldi because it measured 0 TV false positives in the first hardware run; `WAKE_ENGINE=openwakeword` enables the purpose-built DNN path for measured trials. `WAKE_ENGINE=speech` and `WAKE_ENGINE=always-stt` are confirmed-command-only local-STT experiments, not launchd defaults.
3. In the default Vosk path, a wake hit posts `/api/chime` to the Pi. The Pi responds before playing audio, and speaker discovery/volume setup are cached so the chime path does not block on `aplay -l`/`amixer`.
4. In confirmed-command trials (`WAKE_CONFIRM_COMMAND=1`), wake hits are candidates only. The Mac posts a soft `/api/transcription` update with `stage=verifying`, captures local audio, runs local `faster-whisper`, and only then chimes/dispatches if `voice-service/intent.py` returns a dispatchable command. Empty/non-command candidates are cleared with no action.
5. `faster-whisper` transcribes the rolling pre-wake buffer plus a short post-wake tail for wake-engine hits. In `WAKE_ENGINE=speech` and `WAKE_ENGINE=always-stt` trials, the RMS detector instead passes the completed speech segment plus short pre-roll to avoid pulling unrelated earlier phrases from the rolling buffer. `voice-service/intent.py` then maps text to supported intents and rejects incomplete command payloads before dispatch.
6. The Pi `wake-word` service runs with `--no-wake-detection` and remains the local HTTP command server for CEC, timers, navigation, chime playback, gesture state, and `/api/transcription`.

Bare "Hey Homer" intentionally does nothing. TV power-on requires an explicit command like "Hey Homer, turn on".

### Why This Replaced Whisper Wake Detection

Measured during the 2026-04-28 audit:

- PR #22 Whisper wake detection produced 30 wake matches in a 30-minute TV/noise log window, with one false `ask` dispatch. That is 60 wake matches/hour and 2 false dispatches/hour in that sample.
- The existing `hey_homer.onnx` openWakeWord model fired heavily on live XVF3800 audio: 30 hits/5 min at threshold 0.55 and 22 hits/5 min even at 0.90 on a left-channel probe; mono `pulse` still produced 5 hits/2 min at threshold 0.97.
- Vosk full-model wake gating produced 0 final and 0 partial wake hits in a 5-minute live ambient probe while still recognizing ordinary speech fragments. A grammar-limited Vosk recognizer was rejected because it had 4 final and 9 partial hits over 5 minutes.

### Pi Access

- **SSH:** `ssh pi@homecenter.local`
- **Command server:** `sudo systemctl {start|stop|restart|status} wake-word`
- **Mic stream:** `sudo systemctl {start|stop|restart|status} mic-streamer`
- **Logs:** `sudo journalctl -u wake-word -f`
- **Mic logs:** `sudo journalctl -u mic-streamer -f`
- **Venv:** `/home/pi/home-center/pi/.venv/`
- **Service unit:** `/etc/systemd/system/wake-word.service`
- **Mic service unit:** `/etc/systemd/system/mic-streamer.service`
- **Audio device:** ReSpeaker XVF3800 USB 4-Mic Array via PipeWire `pulse`

On Raspberry Pi OS Bookworm, PipeWire owns the XVF3800. Direct `hw:N,0` ALSA opens can return zero bytes from system units. The systemd service must set `XDG_RUNTIME_DIR=/run/user/1000` and `PULSE_RUNTIME_PATH=/run/user/1000/pulse`.

`mic-streamer` serves one client at a time and uses a short socket send timeout
so dead Mac clients cannot leave the streamer stuck on an old `CLOSE-WAIT`
connection while new dry-runs connect but receive no PCM bytes.

### Mac Mini Voice Service

- **SSH:** `ssh peter@peters-mac-mini.lan`
- **Launchd label:** `com.homecenter.voice`
- **Logs:** `tail -f ~/home-center/voice-service/logs/voice-stderr.log`
- **Install/reload:** `bash ~/home-center/deploy/mac-mini/setup-voice-service.sh`
- **Manual run:** see `voice-service/README.md`
- **Vosk model:** `~/home-center/voice-service/models/vosk-model-small-en-us-0.15`
- **Whisper model:** `base.en` via `faster-whisper`, CPU int8
- **Wake engine switch:** set `WAKE_ENGINE=openwakeword` plus `OPENWAKEWORD_MODEL=~/home-center/pi/models/hey_homer.onnx` for DNN trials; keep `WAKE_ENGINE=vosk` as default until the DNN passes the 30-minute TV false-positive test
- **Confirmed-command trial:** add `WAKE_CONFIRM_COMMAND=1` with `WAKE_ENGINE=openwakeword` so openWakeWord is only a candidate trigger; default capture is `CONFIRM_PRE_WAKE_SECONDS=5.0` and `CONFIRM_POST_WAKE_SECONDS=2.0`
- **Speech candidate trial:** `WAKE_ENGINE=speech` is a local-only confirmed-command mode that uses RMS speech segment boundaries only to decide when to run local Whisper. It requires `WAKE_CONFIRM_COMMAND=1`, and the transcript must contain a wake phrase plus a dispatchable command before chime/dispatch. Speech mode transcribes the completed RMS segment plus `SPEECH_CANDIDATE_PRE_ROLL_SECONDS` instead of a generic rolling tail. Use it to measure confirmed-command behavior when the current openWakeWord model is unreliable; do not make it default without 5-phrase and ambient-TV false-dispatch validation.
- **Brute-force local STT benchmark:** `WAKE_ENGINE=always-stt` uses the same RMS speech segment boundaries but sends every qualifying speech segment to local Whisper with no max-empty backoff. It requires `WAKE_CONFIRM_COMMAND=1`, suppresses raw verifying captions by default, and still requires a wake phrase plus a dispatchable command before chime/dispatch. Use it only to measure the ceiling for responsiveness and command capture before deciding whether to keep tuning wake models.
- **Speech candidate noise floor:** speech mode freezes its ambient noise estimate during active speech. Do not let long loud speech/TV bursts raise the RMS gate; that regressed short commands like "stop". Active segments are capped by `SPEECH_CANDIDATE_MAX_SEGMENT_SECONDS` so long ambient speech cannot delay confirmation until the next silence. Empty max-length segments start `SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS`, but silence-ended command segments can still confirm.
- **Speech candidate empty backoff:** `SPEECH_CANDIDATE_EMPTY_BACKOFF_SECONDS` backs off after any empty/non-command speech confirmation. Strong speech segments can still confirm during that window when they meet `SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_PEAK_RMS` and `SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_ACTIVE_CHUNKS`; this is meant to reduce passive Whisper churn without blocking clear user commands.
- **Speech candidate UI:** raw speech candidates stay internal by default and do not post `/api/transcription stage=verifying`; only confirmed commands surface to the dashboard. Set `SPEECH_CANDIDATE_EMIT_VERIFYING=1` only when debugging UI state.
- **Multi-command validation:** confirmed-command mode dispatches one command per transcript by default. Set `CONFIRM_MULTI_COMMAND_DISPATCH=1` only for dry-run validation when rapid 5-phrase tests merge multiple wake-qualified commands into one speech segment; normal launchd behavior should keep it off until multi-command UX is deliberately validated.
- **Current speech-mode baseline:** the 2026-05-01 5-phrase dry-run passed 5/5 with `SPEECH_CANDIDATE_MIN_ACTIVE_CHUNKS=3`, `SPEECH_CANDIDATE_PRE_ROLL_SECONDS=0.45`, `SPEECH_CANDIDATE_MAX_SEGMENT_SECONDS=6.0`, `SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS=12.0`, `WHISPER_MODEL=base.en`, noise-floor freeze, and multi-command dry-run dispatch. Latency was about 276-298 ms once each segment ended, including `stop`. A stricter `MIN_ACTIVE_CHUNKS=8` pass missed `stop`, so stay at 3 while validating the UI-silenced path.
- **Current passive baseline:** a 2-minute speech-mode dry-run on 2026-05-01 produced 0 dispatches and 0 command candidates. `SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS=12.0` reduced Whisper confirmations from 18 to 6 over a comparable 2-minute ambient-speech sample; skipped segments log as `reason=max_empty_backoff`.
- **Current brute-force baseline:** a clean `WAKE_ENGINE=always-stt` dry-run on 2026-05-01 passed the 5-phrase validation at 5/5 with median local STT/action latency around 281 ms after segment end. The matching 2-minute passive run produced 0 dispatches and 0 command candidates, but it still ran 16 internal Whisper confirmations on ambient speech/TV. Treat this as the local STT accuracy/safety ceiling, not a production default.
- **Current production-shaped backoff baseline:** `WAKE_ENGINE=speech`, `WAKE_CONFIRM_COMMAND=1`, `CONFIRM_MULTI_COMMAND_DISPATCH=1`, `SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS=30.0`, `SPEECH_CANDIDATE_EMPTY_BACKOFF_SECONDS=12.0`, strong override peak `1800`/active chunks `12`, `SPEECH_CANDIDATE_PRE_ROLL_SECONDS=0.45`, and `WHISPER_MODEL=base.en`. After preserving the max-empty backoff window across non-max empty candidates, the 2026-05-03 5-phrase dry-run passed 5/5 with median local STT/action latency around 285 ms after segment end and no ignored candidate wakes. The matching 2026-05-01 2-minute passive run produced 0 dispatches and 0 command candidates with 6 internal Whisper confirmations and 13 skipped candidates.
- **Rejected speech pre-roll check:** `SPEECH_CANDIDATE_PRE_ROLL_SECONDS=0.8` regressed the post-backoff 5-phrase run to 3/5 because Whisper missed the wake phrase on `turn on` and `open calendar`. Keep the wake-required safety gate and do not broaden speech-candidate mode to accept command-only speech.
- **Confirmed STT wake variants:** confirmed-command transcript parsing accepts narrow local Whisper wake variants like `Day Homer` and `8-homer` after a candidate trigger. These variants do not broaden the live Vosk/openWakeWord trigger.
- **DNN tuning logs:** confirmed-command dry-runs emit `OpenWakeWord audio heartbeat ...` summaries every `OPENWAKEWORD_AUDIO_HEARTBEAT_SECONDS` even when input is quiet. Add `OPENWAKEWORD_AUDIO_LOG_MIN_RMS=180` to emit raw `OpenWakeWord audio probe ...` lines when recent RMS rises, and add `OPENWAKEWORD_SCORE_LOG_MIN=0.05` to emit `OpenWakeWord score probe ...` lines during active speech when the score stays below threshold.
- **Confirmed-command debounce:** openWakeWord candidate confirmations are limited to one local Whisper run per active speech segment, including audio consumed during confirmation capture. Empty/non-command transcripts start `OPENWAKEWORD_EMPTY_CONFIRM_COOLDOWN_SECONDS`; skipped hits log as `Skipping openWakeWord wake ...`. Dry-run `Confirmed-command candidates=[...]` keeps leading clipped commands like `Homer, open calendar`; if the latest wake body is incomplete, dispatch falls back to the latest dispatchable candidate. The wake splitter accepts punctuated Whisper variants like `Okay, Homer, ...`.
- **Validation summary:** `python ~/home-center/voice-service/validate_voice.py --log ~/home-center/voice-service/logs/voice-stderr.log --mark-start`, then rerun with `--offset <bytes> --expected-count 20`

### Key Files

| File | Purpose |
|---|---|
| `pi/mic_streamer.py` | Pi XVF3800 PipeWire `pulse` capture streamer on TCP `:8766` |
| `pi/wake_word_service.py` | Pi command server: CEC, timers, chime, dashboard voice state, gestures |
| `pi/services/mic-streamer.service` | Systemd unit for Pi mic streaming |
| `pi/services/wake-word.service` | Systemd unit for Pi command server mode |
| `voice-service/voice_service.py` | Mac mini wake engine, local STT, command dispatch |
| `voice-service/intent.py` | Deterministic intent parser for supported commands |
| `voice-service/validate_voice.py` | Log-offset validation summary for latency, dispatch count, and miss rate |
| `voice-service/README.md` | Install, debug, and manual-run notes for the Mac service |
| `deploy/mac-mini/com.homecenter.voice.plist` | Launchd template for the Mac voice service |
| `src/components/WakeOverlay.jsx` | Full-screen blue wake glow matching the Pencil overlay |
| `src/components/LiveCaption.jsx` | Bottom live caption pill matching the Pencil overlay |
| `src/hooks/useLiveCaption.js` | Polls Pi `/api/transcription` every 150 ms |

### Supported Commands

- "Hey Homer, set a timer for X minutes for Y" creates a local Pi timer.
- "Hey Homer, stop" dismisses expired timers.
- "Hey Homer, turn off" sends TV standby via HDMI-CEC.
- "Hey Homer, turn on" powers the TV and sets the Pi as active source.
- "Hey Homer, show calendar/weather/photos" navigates the dashboard.
- "Hey Homer, go back" returns to the dashboard.
- "Hey Homer, what/who/where/when/why/how ..." routes the question to the existing worker `/api/ask-query`.

### Design Artifact

Live transcription UI is specified in Pencil frame `Jf7Tx` (`Voice Transcription Overlay`) in `~/Documents/home-center.pen`. The React path is `WakeOverlay` plus `LiveCaption`; keep this frame updated before changing transcription UI. `src/TVPreview.jsx` includes the frame as `voice-transcription-overlay`.

`scripts/update-pencil-screenshots.mjs` includes the same page entry. The active Pencil MCP renderer can preview `Jf7Tx`, but the standalone screenshot script may skip it if the saved `.pen` file does not expose that node to the CLI MCP process.

### Legacy Recording Mode

The old openWakeWord recording/enrollment code is still present in `pi/wake_word_service.py` for fallback/debugging, but it is not in the production service path while `wake-word.service` runs with `--no-wake-detection`.

**Key UI files for legacy recording mode:**

| File | Purpose |
|---|---|
| `src/components/RecordingIndicator.jsx` | Red pulsing mic + counter in header |
| `src/hooks/useWakeRecord.js` | Polls `/api/wake-record` every 2s |

Worker URL is configured on the Pi command server via `--worker-url`.

### Deploying to Pi

```bash
# Copy a file to the Pi
scp pi/wake_word_service.py pi@homecenter.local:/home/pi/home-center/pi/
scp pi/mic_streamer.py pi@homecenter.local:/home/pi/home-center/pi/

# Restart services after changes
ssh pi@homecenter.local "sudo systemctl restart wake-word"
ssh pi@homecenter.local "sudo systemctl restart mic-streamer"

# Reload the Mac mini voice service after changes
rsync -av voice-service/ peter@peters-mac-mini.lan:/Users/peter/home-center/voice-service/
rsync -av deploy/mac-mini/ peter@peters-mac-mini.lan:/Users/peter/home-center/deploy/mac-mini/
ssh peter@peters-mac-mini.lan "bash /Users/peter/home-center/deploy/mac-mini/setup-voice-service.sh"

# Install a Python package in the Pi's venv
ssh pi@homecenter.local "/home/pi/home-center/pi/.venv/bin/pip install <package>"
```

## Hardware Architecture

### Three Machines

| Machine | Hostname | Role |
|---|---|---|
| **Raspberry Pi** | `homecenter.local` | Chromium kiosk, XVF3800 mic stream, local command API, HDMI-CEC |
| **Mac Mini** | `peters-mac-mini.lan` | Voice wake/STT compute, OpenClaw bridge, email-triage, school-updates, agent spawning |
| **Laptop** | — | Development only (optional) |

### What runs where

| Service | Machine | Manager | Port |
|---|---|---|---|
| Chromium kiosk | Pi | `~/.config/labwc/autostart` (not systemd) | — |
| Dashboard HTTP server | Pi | systemd (`dashboard-local`) | 8080 |
| Mic streamer | Pi | systemd (`mic-streamer`) | 8766 |
| Pi command server | Pi | systemd (`wake-word`) | 8765 |
| Voice wake/STT | Mac Mini | launchd (`com.homecenter.voice`) | — |
| OpenClaw bridge | Mac Mini | launchd (`com.openclaw.bridge`) | 3100 |
| Email triage | Mac Mini | launchd (`com.homecenter.email-triage`) | — |
| School updates | Mac Mini | launchd (`com.homecenter.school-updates`) | — |
| Cloudflare Worker | Cloudflare | — | — |

### Mac Mini Setup

```bash
git clone https://github.com/phdev/home-center.git
cd home-center
export TELEGRAM_BOT_TOKEN="<from @BotFather>"
export WORKER_URL="https://home-center-api.<you>.workers.dev"
bash deploy/mac-mini/setup-openclaw-bridge.sh
```

Plist templates for the email-triage and school-updates services live in
`deploy/mac-mini/` — see `deploy/mac-mini/README.md` for the render-and-load
steps.

## State-Driven Architecture

The dashboard follows a **raw → derived → UI** pipeline. See the detailed specs:

- `docs/home_center_state_model.md` — data sources, ownership, failure modes
- `docs/home_center_derived_states.md` — per-flag contracts (inputs, rules, edge cases)
- `docs/home_center_ui_card_contracts.md` — per-card visibility / data / enhancement / actions
- `docs/home_center_decisions_log.md` — architecture decisions log

### Directory layout

| Path | Purpose |
|---|---|
| `src/services/` | External API clients (no React) |
| `src/data/` | Normalizers + small hooks that adapt service output to canonical RawState shapes |
| `src/hooks/` | Existing React data-fetching hooks — kept as-is |
| `src/state/` | `types.js` (JSDoc typedefs), `deriveState.js` (pure fn), `useDerivedState.js` |
| `src/cards/` | New feature cards + `registry.js` + `ContextualSlot.jsx` |
| `src/ai/openclaw.js` | Enhancement helper — timeout + graceful fallback |

### Guardrails (see decisions log)

- **Card visibility is deterministic.** Components never compute `should I show?`; they read from `DerivedState`.
- **OpenClaw is enrichment, not dependency.** Cards must render correctly with the enhancer offline.
- **Reminder timing is deterministic.** Bedtime / 16:30 / 18:00 thresholds are arithmetic, not LLM calls.
- **Adding a new card = edit `src/cards/registry.js`.** That file is the only place that maps flags → components.

### Contextual slot

The mid-bottom Photos slot is a registry-driven `ContextualSlot`. It renders the
highest-tier visible card (Lunch Decision, Takeout Decision, Morning Checklist),
falling back to `<PhotoPanel>`. The right-column `FactPanel` slot similarly
flips to `<ClawSuggestionsCard>` when suggestions exist.

### Adding a feature

1. Document the flag(s) in `docs/home_center_derived_states.md`.
2. Add the card contract to `docs/home_center_ui_card_contracts.md`.
3. Extend `src/state/types.js` with the new fields.
4. Write a failing test in `src/state/deriveState.test.js` for the new flag (red).
5. Implement the rule in `src/state/deriveState.js` until green.
6. Add the card under `src/cards/` and register it in `src/cards/registry.js`. Add a registry test covering its visibility in `src/cards/registry.test.js`.
7. (Optional) Wire an OpenClaw enhancer via `useEnhancement("featureKey", state, workerSettings)` — the `fallback.integration.test.js` suite enforces that the card still works offline.

### Testing

- `npm test` runs the full Vitest suite (unit + integration). `npm run test:watch` for red/green flow while coding.
- Layers tested: normalization (`src/data/*.test.js`), state engine (`src/state/deriveState.test.js`), heuristics (`src/data/schoolHeuristics.test.js`), card registry (`src/cards/registry.test.js`), OpenClaw fallback (`src/ai/openclaw.test.js`), cross-layer integration (`src/__tests__/fallback.integration.test.js`).
- **The integration suite enforces the key invariant: no card depends on OpenClaw to appear.** If you add a card whose visibility reads a network / timer / LLM result, the integration tests will fail.

## OpenClaw (Family Telegram Assistant)

### Architecture

A Node.js service (`openclaw/index.js`) running on the **Mac Mini** (same LAN as the Pi) provides a Telegram bridge using `node-telegram-bot-api`. It exposes a local HTTP API for sending messages and forwards incoming messages to the worker's `/api/ask` LLM endpoint for bot replies.

**OpenClaw is the family-facing assistant.** Family members scan the Telegram deep-link QR on the TV dashboard (`https://t.me/<BotUsername>?start=hello`), text questions ("when's Emma's science fair?"), and get LLM-powered answers. It also delivers email triage notifications and school updates to a family group chat.

**Homer CI** (see below) is the separate dev-facing orchestrator that uses this same bridge as transport for build/PR notifications to Peter's personal chat.

Chat IDs are numeric Telegram IDs (positive for DMs, negative for groups, `-100…` for supergroups) — no `@c.us`/`@g.us` suffixes.

### API Endpoints (localhost:3100 on Mac Mini)

- `GET /status` — connection health and bot identity
- `POST /send` — send message: `{ chatId, message }`
- `GET /messages` — unacknowledged incoming messages (Homer CI polls this)
- `POST /messages/ack` — acknowledge processed messages: `{ ids: [...] }`

### Mac Mini Access

- **Service:** `launchctl {load|unload} ~/Library/LaunchAgents/com.openclaw.bridge.plist`
- **Logs:** `tail -f .openclaw/logs/openclaw-bridge-stdout.log`
- **Plist template:** `.openclaw/mac-mini/plists/com.openclaw.bridge.plist` (set `TELEGRAM_BOT_TOKEN`)
- **Auth:** `TELEGRAM_BOT_TOKEN` env var (from @BotFather) — no QR scan, no session directory, no Puppeteer

### Key Files

| File | Purpose |
|---|---|
| `openclaw/index.js` | Main service — Express API + node-telegram-bot-api client + message queue |
| `openclaw/package.json` | Dependencies (node-telegram-bot-api, express) |
| `openclaw/openclaw.service` | Legacy Pi systemd unit (kept for reference) |
| `openclaw/prompts/` | Versioned bot prompts (persona, operating instructions, family-assistant skill) |
| `deploy/mac-mini/com.openclaw.bridge.plist` | Mac Mini launchd template — rendered by `deploy/mac-mini/setup-openclaw-bridge.sh` |

### Integration with Other Services

- **Email triage** (`email-triage/email_triage/notifier.py`) — posts to `http://localhost:3100/send` (same machine)
- **Dashboard QR code** (`src/components/FactPanel.jsx`) — "Chat with OpenClaw" QR links to Telegram deep link
- **Incoming messages** — forwarded to worker `/api/ask` for LLM-powered replies

### Setup

See `deploy/mac-mini/README.md` for the end-to-end setup. The short version:

```bash
export TELEGRAM_BOT_TOKEN="<from @BotFather>"
export WORKER_URL="https://home-center-api.<you>.workers.dev"
bash deploy/mac-mini/setup-openclaw-bridge.sh
```

To wire Telegram notifications into email-triage, set `target_chat` in
`email-triage/config.yaml` under `notifications.telegram` and set
`enabled: true`.

## Developer automation (lives outside this repo)

A personal developer-agent orchestrator ("Homer CI") previously lived
under `.openclaw/`. It spawned coding agents, watched CI, and pinged a
personal Telegram chat when PRs were ready.

**It has been moved out of the product repo.** That system is not part of
Home Center — it just happened to reuse the OpenClaw Telegram bridge as
transport. Keeping it here blurred the product boundary, mixed personal
orchestration state (audit logs, active tasks) into reviews, and made it
easy to accidentally commit machine-specific config.

If you're maintaining that system, it belongs in a separate repo (or a
machine-local `~/.homer-ci/` directory). The OpenClaw bridge API
(`/send`, `/messages`, `/messages/ack`) remains stable and is the only
contract an external dev-agent system needs to integrate.
