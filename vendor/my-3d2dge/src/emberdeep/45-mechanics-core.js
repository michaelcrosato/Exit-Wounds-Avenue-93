/* =============================================================================
 * MECHANICS: the one new element each depth brings (and the mixes of them past the planned depths)
 * A MECHANIC is def('mechanics', id, {
 *   name: 'Powder Kegs', title: 'The Powder Vaults' (the level name when it is introduced),
 *   adj: 'Blasted', noun: 'Powder Vaults' (for composed names: 'The Blasted Brood Warrens'), color, icon(g, x, y, s),
 *   tip: 'the rule and the exploit, shown on the level card where it is introduced and on its HUD icon',
 *   brief: 'its rule in about 40 characters' (its row on a combination's card, after its name), and the words the card
 *   builds a combination's 'Together:' line from (levelCardInfo, 50-levels-core.js): lure: 'into a rune circle' (where
 *   to bring a pack), act: 'strike a keg' (how to finish it there), move: 'Knock packs down a wind lane' (a mechanic
 *   that carries foes), zone: 'rune circles' (a place to fight inside),
 *   place(L, R) (put its things in the level), start(L) (BUS.on(..., 'level') listeners), update(L, dt), draw(L, r),
 *   themes: ['crypt'] (themes it suits), weight
 * })
 * A THING is anything in L.things: { kind, x, y, r, solid, hittable, dead, onHit(hit), update(dt, L), draw(r) }.
 * The hero side strikes hittable things with every attack (see hitCircle / hitCone), so kegs, pylons and nests
 * need no special input. BUS events (hit, kill, dodge, skill, step...) are the other way in.
 * ============================================================================= */
function addThing(L0, t) { t.dead = false; (L0 || ED.L).things.push(t); return t; }
function updateThings(L0, dt) { const T = L0.things; for (let i = T.length - 1; i >= 0; i--) { const t = T[i]; if (t.update) t.update(dt, L0); if (t.dead && !t.keep) T.splice(i, 1); } }
function drawThings(L0, r) { for (const t of L0.things) if (t.draw && !t.hidden) t.draw(r); }
/** an explosion that hurts everyone: monsters fully, the hero for a share, and sets off other things */
function blast(x, y, rad, amount, o = {}) {
  const src = o.src || null, el = o.el || 'fire';
  hitCircle('hero', x, y, rad, u => ({ src, amount, el, kb: o.kb || 200, up: o.up === undefined ? 110 : o.up, ang: Math.atan2(u.y - y, u.x - x), statusChance: .6, tags: ['aoe', 'blast'] }));
  const h = ED.hero; if (h && h.alive && Math.hypot(h.x - x, h.y - y) < rad + h.r && o.hurtHero !== false) dealDamage(h, { src: null, amount: amount * (o.heroShare || .12) + 4 * (ED.depth || 1), el, kb: 180, ang: angTo({ x, y }, h) });
  if (el === 'fire') P.explosion(x, y, 6, rad / 30, { flash: rad > 40 }); else { elBurst(x, y, 6, el, 20); sfx('explode'); }
  P.ring(x, y, 4, rad + 6, EL(el).light, .4); FX.scorch(x, y, rad * .6);
}

/* ---------- POWDER KEGS (depth 1): the reference mechanic ---------- */
// Kegs sit in clusters along the rooms. Any hit lights the fuse; a moment later it blows, launching monsters and
// setting off kegs nearby. A speedrunner drags a whole pack into a cluster and takes one swing.
def('mechanics', 'powder', { name: 'Powder Kegs', title: 'The Powder Vaults', adj: 'Blasted', noun: 'Powder Vaults', color: '#ff9a3a', depth: 1, weight: 10,
  tip: 'Kegs explode when struck and set off their neighbours. Pull a pack into a cluster, then strike once.',
  brief: 'Struck kegs explode and set off the next.', lure: 'into a keg cluster', act: 'strike a keg',
  icon: (g, x, y, s) => { px.ell(g, x + 8 * s, y + 9 * s, 5 * s, 6 * s, '#8a5a32'); px.rect(g, x + 3 * s, y + 6 * s, 10 * s, s, '#5a5a6a'); px.rect(g, x + 3 * s, y + 11 * s, 10 * s, s, '#5a5a6a'); px.line(g, x + 8 * s, y + 3 * s, x + 11 * s, y + s, '#e8d8a0'); px.dot(g, x + 11 * s, y + s, '#ffd36a'); },
  place(L0, R) {
    const n = Math.round(L0.rooms.length * 1.6);
    for (let i = 0; i < n; i++) {
      const [cx, cy] = L0.randomFloor(R, { minStart: 56, minExit: 48, edge: 1 }); const k = R.int(2, 5);
      for (let j = 0; j < k; j++) { const a = R() * TAU, d = j ? 9 + R() * 7 : 0, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (kegRoom(L0, x, y)) addThing(L0, makeKeg(x, y)); }
    }
  }
});
/** a keg may stand here: open floor off the start and exit runes, clear of other kegs (they touch, never overlap),
 *  torches, big props and whatever other mechanics placed (a keg in a ward's pillar or on a well's hub reads as clutter) */
function kegRoom(L0, x, y) {
  if (!L0.map.walkable(Math.floor(x / 16), Math.floor(y / 16)) || L0.map.floorAt(x, y) === 'lava') return false;
  for (const rc of L0.runes || []) if (Math.hypot(rc.x - x, rc.y - y) < rc.r + 8) return false;
  if (L0.exit && Math.hypot(L0.exit.x - x, L0.exit.y - y) < 36) return false;
  for (const t of L0.things) if (!t.dead && !t.mark && Math.hypot(t.x - x, t.y - y) < (t.kind === 'keg' ? 9.5 : t.MKB_big ? t.r * .45 : Math.min(t.r || 5, 30) + 9)) return false;
  for (const b of L0.torches) if (Math.hypot(b.x - x, b.y - y) < 13) return false;
  for (const p of L0.props) if (Math.hypot(p.x - x, p.y - y) < ((p.o && p.o.size) || 1) * 8) return false;
  return true;
}
function makeKeg(x, y) {
  const k = { kind: 'keg', x, y, r: 5, solid: true, hittable: true, fuse: -1, v: (Math.random() * 3) | 0, src: null,
    onHit(hit) { if (this.fuse < 0) { this.fuse = hit.tags && hit.tags.includes('blast') ? .12 + Math.random() * .12 : .35; this.src = hit.src && hit.src.team === 'hero' ? hit.src : ED.hero; sfx('charge', { vol: .25, pitch: 2.5 }); } },
    update(dt) {
      if (this.fuse < 0) return;
      this.fuse -= dt; if (Math.random() < .6) P.sparks(this.x, this.y, 16, 1, null, { color: '#ffd36a', hot: '#ffffff' });
      if (this.fuse <= 0) { this.dead = true; blast(this.x, this.y, 34, heroHitAmount(4.5), { src: this.src, el: 'fire' }); }
    },
    draw(r) {
      const lit = this.fuse >= 0, fl = lit && Math.sin(game.time * 50) > 0;
      r.prop('barrel', this.x, this.y, 0, { color: fl ? '#ff6a3a' : ['#8a3a2a', '#7a4a2a', '#8a5a32'][this.v], size: 1.1 });
      r.queue(this.x, this.y, 0, g => { const [x, y] = r.w(this.x, this.y, 16 * (E.style.propSize || 1) * (r.view.zoom || 1) / Math.max(.5, r.view.scale)); px.dot(g, x, y - 1, '#e8d8a0'); px.dot(g, x + 1, y - 2, lit ? '#ffffff' : '#e8d8a0'); if (lit) { px.glow(g, 1); px.dot(g, x + 1, y - 3, '#ffd36a'); } }, { emissive: lit, bias: .01 });
      if (lit) L.add(this.x, this.y, 16, 30, .8, { color: '#ffb050' });
    } };
  return k;
}
/** a damage amount that keeps level mechanics relevant as the hero grows: a share of the hero's weapon hit */
function heroHitAmount(scale) { const h = ED.hero; return h ? heroHit(h, scale, { el: 'fire' }).amount : 20 * scale; }
