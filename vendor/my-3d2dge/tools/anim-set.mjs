// A smaller animation set from bigger ones: the clips a game adopts (for example a hero's), with the records of the
// libraries they came from (their proportions and origins) and the mannequin's look. No source files needed: it reads
// and writes readable set files. The first set's first library gives the proportions every clip is rebuilt on.
// Usage: node tools/anim-set.mjs src/mocap/sets/quaternius.js [src/mocap/sets/mesh2motion.js ...] --clips Death01,Land_Three_Point,...
//          --name HERO --out src/mocap/sets/hero.js [--credit "..."] [--title Hero]
// A clip name found in more than one of the sets is picked as SET:Clip (QUATERNIUS:Interact).
import { resolve } from 'node:path';
import { readSet, writeSet } from './mocap-lib.mjs';

const args = process.argv.slice(2), opt = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const files = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
if (!files.length || !opt('clips') || !opt('name') || !opt('out')) { console.error('Usage: node tools/anim-set.mjs a.js [b.js ...] --clips A,SET:B --name NAME --out out.js [--credit "..."] [--title Title]'); process.exit(2); }
const srcs = files.map(f => readSet(resolve(f))), clips = {}, fit = {}, used = new Set(), from = [];
for (const want of opt('clips').split(',')) {
  const [setName, clipName] = want.includes(':') ? want.split(':') : [null, want];
  const hits = srcs.filter(S => (!setName || S.set === setName) && S.clips[clipName]);
  if (!hits.length) { console.error('no clip ' + want + ' in ' + srcs.map(S => S.set).join(', ')); process.exit(1); }
  if (hits.length > 1) { console.error(clipName + ' is in ' + hits.map(S => S.set).join(' and ') + ': pick one as SET:' + clipName); process.exit(1); }
  const S = hits[0], c = S.clips[clipName];
  if (clips[clipName]) { console.error(clipName + ' is picked twice'); process.exit(1); }
  if (!S.sources[c.src]) { console.error(S.set + ' ' + clipName + ': its library ' + c.src + ' is not on record'); process.exit(1); }
  clips[clipName] = c; fit[clipName] = S.fit[clipName]; used.add(S.set + '/' + c.src); if (!from.includes(S.set)) from.push(S.set);
}
// the libraries the picked clips came from, with their records; the first set's first library leads (its proportions)
const sources = {}, first = srcs[0], lead = Object.keys(first.sources)[0];
sources[lead] = first.sources[lead];
for (const S of srcs) for (const [id, rec] of Object.entries(S.sources)) if (used.has(S.set + '/' + id)) {
  if (sources[id] && sources[id] !== rec) { console.error('two sets name a library ' + id + ': rename one'); process.exit(1); }
  sources[id] = rec;
}
const out = Object.assign({ set: opt('name') }, opt('title') ? { title: opt('title') } : {}, { format: first.format, credit: opt('credit') || first.credit,
  from: from.length === 1 ? from[0] : from, fps: first.fps, sources, body: first.body, fit, clips });
const w = writeSet(out, resolve(opt('out')));
console.log(`wrote ${opt('out')}: ${w.clips} clips from ${from.join(' and ')}, ${w.keys} key poses, ${w.kb.toFixed(0)} KB`);
