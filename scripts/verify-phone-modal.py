"""Remote resume must not move a car behind the pairing dialog."""
import os
from playwright.sync_api import sync_playwright
URL = os.environ.get('PARKING_URL', 'http://127.0.0.1:5189/reverse_challenge/')
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    desktop = browser.new_context(viewport={'width':1440,'height':1000})
    host = desktop.new_page(); host.set_default_timeout(15000)
    host.add_init_script("Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedLink=text}}})")
    host.goto(URL); host.wait_for_function("document.querySelector('#app').dataset.ready==='true'")
    host.locator('.driver [data-phone-connect]').click(); host.locator('[data-relay-url]').fill('http://127.0.0.1:8787')
    host.locator('[data-pair-form] button').click(); host.locator('[data-pair-copy]').click()
    phone = browser.new_context(viewport={'width':844,'height':390}); c = phone.new_page(); c.set_default_timeout(15000)
    c.goto(host.evaluate('window.copiedLink')); c.wait_for_function("!document.querySelector('[data-resume]').disabled")
    c.locator('[data-resume]').click(); c.wait_for_function("!document.querySelector('[data-pause]').disabled")
    host.locator('.driver [data-phone-connect]').click(); c.wait_for_function("!document.querySelector('[data-resume]').disabled")
    c.locator('[data-resume]').click(); c.wait_for_timeout(300)
    assert host.locator('dialog').evaluate('(d)=>d.open')
    assert host.locator('#app').get_attribute('data-paused') == 'true', 'Phone resumed behind pairing modal'
    assert host.locator('#app').get_attribute('data-speed') == '0'
    host.locator('[data-pair-close]').click(); c.locator('[data-resume]').click()
    c.wait_for_function("!document.querySelector('[data-pause]').disabled")
    browser.close(); print('PASS: modal blocks remote resume, close restores explicit resume')
