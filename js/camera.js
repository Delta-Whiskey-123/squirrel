'use strict';

/* camera.js — a follow camera with a horizontal dead-zone and vertical panning.

   Horizontally: the player can roam within a central dead-zone before the view
   eases along, clamped to the level's start and end. Vertically: the view
   normally sits on the ground (y = 0), but when the player jumps up near the
   top of the screen the camera pans up so the player stays visible at all
   times; it never scrolls below the ground view. The zoom never changes — the
   camera only translates, and the sky fills the whole frame regardless. */

class Camera {
  constructor(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.x = 0;
    this.y = 0;

    // Half-width of the central dead-zone, in screen pixels. The player can
    // roam this far either side of centre before the camera starts to follow.
    this.deadzone = 240;
    // Keep the player's top at least this far below the top edge when panning.
    this.topMargin = 120;
    // Easing factor per frame toward the target (0..1); higher = snappier.
    this.lerp = 0.15;
  }

  // Snap instantly to frame the player (used on spawn / after a reset).
  snapTo(level, player) {
    this.x = this._clampX(level, player.cx - this.viewW / 2);
    this.y = this._targetY(player);
  }

  update(level, player, dt) {
    // --- Horizontal: dead-zone follow, clamped to the level bounds. ---
    const screenX = player.cx - this.x;
    const left = this.viewW / 2 - this.deadzone;
    const right = this.viewW / 2 + this.deadzone;

    let targetX = this.x;
    if (screenX < left)  targetX = player.cx - left;
    else if (screenX > right) targetX = player.cx - right;
    targetX = this._clampX(level, targetX);

    // Frame-rate independent easing (dt-based) toward the target.
    const t = 1 - Math.pow(1 - this.lerp, dt * 60);
    this.x += (targetX - this.x) * t;

    // --- Vertical: ease back toward the ground view, but snap up instantly
    //     whenever needed so the player is never lost off the top edge. ---
    const targetY = this._targetY(player);
    this.y += (targetY - this.y) * t;
    this.y = Math.min(this.y, player.y - this.topMargin); // guarantee visibility
    this.y = Math.min(0, this.y);                          // never below ground view
  }

  // Desired vertical scroll: 0 (ground view) unless the player has risen high
  // enough that keeping them below topMargin requires panning up (negative y).
  _targetY(player) {
    return Math.min(0, player.y - this.topMargin);
  }

  _clampX(level, x) {
    const maxX = Math.max(0, level.pixelW - this.viewW);
    return Math.min(maxX, Math.max(0, x));
  }
}
