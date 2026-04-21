# Raspberry Pi 5 Kiosk Setup — Home Center

Run Home Center in full-screen kiosk mode on a Raspberry Pi 5, with "Hey Homer"
wake word detection that turns on your TV via HDMI-CEC. Wake-word detection and
speech-to-text **run on the Mac mini** — the Pi hosts the mic, streams audio
over TCP, and exposes a command HTTP server.

## Hardware

| Component | Purpose |
|-----------|---------|
| Raspberry Pi 5 (4GB+) | Dashboard kiosk, HDMI-CEC, mic streamer, command server |
| ReSpeaker XVF3800 USB 4-Mic Array | Mic with onboard AEC / beamforming / dereverb |
| microSD card (32GB+) | OS and application storage |
| HDMI cable | Connects Pi to TV (carries CEC signals) |
| USB-C power supply (27W) | Powers the Pi 5 |

> **Upgraded 2026-04-21 from the ReSpeaker 2-Mics Pi HAT to the XVF3800.** The
> HAT's WM8960 codec had no onboard DSP, so the wake word had to fight room
> echo and TV bleed in software. The XVF3800 handles that in hardware, which
> made wake-word detection dramatically more reliable.

> **Fallback**: any ALSA-compatible USB mic works; `pi/mic_streamer.py`
> auto-detects an XVF3800 first, then falls back to any legacy 2-Mic HAT.

## Architecture (2026-04-21)

```
Pi (homecenter.local)                Mac mini (peters-mac-mini.lan)
──────────────────────────           ─────────────────────────────────
XVF3800 USB mic                      voice-service/voice_service.py
  │                                    · openWakeWord (hey_homer)
  ▼                                    · faster-whisper medium.en
mic_streamer.py  ─────TCP :8766────▶   · parse_command → dispatch
wake_word_service.py                 ◀─HTTP :8765──
  --no-wake-detection                    /api/chime
  · /api/chime (play chime)              /api/tv/on, /api/tv/off
  · /api/tv/on, /api/tv/off              /api/navigate, /api/timers
  · /api/navigate, /api/timers
  · /api/gesture (HandController)      (also POSTs to worker /api/ask-query
  · dashboard polling state             for LLM queries)
  · AlarmThread (timer chimes)
```

## Setup from a Mac

### 1. Flash Raspberry Pi OS

1. Download and install [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
   on your Mac
2. Insert the microSD card into your Mac (use an adapter if needed)
3. Open Raspberry Pi Imager and configure:
   - **Device**: Raspberry Pi 5
   - **OS**: Raspberry Pi OS (64-bit) — under "Raspberry Pi OS (other)"
   - **Storage**: Your microSD card
4. Click the **gear icon** (or Edit Settings) before writing and set:
   - **Hostname**: `homecenter.local`
   - **Enable SSH**: Yes (use password authentication)
   - **Username**: `pi`
   - **Password**: choose something memorable
   - **Wi-Fi**: enter your network name and password
   - **Locale**: set your timezone
5. Click **Write** and wait for it to finish

### 2. Boot and Connect

1. Insert the microSD into the Pi
2. Plug the XVF3800 into any USB port on the Pi (USB Audio Class — no driver)
3. Connect the Pi to your TV via HDMI
4. Plug in the USB-C power supply
5. Wait ~60 seconds for first boot, then from your Mac terminal:

```bash
ssh pi@homecenter.local
```

### 3. Clone and Run Setup

```bash
# Clone the repo
git clone https://github.com/phdev/home-center.git
cd home-center

# Make scripts executable
chmod +x pi/setup.sh pi/kiosk.sh pi/cec_control.sh

# Run the setup script (installs everything)
./pi/setup.sh
```

The setup script will:
- Install system packages (Chromium, Node.js, CEC utils, audio libs)
- Create a Python virtual environment with openWakeWord + alsaaudio
- Build the Home Center web app
- Install and enable systemd services (`home-center-kiosk`, `wake-word`, `mic-streamer`)
- Configure autologin and disable screen blanking

### 4. Install the Mac mini voice service

```bash
# On the Mac mini
cd ~/home-center
export WORKER_URL="https://home-center-api.<you>.workers.dev"
export MIC_HOST="homecenter.local"
export WHISPER_MODEL="medium.en"
bash deploy/mac-mini/setup-voice-service.sh
```

See `voice-service/README.md` for details.

### 5. Reboot

```bash
sudo reboot
```

After reboot, the Pi will:
1. Auto-login to the desktop
2. Launch Chromium in kiosk mode showing Home Center
3. Start the mic streamer (`mic-streamer.service`) and command server
   (`wake-word.service`, now in `--no-wake-detection` mode)
4. The Mac mini's voice-service connects to the mic stream and starts listening

## Training the Custom Wake Word

Custom "Hey Homer" openWakeWord models live in `pi/models/` and are loaded by
the **Mac mini** voice-service. To retrain with voice samples captured via the
XVF3800:

```bash
# On the Pi (records through XVF3800 directly)
ssh pi@homecenter.local
cd home-center
source pi/.venv/bin/activate
python pi/train_hey_homer.py --record 50
```

Then copy `pi/models/hey_homer.onnx` to the Mac mini (or commit it and pull)
and restart the voice service:

```bash
# On the Mac mini
launchctl kickstart -k gui/$(id -u)/com.homecenter.voice
```

## Testing CEC Without the Wake Word

```bash
./pi/cec_control.sh scan       # Check if CEC can see your TV
./pi/cec_control.sh on         # Turn TV on
./pi/cec_control.sh off        # Turn TV off
./pi/cec_control.sh status     # Check power status
```

## Troubleshooting

### TV doesn't turn on
- Ensure CEC is enabled on your TV. The feature has different names by brand:
  - Samsung: **Anynet+**
  - Sony: **Bravia Sync**
  - LG: **SimpLink**
  - Philips: **EasyLink**
  - Panasonic: **VIERA Link**
- Try a different HDMI port (some TVs only support CEC on port 1)
- Run `./pi/cec_control.sh scan` to verify the Pi sees the TV

### Mic not detected
- `arecord -l` on the Pi should show `card N: Array [reSpeaker XVF3800 4-Mic Array]`
- Unplug + replug the USB cable
- `lsusb | grep Seeed` should show `ID 2886:001a Seeed Technology Co., Ltd.`

### Wake word not triggering
- Check that the audio stream is flowing: from the Mac mini, run
  `nc homecenter.local 8766 | head -c 100` — it should produce binary data
- Check Pi streamer logs: `journalctl -u mic-streamer -f`
- Check Mac mini voice-service logs:
  `tail -f ~/home-center/voice-service/logs/voice-stderr.log`
- Try in debug + dry-run on the Mac mini:
  `voice-service/.venv/bin/python voice-service/voice_service.py --debug --dry-run`

### Chromium shows a white screen
- Check if the build exists: `ls dist/`
- Rebuild: `npm run build`
- Check kiosk logs: `journalctl -u home-center-kiosk -f`

### Service management

On the Pi:
```bash
sudo systemctl status mic-streamer wake-word home-center-kiosk
sudo systemctl restart mic-streamer wake-word
journalctl -u mic-streamer -f
journalctl -u wake-word -f
```

On the Mac mini:
```bash
launchctl list | grep homecenter.voice
launchctl kickstart -k gui/$(id -u)/com.homecenter.voice
tail -f ~/home-center/voice-service/logs/voice-stderr.log
```
