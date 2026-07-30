# Squirrel Club

A gentle browser platformer for children aged 4+, in the spirit of *Hey Duggee*:
a friendly club of soft-toy animals go on little adventures and earn a badge for
each one. Built with **vanilla JavaScript and HTML5 canvas** — no frameworks, no
build step, no external asset files. Everything on screen is drawn from canvas
primitives (circles, rounded rects, arcs) in a flat, thick-outlined, felt-toy
style.

**Current version: v0.5.0** (2026-07-30)

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
| Jump / double jump | Space (press again in mid-air for the second jump) |
| Choose / confirm (menus) | Space or Enter |
| Pause menu | Escape |

There is a dev-only shortcut: during play, **type `fast`** to warp to 10 tiles
short of the exit hut, so the end-of-game badge sequence can be reached without
a full run. (To be removed before release.)

---

## Progress summary

The engine, game feel, and core level are complete with four playable characters,
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
- **Badge celebration screen** (`gameComplete` state): triggered when the
  player exits through the final level's door. Dims the world, fades in gentle
  confetti, plays the fanfare, shows a spoken-aloud headline, the earned badge
  (PNG art with a procedural placeholder fallback if the file is missing), and
  the run's per-tier coin counts animating up from zero with soft ticks. A
  wordless home button appears after a beat and returns to character select.

**Design rules honoured** (from the spec)
- No failure, no lives, no score, no timer — falling gently respawns you.
- No reading required to play; two controls only.
- Generous, forgiving physics; no way to get stuck in a menu.

**Not yet built**
- **Distinct character abilities** for Blue/Grey Ted Ted: they currently play
  identically to Yellow (Battenberg has triple-jump; planned: unique traits or
  power-ups for the rest of the roster).
- **More levels** and data-driven level loading; badge wall and hub world (the
  home button currently returns to character select, not a hub — planned).
- **Save system**: persist chosen character and best gem counts/badges earned
  per level (explicitly deferred — each run starts fresh for now).
- **Particle effects on pickup** (the badge screen has confetti; sparkle pops
  on individual gem collection are still open).
- **Pixel-art tile scenery** (hybrid art direction — swapping procedural terrain for
  the tileset in `/Tiles` by Anokolisa).

---

## Version history

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
  characters.js       the roster + procedural draw functions (Ted Teds + Battenberg)
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
