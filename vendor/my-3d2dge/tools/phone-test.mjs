// The phone test: the starter kits played on an emulated phone (touch, 390 x 844 CSS pixels at 3x, held upright and on its
// side), fast (about a minute), for what a player finds in ten minutes with a real one:
//   1. every kit: a tap on its title entry starts it (the first tap, the one that goes full screen), with no page errors
//   2. shooter: one continuous thumb drag, started anywhere (the right half too), flies the ship from one side of the
//      playfield to the other and back (no lifting the thumb to go on)
//   3. brawler: walking right, no street is ever on screen beyond where the hero can walk (the camera stops at a fight's
//      lock, so the screen's edge is the wall)
//   4. adventure: a phone gets Fast lighting (no GPU lighting, Settings: Lighting), and a frame draws within budget;
//      pacing: on a 120 Hz screen a frame that won't fit is drawn every other refresh, evenly (game.drawEvery), and a GPU
//              behind (refreshes missed) the same, then each refresh again after a hold; on a virtual clock (deterministic,
//              a minute of play in seconds): the hold's backoff, a display changing its refresh rate while paced, the
//              player's Frame rate (Auto, 60, Full)
//      session: a recorded page (?record=1) saves its session from the pause menu (its frame times: the device's refreshes)
//   5. rpg: a whole turn is played by taps, and every tap target (commands, foes) is at least 44 CSS pixels (a thumb)
//   6. zoom: the player's own camera zoom on top of the slice's (camera: { zoom: [min, max], start, tall }): two fingers
//      pinch it (not the stick: a thumb steering beside a resting finger doesn't), kept; none where a slice has it off
//      (the shooter); a phone held upright starts at the slice's tall zoom; Settings, Camera zoom; the wheel and - = on a
//      computer
// Usage: node tools/phone-test.mjs [kit ...]   (run node tools/build.mjs first; CHROMIUM_PATH picks a browser). Exit code 1
// on failure. Each check prints what it measured, so a failure says what a player would have seen.
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const want = k => !only.length || only.includes(k);
const UP = { width: 390, height: 844 }, SIDE = { width: 844, height: 390 };
const problems = [], t0 = Date.now();
const check = (name, ok, detail) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); if (!ok) problems.push(name + (detail ? ': ' + detail : '')); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
/** a kit on a phone: its page, a CDP session (raw touches) and the page's errors */
async function open(kit, vp, hash = kit) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(pathToFileURL(resolve(`dist/kits/my-3d2dge-${kit}.html`)).href + (hash ? '#' + hash : ''));
  await page.waitForFunction(() => window.__game && window.__game.game && window.__game.game.sceneName);
  return { page, ctx, errors, cdp: await ctx.newCDPSession(page) };
}
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const wait = ms => new Promise(r => setTimeout(r, ms));
/** game (screen) pixels -> CSS pixels on the page */
const toCss = (p, x, y) => ev(p, ([x, y]) => { const S = window.__game.game.screen, rc = S.canvas.getBoundingClientRect(); return [rc.left + (x * S.S + S.OX) / S.dpr, rc.top + (y * S.S + S.OY) / S.dpr]; }, [x, y]);
/** one finger, pressed at the first point, moved through the rest (ms per step), lifted */
async function drag(cdp, pts, ms = 25) {
  const at = (type, q) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: q ? [{ x: q[0], y: q[1], id: 1 }] : [] });
  await at('touchStart', pts[0]); for (const q of pts.slice(1)) { await at('touchMove', q); await wait(ms); } await at('touchEnd');
}
/** fingers (one [x, y] each, ids 1, 2, ...) pressed at their first points, moved together through n steps to their last */
async function fingers(cdp, from, to, n = 12, ms = 20) {
  const at = k => from.map((p, i) => ({ x: p[0] + (to[i][0] - p[0]) * k, y: p[1] + (to[i][1] - p[1]) * k, id: i + 1 }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
  for (let i = 1; i <= n; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(i / n) }); await wait(ms); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const line = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);

/* 1. a tap on the title's entry starts the kit */
console.log('title: the first tap starts the game');
for (const kit of ['adventure', 'platformer', 'shooter', 'rpg', 'brawler', 'stealth', 'animlab']) {
  if (!want(kit)) continue;
  const { page, ctx, errors } = await open(kit, UP, '');
  await wait(400);
  const b = await ev(page, () => { const m = window.__game.titleMenu._box; return m && [m.x + m.w / 2, m.y + m.rowH / 2]; });
  if (!b) { check(`${kit}: the title menu is drawn`, false, 'no menu box'); await ctx.close(); continue; }
  const [x, y] = await toCss(page, b[0], b[1]); await page.touchscreen.tap(x, y); await wait(700);
  const scene = await ev(page, () => window.__game.game.sceneName);
  check(`${kit}: one tap on its title entry starts it`, scene === kit && !errors.length, `scene ${scene}${errors.length ? ', errors: ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

/* 2. shooter: one drag crosses the playfield, from anywhere */
if (want('shooter')) {
  console.log('shooter: a thumb drag crosses the screen');
  for (const [label, vp] of [['upright', UP], ['on its side', SIDE]]) {
    const { page, ctx, cdp, errors } = await open('shooter', vp);
    await wait(3600);   // past the stage card
    const st = () => ev(page, () => { const s = window.__game.game.scene.state(); return { x: s.ship.x, span: s.span }; });
    // the ship can't be shot down mid-swipe (a respawning ship doesn't steer: that would test the waves, not the thumb)
    const calm = async () => { await page.waitForFunction(() => !(window.__game.game.scene.state().ship.respawn > 0), null, { timeout: 8000 }); await ev(page, () => { window.__game.game.scene.state().ship.inv = 60; }); };
    await calm(); const s0 = await st(), w = vp.width, h = vp.height;
    // started on the right half (the stick's old dead zone), swiped over 72% of the screen to the left without lifting
    await drag(cdp, line([w * .8, h * .55], [w * .08, h * .55], 24)); const s1 = await st();
    await calm(); await drag(cdp, line([w * .25, h * .5], [w * .95, h * .5], 24)); const s2 = await st();   // (a swipe over 70% of the screen)
    const [fa, fb] = s0.span, left = s1.x - (fa + 10), right = (fb - 10) - s2.x;
    check(`shooter ${label}: one drag from the right half flies the ship to the left edge`, left < 4, `ship at ${s1.x.toFixed(0)}, the edge at ${(fa + 10).toFixed(0)}`);
    check(`shooter ${label}: one drag flies it back to the right edge`, right < 4 && !errors.length, `ship at ${s2.x.toFixed(0)}, the edge at ${(fb - 10).toFixed(0)}${errors.length ? ', errors: ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
}

/* 3. brawler: the walkable street ends where the screen does */
if (want('brawler')) {
  console.log('brawler: the street on screen is the street you can walk');
  for (const [label, vp] of [['upright', UP], ['on its side', SIDE]]) {
    const { page, ctx, errors } = await open('brawler', vp);
    await wait(800);
    const sample = () => ev(page, () => { const g = window.__game.game, s = g.scene.state(); return { right: (g.cam.x + g.W) / g.view.ax, end: s.end, x: s.hero.x }; });
    let worst = { over: -1e9 }; await page.keyboard.down('ArrowRight');
    for (let i = 0; i < 40; i++) { await wait(100); const s = await sample(), over = s.right - (s.end + 12); if (over > worst.over) worst = { over, ...s }; }
    await page.keyboard.up('ArrowRight');
    check(`brawler ${label}: no street on screen beyond the walkable end`, worst.over <= 0 && !errors.length, `screen's right edge ${worst.right.toFixed(0)}, walkable to ${worst.end.toFixed(0)}${errors.length ? ', errors: ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
}

/* 4. adventure: Fast lighting on a phone, and a frame in budget */
if (want('adventure')) {
  console.log('adventure: smooth on a phone');
  const { page, ctx, errors } = await open('adventure', UP);
  await page.touchscreen.tap(300, 150); await wait(800);
  const r = await ev(page, () => new Promise(res => {
    const g = window.__game.game, d = []; let n = 0;
    const tick = () => { d.push(g.stats.renderMs + g.stats.updateMs); if (++n < 90) requestAnimationFrame(tick); else res({ light: g.settings.advLight, gpu: !!(g.gpu && g.gpu.enabled), ms: d.sort((a, b) => a - b)[45] }); };
    requestAnimationFrame(tick);
  }));
  check('adventure: a phone gets Fast lighting (no GPU lighting)', r.light === 'auto' && !r.gpu, `setting ${r.light}, GPU lighting ${r.gpu ? 'on' : 'off'}`);
  check('adventure: a frame updates and draws within 30 ms (median)', r.ms < 30 && !errors.length, `${r.ms.toFixed(1)} ms${errors.length ? ', errors: ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

/* 4b. a 120 Hz phone (frames on an 8.33 ms grid, real timers; a late frame waits for the next): a frame that won't fit is
   drawn every other refresh, evenly, instead of at random. (A light frame drawn every refresh is checked on 4c's virtual
   clock: here a busy machine's late timers miss refreshes, which the engine is right to pace) */
if (want('pacing')) {
  console.log('pacing: a 120 Hz screen');
  const ctx = await browser.newContext({ viewport: UP, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const P = 1000 / 120, t0 = performance.now(), q = new Map(); let id = 0;
    const at = () => t0 + Math.ceil((performance.now() - t0 + .01) / P) * P;
    const pump = () => { const v = at() - P, run = [...q.values()]; q.clear(); for (const f of run) f(v); setTimeout(pump, Math.max(0, at() - performance.now())); };
    window.requestAnimationFrame = f => { q.set(++id, f); return id; }; window.cancelAnimationFrame = i => q.delete(i); setTimeout(pump, P);
  });
  await page.goto(pathToFileURL(resolve('dist/kits/my-3d2dge-stealth.html')).href + '#stealth');
  await page.waitForFunction(() => window.__game && window.__game.game && window.__game.game.sceneName === 'stealth');
  // the scene's frame made to cost ms (busy, or nothing: light), then measured over 2 s: the refresh read, every how many
  // refreshes, the gaps. Light first, as a phone's title would be: the engine reads the refresh from frames that fit one, and
  // the scene's own may not on a slow machine (8 to 16 ms on a 4-core cloud box), where busy frames from the start read
  // 60 Hz but for timers that happen to fire early (a 10 ms frame from the first refresh is checked on 4c's virtual clock)
  const run = (ms, pace) => ev(page, ([ms, pace]) => new Promise(res => {
    const g = window.__game.game, d0 = g.__d0 || (g.__d0 = g.scene.draw); g.o.pace = pace;
    g.scene.draw = ms ? r => { const t = performance.now() + ms; while (performance.now() < t); } : () => {};
    const f0 = g.__f0 || (g.__f0 = g._frame.bind(g)), gaps = []; let last = 0;
    g._frame = () => { const now = performance.now(); if (last) gaps.push(now - last); last = now; f0(); };
    setTimeout(() => { const s = gaps.slice(gaps.length >> 1), even = s.filter(x => x > 12 && x < 21).length / s.length; res({ hz: g.hz, every: g.drawEvery, even: Math.round(even * 100) }); }, 2000);
  }), [ms, pace]);
  await run(0, undefined);
  const heavy = await run(10, undefined), off = await run(10, false);
  check('pacing: the screen reads 120 Hz', heavy.hz >= 110 && heavy.hz <= 130, `${heavy.hz} Hz`);
  check('pacing: a 10 ms frame is drawn every other refresh, evenly (16.7 ms apart)', heavy.every === 2 && heavy.even >= 80, `every ${heavy.every}, ${heavy.even}% of gaps 16.7 ms`);
  check('pacing: pace: false draws every refresh', off.every === 1 && !errors.length, `every ${off.every}${errors.length ? ', errors: ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

/* 4c. pacing on a virtual clock (a fresh page: no history from 4b): the test owns performance.now and the display's
   refreshes (__vt.run(ms, hz)), a frame drawn costs vt.cost ms and then its GPU vt.gpu ms (gpu - 3 and gpu + 3 by turns:
   some frames fit a refresh, some don't), a refresh comes when both are free. Deterministic, and faster than real time
   (the scene's drawing stubbed after the first check): a GPU that falls behind (no clock in the page sees it: the refreshes missed are the sign), the hold
   before each refresh is tried again and its backoff, and a display that changes its refresh rate while paced */
if (want('pacing')) {
  console.log('pacing: a virtual clock');
  const ctx = await browser.newContext({ viewport: UP, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    let T = 0, V = -10 / 3, busy = 0, id = 0, k = 0; const q = new Map();   // (the first refresh 5 ms after start(): no refresh's gap)
    performance.now = () => T;
    window.requestAnimationFrame = f => { q.set(++id, f); return id; }; window.cancelAnimationFrame = i => q.delete(i);
    const vt = window.__vt = { cost: 1, gpu: 0, draws: [],
      hook(g) { const f0 = g._frame.bind(g); g._frame = () => { vt.draws.push(T); f0(); T += vt.cost; if (vt.gpu) busy = T + vt.gpu + (k++ % 2 ? 3 : -3); }; },
      // ms of refreshes at hz (the refresh grid carries on from the last one); a refresh while the frame before it is
      // still running, or its GPU still drawing, is skipped
      run(ms, hz) { const P = 1000 / hz, end = V + ms; while (V + P <= end + 1e-6) { V += P; if (T > V || V < busy) continue; T = V; const fs = [...q.values()]; q.clear(); for (const f of fs) f(V); } },
      // the same in steps of 50 ms: [ms from now, drawEvery, hz] after each
      watch(ms, hz) { const g = window.__game.game, out = []; for (let t = 50; t <= ms; t += 50) { vt.run(50, hz); out.push([t, g.drawEvery, g.hz]); } return out; },
      // the gaps between frames drawn in the last ms
      gaps(ms) { const d = vt.draws, t0 = d[d.length - 1] - ms, out = []; for (let i = 1; i < d.length; i++) if (d[i - 1] >= t0) out.push(+(d[i] - d[i - 1]).toFixed(2)); return out; } };
  });
  await page.goto(pathToFileURL(resolve('dist/kits/my-3d2dge-stealth.html')).href + '#stealth');
  await page.waitForFunction(() => window.__vt && window.__game && window.__game.game, null, { polling: 50 });
  const vt = (fn, arg) => ev(page, fn, arg);
  // when drawEvery turned 2 in a watch's timeline (ms from its start, to 50 ms; null: never)
  const on = tl => (tl.find(e => e[1] === 2) || [null])[0];
  const even = gs => Math.round(gs.filter(x => Math.abs(x - 16.67) < .1).length / Math.max(1, gs.length) * 100);
  const state = () => vt(() => { const g = window.__game.game; return { scene: g.sceneName, every: g.drawEvery, hz: g.hz, gaps: __vt.gaps(300) }; });
  // a 10 ms frame from the first refresh (which came 5 ms after start(): read as one, 200 Hz until 90 more were)
  await vt(() => { __vt.hook(window.__game.game); __vt.cost = 10; __vt.run(1000, 120); });
  const first = await state();
  check('virtual: a 10 ms frame from the first refresh: every other refresh, the screen read 120 Hz', first.scene === 'stealth' && first.every === 2 && first.hz === 120 && even(first.gaps) === 100, `${first.scene}, every ${first.every}, ${first.hz} Hz, ${even(first.gaps)}% of gaps 16.7 ms`);
  // light frames from then on: every refresh again once the 3 s hold the first frames' missed refreshes started is over
  // (14 s: the hold back to 3 s for the next, below)
  await vt(() => { window.__game.game.scene.draw = () => {}; __vt.cost = 1; __vt.run(14000, 120); });   // (the scene's own drawing off: its cost is vt.cost)
  const start = await state();
  check('virtual: a light frame, its GPU keeping up: every refresh', start.every === 1 && start.hz === 120, `every ${start.every}, ${start.hz} Hz`);
  // a GPU behind: paced within a quarter second, frames evenly 16.7 ms apart, the refresh still read 120 Hz
  const behind = await vt(() => { __vt.gpu = 8; return { tl: __vt.watch(1000, 120), gaps: __vt.gaps(500) }; });
  const b = behind.tl[behind.tl.length - 1];
  check('virtual: a GPU behind is drawn every other refresh within 0.25 s, evenly', on(behind.tl) <= 250 && b[1] === 2 && even(behind.gaps) === 100 && b[2] === 120, `paced at ${on(behind.tl)} ms, every ${b[1]}, ${even(behind.gaps)}% of gaps 16.7 ms, ${b[2]} Hz`);
  // the GPU keeps up again: every refresh after the hold (3 s from pacing), not before
  const back1 = await vt(() => { __vt.gpu = 0; return __vt.watch(5000, 120); });
  const r1 = back1.find(e => e[1] === 1), at1 = r1 ? r1[0] + 1000 - on(behind.tl) : null;   // (the hold's first part spent in behind's watch)
  check('virtual: the GPU keeping up again, every refresh after a 3 s hold', at1 !== null && at1 >= 3000 && at1 <= 3300, `every refresh again ${at1} ms after pacing`);
  // behind again at once: the hold doubles (6 s)
  const twice = await vt(() => { __vt.gpu = 8; const a = __vt.watch(500, 120); __vt.gpu = 0; return { a, b: __vt.watch(8000, 120) }; });
  const r2 = twice.b.find(e => e[1] === 1), at2 = r2 ? r2[0] + 500 - on(twice.a) : null;
  check('virtual: behind again soon after, the hold doubles (6 s)', on(twice.a) !== null && at2 >= 6000 && at2 <= 6300, `paced at ${on(twice.a)} ms, every refresh again ${at2} ms after`);
  // 11 s drawn at each refresh, then behind: the hold is 3 s again
  const reset = await vt(() => { __vt.run(11000, 120); __vt.gpu = 8; const a = __vt.watch(500, 120); __vt.gpu = 0; return { a, b: __vt.watch(8000, 120) }; });
  const r3 = reset.b.find(e => e[1] === 1), at3 = r3 ? r3[0] + 500 - on(reset.a) : null;
  check('virtual: after 10 s at each refresh, the hold is 3 s again', on(reset.a) !== null && at3 >= 3000 && at3 <= 3300, `paced at ${on(reset.a)} ms, every refresh again ${at3} ms after`);
  // paced (a 6 s hold), the display drops to 90 Hz: its refresh is learnt again while paced
  const slower = await vt(() => { __vt.gpu = 8; __vt.watch(500, 120); __vt.gpu = 0; return __vt.watch(2000, 90); });
  const s = slower[slower.length - 1];
  check('virtual: paced, a display that drops to 90 Hz reads 90 Hz within 2 s', s[1] === 2 && s[2] === 90, `every ${s[1]}, ${s[2]} Hz`);
  // still paced, it rises to 144 Hz: read at once (a shorter gap than the refresh read), every other refresh 13.9 ms apart
  const faster = await vt(() => { const tl = __vt.watch(600, 144); return { tl, gaps: __vt.gaps(200) }; });
  const f = faster.tl[faster.tl.length - 1], f13 = faster.gaps.filter(x => Math.abs(x - 13.89) < .1).length / Math.max(1, faster.gaps.length);
  check('virtual: paced, a display that rises to 144 Hz is drawn every other refresh, 13.9 ms apart', f[1] === 2 && f[2] === 144 && f13 === 1, `every ${f[1]}, ${f[2]} Hz, gaps ${[...new Set(faster.gaps)].join(', ')} ms`);
  // the player's Frame rate (Settings, Display) on a 120 Hz screen, past any hold: 60 draws every other refresh with light
  // frames and its GPU keeping up, Full every refresh with its GPU behind, Auto back to the engine's call
  const fr = await vt(() => { const g = window.__game.game, out = {}; __vt.gpu = 0; __vt.run(5000, 120);   // (the 6 s hold from the 90 Hz check over)
    g.settings.set('frameRate', '60'); __vt.run(1000, 120); out.sixty = [g.drawEvery, __vt.gaps(300)];
    g.settings.set('frameRate', 'full'); __vt.gpu = 8; __vt.run(1000, 120); out.full = [g.drawEvery, __vt.gaps(300)];
    g.settings.set('frameRate', 'auto'); __vt.run(1000, 120); out.auto = g.drawEvery; __vt.gpu = 0; return out; });
  check('virtual: Frame rate 60 draws every other refresh of a 120 Hz screen, its frames light', fr.sixty[0] === 2 && even(fr.sixty[1]) === 100, `every ${fr.sixty[0]}, ${even(fr.sixty[1])}% of gaps 16.7 ms`);
  check('virtual: Frame rate Full draws every refresh, its GPU behind; Auto paces it again', fr.full[0] === 1 && fr.full[1].some(x => Math.abs(x - 8.33) < .1) && fr.auto === 2, `every ${fr.full[0]} (gaps ${[...new Set(fr.full[1])].join(', ')} ms), Auto: every ${fr.auto}`);
  // 60 on a screen of exactly 100 Hz: every other refresh; then, still 60, the display drops to 60 Hz: after 90 long gaps
  // in a row the refresh is read afresh (60 Hz, every refresh: not 120 HZ EVERY 2 for good)
  const drop = await vt(() => { const g = window.__game.game, out = {}; __vt.run(5000, 120); g.settings.set('frameRate', '60');
    __vt.run(2000, 100); out.hundred = [g.drawEvery, g.hz]; __vt.run(2000, 120); __vt.run(2500, 60); out.sixty = [g.drawEvery, g.hz, __vt.gaps(300)];
    g.settings.set('frameRate', 'auto'); __vt.run(2000, 120); return out; });
  check('virtual: Frame rate 60 halves a 100 Hz screen too', drop.hundred[0] === 2 && drop.hundred[1] === 100, `every ${drop.hundred[0]}, ${drop.hundred[1]} Hz`);
  check('virtual: at 60, a display that drops to 60 Hz is read afresh: every refresh, 60 Hz', drop.sixty[0] === 1 && drop.sixty[1] === 60 && drop.sixty[2].every(x => Math.abs(x - 16.67) < .1), `every ${drop.sixty[0]}, ${drop.sixty[1]} Hz, gaps ${[...new Set(drop.sixty[2])].join(', ')} ms`);
  // a game made with pace: false, its GPU behind (Auto would pace it): every refresh with Auto, every other one when the
  // player picks 60
  const nopace = await vt(() => { const g = window.__game.game, out = {}; g.o.pace = false; __vt.gpu = 8; __vt.run(1500, 120); out.auto = g.drawEvery;
    g.settings.set('frameRate', '60'); __vt.run(500, 120); out.sixty = g.drawEvery; g.settings.set('frameRate', 'auto'); g.o.pace = undefined; __vt.gpu = 0; return out; });
  check('virtual: pace: false draws every refresh, unless the player picks 60', nopace.auto === 1 && nopace.sixty === 2 && !errors.length, `Auto: every ${nopace.auto}, 60: every ${nopace.sixty}${errors.length ? ', errors: ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

/* 4d. a recorded page (?record=1) saves its session from the pause menu (a phone has no console): its frame times, the
   device's own refreshes, are what a report of choppy play needs */
if (want('session')) {
  console.log('session: saved from the menu');
  const ctx = await browser.newContext({ viewport: SIDE, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { navigator.canShare = () => true; navigator.share = d => d.files[0].text().then(t => { window.__shared = { name: d.files[0].name, frames: JSON.parse(t).frames.length, text: t }; }); });
  await page.goto(pathToFileURL(resolve('dist/kits/my-3d2dge-adventure.html')).href + '?record=1#adventure');
  await page.waitForFunction(() => window.__game && window.__game.game && window.__game.game.sceneName === 'adventure');
  await wait(1000);
  await page.tap('#e3-corner button[aria-label=Menu]'); await wait(300);
  const btns = await ev(page, () => [...document.querySelectorAll('.esh-sh button')].map(b => b.textContent));
  const save = await page.$('.esh-sh button:has-text("Save session")'); if (save) await save.tap();
  await page.waitForFunction(() => window.__shared, null, { timeout: 3000 }).catch(() => {});
  const got = await ev(page, () => window.__shared || null);
  check('session: a recorded page\'s pause menu has Save session; it shares the session, its frame times in it', btns.includes('Save session') && got && /^session-.*\.json$/.test(got.name) && got.frames > 30 && !errors.length, `${btns.join(', ')}; shared ${got ? got.name + ' with ' + got.frames + ' frames' : 'nothing'}${errors.length ? ', errors: ' + errors.join(' | ') : ''}`);
  await ctx.close();
  // the saved session replays exactly, the tap on Save session included (its replay has the button: it lands on it)
  if (got) {
    const dir = resolve('check-output/phone'), f = dir + '/session.json'; mkdirSync(dir, { recursive: true }); writeFileSync(f, got.text);
    let out = '', ok = true; try { out = execFileSync('node', ['tools/replay.mjs', f, '--out', dir + '/replay', '--log', '"screen: " + window.__game.game.shell.screen'], { encoding: 'utf8', timeout: 120000 }); } catch (e) { ok = false; out = (e.stdout || '') + (e.stderr || ''); }
    const last = out.trim().split('\n').filter(l => /match|diverg|missing|threw|played|screen:/i.test(l)).slice(-3).join(' | ');
    check('session: the saved session replays exactly, its last tap on Save session (the menu still open, not Quit\'s question)', ok && /screen: pause/.test(out), last || out.trim().split('\n').slice(-2).join(' | '));
  }
  // replay --pacing reads a session's refreshes: one made up of 3 s begun hidden (a frame a second; only its showing is
  // recorded), 2 s at 120 Hz, 2 s at 60 Hz (adaptive refresh: nothing missed), 5 s hidden, 1 s at 120 Hz and a 2.5 s
  // stall (its 299 missed refreshes over the seconds it took). The hidden time is left out
  const Fs = [0, 1000, 2000], evs = [[3, 'visibilitychange', 'document', 0]], run = (n, p) => { for (let i = 0; i < n; i++) Fs.push(Fs[Fs.length - 1] + p); };
  Fs.push(3000); run(240, 1000 / 120); run(120, 1000 / 60); evs.push([Fs.length, 'visibilitychange', 'document', 1]); Fs.push(Fs[Fs.length - 1] + 5000); evs.push([Fs.length - 1, 'visibilitychange', 'document', 0]);
  run(120, 1000 / 120); Fs.push(Fs[Fs.length - 1] + 2500); run(120, 1000 / 120);
  const sf = resolve('check-output/phone/synthetic-session.json'); mkdirSync(resolve('check-output/phone'), { recursive: true });
  writeFileSync(sf, JSON.stringify({ format: 'my3d2dge-session', v: 1, version: '0', build: 'synthetic', href: '/kits/adventure', ua: 'synthetic', frames: Fs, events: evs }));
  const rep = execFileSync('node', ['tools/replay.mjs', sf, '--pacing'], { encoding: 'utf8' }), cols = rep.split('second by second')[1].split('\n').slice(1).join(' ').trim().split(/\s+/);
  const miss = +(rep.match(/(\d+) refreshes missed/) || [])[1];
  check('session: replay --pacing reads a 60 Hz stretch as nothing missed, leaves hidden time out, spreads a stall over its seconds', miss >= 295 && miss <= 305 && /hidden for 4 gaps/.test(rep) && cols.filter(c => /\/0\/17@60$/.test(c)).length === 2 && cols.filter(c => c === '-').length >= 7 && cols.filter(c => /\/2500$/.test(c)).length === 3, `${miss} missed; ${cols.join(' ')}`);
}

/* 5. rpg: thumb-sized buttons, a turn played by taps, AUTO */
if (want('rpg')) {
  console.log('rpg: a battle played by thumb');
  for (const [label, vp] of [['upright', UP], ['on its side', SIDE]]) {
    const { page, ctx, errors } = await open('rpg', vp);
    await page.touchscreen.tap(vp.width * .5, vp.height * .12);   // the device is touch now
    await page.waitForFunction(() => window.__game.game.scene.state().mode === 'command', null, { timeout: 8000 });
    const st = () => ev(page, () => window.__game.game.scene.state());
    const k = await ev(page, () => { const S = window.__game.game.screen; return S.S / S.dpr; });   // CSS pixels per screen pixel
    const tapPad = async (p) => { const [x, y] = await toCss(page, p.x + p.w / 2, p.y + p.h / 2); await page.touchscreen.tap(x, y); await wait(250); };
    const s0 = await st(), small = s0.pads.filter(p => p && (p.w * k < 44 || p.h * k < 44));
    check(`rpg ${label}: every button is thumb-sized (44 CSS px or more)`, s0.pads.filter(Boolean).length === 6 && !small.length, `${s0.pads.filter(Boolean).map(p => p.label).join(', ')}: smallest ${Math.min(...s0.pads.filter(Boolean).map(p => Math.min(p.w, p.h) * k)).toFixed(0)} CSS px`);
    await tapPad(s0.pads.find(p => p && p.label === 'Attack')); const s1 = await st();
    const foe = s1.pads.find(p => p && p.label === 'Gargoyle'), back = s1.pads.find(p => p && p.label === 'BACK');
    check(`rpg ${label}: Attack shows a button per foe and BACK`, s1.mode === 'target' && !!foe && !!back, `mode ${s1.mode}, ${s1.pads.filter(Boolean).map(p => p.label).join(', ')}`);
    if (foe) { await tapPad(foe); const s2 = await st(); check(`rpg ${label}: a foe's button sends the hero at it`, s2.mode === 'act' && s2.act === 'chop', `mode ${s2.mode}, act ${s2.act}`); }
    if (label === 'upright') {   // AUTO: the party fights on with no more taps
      await page.waitForFunction(() => window.__game.game.scene.state().mode !== 'act', null, { timeout: 8000 });
      const a = (await st()).pads.find(p => p && p.label === 'AUTO'); await tapPad(a);
      const acts = new Set(); let end = '';
      for (let i = 0; i < 120 && acts.size < 4 && !end; i++) { await wait(100); const q = await st(); if (q.act) acts.add(q.actor + ' ' + q.act); if (/win|won|lose/.test(q.mode)) end = q.mode; if (q.mode === 'command') { end = 'waiting for a tap'; break; } }
      check('rpg: AUTO fights on by itself', acts.size >= 4 || end === 'won' || end === 'win', `${[...acts].join(', ')}${end ? ' (' + end + ')' : ''}`);
    }
    check(`rpg ${label}: no page errors`, !errors.length, errors.join(' | '));
    await ctx.close();
  }
}

/* 6. zoom: the player zooms the camera, on top of the slice's own */
if (want('zoom')) {
  console.log('zoom: the player\'s camera zoom');
  const { page, ctx, cdp, errors } = await open('adventure', UP);
  await wait(800);
  const st = () => ev(page, () => { const g = window.__game.game, h = g.scene.state().hero; return { zoom: g.zoom, f: +g.settings.zoom.toFixed(3), x: h.x, y: h.y }; });
  const s0 = await st();
  // apart: while the fingers move, the world drawn is scaled (a preview: no new size baked at every step); a quarter second
  // after they lift it is drawn at the new zoom
  await fingers(cdp, [[160, 420], [230, 420]], [[70, 420], [320, 420]]); await wait(400); const s1 = await st();
  await fingers(cdp, [[60, 420], [330, 420]], [[100, 420], [290, 420]], 6); await wait(400); const s2 = await st();   // together, a little
  const walked = Math.max(Math.hypot(s1.x - s0.x, s1.y - s0.y), Math.hypot(s2.x - s1.x, s2.y - s1.y));
  check('zoom: two fingers apart zoom in, together out, the hero standing (not the stick)', s0.zoom === 1 && s1.zoom >= 1.8 && s2.zoom < s1.zoom - .3 && s2.zoom > 1 && Math.abs(s2.f - s2.zoom) < .05 && walked < 3, `${s0.zoom}x, apart ${s1.zoom}x, together ${s2.zoom}x, the hero moved ${walked.toFixed(1)}`);
  // a thumb steering (the stick, left half) while another finger rests on the glass: the hero walks, the zoom stays
  await fingers(cdp, [[100, 600], [300, 600]], [[30, 600], [300, 600]], 12, 40); await wait(400); const s3 = await st();
  check('zoom: a thumb on the stick beside a resting finger steers, and zooms nothing', s3.zoom === s2.zoom && s2.x - s3.x > 4, `${s3.zoom}x, the hero walked ${(s2.x - s3.x).toFixed(1)} left`);
  await page.reload(); await page.waitForFunction(() => window.__game && window.__game.game && window.__game.game.sceneName === 'adventure'); await wait(300);
  const s4 = await st();
  check('zoom: the player\'s zoom is kept (the page loaded again)', s4.zoom === s2.zoom && s4.f === s2.f && !errors.length, `${s4.zoom}x (factor ${s4.f})${errors.length ? ', errors: ' + errors.join(' | ') : ''}`);
  // Settings, Camera zoom: its slider zooms the camera under the menu
  await page.tap('#e3-corner button[aria-label=Menu]'); await wait(300);
  const sb = await page.$('.esh-sh button:has-text("Settings")'); if (sb) await sb.tap(); await wait(300);
  let row = await ev(page, () => { const r = [...document.querySelectorAll('.esh-row')].find(r => /^Camera zoom/.test(r.textContent)), i = r && r.querySelector('input[type=range]'); if (!i) return null; i.value = '1.5'; i.dispatchEvent(new Event('input')); return { out: r.querySelector('output').textContent }; });
  if (row) { await wait(400); row.zoom = await ev(page, () => window.__game.game.zoom); }
  check('zoom: Settings has Camera zoom; its slider zooms the camera', !!row && row.out === '1.5×' && row.zoom === 1.5, row ? `${row.out}: ${row.zoom}x` : 'no Camera zoom row');
  await ctx.close();
  // the shooter's playfield is the whole screen (camera: { zoom: false }): a pinch leaves it as it is
  const sh = await open('shooter', UP); await wait(600);
  await fingers(sh.cdp, [[160, 420], [230, 420]], [[70, 420], [320, 420]]); await wait(400);
  const shz = await ev(sh.page, () => window.__game.game.zoom);
  check('zoom: none where the slice has it off (the shooter)', shz === 1 && !sh.errors.length, `${shz}x${sh.errors.length ? ', errors: ' + sh.errors.join(' | ') : ''}`);
  await sh.ctx.close();
  // the brawler: a phone held upright starts at its tall 1.5x, on its side at 1x; the player's zoom multiplies either
  const br = await open('brawler', UP); await wait(600);
  const bz = () => ev(br.page, () => window.__game.game.zoom), up0 = await bz();
  await br.page.setViewportSize(SIDE); await wait(400); const side0 = await bz();
  await ev(br.page, () => window.__game.game.settings.set('zoom', .8)); await wait(400); const side1 = await bz();
  await br.page.setViewportSize(UP); await wait(400); const up1 = await bz();
  check('zoom: the brawler starts at 1.5x upright, 1x on its side; the player\'s .8 makes them 1.2x and .8x', up0 === 1.5 && side0 === 1 && side1 === .8 && up1 === 1.2 && !br.errors.length, `upright ${up0}x, on its side ${side0}x; at .8: ${side1}x, upright ${up1}x${br.errors.length ? ', errors: ' + br.errors.join(' | ') : ''}`);
  await br.ctx.close();
  // a computer: the wheel (a notch 10%), - and =, 0 resets
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), dp = await dctx.newPage(), derr = [];
  dp.on('pageerror', e => derr.push(e.message));
  await dp.goto(pathToFileURL(resolve('dist/kits/my-3d2dge-adventure.html')).href + '#adventure');
  await dp.waitForFunction(() => window.__game && window.__game.game && window.__game.game.sceneName === 'adventure'); await wait(400);
  const dz = () => ev(dp, () => window.__game.game.zoom);
  await dp.mouse.move(640, 360); for (let i = 0; i < 3; i++) { await dp.mouse.wheel(0, -100); await wait(50); } await wait(400); const w3 = await dz();
  await dp.keyboard.press('Minus'); await wait(400); const m1 = await dz();
  await dp.keyboard.press('Digit0'); await wait(100); const r0 = await dz();
  check('zoom: on a computer the wheel zooms (3 notches: 1.35x), - steps out, 0 resets', w3 === 1.35 && m1 === 1.25 && r0 === 1 && !derr.length, `${w3}x, ${m1}x, ${r0}x${derr.length ? ', errors: ' + derr.join(' | ') : ''}`);
  await dctx.close();
}

await browser.close();
console.log(problems.length ? `\nphone test FAILED (${problems.length}):\n  ${problems.join('\n  ')}` : `\nphone test passed in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(problems.length ? 1 : 0);
