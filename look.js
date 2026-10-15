// Gaya visual kartun: toon shading 3 tingkat, garis tepi (inverted hull), dan penggabung geometri
// ber-vertex-color supaya tiap properti cukup 1 draw call (+1 untuk garis tepi).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const INK = '#3b2347';

// ---------------------------------------------------------------------------
// Dunia melengkung: hanya posisi di layar (gl_Position) yang dibengkokkan; posisi dunia untuk
// cahaya & bayangan tetap lurus, jadi bayangan tetap pas. Makin jauh dari kamera, makin turun
// (cakrawala membulat) dan bergeser ke samping (jalan tampak berbelok).
// ---------------------------------------------------------------------------
export const curve = { uCurve: { value: 0.0016 }, uBendX: { value: 0 } };
THREE.ShaderChunk.common += '\n#ifdef CURVED\nuniform float uCurve;\nuniform float uBendX;\n#endif\n';
THREE.ShaderChunk.project_vertex += `
#ifdef CURVED
{
  vec4 cw = modelMatrix * vec4( transformed, 1.0 );
  float d = min( cw.z - cameraPosition.z, 0.0 );
  cw.y -= uCurve * d * d;
  cw.x += uBendX * d * d;
  gl_Position = projectionMatrix * viewMatrix * cw;
}
#endif
`;
/** Ikutkan material ke efek dunia melengkung. */
export function curved(m) {
  m.defines = { ...(m.defines || {}), CURVED: '' };
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); Object.assign(sh.uniforms, curve); };
  return m;
}

const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();

const cache = new Map();
/** Material toon bersama per warna. */
export function toon(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!cache.has(key)) cache.set(key, curved(new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra })));
  return cache.get(key);
}
export const vtoon = curved(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp }));
/** Versi tidak melengkung untuk latar jauh (gunung, awan). */
export const flatToon = (extra = {}) => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp, ...extra });

const inkCache = new Map();
/** Material garis tepi: permukaan belakang yang didorong keluar sepanjang normal. */
function inkMat(thick, bend) {
  const key = thick + (bend ? 'c' : 'f');
  if (!inkCache.has(key)) {
    const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
    m.onBeforeCompile = (s) => {
      s.uniforms.thick = { value: thick };
      s.vertexShader = 'uniform float thick;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * thick;');
    };
    m.customProgramCacheKey = () => 'ink';
    inkCache.set(key, bend ? curved(m) : m);
  }
  return inkCache.get(key);
}

/** Tambahkan garis tepi ke mesh (sebagai anak, ikut transformasinya). Ikut melengkung bila mesh-nya melengkung. */
export function ink(mesh, thick = 0.035) {
  const bend = !!(mesh.material.defines && 'CURVED' in mesh.material.defines);
  const o = new THREE.Mesh(mesh.geometry, inkMat(thick, bend));
  o.raycast = () => {};
  mesh.add(o);
  return mesh;
}

/** Mesh toon + bayangan + garis tepi dalam satu panggilan. */
export function part(geo, color, { outline = 0.035, cast = true, receive = false } = {}) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? toon(color) : color);
  m.castShadow = cast; m.receiveShadow = receive;
  if (outline) ink(m, outline);
  return m;
}

/**
 * Penggabung: kumpulkan potongan geometri (warna + transform), lalu jadikan satu BufferGeometry.
 *   const b = builder(); b.add(new THREE.SphereGeometry(1), '#f00', { p:[0,1,0], s:[1,.8,1] }); b.mesh()
 */
export function builder() {
  const parts = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const api = {
    add(geo, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
      let g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      m4.compose(new THREE.Vector3(...p), q.setFromEuler(e.set(...r)), new THREE.Vector3(...(typeof s === 'number' ? [s, s, s] : s)));
      g.applyMatrix4(m4);
      const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      parts.push(g);
      return api;
    },
    geometry() { const g = mergeGeometries(parts); g.computeBoundingSphere(); return g; },
    mesh({ outline = 0.04, cast = true, receive = false, material = vtoon } = {}) {
      const m = new THREE.Mesh(api.geometry(), material);
      m.castShadow = cast; m.receiveShadow = receive;
      if (outline) ink(m, outline);
      return m;
    },
  };
  return api;
}

/** Tekstur kanvas kecil. */
export function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4;
  return t;
}
