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

  // --- Screen state ---
  // 'select' -> 'instructions' -> 'playing' -> 'complete', with 'pausemenu'
  // reachable from play via Escape. Select picks the character; instructions
  // shows the controls; complete is the finish screen.
  // The full state machine (splash/hub/...) arrives in M4.
  let screen = 'select';
  let blink = 0;       // drives the gentle pulse on the prompts
  let selIndex = 0;    // highlighted character in the select row
  let lockShake = 0;   // brief wobble when a locked character is confirmed
  let pauseIndex = 0;  // highlighted button in the pause menu (0 resume, 1 restart)
  let gems = { A: 0, B: 0, C: 0 }; // collected count per tier (reset each run)

  function startPlaying() {
    player.reset();
    camera.snapTo(level, player);
    Input.clearAll();  // drop any key state left over from the menus
    gems = { A: 0, B: 0, C: 0 };
    level.resetGems();
    screen = 'playing';
  }

  function resumeGame() {
    Input.consumeJump(); // don't let the confirming Space fire a jump on resume
    screen = 'playing';
  }

  // Pick up any gem within a generous radius of the player's centre.
  function collectGems() {
    const cx = player.cx, cy = player.cy, R2 = 40 * 40;
    for (const g of level.gems) {
      if (g.taken) continue;
      const dx = cx - g.x, dy = cy - g.y;
      if (dx * dx + dy * dy < R2) { g.taken = true; gems[g.tier]++; }
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
        acc -= STEP;
      }
    }

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

    if (screen === 'select') {
      drawSelect();
    } else if (screen === 'instructions') {
      drawInstructions();
    } else if (screen === 'complete') {
      drawComplete();
    } else if (screen === 'pausemenu') {
      drawPause();
    } else if (paused) {
      ctx.fillStyle = 'rgba(20,10,40,0.45)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
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
    const sw = 150, sh = 100, gap = 48;
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
