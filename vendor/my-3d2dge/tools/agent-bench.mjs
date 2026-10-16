// The North Star's open measures (DOCTRINE.md): how well a fresh coding agent builds a game from the handoff package
// alone. It copies dist/handoff/ into an empty directory outside the repository (so no CLAUDE.md, AGENTS.md or repo is
// in sight), gives a coding agent a brief there (claude with --safe-mode: no instructions, skills, plugins, hooks or MCP
// servers of this machine; or codex), and records:
//   - its output tokens, cost, turns and wall time (from the agent's own JSON stream);
//   - whether its first build passes tools/check.mjs (no page errors, something drawn) and its own game/test.mjs;
//   - whether it opened the engine below its header (read past the header's last line: a Read, cat, sed, head or tail
//     of my-3d2dge.js), searched it (grep, rg) or patched it;
//   - how it read the manuals (API-INDEX.md, API.md, AI_GUIDE.md, docs/ASSETS.md, README.md): each Read, cat, sed, head,
//     tail, Grep, grep or rg of one, as a whole read, a range or a search, with the lines and tokens its result held
//     (the stream's tool results) and whether the Read tool cut it short; and, for each read of the engine below its
//     header, whether a search of the index came in the three tool calls before it (a lookup the index didn't answer).
//     A run trips the index's split rule (D38, D41) when it reads it whole or through ranges covering most of it, or
//     when more than a third of its searches are followed by a read of the source; two runs in a row that trip it
//     reopen the split (D43);
//   - a vision judge's score of the check's screenshots against the PS1/N64-era 2D bar (tools/agent-bench/judge.md).
// It writes result.json and prints one table row per run (the format DOCTRINE.md's open measures take).
//
// Every real run spends money (a few dollars to tens of dollars): spending is a hard-to-undo call in DOCTRINE.md, so ask
// the owner before running it. --dry-run and --selftest spend nothing.
//
// Usage: node tools/agent-bench.mjs --brief assassins-creed [--agent claude|codex] [--model M] [--judge-model M]
//          [--budget 30] [--runs ~/.cache/my-3d2dge-bench] [--dry-run]
//        node tools/agent-bench.mjs --rescore <run dir> [--no-judge]   (score a finished run again; runs no agent;
//                                                         --no-judge keeps the judge's earlier score)
//        node tools/agent-bench.mjs --selftest               (the stream reader and the scoring on fixtures)
//        node tools/agent-bench.mjs --list                   (the briefs)
// Briefs: tools/agent-bench/briefs/<name>.md (assassins-creed: Vesper's brief, the baseline; botw-village; arkham-predator).
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, cpSync, createWriteStream } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), BENCH = join(root, 'tools/agent-bench');
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; }, flag = n => args.includes('--' + n);
const ENGINE = 'my-3d2dge.js', INDEX = 'API-INDEX.md';
// the manuals whose reads are recorded (by name: the package's README, not a game's)
const MANUALS = ['API-INDEX.md', 'API.md', 'AI_GUIDE.md', 'ASSETS.md', 'README.md'];
// tokens of a tool's result: cl100k where gpt-tokenizer is installed (the repository's dev dependency), else estimated
let tokens = s => Math.ceil(s.length / 3.3);
try { const { encode } = await import('gpt-tokenizer/encoding/cl100k_base'); tokens = s => encode(s).length; } catch (e) { /* estimated */ }
const hash = f => existsSync(f) ? createHash('sha1').update(readFileSync(f)).digest('hex') : null;

/** the line where the engine's header ends (the IIFE that opens its code): reading past it is reading the source */
export const headerEnd = src => { const i = src.split('\n').findIndex(l => /^\(function \(root\) \{/.test(l)); return i < 0 ? 80 : i; };

const GREP = /^(rg|grep|egrep|fgrep|ag|ast-grep|sg)$/;
/** a shell command line's pipelines: [[[program, ...args] per stage] per pipeline], split outside quotes, quotes taken off
 *  (a leading VAR=x, sudo or time is not the program) */
export function pipelines(cmd) {
  const out = []; let P = [], st = [], w = null, q = null;
  const word = () => { if (w !== null) st.push(w); w = null; }, stage = () => { word(); if (st.length) P.push(st); st = []; }, pipe = () => { stage(); if (P.length) out.push(P); P = []; };
  for (let k = 0; k < cmd.length; k++) {
    const ch = cmd[k];
    // (in double quotes a backslash escapes only $ ` " \ and a new line: "a\|b" is grep's a\|b)
    if (q) { if (ch === q) q = null; else if (ch === '\\' && q === '"' && '$`"\\\n'.includes(cmd[k + 1])) w += cmd[++k]; else w += ch; continue; }
    if (ch === "'" || ch === '"') { q = ch; w = w === null ? '' : w; continue; }
    if (ch === '\\' && k + 1 < cmd.length) { w = (w || '') + cmd[++k]; continue; }
    if (ch === '\n' || ch === ';') { pipe(); continue; }
    if ((ch === '&' || ch === '|') && cmd[k + 1] === ch) { pipe(); k++; continue; }
    if (ch === '|') { stage(); continue; }
    if (ch === '&') { pipe(); continue; }
    if (/\s/.test(ch)) { word(); continue; }
    w = (w || '') + ch;
  }
  pipe();
  return out.map(P => P.map(st => { while (st.length && (/^\w+=/.test(st[0]) || ['sudo', 'command', 'time', 'nice'].includes(st[0]))) st = st.slice(1); return st; }).filter(st => st.length)).filter(P => P.length);
}
/** what a pipeline does to the file its first program names: { how: 'search' | 'range' | 'whole', from, to, grep: the
 *  search's pattern and flags, cap: a head after it, tailN: the last lines a tail keeps }, or null when it reads nothing */
export function classify(P) {
  const prog = basename(P[0][0] || ''), later = P.slice(1), head = st => { const a = st.slice(1).join(' '), m = a.match(/(?:-n\s*|-)(\d+)/); return m ? +m[1] : 10; };
  const cap = (later.find(st => basename(st[0]) === 'head') || null), capN = cap ? head(cap) : null;
  if (GREP.test(prog) || later.some(st => GREP.test(basename(st[0])))) {
    const st = GREP.test(prog) ? P[0] : later.find(st => GREP.test(basename(st[0]))), flags = st.slice(1).filter(a => /^-/.test(a)).join(' ');
    const ei = st.indexOf('-e'), pat = ei > 0 ? st[ei + 1] : st.slice(1).find(a => !/^-/.test(a));
    return { how: 'search', grep: { pat, i: /(^|\s)-\w*i/.test(flags), E: /(^|\s)-\w*E/.test(flags) || basename(st[0]) !== 'grep', n: /(^|\s)-\w*n/.test(flags), c: /(^|\s)-\w*c/.test(flags) }, cap: capN };
  }
  const sedR = st => { const m = st.slice(1).join(' ').match(/-n\s+['"]?(\d+)(?:,(\d+))?p/); return m ? [+m[1], +(m[2] || m[1])] : null; };
  if (prog === 'sed') { const r = sedR(P[0]); return r ? { how: 'range', from: r[0], to: r[1] } : { how: 'whole' }; }
  if (prog === 'head') return { how: 'range', from: 1, to: head(P[0]) };
  if (prog === 'tail') { const m = P[0].slice(1).join(' ').match(/(?:-n\s*|-)\+?(\d+)/), plus = /\+\d/.test(P[0].join(' ')), from = m ? +m[1] : 1; return plus ? { how: 'range', from, to: capN ? from + capN - 1 : null } : { how: 'range', from: null, to: null, tailN: m ? +m[1] : 10 }; }
  if (['cat', 'nl', 'less', 'more', 'bat', 'awk'].includes(prog)) {
    const st = later.find(st => ['head', 'tail', 'sed'].includes(basename(st[0])));
    if (!st) return { how: 'whole' };
    const b = basename(st[0]); if (b === 'head') return { how: 'range', from: 1, to: head(st) };
    if (b === 'sed') { const r = sedR(st); return r ? { how: 'range', from: r[0], to: r[1] } : { how: 'whole' }; }
    return { how: 'range', from: null, to: null, tailN: head(st) };
  }
  return null;
}
/** a grep's output on a text, as near as a simple reading of its pattern gets (basic patterns: \| is or; -E: extended) */
function grepLines(text, g) {
  if (!g || !g.pat) return [];
  let src = g.pat; if (!g.E) src = src.replace(/\\([|(){}+?])|([|(){}+?])/g, (m, esc, raw) => esc ? esc : '\\' + raw);
  let re; try { re = new RegExp(src, g.i ? 'i' : ''); } catch (e) { return []; }
  const L = text.split('\n'), out = []; L.forEach((l, i) => { if (re.test(l)) out.push(g.n ? `${i + 1}:${l}` : l); });
  return g.c ? [String(out.length)] : out;
}

/** read an agent's JSON stream (claude stream-json or codex --json) into what the bench measures. o.lines: each manual's
 *  line count in the workspace ({ 'API-INDEX.md': 1077 }), for how much of it a read covers and whether a Read was cut */
export function readStream(text, header, o = {}) {
  const out = { agent: null, outputTokens: 0, inputTokens: 0, costUsd: null, turns: 0, ms: null, reads: [], searches: [], belowHeader: false, patched: false, result: '', error: null, manuals: [] };
  const engine = p => typeof p === 'string' && basename(p) === ENGINE && !/\/node_modules\//.test(p);
  const manual = p => typeof p === 'string' && !/\/node_modules\/|(^|\/)game\//.test(p) && MANUALS.includes(basename(p)) ? basename(p) : null;
  // every tool call in order, each with the manuals it read and its read of the engine below the header, if any
  const calls = [], byId = new Map();
  const call = id => { const c = { at: calls.length, manuals: [] }; calls.push(c); if (id) byId.set(id, c); return c; };
  const readMan = (c, file, how, tool, x = {}) => { const m = Object.assign({ file, how, tool, lines: null, tokens: null, cut: false }, x); out.manuals.push(m); c.manuals.push(m); };
  const engineRead = (c, r) => { out.reads.push(r); if (r.to > header) { out.belowHeader = true; c.below = r; } };
  // a shell command line: each of its pipelines (chained by ;, &&, || or new lines) on its own, by its programs. A pipeline
  // that greps is a search (grep ... | head too); sed -n a,bp, head and tail (or cat piped into them) read a range; cat,
  // nl, less or awk read the file whole; anything else (wc, ls, cp, node ...) reads nothing. A search of a folder: its
  // result says which manuals it hit
  const shell = (id, cmd) => {
    const c = call(id); if (typeof cmd !== 'string') return;
    cmd = cmd.replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?\n\2(?=\s|$)/g, '<<script').replace(/\s-e\s+(["'])[\s\S]*?\1/g, ' -e script');   // a script that loads the engine is not a read of it
    if (/\b(sed\s+-i|perl\s+-pi)\b[^;|&]*my-3d2dge\.js|>\s*\S*my-3d2dge\.js/.test(cmd)) { out.patched = true; return; }
    const pipes = pipelines(cmd); c.reads = 0;
    // (the pipelines that print something: the result is one read's alone only when nothing else in the call prints)
    c.prints = pipes.filter(P => !['cd', 'export', 'mkdir', 'cp', 'mv', 'rm', 'touch', 'set', 'true', 'pushd', 'popd', 'unset', 'source', '.'].includes(basename(P[0][0] || ''))).length;
    for (const P of pipes) {
      const r = classify(P), named = P[0].slice(1).map(a => basename(a)).filter(a => a === ENGINE || MANUALS.includes(a));
      if (!r) continue;   // (not a read)
      if (r.how === 'search' && !named.length) { c.grep = cmd; continue; }   // (a folder's: its result says which manuals)
      for (const f of named) {
        c.reads++;
        if (f === ENGINE) { if (r.how === 'search') out.searches.push(cmd.slice(0, 200)); else engineRead(c, { how: 'shell', cmd: cmd.slice(0, 200), from: r.from || 1, to: r.how === 'whole' || r.to === null ? Infinity : r.to }); continue; }
        readMan(c, f, r.how, 'shell', { cmd: cmd.slice(0, 200), from: r.from, to: r.to, grep: r.grep, cap: r.cap, tailN: r.tailN });
      }
    }
  };
  // what a tool's result held: its lines and tokens; a Read cut short (the tool's cap, or fewer lines than asked); a folder
  // search's hits in the manuals
  // a read's lines and tokens from the manual's own text (o.files), when its result is shared with other reads
  const fromFile = m => {
    const text = (o.files || {})[m.file]; if (text === undefined) { m.lines = 0; m.tokens = 0; return; }
    const L = text.split('\n'); let got;
    if (m.how === 'whole') got = L;
    else if (m.how === 'range') { const a = m.tailN ? Math.max(1, L.length - m.tailN + 1) : m.from || 1, b = m.tailN ? L.length : m.to || L.length; m.from = a; m.to = b; got = L.slice(a - 1, b); }
    else { got = grepLines(text, m.grep); if (m.cap) got = got.slice(0, m.cap); }
    m.lines = got.length; m.tokens = tokens(got.join('\n'));
  };
  const result = (id, content, isError) => {
    const c = byId.get(id); if (!c) return;
    const t = typeof content === 'string' ? content : Array.isArray(content) ? content.map(x => x && x.type === 'text' ? x.text : '').join('\n') : '';
    if (c.grep) { for (const f of MANUALS) { const re = new RegExp('(^|/)' + f.replace(/[.]/g, '\\.') + '(:|$)'), hits = t.split('\n').filter(l => re.test(l)); if (hits.length) readMan(c, f, 'search', c.grep.startsWith('Grep ') ? 'Grep' : 'shell', { cmd: c.grep.slice(0, 200), lines: hits.length, tokens: tokens(hits.join('\n')) }); } return; }
    // a shell call that read several things: each read's share from the file itself (its range, its search's hits)
    if (c.manuals.length > 1 || (c.manuals.length && (c.reads > 1 || c.prints > 1))) { for (const m of c.manuals) if (m.lines === null) fromFile(m); return; }
    const m = c.manuals[0]; if (!m || m.lines !== null) return;
    const lines = t ? t.replace(/\n$/, '').split('\n') : [];
    m.lines = isError ? 0 : lines.length; m.tokens = tokens(t);
    if (m.tool === 'Read') {
      const nums = lines.map(l => (/^\s*(\d+)(?:\t|→)/.exec(l) || [])[1]).filter(Boolean).map(Number), last = nums.length ? Math.max(...nums) : 0, total = (o.lines || {})[m.file];
      m.lines = nums.length || m.lines; if (nums.length) { m.from = m.from || Math.min(...nums); m.to = last; }
      m.cut = /exceeds maximum allowed tokens|maximum allowed tokens|use offset and limit|truncated/i.test(t) || (m.how === 'whole' && !!total && last > 0 && last < total);
    }
  };
  for (const line of text.split('\n')) {
    let e; try { e = JSON.parse(line); } catch (err) { continue; }
    if (e.type === 'system' && e.subtype === 'init') out.agent = 'claude';
    if (e.type === 'assistant' && e.message) {
      for (const c of e.message.content || []) if (c.type === 'tool_use') {
        const i = c.input || {}, man = manual(i.file_path) || manual(i.path);
        if (c.name === 'Bash') { shell(c.id, i.command); continue; }
        const k = call(c.id);
        if ((c.name === 'Read' || c.name === 'View') && engine(i.file_path)) { const from = i.offset || 1, to = from + (i.limit || 2000) - 1; engineRead(k, { how: 'read', from, to }); }
        else if ((c.name === 'Read' || c.name === 'View') && man) readMan(k, man, i.offset || i.limit ? 'range' : 'whole', 'Read', i.offset || i.limit ? { from: i.offset || 1, to: (i.offset || 1) + (i.limit || 2000) - 1 } : {});
        else if ((c.name === 'Edit' || c.name === 'Write' || c.name === 'MultiEdit') && engine(i.file_path)) out.patched = true;
        else if (c.name === 'Grep' && (engine(i.path) || /my-3d2dge\.js/.test(i.glob || ''))) out.searches.push('Grep ' + (i.pattern || ''));
        else if (c.name === 'Grep' && (man || MANUALS.some(f => (i.glob || '').includes(f)))) readMan(k, man || MANUALS.find(f => (i.glob || '').includes(f)), 'search', 'Grep', { cmd: 'Grep ' + (i.pattern || '') });
        else if (c.name === 'Grep') k.grep = 'Grep ' + (i.pattern || '');   // (a folder: the result says which manuals it hit)
      }
    }
    if (e.type === 'user' && e.message && Array.isArray(e.message.content)) for (const c of e.message.content) if (c && c.type === 'tool_result') result(c.tool_use_id, c.content, c.is_error);
    // a result ends each turn of the session: an agent woken again (its background tasks or subagents finishing) sends
    // more than one. usage is that turn's alone; modelUsage and the cost run for the whole session, subagents included.
    if (e.type === 'result') { out.agent = out.agent || 'claude'; const u = e.usage || {}, m = Object.values(e.modelUsage || {}), sum = k => m.reduce((n, x) => n + (x[k] || 0), 0);
      if (m.length) { out.outputTokens = sum('outputTokens'); out.inputTokens = sum('inputTokens') + sum('cacheReadInputTokens') + sum('cacheCreationInputTokens'); }
      else { out.outputTokens += u.output_tokens || 0; out.inputTokens += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0); }
      out.costUsd = e.total_cost_usd ?? out.costUsd; out.turns += e.num_turns || 0; out.ms = (out.ms || 0) + (e.duration_ms || 0); out.result = String(e.result || '').slice(0, 2000);
      if (e.is_error) out.error = (e.api_error || e.subtype || 'error') + ': ' + out.result.slice(0, 160); }   // cut off (a usage limit, a budget): the build is unfinished
    // codex exec --json: item events with commands and file changes, turn.completed with usage
    if (e.type === 'thread.started') out.agent = 'codex';
    if (e.type === 'item.completed' && e.item) {
      const it = e.item;
      if (it.type === 'command_execution') { const id = it.id || 'codex-' + calls.length; shell(id, it.command); if (it.aggregated_output !== undefined) result(id, String(it.aggregated_output)); }
      if (it.type === 'file_change') for (const ch of it.changes || []) if (engine(ch.path)) out.patched = true;
      if (it.type === 'agent_message') out.result = String(it.text || '').slice(0, 2000);
    }
    if (e.type === 'turn.completed' && e.usage) { out.turns++; out.outputTokens += e.usage.output_tokens || 0; out.inputTokens += (e.usage.input_tokens || 0) + (e.usage.cached_input_tokens || 0); }
  }
  // an engine read below the header right after a search of the index (in the three calls before it): the index didn't answer
  const indexSearch = c => c.manuals.find(m => m.file === INDEX && m.how === 'search');
  for (const c of calls) if (c.below) c.below.afterIndexSearch = calls.slice(Math.max(0, c.at - 3), c.at).some(indexSearch);
  for (const c of calls) { const m = indexSearch(c); if (m) m.thenSource = calls.slice(c.at + 1, c.at + 4).some(x => x.below); }
  out.index = indexReads(out.manuals, (o.lines || {})[INDEX]);
  return out;
}

/** the index's reads in sum: by search, range and whole (how many, their tokens), how much of it the ranges and whole reads
 *  covered, how many searches a read of the source followed; and whether that trips the split rule (D38: a whole read,
 *  ranges over most of it, or more than a third of its searches followed by the source; two runs in a row reopen it, D43) */
export function indexReads(manuals, total) {
  const ix = manuals.filter(m => m.file === INDEX), by = how => { const l = ix.filter(m => m.how === how); return { n: l.length, tokens: l.reduce((a, m) => a + (m.tokens || 0), 0) }; };
  const seen = new Set();
  for (const m of ix) if (m.how !== 'search') { const a = m.how === 'whole' && !m.cut ? 1 : m.from || 1, b = m.how === 'whole' && !m.cut ? total || 0 : m.to || a; for (let k = a; k <= b; k++) seen.add(k); }
  const s = ix.filter(m => m.how === 'search'), after = s.filter(m => m.thenSource).length, coverage = total ? Math.min(1, seen.size / total) : null;
  const whole = ix.some(m => m.how === 'whole'), trips = whole || (coverage !== null && coverage > .5) || (s.length > 0 && after / s.length > 1 / 3);
  return { search: by('search'), range: by('range'), whole: by('whole'), cut: ix.filter(m => m.cut).length, coverage, searchesThenSource: after, tripsSplit: trips };
}

/** the size of the game an agent wrote: characters and estimated cl100k tokens of game/'s code, its tests apart (dense
 *  game code runs about 2.65 characters a token, measured on the starters and on a benchmark's game) */
export function codeSize(dir) {
  const out = { chars: 0, testChars: 0, tokens: 0, testTokens: 0 };
  const walk = d => { for (const f of existsSync(d) ? readdirSync(d, { withFileTypes: true }) : []) {
    if (f.isDirectory()) { if (f.name !== 'node_modules') walk(join(d, f.name)); continue; }
    if (!/\.(m?js|html|css)$/.test(f.name)) continue;
    const n = readFileSync(join(d, f.name), 'utf8').length; if (/test/i.test(f.name)) out.testChars += n; else out.chars += n;
  } };
  walk(dir); out.tokens = Math.round(out.chars / 2.65); out.testTokens = Math.round(out.testChars / 2.65); return out;
}

/** the judge's answer: the first {"score": n, ...} in its text */
export const readJudge = text => { const m = String(text).match(/\{[^{}]*"score"\s*:\s*(\d+(?:\.\d+)?)[^{}]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch (e) { return { score: +m[1] }; } };

const briefs = () => readdirSync(join(BENCH, 'briefs')).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3));
function brief(name) {
  const f = existsSync(name) ? name : join(BENCH, 'briefs', name + '.md');
  if (!existsSync(f)) throw new Error('no brief "' + name + '". Briefs: ' + briefs().join(', '));
  return readFileSync(f, 'utf8');
}
/** the environment an agent (and the judge) starts with: this machine's, without the variables of a Claude Code session
 *  that runs the bench (CLAUDECODE, CLAUDE_CODE_SESSION_ID, its effort, its messaging...), so a run started from inside
 *  one is a fresh session of its own and not a part of that one; a cloud session's sign-in is kept */
const AUTH = ['CLAUDE_SESSION_INGRESS_TOKEN_FILE', 'CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST'];
export const childEnv = (env = process.env) => { const out = {}; for (const [k, v] of Object.entries(env)) if (!/^CLAUDE/.test(k) || AUTH.includes(k)) out[k] = v; out.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1'; return out; };
const run = (cmd, a, o = {}) => spawnSync(cmd, a, Object.assign({ encoding: 'utf8', maxBuffer: 1 << 28, env: childEnv() }, o));
const agentCmd = (agent, prompt, o) => agent === 'codex'
  ? ['codex', ['exec', '--json', '--skip-git-repo-check', '--dangerously-bypass-approvals-and-sandbox', ...(o.model ? ['-m', o.model] : []), prompt]]
  : ['claude', ['-p', prompt, '--safe-mode', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'bypassPermissions', '--no-session-persistence', '--max-budget-usd', String(o.budget), ...(o.model ? ['--model', o.model] : [])]];

/** score a run directory: the stream, the game's check and test, the judge */
function score(dir, o = {}) {
  const work = join(dir, 'work'), meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const lines = {}, files = {}; for (const f of MANUALS) { const p = [join(work, f), join(work, 'docs', f)].find(existsSync); if (p) { files[f] = readFileSync(p, 'utf8'); lines[f] = files[f].replace(/\n$/, '').split('\n').length; } }
  const s = readStream(existsSync(join(dir, 'stream.jsonl')) ? readFileSync(join(dir, 'stream.jsonl'), 'utf8') : '', meta.header, { lines, files });
  const page = join(work, 'game/index.html'), res = Object.assign({ brief: meta.brief, agent: meta.agent, model: meta.model || 'default', wallSeconds: meta.wallSeconds || (s.ms ? s.ms / 1000 : null) }, s);
  res.game = existsSync(page) && hash(join(work, 'game/game.js')) !== meta.template;   // (the package's template game alone is not a build)
  res.code = codeSize(join(work, 'game'));
  if (res.game) {
    const c = run(process.execPath, [join(root, 'tools/check.mjs'), page, '--out', join(dir, 'check')], { cwd: root });
    let rep = null; try { rep = JSON.parse(readFileSync(join(dir, 'check/report.json'), 'utf8')); } catch (e) { /* no report */ }
    res.checkPasses = c.status === 0 && !!rep && rep.scenes.concat(rep.views).some(x => x.filled > .1);
    res.checkErrors = rep ? rep.errors.slice(0, 5) : [(c.stderr || '').slice(0, 300)];
    const t = existsSync(join(work, 'game/test.mjs')) ? run(process.execPath, [join(work, 'game/test.mjs')], { cwd: work, timeout: 120000 }) : null;
    res.testPasses = t ? t.status === 0 : null;
    const shots = rep ? rep.scenes.concat(rep.views).map(x => x.screenshot).filter(f => f && existsSync(f)).slice(-5) : [];
    const before = o.noJudge && existsSync(join(dir, 'result.json')) ? JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8')) : null;
    if (before && before.judge) Object.assign(res, { judge: before.judge, judgeCostUsd: before.judgeCostUsd });   // (--rescore --no-judge keeps the judge's score)
    if (shots.length && !o.noJudge) {
      const prompt = readFileSync(join(BENCH, 'judge.md'), 'utf8') + '\n\nThe screenshots: ' + shots.join(', ');
      const j = run('claude', ['-p', prompt, '--safe-mode', '--output-format', 'json', '--allowedTools', 'Read', '--permission-mode', 'dontAsk', '--no-session-persistence', '--add-dir', join(dir, 'check'), ...(o.judgeModel ? ['--model', o.judgeModel] : [])], { cwd: dir, timeout: 600000 });
      let txt = j.stdout; try { txt = JSON.parse(j.stdout).result; } catch (e) { /* plain text */ }
      res.judge = readJudge(txt); if (!res.judge) res.judgeError = String(txt || j.stderr || 'no answer').slice(0, 300); res.judgeCostUsd = (() => { try { return JSON.parse(j.stdout).total_cost_usd; } catch (e) { return null; } })();
    }
  }
  writeFileSync(join(dir, 'result.json'), JSON.stringify(res, null, 2));
  return res;
}
const row = r => `| ${r.brief} | ${r.agent} ${r.model} | ${r.code ? '~' + Math.round(r.code.tokens / 100) / 10 + 'k (+' + Math.round(r.code.testTokens / 100) / 10 + 'k tests)' : '-'} | ${Math.round(r.outputTokens / 100) / 10}k | ${r.wallSeconds ? Math.round(r.wallSeconds / 60) + ' min' : '?'} | ${r.costUsd !== null && r.costUsd !== undefined ? '$' + r.costUsd.toFixed(2) : '?'} | ${r.game ? (r.checkPasses ? 'yes' : 'no') : 'no game (the template unchanged)'}${r.error ? ' (cut off: ' + r.error.split(':')[0] + ')' : ''} | ${r.belowHeader ? 'yes' : 'no'}${r.patched ? ', patched it' : ''} | ${indexCell(r.index)} | ${r.judge ? r.judge.score + '/10' : '-'} |`;
const k = n => n >= 1000 ? Math.round(n / 100) / 10 + 'k' : String(n);
/** the index's column: searches / ranges / whole reads (their tokens), and what followed */
const indexCell = x => !x ? '-' : `${x.search.n} / ${x.range.n} / ${x.whole.n} (${k(x.search.tokens)} / ${k(x.range.tokens)} / ${k(x.whole.tokens)})${x.cut ? `, ${x.cut} cut short` : ''}${x.search.n ? `; ${x.searchesThenSource} of ${x.search.n} searches then read the source` : ''}${x.tripsSplit ? '; trips the split rule' : ''}`;
const HEAD = '| brief | agent | game code | output tokens (thinking included) | wall time | cost | first build passes check | read the engine below its header | the index read by search / range / whole (tokens) | judge (PS1/N64 bar) |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';

function selftest() {
  let fails = 0; const ok = (name, c, d = '') => { if (!c) fails++; console.log((c ? '  ok   ' : '  FAIL ') + name + (c ? '' : ': ' + d)); };
  const S = (...ev) => ev.map(e => JSON.stringify(e)).join('\n'), use = (name, input) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } });
  const header = headerEnd('/* a */\n/* b */\n(function (root) {\ncode');
  ok('the header ends at the IIFE', header === 2, String(header));
  let s = readStream(S({ type: 'system', subtype: 'init' }, use('Read', { file_path: '/w/my-3d2dge.js', limit: 60 }), use('Bash', { command: 'rg -n "ledge" my-3d2dge.js' }),
    { type: 'result', usage: { output_tokens: 1234, input_tokens: 10, cache_read_input_tokens: 90 }, total_cost_usd: .5, num_turns: 7, duration_ms: 9000, result: 'done' }), 70);
  ok('claude: tokens, cost, turns', s.agent === 'claude' && s.outputTokens === 1234 && s.inputTokens === 100 && s.costUsd === .5 && s.turns === 7, JSON.stringify(s));
  ok('claude: reading the header and searching is not reading below it', !s.belowHeader && s.searches.length === 1 && !s.patched, JSON.stringify(s));
  s = readStream(S(use('Read', { file_path: '/w/my-3d2dge.js' })), 70);
  ok('a Read with no range reads below the header', s.belowHeader);
  s = readStream(S(use('Read', { file_path: '/w/my-3d2dge.js', offset: 3000, limit: 50 })), 70);
  ok('a Read at an offset below the header', s.belowHeader);
  s = readStream(S(use('Bash', { command: "sed -n '1,60p' my-3d2dge.js" }), use('Bash', { command: 'head -n 50 my-3d2dge.js' })), 70);
  ok('sed and head inside the header are not', !s.belowHeader && s.reads.length === 2, JSON.stringify(s.reads));
  s = readStream(S(use('Bash', { command: "sed -n '2400,2460p' my-3d2dge.js" })), 70);
  ok('sed below the header is', s.belowHeader);
  s = readStream(S(use('Bash', { command: "cat > /tmp/t.mjs <<'EOF'\nreadFileSync('my-3d2dge.js')\nEOF\nnode /tmp/t.mjs" }), use('Bash', { command: 'node -e "require(\'fs\').readFileSync(\'my-3d2dge.js\')"' })), 70);
  ok('a script that loads the engine is not a read of it', !s.belowHeader && !s.reads.length, JSON.stringify(s.reads));
  s = readStream(S(use('Edit', { file_path: '/w/my-3d2dge.js', old_string: 'a', new_string: 'b' })), 70);
  ok('an Edit of the engine is a patch', s.patched);
  s = readStream(S({ type: 'thread.started' }, { type: 'item.completed', item: { type: 'command_execution', command: 'cat my-3d2dge.js' } }, { type: 'turn.completed', usage: { output_tokens: 500, input_tokens: 9 } }), 70);
  ok('codex: commands and usage', s.agent === 'codex' && s.belowHeader && s.outputTokens === 500 && s.turns === 1, JSON.stringify(s));
  s = readStream(S({ type: 'result', usage: { output_tokens: 900 }, modelUsage: { a: { outputTokens: 1200, inputTokens: 5 } }, total_cost_usd: 1, num_turns: 9, duration_ms: 1000 },
    { type: 'result', usage: { output_tokens: 50 }, modelUsage: { a: { outputTokens: 1250, inputTokens: 6 } }, total_cost_usd: 1.1, num_turns: 2, duration_ms: 500 }), 70);
  ok('claude woken again: the session\'s tokens, subagents included, and every turn', s.outputTokens === 1250 && s.costUsd === 1.1 && s.turns === 11 && s.ms === 1500, JSON.stringify(s));
  s = readStream(S({ type: 'result', is_error: true, api_error: 'usage_limit_reached', result: 'limit', num_turns: 3 }), 70);
  ok('a run cut off by an API error says so', /^usage_limit_reached/.test(s.error), String(s.error));
  // the manuals: each read classed whole, range or search, with what its result held
  const useId = (id, name, input) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input }] } });
  const res = (id, content, is_error) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content, is_error }] } });
  const numbered = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => String(a + k).padStart(6) + '\t- `x' + (a + k) + '`: a line').join('\n');
  s = readStream(S(useId('a', 'Grep', { pattern: 'ledge', path: '/w/API-INDEX.md', output_mode: 'content' }), res('a', '672:- `map.ledge(from, dir)`: a ledge\n885:- `mover.climb = true`: climbs ledges'),
    useId('b', 'Read', { file_path: '/w/API-INDEX.md', offset: 600, limit: 40 }), res('b', numbered(600, 639)),
    useId('c', 'Read', { file_path: '/w/API.md' }), res('c', numbered(1, 210))), 70, { lines: { 'API-INDEX.md': 1000, 'API.md': 210 } });
  const [g, rg, w] = s.manuals;
  ok('a Grep of the index is a search, with its hits\' lines and tokens', g && g.file === 'API-INDEX.md' && g.how === 'search' && g.lines === 2 && g.tokens > 10, JSON.stringify(g));
  ok('a Read with a range is a range, from and to', rg && rg.how === 'range' && rg.from === 600 && rg.to === 639 && rg.lines === 40 && !rg.cut, JSON.stringify(rg));
  ok('a Read of a whole manual is whole, not cut when every line came back', w && w.file === 'API.md' && w.how === 'whole' && !w.cut && w.lines === 210, JSON.stringify(w));
  ok('the index in sum: 1 search, 1 range, no whole read; 4% covered', s.index.search.n === 1 && s.index.range.n === 1 && s.index.whole.n === 0 && Math.abs(s.index.coverage - .04) < 1e-9 && !s.index.tripsSplit, JSON.stringify(s.index));
  s = readStream(S(useId('a', 'Read', { file_path: '/w/API-INDEX.md' }), res('a', numbered(1, 445) + '\n\n[File truncated: the file is 49996 tokens, more than the maximum allowed tokens (25000) for one read. Use offset and limit to read the rest.]')), 70, { lines: { 'API-INDEX.md': 1047 } });
  ok('a whole Read the tool cut short says so, and trips the split rule', s.manuals[0].how === 'whole' && s.manuals[0].cut && s.manuals[0].lines === 445 && s.index.whole.n === 1 && s.index.cut === 1 && s.index.tripsSplit, JSON.stringify(s.manuals[0]));
  s = readStream(S(useId('a', 'Read', { file_path: '/w/API-INDEX.md' }), res('a', numbered(1, 300))), 70, { lines: { 'API-INDEX.md': 1047 } });
  ok('a whole Read that came back with fewer lines than the file is cut', s.manuals[0].cut, JSON.stringify(s.manuals[0]));
  s = readStream(S(useId('a', 'Bash', { command: 'cat API-INDEX.md | head -n 200' }), res('a', 'x\n'.repeat(200)), useId('b', 'Bash', { command: "sed -n '300,420p' API-INDEX.md" }), res('b', 'y\n'.repeat(121)),
    useId('c', 'Bash', { command: 'grep -n "stamina\\|meter" API-INDEX.md' }), res('c', '1065:- bars\n1084:- E.ui'), useId('d', 'Bash', { command: 'cat AI_GUIDE.md' }), res('d', 'z\n'.repeat(50))), 70, { lines: { 'API-INDEX.md': 1000 } });
  ok('cat | head, sed -n and grep of the index: range, range, search; cat of a manual: whole', s.manuals.map(m => m.file + ':' + m.how).join(' ') === 'API-INDEX.md:range API-INDEX.md:range API-INDEX.md:search AI_GUIDE.md:whole', s.manuals.map(m => m.file + ':' + m.how).join(' '));
  ok('ranges cover what they read: 1-200 and 300-420, 321 of 1,000 lines (most of it would trip the split rule)', Math.abs(s.index.coverage - .321) < 1e-9 && !s.index.tripsSplit, JSON.stringify(s.index));
  const IX = Array.from({ length: 100 }, (_, k) => '- `x' + (k + 1) + '`: ' + (k % 10 === 0 ? 'climb a ledge' : 'a line')).join('\n');
  s = readStream(S(useId('a', 'Bash', { command: 'cd /w; cat API.md; wc -l game/* AI_GUIDE.md API-INDEX.md' }), res('a', 'card\n 100 API-INDEX.md'),
    useId('b', 'Bash', { command: 'cd /w; grep -n -i "climb\\|glide" API-INDEX.md | head -4; head -40 API-INDEX.md; sed -n 50,59p API-INDEX.md' }), res('b', 'mixed output')), 70, { lines: { 'API-INDEX.md': 100 }, files: { 'API-INDEX.md': IX, 'API.md': 'card' } });
  ok('a chain: cat a manual is whole, wc is no read; grep | head a search, head and sed ranges, each from the file itself', s.manuals.map(m => m.file + ':' + m.how + ':' + m.lines).join(' ') === 'API.md:whole:1 API-INDEX.md:search:4 API-INDEX.md:range:40 API-INDEX.md:range:10', s.manuals.map(m => m.file + ':' + m.how + ':' + m.lines).join(' '));
  ok('their tokens are what the file gives them, and the coverage the ranges\' lines', s.manuals[2].tokens > s.manuals[3].tokens * 3 && Math.abs(s.index.coverage - .5) < 1e-9 && !s.index.tripsSplit, JSON.stringify(s.index));
  s = readStream(S(useId('a', 'Bash', { command: 'grep -n "jump" API-INDEX.md | head -20' }), res('a', '1: jump\n2: jump')), 70);
  ok('grep ... | head is a search, its output trimmed', s.manuals.length === 1 && s.manuals[0].how === 'search' && s.manuals[0].lines === 2, JSON.stringify(s.manuals));
  s = readStream(S(useId('a', 'Bash', { command: 'grep -rn "takedown" .' }), res('a', './API-INDEX.md:817:- `E.ACTIONS`: takedown\n./API.md:168:- Mover: takedown\n./game/game.js:12: takedown')), 70);
  ok('a search of a folder counts for each manual it hit, by its result', s.manuals.map(m => m.file + ':' + m.how + ':' + m.lines).join(' ') === 'API-INDEX.md:search:1 API.md:search:1', JSON.stringify(s.manuals));
  s = readStream(S(useId('a', 'Grep', { pattern: 'Attack', path: '/w/API-INDEX.md' }), res('a', '550:- `new E.Attack`'), useId('b', 'Read', { file_path: '/w/game/game.js' }), res('b', 'code'),
    useId('c', 'Read', { file_path: '/w/my-3d2dge.js', offset: 3800, limit: 80 }), res('c', 'source'), useId('d', 'Grep', { pattern: 'ledge', path: '/w/API-INDEX.md' }), res('d', '672: ledge'),
    useId('e', 'Read', { file_path: '/w/README.md' }), res('e', 'r'), useId('f', 'Read', { file_path: '/w/game/index.html' }), res('f', 'h'), useId('g', 'Read', { file_path: '/w/game/test.mjs' }), res('g', 't'),
    useId('h', 'Bash', { command: "sed -n '4100,4180p' my-3d2dge.js" }), res('h', 'source')), 70);
  ok('a read of the source within three calls of an index search is a lookup it missed; one later is not', s.reads.length === 2 && s.reads[0].afterIndexSearch === true && s.reads[1].afterIndexSearch === false, JSON.stringify(s.reads));
  ok('so 1 of 2 index searches then read the source: over a third trips the split rule', s.index.search.n === 2 && s.index.searchesThenSource === 1 && s.index.tripsSplit, JSON.stringify(s.index));
  ok('a game\'s own README is not a manual', !readStream(S(useId('a', 'Read', { file_path: '/w/game/README.md' })), 70).manuals.length);
  ok('the row\'s index column', indexCell(indexReads([{ file: 'API-INDEX.md', how: 'search', tokens: 1200 }, { file: 'API-INDEX.md', how: 'search', tokens: 300, thenSource: true }, { file: 'API-INDEX.md', how: 'range', tokens: 2100, from: 1, to: 40 }], 1000)) === '2 / 1 / 0 (1.5k / 2.1k / 0); 1 of 2 searches then read the source; trips the split rule',
    indexCell(indexReads([{ file: 'API-INDEX.md', how: 'search', tokens: 1200 }, { file: 'API-INDEX.md', how: 'search', tokens: 300, thenSource: true }, { file: 'API-INDEX.md', how: 'range', tokens: 2100, from: 1, to: 40 }], 1000)));
  const ce = childEnv({ PATH: '/bin', HOME: '/h', ANTHROPIC_BASE_URL: 'u', CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 's', CLAUDE_EFFORT: 'max', CLAUDE_CODE_REMOTE: 'true', CLAUDE_SESSION_INGRESS_TOKEN_FILE: 't', CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST: '1' });
  ok('the agent starts without the calling session\'s variables, its sign-in kept', ce.PATH && ce.ANTHROPIC_BASE_URL && ce.CLAUDE_SESSION_INGRESS_TOKEN_FILE && ce.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST && !ce.CLAUDECODE && !ce.CLAUDE_CODE_SESSION_ID && !ce.CLAUDE_EFFORT && !ce.CLAUDE_CODE_REMOTE, JSON.stringify(ce));
  ok('the judge\'s score is read from its text', readJudge('Here: {"score": 6, "why": "flat floors"} done').score === 6 && readJudge('no score') === null);
  ok('every brief exists and asks for game/index.html', briefs().length >= 3 && briefs().every(b => /game\/index\.html/.test(brief(b))), briefs().join(','));
  console.log(fails ? `\n${fails} failed` : '\nall passed'); process.exit(fails ? 1 : 0);
}

if (resolve(process.argv[1] || '') !== fileURLToPath(import.meta.url)) { /* imported (readStream, codeSize, readJudge): no command line */ }
else if (flag('selftest')) selftest();
else if (flag('list')) console.log(briefs().join('\n'));
else if (opt('rescore')) { const r = score(resolve(opt('rescore')), { judgeModel: opt('judge-model'), noJudge: flag('no-judge') }); console.log(HEAD + '\n' + row(r)); }
else {
  const name = opt('brief'); if (!name) { console.error('Usage: node tools/agent-bench.mjs --brief <' + briefs().join('|') + '> [--agent claude|codex] [--model M] [--budget 30] [--dry-run]'); process.exit(2); }
  const agent = opt('agent', 'claude'), model = opt('model'), budget = +opt('budget', 30), text = brief(name);
  if (!existsSync(join(root, 'dist/handoff/' + ENGINE))) { console.error('no dist/handoff/: run node tools/build.mjs'); process.exit(2); }
  const dir = join(resolve(opt('runs', join(homedir(), '.cache/my-3d2dge-bench'))), `${basename(name, '.md')}-${agent}-${new Date().toISOString().replace(/[:.]/g, '-')}`), work = join(dir, 'work');
  if (dir.startsWith(root)) { console.error('the run directory must be outside the repository (an agent there would read its CLAUDE.md and AGENTS.md)'); process.exit(2); }
  mkdirSync(work, { recursive: true }); cpSync(join(root, 'dist/handoff'), work, { recursive: true });
  const header = headerEnd(readFileSync(join(work, ENGINE), 'utf8')), [cmd, a] = agentCmd(agent, text, { model, budget });
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({ brief: name, agent, model, budget, header, template: hash(join(work, 'game/game.js')), cmd: [cmd, ...a.map(x => x === text ? '<brief>' : x)] }, null, 2));
  console.log(`run: ${dir}\nworkspace: ${work} (the handoff package; header ends at line ${header})\nagent: ${cmd} ${a.map(x => x === text ? '<brief>' : x).join(' ')}`);
  if (flag('dry-run')) { console.log('dry run: nothing started, nothing spent'); process.exit(0); }
  const t0 = Date.now(), log = createWriteStream(join(dir, 'stream.jsonl'));   // (written as it comes: tail it to watch a run)
  const child = spawn(cmd, a, { cwd: work, stdio: ['ignore', 'pipe', 'pipe'], env: childEnv() });
  child.stdout.pipe(log); child.stderr.on('data', d => process.stderr.write(d));
  child.on('close', code => log.end(() => {
    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')); meta.wallSeconds = (Date.now() - t0) / 1000; meta.exit = code; writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
    const r = score(dir, { judgeModel: opt('judge-model') });
    console.log('\n' + HEAD + '\n' + row(r) + '\n\nresult: ' + join(dir, 'result.json'));
  }));
}
