# Project status

Last reviewed: 2026-09-24

Live build: https://collinsomniac.github.io/cheatordie-game/

## Current development surface

Default prototype is SANDBOX 0.2, replacing the earlier wave-loop test.

Implemented:
- landscape-first mobile presentation with fullscreen/orientation requests and portrait rotation gate
- floating left movement region + right swipe aim + tap-right single fire + hold/drag FIRE
- desktop/gamepad parity through one input pipeline
- original Dustlab low-poly FPS blockout
- one stationary shared-entity target with automatic reset
- ten-socket anatomical chassis editor
- multi-slot hardware footprints and whole-item ejection
- physical robot hardware rebuilt from installed footprints
- MAG-OPTIC, trigger servo, speed actuator, BHOP, recoil servo, overclock
- ECHO-ESP conditional one-sensor telemetry
- XRAY permanent two-sensor telemetry
- HARDLOCK five-socket package
- target-noise diagnostic pulse
- WebGPU/WebGL fallback and iOS kinematic/Havok separation
- adaptive render resolution
- draggable/savable touch HUD layout with EDIT HUD / LOCK HUD / RESET
- visualViewport-sized game shell plus installable fullscreen/standalone web-app manifest
- active iOS gesture suppression on gameplay controls to avoid double-tap zoom/text selection
- 100 shield + 100 health on all robots, with shield-breaking hits consuming all overflow
- projected blue/red damage numbers for shield/health damage
- browser smoke test for boot/mobile/editor/install diagnostics, viewport fit, control bounds, and vitals

## Intentional limitations

- one hard-coded carbine; WeaponDefinition/WeaponState extraction remains next
- primitive robot/viewmodel/map geometry
- no authored audio
- no final roguelite loop while movement/composition is being tuned
- no active combat AI in sandbox
- ESP is simple screen-space telemetry rather than final silhouettes
- simple noise simulation
- HUD editor currently moves controls but does not yet resize/change opacity
- ordinary iPhone Safari still cannot programmatically enter interactive fullscreen; Home Screen installation is the expected chrome-free route
- manifest/installability exists, but no offline service-worker cache yet
- CI runtime smoke is WebGL2/kinematic; WebGPU still needs real-device validation

## Next priorities

1. Real iPhone playtest of visual-viewport fit, Home Screen launch, floating movement, tap-fire, fire-drag and editable HUD.
2. Tune movement/FOV/recoil/viewmodel.
3. Extract WeaponDefinition / WeaponState before multiple weapons.
4. Refine sensor semantics and sensor-to-aim composition.
5. Import a small curated subset of CC0 GLB environment props and establish scale/LOD/collision conventions.
6. Replace primitive robot hardware with an authored modular kit while preserving socket silhouettes.
7. Add sensitivity, then button size/position/opacity; evaluate gyro.
8. Reintroduce roguelite encounter progression only after sandbox play is intrinsically enjoyable.

## Asset/legal rule

Do not copy Counter-Strike/Dust II geometry or Valve assets into this independent browser project. Use their level-design lessons while keeping Dustlab original. Favor owned or clearly licensed assets; Kenney/Quaternius CC0 sources are strong candidates.

## Technical debt

- StandardMaterial remains the largest avoidable Babylon dependency.
- perception/sensor projection still allocates vectors that can later be pooled.
- kinematic collision needs phone testing on Dustlab ramps/edges.
- camera-parented viewmodel needs wall/depth testing.
- future visual GLBs should use separate simple collision proxies.
