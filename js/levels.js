'use strict';

/* levels.js — the level roster and its card previews.

   Every fact about a level's identity lives here, in one array — the level-select
   UI reads it and hardcodes nothing. Each entry is:
     id           number threaded through to level load (see main.startPlaying)
     displayName  shown on the card
     theme        cosmetic tag for future per-level art/geometry (menu-only today)
     unlocked     whether the card is selectable (see SAVE HOOK below)
     blurb        one-line subtitle under the name
     preview      draw(ctx, x, y, w, h) — a small vector thumbnail in the game's
                  palette, drawn straight onto the canvas (no image files)

   Adding a real level later = edit its entry here (flip `unlocked`, set the
   name/blurb, point `preview` at a thumbnail) and author the geometry in level.js.

   SAVE HOOK: there is no save system yet, so `unlocked` is hardcoded. When a save
   file arrives, drive it from there instead, e.g.:
       LEVELS.forEach(l => { l.unlocked = save.unlocked.includes(l.id); });
   Level 1 (Training) should always start unlocked. */

// --- Card previews. Each fills the given (x, y, w, h) box; the caller clips it
//     to a rounded rect and dims it if the level is locked. ---

// Training — the Woodland Path: blue sky, grassy ground, a little tree and a coin.
function drawTrainingPreview(ctx, x, y, w, h) {
  ctx.fillStyle = '#96c8f2'; ctx.fillRect(x, y, w, h);            // sky (matches gameplay sky in main.js)
  const gy = y + h * 0.66;
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x, gy, w, h - (gy - y)); // dirt
  ctx.fillStyle = '#5bbf4a'; ctx.fillRect(x, gy, w, Math.max(6, h * 0.10)); // grass
  const tx = x + w * 0.30, ty = gy;                               // tree
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(tx - 5, ty - 26, 10, 26);
  ctx.fillStyle = '#3a8f2e'; ctx.beginPath(); ctx.arc(tx, ty - 34, 18, 0, 7); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#2f2233'; ctx.stroke();
  drawCoin(ctx, x + w * 0.68, gy - 18, 8, 'A');                   // gold coin (shared helper)
}

// Woodland Expert — the same Woodland world as Training, but a tall staircase
// of platforms climbing to a high gold coin (its signature: reach for the top).
function drawExpertPreview(ctx, x, y, w, h) {
  ctx.fillStyle = '#96c8f2'; ctx.fillRect(x, y, w, h);            // sky (matches gameplay)
  const gy = y + h * 0.74;
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x, gy, w, h - (gy - y)); // dirt
  ctx.fillStyle = '#5bbf4a'; ctx.fillRect(x, gy, w, Math.max(5, h * 0.09)); // grass
  const plat = (px, py, pw) => {                                  // a floating platform, brown with a grass cap
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(px, py, pw, 5);
    ctx.fillStyle = '#5bbf4a'; ctx.fillRect(px, py, pw, 2.5);
  };
  const pw = w * 0.17;
  [[0.06, 0.60], [0.30, 0.46], [0.54, 0.32], [0.76, 0.18]].forEach(([fx, fy]) => plat(x + w * fx, y + h * fy, pw));
  drawCoin(ctx, x + w * 0.145, y + h * 0.60 - 9, 6, 'C');        // bronze low
  drawCoin(ctx, x + w * 0.385, y + h * 0.46 - 9, 6, 'B');        // silver mid
  drawCoin(ctx, x + w * 0.845, y + h * 0.18 - 9, 7, 'A');        // gold high (the challenge)
}

// Placeholder — a neutral panel with a big question mark, for the empty slots.
function drawComingSoonPreview(ctx, x, y, w, h) {
  ctx.fillStyle = '#cdd5e0'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#9aa6bf';
  ctx.font = '700 ' + Math.round(h * 0.5) + 'px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('?', x + w / 2, y + h / 2 + 2);
}

// The roster: six slots. Only Training is unlocked today.
const LEVELS = [
  { id: 1, displayName: 'Training',        theme: 'training', unlocked: true, blurb: 'Woodland Path',        preview: drawTrainingPreview },
  { id: 2, displayName: 'Woodland Expert', theme: 'training', unlocked: true, blurb: 'The Long Climb · 50 coins', preview: drawExpertPreview },
  { id: 3, displayName: 'Level 3',  theme: 'tba',      unlocked: false, blurb: 'Coming soon',   preview: drawComingSoonPreview },
  { id: 4, displayName: 'Level 4',  theme: 'tba',      unlocked: false, blurb: 'Coming soon',   preview: drawComingSoonPreview },
  { id: 5, displayName: 'Level 5',  theme: 'tba',      unlocked: false, blurb: 'Coming soon',   preview: drawComingSoonPreview },
  { id: 6, displayName: 'Level 6',  theme: 'tba',      unlocked: false, blurb: 'Coming soon',   preview: drawComingSoonPreview },
];
