"""Download pinned local visual assets; no third-party requests at runtime."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'app/public/assets/realistic'
DEST.mkdir(parents=True, exist_ok=True)
previous = {item['file']: item for item in json.loads((DEST / 'manifest.json').read_text())} if (DEST / 'manifest.json').exists() else {}

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'ReverseParkingLab/0.1'}), timeout=90) as response:
        return response.read()

jobs = []
for name, maps in [('asphalt_02', ['Diffuse', 'nor_gl', 'Rough']), ('concrete_layers_02', ['Diffuse', 'nor_gl']), ('leafy_grass', ['Diffuse'])]:
    meta = json.loads(fetch(f'https://api.polyhaven.com/files/{name}'))
    for kind in maps:
        info = meta[kind]['1k']['jpg']
        jobs.append((f'{name}/{kind}.jpg', info['url'], info['md5']))
sky = 'kloofendal_48d_partly_cloudy_puresky'
meta = json.loads(fetch(f'https://api.polyhaven.com/files/{sky}'))
info = meta['hdri']['1k']['hdr']
jobs.append(('daylight.hdr', info['url'], info['md5']))
parking = json.loads(fetch('https://api.polyhaven.com/files/mall_parking_lot'))
for filename, info in [('parking-panorama.jpg', parking['tonemapped']), ('parking-light.hdr', parking['hdri']['1k']['hdr'])]:
    jobs.append((filename, info['url'], info['md5']))
jobs.append(('ferrari.glb', 'https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/models/gltf/ferrari.glb', None))
for prefix, name in [('residential', 'urban_street_03'), ('city', 'urban_street_02')]:
    street = json.loads(fetch(f'https://api.polyhaven.com/files/{name}'))
    for filename, info in [(f'{prefix}-panorama.jpg', street['tonemapped']), (f'{prefix}-light.hdr', street['hdri']['1k']['hdr'])]:
        jobs.append((filename, info['url'], info['md5']))
jobs.append(('draco/LICENSE', 'https://raw.githubusercontent.com/google/draco/1.5.7/LICENSE', None))

def download(job):
    name, url, md5 = job
    target = DEST / name
    old = previous.get(name, {})
    if name == 'ferrari.glb' and old.get('optimization') and target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == old['sha256']:
        return old
    content = target.read_bytes() if target.exists() else fetch(url)
    if md5 and hashlib.md5(content).hexdigest() != md5:
        raise ValueError(f'Checksum mismatch: {name}')
    target.parent.mkdir(parents=True, exist_ok=True)
    record = {'file': name, 'source': url}
    if name == 'ferrari.glb':
        record['source_sha256'] = hashlib.sha256(content).hexdigest()
        subprocess.run(['npx.cmd', '--yes', '@gltf-transform/cli@4.5.1', '--version'], check=True)
        cache = Path(subprocess.check_output(['npm.cmd', 'config', 'get', 'cache'], text=True).strip())
        tool_roots = [p.parent.parent.parent.parent for p in (cache / '_npx').glob('*/node_modules/@gltf-transform/cli/package.json') if json.loads(p.read_text())['version'] == '4.5.1']
        if not tool_roots:
            raise RuntimeError('Pinned glTF Transform tool package not found')
        with tempfile.TemporaryDirectory(prefix='reverse-parking-assets-') as temporary:
            source = Path(temporary) / 'source.glb'
            source.write_bytes(content)
            subprocess.run(['node', str(ROOT / 'scripts/optimize-vehicle.cjs'), str(tool_roots[0]), str(source), str(target)], check=True)
        content = target.read_bytes()
        record['optimization'] = 'glTF Transform 4.5.1; remove unused attributes, weld, simplify ratio 0.15/error 0.005, rebuild smooth normals, Draco; scripts/optimize-vehicle.cjs'
    else:
        target.write_bytes(content)
    return {**record, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    records = list(pool.map(download, jobs))
decoder = ROOT / 'app/node_modules/three/examples/jsm/libs/draco/gltf'
(DEST / 'draco').mkdir(exist_ok=True)
for name in ['draco_wasm_wrapper.js', 'draco_decoder.wasm']:
    shutil.copyfile(decoder / name, DEST / 'draco' / name)
    records.append({'file': f'draco/{name}', 'source': 'three@0.186.1 / Google Draco', 'bytes': (DEST / 'draco' / name).stat().st_size, 'sha256': hashlib.sha256((DEST / 'draco' / name).read_bytes()).hexdigest()})
(DEST / 'manifest.json').write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8')
print(f'{len(records)} files, {sum(x["bytes"] for x in records):,} bytes')
