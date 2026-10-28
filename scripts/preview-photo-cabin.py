"""Capture the integrated photographic cockpit and luxury fleet, using isolated Edge."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('PARKING_URL', 'http://127.0.0.1:5189/reverse_challenge/')
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width':1440,'height':1080})
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    for scene in ['mall','residential','city']:
        page.select_option('select[data-scenario]', scene)
        page.wait_for_function("document.querySelector('#app').dataset.assets === 'ready'", timeout=60000)
        assert page.locator('#app').get_attribute('data-cabin') == 'photo'
        page.wait_for_timeout(400)
        page.screenshot(path=str(ROOT / f'assets/previews/photo-cabin-{scene}.png'), full_page=True)
        page.locator('[data-view="driver"]').focus();page.keyboard.press('2')
        page.wait_for_timeout(400)
        page.screenshot(path=str(ROOT / f'assets/previews/photo-cabin-{scene}-reverse.png'), full_page=True)
        print('PASS photographic cockpit:', scene, flush=True)
    page.set_viewport_size({'width':390,'height':1600});page.wait_for_timeout(500)
    page.screenshot(path=str(ROOT / 'assets/previews/photo-cabin-mobile.png'), full_page=True)
    assert not errors, errors
    print(json.dumps({'errors':errors}),flush=True)
    browser.close()
