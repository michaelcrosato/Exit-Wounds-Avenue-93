// A smaller asset set from bigger ones: the entries a game adopts, with the whole chain of shapes they place (['use', id])
// and every material those use, and the records of the downloads they came from, so the cut set draws on its own. It reads
// and writes set files only (src/assets/sets/*.js); no source files are needed.
// Usage: node tools/asset-set.mjs src/assets/sets/kenney-furniture.js [more sets ...] --ids table,chair,kenney-survival:barrel
//          --name tavern --out src/assets/sets/tavern.js [--credit "..."]
// An id found in more than one set is picked as set:id. A core id (E.SHAPES, E.MATERIALS) needs no copy and stays as it is.
import { resolve } from 'node:path';
import { engine, readSet, writeSet, tok, js } from './asset-lib.mjs';

const args = process.argv.slice(2), opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const files = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
if (!files.length || !opt('ids') || !opt('name') || !opt('out')) { console.error('Usage: node tools/asset-set.mjs a.js [b.js ...] --ids a,set:b --name name --out out.js [--credit "..."]'); process.exit(2); }
const E = engine(), sets = files.map(f => readSet(resolve(f))), out = { set: opt('name'), credit: '', sources: {}, materials: {}, shapes: {}, sprites: {} }, from = new Map();
const fail = m => { console.error(m); process.exit(1); };
/** the set an id is in: set:id, or the one set that has it */
const find = (want, kind) => {
  const [sn, id] = want.includes(':') ? want.split(':') : [null, want], hits = sets.filter(S => (!sn || S.set === sn) && S[kind] && S[kind][id]);
  if (hits.length > 1) fail(id + ' is in ' + hits.map(S => S.set).join(' and ') + ': pick one as set:' + id);
  return hits[0] ? [hits[0], id] : [null, id];
};
const take = (S, kind, id) => {
  const k = kind + ':' + id; if (from.has(k)) { if (from.get(k) !== S.set) fail('a ' + kind.slice(0, -1) + ' ' + id + ' comes from both ' + from.get(k) + ' and ' + S.set + ': cut one of them'); return false; }
  const e = S[kind][id]; from.set(k, S.set); out[kind][id] = e;
  if (e && e.src) { if (!S.sources[e.src]) fail(S.set + ' ' + id + ': its download ' + e.src + ' is not on record'); out.sources[e.src] = S.sources[e.src]; }
  return true;
};
/** a material a set entry names: the set's own (copied, with what it names), else the core's (left as it is). Two sets'
 *  kit colors often share a name (oak): the second, if it differs, is renamed (oak-2) -> the name it has in the cut set */
const renamed = new Map();
const material = (S, m) => {
  if (typeof m !== 'string' || m[0] === '#') return m;
  if (S.materials && S.materials[m] !== undefined) {
    const key = S.set + '|' + m; if (renamed.has(key)) return renamed.get(key);
    let name = m, n = 1; while (out.materials[name] !== undefined && JSON.stringify(out.materials[name]) !== JSON.stringify(S.materials[m])) name = m + '-' + ++n;
    renamed.set(key, name); out.materials[name] = S.materials[m]; from.set('materials:' + name, S.set);
    const src = S.materials[m] && S.materials[m].src; if (src) { if (!S.sources[src]) fail(S.set + ' ' + m + ': its download ' + src + ' is not on record'); out.sources[src] = S.sources[src]; }
    if (typeof S.materials[m] === 'string' && S.materials[m][0] !== '#') material(S, S.materials[m]);
    return name;
  }
  if (!E.MATERIALS[m]) fail(S.set + ': the material ' + m + ' is in neither the set nor the core library');
  return m;
};
/** a shape and everything it places: ['use', id, at, { mats }] anywhere in its parts (mirror, ring, row and group too) */
const shape = (S, id) => {
  if (!S.shapes || !S.shapes[id]) { if (E.SHAPES[id]) return; fail(S.set + ': no shape ' + id + ' (nor in the core library)'); }
  if (!take(S, 'shapes', id)) return;
  const e = out.shapes[id] = JSON.parse(JSON.stringify(S.shapes[id]));   // (a copy: its slots may name renamed materials)
  for (const [k, m] of Object.entries(e.mats || {})) e.mats[k] = material(S, m);
  const walk = p => { if (!Array.isArray(p)) return; if (p[0] === 'use') { shape(S, p[1]); const o = p[3] && p[3].mats; if (o) for (const k of Object.keys(o)) o[k] = material(S, o[k]); return; } if (typeof p[0] === 'string' && !['mirror', 'ring', 'row', 'group'].includes(p[0])) { if (typeof p[1] === 'string' && !(e.mats || {})[p[1]]) p[1] = material(S, p[1]); return; } for (const q of p) walk(q); };
  (e.parts || []).forEach(walk);
};
for (const want of opt('ids').split(',').filter(Boolean)) {
  let [S, id] = find(want, 'shapes');
  if (S) { shape(S, id); continue; }
  [S, id] = find(want, 'sprites'); if (S) { if (take(S, 'sprites', id)) { const e = out.sprites[id] = JSON.parse(JSON.stringify(S.sprites[id])); for (const [k, c] of Object.entries(e.colors || {})) { const [m, t] = String(c).split(':'); e.colors[k] = material(S, m) + (t ? ':' + t : ''); } } continue; }
  [S, id] = find(want, 'materials'); if (S) { material(S, id); continue; }
  fail('no entry ' + want + ' in ' + sets.map(S => S.set).join(', '));
}
const used = [...new Set([...from.values()])];
out.credit = opt('credit') || 'Cut from ' + used.join(', ') + ': ' + used.map(n => sets.find(S => S.set === n).credit).join('; ');
const text = writeSet(out, resolve(opt('out')));
console.log(`wrote ${opt('out')}: ${Object.keys(out.shapes).length} shapes, ${Object.keys(out.materials).length} materials, ${Object.keys(out.sprites).length} sprites from ${used.join(', ')}; ${tok(text)} tokens`);
