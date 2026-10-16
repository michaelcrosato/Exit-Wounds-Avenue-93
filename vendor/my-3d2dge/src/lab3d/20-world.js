/* =============================================================================
 * THE WORLD: the room, written as text. One character per floor tile (1 metre); row 0 is the far (north) wall.
 *   #  wall (2.5 m)        P  pillar (2.9 m)       T  wall with a torch on its room side
 *   .  floor               c  a crate              C  two crates, stacked
 *   m  the mocap figure    d  Dan                  (the hero walks a lap round the pillars; 30-physics)
 * Everything here is what you see; 30-physics builds the colliders from the same map. To change the level, edit MAP.
 *   ROOM                   { W, H, cells: [{ x, z, kind }], crates: [...], spots: { m, d }, centre }
 *   scene, room meshes     walls (full and cut-away), pillars, floor, crate meshes (syncCrates moves them to their bodies)
 *   torches, sun, fill     the lights; the torches flicker (a look only, from the clock)
 *   setCutaway(dir)        lowers the walls between the camera and the room (dir: the camera's ground direction)
 * ============================================================================= */
const MAP = [
  '###T#####T###',
  '#...........#',
  '#...........#',
  '#..P..m..P..#',
  '#......c....#',
  'T....C......T',
  '#.....c.c...#',
  '#..P..d..P..#',
  '#...........#',
  '#...........#',
  '#############'
];
const WALL_H = 2.5, PILLAR_H = 46 / U, CUT_H = 6 / U, CRATE = .75;   // heights as the free camera room's (40 and 46 units, cut to 6)
const BG = '#0d0b14';
const ROOM = { W: MAP[0].length, H: MAP.length, cells: [], crates: [], spots: {}, torches: [] };
ROOM.centre = new THREE.Vector3(ROOM.W / 2, 0, ROOM.H / 2);
MAP.forEach((row, z) => [...row].forEach((ch, x) => {
  if (ch === '#' || ch === 'T') ROOM.cells.push({ x, z, kind: 'wall', torch: ch === 'T' });
  else if (ch === 'P') ROOM.cells.push({ x, z, kind: 'pillar' });
  else if (ch === 'c') ROOM.crates.push({ x: x + .5, y: CRATE / 2, z: z + .5, yaw: (E.hash2(x, z) - .5) * .5 });
  else if (ch === 'C') ROOM.crates.push({ x: x + .5, y: CRATE / 2, z: z + .5, yaw: 0 }, { x: x + .45, y: CRATE * 1.5 + .002, z: z + .52, yaw: .35 });
  else if (ch === 'm' || ch === 'd') ROOM.spots[ch] = { x: x + .5, z: z + .5 };
}));
/** the room's stores in its four corners, clear of the hero's lap and the proof run: the engine's core shapes
 *  (docs/ASSETS.md) as meshes from E.shapeMesh, solid in 30-physics [id, x, z (metres), facing, scale] */
const STORES = [['barrel', 1.45, 1.45, 0, .9], ['crate', 11.5, 1.5, .3, .9], ['sack', 1.5, 9.5, .6, 1], ['chest', 11.45, 9.5, -Math.PI / 2, 1]]
  .map(([id, x, z, facing, scale]) => ({ id, x: x * U, y: z * U, z: 0, o: { facing, scale } }));
const solid = (x, z) => { const r = MAP[z]; return !r || x < 0 || x >= r.length || r[x] === '#' || r[x] === 'T'; };

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);

/* a box whose texture keeps 16 pixels per metre on every face (BoxGeometry's own UVs stretch 0..1 over each face) */
function box(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // faces: +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * size[f][0], uv.getY(i) * size[f][1]); }
  return g;
}
const sideTop = side => [side, side, MAT.top, MAT.top, side, side];   // a material for each face of a box: textured sides, worn top

/* walls and pillars: one box per cell. Walls have a short twin (the cut-away) shown when the camera looks over them */
const WALL_FULL = box(1, WALL_H, 1), WALL_CUT = box(1, CUT_H, 1), PILLAR = box(1, PILLAR_H, 1);
const walls = [];
for (const c of ROOM.cells) {
  if (c.kind === 'pillar') {
    const m = new THREE.Mesh(PILLAR, sideTop(MAT.pillar)); m.position.set(c.x + .5, PILLAR_H / 2, c.z + .5);
    m.castShadow = m.receiveShadow = true; scene.add(m); c.mesh = m; continue;
  }
  const full = new THREE.Mesh(WALL_FULL, sideTop(MAT.brick)), cut = new THREE.Mesh(WALL_CUT, sideTop(MAT.brick));
  full.position.set(c.x + .5, WALL_H / 2, c.z + .5); cut.position.set(c.x + .5, CUT_H / 2, c.z + .5); cut.visible = false;
  full.castShadow = full.receiveShadow = cut.receiveShadow = true;
  scene.add(full, cut);
  // which way the wall faces out of the room (the side away from the floor): the camera on that side looks over it
  const out = new THREE.Vector2((solid(c.x - 1, c.z) ? 0 : -1) + (solid(c.x + 1, c.z) ? 0 : 1), (solid(c.x, c.z - 1) ? 0 : -1) + (solid(c.x, c.z + 1) ? 0 : 1)).negate();
  if (!out.lengthSq()) out.set(c.x < ROOM.W / 2 ? -1 : 1, c.z < ROOM.H / 2 ? -1 : 1);   // a corner: outward on both axes
  walls.push({ c, full, cut, out: out.normalize(), torch: null });
}

/* the floor: one texture over the whole room, so every flagstone is where the engine would put it */
const floorTex = bake(TEX.floor, ROOM.W * U, ROOM.H * U); floorTex.wrapS = floorTex.wrapT = THREE.ClampToEdgeWrapping;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W, ROOM.H), lambert(floorTex));
floor.rotation.x = -Math.PI / 2; floor.position.set(ROOM.W / 2, 0, ROOM.H / 2); floor.receiveShadow = true;
scene.add(floor);

/* crates: meshes only; 30-physics owns their bodies, and syncCrates() puts each mesh where its body is, every frame */
const CRATE_GEO = new THREE.BoxGeometry(CRATE, CRATE, CRATE);
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
scene.add(shapesMesh(STORES));
const crateMeshes = ROOM.crates.map(k => { const m = new THREE.Mesh(CRATE_GEO, MAT.crate); m.position.set(k.x, k.y, k.z); m.rotation.y = k.yaw; m.castShadow = m.receiveShadow = true; scene.add(m); return m; });
function syncCrates(bodies) {
  bodies.forEach((c, i) => { const t = c.body.translation(), r = c.body.rotation(); crateMeshes[i].position.set(t.x, t.y, t.z); crateMeshes[i].quaternion.set(r.x, r.y, r.z, r.w); });
}

/* light: a sun from the upper left (the engine's light direction) with real shadows, a cool fill, and torches */
const fill = new THREE.HemisphereLight('#a99cc8', '#2a2430', 1.1);
const sun = new THREE.DirectionalLight('#fff0d8', 2.4);
sun.position.copy(ROOM.centre).add(new THREE.Vector3(-.55, .76, -.35).normalize().multiplyScalar(20)); sun.target.position.copy(ROOM.centre);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0006; sun.shadow.normalBias = .02;
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 45 });
scene.add(fill, sun, sun.target);
for (const w of walls) if (w.c.torch) {
  const dir = w.out.clone().negate(), at = new THREE.Vector3(w.c.x + .5 + dir.x * .56, 1.55, w.c.z + .5 + dir.y * .56);
  const g = new THREE.Group(); g.position.copy(at);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(.1, .32, .1), MAT.bracket); bracket.position.y = -.1;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.09, .26, 6), MAT.flame); flame.position.y = .18;
  const core = new THREE.Mesh(new THREE.ConeGeometry(.045, .14, 6), MAT.flameCore); core.position.y = .14;
  const light = new THREE.PointLight('#ffa850', 3.2, 7.5, 1.6); light.position.set(dir.x * .25, .3, dir.y * .25);
  g.add(bracket, flame, core, light); scene.add(g);
  w.torch = g; ROOM.torches.push({ g, flame, light, seed: w.c.x * 7 + w.c.z });
}
/** the torches flicker: a look only, from the render clock (gameplay never reads it) */
function flicker(t) {
  for (const T of ROOM.torches) {
    const n = Math.sin(t * 13 + T.seed) * .5 + Math.sin(t * 7.3 + T.seed * 2) * .3 + Math.sin(t * 23 + T.seed) * .2;
    T.light.intensity = 3.2 + n * .6; T.flame.scale.set(1 + n * .08, 1 + n * .22, 1 + n * .08);
  }
}
/** cut away the walls between the camera and the room, as the engine does: dir is the camera's direction on the
 *  ground from the room (null: no cut, e.g. a camera inside the room); flat = a near-level camera, which hides them */
function setCutaway(dir, flat) {
  for (const w of walls) {
    const cut = !!dir && w.out.x * dir.x + w.out.y * dir.y > .3;
    w.full.visible = !cut; w.cut.visible = cut && !flat;
    if (w.torch) w.torch.visible = !cut;
  }
}
