'use strict';

/* player.js — a rectangle with feel-good platformer movement.

   Milestone 1 is one generic character (a plain box). The five club members
   and their abilities come in Milestone 5; the hitbox and movement here are the
   shared foundation they'll build on.

   Feel features implemented:
     - acceleration / friction (separate ground & air accel)
     - coyote time      (jump shortly after walking off a ledge)
     - jump buffering    (jump pressed shortly before landing)
     - variable jump     (release early to cut the hop short)
     - safe respawn      (fall in a pit -> gently return to last solid ground)
   No lives, no failure: falling never loses anything. */

class Player {
  constructor(level) {
    this.level = level;

    // Hitbox is narrower than a full tile so you never clip a corner you
    // thought you cleared (spec: 36 x 44).
    this.w = 36;
    this.h = 44;

    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;

    this.coyote = 0;        // time left where a jump is still allowed after leaving ground
    this.wasJumpHeld = false;
    this.airJumpsLeft = Physics.MAX_AIR_JUMPS; // mid-air jumps until we next land

    // Respawn: remember the last spot we stood safely, and count down when we
    // fall out of the world.
    this.lastSafe = { x: level.spawn.x, y: level.spawn.y };
    this.respawnTimer = 0;  // >0 while waiting to be placed back

    this._placeAtSpawn();
  }

  _placeAtSpawn() {
    this.x = this.level.spawn.x + (Physics.TILE - this.w) / 2;
    this.y = this.level.spawn.y + (Physics.TILE - this.h);
    this.vx = this.vy = 0;
  }

  // Full reset back to the spawn (used when restarting after the exit).
  reset() {
    this._placeAtSpawn();
    this.onGround = false;
    this.coyote = 0;
    this.respawnTimer = 0;
    this.airJumpsLeft = Physics.MAX_AIR_JUMPS;
    this.lastSafe = { x: this.level.spawn.x, y: this.level.spawn.y };
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(dt) {
    // If we're mid-respawn, freeze and count down, then drop back in.
    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this._respawn();
      return;
    }

    const P = Physics;

    // --- Horizontal acceleration toward the input direction ---
    const dir = Input.moveX();
    let accel;
    if (this.onGround) {
      accel = P.ACCEL;
    } else {
      // In the air, turning around (input opposes current motion) uses a much
      // snappier acceleration so direction changes feel responsive with little
      // inertia — most noticeable during the long hang of a double jump.
      const turning = dir !== 0 && this.vx !== 0 && Math.sign(dir) !== Math.sign(this.vx);
      accel = turning ? P.AIR_TURN_ACCEL : P.AIR_ACCEL;
    }
    if (dir !== 0) {
      this.vx += dir * accel * dt;
      this.facing = dir;
      const max = P.MOVE_SPEED;
      if (this.vx >  max) this.vx =  max;
      if (this.vx < -max) this.vx = -max;
    } else if (this.onGround) {
      // Friction only bites on the ground so air control stays floaty.
      const fr = P.FRICTION * dt;
      if (Math.abs(this.vx) <= fr) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * fr;
    }

    // --- Coyote timer ---
    if (this.onGround) this.coyote = P.COYOTE_TIME;
    else if (this.coyote > 0) this.coyote = Math.max(0, this.coyote - dt);

    // --- Jump ---
    if (Input.jumpQueued()) {
      if (this.coyote > 0) {
        // Ground jump (also fires within the coyote window after a ledge).
        this.vy = P.JUMP_VELOCITY;
        this.onGround = false;
        this.coyote = 0;
        Input.consumeJump();
      } else if (this.airJumpsLeft > 0 && this.vy >= 0) {
        // Mid-air (double) jump, allowed only at the apex or while falling
        // (vy >= 0). This guarantees it always boosts (never slows a fast rise)
        // and caps the peak at ~1.3*H when pressed right at the apex. A press
        // made a touch early is held by the jump buffer and fires at the apex;
        // a press while still rising fast is simply ignored (not wasted).
        this.vy = P.DOUBLE_JUMP_VEL;
        this.airJumpsLeft--;
        Input.consumeJump();
      }
    }

    // --- Variable jump height: releasing jump while rising cuts the ascent ---
    if (P.VARIABLE_JUMP && this.vy < 0 && this.wasJumpHeld && !Input.jumpHeld) {
      this.vy *= 0.5;
    }
    this.wasJumpHeld = Input.jumpHeld;

    // --- Gravity ---
    this.vy += P.GRAVITY * dt;
    if (this.vy > P.MAX_FALL) this.vy = P.MAX_FALL;

    // --- Integrate with collision, one axis at a time ---
    const hitX = moveAndCollide(this, this.vx * dt, 0, this.level);
    if (hitX.hitLeft || hitX.hitRight) this.vx = 0;

    const hitY = moveAndCollide(this, 0, this.vy * dt, this.level);
    const wasOnGround = this.onGround;
    this.onGround = hitY.hitBottom;
    if (hitY.hitBottom) {
      this.vy = 0;
      this.airJumpsLeft = P.MAX_AIR_JUMPS; // landing refills the mid-air jump
      this._rememberSafeSpot();
    }
    if (hitY.hitTop) this.vy = 0;
    void wasOnGround; // (landing FX will hook here in a later milestone)

    // --- Fell out of the world? Begin a gentle respawn. ---
    if (this.y > this.level.pixelH + Physics.TILE) {
      this.respawnTimer = 0.5; // half a second, per the design rules
      this.vx = this.vy = 0;
    }
  }

  // Record where we're standing so a fall can return us here.
  _rememberSafeSpot() {
    this.lastSafe.x = this.x;
    this.lastSafe.y = this.y;
  }

  _respawn() {
    this.x = this.lastSafe.x;
    this.y = this.lastSafe.y;
    this.vx = this.vy = 0;
    this.onGround = false;
    this.respawnTimer = 0;
  }

  draw(ctx, camX, camY) {
    // While waiting to respawn, don't draw the box hanging in the pit.
    if (this.respawnTimer > 0) return;

    const x = this.x - camX;
    const y = this.y - camY;

    ctx.fillStyle = '#e8622c';           // placeholder squirrel-orange box
    ctx.fillRect(x, y, this.w, this.h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2f2233';
    ctx.strokeRect(x + 1.5, y + 1.5, this.w - 3, this.h - 3);

    // A small eye to show facing — makes the direction readable while testing.
    ctx.fillStyle = '#fff';
    const eyeX = x + (this.facing > 0 ? this.w - 12 : 6);
    ctx.fillRect(eyeX, y + 10, 6, 6);
  }
}
