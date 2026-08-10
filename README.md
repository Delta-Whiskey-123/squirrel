# Squirrel Club

A gentle browser platformer for children aged 4+, in the spirit of *Hey Duggee*:
a friendly club of soft-toy animals go on little adventures and earn a badge for
each one. Built with **vanilla JavaScript and HTML5 canvas** — no frameworks, no
build step, no external asset files. Everything on screen is drawn from canvas
primitives (circles, rounded rects, arcs) in a flat, thick-outlined, felt-toy
style.

**Current version: v0.7.0** (2026-08-04)

---

## How to run

The game currently uses no external assets, so it runs straight from the file
system:

- **Double-click `index.html`**, or
- Serve the folder over HTTP and open it (any static server).

> Note: once the planned tile/background art is wired in (hybrid art direction),
> the game will need to be **served over HTTP** because browsers block image
> loading from `file://`. Until then, opening the file directly works.

## Controls

Two controls, plus menu keys — the whole input surface for a 4-year-old is:

| Action | Keys |
|---|---|
| Move | ← / → (or A / D) |
| Sprint (Yellow Ted Ted) | Double-tap-and-hold ← or → to run (1.8× speed) |
| Jump / double jump | Space (press again in mid-air for the second jump) |
| Choose / confirm (menus) | Space or Enter |
| Back (menus) | Backspace |
| Pause menu / Back to select | Escape |

There is a dev-only shortcut: during play, **type `fast`** to warp to 10 tiles
short of the exit hut, so the end-of-game badge sequence can be reached without
a full run. (To be removed before release.)

---

## Progress summary

The engine, game feel, and core level are complete with five playable characters,
audio, a three-tier collectable gem system, and a full badge celebration on
finishing the level. The core gameplay loop is closed end-to-end: pick a
character, run the level, collect gems, exit via the hut, and earn the badge.
Distinct character abilities and more levels are next.

**Done**
- Fixed-timestep (60 Hz) game loop, letterboxed 960×540 canvas, auto-pause on
  focus loss.
- Forgiving movement physics: acceleration/friction, variable jump height,
  coyote time, jump buffering, snappy low-inertia air turns.
- **Double jump** capped at ~130% of a normal jump's height.
- AABB collision with a free-standing grass **floor band** and arbitrary platforms/terrain.
- **Side-scrolling camera** with a wide dead-zone that also **pans up** so the
  player is never lost off the top on high jumps.
- A ~15,600 px level (≈60 s at full run speed) with terrain, platforms, and springs;
  ending in a **brown hut** with two windows and an **opening rainbow door**. Walking
  in ends the level and returns to character select.
- **Character select** with live animated preview: **Yellow Ted Ted** (lion),
  **Blue Ted Ted** (rabbit with floppy ears), and **Grey Ted Ted** (rabbit with
  more aggressive ear flop on jump).
- Fully **procedural characters** with physics-driven animation — squash/stretch,
  leg swing, idle bob. Eared characters have two-axis floppy **spring physics**.
- **Escape pause menu** (Resume / Start over), instant and dimmed.
- **Three-tier collectible gems** (Gold/Silver/Bronze) scattered throughout the level,
  with a **per-tier HUD counter** (top-left) that resets each run.
- **Synthesised WebAudio SFX** (no audio files): jump blip, land thud, three
  distinct per-tier collect sounds, and a 5-second triumphant "ta-daaa" fanfare.
  **M key to mute**, toggle persists to localStorage. Small muted icon shown
  when audio is off.
- **Fourth character: Battenberg**, with a triple-jump ability (third jump
  reaches 2× the height of the first, with a spring "boing" sound).
- **Fifth character: Hot Chocolate**, a limbless ceramic mug (no arms or legs) —
  a red rim band, a domed milk-chocolate top, a cream swirl with evenly-spread
  sprinkles, and a pink-and-red candy-striped straw inserted into the side of
  the cream. Cuddly-toy face; hops as one blob via squash/stretch. No special
  ability yet.
- **Badge celebration screen** (`gameComplete` state): triggered when the
  player exits through the final level's door. Dims the world, fades in gentle
  confetti, plays the fanfare, shows a spoken-aloud headline, the earned badge
  (PNG art with a procedural placeholder fallback if the file is missing), and
  the run's per-tier coin counts animating up from zero with soft ticks. Two
  buttons fade in after a beat: **Home** (returns to level select) and **Start
  Over** (blue circular restart arrow, returns to character select).
- **Level select screen**: entry point before character select. 3×2 grid showing
  six level slots: Training (Woodland Path, unlocked), Alpine (locked "Coming
  Soon"), and four placeholder slots (locked). Procedural vector preview art
  for each card. Cursor remembers last chosen level on re-entry. Grid navigation
  via arrow keys; Enter/Space to select, Backspace to go back (dead-end for now).
- **Ambient particle layer** ("pollen"): a parallaxing field of bright warm-white
  light motes drifting in the air behind the world, for depth. The sky was
  deepened to a soft blue (`#96c8f2`) so the fine motes read clearly against it.
  Fixed recycling pool (no per-frame allocation), 2–3 depth bands that separate
  as you walk, gentle non-uniform drift/sway/twinkle. Runtime `Particles` API
  (enable/disable + Low/Medium/High density) ready for a future pause-menu
  control; defaults to enabled at Medium. Per-level look is data-driven off the
  level `theme`.
- **Airborne character shadows**: the ground shadow is cast on the surface below
  the character and fades out when airborne, growing back on the descent toward a
  landing (via `Level.surfaceBelow`); applies to all five characters.
- **Menu sounds**: four friendly synthesised SFX wired across all menus — move
  (soft cursor nav blip), confirm (upward two-note lift when advancing),
  locked (low downward "nuh-uh" when trying a locked item), back (falling
  counter to confirm). All routed through existing master gain, so M-mute
  covers everything. Reused existing WebAudio synthesizer; no new dependencies.

**Design rules honoured** (from the spec)
- No failure, no lives, no score, no timer — falling gently respawns you.
- No reading required to play; two controls only.
- Generous, forgiving physics; no way to get stuck in a menu.

**Not yet built**
- **Distinct character abilities** for Blue/Grey Ted Ted and Hot Chocolate: they
  currently play identically to Yellow (Battenberg has triple-jump; planned:
  unique traits or power-ups for the rest of the roster).
- **More levels** (Alpine and the four Coming Soon slots): unlock logic and
  per-level geometry/theming once they're authored. Save system hooks already
  in place for future unlock-state persistence.
- **Save system**: persist chosen character and best gem counts/badges earned
  per level (explicitly deferred — each run starts fresh for now).
- **Particle effects on pickup** (the badge screen has confetti; sparkle pops
  on individual gem collection are still open).
- **Pixel-art tile scenery** (hybrid art direction — swapping procedural terrain for
  the tileset in `/Tiles` by Anokolisa).

---

## Version history

### v0.7.0 — Ambient particles & airborne shadows (2026-08-04)
- Added an **ambient "pollen" particle layer** (`js/particles.js`): a gentle,
  parallaxing field of bright warm-white light motes drifting in the air to give
  the flat sky depth. Drawn in world-aware screen space — each speck slides
  opposite the camera by a per-band **parallax factor**, so the bands visibly
  separate from the ground as the squirrel walks.
- **Deepened the sky** from the old pale `#bfe3ff` to a soft `#96c8f2`, so the
  bright motes have enough contrast to read against it.
- **Depth bands**: **far** (factor 0.32, r≈1.95px, α0.34), **mid** (0.55,
  3.375px, 0.52) drawn behind the world, plus an optional **near** band (0.80,
  5.25px, 0.62) drawn in front — off by default. Each speck has a slow constant
  drift (gentle down + slight lateral), an independent `sin()` sway on x, and a
  subtle alpha twinkle, all with random per-speck phase so nothing pulses in
  unison. Tuned after review to a fine, airy dusting (white, 75% size, Medium
  density).
- **Fixed recycling pool, zero per-frame allocation**: every speck is allocated
  once at load, sized to the busiest setting; specks that leave an edge wrap to
  the opposite edge with fresh randomness. Density/enable only change how many
  are *drawn*, never the pool. Soft "light" look via pre-rendered radial-gradient
  stamps (`drawImage` in the hot loop — no gradients or allocation per frame).
- **Runtime `Particles` API** (mirrors how `Sfx` owns its mute state), ready for
  a future pause-menu control with no reload: `setEnabled`/`isEnabled`,
  `setDensity`/`getDensity` over discrete **Low / Medium / High** steps
  (0.4 / 0.7 / 1.0 of pool), `setNearEnabled`/`isNearEnabled`, and `setTheme`.
  Ships **enabled at Medium** (~42 specks on screen; ~24 Low, ~60 High). A
  clearly-marked **persist seam** is left for saving the choice later.
- **Per-level look is data-driven** off the level `theme` (base palette + base
  density), kept separate from the user's runtime settings: the player's
  enable/density choice composes over the theme's authored base. Only `training`
  renders today; its entry is tuned as the default. Wired into `render()` between
  the sky fill and `level.draw()` (near band after the player). No changes to
  camera, physics, or input.
- **Airborne character shadows**: the ground shadow is now cast on the surface
  *below* the character (platform, terrain, or floor) rather than glued to the
  feet, and fades + shrinks with height — full at contact, gone once the feet are
  ~60px up (`FADE_H`). So it disappears when airborne and grows back as the
  character descends toward a landing. Added `Level.surfaceBelow(x, w, feetY)`
  (a downward surface probe mirroring the fall-collision logic); the four
  character draws gate their built-in feet shadow behind a `noShadow` option and
  the player casts its own. The character-select menu still shows its normal
  shadow. Applies to all five characters; no physics/movement changes.
- **Fifth character: Hot Chocolate** (`js/characters.js`, roster id `hotchoc`):
  a limbless ceramic mug drawn from canvas primitives — a big looped handle on
  the right, a red rim band, a raised **milk-chocolate dome** above the rim with
  a soft gloss, a tall soft-serve cream swirl dotted with ~10 evenly-spread
  sprinkles, and a balanced pink/red candy-striped straw inserted into the left
  side of the cream. Cuddly-toy face (black shine eyes, smile, pink blush).
  Having no arms or legs, it hops as one blob via squash/stretch rather than
  swinging limbs (ignores the leg/ear draw params). **No special ability yet** —
  deferred by design.

### v0.6.5 — Yellow Ted Ted's sprint (2026-07-31)
- Gave **Yellow Ted Ted** a character-exclusive **sprint** ability: **double-tap
  and hold** a direction (← / → or A / D) to run at **1.8× base speed** (260 →
  468 px/s). The first tap is a quick press-release; the held second press
  engages the boost. The player accelerates up to the sprint speed and, when the
  boost ends while still walking, eases back down over ~0.2s rather than
  snapping.
- **Grounded-only initiation**: a double-tap completed mid-air is void — you must
  be on the ground when it engages. **Momentum is preserved through jumps**: a
  running jump keeps its full sprint velocity for the whole arc, and the sprint
  stays latched through a jump-and-landing while the key is held. A normal
  (non-sprint) jump never gains speed.
- Added a short **"fwip" sprint cue** (`Sfx.sprint`) — a quick upward blip plus a
  soft airy whoosh, routed through the existing master gain (M-mute covers it).
  No new dependencies or audio files.
- Implementation: a per-direction double-tap state machine in **js/input.js**
  (`Input.sprintHeld()`, `setDoubleTapWindow()`), a rising-edge sprint latch and
  dynamic speed cap in **js/player.js**, and a per-character `run` config on
  Yellow in **js/characters.js**. Other characters are unaffected.

### v0.6.0 — Level select & menu sounds (2026-07-30)
- Built the **level select screen** as the new entry point before character
  select. A **3×2 grid** displays six level slots: Training (Woodland Path,
  unlocked), Alpine (locked "Coming Soon"), and four placeholder slots (locked
  "Coming Soon"). Each card shows procedural vector preview art, level number,
  name, and lock state. Cursor remembers the last-chosen level on re-entry, and
  all six slots are navigable via arrow keys (UP/DOWN/LEFT/RIGHT). Confirm via
  Space/Enter to select an unlocked level; attempting a locked level wobbles the
  card and plays a deny sound. Backspace navigates back (dead-end for now; will
  connect to a hub world in a future milestone). Character select and badge
  screen now return to level select instead of character select. Level id is
  threaded through to gameplay and stored for future per-level save data.
- Added **four menu sounds**: move (soft triangle blip, plays on cursor nav),
  confirm (upward two-note lift when advancing), locked (low downward "nuh-uh"
  when trying a locked item), and back (falling counterpoint to confirm). All
  wired across all menus (level select, character select, pause menu, badge
  screen buttons, and instructions→play transition). All sounds route through
  the existing master gain, so the M-mute toggle covers everything. Reused the
  existing WebAudio synthesizer — no new dependencies or audio files.
- Added **js/levels.js** — a new levels roster file mirroring the characters.js
  pattern, containing the LEVELS config array and four procedural preview-draw
  functions. Includes a clearly-marked SAVE HOOK where unlock state will later
  be driven by a save file.
- Updated **badge screen buttons**: the home button now returns to level select
  (was character select); added a second **Start Over** button (blue circular
  restart arrow, reused from the pause menu) that returns to character select.
  Both buttons are highlight-able via LEFT/RIGHT, with focused buttons pulsing
  green and unfocused tan.

### v0.5.0 — Badge celebration, fanfare & fourth character (2026-07-30)
- Added **Battenberg**, a fourth playable character with a **triple-jump**
  ability (third jump reaches 2× the first jump's height, with a spring
  "boing" sound effect).
- Built the **badge celebration screen** as a distinct `gameComplete` state,
  triggered when the player exits through the final level's door: dimmed
  background, falling confetti, a spoken-aloud headline, the earned badge PNG
  (`Tiles/Assets/badge.png`, procedural rosette fallback if missing), and
  per-tier coin counts animating up from zero with soft ticks. A wordless home
  button fades in after a beat and returns to character select. No save/progress
  system — every run starts fresh.
- Added a **synthesised fanfare** (`Sfx.fanfare`) and **count-up tick**
  (`Sfx.tick`) to the audio module: a triumphant ~5-second "ta-daaa" — bright
  pickup note into a wide, held C-major chord across four octaves with a
  sparkle tail.

### v0.4.0 — Collectibles, audio & third character (2026-07-30)
- Added **Grey Ted Ted**, a third character with longer, more aggressive ear flop
  physics (ears swing nearly 160° down on jump).
- Built **synthesised WebAudio SFX module** (js/audio.js): jump blip, land thud,
  and three distinct per-tier collect sounds (Gold shimmer longer, Silver ping,
  Bronze woody blip). M-key mute toggle persists to localStorage.
- Placed **three-tier collectible gems** (8 gold, 8 silver, 8 bronze) across the
  level by difficulty; adds a **per-tier HUD counter** (top-left).
- Moved the **exit hut 3 tiles earlier** and **flattened the final stretch** so
  the player approaches it on flat ground.
- Exit now properly ends the level and returns to character select (award screen
  deferred for next milestone).

### v0.3.0 — Characters & menus (2026-07-29)
- Replaced the placeholder box with **Yellow Ted Ted**, a procedural lion
  (ruffled mane, stitched nose) with physics-driven animation.
- Added a **character select** screen (row + big animated preview); flow is now
  select → controls → play.
- Built **Blue Ted Ted**, a dusty-blue rabbit with long floppy-tipped ears, a
  Y-shaped mouth, and unlocked its slot.
- Gave the rabbit's ears **spring physics**: they droop down on jumps and trail
  behind sideways motion.
- Added the **Escape pause menu** (Resume / Start over → character select).

### v0.2.0 — Scrolling level & exit (2026-07-28 → 07-29)
- Added a horizontal **follow camera** (wide dead-zone, clamped to bounds) and
  later **vertical pan-up** so high jumps stay on screen.
- Extended the level into a long runway (tuned to a **60 s** full-speed run).
- Added the **brown hut exit** with two windows and an **opening rainbow door**,
  a walk-in completion trigger, and a "You made it!" finish screen.
- Made the hut 30% bigger after review.

### v0.1.0 — Foundation & feel (2026-07-28)
- **Milestone 1**: game loop, keyboard input, AABB physics/collision, a
  hardcoded test level, and a rectangle player that feels good to move.
- Added the **instructions/controls card** (press Enter to start).
- Tuned the jump higher and rebuilt the test level so every platform is
  reachable.
- Converted the ground into a thin grass **floor band**.
- Added the **double jump** and **snappier air turning**.

### Backups
- Tag `28_July_evening_save` — end of the 28 July session (Milestone 1 + early
  iterations).
- Tag `v0.3.0` — character select + pause menu (2026-07-29).
- Tag `v0.4.0` — collectibles, audio, third character (2026-07-30).
- Tag `v0.5.0` — badge celebration, fanfare, fourth character (2026-07-30).
- Tag `v0.6.0` — level select screen + menu sounds (2026-07-30).
- Tag `v0.6.5` — Yellow Ted Ted's sprint ability (2026-07-31).

---

## Project layout

```
index.html            page + script load order
style.css             full-window letterboxed canvas
/js
  main.js             bootstrap, game loop, screens (select/instructions/play/pause/gameComplete)
  input.js            keyboard state, coyote & jump-buffer timers
  audio.js            synthesised WebAudio SFX (jump/land/collect/fanfare/tick) + mute toggle
  physics.js          tuning constants + AABB collision solver
  level.js            level data, platforms, gems, exit hut, rendering
  camera.js           follow camera (horizontal dead-zone + vertical pan)
  particles.js        ambient "pollen" layer (parallax bands, recycling pool) + runtime API
  characters.js       the roster + procedural draw functions (Ted Teds + Battenberg + Hot Chocolate)
  levels.js           level roster, config (id/name/theme/unlock state), procedural preview-draw functions
  player.js           movement, double/triple jump, animation & ear-physics state
/data                 (reserved for data-driven levels)
/Tiles                pixel-art tile pack (Anokolisa) — not yet wired in
/Tiles/Assets         badge.png — the earned badge art shown on the gameComplete screen
```

## Credits

- Game design & code: Dominic Whittaker, with Claude Code.
- Pixel-art tile pack in `/Tiles` by **Anokolisa** (free for commercial use;
  not yet used in the build). All in-game art is currently original and
  procedurally drawn.
