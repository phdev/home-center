# Raspberry Pi 5 Kiosk Setup - Home Center

Run Home Center in full-screen kiosk mode on a Raspberry Pi 5, with the Pi
hosting the display, HDMI-CEC, local dashboard API, chime playback, and the
ReSpeaker XVF3800 microphone stream.

The current production wake/STT compute runs on the Mac mini in
`voice-service/`. The Pi no longer uses Whisper or openWakeWord for the
always-on wake path.

## Hardware

| Component | Purpose |
|-----------|---------|
| Raspberry Pi 5 | Chromium kiosk, dashboard API, timers, chime, HDMI-CEC |
| ReSpeaker XVF3800 USB 4-Mic Array | PipeWire microphone source for voice |
| HDMI cable | Connects Pi to TV and carries CEC commands |
| USB-C power supply | Powers the Pi 5 |

The XVF3800 is a USB Audio Class device. No vendor kernel driver is required.
On Raspberry Pi OS Bookworm, PipeWire owns the USB hardware. Use the `pulse`
ALSA PCM or `pw-record`; direct `hw:N,0` ALSA reads can return zero bytes.

## Setup From a Mac

### 1. Flash Raspberry Pi OS

1. Download and install Raspberry Pi Imager.
2. Use Raspberry Pi OS 64-bit for Raspberry Pi 5.
3. Configure hostname `homecenter.local`, SSH, Wi-Fi, locale, and user `pi`.
4. Write the card, boot the Pi, and connect over SSH:

```bash
ssh pi@homecenter.local
```

### 2. Clone and Run Setup

```bash
git clone https://github.com/phdev/home-center.git
cd home-center
chmod +x pi/setup.sh pi/kiosk.sh pi/cec_control.sh
./pi/setup.sh
```

The setup script installs system packages, builds the dashboard, creates the
Pi Python venv, and enables:

- `dashboard-local`: local HTTP server on `:8080`
- `mic-streamer`: XVF3800 16 kHz mono PCM stream on `:8766`
- `wake-word`: Pi command server on `:8765`
- `kiosk-watchdog`: Chromium DevTools health check on `:9222`
- `morning-dashboard.timer`: weekdays at 7:50 AM local time, turns the TV on
  if needed and selects the Pi as the active HDMI source.

Chromium kiosk launch is handled by the user Wayland/labwc session, not a
systemd service. See `CLAUDE.md` "Deploying to the Pi" for the deploy loop.
Chromium exposes remote debugging on `127.0.0.1:9222`; the watchdog uses that
local-only endpoint to detect missing or crashed Home Center tabs.

## How It Works

```text
XVF3800 -> PipeWire pulse -> mic-streamer :8766 -> Mac voice-service
                                                     |
                                                     v
                                     Vosk wake gate + local Whisper STT
                                                     |
                                                     v
Pi wake-word :8765 <- chime, TV, timers, navigate, /api/transcription
```

Important contracts:

- `GET/POST /api/transcription`: live caption state for the dashboard.
- `POST /api/chime`: acknowledgement chime.
- `POST /api/tv/on` and `/api/tv/off`: HDMI-CEC power control.
- `GET/POST /api/navigate`: dashboard navigation state.
- `GET/POST /api/timers`: local timers.
- `GET/POST /gesture` and `/api/gesture`: gesture state aliases.

Bare "Hey Homer" does not turn on the TV. The parser requires an explicit
verb such as "turn on", "open calendar", or "set a timer".

Design feedback commands are handled by the Mac voice service and written into
Design Claw memory: `Hey Homer, I like this design ...` records an accepted
pattern for the current daily concept, while `Hey Homer, I don't like this
design ...` records a rejected pattern. Notes after the phrase are preserved.

Navigation commands are Mac voice-service -> Pi `/api/navigate` -> kiosk poll.
If a command like `Hey Homer, open calendar` does nothing, do not assume the
kiosk is polling the wrong endpoint until logs prove dispatch reached the Pi.
First check the Mac reliability log; Vosk has misheard the wake phrase while
still hearing the command word, for example `hey i'm robyn calendar` on
2026-05-05.

## Service Management

```bash
sudo systemctl status dashboard-local
sudo systemctl status kiosk-watchdog
sudo systemctl status mic-streamer
sudo systemctl status wake-word
sudo systemctl status morning-dashboard.timer

sudo systemctl restart kiosk-watchdog
sudo systemctl restart mic-streamer
sudo systemctl restart wake-word
sudo systemctl start morning-dashboard.service

journalctl -u kiosk-watchdog -f
journalctl -u mic-streamer -f
journalctl -u wake-word -f
```

The mic streamer systemd unit must run in the `pi` user's PipeWire context:

```ini
Environment=XDG_RUNTIME_DIR=/run/user/1000
Environment=PULSE_RUNTIME_PATH=/run/user/1000/pulse
```

`mic-streamer` accepts one client at a time. It sets a bounded TCP send timeout
so a dead Mac voice-service client cannot leave the streamer wedged on an old
socket and prevent the next dry-run from receiving PCM bytes. Keep the timeout
long enough for normal Mac-side STT/chime/dispatch pauses; too short a timeout
causes the stream to disconnect between valid commands.

## Audio Sanity Checks

```bash
wpctl status | head -30
arecord -l
lsusb | grep Seeed
systemctl is-active mic-streamer wake-word
```

From the Mac mini, confirm the TCP stream delivers about 96 KB in 3 seconds:

```bash
python3 - <<'PY'
import socket, time
s = socket.socket()
s.settimeout(5)
s.connect(("homecenter.local", 8766))
t = time.time()
n = 0
while time.time() - t < 3:
    n += len(s.recv(4096))
print(f"{n} bytes in 3 s")
PY
```

## Testing CEC Without Voice

```bash
./pi/cec_control.sh scan
./pi/cec_control.sh on
./pi/cec_control.sh off
./pi/cec_control.sh status
```

## Troubleshooting

### No microphone audio

- Confirm the XVF3800 is the default PipeWire source in `wpctl status`.
- If needed, set the default source with `wpctl set-default <id>`.
- Check `journalctl -u mic-streamer -f`.
- Do not switch `mic-streamer` to direct `hw:N,0` on Bookworm unless PipeWire is
  also reconfigured.

### Voice commands do not trigger

- Check Mac logs: `tail -f ~/home-center/voice-service/logs/voice-stderr.log`.
- Check structured events:
  `tail -f ~/home-center/voice-service/logs/voice-reliability.jsonl`.
- If `detector_text` contains a command word like `calendar` but no wake hit,
  debug Vosk wake recognition or a narrow alias in `voice-service/intent.py`
  before changing kiosk/Worker routing.
- Confirm `mic-streamer` has a connected client.
- If the Mac logs `Mic stream connected` but no audio-heartbeat or wake probe
  lines appear, restart `mic-streamer` and check for stale `CLOSE-WAIT`
  sockets with `ss -tnp | grep 8766`.
- Confirm the Vosk model exists under
  `~/home-center/voice-service/models/vosk-model-small-en-us-0.15`.
- Reload the Mac service with
  `bash ~/home-center/deploy/mac-mini/setup-voice-service.sh`.

### Chromium shows a white screen

- Check the dashboard server: `curl -s http://localhost:8080/home-center/ | head`.
- Check Chromium DevTools: `curl -s http://127.0.0.1:9222/json/list`.
- Check the watchdog: `systemctl status kiosk-watchdog` and
  `journalctl -u kiosk-watchdog --since "10 minutes ago"`.
- Check deploy target contents: `ls /home/pi/home-center/dashboard-local/home-center/`.
- Rebuild and redeploy from the repo, then restart LightDM:

```bash
rsync -av --delete dist/ pi@homecenter.local:/home/pi/home-center/dashboard-local/home-center/
ssh pi@homecenter.local 'sudo systemctl restart lightdm'
```
