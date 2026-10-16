/* FitQuest — procedural background music (WebAudio, no audio files). One track per mood + camp + battle. */
(function (root) {
  'use strict';
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const Q = { m: [0, 3, 7], M: [0, 4, 7] };

  /* steps are 16th notes, one bar = 16 steps, chords advance one per bar.
     lead/bass patterns: index into chord tone (0,1,2, 3 = octave root) or -1 for rest; drums are step lists. */
  const TRACKS = {
    // sleepy and heavy, but with a slow pulse that says "keep going"
    lemes: { bpm: 62, root: 45, chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], pad: { w: 'sine', g: 0.1 }, bass: { w: 'sine', g: 0.22, p: [0, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1] },
      lead: { w: 'triangle', g: 0.07, oct: 1, p: [2, -1, -1, -1, -1, -1, 1, -1, -1, -1, 0, -1, -1, -1, -1, -1] }, kick: [0, 8], snare: [], hat: [], kg: 0.35 },
    // upbeat, steady, confident
    siap: { bpm: 108, root: 48, chords: [[0, 'M'], [-5, 'M'], [-3, 'm'], [-7, 'M']], pad: { w: 'triangle', g: 0.06 }, bass: { w: 'triangle', g: 0.3, p: [0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1] },
      lead: { w: 'square', g: 0.05, oct: 1, p: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 3, -1] }, kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], kg: 0.6 },
    // fast, aggressive, relentless
    api: { bpm: 154, root: 50, chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], pad: null, bass: { w: 'sawtooth', g: 0.2, p: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], lp: 700 },
      lead: { w: 'square', g: 0.06, oct: 1, grit: true, p: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 3, 2] }, kick: [0, 4, 8, 10, 12], snare: [4, 12, 14], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], kg: 0.8, crash: 4 },
    // in-game fight music: dark and driving
    battle: { bpm: 132, root: 52, chords: [[0, 'm'], [-4, 'M'], [-2, 'M'], [-5, 'M']], pad: { w: 'sawtooth', g: 0.03, lp: 900 }, bass: { w: 'sawtooth', g: 0.2, p: [0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0], lp: 800 },
      lead: { w: 'square', g: 0.05, oct: 1, grit: true, p: [0, -1, -1, 2, -1, 1, -1, 2, 0, -1, -1, 3, -1, 2, -1, 1] }, kick: [0, 4, 8, 12, 14], snare: [4, 12], hat: [2, 6, 10, 14], kg: 0.7, crash: 4 },
    // camp: warm and calm
    camp: { bpm: 72, root: 50, chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], pad: { w: 'sine', g: 0.09 }, bass: { w: 'sine', g: 0.18, p: [0, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1] },
      lead: { w: 'triangle', g: 0.06, oct: 1, p: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 2, -1, 1, -1, 0, -1] }, kick: [], snare: [], hat: [], kg: 0 },
  };

  const M = { ctx: null, master: null, comp: null, bus: null, timer: 0, tr: null, name: null, want: null, step: 0, next: 0, noise: null, enabled: true, vol: 0.6, ducked: false, shaper: null };
  const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;

  function ensure() {
    if (M.ctx || !AC) return !!M.ctx;
    try {
      M.ctx = new AC();
      M.comp = M.ctx.createDynamicsCompressor(); M.comp.threshold.value = -14; M.comp.ratio.value = 6;
      M.master = M.ctx.createGain(); M.comp.connect(M.master); M.master.connect(M.ctx.destination);
      const n = M.ctx.sampleRate * 1, b = M.ctx.createBuffer(1, n, M.ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; M.noise = b;
      const sh = M.ctx.createWaveShaper(), c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; c[i] = Math.tanh(x * 3); } sh.curve = c; M.shaper = sh;
      applyVol(true);
    } catch (e) { M.ctx = null; }
    return !!M.ctx;
  }
  function applyVol() {
    if (!M.master) return;
    const v = M.enabled ? Math.pow(M.vol, 1.6) * 0.8 * (M.ducked ? 0.45 : 1) : 0;
    M.master.gain.cancelScheduledValues(M.ctx.currentTime); M.master.gain.setTargetAtTime(v, M.ctx.currentTime, 0.15);
  }

  function env(g, t, a, dur, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  function note(freq, t, dur, o) {
    const c = M.ctx, osc = c.createOscillator(), g = c.createGain(); osc.type = o.w; osc.frequency.setValueAtTime(freq, t);
    let out = g; env(g, t, o.a || 0.01, dur, o.g);
    osc.connect(g);
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
    if (o.grit) { g.connect(M.shaper); out = M.shaper; }
    out.connect(M.bus); osc.start(t); osc.stop(t + dur + 0.05);
  }
  function kick(t, g) { const c = M.ctx, o = c.createOscillator(), a = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); env(a, t, 0.003, 0.22, g); o.connect(a); a.connect(M.bus); o.start(t); o.stop(t + 0.25); }
  function noiseHit(t, dur, g, hp) { const c = M.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), a = c.createGain(); s.buffer = M.noise; f.type = 'highpass'; f.frequency.value = hp; env(a, t, 0.002, dur, g); s.connect(f); f.connect(a); a.connect(M.bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02); }

  function playStep(step, t) {
    const tr = M.tr, s = step % 16, bar = Math.floor(step / 16), ch = tr.chords[bar % tr.chords.length], tones = Q[ch[1]].map((x) => ch[0] + x), sec = 60 / tr.bpm / 4;
    const midi = (idx, oct) => tr.root + (idx === 3 ? tones[0] + 12 : tones[idx]) + 12 * (oct || 0);
    if (s === 0 && tr.pad) tones.forEach((x) => note(hz(tr.root + 12 + x), t, sec * 16 * 0.98, { w: tr.pad.w, g: tr.pad.g, a: 0.5, lp: tr.pad.lp }));
    const b = tr.bass.p[s]; if (b >= 0) note(hz(midi(b, -1)), t, sec * (tr.bpm > 120 ? 1.6 : 3), { w: tr.bass.w, g: tr.bass.g * (s % 4 === 0 ? 1 : 0.75), lp: tr.bass.lp });
    const l = tr.lead.p[s]; if (l >= 0) note(hz(midi(l, tr.lead.oct)), t, sec * (tr.bpm > 120 ? 1.1 : 2.2), { w: tr.lead.w, g: tr.lead.g, grit: tr.lead.grit });
    if (tr.kick.includes(s)) kick(t, tr.kg);
    if (tr.snare.includes(s)) { noiseHit(t, 0.14, tr.kg * 0.55, 1500); }
    if (tr.hat.includes(s)) noiseHit(t, 0.04, tr.kg * (tr.hat.length > 8 ? 0.18 : 0.28), 7000);
    if (tr.crash && s === 0 && bar % tr.crash === 0) noiseHit(t, 0.9, tr.kg * 0.3, 4000);
  }
  function loop() {
    if (!M.ctx || !M.tr) return;
    const sec = 60 / M.tr.bpm / 4;
    while (M.next < M.ctx.currentTime + 0.18) { playStep(M.step, M.next); M.next += sec; M.step++; }
  }
  function start(name) {
    clearInterval(M.timer);
    if (M.bus) { const old = M.bus; old.gain.setTargetAtTime(0, M.ctx.currentTime, 0.12); setTimeout(() => { try { old.disconnect(); } catch (e) { /* */ } }, 700); }
    M.bus = M.ctx.createGain(); M.bus.gain.value = 1; M.bus.connect(M.comp);
    M.tr = TRACKS[name]; M.name = name; M.step = 0; M.next = M.ctx.currentTime + 0.08;
    M.timer = setInterval(loop, 30);
  }

  const api = {
    /* ask for a track; starts as soon as the browser allows audio (needs a tap first) */
    play(name) {
      M.want = name;
      if (!TRACKS[name] || !AC) return;
      if (!ensure()) return;
      if (M.ctx.state !== 'running') { M.ctx.resume().catch(() => {}); return; }
      if (M.name !== name && M.enabled) start(name);
    },
    stop() { M.want = null; M.name = null; clearInterval(M.timer); M.timer = 0; M.tr = null; if (M.bus) { M.bus.gain.setTargetAtTime(0, M.ctx.currentTime, 0.1); M.bus = null; } },
    setEnabled(on) { M.enabled = !!on; if (!M.ctx) { if (on && M.want) api.play(M.want); return; } applyVol(); if (on && M.want && M.name !== M.want) { M.name = null; api.play(M.want); } },
    setVolume(v) { M.vol = Math.max(0, Math.min(1, v)); applyVol(); },
    duck(on) { M.ducked = !!on; applyVol(); },
    current: () => M.name,
    tracks: Object.keys(TRACKS),
    unlock() { if (!AC) return; ensure(); if (M.ctx && M.ctx.state !== 'running') M.ctx.resume().then(() => { if (M.want && M.enabled && M.name !== M.want) { M.name = null; start(M.want); } }).catch(() => {}); },
    _state: () => ({ name: M.name, want: M.want, enabled: M.enabled, vol: M.vol }),
  };
  if (typeof document !== 'undefined') {
    const gesture = () => { api.unlock(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach((e) => document.addEventListener(e, gesture, { passive: true }));
    document.addEventListener('visibilitychange', () => { if (!M.ctx) return; if (document.hidden) M.ctx.suspend().catch(() => {}); else M.ctx.resume().catch(() => {}); });
  }
  root.FitMusic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
