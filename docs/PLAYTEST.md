# Sandbox playtest

## Mobile boot

1. Rotate to landscape when prompted.
2. Tap ENTER SANDBOX.
3. In ordinary Safari, confirm the game exactly fits the visible browser content rectangle without cropping. Then use Share -> Add to Home Screen and compare the installed-app presentation.
4. Confirm rapid taps do not trigger Safari double-tap zoom, selection, callouts, or page movement.
5. Confirm FIRE, JUMP, RUN, VIEW and both gesture regions are completely on-screen.

## Movement

Before installing hardware, touch several different points in the left half and verify each becomes the temporary movement origin. Test slow movement, strong-forward auto-sprint, hard reversals, diagonal sprint, jump while moving, manual bunny-hop timing, long-lane strafing, short/catwalk routing, and tunnel routing.

Report dead zone, acceleration/stopping, max speed, air control, jump height, and auto-sprint threshold.

Desktop note: Pointer Lock now starts only when the canvas is clicked; boot and chassis UI do not seize the pointer automatically.

## Aim

Test 180 turns, tiny target corrections, tracking while strafing, a quick stationary right-side tap for one shot, a right-side drag that does not fire, holding FIRE and dragging the same thumb, and target reacquisition after running a route.

Report horizontal/vertical sensitivity, perceived latency, fire-drag comfort, button occlusion, and accidental browser gestures.

## Chassis lab

- install MAG-OPTIC then eject it via an occupied body socket
- install ECHO-ESP and press EMIT TARGET NOISE
- install XRAY and compare persistent telemetry
- free the required sockets and install HARDLOCK; verify all five sockets occupy
- confirm blocked catalog entries communicate incompatibility

## Environment

Evaluate long sightline, mid doorway/cover, short elevated route, tunnel route, route-flow enjoyment, collision snagging, ramps, corners, camera clipping, and map scale.

## Performance report

If useful add ?debug=1 and report: device, iOS, browser/PWA, graphics/physics, FPS/render scale, session length, thermal behavior, movement, aim, fire-drag, layout conflicts, Dustlab collision problems, loadout UI, favorite/least useful part, and bugs.


## HUD placement

Tap EDIT HUD, drag FIRE/JUMP/RUN/VIEW into comfortable positions, then tap LOCK HUD. Reload and confirm positions persist. Test RESET. Controls should never be draggable outside the fitted game viewport.

## Shields and damage numbers

The target starts at 100 shield / 100 health. With the current 22-damage carbine, verify shield damage numbers are blue and health numbers red. The fifth shield hit should consume only the remaining shield amount and must not overflow into health; the next shot begins health damage.
