/* =============================================================================
 * COMBAT EFFECTS, from the game's state (20-sim):
 *   telegraphs   the red arc that grows on the floor toward the hero during a wind-up (walkers: out to the move's
 *                measured reach; slimes: out to the hero), at the floor's height where the monster stands
 *   trails       the hero's blade trail (blue-white) and the attacking monsters' claw trails (red), from each rig's
 *                own trail of blade positions, as 3D ribbons
 *   bolts        the hero's embers and the wisps' shots: a hot core and a glow, the first four carry a light
 *   particles    the game's particles (the engine's kinds) as tiny camera-facing quads: sparks, embers, glints and
 *                impact stars add light, dust and bits are solid; rings are rings on the floor
 *   overlay      damage numbers and notes ("WAVE 1 CLEARED") in the engine's pixel font, on a canvas over the picture
 *                at the picture's pixel size, where the 3D camera sees them
 * ============================================================================= */
/** a pool of flat floor shapes (arcs and rings), each its own mesh so each can fade on its own; one material for the
 *  pool (the color and fade are in the vertices), so a new shape never builds a new shader mid-fight */
function floorPool(segments) {
  const pool = [], mat = new THREE.MeshBasicNodeMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  return {
    get(i) {
      if (!pool[i]) {
        const geo = new THREE.BufferGeometry(), pos = new Float32Array((segments + 1) * 2 * 3), idx = [];
        for (let k = 0; k < segments; k++) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length), 3)); geo.setIndex(idx);
        geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length), 3));   // (unlit, but three's node materials read one)
        const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 1; m.visible = false; scene.add(m); pool[i] = m;
      }
      return pool[i];
    },
    /** shape i: from radius r0 to r1 (engine units) between angles a0 and a1, around (x, y) at height z */
    set(i, x, y, z, r0, r1, a0, a1, color, alpha) {
      const m = this.get(i), p = m.geometry.attributes.position.array, cl = m.geometry.attributes.color.array, c = lin(color);
      for (let k = 0; k <= segments; k++) {
        const a = a0 + (a1 - a0) * k / segments, cs = Math.cos(a), sn = Math.sin(a), o = k * 6;
        p[o] = (x + cs * r0) / U; p[o + 1] = (z + .3) / U; p[o + 2] = (y + sn * r0) / U; p[o + 3] = (x + cs * r1) / U; p[o + 4] = (z + .3) / U; p[o + 5] = (y + sn * r1) / U;
        cl[o] = cl[o + 3] = c[0] * alpha; cl[o + 1] = cl[o + 4] = c[1] * alpha; cl[o + 2] = cl[o + 5] = c[2] * alpha;
      }
      m.geometry.attributes.position.needsUpdate = m.geometry.attributes.color.needsUpdate = true; m.visible = true;
    },
    hideFrom(i) { for (let k = i; k < pool.length; k++) pool[k].visible = false; },
    /** load time: make n shapes, so the fight's first ones don't */
    prepare(n) { for (let i = 0; i < n; i++) this.get(i); },
    get list() { return pool; }
  };
}
const ARCS = floorPool(12), RINGS = floorPool(24);
/** the swing trails: ribbons between a blade's base and tip over its last positions, fading to nothing at the tail */
const RIBBONS = (() => {
  const pool = [], MAX = 12, mat = new THREE.MeshBasicNodeMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  function make() {
    const pos = new Float32Array(MAX * 2 * 3), col = new Float32Array(MAX * 2 * 3), idx = [];
    for (let i = 0; i < MAX - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
    const m = new THREE.Mesh(geo, mat);   // (one material for every trail)
    m.frustumCulled = false; m.renderOrder = 3; m.visible = false; scene.add(m); return m;
  }
  return {
    set(i, trail, tint) {
      const m = pool[i] || (pool[i] = make()), n = Math.min(MAX, trail.length); m.visible = n > 1; if (n < 2) return;
      const pos = m.geometry.attributes.position.array, col = m.geometry.attributes.color.array;
      for (let k = 0; k < n; k++) {
        const p = trail[trail.length - n + k], f = ((k + 1) / n) ** 1.5 * .85, o = k * 6;
        pos[o] = p.b[0] / U; pos[o + 1] = p.b[2] / U; pos[o + 2] = p.b[1] / U; pos[o + 3] = p.t[0] / U; pos[o + 4] = p.t[2] / U; pos[o + 5] = p.t[1] / U;
        col[o] = tint[0] * f * .5; col[o + 1] = tint[1] * f * .5; col[o + 2] = tint[2] * f * .5; col[o + 3] = tint[0] * f; col[o + 4] = tint[1] * f; col[o + 5] = tint[2] * f;
      }
      m.geometry.attributes.position.needsUpdate = m.geometry.attributes.color.needsUpdate = true; m.geometry.setDrawRange(0, (n - 1) * 6);
    },
    hideFrom(i) { for (let k = i; k < pool.length; k++) pool[k].visible = false; },
    prepare(n) { for (let i = 0; i < n; i++) if (!pool[i]) pool[i] = make(); },
    get list() { return pool; }
  };
})();
const HERO_TRAIL = lin('#d8f2ff'), CLAW_TRAIL = lin('#ff7a5a');
/* particles: camera-facing quads in two instanced batches (light that adds, and solid) */
const PART = {
  add: new Batch(new THREE.CircleGeometry(1, 6), new THREE.MeshBasicNodeMaterial({ color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), { order: 4, cap: 4096 }),
  solid: new Batch(new THREE.CircleGeometry(1, 6), objMat(new THREE.MeshBasicNodeMaterial({ color: '#ffffff' })), { cap: 4096 }),
  bit: new Batch(new THREE.PlaneGeometry(2, 2), objMat(new THREE.MeshBasicNodeMaterial({ color: '#ffffff' })), { cap: 2048 })
};
const _pc = [0, 0, 0], _pp = [0, 0, 0];
/** one quad facing the camera (v: the card view's axes) at engine (x, y, z), radius r engine units */
function quad(B, x, y, z, r, col, v) {
  const s = r / U, R = v.right, Up = v.up, Bk = v.back;
  B.put(R.x * s, R.y * s, R.z * s, Up.x * s, Up.y * s, Up.z * s, Bk.x, Bk.y, Bk.z, x / U + Bk.x * .05, z / U + Bk.y * .05, y / U + Bk.z * .05, col);
}
const mul3 = (c, k, out = _pc) => { out[0] = c[0] * k; out[1] = c[1] * k; out[2] = c[2] * k; return out; };
const ease = E.ease;
/** everything above, this frame (v: the camera's axes; o.hideHero: first person); returns how many lights the bolts used */
function drawEffects(v, o = {}) {
  // telegraphs
  let na = 0;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.type === 'walker' && e.atk && e.atk.busy && e.atk.phase === 'wind') { const u = e.atk.u, r0 = e.r * .6, r1 = r0 + (e.kind.reach[e.next] - r0) * u; ARCS.set(na++, e.x, e.y, e.z, r0, r1, e.facing - .8, e.facing + .8, '#ff4a3a', .25 + .45 * u); }
    else if (e.type === 'slime' && e.state === 'wind') { const u = clamp(1 - e.t / .5, 0, 1), reach = Math.hypot(hero.x - e.x, hero.y - e.y) - hero.r, r0 = e.r * .6, a = Math.atan2(hero.y - e.y, hero.x - e.x); ARCS.set(na++, e.x, e.y, e.z, r0, r0 + (reach - r0) * u, a - .8, a + .8, '#ff4a3a', .25 + .45 * u); }
  }
  ARCS.hideFrom(na);
  // trails: the hero's blade, the claws of monsters in a swing
  let nr = 0;
  if (hero.rig.trail.length > 1 && !o.hideHero) RIBBONS.set(nr++, hero.rig.trail, HERO_TRAIL);
  for (const e of enemies) if (e.alive && e.atk && e.rig && e.rig.trail.length > 1 && nr < 24) RIBBONS.set(nr++, e.rig.trail, CLAW_TRAIL);
  RIBBONS.hideFrom(nr);
  // bolts: a glow and a hot core, added to drawCrowd's glow batches (begun and ended there; ended again here), the first four lit
  let ns = 0;
  for (const s of shots) {
    _pp[0] = s.x / U; _pp[1] = s.z / U; _pp[2] = s.y / U;
    BATCH.halo.ball(_pp, 5 / U, 5 / U, 5 / U, mul3(lin(s.color), .5)); BATCH.glow.ball(_pp, 2 / U, 2 / U, 2 / U, lin(s.core));
    if (ns < shotLights.length) { const L = shotLights[ns++]; L.position.set(_pp[0], _pp[1], _pp[2]); L.color.set(s.color); L.intensity = LIGHT.shot; }
  }
  for (let k = ns; k < shotLights.length; k++) shotLights[k].intensity = 0;
  BATCH.halo.end(); BATCH.glow.end();
  // particles
  for (const b of Object.values(PART)) b.begin();
  let nrng = 0;
  for (const p of P.list) {
    const u = p.life / p.max;
    switch (p.kind) {
      case 'spark': quad(PART.add, p.x, p.y, p.z, (p.size > 1.5 ? 1.4 : 1) * (1 - u * .5), lin(u < .5 ? (p.hot || '#fff5cf') : p.color), v); break;
      case 'ember': quad(PART.add, p.x, p.y, p.z, .9, mul3(lin(u < .4 ? '#fff0b0' : p.color), 1 - u * .8), v); break;
      case 'glint': { const k = (1 - Math.abs(u * 2 - 1)) * p.size * 2.5; if (k > .2) quad(PART.add, p.x, p.y, p.z, k * .7, lin(p.color), v); break; }
      case 'impact': quad(PART.add, p.x, p.y, p.z, p.size * (u < .35 ? 1 : 1.4 - u), lin(u < .35 ? '#ffffff' : p.color), v); break;
      case 'bit': quad(PART.bit, p.x, p.y, p.z, p.size * .5, lin(p.color), v); break;
      case 'ring': RINGS.set(nrng++, p.x, p.y, p.z, lerp(p.r0, p.r1, ease.outQuad(u)) - .7, lerp(p.r0, p.r1, ease.outQuad(u)) + .7, 0, TAU, p.color, 1 - u); break;
      case 'text': break;   // on the overlay
      default: quad(PART.solid, p.x, p.y, p.z, p.size * (1 + u * 1.4) * (1 - u * .6), lin(p.color), v);   // dust, smoke, fire
    }
  }
  RINGS.hideFrom(nrng);
  for (const b of Object.values(PART)) b.end(false);
  return ns;
}
/** the overlay at the picture's pixel size (k: overlay pixels per text pixel): damage numbers and the current note
 *  (project(x, y, z) -> overlay pixels, or null behind the camera), and a crosshair while the mouse steers */
function drawOverlay(project, W, H, crosshair, k = 1) {
  og.clearRect(0, 0, over.width, over.height);
  for (const p of P.list) {
    if (p.kind !== 'text') continue;
    const u = p.life / p.max; if (!(u < .75 || Math.floor(p.life * 20) % 2)) continue;
    const s = project(p.x, p.y, p.z); if (!s) continue;
    E.font.text(og, p.text, Math.round(s[0]), Math.round(s[1]), p.color, { align: 'center', scale: (p.scale || 1) * k, outline: '#0b0814' });
  }
  const n = SIM.note;
  if (n && SIM.real < n.end) E.font.text(og, n.text, Math.round(W / 2), 3 * k, '#ffffff', { align: 'center', shadow: '#000', outline: false, font: 'tiny', scale: k });
  if (crosshair) {
    const cx = Math.floor(W / 2), cy = Math.floor(H / 2), a = Math.max(1, Math.round(k));
    og.fillStyle = '#0b0814'; og.fillRect(cx - 4 * a, cy - a, 9 * a, 3 * a); og.fillRect(cx - a, cy - 4 * a, 3 * a, 9 * a);
    og.fillStyle = '#f0e3c6'; og.fillRect(cx - 3 * a, cy, 7 * a, a); og.fillRect(cx, cy - 3 * a, a, 7 * a);
  }
}
