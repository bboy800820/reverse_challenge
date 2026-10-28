"""Check photo integration, live controls, mirror compositing and safe fallbacks."""
import io
import os
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('PARKING_URL', 'http://127.0.0.1:5188/reverse_challenge/')
def difference(a, b):
    a = Image.open(io.BytesIO(a)).convert('RGB'); b = Image.open(io.BytesIO(b)).convert('RGB')
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3
dashboard = Image.open(ROOT / 'app/public/assets/cabin/dashboard.png')
assert dashboard.mode == 'RGBA' and dashboard.getpixel((800,250))[3] == 0
assert dashboard.getpixel((1400,800))[3] > 240

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width':1440, 'height':1080})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL)
    page.wait_for_function("document.querySelector('#app').dataset.assets==='ready'", timeout=60000)
    assert page.locator('.photo-cabin img').count() == 2
    assert page.locator('.photo-instruments').is_visible()
    assert page.locator('.photo-fascia').bounding_box()['width'] > 900
    # The live mirror must not be covered by the photo's A pillar or dashboard.
    for name in ['left','right','rear']:
        mirror = page.locator(f'[data-view="{name}"]')
        before = mirror.screenshot()
        page.locator('.photo-cabin').evaluate('(e)=>e.style.visibility="hidden"')
        after = mirror.screenshot()
        page.locator('.photo-cabin').evaluate('(e)=>e.style.visibility="visible"')
        delta=difference(before,after)
        assert delta < .3, f'{name} mirror obscured by photo: {delta}'
    page.locator('[data-view="driver"]').focus()
    before = page.locator('.photo-wheel').evaluate('(e)=>getComputedStyle(e).transform')
    page.keyboard.down('ArrowLeft');page.wait_for_timeout(500);page.keyboard.up('ArrowLeft')
    assert page.locator('.photo-wheel').evaluate('(e)=>getComputedStyle(e).transform') != before
    page.keyboard.press('2');page.wait_for_timeout(150)
    assert page.locator('[data-photo-gear]').text_content() == 'R'
    assert page.locator('.photo-monitor-info').is_hidden()
    assert page.locator('.photo-reverse-label').is_visible()
    assert page.locator('.photo-cabin img').count() == 2
    assert not errors,errors
    page.close()
    for blocked in ['**/cabin/dashboard.png','**/cabin/wheel.png','**/luxury/rolls-royce-cullinan.glb']:
        page = browser.new_page(viewport={'width':1440,'height':1080})
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.route(blocked, lambda route:route.abort())
        page.goto(URL)
        page.wait_for_function("document.querySelector('#app').dataset.assets==='fallback'",timeout=60000)
        if '/cabin/' in blocked:
            assert page.locator('#app').get_attribute('data-cabin') == 'fallback'
            assert page.locator('.photo-cabin').is_hidden()
        page.keyboard.press('2');page.locator('[data-hold]').click()
        page.wait_for_function("Number(document.querySelector('#app').dataset.speed)<-.1")
        page.keyboard.down('Space');page.wait_for_function("Number(document.querySelector('#app').dataset.speed)===0")
        assert not errors,errors
        print('PASS safe fallback:',blocked,flush=True)
        page.close()
    browser.close()
print('PASS transparent photo, intact DOM, live wheel/gauges, unobscured mirrors, reverse display',flush=True)
