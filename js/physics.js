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
  JUMP_VELOCITY:  -800,   // ~160px apex H (~3.3 tiles) — a good, high, floaty hop
  // Mid-air (double) jump. Sized so a second jump pressed at the first jump's
  // apex peaks at exactly 1.3*H and no higher: extra rise = 0.3*160 = 48px,
  // v = sqrt(2*GRAVITY*48) ≈ 438. Pressed earlier it peaks lower, so 1.3*H caps it.
  DOUBLE_JUMP_VEL:-438,
  MAX_AIR_JUMPS:  1,      // extra jumps allowed while airborne (1 = double jump)
  GLIDE_MAX_FALL:  120,
  MAX_FALL:        900,
  ACCEL:           2400,   // ground horizontal acceleration
  AIR_ACCEL:       1400,   // air accel when speeding up / holding a direction
  AIR_TURN_ACCEL:  5000,   // air accel when reversing — snappy, low-inertia turns
  FRICTION:        2000,   // ground deceleration when no input
  COYOTE_TIME:     0.12,
  JUMP_BUFFER:     0.15,
  VARIABLE_JUMP:   true,   // releasing jump early halves upward velocity
  SPRING_VELOCITY: 1150,   // upward launch a spring gives (px/s); ~7-tile bounce

  TILE: 48,
};

/* Move an AABB by (dx, dy) and resolve it against the level, one axis at a time
   (X then Y — the classic trick that stops the box catching on seams). Mutates
   `box` (needs x, y, w, h) and returns which sides were hit.

   The level exposes:
     leftWall, rightWall   world-x bounds the box can't pass
     floorTopY             a full-width solid ground band (blocks downward only)
     solids                array of solid rects {x, y, w, h} (full AABB)
   This lets platforms and terrain sit at any position, not just a tile grid. */
function moveAndCollide(box, dx, dy, level) {
  const result = { hitLeft: false, hitRight: false, hitTop: false, hitBottom: false };
  const solids = level.solids || [];

  // A `oneway` rect (a floating platform) is solid only from above — you jump
  // up through it and land on top. Terrain rects are fully solid.

  // --- Horizontal ---
  if (dx !== 0) {
    box.x += dx;
    if (box.x < level.leftWall) { box.x = level.leftWall; result.hitLeft = true; }
    if (box.x + box.w > level.rightWall) { box.x = level.rightWall - box.w; result.hitRight = true; }
    for (const r of solids) {
      if (r.oneway) continue;                 // pass through the sides of platforms
      if (!overlaps(box, r)) continue;
      if (dx > 0) { box.x = r.x - box.w; result.hitRight = true; }
      else        { box.x = r.x + r.w;   result.hitLeft = true; }
    }
  }

  // --- Vertical ---
  if (dy !== 0) {
    const prevBottom = box.y + box.h;         // where the feet were before moving
    box.y += dy;
    if (dy > 0) {
      // Falling: rest on the highest surface the box now overlaps (a rect top or
      // the floor band). A one-way platform only catches us if our feet were at
      // or above its top before this step (i.e. we came down onto it).
      let surface = Infinity;
      if (box.y + box.h > level.floorTopY) surface = level.floorTopY;
      for (const r of solids) {
        if (!overlaps(box, r)) continue;
        if (r.oneway && prevBottom > r.y + 1) continue;
        surface = Math.min(surface, r.y);
      }
      if (surface !== Infinity) { box.y = surface - box.h; result.hitBottom = true; }
    } else {
      // Rising: stop under the lowest solid underside; one-way platforms don't
      // block us going up.
      let ceiling = -Infinity;
      for (const r of solids) {
        if (r.oneway) continue;
        if (overlaps(box, r)) ceiling = Math.max(ceiling, r.y + r.h);
      }
      if (ceiling !== -Infinity) { box.y = ceiling; result.hitTop = true; }
    }
  }

  return result;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
