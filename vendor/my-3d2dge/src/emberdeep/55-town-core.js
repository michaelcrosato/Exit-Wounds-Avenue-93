/* =============================================================================
 * TOWN: Emberhold's map, its people, and the framework that animates them
 * An NPC is def('npcs', id, {
 *   name: 'HARROW', title: 'Blacksmith', rig: { Humanoid options }, at: [x, y] (world) or tag, facing,
 *   service: 'smith' | 'vendor' | 'mystic' | 'waystone' | null (the panel E opens at once; a click on them chats instead),
 *   lines: ['greeting', ...] (one is picked per talk), held: { kind: 'hammer', hand: 'R' } (see heldItem),
 *   hi: ['short greeting', ...] (the bubble when the shop opens), bye: ['short farewell', ...] (the bubble when it closes),
 *   script: [{ dur, rig: { fields for rig.update }, go: [x, y] (walk there), face: angle | 'hero', fx(n, u, dt) }, ...]  (loops),
 *   update(n, dt) (instead of or after the script), near(n) (the hero came close: wave, turn...)
 * })
 * heldItem(g, rig, ox, oy, view, spec) draws a hammer, lantern, broom, shield, tankard, lute, book or pick in a
 * rig's hand from its real joints, so held things follow every animation.
 * ============================================================================= */
/** a point in a rig's local frame (f forward, r right, z up) -> screen pixels, with the view the rig was drawn in */
function rigScreen(rig, p, ox, oy, view) { const v = rig._lastView || view, w = rig._w(p), s = v.p(w[0], w[1], w[2]); return [ox + s[0], oy + s[1], v.depth(w[0], w[1], w[2])]; }
function heldItem(g, rig, ox, oy, view, spec) {
  const J = rig.J, hand = spec.hand === 'L' ? 'L' : 'R', H = J['hand' + hand], El = J['elbow' + hand]; if (!H || !El) return;
  const fdir = E.V3.norm(E.V3.sub(H, El)), s = rig.o.size, z = (view.zoom || 1) * s;
  const at = (k, up = 0) => rigScreen(rig, [H[0] + fdir[0] * k, H[1] + fdir[1] * k, H[2] + fdir[2] * k + up], ox, oy, view);
  const [hx, hy] = rigScreen(rig, H, ox, oy, view), kind = spec.kind, c = spec.color;
  if (kind === 'hammer') {   // handle along the forearm, a heavy head at the end
    const [tx, ty] = at(6); px.line(g, hx, hy, tx, ty, '#5a3620', Math.max(1, Math.round(z))); const [ax, ay] = at(6, 1.5), [bx, by] = at(6, -1.5);
    px.line(g, ax, ay, bx, by, c || '#6a6a7a', Math.max(2, Math.round(2.4 * z))); px.dot(g, ax, ay, '#c8c8d8');
  } else if (kind === 'pick') { const [tx, ty] = at(7); px.line(g, hx, hy, tx, ty, '#6a4a2a', Math.max(1, Math.round(z))); const [ax, ay] = at(7, 3), [bx, by] = at(7, -3); px.line(g, ax, ay, bx, by, '#8a8a9a', Math.max(1, Math.round(z))); }
  else if (kind === 'broom') { const [ax, ay] = at(-6), [bx, by] = at(5); px.line(g, ax, ay, bx, by, '#8a6a3a', Math.max(1, Math.round(z))); px.poly(g, [[bx - 2 * z, by], [bx + 2 * z, by], [bx + 3 * z, by + 4 * z], [bx - 3 * z, by + 4 * z]], '#c8a860'); }
  else if (kind === 'lantern') { const [lx, ly] = [hx, hy + 4 * z]; px.line(g, hx, hy, lx, ly - 2, '#2a2024'); px.glow(g, 1); px.ell(g, lx, ly + 1, 2.2 * z, 3 * z, c || '#ffcf6a'); px.dot(g, lx - 1, ly, '#fffbe0'); px.rect(g, lx - 2 * z, ly - 2 * z, 4 * z, 1, '#2a2024'); }
  else if (kind === 'tankard') { px.rect(g, hx - 2 * z, hy - 3 * z, 4 * z, 5 * z, '#8a6a3a'); px.rect(g, hx - 2 * z, hy - 3 * z, 4 * z, 1, '#f0e8d0'); px.dot(g, hx + 2 * z, hy - z, '#5a3a1a'); }
  else if (kind === 'book') { px.rect(g, hx - 3 * z, hy - 2 * z, 6 * z, 4 * z, c || '#6a2a3a'); px.rect(g, hx - 3 * z, hy - 2 * z, 6 * z, 1, '#f0e8d0'); px.line(g, hx, hy - 2 * z, hx, hy + 2 * z, '#3a1a2a'); }
  else if (kind === 'lute') { const [tx, ty] = at(8, 2); px.line(g, hx, hy, tx, ty, '#6a4a2a', Math.max(1, Math.round(z))); px.ell(g, hx - fdir[0] * 2, hy + 1, 3 * z, 2.4 * z, c || '#c89050'); px.dot(g, hx - fdir[0] * 2, hy + 1, '#3a2a1a'); }
  else if (kind === 'shield') { const [sx, sy] = at(.5); px.ell(g, sx, sy, 3.2 * z, 4.2 * z, E.shade(c || '#8a2a2a', -.3)); px.ell(g, sx - .5, sy - .5, 2.6 * z, 3.6 * z, c || '#8a2a2a'); px.dot(g, sx, sy, '#e8c040'); }
}

/* ---------- people ---------- */
function makeNPC(id) {
  const S = REG.npcs[id], n = { id, S, x: S.at[0], y: S.at[1], z: 0, vx: 0, vy: 0, r: 5, facing: S.facing || Math.PI / 2, step: 0, st: 0, near: false, greeted: 0, bubble: null, team: 'npc' };
  n.rig = new E.Humanoid(Object.assign({ size: 1 }, S.rig || {}));
  n.home = [n.x, n.y];
  return n;
}
function updateNPC(n, dt) {
  const S = n.S, h = ED.hero, d = h ? Math.hypot(h.x - n.x, h.y - n.y) : 999;
  const nearNow = d < (S.talkR || 34);
  if (nearNow && !n.near && game.time - n.greeted > 8) { n.greeted = game.time; n.waveT = 1.4; if (S.near) S.near(n); }
  n.near = nearNow; n.waveT = (n.waveT || 0) - dt; n.st += dt;
  let rs = { x: n.x, y: n.y, z: n.z, vx: 0, vy: 0, facing: n.facing };
  const sc = S.script;
  if (S.update) S.update(n, dt, rs);
  else if (sc && sc.length && !(n.near && S.stopNear !== false)) {
    const stp = sc[n.step % sc.length], u = clamp(n.st / stp.dur, 0, 1);
    if (stp.go) { const dx = stp.go[0] - n.x, dy = stp.go[1] - n.y, dd = Math.hypot(dx, dy); if (dd > 2) { const sp = stp.speed || 34; n.vx = dx / dd * sp; n.vy = dy / dd * sp; n.facing = E.approachAng(n.facing, Math.atan2(dy, dx), dt * 8); } else { n.vx = n.vy = 0; } }
    else { n.vx = n.vy = 0; if (stp.face !== undefined) n.facing = E.approachAng(n.facing, stp.face === 'hero' && h ? angTo(n, h) : stp.face, dt * 6); }
    if (stp.rig) Object.assign(rs, typeof stp.rig === 'function' ? stp.rig(n, u) : stp.rig);
    if (stp.fx) stp.fx(n, u, dt);
    if (n.st >= stp.dur && (!stp.go || Math.hypot(stp.go[0] - n.x, stp.go[1] - n.y) <= 2)) { n.st = 0; n.step++; }
  } else { n.vx = n.vy = 0; }
  if (n.near && h && !S.keepFacing) { n.facing = E.approachAng(n.facing, angTo(n, h), dt * 5); if (n.waveT > 0) rs.pose = 'wave'; rs.expr = n.talking ? null : 'smile'; }
  n.x += n.vx * dt; n.y += n.vy * dt; if (ED.L && ED.L.map) ED.L.map.collide(n);
  rs.x = n.x; rs.y = n.y; rs.vx = n.vx; rs.vy = n.vy; rs.facing = n.facing;
  n.rig.update(dt, rs);
  if (n.bubble && (n.bubble.t -= dt) <= 0) n.bubble = null;
}
function drawNPC(n, r) {
  r.shadow(n.x, n.y, 5 * (n.rig.o.size || 1), .5);
  const S = n.S;
  r.actor(n.x, n.y, n.z, (g, ox, oy) => {
    const held = S.held, behind = held && held.behind;
    if (held && behind) heldItem(g, n.rig, ox, oy, r.view, held);
    n.rig.draw(g, ox, oy, r.view);
    if (held && !behind) heldItem(g, n.rig, ox, oy, r.view, held);
    if (S.drawExtra) S.drawExtra(g, ox, oy, r.view, n);
  }, { outline: true });
  if (S.after) S.after(n, r);
  // name tag when the hero is near (not over an open panel); a speech bubble if there is one
  if ((n.near && !UI.modal) || n.bubble) r.overlay(g => {
    const [x, y] = r.w(n.x, n.y, (n.z || 0) + (n.rig.o.size || 1) * 34);
    if (n.bubble) {   // wrapped to a few short lines, kept on screen, with a tail down to the speaker; it rises into place as it appears
      const B = n.bubble, lines = B.lines || (B.lines = E.font.wrap(B.text, 118, { font: 'tiny' })), lh = 7, w = Math.max(...lines.map(l => E.font.width(l, { font: 'tiny' }))) + 8, hh = lines.length * lh + 4;
      const age = B.max - B.t, pop = age < .12 ? age / .12 : 1, bx = Math.round(clamp(x - w / 2, 2, r.W - w - 2)), by = Math.round(y - 11 - hh + (1 - pop) * 3);
      E.ui.box(g, bx, by, w, hh, { bg: '#f0e8d8', border: '#3a2a3a', shadow: false, gradient: false });
      const tx = Math.round(clamp(x, bx + 4, bx + w - 5)); px.poly(g, [[tx - 2, by + hh - 1], [tx + 2, by + hh - 1], [tx, by + hh + 3]], '#3a2a3a'); px.rect(g, tx - 1, by + hh - 1, 2, 2, '#f0e8d8');
      lines.forEach((l, i) => E.font.text(g, l, bx + w / 2, by + 3 + i * lh, '#2a1a2a', { align: 'center', font: 'tiny', outline: false }));
    }
    else { E.font.text(g, S.name, x, y - 12, '#ffd36a', { align: 'center', font: 'tiny', outline: '#0c0818' }); if (S.title) E.font.text(g, S.title, x, y - 6, '#c8c0d8', { align: 'center', font: 'tiny', outline: '#0c0818' }); }
  });
}
const say = (n, text, t = 2.5) => { n.bubble = { text, t, max: t }; };

/* ---------- the town builder: 56-town.js replaces TOWN.build with Emberhold; this fallback is a green with a waystone ---------- */
const TOWN = {
  build: null,   // () => L (a level-like object: map, flow, things, props, torches, npcs, start, waystone, portal,
                 //   uses: [{ x, y, r, label, use(h) }]: things E works on, like the stash chest)
  fallback() {
    const w = 30, h = 24, cells = new Array(w * h).fill(0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!x || !y || x === w - 1 || y === h - 1) cells[y * w + x] = 1;
    const L0 = { kind: 'town', name: 'Emberhold', w, h, cells, things: [], props: [], torches: [], runes: [], npcs: [], rooms: [{ x: 1, y: 1, w: w - 2, h: h - 2, cx: w / 2, cy: h / 2 }], seen: new Uint8Array(w * h).fill(1), hue: 0 };
    L0.map = new E.TileMap({ w, h, tile: T16, cells, types: { 1: { h: 18, top: '#3a6a3a', side: '#2a4a2a', face: 'hedge', roof: 'leaves' } }, floorTex: (x, y) => E.tex.grass(x, y) });
    L0.flow = new E.FlowField(L0.map);
    L0.waystone = { x: w / 2 * T16, y: h / 2 * T16 };
    L0.start = { x: L0.waystone.x, y: L0.waystone.y + 40 };
    L0.torches.push({ x: L0.waystone.x - 40, y: L0.waystone.y, t: 0, kind: 'brazier', color: '#ff9a4a', r: 4.5, solid: true }, { x: L0.waystone.x + 40, y: L0.waystone.y, t: 0, kind: 'brazier', color: '#ff9a4a', r: 4.5, solid: true });
    L0.randomFloor = (R, o) => randomFloor(L0, R, o);
    L0.npcs.push(makeNPC('waykeeper'));
    return L0;
  }
};
def('npcs', 'waykeeper', { name: 'ILSA', title: 'Waykeeper', at: [15 * 16 + 26, 12 * 16 - 6], facing: Math.PI / 2, service: 'waystone',
  rig: { build: 'heroic', armor: true, hat: { style: 'helmet', color: '#8a94a8' }, cape: { len: 7, width: 6, seg: 2.5 }, weapon: null, colors: { cloth: '#3a5a8a', cape: '#2a3a6a', capeIn: '#1a2440', hair: '#c8a060', trim: '#e8c860', skin: '#e8c0a0' } },
  held: { kind: 'lantern', hand: 'R', color: '#8ff0e0' },
  lines: ['The waystone remembers every depth you have reached. Step on it when you are ready.', 'Below the fifth depth the stone sings a lower note. Mind it.', 'Every stair down is new. The deep rebuilds itself behind you.'],
  script: [{ dur: 3, rig: { pose: null }, face: Math.PI / 2 }, { dur: 2.2, rig: { pose: 'kneel' } }, { dur: 1.5, rig: { pose: null } }, { dur: 2.5, rig: { pose: 'guard' }, face: 0 }] });
