# Playtest protocol

Use this for the first iPhone/gamepad sessions so changes are comparable instead of relying on memory.

## Device record

Record:

- iPhone / iOS version
- Safari or installed web app
- controller model and connection method
- WebGPU or forced WebGL2
- displayed FPS and internal resolution percentage
- run seed shown in the performance label
- orientation
- approximate session length before thermal slowdown, if any

## Five-minute feel test

1. Boot into wave 1 and do not pick up cheats mentally yet: judge the ordinary shooter.
2. Strafe around cover, reverse direction repeatedly, jump while moving, sprint diagonally, and track a bot with the right stick.
3. Toggle third person and check whether robot motion corresponds cleanly to input.
4. Fire continuously while tracking and note whether recoil feels readable or merely annoying.
5. Complete at least three waves and deliberately select mutations that affect different stages (for example speedhack, aim assist, recoil null).
6. Look at mutated enemies in third person / during combat and check whether their hardware reads before you know the loadout.

## Report on 1-5 scales

- left-stick acceleration / stopping
- right-stick precision
- right-stick maximum turn speed
- aim response latency
- recoil readability
- movement weight
- jump usefulness
- arena readability
- enemy readability
- baseline difficulty
- cheat impact
- upgrade decision interest
- visual clarity
- frame consistency

## Performance stress

Stay alive through the largest reachable wave and watch the FPS/resolution display.

A useful report looks like:

```text
iPhone:
iOS:
controller:
backend:
wave:
FPS range:
render scale range:
thermal/session time:
stutters:
visual bugs:
input bugs:
favorite mutation:
least useful mutation:
one thing that felt great:
one thing that felt bad:
```

## Useful URL switches

- `?backend=webgl` — force WebGL2 for backend comparison.
- `?compat=1` — keep Babylon WebGPU compatibility mode enabled instead of the faster render-bundle path.
- `?seed=12345` — reproduce the same upgrade order and bot random decisions. Keep the seed fixed when comparing movement/AI/rendering changes.

Do not change both switches at once when isolating a regression.
