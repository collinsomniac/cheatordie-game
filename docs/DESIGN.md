# Design direction

## Mobile controls

The touch scheme follows a mobile-FPS gesture model rather than literal twin fixed joysticks: the left half is a floating movement region whose first touch becomes the temporary joystick origin; the right half is relative swipe-look. A quick stationary tap on the right look surface queues one hip-fire shot, while meaningful dragging only rotates the camera. The dedicated FIRE control remains hold-to-fire and can itself be dragged while held for continuous fire + aim correction. Strong-forward movement auto-sprints. Gameplay is landscape-only.

Call of Duty: Mobile documents left-stick movement, right-side drag aiming, HUD placement/size/opacity controls, sensitivity, fixed joystick/fire options, and joystick sprint. Those are references, not a UI to clone.

Sources:
- https://blog.activision.com/call-of-duty/2019-10/Getting-a-Grip-on-the-Call-of-Duty-Mobile-Controls
- https://blog.activision.com/call-of-duty/2019-09/Call-of-Duty-Mobile-Boot-Camp-Part-1-Getting-Started-in-the-Game

The current HUD editor lets touch users unlock FIRE/JUMP/RUN/VIEW, drag them anywhere inside the visual viewport, then lock/save their normalized positions to local storage. Reset restores defaults. Later customization can add size, opacity, sensitivity profiles, left-handed presets, and gyro.

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


## iPhone fullscreen and viewport contract

Safari 27 on iPhone still does not provide the standard interactive element Fullscreen API for arbitrary web content. The normal browser-tab build therefore cannot programmatically remove the omnibar. CHEAT OR DIE now ships a web-app manifest with fullscreen/standalone display requests and landscape orientation; the practical iPhone route to an app-style chrome-free window is **Share -> Add to Home Screen**, then launch from the Home Screen icon.

The running page sizes the entire game shell from `window.visualViewport` rather than assuming CSS `100vh` equals the visible region. The canvas, HUD, touch surfaces and menus are children of that single fitted shell. CI asserts that the app rectangle matches the visual viewport and that default touch controls remain fully inside it.

Safari still has touch-action edge cases for double-tap zoom on absolutely positioned controls, so the gameplay touch surface also uses active non-passive touch listeners to prevent Safari page gestures. Menus remain outside that suppression boundary.

## Damage layers

Every robot now starts with 100 shield + 100 health.

Shield is an ablative hit layer, not ordinary extra HP: when shield is above zero, the complete incoming hit is resolved against shield and **never overflows into health**. If 1 shield remains and a 1000-damage hit lands, the result is 1 shield damage, shield broken, 100 health unchanged. Only a later hit can damage health.

Damage numbers report actual damage consumed by the layer: shield numbers are blue; health numbers are red. This rule creates room for future shield break/recharge/bypass mechanics without quietly changing the meaning of health.
