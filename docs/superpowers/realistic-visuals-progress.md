# Progress — 2026-10-27 realistic visuals

Base: ee08bb0d2329b201bb928c583b062d6495023297. Plan: plans/2026-10-27-realistic-visuals.md. Spec: specs/2026-10-27-realistic-visuals-design.md.

- Assets: local pinned Ferrari model, local Draco decoder, six Poly Haven texture maps and HDR, attribution page and checksum manifest. Approximately 8.4 MB.
- Model fitting: asymmetric bounds and degenerate-bounds regression observed failing before implementation; both pass with the implementation. Full suite 23/23.
- Implemented async asset ownership, fallbacks, detailed vehicle, seeded instanced foliage, cockpit and dynamic instruments. Preserved input/physics and five cameras.
- Desktop and mobile screenshot inspection caught instrument occlusion and an open footwell; adjusted cockpit geometry and eye position.
- Browser interaction suite passes at 320/390/768/1440 widths. Optional HDR/model/diffuse failure scenarios all pass movement, live rear mirror, Space braking and no page errors.
- Initial brake batch was interrupted by live development changes / concurrent browser inspection; repeat on stable production preview before completion.
- Dense material detail raises unfiltered pixel differences across DPI. Inspect paired images and measure framing independently from high-frequency texture antialiasing before adjusting the comparison.

Implementation decisions: use the existing project directory and a feature branch to keep assets where requested; use a representative openly licensed sports-car exterior, explicitly described in README and credits, rather than imply the concept SUV is already reproduced. No physics calibration claim. Procedural leaf instances avoid a 46–958 MB scanned-tree download.

## Final review and fix pass

Fresh read-only review by realistic_review (gpt-6-astra): no critical or important code defects. One minor return-link bug; escalated to fix because a real navigation path leaves the published repository URL. Browser regression reproduced the incorrect URL, then passed after changing ../../ to ../.

Performance concern measured on Intel Iris Xe, Edge at 1440 × 1000: original 358,788-triangle car produced 18.9–19.8 FPS, median frame 50 ms. This warranted a fix. Asset-budget test first failed (358788 >= 90000). Offline simplification with attribute rebuilding reduced it to 56,520 triangles and 317,468 bytes; asset-budget test and manifest checks now pass. First optimized run reached 27.1 FPS, median 33.4 ms. A further exterior-only shadow-caster change avoids drawing hidden interior hardware into the shadow map. Final measurement follows in the completion record.

New tests require Node filesystem/crypto types; added explicit @types/node dev dependency so CI does not accidentally rely on a parent directory's type package. Full suite 25/25; build passes, npm audit reports zero vulnerabilities. The Three.js bundle size warning remains an informational build warning.

Review scope decisions: exact SUV reproduction/calibration are explicitly deferred product choices, with representative-car limitations visible in README and credits. No physical mobile frame-rate claim is made. Latest narrow-layout rendering is checked by refreshed screenshots and the existing 320/390/768 layout test. Historical input behavior is covered by the full main/browser brake regression suite despite remaining unchanged. The independent reviewer inspected code/assets; the author ran all tests. No unresolved review findings remain.

Final screenshot inspection caught a compressed-normal/topology mismatch causing faceted black reflections. An isolated render with MeshNormalMaterial reproduced it; rebuilding decoded vertex normals removed the artifacts. The normal-rebuild regression failed before the helper existed, then passed. Rebuild runs once on the decoded shared template before clones are made. Shadow-receiving was restored after this diagnosis; disabling shadows was not the fix. Final suite: 26/26 and production build pass. Final screenshots show smooth car surfaces, readable cockpit instruments, and the closed footwell. Performance numbers above are exploratory desktop measurements, not a guaranteed frame-rate or mobile benchmark.
