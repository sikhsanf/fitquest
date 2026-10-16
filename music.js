/* FitQuest — procedural background music (WebAudio, no audio files).
   Five tracks: lemes / siap / api (workout moods), battle (game), camp (home).
   16-step bars; layers (kick, bass, hats, clap, lead...) enter bar by bar so each track builds energy. */
(function (root) {
  'use strict';
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const CH = { m: [0, 3, 7], M: [0, 4, 7] };
  const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

  const TRACKS = {
    // slow-burn: groggy start, but there is a beat from the first bar and it builds every 2-4 bars
    lemes: {
      bpm: 98, root: 45, chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], kg: 0.9, sc: 0.55,
      in: { kick: 0, bass: 0, pad: 0, hat: 2, clap: 4, lead: 8, arp: 12 },
      pad: { w: 'sawtooth', g: 0.035, lp: 1100 },
      bass: { g: 0.3, lp: 700, p: [0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 3, -1] },
      lead: { w: 'triangle', g: 0.13, oct: 1, len: 2.4, p: [2, -1, -1, 1, -1, -1, 0, -1, 1, -1, 2, -1, -1, -1, 3, -1] },
      arp: { w: 'square', g: 0.04, oct: 2, len: 0.9, p: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 1, -1] },
      kick: [0, 8, 10], clap: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], oh: [14], hg: 0.5,
    },
    // upbeat four-on-the-floor, confident
    siap: {
      bpm: 126, root: 48, chords: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']], kg: 1, sc: 0.45, fill: 2, crash: 4,
      in: { kick: 0, bass: 0, pad: 0, hat: 0, clap: 1, lead: 4, arp: 8 },
      pad: { w: 'sawtooth', g: 0.04, lp: 1400 },
      bass: { g: 0.34, lp: 900, p: [0, -1, 3, 0, -1, 0, 3, -1, 0, -1, 3, 0, -1, 0, 3, -1] },
      lead: { w: 'sawtooth', sup: true, g: 0.1, oct: 1, len: 1.7, lp: 3200, p: [2, -1, 2, -1, 3, -1, 2, -1, 1, -1, 1, -1, 2, -1, -1, 1] },
      arp: { w: 'square', g: 0.04, oct: 2, len: 0.8, p: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 3] },
      kick: [0, 4, 8, 12], clap: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], oh: [2, 6, 10, 14], hg: 0.7,
    },
    // fast and relentless
    api: {
      bpm: 170, root: 50, chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], kg: 1.05, sc: 0.35, fill: 1, crash: 4,
      in: { kick: 0, bass: 0, hat: 0, clap: 0, lead: 0, arp: 4 },
      pad: null,
      bass: { g: 0.36, lp: 1000, p: [0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 3, 0, 3] },
      lead: { w: 'sawtooth', sup: true, g: 0.11, oct: 1, len: 1, lp: 3800, grit: true, p: [0, -1, 1, 0, -1, 2, -1, 1, 0, -1, 1, 0, -1, 3, 2, 1] },
      arp: { w: 'square', g: 0.045, oct: 2, len: 0.7, p: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 3, 2] },
      kick: [0, 4, 6, 8, 12, 14], clap: [4, 12], hat: ALL, oh: [2, 10], hg: 0.55,
    },
    // in-game fight music: dark, heavy, driving
    battle: {
      bpm: 142, root: 52, chords: [[0, 'm'], [-4, 'M'], [-2, 'M'], [-5, 'M']], kg: 1.05, sc: 0.4, fill: 1, crash: 4,
      in: { kick: 0, bass: 0, pad: 0, hat: 0, clap: 0, lead: 2, arp: 8 },
      pad: { w: 'sawtooth', g: 0.035, lp: 900 },
      bass: { g: 0.36, lp: 800, p: [0, -1, 0, 0, -1, 0, 0, -1, 0, -1, 0, 0, -1, 0, 3, 0] },
      lead: { w: 'sawtooth', sup: true, g: 0.1, oct: 1, len: 1.6, lp: 2600, grit: true, p: [0, -1, -1, 2, -1, 1, -1, 2, 0, -1, -1, 3, -1, 2, -1, 1] },
      arp: { w: 'square', g: 0.035, oct: 2, len: 0.7, p: [0, 2, 1, 2, 0, 2, 1, 3, 0, 2, 1, 2, 0, 2, 3, 2] },
      kick: [0, 4, 8, 10, 12], clap: [4, 12], tom: [11, 15], hat: [0, 2, 4, 6, 8, 10, 12, 14], oh: [6, 14], hg: 0.6,
    },
    // camp: warm and calm, no drums
    camp: {
      bpm: 76, root: 50, chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], kg: 0, sc: 0,
      in: { bass: 0, pad: 0, lead: 2 },
      pad: { w: 'sine', g: 0.09 },
      bass: { g: 0.2, lp: 500, sub: false, p: [0, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1] },
      lead: { w: 'triangle', g: 0.09, oct: 1, len: 2.4, p: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 2, -1, 1, -1, 0, -1] },
      kick: [], clap: [], hat: [], oh: [],
    },
  };

  const M = { ctx: null, master: null, comp: null, bus: null, padBus: null, timer: 0, tr: null, name: null, want: null, step: 0, next: 0, noise: null, enabled: true, vol: 0.7, ducked: false, shaper: null };
  const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  const masterGain = (vol, ducked) => Math.pow(vol, 1.4) * 0.55 * (ducked ? 0.45 : 1);

  function buildGraph(ctx) {
    M.ctx = ctx;
    M.comp = ctx.createDynamicsCompressor(); M.comp.threshold.value = -16; M.comp.ratio.value = 5; M.comp.attack && (M.comp.attack.value = 0.004); M.comp.release && (M.comp.release.value = 0.12);
    M.master = ctx.createGain(); M.comp.connect(M.master); M.master.connect(ctx.destination);
    const n = Math.floor(ctx.sampleRate), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; M.noise = b;
    const sh = ctx.createWaveShaper(), c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; c[i] = Math.tanh(x * 2.6); } sh.curve = c; M.shaper = sh;
    M.master.gain.value = masterGain(M.vol, M.ducked) * (M.enabled ? 1 : 0);
  }
  function ensure() {
    if (M.ctx || !AC) return !!M.ctx;
    try { buildGraph(new AC()); } catch (e) { M.ctx = null; }
    return !!M.ctx;
  }
  function applyVol() {
    if (!M.master) return;
    const v = M.enabled ? masterGain(M.vol, M.ducked) : 0;
    M.master.gain.cancelScheduledValues(M.ctx.currentTime); M.master.gain.setTargetAtTime(v, M.ctx.currentTime, 0.12);
  }

  function env(g, t, a, dur, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.02, dur)); }
  function tone(freq, t, dur, o) {
    const c = M.ctx, g = c.createGain();
    env(g, t, o.a || 0.008, dur, o.g);
    let out = g;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
    if (o.grit) { out.connect(M.shaper); out = M.shaper; }
    out.connect(o.bus || M.bus);
    const dets = o.sup ? [-14, 0, 14] : [0];
    for (const dt of dets) {
      const osc = c.createOscillator(); osc.type = o.w; osc.frequency.setValueAtTime(freq, t); if (dt) osc.detune.setValueAtTime(dt, t);
      const og = c.createGain(); og.gain.value = o.sup ? 0.5 : 1; osc.connect(og); og.connect(g); osc.start(t); osc.stop(t + dur + 0.06);
    }
  }
  function drum(t, f0, f1, len, g, type) { const c = M.ctx, o = c.createOscillator(), a = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.55); env(a, t, 0.002, len, g); o.connect(a); a.connect(M.bus); o.start(t); o.stop(t + len + 0.03); }
  function noiseHit(t, dur, g, f, type, q) { const c = M.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), a = c.createGain(); s.buffer = M.noise; fl.type = type || 'highpass'; fl.frequency.value = f; if (q) fl.Q.value = q; env(a, t, 0.002, dur, g); s.connect(fl); fl.connect(a); a.connect(M.bus); s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.03); }
  const kick = (t, g) => { drum(t, 170, 46, 0.26, g * 1.15); noiseHit(t, 0.015, g * 0.35, 3000, 'highpass'); };
  const snare = (t, g) => { noiseHit(t, 0.17, g * 0.7, 1700, 'bandpass', 0.7); drum(t, 230, 150, 0.1, g * 0.4, 'triangle'); };
  const clap = (t, g) => { for (let i = 0; i < 3; i++) noiseHit(t + i * 0.011, i === 2 ? 0.16 : 0.03, g * 0.6, 1300, 'bandpass', 0.9); };

  function playStep(step, t) {
    const tr = M.tr, s = step % 16, bar = Math.floor(step / 16), ch = tr.chords[bar % tr.chords.length], tones = CH[ch[1]].map((x) => ch[0] + x), sec = 60 / tr.bpm / 4;
    const on = (k) => tr.in[k] != null && bar >= tr.in[k];
    const midi = (idx, oct) => tr.root + (idx === 3 ? tones[0] + 12 : tones[idx]) + 12 * (oct || 0);
    const kg = tr.kg;
    if (s === 0 && tr.pad && on('pad')) tones.forEach((x) => tone(hz(tr.root + 12 + x), t, sec * 15.5, { w: tr.pad.w, g: tr.pad.g, a: 0.35, lp: tr.pad.lp, bus: M.padBus }));
    if (on('bass')) { const b = tr.bass.p[s]; if (b >= 0) { const acc = s % 4 === 0 ? 1 : 0.8, len = sec * (tr.bpm > 120 ? 1.7 : 1.9); tone(hz(midi(b, 0)), t, len, { w: 'sawtooth', g: tr.bass.g * acc, lp: tr.bass.lp }); if (tr.bass.sub !== false) tone(hz(midi(b, -1)), t, len, { w: 'sine', g: tr.bass.g * 0.9 * acc }); } }
    if (tr.lead && on('lead')) { const l = tr.lead.p[s]; if (l >= 0) tone(hz(midi(l, tr.lead.oct)), t, sec * tr.lead.len, { w: tr.lead.w, g: tr.lead.g, grit: tr.lead.grit, lp: tr.lead.lp, sup: tr.lead.sup }); }
    if (tr.arp && on('arp')) { const l = tr.arp.p[s]; if (l >= 0) tone(hz(midi(l, tr.arp.oct)), t, sec * tr.arp.len, { w: tr.arp.w, g: tr.arp.g }); }
    if (kg) {
      if (on('kick') && tr.kick.includes(s)) { kick(t, kg); if (tr.sc && M.padBus) { M.padBus.gain.setValueAtTime(tr.sc, t); M.padBus.gain.linearRampToValueAtTime(1, t + sec * 2.2); } }
      const fill = tr.fill && bar % 4 === 3 && s >= 16 - 4 * (tr.fill === 1 ? 1 : 0.5);
      if (on('clap') && tr.clap.includes(s) && !fill) { if (tr.bpm > 130) snare(t, kg); else clap(t, kg); }
      if (fill && (tr.fill === 1 || s % 2 === 0)) snare(t, kg * (0.6 + (s - 12) * 0.1));
      if (tr.tom && bar % 2 === 1 && tr.tom.includes(s)) drum(t, 140, 80, 0.2, kg * 0.7);
      if (on('hat') && tr.hat.includes(s)) noiseHit(t, 0.035, kg * (tr.hg || 0.5) * (s % 4 === 2 ? 0.45 : 0.3), 8000);
      if (on('hat') && tr.oh.includes(s)) noiseHit(t, 0.16, kg * 0.28, 7000);
      if (tr.crash && s === 0 && bar % tr.crash === 0 && bar > 0) noiseHit(t, 1.2, kg * 0.32, 4500);
    }
  }
  function loop() {
    if (!M.ctx || !M.tr) return;
    const sec = 60 / M.tr.bpm / 4;
    while (M.next < M.ctx.currentTime + 0.2) { playStep(M.step, M.next); M.next += sec; M.step++; }
  }
  function newBus() {
    M.bus = M.ctx.createGain(); M.bus.gain.value = 1; M.bus.connect(M.comp);
    M.padBus = M.ctx.createGain(); M.padBus.gain.value = 1; M.padBus.connect(M.bus);
  }
  function start(name) {
    clearInterval(M.timer);
    if (M.bus) { const old = M.bus; old.gain.setTargetAtTime(0, M.ctx.currentTime, 0.12); setTimeout(() => { try { old.disconnect(); } catch (e) { /* */ } }, 700); }
    newBus();
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
    stop() { M.want = null; M.name = null; clearInterval(M.timer); M.timer = 0; M.tr = null; if (M.bus && M.ctx) { M.bus.gain.setTargetAtTime(0, M.ctx.currentTime, 0.1); M.bus = null; } },
    setEnabled(on) { M.enabled = !!on; if (!M.ctx) { if (on && M.want) api.play(M.want); return; } applyVol(); if (on && M.want && M.name !== M.want) { M.name = null; api.play(M.want); } },
    setVolume(v) { M.vol = Math.max(0, Math.min(1, v)); applyVol(); },
    duck(on) { M.ducked = !!on; applyVol(); },
    current: () => M.name,
    tracks: Object.keys(TRACKS),
    unlock() { if (!AC) return; ensure(); if (M.ctx && M.ctx.state !== 'running') M.ctx.resume().then(() => { if (M.want && M.enabled && M.name !== M.want) { M.name = null; start(M.want); } }).catch(() => {}); },
    _state: () => ({ name: M.name, want: M.want, enabled: M.enabled, vol: M.vol }),
    /* offline render for tests/analysis: returns mono Float32Array */
    async _render(name, secs, sr) {
      const OC = window.OfflineAudioContext, saved = Object.assign({}, M); sr = sr || 22050;
      try {
        const ctx = new OC(1, Math.floor(sr * secs), sr); M.vol = 1; M.ducked = false; M.enabled = true; buildGraph(ctx); newBus();
        M.tr = TRACKS[name]; M.step = 0; M.next = 0; const sec = 60 / M.tr.bpm / 4;
        while (M.next < secs) { playStep(M.step, M.next); M.next += sec; M.step++; }
        return (await ctx.startRendering()).getChannelData(0);
      } finally { Object.assign(M, saved); }
    },
  };
  if (typeof document !== 'undefined') {
    const gesture = () => { api.unlock(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach((e) => document.addEventListener(e, gesture, { passive: true }));
    document.addEventListener('visibilitychange', () => { if (!M.ctx) return; if (document.hidden) M.ctx.suspend().catch(() => {}); else M.ctx.resume().catch(() => {}); });
  }
  root.FitMusic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
