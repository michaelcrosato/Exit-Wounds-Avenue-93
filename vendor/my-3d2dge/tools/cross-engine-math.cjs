// Cross-engine check of the portable math (engine section 23; docs/DECISIONS.md D15). Runs the same code in V8 (Node) and in
// JavaScriptCore, Safari's engine (through Bun), and compares the bits: 2.8 million results of each engine's native Math
// and of the portable math, and a Humanoid rig animated for 3,000 steps (joints and cape) with each. The portable results
// must be the same in both engines; the native ones show why they are needed.
//   node tools/cross-engine-math.cjs        needs Bun: BUN=/path/to/bun, or bun on the PATH (npm i -g bun, or npx bun)
// Exit code 1 when the portable math or the rig differs between the engines; 0 with a note when no Bun is found.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'engine', 'my-3d2dge.js'), 'utf8');
const a = src.indexOf('const PORTABLE_MATH = (() => {'), b = src.indexOf('})();', a) + 5;
const PM = new Function(src.slice(a, b) + '\nreturn PORTABLE_MATH;')();
const NATIVE = {}, RANDOM = Math.random; for (const k in PM) NATIVE[k] = Math[k];
const F = new Float64Array(1), U = new Uint32Array(F.buffer);
let h = 0;
const mix = v => { F[0] = v; for (const w of [U[0], U[1]]) { h ^= w; h = Math.imul(h, 16777619) >>> 0; } };
let seed = 7; const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
function mathHash(M) {
  h = 2166136261; seed = 7;
  for (let i = 0; i < 200000; i++) {
    const x = (rnd() - .5) * 2000, y = (rnd() - .5) * 20, u = rnd() * 2 - 1, p = rnd() * 50 + 1e-9;
    mix(M.sin(x)); mix(M.cos(x)); mix(M.tan(y)); mix(M.atan(y)); mix(M.atan2(x, y)); mix(M.asin(u)); mix(M.acos(u));
    mix(M.exp(y)); mix(M.log(p)); mix(M.log2(p)); mix(M.log10(p)); mix(M.pow(p, y * .1)); mix(M.hypot(x, y)); mix(M.cbrt(x));
  }
  return h.toString(16);
}
function rigHash(M) {
  for (const k in M) Math[k] = M[k];
  globalThis.window = undefined;
  seed = 11; Math.random = rnd;   // seeded before the rig is made: only the math may differ between the engines
  const E = new Function('globalThis', src + '\nreturn globalThis.My3D2dge;')(globalThis);
  const rig = new E.Humanoid({ size: 1.4, cape: true, outfit: 'tunic', hair: { style: 'long' } }), combo = new E.Combo(['slash', 'backslash', 'spin']);
  const s = { x: 0, y: 0, z: 0, vx: 0, vy: 0, facing: 0 };
  h = 2166136261;
  for (let i = 0; i < 3000; i++) {
    const dt = 1 / 120;
    if (i % 90 === 0) combo.start ? combo.start() : null;
    combo.update && combo.update(dt);
    s.vx = Math.cos(i * .01) * 60; s.vy = Math.sin(i * .013) * 60; s.x += s.vx * dt; s.y += s.vy * dt; s.facing = Math.atan2(s.vy, s.vx);
    s.z = Math.max(0, Math.sin(i * .05) * 20); s.attack = combo.state || null; s.jump = s.z > 0;
    rig.update(dt, s);
    for (const k in rig.J) for (const v of rig.J[k]) mix(v);
    if (rig.capeL) for (const n of rig.capeL) { mix(n.x); mix(n.y); mix(n.z); }
  }
  for (const k in NATIVE) Math[k] = NATIVE[k];
  Math.random = RANDOM;
  return h.toString(16);
}
const engine = typeof Bun !== 'undefined' ? 'JavaScriptCore (Bun ' + Bun.version + ')' : 'V8 (Node ' + process.versions.node + ')';
const result = { engine, nativeMath: mathHash(NATIVE), portableMath: mathHash(PM), rigNative: rigHash(NATIVE), rigPortable: rigHash(PM) };
if (process.argv[2] === '--worker') { console.log(JSON.stringify(result)); }
else {
  const { execFileSync } = require('child_process');
  const bun = process.env.BUN || (() => { try { return execFileSync('sh', ['-c', 'command -v bun'], { encoding: 'utf8' }).trim(); } catch (e) { return ''; } })();
  if (!bun) { console.log('no Bun found (BUN=/path/to/bun, or npm i -g bun): JavaScriptCore not checked'); process.exit(0); }
  const other = JSON.parse(execFileSync(bun, [__filename, '--worker'], { encoding: 'utf8' }));
  console.log(result.engine + ' and ' + other.engine);
  let bad = 0;
  for (const [k, what, must] of [['nativeMath', 'native Math, 2.8 million results', false], ['portableMath', 'portable math, the same results', true], ['rigNative', 'a Humanoid, 3,000 steps, native Math', false], ['rigPortable', 'the same Humanoid, portable math', true]]) {
    const same = result[k] === other[k]; if (must && !same) bad++;
    console.log('  ' + (same ? 'same     ' : 'DIFFERENT') + ' ' + what + ': ' + result[k] + ' / ' + other[k]);
  }
  console.log(bad ? 'FAILED: the portable math is not the same in both engines' : 'ok: the portable math and the rig are the same bits in both engines');
  process.exit(bad ? 1 : 0);
}
