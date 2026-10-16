// Fetches a CC0 library into .cache/assets/<lib>/ (never committed: binaries stay out of the repository, principle 4),
// checks its license, and writes the record of each download and the ledger of every file in it, per set (a Kenney kit or
// a KayKit pack is a set of its own, kenney-furniture; ambientCG's materials are one set, ambientcg):
//   src/assets/catalogs/<set>.json   "$sources": { key: { label, origin, license, url, fetched, sha256, licenseHash, ... } }
//   src/assets/catalogs/<set>.tsv    one row per file: size, triangles and materials (or pixels), then fit, used and
//                                    flags (asset-import fills them) and a note a person writes, kept on re-surveys
// Libraries (docs/ASSET-IMPORT.md lists them, with their licenses as checked):
//   kenney     Kenney's 3D kits and 2D packs: names from their pages (kenney.nl/assets/<name>): furniture-kit tiny-dungeon
//   kaykit     KayKit packs that are git repositories (github.com/KayKit-Game-Assets/<repo>): KayKit-Dungeon-Remastered-1.0
//   ambientcg  ambientCG materials by id (Bricks105), or --top N [--category Bricks,Planks]: the 1K JPG maps
// A license that is not CC0 1.0 (or the public-domain mark) stops the fetch: the store takes nothing else (section 5.3 of the
// plan; the assets suite holds every record to the same allowlist).
// Usage: node tools/asset-fetch.mjs <lib> <name> [<name> ...] [--top N] [--category A,B] [--force]
//        node tools/asset-fetch.mjs <lib> --survey      (rewrites the ledger from what is in .cache, keeping the notes)
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, lstatSync } from 'node:fs';
import { join, dirname, relative, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { root, LICENSES, readCatalog, writeCatalog, readLedger, writeLedger, surveyFile, cacheDir } from './asset-lib.mjs';

const args = process.argv.slice(2), opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const [lib, ...rest] = args.filter((a, i) => !a.startsWith('--') && !['--top', '--category'].includes(args[i - 1]));
if (!lib || !['kenney', 'kaykit', 'ambientcg'].includes(lib)) { console.error('Usage: node tools/asset-fetch.mjs kenney|kaykit|ambientcg <name> ... [--top N --category A,B] [--force] [--survey]'); process.exit(2); }
const force = args.includes('--force'), today = new Date().toISOString().slice(0, 10), dir = cacheDir(lib);
mkdirSync(dir, { recursive: true });
const sha = b => createHash('sha256').update(b).digest('hex');
const get = (url, out) => { execFileSync('curl', ['-sSfL', '--retry', '5', '--retry-delay', '3', '--retry-all-errors', '-m', '600', '-A', 'my-3d2dge-asset-fetch (github.com/michaelcrosato/my-3d2dge)', '-o', out, url], { stdio: ['ignore', 'ignore', 'inherit'] }); return readFileSync(out); };
const text = url => execFileSync('curl', ['-sSfL', '--retry', '5', '--retry-delay', '3', '--retry-all-errors', '-m', '60', '-A', 'my-3d2dge-asset-fetch', url], { encoding: 'utf8', maxBuffer: 64 << 20 });
const unzip = (zip, to) => { mkdirSync(to, { recursive: true }); execFileSync('unzip', ['-oq', zip, '-d', to]); };
/** the license a text states, as one of LICENSES' labels, or null: its words (a page's, without its scripts, styles and
 *  tags) name CC0 or the public-domain mark as a word, and no other license anywhere (another Creative Commons one, MIT,
 *  GPL, Apache, royalty-free, proprietary, all rights reserved) nor "not CC0" */
const licenseOf = raw => {
  const t = String(raw).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  if (/\bCC[- ]?BY\b|\bAttribution\b|NonCommercial|NoDerivatives|ShareAlike|\bCC[- ]?(NC|ND|SA)\b/i.test(t)) return null;
  if (/all rights reserved|royalty[- ]free|proprietary|\bMIT\b|\bL?GPL|\bApache\b|\bnot\s+(?:licensed\s+(?:under\s+)?)?(?:the\s+)?CC0/i.test(t)) return null;
  return /\bCC0\b|Creative Commons Zero|creativecommons\.org\/publicdomain\/zero\b/i.test(t) ? 'CC0 1.0' : /\bpublic domain mark\b|creativecommons\.org\/publicdomain\/mark\b/i.test(t) ? 'Public Domain Mark 1.0' : null;
};
/** an id from a library's API, safe as a file name, and a download from that library's own host */
const safeId = id => { if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('not an id: ' + JSON.stringify(id)); return id; };
const fromHost = (url, host) => { const u = new URL(url); if (u.protocol !== 'https:' || (u.hostname !== host && !u.hostname.endsWith('.' + host))) throw new Error('not a download from ' + host + ': ' + url); return url; };
const setOf = key => lib === 'ambientcg' ? 'ambientcg' : key, cats = {}, catOf = set => cats[set] || (cats[set] = readCatalog(set));
const known = key => (catOf(setOf(key)).$sources || {})[key];
const record = (key, rec) => {
  if (!LICENSES.includes(rec.license)) { console.error(key + ': the license reads "' + rec.license + '", not ' + LICENSES.join(' or ') + ': not fetched'); process.exit(1); }
  const c = catOf(setOf(key)), S = c.$sources = c.$sources || {};
  S[key] = Object.assign({}, S[key], rec); console.log(`  ${key}: ${rec.license}, ${rec.fetched}${rec.sha256 ? ', sha256 ' + rec.sha256.slice(0, 12) : ''}`);
  writeCatalog(setOf(key), c);   // (at once: a fetch cut short keeps what it got)
};
/** runs one download; a failure is reported and the rest go on */
const failed = [], each = (name, f) => { try { f(); } catch (e) { failed.push(name); console.error('  ' + name + ': ' + String(e.message || e).split('\n')[0]); } };

if (lib === 'kenney') for (const name of rest) each(name, () => {
  const key = 'kenney-' + name.replace(/-kit$/, ''), to = join(dir, name), zip = join(dir, name + '.zip');
  if (existsSync(to) && known(key) && !force) { console.log('  ' + key + ': already fetched (--force fetches it again)'); return; }
  const page = text('https://kenney.nl/assets/' + name), url = (page.match(/https:\/\/kenney\.nl\/media\/pages\/assets\/[^"' ]+\.zip/) || [])[0];
  if (!url) throw new Error('no download on kenney.nl/assets/' + name);
  const label = (page.match(/<title>([^<]+)<\/title>/) || [, name])[1].replace(/\s*(·|&middot;|\|).*$/, '').trim(), buf = get(url, zip);
  if (known(key) && known(key).sha256 && known(key).sha256 !== sha(buf)) console.warn('  ' + key + ': the archive changed since ' + known(key).fetched + ' (a new version at the same page)');
  unzip(zip, to);
  const lic = ['License.txt', 'license.txt', 'LICENSE.txt'].map(f => join(to, f)).find(existsSync), lt = lic ? readFileSync(lic) : Buffer.from('');
  record(key, { label: 'Kenney ' + label.replace(/^Kenney\s*[-·:]?\s*/i, ''), origin: 'Kenney (kenney.nl), ' + name, license: licenseOf(lt.toString()) || 'unknown: no License.txt', url, page: 'https://kenney.nl/assets/' + name, fetched: today, sha256: sha(buf), licenseHash: sha(lt).slice(0, 16), dir: relative(dir, to), factors: 'srgb' });   // (Kenney writes its flat colors as sRGB: checked against the kit's own renders)
});

if (lib === 'kaykit') for (const repo of rest) each(repo, () => {
  const key = 'kaykit-' + repo.replace(/^KayKit-/, '').replace(/-\d+\.\d+$/, '').toLowerCase(), to = join(dir, repo);
  if (existsSync(to) && known(key) && !force) { console.log('  ' + key + ': already fetched'); return; }
  const url = 'https://github.com/KayKit-Game-Assets/' + repo;
  // only the glTF binaries, the palette texture and the license: a pack also carries FBX, OBJ and engine add-ons
  if (!existsSync(to)) { execFileSync('git', ['clone', '-q', '--depth', '1', '--filter=blob:none', '--sparse', url, to], { stdio: 'inherit' }); execFileSync('git', ['-C', to, 'sparse-checkout', 'set', '--no-cone', '/LICENSE*', '/README*', '*.glb', '*.gltf', '*.bin', '**/texture*/**', '**/Textures/**'], { stdio: 'inherit' }); execFileSync('git', ['-C', to, 'sparse-checkout', 'reapply'], { stdio: 'inherit' }); }
  else execFileSync('git', ['-C', to, 'pull', '-q', '--depth', '1'], { stdio: 'inherit' });
  const commit = execFileSync('git', ['-C', to, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const lic = readdirSync(to).find(f => /^licen[sc]e/i.test(f)), lt = lic ? readFileSync(join(to, lic)) : Buffer.from('');
  record(key, { label: 'KayKit ' + repo.replace(/^KayKit-/, '').replace(/-\d+\.\d+$/, '').replace(/-/g, ' '), origin: 'Kay Lousberg (kaylousberg.com), ' + repo, license: licenseOf(lt.toString()) || 'unknown: no LICENSE', url, commit, fetched: today, licenseHash: sha(lt).slice(0, 16), dir: repo });
});

if (lib === 'ambientcg') {
  const lp = join(dir, 'license.html'), lt = get('https://ambientcg.com/license', lp), license = licenseOf(lt.toString()) || 'unknown';
  let ids = rest;
  if (opt('top')) {   // the most popular materials of the categories asked for (the API's own order)
    const cats = (opt('category') || '').split(',').filter(Boolean), out = [];
    for (const c of cats.length ? cats : ['']) {
      const q = 'https://ambientcg.com/api/v3/assets?type=material&sort=popular&limit=' + opt('top') + (c ? '&q=' + encodeURIComponent(c) : '');
      for (const a of JSON.parse(text(q)).assets) if (/^[A-Za-z0-9_-]+$/.test(a.id) && (!c || a.id.startsWith(c))) out.push(a.id);
    }
    ids = [...new Set(out.concat(ids))];
  }
  for (const id of ids) each(id, () => {
    const key = 'ambientcg-' + safeId(id), to = join(dir, id), zip = join(dir, id + '.zip');
    if (existsSync(to) && known(key) && !force) return;
    const info = JSON.parse(text('https://ambientcg.com/api/v3/assets?id=' + id + '&include=downloads,tags,dimensions')).assets[0];
    if (!info) throw new Error('not on ambientCG');
    const dl = info.downloads.find(d => d.attributes === '1K-JPG') || info.downloads.find(d => /1K/.test(d.attributes));
    const buf = get(fromHost(dl.url, 'ambientcg.com'), zip); unzip(zip, to);
    record(key, { label: 'ambientCG ' + id, origin: 'ambientCG (ambientcg.com), ' + (info.displayName || id), license, url: dl.url, page: 'https://ambientcg.com/view?id=' + id, fetched: today, sha256: sha(buf), licenseHash: sha(lt).slice(0, 16), dir: id,
      tags: (info.tags || []).join(' '), dims: info.dimensions && info.dimensions.width ? [info.dimensions.width, info.dimensions.height] : undefined });
  });
}
if (failed.length) console.error(failed.length + ' failed (run the same command again: what is fetched is kept): ' + failed.join(' '));
// each set's catalog, and its ledger: one row per file of every download on record; the importer's columns and the notes
// are kept (--survey rewrites the ledgers of every set this library has in src/assets/catalogs/)
if (args.includes('--survey')) for (const f of readdirSync(join(root, 'src/assets/catalogs')).filter(f => f.endsWith('.json'))) { const set = f.slice(0, -5); if (set === lib || set.startsWith(lib + '-') || (lib === 'kenney' && set.startsWith('kenney-'))) catOf(set); }
for (const [set, cat] of Object.entries(cats)) {
  writeCatalog(set, cat);
  const keep = new Map(readLedger(set).map(r => [r.file, r])), out = [];
  for (const [key, rec] of Object.entries(cat.$sources || {})) {
    // a download not in .cache (a fresh clone) keeps its rows as they are
    const base = join(dir, rec.dir || ''); if (!existsSync(base)) { out.push(...[...keep.values()].filter(r => r.src === key)); continue; }
    const walk = d => { for (const f of readdirSync(d).sort()) { const p = join(d, f), st = lstatSync(p); if (f.startsWith('.') || st.isSymbolicLink()) continue; if (st.isDirectory()) walk(p); else {   // (links skipped: nothing read outside the download)
      const s = surveyFile(p); if (!s) continue;
      const file = relative(dir, p), old = keep.get(file) || {};
      out.push(Object.assign({ src: key, file, bytes: statSync(p).size }, s, { fit: old.fit || '', used: old.used || '', flags: old.flags || s.flags || '', note: old.note || '' }));
    } } };
    walk(base);
  }
  writeLedger(set, out);
  console.log(`${set}: ${Object.keys(cat.$sources || {}).length} downloads on record, ${out.length} files in its ledger (src/assets/catalogs/${set}.tsv)`);
}
