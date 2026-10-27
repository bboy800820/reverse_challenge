"""Exercise the real local app in an isolated Edge session. Run after npm run dev."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

folder = Path(__file__).resolve().parent
screens = folder / 'assets' / 'previews'
screens.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ.get('PARKING_URL', 'http://127.0.0.1:5187'))
    page.locator('[data-shift="P"]').wait_for(timeout=6000)
    page.wait_for_function("document.querySelector('#app').dataset.ready === 'true'", timeout=20000)
    page.wait_for_function("document.querySelector('#app').dataset.assets === 'ready'", timeout=60000)
    root = page.locator('#app')
    def value(name): return float(root.get_attribute('data-' + name))
    def wait_speed(expression):
        page.wait_for_function(expression.replace('SPEED', "Number(document.querySelector('#app').dataset.speed)"), timeout=10000)
    def gear(): return page.locator('[data-gear]').inner_text()
    assert gear() == 'P'
    assert len(page.locator('canvas').all()) == 1
    page.screenshot(path=str(screens / 'navy-3d-desktop.png'), full_page=True)
    page.locator('[data-shift="R"]').click()
    assert gear() == 'R'
    z = value('z')
    page.locator('[data-hold]').click()
    wait_speed('SPEED < -0.1')
    assert value('z') > z
    page.locator('[data-shift="D"]').click()
    assert gear() == 'R'
    page.keyboard.down('ArrowDown')
    wait_speed('SPEED === 0')
    page.keyboard.press('4')
    assert gear() == 'D'
    page.keyboard.up('ArrowDown')
    wait_speed('SPEED > 0.1')
    page.keyboard.down('ArrowUp')
    wait_speed('SPEED > 0.5')
    # Pausing while moving must not make the vehicle drift when resumed.
    page.locator('[data-pause]').click()
    paused_pose = (value('x'), value('z'))
    page.wait_for_timeout(200)
    assert (value('x'), value('z')) == paused_pose
    page.locator('[data-pause]').click()
    assert value('speed') == 0, 'Resume must hold the car stationary before accepting new pedal input'
    page.wait_for_timeout(250)
    assert (value('x'), value('z')) == paused_pose
    page.keyboard.up('ArrowUp')
    page.locator('[data-hold]').click()
    page.keyboard.down('ArrowUp')
    wait_speed('SPEED > 0.5')
    page.keyboard.down('ArrowDown')
    wait_speed('SPEED === 0')
    page.keyboard.up('ArrowUp')
    # Two braking keys: releasing one must leave the other engaged.
    page.keyboard.down('Space')
    page.keyboard.up('ArrowDown')
    page.wait_for_timeout(300)
    assert value('speed') == 0
    page.keyboard.press('3')
    page.keyboard.up('Space')
    assert gear() == 'N'
    page.keyboard.down('ArrowUp')
    page.wait_for_timeout(300)
    assert value('speed') == 0
    page.keyboard.up('ArrowUp')
    page.keyboard.press('2')
    assert gear() == 'N'
    page.locator('[data-hold]').click()
    page.keyboard.press('2')
    page.locator('[data-center]').click()
    page.wait_for_function("Math.abs(Number(document.querySelector('#app').dataset.steer)) < .001")
    page.keyboard.down('ArrowLeft')
    page.wait_for_function("Number(document.querySelector('#app').dataset.steer) < -.1")
    page.keyboard.up('ArrowLeft')
    # Telemetry is painted at 20 Hz; wait for the first post-keyup UI update.
    page.wait_for_timeout(120)
    steering = value('steer')
    page.wait_for_timeout(250)
    assert value('steer') == steering
    page.locator('[data-aids]').uncheck()
    page.locator('[data-pause]').click()
    assert root.get_attribute('data-paused') == 'true'
    x, z = value('x'), value('z')
    page.wait_for_timeout(250)
    assert (value('x'), value('z')) == (x, z)
    page.locator('[data-pause]').click()
    assert page.locator('[data-hold]').get_attribute('aria-pressed') == 'true'
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    assert root.get_attribute('data-paused') == 'true'
    page.locator('[data-reset]').click()
    assert gear() == 'P'
    assert value('speed') == 0
    for width in [768, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 1000})
        page.wait_for_timeout(250)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        if width == 390: page.screenshot(path=str(screens / 'navy-3d-mobile.png'), full_page=True)
    assert not errors, errors
    print(json.dumps({'result': 'passed', 'checks': ['WebGL startup', 'PRND interlock', 'D/R creep', 'brake priority', 'overlapping inputs', 'N no drive', 'steer hold/center', 'moving pause/resume without drift', 'pause/blur/reset', '320/390/768 layout'], 'page_errors': errors}))
    browser.close()
