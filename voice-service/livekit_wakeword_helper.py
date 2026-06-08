#!/usr/bin/env python3
"""Small stdin/stdout helper for LiveKit wake-word inference.

The main voice service can stay on the existing Python runtime that has proven
launchd LAN access, while this helper runs the Python 3.11-only LiveKit model.
"""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

import numpy as np
from livekit.wakeword import WakeWordModel


def read_exact(size: int) -> bytes:
    data = bytearray()
    while len(data) < size:
        chunk = sys.stdin.buffer.read(size - len(data))
        if not chunk:
            raise EOFError
        data.extend(chunk)
    return bytes(data)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: livekit_wakeword_helper.py MODEL", file=sys.stderr)
        return 2

    model_path = Path(sys.argv[1])
    model = WakeWordModel(models=[str(model_path)])

    while True:
        try:
            header = read_exact(4)
            size = struct.unpack("<I", header)[0]
            audio = np.frombuffer(read_exact(size), dtype=np.int16)
            scores = model.predict(audio)
            print(json.dumps({"scores": scores}), flush=True)
        except EOFError:
            return 0
        except Exception as exc:
            print(json.dumps({"error": str(exc)}), flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
