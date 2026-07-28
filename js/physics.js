'use strict';

/* physics.js — the tuning constants and the AABB-vs-tilemap collision solver.

   The player is an axis-aligned box. We move it one axis at a time (X then Y)
   and resolve against solid tiles. Resolving axes separately is the classic
   trick that stops the box from catching on tile seams. */

const Physics = {
  // --- Tuning constants (px, px/s, px/s^2, seconds). Tune later. ---
  GRAVITY:         2000,
  MOVE_SPEED:      260,
  ROLL_SPEED:      380,
  JUMP_VELOCITY:  -700,
  DOUBLE_JUMP_VEL:-600,
  GLIDE_MAX_FALL:  120,
  MAX_FALL:        900,
  ACCEL:           2400,   // ground horizontal acceleration
  AIR_ACCEL:       1400,
  FRICTION:        2000,   // ground deceleration when no input
  COYOTE_TIME:     0.12,
  JUMP_BUFFER:     0.15,
  VARIABLE_JUMP:   true,   // releasing jump early halves upward velocity

  TILE: 48,
};

/* Move an AABB by (dx, dy) through the solid tiles of `level`, one axis at a
   time. Mutates `box` (needs x, y, w, h). Returns collision flags so the
   player can know when it landed, hit a ceiling, or touched a wall.

   `level.isSolidAt(px, py)` answers whether the world pixel is inside a solid
   tile. Keeping the query pixel-based keeps this solver independent of how the
   level stores its tiles. */
function moveAndCollide(box, dx, dy, level) {
  const result = { hitLeft: false, hitRight: false, hitTop: false, hitBottom: false };

  // --- Horizontal ---
  if (dx !== 0) {
    box.x += dx;
    if (dx > 0) {
      // Moving right: check the right edge.
      const right = box.x + box.w;
      if (solidColumn(level, right, box.y, box.h)) {
        const tileLeft = Math.floor(right / Physics.TILE) * Physics.TILE;
        box.x = tileLeft - box.w;
        result.hitRight = true;
      }
    } else {
      const left = box.x;
      if (solidColumn(level, left, box.y, box.h)) {
        const tileRight = Math.floor(left / Physics.TILE) * Physics.TILE + Physics.TILE;
        box.x = tileRight;
        result.hitLeft = true;
      }
    }
  }

  // --- Vertical ---
  if (dy !== 0) {
    box.y += dy;
    if (dy > 0) {
      // Falling: check the bottom edge.
      const bottom = box.y + box.h;
      if (solidRow(level, bottom, box.x, box.w)) {
        const tileTop = Math.floor(bottom / Physics.TILE) * Physics.TILE;
        box.y = tileTop - box.h;
        result.hitBottom = true;
      }
    } else {
      const top = box.y;
      if (solidRow(level, top, box.x, box.w)) {
        const tileBottom = Math.floor(top / Physics.TILE) * Physics.TILE + Physics.TILE;
        box.y = tileBottom;
        result.hitTop = true;
      }
    }
  }

  return result;
}

// Is any solid tile touching the vertical segment x=px, y in [py, py+h]?
// Sample top, middle-ish, and bottom so tall boxes can't slip past a tile.
function solidColumn(level, px, py, h) {
  const ys = spanSamples(py, h);
  for (const y of ys) if (level.isSolidAt(px, y)) return true;
  return false;
}

// Is any solid tile touching the horizontal segment y=py, x in [px, px+w]?
function solidRow(level, py, px, w) {
  const xs = spanSamples(px, w);
  for (const x of xs) if (level.isSolidAt(x, py)) return true;
  return false;
}

// Sample points along a span of length `len` starting at `start`, spaced so no
// gap exceeds one tile. Always includes both ends (inset by 1px to avoid
// catching the exact adjacent tile edge).
function spanSamples(start, len) {
  const out = [start + 1];
  const step = Physics.TILE;
  for (let d = step; d < len; d += step) out.push(start + d);
  out.push(start + len - 1);
  return out;
}
