# Cabin and parking scenarios implementation plan

> Execute inline using superpowers:executing-plans; fresh final review before shipping.

Goal: More convincing interactive car interior, parallel parking, and selectable photographic environments.

Design decisions (implementation choices, not additional user requirements): retain Three.js and the navy dual view; three lessons: existing mall perpendicular parking, residential parallel parking (6.8 m bay), city parallel parking (5.8 m bay). Use separate CC0 street photographs with matching lighting. Interior remains interactive modeled geometry, not a fixed photo; representative left-hand-drive automatic, not a specific calibrated car.

Architecture: `scenarios.ts` owns starting pose, collision world, target heading, parked cars and photo filenames. Simulation accepts the active world for collision, clearance, completion and trajectory. Rendering derives markings and parked vehicles from the same configuration. Selecting a scenario disposes the previous renderer and resets input, pause, collision count and P/brake hold. Load callbacks cannot mutate a replacement scene.

Alternatives: photo-overlay interior gives realistic pixels but cannot support wheel/gear motion or correct views; full branded interior acquisition adds licensing and geometry work. Improve the existing modeled interior with leather seams, real instrument scales/needles, trim, switchgear and a live center display.

Constraints: Preserve all brake keyboard fallbacks and PRND interlocks. No external runtime asset requests. Preserve original comparison screenshots. No new npm dependencies. Photos remain distant scenery, not collision geometry. No moving traffic in this version.

Review focus: switch during loading or driving; keyboard focus in scene selector; yaw wraparound and correct parking heading; visible parked cars equal collision rectangles; partial download failure remains driveable.

- [x] Add tests for valid starts, parallel completion (including yaw wrap), collisions, and false completion. Watch new tests fail, then implement `Scenario`, `SCENARIOS`, `scenarioState` and target heading support.
- [x] Add street photos/HDRs with hashes and credits. Build scene from active scenario; selection and safe lifecycle in main. Test switching and asset failure in Edge.
- [x] Upgrade cockpit geometry, gauges, trim and gear lever/display. Inspect actual desktop/mobile captures, moving/stop/brake/gear behavior.
- [ ] Run unit suite, build, keyboard regression and browser scenario tests. Fresh review; address material findings. Save previews, update README, commit/push using existing authorization, verify Pages.

Progress and evidence will be recorded below.


Verification (2026-10-28):
- New scenario tests first failed with missing scenarios module, then passed. Nine scenario tests now cover valid starts, heading wrap, rejection, curb/car collision and two complete collision-free parking maneuvers using reverse arcs + forward correction.
- Full suite: 36/36 passed; production build passed (existing bundle-size advisory only).
- Edge production preview: all three scenes, repeated switch while loading, P/brake resets, both keyboard brakes, reset, selector focus, 320/390/768 widths and blocked street photo passed.
- Existing verify-app, verify-brakes (12 cases), verify-render (DPI1/2), verify-visuals (five async failure cases), credits navigation passed. Zero page errors.
- Performance sample on this Intel Iris Xe: mean 38.4 FPS, median frame 32.9 ms; local headless sample, not a guarantee for other devices.
- Fresh read-only reviewer found one important issue: R camera froze when its source DOM mirror scrolled offscreen. New verify-cabin-camera.py reproduced it (mean changed pixel 0.065, below 0.2 threshold). Renderer now updates the shared rear target whenever the visible cockpit needs it, independently of the DOM mirror blit. Positive regression passed after the fix (mean changed pixel 3.49), followed by all scenario browser checks and 36/36 unit tests.
- Implementation decisions: three representative lessons, CC0 London street photos, generic left-drive interior and steering-angle gauge. Not calibrated to a particular car or Taiwan street; this scope is described in README. No deferred review findings. Reviewer did not run browser checks (parent ran them), and real-car calibration remains outside this requested visual/scene update.

Local implementation, review and validation complete; Pages deployment verification follows.
