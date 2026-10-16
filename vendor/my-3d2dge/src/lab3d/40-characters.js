/* =============================================================================
 * THE CAST: the hero, a mocap figure and Dan. Each keeps its engine rig unchanged, posed from the gameplay state
 * (30-physics) every fixed step, and is shown as a Card, a Puppet, or both (the panel's Characters switch).
 *   CAST = [{ id, rig, card, puppet, blob, pose(dt), trail() }]
 *   Card    the engine draws the rig (rig.draw) from the camera's angle into a canvas at the game's pixel size,
 *           outlined as its sprites are, on a card facing the camera: the exact look; flat, at one depth, shaded by
 *           its own tone ramps (the scene's lights don't reach it); a blob shadow under it, as in the engine.
 *   Puppet  the rig's joints wear 3D parts listed as data, a body (humanBody, danBody below). Each part is a line:
 *             ['limb', a, b, ra, rb, color]          a tapered capsule from point a to point b (radii in engine units)
 *             ['ball', a, r, color]                  a sphere           ['eye', a, r, color]  a small unlit sphere
 *             ['curve', a, b, bow, ra, rb, color]    a limb bowed away from the body by bow x its length (scythes)
 *             ['sword']                              grip, guard and blade along the rig's J.bladeDir
 *             ['cape']                               the rig's own cloth (rig.capeL / rig.capeR), both sides
 *           A point is a joint name ('kneeL'), ['lerp', a, b, t] (between two points) or ['off', a, f, r, z] (a point
 *           moved forward, right and up in the body's own frame). Same motion; real depth, light and shadow.
 *   The swing's trail: trail() gives [[base, tip], ...] in engine world units; the card draws it into its picture,
 *   the puppet makes a 3D ribbon of it.
 * A new character: any engine rig (J, x, y, z, _w, update, draw), a body list, and an entry in CAST.
 * ============================================================================= */
const UP = new THREE.Vector3(0, 1, 0);
const OUTLINES = [];   // every outline shell (puppets, crates, pillars): the Outlines switch shows or hides them all
function shell(mesh, mode) { const o = new THREE.Mesh(mesh.geometry, outlineMat(mode)); o.castShadow = false; mesh.add(o); OUTLINES.push(o); return o; }
for (const m of [...crateMeshes, ...ROOM.cells.filter(c => c.mesh).map(c => c.mesh)]) shell(m, 'center');   // crates and pillars

/* ---- bodies: the parts each rig wears in Puppet mode ---- */
/** a Humanoid's body, from its own build (limb and torso widths, head size) and colors, as its _drawHD sizes them */
function humanBody(rig) {
  const o = rig.o, C = rig.C, lw = o.limbW / 2, R = o.headR, P = [];
  const upper = o.sleeves === 'none' ? C.skin : C.cloth, lower = o.sleeves === 'long' ? C.cloth : C.skin;
  for (const s of ['L', 'R']) {
    const ank = ['lerp', 'knee' + s, 'foot' + s, .62];
    P.push(['limb', 'hip' + s, 'knee' + s, 1.45 * lw, 1.2 * lw, C.pants], ['limb', 'knee' + s, ank, 1.2 * lw, 1.05 * lw, C.pants],
      ['limb', ank, 'foot' + s, 1.15 * lw, 1.05 * lw, C.boot], ['limb', 'foot' + s, ['off', 'foot' + s, 1.9, 0, .3], 1 * lw, .85 * lw, C.boot],
      ['limb', 'sh' + s, 'elbow' + s, 1.15 * lw, 1 * lw, upper], ['limb', 'elbow' + s, 'hand' + s, 1 * lw, .9 * lw, lower], ['ball', 'hand' + s, .82 * lw, C.glove || C.skin]);
  }
  P.push(['limb', 'hipL', 'hipR', 1.45 * lw, 1.45 * lw, C.pants],                                                  // hips
    ['limb', ['off', 'hipC', 0, 0, .8], ['off', 'shC', 0, 0, -.4], o.torsoW * .62, o.torsoW * .72, C.cloth],        // the torso's core
    ['limb', 'shL', 'shR', 1.2 * lw, 1.2 * lw, C.cloth],                                                            // shoulders
    ['limb', ['off', 'hipL', 0, -.3, .7], ['off', 'hipR', 0, .3, .7], o.torsoW * .66, o.torsoW * .66, C.belt],      // the belt
    ['limb', ['off', 'shC', 0, 0, -.2], ['off', 'head', 0, 0, -R * .6], .75, .75, C.skin],                         // neck
    ['ball', ['off', 'head', R * .1, 0, -R * .05], R * .9, C.skin],                                                  // the face
    ['ball', ['off', 'head', -R * .32, 0, R * .16], R * .96, C.hair], ['ball', ['off', 'head', -R * .1, 0, R * .62], R * .72, C.hair],   // hair: the mass behind, the cap
    ['ball', ['off', 'head', R * .5, 0, R * .5], R * .42, C.hair],                                                   // the fringe
    ['eye', ['off', 'head', R * .86, -R * .36, -R * .02], .42, C.eye], ['eye', ['off', 'head', R * .86, R * .36, -R * .02], .42, C.eye]);
  if (o.weapon === 'sword') P.push(['sword']);
  if (o.cape) P.push(['cape']);
  return P;
}
/** Dan's body (Emberdeep's colors): reverse-kneed legs with talons, a heavy tail, a ribbed carapace with spines, a
 *  horned head with violet eyes, two bone scythes, egg sacs on the hips */
function danBody() {
  const C = DanRig.COL, P = [];
  for (const s of ['L', 'R']) {
    const sd = s === 'L' ? -1 : 1;
    P.push(['limb', 'hip' + s, 'knee' + s, 2.5, 1.7, C.chitin], ['limb', 'knee' + s, 'hock' + s, 1.6, 1.1, C.under], ['limb', 'hock' + s, 'foot' + s, 1.05, .85, C.under]);
    for (const dr of [-1.4, 0, 1.4]) P.push(['limb', 'foot' + s, ['off', 'foot' + s, dr ? 3 : 3.6, sd * dr * .9, -.4], .5, .15, C.bone]);
    P.push(['limb', 'sh' + s, 'elbow' + s, 1.9, 1.5, C.chitin], ['limb', 'elbow' + s, 'hand' + s, 1.5, 1.7, C.chitin], ['curve', 'hand' + s, 'tip' + s, .2, 1.3, .2, C.bone]);
    for (let j = 0; j < 3; j++) P.push(['ball', ['off', 'hipC', -1.2 + j * 1.5, sd * (4.4 + (j === 1 ? .9 : 0)), -1.6 + (j === 1 ? 1.4 : 0) - j * .3], 1.3, C.sac]);
  }
  for (let i = 1; i <= 5; i++) P.push(['limb', 'tail' + (i - 1), 'tail' + i, Math.max(.6, 2.7 - i * .42), Math.max(.45, 2.7 - (i + 1) * .42), i < 2 ? C.chitin : C.under]);
  P.push(['ball', 'hipC', 4, C.under], ['limb', 'hipC', 'shC', 3.6, 3.4, C.chitin], ['limb', ['off', 'hipC', -.4, 0, 1.7], ['off', 'shC', -.6, 0, 1.9], 2.3, 2.1, C.plate]);
  for (let i = 0; i < 6; i++) { const u = i / 5, b = ['off', ['lerp', 'hipC', 'shC', u], -1.2, 0, 2.6 + Math.sin(u * Math.PI) * .6]; P.push(['limb', b, ['off', b, -1.3, 0, 2.2 + Math.sin(u * Math.PI) * 1.8], .9, .1, C.plate]); }
  P.push(['limb', 'shC', 'neck', 2, 1.7, C.chitin], ['limb', 'neck', 'head', 1.7, 2, C.chitin], ['ball', 'head', 2.4, C.chitin],
    ['limb', 'head', 'snout', 1.9, .7, C.chitin], ['limb', 'head', 'crest', 1.1, .15, C.plate]);
  for (const sd of [-1, 1]) P.push(['limb', ['off', 'head', -.6, sd * 1.3, 1.6], ['off', 'head', -3.2, sd * 2.6, 5], .8, .12, C.plate], ['eye', ['off', 'head', 2, sd * 1.2, .7], .45, C.eye]);
  return P;
}

/* ---- where a body point is, in the world ---- */
/** a point spec -> the rig's local frame (f, r, z) (a plain [f, r, z] passes through). For a Humanoid, 'off' goes through
 *  the rig's own _offsets (sp, made once per frame), so a face follows a clip's head and a knocked-down body's details turn with it */
function localPoint(rig, p, sp) {
  if (typeof p === 'string') return rig.J[p];
  if (typeof p[0] === 'number') return p;
  if (p[0] === 'lerp') { const a = localPoint(rig, p[1], sp), b = localPoint(rig, p[2], sp), t = p[3]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  const a = localPoint(rig, p[1], sp);
  return sp ? sp(a, p[2], p[3], p[4]) : [a[0] + p[2], a[1] + p[3], a[2] + p[4]];
}
/** local (f, r, z) -> three.js world (metres) */
function worldPoint(rig, local, out = new THREE.Vector3()) { const w = rig._w(local); return toThree(rig.x + w[0], rig.y + w[1], rig.z + w[2], out); }

/* ---- Puppet: meshes for the parts, moved onto the joints every frame ---- */
const _geo = new Map();
const sphereGeo = r => { const k = 's' + r.toFixed(3); if (!_geo.has(k)) _geo.set(k, new THREE.SphereGeometry(r, 12, 8)); return _geo.get(k); };
const tubeGeo = (ra, rb) => new THREE.CylinderGeometry(rb, ra, 1, 10, 1, true);   // bottom (y -0.5) is a, top (y +0.5) is b
const BLADE = new THREE.BoxGeometry(1, 1, 1);
class Puppet {
  constructor(rig, body) {
    this.rig = rig; this.group = new THREE.Group(); this.parts = [];
    const mesh = (geo, color, outline = 'normal', glow = false) => {
      const m = new THREE.Mesh(geo, toonMat(color, glow)); m.castShadow = !glow; m.receiveShadow = !glow;
      if (outline) shell(m, outline); this.group.add(m); return m;
    };
    for (const spec of body) {
      const [kind] = spec, P = { spec, m: [] };
      if (kind === 'limb' || kind === 'curve') {
        const segs = kind === 'curve' ? 3 : 1, ra = spec[kind === 'curve' ? 4 : 3] / U, rb = spec[kind === 'curve' ? 5 : 4] / U, col = spec[kind === 'curve' ? 6 : 5];
        for (let i = 0; i < segs; i++) { const r0 = lerp(ra, rb, i / segs), r1 = lerp(ra, rb, (i + 1) / segs); P.m.push(mesh(tubeGeo(r0, r1), col), mesh(sphereGeo(r1), col)); }
        P.m.push(mesh(sphereGeo(ra), col));
      } else if (kind === 'ball') P.m.push(mesh(sphereGeo(spec[2] / U), spec[3]));
      else if (kind === 'eye') P.m.push(mesh(sphereGeo(spec[2] / U), spec[3], null, true));
      else if (kind === 'sword') {
        const C = rig.C;
        P.m.push(mesh(BLADE, C.metal, 'center'), mesh(BLADE, C.hilt, 'center'), mesh(tubeGeo(.4 / U, .4 / U), '#5a3620'));
      } else if (kind === 'cape') P.cape = null;   // built on the first frame the rig has cloth
      this.parts.push(P);
    }
    this.ribbon = makeRibbon(); this.group.add(this.ribbon.mesh);
  }
  /** move every part onto the rig's joints (the rig's cheated three-quarter turn is a 2D trick: off for 3D) */
  update(trail) {
    const rig = this.rig, cheat = rig._cheat; rig._cheat = 0;
    const sp = rig._offsets ? rig._offsets((f, r, z) => [f, r, z]) : null, W = p => worldPoint(rig, localPoint(rig, p, sp));
    for (const P of this.parts) {
      const s = P.spec, kind = s[0];
      if (kind === 'limb') { placeTube(P.m[0], W(s[1]), W(s[2])); P.m[1].position.copy(W(s[2])); P.m[2].position.copy(W(s[1])); }
      else if (kind === 'curve') {
        const a = W(s[1]), b = W(s[2]), L = a.distanceTo(b), c = W('shC'), ab = b.clone().sub(a).normalize();
        const out = a.clone().add(b).multiplyScalar(.5).sub(c); out.addScaledVector(ab, -out.dot(ab)).normalize();
        const pts = [0, 1, 2, 3].map(i => { const u = i / 3; return a.clone().lerp(b, u).addScaledVector(out, s[3] * L * 4 * u * (1 - u)); });
        for (let i = 0; i < 3; i++) { placeTube(P.m[i * 2], pts[i], pts[i + 1]); P.m[i * 2 + 1].position.copy(pts[i + 1]); }
        P.m[6].position.copy(a);
      } else if (kind === 'ball' || kind === 'eye') P.m[0].position.copy(W(s[1]));
      else if (kind === 'sword') {
        const J = rig.J, bd = J.bladeDir, L = rig.o.bladeLen, at = (k) => W([J.handR[0] + bd[0] * k, J.handR[1] + bd[1] * k, J.handR[2] + bd[2] * k]);
        const fl = Math.hypot(bd[0], bd[1]) > 1e-3 ? [-bd[1], bd[0]] : [0, 1];   // flat of the blade: across the swing, as the engine draws it (a blade held straight up: the body's right)
        const across = W([J.handR[0] + fl[0], J.handR[1] + fl[1], J.handR[2]]).sub(W(J.handR)).normalize();
        placeBox(P.m[0], at(1.5), at(L), across, 1.3 / U, .25 / U);    // the blade
        placeBox(P.m[1], at(1.3), at(1.7), across, 3.6 / U, .5 / U);    // the guard (wide across, short along)
        placeTube(P.m[2], at(-1.5), at(1.3));                           // the grip
      } else if (kind === 'cape' && rig.capeL) {
        if (!P.cape) { P.cape = makeCape(rig); this.group.add(P.cape.front, P.cape.back); }
        P.cape.update(rig);
      }
    }
    this.ribbon.update(trail);
    rig._cheat = cheat;
  }
}
/** a tube mesh (height 1 on y) from a to b */
const _d = new THREE.Vector3();
function placeTube(m, a, b) {
  _d.subVectors(b, a); const L = _d.length();
  m.visible = L > 1e-4; if (!m.visible) return;
  m.position.addVectors(a, b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(UP, _d.divideScalar(L)); m.scale.set(1, L, 1);
}
/** a box from a to b (its length), w wide along `across`, t thick */
const _m4 = new THREE.Matrix4(), _x = new THREE.Vector3(), _z = new THREE.Vector3();
function placeBox(m, a, b, across, w, t) {
  _d.subVectors(b, a); const L = _d.length() || 1e-4; _d.divideScalar(L);
  _z.crossVectors(across, _d).normalize(); _x.crossVectors(_d, _z);
  m.position.addVectors(a, b).multiplyScalar(.5); m.quaternion.setFromRotationMatrix(_m4.makeBasis(_x, _d, _z));
  m.scale.set(w, L, t);
}
/** the rig's cape as cloth in 3D: the strip between its two verlet edges, the outside in the cape's color, the inside darker */
function makeCape(rig) {
  const n = rig.capeL.length, pos = new Float32Array(n * 2 * 3), idx = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
  const mat = side => new THREE.MeshToonNodeMaterial({ color: side === THREE.FrontSide ? rig.C.cape : rig.C.capeIn, gradientMap: TOON_BANDS, side });
  const front = new THREE.Mesh(geo, mat(THREE.FrontSide)), back = new THREE.Mesh(geo, mat(THREE.BackSide));
  front.castShadow = back.castShadow = true; front.frustumCulled = back.frustumCulled = false;
  const v = new THREE.Vector3();
  return { front, back, update(r) {
    for (let i = 0; i < n; i++) for (const [k, P] of [[0, r.capeL[i]], [1, r.capeR[i]]]) { toThree(P.x, P.y, P.z, v); pos.set([v.x, v.y, v.z], (i * 2 + k) * 3); }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
  } };
}
/** a swing's trail as a 3D ribbon: pairs of [base, tip] points (engine world units), newest last. It adds light, so
 *  its color fading to black along its length fades it out */
function makeRibbon(max = 12) {
  const pos = new Float32Array(max * 2 * 3), col = new Float32Array(max * 2 * 3), idx = [];
  for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicNodeMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  mesh.frustumCulled = false; mesh.castShadow = false;
  const v = new THREE.Vector3();
  return { mesh, update(pairs) {
    const n = Math.min(max, pairs.length); mesh.visible = n > 1; if (n < 2) return;
    for (let i = 0; i < n; i++) {
      const [b, t] = pairs[pairs.length - n + i], k = ((i + 1) / n) ** 1.5 * .8;   // the newest brightest
      toThree(b[0], b[1], b[2], v); pos.set([v.x, v.y, v.z], i * 6); toThree(t[0], t[1], t[2], v); pos.set([v.x, v.y, v.z], i * 6 + 3);
      col.set([k * .5, k * .6, k * .7, k, k, k], i * 6);   // dimmer at the blade's base, white at its tip
    }
    geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true; geo.setDrawRange(0, (n - 1) * 6);
  } };
}

/* ---- Card: the engine's own drawing on a card that faces the camera ---- */
const PLANE = new THREE.PlaneGeometry(1, 1);
class Card {
  /** extent: how many engine units across the picture must hold (the rig with its weapon raised) */
  constructor(rig, extent) {
    this.rig = rig; this.extent = extent; this.N = 0;
    this.cv = document.createElement('canvas'); this.out = document.createElement('canvas');
    this.g = this.cv.getContext('2d', { willReadFrequently: false }); this.go = this.out.getContext('2d');
    this.view = new E.View('card', 'Card', 0, 30, 1, 1);
    this.mat = new THREE.MeshBasicNodeMaterial({ alphaTest: .5 });
    this.mesh = new THREE.Mesh(PLANE, this.mat); this.mesh.castShadow = false;
  }
  /** draw the rig from the camera's angle (v: CAMS.cardView at the rig) and stand the card where the rig is */
  draw(v, trail) {
    const rig = this.rig, s = clamp(Math.round(v.ppm / U * 16) / 16, .5, 6);   // the game's pixels per engine unit
    const N = clamp(2 ** Math.ceil(Math.log2(this.extent * s)), 64, 512);
    if (N !== this.N) {   // a new size: new canvases and texture (a texture's size is fixed on the GPU)
      this.N = this.cv.width = this.cv.height = this.out.width = this.out.height = N;
      if (this.mat.map) this.mat.map.dispose();
      const t = new THREE.CanvasTexture(this.out); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
      this.mat.map = t; this.mat.needsUpdate = true;
    }
    const g = this.g, ox = N / 2, oy = Math.round(N * .72);
    g.clearRect(0, 0, N, N);
    this.view.set(Math.round(v.yaw), Math.round(v.pitch), s, v.boost);
    rig.draw(g, ox, oy, this.view);
    const lv = rig._lastView || this.view;   // the view the rig really drew with (a steep view draws characters from lower)
    if (trail.length > 1) {   // the swing's trail, in the view the body used: a fading ribbon of light
      const P = p => [ox + lv.ax * (p[0] - rig.x) + lv.ay * (p[1] - rig.y), oy + lv.bx * (p[0] - rig.x) + lv.by * (p[1] - rig.y) + lv.bz * (p[2] - rig.z)];
      for (let i = 1; i < trail.length; i++) {
        const [b0, t0] = trail[i - 1], [b1, t1] = trail[i], k = i / trail.length;
        g.globalAlpha = .35 + .5 * k; E.px.poly(g, [P(b0), P(t0), P(t1), P(b1)], k > .6 ? '#ffffff' : '#bfe4ff');
      }
      g.globalAlpha = 1;
    }
    // the outline the engine gives its sprites: the picture grown by a pixel each way, in the outline color, under it
    const go = this.go; go.clearRect(0, 0, N, N);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) go.drawImage(this.cv, dx, dy);
    go.globalCompositeOperation = 'source-in'; go.fillStyle = OUTLINE; go.fillRect(0, 0, N, N); go.globalCompositeOperation = 'source-over';
    go.drawImage(this.cv, 0, 0);
    this.mat.map.needsUpdate = true;
    // stand it up: facing the camera, the rig's feet on its feet, nudged toward the camera so the floor can't cut it
    const root = toThree(rig.x, rig.y, rig.z), m = this.mesh;
    m.quaternion.copy(v.quaternion); m.scale.set(N / v.ppm, N / v.ppm / v.vert, 1);
    m.position.copy(root).addScaledVector(v.right, (N / 2 - ox) / v.ppm).addScaledVector(v.up, (oy - N / 2) / (v.ppm * v.vert)).addScaledVector(v.back, .45);
  }
}

/* ---- the cast ---- */
const LIBS = { HERO: Mocap.load(window.MOCAP.HERO), CMU: Mocap.load(window.MOCAP.CMU) };
/** the mocap figure's programme: [set, clip, seconds (0: the clip's own length)] */
const FIG_CLIPS = [['CMU', 'Jumping_Jacks_Loop', 3.2], ['HERO', 'Victory', 0], ['CMU', 'Roundhouse_Kick', 0], ['CMU', 'Cartwheel', 0], ['CMU', 'Punch_Combo', 0], ['HERO', 'Idle_FoldArms_Loop', 3]];
const BLOB = new THREE.CircleGeometry(1, 20);
function member(id, rig, body, extent, blobR) {
  const c = { id, rig, card: new Card(rig, extent), puppet: new Puppet(rig, body), blob: new THREE.Mesh(BLOB, MAT.shadowBlob), pairs: [] };
  c.blob.rotation.x = -Math.PI / 2; c.blob.scale.setScalar(blobR); c.blob.renderOrder = 1;
  return c;
}
const heroRig = new E.Humanoid({ cape: { len: 6, width: 5, seg: 2.5 } });
const figRig = new E.Humanoid({ weapon: null, hair: 'ponytail', colors: { cloth: '#4d6fc4', pants: '#2e2a40', hair: '#e8c070', boot: '#3a2a24' } });
const danRig = new DanRig(null);
const CAST = [member('hero', heroRig, humanBody(heroRig), 90, .42), member('figure', figRig, humanBody(figRig), 90, .4), member('dan', danRig, danBody(), 120, .7)];
const [HEROC, FIGC, DANC] = CAST;
const FIG = { i: 0, t: 0, pose: null };
/** pose every rig from the gameplay state, one fixed step (the rigs are the engine's; this is their only input) */
function poseCast(dt) {
  const h = SIM.hero, D = SIM.dan, F = SIM.figure;
  heroRig.update(dt, { x: h.x * U, y: h.z * U, z: h.y * U, vx: h.moved[0] * U, vy: h.moved[1] * U, facing: h.facing, dash: h.dashT > 0, attack: h.combo.state });
  HEROC.pairs = heroRig.trail.map(p => [p.b, p.t]);
  // the figure: each clip in turn, faded in and out over the rig's own idle
  let [set, name, len] = FIG_CLIPS[FIG.i]; const lib = LIBS[set], clip = lib.clip(name), dur = len || clip.dur;
  if (FIG.lib !== lib) { Mocap.drive(figRig, lib); FIG.lib = lib; }
  FIG.pose = lib.sample(clip, FIG.t, FIG.pose || undefined);
  figRig.mocap = FIG.pose; figRig.mocapW = clamp(Math.min(FIG.t / .25, (dur - FIG.t) / .25), 0, 1);
  figRig.update(dt, { x: F.x * U, y: F.z * U, z: 0, facing: F.facing });
  FIG.t += dt; if (FIG.t >= dur) { FIG.t = 0; FIG.i = (FIG.i + 1) % FIG_CLIPS.length; FIG.pose = null; }
  // Dan: his timetable's swings and roar, a flinch when the hero hits him; his trail follows the swinging scythe's tip
  const atk = D.atk ? D.atk.state : null;
  danRig.update(dt, { x: D.x * U, y: D.z * U, z: 0, facing: D.facing, attack: atk, dan: D.roar > 0 ? 'roar' : null, hurt: D.hurt > 0 });
  if (atk && atk.phase === 'active') {
    const side = atk.spec.hand === 'L' ? 'L' : 'R', J = danRig.J, base = E.V3.lerp(J['hand' + side], J['tip' + side], .4);
    const at = p => { const w = danRig._w(p); return [danRig.x + w[0], danRig.y + w[1], danRig.z + w[2]]; };
    DANC.pairs.push([at(base), at(J['tip' + side])]); if (DANC.pairs.length > 8) DANC.pairs.shift();
  } else if (DANC.pairs.length) DANC.pairs.shift();
}
