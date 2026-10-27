"""Regression: real keyboard and key-only browser events must operate the brake."""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(os.environ.get('PARKING_URL', 'http://127.0.0.1:5187'))
    page.wait_for_function("document.querySelector('#app').dataset.ready === 'true'")
    speed = "Number(document.querySelector('#app').dataset.speed)"
    for gear in ['D', 'R']:
        for code, key in [('', 'ArrowDown'), ('', ' '), ('Unidentified', 'ArrowDown'), ('Unidentified', ' '), ('native', 'ArrowDown'), ('native', 'Space')]:
            page.locator('[data-reset]').click()
            page.locator('[data-shift="' + gear + '"]').click()
            page.locator('[data-hold]').click()
            page.wait_for_function('Math.abs(' + speed + ') > .2')
            if code == 'native':
                page.keyboard.down(key)
            else:
                # Embedded/browser input bridges may supply only the logical key.
                page.evaluate("({code,key}) => document.querySelector('#app').dispatchEvent(new KeyboardEvent('keydown',{code,key,bubbles:true,cancelable:true}))", {'code': code, 'key': key})
            page.wait_for_function(speed + ' === 0', timeout=3000)
            assert page.locator('[data-brake-label]').inner_text() == '踩下中'
            assert page.locator('[data-action="brake"]').get_attribute('data-active') == 'true'
            if code == 'native':
                page.keyboard.up(key)
            else:
                page.evaluate("({code,key}) => document.querySelector('#app').dispatchEvent(new KeyboardEvent('keyup',{code,key,bubbles:true,cancelable:true}))", {'code': code, 'key': key})
            # Releasing a momentary pedal restores creep rather than latching it.
            page.wait_for_function('Math.abs(' + speed + ') > .1')
            assert page.locator('[data-brake-label]').inner_text() == '按住減速'
            print(gear, code or 'key-only', repr(key), 'passed', flush=True)
    assert not errors, errors
    browser.close()
