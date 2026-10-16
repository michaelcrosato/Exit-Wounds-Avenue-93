// The CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu): about 2,500 captured takes by 100+ people, from
// walks and runs to dances, sports, martial arts, acrobatics and everyday actions. "This dataset of motions is free for
// all uses" and it "may be copied, modified, or redistributed without permission" (the site's home page and FAQ).
// Each subject has a skeleton (NN.asf); each take is a motion (NN_MM.amc) at 120 frames a second (a few at 60).
//
// This tool finds takes, downloads them (a few, or all of them), and keeps the ledger of every take:
// src/mocap/catalogs/cmu-takes.tsv, one line a take with its category, length, how well it converts, the stretch where
// it moves, and its status (which clips of the CMU set use it, or a note: picked, skipped and why). tools/anim-import.mjs
// turns picked moments into an animation set (see "$pick" in src/mocap/catalogs/cmu.json, and docs/MOCAP.md, "CMU").
// Usage:  node tools/cmu.mjs find kick [cartwheel ...]   takes whose description has every word (index downloaded once)
//         node tools/cmu.mjs subject 13                    a subject's takes
//         node tools/cmu.mjs get 02_01 13_29 [...]         download the takes and their subjects' skeletons
//         node tools/cmu.mjs all                           download every take (the site's 1 GB archive, plus the
//                                                          subject added after it): about 3.3 GB unpacked
//         node tools/cmu.mjs survey [--subjects 5,13]      convert every downloaded take and write the ledger (keeps its
//                                                          notes)
//         node tools/cmu.mjs library [--tol 50]            every take for the mocap lab's CMU library: one set file a
//                                                          subject and an index, in examples/cmu-lib (about 65 MB)
//         node tools/cmu.mjs ledger [combat] [--status none] [--top 20]   query the ledger by category, word or status
//         --dir .cache/cmu                                 where takes go (the default; not committed)
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, openSync, readSync, closeSync, unlinkSync, createWriteStream } from 'node:fs';
import { resolve, join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const SITE = 'http://mocap.cs.cmu.edu';   // the site serves plain http
const ROOT = new URL('..', import.meta.url).pathname;
const LEDGER = join(ROOT, 'src/mocap/catalogs/cmu-takes.tsv'), CATALOG = join(ROOT, 'src/mocap/catalogs/cmu.json');
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const DIR = resolve(opt('dir', '.cache/cmu')), words = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const cmd = words.shift();

async function fetchText(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ': HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()).toString('latin1'); }

/** every take: { id: '02_01', subject: 2, about: the subject's line, desc, fps }, from the site's full motion list */
export async function cmuIndex(dir = DIR) {
  const file = join(dir, 'index.tsv');
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    const html = await fetchText(SITE + '/search.php?subjectnumber=%25&motion=%25'), rows = [], clean = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    let about = '';
    for (const tr of html.split(/<TR/i)) {
      const subj = /Subject #(\d+)\s*\(([^)]*)\)/i.exec(tr); if (subj) { about = clean(subj[2]); continue; }
      const amc = /\/subjects\/(\d+)\/(\d+_\d+)\.amc/i.exec(tr); if (!amc) continue;
      const cells = [...tr.matchAll(/<TD[^>]*>(.*?)<\/TD>/gis)].map(m => clean(m[1])), fps = cells.filter(c => /^\d+$/.test(c)).pop();   // the frame rate is the last number in the row (the trial's number comes first)
      rows.push([amc[2], +amc[1], about, cells[2] || '', fps || '120'].join('\t'));
    }
    writeFileSync(file, 'id\tsubject\tabout\tdesc\tfps\n' + rows.join('\n') + '\n');
    console.log('indexed ' + rows.length + ' takes into ' + file);
  }
  return readFileSync(file, 'utf8').trim().split('\n').slice(1).map(l => { const [id, subject, about, desc, fps] = l.split('\t'); return { id, subject: +subject, about, desc, fps: +fps }; });
}

/** download takes (and each subject's skeleton) into dir; returns their paths */
export async function cmuGet(ids, dir = DIR) {
  mkdirSync(dir, { recursive: true });
  const out = [];
  for (const id of ids) {
    if (!/^\d+_\d+$/.test(id)) throw new Error('a take is SUBJECT_TRIAL, like 02_01: ' + id);
    const s = id.split('_')[0], asf = join(dir, s + '.asf'), amc = join(dir, id + '.amc');
    if (!existsSync(asf)) writeFileSync(asf, await fetchText(`${SITE}/subjects/${s}/${s}.asf`));
    if (!existsSync(amc)) writeFileSync(amc, await fetchText(`${SITE}/subjects/${s}/${id}.amc`));
    out.push({ id, asf, amc });
  }
  return out;
}

/**
 * every take: the site's archive (allasfamc.zip, 1.08 GB: 2,514 takes, some the search page does not list) unpacked
 * flat into dir, then whatever the index lists that the archive lacks (subject 144, added later) one by one. It skips
 * what is already there, so it resumes. Node has no unzip: the archive is read entry by entry (stored or deflated).
 */
export async function cmuAll(dir = DIR, keepZip = false) {
  mkdirSync(dir, { recursive: true });
  const zip = join(dir, 'allasfamc.zip');
  if (!existsSync(zip)) {
    console.log('downloading ' + SITE + '/allasfamc.zip (1.08 GB)...');
    const r = await fetch(SITE + '/allasfamc.zip'); if (!r.ok) throw new Error('allasfamc.zip: HTTP ' + r.status);
    await pipeline(Readable.fromWeb(r.body), createWriteStream(zip + '.part'));
    (await import('node:fs')).renameSync(zip + '.part', zip);
  }
  const fd = openSync(zip, 'r'), size = (await import('node:fs')).fstatSync(fd).size, read = (pos, n) => { const b = Buffer.alloc(n); readSync(fd, b, 0, n, pos); return b; };
  const tail = read(Math.max(0, size - 65557), Math.min(size, 65557)), eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error(zip + ' is not a zip archive');
  let p = tail.readUInt32LE(eocd + 16); const n = tail.readUInt16LE(eocd + 10); let got = 0;
  for (let i = 0; i < n; i++) {
    const h = read(p, 46), method = h.readUInt16LE(10), csize = h.readUInt32LE(20), nl = h.readUInt16LE(28), xl = h.readUInt16LE(30), cl = h.readUInt16LE(32), local = h.readUInt32LE(42);
    const name = read(p + 46, nl).toString('latin1'); p += 46 + nl + xl + cl;
    const base = name.split('/').pop(); if (!/^\d+(_\d+)?\.(asf|amc)$/.test(base) || existsSync(join(dir, base))) continue;
    const lh = read(local, 30), data = read(local + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28), csize);
    writeFileSync(join(dir, base), method === 8 ? inflateRawSync(data) : data); got++;
  }
  closeSync(fd);
  console.log('unpacked ' + got + ' files from the archive');
  const have = new Set(readdirSync(dir)), missing = (await cmuIndex(dir)).filter(t => !have.has(t.id + '.amc')).map(t => t.id);
  if (missing.length) { console.log('fetching ' + missing.length + ' takes the archive lacks...'); await cmuGet(missing, dir); }
  if (!keepZip) unlinkSync(zip);
  return readdirSync(dir).filter(f => f.endsWith('.amc')).length;
}

/* ---- the ledger: every take, what it is, how it converts, and what we did with it ---- */
// categories, first match wins (the words of the take's description, then its subject's): what a game would use it for
const CATEGORIES = [
  ['calibration', /motorcycle|range of motion|t-pose|tpose|calibration|lost marker/],
  ['acrobatics', /cartwheel|flip|handspring|somersault|breakdanc|acrobat|gymnast|handstand|tumbl|backbend|\broll/],
  ['combat', /punch|kick|box(ing|er)|fight|martial|karate|sword|stab|\bjab|uppercut|strike|slash|attack|block|dodge|duck\b|ducking|wrestl|swat/],
  ['reaction', /\bfall|stumbl|\btrip|injur|wound|limp|hurt|\bdie\b|dead|collaps|faint|get(ting)? up|stand up from|getup/],
  ['climb', /climb|ladder|ledge|\bscal|hang|monkey ?bar|swing on|swings? /],
  ['jump', /jump|\bhop|leap|hopscotch|vault/],
  ['sit and lie', /\bsit|stool|chair|\blie\b|laying|lying|sleep|kneel|crouch|squat|bench/],
  ['dance', /danc|salsa|charleston|ballet|arabesque|waltz|tango|michael jackson|pirouette|twist\b|moonwalk|lambada/],
  ['sports', /basketball|soccer|football|golf|tennis|baseball|swim|skate|bowl|volleyball|frisbee|throw|catch|dribbl|shoot|\bball|sport|bicycle|row(ing)?\b/],
  ['animal and character', /chicken|monkey|\bdog|\bcat\b|bear|elephant|animal|\bduck|frog|snake|horse|bird|dinosaur|robot|zombie|mickey|mime|pantomime|penguin|crab|kangaroo|gorilla|ape\b|t-rex|teapot|alien|monster|old man|drunk|baby|tiger|panther|lion|ghost|dragon|devil|genie|superhero/],
  ['gesture and talk', /wave|waving|clap|point|cheer|salute|\bbow\b|bowing|shrug|signal|\btalk|laugh|\bcry|yawn|nod|beckon|story|rhyme|express|emotion|greet|shak(e|ing) hands|hand ?shake|celebrat|conversation|argue|gestur|happy|\bsad\b|upset|scared|angry|freez|shiver|teach|curtsey|high five|peek/],
  ['everyday', /pick|carry|lift|push|pull|open|close|reach|wash|sweep|drink|\beat|mug|coffee|window|\bbox|suitcase|\bplace|put|grab|wipe|mop|construction|hammer|saw|shovel|drag|\bload|stack|lean|bend|cook|clean|phone|read|writ|door|table|step ?stool|stepstool|bucket|broom|fish|sew|plant|rak(e|ing)|paint|pay|buy|vacuum|typ(e|ing)|laptop|palm pilot|movie|shav|slic|chop|dig|dough|batter|mix|search|pok(e|ing)|violin|piano|drum|guitar|sipping|martini|smok|setting|dial/],
  ['exercise', /stretch|exercise|jacks|squats|yoga|tai ?chi|push ?up|sit ?up|lunge|range of motion|warm|balanc|toe touch/],
  ['locomotion', /walk|\brun|jog|sprint|march|sneak|stride|\bstep|turn|veer|sidestep|stairs|navigate|backward|strafe|skip|stroll|shuffle|creep|crawl|wander|pace|obstacle|avoid|start|stop|\b(90|180|360)\b/],
  ['idle', /idle|standing|wait|stand\b|shift/],
];
/** a take's category: its description's words first, then its subject's ("calibration": a capture's set-up poses, not motion) */
const categoryOf = t => { const a = (t.desc || '').toLowerCase(), b = (t.about || '').toLowerCase(); if (!a) return 'undescribed'; for (const s of [a, b]) for (const [c, re] of CATEGORIES) if (re.test(s)) return c; return 'other'; };
const COLS = ['id', 'subject', 'fps', 'sec', 'category', 'active', 'fit', 'travel', 'hips', 'flags', 'used', 'note', 'desc', 'about'];
/** the ledger's rows by id ({} when there is none yet) */
export function readLedger(file = LEDGER) {
  if (!existsSync(file)) return {};
  const [head, ...lines] = readFileSync(file, 'utf8').split('\n').filter(l => l && !l.startsWith('#')), cols = head.split('\t'), out = {};
  for (const l of lines) { const v = l.split('\t'), r = {}; cols.forEach((c, i) => r[c] = v[i] ?? ''); out[r.id] = r; }
  return out;
}
const LEDGER_HEAD = `# Every take of the CMU motion capture database (mocap.cs.cmu.edu; free for all uses), one a line. Written by
# node tools/cmu.mjs survey, which converts each take into the readable format and measures it; edit only "note".
# sec: length in seconds. category: what a game would use it for (from the words of its description). active: the
# seconds where it moves (still stretches at either end left out). fit: the readable format's average and worst
# body-point error against the capture (mm). travel: metres the hips cover. hips: lowest and highest hip height, in
# percent of standing (under 60: crouching or lying; over 115: in the air or up on something). flags: inverted (upside
# down at some point), floats (feet off the floor most of the time: stairs, a ladder, a bench), loose (fit over 30 mm),
# short (under a second), fps? (not on the site's list: 120 assumed), error. used: the CMU set's clips cut from it
# (src/mocap/catalogs/cmu.json). note: yours, kept when the survey runs again: "pick" (next to import), "skip: why".`;
function writeLedger(rows, file = LEDGER) {
  const list = Object.values(rows).sort((a, b) => a.subject - b.subject || a.id.localeCompare(b.id, 'en', { numeric: true }));
  writeFileSync(file, LEDGER_HEAD + '\n' + COLS.join('\t') + '\n' + list.map(r => COLS.map(c => String(r[c] ?? '').replace(/[\t\n]/g, ' ')).join('\t')).join('\n') + '\n');
}
/** which clips of the CMU set each take feeds: { '13_17': ['Boxing_Guard_Loop', 'Boxing_Jab'] } */
function usedBy() { const out = {}; if (!existsSync(CATALOG)) return out; for (const [clip, p] of Object.entries(JSON.parse(readFileSync(CATALOG, 'utf8')).$pick || {})) (out[p[0]] = out[p[0]] || []).push(clip); return out; }

/**
 * Convert every downloaded take, a subject at a time, the way the importer would (whole takes, 30 frames a second),
 * and measure each: its fit, where it moves, how far it travels, how high and low the hips go, whether it turns upside
 * down, whether the feet keep to the floor. Writes the ledger (ledger: false skips it); with lib, every take as an
 * animation set file a subject, fitted within libTol, and an index: the mocap lab's CMU library (examples/cmu-lib).
 */
export async function cmuSurvey(dir = DIR, { subjects = null, lib = false, ledger = true, tol = 30, libTol = 50, libOut = join(ROOT, 'examples/cmu-lib') } = {}) {
  const { readCmu } = await import('./asf-amc.mjs'), { MR, writeSet } = await import('./mocap-lib.mjs');
  const index = await cmuIndex(dir), byId = new Map(index.map(t => [t.id, t])), old = readLedger(), used = usedBy(), rows = { ...old };
  const subjFps = {}; for (const t of index) (subjFps[t.subject] = subjFps[t.subject] || new Set()).add(t.fps);
  const about = {}; for (const t of index) about[t.subject] = t.about;
  const files = readdirSync(dir), amcs = files.filter(f => /^\d+_\d+\.amc$/.test(f)).map(f => f.slice(0, -4));
  const bySubject = {}; for (const id of amcs) (bySubject[+id.split('_')[0]] = bySubject[+id.split('_')[0]] || []).push(id);
  for (const t of index) if (!bySubject[t.subject]?.includes(t.id) && !rows[t.id]) rows[t.id] = { id: t.id, subject: t.subject, fps: t.fps, desc: t.desc, about: t.about, flags: 'not downloaded' };
  const P = MR.POINTS, ix = n => P.indexOf(n), PEL = ix('pelvis'), TOP = ix('headTop'), FEET = ['toeL', 'toeR', 'ballL', 'ballR', 'ankleL', 'ankleR'].map(ix);
  const libDir = libOut; if (lib) mkdirSync(libDir, { recursive: true });
  const libIndex = { subjects: {}, takes: [] };   // the library's list for the lab: every take, its subject file and parts
  let done = 0, secs = 0, bytes = 0;
  for (const s of Object.keys(bySubject).map(Number).sort((a, b) => a - b)) {
    if (subjects && !subjects.includes(s)) continue;
    const ids = bySubject[s].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), asf = join(dir, String(s).padStart(2, '0') + '.asf');
    const fpsOf = id => byId.get(id)?.fps || (subjFps[s] && subjFps[s].size === 1 ? [...subjFps[s]][0] : 120);
    const picks = ids.map(id => ({ name: id, take: id, fps: fpsOf(id) }));
    let L = null, failed = {};
    try { L = readCmu(asf, picks); }
    catch (e) {   // one bad take: read the subject's takes one at a time to find it
      L = { clips: {} };
      for (const pk of picks) try { Object.assign(L.clips, readCmu(asf, [pk]).clips); } catch (e2) { failed[pk.take] = e2.message; }
    }
    const restClip = L.clips._rest ? '_rest' : null, rest = restClip ? MR.measure(L.clips, restClip) : null;
    const floor = L.clips._rest ? Math.min(...FEET.slice(0, 4).map(i => L.clips._rest.data[i * 3 + 2])) : 0, standing = rest ? rest.H0 : 1;
    const set = lib ? { set: 'CMU_' + String(s).padStart(2, '0'), title: 'CMU subject ' + s, format: 1, credit: 'CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), free for all uses; created with funding from NSF EIA-0196217.', fps: 30, sources: {}, body: null, fit: {}, clips: {} } : null;
    if (set && rest) set.sources['CMU_' + String(s).padStart(2, '0')] = { file: String(s).padStart(2, '0') + '.asf', rig: 'cmu', label: 'CMU motion capture, subject ' + s + (about[s] ? ' (' + about[s] + ')' : ''), origin: 'CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu)', license: 'free for all uses (may be copied, modified, or redistributed without permission)', url: SITE + '/search.php?subjectnumber=' + s, rest };
    for (const id of ids) {
      const t = byId.get(id) || { id, subject: s, about: about[s] || '', desc: '', fps: fpsOf(id) }, r = { id, subject: s, fps: t.fps, desc: t.desc, about: t.about || about[s] || '', note: old[id]?.note || '' }, flags = [];
      if (!byId.has(id)) flags.push('fps?');
      const cap = L.clips[id];
      if (!cap || !rest) { r.flags = ['error: ' + (failed[id] || 'not read')].concat(flags).join(' '); rows[id] = r; continue; }
      const n = cap.n, F = P.length * 3, d = cap.data;
      r.sec = cap.dur.toFixed(1); r.category = categoryOf(r);
      // where it moves: each frame's change (every point, plus the root's travel); the still ends are trimmed
      const e = new Float32Array(n);
      for (let f = 1; f < n; f++) { let a = 0; for (let k = 0; k < F; k++) { const v = d[f * F + k] - d[(f - 1) * F + k]; a += v * v; } if (cap.move) a += P.length * ((cap.move[f * 2] - cap.move[f * 2 - 2]) ** 2 + (cap.move[f * 2 + 1] - cap.move[f * 2 - 1]) ** 2); e[f] = Math.sqrt(a / P.length); }
      const sorted = Array.from(e).sort((a, b) => a - b), cut = Math.max(2, sorted[Math.floor(n * .9)] * .2);
      let a0 = 1; while (a0 < n - 1 && e[a0] < cut) a0++; let a1 = n - 1; while (a1 > a0 && e[a1] < cut) a1--;
      r.active = Math.max(0, (a0 - 6) / 30).toFixed(1) + '-' + Math.min(cap.dur, (a1 + 6) / 30).toFixed(1);
      let travel = 0; if (cap.move) for (let f = 1; f < n; f++) travel += Math.hypot(cap.move[f * 2] - cap.move[f * 2 - 2], cap.move[f * 2 + 1] - cap.move[f * 2 - 1]);
      r.travel = (travel / 1000).toFixed(1);
      let lo = Infinity, hi = -Infinity, inverted = 0, off = 0;
      for (let f = 0; f < n; f++) {
        const hz = d[f * F + PEL * 3 + 2]; lo = Math.min(lo, hz); hi = Math.max(hi, hz);
        if (d[f * F + TOP * 3 + 2] < hz - 50) inverted++;
        if (Math.min(...FEET.map(i => d[f * F + i * 3 + 2])) > floor + 150) off++;
      }
      r.hips = Math.round(lo / standing * 100) + '-' + Math.round(hi / standing * 100);
      if (inverted > 2) flags.push('inverted'); if (off > n * .6) flags.push('floats'); if (cap.dur < 1) flags.push('short');
      // fitted in pieces of at most 10 s (fitting costs the square of a clip's length; a long take is a series of moments
      // anyway): the ledger's fit is over all of them; the converted library keeps a long take as its numbered parts
      // the library is fitted looser (libTol: for browsing; a clip picked for a set is cut again at the set's tolerance)
      const W = n > 600 ? 300 : n - 1; let sum = 0, worst = 0, part = 0;
      for (let a = 0; a < n - 1 || a === 0; a += W) {
        const b = Math.min(n - 1, a + W), piece = { name: id, n: b - a + 1, dur: (b - a) / 30, loop: false, fps: 30, data: d.subarray(a * F, (b + 1) * F), move: cap.move ? cap.move.subarray(a * 2, (b + 1) * 2) : null };
        const fitted = ledger ? MR.fit(rest, piece, tol, {}) : null; if (fitted) { sum += fitted.mean * piece.n; worst = Math.max(worst, fitted.max); }
        if (set) {
          const { clip, max, mean } = fitted && libTol === tol ? fitted : MR.fit(rest, piece, libTol, {}), name = W < n - 1 ? id + '_part' + (++part) : id;
          set.clips[name] = Object.assign({ clip: name, src: set.set, take: id + ' ' + (a / 30).toFixed(2) + '-' + (b / 30).toFixed(2), dur: clip.dur, loop: false, tags: [r.category] }, t.desc ? { desc: t.desc } : {}, { keys: clip.keys }); set.fit[name] = [Math.round(mean), Math.round(max)];
        }
        if (b >= n - 1) break;
      }
      if (set) libIndex.takes.push([id, s, r.category, +r.sec, t.desc || '', W < n - 1 ? part : 1]);
      const mean = sum / n; r.fit = ledger ? Math.round(mean) + '/' + Math.round(worst) : old[id]?.fit || ''; if (ledger && mean > 30) flags.push('loose');
      r.flags = flags.join(' '); r.used = (used[id] || []).join(' ');
      rows[id] = r; done++; secs += cap.dur;
    }
    if (set) { const f = join(libDir, set.set + '.js'); writeSet(set, f); bytes += readFileSync(f).length; libIndex.subjects[s] = about[s] || ''; }
    process.stdout.write(`\rsubject ${s}: ${ids.length} takes (${done} so far, ${(secs / 3600).toFixed(1)} h of motion)        `);
  }
  console.log('');
  for (const r of Object.values(rows)) { if (r.sec !== undefined && r.sec !== '') r.category = categoryOf(r); r.used = (used[r.id] || []).join(' '); }   // (these follow the words and the catalog, so every row is brought up to date)
  if (ledger) writeLedger(rows);
  if (lib && libIndex.takes.length) {   // the lab's list of the library (a subject's file loads when one of its takes is picked)
    const head = '/* The CMU library\'s index for the mocap lab (written by node tools/cmu.mjs library): every take as [id, subject,\n * category, seconds, description, parts]; a take of more than 20 s is in 10 s parts (ID_part1...). Each subject\'s takes\n * are in CMU_NN.js beside this file, in the readable format, fitted within ' + libTol + ' mm. */\n';
    writeFileSync(join(libDir, 'index.js'), head + 'window.CMU_LIB = ' + JSON.stringify({ tol: libTol, subjects: libIndex.subjects, takes: libIndex.takes }) + ';\n');
  }
  return { done, secs, bytes, rows: Object.keys(rows).length };
}

if (import.meta.url === 'file://' + resolve(process.argv[1])) {
  if (cmd === 'find' || cmd === 'subject') {
    const idx = await cmuIndex(), q = words.map(w => w.toLowerCase());
    const hits = cmd === 'subject' ? idx.filter(t => t.subject === +q[0]) : idx.filter(t => q.every(w => (t.desc + ' ' + t.about).toLowerCase().includes(w)));
    for (const t of hits) console.log(`${t.id}\t${t.fps} fps\t${t.desc}\t(${t.about})`);
    console.log(hits.length + ' take(s)');
  } else if (cmd === 'get') {
    for (const f of await cmuGet(words)) console.log(f.id + ': ' + f.amc);
  } else if (cmd === 'all') {
    console.log((await cmuAll(DIR, args.includes('--keep-zip'))) + ' takes in ' + DIR);
  } else if (cmd === 'survey') {
    const r = await cmuSurvey(DIR, { subjects: opt('subjects') ? opt('subjects').split(',').map(Number) : null, tol: +opt('tol', 30) });
    console.log(`converted ${r.done} takes (${(r.secs / 3600).toFixed(1)} hours of motion); the ledger has ${r.rows} takes: ${LEDGER}`);
  } else if (cmd === 'library') {
    const out = resolve(opt('out', 'examples/cmu-lib')), r = await cmuSurvey(DIR, { lib: true, ledger: false, libTol: +opt('tol', 50), libOut: out });
    console.log(`converted ${r.done} takes (${(r.secs / 3600).toFixed(1)} hours of motion) into ${(r.bytes / 1e6).toFixed(0)} MB of set files and an index in ${out}`);
  } else if (cmd === 'ledger') {
    const rows = Object.values(readLedger()), q = words.map(w => w.toLowerCase()), st = opt('status');
    const hits = rows.filter(r => q.every(w => r.category === w || (r.id + ' ' + r.desc + ' ' + r.about + ' ' + r.flags + ' ' + r.note + ' ' + r.used).toLowerCase().includes(w)))
      .filter(r => !st || (st === 'none' ? !r.used && !r.note : st === 'used' ? !!r.used : r.note.startsWith(st)));
    const cats = {}; for (const r of hits) cats[r.category || '-'] = (cats[r.category || '-'] || 0) + 1;
    for (const r of hits.slice(0, +opt('top', 1e9))) console.log([r.id, r.sec + ' s', r.category, 'active ' + r.active, 'fit ' + r.fit, r.flags, r.used ? 'USED: ' + r.used : '', r.note, r.desc].filter(Boolean).join('\t'));
    console.log(hits.length + ' take(s): ' + Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, k]) => c + ' ' + k).join(', '));
  } else { console.error('Usage: node tools/cmu.mjs find WORD [...] | subject N | get 02_01 [...] | all | survey [--subjects 5,13] | library [--tol 50] | ledger [CATEGORY|WORD ...] [--status none|used|pick|skip] [--top N]  [--dir .cache/cmu]'); process.exit(2); }
}
