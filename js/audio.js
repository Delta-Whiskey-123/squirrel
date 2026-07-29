'use strict';

/* audio.js — tiny synthesised sound-effects module (WebAudio, no files).

   One shared AudioContext, created lazily on the first key press (browser
   autoplay policy). A master gain feeds the speakers; the M key toggles mute,
   persisted to localStorage. Every sound is short and gentle for a 4-year-old:
   soft attacks, low volume, no harsh edges. */

const Sfx = (function () {
  const MUTE_KEY = 'squirrel.mute';
  const VOL = 0.35;
  let ctx = null, master = null;
  let muted = load();

  function load() { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; } }
  function save() { try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {} }

  // Create the context on first use (must happen inside a user gesture).
  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOL;
    master.connect(ctx.destination);
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function isMuted() { return muted; }
  function toggleMute() {
    muted = !muted; save();
    if (master) master.gain.value = muted ? 0 : VOL;
    return muted;
  }

  // An enveloped oscillator tone (soft attack, smooth decay).
  function tone(type, f0, f1, start, dur, peak) {
    if (!ctx) return;
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // A short low-passed noise burst (for the soft thud).
  function noise(start, dur, peak, cutoff) {
    if (!ctx) return;
    const t = ctx.currentTime + start;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur);
  }

  // --- The sounds ---
  function jump() { ensure(); resume(); tone('sine', 380, 720, 0, 0.12, 0.5); }         // rising blip (~120ms)
  function land() { ensure(); resume(); tone('sine', 190, 85, 0, 0.14, 0.45); noise(0, 0.10, 0.18, 350); } // soft thud (~140ms)

  function collect(tier) {
    ensure(); resume();
    if (tier === 'A') gold(); else if (tier === 'B') silver(); else bronze();
  }
  // Gold — the special tier: longer, warm shimmer (~440ms). Triangle arpeggio + sparkle tail.
  function gold() {
    [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, i * 0.09, 0.16, 0.34));
    tone('sine', 1568, 1568, 0.30, 0.14, 0.14);
  }
  // Silver — bright, clean sine bell ping (~150ms).
  function silver() { tone('sine', 880, 880, 0, 0.10, 0.34); tone('sine', 1318, 1318, 0.05, 0.10, 0.26); }
  // Bronze — rounder, hollow woody blip: square through a low-pass (~160ms).
  function bronze() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'square'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.14);
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.18);
  }

  // Own keydown listener: init the context on the first key, and handle M mute.
  function attach() {
    window.addEventListener('keydown', (e) => {
      ensure(); resume();
      if (e.code === 'KeyM') toggleMute();
    });
  }

  return { attach, ensure, resume, isMuted, toggleMute, jump, land, collect };
})();
