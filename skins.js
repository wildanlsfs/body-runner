// Skin, upgrade, dan simpanan progres (localStorage; tanpa uang sungguhan, tanpa undian).

export const SKINS = [
  { id: 'stroberi', name: 'Stroberi', price: 0, topper: 'cherry', body: '#ff8fb1', belly: '#ffc2d4', limbs: '#f2709a', cream: '#fff4e2', shoe: '#7b61ff' },
  { id: 'cokelat', name: 'Cokelat', price: 60, topper: 'cherry', body: '#a0643f', belly: '#cf9467', limbs: '#84502f', cream: '#fff4e2', shoe: '#ff7b54' },
  { id: 'pandan', name: 'Pandan', price: 120, topper: 'leaf', body: '#7fd36b', belly: '#c9f2ad', limbs: '#5fb84f', cream: '#fff7d6', shoe: '#ff9f1c', sprinkles: ['#ffffff', '#ffd23f', '#ff8fb1'] },
  { id: 'ubi', name: 'Ubi Ungu', price: 200, topper: 'berry', body: '#a77bea', belly: '#dcc8ff', limbs: '#8c5fd6', cream: '#fff4e2', shoe: '#2ec4b6' },
  { id: 'keju', name: 'Keju', price: 320, topper: 'star', body: '#ffd25a', belly: '#fff0a8', limbs: '#f2b630', cream: '#ffffff', shoe: '#e63946', sprinkles: ['#ffe08a', '#ffc93c', '#ffb703'] },
  { id: 'pelangi', name: 'Pelangi', price: 450, topper: 'horn', body: '#ffe3f3', belly: '#ffffff', limbs: '#c9b6ff', cream: '#bde0fe', shoe: '#ff70a6' },
  { id: 'juara', name: 'Juara', price: 0, goal: 1000, topper: 'crown', body: '#ffcf33', belly: '#fff1a8', limbs: '#f0a500', cream: '#ffffff', shoe: '#e63946' },
];
export const TOPPER_ICON = { cherry: '🍒', leaf: '🌿', berry: '🫐', star: '⭐', horn: '🦄', crown: '👑' };

export const POWERS = {
  magnet: { name: 'Magnet', icon: '🧲', desc: 'Bintang tertarik ke Bolu' },
  shield: { name: 'Perisai', icon: '🛡️', desc: 'Kebal 1× tabrakan' },
  double: { name: 'Bintang ×2', icon: '✨', desc: 'Tiap bintang bernilai 2' },
};
export const UP_PRICES = [50, 100, 180];
export const powerDuration = (lvl) => 7 + lvl * 2.5;

const KEY = 'bolu.save';
const fresh = () => ({ wallet: 0, owned: ['stroberi'], skin: 'stroberi', up: { magnet: 0, shield: 0, double: 0 }, bestRun: 0 });
export const save = (() => {
  try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return fresh(); }
})();
export function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} }

export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
export const isOwned = (s) => save.owned.includes(s.id) || (s.goal && save.bestRun >= s.goal);
