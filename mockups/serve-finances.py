#!/usr/bin/env python3
# Second static server for the Babun2 mockups folder — finances session.
# Port 4322, serves the same ./ dir, "/" -> finances-redesign.html.
# Runs alongside serve.py (4321, clients) so two sessions don't fight
# over a single preview page.
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 4322


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def translate_path(self, path):
        # Map "/" to the finances mockup, then defer to default handling.
        if path in ("/", ""):
            path = "/finances-redesign.html"
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("[serve-finances.py] " + (fmt % args))


if __name__ == "__main__":
    print(f"Babun2 finances mockup server running at http://localhost:{PORT}/")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
