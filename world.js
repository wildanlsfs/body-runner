// Dunia kartun: langit gradasi, matahari, bukit, jalan batu, pagar, pohon, rumah jamur, rintangan, bintang.
import * as THREE from 'three';
import { builder, part, toon, vtoon, canvasTex } from './look.js';

const cloudMat = new THREE.MeshToonMaterial({ vertexColors: true, emissive: '#eaf6ff', emissiveIntensity: .55 });

export const SKY_TOP = '#3aa8ff', SKY_HORIZON = '#d4f3ff';
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------------------
// Langit, cahaya, latar jauh
// ---------------------------------------------------------------------------
export function addSky(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(SKY_TOP) }, hor: { value: new THREE.Color(SKY_HORIZON) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 2.2, 0., 1.); gl_FragColor = vec4(mix(hor, top, pow(h, .7)), 1.);\n#include <colorspace_fragment>\n}',
  }));
  sky.renderOrder = -1; scene.add(sky);

  const glow = canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,248,214,1)'); r.addColorStop(.35, 'rgba(255,236,170,.9)'); r.addColorStop(1, 'rgba(255,236,170,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, fog: false, depthWrite: false }));
  sun.scale.setScalar(70); sun.position.set(55, 70, -200); scene.add(sun);

  const hemi = new THREE.HemisphereLight('#ffffff', '#8fd18a', 1.5);
  const dir = new THREE.DirectionalLight('#fff2d6', 2.3);
  dir.position.set(-6, 16, -8); dir.target.position.set(0, 0, -14);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  Object.assign(dir.shadow.camera, { left: -16, right: 16, top: 26, bottom: -22, near: 1, far: 50 });
  dir.shadow.bias = -0.0006; dir.shadow.normalBias = 0.03;
  scene.add(hemi, dir, dir.target);

  // Bukit & gunung jauh (diam; fog memberi kedalaman)
  const far = builder();
  const greens = ['#7fd97a', '#6cc96f', '#93e08a', '#5fbf6a'];
  for (let i = 0; i < 14; i++) {
    const x = (i - 6.5) * 22 + rnd(-6, 6), r = rnd(14, 26);
    far.add(new THREE.SphereGeometry(1, 20, 12), greens[i % 4], { p: [x, -r * .35, rnd(-150, -175)], s: [r * 1.3, r * .75, r * .6] });
  }
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 40 + rnd(-10, 10), h = rnd(35, 55), z = rnd(-195, -210), ry = rnd(0, 1);
    far.add(new THREE.ConeGeometry(h * .7, h, 7), i % 2 ? '#a99be6' : '#b9aef0', { p: [x, h / 2 - 6, z], r: [0, ry, 0] });
    far.add(new THREE.ConeGeometry(h * .7 * .36 + .4, h * .36, 7), '#ffffff', { p: [x, h - 6 - h * .18 + .15, z], r: [0, ry, 0] }); // salju
  }
  const farMesh = far.mesh({ outline: 0, cast: false });
  scene.add(farMesh);
  return { dir };
}

// ---------------------------------------------------------------------------
// Tanah: rumput, jalan batu, trotoar permen
// ---------------------------------------------------------------------------
export function addGround(scene) {
  const grassTex = canvasTex(256, 256, (g) => {
    g.fillStyle = '#86dc5f'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = Math.random() < .5 ? '#79d156' : '#93e46c';
      const x = Math.random() * 256, y = Math.random() * 256; g.beginPath(); g.ellipse(x, y, rnd(3, 9), rnd(2, 5), rnd(0, 3), 0, 7); g.fill();
    }
    g.strokeStyle = '#5fb948'; g.lineWidth = 2; g.lineCap = 'round';
    for (let i = 0; i < 90; i++) { const x = Math.random() * 256, y = Math.random() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 7); g.moveTo(x + 3, y); g.lineTo(x + 4, y - 6); g.stroke(); }
    for (let i = 0; i < 14; i++) { const x = Math.random() * 256, y = Math.random() * 256; g.fillStyle = pick(['#ffffff', '#ffe066', '#ffb3c7']); for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 3, y + Math.sin(k * 1.26) * 3, 2.4, 0, 7); g.fill(); } g.fillStyle = '#ffb703'; g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); }
  }, [40, 40]);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshToonMaterial({ map: grassTex }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.02, -110); grass.receiveShadow = true; scene.add(grass);

  // jalan batu bulat pastel; garis jalur berupa titik putih
  const roadTex = canvasTex(256, 256, (g) => {
    g.fillStyle = '#e9c99a'; g.fillRect(0, 0, 256, 256);
    const cols = ['#f7dfb6', '#f2d4a4', '#fbe8c6', '#efcf9c'];
    for (let row = 0; row < 8; row++) for (let c = 0; c < 9; c++) {
      const x = c * 30 + (row % 2) * 15 - 6, y = row * 32 + 2;
      g.fillStyle = cols[(row * 3 + c) % 4]; g.beginPath(); g.roundRect(x + 2, y + 2, 26, 28, 9); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.roundRect(x + 6, y + 5, 12, 6, 3); g.fill();
    }
    g.fillStyle = '#ffffff'; for (const x of [85, 171]) for (let y = 16; y < 256; y += 64) { g.beginPath(); g.roundRect(x - 5, y, 10, 30, 5); g.fill(); }
  }, [1, 36]);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 260), new THREE.MeshToonMaterial({ map: roadTex }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -110); road.receiveShadow = true; scene.add(road);

  // trotoar garis permen
  const curbTex = canvasTex(64, 64, (g) => { g.fillStyle = '#fff4e2'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#ff7aa2'; g.fillRect(0, 0, 64, 32); }, [1, 130]);
  const curbMat = new THREE.MeshToonMaterial({ map: curbTex });
  for (const sx of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(.45, .22, 260), curbMat);
    curb.position.set(sx * 3.92, .11, -110); curb.receiveShadow = true; scene.add(curb);
  }
  return { scroll(dz) { roadTex.offset.y -= dz / (260 / 36); grassTex.offset.y -= dz / 10; curbTex.offset.y -= dz / 2; } };
}

// ---------------------------------------------------------------------------
// Properti pinggir jalan (masing-masing 1 mesh gabungan)
// ---------------------------------------------------------------------------
const S = (w = 18, h = 12) => new THREE.SphereGeometry(1, w, h);

function roundTree() {
  const b = builder(), h = rnd(1.3, 1.9);
  b.add(new THREE.CylinderGeometry(.2, .3, h, 8), '#9a6646', { p: [0, h / 2, 0] });
  const g = pick([['#5bc768', '#4ab35c', '#72d67c'], ['#7ccf5a', '#68bd4b', '#93dd6e'], ['#4fbf7a', '#3fae6c', '#6ad491']]);
  b.add(S(), g[0], { p: [0, h + .7, 0], s: 1.15 });
  b.add(S(), g[1], { p: [-.7, h + .35, .15], s: .8 });
  b.add(S(), g[2], { p: [.65, h + .45, -.1], s: .85 });
  b.add(S(), g[2], { p: [.1, h + 1.45, .05], s: .7 });
  if (Math.random() < .5) for (let i = 0; i < 5; i++) { const a = rnd(0, 6.28), y = rnd(.3, 1.4); b.add(S(10, 8), '#ff4d6d', { p: [Math.cos(a) * 1.05, h + y, Math.sin(a) * 1.05], s: .13 }); } // buah
  return b.mesh({ outline: .05 });
}
function pineTree() {
  const b = builder(), cols = ['#3ea56a', '#4cb877', '#5dc985'];
  b.add(new THREE.CylinderGeometry(.16, .22, .9, 8), '#8a5a3d', { p: [0, .45, 0] });
  for (let i = 0; i < 3; i++) b.add(new THREE.ConeGeometry(1.25 - i * .3, 1.4, 9), cols[i], { p: [0, 1.25 + i * .8, 0] });
  return b.mesh({ outline: .05 });
}
function bush() {
  const b = builder();
  b.add(S(), '#56c169', { p: [0, .45, 0], s: [.75, .62, .7] });
  b.add(S(), '#4bb35e', { p: [-.6, .35, 0], s: .52 });
  b.add(S(), '#66cf75', { p: [.6, .38, .05], s: .56 });
  const fc = pick(['#ffffff', '#ffd23f', '#ff8fb1', '#b388ff']);
  for (let i = 0; i < 9; i++) { const a = rnd(-.4, 3.5), r = rnd(.55, .75); b.add(S(8, 6), fc, { p: [Math.cos(a) * r, .45 + Math.sin(a) * r * .55, rnd(.2, .5)], s: .09 }); }
  return b.mesh({ outline: .04 });
}
function mushroomHouse() {
  const b = builder();
  b.add(new THREE.CylinderGeometry(.85, 1.0, 1.7, 18), '#fff0d4', { p: [0, .85, 0] });
  b.add(new THREE.CylinderGeometry(.32, .32, .06, 16, 1, false, 0, Math.PI), '#9a6646', { p: [0, .55, .97], r: [Math.PI / 2, 0, 0], s: [1, 1, 1.6] }); // pintu atas
  b.add(new THREE.BoxGeometry(.64, .55, .06), '#9a6646', { p: [0, .3, .97] });
  b.add(S(8, 6), '#ffd23f', { p: [.2, .35, 1.0], s: .05 });
  b.add(new THREE.CylinderGeometry(.2, .2, .06, 16), '#8ad8ff', { p: [.45, 1.15, .83], r: [Math.PI / 2, 0, -.5] }); // jendela
  b.add(new THREE.TorusGeometry(.2, .04, 6, 16), '#9a6646', { p: [.46, 1.15, .85], r: [0, .5, 0] });
  const cap = pick(['#ff5a5f', '#ff7b54', '#c77dff']);
  b.add(new THREE.SphereGeometry(1.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), cap, { p: [0, 1.55, 0], s: [1, .78, 1] });
  b.add(new THREE.CylinderGeometry(1.55, 1.55, .08, 24), '#fff0d4', { p: [0, 1.55, 0] });
  for (let i = 0; i < 7; i++) {
    const th = rnd(.25, 1.25), ph = i * 0.9 + rnd(0, .4);
    b.add(S(10, 8), '#ffffff', { p: [Math.sin(th) * Math.sin(ph) * 1.55, 1.55 + Math.cos(th) * 1.55 * .78, Math.sin(th) * Math.cos(ph) * 1.55], s: [.22, .12, .22], r: [th * Math.cos(ph), 0, -th * Math.sin(ph)] });
  }
  return b.mesh({ outline: .05 });
}
function rock() {
  const b = builder();
  b.add(new THREE.DodecahedronGeometry(.7, 0), '#b8b0d4', { p: [0, .35, 0], s: [1.2, .8, 1], r: [rnd(0, 1), rnd(0, 3), 0] });
  b.add(new THREE.DodecahedronGeometry(.4, 0), '#c9c2e2', { p: [.75, .22, .2], r: [rnd(0, 1), rnd(0, 3), 0] });
  b.add(S(8, 6), '#6fd27f', { p: [-.4, .1, .55], s: [.3, .15, .25] });
  return b.mesh({ outline: .04 });
}

export function makeScenery(scene) {
  const makers = [roundTree, roundTree, roundTree, pineTree, pineTree, bush, bush, mushroomHouse, rock];
  const props = [];
  const SPAN = 240;
  for (let i = 0; i < 44; i++) {
    const m = makers[i % makers.length]();
    m.userData.big = makers[i % makers.length] === mushroomHouse;
    place(m, -i * (SPAN / 44)); scene.add(m); props.push(m);
  }
  function place(m, z) {
    const side = Math.random() < .5 ? -1 : 1;
    m.position.set(side * rnd(m.userData.big ? 8 : 5.6, m.userData.big ? 13 : 16), 0, z);
    m.rotation.y = m.userData.big ? -side * Math.PI / 2 + rnd(-.4, .4) : rnd(0, 6.28);
    m.scale.setScalar(rnd(.9, 1.25));
  }
  // pagar kayu di kedua sisi (segmen 6 m)
  const fb = builder();
  for (let k = 0; k < 3; k++) fb.add(new THREE.BoxGeometry(.16, .85, .16), '#fff7ec', { p: [0, .42, -k * 2] }).add(new THREE.ConeGeometry(.12, .16, 4), '#fff7ec', { p: [0, .93, -k * 2], r: [0, Math.PI / 4, 0] });
  fb.add(new THREE.BoxGeometry(.07, .12, 6), '#ffe9cf', { p: [0, .62, -2] }).add(new THREE.BoxGeometry(.07, .12, 6), '#ffe9cf', { p: [0, .32, -2] });
  const fenceGeo = fb.geometry();
  const fences = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 40; i++) {
    const f = part(fenceGeo, vtoon, { outline: .03 });
    f.position.set(sx * 4.55, 0, -i * 6); scene.add(f); fences.push(f);
  }
  return {
    scroll(dz) {
      for (const p of props) { p.position.z += dz; if (p.position.z > 14) place(p, p.position.z - SPAN); }
      for (const f of fences) { f.position.z += dz; if (f.position.z > 14) f.position.z -= 240; }
    },
  };
}

export function makeClouds(scene) {
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const b = builder();
    const n = 4 + (i % 3);
    for (let k = 0; k < n; k++) b.add(S(14, 10), '#ffffff', { p: [(k - (n - 1) / 2) * 1.3, (k % 2) * .5 + rnd(0, .3), rnd(-.3, .3)], s: [rnd(1, 1.6), rnd(.9, 1.3), 1] });
    b.add(S(14, 10), '#eaf6ff', { p: [0, -.4, 0], s: [n * .75, .5, 1] });
    const m = b.mesh({ outline: .06, cast: false, material: cloudMat });
    m.position.set(rnd(-70, 70), rnd(16, 28), rnd(-60, -170)); m.scale.setScalar(rnd(1.6, 2.6)); m.userData.v = rnd(.4, 1);
    scene.add(m); clouds.push(m);
  }
  return {
    scroll(dz, dt) { for (const c of clouds) { c.position.z += dz * .12; c.position.x += c.userData.v * dt; if (c.position.z > 0) c.position.z -= 170; if (c.position.x > 80) c.position.x = -80; } },
  };
}

// ---------------------------------------------------------------------------
// Rintangan (semua dibangun dari tanah, y = 0)
// ---------------------------------------------------------------------------
function crate(b, size, p, ry = 0) {
  const [x, y, z] = p, hs = size / 2, t = size * .12, wood = '#e7a768', dark = '#b8703f';
  const rot = (dx, dz) => [x + dx * Math.cos(ry) + dz * Math.sin(ry), z - dx * Math.sin(ry) + dz * Math.cos(ry)];
  b.add(new THREE.BoxGeometry(size, size, size), wood, { p: [x, y + hs, z], r: [0, ry, 0] });
  // rangka di 4 sisi tegak + diagonal
  for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const ox = nx * (hs + .01), oz = nz * (hs + .01), along = nz !== 0 ? [1, 0] : [0, 1];
    const fy = ry + (nz !== 0 ? 0 : Math.PI / 2);
    const [cx, cz] = rot(ox, oz);
    for (const s of [-1, 1]) {
      const [ex, ez] = rot(ox + along[0] * s * (hs - t / 2), oz + along[1] * s * (hs - t / 2));
      b.add(new THREE.BoxGeometry(t, size, .06), dark, { p: [ex, y + hs, ez], r: [0, fy, 0] });
      b.add(new THREE.BoxGeometry(size, t, .06), dark, { p: [cx, y + hs + s * (hs - t / 2), cz], r: [0, fy, 0] });
    }
    b.add(new THREE.BoxGeometry(size * 1.2, t, .05), dark, { p: [cx, y + hs, cz], r: [0, fy, Math.PI / 4] });
  }
  b.add(new THREE.BoxGeometry(size - t * 2, .05, size - t * 2), '#f2bd85', { p: [x, y + size + .01, z], r: [0, ry, 0] });
}

export function makeObstacles(scene) {
  const list = [];
  const add = (mesh, type) => { mesh.visible = false; scene.add(mesh); list.push({ mesh, type, lane: 0, active: false }); };
  // dinding: tumpukan peti
  for (let i = 0; i < 8; i++) {
    const b = builder();
    crate(b, 1.6, [0, 0, 0], rnd(-.15, .15));
    if (i % 2 === 0) crate(b, 1.05, [rnd(-.15, .15), 1.6, 0], rnd(-.5, .5));
    add(b.mesh({ outline: .045 }), 'wall');
  }
  // dinding: batu besar berlumut
  for (let i = 0; i < 6; i++) {
    const b = builder();
    b.add(new THREE.DodecahedronGeometry(1, 1), '#aaa2cc', { p: [0, .9, 0], s: [1.05, .95, .9], r: [rnd(0, 1), rnd(0, 3), 0] });
    b.add(new THREE.DodecahedronGeometry(.55, 0), '#bdb5dd', { p: [.6, .35, .5], r: [rnd(0, 1), rnd(0, 3), 0] });
    b.add(S(), '#6fd27f', { p: [-.1, 1.75, 0], s: [.65, .2, .55] });
    b.add(S(8, 6), '#ffffff', { p: [-.2, 1.88, .15], s: .1 }).add(S(8, 6), '#ffd23f', { p: [.15, 1.86, -.1], s: .09 });
    add(b.mesh({ outline: .045 }), 'wall');
  }
  // rendah: batang kayu melintang + jamur kecil (lompati)
  for (let i = 0; i < 4; i++) {
    const b = builder();
    b.add(new THREE.CylinderGeometry(.4, .4, 7.4, 16), '#a86b45', { p: [0, .4, 0], r: [0, 0, Math.PI / 2] });
    for (const sx of [-1, 1]) {
      b.add(new THREE.CylinderGeometry(.36, .36, .04, 18), '#f4d29e', { p: [sx * 3.71, .4, 0], r: [0, 0, Math.PI / 2] });
      b.add(new THREE.TorusGeometry(.2, .025, 4, 18), '#c98c58', { p: [sx * 3.735, .4, 0], r: [0, Math.PI / 2, 0] });
    }
    for (let k = 0; k < 6; k++) b.add(new THREE.BoxGeometry(rnd(.5, 1.1), .05, .1), '#8c5636', { p: [rnd(-3, 3), .4 + rnd(-.15, .15), .39], r: [0, 0, rnd(-.1, .1)] });
    for (const mx of [-2.6, -.4, 1.9]) {
      b.add(new THREE.CylinderGeometry(.07, .09, .22, 8), '#fff0d4', { p: [mx, .88, 0] });
      b.add(new THREE.SphereGeometry(.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#ff5a5f', { p: [mx, .97, 0], s: [1, .8, 1] });
    }
    b.add(S(), '#7bd389', { p: [1, .78, .05], s: [.55, .14, .35] }).add(S(), '#7bd389', { p: [-1.6, .78, -.05], s: [.4, .12, .3] });
    add(b.mesh({ outline: .04 }), 'low');
  }
  // tinggi: gapura bendera warna-warni (merunduk)
  const flagCols = ['#ff5d73', '#ffd23f', '#4cc9f0', '#7bd389', '#b388ff'];
  for (let i = 0; i < 4; i++) {
    const b = builder();
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 6; k++) b.add(new THREE.CylinderGeometry(.13, .13, .5, 12), k % 2 ? '#ffffff' : '#ff7aa2', { p: [sx * 3.95, .25 + k * .5, 0] });
      b.add(S(14, 10), '#ffd23f', { p: [sx * 3.95, 3.1, 0], s: .2 });
    }
    b.add(new THREE.CylinderGeometry(.09, .09, 8, 10), '#9a6646', { p: [0, 2.5, 0], r: [0, 0, Math.PI / 2] });
    for (let k = 0; k < 12; k++) {
      const x = -3.4 + k * (6.8 / 11), sag = .18 * (1 - (x / 3.6) ** 2);
      b.add(new THREE.ConeGeometry(.3, .7, 3), flagCols[k % 5], { p: [x, 2.45 - sag - .35, 0], r: [Math.PI, Math.PI / 6, 0], s: [1, 1, .22] });
    }
    add(b.mesh({ outline: .035 }), 'high');
  }
  return list;
}

// ---------------------------------------------------------------------------
// Bintang (koin) & debu lari
// ---------------------------------------------------------------------------
export function makeCoins(scene, n = 18) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? .19 : .42, a = i * Math.PI / 5 + Math.PI / 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const geo = new THREE.ExtrudeGeometry(s, { depth: .1, bevelEnabled: true, bevelThickness: .06, bevelSize: .05, bevelSegments: 2 });
  geo.center(); geo.computeVertexNormals();
  const mat = toon('#ffcf33', { emissive: '#8a5a00', emissiveIntensity: .45 });
  const coins = [];
  for (let i = 0; i < n; i++) { const m = part(geo, mat, { outline: .03 }); m.visible = false; scene.add(m); coins.push({ mesh: m, active: false }); }
  return coins;
}

export function makeDust(scene) {
  const geo = new THREE.SphereGeometry(.16, 8, 6), mat = toon('#fff4e2');
  const pool = [];
  for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(geo, mat); m.visible = false; scene.add(m); pool.push({ m, life: 0, v: new THREE.Vector3() }); }
  let acc = 0;
  return {
    puff(x, z, n = 1, spread = .4) {
      for (let k = 0; k < n; k++) {
        const p = pool.find((q) => q.life <= 0); if (!p) return;
        p.life = .45; p.m.visible = true; p.m.position.set(x + rnd(-spread, spread), .12, z + rnd(-.1, .3)); p.v.set(rnd(-.6, .6), rnd(.4, 1.2), rnd(1, 2.5));
      }
    },
    update(dt, running, x, z) {
      if (running) { acc += dt; if (acc > .07) { acc = 0; this.puff(x, z + .3); } }
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt; p.m.position.addScaledVector(p.v, dt);
        const k = p.life / .45; p.m.scale.setScalar(Math.max(.01, Math.sin(k * Math.PI) * 1.1));
        if (p.life <= 0) p.m.visible = false;
      }
    },
  };
}
