# Mobile performance contract

The primary device class is a modern iPhone running Safari/WebKit with WebGPU. Performance features are treated as part of the visual design, not emergency degradation modes.

## Frame budget

Target 60 Hz simulation and presentation first. A stable 60 is more valuable than intermittent 120 during the early prototype because physics, AI and input behavior need predictable tuning. After the 60 Hz workload is comfortably below budget on-device, a 120 Hz presentation mode can be profiled separately.

The simulation uses a fixed 60 Hz accumulator. AI perception/planning should later use staggered lower-frequency updates while locomotion and firing remain responsive.

## Pixels

Do not render at the phone's native devicePixelRatio by default. The current adaptive renderer starts at 88% of CSS resolution and moves between 62% and 100% based on sustained frame rate. This avoids millions of unnecessary fragment operations and creates the desired coarse raster look for free.

A full-resolution pixelation post-process is not the primary technique: it performs the expensive full-resolution scene render first. Post effects should be justified by measured visual value.

## Geometry and draw calls

Favor chunky reusable modular robot pieces and environmental kits. Use instancing/thin instances for repeated props, merge truly static environment batches, use LODs for distant silhouettes, and keep collision geometry simpler than visible geometry. Preserve separate robot body modules where gameplay needs visible equipment swapping.

## Materials and lighting

Start from opaque materials, a tiny palette, one broad ambient source and one key light. Avoid real-time per-light shadows until profiling shows room. Transparency/particles are a budgeted effect because mobile overdraw can become more expensive than polygon count.

## Assets

Production models: GLB/glTF. Production textures: KTX2/Basis Universal. Add meshopt geometry compression/decoding once authored assets enter the repo. Prefer small tiled/detail textures, vertex colors and palette-driven variation over many unique large maps.

## Allocation / garbage collection

Frame code should reuse vectors and pools where practical. The initial tracer effect is a fixed pool rather than creating and disposing meshes/materials for every bullet. Projectiles, decals, particles and enemy corpses should follow the same pattern as they become frequent.

## WASM

Havok runs as WASM but the initial game does not require SharedArrayBuffer or cross-origin-isolated threading. That keeps classic GitHub Pages deployment uncomplicated. Worker/thread experiments should prove a measurable bottleneck before becoming architectural requirements.

## Regression path

WebGPU is primary; `?backend=webgl` deliberately remains supported for device/backend regression testing. Record device, iOS version, backend, internal render scale, FPS and encounter size when reporting performance bugs.


## Conditional WASM loading

Havok is dynamically imported only when the Havok physics path is selected. The current production WASM asset is roughly 2.1 MB raw (~669 KB gzip in CI output); iOS currently defaults to native kinematic collision, so normal phone boots do not need to fetch or instantiate that asset. `?physics=havok` opts into the WASM path explicitly.
