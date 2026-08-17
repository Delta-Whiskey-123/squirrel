'use strict';

/* level.js — the playable "Woodland Path" opening (grid columns X1–X101).

   The world is expressed in world pixels, not a tile grid, so platforms and
   terrain can sit at any height (including above the start screen). The level
   gives the collision solver three things:
     floorTopY   a full-width base ground band (blocks falling only)
     solids      solid rectangles: terrain hill steps + floating platforms
     leftWall/rightWall   the playable x-bounds (this test is confined to X101)
   plus springs (bounce pads that ride on top of a surface).

   Grid reference used while authoring: X 1–200 across the full level (78px per
   unit), rows A–Z up the map. This build only renders X1–101. */

const TILE = Physics.TILE; // 48

const VIEW_H = 540;
const FLOOR_TOP_Y = Math.round(VIEW_H - 0.40 * TILE); // 521 — base ground surface
const EDGE_LINE = 2.2;                                 // dark outline weight on ground edges
const X_UNIT = 78;                                    // world px per grid X-unit
const RIGHT_X = 101;                                  // Training: playable area confined to X101
const EXPERT_RIGHT_X = 151;                           // Woodland Expert: 50% longer (X151, 11778px)

// Terrain profile: [worldX, topY] step points. topY < FLOOR_TOP_Y is a raised
// hill; equal to it is flat valley (the base band shows through).
const TRAINING_PROFILE = [
  [0, 521], [900, 521], [1150, 473], [1550, 473], [1850, 521], [2500, 521],
  [2800, 473], [3100, 425], [3500, 425], [3800, 473], [4100, 521], [4700, 521],
  [5000, 473], [5300, 425], [5600, 377], [5900, 377], [6200, 425], [6500, 473],
  [6800, 521], [7488, 521], [7878, 521],
];

// Woodland Expert rolling hills across the longer world; flat by the exit.
const EXPERT_PROFILE = [
  [0, 521], [590, 521], [1180, 473], [1770, 473], [2360, 521], [2950, 425],
  [3540, 425], [4130, 473], [4720, 521], [5310, 521], [5900, 473], [6490, 377],
  [7080, 425], [7670, 521], [8260, 521], [8850, 473], [9440, 473], [10030, 521],
  [10600, 521], [11778, 521],
];

// Woodland Expert platforms + coins, straight from the approved blueprint.
//   [x, surfaceY, w, kind, coin]   kind: 'plat' | 'launch'   coin: A gold / B silver / C bronze
// Three zones ramp left->right (Warm-up X0-50, Skilled X50-100, Expert X100-151);
// heights climb toward the Expert end, every platform carries one coin, and the
// tiers total 10 gold / 15 silver / 25 bronze = 50. Every coin is reachable with
// the base double-jump; springs and character abilities only make it quicker.
const EXPERT_PLATS = [
  // Zone 1 — Warm-up
  [300, 461, 90, 'plat', 'C'], [520, 400, 110, 'plat', 'C'], [680, 340, 80, 'plat', 'B'], [820, 400, 100, 'plat', 'C'],
  [1120, 340, 92, 'plat', 'C'], [1360, 280, 92, 'plat', 'B'], [1600, 220, 92, 'plat', 'C'],
  [2000, 340, 100, 'plat', 'C'], [2280, 280, 92, 'plat', 'C'], [2560, 220, 92, 'plat', 'B'],
  [2820, 190, 120, 'launch', 'C'], [3120, 200, 92, 'plat', 'C'], [3380, 120, 92, 'plat', 'C'], [3560, -10, 100, 'plat', 'A'],
  // Zone 2 — Skilled
  [3820, 120, 92, 'plat', 'C'], [4080, 200, 92, 'plat', 'B'], [4340, 100, 80, 'plat', 'C'], [4560, -20, 80, 'plat', 'B'],
  [4780, -140, 80, 'plat', 'C'], [5000, -260, 90, 'plat', 'A'], [5240, -80, 92, 'plat', 'C'], [5400, 100, 80, 'plat', 'C'],
  [5620, 40, 100, 'plat', 'B'], [5860, -60, 80, 'plat', 'C'], [6100, -200, 120, 'launch', 'A'], [6380, 20, 92, 'plat', 'C'],
  [6620, -40, 80, 'plat', 'B'], [6860, -120, 80, 'plat', 'C'], [7100, -200, 80, 'plat', 'B'], [7320, -300, 90, 'plat', 'A'], [7560, -60, 100, 'plat', 'C'],
  // Zone 3 — Expert
  [7860, 60, 90, 'plat', 'C'], [8180, -40, 70, 'plat', 'B'], [8360, -160, 70, 'plat', 'C'], [8540, -280, 70, 'plat', 'B'],
  [8720, -400, 70, 'plat', 'A'], [8940, -160, 80, 'plat', 'B'], [9160, -300, 110, 'launch', 'A'], [9480, -100, 80, 'plat', 'B'],
  [9840, -200, 70, 'plat', 'C'], [10020, -320, 66, 'plat', 'B'], [10200, -440, 66, 'plat', 'A'], [10230, -560, 60, 'plat', 'A'],
  [10380, -320, 66, 'plat', 'C'], [10480, -100, 80, 'plat', 'B'], [10600, -200, 80, 'plat', 'A'], [10820, -360, 70, 'plat', 'A'],
  [11040, -220, 80, 'plat', 'B'], [11260, 40, 100, 'plat', 'C'], [11340, 200, 110, 'plat', 'C'],
];

// Active terrain profile, swapped by load() so profileTopAt / terrain / pebbles
// all follow the currently-loaded level.
let PROFILE = TRAINING_PROFILE;

function profileTopAt(x) {
  for (let i = PROFILE.length - 1; i >= 0; i--) if (x >= PROFILE[i][0]) return PROFILE[i][1];
  return FLOOR_TOP_Y;
}

// Deterministic 0..1 hash of two integer cell indices. Drives the soil pebble
// scatter so each fleck keeps a fixed world position (identical every frame,
// regardless of camera), while still looking randomly placed.
function pebHash(i, j) {
  let n = (i * 374761393 + j * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

// A simple coin, coloured by gem tier. Shared by the in-world gems and the HUD.
const GEM_FACE = { A: '#f5c542', B: '#cfd7e0', C: '#cd7f32' };
const GEM_RING = { A: '#c99a1e', B: '#9aa6b4', C: '#9c5f26' };
function drawCoin(ctx, x, y, r, tier) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = GEM_FACE[tier]; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#2f2233'; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = GEM_RING[tier]; ctx.stroke();
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.2, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
}

class Level {
  constructor() {
    this.leftWall = 0;
    this.pixelH = 1400;                  // only used for the fall-out safety check
    this.exitOpenDist = 180;
    this.doorOpen = 0;
    this.solids = [];
    this.springs = [];
    this.gems = [];
    this.load(1);                        // build a default world so the player has a valid spawn/bounds
  }

  _buildGems() {
    const gem = (x, surfaceY, tier) => this.gems.push({ x, y: surfaceY - 26, tier, taken: false });
    // A — gold, along the low/ground path.
    [[350, 521], [750, 521], [2350, 521], [4400, 521], [6700, 473], [3610, -545], [1426, 187], [5526, 139]]
      .forEach(([x, y]) => gem(x, y, 'A'));
    // B — silver, on the mid staircase platforms.
    [[1206, 299], [1316, 243], [3306, 251], [3526, 139], [3746, 271], [5306, 251], [5416, 195], [5746, 271]]
      .forEach(([x, y]) => gem(x, y, 'B'));
    // C — bronze, along the high route.
    [[1303, -36], [1865, 89], [2346, -66], [3403, -74], [4396, -96], [4959, 46], [5403, -112], [2575, 30]]
      .forEach(([x, y]) => gem(x, y, 'C'));
  }

  // Load the geometry for a level id, rebuilding solids/springs/gems/exit for it.
  //   id 1 = Training (Woodland Path);  id 2 = Woodland Expert (same world and
  //   scenery, 50% longer and much harder). An unknown id falls back to Training
  //   so a stray load never errors. Swaps the active terrain PROFILE too, so
  //   profileTopAt / terrain / pebble drawing all follow the loaded level.
  load(id) {
    this.id = id || 1;
    this.floorTopY = FLOOR_TOP_Y;
    this.leftWall = 0;
    this.solids = [];
    this.springs = [];
    this.gems = [];
    this.doorOpen = 0;
    if (this.id === 2) {
      PROFILE = EXPERT_PROFILE;
      this.rightWall = EXPERT_RIGHT_X * X_UNIT;   // 11778
      this.pixelW = this.rightWall;
      this.spawn = { x: 120, y: this.floorTopY - TILE };
      this.exitDoorX = 11556;                     // just before the X151 right wall
      this._buildExpert();
      this._buildExpertGems();
    } else {
      PROFILE = TRAINING_PROFILE;
      this.rightWall = RIGHT_X * X_UNIT;          // 7878
      this.pixelW = this.rightWall;
      this.spawn = { x: 120, y: this.floorTopY - TILE };
      this.exitDoorX = 7656;
      this._build();
      this._buildGems();
    }
  }

  // --- Woodland Expert (id 2) geometry, from EXPERT_PROFILE / EXPERT_PLATS. ---
  _buildExpert() {
    for (let i = 0; i < PROFILE.length - 1; i++) {
      const [x, top] = PROFILE[i];
      const nx = PROFILE[i + 1][0];
      if (top < FLOOR_TOP_Y) this.solids.push({ x, y: top, w: nx - x, h: FLOOR_TOP_Y - top, kind: 'terrain' });
    }
    for (const [x, y, w, kind] of EXPERT_PLATS) {
      this.solids.push({ x, y, w, h: 18, kind, oneway: true });
    }
    // Optional spring boosts (the level is fully clearable by double-jump alone):
    // two on the ground, one vertical pad atop the first Expert-zone platform.
    const B = Physics.SPRING_VELOCITY;
    this.springs.push({ x: 2743, y: profileTopAt(2760), w: 34, bounce: B });
    this.springs.push({ x: 6023, y: profileTopAt(6040), w: 34, bounce: B });
    this.springs.push({ x: 7888, y: 60, w: 34, bounce: B, vertical: true });
  }

  _buildExpertGems() {
    for (const [x, y, w, , coin] of EXPERT_PLATS) {
      this.gems.push({ x: x + w / 2, y: y - 26, tier: coin, taken: false });
    }
  }

  resetGems() { for (const g of this.gems) g.taken = false; }

  _build() {
    // Terrain hills, as solid rects filling from each raised segment down to the
    // base band.
    for (let i = 0; i < PROFILE.length - 1; i++) {
      const [x, top] = PROFILE[i];
      const nx = PROFILE[i + 1][0];
      if (top < FLOOR_TOP_Y) this.solids.push({ x, y: top, w: nx - x, h: FLOOR_TOP_Y - top, kind: 'terrain' });
    }

    // Dense platform clusters (staircase-style), a high route above, connectors
    // between clusters, and the high launch platform. Positions echo the design.
    const plat = (x, y, w, kind) => this.solids.push({ x, y, w, h: 18, kind, oneway: true });
    const clusters = [1300, 3400, 5400];
    const steps = [[-250, 0], [-140, -64], [-30, -120], [80, -176], [190, -120], [300, -44]];
    clusters.forEach((cx, ci) => {
      const base = profileTopAt(cx) - 110;
      steps.forEach(([dx, dy]) => plat(cx + dx, base + dy, 92, 'plat'));
      plat(cx - 72, -36 - (ci % 3) * 38, 150, 'high');
    });
    for (let i = 0; i < clusters.length - 1; i++) {
      const mx = (clusters[i] + clusters[i + 1]) / 2;
      plat(mx - 68, -66 - (i % 2) * 30, 128, 'high');
    }

    // Stepping platforms that bridge the gaps in the high route so it can be
    // hopped across (single or double jump). A couple sit a little lower (rows
    // K–L) to give the higher path a gentle up-and-down.
    [[1560, 62], [1820, 89], [2080, 40], [2530, 30], [2796, 30], [3062, 30],
     [3620, 40], [3880, 46], [4140, 40], [4560, 30], [4737, 40], [4914, 46], [5120, 40]]
      .forEach(([x, y]) => plat(x, y, 90, 'high'));

    // The launch platform (X35–45 at row S) and a zig-zag of small stepping
    // platforms climbing up to it, so it can be reached in a few alternating
    // hops (each ~130px — a single jump).
    this.solids.push({ x: 2730, y: -257, w: 780, h: 18, kind: 'launch', oneway: true });
    [[2990, 300, 130], [3140, 185, 140], [3050, 70, 140], [3140, -45, 140], [3060, -175, 160]]
      .forEach(([x, y, w]) => plat(x, y, w, 'step'));

    // A second orange platform above the launch-platform spring — the spring
    // (at ~X45) bounces you straight up onto it. Sat a little below the apex so
    // you land comfortably, and wide so a slightly-drifting bounce still catches.
    this.solids.push({ x: 3430, y: -545, w: 360, h: 18, kind: 'launch', oneway: true });

    // Springs (bounce pads). y is the surface top the pad rides on.
    const B = Physics.SPRING_VELOCITY;
    this.springs.push({ x: 972, y: profileTopAt(988), w: 34, bounce: B });    // ~X13, ground
    this.springs.push({ x: 5072, y: profileTopAt(5088), w: 34, bounce: B });  // ~X65, ground
    this.springs.push({ x: 3452, y: -257, w: 34, bounce: B, vertical: true }); // ~X45, on the launch platform
  }

  // The nearest solid surface top at or below `feetY`, within the x-span
  // [x, x+w] — the ground a straight drop would land on (platforms, terrain, or
  // the full-width floor band). Returns Infinity if nothing is below (past the
  // right edge). Used to cast the player's ground shadow. Mirrors the falling
  // branch of moveAndCollide, but as a horizontal-only downward probe.
  surfaceBelow(x, w, feetY) {
    let surface = feetY <= this.floorTopY ? this.floorTopY : Infinity;
    const left = x, right = x + w;
    for (const r of this.solids) {
      if (right <= r.x || left >= r.x + r.w) continue;  // no horizontal overlap
      if (r.y < feetY - 0.5) continue;                  // surface must be at/below the feet
      if (r.y < surface) surface = r.y;
    }
    return surface;
  }

  // Is the box's feet resting on a spring? (called on landing) → returns it.
  springAt(x, w, feetY) {
    for (const s of this.springs) {
      if (Math.abs(feetY - s.y) < 6 && x + w > s.x && x < s.x + s.w) return s;
    }
    return null;
  }

  // Advance the door open/shut from the player's proximity, and report whether
  // the player has fully walked into the open doorway.
  updateExit(player, dt) {
    const target = player.cx > this.exitDoorX - this.exitOpenDist ? 1 : 0;
    const rate = dt / 0.30;
    if (this.doorOpen < target) this.doorOpen = Math.min(target, this.doorOpen + rate);
    else if (this.doorOpen > target) this.doorOpen = Math.max(target, this.doorOpen - rate);
    return this.doorOpen > 0.6 && player.cx >= this.exitDoorX;
  }

  resetExit() { this.doorOpen = 0; }

  // --- Rendering ---
  draw(ctx, camX, camY, viewW, viewH) {
    this._drawFloor(ctx, camX, camY, viewW, viewH);
    for (const r of this.solids) if (r.kind === 'terrain') this._drawTerrain(ctx, r, camX, camY);
    this._drawPebbles(ctx, camX, camY, viewW, viewH);
    for (const r of this.solids) if (r.kind !== 'terrain') this._drawPlatform(ctx, r, camX, camY);
    for (const s of this.springs) this._drawSpring(ctx, s.x + s.w / 2, s.y - camY, camX);
    this._drawGems(ctx, camX, camY);
    this._drawExit(ctx, camX, camY);
    this._drawBoundary(ctx, camX, camY, viewH);
  }

  // Brown hut with two small windows and an arched rainbow door that swings
  // open as the player approaches. The door is scaled 1.3x for hut size.
  _drawExit(ctx, camX, camY) {
    const sx = this.exitDoorX - camX;
    if (sx < -260 || sx > 1240) return;
    const OUT = '#2f2233', SCALE = 1.3;

    ctx.save();
    ctx.translate(sx, this.floorTopY - camY);
    ctx.scale(SCALE, SCALE);

    // Body.
    const bw = 176, bh = 150, bx = -bw / 2, by = -bh;
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(bx, by, bw, bh);
    ctx.lineWidth = 4; ctx.strokeStyle = OUT;
    ctx.strokeRect(bx + 2, by + 2, bw - 4, bh - 4);

    // Roof.
    ctx.beginPath();
    ctx.moveTo(bx - 16, by + 4);
    ctx.lineTo(0, by - 66);
    ctx.lineTo(bx + bw + 16, by + 4);
    ctx.closePath();
    ctx.fillStyle = '#6b3f1c'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();

    // Two windows.
    const winY = by + 26, ws = 30;
    for (const wx of [-62, 32]) {
      ctx.fillStyle = '#bfe3ff'; ctx.fillRect(wx, winY, ws, ws);
      ctx.lineWidth = 3; ctx.strokeStyle = OUT;
      ctx.strokeRect(wx + 1.5, winY + 1.5, ws - 3, ws - 3);
      ctx.beginPath();
      ctx.moveTo(wx + ws / 2, winY); ctx.lineTo(wx + ws / 2, winY + ws);
      ctx.moveTo(wx, winY + ws / 2); ctx.lineTo(wx + ws, winY + ws / 2);
      ctx.stroke();
    }

    // Arched rainbow door, hinged on the left. Narrows as it opens.
    const dw = 52, dh = 84, dx = -dw / 2, dyTop = -dh, r = dw / 2;
    const archPath = () => {
      ctx.beginPath();
      ctx.moveTo(dx, 0);
      ctx.lineTo(dx, dyTop + r);
      ctx.arc(0, dyTop + r, r, Math.PI, 0);
      ctx.lineTo(dx + dw, 0);
      ctx.closePath();
    };

    ctx.save();
    archPath();
    ctx.clip();
    ctx.fillStyle = '#241634';
    ctx.fillRect(dx - 2, dyTop - 2, dw + 4, dh + 4);
    const panelW = dw * (1 - this.doorOpen);
    if (panelW > 0.5) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(dx, dyTop - 2, panelW, dh + 4);
      ctx.clip();
      const bands = ['#e23b2e', '#f0862a', '#f5d02a', '#4caf3f', '#2f7fd6', '#7a4bc4'];
      const stripeW = dw / bands.length;
      for (let i = 0; i < bands.length; i++) {
        ctx.fillStyle = bands[i];
        ctx.fillRect(dx + i * stripeW, dyTop - 2, stripeW + 1, dh + 4);
      }
      ctx.restore();
      ctx.fillStyle = OUT;
      ctx.fillRect(dx + panelW - 2, dyTop, 2, dh);
    }
    ctx.restore();

    archPath();
    ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.restore();
  }

  _drawGems(ctx, camX, camY) {
    const t = performance.now() * 0.003;
    for (const g of this.gems) {
      if (g.taken) continue;
      const bob = Math.sin(t + g.x * 0.02) * 3;
      drawCoin(ctx, g.x - camX, g.y - camY + bob, 10, g.tier);
    }
  }

  _drawFloor(ctx, camX, camY, viewW, viewH) {
    const top = this.floorTopY - camY;
    const grassH = Math.round(TILE * 0.28);
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(0, top, viewW, Math.max(TILE, viewH - top));
    ctx.fillStyle = '#5bbf4a';
    ctx.fillRect(0, top, viewW, grassH);
    ctx.fillStyle = '#2f2233';
    ctx.fillRect(0, top, viewW, EDGE_LINE);
  }

  _drawTerrain(ctx, r, camX, camY) {
    // Snap the segment's screen edges to whole pixels so neighbouring segments
    // tile exactly. Without this, a fractional camera offset leaves a ~1px
    // sub-pixel seam between adjacent same-height rects — a hairline of the
    // background bleeding through the grass and soil.
    const rx = Math.round(r.x - camX);
    const rw = Math.round(r.x + r.w - camX) - rx;
    const y = Math.round(r.y - camY);
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(rx, y, rw, r.h + 80);          // down past the base so no seam shows
    ctx.fillStyle = '#5bbf4a';
    ctx.fillRect(rx, y, rw, Math.round(TILE * 0.28));
    ctx.fillStyle = '#2f2233';
    ctx.fillRect(rx, y, rw, EDGE_LINE);          // horizontal top edge

    // Vertical edge lines on the exposed step faces. A face is only exposed
    // against a lower neighbour, so the higher segment draws it — adjacent or
    // co-planar segments never double-line. nl/nr are the neighbouring surface
    // tops just past this segment's left/right edge.
    const nl = profileTopAt(r.x - 1), nr = profileTopAt(r.x + r.w);
    if (nl > r.y) ctx.fillRect(rx - EDGE_LINE / 2, y, EDGE_LINE, Math.round(nl - camY) - y);
    if (nr > r.y) ctx.fillRect(rx + rw - EDGE_LINE / 2, y, EDGE_LINE, Math.round(nr - camY) - y);
  }

  // Sparse stone texture through the exposed soil (below the grass line). Two
  // layers — fine earthy grit and small outlined pebbles — placed on a jittered
  // world-space grid so the density is even per unit of soil and every fleck
  // keeps a fixed world position. Called between the terrain and platform passes,
  // so it reads as part of the ground and the player/shadow sit in front.
  _drawPebbles(ctx, camX, camY, viewW, viewH) {
    const grassH = Math.round(TILE * 0.28);
    const worldL = camX, worldR = camX + viewW, worldTop = camY, worldBot = camY + viewH;
    const SPECK = ['#7a4f24', '#9c6a38', '#6b4420', '#a0703c'];
    const PEB = [['#9aa0a6', '#7b8188'], ['#a06a3a', '#814f28']];
    const inSoil = (wx, wy) => {
      if (wy <= profileTopAt(wx) + grassH + 1 || wy >= worldBot) return false;
      // Keep clear of the vertical step-edge outline: within a few px of a height
      // change, skip the exposed-face band (down to the lower surface) so no fleck
      // sits on the black line. Co-planar boundaries (equal tops) aren't affected.
      const sL = profileTopAt(wx - 6), sR = profileTopAt(wx + 6);
      if (sL !== sR && wy <= Math.max(sL, sR)) return false;
      return true;
    };

    // Layer 1 — earthy grit: fine specks, no outline.
    const cs = 36;
    for (let gx = Math.floor(worldL / cs); gx <= Math.ceil(worldR / cs); gx++) {
      for (let gy = Math.floor(worldTop / cs); gy <= Math.ceil(worldBot / cs); gy++) {
        const wx = gx * cs + pebHash(gx, gy) * cs, wy = gy * cs + pebHash(gx * 3 + 1, gy * 7 + 2) * cs;
        if (!inSoil(wx, wy)) continue;
        const c = pebHash(gx + 11, gy + 5), rad = 1.1 + c * 1.4;
        ctx.beginPath(); ctx.ellipse(wx - camX, wy - camY, rad, rad, 0, 0, 7);
        ctx.fillStyle = SPECK[(c * 4) | 0]; ctx.fill();
      }
    }

    // Layer 2 — small outlined pebbles: grey/brown, two-tone, tiny glint.
    const cp = 92;
    for (let gx = Math.floor(worldL / cp); gx <= Math.ceil(worldR / cp); gx++) {
      for (let gy = Math.floor(worldTop / cp); gy <= Math.ceil(worldBot / cp); gy++) {
        const wx = gx * cp + pebHash(gx + 100, gy + 50) * cp, wy = gy * cp + pebHash(gx * 5 + 3, gy * 3 + 9) * cp;
        if (!inSoil(wx, wy)) continue;
        const c = pebHash(gx + 61, gy + 29), rad = 2 + c * 1.4, pr = PEB[(c * 2) | 0];
        const x = wx - camX, y = wy - camY, rx = rad, ry = rad * 0.8;
        ctx.save();
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7);
        ctx.fillStyle = pr[0]; ctx.fill();
        ctx.save(); ctx.clip(); ctx.fillStyle = pr[1]; ctx.fillRect(x - rx - 2, y + ry * 0.12, rx * 2 + 4, ry * 2); ctx.restore();
        ctx.lineWidth = 1; ctx.strokeStyle = '#2f2233'; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x - rx * 0.3, y - ry * 0.36, rx * 0.28, ry * 0.22, 0, 0, 7);
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
        ctx.restore();
      }
    }
  }

  _drawPlatform(ctx, r, camX, camY) {
    const x = r.x - camX, y = r.y - camY;
    const grass = r.kind === 'launch' ? '#e0912a' : (r.kind === 'high' ? '#8fd66b' : '#5bbf4a');
    ctx.fillStyle = '#8a5a2b';
    this._round(ctx, x, y, r.w, r.h, 7); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#2f2233'; ctx.stroke();
    ctx.fillStyle = grass;
    this._round(ctx, x + 2, y + 2, r.w - 4, 7, 3); ctx.fill();
  }

  _drawSpring(ctx, cx, topY, camX) {
    const x = cx - camX;
    ctx.fillStyle = '#f4e8d0'; ctx.strokeStyle = '#3a2e1c'; ctx.lineWidth = 3;
    this._round(ctx, x - 12, topY - 22, 24, 22, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e04a34';
    ctx.beginPath(); ctx.ellipse(x, topY - 22, 27, 18, 0, Math.PI, 0, true); ctx.fill();
    ctx.strokeStyle = '#7a2418'; ctx.stroke();
    ctx.fillStyle = '#fff';
    [[-12, -6], [9, -9], [0, -16], [15, -2]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.arc(x + sx, topY - 22 + sy, 3.6, 0, 7); ctx.fill(); });
  }

  // A leafy hedge marking the right edge of the playable area.
  _drawBoundary(ctx, camX, camY, viewH) {
    const x = this.rightWall - camX;
    if (x < -60 || x > 1020) return;
    const top = this.floorTopY - camY;
    ctx.fillStyle = '#3f8a34';
    for (let y = top - 150; y < top + 6; y += 26) {
      for (const dx of [8, 30, 52]) { ctx.beginPath(); ctx.arc(x + dx, y, 18, 0, 7); ctx.fill(); }
    }
    ctx.fillStyle = '#2f2233';
    ctx.fillRect(x, top - 156, 3, 162);
  }

  _round(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
