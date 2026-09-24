# Project status

Last reviewed: 2026-09-24

Live build: https://collinsomniac.github.io/cheatordie-game/

## What is real today

- GitHub Pages deployment from `main` through Actions is working.
- CI now boots the built app in headless Chromium after compilation, testing both forced WebGL2 + kinematic physics and forced WebGL2 + Havok. This catches runtime boot failures that TypeScript/Vite alone cannot detect.
- CI uses a committed lockfile and `npm ci`, then TypeScript + Vite production build + bundle/path verification.
- WebGPU is preferred, WebGL2 is a runtime fallback, and `?backend=webgpu` / `?backend=webgl` can force a backend for regression testing.
- Havok WASM remains available on desktop/compatible browsers, with automatic fallback to Babylon native kinematic collisions on initialization failure. iOS currently defaults directly to kinematic collision for boot reliability because Havok's WASM/SIMD path has had Safari compatibility failures; `?physics=havok` explicitly opts into Havok for iOS testing and `?physics=kinematic` forces the safe path everywhere.
- Player and bots are the same `RobotEntity`; controllers only provide `ControlIntent`.
- Standard gamepad and desktop mouse/keyboard controls exist.
- First- and third-person cameras exist; first person has a cheap camera-parented carbine viewmodel with bob, recoil, and muzzle flash.
- Combat has hitscan damage, pooled tracers, hit confirmation, damage vignette, death/reboot, and escalating waves.
- Normal target perception now respects static-geometry line of sight. Bots remember the last visible player position and have a simple anti-stuck escape behavior.
- Six cheat modules exist: aim assist, triggerbot, speedhack, bunny-hop automation, recoil cancellation, and overclock.
- The ten-slot chassis model is enforced. Every installed module consumes one compatible physical socket and visible hardware is mounted according to the actual occupied socket.
- Seeded runs are supported with `?seed=<number>`. Upgrade generation has its own deterministic stream and each bot receives a deterministic per-wave/per-index stream.
- Internal render resolution adapts between 62% and 100% of CSS resolution rather than paying native phone DPR cost.
- Repeated robot palettes are shared/frozen, short-lived tracers are pooled, robot stats are cached until loadout changes, and the mutation HUD only rebuilds when the loadout revision changes.

## Current build budget

The 2026-09-24 validation build reported approximately:

- all JavaScript: ~2.04 MiB raw / ~515 KiB gzip
- gameplay chunk: ~190 KiB raw / ~46 KiB gzip
- world/bootstrap chunk: ~447 KiB raw / ~112 KiB gzip
- largest Babylon-derived chunk: ~887 KiB raw / ~214 KiB gzip

CI fails if a single JavaScript chunk grows beyond 1.25 MB raw or if the production HTML loses the `/cheatordie-game/` Pages base path.

## Prototype shortcuts that are now known debt

### Combat feel

The game still has only one hard-coded hitscan weapon. Weapon damage/range/fire cadence/recoil are mixed into `RobotStats` instead of living behind a real weapon interface. Before adding several guns, extract a `WeaponDefinition/WeaponState` boundary so cheat modules can intercept weapon stages cleanly.

The first-person weapon is intentionally primitive and camera-parented. It is not yet rendered through a dedicated viewmodel camera/layer, so wall intersection/depth behavior needs real-device checking before polishing it.

There is no authored audio yet. Keep audio isolated from core simulation because current iOS/WebKit still has difficult Web Audio failure modes; gameplay must remain functional when audio is unavailable.

### AI / encounters

Bots now obey LOS and remember last-seen position, but this is not navigation. They have local strafing plus a stuck escape, no navmesh/path graph, no cover selection, no flanking model, and no team coordination.

The current LOS test treats static arena geometry as occlusion but does not treat other robots as visibility blockers. That is intentional for the first sensor pass, not the final perception model.

Wave difficulty is mostly count + per-bot tuning + a few hard-coded enemy mutations. There is no Director yet to create pressure/recovery pacing, composition rules, elites, spawn logic, or run-level encounter variety.

### Mutation/build system

Socket occupancy is real, but there is no replacement/swap/scrap interface. When no compatible socket remains, the run currently continues without an upgrade. This is a temporary saturation behavior.

Physical mutation geometry is still procedural boxes. It proves silhouette/slot semantics but needs a modular authored robot kit before visuals are representative.

There is no wallhack/ESP presentation layer yet, no fake-latency/desync mechanic, no phase/noclip-style rule, and no programmable control graph UI. Current modules exercise aim, trigger, movement, recoil, and weapon timing only.

### Mobile / browser

Touch controls now share the same input-intent path as gamepad/desktop: dual movement/aim sticks plus FIRE, JUMP, RUN, and VIEW overlays appear on coarse-pointer devices after boot. They still need real-device tuning for sensitivity, ergonomics, handedness, and button placement.

No PWA/offline cache is installed yet. Do that after the asset URL/layout stabilizes rather than caching rapidly changing prototype chunks.

Pointer Lock is desktop convenience only; iPhone play must never depend on it.

Adaptive resolution uses a simple frame-rate heuristic. It has not yet been calibrated against real iPhone thermals, GPU time, 120 Hz presentation, memory pressure, or long-session behavior.

### Architecture/performance

Perception still creates target snapshots/vectors and performs LOS raycasts at the 60 Hz simulation rate for bots. If profiling shows this matters, move sensors to cached/staggered lower-frequency updates rather than micro-optimizing vector math first.

`StandardMaterial` remains the largest avoidable Babylon-side dependency. A tiny project-specific WGSL + GLSL material path could reduce bundle/startup cost, but only after the current known-good WebGPU/WebGL build is profiled on-device.

There are build/size checks but no automated runtime browser smoke test. A future lightweight Playwright/WebGL smoke test would catch boot-time JavaScript/runtime errors; WebGPU correctness still needs device testing.

## Immediate priority order

1. **Phone/gamepad playtest the current live build.** Tune baseline movement, stick curves, turn speed, FOV, recoil, camera placement, weapon bob, bot pressure, and adaptive resolution before expanding content.
2. **Extract weapon architecture.** Preserve one working carbine while separating chassis stats, weapon stats, fire mode, projectile/hitscan behavior, and cheat interception points.
3. **Implement socket replacement UX.** Make a full chassis produce an interesting replacement/scrap decision rather than silently skipping upgrades.
4. **Build the sensor/ESP layer.** Use the new LOS data as the baseline sensor contract, then let wallhack/radar modules change what information reaches targeting/UI.
5. **Introduce a small encounter Director.** Separate pacing/spawns/composition from per-bot tactics.
6. **Improve bot navigation.** Start with arena navigation nodes/cover points before pulling in a heavy general navmesh dependency.
7. **Add authored audio as an optional subsystem** and test Safari 27 foreground/background behavior explicitly.
8. **Begin the modular GLB/KTX2 asset pipeline** once movement/combat proportions stop changing every pass.
9. **Profile before deeper renderer surgery.** Only then decide whether custom shaders/materials, workerized systems, Babylon Lite experiments, or more aggressive batching are justified.

## Testing contract

For any gameplay/performance comparison, record the displayed seed and keep it fixed. Change one major variable at a time. Use `?backend=webgl`, `?backend=webgpu`, and `?compat=1` to isolate backend problems rather than conflating them with game logic.
