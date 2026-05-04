#!/usr/bin/env python3
"""Home Center voice service.

The wake gate is Vosk/Kaldi, not Whisper. Vosk is used only as a local,
non-generative keyword recognizer; Whisper runs after wake for command text.
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
from collections import deque
from collections.abc import Callable
from pathlib import Path

import numpy as np
import requests

from intent import COMMAND_KEYWORD_RE, WAKE_PHRASE_RE, is_dispatchable_command, parse_command


def env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


SAMPLE_RATE = 16000
CHUNK_SIZE = 1280
BUFFER_SECONDS = 8.0
BUFFER_SAMPLES = int(SAMPLE_RATE * BUFFER_SECONDS)
PRE_WAKE_SECONDS = float(os.environ.get("PRE_WAKE_SECONDS", "3.2"))
COMMAND_MAX_SECONDS = 1.6
COMMAND_MIN_SECONDS = 0.35
POST_WAKE_SILENCE_SECONDS = 0.25
WAKE_CONFIRM_COMMAND = env_flag("WAKE_CONFIRM_COMMAND", False)
CONFIRM_MULTI_COMMAND_DISPATCH = env_flag("CONFIRM_MULTI_COMMAND_DISPATCH", False)
CONFIRM_PRE_WAKE_SECONDS = float(os.environ.get("CONFIRM_PRE_WAKE_SECONDS", "5.0"))
CONFIRM_POST_WAKE_SECONDS = float(os.environ.get("CONFIRM_POST_WAKE_SECONDS", "2.0"))
CONFIRM_MIN_POST_WAKE_SECONDS = float(os.environ.get("CONFIRM_MIN_POST_WAKE_SECONDS", "0.8"))
CONFIRM_POST_WAKE_SILENCE_SECONDS = float(os.environ.get("CONFIRM_POST_WAKE_SILENCE_SECONDS", "0.45"))
POST_ACTION_MUTE = float(os.environ.get("POST_ACTION_MUTE_SECONDS", "3.0"))
OPENWAKEWORD_RECENT_RMS_SECONDS = float(os.environ.get("OPENWAKEWORD_RECENT_RMS_SECONDS", "2.8"))
OPENWAKEWORD_MIN_RECENT_PEAK_RMS = float(os.environ.get("OPENWAKEWORD_MIN_RECENT_PEAK_RMS", "450"))
OPENWAKEWORD_MIN_ACTIVE_CHUNKS = int(os.environ.get("OPENWAKEWORD_MIN_ACTIVE_CHUNKS", "2"))
OPENWAKEWORD_MIN_ACTIVE_RMS = float(os.environ.get("OPENWAKEWORD_MIN_ACTIVE_RMS", "180"))
OPENWAKEWORD_ACTIVE_RMS_MULTIPLIER = float(os.environ.get("OPENWAKEWORD_ACTIVE_RMS_MULTIPLIER", "1.8"))
OPENWAKEWORD_AUDIO_HEARTBEAT_SECONDS = float(os.environ.get("OPENWAKEWORD_AUDIO_HEARTBEAT_SECONDS", "2.0"))
OPENWAKEWORD_AUDIO_LOG_MIN_RMS = float(os.environ.get("OPENWAKEWORD_AUDIO_LOG_MIN_RMS", "180"))
OPENWAKEWORD_AUDIO_LOG_INTERVAL_SECONDS = float(os.environ.get("OPENWAKEWORD_AUDIO_LOG_INTERVAL_SECONDS", "1.0"))
OPENWAKEWORD_SCORE_LOG_MIN = float(os.environ.get("OPENWAKEWORD_SCORE_LOG_MIN", "0.20"))
OPENWAKEWORD_SCORE_LOG_INTERVAL_SECONDS = float(os.environ.get("OPENWAKEWORD_SCORE_LOG_INTERVAL_SECONDS", "0.5"))
OPENWAKEWORD_SEGMENT_END_SILENCE_SECONDS = float(os.environ.get("OPENWAKEWORD_SEGMENT_END_SILENCE_SECONDS", "0.8"))
OPENWAKEWORD_EMPTY_CONFIRM_COOLDOWN_SECONDS = float(
    os.environ.get("OPENWAKEWORD_EMPTY_CONFIRM_COOLDOWN_SECONDS", "4.0")
)
SPEECH_CANDIDATE_END_SILENCE_SECONDS = float(os.environ.get("SPEECH_CANDIDATE_END_SILENCE_SECONDS", "0.65"))
SPEECH_CANDIDATE_COOLDOWN_SECONDS = float(os.environ.get("SPEECH_CANDIDATE_COOLDOWN_SECONDS", "0.5"))
SPEECH_CANDIDATE_MIN_PEAK_RMS = float(os.environ.get("SPEECH_CANDIDATE_MIN_PEAK_RMS", "450"))
SPEECH_CANDIDATE_MIN_ACTIVE_CHUNKS = int(os.environ.get("SPEECH_CANDIDATE_MIN_ACTIVE_CHUNKS", "3"))
SPEECH_CANDIDATE_MIN_ACTIVE_RMS = float(os.environ.get("SPEECH_CANDIDATE_MIN_ACTIVE_RMS", "180"))
SPEECH_CANDIDATE_ACTIVE_RMS_MULTIPLIER = float(os.environ.get("SPEECH_CANDIDATE_ACTIVE_RMS_MULTIPLIER", "1.8"))
SPEECH_CANDIDATE_MIN_SEGMENT_SECONDS = float(os.environ.get("SPEECH_CANDIDATE_MIN_SEGMENT_SECONDS", "0.3"))
SPEECH_CANDIDATE_PRE_ROLL_SECONDS = float(os.environ.get("SPEECH_CANDIDATE_PRE_ROLL_SECONDS", "0.45"))
SPEECH_CANDIDATE_EMIT_VERIFYING = env_flag("SPEECH_CANDIDATE_EMIT_VERIFYING", False)
SPEECH_CANDIDATE_MAX_SEGMENT_SECONDS = float(os.environ.get("SPEECH_CANDIDATE_MAX_SEGMENT_SECONDS", "6.0"))
SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS = float(
    os.environ.get("SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS", "12.0")
)
SPEECH_CANDIDATE_EMPTY_BACKOFF_SECONDS = float(os.environ.get("SPEECH_CANDIDATE_EMPTY_BACKOFF_SECONDS", "0.0"))
SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_PEAK_RMS = float(
    os.environ.get("SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_PEAK_RMS", "2000")
)
SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_ACTIVE_CHUNKS = int(
    os.environ.get("SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_ACTIVE_CHUNKS", "12")
)
WHISPER_NO_SPEECH_THRESHOLD = float(os.environ.get("WHISPER_NO_SPEECH_THRESHOLD", "0.45"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("voice-service")

LOCAL_STT_ENGINES = {"speech", "always-stt"}

CONFIRM_WAKE_PHRASE_RE = re.compile(
    rf"(?:{WAKE_PHRASE_RE.pattern})|"
    r"\b(?:day|they|eight|ate|8)[\s,.\-!?:]+"
    r"(?:ho(?:mer|mmer|mar|me[rl])|homer|home\s*her)\b[,.\s!?:-]*|"
    r"\b(?:eight|ate|8)[\s\-]*homer\b[,.\s!?:-]*",
    re.IGNORECASE,
)


class MicStream:
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.sock: socket.socket | None = None
        self.buf = bytearray()

    def connect(self) -> None:
        while True:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(8)
                log.info("Connecting to mic stream %s:%d", self.host, self.port)
                sock.connect((self.host, self.port))
                sock.settimeout(60)
                sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
                self.sock = sock
                self.buf.clear()
                log.info("Mic stream connected.")
                return
            except (socket.timeout, ConnectionRefusedError, OSError) as e:
                log.warning("Mic stream connect failed (%s). Retrying in 3s...", e)
                time.sleep(3)

    def read_chunk(self) -> np.ndarray:
        need = CHUNK_SIZE * 2
        while len(self.buf) < need:
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
        chunk = bytes(self.buf[:need])
        del self.buf[:need]
        return np.frombuffer(chunk, dtype=np.int16)

    def _reset(self) -> None:
        try:
            if self.sock:
                self.sock.close()
        except Exception:
            pass
        self.sock = None
        self.buf.clear()


class RollingAudio:
    def __init__(self):
        self._buf = np.zeros(BUFFER_SAMPLES, dtype=np.int16)
        self._lock = threading.Lock()

    def append(self, chunk: np.ndarray) -> None:
        with self._lock:
            self._buf = np.concatenate([self._buf[len(chunk):], chunk])

    def tail(self, seconds: float) -> np.ndarray:
        n = int(seconds * SAMPLE_RATE)
        with self._lock:
            return self._buf[-n:].copy()


class VoskWakeDetector:
    def __init__(self, model_dir: Path, cooldown: float):
        import vosk

        self.name = f"vosk:{model_dir.name}"
        vosk.SetLogLevel(-1)
        self.model = vosk.Model(str(model_dir))
        self.cooldown = cooldown
        self.last_hit = 0.0
        self.last_partial = ""
        self._reset()

    def _reset(self) -> None:
        from vosk import KaldiRecognizer

        self.recognizer = KaldiRecognizer(self.model, SAMPLE_RATE)
        self.last_partial = ""

    def accept(self, chunk: np.ndarray) -> tuple[bool, str, str]:
        import json

        hit_text = ""
        source = "partial"
        data = chunk.astype(np.int16, copy=False).tobytes()
        if self.recognizer.AcceptWaveform(data):
            text = json.loads(self.recognizer.Result()).get("text", "")
            source = "final"
        else:
            text = json.loads(self.recognizer.PartialResult()).get("partial", "")
            if text == self.last_partial:
                return False, "", source
            self.last_partial = text

        if text and WAKE_PHRASE_RE.search(text):
            now = time.time()
            if now - self.last_hit >= self.cooldown:
                self.last_hit = now
                hit_text = text
                self._reset()
                return True, hit_text, source
        return False, text, source


class OpenWakeWordWakeDetector:
    """Purpose-built wake DNN path for Hey Homer models.

    This keeps the same detector contract as Vosk so the service can switch
    engines without changing mic streaming, command capture, or dispatch.
    """

    def __init__(
        self,
        model_path: Path,
        cooldown: float,
        threshold: float,
        min_consecutive: int,
        verifier_path: Path | None = None,
        vad_threshold: float = 0.0,
    ):
        if not model_path.exists():
            raise SystemExit(f"openWakeWord model not found: {model_path}")

        from openwakeword.model import Model

        model_name = model_path.stem
        custom_verifiers = {}
        if verifier_path and verifier_path.exists():
            custom_verifiers[model_name] = str(verifier_path)

        self.model = Model(
            wakeword_models=[str(model_path)],
            inference_framework="onnx",
            custom_verifier_models=custom_verifiers,
            vad_threshold=vad_threshold,
        )
        self.name = f"openwakeword:{model_name}"
        self.model_name = model_name
        self.cooldown = cooldown
        self.threshold = threshold
        self.min_consecutive = min_consecutive
        self.consecutive = 0
        self.last_hit = 0.0
        self.last_score = 0.0

    def accept(self, chunk: np.ndarray) -> tuple[bool, str, str]:
        predictions = self.model.predict(chunk.astype(np.int16, copy=False))
        score = max((float(v) for v in predictions.values()), default=0.0)
        self.last_score = score
        if score >= self.threshold:
            self.consecutive += 1
        else:
            self.consecutive = 0

        if self.consecutive >= self.min_consecutive:
            now = time.time()
            if now - self.last_hit >= self.cooldown:
                self.last_hit = now
                self.consecutive = 0
                self.model.reset()
                return True, "Hey Homer", f"dnn:{self.model_name}:{score:.3f}"

        return False, "", "dnn"

    def reject_last_hit(self) -> None:
        """Undo cooldown when a second-stage gate rejects the DNN hit."""
        self.last_hit = 0.0


class SpeechCandidateDetector:
    """RMS speech-segment candidate source for confirmed-command trials.

    This is not a wake detector. It only decides when a local speech segment is
    worth sending to Whisper; the transcript must still contain the wake phrase
    and a dispatchable command before any action runs.
    """

    def __init__(
        self,
        cooldown: float,
        end_silence_seconds: float,
        min_peak_rms: float,
        min_active_chunks: int,
        min_active_rms: float,
        active_rms_multiplier: float,
        min_segment_seconds: float,
        pre_roll_seconds: float,
        max_segment_seconds: float,
        name: str = "speech-segment",
    ):
        self.name = name
        self.cooldown = cooldown
        self.end_silence_seconds = end_silence_seconds
        self.min_peak_rms = min_peak_rms
        self.min_active_chunks = min_active_chunks
        self.min_active_rms = min_active_rms
        self.active_rms_multiplier = active_rms_multiplier
        self.min_segment_seconds = min_segment_seconds
        self.max_segment_seconds = max_segment_seconds
        self.chunk_seconds = CHUNK_SIZE / SAMPLE_RATE
        self.pre_roll_chunks = deque(maxlen=max(0, int(pre_roll_seconds / self.chunk_seconds)))
        self._segment_chunks: list[np.ndarray] = []
        self.last_segment_audio = np.array([], dtype=np.int16)
        self.noise = 100.0
        self.last_hit = 0.0
        self._reset_segment()

    def _reset_segment(self) -> None:
        self.active = False
        self.quiet_seconds = 0.0
        self.segment_seconds = 0.0
        self.active_chunks = 0
        self.peak_rms = 0.0
        self.last_gate = self.min_active_rms
        self._segment_chunks = []

    def accept(self, chunk: np.ndarray) -> tuple[bool, str, str]:
        chunk_copy = chunk.astype(np.int16, copy=True)
        chunk_rms = rms(chunk)
        gate = active_speech_gate(self.noise, self.min_active_rms, self.active_rms_multiplier)
        self.noise = update_noise_floor(self.noise, chunk_rms, gate)
        gate = active_speech_gate(self.noise, self.min_active_rms, self.active_rms_multiplier)
        self.last_gate = gate

        if chunk_rms >= gate:
            if not self.active:
                self._segment_chunks = list(self.pre_roll_chunks)
            self.active = True
            self.quiet_seconds = 0.0
            self.segment_seconds += self.chunk_seconds
            self.active_chunks += 1
            self.peak_rms = max(self.peak_rms, chunk_rms)
            self._segment_chunks.append(chunk_copy)
            if self.max_segment_seconds > 0 and self.segment_seconds >= self.max_segment_seconds:
                return self._finish_segment(gate, reason="max")
            return False, "", "speech"

        if not self.active:
            self.pre_roll_chunks.append(chunk_copy)
            return False, "", "speech"

        self.quiet_seconds += self.chunk_seconds
        self.segment_seconds += self.chunk_seconds
        self._segment_chunks.append(chunk_copy)
        if self.quiet_seconds < self.end_silence_seconds:
            return False, "", "speech"

        return self._finish_segment(gate, reason="silence")

    def _finish_segment(self, gate: float, reason: str) -> tuple[bool, str, str]:
        now = time.time()
        hit = (
            now - self.last_hit >= self.cooldown
            and self.peak_rms >= self.min_peak_rms
            and self.active_chunks >= self.min_active_chunks
            and self.segment_seconds >= self.min_segment_seconds
        )
        source = (
            f"speech:peak={self.peak_rms:.0f}:active={self.active_chunks}:"
            f"duration={self.segment_seconds:.1f}:gate={gate:.0f}:reason={reason}"
        )
        self.last_segment_audio = (
            np.concatenate(self._segment_chunks) if hit and self._segment_chunks else np.array([], dtype=np.int16)
        )
        self._reset_segment()
        if hit:
            self.last_hit = now
            return True, "", source
        return False, "", "speech"

    def consume_last_segment_audio(self) -> np.ndarray:
        audio = self.last_segment_audio.copy()
        self.last_segment_audio = np.array([], dtype=np.int16)
        return audio


def is_local_stt_engine(wake_engine: str) -> bool:
    return wake_engine in LOCAL_STT_ENGINES


def validate_wake_mode_config(wake_engine: str, wake_confirm_command: bool) -> None:
    if is_local_stt_engine(wake_engine) and not wake_confirm_command:
        raise SystemExit(f"WAKE_ENGINE={wake_engine} requires WAKE_CONFIRM_COMMAND=1")


def build_wake_detector(args) -> VoskWakeDetector | OpenWakeWordWakeDetector | SpeechCandidateDetector:
    if args.wake_engine == "openwakeword":
        verifier_path = Path(args.openwakeword_verifier) if args.openwakeword_verifier else None
        return OpenWakeWordWakeDetector(
            Path(args.openwakeword_model),
            cooldown=args.cooldown,
            threshold=args.openwakeword_threshold,
            min_consecutive=args.openwakeword_min_consecutive,
            verifier_path=verifier_path,
            vad_threshold=args.openwakeword_vad_threshold,
        )
    if is_local_stt_engine(args.wake_engine):
        return SpeechCandidateDetector(
            cooldown=args.speech_candidate_cooldown_seconds,
            end_silence_seconds=args.speech_candidate_end_silence_seconds,
            min_peak_rms=args.speech_candidate_min_peak_rms,
            min_active_chunks=args.speech_candidate_min_active_chunks,
            min_active_rms=args.speech_candidate_min_active_rms,
            active_rms_multiplier=args.speech_candidate_active_rms_multiplier,
            min_segment_seconds=args.speech_candidate_min_segment_seconds,
            pre_roll_seconds=args.speech_candidate_pre_roll_seconds,
            max_segment_seconds=args.speech_candidate_max_segment_seconds,
            name="always-stt" if args.wake_engine == "always-stt" else "speech-segment",
        )

    vosk_model_dir = Path(args.vosk_model_dir)
    if not vosk_model_dir.exists():
        raise SystemExit(f"Vosk model not found: {vosk_model_dir}")
    return VoskWakeDetector(vosk_model_dir, args.cooldown)


_whisper_model = None


def get_whisper(model_name: str):
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel

        log.info("Loading faster-whisper '%s' (int8)...", model_name)
        _whisper_model = WhisperModel(model_name, compute_type="int8", device="cpu")
        log.info("Whisper loaded.")
    return _whisper_model


def transcribe(audio: np.ndarray, model_name: str, no_speech_threshold: float = WHISPER_NO_SPEECH_THRESHOLD) -> str:
    model = get_whisper(model_name)
    if len(audio) == 0:
        return ""
    audio_f32 = audio.astype(np.float32)
    audio_f32 = audio_f32 - np.mean(audio_f32)
    audio_f32 = audio_f32 / 32768.0
    segments, _ = model.transcribe(
        audio_f32,
        beam_size=1,
        language="en",
        condition_on_previous_text=False,
        no_speech_threshold=no_speech_threshold,
        vad_filter=False,
        initial_prompt=(
            "Hey Homer, turn on. Hey Homer, open calendar. "
            "Hey Homer, show the weather. Hey Homer, set a timer for ten seconds. "
            "Hey Homer, stop. Turn off."
        ),
    )
    return " ".join(seg.text.strip() for seg in segments).strip()


def rms(audio: np.ndarray) -> float:
    if len(audio) == 0:
        return 0.0
    return float(np.sqrt(np.mean(audio.astype(np.float64) ** 2)))


def recent_speech_stats(
    recent_rms: list[float] | deque[float],
    noise_floor: float,
    min_active_rms: float,
    active_rms_multiplier: float,
) -> dict:
    values = list(recent_rms)
    gate = max(min_active_rms, noise_floor * active_rms_multiplier)
    peak = max(values) if values else 0.0
    active_chunks = sum(1 for value in values if value >= gate)
    return {"gate": gate, "peak": peak, "active_chunks": active_chunks}


def passes_recent_speech_gate(stats: dict, min_peak_rms: float, min_active_chunks: int) -> bool:
    return stats["peak"] >= min_peak_rms and stats["active_chunks"] >= min_active_chunks


def active_speech_gate(noise_floor: float, min_active_rms: float, active_rms_multiplier: float) -> float:
    return max(min_active_rms, noise_floor * active_rms_multiplier)


def update_noise_floor(noise_floor: float, chunk_rms: float, active_gate: float) -> float:
    """Track ambient noise without learning active speech as the floor."""
    if chunk_rms >= active_gate:
        return noise_floor
    target = min(chunk_rms, noise_floor * 3)
    return 0.995 * noise_floor + 0.005 * target


def should_log_openwakeword_score(
    score: float,
    stats: dict,
    min_score: float,
    min_active_chunks: int,
    now: float,
    last_logged_at: float,
    interval_seconds: float,
) -> bool:
    if score < min_score:
        return False
    if stats["active_chunks"] < min_active_chunks:
        return False
    return now - last_logged_at >= interval_seconds


def should_log_openwakeword_audio(
    stats: dict,
    min_recent_peak_rms: float,
    now: float,
    last_logged_at: float,
    interval_seconds: float,
) -> bool:
    if stats["peak"] < min_recent_peak_rms and stats["active_chunks"] <= 0:
        return False
    return now - last_logged_at >= interval_seconds


class SpeechSegmentDebounce:
    def __init__(self, silence_seconds: float):
        self.silence_seconds = silence_seconds
        self.active = False
        self.quiet_seconds = 0.0
        self.confirmed_in_segment = False
        self.cooldown_until = 0.0

    def update(self, chunk_rms: float, speech_gate: float, chunk_seconds: float) -> None:
        if chunk_rms >= speech_gate:
            self.active = True
            self.quiet_seconds = 0.0
            return

        if not self.active:
            return

        self.quiet_seconds += chunk_seconds
        if self.quiet_seconds >= self.silence_seconds:
            self.active = False
            self.quiet_seconds = 0.0
            self.confirmed_in_segment = False

    def can_confirm(self, now: float) -> bool:
        return not self.confirmed_in_segment and now >= self.cooldown_until

    def mark_confirmed(self, now: float, empty: bool, empty_cooldown_seconds: float) -> None:
        self.confirmed_in_segment = self.active
        if empty:
            self.cooldown_until = max(self.cooldown_until, now + empty_cooldown_seconds)


class AudioActivityHeartbeat:
    def __init__(self, interval_seconds: float):
        self.interval_seconds = interval_seconds
        self.window_started_at = time.time()
        self.chunks = 0
        self.rms_sum = 0.0
        self.max_rms = 0.0

    def record(self, chunk_rms: float) -> None:
        self.chunks += 1
        self.rms_sum += chunk_rms
        self.max_rms = max(self.max_rms, chunk_rms)

    def should_log(self, now: float) -> bool:
        return self.interval_seconds > 0 and self.chunks > 0 and now - self.window_started_at >= self.interval_seconds

    def snapshot_and_reset(self, now: float) -> dict:
        snapshot = {
            "window": now - self.window_started_at,
            "chunks": self.chunks,
            "max_rms": self.max_rms,
            "avg_rms": self.rms_sum / self.chunks if self.chunks else 0.0,
        }
        self.window_started_at = now
        self.chunks = 0
        self.rms_sum = 0.0
        self.max_rms = 0.0
        return snapshot


class Dispatcher:
    def __init__(self, pi_base: str, worker_url: str | None, worker_token: str | None, dry_run: bool):
        self.pi_base = pi_base.rstrip("/")
        self.worker_url = worker_url.rstrip("/") if worker_url else None
        self.worker_token = worker_token
        self.dry_run = dry_run

    def _pi_post(self, path: str, payload: dict | None = None, timeout: float = 4.0) -> None:
        if self.dry_run:
            log.info("[DRY RUN] Pi POST %s %s", path, payload or {})
            return
        try:
            r = requests.post(f"{self.pi_base}{path}", json=payload or {}, timeout=timeout)
            if not r.ok:
                log.warning("Pi POST %s -> %d %s", path, r.status_code, r.text[:200])
        except requests.RequestException as e:
            log.warning("Pi POST %s error: %s", path, e)

    def _worker_post(self, path: str, payload: dict | None = None) -> None:
        if not self.worker_url:
            return
        if self.dry_run:
            log.info("[DRY RUN] Worker POST %s %s", path, payload or {})
            return
        headers = {"Content-Type": "application/json"}
        if self.worker_token:
            headers["Authorization"] = f"Bearer {self.worker_token}"
        try:
            r = requests.post(f"{self.worker_url}{path}", json=payload or {}, headers=headers, timeout=10)
            if not r.ok:
                log.warning("Worker POST %s -> %d %s", path, r.status_code, r.text[:200])
        except requests.RequestException as e:
            log.warning("Worker POST %s error: %s", path, e)

    def chime(self, wake_score: float) -> None:
        start = time.time()
        self._pi_post("/api/chime", {"wakeScore": wake_score}, timeout=2.0)
        log.info("Chime request completed in %.0fms", (time.time() - start) * 1000)

    def transcription(self, text: str, is_wake: bool, **extra) -> None:
        payload = {"text": text, "is_wake": is_wake, "ts": time.time(), **extra}
        self._pi_post("/api/transcription", payload, timeout=1.5)

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
            self._pi_post("/api/navigate", {"page": command.get("page"), "view": command.get("view")})
        elif action == "turn_off":
            self._pi_post("/api/tv/off")
        elif action == "turn_on":
            self._pi_post("/api/tv/on")
        elif action == "ask":
            self._worker_post("/api/ask-query", {"query": command.get("query", "")})


def capture_command(
    mic: MicStream,
    rolling: RollingAudio,
    noise_floor: float,
    pre_audio: np.ndarray | None = None,
    max_post_seconds: float = COMMAND_MAX_SECONDS,
    min_post_seconds: float = COMMAND_MIN_SECONDS,
    silence_seconds: float = POST_WAKE_SILENCE_SECONDS,
    on_chunk: Callable[[np.ndarray, float], None] | None = None,
) -> tuple[np.ndarray, float]:
    chunks: list[np.ndarray] = []
    if pre_audio is not None and len(pre_audio):
        chunks.append(pre_audio)

    post_samples = 0
    silence_started_at: int | None = None
    silence_gate = max(240.0, noise_floor * 1.7)
    max_post_samples = int(max_post_seconds * SAMPLE_RATE)

    while post_samples < max_post_samples:
        chunk = mic.read_chunk()
        rolling.append(chunk)
        chunks.append(chunk)
        post_samples += len(chunk)
        elapsed = post_samples / SAMPLE_RATE
        chunk_rms = rms(chunk)
        if on_chunk is not None:
            on_chunk(chunk, chunk_rms)
        if elapsed >= min_post_seconds and chunk_rms < silence_gate:
            if silence_started_at is None:
                silence_started_at = post_samples
            elif (post_samples - silence_started_at) / SAMPLE_RATE >= silence_seconds:
                break
        else:
            silence_started_at = None

    audio = np.concatenate(chunks) if chunks else np.array([], dtype=np.int16)
    return audio, post_samples / SAMPLE_RATE


def command_body_from_transcript(text: str, prefer_last_wake: bool = False, wake_re=WAKE_PHRASE_RE) -> str:
    matches = list(wake_re.finditer(text))
    if matches:
        match = matches[-1] if prefer_last_wake else matches[0]
        return text[match.end():].strip(" ,.:;!?-")
    return text.strip(" ,.:;!?-")


def command_from_transcript(
    text: str,
    fallback_text: str = "",
    allow_bare_ask: bool = True,
) -> tuple[str, dict]:
    """Extract a command-shaped payload from local STT text."""
    body = command_body_from_transcript(text, prefer_last_wake=True)
    if not body and fallback_text and COMMAND_KEYWORD_RE.search(fallback_text):
        body = command_body_from_transcript(fallback_text, prefer_last_wake=True)
    if not body and text and COMMAND_KEYWORD_RE.search(text):
        body = text.strip(" ,.:;!?-")

    return body, parse_command(body, allow_bare_ask=allow_bare_ask)


def dispatchable_commands_from_transcript(
    text: str,
    fallback_text: str = "",
    require_wake_phrase: bool = False,
    wake_re=WAKE_PHRASE_RE,
    allow_bare_ask: bool = True,
) -> list[dict]:
    """Return all dispatchable command bodies heard in one STT transcript."""
    candidates: list[dict] = []

    def add_candidate(body: str) -> None:
        command = parse_command(body, allow_bare_ask=allow_bare_ask)
        if is_dispatchable_command(command):
            candidates.append({"body": body, "command": command})

    matches = list(wake_re.finditer(text))
    if matches:
        prefix = text[:matches[0].start()].strip(" ,.:;!?-")
        clipped_wake_prefix = prefix.lower().startswith(("homer", "home her", "homework"))
        if prefix and COMMAND_KEYWORD_RE.search(prefix) and (not require_wake_phrase or clipped_wake_prefix):
            add_candidate(prefix)
        for index, match in enumerate(matches):
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            body = text[match.end():end].strip(" ,.:;!?-")
            add_candidate(body)
    else:
        if require_wake_phrase:
            return []
        body, command = command_from_transcript(
            text,
            fallback_text=fallback_text,
            allow_bare_ask=allow_bare_ask,
        )
        if is_dispatchable_command(command):
            candidates.append({"body": body, "command": command})

    return candidates


def confirmed_command_from_transcript(
    text: str,
    fallback_text: str = "",
    require_wake_phrase: bool = False,
    wake_re=WAKE_PHRASE_RE,
    allow_bare_ask: bool = True,
) -> tuple[str, dict, list[dict]]:
    """Select the command to dispatch after local STT confirms a candidate wake."""
    candidates = dispatchable_commands_from_transcript(
        text,
        fallback_text=fallback_text,
        require_wake_phrase=require_wake_phrase,
        wake_re=wake_re,
        allow_bare_ask=allow_bare_ask,
    )
    if require_wake_phrase and not wake_re.search(text):
        return "", {"action": "none"}, candidates
    body = command_body_from_transcript(text, prefer_last_wake=True, wake_re=wake_re)
    if not body and fallback_text and COMMAND_KEYWORD_RE.search(fallback_text):
        body = command_body_from_transcript(fallback_text, prefer_last_wake=True)
    if not body and text and COMMAND_KEYWORD_RE.search(text) and not require_wake_phrase:
        body = text.strip(" ,.:;!?-")
    command = parse_command(body, allow_bare_ask=allow_bare_ask)
    if is_dispatchable_command(command):
        return body, command, candidates
    if candidates:
        selected = candidates[-1]
        return selected["body"], selected["command"], candidates
    return body, command, candidates


def confirmed_dispatches(
    body: str,
    command: dict,
    command_candidates: list[dict],
    dispatch_all: bool = False,
) -> list[dict]:
    """Build the dispatch list for a confirmed transcript.

    Default production behavior stays conservative: one confirmed transcript
    dispatches one command. Dry-run validation can opt into all wake-qualified
    candidates to separate STT coverage from speech-segment splitting.
    """
    if dispatch_all and command_candidates:
        return [
            {"body": item["body"], "command": item["command"]}
            for item in command_candidates
            if is_dispatchable_command(item.get("command", {}))
        ]
    if is_dispatchable_command(command):
        return [{"body": body, "command": command}]
    return []


def should_emit_verifying_transcription(wake_engine: str, speech_candidate_emit_verifying: bool = False) -> bool:
    """Only user-visible wake candidates should surface a verifying caption."""
    return not is_local_stt_engine(wake_engine) or speech_candidate_emit_verifying


def is_max_speech_candidate(wake_source: str) -> bool:
    return ":reason=max" in wake_source


def speech_candidate_stats_from_source(wake_source: str) -> dict:
    match = re.search(
        r"speech:peak=(?P<peak>[0-9.]+):active=(?P<active>\d+):"
        r"duration=(?P<duration>[0-9.]+):gate=(?P<gate>[0-9.]+):reason=(?P<reason>[a-z_]+)",
        wake_source,
    )
    if not match:
        return {}
    return {
        "peak": float(match.group("peak")),
        "active": int(match.group("active")),
        "duration": float(match.group("duration")),
        "gate": float(match.group("gate")),
        "reason": match.group("reason"),
    }


def is_strong_speech_candidate(
    wake_source: str,
    min_peak_rms: float,
    min_active_chunks: int,
) -> bool:
    stats = speech_candidate_stats_from_source(wake_source)
    return bool(stats and stats["peak"] >= min_peak_rms and stats["active"] >= min_active_chunks)


def should_skip_speech_candidate_confirmation(
    wake_engine: str,
    wake_source: str,
    now: float,
    max_empty_backoff_until: float,
    empty_backoff_until: float = 0.0,
    empty_backoff_strong_min_peak_rms: float = 0.0,
    empty_backoff_strong_min_active_chunks: int = 0,
) -> bool:
    if wake_engine != "speech":
        return False
    if is_max_speech_candidate(wake_source) and now < max_empty_backoff_until:
        return True
    if now < empty_backoff_until and not is_strong_speech_candidate(
        wake_source,
        empty_backoff_strong_min_peak_rms,
        empty_backoff_strong_min_active_chunks,
    ):
        return True
    return False


def speech_candidate_skip_reason(
    wake_engine: str,
    wake_source: str,
    now: float,
    max_empty_backoff_until: float,
    empty_backoff_until: float,
    empty_backoff_strong_min_peak_rms: float,
    empty_backoff_strong_min_active_chunks: int,
) -> str:
    if wake_engine != "speech":
        return ""
    if is_max_speech_candidate(wake_source) and now < max_empty_backoff_until:
        return "max_empty_backoff"
    if now < empty_backoff_until and not is_strong_speech_candidate(
        wake_source,
        empty_backoff_strong_min_peak_rms,
        empty_backoff_strong_min_active_chunks,
    ):
        return "empty_backoff"
    return ""


def next_speech_empty_backoff_until(
    wake_engine: str,
    wake_source: str,
    now: float,
    backoff_seconds: float,
) -> float:
    if wake_engine == "speech" and is_max_speech_candidate(wake_source) and backoff_seconds > 0:
        return now + backoff_seconds
    return 0.0


def updated_speech_max_empty_backoff_until(
    current_until: float,
    wake_engine: str,
    wake_source: str,
    now: float,
    backoff_seconds: float,
) -> float:
    next_until = next_speech_empty_backoff_until(wake_engine, wake_source, now, backoff_seconds)
    return max(current_until, next_until) if next_until else current_until


def main() -> None:
    parser = argparse.ArgumentParser(description="Home Center voice service")
    parser.add_argument("--mic-host", default=os.environ.get("MIC_STREAM_HOST", "homecenter.local"))
    parser.add_argument("--mic-port", type=int, default=int(os.environ.get("MIC_STREAM_PORT", "8766")))
    parser.add_argument("--pi-base", default=os.environ.get("PI_COMMAND_URL", "http://homecenter.local:8765"))
    parser.add_argument("--worker-url", default=os.environ.get("WORKER_URL"))
    parser.add_argument("--worker-token", default=os.environ.get("WORKER_TOKEN"))
    parser.add_argument(
        "--vosk-model-dir",
        default=os.environ.get(
            "VOSK_MODEL_DIR",
            "/Users/peter/home-center/voice-service/models/vosk-model-small-en-us-0.15",
        ),
    )
    repo_root = Path(__file__).resolve().parents[1]
    parser.add_argument(
        "--wake-engine",
        choices=("vosk", "openwakeword", "speech", "always-stt"),
        default=os.environ.get("WAKE_ENGINE", "vosk"),
        help="Wake detector engine. Use speech/always-stt only for confirmed-command dry-runs.",
    )
    parser.add_argument(
        "--openwakeword-model",
        default=os.environ.get("OPENWAKEWORD_MODEL", str(repo_root / "pi/models/hey_homer.onnx")),
    )
    parser.add_argument("--openwakeword-verifier", default=os.environ.get("OPENWAKEWORD_VERIFIER"))
    parser.add_argument(
        "--openwakeword-threshold",
        type=float,
        default=float(os.environ.get("OPENWAKEWORD_THRESHOLD", "0.92")),
    )
    parser.add_argument(
        "--openwakeword-min-consecutive",
        type=int,
        default=int(os.environ.get("OPENWAKEWORD_MIN_CONSECUTIVE", "3")),
    )
    parser.add_argument(
        "--openwakeword-vad-threshold",
        type=float,
        default=float(os.environ.get("OPENWAKEWORD_VAD_THRESHOLD", "0.0")),
    )
    parser.add_argument(
        "--openwakeword-recent-rms-seconds",
        type=float,
        default=OPENWAKEWORD_RECENT_RMS_SECONDS,
    )
    parser.add_argument(
        "--openwakeword-min-recent-peak-rms",
        type=float,
        default=OPENWAKEWORD_MIN_RECENT_PEAK_RMS,
    )
    parser.add_argument(
        "--openwakeword-min-active-chunks",
        type=int,
        default=OPENWAKEWORD_MIN_ACTIVE_CHUNKS,
    )
    parser.add_argument(
        "--openwakeword-min-active-rms",
        type=float,
        default=OPENWAKEWORD_MIN_ACTIVE_RMS,
    )
    parser.add_argument(
        "--openwakeword-active-rms-multiplier",
        type=float,
        default=OPENWAKEWORD_ACTIVE_RMS_MULTIPLIER,
    )
    parser.add_argument(
        "--openwakeword-audio-heartbeat-seconds",
        type=float,
        default=OPENWAKEWORD_AUDIO_HEARTBEAT_SECONDS,
        help="Log quiet-window mic RMS summaries this often in openWakeWord confirmed-command mode. Set 0 to disable.",
    )
    parser.add_argument(
        "--openwakeword-audio-log-min-rms",
        type=float,
        default=OPENWAKEWORD_AUDIO_LOG_MIN_RMS,
        help="Log raw openWakeWord audio activity when recent peak RMS reaches this value.",
    )
    parser.add_argument(
        "--openwakeword-audio-log-interval-seconds",
        type=float,
        default=OPENWAKEWORD_AUDIO_LOG_INTERVAL_SECONDS,
        help="Minimum seconds between openWakeWord audio activity probe logs.",
    )
    parser.add_argument(
        "--openwakeword-score-log-min",
        type=float,
        default=OPENWAKEWORD_SCORE_LOG_MIN,
        help="Log openWakeWord scores at or above this value during active speech.",
    )
    parser.add_argument(
        "--openwakeword-score-log-interval-seconds",
        type=float,
        default=OPENWAKEWORD_SCORE_LOG_INTERVAL_SECONDS,
        help="Minimum seconds between active-speech openWakeWord score probe logs.",
    )
    parser.add_argument(
        "--openwakeword-segment-end-silence-seconds",
        type=float,
        default=OPENWAKEWORD_SEGMENT_END_SILENCE_SECONDS,
        help="Quiet audio needed before confirmed-command mode allows another confirmation.",
    )
    parser.add_argument(
        "--openwakeword-empty-confirm-cooldown-seconds",
        type=float,
        default=OPENWAKEWORD_EMPTY_CONFIRM_COOLDOWN_SECONDS,
        help="Cooldown after an empty confirmed-command transcript.",
    )
    parser.add_argument(
        "--speech-candidate-end-silence-seconds",
        type=float,
        default=SPEECH_CANDIDATE_END_SILENCE_SECONDS,
        help="Quiet audio needed before speech candidate mode confirms a segment.",
    )
    parser.add_argument(
        "--speech-candidate-cooldown-seconds",
        type=float,
        default=SPEECH_CANDIDATE_COOLDOWN_SECONDS,
        help="Minimum seconds between speech candidate confirmations.",
    )
    parser.add_argument(
        "--speech-candidate-min-peak-rms",
        type=float,
        default=SPEECH_CANDIDATE_MIN_PEAK_RMS,
        help="Minimum segment peak RMS for speech candidate mode.",
    )
    parser.add_argument(
        "--speech-candidate-min-active-chunks",
        type=int,
        default=SPEECH_CANDIDATE_MIN_ACTIVE_CHUNKS,
        help="Minimum active chunks for speech candidate mode.",
    )
    parser.add_argument(
        "--speech-candidate-min-active-rms",
        type=float,
        default=SPEECH_CANDIDATE_MIN_ACTIVE_RMS,
        help="Minimum active speech RMS gate for speech candidate mode.",
    )
    parser.add_argument(
        "--speech-candidate-active-rms-multiplier",
        type=float,
        default=SPEECH_CANDIDATE_ACTIVE_RMS_MULTIPLIER,
        help="Noise-floor multiplier for speech candidate mode.",
    )
    parser.add_argument(
        "--speech-candidate-min-segment-seconds",
        type=float,
        default=SPEECH_CANDIDATE_MIN_SEGMENT_SECONDS,
        help="Minimum segment duration for speech candidate mode.",
    )
    parser.add_argument(
        "--speech-candidate-pre-roll-seconds",
        type=float,
        default=SPEECH_CANDIDATE_PRE_ROLL_SECONDS,
        help="Quiet audio to include before the active speech segment in speech candidate mode.",
    )
    parser.add_argument(
        "--speech-candidate-max-segment-seconds",
        type=float,
        default=SPEECH_CANDIDATE_MAX_SEGMENT_SECONDS,
        help="Maximum speech segment duration before speech candidate mode runs local confirmation.",
    )
    parser.add_argument(
        "--speech-candidate-max-empty-backoff-seconds",
        type=float,
        default=SPEECH_CANDIDATE_MAX_EMPTY_BACKOFF_SECONDS,
        help="Backoff after an empty max-length speech candidate. Silence-ended candidates still confirm.",
    )
    parser.add_argument(
        "--speech-candidate-empty-backoff-seconds",
        type=float,
        default=SPEECH_CANDIDATE_EMPTY_BACKOFF_SECONDS,
        help="Backoff after any empty speech candidate. Strong candidates can still confirm during this window.",
    )
    parser.add_argument(
        "--speech-candidate-empty-backoff-strong-min-peak-rms",
        type=float,
        default=SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_PEAK_RMS,
        help="Minimum peak RMS that lets a speech candidate bypass empty backoff.",
    )
    parser.add_argument(
        "--speech-candidate-empty-backoff-strong-min-active-chunks",
        type=int,
        default=SPEECH_CANDIDATE_EMPTY_BACKOFF_STRONG_MIN_ACTIVE_CHUNKS,
        help="Minimum active chunks that lets a speech candidate bypass empty backoff.",
    )
    parser.add_argument(
        "--speech-candidate-emit-verifying",
        action="store_true",
        default=SPEECH_CANDIDATE_EMIT_VERIFYING,
        help="Post a soft verifying transcription for raw speech candidates. Off by default to avoid UI churn.",
    )
    parser.add_argument(
        "--pre-wake-seconds",
        type=float,
        default=PRE_WAKE_SECONDS,
    )
    parser.add_argument(
        "--wake-confirm-command",
        action="store_true",
        default=WAKE_CONFIRM_COMMAND,
        help="Treat wake hits as candidates and only chime/dispatch after local STT parses a valid command.",
    )
    parser.add_argument(
        "--confirm-multi-command-dispatch",
        action="store_true",
        default=CONFIRM_MULTI_COMMAND_DISPATCH,
        help="Dispatch every wake-qualified command in one confirmed transcript. Intended for dry-run validation.",
    )
    parser.add_argument(
        "--confirm-pre-wake-seconds",
        type=float,
        default=CONFIRM_PRE_WAKE_SECONDS,
        help="Rolling audio to include before a candidate wake in confirmed-command mode.",
    )
    parser.add_argument(
        "--confirm-post-wake-seconds",
        type=float,
        default=CONFIRM_POST_WAKE_SECONDS,
        help="Maximum post-candidate audio to capture in confirmed-command mode.",
    )
    parser.add_argument(
        "--confirm-min-post-wake-seconds",
        type=float,
        default=CONFIRM_MIN_POST_WAKE_SECONDS,
        help="Minimum post-candidate audio before silence can end confirmed-command capture.",
    )
    parser.add_argument(
        "--confirm-post-wake-silence-seconds",
        type=float,
        default=CONFIRM_POST_WAKE_SILENCE_SECONDS,
        help="Trailing silence needed to end confirmed-command capture.",
    )
    parser.add_argument("--cooldown", type=float, default=float(os.environ.get("WAKE_COOLDOWN", "3.0")))
    parser.add_argument("--whisper-model", default=os.environ.get("WHISPER_MODEL", "base.en"))
    parser.add_argument(
        "--whisper-no-speech-threshold",
        type=float,
        default=WHISPER_NO_SPEECH_THRESHOLD,
        help="faster-whisper no_speech_threshold; higher values preserve short quiet commands.",
    )
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    validate_wake_mode_config(args.wake_engine, args.wake_confirm_command)

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    get_whisper(args.whisper_model)
    detector = build_wake_detector(args)
    dispatcher = Dispatcher(args.pi_base, args.worker_url, args.worker_token, args.dry_run)
    mic = MicStream(args.mic_host, args.mic_port)
    mic.connect()
    rolling = RollingAudio()
    recent_rms = deque(maxlen=max(1, int(args.openwakeword_recent_rms_seconds * SAMPLE_RATE / CHUNK_SIZE)))

    noise = 100.0
    last_action = 0.0
    last_audio_log = 0.0
    last_score_log = 0.0
    speech_max_empty_backoff_until = 0.0
    speech_empty_backoff_until = 0.0
    chunk_seconds = CHUNK_SIZE / SAMPLE_RATE
    segment_debounce = SpeechSegmentDebounce(args.openwakeword_segment_end_silence_seconds)
    audio_heartbeat = AudioActivityHeartbeat(args.openwakeword_audio_heartbeat_seconds)
    log.info(
        "Ready: wake=%s STT=%s whisperNoSpeech=%.2f preWake=%.1fs postWakeMax=%.1fs recentRms=%.1fs "
        "confirmCommand=%s confirmMulti=%s confirmPre=%.1fs confirmPostMax=%.1fs postActionMute=%.1fs "
        "audioHeartbeat=%.1fs audioLogMin=%.0f scoreLogMin=%.2f segmentSilence=%.1fs emptyCooldown=%.1fs "
        "speechMinPeak=%.0f speechEndSilence=%.1fs speechCooldown=%.1fs speechPreRoll=%.1fs speechMaxSegment=%.1fs "
        "speechMaxEmptyBackoff=%.1fs speechEmptyBackoff=%.1fs speechEmptyStrongPeak=%.0f "
        "speechEmptyStrongActive=%d speechEmitVerifying=%s",
        detector.name,
        args.whisper_model,
        args.whisper_no_speech_threshold,
        args.pre_wake_seconds,
        COMMAND_MAX_SECONDS,
        args.openwakeword_recent_rms_seconds,
        args.wake_confirm_command,
        args.confirm_multi_command_dispatch,
        args.confirm_pre_wake_seconds,
        args.confirm_post_wake_seconds,
        POST_ACTION_MUTE,
        args.openwakeword_audio_heartbeat_seconds,
        args.openwakeword_audio_log_min_rms,
        args.openwakeword_score_log_min,
        args.openwakeword_segment_end_silence_seconds,
        args.openwakeword_empty_confirm_cooldown_seconds,
        args.speech_candidate_min_peak_rms,
        args.speech_candidate_end_silence_seconds,
        args.speech_candidate_cooldown_seconds,
        args.speech_candidate_pre_roll_seconds,
        args.speech_candidate_max_segment_seconds,
        args.speech_candidate_max_empty_backoff_seconds,
        args.speech_candidate_empty_backoff_seconds,
        args.speech_candidate_empty_backoff_strong_min_peak_rms,
        args.speech_candidate_empty_backoff_strong_min_active_chunks,
        args.speech_candidate_emit_verifying,
    )

    while True:
        chunk = mic.read_chunk()
        rolling.append(chunk)
        chunk_rms = rms(chunk)
        noise = 0.995 * noise + 0.005 * min(chunk_rms, noise * 3)
        recent_rms.append(chunk_rms)
        if args.wake_engine == "openwakeword" and args.wake_confirm_command:
            audio_heartbeat.record(chunk_rms)
            segment_debounce.update(
                chunk_rms,
                active_speech_gate(
                    noise,
                    args.openwakeword_min_active_rms,
                    args.openwakeword_active_rms_multiplier,
                ),
                chunk_seconds,
            )
            now = time.time()
            if audio_heartbeat.should_log(now):
                heartbeat = audio_heartbeat.snapshot_and_reset(now)
                log.info(
                    "OpenWakeWord audio heartbeat window=%.1fs chunks=%d maxRms=%.0f avgRms=%.0f "
                    "noise=%.0f lastScore=%.3f",
                    heartbeat["window"],
                    heartbeat["chunks"],
                    heartbeat["max_rms"],
                    heartbeat["avg_rms"],
                    noise,
                    getattr(detector, "last_score", 0.0),
                )

        if time.time() - last_action < POST_ACTION_MUTE:
            detector.accept(chunk)
            continue

        hit, wake_text, wake_source = detector.accept(chunk)
        if args.debug and wake_text:
            log.debug("wake %s=%r rms=%.0f noise=%.0f", wake_source, wake_text, chunk_rms, noise)
        if not hit:
            if args.wake_engine == "openwakeword" and hasattr(detector, "last_score"):
                stats = recent_speech_stats(
                    recent_rms,
                    noise,
                    args.openwakeword_min_active_rms,
                    args.openwakeword_active_rms_multiplier,
                )
                now = time.time()
                if should_log_openwakeword_audio(
                    stats,
                    args.openwakeword_audio_log_min_rms,
                    now,
                    last_audio_log,
                    args.openwakeword_audio_log_interval_seconds,
                ):
                    last_audio_log = now
                    log.info(
                        "OpenWakeWord audio probe score=%.3f threshold=%.3f consecutive=%d/%d "
                        "rms=%.0f noise=%.0f recentPeak=%.0f activeChunks=%d gate=%.0f",
                        detector.last_score,
                        args.openwakeword_threshold,
                        getattr(detector, "consecutive", 0),
                        args.openwakeword_min_consecutive,
                        chunk_rms,
                        noise,
                        stats["peak"],
                        stats["active_chunks"],
                        stats["gate"],
                    )
                if should_log_openwakeword_score(
                    detector.last_score,
                    stats,
                    args.openwakeword_score_log_min,
                    args.openwakeword_min_active_chunks,
                    now,
                    last_score_log,
                    args.openwakeword_score_log_interval_seconds,
                ):
                    last_score_log = now
                    log.info(
                        "OpenWakeWord score probe score=%.3f threshold=%.3f consecutive=%d/%d "
                        "rms=%.0f noise=%.0f recentPeak=%.0f activeChunks=%d gate=%.0f",
                        detector.last_score,
                        args.openwakeword_threshold,
                        getattr(detector, "consecutive", 0),
                        args.openwakeword_min_consecutive,
                        chunk_rms,
                        noise,
                        stats["peak"],
                        stats["active_chunks"],
                        stats["gate"],
                    )
            continue

        if args.wake_engine == "openwakeword":
            stats = recent_speech_stats(
                recent_rms,
                noise,
                args.openwakeword_min_active_rms,
                args.openwakeword_active_rms_multiplier,
            )
            if not passes_recent_speech_gate(
                stats,
                args.openwakeword_min_recent_peak_rms,
                args.openwakeword_min_active_chunks,
            ):
                if hasattr(detector, "reject_last_hit"):
                    detector.reject_last_hit()
                log.info(
                    "Rejecting openWakeWord wake via %s: rms=%.0f noise=%.0f recentPeak=%.0f "
                    "activeChunks=%d gate=%.0f",
                    wake_source,
                    chunk_rms,
                    noise,
                    stats["peak"],
                    stats["active_chunks"],
                    stats["gate"],
                )
                continue

            if args.wake_confirm_command:
                now = time.time()
                if not segment_debounce.can_confirm(now):
                    if hasattr(detector, "reject_last_hit"):
                        detector.reject_last_hit()
                    reason = "same_segment" if segment_debounce.confirmed_in_segment else "empty_cooldown"
                    log.info(
                        "Skipping openWakeWord wake via %s: reason=%s segmentActive=%s quiet=%.1fs "
                        "cooldownRemaining=%.1fs rms=%.0f noise=%.0f recentPeak=%.0f activeChunks=%d gate=%.0f",
                        wake_source,
                        reason,
                        segment_debounce.active,
                        segment_debounce.quiet_seconds,
                        max(segment_debounce.cooldown_until - now, 0.0),
                        chunk_rms,
                        noise,
                        stats["peak"],
                        stats["active_chunks"],
                        stats["gate"],
                    )
                    continue

        wake_at = time.time()
        if should_skip_speech_candidate_confirmation(
            args.wake_engine,
            wake_source,
            wake_at,
            speech_max_empty_backoff_until,
            speech_empty_backoff_until,
            args.speech_candidate_empty_backoff_strong_min_peak_rms,
            args.speech_candidate_empty_backoff_strong_min_active_chunks,
        ):
            reason = speech_candidate_skip_reason(
                args.wake_engine,
                wake_source,
                wake_at,
                speech_max_empty_backoff_until,
                speech_empty_backoff_until,
                args.speech_candidate_empty_backoff_strong_min_peak_rms,
                args.speech_candidate_empty_backoff_strong_min_active_chunks,
            )
            cooldown_until = (
                speech_max_empty_backoff_until if reason == "max_empty_backoff" else speech_empty_backoff_until
            )
            log.info(
                "Skipping speech candidate via %s: reason=%s cooldownRemaining=%.1fs "
                "rms=%.0f noise=%.0f",
                wake_source,
                reason,
                max(cooldown_until - wake_at, 0.0),
                chunk_rms,
                noise,
            )
            continue

        log.info("Wake hit via %s %s: %r rms=%.0f noise=%.0f", args.wake_engine, wake_source, wake_text, chunk_rms, noise)
        if args.wake_confirm_command:
            pre_audio = rolling.tail(args.confirm_pre_wake_seconds)
            verifying_text = wake_text or ("Speech" if is_local_stt_engine(args.wake_engine) else "Hey Homer")
            emitted_verifying = should_emit_verifying_transcription(
                args.wake_engine,
                args.speech_candidate_emit_verifying,
            )
            if emitted_verifying:
                dispatcher.transcription(
                    verifying_text,
                    False,
                    wakeScore=1.0,
                    stage="verifying",
                    wakeSource=wake_source,
                )
            on_confirm_chunk = None
            if args.wake_engine == "openwakeword":
                on_confirm_chunk = (
                    lambda _chunk, chunk_rms: segment_debounce.update(
                        chunk_rms,
                        active_speech_gate(
                            noise,
                            args.openwakeword_min_active_rms,
                            args.openwakeword_active_rms_multiplier,
                        ),
                        chunk_seconds,
                    )
                )
            pre_log_samples = 0
            if is_local_stt_engine(args.wake_engine):
                command_audio = detector.consume_last_segment_audio()
                post_seconds = 0.0
                pre_log_samples = 0
            else:
                command_audio, post_seconds = capture_command(
                    mic,
                    rolling,
                    noise,
                    pre_audio,
                    max_post_seconds=args.confirm_post_wake_seconds,
                    min_post_seconds=args.confirm_min_post_wake_seconds,
                    silence_seconds=args.confirm_post_wake_silence_seconds,
                    on_chunk=on_confirm_chunk,
                )
                pre_log_samples = min(len(pre_audio), len(command_audio))
            if is_local_stt_engine(args.wake_engine) and len(command_audio) == 0:
                command_audio, post_seconds = capture_command(
                    mic,
                    rolling,
                    noise,
                    pre_audio,
                    max_post_seconds=args.confirm_post_wake_seconds,
                    min_post_seconds=args.confirm_min_post_wake_seconds,
                    silence_seconds=args.confirm_post_wake_silence_seconds,
                    on_chunk=on_confirm_chunk,
                )
                pre_log_samples = min(len(pre_audio), len(command_audio))
            text = transcribe(command_audio, args.whisper_model, args.whisper_no_speech_threshold)
            body, command, command_candidates = confirmed_command_from_transcript(
                text,
                fallback_text=wake_text,
                require_wake_phrase=is_local_stt_engine(args.wake_engine),
                wake_re=CONFIRM_WAKE_PHRASE_RE,
                allow_bare_ask=False,
            )
            if args.dry_run:
                log.info("Confirmed-command candidates=%s", command_candidates)
            if command.get("action") != "none" and not is_dispatchable_command(command):
                log.info("Rejecting incomplete command body=%r command=%s", body, command)
                command = {"action": "none"}
            dispatch_items = confirmed_dispatches(
                body,
                command,
                command_candidates,
                dispatch_all=args.confirm_multi_command_dispatch,
            )
            stt_done = time.time()
            log.info(
                "Confirmed-command transcript=%r body=%r command=%s capture=%.0fms pre=%.0fms "
                "post=%.0fms total=%.0fms",
                text,
                body,
                command,
                len(command_audio) / SAMPLE_RATE * 1000,
                pre_log_samples / SAMPLE_RATE * 1000,
                post_seconds * 1000,
                (stt_done - wake_at) * 1000,
            )

            if dispatch_items:
                speech_max_empty_backoff_until = 0.0
                speech_empty_backoff_until = 0.0
                segment_debounce.mark_confirmed(
                    time.time(),
                    empty=False,
                    empty_cooldown_seconds=args.openwakeword_empty_confirm_cooldown_seconds,
                )
                if len(dispatch_items) > 1:
                    log.info(
                        "Dispatching %d confirmed commands from one transcript.",
                        len(dispatch_items),
                    )
                dispatcher.chime(1.0)
                for index, item in enumerate(dispatch_items, start=1):
                    item_body = item["body"]
                    item_command = item["command"]
                    final_text = f"Hey Homer, {item_body}" if item_body else text.strip()
                    dispatcher.transcription(
                        final_text,
                        True,
                        wakeScore=1.0,
                        stage="command",
                        command=item_command,
                        confirmed=True,
                        multiIndex=index,
                        multiCount=len(dispatch_items),
                    )
                    dispatcher.dispatch(item_command)
            else:
                now = time.time()
                speech_max_empty_backoff_until = updated_speech_max_empty_backoff_until(
                    speech_max_empty_backoff_until,
                    args.wake_engine,
                    wake_source,
                    now,
                    args.speech_candidate_max_empty_backoff_seconds,
                )
                if args.wake_engine == "speech" and args.speech_candidate_empty_backoff_seconds > 0:
                    speech_empty_backoff_until = max(
                        speech_empty_backoff_until,
                        now + args.speech_candidate_empty_backoff_seconds,
                    )
                segment_debounce.mark_confirmed(
                    time.time(),
                    empty=True,
                    empty_cooldown_seconds=args.openwakeword_empty_confirm_cooldown_seconds,
                )
                log.info("Ignoring candidate wake after confirmation; no valid command.")
                if emitted_verifying:
                    dispatcher.transcription(
                        "",
                        False,
                        wakeScore=1.0,
                        stage="ignored",
                        command=command,
                        confirmed=False,
                    )
            last_action = time.time()
            continue

        pre_audio = rolling.tail(args.pre_wake_seconds)
        threading.Thread(target=dispatcher.chime, args=(1.0,), daemon=True).start()
        threading.Thread(
            target=dispatcher.transcription,
            args=(wake_text or "Hey Homer", True),
            kwargs={"wakeScore": 1.0, "stage": "wake", "wakeSource": wake_source},
            daemon=True,
        ).start()

        wake_body = command_body_from_transcript(wake_text)
        wake_command = parse_command(wake_body) if wake_body and COMMAND_KEYWORD_RE.search(wake_body) else {"action": "none"}
        if wake_command.get("action") != "none" and not is_dispatchable_command(wake_command):
            log.info("Rejecting incomplete fast command body=%r command=%s", wake_body, wake_command)
            wake_command = {"action": "none"}
        if is_dispatchable_command(wake_command):
            log.info(
                "Fast command from Vosk wake transcript body=%r command=%s total=%.0fms",
                wake_body,
                wake_command,
                (time.time() - wake_at) * 1000,
            )
            dispatcher.transcription(
                f"Hey Homer, {wake_body}",
                True,
                wakeScore=1.0,
                stage="command",
                command=wake_command,
                fastPath=True,
            )
            dispatcher.dispatch(wake_command)
            last_action = time.time()
            continue

        command_audio, post_seconds = capture_command(mic, rolling, noise, pre_audio)
        text = transcribe(command_audio, args.whisper_model, args.whisper_no_speech_threshold)
        body, command = command_from_transcript(text, fallback_text=wake_text)
        if command.get("action") != "none" and not is_dispatchable_command(command):
            log.info("Rejecting incomplete command body=%r command=%s", body, command)
            command = {"action": "none"}
        stt_done = time.time()
        log.info(
            "Command transcript=%r body=%r command=%s capture=%.0fms pre=%.0fms post=%.0fms total=%.0fms",
            text,
            body,
            command,
            len(command_audio) / SAMPLE_RATE * 1000,
            min(len(pre_audio), len(command_audio)) / SAMPLE_RATE * 1000,
            post_seconds * 1000,
            (stt_done - wake_at) * 1000,
        )

        final_text = f"Hey Homer, {body}" if body else "Hey Homer"
        dispatcher.transcription(final_text, True, wakeScore=1.0, stage="command", command=command)
        if is_dispatchable_command(command):
            dispatcher.dispatch(command)
        else:
            log.info("No valid command after wake; no dispatch.")
        last_action = time.time()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("Shutting down.")
        sys.exit(0)
