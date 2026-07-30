'use strict';

/* characters.js — the club members and how to draw them.

   Each character is { id, name, locked, draw }. `draw(ctx, cx, feetY, s, o)`
   renders the character from canvas primitives, anchored at the bottom-centre
   (feet) and growing upward, scaled by `s`. Options `o`:
     face  -1/1  lean + eye shift toward a facing direction
     leg         leg-swing offset (walk animation)
     sq          squash/stretch factor about the feet

   Both the player and the character-select menu draw through these, so a
   character looks identical wherever it appears. */

// Shared rounded-rect path helper.
function _rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Yellow Ted Ted — the lion. Ruffled mustard mane, cream face, stitched nose.
function drawLion(ctx, cx, feetY, s, o) {
  o = o || {};
  const face = o.face || 0, leg = o.leg || 0, sq = o.sq || 1;
  const MANE = '#E4A72C', FACE = '#F3E3BE', OUT = '#3B2A1B',
        INK = '#2A1D12', EARIN = '#EBD09A', LINE = '#B9831C';

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(1 / Math.sqrt(sq), sq);     // squash/stretch about the feet
  ctx.scale(s, s);
  ctx.rotate(face * 0.05);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const hy = -40;

  ctx.fillStyle = 'rgba(40,25,15,0.16)';
  ctx.beginPath(); ctx.ellipse(0, 1, 20, 4.5, 0, 0, 7); ctx.fill();

  ctx.fillStyle = MANE; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  [[-8, leg], [8, -leg]].forEach(([lx, dy]) => { _rr(ctx, lx - 4, -11 + dy, 8, 12 - dy, 3.5); ctx.fill(); ctx.stroke(); });

  ctx.fillStyle = MANE; _rr(ctx, -13, -27, 26, 20, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = FACE; ctx.beginPath(); ctx.ellipse(0, -15, 7.5, 7, 0, 0, 7); ctx.fill();

  ctx.fillStyle = MANE;
  [-13, 13].forEach((ax) => { ctx.beginPath(); ctx.ellipse(ax, -20, 4.5, 6, 0, 0, 7); ctx.fill(); ctx.stroke(); });

  ctx.fillStyle = MANE; ctx.beginPath(); ctx.arc(0, hy, 17, 0, 7); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = 1.5;
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2;
    ctx.fillStyle = MANE;
    ctx.beginPath(); ctx.arc(Math.cos(a) * 16, hy + Math.sin(a) * 16, 9, 0, 7); ctx.fill(); ctx.stroke();
  }

  [-11, 11].forEach((ex) => {
    ctx.fillStyle = MANE; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ex, hy - 15, 6, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = EARIN; ctx.beginPath(); ctx.arc(ex, hy - 14, 3, 0, 7); ctx.fill();
  });

  ctx.fillStyle = FACE; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, hy, 14.5, 0, 7); ctx.fill(); ctx.stroke();

  const ex = face * 1.3;
  ctx.fillStyle = INK;
  [-6.9, 6.9].forEach((dx) => {
    ctx.beginPath(); ctx.arc(dx + ex, hy - 1, 2.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dx + ex - 0.7, hy - 1.8, 0.8, 0, 7); ctx.fill();
    ctx.fillStyle = INK;
  });

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(-3.2, hy + 3); ctx.lineTo(3.2, hy + 3);
  ctx.quadraticCurveTo(2.4, hy + 7.5, 0, hy + 8.5);
  ctx.quadraticCurveTo(-2.4, hy + 7.5, -3.2, hy + 3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, hy + 8.5); ctx.lineTo(0, hy + 12.5); ctx.stroke();

  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(-2.4, hy + 11.5, 2.6, -0.2, 1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(2.4, hy + 11.5, 2.6, 1.64, 3.34); ctx.stroke();

  ctx.fillStyle = 'rgba(60,40,20,0.5)';
  [[-9, hy + 7], [-11, hy + 9], [9, hy + 7], [11, hy + 9]].forEach(([fx, fy]) => {
    ctx.beginPath(); ctx.arc(fx, fy, 0.7, 0, 7); ctx.fill();
  });

  ctx.restore();
}

// Blue Ted Ted — the rabbit. Dusty blue-grey muslin, tall floppy-tipped ears
// (which bounce with movement), soft sleepy stitched eyes, and a Y mouth.
function drawBlueRabbit(ctx, cx, feetY, s, o) {
  o = o || {};
  const face = o.face || 0, leg = o.leg || 0, sq = o.sq || 1, t = o.t || 0;
  const BLU = '#8DA9B6', OUT = '#33454E', INK = '#2E3C43',
        EARIN = '#CBD8DD', BELLY = '#B6C7CE';

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(1 / Math.sqrt(sq), sq);     // squash/stretch about the feet
  ctx.scale(s, s);
  ctx.rotate(face * 0.05);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const hy = -40;

  ctx.fillStyle = 'rgba(40,25,15,0.16)';
  ctx.beginPath(); ctx.ellipse(0, 1, 18, 4.5, 0, 0, 7); ctx.fill();

  // Legs, body, belly, arms — same lovey build as Yellow.
  ctx.fillStyle = BLU; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  [[-8, leg], [8, -leg]].forEach(([lx, dy]) => { _rr(ctx, lx - 4, -11 + dy, 8, 12 - dy, 3.5); ctx.fill(); ctx.stroke(); });
  ctx.fillStyle = BLU; _rr(ctx, -13, -27, 26, 20, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = BELLY; ctx.beginPath(); ctx.ellipse(0, -15, 7.5, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = BLU;
  [-13, 13].forEach((ax) => { ctx.beginPath(); ctx.ellipse(ax, -20, 4.5, 6, 0, 0, 7); ctx.fill(); ctx.stroke(); });

  // Ears (drawn before the head so it overlaps their bases). Angle = outward
  // splay + idle sway + a small walk flap + the spring-driven droop from the
  // player's ear physics (a jump drags the tips down; they lag and settle).
  const droop = o.earDroop || 0, sway = o.earSway || 0;
  let ang = 0.12 + Math.sin(t * 2.2) * 0.05 + Math.abs(leg) * 0.012 + droop;
  if (ang < 0.02) ang = 0.02;         // never cross inward past upright
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.translate(side * 5, hy - 9);
    ctx.rotate(sway);                  // horizontal trail (both ears lean the same way)
    ctx.scale(side, 1);                 // mirror the right ear onto the left
    ctx.rotate(ang);
    ctx.fillStyle = BLU; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.bezierCurveTo(-7, -14, -5, -27, 2, -32);
    ctx.bezierCurveTo(8, -34, 10, -27, 6, -23);
    ctx.bezierCurveTo(4, -18, 4, -8, 4, 2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = EARIN;
    ctx.beginPath();
    ctx.moveTo(-1, -2);
    ctx.bezierCurveTo(-3.5, -14, -2.5, -24, 2, -28);
    ctx.bezierCurveTo(5.5, -29, 6, -24, 4, -20);
    ctx.bezierCurveTo(2, -15, 2, -8, 1.5, -2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  });

  // Head.
  ctx.fillStyle = BLU; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, hy, 13.5, 14.5, 0, 0, 7); ctx.fill(); ctx.stroke();

  // Soft, sleepy stitched eyes (shallow curves), shifted toward facing.
  const ex = face * 1.2;
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  [-6.9, 6.9].forEach((dx) => { ctx.beginPath(); ctx.arc(dx + ex, hy - 4, 2.7, 0.72, 2.42); ctx.stroke(); });

  // Small stitched nose.
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(-2.6, hy + 2); ctx.lineTo(2.6, hy + 2);
  ctx.quadraticCurveTo(1.8, hy + 5.5, 0, hy + 6.3);
  ctx.quadraticCurveTo(-1.8, hy + 5.5, -2.6, hy + 2);
  ctx.closePath(); ctx.fill();

  // Y-shaped mouth: a stem from the nose forking into two.
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, hy + 6.3); ctx.lineTo(0, hy + 10);
  ctx.moveTo(0, hy + 10); ctx.lineTo(-3.4, hy + 13);
  ctx.moveTo(0, hy + 10); ctx.lineTo(3.4, hy + 13);
  ctx.stroke();

  // Faint cheeks.
  ctx.fillStyle = 'rgba(90,120,135,0.30)';
  [-8.5, 8.5].forEach((cxk) => { ctx.beginPath(); ctx.ellipse(cxk, hy + 3, 2.4, 1.6, 0, 0, 7); ctx.fill(); });

  ctx.restore();
}

// Grey Ted Ted — the grey rabbit. Same build as Blue, but neutral grey, brown
// oval eyes, a single brown triangle for the nose/mouth, and longer ears that
// flop much harder: the droop is amplified and capped at ~160° so a jump swings
// them nearly straight down, and the horizontal sway is exaggerated too.
function drawGreyRabbit(ctx, cx, feetY, s, o) {
  o = o || {};
  const face = o.face || 0, leg = o.leg || 0, sq = o.sq || 1, t = o.t || 0;
  const GREY = '#AEB2B4', OUT = '#3C4247', BROWN = '#6B4A2C', EARIN = '#D2D6D8', BELLY = '#C6CACC';

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(1 / Math.sqrt(sq), sq);
  ctx.scale(s, s);
  ctx.rotate(face * 0.05);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const hy = -40;

  ctx.fillStyle = 'rgba(40,25,15,0.16)';
  ctx.beginPath(); ctx.ellipse(0, 1, 18, 4.5, 0, 0, 7); ctx.fill();

  ctx.fillStyle = GREY; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  [[-8, leg], [8, -leg]].forEach(([lx, dy]) => { _rr(ctx, lx - 4, -11 + dy, 8, 12 - dy, 3.5); ctx.fill(); ctx.stroke(); });
  ctx.fillStyle = GREY; _rr(ctx, -13, -27, 26, 20, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = BELLY; ctx.beginPath(); ctx.ellipse(0, -15, 7.5, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = GREY;
  [-13, 13].forEach((ax) => { ctx.beginPath(); ctx.ellipse(ax, -20, 4.5, 6, 0, 0, 7); ctx.fill(); ctx.stroke(); });

  // Long floppy ears. Droop amplified and capped at ~160°; sway exaggerated.
  const droop = (o.earDroop || 0) * 4.5, sway = (o.earSway || 0) * 1.7;
  let ang = 0.26 + Math.sin(t * 2.4) * 0.07 + Math.abs(leg) * 0.014 + droop;
  if (ang > 2.79) ang = 2.79;
  if (ang < 0.05) ang = 0.05;
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.translate(side * 5, hy - 9);
    ctx.rotate(sway);
    ctx.scale(side, 1);
    ctx.rotate(ang);
    ctx.fillStyle = GREY; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.bezierCurveTo(-8, -16, -6, -32, 3, -38);
    ctx.bezierCurveTo(12, -41, 14, -30, 7, -26);
    ctx.bezierCurveTo(4, -20, 4, -9, 4, 2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = EARIN;
    ctx.beginPath();
    ctx.moveTo(-1, -2);
    ctx.bezierCurveTo(-4, -16, -3, -29, 3, -33);
    ctx.bezierCurveTo(8, -35, 8, -27, 4.5, -23);
    ctx.bezierCurveTo(2, -16, 2, -9, 1.5, -2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  });

  ctx.fillStyle = GREY; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, hy, 13.5, 14.5, 0, 0, 7); ctx.fill(); ctx.stroke();

  // Brown oval eyes.
  const ex = face * 1.2;
  ctx.fillStyle = BROWN;
  [-6.9, 6.9].forEach((dx) => {
    ctx.beginPath(); ctx.ellipse(dx + ex, hy - 4, 2.4, 3.2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(dx + ex - 0.8, hy - 5.2, 0.8, 0, 7); ctx.fill();
    ctx.fillStyle = BROWN;
  });

  // Single brown triangle: the whole nose/mouth.
  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.moveTo(-3.6, hy + 2); ctx.lineTo(3.6, hy + 2); ctx.lineTo(0, hy + 9);
  ctx.closePath(); ctx.fill();

  // Faint cheeks.
  ctx.fillStyle = 'rgba(90,90,95,0.22)';
  [-8.5, 8.5].forEach((c) => { ctx.beginPath(); ctx.ellipse(c, hy + 3, 2.4, 1.6, 0, 0, 7); ctx.fill(); });

  ctx.restore();
}

// Battenberg — the marzipan cake. A tall, boxy rounded-square body in marzipan
// tan with short squared-off arms and two stubby squared-off legs. His whole
// front is a 2x2 Battenberg checkerboard (soft pink / pale yellow, golden
// marzipan border) with two dot eyes and a small smile. Boxier and taller than
// the Ted Teds so he reads as a different body type. Ignores the ear params.
function drawBattenberg(ctx, cx, feetY, s, o) {
  o = o || {};
  const face = o.face || 0, leg = o.leg || 0, sq = o.sq || 1;
  const TAN = '#E7C9A0', OUT = '#3B2A1B', GOLD = '#C79A3A',
        PINK = '#E9A2AA', YEL = '#E7DE99', INK = '#1A140E';

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(1 / Math.sqrt(sq), sq);     // squash/stretch about the feet
  ctx.scale(s, s);
  ctx.rotate(face * 0.05);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  ctx.fillStyle = 'rgba(40,25,15,0.16)';
  ctx.beginPath(); ctx.ellipse(0, 1, 22, 4.5, 0, 0, 7); ctx.fill();

  ctx.strokeStyle = OUT; ctx.lineWidth = 2;

  // Squared-off stubby arms (behind the body so the inner ends tuck under it);
  // they counter-swing gently with the walk and reach out to the sides.
  ctx.fillStyle = TAN;
  [[-1, leg], [1, -leg]].forEach(([side, dy]) => {
    const ax = side > 0 ? 13 : -27.28;   // inner edge tucked at the body, growing outward
    _rr(ctx, ax, -33.3 + dy, 14.28, 9.6, 2); ctx.fill(); ctx.stroke();
  });

  // Two squared-off stubby legs.
  ctx.fillStyle = TAN;
  [[-9, leg], [9, -leg]].forEach(([lx, dy]) => { _rr(ctx, lx - 5, -10 + dy, 10, 8.8 - dy, 2); ctx.fill(); ctx.stroke(); });

  // Tall rounded-square body.
  ctx.fillStyle = TAN; _rr(ctx, -17, -58, 34, 48, 12); ctx.fill(); ctx.stroke();

  // Checkerboard face: 2x2 pink/yellow cells clipped to a rounded square, with
  // a golden marzipan border. (Yellow TL, pink TR, pink BL, yellow BR.)
  const cxf = 0, cyf = -35, hf = 14;
  ctx.save();
  _rr(ctx, cxf - hf, cyf - hf, hf * 2, hf * 2, 3); ctx.clip();
  [[-hf, -hf, YEL], [0, -hf, PINK], [-hf, 0, PINK], [0, 0, YEL]]
    .forEach(([qx, qy, col]) => { ctx.fillStyle = col; ctx.fillRect(cxf + qx, cyf + qy, hf, hf); });
  ctx.restore();
  _rr(ctx, cxf - hf, cyf - hf, hf * 2, hf * 2, 3); ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5; ctx.stroke();

  // Two dot eyes with a white highlight, shifted toward facing.
  const ex = face * 1.3;
  [-5.5, 5.5].forEach((dx) => {
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(dx + ex, cyf - 1, 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dx + ex - 0.8, cyf - 1.9, 0.9, 0, 7); ctx.fill();
  });

  // Small smile.
  ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(ex * 0.6, cyf + 5, 3.4, 0.25, Math.PI - 0.25); ctx.stroke();

  ctx.restore();
}

// The roster.
const CHARACTERS = [
  { id: 'yellow', name: 'Yellow Ted Ted', locked: false, draw: drawLion },
  { id: 'blue',   name: 'Blue Ted Ted',   locked: false, draw: drawBlueRabbit },
  { id: 'grey',   name: 'Grey Ted Ted',   locked: false, draw: drawGreyRabbit },
  { id: 'battenberg', name: 'Battenberg',  locked: false, draw: drawBattenberg,
    // Triple jump: two air jumps; the final one reaches 2x first-jump height.
    // Height scales with velocity^2, so velocity = sqrt(2) * JUMP_VELOCITY.
    jump: { airJumps: 2, lastAirJumpVel: Physics.JUMP_VELOCITY * Math.SQRT2 } },
];
