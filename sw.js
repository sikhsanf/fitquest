const CACHE = 'fitquest-v12';
const MP = ['pose.js', 'pose_landmark_lite.tflite', 'pose_solution_packed_assets.data', 'pose_solution_packed_assets_loader.js', 'pose_solution_simd_wasm_bin.js', 'pose_solution_simd_wasm_bin.wasm', 'pose_solution_simd_wasm_bin.data', 'pose_web.binarypb'].map((f) => 'mediapipe/' + f);
const SHELL = ['./', 'index.html', 'data.js', 'detectors.js', 'avatar.js', 'exanim.js', 'music.js', 'motion.js', 'game.js', 'fps.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).then(() => Promise.allSettled(MP.map((u) => c.add(u))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin && u.pathname.includes('/mediapipe/')) {
    // big AI assets never change: cache-first so the camera AI works offline
    e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); } return res; })));
  } else if (u.origin === location.origin) {
    // network-first for the app itself, cache fallback when offline
    e.respondWith(fetch(r).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); return res; }).catch(() => caches.match(r).then((m) => m || caches.match('./'))));
  } else if (/(^|\.)jsdelivr\.net$|(^|\.)googleapis\.com$/.test(u.hostname)) {
    // MediaPipe library, wasm and pose model: cache-first so the AI works offline after the first load
    e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); } return res; })));
  }
});
