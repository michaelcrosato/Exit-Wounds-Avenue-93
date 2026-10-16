// The assets suite: shapes and materials (docs/ASSETS.md) do what the card says, on the full engine in headless Chromium.
//   1. every core shape draws in every view and 8 facings: not empty, inside its projected bounds, every part seen in the
//      isometric or the three-quarter view from some facing; two runs give the same pixels; a generator's params change its pixels
//   2. every material draws on every kind of surface (a wall face, a wall top, a floor, a platform tile, a shape) with no
//      warning, and the engine's own wall faces, tops and tile styles are entries of the registry; the overlays draw in
//      their own tones where they belong
//   3. collision: a body walks into a solid table and stops, jumps at it below its top and is stopped, comes down on it
//      and lands, passes under a shape set above its head; the solid's box turns, scales and mirrors with the shape;
//      a hero walking round a table sorts in front of it on its near side and behind it on its far side
//   4. sets: E.addAssets names entries SET:id, never replaces the core's or another set's, resolves a set's own ids
//      first, and its sprites take 'material:tone' colors
//   5. validation: a broken entry warns, naming the entry and the field
//   6. size: each core entry within 300 tokens, the median within 150; the core library within 12 KB of source
//   7. the store (src/assets/): every download CC0 (or the public-domain mark) with its record; every entry's src, orig and
//      fit; every entry in its set's catalog and ledger; shapes at a mean IoU of .8, no view under .6; sprites exact against
//      their source images (where the download is in .cache); a set cut by asset-set equal to the entries it was cut from;
//      every set loads (E.addAssets) and every shape in it draws
//   8. edge cases a review found: broken parts are skipped (never thrown), a material naming itself or a loop ends, an
//      edited material redraws cached pictures, parts below the floor are not clipped, an entry's scale applies, the
//      crate pattern repeats past its face, the outline takes the renderer's color, a raised solid is no wall under it,
//      what stands on a shape's back half sorts after it, and 300 shapes in view: the first frame, the steady ones, the cache
//   9. the games' cut sets (emberdeep and every kit's): every entry the code names is in the set its
//      page loads, and every entry of the set is named
// Usage: node tools/assets-test.mjs        (run node tools/build.mjs first; CHROMIUM_PATH picks a browser)
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = join(root, 'check-output/assets-test');
const ENGINE = readFileSync(join(root, 'engine/my-3d2dge.js'), 'utf8');
const problems = [], fail = (area, m) => problems.push(area + ': ' + m), ok = m => console.log('  ok   ' + m);
let tok = s => Math.ceil(s.length / 3.2); try { const { encode } = await import('gpt-tokenizer/encoding/cl100k_base'); tok = s => encode(s).length; } catch (e) { /* estimated */ }
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage(), warnings = [];
page.on('pageerror', e => fail('page', String(e))); page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && !/willReadFrequently/.test(m.text())) warnings.push(m.text()); });   // (not Chromium's readback hint)
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({ content: ENGINE });

/* 1. every core shape, every view, 8 facings */
console.log('1. the core shapes in every view');
{
  const r = await page.evaluate(() => {
    const E = My3D2dge, bad = [], hashes = {}, VIEWS = ['iso', 'threequarter', 'topdown', 'brawler', 'side'];
    const hash = a => { let h = 2166136261; for (let i = 0; i < a.length; i += 3) h = Math.imul(h ^ a[i], 16777619); return h >>> 0; };
    for (const id of Object.keys(E.SHAPES)) {
      let all = 0;
      for (const vid of VIEWS) for (let k = 0; k < 8; k++) {
        const view = vid === 'topdown' ? E.charView(E.VIEWS.topdown) : E.VIEWS[vid], f = k / 8 * Math.PI * 2, I = E.shapeInfo(id, { view, facing: f });
        if (!I || !I.pixels) { bad.push(id + ' draws nothing in ' + vid + ' facing ' + k + '/8'); continue; }
        // inside its bounds: no pixel outside the projected box of its bounds turned to this facing (a pixel of slack)
        const [x0, y0, z0, x1, y1, z1] = I.bounds, c = Math.cos(f - Math.PI / 2), s = Math.sin(f - Math.PI / 2); let a = 1e9, b = 1e9, A = -1e9, B = -1e9;
        for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [Math.max(0, z0), z1]) { const X = x * c - y * s, Y = x * s + y * c, p = view.p(X, Y, z); a = Math.min(a, p[0]); A = Math.max(A, p[0]); b = Math.min(b, p[1]); B = Math.max(B, p[1]); }
        let out = 0; for (let j = 0; j < I.rgba.length / 4; j++) if (I.rgba[j * 4 + 3]) { const px = j % I.w - I.ox + .5, py = Math.floor(j / I.w) - I.oy + .5; if (px < a - 1.5 || px > A + 1.5 || py < b - 1.5 || py > B + 1.5) out++; }
        if (out) bad.push(id + ' draws ' + out + ' pixels outside its bounds in ' + vid + ' facing ' + k + '/8');
        if (vid === 'iso' || vid === 'threequarter') { const H = hashes[id] = hashes[id] || { seen: I.parts.map(() => 0) }; I.parts.forEach((n, i) => { H.seen[i] += n; }); if (vid === 'iso' && !k) H.h = hash(I.rgba); }
        all++;
      }
      // every part shows from some facing of the isometric or the three-quarter view (one behind another in a facing is fine)
      const H = hashes[id]; const unseen = H.seen.map((n, i) => n ? -1 : i).filter(i => i >= 0);
      if (unseen.length) bad.push(id + ': primitive ' + unseen.join(', ') + ' is not seen in the isometric or three-quarter view from any facing (under a pixel, or hidden)');
      // the same pixels again
      if (hash(E.shapeInfo(id, { view: E.VIEWS.iso, facing: 0 }).rgba) !== H.h) bad.push(id + ' draws different pixels the second time');
    }
    // a generator's params change its pixels; the same params give the same pixels
    const gen = [['pine', { h: 30 }], ['tree', { seed: 2 }], ['bush', { r: 10 }], ['rock', { seed: 9 }], ['crystal', { seed: 4 }], ['fence', { len: 32 }], ['grass', { n: 4 }]];
    for (const [id, p] of gen) { const a = E.shapeInfo(id, { view: E.VIEWS.iso }), b = E.shapeInfo(id, { view: E.VIEWS.iso, params: p }); if (hash(a.rgba) === hash(b.rgba) && a.w === b.w) bad.push(id + ' draws the same pixels with params ' + JSON.stringify(p)); }
    // an entry redefined under the same id draws afresh (the cache keys each entry object, not its id), and keeps no
    // property of the engine's on it
    E.SHAPES.__t = { mats: { m: 'oak' }, parts: [['box', 'm', [0, 0, 0], [8, 8, 8]]] }; const a1 = E.shapeInfo('__t', { view: E.VIEWS.iso }).pixels; E.shapeSprite('__t', { view: 'iso' });
    E.SHAPES.__t = { mats: { m: 'oak' }, parts: [['box', 'm', [0, 0, 0], [16, 16, 16]]] }; const sp = E.shapeSprite('__t', { view: 'iso' });
    if (!(sp && E.shapeInfo('__t', { view: E.VIEWS.iso }).pixels > a1 * 2 && sp.w > 20)) bad.push('a shape redefined under the same id still draws the old entry');
    if (Object.keys(E.SHAPES.__t).some(k => k[0] === '_')) bad.push('drawing a shape leaves a property on its entry: ' + Object.keys(E.SHAPES.__t).join(', '));
    delete E.SHAPES.__t;
    return { bad, n: Object.keys(E.SHAPES).length, gens: gen.length };
  });
  for (const b of r.bad) fail('shapes', b);
  if (!r.bad.length) ok(r.n + ' shapes draw in 5 views and 8 facings, inside their bounds, every part seen; the same pixels twice; ' + r.gens + ' generators change with their params; one redefined draws afresh');
}

/* 2. every material on every surface */
console.log('2. every material on every surface');
{
  warnings.length = 0;
  const r = await page.evaluate(() => {
    const E = My3D2dge, bad = [], ids = Object.keys(E.MATERIALS), cv = document.createElement('canvas'); document.body.appendChild(cv);
    let scene = null; const game = new E.Game({ canvas: cv, menu: false, corner: false, res: [160, 120], view: 'iso', bg: '#000000' });
    game.start({ update() {}, draw(r) { if (scene) scene(r); } });
    const shot = () => { game.advance(1 / 120, { draw: true }); const b = game.screen.buf, d = b.getContext('2d').getImageData(0, 0, b.width, b.height).data; let n = 0, mag = 0; for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] > 0) n++; if (d[i] > 240 && d[i + 1] < 16 && d[i + 2] > 240) mag++; } return [n, mag]; };
    for (const id of ids) {
      // a wall block with this face and top, on a floor of it (isometric)
      const map = new E.TileMap({ w: 3, h: 3, cells: [0, 0, 0, 0, 1, 0, 0, 0, 0], types: { 1: { h: 24, top: '#6a6280', side: '#4a4360', face: id, roof: id } }, floorMat: id });
      game.setView('iso'); scene = r => { map.drawFloor(r); map.queueWalls(r); }; game.focus(24, 24, 0);
      let [n, mag] = shot(); if (n < 1500) bad.push(id + ' on a wall and a floor draws ' + n + ' pixels'); if (mag) bad.push(id + ' on a wall or a floor draws magenta');
      // a platform tile of it (side view), and a shape of it
      const level = new E.PlatformMap({ rows: ['...', '.#.', '###'], legend: { '#': 1 }, types: { 1: { kind: 'solid', style: 'block', mat: id } } });
      game.setView('side'); scene = r => level.draw(r); game.focus(24, 0, 24);
      [n, mag] = shot(); if (n < 600) bad.push(id + ' on a platform tile draws ' + n + ' pixels'); if (mag) bad.push(id + ' on a platform tile draws magenta');
      game.setView('iso'); scene = r => r.shape({ mats: { m: id }, parts: [['box', 'm', [0, 0, 0], [12, 12, 10]]] }, 0, 0, 0); game.focus(0, 0, 0);
      [n, mag] = shot(); if (n < 150) bad.push(id + ' on a shape draws ' + n + ' pixels'); if (mag) bad.push(id + ' on a shape draws magenta');
    }
    game.stop(); cv.remove();
    // the engine's own looks are entries: wall faces, wall tops, tile styles, floor textures
    for (const k of ['stone', 'rock', 'plank', 'timber', 'plaster', 'hedge']) if (!E.MATERIALS[k] || !E.MATERIALS[k].face) bad.push('the wall face ' + k + ' is not an entry with a face painter');
    for (const k of ['tiles', 'slab', 'leaves', 'grass']) if (!E.MATERIALS[k] || !E.MATERIALS[k].roof) bad.push('the wall top ' + k + ' is not an entry with a roof painter');
    for (const k of ['brick', 'stone', 'wood', 'metal', 'ground', 'pipe', 'block', 'bonus']) if (!E.MATERIALS[k] || !E.MATERIALS[k].tile) bad.push('the tile style ' + k + ' is not an entry with a tile painter');
    for (const k of ['flagstone', 'grass', 'dirt', 'water', 'planks', 'checker', 'plain']) if (!E.MATERIALS[k] || !E.MATERIALS[k].floor) bad.push('the floor texture ' + k + ' is not an entry with a floor painter');
    return { bad, n: ids.length };
  });
  for (const b of r.bad) fail('materials', b);
  for (const w of warnings) fail('materials', 'a warning: ' + w);
  const clean = !r.bad.length && !warnings.length;
  // an unknown name warns, with the list
  warnings.length = 0;
  await page.evaluate(() => { const E = My3D2dge; E.material('no-such-stuff', null, 'wall face'); });
  if (!warnings.some(w => /unknown wall face "no-such-stuff"\. Materials: .*oak/.test(w))) fail('materials', 'an unknown face name does not warn with the list of names');
  if (clean) ok(r.n + ' materials draw on a wall face, a wall top, a floor, a platform tile and a shape; the engine\'s own faces, tops, tile styles and floor textures are entries');
  // overlays: each draws in its own tones (cracks: the material's), moss on what looks up, dirt near the ground
  const v = await page.evaluate(() => {
    const E = My3D2dge, bad = [], STONE = { color: '#7a7486', pattern: 'stones', size: 5 };
    const draw = (size, over) => E.shapeInfo({ mats: { m: Object.assign({}, STONE, over ? { over: [over] } : {}) }, parts: [['box', 'm', [0, 0, 0], size]] }, { view: E.VIEWS.iso });
    const ramp = c => { const t = E.tones(c); return new Set([t.deep, t.sh, t.base, t.lt, t.hi].map(h => h.toLowerCase())); }, hx = (d, j) => '#' + [0, 1, 2].map(i => d[j * 4 + i].toString(16).padStart(2, '0')).join('');
    const changed = (size, over) => { const a = draw(size), b = draw(size, over), js = []; for (let j = 0; j < a.rgba.length / 4; j++) if (a.rgba[j * 4 + 3] && (a.rgba[j * 4] !== b.rgba[j * 4] || a.rgba[j * 4 + 1] !== b.rgba[j * 4 + 1] || a.rgba[j * 4 + 2] !== b.rgba[j * 4 + 2])) js.push(j); return { a, b, js }; };
    for (const [k, col] of [['moss', '#5f7a3a'], ['cracks', null], ['dirt', '#6a5038'], ['rust', '#9a4a22']]) {
      const { b, js } = changed([16, 16, 16], [k, col]);
      if (!js.length) { bad.push('the ' + k + ' overlay changes nothing on a stone box'); continue; }
      const own = col ? ramp(col) : ramp(STONE.color), off = js.filter(j => !own.has(hx(b.rgba, j)));
      if (off.length) bad.push('the ' + k + ' overlay draws ' + off.length + ' pixels outside its tones (' + hx(b.rgba, off[0]) + ')');
    }
    const slab = changed([16, 16, 2], ['moss']), wall = changed([16, 2, 16], ['moss']);
    if (!(slab.js.length > slab.a.pixels * .2 && wall.js.length < wall.a.pixels * .1)) bad.push('moss covers ' + slab.js.length + ' of a slab\'s ' + slab.a.pixels + ' pixels and ' + wall.js.length + ' of a wall\'s ' + wall.a.pixels + ': it should cover what looks up');
    const post = changed([12, 12, 32], ['dirt', null, { h: 6, amount: 1 }]), rows = post.js.map(j => Math.floor(j / post.a.w)), low = post.a.h * .6;
    if (!rows.length || rows.some(y => y < low)) bad.push('dirt (h 6) on a post 32 tall reaches row ' + Math.min(...rows) + ' of ' + post.a.h + ': it should stay near the ground');
    return bad;
  });
  for (const b of v) fail('materials', b);
  if (!v.length) ok('the overlays moss, cracks, dirt and rust draw in their own tones; moss on what looks up, dirt near the ground');
}

/* 3. collision and sorting */
console.log('3. solid shapes: collision and sorting');
{
  const r = await page.evaluate(() => {
    const E = My3D2dge, bad = [], T = 16, map = () => new E.TileMap({ w: 12, h: 12 });
    // walk into a table (24 x 14, top at 12) from the west: stops at its edge
    let m = map(); m.solid('table', 96, 96, 0, { facing: Math.PI / 2 });
    let b = new E.Body({ x: 60, y: 96, r: 5 }); for (let i = 0; i < 240; i++) { b.vx = 60; b.update(1 / 120, m); }
    if (b.x > 96 - 12 - 5 + .5) bad.push('a body walking into the table passed its edge (x ' + b.x.toFixed(1) + ', the edge is at 84 - 5)');
    // a jump at it, below its top: stopped
    b = new E.Body({ x: 60, y: 96, r: 5 }); b.jump(120); for (let i = 0; i < 120; i++) { b.vx = 60; b.update(1 / 120, m); }
    if (b.x > 96 - 12 - 5 + .5) bad.push('a body jumping at the table below its top passed through it (x ' + b.x.toFixed(1) + ')');
    // a body dropped onto it lands on its top
    b = new E.Body({ x: 96, y: 96, z: 30, r: 5, onGround: false }); for (let i = 0; i < 240; i++) b.update(1 / 120, m);
    if (Math.abs(b.z - 12) > .01 || !b.onGround) bad.push('a body dropped onto the table did not land on its top (z ' + b.z.toFixed(2) + ')');
    // a shape set above a body's head (a shelf at z 40): it walks under it
    m = map(); m.solid('crate', 96, 96, 40);
    b = new E.Body({ x: 60, y: 96, r: 5 }); for (let i = 0; i < 240; i++) { b.vx = 60; b.update(1 / 120, m); }
    if (b.x < 120) bad.push('a body did not walk under a crate set at z 40 (x ' + b.x.toFixed(1) + ')');
    // the solid's box turns, scales and mirrors with the shape: compare it with the shape drawn from straight above
    const over = E.VIEWS.overhead, iou = (id, o) => {
      m = map(); const s = m.solid(id, 0, 0, 0, o), I = E.shapeInfo(id, Object.assign({ view: over }, o)); let inter = 0, uni = 0;
      for (let j = 0; j < I.rgba.length / 4; j++) { const x = j % I.w - I.ox + .5, y = Math.floor(j / I.w) - I.oy + .5, lx = (x - s.x) * s.c + (y - s.y) * s.s, ly = -(x - s.x) * s.s + (y - s.y) * s.c, inBox = Math.abs(lx) <= s.hx && Math.abs(ly) <= s.hy, drawn = I.rgba[j * 4 + 3] > 0; if (inBox && drawn) inter++; if (inBox || drawn) uni++; }
      return inter / (uni || 1);
    };
    for (const [id, o] of [['crate', { facing: .7 }], ['table', { facing: 2.1, scale: 1.5 }], ['bed', { facing: -.4, flip: true }], ['chest', { facing: 1, flip: true, scale: .8 }]]) { const v = iou(id, o); if (v < .8) bad.push('the solid box of ' + id + ' ' + JSON.stringify(o) + ' matches its top-down picture at IoU ' + v.toFixed(2) + ' (want .8)'); }
    // sorting: a hero round a table, in the three-quarter view: in front of it on its near side, behind it on its far side
    // (a magenta stand-in for the hero: on the near side it shows whole, on the far side the table hides part of it)
    const cv = document.createElement('canvas'); document.body.appendChild(cv); let hx = 0, hy = 0, withTable = true;
    const game = new E.Game({ canvas: cv, menu: false, corner: false, res: [200, 150], view: 'threequarter', bg: '#000000' });
    game.start({ update() {}, draw(r) { if (withTable) r.shape('table', 0, 0, 0, { facing: 0, shadow: false }); r.actor(hx, hy, 0, (g, ox, oy) => { g.fillStyle = '#ff00ff'; g.fillRect(ox - 4, oy - 30, 8, 30); }, { outline: false, rim: false }); } });
    const magenta = () => { game.focus(0, 0, 0); game.advance(1 / 120, { draw: true }); const b = game.screen.buf, d = b.getContext('2d').getImageData(0, 0, b.width, b.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] < 16 && d[i + 2] > 240) n++; return n; };
    for (const [x, y, want] of [[0, 9, 'front'], [0, -9, 'behind'], [10, 9, 'front'], [-10, -9, 'behind'], [14, 0, 'front?'], [-14, 0, 'front?']]) {
      hx = x; hy = y; withTable = false; const alone = magenta(); withTable = true; const seen = magenta(), got = seen >= alone ? 'front' : 'behind';
      if (want !== 'front?' && got !== want) bad.push('a hero at (' + x + ', ' + y + ') beside a table shows ' + seen + ' of its ' + alone + ' pixels: it sorts ' + got + ' (want ' + want + ')');
    }
    game.stop(); cv.remove();
    return { bad };
  });
  for (const b of r.bad) fail('collision', b);
  if (!r.bad.length) ok('bodies stop at a solid table, walking or jumping below its top, land on it, walk under a crate set above them; the solid box turns, scales and mirrors with the shape; a hero sorts right round a table');
}

/* 4. sets */
console.log('4. sets: names, never replacing, own ids first, sprites');
{
  warnings.length = 0;
  const r = await page.evaluate(() => {
    const E = My3D2dge, bad = [], core = E.SHAPES.barrel;
    const A = { set: 'A', format: 1, materials: { wood: '#203040 planks' }, shapes: { barrel: { about: 'A barrel', mats: { w: 'wood' }, parts: [['cyl', 'w', [0, 0, 0], 6, 14]] }, stack: { about: 'two of them', parts: [['use', 'barrel', [-7, 0, 0]], ['use', 'barrel', [7, 0, 0]]] } },
      sprites: { coin: { rows: ['.33.', '3443', '3443', '.22.'], colors: { 2: 'gold:sh', 3: 'gold', 4: 'gold:hi' } } } };
    const B = { set: 'B', format: 1, materials: { wood: '#c0a080 planks' }, shapes: { barrel: { about: 'B barrel', mats: { w: 'wood' }, parts: [['cyl', 'w', [0, 0, 0], 6, 14]] } } };
    const ra = E.addAssets(A), rb = E.addAssets(B);
    if (ra.shapes.join() !== 'A:barrel,A:stack' || rb.shapes.join() !== 'B:barrel') bad.push('the ids returned: ' + ra.shapes + ' / ' + rb.shapes);
    if (E.SHAPES.barrel !== core) bad.push('a set replaced the core barrel');
    if (E.SHAPES['A:barrel'].about !== 'A barrel' || E.SHAPES['B:barrel'].about !== 'B barrel') bad.push('a set replaced another set\'s entry');
    const ia = E.shapeInfo('A:barrel', { view: E.VIEWS.side }), ib = E.shapeInfo('B:barrel', { view: E.VIEWS.side }), mid = I => { const j = (I.oy - 7) * I.w + I.ox; return [I.rgba[j * 4], I.rgba[j * 4 + 1], I.rgba[j * 4 + 2]]; };
    const ca = mid(ia), cb = mid(ib); if (Math.abs(ca[0] - cb[0]) + Math.abs(ca[2] - cb[2]) < 60) bad.push('the two sets\' "wood" look the same: ' + ca + ' / ' + cb);
    const st = E.shapeInfo('A:stack', { view: E.VIEWS.side }); if (st.prims !== 2 || st.w < 2 * ia.w - 4) bad.push('A:stack does not use A\'s own barrel (two of them): ' + st.prims + ' primitives, ' + st.w + ' wide');
    E.addAssets(A);   // again: kept, with a warning
    if (E.SHAPES['A:barrel'].about !== 'A barrel') bad.push('adding a set twice replaced its entry');
    const coin = ra.sprites['A:coin'], gold = E.material('gold').hexes; if (!coin || !coin.isSprite || coin.w !== 4) bad.push('the sprite A:coin was not made');
    else { const d = coin.cv.getContext('2d').getImageData(1, 1, 1, 1).data, want = E.hex(gold[4]); if (Math.abs(d[0] - want[0]) + Math.abs(d[1] - want[1]) > 4) bad.push('the sprite\'s "gold:hi" is ' + [d[0], d[1], d[2]] + ', not ' + want); }
    return { bad };
  });
  for (const b of r.bad) fail('sets', b);
  if (!warnings.some(w => /A:barrel is already there/.test(w))) fail('sets', 'adding an id that is already there does not warn');
  if (!r.bad.length) ok('E.addAssets names entries SET:id, keeps the core\'s and other sets\', uses a set\'s own ids first, warns on an id already there; sprites take material:tone colors');
}

/* 5. validation */
console.log('5. a broken entry warns, naming the entry and the field');
{
  warnings.length = 0;
  await page.evaluate(() => {
    const E = My3D2dge;
    E.SHAPES.broken = { about: 'broken', parts: [['box', 'oak', [0, 0, 0], [4, 4]], ['cyl', 'oak', [0, 0], 3, 4], ['lathe', 'oak', [0, 0, 0], [[1, 2]]], ['spline', 'oak', [0, 0, 0]], ['mirror', 'q', ['box', 'oak', [0, 0, 0], [1, 1, 1]]]] };
    E.shapeInfo('broken', { view: E.VIEWS.iso });
  });
  const want = [/broken: parts\[0\] \(box\): its size is \[w, d, h\]/, /broken: parts\[1\] \(cyl\): its at is \[x, y, z\]/, /broken: parts\[2\] \(lathe\): its profile is/, /broken: parts\[3\]: unknown part "spline"/, /broken: parts\[4\] \(mirror\): its axis is/];
  const miss = want.filter(re => !warnings.some(w => re.test(w)));
  for (const re of miss) fail('validation', 'no warning matching ' + re + ' (got: ' + warnings.join(' | ') + ')');
  if (!miss.length) ok('5 broken parts warn, each naming the entry, the part and what it should be');
}

/* 6. size */
console.log('6. the library\'s size');
{
  const src = ENGINE, a = src.indexOf(' * 21f. THE CORE LIBRARY'), b = src.indexOf('/* ====', a + 10), lib = src.slice(a, b);
  const body = lib.slice(lib.indexOf('Object.assign(SHAPES, {')), starts = [...body.matchAll(/^(\w+): \{/gm)], sizes = [];
  starts.forEach((m, i) => { const text = body.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : body.lastIndexOf('});')).trim().replace(/,$/, ''); sizes.push([m[1], tok(text)]); });
  const big = sizes.filter(([, n]) => n > 300), med = sizes.map(s => s[1]).sort((x, y) => x - y)[sizes.length >> 1];
  for (const [id, n] of big) fail('size', id + ' is ' + n + ' tokens (over 300)');
  if (med > 150) fail('size', 'the median core shape is ' + med + ' tokens (over 150)');
  if (lib.length > 12 * 1024) fail('size', 'the core library is ' + (lib.length / 1024).toFixed(1) + ' KB of source (over 12)');
  if (!big.length && med <= 150 && lib.length <= 12 * 1024) ok(sizes.length + ' core shapes, median ' + med + ' tokens, largest ' + Math.max(...sizes.map(s => s[1])) + '; the core library ' + (lib.length / 1024).toFixed(1) + ' KB');
  writeFileSync(join(out, 'sizes.json'), JSON.stringify(Object.fromEntries(sizes), null, 1));
}

/* 7. the store: provenance, licenses, catalogs, ledgers, fit, sprites exact, cut sets equal to their sources */
console.log('7. the store (src/assets/)');
{
  const { readSet, readCatalog, readLedger, LICENSES, cacheDir, decodePNG } = await import('./asset-lib.mjs');
  const dir = join(root, 'src/assets/sets'), files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.js')).sort() : [], sets = files.map(f => [f, readSet(join(dir, f))]);
  const bySrc = new Map(), counts = { shapes: 0, materials: 0, sprites: 0 }, fits = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // the sets the importer wrote are the ones with a catalog of their own name; the others are cut from them (asset-set)
  const imported = sets.filter(([, S]) => existsSync(join(root, 'src/assets/catalogs', S.set + '.json')));
  const setOf = new Map();
  for (const [f, S] of imported) for (const kind of ['shapes', 'materials', 'sprites']) for (const [id, e] of Object.entries(S[kind] || {})) if (e && e.src) { bySrc.set(e.src + '|' + kind + '|' + id, e); setOf.set(e, S); }
  // an entry with its slots' materials written out (a cut set may rename a kit color that two sets share: oak-2)
  const resolved = (e, S) => { const c = JSON.parse(JSON.stringify(e)), m = n => (S.materials || {})[n] !== undefined ? S.materials[n] : n;
    if (c.mats) for (const k of Object.keys(c.mats)) c.mats[k] = m(c.mats[k]);
    if (c.colors) for (const k of Object.keys(c.colors)) { const [a, t] = String(c.colors[k]).split(':'); c.colors[k] = [m(a), t]; }
    return c; };
  for (const [f, S] of sets) {
    const where = 'src/assets/sets/' + f;
    if (S.format !== 1 || !S.set || !S.credit) fail('store', where + ': a set needs set, format: 1 and credit');
    if (f !== S.set + '.js') fail('store', where + ': the file is named after its set (' + S.set + '.js)');
    for (const [k, r] of Object.entries(S.sources || {})) {
      if (!LICENSES.includes(r.license)) fail('store', where + ': the download ' + k + ' is licensed ' + r.license + ' (the store takes ' + LICENSES.join(' or ') + ')');
      for (const field of ['label', 'origin', 'url', 'fetched', 'licenseHash']) if (!r[field]) fail('store', where + ': the download ' + k + ' has no ' + field);
      if (!r.sha256 && !r.commit) fail('store', where + ': the download ' + k + ' has neither a sha256 nor a commit');
    }
    const cut = !imported.some(([g]) => g === f), cat = cut ? null : readCatalog(S.set);
    for (const kind of ['shapes', 'materials', 'sprites']) for (const [id, e] of Object.entries(S[kind] || {})) {
      if (typeof e === 'string') continue;   // (a kit's material: a hex on a core pattern, no provenance of its own)
      counts[kind]++;
      if (!e.src || !S.sources[e.src]) { fail('store', where + ' ' + id + ': its src ' + e.src + ' is not one of the set\'s downloads'); continue; }
      if (!e.orig) fail('store', where + ' ' + id + ': no orig (the file in its download)');
      if (e.fit === undefined) fail('store', where + ' ' + id + ': no fit');
      if (kind === 'shapes' && e.fit) {   // each entry as the importer keeps it: a mean of .8 or better, no view under .6
        if (!cut) fits.push(e.fit.iou);   // (a cut set's entries are counted in their own sets)
        if (!(e.fit.iou >= .8)) fail('store', where + ' ' + id + ': it fits at a mean IoU of ' + e.fit.iou + ' (under .8)');
        if (!(e.fit.worst >= .6)) fail('store', where + ' ' + id + ': a view fits at ' + e.fit.worst + ' (under .6)');
      }
      if (cat && !Array.isArray(cat[id])) fail('store', where + ' ' + id + ': not in its catalog (src/assets/catalogs/' + S.set + '.json: "' + id + '": ["tags", "what it looks like"])');
      if (cut) { const o = bySrc.get(e.src + '|' + kind + '|' + id); if (!o) fail('store', where + ' ' + id + ': cut from no set the importer wrote'); else if (!same(resolved(o, setOf.get(o)), resolved(e, S))) fail('store', where + ' ' + id + ': differs from the entry it was cut from'); }
    }
    if (cat) {
      // the ledger: every download on record has rows, every row names a download, the rows the set uses are its entries
      const L = readLedger(S.set), srcs = Object.keys(cat.$sources || {});
      // a described entry is in the set, unless the importer left it out for its fit (the ledger says so)
      const idOf = f => f.split('/').pop().replace(/(\.gltf)?\.(glb|gltf|png|jpe?g)$/i, '').replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase();
      const unfit = new Set(L.filter(r => /\bfit\b/.test(r.flags)).map(r => idOf(r.file)));
      for (const id of Object.keys(cat)) if (id[0] !== '$' && !(S.shapes || {})[id] && !(S.materials || {})[id] && !(S.sprites || {})[id] && !unfit.has(id)) fail('store', 'src/assets/catalogs/' + S.set + '.json describes ' + id + ', which is not in the set (or in $skip, or left out for its fit)');
      if (!L.length) fail('store', S.set + ': no ledger (src/assets/catalogs/' + S.set + '.tsv)');
      for (const k of srcs) if (!L.some(r => r.src === k)) fail('store', S.set + ': the download ' + k + ' has no rows in its ledger');
      for (const r of L) if (!srcs.includes(r.src)) fail('store', S.set + ': a ledger row names ' + r.src + ', which is not on record');
      const usedRows = L.filter(r => r.used === '1').length, n = ['shapes', 'materials', 'sprites'].reduce((t, k) => t + Object.values(S[k] || {}).filter(e => typeof e !== 'string').length, 0);
      if (usedRows !== n) fail('store', S.set + ': its ledger marks ' + usedRows + ' files used, the set has ' + n + ' entries');
      for (const k of Object.keys(cat.$skip || {})) if (!cat.$skip[k]) fail('store', S.set + ': $skip ' + k + ' gives no reason');
      // sprites are exact: each one drawn from its rows matches its source image, where the download is in .cache
      for (const [id, e] of Object.entries(S.sprites || {})) {
        const file = join(cacheDir(S.set.split('-')[0]), (S.sources[e.src] || {}).dir || '', e.orig); if (!existsSync(file)) continue;
        const im = decodePNG(readFileSync(file)); let bad = im.w !== e.rows[0].length || im.h !== e.rows.length;
        for (let y = 0; y < im.h && !bad; y++) for (let x = 0; x < im.w && !bad; x++) { const i = (y * im.w + x) * 4, ch = e.rows[y][x]; if (!im.rgba[i + 3]) bad = ch !== '.'; else bad = (e.colors[ch] || '').toLowerCase() !== '#' + [0, 1, 2].map(k => im.rgba[i + k].toString(16).padStart(2, '0')).join(''); }
        if (bad) fail('store', S.set + ' ' + id + ': its rows do not match ' + e.orig + ' pixel for pixel');
      }
    }
  }
  const mean = fits.length ? fits.reduce((a, b) => a + b, 0) / fits.length : 1;
  if (mean < .8) fail('store', 'the shapes fit at a mean IoU of ' + mean.toFixed(2) + ' (under .8)');
  // every set loads in the engine: its ids qualified, nothing replaced, every shape draws
  warnings.length = 0;
  const loaded = await page.evaluate(texts => { const E = My3D2dge, bad = []; for (const t of texts) { (0, eval)(t); }
    for (const S of Object.values(window.ASSETS || {})) { const r = E.addAssets(S); for (const k of r.shapes) { const I = E.shapeInfo(k, { view: E.VIEWS.iso }); if (!I || !I.pixels) bad.push(k + ' draws nothing'); } }
    return bad; }, files.map(f => readFileSync(join(dir, f), 'utf8')));
  for (const b of loaded) fail('store', b);
  for (const w of warnings.filter(w => /asset|unknown/.test(w))) fail('store', 'a warning loading the sets: ' + w);
  if (!problems.some(p => p.startsWith('store'))) ok(sets.length + ' sets (' + counts.shapes + ' shapes, ' + counts.materials + ' materials, ' + counts.sprites + ' sprites): every download CC0 and on record, every entry in its catalog and ledger, shapes at a mean IoU of ' + mean.toFixed(2) + ' with no view under .6, sprites exact, cut sets equal to their sources, every set loads and draws');
}

/* 8. edge cases from the review of Phase 1, and the speed of a full room */
console.log('8. edge cases: broken parts, loops, edits, the floor, scale, sorting on top, speed');
{
  warnings.length = 0;
  const r = await page.evaluate(() => {
    const E = My3D2dge, bad = [], good = ['box', 'oak', [0, 0, 0], [8, 8, 8]];
    const tryDraw = (name, S) => { try { E.SHAPES['__b_' + name] = S; const I = E.shapeInfo('__b_' + name, { view: E.VIEWS.iso }); E.shapeSprite('__b_' + name); return I; } catch (e) { bad.push('a shape with ' + name + ' throws: ' + e.message); } };
    // broken parts are skipped: the good part beside each still draws
    for (const [name, parts] of [['a null part', [null, good]], ['a mirror without its part', [['mirror', 'x'], good]], ['a ring without its part', [['ring', 3, 3], good]], ['a group without parts', [['group', [0, 0, 0], 0], good]],
      ['a use without at', [['use', 'barrel'], good]], ['a box without a size', [['box', 'oak', [0, 0, 0]], good]], ["rot: 'x'", [['box', 'oak', [0, 0, 0], [4, 4, 4], { rot: 'x' }], good]]]) {
      const I = tryDraw(name, { parts }); if (I && !I.pixels) bad.push('beside ' + name + ', the good part draws nothing');
    }
    tryDraw('parts {}', { parts: {} }); tryDraw('make() returning nothing', { make: () => undefined });
    // a set's material naming the registry's by its own id; a loop of two
    try {   // (drawn in the registry's oak: the same pixels as a box in oak outside any set)
      E.addAssets({ set: 'L', format: 1, materials: { oak: 'oak' }, shapes: { b: { parts: [['box', 'oak', [0, 0, 0], [8, 8, 8]]] } } });
      const a = E.shapeInfo('L:b', { view: E.VIEWS.iso }).rgba, b = E.shapeInfo({ parts: [['box', 'oak', [0, 0, 0], [8, 8, 8]]] }, { view: E.VIEWS.iso }).rgba;
      if (a.length !== b.length || a.some((v, i) => v !== b[i])) bad.push("a set's oak: 'oak' does not draw as the registry's oak");
    } catch (e) { bad.push("a set's oak: 'oak' throws: " + e.message); }
    E.MATERIALS.__l1 = '__l2'; E.MATERIALS.__l2 = '__l1'; try { if (E.material('__l1') !== null) bad.push('a material loop resolves to something'); } catch (e) { bad.push('a material loop throws: ' + e.message); }
    // an edited material redraws a cached picture
    const red = () => { const s = E.shapeSprite('__paint', { view: 'iso', outline: false }), d = s.cv.getContext('2d').getImageData(0, 0, s.w, s.h).data; let n = 0, r = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { n++; r += d[i] - d[i + 2]; } return r / n; };
    E.MATERIALS.__p = { color: '#c02020', pattern: 'none' }; E.SHAPES.__paint = { parts: [['box', '__p', [0, 0, 0], [12, 12, 12]]] };
    const r0 = red(); E.MATERIALS.__p.color = '#2020c0'; const r1 = red(); if (!(r0 > 50 && r1 < -50)) bad.push('a material edited after drawing still draws its old color (red minus blue ' + r0.toFixed(0) + ' then ' + r1.toFixed(0) + ')');
    // a part below the floor: drawn as the part above it, not clipped at the old bounds
    const px = parts => E.shapeInfo({ parts }, { view: E.VIEWS.iso, facing: .6 }).pixels, sunk = px([['box', 'oak', [0, 0, -8], [16, 16, 16]]]), half = px([['box', 'oak', [0, 0, 0], [16, 16, 8]]]);
    if (Math.abs(sunk - half) > half * .03) bad.push('a box half below the floor draws ' + sunk + ' pixels, the half above it ' + half);
    // an entry's own scale, times the placement's
    E.SHAPES.__s1 = { parts: [good] }; E.SHAPES.__s2 = { scale: 2, parts: [good] };
    const span = I => { let a = 1e9, b = -1; for (let j = 0; j < I.w * I.h; j++) if (I.rgba[j * 4 + 3]) { const x = j % I.w; a = Math.min(a, x); b = Math.max(b, x); } return b - a + 1; };   // (its drawn width, not the picture's margin)
    const w1 = span(E.shapeInfo('__s1', { view: E.VIEWS.side })), w2 = span(E.shapeInfo('__s2', { view: E.VIEWS.side })), w3 = span(E.shapeInfo('__s2', { view: E.VIEWS.side, scale: 1.5 }));
    if (Math.abs(w2 - 2 * w1) > 2 || Math.abs(w3 - 3 * w1) > 3) bad.push('an entry with scale: 2 draws ' + w2 + ' wide (and at scale 1.5, ' + w3 + '), the same at 1 ' + w1);
    const sm = new E.TileMap({ w: 8, h: 8 }), so = sm.solid('__s2', 64, 64, 0); if (Math.abs(so.hx - 8) > .5 || Math.abs(so.top - 16) > .5) bad.push('the solid of an entry with scale: 2 is ' + so.hx * 2 + ' wide and ' + so.top + ' tall (want 16 and 16)');
    // the crate pattern repeats past its face (a wall face, a tile past the first)
    const cr = (u, v) => E.PATTERNS.crate({ u, v, W: 14, H: 13, lid: false, curved: false, px: 1, lit: .5 }, { frame: 2, bw: 3 });
    let diff = 0; for (let u = 0; u < 14; u += .5) for (let v = 0; v < 13; v += .5) if (cr(u, v) !== cr(u + 28, v + 13)) diff++; if (diff) bad.push('the crate pattern does not repeat past its face (' + diff + ' points differ)');
    // a raised solid (a crate on a shelf at z 40) is no wall under it; two crates stacked are as tall as both
    const hm = new E.TileMap({ w: 12, h: 12 }); hm.solid('crate', 96, 96, 40); if (hm.heightAt(96, 96) !== 0) bad.push('under a crate at z 40 the height is ' + hm.heightAt(96, 96) + ', not 0');
    const st = new E.TileMap({ w: 12, h: 12 }), c2 = st.solid('crate', 96, 96, 14), c1 = st.solid('crate', 96, 96, 0); if (st.heightAt(96, 96) !== c2.top) bad.push('two crates stacked are ' + st.heightAt(96, 96) + ' tall, not ' + c2.top);
    return { bad };
  });
  for (const b of r.bad) fail('edges', b);
  // each kind warned of: the parts, the rot, the loop
  for (const re of [/is a part: \[kind/, /its part is \[kind/, /its parts are a list/, /its at is \[x, y, z\]/, /its size is \[w, d, h\]/, /its rot is degrees/, /is a list of parts/, /names materials in a loop/])
    if (!warnings.some(w => re.test(w))) fail('edges', 'no warning matching ' + re);
  if (!r.bad.length) ok('broken parts skipped with a warning, never thrown (9 kinds); a material naming itself or a loop ends; an edited material redraws; parts below the floor whole; scale on an entry; the crate repeats; heights under and over raised solids');
}
{
  // sorting on top: a jar on a table's back half draws whole over it; the outline in the renderer's color; 300 shapes in view
  const r = await page.evaluate(() => {
    const E = My3D2dge, bad = [], cv = document.createElement('canvas'); document.body.appendChild(cv);
    const game = new E.Game({ canvas: cv, menu: false, corner: false, res: [480, 270], view: 'threequarter', bg: '#000000' });
    let scene = 'jar', table = true, map = new E.TileMap({ w: 30, h: 30 }); map.solid('table', 240, 240, 0, { facing: 0 });
    const ids = Object.keys(E.SHAPES).filter(k => !k.startsWith('__') && !k.includes(':')), room = [];
    for (let i = 0; i < 300; i++) room.push([ids[i % ids.length], 32 + (i % 20) * 22, 32 + Math.floor(i / 20) * 26, { facing: (i * 2.4) % 6.28 }]);
    game.start({ update() {}, draw(r) {
      map.drawFloor(r); map.queueWalls(r);
      if (scene === 'jar') { if (table) r.shape('table', 240, 240, 0, { facing: 0, shadow: false }); r.shape('jar', 236, 236, 12, { mats: { c: '#ff00ff none', g: '#ff00ff none', w: '#ff00ff none' }, shadow: false }); }
      else if (scene === 'outline') r.shape('crate', 240, 240, 0, { shadow: false });
      else if (scene === 'glow' || scene === 'dull') r.shape(scene === 'glow' ? 'crystal' : 'crate', 240, 240, 0, { shadow: false });
      else if (scene === 'room') for (const [id, x, y, o] of room) r.shape(id, x, y, 0, o);
    } });
    const shot = () => { game.advance(1 / 120, { draw: true }); const b = game.screen.buf; return b.getContext('2d').getImageData(0, 0, b.width, b.height).data; };
    const count = (d, f) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (f(d[i], d[i + 1], d[i + 2])) n++; return n; }, mag = (r, g, b) => r > 200 && g < 60 && b > 200;
    game.focus(240, 240, 0); table = false; const alone = count(shot(), mag); table = true; const on = count(shot(), mag);
    if (on < alone * .97) bad.push('a jar on a table\'s back half shows ' + on + ' of its ' + alone + ' pixels: the table draws over it');
    scene = 'outline'; game.r.outline = '#00ff00'; const green = count(shot(), (r, g, b) => r === 0 && g === 255 && b === 0); game.r.outline = '#140c1c';
    if (green < 20) bad.push('a crate\'s outline is not in the renderer\'s color (' + green + ' green pixels)');
    // in the dark (canvas lighting, ambient .05) a crystal's glowing material stays bright; a crate does not
    const brightest = d => { let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i] + d[i + 1] + d[i + 2]); return m; };
    game.lights.enabled = true; game.lights.ambient = .05; scene = 'glow'; const lit = brightest(shot()); scene = 'dull'; const dull = brightest(shot()); game.lights.enabled = false;
    if (!(lit > 400 && lit > dull * 2)) bad.push('in the dark a crystal is as dim as a crate (brightest ' + lit + ' against ' + dull + '): its glow is lit like the rest');
    // 300 shapes in view: the first frame (every picture made), the steady frames, the cache
    scene = 'room'; game.focus(240, 220, 0); game.setZoom && game.setZoom(.5);
    let t = performance.now(); shot(); const first = performance.now() - t;
    for (let i = 0; i < 5; i++) shot(); t = performance.now(); for (let i = 0; i < 20; i++) shot(); const steady = (performance.now() - t) / 20;
    scene = 'none'; t = performance.now(); for (let i = 0; i < 20; i++) shot(); const empty = (performance.now() - t) / 20;
    game.stop(); cv.remove();
    return { bad, first, steady, empty, pictures: new Set(room.map(([id, , , o]) => id + ':' + Math.round(o.facing / 6.283 * 32) % 32)).size };
  });
  for (const b of r.bad) fail('edges', b);
  if (r.steady - r.empty > 12) fail('speed', '300 shapes in view cost ' + (r.steady - r.empty).toFixed(1) + ' ms a frame (over 12)');
  if (!r.bad.length) ok('a jar on a table\'s back half draws over it; the outline takes the renderer\'s color; a crystal glows in the dark');
  console.log('  300 shapes in view (' + r.pictures + ' pictures, the cache holds 800): first frame ' + r.first.toFixed(0) + ' ms, steady ' + r.steady.toFixed(1) + ' ms a frame (' + r.empty.toFixed(1) + ' without them)');
  writeFileSync(join(out, 'speed.json'), JSON.stringify({ pictures: r.pictures, first: +r.first.toFixed(1), steady: +r.steady.toFixed(2), empty: +r.empty.toFixed(2) }, null, 1));
}

/* 9. the games' cut sets: every entry a page's code names from the set it loads is in that set (a typo, or an entry left
 * out of a re-cut, would draw nothing and say nothing), and every entry of a game's cut set is named (no dead weight in a
 * kit that a model reads whole) */
console.log('9. the games\' cut sets: what the code names is there, and nothing more');
{
  const { readSet } = await import('./asset-lib.mjs');
  const GAMES = { platformer: ['src/starter/20-platformer.js'], shooter: ['src/starter/30-shooter.js'], brawler: ['src/starter/50-brawler.js'], animlab: ['src/starter/60-animlab.js'],
    adventure: ['src/starter/10-adventure.js'], rpg: ['src/starter/40-rpg.js'], stealth: ['src/starter/70-stealth.js'], action3d: ['src/starter3d/10-action.js'],
    platformer3d: ['src/starter3d/20-platformer.js'], emberdeep: ['src/emberdeep/53-scenes.js', 'src/emberdeep/56-town.js'] };
  for (const [set, files] of Object.entries(GAMES)) {
    const S = readSet(join(root, 'src/assets/sets', set + '.js')), ids = new Set(Object.keys(S.shapes || {})), src = files.map(f => readFileSync(join(root, f), 'utf8')).join('\n');
    // named: 'set:id' written out, or D + 'id' where the file says const D = 'set:'
    const named = [...src.matchAll(new RegExp("'" + set + ":([a-z0-9-]+)'", 'g'))].map(m => m[1]);
    for (const f of files) { const t = readFileSync(join(root, f), 'utf8'); if (new RegExp("const D = '" + set + ":'").test(t)) named.push(...[...t.matchAll(/D \+ '([a-z0-9-]+)'/g)].map(m => m[1])); }
    const missing = [...new Set(named.filter(id => !ids.has(id)))], unused = [...ids].filter(id => !src.includes("'" + id + "'") && !src.includes(':' + id + "'"));
    if (!named.length) fail('cut sets', set + ': ' + files.join(', ') + ' name nothing from it');
    if (missing.length) fail('cut sets', set + ': named but not in src/assets/sets/' + set + '.js: ' + missing.join(', '));
    if (unused.length) fail('cut sets', set + ': in the set but named nowhere in ' + files.join(', ') + ': ' + unused.join(', '));
    if (named.length && !missing.length && !unused.length) ok(set + ': ' + ids.size + ' entries, each named by its game');
  }
}

await browser.close();
if (problems.length) { console.log('\nFAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log('\nall passed');
