#!/usr/bin/env python3
"""
Home Center — run the daily Design Claw + send the Telegram digest.

Thin wrapper that chains `run_daily_design_claw.main()` and
`send_telegram_digest.main()` so a single launchd job / single CLI
invocation does both.

Usage:
    OPENAI_API_KEY=... TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... \\
        python scripts/run_daily_design_and_send.py
"""

from __future__ import annotations

import sys

import run_daily_design_claw
import send_telegram_digest


def _call(module, name: str) -> int:
    original = sys.argv
    sys.argv = [name]
    try:
        return module.main()
    finally:
        sys.argv = original


def main() -> int:
    rc = _call(run_daily_design_claw, "run_daily_design_claw")
    if rc != 0:
        return rc
    print()
    return _call(send_telegram_digest, "send_telegram_digest")


if __name__ == "__main__":
    sys.exit(main())
