# Realistic Visuals Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution and one fresh final review.

**Goal:** Bring the playable navy simulator closer to the selected realistic concept.
**Architecture:** Keep the existing pure simulation and shared renderer. Add asset loading/ownership, detailed vehicles and a main-camera-only cockpit. Keep collision and visual dimensions consistent.
**Tech Stack:** TypeScript, Three.js r186, local glTF/HDR/PBR assets, Vite, Vitest, Python Playwright.
**Spec:** ../specs/2026-10-27-realistic-visuals-design.md

## Global Constraints

Work on feature/realistic-visuals within the existing project folder. Preserve input/physics. Assets ship with Pages and include licenses. Use import.meta.env.BASE_URL for asset URLs. Existing main is deployed via Actions. No paid assets or server dependencies.

## Review Focus

Visual model orientation and dimensions versus collider; mirror layers and cockpit occlusion; async asset failure and disposal; camera clarity on narrow layouts; performance of five views and large assets.

## Tasks

- [x] Acquire and inspect openly licensed lightweight assets; record provenance and checksums. Validate all glTF dependencies are local.
- [x] Add material/asset and vehicle/cockpit modules; test model fitting against a known asymmetric source box and the existing physical dimensions. Run a failing model-fit test, then implement.
- [x] Replace scene materials, environment and vegetation; integrate async loading and fallback with lifecycle handling. Build and run existing model/input tests.
- [x] Inspect actual desktop/mobile rendered screenshots; test cockpit/overhead/mirrors after driving and at DPR 1/2, with a missing optional asset.
- [x] Obtain one fresh review, fix important findings, complete full verification and publish the visual update through the existing Pages workflow.
