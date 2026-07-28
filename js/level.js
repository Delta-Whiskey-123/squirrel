'use strict';

/* level.js — a tilemap and its rendering.

   Milestone 1 uses one hardcoded test level so we can prove the movement feels
   good before any data-driven loading exists. The map is an array of equal
   length strings; each character is a tile. See LEGEND.

   Legend (a superset is defined now; only some are used in M1):
     '#' solid   '.' empty   'o' collectible   '~' water
     '-' moving  '^' spring  'E' exit          'P' spawn */

const TILE = Physics.TILE; // 48

// A wide, forgiving test course. The climbing staircase lifts you up in ~2
// tile steps so every platform is reachable with a single jump. The bottom
// grass floor is NOT part of this tile grid — it is a separate full-width
// ground band (see FLOOR_* below), so its height and how much of it shows on
// screen can be tuned independently of the platforms.
const TEST_LEVEL = [
  '..............................#####.............', // E: top reward platform
  '................................................',
  '........................####....................', // D
  '................................................',
  '..................####..........................', // C
  '................................................',
  '............####................................', // B
  '................................................',
  '......####............................#####.....', // A (left) + right platform
  '..P.............................................', // spawn (sits on the floor band)
];

// The bottom grass floor, expressed as a solid band rather than tiles.
const VIEW_H = 540;               // must match the canvas height in main.js
const FLOOR_THICKNESS = TILE;     // conceptual floor block height
const FLOOR_VISIBLE_FRAC = 0.40;  // show only the top 40%; the rest sits off-screen
const FLOOR_TOP_Y = Math.round(VIEW_H - FLOOR_VISIBLE_FRAC * FLOOR_THICKNESS);

class Level {
  constructor(rows) {
    this.rows = rows;
    this.h = rows.length;
    this.w = rows.length ? rows[0].length : 0;
    this.pixelW = this.w * TILE;
    this.pixelH = this.h * TILE;
    this.floorTopY = FLOOR_TOP_Y;   // top surface of the full-width ground band
    this.spawn = this._findSpawn();
  }

  _findSpawn() {
    for (let r = 0; r < this.h; r++) {
      const c = this.rows[r].indexOf('P');
      // Keep the spawn column, but rest the player on top of the floor band.
      if (c >= 0) return { x: c * TILE, y: this.floorTopY - TILE };
    }
    return { x: TILE, y: this.floorTopY - TILE }; // fallback
  }

  tileAt(col, row) {
    if (col < 0 || col >= this.w) return '#';        // solid walls at the sides
    if (row < 0 || row >= this.h) return '.';        // open above/below the grid
    return this.rows[row][col];
  }

  // Pixel-space solidity query used by the physics solver. The floor is a solid
  // band across the whole width below floorTopY; above it, the tile grid rules.
  isSolidAt(px, py) {
    if (py >= this.floorTopY) return true;
    const col = Math.floor(px / TILE);
    const row = Math.floor(py / TILE);
    return this.tileAt(col, row) === '#';
  }

  // Y of the top surface of the solid occupying (px, py). Tiles are grid
  // aligned; the floor band's surface is floorTopY (not on the grid). The
  // collision solver uses this so a landing rests on the true surface.
  surfaceYAt(px, py) {
    if (py >= this.floorTopY) return this.floorTopY;
    return Math.floor(py / TILE) * TILE;
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

    this._drawFloor(ctx, camX, camY, viewW, viewH);
  }

  // The full-width grass floor band. Its top sits at floorTopY and the block
  // extends a full FLOOR_THICKNESS downward, so only the top slice shows on
  // screen (the rest runs off the bottom edge).
  _drawFloor(ctx, camX, camY, viewW, viewH) {
    const top = this.floorTopY - camY;
    const grassH = Math.round(FLOOR_THICKNESS * 0.28); // same proportion as the tiles
    // Earth body (down past the screen edge so no sky shows below).
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(0, top, viewW, Math.max(FLOOR_THICKNESS, viewH - top));
    // Grass cap on top.
    ctx.fillStyle = '#5bbf4a';
    ctx.fillRect(0, top, viewW, grassH);
    // Thick dark top edge, matching the tile outline style.
    ctx.fillStyle = '#2f2233';
    ctx.fillRect(0, top, viewW, 3);
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
