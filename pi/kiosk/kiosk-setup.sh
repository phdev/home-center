#!/bin/bash
# Kiosk setup script for Home Center on Raspberry Pi 5
# Run this once to configure the kiosk environment.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KIOSK_URL="http://localhost:8080/home-center/"

echo "=== Home Center Kiosk Setup ==="

# labwc does not draw a wallpaper itself; swaybg gives the compositor a
# persistent solid black desktop behind Chromium.
if ! command -v swaybg &>/dev/null; then
    echo "Installing swaybg (solid black compositor background)..."
    sudo apt-get update
    sudo apt-get install -y swaybg
fi

# 1. Install autostart file
echo "Installing labwc autostart..."
mkdir -p ~/.config/labwc
cp "$SCRIPT_DIR/labwc-autostart" ~/.config/labwc/autostart
cp "$SCRIPT_DIR/labwc-rc.xml" ~/.config/labwc/rc.xml
echo "  -> ~/.config/labwc/autostart"
echo "  -> ~/.config/labwc/rc.xml"

# Raspberry Pi OS starts the normal desktop shell from the system labwc
# autostart. Kiosk mode should not have pcmanfm, the panel, desktop icons, or a
# wallpaper underneath Chromium.
if [ -f /etc/xdg/labwc/autostart ]; then
    echo "Disabling system desktop shell autostart..."
    sudo cp /etc/xdg/labwc/autostart "/etc/xdg/labwc/autostart.home-center-backup.$(date +%Y%m%d-%H%M%S)"
    sudo tee /etc/xdg/labwc/autostart >/dev/null <<'EOF'
# Home Center kiosk session.
# Do not start Raspberry Pi desktop shell, panel, icons, or wallpaper here.
# The user autostart (~/.config/labwc/autostart) owns display setup,
# solid no-wallpaper background, and Chromium kiosk launch.
/usr/bin/kanshi &
EOF
fi

# If pcmanfm ever starts manually, keep its desktop background empty.
mkdir -p ~/.config/pcmanfm/LXDE-pi ~/.config/pcmanfm/default
cat > ~/.config/pcmanfm/LXDE-pi/desktop-items-0.conf <<'EOF'
[*]
wallpaper_mode=none
wallpaper=
desktop_bg=#000000
show_documents=0
show_trash=0
show_mounts=0
EOF
cp ~/.config/pcmanfm/LXDE-pi/desktop-items-0.conf ~/.config/pcmanfm/default/desktop-items-0.conf

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
