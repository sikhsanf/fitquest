/* FitQuest — motion controller: turns MediaPipe pose frames into game inputs (walk-in-place, punch, swing, kick).
   Pure logic, no DOM. Works in WORLD landmarks (metres, hip-centred) so it does not depend on how far the phone is.
   Frame: { img:[33 {x,y,z,visibility}], world:[33 {x,y,z}], w, h }.  y points DOWN, x to the right of the image. */
(function (root) {
  'use strict';
  const I = { lsh: 11, rsh: 12, lel: 13, rel: 14, lwr: 15, rwr: 16, lhip: 23, rhip: 24, lkn: 25, rkn: 26, lan: 27, ran: 28 };
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let VISMIN = 0.45, VISARM = 0.35;
  const vis = (f, i, m) => { const p = f.img && f.img[i]; return !!p && (p.visibility === undefined || p.visibility >= (m || VISMIN)); };
  const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  function angle3(a, b, c) {
    const v1 = [a.x - b.x, a.y - b.y, a.z - b.z], v2 = [c.x - b.x, c.y - b.y, c.z - b.z], n = Math.hypot(...v1) * Math.hypot(...v2);
    return n ? Math.acos(clamp((v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / n, -1, 1)) / D2R : 180;
  }
  const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

  /* tunables (distances in torso lengths T, times in seconds). `sens` > 1 = more sensitive. */
  const TUNE = {
    stepUp: 0.2, stepDown: 0.08, ankleUp: 0.32, stepRefr: 0.18, walkHold: 0.9,
    kickRise: 0.75, kickAngle: 125, kickRefr: 0.6, kickRise2: 0.65, kickAng2: 100, armQuiet: 0.6, guardHold: 0.25, eStep: 4, eArm: 3, eKick: 6, crossDist: 0.6,
    punchExtHi: 0.72, punchExtLo: 0.66, punchWin: 0.45, punchRefr: 0.32, punchYLo: -0.85, punchYHi: 0.9,
    swingAng: 95, swingWin: 0.32, swingRefr: 0.45, swingMinR: 0.5, swingMaxExt: 0.3,
  };

  function create(opts) {
    opts = opts || {};
    let sens = opts.sens || 1;
    const hist = { l: [], r: [] };
    let S;
    function reset() {
      S = { eu: [], el: 0, crossT: -1, guard: false, t: 0, counts: { step: 0, punch: 0, swing: 0, kick: 0 }, steps: [], legUp: { l: false, r: false }, lastStep: { l: -9, r: -9 }, kickArmed: { l: true, r: true }, lastKick: -9,
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
      // pixel-motion gates: pose joints jitter even when standing still, real motion shows up as changing pixels
      let upE = 99, lowE = 99;
      if (f.energy) {
        S.eu.push({ t, v: f.energy.up }); while (S.eu.length && t - S.eu[0].t > 0.3) S.eu.shift();
        upE = S.eu.reduce((s, q) => s + q.v, 0) / S.eu.length; S.el += 0.35 * (f.energy.low - S.el); lowE = S.el;
        dbg.energy = { up: +upE.toFixed(1), low: +lowE.toFixed(1) };
      }
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
      const rise2 = { l: 0, r: 0 }, w2 = f.w || 1, h2 = f.h || 1, G = (n) => f.img[I[n]];
      { const T2 = Math.hypot(((G('lsh').x + G('rsh').x) - (G('lhip').x + G('rhip').x)) / 2 * w2, ((G('lsh').y + G('rsh').y) - (G('lhip').y + G('rhip').y)) / 2 * h2);
        if (T2 > 10 && f.img[I.lan] && f.img[I.ran] && f.img[I.lan].visibility >= 0.12 && f.img[I.ran].visibility >= 0.12) { rise2.l = (G('ran').y - G('lan').y) * h2 / T2; rise2.r = -rise2.l; } } // l: left ankle above right; r: opposite
      const ang2 = (s) => { const h = G(s + 'hip'), k = G(s + 'kn'), n = G(s + 'an'); const v1 = [(h.x - k.x) * w2, (h.y - k.y) * h2], v2 = [(n.x - k.x) * w2, (n.y - k.y) * h2], d = Math.hypot(...v1) * Math.hypot(...v2); return d ? Math.acos(clamp((v1[0] * v2[0] + v1[1] * v2[1]) / d, -1, 1)) / D2R : 0; };
      const kang2 = { l: ang2('l'), r: ang2('r') };
      dbg.rise = { l: +rise2.l.toFixed(2), r: +rise2.r.toFixed(2) };
      dbg.kneeAng = { l: kang.l && Math.round(kang.l), r: kang.r && Math.round(kang.r) };
      for (const s of ['l', 'r']) {
        const up = TUNE.stepUp / sens, down = TUNE.stepDown / sens;
        if (!S.legUp[s] && lift[s] > up && t - S.lastStep[s] > TUNE.stepRefr) {
          // a kick is a high, straight leg: do not also count it as a step
          const kicking = (ank[s] || 0) > TUNE.kickRise / sens && (kang[s] || 0) > TUNE.kickAngle;
          S.legUp[s] = true; S.lastStep[s] = t;
          if (!kicking && lowE >= TUNE.eStep && t - S.lastKick > 0.55 && Math.abs(rise2[s]) < 0.55) { S.counts.step++; S.lastStepSide = s; S.lastStepT = t; S.steps.push(t); ev.push({ type: 'step', side: s, t }); }
        } else if (S.legUp[s] && lift[s] < down) S.legUp[s] = false;
        // kick: in the IMAGE the foot rises far above the planted foot (world depth of legs is too noisy; side/round kicks have bent knees)
        const r2 = rise2[s];
        if (S.kickArmed[s] && r2 > TUNE.kickRise2 / sens && kang2[s] > TUNE.kickAng2 && lowE >= TUNE.eKick && t - S.lastKick > TUNE.kickRefr) {
          S.kickArmed[s] = false; S.lastKick = t; S.counts.kick++;
          if (S.lastStep[s] > t - 0.45 && S.steps.length && S.counts.step > 0 && S.steps[S.steps.length - 1] === S.lastStep[s]) { S.steps.pop(); S.counts.step--; ev.push({ type: 'unstep', side: s, t }); } // the ramp of a kick looked like a step
          ev.push({ type: 'kick', side: s, power: clamp(r2 - TUNE.kickRise2 + 0.5, 0.3, 1), t });
        } else if (!S.kickArmed[s] && r2 < 0.35) S.kickArmed[s] = true;
      }
      S.steps = S.steps.filter((x) => t - x < 1.6);
      const recent = S.steps.filter((x) => t - x < 1.0).length;
      const walking = S.steps.length > 0 && t - S.steps[S.steps.length - 1] < TUNE.walkHold;
      const speed = walking ? clamp(recent / 2, 0.3, 1.6) : 0; // 1.0 = one step every 0.5 s

      // ---------------- arms: punch + swing ----------------
      // guard: forearms crossed in an X over the chest (hold it to block)
      let crossed = false;
      if (vis(f, I.lwr, 0.05) && vis(f, I.rwr, 0.05)) {
        const hx = (G('lhip').x + G('rhip').x) / 2, sy = (G('lsh').y + G('rsh').y) / 2, hy = (G('lhip').y + G('rhip').y) / 2, T2g = Math.hypot(((G('lsh').x + G('rsh').x) / 2 - hx) * w2, (sy - hy) * h2) + 1e-6;
        // when forearms cross the model swaps left/right labels and squashes the shoulders, so go by geometry in torso units: both wrists together in front of the chest
        const wd = Math.hypot((G('lwr').x - G('rwr').x) * w2, (G('lwr').y - G('rwr').y) * h2) / T2g, cx = (((G('lwr').x + G('rwr').x) / 2 - hx) * w2) / T2g, cy = ((G('lwr').y + G('rwr').y) / 2 - sy) * h2 / T2g;
        crossed = wd < TUNE.crossDist && Math.abs(cx) < 0.5 && cy > -0.15 && cy < 0.55;
        dbg.cross = { wd: +wd.toFixed(2), cy: +cy.toFixed(2) };
      }
      if (crossed) S.crossLast = t; S.crossT = crossed ? (S.crossT == null || S.crossT < 0 ? t : S.crossT) : (t - (S.crossLast || -9) < 0.2 ? S.crossT : -1);
      const guarding = S.crossT >= 0 && t - S.crossT >= TUNE.guardHold;
      if (guarding && !S.guard) ev.push({ type: 'guard', t }); S.guard = guarding;
      const armsQuiet = crossed || t - (S.crossLast || -9) < 0.2 || upE < TUNE.eArm || t - S.lastKick < TUNE.armQuiet || Math.max(Math.abs(rise2.l), Math.abs(rise2.r)) > 0.45; // the body lurches during a kick: arms are not input
      const marching = S.steps.length > 0 && t - S.steps[S.steps.length - 1] < 0.5; // arm-pump while marching is not a swing
      for (const s of ['l', 'r']) {
        if (!(vis(f, I[s + 'sh']) && vis(f, I[s + 'el'], VISARM) && vis(f, I[s + 'wr'], VISARM))) { hist[s].length = 0; continue; }
        const sh = W(s + 'sh'), el = W(s + 'el'), wr = W(s + 'wr');
        const A = Math.max(0.2, d3(sh, el) + d3(el, wr));
        const ext = d3(sh, wr) / A, yRel = (wr.y - sh.y) / A;
        const th2 = Math.atan2(wr.y - sh.y, wr.x - sh.x), r2 = Math.hypot(wr.x - sh.x, wr.y - sh.y) / A;
        const h = hist[s]; h.push({ t, ext, th: th2, r2, x: wr.x - sh.x, yRel }); while (h.length && t - h[0].t > 0.7) h.shift();
        dbg['ext' + s] = +ext.toFixed(2);
        const win = (w) => h.filter((p) => t - p.t <= w);
        // punch: arm snaps from folded to straight at about shoulder height
        const pw = win(TUNE.punchWin), minExt = Math.min(...pw.map((p) => p.ext));
        if (!armsQuiet && ext > TUNE.punchExtHi + (marching ? 0.06 : 0) - (sens - 1) * 0.06 && minExt < TUNE.punchExtLo + (sens - 1) * 0.06 && yRel > TUNE.punchYLo && yRel < TUNE.punchYHi && t - S.lastPunch[s] > TUNE.punchRefr && t - S.lastSwing[s] > 0.6) {
          S.lastPunch[s] = t; S.counts.punch++; ev.push({ type: 'punch', side: s, power: clamp((ext - minExt) * 1.4, 0.4, 1), t });
        }
        // swing: wrist sweeps a big arc around the shoulder while the arm stays out
        const sw = win(TUNE.swingWin);
        if (!armsQuiet && sw.length >= 3 && t - S.lastSwing[s] > TUNE.swingRefr && t - S.lastPunch[s] > 0.3) {
          const back = (rot) => S.swingDir[s] && rot !== S.swingDir[s] && t - S.lastSwing[s] < 0.7; // hand returning after a swing is not a new swing
          let d = 0; for (let i = 1; i < sw.length; i++) d += wrapA(sw[i].th - sw[i - 1].th);
          const meanR = sw.reduce((a, p) => a + p.r2, 0) / sw.length, dExt = Math.abs(sw[sw.length - 1].ext - sw[0].ext);
          dbg['arc' + s] = Math.round(d / D2R);
          if (Math.abs(d) > ((TUNE.swingAng * (marching ? 1.3 : 1)) / sens) * D2R && meanR > (marching ? 0.68 : TUNE.swingMinR) && dExt < TUNE.swingMaxExt) {
            const dx = sw[sw.length - 1].x - sw[0].x, dir = dx >= 0 ? 'r' : 'l', rot = d > 0 ? 'cw' : 'ccw'; if (back(rot)) continue;
            S.lastSwing[s] = t; S.counts.swing++; S.swingDir[s] = rot;
            ev.push({ type: 'swing', side: s, dir, power: clamp(Math.abs(d) / (120 * D2R), 0.5, 1), t }); // dir = way the hand travels in the image
          }
        }
      }
      return { ok: true, events: ev, walking, speed, guarding: !!S.guard, counts: S.counts, debug: dbg };
    }
    return { update, reset, setSens(v) { sens = clamp(v, 0.5, 1.8); }, get sens() { return sens; }, counts: () => S.counts };
  }


  /* pixel-motion energy around the body: pass RGBA of a small (e.g. 160 px wide) copy of the camera frame plus the pose image landmarks.
     Returns { up, low } = changed pixels (|diff| > 12) in the upper body / below the hips, per shoulder-width x torso-length. */
  function makeEnergy() {
    let prev = null;
    return function (rgba, W, H, img) {
      const g = new Float32Array(W * H);
      for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
      const p = prev; prev = g;
      if (!p || !img || !img[I.lsh] || !img[I.rsh] || !img[I.lhip] || !img[I.rhip]) return { up: 0, low: 0 };
      const shx = (img[I.lsh].x + img[I.rsh].x) / 2 * W, shy = (img[I.lsh].y + img[I.rsh].y) / 2 * H, hy = (img[I.lhip].y + img[I.rhip].y) / 2 * H, sw = Math.abs(img[I.lsh].x - img[I.rsh].x) * W + 1, T = Math.max(8 * H / 90, hy - shy);
      const x0 = Math.floor(Math.max(0, shx - 1.9 * sw)), x1 = Math.floor(Math.min(W, shx + 1.9 * sw)), ya = Math.floor(Math.max(0, shy - 0.9 * T)), yb = Math.floor(Math.min(H, hy + 0.2 * T)), yc = Math.floor(hy), yd = Math.floor(Math.min(H, hy + 1.2 * T));
      const sum = (y0, y1) => { let s = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const d = Math.abs(g[y * W + x] - p[y * W + x]); if (d > 12) s += d; } return s; };
      return { up: sum(ya, yb) / (sw * T), low: sum(yc, yd) / (sw * T) };
    };
  }
  const api = { makeEnergy, create, TUNE, I, setVis(a) { VISARM = a; } };
  root.FitMotion = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
