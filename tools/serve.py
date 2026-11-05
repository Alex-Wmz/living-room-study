"""Serve only the demo's explicit public files; loopback by default."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import argparse

HERE = Path(__file__).resolve().parent
ROOT = HERE if (HERE / 'index.html').is_file() else HERE.parent / 'web'
FILES = {'index.html': 'text/html; charset=utf-8', 'style.css': 'text/css; charset=utf-8',
         'app.js': 'text/javascript; charset=utf-8', 'core.js': 'text/javascript; charset=utf-8',
         'demo-bank.js': 'text/javascript; charset=utf-8', 'mark.svg': 'image/svg+xml'}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self): self.respond(True)
    def do_HEAD(self): self.respond(False)
    def respond(self, body):
        url = urlsplit(self.path)
        name = 'index.html' if url.path == '/' else url.path.removeprefix('/')
        if url.query or name not in FILES:
            self.send_error(404); return
        file = ROOT / name
        if not file.is_file(): self.send_error(404); return
        data = file.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', FILES[name])
        self.send_header('Content-Length', str(len(data)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        if body: self.wfile.write(data)
    def log_message(self, *args): pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8947)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535: parser.error('port must be 1024–65535')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Demo: http://127.0.0.1:{server.server_port}/ (Ctrl+C to stop)', flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__ == '__main__': main()
