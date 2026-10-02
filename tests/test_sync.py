import base64
import io
import json
import unittest
from urllib.parse import parse_qs, urlparse

from PIL import Image
from scripts.sync_content import ROOT, staging_directory, synchronize


class SyncTests(unittest.TestCase):
    def test_snapshot_optimization_deduplication_and_removal(self):
        with staging_directory(ROOT) as root:
            (root / 'config.json').write_text('{"endpoint":"https://example.com/exec"}')
            buffer = io.BytesIO()
            Image.new('RGB', (3000, 1500), 'red').save(buffer, 'JPEG')
            data = {'pages': [{'slug': 'test', 'title': 'Test'}], 'home': [], 'works': [
                {'id': 'test', 'images': [{'id': 'one'}, {'id': 'one'}], 'cover': {'id': 'one'}}]}
            calls = []

            def fetch(url):
                if not urlparse(url).query:
                    return json.dumps(data).encode()
                calls.append(parse_qs(urlparse(url).query)['id'][0])
                return json.dumps({'base64': base64.b64encode(buffer.getvalue()).decode()}).encode()

            synchronize(root, fetch)
            saved = json.loads((root / 'content/site.json').read_text())
            self.assertEqual(calls, ['one'])
            self.assertEqual(saved['works'][0]['cover'], saved['works'][0]['images'][0])
            files = list((root / 'content/media').glob('*.webp'))
            self.assertEqual(len(files), 1)
            with Image.open(files[0]) as photo:
                self.assertEqual(photo.size, (2048, 1024))
            before = (root / 'content/site.json').read_bytes()
            data['works'][0]['images'].append({'id': 'broken'})

            def failing(url):
                if 'id=broken' in url:
                    return b'{"error":"Google unavailable"}'
                return fetch(url)

            with self.assertRaises(ValueError):
                synchronize(root, failing)
            self.assertEqual((root / 'content/site.json').read_bytes(), before)
            self.assertTrue(files[0].exists())
            data['works'] = []
            synchronize(root, fetch)
            self.assertEqual(list((root / 'content/media').glob('*.webp')), [])

    def test_incomplete_metadata_does_not_publish(self):
        with staging_directory(ROOT) as root:
            (root / 'config.json').write_text('{"endpoint":"https://example.com/exec"}')
            with self.assertRaises(ValueError):
                synchronize(root, lambda url: b'{"pages":[]}')
            self.assertFalse((root / 'content').exists())
