/* FitQuest — "Mode Gerak": first-person corridor fighter driven by real body motion.
   Pure sim (createSim) has no DOM and is unit-testable; play() is the Doom-style pixel view.
   Inputs: walk(speed 0..1.6) while you march in place, act('punch'|'swing'|'kick', power). */
(function (root) {
  'use strict';
  const KINDM = {
    zombie:  { spd: 1.0, wind: 0.6, cd: 1.3, reach: 1.4 },
    anjing:  { spd: 3.2, wind: 0.4, cd: 1.1, reach: 1.3 },
    raksasa: { spd: 0.7, wind: 0.95, cd: 1.9, reach: 2.1 },
  };
  const HP_M = 0.85, DMG_M = 0.7, WALK_V = 2.4, AGGRO = 12, FIRST = 9, GAP = 5.5, END_PAD = 8, BLOCK = 1.0;
  const ACT = {
    punch: { range: 2.3, n: 1, mul: 0.8, knock: 0.5, stun: 0 },
    swing: { range: 3.3, n: 3, mul: 1.1, knock: 0.9, stun: 0 },
    kick:  { range: 2.9, n: 1, mul: 0.55, knock: 3.6, stun: 1.2 },
  };

  function createSim(ps, zone, rnd) {
    rnd = rnd || Math.random;
    const enemies = []; let x = FIRST;
    zone.enemies.forEach(([kind, hp0, dmg0], i) => {
      const hp = Math.round(hp0 * (zone.hpM || 1) * HP_M), dmg = Math.round(dmg0 * (zone.dmgM || 1) * DMG_M);
      enemies.push({ kind, x, hp, maxhp: hp, dmg, st: 'idle', t: 0, cd: 0.5, dead: 0, hit: 0, stun: 0, i });
      x += GAP + (kind === 'raksasa' ? 2 : 0);
    });
    const S = { t: 0, p: 0, hp: ps.hp, maxhp: ps.hp, ps, enemies, endX: x + END_PAD, zone, status: 'run', kills: 0, hurt: 0, fx: [], v: 0, last: null, lastT: -9, stepPh: 0, walkSpeed: 0, acts: { punch: 0, swing: 0, kick: 0 } };
    const alive = () => enemies.filter((e) => e.hp > 0);
    const foe = () => alive().find((e) => e.x > S.p - 0.5); // nearest ahead
    S.walk = (sp) => { S.walkSpeed = Math.max(0, Math.min(1.8, sp || 0)); };
    S.act = (type, power) => {
      if (S.status !== 'run') return false;
      const a = ACT[type]; if (!a) return false;
      power = power == null ? 0.8 : power;
      S.acts[type]++; S.last = type; S.lastT = S.t;
      const c = alive().filter((e) => e.x - S.p <= a.range && e.x >= S.p - 0.5).sort((q, w) => q.x - w.x).slice(0, a.n);
      let hits = 0;
      c.forEach((e) => {
        const crit = rnd() < 0.1, d = Math.max(1, Math.round(ps.dmg * a.mul * (0.75 + 0.25 * power) * (crit ? 1.8 : 1)));
        e.hp -= d; e.hit = 0.15; e.x += a.knock * (e.kind === 'raksasa' ? 0.4 : 1);
        if (a.stun) { e.stun = Math.max(e.stun, a.stun * (e.kind === 'raksasa' ? 0.6 : 1)); e.st = 'chase'; e.t = 0; }
        else if (e.st === 'wind' && type === 'swing') { e.st = 'chase'; e.t = 0; } // a big swing breaks the wind-up
        S.fx.push({ k: 'dmg', x: e.x, v: d, crit, t: 0 }); hits++;
        if (e.hp <= 0) { e.dead = 0.01; S.kills++; }
      });
      return hits;
    };
    S.step = (dt) => {
      if (S.status !== 'run') return;
      S.t += dt; S.hurt = Math.max(0, S.hurt - dt);
      // move the player (cannot walk through a living enemy)
      S.v = S.walkSpeed * WALK_V;
      let np = S.p + S.v * dt; const f = alive().find((e) => e.x > S.p - 0.2);
      if (f && np > f.x - BLOCK) { np = Math.max(S.p, f.x - BLOCK); S.v = 0; }
      S.stepPh += (np - S.p) * 2.2; S.p = np;
      for (const e of enemies) {
        if (e.dead) { e.dead += dt; continue; }
        e.hit = Math.max(0, e.hit - dt); e.cd = Math.max(0, e.cd - dt);
        if (e.stun > 0) { e.stun -= dt; continue; }
        const k = KINDM[e.kind], dist = e.x - S.p;
        if (e.st === 'idle') { if (dist < AGGRO) e.st = 'chase'; continue; }
        if (e.st === 'chase') {
          if (dist > k.reach * 0.85) e.x -= k.spd * dt;
          else if (e.cd <= 0) { e.st = 'wind'; e.t = 0; }
        } else if (e.st === 'wind') {
          e.t += dt;
          if (e.t >= k.wind) {
            if (e.x - S.p <= k.reach + 0.5) {
              const d = Math.max(1, Math.round(e.dmg - ps.def)); S.hp -= d; S.hurt = 0.4; S.fx.push({ k: 'hurt', v: d, t: 0 });
              if (S.hp <= 0) { S.hp = 0; S.status = 'lose'; }
            }
            e.st = 'chase'; e.cd = k.cd; e.t = 0;
          }
        }
        if (e.x < S.p + 0.7) e.x = S.p + 0.7; // never inside the player
      }
      S.fx.forEach((q) => (q.t += dt)); S.fx = S.fx.filter((q) => q.t < 0.9);
      if (S.status === 'run' && alive().length === 0 && S.p >= S.endX - 1) S.status = 'win';
    };
    S.foe = foe; S.alive = alive;
    return S;
  }
  const reward = (sim) => (sim.status === 'win' ? sim.zone.scrap : Math.round(sim.zone.scrap * 0.1 * sim.kills));

  /* simple bot: marches, punches rhythmically, kicks when something is winding up close, occasional swing at crowds.
     rate = actions per second, the player's real-life stamina. */
  function runBot(ps, zone, rate, rnd, o) {
    rnd = rnd || Math.random; o = o || {};
    const s = createSim(ps, zone, rnd); let n = 0, nextAct = 0.4;
    while (s.status === 'run' && n++ < 60 * 400) {
      const f = s.foe(), dist = f ? f.x - s.p : 99;
      s.walk(f && dist < 3.2 ? 0 : 1.0);
      if (s.t >= nextAct && f && dist < 3.3) {
        const crowd = s.alive().filter((e) => e.x - s.p < 3.3).length;
        let type = 'punch';
        if (f.st === 'wind' && dist < 2.8 && rnd() < (o.react == null ? 0.6 : o.react)) type = 'kick';
        else if (crowd >= 2 && dist < 3.2) type = 'swing';
        else if (dist > 2.3) type = 'swing';
        s.act(type, 0.7 + rnd() * 0.3); nextAct = s.t + (type === 'punch' ? 1 : 1.4) / rate;
      }
      s.step(1 / 60);
    }
    return s;
  }

  /* ------------------------------ view ------------------------------ */
  const VW = 320; let VH = 180, HY = 82;
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const cache = {};
  function spr(key, mk, sc) {
    if (cache[key]) return cache[key];
    const B = mk(), c = document.createElement('canvas'); c.width = Math.ceil(B.w * sc); c.height = Math.ceil(B.h * sc);
    const x = c.getContext('2d');
    if (x) for (let i = 0; i < B.p.length; i++) { const v = B.p[i]; if (v === null) continue; x.fillStyle = v; x.fillRect(Math.floor((i % B.w) * sc), Math.floor(Math.floor(i / B.w) * sc), Math.ceil(sc), Math.ceil(sc)); }
    return (cache[key] = c);
  }
  function play(canvas, opts) {
    const AV = root.FitAvatar;
    const asp = (root.innerHeight || 9) / (root.innerWidth || 16); VH = Math.max(180, Math.min(440, Math.round(VW * asp * 0.92 / 2) * 2)); HY = Math.round(VH * 0.45);
    canvas.width = VW; canvas.height = VH;
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const sim = createSim(opts.ps, opts.zone);
    const sky = opts.zone.sky || ['#2a3550', '#6b5b6e'];
    const skin = (opts.pal && (opts.pal.skin || opts.pal.s)) || '#e0ac82';
    let raf = 0, last = 0, ended = false, flash = 0, ann = null, startT = 0;
    const FOV = 120; // px per (1 / metre)
    const proj = (d) => FOV / Math.max(0.35, d);
    const ctl = {
      sim, stop() { cancelAnimationFrame(raf); ended = true; },
      walk: (v) => sim.walk(v), act: (t, p) => { const h = sim.act(t, p); ann = { t: 0, txt: t === 'punch' ? 'PUKUL' : t === 'swing' ? 'AYUN' : 'TENDANG', hit: h }; return h; },
      flee() { if (sim.status === 'run') sim.status = 'flee'; },
    };
    function corridor() {
      const g = ctx.createLinearGradient(0, 0, 0, HY); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, HY);
      // ceiling (dark) and floor with moving stripes
      ctx.fillStyle = '#17141c'; ctx.fillRect(0, 0, VW, 30);
      ctx.fillStyle = '#2e2620'; ctx.fillRect(0, HY, VW, VH - HY);
      const bob = Math.sin(sim.stepPh * 3.1) * 1.8 * Math.min(1, sim.walkSpeed);
      for (let i = 0; i < 14; i++) {
        const z = (i + 1 - ((sim.p % 1) + 1) % 1) ; // distance of stripe ahead (metres)
        if (z <= 0.3) continue;
        const y = HY + 1 + proj(z) * 0.55 + bob; ctx.fillStyle = i % 2 ? '#3b3128' : '#241d18'; ctx.fillRect(0, y, VW, Math.max(1, proj(z) * 0.1));
        const wx = proj(z) * 1.1; ctx.fillStyle = '#463b30'; ctx.fillRect(VW / 2 - wx, y, 2, 2); ctx.fillRect(VW / 2 + wx - 2, y, 2, 2);
      }
      for (let i = 0; i < 12; i++) { const idx = Math.floor(sim.p) + i, z = i + 1 - (((sim.p % 1) + 1) % 1); if (z < 0.5) continue; const hv = hash(idx * 7.3); if (hv > 0.45) continue; const y = HY + proj(z) * 0.55 + bob, wx = VW / 2 + (hv < 0.22 ? -1 : 1) * proj(z) * (0.55 + hv), sz = Math.max(2, proj(z) * 0.14); ctx.fillStyle = '#1b1612'; ctx.fillRect(wx, y, sz * 1.4, sz * 0.6); ctx.fillStyle = '#3d3329'; ctx.fillRect(wx + 1, y - sz * 0.3, sz, sz * 0.4); }
      // side walls: panels slide with the player
      for (let i = 0; i < 16; i++) {
        const z = i + 1 - (((sim.p % 1) + 1) % 1); if (z < 0.4) continue; const s = proj(z), s2 = proj(z + 1);
        const x1 = VW / 2 - s * 1.6, x2 = VW / 2 - s2 * 1.6, shade = Math.max(0.15, 1 - z / 14);
        ctx.fillStyle = `rgba(${40 * shade + 14 | 0},${34 * shade + 12 | 0},${46 * shade + 16 | 0},1)`;
        ctx.fillRect(Math.min(x1, x2), HY - s * 1.1, Math.abs(x1 - x2) + 1, s * 1.6 + s * 0.5);
        ctx.fillRect(VW - Math.max(x1, x2) - 1, HY - s * 1.1, Math.abs(x1 - x2) + 1, s * 1.6 + s * 0.5);
        ctx.fillStyle = `rgba(0,0,0,.35)`; ctx.fillRect(x1, HY - s * 1.1, 1, s * 2.1); ctx.fillRect(VW - x1 - 1, HY - s * 1.1, 1, s * 2.1);
        { const idx = Math.floor(sim.p) + i; for (const side of [0, 1]) { const hv = hash(idx * 2 + side), wL = Math.abs(x1 - x2) + 1, xx = side ? VW - Math.max(x1, x2) - 1 : Math.min(x1, x2), top = HY - s * 1.1, hh = s * 2.1;
          if (wL < 3) continue;
          if (hv < 0.18) { ctx.fillStyle = `rgba(14,12,18,${0.85})`; ctx.fillRect(xx + wL * 0.2, top + hh * 0.28, wL * 0.6, hh * 0.72); ctx.fillStyle = `rgba(120,100,80,${0.5 * shade + 0.1})`; ctx.fillRect(xx + wL * 0.2, top + hh * 0.28, wL * 0.6, Math.max(1, hh * 0.04)); }
          else if (hv < 0.33) { ctx.fillStyle = `rgba(255,200,110,${0.22 * shade + 0.05})`; ctx.fillRect(xx + wL * 0.25, top + hh * 0.2, wL * 0.5, hh * 0.22); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(xx + wL * 0.25, top + hh * 0.2, 1, hh * 0.22); ctx.fillRect(xx + wL * 0.5, top + hh * 0.2, 1, hh * 0.22); }
          else if (hv < 0.42) { ctx.fillStyle = `rgba(190,40,40,${0.5 * shade + 0.1})`; ctx.fillRect(xx + wL * 0.15, top + hh * 0.45, wL * 0.7, Math.max(1, hh * 0.05)); ctx.fillRect(xx + wL * 0.3, top + hh * 0.38, wL * 0.1, hh * 0.2); }
          else if (hv < 0.5) { ctx.fillStyle = `rgba(70,50,35,${0.8})`; ctx.fillRect(xx + wL * 0.1, top + hh * 0.78, wL * 0.8, hh * 0.22); ctx.fillStyle = `rgba(110,84,60,${0.7})`; ctx.fillRect(xx + wL * 0.2, top + hh * 0.7, wL * 0.5, hh * 0.1); }
        } }
        if (i % 4 === 0) { ctx.fillStyle = `rgba(255,190,90,${0.55 * shade + 0.1})`; ctx.fillRect(x1 + 2, HY - s * 0.7, Math.max(2, s * 0.12), Math.max(3, s * 0.3)); ctx.fillRect(VW - x1 - 2 - Math.max(2, s * 0.12), HY - s * 0.7, Math.max(2, s * 0.12), Math.max(3, s * 0.3)); }
      }
      // goal gate
      const gd = sim.endX - sim.p; if (gd < 14 && gd > 0.5) { const s = proj(gd), a = Math.min(1, (14 - gd) / 6); ctx.fillStyle = `rgba(198,244,50,${0.8 * a})`; ctx.fillRect(VW / 2 - s * 0.8, HY - s * 1.0, s * 1.6, 3); ctx.fillRect(VW / 2 - s * 0.8, HY - s * 1.0, 3, s * 1.45); ctx.fillRect(VW / 2 + s * 0.8 - 3, HY - s * 1.0, 3, s * 1.45); }
    }
    function enemies() {
      const list = sim.enemies.filter((e) => e.x - sim.p > 0.35 && e.x - sim.p < 22).sort((a, b) => b.x - a.x);
      for (const e of list) {
        const d = e.x - sim.p, frame = Math.floor(sim.t * (e.kind === 'anjing' ? 8 : 4)) % 2;
        const base = e.kind === 'raksasa' ? 4.2 : e.kind === 'anjing' ? 2.2 : 2.6;
        const sc = Math.max(0.5, proj(d) * base / 30);
        const s = spr(`m:${e.kind}:${frame}`, () => AV.monster(e.kind, frame, e.kind === 'raksasa' ? '#7a9a6a' : undefined), 1);
        const w = s.width * sc, h = s.height * sc, x = VW / 2 + (e.i % 2 ? 1 : -1) * Math.min(6, 0.15 * e.i) * 0, y = HY + proj(d) * 0.55 - h + 4;
        if (e.dead) { ctx.globalAlpha = Math.max(0, 1 - e.dead * 1.6); if (!ctx.globalAlpha) { ctx.globalAlpha = 1; continue; } }
        const shake = e.stun > 0 ? Math.sin(sim.t * 50) * 2 : 0;
        const shade = Math.max(0.35, 1 - d / 20);
        ctx.drawImage(s, Math.round(x - w / 2 + shake), Math.round(y), Math.round(w), Math.round(h));
        ctx.fillStyle = `rgba(0,0,0,${0.55 * (1 - shade) + (d > 9 ? 0.15 : 0)})`; ctx.globalCompositeOperation = 'source-atop';
        ctx.globalCompositeOperation = 'source-over';
        if (e.hit > 0) { ctx.globalAlpha = 0.55; ctx.fillStyle = '#fff'; ctx.fillRect(x - w / 2, y, w, h); }
        ctx.globalAlpha = 1;
        if (!e.dead) {
          const bw = Math.max(20, w * 0.8); ctx.fillStyle = '#150f0b'; ctx.fillRect(x - bw / 2, y - 7, bw, 5); ctx.fillStyle = '#e0432b'; ctx.fillRect(x - bw / 2 + 1, y - 6, (bw - 2) * Math.max(0, e.hp / e.maxhp), 3);
          if (e.st === 'wind') { ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 2, y - 24, 5, 11); ctx.fillRect(x - 2, y - 11, 5, 4); }
          if (e.stun > 0) { ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 12px monospace'; ctx.fillText('★ ★', x - 12, y - 10); }
        }
      }
    }
    const FIST = ['..kkkkkkkkkk..', '.kkhkhkhkhkkk.', 'kkkkkkkkkkkkkk', 'kkskkskkskkskk', 'kkkkkkkkkkkkkk', 'kkkkkkkkkkkkkk', '.kkkkkkkkkkks.', '..kkkkkkkkss..'];
    const pal = opts.pal || {}, SL = { jaket: 'ja', rompi: 'rv', pelindung: 'mt', baja: 'st' }[opts.look && opts.look.armor] || 't';
    const col = { k: pal.k || '#e0ac82', h: pal.kh || '#f0c9a6', s: pal.ks || '#b0805c', t: pal[SL] || '#3a6fb0', th: pal[SL + 'h'] || pal.th || '#5a8fd0', ts: pal[SL + 's'] || pal.ts || '#274f86' };
    let fistImg = null;
    function drawFist(x, y, sc, rot, mirror) {
      if (!fistImg) { fistImg = document.createElement('canvas'); fistImg.width = 14; fistImg.height = 8; const g = fistImg.getContext('2d'); FIST.forEach((r, ry) => [...r].forEach((c, rx) => { if (c === '.') return; g.fillStyle = col[c]; g.fillRect(rx, ry, 1, 1); })); }
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); if (mirror) ctx.scale(-1, 1);
      const w = 14 * sc, h = 8 * sc; // sleeve first (behind the fist), running off the bottom of the screen
      ctx.fillStyle = col.ts; ctx.fillRect(-w * 0.42 + sc, h * 0.2, w * 0.84, 200); ctx.fillStyle = col.t; ctx.fillRect(-w * 0.42, h * 0.2, w * 0.84 - sc, 200); ctx.fillStyle = col.th; ctx.fillRect(-w * 0.42, h * 0.2, sc * 1.4, 200);
      ctx.fillStyle = col.ts; ctx.fillRect(-w * 0.46, h * 0.7, w * 0.92, sc * 1.2); // cuff
      ctx.imageSmoothingEnabled = false; ctx.drawImage(fistImg, -w / 2, -h * 0.35, w, h);
      ctx.restore();
    }
    function hands() {
      const t = sim.t - sim.lastT, k = sim.last, cx = VW / 2, by = VH;
      const wk = Math.min(1, sim.walkSpeed), bobx = Math.sin(sim.stepPh * 3.1) * 4 * wk, boby = Math.abs(Math.cos(sim.stepPh * 3.1)) * 5 * wk;
      const sc = VH > 260 ? 4.2 : 3.2, wid = opts.ps.weapon, hasW = wid !== 'tangan' && AV;
      if (k === 'kick' && t < 0.45) { const u = Math.sin(Math.min(1, t / 0.45) * Math.PI); const bx = cx, by2 = by - 4 - u * (VH * 0.42); ctx.fillStyle = '#20232c'; ctx.fillRect(bx - 28, by2, 56, VH - by2 + 20); ctx.fillStyle = '#2f3440'; ctx.fillRect(bx - 28, by2, 12, VH - by2 + 20); ctx.fillStyle = '#d8dbe0'; ctx.fillRect(bx - 31, by2 - 6, 62, 14); ctx.fillStyle = '#9aa0aa'; ctx.fillRect(bx - 31, by2 + 6, 62, 4); ctx.fillStyle = '#111'; ctx.fillRect(bx - 31, by2 + 10, 62, 5); }
      const punch = k === 'punch' && t < 0.3 ? Math.sin(Math.min(1, t / 0.3) * Math.PI) : 0, swing = k === 'swing' && t < 0.4 ? t / 0.4 : -1;
      // left hand: guard (jabs forward on PUKUL)
      drawFist(cx - 58 + bobx + punch * 40, by - 18 + boby - punch * (VH * 0.3), sc + punch * 2.6, 0.12 - punch * 0.15, false);
      if (hasW) {
        const ws = spr('w:' + wid, () => AV.weapon(wid), 5);
        ctx.save(); ctx.translate(cx + 62 + bobx, by + 10 + boby); ctx.rotate(swing >= 0 ? -1.2 + swing * 2.7 : -0.28 - punch * 0.3); ctx.imageSmoothingEnabled = false; ctx.drawImage(ws, -ws.width / 2, -ws.height + 8); ctx.restore();
        drawFist(cx + 62 + bobx, by + 6 + boby, sc * 0.9, 0, true);
        if (swing >= 0) { ctx.fillStyle = `rgba(255,255,255,${0.45 * (1 - swing)})`; ctx.fillRect(cx - 110 + swing * 200, HY - 30 + Math.sin(swing * Math.PI) * -14, 70, 6); ctx.fillRect(cx - 90 + swing * 190, HY - 20, 50, 3); }
      } else {
        const sx = swing >= 0 ? -70 + swing * 140 : 0, sy = swing >= 0 ? -Math.sin(swing * Math.PI) * 50 : 0;
        drawFist(cx + 58 + bobx + sx * 0.6, by - 18 + boby + sy - punch * 10, sc, -0.12, true);
      }
    }
    function hud() {
      ctx.fillStyle = '#000a'; ctx.fillRect(0, 0, VW, 14);
      ctx.fillStyle = '#3a1210'; ctx.fillRect(4, 3, 110, 8); ctx.fillStyle = sim.hp / sim.maxhp > 0.35 ? '#e0432b' : '#ff7a3d'; ctx.fillRect(5, 4, 108 * sim.hp / sim.maxhp, 6);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px monospace'; ctx.textBaseline = 'top'; ctx.fillText('❤ ' + Math.ceil(sim.hp), 120, 3);
      const left = sim.alive().length; ctx.textAlign = 'right'; ctx.fillText(left ? '☠ ' + left : 'MAJU ▶ ' + Math.max(0, Math.ceil(sim.endX - sim.p)) + 'm', VW - 4, 3); ctx.textAlign = 'left';
      if (ann) { ann.t += 0.016; if (ann.t < 0.45) { ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = ann.hit ? '#c6f432' : '#ffffff88'; ctx.fillText(ann.txt + (ann.hit ? '!' : ''), VW / 2, 20); ctx.textAlign = 'left'; } }
      for (const q of sim.fx) {
        if (q.k === 'dmg') { const d = q.x - sim.p; if (d < 0.3) continue; ctx.font = 'bold ' + (q.crit ? 16 : 12) + 'px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = q.crit ? '#ffd23f' : '#fff'; ctx.fillText(String(q.v), VW / 2, HY - proj(d) * 0.7 - q.t * 30); ctx.textAlign = 'left'; }
      }
      if (sim.hurt > 0) { ctx.fillStyle = `rgba(220,20,20,${sim.hurt * 0.9})`; ctx.fillRect(0, 0, VW, VH); }
      if (!sim.walkSpeed && sim.alive().length === 0 && sim.status === 'run') { ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#c6f432'; ctx.fillText('Jalan di tempat untuk maju ▶', VW / 2, 36); ctx.textAlign = 'left'; }
    }
    function render() { ctx.save(); const sh = sim.hurt > 0 ? (Math.random() - 0.5) * 6 * sim.hurt : 0; ctx.translate(sh, 0); corridor(); enemies(); hands(); ctx.restore(); hud(); }
    let endT = 0;
    function frame(ts) {
      if (ended) return; raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
      if (sim.status === 'run') sim.step(dt); else { endT += dt; if (endT > 0.9) { ended = true; opts.onEnd && opts.onEnd({ status: sim.status, kills: sim.kills, scrap: reward(sim) }); } }
      render(); opts.onFrame && opts.onFrame(sim);
    }
    raf = requestAnimationFrame(frame);
    return ctl;
  }

  const api = { createSim, runBot, reward, play, KINDM, ACT };
  root.FitFPS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
