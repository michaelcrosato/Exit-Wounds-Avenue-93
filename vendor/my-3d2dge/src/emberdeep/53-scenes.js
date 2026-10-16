/* =============================================================================
 * SCENES: small stories laid out in the rooms on top of each theme's own dressing (a robbed tomb, a smith's corner, a
 * lost expedition's camp, a miners' table), and a scatter of single objects. Drawn from the asset store as shapes
 * (docs/ASSETS.md): the page's 'emberdeep' set (src/assets/sets/emberdeep.js, cut from the CC0 libraries by
 * tools/asset-set.mjs), the core library, and a few entries of Emberdeep's own below ('ed:campfire').
 * They are laid out when a level starts (BUS 'levelStart'), from a random stream of their own (the level's seed,
 * turned), clear of everything the level placed: its theme's dressing, the mechanics' things and floors and the
 * monsters stand exactly where they would without them. A theme without a SCENES entry is left as it is. Set dressing
 * only: nothing here is solid or hittable.
 * ============================================================================= */
{
/** the store's colours in this game's light: its kits are brighter, so every colour a little less saturated, and the
 *  saturated ones a little darker (a white candle stays white). Once, before the set is registered */
const SCN_tone = c => { const [h, s, l] = E.toHsl(c); return E.hsl(h, s * .78, s > .3 ? l * .84 : l); };
const set = (window.ASSETS || {}).emberdeep;
if (set) {   // (the page without the set: a scene whose shapes are missing leaves them out)
  const materials = {}; for (const k in set.materials) { const v = set.materials[k]; materials[k] = typeof v === 'string' ? v.replace(/^#[0-9a-fA-F]{6}/, SCN_tone) : v; }
  E.addAssets(Object.assign({}, set, { materials }));
}
/** Emberdeep's own entries: a camp's fire (lit: its light joins the level's), a dead one */
E.addAssets({ set: 'ed', format: 1, shapes: {
  campfire: { about: 'a camp fire: a ring of stones, two crossed logs, flames', tags: 'camp light', mats: { s: '#6a6470 speck', w: 'bark', c: '#2a2020' },
    parts: [['use','emberdeep:campfire-bricks',[0,0,0],{scale:.7,mats:{a:'s'}}], ['cyl','c',[0,0,0],4.2,.5], ['box','w',[0,0,.6],[11,2.4,2.4],{rot:30}], ['box','w',[0,0,1.4],[11,2.4,2.4],{rot:-35}]],
    flames: [[0,0,2,6,10]], lights: [[0,0,9,'#ff9a4a',72]] },
  ashes: { about: 'a dead fire: the ring of stones, charred logs', tags: 'camp', mats: { s: '#6a6470 speck', w: '#2e2626', c: '#3a3434' },
    parts: [['use','emberdeep:campfire-bricks',[0,0,0],{scale:.7,mats:{a:'s'}}], ['cyl','c',[0,0,0],4.2,.6], ['box','w',[0,0,.6],[10,2.2,2.2],{rot:25}], ['box','w',[1,1,.6],[8,2,2],{rot:-50}]] }
} });

/** the store's objects at the hero's scale (each kit came at its own): the placement's scale, unless a part says */
const SCN_SIZE = { 'emberdeep:barrel-small-stack': .62, 'emberdeep:keg': .55, 'emberdeep:keg-decorated': .5, 'emberdeep:table-long-broken': .62, 'emberdeep:table-medium-decorated-a': .7,
  'emberdeep:trunk-large-c': .85, 'emberdeep:trunk-small-c': 1.15, 'emberdeep:bed-frame': .8, 'emberdeep:box-small-decorated': .6, 'emberdeep:bottle-c-green': .6, 'emberdeep:altar-stone': .7, 'emberdeep:crypt': .8,
  'emberdeep:gravestone-cross': .62, 'emberdeep:gravestone-broken': .8, 'emberdeep:gravestone-debris': .8, 'emberdeep:pillar-obelisk': .8, 'emberdeep:rocks': .55, 'emberdeep:rocks-tall': .6,
  'emberdeep:shovel': .8, 'emberdeep:urn-round': .9, 'emberdeep:trunk': .6, 'emberdeep:bucket': .55, 'emberdeep:box-open': .55, 'emberdeep:resource-planks': .5, 'emberdeep:workbench': .8,
  'emberdeep:workbench-grind': .8, 'emberdeep:workbench-anvil': .75, 'emberdeep:campfire-stand': .8, 'emberdeep:tree-log': .5, 'emberdeep:bedroll': .6, 'emberdeep:statue-head': .7,
  'emberdeep:statue-column-damaged': .9, 'emberdeep:tent-small-closed': 1, 'emberdeep:coffin-decorated': .55, 'emberdeep:shrine-candles': .7,
  'emberdeep:plaque-candles': .55, 'emberdeep:pot': .35, 'emberdeep:wine-red': .3 };

/* ---------- the scenes ----------
 * A scene: { w (its weight), edge (against a wall: F points into the room; else on open ground, turned any way), parts }.
 * A part: [id, u, v, o]: u across (along the wall), v forward (into the room), in world units from the anchor. id: a
 * shape, or with o.prop an engine prop (a candle's flame, bones). o: { t (a turn from facing forward, radians), s (scale),
 * mats ({ slot: material }; a '#hex pattern' turns with the level's hue), color (a prop's), z, opt (may be left out),
 * r (the floor it needs round it, units: 6) }. A scene goes down whole, its opt parts where they fit, or not at all. */
const D = 'emberdeep:', st = c => c + ' speck amount=.1';   // (the store's grey stone came as steel or ice: here the theme's own)
const SCN_OPT = { opt: true };   // (a part that may be left out)
const SC = {
  // the treasure nook: any theme, rare
  hoard: { w: .5, edge: 1, parts: [[D + 'trunk-large-c', 0, 9, { r: 8 }], [D + 'box-small-decorated', 14, 10], [D + 'bottle-c-green', -11, 8, SCN_OPT], [D + 'trunk-small-c', -8, 18, { t: .7, opt: 1 }], ['candle', 16, 2, { prop: 1, opt: 1 }]] },
  camp: { w: 1, parts: [['ed:campfire', 0, 0, { r: 7 }], [D + 'campfire-stand', 0, 0, { t: Math.PI / 2, opt: 1 }], [D + 'bedroll', -20, 2, { t: Math.PI / 2 + .2, r: 9 }], [D + 'pot', 8, -9, { s: .3, opt: 1 }], [D + 'trunk-small-c', 16, 8, SCN_OPT], [D + 'bottle-c-green', 13, -4, SCN_OPT]] }
};
const SCENES = {
  crypt: { scenes: [
    { w: 1.2, edge: 1, parts: [[D + 'crypt', 0, 17, { r: 13, mats: { a: st('#5d566f') } }], [D + 'debris', 15, 24, { mats: { a: st('#6a6280') } }], [D + 'shovel', -13, 21, { t: .7 }], [D + 'trunk-small-c', 13, 7, SCN_OPT], ['bones', -10, 34, { prop: 1, opt: 1, color: '#d8d0c0' }]] },   // a robbed tomb
    { w: 1, parts: [[D + 'altar-stone', 0, 0, { r: 11, mats: { a: st('#5d566f') } }], [D + 'urn-round', -17, 4], [D + 'urn-round', 17, 4], ['candle', -7, -7, { prop: 1 }], ['candle', 7, -7, { prop: 1 }], ['skull', 0, 11, { prop: 1, opt: 1, color: '#d8d0c0' }]] },   // a vigil at an altar
    { w: 1, edge: 1, parts: [[D + 'barrel-small-stack', 0, 7], [D + 'keg', 17, 9], [D + 'box-open', -15, 8], [D + 'bucket', -6, 19, SCN_OPT]] },   // the vault's stores
    { w: .7, parts: [[D + 'table-long-broken', 0, 0, { r: 12 }], [D + 'chair', 17, 5, { t: 1.9 }], [D + 'bottle-c-green', -11, 12, SCN_OPT], ['bones', 6, -14, { prop: 1, opt: 1, color: '#d8d0c0' }]] },   // a hall looted long ago
    { w: .8, edge: 1, parts: [[D + 'shrine-candles', 0, 8, { mats: { a: st('#6a6280') } }], [D + 'gravestone-cross', -16, 7, { mats: { a: st('#5d566f') } }], [D + 'urn-round', 14, 9], ['candle', 9, 17, { prop: 1, opt: 1 }]] },
    SC.hoard ],
    scatter: [[D + 'urn-round'], [D + 'gravestone-broken', { mats: { a: st('#5d566f') } }], [D + 'debris', { mats: { a: st('#6a6280') } }], [D + 'trunk-small-c'], [D + 'bottle-c-green']] },
  ruins: { scenes: [
    { w: 1.2, parts: [[D + 'statue-head', 0, 0, { r: 12, mats: { a: st('#958b76') } }], [D + 'debris', 18, 8, { mats: { a: st('#8c8472') } }], ['candle', -12, 11, { prop: 1 }], ['candle', -6, 14, { prop: 1, opt: 1 }], ['flowers', 9, 14, { prop: 1, opt: 1, color: '#e8c85a' }]] },   // an idol, still kept
    { w: 1, parts: [[D + 'statue-column-damaged', 0, 0, { mats: { a: st('#a0987f') } }], [D + 'rocks', 17, 6, { s: .4, mats: { a: st('#8a8270') } }], [D + 'debris', -13, 9, { mats: { a: st('#8c8472') } }], ['grass', 6, 13, { prop: 1, opt: 1, color: '#7a9a4a' }]] },
    SC.camp, SC.hoard ],
    scatter: [[D + 'debris', { mats: { a: st('#8c8472') } }], [D + 'rocks', { s: .35, mats: { a: st('#8a8270') } }], [D + 'urn-round']] },
  forge: { scenes: [
    { w: 1.3, edge: 1, parts: [[D + 'workbench-anvil', 0, 10, { r: 9 }], [D + 'workbench-grind', 19, 10, { r: 8 }], [D + 'bucket', -15, 8], [D + 'box-open', -17, 21, SCN_OPT]] },   // a smith's corner
    { w: 1, edge: 1, parts: [[D + 'keg', 0, 9], [D + 'barrel-small-stack', -18, 7], [D + 'resource-planks', 17, 12, { t: Math.PI / 2 }], [D + 'bucket', 6, 20, SCN_OPT]] },
    { w: .8, parts: [[D + 'table-medium-decorated-a', 0, 0, { r: 9 }], [D + 'stool', -13, 2, { t: Math.PI / 2 }], [D + 'stool', 13, -1, { t: -Math.PI / 2 }], [D + 'keg', 4, 16, SCN_OPT]] },   // the workers' table
    SC.hoard ],
    scatter: [[D + 'bucket'], [D + 'box-open'], [D + 'keg'], [D + 'resource-planks']] },
  frost: { scenes: [
    { w: 1.3, parts: [[D + 'tent-small-closed', 0, -10, { r: 12, mats: { a: '#8a94a2 speck amount=.05' } }], ['ed:ashes', 2, 14], [D + 'trunk-small-c', -16, 6], [D + 'shovel', 17, 4, { t: .4, opt: 1 }]] },   // a camp the cold took
    { w: 1, parts: [[D + 'rocks-tall', 0, 0, { r: 11, mats: { a: st('#8ba2bb') } }], [D + 'gravestone-cross', 0, 16, { s: .45, mats: { a: st('#7a8ea4') } }], [D + 'shovel', 12, 18, { t: -.5, opt: 1 }]] },   // a cairn over the one who did not leave
    { w: 1, edge: 1, parts: [[D + 'trunk-large-c', 0, 8], [D + 'barrel-small-stack', 17, 7], [D + 'box-open', -15, 8, SCN_OPT]] },
    SC.hoard ],
    scatter: [[D + 'trunk-small-c'], [D + 'debris', { mats: { a: st('#8ba2bb') } }], [D + 'rocks', { s: .35, mats: { a: st('#8ba2bb') } }]] },
  fungal: { scenes: [
    { w: 1.3, parts: [[D + 'tree-log', 0, 0, { r: 13, t: Math.PI / 2 }], [D + 'trunk', 21, 6], [D + 'debris-wood', -18, 8], ['mushroom', 4, 10, { prop: 1, color: '#b85a9a', s: .7 }], ['mushroom', 10, 12, { prop: 1, color: '#3aa890', s: .5, opt: 1 }]] },   // rotwood
    { w: 1, edge: 1, parts: [[D + 'pot', 0, 8, { s: .3 }], [D + 'box-open', 15, 9], [D + 'bucket', -13, 8], [D + 'bottle-c-green', -4, 18, SCN_OPT]] },   // a forager's cache
    SC.camp, SC.hoard ],
    scatter: [[D + 'trunk'], [D + 'debris-wood'], [D + 'tree-log', { s: .4 }]] },
  mine: { scenes: [
    { w: 1.3, edge: 1, parts: [[D + 'box-open', 0, 9], [D + 'bucket', 14, 9], [D + 'shovel', -12, 7, { t: .5 }], [D + 'rocks', 2, 24, { s: .4, mats: { a: st('#7a6e62') } }], [D + 'resource-planks', 22, 20, { t: 1.2, opt: 1 }]] },   // a dig
    { w: 1.2, parts: [[D + 'table-medium-decorated-a', 0, 0, { r: 9 }], [D + 'chair', -13, 1, { t: Math.PI / 2 }], [D + 'stool', 13, -2, { t: -Math.PI / 2 }], [D + 'keg', 0, -18, SCN_OPT]] },   // the miners' table
    { w: .8, edge: 1, parts: [[D + 'bed-frame', 0, 16, { r: 10 }], [D + 'trunk-small-c', 15, 7], [D + 'bucket', -13, 8, SCN_OPT]] },   // a bunk by the wall
    SC.camp, SC.hoard ],
    scatter: [[D + 'bucket'], [D + 'box-open'], [D + 'debris', { mats: { a: st('#7a6e62') } }], [D + 'resource-planks']] },
  clockwork: { scenes: [
    { w: 1.3, edge: 1, parts: [[D + 'workbench', 0, 10, { r: 9 }], [D + 'stool', 2, 22, { t: Math.PI }], [D + 'box-open', 18, 9], [D + 'trunk-small-c', -15, 8, SCN_OPT]] },   // a tinker's bench
    { w: 1, edge: 1, parts: [[D + 'barrel-small-stack', 0, 7], [D + 'box-open', 17, 8], [D + 'resource-planks', -18, 12, { t: Math.PI / 2, opt: 1 }]] },
    SC.hoard ],
    scatter: [[D + 'trunk-small-c'], [D + 'box-open'], [D + 'bottle-c-green']] },
  abyss: { scenes: [
    { w: 1.3, parts: [[D + 'altar-stone', 0, 0, { r: 11, mats: { a: st('#322a40') } }], [D + 'pillar-obelisk', -22, -4, { mats: { a: st('#2a2436') } }], [D + 'pillar-obelisk', 22, -4, { mats: { a: st('#2a2436') } }], ['candle', -6, 9, { prop: 1 }], ['candle', 6, 9, { prop: 1, opt: 1 }]] },   // a shrine to the dark
    { w: 1, parts: [[D + 'bedroll', 0, 0, { t: .4, r: 9 }], ['ed:ashes', 18, -6], [D + 'trunk-small-c', -15, -8, SCN_OPT], [D + 'gravestone-broken', 2, 16, { s: .5, mats: { a: st('#322a40') }, opt: 1 }]] },   // the last of an expedition
    SC.hoard ],
    scatter: [[D + 'debris', { mats: { a: st('#322a40') } }], [D + 'gravestone-broken', { mats: { a: st('#322a40') } }], [D + 'urn-round']] },
  ossuary: { scenes: [
    { w: 1.3, parts: [[D + 'coffin-decorated', 0, 0, { r: 13 }], ['candle', -11, -12, { prop: 1 }], ['candle', 11, -12, { prop: 1 }], ['candle', -11, 12, { prop: 1, opt: 1 }], ['candle', 11, 12, { prop: 1, opt: 1 }], [D + 'urn-round', 0, 20, SCN_OPT]] },   // a wake
    { w: 1.1, edge: 1, parts: [[D + 'gravestone-cross', -16, 6, { mats: { a: st('#46403a') } }], [D + 'gravestone-broken', 0, 7, { mats: { a: st('#46403a') } }], [D + 'gravestone-debris', 17, 9, { mats: { a: st('#46403a') } }], ['bones', 4, 20, { prop: 1, opt: 1, color: '#d8ceb4' }]] },
    { w: 1, edge: 1, parts: [[D + 'shrine-candles', 0, 9, { mats: { a: st('#46403a') } }], [D + 'plaque-candles', 0, 25, { mats: { a: st('#3e3834') }, opt: 1 }], [D + 'urn-round', -14, 8], [D + 'urn-round', 14, 8]] },
    SC.hoard ],
    scatter: [[D + 'urn-round'], [D + 'gravestone-broken', { mats: { a: st('#46403a') } }], [D + 'debris', { mats: { a: st('#46403a') } }]] },
  sky: { scenes: [
    { w: 1.3, parts: [['bench', 0, 0, { r: 9, s: .7 }], ['bush', -18, -4, { s: .9 }], ['bush', 18, -4, { s: .8, opt: 1 }], ['lamppost', 24, 6, { s: .8, opt: 1 }], ['flowers', -6, 10, { prop: 1, opt: 1, color: '#e8a0c0' }]] },   // a garden seat
    { w: 1, parts: [[D + 'table-medium-decorated-a', 0, 0, { r: 9 }], [D + 'stool', -13, 2, { t: Math.PI / 2 }], [D + 'stool', 13, -2, { t: -Math.PI / 2 }], [D + 'wine-red', 15, 12, { opt: 1 }]] },   // a table set in the clouds
    SC.hoard ],
    scatter: [['bush', { s: .8 }], [D + 'urn-round'], [D + 'statue-column-damaged', { s: .7, mats: { a: st('#b9b1a5') } }]] },
  aqueduct: { scenes: [
    { w: 1.3, edge: 1, parts: [[D + 'keg-decorated', 0, 10, { r: 11 }], [D + 'bucket', -19, 8], [D + 'bucket', 18, 7, SCN_OPT], [D + 'barrel-small-stack', 2, 24, SCN_OPT]] },   // the keepers' stores
    { w: 1, edge: 1, parts: [[D + 'workbench', 0, 10, { r: 9 }], [D + 'resource-planks', 19, 12, { t: Math.PI / 2 }], [D + 'bucket', -14, 9, SCN_OPT]] },
    SC.hoard ],
    scatter: [[D + 'bucket'], [D + 'keg'], [D + 'barrel-small-stack']] },
  cavern: { scenes: [
    { w: 1.3, parts: [[D + 'tent-small-closed', 0, -12, { r: 12, mats: { a: '#7a6c52 speck amount=.05' } }], ['ed:campfire', 0, 12, { r: 7 }], [D + 'bedroll', -20, 8, { t: Math.PI / 2 }], [D + 'trunk-large-c', 19, 0, SCN_OPT], [D + 'pot', 12, 18, { s: .3, opt: 1 }]] },   // explorers
    { w: 1, parts: [[D + 'rocks-tall', 0, 0, { r: 12, mats: { a: st('#7a7068') } }], [D + 'rocks', 20, 10, { s: .4, mats: { a: st('#7a7068') } }], [D + 'debris', -16, 8, { mats: { a: st('#7a7068') } }]] },   // a rockfall
    SC.hoard ],
    scatter: [[D + 'rocks', { s: .35, mats: { a: st('#7a7068') } }], [D + 'debris', { mats: { a: st('#7a7068') } }], [D + 'trunk']] }
};

/* ---------- laying them out ---------- */
/** is a part's ground free: every cell its square covers open floor (a pillar between its corners too), off the rune
 *  circles (the landing's, the waystone's, a boss arena's sigil) and the boss's place, clear of the props, braziers and
 *  decorations already there */
function SCN_free(L0, x, y, rr) {
  const m = L0.map;
  for (let cy = Math.floor((y - rr) / T16); cy <= Math.floor((y + rr) / T16); cy++) for (let cx = Math.floor((x - rr) / T16); cx <= Math.floor((x + rr) / T16); cx++) if (!m.walkable(cx, cy) || m.floorTags[cy * L0.w + cx]) return false;
  if (Math.hypot(x - L0.start.x, y - L0.start.y) < 44 + rr || Math.hypot(x - L0.exit.x, y - L0.exit.y) < 40 + rr) return false;
  for (const q of L0.runes) if (Math.hypot(x - q.x, y - q.y) < q.r + 6 + rr) return false;
  if (L0.rec && L0.rec.boss && Math.hypot(x - L0.exit.x, y - L0.exit.y + 34) < 54 + rr) return false;
  for (const p of L0.props) if (!(p.z > 0) && (p.x - x) ** 2 + (p.y - y) ** 2 < (rr + 8) ** 2) return false;
  for (const b of L0.torches) if ((b.x - x) ** 2 + (b.y - y) ** 2 < (rr + 10) ** 2) return false;
  for (const t of L0.things) if ((t.x - x) ** 2 + (t.y - y) ** 2 < (rr + (t.r || 5) + 3) ** 2) return false;
  return true;
}
/** a part, placed: an engine prop (o.prop) or a shape as a prop's record (drawProps draws it; a shape with lights adds them) */
function SCN_put(L0, id, x, y, fa, o) {
  if (o.prop) { WLD_prop(L0, id, x, y, { color: o.color, size: o.s || 1, z: o.z }); L0.props[L0.props.length - 1].scn = 1; return; }   // (scn: the scenes' own, for the suite)
  const S = E.SHAPES[id]; if (!S) return;
  const mats = {}; for (const k in o.mats || {}) { const v = o.mats[k]; mats[k] = typeof v === 'string' && v[0] === '#' ? v.replace(/^#[0-9a-fA-F]{6}/, c => WLD_c(L0, c)) : v; }
  const so = { facing: fa, scale: Math.round((o.s || SCN_SIZE[id] || 1) * 16) / 16, mats, light: !!S.lights };
  L0.props.push({ name: id, shape: id, x, y, z: o.z || 0, o: { size: 1 }, so, scn: 1 });
}
/** one scene in a room: an anchor (a wall spot, F into the room; or open ground, F any way), then each part checked */
function SCN_scene(L0, R, rm, sc) {
  for (let k = 0; k < 5; k++) {
    const s = WLD_spot(L0, R, rm, sc.edge ? { edge: 1, gap: 34 } : { open: 1, gap: 34 }); if (!s) return false;
    const fa = sc.edge ? Math.atan2(-s[3], -s[2]) : R.range(0, TAU), F = [Math.cos(fa), Math.sin(fa)], Rt = [-F[1], F[0]], put = [];
    let ok = true;
    for (const [id, u, v, o = {}] of sc.parts) {
      const x = s[0] + u * Rt[0] + v * F[0], y = s[1] + u * Rt[1] + v * F[1];
      if (!(o.prop || E.SHAPES[id]) || !SCN_free(L0, x, y, o.r || 6)) { if (o.opt) continue; ok = false; break; }
      put.push([id, x, y, fa + (o.t || 0) + R.range(-.1, .1), o]);
    }
    if (!ok) { L0._wtk.pop(); continue; }   // (the spot is given back)
    for (const p of put) SCN_put(L0, ...p);
    (L0.scenery || (L0.scenery = [])).push({ x: s[0], y: s[1], n: put.length });
    return true;
  }
  return false;
}
/** a level's scenes and scatter: a scene in most rooms (two in a big one), one to three single things */
function SCN_dress(L0, th) {
  const S = SCENES[th.id]; if (!S || !L0.map || !L0.rooms) return;
  const R = RNG(Math.imul((L0.rec && L0.rec.seed) || 1, 2654435761) ^ 0x5ce4e5);
  for (const rm of WLD_spaces(L0)) {
    const area = rm.w * rm.h, n = area >= 110 ? 2 : area >= 36 ? 1 : R.chance(.4) ? 1 : 0;
    for (let k = 0; k < n; k++) SCN_scene(L0, R, rm, R.weighted(S.scenes, sc => sc.w));
    for (let k = clamp(Math.round(area / 45), 1, 3); k > 0; k--) {
      const [id, o = {}] = R.pick(S.scatter), s = WLD_spot(L0, R, rm, { gap: 16 });
      if (s && SCN_free(L0, s[0], s[1], o.r || 5)) SCN_put(L0, id, s[0], s[1], R.range(0, TAU), o);
    }
  }
}
// laid out when a level starts: after its theme's dressing, its mechanics' things and their floors (lava, canals,
// chasms), which a scene keeps clear of, so the level's own random stream and everything it placed stay as they were
BUS.on('levelStart', ({ L: L0 }) => { if (L0 && L0.kind === 'level' && !L0._scn) { L0._scn = true; SCN_dress(L0, L0.theme); } });
}
