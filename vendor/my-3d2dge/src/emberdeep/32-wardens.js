/* =============================================================================
 * WARDENS: the deep's bell-keepers, and the engine's perception kit (E.sees, E.Suspicion, E.hears, r.sightCone,
 * r.marker) in a hack-and-slash. From depth 3 a Warden walks a beat on every level that has no boss (one, two from
 * depth 8, three from 20): a hooded figure with a lantern on a staff, sweeping its light at each end of its beat.
 *   sight    it sees down its lantern's cone (TUNE.wardenSight, 1.5 radians wide): walls and pillars cut the cone short,
 *            and the cone drawn on the floor (r.sightCone) is exactly what it sees. Nearer and more of you seen, faster
 *   its mind E.Suspicion: calm (its beat), notice (it stops and turns: '?'), search (it walks to where it saw you, and
 *            looks round), alert ('!'). A hit from anywhere, or a noise it hears (E.hears), tells it where you are
 *   the bell alert, it rings for TUNE.wardenRing seconds, its lantern held high (a marker shows which one, on screen or
 *            at its edge); a stagger restarts the ring. The alarm wakes every monster that hears it (TUNE.wardenAlarm,
 *            halved through a wall), and they come. Then it fights with its staff
 *   tithe    a Warden that never rang leaves gold and a magic item or better
 * Take one down from behind (E, 23-executions.js: archetype takedown: true) before it sees you. Speedrunners ring the
 * alarm on purpose: the level comes to them. Private names start with WDN_.
 * ============================================================================= */
A.define('wdnBell', [{ wave: 'sine', freq: 988, dur: .7, vol: .2 }, { wave: 'sine', freq: 988 * 2.76, dur: .3, vol: .07 }, { wave: 'triangle', freq: 988 * 5.4, dur: .08, vol: .05 }]);
A.define('wdnAlarm', [{ wave: 'sine', freq: 660, dur: 1.4, vol: .26, vib: [5, .04] }, { wave: 'sine', freq: 660 * 2.76, dur: .8, vol: .1 }, { wave: 'triangle', freq: 330, dur: 1.2, vol: .14 }, { wave: 'noise', freq: 4000, to: 900, dur: .2, vol: .12 }]);
A.define('wdnSpot', { wave: 'triangle', freq: 520, to: 880, dur: .14, vol: .16 });
const WDN_FOV = 1.5, WDN_COLOR = { calm: '#ffe08a', notice: '#ffc04a', search: '#ff9a3a', alert: '#ff5a3a' };
const WDN_count = depth => depth < 3 ? 0 : depth < 8 ? 1 : depth < 20 ? 2 : 3;
/** floor a Warden must not stand or walk on */
const WDN_bad = (L0, x, y) => { const map = L0.map, cx = Math.floor(x / T16), cy = Math.floor(y / T16); return !map.walkable(cx, cy) || ['pit', 'deep', 'lava'].includes(map.floorAt(x, y)); };
/** its mind and its beat (made when it spawns): { mind, a, b (the far end, or null: it stands its ground), to, wait, ring, rung } */
function WDN_state(m) { return m.ai.wd || (m.ai.wd = { mind: new E.Suspicion({ rise: 1.6, decay: .25, forget: 5 }), a: { x: m.x, y: m.y }, b: null, to: 'b', wait: 1 + Math.random(), ring: 0, rung: false, sweep: m.facing, st: 0 }); }

def('archetypes', 'warden', { name: 'Warden', tags: ['undead', 'melee', 'sentry'], minDepth: 3, weight: 0, noPack: true, takedown: true,
  hp: 34, dmg: 8, speed: 30, r: 5, xp: 24, head: 31, stance: 'ready',
  rig: { build: 'heroic', weapon: 'staff', outfit: 'robe', hood: true, sleeves: 'long', hunch: .12, eyeGlow: '#ffd060' },
  palettes: [
    { cloth: '#3e4436', skin: '#a8ae96', hair: '#2a2c26', pants: '#2c3028', boot: '#221e1a', belt: '#7a6440', staff: '#4a3420', orb: '#ffd36a' },
    { cloth: '#46363a', skin: '#b0a49a', hair: '#2a2224', pants: '#30262a', boot: '#221a1c', belt: '#8a6a40', staff: '#3e2c1c', orb: '#ffc860' },
    { cloth: '#343c48', skin: '#a0a8b0', hair: '#24262e', pants: '#282c36', boot: '#1c1e24', belt: '#6a6a7a', staff: '#46342a', orb: '#ffe08a' }], elKeys: ['cloth'],
  ai: 'warden', attacks: [{ move: 'overhead', dmg: 1.2, kb: 120 }, { move: 'thrust', dmg: .9 }, { move: 'slash', dmg: 1 }],
  onSpawn(m) {
    WDN_state(m);
    m.drawExtra = (g, ox, oy, view) => WDN_lantern(g, m, ox, oy, view);
    m.hear = (k, at) => { const W = WDN_state(m); if (!W.rung) W.mind.hear(k, at); };   // (23-executions.js: makeNoise)
  },
  react(m, hit) {   // struck from anywhere: it knows where you are
    const W = WDN_state(m), s = hit.src; if (W.rung) return;
    W.mind.level = Math.max(W.mind.level, W.mind.alert); if (s && s.x !== undefined) W.mind.last = { x: s.x, y: s.y, z: s.z || 0 };
  },
  onDie(m) {   // it never rang: its tithe
    const W = m.ai.wd; if (m.noLoot || (W && W.rung)) return;
    const d = m.level || ED.depth || 1, h = ED.hero;
    dropLoot('item', m.x, m.y, { item: makeItem({ ilvl: d + 1, rarity: Math.max(1, rollRarity(d, rnd, ((h && h.stats.magicFind) || 0) + TUNE.rarityBoost, .25)) }) });
    for (let i = 0; i < 2; i++) dropLoot('gold', m.x, m.y, { n: Math.max(1, Math.round((5 + rnd() * 8) * TUNE.goldDrop * SCALE.gold(d))) });
    notify("THE WARDEN'S TITHE", '#ffd36a', 2);
  } });

/* ---------- its mind ---------- */
def('ai', 'warden', { update(m, dt) {
  const W = WDN_state(m), h = ED.hero, L0 = ED.L;
  m.rigState = null;
  if (W.rung) { REG.ai.melee.update(m, dt); return; }   // the alarm is out: it fights with its staff
  if (m.ai.aware && W.mind.level < W.mind.alert) { W.mind.level = W.mind.alert; if (h) W.mind.last = { x: h.x, y: h.y, z: h.z }; }   // told outright (the bestiary's walk-on, a dev spawn)
  const seen = h && h.alive && !h.dead && L0 && L0.map ? E.sees(m, h, { map: L0.map, range: TUNE.wardenSight, fov: WDN_FOV }) : false;
  const was = W.mind.state, st = W.mind.update(dt, seen, h), last = W.mind.last;
  m.alarmed = st === 'alert';   // (no takedown once it is alert)
  if (st !== was) WDN_said(m, st, was);
  if (st === 'alert') { WDN_ring(m, W, dt); return; }
  W.ring = 0;
  if (st === 'notice' && last) { AI.move(m, [0, 0], dt); AI.face(m, Math.atan2(last.y - m.y, last.x - m.x), dt, 3); return; }
  if (st === 'search' && last) {   // it walks to where it saw you, then turns on the spot, its light sweeping round
    const dx = last.x - m.x, dy = last.y - m.y, d = Math.hypot(dx, dy);
    if (d > 6) { AI.move(m, [dx / d, dy / d], dt, .55); AI.face(m, Math.atan2(dy, dx), dt, 5); } else { AI.move(m, [0, 0], dt); m.facing += dt * 1.6; }
    return;
  }
  WDN_patrol(m, W, dt);
} });
/** calm: walk to one end of the beat, stand and sweep the light, walk back */
function WDN_patrol(m, W, dt) {
  const t = W.to === 'b' && W.b ? W.b : W.a, dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy);
  if (W.wait > 0 || d < 4) {
    if (W.wait <= 0) { W.wait = 1.6 + Math.random() * 1.2; W.sweep = m.facing; W.st = 0; }
    W.wait -= dt; W.st += dt; AI.move(m, [0, 0], dt);
    m.facing = W.sweep + Math.sin(W.st * 1.7) * .75;
    if (W.wait <= 0 && W.b) W.to = W.to === 'b' ? 'a' : 'b';
    return;
  }
  AI.move(m, [dx / d, dy / d], dt, .5); AI.face(m, Math.atan2(dy, dx), dt, 4);
}
/** what it says when its mind changes: '?' when it notices or searches, '!' when it is sure */
function WDN_said(m, st, was) {
  const z = (m.z || 0) + (m.head || 31) * (m.scale || 1) + 8;
  if (st === 'notice' && was === 'calm') { P.text(m.x, m.y, z, '?', '#ffd36a', { scale: 2 }); sfx('wdnSpot', { vol: .5 }); }
  else if (st === 'search' && was !== 'alert') P.text(m.x, m.y, z, '?', '#ff9a3a', { scale: 2 });
  else if (st === 'alert') { P.text(m.x, m.y, z, '!', '#ff5a3a', { scale: 2 }); sfx('wdnSpot', { vol: .7, pitch: 1.4 }); if (ED.mode === 'level') tip('warden', "A WARDEN SAW YOU: STRIKE IT BEFORE IT RINGS  •  OUT OF ITS LIGHT, TAKE ONE DOWN FROM BEHIND (E)", '#ffd36a'); }
}
/** alert: stand, lift the lantern and ring. A stagger (or a stun) restarts the ring */
function WDN_ring(m, W, dt) {
  AI.move(m, [0, 0], dt);
  const last = W.mind.last; if (last) AI.face(m, Math.atan2(last.y - m.y, last.x - m.x), dt, 4);
  if (m.stunT > 0 || m.kbT > 0) { if (W.ring > .3) P.text(m.x, m.y, (m.z || 0) + (m.head || 31) + 8, 'SILENCED', '#c8c0d8'); W.ring = 0; return; }
  W.ring += dt;
  m.rigState = { pose: 'cheer', expr: 'shout' };   // the lantern held high
  if ((W.bellT = (W.bellT || 0) - dt) <= 0) { W.bellT = .32; sfx('wdnBell', { vol: .5, pitch: 1 + W.ring * .2 }); P.ring(m.x, m.y, 4, 26 + W.ring * 24, '#ffb04a', .35); }
  if (W.ring >= TUNE.wardenRing) WDN_alarm(m, W);
}
/** the alarm: every monster that hears it wakes and comes */
function WDN_alarm(m, W) {
  W.rung = true; W.rungAt = game.time; W.ring = 0; m.ai.aware = true; m.alarmed = true; m.rigState = null;
  const n = makeNoise({ x: m.x, y: m.y, z: 30, loud: TUNE.wardenAlarm }, m);
  sfx('wdnAlarm', { vol: .9 }); shake(3); game.input.rumble(.5, .3);
  P.ring(m.x, m.y, 4, 90, '#ff7a3a', .6); P.ring(m.x, m.y, 4, 170, '#ff9a4a', .9);
  notify('A WARDEN RANG THE ALARM' + (n ? '  •  ' + n + ' HEARD IT' : ''), '#ff9a4a', 3);
  BUS.emit('alarm', { m, n });
}

/* ---------- the lantern: a cage round the staff's orb, and its light ---------- */
/** the lantern's world point: the staff's tip */
const WDN_lamp = m => m.rig.tip();
function WDN_lantern(g, m, ox, oy, view) {
  const rig = m.rig, J = rig.J, H = J.handR, B = J.bladeDir; if (!H || !B || (rig.downW || 0) > .4) return;
  const v = E.charView(view), at = (k, up) => { const w = rig.worldOffset([H[0] + B[0] * k, H[1] + B[1] * k, H[2] + B[2] * k + up]), s = v.p(w[0], w[1], w[2]); return [Math.round(ox + s[0]), Math.round(oy + s[1])]; };
  const sc = view.scale * rig.o.size, w = Math.max(2, Math.round(1.7 * sc)), cap = at(10, 2.2), base = at(10, -2), ring = at(10, 3.4);
  px.line(g, cap[0] - w, cap[1], base[0] - w, base[1], '#2a2018'); px.line(g, cap[0] + w, cap[1], base[0] + w, base[1], '#2a2018');   // the cage's two near bars
  px.rect(g, cap[0] - w - 1, cap[1] - 1, w * 2 + 3, 2, '#3a2c20'); px.rect(g, base[0] - w, base[1], w * 2 + 1, 1, '#3a2c20');   // its cap and its foot
  px.dot(g, ring[0], ring[1], '#5a4a34');
}
BUS.on('draw', e => {
  const r = e.r, L0 = e.L; if (!L0 || !L0.map) return;
  for (const m of ED.foes) {
    if (m.kind !== 'warden' || !m.alive || m.spawnT > 0 || !m.ai.wd) continue;
    const W = m.ai.wd; if (!r.visible(m.x, m.y, 0, 220, 220, 220)) continue;
    const [lx, ly, lz] = WDN_lamp(m);
    L.add(lx, ly, lz, 84, 1.05 * (.93 + .07 * Math.sin(game.time * 11 + m.ph)), { color: '#ffc860', shadow: true });
    if (!W.rung && !m.exeBy) r.sightCone(m, { map: L0.map, range: TUNE.wardenSight, fov: WDN_FOV, color: WDN_COLOR[W.mind.state], alpha: .36 + .24 * Math.min(1, W.mind.level) });
  }
  for (const m of ED.foes) {   // the one ringing (or that just rang), on screen or at its edge: go and silence it
    const W = m.ai && m.ai.wd; if (!W || !m.alive || !(W.ring > 0 || (W.rung && game.time - W.rungAt < 4))) continue;
    r.marker(m.x, m.y, (m.z || 0) + (m.head || 31) * (m.scale || 1) + 6, { label: W.rung ? 'ALARM' : 'RINGING', color: '#ff7a3a' });
  }
});

/* ---------- where they walk: a beat on each level without a boss ---------- */
/** the far end of a beat from (x, y): a point 50 to 120 units away it can see and walk to in a straight line */
function WDN_beat(L0, x, y, R) {
  let best = null, bd = 0;
  for (let k = 0; k < 16; k++) {
    const a = R() * TAU, d = 50 + R() * 70, bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d;
    if (d <= bd || WDN_bad(L0, bx, by) || !L0.map.los(x, y, bx, by)) continue;
    let ok = true; for (let s = 6; s < d && ok; s += 6) ok = !WDN_bad(L0, x + Math.cos(a) * s, y + Math.sin(a) * s);
    if (ok) { bd = d; best = { x: bx, y: by }; }
  }
  return best;
}
BUS.on('levelStart', e => {
  const L0 = e.L; if (!L0 || !L0.rec || L0.rec.boss || ED.mode !== 'level') return;
  const n = WDN_count(L0.depth); if (!n) return;
  const R = RNG(L0.rec.seed + 313), placed = [];   // (its own stream: the level's packs and things roll as before)
  for (let k = 0; k < n * 8 && placed.length < n; k++) {
    const [x, y] = randomFloor(L0, R, { minStart: 200, minExit: 50, edge: 1 });
    if (WDN_bad(L0, x, y) || placed.some(p => Math.hypot(p.x - x, p.y - y) < 140)) continue;
    const b = WDN_beat(L0, x, y, R); if (!b) continue;
    const m = spawnMonster('warden', x, y, { instant: true, rng: R }); if (!m) continue;
    m.ai.wd.b = b; m.facing = Math.atan2(b.y - y, b.x - x); placed.push(m);
  }
});
