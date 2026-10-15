import * as THREE from 'three';
import { sfx, unlock, setMuted, isMuted } from './audio.js';
import { createBolu } from './bolu.js';
import { curve, curved } from './look.js';
import { SKY_HORIZON, addSky, addGround, makeScenery, makeClouds, makeObstacles, makeCoins, makeDust } from './world.js';

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

const $ = (id) => document.getElementById(id);
const ui = {
  start: $('start'), calib: $('calib'), over: $('over'), pause: $('pause'), hud: $('hud'), cam: $('cam'),
  score: $('score'), dist: $('dist'), best: $('best'), gesture: $('gesture'), toast: $('toast'),
  final: $('final'), finalBest: $('final-best'), overTitle: $('over-title'), stars: $('stars'),
  calibCount: $('calib-count'), calibBar: $('calib-bar'), calibHint: $('calib-hint'),
  camStatus: $('cam-status'), video: $('video'), poseCanvas: $('pose'), mute: $('btn-mute'),
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

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
// Layar tegak (HP): mundurkan kamera & lebarkan FOV supaya ketiga jalur tetap terlihat
function fitCamera() {
  const a = innerWidth / innerHeight, portrait = Math.min(1, Math.max(0, (1.2 - a) / .7));
  camera.aspect = a; camera.fov = 55 + portrait * 17;
  camera.position.set(camera.position.x, 3.3 + portrait * 1.2, 7.2 + portrait * 2.6);
  camera.lookAt(camera.position.x, 1.3, -10); camera.updateProjectionMatrix();
  curve.uCurve.value = .0016 * (1 - portrait * .4); // kamera lebih mundur → lengkung dikurangi agar jarak pandang sama
}
fitCamera();

addSky(scene);
const ground = addGround(scene);
const scenery = makeScenery(scene);
const clouds = makeClouds(scene);
const dust = makeDust(scene);

// Bolu — maskot kue bolu (lihat bolu.js)
const bolu = createBolu();
const player = bolu.root;
player.traverse((o) => { if (o.isMesh && o.material.isMeshToonMaterial) o.castShadow = true; });
player.position.set(0, 0, PLAYER_Z); scene.add(player);

// Rintangan (tumpukan peti / batu, batang kayu, gapura bendera) & bintang — pool
const obstacles = makeObstacles(scene);
const coins = makeCoins(scene);

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
  vy: 0, y: 0, jumping: false, slide: 0, nextSpawnZ: SPAWN_Z, elapsed: 0, nextMilestone: 100, prevMode: 'play',
  best: Number((() => { try { return localStorage.getItem('bolu.best') || 0; } catch { return 0; } })()),
};
ui.best.textContent = state.best;
const input = { lane: 1, jump: false, duck: false, handsUp: false, source: 'keyboard' };

addEventListener('keydown', (e) => {
  if (e.repeat) return;
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
addEventListener('touchstart', (e) => { if (e.target.closest('.overlay, button')) return; const t = e.touches[0]; touchStart = [t.clientX, t.clientY]; }, { passive: true });
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
const pose = { ok: false, midX: .5, shoulderY: .5, handsUp: false, baseX: .5, baseY: .5, samples: [] };
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

function readPose(now) {
  if (!landmarker || ui.video.readyState < 2 || ui.video.currentTime === lastVideoTime) return;
  lastVideoTime = ui.video.currentTime;
  const res = landmarker.detectForVideo(ui.video, now);
  const lm = res.landmarks && res.landmarks[0];
  pctx.clearRect(0, 0, ui.poseCanvas.width, ui.poseCanvas.height);
  if (!lm) { pose.ok = false; ui.camStatus.textContent = 'Bolu nggak lihat kamu 👀'; return; }
  pose.ok = true;
  const nose = lm[0], ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
  pose.midX = (ls.x + rs.x) / 2; pose.shoulderY = (ls.y + rs.y) / 2;
  pose.handsUp = lw.y < nose.y && rw.y < nose.y;

  const W = ui.poseCanvas.width, H = ui.poseCanvas.height;
  pctx.lineWidth = 4; pctx.strokeStyle = '#5bd77a'; pctx.lineCap = 'round';
  const seg = (a, b) => { pctx.beginPath(); pctx.moveTo(lm[a].x * W, lm[a].y * H); pctx.lineTo(lm[b].x * W, lm[b].y * H); pctx.stroke(); };
  [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]].forEach(([a, b]) => seg(a, b));
  pctx.fillStyle = '#ffd166';
  [0, 11, 12, 15, 16, 23, 24].forEach((i) => { pctx.beginPath(); pctx.arc(lm[i].x * W, lm[i].y * H, 6, 0, Math.PI * 2); pctx.fill(); });

  if (state.mode === 'calib') { pose.samples.push([pose.midX, pose.shoulderY]); return; }
  if (input.source !== 'pose') return;

  // Kamera menghadap pemain: condong ke KIRI pemain → x membesar di citra.
  const dx = pose.midX - pose.baseX, T = .065, H2 = .03;
  if (dx > T) input.lane = 0; else if (dx < -T) input.lane = 2; else if (Math.abs(dx) < T - H2) input.lane = 1;
  input.duck = pose.shoulderY - pose.baseY > .11;
  if (pose.handsUp && !input.handsUp) input.jump = true;
  input.handsUp = pose.handsUp;
  ui.camStatus.textContent = input.duck ? 'merunduk 🙇' : pose.handsUp ? 'tangan ke atas 🙌' : ['condong kiri ⬅️', 'tegak 🙂', 'condong kanan ➡️'][input.lane];
}

// ---------------------------------------------------------------------------
// Alur
// ---------------------------------------------------------------------------
const show = (el, on) => { el.hidden = !on; };
let toastTimer = 0;
function toast(msg) { ui.toast.textContent = msg; ui.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1100); }

function resetRun() {
  Object.assign(state, { speed: BASE_SPEED, dist: 0, score: 0, coinsTaken: 0, targetLane: 1, vy: 0, y: 0, jumping: false, slide: 0, sliding: false, nextSpawnZ: SPAWN_Z, elapsed: 0, nextMilestone: 100 });
  input.lane = 1; input.jump = false; input.duck = false;
  obstacles.forEach((o) => { o.active = false; o.mesh.visible = false; });
  coins.forEach((c) => { c.active = false; c.mesh.visible = false; });
  player.position.set(0, 0, PLAYER_Z); bolu.setMood('happy');
}
function beginPlay() { resetRun(); state.mode = 'play'; show(ui.hud, true); show(ui.over, false); show(ui.calib, false); show(ui.pause, false); sfx.start(); toast('Ayo lari! 🏃'); }

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
      const k = pose.samples.length;
      pose.baseX = pose.samples.reduce((s, p) => s + p[0], 0) / k; pose.baseY = pose.samples.reduce((s, p) => s + p[1], 0) / k;
      beginPlay();
    } else { calibStart = now; pose.samples = []; }
  }
}

function gameOver() {
  state.mode = 'over'; sfx.bump(); bolu.setMood('dizzy'); dust.puff(player.position.x, PLAYER_Z - .6, 8, .8);
  const record = state.score > state.best;
  if (record) { state.best = state.score; try { localStorage.setItem('bolu.best', String(state.best)); } catch {} }
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

// Spawner: selalu menyisakan jalan keluar
function spawnRow(z) {
  const r = Math.random();
  if (r < .45) { const n = Math.random() < .35 ? 2 : 1; [0, 1, 2].sort(() => Math.random() - .5).slice(0, n).forEach((lane) => placeObstacle('wall', lane, z)); }
  else if (r < .7) placeObstacle('low', 1, z);
  else if (r < .9) placeObstacle('high', 1, z);
  else { const lane = Math.floor(Math.random() * 3); for (let i = 0; i < 5; i++) placeCoin(lane, z - i * 1.7); return; }
  if (Math.random() < .65) { const lane = Math.floor(Math.random() * 3); for (let i = 0; i < 4; i++) placeCoin(lane, z - 8 - i * 1.7); }
}
function placeObstacle(type, lane, z) {
  const o = obstacles.find((x) => !x.active && x.type === type); if (!o) return;
  o.active = true; o.lane = lane; o.mesh.visible = true;
  o.mesh.position.set(type === 'wall' ? LANE_X[lane] : 0, 0, z);
}
function placeCoin(lane, z) { const c = coins.find((x) => !x.active); if (!c) return; c.active = true; c.mesh.visible = true; c.mesh.position.set(LANE_X[lane], 1.1, z); }

function tickPlay(dt, now) {
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
    if (Math.abs(o.mesh.position.z - PLAYER_Z) < .8) {
      let hit = false;
      if (o.type === 'wall') hit = Math.abs(px - LANE_X[o.lane]) < 1.2 && state.y < 2.2;
      else if (o.type === 'low') hit = state.y < .6;
      else if (o.type === 'high') hit = pyTop > 1.65;
      if (hit) { gameOver(); return; }
    }
  }
  for (const c of coins) {
    if (!c.active) continue;
    c.mesh.position.z += dz; c.mesh.rotation.y += dt * 3; c.mesh.position.y = 1.15 + Math.sin(state.elapsed * 5 + c.mesh.position.z * .4) * .12;
    if (c.mesh.position.z > 9) { c.active = false; c.mesh.visible = false; continue; }
    if (Math.abs(c.mesh.position.z - PLAYER_Z) < .9 && Math.abs(px - c.mesh.position.x) < .95 && state.y < 2.2) {
      c.active = false; c.mesh.visible = false; state.coinsTaken++; sfx.coin(); burst(c.mesh.position.x, 1.2, 0, 8);
      ui.gesture.classList.add('pulse'); setTimeout(() => ui.gesture.classList.remove('pulse'), 150);
    }
  }
  for (const c of confetti) {
    if (c.life <= 0) continue; c.life -= dt; c.v.y += GRAVITY * .35 * dt;
    c.mesh.position.addScaledVector(c.v, dt); c.mesh.position.z += dz * .5; c.mesh.rotation.x += dt * 8; c.mesh.rotation.y += dt * 6;
    if (c.life <= 0) c.mesh.visible = false;
  }

  state.score = Math.floor(state.dist / 2) + state.coinsTaken * 10;
  if (state.score >= state.nextMilestone) { toast(['Hebat! 🌟', 'Wow, terus! 🚀', 'Juara! 🏆'][Math.floor(Math.random() * 3)]); state.nextMilestone += 150; }
  ui.score.textContent = state.score; ui.dist.textContent = Math.floor(state.dist);
  ui.gesture.textContent = sliding ? '🙇 MERUNDUK' : state.jumping ? '🙌 LOMPAT' : ['⬅️ KIRI', '🙂 TENGAH', '➡️ KANAN'][state.targetLane];
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  readPose(now);
  if (state.mode === 'calib') tickCalib(now);
  else if (state.mode === 'play') tickPlay(dt, now);
  else if (state.mode === 'over' && input.jump) { input.jump = false; beginPlay(); }
  else input.jump = false;
  if (state.mode !== 'pause') {
    const st = state.mode === 'play' ? (state.jumping ? 'air' : state.sliding ? 'slide' : 'run') : state.mode === 'over' ? 'dizzy' : 'idle';
    bolu.update(dt, { state: st, speed: state.speed, vy: state.vy, lean: (LANE_X[state.targetLane] - player.position.x) * .2 });
    dust.update(dt, st === 'run', player.position.x, PLAYER_Z);
    if (state.mode !== 'play') clouds.scroll(0, dt);
  }
  camera.position.x += (player.position.x * .35 - camera.position.x) * Math.min(1, dt * 4);
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

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
