#!/usr/bin/env python3
"""
Wake Word Detection Service for Home Center

Listens for "Hey Homer" via openWakeWord, then records a short audio clip
and transcribes it with faster-whisper to parse voice commands:

  - "set a timer for X minutes for Y" → creates a timer via worker API
  - "stop" / "dismiss" / "cancel" → dismisses all expired timers
  - "turn off" → TV standby via HDMI-CEC
  - "turn on" (or no command) → TV on via HDMI-CEC

Also runs a background alarm thread that polls for expired timers and
plays an alarm sound on the Pi speaker until dismissed.

Hardware: ReSpeaker 2-Mics Pi HAT (or any ALSA-compatible microphone)
"""

import argparse
import collections
import io
import json
import logging
import re
import subprocess
import sys
import tempfile
import threading
import time
import wave
from pathlib import Path

import alsaaudio
import numpy as np
from openwakeword.model import Model


def _inference_framework() -> str:
    """Return the best available inference framework for openWakeWord."""
    try:
        import tflite_runtime  # noqa: F401
        return "tflite"
    except ImportError:
        pass
    try:
        import onnxruntime  # noqa: F401
        return "onnx"
    except ImportError:
        pass
    return "tflite"


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
WAKE_WORD = "hey_homer"
SAMPLE_RATE = 16000
CHUNK_SIZE = 1280  # 80ms at 16kHz — required by openWakeWord
CHANNELS = 2  # ReSpeaker 2-Mic HAT is stereo; we downmix to mono

# Default tunable parameters (can be overridden via /api/wake-config)
_DEFAULT_CONFIG = {
    "detection_threshold": 0.4,
    "cooldown_seconds": 5,
    "min_rms_energy": 200,
    "min_consecutive": 3,
    "score_smooth_window": 3,
    "post_action_mute": 8.0,
    "high_confidence_bypass": 0.8,
    "record_seconds": 3.5,
    "verify_buffer_seconds": 2.5,
}

# Mutable runtime config — updated by ConfigPoller thread
_live_config = dict(_DEFAULT_CONFIG)
_config_lock = threading.Lock()


def cfg(key: str):
    """Read a live config value (thread-safe)."""
    with _config_lock:
        return _live_config.get(key, _DEFAULT_CONFIG.get(key))


# Legacy constants for code that doesn't use cfg() yet
DETECTION_THRESHOLD = _DEFAULT_CONFIG["detection_threshold"]
COOLDOWN_SECONDS = _DEFAULT_CONFIG["cooldown_seconds"]
MIN_RMS_ENERGY = _DEFAULT_CONFIG["min_rms_energy"]
MIN_CONSECUTIVE = _DEFAULT_CONFIG["min_consecutive"]
SCORE_SMOOTH_WINDOW = _DEFAULT_CONFIG["score_smooth_window"]
POST_ACTION_MUTE = _DEFAULT_CONFIG["post_action_mute"]
HIGH_CONFIDENCE_BYPASS = _DEFAULT_CONFIG["high_confidence_bypass"]
RECORD_SECONDS = _DEFAULT_CONFIG["record_seconds"]
VERIFY_BUFFER_SECONDS = _DEFAULT_CONFIG["verify_buffer_seconds"]

# Whisper verification: accept these patterns as confirming "hey homer"
# Whisper tiny often mis-transcribes "hey homer" as phonetic near-matches
VERIFY_PATTERNS = [
    r"homer",
    r"homework",
    r"home\b",
    r"hom+er",
    r"hummer",
    r"humor",
    r"hey\s*home",
    r"h[eo]m[eo]r",
    r"hey\s*h",
    r"omer",
]

# Alarm polling
ALARM_POLL_INTERVAL = 5  # Seconds between timer checks

SOUNDS_DIR = Path(__file__).parent / "sounds"
CHIME_PATH = SOUNDS_DIR / "acknowledge.wav"
ALARM_PATH = SOUNDS_DIR / "alarm.wav"

CEC_DEVICE = "0"
CEC_ON_CMD = "on {dev}"
CEC_ACTIVE_CMD = "as"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("wake-word")


# ---------------------------------------------------------------------------
# HDMI-CEC helpers
# ---------------------------------------------------------------------------

def cec_send(command: str) -> bool:
    try:
        proc = subprocess.run(
            ["cec-client", "-s", "-d", "1"],
            input=command + "\n",
            capture_output=True, text=True, timeout=10,
        )
        log.debug("CEC response: %s", proc.stdout.strip())
        return proc.returncode == 0
    except FileNotFoundError:
        log.error("cec-client not found. Install with: sudo apt install cec-utils")
        return False
    except subprocess.TimeoutExpired:
        log.warning("CEC command timed out")
        return False


def turn_on_tv() -> None:
    log.info("Turning TV ON via HDMI-CEC...")
    cec_send(CEC_ON_CMD.format(dev=CEC_DEVICE))
    time.sleep(1)
    cec_send(CEC_ACTIVE_CMD)
    log.info("TV should now be on and showing this Pi's HDMI output.")


def turn_off_tv() -> None:
    log.info("Turning TV OFF via HDMI-CEC...")
    cec_send(f"standby {CEC_DEVICE}")
    log.info("TV should now be off.")


# ---------------------------------------------------------------------------
# Audio helpers
# ---------------------------------------------------------------------------

def generate_chime(path: Path) -> None:
    """Generate a two-tone acknowledgement chime WAV file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    sr = 22050

    def tone(freq: float, duration: float) -> np.ndarray:
        t = np.linspace(0, duration, int(sr * duration), endpoint=False)
        attack = np.minimum(t / 0.01, 1.0)
        decay = np.maximum(1.0 - t / (duration * 1.2), 0.0)
        env = attack * decay
        signal = env * (np.sin(2 * np.pi * freq * t)
                        + 0.3 * np.sin(4 * np.pi * freq * t))
        return signal

    chime = np.concatenate([
        tone(523.25, 0.15),
        np.zeros(int(sr * 0.03)),
        tone(659.25, 0.22),
    ])
    chime = (chime / np.max(np.abs(chime)) * 32000).astype(np.int16)

    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(chime.tobytes())
    log.info("Generated acknowledgement chime: %s", path)


def generate_alarm(path: Path) -> None:
    """Generate an alarm WAV file (alternating tones, ~1.2s)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    sr = 22050
    duration_per_tone = 0.3
    tones = [880, 660, 880, 660]
    samples = []
    for freq in tones:
        t = np.linspace(0, duration_per_tone, int(sr * duration_per_tone), endpoint=False)
        env = np.minimum(t / 0.01, 1.0) * np.maximum(1.0 - t / (duration_per_tone * 1.1), 0.0)
        # Square-ish wave
        signal = env * np.sign(np.sin(2 * np.pi * freq * t)) * 0.5
        samples.append(signal)
    alarm = np.concatenate(samples)
    alarm = (alarm / np.max(np.abs(alarm)) * 28000).astype(np.int16)

    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(alarm.tobytes())
    log.info("Generated alarm sound: %s", path)


def find_speaker_device() -> str | None:
    try:
        result = subprocess.run(
            ["aplay", "-l"], capture_output=True, text=True, timeout=5,
        )
        for line in result.stdout.splitlines():
            lower = line.lower()
            if lower.startswith("card") and any(
                kw in lower for kw in ("respeaker", "seeed", "wm8960")
            ):
                card_num = lower.split(":")[0].replace("card", "").strip()
                return f"plughw:{card_num},0"
    except Exception:
        pass
    return None


def set_speaker_volume() -> None:
    device = find_speaker_device()
    if not device:
        return
    card = device.split(":")[0].replace("plughw", "").replace("hw", "")
    for control in ["Speaker", "Playback", "HP Playback",
                    "Line Playback", "PCM Playback"]:
        try:
            subprocess.run(
                ["amixer", "-c", card, "-q", "sset", control, "100%"],
                capture_output=True, timeout=5,
            )
        except Exception:
            pass


def play_sound(path: Path) -> subprocess.Popen | None:
    """Play a WAV file through the ReSpeaker HAT speaker (non-blocking)."""
    if not path.exists():
        return None
    set_speaker_volume()
    device = find_speaker_device()
    cmd = ["aplay", "-q"]
    if device:
        cmd.extend(["-D", device])
    cmd.append(str(path))
    try:
        return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        log.warning("Failed to play %s: %s", path, e)
        return None


def play_acknowledgement() -> None:
    if not CHIME_PATH.exists():
        generate_chime(CHIME_PATH)
    play_sound(CHIME_PATH)
    log.info("Playing acknowledgement chime")


# ---------------------------------------------------------------------------
# Microphone helpers (ALSA)
# ---------------------------------------------------------------------------

def find_respeaker_device() -> str | None:
    try:
        result = subprocess.run(
            ["arecord", "-l"], capture_output=True, text=True, timeout=5,
        )
        for line in result.stdout.splitlines():
            lower = line.lower()
            if lower.startswith("card") and any(
                kw in lower for kw in ("respeaker", "seeed", "wm8960", "2mic")
            ):
                card_num = lower.split(":")[0].replace("card", "").strip()
                device = f"hw:{card_num},0"
                log.info("Found ReSpeaker at %s", device)
                return device
    except Exception as e:
        log.warning("Error scanning for ReSpeaker: %s", e)
    return None


def open_alsa_capture(device: str, channels: int, rate: int, period_size: int) -> alsaaudio.PCM:
    return alsaaudio.PCM(
        type=alsaaudio.PCM_CAPTURE,
        mode=alsaaudio.PCM_NORMAL,
        device=device,
        channels=channels,
        rate=rate,
        format=alsaaudio.PCM_FORMAT_S16_LE,
        periodsize=period_size,
    )


def record_audio(pcm: alsaaudio.PCM, seconds: float) -> np.ndarray:
    """Record audio from an open ALSA PCM device, return mono int16 array."""
    chunks = []
    total_samples = int(SAMPLE_RATE * seconds)
    collected = 0
    while collected < total_samples:
        length, data = pcm.read()
        if length <= 0:
            continue
        audio = np.frombuffer(data, dtype=np.int16)
        if CHANNELS > 1:
            audio = audio.reshape(-1, CHANNELS).mean(axis=1).astype(np.int16)
        chunks.append(audio)
        collected += len(audio)
    return np.concatenate(chunks)[:total_samples]


# ---------------------------------------------------------------------------
# Speech-to-text (faster-whisper)
# ---------------------------------------------------------------------------

_whisper_model = None


def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        log.info("Loading faster-whisper tiny model (int8)...")
        _whisper_model = WhisperModel("tiny", compute_type="int8", device="cpu")
        log.info("Whisper model loaded.")
    return _whisper_model


def transcribe(audio: np.ndarray) -> str:
    """Transcribe int16 mono audio array to text."""
    model = get_whisper_model()
    # faster-whisper expects float32 normalized to [-1, 1]
    audio_f32 = audio.astype(np.float32) / 32768.0
    segments, _ = model.transcribe(
        audio_f32, beam_size=1, language="en",
        no_speech_threshold=0.95,  # Don't skip segments unless very confident it's silence
    )
    text = " ".join(seg.text.strip() for seg in segments).strip()
    return text


# ---------------------------------------------------------------------------
# Command parsing
# ---------------------------------------------------------------------------

def parse_command(text: str) -> dict:
    """Parse transcribed text into a command dict."""
    text = text.lower().strip()
    log.info("Transcribed: '%s'", text)

    if not text:
        return {"action": "turn_on"}

    # Stop / dismiss / cancel
    if re.search(r'\b(stop|dismiss|cancel|quiet|shut up|silence)\b', text):
        return {"action": "stop"}

    # Turn off
    if re.search(r'\bturn\s*(it\s+)?off\b', text):
        return {"action": "turn_off"}

    # Set a timer
    timer_match = re.search(
        r'(?:set\s+(?:a\s+)?timer|remind\s+me|timer)\s+'
        r'(?:for\s+)?(\d+)\s*'
        r'(second|sec|minute|min|hour|hr)s?\b'
        r'(?:\s+(?:for|to|called?|named?|labele?d?)\s+(.+))?',
        text
    )
    if timer_match:
        amount = int(timer_match.group(1))
        unit = timer_match.group(2).lower()
        label = (timer_match.group(3) or "timer").strip().rstrip(".")
        if unit.startswith("hour") or unit.startswith("hr"):
            seconds = amount * 3600
        elif unit.startswith("min"):
            seconds = amount * 60
        else:
            seconds = amount
        return {"action": "set_timer", "label": label, "duration": seconds}

    # Navigate to calendar
    if re.search(r'\b(open|show|go\s+to)\s+(the\s+)?calendar\b', text):
        return {"action": "navigate", "page": "calendar"}

    # Navigate to weather
    if re.search(r'\b(open|show|go\s+to)\s+(the\s+)?weather\b', text):
        return {"action": "navigate", "page": "weather"}

    # Navigate to photos
    if re.search(r'\b(open|show|go\s+to)\s+(the\s+)?(photos?|pictures?|gallery)\b', text):
        return {"action": "navigate", "page": "photos"}

    # Switch calendar view
    view_match = re.search(r'\b(monthly|weekly|daily)\s*(view)?\b', text)
    if view_match:
        return {"action": "navigate", "view": view_match.group(1)}

    # Go back / go home (return to dashboard)
    if re.search(r'\b(go\s+(back|home)|back\s+to\s+(dashboard|home)|close\s+(calendar|weather|photos?))\b', text):
        return {"action": "navigate", "page": "dashboard"}

    # Turn on (explicit)
    if re.search(r'\bturn\s*(it\s+)?on\b', text):
        return {"action": "turn_on"}

    # General knowledge query — question words or substantial speech
    if re.search(r'\b(what|who|where|when|why|how|tell\s+me|explain|describe)\b', text) or len(text.split()) > 4:
        return {"action": "ask", "query": text}

    # Default: treat as turn on (just said "hey homer" with no clear command)
    return {"action": "turn_on"}


# ---------------------------------------------------------------------------
# Worker API client
# ---------------------------------------------------------------------------

def worker_post(url: str, token: str | None, path: str, data: dict | None = None) -> dict | None:
    """POST to worker API. Returns parsed JSON or None on failure."""
    import requests
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        resp = requests.post(
            f"{url}{path}",
            headers=headers,
            json=data or {},
            timeout=10,
        )
        if resp.ok:
            return resp.json()
        log.warning("Worker POST %s failed: %d %s", path, resp.status_code, resp.text[:200])
    except Exception as e:
        log.warning("Worker POST %s error: %s", path, e)
    return None


def worker_get(url: str, token: str | None, path: str) -> dict | None:
    """GET from worker API. Returns parsed JSON or None on failure."""
    import requests
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        resp = requests.get(f"{url}{path}", headers=headers, timeout=10)
        if resp.ok:
            return resp.json()
    except Exception as e:
        log.debug("Worker GET %s error: %s", path, e)
    return None


# ---------------------------------------------------------------------------
# Debug event emission
# ---------------------------------------------------------------------------

_debug_worker_url = None
_debug_worker_token = None


def debug_init(worker_url: str | None, worker_token: str | None) -> None:
    global _debug_worker_url, _debug_worker_token
    _debug_worker_url = worker_url
    _debug_worker_token = worker_token


def debug_post(event_type: str, data: dict | None = None) -> None:
    """Fire-and-forget debug event to worker API."""
    if not _debug_worker_url:
        return
    event = {"type": event_type, "timestamp": int(time.time() * 1000)}
    if data:
        event["data"] = data

    def _send():
        try:
            import requests
            headers = {"Content-Type": "application/json"}
            if _debug_worker_token:
                headers["Authorization"] = f"Bearer {_debug_worker_token}"
            requests.post(
                f"{_debug_worker_url}/api/wake-debug",
                headers=headers, json=event, timeout=5,
            )
        except Exception:
            pass

    threading.Thread(target=_send, daemon=True).start()


# ---------------------------------------------------------------------------
# Config poller thread
# ---------------------------------------------------------------------------

CONFIG_POLL_INTERVAL = 10  # Poll for config changes every 10 seconds


class ConfigPoller(threading.Thread):
    """Background thread that polls /api/wake-config and updates _live_config."""

    def __init__(self, worker_url: str, worker_token: str | None):
        super().__init__(daemon=True)
        self.worker_url = worker_url
        self.worker_token = worker_token
        self._stop_event = threading.Event()

    def stop(self):
        self._stop_event.set()

    def run(self):
        import requests as req
        while not self._stop_event.is_set():
            try:
                headers = {"Content-Type": "application/json"}
                if self.worker_token:
                    headers["Authorization"] = f"Bearer {self.worker_token}"
                resp = req.get(
                    f"{self.worker_url}/api/wake-config",
                    headers=headers, timeout=5,
                )
                if resp.ok:
                    data = resp.json()
                    with _config_lock:
                        for key in _DEFAULT_CONFIG:
                            if key in data and isinstance(data[key], (int, float)):
                                _live_config[key] = data[key]
                    log.debug("Config updated: %s", _live_config)
            except Exception:
                pass
            self._stop_event.wait(CONFIG_POLL_INTERVAL)


# ---------------------------------------------------------------------------
# Alarm thread
# ---------------------------------------------------------------------------

class AlarmThread(threading.Thread):
    """Background thread that polls for expired timers and plays alarm."""

    def __init__(self, worker_url: str, worker_token: str | None, dry_run: bool = False):
        super().__init__(daemon=True)
        self.worker_url = worker_url
        self.worker_token = worker_token
        self.dry_run = dry_run
        self._stop_event = threading.Event()
        self._alarm_proc = None

    def stop(self):
        self._stop_event.set()
        self._kill_alarm()

    def _kill_alarm(self):
        if self._alarm_proc and self._alarm_proc.poll() is None:
            self._alarm_proc.terminate()
            self._alarm_proc = None

    def run(self):
        if not ALARM_PATH.exists():
            generate_alarm(ALARM_PATH)

        alarming = False
        while not self._stop_event.is_set():
            try:
                data = worker_get(self.worker_url, self.worker_token, "/api/timers")
                if data:
                    timers = data.get("timers", [])
                    now_ms = time.time() * 1000
                    expired_undismissed = [
                        t for t in timers
                        if t.get("expiresAt", 0) <= now_ms and not t.get("dismissed", False)
                    ]

                    if expired_undismissed and not alarming:
                        log.info("Expired timer(s) detected, starting alarm on Pi speaker")
                        alarming = True
                    elif not expired_undismissed and alarming:
                        log.info("All timers dismissed, stopping alarm")
                        alarming = False
                        self._kill_alarm()

                    # Play alarm sound in a loop while active
                    if alarming and (self._alarm_proc is None or self._alarm_proc.poll() is not None):
                        if not self.dry_run:
                            self._alarm_proc = play_sound(ALARM_PATH)
                        else:
                            log.info("[DRY RUN] Would play alarm sound")
            except Exception as e:
                log.debug("Alarm thread error: %s", e)

            self._stop_event.wait(ALARM_POLL_INTERVAL)


# ---------------------------------------------------------------------------
# Gesture thread (HandController → CEC TV on)
# ---------------------------------------------------------------------------

class GestureThread(threading.Thread):
    """Background thread that polls for hand gestures and triggers CEC TV on."""

    def __init__(self, worker_url: str, worker_token: str | None, dry_run: bool = False):
        super().__init__(daemon=True)
        self.worker_url = worker_url
        self.worker_token = worker_token
        self.dry_run = dry_run
        self._stop_event = threading.Event()
        self._last_gesture_id = None

    def stop(self):
        self._stop_event.set()

    def run(self):
        while not self._stop_event.is_set():
            try:
                data = worker_get(self.worker_url, self.worker_token, "/api/gesture")
                if data and data.get("gesture"):
                    g = data["gesture"]
                    gesture_id = g.get("id")
                    gesture_type = g.get("gesture")
                    timestamp = g.get("timestamp", 0)

                    # Only process new gestures within the last 10s
                    age_ms = time.time() * 1000 - timestamp
                    if gesture_id != self._last_gesture_id:
                        self._last_gesture_id = gesture_id
                        if gesture_type == "middleThumbPinch" and age_ms < 10000:
                            log.info("Gesture middleThumbPinch — turning TV on via CEC")
                            if not self.dry_run:
                                turn_on_tv()
                            else:
                                log.info("[DRY RUN] Would turn on TV via CEC (gesture)")
            except Exception as e:
                log.debug("Gesture thread error: %s", e)

            self._stop_event.wait(2)  # Poll every 2 seconds


# ---------------------------------------------------------------------------
# Wake word model setup
# ---------------------------------------------------------------------------

def get_or_train_model() -> Model:
    custom_model_dir = Path(__file__).parent / "models"
    custom_model_dir.mkdir(exist_ok=True)

    framework = _inference_framework()
    log.info("Using inference framework: %s", framework)

    # Only load hey_homer model (STT handles all disambiguation)
    wakeword_models = []
    for ext in (".onnx", ".tflite"):
        path = custom_model_dir / f"hey_homer{ext}"
        if path.exists():
            log.info("Found custom model: %s", path)
            wakeword_models.append(str(path))
            break

    if wakeword_models:
        fw = "onnx" if wakeword_models[0].endswith(".onnx") else "tflite"
        log.info("Loading custom wake word model")
        return Model(wakeword_models=wakeword_models, inference_framework=fw)

    log.warning("No custom 'hey_homer' model found in %s", custom_model_dir)
    log.info("Train one with: python pi/train_hey_homer.py")
    log.info("Falling back to built-in models as stand-in.")

    import openwakeword
    openwakeword.utils.download_models()
    return Model(inference_framework=framework)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Wake word listener for Home Center")
    parser.add_argument("--threshold", type=float, default=DETECTION_THRESHOLD,
                        help="Detection confidence threshold (0-1)")
    parser.add_argument("--cooldown", type=int, default=COOLDOWN_SECONDS,
                        help="Seconds to wait between triggers")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print detections without executing actions")
    parser.add_argument("--device", type=str, default=None,
                        help="ALSA device (e.g., hw:2,0). Auto-detected if not specified.")
    parser.add_argument("--worker-url", type=str, default=None,
                        help="Worker API base URL (e.g., https://your-worker.workers.dev)")
    parser.add_argument("--worker-token", type=str, default=None,
                        help="Worker API auth token")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    # Init debug emission
    debug_init(args.worker_url, args.worker_token)

    # Pre-generate sounds
    if not CHIME_PATH.exists():
        generate_chime(CHIME_PATH)
    if not ALARM_PATH.exists():
        generate_alarm(ALARM_PATH)

    # Pre-load whisper model so first command is fast
    if args.worker_url:
        try:
            get_whisper_model()
        except Exception as e:
            log.warning("Could not pre-load whisper model: %s", e)

    # Load wake word model
    model = get_or_train_model()
    wake_words = list(model.models.keys())
    log.info("Listening for wake words: %s (threshold=%.2f)", wake_words, args.threshold)

    # Find the ReSpeaker device
    device = args.device or find_respeaker_device()
    if device is None:
        log.error("No ReSpeaker found! Check your HAT connection or specify --device")
        sys.exit(1)

    # Open ALSA capture
    log.info("Opening ALSA capture on %s (%d ch, %d Hz)", device, CHANNELS, SAMPLE_RATE)
    try:
        pcm = open_alsa_capture(device, CHANNELS, SAMPLE_RATE, CHUNK_SIZE)
    except alsaaudio.ALSAAudioError as e:
        log.error("Failed to open ALSA device %s: %s", device, e)
        sys.exit(1)

    # Start alarm polling thread if worker configured
    alarm_thread = None
    gesture_thread = None
    config_poller = None
    if args.worker_url:
        alarm_thread = AlarmThread(args.worker_url, args.worker_token, args.dry_run)
        alarm_thread.start()
        log.info("Alarm polling thread started (every %ds)", ALARM_POLL_INTERVAL)
        gesture_thread = GestureThread(args.worker_url, args.worker_token, args.dry_run)
        gesture_thread.start()
        config_poller = ConfigPoller(args.worker_url, args.worker_token)
        config_poller.start()
        log.info("Config polling thread started (every %ds)", CONFIG_POLL_INTERVAL)
        log.info("Gesture polling thread started (every 2s)")

    log.info("Microphone stream open. Listening...")
    last_trigger = 0.0
    last_action_time = 0.0
    consecutive_hits = {ww: 0 for ww in wake_words}

    # Rolling buffer: stores last ~VERIFY_BUFFER_SECONDS of mono audio chunks
    # for Whisper verification before acting on a detection
    # Each chunk after mono downmix = CHUNK_SIZE samples (80ms at 16kHz)
    verify_buf_max = int(VERIFY_BUFFER_SECONDS * SAMPLE_RATE / CHUNK_SIZE)
    verify_buffer = collections.deque(maxlen=verify_buf_max)

    try:
        while True:
            length, data = pcm.read()
            if length <= 0:
                continue

            audio_array = np.frombuffer(data, dtype=np.int16)
            if CHANNELS > 1:
                audio_array = audio_array.reshape(-1, CHANNELS).mean(axis=1).astype(np.int16)

            # Append to rolling verification buffer
            verify_buffer.append(audio_array.copy())

            now = time.time()

            # Post-action mute (live config)
            if now - last_action_time < cfg("post_action_mute"):
                model.predict(audio_array)
                continue

            # RMS energy gate (live config)
            rms = np.sqrt(np.mean(audio_array.astype(np.float64) ** 2))
            if rms < cfg("min_rms_energy"):
                model.predict(audio_array)
                if args.debug:
                    log.debug("RMS %.0f below threshold %d, skipping", rms, cfg("min_rms_energy"))
                for ww in consecutive_hits:
                    consecutive_hits[ww] = 0
                continue

            model.predict(audio_array)

            for ww_name in wake_words:
                buf = model.prediction_buffer[ww_name]
                if len(buf) == 0:
                    continue

                n = min(int(cfg("score_smooth_window")), len(buf))
                scores = list(buf)[-n:]
                score = float(np.mean(scores))

                if args.debug and score > 0.1:
                    log.debug("%s score: %.3f (raw=%.3f, rms=%.0f, consec=%d)",
                              ww_name, score, float(list(buf)[-1]), rms,
                              consecutive_hits.get(ww_name, 0))
                if score > 0.3:
                    debug_post("dnn_score", {"score": round(score, 3), "rms": round(rms), "consecutive": consecutive_hits.get(ww_name, 0)})

                if score >= cfg("detection_threshold"):
                    consecutive_hits[ww_name] = consecutive_hits.get(ww_name, 0) + 1

                    if consecutive_hits[ww_name] < cfg("min_consecutive"):
                        continue

                    if now - last_trigger < cfg("cooldown_seconds"):
                        log.debug("Cooldown active, ignoring detection")
                        continue

                    # ── Wake word candidate detected! ──
                    log.info("Wake word candidate '%s' (score=%.3f, consec=%d)",
                             ww_name, score, consecutive_hits[ww_name])
                    debug_post("wake_candidate", {"score": round(score, 3), "consecutive": consecutive_hits[ww_name]})

                    # Reset model state early to stop accumulating
                    model.reset()
                    for ww in consecutive_hits:
                        consecutive_hits[ww] = 0

                    # ── Stage 2: Whisper verification (skipped for high-confidence DNN) ──
                    if score >= cfg("high_confidence_bypass"):
                        log.info("High-confidence DNN detection (%.3f >= %.2f) — skipping Whisper verification.",
                                 score, HIGH_CONFIDENCE_BYPASS)
                        debug_post("whisper_verify", {"transcript": "(skipped)", "passed": True, "method": "high_confidence"})
                    else:
                        log.info("Borderline detection (%.3f) — verifying with Whisper...", score)
                        buf_audio = np.concatenate(list(verify_buffer)) if verify_buffer else np.array([], dtype=np.int16)
                        if len(buf_audio) > 0:
                            verify_text = transcribe(buf_audio).lower()
                            log.info("Verification transcription: '%s'", verify_text)
                            if not any(re.search(pat, verify_text) for pat in VERIFY_PATTERNS):
                                log.info("Verification FAILED — no homer-like pattern in transcript '%s', ignoring.", verify_text)
                                debug_post("whisper_verify", {"transcript": verify_text, "passed": False})
                                last_trigger = now
                                last_action_time = time.time()
                                break
                        else:
                            log.info("Verification FAILED — empty audio buffer, ignoring.")
                            last_trigger = now
                            break
                        log.info("Verification PASSED.")
                        debug_post("whisper_verify", {"transcript": verify_text, "passed": True})

                    # ── Confirmed! Proceed. ──
                    last_trigger = now
                    log.info("Wake word confirmed!")

                    if not args.dry_run:
                        play_acknowledgement()

                    # Record and transcribe command if worker is configured
                    if args.worker_url:
                        log.info("Recording %.1fs for command...", RECORD_SECONDS)
                        audio_clip = record_audio(pcm, RECORD_SECONDS)
                        command = parse_command(transcribe(audio_clip))
                    else:
                        # No worker → default to turn_on (legacy behavior)
                        command = {"action": "turn_on"}

                    log.info("Command: %s", command)
                    debug_post("command", {"action": command.get("action"), "details": command})

                    # Dispatch
                    action = command["action"]
                    if action == "none":
                        log.info("No command recognized, defaulting to turn on TV.")
                        if not args.dry_run:
                            turn_on_tv()
                        last_action_time = time.time()
                        break

                    if action == "set_timer" and args.worker_url:
                        label = command.get("label", "timer")
                        duration = command.get("duration", 60)
                        if args.dry_run:
                            log.info("[DRY RUN] Would create timer: %s (%ds)", label, duration)
                        else:
                            result = worker_post(
                                args.worker_url, args.worker_token,
                                "/api/timers",
                                {"name": label, "totalSeconds": duration, "source": "voice"},
                            )
                            if result:
                                log.info("Timer created: %s for %ds", label, duration)
                            else:
                                log.error("Failed to create timer")

                    elif action == "stop":
                        if args.worker_url:
                            if args.dry_run:
                                log.info("[DRY RUN] Would dismiss all timers")
                            else:
                                worker_post(
                                    args.worker_url, args.worker_token,
                                    "/api/timers/dismiss-all",
                                )
                                log.info("Dismissed all timers")

                    elif action == "ask" and args.worker_url:
                        query_text = command.get("query", "")
                        if args.dry_run:
                            log.info("[DRY RUN] Would ask: %s", query_text)
                        else:
                            result = worker_post(
                                args.worker_url, args.worker_token,
                                "/api/ask-query",
                                {"query": query_text},
                            )
                            if result:
                                log.info("LLM query sent: %s", query_text)
                            else:
                                log.error("Failed to send LLM query")

                    elif action == "navigate" and args.worker_url:
                        nav_data = {}
                        if command.get("page"):
                            nav_data["page"] = command["page"]
                        if command.get("view"):
                            nav_data["view"] = command["view"]
                        if args.dry_run:
                            log.info("[DRY RUN] Would navigate: %s", nav_data)
                        else:
                            result = worker_post(
                                args.worker_url, args.worker_token,
                                "/api/navigate", nav_data,
                            )
                            if result:
                                log.info("Navigation sent: %s", nav_data)
                            else:
                                log.error("Failed to send navigation")

                    elif action == "turn_off":
                        if args.dry_run:
                            log.info("[DRY RUN] Would turn off TV via CEC")
                        else:
                            turn_off_tv()

                    else:  # turn_on
                        if args.dry_run:
                            log.info("[DRY RUN] Would turn on TV via CEC")
                        else:
                            turn_on_tv()

                    last_action_time = time.time()
                    break  # Only handle one wake word per cycle

                else:
                    consecutive_hits[ww_name] = 0

    except KeyboardInterrupt:
        log.info("Shutting down...")
    finally:
        pcm.close()
        if alarm_thread:
            alarm_thread.stop()
        if gesture_thread:
            gesture_thread.stop()


if __name__ == "__main__":
    main()
