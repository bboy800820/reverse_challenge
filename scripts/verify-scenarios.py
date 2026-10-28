"""Exercise scenario switching, interior/camera rendering and keyboard focus in Edge."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('PARKING_URL', 'http://127.0.0.1:5189/reverse_challenge/')
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width':1440, 'height':1080})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    def loaded():
        page.wait_for_function("document.querySelector('#app').dataset.assets === 'ready'", timeout=60000)
        assert page.locator('canvas.world-canvas').count() == 1
        assert page.locator('#app').get_attribute('data-ready') == 'true'
    def stopped():
        page.wait_for_function("Number(document.querySelector('#app').dataset.speed) === 0")
    loaded()
    for scene in ['mall', 'residential', 'city']:
        page.select_option('select[data-scenario]', scene)
        loaded()
        assert page.locator('#app').get_attribute('data-scenario') == scene
        assert page.locator('[data-gear]').inner_text() == 'P'
        assert page.locator('[data-hold]').get_attribute('aria-pressed') == 'true'
        assert page.locator('[data-collisions]').inner_text() == '0'
        page.wait_for_timeout(600)
        page.screenshot(path=str(ROOT / f'assets/previews/{scene}-cabin-desktop.png'), full_page=True)
        page.locator('[data-view="driver"]').focus()
        page.keyboard.press('2')
        assert page.locator('[data-gear]').inner_text() == 'R'
        page.locator('[data-hold]').click()
        page.wait_for_function("Number(document.querySelector('#app').dataset.speed) < -.1")
        page.keyboard.down('ArrowDown'); stopped()
        assert page.locator('[data-brake-label]').inner_text() == '踩下中'
        page.screenshot(path=str(ROOT / f'assets/previews/{scene}-cabin-reverse.png'), full_page=True)
        page.keyboard.up('ArrowDown')
        page.wait_for_function("Number(document.querySelector('#app').dataset.speed) < -.1")
        page.keyboard.down('Space'); stopped(); page.keyboard.up('Space')
        page.locator('[data-reset]').click()
        assert page.locator('#app').get_attribute('data-scenario') == scene
        assert page.locator('[data-gear]').inner_text() == 'P'
        print(f'PASS {scene}: load, PRND, both brakes, reset', flush=True)
    # A focused selector must not steer or apply throttle; Escape remains native.
    page.locator('select[data-scenario]').focus()
    before = page.locator('#app').get_attribute('data-steer')
    page.keyboard.press('ArrowLeft')
    assert page.locator('#app').get_attribute('data-steer') == before
    page.locator('[data-view="driver"]').focus()
    # Replace scenes while texture/model requests are still in flight.
    for scene in ['mall', 'residential', 'city', 'residential', 'mall', 'city']:
        page.select_option('select[data-scenario]', scene)
    loaded()
    assert page.locator('#app').get_attribute('data-scenario') == 'city'
    assert page.locator('[data-gear]').inner_text() == 'P'
    assert page.locator('[data-hold]').get_attribute('aria-pressed') == 'true'
    for width in [320, 390, 768]:
        page.set_viewport_size({'width':width, 'height':844}); page.wait_for_timeout(400)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        if width == 390:
            # A tall capture lets the fixed WebGL canvas paint the entire full-page
            # preview; a normal 844px viewport is checked above and in the scroll test.
            page.set_viewport_size({'width':390, 'height':1800}); page.wait_for_timeout(400)
            page.screenshot(path=str(ROOT / 'assets/previews/city-cabin-mobile.png'), full_page=True)
    assert not errors, errors
    page.close()
    # A missing street photo must leave the new layout and driving functional.
    page = browser.new_page()
    page.route('**/residential-panorama.jpg', lambda route: route.abort())
    page.goto(URL)
    page.select_option('select[data-scenario]', 'residential')
    page.wait_for_function("document.querySelector('#app').dataset.assets === 'fallback'", timeout=60000)
    assert page.locator('#app').get_attribute('data-scenery') == 'fallback'
    page.keyboard.press('2'); page.locator('[data-hold]').click()
    page.wait_for_function("Number(document.querySelector('#app').dataset.speed) < -.1")
    page.keyboard.down('Space'); stopped()
    print('PASS rapid switching, selector keyboard, responsive sizes, photo failure', flush=True)
    browser.close()

