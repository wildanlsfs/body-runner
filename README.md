# Bolu Lari! 🏃

Game lari 3D **ramah anak** di browser yang dikendalikan **gerakan badan lewat webcam** — tanpa install, tanpa build, jalan langsung dari GitHub Pages.

**Main:** https://wildanlsfs.github.io/body-runner/

| Gerakan | Aksi |
|---|---|
| Condong kiri / kanan | belok jalur |
| **Lompat sungguhan** atau angkat kedua tangan | lompat (juga untuk "main lagi") |
| Jongkok / turunkan bahu | merunduk |
| Keyboard ← → ↑ ↓ / WASD, geser di layar sentuh | mode tanpa kamera |
| Esc / P | jeda |

Teknologi: [Three.js](https://threejs.org) — dunia kartun prosedural (tanpa file model): toon shading 3 tingkat, garis tepi *inverted hull*, bayangan lembut, Bolu si kue bolu bertopping krim & ceri dengan animasi lari/lompat/merunduk/kedip/pusing, rumah jamur, pagar, peti, gapura bendera. Tiap properti digabung jadi 1 geometri ber-vertex-color supaya ringan di HP. + [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) (deteksi pose di perangkat, model *lite* ±3 MB). Suara disintesis dengan WebAudio — tidak ada file audio. Semua pemrosesan terjadi di browser; video tidak pernah dikirim ke server.

## Mekanik

- Dari jongkok bisa langsung lompat. Merunduk saat di udara membuat Bolu menukik turun lalu langsung jongkok begitu mendarat.
- **Mode kamera lebih santai** dari mode keyboard (kecepatan 8→15 vs 12→26, jarak antar-rintangan 28 m vs 18 m, melayang ±1 dtk), karena gerakan badan lebih lambat dari tombol.
- **Kunci pemain:** kamera mendeteksi sampai 3 orang, tapi hanya orang yang dikunci saat kalibrasi (paling dekat & di tengah) yang menggerakkan Bolu. Orang yang lewat diabaikan. Kalau pemain hilang lebih dari 1,5 detik, game dijeda.
- Resolusi turun otomatis kalau perangkat tidak sanggup ±50 fps.

## Lemari Bolu & power-up

- **Bintang** yang dikumpulkan masuk dompet (disimpan di browser) untuk membuka **7 skin**: Stroberi, Cokelat, Pandan, Ubi Ungu, Keju, Pelangi, dan Juara (khusus: capai skor 1000). Skin bisa dicoba dulu sebelum dibeli. Tidak ada pembelian dengan uang sungguhan dan tidak ada undian.
- **Power-up** di jalan: 🧲 Magnet (bintang tertarik), 🛡️ Perisai (kebal 1× tabrakan), ✨ Bintang ×2.
- **Upgrade** memperpanjang durasi tiap power-up (3 level).

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
- `look.js` — material toon, garis tepi, penggabung geometri, shader dunia melengkung
- `skins.js` — daftar skin, power-up, harga upgrade, simpanan progres
- `audio.js` — efek suara sintetis (koin, lompat, nabrak, sorak)

## Cara kerja pose → input

Titik bahu (11/12) untuk condong, lompat (bahu naik), dan merunduk (bahu turun); pergelangan (15/16) vs hidung (0) untuk "tangan ke atas". Kalibrasi 3 detik mengambil postur netral dan lebar bahu. Semua ambang dihitung relatif terhadap lebar bahu, jadi kepekaannya sama baik dekat maupun jauh dari kamera. Setelah lompat, merunduk diabaikan 0,7 detik supaya lutut yang menekuk saat mendarat tidak terbaca sebagai jongkok. Atur kepekaan lewat faktor `leanT` / `jumpT` / `duckT` di `applyPose()`.

## Lisensi

MIT.
