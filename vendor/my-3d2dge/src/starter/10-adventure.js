/* =====================================================================================
 * SLICE 1  ADVENTURE  (Secret of Mana, Zelda: ALttP). Three rooms: village, ruins, shrine. Talk, clear the ruins for
 * the key, open the great door, claim the crystal. THE LOOK: wall MATERIALS, ONE floorTex with PAINTED LIGHT, pitched
 * roofs, leaf-clump bushes, light shafts, dialog PORTRAITS.
 * ANY SCREEN: rooms are 4:3 in a world that goes on past them (forest above and below, the next rooms beside), so a
 * screen of any shape is filled. CAMERA (Settings, or C): ROOMS slides screen by screen as Zelda's does, the rooms beside
 * this one under a dim CURTAIN (they wait, as their monsters do); SCROLL follows the hero. The HUD sits in the corners.
 * ===================================================================================== */
const ADV = (() => {
  const T = 16, ROOM = [14 * T, 12 * T], AREAS = ['Mana Village', 'Mossy Ruins', 'Shrine of Mana'];
  const ROWS = [
    // village          ruins             shrine
    ['^^^^^^^^^^^^^^', 'RRRRRRRRRRRRRR', 'XXXXXXXXXXXXXX'],
    ['^^#^^^^^^^^#^^', 'RHhJKFYDYFKhHR', 'XwjiXnWXnXijwX'],
    ['#UUUU.ZZZZ.~~#', 'R.u..qv.vq.S.R', 'X.S*.B..B.*S.X'],
    ['#GQOQbzNzZu~~#', 'H.KK....x....H', 'X.....rA.....X'],
    ['#ccccV~ccLe~~#', 'K..s.q::::.s.H', 'X..I..++..I..X'],
    ['#cM@cPccac=~~#', 'H.....::::k..K', 'X....m++m....X'],
    ['#,,,,,,,,,,__,', ',,....::C:...H', 'X4.I..++..I.4X'],
    ['#.b...b.g,d__,', ',,..o.::::.s.H', 'X.....++.....X'],
    ['#...%%%f..s~~#', 'Hb.K..::::q.KH', 'X..I..++..I..X'],
    ['#T..%%%.u..~~#', 'H.u..s....y.RH', 'X.p...++...p.X'],
    ['#.3........~~#', 'H...bK...b.xRH', 'X.....E+.....X'],
    ['##############', 'RRRRRRRRRRRRRR', 'XXXXXX++XXXXXX']
  ].map(r => r.join(''));
  // the world AROUND the rooms: PAD rows of forest canopy above and below (a meadow's edge first, the shrine's stone under
  // the shrine), so a screen of any shape is filled. The rooms' rows start at OY
  const PAD = 12, OY = PAD * T, wood = (cx, cy) => cx >= 28 ? 'X' : E.hash2(cx * 7, cy * 5) < .18 ? '2' : '1';
  const AROUND = (cy0, meadow) => Array.from({ length: PAD }, (_, i) => Array.from({ length: 42 }, (_, cx) => meadow && i < 2 && cx < 28 ? '.' : wood(cx, cy0 + i)).join(''));
  ROWS.unshift(...AROUND(0)); ROWS.push(...AROUND(PAD + 12, true));
  const LEGEND = {
    // walls: a wall type (TYPES), or { tile, spawn } = a wall with a prop on its face (THINGS)
    '#': 1, 'U': 5, 'Z': 8, 'R': 9, 'H': 3, 'K': 4, 'F': 6, 'X': 2, 'A': 7, '1': 10, '2': { tile: 10, spawn: 'tree' },
    '^': { tile: 1, spawn: 'tree' }, 'G': { tile: 5, spawn: 'ivy' }, 'Q': { tile: 5, spawn: 'pane' }, 'O': { tile: 5, spawn: 'door' },
    'z': { tile: 8, spawn: 'pane' }, 'N': { tile: 8, spawn: 'shop' }, 'h': { tile: 3, spawn: 'vines' }, 'J': { tile: 3, spawn: 'cobweb' }, 'Y': { tile: 6, spawn: 'moss' }, 'D': { tile: 6, spawn: 'gate' },
    'w': { tile: 2, spawn: 'window' }, 'W': { tile: 2, spawn: 'rose' }, 'i': { tile: 2, spawn: 'torch' }, 'n': { tile: 2, spawn: 'banner' }, 'j': { tile: 2, spawn: 'cobweb' }, 'r': { tile: 7, spawn: 'relic' },
    // floors: a tag for floorTex; block = not walkable
    ',': { floor: 'path' }, 'c': { floor: 'plaza' }, '~': { floor: 'water', block: true }, '_': { floor: 'bridge' }, ':': { floor: 'pave' }, '+': { floor: 'carpet' }, '%': { floor: 'bed' },
    '@': { floor: 'plaza', spawn: 'hero' }, 'M': { floor: 'plaza', spawn: 'elder' }, 'P': { floor: 'plaza', spawn: 'pot' }, 'L': { floor: 'plaza', spawn: 'lamp' },
    'V': { floor: 'water', block: true, spawn: 'fountain' }, 'C': { floor: 'pave', spawn: 'chest' }, 'E': { floor: 'carpet', spawn: 'entry' }, 'd': { floor: 'path', spawn: 'villager' },
    // people, creatures and props
    'f': 'florist', 'a': { floor: 'plaza', spawn: 'cat' }, 's': 'rabite', 'v': 'bat', 'k': 'goblin', 'm': 'mage', 'b': 'bush', 'p': 'pot', 'T': 'oak', 'g': 'sign', 'u': 'mushroom',
    'e': 'barrel', '=': 'crate', '3': 'stump', '4': 'obelisk', 'q': 'ruin', 'I': 'pillar', 'S': 'statue', 'o': 'rock', 'x': 'crystal', 'y': 'skull', 'B': 'brazier', '*': 'candelabra'
  };
  // wall MATERIALS: face = side, roof = top pattern (beam = timber); cut = lowered to cutH in front of the camera
  const SLAB = { face: 'stone', roof: 'slab' }, TYPES = {
    1: { h: 16, cut: true, cutH: 7, face: 'hedge', roof: 'leaves', top: '#3f8c3c', side: '#2e6a34' },   // hedge
    2: { h: 34, cut: true, cutH: 8, ...SLAB, top: '#4e4670', side: '#6a6294', course: 9 },   // shrine stone
    3: { h: 26, cut: true, cutH: 8, face: 'ruin', roof: 'slab', top: '#7a8a66', side: '#8e8a98' },   // ruin wall, mossy top: the 'ruin' MATERIAL (stones, cracks, moss, dirt; docs/ASSETS.md)
    4: { h: 12, cut: true, ...SLAB, top: '#72845e', side: '#8e8a98', course: 6 },   // crumbled ruin
    5: { h: 36, face: 'timber', roof: 'tiles', top: '#c4583a', side: '#f0e0c0', beam: '#6a4228' },   // cottage
    6: { h: 36, ...SLAB, top: '#5a5480', side: '#7a7298', course: 9 },   // shrine facade
    7: { h: 9, ...SLAB, top: '#8a84b4', side: '#5a5484', course: 4 },   // altar
    8: { h: 36, face: 'plaster', roof: 'tiles', top: '#3a7ab4', side: '#f4e6c8' },   // shop
    9: { h: 30, cut: true, cutH: 8, face: 'rock', roof: 'grass', top: '#5a9a44', side: '#8a7462' },   // cliff
    10: { h: 22, face: 'hedge', roof: 'leaves', top: '#2c6a36', side: '#1f4a2a' }   // the forest round the rooms
  };
  // set dressing: tag -> prop(s). r = solid, cut = breakable (debris), drop = loot, face = on the wall at z (anchor
  // 'top' hangs it), light = GPU light, dx = nudge, hidden = appears later; shape = a SHAPE (E.SHAPES, docs/ASSETS.md:
  // right in every view and turn, no drawing code) in place of a prop, size its scale
  const THINGS = {
    // village
    door: [{ face: true, size: 1.1, color: '#7a4222' }, { prop: 'lantern', face: true, z: 33, dx: 14, anchor: 'top', light: '#ffb060' }],
    shop: [{ prop: 'door', face: true, size: 1.1, color: '#2a4a7a' }, { prop: 'awning', face: true, z: 23, size: .95, color: '#d8483a' }],
    pane: { prop: 'window', face: true, z: 12, size: .65, color: '#6a4424', colors: ['#fff0b0', '#ffd070'] }, ivy: { prop: 'vines', face: true, z: 35, anchor: 'top', color: '#3a8a3a', blossom: '#f890b0' },
    fountain: { prop: 'statue', size: .8, color: '#a8a6c0', dx: 8 }, lamp: { prop: 'streetlamp', r: 3, size: .8, halo: false }, oak: { prop: 'tree', size: 1.45, r: 8 },   // lamp: unlit by day
    bush: { r: 6, cut: ['#2f7a34', '#5ab04a', '#9ad86a'] }, pot: { size: .95, r: 5, cut: ['#7a3a22', '#c07040', '#e8a878'], drop: 'gem' }, sign: { r: 4 },
    mushroom: { size: .75, color: '#e0503a' }, barrel: { shape: 'barrel', r: 5, size: .75 }, crate: { shape: 'crate', r: 6, size: .65 },
    // from the asset store, cut into the page's 'adventure' set (src/assets/sets/adventure.js); without it, props
    ...(E.addAssets((window.ASSETS || {}).adventure || { set: 'adventure' }).shapes.length ? { stump: { shape: 'adventure:stump-round', r: 5, size: .7 },
      obelisk: { shape: 'adventure:pillar-obelisk', r: 6, size: .8 } } : { stump: { prop: 'rock', r: 5, color: '#8a5a3a' }, obelisk: { prop: 'pillar', r: 6 } }),
    // ruins
    vines: { face: true, z: 25, anchor: 'top', color: '#4a8a3a', blossom: '#f890b0' }, moss: { prop: 'vines', face: true, z: 35, anchor: 'top', size: .8, color: '#5a8a3a', blossom: '#f890b0' },
    gate: { prop: 'door', face: true, size: 1.1, color: '#5a3a6a' }, ruin: { prop: 'pillar', broken: true, r: 7 }, rock: { r: 5, color: '#8a8698' }, skull: { prop: 'bones' },
    crystal: { r: 4, light: '#5ad8f0' }, chest: { r: 6, hidden: true },
    // shrine
    window: { face: true, z: 7, size: .8, colors: ['#e05a6a', '#5a8ae8', '#f0c85a', '#6ad08a'], light: '#8ab0ff' }, torch: { face: true, z: 14, light: '#ff9a4a' },
    rose: { prop: 'window', face: true, z: 2, size: 1, dx: 8, colors: ['#e8c85a', '#c04aa0', '#5a8ae8'], light: '#c8a0ff' }, banner: { face: true, z: 8, size: .8, color: '#8a1a3a', emblem: '#e8c04a' },
    cobweb: { face: true, z: 34, anchor: 'top', size: .9 }, pillar: { r: 7 }, statue: { r: 6, color: '#9a98b0' }, brazier: { r: 5, size: .9, light: '#ff9a4a' }, candelabra: { r: 3, size: .8, light: '#ffc060' }
  };
  // palettes: E.ramp(hex, n, strength) = n hue-shifted shades, dark to light
  const rgb = hexes => hexes.map(E.hex), R5 = (c, s = .6) => rgb(E.ramp(c, 5, s)), FLAG = (s, mortar) => ({ stones: s.slice(1, 4), mortar, hi: s[4], lo: s[0], speck: s[1] });
  const GRASS = [['#4c9a3e', '#5aa640', '#6cb44c'], ['#42804a', '#4a8a48', '#5a9a4e']].map(room => room.map(c => R5(c))), DIRT = R5('#b08652', .7), WATER = R5('#2a7ac4', .9), STONE = R5('#a49a8a', .7), SOIL = R5('#6e4a34');
  const PLAZA = FLAG(R5('#b4a894'), E.hex('#6a5e52')), PAVE = FLAG(R5('#8a8a96'), E.hex('#3a3a3e')), TILE = [R5('#5a5688'), R5('#403c68')], PETAL = rgb(['#ffffff', '#ffe070', '#f890b0']);
  const CARPET = rgb(E.ramp('#9a2438', 4)), GOLD = rgb(E.ramp('#d8a840', 3)), RUNE = [...E.hex('#6ae8e0'), .35], LILY = R5('#4aa050');   // 4th value = GPU glow
  const SKY = rgb(['#a8dcf4', '#e8f8ff']), REFLECT = E.hex('#1e5a5a');   // sky glints, the hedge's reflection
  const TUFT = ['.l.l.', '.dld.', '..d..'], BLOOM = ['.w.', 'wyw', '.w.'];   // grass stamps
  const MOOD = [[.92, .9, .84], [.8, .88, .8], [.34, .3, .46]];   // GPU ambient light per room
  // light shafts per room: beam x, tint (a dark tint = a faint beam), lean
  const BEAMS = [[[34, 128, 196], '#7a5a26', 60], [[50, 150], '#566a22', 60], [[24, 120, 200], '#4a3a8a', 12]];
  const WIN = { bg: ['#3a4a9e', '#12163e'], border: '#f0e0a8' }, FACE_BG = ['#7aa4e8', '#1e2a66'];
  // pixel sprites ('.' = transparent)
  const GEM = E.sprite(['..g..', '.gGg.', 'gGWGg', 'gGGGg', 'dgGgd', '.dgd.', '..d..'], { g: '#1e9a3a', G: '#56e070', W: '#e8fff0', d: '#0e5a24' });
  const HEART = E.sprite(['.R.R.', 'RWRRR', 'RRRRR', '.RRR.', '..R..'], { R: '#e8384a', W: '#ffd0d6' });
  const KEYS = [1, 2].map(s => E.sprite(['.yy....', 'y..y...', 'Y..Yyyy', '.YY..y.', '.....yY'], { y: '#f8d048', Y: '#b07818' }, s));   // scale 2: held up high
  const CRYSTALS = [1, 2].map(s => E.sprite(['....w....', '...wWc...', '..wWWcc..', '.wWWWccC.', 'wWWWccccC', '.wWWcccC.', '.cWWccCC.', '..cWcCC..', '..ccCC...', '...cC....'], { w: '#f0ffff', W: '#a8f0ff', c: '#4ac8e8', C: '#2a5ab0' }, s));

  // THE CAST: chibi rigs, anime eyes, own outfits and palettes; the hero's cape is SECONDARY MOTION
  const RIGS = {
    hero: () => new E.Humanoid({ size: 1.3, outfit: 'tunic', hair: 'spiky', face: { eyes: 'big', bangs: .8 }, cape: { len: 4, width: 3.2, seg: 2.2 },
      colors: { skin: '#f8cca4', hair: '#e8902c', cloth: '#3a8a4a', trim: '#f0d070', pants: '#4a3a5a', boot: '#8a4a26', belt: '#6a3a1a', glove: '#7a5238', eye: '#3a2a6a', cape: '#d0483a', capeIn: '#7a1e2e' } }),
    elder: () => new E.Humanoid({ size: 1.2, weapon: 'staff', outfit: 'robe', hair: 'short', sleeves: 'long', hunch: .45, hat: { style: 'pointed', color: '#3e3278' }, face: { eyes: 'big', bangs: .35 },
      colors: { skin: '#f0c4a8', hair: '#b8b2c4', cloth: '#5a4a9a', trim: '#f0cc60', belt: '#f0cc60', boot: '#4a3a2a', eye: '#2a2a4a' } }),
    florist: () => new E.Humanoid({ size: 1.15, weapon: null, outfit: 'robe', sleeves: 'long', hair: 'ponytail', face: { eyes: 'big', bangs: 1 },
      colors: { skin: '#f8cca4', hair: '#b0482a', cloth: '#d86a8a', trim: '#f4a8c0', belt: '#fff0d0', pants: '#d86a8a', boot: '#6a3a2a', eye: '#2a5a3a' } }),
    villager: () => new E.Humanoid({ size: 1.1, weapon: null, hair: 'short', hat: { style: 'band', color: '#d8483a' }, face: { eyes: 'big', bangs: .7 }, shoulderHalf: 4.6, armUpper: 5.2, armLower: 5,   // the wave clears his face
      colors: { skin: '#f0c090', hair: '#6a3a1e', cloth: '#e8a83a', trim: '#fff0d0', pants: '#4a5a8a', boot: '#6a4a2a', belt: '#6a4a2a', eye: '#2a3a5a' } }),
    goblin: () => new E.Humanoid({ size: 1.1, build: 'bulky', weapon: null, outfit: 'tunic', hair: 'bald', eyeGlow: '#ffd84a',
      colors: { skin: '#8ab84a', cloth: '#8a5a32', trim: '#c8a040', pants: '#4a3a2a', boot: '#3a2a1a', belt: '#3a2a1a' } }),
    mage: () => new E.Humanoid({ size: 1.3, build: 'heroic', weapon: 'staff', outfit: 'robe', hood: true, sleeves: 'long', eyeGlow: '#ff6ab0',
      colors: { skin: '#c8b8e0', hair: '#2e2450', cloth: '#4a3a86', trim: '#d070f0', belt: '#d070f0', boot: '#1a1628', orb: '#ff80e0' } })
  };
  // BLOB CREATURES: a round body plus parts
  const RABITE = { dk: '#b0703a', base: '#f4d49a', lt: '#fff4dc', pupil: '#5a1a2a', inner: '#f09aa8', ext: '#d8a060' };
  const BAT = { dk: '#2e1a44', base: '#6a4a9a', lt: '#a890d0', eye: '#fff0a0', pupil: '#c02020', wing: '#4a2a6a', inner: '#e08aa0' };
  const CAT = { dk: '#9a5028', base: '#f0a050', lt: '#ffd8a0', pupil: '#2a4a1a', inner: '#f8b0b0', ext: '#fff0e0' };
  const FOES = {   // hp (a hit does 8-12), look, moves (E.MOVES with a long, deep wind-up: the TELL)
    rabite: { hp: 18, look: () => new E.Blob({ R: 5.5, colors: RABITE, ears: 'rabbit', feet: true, tail: true, mouth: true, face: 'front' }) },
    bat: { hp: 12, fly: 17, look: () => new E.Blob({ R: 4.5, colors: BAT, wings: true, ears: 'cat', mouth: 'fangs', face: 'front' }) },
    goblin: { hp: 40, look: RIGS.goblin, moves: ['claw', 'twohand'], tune: { wind: .34, crouch: 1, lean: .9 } },   // a raking claw, a two-fist SLAM
    mage: { hp: 30, look: RIGS.mage, moves: ['cast'], tune: { wind: .6, lean: .6 } }   // leans back to raise, recoils forward to release
  };
  // spins at the waist; CHARGE: the spin's wind-up, deeper
  const WAIST = { z0: -10, z1: -10 }, CHARGE = { ...E.MOVES.spin, ...WAIST, a0: 2.4, crouch: .6, lean: .6 };
  // idle: poses in turn; near: turn to the hero (wave: say hello); talk: gestures; chore: a move while kneeling
  const NPCS = {
    elder: { name: 'ELDER', idle: [null, null, 'hips'], near: 56, talk: ['block', null, 'hips', null], lines: [() => 'Rabites overran the Mossy Ruins across the river. Press ' + game.input.label('attack') + ' to swing your sword and clear them out!',
      'Clear the ruins and the old chest opens. The Mana crystal sleeps in the shrine behind the great door.'] },
    florist: { name: 'LISE', face: Math.PI, idle: ['kneel', 'kneel', null], near: 36, talk: ['hips', 'cast'],   // tends the flower bed
      chore: () => new E.Attack('plunge', { hand: 'both', a0: -.5, a1: -.9, r0: 4, r1: 9, wind: .3, active: .16, recover: .45 }),
      lines: ['A rabite got into my garden again! Could you shoo it away?', 'Mind the bats in the ruins. They swoop when you get close!'] },
    villager: { name: 'PIP', idle: [null, 'hips'], near: 50, wave: true, talk: ['hips', null], lines: ['Hi! The bridge leads to the Mossy Ruins.', () => 'Keep ' + game.input.label('attack') + ' held after a swing, then let go: a SPIN ATTACK!'] }   // a function: the player's own key
  };
  // BACKDROP (iso view): a sea of clouds
  const bg = new E.Backdrop({ sky: ['#3a74c8', '#8ac2ea', '#e4f2f4', '#9ccae6', '#5a90c8'], layers: [{ kind: 'clouds', color: '#ffffff', y: .3, height: .16, parallax: .04, drift: 3 },
    { kind: 'clouds', color: '#ffffff', y: .98, height: .4, parallax: .1, drift: 3, seed: 9 }] });
  let map, relic, entry, hero, npcs, foes, pets, items, things, roofs, shots, talk, speaker, won, keys, gems, area, held, fx;
  // CAMERA, the player's choice: 'rooms' slides screen by screen (Zelda), 'scroll' follows the hero (Settings, or C)
  game.settings.define({ key: 'advCamera', group: 'Adventure', label: 'Camera', options: [['rooms', 'Rooms'], ['scroll', 'Scroll']], value: 'rooms', help: 'Rooms: screen by screen, as Zelda. Scroll: it follows the hero' });
  // LIGHTING: GPU lights (pools of light and shadows, WebGPU) draw every frame twice and light each pixel: a phone's frame
  // rate pays for them, so Auto keeps them for a computer (its main pointer a mouse or touchpad) and a phone gets Fast (the
  // floor is lit already): the main pointer, as a phone with a stylus has a fine one too
  const gpuWanted = () => game.settings.advLight === 'gpu' || (game.settings.advLight === 'auto' && !!(window.matchMedia && matchMedia('(pointer: fine)').matches));
  const lighting = () => { if (!map) return; if (gpuWanted() && !gpu) gpu = game.enableGPU({ map }); if (gpu) Object.assign(gpu, { map, enabled: gpuWanted(), bands: 24, wrap: .5 }); };
  game.settings.define({ key: 'advLight', group: 'Adventure', label: 'Lighting', options: [['auto', 'Auto'], ['gpu', 'GPU'], ['fast', 'Fast']], value: 'auto', help: 'GPU: pools of light and shadows (slow on a phone). Fast: smooth on a phone. Auto: GPU on a computer, Fast on a phone', apply: () => { if (game.sceneName === 'adventure') lighting(); } });
  addEventListener('keydown', e => { if (e.code !== 'KeyC' || e.repeat || game.sceneName !== 'adventure' || game.paused) return; const v = game.settings.advCamera === 'rooms' ? 'scroll' : 'rooms'; game.settings.set('advCamera', v); game.note('CAMERA: ' + v.toUpperCase()); });
  const sliding = () => !!game.cam.room && game.cam.moving;   // a room slide holds the world still
  const roomOf = x => Math.floor(x / ROOM[0]), mod = (a, n) => ((a % n) + n) % n, near = (cx, cy, tag) => map.floorAt((cx + .5) * T, (cy + .5) * T) === tag;
  const txt = (g, s, x, y, c, o) => E.font.text(g, s, x, y, c, { shadow: '#07040c', outline: false, ...o });
  const talkable = () => npcs.find(n => E.dist(hero, n) < 34);
  // CONTACT SHADOWS: a darker core in a soft ellipse, cool purple
  const shadow = (r, x, y, rad) => { r.shadow(x, y, rad, .28, '#2a2048'); r.shadow(x, y, rad * .6, .22, '#2a2048'); };

  /* ---- FLOORS: floorTex(x, y, tag) = [r, g, b(, glow)], baked once per view ---- */
  // AUTOTILING: distance to the nearest side bordering another floor, corners rounded by K
  function edge(cx, cy, lx, ly, tag, K) {
    const o = (dx, dy) => { const t = map.floorAt((cx + dx + .5) * T, (cy + dy + .5) * T), c = map.cell(cx + dx, cy + dy); return tag === 'water' ? t !== tag && t !== 'bridge' && !c : t !== tag || c !== 0; };
    const a = Math.min(o(-1, 0) ? lx : 99, o(1, 0) ? T - lx : 99), b = Math.min(o(0, -1) ? ly : 99, o(0, 1) ? T - ly : 99);
    return a < K && b < K ? K - Math.hypot(K - a, K - b) : Math.min(a, b);
  }
  // GRASS: TUFT and BLOOM stamps on a staggered lattice in SCREEN pixels
  function grass(sx, sy, G) {
    const row = Math.floor(sy / 7), X = sx + (row & 1) * 6, k = E.hash2(Math.floor(X / 12), row), pat = k < .07 ? BLOOM : k < .62 ? TUFT : null;
    const ch = pat && (pat[mod(Math.floor(sy), 7) - 2] || '')[mod(Math.floor(X), 12) - (pat === BLOOM ? 5 : 4)];
    return ch === 'l' ? G[3] : ch === 'd' ? G[1] : ch === 'y' ? PETAL[1] : ch === 'w' ? PETAL[k < .035 ? 0 : 2] : G[2];
  }
  function ground(x, y, tag) {
    const cx = Math.floor(x / T), cy = Math.floor(y / T), lx = x - cx * T, ly = y - cy * T, room = roomOf(x), [sx, sy] = game.view.p(x, y), h = E.hash2(cx, cy);
    const e = tag && tag !== 'carpet' ? edge(cx, cy, lx, ly, tag, tag === 'water' ? 7 : tag === 'pave' ? 1 : 4) : 99;
    if (e < 0) tag = null;   // outside a rounded corner
    // WATER: bank, lip, shadow, reflection, foam, then depth BANDS bent by value noise
    if (tag === 'water') {
      if (e < 2.6) return e < 1 ? STONE[0] : E.hash2(Math.floor(y / 3), cx) < .2 ? STONE[1] : STONE[e < 1.8 ? 4 : 3];
      const w = (E.noise2(x / 6, y / 9) - .5) * 5, foam = near(cx, cy - 1, 'bridge') ? ly : near(cx, cy + 1, 'bridge') ? T - ly : 99;
      if (e < 3.3 || foam < 3 + w + E.hash2(Math.floor(sx / 2), 1) * 2) return foam < 1.5 + w ? SKY[1] : WATER[4];
      if (!near(cx - 1, cy, 'water') && lx < 6 + w) return WATER[0];
      if (map.cell(cx + 1, cy) > 0 && lx > 11 + w) return REFLECT;
      const px_ = lx - 4 - h * 8, py_ = ly - 4 - h * 7, pad = Math.hypot(px_, py_);
      if (h < .3 && pad < 3) return LILY[pad < 1 ? 4 : px_ > .5 && Math.abs(py_) < .5 ? 1 : 2];
      const k = mod(Math.floor(sx) + Math.floor(sy / 6) * 7, 23);   // sky glints on every 6th row
      return mod(Math.floor(sy), 6) === 0 && k < 4 ? SKY[k ? 0 : 1] : WATER[e + w < 8 ? 3 : e + w < 12 ? 2 : 1];
    }
    if (tag === 'bridge') return (ly < 2 && !near(cx, cy - 1, tag)) || (ly > T - 2 && !near(cx, cy + 1, tag)) ? DIRT[0] : E.tex.planks(y, x, { base: '#b07c44', dark: '#8a5c32', line: '#4a2e1a' });
    // path and paving: grass erodes the edge by a hash; dirt, pebbles
    const q = E.hash2(Math.floor(sx / 6), Math.floor(sy / 5)), b = E.hash2(Math.floor(x / 4), Math.floor(y / 4)) * 3;
    if (tag === 'path') return e < b ? grass(sx, sy, GRASS[room][1]) : e < b + .9 ? DIRT[0] : q < .16 && mod(Math.floor(sx), 6) < 2 && mod(Math.floor(sy), 5) === 0 ? DIRT[q < .07 ? 4 : 1] : DIRT[e < b + 1.8 ? 1 : 2];
    if (tag === 'plaza') return e < .9 ? PLAZA.mortar : E.tex.flagstone(x, y, PLAZA, 8);
    if (tag === 'bed') return e < 1 ? STONE[0] : e < 2.4 ? STONE[3] : SOIL[mod(ly, 4) < 1 ? 0 : 2];
    const c = Math.min(near(cx - 1, cy, tag) ? 99 : lx, near(cx + 1, cy, tag) ? 99 : T - lx), m = Math.abs(mod(x, 32) - 16) + Math.abs(ly - 8);   // carpet
    if (tag === 'carpet') return c < 1 ? CARPET[0] : c >= 2 && c < 3 ? GOLD[1] : m > 5 && m < 6.5 ? GOLD[0] : m < 2.5 ? GOLD[2] : CARPET[1];
    const f = E.tex.flagstone(x, y, PAVE);   // paving: moss in the seams
    if (tag === 'pave') return e < b ? grass(sx, sy, GRASS[1][1]) : e < b + .9 ? PAVE.mortar : f === PAVE.mortar && E.hash2(Math.floor(x / 6), Math.floor(y / 6)) < .45 ? GRASS[1][1][1] : f;
    const n = E.noise2(x / 40 + room * 9, y / 40);   // lawn: three shades in slow patches
    if (room < 2) return grass(sx, sy, GRASS[room][n < .36 ? 0 : n > .64 ? 2 : 1]);
    const dr = Math.hypot(x - relic.x, y - relic.y), a = Math.atan2(y - relic.y, x - relic.x), P = TILE[(cx + cy) & 1];
    if (Math.abs(dr - 15) < .7 || Math.abs(dr - 10.5) < .6 || (dr > 11 && dr < 14.5 && Math.abs(mod(a / Math.PI * 4, 1) - .5) < .06)) return RUNE;   // shrine: a rune circle...
    if (dr < 26) return dr > 24.8 ? TILE[1][0] : dr > 23.2 ? TILE[0][4] : TILE[dr < 20 ? 1 : 0][2];   // ...on a round dais with a lit rim...
    if (Math.min(lx, ly) < 1.2) return P[lx < .8 || ly < .8 ? 0 : 4];   // ...on marble tiles
    return lx > T - 1.2 || ly > T - 1.2 ? P[1] : mod(lx + ly, 13) < 1 ? P[3] : P[2];
  }
  // PAINTED LIGHT (Legend of Mana): a wall taller than its distance toward the low sun shades a point cool purple
  const SHADE = [.64, .68, .86];
  function floorTex(x, y, tag) {
    const c = ground(x, y, tag);
    for (let d = 2; d < 18; d += 2) if (map.heightAt(x - d, y - d * .3) > d * 1.8) return c.map((v, i) => i < 3 ? v * SHADE[i] : v);
    return c;
  }

  // trees and pines varied by hashes
  const tree = (cx, cy, pine) => { const v = E.hash2(cx * 5, cy * 3); return { prop: pine || v > .72 ? 'pine' : 'tree', size: 1 + v * .45, color: ['#2f7a3c', '#3f8a45', '#2a6a44', '#4a8a3a'][Math.floor(v * 4)], x: (cx + .3 + E.hash2(cy, cx) * .4) * T }; };
  function start() {
    map = new E.TileMap({ rows: ROWS, legend: LEGEND, types: TYPES, floorTex, ao: 8 });
    relic = map.find('relic'); entry = map.find('entry'); relic.x += T / 2; entry.x += T / 2;   // on the room's center line
    // the camera stays inside the map (the forest round the rooms fills a tall screen); update() sets rooms or scroll
    game.cam.bounds = v => { const b = map.bounds(v); return { x0: b.x0 + 9, y0: b.y0 + 9, x1: b.x1 - 9, y1: b.y1 - 9 }; }; game.cam.room = game.settings.advCamera === 'scroll' ? null : ROOM;
    const at = map.find('hero');
    // SWORD (Secret of Mana): J chains slash, backslash, spin, kept low (a raised blade crosses his face); short holds (hold)
    // let the follow-through settle instead of freezing; hold J to CHARGE
    hero = Object.assign(new E.Body({ ...at, r: 4.5 }), { hp: 3, max: 3, facing: Math.PI / 2, inv: 0, hurt: 0, charge: 0, rig: RIGS.hero(),
      combo: new E.Combo([new E.Attack('slash', { z0: -8, z1: -11, a1: -1.2, wind: .12, hold: .1 }), new E.Attack('backslash', { z0: -11, z1: -9, a1: 1.2, hold: .1 }), new E.Attack('spin', { ...WAIST, hold: .15 })], { window: .3 }),
      spin: new E.Attack('spin', { ...WAIST, active: .36, reach: 10, lean: .3, hold: .12 }) });
    hero.sw = hero.combo;   // the attack running now
    npcs = Object.keys(NPCS).map(k => { const n = Object.assign({ said: 0, t: 0, k: 0, hi: 0, nod: 0, face: Math.PI / 2, rig: RIGS[k]() }, map.find(k), NPCS[k]); n.dir = n.look = n.face; n.job = n.chore && n.chore(); return n; });
    things = [];
    for (const s of map.spawns) for (const d of [].concat(s.tag === 'tree' ? tree(s.cx, s.cy) : THINGS[s.tag] || []))
      things.push(Object.assign({ tag: s.tag, prop: s.tag, x: s.x + (d.dx || 0), y: s.y, room: roomOf(s.x) }, d));
    // one pass over the cells: roofs, pines, weeds, flower beds, bridge rails, tufts
    const box = {};
    for (let cy = 0; cy < map.h - 1; cy++) for (let cx = 0; cx < map.w; cx++) {
      const c = map.cell(cx, cy), v = E.hash2(cx * 3, cy * 7 + 1), X = (cx + .5) * T, Y = (cy + .5) * T, tag = map.floorAt(X, Y), add = o => things.push(Object.assign({ x: X, y: Y }, o));
      if (c === 5 || c === 8) { const b = box[c] || (box[c] = [cx, cy, cx, cy]); b[2] = cx; b[3] = cy; }
      if (map.spawns.some(s => s.cx === cx && s.cy === cy)) continue;
      if (c === 9 && cy === PAD && v < .5) add(tree(cx, cy, true));
      else if ((c === 3 || c === 4) && v < .45) add({ prop: 'bush', size: .7 + v * .6, color: '#5a8a44' });
      else if (tag === 'bed') {
        for (const k of [-3, 3]) add({ prop: 'flowers', size: 1.1, x: X + k, y: Y + k, color: k < 0 ? ['#f06a9a', '#f0a040', '#ffffff'][cx % 3] : '#8ab0ff', color2: '#fff4a0' });
        if (!near(cx, cy + 1, 'bed')) add({ prop: 'fence', size: 1.2, y: Y + 8, color: '#b08050' });
      }
      else if (tag === 'bridge') for (const s of [-1, 1]) { if (!near(cx, cy + s, 'bridge')) add({ prop: 'fence', size: 1.2, y: Y + s * 7, color: '#8a5a32' }); }
      else if (!c && !tag && X < 2 * ROOM[0] && v < .16) add({ prop: v < .06 ? 'flowers' : 'grass', x: X + (E.hash2(cx, cy) - .5) * 10, y: Y + (E.hash2(cy, cx) - .5) * 8,
        color: v < .06 ? '#f06a9a' : X > ROOM[0] ? '#5a9a4a' : '#6ab850', color2: '#fff4a0' });
    }
    roofs = Object.keys(box).map(id => { const [a, b, c, d] = box[id]; return { x0: a * T, y0: b * T, x1: (c + 1) * T, y1: (d + 1) * T, h: TYPES[id].h, C: E.ramp(TYPES[id].top, 5) }; });
    items = [{ kind: 'relic', x: relic.x, y: relic.y }];
    // bats roost (hang; wake = time since); stun = flinch; dying = death; streak = claw marks; hold = an impact frame
    foes = Object.keys(FOES).flatMap(k => map.findAll(k)).map(s => { const F = FOES[s.tag], moves = (F.moves || []).map(m => new E.Attack(m, { recover: .45, hold: .5, ...F.tune }));
      return Object.assign(new E.Body({ ...s, r: 5.5, friction: 6, ...(F.fly && { z: F.fly + 8, gravity: 0, onGround: false }) }), { kind: s.tag, hp: F.hp, fly: F.fly, hang: !!F.fly, home: { ...s },
        t: 1 + Math.random(), flash: 0, stun: 0, swoop: 0, wake: 9, streak: [], face: Math.PI / 2, room: roomOf(s.x), look: F.look(), moves, atk: moves[0] }); });
    pets = map.findAll('cat').map(s => Object.assign(new E.Body({ ...s, r: 4 }), { t: 1, home: { ...s }, look: new E.Blob({ R: 4, colors: CAT, ears: 'cat', tail: true, feet: true, mouth: true, face: 'front' }) }));
    shots = new E.Bullets(game, { plane: 'ground' }); talk = new E.Dialog(game, WIN);
    fx = []; won = false; keys = 0; gems = 0; area = { room: 0, t: 2.6 }; held = null;
    // the floor is lit already; GPU lighting (if any) adds light pools and shadows
    L.enabled = false; lighting(); if (gpu) gpu.ambient = MOOD[0]; A.music('adventure');
    game.input.touchSet('attack', 'SWORD');
  }
  // DIALOG: E.Dialog types and pages; portrait: a live close-up of the speaker
  const say = (who, name, text) => { speaker = who; talk.say(typeof text === 'function' ? text() : text, { name, portrait: who.rig, portraitSize: 50, portraitOpts: { zoom: 2.6, turn: -.25, cape: false, bg: FACE_BG } }); };   // (at the bottom, clear of the touch buttons)
  function hurtHero(ang) {   // flinch, knockback, blink; true if it hurt
    if (hero.inv > 0 || won || hero.hp <= 0) return false; hero.hp -= .5; hero.inv = 1; hero.hurt = .25; hero.charge = 0; hero.combo.cancel(); hero.spin.cancel(); hero.push(Math.cos(ang) * 160, Math.sin(ang) * 160);
    game.hitFx(hero.x + Math.cos(ang) * 3, hero.y + Math.sin(ang) * 3, 12, { power: .9, angle: ang + Math.PI, color: '#ff8a6a', sound: 'hurt' }); game.flash('#ff4a3a', .06, .4);
    if (hero.hp <= 0) { poof(hero.x, hero.y, 0, 1.2); game.after(.8, () => game.go('over', { from: 'adventure' })); }
    return true;
  }
  const shiver = k => Math.sin(game.time * 90) * k;   // a tremble (tells, charging)
  // a sword hit (k = power): game.hitFx, a FLINCH (stun, squash, hurt pose), knockback; the last starts the death
  function strike(f, k = 1) {
    const h = hero, an = E.angleTo(h, f), dmg = Math.round(E.randInt(8, 12) * k);
    f.hp -= dmg; f.dmg = dmg; f.hitT = game.time; f.flash = .06; f.stun = .3; f.swoop = 0; f.aim = null; if (f.atk) f.atk.cancel(); f.look.kick(-6);
    E.knockback(h, f, (f.hp > 0 ? 220 : 100) * k, f.fly ? 0 : f.hp > 0 || f.moves.length ? 60 : 140);   // a dead rabite pops up
    game.hitFx(lerp(h.x, f.x, .6), lerp(h.y, f.y, .6), 10 + f.z * .5, { angle: an, power: k });
    if (f.hp <= 0) { f.dying = f.fly ? .6 : f.moves.length ? 1.2 : .7; f.gravity = 700; f.hang = false; game.freeze(.1); A.sfx('stomp'); }
  }
  function vanish(f) {   // after the death animation: a poof, bits and a drop
    f.dead = true; poof(f.x, f.y, f.z, f.kind === 'mage' ? 1.4 : 1);
    if (f.kind === 'mage') { P.glints(f.x, f.y, 14, 8, '#f0b0ff', 18); game.flash('#f0d0ff', .08, .5); A.sfx('explode', { pitch: 1.3 }); }
    else P.bits(f.x, f.y, 6 + f.z, 14, f.look instanceof E.Blob ? [f.look.C.dk, f.look.C.base, f.look.C.lt] : ['#8ab84a', '#8a5a32', '#c8d0d8']);
    items.push({ kind: hero.hp < hero.max && E.chance(.5) ? 'heart' : 'gem', x: f.x, y: f.y });
  }
  // push bodies out of solid props
  const settle = b => { for (const t of things) if (t.r && !t.dead && !t.hidden) { const dx = b.x - t.x, dy = b.y - t.y, dd = Math.hypot(dx, dy) || 1, m = b.r + t.r; if (dd < m) { b.x = t.x + dx / dd * m; b.y = t.y + dy / dd * m; } } };
  // prize: face the camera and CHEER. Charging holds CHARGE's wind-up, deeper as it builds
  function poseHero(dt) {
    const h = hero, cheer = held && held.t > 0, still = talk.open || sliding() || cheer, v = game.view;
    h.rig.update(dt, { x: h.x, y: h.y, z: h.z, vx: still ? 0 : h.vx, vy: still ? 0 : h.vy, facing: cheer ? Math.atan2(v.fy, v.fx) : h.facing, hurt: h.hurt > 0, pose: cheer ? 'cheer' : null,
      attack: cheer ? null : h.charge > .15 ? { spec: CHARGE, phase: 'wind', u: Math.min(1, (h.charge - .15) / .45) } : h.sw.state });
  }
  // NPCS LIVE: idle poses, glances, chores; turn to the hero when near (a hello per visit); gesture and nod when speaking
  function npcLife(n, dt) {
    const d = E.dist(hero, n), near = d < n.near, says = talk.open && speaker === n, g = says && n.talk[Math.floor(game.real / .9) % n.talk.length];
    if ((n.t -= dt) <= 0) { n.t = E.rand(2, 4.5); n.pose = n.idle[n.k++ % n.idle.length]; n.look = n.face + E.rand(-.7, .7) * (n.job && n.pose ? .3 : 1); }   // at work: eyes on the work
    if (n.wave && near && !n.met) n.hi = 2;
    n.met = near || n.met && d < n.near + 24; n.hi -= dt;   // waves again after he left
    if ((n.hi > 0 || says && talk.typing) && (n.nod -= dt) <= 0) { n.nod = n.hi > 0 ? .57 : E.rand(.25, .45); n.rig.kick(-2.5); }   // a nod every few words, a bob per wave
    const job = n.job && n.pose && !near && n.job;   // pats the soil, pauses, pats
    if (job) { if (!job.busy && Math.random() < dt * 1.5) job.start(); job.update(dt); }
    // a hello faces the camera, a speaker mostly (a stage actor): gestures clear the face
    const cam = Math.atan2(game.view.fy, game.view.fx), to = E.angleTo(n, hero);
    n.dir = E.approachAng(n.dir, n.hi > 0 ? cam : says ? to + E.angDiff(to, cam) * .6 : near ? to : n.look, dt * 6);
    n.rig.update(dt, { x: n.x, y: n.y, facing: n.dir, pose: g || (n.hi > 0 ? 'wave' : near ? null : n.pose), expr: (n.hi > 0 || says) && 'smile', attack: job ? job.state : null });
  }
  function update(dt) {
    const h = hero, room = roomOf(h.x), inp = game.input, npc = talkable();
    inp.touchSet('confirm', talk.open ? 'NEXT' : 'TALK', talk.open || !!npc);   // a CONTEXT button: there only when there is someone to talk to
    if (held) held.t -= dt;
    for (const n of npcs) npcLife(n, dt);
    if (talk.update(dt)) { poseHero(dt); return; }   // dialog pauses the world
    if (gpu) gpu.ambient = MOOD[room];
    if (room !== area.room) area = { room, t: 2.6 }; else area.t -= dt;
    if (sliding() || won || held && held.t > 0) { poseHero(dt); return; }   // the room slides or the hero cheers
    h.inv -= dt; h.hurt -= dt; if (h.hp <= 0) return;
    if (npc && inp.pressed('confirm')) return void say(npc, npc.name, npc.lines[npc.said++ % npc.lines.length]);
    // screen-relative keys become a ground direction; swings root the hero
    const mv = inp.move(), md = game.view.screenDirToGround(mv[0], mv[1]), sp = h.sw.busy ? 20 : h.charge > .15 ? 45 : 80;
    if (Math.hypot(md[0], md[1]) > .1 && !h.sw.busy) h.facing = Math.atan2(md[1], md[0]);
    const hurt = h.hurt > 0, acc = (hurt ? 400 : 900) * dt; h.vx = approach(h.vx, hurt ? 0 : md[0] * sp, acc); h.vy = approach(h.vy, hurt ? 0 : md[1] * sp, acc);
    // sword: one hit per target per swing; a press chains the combo; holding J charges, letting go spins
    if (inp.buffered('attack') && !h.spin.busy && h.combo.press()) { inp.consume('attack'); h.charge = 0; }
    if (inp.down('attack') && !h.sw.busy) { if (h.charge < .6 && (h.charge += dt) >= .6) { A.sfx('charge'); P.glints(...h.rig.tip(), 6); game.flash('#fff4c0', .1, .35); h.rig.kick(5); } }
    else { if (h.charge >= .6 && h.spin.start()) game.shake(2); h.charge = 0; }
    if (h.charge >= .6 && Math.random() < dt * 12) P.glints(...h.rig.tip(), 1, '#fff4a0', 4);
    for (const a of [h.combo, h.spin]) if (a.update(dt) === 'active') A.sfx(a === h.combo && h.combo.step < 2 ? 'swing' : 'whoosh');
    const sw = h.sw = h.spin.busy ? h.spin : h.combo, round = sw === h.spin || h.combo.step === 2;   // spins hit all around
    const reach = t => E.inArc(h, h.facing, t, round ? 26 : 22, round ? Math.PI : 1.4);
    sw.hits(foes, f => f.hp > 0 && reach(f), f => strike(f, sw === h.spin ? 1.5 : 1));
    // bushes and pots break (pots hide a gem)
    sw.hits(things, t => t.cut && reach(t), t => {
      t.dead = true; P.bits(t.x, t.y, 6, 14, t.cut); poof(t.x, t.y, 0, .6); A.sfx(t.prop === 'pot' ? 'bump' : 'whoosh');
      const kind = t.drop || E.chance(.5) && (E.chance(.7) ? 'gem' : 'heart'); if (kind) items.push({ kind, x: t.x, y: t.y });
    });
    h.update(dt, map); settle(h);
    // a cleared ruin reveals the key chest
    const chest = things.find(t => t.tag === 'chest'), gate = things.find(t => t.tag === 'gate');
    if (chest.hidden && foes.every(f => f.room !== 1 || f.dead)) { chest.hidden = false; poof(chest.x, chest.y, 0, 1.3); P.glints(chest.x, chest.y, 10, 8); A.sfx('secret'); }
    if (!chest.hidden && !chest.open && E.dist(h, chest) < 15) {
      chest.open = true; keys++; held = { spr: KEYS[1], t: 1.6 }; A.sfx('key'); P.glints(h.x, h.y, 40, 10); game.flash('#fff4c0', .15, .5);
      game.after(1.6, () => say(h, 'HERO', 'I got the SHRINE KEY! Now the great door in the ruins will open.'));
    }
    // the key opens the door and warps the hero inside
    if (keys > 0 && !gate.open && E.dist(h, gate) < 22) {
      gate.open = true; keys--; A.sfx('door'); game.shake(3); P.dust(gate.x, gate.y + 10, 2, 14, { color: '#8a7a6a', speed: 50 });
      game.after(.5, () => { Object.assign(h, { x: entry.x, y: entry.y, vx: 0, vy: 0, facing: -Math.PI / 2 }); game.cam.snap = true; game.flash('#07040c', .5); A.sfx('warp'); });
    }
    for (const it of items) if (!it.got && E.dist(it, h) < (it.kind === 'relic' ? 15 : 10)) {
      it.got = true; P.glints(it.x, it.y, 6, 4); if (it.kind === 'gem') { gems++; A.sfx('coin'); } else if (it.kind === 'heart') { h.hp = Math.min(h.max, h.hp + 1); A.sfx('heal'); }
      else { won = true; held = { spr: CRYSTALS[1], t: 99 }; game.flash('#ffffff', .2); P.glints(it.x, it.y, 20, 24, '#bff8ff', 30); A.music('victory'); game.after(6, () => game.go('title')); }
    }
    // enemies act only in the hero's room. A hit stuns (no AI); the last plays the death, then vanish()
    for (const f of foes) {
      if (f.dead) continue; f.flash -= dt; f.t -= dt; f.stun -= dt; f.wake += dt;
      const on = f.room === room, dx = h.x - f.x, dy = h.y - f.y, dd = Math.hypot(dx, dy) || 1;
      if (f.dying > 0) { if ((f.dying -= dt) <= 0) vanish(f); }
      else if (f.stun > 0) { /* flinch: knocked back */ }
      else if (f.kind === 'rabite') {   // hops about; near the hero it crouches and shivers (the tell), POUNCES
        if (on && f.onGround && f.t <= 0) {
          const chase = dd < 72 || f.tell, a = chase ? Math.atan2(dy, dx) : E.dist(f, f.home) > 20 ? E.angleTo(f, f.home) : Math.random() * TAU;
          if (dd < 34 && !f.tell) { f.tell = true; f.t = .5; }
          else { const v = f.tell ? 210 : chase ? 75 : 35; f.push(Math.cos(a) * v, Math.sin(a) * v, 0); f.jump(chase ? 150 : 110); f.look.kick(f.tell ? 7 : 4);
            f.t = f.tell ? 1.2 : chase ? .6 + Math.random() * .6 : .8 + Math.random(); f.tell = false; }
        }
      } else if (f.kind === 'bat') {   // roosts, weaves overhead, rears up (the tell), SWOOPS
        if (f.hang) { if (on && dd < 64) { f.hang = false; f.wake = 0; f.look.kick(8); A.sfx('whoosh', { pitch: 1.8 }); } }   // woken
        else {
          if (on && f.swoop <= 0 && f.t <= 0 && dd < 48) { f.swoop = 1.1; f.t = 2.6; A.sfx('whoosh', { pitch: 1.6 }); }
          f.swoop -= dt; const rear = f.swoop > .75, dive = f.swoop > 0 && !rear, acc = (dive ? 500 : 260) * dt;
          const a = Math.atan2(dy, dx) + (f.swoop > 0 ? 0 : Math.sin(game.time * 4 + f.y) * 1.1), s = !on || rear ? 0 : dive ? 90 : 30;
          f.vx = approach(f.vx, Math.cos(a) * s, acc); f.vy = approach(f.vy, Math.sin(a) * s, acc);
          f.onGround = false; f.vz = ((rear ? f.fly + 14 : dive ? 5 : f.fly + Math.sin(game.time * 3 + f.x) * 3) - f.z) * (rear ? 8 : 5);
        }
      } else if (f.kind === 'goblin') {   // winds up (crouch, lean back, shiver, glint: the TELL), CLAWS or SLAMS
        const busy = f.atk.busy, go = on && !busy && dd > 17 ? 32 : 0; if (!busy) f.face = Math.atan2(dy, dx);
        f.vx = approach(f.vx, dx / dd * go, 300 * dt); f.vy = approach(f.vy, dy / dd * go, 300 * dt);
        if (on && !busy && dd < 21 && f.t <= 0) { f.atk = E.pick(f.moves); f.atk.start(); f.look.kick(-4); f.t = 1.4; P.glints(...f.look.head(), 2, '#ffe070', 3); }
        const ph = f.atk.update(dt); if (ph === 'active') A.sfx('swing', { pitch: .75 });
        if (ph === 'recover' && f.atk.spec.name === 'twohand') { const [x, y] = f.look.hand(); P.dust(x, y, 0, 10); game.shake(2); A.sfx('stomp'); }   // the slam lands
        f.atk.hits([h], t => E.inArc(f, f.face, t, 21, 1.3), () => hurtHero(f.face));
      } else if (on) {   // mage: sidesteps, AIMS (the cast's end pose backwards), CASTS (a ring grows), fires as the staff points
        const c = f.atk; f.face = Math.atan2(dy, dx);
        if (c.update(dt) === 'recover') { const [x, y, z] = f.look.hand(), [vx, vy] = E.pattern.aim({ x, y }, h, 100); shots.fire({ x, y, z, vx, vy, r: 3, team: 'foe', color: '#e060ff', core: '#ffe8ff' }); P.glints(x, y, z, 5, '#ff80e0', 8); P.glints(f.x, f.y, 2, 10, '#ff80e0', 14); A.sfx('laser', { pitch: .8 }); }
        f.aim = !c.busy && f.t < .6 && E.move('cast', Math.max(0, f.t / .6), 'recover');
        if (!c.busy && f.t <= 0) { c.start(); f.t = 2.4; A.sfx('charge', { pitch: 1.5, vol: .06 }); }
        if (c.busy || f.aim) f.vx = f.vy = 0;   // planted
        else { const s = Math.sin(game.time * .9 + f.x) > 0 ? 22 : -22; f.vx = -dy / dd * s; f.vy = dx / dd * s; }
      }
      if (!f.hang) f.update(dt, map); if (!f.fly) settle(f);
      const dead = f.dying > 0, air = !f.onGround && !f.fly;
      // Blob: squash, stretch, squash on landing; a woken bat drops, flips, unfurls; wings beat fast to rear, fold to dive; the dead flip belly-up
      if (f.look instanceof E.Blob) { if (f.landed) f.look.kick(dead ? -9 : -4);
        f.look.update(dt, { squash: dead ? -.4 : f.tell ? -.42 + shiver(.05) : air ? clamp(f.vz / 600, -.2, .25) : f.fly ? Math.sin(game.time * 14) * .06 : f.t < .12 ? -.18 : 0,
          look: [dx, dy], walk: air ? 1 : 0, squint: dead || f.stun > 0, hang: f.hang || f.wake < .15 || dead && f.dying < .55, flap: f.hang || dead ? 0 : clamp((f.wake - .15) * 2.5, 0, 1) * (f.swoop > .75 ? 1.6 : f.swoop > 0 ? 0 : 1) }); }
      else f.look.update(dt, { x: f.x, y: f.y, z: f.z, vx: f.vx, vy: f.vy, facing: f.face, hurt: f.stun > 0, attack: f.atk.state || f.aim || null,
        pose: dead ? 'die' : null, expr: f.kind === 'goblin' && 'angry' });   // death: stagger, the knees give, topple
      // contact on first touch (mid-pounce too; a diving bat where it meets him ON SCREEN, sooner from behind), then bounce off
      const behind = Math.max(0, dx * game.view.fx + dy * game.view.fy), reach = f.fly ? (f.swoop > 0 && f.swoop < .75 ? 10 + behind * .65 : f.z < 9 ? 10 : 0) : f.r + h.r;
      if (on && !dead && f.kind !== 'goblin' && dd < reach && hurtHero(Math.atan2(dy, dx))) { f.vx = f.vy = f.swoop = 0; E.knockback(h, f, 90); }
    }
    shots.update(dt, map); shots.hit([h], b => hurtHero(Math.atan2(b.vy, b.vx)), 'foe');
    for (const c of pets) {   // the cat strolls and dozes
      if ((c.t -= dt) <= 0) { const a = E.dist(c, c.home) > 18 ? E.angleTo(c, c.home) : E.rand(0, TAU), go = E.chance(.6); c.t = go ? 1.2 : E.rand(2, 4); const v = go ? 22 : 0; c.vx = Math.cos(a) * v; c.vy = Math.sin(a) * v; }
      c.update(dt, map); settle(c); const walk = Math.min(1, Math.hypot(c.vx, c.vy) / 20);
      c.look.update(dt, { look: walk ? [c.vx, c.vy] : [h.x - c.x, h.y - c.y], walk, squint: !walk && E.dist(c, h) > 50, squash: walk ? 0 : .12 });
    }
    // ambient life: petals, fireflies, embers, smoke, fountain spray, river foam
    const rx = (room + Math.random()) * ROOM[0], ry = OY + E.rand(T, ROOM[1] - T);
    if (Math.random() < dt * 4) P.add(room === 0 ? { kind: 'bit', x: rx, y: ry, z: 50, vx: 14, vy: 5, vz: -9, g: 3, max: 5, color: E.pick(['#ffb0c8', '#fff0f4']) }
      : room === 1 ? { kind: 'ember', x: rx, y: ry, z: E.rand(6, 26), vx: E.rand(-5, 5), vy: E.rand(-5, 5), vz: 3, max: 2.5, color: '#d8ff6a' }
      : { kind: 'ember', x: rx, y: ry, z: 2, vz: 16, vx: E.rand(-4, 4), max: 2, color: '#ff8a3a' });
    for (const f of roofs) if (roomOf(f.x1) === room && Math.random() < dt * 2.5) P.smoke(f.x1 - 12, f.y0 + 14, f.h + 16, 1, { size: 2.2, color: '#e4e2ee', dark: '#b0acc0', light: '#ffffff' });
    for (const t of things) if (t.tag === 'fountain' && t.room === room && Math.random() < dt * 14) P.add({ kind: 'bit', x: t.x, y: t.y, z: 22, vx: E.rand(-15, 15), vy: E.rand(-6, 6), vz: 40, g: 260, max: .5, color: E.pick(['#ffffff', '#a8e0ff']) });
    if (room === 0 && Math.random() < dt * 6) P.add({ kind: 'bit', x: E.rand(11.3, 12.7) * T, y: OY + E.pick([2, 8]) * T + E.rand(0, 46), z: 0, vy: 26, max: 1.2, color: '#d8f0ff' });
    poseHero(dt); game.focus(h.x, h.y, 10);
    const rooms = game.settings.advCamera !== 'scroll' && game.zoom <= 1 && !game.yaw;   // zoomed or turned: it follows the hero
    game.cam.room = rooms ? ROOM : null; game.cam.smooth = rooms ? .18 : .12;
  }

  /* ---- DRAWING ---- */
  // POOF: five crisp puffs, aged by game.time (hit-stop holds it)
  const poof = (x, y, z, s) => fx.push({ x, y, z: z + 4 * s, s, t: game.time, life: .5 });
  function drawFx(r) {
    E.prune(fx, f => game.time - f.t > f.life);
    for (const f of fx) r.queue(f.x, f.y, f.z, g => {
      const u = (game.time - f.t) / f.life, [x, y] = r.w(f.x, f.y, f.z), R = f.s * (u < .25 ? 3 + u * 16 : 7 - (u - .25) * 6);
      for (const [c, k, o, d] of [['#4a3a5a', .62, 1, 0], ['#ffffff', .62, 0, 0], ['#d8d0ec', .32, 0, 1.5]])
        for (const [dx, dy] of [[0, 0], [-1, -.6], [1, -.6], [-.7, .5], [.7, .5]]) px.disc(g, x + dx * R * .8 + d, y + dy * R * .6 - u * 6 + d, R * k + o, c);
    }, { bias: .6 });
  }
  // BUSHES of LEAF CLUMPS, no two alike: one outline around the mass, a body and lit top per clump, leaf dots, blossoms
  function bush(g, x, y, s, C, k) {
    const H = i => E.hash2(k, i), n = 4 + Math.floor(H(0) * 4), cl = [];
    for (let i = 0; i < n; i++) { const a = H(i + 9) - .5, b = H(i + 19); cl.push([x + a * (8 + H(1) * 12) * s, y - (3 + b * 4 + (.5 - Math.abs(a)) * 8) * s, (3 + b * 2) * s]); }
    for (const [X, Y, R] of cl) px.disc(g, X, Y, R + 1, C[0]);
    for (const [X, Y, R] of cl) { px.disc(g, X, Y, R, C[1]); px.disc(g, X - R * .3, Y - R * .35, R * .6, C[2]); }
    for (let i = 0; i < n * 3; i++) { const [X, Y, R] = cl[i % n]; px.dot(g, X + (H(i + 29) - .6) * R * 1.5, Y + (H(i + 59) - .7) * R * 1.4, H(2) < .3 && i % 3 < 1 ? '#ffc8dc' : C[3 + i % 2]); }
  }
  // PITCHED ROOF: a shaded back half and a ridge cap read as two slopes; an eave lip and shadow; a chimney of r.box
  function roof(r, f) {
    const P = r.w.bind(r), m = (f.y0 + f.y1) / 2 - 1, z = f.h + .3, C = f.C, band = (x0, x1, y0, y1, z0, z1) => [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z1), P(x0, y1, z1)];
    r.queue(f.x1 - 1, f.y1 - 1, f.h, g => {
      px.blend(g, .32, 'multiply', () => px.poly(g, band(f.x0, f.x1, f.y0, m, z, z), '#4a3a7a'));
      px.blend(g, .4, 'multiply', () => px.poly(g, band(f.x0, f.x1, f.y1 + .1, f.y1 + .1, f.h - 2, f.h - 7), '#3a2a5a'));
      px.poly(g, band(f.x0 - 1.5, f.x1 + 1.5, f.y1 - 1, f.y1 + 1.5, z, f.h - 1.5), C[0]);   // eave lip
      px.poly(g, band(f.x0 - 1, f.x1 + 1, m - 1.5, m + 1.5, z + .8, z + .8), C[1]);   // ridge cap
      px.line(g, ...P(f.x0 - 1, m - 1.5, z + .8), ...P(f.x1 + 1, m - 1.5, z + .8), C[4]);
      const cx = f.x1 - 12, cy = f.y0 + 14;
      r.box(g, cx - 3, cy - 3, f.h - 4, cx + 3, cy + 3, f.h + 11, '#6a3430', '#b05a48');
      r.box(g, cx - 4, cy - 4, f.h + 10, cx + 4, cy + 4, f.h + 12, '#b8a8a0', '#6a5a60');
      r.box(g, cx - 1.5, cy - 2, f.h + 12, cx + 1.5, cy + 1, f.h + 12.3, '#2a1c20', '#2a1c20');
    }, { bias: .01 });
  }
  // LIGHT SHAFTS: tinted beams, a stepped FALLOFF (three additive layers), drifting motes; none in topdown
  function shafts(r, room) {
    const [xs, c, lean] = BEAMS[room], t = game.real;
    if (r.view.pitchDeg < 70) r.overlay(g => { for (const bx of xs) {
      const [x, y] = r.w(room * ROOM[0] + bx, OY + 12, 40), w = 5 + Math.sin(t * .5 + bx) * 1.5, L = 120;
      px.blend(g, 1 / 8, 'add', () => { for (const k of [1, .6, .3]) { const X = x + lean * k, Y = y + L * k, s = w * (1 + k); px.poly(g, [[x - w, y], [x + w, y], [X + s, Y], [X - s, Y]], c); } });
      px.blend(g, 1, 'add', () => { for (let i = 0; i < 6; i++) { const u = (i * .17 + t * .025 + bx * .01) % 1; px.dot(g, x + lean * u + Math.sin(t * .7 + i * 2) * w, y + L * u, c); } });
    } });
  }
  function draw(r) {
    const view = E.charView(r.view), h = hero, room = roomOf(h.x), bob = Math.sin(game.time * 4) * 1.5;   // view: rigs get a sprite-like angle
    bg.draw(r); map.drawFloor(r); map.queueWalls(r);
    for (const b of [h, ...npcs, ...foes, ...pets]) if (!b.dead) shadow(r, b.x, b.y, (b.look instanceof E.Blob ? 5 : 6) - Math.min(2.5, (b.z || 0) * .12));
    for (const f of roofs) roof(r, f);
    for (const t of things) {
      if (t.dead || t.hidden) continue; const y = t.face ? t.y + T / 2 + 1 : t.y, z = t.face ? t.z || 0 : map.heightAt(t.x, t.y);
      if (t.r && !t.shape) shadow(r, t.x, t.y + 1, t.r);   // (a shape casts its own)
      if (t.prop === 'bush') r.queue(t.x, t.y, z, g => { const [X, Y] = r.w(t.x, t.y, z), k = Math.floor(t.x * 3 + t.y);
        bush(g, Math.round(X), Math.round(Y), t.size || 1, t.C || (t.C = E.ramp(t.color || ['#4a9a4a', '#3a8a52', '#5a9a3a'][k % 3], 5, 1.2)), k); });
      else if (t.shape) r.shape(t.shape, t.x, y, z, { scale: t.size, facing: E.hash2(t.x, t.y) * E.TAU });   // each turned its own way
      else r.prop(t.prop, t.x, y, z, { ...t, light: false });   // its fields style the prop
      // GPU lights in the hero's room only; wall lights cast shadows
      if (t.light && t.room === room) L.add(t.x, y + (t.prop === 'window' ? 30 : 0), z + 14, t.face ? 90 : 60, .9, { color: t.light, shadow: t.face });
    }
    for (const it of items) if (!it.got) {
      if (it.kind === 'relic') { r.sprite(it.x, it.y, 18 + bob, CRYSTALS[0], { glow: .5 }); if (Math.random() < .08) P.glints(it.x, it.y, 22, 1, '#bff8ff', 14); }
      else { shadow(r, it.x, it.y, 3); r.sprite(it.x, it.y, 3 + bob, it.kind === 'gem' ? GEM : HEART, { glow: .5 }); }
    }
    for (const b of [...npcs, ...pets]) r.actor(b.x, b.y, b.z || 0, (g, ox, oy) => (b.rig || b.look).draw(g, ox, oy, view), { every: 2, key: b });   // townsfolk animate every other frame (a phone's frame time goes to the hero and foes)
    for (const f of foes) if (!f.dead) {   // tells shiver (a goblin's builds); dying foes blink before the poof
      const c = f.atk, tell = f.tell ? .7 : f.kind === 'goblin' && c.phase === 'wind' ? .3 + c.u * 1.5 : 0;
      r.actor(f.x + shiver(tell), f.y, f.z, (g, ox, oy) => f.look.draw(g, ox, oy, view), { flash: f.flash > 0 || f.dying > 0 && f.dying < .4 && Math.floor(game.time * 16) % 2 });
      if (f.kind === 'goblin') f.look.drawSmear(r, ['#ffffff', '#fff0d0', '#ffc890', '#e08048']);
      // the mage's rune ring grows through the wind-up and BURSTS outward as the bolt leaves
      const R = f.kind !== 'mage' ? 0 : c.phase === 'wind' ? 4 + c.u * 8 : c.phase === 'active' ? 12 : c.phase && c.u < .3 ? 12 + c.u * 40 : 0;
      if (R) r.decal(() => r.groundRing(f.x, f.y, R, R > 12 ? '#ffe8ff' : '#ff70d8'), { emissive: 1 });
      const age = game.time - f.hitT, top = (f.look.head ? f.look.head()[2] + 8 : f.z + 20) + 8 * Math.sqrt(age);   // the damage number rides its foe
      if (age < .8) r.queue(f.x, f.y, top, g => { const [x, y] = r.w(f.x, f.y, top); txt(g, String(f.dmg), x, y, '#fff2c4', { align: 'center' }); }, { bias: 2 });
    }
    // the HERO: the sword trail sorts in front, so while the blade is behind him (or spinning) bias draws him over it
    const st = h.sw.state, [tx, ty] = h.rig.tip(), over = st && (st.spec.spin || (tx - h.x) * r.view.fx + (ty - h.y) * r.view.fy < 0);
    if (h.hp > 0 && !(h.inv > 0 && h.hurt <= 0 && Math.floor(game.real * 15) % 2)) {
      r.actor(h.x + shiver(h.charge * .6), h.y, h.z, (g, ox, oy) => {
        h.rig.draw(g, ox, oy, view);
        if (held && held.t > 0) {   // the prize, placed through the character view
          const s = held.spr, q = view.p(0, 0, h.rig.head()[2] - h.z + 9 + bob * .5);
          px.glow(g, .35); px.sprite(g, s, Math.round(ox + q[0] - s.w / 2), Math.round(oy + q[1] - s.h));
        }
      }, { xray: true, flash: h.hurt > .15 || h.charge >= .6 && game.time % .3 < .05, bias: over ? 2 : 0 });
      h.rig.drawSmear(r);
    }
    shots.draw(r); drawFx(r); shafts(r, room); if (game.cam.room) curtain(r, room); hud(r); talk.draw(r);
  }
  // the CURTAIN: what the screen shows beyond the hero's room, dimmed a little (the room's box: its floor, its walls' height)
  function curtain(r, room) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const x of [room * ROOM[0], (room + 1) * ROOM[0]]) for (const y of [OY, OY + ROOM[1]]) for (const z of [0, 48]) { const [sx, sy] = r.w(x, y, z); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
    [x0, y0, x1, y1] = [x0, y0, x1, y1].map(Math.round);
    if (x0 <= 0 && y0 <= 0 && x1 >= r.W && y1 >= r.H) return;
    r.overlay(g => px.blend(g, .4, 'normal', () => { const D = '#0a0818'; px.rect(g, 0, 0, r.W, y0, D); px.rect(g, 0, y1, r.W, r.H - y1, D); px.rect(g, 0, y0, x0, y1 - y0, D); px.rect(g, x1, y0, r.W - x1, y1 - y0, D); }));
  }
  // HUD in the corners, over the world: the hero and his hearts top left; gems, keys and a map of the rooms top right
  // (clear of the corner's buttons); the CONTROLS (the player's own keys) bottom right, not on a touch screen (its buttons
  // say it); the area's name drops in under them as he enters
  function hud(r) {
    const npc = talkable(), R = Math.min(r.W, cornerX()) - 4;
    r.overlay(g => {
      E.ui.box(g, 4, 4, 84, 30, WIN); hero.rig.drawPortrait(g, 9, 9, 20, { zoom: 1.5, cape: false, bg: FACE_BG });
      txt(g, 'HERO', 36, 8, '#ffe08a', { gradient: ['#fff4c0', '#e8a040'] }); E.ui.hearts(g, 36, 19, hero.hp, hero.max);
      const GX = R - 70; E.ui.box(g, GX, 4, 70, 17, WIN); px.sprite(g, GEM, GX + 6, 9); px.sprite(g, KEYS[0], GX + 41, 10);
      txt(g, String(gems).padStart(3, '0'), GX + 14, 9, '#ffffff'); txt(g, 'x' + keys, GX + 50, 9, '#ffffff');
      minimap(g, GX, 24);
      if (won) {
        const wy = Math.round(r.H / 2) - 24;
        E.ui.box(g, r.W / 2 - 90, wy, 180, 48, WIN); E.font.title(g, 'MANA CRYSTAL!', r.W / 2, wy + 7, { align: 'center', scale: 2, colors: ['#ffffff', '#bff8ff', '#4ac8e8'], depth: 1 });
        return txt(g, 'Gems ' + gems + '    Best ' + best('adventure', gems), r.W / 2, wy + 34, '#ffe08a', { align: 'center' });
      }
      if (talk.open) return;
      if (!touch()) {
        const a = prompt('attack', 'Sword'), b = prompt('confirm', 'Talk'), w = E.font.width(a) + E.font.width(b) + 26, cx = r.W - w - 4, cy = r.H - 22;
        E.ui.box(g, cx, cy, w, 18, WIN); txt(g, a, cx + 8, cy + 5, '#d8d0f0');
        txt(g, b, cx + w - 8 - E.font.width(b), cy + 5, npc && Math.floor(game.real * 3) % 2 ? '#ffe08a' : '#d8d0f0');   // 'Talk' blinks near a villager
      }
      if (npc) {   // a speech bubble: you can talk
        const [fx, fy] = r.w(npc.x, npc.y, 0), q = E.charView(r.view).p(0, 0, 44), x = Math.round(fx + q[0]), y = Math.round(fy + q[1]);
        E.ui.box(g, x - 11, y - 14, 22, 12, WIN); px.poly(g, [[x - 4, y - 3], [x + 2, y - 3], [x - 3, y + 1]], WIN.border);
        for (let k = 0; k < 3; k++) px.rect(g, x - 6 + k * 5, y - 9 - (Math.floor(game.real * 3) % 3 === k ? 1 : 0), 2, 2, '#ffe08a');
      }
      if (area.t > 0) {   // the area's name drops in, then goes
        const w = E.font.width(AREAS[area.room]) + 20, y = Math.round(42 - (Math.max(0, area.t - 2.3) + Math.max(0, .3 - area.t)) * 120);
        E.ui.box(g, (r.W - w) / 2, y, w, 18, WIN); txt(g, AREAS[area.room], r.W / 2, y + 5, '#ffffff', { align: 'center' });
      }
    });
  }
  // a map of the three rooms, 70 x 12: the hero's lit, where he stands blinking
  function minimap(g, x, y) {
    const room = roomOf(hero.x), C = ['#4a9a4a', '#7a8a56', '#5a5486'], w = 22, h = 12;
    for (let i = 0; i < 3; i++) { px.rect(g, x + i * (w + 2), y, w, h, i === room ? '#fff4c0' : '#1a1838'); px.rect(g, x + i * (w + 2) + 1, y + 1, w - 2, h - 2, i === room ? C[i] : E.shade(C[i], -.45)); }
    if (Math.floor(game.real * 3) % 2) px.rect(g, x + Math.round(hero.x / ROOM[0] * (w + 2)) - 1, y + 1 + Math.round(clamp((hero.y - OY) / ROOM[1], 0, 1) * (h - 4)), 2, 2, '#ffffff');
  }
  return { view: 'threequarter', views: ['threequarter', 'topdown', 'iso'], input: 'DEFAULT', res: 'ps1', propSize: 1.25, pausable: true, touch: ['attack', 'confirm'], enter: start, update, draw,
    // the player zooms in to 2x, and out as far as the world round the rooms fills the screen: to .85x on a wide one, not
    // at all held upright (its forest is sized for 1x there). A TileMap scene rotates cleanly
    camera: { zoom: g => [g.upright ? 1 : .85, 2], rotate: true },
    state: () => ({ hero, foes, things, items, map, npcs, pets, talk }),   // for tests
    exit() { game.cam.room = null; game.cam.smooth = .18; if (gpu) gpu.enabled = false; L.enabled = false; } };
})();
scenes.adventure = ADV;
