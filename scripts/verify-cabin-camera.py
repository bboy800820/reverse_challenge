"""The cabin reverse camera must stay live after its source DOM mirror scrolls away."""
import io
import os
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width':390, 'height':844})
    page.goto(os.environ.get('PARKING_URL', 'http://127.0.0.1:5188/reverse_challenge/'))
    page.select_option('select[data-scenario]', 'residential')
    page.wait_for_function("document.querySelector('#app').dataset.assets === 'ready'", timeout=60000)
    page.keyboard.press('2')
    page.wait_for_timeout(300)
    # At this scroll offset the entire center mirror is offscreen, while the
    # right-hand dashboard display (inside the driver canvas) remains visible.
    page.evaluate('scrollTo(0, 350)')
    page.wait_for_timeout(300)
    assert page.locator('[data-view="rear"]').bounding_box()['y'] + page.locator('[data-view="rear"]').bounding_box()['height'] < 0
    def camera():
        return Image.open(io.BytesIO(page.screenshot(clip={'x':301,'y':48,'width':60,'height':23}))).convert('RGB')
    before = camera()
    # Use DOM click to avoid scrolling back down to the control panel.
    page.locator('[data-hold]').evaluate('(e)=>e.click()')
    x = float(page.locator('#app').get_attribute('data-x'))
    page.keyboard.down('ArrowUp')
    page.wait_for_function(f"Number(document.querySelector('#app').dataset.x) < {x - 1}")
    page.keyboard.down('Space')
    page.wait_for_function("Number(document.querySelector('#app').dataset.speed) === 0")
    page.wait_for_timeout(300)
    after = camera()
    difference = sum(ImageStat.Stat(ImageChops.difference(before, after)).mean) / 3
    assert difference > .2, f'Cabin reverse image froze after scroll: mean pixel change {difference}'
    print(f'PASS scrolled cabin reverse camera remains live; mean pixel change={difference:.2f}', flush=True)
    browser.close()
