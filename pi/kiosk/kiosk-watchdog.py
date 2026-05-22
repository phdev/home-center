#!/usr/bin/env python3
"""Watch the Home Center Chromium kiosk and recover renderer crashes.

Chromium's "Aw, Snap" state can leave the browser process alive while the
dashboard is no longer rendering. The kiosk launches Chromium with the DevTools
HTTP endpoint bound to localhost; this watchdog polls that endpoint and restarts
LightDM when the Home Center tab is missing or crashed for several checks.
"""

from __future__ import annotations

import json
import base64
import hashlib
import os
import socket
import subprocess
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse


DEBUG_BASE = "http://127.0.0.1:9222"
HOME_URL_FRAGMENT = "localhost:8080/home-center"
CHECK_INTERVAL_SECONDS = 30
FAILURES_BEFORE_RESTART = 3
RESTART_COOLDOWN_SECONDS = 180
RENDERER_EVALUATION_TIMEOUT_SECONDS = 3.0


HEALTH_EXPRESSION = r"""
(() => {
  const root = document.getElementById("root");
  const bodyText = (document.body?.innerText || "").trim();
  return {
    title: document.title || "",
    href: location.href || "",
    readyState: document.readyState || "",
    rootChildren: root ? root.childElementCount : 0,
    rootTextLength: root ? (root.innerText || "").trim().length : 0,
    bodyText: bodyText.slice(0, 500),
    hasViteErrorOverlay: !!document.querySelector("vite-error-overlay"),
  };
})()
"""


def fetch_json(path: str, timeout: float = 3.0):
    with urllib.request.urlopen(f"{DEBUG_BASE}{path}", timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def _recv_exact(sock: socket.socket, size: int) -> bytes:
    chunks = []
    remaining = size
    while remaining > 0:
        chunk = sock.recv(remaining)
        if not chunk:
            raise RuntimeError("websocket closed")
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def _read_ws_frame(sock: socket.socket) -> str:
    header = _recv_exact(sock, 2)
    opcode = header[0] & 0x0F
    length = header[1] & 0x7F
    if length == 126:
        length = int.from_bytes(_recv_exact(sock, 2), "big")
    elif length == 127:
        length = int.from_bytes(_recv_exact(sock, 8), "big")

    masked = bool(header[1] & 0x80)
    mask = _recv_exact(sock, 4) if masked else b""
    payload = _recv_exact(sock, length) if length else b""
    if masked:
        payload = bytes(byte ^ mask[i % 4] for i, byte in enumerate(payload))

    if opcode == 1:
        return payload.decode("utf-8")
    if opcode == 8:
        raise RuntimeError("websocket closed")
    return ""


def _send_ws_text(sock: socket.socket, text: str) -> None:
    payload = text.encode("utf-8")
    mask = os.urandom(4)
    first = bytes([0x81])
    if len(payload) < 126:
        header = first + bytes([0x80 | len(payload)])
    elif len(payload) < 65536:
        header = first + bytes([0x80 | 126]) + len(payload).to_bytes(2, "big")
    else:
        header = first + bytes([0x80 | 127]) + len(payload).to_bytes(8, "big")
    masked = bytes(byte ^ mask[i % 4] for i, byte in enumerate(payload))
    sock.sendall(header + mask + masked)


def _websocket_request(ws_url: str, payload: dict, timeout: float) -> dict:
    url = urlparse(ws_url)
    if url.scheme != "ws":
        raise RuntimeError(f"unsupported websocket scheme: {url.scheme}")

    host = url.hostname or "127.0.0.1"
    port = url.port or 80
    path = url.path or "/"
    if url.query:
        path = f"{path}?{url.query}"

    key = base64.b64encode(os.urandom(16)).decode("ascii")
    expected_accept = base64.b64encode(hashlib.sha1(
        f"{key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11".encode("ascii"),
    ).digest()).decode("ascii")

    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.settimeout(timeout)
        request = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            "\r\n"
        )
        sock.sendall(request.encode("ascii"))
        response = b""
        while b"\r\n\r\n" not in response:
            response += sock.recv(4096)
            if len(response) > 16384:
                raise RuntimeError("websocket handshake too large")

        header_text = response.decode("iso-8859-1", errors="replace").lower()
        if " 101 " not in header_text or expected_accept.lower() not in header_text:
            raise RuntimeError("websocket handshake failed")

        _send_ws_text(sock, json.dumps(payload))
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            raw = _read_ws_frame(sock)
            if not raw:
                continue
            message = json.loads(raw)
            if message.get("id") == payload.get("id"):
                return message
        raise RuntimeError("websocket response timeout")


def evaluate_page_health(page: dict, timeout: float = RENDERER_EVALUATION_TIMEOUT_SECONDS) -> tuple[bool, str]:
    ws_url = page.get("webSocketDebuggerUrl")
    if not ws_url:
        return False, "devtools websocket missing"

    message = _websocket_request(ws_url, {
        "id": 1,
        "method": "Runtime.evaluate",
        "params": {
            "expression": HEALTH_EXPRESSION,
            "returnByValue": True,
            "timeout": int(timeout * 1000),
        },
    }, timeout)

    if message.get("error"):
        return False, f"renderer evaluation error: {message['error'].get('message', 'unknown')}"

    result = message.get("result", {})
    if result.get("exceptionDetails"):
        return False, "renderer evaluation exception"

    value = result.get("result", {}).get("value")
    if not isinstance(value, dict):
        return False, "renderer health returned no document state"

    title = str(value.get("title", "")).lower()
    body_text = str(value.get("bodyText", "")).lower()
    ready_state = value.get("readyState")
    root_children = int(value.get("rootChildren") or 0)

    if "aw, snap" in title or "sad tab" in title or "aw, snap" in body_text:
        return False, "chromium aw snap page visible"
    if value.get("hasViteErrorOverlay"):
        return False, "vite error overlay visible"
    if ready_state not in {"interactive", "complete"}:
        return False, f"document not ready: {ready_state}"
    if root_children <= 0:
        return False, "home center root is empty"

    return True, "ok"


def kiosk_state() -> tuple[bool, str]:
    try:
        pages = fetch_json("/json/list")
    except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
        return False, f"devtools unavailable: {exc}"

    home_pages = [
        page for page in pages
        if HOME_URL_FRAGMENT in str(page.get("url", ""))
    ]
    if not home_pages:
        return False, "home center tab missing"

    for page in home_pages:
        title = str(page.get("title", "")).lower()
        if "aw, snap" in title or "sad tab" in title:
            return False, f"chromium crashed tab: {page.get('title')}"
        try:
            ok, reason = evaluate_page_health(page)
        except Exception as exc:
            return False, f"renderer probe failed: {exc}"
        if not ok:
            return False, reason

    return True, "ok"


def restart_kiosk(reason: str) -> None:
    print(f"[kiosk-watchdog] restarting lightdm: {reason}", flush=True)
    subprocess.run(["systemctl", "restart", "lightdm"], check=False)


def main() -> None:
    failures = 0
    last_restart = 0.0

    while True:
        ok, reason = kiosk_state()
        if ok:
            if failures:
                print("[kiosk-watchdog] recovered without restart", flush=True)
            failures = 0
        else:
            failures += 1
            print(
                f"[kiosk-watchdog] unhealthy ({failures}/{FAILURES_BEFORE_RESTART}): {reason}",
                flush=True,
            )
            now = time.monotonic()
            if (
                failures >= FAILURES_BEFORE_RESTART
                and now - last_restart >= RESTART_COOLDOWN_SECONDS
            ):
                restart_kiosk(reason)
                last_restart = now
                failures = 0

        time.sleep(CHECK_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
