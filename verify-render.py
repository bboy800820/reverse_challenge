"""Compare camera framing across display densities, using actual rendered pixels."""
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

folder = Path(__file__).resolve().parent / 'assets' / 'previews'
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    captures = []
    for density in [1, 2]:
        page = browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=density)
        page.goto('http://127.0.0.1:5187')
        page.wait_for_function("document.querySelector('#app').dataset.ready === 'true'")
        page.wait_for_timeout(350)
        shots = {}
        for name in ['rear', 'left', 'right', 'overhead']:
            data = page.locator('[data-view="' + name + '"]').screenshot(scale='css')
            shots[name] = Image.open(BytesIO(data)).convert('RGB')
        captures.append(shots)
        page.close()
    for name in captures[0]:
        a, b = captures[0][name], captures[1][name]
        difference = sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3
        print(name, 'mean RGB difference', round(difference, 2), flush=True)
        assert difference < 8, f'{name} changes framing on a high-DPI display ({difference:.2f})'
    browser.close()
