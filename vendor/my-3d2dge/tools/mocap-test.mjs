// Mocap lab check: loads examples/mocap-lab.html in a headless browser and plays every clip of every animation set it
// carries (Quaternius, Hero, and any set added to src/mocap.template.html), at several moments, on both figures and in
// every view. It fails (exit code 1) on any page error
// or engine warning, a clip whose pose has a non-number in it, a retargeted hero joint that is not a number, a figure
// that draws nothing, or a mannequin whose feet end up under the floor. It also checks the readable format: each
// clip's text reads back the same and mirrors back to itself, a broken edit is rejected with a clear message, an edit
// applied in the panel plays and Reset restores the clip, the import kept every clip close to its capture, every clip
// says where it came from (its library's origin and license, and the clip it was made from), and a set picked from
// another (the hero's) is the same data as the clips it was picked from. And the hero: his sword never goes under the
// floor, he turns round with a spinning kick and turns upside down in a cartwheel, his face follows the clip's head,
// side view keeps a travelling clip's two figures apart, and the sword can be put away. The CMU library (?set=library)
// has every take of the ledger, each subject's file is there, and takes of several subjects load and play.
// Usage: node tools/mocap-test.mjs        (run node tools/build.mjs first; CHROMIUM_PATH picks a browser)
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const problems = [];
page.on('pageerror', e => problems.push('page error: ' + e));
page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().startsWith('my-3D2dge:'))) problems.push(m.type() + ': ' + m.text()); });
await page.goto(pathToFileURL(resolve('examples/mocap-lab.html')).href + '#Idle_Loop');
await page.waitForFunction(() => window.__mocap && __mocap.game.fps > 0, null, { timeout: 15000 });

const report = await page.evaluate(async () => {
  const M = __mocap, R = MocapReadable, out = { sets: {}, frames: 0, bad: [] }, wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const views = My3D2dge.VIEW_ORDER, X = new Float32Array(R.P * 3), Y = new Float32Array(R.P * 3);
  for (const id of Object.keys(M.SETS)) {   // every set the lab carries (each set file it inlines)
    M.setSet(id); const lib = M.lib, fit = Object.values(lib.set.fit);
    out.sets[id] = { clips: lib.names.length, keys: 0, fit: fit.reduce((t, f) => t + f[0], 0) / fit.length };
    for (const name of lib.names) {
      M.play(name, true);
      const c = M.S.clip, P = lib.P; out.sets[id].keys += c.keys.length;
      for (let i = 0; i < 4; i++) {
        M.setView(views[(out.frames + i) % views.length]);
        M.seek(c.dur * i / 3); await wait(); out.frames++;
        const pose = M.S.pose;
        for (let k = 0; k < P * 3; k++) if (!Number.isFinite(pose[k])) { out.bad.push(id + ' ' + name + ': pose value ' + k + ' is not a number'); break; }
        for (const [j, v] of Object.entries(M.hero.J)) if (!v.every(Number.isFinite)) { out.bad.push(id + ' ' + name + ': hero joint ' + j + ' is not a number'); break; }
        const lift = M.groundLift(pose);
        for (const s of ['L', 'R']) { const z = Math.min(lib.pt(pose, 'toe' + s)[2], lib.pt(pose, 'ankle' + s)[2]) + lift; if (z < -1) out.bad.push(id + ' ' + name + ': mannequin ' + s + ' foot is ' + Math.round(-z) + ' mm under the floor'); }
        for (const s of ['L', 'R']) if (M.hero.J['foot' + s][2] < -.01) out.bad.push(id + ' ' + name + ': hero ' + s + ' foot is under the floor');
        { const J = M.hero.J, tip = J.handR[2] + J.bladeDir[2] * M.hero.o.bladeLen; if (M.hero.o.weapon === 'sword' && tip < -.01) out.bad.push(id + ' ' + name + ': the hero\'s sword goes ' + (-tip).toFixed(1) + ' under the floor'); }
        if (!(M.game.stats.actors >= (M.S.cast === 'both' ? 2 : 1))) out.bad.push(id + ' ' + name + ': a figure was not drawn (actors: ' + M.game.stats.actors + ')');
      }
      // the text a model reads gives back the same motion, and mirroring twice is the original
      const back = R.parse(lib.text(c)), twice = R.mirror(R.mirror(c)), rest = lib.rest;
      for (let t = 0; t <= c.dur; t += 1 / 10) {
        const a = lib.sample(c, t, X).slice();
        const e1 = lib.error(a, lib.sample(Object.assign({}, c, back), t, Y)), e2 = lib.error(a, lib.sample(Object.assign({}, c, twice), t, Y));
        if (e1 > .5) { out.bad.push(id + ' ' + name + ': the clip text does not read back the same (' + e1.toFixed(1) + ' mm)'); break; }
        if (e2 > .5) { out.bad.push(id + ' ' + name + ': mirroring twice is not the original (' + e2.toFixed(1) + ' mm)'); break; }
      }
      // the import kept the key poses near the capture they were measured from (one pixel is ~24 mm at the default
      // zoom). The format's known limits (a hard-bent wrist, a curled spine) cost a few clips 30-40 mm on average
      const f = lib.set.fit[name];
      if (!f) out.bad.push(id + ' ' + name + ': no fit recorded at import');
      else if (f[0] > 40 || f[1] > 300) out.bad.push(id + ' ' + name + ': strays ' + f[0] + ' mm on average, ' + f[1] + ' at worst, from its capture');
      // every clip says where it came from: its library (src) with an origin and a license, and, for a copy or an edit
      // of another set's clip, that clip (orig: SET/clip), which must exist when the lab carries that set
      const o = lib.origin(c), src = lib.set.sources[c.src];
      if (!src) out.bad.push(id + ' ' + name + ': its src "' + c.src + '" is not one of the set\'s sources');
      else if (!o.origin || !o.license) out.bad.push(id + ' ' + name + ': its library ' + c.src + ' has no origin or license on record');
      if (c.orig) { const [os, oc] = c.orig.split('/'), S = M.SETS[(os || '').toLowerCase()];
        if (!oc) out.bad.push(id + ' ' + name + ': orig "' + c.orig + '" is not SET/clip');
        else if (S && !S.clip(oc)) out.bad.push(id + ' ' + name + ': orig ' + c.orig + ' is not a clip of ' + os); }
      // a clip cut from a capture database names the take and the seconds: '13_29 2.30-3.42'
      if (c.take !== undefined) { const m = /^(\d+_\d+) (\d+\.\d\d)-(\d+\.\d\d)$/.exec(c.take);
        if (!m || !(+m[3] > +m[2])) out.bad.push(id + ' ' + name + ': take "' + c.take + '" is not TAKE FROM-TO (seconds)'); }
      if (!rest) out.bad.push(id + ': no rest body');
    }
    if (out.sets[id].fit > 20) out.bad.push(id + ': clips stray ' + out.sets[id].fit.toFixed(1) + ' mm from their captures on average (more than 20)');
  }
  // a set picked from others (tools/anim-set.mjs: "from") has their clips, key for key
  for (const [id, L] of Object.entries(M.SETS)) {
    if (!L.set.from) continue;
    const names = [].concat(L.set.from), from = names.map(n => M.SETS[n.toLowerCase()]);
    if (from.some(f => !f)) { out.bad.push(id + ' is picked from ' + names.join(' and ') + ', which the lab does not all carry'); continue; }
    for (const name of L.names) {
      const h = L.clip(name), same = from.some(f => { const q = f.clip(name); return q && q.src === h.src && JSON.stringify(h.keys) === JSON.stringify(q.keys); });
      if (!same) out.bad.push(id + ' clip ' + name + ' is not, key for key, a clip of ' + names.join(' or '));
    }
  }
  // the hero turns with the clip and his face follows the clip's head: a spinning kick turns him all the way round,
  // and the angle between his face and the clip's stays the same through the clip (each library's rest sets it)
  if (M.SETS.cmu) {
    M.setSet('cmu'); M.setCast('hero');
    const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
    for (const name of ['Jump_Kick', 'Cartwheel']) {
      if (!M.lib.clip(name)) continue;
      M.play(name, true); const c = M.S.clip; let lo = 1e9, hi = -1e9, prev = null, turned = 0, upside = false;
      for (let i = 0; i <= 40; i++) {
        M.seek(c.dur * i / 40); await wait();
        const h = M.hero, T = h.mocapTilt, A = M.lib.pt(M.S.pose, 'head'), B = M.lib.pt(M.S.pose, 'faceF');
        if (!T) { out.bad.push('cmu ' + name + ': the hero has no body frame while the clip plays'); break; }
        const mw = rot([B[0] - A[0], B[1] - A[1], B[2] - A[2]], h.facing), hw = rot([T.head[0], T.head[3], T.head[6]], h.facing + h.spin);
        const ang = Math.acos(Math.max(-1, Math.min(1, (mw[0] * hw[0] + mw[1] * hw[1] + mw[2] * hw[2]) / Math.hypot(...mw) / Math.hypot(...hw)))) * 180 / Math.PI;
        lo = Math.min(lo, ang); hi = Math.max(hi, ang);
        if (prev !== null) turned += Math.abs(Math.atan2(Math.sin(h.spin - prev), Math.cos(h.spin - prev)));
        prev = h.spin; if (T.body[8] < -.5) upside = true;   // the body frame's up points down
      }
      if (hi - lo > 2) out.bad.push('cmu ' + name + ': the hero\'s face strays ' + (hi - lo).toFixed(1) + ' degrees from the clip\'s head');
      if (name === 'Jump_Kick' && turned < Math.PI * 1.5) out.bad.push('cmu Jump_Kick: the hero turned ' + Math.round(turned * 180 / Math.PI) + ' degrees, not round with the kick');
      if (name === 'Cartwheel' && !upside) out.bad.push('cmu Cartwheel: the hero\'s body frame never turned upside down');
    }
    // side view, a clip that travels: the figures stand one ahead of the other, not one behind the other
    if (M.lib.clip('Boxing_Jab')) {
      M.setCast('both'); M.setView('side'); M.play('Boxing_Jab', true); M.seek(.5); await wait();
      const v = M.game.view, q = M.pos;
      const dx = Math.abs((q.hero[0] - q.mannequin[0]) * v.ax + (q.hero[1] - q.mannequin[1]) * v.ay);
      if (dx < 20) out.bad.push('side view: the figures of a travelling clip are ' + dx.toFixed(0) + ' pixels apart across the screen');
    }
    // the sword can be put away
    M.S.sword = false; await wait(); if (M.hero.o.weapon !== null) out.bad.push('the hero still holds his sword with it put away');
    M.S.sword = true; await wait(); if (M.hero.o.weapon !== 'sword') out.bad.push('the hero did not take his sword back');
    M.setView('threequarter');
  }
  // the CMU library (?set=library, examples/cmu-lib): takes of different subjects load as they are picked and play on
  // both figures (a 60 fps subject, a long take's part, a take the site never described)
  {
    M.setCast('both'); await M.setLibrary('02_01');
    for (const name of ['02_01', '79_38', '15_05_part3', '121_01', '140_08']) {
      if (!M.LIBRARY.byName[name]) { out.bad.push('CMU library: no take ' + name); continue; }
      await M.playLib(name, true); M.seek(M.S.clip.dur * .6); await wait();
      if (M.S.clip.name !== name) { out.bad.push('CMU library: picking ' + name + ' played ' + M.S.clip.name); continue; }
      if (!Array.from(M.S.pose).every(Number.isFinite)) out.bad.push('CMU library ' + name + ': a pose value is not a number');
      for (const [j, v] of Object.entries(M.hero.J)) if (!v.every(Number.isFinite)) { out.bad.push('CMU library ' + name + ': hero joint ' + j + ' is not a number'); break; }
      if (M.game.stats.actors < 2) out.bad.push('CMU library ' + name + ': a figure was not drawn');
    }
    out.library = { takes: M.LIBRARY.index.takes.length, loaded: Object.keys(M.LIBRARY.subjects).length };
  }
  M.setSet(Object.keys(M.SETS)[0]);
  for (const [cast, n] of [['mannequin', 1], ['hero', 1], ['both', 2]]) { M.setCast(cast); await wait(); if (M.game.stats.actors !== n) out.bad.push('cast ' + cast + ' drew ' + M.game.stats.actors + ' figures, not ' + n); }
  M.setCast('both');
  // a broken edit is refused with a message that says where
  try { R.parse('{"keys":[{"t":0,"hips":[0,0,100]}]}'); out.bad.push('a key pose with missing fields was accepted'); } catch (e) { if (!/has no "body"/.test(e.message)) out.bad.push('unclear error for a broken edit: ' + e.message); }
  // an edit in the panel plays: raise the right arm straight up in every key pose; Reset brings the capture back
  M.play('Idle_Loop', true); const ed = R.parse(M.lib.text(M.S.clip)); ed.keys.forEach(k => { k.armR = [0, 0, 100, 0, 0]; });
  document.getElementById('clipText').value = R.text(ed); M.apply();
  let up = M.lib.sample(M.S.clip, .5), sh = M.lib.pt(up, 'shR'), fist = M.lib.pt(up, 'fistR');
  if (!(fist[2] > sh[2] + 400)) out.bad.push('an applied edit (right arm straight up) did not raise the fist above the shoulder');
  if (!M.lib.edited('Idle_Loop')) out.bad.push('the applied edit is not marked as edited');
  document.getElementById('resetBtn').click();
  up = M.lib.sample(M.S.clip, .5); sh = M.lib.pt(up, 'shR'); fist = M.lib.pt(up, 'fistR');
  if (fist[2] > sh[2] || M.lib.edited('Idle_Loop')) out.bad.push('Reset did not restore the clip');
  M.setView('threequarter'); M.play('Idle_Loop'); M.resume();
  return out;
});
await browser.close();
problems.push(...report.bad);
// the CMU ledger (src/mocap/catalogs/cmu-takes.tsv, written by tools/cmu.mjs survey): every take of the database, each
// measured, and every take the CMU set cuts a clip from marked with those clips
{
  const { readLedger } = await import('./cmu.mjs'), L = readLedger(), rows = Object.values(L);
  const pick = JSON.parse(readFileSync(resolve('src/mocap/catalogs/cmu.json'), 'utf8')).$pick || {};
  if (rows.length < 2548) problems.push('the CMU ledger lists ' + rows.length + ' takes, not all 2,548');
  for (const r of rows) if (!/error|not downloaded/.test(r.flags) && !(r.sec && r.category && /^\d+\/\d+$/.test(r.fit) && /^[\d.]+-[\d.]+$/.test(r.active))) { problems.push('CMU ledger: take ' + r.id + ' is not fully measured'); break; }
  // and the lab's CMU library has every take of it, each subject's file beside the index
  const libDir = resolve('examples/cmu-lib'), sb = { window: {} };
  try {
    (await import('node:vm')).runInNewContext(readFileSync(resolve(libDir, 'index.js'), 'utf8'), sb);
    const X = sb.window.CMU_LIB, have = new Set(X.takes.map(t => t[0]));
    for (const r of rows) if (!/error|not downloaded/.test(r.flags) && !have.has(r.id)) { problems.push('the CMU library lacks take ' + r.id); break; }
    for (const s of Object.keys(X.subjects)) if (!existsSync(resolve(libDir, 'CMU_' + String(s).padStart(2, '0') + '.js'))) problems.push('the CMU library lacks subject ' + s + "'s file");
  } catch (e) { problems.push('the CMU library index (examples/cmu-lib/index.js) does not read: ' + e.message); }
  for (const [clip, [take]] of Object.entries(pick)) {
    if (!L[take]) problems.push('CMU clip ' + clip + ': its take ' + take + ' is not in the ledger');
    else if (!L[take].used.split(' ').includes(clip)) problems.push('CMU ledger: take ' + take + ' does not list ' + clip + ' as used (run node tools/cmu.mjs survey --subjects ' + +take.split('_')[0] + ')');
  }
}
if (problems.length) { console.error('mocap lab: ' + problems.length + ' problem(s)\n  ' + [...new Set(problems)].slice(0, 40).join('\n  ')); process.exit(1); }
const sets = Object.entries(report.sets).map(([id, s]) => `${id} ${s.clips} clips (${s.keys} key poses, ${s.fit.toFixed(1)} mm from the capture)`).join(', ');
console.log(`mocap lab: ${sets}; ${report.frames} poses checked on the mannequin and the hero; the CMU library: ${report.library.takes} takes, ${report.library.loaded} subjects loaded and played; no problems`);
