// The API index: API-INDEX.md, written from the engine itself. One line for every public name (a name that doesn't start
// with _): E's functions, values and tables, every class's methods, statics and fields, and the members of the helper
// namespaces (px, font, ui, tex, ...), each with its signature and the doc comment above it in engine/my-3d2dge.js (or the
// // comment at the end of its line), grouped by the engine's sections, with the units and height rules at the top.
// Names the agent edition doesn't have are marked. Agents search it; nobody reads it whole. The cards (API.md, the agent
// edition's header) stay the overviews and point here.
//   node tools/api-index.mjs            write API-INDEX.md
//   node tools/api-index.mjs --check    exit 1 when API-INDEX.md is not what the engine gives, a public name has no
//                                      description (document the name, or make it private: _), or a lookup of
//                                      tools/api-index-lookups.json stops answering (doctrine-check runs all three)
//   node tools/api-index.mjs --lookups  each lookup: its searches, the lines and tokens its hits hold, the facts missing
//   node tools/api-index.mjs --missing  list the public names without a description, by section
// A doc comment above a line that defines several fields describes each one in a clause of its own: "name: what it is;"
// or "name = what it is;" (the camera's fields are written this way).
// A doc comment's options, one to a line as "- name: what it does" (or "- a, b: ...", with the lines under it that start
// no other), become lines of their own named by their owner: `new E.Game({ expand })`, `shell.show('help')` for
// "- 'help': ...", `E.shapeMesh() → groups` for "- → groups: ..."; a long description splits so a search finds the clause.
// A constructor's line ends with the name its instances go by (`new E.Attack(...) → slash`: its methods are slash.*), and
// a contents block after the examples gives each section's line and its classes' instance names.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FULL = 'engine/my-3d2dge.js', AGENT = 'engine/my-3d2dge-agent.js', OUT = 'API-INDEX.md';
const args = process.argv.slice(2), has = k => args.includes('--' + k);
const load = file => { const ctx = { console: { log() {}, warn() {}, error() {} } }; vm.createContext(ctx); vm.runInContext(readFileSync(join(root, file), 'utf8'), ctx, { filename: file }); return ctx.My3D2dge; };
// the name an instance of each class goes by in games (game.input, r.queue, map.ray, ...)
// (a class only the game makes, not on E, is listed by its instance's name alone: game.screen, r, game.lights, ...)
const INST = { Game: 'game', Input: 'input', Screen: 'game.screen', Renderer: 'r', View: 'view', Lighting: 'game.lights', Particles: 'game.particles',
  TileMap: 'map', PlatformMap: 'level', Humanoid: 'rig', Blob: 'blob', Body: 'body', Platformer: 'hero', FlowField: 'flow', Bullets: 'shots',
  SpatialHash: 'grid', Attack: 'slash', Combo: 'combo', ChipAudio: 'game.audio', Dialog: 'talk', Menu: 'menu', Backdrop: 'backdrop', GPULighting: 'game.gpu',
  FullScreen: 'fullscreen', Settings: 'settings' };
// objects inside a class whose own fields are part of the API: game.cam.offset, game.stats.frameMs
const NESTED = { Game: ['cam', 'stats'] };

/* ---- reading a source: sections, definitions, class bodies, namespaces, doc comments ---- */
function scan(src) {
  const L = src.split('\n'), sections = [], top = new Map(), classes = new Map(), spaces = new Map();
  for (let i = 0; i < L.length; i++) {
    const m = /^\/\* ={10,}/.test(L[i]) && /^ \* (\d+b?)\. (.+?)(?:\s{2,}(.*))?$/.exec(L[i + 1] || '');
    if (m) sections.push({ at: i, n: m[1], title: m[2].trim(), gloss: (m[3] || '').trim() });
    let d;
    if ((d = /^class (\w+)(?: extends (\w+))?/.exec(L[i]))) { let j = i + 1; while (j < L.length && L[j] !== '}') j++; classes.set(d[1], { at: i, end: j, parent: d[2] || null }); top.set(d[1], i); }
    else if ((d = /^(?:const|let) (\w+) = /.exec(L[i])) || (d = /^function (\w+)\s*\(/.exec(L[i]))) { if (!top.has(d[1])) top.set(d[1], i); }
    else if ((d = /^E\.(\w+) = /.exec(L[i]))) top.set('E.' + d[1], i);
    else if ((d = /^(\w+)\.(\w+) = /.exec(L[i]))) top.set(d[1] + '.' + d[2], i);
    // an object literal of functions or data: its members at two spaces' indent
    if ((d = /^(?:E\.(\w+)|(?:const|let) (\w+)) = \{\s*$/.exec(L[i]))) {
      const name = d[1] || d[2], mem = new Map(); let j = i + 1;
      for (; j < L.length && !/^\};?\s*(\/\/.*)?$/.test(L[j]); j++) { const k = /^ {2}(\w+)\s*(?:\(|:)/.exec(L[j]); if (k && !mem.has(k[1])) mem.set(k[1], j); }
      spaces.set(name, mem);
    }
  }
  const section = i => { let s = null; for (const x of sections) if (x.at <= i) s = x; return s; };
  // a class's members: methods at two spaces' indent, fields assigned to this anywhere in its body
  const members = name => {
    const c = classes.get(name); if (!c) return null;
    const methods = new Map(), fields = new Map(), defaults = new Map();
    for (let i = c.at + 1; i < c.end; i++) {
      const m = /^ {2}(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?(\w+)\s*\(/.exec(L[i]); if (m && m[1] !== 'constructor' && !methods.has(m[1])) methods.set(m[1], i);
      for (const f of L[i].matchAll(/this\.(\w+)\s*=(?![=>])/g)) if (!fields.has(f[1])) fields.set(f[1], i);
      const oa = /Object\.assign\(this,\s*\{(.*?)\}\s*,\s*o\)/.exec(L[i]);
      if (oa) for (const k of oa[1].matchAll(/(?:^|,)\s*(\w+)\s*:\s*([^,]+)/g)) { if (!fields.has(k[1])) fields.set(k[1], i); defaults.set(k[1], k[2].trim()); }
      // the options with their defaults over several lines: Object.assign(this, {\n ... \n}, o)
      if (/Object\.assign\(this,\s*\{/.test(L[i]) && (L[i].match(/\{/g) || []).length > (L[i].match(/\}/g) || []).length) for (let j = i; j < c.end; j++) {   // over several lines
        for (const k of L[j].replace(/^.*Object\.assign\(this,\s*\{/, '').matchAll(/(?:^|,)\s*(\w+)\s*:\s*([^,}]+)/g)) { if (!fields.has(k[1])) fields.set(k[1], i); defaults.set(k[1], k[2].trim()); }
        if (/\}\s*,\s*o\)/.test(L[j])) break;
      }
    }
    // methods added after the class: TileMap.prototype.solid = function (...) (an engine section that extends a class)
    for (let i = 0; i < L.length; i++) { const m = /^(\w+)\.prototype\.(\w+) = function\s*\(/.exec(L[i]); if (m && m[1] === name && !methods.has(m[2])) methods.set(m[2], i); }
    // a subclass lists only what it adds: the fields its parent sets are the parent's
    if (c.parent) { const P = members(c.parent); if (P) for (const f of P.fields.keys()) if (!/Object\.assign/.test(L[fields.get(f)] || '')) fields.delete(f); else if (P.fields.has(f)) fields.delete(f); }
    return { methods, fields, defaults };
  };
  return { L, sections, section, top, classes, spaces, members };
}

// an option's line in a doc comment: "- name: what it does", "- a, b: ...", "- 'title': ...", "- → result: ..."
const OPT = /^- ((?:→ )?[\w.[\]']+(?:, [\w.[\]']+)*): (.*)$/;
/** the doc comment ending just above line i, its lines without the stars: [the description's lines, [names, text] for each
 *  option], or null. Up to the comment's opening: a doc comment (/**) describes the name; a section banner (/* ====) or
 *  any other block comment doesn't (a name right under a banner once took the doc comment above the banner) */
function block(L, i) {
  let j = i - 1; if (!(j >= 0 && /\*\/\s*$/.test(L[j]))) return null;
  const end = j; while (j >= 0 && !/^\s*\/\*/.test(L[j])) j--;
  if (!(j >= 0 && /^\s*\/\*\*/.test(L[j]))) return null;
  const lines = L.slice(j, end + 1).join('\n').replace(/^\s*\/\*\*\s?/, '').replace(/\s*\*\/\s*$/, '').split('\n').map(l => l.replace(/^\s*\*\s?/, ''));
  const main = [], opts = [];
  for (const l of lines) { const m = OPT.exec(l.trim()); if (m) opts.push([m[1], m[2]]); else if (opts.length) opts[opts.length - 1][1] += ' ' + l; else main.push(l); }
  return [main, opts.map(([n, t]) => [n, clean(t)])];
}
/** the options of the doc comment above line i (block's), [] without */
const optsAt = (S, i) => { const b = i === undefined || i === null ? null : block(S.L, i); return b ? b[1] : []; };
/** the doc comment above line i (/** ... *\/ or // lines), or the // comment at its end. For a line that defines several
 *  names, only the clause about `name` ("name: ..." or "name = ...") */
function docAt(S, i, name, shared) {
  const L = S.L; let doc = '';
  let j = i - 1;
  if (j >= 0 && /\*\/\s*$/.test(L[j])) {
    const b = block(L, i); if (b) doc = b[0].join(' ');
  } else if (j >= 0 && /^\s*\/\/(?! -{4})/.test(L[j])) {
    const out = []; while (j >= 0 && /^\s*\/\/(?! -{4})/.test(L[j])) out.unshift(L[j--].replace(/^\s*\/\/\s?/, ''));
    doc = out.join(' ');
  }
  const tail = trailing(L[i]);
  if (shared) {   // several names on the line: the clause that names this one
    const clause = text => { for (const c of splitTop(text)) { const m = describes(c, name); if (m) return m[1]; } return ''; };
    return clean(clause(doc) || clause(tail));
  }
  return clean(doc || tail);
}
/** does clause c describe `name`? "name: what", "name = what", "a, b, c: what they are" (each name of the group gets it):
 *  the match, with what it says as [1] */
const describes = (c, name) => new RegExp('^\\s*(?:`?\\w+`?\\s*,\\s*)*`?' + name + '`?(?:\\([^)]*\\))?(?:\\s*,\\s*`?\\w+`?)*\\s*(?:[:=]|\\s-)\\s*(.+)$').exec(c);
/** a parent's description without the clauses its members' own lines give (game.cam's camera fields, new E.Body's) */
const cut = (doc, members) => { if (!doc || !members.length) return doc; const all = splitTop(doc), keep = all.filter(c => !members.some(m => describes(c, m))); return keep.length && keep.length < all.length ? clean(keep.join('; ')) : doc; };
/** a shared comment's clauses: split at '; ' and at '. ' before the next name, outside parentheses and brackets */
function splitTop(text) {
  const out = []; let depth = 0, cur = '';
  for (let k = 0; k < text.length; k++) {
    const ch = text[k];
    if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    if (!depth && ((ch === ';' && text[k + 1] === ' ') || (ch === '.' && text[k + 1] === ' ' && /^ [a-z_]\w*(?:\s*,\s*\w+)*\s*[:=(]/.test(text.slice(k + 1))))) { out.push(cur); cur = ''; k++; continue; }
    cur += ch;
  }
  out.push(cur); return out;
}
/** the // comment at the end of a line of code (outside strings and regular expressions, as far as a simple scan can tell) */
function trailing(line) {
  let q = null;
  for (let k = 0; k < line.length; k++) {
    const ch = line[k];
    if (q) { if (ch === '\\') k++; else if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') q = ch;
    else if (ch === '/' && line[k + 1] === '/' && /\s/.test(line[k - 1] || ' ') && k > 0 && line.slice(0, k).trim()) return unwrap(line.slice(k + 2).trim());
  }
  return '';
}
/** "(a note)" -> "a note", when the parentheses hold the whole text; "fast (then settles)" keeps its own */
function unwrap(t) {
  if (!/^\(.*\)$/.test(t)) return t;
  let depth = 0; for (let k = 1; k < t.length - 1; k++) { if (t[k] === '(') depth++; else if (t[k] === ')' && --depth < 0) return t; }
  return depth ? t : t.slice(1, -1);
}
const clean = s => s.replace(/\s+/g, ' ').replace(/\{@link ([^}]+)\}/g, '$1').trim();

/** the parameters written after `name` on line i: (a, b = 2) */
function params(line, name) {
  let k = line.search(new RegExp('\\b' + name + '\\b\\s*(?:=\\s*(?:\\([^)]*\\)\\s*=>|\\w+\\s*=>|function|\\()|\\(|:\\s*(?:\\(|\\w+\\s*=>|function))'));
  if (k < 0) return null;
  const rest = line.slice(k + name.length), single = /^\s*(?:=|:)\s*(\w+)\s*=>/.exec(rest);
  if (single) return single[1];
  const open = rest.indexOf('('); if (open < 0) return null;
  let depth = 0;
  for (let j = open; j < rest.length; j++) { if (rest[j] === '(') depth++; else if (rest[j] === ')' && --depth === 0) return rest.slice(open + 1, j).trim(); }
  return rest.slice(open + 1).trim() + '...';
}
/** a field's starting value, when it is short and plain (a number, a string, a flag, a small array) */
function initial(line, name) {
  const m = new RegExp('this\\.' + name + '\\s*=\\s*([^;]+?)(?:;|$)').exec(line); if (!m) return '';
  const v = m[1].trim();
  return /^(-?[\d.]+(?:\s*\/\s*[\d.]+)?|'[^']*'|true|false|null|\[[^\]]{0,24}\])$/.test(v) ? v : '';
}

/* ---- the index ---- */
export function build() {
  const F = scan(readFileSync(join(root, FULL), 'utf8')), A = scan(readFileSync(join(root, AGENT), 'utf8'));
  const E = load(FULL), EA = load(AGENT), entries = [], missing = [], insts = [];
  const isClass = v => typeof v === 'function' && /^class\b/.test(Function.prototype.toString.call(v));
  const add = (sec, sig, doc, agent, key, line) => { entries.push({ sec, sig, doc, agent, key, line }); if (!doc) missing.push({ sec: sec ? sec.n + '. ' + sec.title : '?', key, line }); };
  // the options in the doc comment above line i, each a line of its own after its owner's: owner({ a, b }) for a call,
  // owner { a, b } for a table, owner('title') for a quoted name, owner() → x for what it returns
  const addOpts = (sec, owner, call, i, agent, key) => {
    for (const [n, text] of optsAt(F, i)) {
      const sig = n.startsWith('→ ') ? `${owner}() ${n}` : /^'/.test(n) ? `${owner}(${n})` : call ? `${owner}({ ${n} })` : `${owner} { ${n} }`;
      add(sec, sig, text, agent, key + ' ' + n, i); entries[entries.length - 1].opt = true;
    }
  };
  // where E.k is defined: E.k = ..., or a local that Object.assign(E, { k }) or E.k = k exported
  const defOf = (S, k) => {
    if (S.top.has('E.' + k)) { const i = S.top.get('E.' + k), id = /^E\.\w+ = (\w+);/.exec(S.L[i]); return id && S.top.has(id[1]) ? [S.top.get(id[1]), id[1], i] : [i, k, i]; }
    if (S.top.has(k)) { const i = S.top.get(k); return [i, k, i, /^(?:const|let) \w+ = [^;({=>]*,\s*\w+ = /.test(S.L[i])]; }
    // one of several declared on a line (const TAU = ..., DEG = ...), or a key of E's own literal
    const i = S.L.findIndex(l => new RegExp('^(?:const|let) (?:.*[,{]\\s*)?' + k + '\\b\\s*[=:,}]').test(l));
    return i >= 0 ? [i, k, i, true] : null;
  };
  const docOf = (S, d) => d ? docAt(S, d[0], d[1], d[3]) || (d[2] !== d[0] ? docAt(S, d[2], d[1]) : '') : '';
  const exported = new Set();
  // an instance's lines: its public methods (protoNames), then its fields
  const instance = (k, cname, inst, sec, protoNames, mem, amem) => {
    for (const m of protoNames.sort()) {
      const i = mem.methods.get(m), get = i !== undefined && /^ {2}(?:static\s+)?get\s/.test(F.L[i]);
      add(sec, `${inst}.${m}` + (get ? '' : `(${i !== undefined ? params(F.L[i], m) || '' : ''})`), i !== undefined ? docAt(F, i, m) : '', !!(amem && amem.methods.has(m)), `${k}#${m}`, i);
      addOpts(sec, `${inst}.${m}`, !get, i, !!(amem && amem.methods.has(m)), `${k}#${m}`);
    }
    for (const [f, i] of [...mem.fields].filter(([f]) => !f.startsWith('_') && !protoNames.includes(f)).sort((a, b) => a[0] < b[0] ? -1 : 1)) {
      const shared = (F.L[i].match(/this\.(?!_)\w+\s*=(?![=>])/g) || []).length > 1 || /Object\.assign\(this/.test(F.L[i]), dv = mem.defaults.get(f);
      const init = initial(F.L[i], f) || (dv && /^(-?[\d.]+|'[^']*'|true|false|null)$/.test(dv) ? dv : '');
      // a nested object's own fields: one clause each in the comment above (its own line keeps the rest)
      const lit = (NESTED[k] || []).includes(f) && /=\s*\{(.*)\};?/.exec(F.L[i]), sub = lit ? [...lit[1].matchAll(/(?:^|,)\s*(\w+)\s*:/g)].map(m => m[1]).filter(n => !n.startsWith('_')) : [];
      add(sec, `${inst}.${f}` + (init ? ' = ' + init : ''), cut(docAt(F, i, f, shared), sub), !!(amem && amem.fields.has(f)), `${k}.${f}`, i);
      for (const n of sub) add(sec, `${inst}.${f}.${n}`, docAt(F, i, n, true), !!(amem && amem.fields.has(f)), `${k}.${f}.${n}`, i);
    }
  };
  for (const k of Object.keys(E).sort()) {
    if (k.startsWith('_')) continue;
    const v = E[k], d = defOf(F, k), sec = d ? F.section(d[0]) : null, inAgent = k in EA;
    if (isClass(v)) {
      const cname = d ? d[1] : k, inst = INST[k] || k.toLowerCase(), mem = F.members(cname), amem = A.members(cname), ctor = mem && [...F.L.slice(F.classes.get(cname).at, F.classes.get(cname).end)].findIndex(l => /^ {2}constructor\s*\(/.test(l));
      const ci = ctor >= 0 ? F.classes.get(cname).at + ctor : -1, cdoc = cut((ci >= 0 && docAt(F, ci, 'constructor')) || docOf(F, d), mem ? [...mem.fields.keys()].filter(f => !f.startsWith('_')) : []);
      add(sec, `new E.${k}(${ci >= 0 ? params(F.L[ci], 'constructor') || '' : ''}) → ${inst}`, cdoc, inAgent, 'E.' + k, ci >= 0 ? ci : d && d[0]);
      addOpts(sec, `new E.${k}`, true, ci >= 0 && docAt(F, ci, 'constructor') ? ci : d && d[0], inAgent, 'E.' + k); insts.push({ sec, name: 'E.' + k, inst });
      const statics = Object.getOwnPropertyNames(v).filter(s => !['length', 'name', 'prototype'].includes(s) && !s.startsWith('_')).sort();
      // a key map (E.Input.THIRDPERSON: each action's codes) names its actions, but those every key map of the class has
      const keymap = x => x && typeof x === 'object' && !Array.isArray(x) && Object.values(x).every(Array.isArray), maps = statics.filter(s => keymap(v[s]));
      const common = maps.length > 1 ? Object.keys(v[maps[0]]).filter(a => maps.every(s => a in v[s])) : [];
      for (const s of statics) {
        const i = F.top.get(cname + '.' + s) ?? (mem && mem.methods.get(s)), val = v[s], own = keymap(val) && Object.keys(val).filter(a => !common.includes(a));
        add(sec, `E.${k}.${s}` + (typeof val === 'function' ? `(${i !== undefined ? params(F.L[i], s) || '' : ''})` : own && own.length ? ` { ${own.join(', ')} }` : ''), i !== undefined ? docAt(F, i, s) : '', inAgent && EA[k] && s in EA[k], `E.${k}.${s}`, i);
      }
      if (!mem) continue;
      exported.add(cname);
      instance(k, cname, inst, sec, Object.getOwnPropertyNames(v.prototype).filter(m => m !== 'constructor' && !m.startsWith('_')), mem, amem);
    } else if (v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).some(x => typeof x === 'function') && !Object.values(v).every(x => x && typeof x === 'object')) {
      // a namespace of helpers: one line for it, one for each member (px's as games write them: the card's first line is
      // const E = My3D2dge, { px, clamp } = E)
      const space = F.spaces.get(d ? d[1] : k) || new Map(), pre = k === 'px' ? 'px' : 'E.' + k;
      add(sec, `E.${k}`, docOf(F, d), inAgent, 'E.' + k, d && d[0]);
      const ms = Object.keys(v).filter(m => !m.startsWith('_')).sort(), at = new Map();
      for (const m of ms) {
        // (or set inside the function that builds it: S.record = ... in E.session's)
        const inner = () => { if (!d) return undefined; for (let j = d[0] + 1; j < Math.min(F.L.length, d[0] + 600); j++) if (new RegExp('^\\s+\\w+\\.' + m + '\\s*=(?!=)|^\\s+const \\w+ = \\{[^}]*\\b' + m + '\\s*:').test(F.L[j])) return j; return undefined; };
        at.set(m, F.top.get((d ? d[1] : k) + '.' + m) ?? F.top.get('E.' + k + '.' + m) ?? space.get(m) ?? inner());
      }
      for (const m of ms) {
        const i = at.get(m), fn = typeof v[m] === 'function', shared = i !== undefined && ms.some(n => n !== m && at.get(n) === i);   // (E.session's frame, recording and replaying: one comment)
        add(sec, `${pre}.${m}` + (fn ? `(${i !== undefined ? params(F.L[i], m) || '' : ''})` : ''), i === undefined ? '' : shared && docAt(F, i, m, true) || docAt(F, i, m), inAgent && !!EA[k] && m in EA[k], `E.${k}.${m}`, i);
      }
    } else if (typeof v === 'function') {
      add(sec, `E.${k}(${d ? params(F.L[d[0]], d[1]) ?? params(F.L[d[2]], k) ?? '' : ''})`, docOf(F, d), inAgent, 'E.' + k, d && d[0]);
      if (d) addOpts(sec, `E.${k}`, true, docAt(F, d[0], d[1], d[3]) ? d[0] : d[2], inAgent, 'E.' + k);
    } else {
      // a value or a table: its keys, briefly; a short list of names in full (E.PROPS, E.VIEW_ORDER)
      const keys = Array.isArray(v) ? (v.every(x => typeof x === 'string') && v.join(', ').length <= 400 ? v.join(', ') : v.length + ' entries') : v && typeof v === 'object' ? Object.keys(v).slice(0, 14).join(', ') + (Object.keys(v).length > 14 ? ', ... (' + Object.keys(v).length + ')' : '') : JSON.stringify(v);
      // (its keys said again after a colon, as a whole list: "the actions E.Action plays: climbUp, vault, ...")
      const own = docOf(F, d), once = keys && !/\.\.\.|entries$/.test(keys) ? clean(own.replace(new RegExp(':\\s*' + keys.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[.;]|$)'), '')) : own;
      add(sec, `E.${k}` + (keys ? ': ' + keys : ''), once, inAgent, 'E.' + k, d && d[0]);
      if (d) addOpts(sec, `E.${k}`, false, d[0], inAgent, 'E.' + k);
    }
  }
  // the classes only the game makes, not on E (game.screen, r, game.lights, game.audio, ...): their instances' lines, with no
  // constructor's (INST names the instance; a static is the class's own)
  for (const [cname, c] of F.classes) {
    if (exported.has(cname) || !INST[cname]) continue;
    const mem = F.members(cname), amem = A.members(cname), sec = F.section(c.at);
    insts.push({ sec, name: '', inst: INST[cname] });
    instance(cname, cname, INST[cname], sec, [...mem.methods].filter(([m, i]) => !m.startsWith('_') && !/^ {2}static\s/.test(F.L[i])).map(([m]) => m), mem, amem);
  }
  for (const e of entries) {
    const n = e.opt ? !e.key.includes(',') && (/ ([\w.[\]]+)$/.exec(e.key) || [])[1] : e.key.split(/[.#]/).pop();
    if (n && e.doc) e.doc = e.doc.replace(new RegExp('^(?:E\\.)?' + n.replace(/[.[\]]/g, '\\$&') + '\\s*[:=]\\s+'), '');
  }
  return { E, F, entries, missing, insts };
}

/** the index's text */
export function render({ E, F, entries, insts }) {
  const H = E.HEIGHTS, out = [];
  out.push(`# my-3D2dge API index (v${E.version})`, '',
    `Every public name in \`engine/my-3d2dge.js\`, one line each: its signature (and default, for a field) and what its doc comment says (a long one's options on lines of their own: \`new E.Game({ expand })\`). Written by \`node tools/api-index.mjs\` from the engine itself; \`doctrine-check\` fails when a public name has no description here. Search it for a name; \`API.md\` and the agent edition's header are the overviews. † marks a name the agent edition (\`my-3d2dge-agent.js\`) doesn't have.`, '',
    '## Units and the height rules', '',
    '| Quantity | Unit |', '| --- | --- |',
    '| Distances, positions, sizes in the world | world units: one floor tile is 16; x east, y south, z up |',
    '| Speeds, gravity | world units per second, per second squared |',
    '| Time, `dt` | seconds (`dt` is one fixed step: 1/120 s of real time times `game.timeScale`) |',
    '| Angles, `facing`, `dir` | radians: 0 east, π/2 south (a direction may also be a ground vector `[dx, dy]`) |',
    '| Screen positions | pixels of the game\'s own low-resolution buffer (`game.screen.W` × `H`) |',
    '| Colors | `\'#rrggbb\'` strings |', '',
    `- A body's \`z\` is its feet. A cell's top is \`map.height(cx, cy)\`: 0 on the floor; a wall is solid from 0 up to its \`h\`.`,
    `- A body stands on the highest top within \`z + ${H.step}\` under its footprint (\`E.HEIGHTS.step\`, \`Body.step\`).`,
    `- Eyes are at \`z + ${H.eye}\` and a target is seen at \`z + ${H.chest}\` (\`E.HEIGHTS.eye\`, \`chest\`; a body's own \`eye\` and \`chest\` override them).`,
    `- Two things are on the same level when \`|dz| <= ${H.level}\` (\`E.HEIGHTS.level\`), unless a call says otherwise.`,
    '- Collision, standing, sight (`map.sight`, `map.ray`), reach (`E.targets`, `E.inArc` with `dz`) and navigation (`E.FlowField`) all follow these rules. `E.dist` is 3D; `E.overlap` is flat.', '',
    '## Examples', '', 'Each runs in `tools/contract-test.mjs`.', '', '```js headless',
    '// a game with no display, in Node or a test: fixed steps, scripted input, its state',
    'const E = My3D2dge, game = new E.Game({ headless: true, res: \'snes\' });',
    'const hero = new E.Body({ x: 40, y: 40, r: 5 });',
    'game.start({ update(dt) { hero.vx = game.input.move()[0] * 80; if (game.input.pressed(\'jump\')) hero.jump(210); hero.update(dt); }, draw() {} });',
    'game.input.hold(\'right\'); game.input.tap(\'jump\');',
    'game.advance(0.25);   // 30 fixed steps of 1/120 s, at once',
    'if (!(hero.x > 55 && hero.z > 20)) throw new Error(\'the hero should run right and be in the air\');',
    'game.dispose();', '```', '', '```js heights',
    '// a guard on a roof, a hero in the street: sight, reach and a climb read heights the same way',
    'const E = My3D2dge, map = new E.TileMap({ rows: [\'#######\', \'#.....#\', \'#..RR.#\', \'#######\'], legend: { \'#\': 1, R: 2 }, types: { 1: { h: 80 }, 2: { h: 40 } } });',
    'const guard = { x: 56, y: 40, z: 40, facing: Math.PI }, hero = { x: 36, y: 40, z: 0, r: 5 };',
    'if (!map.sight(guard, hero)) throw new Error(\'eyes on a roof see down into the street\');',
    'if (E.targets(guard, [hero], { range: 60 }).length) throw new Error(\'not on the same level: no melee target\');',
    'const up = map.ledge(hero, 0);   // east, toward the roof',
    'if (!up || up.z !== 40) throw new Error(\'a ledge to climb onto the roof\');', '```', '');
  const bySec = new Map();
  for (const e of entries) { const k = e.sec ? e.sec.n : '?'; if (!bySec.has(k)) bySec.set(k, { sec: e.sec, list: [] }); bySec.get(k).list.push(e); }
  const order = [...bySec.values()].sort((a, b) => (a.sec ? F.sections.indexOf(a.sec) : -1) - (b.sec ? F.sections.indexOf(b.sec) : -1));
  const body = [], at = [];
  for (const { sec, list } of order) {
    const title = sec ? sec.n + '. ' + sec.title.charAt(0) + sec.title.slice(1).toLowerCase() : 'The engine object (E = My3D2dge)';
    at.push({ sec, title: sec ? title.replace(/^\d+b?\. /, '') : title, line: body.length }); body.push(`## ${title}`, '');
    // one object's lines that say the same thing are one line: `body.x = 0`, `body.y = 0`, `body.z = 0`: its position
    const of = e => !e.opt && e.doc && /^(?:E\.\w+|[^.#\s]+)[.#]/.test(e.key) && !/^E\.\w+$/.test(e.key) ? e.key.replace(/[.#][^.#]*$/, '') + '\n' + e.doc : null, groups = new Map();
    for (const e of list) { const g = of(e); if (g) groups.set(g, (groups.get(g) || []).concat(e)); }
    const sig = e => `\`${e.sig.replace(/`/g, "'")}\`${e.agent ? '' : ' †'}`;
    for (const e of list) {
      const g = of(e), same = g ? groups.get(g) : [e]; if (same[0] !== e) continue;
      const one = same.every(x => x.agent === e.agent);   // (one † for them all, when they agree)
      body.push(`- ${one ? same.map(x => `\`${x.sig.replace(/`/g, "'")}\``).join(', ') + (e.agent ? '' : ' †') : same.map(sig).join(', ')}${e.doc ? ': ' + e.doc : ''}`);
    }
    body.push('');
  }
  // the contents: each section's line, and the name its classes' instances go by (their members are listed under it)
  const intro = ['## Contents', '', 'The line each section starts on, and the name its classes\' instances go by: `E.Attack: slash` lists its members as `slash.start`.', ''];
  const first = out.length + intro.length + at.length + 1;   // (the contents' own lines, and a blank one, come first)
  out.push(...intro, ...at.map(({ sec, title, line }) => {
    const own = (insts || []).filter(c => c.sec === sec).map(c => c.name ? c.name + ': ' + c.inst : c.inst);
    return `- ${first + line + 1} ${title}${own.length ? '; ' + own.join(', ') : ''}`;
  }), '', ...body);
  return out.join('\n');
}

/** a grep pattern (basic regular expressions, as grep -n "<pattern>" reads it: \\| is or) as a JavaScript one */
function bre(p) {
  let out = '';
  for (let k = 0; k < p.length; k++) {
    const ch = p[k];
    if (ch === '\\' && k + 1 < p.length) { const nx = p[++k]; out += '|(){}+?'.includes(nx) ? nx : '\\' + nx; }
    else out += '|(){}+?'.includes(ch) ? '\\' + ch : ch;
  }
  return new RegExp(out);
}
/** the lookups of tools/api-index-lookups.json against the index's text: for each, its hits (grep -n's lines) and the
 *  facts they don't hold */
export function lookups(text, file = join(root, 'tools/api-index-lookups.json')) {
  const L = text.split('\n'), spec = JSON.parse(readFileSync(file, 'utf8'));
  return spec.lookups.map(q => {
    const hits = q.grep.map(g => { const re = bre(g); return L.map((l, i) => re.test(l) ? `${i + 1}:${l}` : null).filter(Boolean); });
    const all = hits.flat().join('\n');
    return Object.assign({}, q, { hits, missing: q.facts.filter(f => !all.includes(f)) });
  });
}
/** a line about the lookups (and the problems: the ones that stop answering) */
export function lookupReport(text) {
  const R = lookups(text), bad = R.filter(r => r.missing.length || r.hits.some(h => !h.length)), one = R.filter(r => r.grep.length === 1 && !bad.includes(r)).length;
  return { line: `${R.length - bad.length} of ${R.length} lookups answered (${one} by one search)`,
    problems: bad.map(r => `lookup ${r.n} (${r.need}: ${r.grep.map(g => `grep "${g}"`).join(', then ')}) no longer finds ${r.missing.length ? r.missing.map(f => JSON.stringify(f)).join(', ') : 'anything'}: give the index those facts again (a doc comment in the engine), or change the lookup in tools/api-index-lookups.json if the API changed`) };
}

/** how many public names (an option's line is not one) */
export const names = r => r.entries.filter(e => !e.opt).length;

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const r = build(), text = render(r);
  if (has('missing')) {
    const by = {}; for (const m of r.missing) (by[m.sec] = by[m.sec] || []).push(m.key);
    if (has('lines')) for (const m of r.missing) console.log(`${m.key}\t${m.line === undefined || m.line === null ? '?' : m.line + 1}\t${m.line === undefined || m.line === null ? '' : r.F.L[m.line].trim().slice(0, 170)}`);
    else for (const [s, ks] of Object.entries(by)) console.log(`${s} (${ks.length}): ${ks.join(', ')}`);
    console.log(`${r.missing.length} of ${r.entries.length} public names have no description`);
    process.exit(0);
  }
  if (has('lookups')) {
    let tok = s => Math.ceil(s.length / 3.29); try { const { encode } = await import('gpt-tokenizer/encoding/cl100k_base'); tok = s => encode(s).length; } catch (e) { /* estimated */ }
    let sum = 0;
    for (const q of lookups(text)) { const t = q.hits.map(h => tok(h.join('\n') + '\n')); sum += t.reduce((a, b) => a + b, 0); console.log(`${String(q.n).padStart(2)} ${q.need}: ${q.grep.map((g, i) => `"${g}" ${q.hits[i].length} lines, ${t[i]} tokens`).join('; then ')}${q.missing.length ? '; MISSING ' + q.missing.join(', ') : ''}`); }
    console.log(lookupReport(text).line + `; their hits hold ${sum} tokens`);
    process.exit(0);
  }
  if (has('check')) {
    const now = existsSync(join(root, OUT)) ? readFileSync(join(root, OUT), 'utf8') : '';
    const problems = [], lk = lookupReport(text);
    if (r.missing.length) problems.push(`${r.missing.length} public name(s) have no description (a doc comment above, or a // comment at the end of the line): ${r.missing.slice(0, 12).map(m => m.key).join(', ')}${r.missing.length > 12 ? ', ...' : ''} (node tools/api-index.mjs --missing lists them; document them, or make them private with _)`);
    if (now !== text) problems.push(`${OUT} is out of date with the engine: run node tools/api-index.mjs`);
    problems.push(...lk.problems);
    if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
    console.log(`${OUT}: ${names(r)} public names, every one described; ${lk.line}`);
    process.exit(0);
  }
  writeFileSync(join(root, OUT), text);
  console.log(`wrote ${OUT}: ${names(r)} public names${r.missing.length ? `, ${r.missing.length} without a description (--missing lists them)` : ''}`);
}
