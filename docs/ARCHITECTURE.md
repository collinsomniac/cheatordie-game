# Architecture

## Non-negotiable design rule: player/bot parity

Every combatant is a `RobotEntity`. A robot owns its chassis representation, Havok character controller, stats, health, weapon behavior, mutation loadout, and simulation state. The only intentional distinction between a player and an enemy is the source of `ControlIntent`.

```text
PlayerController ─┐
                  ├─> ControlIntent ─> mutation pipeline ─> RobotEntity ─> Havok/world
BotController ────┘
```

This boundary is deliberately small. Later controllers may include replay ghosts, network input, aim-assistance agents, higher-level tactical AI, or full automation without changing movement/weapon code.

## Mutation pipeline

Mutations currently modify stats or intent, but the interface is intended to expand into explicit stages:

```text
sensors -> target model -> intent -> movement/aim -> weapon -> physics
```

Cheats should intercept or replace one of those stages rather than behave only like ordinary RPG stat boosts. The first prototype includes aim assist, triggerbot, speedhack, bunny-hop automation, recoil cancellation, and overclocking because they exercise distinct parts of the pipeline.

## Rendering

WebGPU is preferred. `?backend=webgl` forces the WebGL2 backend for regression testing. The renderer intentionally avoids device-pixel-ratio rendering and instead uses a dynamic internal scale. This is both a mobile performance strategy and part of the aesthetic: lower internal resolution should look intentional rather than like a degraded mode.

Current prototype art is built from primitives with shared/simple materials. The production asset path should use GLB/glTF, KTX2/Basis textures, meshopt compression, LODs, and instancing/thin instances for repeated geometry.

## Physics

Havok WASM is initialized once. Static arena geometry uses physics aggregates; all robots use Babylon's Havok character controller. Keep the first performance target single-threaded so classic GitHub Pages remains a no-special-server deployment.

## Simulation

Gameplay steps at 60 Hz using an accumulator; rendering is independent. Expensive AI should later be scheduled at lower frequencies than locomotion/physics where possible. A future Director layer should control encounter pressure and wave composition separately from individual bot decision-making.

## Performance budget principles

Prefer fewer pixels before fewer triangles. Avoid full-device-DPR rendering on phones. Keep dynamic light/shadow counts low, reduce transparency/overdraw, pool short-lived effects, instance repeated meshes, compress GPU textures, bake static work, and measure on-device before adding visual cost.


## Body-slot occupancy

The ten baseline body sockets are now enforced by `MutationLoadout`. Each installed mutation instance occupies exactly one compatible physical socket, so arm cheats compete with other arm cheats, leg cheats compete with movement hardware, and core/utility hardware competes for limited space. Upgrade offers are filtered to mutations that can actually mount. Replacement/swapping UI is intentionally deferred; once all compatible sockets are saturated, the run continues without another install until replacement mechanics exist.
