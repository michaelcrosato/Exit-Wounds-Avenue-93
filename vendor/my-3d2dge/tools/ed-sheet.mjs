// The character sheet: one image of a playable character (src/emberdeep/18-characters.js) in every state and every
// view, a turnaround, and its size at game scale on every theme's floor, plus numbers a model can trust more than its
// eye: silhouette size per view, palette depth, contrast against each theme's floor, and motion lints from the joints
// (pops, feet sliding while it stands, joints under the floor, limbs that stretch). Made for the loop "edit the body,
// look at one image, read twenty lines": read the PNG, judge it against the quality bar in src/emberdeep/DESIGN.md.
// Usage: node tools/ed-sheet.mjs --character codex [--page examples/emberdeep.html] [--out check-output/sheet-codex.png]
//          [--scale 2]
// Writes the PNG and its numbers as JSON beside it. Exit code 1 only when the body cannot be drawn at all; the lints
// are things to look at, not failures (a deliberate squash can read as a stretch).
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const id = opt('character', null);
if (!id) { console.error('Usage: node tools/ed-sheet.mjs --character <id> [--page examples/emberdeep.html] [--out file.png] [--scale 2]'); process.exit(2); }
const out = resolve(opt('out', 'check-output/sheet-' + id + '.png')), scale = Math.max(1, Math.min(4, +opt('scale', 2)));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } }), errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(pathToFileURL(resolve(opt('page', 'examples/emberdeep.html'))).href + '?test=sheet');
await page.waitForFunction(() => window.__ed);

const res = await page.evaluate(([id, SC]) => {
  const { CHARACTERS, CHAR_STATES, REG } = __ed, E = My3D2dge, CHAR_VIEWS = __ed.game.views;   // the game's views (checkRig covers side too)
  if (!CHARACTERS[id]) return { error: 'no character "' + id + '" (registered: ' + Object.keys(CHARACTERS).join(', ') + ')' };
  __ed.game.paused = true;
  // a seeded Math.random from here on: the same sheet and the same numbers every run (rigs start breathing at a random moment)
  let seed = 1; Math.random = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const C = CHARACTERS[id], hero = __ed.newHero(id), make = () => __ed.charRig(hero), DT = 1 / 60;
  const base = { x: 0, y: 0, z: 0, vx: 0, vy: 0 };
  const pose = (rig, st, secs, facing = .6) => { const s = Object.assign({ facing }, base, st); for (let i = 0; i < Math.max(1, Math.round(secs * 60)); i++) rig.update(DT, s); return rig; };
  const canvas = (w, h) => { const c = E.mkCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; return [c, g]; };
  const lum = c => (3 * c[0] + 6 * c[1] + c[2]) / 10;
  // 1. how big it gets: the bounding box over every state and view, to size the cells
  const [mc, mg] = canvas(240, 240); let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  const bbox = g => { const d = g.getImageData(0, 0, 240, 240).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0; for (let y = 0; y < 240; y++) for (let x = 0; x < 240; x++) if (d[(y * 240 + x) * 4 + 3]) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1, y1, n }; };
  for (const v of CHAR_VIEWS) for (const [, st, hold] of CHAR_STATES) { mg.clearRect(0, 0, 240, 240); pose(make(), st, hold).draw(mg, 120, 180, E.VIEWS[v]); const b = bbox(mg); if (b.n) { bx0 = Math.min(bx0, b.x0); by0 = Math.min(by0, b.y0); bx1 = Math.max(bx1, b.x1); by1 = Math.max(by1, b.y1); } }
  if (bx1 < 0) return { error: 'the body draws nothing in any state or view' };
  const CW = Math.max(40, Math.min(120, Math.max(120 - bx0, bx1 - 120) * 2 + 10)), CH = Math.max(44, Math.min(140, 180 - by0 + Math.max(0, by1 - 180) + 10)), FY = CH - Math.max(6, by1 - 180 + 4);
  // a cell: the body drawn at 1x on a floor color with the renderer's 1 px outline, as the game shows it
  const cell = (rig, view, floor = '#1b1726') => {
    const [c, g] = canvas(CW, CH), [b, bg] = canvas(CW, CH);
    rig.draw(bg, CW / 2, FY, view);
    g.fillStyle = floor; g.fillRect(0, 0, CW, CH);
    const [o, og] = canvas(CW, CH); og.drawImage(b, 0, 0); og.globalCompositeOperation = 'source-in'; og.fillStyle = '#140c1c'; og.fillRect(0, 0, CW, CH);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(o, dx, dy);
    g.drawImage(b, 0, 0);
    return { c, body: b };
  };
  const LW = 92, HEAD = 18, bands = LW + CHAR_STATES.length * CW * SC > 2000 ? 2 : 1, cols = Math.ceil(CHAR_STATES.length / bands);
  const W = LW + Math.max(cols, 8) * CW * SC, turnH = CH * SC;
  const H = HEAD + bands * (HEAD + CHAR_VIEWS.length * CH * SC) + HEAD + turnH + HEAD + CH * 2 + 24;
  const [S, sg] = canvas(W, H); sg.fillStyle = '#0d0b14'; sg.fillRect(0, 0, W, H);
  const label = (t, x, y, c = '#cfc6e0', size = 11) => { sg.font = size + 'px sans-serif'; sg.fillStyle = c; sg.fillText(t, x, y); };
  label(C.name + ' (' + id + ')  ' + E.versionLabel(), 4, 13, '#ffd36a', 12);
  // 2. every state in every view (in bands of states when one row would be too wide to read)
  const pixels = {}, sizes = {}; let y = HEAD;
  for (let band = 0; band < bands; band++) {
  const states = CHAR_STATES.slice(band * cols, band * cols + cols);
  states.forEach(([name], i) => label(name, LW + i * CW * SC + 3, y + HEAD - 3, '#9d93b8', 10));
  y += HEAD;
  for (const v of CHAR_VIEWS) {
    label(v, 4, y + 14);
    states.forEach(([name, st, hold], i) => {
      const { c, body } = cell(pose(make(), st, hold), E.VIEWS[v]);
      sg.drawImage(c, LW + i * CW * SC, y, CW * SC, CH * SC);
      if (name === 'idle') { const b = (() => { const d = body.getContext('2d').getImageData(0, 0, CW, CH).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0; for (let yy = 0; yy < CH; yy++) for (let xx = 0; xx < CW; xx++) if (d[(yy * CW + xx) * 4 + 3]) { n++; x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy); } return { n, w: x1 - x0 + 1, h: y1 - y0 + 1 }; })(); pixels[v] = b.n; sizes[v] = b.w + 'x' + b.h; }
    });
    y += CH * SC;
  }
  }
  // 3. the turnaround: idle at eight facings (iso)
  label('turnaround (iso), facing every 45 degrees', 4, y + 13, '#9d93b8', 10); y += HEAD;
  for (let i = 0; i < 8; i++) { const { c } = cell(pose(make(), {}, .4, i * Math.PI / 4), E.VIEWS.iso); sg.drawImage(c, LW + i * CW * SC, y, CW * SC, CH * SC); }
  y += turnH;
  // 4. game scale on every theme's floor: 1x as the player sees it at the default zoom's base, and 2x
  label('game scale on each theme\'s floor (1x), and 2x on the floor it stands out from least', 4, y + 13, '#9d93b8', 10); y += HEAD;
  const floors = {};
  for (const [tid, T] of Object.entries(REG.themes)) {
    try {
      const L0 = { pal: T.pal, hue: 0, depth: 3, seed: 7, rec: { seed: 7, depth: 3, theme: tid }, theme: T, w: 40, h: 40, tags: new Array(1600).fill(null), cells: new Array(1600).fill(0), things: [], mechs: [], map: { w: 40, h: 40, floorTags: new Array(1600).fill(null), cell: () => 0 } };
      const cs = []; for (let i = 0; i < 64; i++) { const c = T.floor(L0, 40 + (i % 8) * 37, 40 + Math.floor(i / 8) * 29, null); if (c) cs.push(c); }
      if (cs.length) floors[tid] = cs.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]).map(v => Math.round(v / cs.length));
    } catch (e) { /* a theme whose floor needs a real level: left out */ }
  }
  const idle = pose(make(), {}, .6), hexOf = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  const bodyPx = (() => { const { body } = cell(idle, E.VIEWS.iso), d = body.getContext('2d').getImageData(0, 0, CW, CH).data, px = []; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) px.push([d[i], d[i + 1], d[i + 2]]); return px; })();
  const palette = new Set(bodyPx.map(c => c.join(','))).size, contrast = {};
  let x = LW, worst = null;
  for (const [tid, f] of Object.entries(floors)) {
    contrast[tid] = Math.round(100 * bodyPx.filter(c => Math.abs(lum(c) - lum(f)) >= 24).length / Math.max(1, bodyPx.length));
    if (!worst || contrast[tid] < contrast[worst]) worst = tid;
    if (x + CW > W - CW * 2 - 8) continue;
    sg.drawImage(cell(idle, E.VIEWS.iso, hexOf(f)).c, x, y); label(tid + ' ' + contrast[tid] + '%', x, y + CH + 12, contrast[tid] < 50 ? '#ff8a7a' : '#9d93b8', 10);
    x += CW + 6;
  }
  if (worst) sg.drawImage(cell(idle, E.VIEWS.iso, hexOf(floors[worst])).c, W - CW * 2 - 4, y, CW * 2, CH * 2);
  // 5. motion: every state from idle and back, joints in the world frame every step
  // the bones that must keep their length: the body's own list (rig.bones, pairs of joint names) or, for a Humanoid, its
  // limbs (a custom body without a list has none measured: its knee to foot may not be a bone at all)
  const HUMAN = [['hipL', 'kneeL'], ['kneeL', 'footL'], ['hipR', 'kneeR'], ['kneeR', 'footR'], ['shL', 'elbowL'], ['elbowL', 'handL'], ['shR', 'elbowR'], ['elbowR', 'handR']];
  const bonesOf = rig => rig.bones || (rig instanceof E.Humanoid ? HUMAN : []);
  const lints = [], len = {}; let topSpeed = 0, topAt = '';
  for (const [name, st, hold] of CHAR_STATES) {
    const rig = make(), size = (rig.o && rig.o.size) || 1, seq = [[{}, .3], [st, hold], [{}, .5]], pops = {}, steps = {}; let prev = null, slide = 0;
    for (const [s0, secs] of seq) for (let i = 0; i < Math.round(secs * 60); i++) {
      rig.update(DT, Object.assign({ facing: .6 }, base, s0));
      const J = rig.J, P = {};
      for (const k in J) if (k !== 'bladeDir' && J[k]) P[k] = rig._w(J[k]);   // relative to the body: moving the whole body is not a pop
      if (prev) for (const k in P) if (prev[k]) {
        const d = Math.hypot(P[k][0] - prev[k][0], P[k][1] - prev[k][1], P[k][2] - prev[k][2]) / size;
        if (d > topSpeed) { topSpeed = d; topAt = name + ' (' + k + ')'; }
        (steps[k] || (steps[k] = [])).push(d);
        if (s0 === st && name === 'idle' && /^foot/.test(k)) slide += Math.hypot(P[k][0] - prev[k][0], P[k][1] - prev[k][1]);
      }
      for (const k in P) if (rig.z + P[k][2] < -1.5 * size) lints.push(name + ': ' + k + ' goes under the floor (z ' + (rig.z + P[k][2]).toFixed(1) + ')');
      for (const [a, b] of bonesOf(rig)) if (J[a] && J[b]) { const l = Math.hypot(J[a][0] - J[b][0], J[a][1] - J[b][1], J[a][2] - J[b][2]); const r = len[a + '-' + b] || (len[a + '-' + b] = { min: l, max: l, at: name }); if (l < r.min) r.min = l; if (l > r.max) { r.max = l; r.at = name; } }
      prev = P;
    }
    if (slide > 2 * size) lints.push('idle: its feet slide ' + slide.toFixed(1) + ' units while it stands still');
    // a pop is a spike: a joint that jumps in one step while it hardly moved the step before and the step after (a fast,
    // steady sweep of a long blade is motion, not a pop)
    for (const k in steps) { const d = steps[k]; for (let i = 1; i < d.length - 1; i++) if (d[i] > 9 && d[i] > 2.5 * Math.max(d[i - 1], d[i + 1], .5)) pops[k] = Math.max(pops[k] || 0, d[i]); }
    const pk = Object.keys(pops); if (pk.length) lints.push(name + ': ' + pk.join(', ') + ' jump' + (pk.length === 1 ? 's' : '') + ' up to ' + Math.max(...Object.values(pops)).toFixed(1) + ' units in one step (a pop: ease into the pose)');
  }
  for (const [k, r] of Object.entries(len)) if (r.max > r.min * 1.12) lints.push('the ' + k + ' bone stretches from ' + r.min.toFixed(1) + ' to ' + r.max.toFixed(1) + ' (' + r.at + ')');
  const views = Object.values(pixels); if (Math.min(...views) < Math.max(...views) * .5) lints.push('it nearly vanishes in one view: ' + Object.entries(pixels).map(([v, n]) => v + ' ' + n).join(', ') + ' pixels');
  if (palette < 6) lints.push('only ' + palette + ' colors: shade it with E.tones (3-5 tones a material)');
  for (const [tid, p] of Object.entries(contrast)) if (p < 50) lints.push('on the ' + tid + ' floor only ' + p + '% of it stands out');
  return { png: S.toDataURL('image/png'), w: W, h: H, cell: [CW, CH], pixels, sizes, palette, contrast, topSpeed: +topSpeed.toFixed(2), topAt, bones: Object.keys(len).length, lints: [...new Set(lints)].slice(0, 30), version: E.versionLabel() };
}, [id, scale]);
await browser.close();
if (res.error) { console.error('character sheet: ' + res.error); process.exit(1); }
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(res.png.split(',')[1], 'base64'));
const { png, ...nums } = res; writeFileSync(out.replace(/\.png$/, '') + '.json', JSON.stringify(Object.assign({ character: id, errors }, nums), null, 2));
const c = Object.entries(res.contrast).sort((a, b) => a[1] - b[1]);
console.log(`character sheet: ${id} (${res.version}) -> ${out} (${res.w}x${res.h})`);
console.log('  size at game scale (idle): ' + Object.entries(res.sizes).map(([v, s]) => v + ' ' + s).join(', '));
console.log('  palette: ' + res.palette + ' colors (idle, iso)');
console.log('  stands out from the floor: ' + c.map(([t, p]) => t + ' ' + p + '%').join(', '));
console.log('  motion: fastest joint ' + res.topSpeed + ' units a step (' + res.topAt + '); ' + (res.bones ? res.bones + ' bones measured' : 'no bones declared to measure (rig.bones)'));
console.log(res.lints.length ? '  look at:\n    ' + res.lints.join('\n    ') : '  nothing to look at: no pops, no sliding, nothing under the floor, limbs keep their length');
if (errors.length) console.log('  page errors: ' + errors.join('; '));
