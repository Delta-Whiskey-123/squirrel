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

// How long an uninterrupted full-speed run from spawn to the exit door takes.
const TRAVERSE_SECONDS = 60;

class Level {
  constructor(rows) {
    this.rows = rows;
    this.h = rows.length;
    // The tile grid only covers the small start area; the rest of the level is
    // open floor band. Playable width is tracked separately in pixels.
    this.tileCols = rows.length ? rows[0].length : 0;
    this.pixelH = this.h * TILE;
    this.floorTopY = FLOOR_TOP_Y;   // top surface of the full-width ground band
    this.spawn = this._findSpawn();

    // Place the exit hut a full-speed TRAVERSE_SECONDS run to the right of the
    // spawn, and end the level a little past it.
    const spawnCenterX = this.spawn.x + TILE / 2;
    this.exitDoorX = Math.round(spawnCenterX + Physics.MOVE_SPEED * TRAVERSE_SECONDS);
    this.pixelW = this.exitDoorX + 240;

    this.doorOpen = 0;          // 0 = shut, 1 = fully open
    this.exitOpenDist = 180;    // door begins opening once the player is this close
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
    // Outside the start grid there are no tiles — just open air (the floor band
    // and level side walls are handled separately in isSolidAt).
    if (col < 0 || col >= this.tileCols) return '.';
    if (row < 0 || row >= this.h) return '.';
    return this.rows[row][col];
  }

  // Pixel-space solidity query used by the physics solver.
  isSolidAt(px, py) {
    if (px < 0 || px >= this.pixelW) return true;   // level side walls
    if (py >= this.floorTopY) return true;          // full-width ground band
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

  // Advance the door's open/shut animation from the player's proximity, and
  // report whether the player has fully walked into the open doorway.
  updateExit(player, dt) {
    const target = player.cx > this.exitDoorX - this.exitOpenDist ? 1 : 0;
    const rate = dt / 0.30;                 // ~0.3s to swing fully open or shut
    if (this.doorOpen < target) this.doorOpen = Math.min(target, this.doorOpen + rate);
    else if (this.doorOpen > target) this.doorOpen = Math.max(target, this.doorOpen - rate);

    // Completed only once the player has reached the middle of the doorway and
    // the door is actually open — so they visibly step inside first.
    return this.doorOpen > 0.6 && player.cx >= this.exitDoorX;
  }

  resetExit() { this.doorOpen = 0; }

  // Draw the visible slice of the world for a camera at (camX, camY).
  draw(ctx, camX, camY, viewW, viewH) {
    const c0 = Math.max(0, Math.floor(camX / TILE));
    const r0 = Math.max(0, Math.floor(camY / TILE));
    const c1 = Math.min(this.tileCols, Math.ceil((camX + viewW) / TILE));
    const r1 = Math.min(this.h, Math.ceil((camY + viewH) / TILE));

    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const t = this.rows[r][c];
        if (t === '#') this._drawSolid(ctx, c * TILE - camX, r * TILE - camY);
      }
    }

    this._drawFloor(ctx, camX, camY, viewW, viewH);
    this._drawExit(ctx, camX, camY, viewW);
  }

  // The full-width grass floor band. Its top sits at floorTopY and the block
  // extends a full FLOOR_THICKNESS downward, so only the top slice shows on
  // screen (the rest runs off the bottom edge). Scrolling grass tufts give the
  // otherwise-plain runway some sense of motion.
  _drawFloor(ctx, camX, camY, viewW, viewH) {
    const top = this.floorTopY - camY;
    const grassH = Math.round(FLOOR_THICKNESS * 0.28); // same proportion as the tiles
    // Earth body (down past the screen edge so no sky shows below).
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(0, top, viewW, Math.max(FLOOR_THICKNESS, viewH - top));
    // Grass cap on top.
    ctx.fillStyle = '#5bbf4a';
    ctx.fillRect(0, top, viewW, grassH);

    // Grass tufts every 96px of world, so running reads as movement.
    ctx.fillStyle = '#3f9c33';
    const step = 96;
    const startWorld = Math.floor(camX / step) * step;
    for (let wx = startWorld; wx < camX + viewW + step; wx += step) {
      const x = wx - camX;
      ctx.fillRect(x + 22, top + 2, 3, grassH - 3);
      ctx.fillRect(x + 27, top,     3, grassH - 1);
      ctx.fillRect(x + 32, top + 2, 3, grassH - 3);
    }

    // Thick dark top edge, matching the tile outline style.
    ctx.fillStyle = '#2f2233';
    ctx.fillRect(0, top, viewW, 3);
  }

  // The exit: a flat brown hut with two small windows and an arched, rainbow
  // door. Only drawn when it is near the view.
  _drawExit(ctx, camX, camY, viewW) {
    const sx = this.exitDoorX - camX;              // door centre in screen space
    if (sx < -260 || sx > viewW + 260) return;     // off-screen, skip
    const OUT = '#2f2233';
    const SCALE = 1.3;                             // overall hut size

    // Draw in local space anchored at the door centre on the ground (0, 0);
    // the transform handles both position and the size scaling.
    ctx.save();
    ctx.translate(sx, this.floorTopY - camY);
    ctx.scale(SCALE, SCALE);

    // --- Hut body ---
    const bw = 176, bh = 150;
    const bx = -bw / 2, by = -bh;
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(bx, by, bw, bh);
    ctx.lineWidth = 4; ctx.strokeStyle = OUT;
    ctx.strokeRect(bx + 2, by + 2, bw - 4, bh - 4);

    // --- Roof (a peaked triangle overhanging the body) ---
    ctx.beginPath();
    ctx.moveTo(bx - 16, by + 4);
    ctx.lineTo(0, by - 66);
    ctx.lineTo(bx + bw + 16, by + 4);
    ctx.closePath();
    ctx.fillStyle = '#6b3f1c'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();

    // --- Two small windows, flanking the door ---
    const winY = by + 26, ws = 30;
    for (const wx of [-62, 32]) {
      ctx.fillStyle = '#bfe3ff';
      ctx.fillRect(wx, winY, ws, ws);
      ctx.lineWidth = 3; ctx.strokeStyle = OUT;
      ctx.strokeRect(wx + 1.5, winY + 1.5, ws - 3, ws - 3);
      ctx.beginPath();                             // pane cross
      ctx.moveTo(wx + ws / 2, winY); ctx.lineTo(wx + ws / 2, winY + ws);
      ctx.moveTo(wx, winY + ws / 2); ctx.lineTo(wx + ws, winY + ws / 2);
      ctx.stroke();
    }

    // --- Rainbow arched door (swings open as the player approaches) ---
    const dw = 52, dh = 84;
    const dx = -dw / 2, dyTop = -dh, r = dw / 2;
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
    // The dark doorway revealed behind the door.
    ctx.fillStyle = '#241634';
    ctx.fillRect(dx - 2, dyTop - 2, dw + 4, dh + 4);
    // The rainbow door itself, hinged on the left. It narrows as it opens,
    // uncovering the dark interior from the right.
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
      // Leading edge of the opening door.
      ctx.fillStyle = OUT;
      ctx.fillRect(dx + panelW - 2, dyTop, 2, dh);
    }
    ctx.restore();

    // Door frame outline.
    archPath();
    ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();

    ctx.restore();
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
