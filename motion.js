/* FitQuest — motion controller: turns MediaPipe pose frames into game inputs (walk-in-place, punch, swing, kick).
   Pure logic, no DOM. Works in WORLD landmarks (metres, hip-centred) so it does not depend on how far the phone is.
   Frame: { img:[33 {x,y,z,visibility}], world:[33 {x,y,z}], w, h }.  y points DOWN, x to the right of the image. */
(function (root) {
  'use strict';
  const I = { lsh: 11, rsh: 12, lel: 13, rel: 14, lwr: 15, rwr: 16, lhip: 23, rhip: 24, lkn: 25, rkn: 26, lan: 27, ran: 28 };
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const vis = (f, i) => { const p = f.img && f.img[i]; return !!p && (p.visibility === undefined || p.visibility >= 0.45); };
  const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  function angle3(a, b, c) {
    const v1 = [a.x - b.x, a.y - b.y, a.z - b.z], v2 = [c.x - b.x, c.y - b.y, c.z - b.z], n = Math.hypot(...v1) * Math.hypot(...v2);
    return n ? Math.acos(clamp((v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / n, -1, 1)) / D2R : 180;
  }
  const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

  /* tunables (distances in torso lengths T, times in seconds). `sens` > 1 = more sensitive. */
  const TUNE = {
    stepUp: 0.2, stepDown: 0.08, ankleUp: 0.32, stepRefr: 0.18, walkHold: 0.9,
    kickRise: 0.9, kickAngle: 135, kickRefr: 0.6,
    punchExtHi: 0.86, punchExtLo: 0.68, punchWin: 0.38, punchRefr: 0.32, punchYLo: -0.85, punchYHi: 0.55,
    swingAng: 95, swingWin: 0.32, swingRefr: 0.45, swingMinR: 0.5, swingMaxExt: 0.3,
  };

  function create(opts) {
    opts = opts || {};
    let sens = opts.sens || 1;
    const hist = { l: [], r: [] };
    let S;
    function reset() {
      S = { t: 0, counts: { step: 0, punch: 0, swing: 0, kick: 0 }, steps: [], legUp: { l: false, r: false }, lastStep: { l: -9, r: -9 }, kickArmed: { l: true, r: true }, lastKick: -9,
        lastPunch: { l: -9, r: -9 }, lastSwing: { l: -9, r: -9 }, swingDir: { l: null, r: null }, stand: { thigh: null, T: null }, ok: false };
      hist.l.length = 0; hist.r.length = 0;
    }
    reset();

    function update(f, t) {
      const ev = [], dbg = {};
      S.t = t;
      const need = ['lsh', 'rsh', 'lhip', 'rhip'];
      if (!f || !f.world || !need.every((n) => vis(f, I[n]))) { S.ok = false; return { ok: false, events: ev, walking: false, speed: 0, counts: S.counts, debug: dbg }; }
      S.ok = true;
      const W = (n) => f.world[I[n]];
      const shM = { x: (W('lsh').x + W('rsh').x) / 2, y: (W('lsh').y + W('rsh').y) / 2, z: (W('lsh').z + W('rsh').z) / 2 };
      const hpM = { x: (W('lhip').x + W('rhip').x) / 2, y: (W('lhip').y + W('rhip').y) / 2, z: (W('lhip').z + W('rhip').z) / 2 };
      const T = Math.max(0.25, d3(shM, hpM)); // torso length, metres
      S.stand.T = S.stand.T == null ? T : S.stand.T + 0.03 * (T - S.stand.T);
      const th = (s) => d3(W(s + 'hip'), W(s + 'kn'));

      // ---------------- legs: steps + kick ----------------
      const lift = {}, ank = {}, kang = {};
      for (const s of ['l', 'r']) {
        const o = s === 'l' ? 'r' : 'l';
        if (!(vis(f, I[s + 'hip']) && vis(f, I[s + 'kn']))) { lift[s] = 0; continue; }
        const thigh = Math.max(0.2, S.stand.thigh == null ? th(s) : S.stand.thigh);
        // knee rises towards hip height; only trust "standing thigh" when the leg is hanging straight
        if (th(s) > 0.25 && Math.abs(W(s + 'kn').y - W(s + 'hip').y) > 0.8 * th(s)) S.stand.thigh = S.stand.thigh == null ? th(s) : S.stand.thigh + 0.05 * (th(s) - S.stand.thigh);
        const kl = (thigh - (W(s + 'kn').y - W(s + 'hip').y)) / T;
        let al = 0;
        if (vis(f, I[s + 'an']) && vis(f, I[o + 'an'])) al = (W(o + 'an').y - W(s + 'an').y) / T;
        ank[s] = al; lift[s] = Math.max(kl, al * (TUNE.stepUp / TUNE.ankleUp));
        if (vis(f, I[s + 'an'])) kang[s] = angle3(W(s + 'hip'), W(s + 'kn'), W(s + 'an'));
      }
      dbg.lift = { l: +(lift.l || 0).toFixed(2), r: +(lift.r || 0).toFixed(2) };
      dbg.kneeAng = { l: kang.l && Math.round(kang.l), r: kang.r && Math.round(kang.r) };
      for (const s of ['l', 'r']) {
        const up = TUNE.stepUp / sens, down = TUNE.stepDown / sens;
        if (!S.legUp[s] && lift[s] > up && t - S.lastStep[s] > TUNE.stepRefr) {
          // a kick is a high, straight leg: do not also count it as a step
          const kicking = (ank[s] || 0) > TUNE.kickRise / sens && (kang[s] || 0) > TUNE.kickAngle;
          S.legUp[s] = true; S.lastStep[s] = t;
          if (!kicking) { S.counts.step++; S.steps.push(t); ev.push({ type: 'step', side: s, t }); }
        } else if (S.legUp[s] && lift[s] < down) S.legUp[s] = false;
        // kick: foot well above the planted foot with a (nearly) straight knee
        if (S.kickArmed[s] && (ank[s] || 0) > TUNE.kickRise / sens && (kang[s] || 0) > TUNE.kickAngle && t - S.lastKick > TUNE.kickRefr) {
          S.kickArmed[s] = false; S.lastKick = t; S.counts.kick++; ev.push({ type: 'kick', side: s, power: clamp((ank[s] - TUNE.kickRise) + 0.5, 0.3, 1), t });
        } else if (!S.kickArmed[s] && (ank[s] || 0) < 0.5) S.kickArmed[s] = true;
      }
      S.steps = S.steps.filter((x) => t - x < 1.6);
      const recent = S.steps.filter((x) => t - x < 1.0).length;
      const walking = S.steps.length > 0 && t - S.steps[S.steps.length - 1] < TUNE.walkHold;
      const speed = walking ? clamp(recent / 2, 0.3, 1.6) : 0; // 1.0 = one step every 0.5 s

      // ---------------- arms: punch + swing ----------------
      for (const s of ['l', 'r']) {
        if (!(vis(f, I[s + 'sh']) && vis(f, I[s + 'el']) && vis(f, I[s + 'wr']))) { hist[s].length = 0; continue; }
        const sh = W(s + 'sh'), el = W(s + 'el'), wr = W(s + 'wr');
        const A = Math.max(0.2, d3(sh, el) + d3(el, wr));
        const ext = d3(sh, wr) / A, yRel = (wr.y - sh.y) / A;
        const th2 = Math.atan2(wr.y - sh.y, wr.x - sh.x), r2 = Math.hypot(wr.x - sh.x, wr.y - sh.y) / A;
        const h = hist[s]; h.push({ t, ext, th: th2, r2, x: wr.x - sh.x, yRel }); while (h.length && t - h[0].t > 0.7) h.shift();
        dbg['ext' + s] = +ext.toFixed(2);
        const win = (w) => h.filter((p) => t - p.t <= w);
        // punch: arm snaps from folded to straight at about shoulder height
        const pw = win(TUNE.punchWin), minExt = Math.min(...pw.map((p) => p.ext));
        if (ext > TUNE.punchExtHi - (sens - 1) * 0.06 && minExt < TUNE.punchExtLo + (sens - 1) * 0.06 && yRel > TUNE.punchYLo && yRel < TUNE.punchYHi && t - S.lastPunch[s] > TUNE.punchRefr && t - S.lastSwing[s] > 0.3) {
          S.lastPunch[s] = t; S.counts.punch++; ev.push({ type: 'punch', side: s, power: clamp((ext - minExt) * 1.4, 0.4, 1), t });
        }
        // swing: wrist sweeps a big arc around the shoulder while the arm stays out
        const sw = win(TUNE.swingWin);
        if (sw.length >= 3 && t - S.lastSwing[s] > TUNE.swingRefr && t - S.lastPunch[s] > 0.3) {
          const back = (rot) => S.swingDir[s] && rot !== S.swingDir[s] && t - S.lastSwing[s] < 0.7; // hand returning after a swing is not a new swing
          let d = 0; for (let i = 1; i < sw.length; i++) d += wrapA(sw[i].th - sw[i - 1].th);
          const meanR = sw.reduce((a, p) => a + p.r2, 0) / sw.length, dExt = Math.abs(sw[sw.length - 1].ext - sw[0].ext);
          dbg['arc' + s] = Math.round(d / D2R);
          if (Math.abs(d) > (TUNE.swingAng / sens) * D2R && meanR > TUNE.swingMinR && dExt < TUNE.swingMaxExt) {
            const dx = sw[sw.length - 1].x - sw[0].x, dir = dx >= 0 ? 'r' : 'l', rot = d > 0 ? 'cw' : 'ccw'; if (back(rot)) continue;
            S.lastSwing[s] = t; S.counts.swing++; S.swingDir[s] = rot;
            ev.push({ type: 'swing', side: s, dir, power: clamp(Math.abs(d) / (120 * D2R), 0.5, 1), t }); // dir = way the hand travels in the image
          }
        }
      }
      return { ok: true, events: ev, walking, speed, counts: S.counts, debug: dbg };
    }
    return { update, reset, setSens(v) { sens = clamp(v, 0.5, 1.8); }, get sens() { return sens; }, counts: () => S.counts };
  }

  const api = { create, TUNE, I };
  root.FitMotion = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
