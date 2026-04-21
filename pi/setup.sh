#!/usr/bin/env bash
# ==============================================================================
# Home Center - Raspberry Pi 5 Setup Script
#
# Prerequisites:
#   - Raspberry Pi OS (64-bit, Bookworm) flashed and booted
#   - SSH access or direct terminal
#   - Internet connection
#   - ReSpeaker 2-Mics Pi HAT attached (or USB mic as fallback)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
USER_HOME="$HOME"
LOG_FILE="/tmp/home-center-setup.log"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
err() { log "ERROR: $*" >&2; }

# ---------- System update ----------
log "Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# ---------- Core dependencies ----------
log "Installing core dependencies..."
sudo apt-get install -y \
  git \
  curl \
  chromium-browser \
  xdotool \
  unclutter \
  cec-utils \
  alsa-utils \
  python3-venv \
  python3-pip \
  python3-dev \
  python3-pyaudio \
  portaudio19-dev \
  libasound2-dev \
  nodejs \
  npm

# Ensure we have a recent enough Node.js (>=18)
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ "${NODE_VERSION:-0}" -lt 18 ]; then
  log "Installing Node.js 20 LTS via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# ---------- Microphone ----------
# Home Center now uses the ReSpeaker XVF3800 USB 4-Mic Array. It enumerates
# as a standard USB Audio Class device — no driver install needed. Just plug
# it in and confirm it shows up in `arecord -l` as card "Array".
#
# (The legacy ReSpeaker 2-Mics Pi HAT driver install has been removed. If you
# need that hardware path, see the seeed-voicecard repo and install manually.)
log "Skipping mic driver install — XVF3800 uses USB Audio Class (no driver needed)."

# ---------- Python virtual environment for wake word ----------
log "Setting up Python virtual environment..."
VENV_DIR="$REPO_DIR/pi/.venv"
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

pip install --upgrade pip
pip install -r "$SCRIPT_DIR/requirements.txt"

deactivate

# ---------- Build the web app ----------
log "Building Home Center web app..."
cd "$REPO_DIR"
npm install
npm run build

# ---------- Install systemd services ----------
log "Installing systemd services..."

# Kiosk service
sudo cp "$SCRIPT_DIR/services/home-center-kiosk.service" /etc/systemd/system/
sudo sed -i "s|__REPO_DIR__|$REPO_DIR|g" /etc/systemd/system/home-center-kiosk.service
sudo sed -i "s|__USER__|$USER|g" /etc/systemd/system/home-center-kiosk.service

# Command server (formerly full wake-word service — now --no-wake-detection only,
# because wake detection runs on the Mac mini voice-service).
sudo cp "$SCRIPT_DIR/services/wake-word.service" /etc/systemd/system/
sudo sed -i "s|__REPO_DIR__|$REPO_DIR|g" /etc/systemd/system/wake-word.service
sudo sed -i "s|__USER__|$USER|g" /etc/systemd/system/wake-word.service

# Mic streamer — streams XVF3800 audio to the Mac mini voice-service over TCP.
sudo cp "$SCRIPT_DIR/services/mic-streamer.service" /etc/systemd/system/
sudo sed -i "s|__REPO_DIR__|$REPO_DIR|g" /etc/systemd/system/mic-streamer.service
sudo sed -i "s|__USER__|$USER|g" /etc/systemd/system/mic-streamer.service

sudo systemctl daemon-reload
sudo systemctl enable home-center-kiosk.service
sudo systemctl enable wake-word.service
sudo systemctl enable mic-streamer.service

# ---------- Configure autologin to desktop ----------
log "Configuring autologin..."
# Raspberry Pi OS Bookworm uses lightdm or labwc/wayfire
# Ensure autologin is set via raspi-config non-interactive
sudo raspi-config nonint do_boot_behaviour B4 2>/dev/null || {
  log "Could not set autologin via raspi-config. Set it manually:"
  log "  sudo raspi-config -> System Options -> Boot / Auto Login -> Desktop Autologin"
}

# ---------- Disable screen blanking ----------
log "Disabling screen blanking and power management..."
# For X11
mkdir -p "$USER_HOME/.config/autostart"
cat > "$USER_HOME/.config/autostart/disable-screensaver.desktop" <<'DESKTOP'
[Desktop Entry]
Type=Application
Name=Disable Screensaver
Exec=sh -c "xset s off; xset -dpms; xset s noblank"
Hidden=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
DESKTOP

# For wayland/labwc (Pi OS Bookworm default)
if [ -f /etc/labwc/rc.xml ] || [ -d "$USER_HOME/.config/labwc" ]; then
  mkdir -p "$USER_HOME/.config/labwc"
  # Disable idle timeout
  if [ -f "$USER_HOME/.config/labwc/rc.xml" ]; then
    sed -i 's/<screenSaverTime>.*</<screenSaverTime>0</' "$USER_HOME/.config/labwc/rc.xml" 2>/dev/null || true
  fi
fi

# ---------- HDMI-CEC setup verification ----------
log "Verifying HDMI-CEC..."
echo "scan" | cec-client -s -d 1 2>/dev/null && log "HDMI-CEC detected successfully." || {
  log "HDMI-CEC not detected. Ensure:"
  log "  1. The Pi is connected to the TV via HDMI"
  log "  2. CEC is enabled on your TV (may be called Anynet+, Bravia Sync, SimpLink, etc.)"
}

# ---------- Done ----------
log ""
log "============================================"
log " Setup complete!"
log "============================================"
log ""
log " Services installed:"
log "   - home-center-kiosk : Chromium kiosk showing the dashboard"
log "   - wake-word         : Listens for 'Hey Homer' and turns on TV"
log ""
log " To start now (without reboot):"
log "   sudo systemctl start home-center-kiosk"
log "   sudo systemctl start wake-word"
log ""
log " To check status:"
log "   sudo systemctl status wake-word"
log "   journalctl -u wake-word -f"
log ""
log " Reboot to start everything automatically:"
log "   sudo reboot"
log ""
