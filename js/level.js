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
const X_UNIT = 78;                                    // world px per grid X-unit
const RIGHT_X = 101;                                  // confine the playable area to X101

// Terrain profile: [worldX, topY] step points. topY < FLOOR_TOP_Y is a raised
// hill; equal to it is flat valley (the base band shows through).
const PROFILE = [
  [0, 521], [900, 521], [1150, 473], [1550, 473], [1850, 521], [2500, 521],
  [2800, 473], [3100, 425], [3500, 425], [3800, 473], [4100, 521], [4700, 521],
  [5000, 473], [5300, 425], [5600, 377], [5900, 377], [6200, 425], [6500, 473],
  [6800, 521], [7300, 521], [7600, 473], [7878, 473],
];

function profileTopAt(x) {
  for (let i = PROFILE.length - 1; i >= 0; i--) if (x >= PROFILE[i][0]) return PROFILE[i][1];
  return FLOOR_TOP_Y;
}

class Level {
  constructor() {
    this.floorTopY = FLOOR_TOP_Y;
    this.leftWall = 0;
    this.rightWall = RIGHT_X * X_UNIT;   // 7878
    this.pixelW = this.rightWall;
    this.pixelH = 1400;                  // only used for the fall-out safety check
    this.spawn = { x: 120, y: this.floorTopY - TILE };

    this.solids = [];
    this.springs = [];
    this._build();
  }

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

    // The launch platform (X35–45 at row S) and a zig-zag of small stepping
    // platforms climbing up to it, so it can be reached in a few alternating
    // hops (each ~130px — a single jump).
    this.solids.push({ x: 2730, y: -257, w: 780, h: 18, kind: 'launch', oneway: true });
    [[3050, 300, 140], [3140, 185, 140], [3050, 70, 140], [3140, -45, 140], [3060, -175, 160]]
      .forEach(([x, y, w]) => plat(x, y, w, 'step'));

    // Springs (bounce pads). y is the surface top the pad rides on.
    const B = Physics.SPRING_VELOCITY;
    this.springs.push({ x: 972, y: profileTopAt(988), w: 34, bounce: B });    // ~X13, ground
    this.springs.push({ x: 5072, y: profileTopAt(5088), w: 34, bounce: B });  // ~X65, ground
    this.springs.push({ x: 3452, y: -257, w: 34, bounce: B });               // ~X45, on the launch platform
  }

  // Is the box's feet resting on a spring? (called on landing) → returns it.
  springAt(x, w, feetY) {
    for (const s of this.springs) {
      if (Math.abs(feetY - s.y) < 6 && x + w > s.x && x < s.x + s.w) return s;
    }
    return null;
  }

  // --- Rendering ---
  draw(ctx, camX, camY, viewW, viewH) {
    this._drawFloor(ctx, camX, camY, viewW, viewH);
    for (const r of this.solids) {
      if (r.kind === 'terrain') this._drawTerrain(ctx, r, camX, camY);
      else this._drawPlatform(ctx, r, camX, camY);
    }
    for (const s of this.springs) this._drawSpring(ctx, s.x + s.w / 2, s.y - camY, camX);
    this._drawBoundary(ctx, camX, camY, viewH);
  }

  _drawFloor(ctx, camX, camY, viewW, viewH) {
    const top = this.floorTopY - camY;
    const grassH = Math.round(TILE * 0.28);
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(0, top, viewW, Math.max(TILE, viewH - top));
    ctx.fillStyle = '#5bbf4a';
    ctx.fillRect(0, top, viewW, grassH);
    ctx.fillStyle = '#2f2233';
    ctx.fillRect(0, top, viewW, 3);
  }

  _drawTerrain(ctx, r, camX, camY) {
    const x = r.x - camX, y = r.y - camY;
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(x, y, r.w, r.h + 40);          // down past the base so no seam shows
    ctx.fillStyle = '#5bbf4a';
    ctx.fillRect(x, y, r.w, Math.round(TILE * 0.28));
    ctx.fillStyle = '#2f2233';
    ctx.fillRect(x, y, r.w, 3);
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
