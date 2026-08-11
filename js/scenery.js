'use strict';

/* scenery.js — the parallax landscape backdrop that sits behind the world.

   Pure procedural canvas drawing: no image files, so the game still runs from
   file://. Draws in SCREEN space, sliding opposite the camera by a per-layer
   PARALLAX factor so distance reads from the rate difference between layers
   (far barely moves, near moves most) — the same idea particles.js uses for
   pollen. Rendered order (back to front): clouds → mountains → mid hills →
   near hills → decorative trees. The playfield's own ground (level.js) draws
   in front of all of this, so the backdrop never touches gameplay.

   Style: flat, high-saturation, thick dark outline on the nearest shapes,
   fading to lighter/un-outlined in the distance — a Hey-Duggee-ish landscape in
   the bright spring-green palette. Composition matches the approved "2B" study:
   distinct separated pastel peaks (dusty-pink centrepiece), snow on the tall
   ones only, and two-tone rolling green that overlaps the mountain feet.

   Everything is generated ONCE at load with a fixed seed (peaks, speckles,
   cloud shapes), so nothing shimmers frame to frame. The only time-varying
   input is a slow cloud drift, disabled under prefers-reduced-motion. */

const Scenery = (function () {
  const TWO_PI = Math.PI * 2;

  // --- palette (shared hexes with the rest of the game where it matters) ------
  const SNOW   = '#fbf7f0';
  const CLOUD  = '#ffffff';
  const CLOUD_SH = 'rgba(188,216,239,0.85)';  // pale-blue underside shadow (hugs the cloud outline)
  const MID_FILL = '#9cc78a', MID_OUT = 'rgba(95,122,84,0.5)';
  const NEAR_FILL = '#6fb85a', NEAR_OUT = '#2f2233';
  const TREE_L = '#3f9e57', TREE_D = '#2f8f4a', TRUNK = '#8a5a2b';
  const OUTLINE = '#2f2233';

  // --- parallax factors: 0 = infinitely far (pinned), 1 = moves with the world.
  const F_CLOUD = 0.06, F_MTN = 0.15, F_MID = 0.35, F_NEAR = 0.60;

  // --- vertical anchors (screen y at ground-view, camY = 0) -------------------
  const MTN_BASE = 372;              // where the mountain feet sit
  // Mountains fill downward (a solid "skirt" in each peak's own colour) to this
  // line in layer space. It is set low enough that the rolling green always
  // overlaps it at every jump height (the green pans down faster than the
  // mountains), so no sky ever opens between the peaks and the hills.
  const SKIRT_BOTTOM = 480;
  const MID_CFG  = { unit: 520, baseY: 348, amp: 25.3, p1: 0.6, p2: 2.1, f: F_MID,  fill: MID_FILL,  out: MID_OUT,  lw: 2.0 };
  const NEAR_CFG = { unit: 470, baseY: 420, amp: 26, p1: 1.9, p2: 0.4, f: F_NEAR, fill: NEAR_FILL, out: NEAR_OUT, lw: 2.6 };

  const reduced = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || false;

  // --- deterministic RNG so the generated set is stable across frames/loads ----
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // Darken a #rrggbb toward black by `mul`, at alpha — used for slope speckles.
  function shade(hex, mul, alpha) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * mul);
    const g = Math.round(((n >> 8) & 255) * mul);
    const b = Math.round((n & 255) * mul);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // --- generated data ---------------------------------------------------------
  // One repeating MOUNTAIN unit. Peaks live wholly inside [0, unit] so the seam
  // always falls in a valley and tiles invisibly. @(cx, w, h, colour, snow).
  const MTN_UNIT = 1000;
  const PEAK_DEFS = [
    [120, 110, 150, '#b8a0d0', 1], // purple, tall, snow
    [305, 105, 112, '#a8a6d6', 0], // periwinkle, short
    [500, 145, 188, '#d8b9c4', 1], // dusty-pink centrepiece, tallest, snow
    [695, 110, 128, '#c3a6cf', 0], // mauve, medium
    [875, 100, 150, '#b0a0d6', 1], // blue-purple, tall, snow
  ];
  let peaks = [];

  // One repeating CLOUD unit. Clouds live inside [0, unit]. @(cx, cy, scale).
  const CLOUD_UNIT = 760;
  const CLOUD_DEFS = [[150, 82, 26], [520, 110, 22]];

  const TREE_SPACING = 470;  // decorative trees, one per span, along the near layer

  function build(seed) {
    const rng = mulberry32(seed | 0);
    peaks = PEAK_DEFS.map(function (d) {
      const cx = d[0], w = d[1], h = d[2], fill = d[3], snow = !!d[4];
      // Speckles cover the WHOLE extended triangle (apex down to the skirt line),
      // not just the visible peak, so the texture keeps going at the same density
      // when a high camera reveals the lower slopes. Depth is area-uniform (∝ d),
      // so the wide base gets its fair share instead of looking sparse.
      const extH = SKIRT_BOTTOM - (MTN_BASE - h); // apex → skirt depth (108 + h)
      const start = 0.42 * h;                     // leave the upper peak clean, as before
      const end = 0.98 * extH;
      const span = end * end - start * start;
      const specks = [];
      const n = Math.round(w * span / (h * 900));
      for (let i = 0; i < n; i++) {
        const dd = Math.sqrt(start * start + rng() * span); // area-uniform depth from apex
        const half = w * (dd / h) * 0.82;
        specks.push({ dx: (rng() * 2 - 1) * half, dy: dd, r: 1.4 + rng() * 1.4 });
      }
      return { cx: cx, w: w, h: h, fill: fill, speck: shade(fill, 0.78, 0.42), snow: snow, specks: specks };
    });
  }

  // --- periodic hill height (seamless because it is globally periodic) --------
  function hillY(lx, cfg) {
    const t = lx / cfg.unit * TWO_PI;
    return cfg.baseY - cfg.amp * (0.55 + 0.28 * Math.sin(t + cfg.p1) + 0.17 * Math.sin(2 * t + cfg.p2));
  }

  // --- shape drawers ----------------------------------------------------------
  // The cloud silhouette (puffy lobes + flat base), filled in the current style.
  const CLOUD_LOBES = [[-1.5, 0.15, 0.75], [-0.55, -0.25, 1.05], [0.5, -0.4, 1.2], [1.5, -0.05, 0.85], [0.55, 0.12, 1.05]];
  function cloudShape(ctx, cx, cy, s) {
    for (let i = 0; i < CLOUD_LOBES.length; i++) {
      const l = CLOUD_LOBES[i];
      ctx.beginPath(); ctx.arc(cx + l[0] * s, cy + l[1] * s, l[2] * s, 0, TWO_PI); ctx.fill();
    }
    ctx.fillRect(cx - 1.8 * s, cy - 0.05 * s, 3.6 * s, 0.7 * s);
  }
  function drawCloud(ctx, cx, cy, s) {
    // Underside shadow: the SAME silhouette dropped a few px, so the grey that
    // peeks out below the white hugs the cloud's own bottom outline — no separate
    // ellipse blob, no blue tint.
    ctx.fillStyle = CLOUD_SH;
    cloudShape(ctx, cx, cy + 0.16 * s, s);
    ctx.fillStyle = CLOUD;
    cloudShape(ctx, cx, cy, s);
  }

  function drawPeak(ctx, cx, baseY, skirtY, pk) {
    const apexY = baseY - pk.h;
    // Continue the triangle's own edges straight down to skirtY at the SAME
    // slope (w per h), so the mountain extends as a widening triangle rather
    // than a flat-topped block. Neighbours merge low down, filling the gap.
    const w2 = pk.w * (skirtY - apexY) / pk.h;
    ctx.beginPath();
    ctx.moveTo(cx - w2, skirtY); ctx.lineTo(cx, apexY); ctx.lineTo(cx + w2, skirtY); ctx.closePath();
    ctx.fillStyle = pk.fill; ctx.fill();
    ctx.fillStyle = pk.speck;
    for (let i = 0; i < pk.specks.length; i++) {
      const s = pk.specks[i];
      ctx.beginPath(); ctx.arc(cx + s.dx, apexY + s.dy, s.r, 0, TWO_PI); ctx.fill();
    }
    if (pk.snow) {
      const h = pk.h, w = pk.w, capH = h * 0.34, capY = apexY + capH, cw = w * (capH / h);
      ctx.beginPath();
      ctx.moveTo(cx, apexY);
      ctx.lineTo(cx + cw, capY);
      ctx.lineTo(cx + cw * 0.45, capY - h * 0.05);
      ctx.lineTo(cx, capY + h * 0.06);
      ctx.lineTo(cx - cw * 0.45, capY - h * 0.04);
      ctx.lineTo(cx - cw, capY);
      ctx.closePath();
      ctx.fillStyle = SNOW; ctx.fill();
    }
  }

  function drawHillBand(ctx, camX, camY, viewW, viewH, cfg) {
    const f = cfg.f, step = 6, vy = -camY * f;
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (let x = 0; x <= viewW; x += step) ctx.lineTo(x, hillY(x + camX * f, cfg) + vy);
    ctx.lineTo(viewW, viewH); ctx.closePath();
    ctx.fillStyle = cfg.fill; ctx.fill();
    // outline the crest only
    ctx.beginPath();
    for (let x = 0; x <= viewW; x += step) {
      const y = hillY(x + camX * f, cfg) + vy;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineWidth = cfg.lw; ctx.strokeStyle = cfg.out; ctx.lineJoin = 'round'; ctx.stroke();
  }

  function drawPine(ctx, x, baseY, sc) {
    ctx.lineWidth = 2.2; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round';
    const tw = 6 * sc;
    ctx.fillStyle = TRUNK; ctx.fillRect(x - tw / 2, baseY - 8 * sc, tw, 12 * sc); ctx.strokeRect(x - tw / 2, baseY - 8 * sc, tw, 12 * sc);
    const tiers = [[0, 34, 26, TREE_D], [-12, 26, 21, TREE_L], [-23, 20, 16, TREE_L]];
    for (let i = 0; i < tiers.length; i++) {
      const ti = tiers[i], cyq = baseY - 8 * sc + ti[0] * sc, half = ti[1] * sc / 2, th = ti[2] * sc;
      ctx.beginPath(); ctx.moveTo(x - half, cyq); ctx.lineTo(x, cyq - th); ctx.lineTo(x + half, cyq); ctx.closePath();
      ctx.fillStyle = ti[3]; ctx.fill(); ctx.stroke();
    }
  }

  function drawBush(ctx, x, baseY, sc) {
    ctx.lineWidth = 2.2; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round';
    ctx.fillStyle = TRUNK; ctx.fillRect(x - 3 * sc, baseY - 9 * sc, 6 * sc, 11 * sc); ctx.strokeRect(x - 3 * sc, baseY - 9 * sc, 6 * sc, 11 * sc);
    const lobes = [[-11, -9, 12, TREE_D], [11, -9, 12, TREE_D], [0, -20, 15, TREE_L], [-3, -10, 14, TREE_L]];
    for (let i = 0; i < lobes.length; i++) {
      const l = lobes[i], cxq = x + l[0] * sc, cyq = baseY - 9 * sc + l[1] * sc, rr = l[2] * sc;
      ctx.beginPath(); ctx.arc(cxq, cyq, rr, 0, TWO_PI); ctx.fillStyle = l[3]; ctx.fill(); ctx.stroke();
    }
  }

  // --- the whole backdrop -----------------------------------------------------
  function drawBack(ctx, camX, camY, viewW, viewH) {
    // 1) Clouds (slow drift on top of parallax; frozen under reduced-motion).
    const drift = reduced ? 0 : performance.now() * 0.006;
    let coff = -(((camX * F_CLOUD + drift) % CLOUD_UNIT));
    const cvy = -camY * F_CLOUD;
    for (let ux = coff - CLOUD_UNIT; ux < viewW; ux += CLOUD_UNIT) {
      for (let i = 0; i < CLOUD_DEFS.length; i++) {
        const c = CLOUD_DEFS[i];
        drawCloud(ctx, ux + c[0], c[1] + cvy, c[2]);
      }
    }

    // 2) Mountains — each peak is a triangle whose edges continue straight down
    //    to a fixed skirt line, so a high jump (green pans off faster than the
    //    peaks) never opens sky beneath them and there are no flat/square bases.
    //    Shortest first so lower overlaps layer cleanly; tiled by MTN_UNIT with
    //    the seam falling in a valley.
    const mBase = MTN_BASE - camY * F_MTN;
    const mSkirt = SKIRT_BOTTOM - camY * F_MTN;
    const moff = -((camX * F_MTN) % MTN_UNIT);
    const order = peaks.slice().sort(function (a, b) { return a.h - b.h; });
    for (let ux = moff - MTN_UNIT; ux < viewW; ux += MTN_UNIT) {
      for (let i = 0; i < order.length; i++) drawPeak(ctx, ux + order[i].cx, mBase, mSkirt, order[i]);
    }

    // 3) Two-tone rolling green (mid behind, near in front) — overlaps the feet.
    drawHillBand(ctx, camX, camY, viewW, viewH, MID_CFG);
    drawHillBand(ctx, camX, camY, viewW, viewH, NEAR_CFG);

    // 4) Decorative trees riding the near layer, planted on its crest so they
    //    scroll with the hills and stay behind the playfield.
    const fN = F_NEAR, vy = -camY * fN;
    const kStart = Math.floor((camX * fN - viewW) / TREE_SPACING);
    const kEnd = Math.ceil((camX * fN + viewW) / TREE_SPACING);
    for (let k = kStart; k <= kEnd; k++) {
      const p = k * TREE_SPACING + 60;             // position in near-layer space
      const sx = p - camX * fN;
      if (sx < -60 || sx > viewW + 60) continue;
      const hash = (Math.imul(k ^ 0x9e37, 2654435761) >>> 0);
      const sc = 1.05 + (hash % 30) / 100;         // 1.05 .. 1.34
      const baseY = hillY(p, NEAR_CFG) + vy + 6;   // nestle just into the crest
      if ((hash & 1) === 0) drawPine(ctx, sx, baseY, sc); else drawBush(ctx, sx, baseY, sc);
    }
  }

  build(1337);
  return { init: function (s) { build(s); }, drawBack: drawBack };
})();
