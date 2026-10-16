/* =============================================================================
 * THE HALL, written as text: one character per floor tile (1 metre, 16 units); row 0 is the far (north) wall.
 *   #  wall (3 m)                  P  pillar (2 x 2 tiles, 3.5 m)      w  low wall (0.75 m: the hero jumps it)
 *   .  floor                       t  a brazier (a torch spot; the panel lights the first N, in a shuffled order)
 *   =  gallery (1 m up)            ^  stairs, rising north (to a gallery)
 *   o  the rune dais (half a metre up, its edge a gentle slope all round; its centre and size come from these tiles)
 * The layout is the 2D stress test's hall (the same walls, pillar grid, low walls and torch spots, from the same seeds),
 * with what a 3D hall can add: the dais, two galleries along the north wall and their stairs. To change the level,
 * edit LEVEL: the colliders, the floor heights, the walkable grid and the meshes all come from it.
 *   floorH(x, y)        the walkable surface's height at a point (floor 0, gallery 16, the stairs and dais between)
 *   topH(x, y)          the top of whatever is there (a wall's or pillar's top over solid tiles): shots and particles
 *   solidTile(cx, cy)   walls, pillars, low walls and braziers: nobody walks there (the hero may stand on a low wall)
 *   FLOW                the walkable grid's flow field toward the hero (20-sim): steps up are allowed where the surface
 *                       climbs gently (stairs, the dais's edge), steps down anywhere (dropping off a gallery)
 *   hallColliders(w)    Rapier's fixed colliders for all of it (20-sim calls it when it builds the world)
 *   meshes              floor (the 2D hall's own floor texture), walls (cut away in front of an outside camera),
 *                       pillars with plinths and capitals, low walls, galleries, stairs, the dais, braziers
 *   lights              a fixed set (the count never changes, so shaders never rebuild): 30 torches, 2 shadow casters
 *                       that take over the 2 lit torches nearest the hero, the rune's glow, the hero's light, 4 for
 *                       wisps and 4 for bolts
 * ============================================================================= */
const LEVEL = [
  '################################################################',
  '#..====================..................====================..#',
  '#..====================..................====================..#',
  '#..====================..................====================..#',
  '#..====================..................====================t.#',
  '#..........^^^.....t............t.......t.....t....^^^.........#',
  '#..........^^^.....................................^^^.........#',
  '#......PP..^^^...PP........PP........PP........PP..^^^...PP....#',
  '#......PP..^^^...PP........PP........PPw.......PP..^^^...PP....#',
  '#..........^^^.........................w...........^^^.........#',
  '#..................t......t............w.......................#',
  '#....t..........................t.....................t...www..#',
  '#.........................................................www..#',
  '#..............................................................#',
  '#..................................w..............www..........#',
  '#..................................w...........................#',
  '#...t.....................t........w...........................#',
  '#......PP........PP..........oooooo..PP........PP.....t..PP....#',
  '#......PP........PP.........oooooooo.PP........PP........PP....#',
  '#..........................oooooooooo......w...................#',
  '#..........................oooooooooo......w...................#',
  '#..........................oooooooooo......w........w..........#',
  '#..........................oooooooooo...............w..........#',
  '#...........t......t.......oooooooooo...t......t....w.......t..#',
  '#..........................oooooooooo..........................#',
  '#...........................oooooooo...........................#',
  '#............................oooooo............................#',
  '#......PP........PP........PP........PP........PP........PP....#',
  '#......PP........PP........PP........PP........PP.....t..PP....#',
  '#............................................www...............#',
  '#........................................www...................#',
  '#...www........w...............................................#',
  '#..............w...............................................#',
  '#..............w...............................................#',
  '#..............w...............................t.....t......t..#',
  '#..............w...www...t.....................................#',
  '#..............w...............................................#',
  '#......PP........PP........PP........PP........PP........PP....#',
  '#......PP........PP........PP........PP........PP........PP....#',
  '#..............................................................#',
  '#...t..........................................t.............t.#',
  '#..........t....................t.......t............t.........#',
  '#..............................................................#',
  '################################################################'
];
const T = 16, MW = LEVEL[0].length, MH = LEVEL.length, HW = MW * T, HH = MH * T;   // tile size, hall size in tiles and units
const WALL_H = 48, CUT_H = 7, PILLAR_H = 56, LOW_H = 12, GALLERY_H = 16, DAIS_H = 8, CLIMB = 3.5;   // heights (units); CLIMB: the highest step a body walks up
const tile = (cx, cy) => cx < 0 || cy < 0 || cx >= MW || cy >= MH ? '#' : LEVEL[cy][cx];
const solidTile = (cx, cy) => '#Pwt'.includes(tile(cx, cy));
// the wall types' colors: the 2D hall's (its TileMap types 1, 2 and 3)
const WT = {
  '#': { h: WALL_H, top: '#57506a', side: '#3d3750', line: '#2a2538', course: 8 },
  P: { h: PILLAR_H, top: '#6a6280', side: '#4a4360', line: '#302a40', course: 10 },
  w: { h: LOW_H, top: '#5d566f', side: '#433d55', line: '#2e2940', course: 6 }
};

/* ---- the level's parts, read from the text ---- */
/** rectangles covering every tile of one character (greedy: rows first), in tiles: [x0, y0, x1, y1] inclusive */
function rects(ch) {
  const used = new Uint8Array(MW * MH), out = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (used[y * MW + x] || tile(x, y) !== ch) continue;
    let x1 = x; while (x1 + 1 < MW && tile(x1 + 1, y) === ch && !used[y * MW + x1 + 1]) x1++;
    let y1 = y; for (;;) { const ny = y1 + 1; if (ny >= MH) break; let ok = true; for (let k = x; k <= x1; k++) if (tile(k, ny) !== ch || used[ny * MW + k]) { ok = false; break; } if (!ok) break; y1 = ny; }
    for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) used[yy * MW + xx] = 1;
    out.push([x, y, x1, y1]);
  }
  return out;
}
const GALLERIES = rects('='), STAIRS = rects('^'), PILLARS = rects('P');
/** the dais: centre and base radius from its tiles' bounding box, a top 1.5 tiles in from the base all round */
const DAIS = (() => {
  let x0 = MW, y0 = MH, x1 = -1, y1 = -1;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tile(x, y) === 'o') { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const R0 = ((x1 - x0 + 1) / 2 + .5) * T;
  return { x: (x0 + x1 + 1) / 2 * T, y: (y0 + y1 + 1) / 2 * T, R0, R1: R0 - 24, h: DAIS_H };
})();
const CXu = DAIS.x, CYu = DAIS.y;   // the hall's centre (the rune circle)
/** the octagon's 'radius' at an offset: the distance to its nearest face (faces facing the axes and the diagonals) */
const octR = (dx, dy) => Math.max(Math.abs(dx), Math.abs(dy), (Math.abs(dx) + Math.abs(dy)) * Math.SQRT1_2);
/** the walkable surface's height at a point (units): floor, the dais's slope and top, the stairs, a gallery */
function floorH(x, y) {
  const cx = Math.floor(x / T), cy = Math.floor(y / T), c = tile(cx, cy);
  if (c === '=') return GALLERY_H;
  if (c === '^') { for (const [sx0, sy0, sx1, sy1] of STAIRS) if (cx >= sx0 && cx <= sx1 && cy >= sy0 && cy <= sy1) return GALLERY_H * clamp(((sy1 + 1) * T - y) / ((sy1 - sy0 + 1) * T), 0, 1); }
  const r = octR(x - DAIS.x, y - DAIS.y);
  return r < DAIS.R0 ? DAIS.h * clamp((DAIS.R0 - r) / (DAIS.R0 - DAIS.R1), 0, 1) : 0;
}
/** the top of whatever stands at a point: a wall's, pillar's or low wall's top, or the floor's surface */
function topH(x, y) {
  const c = tile(Math.floor(x / T), Math.floor(y / T));
  return c === '#' ? WALL_H : c === 'P' ? PILLAR_H : c === 'w' ? LOW_H : floorH(x, y);
}
/** the torch spots in the order the panel lights them (a shuffle from the 2D hall's seed), each on the floor's height */
const TORCHES = (() => {
  const list = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tile(x, y) === 't') list.push({ x: (x + .5) * T, y: (y + .5) * T, z: 0, r: 5, t: 0 });
  const R = E.rng(9);
  for (let i = list.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
  list.forEach((b, i) => { b.z = floorH(b.x, b.y); b.t = i * 1.7; });
  return list;
})();

/** the hall's stores, heaped in its corners and against the north wall between the galleries: the engine's core shapes
 *  (docs/ASSETS.md), solid (a box each, from E.shapeBox), drawn as meshes from E.shapeMesh [id, x, y (tiles), facing, scale] */
const STORES = [['barrel', 1.6, 1.6, 0, .9], ['sack', 1.6, 3.4, .5, 1], ['crate', 27.2, 1.6, .2, .9], ['chest', 30, 1.5, Math.PI / 2, 1], ['barrel', 32.6, 1.6, 1, .9],
  ['barrel', 61.6, 1.6, 2, .9], ['barrel', 1.6, MH - 1.6, 0, .9], ['crate', 2.9, MH - 1.6, .4, .9], ['sack', 61.4, MH - 1.5, 0, 1], ['crate', 62.2, MH - 2.6, -.3, .9]]
  .map(([id, x, y, facing, scale]) => ({ id, x: x * T, y: y * T, z: 0, o: { facing, scale } }));

/* ---- the walkable grid and its flow field ---- */
// passable from one tile to the next: neither solid, and walking the line between their centres never climbs a step
// higher than CLIMB (stairs and the dais's edge climb gently; a gallery's edge is a wall from below, a drop from above)
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const PASS = new Uint8Array(MW * MH);   // per tile: bit k set = it can step to its neighbour DIRS8[k]
for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) {
  if (solidTile(cx, cy)) continue;
  let bits = 0;
  DIRS8.forEach(([dx, dy], k) => {
    const nx = cx + dx, ny = cy + dy; if (solidTile(nx, ny)) return;
    if (dx && dy && (solidTile(cx + dx, cy) || solidTile(cx, cy + dy))) return;   // no cutting a corner
    const ax = (cx + .5) * T, ay = (cy + .5) * T; let h = floorH(ax, ay), ok = true;
    for (let s = 1; s <= 8; s++) { const k2 = floorH(ax + dx * T * s / 8, ay + dy * T * s / 8); if (k2 - h > CLIMB) { ok = false; break; } h = k2; }
    if (ok) bits |= 1 << k;
  });
  PASS[cy * MW + cx] = bits;
}
/** the flow field toward one point (the hero): distances along walkable steps, recomputed when the point changes tile.
 *  dir(x, y) is the ground direction to walk from (x, y): toward the neighbouring tile nearest the target */
const FLOW = {
  d: new Float32Array(MW * MH), heap: [], tx: -1, ty: -1,
  update(x, y) {
    let tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (tx === this.tx && ty === this.ty) return; this.tx = tx; this.ty = ty;
    const d = this.d; d.fill(1e9);
    // the target tile, or (standing on a low wall) the walkable tiles round it
    const seeds = solidTile(tx, ty) ? DIRS8.map(([dx, dy]) => [tx + dx, ty + dy]).filter(([a, b]) => !solidTile(a, b)) : [[tx, ty]];
    const H = this.heap; H.length = 0;
    const push = (i, v) => { H.push([v, i]); let k = H.length - 1; while (k) { const p = (k - 1) >> 1; if (H[p][0] <= H[k][0]) break; [H[p], H[k]] = [H[k], H[p]]; k = p; } };
    const pop = () => { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === k) break; [H[m], H[k]] = [H[k], H[m]]; k = m; } } return top; };
    for (const [a, b] of seeds) { d[b * MW + a] = 0; push(b * MW + a, 0); }
    while (H.length) {
      const [v, i] = pop(); if (v > d[i]) continue;
      const cx = i % MW, cy = (i / MW) | 0;
      // walk backwards: a neighbour n reaches i if n's step toward i is passable
      DIRS8.forEach(([dx, dy], k) => {
        const nx = cx - dx, ny = cy - dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) return;
        const j = ny * MW + nx; if (!(PASS[j] & (1 << k))) return;
        const w = v + (dx && dy ? 1.414 : 1); if (w < d[j]) { d[j] = w; push(j, w); }
      });
    }
  },
  dir(x, y, out) {
    const cx = Math.floor(x / T), cy = Math.floor(y / T), i = cy * MW + cx, here = this.d[i];
    if (!(here < 1e9) || here === 0) return null;   // off the grid, unreachable or there already: walk straight
    let best = here, bx = 0, by = 0;
    const bits = PASS[i];
    DIRS8.forEach(([dx, dy], k) => { if (!(bits & (1 << k))) return; const v = this.d[(cy + dy) * MW + cx + dx]; if (v < best) { best = v; bx = dx; by = dy; } });
    if (!bx && !by) return null;
    const tx = (cx + bx + .5) * T - x, ty = (cy + by + .5) * T - y, l = Math.hypot(tx, ty) || 1;
    out[0] = tx / l; out[1] = ty / l; return out;
  }
};

/* ---- colliders (Rapier, built into each new world by 20-sim) ---- */
const Z_UP = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };   // a capsule or cylinder (Rapier's are along y) stood up along z
/** the dais as points: an octagon of radius r (to its faces) at height z */
function octagon(r, z, cx = DAIS.x, cy = DAIS.y) {
  const R = r / Math.cos(Math.PI / 8), out = [];
  for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; out.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R, z]); }
  return out;
}
function hallColliders(world, groups) {
  const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const box = (x0, y0, z0, x1, y1, z1) => world.createCollider(RAPIER.ColliderDesc.cuboid((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2).setTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).setFriction(.6).setCollisionGroups(groups), fixed);
  const hull = pts => world.createCollider(RAPIER.ColliderDesc.convexHull(new Float32Array(pts.flat())).setFriction(.6).setCollisionGroups(groups), fixed);
  box(-T, -T, -16, HW + T, HH + T, 0);                                                         // the floor
  for (const ch of ['#', 'P', 'w']) for (const [x0, y0, x1, y1] of rects(ch)) box(x0 * T, y0 * T, 0, (x1 + 1) * T, (y1 + 1) * T, WT[ch].h);
  for (const [x0, y0, x1, y1] of GALLERIES) box(x0 * T, y0 * T, 0, (x1 + 1) * T, (y1 + 1) * T, GALLERY_H);
  for (const [x0, y0, x1, y1] of STAIRS) {   // a wedge rising north: high at y0, the floor at y1 + 1
    const a = x0 * T, b = (x1 + 1) * T, n = y0 * T, s = (y1 + 1) * T;
    hull([[a, s, 0], [b, s, 0], [a, n, 0], [b, n, 0], [a, n, GALLERY_H], [b, n, GALLERY_H]]);
  }
  hull([...octagon(DAIS.R0, 0), ...octagon(DAIS.R1, DAIS.h)]);   // the dais: a frustum
  for (const b of TORCHES) world.createCollider(RAPIER.ColliderDesc.cylinder(6, b.r).setRotation(Z_UP).setTranslation(b.x, b.y, b.z + 6).setCollisionGroups(groups), fixed);
  for (const st of STORES) { const b = E.shapeBox(st.id, st.x, st.y, st.z, st.o), t = Math.atan2(b.s, b.c) / 2;   // (a box turned about z)
    world.createCollider(RAPIER.ColliderDesc.cuboid(b.hx, b.hy, (b.top - b.z) / 2).setTranslation(b.x, b.y, (b.z + b.top) / 2).setRotation({ x: 0, y: 0, z: Math.sin(t), w: Math.cos(t) }).setFriction(.6).setCollisionGroups(groups), fixed); }
}

/* ---- textures: drawn by code, pixel by pixel ---- */
const PAL = { stones: ['#4b4559', '#554f64', '#433e51', '#5d566c'].map(E.hex), mortar: E.hex('#221e2b'), hi: E.hex('#6f6782'), lo: E.hex('#322d3e'), speck: E.hex('#2a2634') };
const RUNE = [...E.hex('#2f7f82'), .45], RUNE_HI = [...E.hex('#6fd6cc'), 1], MOSS = [E.hex('#3f5a44'), E.hex('#4d6b4b')];
/** the 2D hall's floor (its floorTex, unchanged): flagstones, the rune circle at the centre (it glows: the 4th number),
 *  moss creeping in from the walls */
function floorTex(x, y) {
  const dx = x - CXu, dy = y - CYu, d = Math.hypot(dx, dy);
  if (Math.abs(d - 54) < .8 || Math.abs(d - 43) < .6) return RUNE;
  if (d > 43 && d < 54) {
    const a = (Math.atan2(dy, dx) / TAU + 1) * 16, k = a % 1;
    if (k < .05) return RUNE;
    if (Math.abs(d - 48.5) < 2 && E.hash2(Math.floor(a), Math.floor(d * .5)) > .35 && ((Math.floor(x) + Math.floor(y)) & 1)) return RUNE_HI;
  }
  if (d < 7) return d < 3 ? RUNE_HI : E.tex.flagstone(x, y, PAL);
  let c = E.tex.flagstone(x, y, PAL);
  const edge = Math.min(x - T, y - T, MW * T - T - x, MH * T - T - y);
  if (edge < 22 && E.noise2(x * .13, y * .13) > .5 + edge * .014) c = MOSS[E.hash2(x | 0, y | 0) < .5 ? 0 : 1];
  return c;
}
const H = E.hex;
/** a wall face, 16 pixels wide and h tall: courses of bricks, joints staggered by course, lit brick tops and specks
 *  (the engine's 'brick' face); y 0 at the top */
function faceTex(t, h) {
  const tt = E.tones(t.side), base = H(t.side), line = H(t.line || E.shade(t.side, -.3)), sh = H(tt.sh), lt = H(tt.lt), course = t.course || 8;
  return (x, y) => {
    const z = h - 1 - y, ci = Math.floor(z / course), fz = z - ci * course;
    if (fz === 0 && z > 0) return line;
    const jx = (ci & 1) ? 4 : 12; if (x === jx) return line;
    const v = E.hash2(ci * 7 + (x < jx ? 0 : 1), ci + 99);
    if (fz === course - 1) return v > .5 ? lt : base;
    if (E.hash2(x * 3 + 1, z * 5 + 2) < .07) return sh;
    return v < .22 ? sh : v > .86 ? lt : base;
  };
}
function topTex(t) { const tt = E.tones(t.top), base = H(t.top), sh = H(tt.sh), lt = H(tt.lt); return (x, y) => { const v = E.hash2(x * 3 + 71, y * 5 + 37); return v < .08 ? sh : v > .96 ? lt : base; }; }
/** dressed stone: big blocks, bevelled (lit top and left, dark bottom and right): the pillars' shafts, the stairs */
function blockTex(side, bw = 16, bh = 8) {
  const tt = E.tones(side), base = H(side), hi = H(tt.lt), lo = H(tt.sh), mortar = H(E.shade(side, -.45));
  return (x, y) => {
    const row = Math.floor(y / bh), off = (row & 1) * bw / 2, col = Math.floor((x + off) / bw), lx = x + off - col * bw, ly = y - row * bh;
    if (ly === bh - 1 || lx === bw - 1) return mortar;
    if (ly === 0 || lx === 0) return hi;
    if (ly === bh - 2 || lx === bw - 2) return lo;
    return E.noise2(x * .3, y * .3) > .8 ? lo : E.hash2(col, row) > .7 ? H(E.shade(side, .06)) : base;
  };
}

/* ---- meshes ---- */
/** shapes from the engine's library (docs/ASSETS.md) as ONE three.js mesh: E.shapeMesh's triangles (engine units, z up,
 *  its front +y), each turned to its facing (0 east, PI/2 south), scaled and stood at (x, y, z) engine units, coloured by
 *  its material (the middle tone): one draw call and one pipeline, never culled, so the warm-up builds it. (Engine z up
 *  to three's y up mirrors: each triangle's last two corners swap, so the faces still look out) */
function shapesMesh(list) {
  const P = [], N = [], C = [], col = new THREE.Color();
  for (const { id, x, y, z, o } of list) {
    const M = E.shapeMesh(id), a = (o.facing === undefined ? Math.PI / 2 : o.facing) - Math.PI / 2, c = Math.cos(a), s = Math.sin(a), k = o.scale || 1;
    for (const g of M ? M.groups : []) {
      col.set(g.mat.hexes[2]);
      for (let i = 0, n = g.pos.length / 3; i < n; i++) {
        const j = (i % 3 === 1 ? i + 1 : i % 3 === 2 ? i - 1 : i) * 3, px = g.pos[j], py = g.pos[j + 1], nx = g.nrm[j], ny = g.nrm[j + 1];
        P.push((x + (px * c - py * s) * k) / U, (z + g.pos[j + 2] * k) / U, (y + (px * s + py * c) * k) / U);
        N.push(nx * c - ny * s, g.nrm[j + 2], nx * s + ny * c); C.push(col.r, col.g, col.b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshLambertNodeMaterial({ vertexColors: true })); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
  return m;
}

const lambert = (map, o) => new THREE.MeshLambertNodeMaterial(Object.assign({ map }, o));
/** a box (w, d, h in units; three's axes) whose faces keep 16 pixels per metre (BoxGeometry stretches 0..1 over a face) */
function boxGeo(w, d, h) {
  const g = new THREE.BoxGeometry(w / U, h / U, d / U), uv = g.attributes.uv, size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // faces: +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * size[f][0] / T, uv.getY(i) * size[f][1] / T); }
  return g;
}
/** a box with two draw groups (its four sides, then top and bottom) instead of six: fewer draw calls */
function sidesThenTops(g) {
  const idx = g.index.array, face = f => Array.from(idx.slice(f * 6, f * 6 + 6));
  g.setIndex([0, 1, 4, 5, 2, 3].flatMap(face)); g.clearGroups(); g.addGroup(0, 24, 0); g.addGroup(24, 12, 1);
  return g;
}
const inst = (geo, mat, n, shadow = true) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.frustumCulled = false; m.count = 0; m.castShadow = m.receiveShadow = shadow; scene.add(m); return m; };
const _m4 = new THREE.Matrix4();

/* the floor: the 2D hall's floor baked once over the whole hall (galleries, stairs and the dais use it too, mapped by
 * where they stand), with a contact shadow at the foot of walls and the rune circle's glow as light it gives off */
const FLOOR_MAT = (() => {
  const w = HW, h = HH, cv = document.createElement('canvas'), gv = document.createElement('canvas'); cv.width = gv.width = w; cv.height = gv.height = h;
  const g = cv.getContext('2d'), gg = gv.getContext('2d'), img = g.createImageData(w, h), gimg = gg.createImageData(w, h), d = img.data, gd = gimg.data;
  const tall = (cx, cy) => '#Pw'.includes(tile(cx, cy)), R = 5;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = Math.floor(x / T), cy = Math.floor(y / T); if (tall(cx, cy)) continue;
    let c = floorTex(x + .5, y + .5); if (!c) continue;
    const ground = tile(cx, cy) !== '=', wall = (a, b) => tall(a, b) || (ground && tile(a, b) === '=');
    const lx = x + .5 - cx * T, ly = y + .5 - cy * T; let ao = 0;   // the engine's contact shadow along the foot of a wall
    if (wall(cx - 1, cy)) ao = Math.max(ao, 1 - lx / R); if (wall(cx + 1, cy)) ao = Math.max(ao, 1 - (T - lx) / R);
    if (wall(cx, cy - 1)) ao = Math.max(ao, 1 - ly / R); if (wall(cx, cy + 1)) ao = Math.max(ao, 1 - (T - ly) / R);
    if (ao > 0) { const k = 1 - .4 * Math.round(ao * 5) / 5; c = [c[0] * k, c[1] * k * .98, c[2] * k * 1.02, c[3]]; }
    const i = (y * w + x) * 4, glow = clamp(c[3] || 0, 0, 1);
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    gd[i] = c[0] * glow; gd[i + 1] = c[1] * glow; gd[i + 2] = c[2] * glow; gd[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); gg.putImageData(gimg, 0, 0);
  const tex = c => { const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; return t; };
  return new THREE.MeshLambertNodeMaterial({ map: tex(cv), emissiveMap: tex(gv), emissive: '#ffffff', emissiveIntensity: 1.6 });
})();
/** a flat polygon at height z (points in units) wearing the floor texture where it stands */
function floorPoly(pts, z) {
  const pos = [], uvs = [], idx = [];
  for (const [x, y] of pts) { pos.push(x / U, z / U, y / U); uvs.push(x / HW, 1 - y / HH); }
  for (let i = 1; i < pts.length - 1; i++) idx.push(0, i + 1, i);   // (counter-clockwise seen from above)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
{
  const floorMesh = new THREE.Mesh(floorPoly([[0, 0], [HW, 0], [HW, HH], [0, HH]], 0), FLOOR_MAT); floorMesh.receiveShadow = true; scene.add(floorMesh);
}

/* walls: an instanced box per tile, and a short twin shown where the wall is cut away in front of an outside camera */
const WALL_CELLS = [];
for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) if (tile(cx, cy) === '#') {
  // which way it faces out of the hall (away from the floor next to it): a camera on that side looks over it
  let ox = (solidTile(cx - 1, cy) ? 0 : -1) + (solidTile(cx + 1, cy) ? 0 : 1), oy = (solidTile(cx, cy - 1) ? 0 : -1) + (solidTile(cx, cy + 1) ? 0 : 1);
  ox = -ox; oy = -oy; if (!ox && !oy) { ox = cx < MW / 2 ? -1 : 1; oy = cy < MH / 2 ? -1 : 1; }
  const l = Math.hypot(ox, oy); WALL_CELLS.push({ cx, cy, ox: ox / l, oy: oy / l });
}
const WALLS = (() => {
  const t = WT['#'], make = h => inst(sidesThenTops(new THREE.BoxGeometry(1, h / U, 1)), [lambert(bake(faceTex(t, h), 16, h, false)), lambert(bake(topTex(t), 16, 16))], WALL_CELLS.length);
  return { full: make(WALL_H), cut: make(CUT_H) };
})();
let wallKey = '';
/** stand the walls: full height, or cut low where cut(cell) says (a cell: { cx, cy, ox, oy }, its outward direction) */
function placeWalls(key, cut) {
  if (key === wallKey) return; wallKey = key;
  let nf = 0, nc = 0;
  for (const c of WALL_CELLS) {
    const isCut = cut && cut(c), h = isCut ? CUT_H : WALL_H;
    (isCut ? WALLS.cut : WALLS.full).setMatrixAt(isCut ? nc++ : nf++, _m4.makeTranslation(c.cx + .5, h / 2 / U, c.cy + .5));   // (a tile is a metre)
  }
  WALLS.full.count = nf; WALLS.full.instanceMatrix.needsUpdate = true; WALLS.cut.count = nc; WALLS.cut.instanceMatrix.needsUpdate = true;
}
placeWalls('none', null);

/* low walls: an instanced box per tile, the 2D hall's low wall colors */
{
  const t = WT.w, cells = []; for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) if (tile(cx, cy) === 'w') cells.push([cx, cy]);
  const m = inst(sidesThenTops(new THREE.BoxGeometry(1, LOW_H / U, 1)), [lambert(bake(faceTex(t, LOW_H), 16, LOW_H, false)), lambert(bake(topTex(t), 16, 16))], cells.length);
  cells.forEach(([cx, cy], i) => m.setMatrixAt(i, _m4.makeTranslation(cx + .5, LOW_H / 2 / U, cy + .5)));
  m.count = cells.length; m.instanceMatrix.needsUpdate = true;
}

/* pillars: a plinth, a shaft of dressed stone and a capital, on each 2 x 2 block. A pillar between an outside camera
 * and the hero is cut down to a stump (placePillars), as the engine cuts walls */
const PILLAR_PARTS = [];
let pillarKey = '';
const _ps3 = new THREE.Vector3();
/** stand the pillars: whole, or cut to a stump where cut(rect) says */
function placePillars(key, cut) {
  if (key === pillarKey) return; pillarKey = key;
  PILLARS.forEach((r, i) => {
    const stump = cut && cut(r), x = (r[0] + r[2] + 1) / 2, y = (r[1] + r[3] + 1) / 2;
    for (const P of PILLAR_PARTS) {
      const z1 = stump ? Math.min(P.z1, P.z0 > 0 ? 14 : P.z1) : P.z1, h = Math.max(0, z1 - P.z0), full = P.z1 - P.z0;
      P.m.setMatrixAt(i, h > 0 ? _m4.compose(_ps3.set(x, (P.z0 + h / 2) / U, y), _bq0, _bs0.set(1, h / full, 1)) : _m4.makeScale(0, 0, 0));
    }
  });
  for (const P of PILLAR_PARTS) { P.m.count = PILLARS.length; P.m.instanceMatrix.needsUpdate = true; }
}
const _bq0 = new THREE.Quaternion(), _bs0 = new THREE.Vector3();
/** does the segment a -> b (engine units) pass through the box [x0, y0, z0] - [x1, y1, z1]? (slabs) */
function segBox(a, b, x0, y0, z0, x1, y1, z1) {
  let t0 = 0, t1 = 1;
  for (let k = 0; k < 3; k++) {
    const lo = k === 0 ? x0 : k === 1 ? y0 : z0, hi = k === 0 ? x1 : k === 1 ? y1 : z1, d = b[k] - a[k];
    if (Math.abs(d) < 1e-9) { if (a[k] < lo || a[k] > hi) return false; continue; }
    let u = (lo - a[k]) / d, v = (hi - a[k]) / d; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false;
  }
  return true;
}
{
  const t = WT.P, n = PILLARS.length;
  const shaftMat = lambert(bake(blockTex(t.side, 16, 8), 16, 16)), capMat = lambert(bake(topTex(t), 16, 16)), edge = lambert(bake(faceTex({ side: E.shade(t.side, .08), line: t.line, course: 4 }, 16), 16, 16));
  // [geometry, materials, from, to (heights)]: plinth 0-6, shaft 6-48, capital 48-52 and 52-56 (the collider is the 2 x 2 block)
  for (const [geo, mats, z0, z1] of [[boxGeo(34, 34, 6), [edge, capMat], 0, 6], [boxGeo(28, 28, 42), [shaftMat, shaftMat], 6, 48], [boxGeo(34, 34, 4), [edge, capMat], 48, 52], [boxGeo(38, 38, 4), [edge, capMat], 52, 56]])
    PILLAR_PARTS.push({ m: inst(sidesThenTops(geo), mats, n), z0, z1 });
  placePillars('none', null);
}

/* galleries: a slab of bricks topped with the floor's flagstones; stairs of dressed stone up to each */
{
  const brick = lambert(bake(faceTex(WT['#'], GALLERY_H), 16, GALLERY_H));
  for (const [x0, y0, x1, y1] of GALLERIES) {
    const a = x0 * T, b = (x1 + 1) * T, n = y0 * T, s = (y1 + 1) * T;
    const top = new THREE.Mesh(floorPoly([[a, n], [b, n], [b, s], [a, s]], GALLERY_H), FLOOR_MAT); top.receiveShadow = true; scene.add(top);
    const side = new THREE.Mesh(boxGeo(b - a, s - n, GALLERY_H - .2), brick); side.position.set((a + b) / 2 / U, (GALLERY_H - .2) / 2 / U, (n + s) / 2 / U);
    side.castShadow = side.receiveShadow = true; scene.add(side);
  }
  const stepTop = lambert(bake(blockTex('#565068', 16, 16), 16, 16)), stepSide = lambert(bake(faceTex({ side: '#4a4360', line: '#302a40', course: 4 }, 16), 16, 16));
  for (const [x0, y0, x1, y1] of STAIRS) {
    const a = x0 * T, b = (x1 + 1) * T, n = y0 * T, s = (y1 + 1) * T, steps = (y1 - y0 + 1) * 2, run = (s - n) / steps;
    for (let k = 0; k < steps; k++) {   // step k (from the bottom): its top at the wedge's height where it ends
      const top = GALLERY_H * (k + 1) / steps, y = s - run * (k + .5);
      const m = new THREE.Mesh(sidesThenTops(boxGeo(b - a, run, top)), [stepSide, stepTop]); m.position.set((a + b) / 2 / U, top / 2 / U, y / U);
      m.castShadow = m.receiveShadow = true; scene.add(m);
    }
  }
}

/* the dais: an octagonal top wearing the rune circle, and its sloped edge in dark dressed stone */
{
  const top = octagon(DAIS.R1, DAIS.h), base = octagon(DAIS.R0, 0);
  const topMesh = new THREE.Mesh(floorPoly(top.map(p => [p[0], p[1]]), DAIS.h), FLOOR_MAT); topMesh.receiveShadow = true; scene.add(topMesh);
  const pos = [], uvs = [], idx = [];
  for (let k = 0; k < 8; k++) {
    const k2 = (k + 1) % 8, quad = [base[k], base[k2], top[k2], top[k]], L = Math.hypot(base[k2][0] - base[k][0], base[k2][1] - base[k][1]), S = Math.hypot(DAIS.R0 - DAIS.R1, DAIS.h);
    const o = pos.length / 3;
    quad.forEach((p, i) => { pos.push(p[0] / U, p[2] / U, p[1] / U); uvs.push(i === 1 || i === 2 ? L / T : 0, i < 2 ? 0 : S / T); });
    idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
  const rim = new THREE.Mesh(g, lambert(bake(blockTex('#4b4559', 16, 8), 16, 16))); rim.receiveShadow = true; scene.add(rim);
}

/* braziers: a stone base, an iron bowl, glowing coals and three flame tongues (the 2D hall's drawBrazier), all thirty
 * in a few instanced meshes; the first N stand (the panel's Torches) */
scene.add(shapesMesh(STORES));   // the stores
const NT = TORCHES.length;
const BRAZ = {
  base: inst(new THREE.BoxGeometry(6 / U, 8 / U, 6 / U), objMat(new THREE.MeshLambertNodeMaterial({ color: '#4c4562' })), NT),
  bowl: inst(new THREE.CylinderGeometry(5.5 / U, 4.2 / U, 3 / U, 10), objMat(new THREE.MeshLambertNodeMaterial({ color: '#2b2430' })), NT, false),   // (a brazier casts no shadow: its own torch sits on it)
  coals: inst(new THREE.CylinderGeometry(4 / U, 4 / U, .4 / U, 10), objMat(new THREE.MeshBasicNodeMaterial({ color: '#ff8a3c' })), NT, false),
  outer: inst(new THREE.ConeGeometry(2.2 / U, 1, 5), objMat(new THREE.MeshBasicNodeMaterial({ color: '#ff7a2a' })), NT * 3, false),
  inner: inst(new THREE.ConeGeometry(2.2 / U, 1, 5), objMat(new THREE.MeshBasicNodeMaterial({ color: '#ffd36a' })), NT * 3, false)
};
BRAZ.base.castShadow = false;
const _bq = new THREE.Quaternion(), _bp = new THREE.Vector3(), _bs = new THREE.Vector3(), _bz = new THREE.Vector3(0, 0, 1);
/** stand the first n braziers; the flames dance as the 2D hall's: three tongues, each with its own height and sway */
function animateBraziers(n, dt) {
  for (let i = 0; i < NT; i++) TORCHES[i].t += dt;
  for (let i = 0; i < n; i++) {
    const b = TORCHES[i], x = b.x / U, z = b.y / U, y0 = b.z / U, t = b.t;
    BRAZ.base.setMatrixAt(i, _m4.makeTranslation(x, y0 + 4 / U, z)); BRAZ.bowl.setMatrixAt(i, _m4.makeTranslation(x, y0 + 9.5 / U, z)); BRAZ.coals.setMatrixAt(i, _m4.makeTranslation(x, y0 + 11.1 / U, z));
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + t * .6, h = (7 + Math.sin(t * 9 + k * 2) * 2.2 + Math.sin(t * 17 + k) * 1.2) / U, sw = Math.sin(t * 6 + k * 1.7) * 1.4 / U, bx = x + Math.cos(a) * 1.6 / U, bz = z + Math.sin(a) * 1.6 / U;
      _bq.setFromAxisAngle(_bz, -sw * 3);
      BRAZ.outer.setMatrixAt(i * 3 + k, _m4.compose(_bp.set(bx + sw * .5, y0 + 11 / U + h / 2, bz), _bq, _bs.set(1, h, 1)));
      BRAZ.inner.setMatrixAt(i * 3 + k, _m4.compose(_bp.set(bx + sw * .3, y0 + 11 / U + h * .65 / 2, bz), _bq, _bs.set(.55, h * .65, .55)));
    }
  }
  for (const [k, m] of Object.entries(BRAZ)) { m.count = k === 'outer' || k === 'inner' ? n * 3 : n; m.instanceMatrix.needsUpdate = true; }
}

/* ---- lights: a fixed set (see the header) ---- */
const FLICKER = t => .9 + Math.sin(t * 13) * .05 + Math.sin(t * 29) * .04 + Math.sin(t * 7.3) * .04;   // the 2D hall's flicker
const LIGHT = { torch: 30, rune: 8, hero: 14, wisp: 10, shot: 10, ambient: 4 };   // intensities (set by eye)
const ambient = new THREE.HemisphereLight('#5a5480', '#241f30', LIGHT.ambient);
scene.add(ambient);
const point = (color, dist, decay = 1) => { const l = new THREE.PointLight(color, 0, dist / U, decay); scene.add(l); return l; };
const TORCH_COLOR = '#ffc8a0', TORCH_REACH = 170;
const torchLights = TORCHES.map(() => point(TORCH_COLOR, TORCH_REACH, .5));
const shadowLights = [0, 1].map(() => { const l = point(TORCH_COLOR, TORCH_REACH, .5); l.shadow.mapSize.set(512, 512); l.shadow.camera.near = .1; l.shadow.camera.far = TORCH_REACH / U; l.shadow.bias = -.002; return l; });
const runeLight = point('#4fe0cc', 90); runeLight.position.set(CXu / U, (DAIS.h + 4) / U, CYu / U);
const heroLight = point('#c9c2ec', 150);
const wispLights = [0, 1, 2, 3].map(() => point('#b78bff', 52));
const shotLights = [0, 1, 2, 3].map(() => point('#ffb347', 40));
/** light the hall: the lit torches (the nearest two through the shadow casters when shadows are on), the rune's glow.
 *  Returns how many lights shine */
function lightHall(t, n, lit, shadows, hx, hy) {
  n = lit ? n : 0;
  let near = [];
  if (shadows && n) near = TORCHES.slice(0, n).map((b, i) => [Math.hypot(b.x - hx, b.y - hy), i]).sort((a, b) => a[0] - b[0]).slice(0, shadowLights.length).map(a => a[1]);
  TORCHES.forEach((b, i) => {
    const L = torchLights[i]; L.position.set(b.x / U, (b.z + 16) / U, b.y / U);
    L.intensity = i < n && !near.includes(i) ? LIGHT.torch * FLICKER(t + b.t) : 0;
  });
  shadowLights.forEach((L, k) => {
    const i = near[k], on = i !== undefined; L.castShadow = !!shadows;
    L.intensity = on ? LIGHT.torch * FLICKER(t + TORCHES[i].t) : 0;
    if (on) L.position.set(TORCHES[i].x / U, (TORCHES[i].z + 16) / U, TORCHES[i].y / U);
  });
  runeLight.intensity = (lit ? LIGHT.rune : 0) * (.5 + .12 * Math.sin(t * 1.7)) / .5;
  ambient.intensity = lit ? LIGHT.ambient : LIGHT.ambient * 2.2;
  return n + (lit ? 1 : 0);
}
