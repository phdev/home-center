#!/usr/bin/env python3
"""
XVF3800 Audio Streamer for Home Center.

Reads the ReSpeaker XVF3800 USB 4-Mic Array via ALSA and streams 16 kHz
mono 16-bit PCM over a TCP socket. One client at a time (the voice
service on the Mac mini, which runs wake-word + Whisper). The Pi stops
reading ALSA entirely when no client is connected, so the mic is idle
on standby.

This replaces the always-on wake-word detection that used to run on the
Pi — detection now happens on the Mac mini where there's enough CPU to
run a large Whisper model. The mic physically stays on the Pi.

Wire format: contiguous 16 kHz mono S16_LE PCM frames.
"""

import argparse
import logging
import socket
import subprocess
import sys
import time

import alsaaudio
import numpy as np

SAMPLE_RATE = 16000
CHUNK_SIZE = 1280           # 80 ms @ 16 kHz — matches openWakeWord window
IN_CHANNELS = 1             # mono via PipeWire's default source
DEFAULT_PORT = 8766

# Pi OS Bookworm runs PipeWire, which grabs the USB audio hardware — so
# direct `hw:N,0` ALSA opens return no audio. The `pulse` PCM routes through
# PipeWire's PulseAudio-compat bridge and Just Works as long as the XVF3800
# is the default source (it is by default on a fresh boot; check with
# `wpctl status`).
DEFAULT_DEVICE = "pulse"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("mic-streamer")


def find_xvf3800_device() -> str | None:
    """Locate the XVF3800 USB array. Prefer it; fall back to the legacy 2-Mic HAT."""
    try:
        result = subprocess.run(
            ["arecord", "-l"], capture_output=True, text=True, timeout=5,
        )
        xvf = None
        hat = None
        for line in result.stdout.splitlines():
            lower = line.lower()
            if not lower.startswith("card"):
                continue
            card_num = lower.split(":")[0].replace("card", "").strip()
            if any(k in lower for k in ("xvf3800", "array", "4-mic")):
                xvf = card_num
            elif any(k in lower for k in ("seeed2mic", "wm8960", "2mic")):
                hat = card_num
        if xvf:
            return f"hw:{xvf},0"
        if hat:
            log.warning("XVF3800 not found — falling back to legacy 2-Mic HAT on card %s", hat)
            return f"hw:{hat},0"
    except Exception as e:
        log.warning("Error scanning ALSA: %s", e)
    return None


def open_pcm(device: str) -> alsaaudio.PCM:
    return alsaaudio.PCM(
        type=alsaaudio.PCM_CAPTURE,
        mode=alsaaudio.PCM_NORMAL,
        device=device,
        channels=IN_CHANNELS,
        rate=SAMPLE_RATE,
        format=alsaaudio.PCM_FORMAT_S16_LE,
        periodsize=CHUNK_SIZE,
    )


def stream_to_client(conn: socket.socket, pcm: alsaaudio.PCM) -> None:
    conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    conn.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
    while True:
        length, data = pcm.read()
        if length <= 0:
            continue
        audio = np.frombuffer(data, dtype=np.int16)
        if IN_CHANNELS > 1:
            audio = audio.reshape(-1, IN_CHANNELS).mean(axis=1).astype(np.int16)
        conn.sendall(audio.tobytes())


def serve(port: int, device: str) -> None:
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("0.0.0.0", port))
    srv.listen(1)
    log.info("Listening on :%d (device=%s, %d ch → mono @ %d Hz)",
             port, device, IN_CHANNELS, SAMPLE_RATE)

    while True:
        conn, addr = srv.accept()
        log.info("Client connected from %s:%d — opening ALSA", *addr)
        try:
            pcm = open_pcm(device)
        except alsaaudio.ALSAAudioError as e:
            log.error("Failed to open %s: %s", device, e)
            conn.close()
            time.sleep(1)
            continue
        try:
            stream_to_client(conn, pcm)
        except (BrokenPipeError, ConnectionResetError, OSError) as e:
            log.info("Client disconnected: %s", e)
        except alsaaudio.ALSAAudioError as e:
            log.error("ALSA read error: %s — exiting for restart", e)
            sys.exit(1)
        except Exception as e:
            log.exception("Stream error: %s", e)
        finally:
            try:
                pcm.close()
            except Exception:
                pass
            try:
                conn.close()
            except Exception:
                pass
            log.info("Idle. Waiting for next connection...")


def main() -> None:
    parser = argparse.ArgumentParser(description="XVF3800 PCM streamer over TCP")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--device", type=str, default=None,
                        help="ALSA device (default: 'pulse' via PipeWire; "
                             "use hw:N,0 for direct access if you've stopped PipeWire)")
    args = parser.parse_args()

    device = args.device or DEFAULT_DEVICE
    log.info("Using ALSA device: %s", device)
    serve(args.port, device)


if __name__ == "__main__":
    main()
