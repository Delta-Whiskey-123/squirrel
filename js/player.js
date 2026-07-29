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

    // Procedural animation state (drives squash/stretch, leg swing, idle bob).
    this.animTime = 0;
    this.walkPhase = 0;
    this.landTimer = 0;

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
      if (!wasOnGround) this.landTimer = 0.12; // squash pulse on touchdown
      this.vy = 0;
      this.airJumpsLeft = P.MAX_AIR_JUMPS; // landing refills the mid-air jump
      this._rememberSafeSpot();
    }
    if (hitY.hitTop) this.vy = 0;

    // --- Animation timers ---
    this.animTime += dt;
    if (this.landTimer > 0) this.landTimer -= dt;
    // Leg swing advances with ground speed, so the stride matches the movement.
    if (this.onGround && Math.abs(this.vx) > 12) this.walkPhase += Math.abs(this.vx) * dt * 0.055;

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
    // While waiting to respawn, don't draw the player hanging in the pit.
    if (this.respawnTimer > 0) return;

    // Anchor the sprite at the bottom-centre of the hitbox; it overhangs the
    // 36x44 box, so physics stays exact while the drawing is chunky and cute.
    const cx = this.x + this.w / 2 - camX;
    const feetY = this.y + this.h - camY;

    // Pose from motion: walking legs, air stretch, landing squash, idle bob.
    const moving = this.onGround && Math.abs(this.vx) > 12;
    const leg = moving ? Math.sin(this.walkPhase) * 4.5 : 0;
    let sq = 1;
    if (!this.onGround) sq = 1 + Math.min(0.16, Math.abs(this.vy) * 0.00022);
    if (this.landTimer > 0) sq = 1 - 0.16 * (this.landTimer / 0.12);
    if (this.onGround && !moving) sq += Math.sin(this.animTime * 3) * 0.02;

    this._drawLion(ctx, cx, feetY, 1, { face: this.facing, leg, sq });
  }

  // The yellow lion, drawn from canvas primitives. Local space has the feet at
  // (0,0) and grows upward; `s` scales, `face` (-1/1) leans + shifts the eyes,
  // `leg` swings the legs, `sq` is the squash/stretch factor about the feet.
  _drawLion(ctx, cx, feetY, s, o) {
    const face = o.face || 0, leg = o.leg || 0, sq = o.sq || 1;
    const MANE = '#E4A72C', FACE = '#F3E3BE', OUT = '#3B2A1B',
          INK = '#2A1D12', EARIN = '#EBD09A', LINE = '#B9831C';
    const rr = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    ctx.save();
    ctx.translate(cx, feetY);
    ctx.scale(1 / Math.sqrt(sq), sq);     // squash/stretch about the feet
    ctx.scale(s, s);
    ctx.rotate(face * 0.05);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const hy = -40;

    // Ground shadow.
    ctx.fillStyle = 'rgba(40,25,15,0.16)';
    ctx.beginPath(); ctx.ellipse(0, 1, 20, 4.5, 0, 0, 7); ctx.fill();

    // Legs.
    ctx.fillStyle = MANE; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    [[-8, leg], [8, -leg]].forEach(([lx, dy]) => { rr(lx - 4, -11 + dy, 8, 12 - dy, 3.5); ctx.fill(); ctx.stroke(); });

    // Body + belly patch.
    ctx.fillStyle = MANE; rr(-13, -27, 26, 20, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = FACE; ctx.beginPath(); ctx.ellipse(0, -15, 7.5, 7, 0, 0, 7); ctx.fill();

    // Arms.
    ctx.fillStyle = MANE;
    [-13, 13].forEach((ax) => { ctx.beginPath(); ctx.ellipse(ax, -20, 4.5, 6, 0, 0, 7); ctx.fill(); ctx.stroke(); });

    // Ruffled mane: a base circle plus a ring of overlapping petals.
    ctx.fillStyle = MANE; ctx.beginPath(); ctx.arc(0, hy, 17, 0, 7); ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 1.5;
    for (let i = 0; i < 13; i++) {
      const a = i / 13 * Math.PI * 2;
      ctx.fillStyle = MANE;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 16, hy + Math.sin(a) * 16, 9, 0, 7); ctx.fill(); ctx.stroke();
    }

    // Ears peeking through.
    [-11, 11].forEach((ex) => {
      ctx.fillStyle = MANE; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ex, hy - 15, 6, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = EARIN; ctx.beginPath(); ctx.arc(ex, hy - 14, 3, 0, 7); ctx.fill();
    });

    // Face.
    ctx.fillStyle = FACE; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, hy, 14.5, 0, 7); ctx.fill(); ctx.stroke();

    // Eyes (15% wider than the mockup: +-6 -> +-6.9), shifted toward facing.
    const ex = face * 1.3;
    ctx.fillStyle = INK;
    [-6.9, 6.9].forEach((dx) => {
      ctx.beginPath(); ctx.arc(dx + ex, hy - 1, 2.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dx + ex - 0.7, hy - 1.8, 0.8, 0, 7); ctx.fill();
      ctx.fillStyle = INK;
    });

    // Stitched nose + thread.
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(-3.2, hy + 3); ctx.lineTo(3.2, hy + 3);
    ctx.quadraticCurveTo(2.4, hy + 7.5, 0, hy + 8.5);
    ctx.quadraticCurveTo(-2.4, hy + 7.5, -3.2, hy + 3);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, hy + 8.5); ctx.lineTo(0, hy + 12.5); ctx.stroke();

    // Soft smile.
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(-2.4, hy + 11.5, 2.6, -0.2, 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(2.4, hy + 11.5, 2.6, 1.64, 3.34); ctx.stroke();

    // Freckles.
    ctx.fillStyle = 'rgba(60,40,20,0.5)';
    [[-9, hy + 7], [-11, hy + 9], [9, hy + 7], [11, hy + 9]].forEach(([fx, fy]) => {
      ctx.beginPath(); ctx.arc(fx, fy, 0.7, 0, 7); ctx.fill();
    });

    ctx.restore();
  }
}
