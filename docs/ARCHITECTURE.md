# Architecture

## Entity parity

Every combatant is a RobotEntity. Player, stationary sandbox target, future AI enemies, replay ghosts, automation agents, and eventual network players should differ primarily by the RobotController producing ControlIntent.

Touch / Mouse / Gamepad -> PlayerController -> ControlIntent -> RobotEntity
Static target -> StaticBotController -> ControlIntent -> RobotEntity
Future AI -> BotController -> ControlIntent -> RobotEntity

Movement, health, weapon execution, physics, sensors, and installed hardware remain shared.

## Presentation and simulation

The simulation runs at a fixed 60 Hz accumulator while rendering is independent. The chassis editor pauses control without replacing the world. Touch, gamepad, and desktop merge into one intent object.

## Physics as a backend

- WebGPU preferred; WebGL2 falls back automatically.
- iOS currently defaults to Babylon native kinematic collision.
- Havok is lazy-loaded only when selected and can fall back when initialization fails.

This prevents one WASM runtime from being a boot dependency.

## Sandbox

The default runtime is deliberately small: Dustlab + Player RobotEntity + stationary Target RobotEntity + weapon/viewmodel + chassis lab + diagnostics. There is no wave loop running underneath it.

## Hardware / loadout

The ten sockets are head, left/right sensors, left/right arms, torso, core, left/right legs, and utility.

A MutationDefinition declares one or more complete legal mount patterns. An installed instance owns every socket in the chosen pattern. A large package can consume head + both sensors + both arms while a cheap optic consumes one sensor. Uninstalling any occupied socket ejects the entire instance.

Balancing therefore has three independent axes: strength, footprint/opportunity cost, and compatibility.

## Cheat pipeline

Long-term direction: world truth -> sensors -> target model/memory -> intent assistance -> movement/aim -> weapon policy -> physics.

Current sensor baseline respects line of sight. ECHO-ESP adds conditional through-cover telemetry while noisy; XRAY adds persistent telemetry. HARDLOCK improves visible-target correction/trigger behavior but does not secretly grant wall sensing.

## Assets

Current Dustlab and robot hardware are primitives because level proportions are still moving. Authored assets should be owned or clearly licensed GLB/glTF, then optionally meshopt/KTX2 processed with explicit collision proxies and LODs.

## CI contract

A build is not valid merely because TypeScript/Vite compile. CI boots production in Chromium and verifies SYSTEM READY, kinematic desktop boot, iPhone-like mobile boot, visible touch controls, opening the chassis editor, rendering parts, installing hardware into sockets, and sandbox diagnostics.
