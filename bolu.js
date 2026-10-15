// Bolu: maskot kue bolu merah muda dengan topping krim, ceri, dan meses.
// Dirakit prosedural (tanpa file model) + animasi prosedural: lari, lompat, merunduk, kedip, pusing.
import * as THREE from 'three';
import { builder, part, toon, curved, INK } from './look.js';


function starGeo(r1 = .14, r2 = .06, depth = .05) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? r2 : r1, a = i * Math.PI / 5 + Math.PI / 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: .02, bevelSize: .015, bevelSegments: 1 });
  g.center(); return g;
}

// Topping di puncak krim (puncak krim ± y .755 dari pusat badan)
function addTopper(b, kind) {
  const C = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
  if (kind === 'cherry') {
    b.add(C(.15, 20, 16), '#ff3355', { p: [0, .86, 0] }).add(C(.04, 8, 6), '#ffd1db', { p: [.06, .92, .1] });
    b.add(new THREE.CylinderGeometry(.018, .022, .26, 6), '#3f8f3a', { p: [.06, 1.04, -.02], r: [.2, 0, -.45] });
    b.add(C(.07, 10, 8), '#5cc35a', { p: [.15, 1.12, -.04], s: [1.4, .45, .8], r: [0, .4, -.3] });
  } else if (kind === 'leaf') { // simpul daun pandan
    for (const a of [-.5, .5, 1.6]) b.add(new THREE.CapsuleGeometry(.05, .42, 3, 8), '#2f9e44', { p: [Math.sin(a) * .1, .92, Math.cos(a) * .05], r: [0, a, a * .9], s: [1.6, 1, .5] });
    b.add(C(.09), '#40c057', { p: [0, .8, 0], s: [1.2, .8, 1.2] });
  } else if (kind === 'berry') {
    for (const [x, z] of [[-.1, .04], [.1, .04], [0, -.1]]) b.add(C(.11, 16, 12), '#4256c9', { p: [x, .84, z] }).add(C(.03, 6, 4), '#28307a', { p: [x, .95, z] });
    b.add(C(.08, 10, 8), '#5cc35a', { p: [.02, .97, .02], s: [1.5, .35, .8], r: [0, .7, 0] });
  } else if (kind === 'star') {
    b.add(starGeo(.26, .11, .1), '#ffcf33', { p: [0, 1.0, 0] });
  } else if (kind === 'horn') {
    b.add(new THREE.ConeGeometry(.1, .46, 16), '#ffe066', { p: [0, 1.0, .12], r: [.35, 0, 0] });
    for (let i = 0; i < 3; i++) b.add(new THREE.TorusGeometry(.07 - i * .018, .014, 4, 14), '#ff70a6', { p: [0, .86 + i * .1, .08 + i * .035], r: [Math.PI / 2 + .35, 0, 0] });
    for (const sx of [-1, 1]) b.add(new THREE.ConeGeometry(.08, .18, 10), '#ffc2e2', { p: [sx * .32, .78, -.05], r: [0, 0, -sx * .5] });
  } else if (kind === 'crown') {
    b.add(new THREE.CylinderGeometry(.24, .27, .14, 20, 1, true), '#ffcf33', { p: [0, .84, 0] });
    b.add(new THREE.CylinderGeometry(.23, .23, .02, 20), '#ffcf33', { p: [0, .78, 0] });
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; b.add(new THREE.ConeGeometry(.06, .16, 6), '#ffcf33', { p: [Math.sin(a) * .24, .99, Math.cos(a) * .24] }).add(C(.035, 8, 6), '#ffffff', { p: [Math.sin(a) * .24, 1.08, Math.cos(a) * .24] }); }
    b.add(C(.05, 10, 8), '#e63946', { p: [0, .85, .27] });
  }
}

export function createBolu(skin = {}) {
  const PINK = skin.body || '#ff8fb1', PINK_DARK = skin.limbs || '#f2709a', CREAM = skin.cream || '#fff4e2', SHOE = skin.shoe || '#7b61ff';
  const root = new THREE.Group();          // posisi jalur & tinggi lompat (diatur game)
  const turn = new THREE.Group();          // hadap kamera (0) atau hadap depan (PI)
  const rig = new THREE.Group();           // squash & stretch dari titik tanah
  const body = new THREE.Group();          // memantul saat lari
  root.add(turn); turn.add(rig); rig.add(body);
  body.position.y = 1.0;

  // --- badan + topping (1 mesh) ---
  const b = builder();
  b.add(new THREE.SphereGeometry(.72, 36, 28), PINK);
  b.add(new THREE.SphereGeometry(.5, 24, 18), skin.belly || '#ffc2d4', { p: [0, -.16, .34], s: [1, .82, .62] });       // perut
  b.add(new THREE.SphereGeometry(.755, 36, 14, 0, Math.PI * 2, 0, Math.PI * .34), CREAM);                 // krim
  // lelehan krim di samping & belakang (wajah dibiarkan bersih)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + .2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < .75) continue;
    const len = .06 + ((i * 37) % 7) / 7 * .16, rr = .655;
    b.add(new THREE.CapsuleGeometry(.075, len, 4, 10), CREAM, { p: [Math.sin(a) * rr, .37 - len / 2, Math.cos(a) * rr] });
  }
  // meses warna-warni
  const spr = skin.sprinkles || ['#ff5d73', '#ffd23f', '#4cc9f0', '#7bd389', '#b388ff'];
  for (let i = 0; i < 22; i++) {
    const th = .12 + (i * .618 % 1) * .85, ph = i * 2.399, r = .765;
    const p = [Math.sin(th) * Math.sin(ph) * r, Math.cos(th) * r, Math.sin(th) * Math.cos(ph) * r];
    if (p[2] > .3 && p[1] < .62) continue; // jangan di tepi depan krim (terlihat seperti mata tambahan)
    b.add(new THREE.CapsuleGeometry(.022, .06, 2, 6), spr[i % spr.length], { p, r: [ph, th * 2, i] });
  }
  addTopper(b, skin.topper || 'cherry');
  const bodyMesh = b.mesh({ outline: .028 });
  body.add(bodyMesh);

  // --- mata (kedip lewat scale.y) ---
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(sx * .225, .07, .64); body.add(eye);
    const e = builder()
      .add(new THREE.SphereGeometry(.15, 20, 16), '#ffffff', { s: [1, 1.18, .5] })
      .add(new THREE.SphereGeometry(.088, 16, 12), '#2b1838', { p: [sx * -.012, -.015, .05], s: [1, 1.1, .5] })
      .add(new THREE.SphereGeometry(.032, 10, 8), '#ffffff', { p: [sx * -.04, .035, .1] })
      .add(new THREE.SphereGeometry(.016, 8, 6), '#ffffff', { p: [sx * .01, -.05, .1] });
    const open = e.mesh({ outline: .018, cast: false });
    const x = builder()
      .add(new THREE.CapsuleGeometry(.022, .16, 2, 6), INK, { p: [0, 0, .06], r: [0, 0, .78] })
      .add(new THREE.CapsuleGeometry(.022, .16, 2, 6), INK, { p: [0, 0, .06], r: [0, 0, -.78] })
      .mesh({ outline: 0, cast: false });
    x.visible = false;
    eye.add(open, x); eyes.push({ eye, open, x });
  }
  // alis
  const brows = [-1, 1].map((sx) => {
    const m = part(new THREE.CapsuleGeometry(.024, .09, 2, 6), INK, { outline: 0, cast: false });
    m.position.set(sx * .23, .29, .615); m.rotation.set(-.4, 0, Math.PI / 2 + sx * .18); body.add(m); return m;
  });
  // mulut senyum terbuka + lidah
  const mouth = new THREE.Group(); mouth.position.set(0, -.13, .705); mouth.rotation.x = .18; body.add(mouth);
  {
    const s = new THREE.Shape(); s.moveTo(-.11, 0); s.lineTo(.11, 0); s.quadraticCurveTo(.1, -.15, 0, -.15); s.quadraticCurveTo(-.1, -.15, -.11, 0);
    mouth.add(new THREE.Mesh(new THREE.ShapeGeometry(s, 12), curved(new THREE.MeshBasicMaterial({ color: '#5a1d3c' }))));
    const tg = new THREE.Mesh(new THREE.CircleGeometry(.055, 16), curved(new THREE.MeshBasicMaterial({ color: '#ff6f91' })));
    tg.position.set(0, -.105, .003); tg.scale.y = .6; mouth.add(tg);
  }
  // pipi merona
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(.075, 18), curved(new THREE.MeshBasicMaterial({ color: '#ff5c8a', transparent: true, opacity: .45, depthWrite: false })));
    c.position.set(sx * .41, -.07, .585); c.rotation.y = sx * .62; c.scale.y = .7; body.add(c);
  }

  // --- tangan (pivot di bahu) ---
  const arms = [-1, 1].map((sx) => {
    const pivot = new THREE.Group(); pivot.position.set(sx * .6, -.02, 0); body.add(pivot);
    const m = builder()
      .add(new THREE.CapsuleGeometry(.085, .2, 4, 10), PINK_DARK, { p: [0, -.16, 0] })
      .add(new THREE.SphereGeometry(.125, 16, 12), skin.hands || '#fff4e2', { p: [0, -.33, 0] })
      .mesh({ outline: .025 });
    pivot.add(m); pivot.userData.sx = sx; return pivot;
  });

  // --- kaki + sepatu (pivot di pinggul, ikut rig bukan badan) ---
  const legs = [-1, 1].map((sx) => {
    const pivot = new THREE.Group(); pivot.position.set(sx * .27, .46, 0); rig.add(pivot);
    const m = builder()
      .add(new THREE.CapsuleGeometry(.085, .14, 4, 10), PINK_DARK, { p: [0, -.13, 0] })
      .add(new THREE.SphereGeometry(.16, 18, 14), SHOE, { p: [0, -.31, .05], s: [1, .72, 1.38] })
      .add(new THREE.SphereGeometry(.12, 14, 10), '#ffffff', { p: [0, -.33, .19], s: [1.05, .6, .7] })
      .add(new THREE.CylinderGeometry(.165, .165, .05, 18), '#ffffff', { p: [0, -.41, .05], s: [1, 1, 1.4] })
      .mesh({ outline: .025 });
    pivot.add(m); return pivot;
  });

  // --- bintang pusing (saat nabrak) ---
  const dizzy = new THREE.Group(); dizzy.position.y = 2.15; dizzy.visible = false; rig.add(dizzy);
  const sg = starGeo();
  for (let i = 0; i < 3; i++) {
    const s = part(sg, toon('#ffd23f', { emissive: '#7a5600', emissiveIntensity: .4 }), { outline: .015, cast: false });
    const a = i / 3 * Math.PI * 2; s.position.set(Math.cos(a) * .55, 0, Math.sin(a) * .55); dizzy.add(s);
  }

  // ---------------------------------------------------------------------------
  // Animasi
  // ---------------------------------------------------------------------------
  let phase = 0, blinkT = 2, blink = 0, squash = 0, wasAir = false, mood = 'happy', facing = 0, t = 0;

  function setMood(m) {
    mood = m;
    const dz = m === 'dizzy';
    eyes.forEach((e) => { e.open.visible = !dz; e.x.visible = dz; });
    dizzy.visible = dz;
    mouth.scale.set(dz ? .7 : 1, dz ? .55 : 1, 1);
  }

  /**
   * @param {number} dt
   * @param {{state:'idle'|'run'|'air'|'slide'|'dizzy', speed?:number, vy?:number, lean?:number}} s
   */
  function update(dt, s) {
    t += dt;
    const k = (v) => Math.min(1, dt * v);
    const st = s.state;

    // hadap: belakang ke kamera saat main, hadap kamera saat menu/nabrak
    const wantFace = st === 'idle' || st === 'dizzy' ? 0 : Math.PI;
    facing += (wantFace - facing) * k(8);
    turn.rotation.y = facing;

    // mendarat → squash
    const air = st === 'air';
    if (wasAir && !air) squash = 1;
    wasAir = air;
    squash = Math.max(0, squash - dt * 5);

    let sy = 1, sxz = 1, armSwing = 0, legSwing = 0, armOut = .35, armUp = 0, bob = 0, tiltX = 0;
    if (st === 'run') {
      phase += dt * (s.speed || 12) * .95;
      legSwing = Math.sin(phase) * .95;
      armSwing = -Math.sin(phase) * .85;
      bob = Math.abs(Math.sin(phase)) * .09;
      tiltX = .12;
    } else if (st === 'air') {
      const vy = s.vy || 0;
      sy = 1 + THREE.MathUtils.clamp(vy * .018, -.08, .16); sxz = 1 - (sy - 1) * .5;
      armUp = 2.5; armOut = .6; legSwing = .5; tiltX = -.08;
    } else if (st === 'slide') {
      sy = .58; sxz = 1.18; armSwing = -1.2; armOut = .25; legSwing = -.6; tiltX = .35;
    } else if (st === 'dizzy') {
      armOut = .9 + Math.sin(t * 6) * .15; bob = Math.sin(t * 3) * .03;
      dizzy.rotation.y += dt * 4;
    } else { // idle: napas + melambai
      bob = Math.sin(t * 2.4) * .04;
      sy = 1 + Math.sin(t * 2.4) * .02; sxz = 1 - Math.sin(t * 2.4) * .01;
    }
    sy -= squash * .22; sxz += squash * .14;

    rig.scale.y += (sy - rig.scale.y) * k(18);
    const nx = rig.scale.x + (sxz - rig.scale.x) * k(18); rig.scale.x = rig.scale.z = nx;
    rig.rotation.z += ((s.lean || 0) - rig.rotation.z) * k(10);
    body.rotation.x += (tiltX - body.rotation.x) * k(10);
    body.position.y = 1.0 + bob;
    body.rotation.z = st === 'run' ? Math.sin(phase) * .06 : st === 'dizzy' ? Math.sin(t * 3) * .12 : 0;

    arms.forEach((a, i) => {
      const sx = a.userData.sx;
      let rx = armSwing * (i ? -1 : 1) * (st === 'slide' ? -1 : 1), rz = sx * armOut;
      if (st === 'slide') rx = armSwing;
      if (st === 'air') { rx = 0; rz = sx * armUp; }
      if (st === 'idle' && i === 1) { rz = sx * (2.3 + Math.sin(t * 9) * .35); rx = 0; } // melambai
      a.rotation.x += (rx - a.rotation.x) * k(16);
      a.rotation.z += (rz - a.rotation.z) * k(16);
    });
    legs.forEach((l, i) => {
      const rx = st === 'air' ? (i ? -legSwing : legSwing * .4) : st === 'slide' ? legSwing : legSwing * (i ? -1 : 1);
      l.rotation.x += (rx - l.rotation.x) * k(st === 'run' ? 30 : 14);
    });

    // kedip
    blinkT -= dt;
    if (blinkT <= 0) { blink = .14; blinkT = 1.8 + Math.random() * 2.6; }
    if (blink > 0) blink -= dt;
    const ey = blink > 0 ? .12 : 1;
    eyes.forEach((e) => { e.eye.scale.y += (ey - e.eye.scale.y) * k(40); });
    brows.forEach((br, i) => { br.position.y = .29 + (mood === 'dizzy' ? .04 : st === 'air' ? .03 : 0); br.rotation.z = Math.PI / 2 + (i ? 1 : -1) * (mood === 'dizzy' ? -.3 : .18); });
  }

  setMood('happy');
  function dispose() { root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); }
  return { root, update, setMood, dispose, get facingCamera() { return Math.abs(facing) < .5; } };
}
