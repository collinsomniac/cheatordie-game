# Design direction

## Mobile controls

The touch scheme follows a well-proven mobile-FPS pattern: fixed left movement joystick, relative swipe on the right half for look, action buttons layered over that region, FIRE drag-to-aim, strong-forward auto-sprint, landscape-only gameplay, and fullscreen/orientation requests from the boot gesture.

Call of Duty: Mobile documents left-stick movement, right-side drag aiming, HUD placement/size/opacity controls, sensitivity, fixed joystick/fire options, and joystick sprint. Those are references, not a UI to clone.

Sources:
- https://blog.activision.com/call-of-duty/2019-10/Getting-a-Grip-on-the-Call-of-Duty-Mobile-Controls
- https://blog.activision.com/call-of-duty/2019-09/Call-of-Duty-Mobile-Boot-Camp-Part-1-Getting-Started-in-the-Game

Default controls should feel good before a full HUD editor exists. Later customization can add sensitivity, button position/size/opacity, left-handed layouts, and gyro.

## Dustlab instead of Dust II

Counter-Strike and Dust II remain level-design references, but their geometry/assets are not copied. Valve's Steam Subscriber Agreement places important restrictions around Developer Tools and Valve content, including non-commercial terms absent separate permission. An independent browser game should not build its asset foundation on copied Counter-Strike content.

Reference: https://store.steampowered.com/subscriber_agreement/

Dustlab instead borrows abstract level grammar: long lane, contested mid sightline, short/elevated alternate route, tunnel-like occluded path, courtyards, boxes and walls that create predictable peeks, and loops suitable for route practice.

## CC0 art pipeline

A strong later source is https://github.com/petroulacl/fps-buildings-env-kit. It curates GLB Kenney building kits plus Quaternius, Poly Haven, and ambientCG material. The included Kenney City Kit license is CC0. Do not import the full library; select individual assets and preserve provenance.

Sketchfab remains model-by-model: verify each asset license and retain attribution when required.

## Loadout UX

One loadout only. Left side is an anatomical socket map; right side is the available hardware catalog. Body location communicates compatibility faster than labels alone, while cards show icon/category/description and free or blocked footprint.

## Cheat decomposition

ECHO-ESP: one sensor, reveals through-cover telemetry only while simulated target noise is above threshold.

XRAY / Panoptic Array: both sensors, permanent through-cover telemetry.

MAG-OPTIC: one head/sensor slot, small visible-target correction that preserves manual aiming.

HARDLOCK: head + both sensors + both arms, stronger visible-target correction, trigger automation, and recoil control at massive chassis opportunity cost. It does not automatically gain wall sensing.

Movement, weapon automation, sensing, and aim remain separate responsibilities so viable builds do not all collapse into one mandatory aimbot/wallhack package.

## Meta rule

A simple/common part should remain potentially useful late if a build engine is constructed around it. Rarity should primarily change constraints, breadth, risk, efficiency, or footprints rather than automatically obsolete simpler pieces.

## Sandbox before roguelite

The development loop is now: boot -> move/aim/shoot -> open chassis -> install/eject hardware -> test against one target -> trigger diagnostics. Roguelite progression returns only after this surface is intrinsically fun.
