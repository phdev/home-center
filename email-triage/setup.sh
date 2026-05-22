#!/usr/bin/env bash
# Email Triage Setup Script
# Downloads Phi-3-mini model and installs dependencies

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODEL_DIR="$SCRIPT_DIR/models"
MODEL_FILE="phi-3-mini-4k-instruct-q4_k_m.gguf"
MODEL_URL="https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4_k_m.gguf"

echo "=== Email Triage Setup ==="

# 1. Install Python dependencies
echo ""
echo "[1/4] Installing Python dependencies..."
pip3 install -r "$SCRIPT_DIR/requirements.txt"

# 2. Download model if not present
echo ""
echo "[2/4] Checking Phi-3-mini model..."
mkdir -p "$MODEL_DIR"

if [ -f "$MODEL_DIR/$MODEL_FILE" ]; then
    echo "  Model already downloaded: $MODEL_DIR/$MODEL_FILE"
else
    echo "  Downloading $MODEL_FILE (~2.3 GB)..."
    echo "  This may take a while on slower connections."
    if command -v wget &>/dev/null; then
        wget -O "$MODEL_DIR/$MODEL_FILE" "$MODEL_URL" --show-progress
    elif command -v curl &>/dev/null; then
        curl -L -o "$MODEL_DIR/$MODEL_FILE" "$MODEL_URL" --progress-bar
    else
        echo "  ERROR: Neither wget nor curl found. Please install one and re-run."
        exit 1
    fi
    echo "  Model downloaded successfully."
fi

# 3. Copy example config if needed
echo ""
echo "[3/4] Checking configuration..."
if [ ! -f "$SCRIPT_DIR/config.yaml" ]; then
    cp "$SCRIPT_DIR/config.example.yaml" "$SCRIPT_DIR/config.yaml"
    echo "  Created config.yaml from example. Edit it with your settings."
else
    echo "  config.yaml already exists."
fi

# 4. Gmail OAuth setup check
echo ""
echo "[4/4] Checking Gmail credentials..."
if [ ! -f "$SCRIPT_DIR/credentials.json" ]; then
    echo "  WARNING: credentials.json not found!"
    echo ""
    echo "  To set up Gmail access:"
    echo "  1. Go to https://console.cloud.google.com"
    echo "  2. Create a project (or select existing)"
    echo "  3. Enable the Gmail API"
    echo "  4. Go to Credentials > Create Credentials > OAuth client ID"
    echo "  5. Choose 'Desktop app' as the application type"
    echo "  6. Download the JSON and save as: $SCRIPT_DIR/credentials.json"
    echo ""
    echo "  Then run: python3 -m email_triage.main --once"
    echo "  to complete the OAuth flow (opens browser for login)."
else
    echo "  credentials.json found."
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "To start the local LLM server:"
echo "  python3 -m llama_cpp.server --model $MODEL_DIR/$MODEL_FILE --port 8411 --n_ctx 4096"
echo ""
echo "To start the email triage service:"
echo "  cd $SCRIPT_DIR && python3 -m email_triage.main"
echo ""
echo "To install as systemd services (auto-start on boot):"
echo "  sudo cp systemd/*.service /etc/systemd/system/"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable --now llama-server email-triage"
