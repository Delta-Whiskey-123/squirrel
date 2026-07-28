'use strict';

/* level.js — a tilemap and its rendering.

   Milestone 1 uses one hardcoded test level so we can prove the movement feels
   good before any data-driven loading exists. The map is an array of equal
   length strings; each character is a tile. See LEGEND.

   Legend (a superset is defined now; only some are used in M1):
     '#' solid   '.' empty   'o' collectible   '~' water
     '-' moving  '^' spring  'E' exit          'P' spawn */

const TILE = Physics.TILE; // 48

// A wide, forgiving test course: flat ground, a few steps, gaps to jump,
// floating platforms, and a pit to fall into (which just respawns you).
const TEST_LEVEL = [
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '..........................######................',
  '................................................',
  '..................######........................',
  '................................................',
  '..........#####.....................#######......',
  '................................................',
  'P.....................####......................',
  '####........................................####',
  '####..####........####......####............####',
  '####..####........####......####............####',
];

class Level {
  constructor(rows) {
    this.rows = rows;
    this.h = rows.length;
    this.w = rows.length ? rows[0].length : 0;
    this.pixelW = this.w * TILE;
    this.pixelH = this.h * TILE;
    this.spawn = this._findSpawn();
  }

  _findSpawn() {
    for (let r = 0; r < this.h; r++) {
      const c = this.rows[r].indexOf('P');
      if (c >= 0) return { x: c * TILE, y: r * TILE };
    }
    return { x: TILE, y: TILE }; // fallback
  }

  tileAt(col, row) {
    if (row < 0 || row >= this.h || col < 0 || col >= this.w) return '#'; // walls outside
    return this.rows[row][col];
  }

  // Pixel-space solidity query used by the physics solver.
  isSolidAt(px, py) {
    const col = Math.floor(px / TILE);
    const row = Math.floor(py / TILE);
    return this.tileAt(col, row) === '#';
  }

  // Draw only the tiles visible for a camera at (camX, camY). In M1 the camera
  // is fixed at 0,0 but we already respect it so Milestone 2 can just move it.
  draw(ctx, camX, camY, viewW, viewH) {
    const c0 = Math.max(0, Math.floor(camX / TILE));
    const r0 = Math.max(0, Math.floor(camY / TILE));
    const c1 = Math.min(this.w, Math.ceil((camX + viewW) / TILE));
    const r1 = Math.min(this.h, Math.ceil((camY + viewH) / TILE));

    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const t = this.rows[r][c];
        if (t === '#') this._drawSolid(ctx, c * TILE - camX, r * TILE - camY);
      }
    }
  }

  // Flat, thick-outlined ground block: green top cap on brown earth.
  _drawSolid(ctx, x, y) {
    const s = TILE;
    // Earth body.
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(x, y, s, s);
    // Grass cap.
    ctx.fillStyle = '#5bbf4a';
    ctx.fillRect(x, y, s, Math.round(s * 0.28));
    // Thick outline.
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2f2233';
    ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
  }
}
