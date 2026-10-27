"""Compare camera framing across display densities, using actual rendered pixels."""
from pathlib import Path
import os
from io import BytesIO
from PIL import Image, ImageChops, ImageStat, ImageFilter
from playwright.sync_api import sync_playwright

folder = Path(__file__).resolve().parent / 'assets' / 'previews'
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    captures = []
    for density in [1, 2]:
        page = browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=density)
        page.goto(os.environ.get('PARKING_URL', 'http://127.0.0.1:5187'))
        page.wait_for_function("document.querySelector('#app').dataset.ready === 'true'")
        page.wait_for_function("document.querySelector('#app').dataset.assets === 'ready'", timeout=60000)
        page.wait_for_timeout(350)
        shots = {}
        for name in ['rear', 'left', 'right', 'overhead']:
            data = page.locator('[data-view="' + name + '"]').screenshot(scale='css')
            shots[name] = Image.open(BytesIO(data)).convert('RGB')
        captures.append(shots)
        page.close()
    for name in captures[0]:
        a, b = captures[0][name], captures[1][name]
        # Filter subpixel leaf/normal-map aliasing; this test detects camera crops,
        # not identical rasterization at different physical resolutions.
        a, b = a.filter(ImageFilter.GaussianBlur(1.5)), b.filter(ImageFilter.GaussianBlur(1.5))
        difference = sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3
        shifted = ImageChops.offset(a, round(a.width * .15), 0)
        control = sum(ImageStat.Stat(ImageChops.difference(a, shifted)).mean) / 3
        print(name, 'framing difference', round(difference, 2), 'shifted control', round(control, 2), flush=True)
        assert difference < 5, f'{name} changes framing on a high-DPI display ({difference:.2f})'
        assert control > 5, f'{name} comparison must detect an intentionally shifted camera image'
    browser.close()
