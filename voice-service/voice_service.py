#!/usr/bin/env python3
"""Home Center voice service (Mac mini).

Connects to the Pi's mic_streamer over TCP (16 kHz mono S16_LE PCM),
runs openWakeWord for detection and faster-whisper for speech-to-text,
parses commands, and dispatches them back to the Pi's HTTP command
server (`:8765`) and the Cloudflare worker.

Wake-word detection and STT used to live on the Pi; they were moved
here because the Pi's CPU can only run a tiny Whisper model, and that
was the main source of false positives and missed commands.

Why the split:
  Pi  — mic + HDMI-CEC + dashboard state + chime playback
  Mac — the heavy signal + ML work (big Whisper, full openWakeWord)
"""

from __future__ import annotations

import argparse
import collections
import json
import logging
import os
import re
import socket
import sys
import threading
import time
from pathlib import Path

import numpy as np
import requests
from openwakeword.model import Model


SAMPLE_RATE = 16000
CHUNK_SIZE = 1280        # 80 ms windows — matches openWakeWord input size
PREBUFFER_SECONDS = 2.0  # rolling buffer of raw audio for "wake word + command" phrases
TAIL_SECONDS = 1.5       # audio captured after detection

DEFAULT_CONFIG = {
    # Raised from 0.25 to cut the long tail of DNN false positives (ambient
    # "homer" / "okay" / "you" in the room). Real "hey homer" scores 0.8+.
    "detection_threshold": 0.55,
    "cooldown_seconds": 5,
    "min_rms_energy": 200,
    "min_consecutive": 3,
    "score_smooth_window": 3,
    "post_action_mute": 3.0,
}

# Whisper must find one of these in its transcript for a detection to count.
# Covers the common mis-transcriptions of "hey homer" ("homework", "home her",
# bare "homer", etc.). Without this gate the DNN chimes on ambient speech.
WAKE_CONFIRM_RE = re.compile(
    r"\b(homer|homework|home her|home\s*her|comni|jarvis|jervis)\b",
    re.IGNORECASE,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("voice-service")


# ---------------------------------------------------------------------------
# Audio preprocessing (ported from pi/wake_word_service.py)
# ---------------------------------------------------------------------------

class AudioPreprocessor:
    """High-pass filter + slow noise-floor tracker. Kills TV bass / HVAC rumble."""

    def __init__(self, cutoff_hz: float = 85, sr: int = SAMPLE_RATE,
                 noise_adapt_rate: float = 0.02):
        rc = 1.0 / (2.0 * np.pi * cutoff_hz)
        dt = 1.0 / sr
        self.hp_alpha = rc / (rc + dt)
        self.hp_prev_raw = 0.0
        self.hp_prev_out = 0.0
        self.noise_floor_rms = 300.0
        self.noise_adapt_rate = noise_adapt_rate

    def process(self, audio: np.ndarray) -> np.ndarray:
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

        chunk_rms = np.sqrt(np.mean(output ** 2))
        if chunk_rms < self.noise_floor_rms * 1.5:
            self.noise_floor_rms += self.noise_adapt_rate * (chunk_rms - self.noise_floor_rms)

        return np.clip(output, -32768, 32767).astype(np.int16)


# ---------------------------------------------------------------------------
# TCP audio stream reader
# ---------------------------------------------------------------------------

class MicStream:
    """Blocking reader for the Pi's mic_streamer TCP stream.

    Reconnects on disconnect. Yields int16 mono chunks of CHUNK_SIZE samples.
    """

    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.sock: socket.socket | None = None
        self.buf = bytearray()

    def connect(self) -> None:
        while True:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(10)
                log.info("Connecting to mic stream %s:%d", self.host, self.port)
                s.connect((self.host, self.port))
                s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                s.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
                self.sock = s
                self.buf.clear()
                log.info("Mic stream connected.")
                return
            except (socket.timeout, ConnectionRefusedError, OSError) as e:
                log.warning("Mic stream connect failed (%s). Retrying in 3s...", e)
                time.sleep(3)

    def read_chunk(self) -> np.ndarray:
        """Read one CHUNK_SIZE-sample mono int16 frame from the stream."""
        need_bytes = CHUNK_SIZE * 2
        while len(self.buf) < need_bytes:
            assert self.sock is not None
            try:
                data = self.sock.recv(4096)
            except (socket.timeout, OSError) as e:
                log.warning("Mic stream read error (%s). Reconnecting.", e)
                self._reset()
                self.connect()
                continue
            if not data:
                log.warning("Mic stream closed by peer. Reconnecting.")
                self._reset()
                self.connect()
                continue
            self.buf.extend(data)
        chunk = bytes(self.buf[:need_bytes])
        del self.buf[:need_bytes]
        return np.frombuffer(chunk, dtype=np.int16)

    def _reset(self) -> None:
        try:
            if self.sock:
                self.sock.close()
        except Exception:
            pass
        self.sock = None
        self.buf.clear()


# ---------------------------------------------------------------------------
# Whisper (faster-whisper)
# ---------------------------------------------------------------------------

_whisper_model = None
_silero_vad = None


def get_whisper(model_name: str):
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        log.info("Loading faster-whisper '%s' (int8)...", model_name)
        _whisper_model = WhisperModel(model_name, compute_type="int8", device="cpu")
        log.info("Whisper loaded.")
    return _whisper_model


def get_silero_vad():
    global _silero_vad
    if _silero_vad is None:
        import torch
        model, utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad", model="silero_vad",
            trust_repo=True, verbose=False,
        )
        _silero_vad = (model, utils)
        log.info("Silero VAD loaded.")
    return _silero_vad


def vad_trim(audio: np.ndarray, sr: int = SAMPLE_RATE, pad_ms: int = 300) -> np.ndarray:
    import torch
    try:
        model, utils = get_silero_vad()
        get_speech_timestamps = utils[0]
        audio_f32 = torch.from_numpy(audio.astype(np.float32) / 32768.0)
        timestamps = get_speech_timestamps(
            audio_f32, model, sampling_rate=sr,
            threshold=0.3, min_speech_duration_ms=100,
        )
        if not timestamps:
            return audio
        pad = int(sr * pad_ms / 1000)
        start = max(0, timestamps[0]["start"] - pad)
        end = min(len(audio), timestamps[-1]["end"] + pad)
        trimmed = audio[start:end]
        model.reset_states()
        return trimmed
    except Exception as e:
        log.warning("VAD trim failed (%s). Using full audio.", e)
        return audio


def transcribe(audio: np.ndarray, model_name: str, initial_prompt: str) -> str:
    audio = vad_trim(audio)
    model = get_whisper(model_name)
    audio_f32 = audio.astype(np.float32)
    audio_f32 = audio_f32 - np.mean(audio_f32)
    audio_f32 = audio_f32 / 32768.0
    segments, _ = model.transcribe(
        audio_f32, beam_size=3, language="en",
        no_speech_threshold=0.95,
        initial_prompt=initial_prompt,
    )
    return " ".join(seg.text.strip() for seg in segments).strip()


# ---------------------------------------------------------------------------
# Command parsing (ported from pi/wake_word_service.py)
# ---------------------------------------------------------------------------

# Whisper's mistranscriptions of "hey homer" — "homework", "home her", etc.
# Keep the prefix strip lenient so we don't drop the body of the command.
_WAKE_PREFIX_RE = re.compile(
    r"^(hey|hi|hay|he|a|the|and|in)?\s*"
    r"(homer|homer,|homer\.|homework|home her|home\s*her|comni|jarvis|jervis)\s*[,.]?\s*",
    re.IGNORECASE,
)


def parse_command(text: str) -> dict:
    text = text.lower().strip()
    log.info("Transcribed: %r", text)
    text = _WAKE_PREFIX_RE.sub("", text).strip()
    log.info("After wake-word strip: %r", text)

    if not text:
        return {"action": "turn_on"}

    if re.search(r"\b(stop|dismiss|cancel|quiet|shut up|silence)\b", text):
        return {"action": "stop"}

    if re.search(r"\bturn(ed|s)?\s*(it\s+)?(off|of|up|down|f)\b", text):
        return {"action": "turn_off"}

    timer_match = re.search(
        r"(?:set\s+(?:a\s+)?timer|remind\s+me|timer)\s+"
        r"(?:for\s+)?(\d+)\s*"
        r"(second|sec|minute|min|hour|hr)s?\b"
        r"(?:\s+(?:for|to|called?|named?|labele?d?)\s+(.+))?",
        text,
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

    if re.search(r"\b(open|show|go\s+to)\s+(the\s+)?calendar\b", text):
        return {"action": "navigate", "page": "calendar"}
    if re.search(r"\b(open|show|go\s+to)\s+(the\s+)?weather\b", text):
        return {"action": "navigate", "page": "weather"}
    if re.search(r"\b(open|show|go\s+to)\s+(the\s+)?(photos?|pictures?|gallery)\b", text):
        return {"action": "navigate", "page": "photos"}

    view_match = re.search(r"\b(monthly|weekly|daily)\s*(view)?\b", text)
    if view_match:
        return {"action": "navigate", "view": view_match.group(1)}

    if re.search(
        r"\b(go\s+(back|home)|back\s+to\s+(dashboard|home)|close\s+(calendar|weather|photos?))\b",
        text,
    ):
        return {"action": "navigate", "page": "dashboard"}

    if re.search(r"\bturn(ed|s)?\s*(it\s+)?on\b", text):
        return {"action": "turn_on"}

    if (
        re.search(r"\b(what|who|where|when|why|how|tell\s+me|explain|describe)\b", text)
        or len(text.split()) > 4
    ):
        return {"action": "ask", "query": text}

    log.info("No command matched, ignoring: %r", text)
    return {"action": "none"}


# ---------------------------------------------------------------------------
# HTTP dispatch (Pi command server + Cloudflare worker)
# ---------------------------------------------------------------------------

class Dispatcher:
    def __init__(self, pi_base: str, worker_url: str | None, worker_token: str | None):
        self.pi_base = pi_base.rstrip("/")
        self.worker_url = worker_url.rstrip("/") if worker_url else None
        self.worker_token = worker_token

    def _pi_post(self, path: str, payload: dict | None = None) -> None:
        url = f"{self.pi_base}{path}"
        try:
            r = requests.post(url, json=payload or {}, timeout=5)
            if not r.ok:
                log.warning("Pi POST %s → %d %s", path, r.status_code, r.text[:200])
        except requests.RequestException as e:
            log.warning("Pi POST %s error: %s", path, e)

    def _worker_post(self, path: str, payload: dict | None = None) -> None:
        if not self.worker_url:
            log.warning("Worker URL not set, skipping %s", path)
            return
        url = f"{self.worker_url}{path}"
        headers = {"Content-Type": "application/json"}
        if self.worker_token:
            headers["Authorization"] = f"Bearer {self.worker_token}"
        try:
            r = requests.post(url, json=payload or {}, headers=headers, timeout=10)
            if not r.ok:
                log.warning("Worker POST %s → %d %s", path, r.status_code, r.text[:200])
        except requests.RequestException as e:
            log.warning("Worker POST %s error: %s", path, e)

    def chime(self) -> None:
        self._pi_post("/api/chime")

    def dispatch(self, command: dict) -> None:
        action = command.get("action")
        log.info("Dispatching: %s", command)
        if action == "set_timer":
            self._pi_post("/api/timers", {
                "label": command.get("label", "timer"),
                "duration": command.get("duration", 60),
                "source": "voice",
            })
        elif action == "stop":
            self._pi_post("/api/timers/dismiss-all")
        elif action == "navigate":
            self._pi_post("/api/navigate", {
                "page": command.get("page"),
                "view": command.get("view"),
            })
        elif action == "turn_off":
            self._pi_post("/api/tv/off")
        elif action == "turn_on":
            self._pi_post("/api/tv/on")
        elif action == "ask":
            self._worker_post("/api/ask-query", {"query": command.get("query", "")})
        elif action == "none":
            pass
        else:
            log.info("No dispatch for action: %s", action)


# ---------------------------------------------------------------------------
# Main detection loop
# ---------------------------------------------------------------------------

def load_wake_model(model_dir: Path) -> Model:
    """Load openWakeWord with the hey_homer custom model if available."""
    framework = "onnx"  # Apple Silicon: onnxruntime is the best-supported path
    custom = model_dir / "hey_homer.onnx"
    if custom.exists():
        log.info("Loading custom wake-word model: %s", custom)
        return Model(
            wakeword_models=[str(custom)],
            inference_framework=framework,
        )
    log.warning("Custom hey_homer.onnx not found in %s — falling back to hey_jarvis.", model_dir)
    return Model(wakeword_models=["hey_jarvis"], inference_framework=framework)


def cfg(key: str):
    return DEFAULT_CONFIG[key]


def main() -> None:
    parser = argparse.ArgumentParser(description="Home Center voice service (Mac mini)")
    parser.add_argument("--mic-host", default=os.environ.get("MIC_STREAM_HOST", "homecenter.local"))
    parser.add_argument("--mic-port", type=int, default=int(os.environ.get("MIC_STREAM_PORT", "8766")))
    parser.add_argument("--pi-base", default=os.environ.get("PI_COMMAND_URL", "http://homecenter.local:8765"))
    parser.add_argument("--worker-url", default=os.environ.get("WORKER_URL"))
    parser.add_argument("--worker-token", default=os.environ.get("WORKER_TOKEN"))
    parser.add_argument("--model-dir", default=os.environ.get("MODEL_DIR", str(Path(__file__).parent / "models")))
    parser.add_argument("--whisper-model", default=os.environ.get("WHISPER_MODEL", "medium.en"))
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print dispatches instead of POSTing them.")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    model_dir = Path(args.model_dir).expanduser().resolve()
    log.info("Model dir: %s", model_dir)

    # Pre-load Whisper + VAD (first detection should be fast)
    try:
        get_whisper(args.whisper_model)
    except Exception as e:
        log.warning("Could not pre-load Whisper: %s", e)
    try:
        get_silero_vad()
    except Exception as e:
        log.warning("Could not pre-load Silero VAD: %s", e)

    model = load_wake_model(model_dir)
    wake_words = list(model.models.keys())
    log.info("Listening for: %s (threshold=%.2f)", wake_words, cfg("detection_threshold"))

    mic = MicStream(args.mic_host, args.mic_port)
    mic.connect()

    dispatcher = Dispatcher(args.pi_base, args.worker_url, args.worker_token)
    preprocessor = AudioPreprocessor(cutoff_hz=85)

    # Rolling buffer of ~2s of raw audio so we capture "hey homer, open calendar"
    # as a single phrase (the command text usually lands *after* detection fires).
    prebuf_max = int(PREBUFFER_SECONDS * SAMPLE_RATE / CHUNK_SIZE)
    prebuffer = collections.deque(maxlen=prebuf_max)

    last_trigger = 0.0
    last_action = 0.0
    consecutive = {ww: 0 for ww in wake_words}

    log.info("Voice service ready.")

    while True:
        raw = mic.read_chunk()
        prebuffer.append(raw.copy())

        # Preprocess for DNN (filtered), keep raw for Whisper
        processed = preprocessor.process(raw)

        now = time.time()

        if now - last_action < cfg("post_action_mute"):
            model.predict(processed)
            continue

        rms = float(np.sqrt(np.mean(processed.astype(np.float64) ** 2)))
        if rms < cfg("min_rms_energy"):
            model.predict(processed)
            for ww in consecutive:
                consecutive[ww] = 0
            continue

        model.predict(processed)

        for ww_name in wake_words:
            buf = model.prediction_buffer[ww_name]
            if len(buf) == 0:
                continue
            n = min(cfg("score_smooth_window"), len(buf))
            score = float(np.mean(list(buf)[-n:]))

            base = cfg("detection_threshold")
            effective = base * 0.85 if rms > cfg("min_rms_energy") * 4 else base

            if args.debug and score > 0.1:
                log.debug("%s score=%.3f rms=%.0f consec=%d",
                          ww_name, score, rms, consecutive.get(ww_name, 0))

            if score >= effective:
                consecutive[ww_name] = consecutive.get(ww_name, 0) + 1
                if consecutive[ww_name] < cfg("min_consecutive"):
                    continue
                if now - last_trigger < cfg("cooldown_seconds"):
                    continue

                log.info("Wake word '%s' DETECTED (score=%.3f, rms=%.0f)",
                         ww_name, score, rms)
                model.reset()
                for ww in consecutive:
                    consecutive[ww] = 0
                last_trigger = now

                # Capture: 2s prebuffer + 1.5s tail from stream
                pre_audio = (
                    np.concatenate(list(prebuffer)) if prebuffer else np.array([], dtype=np.int16)
                )
                tail_samples = int(TAIL_SECONDS * SAMPLE_RATE)
                tail_chunks: list[np.ndarray] = []
                collected = 0
                while collected < tail_samples:
                    c = mic.read_chunk()
                    tail_chunks.append(c)
                    collected += len(c)
                tail_audio = np.concatenate(tail_chunks)[:tail_samples]
                full_audio = np.concatenate([pre_audio, tail_audio])
                log.info("Captured %.1fs (%.1fs pre + %.1fs tail)",
                         len(full_audio) / SAMPLE_RATE,
                         len(pre_audio) / SAMPLE_RATE, TAIL_SECONDS)

                try:
                    text = transcribe(full_audio, args.whisper_model, initial_prompt="Hey Homer")
                except Exception as e:
                    log.exception("Whisper failed: %s", e)
                    text = ""

                # Two-stage: DNN fires, but we only act if Whisper confirms the
                # wake word in the transcript. Drops false positives silently.
                if not WAKE_CONFIRM_RE.search(text):
                    log.info("Whisper did not confirm wake word in %r — ignoring.", text)
                    last_action = time.time()
                    break

                # Confirmed — chime + dispatch
                if not args.dry_run:
                    threading.Thread(target=dispatcher.chime, daemon=True).start()

                command = parse_command(text)
                if args.dry_run:
                    log.info("[DRY RUN] would dispatch: %s", command)
                else:
                    dispatcher.dispatch(command)

                last_action = time.time()
                break
            else:
                consecutive[ww_name] = 0


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("Shutting down.")
        sys.exit(0)
