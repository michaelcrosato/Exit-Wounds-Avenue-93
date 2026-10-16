/* =============================================================================
 * SCENES: title, Emberhold (town), a depth (level), the Proving Grounds (the stress test's endless horde)
 * The world step and the world draw are shared: every scene with a hero runs worldStep / worldDraw.
 * ============================================================================= */
let gpu = null;
function setupGPU(map) {
  if (!gpu) { gpu = game.enableGPU({ map, ambient: [.15, .14, .24], wrap: .5, bands: 6 }); gpu.enabled = OPT.gpu !== false; }
  gpu.map = map;
}
/* ---------- save / load ---------- */
const SAVE_KEYS = ['character', 'level', 'xp', 'gold', 'pts', 'gear', 'bag', 'skills', 'slots', 'tree', 'potions', 'maxDepth', 'seenMech', 'kills', 'visits', 'stash', 'best', 'tips'];
function saveGame() { const h = ED.hero; if (!h || ED.demo || ED.mode === 'gallery') return; const o = {}; for (const k of SAVE_KEYS) if (h[k] !== undefined) o[k] = h[k]; o.v = 1; E.store.set(characterSaveKey(h.character), o); }
function loadSave(identity = CHAR.selected) { const s = characterSave(identity); if (!s || !s.v) return null; let mx = 0; const scan = it => { if (it && it.uid > mx) mx = it.uid; }; Object.values(s.gear || {}).forEach(scan); (s.bag || []).forEach(scan); const st = s.stash; (st && Array.isArray(st.tabs) ? st.tabs.flat() : Array.isArray(st) ? st : []).forEach(scan); itemUid = Math.max(itemUid, mx + 1); return s; }
function newHero(identity = CHAR.selected) {
  const h = makeHero(null, identity);
  // a starting kit: the classic look, plain gear
  for (const [slot, base] of [['weapon', 'longsword'], ['chest', 'tunic'], ['boots', 'shoes'], ['cloak', 'cape']]) { const it = makeItem({ base, rarity: 0, ilvl: 1, R: RNG(slot) }); it.look.colors = Object.assign(it.look.colors || {}, slot === 'chest' ? { cloth: '#2f8f86' } : slot === 'cloak' ? { cape: '#c8452f', capeIn: '#7a2622' } : slot === 'boots' ? { boot: '#6a4128' } : {}); h.gear[slot] = it; }
  const C = characterOf(h); if (C.kit) C.kit(h);   // a character's own starting gear (18-characters.js)
  refreshPowers(h); computeStats(h); h.hp = h.maxHp; dressHero(h);
  return h;
}
function reviveHero(h) { h.alive = true; h.dead = false; h.deadT = 0; h.st = {}; h.act = null; computeStats(h); h.hp = h.maxHp; h.ember = h.maxEmber; h.potions = h.maxPotions; }

/* ---------- moving between places ---------- */
function descend(depth) { ED.savedLevel = null; game.go('level', { depth }); }
function goTown(o = {}) { game.go('town', o); }
/** T: a short channel, then a portal home appears where he stands (the level waits behind it) */
function openTownPortal(h) {
  if (!h || !h.alive || ED.mode !== 'level') return;
  if (ED.L.portal) { notify('THE PORTAL IS ALREADY OPEN', '#8ab4ff', 1.5); return; }
  startAction(h, { name: 'portal', moveK: 0, cancel: true, rig: { pose: 'cast', expr: null }, update(dt) {
    this.t += dt; if (Math.random() < .6) P.glints(h.x + Math.cos(h.facing) * 12, h.y + Math.sin(h.facing) * 12, 12, 1, '#8ab4ff', 10);
    if (this.t >= .9) { const x = h.x + Math.cos(h.facing) * 18, y = h.y + Math.sin(h.facing) * 18; ED.L.portal = { x, y, t: 0 }; sfx('portal'); P.ring(x, y, 2, 16, '#8ab4ff', .4); return false; }
    return true;
  } });
}
function drawPortal(pt, r, home) {
  const t = game.time;
  pt.t = (pt.t || 0) + 1 / 60;
  const grow = clamp(pt.t * 3, 0, 1), c = home ? '#6fd6cc' : '#8ab4ff';
  r.decal(() => r.groundRing(pt.x, pt.y, 10 * grow, c, .7), { emissive: .7 });
  r.queue(pt.x, pt.y, 0, g => {
    const [x, y] = r.w(pt.x, pt.y, 14 * grow), s = (r.view.zoom || 1) * grow;
    px.glow(g, 1); px.ell(g, x, y, 7 * s, 12 * s, E.shade(c, -.4)); px.ell(g, x, y, 5.5 * s, 10.5 * s, c);
    for (let i = 0; i < 6; i++) { const a = t * 3 + i; px.dot(g, x + Math.cos(a) * 4 * s, y + Math.sin(a * 1.3) * 8 * s, '#ffffff'); }
    px.ell(g, x, y, 3 * s, 7 * s, '#e8fbff');
  }, { emissive: true });
  L.add(pt.x, pt.y, 14, 60, .9, { color: c });
}

/* ---------- the shared world step ---------- */
function worldStep(dt, o = {}) {
  const h = ED.hero, L0 = ED.L;
  tuneStep(); devBeforeWorld();
  ED.t += dt; L0.t = (L0.t || 0) + dt; slowMoStep();
  UI.prompt = null;
  floorEffects(h, dt); for (const m of ED.foes) if (m.alive && m.spawnT <= 0) floorEffects(m, dt);
  updateHero(h, dt, o);
  if (!DEV.freezeFoes) updateFoes(dt); else GRID.build(ED.foes);
  updateCorpses(dt); updateFx(dt); updateThings(L0, dt); updateDrops(dt);
  for (let i = ED.allies.length - 1; i >= 0; i--) { const a = ED.allies[i]; if (a.update && a.update(dt) === false) ED.allies.splice(i, 1); }
  for (const id of L0.mechs || []) { const M = REG.mechanics[id]; if (M && M.update) M.update(L0, dt); }
  for (const b of L0.torches) b.t += dt;
  if (L0.theme && L0.theme.ambience) L0.theme.ambience(L0, dt);
  BUS.emit('step', { dt, L: L0 });
  reveal(L0, h, Math.round(9 * TUNE.reveal));
  if (L0.flow && h.alive) L0.flow.update(h.x, h.y);   // the level's paths lead to the hero (cached per cell)
  const a = h.aim;
  game.focus(h.x + Math.cos(a) * 16 * TUNE.camLead, h.y + Math.sin(a) * 16 * TUNE.camLead, 8 + (h.z || 0) * .7);   // the camera rises with leaps and flights
}
function worldDraw(r) {
  L.enabled = !OPT.fullLight; if (gpu) gpu.enabled = OPT.gpu && L.enabled;
  const L0 = ED.L, h = ED.hero;
  if (L0.sky) r.sky(L0.sky);
  if (L0.drawBack) L0.drawBack(r);   // behind the floor: backdrops, the abyss under chasms
  L0.map.drawFloor(r);
  if (L0.drawUnder) L0.drawUnder(r);
  L0.map.queueWalls(r);
  drawTorches(L0, r); drawProps(L0, r); drawThings(L0, r);
  if (L0.exit) drawExit(L0, r);
  if (L0.waystone && !L0.drawWaystone) drawExit({ exit: Object.assign({ open: true }, L0.waystone) }, r);
  if (L0.portal) drawPortal(L0.portal, r, false);
  if (L0.npcs) for (const n of L0.npcs) drawNPC(n, r);
  drawDrops(r);
  for (const m of ED.corpses) drawFoe(m, r);
  for (const m of ED.foes) drawFoe(m, r);
  for (const a of ED.allies) if (a.draw) a.draw(r);
  drawHero(h, r);
  drawFx(r);
  for (const id of L0.mechs || []) { const M = REG.mechanics[id]; if (M && M.draw) M.draw(L0, r); }
  if (L0.drawOver) L0.drawOver(r);
  BUS.emit('draw', { r, L: L0 });
  if (!UI.hideHud) { drawFoeBars(r); drawHUD(r); }
  devDraw(r);
  drawPanels(r);
}
function enterWorld(L0) {
  ED.L = L0; ED.fx.length = 0; ED.drops.length = 0; ED.corpses.length = 0; ED.foes.length = 0; ED.allies.length = 0; ED.boss = null; ED.t = 0;
  game.cam.bounds = v => L0.map.bounds(v);
  setupGPU(L0.map);
  L.ambient = L0.theme && L0.theme.ambient !== undefined ? L0.theme.ambient : L0.ambient !== undefined ? L0.ambient : .14;
  game.setZoom(OPT.zoom || 1.25);
}
/** the hero drops in from above: a fall in the jump pose, a crouched landing, dust and a thud */
function dropIn(h, from = 150) {
  h.z = from; h.vz = 0; h.inv = 1.4;
  const C = characterOf(h); if (C.dropIn) return C.dropIn(h, from);   // a character's own arrival (Codex unfolds)
  startAction(h, { name: 'dropin', cancel: false, moveK: 0, rig: { air: true }, zz: from, vz: 0, update(dt) {
    if (this.zz > 0) { this.vz -= 520 * dt; this.zz = Math.max(0, this.zz + this.vz * dt); this.z = this.zz; this.rig = { air: true, expr: 'shout' }; if (this.zz <= 0) { this.land = .35; P.dust(h.x, h.y, 0, 14, { speed: 70 }); P.ring(h.x, h.y, 4, 30, '#bff6ff', .35); shake(4); sfx('thud'); h.rig.kick(-6); } return true; }
    this.z = 0; this.rig = { pose: 'crouch' }; return (this.land -= dt) > 0;
  } });
}

/* ---------- TITLE ---------- */
const TITLE = { menu: 0, t: 0 };
function titleItems() {
  const save = characterSave();
  return [save ? ['CONTINUE', () => startGame(false)] : null, ['NEW GAME', () => { if (save && !TITLE.confirmNew) { TITLE.confirmNew = true; notify('PRESS AGAIN TO RESTART ' + CHARACTERS[CHAR.selected].name.toUpperCase() + ' (THIS CHARACTER SAVE IS LOST)', '#ff9a7a', 3); return; } startGame(true); }], ['CHARACTER', () => UI.open('characters')], ['PROVING GROUNDS', () => { if (!ED.hero) ED.hero = loadHeroOrNew(); game.go('proving'); }], ['GALLERY', () => { if (!ED.hero) ED.hero = loadHeroOrNew(); game.go('gallery'); }], ['SETTINGS', () => UI.open('settings')],
    TOUCH.el && FS.can() && !FS.on() ? ['FULL SCREEN', () => FS.toggle()] : null].filter(Boolean);   // on a touch screen that can
}
function loadHeroOrNew(identity = CHAR.selected) { const s = loadSave(identity); if (s) { const h = makeHero(s, identity); refreshPowers(h); computeStats(h); h.hp = h.maxHp; dressHero(h); return h; } return newHero(identity); }
function startGame(fresh) { if (fresh) { E.store.remove(characterSaveKey()); ED.hero = newHero(); ED.hero.visits = {}; saveGame(); } else ED.hero = loadHeroOrNew(); ED.savedLevel = null; goTown({ arrive: fresh ? 'intro' : 'waystone' }); }
/** The title menu grows upward from the key legend; shorter windows use tighter rows. */
function titleMenu(n) { const step = game.H < 260 ? 14 : 16, y = game.H - UI.frame.b - 29 - n * step; return { y, step }; }
/** the title hero's kata, a 12 s loop: he looks round, flows through slash, backslash, spin and thrust, holds a guard, cheers */
const KATA = ['slash', 'backslash', 'spin', 'thrust'];
function titleKata(t) {
  const k = t % 12;
  if (k >= 3.2 && k < 5.6) {   // each move stretched to 0.6 s so the eye can follow it
    const j = Math.floor((k - 3.2) / .6), S = E.move(KATA[j]).spec, tot = S.wind + S.active + S.recover, x = ((k - 3.2) % .6) / .6 * tot;
    const st = x < S.wind ? { spec: S, phase: 'wind', u: x / S.wind } : x < S.wind + S.active ? { spec: S, phase: 'active', u: (x - S.wind) / S.active } : { spec: S, phase: 'recover', u: (x - S.wind - S.active) / S.recover };
    return { attack: st, expr: st.phase === 'active' ? 'shout' : null };
  }
  if (k >= 5.6 && k < 7.6) return { stance: 'ready' };
  if (k >= 10) return { pose: 'cheer', expr: k < 11 ? 'shout' : 'smile' };
  return {};
}
const titleScene = {
  enter() {
    ED.mode = 'title'; UI.closeAll(); L.enabled = true; TITLE.t = 0; TITLE.confirmNew = false;
    // the rune hall of the stress test, torch-lit, the hero waiting in its circle
    const rec = { depth: 1, seed: 5, name: 'The Rune Hall', theme: 'crypt', hue: 0, layout: 'halls', mechs: [], pool: [], size: [30, 24] };
    const w = 30, hh = 24, cells = new Array(w * hh).fill(0); for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) if (!x || !y || x === w - 1 || y === hh - 1) cells[y * w + x] = 1;
    for (const [px0, py0] of [[6, 5], [22, 5], [6, 17], [22, 17]]) for (let k = 0; k < 4; k++) cells[(py0 + (k >> 1)) * w + px0 + (k & 1)] = 2;
    const L0 = { kind: 'title', rec, depth: 0, name: rec.name, theme: REG.themes.crypt, hue: 0, w, h: hh, cells, tags: new Array(w * hh).fill(null), rooms: [{ x: 1, y: 1, w: w - 2, h: hh - 2, cx: w / 2, cy: hh / 2 }], things: [], props: [], torches: [], runes: [{ x: w * 8, y: hh * 8, r: 54 }], mechs: [], seen: new Uint8Array(w * hh), npcs: [] };
    L0.pal = CRYPT; L0.map = new E.TileMap({ w, h: hh, tile: T16, cells, types: REG.themes.crypt.walls, floorTex: (x, y, tag) => cryptFloor(L0, x, y, tag, CRYPT) }); L0.flow = new E.FlowField(L0.map);
    for (const [x, y] of [[10, 8], [20, 8], [10, 16], [20, 16]]) L0.torches.push({ x: x * T16, y: y * T16, t: Math.random() * 9, kind: 'brazier', color: '#ff9a4a', r: 4.5, solid: true });
    L0.start = { x: w * 8, y: hh * 8 };   // the centre of the rune circle
    enterWorld(L0); L.ambient = .1;
    if (ED.demo) { ED.demo = false; ED.hero = ED.realHero || null; ED.realHero = null; }   // back from the attract mode (swapped here, not before the fade: the demo depth still draws while it fades out)
    const h = ED.hero || loadHeroOrNew(); ED.titleHero = h; h.x = L0.start.x; h.y = L0.start.y; h.facing = Math.PI / 2 * .9; h.aim = h.facing; h.act = null; h.z = 0;
    game.cam.snap = true; game.setZoom(1.75); playSong('title');
  },
  update(dt) {
    TITLE.t += dt;
    if (updateUI(dt)) return;
    const h = ED.titleHero, items = titleItems();
    const C = characterOf(h), tz = C.titleZoom || [1.05, 1.75], titleZoom = game.H < 260 ? tz[0] : tz[1];
    if (game.zoom !== titleZoom) game.setZoom(titleZoom);
    const mm = UI.mouse.cx + ',' + UI.mouse.cy, moved = mm !== TITLE.mm; TITLE.mm = mm;   // a hand on the mouse is not idle either
    if (game.input.anyPressed() || UI.mouse.down || moved) TITLE.idle = 0; else TITLE.idle = (TITLE.idle || 0) + dt;
    if (TITLE.idle > 28 && !UI.stack.length) { TITLE.idle = 0; startDemo(); return; }
    const pose = C.titlePose ? C.titlePose(TITLE.t) : titleKata(TITLE.t);   // the Wanderer's kata, or the character's own loop
    h.rig.update(dt, Object.assign({ x: h.x, y: h.y, z: 0, facing: E.lerpAng(h.facing, Math.PI / 2 + Math.sin(TITLE.t * .4) * .5, .02) }, pose));
    h.facing = h.rig.facing;
    for (const b of ED.L.torches) b.t += dt;
    const inp = game.input;
    if (inp.repeat('menuUp')) { TITLE.menu = (TITLE.menu + items.length - 1) % items.length; sfx('select'); UI.keyNav = true; }
    if (inp.repeat('menuDown')) { TITLE.menu = (TITLE.menu + 1) % items.length; sfx('select'); UI.keyNav = true; }
    if (inp.pressed('confirm') || inp.pressed('start')) { inp.consumeAll(); sfx('confirm'); items[clamp(TITLE.menu, 0, items.length - 1)][1](); }
    if (Math.random() < dt * 8) { const b = rnd.pick(ED.L.torches); P.add({ kind: 'ember', x: b.x + (Math.random() - .5) * 6, y: b.y + (Math.random() - .5) * 6, z: 14, vx: (Math.random() - .5) * 14, vy: (Math.random() - .5) * 14, vz: 20 + Math.random() * 40, max: 1.2, color: '#ff8a3a' }); }
    // the hero stands just above the menu: slide the look point toward (or away from) the camera until his feet sit there
    const v = game.view, fl = Math.hypot(v.fx || 0, v.fy === undefined ? 1 : v.fy) || 1, fx = (v.fx || 0) / fl, fy = (v.fy === undefined ? 1 : v.fy) / fl;
    const a = v.p(h.x, h.y, 0), b = v.p(h.x + fx * 10, h.y + fy * 10, 0), s = (b[1] - a[1]) / 10, k = Math.abs(s) > .05 ? clamp((game.H / 2 - titleMenu(items.length).y + 3) / s, -150, 150) : 0;
    game.focus(h.x + fx * k, h.y + fy * k, 0);
  },
  draw(r) {
    const L0 = ED.L, h = ED.titleHero;
    L0.map.drawFloor(r); L0.map.queueWalls(r); drawTorches(L0, r);
    r.shadow(h.x, h.y, 5.5, .55);
    r.actor(h.x, h.y, 0, (g, ox, oy) => h.rig.draw(g, ox, oy, r.view), {});
    h.rig.drawSmear(r, h.smear || undefined);   // the kata's swings leave the same ribbon as in play
    L.add(L0.w * 8, L0.h * 8, 3, 78, .55 + .12 * Math.sin(game.time * 1.7), { color: '#4fe0cc', shadow: true });
    r.overlay(g => {
      const W = r.W, H = r.H, cx = W / 2, a = clamp(TITLE.t / 1.2, 0, 1), F = UI.frame, top = F.t, Hb = H - F.b;   // clear of a phone's status bar and home bar
      px.blend(g, .55 * a, 'normal', () => { for (let y = 0; y < 64 + top; y++) px.rect(g, 0, y, W, 1, '#05040a'); });
      E.font.title(g, 'EMBERDEEP', cx, top + (H < 260 ? 5 : 14), { scale: H < 260 ? 3 : 4, colors: ['#fff6c8', '#ffd36a', '#ff8a3a', '#b83a1a'], depth: 3, align: 'center' });
      E.font.text(g, characterOf(h).name.toUpperCase() + '  •  ' + characterOf(h).title, cx, top + (H < 260 ? 34 : 50), characterOf(h).color, { align: 'center', font: 'tiny', shadow: '#05040a', outline: false });
      const items = titleItems(), M = titleMenu(items.length), bw = 118;   // laid out up from the key legend, so every item shows
      items.forEach(([label, fn], i) => button(g, cx - bw / 2, M.y + i * M.step, bw, 13, label, () => { TITLE.menu = i; FS.auto(); fn(); }, { focus: TITLE.menu === i }));
      const h2 = ED.titleHero; if (characterSave()) E.font.text(g, 'LEVEL ' + h2.level + '  •  DEEPEST ' + h2.maxDepth, cx, M.y + items.length * M.step + 1, '#c8c0d8', { align: 'center', font: 'tiny', outline: '#05040a' });
      px.blend(g, .7, 'normal', () => px.rect(g, 0, Hb - 21, W, 21 + F.b, '#05040a'));
      const legend = TOUCH.el ? [   // touch buttons showing: the thumbs, not the keys
        'DRAG ON THE ' + (CONTROL.handed === 'left' ? 'RIGHT' : 'LEFT') + ' TO MOVE  •  THE BUTTONS ON THE ' + (CONTROL.handed === 'left' ? 'LEFT' : 'RIGHT') + ' FIGHT',
        'MENU  BAG  MAP  PORTAL: THE BUTTONS AT THE TOP'] : ['WASD MOVE  MOUSE AIMS  LMB RMB 1-4 SKILLS  SPACE DODGE  Q POTION', 'E USE  T PORTAL  I BAG  K SKILLS  P PASSIVES  V VIEW  ESC MENU'];
      legend.forEach((l, i) => E.font.text(g, l, cx, Hb - 17 + i * 7, '#b8b0d0', { align: 'center', font: 'tiny', outline: false }));
      E.font.text(g, ('v' + E.version + ' • ' + E.build).toUpperCase(), W - F.r - 4, Hb - 29, '#6f6788', { align: 'right', font: 'tiny', outline: false });   // which release and build this is
    });
    drawPanels(r);
  }
};

/* ---------- ATTRACT MODE: a demo hero, played by the autopilot on a random depth; any key returns to the title ---------- */
function startDemo() {
  ED.demo = true; ED.demoEnding = false; ED.realHero = ED.hero;
  const h = newHero(), depth = 1 + Math.floor(Math.random() * Math.min(15, PLANNED)), R = RNG(depth * 7 + 1);
  h.level = 3 + depth * 2; h.pts.skill = h.level; h.pts.passive = 0;
  for (const s of ['weapon', 'helm', 'chest', 'gloves', 'boots', 'cloak', 'legs']) if (R() < .8) h.gear[s] = makeItem({ slot: s, ilvl: depth + 2, rarity: R.int(1, 3), R });
  refreshPowers(h); computeStats(h); h.hp = h.maxHp; dressHero(h);
  ED.hero = h; botOn(h, true); botManage(h);
  game.go('level', { depth, demo: true });
}
function endDemo() { if (!ED.demoEnding) { ED.demoEnding = true; game.go('title'); } }   // titleScene.enter swaps the real hero back

/* ---------- TOWN ---------- */
const talk = new E.Dialog(game, { bg: ['#2a2040', '#141024'], border: '#c8b8e8' });
const townScene = {
  exit() { talk.close(); },
  enter(o = {}) {
    ED.mode = 'town'; ED.depth = 0; UI.closeAll(); BUS.clear('level');
    const L0 = (TOWN.build || TOWN.fallback)();
    L0.mechs = []; enterWorld(L0);
    const h = ED.hero; reviveIfDead(h);
    const at = o.arrive === 'portal' && L0.portalSpot ? { x: L0.portalSpot.x, y: L0.portalSpot.y + 22 } : L0.start;   // step off the portal, not onto it
    h.x = at.x; h.y = at.y; h.vx = h.vy = 0; h.act = null; h.potions = h.maxPotions; h.hp = h.maxHp;
    if (ED.savedLevel) L0.portal = Object.assign({}, L0.portalSpot || { x: L0.waystone.x + 30, y: L0.waystone.y + 10 }, { t: 0 });
    if (o.arrive === 'intro' || o.arrive === 'waystone') dropIn(h, o.arrive === 'intro' ? 180 : 90);
    if (o.arrive === 'portal') { h.facing = h.aim = Math.PI / 2; h.inv = 1; P.ring(at.x, at.y - 22, 3, 22, '#8ab4ff', .45); P.dust(h.x, h.y, 0, 8, { speed: 34 }); P.glints(h.x, h.y, 12, 10, '#bff6ff', 16); }   // he steps out of the portal
    game.cam.snap = true; playSong(L0.music || 'town'); saveGame();
    if (o.arrive === 'intro') { showCard('Emberhold', 'THE LAST LIT TOWN', null, 4); game.after(4.5, () => notify('THE WAYSTONE IN THE SQUARE LEADS DOWN.  (E TO USE)', '#bff6ff', 5)); }
  },
  update(dt) {
    if (talk.open && game.input.pressed('pause') && !UI.modal) UI.open('pause');
    if (talk.open && UI.modal) { updateUI(dt); if (!DEV.paused) townLife(dt); return; }
    if (talkStep(dt)) { UI.prompt = null; if (UI.modal) updateUI(dt); townLife(dt); return; }   // (worldStep, which clears the prompt, does not run: clear it here, or it draws under the box)
    const waiting = updateUI(dt);
    const L0 = ED.L, h = ED.hero, inp = game.input;
    if (waiting) { UI.prompt = null; if (!DEV.paused) { townLife(dt); townServed(L0); } return; }
    if ((L0.saveT = (L0.saveT || 0) + dt) > 20) { L0.saveT = 0; saveGame(); }   // purchases, crafting and gambling are kept even if the tab closes
    // a click on a person in reach starts a chat (the way to talk to the shopkeepers, whose E opens the shop at once).
    // Checked before the world step, so the same click does not also swing the sword
    const chat = inp.pressed('click') && townChatTarget(L0, h);
    if (chat) { inp.consumeAll(); talkTo(chat); townLife(dt); return; }
    worldStep(dt, { town: true, canAct: true });
    for (const n of L0.npcs) updateNPC(n, dt);
    townServed(L0);
    const use = townUse(L0, h);
    if (use) { UI.prompt = use.label; if (inp.pressed('interact')) use.fn(); }
    if (L0.portal && ED.savedLevel && Math.hypot(L0.portal.x - h.x, L0.portal.y - h.y) < 10) returnThroughPortal();
  },
  draw(r) { worldDraw(r); talk.draw(r); }
};
/** what E does where the hero stands. The waystone always wins when he touches it (Ilsa and Pip stand close by and
 *  must never steal its prompt); otherwise the nearest person or thing in reach: a shopkeeper opens the shop at once
 *  (the greeting is a bubble over them, not three presses of dialog), anyone else talks; a town's L.uses (the stash
 *  chest) are things with { x, y, r, label, use() } */
const TOWN_VERB = { vendor: 'Trade with', smith: 'Craft with', mystic: 'Consult', waystone: 'Travel with' };
function townUse(L0, h) {
  if (L0.waystone && Math.hypot(L0.waystone.x - h.x, L0.waystone.y - h.y) < 22) return { label: '[E] Use the waystone', fn: () => { UI.open('waystone'); UI.keyNav = true; } };   // opened by key: Enter picks the highlighted depth
  let best = null, bd = 1e9;
  for (const n of L0.npcs) {
    const d = Math.hypot(n.x - h.x, n.y - h.y), svc = n.S.service && UI.panels[n.S.service] ? n.S.service : null; if (d >= (n.S.talkR || 26) || d >= bd) continue;
    bd = d; best = svc ? { label: '[E] ' + (TOWN_VERB[svc] || 'Visit') + ' ' + n.S.name + '  •  click to talk', fn: () => serveNPC(n) } : { label: '[E] Talk to ' + n.S.name, fn: () => talkTo(n) };
  }
  for (const u of L0.uses || []) { const d = Math.hypot(u.x - h.x, u.y - h.y); if (d < u.r && d < bd) { bd = d; best = { label: u.label, fn: () => u.use(h) }; } }
  return best;
}
/** open a shopkeeper's panel straight away: they turn to the hero, greet in a bubble, and keep him company while it is open */
function serveNPC(n) {
  const S = n.S, L0 = ED.L, pool = S.hi || [];
  if (!n.bubble && pool.length) { let t = pool[Math.floor(Math.random() * pool.length)]; if (t === n.lastHi && pool.length > 1) t = pool[(pool.indexOf(t) + 1) % pool.length]; n.lastHi = t; say(n, t, 2.4); }
  n.talking = true; n.rig.kick(2); L0.serving = n;
  UI.open(S.service, { npc: n }); UI.keyNav = true;   // opened by key: driven by keys
}
/** the shop closed: the shopkeeper says goodbye and goes back to work */
function townServed(L0) {
  const n = L0.serving; if (!n || UI.isOpen(n.S.service)) return;
  L0.serving = null; n.talking = false; const b = n.S.bye; if (b && b.length) say(n, b[Math.floor(Math.random() * b.length)], 2.2);
}
/** the person under the mouse, if the hero stands close enough to chat (their body on screen, feet to head) */
function townChatTarget(L0, h) {
  const r = game.r, m = UI.mouse, s = r.view.scale || 1; let best = null, bd = 1e9;
  for (const n of L0.npcs) {
    if (Math.hypot(n.x - h.x, n.y - h.y) > (n.S.talkR || 26) + 22) continue;
    const sz = n.rig.o.size || 1, [fx, fy] = r.w(n.x, n.y, n.z || 0), [, hy] = r.w(n.x, n.y, (n.z || 0) + 34 * sz), hw = 7 * s * sz;
    if (m.x < fx - hw || m.x > fx + hw || m.y < hy - 3 || m.y > fy + 3) continue;
    const d = Math.abs(m.x - fx); if (d < bd) { bd = d; best = n; }
  }
  return best;
}
/** the talk dialog: E (the key that opened it) and a left click turn its pages too, not only Space / Enter */
function talkStep(dt) {
  if (!talk.open) return false;
  const inp = game.input;
  if ((inp.pressed('interact') && !inp.pressed('confirm')) || inp.pressed('click')) {
    const byKey = !inp.pressed('click'); inp.consume('interact'); inp.consume('click'); inp.consume('s0');
    if (talk.typing) talk.shown = talk.pageLen;
    else if (talk.i < talk.pages.length - 1) { talk.i++; talk.shown = 0; }
    else { talk.close(); sfx('confirm'); if (talk.onDone) talk.onDone(); if (byKey) UI.keyNav = true; return true; }   // a service panel opened by key is driven by keys
  }
  return talk.update(dt);
}
function townLife(dt) {
  const L0 = ED.L, h = ED.hero; for (const n of L0.npcs) updateNPC(n, dt); for (const b of L0.torches) b.t += dt; if (L0.theme && L0.theme.ambience) L0.theme.ambience(L0, dt);
  const n = talk.open && L0.npcs.find(q => q.talking);
  if (n) h.facing = E.approachAng(h.facing, angTo(h, n), dt * 8);   // the hero turns to whoever he talks to
  h.rig.update(dt, { x: h.x, y: h.y, facing: h.facing, pose: UI.modal ? null : 'hips' });
  if (n) {   // frame the two of them above the dialog box: look at their midpoint, slid toward the camera by ~34 px
    const v = game.view, fl = Math.hypot(v.fx || 0, v.fy === undefined ? 1 : v.fy) || 1, fx = (v.fx || 0) / fl, fy = (v.fy === undefined ? 1 : v.fy) / fl, mx = (h.x + n.x) / 2, my = (h.y + n.y) / 2;
    const a = v.p(mx, my, 0), b = v.p(mx + fx * 10, my + fy * 10, 0), s = (b[1] - a[1]) / 10, k = Math.abs(s) > .05 ? clamp(34 / s, -80, 80) : 0;
    game.focus(mx + fx * k, my + fy * k, 8);
  }
}
function reviveIfDead(h) { if (h.dead || !h.alive) reviveHero(h); }
function talkTo(n) {
  const S = n.S; n.talking = true;
  const lines = Array.isArray(S.lines) ? [S.lines[(n.talks = (n.talks || 0) + 1) % S.lines.length]] : typeof S.lines === 'function' ? S.lines(n, ED.hero) : ['...'];
  // the box sits above the HUD's bottom row (skill bar, potions, gold, the skill-point line) so nothing is clipped under it
  const dh = Math.max(talk.lines * E.font.lineHeight() + 9, 48), y = Math.max(16, game.H - UI.frame.b - 42 - dh);
  talk.say(lines, { name: S.name, portrait: n.rig, y, onDone() { n.talking = false; } });   // a chat only: E opens a shopkeeper's panel (serveNPC)
}
function returnThroughPortal() { const S = ED.savedLevel; if (!S) return; sfx('portal'); game.go('level', { resume: S }); }

/* ---------- A DEPTH ---------- */
/** the death panel waits for the fall: 2.2 s of game time, or 3.4 s on the wall clock (the fall plays in slow motion)
 *  once a rig that tracks its fall (Codex) has landed; the open panel stops the world, so it must not freeze the hero mid-fall */
function deathPanelDue(h) {
  return h.deadT > 2.2 || wallClock() - (h.deadAt || 0) > 3.4 && !(h.rig && h.rig.fall < .95);
}
const levelScene = {
  enter(o = {}) {
    ED.mode = 'level'; UI.closeAll(); BUS.clear('level');
    const h = ED.hero; reviveIfDead(h);
    if (o.resume) {   // back through the portal: the level exactly as it was
      const S = o.resume; ED.savedLevel = null;
      enterWorld(S.L); ED.depth = S.L.depth; ED.foes.push(...S.foes); ED.drops.push(...S.drops); ED.boss = S.boss;
      h.x = S.L.portal.x; h.y = S.L.portal.y + 8; h.inv = 1; P.ring(S.L.portal.x, S.L.portal.y, 3, 20, '#8ab4ff', .45); P.dust(h.x, h.y, 0, 8, { speed: 34 }); S.L.portal = null;
      for (const id of S.L.mechs) { const M = REG.mechanics[id]; if (M && M.start) M.start(S.L); }
      playSong(S.L.theme.music || 'deep'); game.cam.snap = true; return;
    }
    const depth = o.depth || 1; ED.depth = depth; ED.stats.kills = 0;
    h.visits = h.visits || {}; const visit = h.visits[depth] = (h.visits[depth] || 0) + 1;
    const rec = recipe(depth, visit), L0 = buildLevel(rec);
    enterWorld(L0); populate(L0);
    for (const id of L0.mechs) { const M = REG.mechanics[id]; if (M && M.start) M.start(L0); }
    h.x = L0.start.x; h.y = L0.start.y; h.vx = h.vy = 0; h.act = null; h.facing = h.aim = Math.PI / 4;
    dropIn(h);
    const M = rec.newMech && REG.mechanics[rec.newMech];
    const first = M && !(h.seenMech || []).includes(M.id + (depth > PLANNED ? ':' + rec.mechs.join('+') : ''));
    const C = levelCardInfo(L0); showCard(C.title, C.sub, C.mech, first ? 6 : 4);   // (a combination card lists each element's rule and how they combine)
    if (M) { h.seenMech = h.seenMech || []; h.seenMech.push(M.id + (depth > PLANNED ? ':' + rec.mechs.join('+') : '')); }
    if (depth > h.maxDepth) h.maxDepth = depth;
    playSong(L0.theme.music || 'deep'); game.cam.snap = true; saveGame();
    BUS.emit('levelStart', { L: L0 });
  },
  exit() { BUS.emit('levelEnd', { L: ED.L }); slowMoReset(SLOW.raw === undefined ? SLOW.base : SLOW.raw); },
  update(dt) {
    if (ED.demo) { if (game.input.anyPressed() || UI.mouse.down || ED.t > 70 || ED.hero.dead) { endDemo(); return; } worldStep(dt); return; }
    if (talkStep(dt)) return;
    if (updateUI(dt)) return;
    const L0 = ED.L, h = ED.hero, inp = game.input;
    worldStep(dt);
    if (h.dead) { if (deathPanelDue(h) && !UI.isOpen('death')) UI.open('death'); return; }
    if (inp.pressed('portal')) openTownPortal(h);
    if ((L0.saveT = (L0.saveT || 0) + dt) > 30) { L0.saveT = 0; saveGame(); }   // autosave: a closed tab loses half a minute at most
    // wake the boss when the hero reaches its arena; open the exit when it falls
    const B = ED.boss;
    if (B && B.dormant && Math.hypot(B.x - h.x, B.y - h.y) < 130) wakeBoss(B);
    if (L0.exit && !L0.exit.open && (!B || !B.alive)) { L0.exit.open = true; notify('THE WAYSTONE WAKES', '#6fd6cc', 3); sfx('chime'); }
    // the exit: stand on it for a moment and it takes you down
    if (L0.exit && L0.exit.open && Math.hypot(L0.exit.x - h.x, L0.exit.y - h.y) < 12 && h.alive) {
      L0.exitT = (L0.exitT || 0) + dt; UI.prompt = 'DESCENDING...';
      if (L0.exitT > .7 && !L0.leaving) { L0.leaving = true; sfx('portal'); levelCleared(h, L0); startAction(h, { name: 'ascend', cancel: false, moveK: 0, rig: { pose: 'cheer' }, update(dt2) { this.t += dt2; P.glints(h.x, h.y, 10 + this.t * 30, 1, '#bff6ff', 14); return this.t < .8; } }); game.after(.7, () => descend(ED.depth + 1)); }
    } else if (L0.exit) L0.exitT = 0;
    // the town portal: walk in to go home (the level is kept until you come back or go down elsewhere)
    if (L0.portal && L0.portal.t > .6 && Math.hypot(L0.portal.x - h.x, L0.portal.y - h.y) < 9) {
      ED.savedLevel = { L: L0, foes: ED.foes.slice(), drops: ED.drops.slice(), boss: ED.boss };
      sfx('portal'); goTown({ arrive: 'portal' });
    }
  },
  draw(r) { worldDraw(r); talk.draw(r); if (ED.demo) r.overlay(g => { const a = .6 + .4 * Math.sin(game.real * 3), y = r.H - 58; px.blend(g, .55, 'normal', () => px.rect(g, 0, y - 3, r.W, 13, '#05040a')); px.blend(g, a, 'normal', () => E.font.text(g, 'DEMO  •  PRESS ANY KEY', r.W / 2, y, '#ffd36a', { align: 'center', shadow: '#05040a', outline: '#0c0818' })); }); }   // above the hotbar, clear of the boss bar and item labels
};

/** a depth is done: record the time (best times per depth for speedrunners) and say how it went */
function levelCleared(h, L0) {
  const tm = L0.t || 0; h.best = h.best || {}; const pb = !h.best[L0.depth] || tm < h.best[L0.depth];
  if (pb && !ED.demo) h.best[L0.depth] = +tm.toFixed(2);
  const ft = v => Math.floor(v / 60) + ':' + String(Math.floor(v % 60)).padStart(2, '0');
  notify('DEPTH ' + L0.depth + ' CLEARED  ' + ft(tm) + (pb ? '  NEW BEST' : '') + '  •  ' + ED.stats.kills + ' KILLS', pb ? '#8fe3ff' : '#c8c0d8', 4);
}

/* ---------- THE PROVING GROUNDS: the stress test lives on as an endless horde in the rune hall ---------- */
const PROVE = { wave: 0, next: 0 };
const PROVE_CORE = ['husk', 'skeleton', 'knight', 'slime', 'wisp'];
/** every other monster that can come in a pack, easiest first (their minDepth), for the Proving Grounds' widening waves */
function proveExtras() { return Object.keys(REG.archetypes).filter(id => { const A0 = REG.archetypes[id], t = A0.tags || []; return !PROVE_CORE.includes(id) && !A0.bossBody && !A0.noPack && !t.includes('boss') && !t.includes('object') && (A0.minDepth || 1) < 900; }).sort((a, b) => (REG.archetypes[a].minDepth || 1) - (REG.archetypes[b].minDepth || 1)); }
const provingScene = {
  enter() {
    ED.mode = 'proving'; ED.depth = Math.max(1, Math.min(ED.hero.maxDepth, 20)); UI.closeAll(); BUS.clear('level');
    const rec = { depth: ED.depth, seed: 77, name: 'The Proving Grounds', theme: 'crypt', hue: 0, layout: 'halls', mechs: ['powder'], pool: PROVE_CORE.slice(), size: [64, 44] };
    // the stress test's hall: a grid of pillars, low walls, torches, the rune circle in the middle
    const w = 64, hh = 44, cells = new Array(w * hh).fill(0), R = RNG(5);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) if (!x || !y || x === w - 1 || y === hh - 1) cells[y * w + x] = 1;
    for (let py = 7; py < hh - 4; py += 10) for (let pxx = 7; pxx < w - 4; pxx += 10) { if (Math.abs(pxx + 1 - w / 2) < 6 && Math.abs(py + 1 - hh / 2) < 5) continue; for (let k = 0; k < 4; k++) cells[(py + (k >> 1)) * w + pxx + (k & 1)] = 2; }
    for (let i = 0; i < 16; i++) { const x = 3 + Math.floor(R() * (w - 8)), y = 3 + Math.floor(R() * (hh - 8)), hz = R() < .5; if (Math.abs(x - w / 2) < 7 && Math.abs(y - hh / 2) < 6) continue; for (let k = 0; k < 3; k++) { const cx = x + (hz ? k : 0), cy = y + (hz ? 0 : k); if (cells[cy * w + cx] === 0) cells[cy * w + cx] = 3; } }
    const L0 = { kind: 'proving', rec, depth: ED.depth, name: rec.name, theme: REG.themes.crypt, hue: 0, w, h: hh, cells, tags: new Array(w * hh).fill(null), rooms: [{ x: 2, y: 2, w: w - 4, h: hh - 4, cx: w / 2, cy: hh / 2 }], things: [], props: [], torches: [], runes: [{ x: w * 8, y: hh * 8, r: 54 }], mechs: [], seen: new Uint8Array(w * hh).fill(1), t: 0 };
    L0.pal = CRYPT; L0.map = new E.TileMap({ w, h: hh, tile: T16, cells, types: REG.themes.crypt.walls, floorTex: (x, y, tag) => cryptFloor(L0, x, y, tag, CRYPT) }); L0.flow = new E.FlowField(L0.map);
    L0.randomFloor = (Rr, o) => randomFloor(L0, Rr, o);
    for (let ty = 4; ty < hh - 3; ty += 6) for (let tx = 4; tx < w - 3; tx += 7) { if (Math.hypot(tx - w / 2, ty - hh / 2) < 5 || R() < .5 || cells[ty * w + tx]) continue; L0.torches.push({ x: (tx + .5) * T16, y: (ty + .5) * T16, t: R() * 9, kind: 'brazier', color: '#ff9a4a', r: 4.5, solid: true }); }
    L0.start = { x: w * 8, y: hh * 8 + 40 };
    enterWorld(L0);
    const h = ED.hero; reviveIfDead(h); h.x = L0.start.x; h.y = L0.start.y; h.act = null; dropIn(h, 100);
    PROVE.wave = 0; PROVE.next = 2; playSong('deep2');
    showCard('The Proving Grounds', 'ENDLESS WAVES', { name: 'The stress test', tip: 'Waves grow without end. Esc opens the menu; the difficulty sliders shape the horde.', color: '#ff9a3a' }, 5);
  },
  update(dt) {
    if (updateUI(dt)) return;
    const h = ED.hero;
    worldStep(dt);
    if (h.dead) { if (deathPanelDue(h) && !UI.isOpen('death')) UI.open('death'); return; }
    if (!ED.foes.length && (PROVE.next -= dt) <= 0) {
      PROVE.wave++; PROVE.next = 2.5; const w = PROVE.wave, n = Math.round((12 + w * 10) * DIFF.density), boss = w % 10 === 0;
      // the horde grows and widens: the stress test's five, then one more kind of monster each wave (the whole bestiary by
      // wave ~17), a composed boss every tenth wave. Packs never land on top of the hero (a spot too close is re-rolled)
      const extras = proveExtras(), kinds = PROVE_CORE.concat(extras.slice(0, Math.max(0, w - 2))), fresh = w > 2 && w - 2 <= extras.length ? extras[w - 3] : null;
      notify('WAVE ' + w + ' • ' + n + ' MONSTERS' + (boss ? ' • AND A BOSS' : fresh ? ' • NEW: ' + (REG.archetypes[fresh].name || fresh).toUpperCase() : ''), '#ff9a3a', 2.5);
      const R = RNG(w * 31); let packs = 0, tries = 0;
      while (packs < Math.ceil(n / 8) && tries++ < 80) {
        const [x, y] = randomFloor(ED.L, R, {}); if (Math.hypot(x - h.x, y - h.y) < 80) continue;
        const newest = fresh && packs === 0 ? fresh : R.pick(kinds);   // the newcomer always gets a pack
        const pk = spawnPack(x, y, { pool: kinds, kind: newest, n: 8, elite: packs === 0 && w % 3 === 0 ? 2 : packs % 4 === 1 ? 1 : 0, rng: R }); for (const m of pk) m.ai.aware = true; packs++;
      }
      if (boss) for (let k = 0; k < 40; k++) { const [x, y] = randomFloor(ED.L, R, {}); if (Math.hypot(x - h.x, y - h.y) < 140) continue; const m = spawnBoss(composeBoss(100 + w, RNG(w * 97)), x, y, { level: ED.depth }); if (m) { ED.boss = m; wakeBoss(m); } break; }
      playSong('deep2');   // (a fallen boss played its victory tune)
    }
    if (game.input.pressed('portal')) goTown();
  },
  draw(r) { worldDraw(r); r.overlay(g => E.font.text(g, 'WAVE ' + PROVE.wave + ' • ' + ED.foes.length + ' LEFT', r.W / 2, 4, '#ff9a3a', { align: 'center', shadow: '#05040a', outline: false })); }
};

/* ---------- global keys: camera, view, mute, hide HUD ---------- */
const ZOOMS = [.75, 1, 1.25, 1.5, 2, 2.5];
function zoomStep(d) { const i = ZOOMS.findIndex(z => z >= game.zoom - 1e-6), z = ZOOMS[clamp((i < 0 ? 2 : i) + d, 0, ZOOMS.length - 1)]; game.setZoom(z); OPT.zoom = z; saveOpts(); game.note('ZOOM ' + z + 'x'); }
addEventListener('keydown', e => {
  if (e.repeat || UI.modal) return;
  if (e.code === 'KeyV') { chooseView(VIEW_IDS[(VIEW_IDS.indexOf(game.baseView.id) + 1) % VIEW_IDS.length]); game.note(game.view.label.toUpperCase() + ' VIEW'); }
  else if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomStep(-1);
  else if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomStep(1);
  else if (e.code === 'BracketLeft' || e.code === 'BracketRight') { game.rotateView(e.code === 'BracketLeft' ? -45 : 45); game.note('TURN ' + game.yaw); }
  else if (e.code === 'Digit0') { resetCamera(); game.note('CAMERA RESET'); }
  else if (e.code === 'KeyM') A.mute();
  else if (e.code === 'KeyH') UI.hideHud = !UI.hideHud;
});
let wheelT = 0;
canvas.addEventListener('wheel', e => { if (UI.modal) return; const t = performance.now(); if (t - wheelT > 120) { wheelT = t; zoomStep(e.deltaY < 0 ? 1 : -1); } }, { passive: true });
BUS.on('heroDie', () => {});
