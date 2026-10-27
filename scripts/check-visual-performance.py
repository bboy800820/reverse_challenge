"""Measure this machine, and verify attribution navigation under the Pages prefix."""
import json
import os
from playwright.sync_api import sync_playwright

url = os.environ.get('PARKING_URL', 'http://127.0.0.1:5188/reverse_challenge/')
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width':1440,'height':1000})
    page.goto(url)
    page.wait_for_function("document.querySelector('#app').dataset.assets === 'ready'", timeout=60000)
    result = page.evaluate("""async () => {
        const gl = document.querySelector('canvas').getContext('webgl2');
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        const samples = []; let previous;
        await new Promise(resolve => {
            function frame(now) { if (previous) samples.push(now-previous); previous = now;
                if (samples.length < 80) requestAnimationFrame(frame); else resolve(); }
            requestAnimationFrame(frame);
        });
        samples.sort((a,b)=>a-b);
        return {gpu:debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), medianMs:samples[40], p95Ms:samples[76], meanFps:1000/(samples.reduce((a,b)=>a+b,0)/samples.length)};
    }""")
    print(json.dumps(result), flush=True)
    with page.expect_popup() as opened:
        page.get_by_role('link', name='素材來源').click()
    credits = opened.value
    credits.wait_for_load_state()
    back = credits.get_by_role('link', name='返回練習室')
    assert back.evaluate('(a)=>a.href') == page.url, 'Credits return link must preserve the repository path'
    back.click()
    credits.wait_for_function("document.querySelector('#app')?.dataset.ready === 'true'")
    print('PASS credits return navigation', flush=True)
    browser.close()
