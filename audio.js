// Suara ceria yang disintesis (tanpa file audio). Dibuat lazily setelah interaksi pengguna.
let ctx = null, master = null, muted = false;
try { muted = localStorage.getItem('bolu.muted') === '1'; } catch {}

function ensure() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
}
export function unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function setMuted(m) { muted = m; try { localStorage.setItem('bolu.muted', m ? '1' : '0'); } catch {} if (master) master.gain.value = m ? 0 : 0.5; }
export function isMuted() { return muted; }

function tone(freq, { type = 'sine', dur = 0.15, vol = 0.4, slide = 0, delay = 0 } = {}) {
  ensure(); if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}

export const sfx = {
  coin: () => { tone(1046, { dur: .09, vol: .25 }); tone(1568, { dur: .14, vol: .25, delay: .06 }); },
  jump: () => tone(300, { type: 'triangle', dur: .22, vol: .3, slide: 420 }),
  duck: () => tone(420, { type: 'triangle', dur: .16, vol: .22, slide: -220 }),
  lane: () => tone(660, { type: 'square', dur: .05, vol: .08 }),
  bump: () => { tone(160, { type: 'sawtooth', dur: .3, vol: .35, slide: -100 }); tone(90, { type: 'square', dur: .35, vol: .2, delay: .05 }); },
  start: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, { dur: .16, vol: .25, delay: i * .09 })),
  cheer: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, { type: 'triangle', dur: .2, vol: .25, delay: i * .08 })),
  tick: () => tone(880, { dur: .06, vol: .15 }),
};
