# Sandbox playtest

## Boot

1. Load in landscape.
2. Before entering, confirm only the boot sheet is visible: no vitals, CHASSIS or EDIT HUD behind it.
3. Confirm the complete boot sheet stays inside the visible browser area. On an unusually shallow viewport it may scroll internally rather than crop.
4. Tap ENTER SANDBOX.
5. Confirm rapid taps do not invoke Safari zoom, selection, callouts or page movement.

## Movement

Touch several different points in the left half and verify each becomes the temporary movement origin.

Without hardware, test slow movement, strong-forward sprint, reversals, diagonal sprint and jump.

Then install BHOP. Hold movement and compare:
- automatic landing jump timing
- retained horizontal speed
- air steering

The BHOP status chip should visibly activate while the automation is being exercised.

## Aim / fire

Test:
- quick right-side tap -> one shot
- meaningful right-side drag -> look without firing
- FIRE hold -> continuous fire
- FIRE hold + drag -> continuous fire with camera correction
- MAG-OPTIC near target
- AIMBOT with a vanilla target

## ESP tiers

1. Install TAG-ESP in one sensor.
2. Walk behind geometry so the target is occluded.
3. Confirm a floating TARGET-01 tag remains with shield/health/distance.
4. Confirm there is **no body silhouette**.
5. Remove TAG-ESP.
6. Install XRAY.
7. Confirm both sensor sockets are occupied.
8. Confirm the full target robot silhouette remains visible through geometry.

## HvH anti-aim / resolver

1. Open CHASSIS and enable TARGET SPINBOT.
2. Observe the target body spin/jitter while it remains physically stationary.
3. Test manual shooting: your camera and manual aim should remain ordinary.
4. Install MAG-OPTIC or AIMBOT without RESOLVER and observe degraded automated correction.
5. Reconfigure for RESOLVER where compatible and compare automated targeting.
6. Toggle target spinbot back off to establish baseline.

## AKIMBO

1. Free both arm sockets and torso.
2. Install AKIMBO.
3. Confirm exactly three sockets are occupied.
4. First-person view should show a second carbine.
5. Fire and confirm paired tracers/damage events.
6. Compare recoil/visibility with the normal single-carbine configuration.

## HUD placement

Tap EDIT HUD, move FIRE/JUMP/RUN/VIEW, lock, reload, and confirm persistence. RESET should restore defaults.

## Shields and damage numbers

Target begins at 100 shield / 100 health. Current base carbine damage is 22:
- 22 blue
- 22 blue
- 22 blue
- 22 blue
- 12 blue (shield break; overflow discarded)
- next shot begins red health damage

## Environment / performance

Evaluate long/mid/short/tunnel route flow, collision snagging, camera clipping and map scale.

If useful add ?debug=1 and report device, iOS, browser/PWA, graphics/physics, FPS/render scale, session length and thermal behavior.
