#!/usr/bin/env python3
"""
Local dev server for partner-dashboard-v2.
Serves .html files without requiring the extension in the URL,
so localhost:8080/merchant works the same as localhost:8080/merchant.html
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class HtmlExtensionHandler(SimpleHTTPRequestHandler):
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

    def log_message(self, format, *args):
        # Suppress noisy request logs
        pass

if __name__ == '__main__':
    port = 8080
    server = HTTPServer(('', port), HtmlExtensionHandler)
    print(f'Serving on http://localhost:{port}')
    print(f'  Partner dashboard → http://localhost:{port}/')
    print(f'  Merchant portal   → http://localhost:{port}/merchant')
    print(f'  Sub-partner       → http://localhost:{port}/sub-partner')
    server.serve_forever()
