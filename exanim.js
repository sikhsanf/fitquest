/* FitQuest — exercise animations: poses (IK-driven so hands/feet stay planted) for the side-view avatar. */
(function (root) {
  'use strict';
  const R2D = 180 / Math.PI, D2R = Math.PI / 180;
  const ease = (u) => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, u)))) / 2;
  const tri = (u) => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const pt = (x, y, a, L) => [x + Math.sin(a * D2R) * L, y + Math.cos(a * D2R) * L];
  const GY = 63;

  /* two-link IK: origin P, target T -> [upper angle, lower angle] (absolute, 0=down, 90=forward) */
  function ik(P, T, l1, l2, bend) {
    let dx = T[0] - P[0], dy = T[1] - P[1], d = Math.hypot(dx, dy);
    d = Math.max(Math.abs(l1 - l2) + 0.05, Math.min(l1 + l2 - 0.05, d));
    const base = Math.atan2(dx, dy), al = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const up = base + bend * al, E = [P[0] + Math.sin(up) * l1, P[1] + Math.cos(up) * l1];
    return [up * R2D, Math.atan2(T[0] - E[0], T[1] - E[1]) * R2D];
  }
  const shoulderOf = (hip, lean, d) => pt(hip[0], hip[1], 180 - lean, d.tl * 0.88);
  const legL = (d) => d.thigh + d.shin;

  /* build a pose from hip, lean and wanted hand/foot targets */
  function make(d, hip, lean, feet, hands, extra) {
    const sh = shoulderOf(hip, lean, d), org = [sh[0], sh[1] + 1];
    const p = { hipX: hip[0], hipY: hip[1], lean, bob: 0, dx: 0 };
    if (feet) { p.legF = ik(hip, feet[0], d.thigh, d.shin, 1); p.legB = ik(hip, feet[1], d.thigh, d.shin, 1); }
    if (hands) { p.armF = hands[0].angles || ik(org, hands[0], d.ua, d.fa, hands[2] == null ? -1 : hands[2]); p.armB = hands[1].angles || ik(org, hands[1], d.ua, d.fa, hands[2] == null ? -1 : hands[2]); }
    return Object.assign(p, extra || {});
  }
  const fixedArms = (f, b) => [{ angles: f }, { angles: b }];

  const PERIOD = { jack: 1.4, march: 1.1, squat: 3.2, pushup: 2.6, back: 3.4, plank: 4, lunge: 3.4, curl: 2.4, climber: 0.9, sideplank: 4, stretch: 8, idle: 4 };

  function standing(d, t) {
    const b = Math.sin(t * 2.2) * 0.6, hip = [28, GY - legL(d) * 0.985 + b];
    return make(d, hip, 3 + Math.sin(t * 2.2), [[29, GY], [26, GY]], null, { armF: [6 + Math.sin(t * 2.2) * 2, 12], armB: [-4, 8] });
  }

  const ANIM = {
    idle: (d, t) => standing(d, t),
    /* jumping jack (side view: arms swing up, feet split front/back) */
    jack: (d, t) => {
      const u = t / PERIOD.jack, o = ease(tri(u)), hip = [28, GY - Math.sqrt(Math.pow(legL(d), 2) - Math.pow(o * 9, 2)) * 0.985 - Math.abs(Math.sin(u * Math.PI * 2)) * 0.8];
      const a = o * 165;
      return make(d, hip, 2, [[28 + o * 9, GY], [28 - o * 9, GY]], fixedArms([a, a + 8], [a - 8, a]));
    },
    /* walk in place with high knees (easy level) */
    march: (d, t) => {
      const s = Math.sin((t / PERIOD.march) * Math.PI * 2), hip = [28, GY - legL(d) * 0.97 - Math.abs(s) * 0.8];
      const fa = Math.max(0, s), fb = Math.max(0, -s);
      return make(d, hip, 3, [[lerp(28, 36, fa), lerp(GY, GY - 11, fa)], [lerp(28, 36, fb), lerp(GY, GY - 11, fb)]], fixedArms([-s * 30, -s * 30 + 55], [s * 30, s * 30 + 55]));
    },
    squat: (d, t) => {
      const u = (t / PERIOD.squat) % 1, k = ease(tri(u) * 1.25 > 1 ? 1 : tri(u) * 1.25), L = legL(d);
      const hip = [28 - k * 9, GY - L * 0.985 + k * L * 0.4];
      return make(d, hip, 4 + k * 36, [[32, GY], [29, GY]], null, { armF: [10 + k * 75, 15 + k * 78], armB: [8 + k * 72, 12 + k * 78] });
    },
    pushup: (d, t, lv) => {
      const u = (t / PERIOD.pushup) % 1, k = ease(tri(u)), phi = 76, hx = 47, SH = lerp(16, 6.5, k), len = d.tl * 0.88;
      const shy = GY - SH, hipY = shy + len * Math.cos(phi * D2R), hip = [hx - len * Math.sin(phi * D2R) - 1, hipY];
      let feet;
      if (lv === 'hard') { const fx = hip[0] - Math.sqrt(Math.max(1, Math.pow(legL(d) * 0.99, 2) - Math.pow(GY - hipY, 2))); feet = [[fx, GY], [fx - 1, GY]]; }
      else { const ky = GY - 2, kx = hip[0] - Math.sqrt(Math.max(0, d.thigh * d.thigh - Math.pow(ky - hipY, 2))); feet = [[kx - d.shin, ky], [kx - d.shin - 1, ky]]; }
      const p = make(d, hip, phi, feet, [[hx, GY - 1], [hx - 1, GY - 1]]);
      if (lv !== 'hard') { // knees on the floor: thigh to knee, shin flat behind
        const ky = GY - 2, kx = hip[0] - Math.sqrt(Math.max(0, d.thigh * d.thigh - Math.pow(ky - hipY, 2)));
        p.legF = [Math.atan2(kx - hip[0], ky - hipY) * R2D, -90]; p.legB = [p.legF[0] + 2, -90];
      }
      return p;
    },
    /* superman: prone, chest + legs lift */
    back: (d, t) => {
      const k = ease(tri((t / PERIOD.back) % 1)), hip = [20, GY - 5];
      return make(d, hip, lerp(88, 56, k), null, null, { legF: [-88 + k * 8, -88 + k * 10], legB: [-89 + k * 9, -89 + k * 11], armF: [100 + k * 20, 100 + k * 22], armB: [98 + k * 18, 98 + k * 20], hipY: GY - 5 - k * 1.5 });
    },
    plank: (d, t) => {
      const sx = 46, b = Math.sin(t * 2) * 0.5, SH = 12.5, len = d.tl * 0.88, phi = 85;
      const shy = GY - SH + b, hip = [sx - len * Math.sin(phi * D2R), shy + len * Math.cos(phi * D2R)];
      const fx = hip[0] - Math.sqrt(Math.max(1, Math.pow(legL(d) * 0.99, 2) - Math.pow(GY - hip[1], 2)));
      return make(d, hip, phi, [[fx, GY], [fx - 1, GY]], null, { armF: [0, 90], armB: [-2, 88] });
    },
    sideplank: (d, t) => {
      const sx = 46, SH = 12.5, len = d.tl * 0.88, phi = 85, lift = ease(tri((t / PERIOD.sideplank) % 1)) * 1.6;
      const shy = GY - SH, hip = [sx - len * Math.sin(phi * D2R), shy + len * Math.cos(phi * D2R) - lift];
      const fx = hip[0] - Math.sqrt(Math.max(1, Math.pow(legL(d) * 0.99, 2) - Math.pow(GY - hip[1], 2)));
      return make(d, hip, phi, [[fx, GY], [fx - 1, GY]], null, { armF: [0, 90], armB: [172, 176] });
    },
    lunge: (d, t) => {
      const T = PERIOD.lunge, n = Math.floor(t / T), u = (t / T) % 1, k = ease(tri(u)), L = legL(d), swap = n % 2;
      const hip = [28 - k * 2, GY - L * 0.985 + k * L * 0.33];
      const planted = [33, GY], back = [28 - 3 - k * 14, GY - 3 * k];
      const stepper = k > 0 ? back : [28, GY];
      return make(d, hip, 3 + k * 5, swap ? [stepper, planted] : [planted, stepper], null, { armF: [35, 125], armB: [30, 120] });
    },
    curl: (d, t, lv) => {
      const u = (t / PERIOD.curl) % 1, hip = [28, GY - legL(d) * 0.985];
      if (lv === 'hard') { const k = ease(tri(u)); return make(d, hip, 3, [[29, GY], [26, GY]], null, { armF: [4 + k * 12, 8 + k * 150], armB: [-4, 8] }); }
      const trem = Math.sin(t * 22) * 1.2; // isometric: one fist curled, other hand pressing down on it
      return make(d, hip, 3, [[29, GY], [26, GY]], null, { armF: [12, 135 + trem], armB: [45, 118 - trem] });
    },
    climber: (d, t) => {
      const T = PERIOD.climber, s = Math.sin((t / T) * Math.PI * 2), phi = 72, hx = 47, SH = 17, len = d.tl * 0.88;
      const shy = GY - SH, hip = [hx - len * Math.sin(phi * D2R), shy + len * Math.cos(phi * D2R)];
      const bx = hip[0] - Math.sqrt(Math.max(1, Math.pow(legL(d) * 0.99, 2) - Math.pow(GY - hip[1], 2)));
      const f = Math.max(0, s), b = Math.max(0, -s);
      const foot = (k) => [lerp(bx, hip[0] + 8, k), lerp(GY, GY - 9, k)];
      return make(d, hip, phi, [foot(f), foot(b)], [[hx, GY - 1], [hx - 1, GY - 1]]);
    },
    stretch: (d, t) => {
      const u = (t / PERIOD.stretch) % 1, hipBase = GY - legL(d) * 0.99;
      let lean, arms, hx = 28;
      if (u < 0.3) { const k = ease(u / 0.3); lean = lerp(3, -9, k); arms = [150 + k * 28, 160 + k * 22]; }
      else if (u < 0.5) { const k = ease((u - 0.3) / 0.2); lean = lerp(-9, 0, k); arms = [178 - k * 20, 182 - k * 24]; }
      else if (u < 0.82) { const k = ease((u - 0.5) / 0.32); lean = lerp(0, 82, k); hx = 28 - k * 5; arms = [lerp(158, 12, k), lerp(158, 5, k)]; }
      else { const k = ease((u - 0.82) / 0.18); lean = lerp(82, 3, k); hx = 23 + k * 5; arms = [lerp(12, 6, k), lerp(5, 12, k)]; }
      return make(d, [hx, hipBase], lean, [[29, GY], [26, GY]], null, { armF: arms, armB: [arms[0] - 6, arms[1] - 6] });
    },
  };

  const MAP = { march_jack: (lv) => (lv === 'easy' ? 'march' : 'jack'), squat: () => 'squat', pushup: () => 'pushup', back_extension: () => 'back', plank: (lv) => (lv === 'hard' ? 'climber' : 'plank'), lunge: () => 'lunge', biceps_iso: () => 'curl', mountain_climber: () => 'climber', side_plank_calf: () => 'sideplank', stretch: () => 'stretch' };
  const kindOf = (ex, lv) => (MAP[ex] || (() => 'idle'))(lv);

  /* pose of exercise `ex`/`lv` at time t (seconds, loops); null/rest => idle breathing */
  function pose(ex, lv, t, d) {
    const k = ex ? kindOf(ex, lv) : 'idle';
    return ANIM[k](d, t, lv);
  }
  root.FitExAnim = { pose, kindOf, ik, PERIOD };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.FitExAnim;
})(typeof window !== 'undefined' ? window : globalThis);
