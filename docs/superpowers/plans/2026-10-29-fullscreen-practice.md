# Fullscreen practice implementation plan

> Execute inline with superpowers:executing-plans and verify before completion.

**Approved spec:** Keep the normal layout. Add fullscreen practice: large driver viewport, collapsible corner overhead, compact bottom gear/speed/brake/controls, keyboard operation, pause and explicit exit. Restore original layout on exit.

**Architecture:** A presentation controller in `fullscreen.ts` requests fullscreen on documentElement (the existing WebGL canvas is a body sibling of #app), with an in-page expanded fallback when unsupported/denied. Reparent existing control nodes to a dock and restore them using placeholders; do not duplicate input bindings. Pause and brake on enter/exit without resetting vehicle pose or progress. Escape exits this mode; it retains pause behavior in normal layout. Clip the driver's DOM underneath the floating overhead and render the overhead last so both DOM and WebGL layers agree.

**Stack:** TypeScript, CSS, Fullscreen API, ResizeObserver, existing Three.js renderer; isolated Edge/Playwright verification.

**Reference:** https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide (user activation, fullscreenchange, request rejection and exit behavior).

## Tasks

- [x] Write `scripts/verify-fullscreen.py`; observe missing entry button before implementation.
- [x] Add `app/src/fullscreen.ts`, `fullscreen.css`; toolbar, native/fallback lifecycle, control restoration, overlay cutout, responsive dock.
- [x] Wire `main.ts` enter/exit/pause/focus/error paths; paint overhead last in `scene.ts`; preserve every existing control and side/scenario state.
- [x] Verify native/fallback/denied entry, browser exit and Escape, repeated toggles, moving/held input, reset and failed WebGL exit, expanded-map compositing, LHD/RHD, narrow/short viewports and normal-layout restoration.
- [x] Build/test, fresh code review, preview screenshots, README and deployment using established GitHub account/workflow.

## Review focus

- Native fullscreen must include the WebGL canvas, not only DOM chrome.
- Escape/fullscreenchange must never resume motion or double-toggle pause.
- Floating map must cover cockpit/mirrors correctly and restore clipping when collapsed/exited.
- Moving existing controls must retain pointer/keyboard handlers and accessible focus.
- Entry rejection, delayed fullscreen resolution, native exit, HMR disposal and graphics failure must remain recoverable.
- No accidental simulator reset or new normal-layout arrangement.

## Evidence / rulings

- RED: verification failed on missing fullscreen entry before implementation.
- GREEN: 39 existing unit tests and production build passed (existing bundle-size advisory only).
- Native Edge checks passed: documentElement includes canvas, driver width/height increase, pose preservation, pause/brake transitions, gear input, map collapse/compositing, native exit, Escape, repeated entry/exit, RHD and reset, original-layout restoration.
- Production fallback checks passed at 1920x1080, 1280x720, 844x390, 768x1024, 390x844, 320x568: every critical control remains in viewport, pointer steering/centering/brake work, floating map is not overwritten by DOM or mirror framebuffer, collapse removes its cutout.
- Fresh reviewer identified hidden pointer steering at <=1000px: reproduced RED, restored compact controls, added bounds and pointer-steering assertions; final suite GREEN. Removed only decorative steering display where space is limited.
- Test fixture correction: documentElement is not yet available in init scripts; native-request rejection now overrides Element.prototype. Real rejection fallback was rerun successfully.
- Independent reviewer probes passed delayed rejection after Escape, denied entry + WebGL context loss + usable exit, native Escape with brake hold, and 320/390px normal-header fit. No outstanding review findings.
- Normal LHD photo-cabin/failed-asset regression and full RHD/browser regression passed. Earlier concurrent graphics suites experienced a context-loss/short-timing failure; each affected suite then passed sequentially against the unchanged production build. Final browser validation was serialized to avoid GPU contention.
- Native and fallback screenshots saved in assets/previews/fullscreen-*.png; previous right-drive comparison screenshots restored after regression generation.
- Photo layout keeps gauges/monitor in wide fullscreen viewports; portrait retains original photo crop. Existing control nodes, vehicle state, driving-side choice, and normal layout are retained.
- Deployed 08b9682da5fface32596b8d090e015fdb42f63c2 via successful Pages run https://github.com/bboy800820/reverse_challenge/actions/runs/40742077545. Public smoke passed native document fullscreen, right drive, R camera, map collapse, reverse creep, Space brake and Escape restoring the original paused layout; no page errors.
