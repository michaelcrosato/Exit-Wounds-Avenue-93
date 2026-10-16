// Asset sheet: draws a shape the way a game will (the full engine, headless) and says what reads badly, so a model that
// wrote an object can look at it before using it (docs/ASSETS.md, "Make one").
//   node tools/asset-sheet.mjs barrel                     a core shape
//   node tools/asset-sheet.mjs mine.js#stool              a file that sets E.SHAPES.stool, or a store set
//                                                         ((window.ASSETS = window.ASSETS || {}).MINE = {...}, then 'stool'
//                                                         finds MINE:stool)
//   node tools/asset-sheet.mjs mine.js                    every shape the file adds
//   [--out check-output/asset-sheet] [--zoom 3] [--json]  (--json prints the numbers and lints as JSON)
//   node tools/asset-sheet.mjs src/assets/sets/kenney-furniture.js --grid
//                                                         contact sheets of a whole set, 30 to a page, for curating it:
//                                                         each entry in the isometric and three-quarter views (a sprite
//                                                         as it is), with its id, parts and fit; and a page of the
//                                                         set's materials, each with the entries that use it
// Each sheet (a PNG per shape): every view (isometric, three-quarter, top-down as games draw it, brawler, side) and three
// more facings, beside the hero, on a light and a dark floor, the contact shadow under it. The lints:
//   small from above   under 30 pixels seen from the top-down view
//   a part not seen    a part with no pixel in the isometric or the three-quarter view (under a pixel, or hidden)
//   few tones          fewer than 4 colors in the isometric view (a flat-looking object)
//   low contrast       its mean lightness within 12% of a floor's
//   tokens             the entry as written, in cl100k tokens (exact)
// Exit code 1 on an engine warning or a page error (an unknown material, a broken part).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineFile } from './asset-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const target = args.find((a, i) => !a.startsWith('--') && !(i && args[i - 1].startsWith('--') && !['--json'].includes(args[i - 1])));
if (!target) { console.error('Usage: node tools/asset-sheet.mjs <id | file.js[#id]> [--out dir] [--zoom 3] [--json]'); process.exit(2); }
const out = resolve(opt('out', join(root, 'check-output/asset-sheet'))), zoom = +opt('zoom', 3), json = args.includes('--json');
const [file, want] = target.includes('.js') ? target.split('#') : [null, target];
if (file && !existsSync(file)) { console.error('no such file: ' + file); process.exit(2); }
const src = file ? readFileSync(file, 'utf8') : null;
let tok = s => Math.ceil(s.length / 3.2); try { const { encode } = await import('gpt-tokenizer/encoding/cl100k_base'); tok = s => encode(s).length; } catch (e) { /* estimated */ }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage(), problems = [];
page.on('pageerror', e => problems.push(String(e))); page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && !/willReadFrequently/.test(m.text())) problems.push(m.text()); });   // (not Chromium's readback hint)
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({ content: readFileSync(engineFile, 'utf8') });   // (the repository's engine, or the handoff package's)
const before = await page.evaluate(() => Object.keys(My3D2dge.SHAPES));
if (src) await page.addScriptTag({ content: src });
// the shapes to draw: the file's sets (registered), the shapes it added to E.SHAPES, or the core id asked for
const ids = await page.evaluate(([before, want, own]) => {
  const E = My3D2dge, added = [];
  for (const set of Object.values(window.ASSETS || {})) added.push(...E.addAssets(set).shapes);
  for (const k of Object.keys(E.SHAPES)) if (!before.includes(k) && !added.includes(k)) added.push(k);
  if (!want) return added;
  const mine = added.filter(k => k === want || k.endsWith(':' + want));   // (file.js#id: the file's own entry before the core's)
  const hit = (own ? [...mine, want] : [want, ...mine]).find(k => E.SHAPES[k]);
  return hit ? [hit] : [];
}, [before, want, !!file]);
if (!ids.length && !args.includes('--grid')) { console.error((want ? 'no shape "' + want + '"' : 'no shapes') + (file ? ' in ' + file : ' in the core library')); await browser.close(); process.exit(1); }

mkdirSync(out, { recursive: true });
// --grid: contact sheets of every shape and sprite the file adds, 30 to a page
if (args.includes('--grid')) {
  const sprites = await page.evaluate(() => Object.values(window.ASSETS || {}).flatMap(S => Object.keys(S.sprites || {}).map(k => S.set + ':' + k)));
  // a set of materials only (ambientCG): each drawn on a box and a slab of floor
  const matIds = await page.evaluate(() => Object.values(window.ASSETS || {}).filter(S => !Object.keys(S.shapes || {}).length && !Object.keys(S.sprites || {}).length).flatMap(S => Object.keys(S.materials || {}).map(k => S.set + ':' + k)));
  const all = ids.concat(want ? [] : sprites).concat(want ? [] : matIds), name = basename(file || 'core', '.js'), PER = 30;
  for (let p0 = 0; p0 < all.length; p0 += PER) {
    const png = await page.evaluate(([list, srcText]) => {
      const E = My3D2dge, sets = Object.values(window.ASSETS || {}), entry = id => { const [sn, k] = id.split(':'); const S = sets.find(x => x.set === sn); return S ? (S.shapes || {})[k] || (S.sprites || {})[k] : E.SHAPES[id]; };
      const CW = 300, CH = 168, COLS = 5, cv = document.createElement('canvas'); cv.width = CW * COLS; cv.height = CH * Math.ceil(list.length / COLS) + 4;
      const g = cv.getContext('2d'); g.fillStyle = '#2a2632'; g.fillRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false;
      // (the sets' sprites, drawn once: E.addAssets returns them; a copy under another name, as the shapes are registered)
      const sprites = window.__gridSprites || (window.__gridSprites = {}); if (!window.__gridDone) { window.__gridDone = true; for (const S of sets) if (Object.keys(S.sprites || {}).length) Object.assign(sprites, E.addAssets({ set: S.set + '~g', materials: S.materials, sprites: S.sprites }).sprites); }
      list.forEach((id, i) => {
        const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH, e = entry(id) || {};
        g.fillStyle = i % 2 ? '#5b5548' : '#625c4e'; g.fillRect(x + 2, y + 2, CW - 4, CH - 4);
        const draw = (sp, cx, cy, maxW, maxH) => { if (!sp) return; const k = Math.max(1, Math.min(4, Math.floor(Math.min(maxW / sp.w, maxH / sp.h)))); g.drawImage(sp.cv, Math.round(cx - sp.w * k / 2), Math.round(cy - sp.h * k / 2), sp.w * k, sp.h * k); };
        const mat = !e.rows && !e.parts && E.MATERIALS[id];
        if (mat) { draw(E.shapeSprite({ mats: { m: id }, parts: [['box', 'm', [0, 0, 0], [14, 14, 12]]] }, { view: 'iso' }), x + CW * .27, y + 72, CW * .5, 120); draw(E.shapeSprite({ mats: { m: id }, parts: [['box', 'm', [0, 0, 0], [40, 40, 1]]] }, { view: 'threequarter' }), x + CW * .73, y + 72, CW * .5, 120); }
        else if (e.rows) { const k = id.replace(':', '~g:'); const sp = sprites[k]; if (sp) { const c = sp.cv || sp.canvas || sp; const w = c.width, h = c.height, z = Math.max(1, Math.floor(Math.min(130 / w, 120 / h))); g.drawImage(c, x + CW / 2 - w * z / 2, y + 12 + 60 - h * z / 2, w * z, h * z); } }
        else { draw(E.shapeSprite(id, { view: 'iso' }), x + CW * .27, y + 72, CW * .5, 120); draw(E.shapeSprite(id, { view: 'threequarter' }), x + CW * .75, y + 72, CW * .45, 120); }
        g.fillStyle = '#f4ead2'; g.font = '13px monospace'; g.fillText(id.split(':').pop().slice(0, 34), x + 8, y + CH - 24);
        g.fillStyle = '#c8bca0'; g.font = '11px monospace'; const f = e.fit; g.fillText((f && f.iou !== undefined ? 'IoU ' + f.iou + ' (worst ' + f.worst + ')  ' : '') + (e.parts ? e.parts.length + ' parts' : e.rows ? e.rows[0].length + 'x' + e.rows.length : ''), x + 8, y + CH - 9);
      });
      return cv.toDataURL('image/png');
    }, [all.slice(p0, p0 + PER), null]);
    const f = join(out, name + '-grid-' + (p0 / PER + 1) + '.png'); writeFileSync(f, Buffer.from(png.split(',')[1], 'base64')); console.log(f);
  }
  // the legend: each of the set's materials, its swatch drawn on a box, its pattern and the entries that use it
  const legend = await page.evaluate(() => {
    const E = My3D2dge, rows = [];
    for (const S of Object.values(window.ASSETS || {})) for (const [id, m] of Object.entries(S.materials || {})) {
      const users = Object.entries(S.shapes || {}).filter(([, e]) => Object.values(e.mats || {}).includes(id)).map(([k]) => k);
      rows.push({ set: S.set, id, m: typeof m === 'string' ? m : [m.color, m.pattern].join(' '), users });
    }
    if (!rows.length) return null;
    const W = 1500, RH = 54, cv = document.createElement('canvas'); cv.width = W; cv.height = rows.length * RH + 10; const g = cv.getContext('2d'); g.fillStyle = '#2a2632'; g.fillRect(0, 0, W, cv.height); g.imageSmoothingEnabled = false;
    rows.forEach((r, i) => {
      const y = i * RH + 5, sp = E.shapeSprite({ mats: { m: r.set + ':' + r.id }, parts: [['box', 'm', [0, 0, 0], [12, 12, 8]]] }, { view: 'iso' });
      if (sp) g.drawImage(sp.cv, 10, y + 2, sp.w * 2, sp.h * 2);
      g.fillStyle = '#f4ead2'; g.font = '14px monospace'; g.fillText(r.id.padEnd(14) + '  ' + r.m, 80, y + 20);
      g.fillStyle = '#c8bca0'; g.font = '12px monospace'; g.fillText((r.users.length + ' entries: ' + r.users.slice(0, 12).join(', ')).slice(0, 190), 80, y + 40);
    });
    return cv.toDataURL('image/png');
  });
  if (legend) { const f = join(out, name + '-materials.png'); writeFileSync(f, Buffer.from(legend.split(',')[1], 'base64')); console.log(f); }
  if (problems.length) console.log('engine warnings and page errors:\n  ' + [...new Set(problems)].join('\n  '));
  await browser.close(); process.exit(problems.length ? 1 : 0);
}
const report = [];
for (const id of ids) {
  const res = await page.evaluate(([id, zoom]) => {
    const E = My3D2dge, S = E.SHAPES[id], FACE = Math.PI / 2 + .45;
    const VIEWS = [['Isometric', E.VIEWS.iso, FACE], ['3/4 view', E.VIEWS.threequarter, FACE], ['Top-down', E.charView(E.VIEWS.topdown), FACE], ['Brawler', E.VIEWS.brawler, FACE], ['Side', E.VIEWS.side, FACE],
      ['Iso +90', E.VIEWS.iso, FACE + Math.PI / 2], ['Iso +180', E.VIEWS.iso, FACE + Math.PI], ['Iso +270', E.VIEWS.iso, FACE + Math.PI * 1.5]];
    const info = VIEWS.map(([, v, f]) => E.shapeInfo(id, { view: v, facing: f }));
    const FLOORS = { light: ['#8c8472', '#958b76', '#3e3a32'], dark: ['#3a3234', '#433a3b', '#1a1416'] };
    const hero = new E.Humanoid({ cape: { len: 6, width: 5, seg: 2.5 }, colors: { cloth: '#2f8f86', cape: '#c8452f' } }); for (let i = 0; i < 30; i++) hero.update(1 / 60, { x: 0, y: 0, z: 0, vx: 0, vy: 0, facing: .6 });
    // one cell size for the whole sheet: everything drawn must fit
    let up = 44, down = 8, half = 16; for (const r of info) { up = Math.max(up, r.oy + 4); down = Math.max(down, r.h - r.oy + 4); half = Math.max(half, r.ox + 4, r.w - r.ox + 4); }
    const CW = Math.ceil(half * 2), CH = up + down, cols = VIEWS.length + 1, head = 18, W = cols * (CW + 4) + 4, H = head + 2 * (CH + 14) + 4;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#1c1826'; g.fillRect(0, 0, W, H);
    E.font.text(g, id + (S.about ? ': ' + S.about : ''), 4, 4, '#f1e4c8', { outline: false });
    const lum = c => .2126 * c[0] + .7152 * c[1] + .0722 * c[2], floorLum = {};
    ['light', 'dark'].forEach((fl, row) => {
      const P = FLOORS[fl], y0 = head + row * (CH + 14);
      floorLum[fl] = lum(E.hex(P[0]));
      for (let c = 0; c < cols; c++) {
        const x0 = 4 + c * (CW + 4), cell = document.createElement('canvas'); cell.width = CW; cell.height = CH; const cg = cell.getContext('2d');
        const img = cg.createImageData(CW, CH);
        for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const k = (y * CW + x) * 4, sx = x, sy = y * 1.25, stone = (Math.floor(sy / 16) & 1 ? 8 : 0), edge = (sx + stone) % 16 < 1 || sy % 16 < 1; const col = E.hex(edge ? P[2] : E.hash2(Math.floor((sx + stone) / 16), Math.floor(sy / 16)) > .5 ? P[0] : P[1]); img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255; }
        cg.putImageData(img, 0, 0);
        const fx = Math.round(CW / 2), fy = up, layer = document.createElement('canvas'); layer.width = CW; layer.height = CH; const lg = layer.getContext('2d');
        if (!c) hero.draw(lg, fx, fy, E.charView(E.VIEWS.iso));
        else { const [, v, f] = VIEWS[c - 1], spr = E.shapeSprite(id, { view: v, facing: f, outline: false }); if (spr) lg.drawImage(spr.cv, fx - spr.ox, fy - spr.oy); }
        // the actors' outline round the layer, then the layer over the floor
        const d = lg.getImageData(0, 0, CW, CH), a = d.data, sol = a.map((v, i) => i % 4 === 3 && v ? 1 : 0);
        for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const i = y * CW + x; if (sol[i * 4 + 3]) continue; if ((x && sol[(i - 1) * 4 + 3]) || (x < CW - 1 && sol[(i + 1) * 4 + 3]) || (y && sol[(i - CW) * 4 + 3]) || (y < CH - 1 && sol[(i + CW) * 4 + 3])) { a[i * 4] = 20; a[i * 4 + 1] = 12; a[i * 4 + 2] = 28; a[i * 4 + 3] = 255; } }
        lg.putImageData(d, 0, 0); cg.drawImage(layer, 0, 0);
        g.drawImage(cell, x0, y0);
        E.font.text(g, c ? VIEWS[c - 1][0] : 'Hero', x0, y0 + CH + 3, '#ab9dc0', { outline: false });
      }
    });
    // the lints
    const lints = [], iso = info[0], q3 = info[1], top = info[2];
    if (top.pixels < 30) lints.push('small from above: ' + top.pixels + ' pixels in the top-down view');
    const unseen = iso.parts.map((n, i) => n || q3.parts[i] ? -1 : i).filter(i => i >= 0);
    if (unseen.length) lints.push('a part not seen in the isometric or three-quarter view (under a pixel, or hidden): primitive ' + unseen.join(', '));
    if (iso.colors < 4) lints.push('few tones: ' + iso.colors + ' colors in the isometric view');
    let L = 0, n = 0; for (let j = 0; j < iso.rgba.length; j += 4) if (iso.rgba[j + 3]) { L += lum([iso.rgba[j], iso.rgba[j + 1], iso.rgba[j + 2]]); n++; } L /= n || 1;
    for (const [fl, fL] of Object.entries(floorLum)) if (Math.abs(L - fL) < 255 * .12) lints.push('low contrast with the ' + fl + ' floor: its mean lightness ' + Math.round(L) + ', the floor\'s ' + Math.round(fL));
    // the big picture, whole pixels
    const big = document.createElement('canvas'); big.width = W * zoom; big.height = H * zoom; const bg = big.getContext('2d'); bg.imageSmoothingEnabled = false; bg.drawImage(cv, 0, 0, W * zoom, H * zoom);
    const entry = JSON.stringify(Object.fromEntries(Object.entries(S).filter(([k]) => !k.startsWith('_'))), (k, v) => typeof v === 'function' ? v.toString() : v);
    return { url: big.toDataURL(), lints, entry, numbers: { prims: iso.prims, tris: iso.tris, isoPixels: iso.pixels, topPixels: top.pixels, colors: iso.colors, bounds: iso.bounds.map(v => Math.round(v * 10) / 10) } };
  }, [id, zoom]);
  // tokens: the entry as the file writes it (its own text, from `id: {` to the next entry), else as data
  const local = id.includes(':') ? id.split(':').pop() : id, m = src && new RegExp('(?:^|[\\s{,])[\'"]?' + local.replace(/[-]/g, '\\-') + '[\'"]?\\s*:\\s*\\{').exec(src);
  let text = res.entry;
  if (m) { let depth = 0, k = src.indexOf('{', m.index); const s0 = m.index; for (; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}' && --depth === 0) break; } text = src.slice(s0, k + 1).trim(); }
  res.numbers.tokens = tok(text);
  const png = join(out, local.replace(/[^\w-]/g, '_') + '.png');
  writeFileSync(png, Buffer.from(res.url.split(',')[1], 'base64'));
  report.push({ id, png, lints: res.lints, numbers: res.numbers });
}
await browser.close();
if (json) console.log(JSON.stringify({ shapes: report, problems }, null, 1));
else for (const r of report) {
  console.log(`${r.id}: ${r.numbers.tokens} tokens, ${r.numbers.prims} primitives, ${r.numbers.tris} triangles; ${r.numbers.isoPixels} pixels in iso, ${r.numbers.topPixels} from above, ${r.numbers.colors} colors -> ${r.png}`);
  for (const l of r.lints) console.log('  lint: ' + l);
}
if (problems.length) { console.log('engine warnings and page errors:\n  ' + [...new Set(problems)].join('\n  ')); process.exitCode = 1; }
