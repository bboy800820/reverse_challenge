# Phone controller implementation plan

Goal: Computer renders the existing simulator; a phone joins by QR and controls steering, pedals and gears. User approved the free-cloud WebSocket approach and requested both iPhone and Android support.

Architecture: Existing Vite/Pages frontend plus a lightweight Node/ws room relay deployed on Render free. A separate controller.html avoids loading Three.js on phones. The desktop remains authoritative for physics. QR contains a random room credential in its URL fragment. No accounts or database are needed. Existing assets and normal/fullscreen layouts are preserved.

Alternatives: local server requires local HTTPS/network setup; WebRTC needs signaling and potentially TURN. WebSocket relay is the approved initial option, with latency measured before optimizing further.

## Tasks
- [x] 1. Relay: add server/package.json, server/index.mjs, server/relay.test.mjs and render.yaml. Exercise room creation, unauthorized/duplicate joins, relay, disconnect and payload limits with real sockets. One host and one controller per room; random 192-bit credential; 2-hour room expiry; bounded clients/rooms/messages and origin allowlist. /health endpoint. No paid resources.
- [x] 2. Control safety: remote-input.ts and tests; optional absolute target steering in simulation. 30Hz frames carry sequence, echoed desktop timestamp and epoch. Reject stale (>600ms), nonfinite, duplicate and old-epoch input. Local watchdog pauses/holds and clears input. Explicit neutral resume after pairing, loss, blur, resets and fullscreen changes. Keyboard Space brakes even with remote steering. Test failure before implementation, then full test suite.
- [x] 3. UI: remote-host.ts pairing dialog, QR and connection status; controller.ts/css with landscape/portrait touch controls, motion permission, calibration, sensitivity, brake priority, hold, PRND and explicit resume. Two landscape orientations and touch cancellation/background cleanup. Validate via two browser contexts and sensor event injection, without claiming physical phone validation.
- [ ] 4. Integration/deployment: Pages build-time VITE_RELAY_URL plus manual service URL fallback; Render blueprint and documentation. Run unit/server/build checks and sequential browser regressions, fresh final reviewer, push to authorized bboy800820 repository. Deploy backend if authenticated; otherwise provide exact free deployment link and clearly distinguish ready code from live backend.

## Review focus
- Old queued throttle after reconnect, paused state or delayed delivery must never restart motion.
- Desktop emergency brake and gear interlocks must win over phone input.
- Motion axis/sign in either landscape orientation, invalid sensor values and touch fallback.
- Dialog/fullscreen/scene lifecycle must not leave stale pedals or disable ordinary keyboard use.
- Public relay input validation, origin restrictions, bounded resources and single-controller ownership.

## Verification record
Ruling: Existing user approval covers the concrete approach already discussed; proceed without another design approval loop. Preserve untracked assets/example and assets/ux-concepts.


Task 1: complete - real-socket server tests: 3 passed, including authorization, single phone, disconnect, origins, room isolation and oversized messages.
Task 2: complete - app tests: 44 passed across 8 files; TypeScript and production Vite build passed.
Task 3: complete - scripts/verify-phone-controller.py passed against dev and production preview: QR/link pairing, reverse/drive, absolute steering, brake priority, motion stream injection, high-frequency pointer moves, pause/resume, timeout, reconnect, phone sizes and keyboard fallback. scripts/verify-phone-modal.py passed against production preview. Existing fullscreen suite passed native mode and six fallback sizes. Preview images inspected.
Final review: fresh read-only reviewer phone_controller_review found three Important issues; no Critical or Minor findings. Each was reproduced before fixing: (1) timeout gap between watchdog ticks now rejects all armed-stream frames until reset; (2) open pairing dialog blocks resume; (3) high-frequency touch moves now coalesce into 30Hz updates. Corresponding tests then passed.
Ruling: Production-preview testing also reproduced a pause/resume epoch race during rapid mode changes. Controller now waits for the desktop pause acknowledgement before enabling resume; full production test passed afterward.
Ruling: Render authentication/service URL unavailable in this environment. Backend is packaged as a free Singapore Render Blueprint; deployment remains pending user account setup. Do not claim a live relay.
Ruling: Physical iPhone/Android sensor feel, native permission prompts and real-cloud latency need real devices after deployment; automated sensor injection is not a replacement. Preview appearance inspected separately. Original untracked user assets remain untouched.

Task 4 frontend: code commit 825ba80 pushed to main under bboy800820. Pages run 40843152969 completed successfully (build and deploy). Public controller.html returned HTTP 200. Public browser UI smoke could not be completed because isolated Edge encountered connection reset / interrupted navigation; no claim of a public browser pass. Production-preview end-to-end and modal tests passed before upload. Render service activation and real-device checks remain pending the user's account setup and service URL.
Temporary relay/dev/preview processes stopped; original user preview server left untouched. Working tree retains only the original untracked assets/example and assets/ux-concepts.
