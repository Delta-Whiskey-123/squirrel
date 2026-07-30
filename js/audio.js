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

  // Boing — a cartoon spring "boinng-oing-oing" for Battenberg's special third
  // jump. A rounded triangle tone snaps up in pitch on launch then wobbles
  // downward as it settles, with a medium (~16Hz), decaying vibrato you can hear
  // as distinct bounces (no metallic buzz). Rings out to ~800ms as a flourish.
  function boing() {
    ensure(); resume();
    if (!ctx) return;
    const t = ctx.currentTime, dur = 0.78;
    // Snap up on launch, then wobble downward as the spring settles.
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(360, t);
    o.frequency.exponentialRampToValueAtTime(650, t + 0.04);   // fast snap up
    o.frequency.exponentialRampToValueAtTime(240, t + dur);    // settle downward
    // Medium, decaying vibrato — distinct "oi-oi-oing" bounces, not a smear.
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(16, t);
    lfo.frequency.exponentialRampToValueAtTime(11, t + dur);   // slows as it settles
    lfoGain.gain.setValueAtTime(150, t);
    lfoGain.gain.exponentialRampToValueAtTime(2, t + dur);     // wobble shrinks away
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    // Soft attack, then a sustained ring-out so the wobble stays audible ~800ms.
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
    lfo.start(t); lfo.stop(t + dur + 0.02);
  }

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

  // Fanfare — crotchet, half-beat rest, semibreve at ~100 BPM (beat = 0.6s),
  // played once when the player finishes the final level. The crotchet is
  // itself a quick low-to-high arpeggio (C4 then C6), then a short silent
  // gap, then a slower upward-rolled C-major chord across four octaves that
  // crescendos in as a whole while it holds. No sparkle tail.
  function fanfare() {
    ensure(); resume();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const BEAT = 0.6;

    // A sustained voice with a real hold + release — tone()'s quick decay is far
    // too short to carry a long chord. Routes through an optional shared gain
    // node (dest) so a group of voices can be swelled together.
    function voice(type, f, start, peak, sustain, release, dest) {
      const t = t0 + start;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.03);                  // fast attack
      g.gain.setValueAtTime(peak, t + sustain);                            // hold
      g.gain.exponentialRampToValueAtTime(0.0001, t + sustain + release);  // release
      o.connect(g); g.connect(dest || master);
      o.start(t); o.stop(t + sustain + release + 0.05);
    }

    // Crotchet (beat 1) — arpeggiated low-then-high C, two octaves apart.
    tone('sawtooth', 262, 262, 0, 0.3, 0.15);
    tone('triangle', 262, 262, 0, 0.3, 0.20);
    tone('sawtooth', 1047, 1047, 0.18, 0.35, 0.11);
    tone('triangle', 1047, 1047, 0.18, 0.35, 0.14);

    // Rest (half beat) — silence from BEAT to BEAT*1.5.

    // Semibreve (four beats held, starting after the half-beat rest) — a
    // slower upward-rolled C-major chord across four octaves. All chord
    // voices route through a shared "swell" gain that ramps quiet-to-full
    // across the held duration, so the whole chord crescendos in together.
    const chordStart = BEAT * 1.5;
    const chordEnd = chordStart + BEAT * 4;
    const release = 1.0;

    const swell = ctx.createGain();
    const st = t0 + chordStart;
    swell.gain.setValueAtTime(0.08, st);
    swell.gain.exponentialRampToValueAtTime(1.0, t0 + chordEnd);
    swell.connect(master);

    const notes = [131, 262, 392, 523, 659, 784, 1047, 1319]; // C3 C4 G4 C5 E5 G5 C6 E6
    notes.forEach((f, i) => {
      const start = chordStart + i * 0.1;
      const sustain = chordEnd - start;
      const peak = f === 131 ? 0.14 : 0.09;
      voice('sawtooth', f, start, peak, sustain, release, swell);
      voice('triangle', f, start, peak + 0.02, sustain, release, swell);
    });
  }

  // Tick — a soft, short blip for the end-screen coin counts as they climb. The
  // pitch nudges up a semitone per step so a run of them feels like it ascends.
  function tick(step) {
    ensure(); resume();
    const f = 720 * Math.pow(2, (step || 0) / 12);
    tone('sine', f, f, 0, 0.05, 0.16);
  }

  // Own keydown listener: init the context on the first key, and handle M mute.
  function attach() {
    window.addEventListener('keydown', (e) => {
      ensure(); resume();
      if (e.code === 'KeyM') toggleMute();
    });
  }

  return { attach, ensure, resume, isMuted, toggleMute, jump, land, collect, boing, fanfare, tick };
})();
