// A headless test of the template game: the engine and game.js run in Node with no screen (new E.Game is headless where
// there is no DOM), driven by fixed steps (game.advance) and scripted input (input.tap, input.hold), and read through
// game.debug.snapshot(). Run it: node game/test.mjs (exit code 1 on a failure). Write one like it for your game.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ctx = { console };
vm.createContext(ctx);
for (const f of ['../my-3d2dge.js', './game.js']) vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx, { filename: f });
const E = ctx.My3D2dge, game = E.current, I = game.input, snap = () => game.debug.snapshot();
let failed = 0;
const check = (what, ok, detail = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + what + (ok ? '' : ': ' + detail)); if (!ok) failed++; };

game.advance(.5);
check('the title waits for start', snap().scene === 'title', JSON.stringify(snap()));
I.tap('start'); game.advance(.5);
check('start begins play', snap().scene === 'play', JSON.stringify(snap()));

// climb: stand facing the roof's west wall (cells 7-9 of rows 4-6: x 112-160, y 64-112) and press jump
game.debug.teleport(100, 88, 0, 0);
I.tap('jump'); game.advance(.1);
check('jump next to a wall starts a climb', snap().climbing, JSON.stringify(snap()));
game.advance(1);
check('the climb ends on the roof', !snap().climbing && snap().hero[2] === 32, JSON.stringify(snap()));

// take the gem (on the roof's middle cell), then hop down into the street with it
game.debug.teleport(136, 88, 32, 0); game.advance(.1);
check('walking onto the gem takes it', snap().got, JSON.stringify(snap()));
game.debug.teleport(156, 120, 32, Math.PI / 2); I.hold('down'); game.advance(1.5); I.hold('down', false); game.advance(.5);
check('back in the street with the gem wins', snap().scene === 'end' && snap().won, JSON.stringify(snap()));

// get seen: stand in front of the guard, in the open, until its alert fills
I.tap('start'); game.advance(.5);
const [gx, gy, gf] = snap().guard;
game.debug.teleport(gx + Math.cos(gf) * 40, gy + Math.sin(gf) * 40, 0, gf + Math.PI);
game.advance(2.5);
check('the guard catches a hero it sees', snap().scene === 'end' && !snap().won, JSON.stringify(snap()));
check('no errors', !game.errors.length, game.errors.map(e => e.message).join(' | '));

console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
