/* =============================================================================
 * ELEMENTS AND STATUSES
 * An element is a damage type with a color family and a status it tends to apply. A status lives on any unit
 * (hero, monster, ally) in unit.st[id] = { t, p, n } (time left, power, stacks) and ticks in tickStatus.
 * ============================================================================= */
def('elements', 'phys', { name: 'Physical', short: 'PHYS', color: '#e8dcc8', light: '#fff8e8', dark: '#8a7c6a', glow: '#ffe8c0', status: 'bleed', smear: ['#ffffff', '#f0ece4', '#c8c0b4', '#8a8478'], sfx: 'hit' });
def('elements', 'fire', { name: 'Fire', short: 'FIRE', color: '#ff8a3a', light: '#ffe070', dark: '#b83a1a', glow: '#ffb050', status: 'burn', smear: ['#fffbe0', '#ffe070', '#ff8a3a', '#c83a1a'], sfx: 'hit' });
def('elements', 'frost', { name: 'Frost', short: 'COLD', color: '#7fd8ff', light: '#e8fbff', dark: '#2f6ab0', glow: '#a8ecff', status: 'chill', smear: ['#ffffff', '#dff8ff', '#8fe0f2', '#4bb1d4'], sfx: 'hit' });
def('elements', 'storm', { name: 'Storm', short: 'STORM', color: '#ffe45a', light: '#fffbd0', dark: '#b08a1a', glow: '#fff0a0', status: 'shock', smear: ['#ffffff', '#fff8c0', '#ffe45a', '#c8a020'], sfx: 'hit' });
def('elements', 'void', { name: 'Void', short: 'VOID', color: '#b070ff', light: '#ecd8ff', dark: '#4a2090', glow: '#c890ff', status: 'curse', smear: ['#f4e8ff', '#d8b0ff', '#a060f0', '#5a2a9a'], sfx: 'hit' });
def('elements', 'venom', { name: 'Venom', short: 'VENOM', color: '#8ae04a', light: '#e0ffc0', dark: '#3a7a1a', glow: '#b8f080', status: 'poison', smear: ['#f0ffe0', '#c8f090', '#8ae04a', '#3a8a2a'], sfx: 'hit' });
const EL = id => REG.elements[id] || REG.elements.phys;
const ELEMENT_IDS = ['phys', 'fire', 'frost', 'storm', 'void', 'venom'];

/* Statuses. apply(u, power, src) sets or stacks it; tick(u, s, dt) runs every step while it lasts.
 * power is damage per second for damage-over-time statuses (a share of the hit that applied it). */
def('statuses', 'burn', { name: 'Burning', color: '#ff8a3a', dur: 3,
  apply(u, p) { const s = u.st.burn; if (s) { s.t = 3; s.p = Math.max(s.p, p); } else u.st.burn = { t: 3, p }; },
  tick(u, s, dt) { dot(u, s.p * dt, 'fire', s); if (Math.random() < dt * 9) P.add({ kind: 'fire', x: u.x + (Math.random() - .5) * u.r * 2, y: u.y + (Math.random() - .5) * u.r * 2, z: (u.z || 0) + 4 + Math.random() * (u.head || 20) * .6, vz: 20, g: -10, drag: 3, max: .3, size: 2.2 }); } });
def('statuses', 'chill', { name: 'Chilled', color: '#7fd8ff', dur: 2.5,
  // each application adds a stack (slower); at 5 stacks the unit freezes solid for a moment. A monster takes
  // 1 + power stacks (the hero's frost skills freeze in one blow). The HERO takes one or two per chilling hit and
  // thaws with two seconds' grace: the default power is 40% of the hit, so any frost blow over ~10 used to freeze
  // him outright, and a frost pack could lock him in ice again the moment he thawed
  apply(u, p) {
    const s = u.st.chill || (u.st.chill = { t: 0, p: 0, n: 0 }), hero = u.team === 'hero'; s.t = 2.5;
    s.n = Math.min(5, s.n + (hero ? (p >= 2 ? 2 : 1) : p > 0 ? 1 + Math.floor(p) : 1));
    if (s.n >= 5 && !u.st.freeze && !u.boss && !(hero && game.time < (u.thawT || 0))) { delete u.st.chill; u.st.freeze = { t: hero ? .6 : 1.2 }; if (hero) u.thawT = game.time + 2.6; P.glints(u.x, u.y, (u.head || 20) * .5, 6, '#e8fbff'); sfx('freeze'); }
  },
  tick(u, s) { if (Math.random() < .02) P.glints(u.x, u.y, (u.z || 0) + 6 + Math.random() * 10, 1, '#dff8ff', 6); } });
def('statuses', 'freeze', { name: 'Frozen', color: '#bfefff', dur: 1.2, tick() {} });
def('statuses', 'shock', { name: 'Shocked', color: '#ffe45a', dur: 3,
  apply(u) { u.st.shock = { t: 3 }; },
  tick(u) { if (Math.random() < .05) P.sparks(u.x, u.y, (u.z || 0) + (u.head || 20) * .6, 2, null, { color: '#ffe45a', hot: '#ffffff' }); } });
def('statuses', 'curse', { name: 'Cursed', color: '#b070ff', dur: 4,
  apply(u) { u.st.curse = { t: 4 }; },
  tick(u) { if (Math.random() < .05) P.add({ kind: 'ember', x: u.x + (Math.random() - .5) * 8, y: u.y, z: (u.head || 20) + 2, vz: 12, max: .6, color: '#b070ff' }); } });
def('statuses', 'poison', { name: 'Poisoned', color: '#8ae04a', dur: 4,
  apply(u, p) { const s = u.st.poison || (u.st.poison = { t: 0, p: 0, n: 0 }); s.t = 4; s.n = Math.min(10, s.n + 1); s.p = Math.max(s.p, p); },
  tick(u, s, dt) { dot(u, s.p * s.n * .5 * dt, 'venom', s); if (Math.random() < dt * 4) P.add({ kind: 'dust', x: u.x, y: u.y, z: (u.head || 20) * .7, vz: 10, g: -6, drag: 3, max: .5, size: 1.4, color: '#8ae04a' }); } });
def('statuses', 'bleed', { name: 'Bleeding', color: '#d83a3a', dur: 3,
  apply(u, p) { const s = u.st.bleed; if (s) { s.t = 3; s.p += p * .5; } else u.st.bleed = { t: 3, p }; },
  tick(u, s, dt) { const moving = Math.hypot(u.vx || 0, u.vy || 0) > 10; dot(u, s.p * (moving ? 1.6 : 1) * dt, 'phys', s); if (Math.random() < dt * 5) P.add({ kind: 'bit', x: u.x, y: u.y, z: (u.head || 20) * .5, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, vz: 30, g: 300, max: .5, color: '#a82a2a' }); } });
def('statuses', 'stun', { name: 'Stunned', color: '#fff2c4', dur: 1, tick(u) { if (Math.random() < .1) P.glints(u.x, u.y, (u.head || 20) + 3, 1, '#fff2c4', 6); } });
def('statuses', 'fear', { name: 'Afraid', color: '#c8b0ff', dur: 2, tick() {} });
def('statuses', 'slow', { name: 'Slowed', color: '#9ab8d8', dur: 2, tick() {} });
def('statuses', 'haste', { name: 'Hasted', color: '#8affc8', dur: 5, tick() {} });
def('statuses', 'vuln', { name: 'Exposed', color: '#ff6a8a', dur: 4, tick() {} });

/** damage over time: no hit reaction, a small number every so often, can kill */
function dot(u, amount, el, s) {
  if (!u.alive || amount <= 0) return;
  const res = u.team === 'foe' ? 0 : (u.res && u.res[el] || 0);
  const k = u.team === 'foe' ? DIFF.heroDmg : DIFF.foeDmg;
  u.hp -= amount * (1 - res) * k;
  s.acc = (s.acc || 0) + amount; s.nt = (s.nt || 0) - 1 / 120;
  if (s.nt <= 0 && OPT.numbers && u.team === 'foe' && s.acc >= 1) { s.nt = .5; P.text(u.x + (Math.random() - .5) * 8, u.y, (u.z || 0) + (u.head || 20), fmt(s.acc), EL(el).color); s.acc = 0; }
  if (u.hp <= 0) killUnit(u, { src: s.src || null, el, amount, tags: ['dot'] });
}
/** apply a status by id with a power; bosses and the hero shrug off some */
function applyStatus(u, id, power = 0, src = null) {
  if (!u.alive) return;
  const S = REG.statuses[id]; if (!S) return;
  if ((id === 'stun' || id === 'fear') && u.boss) return;
  power *= TUNE.statusPower; const t0 = u.st[id] ? u.st[id].t : 0;
  if (S.apply) S.apply(u, power, src); else u.st[id] = { t: S.dur, p: power };
  const s1 = u.st[id]; if (s1 && TUNE.statusTime !== 1 && s1.t !== t0) s1.t = t0 + (s1.t - t0) * TUNE.statusTime;   // (Tuning's Status duration)
  if (s1) s1.src = src;
}
/** run statuses for one unit (called by the unit's own update) */
function tickStatus(u, dt) {
  for (const id in u.st) {
    const s = u.st[id]; s.t -= dt;
    if (s.t <= 0) { delete u.st[id]; continue; }
    const S = REG.statuses[id]; if (S && S.tick) S.tick(u, s, dt);
    if (!u.alive) return;
  }
}
/** how fast a unit acts right now: chill stacks, slow, haste, freeze and stun */
function statusSpeed(u) {
  const st = u.st; if (st.freeze || st.stun) return 0;
  let k = 1; if (st.chill) k *= 1 - .1 * st.chill.n; if (st.slow) k *= .6; if (st.haste) k *= 1.35; return k;
}
/** the tint a unit shows for its strongest visible status (drawn as a flash overlay). A gentle, slow pulse, never an
 *  on / off gate: burn and shock used to strobe at 5-6 Hz, and a boss that is nearly always burning or shocked showed
 *  a white-orange flicker instead of its own colors. The palette must always read through; the particles say the rest */
function statusTint(u) {
  const st = u.st, t = game.time, ph = u.ph || 0, k = u.boss ? .7 : 1;   // (a steady phase per unit) a boss's own palette is its showpiece
  if (st.freeze) return ['#c8f4ff', .42 * k];
  if (st.burn) return ['#ff9a4a', (.1 + .05 * Math.sin(t * 6 + ph)) * k];
  if (st.shock) return ['#fff4a0', (.1 + .06 * Math.sin(t * 7 + ph)) * k];
  if (st.poison) return ['#8ae04a', (.11 + .03 * Math.sin(t * 4 + ph)) * k];
  if (st.curse) return ['#9a60e0', (.12 + .03 * Math.sin(t * 4 + ph)) * k];
  if (st.chill) return ['#9fdfff', (.07 + st.chill.n * .035) * k];
  return null;
}
