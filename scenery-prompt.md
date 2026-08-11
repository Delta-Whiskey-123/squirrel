# Ted Ted — Parallax Scenery Build Prompt

> **How to use:** open Claude Code in this repo and paste the block below. Ask it to
> plan first, then implement in one module and show a screenshot before polishing.

---

## Paste this to Claude Code

Add a layered, parallax-scrolling **background scenery** system to the game. It must be
**pure procedural canvas drawing — no image files, no external assets** (the game runs
from `file://`, so keep it that way). Draw everything with canvas primitives, in the
game's existing flat, thick-outlined, high-saturation, no-gradient "felt cutout" style.

### The look I'm after
A flat cartoon backdrop in the spirit of a *Hey Duggee* frame — bright, friendly, chunky
shapes — but composed with the **layered-distance depth** of a real rolling-farmland
landscape: sky → far mountains → mid hills → near hills, each receding into haze.

Reference feel (bright spring-green palette):
- **Sky:** keep the existing pale daytime blue fill (`#96c8f2`) as the base — scenery
  layers draw on top of it.
- **Fluffy white clouds** high in the sky, soft rounded lobes, drifting slowly.
- **Far mountain range:** pastel mauve/purple peaks (`#b8a0d0`) with an alternate
  dusty-pink massif (`#d0aebd`), warm-white snow caps (`#fbf7f0`), and faint darker
  speckle dots scattered on the slopes (like the reference).
- **Mid rolling hills:** soft muted greens (`#9cc78a`), hazier and lower-contrast.
- **Near hills / foreground band:** richer green that reads just behind the playfield and
  transitions toward the gameplay grass (`#5bbf4a`); optional little pine trees / round
  bushes (`#3f9e57` / `#2f8f4a`) with brown trunks (`#8a5a2b`).
- **Outline:** the game's `#2f2233`. Use it thick on the nearest scenery, thinner and
  lighter on mid layers, and **omit it on the farthest mountains** — that's the trick
  that sells depth in a flat style.

### Atmospheric perspective — the one rule that makes it work
Each layer that is **farther away** must be: **lighter** (higher value, shifted toward the
sky blue), **less saturated**, **lower-contrast**, **less detailed**, and **more thinly /
un-outlined**. Nearest layer is the boldest and greenest; farthest is the palest and
bluest. That gradient is what turns flat shapes into a landscape with distance.

### Composition — four depth layers (back to front)
1. **Clouds** — a few soft white cloud clusters up high.
2. **Far mountains** — a jagged pastel-purple/pink range with snow caps, sitting on the
   horizon, no hard outline.
3. **Mid hills** — smooth overlapping green humps, softly outlined.
4. **Near scenery** — taller green hills and a few trees/bushes, boldly outlined, tucked
   just behind the terrain so it meets the existing world naturally.

### How it must move — parallax (this is the important part)
The camera only **translates**; read `camera.x` (horizontal scroll, 0…`level.pixelW-960`)
and `camera.y` (0 at ground, negative when the player jumps high). Each layer scrolls at a
fraction of the camera so distance reads correctly:

| Layer          | horizontal factor | notes |
|----------------|-------------------|-------|
| Clouds         | ~0.06             | plus a slow constant drift over time |
| Far mountains  | ~0.15             | |
| Mid hills      | ~0.35             | |
| Near scenery   | ~0.60             | |
| World/terrain  | 1.00              | already drawn by `level.draw` |

For each layer compute `screenX offset = -(camera.x * factor)`. Anchor each layer to a
**horizon line** near `screenY = floorTopY` (`521`) and apply vertical parallax as
`screenY = horizon - camera.y * factor` using the same per-layer factor, so during normal
ground play (camY = 0) the scenery sits still, and during a high jump the distant layers
barely drift while nearer ones move more. Distant layers must never appear to "fall" with
the world.

### Seamless horizontal tiling
The level is `7878px` wide but layers scroll slowly, so they must **repeat without a
visible seam**. Generate each layer's silhouette as a **horizontally periodic unit** of a
fixed width `UNIT` (e.g. 960) whose left-edge height equals its right-edge height, then
tile it: `startX = offset % UNIT` and draw copies from `startX - UNIT` across the viewport
in `UNIT` steps. No hard edges, no gaps.

### Determinism & performance
- Generate all silhouettes, peak positions, cloud positions, speckles, and tree positions
  **once at construction** using a small seeded PRNG (e.g. mulberry32) — **never
  `Math.random()` per frame**, or the scenery will shimmer.
- Store each layer as precomputed point arrays; drawing per frame is just path-filling
  with the parallax offset. Must hold a steady 60fps.
- Respect `prefers-reduced-motion`: if set, freeze cloud drift (parallax on camera motion
  is fine to keep).

### Where it plugs in
- Create a new module **`js/scenery.js`** exposing something like
  `Scenery.init(seed)` and `Scenery.drawBack(ctx, camX, camY, viewW, viewH)`, mirroring
  the style of `particles.js` / `camera.js`.
- Register it in `index.html` **before `js/main.js`** (put the `<script>` after
  `js/particles.js`, line ~20).
- Call it in `render()` in `js/main.js` **right after the sky fill** (`ctx.fillRect(0,0,
  VIEW_W, VIEW_H)` at ~line 326) and **before `Particles.drawBack(ctx)`**, so scenery sits
  behind the ambient pollen and the world:
  ```js
  ctx.fillStyle = '#96c8f2';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  Scenery.drawBack(ctx, camera.x, camera.y, VIEW_W, VIEW_H);   // <-- new
  Particles.drawBack(ctx);
  level.draw(ctx, camera.x, camera.y, VIEW_W, VIEW_H);
  ```
- Do **not** touch collision, physics, or `level.solids` — this is purely visual, behind
  the world.

### Keep the level-select thumbnails consistent
The level-select previews are drawn procedurally in `js/levels.js` (flat sky + simple
mountains). Once the gameplay backdrop exists, update those preview drawers so the
thumbnail scenery visually matches the real in-game backdrop (same palette and silhouette
feel) — a mismatched thumbnail is a bug.

### Acceptance
- Opening `index.html` shows a layered spring-green landscape behind the playfield that
  scrolls with depth as you move, with no seams and no per-frame shimmer.
- No image files added; no console errors; steady 60fps.
- Distant mountains read as pale/hazy/un-outlined; near hills read as bold and green.
- Collision and gameplay are unchanged.

Plan the module and layer factors first and show me that plan. Then build `scenery.js`,
wire it into `main.js` + `index.html`, and show a screenshot of the result before any
polish pass.
