# Raspberry Pi 5 Kiosk Setup — Home Center

Run Home Center in full-screen kiosk mode on a Raspberry Pi 5, with "Hey Homer"
wake word detection that turns on your TV via HDMI-CEC.

## Hardware

| Component | Purpose |
|-----------|---------|
| Raspberry Pi 5 (4GB+) | Runs the dashboard and wake word detection |
| ReSpeaker 2-Mics Pi HAT | Always-on microphone for wake word listening |
| microSD card (32GB+) | OS and application storage |
| HDMI cable | Connects Pi to TV (carries CEC signals) |
| USB-C power supply (27W) | Powers the Pi 5 |

> **Fallback**: If the ReSpeaker HAT driver doesn't install on Pi 5 (kernel
> compatibility issue), any USB microphone will work as a drop-in replacement.

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
2. Attach the ReSpeaker 2-Mics Pi HAT to the GPIO header
3. Connect the Pi to your TV via HDMI
4. Plug in the USB-C power supply
5. Wait ~60 seconds for first boot, then from your Mac terminal:

```bash
ssh pi@homecenter.local
```

### 3. Clone and Run Setup

```bash
# Clone the repo
git clone https://github.com/phuang1024/home-center.git
cd home-center

# Make scripts executable
chmod +x pi/setup.sh pi/kiosk.sh pi/cec_control.sh

# Run the setup script (installs everything)
./pi/setup.sh
```

The setup script will:
- Install system packages (Chromium, Node.js, CEC utils, audio libs)
- Install the ReSpeaker HAT driver (falls back gracefully on Pi 5)
- Create a Python virtual environment with openWakeWord
- Build the Home Center web app
- Install and enable systemd services
- Configure autologin and disable screen blanking

### 4. Reboot

```bash
sudo reboot
```

After reboot, the Pi will:
1. Auto-login to the desktop
2. Launch Chromium in kiosk mode showing Home Center
3. Start listening for "Hey Homer" via the microphone

## How It Works

```
Microphone → openWakeWord → "Hey Homer" detected → cec-client → TV turns on
                                                         ↓
                                              Pi becomes active HDMI source
                                                         ↓
                                              Chromium kiosk shows dashboard
```

- **Wake word detection** runs as a systemd service (`wake-word.service`)
  using openWakeWord, a lightweight neural network that processes audio in
  real-time on the Pi's CPU
- **HDMI-CEC** is a protocol built into HDMI that lets connected devices
  control each other — the Pi sends "power on" and "set active source"
  commands to the TV
- **Kiosk mode** runs Chromium without any browser UI (no address bar, tabs,
  or window controls)

## Training the Custom Wake Word

On first run, the wake word service will attempt to auto-train a "hey homer"
model using openWakeWord's text-to-speech synthesis. If this fails, it falls
back to a built-in wake word.

To manually train a higher-quality model:

```bash
ssh pi@homecenter.local
cd home-center
source pi/.venv/bin/activate
python pi/train_wake_word.py
sudo systemctl restart wake-word
```

This generates 3000 synthetic audio samples and trains a TFLite model that
runs efficiently on the Pi.

## Testing CEC Without the Wake Word

```bash
# Check if CEC can see your TV
./pi/cec_control.sh scan

# Turn TV on
./pi/cec_control.sh on

# Turn TV off
./pi/cec_control.sh off

# Check power status
./pi/cec_control.sh status
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

### No microphone detected
- Check the ReSpeaker HAT is seated properly on the GPIO pins
- Try a USB microphone as a fallback
- Run `arecord -l` to list detected audio capture devices

### Wake word not triggering
- Check service logs: `journalctl -u wake-word -f`
- Lower the threshold: edit `DETECTION_THRESHOLD` in `wake_word_service.py`
- Train a better model: `python pi/train_wake_word.py`
- Test in debug mode: `pi/.venv/bin/python pi/wake_word_service.py --debug --dry-run`

### Chromium shows a white screen
- Check if the build exists: `ls dist/`
- Rebuild: `npm run build`
- Check kiosk logs: `journalctl -u home-center-kiosk -f`

### Service management
```bash
# Check status
sudo systemctl status wake-word
sudo systemctl status home-center-kiosk

# Restart services
sudo systemctl restart wake-word
sudo systemctl restart home-center-kiosk

# View logs
journalctl -u wake-word -f
journalctl -u home-center-kiosk -f

# Disable auto-start
sudo systemctl disable wake-word
sudo systemctl disable home-center-kiosk
```
