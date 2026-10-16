// Determinism under the harness (DOCTRINE.md, principle 5; docs/DECISIONS.md, D4). Each case plays a fight twice through
// tools/filmstrip.mjs --seed (a virtual clock of exact 1/60 s frames, a seeded Math.random, no sound, controller or GPU)
// and the two runs must match pixel for pixel. A difference means the game read time or randomness the harness doesn't
// control (crypto, a real-time clock outside the loop, an event from outside the page): find it before it costs an agent
// a bug that won't reproduce. Usage: node tools/determinism-test.mjs   (run node tools/build.mjs first; CHROMIUM_PATH
// picks a browser). Exit code 1 on a difference. The strips: check-output/determinism/<case>.png (run A, run B, and A
// dimmed with the differing pixels in magenta).
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const ed = code => `eval:{ const e = window.__ed, h = e.ED.hero; ${code} }`;
const CASES = [   // [name, page, steps (' | ' between them), seed]
  // Emberdeep: a pack spawned beside the hero on depth 3 (AI, combat rolls, loot, particles, a perfect dodge's slow motion)
  ['emberdeep', 'examples/emberdeep.html#depth-3', ['wait:3500', ed('e.spawnPack(h.x + 44, h.y + 10, { n: 6, instant: true });'), 'wait:300', 'rec:24:10',
    ed('e.useSlot(h, 0);'), 'wait:700', ed('e.useSlot(h, 0);'), 'wait:700', ed('e.useSlot(h, 1);'), 'wait:900', 'press:Space', 'wait:600', ed('e.useSlot(h, 0);'), 'wait:2000'], 7],
  // a starter game, what models copy: the brawler slice's thugs walk in and trade blows with the hero
  ['brawler', 'dist/my-3d2dge.html#brawler', ['wait:1500', 'press:Enter', 'wait:800', 'rec:16:6', 'down:ArrowRight', 'wait:900', 'up:ArrowRight',
    'press:KeyJ', 'wait:200', 'press:KeyJ', 'wait:200', 'press:KeyJ', 'wait:900', 'press:KeyK', 'wait:1200'], 3]
];

mkdirSync('check-output/determinism', { recursive: true });
const failed = [];
for (const [name, page, steps, seed] of CASES) {
  console.log(`\n${name}: ${page}, seed ${seed}, recorded twice`);
  const r = spawnSync('node', ['tools/filmstrip.mjs', page, '--seed', String(seed), '--steps', steps.join(' | '), '--compare', page,
    '--out', `check-output/determinism/${name}.png`, '--scale', '1', '--expect-same'], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(name);
}
console.log(failed.length ? `\nFAILED: ${failed.join(', ')} played differently with the same seed and steps` : '\nall passed: the same seed and steps give the same pixels');
process.exit(failed.length ? 1 : 0);
