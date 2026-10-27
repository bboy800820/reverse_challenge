"""Exercise async fallbacks, local-only asset requests, and visible camera movement."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('PARKING_URL', 'http://127.0.0.1:5187')
ROOT = Path(__file__).resolve().parent
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    for blocked in [None, '**/parking-panorama.jpg', '**/parking-light.hdr', '**/ferrari.glb', '**/asphalt_02/Diffuse.jpg']:
        page = browser.new_page(viewport={'width':1440, 'height':1000})
        errors, failed, requests = [], [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('response', lambda r: failed.append(r.url) if r.status >= 400 else None)
        page.on('request', lambda r: requests.append(r.url))
        if blocked:
            page.route(blocked, lambda route: route.abort())
        page.goto(URL)
        page.wait_for_function("['ready','fallback'].includes(document.querySelector('#app').dataset.assets)", timeout=60000)
        expected = 'fallback' if blocked else 'ready'
        assert page.locator('#app').get_attribute('data-assets') == expected
        assert page.locator('#app').get_attribute('data-scenery') == ('fallback' if blocked == '**/parking-panorama.jpg' else 'photo')
        assert not failed, failed
        assert not [r for r in requests if r.startswith('https://') and not r.startswith(URL)], requests
        before = page.locator('[data-view="rear"]').screenshot()
        z = float(page.locator('#app').get_attribute('data-z'))
        page.keyboard.press('2')
        page.locator('[data-hold]').click()
        page.wait_for_function("Number(document.querySelector('#app').dataset.z) > " + str(z + .12), timeout=15000)
        page.keyboard.down('Space')
        page.wait_for_function("Number(document.querySelector('#app').dataset.speed) === 0")
        after = page.locator('[data-view="rear"]').screenshot()
        assert before != after, 'Rear view must update with movement'
        assert page.locator('[data-brake-label]').inner_text() == '踩下中'
        if not blocked:
            page.screenshot(path=str(ROOT / 'assets/previews/photographic-reversing.png'), full_page=True)
        assert not errors, errors
        print(f'PASS assets={expected}, blocked={blocked}, R movement, live mirror, Space brake', flush=True)
        page.close()
    browser.close()
