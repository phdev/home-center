#!/usr/bin/env python3
"""
Home Center — Design Claw Telegram digest sender.

Reads a daily artifact (JSON preferred — falls back to the most recent
via `design_outputs/.last_daily.json`) and sends a short plain-text
digest through the Telegram Bot API. Uses urllib from stdlib — no extra
dependency.

Env vars (required):
    TELEGRAM_BOT_TOKEN
    TELEGRAM_CHAT_ID

Usage:
    python scripts/send_telegram_digest.py                         # last daily
    python scripts/send_telegram_digest.py --json design_outputs/daily/2026-04-20-dashboard.json
    python scripts/send_telegram_digest.py --dry-run               # print, don't send
"""

from __future__ import annotations

import argparse
import io
import json
import mimetypes
import sys
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any

from _design_claw import (
    DESIGN_OUTPUTS_DAILY,
    load_last_daily,
    read_json,
    require_env,
    with_retries,
)

TELEGRAM_API = "https://api.telegram.org"
MAX_LEN = 3800        # sendMessage hard cap is 4096; leave headroom.
CAPTION_MAX = 1000    # sendPhoto caption hard cap is 1024; leave headroom.


def resolve_json_path(cli_path: Path | None) -> Path:
    if cli_path:
        if cli_path.suffix == ".md":
            cli_path = cli_path.with_suffix(".json")
        if not cli_path.exists():
            raise SystemExit(f"error: {cli_path} does not exist")
        return cli_path

    state = load_last_daily()
    if state:
        md_path = Path(state["path"])
        json_path = md_path.with_suffix(".json")
        if json_path.exists():
            return json_path

    # Fall back: most recent JSON in design_outputs/daily/
    candidates = sorted(DESIGN_OUTPUTS_DAILY.glob("*.json"))
    if not candidates:
        raise SystemExit("error: no daily artifacts found in design_outputs/daily/")
    return candidates[-1]


def build_caption(payload: dict[str, Any], variant: str | None = None) -> str:
    """Short caption for a photo send. `variant` tags the image so the
    user can tell structural vs. polish apart when swiping through the
    album in Telegram.

    - None        → full header (single-photo path)
    - "structural" → full header + "(1/2 · structural)" tag
    - "polish"    → compact "Polish view" label (2/2)
    """
    topic = payload.get("topic") or {}
    concept = payload.get("concept") or {}

    if variant == "polish":
        name = concept.get("concept_name", "(unnamed)")
        return f"✨ Polish view (2/2) — {name}"[:CAPTION_MAX]

    tag = "\n\n📐 Structural view (1/2)" if variant == "structural" else ""
    lines = [
        f"🪶 Design Claw — {payload.get('date', '')}",
        f"Topic: {topic.get('theme') or topic.get('id', '')}",
        "",
        f"Concept: {concept.get('concept_name', '(unnamed)')}",
    ]
    message = "\n".join(lines) + tag
    if len(message) > CAPTION_MAX:
        message = message[: CAPTION_MAX - 1] + "…"
    return message


def build_digest(payload: dict[str, Any], limit: int = MAX_LEN) -> str:
    topic = payload.get("topic") or {}
    concept = payload.get("concept") or {}
    lines = [
        f"🪶 Design Claw — {payload.get('date', '')}",
        f"Topic: {topic.get('theme') or topic.get('id', '')}",
        "",
        f"Concept: {concept.get('concept_name', '(unnamed)')}",
        "",
        "Why it matters:",
        (concept.get("why_it_fits") or "").strip(),
        "",
        "Tradeoff:",
        (concept.get("tradeoff") or "").strip(),
        "",
        f"Prototype first: {(concept.get('prototype_first') or '').strip()}",
    ]
    message = "\n".join(line for line in lines if line is not None)
    if len(message) > limit:
        message = message[: limit - 1] + "…"
    return message


def send_message(token: str, chat_id: str, text: str) -> dict[str, Any]:
    url = f"{TELEGRAM_API}/bot{token}/sendMessage"
    body = urllib.parse.urlencode(
        {"chat_id": chat_id, "text": text, "disable_web_page_preview": "true"}
    ).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _multipart_field(boundary: str, name: str, value: str) -> bytes:
    return (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
        f"{value}\r\n"
    ).encode("utf-8")


def _multipart_file(boundary: str, name: str, path: Path) -> bytes:
    mimetype = mimetypes.guess_type(str(path))[0] or "image/png"
    header = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{name}"; filename="{path.name}"\r\n'
        f"Content-Type: {mimetype}\r\n\r\n"
    ).encode("utf-8")
    return header + path.read_bytes() + b"\r\n"


def send_photo(token: str, chat_id: str, photo_path: Path, caption: str) -> dict[str, Any]:
    """POST multipart/form-data to Telegram's sendPhoto. Stdlib only."""
    url = f"{TELEGRAM_API}/bot{token}/sendPhoto"
    boundary = f"----HomeCenterDesignClaw-{uuid.uuid4().hex}"

    body = io.BytesIO()
    body.write(_multipart_field(boundary, "chat_id", chat_id))
    body.write(_multipart_field(boundary, "caption", caption))
    body.write(_multipart_file(boundary, "photo", photo_path))
    body.write(f"--{boundary}--\r\n".encode("utf-8"))

    req = urllib.request.Request(
        url,
        data=body.getvalue(),
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def send_media_group(
    token: str,
    chat_id: str,
    photo_paths: list[Path],
    captions: list[str],
) -> dict[str, Any]:
    """POST to sendMediaGroup with 2+ photos as a Telegram album. Each
    photo gets its own caption from `captions` — Telegram shows the
    caption under the image when the user swipes to it in full-screen
    view."""
    if len(photo_paths) < 2:
        raise ValueError("sendMediaGroup requires at least 2 photos")
    if len(captions) != len(photo_paths):
        raise ValueError("captions must align 1:1 with photo_paths")

    url = f"{TELEGRAM_API}/bot{token}/sendMediaGroup"
    boundary = f"----HomeCenterDesignClaw-{uuid.uuid4().hex}"

    media = []
    for i, (path, cap) in enumerate(zip(photo_paths, captions)):
        entry: dict[str, Any] = {
            "type": "photo",
            "media": f"attach://photo{i}",
            "caption": cap,
        }
        media.append(entry)

    body = io.BytesIO()
    body.write(_multipart_field(boundary, "chat_id", chat_id))
    body.write(_multipart_field(boundary, "media", json.dumps(media)))
    for i, path in enumerate(photo_paths):
        body.write(_multipart_file(boundary, f"photo{i}", path))
    body.write(f"--{boundary}--\r\n".encode("utf-8"))

    req = urllib.request.Request(
        url,
        data=body.getvalue(),
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, help="path to a daily JSON artifact")
    parser.add_argument("--dry-run", action="store_true", help="print the digest, do not send")
    args = parser.parse_args()

    json_path = resolve_json_path(args.json)
    payload = read_json(json_path)
    png_path = json_path.with_suffix(".png")
    polish_path = json_path.parent / f"{json_path.stem}-polish.png"
    has_png = png_path.exists()
    has_polish = polish_path.exists()

    digest = build_digest(payload)

    if args.dry_run:
        if has_png and has_polish:
            caption = build_caption(payload)
            print(f"[would sendMediaGroup: {png_path.name} + {polish_path.name}]")
            print(f"[caption on first image]\n{caption}\n")
            print("[then sendMessage with]")
        elif has_png:
            caption = build_caption(payload)
            print(f"[would sendPhoto {png_path.name} with caption]\n{caption}\n")
            print("[then sendMessage with]")
        print(digest)
        return 0

    token = require_env("TELEGRAM_BOT_TOKEN")
    chat_id = require_env("TELEGRAM_CHAT_ID")

    # Delivery strategy:
    #   both images → sendMediaGroup (album of 2, caption on structural)
    #   structural only → sendPhoto
    #   neither → skip the photo step
    # In every branch the full text digest follows as a second sendMessage.
    if has_png and has_polish:
        captions = [
            build_caption(payload, variant="structural"),
            build_caption(payload, variant="polish"),
        ]
        result = with_retries(
            lambda: send_media_group(token, chat_id, [png_path, polish_path], captions)
        )
        if not result.get("ok"):
            print(f"error: Telegram sendMediaGroup returned: {result}", file=sys.stderr)
            return 1
        mode = "album + text"
    elif has_png:
        caption = build_caption(payload)
        result = with_retries(lambda: send_photo(token, chat_id, png_path, caption))
        if not result.get("ok"):
            print(f"error: Telegram sendPhoto returned: {result}", file=sys.stderr)
            return 1
        mode = "photo + text"
    else:
        mode = "text"

    result = with_retries(lambda: send_message(token, chat_id, digest))
    if not result.get("ok"):
        print(f"error: Telegram sendMessage returned: {result}", file=sys.stderr)
        return 1

    print(f"sent digest for: {json_path} ({mode})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
