"""Exercise real LHD/RHD views and controls in isolated Edge; no user profile."""
import os
import io
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('PARKING_URL', 'http://127.0.0.1:5189/reverse_challenge/')

def difference(a, b, inset=0):
    a = Image.open(io.BytesIO(a)).convert('RGB')
    b = Image.open(io.BytesIO(b)).convert('RGB')
    if inset:
        # Fractional CSS bounds include an antialiased outer edge in screenshots.
        # Compare the mirror face, excluding only its outer two border pixels.
        box = (inset, inset, a.width-inset, a.height-inset)
        a, b = a.crop(box), b.crop(box)
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean)/3

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width':1440,'height':1080})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL)
    page.wait_for_function("document.querySelector('#app').dataset.assets !== 'loading'", timeout=60000)
    assert page.locator('select[data-driving-side]').count() == 1, 'Missing driver-seat selector'
    selector = page.locator('select[data-driving-side]')
    assert selector.input_value() == 'left'
    page.wait_for_timeout(150)
    overhead_before = page.locator('[data-view="overhead"]').screenshot()
    rect = page.locator('[data-view="driver"]').bounding_box()
    windshield = dict(x=rect['x']+rect['width']*.35, y=rect['y']+rect['height']*.3,
                      width=rect['width']*.3, height=rect['height']*.18)
    road_before = page.screenshot(clip=windshield)
    pose = page.locator('#app').evaluate('(e)=>[e.dataset.x,e.dataset.z,e.dataset.steer]')
    selector.select_option('right')
    page.wait_for_timeout(150)
    assert difference(overhead_before, page.locator('[data-view="overhead"]').screenshot()) < .3, 'World must not reflect'
    assert difference(road_before, page.screenshot(clip=windshield)) > .3, 'Eye viewpoint must move'
    assert page.locator('#app').get_attribute('data-driving-side') == 'right'
    assert page.locator('#app').evaluate('(e)=>[e.dataset.x,e.dataset.z,e.dataset.steer]') == pose
    assert page.locator('[data-hold]').get_attribute('aria-pressed') == 'true'
    assert page.locator('[data-view="driver"]').evaluate('(e)=>document.activeElement===e')
    page.keyboard.down('ArrowUp')
    selector.select_option('left'); selector.select_option('right')
    page.keyboard.down('ArrowUp')  # Held-key repeat after returning focus must remain braked.
    page.wait_for_timeout(150)
    assert float(page.locator('#app').get_attribute('data-speed')) == 0
    page.keyboard.up('ArrowUp')
    assert page.locator('[data-action="throttle"]').get_attribute('data-active') == 'false'
    wheel = page.locator('.photo-wheel').bounding_box()
    monitor = page.locator('.photo-monitor').bounding_box()
    assert wheel['x'] + wheel['width']/2 > monitor['x'] + monitor['width']/2
    for name in ['left','right','rear']:
        mirror = page.locator(f'[data-view="{name}"]')
        before = mirror.screenshot()
        page.locator('.photo-cabin').evaluate('(e)=>e.style.visibility="hidden"')
        after = mirror.screenshot()
        page.locator('.photo-cabin').evaluate('(e)=>e.style.visibility="visible"')
        assert difference(before, after) < .3, f'{name} mirror covered by RHD fascia'
    page.keyboard.press('2')
    page.wait_for_timeout(250)
    assert page.locator('[data-photo-gear]').text_content() == 'R'
    assert page.locator('.photo-reverse-label').is_visible()
    page.screenshot(path=str(ROOT/'assets/previews/right-drive-mall.png'), full_page=True)
    page.locator('[data-hold]').click()
    page.wait_for_function("Number(document.querySelector('#app').dataset.speed)<-.1")
    selector.select_option('left')
    assert selector.input_value() == 'right', 'Moving seat switch must be rejected'
    page.keyboard.down('Space')
    page.wait_for_function("Number(document.querySelector('#app').dataset.speed)===0")
    page.locator('[data-hold]').click()
    page.keyboard.up('Space')
    page.keyboard.down('ArrowRight'); page.wait_for_timeout(150); page.keyboard.up('ArrowRight')
    assert float(page.locator('#app').get_attribute('data-steer')) > 0
    pose = page.locator('#app').evaluate('(e)=>[e.dataset.x,e.dataset.z,e.dataset.steer]')
    selector.select_option('left')
    assert page.locator('#app').evaluate('(e)=>[e.dataset.x,e.dataset.z,e.dataset.steer]') == pose
    assert page.locator('[data-photo-gear]').text_content() == 'R'
    selector.select_option('right')
    for scenario in ['residential','city','mall']:
        page.select_option('select[data-scenario]', scenario)
        page.wait_for_function("document.querySelector('#app').dataset.assets !== 'loading'", timeout=60000)
        assert selector.input_value() == 'right'
        assert page.locator('.photo-cabin').get_attribute('data-driving-side') == 'right'
        page.keyboard.press('2')
        page.wait_for_timeout(200)
        if scenario == 'residential':
            page.screenshot(path=str(ROOT/'assets/previews/right-drive-residential.png'), full_page=True)
    page.reload()
    page.wait_for_function("document.querySelector('#app').dataset.assets !== 'loading'", timeout=60000)
    assert selector.input_value() == 'right'
    page.locator('[data-reset]').click()
    assert selector.input_value() == 'right'
    page.keyboard.press('4'); page.locator('[data-hold]').click()
    page.wait_for_function("Number(document.querySelector('#app').dataset.speed)>.1")
    page.keyboard.down('ArrowDown')
    page.wait_for_function("Number(document.querySelector('#app').dataset.speed)===0")
    page.locator('[data-hold]').click(); page.keyboard.up('ArrowDown')
    page.locator('[data-reset]').click()
    page.locator('[data-pause]').click()
    selector.select_option('left')
    assert page.locator('#app').get_attribute('data-paused') == 'true'
    selector.select_option('right')
    page.locator('[data-pause]').click()
    page.keyboard.press('2')
    for width in [860,390,320]:
        page.set_viewport_size({'width':width,'height':1200})
        page.wait_for_timeout(250)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert page.locator('label[for="scenario"]').bounding_box()['height'] < 30, 'Scenario label must stay horizontal'
        # The new left-hand monitor opening must expose, not cover, the live R image.
        view = page.locator('[data-view="driver"]').bounding_box()
        screen = page.locator('.photo-monitor').bounding_box()
        left = max(screen['x']+screen['width']*.1, view['x']+2)
        right = min(screen['x']+screen['width']*.9, view['x']+view['width']-2)
        if right > left:
            clip = dict(x=left,y=screen['y']+screen['height']*.15,width=right-left,height=screen['height']*.4)
            before = page.screenshot(clip=clip)
            page.locator('.photo-cabin').evaluate('(e)=>e.style.visibility="hidden"')
            after = page.screenshot(clip=clip)
            page.locator('.photo-cabin').evaluate('(e)=>e.style.visibility="visible"')
            assert difference(before,after)<.3, f'RHD monitor aperture obstructed at {width}px'
        for name in ['left','right','rear']:
            mirror = page.locator(f'[data-view="{name}"]')
            before = mirror.screenshot()
            page.locator('.photo-cabin').evaluate('(e)=>e.style.visibility="hidden"')
            after = mirror.screenshot()
            page.locator('.photo-cabin').evaluate('(e)=>e.style.visibility="visible"')
            assert difference(before,after,inset=2)<.3, f'{name} mirror obscured at {width}px'
        for control in ['select[data-driving-side]','select[data-scenario]']:
            rect = page.locator(control).bounding_box()
            assert rect['x'] >= 0 and rect['x'] + rect['width'] <= width
        if width == 390:
            page.screenshot(path=str(ROOT/'assets/previews/right-drive-mobile.png'), full_page=True)
    assert not errors, errors
    page.close()
    print('PASS seat, pose, controls, persistence, scenarios and responsive checks', flush=True)
    for blocked in ['**/cabin/wheel.png','**/cabin/dashboard.png']:
        page = browser.new_page(viewport={'width':1440,'height':1080})
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script("localStorage.setItem('reverse-parking-driving-side','right')")
        page.route(blocked, lambda route: route.abort())
        page.goto(URL)
        page.wait_for_function("document.querySelector('#app').dataset.assets==='fallback'",timeout=60000)
        assert page.locator('#app').get_attribute('data-cabin') == 'fallback'
        assert page.locator('select[data-driving-side]').input_value() == 'right'
        page.locator('[data-view="driver"]').focus(); page.keyboard.press('2')
        page.wait_for_timeout(150)
        if 'wheel' in blocked:
            page.screenshot(path=str(ROOT/'assets/previews/right-drive-fallback.png'),full_page=True)
        page.locator('[data-hold]').click()
        page.wait_for_function("Number(document.querySelector('#app').dataset.speed)<-.1")
        page.keyboard.down('ArrowDown')
        page.wait_for_function("Number(document.querySelector('#app').dataset.speed)===0")
        page.keyboard.up('ArrowDown')
        page.close()
        print('PASS RHD fallback and brake:',blocked,flush=True)
    for setup in ["localStorage.setItem('reverse-parking-driving-side','invalid')",
                  "Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage blocked')}})"]:
        page = browser.new_page(viewport={'width':1440,'height':1080})
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script(setup)
        page.goto(URL)
        page.wait_for_function("document.querySelector('#app').dataset.assets!=='loading'",timeout=60000)
        assert page.locator('select[data-driving-side]').input_value() == 'left'
        page.select_option('select[data-driving-side]','right')
        assert page.locator('#app').get_attribute('data-driving-side') == 'right'
        page.close()
    assert not errors, errors
    print('PASS storage defaults and unavailable storage; no page errors',flush=True)
    browser.close()
