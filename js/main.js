'use strict';

/* main.js — bootstrap, canvas letterboxing, and the fixed-timestep game loop.

   The physics run at a locked 60 Hz using an accumulator, so the game behaves
   identically regardless of the monitor's refresh rate. Rendering happens once
   per animation frame with whatever the latest simulated state is. */

(function () {
  const VIEW_W = 960;
  const VIEW_H = 540;
  const STEP = 1 / 60;          // fixed physics step, seconds
  const MAX_FRAME = 0.25;       // clamp huge gaps (e.g. tab was backgrounded)

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // --- Letterbox: scale the canvas element (CSS pixels) to fit the window
  //     while preserving the 16:9 aspect. The drawing buffer stays 960x540. ---
  function resize() {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    canvas.style.width  = Math.round(VIEW_W * scale) + 'px';
    canvas.style.height = Math.round(VIEW_H * scale) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // --- World ---
  const level = new Level();
  const player = new Player(level);
  const camera = new Camera(VIEW_W, VIEW_H);
  camera.snapTo(level, player);
  Input.attach();
  Sfx.attach();

  // --- Screen state ---
  // 'select' -> 'instructions' -> 'playing' -> 'gameComplete', with 'pausemenu'
  // reachable from play via Escape. Select picks the character; instructions
  // shows the controls; gameComplete celebrates finishing the final level.
  // The full state machine (splash/hub/...) arrives in M4.
  let screen = 'select';
  let blink = 0;       // drives the gentle pulse on the prompts
  let selIndex = 0;    // highlighted character in the select row
  let lockShake = 0;   // brief wobble when a locked character is confirmed
  let pauseIndex = 0;  // highlighted button in the pause menu (0 resume, 1 restart)
  let gems = { A: 0, B: 0, C: 0 }; // collected count per tier (reset each run)
  let gcState = null;              // end-screen animation state (see startGameComplete)

  // Badge art for the end screen. Loaded from disk; if it can't be found we draw
  // a simple placeholder instead and log where we looked — never crash.
  const BADGE_PATH = 'Tiles/Assets/badge.png';
  const badgeImg = new Image();
  let badgeReady = false, badgeFailed = false;
  badgeImg.onload = () => { badgeReady = true; };
  badgeImg.onerror = () => {
    badgeFailed = true;
    console.warn('[Squirrel] Badge image not found at "' + BADGE_PATH +
      '" (resolved to ' + badgeImg.src + '). Drawing a placeholder badge instead.');
  };
  badgeImg.src = BADGE_PATH;

  function startPlaying() {
    player.reset();
    camera.snapTo(level, player);
    Input.clearAll();  // drop any key state left over from the menus
    gems = { A: 0, B: 0, C: 0 };
    level.resetGems();
    level.resetExit();
    screen = 'playing';
  }

  function resumeGame() {
    Input.consumeJump(); // don't let the confirming Space fire a jump on resume
    screen = 'playing';
  }

  // The end-of-game celebration. Triggered when the player walks out through the
  // final level's door. Snapshots the run's gem counts, starts the count-up and
  // confetti, and plays the fanfare (audio is already unlocked, as reaching the
  // exit is a gameplay event). No progress is saved.
  function startGameComplete() {
    Input.clearAll();
    gcState = {
      t: 0,
      disp: { A: 0, B: 0, C: 0 },   // numbers currently shown (climb toward gems[])
      order: ['A', 'B', 'C'],       // count up gold, then silver, then bronze
      idx: 0,
      nextAt: 0.5,                  // first tick after a short beat (fanfare opens)
      doneAt: null,                 // t when every count has settled
      btnAlpha: 0,                  // home button fades in after the counts finish
      btnActive: false,             // ENTER/SPACE only returns home once true
      confetti: makeConfetti(),
    };
    Sfx.fanfare();
    screen = 'gameComplete';
  }

  // Advance the end-screen: fall the confetti, climb the counts (one soft tick
  // per number, one tier at a time), then reveal the home button after a beat.
  function updateGameComplete(dt) {
    const s = gcState;
    s.t += dt;

    for (const p of s.confetti) {
      p.vy += 60 * dt;
      p.x += p.vx * dt + Math.sin(s.t * p.swaySpd + p.swayPh) * p.sway * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > VIEW_H + 20) { p.y = -20; p.vy = 20 + Math.random() * 30; p.x = Math.random() * VIEW_W; }
    }

    const INTERVAL = 0.16, GAP = 0.4, BEAT = 0.8;
    while (s.doneAt === null && s.idx < 3 && s.t >= s.nextAt) {
      const tier = s.order[s.idx];
      if (s.disp[tier] < gems[tier]) {
        Sfx.tick(s.disp[tier]);
        s.disp[tier]++;
        s.nextAt += INTERVAL;
      } else {
        s.idx++;
        s.nextAt += GAP;
      }
      if (s.idx >= 3) s.doneAt = s.t;
    }

    if (s.doneAt !== null && s.t - s.doneAt >= BEAT) {
      s.btnActive = true;
      s.btnAlpha = Math.min(1, s.btnAlpha + dt * 2.5);
    }
  }

  // A fresh set of gently falling confetti flecks in the game's palette.
  function makeConfetti() {
    const colors = ['#f5c542', '#cfd7e0', '#cd7f32', '#e8622c', '#3a8f2e'];
    const bits = [];
    for (let i = 0; i < 110; i++) {
      bits.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * -VIEW_H,        // start spread out above the screen
        vx: (Math.random() - 0.5) * 20,
        vy: 20 + Math.random() * 40,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 4,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        sway: 12 + Math.random() * 18,
        swaySpd: 1 + Math.random() * 2,
        swayPh: Math.random() * 6.28,
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
    return bits;
  }

  // Pick up any gem within a generous radius of the player's centre.
  function collectGems() {
    const cx = player.cx, cy = player.cy, R2 = 40 * 40;
    for (const g of level.gems) {
      if (g.taken) continue;
      const dx = cx - g.x, dy = cy - g.y;
      if (dx * dx + dy * dy < R2) { g.taken = true; gems[g.tier]++; Sfx.collect(g.tier); }
    }
  }

  const CONFIRM = (c) => c === 'Enter' || c === 'NumpadEnter' || c === 'Space';
  const LEFT = (c) => c === 'ArrowLeft' || c === 'KeyA';
  const RIGHT = (c) => c === 'ArrowRight' || c === 'KeyD';

  window.addEventListener('keydown', (e) => {
    // Escape opens/closes the pause menu during play.
    if (e.code === 'Escape') {
      if (screen === 'playing') { e.preventDefault(); pauseIndex = 0; screen = 'pausemenu'; }
      else if (screen === 'pausemenu') { e.preventDefault(); resumeGame(); }
      return;
    }
    if (screen === 'pausemenu') {
      if (LEFT(e.code))  { e.preventDefault(); pauseIndex = 0; }
      else if (RIGHT(e.code)) { e.preventDefault(); pauseIndex = 1; }
      else if (CONFIRM(e.code)) {
        e.preventDefault();
        if (pauseIndex === 0) resumeGame();
        else screen = 'select';                       // restart from character select
      }
      return;
    }
    if (screen === 'select') {
      if (LEFT(e.code))  { e.preventDefault(); selIndex = Math.max(0, selIndex - 1); }
      else if (RIGHT(e.code)) { e.preventDefault(); selIndex = Math.min(CHARACTERS.length - 1, selIndex + 1); }
      else if (CONFIRM(e.code)) {
        e.preventDefault();
        const c = CHARACTERS[selIndex];
        if (c.locked) lockShake = 0.35;               // can't pick this one yet
        else { player.setCharacter(c); screen = 'instructions'; }
      }
      return;
    }
    if (screen === 'gameComplete') {
      if (CONFIRM(e.code) && gcState && gcState.btnActive) {
        e.preventDefault();
        gcState = null;
        screen = 'select';   // straight back to character select — not a hub
      }
      return;
    }
    if (CONFIRM(e.code) && (screen === 'instructions' || screen === 'complete')) {
      e.preventDefault();
      startPlaying();
      return;
    }
  });

  // --- Fixed-timestep loop ---
  let last = performance.now();
  let acc = 0;
  let paused = false;

  // Auto-pause if the window loses focus so nothing runs away in the background.
  window.addEventListener('blur', () => { paused = true; });
  window.addEventListener('focus', () => { paused = false; last = performance.now(); });

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    blink += dt;
    if (lockShake > 0) lockShake -= dt;

    if (!paused && screen === 'playing') {
      acc += dt;
      while (acc >= STEP) {
        Input.update(STEP);
        player.update(STEP);
        camera.update(level, player, STEP);
        collectGems();
        // Walked out the final door? Roll the end-of-game celebration.
        if (level.updateExit(player, STEP)) { startGameComplete(); break; }
        acc -= STEP;
      }
    }

    if (screen === 'gameComplete') updateGameComplete(dt);

    render();
    requestAnimationFrame(frame);
  }

  function render() {
    // Sky.
    ctx.fillStyle = '#bfe3ff';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    level.draw(ctx, camera.x, camera.y, VIEW_W, VIEW_H);
    player.draw(ctx, camera.x, camera.y);

    if (screen === 'playing' || screen === 'pausemenu') drawHud();
    if (Sfx.isMuted()) drawMuteIcon();

    if (screen === 'select') {
      drawSelect();
    } else if (screen === 'instructions') {
      drawInstructions();
    } else if (screen === 'complete') {
      drawComplete();
    } else if (screen === 'gameComplete') {
      drawGameComplete();
    } else if (screen === 'pausemenu') {
      drawPause();
    } else if (paused) {
      ctx.fillStyle = 'rgba(20,10,40,0.45)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  // Small speaker-with-a-slash, top-right, shown while sound is muted.
  function drawMuteIcon() {
    const x = VIEW_W - 40, y = 24;
    ctx.fillStyle = 'rgba(47,34,51,0.85)';
    ctx.beginPath();
    ctx.moveTo(x, y - 4); ctx.lineTo(x + 5, y - 4); ctx.lineTo(x + 11, y - 9);
    ctx.lineTo(x + 11, y + 9); ctx.lineTo(x + 5, y + 4); ctx.lineTo(x, y + 4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(47,34,51,0.85)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + 15, y - 8); ctx.lineTo(x + 23, y + 8); ctx.stroke();
  }

  // Top-left counter: a coin per tier with its running collected count.
  function drawHud() {
    let x = 20;
    for (const tier of ['A', 'B', 'C']) {
      drawCoin(ctx, x + 11, 26, 11, tier);
      ctx.fillStyle = '#2f2233';
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('×' + gems[tier], x + 28, 27);
      x += 92;
    }
  }

  // The pause menu: two big buttons — Resume, or Start over (back to select).
  // Left/Right highlights, Space/Enter confirms, Escape resumes.
  function drawPause() {
    ctx.fillStyle = 'rgba(20,10,40,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const pw = 560, ph = 300, px = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2;
    roundRect(px, py, pw, ph, 28);
    ctx.fillStyle = '#fff7ec'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#2f2233'; ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8622c'; ctx.font = '700 40px system-ui, sans-serif';
    ctx.fillText('Paused', VIEW_W / 2, py + 50);

    const bw = 200, bh = 130, gap = 40, by = py + 96;
    const buttons = [
      { label: 'Resume',     color: '#3a8f2e', icon: 'play' },
      { label: 'Start over', color: '#2f7fd6', icon: 'restart' },
    ];
    buttons.forEach((b, i) => {
      const bx = VIEW_W / 2 + (i === 0 ? -(bw + gap / 2) : gap / 2);
      roundRect(bx, by, bw, bh, 18);
      ctx.fillStyle = '#f3e7d2'; ctx.fill();
      if (i === pauseIndex) { ctx.lineWidth = 5; ctx.strokeStyle = b.color; }
      else { ctx.lineWidth = 3; ctx.strokeStyle = '#d8c9ad'; }
      ctx.stroke();

      const cx = bx + bw / 2, cyi = by + 48;
      ctx.fillStyle = b.color; ctx.strokeStyle = b.color;
      if (b.icon === 'play') drawPlayIcon(cx, cyi); else drawRestartIcon(cx, cyi);

      ctx.fillStyle = '#2f2233'; ctx.font = '600 24px system-ui, sans-serif';
      ctx.fillText(b.label, cx, by + bh - 28);
    });

    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(blink * 2.2));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#8a7f72'; ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText('Esc to resume', VIEW_W / 2, py + ph - 26);
    ctx.globalAlpha = 1;
  }

  function drawPlayIcon(cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy - 17); ctx.lineTo(cx - 13, cy + 17); ctx.lineTo(cx + 19, cy);
    ctx.closePath(); ctx.fill();
  }

  function drawRestartIcon(cx, cy) {
    const r = 15, a0 = -0.9;
    ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, Math.PI * 1.35); ctx.stroke();
    const hx = cx + r * Math.cos(a0), hy = cy + r * Math.sin(a0), tan = a0 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + 9 * Math.cos(tan + 0.5), hy + 9 * Math.sin(tan + 0.5));
    ctx.lineTo(hx + 9 * Math.cos(tan - 0.5), hy + 9 * Math.sin(tan - 0.5));
    ctx.closePath(); ctx.fill();
  }

  // Character select: a big animated preview of the highlighted friend, with a
  // row of choosable slots below. Left/Right highlights, Space/Enter confirms.
  function drawSelect() {
    ctx.fillStyle = 'rgba(20,10,40,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const pw = 720, ph = 470, px = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2;
    roundRect(px, py, pw, ph, 28);
    ctx.fillStyle = '#fff7ec'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#2f2233'; ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8622c';
    ctx.font = '700 40px system-ui, sans-serif';
    ctx.fillText('Choose your friend', VIEW_W / 2, py + 46);

    const sel = CHARACTERS[selIndex];

    // Big animated preview (gentle idle breathing; ears sway via t).
    const sq = 1 + Math.sin(blink * 3) * 0.03;
    sel.draw(ctx, VIEW_W / 2, py + 262, 2.2, { face: 0, leg: 0, sq, t: blink });

    ctx.fillStyle = sel.locked ? '#8a7f72' : '#2f2233';
    ctx.font = '700 32px system-ui, sans-serif';
    ctx.fillText(sel.name, VIEW_W / 2, py + 288);

    // Row of choosable slots.
    const gap = 40;
    const maxRow = pw - 56;                                    // keep a margin inside the card
    const sw = Math.min(150, (maxRow - gap * (CHARACTERS.length - 1)) / CHARACTERS.length);
    const sh = sw * (2 / 3);                                   // preserve the 3:2 slot shape
    const total = CHARACTERS.length * sw + (CHARACTERS.length - 1) * gap;
    const row = VIEW_W / 2 - total / 2;
    CHARACTERS.forEach((c, i) => {
      let bx = row + i * (sw + gap);
      const by = py + 316;
      if (c.locked && i === selIndex && lockShake > 0) bx += Math.sin(lockShake * 50) * 4;

      roundRect(bx, by, sw, sh, 16);
      ctx.fillStyle = '#f3e7d2'; ctx.fill();
      if (i === selIndex) { ctx.lineWidth = 5; ctx.strokeStyle = c.locked ? '#9aa6bf' : '#3a8f2e'; }
      else { ctx.lineWidth = 3; ctx.strokeStyle = '#d8c9ad'; }
      ctx.stroke();

      c.draw(ctx, bx + sw / 2, by + sh - 12, 0.72, { face: 0, leg: 0, sq: 1, t: blink });
      if (c.locked) drawLock(bx + sw - 22, by + 16);
    });

    // Prompt.
    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(blink * 2.2));
    ctx.globalAlpha = pulse;
    if (sel.locked) {
      ctx.fillStyle = '#9aa6bf'; ctx.font = '700 26px system-ui, sans-serif';
      ctx.fillText('Coming soon', VIEW_W / 2, py + ph - 30);
    } else {
      ctx.fillStyle = '#3a8f2e'; ctx.font = '700 28px system-ui, sans-serif';
      ctx.fillText('Press SPACE to choose', VIEW_W / 2, py + ph - 30);
    }
    ctx.globalAlpha = 1;
  }

  // A small padlock badge for locked character slots.
  function drawLock(x, y) {
    ctx.strokeStyle = '#2f2233'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, 4.5, Math.PI, 0); ctx.stroke();
    roundRect(x - 7, y, 14, 11, 2.5);
    ctx.fillStyle = '#6b6472'; ctx.fill(); ctx.stroke();
  }

  // Placeholder finish screen (the badge celebration proper comes in a later
  // milestone). A big cheerful card; press Enter to run it again.
  function drawComplete() {
    ctx.fillStyle = 'rgba(20,10,40,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const pw = 620, ph = 280;
    const px = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2;
    roundRect(px, py, pw, ph, 28);
    ctx.fillStyle = '#fff7ec'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#2f2233'; ctx.stroke();

    ctx.fillStyle = '#3a8f2e';
    ctx.font = '700 52px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('You made it!', VIEW_W / 2, py + 92);

    ctx.fillStyle = '#2f2233';
    ctx.font = '600 26px system-ui, sans-serif';
    ctx.fillText('You reached the hut', VIEW_W / 2, py + 150);

    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(blink * 2.2));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#e8622c';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillText('Press ENTER to play again', VIEW_W / 2, py + ph - 46);
    ctx.globalAlpha = 1;
  }

  // The end-of-game badge screen: dimmed world, gentle confetti, a spoken
  // headline, the earned badge, the run's per-tier coin counts (climbing), and a
  // wordless home button that appears after a beat to return to character select.
  function drawGameComplete() {
    const s = gcState;

    ctx.fillStyle = 'rgba(20,10,40,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawConfetti(s.confetti);

    const pw = 720, ph = 470, px = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2;
    roundRect(px, py, pw, ph, 28);
    ctx.fillStyle = '#fff7ec'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#2f2233'; ctx.stroke();

    // Headline — read aloud by the grown-up; wrapped to fit the card.
    ctx.fillStyle = '#2f2233';
    ctx.font = '700 33px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    wrapText("Well done, squirrels! You've earned your coin-collecting badge!",
      VIEW_W / 2, py + 52, pw - 100, 40);

    // The earned badge (real art, or a placeholder if the file was missing).
    drawBadge(VIEW_W / 2, py + 232, 150);

    // Per-tier coin counts, climbing from zero. Collected count only.
    const cy = py + 330;
    const cols = [VIEW_W / 2 - 190, VIEW_W / 2, VIEW_W / 2 + 190];
    s.order.forEach((tier, i) => {
      const x = cols[i];
      drawCoin(ctx, x - 26, cy, 17, tier);
      ctx.fillStyle = '#2f2233';
      ctx.font = '700 34px system-ui, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('×' + s.disp[tier], x - 4, cy + 1);
    });

    // Home button — appears after the counts settle. Wordless house glyph.
    if (s.btnAlpha > 0) drawHomeButton(VIEW_W / 2, py + 400, s.btnAlpha, s.btnActive);
  }

  function drawConfetti(bits) {
    for (const p of bits) {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
  }

  // Draw the earned badge centred at (cx, cy) fitted to a size×size box. Uses the
  // loaded PNG when ready; otherwise a simple procedural rosette so the screen
  // still works if the art is missing.
  function drawBadge(cx, cy, size) {
    if (badgeReady && !badgeFailed) {
      ctx.drawImage(badgeImg, cx - size / 2, cy - size / 2, size, size);
      return;
    }
    const r = size * 0.42;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#f5c542'; ctx.strokeStyle = '#2f2233'; ctx.lineWidth = 5;
    ctx.beginPath();
    const petals = 14;
    for (let i = 0; i <= petals; i++) {
      const a = (i / petals) * Math.PI * 2, rr = r * (i % 2 === 0 ? 1 : 0.86);
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, 7);
    ctx.fillStyle = '#fff7ec'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8622c'; ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 === 0 ? r * 0.46 : r * 0.2;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // A wordless "home" button: a house glyph on a rounded cap. Fades in via alpha
  // and gently pulses once active. Activated by ENTER/SPACE (see keydown).
  function drawHomeButton(cx, cy, alpha, active) {
    const pulse = active ? 0.6 + 0.4 * Math.abs(Math.sin(blink * 2.2)) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    const w = 92, h = 76;
    roundRect(cx - w / 2, cy - h / 2, w, h, 16);
    ctx.fillStyle = '#f3e7d2'; ctx.fill();
    ctx.globalAlpha = alpha * pulse; ctx.lineWidth = 5; ctx.strokeStyle = '#3a8f2e'; ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#2f2233'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    const hw = 30, eaveY = cy - 4, roofY = cy - 20, baseY = cy + 20;
    ctx.fillStyle = '#e8622c'; ctx.beginPath();          // roof
    ctx.moveTo(cx - hw, eaveY); ctx.lineTo(cx, roofY); ctx.lineTo(cx + hw, eaveY);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    const bw = 22;
    roundRect(cx - bw, eaveY, bw * 2, baseY - eaveY, 3);  // body
    ctx.fillStyle = '#fff7ec'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2f2233';                            // door
    roundRect(cx - 7, baseY - 16, 14, 16, 2); ctx.fill();
    ctx.restore();
  }

  // Word-wrap `text` centred at (cx, y), breaking to fit maxW; lines step by lh.
  // Uses the current font/fill; caller sets textAlign 'center'.
  function wrapText(text, cx, y, maxW, lh) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    const startY = y - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, cx, startY + i * lh));
  }

  // The controls card. Text is for the accompanying adult; the drawn key glyphs
  // and arrows carry the meaning for a pre-reader.
  function drawInstructions() {
    // Dim the world behind the card.
    ctx.fillStyle = 'rgba(20,10,40,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const pw = 620, ph = 340;
    const px = (VIEW_W - pw) / 2;
    const py = (VIEW_H - ph) / 2;

    // Card.
    roundRect(px, py, pw, ph, 28);
    ctx.fillStyle = '#fff7ec';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#2f2233';
    ctx.stroke();

    // Title.
    ctx.fillStyle = '#e8622c';
    ctx.font = '700 46px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Squirrel Club', VIEW_W / 2, py + 56);

    // Row 1: MOVE — arrow-left / arrow-right keys.
    const rowY1 = py + 150;
    drawKey(px + 150, rowY1, '←');
    drawKey(px + 210, rowY1, '→');
    ctx.fillStyle = '#2f2233';
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Move', px + 300, rowY1 + 22);

    // Row 2: JUMP — a wide space bar.
    const rowY2 = py + 230;
    drawKey(px + 150, rowY2, 'space', 120);
    ctx.fillStyle = '#2f2233';
    ctx.fillText('Jump', px + 300, rowY2 + 22);

    // Prompt: gently pulsing "Press ENTER".
    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(blink * 2.2));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#3a8f2e';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press ENTER to play', VIEW_W / 2, py + ph - 42);
    ctx.globalAlpha = 1;
  }

  // A flat, thick-outlined keycap. `label` is centred; `w` widens it (for space).
  function drawKey(x, y, label, w = 46) {
    const h = 46;
    roundRect(x, y, w, h, 10);
    ctx.fillStyle = '#ffe08a';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#2f2233';
    ctx.stroke();
    ctx.fillStyle = '#2f2233';
    ctx.font = (label.length > 1 ? '600 18px' : '700 26px') + ' system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label === 'space' ? 'SPACE' : label, x + w / 2, y + h / 2 + 1);
  }

  // Rounded-rect path helper (canvas has no primitive for this pre-roundRect).
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  requestAnimationFrame(frame);
})();
