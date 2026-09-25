# CHEAT OR DIE

A browser-native FPS/roguelite prototype where cheats are physical build parts. Player, target dummies, and future enemies share the same modular RobotEntity; controllers only supply intent.

Live sandbox: https://collinsomniac.github.io/cheatordie-game/

## Current prototype

The default build is SANDBOX 0.3, not the final roguelite loop:

- original low-poly Dustlab test map with long/mid/short/tunnel FPS routing
- one stationary shared-entity target dummy that automatically resets after a kill
- landscape-first mobile presentation sized to the browser visual viewport
- responsive boot sheet with gameplay HUD hidden until the engine is running
- floating left movement region + right swipe look + tap fire + hold/drag FIRE
- draggable/saved touch HUD controls
- gamepad and desktop input through the same ControlIntent path
- first/third-person cameras and primitive single/dual-carbine viewmodels
- anatomical ten-socket chassis editor
- multi-slot cheat footprints and visible hardware
- TAG-ESP one-sensor telemetry and XRAY two-sensor through-wall silhouette
- stronger auto-BHOP movement module
- three-slot AKIMBO harness
- one-slot and two-slot anti-aim/spinbot hardware
- five-slot Rage Aimbot plus a separate Pose Resolver counter
- sandbox target spinbot toggle for HvH testing
- 100 shield + 100 health with non-overflow shield breaks and projected damage numbers
- active/passive mutation status tray
- WebGPU preferred, WebGL2 automatic fallback
- iOS defaults to native kinematic collision; Havok WASM remains optional/diagnostic
- adaptive internal resolution and browser runtime smoke testing

## Controls

Touch: landscape only. Touch anywhere in the left movement region to establish a temporary joystick origin. Drag the right side to look; a quick stationary tap fires once. FIRE can be held and dragged for continuous fire + look correction. JUMP, RUN, VIEW are movable through EDIT HUD.

Gamepad: left stick move, right stick aim, RT fire, A jump, L3 sprint, Y camera.

Desktop: WASD, mouse, left click, Space, Shift, V. Press C or Tab for the chassis editor.

## Chassis lab

The editor has one active loadout. The left side maps ten body sockets; the right side is the hardware catalog. A part declares one or more complete mount footprints.

Examples:

- MAG-OPTIC: one head/sensor slot
- TAG-ESP: one sensor, through-cover identity/vitals telemetry only
- XRAY: both sensors, full-body through-wall silhouette + telemetry
- BHOP: one leg or core
- AKIMBO: both arms + torso
- SPIN-L: one core/utility slot
- SPIN-X: core + utility
- RESOLVER: head + one sensor
- AIMBOT: head + both sensors + both arms

Tap any occupied socket to eject the complete installed part.

## Developer diagnostics

- ?debug=1 exposes renderer/physics/performance information
- ?backend=webgl or ?backend=webgpu force graphics
- ?physics=kinematic or ?physics=havok force physics
- ?compat=1 enables Babylon WebGPU compatibility mode

Normal players should not need these; fallback is automatic.

## Maintained docs

- docs/STATUS.md — current implementation, debt, next priorities
- docs/ARCHITECTURE.md — stable system boundaries
- docs/DESIGN.md — current design rationale and research
- docs/PERFORMANCE.md — iPhone/browser performance contract
- docs/PLAYTEST.md — repeatable sandbox test procedure
