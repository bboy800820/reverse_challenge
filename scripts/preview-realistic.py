"""Capture the loaded, live scene using an isolated Edge profile."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ.get('PARKING_URL', 'http://127.0.0.1:5187'))
    page.wait_for_function("['ready','fallback'].includes(document.querySelector('#app').dataset.assets)", timeout=60000)
    page.wait_for_timeout(1500)
    print(json.dumps({'assets':page.locator('#app').get_attribute('data-assets'), 'errors':errors}))
    page.screenshot(path=str(root / 'assets/previews/photographic-desktop.png'), full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(700)
    page.screenshot(path=str(root / 'assets/previews/photographic-mobile.png'), full_page=True)
    browser.close()
