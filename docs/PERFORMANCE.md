# Mobile performance contract

Primary target: modern iPhone Safari/WebKit with WebGPU rendering. Performance decisions should reinforce the low-detail PS2-like aesthetic.

## Frame and simulation

- fixed 60 Hz simulation
- rendering independent
- stable 60 before pursuing 120 Hz presentation
- expensive future sensing/AI can be staggered below simulation rate

## Pixels

Do not render at native phone devicePixelRatio by default. Adaptive internal scale moves between 62% and 100% of CSS resolution. This saves fragment work before shading; a full-resolution pixelation post effect does not.

## Materials / geometry

Prefer opaque materials, low material count, reusable modular geometry, instancing for repeated props, simple collision proxies, low overdraw, one broad ambient source + one key light, and baked/static work where it helps.

Current Dustlab stays primitive while layout proportions are changing.

## Assets

Target GLB/glTF geometry, KTX2/Basis textures, meshopt when useful, explicit LOD/collision proxies, and small tiled/detail textures. Curate assets individually rather than importing entire libraries.

## Browser / physics

Graphics and physics are independent: WebGPU preferred with WebGL2 fallback; iOS defaults to kinematic collisions; Havok is optional and dynamically imported. Baseline requires no SharedArrayBuffer or cross-origin isolation.

## Allocation

Existing hot-path cleanup includes pooled tracers, cached robot stats, mutation HUD updates only on revision changes, and shared/frozen robot material palettes.

## Diagnostics

Normal UI hides backend internals. ?debug=1 exposes renderer/physics/render-scale. CI enforces Pages path/chunk budgets and a real browser boot.
