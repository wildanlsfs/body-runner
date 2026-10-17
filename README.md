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
- **Mode kamera tetap kencang tapi memberi waktu**: kecepatan 13→20 m/dtk (keyboard 12→26), dan jarak antar-baris rintangan dihitung dari *waktu*, bukan meter: ±2,1 dtk di awal → ±1,55 dtk di kecepatan maks (+0–0,4 dtk acak). Badan butuh waktu untuk condong/lompat/jongkok lalu kembali tegak; lari yang pelan justru membosankan. Melayang ±0,9 dtk supaya jeda deteksi kamera tetap tertutup.
- **Kunci pemain:** kamera mendeteksi sampai 3 orang, tapi hanya orang yang dikunci saat kalibrasi (paling dekat & di tengah) yang menggerakkan Bolu. Orang yang lewat diabaikan. Kalau pemain hilang lebih dari 1,5 detik, game dijeda.
- Resolusi turun otomatis kalau perangkat tidak sanggup ±50 fps.

## Lemari Bolu & power-up

- **Bintang** yang dikumpulkan masuk dompet (disimpan di browser). Ada **13 skin**: 8 dibeli dengan harga bertahap (⭐ 150–2.200), 5 hanya terbuka lewat Level Bolu (Blueberry Lv 5, Matcha Lv 10, Galaksi Lv 15, Juara Lv 20, Legenda Lv 30). Ada juga **10 jejak** (emoji yang beterbangan di belakang Bolu), sebagian dibeli dan sebagian dari level. Semua bisa dicoba dulu sebelum dibeli. Tidak ada pembelian dengan uang sungguhan dan tidak ada undian.
- **Power-up** di jalan: 🧲 Magnet (bintang tertarik), 🛡️ Perisai (kebal 1× tabrakan), ✨ Bintang ×2.
- **Upgrade** memperpanjang durasi tiap power-up (5 level, ⭐ 100–800).

## Progres jangka panjang (`progress.js`)

Tujuannya membuat anak ingin **kembali setiap hari**, bukan main tanpa henti.

- **Misi harian**: 3 misi gerak per hari (mis. lompat 30×, merunduk 25×, lari total 2.200 m, menukik 6×), berganti tiap tengah malam. Hadiahnya ⭐ 50–120 per misi, ditambah bonus kalau ketiganya selesai. Kesulitan naik mengikuti level. Tidak ada hukuman kalau terlewat.
- **Level Bolu 1–30**: XP dari jarak, lompatan, rundukan, dan bintang. Kurva levelnya melengkung (awal cepat, makin tinggi makin menantang): sekitar 170 putaran menuju Level 30. Tiap naik level dapat ⭐, dan level tertentu membuka skin/jejak khusus. Hadiah level berikutnya selalu terlihat di layar awal.
- **Prestasi** 🥉🥈🥇: Pelari (total km), Pelompat, Si Gesit, Kolektor, Rajin Bergerak (total *hari* bermain, bukan beruntun), Penakluk Misi, Juara Skor, dan Fashionista.
- **Pengingat sehat**: setelah 20 menit bergerak dalam satu sesi, layar akhir menyarankan istirahat dan minum air.
- Sengaja **tidak ada** undian/gacha, hadiah acak berbayar, hitung mundur penawaran, atau streak yang bisa hilang (pola-pola yang menekan anak).

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
- `skins.js` — daftar skin, jejak, power-up, harga upgrade, simpanan progres
- `progress.js` — misi harian, Level Bolu, prestasi
- `audio.js` — efek suara sintetis (koin, lompat, nabrak, sorak)

## Cara kerja pose → input

Titik bahu (11/12) untuk condong, lompat (bahu naik), dan merunduk (bahu turun); pergelangan (15/16) vs hidung (0) untuk "tangan ke atas". Kalibrasi 3 detik mengambil postur netral dan lebar bahu. Semua ambang dihitung relatif terhadap lebar bahu, jadi kepekaannya sama baik dekat maupun jauh dari kamera. Setelah lompat, merunduk diabaikan 0,7 detik supaya lutut yang menekuk saat mendarat tidak terbaca sebagai jongkok. Atur kepekaan lewat faktor `leanT` / `jumpT` / `duckT` di `applyPose()`.

## Lisensi

MIT.
