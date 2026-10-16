/* FitQuest — XP, level, streak, workout runner, camera form-check (MediaPipe Pose, on-device) */
(() => {
  'use strict';
  const D = window.FIT_DATA, DET = window.FitDetectors, FX = window.FitExAnim, FM = window.FitMotion, MU = window.FitMusic || { play() {}, duck() {}, setEnabled() {}, setVolume() {}, unlock() {} };
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const AV = window.FitAvatar;

  const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

  const MUSCLE = { quads: 'Paha depan', hamstrings: 'Paha belakang', glutes: 'Bokong', calves: 'Betis', abs: 'Perut', obliques: 'Samping perut', lower_back: 'Punggung bawah', upper_back: 'Punggung atas', chest: 'Dada', shoulders: 'Bahu', biceps: 'Biseps', triceps: 'Triseps', forearms: 'Lengan bawah' };
  const EMOJI = { march_jack: '🤸', squat: '🦵', pushup: '💪', back_extension: '🐍', plank: '🧱', lunge: '🚶', biceps_iso: '💪', mountain_climber: '🧗', side_plank_calf: '🦶', stretch: '🧘' };
  const TITLES = ['Rebahan Pemula', 'Mulai Gerak', 'Rajin Pagi', 'Atlet Komplek', 'Pendekar Otot', 'Jagoan Kampung', 'Legenda Pagi'];
  const SKELETON = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];

  /* ---------------- state ---------------- */
  const KEY = 'fitquest:v2';
  const defaults = () => ({ name: '', scrap: 0, gear: { weapon: 'tangan', armor: 'none', owned: ['tangan', 'none'] }, cleared: {}, body: null, totalXp: 0, muscleXp: {}, streak: 0, best: 0, lastDay: null, sessions: 0, history: [], settings: { camera: true, voice: true, rest: 0, music: true, vol: 0.7 } });
  let S = load();
  const MOODTRACK = { ringan: 'lemes', normal: 'siap', berat: 'api' };
  const applyMusic = () => { MU.setEnabled(S.settings.music !== false); MU.setVolume(S.settings.vol == null ? 0.7 : S.settings.vol); };
  function load() {
    try {
      const r = JSON.parse(localStorage.getItem(KEY));
      if (!r) return defaults();
      const d = defaults();
      return Object.assign(d, r, { settings: Object.assign(d.settings, r.settings || {}) });
    } catch { return defaults(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ignore */ } }

  const ymd = (d = new Date()) => d.toLocaleDateString('sv-SE');
  const yesterday = () => ymd(new Date(Date.now() - 864e5));

  /* ---------------- levels ---------------- */
  const MAXL = 50;
  const need = (L) => 250 + 60 * (L - 1);
  function levelInfo(xp) { let L = 1, rem = xp; while (L < MAXL && rem >= need(L)) { rem -= need(L); L++; } return { L, cur: Math.round(rem), need: need(L) }; }
  const mneed = (L) => 150 + 50 * (L - 1);
  function mLevel(xp) { let L = 1, rem = xp; while (rem >= mneed(L)) { rem -= mneed(L); L++; } return { L, cur: rem, need: mneed(L) }; }
  /* group levels (avatar muscle groups) */
  const GKEYS = Object.keys(AV.GROUPS);
  const gneed = (L) => Math.round(40 + 7.6 * (L - 1));
  function gInfo(key) {
    const ms = AV.GROUPS[key].muscles;
    const xp = ms.reduce((a, m) => a + (S.muscleXp[m] || 0), 0) / ms.length;
    let L = 1, rem = xp;
    while (L < MAXL && rem >= gneed(L)) { rem -= gneed(L); L++; }
    return { L, pct: L >= MAXL ? 1 : rem / gneed(L) };
  }
  const groupLevels = () => Object.fromEntries(GKEYS.map((k) => [k, gInfo(k).L]));
  const lookOf = (b) => Object.assign({ gender: 'm', hair: 'pendek', hairColor: AV.HAIR_COLORS[0], shirt: 'kaos', shirtColor: AV.SHIRT_COLORS[3] }, b || S.body || {});
  const palOf = (body) => { const l = lookOf(body); return AV.palette((body || S.body).skin, l.hairColor, l.shirtColor); };
  const avatarBuf = (lv, body) => { body = body || S.body; const l = lookOf(body); return AV.build({ height: body.h, weight: body.w, skin: body.skin, gender: l.gender, hair: l.hair, shirt: l.shirt, stages: Object.fromEntries(GKEYS.map((k) => [k, AV.stageOf(lv[k])])) }); };
  const titleOf = (L) => TITLES[Math.min(TITLES.length - 1, Math.floor((L - 1) / 3))];
  const fmt = (n) => Math.round(n).toLocaleString('id-ID');
  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* ---------------- timeline ---------------- */
  function mkStep(st) {
    const ex = D.exercises[st.exercise], lv = ex.levels[st.level];
    return { type: 'work', exercise: st.exercise, level: st.level, sec: st.sec, met: lv.met, exName: ex.name, lvName: lv.name, primary: ex.primary, secondary: ex.secondary, cam: DET.has(st.exercise, st.level) };
  }
  const restFor = (key) => { const b = (S.settings.restBy || {})[key]; return b != null ? b : D.routines[key].rest_sec; };
  function buildTimeline(rt, restSec) {
    const work = [];
    (rt.warmup || []).forEach((s) => work.push(mkStep(s)));
    for (let r = 0; r < (rt.rounds || 1); r++) rt.steps.forEach((s) => work.push(mkStep(s)));
    (rt.cooldown || []).forEach((s) => work.push(mkStep(s)));
    const out = [];
    work.forEach((w, i) => { out.push(w); const rs = restSec != null ? restSec : rt.rest_sec; if (i < work.length - 1 && rs > 0) out.push({ type: 'rest', sec: rs, next: work[i + 1] }); });
    return out;
  }
  const baseXp = (met, sec) => Math.round((met * sec) / 6);
  function routineStats(rt) {
    const tl = buildTimeline(rt);
    const work = tl.filter((t) => t.type === 'work');
    return { sec: tl.reduce((a, t) => a + t.sec, 0), xp: work.reduce((a, t) => a + baseXp(t.met, t.sec), 0), cam: work.filter((t) => t.cam).length, steps: work.length };
  }

  /* ---------------- audio / voice / wake lock ---------------- */
  let actx = null;
  function beep(freq = 880, dur = 0.12) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(0.15, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
      o.start(); o.stop(actx.currentTime + dur);
    } catch { /* ignore */ }
  }
  function say(t) {
    if (!S.settings.voice || !('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'id-ID'; u.rate = 1.05; speechSynthesis.speak(u); } catch { /* ignore */ }
  }
  let wake = null;
  async function lockScreen() { try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch { /* ignore */ } }
  function unlockScreen() { try { wake && wake.release(); } catch { /* ignore */ } wake = null; }

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
  }
  function overlay(msg) { let o = $('#ov'); if (!o) { o = document.createElement('div'); o.id = 'ov'; o.className = 'overlay'; document.body.appendChild(o); } o.innerHTML = `<div class="spin"></div><p>${msg}</p>`; }
  function overlayOff() { const o = $('#ov'); if (o) o.remove(); }

  /* ---------------- camera + pose ---------------- */
  const cam = { stream: null, landmarker: null, loading: null, raf: 0, lastT: 0, lastVideoTime: -1 };
  /* offline-first pose engine: MediaPipe BlazePose (lite) bundled in ./mediapipe, wrapped to look like the Tasks API */
  function loadScript(src) { return new Promise((res, rej) => { if (window.Pose) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('script ' + src)); document.head.appendChild(s); }); }
  async function loadLocalPose() {
    await loadScript('mediapipe/pose.js');
    const pose = new window.Pose({ locateFile: (f) => 'mediapipe/' + f });
    pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    let last = null, busy = false;
    pose.onResults((r) => { last = r; });
    await pose.initialize();
    return {
      local: true,
      detectForVideo(v) {
        if (!busy) { busy = true; pose.send({ image: v }).then(() => { busy = false; }, () => { busy = false; }); }
        return last && last.poseLandmarks ? { landmarks: [last.poseLandmarks], worldLandmarks: [last.poseWorldLandmarks || last.poseLandmarks] } : { landmarks: [], worldLandmarks: [] };
      },
    };
  }
  async function loadLandmarker() {
    if (cam.landmarker) return true;
    if (!cam.loading) {
      cam.loading = (async () => {
        try { cam.landmarker = await loadLocalPose(); return true; } catch (e) { console.warn('local pose failed, trying CDN', e); }
        const mod = await import(VISION + '/vision_bundle.mjs');
        const fs = await mod.FilesetResolver.forVisionTasks(VISION + '/wasm');
        for (const delegate of ['GPU', 'CPU']) {
          try {
            cam.landmarker = await mod.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numPoses: 1 });
            return true;
          } catch (e) { console.warn('landmarker', delegate, e); }
        }
        throw new Error('landmarker failed');
      })().catch((e) => { cam.loading = null; throw e; });
    }
    return cam.loading;
  }
  async function startCamera(video) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return { ok: false, reason: 'Browser ini tidak mengizinkan kamera di halaman ini. Butuh HTTPS, dan halaman harus dibuka langsung di Chrome/Safari — bukan di dalam preview atau aplikasi lain.' };
    try {
      cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      video.srcObject = cam.stream; await video.play();
    } catch (e) {
      console.warn('camera', e); stopCamera(); const n = e && e.name;
      return { ok: false, reason: n === 'NotAllowedError' || n === 'SecurityError' ? 'Izin kamera ditolak atau diblokir. Buka halaman ini langsung di Chrome/Safari (bukan di dalam preview), lalu izinkan kamera.' : n === 'NotFoundError' ? 'Kamera tidak ditemukan di perangkat ini.' : n === 'NotReadableError' ? 'Kamera sedang dipakai aplikasi lain.' : 'Kamera gagal dibuka (' + (n || 'error') + ').' };
    }
    try { await loadLandmarker(); } catch (e) { console.warn(e); stopCamera(); return { ok: false, reason: 'Mesin AI kamera gagal dimuat. Muat ulang halaman, lalu coba lagi.' }; }
    return { ok: true };
  }
  function stopCamera() {
    cancelAnimationFrame(cam.raf); cam.raf = 0;
    if (cam.stream) cam.stream.getTracks().forEach((t) => t.stop());
    cam.stream = null;
  }
  function camLoop() {
    cam.raf = requestAnimationFrame(camLoop);
    const v = $('#v'), cv = $('#cv');
    if (!R || !v || !cam.landmarker || v.readyState < 2 || v.currentTime === cam.lastVideoTime) return;
    const now = performance.now();
    if (now - cam.lastT < 45) return; // ~20 fps
    cam.lastT = now; cam.lastVideoTime = v.currentTime;
    let res;
    try { res = cam.landmarker.detectForVideo(v, now); } catch (e) { return; }
    const img = res.landmarks && res.landmarks[0], world = res.worldLandmarks && res.worldLandmarks[0];
    const w = v.videoWidth, h = v.videoHeight;
    if (cv.width !== w) { cv.width = w; cv.height = h; $('#camBox').style.setProperty('--ar', `${w}/${h}`); $('#camBox').style.setProperty('--arn', (w / h).toFixed(3)); }
    const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, h);
    let out = null;
    const it = R.tl[R.i];
    if (img && world && it && it.type === 'work' && R.det && !R.paused) out = R.det.update({ img, world, w, h }, R.elapsed);
    R.seen = !!img; setCamStat();
    if (img) drawSkeleton(ctx, img, w, h, out ? out.ok : true);
    if (out) updateHud(out);
    else if (!img && it && it.type === 'work' && R.det) updateHud({ ok: false, msg: 'Aku belum lihat badanmu — masuk frame ya', reps: R.det.kind === 'reps' ? 0 : null });
  }
  function drawSkeleton(ctx, lm, w, h, ok) {
    ctx.lineWidth = Math.max(3, w / 120); ctx.strokeStyle = ok ? '#c6f432' : '#ff6b6b'; ctx.fillStyle = '#fff'; ctx.lineCap = 'round';
    SKELETON.forEach(([a, b]) => {
      const p = lm[a], q = lm[b]; if (!p || !q || p.visibility < 0.5 || q.visibility < 0.5) return;
      ctx.beginPath(); ctx.moveTo(p.x * w, p.y * h); ctx.lineTo(q.x * w, q.y * h); ctx.stroke();
    });
    [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach((i) => {
      const p = lm[i]; if (!p || p.visibility < 0.5) return;
      ctx.beginPath(); ctx.arc(p.x * w, p.y * h, Math.max(3, w / 110), 0, 7); ctx.fill();
    });
  }
  function updateHud(o) {
    const reps = $('#hudReps'), form = $('#hudForm'), msg = $('#camMsg'); if (!reps) return;
    reps.textContent = o.reps == null ? (o.scored ? '' : '') : `${o.reps} rep`;
    if (o.live != null) { form.textContent = `Form ${o.live}`; form.style.setProperty('--c', o.live >= 80 ? 'var(--good)' : o.live >= 55 ? 'var(--acc2)' : 'var(--bad)'); } else form.textContent = '';
    msg.textContent = o.msg || ''; msg.classList.toggle('bad', !o.ok);
  }

  /* in-app confirm (native confirm() is blocked in some embedded browsers, which made buttons look dead) */
  function askConfirm(msg, okLabel, onOk, onCancel) {
    const old = $('#cfm'); if (old) old.remove();
    const o = document.createElement('div'); o.id = 'cfm'; o.className = 'overlay res';
    o.innerHTML = `<div class="rescard"><p>${msg}</p><button class="btn big" id="cfmok">${okLabel || 'Ya'}</button><button class="btn ghost" id="cfmno">Batal</button></div>`;
    document.body.appendChild(o);
    $('#cfmok').onclick = () => { o.remove(); onOk && onOk(); };
    $('#cfmno').onclick = () => { o.remove(); onCancel && onCancel(); };
  }

  /* ---------------- runner ---------------- */
  let R = null, tickId = 0, lastTs = 0, exRaf = 0, exLast = 0;
  const camChipHtml = () => {
    if (!R) return '';
    const it = R.tl[R.i], judged = it && it.type === 'work' && it.cam;
    switch (R.camState) {
      case 'loading': return '<span class="cs warn">📷 Menyiapkan kamera AI…</span><small>Pertama kali bisa 10–20 detik</small>';
      case 'on': return `<span class="cs on"><i class="dot"></i>KAMERA AI AKTIF</span><small>${R.seen ? 'Aku melihat badanmu ✓' : 'Belum melihat badanmu — masuk frame ya'}${it && it.type === 'work' && !judged ? ' · gerakan ini tidak dinilai' : ''}</small>`;
      case 'fail': return `<span class="cs bad">📷 KAMERA AI GAGAL</span><small>${R.camReason}</small><button class="btn mini" id="camRetry">Coba lagi</button>`;
      default: return `<span class="cs off">📷 Kamera AI mati</span><small>${S.settings.camera ? (R.key === 'ringan' || R.key === 'berat' ? `Kamera AI baru menilai menu SIAP. Menu ${R.key === 'ringan' ? 'Lemes' : 'Membara'} pakai demo avatar, jadi kamera tidak dinyalakan.` : 'Menu ini tidak punya gerakan yang dinilai kamera') : 'Dimatikan di pengaturan — tidak dapat bonus kamera'}</small>`;
    }
  };
  function setCamStat() {
    const el = $('#camStat'); if (!el || !R) return;
    const h = camChipHtml(); if (el.dataset.k === h) return; el.dataset.k = h; el.innerHTML = h;
    el.className = 'camstat ' + R.camState;
    const rb = $('#camRetry'); if (rb) rb.onclick = retryCamera;
  }
  async function retryCamera() {
    if (!R) return; R.camState = 'loading'; setCamStat();
    const r = await startCamera($('#v')); if (!R) return;
    R.camOn = r.ok; R.camState = r.ok ? 'on' : 'fail'; R.camReason = r.reason || '';
    if (R.camOn) camLoop();
    setCamStat(); applyCamLayout(); const it = R.tl[R.i]; if (it && it.type === 'work' && R.camOn && it.cam && !R.det) { R.det = DET.create(it.exercise, it.level); R.det.reset(); }
  }
  /* camera preview when AI is on, otherwise the avatar demonstrates the movement */
  function applyCamLayout() {
    if (!R) return;
    $('#camBox').style.display = R.camOn ? '' : 'none'; const rn = app.querySelector('.run'); if (rn) rn.classList.toggle('camon', !!R.camOn);
    $('#exStage').style.display = R.camOn ? 'none' : '';
    if (!exRaf) exLoop();
    if (R.camOn) { if (!R.fsInit) { R.fsInit = true; const b = $('#camBox'), f = $('#camFs'); if (b && f) { b.classList.add('full'); f.textContent = '✕'; } } }
  }
  const exCache = new Map();
  function exLoop(ts) {
    exRaf = requestAnimationFrame(exLoop);
    if (!R) { cancelAnimationFrame(exRaf); exRaf = 0; return; }
    const cv = R.camOn ? $('#exov') : $('#exv'); if (!cv) return;
    ts = ts || performance.now(); const dt = Math.min(0.1, (ts - (exLast || ts)) / 1000); exLast = ts;
    if (!R.paused) R.animT = (R.animT || 0) + dt;
    if (ts - (R.exDraw || 0) < 33) return; R.exDraw = ts;
    const it = R.tl[R.i], work = it && it.type === 'work';
    const tgt = work ? it : it && it.next && it.next.type === 'work' ? it.next : null; // on rest / get-ready show the NEXT move
    const look = lookNow(), d = AV.dims(look);
    const pose = FX.pose(tgt ? tgt.exercise : null, tgt ? tgt.level : null, R.animT * (work ? 1 : 0.9), d);
    const key = JSON.stringify(pose, (k, v) => (typeof v === 'number' ? Math.round(v) : v));
    let B = exCache.get(key); if (!B) { if (exCache.size > 400) exCache.clear(); B = AV.side(look, pose); exCache.set(key, B); }
    AV.draw(cv, B, { pal: palOf() });
    const hint = $('#exHint'); if (hint) hint.textContent = work ? 'Ikuti gerakan avatar' : tgt ? 'Berikutnya: ' + tgt.exName : 'Siap-siap';
  }

  async function startWorkout(key) {
    const rt = D.routines[key];
    const tl = buildTimeline(rt, restFor(key));
    MU.play(MOODTRACK[key] || 'siap');
    R = { key, rt, tl: [{ type: 'ready', sec: 5, next: tl[0] }, ...tl], i: -1, elapsed: 0, paused: false, results: [], camOn: false, det: null, before: { xp: S.totalXp, L: levelInfo(S.totalXp).L, m: Object.fromEntries(D.muscles.map((m) => [m, mLevel(S.muscleXp[m] || 0).L])), g: groupLevels() } };
    buildRunnerDom();
    beep(660, 0.05);
    R.camState = !S.settings.camera ? 'off' : tl.some((t) => t.cam) ? 'loading' : 'off'; R.camReason = ''; setCamStat();
    if (R.camState === 'loading') {
      const r = await startCamera($('#v'));
      R.camOn = r.ok; R.camState = r.ok ? 'on' : 'fail'; R.camReason = r.reason || '';
      if (R.camOn) camLoop();
    }
    setCamStat(); applyCamLayout();
    lockScreen();
    lastTs = Date.now(); clearInterval(tickId); tickId = setInterval(() => tick(), 100);
    go(0);
  }

  function buildRunnerDom() {
    app.innerHTML = `
    <div class="run">
      <div class="topbar"><button class="ibtn" id="stop" aria-label="Selesai">✕</button><div class="prog" id="prog"></div><button class="ibtn" id="pause" aria-label="Jeda">⏸</button></div>
      <div class="camstat" id="camStat"></div>
      <div class="phase" id="phase"></div>
      <div class="timer" id="timer"></div>
      <h2 id="exname"></h2><div class="sub" id="exlevel"></div>
      <div class="chips" id="chips"></div>
      <div class="cam" id="camBox" style="--ar:3/4"><div class="mirror"><video id="v" playsinline muted></video><canvas id="cv"></canvas></div>
        <div class="hud"><span id="hudReps"></span><span id="hudTime"></span><span id="hudName"></span><span id="hudForm" class="form"></span></div><canvas id="exov" class="pix exov"></canvas><button class="fsbtn" id="camFs" aria-label="Layar penuh">⛶</button><div class="camMsg" id="camMsg"></div></div>
      <div class="exstage" id="exStage"><canvas id="exv" class="pix exv"></canvas><div class="exhint" id="exHint">Ikuti gerakan avatar</div></div>
      <div class="next" id="next"></div>
      <div class="ctrl"><button class="btn ghost" id="skip">Lewati ⏭</button></div>
    </div>`;
    $('#camFs').onclick = () => { const b = $('#camBox'); const on = b.classList.toggle('full'); $('#camFs').textContent = on ? '✕' : '⛶'; };
    const work = R.tl.filter((t) => t.type === 'work');
    $('#prog').innerHTML = work.map((_, i) => `<i data-i="${i}"></i>`).join('');
    $('#stop').onclick = () => {
      const was = R.paused; R.paused = true;
      askConfirm('Selesai lebih awal? XP dari gerakan yang sudah kamu kerjakan tetap dihitung.', 'Selesai', () => { const it = R.tl[R.i]; if (it && it.type === 'work') record(it); finish(true); }, () => { R.paused = was; lastTs = Date.now(); });
    };
    $('#pause').onclick = togglePause;
    $('#skip').onclick = () => completeItem(true);
  }
  function togglePause() { if (!R) return; R.paused = !R.paused; $('#pause').textContent = R.paused ? '▶' : '⏸'; $('#phase').textContent = R.paused ? 'JEDA' : phaseLabel(R.tl[R.i]); lastTs = Date.now(); }
  const phaseLabel = (it) => (it.type === 'work' ? 'GERAK!' : it.type === 'rest' ? 'ISTIRAHAT' : 'SIAP-SIAP');

  function go(i) {
    R.i = i; R.elapsed = 0; R.lastCount = null;
    const it = R.tl[i];
    if (!it) return finish(false);
    R.det = null; MU.duck(it.type === 'rest');
    if (it.type === 'work') {
      if (R.camOn && it.cam) { R.det = DET.create(it.exercise, it.level); R.det.reset(); }
      const idx = R.tl.slice(0, i + 1).filter((t) => t.type === 'work').length - 1;
      document.querySelectorAll('#prog i').forEach((e, k) => e.className = k < idx ? 'done' : k === idx ? 'now' : '');
      say(`${it.exName}. ${it.lvName}`); beep(1000, 0.2);
    } else if (it.type === 'rest') { say(`Istirahat. Berikutnya ${it.next.exName}`); beep(500, 0.15); }
    else say(`Siap-siap. Mulai dengan ${it.next.exName}`);
    renderItem(it);
  }
  function renderItem(it) {
    $('#phase').textContent = phaseLabel(it); { const hn = $('#hudName'); if (hn) hn.textContent = it.type === 'work' ? `${phaseLabel(it)} · ${it.exName}` : it.type === 'rest' ? `ISTIRAHAT · berikutnya ${it.next.exName}` : `SIAP-SIAP · ${(it.next || {}).exName || ''}`; }
    $('#phase').className = 'phase ' + it.type;
    const w = it.type === 'work' ? it : it.next;
    $('#exname').textContent = (EMOJI[w.exercise] || '') + ' ' + (it.type === 'work' ? w.exName : 'Berikutnya: ' + w.exName);
    $('#exlevel').textContent = w.lvName;
    $('#chips').innerHTML = w.primary.map((m) => `<span class="chip p">${MUSCLE[m]}</span>`).join('') + w.secondary.map((m) => `<span class="chip">${MUSCLE[m]}</span>`).join('');
    const view = DET.view(w.exercise, w.level);
    $('#next').textContent = it.type === 'work' ? (w.cam && R.camOn ? '📷 Kamera menilai gerakan ini' : R.camOn ? 'Kamera tidak menilai gerakan ini' : '') : (view && R.camOn ? '📷 ' + view : '');
    const hud = $('#camMsg');
    if (R.camOn) { hud.textContent = it.type === 'work' && !w.cam ? 'Gerakan ini tidak dinilai kamera' : it.type === 'work' ? 'Mulai gerak!' : (view || ''); hud.classList.remove('bad'); $('#hudReps').textContent = ''; $('#hudForm').textContent = ''; }
    updateTimer();
  }
  function updateTimer() { const it = R.tl[R.i]; if (!it) return; const t = mmss(it.sec - R.elapsed); $('#timer').textContent = t; const ht = $('#hudTime'); if (ht) ht.textContent = t; }

  function tick(dtOverride) {
    if (!R) return;
    const now = Date.now();
    const dt = dtOverride != null ? dtOverride : Math.min(0.5, (now - lastTs) / 1000);
    lastTs = now;
    if (R.paused) return;
    R.elapsed += dt;
    const it = R.tl[R.i];
    if (!it) return;
    if (R.elapsed >= it.sec) { completeItem(false); return; }
    const left = Math.ceil(it.sec - R.elapsed);
    if (left !== R.lastCount) { R.lastCount = left; if (left <= 3) beep(700, 0.08); }
    updateTimer();
  }
  function completeItem(skipped) {
    const it = R.tl[R.i];
    if (it && it.type === 'work') record(it);
    go(R.i + 1);
  }
  function record(it) {
    const sec = Math.min(R.elapsed, it.sec);
    if (sec < 3) return;
    const base = baseXp(it.met, sec);
    let score = null, bonus = 0, reps = null, tried = !!R.det;
    if (R.det) {
      const r = R.det.result();
      if (r.eligible && sec >= it.sec * 0.5) { score = r.score; bonus = Math.round(base * 0.5 * r.score / 100); reps = r.reps; }
    }
    R.results.push({ exercise: it.exercise, exName: it.exName, lvName: it.lvName, sec: Math.round(sec), base, bonus, score, reps, tried, primary: it.primary, secondary: it.secondary });
  }

  function finish(early) {
    clearInterval(tickId); stopCamera(); unlockScreen(); cancelAnimationFrame(exRaf); exRaf = 0;
    try { speechSynthesis.cancel(); } catch { /* ignore */ }
    const run = R; R = null;
    if (!run || !run.results.length) { home(); return; }
    const today = ymd();
    const firstToday = S.lastDay !== today;
    if (firstToday) { S.streak = S.lastDay === yesterday() ? S.streak + 1 : 1; S.best = Math.max(S.best, S.streak); S.lastDay = today; }
    const base = run.results.reduce((a, r) => a + r.base, 0);
    const camB = run.results.reduce((a, r) => a + r.bonus, 0);
    const streakB = Math.round(base * Math.min(0.25, 0.05 * (S.streak - 1)));
    const dailyB = firstToday ? 50 : 0;
    const total = base + camB + streakB + dailyB;
    const scrap = Math.round(total / 3);
    S.totalXp += total; S.sessions++; S.scrap = (S.scrap || 0) + scrap;
    run.results.forEach((r) => {
      const x = r.base + r.bonus;
      r.primary.forEach((m) => { S.muscleXp[m] = (S.muscleXp[m] || 0) + x; });
      r.secondary.forEach((m) => { S.muscleXp[m] = (S.muscleXp[m] || 0) + x * 0.4; });
    });
    S.history.push({ d: today, r: run.key, xp: total, cam: camB });
    S.history = S.history.slice(-60);
    save();
    summary(run, { base, camB, streakB, dailyB, total, early, scrap });
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden && R && !R.paused) togglePause(); });

  /* ---------------- screens ---------------- */
  const CHOICES = [
    { key: 'ringan', mood: 'lemes', name: 'Lemes', cap: 'Badan berat banget', tease: 'Lemes? Justru itu alasannya. Bangunin badanmu, pelan tapi PASTI.', push: 'Capek itu cuma alasan. Gerak.' },
    { key: 'normal', mood: 'siap', name: 'Siap', cap: 'Siap jalanin hari', tease: 'Siap itu bagus. Sekarang buktikan, jangan cuma bilang.', push: 'Siap doang nggak cukup. Buktikan.' },
    { key: 'berat', mood: 'api', name: 'Membara', cap: 'Berapi-api!', tease: 'Hajar sampai habis. Jangan bilang aku nggak ngingetin.', push: 'Bakar semuanya. Nggak ada ampun.' },
  ];
  const G = window.FitGame;
  const skyClass = () => { const h = new Date().getHours(); return h >= 5 && h < 10 ? 'dawn' : h < 17 ? 'day' : 'night'; };
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const NS = 'http://www.w3.org/2000/svg';
  const curL = () => levelInfo(S.totalXp).L;
  const nameOf = () => (S.name || 'Pahlawan').replace(/[<>&"]/g, '');
  const drawPerson = (cv, mood) => AV.draw(cv, AV.person(mood, lookOf()), { pal: palOf() });
  let campTimer = 0;
  const stopCamp = () => { clearInterval(campTimer); campTimer = 0; };
  const bumpGear = () => { S.gear = Object.assign({ weapon: 'tangan', armor: 'none', owned: ['tangan', 'none'] }, S.gear || {}); };

  /* labels hanging off the sides of the avatar, each with a line to its muscle area */
  function pointers(box, B, stagger) {
    const cv = $('canvas.av', box); if (!cv) return;
    const cr = cv.getBoundingClientRect(), br = box.getBoundingClientRect();
    if (!cr.width) return;
    box.querySelectorAll('.tag,svg.pl').forEach((e) => e.remove());
    const sx = cr.width / B.w, sy = cr.height / B.h, ox = cr.left - br.left, oy = cr.top - br.top, TW = 74, TH = 44;
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'pl'); svg.setAttribute('width', br.width); svg.setAttribute('height', br.height);
    box.appendChild(svg);
    let n = 0;
    ['l', 'r'].forEach((side) => {
      const arr = Object.entries(B.anchors).filter(([, a]) => a.side === side).map(([k, a]) => ({ k, ax: ox + (a.x + 0.5) * sx, ay: oy + (a.y + 0.5) * sy })).sort((p, q) => p.ay - q.ay);
      let prev = -99; arr.forEach((it) => { it.ty = Math.max(it.ay, prev + TH + 4, TH / 2); prev = it.ty; });
      for (let i = arr.length - 1, lim = br.height - TH / 2; i >= 0; i--) { arr[i].ty = Math.min(arr[i].ty, lim); lim = arr[i].ty - TH - 4; }
      arr.forEach((it) => {
        const g = gInfo(it.k), d = (stagger ? n * 0.28 : 0) + 's';
        const b = document.createElement('button'); b.className = 'tag ' + side + (stagger ? ' pop' : ''); b.dataset.g = it.k; b.style.top = (it.ty - TH / 2) + 'px'; b.style.animationDelay = d;
        b.innerHTML = `<span>${AV.GROUPS[it.k].name}</span><b>Lv ${g.L}</b><em class="tb"><i style="width:${Math.round(g.pct * 100)}%"></i></em>`;
        box.appendChild(b);
        const ex = side === 'l' ? TW : br.width - TW;
        const ln = document.createElementNS(NS, 'path'); ln.setAttribute('d', `M${ex} ${it.ty} L${(ex + it.ax) / 2} ${it.ty} L${it.ax} ${it.ay}`); ln.setAttribute('class', 'pln' + (stagger ? ' draw' : '')); ln.style.animationDelay = d; svg.appendChild(ln);
        const dot = document.createElementNS(NS, 'rect'); dot.setAttribute('x', it.ax - 3); dot.setAttribute('y', it.ay - 3); dot.setAttribute('width', 6); dot.setAttribute('height', 6); dot.setAttribute('class', 'pdot' + (stagger ? ' draw' : '')); dot.style.animationDelay = d; svg.appendChild(dot);
        b.onclick = () => {
          const gg = gInfo(it.k), nxt = AV.nextStageLevel(gg.L);
          toast(`${AV.GROUPS[it.k].full} Lv ${gg.L} — ${Math.round(gg.pct * 100)}% ke Lv ${gg.L + 1}.` + (nxt ? ` Bentuk berikutnya di Lv ${nxt}.` : ' Sudah bentuk maksimal!'));
        };
        n++;
      });
    });
  }
  const watchPointers = (box, B) => { const f = () => { if (document.body.contains(box)) pointers(box, B, false); }; window.addEventListener('resize', f); };

  /* ---- onboarding / appearance editor ---- */
  function onboarding(editing, back) {
    stopCamp();
    const cur = Object.assign({ h: 170, w: 65, skin: AV.SKINS[1] }, lookOf(), S.body || {});
    const optRow = (id, list, names, on) => `<div class="opts icons" id="${id}">${list.map((k) => `<button data-v="${k}" aria-label="${names[k]}" class="${k === on ? 'on' : ''}"><canvas class="pix" data-ic="${k}"></canvas></button>`).join('')}</div>`;
    const swRow = (id, list, on) => `<div class="skins" id="${id}">${list.map((s) => `<button data-s="${s}" class="${s === on ? 'on' : ''}" style="background:${s}" aria-label="warna"></button>`).join('')}</div>`;
    app.innerHTML = `
    <div class="ob">
      <div class="sky ${skyClass()} obstage"><canvas id="sil" class="pix"></canvas><div class="ground"></div></div>
      <h1>${editing ? 'Ubah penampilanmu' : 'Siapa yang akan jadi pahlawan?'}</h1>
      <p class="mut">${editing ? 'Avatarmu ikut menyesuaikan.' : 'Ceritakan badanmu dulu. Nanti kugambar.'}</p>
      <div class="field"><label>Nama</label><input id="iname" class="txt" type="text" maxlength="14" placeholder="Nama pahlawanmu" value="${(S.name || '').replace(/[<>&\"]/g, '')}" autocomplete="off"></div>
      <div class="field"><label>Gender</label><div class="opts gender" id="genders"><button data-v="m" class="${cur.gender !== 'f' ? 'on' : ''}">♂ Laki-laki</button><button data-v="f" class="${cur.gender === 'f' ? 'on' : ''}">♀ Perempuan</button></div></div>
      <div class="field"><label>Tinggi</label><div class="stepper"><button data-f="h" data-d="-1" aria-label="kurang">−</button><input id="ih" type="number" inputmode="numeric" min="120" max="220" value="${cur.h}"><span>cm</span><button data-f="h" data-d="1" aria-label="tambah">+</button></div></div>
      <div class="field"><label>Berat</label><div class="stepper"><button data-f="w" data-d="-1" aria-label="kurang">−</button><input id="iw" type="number" inputmode="numeric" min="30" max="200" value="${cur.w}"><span>kg</span><button data-f="w" data-d="1" aria-label="tambah">+</button></div></div>
      <div class="field"><label>Warna kulit</label>${swRow('skins', AV.SKINS, cur.skin)}</div>
      <div class="field"><label>Rambut</label>${optRow('hairs', AV.HAIRS, AV.HAIR_NAMES, cur.hair)}</div>
      <div class="field"><label>Warna rambut</label>${swRow('hcols', AV.HAIR_COLORS, cur.hairColor)}</div>
      <div class="field"><label>Baju</label>${optRow('shirts', AV.SHIRTS, AV.SHIRT_NAMES, cur.shirt)}</div>
      <div class="field" id="scolf"><label>Warna baju</label>${swRow('scols', AV.SHIRT_COLORS, cur.shirtColor)}</div>
      ${editing ? '<button class="btn ghost" id="cancel">Batal</button>' : ''}
      <button class="btn big" id="go">${editing ? 'Simpan' : 'Lihat aku →'}</button>
    </div>`;
    const drawIcons = () => {
      const pal = AV.palette(cur.skin, cur.hairColor, cur.shirtColor);
      app.querySelectorAll('#hairs canvas').forEach((c) => AV.draw(c, AV.hairIcon(c.dataset.ic, cur.gender), { pal }));
      app.querySelectorAll('#shirts canvas').forEach((c) => AV.draw(c, AV.shirtIcon(c.dataset.ic, cur.gender), { pal }));
    };
    const redraw = () => {
      drawIcons();
      $('#scolf').style.display = cur.shirt === 'shirtless' && cur.gender !== 'f' ? 'none' : '';
      const B = AV.build({ height: clampN(cur.h, 120, 220), weight: clampN(cur.w, 30, 200), skin: cur.skin, gender: cur.gender, hair: cur.hair, shirt: cur.shirt, stages: editing && S.body ? Object.fromEntries(GKEYS.map((k) => [k, AV.stageOf(gInfo(k).L)])) : {} });
      AV.draw($('#sil'), B, { pal: AV.palette(cur.skin, cur.hairColor, cur.shirtColor) });
    };
    redraw();
    const read = () => { cur.h = parseInt($('#ih').value, 10) || cur.h; cur.w = parseInt($('#iw').value, 10) || cur.w; };
    $('#ih').oninput = $('#iw').oninput = () => { read(); redraw(); };
    app.querySelectorAll('.stepper button').forEach((b) => (b.onclick = () => {
      const f = b.dataset.f, el = $(f === 'h' ? '#ih' : '#iw');
      el.value = clampN((parseInt(el.value, 10) || cur[f]) + parseInt(b.dataset.d, 10), f === 'h' ? 120 : 30, f === 'h' ? 220 : 200);
      read(); redraw(); beep(520, 0.03);
    }));
    const wire = (id, prop, attr) => app.querySelectorAll(`#${id} button`).forEach((b) => (b.onclick = () => { cur[prop] = b.dataset[attr]; app.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle('on', x === b)); redraw(); beep(520, 0.03); }));
    wire('genders', 'gender', 'v'); app.querySelectorAll('#genders button').forEach((b) => b.addEventListener('click', () => { const sw = cur.gender === 'f' ? ['pendek', 'panjang'] : ['panjang', 'pendek']; if (cur.hair === sw[0]) { cur.hair = sw[1]; app.querySelectorAll('#hairs button').forEach((x) => x.classList.toggle('on', x.dataset.v === sw[1])); redraw(); } })); wire('skins', 'skin', 's'); wire('hcols', 'hairColor', 's'); wire('scols', 'shirtColor', 's'); wire('hairs', 'hair', 'v'); wire('shirts', 'shirt', 'v');
    if (editing) $('#cancel').onclick = back || home;
    $('#go').onclick = () => {
      read();
      if (cur.h < 120 || cur.h > 220 || cur.w < 30 || cur.w > 200) { toast('Tinggi 120–220 cm, berat 30–200 kg ya'); return; }
      const nm = ($('#iname').value || '').trim().slice(0, 14);
      if (!editing && !nm) { toast('Isi nama pahlawanmu dulu ya'); $('#iname').focus(); return; }
      S.name = nm || S.name || 'Pahlawan';
      S.body = { gender: cur.gender || 'm', h: cur.h, w: cur.w, skin: cur.skin, hair: cur.hair, hairColor: cur.hairColor, shirt: cur.shirt, shirtColor: cur.shirtColor }; save();
      if (editing) (back || home)(); else revealScreen();
    };
    window.scrollTo(0, 0);
  }

  /* avatar + muscle labels pointing at their areas. first=true plays the pixel reveal and staggers the lines */
  function bodyView(first, extra) {
    stopCamp();
    const B = avatarBuf(groupLevels());
    app.innerHTML = `
    <div class="rv">
      ${first ? '' : '<div class="hdr"><button class="ibtn" id="back" aria-label="Kembali">‹</button><div><h1>${nameOf()}</h1></div></div>'}
      <div class="sky ${skyClass()} stagebig"><div class="pgrid" id="pg"><canvas id="av" class="pix av"></canvas></div><div class="ground"></div></div>
      <div id="rvText" class="rvtext" style="opacity:${first ? 0 : 1}">
        ${first ? `<div class="lvbig">LEVEL 1</div><h2>${nameOf()} · ${titleOf(1)}</h2><p class="mut">Ini kamu sekarang. Tiap label menunjuk otot yang akan berubah.<br>Semuanya masih Lv 1 — ubah itu.</p>` : `<div class="lvbig sm">LV ${curL()}</div><h2>${titleOf(curL())}</h2><p class="mut">Tap label buat lihat progres otot itu.</p>`}
        <button class="btn ghost" id="look">🎨 Atur penampilan</button>
        ${first ? '<button class="btn big" id="go2">Mulai petualangan</button>' : ''}
      </div>
    </div>`;
    const pal = palOf(), box = $('#pg');
    const place = (st) => pointers(box, B, st);
    if (first) AV.reveal($('#av'), B, { pal }, 1500, () => { if (!$('#rvText')) return; $('#rvText').style.opacity = 1; place(true); beep(660, 0.1); setTimeout(() => beep(880, 0.15), 120); });
    else { AV.draw($('#av'), B, { pal }); place(false); }
    watchPointers(box, B);
    $('#look').onclick = () => onboarding(true, () => bodyView(first));
    if (first) $('#go2').onclick = home; else $('#back').onclick = home;
    window.scrollTo(0, 0);
  }
  const revealScreen = () => bodyView(true);

  /* ---- invitation copy (deliberately pushy) ---- */
  function invite() {
    const today = ymd(), done = S.lastDay === today, L = curL();
    const nextZ = G.ZONES.find((z) => z.rec > L);
    const dayN = new Date().getDate();
    if (done) return { cls: 'ok', t: 'Hari ini sudah. Tapi zombie nggak berhenti.', s: nextZ ? `${nextZ.name} butuh Lv ${nextZ.rec}. Kamu Lv ${L}. Tambah lagi?` : 'Kamu sudah menguasai semua zona. Pertahankan.' };
    if (S.lastDay === yesterday() && S.streak > 0) return { cls: 'hot', t: `🔥 Streak ${S.streak} hari bakal HANGUS malam ini.`, s: 'Kamu mau buang semuanya buat 10 menit rebahan?' };
    const pool = [
      ['Zombie nggak libur. Badanmu juga nggak boleh.', 'Bangun. Gerak. Sekarang.'],
      [nextZ ? `${nextZ.name} nungguin. Kamu baru Lv ${L}, butuh Lv ${nextZ.rec}.` : 'Kamu sudah di puncak. Jangan lembek.', 'Level naik cuma lewat keringat.'],
      ['Otot nggak tumbuh dari niat doang.', 'Pilih semangatmu di bawah, lalu mulai.'],
    ];
    const p = pool[dayN % pool.length];
    return { cls: 'hot', t: p[0], s: p[1] };
  }

  /* ---- camp = home ---- */
  function home() {
    stopCamp(); MU.duck(false); MU.play('camp');
    if (!S.body) { onboarding(false); return; }
    bumpGear();
    const li = levelInfo(S.totalXp), today = ymd();
    const alive = S.lastDay === today || S.lastDay === yesterday();
    const inv = invite();
    const unlocked = G.ZONES.filter((z) => z.rec <= li.L).length;
    app.innerHTML = `
    <div class="camp">
      <div class="hudbar"><span class="lvpill">Lv ${li.L}</span><div class="bar sm"><i style="width:${(li.cur / li.need) * 100}%"></i></div><span class="streak ${alive ? 'on' : ''}">🔥${alive ? S.streak : 0}</span><span class="scrap">🔩${fmt(S.scrap)}</span><button class="ibtn" id="cfg" aria-label="Pengaturan">⚙</button></div>
      <div class="campwrap"><canvas id="campc" class="pix"></canvas><canvas id="av" class="pix av campav"></canvas><span class="campname">⛺ KAMP ${nameOf().toUpperCase()}</span></div>
    </div>
    <button class="btn big play" id="play">⚔ MAIN GAME <small>${unlocked}/${G.ZONES.length} zona terbuka</small></button>
    <div class="row2"><button class="btn ghost" id="gudang">🎒 Gudang</button><button class="btn ghost" id="badan">👤 Badan</button></div>
    <button class="btn ghost" id="motion">🕹 Uji Gerakan <small>kamera jadi kontrol game</small></button>
    <div class="invite ${inv.cls}"><b>${inv.t}</b><span>${inv.s}</span></div>
    <h3 class="q">Seberapa semangat buat hadapi hari ini?</h3>
    <div class="choices">${CHOICES.map((c) => `<button class="choice m-${c.mood}" data-k="${c.key}"><canvas class="pix" data-m="${c.mood}"></canvas><b>${c.name}</b><small>${c.cap}</small></button>`).join('')}</div>`;
    AV.draw($('#av'), avatarBuf(groupLevels()), { pal: palOf() });
    const cc = $('#campc'), t0 = Date.now();
    G.drawCamp(cc, 0, skyClass());
    campTimer = setInterval(() => { if (!document.body.contains(cc)) { stopCamp(); return; } G.drawCamp(cc, (Date.now() - t0) / 1000, skyClass()); }, 150);
    app.querySelectorAll('.choice canvas').forEach((c) => drawPerson(c, c.dataset.m));
    app.querySelectorAll('.choice').forEach((b) => (b.onclick = () => readyScreen(CHOICES.find((c) => c.key === b.dataset.k))));
    $('#play').onclick = gameMenu; $('#gudang').onclick = shop; $('#badan').onclick = () => bodyView(false); $('#motion').onclick = motionTest; $('#cfg').onclick = settings;
    window.scrollTo(0, 0);
  }

  function readyScreen(c) {
    stopCamp(); MU.play(MOODTRACK[c.key] || 'siap');
    app.innerHTML = `
    <div class="rdy">
      <div><button class="ibtn" id="back" aria-label="Kembali">‹</button></div>
      <div class="rdcenter"><canvas class="pix icbig m-${c.mood}" id="ic"></canvas><h1>${c.name}</h1><p class="cap">${c.push}</p><p class="mut">${c.tease}</p></div>
      <label class="camchip"><input type="checkbox" id="tcam" ${S.settings.camera ? 'checked' : ''}><span>📷 Kamera AI cek gerakanmu<br><span class="mut small">${buildTimeline(D.routines[c.key]).some((t) => t.cam) ? 'Bonus XP kalau form-nya bagus' : 'Menu ini belum dinilai kamera (baru menu SIAP). Pakai demo avatar.'}</span></span></label>
      <div class="restbox"><div class="slrow"><span>⏱ Istirahat antar gerakan</span><b id="restv"></b></div><input type="range" id="rest" min="0" max="90" step="5" value="${restFor(c.key)}"><p class="mut small" id="restnote"></p></div>
      <button class="btn big" id="start">MULAI SEKARANG</button>
    </div>`;
    drawPerson($('#ic'), c.mood);
    $('#back').onclick = home;
    $('#tcam').onchange = (e) => { S.settings.camera = e.target.checked; save(); };
    const defRest = D.routines[c.key].rest_sec;
    const restTxt = () => { const v = parseInt($('#rest').value, 10); $('#restv').textContent = v ? v + ' detik' : 'tanpa istirahat'; $('#restnote').innerHTML = v === defRest ? `Bawaan menu ${c.name}. Geser kalau mau diubah.` : `Bawaan menu ${c.name}: ${defRest ? defRest + ' detik' : 'tanpa istirahat'}. <a href="#" id="restreset">Kembalikan</a>`; const rr = $('#restreset'); if (rr) rr.onclick = (e) => { e.preventDefault(); $('#rest').value = defRest; saveRest(); }; };
    const saveRest = () => { const v = parseInt($('#rest').value, 10) || 0; S.settings.restBy = S.settings.restBy || {}; if (v === defRest) delete S.settings.restBy[c.key]; else S.settings.restBy[c.key] = v; save(); restTxt(); };
    restTxt(); $('#rest').oninput = restTxt; $('#rest').onchange = saveRest;
    $('#start').onclick = () => startWorkout(c.key);
    window.scrollTo(0, 0);
  }

  /* ---- game ---- */
  let GM = null;
  const myStats = () => G.playerStats(curL(), groupLevels(), S.gear);

  /* ---------------- motion test: the camera as a controller (walk, punch, swing, kick) ---------------- */
  let mtRun = null;
  async function motionTest() {
    stopCamp(); MU.play('camp');
    const sensOf = () => (S.settings.motionSens == null ? 100 : S.settings.motionSens);
    app.innerHTML = `
    <div class="cam full mtbox" id="mtBox" style="--arn:1.333"><div class="mirror"><video id="mtv" playsinline muted></video><canvas id="mtc"></canvas></div>
      <div class="mttiles">
        <div class="mt-tile" data-k="step"><b>🚶</b><span>LANGKAH</span><i>0</i></div>
        <div class="mt-tile" data-k="punch"><b>👊</b><span>PUKUL</span><i>0</i></div>
        <div class="mt-tile" data-k="swing"><b>⚔️</b><span>AYUN</span><i>0</i></div>
        <div class="mt-tile" data-k="kick"><b>🦵</b><span>TENDANG</span><i>0</i></div>
      </div>
      <div class="mtwalk"><i id="mtspeed"></i></div>
      <div class="mtmsg" id="mtmsg">Menyiapkan kamera…</div>
      <pre class="mtdbg" id="mtdbg" style="display:none"></pre>
      <div class="mtctl"><label>Sensitivitas <b id="msv"></b><input type="range" id="msens" min="60" max="160" step="5" value="${sensOf()}"></label>
        <div class="mtbtns"><button class="btn mini" id="mtdbgb">Debug</button><button class="btn mini" id="mtreset">Reset hitungan</button><button class="btn mini" id="mtback">✕ Selesai</button></div></div>
    </div>`;
    const ctrl = FM.create({ sens: sensOf() / 100 });
    mtRun = { raf: 0, ctrl, ended: false };
    const quit = () => { if (mtRun) { mtRun.ended = true; cancelAnimationFrame(mtRun.raf); } mtRun = null; stopCamera(); home(); };
    $('#mtback').onclick = quit;
    $('#mtreset').onclick = () => { ctrl.reset(); app.querySelectorAll('.mt-tile i').forEach((i) => (i.textContent = '0')); };
    $('#mtdbgb').onclick = () => { const d = $('#mtdbg'); d.style.display = d.style.display === 'none' ? '' : 'none'; };
    const msv = () => { $('#msv').textContent = $('#msens').value + '%'; };
    msv(); $('#msens').oninput = () => { msv(); ctrl.setSens($('#msens').value / 100); }; $('#msens').onchange = () => { S.settings.motionSens = parseInt($('#msens').value, 10); save(); };
    const r = await startCamera($('#mtv'));
    if (!mtRun || mtRun.ended) return;
    if (!r.ok) { $('#mtmsg').innerHTML = `📷 ${r.reason}<br><button class="btn mini" id="mtretry">Coba lagi</button>`; $('#mtretry').onclick = () => motionTest(); return; }
    $('#mtmsg').textContent = 'Berdiri ±2 m dari HP, seluruh badan masuk. Coba jalan di tempat, pukul, ayun, tendang!';
    const FREQ = { step: 330, punch: 520, swing: 700, kick: 220 };
    const frame = () => {
      if (!mtRun || mtRun.ended) return; mtRun.raf = requestAnimationFrame(frame);
      const v = $('#mtv'), cv = $('#mtc'); if (!v || !cam.landmarker || v.readyState < 2 || v.currentTime === cam.lastVideoTime) return;
      const now = performance.now(); if (now - cam.lastT < 33) return; cam.lastT = now; cam.lastVideoTime = v.currentTime;
      let res; try { res = cam.landmarker.detectForVideo(v, now); } catch (e) { return; }
      const img = res.landmarks && res.landmarks[0], world = res.worldLandmarks && res.worldLandmarks[0], w = v.videoWidth, h = v.videoHeight;
      if (cv.width !== w) { cv.width = w; cv.height = h; $('#mtBox').style.setProperty('--arn', (w / h).toFixed(3)); }
      const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, h);
      if (!img || !world) { $('#mtspeed').style.width = '0'; return; }
      drawSkeleton(ctx, img, w, h, true);
      const o = ctrl.update({ img, world, w, h }, now / 1000);
      if (!o.ok) { $('#mtmsg').textContent = 'Badanmu belum penuh terlihat — mundur sedikit'; $('#mtspeed').style.width = '0'; return; }
      for (const e of o.events) {
        const t = app.querySelector(`.mt-tile[data-k="${e.type}"]`); if (!t) continue;
        t.querySelector('i').textContent = o.counts[e.type]; t.classList.add('hit'); setTimeout(() => t.classList.remove('hit'), 220); beep(FREQ[e.type], 0.05);
      }
      $('#mtspeed').style.width = Math.min(100, o.speed * 62) + '%';
      $('#mtmsg').textContent = o.walking ? 'Jalan! 🚶' : 'Berdiri…';
      const d = $('#mtdbg'); if (d.style.display !== 'none') d.textContent = JSON.stringify(o.debug);
    };
    frame();
  }

  function gameMenu() {
    stopCamp(); bumpGear();
    const L = curL(), ps = myStats();
    app.innerHTML = `
    <div class="hdr"><button class="ibtn" id="back" aria-label="Kembali">‹</button><div><h1>Reruntuhan</h1><p>Zombie menguasai kota. Naikkan level, baru bisa maju.</p></div><button class="ibtn" id="gtree" aria-label="Skill tree">🌳</button></div>
    <section class="card pstat"><span>❤ ${ps.hp}</span><span>⚔ ${ps.dmg}</span><span>🛡 ${ps.def}</span><span>⚡ ${ps.skills.length}</span><span>🔩 ${fmt(S.scrap)}</span></section>
    <div class="modesw"><button data-m="side" class="${S.settings.fpsMode ? '' : 'on'}">🎮 Layar sentuh</button><button data-m="fps" class="${S.settings.fpsMode ? 'on' : ''}">🕹 Mode Gerak <small>kamera</small></button></div>
    ${S.settings.fpsMode ? '<p class="mut small center">Mode Gerak: HP disandarkan ±2 m, <b>jalan di tempat</b> = maju, <b>pukul</b>, <b>ayun</b>, <b>tendang</b> betulan. Kamera dipakai.</p>' : ''}
    ${G.ZONES.map((z) => { const lock = L < z.rec, cl = S.cleared[z.id] || 0; return `<button class="zone ${lock ? 'lock' : ''}" data-z="${z.id}" ${lock ? 'disabled' : ''}>
      <div class="zt"><b>${lock ? '🔒 ' : cl ? '✅ ' : '⚔ '}${z.name}</b><span class="zlv">Lv ${z.rec}+</span></div>
      <div class="mut small">${lock ? `Butuh Lv ${z.rec}. Kamu baru Lv ${L} — gerak dulu di pagi hari.` : z.desc}</div>
      <div class="small zr">Hadiah 🔩${z.scrap}${cl ? ` · menang ${cl}x` : ''}</div></button>`; }).join('')}
    <p class="mut small center">Kalah itu nggak apa-apa — kamu kabur ke kamp. Tapi musuh nggak ngasih ampun kalau levelmu kurang.</p>`;
    $('#back').onclick = home; $('#gtree').onclick = () => skillTree();
    app.querySelectorAll('.modesw button').forEach((b) => (b.onclick = () => { S.settings.fpsMode = b.dataset.m === 'fps'; save(); gameMenu(); }));
    app.querySelectorAll('.zone').forEach((b) => (b.onclick = () => { const z = G.ZONES.find((q) => q.id === b.dataset.z); (S.settings.fpsMode ? fpsBattle : battle)(z); }));
    window.scrollTo(0, 0);
  }
  const lookNow = () => { const b = S.body, l = lookOf(b); return { height: b.h, weight: b.w, gender: l.gender, hair: l.hair, shirt: l.shirt, armor: S.gear.armor, stages: Object.fromEntries(GKEYS.map((k) => [k, AV.stageOf(gInfo(k).L)])) }; };
  function battle(zone) {
    stopCamp(); MU.play('battle');
    const ps = myStats(), g = groupLevels();
    const nextLocked = (G.SKILLS[ps.weapon] || []).find((n) => !ps.skills.includes(n));
    app.innerHTML = `
    <div class="gm">
      <canvas id="gc" class="pix gc"></canvas>
      <div class="skillrow" id="sr">${ps.skills.map((s) => `<button class="sk" data-id="${s.id}"><span>${s.em}</span><small>${s.name}</small><i class="cdv"></i></button>`).join('')}</div>
      ${ps.skills.length ? '' : `<p class="mut small center" style="padding:0 16px">Belum ada skill aktif.${nextLocked ? ` Skill pertama (${nextLocked.name}) butuh ${G.GROUP_NAME[nextLocked.req[0]]} Lv ${nextLocked.req[1]} — kamu ${G.GROUP_NAME[nextLocked.req[0]]} Lv ${g[nextLocked.req[0]]}.` : ''}</p>`}
      <div class="gctl"><button class="gbtn" id="bj">⤒ LOMPAT</button><button class="gbtn flee" id="bf">🏃 KABUR</button></div>
      <p class="mut small center" style="padding:0 16px">Kamu menyerang otomatis. Tap skill kapan saja. Lompat pas musuh nunjukin tanda ❗ biar pukulannya meleset.</p>
    </div>`;
    GM = G.play($('#gc'), {
      ps, zone, look: lookNow(), pal: palOf(), onEnd: (r) => endBattle(zone, r),
      onFrame: (sim) => app.querySelectorAll('.sk').forEach((b) => { const sk = ps.skills.find((q) => q.id === b.dataset.id), c = sim.cd[sk.id]; b.classList.toggle('cd', c > 0 || sim.lock > 0); b.querySelector('.cdv').style.height = (c > 0 ? (c / sk.cd) * 100 : 0) + '%'; }),
    });
    app.querySelectorAll('.sk').forEach((b) => (b.onpointerdown = (e) => { e.preventDefault(); GM.skill(b.dataset.id); }));
    $('#bj').onpointerdown = (e) => { e.preventDefault(); GM.jump(); };
    $('#bf').onclick = () => GM.flee();
  }
  function endBattle(zone, r, retry) {
    if (GM) { GM.stop(); GM = null; }
    const win = r.status === 'win';
    S.scrap += r.scrap; if (win) S.cleared[zone.id] = (S.cleared[zone.id] || 0) + 1; save();
    const ov = document.createElement('div'); ov.className = 'overlay res'; ov.id = 'ov';
    const L = curL(), nxt = G.ZONES.find((z) => z.rec > L);
    ov.innerHTML = `<div class="rescard"><h2>${win ? '🏆 ZONA BERSIH!' : r.status === 'flee' ? '🏃 Kabur ke kamp' : '💀 Kamu tumbang…'}</h2>
      <p>${win ? `${zone.name} aman. Kamu bawa pulang <b>🔩${r.scrap}</b>.` : `Kamu kabur ke kamp dengan sisa tenaga. Ketemu <b>${r.kills}</b> musuh yang tumbang, bawa <b>🔩${r.scrap}</b>.`}</p>
      ${win ? '' : '<p class="mut small">Penyebabnya bukan nasib — levelmu belum cukup. Latihan pagi bikin kamu lebih kuat.</p>'}
      ${win && nxt ? `<p class="mut small">Berikutnya: ${nxt.name} (Lv ${nxt.rec}). Kamu Lv ${L}.</p>` : ''}
      <button class="btn big" id="rok">Ke kamp</button>${win ? '' : '<button class="btn ghost" id="rtry">Coba lagi</button>'}</div>`;
    document.body.appendChild(ov);
    $('#rok').onclick = () => { ov.remove(); home(); };
    if ($('#rtry')) $('#rtry').onclick = () => { ov.remove(); (retry || (() => battle(zone)))(); };
  }

  /* ---- Mode Gerak: first-person, body-controlled ---- */
  let fpsRun = null;
  async function fpsBattle(zone) {
    stopCamp(); MU.play('battle');
    const ps = myStats(), ctrl = FM.create({ sens: (S.settings.motionSens == null ? 100 : S.settings.motionSens) / 100 });
    const ov = document.createElement('div'); ov.className = 'fpsbox'; ov.id = 'fpsov';
    ov.innerHTML = `<canvas id="fc" class="pix fc"></canvas>
      <div class="fpip" id="fpip"><div class="mirror"><video id="fv" playsinline muted></video><canvas id="fvc"></canvas></div></div>
      <div class="fmsg" id="fmsg">Menyiapkan kamera…</div>
      <button class="ibtn fq" id="fq" aria-label="Kabur">✕</button>
      <div class="fkeys" id="fkeys"><button class="gbtn" id="fkw">🚶 JALAN</button><button class="gbtn" id="fkp">👊 PUKUL</button><button class="gbtn" id="fks">⚔️ AYUN</button><button class="gbtn" id="fkk">🦵 TENDANG</button></div>`;
    document.body.appendChild(ov);
    const hideMsg = (ms) => setTimeout(() => { const m = $('#fmsg'); if (m) m.style.display = 'none'; }, ms);
    let game = null, ended = false, camOk = false, wasd = 0, holdW = false, raf = 0, fpsSpeed = 0;
    const finish = (r) => { if (ended) return; ended = true; cancelAnimationFrame(raf); stopCamera(); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); fpsRun = null; ov.remove(); endBattle(zone, r, () => fpsBattle(zone)); };
    const begin = () => { if (game) return; game = window.FitFPS.play($('#fc'), { ps, zone, pal: palOf(), onEnd: finish }); };
    const act = (t, p) => { if (!game) { begin(); hideMsg(0); } if (!game) return; const h = game.act(t, p); beep(h ? { punch: 520, swing: 700, kick: 220 }[t] : 140, 0.05); };
    const kd = (e) => { if (e.repeat) return; const k = e.key.toLowerCase(); if (k === 'w' || k === 'arrowup') wasd = 1; if (k === 'j') act('punch'); if (k === 'k') act('swing'); if (k === 'l') act('kick'); };
    const ku = (e) => { const k = e.key.toLowerCase(); if (k === 'w' || k === 'arrowup') wasd = 0; };
    document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
    const fw = $('#fkw'); fw.onpointerdown = (e) => { e.preventDefault(); holdW = true; if (!game) { begin(); hideMsg(0); } }; fw.onpointerup = fw.onpointerleave = () => { holdW = false; };
    $('#fkp').onpointerdown = (e) => { e.preventDefault(); act('punch'); }; $('#fks').onpointerdown = (e) => { e.preventDefault(); act('swing'); }; $('#fkk').onpointerdown = (e) => { e.preventDefault(); act('kick'); };
    $('#fq').onclick = () => { if (game) game.flee(); else finish({ status: 'flee', kills: 0, scrap: 0 }); };
    fpsRun = { finish };
    const r = await startCamera($('#fv'));
    if (ended) return;
    camOk = r.ok;
    if (!r.ok) { $('#fmsg').textContent = '📷 ' + r.reason + ' — pakai tombol di bawah'; $('#fpip').style.display = 'none'; begin(); hideMsg(3500); }
    else $('#fkeys').classList.add('small');
    let okSince = 0;
    const loop = () => {
      if (ended) return; raf = requestAnimationFrame(loop);
      if (game) game.walk(Math.max(holdW || wasd ? 1 : 0, fpsSpeed));
      const v = $('#fv'), cv = $('#fvc'); if (!camOk || !v || !cam.landmarker || v.readyState < 2 || v.currentTime === cam.lastVideoTime) return;
      const now = performance.now(); if (now - cam.lastT < 33) return; cam.lastT = now; cam.lastVideoTime = v.currentTime;
      let res; try { res = cam.landmarker.detectForVideo(v, now); } catch (e) { return; }
      const img = res.landmarks && res.landmarks[0], world = res.worldLandmarks && res.worldLandmarks[0], w = v.videoWidth, h = v.videoHeight;
      if (cv.width !== w) { cv.width = w; cv.height = h; }
      const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, h);
      if (!img || !world) { fpsSpeed = 0; okSince = 0; if (!game) $('#fmsg').textContent = 'Berdiri ±2 m, seluruh badan masuk frame'; return; }
      drawSkeleton(ctx, img, w, h, true);
      const o = ctrl.update({ img, world, w, h }, now / 1000);
      if (!o.ok) { fpsSpeed = 0; okSince = 0; if (!game) $('#fmsg').textContent = 'Badan belum penuh terlihat — mundur sedikit'; return; }
      if (!game) { okSince = okSince || now; const left = 2 - (now - okSince) / 1000; $('#fmsg').textContent = left > 0 ? `Siap… ${Math.ceil(left)}` : 'GAS!'; if (left <= 0) { begin(); hideMsg(700); } return; }
      fpsSpeed = o.speed;
      for (const e of o.events) if (e.type !== 'step') act(e.type, e.power);
    };
    loop();
  }

  /* ---- skill tree ---- */
  function skillTree(wid) {
    stopCamp(); bumpGear(); wid = wid || S.gear.weapon;
    const g = groupLevels(), w = G.weaponOf(wid), nodes = G.SKILLS[wid] || [], un = G.unlockedSkills(wid, g).map((n) => n.id);
    const own = S.gear.owned.includes(wid), eq = S.gear.weapon === wid;
    const node = (n) => {
      const ok = un.includes(n.id), kids = nodes.filter((q) => q.parent === n.id), gl = g[n.req[0]], par = n.parent ? nodes.find((q) => q.id === n.parent) : null;
      const need = ok ? 'Terbuka' : gl < n.req[1] ? `${G.GROUP_NAME[n.req[0]]} Lv ${n.req[1]} (kamu Lv ${gl})` : `Buka dulu: ${par.name}`;
      return `<li><div class="sn ${ok ? 'ok' : 'lk'}"><span class="se">${ok ? n.em : '🔒'}</span><div class="sb"><b>${n.name}</b><div class="mut small">${n.desc}</div><div class="small sreq ${ok ? 'g' : ''}">${need} · jeda ${n.cd}d</div></div></div>${kids.length ? `<ul>${kids.map(node).join('')}</ul>` : ''}</li>`;
    };
    const root = nodes.filter((n) => !n.parent);
    app.innerHTML = `
    <div class="hdr"><button class="ibtn" id="back" aria-label="Kembali">‹</button><div><h1>Skill Tree</h1><p>Terbuka lewat level otot, bukan dibeli.</p></div></div>
    <div class="wtabs">${G.WEAPONS.map((x) => `<button class="wtab ${x.id === wid ? 'on' : ''}" data-w="${x.id}"><span>${x.em}</span><small>${x.name}</small></button>`).join('')}</div>
    <section class="card"><b>${w.em} ${w.name}</b><div class="mut small">${w.blurb}</div>
      <ul class="stree">${root.map(node).join('')}</ul>
      ${eq ? '<div class="tagok" style="margin-top:10px">Sedang dipakai</div>' : own ? `<button class="btn big" id="wuse" style="margin-top:12px">Pakai senjata ini</button>` : `<button class="btn big ${S.scrap >= w.cost ? '' : 'dis'}" id="wbuy" style="margin-top:12px">Beli 🔩${w.cost}</button>`}</section>`;
    $('#back').onclick = shop;
    app.querySelectorAll('.wtab').forEach((b) => (b.onclick = () => skillTree(b.dataset.w)));
    if ($('#wuse')) $('#wuse').onclick = () => { S.gear.weapon = wid; save(); skillTree(wid); };
    if ($('#wbuy')) $('#wbuy').onclick = () => { if (S.scrap < w.cost) { toast(`Scrap kurang ${w.cost - S.scrap}. Latihan dulu — tiap sesi nambah scrap.`); return; } S.scrap -= w.cost; S.gear.owned.push(wid); S.gear.weapon = wid; save(); beep(900, 0.1); skillTree(wid); };
    window.scrollTo(0, 0);
  }

  /* ---- gudang ---- */
  function shop() {
    stopCamp(); bumpGear();
    const g = groupLevels();
    const row = (kind, it) => {
      const own = S.gear.owned.includes(it.id), eq = S.gear[kind] === it.id;
      const stat = kind === 'weapon' ? `⚔ +${it.dmg} · ${(G.SKILLS[it.id] || []).length} skill` : `🛡 +${it.def}`;
      const unl = kind === 'weapon' ? G.unlockedSkills(it.id, g).length : 0;
      return `<div class="witem"><div class="item ${eq ? 'eq' : ''}"><div><b>${it.em ? it.em + ' ' : ''}${it.name}</b><div class="mut small">${kind === 'weapon' ? it.blurb : stat}</div>${kind === 'weapon' ? `<div class="mut small">${stat} · terbuka ${unl}</div>` : ''}</div>
        ${eq ? '<span class="tagok">Dipakai</span>' : own ? `<button class="btn mini" data-eq="${kind}:${it.id}">Pakai</button>` : `<button class="btn mini ${S.scrap >= it.cost ? '' : 'dis'}" data-buy="${kind}:${it.id}">🔩${it.cost}</button>`}</div>
        ${kind === 'weapon' ? `<button class="btn ghost mini wide" data-tree="${it.id}">🌳 Lihat skill tree</button>` : ''}</div>`;
    };
    app.innerHTML = `
    <div class="hdr"><button class="ibtn" id="back" aria-label="Kembali">‹</button><div><h1>Gudang</h1><p>Scrap: <b>🔩${fmt(S.scrap)}</b>. Semua senjata harganya sama dan sama kuat — yang beda skill tree-nya.</p></div></div>
    <h3 class="sec">Senjata</h3><section class="card items">${G.WEAPONS.map((w) => row('weapon', w)).join('')}</section>
    <h3 class="sec">Pelindung</h3><section class="card items">${G.ARMORS.map((a) => row('armor', a)).join('')}</section>`;
    $('#back').onclick = home;
    app.querySelectorAll('[data-tree]').forEach((b) => (b.onclick = () => skillTree(b.dataset.tree)));
    app.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => {
      const [kind, id] = b.dataset.buy.split(':'), it = (kind === 'weapon' ? G.WEAPONS : G.ARMORS).find((x) => x.id === id);
      if (S.scrap < it.cost) { toast(`Scrap kurang ${it.cost - S.scrap}. Latihan dulu — tiap sesi nambah scrap.`); return; }
      S.scrap -= it.cost; S.gear.owned.push(id); S.gear[kind] = id; save(); beep(900, 0.1); shop();
    }));
    app.querySelectorAll('[data-eq]').forEach((b) => (b.onclick = () => { const [kind, id] = b.dataset.eq.split(':'); S.gear[kind] = id; save(); shop(); }));
    window.scrollTo(0, 0);
  }

  function summary(run, t) {
    stopCamp();
    const li = levelInfo(S.totalXp), upL = li.L - run.before.L;
    const after = groupLevels(), before = run.before.g;
    const changed = GKEYS.filter((k) => AV.stageOf(after[k]) > AV.stageOf(before[k]));
    const pal = palOf();
    const newZ = G.ZONES.filter((z) => z.rec > run.before.L && z.rec <= li.L);
    app.innerHTML = `
    <div class="hdr"><div><h1>${t.early ? 'Lumayan!' : 'Selesai! 🎉'}</h1><p>${changed.length ? 'Badanmu berubah!' : 'Satu langkah lagi ke versi kuatmu.'}</p></div></div>
    <section class="card center"><div class="xp">+${fmt(t.total)} XP</div><div class="scrapgain">+🔩${t.scrap} scrap</div>
      ${upL > 0 ? `<div class="lvlup">⬆ LEVEL UP! Sekarang Lv ${li.L} — ${titleOf(li.L)}</div>` : ''}
      ${newZ.length ? `<div class="lvlup">🔓 Zona terbuka: ${newZ.map((z) => z.name).join(', ')}</div>` : ''}
      <div class="bar"><i style="width:${(li.cur / li.need) * 100}%"></i></div><div class="barlbl"><span>Lv ${li.L}</span><span>${fmt(li.cur)} / ${fmt(li.need)} XP</span></div></section>
    <section class="card center">
      ${changed.length ? `<div class="chip p" style="display:inline-block;margin-bottom:6px">OTOT BERKEMBANG: ${changed.map((k) => AV.GROUPS[k].name).join(', ')}</div>
        <div class="ba"><canvas id="avb" class="pix"></canvas><span class="arrow">→</span><canvas id="ava" class="pix after"></canvas></div>`
        : '<div class="ba"><canvas id="ava" class="pix"></canvas></div>'}
      ${GKEYS.map((k) => { const g = gInfo(k); const up = after[k] > before[k]; return `<div class="grow"><span class="gn">${AV.GROUPS[k].name}</span><div class="bar sm"><i style="width:${Math.round(g.pct * 100)}%"></i></div><b class="${up ? 'g' : ''}">Lv ${g.L}${up ? '↑' : ''}</b></div>`; }).join('')}
    </section>
    <section class="card rows"><div><span>Latihan</span><b>${t.base}</b></div><div><span>📷 Bonus kamera</span><b class="g">+${t.camB}</b></div>
      <div><span>🔥 Streak ${S.streak} hari</span><b class="g">+${t.streakB}</b></div><div><span>🌅 Bonus harian</span><b class="g">+${t.dailyB}</b></div></section>
    <h3 class="sec">Rincian gerakan</h3>
    <section class="card steps">${run.results.map((r) => `<div class="stp"><span class="em">${EMOJI[r.exercise]}</span><div><div>${r.exName}</div><div class="mut small">${r.lvName}</div></div>
      <div class="rt2">${r.score != null ? `<b class="${r.score >= 80 ? 'g' : r.score >= 55 ? 'o' : 'r'}">Form ${r.score}</b><small>${r.reps != null ? r.reps + ' rep · ' : ''}+${r.bonus} XP</small>` : `<small>${r.tried ? 'kamera kurang lihat' : 'tanpa kamera'}</small>`}</div></div>`).join('')}</section>
    <button class="btn big" id="ok">Balik ke kamp</button>`;
    AV.draw($('#ava'), avatarBuf(after), { pal });
    if (changed.length) AV.draw($('#avb'), avatarBuf(before), { pal });
    $('#ok').onclick = home;
    if (upL > 0 || changed.length) { beep(800, 0.15); setTimeout(() => beep(1100, 0.25), 180); }
    window.scrollTo(0, 0);
  }

  function settings() {
    stopCamp();
    const lv = groupLevels();
    app.innerHTML = `
    <div class="hdr"><button class="ibtn" id="back" aria-label="Kembali">‹</button><div><h1>Pengaturan</h1></div></div>
    <section class="card tog"><label><span>📷 Bonus kamera</span><input type="checkbox" id="tcam" ${S.settings.camera ? 'checked' : ''}></label>
      <label><span>🔊 Suara pemandu</span><input type="checkbox" id="tvoice" ${S.settings.voice ? 'checked' : ''}></label></section>
    <section class="card tog"><label><span>🎵 Musik latar</span><input type="checkbox" id="tmusic" ${S.settings.music !== false ? 'checked' : ''}></label>
      <div class="slrow"><span>Volume</span><b id="volv"></b></div><input type="range" id="vol" min="0" max="100" step="5" value="${Math.round((S.settings.vol == null ? 0.7 : S.settings.vol) * 100)}">
      <p class="mut small">Tiap suasana punya lagu sendiri: Lemes pelan, Siap ceria, Membara kencang, plus lagu khusus untuk game dan kamp.</p></section>
    <section class="card"><div>${nameOf()}: <b>${S.body.h} cm · ${S.body.w} kg</b></div><p class="mut small">Latihan: ${S.sessions} · Streak terbaik: ${S.best} hari</p><button class="btn ghost" id="edit" style="margin-top:10px">Ubah nama, badan & penampilan</button></section>
    <h3 class="sec">Uji avatar (preview saja)</h3>
    <section class="card center"><canvas id="pv" class="pix" style="height:260px;width:auto"></canvas>
      <p class="mut small">Geser level tiap otot untuk lihat bentuknya. Progresmu tidak berubah.<br>Bentuk avatar berubah tiap ${AV.STAGE_EVERY} level (Lv 5, 10, … 50).</p>
      <div style="text-align:left">${GKEYS.map((k) => `<div class="slrow"><span>${AV.GROUPS[k].name}</span><b id="pv_${k}"></b></div><input type="range" data-g="${k}" min="1" max="${MAXL}" step="1" value="${Math.min(MAXL, lv[k])}">`).join('')}</div></section>
    <button class="btn ghost danger" id="reset">Hapus semua progres</button>`;
    const pal = palOf();
    const volTxt = () => { $('#volv').textContent = $('#vol').value + '%'; };
    volTxt(); $('#vol').oninput = () => { volTxt(); S.settings.vol = $('#vol').value / 100; MU.setVolume(S.settings.vol); }; $('#vol').onchange = save;
    $('#tmusic').onchange = (e) => { S.settings.music = e.target.checked; save(); MU.setEnabled(e.target.checked); };
    const prev = () => { const t = {}; app.querySelectorAll('input[data-g]').forEach((r) => { t[r.dataset.g] = parseInt(r.value, 10); $('#pv_' + r.dataset.g).textContent = `Lv ${r.value} · bentuk ${AV.stageOf(t[r.dataset.g])}/${AV.MAX_STAGE}`; }); AV.draw($('#pv'), avatarBuf(t), { pal }); };
    prev(); app.querySelectorAll('input[data-g]').forEach((r) => (r.oninput = prev));
    $('#back').onclick = home;
    $('#tcam').onchange = (e) => { S.settings.camera = e.target.checked; save(); };
    $('#tvoice').onchange = (e) => { S.settings.voice = e.target.checked; save(); };
    $('#edit').onclick = () => onboarding(true, settings);
    $('#reset').onclick = () => askConfirm('Yakin hapus semua progres dan mulai dari awal?', 'Hapus semua', () => { S = defaults(); save(); home(); });
  }

  /* ---------------- boot ---------------- */
  window.__fq = { fpsBattle, motionTest, music: MU, skillTree, askConfirm, gameMenu, shop, battle, bodyView, state: () => S, buildTimeline, levelInfo, mLevel, routineStats, tick, startWorkout, home, onboarding, revealScreen, settings, groupLevels, gInfo, runner: () => R };
  applyMusic();
  home();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
