// Shared by the animation tools: the readable format (the same src/mocap/readable.js the browser runs), and reading
// and writing animation set files (src/mocap/sets/*.js).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import vm from 'node:vm';

const run = (file, sandbox) => { vm.runInNewContext(readFileSync(file, 'utf8'), sandbox, { filename: String(file) }); return sandbox; };
/** the readable format's codec (MocapReadable) */
export const MR = run(new URL('../src/mocap/readable.js', import.meta.url), {}).MocapReadable;

/** a set file -> its object (the file assigns window.MOCAP[name]) */
export function readSet(file) {
  const sb = run(file, { window: {} }), sets = sb.window.MOCAP || {}, names = Object.keys(sets);
  if (names.length !== 1) throw new Error(file + ' should define one set (found ' + names.length + ')');
  return sets[names[0]];
}

/** a set as a readable script: a header with the legend, then each clip as its header line and three lines per key pose */
export function writeSet(s, out) {
  const head = Object.entries(s).filter(([k]) => k !== 'clips').map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n');
  const clips = Object.entries(s.clips).map(([n, c]) => JSON.stringify(n) + ': ' + MR.text(c)).join(',\n\n');
  const keys = Object.values(s.clips).reduce((t, c) => t + c.keys.length, 0);
  const js = `/* ${s.set}: an animation set in my-3D2dge's readable format (written by the tools in tools/; clips may be edited by hand).
 * ${s.credit}
 * ${Object.keys(s.clips).length} clips, ${keys} key poses. Played by src/mocap/mocap.js with src/mocap/readable.js. "sources" holds the proportions
 * each library was measured with; "fit" each clip's average and worst body-point error against its capture (mm).
${MR.LEGEND.split('\n').map(l => ' * ' + l.replace(/^\/\/ ?/, '')).join('\n')}
 */
(window.MOCAP = window.MOCAP || {})[${JSON.stringify(s.set)}] = {
${head},
"clips": {
${clips}
}};
`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, js);
  return { clips: Object.keys(s.clips).length, keys, kb: js.length / 1024 };
}
