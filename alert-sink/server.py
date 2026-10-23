import os
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

class AlertHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else ""
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S UTC')
        print(f"[{timestamp}] [ALERT_RECEIVED] Payload: {post_data}", flush=True)

        os.makedirs('/var/log/alerts', exist_ok=True)
        with open('/var/log/alerts/alerts.log', 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] {post_data}\n")

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"status":"ok","message":"alert received"}')

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(b"alert-sink is active")

    def log_message(self, format, *args):
        sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")
        sys.stdout.flush()

if __name__ == '__main__':
    print("Starting alert-sink receiver on port 8080...", flush=True)
    server = HTTPServer(('0.0.0.0', 8080), AlertHandler)
    server.serve_forever()
