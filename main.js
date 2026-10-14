import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Konstanta permainan
// ---------------------------------------------------------------------------
const LANE_X = [-2.2, 0, 2.2];
const PLAYER_Z = 0;
const SPAWN_Z = -90;
const BASE_SPEED = 14;        // unit/detik
const MAX_SPEED = 30;
const GRAVITY = -28;
const JUMP_V = 10.5;
const SLIDE_TIME = 0.75;
const GAP_MIN = 16;           // jarak minimum antar rintangan (unit)

const $ = (id) => document.getElementById(id);
const ui = {
  start: $('start'), calib: $('calib'), over: $('over'), hud: $('hud'),
  score: $('score'), dist: $('dist'), best: $('best'), gesture: $('gesture'),
  final: $('final'), finalBest: $('final-best'), calibCount: $('calib-count'), calibBar: $('calib-bar'),
  camStatus: $('cam-status'), video: $('video'), poseCanvas: $('pose'),
};

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1538');
scene.fog = new THREE.Fog('#1a1538', 30, 95);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 3.4, 7.5);
camera.lookAt(0, 1.2, -12);

scene.add(new THREE.HemisphereLight('#ffd9b0', '#2a1f5a', 1.1));
const sun = new THREE.DirectionalLight('#ffb070', 1.6);
sun.position.set(-6, 10, -8);
scene.add(sun);

// Langit senja: bidang gradasi besar di kejauhan + matahari
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1a1538'); grad.addColorStop(.55, '#4b2a6b'); grad.addColorStop(.8, '#ff6a4d'); grad.addColorStop(1, '#ffc46b');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(400, 160), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  sky.position.set(0, 40, -190); scene.add(sky);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshBasicMaterial({ color: '#ffd166', fog: false }));
  sunDisc.position.set(18, 12, -185); scene.add(sunDisc);
}

// Jalan: tekstur garis yang digeser → kesan bergerak tanpa geometri bergerak
let roadTex;
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2550'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#3a3366'; for (let i = 0; i < 2; i++) g.fillRect(85 + i * 86 - 2, 0, 4, 256);
  g.fillStyle = '#ffd166'; g.fillRect(124, 40, 8, 90);
  g.fillStyle = '#ff6a4d'; g.fillRect(0, 0, 10, 256); g.fillRect(246, 0, 10, 256);
  roadTex = new THREE.CanvasTexture(c); roadTex.colorSpace = THREE.SRGBColorSpace;
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping; roadTex.repeat.set(1, 40);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 240), new THREE.MeshLambertMaterial({ map: roadTex }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -100); scene.add(road);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: '#171333' }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, -100); scene.add(ground);
}

// Gedung low-poly di kiri-kanan (didaur ulang)
const buildings = [];
{
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mats = ['#2d2560', '#3b2f78', '#24204d'].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (let i = 0; i < 28; i++) {
    const m = new THREE.Mesh(geo, mats[i % 3]);
    resetBuilding(m, -i * 9);
    scene.add(m); buildings.push(m);
  }
}
function resetBuilding(m, z) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const h = 3 + Math.random() * 12, w = 2 + Math.random() * 4;
  m.scale.set(w, h, 3 + Math.random() * 4);
  m.position.set(side * (6.5 + Math.random() * 6), h / 2, z);
}

// Pemain
const player = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 6, 12), new THREE.MeshLambertMaterial({ color: '#ff4d6d' }));
  body.position.y = 0.9; player.add(body);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshLambertMaterial({ color: '#36e2b4' }));
  visor.position.set(0, 1.35, -0.3); player.add(visor);
}
player.position.set(0, 0, PLAYER_Z); scene.add(player);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35 }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; scene.add(shadow);

// Rintangan & koin (pool)
const obstacles = []; // {mesh, type, lane, active}
const coins = [];
{
  const wallMat = new THREE.MeshLambertMaterial({ color: '#ff8a3d' });
  const barMat = new THREE.MeshLambertMaterial({ color: '#ffd166' });
  for (let i = 0; i < 12; i++) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.3, 0.8), wallMat); wall.visible = false; scene.add(wall);
    obstacles.push({ mesh: wall, type: 'wall', lane: 0, active: false });
  }
  for (let i = 0; i < 4; i++) {
    const low = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.6), barMat); low.visible = false; scene.add(low);
    obstacles.push({ mesh: low, type: 'low', lane: 0, active: false });
    const high = new THREE.Mesh(new THREE.BoxGeometry(7, 1.0, 0.6), barMat); high.visible = false; scene.add(high);
    obstacles.push({ mesh: high, type: 'high', lane: 0, active: false });
  }
  const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 16);
  const coinMat = new THREE.MeshLambertMaterial({ color: '#ffe08a', emissive: '#4a3a00' });
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Mesh(coinGeo, coinMat); c.rotation.x = Math.PI / 2; c.visible = false; scene.add(c);
    coins.push({ mesh: c, active: false });
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  mode: 'start',           // start | calib | play | over
  speed: BASE_SPEED, dist: 0, score: 0, coinsTaken: 0,
  lane: 1, targetLane: 1,
  vy: 0, y: 0, jumping: false, slide: 0,
  nextSpawnZ: SPAWN_Z, elapsed: 0,
  best: Number((() => { try { return localStorage.getItem('bodyrunner.best') || 0; } catch { return 0; } })()),
};
ui.best.textContent = state.best;

const input = { lane: 1, jump: false, duck: false, handsUp: false, source: 'keyboard' };

// Keyboard (fallback / pengujian)
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'ArrowLeft') input.lane = Math.max(0, input.lane - 1);
  if (e.key === 'ArrowRight') input.lane = Math.min(2, input.lane + 1);
  if (e.key === 'ArrowUp' || e.key === ' ') { input.jump = true; input.handsUp = true; }
  if (e.key === 'ArrowDown') input.duck = true;
});
addEventListener('keyup', (e) => {
  if (e.key === 'ArrowDown') input.duck = false;
  if (e.key === 'ArrowUp' || e.key === ' ') input.handsUp = false;
});

// ---------------------------------------------------------------------------
// Kamera + MediaPipe Pose
// ---------------------------------------------------------------------------
let landmarker = null, lastVideoTime = -1;
const pose = { ok: false, midX: 0.5, shoulderY: 0.5, handsUp: false, baseX: 0.5, baseY: 0.5, samples: [] };
const pctx = ui.poseCanvas.getContext('2d');

async function startCamera() {
  ui.camStatus.textContent = 'memuat model…';
  const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14');
  const files = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  landmarker = await vision.PoseLandmarker.createFromOptions(files, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO', numPoses: 1,
  });
  ui.camStatus.textContent = 'minta izin kamera…';
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
  ui.video.srcObject = stream;
  await ui.video.play();
  ui.poseCanvas.width = ui.video.videoWidth || 640; ui.poseCanvas.height = ui.video.videoHeight || 480;
  ui.camStatus.textContent = 'kamera aktif';
  input.source = 'pose';
}

function readPose(now) {
  if (!landmarker || ui.video.readyState < 2 || ui.video.currentTime === lastVideoTime) return;
  lastVideoTime = ui.video.currentTime;
  const res = landmarker.detectForVideo(ui.video, now);
  const lm = res.landmarks && res.landmarks[0];
  pctx.clearRect(0, 0, ui.poseCanvas.width, ui.poseCanvas.height);
  if (!lm) { pose.ok = false; ui.camStatus.textContent = 'tubuh tidak terlihat'; return; }
  pose.ok = true;
  const nose = lm[0], ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
  pose.midX = (ls.x + rs.x) / 2;
  pose.shoulderY = (ls.y + rs.y) / 2;
  pose.handsUp = lw.y < nose.y && rw.y < nose.y;

  // overlay titik + garis utama
  const W = ui.poseCanvas.width, H = ui.poseCanvas.height;
  pctx.lineWidth = 3; pctx.strokeStyle = '#36e2b4';
  const seg = (a, b) => { pctx.beginPath(); pctx.moveTo(lm[a].x * W, lm[a].y * H); pctx.lineTo(lm[b].x * W, lm[b].y * H); pctx.stroke(); };
  [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]].forEach(([a, b]) => seg(a, b));
  pctx.fillStyle = '#ff8a3d';
  [0, 11, 12, 15, 16, 23, 24].forEach((i) => { pctx.beginPath(); pctx.arc(lm[i].x * W, lm[i].y * H, 5, 0, Math.PI * 2); pctx.fill(); });

  if (state.mode === 'calib') { pose.samples.push([pose.midX, pose.shoulderY]); return; }
  if (input.source !== 'pose') return;

  // Gestur → input. Kamera menghadap pemain: condong ke KIRI pemain = x membesar di citra.
  const dx = pose.midX - pose.baseX;
  const T = 0.065, H2 = 0.03; // ambang + histeresis
  if (dx > T) input.lane = 0; else if (dx < -T) input.lane = 2; else if (Math.abs(dx) < T - H2) input.lane = 1;
  input.duck = pose.shoulderY - pose.baseY > 0.11;
  if (pose.handsUp && !input.handsUp) input.jump = true;
  input.handsUp = pose.handsUp;
  ui.camStatus.textContent = input.duck ? 'merunduk' : pose.handsUp ? 'tangan ke atas' : ['condong kiri', 'tegak', 'condong kanan'][input.lane];
}

// ---------------------------------------------------------------------------
// Alur permainan
// ---------------------------------------------------------------------------
function show(el, on) { el.hidden = !on; }

function resetRun() {
  Object.assign(state, { speed: BASE_SPEED, dist: 0, score: 0, coinsTaken: 0, lane: 1, targetLane: 1, vy: 0, y: 0, jumping: false, slide: 0, nextSpawnZ: SPAWN_Z, elapsed: 0 });
  input.lane = 1; input.jump = false; input.duck = false;
  obstacles.forEach((o) => { o.active = false; o.mesh.visible = false; });
  coins.forEach((c) => { c.active = false; c.mesh.visible = false; });
  player.position.set(0, 0, PLAYER_Z); player.scale.set(1, 1, 1);
}

function beginPlay() { resetRun(); state.mode = 'play'; show(ui.hud, true); show(ui.over, false); show(ui.calib, false); }

let calibStart = 0;
function beginCalib() {
  state.mode = 'calib'; pose.samples = []; calibStart = performance.now();
  show(ui.start, false); show(ui.calib, true);
}
function tickCalib(now) {
  const t = (now - calibStart) / 1000;
  ui.calibCount.textContent = Math.max(0, Math.ceil(3 - t));
  ui.calibBar.style.width = `${Math.min(100, t / 3 * 100)}%`;
  if (t >= 3) {
    if (pose.samples.length > 10) {
      const n = pose.samples.length;
      pose.baseX = pose.samples.reduce((s, p) => s + p[0], 0) / n;
      pose.baseY = pose.samples.reduce((s, p) => s + p[1], 0) / n;
      beginPlay();
    } else { calibStart = now; ui.camStatus.textContent = 'berdiri di depan kamera'; }
  }
}

function gameOver() {
  state.mode = 'over';
  if (state.score > state.best) { state.best = state.score; try { localStorage.setItem('bodyrunner.best', String(state.best)); } catch {} }
  ui.final.textContent = state.score; ui.finalBest.textContent = state.best; ui.best.textContent = state.best;
  show(ui.over, true);
}

// Spawner: satu "baris" rintangan per jarak, selalu menyisakan jalan keluar
function spawnRow(z) {
  const r = Math.random();
  if (r < 0.45) {
    const n = Math.random() < 0.35 ? 2 : 1;
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, n);
    lanes.forEach((lane) => placeObstacle('wall', lane, z));
  } else if (r < 0.7) placeObstacle('low', 1, z);
  else if (r < 0.9) placeObstacle('high', 1, z);
  else { const lane = Math.floor(Math.random() * 3); for (let i = 0; i < 5; i++) placeCoin(lane, z - i * 1.6); return; }
  if (Math.random() < 0.6) { const lane = Math.floor(Math.random() * 3); for (let i = 0; i < 4; i++) placeCoin(lane, z - 7 - i * 1.6); }
}
function placeObstacle(type, lane, z) {
  const o = obstacles.find((x) => !x.active && x.type === type); if (!o) return;
  o.active = true; o.lane = lane; o.mesh.visible = true;
  const y = type === 'wall' ? 1.15 : type === 'low' ? 0.25 : 2.1;
  o.mesh.position.set(type === 'wall' ? LANE_X[lane] : 0, y, z);
}
function placeCoin(lane, z) {
  const c = coins.find((x) => !x.active); if (!c) return;
  c.active = true; c.mesh.visible = true; c.mesh.position.set(LANE_X[lane], 1.0, z);
}

function tickPlay(dt) {
  state.elapsed += dt;
  state.speed = Math.min(MAX_SPEED, BASE_SPEED + state.elapsed * 0.35);
  const dz = state.speed * dt;
  state.dist += dz;

  // jalur
  state.targetLane = input.lane;
  const tx = LANE_X[state.targetLane];
  player.position.x += (tx - player.position.x) * Math.min(1, dt * 12);

  // lompat
  if (input.jump && !state.jumping && state.slide <= 0) { state.vy = JUMP_V; state.jumping = true; }
  input.jump = false;
  if (state.jumping) {
    state.vy += GRAVITY * dt; state.y += state.vy * dt;
    if (state.y <= 0) { state.y = 0; state.jumping = false; state.vy = 0; }
  }
  // merunduk
  if (input.duck && !state.jumping && state.slide <= 0) state.slide = SLIDE_TIME;
  if (state.slide > 0) state.slide -= dt;
  const sliding = state.slide > 0 || (input.duck && !state.jumping);
  player.scale.y += ((sliding ? 0.5 : 1) - player.scale.y) * Math.min(1, dt * 14);
  player.position.y = state.y;
  player.rotation.z = (LANE_X[state.targetLane] - player.position.x) * -0.25;
  shadow.position.x = player.position.x; shadow.scale.setScalar(1 - Math.min(0.6, state.y * 0.25));

  // dunia bergerak
  roadTex.offset.y -= dz / 6;
  buildings.forEach((b) => { b.position.z += dz; if (b.position.z > 12) resetBuilding(b, b.position.z - 28 * 9); });
  state.nextSpawnZ += dz;
  if (state.nextSpawnZ > SPAWN_Z + GAP_MIN + Math.random() * 10) { spawnRow(SPAWN_Z); state.nextSpawnZ = SPAWN_Z; }

  const px = player.position.x, pyTop = state.y + (sliding ? 1.0 : 1.9);
  for (const o of obstacles) {
    if (!o.active) continue;
    o.mesh.position.z += dz;
    if (o.mesh.position.z > 8) { o.active = false; o.mesh.visible = false; continue; }
    if (Math.abs(o.mesh.position.z - PLAYER_Z) < 0.7) {
      let hit = false;
      if (o.type === 'wall') hit = Math.abs(px - LANE_X[o.lane]) < 1.2 && state.y < 2.0;
      else if (o.type === 'low') hit = state.y < 0.55;           // harus lompat
      else if (o.type === 'high') hit = pyTop > 1.6;             // harus merunduk
      if (hit) { gameOver(); return; }
    }
  }
  for (const c of coins) {
    if (!c.active) continue;
    c.mesh.position.z += dz; c.mesh.rotation.z += dt * 4;
    if (c.mesh.position.z > 8) { c.active = false; c.mesh.visible = false; continue; }
    if (Math.abs(c.mesh.position.z - PLAYER_Z) < 0.8 && Math.abs(px - c.mesh.position.x) < 0.9 && Math.abs(state.y + 0.9 - 1.0) < 1.2) {
      c.active = false; c.mesh.visible = false; state.coinsTaken++; ui.gesture.classList.add('pulse'); setTimeout(() => ui.gesture.classList.remove('pulse'), 150);
    }
  }

  state.score = Math.floor(state.dist / 2) + state.coinsTaken * 10;
  ui.score.textContent = state.score; ui.dist.textContent = `${Math.floor(state.dist)} m`;
  ui.gesture.textContent = sliding ? 'MERUNDUK' : state.jumping ? 'LOMPAT' : ['KIRI', 'TENGAH', 'KANAN'][state.targetLane];
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  readPose(now);
  if (state.mode === 'calib') tickCalib(now);
  else if (state.mode === 'play') tickPlay(dt);
  else if (state.mode === 'over' && input.jump) { input.jump = false; beginPlay(); }
  else if (state.mode === 'start') input.jump = false;
  // kamera sedikit mengikuti jalur
  camera.position.x += (player.position.x * 0.35 - camera.position.x) * Math.min(1, dt * 4);
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Tombol
$('btn-start').addEventListener('click', async () => {
  const btn = $('btn-start'); btn.disabled = true; btn.textContent = 'Memuat…';
  try { await startCamera(); beginCalib(); }
  catch (e) {
    btn.disabled = false; btn.textContent = 'Nyalakan kamera & mulai';
    ui.camStatus.textContent = 'kamera gagal';
    alert(`Kamera tidak bisa dipakai: ${e.message}\nKamu tetap bisa main dengan keyboard.`);
  }
});
$('btn-keys').addEventListener('click', () => { input.source = 'keyboard'; show(ui.start, false); beginPlay(); });
$('btn-retry').addEventListener('click', beginPlay);
