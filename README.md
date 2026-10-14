# Body Runner

Game lari 3D ringan di browser yang dikendalikan **gerakan tubuh lewat webcam** — tanpa install, tanpa build, jalan langsung dari GitHub Pages.

- **Condong kiri / kanan** → pindah jalur
- **Angkat kedua tangan di atas kepala** → lompat (juga untuk main lagi)
- **Jongkok / turunkan bahu** → merunduk
- Keyboard: ← → ↑ ↓ (mode tanpa kamera)

Teknologi: [Three.js](https://threejs.org) (dunia 3D low-poly) + [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) (deteksi pose di perangkat, model *lite* ±3 MB). Semua pemrosesan terjadi di browser; video tidak pernah dikirim ke server.

## Jalankan

Buka halaman GitHub Pages repo ini, atau lokal:

```bash
python3 -m http.server 8080
# buka http://localhost:8080
```

Kamera butuh HTTPS atau `localhost`.

## Cara kerja singkat

`main.js`:
- **Scene**: jalan dengan tekstur bergeser (kesan bergerak tanpa menggeser geometri), gedung low-poly didaur ulang, langit gradasi senja.
- **Pose → input**: titik bahu (11/12) untuk condong & merunduk, pergelangan (15/16) vs hidung (0) untuk tangan ke atas. Kalibrasi 3 detik mengambil postur netral; ambang dengan histeresis agar tidak gemetar.
- **Rintangan**: tembok per jalur (harus pindah), palang rendah (harus lompat), palang tinggi (harus merunduk), koin. Semua dari *object pool*.

## Lisensi

MIT.
