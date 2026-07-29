# Squirrel Club

A gentle browser platformer for children aged 4+, in the spirit of *Hey Duggee*:
a friendly club of soft-toy animals go on little adventures and earn a badge for
each one. Built with **vanilla JavaScript and HTML5 canvas** — no frameworks, no
build step, no external asset files. Everything on screen is drawn from canvas
primitives (circles, rounded rects, arcs) in a flat, thick-outlined, felt-toy
style.

**Current version: v0.3.0** (2026-07-29)

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

There is a dev-only **End** shortcut that skips near the exit hut (to be removed
before release).

---

## Progress summary

The engine and "game feel" foundation are in place, plus a two-character roster
and the front-and-back menus. The level itself is still a mostly-empty runway —
collectibles and set-pieces are the next major piece.

**Done**
- Fixed-timestep (60 Hz) game loop, letterboxed 960×540 canvas, auto-pause on
  focus loss.
- Forgiving movement physics: acceleration/friction, variable jump height,
  coyote time, jump buffering, snappy low-inertia air turns.
- **Double jump** capped at ~130% of a normal jump's height.
- AABB tile collision with a free-standing grass **floor band** (only its top
  ~40% shows on screen).
- **Side-scrolling camera** with a wide dead-zone that also **pans up** so the
  player is never lost off the top on high jumps.
- A ~15,600 px level (≈60 s at full run speed) ending in a **brown hut** with a
  **rainbow door that opens** as you approach; walking in shows a completion
  screen.
- **Character select** with a live animated preview: **Yellow Ted Ted** (a lion)
  and **Blue Ted Ted** (a rabbit).
- Fully **procedural characters** with physics-driven animation — squash/stretch,
  leg swing, idle bob; Blue Ted Ted's long ears have two-axis floppy **spring
  physics** (droop down on jumps, trail on sideways motion).
- **Escape pause menu** (Resume / Start over), instant and dimmed.

**Design rules honoured** (from the spec)
- No failure, no lives, no score, no timer — falling gently respawns you.
- No reading required to play; two controls only.
- Generous, forgiving physics; no way to get stuck in a menu.

**Not yet built**
- Collectibles and level set-pieces (the runway is still flat/empty).
- Blue Ted Ted's unique ability (currently plays identically to Yellow).
- Data-driven level loading; the real three levels.
- Hub world, badge wall, save system (localStorage).
- Audio, particle effects, the badge celebration.
- Wiring in the pixel-art tile scenery (hybrid art direction).

---

## Version history

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
- Tag `v0.3.0` — this version.

---

## Project layout

```
index.html            page + script load order
style.css             full-window letterboxed canvas
/js
  main.js             bootstrap, game loop, screens (select/instructions/play/pause/complete)
  input.js            keyboard state, coyote & jump-buffer timers
  physics.js          tuning constants + AABB-vs-tilemap collision solver
  level.js            tile grid, grass floor band, exit hut, rendering
  camera.js           follow camera (horizontal dead-zone + vertical pan)
  characters.js       the roster + procedural draw functions (Yellow/Blue Ted Ted)
  player.js           movement, double jump, animation & ear-physics state
/data                 (reserved for data-driven levels)
/Tiles                pixel-art tile pack (Anokolisa) — not yet wired in
```

## Credits

- Game design & code: Dominic Whittaker, with Claude Code.
- Pixel-art tile pack in `/Tiles` by **Anokolisa** (free for commercial use;
  not yet used in the build). All in-game art is currently original and
  procedurally drawn.
