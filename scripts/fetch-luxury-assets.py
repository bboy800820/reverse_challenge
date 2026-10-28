"""Fetch only two pinned CC BY car models; preserve attribution and source hashes."""
import hashlib
import json
from pathlib import Path
import urllib.request

DEST = Path(__file__).resolve().parents[1] / 'app/public/assets/luxury'
REVISION = '2d18dfd9db96bbf0d9cffa949deaf7f571388cbf'
BASE = f'https://raw.githubusercontent.com/pedrosoandre/carros/{REVISION}/'
DEST.mkdir(parents=True, exist_ok=True)
def fetch(url):
    with urllib.request.urlopen(url, timeout=90) as response:
        return response.read()
catalog = json.loads(fetch(BASE + 'cars.json'))['cars']
records = []
for name in ['lamborghini-aventador-lp700-4', 'rolls-royce-cullinan']:
    record = next(c for c in catalog if c['id'] == name)
    assert record['credit']['license'] == 'CC Attribution'
    path = DEST / record['file']
    data = path.read_bytes() if path.exists() else fetch(BASE + 'assets/' + record['file'])
    assert len(data) == record['bytes'], name
    path.write_bytes(data)
    records.append({**record, 'source': BASE + 'assets/' + record['file'], 'sha256': hashlib.sha256(data).hexdigest()})
(DEST / 'manifest.json').write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8')
print(f'{len(records)} models, {sum(r["bytes"] for r in records):,} bytes; CC BY author records saved')
