#!/usr/bin/env python3
"""Home Center voice service (Mac mini) — Whisper-only, streaming edition.

The openWakeWord DNN was producing too many false positives; this version
drops it entirely and lets Whisper be the sole decision-maker. A rolling
3-second audio window is transcribed every ~700ms. The live transcript is
POSTed to the Pi's `/api/transcription` endpoint so the dashboard can show
on-screen captions. When the transcript matches the wake phrase
(`hey homer` + common Whisper mis-spellings), everything after the phrase
becomes the command — parsed and dispatched.

Why Whisper-only:
  - Whisper is ground-truth for *what was said*, not a proxy signal like a
    DNN. If Whisper doesn't write "hey homer", we don't act. Period.
  - The transcript we'd compute anyway also powers the caption overlay,
    so live transcription is essentially free.
  - No more thresholds to tune or DNNs to retrain.

Pipeline:
  MicStream ──► rolling PCM buffer (~6s) ──┬──► Whisper worker (every ~700ms)
                                           │         │
                                           │         ├── POST /api/transcription
                                           │         │
                                           │         └── if wake phrase match:
                                           │             extract command,
                                           │             POST /api/chime,
                                           │             parse_command,
                                           │             dispatch.
                                           │
                                           └──► RMS gate (don't transcribe silence)
"""

from __future__ import annotations

import argparse
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


SAMPLE_RATE = 16000
CHUNK_SIZE = 1280                  # 80 ms @ 16 kHz — one TCP read increment
WINDOW_SECONDS = 3.0               # rolling window sent to Whisper
WINDOW_SAMPLES = int(SAMPLE_RATE * WINDOW_SECONDS)
TRANSCRIBE_INTERVAL = 0.5          # seconds between Whisper passes
BUFFER_SECONDS = 6.0               # keep this much PCM so Whisper always has material
BUFFER_SAMPLES = int(SAMPLE_RATE * BUFFER_SECONDS)

# Silence gate. Below this RMS over the window we skip Whisper to avoid
# hallucinations on ambient noise.
RMS_GATE = 180.0

# Fallback capture window when the first-pass transcript doesn't already
# contain the command body after the wake phrase. In the happy path the
# user says "Hey Homer, open calendar" in one breath and the whole phrase
# lands in the same 3s window — so we skip this wait entirely and dispatch
# immediately. Only hit when the user pauses after "Hey Homer".
COMMAND_CAPTURE_SECONDS = 1.8

# Recognized command verbs. If the first-pass tail contains any of these we
# trust it and dispatch right away — no post-wake capture needed. These
# mirror the intents parse_command handles.
COMMAND_KEYWORD_RE = re.compile(
    r"\b(open|show|go\s+(to|back|home)|calendar|weather|photo|picture|gallery"
    r"|turn(ed|s)?\s*(it\s+)?(on|off|of|up|down|f)"
    r"|set\s+(a\s+)?timer|remind\s+me|stop|dismiss|cancel|quiet|shut\s+up"
    r"|what|who|where|when|why|how|tell\s+me|explain|describe"
    r"|monthly|weekly|daily|dashboard|home)\b",
    re.IGNORECASE,
)

# Cooldown after a successful wake → dispatch so we don't re-fire on the
# trailing audio of the just-processed command.
POST_ACTION_MUTE = 4.0


# Matches "hey homer" + common Whisper mis-transcriptions. The "hey"/"hi"/"ok"
# prefix is required — bare "homer" no longer triggers (that was 80% of the
# false positives on the old DNN gate).
WAKE_PHRASE_RE = re.compile(
    r"\b(hey|hi|hay|ok)\s+(ho(?:mer|mmer|mar|me[rl]|m'r)|homework|home her|home\s*her|"
    r"comni|jarvis|jervis)\b[,.\s!?:-]*",
    re.IGNORECASE,
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("voice-service")


# ---------------------------------------------------------------------------
# TCP audio stream reader
# ---------------------------------------------------------------------------

class MicStream:
    """Reader for the Pi's mic_streamer TCP stream. Reconnects on disconnect."""

    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.sock: socket.socket | None = None
        self.buf = bytearray()

    def connect(self) -> None:
        while True:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(8)  # timeout for TCP connect()
                log.info("Connecting to mic stream %s:%d", self.host, self.port)
                s.connect((self.host, self.port))
                # Post-connect: long recv timeout. We rely on TCP keepalive
                # for dead-peer detection, not this. PipeWire's pulse PCM can
                # take a couple seconds to ramp up the first capture — 10s
                # was too tight; 60s gives plenty of slack.
                s.settimeout(60)
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


def get_whisper(model_name: str):
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        log.info("Loading faster-whisper '%s' (int8)...", model_name)
        _whisper_model = WhisperModel(model_name, compute_type="int8", device="cpu")
        log.info("Whisper loaded.")
    return _whisper_model


def transcribe_window(audio: np.ndarray, model_name: str) -> str:
    """Transcribe a raw int16 audio window. Returns empty on failure."""
    model = get_whisper(model_name)
    audio_f32 = audio.astype(np.float32) / 32768.0
    audio_f32 = audio_f32 - np.mean(audio_f32)
    try:
        segments, _ = model.transcribe(
            audio_f32,
            beam_size=1,                 # fast; we can afford to re-transcribe often
            language="en",
            condition_on_previous_text=False,  # each window is independent
            no_speech_threshold=0.65,
            vad_filter=True,             # silero built-in — cuts silence regions
            vad_parameters={"min_silence_duration_ms": 300},
            initial_prompt="Hey Homer",  # bias toward hearing the wake word
        )
        return " ".join(seg.text.strip() for seg in segments).strip()
    except Exception as e:
        log.exception("Whisper transcribe failed: %s", e)
        return ""


# ---------------------------------------------------------------------------
# Command parsing
# ---------------------------------------------------------------------------

def parse_command(text: str) -> dict:
    """Parse the text *after* the wake phrase into a command dict."""
    text = text.lower().strip()
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

    log.info("No command matched in %r, ignoring.", text)
    return {"action": "none"}


# ---------------------------------------------------------------------------
# HTTP dispatch (Pi command server + Cloudflare worker)
# ---------------------------------------------------------------------------

class Dispatcher:
    def __init__(self, pi_base: str, worker_url: str | None, worker_token: str | None):
        self.pi_base = pi_base.rstrip("/")
        self.worker_url = worker_url.rstrip("/") if worker_url else None
        self.worker_token = worker_token

    def _pi_post(self, path: str, payload: dict | None = None, timeout: float = 4.0) -> None:
        url = f"{self.pi_base}{path}"
        try:
            r = requests.post(url, json=payload or {}, timeout=timeout)
            if not r.ok:
                log.warning("Pi POST %s → %d %s", path, r.status_code, r.text[:200])
        except requests.RequestException as e:
            log.warning("Pi POST %s error: %s", path, e)

    def _worker_post(self, path: str, payload: dict | None = None) -> None:
        if not self.worker_url:
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
        self._pi_post("/api/chime", timeout=2.0)

    def transcription(self, text: str, is_wake: bool = False) -> None:
        self._pi_post(
            "/api/transcription",
            {"text": text, "is_wake": is_wake, "ts": time.time()},
            timeout=1.5,
        )

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


# ---------------------------------------------------------------------------
# Main streaming loop
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Home Center voice service (Mac mini)")
    parser.add_argument("--mic-host", default=os.environ.get("MIC_STREAM_HOST", "homecenter.local"))
    parser.add_argument("--mic-port", type=int, default=int(os.environ.get("MIC_STREAM_PORT", "8766")))
    parser.add_argument("--pi-base", default=os.environ.get("PI_COMMAND_URL", "http://homecenter.local:8765"))
    parser.add_argument("--worker-url", default=os.environ.get("WORKER_URL"))
    parser.add_argument("--worker-token", default=os.environ.get("WORKER_TOKEN"))
    parser.add_argument("--whisper-model", default=os.environ.get("WHISPER_MODEL", "medium.en"))
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print dispatches + transcripts instead of POSTing them.")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    get_whisper(args.whisper_model)

    mic = MicStream(args.mic_host, args.mic_port)
    mic.connect()

    dispatcher = Dispatcher(args.pi_base, args.worker_url, args.worker_token)

    # Shared rolling buffer. Reader thread appends mic chunks; main loop
    # reads the last WINDOW_SAMPLES for each Whisper pass.
    buf = np.zeros(BUFFER_SAMPLES, dtype=np.int16)
    buf_lock = threading.Lock()
    state = {"last_action_time": 0.0, "last_posted_text": "", "buf": buf}

    def reader():
        while True:
            chunk = mic.read_chunk()
            with buf_lock:
                state["buf"] = np.concatenate([state["buf"][len(chunk):], chunk])

    threading.Thread(target=reader, daemon=True).start()

    log.info("Voice service ready. Whisper-only streaming mode.")
    log.info("Wake phrase: %s", WAKE_PHRASE_RE.pattern)

    while True:
        t0 = time.time()

        # Post-action mute — don't let the tail of our own command audio
        # feed back in as speech.
        if time.time() - state["last_action_time"] < POST_ACTION_MUTE:
            time.sleep(TRANSCRIBE_INTERVAL)
            continue

        with buf_lock:
            window = state["buf"][-WINDOW_SAMPLES:].copy()

        # RMS gate — skip Whisper on silence. ~180 is "quiet room" on XVF3800.
        rms = float(np.sqrt(np.mean(window.astype(np.float64) ** 2)))
        if rms < RMS_GATE:
            # Periodic heartbeat so "is the stream alive?" is obvious in the log.
            if int(time.time()) % 5 == 0:
                log.info("idle (rms=%.0f < gate=%d)", rms, RMS_GATE)
            time.sleep(TRANSCRIBE_INTERVAL)
            continue

        text = transcribe_window(window, args.whisper_model)
        if not text:
            time.sleep(max(0.0, TRANSCRIBE_INTERVAL - (time.time() - t0)))
            continue

        wake_hit = WAKE_PHRASE_RE.search(text)

        # Push transcript for the on-screen caption overlay (only when changed).
        if text != state["last_posted_text"]:
            if args.dry_run:
                log.info("[DRY RUN] caption: %r (wake=%s)", text, bool(wake_hit))
            else:
                threading.Thread(
                    target=dispatcher.transcription,
                    args=(text, bool(wake_hit)),
                    daemon=True,
                ).start()
            state["last_posted_text"] = text
            log.info("[%.0f rms] %s%s", rms, "★ " if wake_hit else "  ", text)

        if wake_hit:
            first_pass_tail = text[wake_hit.end():].strip(" ,.:;!?-")
            log.info("Wake phrase matched. first-pass tail=%r", first_pass_tail)

            if not args.dry_run:
                threading.Thread(target=dispatcher.chime, daemon=True).start()

            # Mark "listening" on the dashboard immediately (parallel POST).
            threading.Thread(
                target=dispatcher.transcription,
                args=(text, True),
                daemon=True,
            ).start()

            # Speculative dispatch: if the first-pass tail already contains
            # a recognizable command verb, trust it and act immediately —
            # skip the post-wake capture wait. This is the common case
            # ("Hey Homer, open calendar" said in one breath).
            if first_pass_tail and COMMAND_KEYWORD_RE.search(first_pass_tail):
                body = first_pass_tail
                log.info("Fast path: first-pass tail contains command. body=%r", body)
            else:
                # Fallback: the first window only caught "Hey Homer" — wait
                # for more audio, then transcribe that.
                time.sleep(COMMAND_CAPTURE_SECONDS)
                need = int(COMMAND_CAPTURE_SECONDS * SAMPLE_RATE)
                with buf_lock:
                    command_window = state["buf"][-need:].copy()

                command_text = transcribe_window(command_window, args.whisper_model)
                log.info("Command window transcript: %r", command_text)

                m = WAKE_PHRASE_RE.search(command_text)
                body = command_text[m.end():] if m else command_text
                body = body.strip(" ,.:;!?-")

                # Last resort: if the fresh capture was empty (Whisper VAD
                # over-trimmed), fall back to the first-pass tail.
                if not body and first_pass_tail:
                    body = first_pass_tail

            log.info("Dispatch body: %r", body)

            # Push the final command to the caption overlay so the user sees
            # what the system heard.
            threading.Thread(
                target=dispatcher.transcription,
                args=(f"Hey Homer, {body}" if body else "Hey Homer", True),
                daemon=True,
            ).start()

            command = parse_command(body)
            if args.dry_run:
                log.info("[DRY RUN] would dispatch: %s", command)
            else:
                dispatcher.dispatch(command)

            state["last_action_time"] = time.time()
            # Clear the buffer so the just-heard phrase doesn't re-fire.
            with buf_lock:
                state["buf"] = np.zeros(BUFFER_SAMPLES, dtype=np.int16)
            state["last_posted_text"] = ""
            continue

        elapsed = time.time() - t0
        time.sleep(max(0.0, TRANSCRIBE_INTERVAL - elapsed))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("Shutting down.")
        sys.exit(0)
