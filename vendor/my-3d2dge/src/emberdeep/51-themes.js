/* =============================================================================
 * THEMES: the look of the deep. Eleven places below the crypt, each with its own floor craft, wall and roof
 * masonry, light, set dressing, living decorations, drifting air, a void to fall into and a song.
 *   ruins forge frost fungal mine clockwork abyss ossuary sky aqueduct cavern
 * Shared machinery (WLD_*):
 *   WLD_P(L)        the level's palette (L.pal, already hue-shifted for deep depths) as ready [r, g, b] arrays + tones
 *   WLD_cliff()     the void is not empty: under every island, bridge and chasm edge the rock hangs down (a tiny
 *                   raycast per void pixel, baked with the floor, correct in every view and every camera turn)
 *   WLD_rune()      the landing and exit rune circles, drawn in each theme's colours
 *   WLD_FACES/ROOFS extra wall masonry (skull ossuary walls, riveted plates, glassy ice, basalt columns...)
 *   WLD_DECO        living decorations (things): crucibles, gears, giant mushrooms, waterfalls, hanging chains...
 *   a backdrop behind the map (E.Backdrop): what shows through the void, drifting with parallax
 * Every floor() starts with standardFloor (DESIGN.md), so standard tags look the same in every theme.
 * ============================================================================= */

/* ---------- palette: the level's colours as arrays, ready for the floor bake (no allocation per pixel) ---------- */
/** C[k] = [r, g, b] of pal[k]; C[k + '_d' | '_s' | '_l' | '_h'] its tones (deep, shadow, light, highlight); C[k + '_g'] glowing */
function WLD_P(L0) {
  const pal = L0.pal; if (L0._wp && L0._wp.src === pal) return L0._wp;
  const C = { src: pal };
  for (const k in pal) {
    const v = pal[k]; if (typeof v !== 'string' || v[0] !== '#') continue;
    const t = E.tones(v); C[k] = E.hex(v); C[k + '_d'] = E.hex(t.deep); C[k + '_s'] = E.hex(t.sh); C[k + '_l'] = E.hex(t.lt); C[k + '_h'] = E.hex(t.hi); C[k + '_g'] = E.hex(v).concat(1);
  }
  // the rock under islands: lit face, body, shadow, then sinking into the void colour
  const cl = pal.cliff || '#4a4238', vd = pal.void || '#07060e', ct = E.tones(cl);
  C.cliffR = [ct.hi, ct.lt, cl, ct.sh, ct.deep, E.mix(ct.deep, vd, .45), E.mix(ct.deep, vd, .75)].map(E.hex);
  return (L0._wp = C);
}
/** E.tones of a colour, memoised (wall patterns ask for them per pixel) */
const WLD_TC = {}, WLD_T = c => WLD_TC[c] || (WLD_TC[c] = E.tones(c));
/** a colour for this level (deep depths turn every theme's hue) */
const WLD_c = (L0, c) => L0 && L0.hue ? levelHue(c, L0.hue) : c;   // (materials keep near their own hue: 50-levels-core.js)
const WLD_i = (L0, x, y) => Math.floor(y / T16) * L0.w + Math.floor(x / T16);
/** a fast value noise for the floor bake (a 256 x 256 table, smooth-stepped, 0..1): E.noise2's look at a fraction of its cost */
const WLD_NT = (() => { const t = new Float32Array(65536); for (let i = 0; i < 65536; i++) t[i] = E.hash2(i & 255, i >> 8); return t; })();
function WLD_n(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) << 8, y1 = ((yi + 1) & 255) << 8, a = WLD_NT[y0 | x0], b = WLD_NT[y0 | x1], c = WLD_NT[y1 | x0];
  return a + (b - a) * u + (c - a) * v + (a - b - c + WLD_NT[y1 | x1]) * u * v;
}
/** Voronoi plates on an S-unit jittered grid (cracked rock, sheet ice, obsidian): fills WLD_V with id (0..1, the
 *  plate's own value), e (distance to the plate's edge) and dx, dy (offset from the plate's heart). No allocation */
const WLD_V = { id: 0, e: 0, dx: 0, dy: 0 };
function WLD_vor(x, y, S, jit = .8) {
  const gx = Math.floor(x / S), gy = Math.floor(y / S); let d1 = 1e9, d2 = 1e9, ax = 0, ay = 0, bx = 0, by = 0, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j, k = ((cy & 255) << 8) | (cx & 255), qx = (cx + .5 + (WLD_NT[k] - .5) * jit) * S, qy = (cy + .5 + (WLD_NT[k ^ 0x5a5a] - .5) * jit) * S, ddx = x - qx, ddy = y - qy, d = ddx * ddx + ddy * ddy;
    if (d < d1) { d2 = d1; bx = ax; by = ay; d1 = d; ax = qx; ay = qy; id = k; } else if (d < d2) { d2 = d; bx = qx; by = qy; }
  }
  WLD_V.id = WLD_NT[id ^ 0x3c3c]; WLD_V.e = (d2 - d1) / (2 * (Math.hypot(bx - ax, by - ay) || 1)); WLD_V.dx = x - ax; WLD_V.dy = y - ay;
  return WLD_V;
}
/** flagstones of three widths (a third, a half or two thirds of bw) in staggered rows rh deep: fills WLD_S with
 *  lx, ly (position in the stone), sw (its width) and h (its own value) */
const WLD_S = { lx: 0, ly: 0, sw: 0, h: 0 };
function WLD_slab(x, y, rh = 16, bw = 48) {
  const row = Math.floor(y / rh), sx = x + (row & 1) * bw * .42 + (row % 3) * 7, blk = Math.floor(sx / bw), lb = sx - blk * bw, hb = E.hash2(blk, row), split = bw / 3 + Math.floor(hb * 3) * bw / 6, first = lb < split;
  WLD_S.lx = first ? lb : lb - split; WLD_S.ly = y - row * rh; WLD_S.sw = first ? split : bw - split; WLD_S.h = first ? hb : E.hash2(blk + 91, row);
  return WLD_S;
}

/* ---------- masks, computed once per level: what surrounds each cell ----------
 * bits 0-3: a wall at -x +x -y +y; bits 4-7: void (pit) at -x +x -y +y */
function WLD_mask(L0) {
  const m = L0.map; if (L0._wmk && L0._wmk.fl === m.floors) return L0._wmk.a;
  const w = L0.w, h = L0.h, a = new Uint8Array(w * h), tg = m.floorTags;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let b = 0; const i = y * w + x;
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy], k) => { const c = m.cell(x + dx, y + dy); if (c > 0) b |= 1 << k; else if (c === 0 && tg && tg[i + dy * w + dx] === 'pit') b |= 16 << k; });
    a[i] = b;
  }
  L0._wmk = { fl: m.floors, a }; return a;
}
/** how close (world units) a point is to a wall (or, with pit = true, to the void) in its cell: 99 when none is next to it */
function WLD_near(L0, x, y, pit) {
  const i = WLD_i(L0, x, y), b = WLD_mask(L0)[i] >> (pit ? 4 : 0); if (!(b & 15)) return 99;
  const lx = x - Math.floor(x / T16) * T16, ly = y - Math.floor(y / T16) * T16; let d = 99;
  if (b & 1) d = lx; if ((b & 2) && T16 - lx < d) d = T16 - lx; if ((b & 4) && ly < d) d = ly; if ((b & 8) && T16 - ly < d) d = T16 - ly;
  return d;
}

/* ---------- THE VOID: rock hanging under islands, bridges and chasm edges ----------
 * For a void pixel the camera ray goes on below the floor, away from the camera; the first cell of rock it meets
 * (above that cell's depth) is the cliff face it sees. Depth grows with the distance from the edge, and the bottom
 * is broken into teeth, so islands taper to jagged points. Bridges are thin (a plank's depth). */
function WLD_mass(L0) {
  const m = L0.map; if (L0._wm && L0._wm.fl === m.floors) return L0._wm.D;
  const w = L0.w, h = L0.h, tg = m.floorTags, D = new Float32Array(w * h), dist = new Int32Array(w * h).fill(-1), q = [];
  for (let i = 0; i < w * h; i++) if (tg && tg[i] === 'pit') { dist[i] = 0; q.push(i); }
  for (let k = 0; k < q.length; k++) { const c = q[k], x = c % w, y = (c / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, n = ny * w + nx; if (nx < 0 || ny < 0 || nx >= w || ny >= h || dist[n] >= 0) continue; dist[n] = dist[c] + 1; q.push(n); } }
  for (let i = 0; i < w * h; i++) D[i] = tg && tg[i] === 'pit' ? 0 : tg && tg[i] === 'bridge' ? 4.5 : dist[i] < 0 ? 96 : Math.min(96, 8 + dist[i] * 13 + E.hash2(i, 7) * 9);
  L0._wm = { fl: m.floors, D }; return D;
}
/** per view: the void cells from which a ray can reach rock at all (every other void pixel stays empty, at once) */
function WLD_reach(L0, v, dx, dy, gl) {
  let c = L0._wrc; if (!c || c.fl !== L0.map.floors) c = L0._wrc = { fl: L0.map.floors };
  const key = v.id + ':' + v.yawDeg + ':' + v.pitchDeg + ':' + v.scale; if (c[key]) return c[key];
  const D = WLD_mass(L0), w = L0.w, h = L0.h, a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (D[i] <= 0) continue;
    const x0 = (i % w + .5) * T16, y0 = (Math.floor(i / w) + .5) * T16, Lm = Math.min(176, D[i] * gl + 26);
    for (let t = 0; t <= Lm; t += 6) { const cx = Math.floor((x0 - dx * t) / T16), cy = Math.floor((y0 - dy * t) / T16); for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h) a[yy * w + xx] = 1; }
  }
  return (c[key] = a);
}
/** the ray's constants for the view being baked (cached on the level by view object) */
function WLD_ray(L0) {
  const v = game.view, q = L0._wray; if (q && q.v === v && q.fl === L0.map.floors) return q;
  const inv = v.inv, k = -v.bz, ux = inv ? -inv[1] * k : 0, uy = inv ? -inv[3] * k : 0, gl = Math.hypot(ux, uy), ok = !!inv && v.pitchDeg <= 84 && gl >= .05;
  const r = { v, fl: L0.map.floors, ok, gl, dx: ok ? ux / gl : 0, dy: ok ? uy / gl : 0 };
  r.reach = ok ? WLD_reach(L0, v, r.dx, r.dy, gl) : null;
  return (L0._wray = r);
}
function WLD_cliff(L0, x, y) {
  const q = WLD_ray(L0); if (!q.ok) return null;
  const w = L0.w, h = L0.h, T = T16; let cx = Math.floor(x / T), cy = Math.floor(y / T);
  if (!q.reach[cy * w + cx]) return null;
  const D = WLD_mass(L0), gl = q.gl, dx = q.dx, dy = q.dy, adx = Math.abs(dx), ady = Math.abs(dy);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, tdx = adx > 1e-6 ? T / adx : 1e9, tdy = ady > 1e-6 ? T / ady : 1e9;
  let tx = adx > 1e-6 ? (dx > 0 ? (cx + 1) * T - x : x - cx * T) / adx : 1e9, ty = ady > 1e-6 ? (dy > 0 ? (cy + 1) * T - y : y - cy * T) / ady : 1e9;
  for (let n = 0; n < 14; n++) {
    let t, face; if (tx < ty) { t = tx; tx += tdx; cx += sx; face = 0; } else { t = ty; ty += tdy; cy += sy; face = 1; }
    const d = t / gl; if (d > 98 || cx < 0 || cy < 0 || cx >= w || cy >= h) return null;
    const i = cy * w + cx, Dm = D[i]; if (Dm <= 0) continue;
    const u = face ? x + dx * t : y + dy * t, C = WLD_P(L0);
    if (Dm < 6) return d > Dm ? null : d < 1.3 ? C.plank_l : ((u + 400) % 4 < .8 ? C.plank_d : C.plank_s);   // a bridge's edge
    const hs = E.hash2(cx * 3 + face, cy * 5), ph = u / 5.5 + hs, tooth = Math.abs(ph - Math.floor(ph) - .5) * 2 * (7 + hs * 9);
    if (d > Dm - tooth) continue;                                            // below this rock: look further in
    if (d < 1.8) return face ? C.lip_l : C.lip;                             // the lip: grass, snow or soil at the top
    if (d < 3.2 && E.hash2(Math.floor(u), cx + cy) < .5) return C.lip_s;    // roots and crumbs just under it
    const band = Math.floor((d + Math.sin(u * .23 + hs * 6) * 2.4) / 6), crack = (u * .13 + hs * 3) % 1 < .05 && d > 5;
    let tn = (face ? 1 : 2) + ((band & 3) === 1 ? 1 : (band & 3) === 3 ? -1 : 0) + (crack ? 2 : 0);
    const f = d / Dm; tn += f > .8 ? 2 : f > .52 ? 1 : 0;
    return C.cliffR[Math.max(0, Math.min(6, tn))];
  }
  return null;
}
/** the standard tags first (every theme), then the rock hanging into the void */
function WLD_std(L0, x, y, tag, base) { const s = standardFloor(L0, x, y, tag, base); return s === null ? WLD_cliff(L0, x, y) : s; }

/* ---------- rune circles (the landing and the exit), in the theme's colours ---------- */
function WLD_rune(L0, x, y, C) {
  const rs = L0.runes; if (!rs || !rs.length) return null;
  let m = L0._wr;
  if (!m || m.n !== rs.length) { const a = new Uint8Array(L0.w * L0.h); for (const rc of rs) for (let cy = Math.floor((rc.y - rc.r - 3) / T16); cy <= (rc.y + rc.r + 3) / T16; cy++) for (let cx = Math.floor((rc.x - rc.r - 3) / T16); cx <= (rc.x + rc.r + 3) / T16; cx++) if (cx >= 0 && cy >= 0 && cx < L0.w && cy < L0.h) a[cy * L0.w + cx] = 1; m = L0._wr = { n: rs.length, a }; }
  const cx = Math.floor(x / T16), cy = Math.floor(y / T16); if (cx < 0 || cy < 0 || cx >= L0.w || cy >= L0.h || !m.a[cy * L0.w + cx]) return null;
  for (const rc of rs) {
    const dx = x - rc.x, dy = y - rc.y, d = Math.hypot(dx, dy), R0 = rc.r; if (d > R0 + 1.5) continue;
    if (Math.abs(d - R0) < .8) return C.runeHi_g;
    if (Math.abs(d - R0 + 1.8) < .5 || Math.abs(d - R0 * .74) < .6) return C.rune_g;
    const a = Math.atan2(dy, dx);
    if (d > R0 * .74 && d < R0 - 1.8) {   // a band of glyphs: each of 14 cells carries a stroke pattern of its own
      const sg = (a / TAU + 1) * 14, gi = Math.floor(sg), fs = sg - gi, hb = E.hash2(gi + rc.r, 3) * 8 | 0, rr = (d - R0 * .74) / (R0 * .26 - 1.8);
      if (fs < .06) return C.rune;
      if (((hb & 1) && Math.abs(fs - .5) < .07) || ((hb & 2) && Math.abs(rr - .5) < .1 && fs > .2 && fs < .8) || ((hb & 4) && Math.abs(fs - rr) < .08)) return C.runeHi;
      return null;
    }
    if (d < R0 * .3) { const st = R0 * .27 * (.5 + .5 * Math.abs(Math.cos(a * 3))); if (d < 1.6) return C.runeHi_g; if (Math.abs(d - st) < .6) return C.rune_g; return null; }
    if (d < R0 * .74 && Math.abs(Math.sin(a * 3)) * d < .55) return C.rune;   // six spokes
    return null;
  }
  return null;
}
/* ---------- bridges: planks (or stone slabs) across the direction of travel, beams along the edges ---------- */
function WLD_bridgeDir(L0) {
  if (L0._wbd) return L0._wbd;
  const w = L0.w, h = L0.h, tg = L0.map.floorTags, A = { c: new Float32Array(w * h), s: new Float32Array(w * h) };
  for (let i = 0; i < w * h; i++) {
    if (tg[i] !== 'bridge') continue;
    const x0 = i % w, y0 = (i / w) | 0; let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let y = y0 - 3; y <= y0 + 3; y++) for (let x = x0 - 3; x <= x0 + 3; x++) if (x >= 0 && y >= 0 && x < w && y < h && tg[y * w + x] === 'bridge') { n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
    const mx = sx / n, my = sy / n, th = .5 * Math.atan2(2 * (sxy / n - mx * my), (sxx / n - mx * mx) - (syy / n - my * my)); A.c[i] = Math.cos(th); A.s[i] = Math.sin(th);
  }
  return (L0._wbd = A);
}
function WLD_bridge(L0, x, y, C, stone) {
  const A = WLD_bridgeDir(L0), i = WLD_i(L0, x, y), c = A.c[i], s = A.s[i], al = x * c + y * s, ac = -x * s + y * c, tg = L0.map.floorTags, w = L0.w;
  const pit = (px0, py0) => tg[Math.floor(py0 / T16) * w + Math.floor(px0 / T16)] === 'pit';
  if (pit(x - s * 3.2, y + c * 3.2) || pit(x + s * 3.2, y - c * 3.2)) return ((al + 400) % 9 < 1.4) ? C.plank_h : C.plank_d;   // the side beam, a post now and then
  if (pit(x - s * 5, y + c * 5) || pit(x + s * 5, y - c * 5)) return C.plank_s;
  const bw = stone ? 8 : 4, q = al / bw, bi = Math.floor(q), fq = q - bi, v = E.hash2(bi, Math.floor(ac / 24));
  if (fq < (stone ? .08 : .17)) return C.plank_d;
  if (fq < .3) return C.plank_l;
  if (!stone && ((ac * .45 + v * 7) % 3.1 < .3)) return C.plank_s;            // grain
  return v < .3 ? C.plank_s : v > .85 ? C.plank_l : C.plank;
}

/* ---------- wall masonry: wall faces and tops the engine does not have, as materials (WLD_patterns, below) ---------- */
const WLD_FACES = {
  /** stone blocks with moss creeping down from the top in drips, and a green foot */
  mossy(wx, z, ct, t, cx, cy, fi, nh, h) {
    const mt = E.tones(t.accent || '#5f7a3a'), drip = h - 2.5 - WLD_n(wx * .3 + cx, cy * .7) * 8 - (E.hash2(Math.floor(wx * .8), cy + 5) < .22 ? 5 : 0);
    if (z > drip) return z > h - 1.1 ? mt.lt : WLD_n(wx * .5, z * .5) > .52 ? mt.base : mt.sh;
    if (z < nh + 2.2 + WLD_n(wx * .4, 9) * 2.5) return WLD_n(wx * .6, z) > .5 ? mt.sh : mt.deep;
    const ci = Math.floor(z / 10), fz = z / 10 - ci, off = E.hash2(ci * 3 + cx * 5 + cy * 11, 7) * 16, q = (wx + off) / 11, bi = Math.floor(q), fq = q - bi, v = E.hash2(bi * 5 + cx, ci + cy * 17);
    if (fz < .1 || fq < .06) return ct.deep; if (fz > .86 || fq < .14) return ct.lt; if (fq > .93) return ct.sh;
    if ((t.stain && WLD_n(wx * .9, 3) > .72 && z < drip - 1)) return ct.sh;   // water stains running down
    return v < .28 ? ct.sh : null;
  },
  /** dark ashlar strapped with riveted iron bands; soot blackens the top */
  iron(wx, z, ct, t, cx, cy, fi, nh, h) {
    const it = E.tones(t.accent || '#6a6a78'), sz = ((z - nh) % 13 + 13) % 13;
    if (sz > 9.5 && sz < 12 && z < h - 2) { const rv = ((wx % 6) + 6) % 6; if (rv > 2.3 && rv < 3.5 && sz > 10.2 && sz < 11.3) return it.hi; return sz > 11.3 ? it.lt : sz < 10.1 ? it.deep : it.base; }
    if (z > h - 7 + WLD_n(wx * .4, cy) * 4) return WLD_n(wx * .7, z * .7) > .45 ? ct.deep : ct.sh;
    const ci = Math.floor(z / 6.5), fz = z / 6.5 - ci, q = (wx + (ci & 1) * 5) / 10, bi = Math.floor(q), fq = q - bi, v = E.hash2(bi + cx * 3, ci + cy * 7);
    if (fz < .14 || fq < .07) return ct.deep; if (fz > .84) return ct.lt;
    return v < .3 ? ct.sh : v > .86 ? ct.lt : null;
  },
  /** riveted plates between a brass cornice and skirting, brushed sheen stripes */
  metal(wx, z, ct, t, cx, cy, fi, nh, h) {
    const at = E.tones(t.accent || '#b08a44');
    if (z > h - 3.4) return z > h - 1 ? at.hi : z > h - 2.2 ? at.lt : at.sh;
    if (z < nh + 2.6) return z < nh + 1 ? at.deep : at.base;
    const zz = z - nh - 2.6, q = wx / 8, pi = Math.floor(q), lx = (q - pi) * 8, row = Math.floor(zz / 9), lz = zz - row * 9;
    if (lx < .8 || lz < .8) return ct.deep;
    if (lz > 8) return ct.lt;
    const rx = lx < 2.9 && lx > 1.7, rz = (lz > 1.6 && lz < 2.8) || (lz > 6.2 && lz < 7.4);
    if ((rx || (lx > 5.9 && lx < 7.1)) && rz) return lz > 2 && lz < 2.8 || lz > 6.6 ? ct.hi : ct.sh;
    if (lx > 3.6 && lx < 4.3) return ct.lt;
    const v = E.hash2(pi + cx * 7, row + cy * 3 + fi); return v < .25 ? ct.sh : null;
  },
  /** glassy blocks of ice: pale joints, bright lit edges, cracks and a sheen, rime at the foot */
  ice(wx, z, ct, t, cx, cy, fi, nh, h) {
    if (z < nh + 2.4 + WLD_n(wx * .5, cy) * 2) return E.hash2(Math.floor(wx), Math.floor(z * 2)) < .5 ? ct.hi : ct.lt;
    const ci = Math.floor(z / 12), fz = z / 12 - ci, q = (wx + E.hash2(ci + cx, cy) * 16) / 13, bi = Math.floor(q), fq = q - bi, v = E.hash2(bi * 3 + cx, ci + cy * 5);
    if (fz < .07 || fq < .05) return ct.sh;
    if (fz > .9 || fq < .11) return ct.hi;
    if (Math.abs(WLD_n(wx * .22 + bi * 3, z * .22) - .5) < .022) return ct.lt;
    if (((wx + z * .9 + v * 30) % 15 + 15) % 15 < 1.3) return ct.hi;
    return v < .3 ? ct.sh : v > .8 ? ct.lt : null;
  },
  /** columns of basalt (the abyss): stepped tops, lit and shaded edges, glowing violet seams in the breaks */
  basalt(wx, z, ct, t, cx, cy, fi, nh, h) {
    const q = wx / 3.4, bi = Math.floor(q), fq = q - bi, v = E.hash2(bi + cx * 13, cy * 7 + fi), top = h - 1 - v * 6;
    if (z > top) return z > h - .8 ? ct.lt : ct.deep;
    if (fq < .12) return ct.deep; if (fq < .32) return ct.lt; if (fq > .82) return ct.sh;
    const br = ((z + v * 17) % 11 + 11) % 11;
    if (br < .7) return v > .7 ? E.tones(t.accent || '#b06aff').lt : ct.deep;
    return v < .25 ? ct.sh : null;
  },
  /** white marble: gold bands top and bottom, fluted pilasters, veined blocks */
  marble(wx, z, ct, t, cx, cy, fi, nh, h) {
    const gt = E.tones(t.accent || '#d8b04a');
    if (z > h - 2.6) return z > h - 1 ? gt.hi : gt.base;
    if (z < nh + 2.2) return z < nh + .8 ? gt.sh : gt.base;
    const lx = ((wx % 16) + 16) % 16;
    if (lx < 4.2) { if (z > h - 5.5) return z > h - 3.6 ? ct.hi : ct.lt; return lx % 1.4 < .45 ? ct.sh : ct.lt; }
    const ci = Math.floor(z / 12), fz = z / 12 - ci;
    if (fz < .05) return ct.sh;
    if (Math.abs(Math.sin(wx * .31 + z * .19 + WLD_n(wx * .1, z * .1 + cy) * 5)) < .045) return ct.sh;
    return null;
  },
  /** living rock (fungal): strata, and shelf fungi glowing in clusters */
  fungus(wx, z, ct, t, cx, cy, fi, nh, h) {
    const gx = Math.floor(wx / 7), gz = Math.floor(z / 9), hv = E.hash2(gx + cx * 5, gz + cy * 3);
    if (hv > .6) {
      const sx = gx * 7 + 1.5 + E.hash2(gx, gz + 1) * 4, sz = gz * 9 + 2 + hv * 5, ddx = wx - sx, dz = z - sz, at = E.tones(t.accent || '#5ff0c8');
      if (dz >= 0 && dz < 2.4 && Math.abs(ddx) < 3.4 - dz * 1.1) return dz > 1.5 ? at.hi : Math.abs(ddx) > 2.2 - dz ? at.base : at.lt;
      if (dz < 0 && dz > -.9 && Math.abs(ddx) < 3) return at.sh;
    }
    if (z > h - 3 - WLD_n(wx * .4, cy) * 6) return E.tones(t.moss || '#3a6a5a')[WLD_n(wx * .5, z * .5) > .5 ? 'base' : 'sh'];
    const n = WLD_n(wx / 6 + cx * 3, z / 4 + cy * 5) * .7 + WLD_n(wx / 2.5, z / 2) * .3;
    return n < .3 ? ct.deep : n < .42 ? ct.sh : n > .72 ? ct.lt : null;
  },
  /** raw rock held up by timber posts and a lintel; veins of stormglass ore */
  mine(wx, z, ct, t, cx, cy, fi, nh, h) {
    const bt = E.tones(t.beam || '#6a4a2a'), lx = ((wx % 32) + 32) % 32;
    if (z > h - 4.2) return z > h - 1.2 ? bt.lt : ((wx % 8 + 8) % 8 < 1 && z < h - 2.2 && z > h - 3.2) ? bt.hi : bt.base;
    if (lx < 3.4) return lx < 1 ? bt.lt : lx > 2.5 ? bt.sh : ((z * 1.3 + lx) % 5 < .5 ? bt.sh : bt.base);
    if (Math.abs(WLD_n(wx * .12 + 3, z * .2) - .5) < .022) return E.tones(t.accent || '#6ad8ff').lt;
    const n = WLD_n(wx / 6 + cx * 3, z / 4 + cy * 5) * .7 + WLD_n(wx / 2.5, z / 2) * .3;
    return n < .28 ? ct.deep : n < .42 ? ct.sh : n > .72 ? ct.lt : null;
  },
  /** ossuary walls: courses of skulls in dark mortar, every third course a row of long bones */
  bone(wx, z, ct, t, cx, cy, fi, nh, h) {
    const zz = z - nh, row = Math.floor(zz / 7), fz = zz - row * 7;
    if (row % 3 === 2) {
      const q = (wx + row * 5) / 11, bi = Math.floor(q), fq = (q - bi) * 11, lane = fz < 3.5 ? 1.9 : 5.1, dz = Math.abs(fz - lane), knob = fq < 2 || fq > 9;
      if (dz < (knob ? 1.6 : 1.05) && fq > .5 && fq < 10.5) return dz > (knob ? 1 : .5) && fz < lane ? ct.sh : fz > lane + .3 ? ct.lt : null;
      return ct.deep;
    }
    const q = (wx + (row & 1) * 3.5) / 7, bi = Math.floor(q), lx = (q - bi) * 7 - 3.5, lz = fz - 3.7, v = E.hash2(bi + cx * 5, row + cy * 3);
    const e = lx * lx / 9 + lz * lz / 9.6;
    if (e > 1) return (lz < -2.4 && lz > -3.4 && Math.abs(lx) < 1.8) ? (((lx + 9) * 1.5 | 0) & 1 ? ct.sh : ct.lt) : ct.deep;   // teeth under the jaw
    if ((Math.abs(lx) - 1.35) ** 2 + (lz + .2) ** 2 < (v > .5 ? .9 : .7)) return ct.deep;                                  // eye sockets
    if (Math.abs(lx) < .5 - (lz + 1.5) * .3 && lz < -.9 && lz > -1.9) return ct.deep;                                       // nose
    if (lz > 1.6 && lx < .4) return ct.lt; if (lx > 1.8 || lz < -1.9) return ct.sh; if (lz > 2.4 && lx < -.6) return ct.hi;
    return v > .8 ? ct.lt : null;
  }
};
const WLD_ROOFS = {
  /** a snow cap: smooth, long drift crests, soft blue hollows */
  snow(wx, wy, tt) { const rp = Math.sin(wx * .21 + wy * .13 + WLD_n(wx * .05, wy * .05) * 8); if (rp > .94 && WLD_n(wx * .2, wy * .2) > .5) return tt.lt; return WLD_n(wx * .06 + 9, wy * .06) < .27 ? tt.sh : null; },
  /** paving slabs with round clumps of moss (lit from above, a shadow below) */
  moss(wx, wy, tt, t) {
    const a = WLD_T(t.moss || t.accent || '#5f7a3a'), gx = Math.floor(wx / 9), gy = Math.floor(wy / 9), h = E.hash2(gx, gy);
    if (h > .5) { const dx = wx - (gx * 9 + 2.5 + E.hash2(gx + 3, gy) * 4), dy = wy - (gy * 9 + 2.5 + E.hash2(gx, gy + 3) * 4), r0 = 1.8 + (h - .5) * 5, d = dx * dx + dy * dy; if (d < r0 * r0) return dx + dy < -r0 * .5 ? a.lt : dx + dy > r0 * .5 ? a.sh : a.base; if (d < (r0 + 1) * (r0 + 1) && dx + dy > 0) return tt.deep; }
    const fq = ((wx % 12) + 12) % 12, fs = ((wy + (Math.floor(wx / 12) & 1) * 6) % 12 + 12) % 12; return fq < .8 || fs < .8 ? tt.sh : null;
  },
  /** riveted plates, a grate in some (clockwork) */
  grate(wx, wy, tt) {
    const fx = ((wx % 16) + 16) % 16, fy = ((wy % 16) + 16) % 16, h = E.hash2(Math.floor(wx / 16), Math.floor(wy / 16));
    if (fx < .8 || fy < .8) return tt.deep; if (fx < 1.6 || fy < 1.6) return tt.lt;
    if (h < .3 && fx > 3.5 && fx < 12.5 && fy > 3.5 && fy < 12.5) return fy % 2.5 < 1 ? tt.deep : tt.sh;
    const rx = fx < 8 ? fx - 3 : fx - 13, ry = fy < 8 ? fy - 3 : fy - 13; return rx * rx + ry * ry < 1 ? tt.hi : null;
  },
  /** broken rock: lumps lit from the upper left */
  rubble(wx, wy, tt) {
    const gx = Math.floor(wx / 6), gy = Math.floor(wy / 6), hv = E.hash2(gx, gy), dx = wx - (gx * 6 + 3 + (hv - .5) * 2), dy = wy - (gy * 6 + 3 + (E.hash2(gy, gx) - .5) * 2), r0 = 1.8 + hv * 1.4, d = Math.hypot(dx, dy);
    if (d > r0) return d < r0 + 1 && dx + dy > 0 ? tt.deep : null; return dx + dy < -r0 * .6 ? tt.lt : dx + dy > r0 * .7 ? tt.sh : hv > .75 ? tt.sh : null;
  },
  /** dark rubble with skulls half sunk in it (ossuary) */
  bone(wx, wy, tt, t) {
    const gx = Math.floor(wx / 7), gy = Math.floor(wy / 7), h = E.hash2(gx, gy);
    if (h > .72) { const dx = wx - gx * 7 - 3.5, dy = wy - gy * 7 - 3.5, d = dx * dx + dy * dy, bt = E.tones(E.mix(t.side, t.top, .35)); if (d < 5.3) { if (d < 1.6 && Math.abs(dx) > .45 && dy > -.5 && dy < .8) return tt.deep; return dx + dy < -1.3 ? bt.lt : dx + dy > 1.3 ? bt.sh : bt.base; } if (d < 7.5 && dx + dy > 0) return tt.deep; }
    return WLD_ROOFS.rubble(wx, wy, tt);
  },
  /** obsidian: glassy plates with a lit edge and a dark one, a rare violet glint */
  glass(wx, wy, tt, t) { const V = WLD_vor(wx, wy, 13); if (V.e < .7) return tt.deep; if (V.e < 1.5) return V.dx + V.dy < 0 ? tt.lt : tt.sh; if (V.id > .96 && V.e > 3 && V.e < 3.8) return E.tones(t.accent || '#b06aff').lt; return V.id < .35 ? tt.sh : null; },
  /** living rock (fungal): moss spreading over it, and here and there a cluster of one to three mushroom caps (the
   *  biggest first), each shaded, spotted, and casting a shadow. Sparse, so the tops read as rock, not as wallpaper */
  caps(wx, wy, tt, t) {
    const gx = Math.floor(wx / 12), gy = Math.floor(wy / 12), h = E.hash2(gx, gy);
    if (h > .74) {
      const n = 1 + (h > .86) + (h > .95), a = WLD_T(E.hash2(gx + 7, gy) > .7 ? (t.accent2 || '#ff8ad0') : (t.accent || '#5ff0c8'));
      for (let k = 0; k < n; k++) {
        const r0 = (2.8 - k * .7) * (.85 + E.hash2(gx + k, gy + 2 * k) * .3), cx = gx * 12 + 3.5 + E.hash2(gx + 3 * k, gy + 1) * 5, cy = gy * 12 + 3.5 + E.hash2(gx, gy + 3 * k + 1) * 5, dx = wx - cx, dy = wy - cy, d = dx * dx + dy * dy;
        if (d < r0 * r0) { if (r0 > 2 && (dx + r0 * .2) ** 2 + (dy + r0 * .25) ** 2 < .5) return a.hi; return dx + dy < -r0 * .45 ? a.lt : dx + dy > r0 * .5 ? a.sh : a.base; }
        if (d < (r0 + 1.2) * (r0 + 1.2) && dx + dy > 0) return tt.deep;
      }
    }
    const mo = WLD_n(wx * .1 + 3, wy * .1); if (mo > .58) { const mt = WLD_T(t.moss || '#3a6a5a'); return mo > .68 ? (WLD_n(wx * .5, wy * .5) > .6 ? mt.lt : mt.base) : mt.sh; }
    return WLD_n(wx * .15 + 9, wy * .15) < .35 ? tt.sh : null;
  },
  /** polished slabs framed in gold */
  marble(wx, wy, tt, t) { const fx = ((wx % 16) + 16) % 16, fy = ((wy % 16) + 16) % 16; if (fx < 1 || fy < 1) return E.tones(t.accent || '#d8b04a').base; if (fx < 1.8 || fy < 1.8) return tt.hi; return null; }
};
/** the extra masonry, registered as materials (E.MATERIALS: a face(...) for wall faces, a roof(...) for wall tops), so every
 *  TileMap draws it (the title's and the gallery's crypt halls too). A name the engine also has gets the painter added to
 *  its entry, the rest of the entry kept; the engine's own (brick stone rock plank timber plaster hedge / speckle plain
 *  tiles slab leaves grass) are untouched, so the town's hedges stay as they are. WLD_patterns() is kept callable */
function WLD_patterns() {
  for (const k in WLD_FACES) E.MATERIALS[k] = Object.assign({}, E.MATERIALS[k], { face: WLD_FACES[k] });
  for (const k in WLD_ROOFS) E.MATERIALS[k] = Object.assign({}, E.MATERIALS[k], { roof: WLD_ROOFS[k] });
}
WLD_patterns();

/* ---------- placing things: spots in a room, props, decorations ---------- */
/** a free spot in a room: [x, y, nx, ny]. o.edge: against a wall (nx, ny points at it); o.rim: at the void's edge,
 *  pushed out over it; o.open: with open ground all around. Keeps clear of the runes and of other placed things */
function WLD_spot(L0, R, rm, o = {}) {
  const m = L0.map, taken = L0._wtk || (L0._wtk = []), gap = o.gap || 13;
  for (let k = 0; k < 30; k++) {
    const cx = rm.x + R.int(0, rm.w - 1), cy = rm.y + R.int(0, rm.h - 1), i = cy * L0.w + cx;
    if (!m.walkable(cx, cy) || (m.floorTags[i] && !o.tags)) continue;
    let x = (cx + .5) * T16, y = (cy + .5) * T16, nx = 0, ny = 0;
    if (o.edge || o.rim) {
      // an island's rim is an edge too; o.back: only a wall to the north (behind the floor in every default view: a tall
      // thing hung on it, like a waterfall, runs down the wall's face instead of standing in the room)
      const opts = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([dx, dy]) => { if (o.back && dy >= 0) return false; const c = m.cell(cx + dx, cy + dy), pit = c === 0 && m.floorTags[i + dy * L0.w + dx] === 'pit'; return o.rim ? pit : o.back ? c === 1 : c > 0 || pit; });
      if (!opts.length) continue;
      [nx, ny] = R.pick(opts); x += nx * (o.rim ? 25 : 8 - (o.inset || 5)) + (ny ? R.range(-4, 4) : 0); y += ny * (o.rim ? 25 : 8 - (o.inset || 5)) + (nx ? R.range(-4, 4) : 0);
    } else {
      if (o.open) { let ok = true; for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (!m.walkable(cx + dx, cy + dy)) { ok = false; break; } if (!ok) continue; }
      x += R.range(-4, 4); y += R.range(-4, 4);
    }
    // clear of the rune circles (the landing's is 30 across, the waystone's 26) by a prop's footprint
    if (Math.hypot(x - L0.start.x, y - L0.start.y) < (o.startGap || 42) || Math.hypot(x - L0.exit.x, y - L0.exit.y) < 38) continue;
    if (L0.rec && L0.rec.boss && Math.hypot(x - L0.exit.x, y - L0.exit.y + 34) < 54) continue;   // where the boss waits, and a throne behind it
    if (taken.some(p => (p[0] - x) ** 2 + (p[1] - y) ** 2 < gap * gap) || L0.torches.some(b => (b.x - x) ** 2 + (b.y - y) ** 2 < 256)) continue;
    taken.push([x, y]); return [x, y, nx, ny];
  }
  return null;
}
/** a prop in the level's colours: WLD_prop(L, 'pillar', x, y, { color, size, broken, z, anchor }) */
function WLD_prop(L0, name, x, y, o = {}) { const oo = Object.assign({}, o); if (oo.color) oo.color = WLD_c(L0, oo.color); delete oo.z; L0.props.push({ name, x, y, z: o.z || 0, o: oo }); }
/** a shape as set dressing (docs/ASSETS.md: a core shape or a store set's 'SET:id'): a prop's record (spaced, sunk and
 *  drawn in its turn as props are, by r.shape), facing a way of its own from where it stands. o: { size (its scale), color
 *  (its main slot's material in this color, hue-shifted for the level: o.slot, else the entry's first), facing, mats,
 *  params } */
const WLD_SHAPE_K = { barrel: .8, crate: .75 };
function WLD_shape(L0, id, x, y, o = {}) {
  const S = E.SHAPES[id]; if (!S) return;
  const mats = Object.assign({}, o.mats), slot = o.slot || Object.keys(S.mats || {})[0], m = slot && E.material(S.mats[slot]);
  if (o.color && m) mats[slot] = Object.assign({}, m.q, { color: WLD_c(L0, o.color), ramp: undefined });
  // (sizes in steps of a sixteenth: one picture serves many; barrels and crates a little under the shapes' own size, as the props were)
  const k = (o.size || 1) * (WLD_SHAPE_K[id] || 1), so = { facing: o.facing === undefined ? E.hash2(Math.round(x), Math.round(y)) * TAU : o.facing, scale: Math.round(k * 16) / 16, mats, params: o.params };
  L0.props.push({ name: id, shape: id, x, y, z: o.z || 0, o: { size: o.size || 1 }, so });
}
/** a living decoration: a thing that draws and ticks. Never hittable; solid only when it is big enough to walk around */
function WLD_deco(L0, kind, x, y, o = {}) {
  const D = WLD_DECO[kind]; if (!D) return null;
  const t = addThing(L0, Object.assign({ kind: 'deco', deco: kind, x, y, z: 0, r: 0, solid: false, hittable: false, t: Math.random() * 9, ph: Math.random() * TAU, lv: L0, overVoid: !!D.hangs,
    update(dt) { this.t += dt; if (D.update && WLD_awake(this)) D.update(this, dt); },   // far from the hero it rests (its sparks, spores and spray would only fill the particle pool off-screen)
    draw(r) { if (r.visible(this.x, this.y, this.z || 0, 70, 110, 70)) D.draw(this, r); } }, o));
  if (t.solid && !t.r) t.r = D.r || 5;
  if (D.init) D.init(t, L0);
  return t;
}
/** is a decoration near enough to the hero to be seen (and so worth its particles)? */
const WLD_awake = t => { const h = ED.hero; return !h || (Math.abs(t.x - h.x) < 340 && Math.abs(t.y - h.y) < 300); };
/** tones of a colour, hue-shifted for the level */
const WLD_tn = (L0, c) => E.tones(WLD_c(L0, c));
/** every room, plus the open spaces that are not rooms (an arena's antechamber) */
const WLD_spaces = L0 => L0.rooms.concat(L0.rooms.extra || []);
/** dress a level from a weighted list: items [{ w, edge, rim, open, f(L, R, x, y, nx, ny) }], n per room by area (w is
 *  the item's weight: RNG's weighted pick reads .weight unless told) */
function WLD_dress(L0, R, items, perArea = 14, min = 3, max = 8) {
  for (const rm of WLD_spaces(L0)) {
    const n = clamp(Math.round(rm.w * rm.h / perArea), min, max);
    for (let k = 0; k < n; k++) { const it = R.weighted(items, x => x.w === undefined ? 1 : x.w); const s = WLD_spot(L0, R, rm, it); if (s) it.f(L0, R, s[0], s[1], s[2], s[3], rm); }
  }
}
/** something on the faces of the pillars (type 2 cells): fn(L, R, x, y, nx, ny) at the middle of a free face */
function WLD_pillars(L0, R, p, fn) {
  const m = L0.map;
  for (let cy = 1; cy < L0.h - 1; cy++) for (let cx = 1; cx < L0.w - 1; cx++) {
    if (m.cell(cx, cy) !== 2 || !R.chance(p)) continue;
    const opts = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([dx, dy]) => m.walkable(cx + dx, cy + dy)); if (!opts.length) continue;
    for (const [nx, ny] of R.shuffle(opts).slice(0, R.int(1, 2))) fn(L0, R, (cx + .5 + nx * .56) * T16, (cy + .5 + ny * .56) * T16, nx, ny);
  }
}
/** glow-worms on the pillars' faces that look toward the camera side (south, east, west: a north face hides them) */
function WLD_glowPillars(L0, R, p, o = {}) { WLD_pillars(L0, R, p, (L1, R1, x, y, nx, ny) => { if (ny >= 0) WLD_deco(L1, 'glowworms', x, y, Object.assign({ nx: -nx, ny: -ny }, o)); }); }
/** holes in the floor of big rooms (collapsed floors, rifts): a void blob with a ring of floor kept around it */
function WLD_holes(L0, R, p, rmin = 1.4, rmax = 2.6) {
  const m = L0.map, w = L0.w; let n = 0;
  for (const rm of L0.rooms) {
    if (rm.w < 8 || rm.h < 8 || !R.chance(p) || rm === L0.rooms[0]) continue;
    const cx = rm.x + rm.w / 2 + R.range(-1, 1), cy = rm.y + rm.h / 2 + R.range(-1, 1), rad = Math.min(R.range(rmin, rmax), rm.w / 2 - 2.5, rm.h / 2 - 2.5), edge = WLD_blob(R, rad);
    if (rad < 1.1 || Math.hypot((cx - L0.start.x / T16), (cy - L0.start.y / T16)) < 5 || Math.hypot((cx - L0.exit.x / T16), (cy - L0.exit.y / T16)) < 5) continue;
    for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
      const dx = x + .5 - cx, dy = y + .5 - cy, i = y * w + x;
      if (Math.hypot(dx, dy) <= edge(Math.atan2(dy, dx)) && m.cell(x, y) === 0 && !m.floorTags[i]) { m.floorTags[i] = 'pit'; m.blocked[i] = 1; }
    }
    rm.hole = { x: cx * T16, y: cy * T16, r: rad * T16 }; n++;
  }
  if (n) { m.floors = {}; L0._wtk = (L0._wtk || []).concat(L0.rooms.filter(r0 => r0.hole).map(r0 => [r0.hole.x, r0.hole.y])); }
  return n;
}
/** the look every theme shares: the masonry, the backdrop behind the void, the sky */
function WLD_setup(L0, th) {
  const m = L0.map; WLD_patterns(m);
  // a boss arena gets a great sigil in the middle of the floor
  const ar = L0.rooms[0]; if (ar && ar.kind === 'arena' && !L0._wsig) { L0._wsig = true; L0.runes.push({ x: ar.ix * T16, y: ar.iy * T16, r: 46 }); }
  // open spaces that are not rooms (an arena's antechamber) get their light too: a pair flanking the way on
  for (const sp of L0.rooms.extra || []) for (const fx of [.2, .8]) { const x = (sp.x + sp.w * fx) * T16, y = (sp.y + 1.2) * T16; if (m.walkable(Math.floor(x / T16), Math.floor(y / T16))) L0.torches.push({ x, y, t: Math.random() * 9, kind: th.torch || 'brazier', color: th.light || '#ff9a4a', r: 4.5, solid: true, radius: th.lightR, i: th.lightI }); }
  if (th.sky) L0.sky = th.sky.map(c => WLD_c(L0, c));
  // the backdrop shows through the void: drawn before the floor through the core's L.drawBack hook (the abyss under
  // chasms, 46-mechanics-a.js, wraps drawFloor and so still lands between the two), and only while there is a void
  if (th.back && !L0._wback) {
    const b = th.back, spec = Object.assign({}, b, { sky: b.sky.map(c => WLD_c(L0, c)), layers: (b.layers || []).map(l => Object.assign({}, l, { color: WLD_c(L0, l.color) })) });
    if (b.sun) spec.sun = Object.assign({}, b.sun, { color: WLD_c(L0, b.sun.color || '#fff4d0') });
    const bd = L0._wback = new E.Backdrop(spec), prev = L0.drawBack;
    L0.drawBack = r => { if (WLD_voids(L0)) bd.draw(r); if (prev) prev(r); };
  }
}
/** does the level have any void (pit cells) right now? Counted again whenever the floor re-bakes (tags changed) */
function WLD_voids(L0) {
  const m = L0.map; if (L0._wvd && L0._wvd.fl === m.floors) return L0._wvd.n;
  let n = 0; const tg = m.floorTags; if (tg) for (let i = 0; i < tg.length; i++) if (tg[i] === 'pit') n++;
  L0._wvd = { fl: m.floors, n }; return n;
}
/** the colour of the dark (the lights' shadow tint) per theme; restored when the level ends */
const WLD_DARK0 = L.dark.slice();
/** th.tint: how much colour the lights add on top of the floor (the engine's default is .32). Pale places (snow, marble)
 *  take less, so the hero's own light warms them instead of bleaching them white */
function WLD_mood(th) { const d = th.dark || WLD_DARK0; if (L.dark[0] !== d[0] || L.dark[1] !== d[1] || L.dark[2] !== d[2]) { L.dark = d.slice(); L._build(); } L.tint = th.tint; }
BUS.on('levelEnd', () => { L.dark = WLD_DARK0.slice(); L._build(); L.tint = undefined; }, 'global');
/** drifting motes near the hero: rate per second, mk(x, y) returns the particle */
function WLD_motes(dt, rate, mk, spread = 300) {
  const h = ED.hero; if (!h) return;
  for (let n = rate * dt; n > 0; n--) { if (n < 1 && Math.random() > n) break; P.add(mk(h.x + (Math.random() - .5) * spread, h.y + (Math.random() - .5) * spread)); }
}

/* ---------- LIVING DECORATIONS ----------
 * Each is drawn from continuous values (its clock t, a phase ph), shaded with tones, outlined where it stands up.
 * Billboards are sized in pixels times the camera zoom (like props); things on the ground are projected. */
const WLD_zm = r => r.view.zoom || 1;
/** a shaded vertical cylinder (basins, drums, posts): sides lit by their facing, a top ring */
function WLD_cyl(g, r, x, y, z0, z1, rad, tn, n = 14, top = true) {
  const v = r.view;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, am = (a0 + a1) / 2, nx = Math.cos(am), ny = Math.sin(am);
    if (nx * v.fx + ny * v.fy <= 0) continue;
    const lit = .6 * nx + .8 * ny, c = lit > .55 ? tn.lt : lit > -.1 ? tn.base : lit > -.6 ? tn.sh : tn.deep;
    px.poly(g, [r.w(x + Math.cos(a0) * rad, y + Math.sin(a0) * rad, z0), r.w(x + Math.cos(a1) * rad, y + Math.sin(a1) * rad, z0), r.w(x + Math.cos(a1) * rad, y + Math.sin(a1) * rad, z1), r.w(x + Math.cos(a0) * rad, y + Math.sin(a0) * rad, z1)], c);
  }
  if (top) px.poly(g, r.groundPts(x, y, rad, n, z1), tn.lt);
}
/** a gear outline on the ground (world points) or upright on screen: pts around a centre, n teeth, turned by a */
function WLD_gearPts(n, R0, R1, a, f) { const pts = []; for (let i = 0; i < n * 4; i++) { const k = i % 4, ang = a + (i / (n * 4)) * TAU, rr = k === 1 || k === 2 ? R1 : R0; pts.push(f(Math.cos(ang) * rr, Math.sin(ang) * rr)); } return pts; }
/** fn's drawing with a one-pixel dark outline, the way r.actor outlines characters but without its offscreen
 *  composite (far cheaper): the silhouette is drawn in the outline colour one pixel out in four directions (through
 *  the pixel layer's colour override, g._info / g._mat), then the drawing itself. fn(dx, dy) draws offset by dx, dy */
function WLD_outlined(g, fn, col = '#140c1c') {
  if (g._info) { fn(0, 0); return; }
  g._info = true; g._mat = col; g._c = null;
  try { fn(-1, 0); fn(1, 0); fn(0, -1); fn(0, 1); } finally { g._info = false; g._mat = null; g._c = null; }
  fn(0, 0);
}
/** a depth-sorted, outlined drawing standing at a world point: fn(g, ox, oy) with (ox, oy) that point on screen */
function WLD_act(r, x, y, z, fn) { r.queue(x, y, z, g => { const p = r.w(x, y, z), ox = Math.round(p[0]), oy = Math.round(p[1]); WLD_outlined(g, (dx, dy) => fn(g, ox + dx, oy + dy)); }); }
/** screen-space helper: a list of [x, y] offsets from (ox, oy) */
const WLD_off = (ox, oy, pts) => pts.map(p => [ox + p[0], oy + p[1]]);

const WLD_DECO = {
  /* a stone slab hovering over its shadow, a rune glowing in it (ruins) */
  runestone: { draw(t, r) {
    const bob = Math.sin(t.t * 1.5 + t.ph) * 1.8, z = 6 + bob, tn = WLD_tn(t.lv, t.color || '#8a8474'), gl = WLD_c(t.lv, t.glow || '#6fe8d0');
    r.shadow(t.x, t.y, 4.5 - bob * .3, .4);
    const shape = s => [[-4 * s, 0], [4 * s, 0], [3.4 * s, -13 * s], [0, -16 * s], [-3.6 * s, -12.5 * s]];
    WLD_act(r, t.x, t.y, z, (g, ox, oy) => {
      const s = WLD_zm(r), p = WLD_off(ox, oy, shape(s));
      px.poly(g, p, tn.base); px.poly(g, [p[0], [ox, oy], [ox, oy - 16 * s], p[4]], tn.lt); px.poly(g, [[ox + 1.5 * s, oy], p[1], p[2], [ox + 1 * s, oy - 14 * s]], tn.sh);
      px.line(g, ox - 3 * s, oy - 4 * s, ox + 2 * s, oy - 5 * s, tn.deep); px.dot(g, ox - 2 * s, oy - 11 * s, tn.hi);
    }, { outline: true });
    r.queue(t.x, t.y, z, g => {   // the rune: a glyph that brightens and dims
      const [ox, oy] = r.w(t.x, t.y, z), s = WLD_zm(r), k = .6 + .4 * Math.sin(t.t * 2.3 + t.ph);
      px.glow(g, 1); r.glowDisc(g, ox, oy - 8 * s, 4.5 * s, gl, .12 * k);
      px.line(g, ox, oy - 12 * s, ox, oy - 4 * s, gl); px.line(g, ox - 2 * s, oy - 10 * s, ox + 2 * s, oy - 7 * s, gl); px.line(g, ox + 2 * s, oy - 10 * s, ox - 1 * s, oy - 6 * s, E.tones(gl).hi);
    }, { emissive: true, bias: .01 });
    if (r.visible(t.x, t.y, 0)) L.add(t.x, t.y, 4, 34, .28, { color: gl });
  } },
  /* rocks floating over the void, bobbing and slowly tumbling (ruins, sky, abyss) */
  // off an island's rim (t.nx, t.ny: outward) the rocks hang near floor level; those on the side facing the camera
  // may sink below it (they are in front of the cliff), those behind stay above it (else they would paint over the floor)
  rubble: { init(t) { t.rocks = Array.from({ length: 1 + (Math.random() * 3 | 0) }, (_, i) => ({ dx: (Math.random() - .5) * 12, dy: (Math.random() - .5) * 12, z: -8 + Math.random() * 16 + i * 4, r: 2.5 + Math.random() * 3.5, n: 5 + (Math.random() * 3 | 0), sp: (Math.random() - .5) * .8, ph: Math.random() * TAU })); },
    draw(t, r) {
      const tn = WLD_tn(t.lv, t.color || '#6a6254'), lip = WLD_c(t.lv, t.lip || '#6f8a44'), front = t.nx !== undefined && t.nx * r.view.fx + t.ny * r.view.fy > .2;
      for (const q of t.rocks) {
        const z = Math.max(front ? -10 : 4, q.z) + Math.sin(t.t * 1.1 + q.ph) * 2.2;
        WLD_act(r, t.x + q.dx, t.y + q.dy, z, (g, ox, oy) => {
          const s = WLD_zm(r), rr = q.r * s, a0 = t.t * q.sp + q.ph, pts = [];
          for (let i = 0; i < q.n; i++) { const a = a0 + i / q.n * TAU, k = .75 + .25 * E.hash2(i, q.n + (q.r * 7 | 0)); pts.push([ox + Math.cos(a) * rr * k, oy + Math.sin(a) * rr * .8 * k + (Math.sin(a) > 0 ? rr * .5 : 0)]); }
          px.poly(g, pts, tn.sh); px.poly(g, pts.map(p => [p[0], p[1] - (p[1] > oy ? rr * .45 : 0)]), tn.base);
          px.ell(g, ox - rr * .15, oy - rr * .35, rr * .7, rr * .3, E.tones(lip).base); px.ell(g, ox - rr * .3, oy - rr * .45, rr * .35, rr * .15, E.tones(lip).lt);
          px.dot(g, ox + rr * .3, oy + rr * .5, tn.deep);
        }, { outline: true });
      }
      if (Math.random() < .01) { const q = t.rocks[0]; P.add({ kind: 'bit', x: t.x + q.dx, y: t.y + q.dy, z: q.z - 2, vz: -5, g: 120, max: 1.5, color: tn.sh, size: 1 }); }
      // the lights are measured on the ground under each pixel, and under a rock hanging over the void there is only
      // the dark: a small soft light where the rocks' pixels land on the ground keeps them readable
      if (r.visible(t.x, t.y, 12)) { const v = r.view, p = v.p(t.x, t.y, 12), q = v.inv ? v.toGround(p[0], p[1]) : [t.x, t.y]; L.add(q[0], q[1], 12, 30, .5, { color: '#ffe8d0' }); }
    } },
  /* a stone crucible of molten metal: bubbles swell and pop, sparks spit (forge) */
  crucible: { r: 7, init(t) { t.bub = []; }, update(t, dt) {
      if (Math.random() < dt * 3) t.bub.push({ a: Math.random() * TAU, d: Math.random() * 4, t: 0, max: .5 + Math.random() * .6 });
      for (const b of t.bub) b.t += dt; t.bub = t.bub.filter(b => { if (b.t < b.max) return true; if (Math.random() < .5) P.add({ kind: 'ember', x: t.x + Math.cos(b.a) * b.d, y: t.y + Math.sin(b.a) * b.d, z: 12.5, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 30 + Math.random() * 40, g: 60, max: .8, color: '#ff8a3a' }); return false; });
    },
    // a made thing, not the ground: a tall iron-hooped vessel (rivets, two lugs, a pouring lip) full of pale molten metal,
    // so it never reads as one of the magma mechanic's rock-cone vents
    draw(t, r) {
      const ir = WLD_tn(t.lv, '#55525e'), hp = WLD_tn(t.lv, '#7a7684'), mo = ['#fff6d0', '#ffe070', '#ffb040', '#d86a1a'], H = 12, R0 = 7, v = r.view, sp = t.ph;
      r.queue(t.x, t.y, 0, g => {
        px.poly(g, r.groundPts(t.x, t.y, R0 + 1.4, 16, 0), ir.deep);                              // its foot in the soot
        WLD_cyl(g, r, t.x, t.y, 0, H, R0, ir, 16, false);                                          // the iron body
        for (const z of [1.5, 6.5]) {                                                               // two raised hoops, riveted
          WLD_cyl(g, r, t.x, t.y, z, z + 1.4, R0 + .45, hp, 16, false);
          for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + .2; if (Math.cos(a) * v.fx + Math.sin(a) * v.fy < .25) continue; const [qx, qy] = r.w(t.x + Math.cos(a) * (R0 + .6), t.y + Math.sin(a) * (R0 + .6), z + .7); px.dot(g, qx, qy, hp.hi); }
        }
        for (const s of [-1, 1]) { const ax = t.x + s * (R0 + .2); r.box(g, Math.min(ax, ax + s * 2.4), t.y - 1.4, H - 5, Math.max(ax, ax + s * 2.4), t.y + 1.4, H - 2.5, hp.lt, hp.sh); }   // the lugs it is hoisted by
        const a0 = sp, lip = [r.w(t.x + Math.cos(a0 - .35) * R0, t.y + Math.sin(a0 - .35) * R0, H), r.w(t.x + Math.cos(a0) * (R0 + 3.2), t.y + Math.sin(a0) * (R0 + 3.2), H + .8), r.w(t.x + Math.cos(a0 + .35) * R0, t.y + Math.sin(a0 + .35) * R0, H)];
        px.poly(g, r.groundPts(t.x, t.y, R0 + .7, 16, H), hp.lt); px.poly(g, lip, hp.base); px.poly(g, r.groundPts(t.x, t.y, R0 - 1.1, 16, H), ir.deep);   // the rim, the pouring lip
        // the metal: in this same depth-sorted draw (its own light keeps it bright), not the emissive pass, which the
        // engine paints again over everything and so over a hero standing in front of it
        px.glow(g, 1); const k = .5 + .5 * Math.sin(t.t * 1.7);
        px.poly(g, r.groundPts(t.x, t.y, R0 - 1.5, 16, H - .4), mo[3]); px.poly(g, r.groundPts(t.x + .4, t.y + .4, R0 - 2.4, 14, H - .4), mo[2]);
        px.poly(g, r.groundPts(t.x - .8 + k, t.y - .8, R0 - 4, 12, H - .4), mo[1]);
        for (const b of t.bub) { const u = b.t / b.max, [bx, by] = r.w(t.x + Math.cos(b.a) * b.d, t.y + Math.sin(b.a) * b.d, H - .2), rr = (.8 + u * 1.8) * WLD_zm(r); px.disc(g, bx, by, rr, u > .8 ? mo[0] : mo[1]); px.dot(g, bx - rr * .4, by - rr * .4, mo[0]); }
      });
      if (r.visible(t.x, t.y, 0)) { L.add(t.x, t.y, 16, 70, .8 + .1 * Math.sin(t.t * 7), { color: '#ffb050' }); L.heat(t.x, t.y, 14, 7, .8); }
    } },
  /* an anvil on an oak stump, an ingot glowing on its face; now and then a hammer-blow of sparks (forge) */
  anvil: { r: 6, update(t, dt) { if ((t.cd = (t.cd || 2) - dt) <= 0) { t.cd = 1.5 + Math.random() * 3; t.hit = .25; P.sparks(t.x, t.y, 17, 6 + (Math.random() * 6 | 0), null, { color: '#ffb040', hot: '#fff6c0' }); } t.hit = Math.max(0, (t.hit || 0) - dt); },
    draw(t, r) {
      const ir = WLD_tn(t.lv, '#5a5c68'), wd = WLD_tn(t.lv, '#4e3622'), A = t.rot ? [0, 1] : [1, 0], B = [A[1], A[0]];
      const bx = (u, v, z0, u1, v1, z1, top, side) => r.box(g0, t.x + Math.min(u * A[0] + v * B[0], u1 * A[0] + v1 * B[0]), t.y + Math.min(u * A[1] + v * B[1], u1 * A[1] + v1 * B[1]), z0, t.x + Math.max(u * A[0] + v * B[0], u1 * A[0] + v1 * B[0]), t.y + Math.max(u * A[1] + v * B[1], u1 * A[1] + v1 * B[1]), z1, top, side);
      let g0 = null;
      r.queue(t.x, t.y, 0, g => {
        g0 = g; WLD_cyl(g, r, t.x, t.y, 0, 5, 5.5, wd, 12);
        for (let k = 0; k < 7; k++) { const a = k * .9 + .3, nx = Math.cos(a), ny = Math.sin(a); if (nx * r.view.fx + ny * r.view.fy < .2) continue; const p0 = r.w(t.x + nx * 5.6, t.y + ny * 5.6, .5), p1 = r.w(t.x + nx * 5.6, t.y + ny * 5.6, 4.5); px.line(g, p0[0], p0[1], p1[0], p1[1], wd.deep); }
        px.poly(g, r.groundPts(t.x, t.y, 4.4, 12, 5), wd.base); px.poly(g, r.groundPts(t.x, t.y, 3, 10, 5), wd.lt); px.poly(g, r.groundPts(t.x, t.y, 1.6, 8, 5), wd.base);
        bx(-4, -3, 5, 4, 3, 7.5, ir.sh, ir.deep);          // the foot
        bx(-2.4, -1.8, 7.5, 2.4, 1.8, 11, ir.sh, ir.deep); // the waist
        bx(-7, -1.6, 12.5, -5.5, 1.6, 15, ir.lt, ir.sh);   // the heel
        bx(-5.5, -2.6, 11, 5, 2.6, 15, ir.lt, ir.base);    // the face
        const h0 = r.w(t.x + 5 * A[0], t.y + 5 * A[1], 15), h1 = r.w(t.x + 10.5 * A[0], t.y + 10.5 * A[1], 14.2), h2 = r.w(t.x + 5 * A[0], t.y + 5 * A[1], 11.5), hs = r.w(t.x + 5 * A[0] + 2.6 * B[0], t.y + 5 * A[1] + 2.6 * B[1], 15), hn = r.w(t.x + 5 * A[0] - 2.6 * B[0], t.y + 5 * A[1] - 2.6 * B[1], 15);
        px.poly(g, [hn, h1, hs], ir.lt); px.poly(g, [hs, h1, h2], ir.base); px.line(g, hn[0], hn[1], h1[0], h1[1], ir.hi);
      });
      r.queue(t.x, t.y, 15, g => { const k = .6 + .4 * Math.sin(t.t * 3) + (t.hit || 0) * 2; px.glow(g, 1); r.box(g, t.x - 2.6 * A[0] - .9 * B[0], t.y - 2.6 * A[1] - .9 * B[1], 15, t.x + 2.6 * A[0] + .9 * B[0], t.y + 2.6 * A[1] + .9 * B[1], 16.4, k > 1 ? '#fff0b0' : '#ffb040', '#ff6a2a'); }, { emissive: true, bias: .002 });
      if (r.visible(t.x, t.y, 0)) L.add(t.x, t.y, 16, 40, .5 + (t.hit || 0) * 3, { color: '#ff9a4a' });
    } },
  /* a chain hanging out of the dark, swinging a little, a hook (or a cage of bones) at its end */
  chain: { hangs: true, draw(t, r) {
      const ir = WLD_tn(t.lv, t.color || '#5a5866'), len = t.len || 40, z0 = 96, z1 = z0 - len, sw = Math.sin(t.t * 1.2 + t.ph) * .1 + Math.sin(t.t * .43 + t.ph * 2) * .05;
      const bx = t.x + Math.sin(sw) * len * .35, by = t.y + Math.sin(sw) * len * .2;
      WLD_act(r, bx, by, z1, (g, ox, oy) => {
        const s = WLD_zm(r), [tx, ty] = r.w(t.x, t.y, z0), [ex, ey] = r.w(bx, by, z1), top = [tx - ex + ox, ty - ey + oy], n = Math.max(3, Math.round(Math.hypot(top[0] - ox, top[1] - oy) / (3 * s)));
        for (let i = 0; i < n; i++) { const u = i / n, lx = lerp(top[0], ox, u), ly = lerp(top[1], oy, u); if (i & 1) px.rect(g, lx - .5, ly - 1.5 * s, Math.max(1, s), 3 * s, ir.sh); else { px.ell(g, lx, ly, 1.3 * s, 1.8 * s, ir.base); px.dot(g, lx, ly, ir.deep); px.dot(g, lx - s * .6, ly - s, ir.lt); } }
        if (t.cage) {
          const cw = 6 * s, ch = 13 * s, cy0 = oy + 1;
          px.ell(g, ox, cy0 + ch, cw, 2 * s, ir.deep);
          const bt = WLD_tn(t.lv, '#d8ceb4'); px.disc(g, ox - 1 * s, cy0 + ch - 3 * s, 2.2 * s, bt.base); px.dot(g, ox - 1.8 * s, cy0 + ch - 3.4 * s, bt.deep); px.dot(g, ox - .2 * s, cy0 + ch - 3.4 * s, bt.deep); px.line(g, ox + 1 * s, cy0 + ch - 1.5 * s, ox + 4 * s, cy0 + ch - 5 * s, bt.sh);
          for (let k = -2; k <= 2; k++) { const kx = ox + k * cw * .42; px.line(g, kx, cy0 + 2 * s, kx, cy0 + ch, Math.abs(k) === 2 ? ir.sh : k < 0 ? ir.lt : ir.base); }
          px.ell(g, ox, cy0 + 2 * s, cw, 1.6 * s, ir.lt); px.ell(g, ox, cy0 + 2 * s, cw - s, .8 * s, ir.deep); px.poly(g, [[ox - cw, cy0 + 2 * s], [ox, cy0 - 3 * s], [ox + cw, cy0 + 2 * s]], ir.sh);
        } else { px.line(g, ox, oy, ox, oy + 5 * s, ir.base, Math.max(1, Math.round(s))); px.line(g, ox, oy + 5 * s, ox + 3 * s, oy + 3 * s, ir.base, Math.max(1, Math.round(s))); px.dot(g, ox - s * .5, oy + 2 * s, ir.lt); }
      }, { outline: true, rim: false });
    } },
  /* clusters of spikes: ice, crystal or stalagmite (color, glow, blunt) */
  spikes: { r: 5, init(t) { const n = t.n || 3 + (Math.random() * 3 | 0); t.sp = Array.from({ length: n }, (_, i) => ({ dx: (i - (n - 1) / 2) * (3.2 + Math.random()) + (Math.random() - .5) * 2, h: (t.h || 18) * (i === (n >> 1) ? 1 : .45 + Math.random() * .45), w: 2.2 + Math.random() * 1.6, lean: (Math.random() - .5) * .5 })).sort((a, b) => a.h - b.h); },
    draw(t, r) {
      const tn = WLD_tn(t.lv, t.color || '#a8d8f8');
      r.shadow(t.x, t.y, 7, .45);
      WLD_act(r, t.x, t.y, 0, (g, ox, oy) => {
        const s = WLD_zm(r);
        for (const q of t.sp) {
          const bx = ox + q.dx * s, w = q.w * s, tx = bx + q.lean * q.h * s, ty = oy - q.h * s, tip = t.blunt ? 1.2 * s : 0;
          px.poly(g, [[bx - w, oy + 1], [tx - tip, ty + tip], [tx + tip, ty + tip], [bx + w, oy + 1]], tn.base);
          px.poly(g, [[bx - w, oy + 1], [tx - tip, ty + tip], [bx - w * .1, oy + 1]], tn.lt);
          px.poly(g, [[bx + w * .45, oy + 1], [tx + tip, ty + tip], [bx + w, oy + 1]], tn.sh);
          if (!t.blunt) { px.line(g, bx - w * .15, oy - 1, tx, ty + 1, tn.hi); px.dot(g, tx, ty + 1, '#ffffff'); }
          else px.line(g, bx - w * .5, oy - q.h * s * .4, bx - w * .3, oy - q.h * s * .8, tn.lt);
        }
      }, { outline: true });
      if (t.glow) {
        r.queue(t.x, t.y, 0, g => { const [ox, oy] = r.w(t.x, t.y, 0), s = WLD_zm(r), k = .7 + .3 * Math.sin(t.t * 2 + t.ph); px.glow(g, 1); r.glowDisc(g, ox, oy - (t.h || 18) * .5 * s, 10 * s, tn.lt, .16 * k); }, { emissive: true, bias: .01 });
        if (r.visible(t.x, t.y, 0)) L.add(t.x, t.y, 10, 54, .55, { color: tn.lt });
      }
      if (!t.blunt && Math.random() < .012) { const q = t.sp[t.sp.length - 1]; P.glints(t.x + q.dx, t.y, q.h * .9, 1, '#ffffff', 3); }
    } },
  /* icicles along the top edge of a pillar face; the long one drips (frost) */
  icicles: { init(t) { t.ic = Array.from({ length: 5 }, (_, i) => ({ o: (i - 2) * 3 + (Math.random() - .5), l: 3 + Math.random() * 8 })); t.drip = Math.random() * 3; },
    update(t, dt) { if ((t.drip -= dt) <= 0) { t.drip = 1.5 + Math.random() * 3; const q = t.ic.reduce((a, b) => a.l > b.l ? a : b); P.add({ kind: 'bit', x: t.x + t.nx * .5 + q.o * Math.abs(t.ny), y: t.y + t.ny * .5 + q.o * Math.abs(t.nx), z: t.top - q.l, vz: -4, g: 260, bounce: .15, max: 1.1, color: '#d8f2ff', size: 1 }); } },
    draw(t, r) {
      const tn = WLD_tn(t.lv, '#b8e4fa');
      r.queue(t.x, t.y, t.top, g => {
        for (const q of t.ic) {
          const ax = t.x + q.o * Math.abs(t.ny), ay = t.y + q.o * Math.abs(t.nx), [x0, y0] = r.w(ax, ay, t.top), [x1, y1] = r.w(ax, ay, t.top - q.l), w = 1.4 * WLD_zm(r);
          px.poly(g, [[x0 - w, y0], [x0 + w, y0], [x1, y1]], tn.base); px.line(g, x0 - w * .5, y0, x1, y1 - 1, tn.hi); px.rect(g, x0 - w, y0 - 1, w * 2 + 1, 1.5, '#eef8ff');
        }
      }, { bias: .001 });
    } },
  /* a giant mushroom: a cap that breathes and glows, spores puffing from its gills (fungal) */
  shroom: { r: 4, update(t, dt) { if ((t.cd = (t.cd === undefined ? Math.random() * 4 : t.cd) - dt) <= 0) { t.cd = 3 + Math.random() * 4; for (let i = 0; i < 7; i++) P.add({ kind: 'glint', x: t.x + (Math.random() - .5) * 16, y: t.y + (Math.random() - .5) * 16, z: (t.h || 26) * .9, vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 8, vz: 4 + Math.random() * 8, max: 1.6 + Math.random(), size: 1, color: WLD_c(t.lv, t.glow || '#9affd8') }); } },
    draw(t, r) {
      const cap = WLD_tn(t.lv, t.color || '#3ab0a0'), stk = WLD_tn(t.lv, '#d8cfb8'), H = t.h || 26, k = 1 + .035 * Math.sin(t.t * 1.8 + t.ph), gl = WLD_c(t.lv, t.glow || '#9affd8');
      r.shadow(t.x, t.y, 9, .35);
      WLD_act(r, t.x, t.y, 0, (g, ox, oy) => {
        const s = WLD_zm(r), top = oy - H * s, cw = (t.w || 12) * s * k, bend = Math.sin(t.ph) * 3 * s;
        px.poly(g, [[ox - 3.2 * s, oy], [ox + 3.2 * s, oy], [ox + 2.2 * s + bend, top + 2 * s], [ox - 2.2 * s + bend, top + 2 * s]], stk.base);
        px.poly(g, [[ox - 3.2 * s, oy], [ox - 1 * s, oy], [ox - .5 * s + bend, top + 2 * s], [ox - 2.2 * s + bend, top + 2 * s]], stk.lt);
        px.poly(g, [[ox + 1.6 * s, oy], [ox + 3.2 * s, oy], [ox + 2.2 * s + bend, top + 2 * s], [ox + 1.2 * s + bend, top + 2 * s]], stk.sh);
        px.ell(g, ox + bend, top + 2.5 * s, cw * .95, 3 * s, cap.deep);                                    // the gills underneath
        for (let i = -3; i <= 3; i++) px.line(g, ox + bend, top + 2 * s, ox + bend + i * cw * .28, top + 3.6 * s, cap.sh);
        px.ell(g, ox + bend, top, cw, 5.5 * s * k, cap.sh); px.ell(g, ox + bend - s, top - s, cw - 1.5 * s, 4.6 * s * k, cap.base);
        px.ell(g, ox + bend - cw * .3, top - 2.5 * s, cw * .45, 2 * s, cap.lt); px.dot(g, ox + bend - cw * .45, top - 3.2 * s, cap.hi);
        // the glowing spots, in this same depth-sorted draw (its own light keeps them bright): in the emissive pass the
        // engine paints them again over everything, over a hero walking in front of the cap too
        px.glow(g, 1);
        for (const [dx, dy, rr] of [[-.5, -.2, 1.3], [.2, -.5, 1], [.55, .05, 1.1], [-.1, .2, .9]]) { px.disc(g, ox + bend + dx * cw, top + dy * 4 * s, rr * s, gl); px.dot(g, ox + bend + dx * cw - .5, top + dy * 4 * s - .5, '#ffffff'); }
      }, { outline: true });
      r.queue(t.x, t.y, 0, g => {   // the cap's faint halo (a low-alpha wash, harmless over what stands in front)
        const [ox, oy] = r.w(t.x, t.y, 0), s = WLD_zm(r), top = oy - H * s, bend = Math.sin(t.ph) * 3 * s, cw = (t.w || 12) * s, pk = .7 + .3 * Math.sin(t.t * 2.4 + t.ph);
        px.glow(g, 1); r.glowDisc(g, ox + bend, top - 2 * s, cw * .9, gl, .07 * pk);
      }, { emissive: true, bias: .01 });
      if (r.visible(t.x, t.y, 0)) L.add(t.x, t.y, H, 64, .55 + .15 * Math.sin(t.t * 2.4 + t.ph), { color: gl });
    } },
  /* a spore pod: it breathes, swells, bursts in a cloud of spores and slowly grows back (fungal) */
  pod: { update(t, dt) { t.grow = Math.min(1, (t.grow === undefined ? 1 : t.grow) + dt * .25); if (t.grow >= 1 && Math.random() < dt * .12) { t.grow = 0; for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, sp = 10 + Math.random() * 20; P.add({ kind: 'dust', x: t.x, y: t.y, z: 5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 10 + Math.random() * 16, g: -2, drag: 1.5, max: 1.2 + Math.random(), size: 1.6, color: WLD_c(t.lv, '#8ae0b0') }); } } },
    draw(t, r) {
      const tn = WLD_tn(t.lv, t.color || '#7a4a8a'), gv = t.grow === undefined ? 1 : t.grow, sz = .35 + .65 * E.ease.outBack(gv), br = Math.sin(t.t * 2.2 + t.ph) * .07, gl = WLD_c(t.lv, '#9affc8');
      WLD_act(r, t.x, t.y, 0, (g, ox, oy) => {
        const s = WLD_zm(r) * sz, rx = 6 * s * (1 + br), ry = 5.5 * s * (1 - br);
        px.ell(g, ox, oy - ry, rx, ry, tn.sh); px.ell(g, ox - s * .6, oy - ry - s * .6, rx - s, ry - s, tn.base);
        px.ell(g, ox - rx * .35, oy - ry * 1.45, rx * .35, ry * .3, tn.lt);
        for (const a of [-.9, 0, .8]) px.line(g, ox + Math.sin(a) * rx * .3, oy - ry * 1.9, ox + Math.sin(a) * rx, oy - ry * .5, tn.deep);
        px.ell(g, ox, oy - ry * 2 + s, 1.6 * s, 1 * s, tn.deep);
      }, { outline: true });
      r.queue(t.x, t.y, 0, g => { const [ox, oy] = r.w(t.x, t.y, 0), s = WLD_zm(r) * sz; px.glow(g, 1); r.glowDisc(g, ox, oy - 5 * s, 6 * s, gl, (.1 + .08 * Math.sin(t.t * 2.2 + t.ph)) * gv); px.dot(g, ox, oy - 11 * s + s, gl); }, { emissive: true, bias: .01 });
    } },
  /* glow-worm threads hanging from the top edge of a wall or a pillar, beads of light swaying on them (fungal, cavern).
   * They need stone to hang from: placed against a back wall (or on a pillar's face; nx, ny point at the stone), each
   * thread is rooted in a knot of silk at the stone's lip, a hair out from its face. With nothing beside it the cluster
   * is dropped (threads anchored in mid-air hung over open floor from the top of the screen) */
  glowworms: { hangs: true, init(t, L0) {
      const nx = t.nx || 0, ny = t.ny || 0, cx = Math.floor(t.x / T16), cy = Math.floor(t.y / T16), m = L0.map, top = (nx || ny) ? m.height(cx + nx, cy + ny) : 0;
      // a wall that drops to its cut height in the standard views (floor within four cells behind it: north for the
      // views that look from the south, west and north-west too for iso) would leave the threads hanging from nothing
      const wx = cx + nx, wy = cy + ny, T = m.types[m.cell(wx, wy)], thin = T && T.cut && [1, 2, 3, 4].some(k => m.cell(wx, wy - k) === 0 || m.cell(wx - k, wy) === 0 || m.cell(wx - k, wy - k) === 0);
      if (!(top > 8 && top < 200) || thin) { t.dead = t.hidden = true; return; }
      t.wx = wx; t.wy = wy;
      t.top = top - .5; t.tx = -ny; t.ty = nx;   // the lip's height, and the direction along the face
      t.ax = nx ? (cx + (nx > 0 ? 1 : 0)) * T16 - nx * 1.5 : t.x; t.ay = ny ? (cy + (ny > 0 ? 1 : 0)) * T16 - ny * 1.5 : t.y;
      t.th = Array.from({ length: 5 }, (_, i) => ({ s: (i - 2) * 4.5 + (Math.random() - .5) * 3, out: Math.random() * 2, l: 7 + Math.random() * 15, ph: Math.random() * TAU }));
    },
    draw(t, r) {
      const m = t.lv.map; if (t.top === undefined || (m.cutaway && m._isFront && m._isFront(t.wx, t.wy, r.view))) return;   // (its wall is cut down in this view)
      const gl = WLD_c(t.lv, t.glow || '#8affe0'), gt = E.tones(gl), knot = WLD_tn(t.lv, '#4a5a56');
      r.queue(t.ax, t.ay, t.top - 10, g => {
        const zm = WLD_zm(r), kw = Math.max(1, Math.round(zm));
        for (const q of t.th) {   // (out: a thread hangs a little clear of the face; its sway runs along the wall)
          const bx = t.ax + t.tx * q.s - t.nx * q.out, by = t.ay + t.ty * q.s - t.ny * q.out, sw = Math.sin(t.t * .9 + q.ph) * 1.6;
          const [x0, y0] = r.w(bx, by, t.top), [x1, y1] = r.w(bx + t.tx * sw, by + t.ty * sw, t.top - q.l);
          px.line(g, x0, y0, x1, y1, gt.deep);
          px.glow(g, 1);
          for (let k = 1; k <= 3; k++) { const u = k / 3.2; px.dot(g, lerp(x0, x1, u), lerp(y0, y1, u), gt.base); }
          px.rect(g, x1 - .5, y1 - .5, 2, 2, gl); px.dot(g, x1, y1, '#ffffff');
          px.glow(g, 0); px.rect(g, Math.round(x0) - kw, Math.round(y0) - 1, kw * 2 + 1, 2, knot.deep); px.dot(g, x0, y0 - 1, knot.lt);   // the knot it hangs from
        }
      }, { emissive: true });
      if (r.visible(t.ax, t.ay, t.top)) L.add(t.ax, t.ay, t.top - 12, 56, .35, { color: gl });
    } },
  /* a mine cart standing on its rails, heaped with ore; the stormglass in it glints (mine) */
  cart: { r: 7, draw(t, r) {
      const wd = WLD_tn(t.lv, '#6a4a2e'), ir = WLD_tn(t.lv, '#4a4a56'), ore = WLD_tn(t.lv, '#6a625a'), gl = WLD_c(t.lv, '#6ad8ff'), a = t.alongY ? 0 : 1, b = 1 - a;
      r.queue(t.x, t.y, 0, g => {
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const [wx, wy] = r.w(t.x + sx * (4.5 * a + 4.2 * b), t.y + sy * (4.5 * b + 4.2 * a), 2.2), s = WLD_zm(r); px.disc(g, wx, wy, 2.2 * s, ir.deep); px.dot(g, wx, wy, ir.lt); }
        r.box(g, t.x - 7 * a - 4 * b, t.y - 7 * b - 4 * a, 3, t.x + 7 * a + 4 * b, t.y + 7 * b + 4 * a, 10, wd.deep, wd.base);
        const band = z => { const p0 = r.w(t.x - 7 * a - 4 * b, t.y + 7 * b + 4 * a, z), p1 = r.w(t.x + 7 * a + 4 * b, t.y + 7 * b + 4 * a, z), p2 = r.w(t.x + 7 * a + 4 * b, t.y - 7 * b - 4 * a, z); px.line(g, p0[0], p0[1], p1[0], p1[1], ir.base); px.line(g, p1[0], p1[1], p2[0], p2[1], ir.sh); };
        band(4.5); band(9.2);
        for (let i = 0; i < 7; i++) { const ox2 = E.hash2(i, 3) * 10 - 5, oy2 = E.hash2(i, 5) * 6 - 3, [rx, ry] = r.w(t.x + ox2 * a + oy2 * b, t.y + ox2 * b + oy2 * a, 10.5 + E.hash2(i, 9) * 2), s = WLD_zm(r); px.disc(g, rx, ry, 2 * s, ore.sh); px.disc(g, rx - .5, ry - .5, 1.4 * s, ore.base); px.dot(g, rx - 1, ry - 1, ore.lt); }
      });
      r.queue(t.x, t.y, 12, g => { const s = WLD_zm(r); for (let i = 0; i < 3; i++) { const [cx, cy] = r.w(t.x + (i - 1) * 3 * a, t.y + (i - 1) * 3 * b, 12.5 + i % 2); px.glow(g, 1); px.poly(g, [[cx - 1.2 * s, cy + 1], [cx, cy - 3 * s], [cx + 1.2 * s, cy + 1]], gl); px.dot(g, cx, cy - 2 * s, '#ffffff'); } }, { emissive: true, bias: .01 });
      if (Math.random() < .01) P.glints(t.x, t.y, 13, 1, gl, 8);
    } },
  /* a timber post with an arm, a lantern swinging from it (mine) */
  post: { r: 2.5, draw(t, r) {
      const wd = WLD_tn(t.lv, '#7a5a36'), ax = t.nx ? -t.nx : 1, ay = t.ny ? -t.ny : 0, sw = Math.sin(t.t * 1.6 + t.ph) * 1.6, lx = t.x + ax * 9 + sw * ay, ly = t.y + ay * 9 + sw * ax;
      r.queue(t.x, t.y, 0, g => {
        r.box(g, t.x - 1.5, t.y - 1.5, 0, t.x + 1.5, t.y + 1.5, 40, wd.lt, wd.base);
        r.box(g, Math.min(t.x, t.x + ax * 10) - .8 * Math.abs(ay) - .01, Math.min(t.y, t.y + ay * 10) - .8 * Math.abs(ax), 35.5, Math.max(t.x, t.x + ax * 10) + .8 * Math.abs(ay) + .01, Math.max(t.y, t.y + ay * 10) + .8 * Math.abs(ax), 37.5, wd.base, wd.sh);
        const b0 = r.w(t.x + ax * 1.5, t.y + ay * 1.5, 30), b1 = r.w(t.x + ax * 5.5, t.y + ay * 5.5, 35.5); px.line(g, b0[0], b0[1], b1[0], b1[1], wd.sh, 2);
      });
      r.queue(lx, ly, 28, g => {
        const s = WLD_zm(r), [hx, hy] = r.w(t.x + ax * 9, t.y + ay * 9, 35), [x, y] = r.w(lx, ly, 29);
        px.line(g, hx, hy, x, y - 5 * s, '#2a2024');
        px.rect(g, x - 3 * s, y - 7 * s, 6 * s, 1.5 * s, '#2a2024'); px.rect(g, x - 2.5 * s, y - 5.5 * s, 5 * s, 6 * s, '#ffc860'); px.rect(g, x - 1.2 * s, y - 5 * s, 2.4 * s, 4.5 * s, '#fff4c0'); px.rect(g, x - 2.5 * s, y - 5.5 * s, Math.max(1, .6 * s), 6 * s, '#2a2024'); px.rect(g, x + 1.9 * s, y - 5.5 * s, Math.max(1, .6 * s), 6 * s, '#2a2024'); px.rect(g, x - 3 * s, y + .5 * s, 6 * s, 1.5 * s, '#2a2024');
        px.glow(g, 1); r.glowDisc(g, x, y - 2 * s, 7 * s, '#ffc060', .2);
      }, { emissive: true });
      if (r.visible(t.x, t.y, 0)) L.add(lx, ly, 26, 70, .8 * flicker(t.t), { color: '#ffc070' });
    } },
  /* a gear set into the floor in its dark slot, turning (a meshing pair when t.pair) (clockwork) */
  gear: { draw(t, r) {
      const br = WLD_tn(t.lv, t.color || '#c89a48'), R1 = t.rad || 11, gears = [[t.x, t.y, R1, t.t * .6, 12]];
      if (t.pair) gears.push([t.x + Math.cos(t.pa) * (R1 * 1.6), t.y + Math.sin(t.pa) * (R1 * 1.6), R1 * .62, -t.t * .6 * 12 / 8 + .2, 8]);
      r.decal(g => {
        for (const [gx, gy, rr] of gears) px.poly(g, r.groundPts(gx, gy, rr + 1.6, 22), '#141218');
        for (const [gx, gy, rr, a, n] of gears) {
          px.poly(g, WLD_gearPts(n, rr * .8, rr, a, (u, v) => r.w(gx + u, gy + v, 0)), br.sh);
          px.poly(g, WLD_gearPts(n, rr * .8 - .9, rr - .9, a, (u, v) => r.w(gx + u - .5, gy + v - .5, 0)), br.base);
          px.poly(g, r.groundPts(gx - .4, gy - .4, rr * .7, 18), br.lt);
          px.poly(g, r.groundPts(gx, gy, rr * .6, 16), br.base);
          for (let k = 0; k < 4; k++) { const sa = a + k / 4 * TAU + .4, sb = sa + .95; px.poly(g, [r.w(gx + Math.cos(sa) * rr * .24, gy + Math.sin(sa) * rr * .24), r.w(gx + Math.cos(sa) * rr * .52, gy + Math.sin(sa) * rr * .52), r.w(gx + Math.cos(sb) * rr * .52, gy + Math.sin(sb) * rr * .52), r.w(gx + Math.cos(sb) * rr * .24, gy + Math.sin(sb) * rr * .24)], '#141218'); }
          px.poly(g, r.groundPts(gx, gy, rr * .2, 10), br.lt); const [hx, hy] = r.w(gx - .6, gy - .6); px.dot(g, hx, hy, br.hi);
          const [lx0, ly0] = r.w(gx + Math.cos(a + 2.4) * rr * .78, gy + Math.sin(a + 2.4) * rr * .78), [lx1, ly1] = r.w(gx + Math.cos(a + 3.2) * rr * .78, gy + Math.sin(a + 3.2) * rr * .78); px.line(g, lx0, ly0, lx1, ly1, br.hi);
        }
      });
    } },
  /* an upright gear on an iron stand, turning (a meshing pair when t.pair) (clockwork) */
  cog: { r: 5, draw(t, r) {
      const br = WLD_tn(t.lv, t.color || '#c89a48'), ir = WLD_tn(t.lv, '#4a4e5c');
      WLD_act(r, t.x, t.y, 0, (g, ox, oy) => {
        const s = WLD_zm(r), R1 = (t.rad || 11) * s, cy0 = oy - R1 - 5 * s;
        const one = (cx, cyy, rr, a, n) => {
          px.poly(g, WLD_gearPts(n, rr * .8, rr, a, (u, v) => [cx + u, cyy + v]), br.sh);
          px.poly(g, WLD_gearPts(n, rr * .8 - s, rr - s, a, (u, v) => [cx + u - .6 * s, cyy + v - .6 * s]), br.base);
          px.disc(g, cx, cyy, rr * .62, br.sh);
          for (let k = 0; k < 5; k++) { const sa = a + k / 5 * TAU + .3; px.poly(g, [[cx + Math.cos(sa) * rr * .24, cyy + Math.sin(sa) * rr * .24], [cx + Math.cos(sa) * rr * .56, cyy + Math.sin(sa) * rr * .56], [cx + Math.cos(sa + .7) * rr * .56, cyy + Math.sin(sa + .7) * rr * .56], [cx + Math.cos(sa + .7) * rr * .24, cyy + Math.sin(sa + .7) * rr * .24]], br.deep); }
          px.disc(g, cx, cyy, rr * .22, br.lt); px.dot(g, cx - rr * .08, cyy - rr * .08, br.hi); px.line(g, cx - rr * .55, cyy - rr * .6, cx - rr * .2, cyy - rr * .85, br.lt);
        };
        px.poly(g, [[ox - 5 * s, oy], [ox + 5 * s, oy], [ox + 2 * s, cy0], [ox - 2 * s, cy0]], ir.base); px.poly(g, [[ox + 1 * s, oy], [ox + 5 * s, oy], [ox + 2 * s, cy0], [ox + .5 * s, cy0]], ir.sh);
        one(ox, cy0, R1, t.t * .8 + t.ph, 12);
        if (t.pair) one(ox + R1 * 1.55, cy0 + R1 * .35, R1 * .6, -t.t * .8 * 12 / 8 + .25, 8);
      }, { outline: true });
    } },
  /* a floor grate that breathes steam in bursts (clockwork, forge) */
  vent: { update(t, dt) { t.cd = (t.cd === undefined ? Math.random() * 4 : t.cd) - dt; if (t.cd <= 0) { t.puff = .9; t.cd = 2.5 + Math.random() * 4; } if (t.puff > 0) { t.puff -= dt; if (Math.random() < dt * 22) P.add({ kind: 'smoke', x: t.x + (Math.random() - .5) * 6, y: t.y + (Math.random() - .5) * 6, z: 1, vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 8, vz: 40 + Math.random() * 30, g: -10, drag: 1.4, max: .9 + Math.random() * .6, size: 2.6 + Math.random() * 2, color: WLD_c(t.lv, t.steam || '#b8b8c4'), dark: WLD_c(t.lv, '#8a8a98'), light: '#eeeef6' }); } },
    draw(t, r) {
      const ir = WLD_tn(t.lv, '#3a3a46');
      r.decal(g => {
        const q = (a, b, c, d) => [r.w(t.x + a, t.y + b), r.w(t.x + c, t.y + b), r.w(t.x + c, t.y + d), r.w(t.x + a, t.y + d)];
        px.poly(g, q(-6, -6, 6, 6), ir.lt); px.poly(g, q(-5, -5, 5, 5), ir.deep);
        for (let k = -4; k <= 3; k += 2) px.poly(g, q(-4.5, k, 4.5, k + .8), ir.base);
        if (t.puff > 0) px.blend(g, .4, 'add', () => px.poly(g, q(-5, -5, 5, 5), '#6a6a78'));
      });
    } },
  /* a pyramid of skulls with a candle burning on top (ossuary) */
  skullpile: { r: 5, draw(t, r) {
      const bt = WLD_tn(t.lv, '#d8ceb4');
      WLD_act(r, t.x, t.y, 0, (g, ox, oy) => {
        const s = WLD_zm(r), sk = (x, y) => { px.disc(g, x, y, 2.4 * s, bt.sh); px.disc(g, x - .4 * s, y - .5 * s, 2 * s, bt.base); px.dot(g, x - 1.2 * s, y - 1.4 * s, bt.lt); px.rect(g, x - 1.3 * s, y - .3 * s, Math.max(1, s), Math.max(1, s), bt.deep); px.rect(g, x + .4 * s, y - .3 * s, Math.max(1, s), Math.max(1, s), bt.deep); px.rect(g, x - .8 * s, y + 1.4 * s, 1.8 * s, Math.max(1, .8 * s), bt.sh); };
        for (const [n, row] of [[4, 0], [3, 1], [2, 2], [1, 3]]) for (let i = 0; i < n; i++) sk(ox + (i - (n - 1) / 2) * 4.6 * s, oy - 2.5 * s - row * 3.8 * s);
        const cx = ox, cy = oy - 16 * s; px.rect(g, cx - 1 * s, cy - 4 * s, 2 * s, 4 * s, '#e8dcc0'); px.rect(g, cx + .2 * s, cy - 4 * s, .8 * s, 4 * s, '#b8ac90');
      }, { outline: true });
      r.queue(t.x, t.y, 0, g => { const [ox, oy] = r.w(t.x, t.y, 0), s = WLD_zm(r), cy = oy - 16 * s - 4 * s, f = Math.sin(t.t * 11 + t.ph) * .6; px.glow(g, 1); px.poly(g, [[ox - 1.2 * s, cy], [ox + f, cy - 4 * s], [ox + 1.2 * s, cy]], '#ffb040'); px.dot(g, ox, cy - 1, '#fff4c0'); r.glowDisc(g, ox, cy - 2 * s, 6 * s, '#ffb050', .16); }, { emissive: true, bias: .01 });
      if (r.visible(t.x, t.y, 0)) L.add(t.x, t.y, 22, 44, .55 * flicker(t.t), { color: '#ffb060' });
    } },
  /* a stone sarcophagus, its lid pushed ajar (ossuary) */
  coffin: { r: 7, draw(t, r) {
      const st = WLD_tn(t.lv, t.color || '#5a5250'), a = t.alongY ? 0 : 1, b = 1 - a, L0 = 10, W0 = 5;
      r.queue(t.x, t.y, 0, g => {
        r.box(g, t.x - L0 * a - W0 * b, t.y - L0 * b - W0 * a, 0, t.x + L0 * a + W0 * b, t.y + L0 * b + W0 * a, 7, st.base, st.sh);
        const ox = 1.5 * a + 2 * b, oy = 1.5 * b + 2 * a;
        r.box(g, t.x - L0 * a - W0 * b + ox - .5, t.y - L0 * b - W0 * a + oy - .5, 7, t.x + L0 * a + W0 * b + ox + .5, t.y + L0 * b + W0 * a + oy + .5, 9, st.lt, st.base);
        const c0 = r.w(t.x + ox - 6 * a, t.y + oy - 6 * b, 9.01), c1 = r.w(t.x + ox + 6 * a, t.y + oy + 6 * b, 9.01), c2 = r.w(t.x + ox - 3 * a - 2.5 * b, t.y + oy - 3 * b - 2.5 * a, 9.01), c3 = r.w(t.x + ox - 3 * a + 2.5 * b, t.y + oy - 3 * b + 2.5 * a, 9.01);
        px.line(g, c0[0], c0[1], c1[0], c1[1], st.sh); px.line(g, c2[0], c2[1], c3[0], c3[1], st.sh);
        const [kx, ky] = r.w(t.x + ox + 7 * a, t.y + oy + 7 * b, 9.01), s = WLD_zm(r); px.disc(g, kx, ky, 1.8 * s, st.sh); px.dot(g, kx - .6 * s, ky, st.deep); px.dot(g, kx + .6 * s, ky, st.deep);   // a skull carved at its head
      });
    } },
  /* a pennant on a tall pole streaming in the wind (sky, ruins) */
  banner: { draw(t, r) {
      const cl = WLD_tn(t.lv, t.color || '#c83a3a'), c2 = WLD_tn(t.lv, t.color2 || '#e8d8b0'), pole = WLD_tn(t.lv, t.pole || '#c8a040'), wind = t.wind || 1;
      WLD_act(r, t.x, t.y, 0, (g, ox, oy) => {
        const s = WLD_zm(r), H = (t.h || 46) * s, top = oy - H, dir = t.flip ? -1 : 1, n = 10, len = 20 * s, hh = 7 * s;
        px.rect(g, ox - 1, top, 2, H, pole.base); px.rect(g, ox - 1, top, 1, H, pole.lt); px.disc(g, ox, top - 1, 1.6 * s, pole.lt);
        let prev = null;
        for (let i = 0; i <= n; i++) {
          const u = i / n, wv = Math.sin(t.t * 6 * wind - i * .8 + t.ph) * (1 + u * 3) * s, x = ox + dir * (1 + u * len), y0 = top + 1 * s + wv + u * u * 2 * s, y1 = y0 + hh * (1 - u * .35) - (i === n ? hh * .35 : 0);
          if (prev) { const slope = wv - prev[3], c = ((i >> 1) & 1) ? c2 : cl; px.poly(g, [[prev[0], prev[1]], [x, y0], [x, y1], [prev[0], prev[2]]], slope > .3 * s ? c.sh : slope < -.3 * s ? c.lt : c.base); }
          prev = [x, y0, y1, wv];
        }
      }, { outline: true });
    } },
  /* water pouring out of the dark into a pool: streaks run down, the foot foams and mists (aqueduct, cavern) */
  waterfall: { init(t, L0) { t.top = Math.max(20, (L0.map.height(Math.floor(t.x / T16) + (t.nx || 0), Math.floor(t.y / T16) + (t.ny || 0)) || 40) - 3); },   // it pours from the wall's top, not out of the sky
    update(t, dt) { if (Math.random() < dt * 10) P.add({ kind: 'dust', x: t.x + (Math.random() - .5) * 10, y: t.y + (Math.random() - .5) * 10, z: 1, vx: (Math.random() - .5) * 16, vy: (Math.random() - .5) * 16, vz: 10 + Math.random() * 14, g: 4, drag: 2, max: .8 + Math.random() * .5, size: 1.8, color: '#d8eef8' }); },
    draw(t, r) {
      const wt = WLD_tn(t.lv, t.color || '#4a8ac0'), rr = t.rad || 13;
      r.decal(g => { px.polyDither(g, r.groundPts(t.x, t.y, rr + 1.5, 20), wt.deep, .9, r.ix, r.iy); px.polyDither(g, r.groundPts(t.x, t.y, rr, 20), wt.sh, .85, r.ix, r.iy); for (let k = 0; k < 2; k++) { const u = (t.t * .5 + k * .5) % 1; r.groundRing(t.x, t.y, 3 + u * (rr - 3), wt.hi, (1 - u) * .8); } });
      if ((t.nx || 0) * r.view.fx + (t.ny || 0) * r.view.fy > .3) return;   // the camera turned to look through its wall: the pool alone
      r.queue(t.x, t.y, 0, g => {
        const s = WLD_zm(r), [x0, y0] = r.w(t.x, t.y, 0), [, y1] = r.w(t.x, t.y, t.top || 40), w = (t.w || 5) * s;
        if (y0 - y1 < 2) return;
        px.ell(g, x0, y1, w * 1.5, 2.6 * s, '#101418'); px.rect(g, x0 - w * 1.5, y1 - 2.6 * s, w * 3, 1.2 * s, WLD_tn(t.lv, '#8a908a').lt);   // the culvert it pours from, a lip of stone over it
        for (let x = Math.round(x0 - w); x <= x0 + w; x++) {
          const col = x - Math.round(x0 - w), e = Math.abs(x - x0) / w, base = e > .75 ? wt.sh : e > .4 ? wt.base : wt.lt;
          px.rect(g, x, y1, 1, y0 - y1, base);
          const ph = E.hash2(col, 7) * 40, spd = 90 + E.hash2(col, 3) * 50;
          for (let k = 0; k < 3; k++) { const yy = y1 + (((t.t * spd + ph + k * 37) % (y0 - y1 + 1)) + (y0 - y1)) % (y0 - y1 + 1); px.rect(g, x, yy, 1, 4 + k * 2, k ? wt.hi : '#ffffff'); }
        }
        px.blend(g, .7, 'normal', () => { px.ell(g, x0, y0 - 1 * s, w * 1.6, 3 * s, '#e8f6ff'); px.ell(g, x0 - s, y0 - 2 * s, w, 2 * s, '#ffffff'); });
      }, { bias: .01 });
    } },
  /* a hole in the floor that glows from far below: motes and embers rise out of it, its light breathes (abyss, ruins) */
  rift: { update(t, dt) { if (Math.random() < dt * (t.rate || 10)) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * t.rad * .8; P.add({ kind: 'ember', x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d, z: -2, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, vz: 16 + Math.random() * 22, g: -3, max: 1.4 + Math.random() * 1.4, color: Math.random() < .6 ? WLD_c(t.lv, t.glow || '#b06aff') : WLD_c(t.lv, t.glow2 || '#e8c8ff') }); } },
    draw(t, r) { if (r.visible(t.x, t.y, 0)) L.add(t.x, t.y, 0, t.rad + 34, .55 + .2 * Math.sin(t.t * 1.3 + t.ph), { color: WLD_c(t.lv, t.glow || '#b06aff') }); } },
  /* obsidian shards orbiting a pulsing violet heart (abyss) */
  shard: { init(t) { t.sh = Array.from({ length: 6 }, (_, i) => ({ a: i / 6 * TAU, rr: 8 + Math.random() * 4, z: (Math.random() - .5) * 6, sz: 2 + Math.random() * 1.6, sp: .5 + Math.random() * .4 })); },
    draw(t, r) {
      const ob = WLD_tn(t.lv, '#2e2640'), gl = WLD_c(t.lv, t.glow || '#b06aff'), zc = 20 + Math.sin(t.t * 1.3 + t.ph) * 2, k = .75 + .25 * Math.sin(t.t * 3 + t.ph);
      r.shadow(t.x, t.y, 6, .3);
      r.queue(t.x, t.y, zc, g => { const [x, y] = r.w(t.x, t.y, zc), s = WLD_zm(r); px.glow(g, 1); r.glowDisc(g, x, y, 12 * s * k, gl, .2); px.disc(g, x, y, 3.4 * s * k, E.tones(gl).base); px.disc(g, x - .6 * s, y - .6 * s, 2 * s * k, E.tones(gl).hi); px.dot(g, x - s, y - s, '#ffffff'); }, { emissive: true });
      for (const q of t.sh) {
        const a = q.a + t.t * q.sp, sx = t.x + Math.cos(a) * q.rr, sy = t.y + Math.sin(a) * q.rr, sz = zc + q.z + Math.sin(a * 2 + t.ph) * 3;
        WLD_act(r, sx, sy, sz, (g, ox, oy) => { const s = WLD_zm(r) * q.sz, sp = Math.sin(a * 1.7); px.poly(g, [[ox, oy - 3 * s], [ox + 1.6 * s * sp, oy], [ox, oy + 2.4 * s], [ox - 1.4 * s, oy]], ob.base); px.poly(g, [[ox, oy - 3 * s], [ox - 1.4 * s, oy], [ox, oy + 2.4 * s]], ob.lt); px.dot(g, ox - .3 * s, oy - 1.4 * s, E.tones(gl).lt); }, { outline: true, rim: false });
      }
      if (r.visible(t.x, t.y, 0)) L.add(t.x, t.y, zc, 70, .7 * k, { color: gl });
      if (Math.random() < .05) P.add({ kind: 'ember', x: t.x + (Math.random() - .5) * 10, y: t.y + (Math.random() - .5) * 10, z: zc, vz: 14, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, max: 1.4, color: gl });
    } }
};

/* ---------- THE FLOORS: crafted patterns (slabs, straps, plates, setts, columns), cheap per pixel ----------
 * A theme's floor(): the standard tags first (DESIGN.md), the rock hanging into the void, then its own pattern. */
const WLD_floor = fn => (L0, x, y, tag) => { const s = standardFloor(L0, x, y, tag, (a, b) => fn(L0, a, b, null)); if (s !== undefined) return s === null ? WLD_cliff(L0, x, y) : s; return fn(L0, x, y, tag); };
/** ruins: flagstones of three widths in staggered rows, bevelled, some cracked or sunk; moss in the joints, lichen,
 *  grass creeping over the rims of the islands */
function WLD_fRuins(L0, x, y, tag) {
  const C = WLD_P(L0), rn = WLD_rune(L0, x, y, C); if (rn) return rn;
  if (tag === 'bridge') return WLD_bridge(L0, x, y, C, false);
  const row = Math.floor(y / 16), ly = y - row * 16, sx = x + (row & 1) * 20 + (row % 3) * 7, blk = Math.floor(sx / 48), lb = sx - blk * 48, hb = E.hash2(blk, row);
  const split = 16 + Math.floor(hb * 3) * 8, first = lb < split, lx = first ? lb : lb - split, sw = first ? split : 48 - split, h = first ? hb : E.hash2(blk + 91, row), gr = WLD_n(x * .11 + 7, y * .11);
  if (lx < 1.2 || ly < 1.2) return gr > .5 ? (gr > .64 ? C.moss_l : C.moss) : C.mortar;
  if ((lx < 3 || ly < 2.6) && gr > .62) return gr > .7 ? C.moss : C.moss_s;
  if (gr > .42 && WLD_near(L0, x, y, true) < 2 + (gr - .42) * 14) return gr > .6 ? C.moss_l : C.moss;
  if (h < .07) return gr > .55 ? C.dirt_l : gr > .35 ? C.dirt : C.dirt_s;
  if (h > .84 && Math.abs(lx - 3 - ly * 1.15 - Math.sin(ly * 1.3 + h * 9) * .9) < .6) return C.stone_d;
  if (lx < 2.2 || ly < 2.1) return C.stone_l;
  if (lx > sw - 1.4 || ly > 14.7) return C.stone_s;
  const gx = Math.floor(x / 7), gy = Math.floor(y / 7), hl = E.hash2(gx, gy);
  if (hl > .9) { const ddx = x - gx * 7 - 3.5, ddy = y - gy * 7 - 3.5, d = ddx * ddx + ddy * ddy, ln = WLD_n(x * .7, y * .7); if (d < (1.5 + (hl - .9) * 30) * (.5 + ln)) return ln > .62 ? C.lichen_l : C.lichen; }
  return h < .4 ? C.stone : h < .72 ? C.stone2 : C.stone3;
}
/** forge: dark basalt flagstones; in the hot zones the joints glow like the magma below, the slab edges scorch,
 *  a crack burns across the odd slab; some slabs are riveted iron plates; soot */
function WLD_fForge(L0, x, y, tag) {
  const C = WLD_P(L0), rn = WLD_rune(L0, x, y, C); if (rn) return rn;
  if (tag === 'bridge') return WLD_bridge(L0, x, y, C, false);
  const S = WLD_slab(x, y, 16, 48), lx = S.lx, ly = S.ly, h = S.h, heat = WLD_n(x * .028 + 40, y * .028);
  if (lx < 1.3 || ly < 1.3) return heat > .56 ? (heat > .63 ? C.ember_g : C.emberDark) : C.mortar;
  if (h < .09) {   // an iron plate
    const rx = lx < S.sw / 2 ? lx - 3 : lx - S.sw + 3, ry = ly < 8 ? ly - 3 : ly - 13; if (rx * rx + ry * ry < 1) return rx + ry < -.2 ? C.iron_h : C.iron_d;
    return lx < 2.2 || ly < 2.2 ? C.iron_l : lx > S.sw - 1.5 || ly > 14.6 ? C.iron_d : C.iron;
  }
  if (heat > .6 && (lx < 2.6 || ly < 2.6 || lx > S.sw - 1.6 || ly > 14.6)) return C.heat;
  if (heat > .55 && h > .82 && Math.abs(lx - 4 - ly * .9 - Math.sin(ly * 1.1 + h * 9) * 1.2) < .55) return C.ember_g;
  if (lx < 2.2 || ly < 2.1) return C.slab_l; if (lx > S.sw - 1.4 || ly > 14.7) return C.slab_s;
  if (WLD_n(x * .08, y * .08) < .28) return C.soot;
  return h < .5 ? C.slab : C.slab2;
}
/** frost: sheet ice cracked into plates (white cracks, a lit and a shaded rim, bubbles, depth), snow lying in
 *  broad wind-rippled fields and drifted against the walls, rime where the two meet */
function WLD_fFrost(L0, x, y, tag) {
  const C = WLD_P(L0), rn = WLD_rune(L0, x, y, C); if (rn) return rn;
  if (tag === 'bridge') return WLD_bridge(L0, x, y, C, false);
  const n = WLD_n(x * .03, y * .03), sn = WLD_n(x * .12 + 3, y * .12);
  if (n < .31 || WLD_near(L0, x, y, false) < 2 + sn * 8) { const rp = Math.sin(x * .3 + y * .16 + WLD_n(x * .04, y * .04) * 10); return rp > .9 && sn > .45 ? C.snow_h : rp < -.9 && sn < .55 ? C.snow_s : C.snow; }
  if (n < .335) return C.frost;
  const V = WLD_vor(x, y, 22);
  if (V.e < .75) return C.frost;
  if (V.e < 1.7) return V.dx + V.dy < 0 ? C.ice_h : C.ice_s;
  if (E.hash2(Math.floor(x / 2), Math.floor(y / 2)) > .985) return C.ice_h;
  if (((x - y * .5 + V.id * 40) % 23 + 23) % 23 < 1.2 && V.e > 3) return C.ice_l;
  return V.id < .3 ? C.ice_s : V.id < .75 ? C.ice : C.ice_l;
}
/** fungal: loam packed into clods (dry cracks between them, a lit rim on each), old roots roping across it (bark
 *  rings, a lit and a shaded side, a shadow on the earth), moss carpets of fine tufts with a thinning rim, glowing
 *  mycelium threads spreading from the carpets, and clusters of tiny glowing caps. Calm: the giant mushrooms are the show */
function WLD_fFungal(L0, x, y, tag) {
  const C = WLD_P(L0), rn = WLD_rune(L0, x, y, C); if (rn) return rn;
  if (tag === 'bridge') return WLD_bridge(L0, x, y, C, false);
  // roots: an isoline of a slow noise, drawn as a rope 3-4 px thick
  const rt = WLD_n(x * .042 + 3, y * .042 + 17) - .5, rw = .024;
  if (rt > -rw && rt < rw) { const u = rt / rw; if (u < -.5) return C.root_l; if (u > .55) return C.root_s; return ((x * .6 + y * .35) % 6 + 6) % 6 < .9 ? C.root_s : C.root; }
  if (rt >= rw && rt < rw + .014) return C.loam_d;                                          // the root's shadow
  const m = WLD_n(x * .03 + 11, y * .03) * .8 + WLD_n(x * .13, y * .13 + 5) * .2;          // moss carpets, ragged at the edge
  if (m > .56) {
    const gx = Math.floor(x / 4), gy = Math.floor(y / 4), h = E.hash2(gx, gy), dx = x - (gx * 4 + 1.2 + E.hash2(gx + 5, gy) * 1.6), dy = y - (gy * 4 + 1.2 + E.hash2(gx, gy + 5) * 1.6), r0 = .8 + h * 1.1, d = dx * dx + dy * dy;
    if (d < r0 * r0) return dx + dy < -r0 * .35 ? (h > .85 ? C.moss_h : C.moss_l) : C.moss;   // a tuft, lit from the upper left
    if (d < (r0 + 1) * (r0 + 1) && dx + dy > 0) return C.moss_d;                              // its shadow
    return m < .6 ? C.moss_d : C.moss_s;                                                      // the carpet between tufts; thinner at the rim
  }
  if (m > .45) {   // mycelium: fine glowing threads reaching out of the carpets. The isoline's width follows the noise's slope
    // (a fixed width broke into scattered dashes where the noise is steep, and read as static)
    const n0 = WLD_n(x * .09 + 3, y * .09), gr = Math.abs(WLD_n(x * .09 + 3.09, y * .09) - n0) + Math.abs(WLD_n(x * .09 + 3, y * .09 + .09) - n0);
    if (Math.abs(n0 - .5) < Math.max(.004, gr * .55)) return m > .5 ? C.vein_g : C.vein_s;
  }
  const gx = Math.floor(x / 14), gy = Math.floor(y / 14), h = E.hash2(gx, gy);
  if (h > .84) {   // a cluster of tiny glowing caps, each with its shadow
    const cx = gx * 14 + 4 + E.hash2(gx + 3, gy) * 6, cy = gy * 14 + 4 + E.hash2(gx, gy + 3) * 6;
    for (let k = 0; k < 3; k++) { const dx = x - cx - (k - 1) * 2.2, dy = y - cy - (k & 1) * 1.6, d = dx * dx + dy * dy; if (d < 1.2) return dx + dy < -.3 ? C.spore_h : C.spore_g; if (d < 2.4 && dx + dy > 0) return C.loam_d; }
  }
  // the loam: clods with dry cracks between them (the cracks come and go), a lit rim on the upper left of each
  const V = WLD_vor(x, y, 11, .9), cr = WLD_n(x * .06 + 7, y * .06);
  if (V.e < .55 && cr > .42) return C.loam_d;
  if (V.e < 1.3 && V.dx + V.dy < -1 && cr > .34) return C.loam_l;
  const n = WLD_n(x * .05, y * .05);
  return n < .3 ? C.loam_s : V.id < .4 ? C.loam : V.id < .8 ? C.loam2 : C.loam_s;
}
/** mine: packed earth with flat stones set in it (their shadows on the dirt), stormglass glints; rails where tagged */
function WLD_fMine(L0, x, y, tag) {
  const C = WLD_P(L0), rn = WLD_rune(L0, x, y, C); if (rn) return rn;
  if (tag === 'bridge') return WLD_bridge(L0, x, y, C, false);
  if (tag === 'rail') {   // sleepers across, two steel rails along, gravel between
    const along = L0._wrd && L0._wrd[WLD_i(L0, x, y)] === 2, a = along ? y : x, b = along ? x : y, lb = ((b % 16) + 16) % 16, la = ((a % 7) + 7) % 7;
    if (Math.abs(lb - 4.5) < .9 || Math.abs(lb - 11.5) < .9) return (lb % 1) < .45 ? C.rail_h : C.rail_s;
    if (la < 2.6 && lb > 1.5 && lb < 14.5) return la < .6 ? C.sleeper_l : la > 2 ? C.sleeper_d : C.sleeper;
    return E.hash2(Math.floor(x / 2), Math.floor(y / 2)) < .5 ? C.dirt_s : C.stone_s;
  }
  const gx = Math.floor(x / 10), gy = Math.floor(y / 10), h = E.hash2(gx, gy);
  if (h > .52) {
    const dx = (x - (gx * 10 + 3 + E.hash2(gx + 7, gy) * 4)) * (h > .8 ? .75 : 1), dy = y - (gy * 10 + 3 + E.hash2(gx, gy + 7) * 4), r0 = 1.4 + (h - .52) * 7, d = dx * dx + dy * dy;
    if (d < r0 * r0) { if (h > .95 && d < 1.3) return C.ore_g; return dx + dy < -r0 * .7 ? C.stone_l : dx + dy > r0 * .8 ? C.stone_s : h > .65 ? C.stone2 : C.stone; }
    if (d < (r0 + 1) * (r0 + 1) && dx + dy > 0) return C.dirt_d;
  }
  const n = WLD_n(x * .07, y * .07);
  return n > .62 ? C.dirt_l : n < .3 ? C.dirt_s : n > .47 ? C.dirt2 : C.dirt;
}
/** clockwork: riveted iron plates framed by grooved brass bands, grates, brass gear inlays, a brushed sheen */
function WLD_fClock(L0, x, y, tag) {
  const C = WLD_P(L0), rn = WLD_rune(L0, x, y, C); if (rn) return rn;
  if (tag === 'bridge') return WLD_bridge(L0, x, y, C, true);
  const bx = ((x + 2.5) % 64 + 64) % 64, by = ((y + 2.5) % 64 + 64) % 64;
  if (bx < 5 || by < 5) {
    const b = bx < 5 ? bx : by, a = bx < 5 ? by : bx;
    if (b < .8 || b > 4.2) return C.seam; if (Math.abs(b - 2.5) < .45) return C.brass_d;
    if (a % 8 > 3.4 && a % 8 < 4.6) return C.rivet_h;
    return b < 1.8 ? C.brass_l : C.brass;
  }
  const col = Math.floor(x / 16), row = Math.floor(y / 16), lx = x - col * 16, ly = y - row * 16, h = E.hash2(col, row);
  if (lx < 1 || ly < 1) return C.seam;
  if (h < .08) { if (lx < 2.4 || ly < 2.4 || lx > 13.6 || ly > 13.6) return lx < 1.8 || ly < 1.8 ? C.iron_l : C.iron; return ly % 3 < 1.3 ? C.grate_d : C.grate; }
  if (h > .975) {
    const dx = lx - 8.5, dy = ly - 8.5, d = Math.hypot(dx, dy);
    if (d < 7) { const a = Math.atan2(dy, dx), tooth = Math.cos(a * 8 + h * 20) > .15 ? 6.8 : 5.4; if (d < tooth) { if (d < 1.3) return C.gear_h; if (d < 2.3) return C.gear_d; if (d < 4.3 && Math.abs(Math.sin(a * 2 + h * 9)) > .35) return C.gear_d; return d > tooth - 1 || dx + dy < -4 ? C.gear_l : C.gear; } if (d < tooth + .9) return C.seam; }
  }
  const rx = lx < 8 ? lx - 3 : lx - 13.5, ry = ly < 8 ? ly - 3 : ly - 13.5;
  if (rx * rx + ry * ry < 1) return rx + ry < -.6 ? C.rivet : C.rivet_d;
  if (lx < 1.8 || ly < 1.8) return C.iron_l; if (lx > 15.1 || ly > 15.1) return C.iron_s;
  if (((x * .5 + y * .5 + h * 40) % 11 + 11) % 11 < .8) return C.iron_l;
  return h < .5 ? C.iron : C.iron2;
}
/** abyss: obsidian hex columns seen from above, violet fissures glowing, the odd glint in the glass */
function WLD_fAbyss(L0, x, y, tag) {
  const C = WLD_P(L0), rn = WLD_rune(L0, x, y, C); if (rn) return rn;
  if (tag === 'bridge') return WLD_bridge(L0, x, y, C, true);
  const fm = WLD_n(x * .02 + 30, y * .02); if (fm > .5) { const v = Math.abs(WLD_n(x * .05, y * .05) - .5); if (v < .009) return C.glow_g; if (v < .02) return C.glowDark; }
  const S = 9, qx = (x * .57735 - y / 3) / S, qz = (y * 2 / 3) / S, qy = -qx - qz;
  let rx = Math.round(qx), ry = Math.round(qy), rz = Math.round(qz); const ax = Math.abs(rx - qx), ay = Math.abs(ry - qy), az = Math.abs(rz - qz);
  if (ax > ay && ax > az) rx = -ry - rz; else if (ay > az) ry = -rx - rz; else rz = -rx - ry;
  const dx = qx - rx, dy = qy - ry, dz = qz - rz, e = Math.max(Math.abs(dx - dy), Math.abs(dy - dz), Math.abs(dz - dx));
  if (e > .9) return C.crack;
  if (e > .76) return dx - dz < 0 ? C.obs_l : C.obs_s;
  const h = E.hash2(rx, rz); if (h > .97 && e < .3) return C.glass;
  if (E.hash2(Math.floor(x / 2), Math.floor(y / 2)) > .994) return C.glass_h;
  return h < .45 ? C.obs : h < .85 ? C.obs2 : C.obs_s;
}
/** ossuary: basalt slabs framed by bands of little bone tiles, skull motifs in some, old blood soaked in */
function WLD_fOss(L0, x, y, tag) {
  const C = WLD_P(L0), rn = WLD_rune(L0, x, y, C); if (rn) return rn;
  if (tag === 'bridge') return WLD_bridge(L0, x, y, C, true);
  const bx = ((x % 48) + 48) % 48, by = ((y % 48) + 48) % 48;
  if (bx < 4 || by < 4) { if (bx < .8 || by < .8 || (bx > 3.2 && bx < 4) || (by > 3.2 && by < 4)) return C.mortar; return ((Math.floor(x / 2) + Math.floor(y / 2)) & 1) ? C.bone_s : ((Math.floor(x / 2) * 3 + Math.floor(y / 2)) % 5 ? C.bone_d : C.bone); }
  const ix = Math.floor((bx - 4) / 11), iy = Math.floor((by - 4) / 11), lx = bx - 4 - ix * 11, ly = by - 4 - iy * 11, h = E.hash2(Math.floor(x / 48) * 4 + ix, Math.floor(y / 48) * 4 + iy);
  if (lx < .9 || ly < .9) return C.mortar;
  if (h > .94) {   // a skull inlaid in the odd tile: toned down to the bone of the bands, so white skeletons still read against it
    const sx = lx - 5.5, sy = ly - 4.8;
    if ((Math.abs(sx) - 1.6) ** 2 + (sy + .2) ** 2 < 1.1 || (Math.abs(sx) < .5 && sy > 1 && sy < 2)) return C.mortar;
    if (sx * sx / 13 + sy * sy / 11 < 1 && sy < 2.2) return sx + sy < -2.5 ? C.bone : C.bone_s;
    if (Math.abs(sx) < 2.3 && sy >= 2.2 && sy < 4.2) return (Math.floor(lx * 1.4) & 1) ? C.bone_d : C.bone_s;
  }
  const n = WLD_n(x * .03, y * .03);
  if (n > .68 && WLD_n(x * .2, y * .2) > .38) return n > .73 ? C.blood : C.blood_d;
  if (lx < 1.8 || ly < 1.8) return C.slab_l; if (lx > 10.2 || ly > 10.2) return C.slab_s;
  return h < .5 ? C.slab : C.slab2;
}
/** sky: polished marble tiles, a gold compass star in a ring inlaid here and there, faint veins, a gleam on some
 *  tiles, gardens creeping over the rims */
function WLD_fSky(L0, x, y, tag) {
  const C = WLD_P(L0), rn = WLD_rune(L0, x, y, C); if (rn) return rn;
  if (tag === 'bridge') return WLD_bridge(L0, x, y, C, true);
  const g = WLD_n(x * .1 + 5, y * .1);
  if (g > .36 && WLD_near(L0, x, y, true) < 1.5 + (g - .36) * 12) return g > .6 ? C.lip_l : g > .45 ? C.lip : C.lip_s;
  if (E.hash2(Math.floor(x / 48), Math.floor(y / 48) + 7) > .55) {
    const bx = Math.abs(((x % 48) + 48) % 48 - 24), by = Math.abs(((y % 48) + 48) % 48 - 24), mn = Math.min(bx, by), mx = Math.max(bx, by), st = mn * 3.4 + mx, rr = Math.hypot(bx, by);
    if (st < 9) return st > 7.9 ? C.gold_d : mn < .55 ? C.gold_h : bx + by < 2.6 ? C.gold_l : C.gold;
    if (Math.abs(rr - 10.5) < .7) return rr < 10.5 ? C.gold_l : C.gold_s;
  }
  const lx = ((x % 16) + 16) % 16, ly = ((y % 16) + 16) % 16;
  if (lx < .8 || ly < .8) return C.joint;
  if (lx < 1.6 || ly < 1.6) return C.marble_l;
  const h = E.hash2(Math.floor(x / 16), Math.floor(y / 16));
  if (h > .62 && Math.abs(lx + ly - 8) < .55 && lx > 2.5 && ly > 2.5) return C.marble_h;
  if (h > .55 && Math.abs(Math.sin(x * .09 + y * .03 + WLD_n(x * .04, y * .04) * 5)) < .04) return C.vein;
  return h < .5 ? C.marble : C.marble2;
}
/** aqueduct: wet cobbled setts, algae in the joints, puddles with a sheen, stone curbs along the channels */
function WLD_fAqua(L0, x, y, tag) {
  const C = WLD_P(L0), rn = WLD_rune(L0, x, y, C); if (rn) return rn;
  if (tag === 'bridge') return WLD_bridge(L0, x, y, C, true);
  if (L0._wch) { const b = WLD_curbs(L0)[WLD_i(L0, x, y)]; if (b) { const lx = ((x % 16) + 16) % 16, ly = ((y % 16) + 16) % 16, e = Math.min(b & 1 ? lx : 99, b & 2 ? 16 - lx : 99, b & 4 ? ly : 99, b & 8 ? 16 - ly : 99); if (e < 3.4) return e < 1 ? C.curb_s : e < 1.8 ? C.curb_l : C.curb; } }
  const n = WLD_n(x * .04, y * .04);
  if (n > .69) return n < .71 ? C.puddle_d : ((x * .8 + y * .5) % 17 + 17) % 17 < 1 && WLD_n(x * .3, y * .3) > .58 ? C.puddle_h : n > .75 ? C.puddle : C.puddle_s;
  const row = Math.floor(y / 6), off = (row & 1) * 4, col = Math.floor((x + off) / 8), lx = x + off - col * 8, ly = y - row * 6;
  if (lx < 1.1 || ly < 1.1 || (lx < 1.8 && ly < 1.8)) return WLD_n(x * .15, y * .15) > .55 ? C.algae : C.joint;
  if (ly < 2) return C.sett_l; if (ly > 4.9 || lx > 7.1) return C.sett_s;
  const h = E.hash2(col, row); return h < .45 ? C.sett : h < .85 ? C.sett2 : C.sett_s;
}
/** cavern: natural rock split into plates (a crack, a lit rim and a shaded one), strata in some, pebbles, damp */
function WLD_fCave(L0, x, y, tag) {
  const C = WLD_P(L0), rn = WLD_rune(L0, x, y, C); if (rn) return rn;
  if (tag === 'bridge') return WLD_bridge(L0, x, y, C, false);
  const V = WLD_vor(x, y, 20), id = V.id;
  if (V.e < .7) return C.rock_d;
  if (V.e < 1.6) return V.dx + V.dy < 0 ? C.rock_l : C.rock3_s;
  const gx = Math.floor(x / 6), gy = Math.floor(y / 6), h = E.hash2(gx, gy);
  if (h > .9) { const dx = x - gx * 6 - 3, dy = y - gy * 6 - 3, r0 = .9 + (h - .9) * 14, d = dx * dx + dy * dy; if (d < r0 * r0) return dx + dy < -r0 * .4 ? C.pebble_l : C.pebble; if (d < (r0 + .9) * (r0 + .9) && dx + dy > 0) return C.rock3_s; }
  if (id > .55 && Math.sin((x * .5 + y * .28) + id * 30) > .9) return C.rock_s;
  if (WLD_n(x * .025 + 20, y * .025) > .68) return id < .5 ? C.damp : C.damp_l;
  return id < .3 ? C.rock : id < .6 ? C.rock2 : id < .85 ? C.rock3 : C.rock_l;
}

/* ---------- level features some themes add ---------- */
/** rails down the long axis of the bigger rooms, running on through the doorways until rock (mine); carts on them */
function WLD_rails(L0, R) {
  const m = L0.map, w = L0.w, dir = L0._wrd = new Uint8Array(w * L0.h);
  for (const rm of L0.rooms) {
    if (Math.max(rm.w, rm.h) < 8 || !R.chance(.6)) continue;
    const alongY = rm.h > rm.w, cx = Math.floor(rm.cx), cy = Math.floor(rm.cy), cells = [];
    for (const s of [-1, 1]) for (let k = s > 0 ? 0 : 1; k < 60; k++) {
      const x = alongY ? cx : cx + k * s, y = alongY ? cy + k * s : cy, i = y * w + x;
      if (!m.walkable(x, y) || (m.floorTags[i] && m.floorTags[i] !== 'rail')) break;
      if (Math.hypot((x + .5) * T16 - L0.start.x, (y + .5) * T16 - L0.start.y) < 40 || Math.hypot((x + .5) * T16 - L0.exit.x, (y + .5) * T16 - L0.exit.y) < 36) continue;
      cells.push(i);
    }
    for (const i of cells) { m.floorTags[i] = 'rail'; dir[i] = alongY ? 2 : 1; }
    // a torch the track now runs through steps aside, off the rails (the torches were set before the rails were laid)
    for (const b of L0.torches) {
      if (m.floorTags[WLD_i(L0, b.x, b.y)] !== 'rail') continue;
      for (const s of [1, -1, 2, -2]) { const x = b.x + (alongY ? s * 13 : 0), y = b.y + (alongY ? 0 : s * 13), cx = Math.floor(x / T16), cy = Math.floor(y / T16); if (m.walkable(cx, cy) && !m.floorTags[cy * w + cx]) { b.x = x; b.y = y; break; } }
    }
    if (cells.length > 4 && R.chance(.7)) { const i = cells[R.int(1, cells.length - 2)], x = (i % w + .5) * T16, y = (Math.floor(i / w) + .5) * T16; WLD_deco(L0, 'cart', x, y, { solid: true, alongY }); (L0._wtk || (L0._wtk = [])).push([x, y]); }
  }
}
/** a shallow water channel down the long axis of the bigger rooms (aqueduct), with a curb mask for the floor */
function WLD_channels(L0, R) {
  const m = L0.map, w = L0.w, ch = L0._wch = new Uint8Array(w * L0.h);
  for (const rm of L0.rooms) {
    if (Math.max(rm.w, rm.h) < 9 || rm === L0.rooms[0] || !R.chance(.65)) continue;
    const alongY = rm.h > rm.w, c0 = alongY ? Math.floor(rm.cx) - 1 : Math.floor(rm.cy) - 1;
    for (let k = 0; k < (alongY ? rm.h : rm.w); k++) for (let j = 0; j < 2; j++) {
      const x = alongY ? c0 + j : rm.x + k, y = alongY ? rm.y + k : c0 + j, i = y * w + x;
      if (!m.walkable(x, y) || m.floorTags[i] || Math.hypot((x + .5) * T16 - L0.exit.x, (y + .5) * T16 - L0.exit.y) < 34 || Math.hypot((x + .5) * T16 - L0.start.x, (y + .5) * T16 - L0.start.y) < 40) continue;
      m.floorTags[i] = 'water'; ch[i] = 1;
    }
  }
}
/** the curb stones: dry cells beside a channel's water (bits: water at -x +x -y +y). Worked out again whenever the floor
 *  re-bakes, from the tags as they are then: mechanics change them after the theme dresses the level (a flood's tide
 *  band is left bare, since the tide runs over it; a channel that froze or drained loses its curb) */
function WLD_curbs(L0) {
  const m = L0.map; if (L0._wwm && L0._wwm.fl === m.floors) return L0._wwm.b;
  const w = L0.w, h = L0.h, b = new Uint8Array(w * h), tg = m.floorTags, ch = L0._wch, fl = L0.MKB_fl && L0.MKB_fl.own, wet = j => ch[j] && tg[j] === 'water';
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (tg[i] || m.cell(x, y) || (fl && fl[i])) continue; b[i] = (wet(i - 1) ? 1 : 0) | (wet(i + 1) ? 2 : 0) | (wet(i - w) ? 4 : 0) | (wet(i + w) ? 8 : 0); }
  L0._wwm = { fl: m.floors, b }; return b;
}

/* ---------- SONGS: one per family of places (steps are sixteenth notes; every track loops on its own length) ---------- */
// ruins and the sky spires: wistful D dorian over open fifths, a soft pulse lead
def('songs', 'ruins', { bpm: 84, steps: 4, tracks: [
  { wave: 'pulse', vol: .09, notes: 'D5 - - - A4 - - - C5 - D5 - E5 - - - | F5 - E5 - D5 - C5 - A4 - - - - - . . | G4 - - - A4 - C5 - D5 - - - C5 - A4 - | B4 - - - A4 - G4 - A4 - - - - - . . | D5 - - - A4 - - - C5 - D5 - E5 - G5 - | F5 - - - E5 - D5 - C5 - - - D5 - E5 - | G5 - F5 - E5 - D5 - C5 - A4 - C5 - D5 - | E5 - - - - - D5 - D5 - - - - - . .' },
  { wave: 'triangle', vol: .28, notes: 'D3 - . . A2 - . . D3 - . . A2 - . . | F2 - . . C3 - . . F2 - . . C3 - . . | G2 - . . D3 - . . G2 - . . D3 - . . | A2 - . . E3 - . . A2 - . . E3 - . .' },
  { wave: 'square', vol: .028, notes: 'D4 . F4 . A4 . D5 . A4 . F4 . D4 . F4 . | F4 . A4 . C5 . F5 . C5 . A4 . F4 . A4 . | G4 . B4 . D5 . G5 . D5 . B4 . G4 . B4 . | A4 . C5 . E5 . A5 . E5 . C5 . A4 . C#5 .' },
  { wave: 'drums', vol: .05, notes: 'k . . . h . . . s . . . h . . h | k . . . h . . . s . . h . . h .' } ] });
// forge and mine: E phrygian, a saw riff over pounding toms like hammers on anvils
def('songs', 'forge', { bpm: 118, steps: 4, tracks: [
  { wave: 'saw', vol: .055, notes: 'E4 - . E4 F4 - E4 - . . G4 - F4 - E4 - | D4 - . D4 E4 - F4 - G4 - A4 - G4 - F4 - | E4 - . E4 F4 - E4 - . . B4 - A4 - G4 - | F4 - E4 - D4 - F4 - E4 - - - - - . .' },
  { wave: 'triangle', vol: .32, notes: 'E2 E2 . E2 E3 . E2 . E2 E2 . E2 F2 . E2 . | D2 D2 . D2 D3 . D2 . C2 C2 . C2 D2 . E2 .' },
  { wave: 'square', vol: .035, notes: 'E3 . . . . . . . B3 . . . . . . . | D3 . . . . . . . C3 . . . . . . .' },
  { wave: 'drums', vol: .13, notes: 'k . t . s . k t k . t . s t s . | k . t . s . k t k k t . s . c .' } ] });
// frost and cavern: B minor, slow and sparse, a vibrato lead and bell tones that drift against it
def('songs', 'rime', { bpm: 66, steps: 4, tracks: [
  { wave: 'pulse12', vol: .08, vib: [5, .012], notes: 'F#5 - - - - - E5 - D5 - - - - - . . | B4 - - - - - C#5 - D5 - - - E5 - . . | F#5 - - - A5 - - - G5 - F#5 - E5 - . . | D5 - - - C#5 - - - B4 - - - - - . .' },
  { wave: 'triangle', vol: .12, notes: 'B5 . . . . . . . F#5 . . . . . . . . . . . D6 . . . . . . . A5 . . .' },
  { wave: 'triangle', vol: .26, notes: 'B2 - - - - - - - F#2 - - - - - - - | G2 - - - - - - - F#2 - - - - - - -' },
  { wave: 'drums', vol: .04, notes: 'k . . . . . . . . . . . h . . . | k . . . . . . . . . h . . . . .' } ] });
// fungal and abyss: a whole-tone drift, sine lead wobbling, a bass that never settles
def('songs', 'spores', { bpm: 88, steps: 4, tracks: [
  { wave: 'sine', vol: .12, vib: [6, .03], notes: 'C5 - - - D5 - - - E5 - F#5 - E5 - - - | G#5 - - - F#5 - E5 - D5 - - - - - . . | C5 - - - A#4 - - - G#4 - A#4 - C5 - - - | D5 - - - E5 - - - F#5 - - - - - . .' },
  { wave: 'square', vol: .035, notes: 'C4 . G#3 . C4 . G#3 . A#3 . F#3 . A#3 . F#3 .' },
  { wave: 'triangle', vol: .26, notes: 'C2 - - - - - - - D2 - - - - - - - | E2 - - - - - - - D2 - - - - - - -' },
  { wave: 'drums', vol: .06, notes: 'k . . h . . k . . . h . . . h .' } ] });
// clockwork: A minor, a ticking hat on every step, square arpeggios turning like gears
def('songs', 'cogs', { bpm: 128, steps: 4, tracks: [
  { wave: 'pulse', vol: .075, notes: 'E5 - - - D5 - C5 - B4 - - - C5 - D5 - | C5 - - - A4 - - - - - - - . . . . | D5 - - - C5 - B4 - G4 - - - A4 - B4 - | B4 - - - G#4 - - - E4 - - - . . . .' },
  { wave: 'square', vol: .04, notes: 'A4 C5 E5 C5 A4 C5 E5 C5 A4 C5 E5 C5 A4 C5 E5 C5 | F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4 | G4 B4 D5 B4 G4 B4 D5 B4 G4 B4 D5 B4 G4 B4 D5 B4 | E4 G#4 B4 G#4 E4 G#4 B4 G#4 E4 G#4 B4 G#4 E4 G#4 B4 G#4' },
  { wave: 'triangle', vol: .3, notes: 'A2 . A2 . A2 . A2 . A2 . A2 . A2 . A2 . | F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 . | G2 . G2 . G2 . G2 . G2 . G2 . G2 . G2 . | E2 . E2 . E2 . E2 . E2 . E2 . E2 . G#2 .' },
  { wave: 'drums', vol: .07, notes: 'k h h h s h h h k h h h s h h h | k h h h s h h h k h k h s h o h' } ] });
// the ossuary: a C minor dirge on a reedy organ, a funeral drum
def('songs', 'dirge', { bpm: 58, steps: 4, tracks: [
  { wave: 'pulse', vol: .08, notes: 'G4 - - - Ab4 - G4 - F4 - - - Eb4 - - - | C5 - - - Bb4 - Ab4 - G4 - - - - - . . | Ab4 - - - G4 - F4 - Eb4 - - - D4 - - - | Eb4 - - - D4 - - - C4 - - - - - . .' },
  { wave: 'saw', vol: .04, notes: 'C4 - - - - - - - - - - - - - - - | Ab3 - - - - - - - - - - - - - - - | F3 - - - - - - - - - - - - - - - | G3 - - - - - - - - - - - - - - -' },
  { wave: 'saw', vol: .03, notes: 'Eb4 - - - - - - - - - - - - - - - | C4 - - - - - - - - - - - - - - - | Ab3 - - - - - - - - - - - - - - - | B3 - - - - - - - - - - - - - - -' },
  { wave: 'triangle', vol: .3, notes: 'C2 - - - - - - - C2 - - - - - - - | Ab1 - - - - - - - Ab1 - - - - - - - | F1 - - - - - - - F1 - - - - - - - | G1 - - - - - - - G1 - - - G1 - - -' },
  { wave: 'drums', vol: .07, notes: 'k . . . . . . . t . . . . . . . | k . . . . . . . t . . . t . . .' } ] });

/* ---------- THE THEMES ----------
 * pal: flat colours (so the deep hue shift reaches all of them); walls 1 outer rock, 2 pillar, 3 low wall; torch and
 * light; ambient light and the colour of the dark; back: what shows through the void; decorate(L, R); ambience(L, dt). */
const WLD_pp = (name, o) => (L1, R, x, y) => WLD_prop(L1, name, x, y, typeof o === 'function' ? o(R) : o || {});
const WLD_ps = (id, o) => (L1, R, x, y) => WLD_shape(L1, id, x, y, typeof o === 'function' ? o(R) : o || {});   // (a shape, as WLD_pp places a prop)
const WLD_dd = (kind, o) => (L1, R, x, y, nx, ny) => WLD_deco(L1, kind, x, y, Object.assign({ nx, ny }, typeof o === 'function' ? o(R) : o || {}));
const WLD_rim = (L0, R, n, kind, o) => { for (const rm of L0.rooms) for (let k = R.int(n[0], n[1]); k > 0; k--) { const s = WLD_spot(L0, R, rm, { rim: 1, gap: 22, startGap: 24 }); if (s) WLD_deco(L0, kind, s[0], s[1], Object.assign({ overVoid: true, nx: s[2], ny: s[3] }, typeof o === 'function' ? o(R) : o)); } };

/* RUINS (depths 3-4): a sunken temple of sun-bleached stone, overgrown, its halls broken open onto the glowing deep */
def('themes', 'ruins', { name: 'Ruins', nouns: ['Ruins', 'Colonnades', 'Fallen Courts', 'Broken Halls'], music: 'ruins',
  pal: { stone: '#8c8472', stone2: '#958b76', stone3: '#827a6a', mortar: '#3e3a32', moss: '#5f7a3a', lichen: '#8e9468', dirt: '#5a4a36', lip: '#6f8a44', cliff: '#6a6254', plank: '#7a5a3a', rune: '#3f8a7a', runeHi: '#9ff0d8', void: '#1a0e14' },
  walls: { 1: { h: 38, cut: true, cutH: 6, top: '#6f6a5a', side: '#8a8270', line: '#4a4538', face: 'mossy', roof: 'moss', accent: '#5f7a3a' },
           2: { h: 40, top: '#a8a08a', side: '#9a927e', line: '#5a5446', face: 'stone', roof: 'slab', course: 10 },
           3: { h: 12, top: '#8a8270', side: '#7a7262', line: '#4a4538', face: 'stone', roof: 'slab', course: 6 } },
  torch: 'brazier', light: '#ffb468', ambient: .2, lights: 1, dark: [18, 10, 24],
  back: { sky: ['#07060e', '#120e22', '#2a1628', '#4a2020'], layers: [{ kind: 'clouds', color: '#3a2a48', y: .3, height: .3, parallax: .04, drift: 1, nebula: true }, { kind: 'fog', color: '#6a4a6a', y: .5, height: .22, parallax: .1, drift: 3 }, { kind: 'fog', color: '#c86a3a', y: .9, height: .2, parallax: .22, drift: 6 }] },
  floor: WLD_floor(WLD_fRuins),
  decorate(L0, R) {
    WLD_setup(L0, this);
    const open = L0.rec.layout === 'islands';
    if (!open) WLD_holes(L0, R, .4);
    WLD_dress(L0, R, [
      { w: 3, edge: 1, f: WLD_pp('pillar', R => ({ broken: true, color: '#a0987f', size: R.range(1.05, 1.35), flip: R.chance(.5) })) },
      { w: 1.4, edge: 1, f: WLD_pp('statue', R => ({ color: '#8a8474', size: R.range(1.1, 1.4), flip: R.chance(.5) })) },
      { w: 3, gap: 8, f: WLD_pp('grass', R => ({ color: '#7a9a4a', size: R.range(1, 1.6) })) },
      { w: 2, edge: 1, f: WLD_pp('bush', R => ({ color: '#5a7a3a', size: R.range(1, 1.3) })) },
      { w: 2, f: WLD_ps('rock', R => ({ color: '#8a8270', size: R.range(.8, 1.3) })) },
      { w: 1, f: WLD_pp('flowers', { color: '#e8c85a', color2: '#f0eef4' }) },
      { w: 1.3, open: 1, f: WLD_dd('runestone') },
      { w: .8, edge: 1, f: WLD_dd('banner', R => ({ color: '#6a4a8a', color2: '#c8b088', pole: '#8a7a5a', h: 42, wind: .5, flip: R.chance(.5) })) },
      { w: 1, f: WLD_ps('pot', { color: '#9a6a4a' }) }
    ]);
    WLD_rim(L0, R, [1, 2], 'rubble', { color: '#6a6254', lip: '#6f8a44' });
    for (const rm of L0.rooms) if (rm.hole) { WLD_deco(L0, 'rubble', rm.hole.x, rm.hole.y, { color: '#6a6254', lip: '#6f8a44', overVoid: true }); WLD_deco(L0, 'rift', rm.hole.x, rm.hole.y, { rad: rm.hole.r, glow: '#ff8a3a', glow2: '#ffd070', rate: 6, overVoid: true }); }
    WLD_pillars(L0, R, .6, (L1, R1, x, y) => WLD_prop(L1, 'vines', x, y, { z: 40, anchor: 'top', color: '#5a7a3a', size: R1.range(.9, 1.2) }));
  },
  ambience(L0, dt) {
    WLD_mood(this);
    WLD_motes(dt, 7, (x, y) => ({ kind: 'dust', x, y, z: 8 + Math.random() * 40, vx: 5 + Math.random() * 5, vy: 2, vz: -1, max: 3 + Math.random() * 2, size: .7, color: '#e8d8b0' }));
    WLD_motes(dt, 1.5, (x, y) => ({ kind: 'bit', x, y, z: 70, vx: 10 + Math.random() * 8, vy: 5, vz: -9 - Math.random() * 4, max: 7, size: 1, color: Math.random() < .5 ? '#7a9a4a' : '#b0904a' }));
  }
});

/* FORGE (depth 5, the Cinder King): iron-strapped basalt, crucibles of molten metal, anvils, chains in the smoke */
def('themes', 'forge', { name: 'Forge', nouns: ['Forge', 'Foundry', 'Smelteries', 'Anvil Halls'], music: 'forge',
  pal: { slab: '#3a3234', slab2: '#433a3b', mortar: '#1a1416', soot: '#2c2426', iron: '#565866', ember: '#ff7a2a', emberDark: '#7a2a14', heat: '#4e2a24', cliff: '#3a2e2c', lip: '#4a3a36', plank: '#4a4048', rune: '#c0502a', runeHi: '#ffc070', void: '#2a0806' },
  walls: { 1: { h: 38, cut: true, cutH: 6, top: '#2e2628', side: '#4a3e3e', line: '#241c1e', face: 'iron', roof: 'rubble', accent: '#6a6a78' },
           2: { h: 42, top: '#5a4a44', side: '#56484a', line: '#2a2022', face: 'iron', roof: 'rubble', accent: '#7a7a88' },
           3: { h: 12, top: '#4a3e3e', side: '#3e3434', line: '#241c1e', face: 'stone', roof: 'plain', course: 6 } },
  torch: 'firedrum', light: '#ff7a3a', ambient: .16, lights: 1.1, dark: [26, 8, 8],
  back: { sky: ['#0a0406', '#1e0808', '#3e1008', '#7a2408'], layers: [{ kind: 'fog', color: '#5a2a1a', y: .55, height: .22, parallax: .1, drift: 2 }, { kind: 'fog', color: '#ff7a2a', y: .92, height: .24, parallax: .2, drift: 4 }] },
  floor: WLD_floor(WLD_fForge),
  decorate(L0, R) {
    WLD_setup(L0, this);
    WLD_dress(L0, R, [
      { w: 2, edge: 1, inset: 10, f: WLD_dd('crucible', { solid: true }) },
      { w: 1.5, open: 1, f: WLD_dd('anvil', R => ({ solid: true, rot: R.chance(.5) })) },
      { w: 2, f: WLD_dd('chain', R => ({ len: R.range(30, 56) })) },
      { w: .7, f: WLD_dd('chain', { cage: true, len: 44 }) },
      { w: 1.4, open: 1, f: WLD_dd('vent', { steam: '#8a7a7a' }) },
      { w: 2, edge: 1, f: WLD_ps('barrel', R => ({ color: '#5a3a2a', size: R.range(1, 1.2) })) },
      { w: 2, edge: 1, f: WLD_ps('crate', R => ({ color: '#6a4a32', size: R.range(1, 1.3) })) }
    ]);
  },
  ambience(L0, dt) {
    WLD_mood(this);
    WLD_motes(dt, 9, (x, y) => ({ kind: 'ember', x, y, z: 2 + Math.random() * 20, vx: (Math.random() - .5) * 14, vy: (Math.random() - .5) * 14, vz: 18 + Math.random() * 30, g: -4, max: 1.5 + Math.random() * 1.5, color: Math.random() < .6 ? '#ff8a3a' : '#ffc060' }));
    WLD_motes(dt, 3, (x, y) => ({ kind: 'dust', x, y, z: 60, vx: 3, vy: 2, vz: -7, max: 5, size: .8, color: '#5a5050' }));
  }
});

/* FROST (depth 6): the Rime Deep. Ice-glazed stone, snow drifted against glassy ice walls, spikes of ice, icicles */
// (kept a step darker than snow looks: every light in a fight lifts the floor to its full colour and adds its own on
// top, and paler snow and ice swallowed white skeletons, ice crystals and the hero. pale: a deep recolor dims it too,
// lightR / lightI: its blue braziers reach less far)
def('themes', 'frost', { name: 'Frost', nouns: ['Rime', 'Glaciers', 'Hoarfrost Halls', 'Ice Caves'], music: 'rime', pale: .9,
  pal: { stone: '#7a8ea4', snow: '#72859e', ice: '#4a7099', frost: '#8ba2bb', cliff: '#4a6482', lip: '#98adc4', plank: '#62707e', rune: '#3a9ad0', runeHi: '#dff8ff', void: '#040814' },
  walls: { 1: { h: 38, cut: true, cutH: 6, top: '#8c9eb4', side: '#5f7c9a', line: '#415e7c', face: 'ice', roof: 'snow' },
           2: { h: 40, top: '#98aabe', side: '#6a88a8', line: '#4e6c8a', face: 'ice', roof: 'snow' },
           3: { h: 12, top: '#92a4b8', side: '#627e9a', line: '#415e7c', face: 'stone', roof: 'snow', course: 6 } },
  torch: 'brazier', light: '#7fd0ff', lightR: 108, lightI: 1, ambient: .15, lights: 1, dark: [8, 16, 38], tint: .12,
  back: { sky: ['#03050e', '#081228', '#10223e'], stars: 30, starsY: .5, layers: [{ kind: 'fog', color: '#6a8ab8', y: .66, height: .24, parallax: .12, drift: 4 }, { kind: 'fog', color: '#a8c8e8', y: .95, height: .2, parallax: .24, drift: 6 }] },
  floor: WLD_floor(WLD_fFrost),
  decorate(L0, R) {
    WLD_setup(L0, this);
    WLD_dress(L0, R, [
      { w: 3, edge: 1, f: WLD_dd('spikes', R => ({ solid: true, color: '#a8d8f8', h: R.range(14, 28) })) },
      { w: 1.3, open: 1, f: WLD_dd('spikes', R => ({ color: '#b8e4fc', h: R.range(8, 12), n: 2 })) },
      { w: 2, f: WLD_ps('crystal', R => ({ color: '#9ad8ff', size: R.range(.8, 1.3) })) },
      { w: 2, edge: 1, f: WLD_ps('rock', R => ({ color: '#b0c4d8', size: R.range(.9, 1.4) })) },
      { w: 1, f: WLD_pp('skull', { color: '#dde6ee' }) }, { w: 1, f: WLD_pp('bones', { color: '#dde6ee' }) }
    ]);
    const ph = this.walls[2].h; WLD_pillars(L0, R, .85, (L1, R1, x, y, nx, ny) => WLD_deco(L1, 'icicles', x, y, { nx, ny, top: ph }));
  },
  ambience(L0, dt) {
    WLD_mood(this);
    WLD_motes(dt, 11, (x, y) => ({ kind: 'bit', x, y, z: 50 + Math.random() * 30, vx: 4 + Math.random() * 6, vy: 2 + Math.random() * 3, vz: -10 - Math.random() * 7, max: 4.5 + Math.random() * 1.5, size: Math.random() < .25 ? 2 : 1, color: Math.random() < .7 ? '#f4faff' : '#c8e0f4' }));
    WLD_motes(dt, 1.2, (x, y) => ({ kind: 'glint', x, y, z: Math.random() * 30, vz: 2, max: .5, size: 1, color: '#dff4ff' }));
  }
});

/* FUNGAL (depths 7, 10): the Brood Warrens. Loam veined with glowing mycelium, giant mushrooms, spore pods, glow-worms */
def('themes', 'fungal', { name: 'Fungal', nouns: ['Warrens', 'Mycelia', 'Spore Caves', 'Rotwood'], music: 'spores',
  pal: { loam: '#3e2e38', loam2: '#46343c', vein: '#5ff0c8', moss: '#3a6a5a', spore: '#aaffe0', root: '#5a4238', cliff: '#3a2a40', lip: '#3a6a5a', plank: '#5a4a3a', rune: '#2aa090', runeHi: '#aaffe8', void: '#06040a' },
  walls: { 1: { h: 36, cut: true, cutH: 6, top: '#2a2232', side: '#4a3a52', line: '#241a2a', face: 'fungus', roof: 'caps', accent: '#3aa890', accent2: '#b85a9a', moss: '#3a6a5a' },
           2: { h: 38, top: '#3a2e44', side: '#54425c', line: '#2a1e30', face: 'fungus', roof: 'caps', accent: '#ff8ad0', accent2: '#5ff0c8', moss: '#3a6a5a' },
           3: { h: 11, top: '#3a6a5a', side: '#4a3a52', line: '#241a2a', face: 'rock', roof: 'moss', accent: '#4a8a6a' } },
  torch: 'crystal', light: '#6af0c8', ambient: .15, lights: .9, dark: [6, 18, 24],
  back: { sky: ['#06040a', '#100a18', '#1a1026', '#123028'], layers: [{ kind: 'stalactites', color: '#1a1224', y: 0, height: .25, parallax: .08 }, { kind: 'fog', color: '#2a7a6a', y: .78, height: .22, parallax: .18, drift: 3 }] },
  floor: WLD_floor(WLD_fFungal),
  decorate(L0, R) {
    WLD_setup(L0, this);
    const caps = [['#3ab0a0', '#9affd8'], ['#8a5ad8', '#e0b8ff'], ['#d86a9a', '#ffd0e8']];
    WLD_dress(L0, R, [
      { w: 4.5, edge: 1, inset: 6, f: WLD_dd('shroom', R => { const c = R.pick(caps); return { solid: true, color: c[0], glow: c[1], h: R.range(20, 34), w: R.range(10, 14) }; }) },
      { w: 2, open: 1, f: WLD_dd('pod', R => ({ color: R.pick(['#7a4a8a', '#5a6a3a']) })) },
      { w: 4, edge: 1, back: 1, inset: 2, gap: 22, f: WLD_dd('glowworms') },   // (heavy: many a wall spot is too thin to hang from)
      { w: 3, gap: 8, f: WLD_pp('mushroom', R => ({ color: R.pick(caps)[0], size: R.range(.7, 1.4), flip: R.chance(.5) })) },
      { w: 2, gap: 8, f: WLD_pp('grass', R => ({ color: '#3a8a7a', size: R.range(1, 1.5) })) },
      { w: 1, edge: 1, f: WLD_pp('bush', { color: '#2e5a52' }) }
    ]);
    WLD_pillars(L0, R, .5, (L1, R1, x, y) => WLD_prop(L1, 'vines', x, y, { z: 38, anchor: 'top', color: '#3a7a6a', size: R1.range(.9, 1.2) }));
    WLD_glowPillars(L0, R, .25);
  },
  ambience(L0, dt) {
    WLD_mood(this);
    WLD_motes(dt, 10, (x, y) => ({ kind: 'ember', x, y, z: Math.random() * 40, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, vz: 2 + Math.random() * 4, g: -1, max: 3 + Math.random() * 2, color: Math.random() < .7 ? '#8affd0' : '#d8a8ff' }));
  }
});

/* MINE (depth 8): the Stormglass Mines. Earth floors, timbered rock, rails with ore carts, stormglass in the seams */
def('themes', 'mine', { name: 'Mine', nouns: ['Mines', 'Diggings', 'Shafts', 'Lodes'], music: 'forge',
  pal: { dirt: '#5a4838', dirt2: '#645040', stone: '#7a6e62', stone2: '#6e6358', ore: '#6ad8ff', rail: '#8a8a96', sleeper: '#5a3e26', cliff: '#4a3e34', lip: '#5a4838', plank: '#7a5a38', rune: '#3a8ab8', runeHi: '#bff0ff', void: '#060504' },
  walls: { 1: { h: 38, cut: true, cutH: 6, top: '#3a3028', side: '#5e5244', line: '#2e2620', face: 'mine', roof: 'rubble', beam: '#6a4a2a', accent: '#6ad8ff' },
           2: { h: 40, top: '#6a4a2a', side: '#7a5a36', line: '#3a2616', face: 'plank', roof: 'plain', beam: '#5a3a1e' },
           3: { h: 12, top: '#5e564e', side: '#6a4e34', line: '#2e2620', face: 'plank', roof: 'rubble' } },
  torch: 'torch', light: '#ffc070', ambient: .13, lights: 1.1, dark: [16, 12, 10],
  back: { sky: ['#050404', '#0e0a08', '#1a1410'], layers: [{ kind: 'stalactites', color: '#140f0c', y: 0, height: .22, parallax: .06 }, { kind: 'fog', color: '#3a4a5a', y: .85, height: .2, parallax: .2, drift: 2 }] },
  floor: WLD_floor(WLD_fMine),
  decorate(L0, R) {
    WLD_setup(L0, this); WLD_rails(L0, R);
    WLD_dress(L0, R, [
      { w: 2.5, edge: 1, inset: 3.5, f: WLD_dd('post', { solid: true }) },
      { w: 2, edge: 1, f: WLD_ps('crate', R => ({ color: '#8a6a3a', size: R.range(1, 1.3) })) },
      { w: 2, edge: 1, f: WLD_ps('barrel', R => ({ color: '#7a5030', size: R.range(1, 1.2) })) },
      { w: 2, edge: 1, f: WLD_ps('crystal', R => ({ color: '#6ad8ff', size: R.range(.7, 1.1) })) },
      { w: 2, f: WLD_ps('rock', R => ({ color: '#7a6e62', size: R.range(.8, 1.4) })) },
      { w: 1, f: WLD_ps('pot', { color: '#8a5a3a' }) }, { w: .8, edge: 1, f: WLD_pp('sign', { color: '#8a6a3a' }) }
    ]);
  },
  ambience(L0, dt) {
    WLD_mood(this);
    WLD_motes(dt, 6, (x, y) => ({ kind: 'dust', x, y, z: 60 + Math.random() * 30, vx: (Math.random() - .5) * 3, vy: (Math.random() - .5) * 3, vz: -14 - Math.random() * 10, max: 3.5, size: .8, color: '#9a8a78' }));
    if (Math.random() < dt * .6) WLD_motes(1, 1, (x, y) => ({ kind: 'bit', x, y, z: 80, vz: -30, g: 300, bounce: .35, max: 2, size: 1, color: '#7a6e62' }), 200);
  }
});

/* CLOCKWORK (depth 9): the Stilled Clockworks. Brass and iron plates, grates, gears in the floor and on stands, steam */
def('themes', 'clockwork', { name: 'Clockwork', nouns: ['Clockworks', 'Engines', 'Gearhalls', 'Orreries'], music: 'cogs',
  pal: { brass: '#a07a3a', iron: '#4e5260', iron2: '#555a68', seam: '#1a181e', rivet: '#9a8a6a', gear: '#c89a48', grate: '#2e2c36', cliff: '#4a4a56', lip: '#6a6a78', plank: '#5a5a66', rune: '#d8a040', runeHi: '#fff0b0', void: '#07060a' },
  walls: { 1: { h: 38, cut: true, cutH: 6, top: '#3a3a46', side: '#5a5e6e', line: '#2a2a34', face: 'metal', roof: 'grate', accent: '#b08a44' },
           2: { h: 42, top: '#a07a3a', side: '#8a6a34', line: '#4a3a1a', face: 'metal', roof: 'grate', accent: '#d8b060' },
           3: { h: 12, top: '#6a6e7e', side: '#4e5260', line: '#2a2a34', face: 'metal', roof: 'grate', accent: '#b08a44' } },
  torch: 'lamp', light: '#ffe0a0', ambient: .18, lights: 1, dark: [12, 10, 22],
  back: { sky: ['#040406', '#0a0a12', '#14121e'], layers: [{ kind: 'fog', color: '#5a5a6a', y: .8, height: .2, parallax: .15, drift: 2 }] },
  floor: WLD_floor(WLD_fClock),
  decorate(L0, R) {
    WLD_setup(L0, this);
    WLD_dress(L0, R, [
      { w: 2.5, open: 1, gap: 30, f: WLD_dd('gear', R => ({ pair: R.chance(.55), pa: R() * TAU, rad: R.range(9, 13) })) },
      { w: 2, edge: 1, inset: 6, f: WLD_dd('cog', R => ({ solid: true, pair: R.chance(.45), rad: R.range(9, 12) })) },
      { w: 1.8, open: 1, f: WLD_dd('vent') },
      { w: 1.2, f: WLD_dd('chain', R => ({ len: R.range(26, 48), color: '#6a6a78' })) },
      { w: 1.5, edge: 1, f: WLD_ps('crate', { color: '#6a5a4a' }) }, { w: 1, edge: 1, f: WLD_ps('barrel', { color: '#5a5a66' }) }
    ]);
  },
  ambience(L0, dt) {
    WLD_mood(this);
    WLD_motes(dt, 4, (x, y) => ({ kind: 'dust', x, y, z: 10 + Math.random() * 40, vx: 2, vy: 1, vz: 3, max: 3, size: 1, color: '#c8c0b0' }));
    if (Math.random() < dt * .8) { const h = ED.hero; if (h) P.sparks(h.x + (Math.random() - .5) * 240, h.y + (Math.random() - .5) * 240, 30 + Math.random() * 20, 3, null, { color: '#ffd070' }); }
  }
});

/* ABYSS (depth 11): the Lightless Maw. Obsidian columns, violet fissures, rifts into nothing, shards orbiting cold hearts */
def('themes', 'abyss', { name: 'Abyss', nouns: ['Maw', 'Abyss', 'Void Halls', 'Rifts'], music: 'spores',
  pal: { obs: '#2a2436', obs2: '#322a40', crack: '#0e0a14', glow: '#b06aff', glowDark: '#3a1a5a', glass: '#6a5a8a', cliff: '#221c2e', lip: '#3a2a50', plank: '#2e2640', rune: '#8a4ae0', runeHi: '#e8c8ff', void: '#050210' },
  walls: { 1: { h: 40, cut: true, cutH: 6, top: '#1e1828', side: '#3a3048', line: '#140e1c', face: 'basalt', roof: 'glass', accent: '#b06aff' },
           2: { h: 44, top: '#2e2640', side: '#443a58', line: '#1a1424', face: 'basalt', roof: 'glass', accent: '#c88aff' },
           3: { h: 12, top: '#2e2640', side: '#3a3048', line: '#140e1c', face: 'basalt', roof: 'glass', accent: '#b06aff' } },
  torch: 'brazier', light: '#a86aff', ambient: .09, lights: .8, dark: [12, 4, 24],
  sky: ['#020106', '#0a0618', '#180a2c'],
  back: { sky: ['#020106', '#0a0618', '#180a2c'], stars: 70, starsY: 1, layers: [{ kind: 'clouds', color: '#4a2a7a', y: .45, height: .5, parallax: .04, drift: 1.5, nebula: true }, { kind: 'fog', color: '#5a2a8a', y: .9, height: .22, parallax: .2, drift: 3 }] },
  floor: WLD_floor(WLD_fAbyss),
  decorate(L0, R) {
    WLD_setup(L0, this);
    WLD_holes(L0, R, .6, 1.6, 3);
    WLD_dress(L0, R, [
      { w: 2.5, edge: 1, f: WLD_dd('spikes', R => ({ solid: true, color: '#8a5ad8', h: R.range(14, 26), glow: true })) },
      { w: 1.6, open: 1, f: WLD_dd('shard') },
      { w: 2, f: WLD_pp('skull', { color: '#b8b0c8' }) }, { w: 1.5, f: WLD_pp('bones', { color: '#b8b0c8' }) },
      { w: 2, edge: 1, f: WLD_ps('rock', R => ({ color: '#3a3048', size: R.range(.9, 1.5) })) }
    ]);
    for (const rm of L0.rooms) if (rm.hole) { WLD_deco(L0, 'rubble', rm.hole.x, rm.hole.y, { color: '#2e2640', lip: '#5a3a8a', overVoid: true }); WLD_deco(L0, 'rift', rm.hole.x, rm.hole.y, { rad: rm.hole.r, overVoid: true }); }
    WLD_rim(L0, R, [0, 1], 'rubble', { color: '#2e2640', lip: '#5a3a8a' });
  },
  ambience(L0, dt) {
    WLD_mood(this);
    WLD_motes(dt, 9, (x, y) => ({ kind: 'ember', x, y, z: Math.random() * 20, vx: (Math.random() - .5) * 4, vy: (Math.random() - .5) * 4, vz: 6 + Math.random() * 8, g: -2, max: 2.5 + Math.random() * 2, color: Math.random() < .7 ? '#b06aff' : '#6a8aff' }));
    WLD_motes(dt, 3, (x, y) => ({ kind: 'dust', x, y, z: 30, vx: -4, vy: -2, vz: 1, max: 4, size: 1.4, color: '#1a1026' }));
  }
});

/* OSSUARY (depth 12): the Crimson Rush. Walls of stacked skulls, bone-inlaid floors, sarcophagi, cages, candles */
def('themes', 'ossuary', { name: 'Ossuary', nouns: ['Ossuary', 'Charnel Halls', 'Boneworks', 'Catacombs'], music: 'dirge',
  pal: { slab: '#3e3834', slab2: '#46403a', mortar: '#1c1818', bone: '#d8ceb4', blood: '#6a1a1e', cliff: '#3a3230', lip: '#4a403a', plank: '#4a3a30', rune: '#b03a3a', runeHi: '#ffb0a0', void: '#0a0406' },
  walls: { 1: { h: 38, cut: true, cutH: 6, top: '#2e2826', side: '#bcb096', line: '#4a3e34', face: 'bone', roof: 'bone' },
           2: { h: 40, top: '#cfc4a8', side: '#b8ad92', line: '#4a3e34', face: 'bone', roof: 'bone' },
           3: { h: 12, top: '#4a403a', side: '#a89c84', line: '#3a2e26', face: 'bone', roof: 'slab' } },
  torch: 'candelabra', light: '#ffc080', ambient: .11, lights: 1.2, dark: [18, 6, 10],
  back: { sky: ['#050204', '#12060a', '#220a10'], layers: [{ kind: 'fog', color: '#4a1a22', y: .85, height: .2, parallax: .18, drift: 2 }] },
  floor: WLD_floor(WLD_fOss),
  decorate(L0, R) {
    WLD_setup(L0, this);
    WLD_dress(L0, R, [
      { w: 2.5, edge: 1, inset: 6, f: WLD_dd('skullpile', { solid: true }) },
      { w: 2, open: 1, f: WLD_dd('coffin', R => ({ solid: true, alongY: R.chance(.5) })) },
      { w: 1.4, f: WLD_dd('chain', R => ({ cage: true, len: R.range(36, 50) })) },
      { w: 2, f: WLD_pp('bones', { color: '#d8ceb4' }) }, { w: 2, f: WLD_pp('skull', { color: '#d8ceb4' }) },
      { w: 1.5, edge: 1, f: WLD_pp('candle', R => ({ size: R.range(1, 1.4) })) },
      { w: 1, edge: 1, f: WLD_pp('banner', { color: '#6a1a22', emblem: '#d8ceb4' }) }
    ]);
    for (const rm of L0.rooms) if (R.chance(.4)) WLD_prop(L0, 'cobweb', (rm.x + .4) * T16, (rm.y + .4) * T16, { size: 1.3 });
  },
  ambience(L0, dt) {
    WLD_mood(this);
    WLD_motes(dt, 5, (x, y) => ({ kind: 'dust', x, y, z: 40 + Math.random() * 30, vx: 1, vy: 1, vz: -5, max: 5, size: .9, color: '#6a5a58' }));
    WLD_motes(dt, 2, (x, y) => ({ kind: 'ember', x, y, z: 5 + Math.random() * 10, vz: 10, max: 2, color: '#ff9a5a' }));
  }
});

/* SKY (depth 13): the Leaping Spires. Marble gardens floating in a golden sky, gold inlay, pennants in the wind */
def('themes', 'sky', { name: 'Sky', nouns: ['Spires', 'Sky Gardens', 'Aeries', 'Cloud Courts'], music: 'ruins', pale: .9,
  pal: { marble: '#b9b1a5', marble2: '#b0a89b', joint: '#857c70', gold: '#c89c38', vein: '#a0988c', cliff: '#9a8e84', lip: '#6aa04e', plank: '#b8a88a', rune: '#4a90d0', runeHi: '#dff4ff', void: '#f0d8b8' },
  // the rock mass (only walled layouts have it, in composed depths): an overgrown garden top, darker than the marble
  // floors, so it never reads as raised floor
  walls: { 1: { h: 36, cut: true, cutH: 6, top: '#8e887c', side: '#bcb3a6', line: '#968c7e', face: 'marble', roof: 'moss', accent: '#d8b04a', moss: '#6aa04e' },
           2: { h: 44, top: '#e4ddd2', side: '#cac2b6', line: '#9a9084', face: 'marble', roof: 'marble', accent: '#d8b04a' },
           3: { h: 11, top: '#d8d0c4', side: '#bdb4a6', line: '#968c7e', face: 'marble', roof: 'marble', accent: '#d8b04a' } },
  torch: 'brazier', light: '#ffe8b0', ambient: .34, lights: .5, dark: [40, 44, 96], tint: .18,
  sky: ['#2a3a8a', '#6a7ac0', '#d8a0a8', '#f8d8a8'],
  back: { sky: ['#2a3a8a', '#6a7ac0', '#d8a0a8', '#f8d8a8'], sun: { x: .8, y: .62, r: 14, color: '#fff0c8' },
    layers: [{ kind: 'clouds', color: '#f0d0d8', y: .42, height: .18, parallax: .04, drift: 3 }, { kind: 'clouds', color: '#ffffff', y: .7, height: .24, parallax: .12, drift: 6 }, { kind: 'clouds', color: '#fff4e8', y: .98, height: .3, parallax: .26, drift: 10 }] },
  floor: WLD_floor(WLD_fSky),
  decorate(L0, R) {
    WLD_setup(L0, this);
    const flags = ['#c83a3a', '#3a6ac8', '#e8b83a'];
    WLD_dress(L0, R, [
      { w: 2.2, edge: 1, f: WLD_dd('banner', R => ({ color: R.pick(flags), color2: '#f4ecd8', pole: '#d8b04a', h: R.range(44, 56), wind: 1.2, flip: R.chance(.5) })) },
      { w: 2, edge: 1, f: WLD_pp('pillar', R => ({ color: '#e8e2d8', size: R.range(1.1, 1.4), broken: R.chance(.3) })) },
      { w: 1.4, edge: 1, f: WLD_pp('statue', R => ({ color: '#e0dad0', size: R.range(1.1, 1.4), flip: R.chance(.5) })) },
      { w: 2, gap: 8, f: WLD_pp('flowers', { color: '#f08aa8', color2: '#fff4a0' }) },
      { w: 1.5, f: WLD_pp('bush', { color: '#5a9a4a', berries: '#f0a0c0' }) },
      { w: 1, edge: 1, f: WLD_ps('tree', R => ({ color: '#e8a0c0', slot: 'l', size: R.range(1.1, 1.4) })) },
      { w: 1.5, gap: 8, f: WLD_pp('grass', { color: '#7ab05a' }) }
    ]);
    WLD_rim(L0, R, [1, 2], 'rubble', { color: '#9a8e84', lip: '#7ab05a' });
  },
  ambience(L0, dt) {
    WLD_mood(this);
    WLD_motes(dt, 12, (x, y) => ({ kind: 'spark', x: x - 120, y, z: 10 + Math.random() * 50, vx: 150 + Math.random() * 60, vy: 40, vz: 0, max: .3 + Math.random() * .3, color: '#ffffff', hot: '#ffffff' }));
    WLD_motes(dt, 3, (x, y) => ({ kind: 'bit', x, y, z: 50 + Math.random() * 30, vx: 26 + Math.random() * 10, vy: 10, vz: -6, max: 6, size: 1, color: Math.random() < .5 ? '#f8a8c8' : '#ffffff' }));
  }
});

/* AQUEDUCT (depth 14): the Drowned Aqueduct. Wet setts, water channels with curbs, waterfalls out of the dark */
def('themes', 'aqueduct', { name: 'Aqueduct', nouns: ['Aqueduct', 'Cisterns', 'Waterworks', 'Sluices'], music: 'rime',
  pal: { sett: '#6a7270', sett2: '#747c78', joint: '#243030', algae: '#3a6a4a', puddle: '#3a5a6a', curb: '#8a908a', cliff: '#4a5250', lip: '#3a6a4a', plank: '#5a4a3a', rune: '#2a9ab0', runeHi: '#c0f4ff', void: '#040a0e' },
  walls: { 1: { h: 38, cut: true, cutH: 6, top: '#4a5250', side: '#6a7470', line: '#3a4240', face: 'mossy', roof: 'moss', accent: '#3a6a4a', stain: 1 },
           2: { h: 42, top: '#8a928e', side: '#7a827e', line: '#4a5250', face: 'mossy', roof: 'slab', accent: '#3a6a4a', stain: 1 },
           3: { h: 12, top: '#8a908a', side: '#6a7470', line: '#3a4240', face: 'stone', roof: 'slab', course: 6 } },
  torch: 'torch', light: '#ffd090', ambient: .16, lights: 1, dark: [6, 14, 22],
  back: { sky: ['#030608', '#081418', '#0e2228'], layers: [{ kind: 'stalactites', color: '#0a1416', y: 0, height: .2, parallax: .06 }, { kind: 'fog', color: '#3a6a7a', y: .82, height: .22, parallax: .18, drift: 3 }] },
  floor: WLD_floor(WLD_fAqua),
  decorate(L0, R) {
    WLD_setup(L0, this); WLD_channels(L0, R);
    WLD_dress(L0, R, [
      { w: 1.6, edge: 1, back: 1, inset: 3, gap: 30, startGap: 64, f: WLD_dd('waterfall') },
      { w: 2, f: WLD_ps('pot', { color: '#8a6a5a' }) }, { w: 2, gap: 8, f: WLD_pp('grass', { color: '#4a8a5a' }) },
      { w: 1.5, edge: 1, f: WLD_ps('barrel', { color: '#6a5a44' }) },
      { w: 1.5, edge: 1, f: WLD_pp('pillar', R => ({ color: '#8a928e', size: R.range(1, 1.3), broken: R.chance(.5) })) },
      { w: 1, f: WLD_ps('rock', { color: '#6a7270' }) }
    ]);
    WLD_pillars(L0, R, .6, (L1, R1, x, y) => WLD_prop(L1, 'vines', x, y, { z: 42, anchor: 'top', color: '#3a6a4a', size: R1.range(.9, 1.2) }));
  },
  ambience(L0, dt) {
    WLD_mood(this);
    WLD_motes(dt, 6, (x, y) => ({ kind: 'dust', x, y, z: 2 + Math.random() * 12, vx: 3, vy: 2, vz: 1, max: 3, size: 2, color: '#a8c8d0' }));
    WLD_motes(dt, 4, (x, y) => ({ kind: 'bit', x, y, z: 80, vz: -60, g: 200, max: .9, size: 1, color: '#b8e0f0' }));
  }
});

/* CAVERN (depth 15, the Wyrm): the deep rock itself. Sediment floors, stalagmites, amber crystals, glow-worms */
def('themes', 'cavern', { name: 'Cavern', nouns: ['Caverns', 'Hollows', 'Grottoes', 'Deeps'], music: 'rime',
  pal: { rock: '#5a524c', rock2: '#645a52', rock3: '#4e4640', damp: '#3e4a50', pebble: '#8a8078', cliff: '#4a423c', lip: '#5a524c', plank: '#6a5238', rune: '#c07a3a', runeHi: '#ffd8a0', void: '#080504' },
  walls: { 1: { h: 40, cut: true, cutH: 6, top: '#3a3430', side: '#5e544c', line: '#2e2824', face: 'rock', roof: 'rubble' },
           2: { h: 44, top: '#4e4640', side: '#665c52', line: '#2e2824', face: 'rock', roof: 'rubble' },
           3: { h: 12, top: '#5a524c', side: '#5e544c', line: '#2e2824', face: 'rock', roof: 'rubble' } },
  torch: 'brazier', light: '#ffb060', ambient: .12, lights: 1, dark: [16, 10, 10],
  back: { sky: ['#050303', '#0e0908', '#1a100c'], layers: [{ kind: 'stalactites', color: '#150e0a', y: 0, height: .26, parallax: .07 }, { kind: 'fog', color: '#5a3a2a', y: .86, height: .2, parallax: .2, drift: 2 }] },
  floor: WLD_floor(WLD_fCave),
  decorate(L0, R) {
    WLD_setup(L0, this);
    WLD_dress(L0, R, [
      { w: 3, edge: 1, f: WLD_dd('spikes', R => ({ solid: true, color: '#6a6058', h: R.range(16, 32), blunt: true })) },
      { w: 1.4, open: 1, f: WLD_dd('spikes', R => ({ color: '#6a6058', h: R.range(8, 13), n: 2, blunt: true })) },
      { w: 1.6, edge: 1, f: WLD_dd('spikes', R => ({ solid: true, color: '#e8a04a', h: R.range(12, 20), glow: true })) },
      { w: 3, edge: 1, back: 1, inset: 2, gap: 22, f: WLD_dd('glowworms', { glow: '#a8ffe8' }) },
      { w: .6, edge: 1, back: 1, inset: 3, gap: 30, startGap: 64, f: WLD_dd('waterfall', { color: '#3a7aa0' }) },
      { w: 2, f: WLD_ps('rock', R => ({ color: '#7a7068', size: R.range(.8, 1.5) })) },
      { w: 1.2, f: WLD_pp('bones', { color: '#c8bca8' }) }, { w: 1.2, gap: 8, f: WLD_pp('mushroom', R => ({ color: '#a07a5a', size: R.range(.6, 1) })) }
    ]);
    WLD_glowPillars(L0, R, .25, { glow: '#a8ffe8' });
  },
  ambience(L0, dt) {
    WLD_mood(this);
    WLD_motes(dt, 5, (x, y) => ({ kind: 'dust', x, y, z: 8 + Math.random() * 40, vx: 2, vy: 1, vz: -1, max: 4, size: .8, color: '#b0a090' }));
    WLD_motes(dt, 2, (x, y) => ({ kind: 'bit', x, y, z: 80, vz: -50, g: 250, bounce: .2, max: 1.2, size: 1, color: '#9ab8c8' }));
  }
});
