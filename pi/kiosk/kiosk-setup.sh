#!/bin/bash
# Kiosk setup script for Home Center on Raspberry Pi 5
# Run this once to configure the kiosk environment.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KIOSK_URL="https://phdev.github.io/home-center/"

echo "=== Home Center Kiosk Setup ==="

# 1. Install autostart file
echo "Installing labwc autostart..."
mkdir -p ~/.config/labwc
cp "$SCRIPT_DIR/labwc-autostart" ~/.config/labwc/autostart
echo "  -> ~/.config/labwc/autostart"

# 2. Disable screen blanking
echo "Disabling screen blanking..."
sudo raspi-config nonint do_blanking 1 2>/dev/null || true

# 3. Hide cursor after idle (optional but nice for kiosk)
if ! command -v unclutter &>/dev/null; then
    echo "Installing unclutter (auto-hide cursor)..."
    sudo apt-get install -y unclutter
fi

# Append cursor hiding to autostart if not already there
if ! grep -q "unclutter" ~/.config/labwc/autostart; then
    echo "" >> ~/.config/labwc/autostart
    echo "# Auto-hide mouse cursor after 3 seconds idle" >> ~/.config/labwc/autostart
    echo "unclutter -idle 3 &" >> ~/.config/labwc/autostart
fi

# 4. Create Chromium crash recovery (prevents "restore pages" dialog)
mkdir -p ~/.config/chromium/Default
cat > ~/.config/chromium/Default/Preferences.bak 2>/dev/null << 'EOF' || true
{
  "profile": {
    "exit_type": "Normal"
  }
}
EOF

echo ""
echo "=== Setup Complete ==="
echo "Kiosk URL: $KIOSK_URL"
echo "Reboot to start kiosk mode: sudo reboot"
echo ""
echo "To exit kiosk mode later, SSH in and edit:"
echo "  ~/.config/labwc/autostart"
