// Progres jangka panjang yang sehat untuk anak:
//  • Misi harian: 3 misi gerak per hari (ganti tiap tengah malam). Tidak ada hukuman kalau terlewat.
//  • Level Bolu 1–30: XP dari jarak, lompat, jongkok, dan bintang. Tiap naik level dapat bintang;
//    level tertentu membuka skin/jejak khusus. Barang & hadiahnya terlihat dari awal (bukan undian).
//  • Prestasi: target besar (total lari, lompat, hari bermain…) dengan medali perunggu/perak/emas.
//  • Hari bermain dihitung total, bukan beruntun, jadi anak tidak "kehilangan" apa pun saat libur.
import { save, persist, SKINS, TRAILS, isOwned } from './skins.js';

export const LEVEL_MAX = 30;
export const xpNeed = (lvl) => 150 + 60 * lvl + 4 * lvl * lvl; // XP dari level lvl ke lvl+1: awal cepat, makin tinggi makin menantang
export const levelStars = (lvl) => 30 + 8 * lvl;        // hadiah bintang saat mencapai lvl
export const unlocksAt = (lvl) => [...SKINS.filter((s) => s.level === lvl).map((s) => ({ kind: 'skin', ...s })), ...TRAILS.filter((t) => t.level === lvl).map((t) => ({ kind: 'trail', ...t }))];
export const nextUnlock = () => {
  for (let l = save.level + 1; l <= LEVEL_MAX; l++) { const u = unlocksAt(l); if (u.length) return { level: l, item: u[0] }; }
  return null;
};

// --- misi harian ---
const POOL = [
  { id: 'coins', stat: 'coins', n: [80, 140, 220], text: (n) => `Kumpulkan ${n} ⭐` },
  { id: 'dist', stat: 'dist', n: [1200, 2200, 3500], text: (n) => `Lari total ${n.toLocaleString('id-ID')} m` },
  { id: 'jumps', stat: 'jumps', n: [15, 30, 50], text: (n) => `Lompat ${n} kali` },
  { id: 'ducks', stat: 'ducks', n: [12, 25, 40], text: (n) => `Merunduk ${n} kali` },
  { id: 'dives', stat: 'dives', n: [3, 6, 10], text: (n) => `Menukik ${n} kali (lompat lalu jongkok)` },
  { id: 'powers', stat: 'powers', n: [2, 4, 6], text: (n) => `Ambil ${n} power-up` },
  { id: 'runs', stat: 'runs', n: [3, 4, 6], text: (n) => `Main ${n} putaran` },
  { id: 'score', stat: 'score', max: true, n: [400, 800, 1300], text: (n) => `Skor ${n} dalam 1 putaran` },
  { id: 'lanes', stat: 'lanes', n: [30, 60, 100], text: (n) => `Pindah jalur ${n} kali` },
];
const REWARD = [50, 80, 120], BONUS = [100, 150, 220];
const POOL_BY_ID = new Map(POOL.map((p) => [p.id, p]));

export function todayKey(d = new Date()) { return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function seeded(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }

/** Misi hari ini (dibuat sekali per hari; tingkat kesulitan mengikuti level). */
export function daily() {
  const key = todayKey();
  if (!save.daily || save.daily.date !== key) {
    const tier = Math.min(2, Math.floor((save.level - 1) / 8));
    const r = seeded(key), pool = [...POOL];
    const list = [];
    while (list.length < 3) { const p = pool.splice(Math.floor(r() * pool.length), 1)[0]; list.push({ id: p.id, n: p.n[tier], reward: REWARD[tier] }); }
    save.daily = { date: key, tier, list, prog: {}, done: [], bonus: false };
    persist();
  }
  return save.daily;
}
export const missionText = (m) => POOL_BY_ID.get(m.id).text(m.n);
/** Kemajuan misi; `run` = statistik putaran yang sedang berjalan (belum disimpan). */
export function missionValue(m, run) {
  const p = POOL_BY_ID.get(m.id), base = daily().prog[p.stat] || 0, cur = run ? (p.stat === 'runs' ? 1 : run[p.stat] || 0) : 0;
  return p.max ? Math.max(base, cur) : base + cur;
}
/** Misi yang baru saja tercapai di tengah putaran (untuk pengumuman), tanpa menyimpan apa pun. */
export function newlyReached(run, announced) {
  return daily().list.filter((m) => !save.daily.done.includes(m.id) && !announced.has(m.id) && m.id !== 'runs' && missionValue(m, run) >= m.n);
}

// --- prestasi ---
export const ACH = [
  { id: 'dist', icon: '🏃', name: 'Pelari', unit: 'm', tiers: [5000, 25000, 100000], reward: [100, 250, 600], value: () => save.life.dist },
  { id: 'jumps', icon: '🦘', name: 'Pelompat', unit: 'lompatan', tiers: [100, 500, 2000], reward: [100, 250, 600], value: () => save.life.jumps },
  { id: 'ducks', icon: '🙇', name: 'Si Gesit', unit: 'rundukan', tiers: [100, 500, 2000], reward: [100, 250, 600], value: () => save.life.ducks },
  { id: 'coins', icon: '⭐', name: 'Kolektor', unit: 'bintang', tiers: [1000, 5000, 20000], reward: [100, 250, 600], value: () => save.life.coins },
  { id: 'days', icon: '📅', name: 'Rajin Bergerak', unit: 'hari', tiers: [3, 7, 30], reward: [150, 300, 800], value: () => save.days },
  { id: 'missions', icon: '🎯', name: 'Penakluk Misi', unit: 'misi', tiers: [10, 50, 150], reward: [150, 300, 800], value: () => save.life.missions },
  { id: 'score', icon: '🏆', name: 'Juara Skor', unit: 'skor', tiers: [1000, 2500, 5000], reward: [100, 250, 600], value: () => save.bestRun },
  { id: 'skins', icon: '👕', name: 'Fashionista', unit: 'skin', tiers: [3, 6, 10], reward: [100, 250, 600], value: () => SKINS.filter(isOwned).length },
];
export const MEDAL = ['', '🥉', '🥈', '🥇'];
const claimAch = (out) => {
  for (const a of ACH) {
    let t = save.ach[a.id] || 0;
    while (t < a.tiers.length && a.value() >= a.tiers[t]) { out.stars += a.reward[t]; out.ach.push({ ...a, tier: t + 1, stars: a.reward[t] }); t++; }
    save.ach[a.id] = t;
  }
};
export function checkAchievements() { const out = { stars: 0, ach: [] }; claimAch(out); save.wallet += out.stars; persist(); return out; }

/**
 * Selesai satu putaran: simpan statistik, misi, XP/level, prestasi. Mengembalikan hadiah untuk ditampilkan.
 * run = { dist, coins, score, jumps, ducks, dives, powers, lanes, sec }
 */
export function endRun(run) {
  const out = { stars: 0, xp: 0, levels: [], missions: [], bonus: 0, ach: [], newDay: false };
  const L = save.life;
  L.dist += Math.floor(run.dist); L.jumps += run.jumps; L.ducks += run.ducks; L.coins += run.coins; L.runs++; L.playSec += run.sec;
  const key = todayKey();
  if (save.lastDay !== key) { save.lastDay = key; save.days++; out.newDay = true; }

  const D = daily();
  for (const p of POOL) {
    const v = p.stat === 'runs' ? 1 : run[p.stat] || 0;
    D.prog[p.stat] = p.max ? Math.max(D.prog[p.stat] || 0, v) : (D.prog[p.stat] || 0) + v;
  }
  for (const m of D.list) {
    if (D.done.includes(m.id) || (D.prog[POOL_BY_ID.get(m.id).stat] || 0) < m.n) continue;
    D.done.push(m.id); out.missions.push(m); out.stars += m.reward; L.missions++;
  }
  if (!D.bonus && D.done.length === D.list.length) { D.bonus = true; out.bonus = BONUS[D.tier]; out.stars += out.bonus; }

  out.xp = Math.floor(run.dist / 5) + 2 * (run.jumps + run.ducks) + run.coins;
  save.xp += out.xp;
  while (save.level < LEVEL_MAX && save.xp >= xpNeed(save.level)) {
    save.xp -= xpNeed(save.level); save.level++;
    const st = levelStars(save.level); out.stars += st;
    out.levels.push({ level: save.level, stars: st, unlocks: unlocksAt(save.level) });
  }
  if (save.level >= LEVEL_MAX) save.xp = Math.min(save.xp, xpNeed(LEVEL_MAX));

  claimAch(out);
  save.wallet += out.stars;
  persist();
  return out;
}
