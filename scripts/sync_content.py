"""Publish a complete Google snapshot; failed downloads never replace the live snapshot."""
import base64
from contextlib import contextmanager
import hashlib
import io
import json
from pathlib import Path
import shutil
import ssl
import time
import uuid
import urllib.parse
import urllib.request

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]


@contextmanager
def staging_directory(root):
    stage = root.resolve() / ('.sync-' + uuid.uuid4().hex)
    stage.mkdir()
    try:
        yield stage
    finally:
        if stage.parent != root.resolve() or not stage.name.startswith('.sync-'):
            raise ValueError('Unsafe staging path')
        shutil.rmtree(stage)


def download(url):
    if urllib.parse.urlparse(url).scheme != 'https':
        raise ValueError('Image and API URLs must use HTTPS')
    context = ssl.create_default_context()
    # Git for Windows supplies a CA bundle on the local development machine.
    bundle = Path('C:/Program Files/Git/mingw64/etc/ssl/certs/ca-bundle.crt')
    if bundle.exists():
        context.load_verify_locations(str(bundle))
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, context=context, timeout=90) as response:
                body = response.read(32 * 1024 * 1024 + 1)
            if len(body) > 32 * 1024 * 1024:
                raise ValueError('Download exceeds 32 MiB')
            return body
        except (OSError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def synchronize(root=ROOT, fetch=download):
    endpoint = json.loads((root / 'config.json').read_text())['endpoint']
    data = json.loads(fetch(endpoint))
    if data.get('error'):
        raise ValueError(data['error'])
    if not all(isinstance(data.get(key), list) for key in ('pages', 'works', 'home')):
        raise ValueError('Incomplete Google snapshot')
    converted = {}
    with staging_directory(root) as stage:
        media = stage / 'media'
        media.mkdir()

        def image(record):
            if not record:
                return None
            key = ('url', record['url']) if record.get('url') else ('id', record['id'])
            if key not in converted:
                if key[0] == 'url':
                    raw = fetch(key[1])
                else:
                    result = json.loads(fetch(endpoint + '?' + urllib.parse.urlencode({'action': 'image', 'id': key[1]})))
                    if result.get('error'):
                        raise ValueError(result['error'])
                    raw = base64.b64decode(result['base64'], validate=True)
                with Image.open(io.BytesIO(raw)) as original:
                    photo = ImageOps.exif_transpose(original)
                    photo.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
                    photo = photo.convert('RGBA' if 'A' in photo.getbands() else 'RGB')
                    output = io.BytesIO()
                    photo.save(output, 'WEBP', quality=85, method=6)
                encoded = output.getvalue()
                name = hashlib.sha256(encoded).hexdigest()[:24] + '.webp'
                (media / name).write_bytes(encoded)
                converted[key] = {'url': 'content/media/' + name}
            return converted[key]

        for work in data['works']:
            work['images'] = [image(record) for record in work['images']]
            work['cover'] = image(work.get('cover'))
        for item in data['home']:
            item['cover'] = image(item.get('cover'))
        (stage / 'site.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        # Only touch published files after every image has been processed successfully.
        destination = root / 'content'
        (destination / 'media').mkdir(parents=True, exist_ok=True)
        for source in media.iterdir():
            shutil.copyfile(source, destination / 'media' / source.name)
        shutil.copyfile(stage / 'site.json', destination / 'site.json')
        expected = {source.name for source in media.iterdir()}
        for existing in (destination / 'media').glob('*.webp'):
            if existing.name not in expected:
                existing.unlink()
    size = sum(file.stat().st_size for file in (root / 'content' / 'media').glob('*.webp'))
    print(f"Published {len(data['pages'])} pages, {len(data['works'])} galleries, {len(converted)} images ({size / 1024:.0f} KiB)")


if __name__ == '__main__':
    synchronize()
