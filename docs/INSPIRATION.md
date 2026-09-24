# Design research: systems worth stealing (not content)

The goal is not to imitate these games cosmetically. Each reference below solves a structural problem that CHEAT OR DIE also has.

## Robot bodies: Cogmind is the strongest conceptual reference

Cogmind's official description is almost a direct proof that a robot's body can function as a build: power, propulsion, utilities, and weapons are attached as components, and losing parts can force the player to rebuild from enemy salvage.

Source: https://www.gridsagegames.com/cogmind/

**Takeaway for us:** body slots should not be decorative inventory squares. A leg module should affect locomotion; an optic should affect perception/targeting; an arm should affect weapon manipulation. Destroyed or replaced hardware can eventually modify what the controller is even capable of expressing.

## Readable body-part loot: The Surge

The Surge makes enemy equipment readable in the world, lets players target a specific armored body part, and ties the risk of attacking that harder part to obtaining the corresponding equipment.

Source: https://www.focus-entmt.com/en/news/target-loot-and-equip-in-limb-cutting-new-trailer

**Takeaway for us:** an enemy's visible cheat hardware can become both threat telegraphing and loot intent. If a bot has illegal optics you want, the optics should be visibly mounted on its head and the combat system can eventually reward deliberately disabling/salvaging that assembly.

## Body slots that alter actions: Cruelty Squad

Cruelty Squad's implants are split across body locations and often replace or distort normal actions rather than merely adding stats: sensors expose information, thrusters replace kicks, and other equipment changes the rules of interaction.

Reference: https://crueltysquad.fandom.com/wiki/Equipment_%26_Implants

**Takeaway for us:** the best cheat modules should replace verbs. A movement macro is more interesting when it deletes the need to time jumps; a triggerbot is more interesting when firing becomes conditional logic rather than "more damage."

## Composition: Noita

Noita's wand system is ordered and compositional. Modifiers consume or alter later spells, multicast changes grouping, and triggers/timers create nested payloads. The player's power comes from understanding execution structure, not simply collecting higher rarity numbers.

Reference: https://noita.wiki.gg/wiki/Guide%3A_Wand_Mechanics

**Takeaway for us:** long-term cheat builds should become a small control program. Example:

```text
WALL SENSOR
  -> PREDICT TARGET
  -> AIM MAGNET
  -> CONFIDENCE GATE (>0.88)
  -> TRIGGERBOT
  -> RICOCHET WEAPON
```

Ordering and compatibility should matter. Modules can transform data types between stages rather than every item modifying global stats.

## Compact weapon vocabulary: Roboquest

Roboquest affixes can alter weapon performance, projectile mechanics, elements, and alternate fire modes.

Reference: https://roboquest.wiki.gg/wiki/Affixes

**Takeaway for us:** reserve "cheat" modules for control/perception/physics rule-breaking and let guns have a smaller orthogonal affix vocabulary (pierce, ricochet, seeker, burst transform, alt-fire). This prevents every interesting effect from competing for the same ten body slots.

## Encounter pacing: Left 4 Dead's Director

Valve's Left 4 Dead AI presentation describes an adaptive pacing system that modulates population according to survivor intensity and deliberately alternates pressure with relaxation.

Source: https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf

**Takeaway for us:** difficulty should not be just bot accuracy. A Director should independently decide when to pressure the player, when to create recovery time, what mutation combinations appear, where threats arrive from, and when a run needs novelty.

## Cheat vocabulary: use the culture, not real exploits

Useful fictionalized categories:

- **Aimbot / magnetism:** acquisition cone, angular speed, target bone/region, persistence, prediction, camera coupling.
- **Trigger automation:** confidence threshold, delay, burst rules, ammo/heat policy.
- **ESP / wall sensing:** range, update rate, information richness, occlusion depth, stale-memory duration.
- **Recoil/spread compensation:** compensation fraction, adaptation delay, heat/power cost.
- **Movement scripts:** auto-bhop, air-strafe assistance, momentum retention, route macros.
- **Speed/time manipulation:** movement clock multipliers, acceleration skew, local cooldown distortion.
- **Fake latency / desync:** single-player simulation where enemies react to stale snapshots and reconciliation creates a vulnerability window.
- **Botting:** progressively moves control from manual input toward target selection, policy choice, and autonomous execution.

The game should never implement real network interference or cheats against external software. These are internal mechanics inspired by the vocabulary and UX of cheating culture.

## Visual/performance direction

ULTRAKILL exposes explicit PSX-style downscaling options all the way to extremely low internal resolutions, showing that resolution reduction can be an intentional aesthetic control rather than a hidden emergency setting.

Reference: https://ultrakill.wiki.gg/wiki/Options

For us, internal render scale is therefore part of art direction. It saves fragment work before shading happens, unlike a full-resolution "pixelate afterward" pass.

For authored assets, use glTF/GLB plus KTX2/Basis Universal. Khronos notes that JPEG/PNG textures must expand in GPU memory, while KTX2/Basis can transcode to GPU-native compressed formats, reducing memory/bandwidth costs that matter especially on mobile.

Sources:
- https://www.khronos.org/gltf/
- https://www.khronos.org/news/press/khronos-ktx-2-0-textures-enable-compact-visually-rich-gltf-3d-assets

## Rules derived from the research

1. Body hardware must correspond to a simulation/control responsibility.
2. Important enemy hardware must be visible from silhouette or emissive shape.
3. Cheating should increasingly replace normal FPS verbs rather than merely buff them.
4. Upgrade interactions should compose through explicit stages and data contracts.
5. Weapon affixes and chassis cheats remain related but separate build axes.
6. Encounter difficulty has a Director layer separate from individual bot skill.
7. Low internal resolution, low material variety, compressed textures, and modular geometry are first-class aesthetics.
8. The same RobotEntity remains valid for player input, bot AI, assistance, replay, and later network controllers.
