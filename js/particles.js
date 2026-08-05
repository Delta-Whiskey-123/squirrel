'use strict';

/* particles.js — the ambient "pollen" layer: a gentle field of warm light motes
   drifting in the air, to give the flat sky some depth and a sense of moving air.

   This is scenery only — it never touches physics, input, or collision. It draws
   in world-aware SCREEN space: each speck lives at a screen anchor and slides
   opposite the camera by a per-band PARALLAX factor, so the bands separate from
   the ground as the squirrel walks (far bands barely move, near bands move most).

   Depth comes from BANDS. Each band is one bundle of consistent traits (parallax
   factor, size, alpha, drift, sway); the eye reads depth from the rate difference
   between them, not from any single speck. The pool is fixed and recycled — we
   allocate every speck ONCE at load, sized to the busiest possible setting, and
   only ever change how many are *drawn*. Nothing is created or destroyed at play
   time, so memory and GC pressure stay flat over a whole traversal.

   Runtime settings (enabled + density) mirror how Sfx owns its mute state: this
   module is the single source of truth, exposed through a small getter/setter API
   so a future pause-menu control is a few lines of wiring, not a refactor.

   Deliberately NOT here (future passes, seams left clean): the menu UI itself,
   persistence of the choice (see the PERSIST SEAM below), scenery silhouettes,
   speed streaks, and per-biome authored themes beyond the sensible default. */

const Particles = (function () {
  const VIEW_W = 960, VIEW_H = 540;
  const TWO_PI = Math.PI * 2;

  // A speck may drift this far past an edge before it wraps to the far side. Big
  // enough to hide the biggest speck + its sway swing so nothing pops mid-screen.
  const MARGIN = 24;
  const FIELD_W = VIEW_W + MARGIN * 2;
  const FIELD_H = VIEW_H + MARGIN * 2;

  // --- Runtime settings: the single source of truth (mirrors Sfx's mute) --------
  // `enabled` is the master gate the future menu's "Off" maps to. `density` is a
  // discrete, normalized step (NOT a raw count) that scales how many pooled specks
  // are active. `nearEnabled` gates the experimental in-front near band, off by
  // default. All three take effect on the very next frame with zero allocation.
  let enabled = true;
  let density = 'medium';     // shipped default: a fine, airy dusting (0.7 of pool)
  let nearEnabled = false;    // near band is opt-in (drawn in front of the world)

  // Density steps → fraction of each band's pool that is active. At HIGH (the
  // shipped default) the back bands total 60 specks; MEDIUM ~42; LOW ~24. See
  // band maxima. These are visible glints by design, not a whisper.
  const STEP_MUL = { low: 0.4, medium: 0.7, high: 1.0 };

  // PERSIST SEAM (not implemented this pass): to remember the player's choice,
  // load/save `enabled` + `density` here under a 'squirrel.particles' key, wrapped
  // in try/catch exactly like Sfx does with 'squirrel.mute'. Intentionally omitted.

  // --- Per-theme (per-level) config: base look for a biome, kept SEPARATE from
  //     the user's runtime settings above. Composition each frame is:
  //         active = bandMax * STEP_MUL[user density] * theme.baseDensity
  //     so the player's menu choice always scales the level's authored base. Only
  //     `training` is playable today, so its entry (and the identical default) is
  //     what actually renders now — it is tuned to be the good default. A future
  //     biome just adds an entry here; it never touches the runtime API. --------
  const THEMES = {
    // Bright warm-white → pale-gold motes. Deliberately brighter than the sky so
    // the glints actually read against #bfe3ff (a warm-cream tint was too low a
    // contrast to see). Cores lift toward near-white; the halo keeps a gold cast.
    training: { baseDensity: 1.0, palette: ['#fffdf5', '#fff4d2', '#ffe9b0', '#fff8e0'] },
    _default: { baseDensity: 1.0, palette: ['#fffdf5', '#fff4d2', '#ffe9b0', '#fff8e0'] },
  };
  let theme = THEMES._default;

  // --- Bands. factor: parallax (0 = pinned to screen/infinitely far, 1 = pinned
  //     to the world). size: drawn radius in px. alpha: base opacity before the
  //     per-speck twinkle. drift: slow constant air movement (gentle down + slight
  //     lateral). sway: amplitude of the per-speck sin() drift on x. max: pool
  //     size at HIGH density. Values sit inside the brief's suggested ranges and
  //     are ordered far→near so the closer a band, the bigger/bolder/faster it is
  //     — that ordering is what makes depth legible. Back-band totals: 32+28=60.
  //     Sizes sit in the brief's range for a fine, airy dusting; alphas are pushed
  //     ABOVE it (with a bright, near-white tint) so the small motes still read. */
  const far  = makeBand({ factor: 0.32, size: 1.95,  alpha: 0.34, driftX: -4, driftY:  7, sway: 5,  swaySpd: 0.5, max: 32 });
  const mid  = makeBand({ factor: 0.55, size: 3.375, alpha: 0.52, driftX: -6, driftY: 11, sway: 8,  swaySpd: 0.7, max: 28 });
  const near = makeBand({ factor: 0.80, size: 5.25,  alpha: 0.62, driftX: -9, driftY: 17, sway: 12, swaySpd: 0.9, max: 12 });
  const backBands = [far, mid];   // drawn behind the world (after sky, before level)
  const frontBands = [near];      // drawn in front (after the player), only if on

  let time = 0;                   // seconds, drives sway + twinkle (dt-accumulated)
  let prevCamX = null, prevCamY = 0;

  // Soft round "light" stamps, one per palette tint. Pre-rendered ONCE to little
  // offscreen canvases so the draw loop is a plain drawImage (no gradients, no
  // allocation per frame). A radial falloff reads as glow without a hard outline —
  // the one place the game's thick-outline rule is intentionally broken.
  let stamps = [];
  buildStamps(theme.palette);

  // Build a band: its config plus a fixed pool of specks scattered on screen.
  function makeBand(cfg) {
    const specks = new Array(cfg.max);
    for (let i = 0; i < cfg.max; i++) specks[i] = makeSpeck();
    cfg.specks = specks;
    return cfg;
  }

  // One speck, with all its per-speck randomness fixed up front so nothing pulses
  // in unison: independent sway phase/speed and an independent alpha-twinkle.
  function makeSpeck() {
    return {
      x: Math.random() * FIELD_W - MARGIN,
      y: Math.random() * FIELD_H - MARGIN,
      phase: Math.random() * TWO_PI,          // sway phase (x)
      swaySpd: 0.6 + Math.random() * 0.6,     // sway speed multiplier
      twPhase: Math.random() * TWO_PI,        // twinkle phase (alpha)
      twSpd: 0.5 + Math.random() * 0.9,       // twinkle speed
      sizeJit: 0.8 + Math.random() * 0.4,     // slight size variance
      stamp: (Math.random() * 4) | 0,         // which tint (clamped at draw time)
    };
  }

  function buildStamps(palette) {
    stamps = palette.map(function (color) {
      const R = 16, c = document.createElement('canvas');
      c.width = c.height = R * 2;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(R, R, 0, R, R, R);
      // Defined bright core (holds opacity through the middle) + a soft halo, so
      // each mote reads as a "glint of light", not a mushy smudge.
      grad.addColorStop(0.0, alphaColor(color, 1.0));
      grad.addColorStop(0.40, alphaColor(color, 0.85));
      grad.addColorStop(0.75, alphaColor(color, 0.35));
      grad.addColorStop(1.0, alphaColor(color, 0.0));
      g.fillStyle = grad;
      g.beginPath(); g.arc(R, R, R, 0, TWO_PI); g.fill();
      return c;
    });
  }

  // '#rrggbb' + alpha → 'rgba(r,g,b,a)'.
  function alphaColor(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // How many of a band's pooled specks are active this frame. Never exceeds the
  // pool; near is fully gated by its opt-in flag.
  function activeCount(band) {
    if (band === near && !nearEnabled) return 0;
    const n = Math.round(band.max * STEP_MUL[density] * theme.baseDensity);
    return n < 0 ? 0 : (n > band.max ? band.max : n);
  }

  // Advance the field. Called once per rendered frame with the real frame dt, so
  // motion is frame-rate independent. Cheap early-out when disabled — no work.
  function update(dt, camX, camY) {
    if (!enabled) return;
    time += dt;
    if (prevCamX === null) { prevCamX = camX; prevCamY = camY; } // first frame: no jump
    const dcx = camX - prevCamX, dcy = camY - prevCamY;
    prevCamX = camX; prevCamY = camY;

    stepBands(backBands, dcx, dcy, dt);
    stepBands(frontBands, dcx, dcy, dt);
  }

  function stepBands(bands, dcx, dcy, dt) {
    for (let b = 0; b < bands.length; b++) {
      const band = bands[b];
      const n = activeCount(band);
      const specks = band.specks;
      for (let i = 0; i < n; i++) {
        const s = specks[i];
        // Parallax: slide opposite the camera, scaled by depth. Plus slow drift.
        s.x += -dcx * band.factor + band.driftX * dt;
        s.y += -dcy * band.factor + band.driftY * dt;
        wrap(s);
      }
    }
  }

  // When a speck leaves an edge, send it to the opposite edge and re-randomize the
  // perpendicular axis + phase, so the field never looks like a repeating conveyor.
  function wrap(s) {
    if (s.x < -MARGIN)        { s.x += FIELD_W; s.y = Math.random() * FIELD_H - MARGIN; s.phase = Math.random() * TWO_PI; }
    else if (s.x > VIEW_W + MARGIN) { s.x -= FIELD_W; s.y = Math.random() * FIELD_H - MARGIN; s.phase = Math.random() * TWO_PI; }
    if (s.y < -MARGIN)        { s.y += FIELD_H; s.x = Math.random() * FIELD_W - MARGIN; s.phase = Math.random() * TWO_PI; }
    else if (s.y > VIEW_H + MARGIN) { s.y -= FIELD_H; s.x = Math.random() * FIELD_W - MARGIN; s.phase = Math.random() * TWO_PI; }
  }

  // Draw the far + mid bands — call after the sky fill, BEFORE level.draw(), so
  // specks sit behind every platform and never hide the squirrel.
  function drawBack(ctx) { drawBands(ctx, backBands); }

  // Draw the near band — call after the player, so it reads as "in front". No-op
  // unless the opt-in near flag is on; kept sparse + faint so it stays gentle.
  function drawFront(ctx) { if (nearEnabled) drawBands(ctx, frontBands); }

  function drawBands(ctx, bands) {
    if (!enabled || stamps.length === 0) return;
    ctx.save();
    for (let b = 0; b < bands.length; b++) {
      const band = bands[b];
      const n = activeCount(band);
      const specks = band.specks;
      for (let i = 0; i < n; i++) {
        const s = specks[i];
        // Sway is a draw-time offset (never accumulates); twinkle nudges alpha but
        // never blinks fully out — cozy, not strobing.
        const swayX = Math.sin(time * s.swaySpd + s.phase) * band.sway;
        const tw = 0.72 + 0.28 * Math.sin(time * s.twSpd + s.twPhase);
        const d = band.size * s.sizeJit * 2;   // stamp diameter
        ctx.globalAlpha = band.alpha * tw;
        ctx.drawImage(stamps[s.stamp % stamps.length], s.x + swayX - d / 2, s.y - d / 2, d, d);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // --- Public API (the future menu calls only these; nothing reaches in) --------
  function setEnabled(b) { enabled = !!b; }
  function isEnabled() { return enabled; }
  function setDensity(step) { if (STEP_MUL[step] != null) density = step; }   // 'low' | 'medium' | 'high'
  function getDensity() { return density; }
  function getDensitySteps() { return ['low', 'medium', 'high']; }
  function setNearEnabled(b) { nearEnabled = !!b; }
  function isNearEnabled() { return nearEnabled; }

  // Point the field at a level's theme (call on level load). Rebuilds the tint
  // stamps from the theme palette — rare and cheap, never per frame. Unknown
  // themes fall back to the default so a stray load never errors.
  function setTheme(name) {
    theme = THEMES[name] || THEMES._default;
    buildStamps(theme.palette);
  }

  return {
    update, drawBack, drawFront,
    setEnabled, isEnabled, setDensity, getDensity, getDensitySteps,
    setNearEnabled, isNearEnabled, setTheme,
  };
})();
