#!/usr/bin/env python3
"""
Wake Word Detection Service for Home Center

Listens for "Hey Comni" via openWakeWord, then records a short audio clip
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
WAKE_WORD = "hey_jarvis"
SAMPLE_RATE = 16000
CHUNK_SIZE = 1280  # 80ms at 16kHz — required by openWakeWord
CHANNELS = 2  # ReSpeaker 2-Mic HAT is stereo; we downmix to mono

# Default tunable parameters (can be overridden via /api/wake-config)
_DEFAULT_CONFIG = {
    "detection_threshold": 0.25,
    "cooldown_seconds": 5,
    "min_rms_energy": 200,
    "min_consecutive": 3,
    "score_smooth_window": 3,
    "post_action_mute": 3.0,
    "high_confidence_bypass": 0.8,
    "record_seconds": 3.5,
}

# Mutable runtime config — updated by ConfigPoller thread
_live_config = dict(_DEFAULT_CONFIG)
_config_lock = threading.Lock()


def cfg(key: str):
    """Read a live config value — from local server if available."""
    if _local_server:
        return _local_server.get_config(key)
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
    """Generate a bright three-tone rising arpeggio chime (ding-ding-DING)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    sr = 44100  # Higher sample rate for clarity on TV speakers

    def tone(freq: float, duration: float, amp: float = 1.0) -> np.ndarray:
        t = np.linspace(0, duration, int(sr * duration), endpoint=False)
        attack = np.minimum(t / 0.008, 1.0)
        decay = np.exp(-t / (duration * 0.8))
        env = attack * decay * amp
        # Rich harmonics for TV speaker presence
        signal = env * (np.sin(2 * np.pi * freq * t)
                        + 0.4 * np.sin(4 * np.pi * freq * t)
                        + 0.15 * np.sin(6 * np.pi * freq * t))
        return signal

    chime = np.concatenate([
        tone(659.25, 0.12, 0.7),    # E5 — soft lead-in
        np.zeros(int(sr * 0.04)),
        tone(783.99, 0.12, 0.85),   # G5 — middle
        np.zeros(int(sr * 0.04)),
        tone(1046.50, 0.25, 1.0),   # C6 — bright resolve
    ])
    chime = (chime / np.max(np.abs(chime)) * 32700).astype(np.int16)

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
    """Find audio output device. Prefers HDMI (TV), falls back to ReSpeaker HAT."""
    try:
        result = subprocess.run(
            ["aplay", "-l"], capture_output=True, text=True, timeout=5,
        )
        hdmi_card = None
        respeaker_card = None
        for line in result.stdout.splitlines():
            lower = line.lower()
            if not lower.startswith("card"):
                continue
            card_num = lower.split(":")[0].replace("card", "").strip()
            if "hdmi-0" in lower or "vc4hdmi0" in lower:
                hdmi_card = card_num
            elif any(kw in lower for kw in ("respeaker", "seeed", "wm8960")):
                respeaker_card = card_num
        # Prefer HDMI — louder via TV speakers
        if hdmi_card:
            return f"plughw:{hdmi_card},0"
        if respeaker_card:
            return f"plughw:{respeaker_card},0"
    except Exception:
        pass
    return None


def set_mic_gain(card: str = "2", gain: int = 60) -> None:
    """Set ReSpeaker PGA capture gain (0-119, ~0.5dB steps). Default 32 is too low."""
    try:
        subprocess.run(
            ["amixer", "-c", card, "-q", "cset", "numid=34", f"{gain},{gain}"],
            capture_output=True, timeout=5,
        )
        log.info("Mic PGA capture gain set to %d/119 on card %s", gain, card)
    except Exception as e:
        log.warning("Failed to set mic gain: %s", e)


def set_speaker_volume() -> None:
    device = find_speaker_device()
    if not device:
        return
    card = device.split(":")[0].replace("plughw", "").replace("hw", "")
    for control in ["Speaker", "Playback", "HP Playback",
                    "Line Playback", "PCM Playback", "PCM"]:
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


RECORD_BEEP_PATH = SOUNDS_DIR / "record_beep.wav"
RECORD_START_PATH = SOUNDS_DIR / "record_start.wav"
RECORD_STOP_PATH = SOUNDS_DIR / "record_stop.wav"


def generate_record_beep(path: Path) -> None:
    """Short high beep to confirm a sample was saved."""
    path.parent.mkdir(parents=True, exist_ok=True)
    sr = 22050
    t = np.linspace(0, 0.08, int(sr * 0.08), endpoint=False)
    env = np.minimum(t / 0.005, 1.0) * np.maximum(1.0 - t / 0.08, 0.0)
    signal = env * np.sin(2 * np.pi * 880 * t)
    signal = (signal / np.max(np.abs(signal)) * 32700).astype(np.int16)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(signal.tobytes())


def generate_record_start(path: Path) -> None:
    """Ascending three-tone to indicate recording mode started."""
    path.parent.mkdir(parents=True, exist_ok=True)
    sr = 22050
    tones = []
    for freq in [440, 554, 659]:
        t = np.linspace(0, 0.1, int(sr * 0.1), endpoint=False)
        env = np.minimum(t / 0.005, 1.0) * np.maximum(1.0 - t / 0.12, 0.0)
        tones.append(env * np.sin(2 * np.pi * freq * t))
        tones.append(np.zeros(int(sr * 0.02)))
    signal = np.concatenate(tones)
    signal = (signal / np.max(np.abs(signal)) * 32700).astype(np.int16)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(signal.tobytes())


def generate_record_stop(path: Path) -> None:
    """Descending two-tone to indicate recording mode stopped."""
    path.parent.mkdir(parents=True, exist_ok=True)
    sr = 22050
    tones = []
    for freq in [659, 440]:
        t = np.linspace(0, 0.12, int(sr * 0.12), endpoint=False)
        env = np.minimum(t / 0.005, 1.0) * np.maximum(1.0 - t / 0.14, 0.0)
        tones.append(env * np.sin(2 * np.pi * freq * t))
        tones.append(np.zeros(int(sr * 0.02)))
    signal = np.concatenate(tones)
    signal = (signal / np.max(np.abs(signal)) * 32700).astype(np.int16)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(signal.tobytes())


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
        log.info("Loading faster-whisper base model (int8)...")
        _whisper_model = WhisperModel("base", compute_type="int8", device="cpu")
        log.info("Whisper model loaded.")
    return _whisper_model


_silero_vad = None


def get_silero_vad():
    """Load Silero VAD model for speech trimming."""
    global _silero_vad
    if _silero_vad is None:
        import torch
        model, utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad", model="silero_vad",
            trust_repo=True, verbose=False,
        )
        _silero_vad = (model, utils)
        log.info("Silero VAD loaded for audio trimming.")
    return _silero_vad


def vad_trim(audio: np.ndarray, sr: int = 16000, pad_ms: int = 300) -> np.ndarray:
    """Trim audio to speech regions using Silero VAD.

    Returns the concatenated speech segments with padding, or the
    original audio if no speech is detected.
    """
    import torch
    try:
        model, utils = get_silero_vad()
        get_speech_timestamps = utils[0]

        audio_f32 = torch.from_numpy(audio.astype(np.float32) / 32768.0)
        timestamps = get_speech_timestamps(audio_f32, model, sampling_rate=sr,
                                           threshold=0.3, min_speech_duration_ms=100)
        if not timestamps:
            log.debug("VAD: no speech found, using full audio")
            return audio

        # Merge speech regions with padding
        pad_samples = int(sr * pad_ms / 1000)
        start = max(0, timestamps[0]["start"] - pad_samples)
        end = min(len(audio), timestamps[-1]["end"] + pad_samples)
        trimmed = audio[start:end]

        orig_dur = len(audio) / sr
        trim_dur = len(trimmed) / sr
        log.info("VAD trim: %.1fs → %.1fs (%.0f%% reduction)",
                 orig_dur, trim_dur, (1 - trim_dur / orig_dur) * 100)
        model.reset_states()
        return trimmed
    except Exception as e:
        log.warning("VAD trim failed, using full audio: %s", e)
        return audio


def transcribe(audio: np.ndarray) -> str:
    """Transcribe int16 mono audio array to text. Trims silence with VAD first."""
    # Trim to speech regions before transcribing
    audio = vad_trim(audio)

    model = get_whisper_model()
    # Remove DC offset, then standard int16 normalization
    audio_f32 = audio.astype(np.float32)
    audio_f32 = audio_f32 - np.mean(audio_f32)
    audio_f32 = audio_f32 / 32768.0
    segments, _ = model.transcribe(
        audio_f32, beam_size=1, language="en",
        no_speech_threshold=0.95,  # Don't skip segments unless very confident it's silence
        initial_prompt="Hey Jarvis",  # Bias toward hearing the wake word
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

    # Strip wake word prefix — user says "Hey Jarvis open calendar" as one phrase
    # Whisper mangles "hey jarvis" in many ways
    text = re.sub(r'^(hey|hi|hay|in|a|the|and)?\s*(jarvis|jervis|service|travis|jarvis,)\s*[,.]?\s*', '', text).strip()
    log.info("After wake word strip: '%s'", text)

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

    # Show/hide debug overlay (Whisper mis-transcribes "debug" many ways)
    debug_pat = r"(debug|debud|d-bug|d bug|the\s*bug|de-?bug)"
    if re.search(r'\b(show|open|display)\s+(the\s+)?' + debug_pat, text):
        return {"action": "debug_show"}
    if re.search(r"(hi|hide|high|close|dismiss|remove|i'm)\s+(the\s+)?" + debug_pat, text):
        return {"action": "debug_hide"}

    # Turn on (explicit)
    if re.search(r'\bturn\s*(it\s+)?on\b', text):
        return {"action": "turn_on"}

    # General knowledge query — question words or substantial speech
    if re.search(r'\b(what|who|where|when|why|how|tell\s+me|explain|describe)\b', text) or len(text.split()) > 4:
        return {"action": "ask", "query": text}

    # Default: ignore unrecognized speech (don't act on false positives)
    log.info("No command matched, ignoring: '%s'", text)
    return {"action": "none"}


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


_local_server = None  # Set to RecordingManager instance in main()


def debug_post(event_type: str, data: dict | None = None) -> None:
    """Post debug event to local server (in-process, no HTTP)."""
    if _local_server:
        _local_server.add_debug_event(event_type, data)
        return
    # Fallback to worker if local server not ready
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


# ConfigPoller removed — config is now local (RecordingManager._wake_config)


# ---------------------------------------------------------------------------
# Alarm thread
# ---------------------------------------------------------------------------

class AlarmThread(threading.Thread):
    """Background thread that checks local timers for expiry and plays alarm."""

    def __init__(self, rec_mgr: "RecordingManager", dry_run: bool = False):
        super().__init__(daemon=True)
        self.rec_mgr = rec_mgr
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
                timers = self.rec_mgr.get_active_timers()
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
    """Background thread that polls for hand gestures and triggers CEC TV on.

    """

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
# Recording mode (for training data collection via HandController)
# ---------------------------------------------------------------------------

class RecordingManager:
    """Local API server on port 8765 — replaces Cloudflare Worker for Pi-local endpoints.

    All state lives in-memory on the Pi (config persists to JSON file).
    Dashboard and HandController talk directly to http://localhost:8765/.

    Endpoints:
        Recording:
            GET/POST /status  → {active, type, count, totalPositive, totalNegative}
            POST /toggle  → toggles recording
            POST /reset   → zeroes counts
            POST /clear   → zeroes counts + deletes saved audio files

        Wake config:
            GET  /api/wake-config  → config dict
            PUT/POST /api/wake-config  → update config, persist to disk

        Wake debug:
            GET  /api/wake-debug?since=N  → {events: [...]}
            POST /api/wake-debug  → append event

        Navigation:
            GET  /api/navigate  → {navigation: {page, view, timestamp}}
            POST /api/navigate  → update page/view

        Timers:
            GET  /api/timers  → {timers: [...], serverTime: ms}
            POST /api/timers  → create timer
            POST /api/timers/dismiss-all  → dismiss all expired
            POST /api/timers/<id>/dismiss  → dismiss specific timer

        Gestures:
            GET  /gesture  → {gesture: ...}
            POST /gesture  → accept gesture from HandController

        Presence:
            GET  /api/presence  → {present, lastPing, secondsAgo}
            POST /api/presence  → heartbeat ping, auto turns TV on if was away
    """

    HTTP_PORT = 8765
    MAX_DEBUG_EVENTS = 100

    def __init__(self, worker_url: str | None = None, worker_token: str | None = None):
        self.worker_url = worker_url
        self.worker_token = worker_token
        # Recording state
        self.active = False
        self.record_type = "positive"
        self._session_count = 0
        self._recording_buffer: list[np.ndarray] = []
        self._chime_mute_until = 0.0
        self._save_dir = Path(__file__).parent / "models" / "recorded_samples"
        # Gesture state
        self._gesture_latest = None  # {gesture, hand, timestamp, id}
        # Wake config (persisted to JSON)
        self._config_path = Path(__file__).parent / "wake_config.json"
        self._wake_config = dict(_DEFAULT_CONFIG)
        if self._config_path.exists():
            try:
                self._wake_config.update(json.loads(self._config_path.read_text()))
                log.info("Loaded wake config from %s", self._config_path)
            except Exception:
                pass
        # Wake debug events (circular buffer)
        self._debug_events: list[dict] = []
        # Navigation state
        self._navigation = {"page": "dashboard", "view": None, "timestamp": 0}
        # Timers
        self._timers: list[dict] = []
        self._timer_counter = 0
        # Presence detection (HandController heartbeat → CEC TV on)
        self._presence_last_ping = 0.0  # epoch seconds
        self._presence_tv_on_at = 0.0   # when we last turned TV on for presence
        self._presence_cooldown = 60.0  # don't re-trigger CEC for 60s
        self._presence_timeout = 120.0  # consider "away" after 2min without ping
        # Thread lock
        self._lock = threading.Lock()
        self._start_http_server()

    # ── Public methods for in-process callers (no HTTP round-trip) ──

    def add_debug_event(self, event_type: str, data: dict | None = None):
        """Add a debug event (called from detection loop)."""
        event = {
            "type": event_type,
            "timestamp": int(time.time() * 1000),
            **(data or {}),
        }
        with self._lock:
            self._debug_events.append(event)
            if len(self._debug_events) > self.MAX_DEBUG_EVENTS:
                self._debug_events = self._debug_events[-self.MAX_DEBUG_EVENTS:]

    def navigate(self, page: str | None = None, view: str | None = None):
        """Update navigation state (called from detection loop)."""
        with self._lock:
            if page:
                self._navigation["page"] = page
            if view:
                self._navigation["view"] = view
            self._navigation["timestamp"] = int(time.time() * 1000)

    def add_timer(self, name: str, total_seconds: int, source: str = "voice") -> dict:
        """Create a timer (called from detection loop)."""
        with self._lock:
            self._timer_counter += 1
            timer = {
                "id": f"timer_{int(time.time() * 1000)}_{self._timer_counter}",
                "name": name,
                "totalSeconds": total_seconds,
                "expiresAt": int(time.time() * 1000) + total_seconds * 1000,
                "dismissed": False,
                "source": source,
                "createdAt": int(time.time() * 1000),
            }
            self._timers.append(timer)
            log.info("Timer created: %s (%ds)", name, total_seconds)
            return timer

    def dismiss_all_timers(self):
        """Dismiss all expired timers."""
        now = int(time.time() * 1000)
        with self._lock:
            for t in self._timers:
                if t["expiresAt"] <= now:
                    t["dismissed"] = True

    def dismiss_timer(self, timer_id: str):
        """Dismiss a specific timer."""
        with self._lock:
            for t in self._timers:
                if t["id"] == timer_id:
                    t["dismissed"] = True

    def get_config(self, key: str):
        """Get a config value (thread-safe)."""
        with self._lock:
            return self._wake_config.get(key, _DEFAULT_CONFIG.get(key))

    def get_active_timers(self) -> list[dict]:
        """Get non-stale timers (cleanup old dismissed ones)."""
        now = int(time.time() * 1000)
        with self._lock:
            # Remove timers dismissed more than 1 hour ago
            self._timers = [t for t in self._timers
                           if not (t["dismissed"] and now - t["expiresAt"] > 3600000)]
            return list(self._timers)

    def handle_presence(self, dry_run: bool = False) -> dict:
        """Handle a presence ping from HandController. Turns TV on if needed."""
        now = time.time()
        with self._lock:
            was_away = (now - self._presence_last_ping) > self._presence_timeout
            self._presence_last_ping = now
            since_tv_on = now - self._presence_tv_on_at

            if was_away and since_tv_on > self._presence_cooldown:
                self._presence_tv_on_at = now
                action = "tv_on"
            else:
                action = "already_present"

        if action == "tv_on":
            log.info("Presence detected (was away) — turning TV on via CEC")
            if not dry_run:
                threading.Thread(target=turn_on_tv, daemon=True).start()

        return {
            "action": action,
            "lastPing": now,
            "away": was_away,
        }

    def get_presence(self) -> dict:
        """Get current presence state."""
        now = time.time()
        with self._lock:
            last = self._presence_last_ping
            present = (now - last) < self._presence_timeout if last > 0 else False
        return {
            "present": present,
            "lastPing": last,
            "secondsAgo": round(now - last, 1) if last > 0 else None,
        }

    def _count_files(self, prefix: str) -> int:
        """Count .npz training files on disk — always accurate."""
        models_dir = self._save_dir.parent
        return len(list(models_dir.glob(f"real_samples_{prefix}_*.npz")))

    def _get_status(self) -> dict:
        return {
            "active": self.active,
            "type": self.record_type,
            "count": self._session_count,
            "totalPositive": self._count_files("positive"),
            "totalNegative": self._count_files("negative"),
        }



    def _start_http_server(self) -> None:
        """Run a tiny HTTP server in a daemon thread."""
        from http.server import HTTPServer, BaseHTTPRequestHandler
        import json as _json

        mgr = self  # closure reference

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, fmt, *a):
                log.debug("🎙️  HTTP: " + fmt % a)

            def _cors_headers(self):
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

            def _respond_json(self, data, code=200):
                body = _json.dumps(data).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self._cors_headers()
                self.end_headers()
                self.wfile.write(body)

            def do_OPTIONS(self):
                self.send_response(204)
                self._cors_headers()
                self.end_headers()

            def do_PUT(self):
                # Route PUT to POST handler (for wake-config)
                self.do_POST()

            def _handle_gesture(self, body):
                title = body.get("title", "")
                m = re.match(r"(Left|Right|L|R|Both) (?:Hands?): (.+)", title)
                if m:
                    raw = m.group(2).strip()
                    parts = re.split(r"[-\s]+", raw)
                    gesture = parts[0].lower() + "".join(w.capitalize() for w in parts[1:])
                    with mgr._lock:
                        mgr._gesture_latest = {
                            "gesture": gesture,
                            "hand": m.group(1),
                            "timestamp": body.get("timestamp", int(time.time() * 1000)),
                            "id": body.get("id", ""),
                        }
                    self._respond_json({"ok": True})
                else:
                    self._respond_json({"error": "invalid title format"}, 400)

            def do_GET(self):
                path = self.path.split("?")[0]  # strip query string
                qs = self.path.split("?")[1] if "?" in self.path else ""
                params = dict(p.split("=", 1) for p in qs.split("&") if "=" in p) if qs else {}

                if path == "/status":
                    with mgr._lock:
                        self._respond_json(mgr._get_status())
                elif path == "/gesture":
                    with mgr._lock:
                        self._respond_json({"gesture": mgr._gesture_latest})
                elif path == "/api/wake-config":
                    with mgr._lock:
                        self._respond_json(dict(mgr._wake_config))
                elif path == "/api/wake-debug":
                    since = int(params.get("since", "0"))
                    with mgr._lock:
                        events = [e for e in mgr._debug_events if e["timestamp"] > since]
                    self._respond_json({"events": events})
                elif path == "/api/navigate":
                    with mgr._lock:
                        self._respond_json({"navigation": dict(mgr._navigation)})
                elif path == "/api/timers":
                    timers = mgr.get_active_timers()
                    self._respond_json({"timers": timers, "serverTime": int(time.time() * 1000)})
                elif path == "/api/presence":
                    self._respond_json(mgr.get_presence())
                else:
                    self._respond_json({"error": "not found"}, 404)

            def do_POST(self):
                length = int(self.headers.get("Content-Length", 0))
                body = {}
                if length > 0:
                    try:
                        body = _json.loads(self.rfile.read(length))
                    except Exception:
                        pass

                if self.path == "/toggle":
                    with mgr._lock:
                        if not mgr.active:
                            mgr.active = True
                            mgr.record_type = body.get("type", "positive")
                            mgr._session_count = 0
                            mgr._recording_buffer = []
                            mgr._save_dir.mkdir(parents=True, exist_ok=True)
                            log.info("🎙️  RECORDING START — type=%s", mgr.record_type)
                            sound = RECORD_START_PATH
                            gen = generate_record_start
                        else:
                            mgr.active = False
                            if mgr._recording_buffer:
                                mgr._save_clip()
                            else:
                                log.info("🎙️  RECORDING STOP — no audio buffered")
                            sound = RECORD_STOP_PATH
                            gen = generate_record_stop
                        # Respond immediately — don't block on sound
                        self._respond_json(mgr._get_status())
                    # Play sound and sync in background
                    def _after(s=sound, g=gen):
                        if not s.exists(): g(s)
                        play_sound(s)
                        mgr._chime_mute_until = time.time() + 1.5
    
                    threading.Thread(target=_after, daemon=True).start()

                elif self.path == "/gesture":
                    self._handle_gesture(body)

                elif self.path == "/reset":
                    with mgr._lock:
                        mgr._session_count = 0
                        log.info("🎙️  Session count reset")
                        self._respond_json(mgr._get_status())


                elif self.path == "/clear":
                    with mgr._lock:
                        mgr.active = False
                        mgr._session_count = 0
                        mgr._recording_buffer = []
                        mgr._clear_saved_files()
                        self._respond_json(mgr._get_status())


                elif self.path == "/status":
                    with mgr._lock:
                        self._respond_json(mgr._get_status())

                elif self.path == "/api/wake-config":
                    # PUT or POST to update config
                    with mgr._lock:
                        for k, v in body.items():
                            if k in mgr._wake_config:
                                mgr._wake_config[k] = type(mgr._wake_config[k])(v)
                        # Also update live config
                        _live_config.update(mgr._wake_config)
                        # Persist to disk
                        try:
                            mgr._config_path.write_text(json.dumps(mgr._wake_config, indent=2))
                        except Exception:
                            pass
                        self._respond_json(dict(mgr._wake_config))

                elif self.path == "/api/wake-debug":
                    mgr.add_debug_event(
                        body.get("type", "unknown"),
                        {k: v for k, v in body.items() if k not in ("type",)},
                    )
                    self._respond_json({"ok": True})

                elif self.path == "/api/navigate":
                    mgr.navigate(body.get("page"), body.get("view"))
                    with mgr._lock:
                        self._respond_json({"ok": True, "navigation": dict(mgr._navigation)})

                elif self.path == "/api/timers":
                    name = body.get("name", "timer")
                    seconds = body.get("totalSeconds", 60)
                    source = body.get("source", "voice")
                    timer = mgr.add_timer(name, int(seconds), source)
                    self._respond_json({"ok": True, "timer": timer})

                elif self.path == "/api/timers/dismiss-all":
                    mgr.dismiss_all_timers()
                    self._respond_json({"ok": True})

                elif self.path.startswith("/api/timers/") and self.path.endswith("/dismiss"):
                    # /api/timers/<id>/dismiss
                    parts = self.path.split("/")
                    if len(parts) >= 4:
                        timer_id = parts[3]
                        mgr.dismiss_timer(timer_id)
                    self._respond_json({"ok": True})

                elif self.path == "/api/gesture":
                    # Accept gesture via /api/ path too
                    self._handle_gesture(body)

                elif self.path == "/api/presence":
                    result = mgr.handle_presence()
                    self._respond_json(result)

                else:
                    self._respond_json({"error": "not found"}, 404)

        server = HTTPServer(("0.0.0.0", self.HTTP_PORT), Handler)
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()
        log.info("🎙️  Recording HTTP server listening on port %d", self.HTTP_PORT)

    def process_audio(self, audio_chunk: np.ndarray) -> bool:
        """Buffer audio while recording is active.

        Returns True if recording mode is active (caller should skip wake detection).
        """
        with self._lock:
            if not self.active:
                return False
            if time.time() < self._chime_mute_until:
                return True
            self._recording_buffer.append(audio_chunk.copy())
            return True

    def _save_clip(self) -> None:
        """Save the entire recording buffer as one clip. Must hold self._lock."""
        if not self._recording_buffer:
            return
        audio = np.concatenate(self._recording_buffer)
        self._recording_buffer = []
        self._session_count += 1

        # Use timestamp for unique filenames — no counter drift
        ts = int(time.time())

        # Save .npy clip
        self._save_dir.mkdir(parents=True, exist_ok=True)
        clip_path = self._save_dir / f"{self.record_type}_{ts}.npy"
        np.save(str(clip_path), audio)
        duration = len(audio) / SAMPLE_RATE
        rms = np.sqrt(np.mean(audio.astype(np.float64) ** 2))
        log.info("🎙️  Saved clip: %s (%.1fs, RMS=%.0f)", clip_path.name, duration, rms)

        # Also save as .npz for training
        npz_path = self._save_dir.parent / f"real_samples_{self.record_type}_{ts}.npz"
        np.savez(npz_path, audio)
        log.info("🎙️  Saved training file → %s", npz_path)

    def _clear_saved_files(self) -> None:
        """Delete all saved .npy clips and .npz training files. Must hold self._lock."""
        models_dir = self._save_dir.parent
        count = 0
        if self._save_dir.exists():
            for f in self._save_dir.glob("*.npy"):
                f.unlink()
                count += 1
        for f in models_dir.glob("real_samples_*.npz"):
            f.unlink()
            count += 1
        log.info("🎙️  Cleared %d saved recording files", count)


# ---------------------------------------------------------------------------
# Audio preprocessing
# ---------------------------------------------------------------------------

class AudioPreprocessor:
    """Simple audio preprocessing: high-pass filter + adaptive noise gate.

    Runs before DNN inference to clean up the audio signal:
    - High-pass filter removes low-freq rumble (TV bass, HVAC, fans)
    - Adaptive noise gate tracks ambient noise floor and suppresses
      audio that's only slightly above it (reduces TV dialogue triggers)
    """

    def __init__(self, cutoff_hz: float = 85, sr: int = 16000,
                 noise_adapt_rate: float = 0.02):
        # High-pass filter state (first-order IIR)
        rc = 1.0 / (2.0 * np.pi * cutoff_hz)
        dt = 1.0 / sr
        self.hp_alpha = rc / (rc + dt)
        self.hp_prev_raw = 0.0
        self.hp_prev_out = 0.0

        # Adaptive noise floor
        self.noise_floor_rms = 300.0  # Initial estimate
        self.noise_adapt_rate = noise_adapt_rate  # How fast floor adapts

    def process(self, audio: np.ndarray) -> np.ndarray:
        """Process a chunk of int16 mono audio."""
        # High-pass filter (vectorized for speed)
        audio_f = audio.astype(np.float64)
        output = np.zeros_like(audio_f)
        prev_raw = self.hp_prev_raw
        prev_out = self.hp_prev_out
        alpha = self.hp_alpha
        for i in range(len(audio_f)):
            output[i] = alpha * (prev_out + audio_f[i] - prev_raw)
            prev_raw = audio_f[i]
            prev_out = output[i]
        self.hp_prev_raw = prev_raw
        self.hp_prev_out = prev_out

        # Update adaptive noise floor (slow tracking of quiet periods)
        chunk_rms = np.sqrt(np.mean(output ** 2))
        if chunk_rms < self.noise_floor_rms * 1.5:
            # Likely noise/ambient — adapt floor toward it
            self.noise_floor_rms += self.noise_adapt_rate * (chunk_rms - self.noise_floor_rms)

        return np.clip(output, -32768, 32767).astype(np.int16)

    def is_speech_likely(self, audio: np.ndarray) -> bool:
        """Check if audio is likely speech (well above noise floor)."""
        rms = np.sqrt(np.mean(audio.astype(np.float64) ** 2))
        # Speech should be at least 3x the noise floor
        return rms > self.noise_floor_rms * 3.0


# ---------------------------------------------------------------------------
# Wake word model setup
# ---------------------------------------------------------------------------

def get_or_train_model() -> "Model":
    framework = _inference_framework()
    log.info("Using inference framework: %s", framework)

    # Use built-in "hey_jarvis" model — well-trained, no custom model needed
    import openwakeword
    openwakeword.utils.download_models()
    log.info("Loading built-in 'hey_jarvis' model with Silero VAD")
    return Model(
        wakeword_models=["hey_jarvis"],
        inference_framework=framework,
        vad_threshold=0.3,
    )


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
    if not RECORD_BEEP_PATH.exists():
        generate_record_beep(RECORD_BEEP_PATH)
    if not RECORD_START_PATH.exists():
        generate_record_start(RECORD_START_PATH)
    if not RECORD_STOP_PATH.exists():
        generate_record_stop(RECORD_STOP_PATH)

    # Pre-load models so first command is fast
    try:
        get_whisper_model()
    except Exception as e:
        log.warning("Could not pre-load whisper model: %s", e)
    try:
        get_silero_vad()
    except Exception as e:
        log.warning("Could not pre-load Silero VAD: %s", e)

    # Load wake word model
    model = get_or_train_model()
    wake_words = list(model.models.keys())
    log.info("Listening for wake words: %s (threshold=%.2f)", wake_words, args.threshold)

    # Find the ReSpeaker device
    device = args.device or find_respeaker_device()
    if device is None:
        log.error("No ReSpeaker found! Check your HAT connection or specify --device")
        sys.exit(1)

    # Boost mic gain — default 32/119 is too quiet for across-room detection
    mic_card = device.replace("hw:", "").split(",")[0] if device else "2"
    set_mic_gain(mic_card, gain=80)

    # Open ALSA capture
    log.info("Opening ALSA capture on %s (%d ch, %d Hz)", device, CHANNELS, SAMPLE_RATE)
    try:
        pcm = open_alsa_capture(device, CHANNELS, SAMPLE_RATE, CHUNK_SIZE)
    except alsaaudio.ALSAAudioError as e:
        log.error("Failed to open ALSA device %s: %s", device, e)
        sys.exit(1)

    gesture_thread = None

    # Audio preprocessor — high-pass filter + adaptive noise gate
    preprocessor = AudioPreprocessor(cutoff_hz=85)

    # Recording manager — local API server on :8765
    rec_mgr = RecordingManager(args.worker_url, args.worker_token)

    # Wire up global reference for in-process callers (debug_post, cfg)
    global _local_server
    _local_server = rec_mgr

    # Start alarm thread (uses local timers via rec_mgr)
    alarm_thread = AlarmThread(rec_mgr, args.dry_run)
    alarm_thread.start()
    log.info("Alarm thread started (local timers, every %ds)", ALARM_POLL_INTERVAL)

    # Gesture thread — only if worker configured (HandController still posts to worker)
    if args.worker_url:
        gesture_thread = GestureThread(args.worker_url, args.worker_token, args.dry_run)
        gesture_thread.start()
        log.info("Gesture thread started (polling worker every 2s)")

    log.info("=== openWakeWord DNN mode (no Whisper verification) ===")
    log.info("Microphone stream open. Listening...")
    last_trigger = 0.0
    last_action_time = 0.0
    consecutive_hits = {ww: 0 for ww in wake_words}

    # Rolling buffer: ~2 seconds of raw mono audio for "Hey Jarvis, open calendar" style commands
    # Each chunk = CHUNK_SIZE samples (80ms at 16kHz), so 2s ≈ 25 chunks
    PREBUFFER_SECONDS = 2.0
    prebuf_max = int(PREBUFFER_SECONDS * SAMPLE_RATE / CHUNK_SIZE)
    prebuffer = collections.deque(maxlen=prebuf_max)
    TAIL_SECONDS = 1.5  # Extra recording after detection to catch trailing words

    try:
        while True:
            length, data = pcm.read()
            if length <= 0:
                continue

            audio_array = np.frombuffer(data, dtype=np.int16)
            if CHANNELS > 1:
                audio_array = audio_array.reshape(-1, CHANNELS).mean(axis=1).astype(np.int16)

            raw_audio = audio_array.copy()
            prebuffer.append(raw_audio)

            # Apply audio preprocessing (high-pass filter, noise tracking)
            audio_array = preprocessor.process(audio_array)

            now = time.time()

            # Recording mode — skip wake word detection
            if rec_mgr.process_audio(raw_audio):
                model.predict(audio_array)  # Keep model state current
                continue

            # Post-action mute (live config)
            if now - last_action_time < cfg("post_action_mute"):
                model.predict(audio_array)
                continue

            # RMS energy gate (live config) — use preprocessed audio
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

                # Adaptive threshold: lower when speech energy is strong
                base_threshold = cfg("detection_threshold")
                if rms > cfg("min_rms_energy") * 4:
                    effective_threshold = base_threshold * 0.85
                else:
                    effective_threshold = base_threshold

                if score >= effective_threshold:
                    consecutive_hits[ww_name] = consecutive_hits.get(ww_name, 0) + 1

                    if consecutive_hits[ww_name] < cfg("min_consecutive"):
                        continue

                    if now - last_trigger < cfg("cooldown_seconds"):
                        log.debug("Cooldown active, ignoring detection")
                        continue

                    # ── Wake word detected! No Whisper verification — act immediately ──
                    log.info("Wake word '%s' DETECTED (score=%.3f, consec=%d, rms=%.0f)",
                             ww_name, score, consecutive_hits[ww_name], rms)
                    debug_post("wake_confirmed", {"score": round(score, 3), "consecutive": consecutive_hits[ww_name]})

                    # Reset model state
                    model.reset()
                    for ww in consecutive_hits:
                        consecutive_hits[ww] = 0
                    last_trigger = now

                    # Chime immediately — user gets instant feedback
                    if not args.dry_run:
                        play_acknowledgement()

                    # Grab pre-trigger audio buffer + record short tail
                    # This captures "Hey Jarvis open calendar" as one phrase
                    log.info("Capturing pre-buffer + %.1fs tail...", TAIL_SECONDS)
                    tail_clip = record_audio(pcm, TAIL_SECONDS)
                    pre_audio = np.concatenate(list(prebuffer)) if prebuffer else np.array([], dtype=np.int16)
                    full_audio = np.concatenate([pre_audio, tail_clip])
                    log.info("Total audio: %.1fs (%.1fs pre + %.1fs tail)",
                             len(full_audio) / SAMPLE_RATE,
                             len(pre_audio) / SAMPLE_RATE, TAIL_SECONDS)
                    command = parse_command(transcribe(full_audio))

                    log.info("Command: %s", command)
                    debug_post("command", {"action": command.get("action"), "details": command})

                    # Dispatch — all local now (no worker round-trip)
                    action = command["action"]
                    if action == "set_timer":
                        label = command.get("label", "timer")
                        duration = command.get("duration", 60)
                        if args.dry_run:
                            log.info("[DRY RUN] Would create timer: %s (%ds)", label, duration)
                        else:
                            rec_mgr.add_timer(label, duration, "voice")

                    elif action == "stop":
                        if args.dry_run:
                            log.info("[DRY RUN] Would dismiss all timers")
                        else:
                            rec_mgr.dismiss_all_timers()
                            log.info("Dismissed all timers")

                    elif action == "ask" and args.worker_url:
                        query_text = command.get("query", "")
                        if args.dry_run:
                            log.info("[DRY RUN] Would ask: %s", query_text)
                        else:
                            result = worker_post(args.worker_url, args.worker_token, "/api/ask-query", {"query": query_text})
                            log.info("LLM query %s: %s", "sent" if result else "FAILED", query_text)

                    elif action == "navigate":
                        page = command.get("page")
                        view = command.get("view")
                        if args.dry_run:
                            log.info("[DRY RUN] Would navigate: page=%s view=%s", page, view)
                        else:
                            rec_mgr.navigate(page, view)
                            log.info("Navigation: page=%s view=%s", page, view)

                    elif action in ("debug_hide", "debug_show"):
                        debug_post(action, {"message": action.replace("_", " ")})
                        log.info("Debug overlay: %s", action)

                    elif action == "turn_off":
                        if args.dry_run:
                            log.info("[DRY RUN] Would turn off TV")
                        else:
                            turn_off_tv()

                    else:  # turn_on or unrecognized
                        if args.dry_run:
                            log.info("[DRY RUN] Would turn on TV")
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
