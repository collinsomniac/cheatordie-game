# CHEAT OR DIE

A browser-native FPS/roguelite prototype where cheats are physical build parts. Player, target dummies, and future enemies share the same modular RobotEntity; controllers only supply intent.

Live sandbox: https://collinsomniac.github.io/cheatordie-game/

## Current prototype

The default build is SANDBOX 0.2, not the final roguelite loop:

- original low-poly Dustlab test map built around long/mid/short/tunnel FPS routing
- one stationary shared-entity target dummy that automatically resets after a kill
- landscape-first mobile presentation with fullscreen/orientation requests
- left virtual movement stick + right-side swipe look + fire-drag aiming
- gamepad and desktop input through the same ControlIntent path
- first/third-person cameras and a primitive carbine viewmodel
- anatomical ten-socket chassis editor available at any time
- multi-slot cheat footprints and physical hardware visualization
- conditional acoustic ESP and permanent two-sensor wall telemetry
- WebGPU preferred, WebGL2 automatic fallback
- iOS defaults to native kinematic collision; Havok WASM remains optional/diagnostic
- adaptive internal resolution and browser runtime smoke testing

## Controls

Touch: landscape only. Left stick moves. Drag the right side to look. FIRE can be held and dragged to aim simultaneously. JUMP, RUN, and VIEW are separate low-opacity buttons. Strong forward stick input also auto-sprints.

Gamepad: left stick move, right stick aim, RT fire, A jump, L3 sprint, Y camera.

Desktop: WASD, mouse, left click, Space, Shift, V. Press C or Tab for the chassis editor.

## Chassis lab

The editor has one active loadout. The left side maps the ten body sockets; the right side is the part inventory. A part declares one or more legal mount footprints rather than merely a list of interchangeable slots.

Examples: MAG-OPTIC uses one head/sensor slot; ECHO-ESP uses one sensor conditionally; XRAY uses both sensors permanently; HARDLOCK consumes head + both sensors + both arms.

Tap an occupied socket to eject the entire part occupying it.

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
