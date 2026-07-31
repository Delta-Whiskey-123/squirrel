'use strict';

/* input.js — keyboard state plus the "feel good" timers that make jumping
   forgiving: coyote time (jump just after leaving a ledge) and jump buffering
   (jump pressed just before landing still fires).

   The whole input surface for the game is: move left, move right, jump.
   Everything maps onto Arrow keys / A-D and Space. */

const Input = (function () {
  // Raw key state.
  const down = Object.create(null);

  // Edge flags for "pressed this frame" style queries.
  let jumpBuffer = 0;      // seconds remaining where a jump press still counts
  let jumpHeld = false;    // true while the jump key is physically held
  let jumpConsumedThisPress = false; // reset each fresh press (for double jump etc.)

  // Sprint (double-tap-and-hold). Per-direction: `win` counts down the window in
  // which a second press still pairs with the first tap; `released` marks that
  // the first tap's key came back up, so a re-press can complete the double-tap.
  // A latched `sprintDir` stays held until that direction is released/reversed.
  let doubleTapWindow = 0.25;
  const tap = { '-1': { win: 0, released: false }, '1': { win: 0, released: false } };
  let sprintDir = 0;       // -1 / 0 / +1 — direction currently sprint-held

  // Touch stub, unused for now — kept behind a flag for later app conversion.
  const TOUCH_ENABLED = false;

  const LEFT_KEYS  = ['ArrowLeft', 'KeyA'];
  const RIGHT_KEYS = ['ArrowRight', 'KeyD'];
  const JUMP_KEYS  = ['Space', 'ArrowUp', 'KeyW'];

  function isAny(codes) {
    for (const c of codes) if (down[c]) return true;
    return false;
  }

  function dirOf(code) {
    if (LEFT_KEYS.includes(code)) return -1;
    if (RIGHT_KEYS.includes(code)) return 1;
    return 0;
  }

  function onKeyDown(e) {
    // Prevent the page from scrolling on arrows/space.
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (down[e.code]) return; // ignore auto-repeat

    down[e.code] = true;

    if (JUMP_KEYS.includes(e.code)) {
      jumpBuffer = Physics.JUMP_BUFFER;
      jumpHeld = true;
      jumpConsumedThisPress = false;
    }

    // Sprint double-tap. (Auto-repeat is filtered above, so this is a fresh press.)
    const d = dirOf(e.code);
    if (d !== 0) {
      if (sprintDir !== 0 && sprintDir !== d) sprintDir = 0; // opposite press cancels a sprint
      const rec = tap[d];
      if (rec.win > 0 && rec.released) {
        sprintDir = d;                                       // second, held press → latch sprint
        rec.win = 0; rec.released = false;
      } else {
        rec.win = doubleTapWindow; rec.released = false;     // (re)start a first tap
      }
    }
  }

  function onKeyUp(e) {
    down[e.code] = false;
    if (JUMP_KEYS.includes(e.code)) {
      // Jump is "held" only while at least one jump key is down.
      jumpHeld = isAny(JUMP_KEYS);
    }

    const d = dirOf(e.code);
    if (d !== 0) {
      if (tap[d].win > 0) tap[d].released = true;            // first tap let go — a re-press can now pair
      // Sprint ends once no key for the latched direction remains held.
      if (sprintDir === d && !isAny(d === -1 ? LEFT_KEYS : RIGHT_KEYS)) sprintDir = 0;
    }
  }

  function attach() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    // Drop all keys if focus is lost so nothing sticks "on".
    window.addEventListener('blur', clearAll);
  }

  function clearAll() {
    for (const k in down) down[k] = false;
    jumpHeld = false;
    jumpBuffer = 0;
    sprintDir = 0;
    tap['-1'].win = tap['1'].win = 0;
    tap['-1'].released = tap['1'].released = false;
  }

  // Advance timers. Called once per fixed physics step with dt in seconds.
  function update(dt) {
    if (jumpBuffer > 0) jumpBuffer = Math.max(0, jumpBuffer - dt);
    if (tap['-1'].win > 0) tap['-1'].win = Math.max(0, tap['-1'].win - dt);
    if (tap['1'].win  > 0) tap['1'].win  = Math.max(0, tap['1'].win  - dt);
  }

  // Horizontal axis: -1, 0, or +1.
  function moveX() {
    const l = isAny(LEFT_KEYS);
    const r = isAny(RIGHT_KEYS);
    return (r ? 1 : 0) - (l ? 1 : 0);
  }

  // True if a buffered jump is available to consume.
  function jumpQueued() { return jumpBuffer > 0; }

  // Consume the buffered jump so it fires exactly once.
  function consumeJump() { jumpBuffer = 0; }

  // Direction (-1/0/+1) currently held via a completed sprint double-tap.
  function sprintHeld() { return sprintDir; }
  // The active character sets its own double-tap window (0 disables via no run).
  function setDoubleTapWindow(s) { doubleTapWindow = s; }

  return {
    attach, update, clearAll,
    moveX,
    jumpQueued, consumeJump,
    sprintHeld, setDoubleTapWindow,
    get jumpHeld() { return jumpHeld; },
    TOUCH_ENABLED,
  };
})();
