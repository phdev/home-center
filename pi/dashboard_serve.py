#!/usr/bin/env python3
"""HTTP server for the Pi kiosk dashboard.

Replaces the bare `python3 -m http.server` previously run by
dashboard-local.service. Adds `Cache-Control: no-store` so a fresh page
load (or Chromium reload) always picks up the latest deployed bundle —
no more fighting browser caches after rsyncing a new dist/.

Usage:  dashboard_serve.py [PORT] [ROOT]
Defaults: PORT=8080, ROOT=current working directory.
Binds to 127.0.0.1 only — exposing the kiosk to the LAN was never the goal.
"""

import http.server
import socketserver
import sys
from pathlib import Path


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    root = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else Path.cwd()
    if not root.is_dir():
        sys.exit(f"root not a directory: {root}")

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(root), **kw)

        def end_headers(self):
            self.send_header("Cache-Control", "no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            super().end_headers()

    class Server(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True

    with Server(("127.0.0.1", port), Handler) as srv:
        print(f"Serving {root} at http://127.0.0.1:{port}/", flush=True)
        srv.serve_forever()


if __name__ == "__main__":
    main()
