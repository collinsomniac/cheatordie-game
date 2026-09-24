# CHEAT OR DIE

A browser-native roguelite FPS prototype where **cheats are the build system**. The player and enemies are the same modular robot entity; what changes is who/what supplies its control intent and which illegal firmware mutations are installed.

## Stack

- Babylon.js 9 + WebGPU (WebGL2 fallback)
- TypeScript + Vite
- Havok Physics via WebAssembly
- Static deployment through GitHub Pages
- Procedural prototype assets: no external asset pipeline is required to run the current build

## Run locally

```bash
npm install
npm run dev
```

Open the shown local URL. For forced WebGL2 debugging, append `?backend=webgl`.

## Controls

**Gamepad:** left stick move, right stick aim, RT fire, A jump, L3 sprint, Y switch first/third person.

**Desktop:** WASD, mouse, left click, Space, Shift, V.

The first mobile development target is a standard Bluetooth/USB-C gamepad on iPhone. Touch controls come after the combat feel stabilizes.

## Architecture

The central invariant is **entity parity**. `RobotEntity` contains the body, physics, weapon, health, mutation loadout, and movement implementation. Player and enemy behavior enter through the same `RobotController -> ControlIntent` boundary. That keeps future bot takeover, assistance, replay, multiplayer, and cheat/mutation systems from forking the gameplay code.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md), and [`docs/RESEARCH.md`](docs/RESEARCH.md).

## GitHub Pages

The repository includes an Actions workflow that builds Vite and publishes `dist/`. The Vite base path is pinned to `/cheatordie-game/` for project Pages hosting.
