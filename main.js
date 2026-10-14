import * as THREE from 'three';
import { sfx, unlock, setMuted, isMuted } from './audio.js';

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
// Scene: siang cerah
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#5ec8ff');
scene.fog = new THREE.Fog('#a8e2ff', 40, 110);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 260);
camera.position.set(0, 3.6, 8);
camera.lookAt(0, 1.4, -12);

scene.add(new THREE.HemisphereLight('#ffffff', '#6fcf6f', 1.15));
const sunLight = new THREE.DirectionalLight('#fff4d6', 1.4);
sunLight.position.set(-8, 14, -6); scene.add(sunLight);

// Matahari + awan gembul
const sunGroup = new THREE.Group();
{
  const disc = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshBasicMaterial({ color: '#ffd166', fog: false }));
  const halo = new THREE.Mesh(new THREE.CircleGeometry(13, 40), new THREE.MeshBasicMaterial({ color: '#fff1b8', fog: false, transparent: true, opacity: .5 }));
  halo.position.z = -0.1; sunGroup.add(halo, disc); sunGroup.position.set(22, 26, -160); scene.add(sunGroup);
}
const clouds = [];
{
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#dff3ff', emissiveIntensity: .5 });
  const puff = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(puff, mat); m.position.set((k - 1.5) * 1.4, (k % 2) * .6, 0); m.scale.setScalar(1.1 + Math.random() * .9); g.add(m); }
    g.position.set((Math.random() - .5) * 120, 14 + Math.random() * 12, -40 - Math.random() * 110);
    g.scale.setScalar(1.6 + Math.random() * 1.4); g.userData.v = .4 + Math.random() * .6;
    scene.add(g); clouds.push(g);
  }
}

// Tanah rumput + jalan tanah pastel
let roadTex;
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#f6d7a8'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#efc98f'; for (let i = 0; i < 2; i++) g.fillRect(85 + i * 86 - 3, 0, 6, 256);
  g.fillStyle = '#ffffff'; for (let y = 0; y < 256; y += 64) { g.beginPath(); g.arc(128, y + 20, 7, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#7ee08f'; g.fillRect(0, 0, 8, 256); g.fillRect(248, 0, 8, 256);
  roadTex = new THREE.CanvasTexture(c); roadTex.colorSpace = THREE.SRGBColorSpace;
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping; roadTex.repeat.set(1, 40);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 260), new THREE.MeshLambertMaterial({ map: roadTex }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -110); scene.add(road);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: '#6fd27f' }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.02, -110); scene.add(grass);
}

// Pohon lolipop & bukit di pinggir (didaur ulang)
const scenery = [];
{
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#b5713f' });
  const leafMats = ['#4fc46c', '#7fd96b', '#3fb86a'].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const hillMat = new THREE.MeshLambertMaterial({ color: '#8fe0a0' });
  const trunk = new THREE.CylinderGeometry(.18, .24, 1.2, 8), leaf = new THREE.SphereGeometry(1, 10, 8), hill = new THREE.SphereGeometry(1, 12, 8);
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group();
    if (i % 3 === 0) { const h = new THREE.Mesh(hill, hillMat); h.scale.set(5 + Math.random() * 5, 2 + Math.random() * 2, 4); h.position.y = -0.8; g.add(h); }
    else {
      const t = new THREE.Mesh(trunk, trunkMat); t.position.y = .6; g.add(t);
      const l = new THREE.Mesh(leaf, leafMats[i % 3]); l.position.y = 1.9; l.scale.setScalar(.9 + Math.random() * .6); g.add(l);
      g.scale.setScalar(1 + Math.random() * .8);
    }
    resetScenery(g, -i * 9); scene.add(g); scenery.push(g);
  }
}
function resetScenery(g, z) { const side = Math.random() < .5 ? -1 : 1; g.position.set(side * (6 + Math.random() * 9), 0, z); }

// ---------------------------------------------------------------------------
// Bolu — karakter bulat dengan wajah
// ---------------------------------------------------------------------------
const player = new THREE.Group();
let bodyMesh, feetL, feetR;
{
  const face = document.createElement('canvas'); face.width = 256; face.height = 128; const g = face.getContext('2d');
  g.fillStyle = '#ff8fab'; g.fillRect(0, 0, 256, 128);
  const eye = (x) => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, 56, 13, 15, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#2a1a3a'; g.beginPath(); g.arc(x + 2, 60, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 4, 56, 2, 0, Math.PI * 2); g.fill(); };
  eye(108); eye(148);
  g.strokeStyle = '#2a1a3a'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(112, 84); g.quadraticCurveTo(128, 98, 144, 84); g.stroke();
  g.fillStyle = 'rgba(255,92,138,.55)'; g.beginPath(); g.arc(92, 80, 9, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(164, 80, 9, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(face); tex.colorSpace = THREE.SRGBColorSpace;
  bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(.75, 24, 18), new THREE.MeshLambertMaterial({ map: tex }));
  bodyMesh.rotation.y = -Math.PI / 2; // tengah tekstur (u=.5) ada di +x pada SphereGeometry → putar agar menghadap kamera (+z)
  bodyMesh.position.y = 1.0; player.add(bodyMesh);
  const feetGeo = new THREE.SphereGeometry(.22, 10, 8), feetMat = new THREE.MeshLambertMaterial({ color: '#ff5c8a' });
  feetL = new THREE.Mesh(feetGeo, feetMat); feetR = new THREE.Mesh(feetGeo, feetMat);
  feetL.position.set(-.3, .2, 0); feetR.position.set(.3, .2, 0); player.add(feetL, feetR);
}
player.position.set(0, 0, PLAYER_Z); scene.add(player);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(.7, 20), new THREE.MeshBasicMaterial({ color: '#2a1a3a', transparent: true, opacity: .18 }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = .01; scene.add(shadow);

// ---------------------------------------------------------------------------
// Rintangan (peti kayu, kayu rebah, dahan) & koin bintang — pool
// ---------------------------------------------------------------------------
const obstacles = [], coins = [];
{
  const crateTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#d9915b'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#a8623a'; g.lineWidth = 10; g.strokeRect(5, 5, 118, 118); g.beginPath(); g.moveTo(10, 10); g.lineTo(118, 118); g.moveTo(118, 10); g.lineTo(10, 118); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const crateMat = new THREE.MeshLambertMaterial({ map: crateTex });
  const logMat = new THREE.MeshLambertMaterial({ color: '#b5713f' });
  const leafMat = new THREE.MeshLambertMaterial({ color: '#4fc46c' });
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 1.7), crateMat); b.position.y = .85; g.add(b);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), crateMat); b2.position.set(.1, 2.3, 0); b2.rotation.y = .3; g.add(b2);
    g.visible = false; scene.add(g); obstacles.push({ mesh: g, type: 'wall', lane: 0, active: false });
  }
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 7.4, 12), logMat); log.rotation.z = Math.PI / 2; log.position.y = .35; log.visible = false; scene.add(log);
    obstacles.push({ mesh: log, type: 'low', lane: 0, active: false });
    const branch = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 7.4, 10), logMat); bar.rotation.z = Math.PI / 2; branch.add(bar);
    for (let k = -2; k <= 2; k++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(.55, 8, 6), leafMat); lf.position.set(k * 1.6, .25, 0); branch.add(lf); }
    branch.position.y = 2.2; branch.visible = false; scene.add(branch);
    obstacles.push({ mesh: branch, type: 'high', lane: 0, active: false });
  }
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? .18 : .4, a = i * Math.PI / 5 - Math.PI / 2; i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: .12, bevelEnabled: false });
  const starMat = new THREE.MeshLambertMaterial({ color: '#ffd166', emissive: '#6b4a00', emissiveIntensity: .6 });
  for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(starGeo, starMat); s.visible = false; scene.add(s); coins.push({ mesh: s, active: false }); }
}

// Konfeti saat ambil bintang / rekor
const confetti = [];
{
  const geo = new THREE.PlaneGeometry(.16, .22);
  const mats = ['#ff8fab', '#ffd166', '#5bd77a', '#5ec8ff', '#ff9f43'].map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
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
  Object.assign(state, { speed: BASE_SPEED, dist: 0, score: 0, coinsTaken: 0, targetLane: 1, vy: 0, y: 0, jumping: false, slide: 0, nextSpawnZ: SPAWN_Z, elapsed: 0, nextMilestone: 100 });
  input.lane = 1; input.jump = false; input.duck = false;
  obstacles.forEach((o) => { o.active = false; o.mesh.visible = false; });
  coins.forEach((c) => { c.active = false; c.mesh.visible = false; });
  player.position.set(0, 0, PLAYER_Z); player.scale.set(1, 1, 1);
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
  state.mode = 'over'; sfx.bump();
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
  o.mesh.position.set(type === 'wall' ? LANE_X[lane] : 0, type === 'wall' ? 0 : type === 'low' ? .35 : 2.2, z);
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
  if (state.jumping) { state.vy += GRAVITY * dt; state.y += state.vy * dt; if (state.y <= 0) { state.y = 0; state.jumping = false; state.vy = 0; } }
  if (input.duck && !state.jumping && state.slide <= 0) { state.slide = SLIDE_TIME; sfx.duck(); }
  if (state.slide > 0) state.slide -= dt;
  const sliding = state.slide > 0 || (input.duck && !state.jumping);
  player.scale.y += ((sliding ? .55 : 1) - player.scale.y) * Math.min(1, dt * 14);
  player.position.y = state.y;
  player.rotation.z = (LANE_X[state.targetLane] - player.position.x) * -.2;
  // kaki berlari + badan memantul
  const run = now / 1000 * state.speed * .9;
  feetL.position.z = Math.sin(run) * .35; feetR.position.z = -Math.sin(run) * .35;
  bodyMesh.position.y = 1.0 + (state.jumping ? 0 : Math.abs(Math.sin(run)) * .08);
  shadow.position.x = player.position.x; shadow.scale.setScalar(1 - Math.min(.6, state.y * .22));

  roadTex.offset.y -= dz / 6.5;
  scenery.forEach((s) => { s.position.z += dz; if (s.position.z > 14) resetScenery(s, s.position.z - 26 * 9); });
  clouds.forEach((c) => { c.position.z += dz * .15; c.position.x += c.userData.v * dt; if (c.position.z > 10) c.position.z -= 150; if (c.position.x > 70) c.position.x = -70; });
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
    c.mesh.position.z += dz; c.mesh.rotation.y += dt * 3;
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
  if (state.mode !== 'play') { const run = now / 1000 * 3; bodyMesh.position.y = 1.0 + Math.sin(run) * .05; }
  camera.position.x += (player.position.x * .35 - camera.position.x) * Math.min(1, dt * 4);
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

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
