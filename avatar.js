/* FitQuest — pixel art generator: avatar (height/weight/hair/clothes/muscle stages), mood persons, monsters, weapons. */
(function (root) {
  'use strict';
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rgb = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

  class Buf {
    constructor(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); this.anchors = null; }
    get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.p[y * this.w + x]; }
    set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.p[y * this.w + x] = c; }
    setM(x, y, c) { this.set(x, y, c); this.set(this.w - 1 - Math.round(x), y, c); }
    rect(x, y, w, h, c, m) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) (m ? this.setM : this.set).call(this, x + i, y + j, c); }
    circle(cx, cy, r, c, m) {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r + 0.5) (m ? this.setM : this.set).call(this, x, y, c);
      }
    }
    line(x0, y0, x1, y1, c, m) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (;;) {
        (m ? this.setM : this.set).call(this, x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) { e += dy; x0 += sx; }
        if (e2 <= dx) { e += dx; y0 += sy; }
      }
    }
  }

  function outline(B, c) {
    const add = [];
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      if (B.get(x, y) !== null) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const v = B.get(x + dx, y + dy); return v !== null && v !== c; })) add.push([x, y]);
    }
    add.forEach(([x, y]) => B.set(x, y, c));
  }
  function shade(B) {
    const src = B.p.slice();
    const g = (x, y) => (x < 0 || y < 0 || x >= B.w || y >= B.h ? null : src[y * B.w + x]);
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      const c = g(x, y);
      if (c === 'k' || c === 'p' || c === 't' || c === 'ja' || c === 'rv' || c === 'mt' || c === 'st') {
        if (g(x - 1, y) === null) B.set(x, y, c + 'h');
        else if (g(x + 1, y) === null) B.set(x, y, c + 's');
      }
    }
  }

  const SKINS = ['#f3cfae', '#dba274', '#b57a4e', '#7b4c30'];
  const HAIRS = ['botak', 'cepak', 'pendek', 'jabrik', 'panjang', 'kuncir'];
  const HAIR_NAMES = { botak: 'Botak', cepak: 'Cepak', pendek: 'Pendek', jabrik: 'Jabrik', panjang: 'Panjang', kuncir: 'Kuncir' };
  const HAIR_COLORS = ['#2a1d16', '#6b4226', '#d8b25a', '#9aa3ad', '#b5402f'];
  const SHIRTS = ['shirtless', 'singlet', 'kaos'];
  const SHIRT_NAMES = { shirtless: 'Shirtless', singlet: 'Singlet', kaos: 'Kaos' };
  const SHIRT_COLORS = ['#e8e8e8', '#2e8b57', '#c0392b', '#2b6cb0', '#2b2b33', '#e0a82e'];

  function palette(skin, hair, shirt) {
    skin = skin || SKINS[1]; hair = hair || HAIR_COLORS[0]; shirt = shirt || SHIRT_COLORS[0];
    return {
      k: skin, kh: mix(skin, '#ffffff', 0.2), ks: mix(skin, '#000000', 0.22), l: mix(skin, '#000000', 0.4), h: mix(skin, '#ffffff', 0.3),
      t: shirt, th: mix(shirt, '#ffffff', 0.2), ts: mix(shirt, '#000000', 0.25),
      p: '#3d4452', ph: '#566074', ps: '#2b303a',
      x: '#f2f2f2', xs: '#7d8594',
      ja: '#8a5a2b', jah: '#a87238', jas: '#5e3b1a', rv: '#56683f', rvh: '#6d8350', rvs: '#3b4a2a', mt: '#2f343c', mth: '#4a5260', mts: '#1e2228', mo: '#e0782a', st: '#b9c3cf', sth: '#e6edf5', sts: '#7a8695', r: hair, rb: mix(skin, hair, 0.6), w: '#ffffff', d: '#231a16', o: '#150f0b',
    };
  }
  const palFor = (b) => palette(b && b.skin, b && b.hairColor, b && b.shirtColor);

  const GROUPS = {
    kaki: { name: 'Kaki', full: 'Kaki (betis)', muscles: ['calves'] },
    paha: { name: 'Paha', full: 'Paha & bokong', muscles: ['quads', 'hamstrings', 'glutes'] },
    core: { name: 'Core', full: 'Core (perut & pinggang)', muscles: ['abs', 'obliques', 'lower_back'] },
    lengan: { name: 'Lengan', full: 'Lengan', muscles: ['biceps', 'triceps', 'forearms'] },
    dada: { name: 'Dada', full: 'Dada', muscles: ['chest'] },
    bahu: { name: 'Bahu', full: 'Bahu & punggung', muscles: ['shoulders', 'upper_back'] },
  };
  const STAGE_EVERY = 5, MAX_STAGE = 10;
  const stageOf = (L) => Math.max(0, Math.min(MAX_STAGE, Math.floor(L / STAGE_EVERY)));
  const nextStageLevel = (L) => (stageOf(L) >= MAX_STAGE ? null : (stageOf(L) + 1) * STAGE_EVERY);
  /* stage 0..10 -> shape numbers. definition tier changes at stage 1/4/7, widths at 2/5/8/10, glints at 3/6/9 => something visible every stage */
  const tierOf = (s) => (s >= 1) + (s >= 4) + (s >= 7);
  const wdOf = (s) => Math.floor((s + 1) / 3) + (s >= 10 ? 1 : 0);
  const glOf = (s) => Math.floor(s / 3);

  /* ================= the avatar ================= */
  const W = 64, H = 88;
  function build(o) {
    const B = new Buf(W, H);
    const st = Object.assign({ kaki: 0, paha: 0, core: 0, lengan: 0, dada: 0, bahu: 0 }, o.stages || {});
    const hair = o.hair || 'pendek', shirt = o.shirt || 'shirtless';
    const height = o.height || 170, weight = o.weight || 65;
    const hF = clamp((height - 145) / 50);
    const bmi = weight / Math.pow(height / 100, 2);
    const bf = clamp((bmi - 17) / 14);
    const belly = clamp((bmi - 24) / 8) * (1 - 0.065 * st.core);
    const T = {}, WD = {}, GL = {};
    for (const k in st) { T[k] = tierOf(st[k]); WD[k] = wdOf(st[k]); GL[k] = glOf(st[k]); }

    const legLen = 24 + Math.round(hF * 10), yAnk = 82, yHip = yAnk - legLen, yS = yHip - 26;
    const hipH = 7 + Math.round(2 * bf) + Math.min(2, Math.floor(WD.paha / 2));
    const tw = hipH, tk = Math.max(4, tw - 3), thighLen = Math.round(legLen * 0.5), kneeY = yHip + thighLen;
    const tc = 4 + Math.round(bf) + Math.min(3, WD.kaki), ta = 4;
    const c0 = 31 - (tw - 1) / 2;
    const legCols = (w) => { const l = Math.round(c0 - (w - 1) / 2); return [l, l + w - 1]; };

    // ---- legs + shorts
    const shortsEnd = yHip + Math.round(thighLen * 0.55);
    for (let y = yHip; y <= yAnk; y++) {
      let w;
      if (y < kneeY) w = lerp(tw, tk, (y - yHip) / thighLen);
      else { const u = (y - kneeY) / (yAnk - kneeY); w = u < 0.3 ? lerp(tk, tc, u / 0.3) : lerp(tc, ta, (u - 0.3) / 0.7); }
      w = Math.max(3, Math.round(w));
      const [l, r] = legCols(w);
      for (let x = l; x <= r; x++) B.setM(x, y, y <= shortsEnd ? 'p' : 'k');
    }
    { const [l, r] = legCols(ta); for (let y = yAnk + 1; y <= yAnk + 3; y++) for (let x = l - 2; x <= r + 1; x++) B.setM(x, y, y === yAnk + 3 ? 'xs' : 'x'); }

    // ---- torso geometry (arms are placed from the torso's widest point so they never fuse with it)
    const torsoH = yHip - yS;
    const chestH = 8 + Math.round(2 * bf) + [0, 0, 1, 1, 2][Math.min(4, WD.dada)];
    const waistH = Math.max(4, 6 + Math.round(2.5 * bf) + Math.round(belly * 4) - Math.min(2, Math.ceil(WD.core / 2))); // core training slims the waist
    const baseHalf = (y) => {
      const u = (y - (yS + 4)) / (torsoH - 4);
      let half = u < 0.55 ? lerp(chestH, waistH, u / 0.55) : lerp(waistH, hipH, (u - 0.55) / 0.45);
      if (belly > 0 && u > 0.25 && u < 0.95) half += belly * 2.5 * Math.sin((Math.PI * (u - 0.25)) / 0.7);
      return Math.round(half);
    };
    let M = hipH;
    for (let y = yS + 4; y < yHip; y++) M = Math.max(M, baseHalf(y));
    const ta0 = [3, 3, 4, 4, 5][Math.min(4, WD.lengan)];
    const armIn = 32 - M - 2;
    const armC = armIn - (ta0 - 1) / 2;
    const halfTop = 32 - Math.round(armC);

    const torsoCode = (y, d, half) => {
      if (y >= yHip - 3) return 'p';
      if (shirt === 'shirtless') return 'k';
      if (shirt === 'kaos') { if (y <= yS + 1 && d <= 2) return 'k'; if (y === yS + 2 && d <= 1) return 'k'; return 't'; }
      if (y <= yS + 5) return d >= 3 && d <= 5 ? 't' : 'k';
      if (y <= yS + 8 && d <= 3) return 'k';
      if (y <= yS + 10 && d > half - 2) return 'k';
      return 't';
    };
    for (let y = yS; y < yHip; y++) {
      let half;
      if (y === yS) half = halfTop - 3; else if (y === yS + 1) half = halfTop - 1; else if (y <= yS + 3) half = halfTop; else half = baseHalf(y);
      half = Math.max(3, half);
      for (let x = 32 - half; x <= 31; x++) B.setM(x, y, torsoCode(y, 32 - x, half));
    }
    for (let y = yS - 3; y < yS; y++) for (let x = 30; x <= 31; x++) B.setM(x, y, 'k');
    for (let x = 28; x <= 31; x++) B.setM(x, yS - 1, 'k');

    // ---- arms
    const yElbow = yS + 13;
    for (let y = yS + 2; y <= yS + 28; y++) {
      let w, shift = 0;
      if (y <= yElbow) w = Math.max(3, ta0 - (Math.abs(y - (yS + 7)) > 3 ? 1 : 0));
      else if (y <= yS + 24) { w = 3 + (WD.lengan >= 2 ? 1 : 0); shift = -1; } else { w = 3; shift = -1; }
      const code = shirt === 'kaos' && y <= yS + 9 ? 't' : 'k';
      for (let x = armIn - w + 1 + shift; x <= armIn + shift; x++) B.setM(x, y, code);
    }
    B.circle(armC, yS + 4, ta0 / 2 + 0.7, shirt === 'kaos' ? 't' : 'k', true); // deltoid cap

    // ---- head + hair + face
    const yH = yS - 17;
    const headHalf = [4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 5, 4, 3];
    for (let i = 0; i < headHalf.length; i++) for (let x = 32 - headHalf[i]; x <= 31; x++) B.setM(x, yH + i, 'k');
    const pd = (d, y, c) => B.setM(32 - d, y, c);
    const hairPendek = () => {
      for (let i = 0; i <= 3; i++) for (let d = 1; d <= headHalf[i]; d++) pd(d, yH + i, 'r');
      for (let i = 4; i <= 6; i++) pd(headHalf[i], yH + i, 'r');
      pd(2, yH + 4, 'r'); pd(3, yH + 4, 'r');
    };
    if (hair === 'cepak') { for (let i = 0; i <= 2; i++) for (let d = 1; d <= headHalf[i]; d++) pd(d, yH + i, 'rb'); for (let i = 3; i <= 4; i++) pd(headHalf[i], yH + i, 'rb'); }
    else if (hair === 'pendek') hairPendek();
    else if (hair === 'jabrik') {
      hairPendek();
      for (const d of [1, 2, 4, 5]) pd(d, yH - 1, 'r');
      for (const d of [2, 5]) pd(d, yH - 2, 'r');
      pd(3, yH - 1, 'r'); pd(6, yH, 'r'); pd(6, yH - 1, 'r');
    } else if (hair === 'panjang') {
      hairPendek();
      for (let y = yH + 3; y <= yS + 6; y++) { pd(7, y, 'r'); pd(8, y, 'r'); if (y >= yH + 7) pd(6, y, 'r'); }
    } else if (hair === 'kuncir') {
      hairPendek();
      for (let d = 1; d <= 2; d++) pd(d, yH - 3, 'r');
      for (let d = 1; d <= 3; d++) { pd(d, yH - 2, 'r'); pd(d, yH - 1, 'r'); }
    }
    pd(3, yH + 8, 'd'); pd(3, yH + 9, 'd');
    pd(2, yH + 12, 'd'); pd(1, yH + 12, 'd'); pd(3, yH + 11, 'd');

    shade(B);

    // ---- muscle definition (clothes-aware: lines become fabric tension under shirts)
    const setL = (x, y, hi) => { const c = B.get(x, y); if (!c || (c[0] !== 'k' && c[0] !== 't')) return; B.set(x, y, c[0] === 't' ? (hi ? 'th' : 'ts') : (hi ? 'h' : 'l')); };
    const LM = (x, y) => { setL(x, y, false); setL(W - 1 - x, y, false); };
    const HM = (x, y) => { setL(x, y, true); setL(W - 1 - x, y, true); };
    const LL = (x, y) => setL(x, y, false);
    const HL = (x, y) => setL(x, y, true);
    if (T.dada >= 1) for (let x = 32 - chestH + 2; x <= 30; x++) LM(x, yS + 10);
    if (T.dada >= 2) { for (let y = yS + 4; y <= yS + 10; y++) LM(31, y); for (let x = 27; x <= 30; x++) LM(x, yS + 3); }
    if (T.dada >= 3) { for (let x = 32 - chestH + 3; x <= 29; x++) HM(x, yS + 6); LM(32 - chestH + 2, yS + 9); }
    for (let i = 0; i < GL.dada; i++) { HM(28 - i, yS + 7 + (i % 2)); HM(29 - i, yS + 5); }
    if (T.core >= 1) for (let y = yS + 12; y <= yHip - 5; y++) LM(31, y);
    if (T.core >= 2) for (const yy of T.core >= 3 ? [yS + 14, yS + 17, yS + 20] : [yS + 15, yS + 19]) for (let x = 27; x <= 30; x++) LM(x, yy);
    if (T.core >= 3) { for (let y = yS + 13; y <= yS + 20; y++) LM(32 - waistH + 2, y); }
    for (let i = 0; i < GL.core; i++) for (const yy of [yS + 12 + i * 3, yS + 15 + i * 3]) for (let x = 28; x <= 30; x++) if (yy < yHip - 5) HM(x, yy);
    if (T.paha >= 2) for (let y = yHip + 7; y <= kneeY - 2; y++) { LL(31 - Math.round(tw * 0.35), y); LL(32 + Math.round(tw * 0.35), y); }
    if (T.paha >= 3) for (let y = yHip + 8; y <= kneeY - 3; y++) { HL(31 - Math.round(tw * 0.7), y); HL(32 + Math.round(tw * 0.7), y); }
    for (let i = 0; i < GL.paha; i++) for (let y = yHip + 9 + i * 2; y <= yHip + 11 + i * 2; y++) { HL(31 - Math.round(tw * 0.55), y); HL(32 + Math.round(tw * 0.55), y); }
    if (T.kaki >= 2) { const yy = kneeY + Math.round((yAnk - kneeY) * 0.2); for (let y = yy; y < yy + 5; y++) LM(Math.round(c0), y); }
    if (T.kaki >= 3) { const yy = kneeY + Math.round((yAnk - kneeY) * 0.15); for (let y = yy; y < yy + 4; y++) HM(Math.round(c0 - tc / 2 + 1.5), y); }
    for (let i = 0; i < GL.kaki; i++) { const yy = kneeY + 4 + i * 3; HM(Math.round(c0 - tc / 2 + 1.5), yy); HM(Math.round(c0 - tc / 2 + 1.5), yy + 1); }
    if (T.lengan >= 1) { HM(Math.round(armC) - 1, yS + 6); HM(Math.round(armC) - 1, yS + 7); }
    if (T.lengan >= 2) { LM(Math.round(armC) - 1, yS + 10); LM(Math.round(armC), yS + 11); HM(Math.round(armC), yS + 5); }
    if (T.lengan >= 3) { LM(Math.round(armC) - 1, yS + 8); LM(Math.round(armC), yS + 9); }
    for (let i = 0; i < GL.lengan; i++) { HM(Math.round(armC), yS + 12 + (i % 3)); HM(Math.round(armC) - 1, yS + 14 + i % 2); }
    if (T.bahu >= 1) { LM(27, yS + 1); LM(26, yS + 2); }
    if (T.bahu >= 2) { HM(Math.round(armC), yS + 3); HM(Math.round(armC) + 1, yS + 3); }
    if (T.bahu >= 3) { LM(28, yS + 2); }
    for (let i = 0; i < GL.bahu; i++) { HM(Math.round(armC) + 1 + i, yS + 2); }

    outline(B, 'o');
    B.meta = { yH, yS, yHip };

    // where each muscle group sits on the sprite (left/right = side its label hangs on)
    B.anchors = {
      bahu: { x: Math.round(armC), y: yS + 4, side: 'l' },
      lengan: { x: Math.round(armC), y: yS + 10, side: 'l' },
      paha: { x: Math.round(c0), y: shortsEnd + 3, side: 'l' },
      dada: { x: W - 1 - (32 - Math.round(chestH * 0.55)), y: yS + 7, side: 'r' },
      core: { x: 34, y: yS + 17, side: 'r' },
      kaki: { x: W - 1 - Math.round(c0), y: kneeY + Math.round((yAnk - kneeY) * 0.35), side: 'r' },
    };
    return B;
  }

  /* ================= mood persons (3 pilihan semangat) — 32x40, uses the player's own look ================= */
  function person(mood, o) {
    o = o || {};
    const B = new Buf(32, 40);
    const hair = o.hair || 'pendek', shirt = o.shirt || 'shirtless';
    const lemes = mood === 'lemes', siap = mood === 'siap', api = mood === 'api';
    const P = (d, y, c) => B.setM(16 - d, y, c);
    const flameCol = (cx, y0, y1, wmax, phase) => {
      for (let y = y1; y >= y0; y--) {
        const t = (y1 - y) / Math.max(1, y1 - y0), w = Math.max(0, Math.round(wmax * (1 - t * 0.9)));
        const off = Math.round(Math.sin(y * 0.7 + phase) * 1.2);
        for (let i = -w; i <= w; i++) B.set(cx + off + i, y, '#e0432b');
        const w2 = Math.round(w * 0.62); for (let i = -w2; i <= w2; i++) B.set(cx + off + i, y, '#ff8a2a');
        const w3 = Math.round(w * 0.3); for (let i = -w3; i <= w3; i++) B.set(cx + off + i, y, '#ffd23f');
      }
    };

    if (siap) { // sunrise behind
      B.circle(15.5, 17, 12, '#ffcf4a'); B.circle(15.5, 17, 8.5, '#ffe58a');
      for (let a = 0; a < 360; a += 30) { const r = (a * Math.PI) / 180; B.line(15.5 + Math.cos(r) * 13.5, 17 + Math.sin(r) * 13.5, 15.5 + Math.cos(r) * 16, 17 + Math.sin(r) * 16, '#ffb02e'); }
    }
    if (api) { flameCol(4, 10, 36, 4, 0); flameCol(27, 10, 36, 4, 2); flameCol(8, 22, 37, 2, 1); flameCol(23, 22, 37, 2, 3); }

    const yHead = lemes ? 8 : 4;
    const yT = yHead + 10, torsoH = lemes ? 10 : 11;
    const yLegTop = yT + torsoH;

    // legs + shoes
    for (let y = yLegTop; y <= 36; y++) for (let d = 2; d <= 5; d++) P(d + (lemes && y > 31 ? 0 : 0), y, y < yLegTop + 3 ? 'p' : 'k');
    for (let y = 37; y <= 38; y++) for (let d = 1; d <= 6; d++) P(d, y, y === 38 ? 'xs' : 'x');

    // torso
    const torsoCode = (y, d) => {
      if (y >= yT + torsoH - 3) return 'p';
      if (shirt === 'shirtless') return 'k';
      if (shirt === 'singlet') return d <= 4 ? 't' : 'k';
      return 't';
    };
    for (let y = yT; y < yT + torsoH; y++) {
      const half = lemes && y <= yT + 1 ? 4 : 5;
      for (let d = 1; d <= half; d++) P(d, y, torsoCode(y, d));
    }
    P(1, yT - 1, 'k'); P(2, yT - 1, 'k'); // neck

    // arms
    const armCode = (y, i) => (shirt === 'kaos' && i < 3 ? 't' : 'k');
    if (lemes) { for (let y = yT + 1; y <= yT + torsoH + 3; y++) for (let d = 6; d <= 7; d++) P(d, y, armCode(y, y - yT - 1)); for (let d = 6; d <= 7; d++) { P(d, yT + torsoH + 4, 'k'); } }
    else if (siap) {
      for (let y = yT + 1; y <= yT + 6; y++) for (let d = 6; d <= 7; d++) P(d, y, armCode(y, y - yT - 1));
      for (let y = yT - 2; y <= yT; y++) for (let d = 6; d <= 7; d++) P(d, y, 'k');
      for (let y = yT - 4; y <= yT - 3; y++) for (let d = 5; d <= 7; d++) P(d, y, 'k');
    } else {
      for (let d = 6; d <= 11; d++) { P(d, yT + 1, armCode(0, d - 6)); P(d, yT + 2, armCode(0, d - 6)); }
      for (let y = yT - 6; y <= yT; y++) for (let d = 10; d <= 11; d++) P(d, y, 'k');
      for (let y = yT - 9; y <= yT - 7; y++) for (let d = 9; d <= 12; d++) P(d, y, 'k');
    }

    // head
    for (let i = 0; i < 9; i++) { const hh = i === 0 || i === 8 ? 4 : 5; for (let d = 1; d <= hh; d++) P(d, yHead + i, 'k'); }
    // hair
    if (api) {
      flameCol(15, yHead - 8, yHead + 1, 4, 1); flameCol(11, yHead - 5, yHead + 1, 2, 2); flameCol(20, yHead - 5, yHead + 1, 2, 0);
    } else {
      const cap = () => { for (let i = -1; i <= 1; i++) for (let d = 1; d <= 5; d++) P(d, yHead + i, 'r'); P(5, yHead + 2, 'r'); P(5, yHead + 3, 'r'); };
      if (hair === 'cepak') { for (let i = 0; i <= 1; i++) for (let d = 1; d <= 5; d++) P(d, yHead + i, 'rb'); }
      else if (hair === 'pendek') cap();
      else if (hair === 'jabrik') { cap(); for (const d of [1, 3, 5]) { P(d, yHead - 2, 'r'); } P(2, yHead - 3, 'r'); P(4, yHead - 3, 'r'); }
      else if (hair === 'panjang') { cap(); for (let y = yHead + 2; y <= yT + 3; y++) { P(5, y, 'r'); P(6, y, 'r'); } }
      else if (hair === 'kuncir') { cap(); for (let d = 1; d <= 2; d++) { P(d, yHead - 3, 'r'); P(d, yHead - 2, 'r'); } }
    }
    // face
    if (lemes) {
      P(3, yHead + 5, 'd'); P(4, yHead + 5, 'd'); P(3, yHead + 6, 'ks'); P(4, yHead + 6, 'ks');
      P(1, yHead + 7, 'd'); P(2, yHead + 7, 'd'); P(3, yHead + 8, 'd');
      B.set(26, yHead + 2, '#7fc8ff'); B.set(26, yHead + 3, '#7fc8ff'); B.set(26, yHead + 4, '#4a9ee0');
      for (const [x, y] of [[22, 2], [23, 2], [23, 3], [22, 4], [23, 4], [26, 0], [27, 0], [26, 1]]) B.set(x, y, '#9fb4ff');
    } else if (siap) {
      P(3, yHead + 4, 'd'); P(3, yHead + 5, 'd'); P(4, yHead + 3, 'd'); P(3, yHead + 3, 'd');
      P(1, yHead + 7, 'd'); P(2, yHead + 7, 'd'); P(3, yHead + 6, 'd');
    } else {
      P(3, yHead + 4, 'w'); P(3, yHead + 5, 'd'); P(4, yHead + 2, 'd'); P(3, yHead + 3, 'd'); P(2, yHead + 3, 'd');
      P(1, yHead + 7, 'd'); P(2, yHead + 7, 'd'); P(1, yHead + 8, 'd'); P(2, yHead + 8, 'd');
    }
    shade(B);
    outline(B, 'o');
    return B;
  }

  /* ================= monsters (face LEFT) ================= */
  function monster(kind, frame, tint) {
    tint = tint || '#8fae7a';
    const dark = mix(tint, '#000000', 0.35);
    if (kind === 'anjing') {
      const B = new Buf(28, 16);
      const fur = mix('#6b6b73', tint, 0.15), furD = '#45454d';
      B.rect(7, 5, 16, 6, fur); B.rect(1, 3, 9, 6, fur); B.rect(0, 6, 4, 3, furD);
      B.set(4, 4, '#ff3b3b'); B.set(5, 4, '#ff3b3b'); B.set(2, 8, '#fff'); B.set(4, 8, '#fff');
      B.rect(7, 3, 2, 2, furD);
      for (let i = 0; i < 5; i++) B.rect(9 + i * 3, 3, 2, 2, '#9b2b2b');
      B.rect(23, 4, 4, 2, furD); B.set(27, 3, furD);
      const f = frame % 2;
      B.rect(8 + f * 2, 11, 3, 4, furD); B.rect(13 - f * 2, 11, 3, 4, furD); B.rect(17 + f * 2, 11, 3, 4, furD); B.rect(21 - f * 2, 11, 3, 4, furD);
      B.rect(7, 9, 16, 2, furD);
      outline(B, '#150f0b'); return B;
    }
    const big = kind === 'raksasa';
    const B = new Buf(20, 30);
    const skin = tint, pants = '#3a3f52', shirt = big ? '#5a3a3a' : '#6a4f3a';
    B.circle(9, 5, 4.2, skin); B.rect(5, 2, 8, 2, '#3a3a2a');
    B.set(6, 5, '#ff3b3b'); B.set(8, 5, '#ff3b3b'); B.rect(5, 8, 5, 1, dark); B.set(6, 8, '#fff'); B.set(8, 8, '#fff');
    B.rect(6, 10, 8, 10, shirt); B.set(8, 12, dark); B.set(11, 15, dark); B.rect(7, 18, 3, 2, skin);
    const arm = frame % 2;
    B.rect(0, 11 + arm, 8, 2, skin); B.rect(0, 11 + arm, 2, 2, dark);
    B.rect(1, 15 - arm, 7, 2, skin); B.rect(1, 15 - arm, 2, 2, dark);
    B.rect(6, 20, 3, 9 - arm, pants); B.rect(10, 20, 3, 8 + arm, pants);
    B.rect(5, 28 - arm, 4, 1, '#222'); B.rect(10, 28 + arm, 4, 1, '#222');
    if (big) { B.rect(5, 10, 10, 2, '#7a7a85'); B.rect(5, 17, 10, 2, '#7a7a85'); B.set(4, 1, '#e8e0c8'); B.set(14, 1, '#e8e0c8'); B.set(4, 0, '#e8e0c8'); }
    outline(B, '#150f0b');
    return B;
  }

  /* ================= weapons (grip at bottom-centre, pointing up) — 16x20 ================= */
  function weapon(id) {
    const B = new Buf(16, 20);
    const steel = '#c9d0d8', steelD = '#8d97a3', wood = '#8a5a2b', woodD = '#5e3a18', red = '#c0392b';
    if (id === 'pipa') { B.rect(7, 2, 2, 17, steel); B.rect(7, 2, 1, 17, '#e4e9ee'); B.rect(8, 2, 1, 17, steelD); B.rect(6, 1, 4, 2, steelD); B.rect(7, 17, 2, 3, woodD); }
    else if (id === 'bat') { B.rect(6, 2, 4, 6, wood); B.rect(7, 8, 2, 11, wood); B.rect(7, 8, 1, 11, '#a8743a'); for (const [x, y] of [[5, 3], [10, 4], [5, 6], [10, 7]]) B.set(x, y, '#e8e8e8'); B.rect(7, 17, 2, 3, woodD); }
    else if (id === 'parang') { B.rect(6, 1, 5, 12, steel); B.rect(6, 1, 1, 12, '#eef2f5'); B.rect(10, 3, 1, 10, steelD); B.rect(5, 13, 7, 1, steelD); B.rect(7, 14, 2, 6, woodD); }
    else { B.rect(7, 4, 2, 15, wood); B.rect(7, 4, 1, 15, '#a8743a'); B.rect(8, 2, 6, 6, red); B.rect(9, 3, 4, 1, '#e8756a'); B.rect(2, 3, 5, 4, steel); B.rect(7, 17, 2, 3, woodD); }
    outline(B, '#150f0b');
    return B;
  }


  /* ================= side-view fighter (for the game), fully pose-driven ================= */
  function crop(B, x, y, w, h) { const C = new Buf(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) C.set(i, j, B.get(x + i, y + j)); return C; }
  const AVG = { height: 170, weight: 62 };
  function hairIcon(hair) { const B = build(Object.assign({ hair, shirt: 'shirtless', stages: {} }, AVG)); const m = B.meta; return crop(B, 20, m.yH - 5, 24, 22); }
  function shirtIcon(shirt) { const B = build(Object.assign({ hair: 'botak', shirt, stages: {} }, AVG)); const m = B.meta; return crop(B, 14, m.yS - 4, 36, m.yHip - m.yS + 8); }

  function dims(o) {
    o = o || {}; const hF = clamp(((o.height || 170) - 145) / 50);
    return { thigh: Math.round(11 + hF * 3), shin: Math.round(11 + hF * 3), tl: Math.round(16 + hF * 2), ua: 9 + hF, fa: 8, gy: 63, hipX: 28 };
  }
  function side(o, pose) {
    o = o || {}; pose = pose || {};
    const st = Object.assign({ kaki: 0, paha: 0, core: 0, lengan: 0, dada: 0, bahu: 0 }, o.stages || {});
    const hair = o.hair || 'pendek', shirt = o.shirt || 'kaos';
    const height = o.height || 170, weight = o.weight || 65;
    const hF = clamp((height - 145) / 50), bmi = weight / Math.pow(height / 100, 2), bf = clamp((bmi - 17) / 14);
    const belly = clamp((bmi - 24) / 8) * (1 - 0.065 * st.core);
    const T = {}, WD = {}, GL = {};
    for (const k in st) { T[k] = tierOf(st[k]); WD[k] = wdOf(st[k]); GL[k] = glOf(st[k]); }
    const W = 60, H = 66, B = new Buf(W, H), gy = 63;
    const thigh = Math.round(11 + hF * 3), shin = Math.round(11 + hF * 3), tl = Math.round(16 + hF * 2);
    const rad = (d) => (d * Math.PI) / 180;
    const pt = (x, y, a, L) => [x + Math.sin(rad(a)) * L, y + Math.cos(rad(a)) * L];
    const wTh = 6 + Math.round(bf * 1.5) + Math.min(2, Math.floor(WD.paha / 2));
    const wSh = 4 + Math.min(2, Math.floor(WD.kaki / 2)) + (bf > 0.5 ? 1 : 0);
    const wUa = 4 + Math.min(2, Math.floor(WD.lengan / 2)), wFa = 3 + (WD.lengan >= 3 ? 1 : 0);
    const depth = 9 + Math.round(bf * 4) + Math.round(belly * 3) + [0, 0, 1, 1, 2, 3][Math.min(5, WD.dada)];
    const lean = pose.lean || 0, bob = pose.bob || 0;
    const legF = pose.legF || [15, 5], legB = pose.legB || [-15, -20];
    const dy = (l) => thigh * Math.cos(rad(l[0])) + shin * Math.cos(rad(l[1]));
    const hipX = pose.hipX != null ? pose.hipX : 28 + (pose.dx || 0), hipY = pose.hipY != null ? pose.hipY : gy - Math.max(dy(legF), dy(legB)) + bob;
    const cap = (x0, y0, x1, y1, w, c) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2)); for (let i = 0; i <= n; i++) B.circle(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, w / 2, c); };

    const leg = (l, near) => {
      const kc = near ? 'k' : 'ks', pc = near ? 'p' : 'ps';
      const [kx, ky] = pt(hipX, hipY, l[0], thigh), [ax, ay] = pt(kx, ky, l[1], shin);
      cap(hipX, hipY, kx, ky, wTh, kc);
      cap(hipX, hipY, hipX + (kx - hipX) * 0.55, hipY + (ky - hipY) * 0.55, wTh + 1, pc);
      cap(kx, ky, ax, ay, wSh, kc);
      B.rect(Math.round(ax) - 2, Math.round(ay) - 1, 7, 3, near ? 'x' : 'xs'); B.rect(Math.round(ax) - 2, Math.round(ay) + 2, 7, 1, 'xs');
    };
    const AR = { jaket: 'ja', rompi: 'rv', pelindung: 'mt', baja: 'st' }[o.armor] || null;
    const sleeveCode = (near) => (shirt === 'kaos' ? (near ? 't' : 'ts') : near ? 'k' : 'ks');
    const sPt = pt(hipX, hipY, 180 - lean, tl * 0.88);
    const arm = (a, near) => {
      const [ex, ey] = pt(sPt[0], sPt[1] + 1, a[0], 9 + hF), [hx, hy] = pt(ex, ey, a[1], 8);
      cap(sPt[0], sPt[1] + 1, ex, ey, wUa, near ? 'k' : 'ks');
      if (shirt === 'kaos' || AR === 'ja' || AR === 'st') cap(sPt[0], sPt[1] + 1, sPt[0] + (ex - sPt[0]) * (AR === 'st' ? 0.9 : 0.6), sPt[1] + 1 + (ey - sPt[1] - 1) * (AR === 'st' ? 0.9 : 0.6), wUa + 1, AR ? AR : near ? 't' : 'ts');
      cap(ex, ey, hx, hy, wFa, near ? 'k' : 'ks'); B.circle(hx, hy, 2.2, near ? 'k' : 'ks');
      if (near) B.hand = { x: Math.round(hx), y: Math.round(hy) };
    };

    arm(pose.armB || [10, 100], false);
    leg(legB, false);
    if (hair === 'panjang') { const hc0 = pt(sPt[0], sPt[1], 180 - lean * 0.6, 9.5); cap(hc0[0] - 3, hc0[1] + 1, hc0[0] - 4 - lean * 0.05, hc0[1] + 11, 4, 'r'); }
    // torso
    const rw = Math.max(3, depth / 2 - 1 - Math.min(1.5, Math.ceil(WD.core / 2) * 0.7)), rc = depth / 2 + [0, 0, 0.3, 0.6, 1][Math.min(4, WD.bahu)];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20, [cx, cy] = pt(hipX, hipY, 180 - lean, tl * t);
      const r = rw + (rc - rw) * Math.min(1, t * 1.2) - (t > 0.55 && t < 0.8 ? 0.8 : 0);
      const fx = 1 + (belly > 0 ? belly * 2.5 * Math.sin(Math.PI * Math.min(1, t * 1.4)) : 0);
      const code = t < 0.22 ? 'p' : AR ? AR : shirt === 'shirtless' ? 'k' : 't';
      const sh = (r - rw) * 0.8; // grow toward the chest only, keep the back line straight (no hump)
      B.circle(cx + fx + sh * Math.cos(rad(lean)), cy + sh * Math.sin(rad(lean)), r, code);
    }
    // neck + head
    const nk = pt(sPt[0], sPt[1], 180 - lean, 3);
    cap(sPt[0] + 1, sPt[1], nk[0] + 1, nk[1], 3, 'k');
    const hc = pt(sPt[0], sPt[1], 180 - lean * 0.6, 9.5), hx = hc[0] + 1, hy = hc[1];
    B.circle(hx, hy, 5.2, 'k');
    const inHead = (x, y) => (x - hx) * (x - hx) + (y - hy) * (y - hy) <= 5.2 * 5.2 + 0.5;
    const hairPix = (fn, c) => { for (let y = Math.floor(hy - 7); y <= Math.ceil(hy + 7); y++) for (let x = Math.floor(hx - 7); x <= Math.ceil(hx + 7); x++) if (inHead(x, y) && fn(x - hx, y - hy)) B.set(x, y, c); };
    if (hair === 'cepak') hairPix((dx, dy) => dy <= -3 || (dx <= -4 && dy <= 0), 'rb');
    else if (hair !== 'botak') hairPix((dx, dy) => dy <= -2 || (dx <= -2 && dy <= 2) || (dx <= -4), 'r');
    if (hair === 'jabrik') for (const [a, b] of [[-3, -6], [-1, -7], [1, -6], [3, -5], [-4, -5]]) { B.set(hx + a, hy + b, 'r'); B.set(hx + a, hy + b - 1, 'r'); }
    if (hair === 'kuncir') { cap(hx - 4, hy - 2, hx - 9, hy + 6, 2, 'r'); B.circle(hx - 5, hy - 2, 1.4, 'r'); }
    B.set(Math.round(hx + 2.5), Math.round(hy - 0.5), 'd'); B.set(Math.round(hx + 2.5), Math.round(hy + 0.5), 'd');
    B.set(Math.round(hx + 5), Math.round(hy + 1), 'ks'); B.set(Math.round(hx + 3), Math.round(hy + 3), 'l');
    leg(legF, true);
    arm(pose.armF || [30, 110], true);
    if (AR === 'mt' || AR === 'st') { B.circle(sPt[0] + 1, sPt[1] + 2, 3.4, AR); B.set(Math.round(sPt[0] + 1), Math.round(sPt[1] + 1), AR === 'mt' ? 'mo' : 'sth'); }
    if (AR === 'mt') for (let i = 0; i < 4; i++) { const [bx, by] = pt(hipX, hipY, 180 - lean, tl * 0.3); B.set(Math.round(bx - 3 + i * 2), Math.round(by), 'mo'); }
    // muscle definition on the bare/clothed torso front
    const front = (t) => { const [cx, cy] = pt(hipX, hipY, 180 - lean, tl * t); return [cx + depth / 2 - 1.5, cy]; };
    const lc = (x, y) => { const c = B.get(Math.round(x), Math.round(y)); if (c && (c[0] === 'k' || c[0] === 't')) B.set(Math.round(x), Math.round(y), c[0] === 't' ? 'ts' : 'l'); };
    if (T.core >= 1) for (const t of T.core >= 3 ? [0.3, 0.4, 0.5] : [0.38, 0.5]) { const [x, y] = front(t); lc(x, y); lc(x - 1, y); lc(x - 2, y); }
    if (T.dada >= 1) { const [x, y] = front(0.68); lc(x, y); lc(x - 1, y); lc(x - 2, y); }
    shade(B); outline(B, 'o');
    if (!B.hand) B.hand = { x: 40, y: 30 };
    return B;
  }

  /* ================= canvas helpers ================= */
  function draw(canvas, B, opt) {
    opt = opt || {};
    canvas.width = B.w; canvas.height = B.h;
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, B.w, B.h);
    const pal = opt.pal || null;
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      const c = B.p[y * B.w + x];
      if (c === null) continue;
      let col = pal && pal[c] ? pal[c] : c;
      if (opt.silhouette) col = c === 'o' ? '#46567a' : '#222c44';
      ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
    }
  }
  function reveal(canvas, B, opt, ms, done) {
    const ctx = canvas.getContext && canvas.getContext('2d');
    canvas.width = B.w; canvas.height = B.h;
    if (!ctx) { done && done(); return; }
    const idx = []; B.p.forEach((c, i) => { if (c !== null) idx.push(i); });
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const pal = opt.pal; let shown = 0; const t0 = performance.now();
    function frame(now) {
      const target = Math.min(idx.length, Math.floor(((now - t0) / ms) * idx.length));
      for (; shown < target; shown++) { const i = idx[shown]; ctx.fillStyle = pal[B.p[i]] || B.p[i]; ctx.fillRect(i % B.w, Math.floor(i / B.w), 1, 1); }
      if (shown < idx.length) requestAnimationFrame(frame); else done && done();
    }
    requestAnimationFrame(frame);
  }
  function toCanvas(B, pal, scale) {
    const c = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
    if (!c) return null;
    draw(c, B, { pal });
    if (!scale || scale === 1) return c;
    const c2 = document.createElement('canvas'); c2.width = B.w * scale; c2.height = B.h * scale;
    const x = c2.getContext('2d'); if (x) { x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, c2.width, c2.height); }
    return c2;
  }

  const api = {
    build, side, dims, crop, hairIcon, shirtIcon, person, monster, weapon, draw, reveal, toCanvas, palette, palFor, GROUPS, STAGE_EVERY, MAX_STAGE, nextStageLevel, stageOf,
    SKINS, HAIRS, HAIR_NAMES, HAIR_COLORS, SHIRTS, SHIRT_NAMES, SHIRT_COLORS, W, H, mix,
  };
  root.FitAvatar = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
