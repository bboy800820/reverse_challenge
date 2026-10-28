# Right-hand drive implementation plan

> Execute inline with superpowers:executing-plans; verify before completion.

**Goal / spec:** User approved right-hand drive only, explicitly retaining the existing interface. Add one left/right driver-seat selector to the scenario bar. Keep vehicle physics, world, scenarios, and all current controls unchanged.

**Architecture:** Driver side is presentation configuration, outside simulation state. The existing scene receives it and updates its driver's lateral camera offset, photo cockpit layout and procedural fallback. Reflect only cabin structure; keep labels, instruments and rear-camera image readable. Preserve car position, gear, steering, collisions and paused state on seat changes; require stopped speed and engage brake hold. Remember the choice defensively in localStorage.

**Stack:** TypeScript, Three.js, CSS, Vite, Vitest; isolated Edge/Playwright verification.

## Files and tasks

- [x] `scripts/verify-driving-side.py`: first demonstrate missing selector, then verify seat changes, camera/overhead invariants, gear/steering/brake behavior, moving rejection, scene/reset/reload persistence, fallback and responsive layouts. Save screenshots separately from existing previews.
- [x] `app/src/driving-side.ts`, `main.ts`: configuration type, default/persisted choice, accessible selector and stopped-only handler. No auto-reset on seat change; return keyboard focus to driver.
- [x] `photo-cabin.ts`, `style.css`: mirrored fascia and monitor aperture; move wheel, cluster, monitor; keep live text/wheel rotation unreflected; relocate center mirror and recalculate foreground holes.
- [x] `scene.ts`, `cockpit.ts`: move eye offset from -.38 to +.38 m, reverse fallback inward gaze; reflect procedural structure while counterreflecting display planes and steering rotation. World, overhead and left/right mirror camera identity stay unchanged.
- [x] Run unit suite/build and browser tests, inspect LHD/RHD screenshots and fallback, record findings; review whole diff and deliver feature.

## Review focus

- Switching while moving must not teleport or silently stop the car.
- Switching at rest must preserve pose/gear/steering and keep pause state; no stale throttle inputs.
- R monitor opening, camera image and mirror cutouts must align on both sides at 320/390/860/1440 widths.
- Missing cabin images must still give a readable, functioning right-hand procedural cockpit.
- Storage unavailable/invalid, reload, rapid scene switching and reset must retain a valid side without breaking input.

## Evidence

- RED: browser test failed with missing driver-seat selector before implementation.
- GREEN: 39 Vitest tests and production build passed (existing bundle-size advisory only).
- Production browser checks passed: LHD/RHD pose invariance, changed eye viewpoint, identical overhead, D/R brakes, held-key repeat under brake hold, moving rejection, paused switching, scenario/reset/reload persistence, invalid/unavailable storage, both missing-photo fallback cases.
- RHD monitor apertures and all three mirror faces passed at 860/390/320 px. Mobile label regression reproduced (90 px height), fixed by stacking the selectors, and checked to stay horizontal.
- At 320 px the outer fractional mirror screenshot edge differed by 0.394 mean levels; the inner mirror face differed by exactly 0.0. Test excludes only the two outer border pixels to avoid CSS edge antialiasing, rather than changing the rendered cockpit.
- Existing LHD photo-cabin regression and asset-failure checks passed.
- RHD reverse camera stayed live after scrolling (mean pixel change 4.31); R viewport scissor checks passed at 821/860/900 px.
- Fresh reviewer found no production issues. Reviewer limitations (mobile, fallback readability, held keys) were resolved by the browser checks and visual inspection. No deferred issues.
- Screenshots: assets/previews/right-drive-{mall,residential,mobile,fallback}.png.
- Existing checkout retained on feature/right-hand-drive to preserve the user's local asset and preview files; no unrelated files were staged. Original source photo and abandoned UX concepts remain untouched.
- Deployment pending.
