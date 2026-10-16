/* =====================================================================================
 * SLICE 4  RPG BATTLE  (side-view battle: Final Fantasy VI / IX, Chrono Trigger, Legend of Mana)
 * Three heroes (right) face a Dread Knight, a Gargoyle and a Bomb (left) on a ruined plaza at sunset. Wait-mode
 * ATB: a full gauge opens that hero's commands (Attack, skill, Defend, Potion, Run) and a glove to aim; monsters act
 * when theirs fill. Win: defeat every monster. Lose: every hero falls (Run never works here).
 * Every fighter has its own moves from E.MOVES: Rowan leaps in with an overhead chop and spins to Cleave, Lyra flings
 * sparks and casts Fire, Sera jabs with her staff, then crosses and roundhouses, and raises it to Cure; the Dread Knight
 * slashes, bashes and swings a Doom Blade, the Gargoyle dives claws first or beats up a gale, the Bomb rams or spits.
 * ANY SCREEN: the backdrop is painted at the screen's size, its ground with the plaza's own grass and light so the plaza's
 * edge melts into it, a tall screen's sky darkening to the first stars; the HUD band sits on the bottom edge and the
 * battle in the space above it (layout()). A phone held upright comes in to 1.5x (camera.tall) and the two sides close up (TALL), so the
 * fighters are as big as a wide screen shows them. TOUCH, after mobile RPGs: the band is big buttons a thumb hits (pads(): the
 * commands and AUTO, the party fighting by itself; then the targets with their HP, and BACK), the party's cards above them on
 * a phone held upright, beside them on its side; a tap on a fighter targets it too. Keys and a pad: the FF command list.
 * ===================================================================================== */
const RPG = (() => {
  /* ---- BACKDROP: a sunset painted once per screen size and zoom in crisp pixel shapes like the sprites (a turn, and a
   * zoomed-in camera following the fight, move only the plaza). Drawn for 320 x 240 and moved: ox centres it, oy puts its
   * horizon where the plaza's far edge is; the hills keep their size at any zoom, as far things do when a camera comes in ---- */
  const SKY = ['#1c1642', '#40245f', '#8a3468', '#d4565c', '#f4935c', '#ffd08a'], skyAt = y => { const f = Math.min(y / 15, 4.99), i = f | 0; return E.mix(SKY[i], SKY[i + 1], f - i); };   // a stop every 15 rows
  const SX = 288, SY = 45, CLOUDS = [[44, 13, 60], [156, 19, 84], [246, 10, 52], [98, 33, 64], [206, 36, 74], [296, 51, 46], [22, 47, 52]];   // clouds: [x, y, width]
  const TOWERS = [[116, 9, 26, 12], [127, 15, 16, 0], [144, 8, 36, 15], [154, 13, 21, 0], [169, 7, 28, 11], [178, 12, 12, 0]];   // castle: [x, width, height, roof]
  // a range: one column per x, slopes facing the sun (right) lit
  const range = (g, base, amp, s, col, lit, x0, x1) => { const h = x => amp * (.5 + .32 * (1 - Math.abs(Math.sin(x * .017 + s))) + .18 * Math.sin(x * .061 + s * 3)); for (let x = x0; x < x1; x++) px.rect(g, x, base - h(x), 1, 40, h(x + 1) < h(x - 1) ? lit : col); };
  function paintBackdrop(W, H, fy, cx, Z) {   // fy: where the camera's focus sits on screen (layout); cx, Z: the camera at rest
    const v = E.VIEWS.brawler, c = E.mkCanvas(W, H), g = E.ctx2d(c), ox = Math.round((W - 320) / 2), oy = fy - 74 - Math.round(72 * v.by * Z), sx = SX + ox, sy = SY + oy;
    // the ground from the row the plaza's far edge is on: the plaza's grass and light at the world point under each pixel (the
    // camera at rest). Laid last, over the hills' feet, so the horizon is one line on both sides of the plaza
    const im = g.createImageData(W, H), d = im.data, gy = Math.max(0, Math.round(fy - 72 * v.by * Z));
    for (let y = gy; y < H; y++) for (let x = 0; x < W; x++) {
      const wx = cx + (x - W / 2) / (v.ax * Z), wy = 72 + (y - fy) / (v.by * Z), warm = clamp(.5 + (wx - PLAZA[0]) / 260 - (wy - PLAZA[1]) / 200, 0, 1), haze = clamp(1 - wy / 70, 0, 1) * .45, k = 1.08 - clamp(wy - 70, 0, 110) / 400;
      const q = E.tex.grass(wx, wy, GRASS), o = (y * W + x) * 4; for (let i = 0; i < 3; i++) d[o + i] = lerp(lerp(q[i] * k, lerp(COOL[i], WARM[i], warm), .28), HAZE[i], haze); d[o + 3] = 255;
    }
    for (let y = 0; y < 100 + oy; y++) {   // sky rows (above the painting, a tall screen's: night coming), a smooth sun glow (no bands, no dither)
      const s = y < oy ? E.mix('#07061a', SKY[0], clamp(1 - (oy - y) / 170, 0, 1)) : skyAt(y - oy); px.rect(g, 0, y, W, 1, s);
      if (y < oy + 24) for (let x = 0; x < W; x++) { const h = E.hash2(x * 3 + 1, y * 5 + 2); if (h > .9965 - clamp((oy - y) / 4000, 0, .004)) px.dot(g, x, y, h > .9993 ? '#ffffff' : E.mix(s, '#fff0d8', .6)); }   // the first stars
      for (let x = Math.max(0, sx - 100); x < Math.min(W, sx + 100); x++) { const k = 1 - Math.hypot((x - sx) / 2.6, y - sy) / 36; if (k > 0) px.dot(g, x, y, E.mix(s, '#ffe8b8', k * k * .85)); }
    }
    g.translate(ox, oy);   // the rest is drawn as for 320 x 240, the far hills and trees running on across a wide screen
    const x0 = -ox - 4, x1 = W - ox + 6;
    px.disc(g, SX, SY, 12, '#fff0c0'); px.disc(g, SX - 1, SY - 1, 10, '#fffcec');   // a hard-edged sun
    for (const [cx, y, w] of CLOUDS) for (let x = cx - 320 * Math.ceil(ox / 320); x < x1 + w; x += 320) {   // flat-bottomed puffs lit from below, warmer near the horizon
      const k = clamp(y / 50, 0, 1), body = E.mix('#4a2a62', '#b4587a', k), lit = E.mix('#9a4a78', '#f09a88', k);
      for (const [dx, dy, rx, col] of [[0, 0, .5, body], [-.14, -2.5, .24, body], [.16, -1.5, .2, body], [.04, 1.5, .42, lit]]) px.ell(g, x + dx * w, y + dy, rx * w, 2.8, col);
      px.rect(g, x - w * .34, y + 3, w * .68, 1, E.mix('#e0808a', '#fff0c0', k));
    }
    range(g, 66, 20, 1, '#c47c90', '#eaa4a0', x0, x1);   // the far range, pale with haze
    for (const [x, w, h, roof] of TOWERS) {   // a hazy castle
      const top = 76 - h;
      px.rect(g, x, top, w, h, '#74446e'); px.rect(g, x + w - 2, top, 2, h, '#e8908e'); px.rect(g, x + (w >> 1), top + 5, 1, 2, '#ffd27a');
      if (roof) { px.poly(g, [[x - 1, top], [x + w + 1, top], [x + w / 2, top - roof]], '#5c3462'); px.poly(g, [[x + w / 2, top], [x + w + 1, top], [x + w / 2, top - roof]], '#c87282'); }
      else for (let bx = x; bx < x + w; bx += 3) px.rect(g, bx, top - 2, 2, 2, '#74446e');
    }
    px.blend(g, .3, 'normal', () => px.rect(g, 96, 66, 110, 10, '#ffc0a0'));   // mist at the castle's foot
    range(g, 77, 9, 5, '#8a4a74', '#c06a7c', x0, x1);   // near hills in front of it
    for (let x = x0 - ((x0 - 1) % 5 + 5) % 5; x < x1; x += 5) { const r = 4 + 3 * E.noise2(x * .09, 3), y = 79 - r * .7; px.disc(g, x + 1, y - 1, r, '#b25c5e'); px.disc(g, x, y, r, '#2e2040'); }   // treeline, rim-lit
    g.putImageData(im, 0, 0, 0, gy, W, H - gy); return c;   // the ground over its foot
  }
  // where things go on this screen: the HUD band's top (Y: on the bottom edge, a little higher on a phone, off its home
  // bar), the camera focus's height on screen (fy: the battle just above the band, or on a tall screen 3/5 down the sky,
  // a phone held upright's a little lower: its fight is bigger)
  const layout = (W, H) => { const Y = game.input.lastDevice === 'touch' ? pads(W, H).Y : H - 73; return { Y, fy: Math.round(Math.min(Y - 47, 40 + (Y - 40) * (game.upright ? .66 : .6))) }; };
  // TOUCH: a 3 x 2 grid of buttons 38 px tall (44 CSS px and more on a phone, an iPhone SE's too: a thumb), the party's 214 px of cards above it
  // on a tall screen (the grid as wide as the screen), beside it on a wide one; 8 px off a phone's home bar. cell(i): pad i's box
  const pads = (W, H) => {
    const tall = W < 440, ch = 38, gap = 4, gh = ch * 2 + gap, cw0 = 214, gw = tall ? Math.min(W - 8, 312) : Math.min(W - cw0 - 14, 300);
    const Y = H - (tall ? 66 + gap + gh : Math.max(66, gh)) - 8, x0 = Math.round(tall ? (W - gw) / 2 : (W - gw - 6 - cw0) / 2), gy = tall ? Y + 66 + gap : Y, cw = Math.floor((gw - gap * 2) / 3);
    return { Y, cards: tall ? Math.round((W - cw0) / 2) : x0 + gw + 6, cell: i => ({ x: x0 + (i % 3) * (cw + gap), y: gy + Math.floor(i / 3) * (ch + gap), w: cw, h: ch }) };
  };
  let backdrop = null;   // painted on the first draw, again for a new screen size or zoom
  // the camera at rest: on a phone held upright (game.upright) it comes in to 1.5x and the sides close up toward x 119 (spread),
  // so the fight fills the narrow screen's width, each rank opening out in depth from y 84 (deep) so nobody hides behind
  // the one in front; x: where it looks
  const TALL = { zoom: 1.5, spread: .6, deep: 1.25, x: 111 }, WIDE = { zoom: 1, spread: 1, deep: 1, x: 110 }, rest = () => game.upright ? TALL : WIDE;

  /* ---- FLOOR: a round cobbled plaza (a ground circle projects to a wide ellipse: reads as floor). floorTex runs
   * once per pixel when the floor is baked, so light, shadows and wear cost nothing per frame ---- */
  const PLAZA = [110, 98], STONES = ['#ac969c', '#978290', '#baa4a6', '#8a7688', '#a48c86'].map(E.hex), MORTAR = E.hex('#48364a'), MOSS = E.hex('#586e3a');
  const GRASS = { base: '#5e7c3c', dark: '#41602f', light: '#7c9a4a', flower: '#ffd6e4' }, WARM = E.hex('#ffb070'), COOL = E.hex('#40347a'), HAZE = E.hex('#eea08a');
  const SUN = [.8, -.6];   // toward the low sun
  const CASTERS = [[100, 8, 30, 3], [132, 6, 30, 3], [220, 20, 84, 9], [196, 28, 24, 6], [212, 58, 20, 3], [24, 14, 44, 12], [212, 8, 40, 5]];   // [x, y, length, width] of long shadows
  const cobble = (x, y) => {   // Voronoi cobbles: the nearest jittered cell center owns a pixel
    let d1 = 99, d2 = 99, id = 0, lit = 0; const gx = Math.floor(x / 13), gy = Math.floor(y / 10);
    for (let j = -1; j < 2; j++) for (let i = -1; i < 2; i++) {
      const cx = (gx + i + E.hash2(gx + i, gy + j)) * 13, cy = (gy + j + E.hash2(gy + j, gx + i + 7)) * 10, d = Math.hypot(x - cx, (y - cy) * 1.2);
      if (d < d1) { d2 = d1; d1 = d; id = E.hash2(cx, cy); lit = ((x - cx) * SUN[0] + (y - cy) * SUN[1]) / (d + 1); } else if (d < d2) d2 = d;
    }
    return [d2 - d1, id, lit];   // joint distance, stone id, -1..1 facing the sun
  };
  const floorTex = (x, y) => {
    const dx = x - PLAZA[0], dy = y - PLAZA[1], d = Math.hypot(dx, dy) + E.noise2(x * .06, y * .06) * 5, wild = E.noise2(x * .05, y * .08) + d / 120, [gap, id, lit] = cobble(x, y);
    let c;
    if (d > 100 || wild > 1.3 || id < .04) c = E.tex.grass(x, y, GRASS);                                                      // grass around the plaza and where stones are gone
    else if (d < 17) c = E.hex(d < 5 + 8 * Math.abs(Math.cos(Math.atan2(dy, dx) * 4)) ? '#d8b868' : d > 14 ? '#c8a860' : '#5e5070');   // a golden star inlaid at the center
    else if (gap < 1.3 || Math.abs(d - 19) < 1.1 || Math.abs(d - 96) < 1.1) c = wild > .95 ? MOSS : MORTAR;                         // joints (mossy toward the rim) and two curb rings
    else c = STONES[id * 5 | 0].map(v => v * (gap < 3.2 ? 1 + lit * .24 : 1 - E.hash2(x | 0, y | 0) * .06) * (wild > .9 ? .9 : 1));   // bevels lit on the sun side, grain, worn stones
    const shade = CASTERS.some(([sx, sy, len, w]) => { const vx = x - sx, vy = y - sy, a = -(vx * SUN[0] + vy * SUN[1]); return a > 0 && a < len && Math.abs(vx * SUN[1] - vy * SUN[0]) < w * (1 - a / len * .5); });
    const warm = clamp(.5 + dx / 260 - dy / 200, 0, 1), haze = clamp(1 - y / 70, 0, 1) * .45, k = (1.08 - clamp(y - 70, 0, 110) / 400) * (shade ? .66 : 1);
    return c.map((v, i) => lerp(lerp(v * k, shade ? COOL[i] : lerp(COOL[i], WARM[i], warm), shade ? .3 : .28), HAZE[i], haze));   // warm toward the sun, cool shadows, hazy far edge
  };
  // broken wall stubs at the back left
  const WALL = { top: '#8a9a5a', side: '#7a6478', line: '#4a3848', face: 'ruin', roof: 'grass' };   // face: a MATERIAL (stones, cracks, moss, dirt; docs/ASSETS.md)
  const plaza = new E.TileMap({ rows: ['21............', ...Array(11).fill('..............')], legend: { 1: 1, 2: 2 }, types: { 1: { ...WALL, h: 12 }, 2: { ...WALL, h: 24 } }, floorTex });
  // [prop, x, y, z, options]: pillars frame the sides; braziers stand clear of the fighters (a dimmed scene lights their glow)
  const PROPS = [['vines', 26, 17, 12, { anchor: 'top', size: .5 }], ['pillar', 8, 46, 0], ['vines', 9, 47, 44, { anchor: 'top' }], ['pillar', 212, 8, 0, { broken: true }],
    ['brazier', 100, 8, 0, { haloR: 16 }], ['brazier', 132, 6, 0, { haloR: 16 }],
    ['bush', 22, 26, 0, { color: '#4a7a3a' }], ['bush', 196, 28, 0, { color: '#4a7a3a', berries: '#e04a6a' }],
    ['mushroom', 18, 60, 0, { size: .7, color: '#c8603a' }], ['mushroom', 206, 42, 0, { size: .5, color: '#c8a0e8' }],
    ['skull', 34, 150, 0], ['bones', 128, 150, 0], ['grass', 150, 146, 0], ['flowers', 16, 110, 0, { color: '#b08aff' }]];
  // [shape, x, y, options]: SHAPES (docs/ASSETS.md) are objects as data, right in every view and turn: the trees grow from
  // a generator's params, the mats recolor a slot ('#hex pattern', or any material id)
  const SHAPES = [['tree', -2, 22, { params: { h: 46, seed: 3 }, mats: { l: '#3e6a3a foliage size=3' } }], ['pine', 220, 20, { scale: 1.1, mats: { l: '#2e5a44 foliage size=3' } }],
    ['rock', 10, 140, { facing: 1 }], ['crystal', 212, 58, { params: { h: 14 } }], ['barrel', 146, 14, { scale: .8, facing: 2 }], ['crate', 158, 4, { scale: .7, facing: .3 }],
    // a broken column from the asset store, cut into the page's 'rpg' set (src/assets/sets/rpg.js; none without it)
    ...(E.addAssets((window.ASSETS || {}).rpg || { set: 'rpg' }).shapes.length ? [['rpg:statue-column-damaged', 190, 8, { scale: 1.15, facing: 1.3, mats: { a: '#9a9282 speck' } }]] : [])];

  /* ---- MONSTERS: extras painted inside the same r.actor get the engine's outline, rim light and hit flash.
   * (x, y) = the feet on screen, v = the view ---- */
  // a shaded volume: dark body, lit core, highlight, spec
  const ball = (g, x, y, rx, ry, c) => { const t = E.tones(c); px.ell(g, x, y, rx, ry, t.sh); px.ell(g, x - rx * .15, y - ry * .18, rx * .78, ry * .74, t.base); px.ell(g, x - rx * .38, y - ry * .42, rx * .32, ry * .26, t.lt); px.dot(g, x - rx * .45, y - ry * .55, t.hi); };
  // a flame tongue: red, orange, white-hot layers
  const flame = (g, x, y, w, h, k) => { const s = Math.sin(k) * w * .6; for (const [f, c] of [[1, '#d8381a'], [.66, '#ffa030'], [.34, '#fff2b0']]) px.poly(g, [[x - w * f, y], [x - w * f * .8 + s * .3, y - h * f * .45], [x + s * f, y - h * f], [x + w * f * .7 + s * .5, y - h * f * .5], [x + w * f, y]], c); };
  function gargoyle(g, x, y, f) {   // all paint, in side profile, perched on the ruin; f = wing beat -1..1
    const S = '#7a7090', st = E.tones(S), bone = '#e8dcc8';
    const wing = (dx, col, k) => {   // bat wing: arm and finger bones, membrane panels
      const w = E.tones(col), e = [x - 6 + dx, y - 36 - f * 5 * k], T = [[x - 32 + dx, y - 36 + f * 6 * k], [x - 36 + dx, y - 19 + f * 5 * k], [x - 25 + dx, y - 8 + f * 3 * k]];
      px.poly(g, [e, T[0], [x - 25 + dx, y - 27 + f * 5 * k], T[1]], w.base); px.poly(g, [e, T[1], [x - 23 + dx, y - 16 + f * 4 * k], T[2]], w.sh); px.poly(g, [[x + dx, y - 22], e, T[2], [x - 4 + dx, y - 12]], w.deep);   // panels darken toward the body
      for (const p of T) px.line(g, e[0], e[1], p[0], p[1], w.lt); px.line(g, x + dx, y - 22, e[0], e[1], w.hi, 2); px.dot(g, e[0], e[1] - 1, bone);   // finger bones, arm, thumb claw
    };
    wing(9, '#4a3c64', .8);                                                                                   // far wing, darker
    px.line(g, x - 6, y - 4, x - 17, y + 1, st.sh, 2); px.poly(g, [[x - 17, y - 2], [x - 22, y + 3], [x - 15, y + 5]], st.sh);   // tail with a spade tip
    ball(g, x - 1, y - 4, 5, 4, S); px.line(g, x + 1, y - 1, x + 3, y + 3, st.sh, 2); for (const d of [0, 2, 4]) px.dot(g, x + 1 + d, y + 4, bone);   // haunch, shin, talons
    ball(g, x + 2, y - 14, 7, 9, S); for (const d of [0, 3, 6]) px.rect(g, x + 4, y - 16 + d, 4, 1, st.lt);   // torso and belly plates
    wing(0, '#6a5884', 1);                                                                                    // near wing
    ball(g, x + 9, y - 26, 6, 5, S); px.ell(g, x + 14, y - 23, 3, 2, st.base);                                // head and snout
    px.poly(g, [[x + 5, y - 29], [x - 4, y - 39], [x + 2, y - 30]], bone); px.poly(g, [[x + 9, y - 30], [x + 6, y - 41], [x + 11, y - 31]], '#d0c4b0');   // horns
    px.line(g, x + 8, y - 29, x + 13, y - 28, st.deep); px.rect(g, x + 10, y - 27, 3, 1, '#ffe040'); px.dot(g, x + 12, y - 27, '#ff3020');   // brow ridge over a glowing eye
    px.line(g, x + 11, y - 21, x + 16, y - 22, '#2a1020'); px.dot(g, x + 13, y - 20, '#ffffff'); px.dot(g, x + 15, y - 21, '#ffffff');   // fanged mouth
    px.line(g, x + 6, y - 16, x + 13, y - 12, st.base, 2); for (const d of [-1, 1, 3]) px.line(g, x + 13, y - 12, x + 16, y - 12 + d, bone);   // arm and claws
  }
  // each of 9 wing-beat steps is painted once and reused, tilted around the torso (c.tilt: leaning into a dive, a tumble).
  // The wind-up holds the wings high, the strike beats them down. r.actor tracks the area of plain draws only, so the tilt
  // happens on a scratch canvas first
  const GARG = [], TILT = E.ctx2d(E.mkCanvas(104, 104)), gargoyleCached = (g, x, y, c, v) => {
    const k = Math.round(lerp(Math.sin(c.flapT * 7), Math.sign(c.coil), Math.min(1, Math.abs(c.coil) * 1.5)) * 4) + 4; if (!GARG[k]) gargoyle(E.ctx2d(GARG[k] = E.mkCanvas(64, 54)), 42, 47, k / 4 - 1);
    TILT.setTransform(1, 0, 0, 1, 0, 0); TILT.clearRect(0, 0, 104, 104); TILT.translate(52, 52); TILT.rotate(c.tilt); TILT.drawImage(GARG[k], -42, -27);
    const z = v.scale / E.VIEWS.brawler.scale;   // zoomed in (a phone held upright: 1.5x), it grows as the painted fighters do, pixels kept square
    if (z === 1) g.drawImage(TILT.canvas, x - 52, y - 72); else g.drawImage(TILT.canvas, Math.round(x - 52 * z), Math.round(y - 72 * z), Math.round(104 * z), Math.round(104 * z));
  };
  // a Blob's body center (pixels above its feet) and radius
  const blobAt = (c, v) => { const b = c.body, R = b.o.R * b.scale; return [v.p(0, 0, R * (1 + b.sq))[1], R * v.scale]; };
  // the Bomb: flames behind the body, tallest on top...
  const bombBack = (g, x, y, c, v, t) => {
    const [cy, R] = blobAt(c, v);
    for (let i = 0; i < 9; i++) { const a = -3.5 + i * .4, up = Math.max(0, -Math.sin(a)); flame(g, x + Math.cos(a) * R * .8, y + cy + Math.sin(a) * R * .75 + 3, 3 + up * 2, 6 + up * up * 13 + 3 * Math.sin(t * 13 + i * 2), t * 11 + i); }
  };
  // ...and a hot core and a toothy grin in front
  const bombFront = (g, x, y, c, v) => {
    const [cy, R] = blobAt(c, v), mx = x + R * .22, my = y + cy + R * .3;
    px.ell(g, x - R * .2, y + cy + R * .6, R * .38, R * .18, '#ffc050'); px.poly(g, [[mx - R * .55, my], [mx + R * .55, my], [mx + R * .3, my + R * .42], [mx - R * .3, my + R * .42]], '#4a0a0a');
    for (const d of [-.32, 0, .32]) px.poly(g, [[mx + (d - .1) * R, my], [mx + (d + .1) * R, my], [mx + d * R, my + R * .22]], '#ffffff');
  };
  // a rig joint on screen: rig.worldOffset gives where a point in the rig's frame sits, v.p projects it
  const joint = (c, v, x, y, k, f = 0, s = 0, z = 0) => { const J = c.rig.J[k], w = c.rig.worldOffset([J[0] + f, J[1] + s, J[2] + z]), q = v.p(w[0], w[1], w[2]); return [x + q[0], y + q[1]]; };
  // the Dread Knight's plate: knee cops, shins, horns, a faceplate
  function knightPlate(g, x, y, c, v) {
    const m = E.tones('#b4bed8'), P = (k, f, s, z) => joint(c, v, x, y, k, f, s, z), r = c.rig.o.headR * c.rig.o.size * v.scale;
    for (const s of 'LR') { const [kx, ky] = P('knee' + s, .9), [ax, ay] = P('foot' + s, .4, 0, 2); px.line(g, kx, ky + 2, ax, ay, m.sh, 2); px.line(g, kx - 1, ky + 2, ax - 1, ay, m.lt); px.disc(g, kx, ky, 3.5, m.deep); px.disc(g, kx - .5, ky - .5, 2.6, m.base); px.dot(g, kx - 1, ky - 1, m.hi); }
    const [hx, hy] = P('head', 0, 0, 2.6), [fx, fy] = P('head', 2.3, 0, -.3);
    for (const s of [-1, 1]) { const [bx, by] = P('head', 0, s * 2.4, 1.6), [mx, my] = P('head', -.5, s * 5.4, 2.8), [tx, ty] = P('head', 1, s * 6, 6); px.poly(g, [[bx - 3, by + 1], [mx - 1, my - 1], [tx, ty], [mx + 1, my + 2], [bx + 3, by]], s < 0 ? '#a89c88' : '#e8dcc8'); }
    px.line(g, hx - r * .5, hy + 1, hx + r * .3, hy, m.hi);                                                               // light on the helm's crown
    px.disc(g, fx, fy, r * .55, m.sh); px.disc(g, fx - .5, fy - .5, r * .45, m.base); px.rect(g, fx - r * .5, fy - 2, r, 3, '#12060c');   // faceplate, eye slit,
    px.rect(g, fx - 1, fy - 1, 4, 1, '#ff5030'); px.dot(g, fx + 1, fy - 1, '#ffd0a0'); for (const d of [0, 2, 4]) px.dot(g, fx + d - 2, fy + 4, '#12060c');   // a red glare, breath holes
  }

  /* ---- CAST. Heroes face left, turned to the camera (turn). Builds (tuned by shoulderHalf, limbW, hunch...), hair,
   * hats and eyes differ. Robes need pants in the robe color, or the dark default shows through as holes.
   * attack and skill name MOVES below: no two heroes share a swing ---- */
  const PARTY = [
    { name: 'Rowan', hp: 96, mp: 16, atk: 14, spd: .45, atb: 1, attack: 'chop', skill: 'cleave', x: 158, y: 42, turn: .55, stance: 'ready', smear: ['#ffffff', '#fff6c8', '#ffd870', '#f0a040'],   // leads: his gauge starts full
      rig: { build: 'heroic', size: 1.35, headR: 3.6, shoulderHalf: 4.1, torsoW: 3.5, footSpread: 2.8, lean: .1, face: { bangs: .6 }, armor: true, outfit: 'tunic', hair: 'spiky', bladeLen: 15,
        colors: { cloth: '#2c5cc0', pants: '#8a6a4a', boot: '#4a2a1a', hair: '#7a4020', trim: '#e8c860', hilt: '#b08040', glove: '#6a4a3a', eye: '#1a3a8a' } } },
    { name: 'Lyra', hp: 62, mp: 30, atk: 8, spd: .38, attack: 'spark', skill: 'fire', x: 182, y: 84, turn: .7, rig: { build: 'heroic', size: 1.2, headR: 3.8, shoulderHalf: 2.8, limbW: 1.6, torsoW: 2.5, hunch: .3, face: { eyes: 'big', bangs: .3 }, weapon: 'staff', outfit: 'robe', hair: 'long', sleeves: 'long',
      hat: { style: 'pointed', color: '#3a2a7a' }, colors: { cloth: '#6a3ab8', pants: '#5a2e9e', trim: '#f0c860', hair: '#e0602a', orb: '#ff9040', staff: '#6a4a2a', boot: '#3a2a4a', eye: '#2a6a3a' } } },   // a stooped, slender black mage
    { name: 'Sera', hp: 74, mp: 26, atk: 9, spd: .42, attack: 'flurry', skill: 'cure', x: 204, y: 126, h: 34, turn: .9, rig: { size: 1.3, headR: 3.6, face: { eyes: 'big', bangs: .8 }, weapon: 'staff', outfit: 'robe', hair: 'ponytail', sleeves: 'long',   // chibi build
      hat: { style: 'band', color: '#c83a4a' }, colors: { cloth: '#f2eee2', pants: '#e2dccc', trim: '#c83a4a', hair: '#5a3424', orb: '#8affc0', staff: '#c8a060', boot: '#8a5a3a', eye: '#7a3ad0' } } }];   // brown hair, a red ribbon
  // painted monsters: pounce = [px back, px up] at the top of the wind-up (mirrored in the strike). Placed so the spot
  // a hero attacks each foe from (at its right) is clear of the others: nobody lands on the Bomb's head
  const TROOP = [
    { name: 'Dread Knight', hp: 120, atk: 14, spd: .3, moves: ['rend', 'bash', 'doom'], x: 72, y: 70, stance: 'ready', front: knightPlate, debris: ['#454a68', '#aab4d0', '#a01c2c'], smear: ['#ffffff', '#ffe0e0', '#ff8a8a', '#e04058'],
      rig: { build: 'bulky', size: 2.3, armor: true, sleeves: 'long', hair: 'bald', hat: { style: 'helmet', color: '#7a84a6' }, bladeLen: 17, cape: { len: 8, width: 8, seg: 2.8 },
        colors: { cloth: '#4a5274', pants: '#5c6486', boot: '#444860', glove: '#6a7090', skin: '#12060c', metal: '#aab4d0', cape: '#a01c2c', capeIn: '#7a1c32', trim: '#d8a840' } } },
    { name: 'Gargoyle', hp: 44, atk: 10, spd: .5, moves: ['dive', 'gale'], x: 34, y: 40, z: 30, h: 40, pounce: [8, 3], front: gargoyleCached, debris: ['#7a7090', '#44365a', '#e8dcc8'] },
    { name: 'Bomb', hp: 34, atk: 9, spd: .42, moves: ['tackle', 'blaze'], x: 38, y: 132, z: 8, h: 26, pounce: [12, 3], debris: ['#e0502a', '#ffb040', '#fff2b0'], back: bombBack, front: bombFront,
      blob: { R: 8.5, face: 'front', colors: { dk: '#8a1a14', base: '#e8582a', lt: '#ffb048', spec: '#fff6c0', eye: '#ffffff', pupil: '#1a0a0a' } } }];

  /* ---- MOVES: power (x atk) or heal, MP, how the user gets there (go: dash, leap, swoop, hop, step, flee), charge (seconds
   * in the cast pose), the swing: anim = a move from E.MOVES or an E.Attack with overrides (a list chains as an E.Combo,
   * one blow per hit) or, for painted monsters and plain commands, time = a timing-only spec whose phases drive the paint.
   * A blow lands on its impact frame, a bolt or cut when it arrives, a wave (its colors) as it passes each foe.
   * Monsters wind up longer: the player can read them coming ---- */
  const MOVES = {
    chop:   { power: 1, go: 'leap', anim: 'overhead', info: 'Leap in and cut one foe' },
    cleave: { label: 'Cleave', power: .8, mp: 8, all: true, go: 'step', anim: 'spin', wave: ['#284a9a', '#8ad8ff', '#ffffff'], info: 'Sweep every foe' },
    spark:  { power: 1, go: 'step', anim: 'throw', bolt: '#c890ff', info: 'Fling a spark at one foe' },
    fire:   { label: 'Fire', power: 3, mp: 6, go: 'step', charge: .7, anim: new E.Attack('cast', { a0: 2, wind: .3 }), bolt: '#ff9040', fx: 'flame', info: 'Burn one foe' },   // the staff up and back, then flung forward
    flurry: { power: 1.5, go: 'dash', anim: [new E.Attack('jab', { hand: 'R', lunge: 2.5 }), new E.Attack('cross', { hand: 'L' }), 'roundhouse'], info: 'Three blows on one foe' },   // staff butt, fist, foot
    cure:   { label: 'Cure', heal: 34, mp: 5, ally: true, go: 'step', charge: .6, anim: new E.Attack('rising', { a0: -.6, wind: .2 }), info: 'Heal one ally' },   // a small dip, the staff raised to the sky
    defend: { label: 'Defend', guard: true, pose: 'block', info: 'Halve damage till next turn' },   // the weapon upright across the body
    potion: { label: 'Potion', heal: 40, ally: true, pose: 'cheer', item: true, time: { wind: .4, active: .05, recover: .4 }, info: 'Restore 40 HP' },   // the bottle held up high
    run:    { label: 'Run', go: 'flee', info: 'Try to escape' },
    rend:   { power: 1, go: 'dash', anim: new E.Attack('slash', { wind: .3 }) },
    bash:   { power: 1.2, go: 'dash', pose: 'block', anim: new E.Attack('bash', { wind: .4, a0: 1.6, a1: -.1, r0: 2.5, r1: 4.5, z0: -3, crouch: .7, lean: .35, lunge: 2.6 }) },   // hands to the hip, then a pommel shove, blade upright
    doom:   { label: 'Doom Blade', power: 1.7, anim: new E.Attack('twohand', { wind: .6, active: .2 }), fx: 'doom' },   // a slow, heavy cut (its trail curves) that flies from where he stands
    dive:   { power: 1, go: 'swoop', time: { wind: .5, active: .12, recover: .4 }, fx: 'claw' },
    gale:   { label: 'Gale', power: .7, all: true, time: { wind: .6, active: .12, recover: .45 }, wave: ['#4a3c64', '#c8bcd8', '#fff8f0'] },   // wings up, one great beat
    tackle: { power: 1, go: 'hop', time: { wind: .45, active: .14, recover: .4 } },
    blaze:  { label: 'Blaze', power: 1.3, time: { wind: .6, active: .1, recover: .35 }, bolt: '#ff8a2a', fx: 'flame' }
  };
  const PAUSE = { wind: .2, active: .05, recover: .35 }, GO = .35, BACK = .4, FLY = .3, DIE = .9, WAVE = 400;   // seconds: out, back, a bolt's flight, a monster's death; a wave's speed
  const COMMANDS = h => [h.attack, h.skill, 'defend', 'potion', 'run'];
  let party, foes, all, menu, log, act, fx, mode, actor, list, cursor, pending, potions, note, t, dim, cam, yaw, band, frame = 0, auto = false;   // band: the HUD on screen (taps); auto: the party fights by itself
  const alive = l => l.filter(c => !c.dead), isHero = c => party.includes(c), size = c => c.rig ? c.rig.o.size : 1.2;
  const unit = (d, hero) => {
    const body = d.rig ? new E.Humanoid(d.rig) : d.blob && new E.Blob(d.blob);   // both kick() and draw()
    return Object.assign({}, d, { body, rig: d.rig && body, max: d.hp, mp: d.mp || 0, home: [d.x, d.y], hx: d.x, hy: d.y, hz: d.z || 0, z: d.z || 0, px: d.x, py: d.y, atb: d.atb || (hero ? E.rand(.3, .7) : E.rand(0, .3)),
      face: hero ? Math.PI - d.turn : .75, flash: 0, glow: 0, shake: 0, grow: 0, coil: 0, flee: 0, tilt: 0, flapT: 0, bob: 0, die: 0, fade: hero ? 1 : 0, dead: false, guard: false, h: d.h || (d.rig.build === 'bulky' ? 29 : 31) * d.rig.size });
  };
  function start() {
    party = PARTY.map(d => unit(d, true)); foes = TROOP.map(d => unit(d, false)); all = [...party, ...foes]; place();
    for (const c of all) { c.x = c.px = c.hx + (isHero(c) ? 70 : 0); c.y = c.py = c.hy; }   // intro: the party runs in, the monsters fade in
    log = new E.Dialog(game, { place: 'top', lines: 2, speed: 70, bg: WIN }); menu = new E.Menu(game, [], { onPick: pick });   // E.Menu reads the keys; hud() draws it
    act = null; fx = []; potions = 3; note = ''; t = 0; dim = 0; cam = [rest().x, 72, 0]; mode = 'intro'; game.cam.bounds = null; L.enabled = false;
    A.music('boss'); game.flash('#ffffff', .25); game.after(.9, () => { mode = 'wait'; });
  }

  // each fighter's place for this screen's shape (the standing walk there when it turns: animate)
  const place = () => { placed = game.upright; const R = rest(); for (const c of all) { c.hx = 119 + (c.home[0] - 119) * R.spread; c.hy = 84 + (c.home[1] - 84) * R.deep; } };
  let placed;

  /* ---- WAIT-MODE ATB: gauges fill while nobody chooses or acts; a full gauge takes the turn ---- */
  function tick(dt) {
    for (const c of all) if (!c.dead) c.atb = Math.min(1, c.atb + c.spd * dt);
    const c = all.find(c => !c.dead && c.atb >= 1), sk = c && MOVES[c.skill]; if (!c) return;
    c.atb = 0; c.guard = false; actor = c; if (!isHero(c)) return order(E.pick(c.moves), E.pick(alive(party)));   // monsters pick a move and a hero
    menu.items = ['Attack', { label: sk.label, note: sk.mp, disabled: c.mp < sk.mp }, 'Defend', { label: 'Potion', note: '×' + potions, disabled: !potions }, 'Run'];
    if (auto) return order(...autoPick(c));   // AUTO: the hero picks for himself
    menu.i = 0; menu.active = true; mode = 'command'; A.sfx('blip');
  }
  // AUTO (mobile RPGs' battle button): heal the weakest ally under 40% (the skill, or a potion under 25%), sweep two foes or
  // more, spend the skill on a foe that can take it, else hit the weakest foe
  function autoPick(c) {
    const sk = MOVES[c.skill], foe = alive(foes).sort((a, b) => a.hp - b.hp)[0], low = alive(party).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
    if (low.hp < low.max * .4 && sk.heal && c.mp >= sk.mp) return [c.skill, low];
    if (low.hp < low.max * .25 && potions) return ['potion', low];
    if (sk.power && c.mp >= sk.mp && (sk.all ? alive(foes).length > 1 : foe.hp > c.atk * 2)) return [c.skill, sk.all ? null : foe];
    return [c.attack, foe];
  }
  function pick(i) {
    const key = COMMANDS(actor)[i], m = MOVES[key];
    if (m.all || !(m.power || m.heal)) return order(key, null);   // Cleave, Defend and Run need no target
    pending = key; list = alive(m.ally ? party : foes); mode = 'target'; cursor = m.ally ? list.indexOf(list.slice().sort((a, b) => a.hp / a.max - b.hp / b.max)[0]) : 0;   // heals start on the weakest ally
  }
  function order(key, target) {
    const m = MOVES[key]; if (m.mp) actor.mp -= m.mp; if (key === 'potion') potions--;
    act = { who: actor, key, target, t: 0, hits: 0, due: [] }; mode = 'act'; menu.active = false; note = m.label || '';   // named moves show a banner
  }
  function finish() {   // after every action: win, lose, or back to the gauges
    act = null; actor = null; note = '';
    if (!alive(foes).length) {   // the last death plays out, then victory and a line with a live portrait
      mode = 'won'; game.after(DIE, () => { mode = 'win'; A.music('victory'); game.flash('#fff4d0', .3, .6); });
      game.after(DIE + 1.6, () => log.say(['The monsters are defeated!', 'Rowan, Lyra and Sera grow stronger.'], { name: party[0].name, portrait: party[0].rig, portraitSize: 32, onDone: () => game.go('title') }));
    } else if (!alive(party).length) { mode = 'lose'; note = 'The party has fallen...'; game.after(2, () => game.go('over', { from: 'rpg' })); }
    else mode = 'wait';
  }

  /* ---- ACTIONS: go out (GO s), charge in the cast pose, swing an E.Combo of the move (each blow settles before the
   * next starts), wait for everything in flight to land (a.due), come back (BACK s) ---- */
  function play(a, dt) {
    const u = a.who, m = MOVES[a.key], tt = a.t += dt, side = isHero(u) ? -1 : 1, mine = isHero(u) ? party : foes;
    if (a.target && a.target.dead && !a.hits) a.target = alive(m.ally ? mine : mine === party ? foes : party)[0] || null;   // a new target (never mid-combo)
    const tg = a.target, near = tg && /dash|leap|swoop|hop/.test(m.go), t0 = (m.go ? GO : 0) + (m.charge || 0), fly = m.go === 'swoop';
    // melee: clear of the target's blade; a flier swoops low in front of its target, clear of the rest
    const dx = near ? tg.hx - side * (fly ? 16 : 10 + 5 * size(tg) + 8 * size(u)) : u.hx + (m.go === 'step' ? side * 12 : 0), dy = near ? (fly ? Math.min(tg.hy + 30, 140) : tg.hy + 2) : u.hy;
    if (!a.atk && tt >= t0) { a.atk = new E.Combo([].concat(m.anim || m.time || PAUSE).map(s => s.spec ? new E.Attack(s.spec) : s)); a.atk.press(); }   // fresh copies: MOVES are shared
    const k = a.atk;
    if (k) {
      k.update(dt); if (!k.busy && k.step < k.moves.length - 1) k.press();   // the next blow
      const h = k.current; if (a.hits <= k.step && (h.phase === 'recover' || !h.phase || h.active && h.u >= (h.spec.hitAt || .5))) { a.hits++; strike(a, m, tg, side); }   // the impact frame (a move's hitAt)
      E.prune(a.due, d => d.at <= tt && land(a, d));
      if (!k.busy && !a.due.length && a.back === undefined) a.back = tt;
    }
    const st = k && k.state;
    const going = clamp(a.back === undefined ? tt / GO : (tt - a.back) / BACK, 0, 1), out = a.back === undefined ? E.ease.inOut(going) : 1 - E.ease.inOut(going);
    u.x = lerp(u.hx, dx, out); u.y = lerp(u.hy, dy, out);
    u.z = fly && tg ? lerp(u.hz, tg.z + 6, out) : u.hz + Math.sin(going * Math.PI) * (m.go === 'leap' ? 16 : m.go === 'hop' ? 9 : 0);   // leaps arc there and back
    // coil: 0 -> 1 through the wind-up, 1 -> -1 in the strike, back to 0: painted monsters rear back and pounce with it
    u.coil = !st ? 0 : st.phase === 'wind' ? E.ease.outQuad(st.u) : st.phase === 'active' ? 1 - 2 * E.ease.outCubic(st.u) : E.ease.inOut(st.u) - 1;
    if (u.pounce) { u.x -= side * u.pounce[0] * u.coil; u.z += u.pounce[1] * u.coil; }
    u.swing = m.anim ? st : null;                                                   // the rig plays the E.MOVES swing
    const was = u.phase; u.phase = st && (st.phase === 'active' && a.hits ? 'hit' : st.phase);   // wind, active, hit (the blow landed), recover
    if (u.blob && u.phase === 'active' && was === 'wind') u.body.kick(-14);        // the Bomb launches stretched
    const ch = m.charge && tt < t0 ? clamp(1 - (t0 - tt) / m.charge, 0, 1) : 0;   // 0..1 through a charge
    u.charge = m.charge && a.atk && !a.hits ? 1 : ch;                              // lit until the spell is released
    u.pose = ch ? 'cast' : a.atk && m.pose;                                         // charge in the cast pose; Potion, Defend, bash (till home)
    u.item = m.item && !a.hits;                                                     // the potion bottle, until it is used
    u.flee = m.go === 'flee' ? out : 0;                                             // Run: turn tail and run in place (FF VI)
    u.blink = !isHero(u) && tt < .35;                                               // monsters glow before they act (FF VI)
    // the ready blade rests low from the follow-through till clear: never sweeps back through the foe
    u.calm = st ? st.phase === 'recover' : a.back !== undefined && (!near || going < .6);
    if (m.charge && !a.glyph) a.glyph = addFx('glyph', u, t0 + .4, m.heal ? '#8affc0' : '#ffb050');
    if (u.charge) {   // a live charge: the caster floats a pixel, motes stream into the orb
      u.z += Math.sin(ch * Math.PI) * (1.2 + .4 * Math.sin(tt * 14));
      if (E.chance(dt * 40)) { const [ox, oy, oz] = u.rig.tip(), w = E.rand(0, TAU), d = E.rand(10, 16), v = [Math.cos(w) * d, Math.sin(w) * d * .5, Math.sin(w * 3) * d * .7];
        P.add({ kind: 'ember', x: ox + v[0], y: oy + v[1], z: oz + v[2], vx: -v[0] * 4, vy: -v[1] * 4, vz: -v[2] * 4, max: .25, color: m.heal ? '#b0ffd8' : '#ffd070' }); }   // arrives in .25 s
    }
    if (u.item && E.chance(dt * 6)) { const [x, y, z] = u.rig.hand('L'); P.add({ kind: 'glint', x, y, z: z + 5, max: .3, size: 1.2, color: '#ffffff' }); }   // the bottle glints
    a.orb = null; if (m.bolt && tt - a.fly < FLY) {   // a bolt trailing embers; it bows toward the camera, in front of anyone on the way
      const q = (tt - a.fly) / FLY, p0 = a.from, bow = Math.sin(q * Math.PI);
      a.orb = [lerp(p0[0], tg.x, q), lerp(p0[1], tg.y, q) + bow * Math.max(0, tg.y - p0[1]) * 1.4, lerp(p0[2], tg.z + tg.h * .5, q) + bow * 12, m.bolt, 3 + m.power];   // [x, y, z, color, radius]
      P.add({ kind: 'ember', x: a.orb[0], y: a.orb[1], z: a.orb[2], vx: E.rand(-10, 10), vz: E.rand(-10, 10), max: .4, color: m.bolt });
      if (m.fx === 'flame' && E.chance(dt * 40)) P.fire(a.orb[0], a.orb[1], a.orb[2], 1, { size: 2.5, speed: 4 });
    }
    if (a.back !== undefined && tt >= a.back + BACK) { Object.assign(u, { x: u.hx, y: u.hy, z: u.hz, swing: null, phase: null, pose: null, coil: 0, flee: 0, blink: false, calm: false }); finish(); }
  }
  // a blow reaches its impact frame: it lands now, a bolt or the Doom Blade's cut after FLY s, a wave as it passes each foe
  function strike(a, m, tg, side) {
    const u = a.who, due = (c, s) => a.due.push({ c, at: a.t + s, i: a.hits - 1 });
    if (a.key === 'run') { note = "Can't escape!"; A.sfx('cancel'); return; }
    if (m.guard) { u.guard = true; P.ring(u.x, u.y, 3, 16, '#8ad0ff', .4); P.glints(u.x, u.y, u.z + 24, 4, '#c8ecff', 16); A.sfx('select'); return; }   // Defend: guard until the next turn
    if (u.blob) u.body.sq = .35;   // the Bomb squashes on the hit frame (a kick waits out the hit-stop)
    if (m.item) { const [x, y, z] = u.rig.hand('L'); P.glints(x, y, z, 8, '#b0ffd0', 6); P.add({ kind: 'bit', x, y, z: z + 6, vx: 25, vz: 110, g: 380, max: .5, size: 2, color: '#c08040' }); A.sfx('pickup'); }   // the cork pops
    if (m.wave) {   // a crescent sweeps across the other side, aimed at their middle
      const l = alive(isHero(u) ? foes : party), to = { x: side < 0 ? -10 : 240, y: l.reduce((s, c) => s + c.y / l.length, 0), z: 0, h: 40 };
      Object.assign(addFx('wave', u, Math.abs(to.x - u.x) / WAVE), { to, cols: m.wave }); P.ring(u.x, u.y, 4, 70, m.wave[1], .45); A.sfx('whoosh');
      return l.forEach(c => due(c, Math.abs(c.x - u.x) / WAVE));
    }
    if (!tg) return;
    if (m.bolt || m.fx === 'doom') { a.fly = a.t; a.from = u.rig ? u.rig.tip() : [u.x + side * 8, u.y, u.z + u.h * .4]; A.sfx(m.bolt ? 'shoot' : 'swing'); due(tg, FLY); }
    else due(tg, 0);
    if (m.fx === 'doom') Object.assign(addFx('wave', u, FLY), { to: tg, cols: DOOM });
  }
  function land(a, { c, i }) {   // i: the blow's place in a combo
    const u = a.who, m = MOVES[a.key], zc = c.z + c.h * .5; if (c.dead) return true;
    if (m.heal) {
      const h = m.heal + E.randInt(0, 6); c.hp = Math.min(c.max, c.hp + h); c.glow = .8; A.sfx('heal');
      P.glints(c.x, c.y, c.z + c.h, 12, '#9affc8', 14); P.ring(c.x, c.y, 3, 18, '#8affc0', .5); P.text(c.x, c.y, zc + 12, h, '#8affc0', { scale: 2, bounce: true }); return true;
    }
    const crit = E.chance(.12), d = Math.round((u.atk * m.power / a.atk.moves.length + E.randInt(0, 4)) * (crit ? 1.8 : 1) * (c.guard ? .5 : 1)), col = crit ? '#ffd040' : '#ffffff', side = isHero(u) ? -1 : 1;
    c.hp = Math.max(0, c.hp - d); c.flash = .12; c.shake = .35; c.grow = .25; c.x += side * 4; if (c.body) c.body.kick(c.rig ? 2 : -3);   // flinch: flash, shake, knocked back a step
    if (m.fx === 'flame') { addFx('flame', c, .8, '#ff7030'); P.explosion(c.x, c.y, c.z + 12, .8, { debris: false }); }
    else game.hitFx(c.x, c.y, zc, { power: crit ? 2 : 1.3, angle: side > 0 ? 0 : Math.PI, color: c.guard ? '#8ad0ff' : m.bolt, sound: c.guard ? 'bump' : u.rig ? 'hit' : 'punch' });   // hit-stop, shake, sparks
    P.text(c.x + i * 8, c.y, zc + 12 + i * 10, d, col, { scale: 2, bounce: true });   // a combo's numbers climb in a stair, never on top of each other
    if (m.fx === 'doom') { addFx('doom', c, .45, '#ff2848'); game.shake(5); } if (m.fx === 'claw') addFx('claw', c, .3);
    if (!c.hp) kill(c); return true;
  }
  function kill(c) { c.dead = true; c.atb = 0; c.guard = false; c.die = 0; A.sfx(isHero(c) ? 'hurt' : 'die'); }   // heroes fall flat; monsters play a death, then burst()
  function burst(c) {   // the end of a monster's death: debris and smoke (the Bomb explodes), then it fades
    c.gone = true; P.bits(c.x, c.y, c.z + 10, 18, c.debris); A.sfx('explode', { vol: .5 });
    if (c.blob) { addFx('pop', c, .2); P.explosion(c.x, c.y, c.z + 10, 1.2); c.fade = 0; }
    else for (const d of [-10, 0, 10]) P.smoke(c.x + d, c.y, c.z + 4, 3, { size: 4, color: '#c8b0e4', dark: '#a48cc8', light: '#f4ecff' });   // pale violet wisps
  }
  const addFx = (kind, c, dur, color) => { const f = { kind, c, x: c.x, y: c.y, z: c.z, t: 0, dur, color }; fx.push(f); return f; };

  /* ---- UPDATE ---- */
  // heavy cloth: drain the cape's swing relative to its wearer (mx, my: his step), so it settles in .15 s after a dash
  function heavyCape(rig, dt, mx, my) {
    const keep = .05 ** (dt / .15);
    for (const n of [...rig.capeL, ...rig.capeR]) { n.px = n.x - mx - (n.x - n.px - mx) * keep; n.py = n.y - my - (n.y - n.py - my) * keep; }
  }
  function animate(c, dt) {
    c.flash -= dt; c.glow -= dt; c.shake -= dt; c.grow = Math.max(0, c.grow - dt); c.flapT += dt * (1 + Math.abs(c.coil) * 1.5);   // wings beat harder in a strike
    if (c.dead && (c.die += dt) > DIE && !c.gone && !isHero(c)) burst(c);
    c.fade = clamp(c.fade + (c.gone ? -2.5 : c.dead ? 0 : 1.5) * dt, isHero(c) ? 1 : 0, 1);   // monsters fade in, and out once they burst
    const busy = act && act.who === c, choosing = c === actor && (mode === 'command' || mode === 'target'), cheer = mode === 'win' && isHero(c) && !c.dead;
    const tx = c.hx - (choosing ? 6 : c.dead && isHero(c) ? 12 : 0);   // the hero on turn steps up; the fallen stagger forward
    if (!busy) { c.x = approach(c.x, tx, Math.min(90, Math.abs(tx - c.x) * 4 + 8) * dt); c.y = approach(c.y, c.hy, 90 * dt); c.z = c.hz * (c.dead ? Math.max(0, 1 - (c.die / .5) ** 2) : 1); }   // the dead drop
    if (cheer) c.z = Math.abs(Math.sin(t * 5 + c.hy)) * 6;   // victory: hop, turned to the camera
    c.bob = c.hz && !c.dead ? Math.sin(t * 2.6 + c.hx) * 3 : 0;   // fliers hover (drawn on top of z)
    c.tilt = c.dead ? Math.min(c.die * 3, 1.4) : -.55 * c.coil;    // the Gargoyle rears back, pitches into the dive, tumbles when it dies
    const k = dt > 0 ? 1 / dt : 0, vx = (c.x - c.px) * k, vy = (c.y - c.py) * k; c.px = c.x; c.py = c.y;
    if (c.blob) {   // a Blob breathes, swells to wind up (and die), stretches at its target, squashes on the hit and when struck
      c.body.update(dt, { squash: c.shake > .1 ? -.35 : { wind: .3 * c.coil, active: -.4, hit: .4 }[c.phase] ?? .06 * Math.sin(t * 3 + c.hx), look: [1, .3], squint: c.dead || c.shake > .2 });
      c.body.scale = 1 + c.grow + (c.dead ? c.die * .7 : Math.max(0, c.coil) * .3);
    }
    if (!c.rig) return;
    // held poses, most important first: KO (a stagger, the knees give, a topple), victory, the move's pose, Defend, low HP
    const pose = c.dead ? 'die' : cheer ? 'cheer' : c.pose || (c.guard ? 'block' : isHero(c) && c.hp < c.max / 4 && !busy && !choosing ? 'kneel' : undefined);
    // faces: wince when hurt, smile to cheer, glare while charging, shout on the blow
    const expr = c.dead || c.shake > .1 || pose === 'kneel' ? 'wince' : cheer ? 'smile' : c.charge ? 'angry' : c.phase === 'active' || c.phase === 'hit' ? 'shout' : undefined;
    // the facing eases, never snaps: side-on to the foes while acting (blows read in profile, FF style), to the camera to
    // cheer, away to Run; the fallen drop where they stand
    const goal = cheer ? Math.PI / 2 + .5 : c.flee ? Math.PI - c.face : busy && !MOVES[act.key].ally ? (isHero(c) ? Math.PI - .35 : .35) : c.face;
    const f = c.fa = E.approachAng(c.fa ?? goal, goal, dt * 9);
    c.rig.update(dt, { x: c.x, y: c.y, z: c.z, facing: f, vx, vy, run: c.flee, hurt: c.shake > .1, air: c.z > c.hz + 2, pose, expr, attack: c.swing, stance: pose || c.calm ? undefined : c.stance });   // a held pose drops the stance; Run: legs pump in place
    if (c.rig.capeL) heavyCape(c.rig, dt, vx * dt, vy * dt);
  }
  function update(dt) {
    t += dt; if (log.update(dt)) return;
    for (const c of all) animate(c, dt);
    for (const f of fx) { f.t += dt; Object.assign(f, { x: f.c.x, y: f.c.y, z: f.c.z }); }
    E.prune(fx, f => f.t > f.dur);
    const m = act && MOVES[act.key]; dim = approach(dim, m && (m.charge || m.fx === 'doom') && act.back === undefined ? 1 : 0, dt * 3);   // spells and Doom Blade dim the scene
    // ambience: drifting petals, brazier embers
    if (E.chance(dt * 5)) P.add({ kind: 'bit', x: E.rand(0, 200), y: E.rand(10, 140), z: E.rand(50, 90), vx: E.rand(10, 22), vz: -4, g: 5, drag: .2, max: 6, size: E.chance(.4) ? 2 : 1, color: E.pick(['#ffc0d0', '#ffe0e8', '#ffd890']) });
    if (E.chance(dt * 6)) P.add({ kind: 'ember', x: E.pick([100, 132]) + E.rand(-3, 3), y: 8, z: 20, vz: E.rand(18, 30), vx: E.rand(-4, 4), max: 1, color: '#ff8a2a' });
    if (tapped()) return;
    if (mode === 'wait') tick(dt);
    else if (mode === 'act') play(act, dt);
    else if (mode === 'command') menu.update();
    else if (mode === 'target') {   // aiming the glove
      const inp = game.input, n = list.length, d = inp.repeat('up') || inp.repeat('left') ? -1 : inp.repeat('down') || inp.repeat('right') ? 1 : 0;
      if (d) { cursor = (cursor + n + d) % n; A.sfx('select'); }
      if (inp.pressed('confirm')) { inp.consumeAll(); A.sfx('confirm'); order(pending, list[cursor]); } else if (inp.pressed('cancel')) { inp.consumeAll(); A.sfx('cancel'); mode = 'command'; }
    }
  }

  // TAPS (a click works too). Touch: the pads, as drawn; a mouse: the command list (a click there while aiming goes back).
  // Aiming, a tap on a fighter targets it
  function tapped() {
    const c = game.input.clicked(); if (!c || !band) return false;
    const [x, y] = c, inside = b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h, use = f => { game.input.consumeAll(); f(); return true; };
    if (band.pads) { const p = band.pads.find(p => p && p.go && !p.off && p.w && inside(p)); if (p) return use(p.go); }
    else {
      const onCmds = inside({ x: band.X + 4, y: band.Y, w: 92, h: 66 }), k = Math.floor((y - band.Y - 3) / 10), it = menu.items[k];
      if (mode === 'command' && onCmds && it && !it.disabled) return use(() => { menu.i = k; A.sfx('confirm'); pick(k); });
      if (mode === 'target' && onCmds) return use(() => { A.sfx('cancel'); mode = 'command'; });
    }
    if (mode !== 'target') return false;
    const z = game.view.scale / E.VIEWS.brawler.scale, i = list.findIndex(u => { const [sx, sy] = game.r.w(u.x, u.y, u.z + u.h * .5); return Math.abs(x - sx) < (14 + u.h * .25) * z && Math.abs(y - sy) < (u.h * .6 + 8) * z; });   // the whole fighter, at any zoom
    return i >= 0 && use(() => { cursor = i; A.sfx('confirm'); order(pending, list[i]); });
  }
  // what the pads say and do now: the commands and AUTO on a hero's turn; aiming, the targets (with their HP) and BACK; else
  // the foes' HP (or the spoils) and AUTO, which can be turned on or off at any time
  function padsNow() {
    const autoPad = { label: 'AUTO', note: auto ? 'ON' : 'OFF', on: auto, go: () => { auto = !auto; A.sfx(auto ? 'confirm' : 'cancel'); if (auto && actor && (mode === 'command' || mode === 'target')) order(...autoPick(actor)); } };
    const fill = (a, n) => { while (a.length < n) a.push(null); return a.slice(0, n); };
    if (mode === 'command') return [...menu.items.map((it, k) => ({ label: it.label || it, note: it.note, off: it.disabled, go: () => { menu.i = k; A.sfx('confirm'); pick(k); } })), autoPad];
    if (mode === 'target') return [...fill(list.map((c, k) => ({ label: c.name, hp: c.hp / c.max, ally: isHero(c), on: k === cursor, go: () => { cursor = k; A.sfx('confirm'); order(pending, c); } })), 5), { label: 'BACK', go: () => { A.sfx('cancel'); mode = 'command'; } }];
    if (mode === 'win' || mode === 'won') return fill([['EXP', '+180'], ['Gil', '+96'], ['Item', 'Ether']].map(([label, note]) => ({ label, note })), 6);
    return [...fill(alive(foes).map(f => ({ label: f.name, hp: f.hp / f.max })), 5), autoPad];
  }

  /* ---- DRAW ---- */
  const RIM = '#ffc27a', DOOM = ['#3a0a1e', '#d0203a', '#fff0f0'];
  const BOTTLE = E.sprite(['...kkk...', '...kck...', '...kck...', '...kwk...', '..kwwgk..', '.kwwgggk.', 'kwwgggggk', 'kwgggggGk', 'kggyyygGk', 'kggyyyGGk', '.kgGGGGk.', '..kkkkk..'],
    { k: '#1a1030', c: '#c08040', w: '#ffffff', g: '#58e088', G: '#2a9a58', y: '#fff0b0' });   // a potion flask: cork, glint, label
  // a long see-through shadow away from the sun (a decal)
  const longShadow = (r, x, y, len, w) => r.decal(g => px.polyDither(g, Array.from({ length: 12 }, (_, i) => {
    const a = i / 12 * TAU, u = (1 + Math.cos(a)) / 2 * len, s = Math.sin(a) * w; return r.w(x - SUN[0] * u - SUN[1] * s, y - SUN[1] * u + SUN[0] * s, 0);
  }), '#2a1a50', .32, r.ix, r.iy));
  function drawUnit(r, c) {
    if (c.fade <= 0) return;
    const x = c.x + (c.shake > 0 ? Math.sin(t * 90) * 2 : 0), w = size(c) * 5;   // a struck target shakes
    r.shadow(c.x, c.y, w, .55, '#1e0e24'); longShadow(r, c.x, c.y, c.dead ? 10 : c.h * 1.2, w * .8);   // a violet contact shadow and a long one
    const line = c.flash > 0 ? '#ffffff' : c.glow > 0 && Math.sin(t * 30) > 0 ? '#8affc0' : c.blink && Math.sin(t * 40) > 0 ? '#ffe890' : c.guard ? '#6ab8ff' : undefined;
    const dying = c.dead && !c.gone && !isHero(c) && Math.sin(c.die * 36) > 0;   // a dying monster blinks white
    r.actor(x, c.y, c.z + c.bob, (g, ox, oy) => {
      if (c.back) c.back(g, ox, oy, c, r.view, t);
      if (c.body) c.body.draw(g, ox, oy, r.view);   // Humanoid and Blob draw the same way
      if (c.front) c.front(g, ox, oy, c, r.view, t);
    }, { flash: dying || c.flash > .08 ? '#ffffff' : c.fade < 1 && !isHero(c) ? '#b060ff' : false, outlineColor: line, rimColor: c.flash > 0 ? '#ffffff' : RIM, alpha: isHero(c) ? 1 : clamp(c.fade, 0, 1),   // struck: a 3-frame flash
      bias: act && act.who === c ? 60 : 0 });   // the fighter in action is drawn over the others (FF style), never hidden behind the Bomb
    if (c.swing && c.rig.trail.length > 3) c.rig.drawSmear(r, c.smear);   // the trail along the real blade, fist or foot path, once it curves (no flat first slab)
    if (c.item) { const [x, y, z] = c.rig.hand('L'); r.sprite(x, y, z - 2, BOTTLE, { bias: 61 }); }   // held up by its base, over the acting fighter
    if (c.rig && c.rig.o.weapon === 'staff' && !c.dead) { const [ox, oy, oz] = c.rig.tip(), k = c.charge || 0; r.queue(ox, oy, oz, g => {   // the orb glows; charging, it throbs
      const [sx, sy] = r.w(ox, oy, oz); r.glowDisc(g, sx, sy, 6 + k * (3.5 + 1.5 * Math.sin(t * 24)), c.rig.C.orb, .4 + .3 * k); if (k) px.disc(g, sx, sy, .5 + k * 2, '#fffbe8');
    }, { bias: .5, emissive: true }); }
  }
  function drawFx(r, f) {
    const u = f.t / f.dur, k = Math.sin(u * Math.PI);
    if (f.kind === 'glyph') r.decal(() => {   // a magic circle under the caster: two rings and turning rune marks
      r.groundRing(f.x, f.y, 15, f.color, 1); r.groundRing(f.x, f.y, 11, f.color, .7);
      for (let i = 0; i < 6; i++) { const a = f.t * 2 + i * TAU / 6; r.groundArc(f.x, f.y, 11, 15, a, a + .35, f.color, 1); }
    });
    else if (f.kind === 'flame') for (const front of [false, true]) r.queue(f.x, f.y + (front ? 2 : -2), 0, g => {   // a flame ring: back half behind
      const s = f.c.h / 40, [cx, cy] = r.w(f.x, f.y, f.z + f.c.h * .4);   // the target, front half in front
      if (!front) r.glowDisc(g, cx, cy, 24 * s, '#ff6a20', .7 * k);
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + f.t * 4, [sx, sy] = r.w(f.x + Math.cos(a) * 10 * s, f.y + Math.sin(a) * 10 * s, f.z), q = .7 + i * 37 % 10 / 20; if (Math.sin(a) > 0 === front) flame(g, sx, sy, (4 + 2 * s) * q, (30 + 14 * Math.sin(f.t * 24 + i * 2)) * s * k * q, f.t * 16 + i); }
    });
    else if (f.kind === 'doom' || f.kind === 'wave') r.queue(f.x, f.y + 3, 0, g => {   // crescent cuts: a wave flies to f.to
      const w = f.to, d = w && w.x < f.x ? -1 : 1, R = (w ? 24 : 36) + 12 * u, h = f.z + f.c.h * .5;
      const [sx, sy] = w ? r.w(lerp(f.x, w.x, u), lerp(f.y, w.y, u), lerp(h, w.z + w.h * .5, u)) : r.w(f.x, f.y, h), arc = (R0, cx, cy) => Array.from({ length: 9 }, (_, i) => [cx + d * Math.cos(-2.4 + i * .42) * R0, cy + Math.sin(-2.4 + i * .42) * R0]);
      (f.cols || DOOM).forEach((c, i) => px.poly(g, [...arc(R * (1 - i * .2), sx, sy), ...arc(R * (1 - i * .2) * (.72 + .26 * u), sx + 5 * d, sy - 4).reverse()], c));
    }, { emissive: true });   // emissive: never darkened by the lights
    else if (f.kind === 'pop') r.queue(f.x, f.y + 3, f.z + 12, g => {   // the Bomb bursts: a white-hot flash bigger than its swollen body
      const [sx, sy] = r.w(f.x, f.y, f.z + 12), R = 20 * r.view.scale * (1 - u * .5); r.glowDisc(g, sx, sy, R * 1.5, '#ffd070', 1 - u); px.disc(g, sx, sy, R * (1 - u), '#fff8e0');
    }, { emissive: true, bias: 4 });   // over the blast's first smoke
    else if (f.kind === 'claw') r.queue(f.x, f.y + 3, 0, g => {   // three claw rakes tear down across the target, their tails catching up
      const [sx, sy] = r.w(f.x, f.y, f.z + f.c.h * .7), a = Math.min(1, u * 4) * 18, b = Math.max(0, u * 2 - 1) * 18;   // head and tail along each rake
      for (const i of [-7, 0, 7]) for (const [w, c] of [[2, '#ff3050'], [1, '#ffffff']]) px.line(g, sx + i - 5 + b * .5, sy - 9 + b, sx + i - 5 + a * .5, sy - 9 + a, c, w);
    }, { emissive: true });
  }
  function draw(r) {
    const { fy } = layout(r.W, r.H), cx = rest().x, key = [r.W, r.H, fy, cx, game.zoom].join(); if (!backdrop || backdrop.key !== key) { backdrop = paintBackdrop(r.W, r.H, fy, cx, game.zoom); backdrop.key = key; }
    r.ctx.drawImage(backdrop, 0, 0);
    plaza.drawFloor(r); plaza.queueWalls(r); for (const [name, x, y, z, o] of PROPS) r.prop(name, x, y, z, o);
    for (const [id, x, y, o] of SHAPES) r.shape(id, x, y, 0, o);
    for (const c of all) drawUnit(r, c); for (const f of fx) drawFx(r, f);
    const orb = act && act.orb, m = act && MOVES[act.key];
    if (orb) r.queue(orb[0], orb[1], orb[2], g => {   // the bolt: additive halo, ball, hot core
      const [sx, sy] = r.w(orb[0], orb[1], orb[2]), R = orb[4]; r.glowDisc(g, sx, sy, R * 2.7, orb[3], .5); px.disc(g, sx, sy, R, orb[3]); px.disc(g, sx - 1, sy - 1, R / 2, '#fff0b0'); px.dot(g, sx - 1, sy - 1, '#ffffff');
    }, { bias: .3 });
    L.enabled = dim > .02;
    if (L.enabled) {   // spells dim the scene; colored lights (PS1-style)
      L.ambient = 1 - .55 * dim; for (const x of [100, 132]) L.add(x, 8, 10, 24, .7, { color: '#ffa040' });
      if (act) L.add(act.who.x, act.who.y, 0, 34, m && m.charge ? .7 : .3, { color: m && m.charge ? '#c8c0ff' : '#ff5060' });   // a caster glows; the Knight keeps dark
      for (const f of fx) if (f.color) L.add(f.x, f.y, 0, 34, .8, { color: f.color });
    }
    r.overlay(g => hud(g, r)); log.draw(r);
  }

  /* ---- HUD: FF gradient windows (E.ui.box bg: [top, bottom]), cards with live portraits (drawPortrait), gauges ---- */
  const WIN = ['#6c8cff', '#0a0a48'], HOT = ['#90aaff', '#1c2a90'], KO = ['#8a3a5a', '#20061a'];   // [top, bottom]
  const gauge = (g, x, y, w, f, c) => E.ui.bar(g, x, y, w, 5, f, c, { bg: '#2a2650' });
  // the 16-bit RPG glove cursor
  const HAND = E.sprite(['..kkkk......', '.kwwwwkkkkk.', 'kwwwwwwwwwwk', 'kwwwwwkkkkk.', 'kwwwwwsk....', 'kswwwwsk....', '.ksssssk....', '..kkkkk.....'], { k: '#1a1030', w: '#ffffff', s: '#a8b0d0' });
  const txt = (g, s, x, y, c, align) => E.font.text(g, String(s), x, y, c, { shadow: '#0a0820', outline: false, align });
  const tiny = (g, s, x, y, c) => E.font.text(g, s, x, y, c, { font: 'tiny', outline: false });
  function hud(g, r) {
    const { Y } = layout(r.W, r.H), choosing = mode === 'command' || mode === 'target', bob = Math.round(Math.sin(t * 10) * 1.5); frame++;
    const X = Math.round((r.W - 320) / 2), P = game.input.lastDevice === 'touch' && pads(r.W, r.H); band = { X, Y, pads: P && padsNow() };   // keys: the band's 316 px, centred
    // an arrow over the hero on turn, the glove on the target
    if (choosing) { const [sx, sy] = r.w(actor.x, actor.y, actor.z + actor.h + 5); px.poly(g, [[sx - 5, sy - 7 + bob], [sx + 5, sy - 7 + bob], [sx, sy - 1 + bob]], '#ffe060'); px.rect(g, sx - 3, sy - 6 + bob, 6, 1, '#fff8c0'); }
    if (mode === 'target') { const c = list[cursor], [sx, sy] = r.w(c.x, c.y, c.z + c.h * .55); px.sprite(g, HAND, sx - 28 + bob, sy - 4); }
    // top banner: the move, the target, or what the command does
    const top = mode === 'command' ? MOVES[COMMANDS(actor)[menu.i]].info : mode === 'target' ? list[cursor].name : note;
    if (top && !log.open) { const w = E.font.width(top) + 24, c = Math.round(r.W / 2); E.ui.box(g, c - w / 2, 5, w, 18, { bg: WIN }); txt(g, top, c, 10, '#ffffff', 'center'); }
    // a near-black band under the windows (down to the bottom edge); touch: the pads; keys: commands, spoils or monsters on the left
    px.rect(g, 0, Y - 3, r.W, r.H - Y + 3, '#0c0818');
    if (P) band.pads.forEach((p, i) => {   // a pad: its label (left) and note (right), a target's HP bar under them; lit when on
      if (!p) return; const b = Object.assign(p, P.cell(i)), ty = b.y + (p.hp === undefined ? 15 : 9);
      E.ui.box(g, b.x, b.y, b.w, b.h, { bg: p.on ? HOT : WIN, border: p.on ? '#ffe890' : undefined });
      txt(g, p.label, b.x + 7, ty, p.off ? '#7c7aa8' : '#ffffff'); if (p.note !== undefined) txt(g, p.note, b.x + b.w - 6, ty, p.on ? '#ffe890' : '#9ad0ff', 'right');
      if (p.hp !== undefined) gauge(g, b.x + 7, b.y + 23, b.w - 14, p.hp, p.ally ? '#58d068' : '#e0463c');
    });
    else {
      E.ui.box(g, X + 4, Y, 92, 66, { bg: WIN });
      if (choosing) {
        menu.items.forEach((it, k) => { const y = Y + 5 + k * 10; txt(g, it.label || it, X + 20, y, it.disabled ? '#7c7aa8' : '#ffffff'); if (it.note) txt(g, it.note, X + 89, y, '#9ad0ff', 'right'); });
        px.sprite(g, HAND, X + 6 + (mode === 'command' ? bob : 0), Y + 4 + menu.i * 10);
        E.font.text(g, game.input.label('confirm') + ' OK  ' + game.input.label('cancel') + ' BACK', X + 50, Y + 57, '#a8b8ff', { font: 'tiny', outline: false, align: 'center' });   // the player's own keys
      } else if (mode === 'win') [['EXP', '+180'], ['Gil', '+96'], ['Item', 'Ether']].forEach(([a, b], k) => { txt(g, a, X + 11, Y + 10 + k * 17, '#9ad0ff'); txt(g, b, X + 88, Y + 10 + k * 17, '#ffe08a', 'right'); });
      else alive(foes).forEach((f, k) => { txt(g, f.name, X + 11, Y + 7 + k * 19, '#ffffff'); gauge(g, X + 11, Y + 16 + k * 19, 78, f.hp / f.max, '#e0463c'); });
    }
    // a card per hero (FF IX): portrait, name, MP, HP, ATB
    party.forEach((h, k) => {
      const x = (P ? P.cards : X + 100) + k * 72, on = h === actor && choosing, low = h.hp < h.max / 4, col = h.dead ? '#a08aa8' : low ? '#ffd060' : '#ffffff';
      E.ui.box(g, x, Y, 70, 66, { bg: h.dead ? KO : on ? HOT : WIN, border: on ? '#ffe890' : undefined });
      const pic = h.pic || (h.pic = E.mkCanvas(30, 30));   // a whole rig draw: redrawn every third frame
      if ((frame + k) % 3 === 0) { const pg = E.ctx2d(pic); pg.clearRect(0, 0, 30, 30); h.rig.drawPortrait(pg, 3, 3, 24, { zoom: 2.1, turn: .7, bg: ['#3a4aa8', '#10143a'], tint: h.dead ? '#808080' : undefined }); }
      g.drawImage(pic, x + 2, Y + 2);
      txt(g, h.name, x + 34, Y + 6, col); tiny(g, 'MP', x + 34, Y + 19, '#9ad0ff'); txt(g, h.mp, x + 64, Y + 17, col, 'right');
      tiny(g, 'HP', x + 6, Y + 36, '#9ad0ff'); txt(g, h.hp + '/' + h.max, x + 64, Y + 34, col, 'right'); gauge(g, x + 6, Y + 44, 58, h.hp / h.max, low ? '#e8a030' : '#58d068');
      gauge(g, x + 6, Y + 54, 58, h.atb, h.atb >= 1 || on ? '#ffe060' : '#dce0f8');
    });
    if (mode === 'win') E.font.title(g, 'Victory!', Math.round(r.W / 2) - 36, layout(r.W, r.H).fy - 60, { align: 'center', scale: 3, colors: ['#fffbe8', '#ffe08a', '#ffb347', '#e0662a'], depth: 2 });
  }
  // propSize: props sized to the heroes; a strong warm rim light
  // camera: - / = zoom, [ ] turn the plaza under the painted sky; zoomed in past rest(), it eases to the fight (or the hero on turn) at chest height
  return { view: 'brawler', views: ['brawler'], input: 'DEFAULT', res: 'ps1', pausable: true, touch: [], propSize: 1.3, camera: { zoom: [.75, 2], tall: TALL.zoom, rotate: true },   // touch: taps, no buttons
    back() { if (mode !== 'target') return false; mode = 'command'; A.sfx('cancel'); return true; },   // a phone's back: aiming goes back to the commands
    enter() { start(); game.r.rimAlpha = .75; game.focus(...cam); game.cam.offset = [0, layout(game.W, game.H).fy - game.H / 2]; yaw = game.yaw; },
    exit() { game.r.rimAlpha = .28; L.enabled = false; game.cam.offset = null; },
    update(dt) {
      if (game.yaw !== yaw) game.note((yaw = game.yaw) || game.zoom !== 1 ? 'TURN ' + yaw : 'CAMERA RESET');   // the kit's notice has a degree sign the pixel font lacks
      if (placed !== game.upright) place();   // a phone turned: the camera comes in or out (camera.tall), and the sides close up or open out
      update(dt); const f = game.zoom > rest().zoom + 1e-6 && (act ? [act.who, act.target || act.who] : actor && [actor, actor]), k = Math.min(1, dt * 4);
      const goal = f ? [(f[0].x + f[1].x) / 2, (f[0].y + f[1].y) / 2, 22] : [rest().x, 72, 0]; cam = cam.map((v, i) => lerp(v, goal[i], k)); game.focus(cam[0], cam[1], cam[2]);
      game.cam.offset = [0, layout(game.W, game.H).fy - game.H / 2];   // the battle sits above the HUD band, wherever the band is
    }, draw,
    state: () => ({ mode, actor: actor && actor.name, act: act && act.key, t: act && act.t, hp: all.map(c => c.hp), auto, pads: band && band.pads && band.pads.map(p => p && p.w && { label: p.label, x: p.x, y: p.y, w: p.w, h: p.h }) }) };   // for automated tests
})();
scenes.rpg = RPG;
