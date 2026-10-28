# Reference-photo cabin and luxury neighbors

Goal: Use the user's `assets/example` interior photograph as visual reference for a convincing live cockpit, and replace identical neighboring vehicles with recognizable expensive cars.

Implementation choices: photographic foreground with transparent glass, separate rotating wheel sprite, live instrument canvas and reverse screen. This fits the fixed driving camera; fully rebuilding a detailed branded interior would require a new model. Keep the previous 3D cockpit as an asset-failure fallback. Preserve three scenes and all keyboard, shift, brake and pause behavior. The original reference file stays untouched and untracked; generated derivatives are shipped in `app/public/assets/cabin/` with prompts/provenance.

Luxury neighbors: existing Ferrari 458 plus CC BY Lamborghini Aventador and Rolls-Royce Cullinan models, sourced from a pinned carros catalog revision. Preserve author/license/source links. Normalize orientation and assign declared representative dimensions; generate both physical collision boxes and visual placement from those dimensions. Keep both parallel parking tasks solvable. No claims about prices or exact manufacturer calibration.

Architecture: `photo-cabin.ts` owns overlay loading, viewport placement, wheel and live instruments; scene renderer paints a live rear view through its center display opening. `fleet.ts` and `parked-vehicle.ts` own dimensions/model variants/fit; scenarios generate obstacle extents matching them; parking-layout carries model selection and pose. Async resources remain owned by each scene and disposed on replacement.

Review focus: partial cabin asset failure, stale image callbacks on scene switch, correct image transparency and viewport fit on phone, live rear view after scroll, imported car axis/centering/materials, collision versus silhouette, maneuver feasibility.

- [x] Generate and save two referenced assets, inspect alpha and composition; record exact prompts and built-in imagegen usage.
- [x] Add luxury asset downloader/provenance; validate model geometry/bounds and safe starts/complete maneuvers with tests.
- [x] Integrate photo foreground, rotating wheel, live gauges/video and load fallback. Inspect desktop/mobile previews.
- [ ] Run unit/build and relevant full browser regression, independent review, fix material issues, push/deploy and verify public URL under existing authorization.


Validation and decisions:
- Built-in imagegen produced dashboard.png (1536x1024) and wheel.png (1254x1254), original RGBA output copied into app/public/assets/cabin. Windshield alpha verified zero, fascia opaque, wheel gaps transparent. Exact prompts and hashes are shipped beside them. Original assets/example is untouched, untracked, and not bundled.
- Two CC BY models downloaded from pinned carros revision 2d18dfd9db96bbf0d9cffa949deaf7f571388cbf. Imported models face +Z: rotate both by PI. Aventador's detached roof panels were excluded before fitting; Cullinan is scaled from source units. Source model geometry remains owned by VisualAssets. Visible fitted geometry and collision rectangles share representative declared dimensions.
- New fit/collision tests were RED for missing fleet module before implementation. 39/39 unit tests and production build pass. Both parallel scenes remain solvable with collision-free reverse arcs and correction.
- Production Edge checks passed photo DOM preservation, SVG gauges, rotating wheel, mirror image equality with/without foreground (no occlusion), R monitor, photo and model failure fallbacks, all three scenes, rapid changes during loading, resets, keyboard focus and mobile layouts.
- Existing PRND/brake/creep/pause regression, 12 brake event variants, DPI camera framing, five environment/model load failure cases and credits navigation passed. Zero page errors.
- Scrolled R monitor remains live (mean pixel delta 4.36). New independent reviewer caught drawing outside the driver panel at 821px width. Browser test reproduced the leak (gap color deviation153), then passed at821/860/900 after retaining full viewport mapping and intersecting only the scissor with driver bounds. Photo/fallback/scroll checks and the full unit suite were rerun after this fix. No deferred review findings.
- This machine: Intel Iris Xe headless sample mean42.5 FPS, median16.9ms, p95 33.5ms; not a device-independent performance claim.
- Scope choices: fixed-camera photo composition instead of a freely navigable cabin, branded licensed neighboring cars with representative rather than certified dimensions. No real-car calibration or price/damage estimates. These choices are documented in README.

Local implementation and review complete. Public deployment validation follows.
