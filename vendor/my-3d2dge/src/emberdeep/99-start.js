/* ---------- START: powers listen, the title (or a deep link: #town, #depth-7, #proving, #gallery, #gallery/bestiary/husk) ---------- */
installPowers();
const scenes = { title: titleScene, town: townScene, level: levelScene, proving: provingScene, gallery: galleryScene };
game.views = VIEW_IDS.slice();
const link = (location.hash || '').slice(1), dm = /^depth-(\d+)$/.exec(link), gm = /^gallery(?:\/([\w-]+)(?:\/([\w:.-]+))?)?$/.exec(link);
if (link === 'town' || dm || link === 'proving' || gm) { ED.hero = loadHeroOrNew(); }
if (!qs.has('view') && VIEW_IDS.includes(OPT.view)) game.setView(OPT.view);
if (OPT.pixels) applyPixels();   // Settings > Graphics > Pixel size (Large, the game's own sizing, needs nothing)
/* the boot (the engine's, section 10c): the page's splash becomes Emberdeep's boot screen, the system's checks and two real
   steps (each monster's reach measured once, instead of on its first spawn; the composed depths' order worked out ahead),
   with lines of its own while it runs */
const EMBER_LINES = ['Stoking the braziers', 'Whetting the longsword', 'Hiding the powder kegs', 'Teaching skeletons to hold a grudge', 'Filling the Wardens\' lanterns',
  'Winding the Stilled Clockworks', 'Untangling the Brood Mother\'s webs', 'Sweeping the ash out of Emberhold', 'Composing a boss for depth 2,000', 'Rolling legendary powers nobody has seen'];
game.start({ scenes, scene: link === 'town' ? 'town' : dm ? 'level' : link === 'proving' ? 'proving' : gm ? 'gallery' : 'title', data: dm ? { depth: +dm[1] } : link === 'town' ? { arrive: 'waystone' } : gm && gm[1] ? { reel: gm[1], item: gm[2] } : undefined,
  boot: { title: 'EMBERDEEP', version: ED.version, accent: '#ff9a4a', messages: EMBER_LINES, steps: [
    ['Measuring every monster\'s reach', () => { for (const id in REG.archetypes) measureAttacks(REG.archetypes[id]); }],
    ['Composing the depths past ' + PLANNED, () => comboAt(PLANNED + 200)]] } });
/* the game's own handle for the engine's tools: tools/check.mjs prints snapshot(), tools/replay.mjs logs it at the end */
game.debug = {
  snapshot() {
    const h = ED.hero, L0 = ED.L;
    return { mode: ED.mode, depth: ED.depth, level: L0 && L0.name, mechs: L0 && L0.mechs, foes: ED.foes.length, boss: ED.boss && ED.boss.alive ? ED.boss.name : null, drops: ED.drops.length,
      wardens: ED.foes.filter(m => m.ai && m.ai.wd).map(m => m.ai.wd.rung ? 'rung' : m.ai.wd.mind.state),
      hero: h && { character: h.character, level: h.level, x: Math.round(h.x), y: Math.round(h.y), hp: Math.round(h.hp), maxHp: Math.round(h.maxHp), action: h.act && h.act.name } };
  },
  teleport(x, y) { const h = ED.hero; if (!h) return; h.x = x; h.y = y; h.vx = h.vy = 0; game.cam.snap = true; }
};
/* a handle for tools, tests and the curious: window.__ed */
window.__ed = { TUNE, TUNE_OVR, TUNE_KNOBS, tuneSet, tuneReset, ovrSet, CHAR, CHARACTERS, CodexRig, charRig, checkRig, CHAR_STATES, CHAR_VIEWS, LOT_dollRig, characterSaveKey, characterOf, selectCharacter, useSlot, skillCtx, skillRank, startGame, loadHeroOrNew, dressHero, reviveHero, game, ED, REG, UI, DIFF, OPT, CONTROL, DEV, actionLabel, applyControls, devTravel, devStep, devSpawn, menuGo, chooseView, resetCamera, applyPixels, BUS, FX, SLOW, slowMo, levelCardInfo, comboAt, spawnMonster, spawnPack, spawnBoss, makeItem, equip, recipe, buildLevel, descend, goTown, saveGame, newHero, computeStats, gainXp, dealDamage, heroHit, RNG, GAL, galItems, galOpen, galReset, bot: on => botOn(ED.hero, on !== false), botRun, BOT_RUN };
})();
