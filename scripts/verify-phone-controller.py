"""Two isolated browser contexts + actual relay; no real sensor/phone claim."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('PARKING_URL', 'http://127.0.0.1:5189/reverse_challenge/')
RELAY = os.environ.get('PARKING_RELAY', 'http://127.0.0.1:8787')
with sync_playwright() as p:
    print('Launching isolated Edge', flush=True)
    browser = p.chromium.launch(channel='msedge', headless=True)
    desktop = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = desktop.new_page()
    page.set_default_timeout(15000)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.add_init_script("Object.defineProperty(navigator, 'clipboard', {value:{writeText:async text=>{window.copiedLink=text}}})")
    page.goto(URL)
    print('Desktop loaded', flush=True)
    page.wait_for_function("document.querySelector('#app').dataset.ready==='true'", timeout=60000)
    page.locator('.driver [data-phone-connect]').click()
    page.locator('[data-relay-url]').fill(RELAY)
    page.locator('[data-pair-form] button').click()
    page.locator('[data-pair-copy]').click()
    link = page.evaluate('window.copiedLink')
    print('Pairing ready', flush=True)
    assert 'controller.html#' in link
    page.screenshot(path=str(ROOT/'assets/previews/phone-pairing.png'))
    phone = browser.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True)
    controller = phone.new_page()
    controller.set_default_timeout(15000)
    controller.on('pageerror', lambda e: errors.append(str(e)))
    controller.goto(link)
    controller.wait_for_function("!document.querySelector('[data-resume]').disabled")
    print('Phone joined', flush=True)
    controller.locator('[data-resume]').click()
    controller.wait_for_function("!document.querySelector('[data-gear-button=R]').disabled")
    controller.locator('[data-gear-button=R]').click()
    page.wait_for_function("document.querySelector('[data-gear]').textContent==='R'")
    controller.locator('[data-hold]').click()
    page.wait_for_function("Number(document.querySelector('#app').dataset.speed)<-.1")
    print('Reverse creep verified', flush=True)
    # Real pointer steering input, then combined brake/throttle touch pointers.
    wheel = controller.locator('[data-touch-wheel]').bounding_box()
    controller.mouse.move(wheel['x']+wheel['width']/2, wheel['y']+wheel['height']/2)
    controller.mouse.down(); controller.mouse.move(wheel['x']+wheel['width']*.85, wheel['y']+wheel['height']/2); controller.mouse.up()
    page.wait_for_function("Number(document.querySelector('#app').dataset.steer)>.2")
    # High-refresh touchscreens must not flood the relay or disconnect the room.
    controller.locator('[data-touch-wheel]').evaluate("w=>w.addEventListener('pointerdown',e=>window.activePointer=e.pointerId,{once:true})")
    controller.mouse.move(wheel['x']+wheel['width']/2, wheel['y']+wheel['height']/2); controller.mouse.down()
    controller.evaluate("""async () => { const w=document.querySelector('[data-touch-wheel]'), r=w.getBoundingClientRect(); for(let i=0;i<160;i++) { w.dispatchEvent(new PointerEvent('pointermove',{pointerId:window.activePointer,clientX:r.x+r.width/2+i%20})); await new Promise(resolve=>setTimeout(resolve,7)); } }""")
    controller.mouse.up(); controller.wait_for_timeout(400)
    assert not controller.locator('[data-pedal=brake]').is_disabled(), 'Rapid steering disconnected relay'
    pedal = controller.locator('[data-pedal=brake]').bounding_box()
    controller.mouse.move(pedal['x']+pedal['width']/2, pedal['y']+pedal['height']/2)
    controller.mouse.down()
    page.wait_for_function("Math.abs(Number(document.querySelector('#app').dataset.speed))<.001")
    controller.locator('[data-gear-button=D]').evaluate('(e)=>e.click()')
    page.wait_for_function("document.querySelector('[data-gear]').textContent==='D'")
    controller.mouse.up()
    pedal = controller.locator('[data-pedal=throttle]').bounding_box()
    controller.mouse.move(pedal['x']+pedal['width']/2, pedal['y']+pedal['height']/2)
    controller.mouse.down()
    page.wait_for_function("Number(document.querySelector('#app').dataset.speed)>.4")
    # Keyboard emergency brake takes priority over phone throttle.
    page.keyboard.down('Space')
    page.wait_for_function("Math.abs(Number(document.querySelector('#app').dataset.speed))<.001")
    page.keyboard.up('Space')
    controller.mouse.up()
    # Motion permission path and calibration. Inject orientations in both landscapes.
    controller.locator('[data-motion]').click()
    controller.evaluate("window.testTilt=0; window.sensorTimer=setInterval(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:window.testTilt,gamma:-90})),50)")
    controller.wait_for_timeout(100)
    controller.locator('[data-calibrate]').click()
    controller.locator('[data-resume]').click()
    controller.evaluate("window.testTilt=30")
    controller.wait_for_timeout(150)
    assert controller.locator('[data-angle]').text_content() != '0°'
    controller.evaluate('clearInterval(window.sensorTimer)')
    # Explicit pause blocks old controls; resume is deliberate and retains hold.
    controller.locator('[data-pause]').click()
    page.wait_for_function("document.querySelector('#app').dataset.paused==='true'")
    controller.locator('[data-touch]').click()
    controller.locator('[data-resume]').click()
    controller.wait_for_function("!document.querySelector('[data-hold]').disabled")
    assert controller.locator('[data-hold]').get_attribute('aria-pressed') == 'true'
    for w,h in [(844,390),(390,844),(320,568)]:
        controller.set_viewport_size({'width':w,'height':h})
        controller.wait_for_timeout(150)
        assert controller.evaluate('document.documentElement.scrollWidth<=innerWidth'), (w,h,'horizontal overflow')
        controller.screenshot(path=str(ROOT/f'assets/previews/phone-controller-{w}x{h}.png'), full_page=True)
    # Closing phone must pause PC and prevent motion. Rejoin also starts paused.
    phone.close()
    page.wait_for_function("document.querySelector('#app').dataset.paused==='true' && Number(document.querySelector('#app').dataset.speed)===0")
    phone2 = browser.new_context(viewport={'width':844,'height':390})
    c2 = phone2.new_page(); c2.goto(link)
    c2.wait_for_function("!document.querySelector('[data-resume]').disabled")
    assert page.locator('#app').get_attribute('data-paused') == 'true'
    c2.locator('[data-resume]').click()
    c2.wait_for_function("!document.querySelector('[data-pause]').disabled")
    phone2.set_offline(True)
    page.wait_for_function("document.querySelector('#app').dataset.paused==='true'", timeout=3000)
    assert float(page.locator('#app').get_attribute('data-speed')) == 0
    page.locator('.driver [data-phone-connect]').click()
    page.locator('[data-pair-disconnect]').click()
    page.locator('[data-pair-close]').click()
    page.locator('[data-pause]').click()
    page.keyboard.press('Digit4'); page.locator('[data-hold]').click()
    page.keyboard.down('ArrowUp'); page.wait_for_function("Number(document.querySelector('#app').dataset.speed)>.3"); page.keyboard.up('ArrowUp')
    assert not errors, errors
    browser.close()
    print('PASS: pairing, touch/motion, PRND, brake priority, timeout, reconnect, phone sizes, keyboard fallback')
