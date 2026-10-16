/* ---- START: the boot (the 3D engine, then each slice's world, behind the boot screen), then the title menu, or a
 * slice named in the address (#platformer) ---- */
// a 3D genre kit file holds one slice: the menu lists only the slices in this file
for (let i = SLICES.length - 1; i >= 0; i--) if (!scenes[SLICES[i].id]) SLICES.splice(i, 1);
titleMenu.items = SLICES.map(s => s.label);
const first = (location.hash || '').slice(1);
game.start({ scenes, scene: scenes[first] ? first : 'title', boot: { title: 'my-3D2dge 3D', steps: [
  ['The 3D engine: three.js r182, Rapier 0.19.3', () => W3.init(game)],
  ...BOOT,
  ['Building the shaders', () => { for (const w of W3.worlds) w.prepare(); }]
] } });
window.__game = { game, scenes, titleMenu, get title() { return title; } };   // for tests
/* =============================== GAME END =============================== */
