# Photographic environment correction

The user clarified that the landscape itself must look real. The previous procedural trees and box buildings did not meet that request.

Approach: replace the distant world with an actual photographed 360-degree mall parking panorama, ground-projected into the existing scene. Keep the nearby practice surface and interactive vehicles in 3D. Use the matching HDR for lighting/reflections. This is a practical web approximation: photographed distant buildings are scenery, not navigable geometric buildings. This choice is an implementation judgment within the requested visual correction, not a user-approved change of platform.

Alternatives considered: photogrammetry of a whole site would allow better close-range parallax but needs a suitable surveyed/optimized model; adding more procedural detail would repeat the visual mismatch. Real panoramic photography gives the requested environmental appearance directly with modest rendering cost.

- [x] Add local photograph/HDR and preserve source/checksums/CC0 attribution.
- [x] Add ground-projected environment, remove procedural distant vegetation/buildings, retain nearby geometry and safe loading fallback.
- [x] Inspect actual front/rear/side views and mobile screenshots; verify panorama failure, input regressions, DPI framing, model tests and build.
- [ ] Publish and verify Pages. Save actual updated screenshots in the project.

Files: scene.ts, visual-assets.ts, photographic-environment.ts, asset preparation/credits/README and browser checks. No new runtime dependencies. Camera/physics dimensions unchanged. Verify geometry stays below the practice pavement, no fog/tone mapping distorts the pre-tonemapped photograph, and panorama requests use the repository base path.

Verification: 27 unit tests passed; production build passed; desktop/mobile screenshots inspected. Browser main controls/layout suite, 12 D/R keyboard-brake cases, and DPR framing all passed. Four deliberately blocked assets (panorama, matching HDR, car, asphalt) preserved operation and reported fallback, with no page errors.
