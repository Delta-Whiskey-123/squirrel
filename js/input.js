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

  // Touch stub, unused for now — kept behind a flag for later app conversion.
  const TOUCH_ENABLED = false;

  const LEFT_KEYS  = ['ArrowLeft', 'KeyA'];
  const RIGHT_KEYS = ['ArrowRight', 'KeyD'];
  const JUMP_KEYS  = ['Space', 'ArrowUp', 'KeyW'];

  function isAny(codes) {
    for (const c of codes) if (down[c]) return true;
    return false;
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
  }

  function onKeyUp(e) {
    down[e.code] = false;
    if (JUMP_KEYS.includes(e.code)) {
      // Jump is "held" only while at least one jump key is down.
      jumpHeld = isAny(JUMP_KEYS);
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
  }

  // Advance timers. Called once per fixed physics step with dt in seconds.
  function update(dt) {
    if (jumpBuffer > 0) jumpBuffer = Math.max(0, jumpBuffer - dt);
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

  return {
    attach, update, clearAll,
    moveX,
    jumpQueued, consumeJump,
    get jumpHeld() { return jumpHeld; },
    TOUCH_ENABLED,
  };
})();
