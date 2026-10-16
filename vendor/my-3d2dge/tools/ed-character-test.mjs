// What every playable character must do (src/emberdeep/18-characters.js), checked in the built game, for one hero or
// all of them: its entry is complete and its body keeps the contract (checkRig); it is picked in the character menu
// and keeps its own save; it moves and dodges; every starting skill casts and one at least hurts; every shared skill
// works with its body and its Echo keeps that body; it arrives in a depth, drinks, is knocked down, dies and is revived;
// it shows on the paper doll, the title and in the gallery; it plays in every view and on a phone held upright.
// Usage: node tools/ed-character-test.mjs [--character codex | --all] [--page examples/emberdeep.html] [--out dir] [--quick]
//   --all (the default) tests every registered character; --quick skips the shared skills and the phone.
// Run node tools/build.mjs first (npm test does). Screenshots and results.json go to check-output/character-<id>.
// Exit code 1 on any failure, each with the reason in one line. Codex's own rules (its pages) stay in ed-codex-test.mjs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const url = pathToFileURL(resolve(opt('page', 'examples/emberdeep.html'))).href, quick = process.argv.includes('--quick');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const VIEWS = ['iso', 'threequarter', 'topdown', 'brawler'];

/** a page that records page errors, console errors and engine warnings (my-3D2dge: / EMBERDEEP:) */
async function open(ctx, address) {
  const p = await ctx.newPage(), log = { errors: [], warnings: [] };
  p.on('pageerror', e => log.errors.push(e.message));
  p.on('console', m => { const t = m.text(); if (m.type() === 'error') log.errors.push(t); else if (m.type() === 'warning' && /^(my-3D2dge|EMBERDEEP)/.test(t) && !/GPU lighting unavailable/.test(t)) log.warnings.push(t); });   // (no GPU here is not the hero's fault)
  await p.goto(address);
  await p.waitForFunction(() => window.__ed);
  return { p, log };
}
const key = async (p, code, ms = 90) => { await p.keyboard.down(code); await p.waitForTimeout(ms); await p.keyboard.up(code); await p.waitForTimeout(90); };
/** click (or tap) a canvas button by its label (the title menu, the pause menu) */
async function button(p, label, touch = false) {
  await p.waitForFunction(label => __ed.UI.hot.some(h => h.label === label), label, { timeout: 8000 });
  const xy = await p.evaluate(label => {
    const { game, UI } = __ed, sc = game.screen, h = UI.hot.find(h => h.label === label), r = sc.canvas.getBoundingClientRect();
    return [r.left + ((h.x + h.w / 2) * sc.S + sc.OX - Math.round(sc.fx * sc.S)) / sc.dpr, r.top + ((h.y + h.h / 2) * sc.S + sc.OY - Math.round(sc.fy * sc.S)) / sc.dpr];
  }, label);
  if (touch) await p.touchscreen.tap(...xy); else await p.mouse.click(...xy);
  await p.waitForTimeout(150);
}
/** CHARACTER on the title, the hero's button, PLAY AS: into town as that hero */
async function choose(p, C, touch = false) {
  await button(p, 'CHARACTER', touch);
  const pick = p.getByRole('button', { name: C.name, exact: true }), play = p.getByRole('button', { name: 'PLAY AS ' + C.name.toUpperCase(), exact: true });
  if (touch) { await pick.tap(); await play.tap(); } else { await pick.click(); await play.click(); }
  await p.waitForFunction(() => __ed.ED.mode === 'town', null, { timeout: 8000 });
  await settle(p, 1);
}
/** wait for s seconds of game time: a loaded machine draws fewer frames, each worth at most 50 ms of game, so a wait on
 *  the wall clock can end before the game has run (the hero still arriving in town, a tap not yet taken) */
async function settle(p, s) { const t0 = await p.evaluate(() => __ed.game.time); await p.waitForFunction(([t0, s]) => __ed.game.time >= t0 + s, [t0, s], { timeout: 30000 }); }
/** run the game by hand for s seconds (the update, and a drawn frame every few steps): fast and the same every time */
const run = (p, s) => p.evaluate(s => { const g = __ed.game; for (let i = 0; i < Math.ceil(s * 60); i++) { g.hitstop = 0; g._step(1 / 60); if (i % 6 === 0) g._frame(); } }, s);
const finiteRig = p => p.evaluate(() => { const J = __ed.ED.hero.rig.J; return Object.keys(J).filter(k => J[k] && !J[k].every(Number.isFinite)); });

const probe = await open(await browser.newContext(), url);
const all = await probe.p.evaluate(() => Object.values(__ed.CHARACTERS).map(C => ({ id: C.id, name: C.name, skills: C.skills })));
await probe.p.context().close();
const want = opt('character', null), list = want ? all.filter(C => C.id === want) : all;
if (!list.length) { console.error('no character "' + want + '" (registered: ' + all.map(C => C.id).join(', ') + ')'); await browser.close(); process.exit(1); }

const results = {}; let failed = 0;
for (const C of list) {
  const out = resolve(opt('out', 'check-output/character-' + C.id)); mkdirSync(out, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), passed = [], info = {};
  let page = null, log = null;
  const check = async (name, fn) => { await fn(); passed.push(name); console.log('  ok', name); };
  const must = (ok, why) => { if (!ok) throw new Error(why); };
  console.log(C.id + ':');
  try {
    ({ p: page, log } = await open(ctx, url + '?test=character'));
    await page.waitForFunction(() => __ed.ED.mode === 'title');

    await check('its entry is complete and its body keeps the contract', async () => {
      const r = await page.evaluate(id => {
        const C = __ed.CHARACTERS[id], W = __ed.CHARACTERS.wanderer, bad = [];
        for (const k of ['name', 'title', 'desc', 'style']) if (typeof C[k] !== 'string' || !C[k]) bad.push(k + ' is missing (a line of text)');
        if (!/^#[0-9a-f]{6}$/i.test(C.color || '')) bad.push('color is not a "#rrggbb" color');
        if (!Array.isArray(C.skills) || !C.skills.length || C.skills.length > 6) bad.push('skills must list 1 to 6 starting skill ids');
        else for (const s of C.skills) { const S = __ed.REG.skills[s]; if (!S) bad.push('starting skill "' + s + '" is not registered'); else if (S.character && S.character !== id) bad.push('starting skill "' + s + '" belongs to ' + S.character); }
        for (const [k, lo, hi] of [['speed', 30, 200], ['acceleration', 100, 3000], ['dodgeTime', .1, .8], ['dodgeSpeed', 80, 600]]) if (!(C[k] >= lo && C[k] <= hi)) bad.push(k + ' should be a number from ' + lo + ' to ' + hi + ' (the Wanderer has ' + W[k] + ')');
        for (const k of ['stats', 'init', 'prime', 'kit', 'rig', 'dropIn', 'titlePose', 'preview', 'menuNotes']) if (C[k] !== undefined && typeof C[k] !== 'function') bad.push(k + ' should be a function');
        const slot = __ed.characterSaveKey(id); if (Object.keys(__ed.CHARACTERS).filter(o => __ed.characterSaveKey(o) === slot).length > 1) bad.push('its save slot ' + slot + ' is shared with another character');
        return { bad, rig: __ed.checkRig(id) };
      }, C.id);
      info.pixels = r.rig.pixels;
      must(!r.bad.length, 'its entry: ' + r.bad.join('; '));
      must(r.rig.ok, 'its body breaks the contract: ' + (r.rig.problems || []).join('; '));
    });

    await check('picked in the character menu, with a save of its own', async () => {
      await page.screenshot({ path: out + '/title-before.png' });
      await choose(page, C);
      await page.screenshot({ path: out + '/town.png' });
      const s = await page.evaluate(id => { const h = __ed.ED.hero; h.gold = 4321; __ed.saveGame(); const mine = __ed.characterSaveKey(id), others = Object.keys(__ed.CHARACTERS).filter(o => o !== id).map(o => __ed.characterSaveKey(o)); return { character: h.character, slots: h.slots.filter(Boolean), gold: (My3D2dge.store.get(mine) || {}).gold, others: others.filter(k => My3D2dge.store.get(k)) }; }, C.id);
      must(s.character === C.id, 'PLAY AS ' + C.name.toUpperCase() + ' started ' + s.character);
      must(JSON.stringify(s.slots) === JSON.stringify(C.skills), 'its slots are ' + s.slots.join(', ') + ', not its starting skills');
      must(s.gold === 4321, 'its progress did not save to its own slot');
      must(!s.others.length, 'it wrote to another character\'s save: ' + s.others.join(', '));
      await page.reload(); await page.waitForFunction(() => window.__ed?.ED.mode === 'title');
      const back = await page.evaluate(() => [__ed.CHAR.selected, __ed.ED.titleHero.gold]);
      must(back[0] === C.id && back[1] === 4321, 'after a reload the title shows ' + back[0] + ' with ' + back[1] + ' gold');
      await choose(page, C);
    });

    await check('moves and dodges', async () => {
      const a = await page.evaluate(() => [__ed.ED.hero.x, __ed.ED.hero.y]);
      await page.keyboard.down('KeyD'); await settle(page, .35); await page.keyboard.up('KeyD'); await page.waitForTimeout(90);
      const b = await page.evaluate(() => [__ed.ED.hero.x, __ed.ED.hero.y]);
      must(Math.hypot(b[0] - a[0], b[1] - a[1]) > 10, 'holding D moved it ' + Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(1) + ' units');
      await page.keyboard.down('Space'); await page.waitForTimeout(60);
      const d = await page.evaluate(() => ({ t: __ed.ED.hero.dodgeT, inv: __ed.ED.hero.inv }));
      await page.keyboard.up('Space'); await page.waitForTimeout(700);
      must(d.t > 0 && d.inv > 0, 'Space did not start a dodge');
      must(await page.evaluate(() => __ed.ED.hero.dodgeT <= 0), 'the dodge never ended');
      must(!(await finiteRig(page)).length, 'its joints are not numbers after the dodge');
    });

    // the experiments run on the hero himself (the tools act on the real game): his save is kept first and put back after,
    // with the switches off, back in town
    const keepHero = () => page.evaluate(() => { const X = __ed; X.saveGame(); X.kept = JSON.stringify(My3D2dge.store.get(X.characterSaveKey(X.ED.hero.character))); X.UI.closeAll(); X.goTown(); });
    const restoreHero = () => page.evaluate(() => {
      const X = __ed, id = X.ED.hero.character; X.ED.hero.bot = null;
      Object.assign(X.DEV, { god: false, resources: false, cooldowns: false, freezeFoes: false, paused: false });
      My3D2dge.store.set(X.characterSaveKey(id), JSON.parse(X.kept)); X.ED.hero = X.loadHeroOrNew(id); X.ED.savedLevel = null; X.UI.closeAll(); X.goTown();
    });
    // the test bench: the switches on, a lane of open floor and a dummy that cannot die
    const sandbox = () => page.evaluate(() => {
      const { ED, DEV } = __ed, h = ED.hero, map = ED.L.map;
      DEV.god = DEV.resources = DEV.cooldowns = DEV.freezeFoes = true; __ed.game.input.clear(); __ed.UI.closeAll();
      // the nearest run of eight cells of open, walkable floor (room for a blink, a leap or a charge), with its rows beside it open too
      let spot = null, best = 1e9;
      const open = (cx, cy) => map.walkable(cx, cy) && map.heightAt(cx * 16 + 8, cy * 16 + 8) === 0;
      for (let y = 4; y < map.h - 4; y++) for (let x = 4; x < map.w - 12; x++) {
        if (![0, 1, 2, 3, 4, 5, 6, 7, 8].every(k => open(x + k, y) && open(x + k, y - 1) && open(x + k, y + 1))) continue;
        const d = Math.hypot((x + 1) * 16 - h.x, y * 16 - h.y); if (d < best) { best = d; spot = [(x + 1) * 16 + 8, y * 16 + 8]; }
      }
      if (!spot) throw new Error('no open lane in town to cast in');
      Object.assign(h, { x: spot[0], y: spot[1], z: 0, act: null, critChance: 0, laneAt: spot });
      h.bot = { manual: true, input: { worldMove: [0, 0], aimSource: 'bot', aimAt: [h.x + 40, h.y], move: () => [0, 0], buffered: () => false, down: () => false, pressed: () => false, consume() {} } };
    });
    // cast skill id from slot 0 at a dummy `dist` units ahead and let it play out; -> { cast, hit }
    const castAll = (ids, dist, frames) => page.evaluate(([ids, dist, frames]) => {
      const { ED, game } = __ed, h = ED.hero, out = {};
      const hits = new Set(), on = __ed.BUS.on('hit', e => { if (e.src === h || (e.src && e.src.owner === h)) hits.add(e.hit.skill); });
      for (const id of ids) {
        if (h.act && h.act.end) h.act.end(true);
        Object.assign(h, { act: null, dodgeT: 0, cds: {}, ember: h.maxEmber, st: {}, vx: 0, vy: 0, z: 0, x: h.laneAt[0], y: h.laneAt[1] });   // every cast from the same open spot
        ED.fx.length = ED.allies.length = ED.foes.length = 0;
        if (!h.skills[id] || !h.skills[id].rank) h.skills[id] = { rank: 3 };
        h.slots[0] = id; __ed.dressHero(h);
        const m = __ed.spawnMonster('dummy', h.x + dist, h.y, { instant: true }); m.spawnT = 0; m.hp = m.maxHp = 1e6;
        h.bot.input.aimAt = [m.x, m.y]; h.aim = h.facing = 0; h.tx = m.x; h.ty = m.y;
        { const C = __ed.characterOf(h); if (C.prime) C.prime(h); }   // its own resource full, as the gallery does (Dan's brood)
        const cast = !!__ed.useSlot(h, 0); let echo = null;
        for (let f = 0; f < frames; f++) { game.hitstop = 0; game._step(1 / 60); if (f % 15 === 0) game._frame(); const e = ED.allies.find(a => a.kind === 'echo'); if (e) echo = e.rig && e.rig.constructor === h.rig.constructor; }
        out[id] = { cast, hit: hits.has(id), echo };
      }
      __ed.BUS.off('hit', on);
      return { out, errors: game.errors.slice() };
    }, [ids, dist, frames]);

    await check('every starting skill casts, and its attacks hurt', async () => {
      await keepHero(); await page.waitForTimeout(800);
      await sandbox();
      const r = await castAll(C.skills, 34, 110);
      info.skills = r.out;
      must(!r.errors.length, 'the game threw: ' + r.errors.join('; '));
      const dud = C.skills.filter(id => !r.out[id].cast); must(!dud.length, 'these starting skills did not cast: ' + dud.join(', '));
      must(C.skills.some(id => r.out[id].hit), 'none of its starting skills hurt a dummy in front of it');
    });

    if (!quick) await check('every shared skill works with its body, and its Echo keeps that body', async () => {
      const ids = await page.evaluate(() => Object.keys(__ed.REG.skills).filter(id => !__ed.REG.skills[id].character));
      const r = await castAll(ids, 30, 150);
      must(!r.errors.length, 'the game threw: ' + r.errors.join('; '));
      const dud = ids.filter(id => !r.out[id].cast); must(!dud.length, 'these shared skills did not cast: ' + dud.join(', '));
      if (r.out.echo) must(r.out.echo.echo === true, 'its Echo (the shared skill) does not have its body');
    });
    await restoreHero(); await page.waitForTimeout(900);

    await check('shows on the paper doll in its own body', async () => {
      await key(page, 'KeyI'); await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ top: __ed.UI.top() && __ed.UI.top().id, same: __ed.LOT_dollRig(__ed.ED.hero).rig.constructor === __ed.ED.hero.rig.constructor }));
      await page.screenshot({ path: out + '/bag.png' });
      must(r.top === 'inventory', 'I did not open the bag'); must(r.same, 'the paper doll is not its body');
      await key(page, 'Escape');
    });

    await check('arrives in a depth, drinks, is knocked down, dies and is revived', async () => {
      await page.evaluate(() => __ed.descend(1));
      await page.waitForFunction(() => __ed.ED.mode === 'level', null, { timeout: 10000 });
      const a = await page.evaluate(() => ({ act: __ed.ED.hero.act && __ed.ED.hero.act.name, z: __ed.ED.hero.z }));
      must(a.act === 'dropin', 'it did not drop in (its action is ' + a.act + ')');
      await page.waitForFunction(() => !__ed.ED.hero.act && __ed.ED.hero.z === 0, null, { timeout: 4000 }).catch(() => { throw new Error('it never landed from the drop-in'); });
      await page.evaluate(() => { __ed.ED.foes.length = 0; const h = __ed.ED.hero; h.hp = h.maxHp * .4; h.potions = Math.max(1, h.potions); });
      const hp0 = await page.evaluate(() => __ed.ED.hero.hp);
      await key(page, 'KeyQ');
      must(await page.evaluate(() => __ed.ED.hero.potionT > 0), 'Q did not drink a potion');
      await page.waitForTimeout(1600);
      must(await page.evaluate(hp0 => __ed.ED.hero.hp > hp0, hp0), 'the potion did not heal');
      await page.evaluate(() => { const h = __ed.ED.hero; __ed.ED.foes.length = 0; h.inv = 0; __ed.dealDamage(h, { amount: 1, el: 'phys', var: 0, knockdown: true, src: { x: h.x + 10, y: h.y, team: 'foe' } }); });
      must(await page.evaluate(() => __ed.ED.hero.act && __ed.ED.hero.act.name === 'down'), 'a crushing blow did not knock it down');
      await page.screenshot({ path: out + '/knocked-down.png' });
      await page.waitForFunction(() => !__ed.ED.hero.act, null, { timeout: 4000 }).catch(() => { throw new Error('it never got up after a knockdown'); });
      await page.evaluate(() => { const h = __ed.ED.hero; __ed.ED.foes.length = 0; h.inv = 0; __ed.dealDamage(h, { amount: 99999, el: 'void', var: 0 }); });
      await page.waitForFunction(() => __ed.ED.hero.dead, null, { timeout: 4000 });
      // the fall, stepped by hand: the camera's push-in re-bakes the floor every frame, which crawls in a headless browser
      const fell = await page.evaluate(() => { const g = __ed.game; for (let i = 0; i < 12 * 60; i++) { if (__ed.UI.top() && __ed.UI.top().id === 'death') return true; g._step(1 / 60); } return false; });
      must(fell, 'the death panel never opened (12 s after the killing blow)');
      await page.waitForTimeout(300);
      await page.screenshot({ path: out + '/death.png' });
      must(!(await finiteRig(page)).length, 'its joints are not numbers in death');
      await key(page, 'Enter');
      await page.waitForFunction(() => __ed.ED.mode === 'town' && __ed.ED.hero.alive, null, { timeout: 10000 }).catch(() => { throw new Error('it was not revived in town'); });
    });

    await check('plays in every view', async () => {
      for (const v of VIEWS) {
        await page.evaluate(v => { __ed.game.setView(v); __ed.game.setZoom(2); __ed.UI.cardT = 0; }, v);
        await run(page, .4);
        await page.waitForTimeout(150);
        await page.screenshot({ path: out + '/view-' + v + '.png' });
        must(!(await finiteRig(page)).length, 'its joints are not numbers in the ' + v + ' view');
      }
      await page.evaluate(() => { __ed.game.setView('iso'); __ed.game.setZoom(1.25); });
    });

    await check('stars on the title and in the gallery', async () => {
      await key(page, 'Escape'); await button(page, 'SAVE AND QUIT');
      await page.waitForFunction(() => __ed.ED.mode === 'title');
      must(await page.evaluate(() => __ed.ED.titleHero.character) === C.id, 'the title shows another hero');
      await page.evaluate(() => { const g = __ed.game; for (let i = 0; i < 12.5 * 60; i++) { g.scene.update(1 / 60); if (i % 30 === 0) g._frame(); } });
      await page.screenshot({ path: out + '/title.png' });
      must(!(await finiteRig(page)).length, 'its joints are not numbers in its title loop');
      await page.evaluate(() => __ed.game.go('gallery', { reel: 'skills' }));
      await page.waitForFunction(() => __ed.ED.mode === 'gallery', null, { timeout: 8000 });
      await page.waitForTimeout(400);
      const items = await page.evaluate(() => __ed.galItems());
      const missing = C.skills.filter(id => !items.includes(id)); must(!missing.length, 'the gallery\'s skills reel lacks ' + missing.join(', '));
      await run(page, 1.5); await page.screenshot({ path: out + '/gallery-skill.png' });
      await page.evaluate(() => __ed.galOpen('poses')); await run(page, 2);
      await page.screenshot({ path: out + '/gallery-pose.png' });
    });

    if (!quick) await check('plays on a phone held upright', async () => {
      const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const { p, log: mlog } = await open(mob, url);
      await p.waitForTimeout(500);
      await choose(p, C, true);
      must(await p.locator('[data-act="s0"]').count() > 0, 'no touch buttons');
      await p.locator('[data-act="s0"]').tap();   // (waits for the game to take the tap: a loaded machine runs its steps late)
      const used = await p.waitForFunction(id => { const h = __ed.ED.hero; return !!(h.act && h.act.skill === id) || id in h.cds || __ed.ED.fx.some(f => f.hit && f.hit.skill === id); }, C.skills[0], { timeout: 5000 }).then(() => true, () => false);
      await p.screenshot({ path: out + '/phone.png' });
      const errs = mlog.errors.concat(await p.evaluate(() => __ed.game.errors));
      await mob.close();
      must(used, 'tapping the first skill button did not use ' + C.skills[0]);
      must(!errs.length, 'on the phone the game threw: ' + errs.join('; '));
    });

    const errs = log.errors.concat(await page.evaluate(() => __ed.game.errors));
    must(!errs.length, 'the game threw: ' + errs.join('; '));
    must(!log.warnings.length, 'engine warnings: ' + [...new Set(log.warnings)].join('; '));
    results[C.id] = { ok: true, passed, info };
    console.log('  all ' + passed.length + ' checks passed; screenshots in ' + out);
  } catch (e) {
    failed++;
    results[C.id] = { ok: false, passed, failed: e.message, info };
    console.log('  FAILED: ' + e.message);
    if (page) await page.screenshot({ path: out + '/failure.png' }).catch(() => {});
  }
  writeFileSync(out + '/results.json', JSON.stringify(results[C.id], null, 2));
  await ctx.close();
}
await browser.close();
console.log(failed ? failed + ' of ' + list.length + ' characters FAILED' : 'character test passed: ' + list.map(C => C.id).join(', '));
process.exit(failed ? 1 : 0);
