#!/usr/bin/env python3
"""
Local dev server for partner-dashboard-v2.

- Serves .html files without requiring the extension in the URL,
  so localhost:8080/merchant works the same as localhost:8080/merchant.html
- Sends no-cache headers so a plain browser reload always picks up edits
  (important during demos / iterative design work).

Usage:
  python3 serve.py            # port 8080
  python3 serve.py 8090       # custom port
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import sys

class DevHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # Strip query string and fragment for path resolution
        path = self.path.split('?')[0].split('#')[0]
        # If the bare path doesn't exist but the .html version does, rewrite
        if not path.endswith('/') and not path.endswith('.html'):
            fs_path = self.translate_path(path)
            if not os.path.exists(fs_path):
                html_fs_path = self.translate_path(path + '.html')
                if os.path.exists(html_fs_path):
                    self.path = path + '.html'
        super().do_GET()

    def end_headers(self):
        # Defeat browser caching so reloads always show the latest edit
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        pass  # Suppress noisy request logs

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = HTTPServer(('', port), DevHandler)
    print(f'Serving on http://localhost:{port}')
    print(f'  Partner dashboard -> http://localhost:{port}/')
    print(f'  Merchant portal   -> http://localhost:{port}/merchant')
    print(f'  Sub-partner       -> http://localhost:{port}/sub-partner')
    server.serve_forever()
