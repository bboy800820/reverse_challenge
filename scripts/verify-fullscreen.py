"""Fullscreen UI and native lifecycle in an isolated browser, without user profiles."""
import os
import io
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('PARKING_URL', 'http://127.0.0.1:5189/reverse_challenge/')

def delta(a, b):
    a, b = [Image.open(io.BytesIO(data)).convert('RGB') for data in [a,b]]
    return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3

def ready(page):
    page.wait_for_function("document.querySelector('#app').dataset.assets==='ready'",timeout=60000)

def fits(page):
    for selector in ['[data-fullscreen-exit]', '[data-fullscreen-map]', '[data-shift="R"]', '[data-action="brake"]', '[data-action="throttle"]', '[data-action="left"]', '[data-action="right"]', '[data-center]', '[data-hold]', '[data-pause]', '[data-reset]', '[data-speed-label]']:
        rect = page.locator(selector).bounding_box()
        size = page.evaluate('({width:innerWidth,height:innerHeight})')
        assert rect and rect['x'] >= 0 and rect['y'] >= 0 and rect['x']+rect['width']<=size['width']+1 and rect['y']+rect['height']<=size['height']+1, (selector,rect,size)
    view=page.locator('[data-view="driver"]').bounding_box()
    assert view['height']>=100, view

def map_visible(page):
    before = page.locator('[data-view="overhead"]').screenshot()
    # Hiding cockpit and mirror DOM must not change the map's pixels.
    page.locator('.driver').evaluate('(e)=>e.style.visibility="hidden"')
    after = page.locator('[data-view="overhead"]').screenshot()
    page.locator('.driver').evaluate('(e)=>e.style.visibility="visible"')
    assert delta(before,after)<.3, 'Floating map covered by cockpit or mirror DOM'
    # Skip mirror draw calls without resizing the driver: the map still paints last.
    page.locator('.central').evaluate('(e)=>e.style.display="none"')
    after = page.locator('[data-view="overhead"]').screenshot()
    page.locator('.central').evaluate('(e)=>e.style.display=""')
    assert delta(before,after)<.3, 'Mirror framebuffer overwrites floating map'

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width':1440,'height':1080})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_function("document.querySelector('#app').dataset.assets==='ready'",timeout=60000)
    assert page.locator('button[data-fullscreen]').count() == 1, 'Missing fullscreen practice entry'
    original = page.locator('[data-view="driver"]').bounding_box()
    pose = page.locator('#app').evaluate('(e)=>[e.dataset.x,e.dataset.z,e.dataset.steer]')
    page.locator('button[data-fullscreen]').click()
    page.wait_for_function("document.fullscreenElement===document.documentElement")
    assert page.locator('#app').get_attribute('data-fullscreen') == 'true'
    assert page.locator('#app').get_attribute('data-paused') == 'true'
    assert page.locator('#app').evaluate('(e)=>[e.dataset.x,e.dataset.z,e.dataset.steer]') == pose
    assert page.locator('.practice-dock [data-shift="R"]').count() == 1
    view = page.locator('[data-view="driver"]').bounding_box()
    assert view['width'] > original['width']*1.25
    assert view['height'] > original['height']
    assert page.locator('.world-canvas').evaluate('(e)=>document.fullscreenElement.contains(e)')
    page.locator('[data-pause]').click()
    page.keyboard.press('2')
    page.wait_for_function("document.querySelector('[data-photo-gear]').textContent==='R'")
    page.locator('[data-fullscreen-map]').click()
    assert page.locator('.overhead').is_hidden()
    page.locator('[data-fullscreen-map]').click()
    assert page.locator('.overhead').is_visible()
    page.screenshot(path=str(ROOT/'assets/previews/fullscreen-left-drive.png'))
    fits(page); map_visible(page)
    page.locator('[data-hold]').click()
    page.wait_for_function("Number(document.querySelector('#app').dataset.speed)<-.1")
    page.keyboard.press('Escape')
    page.wait_for_function("!document.fullscreenElement && document.querySelector('#app').dataset.fullscreen==='false'")
    assert page.locator('#app').get_attribute('data-paused') == 'true'
    assert float(page.locator('#app').get_attribute('data-speed')) == 0
    assert page.locator('[data-hold]').get_attribute('aria-pressed') == 'true'
    assert page.locator('.sidebar [data-shift="R"]').count() == 1
    restored = page.locator('[data-view="driver"]').bounding_box()
    assert restored['width'] == original['width'] and restored['height'] == original['height']
    # Native browser exit must work without a keydown and must not resume on late Esc.
    page.locator('button[data-fullscreen]').click()
    page.wait_for_function('!!document.fullscreenElement')
    page.evaluate('document.exitFullscreen()')
    page.wait_for_function("document.querySelector('#app').dataset.fullscreen==='false'")
    assert page.locator('#app').get_attribute('data-paused') == 'true'
    for _ in range(2):
        page.locator('button[data-fullscreen]').click()
        page.locator('[data-fullscreen-exit]').click()
        page.wait_for_function("document.querySelector('#app').dataset.fullscreen==='false'")
        assert page.locator('.sidebar [data-shift="R"]').count() == 1
    page.select_option('select[data-driving-side]', 'right')
    page.locator('button[data-fullscreen]').click()
    page.locator('[data-pause]').click()
    page.keyboard.press('2'); page.wait_for_timeout(150)
    page.screenshot(path=str(ROOT/'assets/previews/fullscreen-right-drive.png'))
    assert page.locator('.photo-cabin').get_attribute('data-driving-side') == 'right'
    page.locator('[data-reset]').click()
    assert page.locator('#app').get_attribute('data-fullscreen')=='true'
    page.locator('[data-fullscreen-exit]').click()
    assert not errors, errors
    print('PASS native fullscreen, larger view, controls, map, Escape and restoration',flush=True)
    page.close()
    # Force denied native entry to test the independent in-page mode at real viewport sizes.
    for width,height in [(1920,1080),(1280,720),(844,390),(768,1024),(390,844),(320,568)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script("Element.prototype.requestFullscreen=()=>Promise.reject(new Error('Denied for test'))")
        page.goto(URL); ready(page)
        page.locator('button[data-fullscreen]').click()
        assert page.locator('#app').get_attribute('data-fullscreen')=='true'
        assert page.evaluate('document.fullscreenElement===null')
        page.locator('[data-pause]').click()
        page.keyboard.press('2'); page.wait_for_timeout(150)
        fits(page)
        steer = float(page.locator('#app').get_attribute('data-steer'))
        page.locator('[data-action="left"]').hover();page.mouse.down();page.wait_for_timeout(150);page.mouse.up()
        assert float(page.locator('#app').get_attribute('data-steer')) < steer
        page.locator('[data-center]').click()
        page.wait_for_function("Math.abs(Number(document.querySelector('#app').dataset.steer))<.001")
        if width<700:
            assert page.locator('.overhead').is_hidden()
            page.locator('[data-fullscreen-map]').click()
        map_visible(page)
        page.locator('[data-fullscreen-map]').click()
        assert page.locator('.driver').evaluate('(e)=>e.style.clipPath')==''
        # Brake pointer capture must survive moving the same nodes into the dock.
        page.locator('[data-hold]').click()
        page.wait_for_function("Number(document.querySelector('#app').dataset.speed)<-.1")
        brake=page.locator('[data-action="brake"]')
        brake.hover();page.mouse.down()
        page.wait_for_function("Number(document.querySelector('#app').dataset.speed)===0")
        page.mouse.up()
        page.locator('[data-hold]').click()
        page.screenshot(path=str(ROOT/f'assets/previews/fullscreen-{width}x{height}.png'))
        page.keyboard.press('Escape')
        assert page.locator('#app').get_attribute('data-fullscreen')=='false'
        assert page.locator('.sidebar [data-action="brake"]').count()==1
        page.close()
        print(f'PASS rejected native entry, controls, map and exit at {width}x{height}',flush=True)
    assert not errors, errors
    browser.close()
