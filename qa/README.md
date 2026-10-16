# QA offline dari video

Tujuan: menyetel `motion.js` dengan video asli (bukan skeleton sintetis).

1. Ekstrak frame: `ffmpeg -i video.mp4 -vf scale=640:360 -q:v 3 fr_NAMA/%04d.jpg`
2. Pose per frame (model lite yang sama dengan app, smoothing mati): jalankan `python3 -m http.server 8766` di folder yang berisi `mediapipe/` dan `harness.html`, lalu `python3 ext.py fr_NAMA` -> `fr_NAMA.json`.
3. Energi piksel: `python3 me.py fr_NAMA a b` -> `en_fr_NAMA.json` (definisi sama dengan `FitMotion.makeEnergy`).
4. Evaluasi: `node evalf.js 0 0.05` (hitung langkah/pukul/ayun/tendang/tangkis per video).

Catatan: jangan umpan frame ke model secepat mungkin dengan smoothLandmarks aktif — filter model rusak (butuh timestamp nyata).
