# Research notes / design provenance

## Engine decision

Babylon.js + TypeScript + Vite is the current foundation. Babylon gives this project a mature browser game stack rather than only a renderer: WebGPU/WebGL backends, Havok WASM integration, character-controller APIs, materials, asset tooling, instancing, cameras, and debugging facilities. Vite keeps the application source-first and simple to serve from GitHub Pages.

Three.js remains a valuable rendering reference, but its WebGPU renderer is still documented as experimental and it would leave us assembling more of the game-engine layer ourselves. PlayCanvas remains an excellent browser-first alternative, but its documented WebGPU backend is still beta. Neither advantage outweighs Babylon's fit for a source-controlled, long-lived FPS prototype at this stage.

## iOS/WebGPU principles

Safari/WebKit now ships WebGPU on iOS. The practical rule for this project is still to keep a WebGL2 escape hatch and test both paths because WebGPU/Metal backend bugs can be platform/version-specific.

The highest-leverage mobile graphics choice is not a cosmetic pixelation post-process after rendering at native DPR. It is to render fewer pixels in the first place. The game therefore controls internal render scale directly, ignores high phone devicePixelRatio by default, and adapts resolution against sustained frame time.

## Visual direction

The target is readable modern-FPS motion with PS1/PS2-era economy rather than literal retro reconstruction: low-poly modular bodies, deliberate hard edges, low material count, low-resolution/limited-detail textures, emissive diagnostic accents, strong silhouettes, and dense animation/gameplay feedback instead of expensive surface detail.

Useful contemporary references include ULTRAKILL (extremely fast first-person readability under retro rendering), Roboquest (FPS roguelite weapon/affix vocabulary), and Cruelty Squad (body-slot implants, hostile UI language, and mechanics that deliberately break normal shooter assumptions).

## System inspiration

- Noita: upgrades become interesting through composition and ordering, not merely rarity or scalar power. Its wand/spell system is a strong model for a future cheat/control graph.
- The Surge: visible equipment tied to body regions demonstrates how mechanical targeting/equipment and silhouette can reinforce each other.
- Left 4 Dead: the AI Director's pressure/release pacing is more relevant to us than copying its individual infected AI. Difficulty should manipulate encounter texture and breathing room as well as bot skill.
- TF2 Mann vs. Machine: wave/intermission upgrade cadence is a useful FPS precedent.
- Roboquest: weapon affixes demonstrate how concise properties such as ricochet, seeker, pierce, explosion, and projectile changes can create readable run identities.

## Cheat vocabulary (fictionalized)

We borrow the conceptual language of classic shooter cheating without implementing exploits against real games: aimbot/aim magnetism, trigger automation, ESP/radar, recoil compensation, movement scripts, bunny-hop/auto-strafe, speed/time manipulation, prediction, fake-latency/desync simulation, and eventually autonomous/bot control. Each should expose tunable parameters and counterplay rather than a binary on/off switch.
