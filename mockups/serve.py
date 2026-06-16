#!/usr/bin/env python3
# Zero-dependency static server for the Babun2 mockups folder.
# Mirrors serve.mjs: port 4321, serves ./mockups, "/" -> clients-current.html.
# Fallback runtime for machines without Node installed.
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 4321


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def translate_path(self, path):
        # Map "/" to the clients mockup, then defer to default handling.
        if path in ("/", ""):
            path = "/clients-current.html"
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Keep stdout quiet but visible for debugging.
        print("[serve.py] " + (fmt % args))


if __name__ == "__main__":
    print(f"Babun2 mockups server running at http://localhost:{PORT}/")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
