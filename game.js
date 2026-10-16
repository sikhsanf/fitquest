/* FitQuest — "Kamp & Reruntuhan": side-scrolling apocalypse auto-battler with weapon skill trees (unlocked by muscle level). Sim (pure logic, testable) + View (canvas). */
(function (root) {
  'use strict';
  const AV = root.FitAvatar || (typeof require !== 'undefined' ? require('./avatar.js') : null);

  /* ---------------- data ---------------- */
  const WEAPON_COST = 150, WEAPON_DMG = 8; // every weapon costs and hits the same: what differs is the skill tree
  const ZONES = [].concat([
    { id: 'jalan', name: 'Jalanan Sepi', rec: 1, scrap: 30, desc: 'Zombie lambat berkeliaran. Cocok buat pemanasan.', sky: ['#2a3550', '#6b5b6e'], enemies: [['zombie', 24, 6], ['zombie', 24, 6], ['zombie', 26, 6], ['zombie', 26, 7], ['zombie', 28, 7]] },
    { id: 'pasar', name: 'Pasar Mati', rec: 3, scrap: 70, desc: 'Zombie lebih tebal, dan ada anjing mutan yang cepat.', sky: ['#3a2f45', '#8a5b52'], enemies: [['zombie', 44, 9], ['anjing', 30, 9], ['zombie', 46, 10], ['anjing', 32, 10], ['zombie', 48, 10], ['anjing', 32, 10], ['zombie', 50, 11]] },
    { id: 'pabrik', name: 'Pabrik Tua', rec: 6, scrap: 140, desc: 'Gerombolan. Tanpa otot, kamu tumbang.', sky: ['#2b2f3a', '#6a4a3a'], enemies: [['zombie', 82, 15], ['zombie', 84, 16], ['anjing', 60, 15], ['zombie', 88, 16], ['anjing', 62, 16], ['zombie', 92, 17], ['zombie', 94, 17], ['anjing', 64, 17]] },
    { id: 'menara', name: 'Menara Radio', rec: 10, hpM: 1.15, dmgM: 1.25, scrap: 300, desc: 'Sarang si Raksasa. Datang dengan badan siap.', sky: ['#1d1f33', '#5a2f3f'], enemies: [['zombie', 150, 22], ['anjing', 105, 22], ['zombie', 155, 23], ['anjing', 110, 23], ['zombie', 160, 24], ['raksasa', 680, 38]] },
  ]).map((z) => Object.assign({ hpM: 1.45, dmgM: 1.4 }, z));
  /* late zones: enemy strength is derived from the level a player is expected to have there */
  function lateZone(id, name, rec, scrap, desc, sky, pattern, k) {
    const g = rec * 0.75, pd = 6 + 1.2 * (rec - 1) + 2.7 * g + WEAPON_DMG, ph = 60 + 9 * (rec - 1) + 9 * g;
    const hp = (m) => Math.round((k.hp * pd * m) / 1.45), dm = (m) => Math.round((k.dm * ph * m) / 1.4);
    return { id, name, rec, scrap, desc, sky, hpM: 1.45, dmgM: 1.4, enemies: pattern.map((kind) => (kind === 'zombie' ? [kind, hp(1), dm(0.1)] : kind === 'anjing' ? [kind, hp(0.7), dm(0.095)] : [kind, hp(5.5), dm(0.2)])) };
  }
  const P1 = ['zombie', 'anjing', 'zombie', 'zombie', 'anjing', 'zombie', 'anjing', 'zombie'];
  ZONES.push(
    lateZone('stasiun', 'Stasiun Bawah Tanah', 15, 520, 'Lorong gelap penuh gerombolan.', ['#10141f', '#3a2f4a'], P1, { hp: 6, dm: 1.3 }),
    lateZone('pelabuhan', 'Pelabuhan Karam', 21, 800, 'Zombie berkarat dan anjing laut mutan.', ['#18273a', '#4a6a7a'], P1.concat(['anjing']), { hp: 6, dm: 1.3 }),
    lateZone('kota', 'Kota Mati', 28, 1200, 'Jantung wabah. Hanya yang terlatih yang keluar hidup.', ['#2a1a2a', '#7a3a3a'], P1.concat(['zombie', 'anjing']), { hp: 6, dm: 1.3 }),
    lateZone('raja', 'Markas Sang Raja', 36, 2000, 'Raksasa pertama menjaga pintu. Sang Raja menunggu di dalam.', ['#12091a', '#6a1f3a'], ['zombie', 'anjing', 'zombie', 'anjing', 'zombie', 'raksasa'], { hp: 4, dm: 1.1 }),
  );
  const WEAPONS = [
    { id: 'tangan', name: 'Tangan kosong', dmg: 0, cost: 0, em: '👊', blurb: 'Gaya bertarung bebas: pukulan dan tendangan.' },
    { id: 'pipa', name: 'Pipa besi', dmg: WEAPON_DMG, cost: WEAPON_COST, em: '🔱', blurb: 'Jangkauan panjang, tusukan dan tangkisan.' },
    { id: 'bat', name: 'Bat paku', dmg: WEAPON_DMG, cost: WEAPON_COST, em: '⚾', blurb: 'Hantaman telak, mental dan pingsankan musuh.' },
    { id: 'parang', name: 'Parang', dmg: WEAPON_DMG, cost: WEAPON_COST, em: '🗡', blurb: 'Cepat dan tajam, suka berputar dan haus darah.' },
    { id: 'kapak', name: 'Kapak darurat', dmg: WEAPON_DMG, cost: WEAPON_COST, em: '🪓', blurb: 'Lambat tapi mematikan, bisa dilempar.' },
  ];
  const ARMORS = [
    { id: 'none', name: 'Tanpa pelindung', def: 0, cost: 0 },
    { id: 'jaket', name: 'Jaket tebal', def: 2, cost: 50 },
    { id: 'rompi', name: 'Rompi karet', def: 4, cost: 160 },
    { id: 'pelindung', name: 'Pelindung motor', def: 7, cost: 400 },
    { id: 'baja', name: 'Baju lempeng baja', def: 11, cost: 900 },
  ];
  const GROUP_NAME = { kaki: 'Kaki', paha: 'Paha', core: 'Core', lengan: 'Lengan', dada: 'Dada', bahu: 'Bahu' };

  /* Skill trees — active skills only. req = [muscle group, group level]; a node also needs its parent unlocked. */
  const sk = (id, name, em, desc, anim, cd, req, parent, x) => Object.assign({ id, name, em, desc, anim, cd, req, parent: parent || null, mult: 1, hits: 1 }, x || {});
  const SKILLS = {
    tangan: [
      sk('pukul', 'Pukulan Kuat', '👊', 'Satu pukulan berat, musuh terdorong.', 'punch2', 4, ['lengan', 3], null, { mult: 2.2, knock: 10 }),
      sk('bertubi', 'Hantam Bertubi', '⚡', '4 pukulan beruntun.', 'combo', 7, ['dada', 8], 'pukul', { hits: 4, mult: 0.9 }),
      sk('tendang', 'Tendangan Badai', '🦵', 'Tendangan memutar kena semua musuh di depan.', 'kick', 8, ['paha', 8], 'pukul', { mult: 1.7, aoe: true, knock: 16 }),
      sk('murka', 'Teriak Murka', '😤', 'Serangan +60% selama 6 detik.', 'roar', 16, ['core', 20], 'bertubi', { buff: { atk: 1.6, sec: 6 } }),
    ],
    pipa: [
      sk('sodok', 'Sodok', '🔱', 'Menusuk lurus, tembus 2 musuh.', 'thrust', 4, ['lengan', 4], null, { mult: 2, pierce: 2, lunge: 8 }),
      sk('sapu', 'Sapu Pipa', '🌀', 'Ayunan lebar kena semua musuh di depan.', 'slash', 7, ['core', 9], 'sodok', { mult: 1.5, aoe: true }),
      sk('tangkis', 'Tangkis Keras', '🛡', 'Serangan musuh berkurang 65% selama 3 detik.', 'guard', 12, ['bahu', 12], 'sodok', { guard: { red: 0.65, sec: 3 } }),
      sk('getar', 'Pukulan Menggetarkan', '💥', 'Musuh di depan pingsan 1,5 detik.', 'smash', 11, ['dada', 22], 'sapu', { mult: 1.2, aoe: true, stun: 1.5 }),
    ],
    bat: [
      sk('homerun', 'Home Run', '⚾', 'Pukulan super, musuh terlempar.', 'smash', 5, ['lengan', 5], null, { mult: 2.9, knock: 24 }),
      sk('paku', 'Hantam Paku', '📌', 'Sabetan lebar menghantam semua musuh.', 'slash', 8, ['bahu', 10], 'homerun', { mult: 2.0, aoe: true }),
      sk('gertak', 'Gertak', '😠', 'Musuh sekitar pingsan 2 detik.', 'roar', 13, ['core', 14], 'homerun', { mult: 0.6, aoe: true, stun: 2 }),
      sk('amuk', 'Amukan', '🌪', 'Berputar 3 kali, menghajar semua di sekitar.', 'spin', 14, ['dada', 25], 'paku', { hits: 3, mult: 1.2, aoe: true, range: 50 }),
    ],
    parang: [
      sk('tebas', 'Tebasan Cepat', '🗡', 'Tebasan tajam.', 'slash', 4, ['lengan', 6], null, { mult: 1.8 }),
      sk('tusuk', 'Tusukan Kilat', '⚡', 'Melesat maju menusuk.', 'thrust', 6, ['paha', 11], 'tebas', { mult: 2.4, lunge: 16 }),
      sk('pusar', 'Pusaran Parang', '🌀', 'Berputar menebas semua musuh, 3 kali.', 'spin', 10, ['core', 18], 'tebas', { hits: 3, mult: 1, aoe: true, range: 50 }),
      sk('darah', 'Haus Darah', '🩸', 'Serangan +80% selama 6 detik, pulihkan 15% HP.', 'roar', 18, ['bahu', 30], 'pusar', { buff: { atk: 1.8, sec: 6 }, heal: 0.15 }),
    ],
    kapak: [
      sk('belah', 'Belah Tengkorak', '🪓', 'Hantaman mematikan.', 'smash', 6, ['lengan', 8], null, { mult: 3.2, knock: 10 }),
      sk('gempa', 'Gempa Kapak', '🌋', 'Hantam tanah, semua musuh pingsan 1,5 detik.', 'smash', 10, ['kaki', 14], 'belah', { mult: 2, aoe: true, stun: 1.5 }),
      sk('lempar', 'Lemparan Kapak', '🎯', 'Serangan jarak jauh.', 'thrust', 8, ['dada', 20], 'belah', { mult: 2.6, range: 130 }),
      sk('berserk', 'Murka Berserk', '🔥', 'Serangan +100% selama 8 detik.', 'roar', 20, ['core', 35], 'gempa', { buff: { atk: 2, sec: 8 } }),
    ],
  };
  /* which nodes of a weapon's tree are unlocked at these group levels */
  function unlockedSkills(weaponId, g) {
    const tree = SKILLS[weaponId] || [], have = {}, out = [];
    g = g || {};
    tree.forEach((n) => { if ((g[n.req[0]] || 1) >= n.req[1] && (!n.parent || have[n.parent])) { have[n.id] = 1; out.push(n); } });
    return out;
  }
  const KIND = {
    zombie: { spd: 22, wind: 0.5, cd: 1.2, reach: 18, w: 20 },
    anjing: { spd: 70, wind: 0.3, cd: 1.0, reach: 20, w: 28 },
    raksasa: { spd: 14, wind: 0.85, cd: 1.6, reach: 30, w: 24 },
  };
  const weaponOf = (id) => WEAPONS.find((w) => w.id === id) || WEAPONS[0];
  const armorOf = (id) => ARMORS.find((a) => a.id === id) || ARMORS[0];

  function playerStats(L, g, gear) {
    g = Object.assign({ kaki: 1, paha: 1, core: 1, lengan: 1, dada: 1, bahu: 1 }, g || {});
    gear = gear || {};
    const w = weaponOf(gear.weapon), a = armorOf(gear.armor);
    return {
      hp: Math.round(60 + 9 * (L - 1) + 3 * (g.kaki + g.paha + g.core)),
      dmg: Math.round(6 + 1.2 * (L - 1) + 0.9 * (g.lengan + g.dada + g.bahu) + w.dmg),
      def: a.def, speed: 38 + 2 * g.kaki, weapon: w.id, skills: unlockedSkills(w.id, g),
    };
  }

  /* ---------------- Sim ---------------- */
  const GOAL_PAD = 120, PUNCH_CD = 0.48;
  function createSim(ps, zone, rnd) {
    rnd = rnd || Math.random;
    const enemies = []; let x = 170;
    zone.enemies.forEach(([kind, hp0, dmg0], i) => { const hp = Math.round(hp0 * (zone.hpM || 1)), dmg = Math.round(dmg0 * (zone.dmgM || 1)); enemies.push({ kind, x, hp, maxhp: hp, dmg, st: 'idle', t: 0, cd: 0.6, dead: 0, hit: 0, stun: 0, id: i }); x += 120 + Math.round(rnd() * 40); });
    const S = { t: 0, px: 20, py: 0, vy: 0, hp: ps.hp, maxhp: ps.hp, ps, enemies, endX: x + GOAL_PAD, atkCd: 0.2, lock: 0, hurt: 0, status: 'run', kills: 0, fx: [], vfx: [], zone, dodged: 0,
      pa: null, cd: {}, events: [], buffUntil: 0, buffMul: 1, guardUntil: 0, guardRed: 0, hand: 0, moving: false, walkPh: 0, skillsUsed: 0 };
    ps.skills.forEach((s) => (S.cd[s.id] = 0));
    const alive = () => S.enemies.filter((e) => e.hp > 0);
    const dmgOf = (m) => { const crit = rnd() < 0.1, d = Math.round(ps.dmg * (S.t < S.buffUntil ? S.buffMul : 1) * m * (crit ? 1.8 : 1)); return [d, crit]; };
    const hurtEnemy = (e, m, o) => {
      const [d, crit] = dmgOf(m); e.hp -= d; e.hit = 0.15;
      if (o.knock) e.x += o.knock; else e.x += e.kind === 'raksasa' ? 1 : 3;
      if (o.stun) { e.stun = Math.max(e.stun, o.stun); e.st = 'chase'; }
      S.fx.push({ x: e.x, y: 30, txt: String(d), t: 0, crit }); S.vfx.push({ k: 'hit', x: e.x, t: 0, dur: 0.25 });
      if (e.hp <= 0) { e.dead = 0.01; S.kills++; }
    };
    const targets = (range, aoe, n) => {
      const c = alive().filter((e) => e.x >= S.px - 6 && e.x - S.px <= range).sort((a, b) => a.x - b.x);
      return aoe ? c : c.slice(0, n || 1);
    };
    const later = (dt, fn) => S.events.push({ at: S.t + dt, fn });

    S.punch = () => {
      const hand = S.ps.weapon !== 'tangan' ? 1 : S.hand; S.hand ^= 1;
      S.pa = { mode: 'punch', t0: S.t, dur: PUNCH_CD * 0.95, hand }; S.lock = PUNCH_CD * 0.95; S.atkCd = PUNCH_CD;
      later(0.17, () => targets(32, false, 1).forEach((e) => hurtEnemy(e, 1, {})));
    };
    const DUR = { punch2: 0.6, combo: 1, kick: 0.6, smash: 0.8, slash: 0.7, thrust: 0.6, spin: 0.9, roar: 0.8, guard: 0.6 };
    S.useSkill = (id) => {
      const s = ps.skills.find((q) => q.id === id);
      if (!s || S.lock > 0 || S.cd[id] > 0 || S.py > 0 || S.status !== 'run') return false;
      const D = DUR[s.anim] || 0.7;
      S.cd[id] = s.cd; S.lock = D; S.atkCd = D + 0.1; S.pa = { mode: 'skill', t0: S.t, dur: D, anim: s.anim, id }; S.skillsUsed++;
      const range = s.range || (s.aoe ? 62 : 36);
      const hit = (m) => { targets(range, !!s.aoe, s.pierce || 1).forEach((e) => hurtEnemy(e, m, s)); };
      if (s.buff) later(D * 0.4, () => { S.buffUntil = S.t + s.buff.sec; S.buffMul = s.buff.atk; S.vfx.push({ k: 'aura', x: S.px, t: 0, dur: 0.6 }); });
      if (s.guard) later(D * 0.3, () => { S.guardUntil = S.t + s.guard.sec; S.guardRed = s.guard.red; S.vfx.push({ k: 'guard', x: S.px, t: 0, dur: s.guard.sec }); });
      if (s.heal) later(D * 0.4, () => { S.hp = Math.min(S.maxhp, S.hp + S.maxhp * s.heal); S.fx.push({ x: S.px, y: 40, txt: '+' + Math.round(S.maxhp * s.heal), t: 0, heal: true }); });
      if (s.mult && (s.mult !== 1 || s.hits > 1 || !s.buff)) {
        if (s.anim === 'spin') for (let i = 0; i < s.hits; i++) later(D * (0.25 + 0.6 * (i / s.hits)), () => { hit(s.mult); S.vfx.push({ k: 'ring', x: S.px, t: 0, dur: 0.3 }); });
        else if (s.hits > 1) for (let i = 0; i < s.hits; i++) later(D * (0.2 + 0.65 * (i / s.hits)), () => hit(s.mult));
        else later(D * (s.anim === 'smash' ? 0.55 : s.anim === 'kick' ? 0.5 : 0.45), () => {
          if (s.lunge) S.px += s.lunge;
          hit(s.mult);
          if (s.anim === 'smash') S.vfx.push({ k: 'wave', x: S.px + 24, t: 0, dur: 0.4 });
          else if (s.anim === 'slash') S.vfx.push({ k: 'arc', x: S.px, t: 0, dur: 0.25 });
          else if (s.anim === 'kick') S.vfx.push({ k: 'arc', x: S.px, t: 0, dur: 0.25, low: true });
          else if (s.anim === 'thrust') S.vfx.push({ k: 'line', x: S.px, t: 0, dur: 0.2, len: Math.min(range, 130) });
        });
      }
      return true;
    };

    S.step = (dt, inp) => {
      if (S.status !== 'run') return;
      inp = inp || {};
      S.t += dt; S.atkCd = Math.max(0, S.atkCd - dt); S.lock = Math.max(0, S.lock - dt); S.hurt = Math.max(0, S.hurt - dt);
      for (const k in S.cd) S.cd[k] = Math.max(0, S.cd[k] - dt);
      if (inp.flee) { S.status = 'flee'; return; }
      if (S.pa && S.t - S.pa.t0 > S.pa.dur) S.pa = null;
      const due = S.events.filter((e) => e.at <= S.t); S.events = S.events.filter((e) => e.at > S.t); due.forEach((e) => e.fn());
      // jump
      if (S.py === 0 && S.vy === 0 && S.lock <= 0 && inp.jump) S.vy = 150;
      if (S.vy !== 0 || S.py > 0) { S.vy -= 560 * dt; S.py += S.vy * dt; if (S.py <= 0) { S.py = 0; S.vy = 0; } }
      if (inp.skill) S.useSkill(inp.skill);
      let near = null; for (const e of S.enemies) if (e.hp > 0 && e.x >= S.px - 4 && (!near || e.x < near.x)) near = e;
      // auto attack
      if (S.lock <= 0 && S.atkCd <= 0 && S.py === 0 && near && near.x - S.px <= 30) S.punch();
      // walk
      const blocked = (near && near.x - S.px < 26) || S.lock > 0;
      S.moving = !blocked && S.py === 0;
      if (!blocked) { S.px += ps.speed * dt; S.walkPh += dt * ps.speed * 0.2; }
      // enemies
      for (const e of S.enemies) {
        if (e.dead) { e.dead += dt; continue; }
        e.hit = Math.max(0, e.hit - dt); e.cd = Math.max(0, e.cd - dt);
        const k = KIND[e.kind], dist = e.x - S.px;
        if (e.stun > 0) { e.stun -= dt; e.st = 'chase'; if (e.x < S.px + 12) e.x = S.px + 12; continue; }
        if (e.st === 'idle' || e.st === 'chase') {
          if (dist < 170) {
            e.st = 'chase';
            if (dist > k.reach) e.x -= k.spd * dt;
            else if (e.cd <= 0) { e.st = 'wind'; e.t = k.wind; }
          }
        } else if (e.st === 'wind') {
          e.t -= dt;
          if (e.t <= 0) {
            const inReach = e.x - S.px <= k.reach + 6;
            if (inReach && S.py < 8) {
              let d = Math.max(1, Math.round(e.dmg - ps.def)); if (S.t < S.guardUntil) d = Math.max(1, Math.round(d * (1 - S.guardRed)));
              S.hp -= d; S.hurt = 0.25; S.fx.push({ x: S.px, y: 40, txt: '-' + d, t: 0, bad: true });
            } else if (inReach) S.dodged++;
            e.st = 'chase'; e.cd = k.cd;
          }
        }
        if (e.x < S.px + 12) e.x = S.px + 12;
      }
      S.fx.forEach((f) => (f.t += dt)); S.fx = S.fx.filter((f) => f.t < 0.8);
      S.vfx.forEach((f) => (f.t += dt)); S.vfx = S.vfx.filter((f) => f.t < f.dur);
      if (S.hp <= 0) { S.hp = 0; S.status = 'lose'; return; }
      if (S.enemies.every((e) => e.hp <= 0) && S.px >= S.endX) S.status = 'win';
    };
    S.winning = () => S.enemies.every((e) => e.hp <= 0);
    return S;
  }
  function reward(sim) { const z = sim.zone; return sim.status === 'win' ? z.scrap : Math.round(z.scrap * 0.1 * sim.kills); }

  /* headless bot for balance: auto punches; optionally fires skills as soon as they are ready and an enemy is near */
  function runBot(ps, zone, dodge, rnd, useSkills) {
    const sim = createSim(ps, zone, rnd); let n = 0; const dec = new Map();
    while (sim.status === 'run' && n++ < 40000) {
      let jump = false, skill = null;
      for (const e of sim.enemies) if (e.st === 'wind' && e.hp > 0) {
        if (!dec.has(e)) dec.set(e, (rnd || Math.random)() < dodge);
        if (dec.get(e) && e.t < 0.2 && sim.py === 0 && sim.lock <= 0) jump = true;
      }
      for (const e of sim.enemies) if (e.st !== 'wind') dec.delete(e);
      if (useSkills && !jump) { const near = sim.enemies.find((e) => e.hp > 0 && e.x - sim.px < 40); if (near) skill = ps.skills.filter((s) => sim.cd[s.id] <= 0).map((s) => s.id)[0] || null; }
      sim.step(1 / 60, { jump, skill });
    }
    return sim;
  }

  /* ---------------- poses (angles: 0 = pointing down, +90 = forward/right, 180 = up) ---------------- */
  const STANCE = { legF: [22, 8], legB: [-22, -30], armF: [30, 110], armB: [10, 100], lean: 5, bob: 0, dx: 0 };
  const mixP = (a, b, t) => { const o = {}; for (const k in b) { const x = a[k] !== undefined ? a[k] : b[k]; o[k] = Array.isArray(b[k]) ? b[k].map((v, i) => x[i] + (v - x[i]) * t) : x + (b[k] - x) * t; } return o; };
  const kf = (fr, u) => {
    u = Math.max(0, Math.min(1, u));
    for (let i = 1; i < fr.length; i++) if (u <= fr[i][0]) { const [u0, p0] = fr[i - 1], [u1, p1] = fr[i]; return mixP(Object.assign({}, STANCE, p0), Object.assign({}, STANCE, p1), (u - u0) / (u1 - u0 || 1)); }
    return Object.assign({}, STANCE, fr[fr.length - 1][1]);
  };
  const k1 = (fr, u) => { u = Math.max(0, Math.min(1, u)); for (let i = 1; i < fr.length; i++) if (u <= fr[i][0]) { const [u0, a] = fr[i - 1], [u1, b] = fr[i]; return a + (b - a) * ((u - u0) / (u1 - u0 || 1)); } return fr[fr.length - 1][1]; };
  const punchFrames = (hand) => { const a = hand ? 'armB' : 'armF'; return [[0, {}], [0.28, { [a]: [-25, 150], lean: 0, legF: [18, 5] }], [0.5, { [a]: [88, 90], lean: 14, legF: [30, 12], legB: [-18, -22], dx: 3 }], [1, {}]]; };
  const weaponPose = (w, lean, dx, legs) => Object.assign({}, STANCE, { armF: [w - 45, w - 8], armB: [w - 55, w - 12], lean, dx }, legs || {});
  function walkPose(ph) {
    const s = Math.sin(ph), c = Math.cos(ph);
    return { legF: [28 * s, 28 * s - 40 * Math.max(0, c)], legB: [-28 * s, -28 * s - 40 * Math.max(0, -c)], armF: [-30 * s, -30 * s + 28], armB: [30 * s, 30 * s + 28], lean: 5, bob: -Math.abs(s) * 1.5, dx: 0 };
  }
  function poseOf(sim) {
    if (sim.hurt > 0.12) return Object.assign({}, STANCE, { lean: -14, armF: [-20, 40], armB: [-10, 30] });
    if (sim.py > 0) return Object.assign({}, STANCE, { legF: [75, -25], legB: [25, -75], armF: [120, 150], armB: [100, 140], lean: 8 });
    const pa = sim.pa;
    if (pa) {
      const u = (sim.t - pa.t0) / pa.dur;
      if (pa.mode === 'punch') return kf(punchFrames(pa.hand), u);
      switch (pa.anim) {
        case 'punch2': return kf([[0, {}], [0.35, { armF: [-50, 160], lean: -8, legB: [-30, -40] }], [0.55, { armF: [90, 88], lean: 20, legF: [36, 18], dx: 3 }], [1, {}]], u);
        case 'combo': { const q = u * 4, i = Math.min(3, Math.floor(q)); return kf(punchFrames(i % 2), q - i); }
        case 'kick': return kf([[0, {}], [0.3, { legF: [-10, -40], legB: [-5, -8], lean: -10, armF: [60, 120], armB: [-40, 60] }], [0.5, { legF: [88, 86], legB: [-5, -8], lean: -12, armF: [50, 100], armB: [-50, 40] }], [0.75, { legF: [88, 86], legB: [-5, -8], lean: -12, armF: [50, 100], armB: [-50, 40] }], [1, {}]], u);
        case 'smash': return weaponPose(k1([[0, 150], [0.4, 215], [0.5, 215], [0.62, 50], [0.8, 50], [1, 150]], u), k1([[0, 5], [0.4, -10], [0.62, 22], [1, 5]], u), k1([[0, 0], [0.6, 3], [1, 0]], u));
        case 'slash': return weaponPose(k1([[0, 150], [0.3, 235], [0.55, 10], [0.75, 5], [1, 150]], u), k1([[0, 5], [0.3, -10], [0.55, 18], [1, 5]], u), 0);
        case 'thrust': return weaponPose(k1([[0, 150], [0.25, 105], [0.5, 88], [0.8, 92], [1, 150]], u), k1([[0, 5], [0.25, -4], [0.5, 18], [1, 5]], u), k1([[0, 0], [0.25, -2], [0.5, 9], [0.8, 9], [1, 0]], u), { legF: [30, 15], legB: [-35, -40] });
        case 'spin': return weaponPose(150 + 720 * u, 10, 0);
        case 'roar': return kf([[0, {}], [0.3, { armF: [150, 175], armB: [140, 170], lean: -10, legF: [28, 10], legB: [-28, -10] }], [0.8, { armF: [150, 175], armB: [140, 170], lean: -8, legF: [28, 10], legB: [-28, -10] }], [1, {}]], u);
        case 'guard': return kf([[0, {}], [0.25, { armF: [60, 165], armB: [40, 155], lean: 0, legF: [26, -6], legB: [-26, -30] }], [0.85, { armF: [60, 165], armB: [40, 155], lean: 0, legF: [26, -6], legB: [-26, -30] }], [1, {}]], u);
        default: break;
      }
    }
    if (sim.moving) return Object.assign({}, STANCE, walkPose(sim.walkPh));
    return Object.assign({}, STANCE, { bob: Math.sin(sim.t * 5) * 0.8, armF: [30 + Math.sin(sim.t * 5) * 3, 110], lean: 5 });
  }
  /* angle of the weapon held in the front hand for this frame */
  function weaponAngle(sim) {
    const pa = sim.pa;
    if (pa && pa.mode === 'skill') {
      const u = (sim.t - pa.t0) / pa.dur;
      switch (pa.anim) {
        case 'smash': return k1([[0, 150], [0.4, 215], [0.5, 215], [0.62, 50], [0.8, 50], [1, 150]], u);
        case 'slash': return k1([[0, 150], [0.3, 235], [0.55, 10], [0.75, 5], [1, 150]], u);
        case 'thrust': return k1([[0, 150], [0.25, 105], [0.5, 88], [0.8, 92], [1, 150]], u);
        case 'spin': return 150 + 720 * u;
        default: break;
      }
    }
    return 150;
  }

  /* ---------------- View ---------------- */
  const VW = 320, VH = 180, GY = 140;
  const cache = {};
  function spr(key, mk, pal, scale) {
    if (cache[key]) return cache[key];
    const B = mk(), sc = scale || 1, c = document.createElement('canvas'); c.width = Math.ceil(B.w * sc); c.height = Math.ceil(B.h * sc);
    const x = c.getContext('2d');
    if (!x) return c;
    for (let i = 0; i < B.p.length; i++) { const v = B.p[i]; if (v === null) continue; x.fillStyle = (pal && pal[v]) || v; const px = i % B.w, py = Math.floor(i / B.w); const x0 = Math.floor(px * sc), y0 = Math.floor(py * sc); x.fillRect(x0, y0, Math.floor((px + 1) * sc) - x0, Math.floor((py + 1) * sc) - y0); }
    return (cache[key] = c);
  }
  function skyline(ctx, scroll, base, col, seed, hmin, hmax) {
    ctx.fillStyle = col;
    let x = -((scroll % 400 + 400) % 400), i = seed;
    while (x < VW + 60) {
      const w = 26 + ((i * 37) % 30), h = hmin + ((i * 53) % (hmax - hmin));
      ctx.fillRect(x, base - h, w, h);
      if (i % 3 === 0) ctx.fillRect(x + 4, base - h - 6, 3, 6);
      if (i % 4 === 1) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + w - 8, base - h, 8, 10); ctx.fillStyle = col; }
      x += w + 2 + ((i * 11) % 6); i++;
    }
  }
  function drawSky(ctx, sky) { const g = ctx.createLinearGradient(0, 0, 0, GY); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); }

  function drawCamp(canvas, t, tod) {
    const ctx = canvas.getContext && canvas.getContext('2d'); if (!ctx) return;
    canvas.width = VW; canvas.height = 150;
    const sky = tod === 'dawn' ? ['#3b3a63', '#e0925a'] : tod === 'day' ? ['#4a5a78', '#b79a76'] : ['#0f1224', '#3a2740'];
    const GYc = 118;
    const g = ctx.createLinearGradient(0, 0, 0, GYc); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, 150);
    ctx.fillStyle = tod === 'night' ? '#e8e4c8' : 'rgba(255,230,160,.8)'; ctx.fillRect(250, 18, 10, 10); ctx.fillStyle = sky[0]; ctx.fillRect(254, 18, 8, 8);
    const sl = (base, col, seed, hmin, hmax) => { ctx.fillStyle = col; let x = 0, i = seed; while (x < VW) { const w = 24 + ((i * 37) % 28), h = hmin + ((i * 53) % (hmax - hmin)); ctx.fillRect(x, base - h, w, h); if (i % 3 === 0) ctx.fillRect(x + 4, base - h - 6, 3, 6); x += w + 3; i++; } };
    sl(GYc - 6, '#2a2a3c', 3, 30, 70); sl(GYc, '#1c1c2a', 8, 18, 46);
    ctx.fillStyle = '#3a3128'; ctx.fillRect(0, GYc, VW, 150 - GYc); ctx.fillStyle = '#4a3f33'; ctx.fillRect(0, GYc, VW, 2);
    ctx.fillStyle = '#5a4a3a'; for (let x = 4; x < VW; x += 14) ctx.fillRect(x, GYc - 14, 3, 16); ctx.fillRect(0, GYc - 10, VW, 2); ctx.fillRect(0, GYc - 4, VW, 2);
    ctx.fillStyle = '#6a7a52'; ctx.beginPath(); ctx.moveTo(30, GYc + 20); ctx.lineTo(70, GYc - 22); ctx.lineTo(110, GYc + 20); ctx.fill();
    ctx.fillStyle = '#4a5a38'; ctx.beginPath(); ctx.moveTo(62, GYc + 20); ctx.lineTo(70, GYc - 4); ctx.lineTo(78, GYc + 20); ctx.fill();
    ctx.fillStyle = '#150f0b'; ctx.fillRect(69, GYc - 24, 2, 4);
    ctx.fillStyle = '#7a3a2a'; ctx.fillRect(232, GYc + 4, 14, 18); ctx.fillStyle = '#5a2a1e'; ctx.fillRect(232, GYc + 9, 14, 2); ctx.fillRect(232, GYc + 16, 14, 2);
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(250, GYc + 10, 16, 12); ctx.fillStyle = '#5e3a18'; ctx.fillRect(250, GYc + 10, 16, 2); ctx.fillRect(257, GYc + 10, 2, 12);
    const fx = 190, fy = GYc + 22;
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(fx - 12, fy - 3, 24, 4); ctx.fillStyle = '#6a5038'; ctx.fillRect(fx - 9, fy - 6, 18, 3);
    const f = Math.floor(t * 7), col = ['#e0432b', '#ff8a2a', '#ffd23f'];
    for (let c = 0; c < 3; c++) { const hh = 16 - c * 5 + ((f + c) % 3), ww = 8 - c * 2; ctx.fillStyle = col[c]; ctx.fillRect(fx - ww / 2, fy - 6 - hh, ww, hh); ctx.fillRect(fx - ww / 2 + 1 + (f % 2), fy - 8 - hh - 2, Math.max(1, ww - 3), 3); }
    if (tod === 'night') { const gl = ctx.createRadialGradient(fx, fy - 10, 4, fx, fy - 10, 70); gl.addColorStop(0, 'rgba(255,150,50,.28)'); gl.addColorStop(1, 'rgba(255,150,50,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, VW, 150); }
  }

  /* one battle on a canvas. opts: {ps, zone, look:{height,weight,hair,shirt,stages}, pal, onEnd, onFrame} */
  function play(canvas, opts) {
    canvas.width = VW; canvas.height = VH;
    const ctx = canvas.getContext('2d');
    const sim = createSim(opts.ps, opts.zone);
    const wep = spr('w:' + opts.ps.weapon, () => AV.weapon(opts.ps.weapon === 'tangan' ? 'pipa' : opts.ps.weapon));
    const showWep = opts.ps.weapon !== 'tangan';
    const inp = { jump: false, flee: false, skill: null };
    const pcache = new Map();
    const sprite = (pose) => {
      const key = [pose.legF, pose.legB, pose.armF, pose.armB].map((a) => a.map((v) => Math.round(v / 3)).join(',')).join('|') + '|' + Math.round(pose.lean) + '|' + Math.round(pose.bob) + '|' + Math.round(pose.dx);
      let e = pcache.get(key);
      if (!e) {
        if (pcache.size > 500) pcache.clear();
        const B = AV.side(opts.look, pose), c = document.createElement('canvas'); AV.draw(c, B, { pal: opts.pal }); e = { c, hand: B.hand }; pcache.set(key, e);
      }
      return e;
    };
    let raf = 0, last = 0, ended = false, acc = 0;
    const ctl = { jump() { inp.jump = true; }, flee() { inp.flee = true; }, skill(id) { inp.skill = id; }, sim, stop() { cancelAnimationFrame(raf); ended = true; } };
    function render() {
      const cam = Math.max(0, sim.px - 70);
      drawSky(ctx, opts.zone.sky);
      skyline(ctx, cam * 0.2, GY - 8, 'rgba(20,20,35,.55)', 2, 30, 80);
      skyline(ctx, cam * 0.5, GY, '#1b1b2b', 7, 18, 50);
      ctx.fillStyle = '#3a3128'; ctx.fillRect(0, GY, VW, VH - GY); ctx.fillStyle = '#51463a'; ctx.fillRect(0, GY, VW, 2);
      ctx.fillStyle = '#2b241d'; for (let x = -((cam | 0) % 24); x < VW; x += 24) ctx.fillRect(x, GY + 10, 10, 2);
      const gx = sim.endX - cam; if (gx > -20 && gx < VW + 20) { ctx.fillStyle = '#c6f432'; ctx.fillRect(gx, GY - 34, 2, 34); ctx.fillRect(gx + 2, GY - 34, 12, 8); }
      // enemies
      for (const e of sim.enemies) {
        const frame = Math.floor(sim.t * (e.kind === 'anjing' ? 8 : 4)) % 2;
        const sc = e.kind === 'raksasa' ? 2.6 : e.kind === 'anjing' ? 1.4 : 1.5;
        const s = spr(`m:${e.kind}:${frame}`, () => AV.monster(e.kind, frame, e.kind === 'raksasa' ? '#7a9a6a' : undefined), null, sc);
        const ex = e.x - cam, h = s.height, w = s.width;
        if (e.dead) { ctx.globalAlpha = Math.max(0, 1 - e.dead * 2); if (ctx.globalAlpha <= 0) { ctx.globalAlpha = 1; continue; } }
        const wob = e.st === 'wind' ? -4 : e.stun > 0 ? Math.sin(sim.t * 40) * 1.5 : 0;
        ctx.drawImage(s, Math.round(ex - w / 2 + wob), Math.round(GY + 6 - h));
        if (e.hit > 0) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(ex - w / 2, GY + 6 - h, w, h); }
        ctx.globalAlpha = 1;
        if (!e.dead) {
          const bw = Math.max(16, w); ctx.fillStyle = '#150f0b'; ctx.fillRect(ex - bw / 2, GY + 6 - h - 6, bw, 4); ctx.fillStyle = '#e0432b'; ctx.fillRect(ex - bw / 2 + 1, GY + 6 - h - 5, (bw - 2) * (e.hp / e.maxhp), 2);
          if (e.stun > 0) { ctx.fillStyle = '#ffd23f'; ctx.fillText('★', ex - 3, GY + 6 - h - 9); }
        }
        if (e.st === 'wind') { ctx.fillStyle = '#ffd23f'; ctx.fillRect(ex - 1, GY + 6 - h - 16, 3, 7); ctx.fillRect(ex - 1, GY + 6 - h - 8, 3, 2); }
      }
      // player (side-view, animated)
      const pose = poseOf(sim), sp = sprite(pose), pxs = sim.px - cam, topY = GY + 7 - sp.c.height - sim.py;
      if (sim.t < sim.buffUntil) { ctx.fillStyle = 'rgba(255,140,40,.25)'; ctx.fillRect(pxs - 22, topY - 2, 44, sp.c.height + 4); }
      if (sim.hurt > 0 && Math.floor(sim.t * 20) % 2) ctx.globalAlpha = 0.4;
      ctx.drawImage(sp.c, Math.round(pxs - 28), Math.round(topY));
      ctx.globalAlpha = 1;
      if (showWep) {
        const wa = weaponAngle(sim);
        ctx.save(); ctx.translate(Math.round(pxs - 28 + sp.hand.x), Math.round(topY + sp.hand.y)); ctx.rotate(Math.PI - (wa * Math.PI) / 180);
        ctx.drawImage(wep, -8, -19); ctx.restore();
      }
      // skill effects
      sim.vfx.forEach((f) => {
        const u = f.t / f.dur, x = f.x - cam;
        ctx.save();
        if (f.k === 'hit') { ctx.fillStyle = '#fff'; const r = 3 + u * 7; ctx.fillRect(x - 1, GY - 22 - r, 2, r * 2); ctx.fillRect(x - r, GY - 23, r * 2, 2); }
        else if (f.k === 'wave') { ctx.strokeStyle = `rgba(255,220,120,${1 - u})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, GY + 4, 12 + u * 60, 4 + u * 5, 0, 0, Math.PI * 2); ctx.stroke(); }
        else if (f.k === 'arc') { ctx.strokeStyle = `rgba(255,255,255,${1 - u})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x + 8, GY - (f.low ? 12 : 28), 34, f.low ? -0.5 : -1.4, f.low ? 0.5 : 1.0); ctx.stroke(); }
        else if (f.k === 'line') { ctx.fillStyle = `rgba(255,255,255,${1 - u})`; ctx.fillRect(x + 20, GY - 24, f.len * Math.min(1, u * 3), 2); }
        else if (f.k === 'ring') { ctx.strokeStyle = `rgba(255,255,255,${1 - u})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, GY - 22, 16 + u * 28, 0, Math.PI * 2); ctx.stroke(); }
        else if (f.k === 'aura') { ctx.strokeStyle = `rgba(255,140,40,${1 - u})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pxs, GY - 22, 14 + u * 26, 0, Math.PI * 2); ctx.stroke(); }
        else if (f.k === 'guard') { ctx.strokeStyle = `rgba(110,190,255,${0.9 - u * 0.4})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pxs + 14, GY - 22, 26, -1.2, 1.2); ctx.stroke(); }
        ctx.restore();
      });
      ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
      sim.fx.forEach((f) => { ctx.fillStyle = f.bad ? '#ff6b6b' : f.heal ? '#6ed36e' : f.crit ? '#ffd23f' : '#fff'; ctx.fillText(f.txt, f.x - cam, GY - 36 - f.t * 24); });
      ctx.fillStyle = '#150f0b'; ctx.fillRect(6, 6, 104, 10); ctx.fillStyle = '#3a3a3a'; ctx.fillRect(7, 7, 102, 8);
      ctx.fillStyle = sim.hp / sim.maxhp > 0.35 ? '#6ed36e' : '#e0432b'; ctx.fillRect(7, 7, 102 * (sim.hp / sim.maxhp), 8);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(`${Math.ceil(sim.hp)}/${sim.maxhp}`, 10, 14);
      ctx.textAlign = 'right'; ctx.fillText(`${sim.zone.name}  ${sim.kills}/${sim.enemies.length}`, VW - 6, 14);
      if (sim.winning() && sim.status === 'run') { ctx.textAlign = 'center'; ctx.fillStyle = '#c6f432'; ctx.fillText('MAJU KE BENDERA ▶', VW / 2, 34); }
    }
    function frame(ts) {
      if (ended) return;
      const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts; acc += dt;
      while (acc >= 1 / 60) { sim.step(1 / 60, inp); inp.jump = false; inp.skill = null; acc -= 1 / 60; }
      render(); opts.onFrame && opts.onFrame(sim);
      if (sim.status !== 'run') { ended = true; opts.onEnd && opts.onEnd({ status: sim.status, scrap: reward(sim), kills: sim.kills, sim }); return; }
      raf = requestAnimationFrame(frame);
    }
    const kd = (e) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { ctl.jump(); e.preventDefault(); }
      const n = parseInt(e.key, 10); if (n >= 1 && n <= opts.ps.skills.length) ctl.skill(opts.ps.skills[n - 1].id);
    };
    document.addEventListener('keydown', kd);
    const origStop = ctl.stop; ctl.stop = () => { document.removeEventListener('keydown', kd); origStop(); };
    if (ctx) raf = requestAnimationFrame(frame);
    return ctl;
  }

  const api = { ZONES, WEAPONS, ARMORS, SKILLS, GROUP_NAME, weaponOf, armorOf, unlockedSkills, playerStats, createSim, runBot, reward, play, drawCamp, poseOf, VW, VH };
  root.FitGame = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
