"""A short browser check of the new prototype's distinct driving controls."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

folder = Path(__file__).resolve().parent
with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1080, "height": 930})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto((folder / "navy-preview.html").as_uri())
    ui = page.frame_locator("iframe")
    ui.locator("[data-shift='P']").wait_for()
    frame = page.frames[1]
    root = ui.locator("#reverse-demo")

    def gear():
        return ui.locator("[data-gear]").inner_text()

    def wait_speed(condition):
        frame.wait_for_function("() => " + condition.replace("SPEED", "Number(document.getElementById('reverse-demo').dataset.speed)"), timeout=6000)

    assert gear() == "P"
    assert ui.locator("[data-hold]").get_attribute("aria-pressed") == "true"
    ui.locator("[data-shift='R']").click()
    assert gear() == "R"
    initial_z = float(root.get_attribute("data-car-z"))
    ui.locator("[data-hold]").click()
    wait_speed("SPEED < -0.1")
    assert float(root.get_attribute("data-car-z")) > initial_z
    ui.locator("[data-shift='D']").click()
    assert gear() == "R", "Moving gear change must be rejected"
    assert "停穩" in ui.locator("[data-message]").inner_text()

    page.keyboard.down("ArrowDown")
    wait_speed("SPEED === 0")
    ui.locator("[data-shift='D']").click()
    assert gear() == "D"
    forward_z = float(root.get_attribute("data-car-z"))
    page.keyboard.up("ArrowDown")
    wait_speed("SPEED > 0.1")
    assert float(root.get_attribute("data-car-z")) < forward_z
    page.keyboard.down("ArrowUp")
    wait_speed("SPEED > 0.5")
    page.keyboard.down("ArrowDown")
    wait_speed("SPEED === 0")
    page.keyboard.up("ArrowUp")
    ui.locator("[data-shift='N']").click()
    page.keyboard.up("ArrowDown")
    assert gear() == "N"
    page.keyboard.down("ArrowUp")
    page.wait_for_timeout(350)
    assert float(root.get_attribute("data-speed")) == 0
    page.keyboard.up("ArrowUp")
    ui.locator("[data-shift='R']").click()
    assert gear() == "N", "A stationary gear change still needs the brake"

    page.keyboard.down("ArrowDown")
    page.keyboard.press("2")
    assert gear() == "R"
    ui.locator("[data-hold]").click()
    page.keyboard.up("ArrowDown")
    page.screenshot(path=str(folder / "navy-preview-desktop.png"), full_page=True)

    ui.locator("[data-center]").click()
    assert "0°" in ui.locator("[data-steer]").inner_text()
    page.keyboard.down("ArrowLeft")
    frame.wait_for_function("() => document.querySelector('[data-steer]').textContent.includes('左')")
    page.keyboard.up("ArrowLeft")
    ui.locator("[data-aids]").uncheck()
    assert not ui.locator("[data-aids]").is_checked()
    ui.locator("[data-pause]").click()
    assert "已暫停" in ui.locator("[data-message]").inner_text()
    ui.locator("[data-reset]").click()
    assert gear() == "P"
    assert float(root.get_attribute("data-speed")) == 0
    sizes = []
    for width in [736, 390, 320]:
        page.set_viewport_size({"width": width, "height": 1100})
        ui.locator('.rp-stage').wait_for()
        size = ui.locator('body').evaluate("e => ({width:e.clientWidth,scroll:e.scrollWidth})")
        assert size["scroll"] <= size["width"], size
        sizes.append(size)
        if width == 390:
            page.screenshot(path=str(folder / "navy-preview-mobile.png"), full_page=True)
    assert not errors, errors
    print(json.dumps({"gear_switch": "pass", "brake_before_shift": "pass", "D_R_direction": "pass", "throttle_brake_priority": "pass", "neutral_no_drive": "pass", "keyboard_steering": "pass", "reset": "pass", "responsive": sizes, "page_errors": errors}))
    browser.close()
