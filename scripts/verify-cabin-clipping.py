"""A cropped photographic monitor must never paint WebGL into the column gap."""
import io
import os
from PIL import Image
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    page=browser.new_page(viewport={'width':821,'height':1080})
    page.goto(os.environ.get('PARKING_URL','http://127.0.0.1:5188/reverse_challenge/'))
    page.wait_for_function("document.querySelector('#app').dataset.assets==='ready'",timeout=60000)
    if os.environ.get('DRIVING_SIDE'):
        page.select_option('select[data-driving-side]', os.environ['DRIVING_SIDE'])
    page.locator('[data-shift="R"]').click()
    for width in [821,860,900]:
        page.set_viewport_size({'width':width,'height':1080});page.wait_for_timeout(400)
        driver=page.locator('[data-view="driver"]').bounding_box()
        monitor=page.locator('.photo-monitor').bounding_box()
        gap={'x':driver['x']-8 if os.environ.get('DRIVING_SIDE') == 'right' else driver['x']+driver['width']+4,'y':monitor['y']+10,'width':4,'height':20}
        pixels=Image.open(io.BytesIO(page.screenshot(clip=gap))).convert('RGB')
        error=max(max(abs(c-t) for c,t in zip(pixels.getpixel((x,y)),(9,24,39))) for x in range(pixels.width) for y in range(pixels.height))
        assert error<3,f'R camera escapes driving panel at {width}px: color deviation={error}'
        print(f'PASS reverse monitor stays inside driving panel at {width}px',flush=True)
    browser.close()
