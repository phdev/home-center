#!/usr/bin/env python3
"""
XVF3800 Audio Streamer for Home Center.

Reads the ReSpeaker XVF3800 USB 4-Mic Array through PipeWire's ALSA pulse
bridge and streams 16 kHz mono 16-bit PCM over TCP. Bookworm's PipeWire owns
the USB hardware, so direct `hw:N,0` opens can return zero bytes; use `pulse`.

Wire format: contiguous 16 kHz mono S16_LE PCM frames.
"""

from __future__ import annotations

import argparse
import logging
import socket
import sys
import time

import alsaaudio
import numpy as np

SAMPLE_RATE = 16000
CHUNK_SIZE = 1280
IN_CHANNELS = 1
DEFAULT_PORT = 8766
DEFAULT_DEVICE = "pulse"
DEFAULT_SEND_TIMEOUT = 2.0

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("mic-streamer")


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


def stream_to_client(conn: socket.socket, pcm: alsaaudio.PCM, send_timeout: float) -> None:
    conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    conn.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
    conn.settimeout(send_timeout)
    while True:
        length, data = pcm.read()
        if length <= 0:
            continue
        audio = np.frombuffer(data, dtype=np.int16)
        if IN_CHANNELS > 1:
            audio = audio.reshape(-1, IN_CHANNELS).mean(axis=1).astype(np.int16)
        conn.sendall(audio.tobytes())


def serve(port: int, device: str, send_timeout: float) -> None:
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("0.0.0.0", port))
    srv.listen(1)
    log.info(
        "Listening on :%d (device=%s, %d ch -> mono @ %d Hz, sendTimeout=%.1fs)",
        port,
        device,
        IN_CHANNELS,
        SAMPLE_RATE,
        send_timeout,
    )

    while True:
        conn, addr = srv.accept()
        log.info("Client connected from %s:%d; opening ALSA", *addr)
        try:
            pcm = open_pcm(device)
        except alsaaudio.ALSAAudioError as e:
            log.error("Failed to open %s: %s", device, e)
            conn.close()
            time.sleep(1)
            continue
        try:
            stream_to_client(conn, pcm, send_timeout)
        except (BrokenPipeError, ConnectionResetError, socket.timeout, OSError) as e:
            log.info("Client disconnected: %s", e)
        except alsaaudio.ALSAAudioError as e:
            log.error("ALSA read error: %s; exiting for systemd restart", e)
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
    parser.add_argument(
        "--device",
        type=str,
        default=DEFAULT_DEVICE,
        help="ALSA device. Use 'pulse' on Pi OS Bookworm so PipeWire owns the hardware.",
    )
    parser.add_argument(
        "--send-timeout",
        type=float,
        default=DEFAULT_SEND_TIMEOUT,
        help="Seconds to let a client socket send block before dropping the client.",
    )
    args = parser.parse_args()
    serve(args.port, args.device, args.send_timeout)


if __name__ == "__main__":
    main()
