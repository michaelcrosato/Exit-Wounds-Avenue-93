/* =============================================================================
 * DAN, THE BROOD-SCYTHE: a playable character (18-characters.js; the recipe is docs/CHARACTERS.md)
 * Brief: a thing the deep grew to harvest the deep. It stalks on reverse-kneed legs and three-taloned feet, its forearms
 * end in two long scythes of bone, a crown of horns and a ridge of spines run down its back, and clusters of egg sacs
 * hang from its hips. Every kill ripens one; a ripe brood hatches into broodlings or bursts in a void blast.
 * Silhouette: two pale crescents, a horned crown, a heavy tail. Motion: a low predator's stalk that rears up to strike.
 * Palette: violet-grey chitin with lit plates, ivory bone, purple sacs that glow as they ripen.
 * The body (DanRig) keeps the body contract; its skills and the brood are below it.
 * ============================================================================= */
const DAN_COL = {
  chitin: '#7a7290', under: '#443c52', plate: '#a89eb8', dark: '#2a2430', vein: '#7a3aa8', sac: '#4a2a5e', ripe: '#a050d8', glow: '#e4bcff',
  bone: '#ddd2bd', eye: '#f0c8ff', maw: '#1a1020', tendril: '#7a5a8a', blood: '#c0304a'
};
const DAN_SACS = 6;   // three on each hip: the brood when every one is ripe
/** the bones that keep their length (the character sheet measures them): legs with a hock, arms, the tail */
const DAN_BONES = [['hipL', 'kneeL'], ['kneeL', 'hockL'], ['hockL', 'footL'], ['hipR', 'kneeR'], ['kneeR', 'hockR'], ['hockR', 'footR'],
  ['shL', 'elbowL'], ['elbowL', 'handL'], ['shR', 'elbowR'], ['elbowR', 'handR'], ['handL', 'tipL'], ['handR', 'tipR'], ['hipC', 'shC']];

/** Dan's body. Local frame: f forward, r right, z up, the feet on the floor at z 0. About 1.25x the Wanderer: its
 *  head is near his height, the crown and the raised scythes over it. Every pose is a weight eased toward its state */
class DanRig {
  constructor(hero) {
    this.hero = hero;
    this.o = { size: 1, weapon: 'scythe', bladeLen: 15, hunch: 0, lean: 0 };
    this.C = { metal: DAN_COL.bone, metalDk: '#8f8472', hilt: DAN_COL.vein, chitin: DAN_COL.chitin };
    this.t = Math.random() * 10; this.phase = 0; this.facing = 0; this.spin = 0; this.x = this.y = this.z = 0;
    this.W = { run: 0, low: 0, fall: 0, rear: 0, cheer: 0, guard: 0, wave: 0, hurt: 0, air: 0, impale: 0, whirl: 0, drink: 0, wound: 0, ready: 0 };
    this.swR = this.swL = this.vR = this.vL = 0; this.recoil = 0; this.ripe = 0;
    this.J = {}; this.state = {}; this.trail = [];
    this.update(0, {});
  }
  kick(v) { this.recoil = clamp(this.recoil + v * .2, -2.5, 2.5); }
  _w(p) { const a = this.facing + this.spin, c = Math.cos(a), s = Math.sin(a), k = this.o.size; return [(p[0] * c - p[1] * s) * k, (p[0] * s + p[1] * c) * k, p[2] * k]; }
  _at(p) { const w = this._w(p); return [this.x + w[0], this.y + w[1], this.z + w[2]]; }
  hand(side = 'R') { return this._at(this.J['hand' + side] || this.J.handR); }
  head() { return this._at(this.J.head); }
  tip(side = 'R') { return this._at(side === 'L' ? this.J.tipL : this.J.tipR); }
  update(dt, s = {}) {
    this.t += dt; this.state = s; this.x = s.x || 0; this.y = s.y || 0; this.z = s.z || 0; this.facing = s.facing || 0;
    const h = this.hero, W = this.W, st = s.attack, spec = st && st.spec, hw = s.dan || null;
    const sp = Math.max(Math.hypot(s.vx || 0, s.vy || 0), (s.run || 0) * 84), go = (w, to, rate) => { W[w] = approach(W[w], to, dt * rate); };
    // the weights: where each pose is going, eased so a new state never snaps the body
    const ease = (k, to, up, down) => go(k, to, to > W[k] ? up : down);
    ease('run', Math.min(1, sp / 84), 5, 5);
    ease('low', s.dash ? 1 : s.pose === 'crouch' || s.pose === 'kneel' || hw === 'coil' ? .55 : 0, 14, 7);
    ease('fall', s.pose === 'die' || s.down ? 1 : 0, s.down ? 5 : 2.2, 3);
    ease('rear', s.pose === 'cast' || s.pose === 'cheer' || hw === 'roar' || hw === 'hatch' || hw === 'burst' ? 1 : 0, 7, 4);
    ease('cheer', s.pose === 'cheer' || hw === 'roar' ? 1 : 0, 6, 4);
    ease('guard', s.stance === 'guard' || s.pose === 'block' || s.pose === 'guard' ? 1 : 0, 9, 6);
    ease('ready', s.stance === 'ready' ? 1 : 0, 6, 4);
    ease('wave', s.pose === 'wave' ? 1 : 0, 7, 5);
    ease('hurt', s.hurt ? 1 : 0, 16, 7);
    ease('air', s.air || hw === 'pounce' ? 1 : 0, 9, 7);
    ease('impale', hw === 'impale' ? 1 : 0, 18, 6);
    ease('whirl', spec && spec.spin ? 1 : 0, 14, 6);
    ease('drink', h && h.potionT > 0 ? 1 : 0, 8, 5);
    ease('wound', h && h.maxHp && !h.dead ? clamp(1 - h.hp / h.maxHp / .35, 0, 1) : 0, 2, 4);
    // the scythes: wind-up draws one back and up, the strike sweeps it across and down, the recovery brings it home
    const which = spec ? (spec.hand === 'both' || spec.danBoth ? 'both' : spec.hand === 'L' ? 'L' : 'R') : null;
    const sw = st ? (st.phase === 'wind' ? -E.ease.outQuad(st.u) : st.phase === 'active' ? -1 + 2 * E.ease.outCubic(st.u) : 1 - E.ease.inOut(st.u)) : 0;
    // each scythe follows its swing on a critically damped spring: it gathers speed and settles, never jumps a frame
    const spring = (x, v, to) => { const K = 900; v += ((to - x) * K - v * 2 * Math.sqrt(K)) * dt; return [x + v * dt, v]; };
    [this.swR, this.vR] = spring(this.swR, this.vR, which === 'R' || which === 'both' ? sw : 0);
    [this.swL, this.vL] = spring(this.swL, this.vL, which === 'L' || which === 'both' ? sw : 0);
    // the whirl: a full turn of the body for each turn of the move (it lets go by easing back to the front)
    if (spec && spec.spin && st.phase === 'active') this.spin = -E.ease.outCubic(st.u) * TAU * (spec.spin > 1 ? spec.spin : 1);
    else this.spin = E.approachAng(this.spin, 0, dt * 18);
    this.recoil *= Math.exp(-dt * 9);
    this.ripe = approach(this.ripe, h ? (h.brood || 0) : 0, dt * 4);
    this.phase += dt * (1.2 + sp / 6.5) * (W.run > .05 ? 1 : .35);   // the gait clock (the hero's footsteps read it)
    this._pose();
  }
  /** build every joint from the weights */
  _pose() {
    const W = this.W, t = this.t, V = E.V3, run = W.run, low = W.low, rear = W.rear * (1 - W.fall), ph = this.phase;
    const breath = Math.sin(t * 2.1) * (.35 + W.wound * .5) * (1 - run), bob = Math.abs(Math.cos(ph)) * .9 * run;
    const fall = W.fall, hipZ = (13 - 5 * low + 1.5 * rear + bob + breath * .4 - W.hurt * .8 - W.wound * 1.2 + this.recoil * .4) * (1 - fall) + 4.2 * fall;
    const J = {};
    J.hipC = [-1 - low, 0, hipZ];
    // the spine: a fixed length from the hips, tilted forward in the stalk, flat when low, upright when it rears
    const tilt = ((29 + 9 * run + 40 * low - 27 * rear - 10 * W.hurt + 9 * W.wound + 8 * W.drink) * (1 - fall) + 84 * fall) * E.DEG;   // fallen: flat on the floor
    J.shC = [J.hipC[0] + 9.4 * Math.sin(tilt), 0, hipZ + 9.4 * Math.cos(tilt) + breath * .5];
    const pitch = (-.35 * low + .55 * rear * (W.cheer ? 1 : .6) + .45 * W.hurt - .5 * W.drink - .25 * W.wound) * (1 - fall) - .55 * fall;   // the head's tilt (up is +)
    J.neck = V.add(J.shC, [2.2, 0, 2]);
    J.head = V.add(J.neck, [2.6 * Math.cos(pitch) + 1.2 * low, 0, 2.2 + 2.6 * Math.sin(pitch) - 1.2 * low]);
    const hd = [Math.cos(pitch), 0, Math.sin(pitch)], up = [-Math.sin(pitch), 0, Math.cos(pitch)];
    J.snout = V.add(J.head, V.add(V.mul(hd, 4.6), V.mul(up, -1.1)));
    J.crest = V.add(J.head, V.add(V.mul(hd, -2.4), V.mul(up, 6.5 + 1.5 * W.cheer)));
    this.hd = hd; this.up = up;
    // legs: hip, knee forward, hock back, the foot planted (reverse knees solved with two-bone IK to the hock)
    for (const sd of [-1, 1]) {
      const k = sd < 0 ? 'L' : 'R', p = ph + (sd > 0 ? Math.PI : 0), stride = 4.5 * run, spread = 4.4 + 1.2 * low;
      let foot = [.5 + Math.sin(p) * stride - low * .8, sd * spread, Math.max(0, Math.cos(p)) * 2.8 * run];
      const hip = [J.hipC[0], sd * 3.2, J.hipC[2]];
      foot = V.lerp(foot, [2.5, sd * 3.6, hipZ - 7], W.air);                                   // tucked in the air
      foot = V.lerp(foot, [J.hipC[0] - 1.5, sd * 8, 0], fall);                                   // splayed when it falls
      const ma = (33 + 22 * low) * E.DEG, hockT = V.add(foot, [-5.5 * Math.sin(ma), sd * .2, 5.5 * Math.cos(ma)]);   // the long foot bone: one length, flatter when it crouches
      const [knee, hock] = E.ik3(hip, hockT, 6.8, 6.4, [1, sd * .25, .3]);
      J['hip' + k] = hip; J['knee' + k] = knee; J['hock' + k] = hock; J['foot' + k] = V.add(hock, V.sub(foot, hockT));
    }
    // arms: the wrist (where the scythe grows) goes where the poses blend it, the elbow is solved by IK so the arm keeps
    // its length, and each blade's direction blends as two angles (its pitch and how far it turns out to the side), so
    // a blade never flips through the middle when two poses point opposite ways
    for (const sd of [-1, 1]) {
      const k = sd < 0 ? 'L' : 'R', sh = V.add(J.shC, [-.5, sd * 4.8, .4]), sw = sd > 0 ? this.swR : this.swL;
      let wr = [3.2, sd * 3, -7.2], pi = -65, ya = 17;   // at rest the blades hang forward, their tips near the floor
      const pose = (w, p, y, k2) => { if (k2 <= 0) return; wr = V.lerp(wr, [w[0], sd * w[1], w[2]], k2); pi = lerp(pi, p, k2); ya = lerp(ya, y, k2); };
      pose([4, 3.2, -5.5], -37, 18, W.ready * .7);                      // ready: tips raised forward
      pose([2.5, 9, 5.5], 53, 66, rear);                                // reared: spread wide
      pose([2, 6, 10], 75, 68, W.cheer * (1 - W.fall));                 // the roar: raised high
      pose([6.5, -.5, -1], 41, -70, W.guard);                           // crossed in front
      pose([-3.5, 3.2, -4], 9, 171, low);                               // swept back along the body
      pose([8, 3, 0], -18, 9, W.air);                                   // reaching forward in a leap
      pose([9.5, 2, -7.5], -62, -12, W.impale);                         // driven down into a foe
      pose([1.5, 10.5, -1.5], -6, 87, W.whirl);                         // held out flat for the whirl
      pose([4.5, 1.5, -3.5], -51, 10, W.drink * .8);                    // hunched over the draught
      if (sd > 0) pose([2.5, 5.5, 9.5], 60, 70 + 15 * Math.sin(t * 7), W.wave);   // a slow wave of one scythe
      if (sw < 0) pose([-1, 5.5, 8], 59, 119, -sw);                     // the swing: wound back and up,
      else if (sw > 0) pose([8.5, -2.5, -3], -18, -54, sw);             // then swept across and down past the body
      pose([5, 8, -2.5], -8, 62, fall);                                 // fallen: the scythes splayed on the floor
      const [el, hand] = E.ik3(sh, V.add(sh, wr), 6.4, 5.6, [-.6, sd * .8, -.25]);
      const P = pi * E.DEG, Y = ya * E.DEG, d = [Math.cos(P) * Math.cos(Y), sd * Math.cos(P) * Math.sin(Y), Math.sin(P)];
      J['sh' + k] = sh; J['elbow' + k] = el; J['hand' + k] = hand; J['dir' + k] = d;
      J['tip' + k] = V.add(hand, V.mul(d, this.o.bladeLen));
    }
    J.bladeDir = J.dirR;
    // the tail: five segments down to the floor, swaying against the hips; low it streams back, reared it props
    const sway = (1 + run) * (1 - W.fall), root = V.add(J.hipC, [-3, 0, -.5]);
    J.tail0 = root;
    for (let i = 1; i <= 5; i++) {
      const lat = Math.sin(t * 1.9 - i * .7 + ph * .5) * .38 * i * sway, drop = i * (1.9 - .9 * low - .2 * rear);
      const p = [root[0] - i * (3.1 + .5 * low), lat, Math.max(1, root[2] - drop)];
      J['tail' + i] = p;
    }
    if (fall > 0) for (const k in J) if (!/^dir|^bladeDir/.test(k) && J[k][2] < 0) J[k] = [J[k][0], J[k][1], 0];   // nothing sinks into the floor
    this.bones = DAN_BONES;
    this.J = J;
  }
  draw(g, ox, oy, sourceView) {
    const view = E.charView ? E.charView(sourceView) : sourceView, J = this.J, k = this.o.size * (view.scale || 1);   // (a zoomed view's scale carries the zoom)
    this._lastView = view;   // (rigScreen and held items project with it)
    const S = p => { const w = this._w(p), s = view.p(w[0], w[1], w[2]); return [ox + s[0], oy + s[1], view.depth(w[0], w[1], w[2])]; };
    const C = DAN_COL, ch = E.tones(C.chitin), un = E.tones(C.under), pl = E.tones(C.plate), bn = E.tones(C.bone), vn = E.tones(C.vein), parts = [];
    const add = (p, f) => parts.push({ d: p[2], f });
    const W1 = Math.max(1, Math.round(k * .8));
    // a limb: a tapered quad between two points with round ends, shaded, a lit line along its top
    const cap = (a, b, ra, rb, T, lit = true) => {
      const A = S(a), B = S(b), dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, r0 = ra * k, r1 = rb * k;
      add([(A[0] + B[0]) / 2, 0, (A[2] + B[2]) / 2], () => {
        px.poly(g, [[A[0] + nx * r0, A[1] + ny * r0], [B[0] + nx * r1, B[1] + ny * r1], [B[0] - nx * r1, B[1] - ny * r1], [A[0] - nx * r0, A[1] - ny * r0]], T.base);
        px.disc(g, A[0], A[1], r0, T.base); px.disc(g, B[0], B[1], r1, T.base);
        const sx = ny > 0 ? -1 : 1;   // the lit side faces up the screen
        if (lit && l > 2) px.line(g, A[0] + nx * r0 * .55 * sx, A[1] + ny * r0 * .55 * sx, B[0] + nx * r1 * .55 * sx, B[1] + ny * r1 * .55 * sx, T.lt);
        px.line(g, A[0] - nx * r0 * .7 * sx, A[1] - ny * r0 * .7 * sx, B[0] - nx * r1 * .7 * sx, B[1] - ny * r1 * .7 * sx, T.sh);
      });
    };
    // far-side limbs a tone darker: which side of the body is nearer the camera
    const nearR = S(J.shR)[2] > S(J.shL)[2], tone = sd => (sd > 0) === nearR ? ch : { base: ch.sh, lt: ch.base, sh: ch.deep, deep: ch.deep, hi: ch.lt };
    // the tail, thick to thin, a spike on each segment
    for (let i = 1; i <= 5; i++) {
      const a = J['tail' + (i - 1)], b = J['tail' + i], r0 = 2.7 - i * .42, r1 = 2.7 - (i + 1) * .42;
      cap(a, b, Math.max(.6, r0), Math.max(.45, r1), i < 2 ? ch : un);
      if (i < 5) { const m = S(E.V3.lerp(a, b, .5)), sp = S(E.V3.add(E.V3.lerp(a, b, .5), [-1.2, 0, 2.4 - i * .25])); add([0, 0, m[2] + .01], () => px.poly(g, [[m[0] - 1.2 * k, m[1]], [m[0] + 1.2 * k, m[1]], [sp[0], sp[1]]], pl.base)); }
    }
    // legs: thigh, shin, the long foot bone and three talons
    for (const sd of [-1, 1]) {
      const K = sd < 0 ? 'L' : 'R', T = tone(sd), hip = J['hip' + K], kn = J['knee' + K], hk = J['hock' + K], ft = J['foot' + K];
      const U = (sd > 0) === nearR ? un : { base: un.sh, lt: un.base, sh: un.deep, deep: un.deep, hi: un.lt };
      cap(hip, kn, 2.5, 1.7, T); cap(kn, hk, 1.6, 1.1, U); cap(hk, ft, 1.05, .85, U);
      cap(E.V3.lerp(hip, kn, .15), E.V3.lerp(hip, kn, .7), 1.5, 1, (sd > 0) === nearR ? pl : { base: pl.sh, lt: pl.base, sh: pl.deep, deep: pl.deep, hi: pl.lt });   // the thigh's plate
      { const a = S(E.V3.lerp(hip, kn, .2)), b = S(E.V3.lerp(hip, kn, .85)); add([0, 0, (a[2] + b[2]) / 2 + .01], () => px.line(g, a[0], a[1], b[0], b[1], vn.base)); }   // a violet vein down the thigh
      const F = S(ft);
      add([0, 0, F[2] + .02], () => {
        for (const [df, dr] of [[3, -1.4], [3.6, 0], [3, 1.4]]) { const tq = S(E.V3.add(ft, [df, sd * dr * .9, -.4])); px.line(g, F[0], F[1], tq[0], tq[1], bn.sh, W1); px.dot(g, tq[0], tq[1], bn.lt); }
        const sp = S(E.V3.add(hk, [-1.6, 0, -.6])), H = S(hk); px.line(g, H[0], H[1], sp[0], sp[1], bn.base, W1);   // the spur behind the hock
      });
    }
    // the abdomen and the egg sacs on each hip (the ripe ones swell and glow)
    const hipC = J.hipC, A0 = S(hipC);
    add(A0, () => { px.ell(g, A0[0], A0[1], 4.2 * k, 3.6 * k, un.base); px.ell(g, A0[0] - .8 * k, A0[1] - .9 * k, 2.6 * k, 2 * k, ch.base); px.line(g, A0[0] - 3 * k, A0[1] + 1.4 * k, A0[0] + 3 * k, A0[1] + 1.4 * k, un.sh); });
    const ripe = this.ripe;
    for (let i = 0; i < DAN_SACS; i++) {
      const sd = i % 2 ? 1 : -1, j = i >> 1, c = E.V3.add(hipC, [-1.2 + j * 1.5, sd * (4.4 + (j === 1 ? .9 : 0)), -1.6 + (j === 1 ? 1.4 : 0) - j * .3]);
      const P = S(c), full = clamp(ripe - i, 0, 1), r = (1.25 + .55 * full) * k, pulse = full > 0 ? .5 + .5 * Math.sin(this.t * 3 + i) : 0;
      add([0, 0, P[2] + .03], () => {
        px.disc(g, P[0], P[1], r, full > .5 ? E.mix(C.sac, C.ripe, full) : C.sac);
        px.disc(g, P[0] - r * .3, P[1] - r * .35, r * .45, full > .5 ? C.glow : vn.base);
        if (full > .5) px.blend(g, .25 + .2 * pulse, 'add', () => px.disc(g, P[0], P[1], r * 1.5, C.ripe));
      });
    }
    // the torso: a hunched carapace from the hips to the chest, ribbed, spines down the back
    const SC = S(J.shC), sL = S(J.shL), sR = S(J.shR), hL = S(J.hipL), hR = S(J.hipR);
    add([0, 0, (A0[2] + SC[2]) / 2], () => {
      px.poly(g, [[hL[0], hL[1]], [sL[0], sL[1]], [sR[0], sR[1]], [hR[0], hR[1]]], ch.base);
      px.poly(g, [[A0[0] - 3 * k, A0[1] - 1.2 * k], [SC[0] - 3.2 * k, SC[1] - 1.2 * k], [SC[0] + 2.4 * k, SC[1] - 2 * k], [A0[0] + 2.2 * k, A0[1] - 1.8 * k]], pl.base);
      px.poly(g, [[A0[0] - 1.6 * k, A0[1] - 1.8 * k], [SC[0] - 1.8 * k, SC[1] - 1.8 * k], [SC[0] + .6 * k, SC[1] - 2.2 * k], [A0[0] + .4 * k, A0[1] - 2 * k]], pl.lt);   // the lit ridge of the back plate
      for (let i = 1; i <= 3; i++) { const u = i / 4, a = [lerp(hL[0], sL[0], u), lerp(hL[1], sL[1], u)], b = [lerp(hR[0], sR[0], u), lerp(hR[1], sR[1], u)]; px.line(g, a[0], a[1], b[0], b[1], i === 2 ? vn.base : ch.sh); }
      px.line(g, (A0[0] + SC[0]) / 2, (A0[1] + SC[1]) / 2 + k, SC[0], SC[1] + 1.5 * k, vn.lt);   // the vein up the belly
      px.disc(g, SC[0], SC[1], 3.4 * k, ch.base); px.disc(g, SC[0] - .7 * k, SC[1] - .9 * k, 2 * k, pl.lt);
    });
    for (let i = 0; i < 6; i++) {   // the dorsal spines: a ridge from the tail root to the neck
      const u = i / 5, base = E.V3.add(E.V3.lerp(J.hipC, J.shC, u), [-1.2, 0, 2.2 + Math.sin(u * Math.PI) * .6]), len = 2.2 + Math.sin(u * Math.PI) * 1.8;
      const B = S(base), T = S(E.V3.add(base, [-1.3, 0, len])), a = S(E.V3.add(base, [.9, 0, 0])), b = S(E.V3.add(base, [-.9, 0, 0]));
      add([0, 0, B[2] - .05], () => { px.poly(g, [[a[0], a[1]], [T[0], T[1]], [b[0], b[1]]], pl.base); px.line(g, a[0], a[1], T[0], T[1], pl.lt); });
    }
    // the arms and the scythes: bone crescents bowing out from the body, a bright cutting edge
    for (const sd of [-1, 1]) {
      const K = sd < 0 ? 'L' : 'R', T = tone(sd), sh = J['sh' + K], el = J['elbow' + K], wr = J['hand' + K], tp = J['tip' + K];
      cap(sh, el, 1.9, 1.5, T); cap(el, wr, 1.5, 1.7, T);
      cap(E.V3.lerp(el, wr, .25), E.V3.lerp(el, wr, .85), 1, 1.1, (sd > 0) === nearR ? pl : { base: pl.sh, lt: pl.base, sh: pl.deep, deep: pl.deep, hi: pl.lt });   // the forearm's plate
      const Wp = S(wr), Tp = S(tp), mid = S(E.V3.lerp(wr, tp, .5)), body = S(J.shC);
      add([0, 0, Math.max(Wp[2], Tp[2]) + .01], () => {
        const dx = Tp[0] - Wp[0], dy = Tp[1] - Wp[1], l = Math.hypot(dx, dy) || 1; let nx = -dy / l, ny = dx / l;
        if ((mid[0] - body[0]) * nx + (mid[1] - body[1]) * ny < 0) { nx = -nx; ny = -ny; }   // bow outward, away from the body
        const bow = l * .2, out = [], inn = [];
        for (let i = 0; i <= 8; i++) {
          const u = i / 8, cx = Wp[0] + dx * u + nx * bow * 4 * u * (1 - u), cy = Wp[1] + dy * u + ny * bow * 4 * u * (1 - u), w = (1.7 * k) * (1 - u) + .3;
          out.push([cx + nx * w, cy + ny * w]); inn.push([cx - nx * w * .35, cy - ny * w * .35]);
        }
        px.poly(g, out.concat(inn.slice().reverse()), bn.base);
        for (let i = 1; i < out.length; i++) px.line(g, out[i - 1][0], out[i - 1][1], out[i][0], out[i][1], bn.sh);
        for (let i = 1; i < inn.length; i++) px.line(g, inn[i - 1][0], inn[i - 1][1], inn[i][0], inn[i][1], bn.hi);
        px.disc(g, Wp[0], Wp[1], 1.5 * k, T.base); px.dot(g, Wp[0], Wp[1], vn.lt);   // the knuckle the blade grows from
      });
    }
    // the head: a long skull, a crown of horns, violet eyes, tendrils under the jaw
    const Hh = S(J.head), Sn = S(J.snout), Cr = S(J.crest), hd = this.hd, up = this.up;
    add([0, 0, Hh[2] + .05], () => {
      const side = (sd, f, u) => S(E.V3.add(J.head, E.V3.add(E.V3.add(E.V3.mul(hd, f), E.V3.mul(up, u)), [0, sd, 0])));
      for (const sd of [-1.6, 0, 1.6]) {   // the crown: three horns sweeping up and back, the middle one tallest
        const base = side(sd * .8, -.6, 1.6), top = sd ? side(sd * 1.6, -3.2, 5 + this.W.cheer) : Cr, b2 = side(sd * .8, 1, 2);
        px.poly(g, [[base[0], base[1]], [top[0], top[1]], [b2[0], b2[1]]], sd ? pl.sh : pl.base); px.line(g, base[0], base[1], top[0], top[1], pl.lt);
      }
      const jaw = side(0, 3.4, -1.8), back = side(0, -2.2, .4);
      px.poly(g, [[back[0], back[1] - 2.2 * k], [Sn[0], Sn[1]], [jaw[0], jaw[1]], [back[0], back[1] + 2 * k]], ch.base);
      px.disc(g, Hh[0], Hh[1], 2.4 * k, ch.base); px.disc(g, Hh[0] - .6 * k, Hh[1] - .8 * k, 1.3 * k, pl.lt);
      px.line(g, Hh[0], Hh[1] - 1.6 * k, Sn[0], Sn[1], pl.base);
      const facing = S(E.V3.add(J.head, E.V3.mul(hd, 3)))[2] >= Hh[2] - .2;
      if (facing) for (const sd of [-1, 1]) { const e = side(sd * 1.2, 2.2, .7), r = Math.max(1, Math.round(k * .7)); px.rect(g, e[0] - r / 2, e[1] - r / 2, r + (sd > 0 ? 1 : 0), r, C.eye); }
      const wig = this.t * 6, open = .5 + .6 * this.W.cheer + .5 * this.W.rear;   // the tendrils of the maw (they fan out when it roars)
      for (let i = -1; i <= 1; i++) { const a = side(i * .6, 3, -1.6), b = side(i * (.9 + open), 3.4 + Math.sin(wig + i) * .4, -3.6 - open * 1.4); px.line(g, a[0], a[1], b[0], b[1], this.W.drink > .3 ? C.blood : C.tendril); }
    });
    parts.sort((a, b) => a.d - b.d);
    for (const p of parts) p.f();
  }
  /** the scythes' trails: whichever blade is sweeping leaves a crescent of light */
  drawSmear(r, colors) {
    const s = this.state, st = s.attack, active = st && st.phase === 'active';
    if (!active && !(s.dan === 'pounce' || s.dan === 'impale')) { this.trail.length = 0; return; }
    const spec = st && st.spec, both = !spec || spec.hand === 'both' || spec.danBoth || spec.spin, sides = both ? ['L', 'R'] : [spec.hand === 'L' ? 'L' : 'R'];
    this.trail.unshift(sides.map(sd => this.tip(sd))); this.trail.length = Math.min(6, this.trail.length);
    const cols = Array.isArray(colors) ? colors : ['#ffffff', '#f0e4ff', '#c890ff', '#7a3aa8'];
    for (let i = 1; i < this.trail.length; i++) for (let j = 0; j < sides.length; j++) {
      const a = this.trail[i - 1][j], b = this.trail[i][j]; if (!a || !b || Math.hypot(a[0] - b[0], a[1] - b[1]) > 40) continue;
      r.queue(a[0], a[1], a[2], g => px.line(g, ...r.w(...a), ...r.w(...b), cols[Math.min(cols.length - 1, i - 1)], i < 3 ? 2 : 1), { emissive: true });
    }
  }
  drawPortrait(g, x, y, size = 40) { this.draw(g, x + size / 2, y + size * 1.25, new E.View('portrait', 'Dan', 0, 15, size / 34)); }
}

/* =============================================================================
 * THE BROOD: six egg sacs on its hips. Every kill Dan makes ripens one (h.brood, 0..6); Hatch spends them as
 * broodlings, Brood Burst as a void blast. Kills by its broodlings do not ripen more (the brood feeds on its hunt).
 * ============================================================================= */
const DAN_isMe = h => !!(h && h === ED.hero && h.character === 'dan');
function DAN_ripen(h, n = 1) {
  const was = h.brood || 0; h.brood = Math.min(DAN_SACS, was + n); if (h.brood === was) return;
  sfx('bloop', { pitch: 1.3 + h.brood * .08, vol: .4 }); P.glints(h.x, h.y, 10, 4, DAN_COL.glow, 8);
  if (h.brood === DAN_SACS) { P.text(h.x, h.y, 40, 'BROOD RIPE', DAN_COL.glow); sfx('chime', { pitch: .8, vol: .3 }); }
}
BUS.on('kill', e => { const h = ED.hero; if (DAN_isMe(h) && e.src === h && !(e.hit && e.hit.brood)) DAN_ripen(h); });
BUS.on('heroDie', ({ h }) => { if (h && h.character === 'dan') h.brood = 0; });
// the brood on the HUD: six eggs over the skill bar's right end, lit as they ripen
BUS.on('draw', ({ r }) => {
  const h = ED.hero; if (!DAN_isMe(h) || UI.hideHud || ED.mode === 'gallery') return;
  r.overlay(g => {
    const f = HUD_in(g, r);
    try {
      const x = f.W - 92, y = f.H - 45;
      for (let i = 0; i < DAN_SACS; i++) { const lit = i < h.brood, cx = x + i * 7; px.ell(g, cx, y, 2.5, 3.2, lit ? DAN_COL.ripe : '#3a2c46'); px.dot(g, cx - 1, y - 1, lit ? DAN_COL.glow : '#5a4a66'); }
      E.font.text(g, 'BROOD', x + 17, y + 6, DAN_COL.glow, { font: 'tiny', align: 'center' });
    } finally { HUD_out(g); }
  });
});

/* ---------- the broodlings: hatched from the sacs, they skitter to the nearest foe and bite, then burst ---------- */
const DAN_BROOD = { speed: 118, life: 7, bite: .55, reach: 8 };
function DAN_broodling(h, ctx, x, y, a) {
  const vol = ctx.rune === 'volatile', b = { kind: 'broodling', team: 'hero', alive: true, targetable: false, x, y, z: 0, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, r: 2.5,
    facing: a, t: 0, life: DAN_BROOD.life + Math.random(), cool: .3 + Math.random() * .3, tgt: null, owner: h, ctx, ph: Math.random() * 6,
    update(dt) { return DAN_broodStep(this, dt); }, draw(r) { DAN_broodDraw(this, r); } };
  b.vol = vol; ED.allies.push(b); return b;
}
function DAN_broodStep(b, dt) {
  const h = b.owner; b.t += dt; b.cool -= dt; b.ph += dt * 18;
  if (!h || !h.alive || h !== ED.hero) b.life = Math.min(b.life, b.t);   // it dies with the one that hatched it
  if (b.t >= b.life) { DAN_broodPop(b); return false; }
  if (!b.tgt || !b.tgt.alive || (b.t * 3 | 0) !== b.tt) { b.tt = b.t * 3 | 0; b.tgt = nearestEnemy('hero', b.x, b.y, 150); }
  let want = [0, 0];
  if (b.tgt) {
    const dx = b.tgt.x - b.x, dy = b.tgt.y - b.y, d = Math.hypot(dx, dy) || 1, stand = (b.tgt.r || 4) + b.r + 1;
    b.facing = E.approachAng(b.facing, Math.atan2(dy, dx), dt * 16);
    if (d > stand) want = [dx / d * DAN_BROOD.speed, dy / d * DAN_BROOD.speed];
    else if (b.cool <= 0) {   // a bite: a lunge onto the foe and a void sting
      b.cool = DAN_BROOD.bite; b.vx += Math.cos(b.facing) * 60; b.vy += Math.sin(b.facing) * 60; b.z = 2.5;
      dealDamage(b.tgt, b.ctx.hit(.45, { el: 'void', tags: ['summon', 'melee'], kb: 30, extra: { ang: b.facing, brood: true } }));
      P.sparks(b.tgt.x, b.tgt.y, 8, 4, b.facing, { color: DAN_COL.ripe, hot: DAN_COL.glow }); sfx('hit', { vol: .2, pitch: 1.7 });
    }
  } else if (h) { const dx = h.x - b.x, dy = h.y - b.y, d = Math.hypot(dx, dy); if (d > 22) want = [dx / d * DAN_BROOD.speed * .8, dy / d * DAN_BROOD.speed * .8]; }
  b.vx = approach(b.vx, want[0], 700 * dt); b.vy = approach(b.vy, want[1], 700 * dt);
  b.x += b.vx * dt; b.y += b.vy * dt; collideUnit(b); b.z = Math.max(0, b.z - dt * 20);
  return true;
}
function DAN_broodPop(b) {
  const big = b.vol, ctx = b.ctx;
  FX.nova({ team: 'hero', src: b.owner, x: b.x, y: b.y, r0: 2, r1: big ? 30 : 16, dur: .22, el: 'void', color: DAN_COL.ripe, tags: ['summon', 'aoe'], hit: ctx.hit(big ? 1.1 : .5, { el: 'void', kb: 60, extra: { brood: true } }) });
  P.bits(b.x, b.y, 4, 6, [DAN_COL.sac, DAN_COL.ripe, DAN_COL.glow]); sfx('bloop', { pitch: .8, vol: .3 });
}
function DAN_broodDraw(b, r) {
  const fade = Math.min(1, b.t * 5, (b.life - b.t) * 3);
  r.shadow(b.x, b.y, 2.6, .45);
  r.actor(b.x, b.y, b.z, (g, ox, oy) => {
    const v = r.view, k = v.scale || 1, P = (f, rr, z) => { const c = Math.cos(b.facing), s = Math.sin(b.facing), p = v.p(f * c - rr * s, f * s + rr * c, z); return [ox + p[0], oy + p[1]]; };
    for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) {   // six legs, twitching in the gait
      const f0 = 1 - i * 1.2, wig = Math.sin(b.ph + i * 2 + (sd > 0 ? 3 : 0)) * .8, a = P(f0, sd * 1.2, 1.4), e = P(f0 + .8 + wig, sd * 3.2, 0);
      px.line(g, a[0], a[1], e[0], e[1], '#2a2430');
    }
    const c = P(0, 0, 1.8), hd = P(2.2, 0, 1.6);
    px.ell(g, c[0], c[1], 2.6 * k, 1.8 * k, DAN_COL.sac); px.disc(g, c[0] - .5, c[1] - .6, 1.1 * k, DAN_COL.ripe); px.dot(g, c[0] - .8, c[1] - 1, DAN_COL.glow);
    px.disc(g, hd[0], hd[1], 1.1 * k, '#3a2c46');
    for (const sd of [-1, 1]) { const m = P(3.6, sd * .9, 1.4); px.line(g, hd[0], hd[1], m[0], m[1], DAN_COL.bone); }   // mandibles
  }, { alpha: fade });
}

/* ---------- its skills: the scythes, the pounce, the whirl, and the brood's two ways out ---------- */
const DAN_MOVE = (base, over) => Object.assign({ name: base, hitAt: .35, wind: .07, active: .1, recover: .2 }, E.MOVES[base] || E.MOVES.slash, over);
const DAN_REAP = [DAN_MOVE('slash', { name: 'dan_cut', hand: 'R', wind: .08, recover: .22 }), DAN_MOVE('backslash', { name: 'dan_cut2', hand: 'L', wind: .07, recover: .22 }),
  DAN_MOVE('overhead', { name: 'dan_scissor', hand: 'both', danBoth: true, wind: .13, active: .12, recover: .32 })];
const DAN_HIT = { dan_cut: { range: 32, half: 1.3, dmg: 1, kb: 80 }, dan_cut2: { range: 32, half: 1.3, dmg: 1, kb: 80 }, dan_scissor: { range: 36, half: 1.7, dmg: 1.7, kb: 220, big: true } };
const DAN_WHIRL = { name: 'dan_whirl', hand: 'both', spin: 2, wind: .12, active: .6, recover: .25 };
/** a cut landing: bone sparks and a violet sting, heavier for the big ones */
function DAN_cutFx(h, u, big) {
  const a = angTo(h, u), x = lerp(h.x, u.x, .7), y = lerp(h.y, u.y, .7);
  game.freeze(big ? .06 : .035); shake(big ? 3.5 : 2); P.sparks(x, y, 12, big ? 12 : 7, a, { color: DAN_COL.bone, hot: '#ffffff' }); P.impact(x, y, 13, big ? 9 : 6, DAN_COL.glow);
  sfx(big ? 'crack' : 'slash2', { vol: .55 }); sfx('hit', { vol: .45 });
}
/** icons: a scythe crescent, eggs, claws (16 x 16 at scale s) */
const DAN_ICON = {
  scythe(g, x, y, s, flip) { for (let i = 0; i <= 10; i++) { const u = i / 10, a = (flip ? 1 : -1) * (.6 + u * 1.9), rr = 6.5 * s; px.rect(g, x + 8 * s + Math.cos(a) * rr * (flip ? -1 : 1), y + 9 * s + Math.sin(a) * rr * .9, Math.max(1, s * (1.6 - u)), Math.max(1, s * (1.6 - u)), i > 7 ? '#ffffff' : DAN_COL.bone); } },
  eggs(g, x, y, s, n = 3) { for (let i = 0; i < n; i++) { const cx = x + (4 + i * 4) * s, cy = y + (10 - (i % 2) * 3) * s; px.ell(g, cx, cy, 2 * s, 2.6 * s, DAN_COL.ripe); px.dot(g, cx - s * .6, cy - s, DAN_COL.glow); } }
};

def('skills', 'dan_reap', {
  name: 'Reap', kind: 'basic', tags: ['melee', 'attack'], el: 'phys', cost: 0, gen: 6, unlock: 1, color: '#4a3a5a', character: 'dan',
  runes: [{ id: 'rend', name: 'Rending Reap', desc: 'Every cut makes the enemy bleed.' }, { id: 'gorge', name: 'Gorge', desc: 'The scissor cut heals 2% of your life for each enemy it hits.' }],
  desc: (rank, rune) => 'Right scythe, left scythe, then both together in a scissor cut that hurls enemies back. Each press chains the next. Generates Ember.' +
    (rune === 'rend' ? ' Cuts cause bleeding.' : rune === 'gorge' ? ' The scissor heals you.' : ''),
  icon: (g, x, y, s) => { DAN_ICON.scythe(g, x, y, s, false); DAN_ICON.scythe(g, x - 2 * s, y - s, s, true); },
  combo: null,
  cast(h, ctx) {
    const self = this; h.facing = h.aim;
    const combo = comboResume(self, ctx.rune || '', () => new E.Combo(DAN_REAP.map(m => new E.Attack(m)), { window: .32 }));
    combo.press();
    const act = swingAction(h, combo, { name: 'dan_reap', range: spec => (DAN_HIT[spec.name] || DAN_HIT.dan_cut).range * (spec.name === 'dan_scissor' ? ctx.area : 1), half: spec => (DAN_HIT[spec.name] || DAN_HIT.dan_cut).half, push: 60,
      hit: (u, spec) => { const b = DAN_HIT[(spec || combo.current.spec).name] || DAN_HIT.dan_cut; return ctx.hit(b.dmg, { kb: b.kb, extra: { ang: angTo(h, u), status: ctx.rune === 'rend' ? 'bleed' : undefined, statusChance: ctx.rune === 'rend' ? 1 : undefined } }); },
      onHit: u => { const big = combo.current && combo.current.spec.name === 'dan_scissor'; DAN_cutFx(h, u, big); if (big && ctx.rune === 'gorge') h.hp = Math.min(h.maxHp, h.hp + h.maxHp * .02); },
      onStrike(a) { a.set.clear(); if (combo.current.spec.name === 'dan_scissor') { h.vx += Math.cos(h.facing) * 70; h.vy += Math.sin(h.facing) * 70; } } });
    act.combo = combo; act.end = () => comboLeft(self);
    return act;
  },
  again(h, act) { if (!act.combo) return false; if (act.combo.press()) { act.face = h.aim; h.facing = h.aim; act.gained = 0; return true; } return false; }
});

def('skills', 'dan_pounce', {
  name: 'Pounce', kind: 'mobility', tags: ['melee', 'attack', 'movement'], el: 'phys', cost: 10, cd: 4, unlock: 1, color: '#3a2a4a', character: 'dan',
  runes: [{ id: 'rake', name: 'Rake', desc: 'The landing rakes everything around it, and they bleed.' }, { id: 'stalk', name: 'Stalker', desc: 'Leaps a third farther, and the cooldown is 1.5 s shorter.' }],
  desc: (rank, rune) => 'Coil and leap at the cursor, then drive both scythes down where it lands: a heavy impaling blow that stuns. Untouchable in the air.' +
    (rune === 'rake' ? ' The landing rakes all around.' : rune === 'stalk' ? ' Farther, and sooner again.' : ''),
  icon: (g, x, y, s) => { for (let i = 0; i <= 8; i++) { const u = i / 8; px.rect(g, x + (2 + u * 10) * s, y + (13 - Math.sin(u * Math.PI) * 9) * s, Math.max(1, s), Math.max(1, s), i > 5 ? '#ffffff' : '#a898b8'); } DAN_ICON.scythe(g, x + 3 * s, y + 2 * s, s * .8, false); },
  cast(h, ctx) {
    const stalk = ctx.rune === 'stalk', maxD = (100 + ctx.rank * 3) * (stalk ? 1.33 : 1), a = Math.atan2(ctx.ty - h.y, ctx.tx - h.x);
    if (stalk) h.cds.dan_pounce = Math.max(0, (h.cds.dan_pounce || 0) - 1.5);
    let d = clamp(Math.hypot(ctx.tx - h.x, ctx.ty - h.y), 0, maxD);
    while (d > 0 && !SKM_open(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d)) d -= 4;   // land on open floor
    const F = .3 + d / 500, H = 14 + d * .12, COIL = .12, LAND = .38, set = new Set();
    let phase = 'coil', pt = 0, sx = 0, sy = 0, lx = 0, ly = 0;
    h.facing = a;
    const land = () => {
      const R = (ctx.rune === 'rake' ? 30 : 18) * ctx.area;
      hitCone('hero', h.x, h.y, a, 26, 1.1, u => ctx.hit(2.2, { kb: 120, extra: { ang: angTo(h, u), stun: .55 } }), set);
      hitCircle('hero', h.x, h.y, R, u => ctx.hit(ctx.rune === 'rake' ? 1.1 : .7, { kb: 140, extra: { ang: angTo(h, u), status: ctx.rune === 'rake' ? 'bleed' : undefined, statusChance: ctx.rune === 'rake' ? 1 : undefined } }), set);
      game.freeze(.07); shake(5); sfx('crack', { vol: .7 }); sfx('thud'); h.rig.kick(-6);
      SKM_dustRing(h.x, h.y, 16, 90); P.ring(h.x, h.y, 4, R + 14, DAN_COL.glow, .4); P.impact(h.x + Math.cos(a) * 9, h.y + Math.sin(a) * 9, 3, 9, DAN_COL.glow);
      FX.scorch(h.x + Math.cos(a) * 8, h.y + Math.sin(a) * 8, 10, '#1a1016', 2.5);
    };
    return SKM_act(h, { name: 'dan_pounce', moveK: 0, face: a, cancel: false, interrupt: false, speed: h.atkMul, rig: { dan: 'coil' },
      update(dt) {
        pt += dt; this.t += dt;
        if (phase === 'coil') { if (pt >= COIL) { phase = 'fly'; pt = 0; sx = lx = h.x; sy = ly = h.y; this.rig = { dan: 'pounce', air: true }; h.rig.kick(6); sfx('whoosh', { vol: .8, pitch: .8 }); SKM_dustRing(h.x, h.y, 10, 50); } return true; }
        if (phase === 'fly') {
          const u = Math.min(1, pt / F), tx = sx + Math.cos(a) * d * u, ty = sy + Math.sin(a) * d * u;
          h.x += tx - lx; h.y += ty - ly; lx = tx; ly = ty; h.vx = h.vy = 0;   // moved by the delta, so walls still stop it
          this.z = 4 * H * u * (1 - u) + 1; h.inv = Math.max(h.inv, .12); this.ghost = u > .4 ? DAN_COL.ripe : null;
          if (u >= 1) { phase = 'land'; pt = 0; this.z = 0; this.ghost = null; this.rig = { dan: 'impale' }; this.cancel = true; land(); }
          return true;
        }
        if (pt > .22) this.rig = { dan: null }; this.free = pt > .2;
        return pt < LAND;
      } });
  }
});

def('skills', 'dan_whirl', {
  name: 'Harvest Whirl', kind: 'core', tags: ['melee', 'attack', 'aoe'], el: 'phys', cost: 14, unlock: 1, color: '#3a3a5a', character: 'dan',
  runes: [{ id: 'vortex', name: 'Vortex', desc: 'The whirl drags nearby enemies in toward the blades.' }, { id: 'harvest', name: 'Harvest', desc: 'Each kill of the whirl ripens a second sac.' }],
  desc: (rank, rune) => 'Two turns with both scythes held out flat, cutting everything around four times for 60% weapon damage each.' + (rune === 'vortex' ? ' It drags enemies in.' : rune === 'harvest' ? ' Its kills ripen twice.' : ''),
  icon: (g, x, y, s) => { for (let i = 0; i < 18; i++) { const a = i * .55, rr = 1.5 + i * .33; px.rect(g, x + (8 + Math.cos(a) * rr) * s, y + (8 + Math.sin(a) * rr * .8) * s, Math.max(1, s), Math.max(1, s), i > 12 ? '#ffffff' : DAN_COL.bone); } },
  cast(h, ctx) {
    const R = 34 * ctx.area, atk = new E.Attack(DAN_WHIRL); atk.start(); h.facing = h.aim;
    let tick = 0, n = 0;
    const kill = e => { if (ctx.rune === 'harvest' && e.src === h && act === h.act) DAN_ripen(h); };
    BUS.on('kill', kill);
    const act = SKM_act(h, { name: 'dan_whirl', moveK: .45, face: null, interrupt: false, speed: h.atkMul, rig: { attack: null },
      update(dt) {
        atk.update(dt); this.rig.attack = atk.state; const st = atk.state;
        if (st && st.phase === 'active' && (tick -= dt) <= 0 && n < 4) {
          tick = DAN_WHIRL.active / 4; n++;
          hitCircle('hero', h.x, h.y, R, u => { DAN_cutFx(h, u, false); return ctx.hit(.6, { kb: 70, extra: { ang: angTo(h, u) + .9 } }); });
          sfx('whoosh', { vol: .45, pitch: 1 + n * .08 });
          if (ctx.rune === 'vortex') eachEnemy('hero', h.x, h.y, R * 2.2, u => { if (u.boss) return; const a2 = angTo(u, h), d = Math.hypot(h.x - u.x, h.y - u.y); if (d > R * .5) { u.x += Math.cos(a2) * 6; u.y += Math.sin(a2) * 6; } });
        }
        this.free = !st || st.phase === 'recover';
        return atk.busy;
      },
      end() { BUS.off('kill', kill); },
      draw(r) { const st = atk.state; if (!st || st.phase !== 'active') return; r.decal(() => r.groundRing(h.x, h.y, R * .8, DAN_COL.bone, .35), { emissive: .4 }); } });
    return act;
  }
});

def('skills', 'dan_hatch', {
  name: 'Hatch', kind: 'core', tags: ['spell', 'summon'], el: 'void', cost: 6, cd: 1.5, unlock: 1, color: '#4a2a5a', character: 'dan', bot: { ready: h => (h.brood || 0) > 0 },
  runes: [{ id: 'swarm', name: 'Swarm', desc: 'Two more broodlings hatch with the brood.' }, { id: 'volatile', name: 'Volatile', desc: 'Broodlings burst twice as hard when they die.' }],
  desc: (rank, rune) => 'Spend every ripe sac: each one bursts into a broodling that hunts the nearest enemy, bites with void, and bursts when its seven seconds are up. Kills ripen sacs.' +
    (rune === 'swarm' ? ' Two more hatch.' : rune === 'volatile' ? ' Their bursts are twice as strong.' : ''),
  icon: (g, x, y, s) => { DAN_ICON.eggs(g, x, y, s, 3); px.line(g, x + 6 * s, y + 4 * s, x + 9 * s, y + 8 * s, '#ffffff'); },
  cast(h, ctx) {
    const n = (h.brood || 0) + (ctx.rune === 'swarm' ? 2 : 0);
    if (!(h.brood > 0)) { notify('NO RIPE BROOD: KILLS RIPEN IT', DAN_COL.glow, 1.2); return null; }
    h.facing = h.aim; let done = false;
    return SKM_act(h, { name: 'dan_hatch', moveK: .3, cancel: true, rig: { dan: 'hatch' }, dur: .45,
      update(dt) {
        this.t += dt;
        if (!done && this.t > .22) {
          done = true; h.brood = 0; sfx('bloop', { pitch: .7, vol: .6 }); sfx('crack', { vol: .4, pitch: 1.4 });
          for (let i = 0; i < n; i++) { const a = h.facing + Math.PI + (i - (n - 1) / 2) * .55, side = i % 2 ? 1 : -1, x = h.x + Math.cos(h.facing + side * 1.7) * 5, y = h.y + Math.sin(h.facing + side * 1.7) * 5; DAN_broodling(h, ctx, x, y, a + Math.PI); P.bits(x, y, 6, 4, [DAN_COL.sac, DAN_COL.ripe]); }
          P.ring(h.x, h.y, 3, 26, DAN_COL.ripe, .35);
        }
        this.free = this.t > .3;
        return this.t < this.dur;
      } });
  }
});

def('skills', 'dan_frenzy', {
  name: 'Frenzy', kind: 'core', tags: ['buff'], el: 'phys', cost: 18, cd: 10, unlock: 1, color: '#5a2a3a', character: 'dan',
  runes: [{ id: 'bloodlust', name: 'Bloodlust', desc: 'The frenzy lasts three seconds longer.' }, { id: 'howl', name: 'Howl', desc: 'The roar stuns enemies close by.' }],
  desc: (rank, rune) => 'Rear up and roar: for six seconds it attacks ' + (30 + rank * 5) + '% faster, moves 15% faster and leeches 3% of its damage as life.' +
    (rune === 'bloodlust' ? ' It lasts three seconds longer.' : rune === 'howl' ? ' The roar stuns those close.' : ''),
  icon: (g, x, y, s) => { for (const [dx, dy] of [[-4, -1], [0, -2], [4, -1]]) px.line(g, x + 8 * s, y + 11 * s, x + (8 + dx) * s, y + (5 + dy) * s, '#ff6a7a', Math.max(1, s)); px.disc(g, x + 8 * s, y + 11 * s, 2.5 * s, DAN_COL.blood); },
  cast(h, ctx) {
    let done = false;
    return SKM_act(h, { name: 'dan_frenzy', moveK: .2, cancel: true, rig: { dan: 'roar' }, dur: .55,
      update(dt) {
        this.t += dt;
        if (!done && this.t > .15) {
          done = true; sfx('roar', { vol: .7, pitch: 1.2 }); shake(3); P.ring(h.x, h.y, 4, 40, DAN_COL.blood, .45);
          h.buffs = h.buffs.filter(b => b.id !== 'dan_frenzy');
          h.buffs.push({ id: 'dan_frenzy', name: 'Frenzy', color: DAN_COL.blood, glyph: 'up', t: ctx.rune === 'bloodlust' ? 9 : 6, stats: { atkSpeed: 30 + ctx.rank * 5, moveSpeed: 15, leech: 3 } });
          computeStats(h);
          if (ctx.rune === 'howl') hitCircle('hero', h.x, h.y, 46 * ctx.area, u => ctx.hit(.2, { kb: 90, extra: { ang: angTo(h, u), stun: .9 } }));
        }
        this.free = this.t > .4;
        return this.t < this.dur;
      } });
  }
});

def('skills', 'dan_burst', {
  name: 'Brood Burst', kind: 'ultimate', tags: ['spell', 'aoe'], el: 'void', cost: 20, cd: 8, unlock: 1, color: '#3a1a4a', character: 'dan', bot: { ready: h => (h.brood || 0) >= 2 },
  runes: [{ id: 'venom', name: 'Venom Brood', desc: 'The burst leaves a pool of venom for three seconds.' }, { id: 'rupture', name: 'Rupture', desc: 'The burst deals 40% more damage.' }],
  desc: (rank, rune) => 'Rupture every ripe sac at once: a void blast around it that grows with the brood (more damage and reach for each sac) and hurls enemies away.' +
    (rune === 'venom' ? ' Leaves a venom pool.' : rune === 'rupture' ? ' 40% more damage.' : ''),
  icon: (g, x, y, s) => { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; px.line(g, x + 8 * s, y + 8 * s, x + (8 + Math.cos(a) * 6.5) * s, y + (8 + Math.sin(a) * 6.5) * s, i % 2 ? DAN_COL.glow : DAN_COL.ripe, Math.max(1, s)); } px.disc(g, x + 8 * s, y + 8 * s, 2.5 * s, '#ffffff'); },
  cast(h, ctx) {
    const n = h.brood || 0;
    if (n <= 0) { notify('NO RIPE BROOD: KILLS RIPEN IT', DAN_COL.glow, 1.2); return null; }
    let done = false;
    return SKM_act(h, { name: 'dan_burst', moveK: .1, cancel: false, rig: { dan: 'burst' }, dur: .6,
      update(dt) {
        this.t += dt;
        if (!done && this.t > .28) {
          done = true; h.brood = 0;
          const R = (40 + 8 * n) * ctx.area, k = (.9 + .4 * n) * (ctx.rune === 'rupture' ? 1.4 : 1);
          FX.nova({ team: 'hero', src: h, x: h.x, y: h.y, r0: 6, r1: R, dur: .38, el: 'void', color: DAN_COL.ripe, hit: ctx.hit(k, { el: 'void', kb: 220, extra: { up: 90 } }) });
          for (let i = 0; i < n; i++) { const a = i / n * TAU + Math.random() * .4, d = R * (.35 + Math.random() * .35); P.bits(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, 6, 6, [DAN_COL.sac, DAN_COL.ripe, DAN_COL.glow]); }
          if (ctx.rune === 'venom') FX.area({ team: 'hero', src: h, x: h.x, y: h.y, r: R * .6, dur: 3, tick: .5, el: 'venom', hit: ctx.hit(.25, { el: 'venom', tags: ['aoe', 'dot'] }) });
          game.freeze(.08); shake(7); game.flash(DAN_COL.ripe, .12, .35); sfx('roar', { vol: .5, pitch: 1.6 }); sfx('bloop', { pitch: .5, vol: .7 }); h.rig.kick(-5);
        }
        this.free = this.t > .45;
        return this.t < this.dur;
      } });
  }
});

/* ---------- the character ---------- */
def('characters', 'dan', {
  name: 'Dan', title: 'The Brood-Scythe', color: '#c890ff',
  desc: 'A thing the deep grew to harvest the deep. Two scythes of bone, a crown of horns, and a brood that ripens on its hips with every kill.',
  style: 'Stalking crouch · scythe combos · a brood that hatches',
  skills: ['dan_reap', 'dan_pounce', 'dan_whirl', 'dan_hatch', 'dan_frenzy', 'dan_burst'],
  speed: 90, acceleration: 1300, dodgeTime: .24, dodgeSpeed: 270,
  head: 34, r: 5,   // (its hitbox is slimmer than its silhouette, like Codex's: a looming body that rolls out of a boss's blows)
  stats(h, add) { add('life', 30); add('lifeOnKill', 2); add('atkSpeed', 8); },
  init(h) { h.brood = 0; },
  prime(h) { h.brood = DAN_SACS; },   // a ripe brood for the gallery, Tools' unlimited resources and the tests
  kit(h) {   // the scythes are its own forearms; the starting gear is named for the carapace it grows
    h.gear.weapon.name = 'Bone Scythes'; h.gear.chest.name = 'Brood Carapace'; h.gear.boots.name = 'Talons'; h.gear.cloak.name = 'Membrane';
  },
  rig: h => new DanRig(h),
  ownLayers: true,   // it skitters low for the dodge, hunches over the draught and sags when wounded on its own
  clips: false,      // its body is no person's: the captured clips are for the Humanoid
  dropIn(h, from) {   // it drops in curled, lands in a crouch and roars
    return startAction(h, { name: 'dropin', cancel: false, moveK: 0, rig: { air: true }, zz: from, vz: 0,
      update(dt) {
        if (this.zz > 0) { this.vz -= 520 * dt; this.zz = Math.max(0, this.zz + this.vz * dt); this.z = this.zz; if (this.zz <= 0) { this.land = .7; P.dust(h.x, h.y, 0, 16, { speed: 80 }); P.ring(h.x, h.y, 4, 32, DAN_COL.glow, .35); shake(5); sfx('thud'); sfx('crack', { vol: .5, pitch: .7 }); h.rig.kick(-8); } return true; }
        // the landing holds it as long as the Wanderer's crouch; the roar after it is a follow-through: moving ends it
        this.z = 0; this.land -= dt; this.rig = this.land > .35 ? { dan: 'coil' } : { dan: 'roar' };
        if (this.land < .35 && !this.roared) { this.roared = true; this.free = true; this.cancel = true; sfx('roar', { vol: .45 }); }
        return this.land > 0;
      } });
  },
  titlePose(t) {   // the title's 12 s: it stalks, whets its scythes, coils, then rears and roars
    const k = t % 12;
    if (k >= 3.2 && k < 5.6) { const j = Math.floor((k - 3.2) / .6), x = ((k - 3.2) % .6) / .6, spec = DAN_REAP[j % 2], tot = spec.wind + spec.active + spec.recover, q = x * tot;
      return { attack: q < spec.wind ? { spec, phase: 'wind', u: q / spec.wind } : q < spec.wind + spec.active ? { spec, phase: 'active', u: (q - spec.wind) / spec.active } : { spec, phase: 'recover', u: (q - spec.wind - spec.active) / spec.recover } }; }
    if (k >= 6.2 && k < 7.2) return { dan: 'coil' };
    if (k >= 9.6 && k < 11.4) return { dan: 'roar' };
    return { stance: k > 7.2 && k < 9.6 ? 'ready' : null };
  },
  preview(h, part) { h.brood = part === 3 ? 6 : 2; return { dan: part === 3 ? 'roar' : null }; },
  titleZoom: [.82, 1.25],
  dollHeight: 40,
  menuNotes(el, C) {
    formElement('p', 'Brood: every kill ripens one of the six egg sacs on its hips. Hatch spends them as broodlings that hunt and bite; Brood Burst ruptures them in a void blast that grows with every sac.', el);
    formElement('p', 'Starts with all six of its skills. Rank them and choose runes in Skills; shared skills, gear, crafting and passives remain available.', el);
    const list = formElement('ul', '', el);
    for (const id of C.skills) { const S = REG.skills[id]; if (S) formElement('li', S.name + ' — ' + S.desc(1, null), list); }
  }
});
