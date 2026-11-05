import http.client
import importlib.util
from pathlib import Path
import threading
import unittest
from http.server import ThreadingHTTPServer

spec = importlib.util.spec_from_file_location('study_demo_server', Path(__file__).resolve().parents[1] / 'tools/serve.py')
server_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server_module)

class ServerBoundaryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), server_module.Handler)
        cls.worker = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.worker.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.worker.join(timeout=3)
    def request(self, path, method='GET'):
        c = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        c.request(method, path); r = c.getresponse(); data = r.read(); result = (r.status, dict(r.getheaders()), data); c.close(); return result
    def test_all_runtime_files_are_public_and_complete(self):
        for name in server_module.FILES:
            status, headers, content = self.request('/' + name)
            self.assertEqual(status, 200)
            self.assertEqual(content, (server_module.ROOT / name).read_bytes())
            self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
    def test_private_or_non_runtime_paths_are_not_served(self):
        for name in ['/.git/config', '/../README.md', '/%2e%2e/README.md', '/LICENSE', '/banks/demo.json', '/app.js?private=1', '//../README.md']:
            self.assertEqual(self.request(name)[0], 404, name)
    def test_head_has_correct_length_without_a_body(self):
        status, headers, body = self.request('/', 'HEAD')
        self.assertEqual(status, 200); self.assertEqual(body, b'')
        self.assertEqual(int(headers['Content-Length']), (server_module.ROOT / 'index.html').stat().st_size)
    def test_writes_have_no_endpoint(self):
        self.assertEqual(self.request('/bank', 'POST')[0], 501)

if __name__ == '__main__': unittest.main()
