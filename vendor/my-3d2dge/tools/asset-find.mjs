// Searches the asset store for what a game needs: the core library (E.SHAPES, E.MATERIALS) and every set's entries
// (src/assets/sets/*.js), by their ids, tags and descriptions (the catalogs, src/assets/catalogs/*.json, describe what each
// looks like). Prints the best matches, most words matched first: the id to draw, what it is, its tokens and its set.
// Usage: node tools/asset-find.mjs "tavern table" [--kind shape|material|sprite] [--top 20] [--set kenney-furniture]
//        node tools/asset-find.mjs --show kenney-furniture:table      (prints the entry itself, to copy)
// A game's own cut set (tools/asset-set.mjs: tavern, emberdeep, platformer) copies the store's entries and has no catalog:
// it is searched only when --set names it, so a search lists each entry once, where it came from.
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, engine, readSet, readCatalog, catalogFile, js, tok } from './asset-lib.mjs';

const args = process.argv.slice(2), opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const query = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
if (!query && !opt('show')) { console.error('Usage: node tools/asset-find.mjs "words" [--kind shape|material|sprite] [--top 20] [--set name] | --show set:id'); process.exit(2); }
const E = engine(), rows = [], dir = join(root, 'src/assets/sets');
// the core library: bare ids
for (const [id, e] of Object.entries(E.SHAPES)) rows.push({ kind: 'shape', id, set: 'core', about: e.about || '', tags: e.tags || '', entry: e });
for (const [id, e] of Object.entries(E.MATERIALS)) rows.push({ kind: 'material', id, set: 'core', about: typeof e === 'string' ? e : [e.color, e.pattern].filter(Boolean).join(' '), tags: '', entry: e });
// the sets: ids qualified by the set's name; a catalog's description and tags, where it has one, over the entry's own
for (const f of existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.js')).sort() : []) {
  const S = readSet(join(dir, f)), cat = readCatalog(S.set);
  if (!existsSync(catalogFile(S.set)) && opt('set') !== S.set && !(opt('show') || '').startsWith(S.set + ':')) continue;   // (a cut set)
  for (const kind of ['shapes', 'materials', 'sprites']) for (const [id, e] of Object.entries(S[kind] || {})) {
    const c = Array.isArray(cat[id]) ? cat[id] : [];
    rows.push({ kind: kind.slice(0, -1), id: S.set + ':' + id, set: S.set, file: 'src/assets/sets/' + f, about: c[1] || e.about || (typeof e === 'string' ? e : ''), tags: c[0] || e.tags || '', entry: e });
  }
}
if (opt('show')) {
  const r = rows.find(r => r.id === opt('show'));
  if (!r) { console.error('no entry ' + opt('show') + ' (ids are set:id, or a core id alone)'); process.exit(1); }
  console.log(`// ${r.id} (${r.set === 'core' ? 'the core library, engine/my-3d2dge.js' : r.file}), ${tok(js(r.entry))} tokens\n${r.id.split(':').pop()}: ${js(r.entry)}`);
  process.exit(0);
}
const words = query.toLowerCase().split(/\s+/).filter(Boolean), kind = opt('kind'), set = opt('set');
const hits = rows.filter(r => (!kind || r.kind === kind) && (!set || r.set === set)).map(r => {
  const hay = (r.id + ' ' + r.tags + ' ' + r.about).toLowerCase().replace(/[-_:]/g, ' '), n = words.filter(w => hay.includes(w)).length;
  return Object.assign(r, { n, exact: words.filter(w => new RegExp('\\b' + w.replace(/[^a-z0-9]/g, '') + '\\b').test(hay)).length });
}).filter(r => r.n).sort((a, b) => b.n - a.n || b.exact - a.exact || (a.set === 'core' ? -1 : 0) - (b.set === 'core' ? -1 : 0) || a.id.localeCompare(b.id));
const top = +(opt('top') || 20);
for (const r of hits.slice(0, top)) console.log(`${r.id.padEnd(34)} ${r.kind.padEnd(8)} ${String(tok(js(r.entry))).padStart(4)} tok  ${r.about}${r.tags ? '  [' + r.tags + ']' : ''}`);
console.log(hits.length ? `${Math.min(top, hits.length)} of ${hits.length} matches; --show <id> prints an entry to copy` : 'no match for "' + query + '"');
