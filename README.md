# Bolu Lari! 🏃

Game lari 3D **ramah anak** di browser yang dikendalikan **gerakan badan lewat webcam** — tanpa install, tanpa build, jalan langsung dari GitHub Pages.

**Main:** https://wildanlsfs.github.io/body-runner/

| Gerakan | Aksi |
|---|---|
| Condong kiri / kanan | belok jalur |
| Angkat kedua tangan di atas kepala | lompat (juga untuk "main lagi") |
| Jongkok / turunkan bahu | merunduk |
| Keyboard ← → ↑ ↓ / WASD, geser di layar sentuh | mode tanpa kamera |
| Esc / P | jeda |

Teknologi: [Three.js](https://threejs.org) — dunia kartun prosedural (tanpa file model): toon shading 3 tingkat, garis tepi *inverted hull*, bayangan lembut, Bolu si kue bolu bertopping krim & ceri dengan animasi lari/lompat/merunduk/kedip/pusing, rumah jamur, pagar, peti, gapura bendera. Tiap properti digabung jadi 1 geometri ber-vertex-color supaya ringan di HP. + [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) (deteksi pose di perangkat, model *lite* ±3 MB). Suara disintesis dengan WebAudio — tidak ada file audio. Semua pemrosesan terjadi di browser; video tidak pernah dikirim ke server.

## Jalankan lokal

```bash
python3 -m http.server 8080   # buka http://localhost:8080
```

Kamera butuh HTTPS atau `localhost`.

## Struktur

- `index.html` — layar awal, kalibrasi, jeda, akhir; HUD
- `style.css` — tema ceria (Fredoka, kartu bulat, tombol tebal)
- `main.js` — scene, pose → input, alur permainan, tabrakan
- `bolu.js` — model & animasi prosedural Bolu
- `world.js` — langit, tanah, pemandangan, rintangan, bintang, debu
- `look.js` — material toon, garis tepi, penggabung geometri
- `audio.js` — efek suara sintetis (koin, lompat, nabrak, sorak)

## Cara kerja pose → input

Titik bahu (11/12) untuk condong & merunduk, pergelangan (15/16) vs hidung (0) untuk "tangan ke atas". Kalibrasi 3 detik mengambil postur netral; ambang + histeresis supaya tidak gemetar. Ubah `T` (condong) dan `.11` (merunduk) di `readPose()` bila terlalu sensitif.

## Lisensi

MIT.
