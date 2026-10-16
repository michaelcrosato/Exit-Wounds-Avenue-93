/* =============================================================================
 * ASSET LAB (kept: src/labs.json; docs/ASSETS.md is the card, docs/ASSET-IMPORT.md how the store was made): every entry of
 * the asset store, the core library (E.SHAPES, E.MATERIALS) and every set in src/assets/sets/, to browse and search.
 *   The grid: each entry drawn as games draw it (a shape in the view and turning picked above, beside the hero, on the
 *     floor picked; a material on a box and a slab; a sprite as it is), with its id, its size in tokens and its fit.
 *   The stage: the entry picked, drawn by the engine (r.shape in a small room, the hero beside it, its contact shadow and
 *     outline), in every view and turning; its text, to edit and Apply (drawn again at once) or Copy; where it came from.
 * Deep links: #barrel or #kenney-furniture:chair picks an entry; ?set=kenney-furniture, ?view=threequarter, ?kind=sprites,
 * ?q=table filter the grid. window.__assets: { S, sets, entries, shown(), select(id), apply(text) } for tests.
 * ============================================================================= */
(() => {
'use strict';
const E = My3D2dge, $ = id => document.getElementById(id);
const SETS = Object.values(window.ASSETS || {}).sort((a, b) => a.set.localeCompare(b.set));
for (const S of SETS) E.addAssets(S);
const tok = s => Math.round(s.length / 3.1);   // (cl100k on dense entries: about 3.1 characters a token; the tools count exactly)
// the same dense text the store's tools write: bare keys, single quotes
const js = v => Array.isArray(v) ? '[' + v.map(js).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => (/^([A-Za-z_$][\w$]*|[1-9]\d*|0)$/.test(k) ? k : "'" + k + "'") + ':' + js(x)).join(',') + '}' : typeof v === 'string' ? "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'" : typeof v === 'function' ? v.toString() : String(v);

/* ---------- every entry ---------- */
const entries = [], byId = {}, key = (kind, id) => kind + '|' + id;   // (a core shape and a core material may share a name: crate)
const add = (kind, id, set, e) => { const about = (e && e.about) || (typeof e === 'string' ? e : [e && e.color, e && e.pattern].filter(Boolean).join(' ')); const x = { kind, id, set, e, about, tags: (e && e.tags) || '', text: id.split(':').pop() + ': ' + js(e) }; x.tokens = tok(js(e)); entries.push(x); byId[key(kind, id)] = x; };
for (const [id, e] of Object.entries(E.SHAPES)) if (!id.includes(':')) add('shapes', id, 'core', e);
for (const [id, e] of Object.entries(E.MATERIALS)) if (!id.includes(':') && e && typeof e === 'object' && e.color) add('materials', id, 'core', e);
for (const S of SETS) {
  for (const [id, e] of Object.entries(S.shapes || {})) add('shapes', S.set + ':' + id, S.set, e);
  for (const [id, e] of Object.entries(S.materials || {})) if (typeof e === 'object') add('materials', S.set + ':' + id, S.set, e);   // (a kit's colors show with its shapes)
  for (const [id, e] of Object.entries(S.sprites || {})) add('sprites', S.set + ':' + id, S.set, e);
}
const SPRITES = {}; for (const S of SETS) if (Object.keys(S.sprites || {}).length) Object.assign(SPRITES, E.addAssets({ set: S.set + '~lab', materials: S.materials, sprites: S.sprites }).sprites);

/* ---------- state, from the address ---------- */
const VIEWS = [['iso', 'Iso'], ['threequarter', '3/4'], ['topdown', 'Top'], ['brawler', 'Brawler'], ['side', 'Side']];
const FLOORS = { stone: ['Stone', 'flagstone'], wood: ['Wood', 'planks'], grass: ['Grass', 'grass'], dark: ['Dark', '#3a3234 stones size=8'] };
const S = { kind: 'shapes', set: 'all', view: 'iso', turn: 0, floor: 'stone', q: '', sel: null };   // (sel: the entry picked)
const q = new URLSearchParams(location.search); for (const k of ['kind', 'set', 'view', 'floor', 'q']) if (q.has(k)) S[k] = q.get(k);
/** the entry an id names: of the kind shown, else of any kind */
const find = id => byId[key(S.kind, id)] || ['shapes', 'materials', 'sprites'].map(k => byId[key(k, id)]).find(Boolean);
if (location.hash.length > 1) { const x = find(decodeURIComponent(location.hash.slice(1))); if (x) { S.sel = x; S.kind = x.kind; } }
if (!S.sel) S.sel = entries.find(x => x.kind === S.kind && (S.set === 'all' || x.set === S.set)) || entries[0];   // (the stage always shows one)
const viewOf = v => v === 'topdown' ? E.charView(E.VIEWS.topdown) : E.VIEWS[v];
const facing = () => Math.PI / 2 + .45 + S.turn * Math.PI / 4;
const shown = () => { const words = S.q.toLowerCase().split(/\s+/).filter(Boolean); return entries.filter(x => x.kind === S.kind && (S.set === 'all' || x.set === S.set) && words.every(w => (x.id + ' ' + x.tags + ' ' + x.about).toLowerCase().includes(w))); };

/* ---------- drawing a card ---------- */
const hero = new E.Humanoid({ cape: { len: 6, width: 5, seg: 2.5 }, colors: { cloth: '#2f8f86', cape: '#c8452f' } }); for (let i = 0; i < 30; i++) hero.update(1 / 60, { x: 0, y: 0, z: 0, vx: 0, vy: 0, facing: .6 });
const slab = (m, w) => ({ mats: { m }, parts: [['box', 'm', [0, 0, -1], [w, w, 1]]] });
function card(x, W, H) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const view = viewOf(S.view), at = (sp, cx, cy) => { if (sp) g.drawImage(sp.cv, Math.round(cx - sp.ox), Math.round(cy - sp.oy)); };
  if (x.kind === 'sprites') { const sp = SPRITES[x.id.replace(':', '~lab:')]; if (sp) { const k = Math.max(1, Math.floor(Math.min(W / sp.w, H / sp.h) * .7)); g.drawImage(sp.cv, (W - sp.w * k) / 2, (H - sp.h * k) / 2, sp.w * k, sp.h * k); } return cv; }
  if (x.kind === 'materials') { at(E.shapeSprite(slab(x.id, 44), { view: E.VIEWS.iso, facing: Math.PI / 2 }), W / 2, H * .7); at(E.shapeSprite({ mats: { m: x.id }, parts: [['box', 'm', [0, 0, 0], [16, 16, 14]]] }, { view: E.VIEWS.iso }), W / 2, H * .64); return cv; }
  const sp = E.shapeSprite(x.draw || x.id, { view, facing: facing() }); if (!sp) return cv;
  const k = Math.min(1, (H - 8) / (sp.h + 4), (W * .62) / (sp.w + 4)), fy = H - 10;   // (a big shape shrinks to fit; the floor and hero with it)
  at(E.shapeSprite(slab(FLOORS[S.floor][1], 64), { view: E.VIEWS[S.view === 'topdown' ? 'topdown' : S.view] || view, facing: Math.PI / 2 }), W / 2, fy);
  const lay = document.createElement('canvas'); lay.width = W; lay.height = H; const lg = lay.getContext('2d'); lg.imageSmoothingEnabled = false;
  hero.draw(lg, Math.round(W * .2), fy - 2, E.charView(view));
  lg.drawImage(sp.cv, Math.round(W * .58 - sp.ox * k), Math.round(fy - 4 - sp.oy * k), Math.round(sp.w * k), Math.round(sp.h * k));
  g.drawImage(lay, 0, 0);
  return cv;
}

/* ---------- the bar ---------- */
const bar = $('bar');
const seg = (label, key, opts, after) => {
  const box = document.createElement('div'); box.className = 'seg'; box.innerHTML = '<span>' + label + '</span>';
  for (const [v, t] of opts) { const b = document.createElement('button'); b.textContent = t; b.dataset.v = v; b.setAttribute('aria-pressed', String(S[key] === v)); b.onclick = () => { S[key] = v; for (const x of box.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b)); (after || build)(); }; box.appendChild(b); }
  bar.appendChild(box); return box;
};
const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search: tavern table, red potion, bricks'; search.value = S.q; search.oninput = () => { S.q = search.value; build(); }; bar.appendChild(search);
const count = k => entries.filter(x => x.kind === k).length;
const kinds = seg('', 'kind', [['shapes', 'Shapes ' + count('shapes')], ['materials', 'Materials ' + count('materials')], ['sprites', 'Sprites ' + count('sprites')]]);
const setSel = document.createElement('select'); setSel.innerHTML = '<option value="all">Every set</option><option value="core">The core library</option>' + SETS.map(s => `<option value="${s.set}">${s.set}</option>`).join(''); setSel.value = S.set; setSel.onchange = () => { S.set = setSel.value; build(); }; bar.appendChild(setSel);
seg('View', 'view', VIEWS, () => { build(); stage(); });
const turn = document.createElement('div'); turn.className = 'seg'; turn.innerHTML = '<span>Turn</span>';
for (const [d, t] of [[-1, '⟲'], [1, '⟳']]) { const b = document.createElement('button'); b.textContent = t; b.setAttribute('aria-label', d < 0 ? 'Turn left' : 'Turn right'); b.onclick = () => { S.turn = (S.turn + d + 8) % 8; build(); stage(); }; turn.appendChild(b); }
bar.appendChild(turn);
seg('Floor', 'floor', Object.entries(FLOORS).map(([k, v]) => [k, v[0]]), () => { build(); stage(); });
const back = document.createElement('a'); back.className = 'to-labs'; back.href = 'labs.html'; back.textContent = 'All labs'; bar.appendChild(back);

/* ---------- the grid: drawn as cards come into view ---------- */
const grid = $('grid'), more = $('more'); let list = [], upto = 0;
const io = new IntersectionObserver(es => { for (const en of es) if (en.isIntersecting) { const el = en.target; io.unobserve(el); el.querySelector('.pic').appendChild(card(byId[key(S.kind, el.dataset.id)], 132, 112)); } }, { rootMargin: '400px' });
function build() {
  list = shown(); upto = 0; grid.textContent = '';
  $('count').textContent = list.length + ' of ' + entries.filter(x => x.kind === S.kind).length + ' ' + S.kind + (S.q ? ' matching "' + S.q + '"' : '') + (S.set !== 'all' ? ' in ' + S.set : '');
  page();
}
function page() {
  for (const x of list.slice(upto, upto + 120)) {
    const el = document.createElement('button'); el.className = 'tile'; el.dataset.id = x.id; el.setAttribute('aria-pressed', String(S.sel === x));
    const f = x.e && x.e.fit; el.innerHTML = '<div class="pic"></div><b></b><small></small>';
    el.querySelector('b').textContent = x.id.split(':').pop(); el.querySelector('small').textContent = (x.set === 'core' ? 'core' : x.set) + ' · ' + x.tokens + ' tok' + (f && f.iou !== undefined ? ' · IoU ' + f.iou : '');
    el.title = x.about; el.onclick = () => select(x);
    grid.appendChild(el); io.observe(el);
  }
  upto += 120; more.hidden = upto >= list.length; more.textContent = 'Show more (' + (list.length - upto) + ')';
}
more.onclick = page;

/* ---------- the stage: the entry picked, drawn by the engine ---------- */
const game = new E.Game({ canvas: 'screen', res: [200, 140], view: S.view, menu: false, corner: false, loop: true, bg: '#1c1826' });
let room = null, drawn = null;
const makeRoom = () => { const m = FLOORS[S.floor][1]; room = new E.TileMap({ w: 9, h: 7, types: { 1: { h: 24, top: '#6a6280', side: '#4a4360', face: 'stone', roof: 'slab' } }, floorMat: m }); room.fill(0, 0, 9, 1, 1); room.fill(0, 0, 1, 7, 1); };   // (walls at the back only)
function stage() {
  if (!S.sel) return; const x = S.sel; drawn = x; makeRoom(); game.setView(S.view === 'topdown' ? 'topdown' : S.view);
  $('pick').hidden = false; $('pickName').textContent = x.id; $('pickAbout').textContent = x.about + (x.tags ? '  [' + x.tags + ']' : '');
  const src = x.set !== 'core' && x.e && x.e.src ? (SETS.find(s => s.set === x.set).sources || {})[x.e.src] : null;
  $('pickSrc').textContent = x.set === 'core' ? 'The core library (engine/my-3d2dge.js), in every game on the full engine.' : src ? `${src.label}, ${src.license}; ${x.e.orig || ''}; fetched ${src.fetched}${x.e.fit !== undefined ? '; fit ' + js(x.e.fit) : ''}` : x.set;
  if (document.activeElement !== $('text')) $('text').value = x.text;
  $('tokens').textContent = '≈ ' + x.tokens + ' tokens';
  for (const b of grid.querySelectorAll('.tile')) b.setAttribute('aria-pressed', String(b.dataset.id === x.id && S.kind === x.kind));
}
game.start({ update() {}, draw(r) {
  if (!room || !drawn) return;
  game.focus(80, 64, 6);
  room.drawFloor(r); room.queueWalls(r);
  const x = drawn;
  if (x.kind === 'shapes') r.shape(x.draw || x.id, 88, 72, 0, { facing: facing() });
  else if (x.kind === 'materials') r.shape({ mats: { m: x.id }, parts: [['box', 'm', [0, 0, 0], [16, 16, 14]]] }, 88, 72, 0, { facing: facing() });
  else { const sp = SPRITES[x.id.replace(':', '~lab:')]; if (sp) r.queue(88, 72, 0, g => { const [sx, sy] = r.w(88, 72, 0); g.drawImage(sp.cv, Math.round(sx - sp.w / 2), Math.round(sy - sp.h)); }); }
  r.actor(60, 76, 0, (g, ox, oy) => hero.draw(g, ox, oy, r.view));
} });
/** pick an entry (or its id): the stage draws it, the address keeps it */
function select(id) { const x = typeof id === 'string' ? find(id) : id; if (!x) return false; S.sel = x; history.replaceState(null, '', '#' + encodeURIComponent(x.id)); stage(); $('pick').scrollIntoView({ block: 'nearest' }); return true; }
/** an entry's text, edited: drawn again at once (a shape, a material or a sprite) */
let edits = 0;
function apply(text) {
  const x = S.sel; if (!x) return 'nothing picked';
  let e; try { const i = text.indexOf(':'), body = /^[\w'-]+\s*:/.test(text) ? text.slice(i + 1) : text; e = new Function('return (' + body.trim().replace(/,\s*$/, '') + ')')(); } catch (err) { return 'not a valid entry: ' + err.message; }
  // a set's shape, edited, is registered again as a set of its own with the same materials (E.addAssets keeps the first
  // of an id), and drawn under that name; a core one is simply replaced
  if (x.kind === 'shapes' && x.set !== 'core') { const S0 = SETS.find(s => s.set === x.set), name = x.id.split(':')[1], set = x.set + '~edit' + (++edits); E.addAssets({ set, materials: S0.materials, shapes: { [name]: e } }); x.draw = set + ':' + name; }
  else if (x.kind === 'shapes') E.SHAPES[x.id] = e; else if (x.kind === 'materials') E.MATERIALS[x.id] = e; else SPRITES[x.id.replace(':', '~lab:')] = E.sprite(e.rows, e.colors);
  x.e = e; x.text = x.id.split(':').pop() + ': ' + js(e); x.tokens = tok(js(e)); stage(); build(); return 'applied';
}
$('apply').onclick = () => { $('note').textContent = apply($('text').value); };
$('copy').onclick = async () => { try { await navigator.clipboard.writeText($('text').value); $('note').textContent = 'copied'; } catch (e) { $('text').select(); $('note').textContent = 'select and copy (the clipboard is not allowed here)'; } };
$('turnL').onclick = () => { S.turn = (S.turn + 7) % 8; build(); stage(); }; $('turnR').onclick = () => { S.turn = (S.turn + 1) % 8; build(); stage(); };
$('ver').textContent = 'my-3D2dge ' + E.versionLabel();
$('sources').textContent = SETS.map(s => s.set + ' (' + s.credit + ')').join('; ');
build(); stage();
window.__assets = { S, sets: SETS.map(s => s.set), entries, shown, select, apply, game };
window.__game = { game };
})();
