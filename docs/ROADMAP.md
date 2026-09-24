# Development roadmap

This is a living direction document, not a promise to restart the prototype at each phase. Systems should evolve in place behind stable boundaries.

## v0.1 — executable combat skeleton

Current foundation: WebGPU-first Babylon.js, WebGL2 regression fallback, Havok WASM character physics, standard gamepad + desktop input, shared player/bot RobotEntity, first/third-person cameras, hitscan carbine, pooled tracers, escalating waves, six mutation prototypes, fixed 60 Hz simulation, adaptive internal render resolution, CI, and Pages deployment workflow.

Success criterion: repeatedly boot, move, aim, shoot, kill a wave, select a mutation, and continue without special tooling.

## v0.2 — make the baseline FPS intrinsically fun

Tune acceleration, air control, strafe response, stick curves, FOV, recoil, hit confirmation, enemy hit reactions, camera motion, weapon presentation, audio, and encounter geometry. Add an explicit performance HUD/debug mode. The ordinary shooter must feel good before cheats begin deleting pieces of it.

## v0.3 — body slots and control-graph mutations

Promote the current mutation hooks into explicit stages: sensors -> target model -> intent -> movement/aim -> weapon -> physics. Implement the ten body slots in data and UI, then make installed hardware visibly alter the shared robot chassis. Parameterize cheats instead of proliferating one-off booleans.

## v0.4 — encounter director and smarter parity bots

Separate per-bot decisions from a Director that controls pressure, composition, spawn timing, recovery windows, and mutation loadouts. Give bots the same equipment rules as the player and use utility/behavior scoring before considering learned policies.

## v0.5 — authored retro-performance asset pipeline

Move from procedural primitives to modular GLB robot/environment kits. Add KTX2/Basis textures, meshopt compression, vertex-color/palette variants, collision proxies, LODs, instancing/thin instances, baked lighting where useful, and a deliberately cheap low-fi material/shader path. Preserve silhouette readability above surface detail.

## v0.6 — iPhone interaction and endurance

Add touch controls only after gamepad feel is stable. Profile Safari/WebGPU on-device for thermals, memory pressure, 30/60/120 Hz behavior, orientation changes, app switching, controller reconnect, and long sessions. Add PWA/offline caching when asset URLs stabilize.

## v0.7 — roguelite depth

Expand weapons, mutation interactions, corruption/tradeoffs, room/wave variety, elites, bosses, run seeds, shops or intermissions, and meta-progression only where it creates new decisions rather than flat stat inflation.

## Architectural invariants

Player and bots remain the same gameplay entity. Controllers produce intent rather than owning movement/combat rules. Mutations modify named stages instead of reaching arbitrarily across the codebase. Rendering quality can scale without changing simulation results. Frequent effects are pooled. Asset formats remain web-native and cacheable. WebGPU-specific optimizations must not silently break the WebGL regression path unless that trade is measured and documented.
