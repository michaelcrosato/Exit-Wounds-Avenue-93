// The standard features every game gets (engine section 10b, and E.Shell's standard menu), on both editions. Each test
// holds one promise the cards make, so a game can rely on it without writing it:
//   settings     game.settings: defaults, checked values (a slider kept in range, a choice among its options), a game's
//                own settings, saved per game with a version and loaded back, bad saved values falling back to their
//                defaults, blocked storage (the game plays on, saved: false), shake and flashes scaled by them
//   pausing      pause(reason), resume(), pauseReason; a pausable scene pauses when the window loses focus or the page is
//                hidden (not a title; regaining focus never resumes; autoPause: false keeps it running) and when the
//                controller in use is unplugged
//   input        input.label() per device and controller family, the touch START (Act:menu) starting a title and pausing
//                a scene in play; on the full engine rebind() (a conflict or a reserved code changes nothing, the arrow
//                keys and d-pad stay on the moves, bindings survive use() and are saved), resetBindings()
//   page         the viewport (viewport-fit=cover, pinch zoom left alone) and the canvas's touch-action; a fixed
//                resolution filling a high-density screen ('auto' scale) or kept whole ('sharp'); expand filling every
//                shape with no bars; the touch stick pressing the directions; a bottom dialog clear of the touch buttons;
//                a tap or click on a menu entry picking it and on a dialog box turning the page
//   corner       the menu and full-screen buttons: shown on a title and while paused, hidden in play; the menu button
//                pauses (the agent edition: and resumes); full screen from a click, and the player's choice kept (leaving
//                it means a phone's tap no longer takes it there)
//   menu (full)  Escape opens the pause screen (Resume, Settings, Controls, Full screen, Quit to title); arrows and Enter
//                move and choose; a slider turns with the arrows; the controls screen rebinds a key by pressing it, says
//                a conflict, Escape cancels; P closes the menu and resumes; Quit asks first (Keep playing has the focus);
//                the corner's menu on a title opens the settings and the title waits; a game's own E.Shell takes over
//                from the engine's; touch buttons follow the player's side, size and visibility settings
//   boot         boot steps run in order (all at once headless, waiting for a promise; game.booted); a failing step
//                stops the start and is in game.errors; in a page the boot screen takes over the splash, shows the
//                system's lines and each step, draws nothing from the game's random numbers and goes once the game has
//                drawn; a failing step, or a script error before play, turns it into a report (what failed, the error,
//                a code, the engine, the canvas) whose Continue takes it away; after play an error goes to the red box
//                with the report's line; boot: false takes a splash away; E.diagnose()
// Usage: node tools/standard-test.mjs [--node]   (exit code 1 on a failure; CHROMIUM_PATH picks a browser)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDITIONS = [['full', 'engine/my-3d2dge.js'], ['agent', 'engine/my-3d2dge-agent.js']];
const failures = [];
let passed = 0;
const check = (name, ok, detail = '') => { if (ok) passed++; else { failures.push(name + (detail ? ': ' + detail : '')); console.log('  FAIL ' + name + (detail ? ': ' + detail : '')); } };
const load = file => { const ctx = { console: { log() {}, warn() {}, error: console.error } }; vm.createContext(ctx); vm.runInContext(readFileSync(join(root, file), 'utf8'), ctx, { filename: file }); return ctx.My3D2dge; };
const scenes = () => ({ title: { update() {}, draw() {} }, play: { pausable: true, update() {}, draw() {} } });

// ---- in Node: what needs no screen
for (const [ed, file] of EDITIONS) {
  const E = load(file);
  console.log(`\n${ed} edition (Node)`);
  const game = new E.Game({ headless: true, menu: { settings: [{ key: 'hints', label: 'Hints', value: true }, { key: 'level', options: ['Easy', 'Normal', 'Hard'], value: 'Normal' }] } }), S = game.settings;
  check(`${ed}: settings have their defaults`, S.volume === .7 && S.sound === true && S.shake === 1 && S.scale === 'auto' && S.fullscreen === null, JSON.stringify(S));
  check(`${ed}: a slider is kept in range, a bad value changes nothing`, S.set('volume', 3) === 1 && S.set('volume', 'loud') === 1 && S.set('volume', .25) === .25 && game.audio.volume === .25);
  check(`${ed}: a choice must be one of its options`, S.set('scale', 'huge') === 'auto' && S.set('scale', 'sharp') === 'sharp' && game.screen.scale === 'sharp');
  check(`${ed}: a game's own settings sit beside them (toggle and choice inferred)`, S.hints === true && S.spec('hints').type === 'toggle' && S.spec('level').type === 'select' && S.set('level', 'Hard') === 'Hard' && S.set('level', 'Insane') === 'Hard' && S.keys('Game').join() === 'hints,level');
  check(`${ed}: a setting cannot take a name the settings object uses`, S.define({ key: 'set', value: 1 }) === undefined && S.define({ key: 'saved', value: 1 }) === undefined && typeof S.set === 'function');
  check(`${ed}: JSON of game.settings is the values alone`, JSON.parse(JSON.stringify(S)).volume === .25 && !('_specs' in JSON.parse(JSON.stringify(S))));
  S.reset('Sound'); check(`${ed}: reset(group) puts a group back to its defaults`, S.volume === .7 && S.level === 'Hard');
  S.set('shake', 0); game.shake(5); check(`${ed}: settings.shake 0 means no shake`, game._shakeAmt === 0);
  S.set('flashes', .5); game.flash('#fff', .1, 1); check(`${ed}: settings.flashes dims flashes`, game._flash.k === .5);
  // pausing
  game.start({ scenes: scenes(), scene: 'play' }); game.advance(1 / 60);
  check(`${ed}: pause(reason) and resume()`, game.pause('focus') && game.paused && game.pauseReason === 'focus' && !game.pause('player') && (game.resume(), !game.paused && game.pauseReason === null));
  game.input.tap('pause'); game.advance(1 / 60); const byKey = game.paused && game.pauseReason === 'player'; game.input.tap('pause'); game.advance(1 / 60);
  check(`${ed}: the pause action sets pauseReason 'player', resuming clears it`, byKey && !game.paused && game.pauseReason === null);
  game.input.padIndex = 0; game.input.lastDevice = 'gamepad'; game.advance(1 / 120);   // (no gamepads here: the one in use is gone)
  check(`${ed}: a pausable scene pauses when the controller in use is unplugged`, game.paused && game.pauseReason === 'controller', game.pauseReason);
  game.resume(); game.go('title', null, { fade: 0 }); game.advance(1 / 60); game.input.padIndex = 0; game.input.lastDevice = 'gamepad'; game.advance(1 / 120);
  check(`${ed}: a title doesn't pause for it`, !game.paused);
  // the touch START: Start on a title, pause in play
  game.input.press('Act:menu'); game.advance(1 / 120); const started = game.input.pressed('start'); game.input.release('Act:menu');
  game.go('play', null, { fade: 0 }); game.advance(1 / 60); game.input.press('Act:menu'); game.advance(1 / 120); game.input.release('Act:menu');
  check(`${ed}: the touch START (Act:menu) starts a title and pauses a scene in play`, started && game.paused);
  const own = new E.Game({ headless: true, input: { start: ['Enter'], pause: ['Escape'], jump: ['Space'] } }).input.map;
  check(`${ed}: a game's own input layout gets the touch START too`, own.start.includes('Act:menu') && own.pause.includes('Act:menu') && !own.jump.includes('Act:menu'), JSON.stringify(own));
  // labels
  const I = game.input;
  check(`${ed}: input.label: the key, the mouse button, the gamepad button`, I.label('attack', 'keyboard') === 'J' && I.label('attack', 'mouse') === 'Left click' && I.label('attack', 'gamepad') === 'A' && I.label('up', 'keyboard') === 'W', [I.label('attack', 'keyboard'), I.label('attack', 'mouse'), I.label('attack', 'gamepad')].join());
  S.set('glyphs', 'playstation'); const ps = I.label('attack', 'gamepad'); S.set('glyphs', 'nintendo'); const nin = I.label('attack', 'gamepad'); S.set('glyphs', 'auto'); I.padId = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c)'; const auto = I.label('dash', 'gamepad'); I.padId = '';
  check(`${ed}: gamepad symbols by family (chosen, or from the controller's name)`, ps === '✕' && nin === 'B' && auto === '○', [ps, nin, auto].join());
  // boot, headless: the steps at once, in order; a failing one stops the start; a promise is waited for
  const order = [], gb = new E.Game({ headless: true });
  gb.start({ scenes: scenes(), scene: 'title', boot: { steps: [['One', () => order.push(1)], ['Two', g => order.push(g === gb ? 2 : 0)]] } });
  check(`${ed}: boot steps run in order, then the game starts (headless: at once)`, order.join() === '1,2' && gb.sceneName === 'title' && typeof gb.booted.then === 'function', order.join() + ' ' + gb.sceneName);
  const gf = new E.Game({ headless: true }); gf.start({ scenes: scenes(), scene: 'title', boot: { steps: [['Raising the harbour', () => { throw new Error('no tiles'); }], ['Never', () => order.push(9)]] } });
  check(`${ed}: a failing boot step stops the start and is in game.errors`, gf.sceneName === null && gf.bootError.message === 'no tiles' && /Raising the harbour/.test(gf.errors[0].where) && !order.includes(9), JSON.stringify(gf.errors.map(e => e.where)));
  const gp = new E.Game({ headless: true }); gp.start({ scenes: scenes(), scene: 'title', boot: { steps: [['Loading', () => new Promise(r => setTimeout(r, 5))]] } });
  const before = gp.sceneName; await gp.booted;
  check(`${ed}: a boot step's promise is waited for (await game.booted)`, before === null && gp.sceneName === 'title');
  const dg = E.diagnose(gb);
  check(`${ed}: E.diagnose() gives the report: its lines and a short one`, /^Engine +my-3D2dge v/.test(dg.text) && /Canvas +none \(headless\)/.test(dg.text) && /Scene +title/.test(dg.text) && dg.short.startsWith('v' + E.version), dg.text);
  if (ed === 'full') {
    check(`${ed}: rebind: done, then a conflict and a reserved code change nothing`, I.rebind('attack', 'keys', 'KeyF') === null && I.map.attack.includes('KeyF') && !I.map.attack.includes('KeyJ') && I.rebind('dash', 'keys', 'KeyF') === 'attack' && I.rebind('attack', 'keys', 'Escape') === 'reserved' && I.rebind('pause', 'keys', 'KeyQ') === 'reserved', JSON.stringify(I.map.attack));
    check(`${ed}: rebinding saves in settings.bindings and survives input.use()`, S.bindings.attack.keys[0] === 'KeyF' && (I.use(I.preset), I.map.attack.includes('KeyF')));
    I.rebind('up', 'keys', 'KeyI');
    check(`${ed}: the arrow keys and d-pad stay on the moves`, I.map.up.includes('KeyI') && I.map.up.includes('ArrowUp') && I.map.up.includes('Pad12') && !I.map.up.includes('KeyW'));
    I.resetBindings(); check(`${ed}: resetBindings() puts every action back`, I.map.attack.includes('KeyJ') && I.map.up.includes('KeyW') && JSON.stringify(S.bindings) === '{}');
    const g2 = new E.Game({ headless: true, menu: { controls: { skill: false, attack: 'Sword' } } }); g2.input.names = { skill: false, attack: 'Sword' };
    check(`${ed}: menu.controls hides an action from rebinding`, !g2.input.rebindable('skill') && g2.input.rebindable('attack') && !g2.input.rebindable('confirm'));
    // the player's zoom (camera: { zoom }): applied a quarter second after they stop, in steps unscaled by timeScale; a
    // factor carried from a scene with more room moves at the first step; a game's own setting called zoom is its own
    const gz = new E.Game({ headless: true }), zs = { a: { camera: { zoom: [.75, 2] }, update() {}, draw() {} }, b: { camera: { zoom: [.75, 1.5] }, update() {}, draw() {} } };
    gz.start({ scenes: zs, scene: 'a' }); gz.advance(1 / 60); gz.timeScale = 0; gz.zoomBy(1.2); const held = gz.zoom; gz.advance(.4);
    check(`${ed}: the player's zoom is drawn a quarter second after they stop, slow motion or stopped (timeScale 0) too`, held === 1 && gz.zoom === 1.2, `${held} then ${gz.zoom}`);
    gz.timeScale = 1; gz.settings.set('zoom', 2); gz.advance(.4); gz.go('b', null, { fade: 0 }); gz.advance(.1); const top = gz.zoom; gz.zoomBy(1 / 1.1); gz.advance(.4);
    check(`${ed}: a zoom carried into a scene with less room (2x into a 1.5x one) moves at the first step out`, top === 1.5 && gz.zoom < 1.5, `${top} then ${gz.zoom}`);
    const go = new E.Game({ headless: true, menu: { settings: [{ key: 'zoom', label: 'Map zoom', options: ['near', 'far'], value: 'near' }] } });
    go.start({ scenes: zs, scene: 'a' }); go.advance(1 / 60); go.zoomBy(1.2); go.advance(.4);
    check(`${ed}: a game's own setting called zoom stays its own (no camera zoom from it)`, go.settings.zoom === 'near' && go.zoom === 1 && !go._zoomStd(), `${go.settings.zoom}, ${go.zoom}x`);
  }
}

// ---- in Chromium: the page, the corner, the menu, saved settings, touch
if (!process.argv.includes('--node')) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const [ed, file] of EDITIONS) {
    console.log(`\n${ed} edition (Chromium)`);
    const splash = load(file).bootSplash('HARBOUR');
    const engine = readFileSync(join(root, file), 'utf8').replace(/<\/script/gi, '<\\/script');
    // a page on an origin of its own (localStorage works there), the engine, and a small game with a title and a pausable play scene
    const PAGE = (opts = '{}') => `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#000"><canvas id="screen" style="width:100vw;height:100vh;display:block"></canvas><script>${engine}</script><script>
      const E = My3D2dge, game = new E.Game(Object.assign({ canvas: 'screen', res: 'snes', loop: false }, ${opts}));
      window.played = 0;
      game.start({ scene: 'title', scenes: { title: { update() { if (game.input.pressed('start')) game.go('play', null, { fade: 0 }); }, draw(r) { r.sky(['#102', '#204']); } },
        play: { pausable: true, touch: ['jump', 'attack'], update() { window.played++; }, draw(r) { r.sky(['#210', '#420']); } } } });
      window.step = (n = 2) => { for (let i = 0; i < n; i++) game.advance(1 / 60, { draw: true }); };
      step(); </script></body></html>`;
    const desk = await browser.newContext();   // (one context: its storage lasts from page to page, as a browser's does)
    const open = async (opts, ctx = desk, url = 'http://standard.test/game.html') => {
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.route('http://standard.test/**', r => r.fulfill({ contentType: 'text/html', body: PAGE(opts) }));
      await page.goto(url); page.errors = errors; return page;
    };
    const ev = (page, f, a) => page.evaluate(f, a);
    let p = await open();
    // the page made for phones
    const pg = await ev(p, () => ({ vp: document.querySelector('meta[name=viewport]').content, ta: getComputedStyle(document.getElementById('screen')).touchAction }));
    check(`${ed}: the page gets a viewport reaching the safe areas (pinch zoom left alone) and no page gestures on the canvas`, /viewport-fit=cover/.test(pg.vp) && !/user-scalable/.test(pg.vp) && pg.ta === 'none', JSON.stringify(pg));
    // the corner
    const corner = () => ev(p, () => { const c = document.getElementById('e3-corner'); return c && c.style.display !== 'none' ? [...c.children].filter(b => b.style.display !== 'none').map(b => b.getAttribute('aria-label')).join() : ''; });
    const onTitle = await corner();
    await p.keyboard.press('Enter'); await ev(p, () => step(3)); const inPlay = await corner();
    check(`${ed}: the corner's buttons show on a title (the agent edition: full screen alone, its menu is a pause) and hide in play`, onTitle === (ed === 'full' ? 'Menu,Full screen' : 'Full screen') && inPlay === '', onTitle + ' | ' + inPlay);
    // pausing by itself
    await ev(p, () => { window.dispatchEvent(new Event('blur')); step(); }); const blur = await ev(p, () => [game.paused, game.pauseReason]);
    await ev(p, () => { window.dispatchEvent(new Event('focus')); step(3); }); const back = await ev(p, () => game.paused);
    check(`${ed}: a scene in play pauses when the window loses focus, and stays paused when it comes back`, blur[0] && blur[1] === 'focus' && back, JSON.stringify([blur, back]));
    const whilePaused = await corner();
    if (ed === 'agent') {
      check(`${ed}: while paused the corner shows its menu button`, /Menu/.test(whilePaused), whilePaused);
      await p.click('#e3-corner button[aria-label=Menu]'); await ev(p, () => step());
      check(`${ed}: the corner's menu button resumes (and pauses) a scene in play`, !(await ev(p, () => game.paused)));
    } else {
      const pz = await ev(p, () => [game.shell && game.shell.screen, [...document.querySelectorAll('.esh-sh button')].map(b => b.textContent).join(), document.activeElement.textContent]);
      check(`${ed}: the pause screen opens by itself (Resume, Settings, Controls, Full screen, Quit to title), Resume focused; the corner hides`, pz[0] === 'pause' && pz[1] === 'Resume,Settings,Controls,Full screen,Quit to title' && pz[2] === 'Resume' && whilePaused === '', JSON.stringify(pz) + ' corner ' + whilePaused);
      // Settings by the keyboard, a slider turned by the arrows
      await p.keyboard.press('ArrowDown'); await ev(p, () => step()); await p.keyboard.press('Enter'); await ev(p, () => step());
      const vol0 = await ev(p, () => game.settings.volume);
      await ev(p, () => { const r = [...document.querySelectorAll('.esh-row')].find(r => /^Volume/.test(r.textContent)).querySelector('input'); r.focus(); });
      await p.keyboard.press('ArrowRight'); await ev(p, () => step()); await p.keyboard.press('ArrowRight'); await ev(p, () => step());
      const st = await ev(p, () => [game.shell.screen, game.settings.volume, game.audio.volume, [...document.querySelectorAll('.esh-k.esh-sec')].map(e => e.textContent).join()]);
      check(`${ed}: Settings: Display, Sound and Comfort; the arrows turn a slider, applied at once`, st[0] === 'settings' && st[1] > vol0 && st[2] === st[1] && st[3] === 'Display,Sound,Comfort', JSON.stringify([vol0, st]));
      await p.keyboard.press('Escape'); await ev(p, () => step());
      // Controls: rebind by pressing the key; a conflict is said and changes nothing; Escape cancels
      await ev(p, () => [...document.querySelectorAll('.esh-sh button')].find(b => b.textContent === 'Controls').click()); await ev(p, () => step());
      await p.click('.esh-bind button[aria-label^="Jump, keyboard"]'); await p.keyboard.press('KeyF'); await ev(p, () => step());
      const rb = await ev(p, () => [game.input.map.jump.includes('KeyF'), document.querySelector('.esh-status').textContent, game.settings.bindings.jump && game.settings.bindings.jump.keys]);
      await p.click('.esh-bind button[aria-label^="Attack, keyboard"]'); await p.keyboard.press('KeyF'); await ev(p, () => step());
      const cf = await ev(p, () => [document.querySelector('.esh-status').textContent, game.input.map.attack.includes('KeyF')]);
      await p.keyboard.press('Escape'); await ev(p, () => step());
      const cancel = await ev(p, () => [document.querySelector('.esh-status').textContent, game.shell.screen]);
      check(`${ed}: Controls: a key is rebound by pressing it, and saved`, rb[0] && /Jump: F/.test(rb[1]) && rb[2] && rb[2][0] === 'KeyF', JSON.stringify(rb));
      check(`${ed}: Controls: a conflict is said and changes nothing; Escape cancels the binding, not the screen`, /already Jump/.test(cf[0]) && !cf[1] && /Not changed/.test(cancel[0]) && cancel[1] === 'controls', JSON.stringify([cf, cancel]));
      // P closes the whole menu and resumes; the game sees none of it
      const before = await ev(p, () => window.played);
      await p.keyboard.press('KeyP'); await ev(p, () => step(4));
      const closed = await ev(p, () => [game.shell.screen, game.paused, window.played]);
      check(`${ed}: P (or Start) closes the menu and resumes`, closed[0] === null && !closed[1] && closed[2] > before, JSON.stringify(closed));
      // Quit to title asks first, with Keep playing focused
      await p.keyboard.press('Escape'); await ev(p, () => step(2));
      await ev(p, () => [...document.querySelectorAll('.esh-sh button')].find(b => b.textContent === 'Quit to title').click()); await ev(p, () => step());
      const q = await ev(p, () => [game.shell.screen, document.activeElement.textContent]);
      await p.keyboard.press('Escape'); await ev(p, () => step());
      const q2 = await ev(p, () => game.shell.screen);
      await ev(p, () => [...document.querySelectorAll('.esh-sh button')].find(b => b.textContent === 'Quit to title').click()); await ev(p, () => step());
      await ev(p, () => [...document.querySelectorAll('.esh-sh button')].find(b => b.textContent === 'Quit').click()); await ev(p, () => step(30));
      const q3 = await ev(p, () => [game.sceneName, game.paused, game.shell.screen]);
      check(`${ed}: Quit to title asks first (Keep playing focused, Escape goes back), then goes`, q[0] === 'confirm' && q[1] === 'Keep playing' && q2 === 'pause' && q3[0] === 'title' && !q3[1] && q3[2] === null, JSON.stringify([q, q2, q3]));
      // the corner's menu on a title: the settings, the title waiting under them, then going on
      await p.click('#e3-corner button[aria-label=Menu]'); await ev(p, () => step());
      const t1 = await ev(p, () => [game.shell.screen, game.paused]); await p.keyboard.press('Escape'); await ev(p, () => step());
      const t2 = await ev(p, () => [game.shell.screen, game.paused]);
      check(`${ed}: the corner's menu on a title opens the settings; the title waits, then goes on`, t1[0] === 'settings' && t1[1] && t2[0] === null && !t2[1], JSON.stringify([t1, t2]));
    }
    // saved settings: loaded back on the next visit; bad saved values fall back to their defaults
    await ev(p, () => { game.settings.set('volume', .3); game.settings.set('scale', 'fill'); });
    await p.close(); p = await open();
    const again = await ev(p, () => [game.settings.volume, game.settings.scale, game.audio.volume, JSON.parse(localStorage.getItem('my3d2dge:settings:/game.html')).v]);
    check(`${ed}: settings are saved per game with a version and loaded back`, again[0] === .3 && again[1] === 'fill' && again[2] === .3 && again[3] === 2, JSON.stringify(again));
    await ev(p, () => localStorage.setItem('my3d2dge:settings:/game.html', JSON.stringify({ v: 1, values: { fullscreen: false, volume: .3 } })));
    await p.close(); p = await open();
    const v1 = await ev(p, () => [game.settings.fullscreen, game.settings.volume]);
    check(`${ed}: a version 1 save's full screen false (it also meant left by a gesture) is forgotten, the rest kept`, v1[0] === null && v1[1] === .3, JSON.stringify(v1));
    await ev(p, () => localStorage.setItem('my3d2dge:settings:/game.html', JSON.stringify({ v: 1, values: { volume: 'loud', scale: 'huge', sound: 'yes', shake: 2 } })));
    await p.close(); p = await open();
    const bad = await ev(p, () => [game.settings.volume, game.settings.scale, game.settings.sound, game.settings.shake]);
    check(`${ed}: bad saved values fall back to their defaults (a slider's out-of-range value is kept in range)`, bad.join() === '0.7,auto,true,1', JSON.stringify(bad));
    await ev(p, () => localStorage.setItem('my3d2dge:settings:/game.html', '{not json'));
    await p.close(); p = await open();
    check(`${ed}: a broken save loads as the defaults`, (await ev(p, () => game.settings.volume)) === .7 && !p.errors.length, p.errors.join());
    await ev(p, () => { Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); }; game.settings.set('volume', .4); });
    const blocked = await ev(p, () => [game.settings.saved, game.settings.volume, game.audio.volume]);
    check(`${ed}: blocked storage: the change lasts for the visit, saved is false`, blocked.join() === 'false,0.4,0.4', JSON.stringify(blocked));
    await p.close();
    // autoPause: false keeps a scene running
    p = await open('{ autoPause: false }');
    await p.keyboard.press('Enter'); await ev(p, () => { step(2); window.dispatchEvent(new Event('blur')); step(); });
    check(`${ed}: autoPause: false keeps a pausable scene running when focus goes`, !(await ev(p, () => game.paused)));
    await p.close();
    // a fixed resolution on a high-density screen fills it ('auto'), or keeps whole pixels ('sharp')
    const hd = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3 });
    p = await open('{}', hd);
    const S1 = await ev(p, () => game.screen.S); await ev(p, () => game.settings.set('scale', 'sharp')); const S2 = await ev(p, () => game.screen.S);
    check(`${ed}: a fixed resolution fills a high-density screen ('auto'), whole pixels with 'sharp'`, S1 > 5.2 && S1 % 1 !== 0 && S2 === 5, S1 + ' / ' + S2);
    await hd.close();
    // full screen: a phone's first tap goes there, and a game started by a tap goes back after a gesture left it; turning it
    // off with the corner's button (or the menu) is the player's choice, kept: the next visit's tap leaves the page as it is
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    p = await open('{}', phone);
    await p.touchscreen.tap(200, 700); await p.waitForTimeout(150); await ev(p, () => step());
    const tapped = await ev(p, () => [!!document.fullscreenElement, game.settings.fullscreen]);
    await ev(p, () => document.exitFullscreen()); await p.waitForTimeout(150); await ev(p, () => step());   // a back gesture or Escape: not a choice
    const left = await ev(p, () => [!!document.fullscreenElement, game.settings.fullscreen]);
    await p.touchscreen.tap(200, 700); await ev(p, () => { game.go('play', null, { fade: 0 }); step(); }); await p.waitForTimeout(150);   // a game started by a tap
    const started = await ev(p, () => [!!document.fullscreenElement, game.sceneName]);
    await ev(p, () => { game.go('title', null, { fade: 0 }); step(2); });
    const lv = await p.$('#e3-corner button:last-child'), lvb = await lv.boundingBox();
    await p.touchscreen.tap(lvb.x + 20, lvb.y + 20); await p.waitForTimeout(150); await ev(p, () => step());
    const off = await ev(p, () => [!!document.fullscreenElement, game.settings.fullscreen]);
    await p.close(); p = await open('{}', phone);
    await p.touchscreen.tap(200, 700); await p.waitForTimeout(150);
    const stays = await ev(p, () => !!document.fullscreenElement);
    const fb = await p.$('#e3-corner button[aria-label="Full screen"]'), box = await fb.boundingBox();
    await p.touchscreen.tap(box.x + 20, box.y + 20); await p.waitForTimeout(150); await ev(p, () => step());
    const byButton = await ev(p, () => [!!document.fullscreenElement, game.settings.fullscreen, document.querySelector('#e3-corner button:last-child').getAttribute('aria-label')]);
    check(`${ed}: a phone's first tap goes full screen, and a game started by a tap goes back after a gesture left it; the corner's button turning it off is kept (the next visit's tap leaves the page as it is), and turns it on`,
      tapped.join() === 'true,' && left.join() === 'false,' && started.join() === 'true,play' && off.join() === 'false,false' && !stays && byButton.join() === 'true,true,Leave full screen', JSON.stringify([tapped, left, started, off, stays, byButton]));
    if (ed === 'full') {
      // touch buttons: no START among them: the corner's menu button is it (top right, there in play on a touch screen), and
      // it pauses into the menu; the player's side, size and visibility
      await ev(p, () => document.fullscreenElement && document.exitFullscreen()); await p.waitForTimeout(100);
      await ev(p, () => { game.input.tap('start'); step(3); });
      const tb = await ev(p, () => [...document.querySelectorAll('[data-sys=touch] button')].map(b => b.textContent)), inPlay = await corner();
      const ca = await ev(p, () => { const a = game.cornerArea(); return a && [a.x0 > game.W / 2, a.y0 < 30]; });
      const mb = await p.$('#e3-corner button[aria-label=Menu]'), mbb = await mb.boundingBox();
      await p.touchscreen.tap(mbb.x + 22, mbb.y + 22); await ev(p, () => step(2));
      const paused = await ev(p, () => [game.paused, game.shell.screen]);
      check(`${ed}: touch buttons without START; the corner's menu button stays in play (game.cornerArea() at the top right) and pauses into the menu`, tb.join() === 'JUMP,ATTACK' && inPlay === 'Menu' && ca && ca.join() === 'true,true' && paused[0] && paused[1] === 'pause', JSON.stringify([tb, inPlay, ca, paused]));
      // the way out of a menu screen, always in sight: close (top right), back (top left) over another screen, a sideways swipe
      const nav = () => ev(p, () => [game.shell.screen, [...document.querySelectorAll('.esh-nav')].map(b => b.getAttribute('aria-label')).join()]);
      const n1 = await nav(); await ev(p, () => { [...document.querySelectorAll('.esh-sh button')].find(b => b.textContent === 'Settings').click(); step(); }); const n2 = await nav();
      await ev(p, () => {   // a finger dragged sideways over the screen (pointer events, as a touch screen sends them)
        const el = document.querySelector('.esh-sh h2'), at = (type, x) => el.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: 7, clientX: x, clientY: 95, bubbles: true }));
        at('pointerdown', 60); for (let i = 1; i <= 6; i++) at('pointermove', 60 + i * 35); at('pointerup', 270);
      });
      await p.waitForTimeout(300); await ev(p, () => step());
      const n3 = await nav(); await ev(p, () => { game.shell.show('settings'); step(); });
      const bk = await p.$('.esh-nav.bk'), bkb = await bk.boundingBox(); await p.touchscreen.tap(bkb.x + 22, bkb.y + 22); await ev(p, () => step()); const n4 = await nav();
      const xx = await p.$('.esh-nav.x'), xb = await xx.boundingBox(); await p.touchscreen.tap(xb.x + 22, xb.y + 22); await ev(p, () => step(2));
      const n5 = await ev(p, () => [game.shell.screen, game.paused]);
      check(`${ed}: a menu screen has a close button, another under it a back one too; a sideways swipe and back go back a screen, close resumes`,
        n1.join() === 'pause,Close' && n2.join() === 'settings,Close,Back' && n3[0] === 'pause' && n4[0] === 'pause' && n5.join() === ',false', JSON.stringify([n1, n2, n3, n4, n5]));
      // the phone's back gesture: after a tap in play, back pauses into the menu instead of leaving the page
      await p.touchscreen.tap(330, 420); await ev(p, () => step());
      const guard = await ev(p, () => history.state && history.state.e3);
      await ev(p, () => history.back()); await p.waitForTimeout(250); await ev(p, () => step(2));
      const backed = await ev(p, () => [location.href, game.paused, game.shell.screen]);
      check(`${ed}: the back gesture in play opens the menu (an entry of the game's own in the page's history) instead of leaving`, guard === 'back' && /game\.html/.test(backed[0]) && backed[1] && backed[2] === 'pause', JSON.stringify([guard, backed]));
      await ev(p, () => { game.shell.hide(); step(); });
      // context buttons: a label and whether one shows change as the moment does (hidden: out of the touch area)
      const ctx1 = await ev(p, () => { const I = game.input, w0 = I.touchArea(); I.touchSet('attack', 'TALK'); I.touchSet('jump', null, false); const w1 = I.touchArea();
        const r = [[...document.querySelectorAll('[data-sys=touch] button')].map(b => b.style.display === 'none' ? '-' : b.textContent).join(), w1.x0 > w0.x0]; I.touchSet('jump'); I.touchSet('attack'); return r.concat([...document.querySelectorAll('[data-sys=touch] button')].map(b => b.textContent).join()); });
      check(`${ed}: input.touchSet relabels and hides a touch button (TALK beside someone), and puts it back`, ctx1.join() === '-,TALK,true,JUMP,ATTACK', JSON.stringify(ctx1));
      await ev(p, () => { game.settings.set('hand', 'left'); game.settings.set('touchSize', 80); step(); });
      const lb = await ev(p, () => { const box = document.querySelector('[data-sys=touch]').getBoundingClientRect(), b = document.querySelector('[data-sys=touch] [data-act=jump]').getBoundingClientRect(); return [Math.round(box.left), Math.round(b.width), game.input.stickSide]; });
      await ev(p, () => { game.settings.set('touch', 'off'); step(); });
      const offT = await ev(p, () => [!!document.querySelector('[data-sys=touch]'), game.input.touchEnabled]);
      check(`${ed}: touch buttons follow the player's side, size and visibility`, lb[0] < 40 && lb[1] === 80 && lb[2] === 'right' && offT.join() === 'false,false', JSON.stringify([lb, offT]));
      // a game's own E.Shell takes over from the engine's: one interface, the standard menu in it
      const own = await ev(p, () => { const ui = new E.Shell(game, { screens: { help: { keys: [['W', 'Up']] } } }); game.pause(); step(); return [document.querySelectorAll('.esh').length, game.shell === ui, [...document.querySelectorAll('.esh-sh button')].map(b => b.textContent).join()]; });
      check(`${ed}: a game's own E.Shell takes over from the engine's, with the standard menu`, own[0] === 1 && own[1] && /Resume,Settings,Controls/.test(own[2]) && /Help/.test(own[2]), JSON.stringify(own));
      // menu: false: the canvas pause, no screens
      await p.close(); p = await open('{ menu: false }');
      await p.keyboard.press('Enter'); await ev(p, () => step(2)); await p.keyboard.press('Escape'); await ev(p, () => step(2));
      check(`${ed}: menu: false leaves the menu out (the canvas pause instead)`, (await ev(p, () => [game.paused, game.shell, !!document.querySelector('.esh')])).join() === 'true,,false');
      // Camera zoom shows only where a scene lets the player zoom; a game's own setting called zoom always shows
      const rows = () => ev(p, () => { game.shell.show('settings'); step(); return [...document.querySelectorAll('.esh-row > span:first-child')].map(s => s.firstChild.textContent); });
      await p.close(); p = await open(); const plain = await rows();
      await p.close(); p = await open("{ menu: { settings: [{ key: 'zoom', label: 'Map zoom', options: ['near', 'far'], value: 'near' }] } }"); const ownZoom = await rows();
      check(`${ed}: Camera zoom is left out of a game with no zoom; a game's own setting called zoom stays on the screen`, !plain.includes('Camera zoom') && plain.includes('Volume') && ownZoom.includes('Map zoom') && !ownZoom.includes('Camera zoom'), `${plain.join(', ')} | ${ownZoom.join(', ')}`);
    }
    if (p.errors.length) check(`${ed}: no errors`, false, p.errors.join(' | '));
    await p.close(); await phone.close();
    // expand: the resolution is the least the screen shows; the picture fills the window at any shape, with no bars
    const fills = [];
    for (const [w, h, d] of [[1920, 1080, 1], [2560, 1080, 1], [1366, 768, 1], [844, 390, 3], [390, 844, 3]]) {
      const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: d }), q = await open('{ expand: true }', c);
      fills.push(await ev(q, () => { const S = game.screen; return [S.W, S.H, S.W >= 256 && S.H >= 224 && S.OX <= 0 && S.OY <= 0 && S.W * S.S >= S.canvas.width - 1 && S.H * S.S >= S.canvas.height - 1]; }));
      await c.close();
    }
    check(`${ed}: expand fills a desktop, an ultrawide, a laptop and a phone both ways with no bars, showing at least the resolution`, fills.every(f => f[2]), JSON.stringify(fills));
    if (ed === 'full') {
      // the touch stick past halfway presses the directions as a d-pad does, and lets go; a bottom dialog keeps clear of the touch buttons
      const tc = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const q = await open('{ fullscreen: false, expand: true }', tc), cdp = await tc.newCDPSession(q);
      await ev(q, () => { game.input.tap('start'); step(3); });   // into play, where the touch buttons show
      const finger = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 90, y, id: 1 }] });
      await finger('touchStart', 520); await finger('touchMove', 505); const nudge = await ev(q, () => game.input.down('up'));
      await ev(q, () => step(1)); await finger('touchMove', 440); const up = await ev(q, () => [game.input.down('up'), game.input.move()[1] < -.9]);
      const drag = await ev(q, () => { const one = () => game.advance(1 / 120); one(); const d = game.input.drag(), k = game.screen.dpr / game.screen.S; one(); return [d && Math.round(d[1] / k), game.input.drag() && game.input.drag()[1]]; });   // (one update step each)
      await finger('touchEnd'); const off = await ev(q, () => [game.input.down('up'), (game.advance(1 / 120), game.input.drag())]);
      check(`${ed}: the touch stick past halfway presses up (a nudge does not), and lets go when lifted`, !nudge && up.join() === 'true,true' && !off[0], JSON.stringify([nudge, up, off]));
      check(`${ed}: input.drag(): the stick finger's travel in the step it moved (screen pixels), nothing the next, null once lifted`, drag.join() === '-65,0' && off[1] === null, JSON.stringify([drag, off]));
      const dl = await ev(q, () => { const d = new E.Dialog(game); d.say('A line long enough to cross the screen from side to side'); const b = d._dims(), t = game.input.touchArea(); return [b.x, b.y, b.w, b.h, t && [t.x0, t.y0, t.x1, t.y1]]; });
      const [dx, dy, dw, dh, ta] = dl;
      check(`${ed}: a bottom dialog keeps clear of the touch buttons`, !!ta && (dx + dw <= ta[0] || dx >= ta[2] || dy + dh <= ta[1]) && dy > 100, JSON.stringify(dl));
      // a tap or a click on a menu entry picks it (a title can be left without keys); a tap on a dialog box turns its page
      const at = (gx, gy) => ev(q, ([x, y]) => { const S = game.screen, rc = S.canvas.getBoundingClientRect(); return [rc.left + (x * S.S + S.OX) / S.dpr, rc.top + (y * S.S + S.OY) / S.dpr]; }, [gx, gy]);
      const mb = await ev(q, () => { window.picked = -1; const m = window.mm = new E.Menu(game, ['ONE', 'TWO', 'THREE'], { onPick: i => { window.picked = i; } }); game.scene.update = () => m.update(); game.scene.draw = r => m.draw(r); step(2); return m._box; });
      const t3 = await at(mb.x + 10, mb.y + mb.rowH * 2.5); await q.touchscreen.tap(t3[0], t3[1]); await ev(q, () => step(2)); const byTap = await ev(q, () => window.picked);
      await ev(q, () => { window.picked = -1; }); const c1 = await at(mb.x + 10, mb.y + mb.rowH * .5); await q.mouse.click(c1[0], c1[1]); await ev(q, () => step(2)); const byClick = await ev(q, () => window.picked);
      const beside = await at(mb.x - 30, mb.y - 20); await ev(q, () => { window.picked = -1; }); await q.touchscreen.tap(beside[0], beside[1]); await ev(q, () => step(2)); const outside = await ev(q, () => window.picked);
      check(`${ed}: a tap or a click on a menu entry picks it, a tap beside the menu does not`, byTap === 2 && byClick === 0 && outside === -1, JSON.stringify([byTap, byClick, outside]));
      // a phone's first tap goes full screen: the change can land before the next step, and moves the canvas; the tap still picks what it touched
      await ev(q, () => { window.picked = -1; }); await q.touchscreen.tap(c1[0], c1[1]);
      await ev(q, () => { game.screen.canvas.style.marginTop = '60px'; document.dispatchEvent(new Event('fullscreenchange')); step(2); game.screen.canvas.style.marginTop = ''; });
      const byFsTap = await ev(q, () => window.picked);
      check(`${ed}: a tap whose full-screen change lands before the next step still picks the entry it touched`, byFsTap === 0, JSON.stringify(byFsTap));
      // a finger that lands on an entry and drags away (the touch stick) picks nothing; a tap anywhere makes the device touch
      await ev(q, () => { window.picked = -1; game.input.lastDevice = 'keyboard'; });
      const touchAt = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 2 }] });
      await touchAt('touchStart', t3[0], t3[1]); await touchAt('touchMove', t3[0] + 20, t3[1] + 30); await touchAt('touchMove', t3[0] + 40, t3[1] + 60); await touchAt('touchEnd'); await ev(q, () => step(2));
      const dragged = await ev(q, () => window.picked);
      await ev(q, () => { game.input.lastDevice = 'keyboard'; });
      const rp = await ev(q, () => { const S = game.screen, rc = S.canvas.getBoundingClientRect(); return [rc.left + rc.width * .85, rc.top + rc.height * .2]; });
      await q.touchscreen.tap(rp[0], rp[1]); await ev(q, () => step(1)); const dev = await ev(q, () => game.input.lastDevice);
      check(`${ed}: a drag across a menu entry picks nothing; a tap on the stick-free half makes the device touch`, dragged === -1 && dev === 'touch', JSON.stringify([dragged, dev]));
      const db = await ev(q, () => { const d = window.dd = new E.Dialog(game); d.say(['Page one', 'Page two']); game.scene.update = dt => d.update(dt); game.scene.draw = r => d.draw(r); step(2); return d._dims(); });
      const dt = await at(db.x + db.w / 2, db.y + db.h / 2);
      for (let i = 0; i < 2; i++) { await q.touchscreen.tap(dt[0], dt[1]); await ev(q, () => step(2)); }
      check(`${ed}: a tap on a dialog box finishes the line, then turns the page`, await ev(q, () => window.dd.i === 1 && window.dd.open), await ev(q, () => JSON.stringify([window.dd.i, window.dd.shown, window.dd.open])));
      if (q.errors.length) check(`${ed}: no errors (touch)`, false, q.errors.join(' | '));
      await tc.close();
    }
    // the boot screen, in a page with the splash and a live loop
    const BOOTPAGE = (body, boot) => `<!doctype html><html><head><meta charset="utf-8"><title>Harbour</title></head><body style="margin:0;background:#000">${splash}<canvas id="screen" style="width:100vw;height:100vh;display:block"></canvas><script>${engine}</script><script>
      const E = My3D2dge, game = new E.Game({ canvas: 'screen', res: 'snes' }); window.draws = 0; window.hold = new Promise(r => { window.letGo = r; });
      const R = Math.random; window.randoms = 0; Math.random = () => { window.randoms++; return R(); };
      ${body}
      game.start({ scene: 'play', scenes: { play: { pausable: true, update() { if (window.boom) throw new Error('late'); }, draw(r) { window.draws++; r.sky(['#123', '#456']); } } }, boot: ${boot} });</script></body></html>`;
    const bootPage = async (body, boot) => { const q = await desk.newPage(), errors = []; q.on('pageerror', e => errors.push(e.message)); await q.route('http://standard.test/**', r => r.fulfill({ contentType: 'text/html', body: BOOTPAGE(body, boot) })); await q.goto('http://standard.test/boot.html'); q.errors = errors; return q; };
    let b = await bootPage('', "{ title: 'HARBOUR', version: '0.3', messages: ['Counting the bells'], steps: [['Raising the harbour', () => 1], ['Hanging the lanterns', () => window.hold]] }");
    await b.waitForTimeout(250);
    const mid = await ev(b, () => { const el = document.getElementById('e3-boot'); return el ? [el.innerText, window.draws, game.sceneName] : null; });
    await ev(b, () => window.letGo());
    check(`${ed}: the boot screen takes over the splash: the system's lines, each step, the game's lines; the game waits`, mid && /HARBOUR/.test(mid[0]) && /Engine +my-3D2dge/.test(mid[0]) && /Canvas +256x224/.test(mid[0]) && /Hanging the lanterns · 2 \/ 2/.test(mid[0]) && /Counting the bells/.test(mid[0]) && mid[1] === 0 && mid[2] === null, JSON.stringify(mid));
    await b.close();
    b = await bootPage('', "{ steps: [['Quick', () => 1]] }"); await b.waitForTimeout(800);
    const end = await ev(b, () => { const el = document.getElementById('e3-boot'); return [!!el && getComputedStyle(el).display !== 'none', window.draws > 1, game.sceneName, window.randoms]; });
    check(`${ed}: once the game has drawn under it the boot screen goes, and it drew no random numbers of the game's`, end[0] === false && end[1] && end[2] === 'play' && end[3] === 0, JSON.stringify(end));
    await ev(b, () => { window.boom = true; }); await b.waitForTimeout(150);
    const late = await ev(b, () => [!!document.getElementById('my3d2dge-error'), !!document.querySelector('#e3-boot[data-failed]'), (document.getElementById('my3d2dge-error') || {}).textContent || '']);
    check(`${ed}: after play an error goes to the red box, with the report's line`, late[0] && !late[1] && /v\d+\.\d+\.\d+ · /.test(late[2]), JSON.stringify(late));
    await b.close();
    b = await bootPage('', "{ title: 'HARBOUR', steps: [['Teaching the guards to look up', () => { throw new Error('guard.eyes is undefined'); }]] }"); await b.waitForTimeout(300);
    const failed = await ev(b, () => { const el = document.querySelector('#e3-boot[data-failed]'); return el ? [el.innerText, game.sceneName] : null; });
    check(`${ed}: a failing step turns the screen into a report: what failed, the error, a code, the engine, the canvas`, failed && /HARBOUR could not start/i.test(failed[0]) && /Teaching the guards to look up/.test(failed[0]) && /guard\.eyes is undefined/.test(failed[0]) && /E3-[0-9A-F]{6}/.test(failed[0]) && /Engine +my-3D2dge v/.test(failed[0]) && /Canvas +256x224/.test(failed[0]) && failed[1] === null, JSON.stringify(failed));
    await b.click('#e3-boot button:has-text("Continue")'); check(`${ed}: the report's Continue takes it away`, await ev(b, () => getComputedStyle(document.getElementById('e3-boot')).display === 'none'));
    await b.close();
    b = await bootPage("throw new Error('bad level rows');", "{}"); await b.waitForTimeout(300);
    const top = await ev(b, () => { const el = document.querySelector('#e3-boot[data-failed]'); return el ? el.innerText : ''; });
    check(`${ed}: a script error before play is reported on the boot screen`, /could not start/i.test(top) && /bad level rows/.test(top), top.slice(0, 200));
    await b.close();
    b = await bootPage('', 'false'); await b.waitForTimeout(200);
    check(`${ed}: boot: false takes the splash away at once`, (await ev(b, () => [getComputedStyle(document.getElementById('e3-boot')).display, game.sceneName])).join() === 'none,play');
    await b.close(); await desk.close();
  }
  await browser.close();
}
console.log(failures.length ? `\nFAILED ${failures.length} of ${passed + failures.length}:\n  ` + failures.join('\n  ') : `\nstandard features ok: ${passed} checks`);
process.exit(failures.length ? 1 : 0);
