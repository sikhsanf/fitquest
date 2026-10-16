// Synthetic-skeleton tests for motion.js (no camera needed). World coords: metres, y down, z negative = towards camera.
const M = require('./motion.js');
const { I } = M;
const D2R = Math.PI / 180;
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
const add = (p, d, L) => ({ x: p.x + d[0] * L, y: p.y + d[1] * L, z: p.z + d[2] * L });
const nrm = (d) => { const n = Math.hypot(...d) || 1; return d.map((v) => v / n); };
const down = [0, 1, 0];
// pose spec: arms {l:[dirUpper,dirLower], r:[...]}, legs {l:[dirThigh,dirShin], r:[...]}
function frame(spec, noise) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  const set = (i, p) => { lm[i] = Object.assign({}, p); };
  set(I.lsh, { x: -0.2, y: -0.5, z: 0 }); set(I.rsh, { x: 0.2, y: -0.5, z: 0 }); set(I.lhip, { x: -0.1, y: 0, z: 0 }); set(I.rhip, { x: 0.1, y: 0, z: 0 });
  for (const s of ['l', 'r']) {
    const sh = lm[I[s + 'sh']], hip = lm[I[s + 'hip']];
    const [u, l] = spec.arms[s]; const el = add(sh, nrm(u), 0.3); set(I[s + 'el'], el); set(I[s + 'wr'], add(el, nrm(l), 0.27));
    const [t, c] = spec.legs[s]; const kn = add(hip, nrm(t), 0.43); set(I[s + 'kn'], kn); set(I[s + 'an'], add(kn, nrm(c), 0.43));
  }
  const world = lm.map((p) => ({ x: p.x + gauss() * noise, y: p.y + gauss() * noise, z: p.z + gauss() * noise * 2 }));
  const img = lm.map((p) => ({ x: 0.5 + p.x / 1.6, y: 0.4 + p.y / 2.1, z: 0, visibility: 1 }));
  return { img, world, w: 480, h: 640 };
}
const idleSpec = () => ({ arms: { l: [down, down], r: [down, down] }, legs: { l: [down, down], r: [down, down] } });
function run(fn, secs, noise, fps) {
  const m = M.create(); const ev = []; let last, walking = 0; fps = fps || 30; seed = 7;
  for (let i = 0; i < secs * fps; i++) { const t = i / fps; last = m.update(frame(fn(t), noise == null ? 0.012 : noise), t); ev.push(...last.events); if (last.walking) walking++; }
  const c = (k) => ev.filter((e) => e.type === k).length;
  return { ev, step: c('step'), punch: c('punch'), swing: c('swing'), kick: c('kick'), walking, last };
}
let fails = 0; const check = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + JSON.stringify(x) : '')); if (!c) fails++; };
const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, u)));

// 1. standing still
{ const r = run(idleSpec, 4); check('idle: nothing fires', r.step + r.punch + r.swing + r.kick === 0, { s: r.step, p: r.punch, w: r.swing, k: r.kick }); }
// 2. walking in place (small knee lifts facing camera) + natural arm swing
{
  const sp = (t) => { const s = idleSpec(); for (const [k, ph] of [['l', 0], ['r', Math.PI]]) { const a = Math.max(0, Math.sin((2 * Math.PI * t) / 1.2 + ph)) * 50 * D2R; s.legs[k] = [[0, Math.cos(a), -Math.sin(a)], down]; const sw = Math.sin((2 * Math.PI * t) / 1.2 + ph + Math.PI) * 25 * D2R; s.arms[k] = [[0, Math.cos(sw), -Math.sin(sw)], [0, Math.cos(sw * 1.2), -Math.sin(sw * 1.2)]]; } return s; };
  const r = run(sp, 6);
  check('walk in place: ~10 steps', r.step >= 8 && r.step <= 12, r.step); check('walk in place: walking state on', r.walking > 100, r.walking);
  check('walk in place: no punch/swing/kick', r.punch + r.swing + r.kick === 0, { p: r.punch, w: r.swing, k: r.kick });
  check('walk: speed reported', r.last.speed > 0.5, r.last.speed);
}
// 3. walking in place with side-view high knees
{
  const sp = (t) => { const s = idleSpec(); for (const [k, ph] of [['l', 0], ['r', Math.PI]]) { const a = Math.max(0, Math.sin((2 * Math.PI * t) / 0.9 + ph)) * 85 * D2R; s.legs[k] = [[0, Math.cos(a), -Math.sin(a)], [0, 1, 0.3 * Math.sin(a)]]; } return s; };
  const r = run(sp, 5); check('high knees: steps counted, no kicks', r.step >= 9 && r.kick === 0, { s: r.step, k: r.kick });
}
// 4. punches (jab, cross) from guard
{
  const guard = [[0.1, 0.8, -0.4], [0.05, -0.9, -0.45]], jab = [[0.05, 0.05, -1], [0.05, 0.02, -1]];
  const sp = (t) => { const s = idleSpec(); s.arms.l = guard; s.arms.r = guard; const n = Math.floor(t / 0.8), u = (t % 0.8), k = u < 0.12 ? ease(u / 0.12) : u < 0.2 ? 1 : 1 - ease((u - 0.2) / 0.2); const arm = n % 2 ? 'r' : 'l'; s.arms[arm] = [lerp(guard[0], jab[0], k), lerp(guard[1], jab[1], k)]; return s; };
  const r = run(sp, 4.8); check('punch: 6 jabs detected', r.punch >= 5 && r.punch <= 7, r.punch); check('punch: not read as swing/kick/step', r.swing + r.kick + r.step === 0, { w: r.swing, k: r.kick, s: r.step });
}
// 5. weapon swings (big arc sideways, arm straight)
{
  const dirAt = (phi) => [Math.cos(phi), Math.sin(phi), -0.15];
  const sp = (t) => { const s = idleSpec(); const c = t % 1.2, u = c / 0.28; if (u < 1) { const phi = -0.3 + (Math.PI + 0.3) * ease(u); const d = dirAt(-phi); s.arms.r = [d, d]; } else if (c < 0.9) { const k = ease((c - 0.28) / 0.6); const d = lerp(dirAt(-(Math.PI)), down, k); s.arms.r = [d, d]; } return s; };
  const r = run(sp, 4.9); console.log('SW', r.ev.filter((e) => e.type === 'swing').map((e) => e.t.toFixed(2) + e.dir + e.side).join(' ')); check('swing: 4 swings detected', r.swing >= 3 && r.swing <= 5, r.swing); check('swing: not read as punch/kick', r.punch + r.kick === 0, { p: r.punch, k: r.kick });
}
// 6. kicks
{
  const sp = (t) => { const s = idleSpec(); const u = (t % 1.2) / 0.5, k = u < 1 ? Math.sin(Math.PI * u) : 0; const a = 72 * D2R * k; const ch = 60 * D2R * k; s.legs.r = [[0, Math.cos(a), -Math.sin(a)], [0, Math.cos(a - (1 - Math.min(1, k * 2)) * 0.8), -Math.sin(a - (1 - Math.min(1, k * 2)) * 0.8)]]; void ch; return s; };
  const r = run(sp, 4.9); check('kick: 4 kicks detected', r.kick >= 3 && r.kick <= 5, r.kick); check('kick: no punch/swing', r.punch + r.swing === 0, { p: r.punch, w: r.swing });
}
// 7. standing and shaking arms/hanging arms do not punch
{ const sp = (t) => { const s = idleSpec(); const a = Math.sin(t * 6) * 0.25; s.arms.l = [[a, 1, 0], [a, 1, 0]]; s.arms.r = [[-a, 1, 0], [-a, 1, 0]]; return s; }; const r = run(sp, 4); check('arm wiggle at sides: no events', r.punch + r.swing + r.kick === 0, { p: r.punch, w: r.swing, k: r.kick }); }
// 7b. marching with a hard arm pump (elbows bent ~90, forearms alternate) must not punch/swing
{ const sp = (t) => { const s = idleSpec(); for (const [k, ph] of [['l', 0], ['r', Math.PI]]) { const a = Math.max(0, Math.sin((2 * Math.PI * t) / 0.8 + ph)) * 80 * D2R; s.legs[k] = [[0, Math.cos(a), -Math.sin(a)], [0, 1, 0.1]]; const w = Math.sin((2 * Math.PI * t) / 0.8 + ph + Math.PI); s.arms[k] = [[0.1, 0.9, -0.1 * w], [0.05, -0.4 - 0.5 * w, -0.9]]; } return s; }; const r = run(sp, 6); check('march + arm pump: no punch/swing/kick', r.punch + r.swing + r.kick === 0 && r.step >= 8, { s: r.step, p: r.punch, w: r.swing, k: r.kick }); }
// 6b. a kick does not leave a phantom step behind
{ const sp = (t) => { const s = idleSpec(); const u = (t % 1.6) / 0.5, k = u < 1 ? Math.sin(Math.PI * u) : 0; const a = 72 * D2R * k; const q = (1 - Math.min(1, k * 2)) * 0.8; s.legs.r = [[0, Math.cos(a), -Math.sin(a)], [0, Math.cos(a - q), -Math.sin(a - q)]]; return s; }; const r = run(sp, 6.4); const un = r.ev.filter((e) => e.type === 'unstep').length; check('kicks leave no net steps', r.kick >= 3 && r.step - un <= 1, { k: r.kick, s: r.step, un }); }
// 8. missing body -> not ok
{ const m = M.create(); const f = frame(idleSpec(), 0); f.img[I.lsh].visibility = 0.1; const o = m.update(f, 0); check('lost shoulders -> ok=false', o.ok === false); }
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
