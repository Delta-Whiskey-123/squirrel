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

// Blue Ted Ted — the rabbit. Not built yet: a blue silhouette with long ears
// and a "?" to read as a locked, coming-soon slot until we design it.
function drawBlueLocked(ctx, cx, feetY, s, o) {
  o = o || {};
  const sq = o.sq || 1;
  const BLUE = '#7BA1DE', OUT = '#2F2233', IN = '#CDDBF3';

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(1 / Math.sqrt(sq), sq);
  ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  ctx.fillStyle = 'rgba(40,25,15,0.16)';
  ctx.beginPath(); ctx.ellipse(0, 1, 17, 4, 0, 0, 7); ctx.fill();

  ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.fillStyle = BLUE;
  [-7, 7].forEach((lx) => { _rr(ctx, lx - 4, -9, 8, 10, 3.5); ctx.fill(); ctx.stroke(); });

  ctx.beginPath(); ctx.ellipse(0, -18, 13, 14, 0, 0, 7); ctx.fill(); ctx.stroke();
  [-12, 12].forEach((ax) => { ctx.beginPath(); ctx.ellipse(ax, -20, 4, 6, 0, 0, 7); ctx.fill(); ctx.stroke(); });

  [[-6, -0.16], [6, 0.16]].forEach(([ex, rot]) => {
    ctx.save(); ctx.translate(ex, -46); ctx.rotate(rot);
    ctx.fillStyle = BLUE; _rr(ctx, -4, -28, 8, 30, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = IN; _rr(ctx, -2, -25, 4, 22, 2); ctx.fill();
    ctx.restore();
  });

  ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(0, -42, 13, 0, 7); ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#2F2233';
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, -42);

  ctx.restore();
}

// The roster. `locked` characters can be previewed but not chosen yet.
const CHARACTERS = [
  { id: 'yellow', name: 'Yellow Ted Ted', locked: false, draw: drawLion },
  { id: 'blue',   name: 'Blue Ted Ted',   locked: true,  draw: drawBlueLocked },
];
