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
  // 'levelselect' -> 'select' -> 'instructions' -> 'playing' -> 'gameComplete',
  // with 'pausemenu' reachable from play via Escape. Level select picks the
  // level; select picks the character; instructions shows the controls;
  // gameComplete celebrates finishing a level. Level select is the entry screen
  // for now — the full state machine (splash/hub/...) arrives in M4.
  let screen = 'levelselect';
  let blink = 0;       // drives the gentle pulse on the prompts
  let levelIndex = 0;  // focused card in the level grid; persists so re-entry
                       // starts on the last-chosen level
  let levelShake = 0;  // brief wobble when a locked level is confirmed
  let selectedLevelId = LEVELS[0].id; // chosen level; defaults to 1 (crash guard)
  let selIndex = 0;    // highlighted character in the select row
  let lockShake = 0;   // brief wobble when a locked character is confirmed
  let pauseIndex = 0;  // highlighted button in the pause menu (0 resume, 1 mute, 2 restart)
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
    // LEVEL LOAD: the chosen level id (set on the level-select screen, defaulting
    // to 1) selects which world to build. Only Training exists today, so every id
    // loads the same Woodland Path — but the id flows through here, so adding a
    // level later is just a branch inside level.load().
    level.load(selectedLevelId);
    // Point the ambient pollen at this level's theme (base look); the player's
    // runtime density/enable choice still composes over it. Defaults if unknown.
    const lv = LEVELS.find((l) => l.id === selectedLevelId);
    Particles.setTheme(lv ? lv.theme : 'training');
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

  // --- Dev-only shortcut (to be removed before release) ---
  // Typing "fast" during play warps the player to 10 tiles short of the exit
  // door, so the end-of-game sequence can be reached without a full run.
  const DEV_WARP_CODE = 'fast';
  const DEV_WARP_TILES = 10;
  let devTyped = '';

  function devWarpNearExit() {
    player.x = level.exitDoorX - DEV_WARP_TILES * Physics.TILE - player.w / 2;
    player.y = level.floorTopY - player.h;
    player.vx = player.vy = 0;
    camera.snapTo(level, player);
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
      btnAlpha: 0,                  // buttons fade in after the counts finish
      btnActive: false,             // ENTER/SPACE only acts once true
      gcIndex: 0,                   // focused button (0 home, 1 start over)
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
  const UP = (c) => c === 'ArrowUp' || c === 'KeyW';
  const DOWN = (c) => c === 'ArrowDown' || c === 'KeyS';
  const BACK = (c) => c === 'Backspace';

  window.addEventListener('keydown', (e) => {
    // Escape opens/closes the pause menu during play.
    if (e.code === 'Escape') {
      if (screen === 'playing') { e.preventDefault(); pauseIndex = 0; screen = 'pausemenu'; }
      else if (screen === 'pausemenu') { e.preventDefault(); Sfx.back(); resumeGame(); }
      else if (screen === 'select') { e.preventDefault(); Sfx.back(); screen = 'levelselect'; } // back to level select
      // 'levelselect': nothing precedes it yet (splash/hub arrives in M4) — no-op.
      return;
    }
    if (screen === 'levelselect') {
      const COLS = 3, count = LEVELS.length;
      const col = levelIndex % COLS;
      if (LEFT(e.code))  { e.preventDefault(); if (col > 0) { levelIndex--; Sfx.move(); } }
      else if (RIGHT(e.code)) { e.preventDefault(); if (col < COLS - 1 && levelIndex + 1 < count) { levelIndex++; Sfx.move(); } }
      else if (UP(e.code))    { e.preventDefault(); if (levelIndex - COLS >= 0) { levelIndex -= COLS; Sfx.move(); } }
      else if (DOWN(e.code))  { e.preventDefault(); if (levelIndex + COLS < count) { levelIndex += COLS; Sfx.move(); } }
      else if (CONFIRM(e.code)) {
        e.preventDefault();
        const lv = LEVELS[levelIndex];
        if (!lv.unlocked) {
          levelShake = 0.35;                     // deny: wobble the card
          Sfx.locked();                          // clearly-negative "nuh-uh"
        } else {
          selectedLevelId = lv.id;               // store the chosen id, then pick a character
          Sfx.confirm();
          screen = 'select';
        }
      }
      else if (BACK(e.code)) { e.preventDefault(); /* nothing precedes level select yet — silent dead-end */ }
      return;
    }
    if (screen === 'pausemenu') {
      const PCOUNT = 3; // Resume, Mute, Start over
      if (LEFT(e.code))  { e.preventDefault(); pauseIndex = (pauseIndex + PCOUNT - 1) % PCOUNT; Sfx.move(); }
      else if (RIGHT(e.code)) { e.preventDefault(); pauseIndex = (pauseIndex + 1) % PCOUNT; Sfx.move(); }
      else if (CONFIRM(e.code)) {
        e.preventDefault();
        if (pauseIndex === 0) { Sfx.confirm(); resumeGame(); }
        else if (pauseIndex === 1) { Sfx.toggleMute(); }        // stays on pause menu
        else { Sfx.confirm(); screen = 'select'; }              // restart from character select
      }
      return;
    }
    if (screen === 'select') {
      if (LEFT(e.code))  { e.preventDefault(); if (selIndex > 0) { selIndex--; Sfx.move(); } }
      else if (RIGHT(e.code)) { e.preventDefault(); if (selIndex < CHARACTERS.length - 1) { selIndex++; Sfx.move(); } }
      else if (BACK(e.code)) { e.preventDefault(); Sfx.back(); screen = 'levelselect'; } // back to level select
      else if (CONFIRM(e.code)) {
        e.preventDefault();
        const c = CHARACTERS[selIndex];
        if (c.locked) { lockShake = 0.35; Sfx.locked(); }  // can't pick this one yet
        else { Sfx.confirm(); player.setCharacter(c); screen = 'instructions'; }
      }
      return;
    }
    if (screen === 'gameComplete') {
      if (!gcState || !gcState.btnActive) return;   // buttons not live yet
      if (LEFT(e.code))  { e.preventDefault(); if (gcState.gcIndex !== 0) { gcState.gcIndex = 0; Sfx.move(); } }
      else if (RIGHT(e.code)) { e.preventDefault(); if (gcState.gcIndex !== 1) { gcState.gcIndex = 1; Sfx.move(); } }
      else if (CONFIRM(e.code)) {
        e.preventDefault();
        Sfx.confirm();
        const home = gcState.gcIndex === 0;
        gcState = null;
        screen = home ? 'levelselect' : 'select'; // Home → level select; Start over → character select
      }
      return;
    }
    if (screen === 'playing' && e.key && e.key.length === 1) {
      // Dev-only: watch the last few printable keys for the warp code.
      devTyped = (devTyped + e.key.toLowerCase()).slice(-DEV_WARP_CODE.length);
      if (devTyped === DEV_WARP_CODE) { devTyped = ''; devWarpNearExit(); return; }
    }
    if (CONFIRM(e.code) && (screen === 'instructions' || screen === 'complete')) {
      e.preventDefault();
      Sfx.confirm();
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
    if (levelShake > 0) levelShake -= dt;

    // Ambient pollen drifts every frame, on every screen, using the real frame dt
    // (frame-rate independent). Cheap no-op when disabled.
    Particles.update(dt, camera.x, camera.y);

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
    // Sky. A soft daytime blue, kept a touch deeper than the platforms' pale
    // windows so the warm-white pollen glints still read against it (particles.js).
    ctx.fillStyle = '#96c8f2';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Parallax landscape backdrop (scenery.js): only behind the live world, so
    // menus and level-select thumbnails are untouched. Sits between the flat
    // sky and the ambient pollen.
    if (screen === 'playing' || screen === 'pausemenu' || screen === 'gameComplete') {
      Scenery.drawBack(ctx, camera.x, camera.y, VIEW_W, VIEW_H);
    }

    // Ambient pollen: far + mid bands sit in the air behind the world.
    Particles.drawBack(ctx);

    level.draw(ctx, camera.x, camera.y, VIEW_W, VIEW_H);
    player.draw(ctx, camera.x, camera.y);

    // Optional near band reads as "in front" (off by default).
    Particles.drawFront(ctx);

    if (screen === 'playing' || screen === 'pausemenu') drawHud();
    if (Sfx.isMuted()) drawMuteIcon(screen === 'playing' ? 90 : 0); // dodge the Menu button
    if (screen === 'playing') drawMenuButton();

    if (screen === 'levelselect') {
      drawLevelSelect();
    } else if (screen === 'select') {
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

  // Small speaker-with-a-slash, top-right, shown while sound is muted. Accepts
  // an extra leftward offset so it doesn't collide with the Menu button during
  // play.
  function drawMuteIcon(offsetX) {
    const x = VIEW_W - 40 - (offsetX || 0), y = 24;
    ctx.fillStyle = 'rgba(47,34,51,0.85)';
    ctx.beginPath();
    ctx.moveTo(x, y - 4); ctx.lineTo(x + 5, y - 4); ctx.lineTo(x + 11, y - 9);
    ctx.lineTo(x + 11, y + 9); ctx.lineTo(x + 5, y + 4); ctx.lineTo(x, y + 4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(47,34,51,0.85)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + 15, y - 8); ctx.lineTo(x + 23, y + 8); ctx.stroke();
  }

  // Top-right "Menu" button, shown only during play. Visual only for now —
  // opens the door to touch/mouse input later; Escape is still the only way
  // to reach the pause menu today.
  function drawMenuButton() {
    const bw = 78, bh = 30, x = VIEW_W - bw - 12, y = 10;
    roundRect(x, y, bw, bh, 10);
    ctx.fillStyle = 'rgba(255,247,236,0.92)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#2f2233'; ctx.stroke();
    ctx.fillStyle = '#2f2233'; ctx.font = '600 18px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Menu', x + bw / 2, y + bh / 2 + 1);
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

  // The pause menu: three buttons — Resume, Mute/Unmute, or Start over (back to
  // select). Left/Right cycles (with wraparound), Space/Enter confirms, Escape
  // resumes. Mute toggles in place and does not close the menu.
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

    const bw = 160, bh = 130, gap = 20, by = py + 96;
    const totalW = bw * 3 + gap * 2, startX = VIEW_W / 2 - totalW / 2;
    const muted = Sfx.isMuted();
    const buttons = [
      { label: 'Resume',                  color: '#3a8f2e', icon: 'play' },
      { label: muted ? 'Unmute' : 'Mute', color: '#8a6d3b', icon: 'speaker' },
      { label: 'Start over',              color: '#2f7fd6', icon: 'restart' },
    ];
    buttons.forEach((b, i) => {
      const bx = startX + i * (bw + gap);
      roundRect(bx, by, bw, bh, 18);
      ctx.fillStyle = '#f3e7d2'; ctx.fill();
      if (i === pauseIndex) { ctx.lineWidth = 5; ctx.strokeStyle = b.color; }
      else { ctx.lineWidth = 3; ctx.strokeStyle = '#d8c9ad'; }
      ctx.stroke();

      const cx = bx + bw / 2, cyi = by + 48;
      ctx.fillStyle = b.color; ctx.strokeStyle = b.color;
      if (b.icon === 'play') drawPlayIcon(cx, cyi);
      else if (b.icon === 'restart') drawRestartIcon(cx, cyi);
      else drawSpeakerIcon(cx, cyi, muted);

      ctx.fillStyle = '#2f2233'; ctx.font = '600 22px system-ui, sans-serif';
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

  // Speaker glyph for the pause-menu Mute/Unmute button: a cone body, plus a
  // diagonal slash when muted or two small sound-wave arcs when not.
  function drawSpeakerIcon(cx, cy, muted) {
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy - 5); ctx.lineTo(cx - 9, cy - 5); ctx.lineTo(cx - 1, cy - 13);
    ctx.lineTo(cx - 1, cy + 13); ctx.lineTo(cx - 9, cy + 5); ctx.lineTo(cx - 16, cy + 5);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    if (muted) {
      ctx.beginPath(); ctx.moveTo(cx + 3, cy - 11); ctx.lineTo(cx + 15, cy + 11); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(cx + 4, cy, 8, -0.6, 0.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 4, cy, 13, -0.5, 0.5); ctx.stroke();
    }
  }

  // Level select: a 3x2 grid of level cards over the dimmed world. Arrows move
  // the focus, Space/Enter confirms (unlocked only), Esc/Backspace goes back.
  function drawLevelSelect() {
    ctx.fillStyle = 'rgba(20,10,40,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const pw = 860, ph = 480, px = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2;
    roundRect(px, py, pw, ph, 28);
    ctx.fillStyle = '#fff7ec'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#2f2233'; ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8622c'; ctx.font = '700 40px system-ui, sans-serif';
    ctx.fillText('Choose a level', VIEW_W / 2, py + 44);

    // Grid geometry (3 columns, 2 rows) sized to fill the card.
    const COLS = 3, ROWS = 2, pad = 40, gapX = 24, gapY = 22;
    const gridTop = py + 82, gridBottom = py + ph - 52;
    const cardW = (pw - pad * 2 - gapX * (COLS - 1)) / COLS;
    const cardH = (gridBottom - gridTop - gapY * (ROWS - 1)) / ROWS;

    LEVELS.forEach((lv, i) => {
      const c = i % COLS, r = (i / COLS) | 0;
      let bx = px + pad + c * (cardW + gapX);
      const by = gridTop + r * (cardH + gapY);
      const focused = i === levelIndex;
      if (!lv.unlocked && focused && levelShake > 0) bx += Math.sin(levelShake * 50) * 4;
      drawLevelCard(lv, bx, by, cardW, cardH, focused);
    });

    // Prompt reflects the focused card's state.
    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(blink * 2.2));
    ctx.globalAlpha = pulse;
    const sel = LEVELS[levelIndex];
    if (sel.unlocked) {
      ctx.fillStyle = '#3a8f2e'; ctx.font = '700 26px system-ui, sans-serif';
      ctx.fillText('Press SPACE to choose', VIEW_W / 2, py + ph - 26);
    } else {
      ctx.fillStyle = '#9aa6bf'; ctx.font = '700 24px system-ui, sans-serif';
      ctx.fillText('Coming soon', VIEW_W / 2, py + ph - 26);
    }
    ctx.globalAlpha = 1;
  }

  // One level card: preview thumbnail, number chip, name + state, lock treatment,
  // and a focus ring. Locked cards get a dimming veil and a padlock.
  function drawLevelCard(lv, x, y, w, h, focused) {
    const previewH = Math.round(h * 0.60);

    roundRect(x, y, w, h, 16);
    ctx.fillStyle = '#f3e7d2'; ctx.fill();

    // Preview thumbnail, clipped to a rounded region; dimmed if locked.
    ctx.save();
    roundRect(x + 6, y + 6, w - 12, previewH, 10); ctx.clip();
    lv.preview(ctx, x + 6, y + 6, w - 12, previewH);
    if (!lv.unlocked) { ctx.fillStyle = 'rgba(30,24,40,0.45)'; ctx.fillRect(x + 6, y + 6, w - 12, previewH); }
    ctx.restore();
    roundRect(x + 6, y + 6, w - 12, previewH, 10);
    ctx.lineWidth = 3; ctx.strokeStyle = '#2f2233'; ctx.stroke();

    // Level-number chip, top-left.
    ctx.fillStyle = lv.unlocked ? '#e8622c' : '#9aa6bf';
    ctx.beginPath(); ctx.arc(x + 22, y + 22, 14, 0, 7); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#2f2233'; ctx.stroke();
    ctx.fillStyle = '#fff7ec'; ctx.font = '700 18px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(lv.id), x + 22, y + 23);

    // Name + state below the preview.
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = lv.unlocked ? '#2f2233' : '#8a7f72';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(lv.displayName, x + w / 2, y + previewH + 22);
    ctx.fillStyle = lv.unlocked ? '#3a8f2e' : '#9aa6bf';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText(lv.unlocked ? lv.blurb : 'Coming soon', x + w / 2, y + previewH + 42);

    // Padlock for locked cards, top-right of the preview.
    if (!lv.unlocked) drawLock(x + w - 24, y + 16);

    // Focus ring.
    roundRect(x, y, w, h, 16);
    if (focused) { ctx.lineWidth = 5; ctx.strokeStyle = lv.unlocked ? '#3a8f2e' : '#9aa6bf'; }
    else { ctx.lineWidth = 3; ctx.strokeStyle = '#d8c9ad'; }
    ctx.stroke();
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

    // The earned badge (real art, or a placeholder if the file was missing) —
    // sized to fill the gap between the headline and the coin counts.
    drawBadge(VIEW_W / 2, py + 200, 200);

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

    // Buttons — appear after the counts settle. Home (to level select) on the
    // left, Start over (to character select) on the right. Left/Right moves the
    // focus; the focused one is ringed and pulses once active.
    if (s.btnAlpha > 0) {
      const by = py + 400, dx = 66;
      drawHomeButton(VIEW_W / 2 - dx, by, s.btnAlpha, s.btnActive, s.gcIndex === 0);
      drawStartOverButton(VIEW_W / 2 + dx, by, s.btnAlpha, s.btnActive, s.gcIndex === 1);
    }
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

  // The shared rounded cap + focus ring for the two end-screen buttons. The
  // focused button is ringed green (and pulses once live); the other is muted.
  function endBtnBase(cx, cy, alpha, active, focused) {
    const w = 92, h = 76;
    roundRect(cx - w / 2, cy - h / 2, w, h, 16);
    ctx.fillStyle = '#f3e7d2'; ctx.fill();
    if (focused) {
      const pulse = active ? 0.6 + 0.4 * Math.abs(Math.sin(blink * 2.2)) : 1;
      ctx.globalAlpha = alpha * pulse; ctx.lineWidth = 5; ctx.strokeStyle = '#3a8f2e';
    } else {
      ctx.lineWidth = 3; ctx.strokeStyle = '#d8c9ad';
    }
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }

  // A wordless "home" button: a house glyph on a rounded cap. Returns to level
  // select. Fades in via alpha; pulses while focused and active.
  function drawHomeButton(cx, cy, alpha, active, focused) {
    ctx.save();
    ctx.globalAlpha = alpha;
    endBtnBase(cx, cy, alpha, active, focused);
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

  // A wordless "start over" button: a circular arrow (looping right-around-to-
  // left) on a rounded cap. Returns to character select. Same look as the pause
  // menu's restart glyph.
  function drawStartOverButton(cx, cy, alpha, active, focused) {
    ctx.save();
    ctx.globalAlpha = alpha;
    endBtnBase(cx, cy, alpha, active, focused);
    ctx.fillStyle = '#2f7fd6'; ctx.strokeStyle = '#2f7fd6';
    drawRestartIcon(cx, cy);
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
