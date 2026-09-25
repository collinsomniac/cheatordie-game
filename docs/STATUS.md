# Project status

Last reviewed: 2026-09-25

Live build: https://collinsomniac.github.io/cheatordie-game/

## Current development surface

Default prototype is SANDBOX 0.3.

Implemented:
- separate responsive boot presentation; gameplay HUD hidden before runtime
- visualViewport-fitted landscape mobile shell
- floating left movement + right swipe aim + tap fire + hold/drag FIRE
- draggable/savable HUD layout with EDIT HUD / LOCK HUD / RESET
- desktop/gamepad parity through one input pipeline
- Dustlab FPS blockout
- shared RobotEntity for player and stationary target
- ten physical body sockets and multi-slot footprints
- active/passive hardware status tray
- MAG-OPTIC, Trigger Servo, Speed actuator, stronger BHOP, Recoil Servo, Overclock
- TAG-ESP one-sensor identity/vitals telemetry through walls
- XRAY two-sensor full emissive through-wall robot silhouette + telemetry
- AIMBOT five-slot strong automated aim package
- RESOLVER two-slot anti-anti-aim package
- SPIN-L one-slot slow visual anti-aim
- SPIN-X two-slot fast spin/jitter anti-aim
- AKIMBO three-slot both-arms + torso dual firing package
- target SPIN-X sandbox toggle for HvH testing
- 100 shield + 100 health with non-overflow shield breaks
- projected blue/red damage numbers
- WebGPU/WebGL fallback and iOS kinematic/Havok separation
- adaptive render resolution
- browser smoke coverage for boot containment, mobile bounds, chassis, ESP tiers, spin target and AKIMBO footprint

## Intentional limitations

- one carbine definition is still hard-coded; WeaponDefinition / WeaponState extraction remains necessary
- AKIMBO currently duplicates the carbine rather than equipping two independently chosen weapons
- primitive robot/viewmodel/map geometry
- XRAY silhouette is deliberately simple solid emissive geometry
- anti-aim currently corrupts automated aim with a deterministic pose-derived lateral error; it is not yet a learned/predictive resolver game
- no temporal history buffer yet, so backtrack/fake-lag mechanics remain research backlog
- no penetration model yet, so autowall is not implemented
- no active combat AI in the sandbox
- no authored audio
- HUD editor changes position but not size/opacity
- ordinary iPhone Safari still cannot guarantee interactive fullscreen; Home Screen launch is expected for the cleanest presentation
- no offline service-worker cache yet
- CI smoke uses WebGL2/kinematic; WebGPU still needs real-device validation

## Next priorities

1. Phone playtest of SANDBOX 0.3 boot sheet and new cheat/counter-cheat hardware.
2. Extract WeaponDefinition / WeaponState so AKIMBO can become a real weapon-composition system.
3. Give aim automation explicit target policies: hit region, certainty/hitchance, shield-vs-health logic, visible-only vs penetration-aware.
4. Introduce a short world-state history buffer as infrastructure for backtrack, fake lag and replay/debugging.
5. Prototype false-telemetry/decoy hardware as a counter to TAG-ESP/XRAY/AIMBOT.
6. Add one combat-capable bot using the same equipment/targeting systems.
7. Import a small curated subset of CC0 GLB environment props.
8. Expand HUD customization with size/opacity/sensitivity and evaluate gyro.

## Asset/legal rule

Do not copy Counter-Strike/Dust II geometry or Valve game assets. Use abstract level-design and cheat-meta lessons while keeping implementation/assets original or clearly licensed.

## Technical debt

- StandardMaterial remains a large Babylon-side dependency.
- wallhack ghost clones are appropriate for one sandbox target but should later use a more scalable highlight/instance strategy for many enemies.
- perception/sensor projection still allocates temporary vectors.
- kinematic collision needs more phone testing on ramps/edges.
- current camera-parented viewmodel needs wall/depth testing.
