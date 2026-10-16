/* =============================================================================
 * BEASTS: two new procedural rigs and everything built on them
 *   CRAWLER  an eight-legged spider rig: two shaded ellipsoids (cephalothorax, abdomen), 8 two-bone IK legs with a
 *            real alternating gait (feet stay planted, step in groups when they stray, grip walls), fangs and
 *            chelicerae that open, glowing eyes, palps, a lagging abdomen, crouch / rear / pounce / death-curl poses
 *   SERPENT  a segmented wyrm: segments follow the head's path history, spines and fins, jaws that open; it travels
 *            UNDERGROUND (a moving dirt mound) and breaches in arcs through churned-earth holes
 *   WATCHER  a floating eye: a fleshy orb, an iris that tracks the hero, blinking lids, trailing tendrils
 * Monsters: crawler, webspinner, broodling (from egg sacs), burrower, eye.  Bosses: the Brood Mother (depth 10) and
 * the Deep Wyrm (depth 15), with their patterns.  Mechanics: WEBS (depth 10) and QUAKE (depth 15).
 * Every part is drawn from continuous values (gait phases, timers, velocities), projected through any view and
 * depth sorted part by part (a boss's legs interleave with the hero standing between them).
 * ============================================================================= */
const BST_T = 16, BST_OL = '#140c1c';
const BST_rnd = (a, b) => a + Math.random() * (b - a);

/* ---------- drawing helpers: projection, shaded capsules and ellipsoids ---------- */
/** world offset (from a rig's root) -> [screen x, screen y, camera depth] */
const BST_p = (view, ox, oy, x, y, z) => [ox + view.ax * x + view.ay * y, oy + view.bx * x + view.by * y + view.bz * z, view.dx * x + view.dy * y + view.dz * z];
/** a capsule between two screen points (radii in pixels): the limb shape of the Humanoid */
function BST_cap(g, A, B, ra, rb, col, dx = 0, dy = 0) {
  const ax = A[0] + dx, ay = A[1] + dy, bx = B[0] + dx, by = B[1] + dy, vx = bx - ax, vy = by - ay, L0 = Math.hypot(vx, vy);
  if (ra < .7 && rb < .7) { px.line(g, ax, ay, bx, by, col, 1); return; }
  if (L0 > .01) { const nx = -vy / L0, ny = vx / L0; px.poly(g, [[ax + nx * ra, ay + ny * ra], [bx + nx * rb, by + ny * rb], [bx - nx * rb, by - ny * rb], [ax - nx * ra, ay - ny * ra]], col); }
  px.disc(g, ax, ay, Math.max(0, ra - .35), col); px.disc(g, bx, by, Math.max(0, rb - .35), col);
}
/** a shaded limb: (outline), dark silhouette, base inset toward the light, a lit edge on thick ones */
function BST_limb(g, A, B, ra, rb, t, far, ol) {
  if (ol) BST_cap(g, A, B, ra + 1, rb + 1, ol);
  BST_cap(g, A, B, ra, rb, far ? t.deep : t.sh);
  if (ra > .8) BST_cap(g, A, B, Math.max(.45, ra - .65), Math.max(.4, rb - .65), far ? t.sh : t.base, -.5, -.5);
  if (ra > 1.6 && !far) { const vx = B[0] - A[0], vy = B[1] - A[1], l = Math.hypot(vx, vy) || 1; let nx = -vy / l, ny = vx / l; if (nx * -.6 + ny * -.8 < 0) { nx = -nx; ny = -ny; } const off = ra - 1.1; px.line(g, A[0] + vx * .2 + nx * off, A[1] + vy * .2 + ny * off, A[0] + vx * .7 + nx * off, A[1] + vy * .7 + ny * off, t.lt); }
}
/** the screen ellipse of an ellipsoid: center c and three axis vectors (world units, radius included), exact for any view */
function BST_ell(view, ox, oy, c, a, b, d) {
  const px1 = view.ax * a[0] + view.ay * a[1], py1 = view.bx * a[0] + view.by * a[1] + view.bz * a[2], px2 = view.ax * b[0] + view.ay * b[1], py2 = view.bx * b[0] + view.by * b[1] + view.bz * b[2];
  const px3 = view.ax * d[0] + view.ay * d[1], py3 = view.bx * d[0] + view.by * d[1] + view.bz * d[2];
  const cxx = px1 * px1 + px2 * px2 + px3 * px3, cxy = px1 * py1 + px2 * py2 + px3 * py3, cyy = py1 * py1 + py2 * py2 + py3 * py3;
  const l00 = Math.sqrt(cxx) || .01, l10 = cxy / l00, l11 = Math.sqrt(Math.max(1e-4, cyy - l10 * l10)), m = (cxx + cyy) / 2, q = Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy * cxy);
  const s = BST_p(view, ox, oy, c[0], c[1], c[2]);
  return { x: s[0], y: s[1], d: s[2], l00, l10, l11, rmin: Math.sqrt(Math.max(.01, m - q)), rmax: Math.sqrt(m + q) };
}
function BST_ellPts(e, k = 1, dx = 0, dy = 0) { const n = clamp(Math.round(e.rmax * k * 1.6), 10, 30), pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, c = Math.cos(a), s = Math.sin(a); pts.push([e.x + dx + e.l00 * c * k, e.y + dy + (e.l10 * c + e.l11 * s) * k]); } return pts; }
/** a shaded ball: (outline), shadow tone, base inset toward the upper-left light, a lit cap and a sparkle */
function BST_ball(g, e, t, ol, far) {
  if (ol) px.poly(g, BST_ellPts(e, 1 + 1 / e.rmin), ol);
  px.poly(g, BST_ellPts(e, 1), far ? t.deep : t.sh);
  px.poly(g, BST_ellPts(e, Math.max(.3, 1 - 1.1 / e.rmin), -.6, -.7), far ? t.sh : t.base);
  if (e.rmin > 1.7) px.poly(g, BST_ellPts(e, .48, -e.rmax * .2, -e.rmin * .3), far ? t.base : t.lt);
  if (e.rmin > 2.6 && !far) px.rect(g, e.x - e.rmax * .34, e.y - e.rmin * .58, Math.max(1, Math.round(e.rmax * .18)), 1, t.hi);
}
/** a point on an ellipsoid's surface (u, v, w on the unit sphere): [screen x, y, faces the camera?] */
function BST_surf(view, ox, oy, c, a, b, d, u, v, w) {
  const x = c[0] + a[0] * u + b[0] * v + d[0] * w, y = c[1] + a[1] * u + b[1] * v + d[1] * w, z = c[2] + a[2] * u + b[2] * v + d[2] * w;
  const la = a[0] * a[0] + a[1] * a[1] + a[2] * a[2], lb = b[0] * b[0] + b[1] * b[1] + b[2] * b[2], ld = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const nx = a[0] * u / la + b[0] * v / lb + d[0] * w / ld, ny = a[1] * u / la + b[1] * v / lb + d[1] * w / ld, nz = a[2] * u / la + b[2] * v / lb + d[2] * w / ld;
  const s = BST_p(view, ox, oy, x, y, z); return [s[0], s[1], nx * view.dx + ny * view.dy + nz * view.dz > 0, [x, y, z]];
}
/* ---------- sounds (chip voices) ---------- */
A.define('bst_hiss', [{ wave: 'noise', freq: 5200, to: 2600, dur: .22, vol: .16, filter: 'highpass' }, { wave: 'saw', freq: 1900, to: 1500, dur: .12, vol: .04 }]);
A.define('bst_skitter', { wave: 'noise', freq: 4200, to: 3000, dur: .04, vol: .07, filter: 'bandpass' });
A.define('bst_bite', [{ wave: 'noise', freq: 2400, to: 700, dur: .07, vol: .3 }, { wave: 'square', freq: 320, to: 120, dur: .06, vol: .14 }]);
A.define('bst_screech', [{ wave: 'saw', freq: 1300, to: 2300, dur: .55, vol: .14, vib: [22, .08] }, { wave: 'saw', freq: 900, to: 1400, dur: .6, vol: .1, vib: [17, .1] }, { wave: 'noise', freq: 3500, to: 1500, dur: .5, vol: .16 }]);
A.define('bst_spit', [{ wave: 'noise', freq: 1500, to: 400, dur: .12, vol: .24, filter: 'lowpass' }, { wave: 'sine', freq: 520, to: 180, dur: .1, vol: .2 }]);
A.define('bst_squelch', [{ wave: 'noise', freq: 700, to: 200, dur: .18, vol: .32, filter: 'lowpass' }, { wave: 'sine', freq: 260, to: 70, dur: .16, vol: .26 }]);
A.define('bst_rumble', [{ wave: 'noise', freq: 220, to: 120, dur: 1.1, vol: .42, filter: 'lowpass' }, { wave: 'sine', freq: 48, to: 36, dur: 1.1, vol: .35 }]);
A.define('bst_burst', [{ wave: 'noise', freq: 900, to: 90, dur: .5, vol: .5, filter: 'lowpass' }, { wave: 'sine', freq: 120, to: 35, dur: .4, vol: .5 }, { wave: 'noise', freq: 3000, to: 900, dur: .15, vol: .2 }]);
A.define('bst_charge', { wave: 'sine', freq: 300, to: 1400, dur: .7, vol: .16, vib: [16, .05] });
A.define('bst_burn', [{ wave: 'noise', freq: 1200, to: 300, dur: .35, vol: .28 }, { wave: 'noise', freq: 5000, to: 2000, dur: .25, vol: .1, filter: 'highpass' }]);
A.define('bst_egg', [{ wave: 'noise', freq: 900, to: 300, dur: .14, vol: .3, filter: 'lowpass' }, { wave: 'triangle', freq: 700, to: 300, dur: .1, vol: .16 }]);
A.define('bst_roar', [{ wave: 'saw', freq: 90, to: 55, dur: 1.3, vol: .26, vib: [11, .16] }, { wave: 'saw', freq: 135, to: 80, dur: 1.2, vol: .14, vib: [7, .1] }, { wave: 'noise', freq: 500, to: 150, dur: 1.3, vol: .32, filter: 'lowpass' }]);

/* =============================================================================
 * CRAWLER RIG
 *   new BST_Crawler({ size, H (ride height), ceph, abd, egg (egg-sac abdomen 0..1), long (leg length), pattern:
 *     'chevron' | 'hourglass' | 'spots' | 'bands', flip (dies on its back), colors: { base, leg, belly, mark, eye, fang, joint, sac, vein } })
 *   rig.update(dt, { x, y, z, lift, vx, vy, facing, dead (seconds since death), pose: { crouch, rear, fang, lunge, hurt, curl, dash } })
 *   rig.draw(g, ox, oy, view)  (an actor)  or  rig.draw(null, 0, 0, view, { r, x, y, z, alpha })  (every part queued on its own)
 * Local frame: f forward, r right, z up, centred on the body. Planted feet live in world space.
 * ============================================================================= */
const BST_LEG = [   // hip angle (from forward) on the cephalothorax, rest-spot angle and distance, femur and tibia length
  { ha: .5, ra: .62, D: 13.6, L1: 7.6, L2: 9.2 }, { ha: 1.15, ra: 1.3, D: 12.4, L1: 6.8, L2: 8 },
  { ha: 1.9, ra: 2.0, D: 12.2, L1: 6.8, L2: 7.8 }, { ha: 2.55, ra: 2.6, D: 13.4, L1: 7.6, L2: 9 }];
const BST_RATE = { crouch: 7, rear: 5, fang: 18, lunge: 16, air: 12, curl: 3.2, hurt: 12, dash: 6 };
class BST_Crawler {
  constructor(o = {}) {
    this.o = Object.assign({ size: 1, H: 3.8, ceph: 1.1, abd: 1.15, egg: 0, long: 1, thick: 1, pattern: 'chevron', flip: true, palps: true }, o);
    const C = this.C = Object.assign({ base: '#4a3a4e', leg: '#3e3242', belly: '#2a2230', mark: '#d8a840', eye: '#ff5a3a', fang: '#e0d0b8', joint: '#7a6a7e', sac: '#d8c8a0', vein: '#a85a5a' }, o.colors || {});
    this.T = {}; for (const k of ['base', 'leg', 'belly', 'mark', 'fang', 'sac', 'joint']) this.T[k] = E.tones(C[k]);
    this.legs = []; for (let i = 0; i < 8; i++) { const s = i < 4 ? -1 : 1, k = i % 4; this.legs.push({ s, k, grp: (k + (s > 0 ? 1 : 0)) % 2, d: BST_LEG[k], foot: [0, 0, 0], from: [0, 0, 0], u: -1, dur: .12, seed: Math.random() }); }
    this.x = 0; this.y = 0; this.rootZ = 0; this.facing = 0; this.t = Math.random() * 9; this.init = false; this.wasAir = false;
    this.W = { crouch: 0, rear: 0, fang: 0, lunge: 0, air: 0, curl: 0, hurt: 0, dash: 0 };
    this.pitch = 0; this.roll = 0; this.sq = 0; this.sqV = 0; this.abdY = 0; this.abdV = 0; this.turn = 0; this.spd = 0; this.bz = 0; this.hop = 0; this.glow = [];
    this.cfv = [1, 0, 0]; this.crv = [0, 1, 0]; this.czv = [0, 0, 1];
  }
  kick(v) { this.sqV += v * .6; }
  /** local (f, r, z) -> world offset from the body centre (rotated, scaled, squashed) */
  L(f, r, z) { const S = this.o.size, a = (1 - this.sq * .4) * S, c = (1 + this.sq) * S, F = this.cfv, R = this.crv, Z = this.czv; f *= a; r *= a; z *= c; return [F[0] * f + R[0] * r + Z[0] * z, F[1] * f + R[1] * r + Z[1] * z, F[2] * f + R[2] * r + Z[2] * z]; }
  update(dt, s) {
    const o = this.o, S = o.size, W = this.W, P = s.pose || {}, dead = s.dead !== undefined && s.dead >= 0;
    const f0 = this.facing; this.x = s.x; this.y = s.y; this.rootZ = s.z || 0; this.facing = s.facing; this.t += dt; this.dead = dead;
    this.turn = lerp(this.turn, dt > 0 ? clamp(E.angDiff(f0, s.facing) / dt, -14, 14) : 0, Math.min(1, dt * 10));
    const vx = s.vx || 0, vy = s.vy || 0, sp = Math.hypot(vx, vy); this.spd = lerp(this.spd, sp, Math.min(1, dt * 8));
    const lift = (s.lift || 0) + this.rootZ, air = lift > 1.5 && !dead;
    for (const k in W) { const tg = k === 'air' ? (air ? 1 : 0) : k === 'curl' ? (dead ? 1 : P.curl || 0) : P[k] || 0; W[k] = approach(W[k], tg, dt * (BST_RATE[k] || 8) / (k === 'curl' && S > 1.6 ? 3 : 1)); }   // a giant dies slowly
    this.sqV += (-240 * this.sq - 14 * this.sqV) * dt; this.sq = clamp(this.sq + this.sqV * dt, -.35, .35);
    // the abdomen lags behind turns and bounces with the steps (a damped spring)
    this.abdV += (-this.turn * .05 - this.abdY * 70 - this.abdV * 9) * dt; this.abdY = clamp(this.abdY + this.abdV * dt, -.5, .5);
    // attitude: the nose dips at speed and into a bite, rears for threats, rolls into turns; small ones die on their backs
    const flipU = dead && o.flip ? E.ease.inOut(clamp((s.dead - .1) / .4, 0, 1)) : 0;
    const pitchT = -.13 * clamp(sp / 70, 0, 1) + .5 * W.rear + .14 * W.crouch - .22 * W.lunge + .12 * W.hurt;
    this.pitch = approach(this.pitch, pitchT, dt * 4); this.roll = dead && o.flip ? Math.PI * flipU : approach(this.roll, clamp(-this.turn * .035, -.3, .3), dt * 3);
    this.hop = dead && o.flip ? Math.sin(flipU * Math.PI) * 4 * S : 0;
    const cp = Math.cos(this.pitch), spn = Math.sin(this.pitch), cr = Math.cos(this.roll), sr = Math.sin(this.roll), ct = Math.cos(this.facing), st = Math.sin(this.facing);
    this.cfv = [cp * ct, cp * st, spn]; this.crv = [-sr * spn * ct - cr * st, -sr * spn * st + cr * ct, sr * cp]; this.czv = [-cr * spn * ct + sr * st, -cr * spn * st - sr * ct, cr * cp];
    // ride height: breathing when still, a dip while legs are in the air, low in a crouch, flat when it dies
    let lifting = 0; for (const Lg of this.legs) if (Lg.u >= 0) lifting += Math.sin(Lg.u * Math.PI);
    const H = o.H * S, idle = 1 - clamp(sp / 30, 0, 1);
    this.bz = lift + lerp(H * (1 - .45 * W.crouch - .18 * W.hurt + .3 * W.rear) - lifting * .05 * H + Math.sin(this.t * 2.4) * .06 * H * idle, H * .55, W.curl) + this.hop;
    // the gait: each foot stays planted until it strays from its rest spot, then steps in its group (alternating tetrapods)
    const cf = Math.cos(this.facing), sf = Math.sin(this.facing), D = o.long * S, spread = 1 + .2 * W.crouch, lead = .09;
    const thr = (2.4 + Math.min(sp, 130) * .026) * S * o.long;
    const busy = [0, 0]; for (const Lg of this.legs) if (Lg.u >= 0) busy[Lg.grp]++;
    const loose = W.air > .02 || W.curl > .02;
    if (this.wasAir && !air) { for (const Lg of this.legs) { Lg.foot = this._drawnFoot(Lg); Lg.foot[2] = 0; Lg.u = -1; } if (S > 1.5) { BST_dust(this.x, this.y, 10 * S); } }   // landed: the tucked feet plant where they touch down, then step out
    this.wasAir = air;
    for (const Lg of this.legs) {
      const d = Lg.d, lf = 2.2 + Math.cos(d.ra) * d.D * spread, lr = Lg.s * Math.sin(d.ra) * d.D * spread;
      const rx = this.x + (lf * cf - lr * sf) * D + vx * lead, ry = this.y + (lf * sf + lr * cf) * D + vy * lead;
      if (!this.init) { Lg.foot = BST_footAt(rx, ry, this.x, this.y, Lg.seed); continue; }
      if (loose) { Lg.u = -1; continue; }
      if (Lg.u >= 0) {
        Lg.u = Math.min(1, Lg.u + dt / Lg.dur);
        const tg = BST_footAt(rx + vx * Lg.dur * .35, ry + vy * Lg.dur * .35, this.x, this.y, Lg.seed), e = E.ease.inOut(Lg.u);
        Lg.foot = [lerp(Lg.from[0], tg[0], e), lerp(Lg.from[1], tg[1], e), lerp(Lg.from[2], tg[2], e) + Math.sin(Lg.u * Math.PI) * (1.5 + Math.min(sp, 110) * .022) * S];
        if (Lg.u >= 1) { Lg.u = -1; Lg.foot = tg; if (S > 1.6 && Math.random() < .7) BST_dust(tg[0], tg[1], 3 * S); }
      } else {
        const off = Math.hypot(Lg.foot[0] - rx, Lg.foot[1] - ry);
        if ((off > thr && !busy[1 - Lg.grp]) || off > thr * 2.3) { Lg.u = 0; Lg.from = Lg.foot.slice(); Lg.dur = clamp(thr / Math.max(sp, 14) * .75, .055, .17); busy[Lg.grp]++; }
      }
    }
    this.init = true;
  }
  /** where a foot is drawn: planted (world), tucked under the body in the air, raised for a threat, curled in death */
  _drawnFoot(Lg) {
    const W = this.W, d = Lg.d, s = Lg.s, k = Lg.k, bx = this.x, by = this.y, bz = this.bz; let f = Lg.foot.slice();
    const rel = (lf, lr, lz) => { const w = this.L(lf, lr, lz); return [bx + w[0], by + w[1], bz + w[2]]; };
    if (W.rear > 0 && k < 2) { const a = d.ra * (k ? .8 : .95) + .15, q = rel(2.2 + Math.cos(a) * d.D * .92, s * Math.sin(a) * d.D * 1.02, k ? -1 + Math.sin(this.t * 7 + s) * .6 : 1.6 + Math.sin(this.t * 9 + s * 2) * 1.2); f = BST_lerp3(f, q, W.rear * (k ? .55 : 1)); }
    if (W.crouch > 0 && k === 0) { const q = rel(2.2 + Math.cos(d.ra) * d.D * .8, s * Math.sin(d.ra) * d.D * .8, -this.o.H * .2); f = BST_lerp3(f, q, W.crouch * .45); }
    if (W.air > 0) { const q = rel(2.2 + Math.cos(d.ra) * d.D * .6 + (k === 0 ? 3 : k === 3 ? -1.5 : 0), s * Math.sin(d.ra) * d.D * .62, k === 0 ? .5 : -this.o.H * .6 - Math.sin(this.t * 20 + k) * .6); f = BST_lerp3(f, q, W.air); }
    if (W.curl > 0) { const tw = Math.sin(this.t * 26 + k * 2 + s) * Math.max(0, 1 - W.curl * .8) * 1.2; const q = rel(2.2 * .4 + Math.cos(d.ra) * 2.4, s * (2.4 + Math.sin(d.ra) * 1.4), -(this.o.H * .75) + tw); f = BST_lerp3(f, q, W.curl); }
    return f;
  }
  /** Q: { r, x, y, z, alpha, ol } queues each part on its own (bosses); otherwise draws into g around (ox, oy) */
  draw(g, ox, oy, view, Q) {
    const o = this.o, C = this.C, W = this.W, S = o.size, sc = view.scale * S, ops = [], ol = Q ? BST_OL : null, T = Q && Q.flash ? this._flashT(Q.flash, Q.mix) : this.T;
    const rx = this.x, ry = this.y, rz = this.rootZ, bx = 0, by = 0, bzr = this.bz - rz;   // everything relative to the root
    if (Q) { const w0 = Q.r.w(rx, ry, rz); ox = Math.round(w0[0]); oy = Math.round(w0[1]); }
    const lung = (W.lunge * 2.6 - W.hurt * 1.4) * S, lx = Math.cos(this.facing) * lung, ly = Math.sin(this.facing) * lung;
    const Bp = (lf, lr, lz) => { const w = this.L(lf, lr, lz); return [bx + lx + w[0], by + ly + w[1], bzr + w[2]]; };   // body-local -> root-relative world
    const P = p => BST_p(view, ox, oy, p[0], p[1], p[2]);
    const bodyD = view.dx * lx + view.dy * ly + view.dz * bzr;
    const push = (w, f) => ops.push({ d: view.dx * w[0] + view.dy * w[1] + view.dz * w[2], ax: w[0], ay: w[1], az: w[2] + rz, f });
    // ---- legs: hip -> knee (IK) -> foot, a knee knob, a banded shin and a claw ----
    const sil = this.sq * .4;
    for (const Lg of this.legs) {
      const d = Lg.d, hipL = [2.2 + Math.cos(d.ha) * 2.1 * o.ceph, Lg.s * Math.sin(d.ha) * 2 * o.ceph, -.3];
      const hip = Bp(...hipL), fw = this._drawnFoot(Lg), foot = [fw[0] - rx, fw[1] - ry, fw[2] - rz];
      const ox0 = foot[0] - hip[0], oy0 = foot[1] - hip[1], ol0 = Math.hypot(ox0, oy0) || 1;
      const [knee, ft] = E.ik3(hip, foot, d.L1 * S * o.long, d.L2 * S * o.long, [ox0 / ol0, oy0 / ol0, .95]);
      const H2 = P(hip), K = P(knee), F = P(ft), far = (H2[2] + K[2]) / 2 < bodyD - 1 * S, far2 = (K[2] + F[2]) / 2 < bodyD - 1 * S;
      const mid = [(hip[0] + knee[0]) / 2, (hip[1] + knee[1]) / 2, (hip[2] + knee[2]) / 2], mid2 = [(knee[0] + ft[0]) / 2, (knee[1] + ft[1]) / 2, (knee[2] + ft[2]) / 2];
      const r1 = Math.max(.7, (1 - sil) * .72 * sc * o.thick), r2 = Math.max(.6, .6 * sc * o.thick), r3 = Math.max(.5, .3 * sc * o.thick);
      push(mid, () => { BST_limb(g0(), H2, K, r1, r2, T.leg, far, ol); if (r2 > 1.1) px.disc(g0(), K[0] - .4, K[1] - .5, Math.max(.6, r2 * .55), far ? T.joint.sh : T.joint.base); });
      push(mid2, () => { const G = g0(), band = [lerp(K[0], F[0], .3), lerp(K[1], F[1], .3), 0]; BST_limb(G, K, F, r2 * .92, r3, T.leg, far2, ol); if (r2 > 1.2) BST_cap(G, K, band, Math.max(.5, r2 * .6), Math.max(.5, r2 * .5), far2 ? T.leg.sh : T.leg.lt, -.4, -.4);
        const cl = P([ft[0] + ox0 / ol0 * .9 * S, ft[1] + oy0 / ol0 * .9 * S, ft[2] - .4 * S]); px.line(G, F[0], F[1], cl[0], cl[1], T.leg.deep); });
    }
    // ---- abdomen (with the markings), or the swollen egg sac of a brood mother ----
    const ay = this.abdY, cA = Math.cos(ay), sA = Math.sin(ay), aS = o.abd, eg = o.egg;
    const abdC = Bp(-.6 - 4.4 * aS * cA, -4.4 * aS * sA, .9 * aS + .3), aF = this.L(4.6 * aS * cA, 4.6 * aS * sA, .5 * aS), aR = this.L(-3.8 * aS * sA, 3.8 * aS * cA, 0), aZ = this.L(0, 0, 3.3 * aS);
    push(abdC, () => {
      const G = g0(), e = BST_ell(view, ox, oy, abdC, aF, aR, aZ); BST_ball(G, e, T.base, ol, false);
      const mk = (u, v, w) => BST_surf(view, ox, oy, abdC, aF, aR, aZ, u, v, w), mt = T.mark;
      if (o.pattern === 'chevron') for (const [u, k] of [[.5, .9], [.18, 1], [-.14, .9], [-.44, .7]]) { const a0 = mk(u + .12 * k, -.34 * k, .62), a1 = mk(u - .1 * k, 0, .8), a2 = mk(u + .12 * k, .34 * k, .62), a3 = mk(u - .02, 0, .8); if (a1[2]) { px.poly(G, [a0, a1, a2, a3], mt.base); px.line(G, a0[0], a0[1], a1[0], a1[1], mt.lt); } }
      else if (o.pattern === 'hourglass') { const q = [mk(.45, -.22, .78), mk(.45, .22, .78), mk(.05, 0, .96), mk(-.4, .24, .8), mk(-.4, -.24, .8), mk(.05, 0, .96)]; if (q[2][2]) { px.poly(G, [q[0], q[1], q[2]], mt.base); px.poly(G, [q[2], q[3], q[4]], mt.base); px.dot(G, q[2][0], q[2][1] - 1, mt.hi); } }
      else if (o.pattern === 'spots') for (const [u, v] of [[.4, -.4], [.4, .4], [0, -.5], [0, .5], [-.4, -.35], [-.4, .35], [.1, 0]]) { const a0 = mk(u, v, Math.sqrt(Math.max(0, 1 - u * u - v * v))); if (a0[2]) { px.disc(G, a0[0], a0[1], Math.max(.6, sc * .45), mt.base); px.dot(G, a0[0] - .5, a0[1] - .5, mt.hi); } }
      else if (o.pattern === 'bands') for (const u of [.55, .2, -.15, -.5]) { const pts = []; for (let v = -.9; v <= .91; v += .3) { const a0 = mk(u, v, Math.sqrt(Math.max(0, 1 - u * u - v * v))); if (a0[2]) pts.push(a0); } for (let i = 1; i < pts.length; i++) px.line(G, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], mt.base, Math.max(1, Math.round(sc * .5))); }
      const spn = mk(-.98, 0, .1); if (spn[2] || view.pitchDeg < 40) px.disc(G, spn[0], spn[1], Math.max(.6, sc * .35), T.belly.lt);
      if (eg > 0) this._sac(G, view, ox, oy, abdC, aF, aR, aZ, ol);
    });
    // ---- pedicel and cephalothorax (eyes on top), chelicerae and fangs, palps ----
    const cS = o.ceph, cC = Bp(2.2 * cS, 0, .1), cF = this.L(3 * cS, 0, -.25 * cS), cR = this.L(0, 2.6 * cS, 0), cZ = this.L(.3 * cS, 0, 2 * cS);
    push(Bp(-.5, 0, 0), () => { const a = P(Bp(-.2, 0, .1)), b = P(Bp(-1.4, 0, .4)); BST_cap(g0(), a, b, Math.max(.6, .9 * sc), Math.max(.6, .9 * sc), T.base.deep); });
    const glow = this.glow; glow.length = 0;
    push(cC, () => {
      const G = g0(), e = BST_ell(view, ox, oy, cC, cF, cR, cZ); BST_ball(G, e, T.base, ol, false);
      const mk = (u, v, w) => BST_surf(view, ox, oy, cC, cF, cR, cZ, u, v, w);
      const groove = [mk(.4, 0, .9), mk(-.5, 0, .85)]; if (groove[0][2] && sc > 1.3) px.line(G, groove[0][0], groove[0][1], groove[1][0], groove[1][1], T.base.sh);
      for (const [u, v, w, big] of [[.78, -.2, .56, 1], [.78, .2, .56, 1], [.62, -.46, .6, 0], [.62, .46, .6, 0], [.45, -.62, .62, 0], [.45, .62, .62, 0]]) {
        const q = mk(u, v, w); if (!q[2]) continue;
        const rr = big ? Math.max(.5, sc * .42) : Math.max(.4, sc * .26); px.disc(G, q[0], q[1], rr + (sc > 1.4 ? .6 : 0), '#140a10'); px.glow(G, 1); px.disc(G, q[0], q[1], rr, this.dead ? T.base.deep : C.eye); if (big && rr > .8) px.dot(G, q[0] - .5, q[1] - .6, '#ffffff');
        glow.push([q[3][0], q[3][1], q[3][2], rr]);
      }
    });
    const fo = W.fang, fangs = [];
    for (const s of [-1, 1]) {
      const c0 = Bp(2.2 * cS + 2.5 * cS, s * .8 * cS, -.7 * cS), c1 = Bp(2.2 * cS + 3.4 * cS + fo * .5, s * (.7 + fo * .5) * cS, -2 * cS + fo * .6);
      const tip = Bp(2.2 * cS + 3.6 * cS + fo * 1.6, s * (.15 + fo * 1.7) * cS, -2.7 * cS + fo * 1.2), mid = [(c0[0] + tip[0]) / 2, (c0[1] + tip[1]) / 2, (c0[2] + tip[2]) / 2];
      fangs.push(tip);
      push(mid, () => { const G = g0(), A0 = P(c0), B0 = P(c1), Tp = P(tip); BST_limb(G, A0, B0, Math.max(.6, .72 * sc), Math.max(.55, .6 * sc), T.base, false, ol); px.line(G, B0[0], B0[1], Tp[0], Tp[1], T.fang.base, Math.max(1, Math.round(sc * .4))); px.dot(G, Tp[0], Tp[1], T.fang.deep); });
      if (o.palps) { const p0 = Bp(2.2 * cS + 2.2 * cS, s * 1.5 * cS, -.4 * cS), tw = Math.sin(this.t * 6 + s * 1.7) * .8 + W.rear * 2, p1 = Bp(2.2 * cS + 4 * cS, s * 2.3 * cS, .6 + tw), p2 = Bp(2.2 * cS + 5.6 * cS, s * 2.1 * cS, -1.6 * cS + tw * .6 + W.rear * 2 - (1 - W.rear) * 1.2);
        push(p1, () => { const G = g0(), A0 = P(p0), B0 = P(p1), C0 = P(p2); BST_limb(G, A0, B0, Math.max(.5, .45 * sc), Math.max(.5, .4 * sc), T.leg, false, ol); BST_limb(G, B0, C0, Math.max(.5, .4 * sc), Math.max(.5, .45 * sc), T.leg, false, ol); }); }
    }
    this.fangTips = fangs;
    // draw: into one image (a small crawler through r.actor) or part by part (bosses)
    let gg = g; function g0() { return gg; }
    if (!Q) { ops.sort((a, b) => a.d - b.d); for (const op of ops) op.f(); return; }
    for (const op of ops) Q.r.queue(rx + op.ax, ry + op.ay, Math.max(0, op.az), G => { gg = G; if (Q.alpha < 1) px.blend(G, Q.alpha, 'normal', op.f); else op.f(); }, { bias: Q.bias || 0, occluder: true });   // occluders: the hero shows as an x-ray silhouette behind her
  }
  /** hit flash for bodies drawn part by part: every tone pulled toward the flash color */
  _flashT(c, mx = .3) { const k = c + '|' + mx, F = this._ft || (this._ft = {}); if (!F[k]) { F[k] = {}; for (const n in this.T) F[k][n] = E.tones(E.mix(this.C[n], c, Math.min(.8, mx * 2.2))); } return F[k]; }
  /** a brood mother's egg sac: a pale swollen membrane behind the abdomen, eggs showing through, veins, a pulse */
  _sac(G, view, ox, oy, c, a, b, d, ol) {
    const T = this.T, k = 1 + .05 * Math.sin(this.t * 3.1), e = this.o.egg, back = [c[0] - a[0] * .55, c[1] - a[1] * .55, c[2] - a[2] * .55 - d[2] * .15];
    const sa = a.map(v => v * .88 * e * k), sb = b.map(v => v * 1.04 * e * k), sd = d.map(v => v * .98 * e * k), el = BST_ell(view, ox, oy, back, sa, sb, sd);
    BST_ball(G, el, T.sac, ol, false);
    for (let i = 0; i < 14; i++) {
      const u = -.7 + (i % 5) * .32 + ((i / 5 | 0) & 1) * .16, v = ((i / 5 | 0) - 1) * .5, w = Math.sqrt(Math.max(0, 1 - u * u - v * v)); if (w <= .15) continue;
      const q = BST_surf(view, ox, oy, back, sa, sb, sd, u, v, w * .98); if (!q[2]) continue;
      const pr = Math.max(.6, el.rmin * .085 * (1 + .25 * Math.sin(this.t * 4 + i * 1.7)));
      px.disc(G, q[0], q[1], pr + .8, T.sac.sh); px.disc(G, q[0] - .4, q[1] - .4, pr, T.sac.lt); px.dot(G, q[0] - pr * .5, q[1] - pr * .5, T.sac.hi);
    }
    for (let i = 0; i < 5; i++) { const v = -.6 + i * .3, q0 = BST_surf(view, ox, oy, back, sa, sb, sd, .6, v, .7), q1 = BST_surf(view, ox, oy, back, sa, sb, sd, -.2 + (i % 2) * .2, v * 1.2, .95); if (q0[2] && q1[2]) px.line(G, q0[0], q0[1], q1[0], q1[1], this.C.vein); }
  }
}
const BST_lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** where a foot lands: its rest spot, or (if that is inside a wall) gripping the wall face a little way up, like a spider */
function BST_footAt(x, y, bx, by, seed) {
  const map = ED.L && ED.L.map; if (!map || !map.solidAt(x, y)) return [x, y, 0];
  const dx = x - bx, dy = y - by, d = Math.hypot(dx, dy) || 1; let k = d;
  while (k > 0 && map.solidAt(bx + dx / d * k, by + dy / d * k)) k -= 1.2;
  const h = Math.min(18, map.heightAt(x, y));
  return [bx + dx / d * (k + 1.4), by + dy / d * (k + 1.4), Math.min(h - 1, 3 + seed * 7)];
}
function BST_dust(x, y, n) { P.dust(x, y, 0, Math.round(clamp(n / 3, 1, 8)), { speed: 20 + n * 2, color: '#8a7a6a' }); }

/* =============================================================================
 * BEAST MONSTERS: shared drawing, bodies and AIs
 * ============================================================================= */
/** draw a beast (arch.draw): shadow, elite ring, the body as one actor (small) or part by part (big), glowing eyes
 *  redrawn after the lighting pass so they burn in the dark, affixes */
function BST_drawBeast(m, r, alpha) {
  const B = m.body; if (!B || !B.rig) return;
  const s = m.scale || 1, view = r.view, big = B.big, [fc, fm, oc] = foeTint(m), rig = B.rig;   // (the flash is throttled on bosses: foeReact)
  // a light blow on a boss or an elite flares only the outline (foeTint); a body drawn part by part has no outline pass, so
  // it takes the faintest warm tint instead, and its own colors still read
  const tint = fc ? [fc, fm] : big && m.alive && m.rimT > 0 ? [FLASH, .07] : null;
  const lift = (m.z || 0) + (m.bstLift || 0);
  if (!B.noShadow) r.shadow(m.x, m.y, (B.shadow || m.r + 2) * (lift > 0 ? Math.max(.4, 1 - lift * .015) : 1), .5 * alpha);
  if (m.alive && m.elite && !m.untargetable) r.decal(() => { const c = m.elite === 2 ? '#ffc040' : m.elite === 3 ? '#ff5a3a' : '#6a9aff'; r.groundRing(m.x, m.y, (B.shadow || m.r) + 4, c, .6 + .3 * Math.sin(game.time * 5)); }, { emissive: .6 });
  if (r.gpu) L.caster(m.x, m.y, 3.2 * s, 12 * s);
  if (B.drawWith) B.drawWith(m, r, alpha, tint);
  else if (big) rig.draw(null, 0, 0, view, { r, alpha, flash: tint && tint[0], mix: tint ? tint[1] : 0 });
  else {   // the outline and rim passes are most of an actor's cost: like drawFoe, the governor drops them from ordinary beasts when frames run long
    const ol = OPT.outlines !== false && !(PERF.low && !m.elite && !m.boss);
    r.actor(m.x, m.y, m.z, (g, ox, oy) => rig.draw(g, ox, oy, view), { flash: tint && tint[0], flashMix: tint ? tint[1] : 0, alpha, outline: ol || !!(tint && tint[0]) || oc === FLASH_LINE, outlineColor: oc, rim: ol });
  }
  if (m.alive && rig.drawGlow && alpha > .3) r.queue(m.x, m.y, m.z, g => rig.drawGlow(g, r), { emissive: foeGlowSeen(m.x, m.y, (m.z || 0) + 3), bias: .02 });   // (a wall in front hides it: then it is drawn in depth order)
  else if (m.alive && !B.drawWith && rig.glow && rig.glow.length && alpha > .3) {
    const col = rig.C.eye, gl = rig.glow, gx = rig.x, gy = rig.y, gz = rig.rootZ;
    r.queue(m.x, m.y, m.z, g => { px.glow(g, 1); for (const e of gl) { const [x, y] = r.w(gx + e[0], gy + e[1], gz + e[2]); if (e[3] > 1.4) r.glowDisc(g, x, y, e[3] * 3, col, .3); px.disc(g, x, y, e[3], col); if (e[3] > .8) px.dot(g, x - .5, y - .6, '#ffffff'); } }, { emissive: foeGlowSeen(m.x, m.y, (m.z || 0) + (m.bstLift || 0) + 4), bias: .02 });
  }
  for (const id of m.affixes) { const a = REG.affixes[id]; if (a && a.draw && m.alive) a.draw(m, r); }
  if (m.glow && m.alive) L.add(m.x, m.y, m.z + 10, m.glow[1] || 50, .7, { color: m.glow[0] });
}
/** a crawler body for an archetype: the rig, fed from the monster every step */
function BST_crawlerBody(opts) {
  return m => {
    const pal = m.pal || {}, rig = new BST_Crawler(Object.assign({}, opts, { size: (opts.size || 1) * (m.scale || 1), colors: Object.assign({}, pal, pal.eyeGlow ? { eye: pal.eyeGlow } : {}) }));
    m.bp = m.bp || {};
    const st = { x: m.x, y: m.y, facing: m.facing, pose: m.bp };
    rig.update(0, st);
    return { rig, big: !!opts.big, shadow: opts.shadow, kick(v) { rig.kick(v); },
      update(dt, m2) {
        const p = m2.bp || (m2.bp = {}); p.hurt = m2.alive && (m2.stunT > 0 || m2.kbT > 0) ? 1 : 0;
        st.x = m2.x; st.y = m2.y; st.z = m2.z; st.lift = m2.bstLift || 0; st.vx = m2.vx; st.vy = m2.vy; st.facing = m2.facing; st.dead = m2.alive ? undefined : m2.deadT; st.pose = p;
        rig.update(dt, st);
      },
      draw(g, ox, oy, view) { rig.draw(g, ox, oy, view); } };
  };
}
/** spiders keep their full speed on webs (the core's floor rules slow everyone else there) */
function BST_webWalk(m) { if (m.speedK !== undefined && ED.L && ED.L.map && ED.L.map.floorAt(m.x, m.y) === 'web') m.speedK /= .45; }
/** idle spiders: short dashes around home, freezing between them (the way real spiders move) */
function BST_skitterIdle(m, dt, k = .5) {
  const a = m.ai; a.wt = (a.wt || 0) - dt;
  if (a.wt <= 0) { a.moving = !a.moving; a.wt = a.moving ? BST_rnd(.25, .6) : BST_rnd(.6, 2.2); if (a.moving) { const an = Math.random() * TAU, d = Math.random() * 26; a.wx = (m.homeX || m.x) + Math.cos(an) * d; a.wy = (m.homeY || m.y) + Math.sin(an) * d; } }
  const dx = (a.wx || m.x) - m.x, dy = (a.wy || m.y) - m.y, d = Math.hypot(dx, dy);
  if (a.moving && d > 3) { AI.move(m, [dx / d, dy / d], dt, k); AI.face(m, Math.atan2(dy, dx), dt, 10); } else AI.move(m, [0, 0], dt);
}
/** ichor: what a beast leaves when it dies (bits, a splat on the floor, a squelch) */
function BST_ichor(m, col = '#9ad84a', n = 10) {
  P.bits(m.x, m.y, (m.z || 0) + 5, n, [col, E.shade(col, -.35), E.shade(col, .3)]);
  FX.scorch(m.x, m.y, (m.r + 2) * (m.scale || 1), E.shade(col, -.55), 5); sfx('bst_squelch', { vol: .5, pitch: 1.4 / Math.sqrt(m.scale || 1) });
}
/* the pounce: a crawler in the air bites what it lands on (checked every step; the core flies the jump) */
BUS.on('step', () => {
  const h = ED.hero; if (!h) return;
  for (const m of ED.foes) {
    if (!m.bstPounce || !m.alive) continue;
    if (m.z <= 0 && !m.air) { m.bstPounce = false; continue; }
    if (!m.bstHit && h.alive && m.z < 16 && Math.hypot(h.x - m.x, h.y - m.y) < m.r + h.r + 3) {
      m.bstHit = true; const ang = Math.atan2(h.y - m.y, h.x - m.x);
      if (dealDamage(h, { src: m, amount: m.dmg * (m.arch.pounceDmg || 1.4), el: m.el, kb: 120, ang })) { onFoeHit(m, h); P.impact(lerp(m.x, h.x, .5), lerp(m.y, h.y, .5), 10, 7, '#ffb08a'); sfx('bst_bite', { vol: .7 }); m.vx *= -.35; m.vy *= -.35; }
    }
  }
});

/* ---- crawler AI: flank the hero in dashes, take a turn, crouch (a red lane on the floor), pounce; bite up close ---- */
function BST_crawlerAI(m, dt) {
  const h = ED.hero, a = m.ai, p = m.bp || (m.bp = {}); BST_webWalk(m);
  a.t = (a.t || 0) - dt; m.cool -= dt;
  if (!a.state) { a.state = 'roam'; a.side = Math.random() < .5 ? 1 : -1; a.burst = Math.random() * .4; }
  p.crouch = 0; p.fang = 0; p.lunge = 0; p.rear = 0;
  if (!AI.aware(m, m.arch.sense || 150)) { BST_skitterIdle(m, dt); return; }
  const dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1, toH = Math.atan2(dy, dx);
  if (m.stunT > 0 && a.state !== 'pounce') { AI.move(m, [0, 0], dt); if (a.state === 'crouch' || a.state === 'bite') { a.state = 'recover'; a.t = .3; m.tok = false; } return; }
  if (a.state === 'roam') {   // flank: circle toward a slot around the hero in bursts (dash, freeze, dash)
    a.burst -= dt; if (a.burst <= 0) { a.go = !a.go; a.burst = a.go ? BST_rnd(.35, .75) : BST_rnd(.06, .2); if (a.go && Math.random() < .25) sfx('bst_skitter', { vol: .4 }); }
    const ring = m.arch.ring || 36, slot = toH + Math.PI + a.side * (.8 + .5 * Math.sin(game.time * .6 + m.ph)), tx = h.x + Math.cos(slot) * ring, ty = h.y + Math.sin(slot) * ring;
    const dd = Math.hypot(tx - m.x, ty - m.y), dir = AI.steer(m, tx, ty);
    AI.move(m, dd > 4 ? dir : [0, 0], dt, a.go ? 1.2 : .08);
    AI.face(m, dd > 8 && a.go ? Math.atan2(dir[1], dir[0]) : toH, dt, 10);
    p.fang = d < 50 ? .25 + .25 * Math.sin(game.time * 11 + m.ph) : 0;
    if (m.arch.pounce !== false && d < 64 && d > 18 && m.cool <= 0 && AI.takeTurn(m)) { a.state = 'crouch'; a.t = .5; m.tok = true; sfx('bst_hiss', { vol: .35, pitch: 1.3 / (m.scale || 1) }); FX.telegraph({ shape: 'line', x: m.x, y: m.y, ang: toH, len: d + 8, w: 9 * (m.scale || 1), dur: .5, owner: m }); a.ang = toH; }
    else if (d < m.r + h.r + 6 && m.cool <= 0 && AI.takeTurn(m)) { a.state = 'bite'; a.t = .34; m.tok = true; a.bit = false; }
  } else if (a.state === 'crouch') {   // the wind-up: low, front legs raised, fangs spread, a shiver
    AI.move(m, [0, 0], dt, 1); AI.face(m, a.ang, dt, 14); p.crouch = 1; p.fang = .7;
    if (Math.random() < dt * 30 && m.body) m.body.kick((Math.random() - .5) * 1.2);
    if (a.t <= 0) {   // leap: a ballistic arc the core flies; the step hook bites on contact
      const vz = 118, T0 = 2 * vz / 520, v = Math.min(210, (d + 5) / T0);
      m.z = .6; m.vz = vz; m.vx = Math.cos(a.ang) * v; m.vy = Math.sin(a.ang) * v; m.bstPounce = true; m.bstHit = false; a.state = 'pounce';
      if (m.body) m.body.kick(3); P.dust(m.x, m.y, 0, 5, { speed: 30 }); sfx('bst_bite', { vol: .35, pitch: .7 });
    }
  } else if (a.state === 'pounce') { a.state = 'recover'; a.t = .5; m.tok = false; m.cool = 1.3 + Math.random() * 1.2; AI.move(m, [0, 0], dt); }
  else if (a.state === 'bite') {   // fangs spread, then a lunging snap
    AI.face(m, toH, dt, 12); AI.move(m, [0, 0], dt); p.fang = a.t > .12 ? 1 : .1; p.lunge = a.t <= .14 && a.t > -.05 ? 1 : 0;
    if (a.t <= .14 && !a.bit) { a.bit = true; sfx('bst_bite', { vol: .5 }); if (d < m.r + h.r + 9 && Math.abs(E.angDiff(m.facing, toH)) < 1) { if (dealDamage(h, { src: m, amount: m.dmg, el: m.el, kb: 70, ang: toH })) { onFoeHit(m, h); P.impact(lerp(m.x, h.x, .6), lerp(m.y, h.y, .6), 8, 5, '#ffb08a'); } } }
    if (a.t <= -.12) { a.state = 'recover'; a.t = .35; m.tok = false; m.cool = .9 + Math.random(); }
  } else {   // recover: back off a step, then flank again
    AI.move(m, [-dx / d, -dy / d], dt, .55); AI.face(m, toH, dt, 8);
    if (a.t <= 0) { a.state = 'roam'; a.side = Math.random() < .5 ? 1 : -1; }
  }
}
const BST_CRAWLER_PALS = [
  { base: '#4a3a4e', leg: '#3e3242', belly: '#2a2230', mark: '#d8a840', eye: '#ff5a3a', fang: '#e0d0b8', joint: '#7a6a7e' },   // cave spider, amber chevrons
  { base: '#2e2632', leg: '#28222c', belly: '#1e1a22', mark: '#d8303a', eye: '#ff4a4a', fang: '#e8d8c0', joint: '#5a4a5e' },   // widow, red hourglass
  { base: '#8a7e6a', leg: '#6e6454', belly: '#5a5040', mark: '#4a3a2a', eye: '#8affc8', fang: '#f0e8d8', joint: '#a89c86' },   // pale lurker
  { base: '#5a4a2a', leg: '#4a3c22', belly: '#3a2e1a', mark: '#9ae05a', eye: '#d8ff6a', fang: '#e0d8b8', joint: '#7a6a42' }];   // fungal
def('archetypes', 'crawler', { name: 'Crawler', tags: ['beast', 'spider', 'melee'], themes: ['fungal', 'cavern', 'abyss', 'mine', 'ruins'], minDepth: 4, weight: 11,
  hp: 15, dmg: 7, speed: 58, r: 4.5, xp: 8, head: 13, mass: .8, el: 'phys', ring: 36, pounceDmg: 1.4,
  body: BST_crawlerBody({ pattern: 'chevron' }), palettes: BST_CRAWLER_PALS, elKeys: ['mark', 'eye'], ai: BST_crawlerAI, corpseT: 2.4,
  onSpawn(m) { m.body.rig.o.pattern = rnd.pick(['chevron', 'chevron', 'hourglass', 'spots', 'bands']); },
  draw: (m, r, a) => BST_drawBeast(m, r, a), onDie(m) { BST_ichor(m); } });

/* =============================================================================
 * WEBS ON THE FLOOR: web cells are the standard floor tag 'web' (the core slows walkers on it and draws it). Webs
 * made at runtime (spit globs, the Brood Mother's spray) and webs that burn are repainted into the baked floor
 * image cell by cell, so nothing re-bakes the whole level. FIRE CLEARS WEBS anywhere: fire bolts flying low, fire
 * areas, novas, waves and beams, fire hits and burning units ignite the cell; flame runs along connected webs and
 * sets alight every monster standing in it.
 * ============================================================================= */
/** re-rasterize a few floor cells into the current view's baked floor (a copy of the TileMap's own bake, per cell) */
function BST_repaint(map, cells) {
  if (!map || !map.floors || !cells.length) return;
  const view = game.view, key = view.id + ':' + view.yawDeg + ':' + view.pitchDeg + ':' + view.scale, f = map.floors[key];
  for (const k in map.floors) if (k !== key) delete map.floors[k];   // other views re-bake when next shown
  if (!f || !view.inv) return;
  const T = map.T, g = f.cv.getContext('2d'), gi = f.info ? f.info.getContext('2d') : null, W = f.cv.width, Hh = f.cv.height;
  for (const [cx, cy] of cells) {
    if (map.cell(cx, cy) !== 0) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of [[cx * T, cy * T], [cx * T + T, cy * T], [cx * T, cy * T + T], [cx * T + T, cy * T + T]]) { const s = view.p(x, y, 0); x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); }
    const X0 = clamp(Math.floor(x0 - f.x0) - 1, 0, W - 1), Y0 = clamp(Math.floor(y0 - f.y0) - 1, 0, Hh - 1), X1 = clamp(Math.ceil(x1 - f.x0) + 1, 0, W - 1), Y1 = clamp(Math.ceil(y1 - f.y0) + 1, 0, Hh - 1), w = X1 - X0 + 1, h = Y1 - Y0 + 1;
    if (w < 1 || h < 1) continue;
    const img = g.getImageData(X0, Y0, w, h), d = img.data, ii = gi && gi.getImageData(X0, Y0, w, h), id = ii && ii.data, tag = map.floorTags ? map.floorTags[cy * map.w + cx] : null;
    for (let py = 0; py < h; py++) for (let pxx = 0; pxx < w; pxx++) {
      const q = view.toGround(X0 + pxx + f.x0 + .5, Y0 + py + f.y0 + .5), gx = q[0], gy = q[1];
      if (Math.floor(gx / T) !== cx || Math.floor(gy / T) !== cy) continue;
      let c = map.floorTex(gx, gy, tag); if (!c) continue;
      if (map.ao) {   // the same contact shadow the TileMap bakes along wall feet
        const lx = gx - cx * T, ly = gy - cy * T, R = map.ao, wall = (dx, dy) => map.cell(cx + dx, cy + dy) !== 0; let ao = 0;
        if (wall(-1, 0)) ao = Math.max(ao, 1 - lx / R); if (wall(1, 0)) ao = Math.max(ao, 1 - (T - lx) / R); if (wall(0, -1)) ao = Math.max(ao, 1 - ly / R); if (wall(0, 1)) ao = Math.max(ao, 1 - (T - ly) / R);
        if (wall(-1, -1)) ao = Math.max(ao, 1 - Math.hypot(lx, ly) / R); if (wall(1, -1)) ao = Math.max(ao, 1 - Math.hypot(T - lx, ly) / R); if (wall(-1, 1)) ao = Math.max(ao, 1 - Math.hypot(lx, T - ly) / R); if (wall(1, 1)) ao = Math.max(ao, 1 - Math.hypot(T - lx, T - ly) / R);
        if (ao > 0) { const k = 1 - .4 * Math.round(ao * 5) / 5; c = [c[0] * k, c[1] * k * .98, c[2] * k * 1.02, c[3]]; }
      }
      const k = (py * w + pxx) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
      if (id) { id[k] = 0; id[k + 1] = 40; id[k + 2] = Math.round(clamp(c[3] || 0, 0, 1) * 255); id[k + 3] = 255; }
    }
    g.putImageData(img, X0, Y0); if (ii) gi.putImageData(ii, X0, Y0);
  }
}
/** webs drawn as real silk: radial spokes and a spiral round the nearest web centre, thin and pale over a hazed floor.
 *  (A level that gets webs has its map's floorTex decorated with this for 'web' cells; every other tag is untouched.) */
function BST_webTex(L0, x, y, base) {
  const b = base(x, y) || [40, 36, 48], haze = [b[0] * .8 + 20, b[1] * .8 + 20, b[2] * .8 + 26, b[3]];
  let best = null, bd = 1e9; const near = L0.bstWebI && L0.bstWebI.get(Math.floor(y / BST_T) * 4096 + Math.floor(x / BST_T));   // only the webs that reach this cell
  if (near) for (const c of near) { const d = (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y); if (d < bd) { bd = d; best = c; } }
  let s0 = 0;
  if (best && bd < (best.r + 12) * (best.r + 12)) {
    const rho = Math.sqrt(bd), th = Math.atan2(y - best.y, x - best.x) + best.a, n = best.n, sp = best.sp;
    const spoke = rho * 2 / n * Math.abs(Math.sin(th * n / 2)), ring = ((rho + (th / TAU) * sp) % sp + sp) % sp, edge = clamp((best.r + 12 - rho) / 8, 0, 1);
    if (spoke < .42 && rho > 1) s0 = edge; else if ((ring < .38 || ring > sp - .38) && rho < best.r + 4) s0 = .85 * edge;
    if (rho < 1.6) s0 = 1;
  }
  if (!s0) { const u = x / BST_T, v = y / BST_T, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, h = E.hash2(i * 3 + 1, j * 7 + 2); if (Math.abs(fu * (h - .5) * 2 - fv + h * .6) < .03 || Math.abs(fu + fv * h - .9) < .025) s0 = .6; }
  if (!s0) return haze;
  const dew = E.hash2(Math.floor(x * 1.7), Math.floor(y * 1.7)) < .006, k = .8 * s0;
  return dew ? [255, 255, 255, b[3]] : [lerp(haze[0], 228, k), lerp(haze[1], 226, k), lerp(haze[2], 238, k), b[3]];
}
function BST_webFloor(L0) {
  const m = L0.map; if (!m || m.bstWebTex) return; const base = m.floorTex; m.bstWebTex = true;
  m.floorTex = (x, y, tag) => tag === 'web' ? BST_webTex(L0, x, y, (a, c) => base(a, c, null)) : base(x, y, tag);
}
/** web on / off at a cell (only on plain floor, never over pits, water or lava). Returns true if it changed */
function BST_setWeb(L0, cx, cy, on) {
  const m = L0 && L0.map; if (!m || cx < 1 || cy < 1 || cx >= m.w - 1 || cy >= m.h - 1) return false;
  if (!m.floorTags) m.floorTags = new Array(m.w * m.h).fill(null);
  const i = cy * m.w + cx, t = m.floorTags[i];
  if (on) { if (t || m.cell(cx, cy) !== 0 || (m.blocked && m.blocked[i])) return false; BST_webFloor(L0); m.floorTags[i] = 'web'; }
  else { if (t !== 'web') return false; m.floorTags[i] = null; }
  L0.bstHasWeb = true; return true;
}
/** spin a round patch of web at a world point (a spit glob landing, a spray, a leap, a nest) */
function BST_webPatch(x, y, rad, quiet, Lv) {
  const L0 = Lv || ED.L; if (!L0 || !L0.map) return;
  const wc = { x, y, r: rad, n: 10 + ((Math.random() * 6) | 0), a: Math.random() * TAU, sp: 3.4 + Math.random() * 1.4 }; (L0.bstWebC || (L0.bstWebC = [])).push(wc);
  const I = L0.bstWebI || (L0.bstWebI = new Map()), reach = rad + 12;
  for (let cy = Math.floor((y - reach) / BST_T); cy <= Math.floor((y + reach) / BST_T); cy++) for (let cx = Math.floor((x - reach) / BST_T); cx <= Math.floor((x + reach) / BST_T); cx++) { const k = cy * 4096 + cx; let a = I.get(k); if (!a) I.set(k, a = []); a.push(wc); }
  const c0 = Math.floor((x - rad) / BST_T), c1 = Math.floor((x + rad) / BST_T), r0 = Math.floor((y - rad) / BST_T), r1 = Math.floor((y + rad) / BST_T), ch = [];
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) if (Math.hypot((cx + .5) * BST_T - x, (cy + .5) * BST_T - y) <= rad + 5) { if (BST_setWeb(L0, cx, cy, true)) ch.push([cx, cy]); else if (L0.map.floorTags[cy * L0.map.w + cx] === 'web') ch.push([cx, cy]); }
  if (ch.length) BST_repaint(L0.map, ch);
  if (!quiet) for (let i = 0; i < 5; i++) P.add({ kind: 'bit', x: x + (Math.random() - .5) * rad, y: y + (Math.random() - .5) * rad, z: 2, vz: 30, g: 200, max: .5, color: '#f0eef8' });
}
/* ---- burning: a cell catches, flares for a moment, spreads to its web neighbours, ignites what stands on it ---- */
const BST_FIRE = { cells: [], set: new Set(), L: null, snd: 0, scan: 0 };
function BST_ignite(x, y, src) {
  const L0 = ED.L; if (!L0 || !L0.map || !L0.bstHasWeb) return;
  const m = L0.map, cx = Math.floor(x / BST_T), cy = Math.floor(y / BST_T); if (cx < 0 || cy < 0 || cx >= m.w || cy >= m.h) return;
  const i = cy * m.w + cx; if (!m.floorTags || m.floorTags[i] !== 'web' || BST_FIRE.set.has(i)) return;
  if (BST_FIRE.L !== L0) { BST_FIRE.cells.length = 0; BST_FIRE.set.clear(); BST_FIRE.L = L0; }
  BST_FIRE.set.add(i); BST_FIRE.cells.push({ i, cx, cy, x: (cx + .5) * BST_T, y: (cy + .5) * BST_T, t: 0, spread: false, src: src || null });
  BST_setWeb(L0, cx, cy, false); BST_repaint(m, [[cx, cy]]);
  P.fire((cx + .5) * BST_T, (cy + .5) * BST_T, 1, BST_FIRE.cells.length > 12 ? 2 : 3, { size: 3.4, speed: 26 });
  if (game.time - BST_FIRE.snd > .09) { BST_FIRE.snd = game.time; sfx('bst_burn', { vol: .5 }); }
}
/** the step: find fire over webs, run the flames */
function BST_fireStep(dt) {
  const L0 = ED.L; if (!L0 || !L0.map) return;
  if ((BST_FIRE.scan -= dt) <= 0) { BST_FIRE.scan = 2; const ft = L0.map.floorTags; L0.bstHasWeb = !!(ft && ft.includes('web')); }
  if (L0.bstHasWeb) {
    for (const f of ED.fx) {
      if (f.el !== 'fire') continue;
      if (f.kind === 'bolt') { if (f.z < 26) BST_ignite(f.x, f.y, f.src); }
      else if (f.kind === 'area') { if (Math.random() < dt * 8) { const a = Math.random() * TAU, d = Math.random() * f.r; BST_ignite(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, f.src); } BST_ignite(f.x, f.y, f.src); }
      else if (f.kind === 'nova') { const R = lerp(f.r0, f.r1, E.ease.outQuad(Math.min(1, f.t / f.dur))); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; BST_ignite(f.x + Math.cos(a) * R, f.y + Math.sin(a) * R, f.src); } }
      else if (f.kind === 'wave') { const d = Math.min(f.len, f.t * f.speed); BST_ignite(f.x + Math.cos(f.ang) * d, f.y + Math.sin(f.ang) * d, f.src); }
      else if (f.kind === 'beam' && f.t > (f.warm || 0)) for (let s = 0; s < (f.reach || f.len); s += 8) BST_ignite(f.x + Math.cos(f.ang) * s, f.y + Math.sin(f.ang) * s, f.src);
    }
    const h = ED.hero; if (h && h.st.burn) BST_ignite(h.x, h.y, h);
    for (const m of ED.foes) if (m.st.burn && m.alive) BST_ignite(m.x, m.y, m.st.burn.src);
  }
  const C = BST_FIRE.cells; if (BST_FIRE.L !== L0) { C.length = 0; BST_FIRE.set.clear(); BST_FIRE.L = L0; return; }
  for (let k = C.length - 1; k >= 0; k--) {
    const c = C[k]; c.t += dt;
    if (!c.spread && c.t > .075) {   // the flame runs on along the silk
      c.spread = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) BST_ignite((c.cx + dx + .5) * BST_T, (c.cy + dy + .5) * BST_T, c.src);
      // whatever stands in the flames catches fire (monsters fully; the hero only singed)
      GRID.each(c.x, c.y, 9, u => { if (u.bstBurnt === c.i || !u.alive) return; u.bstBurnt = c.i; dealDamage(u, { src: c.src && c.src.team === 'hero' ? c.src : null, amount: heroHitAmount(.45), el: 'fire', kb: 0, status: 'burn', statusChance: 1, statusPower: heroHitAmount(.3), tags: ['fire', 'floor'] }); });
      for (const t of L0.things) if (t.kind === 'bst_egg' && !t.dead && Math.hypot(t.x - c.x, t.y - c.y) < 12) t.burn();
    }
    if (Math.random() < dt * (C.length > 12 ? 9 : 16)) P.add({ kind: 'fire', x: c.x + (Math.random() - .5) * 14, y: c.y + (Math.random() - .5) * 14, z: 1, vz: 22 + Math.random() * 20, g: -10, drag: 3, max: .3 + Math.random() * .25, size: 2.2 + Math.random() * 1.6 });
    if (Math.random() < dt * 4) P.add({ kind: 'ember', x: c.x, y: c.y, z: 3, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, vz: 40 + Math.random() * 40, drag: 1.5, max: .9, color: '#ffb050' });
    if (c.t > .5) { C.splice(k, 1); FX.scorch(c.x, c.y, 7, '#1a1016', 3); }
  }
}
BUS.on('step', e => BST_fireStep(e.dt));
BUS.on('hit', e => { if (e.hit && e.hit.el === 'fire' && e.tgt && ED.L && ED.L.bstHasWeb) BST_ignite(e.tgt.x, e.tgt.y, e.src); });
BUS.on('draw', e => {
  const r = e.r; if (BST_FIRE.L !== ED.L) return;
  for (const c of BST_FIRE.cells) { const u = c.t / .5, a = Math.sin(Math.min(1, u) * Math.PI); r.decal(() => { r.groundDisc(c.x, c.y, 9 + u * 3, '#ff8a3a', .35 * a); r.groundDisc(c.x, c.y, 5, '#ffe070', .45 * a); }, { emissive: .9 }); L.add(c.x, c.y, 6, 44, .9 * a, { color: '#ffb050' }); }
});

/* ---------- egg sacs: pale, veined, pulsing; they hatch broodlings (when their time comes or when the hero comes near) ---------- */
// o: { hatch: seconds | null (proximity), n: broodlings, vz, vx, vy (thrown eggs fly first), size }
function BST_egg(x, y, o = {}) {
  const L0 = o.L || ED.L; if (!L0) return null;
  const e = addThing(L0, { kind: 'bst_egg', x, y, z: o.z || 0, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, r: 4.5 * (o.size || 1), s: o.size || 1, solid: false, hittable: true, t: 0, hatchT: o.hatch === undefined ? null : o.hatch, n: o.n || 3, cue: -1, ph: Math.random() * 9, mapColor: '#e8d8a0',
    onHit(hit) { if (this.z > 2) return; if (hit.el === 'fire') { this.burn(); return; } this.pop(true); },
    pop(killed) { if (this.dead) return; this.dead = true; P.bits(this.x, this.y, 4, 10, ['#e8dcb0', '#c8b890', '#9ad84a']); P.dust(this.x, this.y, 0, 4, { color: '#c8c0a0' }); sfx('bst_egg', { vol: .6 }); FX.scorch(this.x, this.y, 5 * this.s, '#3a4a1a', 4); if (killed) P.text(this.x, this.y, 12, 'SQUISH', '#d8f0a0'); },
    burn() { if (this.dead) return; this.dead = true; P.fire(this.x, this.y, 3, 5, { size: 3 }); P.smoke(this.x, this.y, 6, 3, { size: 3 }); sfx('bst_burn', { vol: .5 }); FX.scorch(this.x, this.y, 6 * this.s, '#1a1016', 5); },
    hatch() { if (this.dead) return; this.dead = true; sfx('bst_squelch', { vol: .6, pitch: 1.3 }); P.bits(this.x, this.y, 5, 12, ['#e8dcb0', '#c8b890', '#9ad84a']); P.ring(this.x, this.y, 2, 14, '#e8dcb0', .3);
      for (let i = 0; i < this.n; i++) { const a = Math.random() * TAU, b = spawnMonster('broodling', this.x + Math.cos(a) * 3, this.y + Math.sin(a) * 3, { instant: true }); if (b) { b.ai.aware = true; b.vx = Math.cos(a) * 60; b.vy = Math.sin(a) * 60; b.cool = .6 + Math.random() * .5; b.noLoot = Math.random() < .7; } } },
    update(dt) {
      if (this.z > 0 || this.vz > 0) { this.vz -= 400 * TUNE.gravity * dt; this.z += this.vz * dt; this.x += this.vx * dt; this.y += this.vy * dt; if (this.z <= 0) { this.z = 0; this.vz = 0; this.vx = this.vy = 0; P.dust(this.x, this.y, 0, 5, { color: '#c8c0a0' }); sfx('bst_egg', { vol: .35, pitch: .7 }); if (ED.L && ED.L.map && ED.L.map.solidAt(this.x, this.y)) this.pop(false); } return; }
      this.t += dt; const h = ED.hero;
      if (this.cue < 0 && (this.hatchT !== null ? this.t >= this.hatchT : h && h.alive && Math.hypot(h.x - this.x, h.y - this.y) < 44)) this.cue = 0;
      if (this.cue >= 0 && (this.cue += dt) > .9) this.hatch();
    },
    draw(r) {
      if (!r.visible(this.x, this.y, this.z, 30, 30, 30)) return;
      const shake = this.cue >= 0 ? Math.sin(game.time * 60) * (1 + this.cue * 2) : Math.sin(game.time * 3 + this.ph) * .3, pul = 1 + .07 * Math.sin(game.time * (this.cue >= 0 ? 14 : 3) + this.ph), s = this.s;
      if (this.z <= 0) r.decal(() => { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + this.ph; const [x0, y0] = r.w(this.x, this.y, 0), [x1, y1] = r.w(this.x + Math.cos(a) * 9 * s, this.y + Math.sin(a) * 9 * s, 0); px.blend(r.tgt, .6, 'normal', () => px.line(r.tgt, x0, y0, x1, y1, '#e8e4f0')); } });
      r.shadow(this.x, this.y, 4 * s, .45);
      r.queue(this.x, this.y, this.z, g => {
        const view = r.view, [ox, oy] = r.w(this.x, this.y, this.z), q = view.scale * s, t = E.tones('#dccca0'), R = 4.4 * s * pul;
        const e = BST_ell(view, Math.round(ox + shake), oy, [0, 0, R * .95], [R * 1.05, 0, 0], [0, R * 1.05, 0], [0, 0, R * 1.15]);
        BST_ball(g, e, t, BST_OL, false);
        for (let k = 0; k < 3; k++) { const a = this.ph + k * 2.1, [vx, vy] = [e.x + Math.cos(a) * e.rmax * .6, e.y + Math.sin(a) * e.rmin * .5]; px.line(g, e.x + Math.cos(a) * e.rmax * .15, e.y - e.rmin * .5, vx, vy, '#b0706a'); }
        const wiggle = this.cue >= 0 ? 1 : .3; for (let k = 0; k < 3; k++) { const a = game.time * 2 * wiggle + k * 2.1 + this.ph; px.disc(g, e.x + Math.cos(a) * e.rmax * .35, e.y + Math.sin(a) * e.rmin * .3 + 1, Math.max(.6, q * .7), '#6a5a3a'); }
        px.dot(g, e.x - e.rmax * .4, e.y - e.rmin * .55, '#ffffff');
      });
    } });
  return e;
}

/* ---- webspinner: a spitting spider: keeps its distance, rears and spits silk globs that slow and web the floor ---- */
function BST_webGlob(m, tx, ty, o = {}) {
  const d = Math.hypot(tx - m.x, ty - m.y), sp = o.speed || 120, tf = Math.max(.25, d / sp), grav = 300, z0 = o.z || 8, vz = grav * tf / 2 - z0 / tf, ang = Math.atan2(ty - m.y, tx - m.x);
  return FX.bolt({ team: 'foe', src: m, x: m.x + Math.cos(ang) * 6 * (m.scale || 1), y: m.y + Math.sin(ang) * 6 * (m.scale || 1), z: z0, ang, speed: sp, grav, vz, life: tf + .5, r: 3.5, el: 'phys', light: 0,
    hit: { amount: m.dmg * (o.dmg || .5), kb: 20, status: 'slow', statusChance: 1, noNumber: false }, tags: ['proj', 'web'],
    look: { color: '#f0eef8', core: '#ffffff', size: 2, trail: false, draw(g, x, y, p, r) { const zm = r.view.zoom || 1, a = Math.atan2(p.vy, p.vx), [tx2, ty2] = r.w(p.x - Math.cos(a) * 7, p.y - Math.sin(a) * 7, p.z - p.vz * .03); px.line(g, tx2, ty2, x, y, '#b8b4c8', 1); px.disc(g, x, y, 2.4 * zm, '#9a96b0'); px.disc(g, x - .5, y - .5, 1.8 * zm, '#f0eef8'); px.dot(g, x - 1, y - 1, '#ffffff'); } },
    onHit(p, u) { P.bits(u.x, u.y, 10, 6, ['#f0eef8', '#c8c4d8']); },
    onEnd(p) { if (p.z <= .5) { BST_webPatch(p.x, p.y, o.web || 9); sfx('bst_spit', { vol: .3, pitch: 1.4 }); } } });
}
function BST_spinnerAI(m, dt) {
  const h = ED.hero, a = m.ai, p = m.bp || (m.bp = {}); BST_webWalk(m);
  a.t = (a.t || 0) - dt; m.cool -= dt; p.crouch = 0; p.fang = 0; p.lunge = 0; p.rear = 0;
  if (a.orbit === undefined) { a.orbit = Math.random() < .5 ? 1 : -1; a.fire = 1 + Math.random() * 2; a.burst = 0; }
  if (!AI.aware(m, 170)) { BST_skitterIdle(m, dt, .4); return; }
  const dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1, toH = Math.atan2(dy, dx);
  if (m.stunT > 0) { AI.move(m, [0, 0], dt); a.spit = 0; m.tok = false; return; }
  if (a.spit > 0) {   // the wind-up: reared up, fangs wide, a trembling aim; then the glob
    a.spit -= dt; AI.move(m, [0, 0], dt); AI.face(m, toH, dt, 10); p.rear = 1; p.fang = 1;
    if (a.spit <= 0) { const lead = .35, tx = h.x + h.vx * lead, ty = h.y + h.vy * lead; BST_webGlob(m, tx, ty, { web: 10 }); sfx('bst_spit', { vol: .5 }); m.tok = false; a.fire = 2.6 + Math.random() * 1.6; if (m.body) m.body.kick(-2); }
    return;
  }
  if (d < 24 && m.cool <= 0 && AI.takeTurn(m)) { a.state = 'bite'; }
  if (a.state === 'bite') {   // cornered: a quick snap, then away
    p.fang = 1; p.lunge = 1; AI.face(m, toH, dt, 12);
    if (!a.bit) { a.bit = true; a.bt = .25; }
    if ((a.bt -= dt) <= 0) { a.state = null; a.bit = false; m.tok = false; m.cool = 1.4; if (d < m.r + h.r + 9 && dealDamage(h, { src: m, amount: m.dmg * .8, el: m.el, kb: 60, ang: toH })) { onFoeHit(m, h); sfx('bst_bite', { vol: .5 }); } }
    AI.move(m, [0, 0], dt); return;
  }
  // keep the range, circle, move in dashes
  a.burst -= dt; if (a.burst <= 0) { a.go = !a.go; a.burst = a.go ? BST_rnd(.4, .9) : BST_rnd(.1, .35); if (Math.random() < .2) a.orbit *= -1; }
  const want = d > 110 ? 1 : d < 64 ? -1.3 : 0, see = AI.clear(m, h.x, h.y); let mv = [dx / d * want - dy / d * a.orbit * .8, dy / d * want + dx / d * a.orbit * .8]; const ml0 = Math.hypot(mv[0], mv[1]) || 1;
  if (!see) mv = AI.steer(m, h.x, h.y);   // a wall between: go round it to find a line
  else if (ED.L.map.solidAt(m.x + mv[0] / ml0 * 14, m.y + mv[1] / ml0 * 14)) a.orbit *= -1;   // circling into a wall: the other way
  const ml = Math.hypot(mv[0], mv[1]) || 1;
  AI.move(m, a.go ? [mv[0] / ml, mv[1] / ml] : [0, 0], dt, .9); AI.face(m, a.go && want !== 0 ? Math.atan2(mv[1], mv[0]) : toH, dt, 8);
  if ((a.fire -= dt) <= 0 && d < 170 && ED.L.map.los(m.x, m.y, h.x, h.y) && AI.takeTurn(m)) { a.spit = .6; m.tok = true; sfx('bst_hiss', { vol: .3, pitch: 1.1 }); }
}
def('archetypes', 'webspinner', { name: 'Webspinner', tags: ['beast', 'spider', 'ranged'], themes: ['fungal', 'cavern', 'abyss', 'mine'], minDepth: 6, weight: 7,
  hp: 20, dmg: 8, speed: 40, r: 5, xp: 11, head: 15, mass: 1, el: 'phys', corpseT: 2.4,
  body: BST_crawlerBody({ pattern: 'bands', abd: 1.55, ceph: 1, long: 1.08, size: 1.05 }), elKeys: ['mark', 'eye'],
  palettes: [{ base: '#c8c0cc', leg: '#9a92a4', belly: '#6a6276', mark: '#4a3a5a', eye: '#ff6a8a', fang: '#f0e8e0', joint: '#e0d8e8' },
    { base: '#d8b840', leg: '#3a3230', belly: '#2a2420', mark: '#2a2226', eye: '#ff5a3a', fang: '#f0e0c0', joint: '#6a5a48' },
    { base: '#8aa8b8', leg: '#5a6a78', belly: '#3a4452', mark: '#e8f0f8', eye: '#8affe0', fang: '#e8f0f0', joint: '#b8c8d8' }],
  ai: BST_spinnerAI, draw: (m, r, a) => BST_drawBeast(m, r, a), onDie(m) { BST_ichor(m, '#c8d870'); BST_webPatch(m.x, m.y, 7); } });

/* ---- broodling: a hatchling, fast and weak, swarms and nips ---- */
function BST_broodAI(m, dt) {
  const h = ED.hero, a = m.ai, p = m.bp || (m.bp = {}); BST_webWalk(m);
  m.cool -= dt; p.fang = 0; p.lunge = 0; p.crouch = 0;
  if (!AI.aware(m, 130)) { BST_skitterIdle(m, dt, .6); return; }
  if (m.stunT > 0) { AI.move(m, [0, 0], dt); return; }
  const dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1, toH = Math.atan2(dy, dx);
  a.burst = (a.burst || 0) - dt; if (a.burst <= 0) { a.go = !a.go; a.burst = a.go ? BST_rnd(.25, .5) : BST_rnd(.04, .15); a.wob = (Math.random() - .5) * 1.4; }
  const ang = toH + (d > 20 ? a.wob : 0); AI.move(m, a.go || d < 20 ? (d > m.r + h.r + 2 ? [Math.cos(ang), Math.sin(ang)] : [0, 0]) : [0, 0], dt, 1.1);
  AI.face(m, ang, dt, 14); p.fang = d < 24 ? .5 + .5 * Math.sin(game.time * 20 + m.ph) : 0;
  if (d < m.r + h.r + 5 && m.cool <= 0) { m.cool = 1 + Math.random() * .6; p.lunge = 1; if (dealDamage(h, { src: m, amount: m.dmg, el: m.el, kb: 20, ang: toH })) { onFoeHit(m, h); sfx('bst_bite', { vol: .25, pitch: 1.6 }); } }
}
def('archetypes', 'broodling', { name: 'Broodling', tags: ['beast', 'spider', 'swarm'], minDepth: 1, weight: 0, noPack: true,
  hp: 5, dmg: 3, speed: 66, r: 2.6, xp: 2, head: 8, mass: .35, el: 'venom', corpseT: 1.4,
  body: BST_crawlerBody({ size: .5, pattern: 'spots', abd: 1.25, palps: false, thick: 1.35 }), elKeys: ['mark', 'eye'],
  palettes: [{ base: '#d8ccb0', leg: '#b0a488', belly: '#8a7e64', mark: '#9ad84a', eye: '#ff7a4a', fang: '#f0e8d8', joint: '#e8e0c8' }, { base: '#c8b8c0', leg: '#a09098', belly: '#7a6a72', mark: '#d85a7a', eye: '#ffda4a', fang: '#f0e8d8', joint: '#e0d4dc' }],
  ai: BST_broodAI, draw: (m, r, a) => BST_drawBeast(m, r, a), onDie(m) { BST_ichor(m, '#9ad84a', 5); } });

/* =============================================================================
 * SERPENT RIG
 *   new BST_Serpent({ size, n (segments), gap, headR, bodyR, tailR, spines, fins (every nth), magma, horns, colors: { base, belly, spine, fin, eye, mouth, tooth, glow, dirt } })
 *   rig.reset(x, y, z, heading, 'column' | 'line')     the body hangs straight down a hole, or lies behind the head
 *   rig.update(dt, { x, y, z (head height, below 0 = underground), jaw 0..1, sway: [dx, dy, dz], writhe 0..1, dead })
 *   rig.draw(r, m, alpha, tint)                        each segment is its own depth-sorted item
 *   rig.rotatePath(cx, cy, angle)                       swing the whole body around a pivot (a tail sweep)
 * The body is a chain of segments laid along the head's recorded path, so it rises out of the ground and dives back
 * exactly where the head went. Segments below ground are hidden; where the body crosses the ground a churned-earth
 * hole opens; a head moving underground pushes up a travelling mound of dirt.
 * ============================================================================= */
class BST_Serpent {
  constructor(o = {}) {
    this.o = Object.assign({ size: 1, n: 10, gap: 3.2, headR: 3.8, bodyR: 3.3, tailR: 1.1, spines: true, fins: 3, magma: false, horns: false }, o);
    const C = this.C = Object.assign({ base: '#8a6a4a', belly: '#d8c090', spine: '#4a3222', fin: '#b04a3a', eye: '#ffd040', mouth: '#4a1418', tooth: '#f4ecd8', glow: '#ff8a2a', dirt: '#5a4a3a' }, o.colors || {});
    this.T = {}; for (const k of ['base', 'belly', 'spine', 'fin', 'dirt']) this.T[k] = E.tones(C[k]);
    this.path = []; this.seg = []; this.holes = []; this.jaw = 0; this.t = Math.random() * 9; this.x = 0; this.y = 0; this.z = 0; this.speed = 0; this.mound = 0; this.heading = 0;
    this.sway = null; this.writhe = 0; this.crumble = 0; this.flinch = 0; this.flV = 0; this.glow = [];
    for (let i = 0; i < this.o.n; i++) this.seg.push({ x: 0, y: 0, z: 0, r: 1, tx: 1, ty: 0, tz: 0, gone: false });
  }
  get len() { return (this.o.n - 1) * this.o.gap * this.o.size; }
  kick(v) { this.flV += v; }
  reset(x, y, z, heading = 0, mode = 'column') {
    const step = this.o.gap * this.o.size * .5, n = Math.ceil(this.len / step) + 6; this.path.length = 0;
    for (let i = n; i >= 1; i--) this.path.push(mode === 'column' ? { x, y, z: z - i * step } : { x: x - Math.cos(heading) * i * step, y: y - Math.sin(heading) * i * step, z });
    this.x = x; this.y = y; this.z = z; this.heading = heading; this.holes.length = 0; this._sample();
  }
  rotatePath(cx, cy, da) { const c = Math.cos(da), s = Math.sin(da); for (const p of this.path) { const dx = p.x - cx, dy = p.y - cy; p.x = cx + dx * c - dy * s; p.y = cy + dx * s + dy * c; } }
  update(dt, s) {
    const o = this.o, S = o.size, step = o.gap * S * .5;
    if (!this.path.length) this.reset(s.x, s.y, s.z, 0);
    const mv = Math.hypot(s.x - this.x, s.y - this.y, s.z - this.z); this.speed = lerp(this.speed, dt > 0 ? mv / dt : 0, Math.min(1, dt * 8));
    if (Math.hypot(s.x - this.x, s.y - this.y) > .05) this.heading = Math.atan2(s.y - this.y, s.x - this.x);
    this.x = s.x; this.y = s.y; this.z = s.z; this.t += dt; this.facing = s.facing; this.jaw = approach(this.jaw, s.jaw || 0, dt * 9); this.sway = s.sway || null; this.writhe = s.writhe || 0; this.dead = !!s.dead; this.crumble = s.crumble || 0;
    this.flV += (-this.flinch * 160 - this.flV * 12) * dt; this.flinch += this.flV * dt;
    // record the head's path in even steps (the body is laid along it)
    const P0 = this.path; let last = P0[P0.length - 1], dd = Math.hypot(s.x - last.x, s.y - last.y, s.z - last.z);
    while (dd >= step) { const u = step / dd; last = { x: lerp(last.x, s.x, u), y: lerp(last.y, s.y, u), z: lerp(last.z, s.z, u) }; P0.push(last); dd -= step; }
    const keep = Math.ceil(this.len / step) + 8; if (P0.length > keep) P0.splice(0, P0.length - keep);
    this._sample();
    // holes where the body crosses the ground; a mound over a head that moves underground
    const sg = this.seg;
    for (let k = 0; k < o.n - 1; k++) { const a = sg[k], b = sg[k + 1]; if (a.gone || b.gone) continue; if ((a.z >= 0) !== (b.z >= 0)) { const u = a.z / (a.z - b.z); this._hole(lerp(a.x, b.x, u), lerp(a.y, b.y, u), lerp(a.r, b.r, u), dt); } }
    for (let i = this.holes.length - 1; i >= 0; i--) if ((this.holes[i].age += dt) > 3.6) this.holes.splice(i, 1);
    const under = this.z < -sg[0].r * .35 && !this.dead; this.mound = approach(this.mound, under ? clamp(1.4 + this.z / (sg[0].r * 3), .35, 1) : 0, dt * 5);
    if (under && this.speed > 8 && Math.random() < dt * (6 + this.speed * .15)) { P.dust(this.x, this.y, 1, 1, { speed: 25, color: '#8a7a64', size: 1.4 * S }); if (Math.random() < .4) P.add({ kind: 'bit', x: this.x, y: this.y, z: 2, vx: (Math.random() - .5) * 50, vy: (Math.random() - .5) * 50, vz: 40 + Math.random() * 50, g: 380, bounce: .3, max: .6, size: Math.random() < .3 ? 2 : 1, color: this.C.dirt }); }
  }
  _hole(x, y, r, dt) {
    for (const h of this.holes) if (Math.hypot(h.x - x, h.y - y) < h.r * 1.3 + 2) { h.age = 0; h.x = lerp(h.x, x, .1); h.y = lerp(h.y, y, .1); h.r = Math.max(h.r, r);
      if (this.speed > 10 && Math.random() < dt * 14) { const a = Math.random() * TAU; P.add({ kind: 'bit', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z: 1, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, vz: 50 + Math.random() * 60, g: 380, bounce: .3, max: .7, size: Math.random() < .3 ? 2 : 1, color: Math.random() < .5 ? this.C.dirt : this.T.dirt.lt }); if (Math.random() < .3) P.dust(x, y, 1, 1, { speed: 30, color: '#8a7a64', size: 1.6 * this.o.size }); }
      return; }
    this.holes.push({ x, y, r, age: 0, seed: Math.random() * 9 });
    const S = this.o.size; P.bits(x, y, 2, Math.round(6 + 4 * S), [this.C.dirt, this.T.dirt.lt, this.T.dirt.sh]); P.dust(x, y, 1, Math.round(3 + 3 * S), { speed: 40 * Math.sqrt(S), color: '#8a7a64', size: 1.5 * S });
    if (S > 1.5) { shake(1.5); sfx('bst_burst', { vol: .3, pitch: 1.3 }); }
  }
  _sample() {
    const o = this.o, S = o.size, gap = o.gap * S, P0 = this.path, n = o.n, sg = this.seg;
    let ax = this.x, ay = this.y, az = this.z, i = P0.length - 1, acc = 0;
    for (let k = 0; k < n; k++) {
      const want = k * gap, q = sg[k];
      for (;;) {
        if (i < 0) { q.x = ax; q.y = ay; q.z = az - (want - acc); break; }   // ran out of path: the rest hangs straight down (into the ground)
        const b = P0[i], l = Math.hypot(b.x - ax, b.y - ay, b.z - az);
        if (acc + l >= want) { const u = l > 1e-6 ? (want - acc) / l : 0; q.x = lerp(ax, b.x, u); q.y = lerp(ay, b.y, u); q.z = lerp(az, b.z, u); break; }
        acc += l; ax = b.x; ay = b.y; az = b.z; i--;
      }
      q.r = (k === 0 ? o.headR : lerp(o.bodyR, o.tailR, Math.pow(k / (n - 1), 1.35))) * S;
      q.gone = this.crumble > 0 && k / n > 1 - this.crumble;
    }
    // secondary motion: a writhe runs down the body, a sway (or a cobra curl) moves the neck, a flinch jolts the head
    const wr = this.writhe, sw = this.sway, fl = this.flinch, tan = () => { for (let k = 0; k < n; k++) { const q = sg[k], a = sg[Math.max(0, k - 1)], b = sg[Math.min(n - 1, k + 1)]; const tx = a.x - b.x, ty = a.y - b.y, tz = a.z - b.z, tl = Math.hypot(tx, ty, tz) || 1; q.tx = tx / tl; q.ty = ty / tl; q.tz = tz / tl; } };
    tan();
    if (wr || sw || fl) {
      for (let k = 0; k < n; k++) {
        const q = sg[k], hl = Math.hypot(q.tx, q.ty) || 1, nx = -q.ty / hl, ny = q.tx / hl;
        if (wr > 0) { const w = Math.sin(this.t * 8 - k * .75) * wr * q.r * 1.3 * Math.min(1, k / 3 + .3); q.x += nx * w; q.y += ny * w; }
        const hw = Math.max(0, 1 - k / 6); if (hw > 0) { const hh = hw * hw; if (sw) { q.x += sw[0] * hh; q.y += sw[1] * hh; q.z += sw[2] * hh; } if (fl) { q.x -= q.tx * fl * hh; q.y -= q.ty * fl * hh; q.z -= q.tz * fl * hh; } }
      }
      tan();
    }
  }
  _tint(c, k) { const key = c + k, F = this._ft || (this._ft = {}); if (!F[key]) { F[key] = {}; for (const n in this.T) F[key][n] = n === 'dirt' ? this.T.dirt : E.tones(E.mix(this.C[n], c, Math.min(.55, k * 1.5))); } return F[key]; }   // the earth around it never flashes
  draw(r, m, alpha = 1, tint = null) {
    const view = r.view, o = this.o, S = o.size, sc = view.scale, T = tint ? this._tint(tint[0], tint[1]) : this.T, n = o.n, run = (G, f) => { if (alpha < 1) px.blend(G, alpha, 'normal', f); else f(); };
    // holes: a dark pit in churned earth, ringed with clods (the near clods cover the body where it enters the ground)
    for (const h of this.holes) {
      const a = clamp(1 - (h.age - 2) / 1.6, 0, 1); if (a <= 0 || !r.visible(h.x, h.y, 0, 60, 40, 60)) continue;
      r.decal(() => { r.groundDisc(h.x, h.y, h.r * 1.75, T.dirt.sh, .7 * a); r.groundDisc(h.x, h.y, h.r * 1.15, '#0e0a0a', .9 * a); r.groundRing(h.x, h.y, h.r * 1.75, T.dirt.deep, .5 * a); });
      for (let k = 0; k < 7; k++) {
        const an = h.seed + k * TAU / 7, rr = h.r * (1.3 + .2 * Math.sin(k * 3.1 + h.seed)), cx = h.x + Math.cos(an) * rr, cy = h.y + Math.sin(an) * rr, cs = h.r * (.17 + .07 * ((k * 7) % 3)) * a;
        r.queue(cx, cy, 0, g => { const [x, y] = r.w(cx, cy, cs * .45), R = Math.max(1, cs * sc); px.disc(g, x, y, R + 1, BST_OL); px.disc(g, x, y, R, T.dirt.sh); px.disc(g, x - .5, y - .6, Math.max(.5, R - .9), T.dirt.base); if (R > 1.6) px.dot(g, x - R * .4, y - R * .5, T.dirt.lt); });
      }
    }
    // the mound over a head moving underground: heaving earth and loose rocks
    if (this.mound > .02) {
      const mx = this.x, my = this.y, R = o.headR * S * 1.45 * this.mound, bob = Math.sin(this.t * 17) * .6 * this.mound, sd = this.t * 3;
      r.decal(() => { r.groundDisc(mx, my, R * 1.3, T.dirt.deep, .55); });
      r.queue(mx, my, 0, g => run(g, () => {
        const [x, y] = r.w(mx, my, 0), e = BST_ell(view, x, y + bob, [0, 0, 0], [R, 0, 0], [0, R, 0], [0, 0, R * .5]); BST_ball(g, e, T.dirt, BST_OL, false);
        for (let k = 0; k < 5; k++) { const a = k * 1.3 + Math.floor(sd) * .7, q = BST_surf(view, x, y + bob, [0, 0, 0], [R, 0, 0], [0, R, 0], [0, 0, R * .5], Math.cos(a) * .6, Math.sin(a) * .6, .5); const rr = Math.max(.8, R * sc * .12); px.disc(g, q[0], q[1], rr + .6, T.dirt.deep); px.disc(g, q[0] - .4, q[1] - .4, rr, T.dirt.lt); }
        for (let k = 0; k < 3; k++) { const cr = BST_surf(view, x, y + bob, [0, 0, 0], [R, 0, 0], [0, R, 0], [0, 0, R * .5], Math.cos(k * 2.1 + .4) * .3, Math.sin(k * 2.1 + .4) * .3, .95), c2 = BST_surf(view, x, y + bob, [0, 0, 0], [R, 0, 0], [0, R, 0], [0, 0, R * .5], Math.cos(k * 2.1 + .4) * .85, Math.sin(k * 2.1 + .4) * .85, .5); px.line(g, cr[0], cr[1], c2[0], c2[1], T.dirt.deep); }
      }));
    }
    // segments, tail first; buried ones hidden, crossing ones cut at the ground; the head last
    const glow = this.glow; glow.length = 0; this.eyes = null;
    for (let k = n - 1; k >= 0; k--) {
      const q = this.seg[k]; if (q.gone || q.z < -q.r * .62 || !r.visible(q.x, q.y, Math.max(0, q.z), 60, 60, 60)) continue;
      if (q.z > -q.r * .3 && q.z < 60) r.shadow(q.x, q.y, q.r * (1 - Math.min(.6, Math.max(0, q.z) * .01)), .35 * alpha);
      r.queue(q.x, q.y, Math.max(0, q.z), g => run(g, () => k ? this._seg(g, r, k, T) : this._head(g, r, T)), { bias: (k ? -k : 1) * 1e-4, occluder: S > 1.5 });
      if (o.magma && k && k % 2 === 0 && q.z > -q.r * .2) glow.push(k);
    }
    // glowing eyes and magma seams burn through the darkness
    if (!this.dead || this.crumble < .5) r.queue(this.seg[0].x, this.seg[0].y, Math.max(0, this.seg[0].z), g => {
      if (this.eyes) for (const e of this.eyes) { px.glow(g, 1); if (e[2] > 1.4) r.glowDisc(g, e[0], e[1], e[2] * 2.2, this.C.eye, .25); px.disc(g, e[0], e[1], e[2], this.dead ? '#6a5a4a' : this.C.eye); if (e[2] > 1) px.dot(g, e[0] - .5, e[1] - .6, '#ffffff'); }
    }, { emissive: foeGlowSeen(this.seg[0].x, this.seg[0].y, Math.max(0, this.seg[0].z)), bias: .02 });
    if (o.magma) for (const k of glow) { const q = this.seg[k]; if (k % 4 === 0) L.add(q.x, q.y, q.z + q.r, q.r * 4, .35, { color: this.C.glow }); }
  }
  /** screen helpers for a segment: centre, radius, the tangent / up / side directions on screen */
  _frame(r, q) {
    const v = r.view, [x, y] = r.w(q.x, q.y, q.z), R = q.r * v.scale;
    const P = (dx, dy, dz) => [x + (v.ax * dx + v.ay * dy) * q.r, y + (v.bx * dx + v.by * dy + v.bz * dz) * q.r];
    const hl = Math.hypot(q.tx, q.ty) || 1, sx = -q.ty / hl, sy = q.tx / hl;   // side (horizontal, perpendicular)
    const vt = Math.max(0, Math.abs(q.tz) - .45) * 2.2, bx = -Math.cos(this.heading) * vt, by = -Math.sin(this.heading) * vt;   // near vertical, the back faces away from where it looks
    let ux = -q.tz * q.tx + bx, uy = -q.tz * q.ty + by, uz = 1 - q.tz * q.tz; const dd = ux * q.tx + uy * q.ty + uz * q.tz; ux -= dd * q.tx; uy -= dd * q.ty; uz -= dd * q.tz; const ul = Math.hypot(ux, uy, uz) || 1;   // up, perpendicular to the body
    return { x, y, R, P, t: [q.tx, q.ty, q.tz], s: [sx, sy, 0], u: [ux / ul, uy / ul, uz / ul], near: v.dx * sx + v.dy * sy > 0 ? 1 : -1 };
  }
  _clip(g, r, q, x, y, R) {   // cut a half-buried segment at the ground line
    if (q.z >= q.r * .92) return false;
    const [, gy] = r.w(q.x, q.y, 0), rho = Math.sqrt(Math.max(0, q.r * q.r - q.z * q.z)), lim = Math.round(gy + rho * Math.sin(r.view.pitch) * r.view.scale * .8);
    g.save(); g.beginPath(); g.rect(Math.floor(x - R - 6), Math.floor(y - R * 4 - 20), Math.ceil(R * 2 + 12), Math.max(0, lim - Math.floor(y - R * 4 - 20))); g.clip(); return true;
  }
  _seg(g, r, k, T) {
    const q = this.seg[k], o = this.o, F = this._frame(r, q), { x, y, R, P, t, s, u } = F, clip = this._clip(g, r, q, x, y, R);
    const fin = o.fins && k > 1 && k < o.n - 2 && k % o.fins === 1, add = (a, b, c) => P(t[0] * a + s[0] * b + u[0] * c, t[1] * a + s[1] * b + u[1] * c, t[2] * a + s[2] * b + u[2] * c);
    const finAt = sd => [add(.35, sd * .7, .1), add(-.45, sd * .75, .15), add(-.95, sd * 1.75, .55)], flap = Math.sin(this.t * 5 + k) * .15;
    if (fin) { const f0 = finAt(-F.near); f0[2][1] += flap * R; px.poly(g, f0, BST_OL); px.poly(g, f0.map(p => [p[0], p[1] - .5]), T.fin.sh); }
    px.disc(g, x, y, R + 1, BST_OL); px.disc(g, x, y, R, T.base.sh);
    px.disc(g, x - .5, y - .6, Math.max(.5, R - 1.1), T.base.base);
    if (r.view.pitchDeg < 45 && R > 2.5 && Math.abs(t[2]) < .55) px.ell(g, x, y + R * .5, R * .74, R * .28, T.belly.base);
    // a dorsal ridge that runs from segment to segment (reads as one body, not a stack of balls), scale chevrons, a sparkle
    const d0 = add(-.55, 0, .62), d1 = add(.55, 0, .62), dw = Math.max(1, Math.round(R * .38));
    if (R > 1.6) { px.line(g, d0[0], d0[1], d1[0], d1[1], T.base.lt, dw); if (R > 3) px.line(g, d0[0] - .5, d0[1] - dw * .5, d1[0] - .5, d1[1] - dw * .5, T.base.hi); }
    if (R > 3.2) for (const sd of [-1, 1]) { const a0 = add(-.3, sd * .62, .45), a1 = add(.2, sd * .8, .2); px.line(g, a0[0], a0[1], a1[0], a1[1], T.base.sh); }
    if (o.magma && k % 2 === 0) { const pl = .5 + .5 * Math.sin(this.t * 3 - k * .5), c0 = add(-.1, -.5, .52), c1 = add(.15, .45, .55), w = Math.max(1, Math.round(R * .16)); px.glow(g, 1); px.line(g, c0[0], c0[1], c1[0], c1[1], E.shade(this.C.glow, -.35), w + 1); px.line(g, c0[0], c0[1], c1[0], c1[1], pl > .5 ? this.C.glow : E.shade(this.C.glow, .15), w); if (R > 6) px.dot(g, (c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2, '#fff0b0'); }
    if (o.spines && k < o.n - 1) { const sz = 1 + .35 * (1 - k / o.n), b0 = add(-.4, 0, .8), b1 = add(.3, 0, .84), tp = add(-.85 * sz, 0, (1.55 + .08 * Math.sin(this.t * 3 + k)) * sz); px.poly(g, [[b0[0], b0[1] + 1], [tp[0], tp[1] - 1], [b1[0] + 1, b1[1] + 1]], BST_OL); px.poly(g, [b0, tp, b1], T.spine.sh); px.line(g, b1[0], b1[1], tp[0], tp[1], T.spine.lt); px.dot(g, tp[0], tp[1], T.spine.hi); }
    if (fin) { const f1 = finAt(F.near); f1[2][1] += flap * R; px.poly(g, f1, BST_OL); px.poly(g, f1.map(p => [p[0] - .3, p[1] - .5]), T.fin.base); px.line(g, f1[0][0], f1[0][1], f1[2][0], f1[2][1], T.fin.lt); }
    if (clip) g.restore();
  }
  _head(g, r, T) {
    const q = this.seg[0], o = this.o, C = this.C, v = r.view, [ox, oy] = r.w(q.x, q.y, q.z), R0 = q.r, j = this.jaw;
    // the head is held level like a rearing cobra's: its forward is the facing, tipped by the neck
    const fc = this.facing === undefined ? this.heading : this.facing, Fv = BST_norm([q.tx * .8 + Math.cos(fc) * 1.2, q.ty * .8 + Math.sin(fc) * 1.2, q.tz * .55]);
    const hl = Math.hypot(Fv[0], Fv[1]) || 1, Rt = [-Fv[1] / hl, Fv[0] / hl, 0], U = BST_norm([Rt[1] * Fv[2] - Rt[2] * Fv[1], Rt[2] * Fv[0] - Rt[0] * Fv[2], Rt[0] * Fv[1] - Rt[1] * Fv[0]]);
    if (U[2] < 0) { U[0] = -U[0]; U[1] = -U[1]; U[2] = -U[2]; Rt[0] = -Rt[0]; Rt[1] = -Rt[1]; }
    const Wv = (f, rt, u) => [(Fv[0] * f + Rt[0] * rt + U[0] * u) * R0, (Fv[1] * f + Rt[1] * rt + U[1] * u) * R0, (Fv[2] * f + Rt[2] * rt + U[2] * u) * R0];
    const W = (f, rt, u) => { const w = Wv(f, rt, u); return BST_p(v, ox, oy, w[0], w[1], w[2]); };
    const sc = v.scale, clip = this._clip(g, r, q, ox, oy, R0 * sc * 2.4), near = v.dx * Rt[0] + v.dy * Rt[1] > 0 ? 1 : -1;
    const poly = (pts, c, ol = true) => { if (ol) px.poly(g, pts.map((p0, i) => { const cx = pts.reduce((a, b) => a + b[0], 0) / pts.length, cy = pts.reduce((a, b) => a + b[1], 0) / pts.length, dx = p0[0] - cx, dy = p0[1] - cy, l = Math.hypot(dx, dy) || 1; return [p0[0] + dx / l, p0[1] + dy / l]; }), BST_OL); px.poly(g, pts, c); };
    const horn = sd => { if (!o.horns) return; const a = W(-.35, sd * .42, .5), b = W(-1.1, sd * .72, .95), c = W(-1.75, sd * .6, .6), w0 = Math.max(.8, .2 * R0 * sc), w1 = Math.max(.6, .12 * R0 * sc); BST_cap(g, a, b, w0 + 1, w1 + 1, BST_OL); BST_cap(g, b, c, w1 + 1, 1.2, BST_OL); BST_cap(g, a, b, w0, w1, T.spine.sh); BST_cap(g, b, c, w1, .5, T.spine.base); px.line(g, a[0] - .5, a[1] - .5, b[0] - .5, b[1] - .5, T.spine.lt); };
    const jawU = .15 + .7 * j, jawL = .4 + 1.05 * j;
    horn(-near);
    // lower jaw (belly-pale), the open maw (it glows in a magma wyrm), the skull, the long upper snout, fangs, eyes and brows
    const lj = [W(-.1, -.62, -.25), W(-.1, .62, -.25), W(1.15, .34, -.3 - jawL * .55), W(1.95, 0, -.3 - jawL)];
    const lj2 = [lj[0], lj[1], lj[2], lj[3], W(1.15, -.34, -.3 - jawL * .55)];
    poly([lj2[0], lj2[4], lj2[3], lj2[2], lj2[1]], T.belly.sh); px.line(g, lj2[4][0], lj2[4][1], lj2[3][0], lj2[3][1], T.belly.base);
    if (j > .06) { const hg = W(.1, 0, -.05), ut = W(2.05, 0, jawU * .55), lt2 = W(1.85, 0, -.3 - jawL * .95), mo = o.magma ? E.mix(C.mouth, C.glow, .45 + .25 * Math.sin(this.t * 6)) : E.shade(C.mouth, .25);
      px.poly(g, [hg, ut, lt2], C.mouth); px.glow(g, o.magma ? 1 : 0); px.poly(g, [W(.45, 0, -.1), BST_lerp2(ut, lt2, .45), BST_lerp2(lt2, hg, .3)], mo); if (o.magma) px.poly(g, [W(.75, 0, -.12), BST_lerp2(ut, lt2, .5), BST_lerp2(lt2, hg, .5)], E.mix(C.glow, '#fff0b0', .45));
      for (const u0 of [.6, 1, 1.4]) for (const sd of [-1, 1]) { const k0 = u0 / 2.05, tb = W(u0, sd * (.5 - u0 * .2), jawU * .55 * k0 - .05), tt = W(u0 + .06, sd * (.46 - u0 * .2), jawU * .55 * k0 - .38); px.line(g, tb[0], tb[1], tt[0], tt[1], C.tooth, Math.max(1, Math.round(R0 * sc * .06)));
        const k1 = u0 / 1.85, lb = W(u0 - .1, sd * (.46 - u0 * .2), -.3 - jawL * .95 * k1), lt3 = W(u0 - .04, sd * (.42 - u0 * .2), -.3 - jawL * .95 * k1 + .3); px.line(g, lb[0], lb[1], lt3[0], lt3[1], C.tooth); } }
    const e = BST_ell(v, ox, oy, Wv(-.1, 0, .05), Wv(1.02, 0, 0), Wv(0, .8, 0), Wv(0, 0, .7)); BST_ball(g, e, T.base, BST_OL, false);
    const sn = [W(.2, -.62, .28), W(.2, .62, .28), W(1.6, .3, jawU * .45 + .05), W(2.15, 0, jawU * .55), W(1.6, -.3, jawU * .45 + .05)];
    poly(sn, T.base.base); px.poly(g, [W(.3, -.3, .5), W(.3, .3, .5), W(1.9, 0, jawU * .55 + .1)], T.base.lt);
    const ridge = [W(-.4, 0, .72), W(1.95, 0, jawU * .55 + .15)]; px.line(g, ridge[0][0], ridge[0][1], ridge[1][0], ridge[1][1], T.base.hi);
    for (const sd of [-1, 1]) { const ns = W(1.9, sd * .14, jawU * .5 + .12); px.dot(g, ns[0], ns[1], T.base.deep); }
    if (j > .25) for (const sd of [-1, 1]) { const fb = W(1.85, sd * .22, jawU * .5), ft = W(1.9, sd * .2, jawU * .5 - .55); px.line(g, fb[0], fb[1], ft[0], ft[1], C.tooth, Math.max(1, Math.round(R0 * sc * .1))); px.dot(g, ft[0], ft[1], '#ffffff'); }
    const eyes = this.eyes = [];
    for (const sd of [-1, 1]) {
      const ep = W(.62, sd * .52, .38), side = v.dx * Rt[0] * sd + v.dy * Rt[1] * sd; if (side < -.3 && v.pitchDeg < 70) continue;
      const er = Math.max(.6, R0 * sc * .1); px.disc(g, ep[0], ep[1], er + 1, '#140a0a'); px.disc(g, ep[0], ep[1], er, C.eye); eyes.push([ep[0], ep[1], er]);
      const b0 = W(.95, sd * .32, .6), b1 = W(.35, sd * .64, .62); px.line(g, b0[0], b0[1] - 1, b1[0], b1[1] - 1, T.base.deep, Math.max(1, Math.round(R0 * sc * .12)));
    }
    horn(near);
    if (clip) g.restore();
  }
}
const BST_lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** a serpent body for an archetype. The monster's head height lives in m.hz (m.z stays 0, so the core never flies it);
 *  dead serpents rear up, thrash, crash down and crumble tail first */
function BST_serpentBody(opts) {
  return m => {
    const pal = m.pal || {}, rig = new BST_Serpent(Object.assign({}, opts, { size: (opts.size || 1) * Math.min(m.scale || 1, opts.maxScale || 9), colors: Object.assign({}, pal, pal.eyeGlow ? { eye: pal.eyeGlow } : {}) }));
    if (m.hz === undefined) m.hz = -rig.o.headR * rig.o.size * 2;
    rig.reset(m.x, m.y, m.hz, m.facing, 'column');
    const st = { x: m.x, y: m.y, z: m.hz, jaw: 0 };
    return { rig, noShadow: true, drawWith: (m2, r, a, tint) => rig.draw(r, m2, a, tint), kick(v) { rig.kick(v * .8); },
      update(dt, m2) {
        st.x = m2.x; st.y = m2.y; st.facing = m2.facing;
        if (m2.alive) { st.z = m2.hz; st.jaw = m2.bstJaw || 0; st.sway = m2.bstSway || null; st.writhe = m2.bstWrithe || 0; st.dead = false; st.crumble = 0; }
        else {   // the death: rise (or erupt) and thrash, crash along the ground, crumble from the tail
          const k = (m2.arch.corpseT || 2.4) / 5.5, t = m2.deadT / k, R0 = rig.o.headR * rig.o.size, H = R0 * (m2.boss ? 4.6 : 3.2);
          if (st.dz0 === undefined) { st.dz0 = m2.hz; st.dx0 = m2.x; st.dy0 = m2.y; }
          st.dead = true; st.jaw = 1; st.writhe = t < 2.1 ? Math.min(1, t * 2) : Math.max(0, 1 - (t - 2.1) * 2);
          st.z = t < .6 ? lerp(st.dz0, H, E.ease.outCubic(t / .6)) : t < 2.1 ? H + Math.sin(t * 7) * R0 * .4 : Math.max(R0 * .75, lerp(H, R0 * .75, E.ease.inQuad(clamp((t - 2.1) / .45, 0, 1))));
          st.x = m2.x + (t > 2.1 ? Math.cos(m2.facing) * R0 * 3 * clamp((t - 2.1) / .45, 0, 1) : Math.cos(t * 2.4) * R0 * .5); st.y = m2.y + (t > 2.1 ? Math.sin(m2.facing) * R0 * 3 * clamp((t - 2.1) / .45, 0, 1) : Math.sin(t * 2.4) * R0 * .5);
          if (t > 2.55 && !st.landed) { st.landed = true; shake(m2.boss ? 7 : 2); sfx('bst_burst', { vol: m2.boss ? .8 : .3 }); P.dust(st.x, st.y, 0, m2.boss ? 22 : 6, { speed: 60 * Math.sqrt(rig.o.size), size: 2 * rig.o.size }); }
          const cr = clamp((t - 2.8) / 2.2, 0, 1); if (cr > st.crumble) {   // segments break up into rubble, tail first
            for (let q = 0; q < rig.o.n; q++) { const was = st.crumble > 0 && q / rig.o.n > 1 - st.crumble, now = q / rig.o.n > 1 - cr; if (now && !was) { const sgm = rig.seg[q]; P.bits(sgm.x, sgm.y, Math.max(1, sgm.z), Math.round(3 + sgm.r), [rig.C.base, rig.T.base.sh, rig.C.dirt]); P.dust(sgm.x, sgm.y, Math.max(1, sgm.z), 2, { size: sgm.r * .4, color: '#6a5a4a' }); if (rig.o.magma) P.add({ kind: 'ember', x: sgm.x, y: sgm.y, z: sgm.z + 2, vz: 30, max: .8, color: rig.C.glow }); } }
            st.crumble = cr; }
        }
        rig.update(dt, st);
      } };
  };
}

/* ---- burrower: a small wyrm. Lurks half out of a hole; hunts underground (a travelling mound), marks a circle under
 *      the hero, bursts up through it, bites, sways a moment (the window to hit it), then dives again ---- */
function BST_burrowAI(m, dt) {
  const h = ED.hero, a = m.ai, R0 = m.body.rig.o.headR * m.body.rig.o.size, D = R0 * 1.8, Hup = R0 * 3.6;
  m.cool -= dt; a.t = (a.t || 0) - dt; m.bstSway = null; m.bstJaw = 0;
  if (!a.state) { a.state = 'lurk'; m.hz = Hup * .7; m.body.rig.reset(m.x, m.y, m.hz, m.facing, 'column'); }
  const dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1, toH = Math.atan2(dy, dx), T0 = game.time + m.ph;
  const fx = Math.cos(m.facing), fy = Math.sin(m.facing), sway = (k, c = 1) => [fx * R0 * 2.2 * c + Math.cos(T0 * 1.7) * R0 * .9 * k, fy * R0 * 2.2 * c + Math.sin(T0 * 1.3) * R0 * .9 * k, -R0 * .9 * c + Math.sin(T0 * 2.1) * R0 * .4 * k];   // the neck curls forward like a cobra's, and weaves
  m.untargetable = m.hz < -R0 * .5;
  switch (a.state) {
    case 'lurk': AI.move(m, [0, 0], dt); m.hz = approach(m.hz, Hup * .7, dt * 30); m.bstSway = sway(1); m.bstJaw = .15 + .15 * Math.sin(T0 * 3);
      AI.face(m, toH, dt, 1.5); if (AI.aware(m, 150)) { a.state = 'dive'; a.dir = toH + (Math.random() - .5); a.t = .7; sfx('bst_hiss', { vol: .4, pitch: .7 }); } break;
    case 'dive': {   // arc forward and down into the ground
      m.facing = E.approachAng(m.facing, a.dir, dt * 4); AI.move(m, [Math.cos(m.facing), Math.sin(m.facing)], dt, .9);
      m.hz = approach(m.hz, -D, dt * (30 + (Hup - m.hz) * 1.2)); if (m.hz <= -D + .1) { a.state = 'hunt'; }
      break; }
    case 'hunt': {   // underground: a mound runs at the hero
      m.hz = -D; const dir = AI.steer(m, h.x, h.y); AI.move(m, dir, dt, 1); AI.face(m, Math.atan2(dir[1], dir[0]), dt, 6);
      if (d < 30 && m.cool <= 0 && h.alive && AI.takeTurn(m)) { a.state = 'mark'; a.t = 1; m.tok = true; a.tel = FX.telegraph({ shape: 'circle', x: h.x, y: h.y, r: 14 * (m.scale || 1), dur: 1, owner: m, follow: h }); sfx('bst_rumble', { vol: .35, pitch: 1.6 }); }
      break; }
    case 'mark': {   // the circle follows the hero, then locks; the mound slides under it
      m.hz = -D; if (a.t < .45 && a.tel && a.tel.follow) a.tel.follow = null;
      const tx = a.tel ? a.tel.x : h.x, ty = a.tel ? a.tel.y : h.y, ddx = tx - m.x, ddy = ty - m.y, dd = Math.hypot(ddx, ddy);
      AI.move(m, dd > 2 ? [ddx / dd, ddy / dd] : [0, 0], dt, 1.5); if (Math.random() < dt * 20) P.dust(tx + (Math.random() - .5) * 20, ty + (Math.random() - .5) * 20, 0, 1, { speed: 15, color: '#8a7a64' });
      if (a.t <= 0) { a.state = 'burst'; a.u = 0; a.hit = false; m.vx = m.vy = 0; a.bx = tx; a.by = ty; sfx('bst_burst', { vol: .5 }); }
      break; }
    case 'burst': {   // straight up out of the ground, jaws wide: everything in the circle is bitten and thrown
      a.u = Math.min(1, a.u + dt / .3); m.hz = lerp(-D, Hup, E.ease.outCubic(a.u)); m.bstJaw = 1; m.bstSway = sway(0, a.u); AI.move(m, [0, 0], dt); AI.face(m, toH, dt, 6);
      if (!a.hit && m.hz > 0) { a.hit = true; shake(3); P.bits(m.x, m.y, 2, 14, ['#6a5a4a', '#8a7a64', '#4a3a2a']); P.dust(m.x, m.y, 0, 10, { speed: 60, color: '#8a7a64' });
        if (h.alive && Math.hypot(h.x - a.bx, h.y - a.by) < 14 * (m.scale || 1) + h.r) { if (dealDamage(h, { src: m, amount: m.dmg * 1.5, el: m.el, kb: 150, ang: toH })) { onFoeHit(m, h); P.impact(h.x, h.y, 14, 8, '#ffb08a'); sfx('bst_bite'); } } }
      if (a.u >= 1) { a.state = 'up'; a.t = 1.4 + Math.random() * .5; m.tok = false; m.cool = 1.8 + Math.random(); a.snap = 0; }
      break; }
    case 'up': {   // out of the ground: sways, hisses, snaps at a hero in reach (the moment to hit it)
      AI.move(m, [0, 0], dt); AI.face(m, toH, dt, 4); m.hz = approach(m.hz, Hup, dt * 40); m.bstSway = sway(.7); m.bstJaw = .3 + .2 * Math.sin(T0 * 4);
      if (a.snap > 0) { a.snap -= dt; const u = 1 - a.snap / .45; m.bstJaw = u < .6 ? 1 : .2; const lg = Math.sin(Math.min(1, u) * Math.PI) * (u < .35 ? -.5 : 1), c0 = sway(0); m.bstSway = [c0[0] + Math.cos(toH) * R0 * 2.8 * lg, c0[1] + Math.sin(toH) * R0 * 2.8 * lg, c0[2] - R0 * 1.4 * Math.max(0, lg)];
        if (u > .55 && !a.snapped) { a.snapped = true; sfx('bst_bite', { vol: .5 }); if (d < 26 && dealDamage(h, { src: m, amount: m.dmg, el: m.el, kb: 90, ang: toH })) onFoeHit(m, h); } }
      else if (d < 24 && m.cool < 1 && Math.random() < dt * 3) { a.snap = .45; a.snapped = false; FX.telegraph({ shape: 'arc', x: m.x, y: m.y, r: 26, ang: toH, half: .5, dur: .25, owner: m }); }
      if (a.t <= 0 && !(a.snap > 0)) { a.state = 'dive'; a.dir = toH + (Math.random() < .5 ? 1 : -1) * (1 + Math.random()); sfx('bst_hiss', { vol: .3, pitch: .8 }); }
      break; }
  }
}
def('archetypes', 'burrower', { name: 'Burrower', tags: ['beast', 'burrower', 'melee'], themes: ['cavern', 'mine', 'ruins', 'frost', 'fungal', 'abyss'], minDepth: 5, weight: 6,
  hp: 26, dmg: 9, speed: 52, r: 4.5, xp: 12, head: 16, mass: 1.2, el: 'phys', corpseT: 2.4, stagger: true,
  body: BST_serpentBody({ n: 10, gap: 3, headR: 4.1, bodyR: 3.3, tailR: 1.1, fins: 3, horns: false }),
  palettes: [{ base: '#a8844e', belly: '#f0d8a0', spine: '#f4e4bc', fin: '#c85a3a', eye: '#ffd040', dirt: '#5a4a3a' }, { base: '#56688a', belly: '#c8d0d8', spine: '#e0e8f0', fin: '#3ab8b0', eye: '#8affe0', dirt: '#4a4448' },
    { base: '#b05c6c', belly: '#f0c0b0', spine: '#f8e4d4', fin: '#e8904a', eye: '#fff07a', dirt: '#5a4a3a' }], elKeys: ['fin', 'eye'],
  ai: BST_burrowAI, draw: (m, r, a) => BST_drawBeast(m, r, a), onDie(m) { BST_ichor(m, '#c8a060', 8); m.untargetable = false; } });

/* =============================================================================
 * WATCHER: a floating eye. A fleshy orb; an eye opening that turns to the hero (sclera, a ringed iris, a slit pupil
 * that narrows when it charges), lids that blink, veins, and tendrils (verlet strands) trailing from the back.
 *   rig.update(dt, { x, y, z, look: [x, y, z], charge 0..1, dead, vx, vy })   rig.draw(g, ox, oy, view)   rig.drawGlow(g, r)
 * ============================================================================= */
class BST_Eye {
  constructor(o = {}) {
    this.o = Object.assign({ size: 1, R: 6, n: 5, seg: 2.5 }, o);
    const C = this.C = Object.assign({ flesh: '#8a4a6a', iris: '#ffb03a', sclera: '#f0e2d4', vein: '#c84a5a', pupil: '#1a0a10', tendril: '#6a3a5a' }, o.colors || {});
    this.T = {}; for (const k of ['flesh', 'iris', 'sclera', 'tendril']) this.T[k] = E.tones(C[k]);
    this.look = [1, 0, -.2]; this.open = 1; this.blink = 2 + Math.random() * 3; this.charge = 0; this.t = Math.random() * 9; this.x = 0; this.y = 0; this.z = 0; this.tend = null; this.sq = 0; this.sqV = 0;
  }
  kick(v) { this.sqV += v * .5; }
  update(dt, s) {
    const o = this.o, S = o.size, R = o.R * S; this.t += dt; this.dead = !!s.dead; this.charge = approach(this.charge, s.charge || 0, dt * 4);
    this.x = s.x; this.y = s.y; this.z = s.z;
    this.sqV += (-200 * this.sq - 10 * this.sqV) * dt; this.sq = clamp(this.sq + this.sqV * dt, -.3, .3);
    // the look turns smoothly toward its target; it blinks now and then (never while charging)
    if (s.look && !this.dead) { const dx = s.look[0] - s.x, dy = s.look[1] - s.y, dz = s.look[2] - s.z, l = Math.hypot(dx, dy, dz) || 1, k = Math.min(1, dt * 7); this.look = BST_norm([lerp(this.look[0], dx / l, k), lerp(this.look[1], dy / l, k), lerp(this.look[2], dz / l, k)]); }
    if (this.dead) this.look = BST_norm([this.look[0], this.look[1], approach(this.look[2], -.8, dt * 2)]);
    this.blink -= dt; if (this.blink < -.16) this.blink = 1.5 + Math.random() * 3.5;
    const bl = this.blink < 0 && this.charge < .2 ? Math.sin(-this.blink / .16 * Math.PI) : 0;
    this.open = this.dead ? approach(this.open, .12, dt * 2) : clamp(1 - bl - this.charge * .38, .02, 1);
    // tendrils: strands anchored round the back of the orb, trailing, floating, slowly waving
    const L0 = BST_norm([-this.look[0], -this.look[1], 0]), sd = [-L0[1], L0[0], 0];
    const anchor = i => { const a = (i / (o.n - 1) - .5) * 2.4; return [s.x + (L0[0] * .7 + sd[0] * Math.sin(a) * .55) * R, s.y + (L0[1] * .7 + sd[1] * Math.sin(a) * .55) * R, s.z - R * .25 + Math.cos(a * 1.3) * R * .3 - R * .15]; };
    if (!this.tend) { this.tend = []; for (let i = 0; i < o.n; i++) { const a = anchor(i), ch = []; for (let j = 0; j < 6; j++) ch.push({ x: a[0] + L0[0] * j * o.seg * S, y: a[1] + L0[1] * j * o.seg * S, z: a[2] - j * S, px: a[0] + L0[0] * j * o.seg * S, py: a[1] + L0[1] * j * o.seg * S, pz: a[2] - j * S }); this.tend.push(ch); } }
    const grav = this.dead ? 260 : 10, damp = Math.pow(.93, dt * 60), dt2 = dt * dt, sg = o.seg * S;
    this.tend.forEach((ch, i) => {
      const a = anchor(i); Object.assign(ch[0], { x: a[0], y: a[1], z: a[2], px: a[0], py: a[1], pz: a[2] });
      for (let j = 1; j < ch.length; j++) { const n = ch[j], vx = (n.x - n.px) * damp, vy = (n.y - n.py) * damp, vz = (n.z - n.pz) * damp, w = Math.sin(this.t * 3.2 + i * 1.7 + j * .9) * 90 * (this.dead ? 0 : 1); n.px = n.x; n.py = n.y; n.pz = n.z; n.x += vx + (L0[0] * 75 + sd[0] * w) * dt2; n.y += vy + (L0[1] * 75 + sd[1] * w) * dt2; n.z += vz - grav * dt2; if (n.z < 0) n.z = 0; }
      for (let it = 0; it < 3; it++) for (let j = 1; j < ch.length; j++) { const A0 = ch[j - 1], B = ch[j], dx = B.x - A0.x, dy = B.y - A0.y, dz = B.z - A0.z, d = Math.hypot(dx, dy, dz) || 1e-6, k = (d - sg * (1 - j * .06)) / d; if (j === 1) { B.x -= dx * k; B.y -= dy * k; B.z -= dz * k; } else { A0.x += dx * k * .5; A0.y += dy * k * .5; A0.z += dz * k * .5; B.x -= dx * k * .5; B.y -= dy * k * .5; B.z -= dz * k * .5; } }
    });
  }
  /** the eye opening's frame on the orb: centre (relative), its two axes and whether it faces the camera */
  _eye(view) {   // the opening turns partly toward the camera (a sprite cheat, so it reads in every view); the iris slides toward the real target
    const R = this.o.R * this.o.size * (1 + this.sq * .3), lt = this.look, cm = BST_norm([view.dx, view.dy, view.dz]), lk = BST_norm([lt[0] + cm[0] * 1.15, lt[1] + cm[1] * 1.15, lt[2] + cm[2] * 1.15]);
    let e1 = [lk[1], -lk[0], 0]; const l1 = Math.hypot(e1[0], e1[1]); e1 = l1 > .05 ? [e1[0] / l1, e1[1] / l1, 0] : [1, 0, 0];
    const e2 = [e1[1] * lk[2] - e1[2] * lk[1], e1[2] * lk[0] - e1[0] * lk[2], e1[0] * lk[1] - e1[1] * lk[0]];
    const rho = R * .74, c = lk.map(v => v * R * .62), gx = lt[0] * e1[0] + lt[1] * e1[1] + lt[2] * e1[2], gy = lt[0] * e2[0] + lt[1] * e2[1] + lt[2] * e2[2];
    const ic = c.map((v, i) => v + (e1[i] * gx + e2[i] * gy) * rho * .4);
    return { R, rho, c, e1, e2, lk, ic, face: lk[0] * view.dx + lk[1] * view.dy + lk[2] * view.dz };
  }
  draw(g, ox, oy, view) {
    const T = this.T, C = this.C, S = this.o.size, sc = view.scale, ops = [], rx = this.x, ry = this.y, rz = this.z, ev = this._eye(view), R = ev.R;
    // tendrils: tapered strands, the far ones darker
    const cD = 0;
    for (const ch of this.tend || []) for (let j = 0; j < ch.length - 1; j++) {
      const A0 = ch[j], B = ch[j + 1], a = BST_p(view, ox, oy, A0.x - rx, A0.y - ry, A0.z - rz), b = BST_p(view, ox, oy, B.x - rx, B.y - ry, B.z - rz), d = (a[2] + b[2]) / 2, far = d < cD;
      const ra = Math.max(.5, (1.05 - j * .15) * S * sc * .75), rb = Math.max(.45, (1.05 - (j + 1) * .15) * S * sc * .75);
      ops.push({ d, f: () => BST_limb(g, a, b, ra, rb, T.tendril, far, null) });
    }
    ops.push({ d: 0, f: () => {
      const e = BST_ell(view, ox, oy, [0, 0, 0], [R * (1 - this.sq * .2), 0, 0], [0, R * (1 - this.sq * .2), 0], [0, 0, R * (1 + this.sq * .3)]);
      BST_ball(g, e, T.flesh, null, false);
      // veins crawling toward the eye (they pulse red while it charges)
      const vc = this.charge > .3 && Math.sin(this.t * 30) > 0 ? '#ff5a4a' : C.vein;
      for (let k = 0; k < 5; k++) { const a0 = k * 1.26 + .4, p0 = ev.c.map((v, i) => v + ev.e1[i] * Math.cos(a0) * ev.rho * 1.05 + ev.e2[i] * Math.sin(a0) * ev.rho * 1.05), p1 = [p0[0] * 1.02 - ev.lk[0] * R * .35 + ev.e1[0] * Math.cos(a0) * R * .3, p0[1] * 1.02 - ev.lk[1] * R * .35 + ev.e1[1] * Math.cos(a0) * R * .3, p0[2] - ev.lk[2] * R * .35 + Math.sin(a0) * R * .3]; const n0 = BST_norm(p1); if (n0[0] * view.dx + n0[1] * view.dy + n0[2] * view.dz < .1) continue; const A0 = BST_p(view, ox, oy, ...p0), B0 = BST_p(view, ox, oy, ...p1); px.line(g, A0[0], A0[1], B0[0], B0[1], vc); }
      if (ev.face > -.2) this._drawEye(g, ox, oy, view, ev, false);
    } });
    ops.sort((a, b) => a.d - b.d); for (const op of ops) op.f();
  }
  _drawEye(g, ox, oy, view, ev, glowOnly) {
    const T = this.T, C = this.C, op = this.open, ch = this.charge;
    const sub = (k, o2) => BST_ell(view, ox, oy, ev.c.map((v, i) => v + ev.lk[i] * (o2 || 0)), ev.e1.map(v => v * ev.rho * k), ev.e2.map(v => v * ev.rho * k * op), ev.lk.map(v => v * .01));
    if (!glowOnly) {
      const rim = BST_ell(view, ox, oy, ev.c, ev.e1.map(v => v * ev.rho * 1.14), ev.e2.map(v => v * ev.rho * 1.14 * Math.max(.3, op)), ev.lk.map(v => v * .01));
      px.poly(g, BST_ellPts(rim, 1), T.flesh.deep);
      if (op < .12) { const a = BST_p(view, ox, oy, ...ev.c.map((v, i) => v - ev.e1[i] * ev.rho)), b = BST_p(view, ox, oy, ...ev.c.map((v, i) => v + ev.e1[i] * ev.rho)); px.line(g, a[0], a[1], b[0], b[1], T.flesh.lt); return; }
      const sc0 = sub(1); px.poly(g, BST_ellPts(sc0, 1), T.sclera.sh); px.poly(g, BST_ellPts(sc0, .82, -.4, -.5), T.sclera.base);
    } else if (op < .12) return;
    const ir = BST_ell(view, ox, oy, ev.ic.map((v, i) => v + ev.lk[i] * .3), ev.e1.map(v => v * ev.rho * .56), ev.e2.map(v => v * ev.rho * .56 * Math.min(1, op * 1.25)), ev.lk.map(v => v * .01));
    const it = this.dead ? E.tones('#6a6060') : ch > .2 ? E.tones(E.mix(C.iris, '#ffffff', ch * .22)) : T.iris;
    if (glowOnly) px.glow(g, 1);
    px.poly(g, BST_ellPts(ir, 1), it.deep); px.poly(g, BST_ellPts(ir, .78), it.base); px.poly(g, BST_ellPts(ir, .42, -ir.rmax * .15, -ir.rmin * .2), it.lt);
    const pw = Math.max(.35, (1 - ch * .75) * .26), pu = BST_ell(view, ox, oy, ev.ic.map((v, i) => v + ev.lk[i] * .4), ev.e1.map(v => v * ev.rho * .56 * pw), ev.e2.map(v => v * ev.rho * .5 * Math.min(1, op * 1.25)), ev.lk.map(v => v * .01));
    px.poly(g, BST_ellPts(pu, 1), C.pupil);
    if (ir.rmin > 1.4) px.dot(g, ir.x - ir.rmax * .4, ir.y - ir.rmin * .45, '#ffffff');
  }
  /** after the lighting pass: the iris burns in the dark (and blazes while charging) */
  drawGlow(g, r) {
    const ev = this._eye(r.view); if (ev.face <= -.2 || this.dead) return;
    const [ox, oy] = r.w(this.x, this.y, this.z), cx = BST_p(r.view, ox, oy, ...ev.ic);
    if (this.charge > .1) r.glowDisc(g, cx[0], cx[1], ev.rho * r.view.scale * (.7 + this.charge * .8), this.C.iris, .12 + this.charge * .2);
    this._drawEye(g, Math.round(ox), Math.round(oy), r.view, ev, true);
  }
}
const BST_norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
function BST_eyeBody(opts) {
  return m => {
    const pal = m.pal || {}, rig = new BST_Eye(Object.assign({}, opts, { size: (opts.size || 1) * (m.scale || 1), colors: Object.assign({}, pal, pal.eyeGlow ? { iris: pal.eyeGlow } : {}) }));
    const st = { x: m.x, y: m.y, z: m.z };
    return { rig, kick(v) { rig.kick(v); }, shadow: 5.5,
      update(dt, m2) { st.x = m2.x; st.y = m2.y; st.z = m2.z; st.look = m2.bstLook; st.charge = m2.bstCharge || 0; st.dead = !m2.alive; rig.update(dt, st);
        if (!m2.alive && m2.z <= .5 && !m2.bstSplat) { m2.bstSplat = true; BST_ichor(m2, '#c84a6a', 12); P.ring(m2.x, m2.y, 2, 16, '#c84a6a', .3); } },
      draw(g, ox, oy, view) { rig.draw(g, ox, oy, view); } };
  };
}
/* ---- watcher AI: hovers at a distance and circles; takes a turn to charge (the pupil narrows, light gathers), then
 *      a searing beam sweeps across the hero (a warm red line shows where it will pass first) ---- */
function BST_eyeAI(m, dt) {
  const h = ED.hero, a = m.ai; a.t = (a.t === undefined ? Math.random() * 9 : a.t) + dt;
  if (a.orbit === undefined) { a.orbit = Math.random() < .5 ? 1 : -1; a.fire = 1.2 + Math.random() * 1.5; }
  const hov = (m.arch.hover || 22) + Math.sin(a.t * 1.7) * 2.5; m.z = approach(m.z || 0, hov, dt * 30);
  const dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1, toH = Math.atan2(dy, dx), k = statusSpeed(m) * m.speed / 30;
  m.bstCharge = 0;
  if (!AI.aware(m, 180)) { const w = a.t * .6 + m.ph; m.bstLook = [m.x + Math.cos(w) * 40, m.y + Math.sin(w) * 40, m.z - 10]; m.vx += (Math.cos(w * .7) * 8 - m.vx * 1.5) * dt; m.vy += (Math.sin(w * .7) * 8 - m.vy * 1.5) * dt; return; }
  m.bstLook = [h.x, h.y, (h.z || 0) + 14];
  if (a.beam) {   // firing: hold, and stare down the beam as it sweeps
    const f = a.beam; m.vx *= Math.exp(-6 * dt); m.vy *= Math.exp(-6 * dt);
    if (!ED.fx.includes(f)) { a.beam = null; m.tok = false; a.fire = 2.8 + Math.random() * 2; return; }
    const reach = f.reach || 100; m.bstLook = [m.x + Math.cos(f.ang) * reach, m.y + Math.sin(f.ang) * reach, 2]; m.bstCharge = f.t < f.warm ? .6 + .4 * f.t / f.warm : 1; m.facing = f.ang;
    if (f.t > f.warm && Math.random() < dt * 20) P.add({ kind: 'spark', x: m.x + Math.cos(f.ang) * 5, y: m.y + Math.sin(f.ang) * 5, z: m.z, vx: Math.cos(f.ang + (Math.random() - .5)) * 80, vy: Math.sin(f.ang + (Math.random() - .5)) * 80, vz: 20, g: 200, drag: 3, max: .2, color: EL(m.el).color, hot: '#ffffff' });
    return;
  }
  if (a.charge > 0) {   // light gathers into the eye
    a.charge += dt; m.bstCharge = Math.min(1, a.charge / .6); m.vx *= Math.exp(-5 * dt); m.vy *= Math.exp(-5 * dt);
    if (Math.random() < dt * 40) { const an = Math.random() * TAU, rr = 14 + Math.random() * 10; P.add({ kind: 'ember', x: m.x + Math.cos(an) * rr, y: m.y + Math.sin(an) * rr, z: m.z + (Math.random() - .5) * 14, vx: -Math.cos(an) * rr * 3, vy: -Math.sin(an) * rr * 3, vz: 0, drag: 1, max: .3, color: EL(m.el).light }); }
    if (a.charge >= .6 || m.stunT > 0) {
      a.charge = 0; if (m.stunT > 0) { m.tok = false; a.fire = 1.5; return; }
      const dir = Math.random() < .5 ? 1 : -1, sweep = 1.25;
      a.beam = FX.beam({ team: 'foe', src: m, from: m, x: m.x, y: m.y, z: Math.max(8, m.z - 3), ang: toH - dir * sweep * .42, turn: dir * sweep / 1.5, len: 175, w: 5, dur: 1.9, warm: .55, tick: .12, el: m.el === 'phys' ? 'fire' : m.el, hit: { amount: m.dmg * .42, kb: 25 } });
      sfx('laser', { vol: .5, pitch: .6 }); if (m.body) m.body.kick(-3);
    }
    return;
  }
  // keep the range, circle, bob
  const want = d > 125 ? 1 : d < 78 ? -1 : 0, see = AI.clear(m, h.x, h.y); let ax = dx / d * want * 55 - dy / d * a.orbit * 30, ay = dy / d * want * 55 + dx / d * a.orbit * 30;
  if (!see && ED.L.flow) { const s = ED.L.flow.dir(m.x, m.y, h.x, h.y); ax = s[0] * 55; ay = s[1] * 55; }   // a wall between: drift round it
  else if (ED.L.map.solidAt(m.x + ax * .4, m.y + ay * .4)) a.orbit *= -1;   // circling into a wall: circle the other way
  if (!(m.stunT > 0)) { m.vx += (ax * k - m.vx * 1.6) * dt; m.vy += (ay * k - m.vy * 1.6) * dt; }
  if (Math.random() < dt * .3) a.orbit *= -1;
  if ((a.fire -= dt) <= 0 && d < 165 && !(m.stunT > 0) && ED.L.map.los(m.x, m.y, h.x, h.y) && AI.takeTurn(m)) { a.charge = .001; m.tok = true; sfx('bst_charge', { vol: .5 }); }
}
def('archetypes', 'eye', { name: 'Watcher', tags: ['aberration', 'ranged', 'flying'], themes: ['abyss', 'cavern', 'clockwork', 'crypt', 'ossuary', 'fungal'], minDepth: 8, weight: 6,
  hp: 24, dmg: 11, speed: 30, r: 5.5, xp: 14, head: 12, mass: .9, el: 'fire', flies: true, hover: 22, corpseT: 2, stagger: true,   // head: the orb's top above its hover height (bars, numbers and auras sit on it)
  body: BST_eyeBody({}), elKeys: ['iris'],
  palettes: [{ flesh: '#8a4a6a', iris: '#ffb03a', sclera: '#f0e2d4', vein: '#c84a5a', pupil: '#1a0a10', tendril: '#6a3a5a' }, { flesh: '#4a5a80', iris: '#ff6a4a', sclera: '#e8ecf0', vein: '#8a5ac8', pupil: '#0a0a1a', tendril: '#3a4a6a' },
    { flesh: '#7a6446', iris: '#ffe05a', sclera: '#f4ecd8', vein: '#b84a3a', pupil: '#1a1008', tendril: '#5a4a32' }],
  ai: BST_eyeAI, onDie(m) { sfx('bst_squelch', { vol: .5, pitch: .9 }); P.glints(m.x, m.y, m.z, 6, '#ffb03a'); },
  draw(m, r, a) {
    BST_drawBeast(m, r, a);
    const f = m.alive && m.ai.beam; if (f && f.t < f.warm) {   // while the beam warms up, a red lane on the floor shows where it will sweep first
      const u = f.t / f.warm, ln = f.reach || f.len, ca = Math.cos(f.ang), sa = Math.sin(f.ang);
      r.decal(() => { const g = r.tgt, pts = [[0, -3], [ln, -3], [ln, 3], [0, 3]].map(([a0, b0]) => r.w(f.x + ca * a0 - sa * b0, f.y + sa * a0 + ca * b0, 0)); px.polyDither(g, pts, '#ff4a3a', .25 + .45 * u, r.ix, r.iy); const [x0, y0] = r.w(f.x, f.y, 0), [x1, y1] = r.w(f.x + ca * ln, f.y + sa * ln, 0); px.line(g, x0, y0, x1, y1, '#ff8a6a'); }, { emissive: .4 + .4 * u });
    }
  } });

/* =============================================================================
 * BOSS HELPERS: falling rocks, walkable points, ray lengths, the wyrm's coils as hitboxes, the bosses' songs
 * ============================================================================= */
/** a falling rock (FX.meteor, element phys) drawn as a tumbling boulder; o: { team, src, x, y, r, delay, amount, stun, then } */
function BST_rock(o) {
  const f = Object.assign({ team: 'foe', r: 15, delay: 1, size: .9 }, o), seed = Math.random() * 9;
  const mt = FX.meteor({ team: f.team, src: f.src || null, x: f.x, y: f.y, r: f.r, delay: f.delay, el: 'phys', size: f.size, hit: { amount: f.amount || 10, kb: 140, stun: f.stun },
    then(ff) { P.bits(f.x, f.y, 3, 10, ['#6a5a4a', '#8a7a64', '#4a3a2a', '#a89a80']); P.dust(f.x, f.y, 0, 8, { speed: 50, color: '#8a7a64', size: 2 }); FX.scorch(f.x, f.y, f.r * .7, '#2a2220', 5); sfx('thud', { vol: .6 }); if (f.then) f.then(ff); } });
  mt.draw = r => {   // a boulder tumbling down out of the dark, trailing grit
    const u = mt.t / f.delay, z = 240 * (1 - u) * (1 - u) + 2, x = f.x - 30 * (1 - u), y = f.y - 15 * (1 - u), spin = mt.t * 9 + seed;
    r.queue(x, y, z, g => { const [sx, sy] = r.w(x, y, z), R = 4.2 * f.size * r.view.scale, t = E.tones('#7a6a5a'), pts = [];
      for (let k = 0; k < 7; k++) { const a = spin + k / 7 * TAU, rr = R * (.8 + .25 * Math.sin(k * 2.7 + seed)); pts.push([sx + Math.cos(a) * rr, sy + Math.sin(a) * rr * .9]); }
      px.poly(g, pts.map(p => [p[0] + (p[0] > sx ? 1 : -1), p[1] + (p[1] > sy ? 1 : -1)]), BST_OL); px.poly(g, pts, t.sh); px.disc(g, sx - R * .25, sy - R * .3, R * .55, t.base); px.dot(g, sx - R * .4, sy - R * .5, t.hi); });
    if (Math.random() < .4) P.add({ kind: 'dust', x, y, z: z + 4, vz: 10, max: .4, size: 1.2, color: '#8a7a64' });
  };
  return mt;
}
/** a walkable point near (x, y), else (fx, fy) */
function BST_walkPt(x, y, fx, fy) { const m = ED.L && ED.L.map; if (!m) return [x, y]; for (let k = 0; k < 12; k++) { const a = k * 2.4, d = k * 5, px2 = x + Math.cos(a) * d, py2 = y + Math.sin(a) * d; if (m.walkable(Math.floor(px2 / BST_T), Math.floor(py2 / BST_T))) return [px2, py2]; } return [fx, fy]; }
/** how far a straight line runs from (x, y) along ang before a wall (up to max) */
function BST_ray(x, y, ang, max) { const m = ED.L && ED.L.map; if (!m) return max; for (let s = 6; s < max; s += 4) if (!m.walkable(Math.floor((x + Math.cos(ang) * s) / BST_T), Math.floor((y + Math.sin(ang) * s) / BST_T))) return Math.max(10, s - 8); return max; }
const BST_R0 = b => b.body && b.body.rig && b.body.rig.o.headR ? b.body.rig.o.headR * b.body.rig.o.size : 8;
const BST_isWorm = b => !!(b.body && b.body.rig && b.body.rig.seg);
/** the wyrm's surfaced coils are hitboxes (level things): the hero can cut at any part of it that is out of the ground */
function BST_coils(m) {
  const rig = m.body && m.body.rig, L0 = ED.L; if (!rig || !rig.seg || !L0 || !L0.things) return;
  if (!m.bstBoxes || m.bstBoxes.L !== L0) { m.bstBoxes = []; m.bstBoxes.L = L0; for (let k = 3; k < rig.o.n; k += 3) m.bstBoxes.push(addThing(L0, { kind: 'bst_coil', x: m.x, y: m.y, r: 6, k, hittable: false, keep: true, hidden: true, owner: m, onHit: BST_coilHit })); }
  for (const t of m.bstBoxes) { const q = rig.seg[t.k]; t.x = q.x; t.y = q.y; t.r = q.r * .9; t.hittable = m.alive && !m.dormant && !q.gone && q.z > -q.r * .35 && q.z < 36; if (!m.alive) { t.dead = true; t.keep = false; } }
}
function BST_coilHit(hit) {
  const m = this.owner; if (!m || !m.alive) return;
  if (game.time - (m.lastHit || -9) < .09) return;   // one swing, one wound, however many coils it crosses
  const a = dealDamage(m, Object.assign({}, hit, { noNumber: true, kb: 0 }));
  if (a) { if (OPT.numbers) P.text(this.x, this.y, this.r + 10, (hit.crit ? fmt(a) + '!' : fmt(a)), hit.crit ? '#ffd23a' : '#fff2c4', { scale: hit.crit ? 2 : 1, bounce: !!hit.crit }); P.sparks(this.x, this.y, this.r, 6, null, { color: '#ffb080' }); P.impact(this.x, this.y, this.r * .8, 6); }
}
/* the bosses' songs: a skittering chromatic pulse for the Brood Mother, a slow heavy grind for the Wyrm */
const BST_SONG_BROOD = { bpm: 140, steps: 4, tracks: [
  { wave: 'pulse12', vol: .08, notes: 'E5 . F5 . E5 . D#5 . E5 . . . B4 . C5 . | E5 . F5 . G5 . F5 . E5 . D#5 . E5 - - - | A5 . G#5 . A5 . B5 . C6 . B5 . A5 . G#5 . | A5 . E5 . F5 . D#5 . E5 - - - . . . .' },
  { wave: 'triangle', vol: .3, notes: 'E2 E2 . E2 F2 . E2 . E2 E2 . E2 A#1 . B1 . | E2 E2 . E2 F2 . E2 . G2 . F2 . E2 . D#2 .' },
  { wave: 'square', vol: .03, notes: 'B3 E4 B3 F4 B3 E4 B3 D#4 | C4 E4 C4 F4 C4 E4 B3 D#4' },
  { wave: 'drums', vol: .1, notes: 'k . h h s . h . k k h . s . h h | k . h h s . h k k . h . s s t t' }] };
const BST_SONG_WYRM = { bpm: 92, steps: 4, tracks: [
  { wave: 'saw', vol: .05, notes: 'E3 - - - G3 - - - A#3 - - - A3 - G3 - | E3 - - - G3 - - - B3 - A#3 - A3 - G3 - | C4 - - - B3 - - - A#3 - - - A3 - G3 - | E3 - - - - - - - D#3 - - - E3 - - -' },
  { wave: 'triangle', vol: .34, notes: 'E1 - - - . . E1 . G1 - - - F#1 - . . | E1 - - - . . E1 . A#1 - - - A1 - G1 -' },
  { wave: 'pulse', vol: .05, notes: 'E4 . . . . . . . . . . . . . . . | G4 . . . . . . . F#4 . . . . . . .' },
  { wave: 'drums', vol: .13, notes: 'k . . k s . . . k . k . s . t t | k . . k s . . k k . k . s c t t' }] };

/* =============================================================================
 * THE BROOD MOTHER (depth 10): a giant crawler with a bulging egg sac. She waits high in the dark on a thread; woken,
 * she drops into the arena, rears and screeches. Patterns: leap slam, web spray, scuttling charge, then eggs that
 * hatch broodlings and venom pools. Pose requests from any pattern (the Humanoid's words) map onto her body.
 * ============================================================================= */
function BST_broodTick(m, dt) {
  const b = m.bst || (m.bst = { t: 0, intro: -1, rage: 0 }), p = m.bp || (m.bp = {}); b.t += dt;
  let lift = Math.max(0, m.z); m.z = 0;
  const rs = m.rigState || {};   // what the pattern asks of a Humanoid, spoken to a spider
  p.crouch = rs.pose === 'crouch' ? 1 : 0; p.rear = rs.pose === 'cast' || rs.pose === 'cheer' ? 1 : 0; p.fang = rs.expr === 'angry' || rs.expr === 'shout' ? .6 : 0; p.lunge = 0;
  if (rs.attack) { const A0 = rs.attack; p.fang = A0.phase === 'wind' ? 1 : .3; p.lunge = A0.phase === 'active' ? 1 : 0; p.rear = A0.phase === 'wind' ? .5 : 0; }
  if (rs.bst) Object.assign(p, rs.bst);
  if (!m.boss) { m.bstLift = lift; return; }
  if (m.dormant) { lift = 95; m.vx = m.vy = 0; m.untargetable = true; b.intro = -1; if (Math.random() < dt * 2) P.add({ kind: 'dust', x: m.x + (Math.random() - .5) * 30, y: m.y + (Math.random() - .5) * 30, z: 90, vz: -30, g: 30, max: 2, size: 1, color: '#9a9088' }); }
  else if (m.introT > 0 && !b.introDone) {   // the drop: a shaking thread, a plunge, a landing that throws the hero back, a screech
    if (b.intro < 0) { b.intro = 0; sfx('bst_hiss', { vol: .7, pitch: .5 }); }
    b.intro += dt; const t = b.intro; m.untargetable = t < 1; m.vx = m.vy = 0; p.rear = 0; p.fang = 0;
    if (t < .45) { lift = 95 + Math.sin(t * 40) * 2; if (Math.random() < dt * 30) P.add({ kind: 'dust', x: m.x + (Math.random() - .5) * 40, y: m.y + (Math.random() - .5) * 40, z: 110, vz: -40, g: 60, max: 1.6, size: 1.2, color: '#9a9088' }); }
    else if (t < 1) { const u = (t - .45) / .55; lift = 95 * (1 - u * u); }
    else { lift = 0; if (!b.landed) { b.landed = true; shake(8); game.freeze(.06); sfx('boom'); P.dust(m.x, m.y, 0, 26, { speed: 90, size: 2.4 }); P.ring(m.x, m.y, 8, 70, '#f0eef8', .5); FX.scorch(m.x, m.y, 30);
        FX.nova({ team: 'foe', src: m, x: m.x, y: m.y, r0: 10, r1: 60, dur: .3, el: 'phys', color: '#f0eef8', hit: { amount: m.dmg * .4, kb: 260 } }); BST_webPatch(m.x, m.y, 40); game.after(.15, () => sfx('bst_screech', { vol: .9 })); }
      p.rear = 1; p.fang = 1; if (Math.random() < dt * 20 && m.body) m.body.kick((Math.random() - .5) * 2); }
  } else if (b.rage > 0) { b.rage -= dt; b.introDone = true; p.rear = 1; p.fang = 1; m.vx = m.vy = 0; if (Math.random() < dt * 20 && m.body) m.body.kick((Math.random() - .5) * 2); }
  else b.introDone = b.introDone || m.introT <= 0;
  if (!m.dormant && !(m.introT > 0 && !b.introDone && b.intro < 1)) m.untargetable = false;
  m.bstLift = lift;
}
/** her silk thread: while she hangs (or drops) a strand runs up into the darkness */
function BST_drawThread(m, r) {
  const lift = m.bstLift || 0; if (lift < 3 || !m.alive) return;
  r.queue(m.x, m.y, lift, g => { const [x0, y0] = r.w(m.x, m.y, lift + 10 * (m.scale || 1)), [x1, y1] = r.w(m.x, m.y, lift + 420); px.blend(g, .8, 'normal', () => { px.line(g, x0, y0, x1, y1, '#e8e4f0'); px.line(g, x0 + 1, y0, x1 + 1, y1, '#8a86a0'); }); }, { bias: -.1 });
}
def('archetypes', 'broodmother', { name: 'Brood Mother', tags: ['beast', 'spider', 'boss'], bossBody: true, noPack: true, minDepth: 999, weight: 0, ownEntrance: true,   // her drop is her waking (the arena adds only the name card)
  hp: 42, dmg: 12, speed: 38, r: 7, xp: 40, head: 17, mass: 99, el: 'venom', corpseT: 5, stagger: false,
  body: BST_crawlerBody({ pattern: 'hourglass', egg: 1, big: true, flip: false, abd: 1.1, ceph: 1.1, thick: 1.1 }),
  palettes: [{ base: '#3e2c42', leg: '#322636', belly: '#1e1822', mark: '#e0405a', eye: '#ff3a3a', fang: '#ecdcc4', joint: '#7a5a7e', sac: '#b8a07e', vein: '#9a3a4a' }], elKeys: ['mark', 'eye'],
  ai: BST_crawlerAI, update: BST_broodTick,
  draw(m, r, a) { BST_drawBeast(m, r, a); BST_drawThread(m, r); },
  onDie(m) { BST_ichor(m, '#9ad84a', 30); P.bits(m.x, m.y, 12, 26, ['#f0e8c8', '#dccca4', '#9ad84a']); sfx('bst_screech', { vol: .9, pitch: .6 }); P.ring(m.x, m.y, 6, 60, '#9ad84a', .6); BST_webPatch(m.x, m.y, 30); } });
def('bosses', 'broodmother', { name: 'The Brood Mother', title: 'Queen of the Nests', levelName: "The Brood Mother's Lair", arch: 'broodmother', size: 3.2, hp: 70, dmg: 1.9, el: 'venom', music: BST_SONG_BROOD,
  phases: [{ at: 1, patterns: ['leapslam', 'webspray', 'scuttle'], gap: .85 }, { at: .66, patterns: ['leapslam', 'webspray', 'scuttle', 'broodeggs', 'venompools'], gap: .7 }, { at: .33, patterns: ['leapslam', 'webspray', 'scuttle', 'broodeggs', 'venompools'], gap: .5 }],
  intro(m) { m.bst = { t: 0, intro: -1, rage: 0 }; },
  // (a shared arena module, when present, calls this instead of its element burst when she wakes or enrages)
  bosRoar(m, kind) { P.ring(m.x, m.y, 10, 80, '#f0eef8', .6); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; P.add({ kind: 'bit', x: m.x + Math.cos(a) * 20, y: m.y + Math.sin(a) * 20, z: 6, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, vz: 60, g: 200, max: .8, color: '#f0eef8' }); } if (kind !== 'phase') BST_webPatch(m.x, m.y, 30, true); },
  update(m) { if (m.dormant) m.patT = Math.max(m.patT, 1); BST_webWalk(m); },   // runs before the core moves her: silk never slows her
  onPhase(m, i) { if (m.bst) m.bst.rage = 1.2; sfx('bst_screech', { vol: .8, pitch: .8 + i * .1 }); if (i >= 1) for (let k = 0; k < 2 + i; k++) { const a = Math.random() * TAU, d = 40 + Math.random() * 40; BST_egg(m.x, m.y, { z: 20, vz: 150, vx: Math.cos(a) * d / .75, vy: Math.sin(a) * d / .75, hatch: 2.5 + Math.random(), n: 2 }); } },
  onDie(m) { notify('THE BROOD MOTHER IS SLAIN', '#9ad84a', 3); } });

/* ---------- her patterns (any boss may use the generic ones: web spray, venom pools, the scuttling charge) ---------- */
// leap slam: a crouch, a leap in a high arc with the legs tucked, a landing that shakes the arena and webs the floor
def('patterns', 'leapslam', { name: 'Leap Slam', role: 'close', range: [30, 200], start(b) {
  const h = ED.hero, sx = b.x, sy = b.y, [tx, ty] = BST_walkPt(h.x, h.y, sx, sy), R = 24 + 6 * Math.sqrt(b.scale || 1);
  FX.telegraph({ shape: 'circle', x: tx, y: ty, r: R, dur: 1.15, owner: b }); sfx('bst_hiss', { vol: .5, pitch: .6 });
  return { t: 0, rig: {}, update(dt) {
    this.t += dt; const t = this.t;
    if (t < .55) { this.rig = { pose: 'crouch', expr: 'angry', bst: { crouch: 1, fang: .8 } }; AI.face(b, Math.atan2(ty - b.y, tx - b.x), dt, 8); b.vx = b.vy = 0; if (Math.random() < dt * 25 && b.body) b.body.kick((Math.random() - .5) * 2); return true; }
    if (t < 1.15) { const u = (t - .55) / .6; b.x = lerp(sx, tx, u); b.y = lerp(sy, ty, u); b.z = Math.sin(u * Math.PI) * 78; b.vx = b.vy = 0; this.rig = { air: true, bst: { fang: .5 } }; return true; }
    if (!this.landed) { this.landed = true; b.x = tx; b.y = ty; b.z = 0; shake(8); game.freeze(.05); sfx('boom'); P.dust(b.x, b.y, 0, 22, { speed: 90, size: 2.2 }); FX.scorch(b.x, b.y, R * .8);
      FX.nova({ team: 'foe', src: b, x: b.x, y: b.y, r0: 8, r1: R + 8, dur: .25, el: b.el, hit: { amount: b.dmg * 1.6, kb: 230, knockdown: true } });
      if (b.body && b.body.rig && b.body.rig.o && b.body.rig.o.egg !== undefined) BST_webPatch(b.x, b.y, R); }
    this.rig = { pose: 'crouch', bst: { crouch: .7 } }; return t < 1.75;
  } };
} });
// web spray: rears up, a cone on the floor, then a fan of silk globs that slow and web the ground where they land
def('patterns', 'webspray', { name: 'Web Spray', role: 'zone', range: [0, 170], start(b) {
  const h = ED.hero, ang = angTo(b, h), n = 9 + b.phase * 3, waves = b.phase >= 2 ? 2 : 1;
  FX.telegraph({ shape: 'arc', x: b.x, y: b.y, r: 125, ang, half: .6, dur: .75, owner: b }); sfx('bst_hiss', { vol: .6, pitch: .7 });
  return { t: 0, fired: 0, rig: {}, update(dt) {
    this.t += dt; AI.face(b, ang, dt, 6); b.vx = b.vy = 0; this.rig = { pose: 'cast', expr: 'shout', bst: { rear: 1, fang: 1 } };
    if (this.t > .75) { const k = Math.floor((this.t - .75) / .035); while (this.fired < Math.min(n * waves, k)) { const i = this.fired++, a = ang + (Math.random() - .5) * 1.15, d = 30 + Math.random() * 95; BST_webGlob(b, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, { speed: 175, z: 10 * Math.sqrt(b.scale || 1), web: 11, dmg: .45 }); if (i % 3 === 0) sfx('bst_spit', { vol: .5 }); } }
    return this.t < .75 + n * waves * .035 + .45;
  } };
} });
// the scuttling charge: legs drum in place behind a red lane, then a zig-zag rush that bowls the hero over (a wall stuns her)
def('patterns', 'scuttle', { name: 'Scuttling Charge', role: 'close', range: [28, 280], start(b) {   // (from close in too: bosses stalk to 40, so a far-only charge was almost never picked)
  const h = ED.hero, ang = angTo(b, h), len = BST_ray(b.x, b.y, ang, Math.min(250, Math.hypot(h.x - b.x, h.y - b.y) + 80)), sp = 320;
  FX.telegraph({ shape: 'line', x: b.x, y: b.y, ang, len, w: 12 + 10 * Math.sqrt(b.scale || 1), dur: .75, owner: b }); sfx('bst_hiss', { vol: .5 });
  return { t: 0, rig: {}, update(dt) {
    this.t += dt; b.facing = ang; const T0 = len / sp;
    if (this.t < .75) { this.rig = { pose: 'crouch', expr: 'angry', bst: { crouch: .8, fang: .7 } }; b.vx = b.vy = 0; if (b.body) b.body.kick((Math.random() - .5) * 1.5); if (Math.random() < dt * 20) P.dust(b.x, b.y, 0, 1); return true; }
    if (this.t < .75 + T0 && !this.crash) {
      const a = ang + Math.sin((this.t - .75) * 16) * .3; b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; this.rig = { dash: true, expr: 'shout', bst: { fang: 1 } };
      if (Math.random() < dt * 30) P.dust(b.x, b.y, 0, 1, { speed: 40 }); if (Math.random() < dt * 12) sfx('bst_skitter', { vol: .6, pitch: .6 });
      if (!this.hit && Math.hypot(h.x - b.x, h.y - b.y) < b.r + h.r + 6) { this.hit = true; if (dealDamage(h, { src: b, amount: b.dmg * 1.4, el: b.el, kb: 260, ang, knockdown: true })) { shake(5); sfx('bst_bite'); P.impact(h.x, h.y, 14, 10); } }
      if (ED.L.map.solidAt(b.x + Math.cos(ang) * (b.r + 6), b.y + Math.sin(ang) * (b.r + 6))) { this.crash = this.t; b.vx = b.vy = 0; shake(7); sfx('boom'); P.dust(b.x + Math.cos(ang) * b.r, b.y + Math.sin(ang) * b.r, 10, 14, { speed: 70 }); P.text(b.x, b.y, 40, 'DAZED', '#fff2c4'); }
      return true;
    }
    b.vx *= .85; b.vy *= .85;
    if (this.crash) { this.rig = { pose: 'kneel', bst: { hurt: 1, crouch: .6 } }; return this.t < this.crash + 1.4; }
    this.rig = {}; return this.t < 1.3 + T0;
  } };
} });
// eggs: the sac heaves and flings egg sacs across the arena; left alone, each hatches broodlings
def('patterns', 'broodeggs', { name: 'Brood', unique: true, range: [0, 400], start(b) {
  const n = 3 + b.phase; sfx('bst_squelch', { vol: .7, pitch: .6 });
  return { t: 0, laid: 0, rig: {}, update(dt) {
    this.t += dt; b.vx = b.vy = 0; this.rig = { pose: 'crouch', bst: { crouch: .5, fang: .3 } };
    if (this.t > .5 + this.laid * .2 && this.laid < n) {
      this.laid++; const s = b.scale || 1, bx = b.x - Math.cos(b.facing) * 14 * s, by = b.y - Math.sin(b.facing) * 14 * s;
      let tx = bx, ty = by; for (let k = 0; k < 8; k++) { const a = Math.random() * TAU, d = 40 + Math.random() * 80, [px2, py2] = [b.x + Math.cos(a) * d, b.y + Math.sin(a) * d]; if (ED.L.map.walkable(Math.floor(px2 / BST_T), Math.floor(py2 / BST_T))) { tx = px2; ty = py2; break; } }
      const vz = 150, T0 = 2 * vz / 400; BST_egg(bx, by, { z: 12 * s, vz, vx: (tx - bx) / T0, vy: (ty - by) / T0, hatch: 2.6 + Math.random() * 1.2, n: 2 + (b.phase >= 2 ? 1 : 0) });
      sfx('bst_egg', { vol: .7 }); if (b.body) b.body.kick(-3);
    }
    return this.t < .7 + n * .2 + .3;
  } };
} });
// venom pools: lobbed globs that splash into lingering pools of poison (each landing is marked first)
def('patterns', 'venompools', { name: 'Venom Pools', role: 'zone', range: [30, 240], start(b) {
  const h = ED.hero, n = 3 + b.phase, el = b.el === 'phys' ? 'venom' : b.el, targets = [];
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, d = i ? 18 + Math.random() * 40 : 0; targets.push(BST_walkPt(h.x + Math.cos(a) * d + h.vx * .4, h.y + Math.sin(a) * d + h.vy * .4, h.x, h.y)); }
  return { t: 0, fired: 0, rig: {}, update(dt) {
    this.t += dt; b.vx = b.vy = 0; AI.face(b, angTo(b, h), dt, 5); this.rig = { pose: 'cast', expr: 'shout', bst: { rear: .6, fang: 1 } };
    if (this.t > .45 + this.fired * .14 && this.fired < n) {
      const [tx, ty] = targets[this.fired++], d = Math.hypot(tx - b.x, ty - b.y), sp = 120, tf = Math.max(.3, d / sp), z0 = 14, grav = 260, vz = grav * tf / 2 - z0 / tf;
      FX.telegraph({ shape: 'circle', x: tx, y: ty, r: 16, dur: tf, color: '#8ae04a' });
      FX.bolt({ team: 'foe', src: b, x: b.x, y: b.y, z: z0, ang: Math.atan2(ty - b.y, tx - b.x), speed: sp, grav, vz, life: tf + .4, r: 3.5, el, light: 30, hit: { amount: b.dmg * .5, kb: 40 }, look: { kind: 'orb', size: 2.4 },
        onEnd: p => { if (p.z <= .5) { FX.area({ team: 'foe', src: b, x: p.x, y: p.y, r: 17, dur: 5.5, tick: .5, el, hit: { amount: b.dmg * .28, statusChance: .6 } }); elBurst(p.x, p.y, 2, el, 12); sfx('bst_spit', { vol: .5, pitch: .7 }); } } });
      sfx('bst_spit', { vol: .6 });
    }
    return this.t < .6 + n * .14 + .3;
  } };
} });

/* =============================================================================
 * THE DEEP WYRM (depth 15): a huge serpent that lives in the rock. Between attacks it is a mound running under the
 * floor (it cannot be hit); every attack brings it out: a dive along a red line, bursting up under the hero, a tail
 * sweep, a ring of spit, a roar that brings the ceiling down. Any coil out of the ground can be struck.
 * ============================================================================= */
function BST_wyrmTick(m, dt) {
  const b = m.bst || (m.bst = { t: 0, intro: -1, rage: 0 }), R0 = BST_R0(m), D = R0 * 1.9, H = R0 * 6, h = ED.hero; b.t += dt;
  const lift = Math.max(0, m.z); m.z = 0; m.canFly = true;
  if (m.hz === undefined) m.hz = -D;
  const pat = m.pat, toH = h ? angTo(m, h) : m.facing;
  m.bstSway = null; m.bstWrithe = 0;
  if (m.dormant) { m.hz = -D * 1.8; m.vx = m.vy = 0; b.intro = -1; if (Math.random() < dt * 1.5) { P.dust(m.x + (Math.random() - .5) * 30, m.y + (Math.random() - .5) * 30, 0, 2, { color: '#8a7a64' }); } }
  else if (m.introT > 0 && m.boss) {   // the entrance (and, shorter, each enrage): the floor shakes, it erupts, roars at the top, dives
    if (b.intro < 0) { b.intro = 0; b.introLen = m.introT; b.roared = b.burst = false; sfx('bst_rumble', { vol: .8 }); }
    b.intro += dt; const long = b.introLen > 1.8, t = b.intro, e0 = long ? .6 : .1, e1 = e0 + (long ? .45 : .3), e2 = long ? 1.85 : .95; m.vx = m.vy = 0;
    if (t < e0) { m.hz = -D * 1.5; if (Math.random() < dt * 30) P.dust(m.x + (Math.random() - .5) * 50, m.y + (Math.random() - .5) * 50, 0, 1, { speed: 20, color: '#8a7a64' }); if (Math.random() < dt * 8) shake(1.5); }
    else if (t < e1) { if (!b.burst) { b.burst = true; sfx('bst_burst', { vol: .9 }); shake(8); P.bits(m.x, m.y, 4, 30, ['#6a5a4a', '#8a7a64', '#4a3a2a']); P.dust(m.x, m.y, 0, 26, { speed: 100, size: 2.6, color: '#8a7a64' }); FX.nova({ team: 'foe', src: m, x: m.x, y: m.y, r0: 8, r1: 44, dur: .25, el: 'phys', hit: { amount: m.dmg * .5, kb: 240 } }); }
      m.hz = lerp(-D * 1.5, H, E.ease.outCubic((t - e0) / (e1 - e0))); m.bstJaw = 1; }
    else if (t < e2) { if (!b.roared) { b.roared = true; sfx('bst_roar', { vol: 1 }); shake(6); game.flash('#ffb070', .12, .25); }
      m.hz = H + Math.sin(t * 20) * .8; m.bstJaw = 1; m.bstSway = [Math.cos(toH) * R0 * 2, Math.sin(toH) * R0 * 2, -R0 * 1.5 + Math.sin(t * 30) * R0 * .15]; AI.face(m, toH, dt, 3); }
    else { m.hz = approach(m.hz, -D, dt * 260); m.vx = Math.cos(m.facing) * 120; m.vy = Math.sin(m.facing) * 120; m.bstJaw = .5; }
  }
  else if (pat && pat.hz !== undefined) { b.intro = -1; m.hz = pat.hz; m.bstJaw = pat.jaw || 0; m.bstSway = pat.sway || null; m.bstWrithe = pat.writhe || 0; }
  else if (pat) {   // a borrowed pattern (composed bosses): surfaced, lifted by the pattern, rearing for casts and roars
    const rs = m.rigState || {}; m.hz = approach(m.hz, lift > 0 ? lift + R0 * .8 : rs.pose === 'cast' || rs.pose === 'cheer' ? R0 * 5 : R0 * .9, dt * 140); m.bstJaw = rs.expr === 'shout' || rs.attack ? 1 : .3;
  } else {   // between attacks: back into the rock, circling the hero (the body keeps pouring into the ground behind the head)
    b.intro = -1; m.hz = approach(m.hz, -D, dt * (m.hz > 0 ? 75 : 40)); m.bstJaw = m.hz > 0 ? .4 : 0;
    if (h && !m.dormant) { const a = Math.atan2(m.y - h.y, m.x - h.x) + (b.orbit || (b.orbit = Math.random() < .5 ? .7 : -.7)), tx = h.x + Math.cos(a) * 72, ty = h.y + Math.sin(a) * 72, dir = AI.steer(m, tx, ty), sp = m.speed * statusSpeed(m);
      m.vx = approach(m.vx, dir[0] * sp, 300 * dt); m.vy = approach(m.vy, dir[1] * sp, 300 * dt); m.facing = E.approachAng(m.facing, Math.atan2(m.vy, m.vx), dt * 5); if (Math.random() < dt * .4) b.orbit = -b.orbit; }
  }
  const rise = dt > 0 ? (m.hz - (b.lastHz === undefined ? m.hz : b.lastHz)) / dt : 0; b.lastHz = m.hz;
  if (rise > 60 && m.hz > -R0) { const k = Math.sin(m.hz * .07 + b.t) * 75; m.vx += -Math.sin(m.facing) * k; m.vy += Math.cos(m.facing) * k; }   // rising fast: the column curves instead of standing like a post
  m.untargetable = m.hz < -R0 * .5 || !!m.dormant;
  BST_coils(m);
}
def('archetypes', 'wyrm', { name: 'Deep Wyrm', tags: ['beast', 'burrower', 'boss'], bossBody: true, noPack: true, minDepth: 999, weight: 0, ownEntrance: true,   // its eruption is its waking
  hp: 46, dmg: 13, speed: 66, r: 13, xp: 50, head: 24, mass: 99, el: 'fire', corpseT: 5.5, stagger: false, flies: true,
  body: BST_serpentBody({ n: 24, gap: 6.3, headR: 12.5, bodyR: 9.2, tailR: 2.6, fins: 3, spines: true, magma: true, horns: true, maxScale: 1.15 }),
  palettes: [{ base: '#4e3c38', belly: '#a06a48', spine: '#e0d0b4', fin: '#c8402a', eye: '#ffd040', glow: '#ff7a2a', dirt: '#4a3a32', mouth: '#5a1410', tooth: '#f4ecd8' }], elKeys: ['glow', 'eye'],
  ai: BST_burrowAI, update: BST_wyrmTick, draw: (m, r, a) => BST_drawBeast(m, r, a),
  onDie(m) { shake(10); sfx('bst_roar', { vol: 1, pitch: .7 }); P.bits(m.x, m.y, 20, 30, ['#4e3c38', '#6a5a4a', '#ff7a2a']); for (let i = 0; i < 6; i++) { const a = Math.random() * TAU, d = 30 + Math.random() * 80; BST_rock({ team: 'hero', x: m.x + Math.cos(a) * d, y: m.y + Math.sin(a) * d, delay: .8 + i * .25, amount: 0 }); } } });
def('bosses', 'wyrm', { name: 'The Deep Wyrm', title: 'That Which Bores Below', levelName: "The Wyrm's Descent", arch: 'wyrm', size: 1, hp: 52, dmg: 1.7, el: 'fire', music: BST_SONG_WYRM,
  phases: [{ at: 1, patterns: ['wyrmdive', 'wyrmburst', 'spitring'], gap: 1 }, { at: .66, patterns: ['wyrmdive', 'wyrmburst', 'spitring', 'tailsweep', 'cavein'], gap: .85 }, { at: .33, patterns: ['wyrmdive', 'wyrmburst', 'spitring', 'tailsweep', 'cavein'], gap: .6 }],
  intro(m) { m.bst = { t: 0, intro: -1, rage: 0 }; m.hz = -BST_R0(m) * 3; m.body.rig.reset(m.x, m.y, m.hz, m.facing, 'column'); },
  bosRoar(m) { P.bits(m.x, m.y, 4, 26, ['#6a5a4a', '#8a7a64', '#4a3a2a', '#ff7a2a']); P.ring(m.x, m.y, 10, 70, '#c8a070', .5); P.dust(m.x, m.y, 0, 14, { speed: 90, size: 2.4, color: '#8a7a64' }); },
  update(m) { if (m.dormant) m.patT = Math.max(m.patT, 1); },
  onPhase(m, i) { if (i >= 2) for (let k = 0; k < 6; k++) { const h = ED.hero, a = Math.random() * TAU, d = 20 + Math.random() * 90; BST_rock({ team: 'foe', src: m, x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d, delay: 1 + k * .15, amount: m.dmg }); } },
  onDie(m) { notify('THE DEEP WYRM FALLS', '#ffb070', 3); } });

/* ---------- the wyrm's patterns (the first three need a serpent; spit ring and cave-in work for any boss) ---------- */
// dive: runs under the floor to the far side of the hero; a red lane; then it tears along the lane breaching in arcs
def('patterns', 'wyrmdive', { name: 'Burrowing Dive', unique: true, range: [0, 999], start(b) {
  const h = ED.hero, R0 = BST_R0(b), D = R0 * 1.9, A0 = R0 * 4.2, lam = 118, sp = 255;
  const line = (fx, fy) => { const a0 = Math.random() * TAU; for (let k = 0; k < 12; k++) { const a = a0 + k * .53, x = h.x + Math.cos(a) * 95, y = h.y + Math.sin(a) * 95; if (ED.L.map.walkable(Math.floor(x / BST_T), Math.floor(y / BST_T)) && ED.L.map.los(x, y, h.x, h.y)) return [x, y]; } return [fx, fy]; };
  const S0 = line(b.x, b.y);
  return { t: 0, hz: b.hz, jaw: 0, stage: 'go', S: S0, runs: b.phase >= 2 ? 2 : 1, update(dt) {
    this.t += dt; const [sx, sy] = this.S;
    if (this.stage === 'go') {   // underground, fast, to the start of the lane
      this.hz = approach(this.hz, -D, dt * 90); const dx = sx - b.x, dy = sy - b.y, d = Math.hypot(dx, dy);
      if (d > 6 && this.t < 1.3) { b.vx = dx / d * 230; b.vy = dy / d * 230; b.facing = Math.atan2(dy, dx); return true; }
      b.vx = b.vy = 0; if (this.hz > -D * .9) return true;
      b.x = sx; b.y = sy; this.ang = angTo(b, h); this.len = BST_ray(sx, sy, this.ang, 240); b.facing = this.ang;
      FX.telegraph({ shape: 'line', x: sx, y: sy, ang: this.ang, len: this.len, w: 30, dur: this.runs > 1 && this.done ? .6 : .95, owner: b }); sfx('bst_rumble', { vol: .6, pitch: 1.3 });
      this.stage = 'tele'; this.tt = 0; this.dur = this.runs > 1 && this.done ? .6 : .95; return true;
    }
    if (this.stage === 'tele') { this.tt += dt; b.vx = b.vy = 0; if (Math.random() < dt * 25) P.dust(sx + (Math.random() - .5) * 16, sy + (Math.random() - .5) * 16, 0, 1, { speed: 25, color: '#8a7a64' }); if (this.tt >= this.dur) { this.stage = 'run'; this.s = 0; this.hit = false; sfx('bst_burst', { vol: .7 }); } return true; }
    if (this.stage === 'run') {   // the breaching run: the head porpoises in and out of the floor along the lane
      this.s += sp * dt; const s = this.s, wasUp = this.hz > 0;
      b.vx = Math.cos(this.ang) * sp; b.vy = Math.sin(this.ang) * sp; b.facing = this.ang;
      this.hz = -D + (A0 + D) * (1 - Math.cos(s / lam * TAU)) / 2; this.jaw = this.hz > 0 ? 1 : .2;
      if ((this.hz > 0) !== wasUp) { shake(3); FX.nova({ team: 'foe', src: b, x: b.x, y: b.y, r0: 4, r1: R0 * 2, dur: .2, el: 'phys', hit: { amount: b.dmg * .8, kb: 160 } }); P.bits(b.x, b.y, 2, 12, ['#6a5a4a', '#8a7a64', '#4a3a2a']); }
      if (!this.hit && h.alive) { const rig = b.body && b.body.rig; if (rig && rig.seg) for (const q of rig.seg) if (!q.gone && q.z > -q.r * .5 && q.z < q.r + 20 && Math.hypot(q.x - h.x, q.y - h.y) < q.r + h.r + 2) { this.hit = true; const side = Math.sign(-(h.x - b.x) * Math.sin(this.ang) + (h.y - b.y) * Math.cos(this.ang)) || 1; if (dealDamage(h, { src: b, amount: b.dmg * 1.5, el: b.el, kb: 230, ang: this.ang + side * 1.2, knockdown: true })) { shake(5); P.impact(h.x, h.y, 14, 10); } break; } }
      if (s >= this.len) { b.vx = b.vy = 0; this.runs--; this.done = true; if (this.runs > 0) { this.S = [b.x, b.y]; this.stage = 'go'; this.t = 1.3; } else { this.stage = 'end'; this.te = 0; } }
      return true;
    }
    // the end of the lane: it breaches and hangs there a breath, spent (the moment to punish the dive), then sinks
    this.te += dt; b.vx *= .9; b.vy *= .9;
    if (this.te < .95) { this.hz = approach(this.hz, R0 * 2.4, dt * 170); this.jaw = .35 + .15 * Math.sin(this.te * 9); this.sway = [0, 0, Math.sin(this.te * 6) * R0 * .25]; if (!this.spent && this.hz > 0) { this.spent = true; P.bits(b.x, b.y, 2, 10, ['#6a5a4a', '#8a7a64', '#4a3a2a']); P.dust(b.x, b.y, 0, 8, { speed: 50, color: '#8a7a64' }); } return true; }
    this.sway = null; this.hz = approach(this.hz, -D, dt * 110); return this.te < 1.3;
  } };
} });
// burst: a circle chases the hero, locks; it erupts straight up through it, towers, then crashes down on him
def('patterns', 'wyrmburst', { name: 'Eruption', unique: true, range: [0, 999], start(b) {
  const h = ED.hero, R0 = BST_R0(b), D = R0 * 1.9, H = R0 * 5.5, tel = FX.telegraph({ shape: 'circle', x: h.x, y: h.y, r: 30, dur: 1.5, owner: b, follow: h });
  sfx('bst_rumble', { vol: .6 });
  return { t: 0, hz: b.hz, jaw: 0, sway: null, update(dt) {
    this.t += dt; const t = this.t;
    if (t < 1.5) { if (t > .95 && tel.follow) tel.follow = null; this.hz = approach(this.hz, -D, dt * 90); const dx = tel.x - b.x, dy = tel.y - b.y, d = Math.hypot(dx, dy); b.vx = d > 3 ? dx / d * Math.min(240, d * 6) : 0; b.vy = d > 3 ? dy / d * Math.min(240, d * 6) : 0;
      if (Math.random() < dt * 30) P.dust(tel.x + (Math.random() - .5) * 50, tel.y + (Math.random() - .5) * 50, 0, 1, { speed: 20, color: '#8a7a64' }); if (t > 1.05 && Math.random() < dt * 10) shake(1.5); return true; }
    const u = t - 1.5, toH = angTo(b, h);
    if (!this.up) { this.up = true; b.x = tel.x; b.y = tel.y; b.vx = b.vy = 0; shake(9); game.freeze(.06); sfx('bst_burst', { vol: 1 }); sfx('bst_roar', { vol: .7, pitch: 1.3 });
      FX.nova({ team: 'foe', src: b, x: b.x, y: b.y, r0: 6, r1: 34, dur: .22, el: 'phys', hit: { amount: b.dmg * 1.8, kb: 250, knockdown: true } });
      P.bits(b.x, b.y, 4, 34, ['#6a5a4a', '#8a7a64', '#4a3a2a', '#a89a80']); P.dust(b.x, b.y, 0, 28, { speed: 110, size: 2.6, color: '#8a7a64' }); FX.scorch(b.x, b.y, 26, '#1a1412', 6); }
    if (u < .35) { this.hz = lerp(-D, H, E.ease.outCubic(u / .35)); this.jaw = 1; return true; }
    if (u < 1.5) { const k = Math.min(1, (u - .35) / .5); AI.face(b, toH, dt, 3); this.hz = H + Math.sin(u * 3) * 2; this.jaw = .55 + .45 * Math.sin(u * 7); this.sway = [Math.cos(toH) * R0 * 2.6 * k, Math.sin(toH) * R0 * 2.6 * k, -R0 * 1.8 * k]; return true; }
    if (u < 2.05) {   // the crash
      if (!this.tgt) { const d = Math.min(70, Math.hypot(h.x - b.x, h.y - b.y)); this.tgt = BST_walkPt(b.x + Math.cos(toH) * d, b.y + Math.sin(toH) * d, b.x, b.y); FX.telegraph({ shape: 'circle', x: this.tgt[0], y: this.tgt[1], r: 24, dur: .45, owner: b }); this.from = [b.x, b.y]; }
      const v = (u - 1.5) / .55, wasUp = this.hz > 0; b.x = lerp(this.from[0], this.tgt[0], E.ease.inOut(v)); b.y = lerp(this.from[1], this.tgt[1], E.ease.inOut(v)); b.vx = b.vy = 0;
      this.hz = lerp(H, -D, E.ease.inQuad(v)); this.jaw = 1; this.sway = null;
      if (wasUp && this.hz <= 0) { shake(7); sfx('bst_burst', { vol: .8 }); FX.nova({ team: 'foe', src: b, x: b.x, y: b.y, r0: 4, r1: 26, dur: .2, el: 'phys', hit: { amount: b.dmg * 1.4, kb: 220, knockdown: true } }); P.bits(b.x, b.y, 3, 18, ['#6a5a4a', '#8a7a64', '#4a3a2a']); P.dust(b.x, b.y, 0, 14, { speed: 80, color: '#8a7a64' }); }
      return true;
    }
    this.hz = -D; return u < 2.35;
  } };
} });
// tail sweep: it surfaces beside the hero, rears, and swings its whole body round like a scythe (standing by the head is safest)
def('patterns', 'tailsweep', { name: 'Tail Sweep', unique: true, range: [0, 170], start(b) {
  const h = ED.hero, R0 = BST_R0(b), rig = BST_isWorm(b) ? b.body.rig : null, dir0 = Math.random() < .5 ? 1 : -1;   // (a body with no coils only rears and lingers)
  return { t: 0, hz: b.hz, jaw: .3, stage: 'rise', update(dt) {
    this.t += dt; const t = this.t;
    if (this.stage === 'rise') {   // out of the ground, slithering round the hero along the surface
      const dx = b.x - h.x, dy = b.y - h.y, d = Math.hypot(dx, dy) || 1, tang = [-dy / d * dir0, dx / d * dir0], rad = (48 - d) * 3;
      b.vx = (tang[0] * 170 + dx / d * rad); b.vy = (tang[1] * 170 + dy / d * rad); b.facing = Math.atan2(b.vy, b.vx);
      this.hz = approach(this.hz, R0 * .9, dt * 150); this.jaw = .5;
      if (t > 1.1) { this.stage = 'rear'; this.tt = 0; b.vx = b.vy = 0; }
      return true;
    }
    if (this.stage === 'rear') {
      this.tt += dt; this.hz = approach(this.hz, R0 * 5, dt * 120); AI.face(b, angTo(b, h), dt, 4); this.jaw = 1;
      if (this.tt > .3 && !this.tel && rig) {   // which way the body must swing to cross the hero, and a warning over all of it
        const mid = rig.seg[Math.floor(rig.o.n * .5)], bodyA = Math.atan2(mid.y - b.y, mid.x - b.x), heroA = angTo(b, h);
        this.dir = Math.sign(E.angDiff(bodyA, heroA)) || 1; this.total = this.dir * 3; this.bodyA = bodyA;
        this.tel = FX.telegraph({ shape: 'arc', x: b.x, y: b.y, r: rig.len * .85, ang: bodyA + this.total / 2, half: Math.abs(this.total) / 2 + .25, dur: .75, owner: b }); sfx('bst_roar', { vol: .6, pitch: 1.2 });
      }
      if (!rig && this.tt > .6) { this.stage = 'hold'; this.tt = .6; return true; }
      if (this.tel && this.tt > 1.05) { this.stage = 'sweep'; this.tt = 0; this.done = 0; this.hit = false; sfx('whoosh', { vol: .9, pitch: .5 }); }
      else if (this.tel && rig) { const k = -this.dir * .05 * dt / .75; rig.rotatePath(b.x, b.y, k); }   // anticipation: it coils back a little
      return true;
    }
    if (this.stage === 'sweep') {
      this.tt += dt; const u = Math.min(1, this.tt / .55), e = E.ease.inOut(u), da = (e - this.done) * this.total; this.done = e;
      if (rig) { rig.rotatePath(b.x, b.y, da); this.writhe = 0; }
      if (Math.random() < dt * 40 && rig) { const q = rig.seg[Math.floor(Math.random() * rig.o.n)]; P.dust(q.x, q.y, 0, 1, { speed: 60, color: '#8a7a64' }); }
      if (!this.hit && h.alive && rig) for (let k = 2; k < rig.o.n; k++) { const q = rig.seg[k]; if (q.z < q.r * 3 && Math.hypot(q.x - h.x, q.y - h.y) < q.r + h.r + 2) { this.hit = true; if (dealDamage(h, { src: b, amount: b.dmg * 1.7, el: 'phys', kb: 290, ang: angTo(b, h) + this.dir * 1.3, knockdown: true })) { shake(7); game.freeze(.06); P.impact(h.x, h.y, 14, 12); sfx('kick'); } break; } }
      if (u >= 1) { this.stage = 'hold'; this.tt = 0; }
      return true;
    }
    this.tt += dt; this.jaw = .4; this.sway = [0, 0, Math.sin(this.tt * 5) * R0 * .3]; return this.tt < 1.3;   // it lingers, reared, before it dives
  } };
} });
// spit ring: rears high and spits rings of burning globs that rain down all around (rotated waves in later phases)
def('patterns', 'spitring', { name: 'Spit Ring', role: 'zone', range: [0, 230], start(b) {
  const worm = BST_isWorm(b), R0 = BST_R0(b), H = R0 * 4.6, waves = 1 + Math.min(2, b.phase), el = b.el === 'phys' ? 'fire' : b.el;
  return { t: 0, fired: 0, hz: worm ? b.hz : undefined, jaw: .4, rig: { pose: 'cast' }, update(dt) {
    this.t += dt; b.vx = b.vy = 0; this.rig = { pose: 'cast', expr: 'shout', bst: { rear: 1, fang: 1 } };
    if (worm) { this.hz = approach(this.hz, H, dt * 220); this.jaw = this.t > .5 ? .7 + .3 * Math.sin(this.t * 14) : .4; const tt = this.t; this.sway = [Math.cos(tt * 2.3) * R0 * .9, Math.sin(tt * 1.9) * R0 * .9, -R0 * .4]; }
    if (this.t > .6 + this.fired * .45 && this.fired < waves) {
      const n = 12 + 2 * b.phase, z0 = worm ? Math.max(12, this.hz) : 18, off = Math.random() * TAU;
      for (let i = 0; i < n; i++) FX.bolt({ team: 'foe', src: b, x: b.x, y: b.y, z: z0, ang: off + i / n * TAU, speed: 92, grav: 170, vz: 38, life: 3, r: 3.5, el, light: 24, hit: { amount: b.dmg * .55, kb: 60 }, look: { kind: 'orb', size: 2 },
        onEnd: p => { if (p.z <= .5) { elBurst(p.x, p.y, 2, el, 6); FX.nova({ team: 'foe', src: b, x: p.x, y: p.y, r0: 2, r1: 11, dur: .18, el, hit: { amount: b.dmg * .3, kb: 50 } }); } } });
      this.fired++; sfx('bst_spit', { vol: .8, pitch: .6 }); sfx('shoot', { vol: .4, pitch: .5 }); if (b.body) b.body.kick(-4);
    }
    if (this.t > .9 + waves * .45) { this.jaw = .3; this.sway = [Math.cos(this.t * 2) * R0 * 1.4, Math.sin(this.t * 2) * R0 * 1.4, -R0 * .8]; }   // spent: it sways a moment, open to a counter-attack
    return this.t < 1.9 + waves * .45;
  } };
} });
// cave-in: a roar that shakes the arena; the ceiling comes down in boulders (marked on the floor), a few aimed at the hero
def('patterns', 'cavein', { name: 'Cave-in', role: 'zone', range: [0, 999], start(b) {
  const h = ED.hero, worm = BST_isWorm(b), R0 = BST_R0(b), n = 7 + 3 * b.phase;
  return { t: 0, hz: worm ? b.hz : undefined, jaw: .5, rig: { pose: 'cheer', expr: 'shout' }, update(dt) {
    this.t += dt; b.vx = b.vy = 0; this.rig = { pose: 'cheer', expr: 'shout', bst: { rear: 1, fang: 1 } };
    if (worm) { this.hz = approach(this.hz, R0 * 5.6, dt * 220); this.jaw = this.t > .5 ? 1 : .5; this.sway = this.t > .5 ? [Math.cos(b.facing) * R0 * 1.6, Math.sin(b.facing) * R0 * 1.6, -R0 * .6 + Math.sin(this.t * 30) * R0 * .25] : null; }
    if (this.t > .55 && !this.roared) { this.roared = true; sfx('bst_roar', { vol: 1 }); shake(7); game.flash('#c8a070', .15, .3);
      for (let i = 0; i < 30; i++) P.add({ kind: 'dust', x: h.x + (Math.random() - .5) * 220, y: h.y + (Math.random() - .5) * 220, z: 90 + Math.random() * 40, vz: -60, g: 80, max: 1.5, size: 1.4, color: '#9a8a74' });
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU, d = i < 2 ? Math.random() * 10 : 25 + Math.random() * 95, [x, y] = BST_walkPt(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, h.x, h.y); BST_rock({ team: 'foe', src: b, x, y, r: 16, delay: .75 + i * .11 + Math.random() * .3, amount: b.dmg * 1.3 }); }
    }
    return this.t < 2.5;
  } };
} });

/* =============================================================================
 * MECHANIC: WEBS (depth 10, "The Brood Mother's Lair"; composes anywhere past depth 15)
 * Nests of silk across the level: the floor tag 'web' (the core slows walkers on it). Spiders keep full speed on it.
 * Fire clears it in a rush of flame that runs along the silk and ignites every monster standing in it (see WEBS ON
 * THE FLOOR above). Egg sacs sit in the nests and hatch when the hero comes near; cocoons hold a victim's gold.
 * ============================================================================= */
function BST_cocoon(L0, x, y, R) {
  return addThing(L0, { kind: 'bst_cocoon', x, y, r: 5, solid: true, hittable: true, hp: 2, ph: R() * 9, lean: (R() - .5) * .6, mapColor: '#d8d4e4',
    onHit(hit) { if (this.dead) return; this.hp -= hit.el === 'fire' ? 2 : 1; this.shake = .25; P.bits(this.x, this.y, 8, 4, ['#f0eef8', '#c8c4d8']); sfx('slash2', { vol: .4 });
      if (this.hp <= 0) { this.dead = true; P.bits(this.x, this.y, 8, 14, ['#f0eef8', '#c8c4d8', '#e8d8b0']); P.dust(this.x, this.y, 4, 6, { color: '#e8e4f0' }); sfx('bst_squelch', { vol: .4, pitch: 1.5 });
        const d = ED.depth || 1; for (let i = 0; i < 2; i++) dropLoot('gold', this.x, this.y, { n: Math.max(1, Math.round((4 + Math.random() * 6) * SCALE.gold(d))) }); if (Math.random() < .25) dropLoot('potion', this.x, this.y); } },
    update(dt) { if (this.shake > 0) this.shake -= dt; },
    draw(r) {
      if (!r.visible(this.x, this.y, 0, 30, 40, 30)) return;
      r.shadow(this.x, this.y, 5, .4);
      r.queue(this.x, this.y, 0, g => {
        const v = r.view, [ox, oy] = r.w(this.x, this.y, 0), sw = this.shake > 0 ? Math.sin(game.time * 60) * 1.2 : 0, t = E.tones('#dcd8e6'), lx = this.lean;
        const e = BST_ell(v, ox + sw, oy, [lx * 3, 0, 7], [2.8, 0, 0], [0, 2.8, 0], [lx * 3, 0, 7.2]); BST_ball(g, e, t, BST_OL, false);
        for (let k = 0; k < 5; k++) { const z = 2 + k * 2.6, a = BST_p(v, ox + sw, oy, -3 + lx * z * .4, 0, z), b = BST_p(v, ox + sw, oy, 3 + lx * z * .4, 0, z + 1.6); px.line(g, a[0], a[1], b[0], b[1], t.sh); }
        const hd = BST_p(v, ox + sw, oy, lx * 6, 0, 12.2); px.disc(g, hd[0], hd[1], Math.max(1, 1.8 * v.scale), t.sh); px.disc(g, hd[0] - .5, hd[1] - .5, Math.max(.6, 1.3 * v.scale), t.base);
        const top = BST_p(v, ox + sw, oy, lx * 7, 0, 14); px.blend(g, .7, 'normal', () => { const [x1, y1] = r.w(this.x, this.y, 200); px.line(g, top[0], top[1], x1, y1, '#e8e4f0'); });
      });
    } });
}
def('mechanics', 'webs', { name: 'Webs', title: 'The Webbed Nests', adj: 'Webbed', noun: 'Nests', color: '#e8e4f0', weight: 8, themes: ['fungal', 'cavern', 'abyss', 'crypt', 'ruins', 'mine'],
  tip: 'Silk slows you, never the spiders. Fire burns it away in a rush of flame that sets alight whatever stands in it: lure a pack onto a nest, then throw one Ember Bolt.',
  icon: (g, x, y, s) => { const c = x + 8 * s, d = y + 8 * s; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; px.line(g, c, d, c + Math.cos(a) * 7 * s, d + Math.sin(a) * 7 * s, '#c8c4d8'); } for (const rr of [2.5, 4.5, 6.5]) for (let k = 0; k < 8; k++) { const a0 = k / 8 * TAU, a1 = (k + 1) / 8 * TAU; px.line(g, c + Math.cos(a0) * rr * s, d + Math.sin(a0) * rr * s, c + Math.cos(a1) * rr * s, d + Math.sin(a1) * rr * s, '#f0eef8'); } px.disc(g, c + 2 * s, d - 2 * s, 1.5 * s, '#2a2230'); px.dot(g, c + 2 * s, d - 2.5 * s, '#ff4a4a'); },
  place(L0, R) {
    for (const rm of L0.rooms) {   // more nests in bigger rooms (a boss arena gets a web-strewn floor); never at the start
      const n = Math.max(1, Math.round(rm.w * rm.h / 75)) + (R.chance(.3) ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const [x, y] = L0.randomFloor(R, { room: rm, minStart: 70 }), rad = 16 + R() * 22; BST_webPatch(x, y, rad, true, L0);
        // eggs keep apart (each its own pop), and away from the landing and the exit (no hatchling ambush on arrival)
        const eggOk = (ex, ey) => Math.hypot(ex - L0.start.x, ey - L0.start.y) > 40 && (!L0.exit || Math.hypot(ex - L0.exit.x, ey - L0.exit.y) > 40) && L0.map.walkable(Math.floor(ex / 16), Math.floor(ey / 16))
          && !L0.things.some(t => t.kind === 'bst_egg' && Math.hypot(t.x - ex, t.y - ey) < 8);
        if (R.chance(.45)) for (let e = 0, ne = R.int(1, 3); e < ne; e++) { const ex = x + (R() - .5) * 14, ey = y + (R() - .5) * 14; if (eggOk(ex, ey)) BST_egg(ex, ey, { L: L0, n: 2 + R.int(0, 1), size: .9 + R() * .3 }); }
        else if (R.chance(.35)) BST_cocoon(L0, x + (R() - .5) * rad, y + (R() - .5) * rad, R);
      }
    }
  },
  start(L0) { if (L0.bstWebC && L0.bstWebC.length) BST_webFloor(L0); },   // a level resumed through a portal keeps its silk
  update(L0, dt) {   // spiders from elsewhere (other modules' 'spider' monsters) keep their pace on silk too
    for (const m of ED.foes) if (m.alive && !m.arch.bstOwn && m.arch.tags && m.arch.tags.includes('spider') && L0.map.floorAt(m.x, m.y) === 'web') { m.x += m.vx * dt * .9; m.y += m.vy * dt * .9; }
  },
  draw(L0, r) {   // guy lines: each nest hangs from strands that climb into the dark
    for (const c of L0.bstWebC || []) { if (c.r < 14 || !r.visible(c.x, c.y, 0, 40, 200, 40)) continue;
      r.queue(c.x, c.y, 0, g => { px.blend(g, .5, 'normal', () => { for (let k = 0; k < 3; k++) { const a = c.a + k * 2.1, [x0, y0] = r.w(c.x + Math.cos(a) * c.r * .7, c.y + Math.sin(a) * c.r * .7, 0), [x1, y1] = r.w(c.x + Math.cos(a) * c.r * .3, c.y + Math.sin(a) * c.r * .3, 160); px.line(g, x0, y0, x1, y1, '#d8d4e4'); } }); }, { bias: -.2 }); }
    if (Math.random() < .15 && ED.hero) { const h = ED.hero, x = h.x + (Math.random() - .5) * 160, y = h.y + (Math.random() - .5) * 120; if (L0.map.floorAt(x, y) === 'web') P.glints(x, y, 1, 1, '#ffffff', 2); }
  } });
for (const id of ['crawler', 'webspinner', 'broodling', 'broodmother']) REG.archetypes[id].bstOwn = true;
for (const id of ['burrower', 'eye', 'wyrm']) REG.archetypes[id].bstOwn = true;
// the core leaves stunT unset at spawn (then stunT -= dt makes it NaN); our beasts start unstunned
BUS.on('spawn', e => { const m = e.m; if (m.arch && m.arch.bstOwn && !(m.stunT >= 0)) m.stunT = 0; });

/* =============================================================================
 * MECHANIC: QUAKE (depth 15, "The Wyrm's Descent"; composes anywhere past depth 15)
 * Every few seconds the ground heaves: a rumble and falling grit, then red fissure lines (one through the hero, others
 * through monster crowds) split open in waves of rock spikes, and boulders drop. Everyone is hurt; the monsters it
 * catches are stunned. Exploit: stand beside a pack on a red line and step off it.
 * ============================================================================= */
function BST_fissure(x, y, ang, len, dmgHero, dmgFoe) {
  FX.telegraph({ shape: 'line', x, y, ang, len, w: 16, dur: .9, then() {
    FX.wave({ team: 'foe', src: null, x, y, ang, speed: 260, len, w: 16, el: 'phys', hit: { amount: dmgHero, kb: 150 } });
    const set = new Set(), t0 = game.time;   // the same wave strikes the monsters (and stuns them)
    FX.visual(len / 260 + .1, () => {}, (f) => { const d = Math.min(len, (game.time - t0) * 260), hx = x + Math.cos(ang) * d, hy = y + Math.sin(ang) * d; eachEnemy('hero', hx, hy, 9, u => { if (set.has(u)) return; set.add(u); dealDamage(u, { src: null, amount: dmgFoe, el: 'phys', kb: 120, ang: ang + (Math.random() < .5 ? 1.4 : -1.4), up: 60, stun: 1.6, tags: ['aoe', 'quake'] }); }); });
    shake(3); sfx('crack', { vol: .8 }); P.dust(x, y, 0, 6, { speed: 40, color: '#8a7a64' });
  } });
}
function BST_tremor(L0) {
  const h = ED.hero; if (!h || !h.alive) return;
  const d = ED.depth || 1, dmgH = 7 * SCALE.foeDmg(d), dmgF = heroHitAmount(1.3), Q = L0.bstQuake;
  sfx('bst_rumble', { vol: .9 }); Q.rumble = 1;
  const lines = [];   // one through the hero (never quite centred on him), others through the thickest crowds nearby
  lines.push([h.x + (Math.random() - .5) * 8, h.y + (Math.random() - .5) * 8, Math.random() * TAU]);
  const near = ED.foes.filter(m => m.alive && !m.boss && Math.hypot(m.x - h.x, m.y - h.y) < 150);
  for (let k = 0; k < 2 && near.length; k++) { const m = near[(Math.random() * near.length) | 0]; lines.push([m.x, m.y, Math.random() * TAU]); }
  for (const [cx, cy, a] of lines) { const back = BST_ray(cx, cy, a + Math.PI, 90), fwd = BST_ray(cx, cy, a, 90), sx = cx - Math.cos(a) * back, sy = cy - Math.sin(a) * back;
    game.after(.35 + Math.random() * .25, () => { if (ED.L === L0) { BST_fissure(sx, sy, a, back + fwd, dmgH, dmgF); Q.scars.push({ x: sx, y: sy, a, len: back + fwd, t: 0, seed: Math.random() * 9 }); } }); }
  const nr = 3 + Math.min(5, Math.floor(d / 6));
  for (let i = 0; i < nr; i++) { const a = Math.random() * TAU, rr = i === 0 ? 4 + Math.random() * 10 : 30 + Math.random() * 90, [x, y] = BST_walkPt(h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr, h.x, h.y);
    BST_rock({ team: 'foe', x, y, r: 15, delay: 1 + i * .15 + Math.random() * .4, amount: dmgH * 1.2, then() { hitCircle('hero', x, y, 15, u => ({ src: null, amount: dmgF, el: 'phys', kb: 140, ang: Math.atan2(u.y - y, u.x - x), stun: 1.6, tags: ['aoe', 'quake'] })); } }); }
}
def('mechanics', 'quake', { name: 'Tremors', title: 'The Shuddering Deep', adj: 'Shuddering', noun: 'Faults', color: '#c8a070', weight: 8, themes: ['cavern', 'mine', 'ruins', 'forge', 'abyss'],
  tip: 'The ground heaves every few seconds: red fissures split open and boulders fall on everyone. What the quake catches is stunned: stand by a pack on a red line, then step off it.',
  icon: (g, x, y, s) => { px.rect(g, x + s, y + 11 * s, 14 * s, 4 * s, '#6a5a4a'); px.rect(g, x + s, y + 11 * s, 14 * s, s, '#8a7a64'); px.line(g, x + 3 * s, y + 11 * s, x + 6 * s, y + 14 * s, '#ff5a3a'); px.line(g, x + 6 * s, y + 14 * s, x + 9 * s, y + 11 * s, '#ff5a3a'); px.line(g, x + 9 * s, y + 11 * s, x + 12 * s, y + 15 * s, '#ff5a3a');
    px.disc(g, x + 10 * s, y + 5 * s, 2.5 * s, '#8a7a64'); px.disc(g, x + 9.5 * s, y + 4.5 * s, 1.4 * s, '#b8a890'); px.line(g, x + 12 * s, y + 2 * s, x + 13 * s, y, '#c8b8a0'); },
  place(L0, R) {   // rubble and fallen stone about the rooms
    for (const rm of L0.rooms) if (R.chance(.7)) for (let k = 0, n = R.int(1, 3); k < n; k++) { const [x, y] = L0.randomFloor(R, { room: rm }); L0.props.push({ name: 'rock', x, y, o: { size: .9 + R() * .5 } }); }
  },
  start(L0) { L0.bstQuake = L0.bstQuake || { t: 5 + Math.random() * 2, scars: [], rumble: 0 }; },
  update(L0, dt) {
    const Q = L0.bstQuake || (L0.bstQuake = { t: 5, scars: [], rumble: 0 });
    const B = ED.boss, fast = B && B.alive && !B.dormant ? (B.phase >= 1 ? .6 : .8) : 1;
    if ((Q.t -= dt) <= 0) { Q.t = (7 + Math.random() * 3) * fast; BST_tremor(L0); }
    if (Q.t < 1.1 && Q.t > 0 && Math.random() < dt * 6) shake(1);   // the warning: the floor starts to shiver
    if (Q.rumble > 0) { Q.rumble -= dt; const h = ED.hero; if (h && Math.random() < dt * 40) P.add({ kind: 'dust', x: h.x + (Math.random() - .5) * 200, y: h.y + (Math.random() - .5) * 160, z: 100 + Math.random() * 40, vz: -40, g: 90, max: 1.8, size: 1 + Math.random(), color: '#9a8a74' }); if (Math.random() < dt * 10) shake(1.5); }
    for (let i = Q.scars.length - 1; i >= 0; i--) if ((Q.scars[i].t += dt) > 9) Q.scars.splice(i, 1);
  },
  draw(L0, r) {   // the fissures stay as scars on the floor for a while
    const Q = L0.bstQuake; if (!Q) return;
    for (const sc of Q.scars) { const a = clamp(Math.min(sc.t * 4, (9 - sc.t) / 2), 0, 1) * .8; if (a <= 0) continue;
      r.decal(() => { const g = r.tgt, n = Math.max(3, Math.round(sc.len / 7)); let [x0, y0] = r.w(sc.x, sc.y, 0); for (let k = 1; k <= n; k++) { const u = k / n, off = (E.hash2(k * 7 + (sc.seed * 100 | 0), 3) - .5) * 5, wx = sc.x + Math.cos(sc.a) * sc.len * u - Math.sin(sc.a) * off, wy = sc.y + Math.sin(sc.a) * sc.len * u + Math.cos(sc.a) * off, [x1, y1] = r.w(wx, wy, 0); px.blend(g, a, 'normal', () => { px.line(g, x0, y0, x1, y1, '#140c0c', 2); px.line(g, x0, y0 - 1, x1, y1 - 1, '#6a5a4a'); }); x0 = x1; y0 = y1; } }); }
  } });
