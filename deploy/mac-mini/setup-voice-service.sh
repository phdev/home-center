#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-$HOME/home-center}"
WORKER_TOKEN="${WORKER_TOKEN:-}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
PLIST="$HOME/Library/LaunchAgents/com.homecenter.voice.plist"

cd "$REPO/voice-service"
"$PYTHON_BIN" -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python - <<'PY'
from openwakeword.utils import download_models

# openWakeWord does not vendor its shared melspectrogram/embedding ONNX files.
# Passing an unmatched model name downloads only those shared resources and VAD.
download_models(["__home_center_feature_models_only__"])
PY
mkdir -p logs
mkdir -p models
if [ ! -d models/vosk-model-small-en-us-0.15 ]; then
  curl -L -o models/vosk-small.zip https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
  unzip -q models/vosk-small.zip -d models
  rm models/vosk-small.zip
fi

sed \
  -e "s#__REPO__#$REPO#g" \
  -e "s#__WORKER_TOKEN__#$WORKER_TOKEN#g" \
  "$REPO/deploy/mac-mini/com.homecenter.voice.plist" > "$PLIST"
chmod 600 "$PLIST"

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
launchctl list | grep com.homecenter.voice || true
