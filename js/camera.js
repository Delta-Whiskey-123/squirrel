'use strict';

/* camera.js — a horizontal follow camera with a dead-zone.

   The player can move freely within a central dead-zone band without the view
   moving; push past its edge and the camera eases (lerps) to keep the player
   just inside it. The result is clamped hard to the level bounds so you never
   see past the start or end. The level is one screen tall for now, so the
   vertical position stays fixed. */

class Camera {
  constructor(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.x = 0;
    this.y = 0;

    // Half-width of the central dead-zone, in screen pixels. The player can
    // roam this far either side of centre before the camera starts to follow.
    this.deadzone = 240;
    // Easing factor per frame toward the target (0..1); higher = snappier.
    this.lerp = 0.15;
  }

  // Snap instantly to frame the player (used on spawn / after a reset).
  snapTo(level, player) {
    this.x = this._clampX(level, player.cx - this.viewW / 2);
    this.y = 0;
  }

  update(level, player, dt) {
    // Where the player sits on screen right now.
    const screenX = player.cx - this.x;
    const left = this.viewW / 2 - this.deadzone;
    const right = this.viewW / 2 + this.deadzone;

    // Only move the camera when the player leaves the dead-zone.
    let targetX = this.x;
    if (screenX < left)  targetX = player.cx - left;
    else if (screenX > right) targetX = player.cx - right;

    targetX = this._clampX(level, targetX);

    // Frame-rate independent easing (dt-based) toward the target.
    const t = 1 - Math.pow(1 - this.lerp, dt * 60);
    this.x += (targetX - this.x) * t;
    this.y = 0;
  }

  _clampX(level, x) {
    const maxX = Math.max(0, level.pixelW - this.viewW);
    return Math.min(maxX, Math.max(0, x));
  }
}
