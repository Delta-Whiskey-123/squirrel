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
  const level = new Level(TEST_LEVEL);
  const player = new Player(level);
  Input.attach();

  // In M1 the camera is fixed at the origin (level fits the view). Milestone 2
  // introduces a following camera.
  const camX = 0, camY = 0;

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

    if (!paused) {
      acc += dt;
      while (acc >= STEP) {
        Input.update(STEP);
        player.update(STEP);
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

    level.draw(ctx, camX, camY, VIEW_W, VIEW_H);
    player.draw(ctx, camX, camY);

    if (paused) {
      ctx.fillStyle = 'rgba(20,10,40,0.45)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  requestAnimationFrame(frame);
})();
