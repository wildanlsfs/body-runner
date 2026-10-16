// Skin, jejak, upgrade, dan simpanan progres (localStorage; tanpa uang sungguhan, tanpa undian).
// Harga naik bertahap dan sebagian barang hanya terbuka lewat Level Bolu (lihat progress.js), supaya
// selalu ada tujuan berikutnya tanpa harus main berjam-jam sekaligus.

export const SKINS = [
  { id: 'stroberi', name: 'Stroberi', price: 0, topper: 'cherry', body: '#ff8fb1', belly: '#ffc2d4', limbs: '#f2709a', cream: '#fff4e2', shoe: '#7b61ff' },
  { id: 'cokelat', name: 'Cokelat', price: 150, topper: 'cherry', body: '#a0643f', belly: '#cf9467', limbs: '#84502f', cream: '#fff4e2', shoe: '#ff7b54' },
  { id: 'pandan', name: 'Pandan', price: 300, topper: 'leaf', body: '#7fd36b', belly: '#c9f2ad', limbs: '#5fb84f', cream: '#fff7d6', shoe: '#ff9f1c', sprinkles: ['#ffffff', '#ffd23f', '#ff8fb1'] },
  { id: 'ubi', name: 'Ubi Ungu', price: 500, topper: 'berry', body: '#a77bea', belly: '#dcc8ff', limbs: '#8c5fd6', cream: '#fff4e2', shoe: '#2ec4b6' },
  { id: 'keju', name: 'Keju', price: 800, topper: 'star', body: '#ffd25a', belly: '#fff0a8', limbs: '#f2b630', cream: '#ffffff', shoe: '#e63946', sprinkles: ['#ffe08a', '#ffc93c', '#ffb703'] },
  { id: 'pelangi', name: 'Pelangi', price: 1200, topper: 'horn', body: '#ffe3f3', belly: '#ffffff', limbs: '#c9b6ff', cream: '#bde0fe', shoe: '#ff70a6' },
  { id: 'semangka', name: 'Semangka', price: 1600, topper: 'leaf', body: '#ff5d73', belly: '#ffc2c8', limbs: '#3fa34d', cream: '#e8ffd9', shoe: '#3fa34d', sprinkles: ['#2b1838'] },
  { id: 'kelapa', name: 'Kelapa', price: 2200, topper: 'leaf', body: '#8a5a3c', belly: '#fff8ee', limbs: '#6e4630', cream: '#ffffff', shoe: '#2ec4b6', sprinkles: ['#ffffff', '#e9d8c4'] },
  // hanya lewat Level Bolu
  { id: 'blueberry', name: 'Blueberry', price: 0, level: 5, topper: 'berry', body: '#5b7cfa', belly: '#c9d4ff', limbs: '#4560d8', cream: '#f2f4ff', shoe: '#ffd23f' },
  { id: 'matcha', name: 'Matcha', price: 0, level: 10, topper: 'leaf', body: '#9cc96b', belly: '#e3f2c9', limbs: '#7fae50', cream: '#fffbe8', shoe: '#e76f51', sprinkles: ['#ffffff', '#f4a261'] },
  { id: 'galaksi', name: 'Galaksi', price: 0, level: 15, topper: 'star', body: '#2b2d6e', belly: '#5a4fcf', limbs: '#1f2056', cream: '#c9b6ff', shoe: '#ff70a6', sprinkles: ['#ffffff', '#ffe066', '#9ad7ff'] },
  { id: 'juara', name: 'Juara', price: 0, level: 20, topper: 'crown', body: '#ffcf33', belly: '#fff1a8', limbs: '#f0a500', cream: '#ffffff', shoe: '#e63946' },
  { id: 'legenda', name: 'Legenda', price: 0, level: 30, topper: 'horn', body: '#7b2cbf', belly: '#e0c3fc', limbs: '#5a189a', cream: '#ffd166', shoe: '#ffd166', sprinkles: ['#ffd166', '#ffffff', '#ff9e00'] },
];
export const TOPPER_ICON = { cherry: '🍒', leaf: '🌿', berry: '🫐', star: '⭐', horn: '🦄', crown: '👑' };

// Jejak: emoji kecil yang beterbangan di belakang Bolu saat berlari
export const TRAILS = [
  { id: 'none', name: 'Tanpa jejak', icon: '🚫', price: 0 },
  { id: 'sparkle', name: 'Debu Bintang', icon: '✨', price: 0, level: 3 },
  { id: 'heart', name: 'Hati', icon: '💖', price: 400 },
  { id: 'leaf', name: 'Daun', icon: '🍃', price: 0, level: 8 },
  { id: 'snow', name: 'Salju', icon: '❄️', price: 700 },
  { id: 'note', name: 'Nada', icon: '🎵', price: 0, level: 12 },
  { id: 'fire', name: 'Api', icon: '🔥', price: 1000 },
  { id: 'rainbow', name: 'Pelangi', icon: '🌈', price: 0, level: 18 },
  { id: 'candy', name: 'Permen', icon: '🍬', price: 1400 },
  { id: 'crown', name: 'Mahkota', icon: '👑', price: 0, level: 25 },
];

export const POWERS = {
  magnet: { name: 'Magnet', icon: '🧲', desc: 'Bintang tertarik ke Bolu' },
  shield: { name: 'Perisai', icon: '🛡️', desc: 'Kebal 1× tabrakan' },
  double: { name: 'Bintang ×2', icon: '✨', desc: 'Tiap bintang bernilai 2' },
};
export const UP_PRICES = [100, 200, 350, 550, 800];
export const UP_MAX = UP_PRICES.length;
export const powerDuration = (lvl) => 7 + lvl * 2;

const KEY = 'bolu.save';
const fresh = () => ({
  wallet: 0, owned: ['stroberi'], skin: 'stroberi', up: { magnet: 0, shield: 0, double: 0 }, bestRun: 0,
  trail: 'none', ownedTrails: ['none'],
  xp: 0, level: 1,
  life: { dist: 0, jumps: 0, ducks: 0, coins: 0, runs: 0, missions: 0, playSec: 0 },
  days: 0, lastDay: '', daily: null, ach: {},
});
export const save = (() => {
  try {
    const s = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    s.life = { ...fresh().life, ...s.life }; s.up = { ...fresh().up, ...s.up };
    return s;
  } catch { return fresh(); }
})();
export function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} }

export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
export const trailById = (id) => TRAILS.find((t) => t.id === id) || TRAILS[0];
export const isOwned = (s) => save.owned.includes(s.id) || (s.level && save.level >= s.level);
export const ownsTrail = (t) => t.price === 0 && !t.level ? true : save.ownedTrails.includes(t.id) || (t.level && save.level >= t.level);
