# Navy Simulator Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution and a fresh final review.

**Goal:** Deliver the approved navy dual-view parking simulator as a local, maintainable 3D application.
**Architecture:** Pure fixed-step vehicle simulation; Three.js scene with shared camera state; DOM controls and one scissored WebGL canvas. Mirrors use flipped render-target UVs.
**Tech Stack:** TypeScript, Vite, Three.js, Vitest; Python Playwright for browser verification.
**Spec:** ../specs/2026-10-27-navy-simulator.md

## Global Constraints

All work in this project; preserve earlier references. No external assets or remote application state. Bind dev server to loopback. Use UI previews, not snapshots of source, for visual review. Existing directory has no git repository; progress and verification are recorded here without git-only workflow scripts.

## Review Focus

Check reverse steering sign and camera orientation; mirrored views and ego visibility; collision escape and no tunnelling; brake/shift interlocks with simultaneous and lost input; pause/resume; completion criteria; resizing and WebGL failure behavior. Check that the UI does not claim real-car fidelity.

## Task 1 — Simulation model

Files: app/src/simulation.ts, simulation.test.ts; package/config.
Interfaces: mutable State (metres, radians, signed m/s), Input, World; step(state,input,dt,world), shift(state,gear,brake), corners(state), clearance(state,world), trajectory(state).

- [x] Write behavior tests for gear interlock, D/R creep, throttle/brake priority, N coasting, reversed yaw, collision stop/escape and parking hold.
- [x] Run npm test: observe missing behavior fail.
- [x] Implement fixed-step motion and rectangle collision. Run npm test: all pass.

## Task 2 — Scene and controls

Files: app/src/scene.ts, input.ts, main.ts, style.css, app/index.html.
Interfaces: scene.render(state, aids); DOM buttons feed the same Input source map as keys. Five camera slots use one renderer and shared world.

- [x] Add browser behavior checks before implementation; confirm app is unavailable/missing expected surface.
- [x] Build navy UI and procedural 3D environment, camera passes, mirrored render targets, world-consistent guidance.
- [x] Run npm run build: no TypeScript/build errors; run browser checks: movement, interlock, brake priority, pause, responsive bounds and no page errors.

## Task 3 — Delivery and review

Files: README.md, launch.cmd, assets/previews/, design-decisions.json, this plan and progress.md.

- [x] Inspect desktop/mobile screenshots; fix material visual defects.
- [x] Request one fresh final code review, resolve important findings with regression tests.
- [x] Run full tests and build, document results and limitations, leave runnable local preview and project launcher.
