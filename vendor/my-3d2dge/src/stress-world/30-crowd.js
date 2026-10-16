/* =============================================================================
 * THE CHARACTERS: the hero, walkers (husks, skeletons, knights; HD or classic), slimes, wisps and the fallen, each as
 * its rig stands (20-sim poses every rig; this only reads them), and the crates and barrels where their bodies are.
 *   Puppet  3D parts hung on each rig's joints, in shared instanced batches so thousands of monsters cost a handful of
 *           draw calls: Batch.tube(a, b, r), .ball(p, rx, ry, rz), .box(...), .cone(...). A walker is about twenty parts
 *           sized from its own build (limbW, torsoW, headR) and colored from its own palette (rig.C); a slime is its
 *           body squashed as the Blob squashes, with eyes, horns, ears or wings
 *   Card    the engine draws each rig into a sprite atlas (fixed pages: only the pages in use upload), outlined as its
 *           sprites are, and an instanced card shows each cell where the monster stands, facing the camera, drawn
 *           from the camera's own turn and tilt at about the screen's pixel size where the hero stands
 *   Wisps are glowing orbs in both looks. Hit flashes tint toward the 2D page's flash color; spawning monsters rise
 *   out of the floor and the fallen sink into it. A blob shadow lies on the floor under every body (under a thrown one
 *   too, so its height shows).
 *   drawCrowd(o) is called by the frame; it returns how many characters it drew and marks them (with "skip off-screen
 *   animation" the rest don't pose)
 * ============================================================================= */
const FLASH = lin('#ffe6d8');
const _m = new THREE.Matrix4();
/** an instanced batch of one shape: write parts with tube / ball / box / cone between begin() and end() */
class Batch {
  constructor(geo, mat, o = {}) { this.geo = geo; this.mat = mat; this.o = o; this.cap = 0; this.n = 0; this.grow(o.cap || 2048); }
  grow(cap) {
    const old = this.mesh;
    const mk = mat => { const m = new THREE.InstancedMesh(this.geo, mat, cap); m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
    const mesh = mk(this.mat);
    // (no DynamicDrawUsage: in r182 an instanced mesh over 1,000 slots marked dynamic never uploads its changes)
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    mesh.castShadow = !!this.o.shadow; mesh.receiveShadow = !!this.o.shadow; mesh.renderOrder = this.o.order || 0;
    if (old) { mesh.instanceMatrix.array.set(old.instanceMatrix.array); mesh.instanceColor.array.set(old.instanceColor.array); scene.remove(old); old.dispose(); }
    if (this.shell) { scene.remove(this.shell); this.shell.dispose(); }
    this.shell = this.o.outline ? mk(outlineMat(this.o.outline)) : null;
    if (this.shell) this.shell.instanceMatrix = mesh.instanceMatrix;   // the outline shell shares the parts' matrices
    this.mesh = mesh; this.M = mesh.instanceMatrix.array; this.C = mesh.instanceColor.array; this.cap = cap;
  }
  begin() { this.n = 0; }
  /** one instance from its basis columns (x, y, z axes with their lengths) and its centre */
  put(ax, ay, az, bx, by, bz, cx, cy, cz, tx, ty, tz, col) {
    if (this.n >= this.cap) this.grow(this.cap * 2);
    const M = this.M, i = this.n * 16, k = this.n * 3; this.n++;
    M[i] = ax; M[i + 1] = ay; M[i + 2] = az; M[i + 3] = 0; M[i + 4] = bx; M[i + 5] = by; M[i + 6] = bz; M[i + 7] = 0;
    M[i + 8] = cx; M[i + 9] = cy; M[i + 10] = cz; M[i + 11] = 0; M[i + 12] = tx; M[i + 13] = ty; M[i + 14] = tz; M[i + 15] = 1;
    this.C[k] = col[0]; this.C[k + 1] = col[1]; this.C[k + 2] = col[2];
  }
  /** a tube (unit cylinder) from a to b, radius r (all in metres) */
  tube(a, b, r, col) {
    let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const L = Math.hypot(dx, dy, dz); if (L < 1e-5) return;
    dx /= L; dy /= L; dz /= L;
    // a unit axis across the tube: cross(d, up), or cross(d, x) when the tube stands upright
    let px = Math.abs(dy) < .95 ? -dz : 0, py = Math.abs(dy) < .95 ? 0 : dz, pz = Math.abs(dy) < .95 ? dx : -dy; const pl = Math.hypot(px, py, pz); px /= pl; py /= pl; pz /= pl;
    const qx = py * dz - pz * dy, qy = pz * dx - px * dz, qz = px * dy - py * dx;
    this.put(px * r, py * r, pz * r, dx * L, dy * L, dz * L, qx * r, qy * r, qz * r, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, col);
  }
  ball(p, rx, ry, rz, col) { this.put(rx, 0, 0, 0, ry, 0, 0, 0, rz, p[0], p[1], p[2], col); }
  /** a box from a to b (its length), w wide along `across` (a unit vector), t thick */
  box(a, b, across, w, t, col) {
    let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const L = Math.hypot(dx, dy, dz) || 1e-4; dx /= L; dy /= L; dz /= L;
    let zx = across[1] * dz - across[2] * dy, zy = across[2] * dx - across[0] * dz, zz = across[0] * dy - across[1] * dx; const zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
    const xx = dy * zz - dz * zy, xy = dz * zx - dx * zz, xz = dx * zy - dy * zx;
    this.put(xx * w, xy * w, xz * w, dx * L, dy * L, dz * L, zx * t, zy * t, zz * t, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, col);
  }
  end(outlines) {
    const m = this.mesh; m.count = this.n;
    m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, Math.max(1, this.n) * 16); m.instanceMatrix.needsUpdate = true;
    m.instanceColor.clearUpdateRanges(); m.instanceColor.addUpdateRange(0, Math.max(1, this.n) * 3); m.instanceColor.needsUpdate = true;
    if (this.shell) this.shell.count = outlines ? this.n : 0;
  }
}
const toon = objMat(new THREE.MeshToonNodeMaterial({ color: '#ffffff', gradientMap: TOON_BANDS }));
const BATCH = {
  tube: new Batch(new THREE.CylinderGeometry(.85, 1, 1, 7, 1, true), toon, { outline: 'normal', shadow: true, cap: 8192 }),
  ball: new Batch(new THREE.SphereGeometry(1, 9, 6), toon, { outline: 'normal', shadow: true, cap: 8192 }),
  box: new Batch(new THREE.BoxGeometry(1, 1, 1), toon, { outline: 'center', shadow: true }),
  cone: new Batch(new THREE.ConeGeometry(1, 1, 6), toon, { outline: 'normal', shadow: true }),
  glow: new Batch(new THREE.SphereGeometry(1, 8, 6), objMat(new THREE.MeshBasicNodeMaterial({ color: '#ffffff' }))),
  halo: new Batch(new THREE.SphereGeometry(1, 10, 7), new THREE.MeshBasicNodeMaterial({ color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), { order: 2 }),
  blob: new Batch(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicNodeMaterial({ color: '#ffffff', transparent: true, opacity: .45, depthWrite: false }), { order: 1 })
};

/* ---- where a rig's joints are: rig._w's arithmetic without allocating (the puppet ignores the 2D three-quarter cheat) ---- */
const P3 = Array.from({ length: 24 }, () => [0, 0, 0]);   // scratch points, three.js metres
let _ca, _sa, _k, _kz, _rx, _ry, _rz, _sink;
function frame(rig) { const a = rig.facing + (rig.spin || 0); _ca = Math.cos(a); _sa = Math.sin(a); const sz = rig.o.size || 1; _k = (1 - (rig.sq || 0) * .4) * sz; _kz = (1 + (rig.sq || 0)) * sz; _rx = rig.x; _ry = rig.y; _rz = rig.z || 0; }
/** a local point (forward, right, up) plus an offset in the body frame -> three.js metres in out */
function wp(p, out, df = 0, dr = 0, dz = 0) {
  const f = p[0] + df, r = p[1] + dr, z = p[2] + dz;
  out[0] = ((f * _ca - r * _sa) * _k + _rx) / U; out[1] = (z * _kz + _rz + _sink) / U; out[2] = ((f * _sa + r * _ca) * _k + _ry) / U;
  return out;
}
const lerp3 = (a, b, t, out) => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; return out; };
/** a rig's colors as linear RGB, tinted toward the hit flash (cached per rig and flash) */
function cols(rig, flash) {
  const key = flash ? '_cf' : '_cc'; if (rig[key]) return rig[key];
  const out = {}; for (const [k, v] of Object.entries(rig.C)) if (typeof v === 'string' && v[0] === '#') { const c = lin(v); out[k] = flash ? [lerp(c[0], FLASH[0], .3), lerp(c[1], FLASH[1], .3), lerp(c[2], FLASH[2], .3)] : c; }   // (.3: the 2D page's flashMix)
  return (rig[key] = out);
}
const BLACKISH = lin('#1a1320');
/** a Humanoid's parts, sized from its build as its _drawHD sizes them */
function humanParts(rig, flash) {
  const o = rig.o, J = rig.J, C = cols(rig, flash), classic = o.style === 'classic', bones = !!o.skeleton;
  const lw = classic ? .45 : Math.max(.55, o.limbW / 2), R = o.headR, B = BATCH, u = 1 / U;
  frame(rig);
  const [hipL, hipR, knL, knR, ftL, ftR, hipC, shC, shL, shR, head, elL, elR, hdL, hdR, t0, t1, t2, t3, t4, t5] = P3;
  wp(J.hipL, hipL); wp(J.hipR, hipR); wp(J.kneeL, knL); wp(J.kneeR, knR); wp(J.footL, ftL); wp(J.footR, ftR);
  wp(J.hipC, hipC, 0, 0, .8); wp(J.shC, shC, 0, 0, -.4); wp(J.shL, shL); wp(J.shR, shR); wp(J.head, head);
  wp(J.elbowL, elL); wp(J.elbowR, elR); wp(J.handL, hdL); wp(J.handR, hdR);
  const upper = o.sleeves === 'none' || bones ? C.skin : C.cloth, lower = o.sleeves === 'long' ? C.cloth : C.skin;
  for (const [hip, kn, ft, J0] of [[hipL, knL, ftL, J.footL], [hipR, knR, ftR, J.footR]]) {   // legs: thigh, shin, boot to the toe
    lerp3(kn, ft, .62, t0); wp(J0, t1, 1.9, 0, .3);
    B.tube.tube(hip, kn, 1.35 * lw * u, C.pants); B.ball.ball(kn, 1.2 * lw * u, 1.2 * lw * u, 1.2 * lw * u, C.pants);
    B.tube.tube(kn, t0, 1.15 * lw * u, C.pants); B.tube.tube(t0, t1, 1.1 * lw * u, C.boot); B.ball.ball(t0, 1.1 * lw * u, 1.1 * lw * u, 1.1 * lw * u, C.boot);
  }
  B.tube.tube(hipL, hipR, 1.4 * lw * u, C.pants);
  const plate = o.armor ? C.plate || C.metal : null;
  B.tube.tube(hipC, shC, (bones ? .55 : classic ? .5 : .68) * o.torsoW * u, plate || (bones ? C.skin : C.cloth));   // the torso (a knight's breastplate, a skeleton's ribs)
  B.tube.tube(shL, shR, 1.15 * lw * u, plate || upper);
  if (!bones && !classic) { wp(J.hipL, t2, 0, -.3, .7); wp(J.hipR, t3, 0, .3, .7); B.tube.tube(t2, t3, o.torsoW * .7 * u, C.belt); }
  for (const [sh, el, hd] of [[shL, elL, hdL], [shR, elR, hdR]]) {   // arms
    B.tube.tube(sh, el, 1.1 * lw * u, upper); B.ball.ball(el, lw * u, lw * u, lw * u, upper);
    B.tube.tube(el, hd, .95 * lw * u, lower); B.ball.ball(hd, .85 * lw * u, .85 * lw * u, .85 * lw * u, C.glove || C.skin);
    if (o.armor) B.ball.ball(sh, 1.5 * u, 1.5 * u, 1.5 * u, plate);
  }
  // the head: the face, the hair (or a helmet) behind and above it, the eyes (glowing for husks and skeletons)
  wp(J.shC, t0, 0, 0, -.2); wp(J.head, t1, 0, 0, -R * .6); B.tube.tube(t0, t1, .7 * u, C.skin);
  wp(J.head, t0, R * .1, 0, -R * .05); B.ball.ball(t0, R * .9 * u, R * .9 * u, R * .9 * u, C.skin);
  const hat = o.hat && o.hat.style === 'helmet';
  if (hat) { wp(J.head, t1, -R * .05, 0, R * .12); const hc = flash ? FLASH : lin(o.hat.color || '#737c90'); B.ball.ball(t1, R * 1.02 * u, R * .98 * u, R * 1.02 * u, hc); }
  else if (!bones && o.hair.style !== 'bald') { wp(J.head, t1, -R * .32, 0, R * .16); B.ball.ball(t1, R * .95 * u, R * .95 * u, R * .95 * u, C.hair); }
  const glow = o.eyeGlow ? lin(o.eyeGlow) : null;
  for (const sd of [-1, 1]) { wp(J.head, t2, R * .86, sd * R * .36, -R * .02); if (glow) B.glow.ball(t2, .55 * u, .55 * u, .55 * u, glow); else B.ball.ball(t2, .4 * u, .45 * u, .4 * u, BLACKISH); }
  if (o.weapon === 'sword') {   // the blade along the weapon's direction (J.bladeDir), flat across the swing, and its guard
    const bd = J.bladeDir, L = o.bladeLen, hx = J.handR[0], hy = J.handR[1], hz = J.handR[2];
    wp(J.handR, t0, bd[0] * 1.5, bd[1] * 1.5, bd[2] * 1.5); wp(J.handR, t1, bd[0] * L, bd[1] * L, bd[2] * L);
    const fl = Math.hypot(bd[0], bd[1]) > 1e-3 ? [-bd[1], bd[0]] : [0, 1]; wp([hx + fl[0], hy + fl[1], hz], t2); wp(J.handR, t3);
    const ax = t2[0] - t3[0], ay = t2[1] - t3[1], az = t2[2] - t3[2], al = Math.hypot(ax, ay, az) || 1; t4[0] = ax / al; t4[1] = ay / al; t4[2] = az / al;
    B.box.box(t0, t1, t4, 1.3 * u, .3 * u, C.metal || lin('#dce8f1'));
    wp(J.handR, t2, bd[0] * 1.2, bd[1] * 1.2, bd[2] * 1.2); wp(J.handR, t5, bd[0] * 1.7, bd[1] * 1.7, bd[2] * 1.7); B.box.box(t2, t5, t4, 3.4 * u, .5 * u, C.hilt || lin('#e8b04e'));
  }
}
/** a slime: the body squashed as the Blob squashes it, eyes looking where it looks, and its parts */
function slimeParts(e, flash, sink) {
  const b = e.blob, o = b.o, R = o.R * (b.scale || 1), a = 1 - b.sq * .55, h = 1 + b.sq, C = b.C, u = 1 / U, B = BATCH;
  const base = flash ? FLASH : lin(C.base), dk = lin(C.dk), x = e.x / U, z = e.y / U, y = ((e.z || 0) + R * h + sink) / U;
  const [c, p] = P3; c[0] = x; c[1] = y; c[2] = z;
  B.ball.ball(c, R * a * u, R * h * u, R * a * u, base);
  const la = Math.atan2(b.look[1], b.look[0]), fx = Math.cos(la), fz = Math.sin(la);
  for (const s of [-1, 1]) {   // eyes: white, a pupil in front (a squint is a dark slit)
    const ea = la + s * .42; p[0] = x + Math.cos(ea) * R * a * .86 * u; p[1] = y + R * h * .2 * u; p[2] = z + Math.sin(ea) * R * a * .86 * u;
    if (b.squint) { B.ball.ball(p, 1.1 * u, .3 * u, 1.1 * u, lin(C.pupil)); continue; }
    B.ball.ball(p, 1.25 * u, 1.6 * u, 1.25 * u, lin(C.eye)); p[0] += fx * .9 * u; p[2] += fz * .9 * u; B.ball.ball(p, .7 * u, 1 * u, .7 * u, lin(C.pupil));
  }
  if (o.horns || o.ears) for (const s of [-1, 1]) {   // horns and cat ears: cones on top, toward the sides
    const sa = la + s * Math.PI / 2, bx = x + Math.cos(sa) * R * a * .45 * u, bz = z + Math.sin(sa) * R * a * .45 * u, by = y + R * h * .7 * u;
    const ht = (o.horns ? .9 : .75) * R * u, tip = [bx + Math.cos(sa) * ht * .35, by + ht, bz + Math.sin(sa) * ht * .35];
    B.cone.tube([bx, by, bz], tip, R * .3 * u, o.horns ? lin(C.horn || '#e8dcc0') : dk);
  }
  if (o.wings) for (const s of [-1, 1]) {   // bat wings: they open on the hop and beat (the Blob's flap)
    const sa = la + s * Math.PI / 2, f = Math.sin(b.flapP || 0) * .5 + .5, fold = Math.min(1, (b.flap ?? 1) * 2), span = R * (.8 + (.9 + f * .5) * fold) * u;
    const root = [x + Math.cos(sa) * R * a * .6 * u, y, z + Math.sin(sa) * R * a * .6 * u], tip = [root[0] + Math.cos(sa) * span, y + (1.2 - f * 1.3) * fold * R * .6 * u, root[2] + Math.sin(sa) * span];
    B.box.box(root, tip, [fx, 0, fz], R * .9 * u, .25 * u, dk);
  }
}
const WISP = { core: lin('#c78bff'), inner: lin('#f4e6ff'), halo: lin('#7a4ac0').map(v => v * .4), dot: lin('#e3c8ff'), white: [1, 1, 1] };
/** a wisp: a glowing orb with a halo and three orbiting motes; charging swells it, dying pops it (the 2D page's drawWisp) */
function wispParts(e) {
  const k = !e.alive ? 1 + e.deadT / POP_T * 1.8 : e.charge > 0 ? 1 + (1 - e.charge / .6) * .8 : 1, fade = !e.alive ? clamp(1 - e.deadT / POP_T, 0, 1) : 1, u = 1 / U, B = BATCH;
  const [c, d] = P3; c[0] = e.x / U; c[1] = (e.z || 0) / U; c[2] = e.y / U;
  B.glow.ball(c, 3.2 * k * u, 3.2 * k * u, 3.2 * k * u, e.flash > 0 ? WISP.white : WISP.core);
  B.halo.ball(c, 4.6 * k * u, 4.6 * k * u, 4.6 * k * u, WISP.halo.map(v => v * fade));   // (the 2D glow fades out toward 7 units; a flat sphere this size reads the same)
  for (let i = 0; i < 3; i++) { const a = e.t * 4 + i * TAU / 3; d[0] = c[0] + Math.cos(a) * 6 * k * u; d[1] = c[1] + Math.sin(a * 1.3) * 2 * u; d[2] = c[2] + Math.sin(a) * 6 * k * u; B.glow.ball(d, .7 * u, .7 * u, .7 * u, WISP.dot); }
}

/* ---- capes: every rig's cloth (the hero's, and the monsters' when the panel turns capes on) in one mesh ---- */
const CAPE = (() => {
  const SLOT = 8, mat = objMat(new THREE.MeshToonNodeMaterial({ color: '#ffffff', gradientMap: TOON_BANDS, vertexColors: true, side: THREE.DoubleSide }));
  let cap = 0, mesh = null, pos, col, n = 0;
  function grow(c) {
    cap = c; pos = new Float32Array(cap * SLOT * 2 * 3); col = new Float32Array(cap * SLOT * 2 * 3);
    const idx = []; for (let s = 0; s < cap; s++) for (let i = 0; i < SLOT - 1; i++) { const a = (s * SLOT + i) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length), 3));   // (filled each frame; there from the start for the warm-up)
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
    mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.castShadow = true; scene.add(mesh);
  }
  grow(64);
  return {
    begin() { n = 0; },
    add(rig, sink, flash) {
      const L = rig.capeL, R = rig.capeR; if (!L) return;
      if (n >= cap) { const p0 = pos, c0 = col; grow(cap * 2); pos.set(p0); col.set(c0); }
      const c = flash ? FLASH : lin(rig.C.cape), base = n * SLOT * 2 * 3;
      for (let i = 0; i < SLOT; i++) {
        const j = Math.min(i, L.length - 1), a = L[j], b = R[j], o = base + i * 6;
        pos[o] = a.x / U; pos[o + 1] = (a.z + sink) / U; pos[o + 2] = a.y / U; pos[o + 3] = b.x / U; pos[o + 4] = (b.z + sink) / U; pos[o + 5] = b.y / U;
        col[o] = col[o + 3] = c[0]; col[o + 1] = col[o + 4] = c[1]; col[o + 2] = col[o + 5] = c[2];
      }
      n++;
    },
    end() {
      const g = mesh.geometry; g.setDrawRange(0, n * (SLOT - 1) * 6);
      g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = true; g.computeVertexNormals();
    }
  };
})();

/* ---- Card: the engine's sprites in atlas pages, on instanced cards ----
 * The atlas is a row of fixed pages (512 pixels square, or four cells across when zoomed in), each its own canvas,
 * texture and instanced mesh. Pages are made when first needed and kept: no texture is ever resized or remade while
 * the crowd grows and shrinks (a remade texture stalls the frame), and each frame uploads only the pages it used, and
 * outlines only their used rows. Every page compiles to the same shader, so a new page never builds a GPU pipeline
 * mid-fight: each card's cell comes from a per-card attribute with the same name on every page ('cardRect'), and
 * each page's mesh has room for more than 1,000 cards (three r182 keeps the matrices of an InstancedMesh with 1,000
 * or fewer in a uniform buffer named after the mesh, which makes every such mesh's shader its own). */
const CARD_QUAD = new THREE.PlaneGeometry(1, 1), CARD_RECT = TSL.attribute('cardRect', 'vec4');
const ATLAS = (() => {
  const pages = [];
  let P = 0, cell = 0, cols = 0, per = 0, n = 0, key = '';
  function page(i) {
    if (pages[i]) return pages[i];
    const cv = document.createElement('canvas'), out = document.createElement('canvas'); cv.width = cv.height = out.width = out.height = P;
    const tex = new THREE.CanvasTexture(out); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
    const room = Math.max(per, 1001), rect = new THREE.InstancedBufferAttribute(new Float32Array(room * 4), 4), geo = CARD_QUAD.clone(); geo.setAttribute('cardRect', rect);
    const mat = objMat(new THREE.MeshBasicNodeMaterial({ alphaTest: .5 })), R = CARD_RECT;
    mat.colorNode = TSL.texture(tex).sample(TSL.uv().mul(R.zw).add(R.xy));
    const mesh = new THREE.InstancedMesh(geo, mat, room); mesh.frustumCulled = false; mesh.count = 0; scene.add(mesh);
    return (pages[i] = { cv, out, g: cv.getContext('2d'), go: out.getContext('2d'), tex, rect, mesh, M: mesh.instanceMatrix.array, n: 0, rows: 0 });
  }
  function reset() {   // a new cell size (the zoom changed): pages hold a different number of cells, start again
    for (const pg of pages) { scene.remove(pg.mesh); pg.mesh.dispose(); pg.mesh.geometry.dispose(); pg.mesh.material.dispose(); OBJ_MATS.delete(pg.mesh.material); pg.tex.dispose(); }
    pages.length = 0;
  }
  return {
    /** start a frame: the cell size from the view's scale */
    begin(view) {
      cell = Math.ceil(64 * view.scale / 8) * 8;
      let size = 512; while (size < 4 * cell && size < 2048) size *= 2;
      if (size + ':' + cell !== key) { reset(); key = size + ':' + cell; P = size; }
      cols = Math.floor(P / cell); per = cols * cols; n = 0;
      for (const pg of pages) { if (pg.rows) pg.g.clearRect(0, 0, P, pg.rows * cell); pg.n = 0; }
    },
    /** draw one character into the next cell (draw(g, ox, oy) as the engine's actor draws) and stand a card for it at
     *  (x, y, z) engine units; false when the atlas is full */
    add(x, y, z, draw, flash, alpha, v) {
      if (n >= 64 * per) return false;
      const pg = page(Math.floor(n / per)), j = pg.n, g = pg.g;
      const cx = (j % cols) * cell, cy = Math.floor(j / cols) * cell, ox = cx + cell / 2, oy = cy + Math.round(cell * .72);
      g.save(); g.beginPath(); g.rect(cx + 1, cy + 1, cell - 2, cell - 2); g.clip();
      if (alpha < 1) g.globalAlpha = alpha;
      try { draw(g, ox, oy); } finally { g.restore(); }
      if (flash) { g.save(); g.beginPath(); g.rect(cx, cy, cell, cell); g.clip(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = .3; g.fillStyle = '#ffe6d8'; g.fillRect(cx, cy, cell, cell); g.restore(); }
      // the card: the cell's size in the world (v.ppm: the cards' pixels per metre), its root on the rig's root, facing the camera
      const ppm = v.ppm, w = cell / ppm, h = cell / (ppm * v.vert);
      const fx = 0, fy = 0;
      // the card's centre from the root: right by the root's distance from the cell's middle, up by the part of the cell
      // above the root; pushed toward the camera so the floor can't cut its feet
      const dx = (cell / 2 - (ox - cx) + fx) / ppm, dy = ((oy - cy) - cell / 2 - fy) / (ppm * v.vert);
      const r = v.right, up = v.up, bk = v.back, i = j * 16;
      const tx = x / U + r.x * dx + up.x * dy + bk.x * .45, ty = z / U + r.y * dx + up.y * dy + bk.y * .45, tz = y / U + r.z * dx + up.z * dy + bk.z * .45;
      const A = pg.M; A[i] = r.x * w; A[i + 1] = r.y * w; A[i + 2] = r.z * w; A[i + 3] = 0; A[i + 4] = up.x * h; A[i + 5] = up.y * h; A[i + 6] = up.z * h; A[i + 7] = 0;
      A[i + 8] = bk.x; A[i + 9] = bk.y; A[i + 10] = bk.z; A[i + 11] = 0; A[i + 12] = tx; A[i + 13] = ty; A[i + 14] = tz; A[i + 15] = 1;
      const q = pg.rect.array, k = j * 4; q[k] = cx / P; q[k + 1] = 1 - (cy + cell) / P; q[k + 2] = cell / P; q[k + 3] = cell / P;
      pg.n++; n++; return true;
    },
    /** finish: each used page's outline (each sprite grown by `thick` pixels in the outline color, under it: one engine
     *  pixel at the cards' detail) over its used rows, and one upload per used page */
    end(outlines, thick = 1) {
      const t = Math.max(1, Math.round(thick)), d = Math.max(1, Math.round(t * .7));
      const OFFS = t === 1 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[t, 0], [-t, 0], [0, t], [0, -t], [d, d], [-d, d], [d, -d], [-d, -d]];
      for (const pg of pages) {
        const rows = Math.ceil(pg.n / cols), hNow = rows * cell, hWas = pg.rows * cell, go = pg.go;
        if (hWas) go.clearRect(0, 0, P, hWas);
        if (pg.n) {
          if (outlines) {
            for (const [dx, dy] of OFFS) go.drawImage(pg.cv, 0, 0, P, hNow, dx, dy, P, hNow);
            go.globalCompositeOperation = 'source-in'; go.fillStyle = OUTLINE; go.fillRect(0, 0, P, hNow + t); go.globalCompositeOperation = 'source-over';
          }
          go.drawImage(pg.cv, 0, 0, P, hNow, 0, 0, P, hNow);
        }
        if (pg.n || hWas) pg.tex.needsUpdate = true;   // (a page emptied this frame uploads once more, blank)
        pg.rows = rows; pg.mesh.count = pg.n;
        if (pg.n) {
          pg.mesh.instanceMatrix.clearUpdateRanges(); pg.mesh.instanceMatrix.addUpdateRange(0, pg.n * 16); pg.mesh.instanceMatrix.needsUpdate = true;
          pg.rect.clearUpdateRanges(); pg.rect.addUpdateRange(0, pg.n * 4); pg.rect.needsUpdate = true;
        }
      }
    },
    /** load time: make the first pages, so the crowd's first frames don't */
    prepare(view, k) { this.begin(view); for (let i = 0; i < k; i++) page(i); },
    get pages() { return pages; }, get count() { return n; }
  };
})();
/* ---- crates and barrels: instanced, each where its body is (a crate's planks and a barrel's staves drawn by code) ---- */
const WOOD = { planks: ['#9d6a3f', '#8f5f37', '#a87547'].map(E.hex), frame: E.hex('#6e4528'), line: E.hex('#4a2e1c'), hi: E.hex('#c08a55'), nail: E.hex('#2e2420') };
function crateTex(x, y) {   // 12 x 12 pixels for a 12-unit crate: a dark frame, planks, a diagonal brace, four nails
  const P = WOOD, n = 12;
  if (x === 0 || y === 0 || x === n - 1 || y === n - 1) return P.line;
  if (x === 1 || y === 1 || x === n - 2 || y === n - 2) return (x === 1 || x === n - 2) && (y === 1 || y === n - 2) ? P.nail : P.frame;
  if (Math.abs(x - y) <= .5 || Math.abs(x - y - 1) <= .5) return x === y ? P.hi : P.frame;
  if ((y - 2) % 3 === 2) return P.line;
  return P.planks[Math.floor((y - 2) / 3) % P.planks.length];
}
function barrelTex(x, y) {   // staves round the side (38 x 14 pixels), two iron hoops
  if (y === 2 || y === 3 || y === 10 || y === 11) return y === 2 || y === 10 ? E.hex('#5d5a66') : E.hex('#3a3842');
  const st = Math.floor(x / 3), c = WOOD.planks[st % 3];
  return x % 3 === 2 ? WOOD.line : E.hash2(st, y) < .08 ? WOOD.frame : c;
}
const PROP_MESH = {
  crate: (() => { const m = new THREE.InstancedMesh(new THREE.BoxGeometry(12 / U, 12 / U, 12 / U), objMat(new THREE.MeshLambertNodeMaterial({ map: bake(crateTex, 12, 12) })), 300); m.frustumCulled = false; m.count = 0; m.castShadow = m.receiveShadow = true; scene.add(m); return m; })(),
  barrel: (() => {
    const g = new THREE.CylinderGeometry(6 / U, 6 / U, 14 / U, 12, 1);
    const side = objMat(new THREE.MeshLambertNodeMaterial({ map: bake(barrelTex, 36, 14) })), lid = objMat(new THREE.MeshLambertNodeMaterial({ color: '#7a5030' }));
    const m = new THREE.InstancedMesh(g, [side, lid, lid], 300); m.frustumCulled = false; m.count = 0; m.castShadow = m.receiveShadow = true; scene.add(m); return m;
  })()
};
const _pq = new THREE.Quaternion(), _pv = new THREE.Vector3(), _ps = new THREE.Vector3(1, 1, 1), _propM = new THREE.Matrix4(), _rotZY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
/** every prop where its body is: Rapier's rotation is about the engine's axes (z up), so it turns into three's (y up) */
function drawProps(vis) {
  let nc = 0, nb = 0;
  for (const p of PROPS) {
    if (!vis(p.x, p.y, p.z - 8)) continue;
    // a quaternion in engine axes (x, y, z) -> three's (x, z, y): swap the y and z parts and flip the handedness
    _pq.set(-p.q[0], -p.q[2], -p.q[1], p.q[3]);
    if (p.kind === 'barrel') _pq.multiply(_rotZY);   // (the barrel's cylinder stands along Rapier's y, three's along its own y)
    _propM.compose(toThree(p.x, p.y, p.z, _pv), _pq, _ps);
    if (p.kind === 'crate') PROP_MESH.crate.setMatrixAt(nc++, _propM); else PROP_MESH.barrel.setMatrixAt(nb++, _propM);
  }
  PROP_MESH.crate.count = nc; PROP_MESH.barrel.count = nb;
  PROP_MESH.crate.instanceMatrix.needsUpdate = PROP_MESH.barrel.instanceMatrix.needsUpdate = true;
  return nc + nb;
}

/* ---- the crowd, each frame ---- */
const fade = e => !e.alive ? clamp(e.type === 'wisp' ? 1 - e.deadT / POP_T : (DEAD_T - e.deadT) * 2, 0, 1) : e.spawnT > 0 ? clamp(1 - e.spawnT / .6, .05, 1) : 1;
const SEEN = new Set();
/** a blob shadow on the surface under a body (smaller and lighter the higher the body is above it) */
function shadowAt(x, y, z, r, a) {
  const f = floorH(x, y), up = Math.max(0, z - f), k = Math.max(.35, 1 - up / 80), sh = P3[23];
  sh[0] = x / U; sh[1] = (f + .2) / U; sh[2] = y / U; BATCH.blob.ball(sh, r * k / U * a, 1, r * k * .8 / U * a, BLACKISH);
}
/** draw the hero and every monster the camera sees; returns { drawn, culled }. o: { view (the engine view the cards are
 *  drawn from), vis(x, y, z) (on screen?), look, outlines, v (the camera's axes and the cards' pixels per metre),
 *  hideHero and near: [x, y, r] (first person: the hero isn't drawn, nor anything within r of him) } */
function drawCrowd(o) {
  const { view, vis, look, outlines, v } = o;
  for (const b of Object.values(BATCH)) b.begin();
  CAPE.begin(); SEEN.clear();
  const list = [], h = hero;
  const nr = o.near;   // (first person: a body pressed against the camera isn't drawn; it would fill the picture)
  for (const L of [enemies, corpses]) for (const e of L) { if (!vis(e.x, e.y, e.z || 0) || (nr && Math.abs(e.x - nr[0]) < nr[2] && Math.abs(e.y - nr[1]) < nr[2] && Math.hypot(e.x - nr[0], e.y - nr[1]) < nr[2])) continue; list.push(e); SEEN.add(e); }
  const cards = look === 'card';
  if (cards) ATLAS.begin(view);
  let drawn = 0;
  for (const e of list) {
    const a = fade(e), flash = e.flash > 0, sink = (a - 1) * (e.type === 'slime' ? 16 : 34);
    if (e.type === 'wisp') { wispParts(e); drawn++; continue; }
    shadowAt(e.x, e.y, e.z, e.type === 'slime' ? 6 : 5, a);
    drawn++;
    if (cards && ATLAS.add(e.x, e.y, e.z || 0, (g, ox, oy) => e.rig ? e.rig.draw(g, ox, oy, view) : e.blob.draw(g, ox, oy, view), flash, a, v)) continue;
    if (e.rig) { e.rig._cheat = 0; _sink = sink; humanParts(e.rig, flash); if (e.rig.capeL && e.rig.o.cape) CAPE.add(e.rig, sink, flash); }
    else slimeParts(e, flash, sink);
  }
  // the hero last (over the crowd, as on the 2D page): fades out when he falls; not in first person (the camera is his eyes)
  if (!o.hideHero && vis(h.x, h.y, h.z)) {
    const a = h.dead ? clamp(4 - h.deadT * 2, 0, 1) : 1, flash = h.flash > 0;
    if (!h.dead) shadowAt(h.x, h.y, h.z, 5.5, 1);
    if (!(cards && ATLAS.add(h.x, h.y, h.z + h.hop, (g, ox, oy) => h.rig.draw(g, ox, oy, view), flash, a, v))) { h.rig._cheat = 0; _sink = (a - 1) * 34; humanParts(h.rig, flash); if (h.rig.capeL) CAPE.add(h.rig, _sink, flash); }
    drawn++;
  }
  _sink = 0;
  if (cards) ATLAS.end(outlines, v.thick || 1);
  for (const b of Object.values(BATCH)) b.end(outlines);
  CAPE.end();
  return { drawn, culled: enemies.length + corpses.length - list.length };
}
_sink = 0;
