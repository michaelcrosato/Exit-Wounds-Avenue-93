/* =============================================================================
 * UI: the HUD, a small immediate-mode widget kit, panels (pause, settings, death, waystone, bag) and tooltips
 * Everything is pixel art drawn in r.overlay (screen pixels). Widgets register hot rectangles while they draw;
 * the next update resolves clicks against them. A PANEL is UI.def(id, { title, modal, w, h, open(data), close(),
 * update(dt), draw(g, x, y, w, h) }) and UI.open(id, data) shows it; Esc closes the top one. Modal panels
 * pause the level (the town keeps living behind them).
 * ============================================================================= */
const UI = {
  mouse: { x: -99, y: -99, cx: 0, cy: 0, down: false, active: false, wheel: 0 },
  panels: {}, stack: [], hot: [], nextHot: [], tip: null, drag: null, hotItem: null, focus: 0, keyNav: false, keyT: -1e9, cardT: 0, card: null,
  /* the HUD's frame on a phone (screen pixels): l t r b keep it out of the notch, the status bar and the home bar, and
     b lifts the HUD bar over the touch buttons on a screen held upright; barB is how far down the touch buttons at the
     top reach (the minimap, the boss bar and the notices go under them). HUD_layout in 61-controls sets them */
  frame: { l: 0, t: 0, r: 0, b: 0, barB: 0 }, hotO: null,
  def(id, spec) { spec.id = id; this.panels[id] = spec; return spec; },
  top() { return this.stack.length ? this.panels[this.stack[this.stack.length - 1].id] : null; },
  isOpen(id) { return this.stack.some(s => s.id === id); },
  get modal() { return this.stack.some(s => this.panels[s.id] && this.panels[s.id].modal !== false); },
  open(id, data) { const P0 = this.panels[id]; if (!P0) return; if (this.isOpen(id)) return this.close(id); this.stack.push({ id, data }); this.focus = 0; this.keyNav = game.input.lastDevice === 'gamepad' || performance.now() - this.keyT < 250; if (P0.open) P0.open(data); sfx('select'); game.input.clear(); },
  close(id) { const i = id ? this.stack.findIndex(s => s.id === id) : this.stack.length - 1; if (i < 0) return; const s = this.stack.splice(i, 1)[0], P0 = this.panels[s.id]; if (P0 && P0.close) P0.close(s.data); this.focus = 0; sfx('cancel', { vol: .5 }); game.input.clear(); },
  closeAll() { while (this.stack.length) this.close(); },
  data(id) { const s = this.stack.find(q => q.id === id); return s && s.data; }
};
/* the mouse in screen pixels (the canvas scale and letterbox undone). A panel opened from the keyboard starts in key navigation */
addEventListener('keydown', () => { UI.keyT = performance.now(); });
canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' && game.input.stickOn && e.pointerId === game.input.stickId) return; UI.mouse.cx = e.clientX; UI.mouse.cy = e.clientY; UI.mouse.active = true; UI.keyNav = false; });
canvas.addEventListener('pointerdown', e => { UI.mouse.cx = e.clientX; UI.mouse.cy = e.clientY; if (e.button === 0) UI.mouse.down = true; });
addEventListener('pointerup', e => { if (e.button === 0) { UI.mouse.down = false; UI.drag = null; } });
canvas.addEventListener('wheel', e => { UI.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
function mouseHUD() { const sc = game.screen, p = sc.clientToScreen(UI.mouse.cx, UI.mouse.cy); UI.mouse.x = p[0] - sc.ix; UI.mouse.y = p[1] - sc.iy; return UI.mouse; }
/** register a hot rectangle (inside draw). o: { click, rclick, tip: lines | () => lines, drag(mx, my), key } */
function hot(x, y, w, h, o) { if ((UI.hudPass || UI.underPass) && UI.modal) return false;   // under a modal panel the HUD and the panels below it are display only
  if (UI.hotO) { x += UI.hotO[0]; y += UI.hotO[1]; }   // drawn inside the HUD's frame: the rectangle in screen pixels
  UI.nextHot.push(Object.assign({ x, y, w, h }, o)); const m = UI.mouse; return m.x >= x && m.x < x + w && m.y >= y && m.y < y + h; }
const inRect = (m, r0) => m.x >= r0.x && m.x < r0.x + r0.w && m.y >= r0.y && m.y < r0.y + r0.h;
/** run every step before the world: clicks, drags, Esc, the panel's own update. Returns true when the world should wait */
function updateUI(dt) {
  const inp = game.input, m = mouseHUD();
  syncTouchControls();
  if (UI.top() && UI.top().dom) { UI.top().update(dt); return true; }
  UI.cardT -= dt; UI.updAt = performance.now();
  NT_pull(); NT_age(dt); RUN_step(dt);
  // a hero's stash is fitted once (an old save's, or none): its items' uids stay above every new item's (42-inventory)
  const h0 = ED.hero; if (h0 && h0.stash !== UI.stashSeen && typeof LOT_stash === 'function' && !ED.demo) { LOT_stash(h0); UI.stashSeen = h0.stash; }
  let over = null; for (let i = UI.hot.length - 1; i >= 0; i--) if (inRect(m, UI.hot[i])) { over = UI.hot[i]; break; }   // the topmost rect (panels draw after the HUD)
  if (UI.drag && UI.mouse.down) UI.drag(m.x, m.y);
  // a rect that acts (click, drag, right click) takes the mouse buttons; one that only shows a tooltip (the orbs, the minimap,
  // buff and element icons) lets the swing through, so aiming at a monster behind the HUD still attacks
  const acts = !!over && !!(over.click || over.drag || over.rclick);
  if (inp.pressed('click')) { if (acts) { if (over.drag) UI.drag = over.drag, over.drag(m.x, m.y); if (over.click) over.click(); inp.suppressCode('Mouse0'); } else if (UI.modal) inp.suppressCode('Mouse0'); }
  if (inp.pressed('rclick')) { if (over && over.rclick) { over.rclick(); inp.suppressCode('Mouse2'); } else if (UI.modal || acts) inp.suppressCode('Mouse2'); }
  if (acts || (over && UI.modal)) { inp.suppressCode('Mouse0'); inp.suppressCode('Mouse2'); }
  const P0 = UI.top();
  if (inp.pressed('pause')) { if (P0) UI.close(); else if (ED.mode === 'level' || ED.mode === 'town' || ED.mode === 'proving') UI.open('pause'); else if (ED.mode === 'gallery') game.go('title'); }
  else if (P0 && inp.pressed('cancel') && !['inventory', 'skills', 'tree', 'vendor', 'smith', 'mystic', 'stash'].includes(P0.id)) UI.close();
  else if (P0 && P0.update) P0.update(dt, UI.stack[UI.stack.length - 1].data);
  // panel hotkeys (toggle)
  if (ED.mode === 'level' || ED.mode === 'town' || ED.mode === 'proving') for (const [act, id] of [['bag', 'inventory'], ['skills', 'skills'], ['tree', 'tree']]) if (inp.pressed(act) && UI.panels[id] && !(P0 && P0.captureKeys)) { if (UI.isOpen(id)) UI.close(id); else { if (P0 && P0.modal !== false && !P0.hotkeyPanel) UI.closeAll(); UI.open(id); } }
  if (UI.mouse.wheel && P0 && P0.wheel) P0.wheel(UI.mouse.wheel);
  UI.mouse.wheel = 0;
  return UI.modal || (DEV.paused && !DEV.steps);
}
/* ---------- widgets (call inside an overlay) ---------- */
const PANEL_BG = ['#1c1830', '#100c1c'], PANEL_BORDER = '#8a7aa8', GOLD = '#ffd36a';
function panelBox(g, x, y, w, h, title) {
  E.ui.box(g, x, y, w, h, { bg: PANEL_BG, border: PANEL_BORDER });
  px.rect(g, x + 3, y + 3, w - 6, 1, '#3a3050');
  if (title) { E.font.title(g, title, x + w / 2, y + 5, { scale: 1, colors: ['#fff6c8', '#ffd36a', '#e07a2a'], depth: 1, align: 'center' }); px.rect(g, x + 8, y + 15, w - 16, 1, '#4a3a60'); }
}
function button(g, x, y, w, h, label, onClick, o = {}) {
  const m = UI.mouse, focusMe = o.focus, over = hot(x, y, w, h, { label, click: o.disabled ? null : () => { sfx('confirm', { vol: .6 }); onClick(); }, tip: o.tip });
  const lit = !o.disabled && ((over && !UI.keyNav) || focusMe), c = o.color || '#3a3058';   // under key navigation a resting mouse lights nothing: one highlight
  E.ui.box(g, x, y, w, h, { bg: o.disabled ? '#242030' : lit ? E.shade(c, .25) : c, border: lit ? GOLD : o.active ? '#bff6ff' : '#6a5a88', shadow: false });
  E.font.text(g, label, x + w / 2, y + Math.round((h - 7) / 2), o.disabled ? '#6a6488' : lit ? '#fff6d8' : '#e8e0f8', { align: 'center', outline: false, shadow: '#05040a' });
  void m; return over;
}
/** a horizontal slider: value in [lo, hi] snapped to step (a value outside pins the knob to an end). Returns the (maybe changed) value via onChange */
function slider(g, x, y, w, v, lo, hi, step, onChange, o = {}) {
  const m = UI.mouse, u = clamp((v - lo) / (hi - lo), 0, 1), setAt = mx => { const q = clamp((mx - x) / w, 0, 1), nv = Math.round((lo + q * (hi - lo)) / step) * step; if (Math.abs(nv - v) > 1e-9) { v = +nv.toFixed(4); onChange(v); sfx('select', { vol: .3 }); } };
  const over = hot(x - 3, y - 3, w + 6, 10, { drag: setAt, tip: o.tip });
  px.rect(g, x, y + 1, w, 3, '#0c0818'); px.rect(g, x + 1, y + 2, Math.round((w - 2) * u), 1, o.color || GOLD);
  if (o.mark !== undefined) { const mx = x + Math.round((o.mark - lo) / (hi - lo) * w); px.rect(g, mx, y - 1, 1, 7, '#6a5a88'); }
  const kx = x + Math.round(u * w); px.rect(g, kx - 2, y - 1, 5, 7, over || o.focus ? '#fff6d8' : '#c8b8e8'); px.rect(g, kx - 1, y, 3, 5, o.color || GOLD);
  void m;
}
/** a tooltip box of lines [{ t, c, big, sep }] near (x, y), kept on screen */
function tipBox(g, lines, x, y, o = {}) {
  if (!lines || !lines.length) return;
  const W0 = o.w || Math.min(190, Math.max(...lines.map(l => E.font.width(l.t || '') + 10)));
  const wrapped = []; for (const l of lines) { if (l.sep) { wrapped.push(l); continue; } for (const t of E.font.wrap(l.t || '', W0 - 10)) wrapped.push({ t, c: l.c, big: l.big }); }
  const H0 = wrapped.reduce((a, l) => a + (l.sep ? 5 : 9), 0) + 8, W = game.W, H = game.H;
  let bx = Math.round(x + 10), by = Math.round(y + 8); if (bx + W0 > W - 2) bx = Math.round(x - W0 - 6); if (by + H0 > H - 2) by = H - H0 - 2; if (by < 2) by = 2; if (bx < 2) bx = 2;
  E.ui.box(g, bx, by, W0, H0, { bg: ['#1a1428', '#0c0818'], border: o.border || '#6a5a88', shadow: '#000000' });
  let yy = by + 4;
  for (const l of wrapped) { if (l.sep) { px.rect(g, bx + 6, yy + 2, W0 - 12, 1, '#3a3050'); yy += 5; continue; } E.font.text(g, l.t, bx + 5, yy, l.c || '#e8e0f8', { outline: false, shadow: '#05040a' }); yy += 9; }
}

/* ---------- the HUD ---------- */
function orb(g, cx, cy, R, frac, col, dark) {
  const t = E.tones(col);
  px.disc(g, cx, cy, R + 2, '#0c0818'); px.disc(g, cx, cy, R + 1, '#5a4a38'); px.disc(g, cx, cy, R, dark);
  const top = cy + R - Math.round(frac * R * 2), wob = Math.sin(game.real * 3) * 1;
  for (let y = Math.max(cy - R, Math.floor(top + wob)); y <= cy + R; y++) { const hw = Math.floor(Math.sqrt(Math.max(0, R * R - (y - cy) * (y - cy)))); px.rect(g, cx - hw, y, hw * 2 + 1, 1, y < top + wob + 1.5 ? t.hi : y > cy + R * .4 ? t.sh : t.base); }
  px.blend(g, .5, 'add', () => { px.disc(g, cx - R * .35, cy - R * .4, R * .28, '#ffffff'); });
  px.dot(g, cx - R * .45, cy - R * .5, '#ffffff');
}
/* ---------- small painted glyphs for buffs and statuses ----------
 * 8 x 8 pixel art, one digit per pixel: 1 deep (outline), 2 shade, 3 base, 4 light, 5 highlight (the tones of the
 * buff's or the status's own color). Baked once per color into a tiny canvas. */
const UI_GLYPHS = {
  sword: ['......45', '.....453', '....453.', '.1.453..', '..143...', '..31....', '.3.21...', '3.......'],
  shield: ['.111111.', '14444441', '14355341', '14355341', '14333341', '.143341.', '..1431..', '...11...'],
  crack: ['.111111.', '14441441', '14414341', '14143341', '14413341', '.141341.', '..1431..', '...11...'],
  heart: ['.11.11..', '1451331.', '1433331.', '1333321.', '.13321..', '..121...', '...1....', '........'],
  up: ['...44...', '..4554..', '.45..54.', '45.44.54', '..4554..', '.45..54.', '45....54', '........'],
  right: ['4...4...', '54..54..', '.54..54.', '..55..55', '.54..54.', '54..54..', '4...4...', '........'],
  down: ['...44...', '...44...', '...44...', '4..44..4', '54.44.45', '.544445.', '..5445..', '...55...'],
  flame: ['...4....', '...44...', '..434.4.', '.4334.4.', '.435434.', '43355334', '.325523.', '..2222..'],
  flake: ['...4....', '.4.5.4..', '..454...', '4455544.', '..454...', '.4.5.4..', '...4....', '........'],
  bolt: ['....445.', '...453..', '..453...', '.4555554', '...3554.', '...454..', '..454...', '..4.....'],
  eye: ['........', '..1111..', '.144441.', '14311341', '14311341', '.144441.', '..1111..', '........'],
  drop: ['...1....', '..141...', '..1431..', '.145331.', '.143331.', '.133321.', '..1221..', '...11...'],
  stars: ['.4......', '454..4..', '.4..454.', '.....4..', '..4.....', '.454....', '..4..4..', '....454.'],
  skull: ['..1111..', '.144441.', '14444441', '14144141', '14444441', '.144441.', '.141141.', '..1111..']
};
const UI_STATUS_GLYPH = { burn: 'flame', chill: 'flake', freeze: 'flake', shock: 'bolt', curse: 'eye', poison: 'drop', bleed: 'drop', stun: 'stars', fear: 'skull', slow: 'down', haste: 'up', vuln: 'crack' };
const UI_STATUS_TIP = { burn: 'Fire burns you each second.', chill: 'Slowed. Five stacks freeze you.', freeze: 'Frozen solid.', shock: 'You take more damage.', curse: 'Cursed.', poison: 'Venom each second; it stacks.', bleed: 'Bleeding: moving makes it worse.', stun: 'Stunned.', fear: 'Afraid.', slow: 'Slowed.', haste: 'Hasted.', vuln: 'Exposed: you take more damage.' };
// buffs that name their own look (a legendary power's, a keystone's) and the mechanics that grant one
const UI_BUFF_GLYPH = { overload: 'bolt', phoenix: 'flame', frenzy: 'drop', ward: 'shield', rally: 'up' }, UI_BUFF_MECH = { MKB_rush: 'bloodrush', 'mka-ward': 'wards' };
const UI_glyphCv = new Map();
function UI_glyph(g, id, x, y, c, s = 1) {
  const G = UI_GLYPHS[id]; if (!G) return;
  const key = id + c; let cv = UI_glyphCv.get(key);
  if (!cv) {
    cv = E.mkCanvas(8, 8); const cg = E.ctx2d(cv), t = E.tones(c), P = [null, t.deep, t.sh, t.base, t.lt, t.hi];
    G.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const k = row.charCodeAt(i) - 48; if (k > 0 && k < 6) px.rect(cg, i, j, 1, 1, P[k]); } });
    if (UI_glyphCv.size > 200) UI_glyphCv.clear(); UI_glyphCv.set(key, cv);
  }
  if (s === 1) g.drawImage(cv, Math.round(x), Math.round(y)); else g.drawImage(cv, Math.round(x), Math.round(y), 8 * s, 8 * s);
}
/** a buff's picture: its own icon(g, x, y, s), its skill's icon, its mechanic's icon, or a glyph for what it gives */
function buffGlyph(b) {
  if (b.glyph && UI_GLYPHS[b.glyph]) return b.glyph; if (UI_BUFF_GLYPH[b.id]) return UI_BUFF_GLYPH[b.id];
  const s = b.stats || {}, has = (...k) => k.some(q => s[q]);
  return has('moreDmg', 'incDmg', 'dmgPct', 'dmgFlat', 'crit', 'critDmg') ? 'sword' : has('atkSpeed', 'castSpeed') ? 'up' : has('moveSpeed') ? 'right' : has('armor', 'armorPct', 'resAll', 'dodge') ? 'shield' : has('lifeRegen', 'life', 'lifePct', 'leech') ? 'heart' : 'stars';
}
function buffPaint(g, b, x, y) {
  if (typeof b.icon === 'function') return b.icon(g, x + 1, y + 1, .75);
  if (REG.skills[b.id] && typeof drawSkillIcon === 'function') return drawSkillIcon(g, b.id, x + 1, y + 1, .75);
  const M = REG.mechanics[b.mech || UI_BUFF_MECH[b.id]]; if (M && M.icon) return M.icon(g, x + 1, y + 1, .75);
  UI_glyph(g, buffGlyph(b), x + 3, y + 3, b.color || '#8affc8');
}
/** a 14 px icon with a timer: the dark sweep of the skill bar grows down from the top as the time runs out (a refresh
 *  starts it over), the frame blinks in the last second and a half, stacks show at the corner */
function drawTimedIcon(g, x, y, c, bg, o, stacks, paint) {
  const S = 14, T = o.t || 0; if (!(o._uiMax > 0) || T > (o._uiLast || 0) + .02) o._uiMax = T; o._uiLast = T;
  const blink = T < 1.5 && T < 999 && Math.floor(game.real * 8) % 2;
  E.ui.box(g, x, y, S, S, { bg, border: blink ? '#ffffff' : c, shadow: false, gradient: false });
  paint();
  if (T < 999 && o._uiMax > 0) { const k = Math.round((S - 2) * (1 - clamp(T / o._uiMax, 0, 1))); if (k > 0) px.blend(g, .62, 'normal', () => px.rect(g, x + 1, y + 1, S - 2, k, '#05040a')); }
  if (stacks > 1) E.font.text(g, String(stacks), x + S, y + S - 5, '#ffffff', { align: 'right', font: 'tiny', outline: '#0c0818' });
}
function drawHUD(r) {
  const h = ED.hero; if (!h) return;
  r.overlay(g => { UI.hudPass = true; const f = HUD_in(g, r); try { drawHudInner(g, f, h); } finally { HUD_out(g); UI.hudPass = false; } });
}
/** draw inside the HUD's frame (UI.frame): the canvas moves to its corner and the renderer it gets back is the frame's
 *  size, so everything placed against an edge (the orbs, the skill bar, the place names, the minimap) lands inside it */
function HUD_in(g, r) {
  const F = UI.frame; if (!F.l && !F.t && !F.r && !F.b) return r;
  g.save(); g.translate(F.l, F.t); UI.hotO = [F.l, F.t];
  const f = Object.create(r);
  Object.defineProperties(f, { W: { value: r.W - F.l - F.r }, H: { value: r.H - F.t - F.b }, w: { value: (x, y, z) => { const q = r.w(x, y, z); return [q[0] - F.l, q[1] - F.t]; } } });
  return f;
}
function HUD_out(g) { if (UI.hotO) { g.restore(); UI.hotO = null; } }
/** how far the touch buttons at the top reach into the frame: the minimap, the boss bar and the notices start below */
function HUD_under() { const F = UI.frame; return F.barB > 0 ? Math.max(0, Math.ceil(F.barB - F.t) + 1) : 0; }
function drawHudInner(g, r, h) {
  {
    const W = r.W, H = r.H, cx = Math.round(W / 2), by = H - 24;
    // orbs
    const OR = 17;
    orb(g, 22, H - 22, OR, h.hp / h.maxHp, h.st.poison ? '#6ac03a' : '#d8303a', '#2a0c14');
    orb(g, W - 22, H - 22, OR, h.ember / h.maxEmber, '#ff8a2a', '#2a1408');
    if (hot(22 - OR, H - 22 - OR, OR * 2, OR * 2, { tip: [{ t: 'Life ' + fmt(Math.ceil(h.hp)) + ' / ' + fmt(h.maxHp), c: '#ff8a8a' }, { t: (h.stats.lifeRegen || 0).toFixed(1) + ' per second', c: '#c8c0d8' }] })) {}
    if (hot(W - 22 - OR, H - 22 - OR, OR * 2, OR * 2, { tip: [{ t: 'Ember ' + Math.floor(h.ember) + ' / ' + h.maxEmber, c: '#ffb070' }, { t: 'Skills spend it; Blade Dance and other basic skills make it.', c: '#c8c0d8' }] })) {}
    E.font.text(g, fmt(Math.ceil(h.hp)), 22, H - 25, '#ffffff', { align: 'center', font: 'tiny', outline: '#0c0818' });
    E.font.text(g, String(Math.floor(h.ember)), W - 22, H - 25, '#ffffff', { align: 'center', font: 'tiny', outline: '#0c0818' });
    // potions (Q) beside the life orb
    for (let i = 0; i < h.maxPotions; i++) { const x = 44 + i * 7, y = H - 12, full = i < h.potions; px.rect(g, x + 1, y - 7, 2, 2, full ? '#c8b890' : '#4a4050'); px.disc(g, x + 2, y - 2, 2.6, full ? '#e03a4a' : '#2a2030'); if (full) px.dot(g, x + 1, y - 3, '#ffc0c8'); }
    E.font.text(g, actionLabel('potion'), 44 + h.maxPotions * 7 + 2, H - 13, '#9a90b0', { font: 'tiny', outline: '#0c0818' });
    // skill bar
    const SW = 18, gap = 2, n = 6, bw = n * SW + (n - 1) * gap + 4, bx = cx - Math.round(bw / 2);
    for (let i = 0; i < n; i++) {
      const x = bx + i * (SW + gap) + (i >= 2 ? 4 : 0), y = by, id = h.slots[i], S = id && REG.skills[id];
      E.ui.box(g, x - 1, y - 1, SW + 2, SW + 2, { bg: '#141020', border: h.cdWarn && h.cdWarn.slot === i && h.cdWarn.t > 0 ? '#ff5a5a' : h.act && h.act.slot === i ? GOLD : '#5a4a70', shadow: false, gradient: false });
      if (S) {
        drawSkillIcon(g, id, x + 1, y + 1, 1);
        const cd = h.cds[id], full = S.cd ? skillCd(h, S) : 0;
        if (cd > 0 && full) { const k = Math.round(16 * cd / full); px.blend(g, .7, 'normal', () => px.rect(g, x + 1, y + 1, 16, k, '#05040a')); E.font.text(g, cd >= 1 ? String(Math.ceil(cd)) : cd.toFixed(1), x + 9, y + 6, '#ffffff', { align: 'center', font: 'tiny', outline: '#0c0818' }); }
        else if (h.ember < skillCost(h, S)) px.blend(g, .5, 'normal', () => px.rect(g, x + 1, y + 1, 16, 16, '#101848'));
      }
      const slotLabel = actionLabel(SLOT_ACTS[i], true), kw = E.font.width(slotLabel, { font: 'tiny' }) + 3; px.rect(g, x + SW - kw, y + SW - 6, kw + 1, 7, '#0c0818'); E.font.text(g, slotLabel, x + SW - kw + 2, y + SW - 5, '#c8c0d8', { font: 'tiny', outline: false });
      hot(x, y, SW, SW, { tip: S ? () => skillTip(h, id) : [{ t: 'Empty slot', c: '#9a90b0' }, { t: 'Assign a skill in the Skills panel (K).', c: '#c8c0d8' }], click: () => { if (UI.panels.skills) UI.open('skills', { slot: i }); } });
    }
    if (h.cdWarn) h.cdWarn.t -= 1 / 60;
    // dodge charges over the bar, xp bar under it
    for (let i = 0; i < h.maxDodge; i++) { const x = cx - (h.maxDodge * 6) / 2 + i * 6, full = i < h.dodges; px.rect(g, x, by - 6, 4, 2, full ? '#8fe3ff' : '#2a3040'); }
    const need = SCALE.xpNeed(h.level), xw = bw;
    const xf = Math.round((xw - 2) * clamp(h.xp / need, 0, 1)); px.rect(g, bx, H - 4, xw, 4, '#0c0818'); px.rect(g, bx + 1, H - 3, xw - 2, 2, '#2a1e40');   // the xp bar: a 2 px fill with a lit top edge, and quarter ticks
    if (xf > 0) { px.rect(g, bx + 1, H - 3, xf, 2, '#8a5ae0'); px.rect(g, bx + 1, H - 3, xf, 1, '#c8a8ff'); px.dot(g, bx + xf, H - 3, '#ffffff'); }
    for (let q = 1; q < 4; q++) px.dot(g, bx + 1 + Math.round((xw - 2) * q / 4), H - 2, '#0c0818');
    hot(bx, H - 5, xw, 5, { tip: [{ t: 'Level ' + h.level, c: GOLD }, { t: fmt(h.xp) + ' / ' + fmt(need) + ' experience', c: '#c8b0ff' }] });
    E.font.text(g, 'LV ' + h.level, bx - 4, H - 8, '#c8b0ff', { align: 'right', font: 'tiny', outline: '#0c0818' });
    // the reminder only names a pool that can still buy something (every skill at max rank, or the whole tree taken,
    // and the points just wait): PRG_canSpend (28-progression) answers, asked again when the points or the level change
    const ck = h.pts.skill + ':' + h.pts.passive + ':' + h.level, cs = typeof PRG_canSpend !== 'function' ? null : UI.csKey === ck && game.real - UI.csT < 2 ? UI.cs : (UI.csKey = ck, UI.csT = game.real, UI.cs = PRG_canSpend(h));
    const skN = cs && !cs.skill ? 0 : h.pts.skill, paN = cs && !cs.passive ? 0 : h.pts.passive;
    if (skN + paN > 0) {   // '2 SKILL POINTS (K)', '1 PASSIVE POINT (P)', '2 SKILL + 1 PASSIVE POINTS (K / P)'
      const blink = Math.floor(game.real * 2) % 2, sk = skN, pa = paN;
      const s = (sk ? sk + ' SKILL' : '') + (sk && pa ? ' + ' : '') + (pa ? pa + ' PASSIVE' : '') + ' POINT' + (sk + pa > 1 ? 'S' : '') + (sk && pa ? ' (K / P)' : sk ? ' (K)' : ' (P)');
      E.font.text(g, s, cx, by - 15, blink ? GOLD : '#e0a040', { align: 'center', font: 'tiny', outline: '#0c0818' });
    }
    E.font.text(g, fmt(h.gold) + ' GOLD', W - 44, H - 9, GOLD, { align: 'right', font: 'tiny', outline: '#0c0818' });
    // top left: where we are, the level's elements, buffs
    const L0 = ED.L; let leftW = 0;   // how far the place names reach (the boss bar keeps clear of them)
    if (L0) {
      const dl = L0.kind === 'town' ? 'EMBERHOLD' : 'DEPTH ' + L0.depth, nm = L0.kind === 'town' ? 'the last lit town' : L0.name || '';
      E.font.text(g, dl, 5, 4, GOLD, { shadow: '#05040a', outline: false });
      E.font.text(g, nm, 5, 13, '#c8c0d8', { shadow: '#05040a', outline: false });
      leftW = Math.max(E.font.width(dl), E.font.width(nm));
      if (L0.kind === 'level') {   // the speedrunner's clock: this depth's time, and the best
        const tm = L0.t || 0, best = h.best && h.best[L0.depth], ft = v => Math.floor(v / 60) + ':' + String(Math.floor(v % 60)).padStart(2, '0'), cs = ft(tm) + (best ? '  best ' + ft(best) : '');
        E.font.text(g, cs, E.font.width(dl) + 10, 4, best && tm > best ? '#9a90b0' : '#8fe3ff', { font: 'tiny', shadow: '#05040a', outline: false });
        leftW = Math.max(leftW, E.font.width(dl) + 5 + E.font.width(cs, { font: 'tiny' }));
      }
      let mx = 5;
      for (const id of L0.mechs || []) { const M = REG.mechanics[id]; if (!M) continue; E.ui.box(g, mx, 24, 14, 14, { bg: '#1a1428', border: M.color || '#8a7aa8', shadow: false, gradient: false }); if (M.icon) M.icon(g, mx + 1, 25, .75); hot(mx, 24, 14, 14, { tip: [{ t: M.name, c: M.color || GOLD }, { t: M.tip || '', c: '#c8c0d8' }] }); mx += 16; }
      // buffs, then what afflicts him: painted icons with the skill bar's dark sweep for the time that has run out
      let bxx = 5; const byy = L0.mechs && L0.mechs.length ? 42 : 26;
      for (const b of h.buffs) { drawTimedIcon(g, bxx, byy, b.color || '#8affc8', '#141020', b, b.n, () => buffPaint(g, b, bxx, byy)); hot(bxx, byy, 14, 14, { tip: () => [{ t: b.name, c: b.color }, { t: b.t > 999 ? 'while it lasts' : Math.ceil(b.t) + 's', c: '#c8c0d8' }].concat(Object.keys(b.stats || {}).map(k => ({ t: statText(k, b.stats[k]), c: '#8ab4ff' }))) }); bxx += 16; }
      for (const id in h.st) { const S = REG.statuses[id], s = h.st[id]; if (!S) continue; drawTimedIcon(g, bxx, byy, S.color, '#1a0c14', s, s.n, () => UI_glyph(g, UI_STATUS_GLYPH[id] || 'skull', bxx + 3, byy + 3, S.color)); hot(bxx, byy, 14, 14, { tip: () => [{ t: S.name, c: S.color }, { t: (s.t > 0 ? s.t.toFixed(1) + 's' : '') + (s.n > 1 ? '  •  ' + s.n + ' stacks' : ''), c: '#c8c0d8' }].concat(UI_STATUS_TIP[id] ? [{ t: UI_STATUS_TIP[id], c: '#ff9a9a' }] : []) }); bxx += 16; }
      // the pickup log under that row; the notice column keeps clear of all of it (and of the minimap)
      const pw = NT_drawPicks(g, 6, byy + (bxx > 5 ? 19 : 2), 110);
      UI.feedL = Math.max(mx, bxx, pw ? pw + 10 : 0, 118);
      drawMinimap(g, r, L0, h);
    }
    // an arrow at the screen edge toward the exit once it has been seen (and is off screen)
    if (L0 && L0.exit && L0.kind === 'level' && L0.seen[Math.floor(L0.exit.y / T16) * L0.w + Math.floor(L0.exit.x / T16)]) {
      const [ex, ey] = r.w(L0.exit.x, L0.exit.y, 10), m = 14;
      if (ex < m || ex > W - m || ey < m || ey > H - m) {
        const dx = ex - cx, dy = ey - H / 2, k = Math.min((W / 2 - m) / Math.abs(dx || 1e-3), (H / 2 - m) / Math.abs(dy || 1e-3)), ax = cx + dx * k, ay = H / 2 + dy * k, a = Math.atan2(dy, dx), c = L0.exit.open ? '#6fd6cc' : '#8a7a9a';
        px.poly(g, [[ax + Math.cos(a) * 6, ay + Math.sin(a) * 6], [ax + Math.cos(a + 2.4) * 5, ay + Math.sin(a + 2.4) * 5], [ax + Math.cos(a - 2.4) * 5, ay + Math.sin(a - 2.4) * 5]], c);
        const dd = Math.round(Math.hypot(L0.exit.x - h.x, L0.exit.y - h.y) / T16); E.font.text(g, dd + 'm', ax - Math.cos(a) * 9, ay - Math.sin(a) * 9 - 2, c, { align: 'center', font: 'tiny', outline: '#0c0818' });
      }
    }
    // boss bar: in the gap between the place names (top left) and the minimap (top right), centered when it can be
    const B = ED.boss;
    if (B && B.alive && !B.dormant) {
      const lx = L0 ? 5 + leftW + 6 : 4, rx = L0 ? W - 84 : W - 4, w = Math.max(60, Math.min(220, rx - lx)), x = Math.round(clamp(cx - w / 2, lx, Math.max(lx, rx - w))), y = 8 + HUD_under(), mid = x + w / 2;
      let nm = B.name.toUpperCase() + (B.title ? ', ' + B.title.toUpperCase() : ''), tiny = false;
      if (E.font.width(nm) > w + 20) nm = B.name.toUpperCase(); if (E.font.width(nm) > w + 20) tiny = true;
      E.font.text(g, nm, mid, tiny ? y + 2 : y, '#ff9a6a', { align: 'center', shadow: '#05040a', outline: false, font: tiny ? 'tiny' : undefined });
      E.ui.bar(g, x, y + 10, w, 6, B.hp / B.maxHp, '#d8303a');
      const ph = (B.bossDef.phases || []).slice(1); for (const p of ph) px.rect(g, x + Math.round(w * p.at), y + 10, 1, 6, '#ffd36a');
    }
    // the notices are drawn after the panels (drawNoticeFeed); the HUD tells it where the left column ends
    UI.hudDrawn = true;
    // interaction prompt (not under a panel or a conversation: '[E] Talk to ILSA' while Ilsa is talking reads as a bug)
    UI.promptShown = !!UI.prompt && !UI.modal && !(typeof talk !== 'undefined' && talk.open);
    if (UI.promptShown) E.font.text(g, UI.prompt.replace('[E]', '[' + actionLabel('interact') + ']'), cx, by - 26, '#ffffff', { align: 'center', shadow: '#05040a', outline: '#0c0818' });
    // the level card: name, depth, the new element
    if (UI.card && UI.cardT > 0) drawLevelCard(g, W, H, cx, UI.card);
  }
}

/** the level card: the depth, the name, the new element and its rule. A composed depth's mech may carry lines (one
 *  rule per element and how they combine: levelCardInfo in 50-levels-core writes them), strings or { t, c }. Each
 *  gets its own rows, an element's name before a ':' picked out in that element's color, whole sentences only; at
 *  most seven rows, so the band ends near the top of the hero's head. The elements' icons lead the heading */
function drawLevelCard(g, W, H, cx, c) {
  const a = clamp(Math.min(UI.cardT, (c.dur - UI.cardT) * 3), 0, 1);
  px.blend(g, a, 'normal', () => {
    const y = Math.round(Math.max(H * .16, HUD_under() ? HUD_under() + 72 : 0));   // under the minimap when the touch buttons push it down
    E.font.text(g, c.sub || '', cx, y - 12, '#c8c0d8', { align: 'center', shadow: '#05040a', outline: false });
    const T0 = String(c.title || '').toUpperCase(), sc = E.font.width(T0, { scale: 2 }) <= W - 16 ? 2 : 1;   // long composed names drop to one scale on narrow screens
    E.font.title(g, T0, cx, y + (sc === 1 ? 5 : 0), { scale: sc, colors: ['#fff6c8', '#ffd36a', '#e07a2a'], depth: sc, align: 'center' });
    if (!c.mech) return;
    const M = c.mech, ww = Math.min(M.lines ? 340 : 300, W - 30), rows = c._rows && c._rowsW === W ? c._rows : [];
    // rows wrap to balanced widths (no word left alone on a row), cut at whole sentences; worked out once per card
    const bal = s => { const L = E.font.wrap(s, ww); if (L.length < 2) return L; let lo = ww * .4, hi = ww; while (hi - lo > 3) { const mid = (lo + hi) / 2; if (E.font.wrap(s, mid).length <= L.length) hi = mid; else lo = mid; } return E.font.wrap(s, Math.ceil(hi)); };
    const sentences = (s, n) => { let L = bal(s); if (L.length > n) { const cut = L.slice(0, n).join(' '), dot = cut.lastIndexOf('. '); L = bal(dot > cut.length * .5 ? cut.slice(0, dot + 1) : cut.replace(/\s*\S*$/, '') + '...').slice(0, n); } return L; };
    if (!rows.length) {
    const byName = n => Object.values(REG.mechanics).find(q => q.name && q.name.toUpperCase() === n.trim().toUpperCase());
    const lines = Array.isArray(M.lines) ? M.lines.filter(Boolean) : null;
    if (lines && lines.length) {
      const body = [];
      for (const l of lines) {
        const s = typeof l === 'string' ? l : l.t || '', k = s.indexOf(':'), head = k > 0 && k < 28 ? s.slice(0, k + 1) : '', q = head && byName(head.slice(0, -1));
        sentences(s, 2).forEach((t, i) => body.push({ t, c: '#e8e0f8', head: i === 0 && head && t.startsWith(head) ? head : '', hc: (typeof l === 'object' && l.c) || (q && q.color) || GOLD }));
      }
      if (M.tip && body.length < 7) for (const t of sentences(M.tip, 1)) rows.push({ t, c: '#b8b0d0' });
      rows.push(...body.slice(0, 7 - rows.length));
    } else for (const t of sentences(M.tip || '', 4)) rows.push({ t, c: '#e8e0f8' });
    c._rows = rows; c._rowsW = W;
    }
    px.blend(g, .5, 'normal', () => px.rect(g, cx - ww / 2 - 8, y + 30, ww + 16, rows.length * 9 + 3, '#05030c'));   // a dark band: the rules read over any floor
    // the heading, led by the elements' icons (all of a combination's)
    let hd = (M.combo ? 'NEW COMBINATION: ' : 'NEW: ') + String(M.name || '').toUpperCase(); if (E.font.width(hd) > W - 40) hd = String(M.name || '').toUpperCase();
    const ids = (M.ids || (M.combo && ED.L && ED.L.mechs) || [M.id]).filter(id => REG.mechanics[id] && REG.mechanics[id].icon), iw = ids.length ? ids.length * 14 + 2 : 0, hw = E.font.width(hd, E.font.width(hd) > W - 40 - iw ? { font: 'tiny' } : undefined), x0 = Math.round(cx - (hw + iw) / 2);
    ids.forEach((id, i) => { const Q = REG.mechanics[id]; E.ui.box(g, x0 + i * 14, y + 18, 13, 13, { bg: '#1a1428', border: Q.color || PANEL_BORDER, shadow: false, gradient: false }); Q.icon(g, x0 + i * 14 + 1, y + 19, .7); });
    E.font.text(g, hd, x0 + iw, y + 22, M.color || GOLD, { shadow: '#05040a', outline: '#0c0818', font: hw < E.font.width(hd) ? 'tiny' : undefined });
    rows.forEach((l, i) => {
      const yy = y + 32 + i * 9;
      if (!l.head) return E.font.text(g, l.t, cx, yy, l.c, { align: 'center', shadow: '#05040a', outline: false });
      const lx = Math.round(cx - E.font.width(l.t) / 2), rest = l.t.slice(l.head.length);
      E.font.text(g, l.head, lx, yy, l.hc, { shadow: '#05040a', outline: false }); E.font.text(g, rest, lx + E.font.width(l.head) + 1, yy, l.c, { shadow: '#05040a', outline: false });
    });
  });
}
/* ---------- the notice feed ----------
 * notify() (00-core) pushes lines onto `notes`; the UI takes each one as it is pushed and sorts it, so no line ever
 * sits on the fight, a title, a panel's body or a tooltip:
 *  - PICKUPS (the item names BUS 'pickup' has just named) go to a small log at the left, under the buff row;
 *  - QUICK feedback (1.6 s or less: NOT ENOUGH EMBER, NO POTIONS, BAG FULL) sits just over the skill bar, where the
 *    eye already is when a skill fails;
 *  - everything else (level-ups, legendary drops, a boss slain, tips) is a column of at most four lines at the top,
 *    under the boss bar, well clear of the hero. It holds (its lines wait, their clocks stopped) while a level card or
 *    a boss's name card is up, so no title is ever talked over; a queue past four lines hurries the oldest out;
 *  - a line that repeats merges with the live one ('BAG FULL  x3'), and level-ups fold into one line;
 *  - over a panel every line moves to a band above the panel (over its title strip when there is no room), never
 *    over its body and always under its tooltips; the death screen shows none.
 * Long lines wrap to the column; the column ghosts while the mouse is over it (a loot label under it stays readable). */
const NT = { top: [], quick: [], picks: [], named: [], holdT: 0, drawAt: 0 };
const NT_TOP = 4;
BUS.on('pickup', e => { if (e && e.item) NT.named.push({ name: e.item.name, it: e.item, t: game.real }); });
BUS.on('bossWake', () => { NT.holdT = game.real + 3.9; });   // the boss's name card (36-bosses draws it for 3.8 s)
BUS.on('heroDie', () => { NT.top.length = 0; NT.quick.length = 0; });   // nothing stale greets him in town
/** 'LEVEL 7  •  +2 SKILL POINTS  +2 PASSIVE POINTS' -> { lvl, sk, pa } (points may be missing: the text is the hero's) */
function NT_level(s) { const m = /^LEVEL (\d+)/.exec(s); if (!m) return null; const sk = /\+(\d+) SKILL/.exec(s), pa = /\+(\d+) PASSIVE/.exec(s); return { lvl: +m[1], sk: sk ? +sk[1] : 0, pa: pa ? +pa[1] : 0 }; }
/** sort one new line into the feed. notify() pushes onto the core's `notes`, which keeps only six: the feed takes each
 *  line the moment it is pushed instead (a boss kill's burst of level-ups, drops and pickups loses nothing) */
notes.push = function (...a) { for (const n of a) NT_route(n); return this.length; };
function NT_pull() { while (notes.length) NT_route(notes.shift()); if (NT.named.length) NT.named = NT.named.filter(q => game.real - q.t < 1); }
function NT_route(n) {
  if (!n || UI.isOpen('death')) return;
  {
    const e = { text: String(n.text), color: n.color, t: 0, dur: n.dur || 3, n: 1 };
    const k = NT.named.findIndex(q => q.name === e.text);
    if (k >= 0) {   // an item he just picked up: the pickup log (the same name twice counts)
      const it = NT.named.splice(k, 1)[0].it, same = NT.picks.find(q => q.text === e.text && q.t < q.dur - .6);
      if (same) { same.n++; same.t = Math.min(same.t, .2); } else { NT.picks.push({ text: e.text, color: e.color, t: 0, dur: 3.4, n: 1, it }); if (NT.picks.length > 6) NT.picks.shift(); }
      return;
    }
    const same = NT.top.find(q => q.text === e.text) || NT.quick.find(q => q.text === e.text);
    if (same) { same.n++; same.t = Math.min(same.t, .2); same.dur = Math.max(same.dur, e.dur); return; }
    const lv = NT_level(e.text), prev = lv && NT.top.find(q => q.lv);
    if (prev) {   // level-ups fold: one line with the newest level and every point they gave
      const L0 = prev.lv; L0.lvl = lv.lvl; L0.sk += lv.sk; L0.pa += lv.pa;
      prev.text = L0.sk || L0.pa ? 'LEVEL ' + L0.lvl + '  •  +' + L0.sk + ' SKILL POINT' + (L0.sk > 1 ? 'S' : '') + '  +' + L0.pa + ' PASSIVE POINT' + (L0.pa > 1 ? 'S' : '') : e.text;
      prev.t = Math.min(prev.t, .2); prev.dur = Math.max(prev.dur, e.dur); return;
    }
    if (lv) e.lv = lv;
    if (e.dur <= 1.6) { NT.quick.push(e); if (NT.quick.length > 2) NT.quick.shift(); }
    else { NT.top.push(e); if (NT.top.length > 12) NT.top.shift(); }
  }
}
/** a level card or a boss's name card is up (and no panel: over a panel the band shows everything) */
const NT_held = () => !UI.modal && (UI.cardT > 0 || game.real < NT.holdT);
function NT_age(dt) {
  const held = NT_held(), tick = (list, n) => { for (let i = 0; i < list.length; i++) if (i < n) list[i].t += dt; for (let i = list.length - 1; i >= 0; i--) if (list[i].t > list[i].dur) list.splice(i, 1); };
  if (UI.modal) tick(NT.top, NT.top.length);   // over a panel only the newest shows: the rest runs out unseen
  else if (!held) { const n = NT.shown || 1, q = NT.top[0]; if (q && NT.top.length - n > 3) q.dur = Math.min(q.dur, Math.max(q.t + .5, 1.5)); tick(NT.top, n); }   // a long queue hurries the oldest line out
  tick(NT.quick, 2); tick(NT.picks, 6);
}
const NT_alpha = n => n.t < .15 ? n.t / .15 : n.t > n.dur - .5 ? (n.dur - n.t) / .5 : 1;
/** the feed, drawn after the panels and before every tooltip. rect: the top modal panel's [x, y, w, h], or null */
function drawNoticeFeed(g, W, H, rect, hud) {
  NT_pull();
  const now = performance.now(); if (now - (UI.updAt || 0) > 120) { const dt = clamp((now - (NT.drawAt || now)) / 1000, 0, .1); UI.cardT -= dt; NT_age(dt); }   // a scene without updateUI (the attract mode) still ages its lines
  NT.drawAt = now;
  if (UI.isOpen('death')) return;
  const cx = Math.round(W / 2), line = (s, x, y, c, a, band, bw) => {
    if (band) px.blend(g, .82 * a, 'normal', () => px.rect(g, Math.round(x - bw / 2), y - 2, bw, 11, '#05030c'));
    px.blend(g, a, 'normal', () => E.font.text(g, s, x, y, c, { align: 'center', shadow: '#05040a', outline: '#0c0818' }));
  };
  const label = n => n.text + (n.n > 1 ? '  x' + n.n : '');
  if (rect) {   // over a panel: a band above it, or (no room) the newest line over its title strip
    const list = NT.top.concat(NT.quick).filter(n => NT_alpha(n) > 0).sort((a, b) => b.t - a.t), ww = Math.min(W - 16, 320), rows = [];   // oldest first: the newest is last
    for (const n of list) for (const s of E.font.wrap(label(n), ww)) rows.push({ s, n });
    if (!rows.length) return;
    const full = rect[1] <= 1 && rect[3] >= H - 2;   // a full-screen panel (the passive tree): its footer hint line, not its header
    const room = Math.floor((rect[1] - 3) / 11), keep = room >= 1 ? rows.slice(-room) : rows.slice(-1), y0 = room >= 1 ? rect[1] - 2 - keep.length * 11 : full ? H - 12 : rect[1] + 4;
    const bw = r0 => Math.min(room >= 1 ? W : rect[2] - 34, E.font.width(r0.s) + 16);
    keep.forEach((r0, i) => line(r0.s, cx, y0 + i * 11, r0.n.color, NT_alpha(r0.n), true, bw(r0)));
    return;
  }
  if (!hud) {   // a scene without the HUD (the title, the gallery): the old place, a third of the way down
    let y = Math.round(H * .3);
    for (const n of NT.top.slice(0, NT_TOP).concat(NT.quick)) for (const s of E.font.wrap(label(n), W - 20)) { line(s, cx, y, n.color, NT_alpha(n), false); y += 10; }
    return;
  }
  // the column at the top: between the left column (place, elements, buffs, pickups) and the minimap
  if (!NT_held()) {
    const L0 = UI.feedL || 118, R0 = 82, ww = clamp(W - L0 - R0 - 8, 110, 300), fx = Math.round(clamp((L0 + W - R0) / 2, ww / 2 + 4, W - ww / 2 - 4)), m = UI.mouse, rows = [];
    let shown = 0;   // whole lines from the oldest, at most five rows (the first always shows); the rest wait their turn
    for (const n of NT.top.slice(0, NT_TOP)) { const L = E.font.wrap(label(n), ww); if (shown && rows.length + L.length > 5) break; shown++; const a = NT_alpha(n); for (const s of L) rows.push({ s, n, a }); }
    NT.shown = shown;
    const y0 = 28 + HUD_under(), o0 = UI.hotO || [0, 0], mx = m.x - o0[0], my = m.y - o0[1], ghost = rows.length && mx > fx - ww / 2 - 4 && mx < fx + ww / 2 + 4 && my > y0 - 3 && my < y0 + rows.length * 10 + 2 ? .3 : 1;
    rows.forEach((r0, i) => { if (r0.a > 0) line(r0.s, fx, y0 + i * 10, r0.n.color, r0.a * ghost, false); });
  }
  // quick feedback over the skill bar (above the interaction prompt when one shows)
  let qy = H - 24 - 26 - (UI.promptShown ? 11 : 0);
  for (let i = NT.quick.length - 1; i >= 0; i--) { const n = NT.quick[i], a = NT_alpha(n); if (a <= 0) continue; line(label(n), cx, qy, n.color, a, false); qy -= 10; }
}
/** the pickup log: the items he just picked up, under the buff row. They slide in from the left in their rarity's
 *  color and fade out; names are cut to the column */
function NT_drawPicks(g, x, y, maxW) {
  let yy = y, w = 0;
  for (const q of NT.picks.slice(-5)) {
    const a = NT_alpha(q); if (a <= 0) continue;
    const sx = x - Math.round((1 - E.ease.outCubic(Math.min(1, q.t / .22))) * 12), c = q.color || '#e8e0f8', dk = E.shade(c, -.55);
    let s = q.text.toUpperCase(); const tail = q.n > 1 ? ' x' + q.n : '';
    while (s.length > 3 && E.font.width(s + tail, { font: 'tiny' }) > maxW - 8) s = s.slice(0, -1);
    if (s.length < q.text.length) s = s.replace(/\s+$/, '') + '.';
    px.blend(g, a, 'normal', () => {
      px.rect(g, sx + 1, yy, 3, 5, '#0c0818'); px.rect(g, sx, yy + 1, 5, 3, '#0c0818'); px.rect(g, sx + 2, yy + 1, 1, 3, c); px.rect(g, sx + 1, yy + 2, 3, 1, c); px.dot(g, sx + 2, yy + 2, q.it && q.it.rarity >= 3 ? '#ffffff' : dk);   // a rarity gem
      E.font.text(g, s + tail, sx + 7, yy, c, { font: 'tiny', outline: '#0c0818' });
    });
    w = Math.max(w, 7 + E.font.width(s + tail, { font: 'tiny' })); yy += 8;
  }
  return w;
}
function skillTip(h, id) {
  const S = REG.skills[id], k = h.skills[id] || {}, rank = skillRank(h, id), rune = k.rune && S.runes && S.runes.find(q => q.id === k.rune);
  const out = [{ t: S.name + '  •  rank ' + rank, c: GOLD, big: true }, { t: (S.tags || []).join(', ') + (S.el && S.el !== 'phys' ? ', ' + EL(S.el).name : ''), c: '#9a90b0' }];
  const cost = skillCost(h, S); if (cost) out.push({ t: 'Costs ' + cost + ' Ember', c: '#ffb070' }); if (S.gen) out.push({ t: 'Generates ' + S.gen + ' Ember per hit', c: '#ffb070' }); if (S.cd) out.push({ t: 'Cooldown ' + skillCd(h, S).toFixed(1) + 's', c: '#8fe3ff' });
  out.push({ t: typeof S.desc === 'function' ? S.desc(rank, k.rune) : S.desc || '', c: '#e8e0f8' });
  if (rune) out.push({ t: rune.name + ': ' + rune.desc, c: '#ff9a4a' });
  if (typeof PRG_skillExtra === 'function') out.push(...PRG_skillExtra(h, id));   // mastery and rune tiers past rank 5
  return out;
}
/** the minimap: explored floor, walls, the exit, monsters nearby, the hero. It is drawn through the camera's own
 *  projection (flattened to the ground), so it turns and tilts with the view like Diablo's automap */
function drawMinimap(g, r, L0, h) {
  const big = game.input.down('map'), W0 = big ? r.W - 60 : 74, H0 = big ? r.H - 50 - HUD_under() : 54;
  const x0 = big ? 30 : r.W - W0 - 4, y0 = (big ? 25 : 4) + HUD_under(), v = r.view, k = (big ? 3.2 : 1.3) / (T16 * v.scale / (v.zoom || 1)) * T16 / T16;
  const hp0 = v.p(h.x, h.y, 0), cxm = x0 + W0 / 2, cym = y0 + H0 / 2;
  const M = (wx, wy) => { const q = v.p(wx, wy, 0); return [cxm + (q[0] - hp0[0]) * k, cym + (q[1] - hp0[1]) * k]; };
  const inside = ([sx, sy]) => sx >= x0 && sy >= y0 && sx < x0 + W0 - 1 && sy < y0 + H0 - 1;
  px.blend(g, big ? .85 : .7, 'normal', () => px.rect(g, x0, y0, W0, H0, '#08060e'));
  // the explored map is rendered once into a cached image in minimap space (rebuilt when new ground is seen or the
  // camera turns), then blitted around the hero: a few hundred polygons once, not every frame
  const key = v.id + ':' + v.yawDeg + ':' + v.pitchDeg + ':' + k.toFixed(4), c = L0._mm || (L0._mm = {});
  if (c.key !== key || (c.v !== L0.seenV && game.real - (c.t || 0) > .3)) {
    const map = L0.map, W = L0.w * T16, H = L0.h * T16; let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) { const q = v.p(x, y, 0); bx0 = Math.min(bx0, q[0] * k); bx1 = Math.max(bx1, q[0] * k); by0 = Math.min(by0, q[1] * k); by1 = Math.max(by1, q[1] * k); }
    const cw = Math.ceil(bx1 - bx0) + 4, ch = Math.ceil(by1 - by0) + 4;
    if (!c.cv || c.cv.width !== cw || c.cv.height !== ch) { c.cv = E.mkCanvas(cw, ch); c.g = E.ctx2d(c.cv); }
    const cg = c.g; cg.clearRect(0, 0, cw, ch); cg._c = null;
    const P0 = (x, y) => { const q = v.p(x, y, 0); return [q[0] * k - bx0 + 2, q[1] * k - by0 + 2]; };
    const floorAt = (cx, cy) => map.cell(cx, cy) === 0 && !(map.floorTags && map.floorTags[cy * L0.w + cx] === 'pit');
    for (let cy = 0; cy < L0.h; cy++) for (let cx = 0; cx < L0.w; cx++) {
      const i = cy * L0.w + cx; if (!L0.seen[i]) continue;
      const cell = L0.cells[i], tag = map.floorTags && map.floorTags[i]; let col;
      if (cell) { if (!(floorAt(cx + 1, cy) || floorAt(cx - 1, cy) || floorAt(cx, cy + 1) || floorAt(cx, cy - 1))) continue; col = cell === 1 ? '#9a8ab8' : '#7a6a98'; }   // only walls that face a floor
      else if (tag === 'pit') continue;
      else col = tag === 'water' || tag === 'deep' ? '#3a6aa8' : tag === 'ice' ? '#8ab0d0' : tag === 'lava' ? '#b84a1a' : '#3e3458';
      px.poly(cg, [P0(cx * T16, cy * T16), P0(cx * T16 + T16, cy * T16), P0(cx * T16 + T16, cy * T16 + T16), P0(cx * T16, cy * T16 + T16)], col);
    }
    Object.assign(c, { key, v: L0.seenV, t: game.real, ox: bx0 - 2, oy: by0 - 2 });
  }
  // blit: the hero's minimap position at the panel center, clipped to the panel
  const hx = hp0[0] * k - c.ox, hy = hp0[1] * k - c.oy, sx0 = Math.max(0, Math.round(hx - W0 / 2 + 1)), sy0 = Math.max(0, Math.round(hy - H0 / 2 + 1));
  const dx0 = Math.round(cxm - (hx - sx0)), dy0 = Math.round(cym - (hy - sy0)), bw = Math.min(c.cv.width - sx0, x0 + W0 - 1 - dx0), bh = Math.min(c.cv.height - sy0, y0 + H0 - 1 - dy0);
  if (bw > 0 && bh > 0) g.drawImage(c.cv, sx0, sy0, bw, bh, dx0, dy0, bw, bh);
  const seenAt = (x, y) => L0.seen[Math.floor(y / T16) * L0.w + Math.floor(x / T16)];
  if (L0.exit && seenAt(L0.exit.x, L0.exit.y)) { const q = M(L0.exit.x, L0.exit.y); if (inside(q)) px.rect(g, q[0] - 1, q[1] - 1, 3, 3, L0.exit.open ? '#6fd6cc' : '#8a7a9a'); }
  if (L0.waystone) { const q = M(L0.waystone.x, L0.waystone.y); if (inside(q)) px.rect(g, q[0] - 1, q[1] - 1, 3, 3, '#6fd6cc'); }
  if (L0.portal) { const q = M(L0.portal.x, L0.portal.y); if (inside(q)) px.rect(g, q[0] - 1, q[1] - 1, 3, 3, '#8ab4ff'); }
  for (const t of L0.things) if (t.mapColor && !t.dead && seenAt(t.x, t.y)) { const q = M(t.x, t.y); if (inside(q)) px.dot(g, q[0], q[1], t.mapColor); }
  for (const m of ED.foes) { if (!m.alive || Math.hypot(m.x - h.x, m.y - h.y) > 200) continue; const q = M(m.x, m.y); if (inside(q)) px.dot(g, q[0], q[1], m.boss ? '#ff5a3a' : m.elite ? '#ffd36a' : '#d8303a'); }
  if (L0.npcs) for (const n of L0.npcs) { const q = M(n.x, n.y); if (inside(q)) px.dot(g, q[0], q[1], '#ffd36a'); }
  px.rect(g, cxm - 1, cym - 1, 3, 3, '#ffffff'); px.dot(g, cxm, cym, '#2f8f86');
  px.rect(g, x0, y0, W0, 1, '#5a4a70'); px.rect(g, x0, y0 + H0 - 1, W0, 1, '#5a4a70'); px.rect(g, x0, y0, 1, H0, '#5a4a70'); px.rect(g, x0 + W0 - 1, y0, 1, H0, '#5a4a70');
  if (!big) hot(x0, y0, W0, H0, { tip: [{ t: 'Map', c: GOLD }, { t: 'Hold Tab for the full map.', c: '#c8c0d8' }] });
}
/** mark what the hero has seen (a radius around him) */
function reveal(L0, h, rad = 9) {
  const cx = Math.floor(h.x / T16), cy = Math.floor(h.y / T16);
  if (cx === L0._rvx && cy === L0._rvy) return; L0._rvx = cx; L0._rvy = cy;
  for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) if (x >= 0 && y >= 0 && x < L0.w && y < L0.h && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= rad * rad) { const i = y * L0.w + x; if (!L0.seen[i]) { L0.seen[i] = 1; L0.seenV = (L0.seenV || 0) + 1; } }
}
/** draw the open panels and the tooltip (after the HUD) */
function drawPanels(r) {
  r.overlay(g => {
    let rect = null;   // the top modal panel's rectangle: the notices keep off it
    for (const s of UI.stack) {
      const P0 = UI.panels[s.id]; if (!P0 || P0.dom) continue;
      const top = s === UI.stack[UI.stack.length - 1];
      if (P0.modal !== false && top && P0.dim !== false) px.blend(g, .45, 'normal', () => px.rect(g, 0, 0, r.W, r.H, '#05030c'));
      const w = typeof P0.w === 'function' ? P0.w(r.W, r.H) : Math.min(P0.w || 240, r.W - 8), h = typeof P0.h === 'function' ? P0.h(r.W, r.H) : Math.min(P0.h || 180, r.H - 8);
      const x = P0.x !== undefined ? (typeof P0.x === 'function' ? P0.x(r.W, w) : P0.x) : Math.round((r.W - w) / 2), y = P0.y !== undefined ? P0.y : Math.round((r.H - h) / 2);
      UI.underPass = !top;   // a panel under the top one takes no clicks (a click in a gap of the top panel must not reach the one below)
      if (P0.modal !== false) rect = [x, y, w, h];
      try {
        if (P0.box !== false) panelBox(g, x, y, w, h, P0.title);
        P0.draw(g, x, y, w, h, s.data);
        if (P0.box !== false) button(g, x + w - 14, y + 3, 11, 11, 'x', () => UI.close(s.id), { color: '#4a2a3a' });
      } finally { UI.underPass = false; }
    }
    // the notices: over the panels (never on their bodies) and under every tooltip, which draws after them (an
    // item's tooltip is queued by its panel, the core tooltip comes next)
    if (rect || !UI.hideHud) { const f = !rect && UI.hudDrawn ? HUD_in(g, r) : r; try { drawNoticeFeed(g, f.W, f.H, rect, UI.hudDrawn); } finally { if (f !== r) HUD_out(g); } } UI.hudDrawn = false;
    // tooltip: the hovered hot rect's tip (last registered wins: the topmost)
    const m = UI.mouse; let tipR = null;
    for (const r0 of UI.nextHot) if (r0.tip && inRect(m, r0)) tipR = r0;
    if (tipR) tipBox(g, typeof tipR.tip === 'function' ? tipR.tip() : tipR.tip, m.x, m.y, { border: tipR.tipBorder });
    UI.hot = UI.nextHot; UI.nextHot = [];
  });
}
function showCard(title, sub, mech, dur = 5) { UI.card = { title, sub, mech, dur }; UI.cardT = dur; }

/* ---------- panels: pause, death, waystone (Settings, the window for everything, is 64-menu.js) ---------- */
function pauseItems() {
  return [['RESUME', () => UI.close('pause')], ['INVENTORY', () => UI.open('inventory')], ['SKILLS', () => UI.open('skills')], ['PASSIVES', () => UI.open('tree')],
    ['SETTINGS', () => UI.open('settings')], ['TOOLS', () => UI.open('settings', { tab: 'tools' })], FS.can() ? [FS.on() ? 'LEAVE FULL SCREEN' : 'FULL SCREEN', () => FS.toggle()] : null,
    ED.mode === 'level' ? ['TOWN PORTAL', () => { UI.closeAll(); openTownPortal(ED.hero); }] : null,
    ['SAVE AND QUIT', () => { UI.closeAll(); saveGame(); game.go('title'); }]].filter(Boolean);
}
UI.def('pause', { title: 'PAUSED', w: 180, h: (W, H) => Math.min(H - 8, 36 + pauseItems().length * 18), draw(g, x, y, w) {
  pauseItems().forEach(([label, fn], i) => button(g, x + 12, y + 20 + i * 18, w - 24, 16, label, fn, { focus: UI.keyNav && UI.focus === i }));
}, update() { const items = pauseItems(); menuKeys(items.length, i => items[i][1]()); } });
/** up / down / confirm over a panel's list of n entries */
function menuKeys(n, pick) {
  const inp = game.input;
  if (inp.repeat('menuUp')) { UI.focus = (UI.focus + n - 1) % n; UI.keyNav = true; sfx('select', { vol: .4 }); }
  if (inp.repeat('menuDown')) { UI.focus = (UI.focus + 1) % n; UI.keyNav = true; sfx('select', { vol: .4 }); }
  if (UI.keyNav && inp.pressed('confirm')) { inp.consumeAll(); pick(UI.focus); }
}
// [key, label, what it does, which way is easier: +1 when more is easier (hero, xp, loot), -1 for the monsters]
const DIFF_ROWS = [['heroDmg', 'Hero damage', 'Every hit you deal.', 1], ['heroHp', 'Hero life', 'Your maximum life.', 1], ['heroSpeed', 'Hero speed', 'How fast you move, strike and cast.', 1],
  ['foeDmg', 'Monster damage', 'Every hit a monster deals.', -1], ['foeHp', 'Monster life', 'Monster and boss life (the living ones change too).', -1], ['foeSpeed', 'Monster speed', 'How fast monsters and bosses move, wind up, strike and shoot (the living ones change too).', -1],
  ['density', 'Monster density', 'Packs per room. Takes hold from the next depth.', -1], ['xp', 'Experience gain', 'Experience from every kill.', 1], ['loot', 'Loot drops', 'How often monsters drop items and gold.', 1]];
/** set one difficulty value and make it felt at once: stats recompute, living monsters take the new life and speed */
function setDiff(k, v) {
  const was = DIFF[k] || 1; v = +clamp(v, .25, 4).toFixed(2); if (v === was) return; DIFF[k] = v; saveOpts();
  const q = v / was;
  if (k === 'foeHp') for (const m of ED.foes) if (m.alive && m.maxHp) { m.maxHp *= q; m.hp *= q; }
  if (ED.hero) computeStats(ED.hero);
}
/* the views Emberdeep plays in, in V's order (the engine's side view sees the floor edge on; overhead is for flat games) */
const VIEW_IDS = ['iso', 'threequarter', 'topdown', 'brawler'];
const VIEW_TIPS = { iso: 'Turned 45 degrees and tilted 30, as in Diablo and Bastion. The default.', threequarter: 'Straight on and tilted 55, as in Zelda and Stardew Valley.',
  topdown: 'Straight on and nearly overhead, as in Hotline Miami.', brawler: 'Straight on and tilted only 25, as in Streets of Rage.' };
/** look from another view (an id of VIEW_IDS), kept with the options: Settings > Graphics and the V key (which names it) */
function chooseView(id) { game.setView(id); OPT.view = game.baseView.id; saveOpts(); }
const settingsReset = () => { for (const k in DIFF_DEFAULT) setDiff(k, DIFF_DEFAULT[k]); };
/* ---------- the descent's record, for the death screen: from leaving town (or entering the Proving Grounds) ----------
 * the last hits he took (who, which element, how hard), the killing blow, and the run: time, kills, loot, gold, levels */
const RUN = { mode: null, stale: true, t: 0, kills: 0, items: 0, legends: 0, gold: 0, levels: 0, depths: 0, hits: [], killer: null, focus: 0, anim: 0, cv: null, view: null };
function RUN_reset(mode) { Object.assign(RUN, { mode, stale: false, t: 0, kills: 0, items: 0, legends: 0, gold: 0, levels: 0, depths: 0, hits: [], killer: null }); }
function RUN_step(dt) {
  const md = ED.mode; if (ED.demo) return;
  if (md === 'level' || md === 'proving') { if (RUN.stale || RUN.mode !== md) RUN_reset(md); const h = ED.hero; if (h && h.alive && !UI.modal) RUN.t += dt; }
  else RUN.stale = true;
}
/** who dealt a hit: a monster's full name (a rare's own name, a champion's affix), a status for damage over time */
function RUN_who(hit) {
  const s = hit.src;
  if (s && s.team === 'hero') return 'Yourself';
  if (s && s.name) return s.name; if (hit.srcName) return hit.srcName;
  if (hit.tags && hit.tags.includes('dot')) { const st = REG.statuses[EL(hit.el).status]; return st ? st.name : EL(hit.el).name; }
  return s && s.kind ? cap(String(s.kind)) : 'The deep itself';
}
BUS.on('levelStart', () => { if (ED.demo) return; if (RUN.stale || RUN.mode !== 'level') RUN_reset('level'); RUN.depths++; });
BUS.on('kill', e => { if (!ED.demo && e.tgt && e.tgt.team === 'foe') RUN.kills++; });
BUS.on('pickup', e => { if (!ED.demo && e && e.item) { RUN.items++; if (e.item.rarity >= 3) RUN.legends++; } });
BUS.on('gold', e => { if (!ED.demo && e && e.n > 0) RUN.gold += e.n; });
BUS.on('heroLevel', () => { if (!ED.demo) RUN.levels++; });
BUS.on('hurt', e => { if (ED.demo || !e.hit) return; RUN.hits.push({ name: RUN_who(e.hit), el: e.hit.el || 'phys', dmg: e.dmg || e.hit.dmg || e.hit.amount || 0, hit: e.hit }); if (RUN.hits.length > 5) RUN.hits.shift(); });
BUS.on('heroDie', e => {
  if (ED.demo) return; const hit = (e && e.hit) || {}, s = hit.src;
  RUN.killer = { name: RUN_who(hit), el: hit.el || 'phys', dmg: hit.dmg || hit.amount || 0, m: s && s.team === 'foe' ? s : null, dot: !!(hit.tags && hit.tags.includes('dot')) };
  RUN.hits = RUN.hits.filter(q => q.hit !== e.hit);   // the killing blow may have been felt first: it is not 'before'
  RUN.anim = 0;
});
/** the killer's likeness: its own rig (or blob, or body) drawn into a small canvas with the in-game outline, in the
 *  glow of the element that killed him. It turns to the camera and gloats (a humanoid cheers); anything else gets a skull */
function RUN_portrait(g, x, y, S, K) {
  const e = EL(K ? K.el : 'phys'), m = K && K.m;
  E.ui.box(g, x, y, S, S, { bg: ['#2a1422', '#0a0610'], border: '#8a3a4a', shadow: false });
  px.blend(g, .22 + .06 * Math.sin(game.real * 2.5), 'add', () => { px.disc(g, x + S / 2, y + S * .66, S * .34, e.color); px.disc(g, x + S / 2, y + S * .66, S * .2, e.light); });
  px.blend(g, .6, 'normal', () => px.ell(g, x + S / 2, y + S - 6, S * .26, 2.5, '#05030a'));
  const body = m && (m.rig || m.blob || m.body);
  if (!body) { UI_glyph(g, 'skull', x + S / 2 - 12, y + S / 2 - 13, e.light, 3); return; }
  const w = S - 2; if (!RUN.cv || RUN.cv.w !== w) { const cv = E.mkCanvas(w, w), out = E.mkCanvas(w, w); RUN.cv = { w, cv, g: E.ctx2d(cv), out, og: E.ctx2d(out) }; }
  const C = RUN.cv, V = RUN.view || (RUN.view = new E.View('portrait', 'Killer', 0, 16, 1, 1)), tall = (m.head || 28) * (m.scale || 1) + 10;
  V.set(0, 16, clamp((S - 8) / tall, .35, 2), 1);
  C.g.clearRect(0, 0, w, w);
  try { if (m.rig) m.rig.draw(C.g, w / 2, w - 5, V); else if (m.blob) m.blob.draw(C.g, w / 2, w - 5, V); else m.body.draw(C.g, w / 2, w - 5, V, m); } catch (err) { void err; }
  C.og.clearRect(0, 0, w, w); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) C.og.drawImage(C.cv, dx, dy);
  C.og.globalCompositeOperation = 'source-in'; C.og.fillStyle = '#0c0818'; C.og.fillRect(0, 0, w, w); C.og.globalCompositeOperation = 'source-over'; C.og.drawImage(C.cv, 0, 0);
  g.drawImage(C.out, x + 1, y + 1);
}
/** where the second button goes: the depth itself if the waystone remembers it, else the nearest remembered one above */
const RUN_retryDepth = h => { const L = waystoneDepths(h).filter(d => d <= Math.max(1, ED.depth || 1)); return L.length ? Math.max(...L) : 1; };
function RUN_leave(retry) {
  const h = ED.hero; UI.closeAll(); h.gold = Math.floor(h.gold * .9); reviveHero(h);
  if (!retry) goTown(); else if (ED.mode === 'proving') game.go('proving'); else descend(RUN_retryDepth(h));
}
UI.def('death', { title: 'YOU DIED', w: W => Math.min(W - 8, 290), h: (W, H) => Math.min(H - 8, 160),
  open() { RUN.focus = 0; },
  update(dt) {
    const inp = game.input, K = RUN.killer, m = K && K.m;
    if (inp.repeat('menuLeft') || inp.repeat('menuRight') || inp.repeat('menuUp') || inp.repeat('menuDown')) { RUN.focus = 1 - RUN.focus; UI.keyNav = true; sfx('select', { vol: .4 }); }
    if (inp.pressed('confirm')) { inp.consumeAll(); RUN_leave(RUN.focus === 1); return; }
    // the killer turns to the camera and gloats over him (the level itself stands still behind the panel)
    RUN.anim += dt; if (m && m.rig && m.rig.update && m.rig.J) m.rig.update(dt, { x: m.x, y: m.y, z: 0, vx: 0, vy: 0, facing: E.approachAng(m.rig.facing || 0, Math.PI / 2 + .45, dt * 5), pose: RUN.anim % 4 < 1.6 ? 'cheer' : 'hips', expr: RUN.anim % 4 < 1.6 ? 'shout' : 'smile' });
  },
  draw(g, x, y, w, hh) {
    const h = ED.hero, K = RUN.killer || { name: 'The deep itself', el: 'phys', dmg: 0 }, e = EL(K.el), tiny = { font: 'tiny', outline: false }, m = K.m;
    // who: the portrait, the name (in its rank's color), a champion's or a rare's affixes, and the blow
    const PS = 46, px0 = x + 10, tx = px0 + PS + 8, tw = x + w - 10 - tx;
    RUN_portrait(g, px0, y + 20, PS, K);
    E.font.text(g, 'SLAIN BY', tx, y + 21, '#9a7080', tiny);
    const nc = m ? (m.boss ? '#ff9a6a' : m.elite === 2 ? GOLD : m.elite ? '#9ab8ff' : '#f0e8f8') : e.light, nm = String(K.name);
    E.font.text(g, nm, tx, y + 29, nc, { shadow: '#05040a', outline: false, font: E.font.width(nm) > tw ? 'tiny' : undefined });
    const aff = m && (m.affixes || []).map(id => REG.affixes[id] && REG.affixes[id].name).filter(Boolean);
    let ly = y + 40; if (aff && aff.length) { E.font.text(g, aff.join('  •  ').toUpperCase(), tx, ly, '#c8a8d8', tiny); ly += 8; }
    px.rect(g, tx, ly + 1, 5, 5, e.dark); px.rect(g, tx, ly + 1, 5, 1, e.light); px.rect(g, tx + 1, ly + 2, 3, 3, e.color);   // the element chip
    const pct = h && h.maxHp ? Math.round(K.dmg / h.maxHp * 100) : 0;
    E.font.text(g, K.dot ? 'WORN DOWN BY ' + String(K.name).toUpperCase() : 'A ' + fmt(Math.round(K.dmg)) + ' ' + e.name.toUpperCase() + ' BLOW' + (pct >= 100 ? '  (MORE THAN ALL YOUR LIFE)' : pct >= 40 ? '  (' + pct + '% OF YOUR LIFE)' : ''), tx + 8, ly + 1, e.light, tiny);
    ly += 9;
    const prev = RUN.hits.slice(-3).reverse();
    if (prev.length && ly < y + 66) { let hx = tx; E.font.text(g, 'BEFORE:', hx, ly, '#6a6488', tiny); hx += 30; for (const q of prev) { const s = fmt(Math.round(q.dmg)) + ' ' + EL(q.el).short, sw = E.font.width(s, { font: 'tiny' }); if (hx + sw > x + w - 8) break; E.font.text(g, s, hx, ly, EL(q.el).color, tiny); hx += sw + 7; } }
    // the descent in numbers
    const sy = y + 72; px.rect(g, x + 8, sy - 3, w - 16, 1, '#4a3a60');
    const ft = v => Math.floor(v / 60) + ':' + String(Math.floor(v % 60)).padStart(2, '0'), cw = Math.floor((w - 16) / 3);
    const cells = [['DEPTH', ED.mode === 'proving' ? 'PROVING' : String(ED.depth), h && h.maxDepth > ED.depth ? 'deepest ' + h.maxDepth : 'your deepest'], ['TIME', ft(RUN.t), RUN.depths > 1 ? RUN.depths + ' depths' : ''], ['KILLS', fmt(RUN.kills), ''],
      ['LOOT', fmt(RUN.items), RUN.legends ? RUN.legends + ' legendary' : ''], ['GOLD', '+' + fmt(RUN.gold), ''], ['LEVELS', '+' + RUN.levels, h ? 'now ' + h.level : '']];
    cells.forEach(([k, v, sub], i) => {
      const cx0 = x + 10 + (i % 3) * cw, cy0 = sy + 2 + Math.floor(i / 3) * 21;
      E.font.text(g, k, cx0, cy0, '#8a80a8', tiny); E.font.text(g, v, cx0, cy0 + 7, '#fff6d8', { shadow: '#05040a', outline: false });
      if (sub) E.font.text(g, sub.toUpperCase(), cx0 + E.font.width(v) + 4, cy0 + 9, '#6a6488', tiny);
    });
    // the price, and the way back
    const by = y + hh - 22;
    E.font.text(g, 'THE WAYSTONE CARRIES YOU OUT. YOU DROP ' + fmt(Math.floor((h ? h.gold : 0) * .1)) + ' GOLD.', x + w / 2, by - 10, '#9a90b0', { align: 'center', font: 'tiny', outline: false });
    const bw = Math.floor((w - 26) / 2), rd = h ? RUN_retryDepth(h) : 1;
    [['RETURN TO EMBERHOLD', false], [ED.mode === 'proving' ? 'TRY AGAIN' : 'WAYSTONE TO DEPTH ' + rd, true]].forEach(([label, retry], i) => {
      const over = button(g, x + 10 + i * (bw + 6), by, bw, 15, label, () => RUN_leave(retry), { focus: RUN.focus === i, color: i ? '#3a2a4a' : undefined,
        tip: i ? [{ t: ED.mode === 'proving' ? 'Try again' : 'Straight back down', c: GOLD }, { t: ED.mode === 'proving' ? 'The waves start over.' : 'Revive and walk into depth ' + rd + ' again (a fresh one), without the walk through town.', c: '#c8c0d8' }] : null });
      if (over && !UI.keyNav) RUN.focus = i;   // the mouse moves the one highlight, the keys move it back
    });
  } });
/* the waystone's list: the panel is as tall as its depths need (it scrolls past ten). ONE row is lit: the focus, which
   the keys move and the mouse moves too (hovering a row makes it the focus), and the list scrolls only to keep it in view */
const WAY = { top: 0 };
UI.def('waystone', { title: 'THE WAYSTONE', w: 220, h: (W, H) => Math.min(H - 8, 200, 52 + Math.min(10, ED.hero ? waystoneDepths(ED.hero).length : 4) * 17), open() { WAY.top = 0; }, draw(g, x, y, w, h) {
  const hero = ED.hero, list = waystoneDepths(hero), sub = E.font.wrap('Choose where to descend. Every fifth depth is remembered.', w - 16, { font: 'tiny' }).slice(0, 2);
  sub.forEach((l, i) => E.font.text(g, l, x + w / 2, y + 19 + i * 7, '#9a90b0', { align: 'center', font: 'tiny', outline: false }));
  const top = y + 21 + sub.length * 7, rows = Math.max(1, Math.floor((y + h - 6 - top) / 17)), f = clamp(UI.focus || 0, 0, list.length - 1);
  WAY.top = clamp(f < WAY.top ? f : f > WAY.top + rows - 1 ? f - rows + 1 : WAY.top, 0, Math.max(0, list.length - rows)); const start = WAY.top;
  list.slice(start, start + rows).forEach((d, i) => { const k = start + i, rec = recipe(d, 0), label = 'DEPTH ' + d + ' • ' + rec.name; if (button(g, x + 12, top + i * 17, w - 24, 14, label.length > 34 ? label.slice(0, 33) + '.' : label, () => { UI.closeAll(); descend(d); }, { focus: f === k, active: d === hero.maxDepth }) && !UI.keyNav) UI.focus = k; });
  if (list.length > rows) { const th = Math.max(6, Math.round((rows * 17 - 3) * rows / list.length)), ty = top + Math.round((rows * 17 - 3 - th) * start / Math.max(1, list.length - rows)); px.rect(g, x + w - 8, top, 2, rows * 17 - 3, '#1c1830'); px.rect(g, x + w - 8, ty, 2, th, '#8a7aa8'); }
}, update() { const list = waystoneDepths(ED.hero); menuKeys(list.length, i => { UI.closeAll(); descend(list[i]); }); },
  wheel(d) { const n = waystoneDepths(ED.hero).length; UI.focus = clamp((UI.focus || 0) + Math.sign(d), 0, n - 1); UI.keyNav = true; } });
function waystoneDepths(h) { const s = new Set([1]); for (let d = 5; d <= h.maxDepth; d += 5) s.add(d); s.add(h.maxDepth); if (ED.savedLevel) s.delete(0); return [...s].sort((a, b) => b - a); }
/* the UI's state for tests and tools: window.__edUI.notify('TEXT', '#fff', 3), .feed (the sorted notices), .run */
window.__edUI = { notify: (t, c, d) => notify(t, c, d), showCard: (a, b, c, d) => showCard(a, b, c, d), feed: NT, run: RUN, glyphs: UI_GLYPHS };
