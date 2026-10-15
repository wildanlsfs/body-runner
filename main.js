import * as THREE from 'three';
import { sfx, unlock, setMuted, isMuted } from './audio.js';
import { createBolu } from './bolu.js';
import { curve, curved } from './look.js';
import { SKY_HORIZON, addSky, addGround, makeScenery, makeClouds, makeObstacles, makeCoins, makeDust, makePowerUps, makeShieldBubble } from './world.js';
import { SKINS, TOPPER_ICON, POWERS, UP_PRICES, powerDuration, save, persist, skinById, isOwned } from './skins.js';

// ---------------------------------------------------------------------------
// Konstanta
// ---------------------------------------------------------------------------
const LANE_X = [-2.3, 0, 2.3];
const PLAYER_Z = 0;
const SPAWN_Z = -95;
const BASE_SPEED = 12, MAX_SPEED = 26;
const GRAVITY = -30, JUMP_V = 11;
const SLIDE_TIME = 0.8;
const GAP_MIN = 18;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const $ = (id) => document.getElementById(id);
const ui = {
  start: $('start'), calib: $('calib'), over: $('over'), pause: $('pause'), hud: $('hud'), cam: $('cam'), shop: $('shop'),
  score: $('score'), coins: $('coins'), dist: $('dist'), best: $('best'), gesture: $('gesture'), toast: $('toast'), powers: $('powers'),
  final: $('final'), finalBest: $('final-best'), overTitle: $('over-title'), stars: $('stars'), earned: $('earned'), unlockHint: $('unlock-hint'),
  calibCount: $('calib-count'), calibBar: $('calib-bar'), calibHint: $('calib-hint'),
  camStatus: $('cam-status'), video: $('video'), poseCanvas: $('pose'), mute: $('btn-mute'),
  skinList: $('skin-list'), upList: $('up-list'), shopDone: $('btn-shop-done'),
};

// ---------------------------------------------------------------------------
// Scene: dunia kartun (toon shading + garis tepi + bayangan)
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_HORIZON);
scene.fog = new THREE.Fog(SKY_HORIZON, 45, 260);

// Kamera: pose "main" (di belakang Bolu) dan pose "lemari" (dekat, Bolu menghadap kamera).
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
const cam = { play: new THREE.Vector3(), playLook: new THREE.Vector3(), shop: new THREE.Vector3(), shopLook: new THREE.Vector3(), blend: 0, look: new THREE.Vector3() };
// Layar tegak (HP): mundurkan kamera & lebarkan FOV supaya ketiga jalur tetap terlihat
function fitCamera() {
  const a = innerWidth / innerHeight, portrait = clamp((1.2 - a) / .7, 0, 1);
  camera.aspect = a; camera.fov = 55 + portrait * 17; camera.updateProjectionMatrix();
  cam.play.set(0, 3.3 + portrait * 1.2, 7.2 + portrait * 2.6); cam.playLook.set(0, 1.3, -10);
  // lemari: di layar lebar panel ada di kanan → Bolu digeser ke kiri; di HP panel di bawah → Bolu di atas
  const side = portrait > .5 ? 0 : 1.15;
  cam.shop.set(side, 1.9, 4.5 + portrait * 1.6); cam.shopLook.set(side, 1.0 - portrait * 1.6, 0);
  curve.uCurve.value = .0016 * (1 - portrait * .4); // kamera lebih mundur → lengkung dikurangi agar jarak pandang sama
}
fitCamera();
camera.position.copy(cam.play);

addSky(scene);
const ground = addGround(scene);
const scenery = makeScenery(scene);
const clouds = makeClouds(scene);
const dust = makeDust(scene);

// Bolu — maskot kue bolu (lihat bolu.js); bisa ganti skin
const shieldBubble = makeShieldBubble();
let bolu = null, player = null;
function setSkin(id) {
  const pos = player ? player.position.clone() : new THREE.Vector3(0, 0, PLAYER_Z);
  if (bolu) { scene.remove(player); player.remove(shieldBubble); bolu.dispose(); }
  bolu = createBolu(skinById(id));
  player = bolu.root;
  player.traverse((o) => { if (o.isMesh && o.material.isMeshToonMaterial) o.castShadow = true; });
  player.position.copy(pos); player.add(shieldBubble); scene.add(player);
}
setSkin(save.skin);

// Rintangan (tumpukan peti / batu, batang kayu, gapura bendera), bintang & power-up — pool
const obstacles = makeObstacles(scene);
const coins = makeCoins(scene);
const powerUps = makePowerUps(scene);

// Konfeti saat ambil bintang / rekor
const confetti = [];
{
  const geo = new THREE.PlaneGeometry(.16, .22);
  const mats = ['#ff8fab', '#ffd166', '#5bd77a', '#5ec8ff', '#ff9f43'].map((c) => curved(new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })));
  for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(geo, mats[i % 5]); m.visible = false; scene.add(m); confetti.push({ mesh: m, v: new THREE.Vector3(), life: 0 }); }
}
function burst(x, y, z, n = 14) {
  if (REDUCED) return;
  let k = 0;
  for (const c of confetti) { if (c.life > 0) continue; c.life = .9; c.mesh.visible = true; c.mesh.position.set(x, y, z); c.v.set((Math.random() - .5) * 6, 3 + Math.random() * 4, (Math.random() - .5) * 4); c.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0); if (++k >= n) break; }
}

// ---------------------------------------------------------------------------
// State & input
// ---------------------------------------------------------------------------
const state = {
  mode: 'start', speed: BASE_SPEED, dist: 0, score: 0, coinsTaken: 0, targetLane: 1,
  vy: 0, y: 0, jumping: false, slide: 0, sliding: false, nextSpawnZ: SPAWN_Z, elapsed: 0, nextMilestone: 100,
  pw: { magnet: 0, shield: 0, double: 0 }, invuln: 0, overT: 0, shopFrom: 'start',
  best: Number((() => { try { return localStorage.getItem('bolu.best') || 0; } catch { return 0; } })()),
};
ui.best.textContent = state.best;
const input = { lane: 1, jump: false, duck: false, handsUp: false, source: 'keyboard' };

addEventListener('keydown', (e) => {
  if (e.repeat || state.mode === 'shop') return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
  if (e.key === 'ArrowLeft' || e.key === 'a') input.lane = Math.max(0, input.lane - 1);
  if (e.key === 'ArrowRight' || e.key === 'd') input.lane = Math.min(2, input.lane + 1);
  if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') { input.jump = true; input.handsUp = true; }
  if (e.key === 'ArrowDown' || e.key === 's') input.duck = true;
  if (e.key === 'Escape' || e.key === 'p') togglePause();
});
addEventListener('keyup', (e) => {
  if (e.key === 'ArrowDown' || e.key === 's') input.duck = false;
  if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') input.handsUp = false;
});
// Sentuh: geser kiri/kanan/atas/bawah
let touchStart = null;
addEventListener('touchstart', (e) => { if (e.target.closest('.overlay, button, #shop')) return; const t = e.touches[0]; touchStart = [t.clientX, t.clientY]; }, { passive: true });
addEventListener('touchend', (e) => {
  if (!touchStart) return; const t = e.changedTouches[0]; const dx = t.clientX - touchStart[0], dy = t.clientY - touchStart[1]; touchStart = null;
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) input.lane = Math.max(0, Math.min(2, input.lane + (dx > 0 ? 1 : -1)));
  else if (dy < 0) input.jump = true; else { input.duck = true; setTimeout(() => (input.duck = false), 500); }
}, { passive: true });

// ---------------------------------------------------------------------------
// Kamera + MediaPipe Pose
// ---------------------------------------------------------------------------
let landmarker = null, lastVideoTime = -1;
const pose = { ok: false, midX: .5, shoulderY: .5, sw: .2, handsUp: false, baseX: .5, baseY: .5, baseSW: .2, samples: [], armed: true, noDuckUntil: 0, jumpFlash: 0 };
const pctx = ui.poseCanvas.getContext('2d');

async function startCamera() {
  ui.camStatus.textContent = 'memuat…';
  const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14');
  const files = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  landmarker = await vision.PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate: 'GPU' },
    runningMode: 'VIDEO', numPoses: 1,
  });
  ui.camStatus.textContent = 'izinkan kamera ya…';
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
  ui.video.srcObject = stream; await ui.video.play();
  ui.poseCanvas.width = ui.video.videoWidth || 640; ui.poseCanvas.height = ui.video.videoHeight || 480;
  ui.camStatus.textContent = 'kamera aktif'; input.source = 'pose';
}

function setPoseFrom(lm) {
  const nose = lm[0], ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
  pose.midX = (ls.x + rs.x) / 2; pose.shoulderY = (ls.y + rs.y) / 2;
  pose.sw = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  pose.handsUp = lw.y < nose.y && rw.y < nose.y;
}

function readPose(now) {
  if (!landmarker || ui.video.readyState < 2 || ui.video.currentTime === lastVideoTime) return;
  lastVideoTime = ui.video.currentTime;
  const res = landmarker.detectForVideo(ui.video, now);
  const lm = res.landmarks && res.landmarks[0];
  pctx.clearRect(0, 0, ui.poseCanvas.width, ui.poseCanvas.height);
  if (!lm) { pose.ok = false; ui.camStatus.textContent = 'Bolu nggak lihat kamu 👀'; return; }
  pose.ok = true;
  setPoseFrom(lm);

  const W = ui.poseCanvas.width, H = ui.poseCanvas.height;
  pctx.lineWidth = 4; pctx.strokeStyle = pose.jumpFlash > now ? '#ffd166' : '#5bd77a'; pctx.lineCap = 'round';
  const seg = (a, b) => { pctx.beginPath(); pctx.moveTo(lm[a].x * W, lm[a].y * H); pctx.lineTo(lm[b].x * W, lm[b].y * H); pctx.stroke(); };
  [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]].forEach(([a, b]) => seg(a, b));
  pctx.fillStyle = '#ffd166';
  [0, 11, 12, 15, 16, 23, 24].forEach((i) => { pctx.beginPath(); pctx.arc(lm[i].x * W, lm[i].y * H, 6, 0, Math.PI * 2); pctx.fill(); });
  applyPose(now);
}

/** Ubah pose terkini (pose.midX/shoulderY/sw/handsUp) menjadi input game. */
function applyPose(now) {
  if (state.mode === 'calib') { pose.samples.push([pose.midX, pose.shoulderY, pose.sw]); return; }
  if (input.source !== 'pose') return;

  // Ambang relatif terhadap lebar bahu saat kalibrasi → sama peka dekat maupun jauh dari kamera.
  const S = pose.baseSW;
  const leanT = clamp(S * .32, .045, .09), leanH = leanT * .45;
  const jumpT = clamp(S * .2, .03, .07);     // badan naik (lompat sungguhan)
  const duckT = clamp(S * .5, .07, .16);     // bahu turun (jongkok)

  // Kamera menghadap pemain: condong ke KIRI pemain → x membesar di citra.
  const dx = pose.midX - pose.baseX;
  if (dx > leanT) input.lane = 0; else if (dx < -leanT) input.lane = 2; else if (Math.abs(dx) < leanT - leanH) input.lane = 1;

  // y citra mengecil saat badan naik
  const up = pose.baseY - pose.shoulderY;
  if (!pose.armed && up < jumpT * .4) pose.armed = true;                 // sudah turun lagi → siap lompat lagi
  let jumped = false;
  if (pose.armed && up > jumpT) { jumped = true; pose.armed = false; pose.noDuckUntil = now + 700; pose.jumpFlash = now + 300; }
  input.duck = now > pose.noDuckUntil && -up > duckT;                     // abaikan tekukan lutut saat mendarat
  if (jumped || (pose.handsUp && !input.handsUp)) input.jump = true;
  input.handsUp = pose.handsUp;
  // posisi netral pelan-pelan menyesuaikan kalau pemain bergeser maju/mundur
  if (Math.abs(up) < jumpT * .5) pose.baseY += (pose.shoulderY - pose.baseY) * .01;

  ui.camStatus.textContent = jumped ? 'lompat! 🦘' : input.duck ? 'merunduk 🙇' : pose.handsUp ? 'tangan ke atas 🙌' : ['condong kiri ⬅️', 'tegak 🙂', 'condong kanan ➡️'][input.lane];
}

// ---------------------------------------------------------------------------
// Alur
// ---------------------------------------------------------------------------
const show = (el, on) => { el.hidden = !on; };
let toastTimer = 0;
function toast(msg, ms = 1100) { ui.toast.textContent = msg; ui.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms); }
function refreshWallet() { document.querySelectorAll('.wallet-n').forEach((el) => (el.textContent = save.wallet)); }
refreshWallet();

function resetRun() {
  Object.assign(state, { speed: BASE_SPEED, dist: 0, score: 0, coinsTaken: 0, targetLane: 1, vy: 0, y: 0, jumping: false, slide: 0, sliding: false, nextSpawnZ: SPAWN_Z, elapsed: 0, nextMilestone: 100, invuln: 0 });
  state.pw = { magnet: 0, shield: 0, double: 0 };
  input.lane = 1; input.jump = false; input.duck = false;
  obstacles.forEach((o) => { o.active = false; o.mesh.visible = false; });
  coins.forEach((c) => { c.active = false; c.mesh.visible = false; });
  powerUps.forEach((p) => { p.active = false; p.mesh.visible = false; });
  player.position.set(0, 0, PLAYER_Z); bolu.setMood('happy');
  renderPowers();
}
function beginPlay() { resetRun(); state.mode = 'play'; show(ui.hud, true); show(ui.over, false); show(ui.calib, false); show(ui.pause, false); show(ui.start, false); sfx.start(); toast('Ayo lari! 🏃'); }

let calibStart = 0;
function beginCalib() { state.mode = 'calib'; pose.samples = []; calibStart = performance.now(); show(ui.start, false); show(ui.calib, true); show(ui.cam, true); }
function tickCalib(now) {
  const t = (now - calibStart) / 1000;
  const n = Math.max(0, Math.ceil(3 - t));
  if (ui.calibCount.textContent !== String(n)) { ui.calibCount.textContent = n; sfx.tick(); }
  ui.calibBar.style.width = `${Math.min(100, t / 3 * 100)}%`;
  ui.calibHint.textContent = pose.ok ? 'Mantap, Bolu lihat kamu! 👍' : 'Berdiri di depan kamera, kepala sampai pinggang terlihat.';
  if (t >= 3) {
    if (pose.samples.length > 10) {
      const k = pose.samples.length, avg = (i) => pose.samples.reduce((s, p) => s + p[i], 0) / k;
      pose.baseX = avg(0); pose.baseY = avg(1); pose.baseSW = avg(2); pose.armed = true;
      beginPlay();
    } else { calibStart = now; pose.samples = []; }
  }
}

function gameOver() {
  state.mode = 'over'; state.overT = 0; sfx.bump(); bolu.setMood('dizzy'); dust.puff(player.position.x, PLAYER_Z - .6, 8, .8);
  state.pw = { magnet: 0, shield: 0, double: 0 }; renderPowers();
  const record = state.score > state.best;
  if (record) { state.best = state.score; try { localStorage.setItem('bolu.best', String(state.best)); } catch {} }
  // bintang masuk dompet; cek skin yang baru bisa dibuka
  save.wallet += state.coinsTaken; save.bestRun = Math.max(save.bestRun, state.score); persist();
  const goalUnlocked = SKINS.find((s) => s.goal && isOwned(s) && !save.owned.includes(s.id));
  if (goalUnlocked) { save.owned.push(goalUnlocked.id); persist(); }
  const affordable = SKINS.find((s) => !isOwned(s) && s.price && s.price <= save.wallet);
  ui.unlockHint.hidden = !goalUnlocked && !affordable;
  ui.unlockHint.textContent = goalUnlocked ? `Skin ${goalUnlocked.name} ${TOPPER_ICON[goalUnlocked.topper]} terbuka! Coba di Lemari.` : affordable ? `Bintangmu cukup untuk skin ${affordable.name} ${TOPPER_ICON[affordable.topper]}!` : '';
  ui.earned.textContent = state.coinsTaken; refreshWallet();

  ui.final.textContent = state.score; ui.finalBest.textContent = state.best; ui.best.textContent = state.best;
  const s = state.score; const n = s >= 600 ? 3 : s >= 250 ? 2 : s >= 80 ? 1 : 0;
  ui.stars.textContent = '★'.repeat(n) + '☆'.repeat(3 - n);
  ui.overTitle.textContent = record && s > 0 ? 'Rekor baru! 🎉' : n === 3 ? 'Keren banget! 🌟' : n >= 1 ? 'Hebat, coba lagi! 💪' : 'Aduh, nabrak! 😅';
  if (record && s > 0) { sfx.cheer(); burst(player.position.x, 2, 0, 40); }
  show(ui.over, true);
}

function togglePause() {
  if (state.mode === 'play') { state.mode = 'pause'; show(ui.pause, true); }
  else if (state.mode === 'pause') { state.mode = 'play'; show(ui.pause, false); last = performance.now(); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden && state.mode === 'play') togglePause(); });

// ---------------------------------------------------------------------------
// Power-up
// ---------------------------------------------------------------------------
let powersKey = '';
function renderPowers() {
  const active = Object.keys(state.pw).filter((k) => state.pw[k] > 0);
  const key = active.join();
  if (key !== powersKey) {
    powersKey = key;
    ui.powers.innerHTML = active.map((k) => `<div class="pw ${k}" data-k="${k}">${POWERS[k].icon} ${POWERS[k].name}<i></i></div>`).join('');
  }
  for (const el of ui.powers.children) { const k = el.dataset.k; el.lastChild.style.width = `${(state.pw[k] / powerDuration(save.up[k])) * 100}%`; }
  shieldBubble.visible = state.pw.shield > 0;
}
function grantPower(type) {
  state.pw[type] = powerDuration(save.up[type]);
  sfx.power(); toast(`${POWERS[type].icon} ${POWERS[type].name}!`); burst(player.position.x, 1.6, 0, 12);
  renderPowers();
}

// Spawner: selalu menyisakan jalan keluar
function spawnRow(z) {
  const r = Math.random();
  if (r < .45) { const n = Math.random() < .35 ? 2 : 1; [0, 1, 2].sort(() => Math.random() - .5).slice(0, n).forEach((lane) => placeObstacle('wall', lane, z)); }
  else if (r < .7) placeObstacle('low', 1, z);
  else if (r < .9) placeObstacle('high', 1, z);
  else { const lane = Math.floor(Math.random() * 3); for (let i = 0; i < 5; i++) placeCoin(lane, z - i * 1.7); return; }
  // di antara baris rintangan: kadang power-up, lebih sering deretan bintang
  if (state.elapsed > 5 && Math.random() < .13 && !powerUps.some((p) => p.active)) {
    const free = powerUps.filter((p) => state.pw[p.type] <= 0);
    if (free.length) { const p = free[Math.floor(Math.random() * free.length)]; p.active = true; p.mesh.visible = true; p.mesh.position.set(LANE_X[Math.floor(Math.random() * 3)], 1.25, z - 9); return; }
  }
  if (Math.random() < .65) { const lane = Math.floor(Math.random() * 3); for (let i = 0; i < 4; i++) placeCoin(lane, z - 8 - i * 1.7); }
}
function placeObstacle(type, lane, z) {
  const o = obstacles.find((x) => !x.active && x.type === type); if (!o) return;
  o.active = true; o.lane = lane; o.mesh.visible = true;
  o.mesh.position.set(type === 'wall' ? LANE_X[lane] : 0, 0, z);
}
function placeCoin(lane, z) { const c = coins.find((x) => !x.active); if (!c) return; c.active = true; c.mesh.visible = true; c.mesh.position.set(LANE_X[lane], 1.1, z); }

function tickPlay(dt) {
  state.elapsed += dt;
  state.speed = Math.min(MAX_SPEED, BASE_SPEED + state.elapsed * .3);
  const dz = state.speed * dt; state.dist += dz;

  if (input.lane !== state.targetLane) { state.targetLane = input.lane; sfx.lane(); }
  player.position.x += (LANE_X[state.targetLane] - player.position.x) * Math.min(1, dt * 11);

  if (input.jump && !state.jumping && state.slide <= 0) { state.vy = JUMP_V; state.jumping = true; sfx.jump(); }
  input.jump = false;
  if (state.jumping) {
    state.vy += GRAVITY * dt; state.y += state.vy * dt;
    if (state.y <= 0) { state.y = 0; state.jumping = false; state.vy = 0; dust.puff(player.position.x, PLAYER_Z, 6, .6); }
  }
  if (input.duck && !state.jumping && state.slide <= 0) { state.slide = SLIDE_TIME; sfx.duck(); }
  if (state.slide > 0) state.slide -= dt;
  const sliding = state.slide > 0 || (input.duck && !state.jumping);
  state.sliding = sliding;
  player.position.y = state.y;

  for (const k in state.pw) if (state.pw[k] > 0) { state.pw[k] = Math.max(0, state.pw[k] - dt); if (state.pw[k] === 0 && k === 'shield') toast('Perisai habis'); }
  state.invuln = Math.max(0, state.invuln - dt);
  renderPowers();
  shieldBubble.scale.setScalar(1 + Math.sin(state.elapsed * 6) * .03);
  shieldBubble.material.opacity = state.pw.shield > 0 && state.pw.shield < 2 ? (Math.sin(state.elapsed * 20) > 0 ? .38 : .12) : .38; // berkedip saat hampir habis

  ground.scroll(dz);
  // jalan pelan-pelan tampak berbelok kiri-kanan (visual saja; jalur permainan tetap lurus)
  curve.uBendX.value = Math.sin(state.dist * .016) * .0012;
  scenery.scroll(dz);
  clouds.scroll(dz, dt);
  state.nextSpawnZ += dz;
  if (state.nextSpawnZ > SPAWN_Z + GAP_MIN + Math.random() * 10) { spawnRow(SPAWN_Z); state.nextSpawnZ = SPAWN_Z; }

  const px = player.position.x, pyTop = state.y + (sliding ? 1.0 : 1.9);
  for (const o of obstacles) {
    if (!o.active) continue;
    o.mesh.position.z += dz;
    if (o.mesh.position.z > 9) { o.active = false; o.mesh.visible = false; continue; }
    if (Math.abs(o.mesh.position.z - PLAYER_Z) < .8 && state.invuln <= 0) {
      let hit = false;
      if (o.type === 'wall') hit = Math.abs(px - LANE_X[o.lane]) < 1.2 && state.y < 2.2;
      else if (o.type === 'low') hit = state.y < .6;
      else if (o.type === 'high') hit = pyTop > 1.65;
      if (hit && state.pw.shield > 0) { // perisai pecah, rintangan terpental
        state.pw.shield = 0; state.invuln = .6; o.active = false; o.mesh.visible = false;
        sfx.shieldPop(); burst(o.type === 'wall' ? LANE_X[o.lane] : px, 1.2, PLAYER_Z - .5, 24); dust.puff(px, PLAYER_Z - .8, 8, 1.2); toast('Perisai menyelamatkanmu! 🛡️');
        renderPowers(); continue;
      }
      if (hit) { gameOver(); return; }
    }
  }
  const magnet = state.pw.magnet > 0, value = state.pw.double > 0 ? 2 : 1;
  for (const c of coins) {
    if (!c.active) continue;
    const p = c.mesh.position;
    p.z += dz; c.mesh.rotation.y += dt * 3;
    if (magnet && p.z > -22) { const k = Math.min(1, dt * 7); p.x += (px - p.x) * k; p.y += (state.y + 1.1 - p.y) * k; if (p.z < PLAYER_Z) p.z += (PLAYER_Z - p.z) * Math.min(1, dt * 3); }
    else p.y = 1.15 + Math.sin(state.elapsed * 5 + p.z * .4) * .12;
    if (p.z > 9) { c.active = false; c.mesh.visible = false; continue; }
    if (Math.abs(p.z - PLAYER_Z) < .9 && Math.abs(px - p.x) < .95 && Math.abs(p.y - (state.y + 1.1)) < 1.4) {
      c.active = false; c.mesh.visible = false; state.coinsTaken += value; sfx.coin(); burst(p.x, 1.2, 0, value > 1 ? 12 : 8);
      ui.coins.parentElement.classList.add('pulse'); setTimeout(() => ui.coins.parentElement.classList.remove('pulse'), 150);
    }
  }
  for (const pu of powerUps) {
    if (!pu.active) continue;
    const p = pu.mesh.position;
    p.z += dz; p.y = 1.3 + Math.sin(state.elapsed * 4) * .15;
    if (p.z > 9) { pu.active = false; pu.mesh.visible = false; continue; }
    if (Math.abs(p.z - PLAYER_Z) < 1 && Math.abs(px - p.x) < 1.1 && state.y < 2.6) { pu.active = false; pu.mesh.visible = false; grantPower(pu.type); }
  }
  for (const c of confetti) {
    if (c.life <= 0) continue; c.life -= dt; c.v.y += GRAVITY * .35 * dt;
    c.mesh.position.addScaledVector(c.v, dt); c.mesh.position.z += dz * .5; c.mesh.rotation.x += dt * 8; c.mesh.rotation.y += dt * 6;
    if (c.life <= 0) c.mesh.visible = false;
  }

  state.score = Math.floor(state.dist / 2) + state.coinsTaken * 10;
  if (state.score >= state.nextMilestone) { toast(['Hebat! 🌟', 'Wow, terus! 🚀', 'Juara! 🏆'][Math.floor(Math.random() * 3)]); state.nextMilestone += 150; }
  ui.score.textContent = state.score; ui.dist.textContent = Math.floor(state.dist); ui.coins.textContent = state.coinsTaken;
  ui.gesture.textContent = sliding ? '🙇 MERUNDUK' : state.jumping ? '🦘 LOMPAT' : ['⬅️ KIRI', '🙂 TENGAH', '➡️ KANAN'][state.targetLane];
}

// ---------------------------------------------------------------------------
// Lemari Bolu: skin & upgrade
// ---------------------------------------------------------------------------
let preview = save.skin, shopTab = 'skins';
function openShop() {
  state.shopFrom = state.mode === 'over' ? 'over' : 'start';
  state.mode = 'shop'; preview = save.skin;
  show(ui.start, false); show(ui.over, false); show(ui.hud, false); show(ui.shop, true);
  bolu.setMood('happy'); player.position.set(0, 0, PLAYER_Z); state.y = 0; state.jumping = false;
  renderShop();
}
function closeShop() {
  if (preview !== save.skin) setSkin(save.skin);
  show(ui.shop, false);
  state.mode = state.shopFrom;
  if (state.shopFrom === 'over') { show(ui.over, true); show(ui.hud, true); refreshWallet(); ui.unlockHint.hidden = true; } else show(ui.start, true);
}
function renderShop() {
  refreshWallet();
  show(ui.skinList, shopTab === 'skins'); show(ui.upList, shopTab === 'ups');
  $('btn-shop-close').addEventListener('click', closeShop);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.mode === 'shop') closeShop(); });
document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === shopTab));
  ui.skinList.innerHTML = SKINS.map((s) => {
    const owned = isOwned(s), equipped = s.id === save.skin;
    const label = equipped ? 'Dipakai ✓' : owned ? 'Pakai' : s.goal ? `Skor ${s.goal}` : `⭐ ${s.price}`;
    const cls = ['skin', s.id === preview ? 'sel' : '', owned ? '' : 'locked', !owned && s.price > save.wallet ? 'cant' : ''].join(' ');
    return `<button class="${cls}" data-id="${s.id}" style="--cream:${s.cream}"><span class="sw" style="background:${s.body}"><em>${TOPPER_ICON[s.topper]}</em></span><b>${s.name}</b><small>${owned ? '' : '🔒 '}${label}</small></button>`;
  }).join('');
  ui.upList.innerHTML = Object.entries(POWERS).map(([k, p]) => {
    const lv = save.up[k], price = UP_PRICES[lv];
    const btn = price == null ? '<button disabled>Maks</button>' : `<button data-up="${k}" ${price > save.wallet ? 'disabled' : ''}>⭐ ${price}</button>`;
    return `<div class="up"><span class="ic">${p.icon}</span><div><b>${p.name} · ${powerDuration(lv)} dtk</b><small>${p.desc}</small><div class="lv">${[0, 1, 2].map((i) => `<span class="${i < lv ? 'on' : ''}"></span>`).join('')}</div></div>${btn}</div>`;
  }).join('');
  // tombol utama: beli skin yang sedang dicoba, atau selesai
  const ps = skinById(preview);
  if (shopTab === 'skins' && !isOwned(ps)) {
    ui.shopDone.textContent = ps.goal ? `Capai skor ${ps.goal} untuk membuka` : ps.price <= save.wallet ? `Beli ${ps.name} · ⭐ ${ps.price}` : `Kurang ⭐ ${ps.price - save.wallet}`;
    ui.shopDone.dataset.buy = ps.goal || ps.price > save.wallet ? '' : ps.id;
    ui.shopDone.disabled = !ui.shopDone.dataset.buy;
  } else { ui.shopDone.textContent = 'Selesai'; ui.shopDone.dataset.buy = ''; ui.shopDone.disabled = false; }
}
ui.skinList.addEventListener('click', (e) => {
  const b = e.target.closest('.skin'); if (!b) return;
  const s = skinById(b.dataset.id);
  if (s.id !== preview) { preview = s.id; setSkin(s.id); burst(0, 1.6, 0, 10); }
  if (isOwned(s) && save.skin !== s.id) { save.skin = s.id; persist(); sfx.coin(); toast(`Bolu ${s.name} ${TOPPER_ICON[s.topper]}`); }
  renderShop();
});
ui.upList.addEventListener('click', (e) => {
  const b = e.target.closest('[data-up]'); if (!b) return;
  const k = b.dataset.up, price = UP_PRICES[save.up[k]];
  if (price == null || price > save.wallet) { sfx.nope(); return; }
  save.wallet -= price; save.up[k]++; persist(); sfx.buy(); toast(`${POWERS[k].icon} ${POWERS[k].name} level ${save.up[k] + 1}!`);
  renderShop();
});
ui.shopDone.addEventListener('click', () => {
  const id = ui.shopDone.dataset.buy;
  if (id) {
    const s = skinById(id);
    save.wallet -= s.price; save.owned.push(id); save.skin = id; persist();
    sfx.buy(); burst(0, 1.8, 0, 40); toast(`Skin ${s.name} jadi milikmu! ${TOPPER_ICON[s.topper]}`, 1600);
    renderShop(); return;
  }
  closeShop();
});
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { shopTab = t.dataset.tab; renderShop(); }));
document.querySelectorAll('.open-shop').forEach((b) => b.addEventListener('click', () => { unlock(); openShop(); }));

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  readPose(now);
  if (state.mode === 'calib') tickCalib(now);
  else if (state.mode === 'play') tickPlay(dt);
  else if (state.mode === 'over') {
    state.overT += dt;
    // lompat/angkat tangan untuk main lagi — beri jeda supaya lompatan yang menabrak tidak langsung memulai ulang
    if (input.jump && state.overT > 1.2) beginPlay();
    input.jump = false;
  } else input.jump = false;
  if (state.mode !== 'pause') {
    const st = state.mode === 'play' ? (state.jumping ? 'air' : state.sliding ? 'slide' : 'run') : state.mode === 'over' ? 'dizzy' : 'idle';
    bolu.update(dt, { state: st, speed: state.speed, vy: state.vy, lean: (LANE_X[state.targetLane] - player.position.x) * .2 });
    dust.update(dt, st === 'run', player.position.x, PLAYER_Z);
    if (state.mode !== 'play') clouds.scroll(0, dt);
    for (const pu of powerUps) if (pu.active) pu.icon.rotation.y += dt * 2.5;
  }
  // kamera: ikuti Bolu saat main, mendekat saat di lemari
  cam.blend += ((state.mode === 'shop' ? 1 : 0) - cam.blend) * Math.min(1, dt * 5);
  const follow = player.position.x * .35 * (1 - cam.blend);
  camera.position.lerpVectors(cam.play, cam.shop, cam.blend); camera.position.x += follow;
  cam.look.lerpVectors(cam.playLook, cam.shopLook, cam.blend); cam.look.x += follow;
  camera.lookAt(cam.look);
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
if (new URLSearchParams(location.search).has('debug')) window.__game = { state, save, grantPower, powerUps, openShop, pose, input, setPoseFrom, applyPose };

addEventListener('resize', () => { fitCamera(); renderer.setSize(innerWidth, innerHeight); });

// Tombol
ui.mute.textContent = isMuted() ? '🔇' : '🔊';
ui.mute.addEventListener('click', () => { setMuted(!isMuted()); ui.mute.textContent = isMuted() ? '🔇' : '🔊'; });
$('btn-start').addEventListener('click', async () => {
  unlock();
  const btn = $('btn-start'); btn.disabled = true; btn.textContent = 'Sebentar ya…';
  try { await startCamera(); beginCalib(); }
  catch (e) {
    btn.disabled = false; btn.textContent = '📷 Nyalakan kamera & main';
    ui.camStatus.textContent = 'kamera gagal';
    toast(e.name === 'NotAllowedError' ? 'Izin kamera ditolak 😢' : 'Kamera tidak bisa dipakai');
    console.warn(e);
  }
});
$('btn-keys').addEventListener('click', () => { unlock(); input.source = 'keyboard'; show(ui.start, false); beginPlay(); });
$('btn-retry').addEventListener('click', () => { unlock(); beginPlay(); });
$('btn-resume').addEventListener('click', togglePause);
