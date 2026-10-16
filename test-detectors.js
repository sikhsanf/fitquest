// Synthetic-pose tests for detectors.js
const D = require('./detectors.js');
const { I } = D;
const rad = (d) => (d * Math.PI) / 180;
function blank() {
  const mk = () => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  return { img: mk(), world: mk(), w: 480, h: 640 };
}
// leg with knee angle theta (world): hip(0,0,0) knee(0,.4,0) ankle = knee + .4*(sin t, -cos t, 0)
function legs(f, theta) {
  for (const s of ['l', 'r']) {
    const hip = { x: 0, y: 0, z: 0 }, kn = { x: 0, y: 0.4, z: 0 };
    const an = { x: 0.4 * Math.sin(rad(theta)), y: 0.4 - 0.4 * Math.cos(rad(theta)), z: 0 };
    Object.assign(f.world[I[s + 'hip']], hip); Object.assign(f.world[I[s + 'kn']], kn); Object.assign(f.world[I[s + 'an']], an);
  }
}
function run(det, seq, mk) { let o; seq.forEach((v, i) => { o = det.update(mk(v), i / 30); }); return o; }
const wave = (hi, lo, n, reps) => { const a = []; for (let r = 0; r < reps; r++) { for (let i = 0; i < n; i++) a.push(hi - ((hi - lo) * i) / n); for (let i = 0; i < n; i++) a.push(lo + ((hi - lo) * i) / n); } a.push(hi, hi, hi); return a; };
let fails = 0;
const check = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + JSON.stringify(extra) : '')); if (!cond) fails++; };

// squat: 3 deep reps (min 85), 2 shallow reps (min 125)
{
  const d = D.create('squat', 'normal');
  run(d, wave(175, 85, 15, 3), (t) => { const f = blank(); legs(f, t); return f; });
  const r = d.result(); check('squat deep reps=3', r.reps === 3, r); check('squat deep score high', r.score >= 90, r);
  const d2 = D.create('squat', 'normal');
  run(d2, wave(175, 125, 15, 3), (t) => { const f = blank(); legs(f, t); return f; });
  const r2 = d2.result(); check('squat shallow reps=3 lower score', r2.reps === 3 && r2.score < r.score, r2);
  const d3 = D.create('squat', 'normal');
  const o = run(d3, [175], (t) => { const f = blank(); legs(f, t); f.img[I.lkn].visibility = 0.1; f.img[I.rkn].visibility = 0.1; return f; });
  check('squat missing -> not ok', o.ok === false, o);
}
// lunge
{
  const d = D.create('lunge', 'normal');
  run(d, wave(175, 90, 15, 3), (t) => { const f = blank(); legs(f, t); return f; });
  const r = d.result(); check('lunge reps=3', r.reps === 3 && r.score >= 90, r);
}
// push-up (knee): side view, elbow angle varies; body straight
{
  const mk = (elbow, bodyDev) => {
    const f = blank();
    for (const s of ['l', 'r']) {
      Object.assign(f.world[I[s + 'sh']], { x: 0, y: 0, z: 0 });
      Object.assign(f.world[I[s + 'el']], { x: 0, y: 0.3, z: 0 });
      Object.assign(f.world[I[s + 'wr']], { x: 0.3 * Math.sin(rad(elbow)), y: 0.3 - 0.3 * Math.cos(rad(elbow)), z: 0 });
      Object.assign(f.world[I[s + 'hip']], { x: -0.4, y: 0, z: 0 });
      Object.assign(f.world[I[s + 'kn']], { x: -0.4 - 0.4 * Math.cos(rad(bodyDev)), y: 0.4 * Math.sin(rad(bodyDev)), z: 0 });
    }
    return f;
  };
  const d = D.create('pushup', 'normal');
  run(d, wave(170, 80, 15, 3), (t) => mk(t, 0));
  const r = d.result(); check('pushup straight reps=3 score high', r.reps === 3 && r.score >= 85, r);
  const d2 = D.create('pushup', 'normal');
  run(d2, wave(170, 80, 15, 3), (t) => mk(t, 50));
  const r2 = d2.result(); check('pushup piked lower score', r2.reps === 3 && r2.score < r.score, r2);
}
// jumping jack (front view)
{
  const mk = (o) => { // o: 0 closed, 1 open
    const f = blank();
    const set = (n, x, y) => { f.img[I[n]].x = x; f.img[I[n]].y = y; };
    set('lsh', 0.4, 0.3); set('rsh', 0.6, 0.3); set('lhip', 0.44, 0.55); set('rhip', 0.56, 0.55);
    const wy = 0.5 - 0.5 * o; // 0.5 (down) -> 0.0 (overhead)
    set('lwr', 0.35 - 0.1 * o, wy); set('rwr', 0.65 + 0.1 * o, wy);
    const spread = 0.12 + 0.5 * o; // world meters
    Object.assign(f.world[I.lsh], { x: -0.18, y: 0, z: 0 }); Object.assign(f.world[I.rsh], { x: 0.18, y: 0, z: 0 });
    Object.assign(f.world[I.lan], { x: -spread / 2, y: 0.9, z: 0 }); Object.assign(f.world[I.ran], { x: spread / 2, y: 0.9, z: 0 });
    return f;
  };
  const d = D.create('march_jack', 'normal');
  run(d, wave(0, 1, 8, 4).map((v) => v), mk);
  const r = d.result(); check('jack reps=4', r.reps === 4, r);
  const d2 = D.create('march_jack', 'normal');
  run(d2, wave(0, 0.65, 8, 4), mk);
  const r2 = d2.result(); check('jack half-open scores lower', r2.reps >= 3 && r2.score < r.score, r2);
}
// plank: good for 20 s window, then not scored
{
  const mk = (sag) => {
    const f = blank();
    const set = (n, x, y, wx, wy) => { f.img[I[n]].x = x; f.img[I[n]].y = y; Object.assign(f.world[I[n]], { x: wx, y: wy, z: 0 }); };
    for (const s of ['l', 'r']) {
      set(s + 'sh', 0.3, 0.5, 0, 0); set(s + 'hip', 0.5, 0.5 + sag, 0.5, sag * 2); set(s + 'an', 0.8, 0.52, 1.0, 0.04);
    }
    return f;
  };
  const d = D.create('plank', 'normal');
  let o; for (let i = 0; i < 40 * 30; i++) o = d.update(mk(0.01), i / 30);
  const r = d.result(); check('plank good score high & eligible', r.score >= 95 && r.eligible && r.coverage > 0.9, r);
  check('plank after window not scored', o.scored === false, o);
  const d2 = D.create('plank', 'normal');
  for (let i = 0; i < 20 * 30; i++) d2.update(mk(0.12), i / 30);
  const r2 = d2.result(); check('plank sagging low score', r2.score <= 10, r2);
  const d3 = D.create('plank', 'normal');
  for (let i = 0; i < 20 * 30; i++) d3.update(i % 4 === 0 ? mk(0.01) : (() => { const f = mk(0.01); f.img[I.lsh].visibility = 0; f.img[I.rsh].visibility = 0; return f; })(), i / 30);
  const r3 = d3.result(); check('plank low coverage not eligible', !r3.eligible, r3);
}
check('registry', D.has('squat', 'normal') && !D.has('squat', 'easy') && !D.has('back_extension', 'normal'));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
