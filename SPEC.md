# Squirrel Club — Build Spec & Claude Code Prompt

> **How to use this:** save this file as `SPEC.md` in an empty folder, open Claude Code there, and paste:
> *"Read SPEC.md. Use plan mode first — show me your architecture and level plan before writing any code. Then build Milestone 1 only and stop so I can play it."*

---

## The brief

Build a browser platformer for children aged 4 and up, in the spirit of *Hey Duggee*: a big friendly dog runs a club, and the little animals earn a **badge** each time they finish an adventure. Each level is one badge. The badge wall is the level select, and it fills up as the player plays.

**Vanilla JavaScript and HTML5 canvas only. No frameworks, no libraries, no build step, no npm install, no external assets of any kind.** The whole game must run by opening `index.html` (or serving the folder with `python3 -m http.server`).

Do not use any real *Hey Duggee* artwork, audio, character names, or logos. Draw everything with canvas primitives — circles, rounded rectangles, arcs — in an original style. Invent our own character names. The visual language should be flat, thick-outlined, high-saturation, no gradients, no textures: think felt shapes cut out and laid on paper.

---

## Non-negotiable design rules for a 4-year-old

These matter more than any feature. Violating one is a bug.

1. **There is no failure.** No lives, no health, no game over, no timer, no score. Falling off a platform plays a soft "boing" and puts the player back on the last solid ground they stood on, half a second later. Nothing is ever lost.
2. **No enemies that hurt.** Obstacles are inconveniences — a sleepy hedgehog you bounce off, a puddle that slows you down — never threats.
3. **Two controls, total.** Arrow keys (or A/D) to move left and right. Spacebar to jump. That is the entire input surface. Every character ability must map onto those same two inputs.
4. **Nothing is missable.** All collectibles remain until picked up. Re-entering a level restores what wasn't collected. The exit never closes.
5. **No reading required.** A four-year-old may not read. Every instruction is a picture, an arrow painted on the ground, or a sound. Text on screen is for the adult, not the child.
6. **Generous physics.** Coyote time, jump buffering, forgiving hitboxes (see numbers below). If a jump *looks* like it should have worked, it works.
7. **Every interaction rewards.** Touching a collectible makes a sound and a particle pop. Landing a jump makes a sound. The game should feel good even if the player just runs back and forth.
8. **Pause is instant.** Escape pauses and dims. No menus a child can get stuck in — one big picture button to resume.

---

## Structure

```
index.html
style.css
/js
  main.js          — bootstrap, canvas setup, the game loop
  input.js         — keyboard state, coyote/buffer timers
  states.js        — state machine: splash → select → hub → level → badge → hub
  camera.js        — follows player, clamps to level bounds, gentle lerp
  physics.js       — AABB collision, gravity, resolution
  player.js        — movement, the five characters' abilities
  level.js         — level loading from tilemap arrays, tile rendering
  entities.js      — collectibles, moving platforms, springs, doors, critters
  hub.js           — the clubhouse hub world
  render.js        — all character/prop drawing functions (canvas primitives)
  audio.js         — WebAudio-synthesised sound, no audio files
  save.js          — localStorage progress
/data
  levels.js        — the three level definitions as arrays
```

Canvas is **960 × 540**, letterboxed and scaled to fit the window while preserving aspect ratio. Tile size **48px**. Use `requestAnimationFrame` with a fixed timestep accumulator (60 Hz physics) so the game plays identically on any monitor refresh rate.

---

## Game flow

**Splash** → one screen, the club logo, "press space". Fades in.

**Character select** → the five club members stand in a row. Left/right moves a highlight, space confirms. Each shows a simple icon of their ability. The chosen character persists until changed; the player can change it from the hub any time.

**Hub — the Clubhouse Garden** → a small, safe, single-screen area the player can run around freely. Nothing to fail at. It contains:
- Three doorways, one per level, each painted with that level's badge symbol. Walk into a doorway to enter.
- The **badge wall**: a large board showing three badge slots. Earned badges appear coloured and gently rotating; unearned ones are faint grey outlines.
- A character-select signpost to swap character.
- The big dog wandering slowly around, who plays a happy sound when you bump into him.

**Level** → play. Reaching the exit triggers the badge award.

**Badge award** → the screen fills with confetti particles, the new badge stamps down with a satisfying thump, all club members run in and pile into a hug. Space returns to the hub. Should last about six seconds and be worth watching every single time.

---

## The five club members

All abilities use only arrow keys and space.

| Name | Ability | Input |
|---|---|---|
| **Pip** (squirrel) | Double jump | Press space a second time in mid-air |
| **Mo** (rhino) | Roll — faster run, low profile, fits through knee-high gaps | Hold a direction for 1s and he rolls automatically |
| **Wren** (bird) | Glide — falls slowly with a flutter | Hold space while falling |
| **Bo** (hippo) | Floats on water instead of sinking; walks on the bottom otherwise | Automatic in water |
| **Tilly** (octopus) | Sticky — clings to a wall for 2 seconds, can jump off it | Automatic on wall contact |

Every level must be completable by **every character**. Abilities open shortcuts and optional collectible routes — they are never required. A four-year-old should not be blocked because they picked the wrong animal.

---

## Physics constants (start here, tune later)

```js
GRAVITY            = 2000   // px/s²
MOVE_SPEED         = 260    // px/s
ROLL_SPEED         = 380    // px/s
JUMP_VELOCITY      = -700   // px/s  (~122px apex, ~2.5 tiles)
DOUBLE_JUMP_VEL    = -600
GLIDE_MAX_FALL     = 120    // px/s while gliding
MAX_FALL           = 900
ACCEL              = 2400   // ground
AIR_ACCEL          = 1400
FRICTION           = 2000
COYOTE_TIME        = 0.12   // s after leaving ground you can still jump
JUMP_BUFFER        = 0.15   // s before landing a jump press still counts
VARIABLE_JUMP      = true   // releasing space early cuts upward velocity by half
```

Player hitbox is 36 × 44, deliberately narrower than the sprite so the player never clips a corner they thought they'd cleared. Collectible pickup radius is 40px — generous.

---

## The three levels

**1. The Stick Badge — Woodland Path.** Flat, wide, forgiving. Teaches move, jump, collect. Gaps no wider than one comfortable jump. Ten sticks scattered along the ground and on low platforms. Ends at a woodpile.

**2. The Splash Badge — Rainy Garden.** Introduces water (slow movement, floaty jumps, Bo walks the bottom), lily-pad platforms that bob, and slow horizontal moving platforms. Ten raindrops to collect. Ends at a rainbow.

**3. The Tall Badge — The Big Tree.** A gentle vertical climb. Wide branch platforms, mushroom springs that bounce you upward, and a canopy finish. Vertical camera work matters here — keep the platform above always visible. Ten leaves. Ends at a nest at the top.

Each level should take a competent adult about 90 seconds and a four-year-old about five minutes. Store levels as arrays of character rows (`'#'` solid, `'.'` empty, `'o'` collectible, `'~'` water, `'-'` moving platform, `'^'` spring, `'E'` exit, `'P'` spawn) with a small legend, so new levels are trivial to author.

---

## Audio

Synthesise everything with the WebAudio API — oscillators and a short noise buffer. No audio files, no downloads. Needed sounds: jump (rising blip), land (soft thud), collect (ascending pentatonic note that climbs with each consecutive pickup), splash, spring boing, badge fanfare, hug chime. Keep a master gain node and a mute toggle (M key) that persists in localStorage. Initialise the AudioContext on first key press to satisfy browser autoplay policy.

---

## Save & polish

- `localStorage` stores: badges earned, collectibles per level, chosen character, mute state. One key, JSON-encoded, versioned. Wrap all access in try/catch — never let a storage failure break the game.
- Particles: dust on landing, sparkles on collect, confetti on badge. A simple pooled particle system, no more than 200 live at once.
- Character animation: no sprite sheets. Animate procedurally — squash on landing, stretch on jump, a two-frame leg swing, a bob on idle. This is where the game gets its charm, so spend real effort here.
- Camera: lerp toward the player with a dead zone in the middle of the screen; clamp hard to level bounds so the player never sees past the edge.
- Respect `prefers-reduced-motion` by cutting screen shake and reducing particles.
- Full keyboard focus handling; pause automatically if the window loses focus.

---

## Ready for app conversion (build for it, don't do it)

Keep all game logic free of DOM assumptions beyond the single canvas, keep every path relative, and make sure the game works from `file://`. That way it can later be wrapped with Electron (desktop) or Capacitor (mobile) with no code changes. Leave a stub `input.js` touch handler behind a flag, unused for now.

---

## Build order — stop after each milestone

1. **Milestone 1:** canvas, game loop, input, a rectangle player with full movement physics and collision against one hardcoded test level. Playable and *feeling good* before anything else exists.
2. **Milestone 2:** level loading from data, camera, collectibles, exit, level-complete trigger.
3. **Milestone 3:** the three real levels, moving platforms, water, springs.
4. **Milestone 4:** state machine, splash, character select, hub world, badge wall, save system.
5. **Milestone 5:** the five abilities.
6. **Milestone 6:** procedural character art and animation replacing rectangles.
7. **Milestone 7:** audio, particles, the badge celebration, polish pass.

After each milestone, tell me what to test and wait. Do not run ahead.

---

## Acceptance criteria

- Runs by opening `index.html`. No install, no build, no network request.
- No console errors or warnings.
- Every level completable by all five characters.
- Nothing on screen requires reading to progress.
- No way to reach a state a child cannot escape with the two available controls.
- Steady 60fps on a modest laptop.
- Total: plain JS, readable, commented where the physics gets subtle.
