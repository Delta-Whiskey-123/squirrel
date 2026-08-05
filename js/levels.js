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

// Alpine — snowy peaks over a pale ground.
function drawAlpinePreview(ctx, x, y, w, h) {
  ctx.fillStyle = '#bfe3ff'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#9aa6bf';                                      // two mountains
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w * 0.28, y + h * 0.28); ctx.lineTo(x + w * 0.52, y + h); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w * 0.42, y + h); ctx.lineTo(x + w * 0.70, y + h * 0.40); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff7ec';                                      // snow caps
  ctx.beginPath(); ctx.moveTo(x + w * 0.28, y + h * 0.28); ctx.lineTo(x + w * 0.35, y + h * 0.44); ctx.lineTo(x + w * 0.21, y + h * 0.44); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w * 0.70, y + h * 0.40); ctx.lineTo(x + w * 0.78, y + h * 0.56); ctx.lineTo(x + w * 0.62, y + h * 0.56); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#eaf3fb'; ctx.fillRect(x, y + h * 0.82, w, h * 0.18); // snowy ground
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
  { id: 1, displayName: 'Training', theme: 'training', unlocked: true,  blurb: 'Woodland Path', preview: drawTrainingPreview },
  { id: 2, displayName: 'Alpine',   theme: 'alpine',   unlocked: false, blurb: 'Coming soon',   preview: drawAlpinePreview },
  { id: 3, displayName: 'Level 3',  theme: 'tba',      unlocked: false, blurb: 'Coming soon',   preview: drawComingSoonPreview },
  { id: 4, displayName: 'Level 4',  theme: 'tba',      unlocked: false, blurb: 'Coming soon',   preview: drawComingSoonPreview },
  { id: 5, displayName: 'Level 5',  theme: 'tba',      unlocked: false, blurb: 'Coming soon',   preview: drawComingSoonPreview },
  { id: 6, displayName: 'Level 6',  theme: 'tba',      unlocked: false, blurb: 'Coming soon',   preview: drawComingSoonPreview },
];
