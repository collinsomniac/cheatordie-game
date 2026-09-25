# Design direction

## Mobile controls

The touch scheme uses a mobile-FPS gesture model rather than literal twin fixed joysticks: the left half is a floating movement region whose first touch becomes the temporary joystick origin; the right half is relative swipe-look. A quick stationary tap on the right look surface queues one hip-fire shot, while meaningful dragging only rotates the camera. The dedicated FIRE control remains hold-to-fire and can itself be dragged while held for continuous fire + aim correction. Strong-forward movement auto-sprints. Gameplay is landscape-only.

Call of Duty: Mobile documents left-stick movement, right-side drag aiming, movable/resizable/opacity-adjustable HUD pieces, fixed-versus-floating joystick behavior, sensitivity, and separate Simple/Advanced fire modes. Those are references, not a UI to clone.

Sources:
- https://blog.activision.com/call-of-duty/2019-10/Getting-a-Grip-on-the-Call-of-Duty-Mobile-Controls
- https://blog.activision.com/call-of-duty/2019-09/Call-of-Duty-Mobile-Boot-Camp-Part-1-Getting-Started-in-the-Game
- https://github.com/playcanvas/engine/blob/main/src/extras/input/sources/dual-gesture-source.js

The HUD editor lets touch users unlock FIRE/JUMP/RUN/VIEW, drag them inside the visual viewport, then lock/save normalized positions to local storage. Reset restores defaults. Later customization can add size, opacity, sensitivity profiles, left-handed presets, and gyro.

## Boot / iPhone viewport

Boot is a separate presentation state. Gameplay HUD, vitals and chassis tools stay hidden until the engine is running. The launcher is a bounded responsive sheet: two columns in shallow landscape, one column when narrow, with an internal overflow fallback only when the visible viewport is unusually constrained.

Safari on iPhone still does not reliably offer arbitrary interactive-page fullscreen. The browser build sizes the entire game shell from window.visualViewport; the cleaner chrome-free path remains Share -> Add to Home Screen and launching the installed web app.

## Loadout / biomechanics

The game intentionally maps cheats to physical body responsibilities rather than abstract skill slots.

Cyberpunk 2077 is useful precedent because its cyberware is separated into functional body systems and constrained by capacity: vision in face/ocular systems, arm weapons in arms, ranged handling in hands, detection/time behavior in nervous-system hardware, mobility in legs, etc.

Sources:
- https://www.cyberpunk.net/en/news/49129/whats-coming-in-2-0-cyberware
- https://www.cyberpunk.net/en/news/49060/update-2-0
- https://cyberpunk.fandom.com/wiki/Cyberpunk_2077_Cyberware

CHEAT OR DIE keeps its simpler ten physical sockets but applies the same logic:
- sensors -> information / ESP
- head -> targeting / resolving
- arms -> trigger/recoil/weapon duplication
- torso -> stabilization / large weapon packages
- legs -> movement automation
- core / utility -> timing, anti-aim, overclock and system-level exploits

The editor has one loadout. A MutationDefinition declares complete mount footprints. Strength, footprint, and compatibility are distinct balancing axes.

## Implemented cheat families

### Information

TAG-ESP: one sensor. Permanent through-cover identity, distance, shield and health tag. No silhouette.

XRAY / Panoptic Array: both sensors. Permanent full-body emissive silhouette through level geometry plus telemetry.

The categorical difference matters more than a +20%/+40% scale.

### Movement

BHOP / Momentum Macro: one leg or core. Automatically queues landing jumps, preserves significantly more momentum, and increases air control. Its status icon pulses while the movement automation is actually doing work.

Speed actuator remains a separate raw-speed choice so movement builds need not always combine automation and top speed.

### Weapon handling

Counter-Recoil and Trigger Servo remain single-arm modules.

AKIMBO / Akimbo Harness occupies both arms + torso and produces two separately-originated carbine rays per trigger cycle. It is intentionally a large biomechanical commitment rather than a passive x2 stat.

### Aim

MAG-OPTIC remains low-strength manual-friendly magnetism.

AIMBOT / Rage Aimbot Suite occupies head + both sensors + both arms. It provides strong visible-target correction, trigger automation and recoil handling, but monopolizes most targeting/weapon sockets.

RESOLVER occupies head + one sensor. It does not help manual aim; it specifically reduces anti-aim error seen by automated targeting.

### Anti-aim / Spinbot

SPIN-L / Yaw Scrambler occupies one core or utility socket and slowly decouples visible body yaw from real player aim.

SPIN-X / Rage Spinbot Rig occupies core + utility, spins/jitters the rendered body much faster, and injects a larger positional error into automated enemy target interpretation.

The player camera and true firing yaw remain stable. The visible robot body has an independent visual yaw. This deliberately creates a cheat-vs-cheat relationship:

anti-aim -> corrupt automated aim state -> resolver reduces that corruption -> manual aim remains a skill-based escape hatch.

The sandbox target can be given SPIN-X from the chassis lab so this interaction is testable without active combat AI.

## HvH research -> game mechanics

Counter-Strike HvH is useful because it is a long-running environment where both sides expect blatant cheats. The useful design lesson is not any specific implementation technique; it is the counter-system vocabulary that emerges once cheats are assumed.

References:
- https://cs2hvhservers.com/community/cs2-anti-aim-explained
- https://cs2hvhservers.com/community/cs2-resolvers-lag-compensation
- https://github.com/csgohacks/master-guide/blob/master/introduction/cheat-features.md
- https://github.com/csgohacks/master-guide/blob/master/cheat-configuration/onetap/hvh.md

Promising translations:
- anti-aim / spin -> visible-state deception
- resolver -> inference/counter-deception
- safepoint -> low-risk target policy that sacrifices ideal hit location for certainty
- body-aim -> damage/hit-probability policy
- backtrack -> fire at a recent temporal ghost/state buffer
- fake lag -> deliberately stale movement snapshots / interpolation ghosts
- autopeek -> save cover position, expose/fire, then automate return
- autowall -> penetration-aware target/weapon policy once material penetration exists
- double-tap -> burst/tick manipulation, but dangerous because it can erase counterplay

A current HvH community explanation notes that some servers explicitly ban double-tap because two near-simultaneous full-damage shots can overwhelm the anti-aim/resolver interaction. That is a useful design warning: cheats should usually create a new decision or counter, not simply delete reaction time.

## Information warfare / false telemetry

Activision anti-cheat research describes hidden hallucination entities intended to bait wallhack/aim automation. This is unusually valuable inspiration for an actual game built around cheats.

Source:
- https://www.activision.com/cdn/research/hallucinations

Future legitimate defensive hardware can therefore emit:
- fake ESP tags
- decoy silhouettes
- false movement ghosts
- sensor-only entities
- duplicate shield/health readouts
- resolver-poisoning pose signals

That turns wallhacks from a solved information advantage into one side of an information-war build.

## Meta rule

A simple/common part should remain potentially useful late when a build engine is constructed around it. Rarity should primarily change constraints, breadth, risk, efficiency, conditions, or footprints rather than automatically obsolete simpler pieces.

Avoid a mandatory Aimbot + XRAY meta by making information, target inference, firing policy, weapon output, movement and defensive deception compete for physical sockets.

## Dustlab instead of Dust II

Counter-Strike / Dust II remain level-design references, but geometry/assets are not copied. Dustlab borrows abstract FPS grammar: long lane, contested mid sightline, short/elevated route, tunnel-like occluded path, courtyards, cover and predictable peek geometry.

Valve content is not the asset foundation for the project.

Reference:
- https://store.steampowered.com/subscriber_agreement/

## CC0 art pipeline

A useful later source is https://github.com/petroulacl/fps-buildings-env-kit, which curates GLB Kenney building kits plus other openly licensed assets. Do not import whole libraries; select assets individually and preserve provenance.

## Damage layers

Every robot starts with 100 shield + 100 health.

Shield is an ablative hit layer rather than ordinary extra HP: when shield is above zero, the complete incoming hit resolves against shield and never overflows into health. If 1 shield remains and a 1000-damage hit lands, the result is 1 shield damage, shield broken, 100 health unchanged. Only the next hit can affect health.

Damage numbers report actual damage consumed by the layer: blue for shield and red for health.

## Sandbox before roguelite

Development loop: boot -> move/aim/shoot -> open chassis -> install/eject hardware -> configure target anti-aim -> test cheat/counter-cheat interactions.

Roguelite progression returns after this surface is intrinsically fun and individual cheat families have enough mechanical identity to combine meaningfully.
