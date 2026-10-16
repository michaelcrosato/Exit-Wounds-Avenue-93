/* =====================================================================================
 * SLICE 5  BRAWLER  (Final Fight, Streets of Rage 2). A city block at dusk. Every attack is a named E.MOVES move:
 * J jab, cross, hook, uppercut (an E.Combo; the uppercut launches), J on a foe in your face: collar grab, knee, knee, elbow;
 * K kick, roundhouse; L sweep; Z jumps (J or K in the air: a flying kick). Each foe type has its own telegraphed
 * strings. Heavy blows knock fighters down; they get up on one knee. Waves lock the screen. Crates hide food.
 * THE LOOK: Final Fight sized fighters (90-105 of 240 lines) in a guard stance with big gloves, lit by the nearest
 * light; building fronts drawn once over TileMap walls; solid parked cars; PS1 translucency (hard shapes, one alpha)
 * ANY SCREEN: a wider screen shows more street (waves walk in from past its edges); a taller one (a phone held upright)
 * starts at 1.5x (camera.tall) and lifts the street onto a FOREGROUND wall, clear of the touch buttons, under the skyline
 * ===================================================================================== */
const BRAWL = (() => {
  const T = 16, Y0 = 30, Y1 = 136, TOP = 88, DARK = '#140c1c';   // Y0..Y1: the walkable band; TOP: rooftop room (2x zoom)

  /* ---- LEVEL: a row of buildings, then 8 rows of street ---- */
  const BLOCKS = [['brick', 9, 112, '#8a4434', 'brick'], ['diner', 7, 60, '#d8c4a0', 'plaster'], ['alley', 5, 34, '#5c4c62', 'brick'], ['office', 9, 150, '#626c8a', 'stone'],
    ['pawn', 7, 72, '#5a7a66', 'plaster'], ['metal', 9, 88, '#8a6450', 'none'], ['hotel', 9, 132, '#743246', 'brick']];
  let at = 0; const blocks = BLOCKS.map(([kind, n, h, color, face], i) => { const b = { kind, i, h, color, face, x0: at * T, w: n * T, id: 'abcdefg'[i] }; at += n; return b; });
  const LEN = at * T, LAMPS = [30, 200, 352, 505, 660, 822];
  const SIGNS = [{ b: 1, u: 32, z: 61, text: 'DINER', c: '#ff5aa8' }, { b: 4, u: 98, z: 28, text: 'PAWN', c: '#4ae8ff', v: 1 }, { b: 6, u: 16, z: 50, text: 'HOTEL', c: '#ffd24a', v: 1 }];
  const AWNINGS = [[0, 18, 21, '#3a6ac8'], [1, 24, 27, '#d83a3a'], [1, 60, 27, '#d83a3a']];   // [block, u (centre), z (bottom), stripe color]
  // street furniture [kind, x, y, size | car color]: engine props or FURN; cars are solid
  const STREET = [['trashcan', 46, 25, 1.25], ['firedrum', 84, 27, 1.3], ['hydrant', 196, 146], ['mailbox', 214, 26], ['dumpster', 250, 22], ['bags', 290, 24],
    ['trashcan', 312, 25, 1.25], ['car', 20, 130, '#3a7ac8'], ['dumpster', 566, 22], ['car', 560, 130, '#d8a830'], ['trashcan', 626, 25, 1.25], ['bags', 642, 22],
    ['hydrant', 690, 146], ['firedrum', 700, 26, 1.3]];
  // shapes (docs/ASSETS.md) [id, x, y, facing, scale]: the diner's patio and its delivery crate from the core library, clear
  // of the breakables; cardboard boxes by the second dumpster from the asset store, cut into the page's 'brawler' set
  // (src/assets/sets/brawler.js: none without it)
  const DRESS = [['table', 157, 29, 0, .7], ['chair', 145, 28, 0, .8], ['chair', 169, 31, Math.PI, .8], ['crate', 231, 25, .15, .7], ['sack', 236, 37, .4, .8],
    ...(E.addAssets((window.ASSETS || {}).brawler || { set: 'brawler' }).shapes.length ? [['brawler:box', 586, 21, .4, .95], ['brawler:box-open', 599, 31, -.5, .95]] : [])];
  const DRUMS = STREET.filter(s => s[0] === 'firedrum'), CARS = STREET.filter(s => s[0] === 'car');
  const LIGHTS = [...LAMPS.map(x => ({ x, y: 46, r: 46, c: '#ffb45a' })), ...SIGNS.map(s => ({ x: blocks[s.b].x0 + s.u, y: 20, r: 40, c: s.c })), ...DRUMS.map(([, x, y]) => ({ x, y: y + 6, r: 34, c: '#ff7a2a' }))];
  LIGHTS.forEach(L => { L.rgb = E.hex(L.c); });

  /* ---- FLOOR: floorTex, baked once by the TileMap: shapes, no per-pixel speckle ---- */
  const [SLAB, SLAB2, SEAM, LIP, CURB, CFACE, GUT, TAR, TAR2, YEL, PAINT, IRON, SKYC] = ('#8a8496 #837d90 #5a546c #9e98aa #c4becc #5c566e ' +
    '#1c1826 #3a3450 #4a4262 #e8b440 #d6d2de #2a2636 #8c6a9c').split(' ').map(E.hex);
  const HOLES = [[150, 104], [470, 70], [760, 100]], mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  function floorTex(x, y) {
    let c, wet = 0;
    if (y < 42 || y >= 133) {                   // sidewalks: two rows of slabs, seams leaning like an oblique floor
      const s = y < 42 ? y - 16 : y - 133, row = s < 10 ? 0 : 1, sy = s - row * 10, sx = (x + s * .7) % 24;
      c = sx < 1.3 || sy < 1.6 ? SEAM : sy < 3.2 || sx < 2.6 ? LIP : E.hash2(Math.floor((x + s * .7) / 24), row + (y > 99 ? 7 : 0)) > .6 ? SLAB2 : SLAB;
      if (y < 24) c = c.map(v => v * (.6 + (y - 16) * .05));             // contact shadow under the buildings
    } else if (y < 48.5) c = y < 45 ? CURB : CFACE;                       // curb top (lit), curb face
    else if (y < 51 || y >= 130) c = GUT;                                  // gutters
    else {                                                                // asphalt: wear, paint, manholes, puddles
      c = mixc(TAR, TAR2, E.noise2(x * .012, y * .045) * .8); wet = .4;
      const u = (x % 420 - 230) / (.75 + (y - 51) / 79 * .5);             // crosswalk stripes fan out toward the camera
      if (Math.abs(u) < 30 && (u + 30) % 10 < 5.5 && y > 54 && y < 127) c = PAINT;
      else if (Math.abs(y - 88.5) < .9 || Math.abs(y - 91.5) < .9) c = YEL;
      else { const ax = x % 300 - 150, d = Math.abs(y - 112); if (ax > 0 && (ax < 16 ? d < 1.6 : ax < 26 && d < (26 - ax) * .55)) c = PAINT; }   // lane arrows
      for (const [mx, my] of HOLES) { const d = Math.hypot(x - mx, y - my); if (d < 8) c = d > 7 ? GUT : d % 2.5 < 1.1 ? IRON : TAR2; }
      if (E.noise2(x * .028 + 5, y * .08) > .7) { c = mixc(c, SKYC, .5); wet = 1; }   // puddles mirror the dusk sky
    }
    let [r, g, b] = c;
    for (const L of LIGHTS) {                   // each light: a pool, and on the wet road rippling smears (each row its own width)
      const dx = (x - L.x) / L.r, dy = (y - L.y) / (L.r * .6), d2 = dx * dx + dy * dy, s = Math.sin(y * 1.7 + L.x), w = Math.abs(x - L.x + Math.sin(y * 2.3) * 1.5) / (1.5 + 5 * s * s);
      let k = d2 < 1 ? (1 - d2) * (1 - d2) * .8 : 0;
      if (wet && y > 52 && w < 1) k += (1 - w) * wet * Math.max(0, 1 - (y - 52) / 85) * 1.3;
      r += k * L.rgb[0] * (r / 200 + .12); g += k * L.rgb[1] * (g / 200 + .12); b += k * L.rgb[2] * (b / 200 + .12);
    }
    return [r, g, b];
  }

  /* ---- SKY: dusk gradient, parallax skyline, stars, moon, flat clouds ---- */
  const STOPS = ['#150c30', '#301a52', '#62265e', '#a83a5e', '#e2685a', '#ffa868', '#ffd08a'];
  const SKY = Array.from({ length: 36 }, (_, i) => { const t = Math.min(1, i / 23) * 6, k = Math.min(5, Math.floor(t)); return E.mix(STOPS[k], STOPS[k + 1], t - k); });
  const bg = new E.Backdrop({ sky: SKY, stars: 36, starsY: .22, layers: [{ kind: 'city', color: '#5e3464', y: .6, height: .3, parallax: .05, windows: '#ffc070' },
    { kind: 'city', color: '#3a2248', y: .66, height: .25, parallax: .12, windows: '#ffe08a', seed: 7 }] });
  function skyDetail(g, r) {
    const mx = Math.round(236 - r.ix * .01);
    px.blend(g, .125, 'add', () => { px.disc(g, mx, 30, 26, '#ffd8c0'); px.disc(g, mx, 30, 17, '#ffd8c0'); }); px.disc(g, mx, 30, 9, '#fff4e0'); px.disc(g, mx + 4, 27, 8, SKY[4]);
    const wrap = Math.max(520, r.W + 190);   // the clouds wrap round past the widest screen
    for (const [cx, cy, w] of [[40, 50, 80], [190, 38, 54], [300, 62, 96], [420, 46, 64]]) {
      const x = ((cx - r.ix * .03) % wrap + wrap) % wrap - 90;
      px.ell(g, x, cy, w / 2, 4, '#5a2a60'); px.ell(g, x + w * .12, cy - 3, w / 3, 4, '#6a3068'); px.ell(g, x + 3, cy + 2, w / 2 - 6, 2, '#d8686c');
    }
  }

  /* ---- FACADES: drawn once per view and zoom into an image over the TileMap wall (u: from the left, z: up) ---- */
  const fronts = {};
  function front(b) {
    const v = game.view, key = v.id + v.scale + b.i; if (fronts[key]) return fronts[key];
    const kx = v.ax, kz = -v.bz, W = Math.round(b.w * kx), H = Math.round(b.h * kz) + TOP, cv = E.mkCanvas(W, H), g = E.ctx2d(cv);   // TOP: room for rooftop things
    const t = E.tones(b.color), rnd = E.rng(b.i * 31 + 7), X = u => Math.round(u * kx), Y = z => H - Math.round(z * kz), k = b.kind, glaze = (a, fn) => px.blend(g, a, 'normal', fn);
    const R = (u, z, w, h, c) => px.rect(g, X(u), Y(z + h), Math.max(1, X(u + w) - X(u)), Math.max(1, Y(z) - Y(z + h)), c);
    if (k === 'metal') for (let x = 0; x < W; x += 3) { px.rect(g, x, TOP, 1, H - TOP, t.lt); px.rect(g, x + 2, TOP, 1, H - TOP, t.sh); }   // corrugated ribs
    const win = (u, z, w, h, o = {}) => {                    // recessed window: reveal, lit room or sky, sash, sill, stain
      R(u - 1, z - 1, w + 2, h + 2, t.deep);
      if (rnd() < (o.lit || .55)) {
        R(u, z, w, h, '#ffc46c'); R(u, z + h - 2, w, 2, '#fff0b4');
        if (rnd() < .6) for (const q of [u, u + w * .72]) R(q, z, w * .28, h, o.curtain || '#a8404a'); else for (let q = z + h - 2; q > z; q -= 2) R(u, q, w, .5, '#d89a50');   // curtains or blinds
        if (rnd() < .3) { const sx = X(u + w * .5), sy = Y(z + h * .5); px.rect(g, sx - 4, sy, 9, Y(z) - sy, '#3a1c28'); px.disc(g, sx, sy - 3, 3, '#3a1c28'); }   // someone at home
      } else { R(u, z, w, h, '#28304e'); px.line(g, X(u + w * .2), Y(z + 1), X(u + w * .55), Y(z + h - 1), '#4c5a88'); }
      R(u + w / 2 - .5, z, 1, h, o.frame || '#d8d0c4'); R(u, z + h * .5, w, 1, o.frame || '#d8d0c4');
      if (o.arch) { R(u - 2, z + h + 1, w + 4, 2.4, '#c8b8a0'); R(u + w / 2 - 1.5, z + h + .6, 3, 3.6, '#ece0cc'); }
      R(u - 2, z - 2.6, w + 4, 1.6, t.lt); glaze(.375, () => R(u - 2, z - 3.6, w + 4, 1, DARK)); glaze(.125, () => R(u + 1, z - 16, w - 2, 13, DARK));
    };
    const door = (u, w, h, c) => { const d = E.tones(c); R(u - 1.5, 0, w + 3, h + 1.5, t.deep); R(u, 0, w, h, c); R(u, 0, 1, h, d.lt); R(u + 1.5, h * .5, w - 3, h * .36, '#ffd68c'); R(u + w / 2 - .4, h * .5, .8, h * .36, d.sh); R(u - 4, 0, w + 8, 1.6, '#a8a2ac'); };
    const cornice = z => { glaze(.5, () => R(0, z - 3, b.w, 2, DARK)); R(-1, z, b.w + 2, 3, t.lt); R(-1, z + 3, b.w + 2, 1, t.hi); for (let u = 1; u < b.w; u += 4) R(u, z - 1.4, 2, 1.4, t.lt); };
    const pipe = u => { R(u, 0, 1.6, b.h - 2, '#4a4a5a'); R(u, 0, .6, b.h - 2, '#70708a'); for (let z = 12; z < b.h; z += 24) R(u - .7, z, 3, 1, '#262434'); };
    const poster = (u, z, c, s) => { R(u, z, 14, 17, '#e8dcc4'); R(u + 1.5, z + 8, 11, 7.5, c); E.font.text(g, s, X(u + 7), Y(z + 6.5), '#2a1420', { font: 'tiny', align: 'center', outline: false }); px.poly(g, [[X(u + 14), Y(z)], [X(u + 14) - 6, Y(z)], [X(u + 14), Y(z) - 6]], t.sh); };
    const shutter = (u, w, h, open) => { R(u - 1.5, 0, w + 3, h + 1.5, t.deep); R(u, open, w, h - open, '#8e929e'); for (let z = open + 1; z < h; z += 1.6) R(u, z, w, .6, '#5e626e'); R(u, 0, w, open, '#ffd890'); };
    if (k === 'brick') {                                      // tenement: arched windows, fire escape, shop window, stoop
      for (const z of [34, 60, 86]) for (let u = 10; u < b.w - 12; u += 25) win(u, z, 11, 16, { arch: 1 });
      win(8, 6, 20, 13, { lit: 1, curtain: '#3a6ac8' }); win(b.w - 30, 8, 13, 12); door(b.w / 2 - 7, 14, 24, '#5a2e22'); cornice(b.h - 6); pipe(b.w - 3);
      for (const [dx, dz, c, a] of [[1.6, -2.4, DARK, .375], [0, 0, '#2e2a3c', 1]]) glaze(a, () => [30, 56, 82].forEach((z, n) => {   // fire escape; a translucent copy is its shadow
        const u0 = b.w - 64 + dx; R(u0, z + dz, 46, 1.6, c); R(u0, z + dz + 8, 46, .8, c); for (let q = u0; q <= u0 + 46; q += 3) R(q, z + dz, .7, 8, c);
        if (n) px.line(g, X(u0 + 34), Y(z + dz), X(u0 + 14), Y(z + dz - 18), c, 2);
      }));
    } else if (k === 'diner') {                               // diner: lit counter, stools, shelves; a water tower
      R(0, 0, b.w, 5, t.sh); R(0, 5, b.w, 1, t.lt);          // plinth
      R(4.5, 4, b.w - 37, 27, '#c8c8d4'); R(6, 5.5, b.w - 40, 24, '#ffd9a0'); R(6, 23, b.w - 40, 6.5, '#fff0c8'); R(6, 12, b.w - 40, 4, '#9a3a2a'); R(6, 16, b.w - 40, 1.5, '#f0e8d8');
      for (let u = 8; u < b.w - 36; u += 3) R(u, 19.5, 1.6, 2.2, ['#4ab0e0', '#e04a4a', '#60c050', '#f0c040'][Math.round(u / 3) % 4]);
      for (let u = 10; u < b.w - 36; u += 8) { R(u, 5.5, .8, 6, '#6a6a78'); R(u - 1.6, 11, 4, 1.4, '#d83a3a'); }
      glaze(.5, () => { px.line(g, X(12), Y(6), X(20), Y(28), '#ffffff', 2); px.line(g, X(22), Y(6), X(27), Y(28), '#ffffff'); });
      door(b.w - 26, 14, 24, '#8a2a2a'); glaze(.375, () => R(2, 20, b.w - 30, 7, DARK));   // awning shadow
      for (let u = 14; u < b.w - 10; u += 30) win(u, 44, 12, 10, { frame: '#f0e8d8', curtain: '#3a8a6a' });
      const wx = b.w * .72, wt = E.tones('#8a5a3a'); cornice(b.h - 4); for (const q of [-8, 7]) R(wx + q, b.h, 1.2, 11, '#2a2030');
      R(wx - 10, b.h + 11, 20, 14, wt.base); for (let q = wx - 9; q < wx + 10; q += 3) R(q, b.h + 11, .6, 14, wt.sh); R(wx - 10, b.h + 11, 2, 14, wt.lt); R(wx - 10, b.h + 17, 20, .8, '#3a3040');
      px.poly(g, [[X(wx - 11), Y(b.h + 25)], [X(wx + 11), Y(b.h + 25)], [X(wx), Y(b.h + 31)]], wt.deep);
    } else if (k === 'alley') {                               // alley: posters, a spray-painted tag
      poster(4, 18, '#3a8ad8', 'FIGHT'); poster(19, 16, '#d8383a', 'LIVE'); pipe(b.w - 5);
      const gx = X(b.w * .66), gy = Y(24);
      E.font.title(g, 'SKULLZ', gx, gy, { scale: 2, align: 'center', colors: ['#8af4ff', '#2aa0e0'], outline: '#1a0a2a', depth: 2, depthColor: '#ff3a9a', shine: false });
    } else if (k === 'office') {                              // offices: window grid, a lit lobby
      for (let z = 34; z < b.h - 8; z += 24) { R(0, z - 4, b.w, 2.4, t.lt); glaze(.375, () => R(0, z - 5, b.w, 1, DARK)); for (let u = 5; u < b.w - 4; u += 24) win(u, z, 14, 15, { frame: '#9aa4c0', lit: .4, curtain: '#8a9ab0' }); }
      R(24, 0, b.w - 48, 25, '#1c2236'); R(26, 0, b.w - 52, 23, '#f2e2b4'); R(26, 17, b.w - 52, 6, '#fff6d8'); for (let u = 26; u < b.w - 26; u += 12) R(u, 0, 1, 23, '#3a4460');
      R(20, 25, b.w - 40, 7, '#2a3048'); E.font.text(g, 'ACME TOWER', X(b.w / 2), Y(31), '#e8ecf8', { align: 'center', outline: false });
    } else if (k === 'pawn') {                                // pawn shop: shutter, sign board, barred door
      R(0, 0, b.w, 5, t.sh); R(0, 5, b.w, 1, t.lt);
      shutter(8, 52, 28, 6); door(b.w - 34, 14, 24, '#3a4a44'); for (let u = b.w - 32; u < b.w - 20; u += 2.5) R(u, 12, .6, 8, '#1a1a22');
      R(8, 32, 52, 10, '#1c3a30'); R(8, 32, 52, 1, t.lt); E.font.title(g, 'LOANS', X(34), Y(40.5), { scale: 1, align: 'center', colors: ['#ffe8a0', '#e0a040'], depth: 1, shine: false });
      for (let u = 10; u < b.w - 20; u += 28) win(u, 50, 13, 13, { curtain: '#c89a3a' });
      cornice(b.h - 5); poster(66, 30, '#ffd040', 'SALE');
    } else if (k === 'metal') {                               // warehouse: roller door, high windows
      shutter(12, 64, 42, 0); R(0, b.h - 3, b.w, 3, t.deep); pipe(b.w - 4);
      for (let u = 84; u < b.w - 8; u += 16) win(u, 64, 11, 8, { lit: .3, frame: '#5a5a66' });
    } else {                                                  // hotel: tall windows, a marquee with bulbs
      for (const z of [36, 60, 84, 108]) for (let u = 32; u < b.w - 10; u += 22) win(u, z, 10, 15, { frame: '#e8d8b0', curtain: '#6a2a8a', lit: .65 });
      R(60, 0, 40, 25, '#2a1420'); R(62, 0, 36, 23, '#ffcf8a'); R(79.5, 0, 1, 23, '#8a5a3a'); glaze(.375, () => R(50, 21, 60, 6, DARK)); R(48, 27, 64, 6, '#2a1a2a'); R(48, 33, 64, 1, '#d8b060');
      for (let u = 50; u < 112; u += 3) R(u, 28.5, 1, 1, '#fff0b0');
      E.font.text(g, 'GRAND HOTEL', X(80), Y(32.6), '#ffe8b0', { align: 'center', outline: false }); cornice(b.h - 7); pipe(b.w - 4);
    }
    glaze(.125, () => { R(0, 0, b.w, 16, DARK); R(0, 0, b.w, 9, DARK); R(0, 0, b.w, 4, DARK); });   // street grime: stepped translucent bands
    return (fronts[key] = cv);
  }

  /* ---- STREET: engine props; our own lamps, signs and furniture ---- */
  // our fixed pixel art is drawn once at 1x into a 150 x 176 image (the feet at 75, 164), then scaled whole-pixel with the
  // camera zoom like the engine's props. mode 'add': a light, added onto the scene
  const ART = {};
  function art(g, key, sx, sy, fn, mode = 'normal') {
    const cv = ART[key] || (ART[key] = E.mkCanvas(150, 176)), z = game.zoom;
    if (!cv.done) { fn(E.ctx2d(cv), 75, 164); cv.done = 1; }
    px.blend(g, 1, mode, () => g.drawImage(cv, Math.round(sx - 75 * z), Math.round(sy - 164 * z), Math.round(150 * z), Math.round(176 * z)));
  }
  function lamp(g, sx, sy, light) {              // iron post, globe; light: a cone and 3 halos washing the facade
    const top = sy - 116, i = E.tones('#2e2a40');
    if (light) return px.blend(g, .125, 'add', () => { px.poly(g, [[sx - 6, top + 6], [sx + 6, top + 6], [sx + 48, sy + 8], [sx - 48, sy + 8]], '#ffc070'); for (const [R, c] of [[46, '#ff8a3a'], [32, '#ffa850'], [18, '#ffd890']]) px.disc(g, sx, top, R, c); });
    px.rect(g, sx - 6, sy - 12, 13, 12, i.sh); px.rect(g, sx - 2, top + 9, 4, sy - top - 21, i.base); px.rect(g, sx - 2, top + 9, 1, sy - top - 21, i.lt); px.rect(g, sx - 4, top + 7, 9, 4, i.deep);
    px.disc(g, sx, top, 8, '#e89850'); px.disc(g, sx - 1, top - 1, 6.5, '#ffe6a8'); px.disc(g, sx - 2, top - 2, 3, '#ffffff');   // globe: warm rim, hot core
    px.poly(g, [[sx - 6, top - 6], [sx + 6, top - 6], [sx, top - 12]], i.base); px.rect(g, sx - 6, top - 7, 13, 2, i.deep); px.dot(g, sx, top - 14, i.lt);   // cap, finial
  }
  function neon(g, sx, sy, s, on, light) {       // neon: dark board, outlined letters; light: its halo (on flickers)
    const ch = s.v ? [...s.text] : [s.text], sc = s.v ? 1 : 2, w = s.v ? 15 : E.font.width(s.text, sc) + 14, h = s.v ? ch.length * 10 + 5 : 22;
    if (light) return px.blend(g, .25, 'add', () => { px.ell(g, sx, sy - h / 2, w / 2 + 12, h / 2 + 10, s.c); px.ell(g, sx, sy - h / 2, w / 2 + 5, h / 2 + 4, s.c); });
    E.ui.box(g, sx - w / 2, sy - h, w, h, { bg: ['#2a1036', '#0c0412'], border: E.shade(s.c, -.45), shadow: '#0a0410' });
    ch.forEach((c, i) => E.font.text(g, c, sx, sy - h + 4 + i * 10, on ? '#ffffff' : E.shade(s.c, -.55), { align: 'center', scale: sc, outline: on ? s.c : false }));
  }
  const FURN = {                                 // (x, y) = feet on the screen
    bags: (g, x, y) => { for (const [dx, rr] of [[-7, 6], [6, 7], [0, 5]]) { px.disc(g, x + dx, y - rr, rr, '#1e2a26'); px.disc(g, x + dx - 2, y - rr - 2, rr * .45, '#3e5048'); } },
    dumpster: (g, x, y) => { const t = E.tones('#2e6a4a'); px.rect(g, x - 24, y - 28, 48, 26, t.base); px.rect(g, x - 24, y - 28, 48, 3, t.lt); for (let q = -18; q < 24; q += 8) px.rect(g, x + q, y - 24, 2, 20, t.sh); px.poly(g, [[x - 26, y - 28], [x + 26, y - 28], [x + 21, y - 34], [x - 21, y - 34]], t.deep); },
    mailbox: (g, x, y) => { const t = E.tones('#2a5ab0'); px.rect(g, x - 1, y - 8, 3, 8, '#1e2030'); px.rect(g, x - 9, y - 30, 19, 23, t.base); px.ell(g, x, y - 30, 9.5, 4, t.lt); px.rect(g, x + 6, y - 30, 4, 23, t.sh); px.rect(g, x - 5, y - 21, 9, 6, '#e8e4d8'); },
    car
  };
  function car(g, x0, y0, c) {                   // a sedan in its own image: silhouette, bands inside it (source-atop), chrome, wheels
    const t = E.tones(c), B = (x, z, w, h, k) => px.rect(g, x0 + x, y0 - z, w, h, k), P = (k, ...p) => px.poly(g, p.map(([x, z]) => [x0 + x, y0 - z]), k);
    px.blend(g, .5, 'normal', () => B(-68, 7, 136, 9, DARK));
    P(t.base, [-68, 7], [-68, 20], [-62, 31], [-35, 31], [-26, 47], [16, 47], [38, 31], [61, 30], [68, 16], [68, 7]);
    px.blend(g, 1, 'source-atop', () => {        // tops, roof, glass (sky over a dark cabin), shading, chrome
      B(-68, 31, 136, 8, t.lt); B(-30, 47, 49, 7, t.hi); B(-40, 40, 80, 17, '#4a3a6a'); B(-40, 30, 80, 7, '#1c1830');
      P('#9a86c0', [-40, 23], [-28, 40], [-26, 47], [-35, 31]); P('#9a86c0', [36, 23], [20, 40], [16, 47], [38, 31]);
      B(-68, 23, 136, 1, t.hi); B(-68, 12, 136, 5, t.sh); B(-68, 16, 136, 1, '#ececf6');
    });
    B(-28, 40, 48, 1, '#b8b8ca'); B(-6, 40, 4, 17, '#b8b8ca'); for (const q of [-27, 8]) px.line(g, x0 + q, y0 - 24, x0 + q + 8, y0 - 38, '#c8b8f0');
    for (const q of [-70, 62]) { B(q, 12, 8, 5, '#a8a8ba'); B(q, 12, 8, 1, '#ffffff'); } B(-68, 20, 3, 5, '#e0302a'); B(65, 19, 3, 4, '#fff0a0');   // bumpers, lights
    for (const q of [x0 - 43, x0 + 43]) { px.disc(g, q, y0 - 8, 11.5, '#0e0a14'); px.disc(g, q, y0 - 8, 9.5, '#2a2630'); px.disc(g, q, y0 - 8, 5.5, '#a8a8ba'); px.dot(g, q - 1, y0 - 10, '#ffffff'); }
  }

  /* ---- CAST: HD Humanoids sized like Final Fight sprites ---- */
  const BASE = { weapon: null, speedRef: 40, footSpread: 4 };
  const HERO = { size: 2.3, build: 'bulky', hair: 'short', sleeves: 'none', hunch: .12, hat: { style: 'band', color: '#e0302a' },
    colors: { skin: '#e8b088', hair: '#5a3220', cloth: '#f2eee4', pants: '#3a64c8', boot: '#6a3a22', belt: '#3a2a20', glove: '#c83a2a' } };
  // each foe type fights its own way: strings of E.MOVES it picks from. The first blow of a string winds up slowly (wind:
  // the telegraph that lets the player read it and step out or strike first); follow-ups come faster
  const FOES = {   // swap: a second copy's palette and name (a palette-swap enemy)
    punk: { name: 'RAZOR', hp: 8, r: 6, speed: 50, wind: .24, moves: [['jab', 'cross'], ['jab', 'jab', 'cross']], swap: { hair: '#4ae0ff', cloth: '#6a2a5a' }, swapName: 'SID',
      rig: { size: 2.15, build: 'heroic', hair: 'spiky', sleeves: 'none', hunch: .2, colors: { skin: '#d8a078', hair: '#ff4a8a', cloth: '#2c3a6a', pants: '#4a4262', boot: '#241a2e', belt: '#b8b8c8' } } },
    kicker: { name: 'VINNIE', hp: 12, r: 6, speed: 40, wind: .3, moves: [['roundhouse'], ['sweep'], ['roundhouse', 'sweep']], rig: { size: 2.3, build: 'heroic', outfit: 'coat', sleeves: 'long', stubble: '#9a7058', hat: { style: 'cap', color: '#3a3a4c' },
      colors: { skin: '#e0ae88', hair: '#2a1a14', cloth: '#c8a060', coat: '#8a6a3e', pants: '#50506a', boot: '#2e2420' } } },
    brute: { name: 'TANK', hp: 18, r: 8, speed: 30, wind: .36, moves: [['haymaker'], ['bash'], ['bash', 'haymaker']], rig: { size: 2.55, build: 'bulky', hair: 'bald', sleeves: 'none', hunch: .3,
      colors: { skin: '#b07850', cloth: '#b83a2a', pants: '#5e7040', boot: '#3a2a1a', belt: '#d8b040' } } },
    boss: { name: 'BARON', hp: 50, r: 8, speed: 44, wind: .26, moves: [['cross', 'hook', 'haymaker'], ['elbow', 'uppercut'], ['axekick'], ['roundhouse', 'sweep']],
      rig: { size: 2.6, build: 'bulky', outfit: 'coat', sleeves: 'long', hair: 'short', shades: 1,
      colors: { skin: '#dca880', hair: '#e8e8f0', cloth: '#4a3a6a', coat: '#9a2e62', trim: '#f0c850', pants: '#4a4268', boot: '#2a2234', belt: '#f0c850', glove: '#3a3048' } } }
  };
  const NPCS = [   // a drifter warming his hands ('cast')
    { x: 100, y: 28, face: Math.PI, pose: 'cast', rig: { size: 2.1, build: 'heroic', outfit: 'coat', sleeves: 'long', hunch: .5, hat: { style: 'cap', color: '#3a3a44' }, stubble: '#8a8078', colors: { skin: '#c89878', hair: '#8a8a8a', cloth: '#5a6a4a', coat: '#6a5a4a', pants: '#4a4a52', boot: '#2a2420' } } },
];
  // E.MOVES tuned for 100 px fighters seen from the side (spec overrides): kicks wind up with the knee tucked against the
  // body (reach .1, r0 0) and the foot shoots out only on the strike (r1). The roundhouse loads the leg back (a0, z0: no
  // knee pushed into the target), whips it round to head height and lands late, leg straight, hips turned harder than the
  // waist-high front kick; the sweep and the bent-arm hook stay across the screen; the axe kick lands on the way down from
  // overhead (hitAt) and ends low; the brute's bash is a raised double-fist smash, the haymaker cocks behind the shoulder.
  // GRAB (the clinch opener): the lead hand takes the collar
  const TUNE = { kick: { reach: .1, r0: 0, r1: 6.5, z0: .9, z1: 1.1 }, roundhouse: { reach: .1, r0: 0, r1: 8.5, a0: 2.6, z0: .15, hold: .12, twist: 2.2, hitAt: .5 },
    sweep: { reach: .1, r0: 0, r1: 7.5, a0: 1.1, a1: -.45, active: .22, hold: .6, lean: 0 }, axekick: { reach: .1, r0: 2, r1: 5, z1: .15, hitAt: .06, lean: -.5 },
    hook: { reach: 5.4, a0: 1.9 }, bash: { plane: 'side', a0: 2, a1: -.4 }, haymaker: { a0: 2.7, z0: -2 } };
  const GRAB = { name: 'grab', rel: true, hand: 'L', a0: .3, a1: .05, z0: -1, z1: .4, r0: 3, r1: 6, wind: .06, active: .08, recover: .3, hold: .9, lunge: .8, blade: 0, hitAt: .4 };
  const move = (m, o) => new E.Attack(m, Object.assign({}, TUNE[m], o));
  const WAVES = [{ x: 7, foes: ['punk', 'punk'] }, { x: 20, foes: ['kicker', 'punk', 'punk'] }, { x: 33, foes: ['brute', 'punk', 'kicker'] }, { x: 46, foes: ['boss', 'punk'] }];
  const BOXES = [[11, 40, 'crate'], [22, 44, 'barrel'], [31, 40, 'crate'], [43, 46, 'barrel']];   // breakables: [tile x, y, prop]
  // what each move does when it lands: [damage, knockback, lift]. A lift takes the target off its feet: it flies, lies down,
  // gets up. The axe kick drives its victim down where it stands. A foe string's early blows only rock the hero
  const BLOW = { jab: [2, 10, 0], cross: [2, 15, 0], hook: [3, 25, 0], uppercut: [4, 110, 220], knee: [3, 0, 0], elbow: [3, 110, 0], kick: [3, 35, 0],
    roundhouse: [4, 130, 160], flyingkick: [4, 130, 170], sweep: [3, 50, 120], haymaker: [6, 120, 180], bash: [5, 160, 0], axekick: [6, 15, 70] };
  const MEAT = E.sprite(['..oooooo..', '.oOhhOOOo.', 'oOhhOOOOdo', 'oOOOOOOOdo', '.oOOOOOddo', 'w.oooooo.w', 'Ww......wW', 'pppppppppp'],
    { o: '#5a2810', O: '#c8702a', h: '#f4b868', d: '#8a4418', w: '#f4ecd8', W: '#b8ac98', p: '#e8e8f4' }, 2);   // roast chicken: heals
  const SMEAR = ['#ffffff', '#fff2c8', '#ffd07a', '#e8904a'];   // punch and kick streaks: warm, like the hit sparks
  const TXT = { outline: false, shadow: '#08060e' }, TXC = Object.assign({ align: 'center' }, TXT), TXR = Object.assign({ align: 'right' }, TXT);
  const INTRO = 1.9, TAUNT = 'Nice moves, kid. Shame this street is MINE.';
  const pose = (a, k = .25) => a + (Math.cos(a) > 0 ? k : -k);    // turn a bit toward the camera
  const talk = new E.Dialog(game, { bg: ['#4a1436', '#12040c'], border: '#f0b0c8', nameColor: '#f0c850' });
  const puffs = [], sparks = [];
  let map, SPR, hero, foes, npcs, boxes, foods, wave, lockX, go, intro, score, won, target, tgtT, lag, chain, chainT;
  // the walkable street's right end: the wave's lock, never short of the screen's right edge where the street starts (a wide
  // screen shows more of it); the camera stops there too, so the hero can reach every bit of street on the screen
  const lockEnd = v => Math.min(LEN - 10, Math.max(lockX, (map.bounds(v).x0 + 8 + game.W) / v.ax - 10));

  /* ---- DRAWING A FIGHTER ---- */
  // a Humanoid subclass adds a painted layer; drawPortrait() calls draw() too. E.charView: the rig's view
  class Fighter extends E.Humanoid { draw(g, ox, oy, view) { super.draw(g, ox, oy, view); detail(this, g, ox, oy, E.charView(view)); } }
  const RIM = E.mkCanvas(8, 8), rimG = E.ctx2d(RIM);
  function lightAt(x, y) {                       // nearest lamp, sign or fire (color, side, strength), else cool sky
    let L = null, k = 0; for (const q of LIGHTS) { const v = 1 - Math.hypot((x - q.x) / (q.r * 1.5), (y - q.y) / q.r); if (v > k) { k = v; L = q; } }
    return L ? { c: L.c, side: L.x > x ? 1 : -1, k } : { c: '#9a8ae0', side: -1, k: .25 };
  }
  function fighter(r, c, o = {}) {               // r.actor draws into a scratch image: tint the figure, then rim-light it
    const L = lightAt(c.x, c.y);
    r.actor(c.x, c.y, c.z, (g, ox, oy) => {
      const S = g.canvas.width; if (RIM.width !== S) RIM.width = RIM.height = S;
      c.rig.draw(g, ox, oy, r.view);
      px.blend(g, .25 * L.k, 'source-atop', () => px.rect(g, 0, 0, S, S, L.c));   // tint; rim: the pixels whose neighbour toward the light is empty
      px.blend(rimG, 1, 'copy', () => rimG.drawImage(g.canvas, 0, 0)); px.blend(rimG, 1, 'destination-out', () => rimG.drawImage(g.canvas, -L.side, 0));
      px.blend(rimG, 1, 'source-in', () => px.rect(rimG, 0, 0, S, S, L.c));
      px.blend(g, .25 + .5 * L.k, 'normal', () => g.drawImage(RIM, 0, 0)); px.reset(g);
    }, Object.assign({ rim: false }, o));
  }
  // the layer (face, muscles, gloves) sits on the rig's skeleton, so it turns with it; k scales pixel sizes
  function detail(rig, g, ox, oy, view) {
    if (rig.downW > .3) return;                  // lying flat: the rig alone
    const J = rig.J, o = rig.o, C = rig.C, u = view.scale * o.size, R = o.headR, r = R * u * .93, k = u / 3.4, q = Math.max(1, Math.round(k));
    const sk = E.tones(C.skin), gt = E.tones(C.glove || C.skin), ht = E.tones(C.hair), hd = ht.deep;
    const S = (p, f = 0, s = 0, z = 0) => { const w = rig.worldOffset([p[0] + f, p[1] + s, p[2] + z]), v = view.p(w[0], w[1], w[2]); return [Math.round(ox + v[0]), Math.round(oy + v[1]), view.depth(w[0], w[1], w[2])]; };
    const near = S(J.shR)[2] > S(J.shL)[2] ? 1 : -1, N = near > 0 ? 'R' : 'L', F = (f, s, z) => S(J.head, f * R, s * R, z * R), H = S(J.head), fw = Math.sign(F(1, 0, 0)[0] - H[0]) || 1, hurt = rig.hurtW > .5;
    const fm = F(.42, near * .12, -.22), cn = F(.72, near * .05, -.92), n0 = F(.95, 0, .1), n1 = F(1.12, near * .05, -.2), m = F(.92, near * .05, -.5);
    px.disc(g, fm[0], fm[1] + 1, r * .78, sk.sh); px.disc(g, cn[0], cn[1], r * .36, sk.sh);          // a face plate and a square jaw over the rig's round head
    px.disc(g, fm[0] - fw * .5, fm[1], r * .72, sk.base); px.disc(g, cn[0] - fw * .5, cn[1] - 1, r * .3, sk.base);
    if (o.hair.style !== 'bald') { const hl = F(.55, near * .1, .52); px.line(g, hl[0] - fw * r * .6, hl[1] + 1, hl[0] + fw * r * .35, hl[1] - 1, ht.sh, 2); }
    if (o.shades) {                             // shades: two lenses on a bridge, glints
      const a = F(.9, -.4, .1), b = F(.9, .4, .1), w = Math.round(3.4 * k); px.line(g, a[0], a[1], b[0], b[1], '#141018');
      for (const e of [a, b]) if (e[2] >= H[2]) { px.rect(g, e[0] - (w >> 1), e[1] - 1, w, 1 + q, '#141018'); px.rect(g, e[0] - (w >> 1) + 1, e[1] - 1, q, 1, '#e8f0ff'); }
    }
    else for (const s of [-1, 1]) {              // eyes: lid, white, pupil; brows low inside: a scowl
      const e = F(.84, s * .4, .06), b0 = F(.92, s * .1, .34), b1 = F(.8, s * .72, .46); if (e[2] < H[2]) continue;
      const w = Math.round((s === near ? 2.8 : 1.8) * k), h = Math.max(2, Math.round(1.7 * k)), x = e[0] - (w >> 1), y = e[1] - (h >> 1);
      if (rig.blink > 0 && !hurt) { px.rect(g, x, y, w, h, '#f4efe6'); px.rect(g, fw > 0 ? x + w - q : x, y, q, h, C.eye); px.rect(g, x, y - 1, w, 1, hd); }
      else px.rect(g, x, y + h - 1, w, q, hd);
      px.line(g, b0[0], b0[1] + (hurt ? -1 : 1), b1[0], b1[1], hd, q + 1);
    }
    px.line(g, n0[0], n0[1], n1[0], n1[1], sk.sh); px.dot(g, n1[0] - fw, n1[1] + 1, sk.deep); px.dot(g, n0[0] - fw, n0[1], sk.lt);
    const mw = Math.round(3.2 * k) + 1, mx = m[0] - (mw >> 1);
    if (hurt) { px.rect(g, mx, m[1] - q, mw, 2 * q + 1, '#3a1016'); px.rect(g, mx, m[1] - q, mw, q, '#f4efe6'); }              // a yell: open, teeth showing
    else if (rig.atk) { px.rect(g, mx - 1, m[1] - 1, mw + 2, 3, sk.deep); px.rect(g, mx, m[1], mw, 1, '#f4efe6'); }            // a punch: gritted teeth
    else { px.rect(g, mx, m[1], mw, 1, sk.deep); px.rect(g, mx + 1, m[1] + 1, mw - 2, 1, sk.lt); px.dot(g, fw > 0 ? mx + mw : mx - 1, m[1] + 1, sk.deep); }   // hard line, lit lip, corner down
    if (o.stubble) { const j0 = F(.4, near * .7, -.5), j1 = F(.85, near * .1, -.72); px.line(g, j0[0], j0[1], j1[0], j1[1], o.stubble, 2); }
    if (o.sleeves === 'none') {                  // the bare near arm: deltoid and biceps
      const sh = S(J['sh' + N]), el = S(J['elbow' + N]);
      [sh, [(sh[0] + el[0]) / 2, (sh[1] + el[1]) / 2]].forEach((p, i) => { const rr = (1.25 - i * .2) * u; px.disc(g, p[0], p[1], rr, sk.sh); px.disc(g, p[0] - 1, p[1] - 1, rr - 1.3, sk.base); px.dot(g, p[0] - rr * .45, p[1] - rr * .5, sk.lt); });
    }
    for (const s of ['L', 'R']) {                // big gloves, the key read in a brawler
      const h = S(J['hand' + s]), e = S(J['elbow' + s]); if (h[2] < S(J.shC)[2] - 1 && rig.atk !== s) continue;   // far fist: behind the body (unless it strikes)
      const l = Math.hypot(h[0] - e[0], h[1] - e[1]) || 1, ux = (h[0] - e[0]) / l * u, uy = (h[1] - e[1]) / l * u, x = h[0] + ux * .4, y = h[1] + uy * .4;
      px.disc(g, x, y, 1.45 * u, gt.deep); px.disc(g, x - .6, y - .6, 1.2 * u, gt.base); px.disc(g, x - u * .45, y - u * .5, .5 * u, gt.lt);
      px.line(g, x - uy * .6, y + ux * .6, x + ux * .2, y + uy * .2, gt.sh);
    }
  }

  /* ---- GAME ---- */
  const fighterRig = (...o) => new Fighter(Object.assign({}, BASE, ...o));
  // a fighter: stun (flinching), knocked (off its feet), down / floor (lying, time left), rise (getting up), act (its move), grip (friction)
  const body = (x, y, r, extra) => Object.assign(new E.Body({ x, y, r }), { facing: 0, flash: 0, inv: 0, stun: 0, down: 0, floor: 0, rise: 0, t: 0, act: null }, extra);
  function start() {
    map = map || new E.TileMap({ rows: [blocks.map(b => b.id.repeat(b.w / T)).join(''), ...Array(8).fill('.'.repeat(LEN / T))], ao: 0, floorTex,
      legend: Object.fromEntries(blocks.map(b => [b.id, b.i + 1])),
      // wall face material, brick course height, roof; sideLt: the lit front's color
      types: Object.fromEntries(blocks.map(b => [b.i + 1, { h: b.h, side: b.color, sideLt: b.color, top: E.shade(b.color, -.45), face: b.face, course: b.face === 'brick' ? 3 : undefined, roof: 'slab' }])) });
    SPR = { crate: E.prop('crate', { size: .8 }).frames[0], barrel: E.prop('barrel', { size: .8, color: '#9a6030' }).frames[0] };
    // the camera scrolls sideways, the street's front edge on the screen bottom (or on the foreground wall); zoomed in, it
    // also follows the hero up the street. It stops at the wave's lock (lockEnd), so the screen's edge is the wall (Final Fight)
    game.cam.bounds = v => { const b = map.bounds(v), y1 = b.y1 - 9 + wall(game.H); return { x0: b.x0 + 8, x1: Math.min(b.x1 - 8, v.ax * (lockEnd(v) + 10)), y0: y1 - game.H * Math.max(1, game.zoom), y1 }; };
    // the hero's move set (E.MOVES, some tuned): a 4-hit punch string, a clinch (grab, knees, elbow), a kick string, a flying kick, a sweep
    hero = body(54, 58, 7, { hp: 60, max: 60, lives: 3, grip: 0, rig: fighterRig(HERO), moves: {
      punch: new E.Combo(['jab', 'cross', move('hook'), 'uppercut'], { window: .35 }), clinch: new E.Combo([GRAB, 'knee', 'knee', 'elbow'], { window: .35 }),
      kick: new E.Combo([move('kick'), move('roundhouse')], { window: .35 }), fly: new E.Attack('flyingkick'), sweep: move('sweep') } });
    game.follow(hero, { z: 34, lead: 24 });   // aimed at the chest: framing when zoomed in
    npcs = NPCS.map(n => body(n.x, n.y, 5, { n, facing: n.face, rig: fighterRig(n.rig) }));
    boxes = BOXES.map(([cx, y, kind]) => ({ x: cx * T, y, kind, hp: 2, flash: 0, box: true }));
    foes = []; foods = []; wave = 0; lockX = WAVES[0].x * T; go = 0; intro = INTRO; score = 0; won = 0; target = null; tgtT = 0; lag = 1; chain = chainT = 0;
    puffs.length = sparks.length = 0; talk.open = false;
    game.timeScale = 1; A.music('boss'); L.enabled = false;   // no game.lights: pools are baked, fighters rim-lit
  }
  function spawnWave(w) {                        // foes close in from both sides; the boss talks
    w.foes.forEach((kind, i) => {
      const k = FOES[kind], side = wave && i % 2 ? -1 : 1, swap = k.swap && w.foes.indexOf(kind) !== i;
      const x = kind === 'boss' ? hero.x + 120 : clamp(w.x * T + side * (Math.max(190, game.W / 2 / game.view.ax + 24) + i * 26), 12, LEN - 12);   // just past the screen's edge, however wide
      const f = body(x, Y0 + 12 + (i * 37) % 90, k.r, { k, name: swap ? k.swapName : k.name, hp: k.hp, facing: Math.PI, t: 1 + Math.random(), friction: 5, grip: 5,
        moves: k.moves.map(s => new E.Combo(s.map((m, j) => move(m, { wind: Math.max(E.MOVES[m].wind, j ? k.wind / 2 : k.wind) })))),   // its strings
        rig: fighterRig(k.rig, swap ? { colors: Object.assign({}, k.rig.colors, k.swap) } : {}) });
      foes.push(f);
      if (kind === 'boss') talk.say(TAUNT, { name: k.name, portrait: f.rig, portraitOpts: { zoom: 2.4, turn: -.6 } });
    });
  }
  // dust: flat translucent puffs
  const dust = (x, y, n, size = 3) => { for (let i = 0; i < n; i++) puffs.push({ x: x + E.rand(-5, 5), y: y + E.rand(-2, 2), vx: E.rand(-40, 40), t: 0, s: size * E.rand(.7, 1.2) }); };
  // our spark starts 2 frames after the contact, so the clean strike pose reads first
  const spark = (x, y, z, big) => sparks.push({ x, y, z, big, t: game.real + .035, rot: Math.random() });
  const solid = (c, x, y, R) => { const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy); if (d < R && d > .01) { c.x = x + dx / d * R; c.y = y + dy / d * R; } };   // push out of a circle
  // where the blow of attack state a lands: the striking foot where it is now (kick heights are shares of the hip) or fist
  const contact = (c, { spec: s, u }) => s.kick ? c.z + lerp(s.z0, s.z1, 1 - (1 - u) ** 3) * c.rig.o.hipZ * c.rig.o.size : c.rig.hand(s.hand)[2];
  // the hero lands his attack state a: game.hitFx (stop, shake, sound, number; power under 2: no whole-screen flash, only
  // the target flashes) at the fist or foot, our spark
  function strike(t, a) {
    const s = a.spec, b = BLOW[s.name], heavy = b[0] > 3 || b[2] > 0, dir = Math.sign(t.x - hero.x) || 1, x = t.x - dir * 6, z = t.box ? 12 : contact(hero, a);
    if (!t.box) { chain = chainT > 0 ? chain + 1 : 1; chainT = 1.4; }   // hits under 1.4 s apart chain up
    // the damage number: over the head, a slot higher for each hit of a string, so faces, fists and numbers stay clear
    game.hitFx(x, t.y + 1, z, { power: heavy ? 1.9 : 1.3, angle: dir > 0 ? 0 : Math.PI, color: '#ffd23a', sound: s.kick ? 'kick' : 'punch', damage: t.box ? undefined : b[0],
      textZ: t.box ? 0 : t.rig.head()[2] + 12 - z + (chain - 1) % 3 * 12, textScale: 2, textColor: heavy ? '#ffd23a' : '#ffffff' });
    spark(x, t.y + 1, z, heavy); t.flash = game.real + .05;
    if (t.box) return smash(t);
    P.bits(t.x, t.y, z + 6, heavy ? 7 : 3, ['#ffffff', '#c8e8ff', '#8ac8f0']);   // sweat
    target = t; tgtT = 3; score += b[0] * 10;
    knock(t, hero, b);
    if (t.hp <= 0) ko(t);
  }
  // a blow lands on a fighter: a flinch (hurt) and a slide; with a lift, or out of life, it is knocked off its feet
  function knock(c, from, [dmg, force, lift]) {
    c.hp -= dmg; c.stun = .32; c.vx = c.vy = 0; c.rig.kick(-1); if (c.act) c.act.cancel(); c.act = null;   // a blow stops you
    if (c.hp <= 0) { force = Math.max(force, 140); lift = Math.max(lift, 200); }
    if (lift) Object.assign(c, { knocked: true, bounce: .5, friction: 1.2 });
    E.knockback(from, c, force, lift);
  }
  // knocked down: fly (hurt, tipping back across the arc), hit the floor flat (a dust burst, a bounce, a smaller one), lie
  // 'down' and slide, sit up onto one knee, rise through a crouch, fight on (blinking from the get-up: safe). KO'd: stay down
  function fall(c, dt) {
    if (!c.knocked) return;
    if (c.bounced || c.landed) { const first = !c.down; if (first) { c.down = 1; c.floor = .9; c.rig.kick(-4); } dust(c.x, c.y, first ? 8 : 3, first ? 4 : 3); game.shake(first ? 2.5 : 1); A.sfx('land'); }
    if (c.down && c.onGround) { c.friction = 4; if (Math.abs(c.vx) > 30 && Math.random() < dt * 20) dust(c.x - Math.sign(c.vx) * 10, c.y, 1, 2); }   // the slide scrapes dust
    if (c.down && (c.floor -= dt) <= 0 && c.hp > 0) { c.down = 0; c.rise = .7; c.inv = Math.max(c.inv, 1.6); }
    else if (c.rise > 0 && (c.rise -= dt) <= 0) Object.assign(c, { knocked: false, bounce: 0, friction: c.grip, t: .8 });
  }
  function ko(f) {                               // KO: down for good, then blink and vanish. The boss: slow motion
    const boss = f.k === FOES.boss; f.dead = 2.6; score += boss ? 5000 : 300;
    if (boss) { game.flash('#ffffff', .3, .5); game.timeScale = .3; game.after(.5, () => { game.timeScale = 1; }); A.sfx('boom'); }
  }
  function smash(b) {                            // crates and barrels: two hits, then splinters and food
    if (--b.hp > 0) return;
    b.dead = true; A.sfx('bump'); P.bits(b.x, b.y, 10, 26, ['#c8905a', '#9a6a3a', '#6a4424']); dust(b.x, b.y, 6, 4); foods.push({ x: b.x, y: b.y + 2 });
  }
  // foe f lands attack state a. Until a string's last blow the hero is only rocked (no launch, no mercy blink), so the rest
  // of the string connects. Out of life: knocked down, then up again (a life lost) or game over
  function hurtHero(f, a) {
    const h = hero, more = f.act.step < f.act.moves.length - 1, b = BLOW[a.spec.name], z = contact(f, a), x = h.x + Math.sign(f.x - h.x) * 6;
    game.hitFx(x, h.y + 1, z, { power: b[2] ? 1.9 : 1.3, color: '#ff6a4a', sound: 'hurt', damage: b[0], textZ: h.rig.head()[2] + 12 - z + f.act.step * 12, textScale: 2, textColor: '#ff8a7a' });
    spark(x, h.y + 1, z, b[2] > 0); knock(h, f, more ? [b[0], 8, 0] : b); h.flash = game.real + .05; h.inv = more ? 0 : .6; chainT = 0;
    if (h.hp > 0) return;
    h.hp = 0; h.lives--;
    if (h.lives > 0) game.after(1.6, () => { Object.assign(h, { hp: h.max, inv: 2.5 }); lag = 1; dust(h.x, h.y, 6); A.sfx('powerup'); });
    else game.after(1.8, () => game.go('over', { from: 'brawler' }));
  }
  function update(dt) {
    const inp = game.input, h = hero, truce = talk.update(dt);   // truce: nobody punches while the boss talks
    // a fighter's body from its state: the guard stance while it can fight, hurt while flinching or flying, tipping back
    // (down: 0..1) from the first airborne frame to flat at the landing, 'down' on the floor, 'kneel' then 'crouch' getting
    // up, and its move (a sweep stays in a 'crouch' through its hold, then rises). Velocity / size: no skating
    const drive = (c, o) => {
      const sz = c.rig.o.size, st = c.act && c.act.state, ok = !c.knocked && c.stun <= 0, low = st && st.spec.name === 'sweep' && !(st.phase === 'recover' && st.u > .6);
      const fly = c.knocked && !c.down && !(c.rise > 0);
      // for detail(): gritted teeth and the striking glove drawn in front, once the blow is out (a cocked fist stays behind the head)
      c.rig.atk = st && (st.phase === 'recover' || st.phase === 'active' && st.u > .3) && (st.spec.kick ? 'K' : st.spec.hand || 'R');
      c.rig.update(dt, Object.assign({ x: c.x, y: c.y, z: c.z, vx: c.vx / sz, vy: c.vy / sz, facing: pose(c.facing), air: !c.onGround && !c.knocked, stance: ok ? 'guard' : null,
        hurt: !ok && !c.down && !(c.rise > 0), down: fly ? clamp(.6 - c.vz / 480, 0, 1) : undefined,
        pose: c.down ? 'down' : c.rise > .22 ? 'kneel' : c.rise > 0 || low ? 'crouch' : null, attack: st }, o));
    };
    h.inv -= dt; h.stun -= dt; go -= dt; intro -= dt; tgtT -= dt; chainT -= dt; if (won) won += dt;
    for (const p of puffs) { p.t += dt; p.x += p.vx * dt; p.vx *= 1 - dt * 5; } E.prune(puffs, p => p.t > .5); E.prune(sparks, s => game.real - s.t > .24);
    if (Math.random() < dt * 8) { const [mx, my] = E.pick(HOLES); puffs.push({ x: mx + E.rand(-4, 4), y: my, vx: E.rand(-8, 8), t: 0, s: 3 }); }   // manhole steam: wisps, like the dust
    for (const [, x, y] of DRUMS) if (Math.random() < dt * 9) P.add({ kind: 'ember', x: x + E.rand(-6, 6), y, z: 40, vx: E.rand(-12, 12), vz: E.rand(25, 50), g: -10, drag: 1, max: E.rand(.6, 1.3), color: '#ff7a2a' });   // embers
    for (const n of npcs) n.rig.update(dt, { x: n.x, y: n.y, facing: pose(n.facing), pose: n.n.pose });
    lag = Math.max(h.hp / h.max, lag - dt * .35);   // the bar's pale part drains slowly
    // waves: reaching one spawns it and locks the screen until it is cleared
    const w = WAVES[wave];
    if (w && !w.spawned && h.x > w.x * T - 60) { w.spawned = true; spawnWave(w); lockX = Math.max((w.x + 6) * T, (game.cam.x + game.W) / game.view.ax - 10); }   // never inside the screen
    if (w && w.spawned && !foes.some(f => !f.dead)) {
      wave++; go = 2.5; lockX = WAVES[wave] ? (WAVES[wave].x + 6) * T : LEN;
      if (!WAVES[wave]) { won = 1e-3; go = 0; A.music('victory'); game.follow(null); game.after(7, () => game.go('title')); } else A.sfx('confirm');
    }
    // the hero walks the lanes and jumps. J punches (a knee clinch on a foe in his face), K kicks, L sweeps; J or K in the air: a flying kick
    const air = !h.onGround, busy = !!(h.act && h.act.busy), free = h.hp > 0 && !h.knocked && h.stun <= 0 && !won && !truce;
    const mv = free ? inp.move() : [0, 0], md = game.view.screenDirToGround(mv[0], mv[1]);
    if (!h.knocked && h.stun <= 0) { const stop = busy && !air; h.vx = approach(h.vx, stop ? 0 : md[0] * 82, 900 * dt); h.vy = approach(h.vy, stop ? 0 : md[1] * 52, 900 * dt); }
    if (!busy && Math.abs(md[0]) > .2) h.facing = md[0] > 0 ? 0 : Math.PI;
    // a press waits (buffered) until the move before has settled back to guard; a Combo then flows into its next hit
    const tap = key => inp.buffered(key, .4), use = (m, key) => { if (m.press ? m.press() : m.start()) { h.act = m; inp.consume(key); } };
    if (free && !busy) {
      const hug = foes.some(f => !f.knocked && Math.abs(f.y - h.y) < 8 && E.inArc(h, h.facing, f, 20, .9)), key = tap('kick') ? 'kick' : 'attack';
      if (!air && inp.pressed('jump') && h.jump(250)) { h.act = null; A.sfx('jump'); dust(h.x, h.y, 3); }
      else if (air) { if (h.act !== h.moves.fly && tap(key)) use(h.moves.fly, key); }
      else if (tap('sweep')) use(h.moves.sweep, 'sweep');
      else if (tap('attack')) use(hug ? h.moves.clinch : h.moves.punch, 'attack');
      else if (tap('kick')) use(h.moves.kick, 'kick');
    }
    if (h.act && h.act.update(dt) === 'active') A.sfx('whoosh', { pitch: h.act.state.spec.kick ? .8 : 1 });   // the swing sound on the strike
    const wide = h.act === h.moves.sweep, inReach = t => !t.knocked && Math.abs(t.y - h.y) < (wide ? 18 : 12) && E.inArc(h, h.facing, t, 32, wide ? 1.9 : 1.1);
    const grab = t => { if (t.box) return; if (t.act) t.act.cancel(); Object.assign(t, { act: null, stun: .9, vx: 0, vy: 0, y: h.y, x: h.x + (t.x > h.x ? 20 : -20) }); };   // the collar grab: held close
    if (h.act) h.act.hits(foes.concat(boxes), inReach, t => h.act.state.spec.name === 'grab' ? grab(t) : strike(t, h.act.state));   // moves connect late in the strike (hitAt)
    h.update(dt, map); fall(h, dt);
    h.x = clamp(h.x, 10, lockEnd(game.view)); h.y = clamp(h.y, Y0, Y1);
    for (const b of boxes) if (!b.dead) solid(h, b.x, b.y, 13);
    for (const m of foods) if (!m.got && h.hp > 0 && Math.hypot(m.x - h.x, m.y - h.y) < 12) { m.got = true; h.hp = Math.min(h.max, h.hp + 20); A.sfx('heal'); }
    E.prune(foods, m => m.got);
    // foes walk to the hero's lane and open one of their strings; when a blow has settled, the next one follows
    for (const f of foes) {
      f.stun -= dt; if (f.dead) f.dead -= dt;
      const dx = h.x - f.x, dy = h.y - f.y, sz = f.k.rig.size, gap = 12 + 5.5 * sz;
      if (f.act) {
        if (f.act.update(dt) === 'active') A.sfx('whoosh', { pitch: .7 });
        f.act.hits([h], t => t.inv <= 0 && !t.knocked && Math.abs(t.y - f.y) < 12 && E.inArc(f, f.facing, t, 16 + 6 * sz, 1), () => hurtHero(f, f.act.state));
        if (!f.act.busy) { if (f.act.step < f.act.moves.length - 1 && f.act.press()) f.vx = Math.sign(dx) * Math.max(0, Math.abs(dx) - gap) * 5; else f.act = null; }   // the next blow steps back into range; or the string is over
      } else if (!f.knocked && f.stun <= 0 && h.hp > 0) {
        const tx = h.x + (dx > 0 ? -gap : gap) - f.x; f.facing = dx > 0 ? 0 : Math.PI;
        f.vx = approach(f.vx, Math.abs(tx) > 4 ? Math.sign(tx) * f.k.speed : 0, 300 * dt); f.vy = approach(f.vy, Math.abs(dy) > 2 ? Math.sign(dy) * 30 : 0, 300 * dt);
        if ((f.t -= dt) <= 0 && !truce && !h.knocked && Math.abs(tx) < 8 && Math.abs(dy) < 7) { f.act = E.pick(f.moves); f.act.press(); f.t = f.k === FOES.boss ? .5 : 1 + Math.random(); }
      }
      f.update(dt, map); f.y = clamp(f.y, Y0, Y1); fall(f, dt);
      drive(f);
    }
    for (const c of [h, ...foes]) for (const [, x, y] of CARS) for (let q = -32; q <= 32; q += 16) solid(c, x + q, y - 10, 14);   // a car: a row of circles
    for (const a of foes) for (const b of foes) if (a !== b && !a.dead && !b.dead) solid(b, a.x, a.y, a.r + b.r + 10);   // no stacking
    E.prune(foes, f => { const gone = f.dead !== undefined && f.dead <= 0; if (gone) dust(f.x, f.y, 6); return gone; });
    // stage clear: the camera pans to put the hero on the right (the results go left); he turns three-quarters to us over
    // half a second (never full front: the headband tails would cross his face), cheers, then puts his hands on his hips
    if (won) game.focus(h.x - 60 / game.zoom, h.y, 34);
    drive(h, won > 1 ? { facing: pose(h.facing, lerp(.25, .7, Math.min(1, (won - 1) * 2))), pose: won > 4 ? 'hips' : 'cheer', stance: null } : {});
  }
  function star(g, x, y, s) {                    // a 3-frame hand-drawn hit spark (Street Fighter): flash, burst, shards
    const u = (game.real - s.t) / .24, R = (s.big ? 21 : 15) * game.zoom, n = u < .3 ? 6 : 8, pt = (i, d) => [x + Math.cos(i * Math.PI / n + s.rot) * d, y + Math.sin(i * Math.PI / n + s.rot) * d * .8];
    if (u < 0) return;
    const spikes = (r0, r1, c) => px.poly(g, Array.from({ length: n * 2 }, (_, i) => pt(i, i % 2 ? r1 : r0)), c);
    if (u < .3) { spikes(R, R * .3, '#ff6a1a'); spikes(R * .72, R * .24, '#ffe070'); px.disc(g, x, y, R * .28, '#ffffff'); }
    else if (u < .6) { spikes(R * 1.15, R * .5, '#ffd23a'); spikes(R * .85, R * .4, '#fff8e0'); }
    else for (let i = 0; i < 16; i += 2) px.line(g, ...pt(i, R * .8), ...pt(i, R * 1.3), '#ffe8a0', 2);
  }
  function draw(r) {
    const blink = t => t > 0 && t < 1 && Math.floor(game.real * 20) % 2 ? .25 : 1, Z = game.zoom;   // Z: screen pixels drawn by hand scale with the zoom
    const at = (x, y, z, f, o) => r.queue(x, y, z, g => { const [sx, sy] = r.w(x, y, z); f(g, Math.round(sx), Math.round(sy)); }, o);
    bg.draw(r); skyDetail(r.ctx, r);
    map.drawFloor(r);
    for (const c of [hero, ...foes, ...npcs]) r.shadow(c.x, c.y, lerp(4.8 * c.rig.o.size * Math.max(.4, 1 - c.z / 60), 24, c.rig.downW || 0), .45);   // grows as it lies down
    map.queueWalls(r);
    for (const b of blocks) { const [sx, sy] = r.w(b.x0, T, b.h); if (sx < r.W && sx + b.w * r.view.ax > 0) r.queue(b.x0 + b.w / 2, T, 0, g => g.drawImage(front(b), Math.round(sx), Math.round(sy) - TOP)); }
    for (const [i, u, z, c] of AWNINGS) r.prop('awning', blocks[i].x0 + u, T + 2, z, { size: .75, color: c });
    for (const s of SIGNS) at(blocks[s.b].x0 + s.u, T + .6, s.z, (g, x, y) => { const on = E.hash2(Math.floor(game.real * 9), s.b) > .05;   // flicker
      if (on) art(g, 'halo' + s.b, x, y, (c, a, b) => neon(c, a, b, s, on, 1), 'add'); art(g, s.text + on, x, y, (c, a, b) => neon(c, a, b, s, on)); });
    for (const x of LAMPS) at(x, 44, 0, (g, sx, sy) => { art(g, 'light', sx, sy, (c, a, b) => lamp(c, a, b, 1), 'add'); art(g, 'lamp', sx, sy, lamp); });
    for (const [, x, y] of DRUMS) at(x, y, 0, (g, sx, sy) => { const f = (20 + (Math.floor(game.real * 8 + x) % 3) * 2) * Z, fy = sy - 56 * Z;   // fire: two flat rings flickering in 2 px steps
      px.blend(g, .125, 'add', () => px.disc(g, sx, fy, f, '#ff5a1a')); px.blend(g, .25, 'add', () => px.disc(g, sx, fy, f * .55, '#ffb040')); }, { bias: .01 });
    for (const [kind, x, y, size] of STREET) if (FURN[kind]) at(x, y, 0, (g, sx, sy) => art(g, kind + size, sx, sy, (c, a, b) => FURN[kind](c, a, b, size))); else r.prop(kind, x, y, 0, { size, color: kind === 'firedrum' ? '#7a4630' : undefined, halo: false });
    for (const [id, x, y, facing, scale] of DRESS) r.shape(id, x, y, 0, { facing, scale });
    for (const b of boxes) if (!b.dead) r.sprite(b.x, b.y, 0, SPR[b.kind], { flash: b.flash > game.real });
    for (const m of foods) r.sprite(m.x, m.y, 0, MEAT);
    for (const n of npcs) fighter(r, n);
    for (const f of foes) fighter(r, f, { flash: f.flash > game.real, alpha: blink(f.dead) });   // flashes: 3 frames, on the fighter only; the hero's mercy blink only once he is up
    fighter(r, hero, { alpha: hero.inv > 0 && hero.hp > 0 && hero.stun <= 0 && (!hero.knocked || hero.rise > 0) && Math.floor(game.real * 16) % 2 ? .45 : 1, flash: hero.flash > game.real && '#ffb0a0' });
    for (const c of [hero, ...foes]) { const a = c.rig.atk;   // a streak along the real fist or foot path; a fist swung on the far side
      if (a === 'K' || a === 'both' || (a === 'L') === Math.cos(c.facing) < 0) c.rig.drawSmear(r, SMEAR); }   // leaves none: it would cross the face
    for (const p of puffs) at(p.x, p.y, p.t * 16, (g, x, y) => {   // puffs: flat translucent dust clouds (never balls); swell, then thin out
      const u = p.t / .5, R = p.s * 1.6 * (u < .25 ? .5 + u * 2 : 1.25 - u) * Z;
      px.blend(g, u < .5 ? .5 : .25, 'normal', () => { px.ell(g, x, y, R * 1.5, R * .7, '#8a7e9a'); px.ell(g, x - R * .3, y - R * .3, R, R * .4, '#d0c8dc'); });
    });
    for (const s of sparks) at(s.x, s.y, s.z, (g, x, y) => star(g, x, y, s), { bias: .5 });
    if (wall(r.H)) r.overlay(g => foreground(g, r));   // (at every zoom: the camera's bounds keep its band)
    r.overlay(g => hud(g, r)); talk.draw(r);
  }
  // ANY SCREEN: how far a screen taller than the street lifts it (0 on a wide one), and the FOREGROUND wall in that band:
  // a lit coping, dark brick, nearer and so faster than the street
  const wall = H => Math.max(0, Math.min(130, Math.round((H - 300) * .55)));
  function foreground(g, r) {
    const y = Math.round(map.bounds(r.view).y1 - 9 - r.iy), o = ((Math.round(r.ix * 1.2) % 24) + 24) % 24;
    px.rect(g, 0, y, r.W, r.H - y, '#1a1222'); px.rect(g, 0, y, r.W, 3, '#5a4258'); px.rect(g, 0, y + 3, r.W, 2, '#2e2236');
    for (let row = 0, by = y + 5; by < r.H; row++, by += 7) { px.rect(g, 0, by, r.W, 1, '#120c18'); for (let x = -o + (row & 1) * 12; x < r.W; x += 24) px.rect(g, x, by, 1, 7, '#120c18'); }
    px.blend(g, .5, 'normal', () => px.rect(g, 0, y + 5, r.W, 10, '#0a0610'));   // the street's shadow on the wall's face
  }

  /* ---- HUD: solid panels, live 3/4 rig.drawPortrait faces, two-tone bars ---- */
  const WIN = { bg: ['#3a2a5c', '#0e0a1c'], border: '#a89ad8' };
  function panel(g, x, c, name, f, lagF, color, right, y = 4) {
    g.save(); g.translate(0, y - 4);   // (drawn for y = 4)
    E.ui.box(g, x, 4, 154, 40, Object.assign({}, WIN, right ? { bg: ['#4a1e3a', '#12060e'], border: '#d08aa8' } : {}));
    c.rig.drawPortrait(g, right ? x + 118 : x + 6, 9, 30, { zoom: 2.1, turn: right ? -.6 : .6, bg: right ? ['#a83a5a', '#2a0c1c'] : ['#5a6ac0', '#161030'],
      border: right ? '#f0b0c8' : '#d0c8f8', shadow: false, tint: c.hp > 0 ? undefined : '#808080' });   // KO'd: grey
    const tx = right ? x + 5 : x + 42, t = E.tones(color), n = Math.round(106 * clamp(f, 0, 1));
    E.font.text(g, name, tx, 11, '#ffe070', Object.assign({ gradient: right ? ['#ffd8d8', '#ff7070'] : ['#fff6c0', '#f0a830'] }, TXT));
    if (!right) { E.font.text(g, '×' + c.lives, tx + E.font.width(name) + 5, 11, '#ffffff', TXT); E.font.text(g, String(score).padStart(6, '0'), x + 150, 11, '#e8e4ff', TXR); }
    E.ui.bar(g, tx, 27, 108, 10, lagF, '#fff0e0');   // the frame, with the pale drain as its fill
    if (n > 0) { px.rect(g, tx + 1, 28, n, 8, color); px.rect(g, tx + 1, 28, n, 2, t.hi); px.rect(g, tx + 1, 34, n, 2, t.sh); }
    g.restore(); g._c = null;
  }
  function hud(g, r) {
    const W = r.W, H = r.H;
    if (talk.open) { for (const y of [0, H - 22]) px.rect(g, 0, y, W, 22, '#06040a'); return; }   // letterbox while the boss talks
    panel(g, 4, hero, 'MAX', hero.hp / hero.max, lag, '#ffd23a');
    // enemy panel: the last one hit (KO'd: briefly), else the nearest, else the boss
    const foe = tgtT > 0 && target && (!target.dead || tgtT > 2.4) ? target : foes.find(f => !f.dead && Math.abs(f.x - hero.x) < 56 && Math.abs(f.y - hero.y) < 16) || foes.find(f => f.k === FOES.boss && !f.dead);
    const fx = Math.min(W, cornerX()) - 158;   // clear of the corner's menu button: beside it, or under it on a narrow screen
    if (foe && !won) panel(g, fx < 162 ? W - 158 : fx, foe, foe.name, foe.hp / foe.k.hp, 0, '#e8463c', true, fx < 162 ? 48 : 4);
    if (chain > 1 && chainT > 0) {               // the HITS counter on a gradient plate
      const s = String(chain), w = E.font.width(s, 3);
      E.ui.box(g, 6, 50, w + 44, 28, { bg: ['#d8402a', '#4a0a1a'], border: '#ffd070' });
      E.font.title(g, s, 12, 53, { scale: 3, colors: ['#ffffff', '#ffe070', '#ff9a2a'] }); E.font.title(g, 'HITS', 18 + w, 63, { scale: 1, colors: ['#fff6d0', '#ffc860'] });
    }
    if (intro > 0) {                             // round card slides in and out
      const keys = [prompt('attack', 'punch'), prompt('kick', 'kick'), prompt('sweep', 'sweep'), prompt('jump', 'jump')].join(' '), cw = Math.max(180, E.font.width(keys) + 16);   // the player's own keys
      const k = Math.min(1, (INTRO - intro) * 5, intro * 5), x = Math.round(W / 2 - cw / 2 + (1 - k) * (intro < 1 ? W : -W)), m = x + cw / 2;
      E.ui.box(g, x, 52, cw, 56, WIN);
      E.font.title(g, 'ROUND 1', m, 57, { scale: 2, align: 'center', colors: ['#fff6d0', '#ffd060', '#e8782a'] });
      E.font.text(g, 'DOWNTOWN AT DUSK', m, 79, '#ffe8c8', TXC); E.font.text(g, keys, m, 92, '#b8b0e0', TXC);
    }
    if (go > 0 && Math.floor(game.real * 3) % 2 === 0) E.font.title(g, 'GO →', W - 14, 96, { scale: 3, align: 'right', colors: ['#fff6c0', '#ffc040', '#e06a20'] });
    if (won > 1.5) {                             // results on the left, clear of the cheering hero
      const X = 106;
      E.font.title(g, 'STREETS CLEARED!', X, 50, { scale: 2, align: 'center' });
      E.ui.box(g, X - 100, 68, 200, 44, WIN); hero.rig.drawPortrait(g, X - 94, 73, 34, { zoom: 2.4, turn: .6, bg: ['#ffc070', '#8a3a4a'], border: '#ffe070' });
      [['SCORE', score], ['BEST', best('brawler', score)]].forEach(([k, v], i) => { E.font.text(g, k, X - 46, 76 + i * 16, '#b8b0d8', TXT); E.font.text(g, String(v), X + 92, 76 + i * 16, '#ffe070', TXR); });
    }
  }
  // camera: the player zooms .75x to 1.5x (at 2x a 100 px fighter no longer fits under the HUD); a phone held upright
  // starts at 1.5x, so the street fills more of it. Turning stays off: tried, a turned street loses its fronts (painted for
  // this side only) and its screen-space bounds
  return { view: 'brawler', views: ['brawler'], res: 'ps1', pausable: true, touch: ['attack', 'kick', 'sweep', 'jump'], propSize: 2.4, camera: { zoom: [.75, 1.5], tall: 1.5 },   // props match 100 px fighters
    input: Object.assign({}, E.Input.DEFAULT, { kick: ['KeyK', 'Mouse2', 'Pad2'], sweep: ['KeyL', 'Pad1'], jump: ['KeyZ', 'Space', 'Pad3'] }),
    enter() { WAVES.forEach(w => { w.spawned = false; }); start(); }, update, draw,
    state: () => ({ hero, foes, wave, lockX, end: lockEnd(game.view), Y0, Y1 }) };   // for tests (end: the walkable street's right end)
})();
scenes.brawler = BRAWL;
