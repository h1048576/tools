"""本地开发服务器：给所有响应加 no-cache 头，保证改动后刷新即生效。

用法：python server.py  （默认 127.0.0.1:8642）
"""
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8642
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    print(f"Serving at http://127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler).serve_forever()
