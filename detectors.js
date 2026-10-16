/* FitQuest — pose detectors (pure logic, no DOM). Input: MediaPipe Pose landmarks. */
(function (root) {
  'use strict';
  const I = { nose: 0, lsh: 11, rsh: 12, lel: 13, rel: 14, lwr: 15, rwr: 16, lhip: 23, rhip: 24, lkn: 25, rkn: 26, lan: 27, ran: 28 };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const vis = (p) => !!p && (p.visibility === undefined || p.visibility >= 0.5);
  const MISSING = 'Mundur sedikit — seluruh badan harus masuk frame';

  function ang(a, b, c) {
    const v1 = [a.x - b.x, a.y - b.y, a.z - b.z];
    const v2 = [c.x - b.x, c.y - b.y, c.z - b.z];
    const n = Math.hypot(...v1) * Math.hypot(...v2);
    if (!n) return null;
    const d = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    return (Math.acos(clamp(d / n, -1, 1)) * 180) / Math.PI;
  }
  const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  class EMA {
    constructor(a) { this.a = a; this.v = null; }
    push(x) { this.v = this.v === null ? x : this.v + this.a * (x - this.v); return this.v; }
    reset() { this.v = null; }
  }

  // pick the body side (l/r) whose required joints are all visible, preferring higher visibility
  function bestSide(f, names) {
    let best = null, bestV = -1;
    for (const s of ['l', 'r']) {
      const pts = names.map((n) => f.img[I[s + n]]);
      if (!pts.every(vis)) continue;
      const v = pts.reduce((a, p) => a + (p.visibility === undefined ? 1 : p.visibility), 0);
      if (v > bestV) { bestV = v; best = s; }
    }
    return best;
  }
  const W = (f, s, n) => f.world[I[s + n]];

  /* ---------- generic rep detector (hysteresis on one smoothed signal) ---------- */
  function repDetector(cfg) {
    const sm = new EMA(cfg.alpha || 0.5);
    let s;
    function reset() {
      sm.reset();
      s = { phase: 'up', min: 999, aux: [], reps: 0, qs: [], seen: 0, lastQ: null, msg: cfg.startMsg || 'Mulai gerak!' };
    }
    reset();
    return {
      kind: 'reps',
      reset,
      update(f) {
        const m = cfg.measure(f);
        if (!m) return { ok: false, msg: MISSING, reps: s.reps, phase: s.phase, live: s.lastQ };
        s.seen++;
        const v = sm.push(m.value);
        if (s.phase === 'up' && v < cfg.down) { s.phase = 'down'; s.min = v; s.aux = []; }
        if (s.phase === 'down') {
          s.min = Math.min(s.min, v);
          if (m.aux !== undefined) s.aux.push(m.aux);
          if (v > cfg.up) {
            const q = Math.round(cfg.quality(s.min, s.aux));
            s.qs.push(q); s.reps++; s.phase = 'up'; s.lastQ = q;
            s.msg = q >= 80 ? 'Mantap! 🔥' : q >= 55 ? 'Oke — ' + cfg.coach : cfg.coach;
          }
        }
        return { ok: true, msg: s.msg, reps: s.reps, phase: s.phase, live: s.lastQ, lastQ: s.lastQ };
      },
      result() {
        return { score: s.qs.length ? Math.round(avg(s.qs)) : 0, reps: s.reps, coverage: null, eligible: s.reps >= 2 };
      },
    };
  }

  /* ---------- generic hold detector (posture quality over time, inside a time window) ---------- */
  function holdDetector(cfg) {
    let st;
    const reset = () => { st = { tracked: 0, good: 0, last: null }; };
    reset();
    return {
      kind: 'hold',
      reset,
      update(f, t) {
        const dt = st.last == null ? 0 : clamp(t - st.last, 0, 0.25);
        st.last = t;
        if (t < cfg.window[0] || t >= cfg.window[1]) return { ok: true, scored: false, msg: cfg.afterMsg, reps: null, live: null };
        const m = cfg.measure(f);
        if (!m) return { ok: false, scored: true, msg: MISSING, reps: null, live: null };
        st.tracked += dt;
        if (m.good) st.good += dt;
        return { ok: true, scored: true, good: m.good, msg: m.msg, reps: null, live: m.good ? 100 : 40 };
      },
      result() {
        const winLen = cfg.window[1] - cfg.window[0];
        const cov = clamp(st.tracked / winLen);
        return { score: st.tracked > 0 ? Math.round((100 * st.good) / st.tracked) : 0, reps: null, coverage: cov, eligible: cov >= 0.5 };
      },
    };
  }

  /* ---------- exercises ---------- */
  function squat() {
    return repDetector({
      alpha: 0.5, down: 135, up: 158, coach: 'turun lebih dalam',
      measure(f) {
        const a = [];
        for (const s of ['l', 'r']) {
          if (['hip', 'kn', 'an'].every((n) => vis(f.img[I[s + n]]))) {
            const v = ang(W(f, s, 'hip'), W(f, s, 'kn'), W(f, s, 'an'));
            if (v != null) a.push(v);
          }
        }
        return a.length ? { value: avg(a) } : null;
      },
      quality: (min) => 100 * (0.3 + 0.7 * clamp((135 - min) / 45)),
    });
  }

  function pushupKnee() {
    return repDetector({
      alpha: 0.5, down: 105, up: 150, coach: 'turun lebih rendah, badan lurus',
      measure(f) {
        const s = bestSide(f, ['sh', 'el', 'wr', 'hip', 'kn']);
        if (!s) return null;
        const el = ang(W(f, s, 'sh'), W(f, s, 'el'), W(f, s, 'wr'));
        const body = ang(W(f, s, 'sh'), W(f, s, 'hip'), W(f, s, 'kn'));
        if (el == null || body == null) return null;
        return { value: el, aux: clamp(1 - (Math.abs(180 - body) - 12) / 35) };
      },
      quality: (min, aux) => 100 * (0.2 + 0.8 * (0.6 * clamp((120 - min) / 35) + 0.4 * avg(aux))),
    });
  }

  function lunge() {
    return repDetector({
      alpha: 0.5, down: 125, up: 155, coach: 'turun lebih dalam',
      measure(f) {
        const a = [];
        for (const s of ['l', 'r']) {
          if (['hip', 'kn', 'an'].every((n) => vis(f.img[I[s + n]]))) {
            const v = ang(W(f, s, 'hip'), W(f, s, 'kn'), W(f, s, 'an'));
            if (v != null) a.push(v);
          }
        }
        return a.length ? { value: Math.min(...a) } : null;
      },
      quality: (min) => 100 * (0.3 + 0.7 * clamp((135 - min) / 35)),
    });
  }

  // openness 0..1 from arm height (image) and foot spread (world); signal = 1 - openness
  function jackPelan() {
    return repDetector({
      alpha: 0.6, down: 0.5, up: 0.7, coach: 'angkat tangan lebih tinggi & kaki lebih lebar',
      measure(f) {
        const need = ['lsh', 'rsh', 'lwr', 'rwr', 'lhip', 'rhip', 'lan', 'ran'];
        if (!need.every((n) => vis(f.img[I[n]]))) return null;
        const g = (n) => f.img[I[n]];
        const torso = Math.abs((g('lsh').y + g('rsh').y) / 2 - (g('lhip').y + g('rhip').y) / 2) * f.h;
        if (!torso) return null;
        const armH = avg([g('lsh').y - g('lwr').y, g('rsh').y - g('rwr').y]) * f.h / torso;
        const sw = dist3(f.world[I.lsh], f.world[I.rsh]);
        if (!sw) return null;
        const r = dist3(f.world[I.lan], f.world[I.ran]) / sw;
        const o = 0.5 * clamp((armH + 0.2) / 0.9) + 0.5 * clamp((r - 0.9) / 0.7);
        return { value: 1 - o };
      },
      quality: (min) => 100 * (0.4 + 0.6 * clamp((1 - min - 0.55) / 0.35)),
    });
  }

  function plank(window) {
    return holdDetector({
      window, afterMsg: 'Lanjut side plank — bagian ini tidak dinilai kamera',
      measure(f) {
        const s = bestSide(f, ['sh', 'hip', 'an']);
        if (!s) return null;
        const a = ang(W(f, s, 'sh'), W(f, s, 'hip'), W(f, s, 'an'));
        if (a == null) return null;
        const dev = Math.abs(180 - a);
        const sh = f.img[I[s + 'sh']], hip = f.img[I[s + 'hip']], an = f.img[I[s + 'an']];
        const dx = (an.x - sh.x) * f.w, dy = (an.y - sh.y) * f.h;
        const len = Math.hypot(dx, dy);
        if (!len) return null;
        const horizontal = Math.abs(dy) < 0.6 * len;
        const t = Math.abs(an.x - sh.x) > 1e-4 ? (hip.x - sh.x) / (an.x - sh.x) : 0.5;
        const yLine = sh.y + t * (an.y - sh.y);
        const sag = ((hip.y - yLine) * f.h) / len; // + = hip below the line
        const good = dev <= 18 && horizontal;
        let msg = 'Postur lurus — tahan! 💪';
        if (!horizontal) msg = 'Posisi plank dulu (HP dari samping)';
        else if (!good) msg = sag > 0 ? 'Pinggul terlalu turun' : 'Pinggul terlalu naik';
        return { good, msg };
      },
    });
  }

  const REGISTRY = {
    'march_jack:normal': { make: jackPelan, view: 'HP di depan, berdiri ±2 m, seluruh badan masuk frame', label: 'Jumping jack' },
    'squat:normal': { make: squat, view: 'HP di depan atau miring 45°, seluruh badan masuk frame', label: 'Squat' },
    'pushup:normal': { make: pushupKnee, view: 'HP di samping badan, setinggi lantai', label: 'Push-up' },
    'plank:normal': { make: () => plank([0, 20]), view: 'HP di samping badan, setinggi lantai (20 dtk pertama dinilai)', label: 'Plank' },
    'lunge:normal': { make: lunge, view: 'HP di samping atau depan, seluruh badan masuk frame', label: 'Lunge' },
  };

  const api = {
    has: (ex, lv) => !!REGISTRY[ex + ':' + lv],
    view: (ex, lv) => (REGISTRY[ex + ':' + lv] || {}).view,
    create(ex, lv) {
      const r = REGISTRY[ex + ':' + lv];
      if (!r) return null;
      const d = r.make();
      d.view = r.view;
      return d;
    },
    REGISTRY, I,
  };
  root.FitDetectors = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
