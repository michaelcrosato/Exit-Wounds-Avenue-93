/* =============================================================================
 * INVENTORY AND SHOPS: the bag and paper doll (I), Cobb's shop, Harrow's forge and Seren's altar
 * Pixel-art panels in the style of 60-ui-core.js, built on its kit (UI.def, hot, button, panelBox, tipBox):
 *   inventory  the 10 slots around a live view of the hero's own rig (it turns slowly, reacts when gear changes and
 *              can be turned by dragging); the bag; rich tooltips that compare with what is worn; click equips, drag
 *              moves, right-click drops (or sells while a shop is open); a character sheet tab with every stat
 *   vendor     Cobb: a stock that rerolls every town visit (scaled to the deepest depth), buy, sell, buy back, gamble
 *   smith      Harrow: reforge (reroll every affix), temper (raise the item level), salvage (into materials)
 *   mystic     Seren: enchant (reroll one affix, D4 style), transmute (raise the rarity), imprint (a salvaged
 *              legendary's power onto another item), respec
 *   stash      the chest in Emberhold: four tabs of forty, plus the materials and the essences salvage gives
 * Crafting costs gold AND materials (Iron Scrap, Rune Dust, Ember Cores), so salvaging is not selling.
 * Mouse and keyboard: arrows move a focus over everything, Enter uses, Backspace sells or drops, Tab switches tabs.
 * Menus animate in real time (performance.now), so slow motion never slows them. Private names start with LOT_.
 * ============================================================================= */
const LOT_UI = {
  active: false,        // is the panel being drawn the top one (only the top one registers clicks)
  press: null,          // a press on an item: { key, it, x0, y0, moved, click(), drop(target) }
  targets: [],          // drop targets drawn this frame: { x, y, w, h, kind: 'bag' | 'slot' | 'sell' | 'anvil', i, slot }
  nav: [], navLast: [], focus: null,   // keyboard focus: spatial navigation over everything focusable
  tip: null, panelRect: [0, 0, 0, 0], tab: 'bag', scroll: 0, maxScroll: 0,
  doll: null, dollView: null, fx: [], last: 0, rdt: 0, goldAt: null, slotAt: {}, confirm: null, confirmT: 0, cv: {}
};
/* the panels are registered once the whole script has run: UI lives in 60-ui-core.js, which loads after this file */
const LOT_PANELS = {};
queueMicrotask(() => { for (const id in LOT_PANELS) UI.def(id, LOT_PANELS[id]); });
const LOT_hot = (x, y, w, h, o) => LOT_UI.active ? hot(x, y, w, h, o) : false;
const LOT_in = (m, x, y, w, h) => m.x >= x && m.x < x + w && m.y >= y && m.y < y + h;
/** everything the keyboard can reach registers itself while it draws; returns true when focused */
function LOT_nav(key, x, y, w, h, o = {}) { if (!LOT_UI.active || !key) return false; LOT_UI.nav.push(Object.assign({ key, x, y, w, h }, o)); return UI.keyNav && LOT_UI.focus === key; }
/** a button that respects the panel stack and the keyboard focus (the core button, drawn passively when not on top) */
function LOT_btn(g, x, y, w, h, label, fn, o = {}) {
  const focus = LOT_nav('btn:' + (o.key || label), x, y, w, h, { act: o.disabled ? null : fn });
  if (LOT_UI.active) return button(g, x, y, w, h, label, fn, Object.assign({}, o, { focus: focus || o.focus }));
  E.ui.box(g, x, y, w, h, { bg: o.disabled ? '#242030' : o.color || '#3a3058', border: o.active ? '#bff6ff' : '#6a5a88', shadow: false });
  E.font.text(g, label, x + w / 2, y + Math.round((h - 7) / 2), o.disabled ? '#6a6488' : '#e8e0f8', { align: 'center', outline: false, shadow: '#05040a' }); return false;
}
/** a tab on top of a panel area */
function LOT_tabBtn(g, x, y, w, label, on, fn, key) {
  const over = LOT_hot(x, y, w, 12, { click: () => { if (!on) { sfx('select', { vol: .4 }); fn(); } } }), focus = LOT_nav('tab:' + key, x, y, w, 12, { act: fn }), lit = (over && !UI.keyNav) || focus;
  E.ui.box(g, x, y, w, on ? 13 : 12, { bg: on ? ['#3a3058', '#241c3a'] : lit ? '#2a2440' : '#18142a', border: on ? GOLD : lit ? '#c8b8e8' : '#4a3a60', shadow: false });
  E.font.text(g, label, x + w / 2, y + 3, on ? '#fff6d8' : lit ? '#e8e0f8' : '#8a80a8', { align: 'center', font: 'tiny', outline: false });
}
function LOT_begin(P, x, y, w, h) {
  LOT_UI.active = UI.top() === P; if (!LOT_UI.active) return;
  LOT_UI.targets = []; LOT_UI.nav = []; LOT_UI.tip = null; LOT_UI.panelRect = [x, y, w, h];   // (the core keeps the HUD and the panels below display only)
}
/** after a panel draws: the dragged item under the mouse, sparkles and coins, and the tooltip (drawn last, over everything) */
function LOT_end(g) {
  if (!LOT_UI.active) return;
  LOT_UI.navLast = LOT_UI.nav;
  const P = LOT_UI.press, m = UI.mouse;
  if (P && P.moved && P.it) { px.blend(g, .5, 'normal', () => px.ell(g, m.x + 1, m.y + 9, 7, 2, '#05030c')); drawItemIconEx(g, P.it, m.x - 8, m.y - 10, 1); }
  for (const f of LOT_UI.fx) {
    if (f.t < 0) continue;
    if (f.kind === 'coin') { px.ell(g, f.x, f.y + 1, 2.4, 1.6, '#8a6a1a'); px.ell(g, f.x, f.y, 2.4, 1.6, '#ffd23a'); px.dot(g, f.x - 1, f.y - 1, '#fff6c0'); }
    else if (f.kind === 'text') { const a = clamp(Math.min(f.t / .08, (f.max - f.t) / .45), 0, 1); px.blend(g, a, 'normal', () => E.font.text(g, f.s, f.x, f.y, f.c, { align: 'center', font: 'tiny', outline: '#0c0818' })); }
    else { const k = 1 - f.t / f.max, R = Math.round(k * 2.5); px.rect(g, f.x - R, f.y, R * 2 + 1, 1, f.c); px.rect(g, f.x, f.y - R, 1, R * 2 + 1, f.c); px.dot(g, f.x, f.y, '#ffffff'); }
  }
  const T = LOT_UI.tip;
  if (T && T.it && !(P && P.moved)) game.r.overlay(g2 => LOT_drawTip(g2, T.it, m.x, m.y, Object.assign({ anchor: T.anchor }, T.o)));
}
/** the shared per-step work of every loot panel: real-time clock, press release, keyboard, sparkles, dialogue, the doll */
function LOT_update(o = {}) {
  const now = performance.now(); LOT_UI.rdt = clamp((now - (LOT_UI.last || now)) / 1000, 0, .05); LOT_UI.last = now;
  const dt = LOT_UI.rdt, h = ED.hero;
  LOT_release(); LOT_navUpdate(o);
  for (let i = LOT_UI.fx.length - 1; i >= 0; i--) {
    const f = LOT_UI.fx[i]; f.t += dt; if (f.t < 0) continue;
    if (f.kind === 'coin') {
      if (f.t < .22) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt; }
      else { const G0 = LOT_UI.goldAt || [f.x, f.y], k = Math.min(1, dt * 12); f.x = lerp(f.x, G0[0], k); f.y = lerp(f.y, G0[1], k); if (Math.hypot(f.x - G0[0], f.y - G0[1]) < 3) { LOT_UI.fx.splice(i, 1); if (Math.random() < .5) sfx('coin', { vol: .15, pitch: 1.3 + Math.random() * .4 }); continue; } }
    } else if (f.kind === 'text') f.y -= 14 * dt;
    else { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 60 * dt; f.vx *= .95; }
    if (f.t > f.max + (f.kind === 'coin' ? 1 : 0)) LOT_UI.fx.splice(i, 1);
  }
  if (LOT_UI.confirmT > 0 && (LOT_UI.confirmT -= dt) <= 0) LOT_UI.confirm = null;
  if (h) LOT_dollUpdate(h, dt);
  LOT_sayUpdate(dt);
}
/** a burst of sparkles in screen pixels (equips, reforges, reveals) */
function LOT_burst(x, y, c, n = 10) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 20 + Math.random() * 55; LOT_UI.fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 25, t: 0, max: .45 + Math.random() * .4, c }); } }
/** a line that floats up from a spot and fades ('+3 SCRAP  +1 DUST') */
function LOT_float(x, y, s, c = '#e8e0f8') { LOT_UI.fx.push({ kind: 'text', x, y, s, c, t: 0, max: 1.6 }); }
/** coins that pop out of a cell and fly into the gold counter */
function LOT_coins(x, y, n) { const k = Math.min(9, 2 + Math.floor(Math.log10(n + 1) * 2)); for (let i = 0; i < k; i++) LOT_UI.fx.push({ kind: 'coin', x: x + (Math.random() - .5) * 8, y: y + (Math.random() - .5) * 6, vx: (Math.random() - .5) * 70, vy: -50 - Math.random() * 50, t: -i * .035, max: .9 }); }

/* ---------- presses, drags and drops ---------- */
function LOT_pressFn(o) {
  return (mx, my) => { const P = LOT_UI.press; if (!P || P.key !== o.key) LOT_UI.press = Object.assign({ x0: mx, y0: my, moved: false }, o); else if (!P.moved && Math.hypot(mx - P.x0, my - P.y0) > 3) P.moved = true; };
}
function LOT_release() {
  const P = LOT_UI.press; if (!P || UI.mouse.down) return;
  LOT_UI.press = null;
  if (!P.moved) { if (P.click) P.click(); return; }
  const m = UI.mouse, T = LOT_UI.targets.slice().reverse().find(t => LOT_in(m, t.x, t.y, t.w, t.h)) || null;
  if (P.drop) P.drop(T);
}
/** arrows move the focus to the nearest thing that way; Enter uses it, Backspace does its second action */
function LOT_navUpdate(o = {}) {
  const inp = game.input, N = LOT_UI.navLast; if (!N.length) return;
  let cur = N.find(n => n.key === LOT_UI.focus);
  for (const [a, dx, dy] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) {
    if (!inp.repeat('menu' + cap(a)) || (o.noVertical && dy)) continue;
    if (!cur || !UI.keyNav) { UI.keyNav = true; cur = cur || N.find(n => n.it) || N[0]; LOT_UI.focus = cur.key; continue; }
    const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2; let best = null, bd = 1e9;
    for (const n of N) { if (n === cur) continue; const nx = n.x + n.w / 2 - cx, ny = n.y + n.h / 2 - cy, along = nx * dx + ny * dy; if (along <= 2) continue; const d = along + Math.abs(nx * dy - ny * dx) * 2.4; if (d < bd) { bd = d; best = n; } }
    if (best) { LOT_UI.focus = best.key; sfx('select', { vol: .25 }); }
  }
  if (UI.keyNav && cur) { if (inp.pressed('confirm') && cur.act) { inp.consumeAll(); cur.act(); } else if (inp.pressed('cancel') && cur.alt) cur.alt(); }
}
const LOT_fits = (it, slot) => !!it && (it.slot === slot || (it.slot === 'ring' && slot === 'ring2'));
const LOT_worn = (h, it) => SLOTS.find(s => h.gear[s] === it) || null;
const LOT_shopOpen = () => ['vendor', 'smith', 'mystic'].find(id => UI.isOpen(id)) || null;

/* ---------- what items do ---------- */
function LOT_equip(h, it, slot) {
  if (!it) return; slot = slot || LOT_slotFor(h, it); if (!LOT_fits(it, slot)) return;
  equip(h, it, slot); it._new = false;
  const at = UI.top() === UI.panels.inventory && LOT_UI.slotAt[slot]; if (at) LOT_burst(at[0], at[1], RARITY[it.rarity].color, it.rarity >= 3 ? 16 : 9);
  if (it.rarity >= 3) sfx('powerup', { vol: .35, pitch: 1.4 });
}
function LOT_unequip(h, slot, at) {
  const it = h.gear[slot]; if (!it) return;
  if (h.bag.length >= BAG_MAX) { notify('BAG FULL', '#ff8a7a', 1.2); sfx('cancel', { vol: .4 }); return; }
  unequip(h, slot); sfx('pickup', { vol: .35, pitch: .8 });
  if (at !== undefined) LOT_moveBag(h, it, at);
}
function LOT_moveBag(h, it, j) { const i = h.bag.indexOf(it); if (i < 0) return; h.bag.splice(i, 1); h.bag.splice(Math.min(j, h.bag.length), 0, it); sfx('select', { vol: .3 }); }
function LOT_take(h, it) {   // take an item out of the bag or off the hero
  const i = h.bag.indexOf(it); if (i >= 0) { h.bag.splice(i, 1); return true; }
  const s = LOT_worn(h, it); if (!s) return false; delete h.gear[s]; refreshPowers(h); computeStats(h); dressHero(h); return true;
}
/** drop an item at his feet (it will not be picked up again by itself: click its label) */
function LOT_dropGround(h, it) {
  if (!LOT_take(h, it)) return;
  const a = h.facing + (Math.random() - .5) * .8;
  ED.drops.push({ kind: 'item', item: it, x: h.x + Math.cos(a) * 8, y: h.y + Math.sin(a) * 8, z: 10, vx: Math.cos(a) * 45, vy: Math.sin(a) * 45, vz: 90, t: 0, rest: false, bounces: 0, noAuto: true });
  sfx('whoosh', { vol: .4 });
  notify('DROPPED ' + it.name.toUpperCase() + (it.rarity < OPT.labels ? ' (HOLD Z TO SEE IT)' : ''), '#9a90b0', 1.8);
}
/** sell to the open shop: rares and better ask twice */
function LOT_sell(h, it, at, verb = 'sell') {
  if (!it) return false;
  if (it.rarity >= 2 && LOT_UI.confirm !== it.uid) { LOT_UI.confirm = it.uid; LOT_UI.confirmT = 2.5; notify((verb === 'salvage' ? 'SALVAGE ' : 'SELL ') + it.name.toUpperCase() + '? AGAIN TO CONFIRM', '#ffd36a', 2.2); sfx('select', { vol: .5 }); return false; }
  if (!LOT_take(h, it)) return false;
  LOT_UI.confirm = null; h.gold += it.value; LOT_SHOP.buyback.unshift(it); if (LOT_SHOP.buyback.length > 12) LOT_SHOP.buyback.pop();
  if (at) LOT_coins(at[0] + 8, at[1] + 8, it.value);
  sfx('coin', { vol: .5 }); LOT_say(LOT_shopOpen() || 'vendor', verb === 'salvage' ? 'salvage' : 'sell');
  return true;
}
function LOT_sort(h) { h.bag.sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || b.rarity - a.rarity || b.ilvl - a.ilvl || b.value - a.value); sfx('select'); }

/* ---------- item cells (bag, slots, stock), with hover, focus, drag, drop highlights and the tooltip ---------- */
/** o: { key, target, click, alt(it), drop(T), accept(it), cmp, sel, dim, tipO, price, seam (1: the cell also owns the 1 px seam to its right and below) } */
function LOT_itemCell(g, x, y, S, it, o = {}) {
  const P = LOT_UI.press, dragging = !!(P && P.moved && it && P.it === it), HS = S + (o.seam || 0);
  if (LOT_UI.active && o.target) LOT_UI.targets.push(Object.assign({ x, y, w: HS, h: HS }, o.target));
  const over = LOT_hot(x, y, HS, HS, it ? { drag: LOT_pressFn({ key: o.key, it, click: o.click, drop: o.drop }), rclick: o.alt ? () => o.alt(it) : null } : {});
  const focus = LOT_nav(o.key, x, y, S, S, { it, act: it ? o.click : null, alt: it && o.alt ? () => o.alt(it) : null });
  const hov = over && !UI.keyNav, dropping = P && P.moved && hov && P.it !== it, ok = dropping && (!o.accept || o.accept(P.it));
  LOT_cell(g, x, y, S, dragging ? null : it, { hover: hov, focus, sel: o.sel, dim: o.dim, good: dropping && ok, bad: dropping && !ok });
  if (dragging) drawItemIconEx(g, it, x + Math.floor((S - 16) / 2), y + Math.floor((S - 16) / 2), 1, { alpha: .25, anim: false });
  if (!it) return hov;
  if (it._new && (hov || focus)) it._new = false;
  if (it._new) { const k = Math.floor(performance.now() / 250) % 2; px.rect(g, x + S - 4, y + 2, 2, 2, k ? '#fff6c0' : GOLD); }
  if (o.cmp && ED.hero && !dragging) { const up = LOT_compare(ED.hero, it).up; if (up > 0) { px.rect(g, x + 2, y + S - 4, 3, 1, '#4ae04a'); px.dot(g, x + 3, y + S - 5, '#8aff8a'); } else if (up < 0) { px.rect(g, x + 2, y + S - 5, 3, 1, '#e04a4a'); px.dot(g, x + 3, y + S - 4, '#ff7a6a'); } }
  if ((hov || focus) && !(P && P.moved)) LOT_UI.tip = { it, anchor: [x, y, S, S], o: typeof o.tipO === 'function' ? o.tipO(it) : o.tipO || {} };
  return hov;
}
/** a paper-doll slot: the rarity frame, or a dark silhouette of what goes there */
function LOT_slotCell(g, x, y, S, slot, h, o = {}) {
  const it = h.gear[slot]; LOT_UI.slotAt[slot] = [x + S / 2, y + S / 2];
  const hov = LOT_itemCell(g, x, y, S, it, Object.assign({ key: 'slot:' + slot, target: { kind: 'slot', slot }, accept: q => LOT_fits(q, slot) || (LOT_worn(h, q) && LOT_fits(q, slot)),
    click: () => LOT_unequip(h, slot), alt: q => LOT_itemAlt(h, q, [x, y]), drop: T => LOT_dropWorn(h, slot, T), tipO: { equipped: true, hint: LOT_hints(h, 'worn') } }, o));
  if (!it) {
    drawItemIconEx(g, LOT_ghost(slot), x + Math.floor((S - 16) / 2), y + Math.floor((S - 16) / 2), 1, { alpha: .7, anim: false });
    if (hov && !(LOT_UI.press && LOT_UI.press.moved)) LOT_hot(x, y, S, S, { tip: [{ t: SLOT_NAMES[slot], c: GOLD }, { t: 'Empty. Click an item in the bag, or drag one here.', c: '#c8c0d8' }] });
  }
}
/** the bag: cols x rows cells of S pixels. mode: { kind: 'inv' | 'vendor' | 'smith' | 'mystic', sel, select(it) } */
function LOT_bagGrid(g, x, y, cols, rows, S, h, mode) {
  if (LOT_UI.active) LOT_UI.targets.push({ x, y, w: cols * S, h: rows * S, kind: 'bag', i: h.bag.length });   // anywhere on the grid: the end of the bag
  for (let i = 0; i < cols * rows; i++) {
    const it = h.bag[i], cx = x + (i % cols) * S, cy = y + Math.floor(i / cols) * S;
    LOT_itemCell(g, cx, cy, S - 1, it, { key: 'bag:' + i, target: { kind: 'bag', i }, cmp: true, sel: mode.sel && mode.sel === it, seam: 1,
      click: () => mode.select ? mode.select(it) : LOT_equip(h, it), alt: q => LOT_itemAlt(h, q, [cx, cy], mode), drop: T => LOT_dropBag(h, it, T, mode), tipO: { hint: LOT_hints(h, mode.kind) } });
  }
}
/** the second action on an item: sell (a shop is open), salvage (the smith), or drop it on the ground */
function LOT_itemAlt(h, it, at, mode = {}) {
  const shop = LOT_shopOpen();
  if (mode.kind === 'stash') return LOT_equip(h, it);   // at the stash a right-click wears it (a click stores it)
  if (mode.kind === 'smith' || shop === 'smith') return LOT_salvage(h, it, at);
  if (shop) return LOT_sell(h, it, at);
  if (UI.isOpen('stash')) return LOT_toStash(h, it);   // the bag opened over the stash: a right-click stores it
  LOT_dropGround(h, it);
}
function LOT_dropBag(h, it, T, mode) {
  if (!T) { const [px0, py0, pw, ph] = LOT_UI.panelRect, m = UI.mouse; if (mode.kind === 'inv' && !LOT_in(m, px0, py0, pw, ph)) { if (LOT_shopOpen()) LOT_sell(h, it, null); else LOT_dropGround(h, it); } return; }
  if (T.kind === 'bag') LOT_moveBag(h, it, T.i);
  else if (T.kind === 'slot') { if (LOT_fits(it, T.slot)) LOT_equip(h, it, T.slot); else { notify('THAT GOES IN THE ' + SLOT_NAMES[it.slot].toUpperCase() + ' SLOT', '#ff9a7a', 1.2); sfx('cancel', { vol: .4 }); } }
  else if (T.kind === 'sell') { if (mode.kind === 'smith') LOT_salvage(h, it, [T.x + T.w / 2, T.y + 10]); else LOT_sell(h, it, [T.x + T.w / 2, T.y + 10]); }
  else if (T.kind === 'anvil' && mode.select) mode.select(it);
  else if (T.kind === 'stash') LOT_toStash(h, it, T.tab, T.i);
  else if (T.kind === 'stashTab') LOT_toStash(h, it, T.tab);
}
function LOT_dropWorn(h, slot, T) {
  const it = h.gear[slot]; if (!it) return;
  if (!T) { const [px0, py0, pw, ph] = LOT_UI.panelRect; if (!LOT_in(UI.mouse, px0, py0, pw, ph)) LOT_dropGround(h, it); return; }
  if (T.kind === 'bag') LOT_unequip(h, slot, T.i);
  else if (T.kind === 'slot' && T.slot !== slot && LOT_fits(it, T.slot)) { const o2 = h.gear[T.slot]; h.gear[T.slot] = it; if (o2) h.gear[slot] = o2; else delete h.gear[slot]; refreshPowers(h); computeStats(h); dressHero(h); sfx('pickup', { vol: .4 }); }
  else if (T.kind === 'sell') LOT_sell(h, it, [T.x + T.w / 2, T.y + 10]);
  else if (T.kind === 'anvil' && LOT_SMITH.select) LOT_SMITH.select(it);
}
function LOT_hints(h, kind) {
  const shop = LOT_shopOpen(), c = '#8a80a8';
  if (kind === 'worn') return [{ t: 'CLICK: TAKE OFF  •  DRAG: MOVE', c }, { t: shop ? 'RIGHT-CLICK: SELL' : 'RIGHT-CLICK: DROP', c }];
  if (kind === 'smith') return [{ t: 'CLICK: PUT ON THE ANVIL  •  RIGHT-CLICK: SALVAGE', c }];
  if (kind === 'mystic') return [{ t: 'CLICK: PLACE ON THE ALTAR', c }];
  if (kind === 'stash') return [{ t: 'CLICK: INTO THE STASH  •  DRAG: PLACE', c }, { t: 'RIGHT-CLICK: EQUIP', c }];
  if (kind === 'stashed') return [{ t: 'CLICK: INTO THE BAG  •  DRAG: PLACE', c }, { t: 'RIGHT-CLICK: WEAR IT (WHAT IT REPLACES IS STORED)', c }];
  return [{ t: 'CLICK: EQUIP  •  DRAG: MOVE', c }, { t: shop ? 'RIGHT-CLICK: SELL' : 'RIGHT-CLICK: DROP ON THE GROUND', c }];
}
/** gold with a coin, and where flying coins go */
function LOT_gold(g, x, y, h, align = 'left') {
  const s = fmt(h.gold), w = E.font.width(s) + 9, x0 = align === 'right' ? x - w : x;
  LOT_coin(g, x0, y); E.font.text(g, s, x0 + 8, y, GOLD, { outline: false, shadow: '#05040a' }); LOT_UI.goldAt = [x0 + 3, y + 3];
  LOT_hot(x0, y - 1, w, 9, { tip: [{ t: fmt(h.gold) + ' gold', c: GOLD }, { t: 'Sell to Cobb, salvage at Harrow\'s, or pick it up in the deep.', c: '#c8c0d8' }] });
}

/* =============================================================================
 * THE PAPER DOLL: the hero's own look on a private rig, turning slowly on a rune circle
 * ============================================================================= */
const LOT_JOINT = { helm: 'head', amulet: 'shC', chest: 'shC', cloak: 'shC', gloves: 'handR', legs: 'kneeR', boots: 'footR', ring: 'handL', ring2: 'handL', weapon: 'tip' };
function LOT_dollRig(h) {
  const D = LOT_UI.doll || (LOT_UI.doll = { rig: null, sig: '', face: Math.PI / 2 + .5, t: 0, anim: null, spin: 0, user: 0, parts: [], ox: 0, oy: 0 });
  const sig = SLOTS.map(s => h.gear[s] ? h.gear[s].uid : 0).join(',');
  if (D.sig !== sig || D.character !== h.character) {
    const lk = heroLook(h), was = D.sig ? D.sig.split(',') : null, now = sig.split(',');
    D.rig = charRig(h, lk);
    D.character = h.character;
    D.rig.update(0, { x: 0, y: 0, z: 0, facing: D.face });
    const w = h.gear.weapon; D.smear = (w && w.look && w.look.smear) || EL(lk.el).smear;
    if (was) { const i = SLOTS.findIndex((s, k) => was[k] !== now[k]); if (i >= 0) LOT_dollReact(D, SLOTS[i], h.gear[SLOTS[i]]); }
    D.sig = sig;
  }
  return D;
}
/** gear changed: the figure shows it off (a flourish with a new weapon, a cheer for a helm, a twirl for a cloak...) */
function LOT_dollReact(D, slot, it) {
  if (!it) { D.anim = { pose: null, expr: 'wince', t: .5 }; return; }
  if (slot === 'weapon') { const staff = it.look && it.look.weapon === 'staff', a = new E.Attack(staff ? 'cast' : 'spin'); a.start(); D.anim = { atk: a, t: 1.2, expr: 'shout' }; sfx(staff ? 'charge' : 'swing', { vol: .4 }); }
  else if (slot === 'cloak') { D.spin = TAU; D.anim = { t: .7, expr: 'smile' }; sfx('whoosh', { vol: .35 }); }
  else if (slot === 'boots') { D.anim = { hop: 0, t: .5, expr: 'smile' }; D.rig.kick(-5); }
  else if (['helm', 'amulet', 'ring', 'ring2'].includes(slot)) D.anim = { pose: 'cheer', t: 1, expr: 'smile' };
  else D.anim = { pose: 'hips', t: 1.3, expr: 'smile' };
  if (UI.top() === UI.panels.inventory) D.burst = { slot, c: RARITY[it.rarity].color, n: it.rarity >= 3 ? 18 : 10 };
}
function LOT_dollUpdate(h, dt) {
  const D = LOT_dollRig(h), A = D.anim; D.t += dt;
  if (D.user > 0) D.user -= dt; else D.face = E.approachAng(D.face, Math.PI / 2 + Math.sin(D.t * .42) * 1.05, dt * 1.2);
  let turn = 0; if (D.spin > 0) { D.spin = Math.max(0, D.spin - dt * TAU / .6); turn = D.spin; }
  const st = { x: 0, y: 0, z: 0, vx: 0, vy: 0, facing: D.face + turn, pose: null, expr: null };
  if (A) {
    A.t -= dt;
    if (A.atk) { A.atk.update(dt); st.attack = A.atk.state; }
    if (A.pose) st.pose = A.pose; if (A.expr) st.expr = A.expr;
    if (A.hop !== undefined) { A.hop += dt; const u = clamp(A.hop / .45, 0, 1); st.z = Math.sin(u * Math.PI) * 5; st.air = u < .9; }
    if (A.t <= 0 && !(A.atk && A.atk.busy)) D.anim = null;
  }
  D.rig.update(dt, st);
  if (!st.attack && !turn) settleCape(D.rig, dt, .35);
  for (let i = D.parts.length - 1; i >= 0; i--) { const p = D.parts[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 10 * dt; if (p.t > p.max) D.parts.splice(i, 1); }
  if (Math.random() < dt * 3) D.parts.push({ x: (Math.random() - .5) * 40, y: -Math.random() * 20, vx: (Math.random() - .5) * 3, vy: -6 - Math.random() * 6, t: 0, max: 2 + Math.random() * 2, c: '#8a7ab8', mote: true });
}
/** an offscreen canvas pair (art + outline), kept per use and resized when needed */
function LOT_canvas(key, w, h) {
  let c = LOT_UI.cv[key];
  if (!c || c.w !== w || c.h !== h) { const cv = E.mkCanvas(w, h), out = E.mkCanvas(w, h); c = LOT_UI.cv[key] = { w, h, cv, g: E.ctx2d(cv), out, og: E.ctx2d(out) }; }
  return c;
}
function LOT_dollDraw(g, x, y, w, h, hero) {
  const D = LOT_dollRig(hero), rig = D.rig, sc = clamp((h - 18) / (characterOf(hero).dollHeight || 31), 1.2, 3.3), V = LOT_UI.dollView || (LOT_UI.dollView = new E.View('portrait', 'Doll', 0, 16, 2, 1));
  V.set(0, 16, sc, 1);
  // the alcove: a dark niche, a shaft of light, a rune circle on the floor
  E.ui.box(g, x, y, w, h, { bg: ['#1c1634', '#07050c'], border: '#3a3050', shadow: false });
  const cx = x + Math.round(w / 2), fy = y + h - 12, t = performance.now() / 1000;
  px.blend(g, .1, 'add', () => { px.poly(g, [[cx - w * .18, y + 2], [cx + w * .18, y + 2], [cx + w * .36, fy], [cx - w * .36, fy]], '#8a7ab8'); px.poly(g, [[cx - w * .08, y + 2], [cx + w * .08, y + 2], [cx + w * .2, fy], [cx - w * .2, fy]], '#b8a8e8'); });
  px.ell(g, cx, fy, w * .44, 5.5, '#120e20'); px.ell(g, cx, fy - 1, w * .42, 4.5, '#1a1430');
  for (let i = 0; i < 28; i++) { const a = i / 28 * TAU + t * .35, xx = cx + Math.cos(a) * w * .38, yy = fy + Math.sin(a) * 3.9; px.dot(g, xx, yy, i % 4 === 0 ? '#6fd6cc' : i % 2 ? '#2f8f86' : '#1f5f5a'); }
  px.blend(g, .22 + .08 * Math.sin(t * 1.7), 'add', () => px.ell(g, cx, fy, w * .26, 3, '#4fe0cc'));
  px.blend(g, .55, 'normal', () => px.ell(g, cx, fy, 9 * sc / 2.6, 2.4, '#05040a'));
  for (const p of D.parts) if (p.mote) { const a = Math.min(1, p.t, p.max - p.t); if (a > 0) px.blend(g, .5 * a, 'add', () => px.dot(g, cx + p.x, fy - 20 + p.y, p.c)); }
  // the figure, drawn into its own canvas so it gets the in-game outline
  const C = LOT_canvas('doll', w, h), ox = Math.round(w / 2), oy = h - 12;
  C.g.clearRect(0, 0, w, h); rig.draw(C.g, ox, oy, V);
  C.og.clearRect(0, 0, w, h); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) C.og.drawImage(C.cv, dx, dy);
  C.og.globalCompositeOperation = 'source-in'; C.og.fillStyle = '#0c0818'; C.og.fillRect(0, 0, w, h); C.og.globalCompositeOperation = 'source-over'; C.og.drawImage(C.cv, 0, 0);
  g.drawImage(C.out, x, y);
  // the swing ribbon of a flourish, along the rig's real blade path
  const T = rig.trail, P0 = q => { const s = V.p(q[0], q[1], q[2]); return [x + ox + s[0], y + oy + s[1]]; }, sm = D.smear || LOT_STRESS_SMEAR;
  for (let i = 0; i < T.length - 1; i++) { const a = T[i], b = T[i + 1], f = 1 - b.age / .14, u = (i + 1) / T.length; px.polyDither(g, [P0(a.b), P0(a.t), P0(b.t), P0(b.b)], sm[u > .85 ? 1 : u > .5 ? 2 : 3], (.3 + .6 * u) * clamp(f, 0, 1)); }
  // a gear change: sparkles where the piece sits on the body
  if (D.burst) { const b = D.burst, j = LOT_JOINT[b.slot], w0 = j === 'tip' ? (() => { const q = rig.tip(); return [q[0] - rig.x, q[1] - rig.y, q[2] - rig.z]; })() : rig._w(rig.J[j] || rig.J.shC), s = V.p(w0[0], w0[1], w0[2]); LOT_burst(x + ox + s[0], y + oy + s[1], b.c, b.n); D.burst = null; }
  // drag to turn him around
  const over = LOT_hot(x, y, w, h, { drag: mx => { if (D.dragX !== undefined && UI.mouse.down) D.face -= (mx - D.dragX) * .045; D.dragX = mx; D.user = 3; }, tip: [{ t: 'Drag to turn', c: '#c8c0d8' }] });
  if (!UI.mouse.down) D.dragX = undefined;
  E.font.text(g, 'LEVEL ' + hero.level, cx, y + 4, over ? '#fff6d8' : GOLD, { align: 'center', font: 'tiny', outline: '#0c0818' });
}
/** under the doll: level and experience, life, damage, armor, resistances, speeds */
function LOT_readout(g, x, y, w, h) {
  const need = SCALE.xpNeed(h.level), tiny = { font: 'tiny', outline: false }, pw = LOT_power(h);
  E.font.text(g, 'XP', x, y, '#b88aff', tiny);
  const bx = x + 12, bw = w - 12; px.rect(g, bx, y, bw, 5, '#0c0818'); px.rect(g, bx + 1, y + 1, Math.round((bw - 2) * clamp(h.xp / need, 0, 1)), 3, '#b88aff'); px.rect(g, bx + 1, y + 1, Math.round((bw - 2) * clamp(h.xp / need, 0, 1)), 1, '#e0c8ff');
  LOT_hot(bx, y - 1, bw, 7, { tip: [{ t: 'Level ' + h.level, c: GOLD }, { t: fmt(h.xp) + ' / ' + fmt(need) + ' experience', c: '#c8b0ff' }] });
  const y2 = y + 9, third = Math.floor(w / 3);
  // life (a heart), damage (a sword), armor (a shield)
  E.font.text(g, '♥', x, y2 - 1, '#ff5a6a', { outline: false }); E.font.text(g, fmt(h.maxHp), x + 8, y2, '#ffb0b0', tiny);
  const sx = x + third; px.line(g, sx, y2 + 5, sx + 5, y2, '#dce8f1'); px.line(g, sx, y2 + 3, sx + 2, y2 + 5, '#e8b04e'); E.font.text(g, fmt(pw), sx + 8, y2, '#fff2c4', tiny);
  const ax = x + third * 2; px.poly(g, [[ax, y2], [ax + 5, y2], [ax + 5, y2 + 3], [ax + 2.5, y2 + 5.5], [ax, y2 + 3]], '#8a94a8'); px.rect(g, ax + 1, y2 + 1, 2, 2, '#c8d0e0'); E.font.text(g, fmt(h.armor), ax + 8, y2, '#c8d0e0', tiny);
  LOT_hot(x, y2 - 1, third - 2, 8, { tip: [{ t: 'Life ' + fmt(Math.ceil(h.hp)) + ' / ' + fmt(h.maxHp), c: '#ff8a8a' }, { t: (h.stats.lifeRegen || 0).toFixed(1) + ' per second', c: '#c8c0d8' }] });
  LOT_hot(sx, y2 - 1, third - 2, 8, { tip: [{ t: 'Damage ' + pw.toFixed(1), c: '#fff2c4' }, { t: 'An average swing of your weapon with every increase, attack speed and critical strikes folded in.', c: '#c8c0d8' }] });
  LOT_hot(ax, y2 - 1, third - 2, 8, { tip: [{ t: 'Armor ' + Math.round(h.armor), c: '#c8d0e0' }, { t: 'Armor soaks physical hits; big hits get through more.', c: '#c8c0d8' }] });
  // resistances: five chips in their element colors
  const y3 = y2 + 10, cw = Math.floor(w / 5);
  ['fire', 'frost', 'storm', 'void', 'venom'].forEach((el, i) => {
    const e = EL(el), v = Math.round(h.res[el] * 100), cx0 = x + i * cw;
    px.rect(g, cx0, y3, 5, 5, e.dark); px.rect(g, cx0, y3, 5, 1, e.light); px.rect(g, cx0 + 1, y3 + 1, 3, 3, e.color);
    E.font.text(g, String(v), cx0 + 7, y3, v >= 75 ? '#ffffff' : v > 0 ? e.light : '#6a6488', tiny);
    LOT_hot(cx0, y3 - 1, cw - 1, 7, { tip: [{ t: e.name + ' resistance ' + v + '%', c: e.light }, { t: 'Capped at 75%.', c: '#c8c0d8' }] });
  });
  const y4 = y3 + 9, sp = v => (v >= 0 ? '+' : '') + Math.round(v) + '%';
  E.font.text(g, 'CRIT ' + (h.critChance * 100).toFixed(0) + '%', x, y4, '#ffd23a', tiny);
  E.font.text(g, 'ATK ' + sp((h.atkMul / DIFF.heroSpeed - 1) * 100), x + third, y4, '#e8e0f8', tiny);
  E.font.text(g, 'RUN ' + sp((h.speedMul / DIFF.heroSpeed - 1) * 100), x + third * 2, y4, '#8fe3ff', tiny);
}

/* ---------- the character sheet: every number, grouped, scrollable ---------- */
function LOT_statRows(h) {
  const s = h.stats, rows = [], add = (t, v, vc = '#ffffff', tc = '#c8c0d8') => rows.push({ t, v: String(v), vc, tc }), head = t => rows.push({ head: t });
  const w = h.gear.weapon, el = (w && w.el) || 'phys', staff = !!(w && w.look && w.look.weapon === 'staff'), hit = heroHit(h, 1, { el, tags: staff ? ['spell'] : ['melee', 'attack'] }).amount;
  const sgn = v => (v >= 0 ? '+' : '') + Math.round(v) + '%';
  head('OFFENSE');
  add('Weapon', w ? (w.dmg ? fmt(w.dmg[0]) + '-' + fmt(w.dmg[1]) : '-') + ' ' + EL(el).name : 'bare hands', EL(el).light);
  add(staff ? 'Spell hit' : 'Weapon hit', Math.round(hit * .88) + '-' + Math.round(hit * 1.12));
  add('Damage rating', LOT_power(h).toFixed(1), '#fff2c4');
  add('Critical strike chance', (h.critChance * 100).toFixed(1) + '%', '#ffd23a'); add('Critical strike damage', 'x' + h.critMul.toFixed(2), '#ffd23a');
  add('Attack speed', sgn((h.atkMul / DIFF.heroSpeed - 1) * 100)); add('Cast speed', sgn((h.castMul / DIFF.heroSpeed - 1) * 100));   // (the gear's share; the speed slider is shown apart)
  add('Status chance', sgn((h.statusMul - 1) * 100)); add('Area of effect', sgn(s.area || 0));
  if (s.projectiles) add('Extra projectiles', '+' + Math.round(s.projectiles)); if (s.cdr) add('Cooldown reduction', Math.round(s.cdr) + '%');
  head('DEFENSE');
  add('Life', fmt(Math.ceil(h.hp)) + ' / ' + fmt(h.maxHp), '#ffb0b0'); add('Life per second', (s.lifeRegen || 0).toFixed(1), '#ffb0b0');
  const ref = 10 * SCALE.foeDmg(Math.max(1, h.maxDepth || 1)), red = clamp(h.armor / (h.armor + 5 * ref + 30), 0, .75);
  add('Armor', Math.round(h.armor) + ' (-' + Math.round(red * 100) + '%)', '#c8d0e0');
  for (const e of ['fire', 'frost', 'storm', 'void', 'venom']) add(EL(e).name + ' resistance', Math.round(h.res[e] * 100) + '%', EL(e).light);
  add('Chance to evade', Math.min(60, Math.round(s.dodge || 0)) + '%'); add('Dodge charges', h.maxDodge); add('Potions', h.maxPotions + (s.potionHeal ? '  (' + sgn(s.potionHeal) + ' healing)' : ''));
  if (s.thorns) add('Thorns', Math.round(s.thorns));
  head('UTILITY');
  add('Movement speed', sgn((h.speedMul / DIFF.heroSpeed - 1) * 100), '#8fe3ff'); add('Ember', Math.floor(h.ember) + ' / ' + h.maxEmber + '  (' + (s.emberRegen || 0).toFixed(1) + '/s)', '#ffb070');
  add('Gold found', sgn(s.goldFind || 0), GOLD); add('Item rarity', sgn(s.magicFind || 0), '#8ab4ff'); add('Experience', sgn(s.xpGain || 0), '#c8b0ff'); add('Pickup radius', sgn(s.pickup || 0));
  head('EVERY BONUS');
  const keys = Object.keys(STATS).concat(Object.keys(s).filter(k => !STATS[k]));
  for (const k of keys) if (s[k]) rows.push({ t: statText(k, Math.round(s[k] * 10) / 10), line: true, tc: '#8ab4ff' });
  if (h.powers.length) { head('LEGENDARY POWERS'); for (const id of h.powers) { const p = powerSpec(id); if (!p) continue; rows.push({ t: p.name, line: true, tc: '#ffb070' }); rows.push({ t: p.desc, line: true, tc: '#ff9a4a', wrap: true }); } }
  return rows;
}
function LOT_drawStats(g, x, y, w, h, hero) {
  const rows = LOT_statRows(hero), lines = [];
  for (const r of rows) { if (r.head) { lines.push({ head: r.head }); continue; } if (r.line) { for (const t of r.wrap ? E.font.wrap(r.t, w - 16) : [r.t]) lines.push({ t, tc: r.tc, indent: r.wrap ? 6 : 0 }); continue; } lines.push(r); }
  const total = lines.reduce((a, l) => a + (l.head ? 13 : 9), 0);
  LOT_UI.maxScroll = Math.max(0, total - h + 4); LOT_UI.scroll = clamp(LOT_UI.scroll, 0, LOT_UI.maxScroll);
  E.ui.box(g, x, y, w, h, { bg: ['#120e20', '#0a0812'], border: '#3a3050', shadow: false });
  let yy = y + 3 - LOT_UI.scroll;
  for (const l of lines) {
    const lh = l.head ? 13 : 9;
    if (yy >= y + 1 && yy + lh <= y + h - 1) {
      if (l.head) { E.font.text(g, l.head, x + 5, yy + 3, GOLD, { font: 'tiny', outline: false }); px.rect(g, x + 5 + E.font.width(l.head, { font: 'tiny' }) + 4, yy + 5, w - E.font.width(l.head, { font: 'tiny' }) - 20, 1, '#3a3050'); }
      else if (l.v !== undefined) { E.font.text(g, l.t, x + 5, yy, l.tc || '#c8c0d8', { outline: false }); E.font.text(g, l.v, x + w - 10, yy, l.vc || '#ffffff', { align: 'right', outline: false, shadow: '#05040a' }); }
      else E.font.text(g, l.t, x + 5 + (l.indent || 0), yy, l.tc, { outline: false });
    }
    yy += lh;
  }
  if (LOT_UI.maxScroll > 0) { const th = Math.max(10, Math.round(h * h / total)), ty = y + 1 + Math.round((h - 2 - th) * LOT_UI.scroll / LOT_UI.maxScroll); px.rect(g, x + w - 4, y + 1, 3, h - 2, '#141020'); px.rect(g, x + w - 4, ty, 3, th, '#6a5a88'); }
  LOT_hot(x, y, w, h, {});
}

/* =============================================================================
 * THE INVENTORY PANEL
 * ============================================================================= */
const LOT_LEFT = ['helm', 'chest', 'gloves', 'legs', 'boots'], LOT_RIGHT = ['amulet', 'cloak', 'weapon', 'ring', 'ring2'];
LOT_PANELS.inventory = { title: 'INVENTORY', w: W => Math.min(W - 8, 500), h: (W, H) => Math.min(H - 8, 272),
  open() { LOT_UI.focus = null; LOT_UI.scroll = 0; LOT_UI.press = null; },
  close() { LOT_UI.press = null; LOT_UI.confirm = null; },
  update() {
    LOT_update({ noVertical: LOT_UI.tab === 'stats' && UI.keyNav && (LOT_UI.focus || '').startsWith('tab:') });
    const inp = game.input;
    if (inp.pressed('map')) { LOT_UI.tab = LOT_UI.tab === 'bag' ? 'stats' : 'bag'; sfx('select', { vol: .4 }); }
    if (LOT_UI.tab === 'stats' && UI.keyNav && (LOT_UI.focus || '').startsWith('tab:')) { if (inp.repeat('menuDown')) LOT_UI.scroll = Math.min(LOT_UI.maxScroll, LOT_UI.scroll + 9); if (inp.repeat('menuUp')) LOT_UI.scroll = Math.max(0, LOT_UI.scroll - 9); }
  },
  wheel(d) { if (LOT_UI.tab === 'stats') LOT_UI.scroll = clamp(LOT_UI.scroll + d * 18, 0, LOT_UI.maxScroll); },
  draw(g, x, y, w, hh) {
    const h = ED.hero; if (!h) return;
    LOT_begin(this, x, y, w, hh);
    const top = y + 19, pad = 7, big = hh >= 226, SS = hh >= 256 ? 25 : big ? 22 : 20, gap = big ? 3 : 2, colH = 5 * SS + 4 * gap, dw = clamp(Math.round(w * .19), 64, 96);
    const lx = x + pad, dx = lx + SS + 4, rx0 = dx + dw + 4;
    LOT_dollDraw(g, dx, top, dw, colH, h);
    LOT_LEFT.forEach((s, i) => LOT_slotCell(g, lx, top + i * (SS + gap), SS, s, h));
    LOT_RIGHT.forEach((s, i) => LOT_slotCell(g, rx0, top + i * (SS + gap), SS, s, h));
    LOT_readout(g, lx, top + colH + 5, rx0 + SS - lx, h);
    // the right column: tabs, then the bag (or the character sheet)
    const cx0 = rx0 + SS + 9, cw = x + w - pad - cx0;
    LOT_tabBtn(g, cx0, top, 38, 'BAG', LOT_UI.tab === 'bag', () => { LOT_UI.tab = 'bag'; }, 'bag');
    LOT_tabBtn(g, cx0 + 40, top, 62, 'CHARACTER', LOT_UI.tab === 'stats', () => { LOT_UI.tab = 'stats'; }, 'stats');
    E.font.text(g, 'TAB', cx0 + 106, top + 3, '#4a4468', { font: 'tiny', outline: false });
    const gy = top + 15, foot = y + hh - 11;
    if (LOT_UI.tab === 'bag') {
      const cols = 10, rows = 4, CS = clamp(Math.floor(cw / cols), 16, 26), gx = cx0 + Math.floor((cw - CS * cols) / 2);
      LOT_bagGrid(g, gx, gy, cols, rows, CS, h, { kind: 'inv' });
      const by = gy + rows * CS + 4;
      LOT_gold(g, gx, by + 2, h);
      E.font.text(g, h.bag.length + ' / ' + BAG_MAX, gx + cols * CS - 44, by + 2, h.bag.length >= BAG_MAX ? '#ff8a7a' : '#9a90b0', { align: 'right', outline: false });
      LOT_btn(g, gx + cols * CS - 38, by, 38, 12, 'SORT', () => LOT_sort(h), { key: 'sort' });
      // the powers he wears
      let py = by + 17;
      if (!h.powers.length && py < foot - 8) { E.font.text(g, 'NO LEGENDARY POWERS YET', gx, py, '#6a6488', { font: 'tiny', outline: false }); E.font.text(g, 'Orange and gold items carry them: each one changes how you fight.', gx, py + 9, '#4a4468', { outline: false, wrap: cols * CS }); }
      if (h.powers.length && py < foot - 8) {
        E.font.text(g, 'LEGENDARY POWERS', gx, py, '#9a90b0', { font: 'tiny', outline: false }); py += 8;
        let px0 = gx;
        for (const id of h.powers) {
          const p = powerSpec(id); if (!p) continue; const tw = E.font.width(p.name) + 10;
          if (px0 + tw > gx + cols * CS) { px0 = gx; py += 10; } if (py > foot - 9) break;
          const over = LOT_hot(px0, py - 1, tw, 10, { tip: [{ t: p.name, c: '#ffb070' }, { t: p.desc, c: '#ff9a4a' }] });
          px.rect(g, px0, py + 2, 3, 3, '#ff8a2a'); px.dot(g, px0 + 1, py + 2, '#fff0a0');
          E.font.text(g, p.name, px0 + 6, py, over ? '#fff0c8' : '#ffb070', { outline: false, shadow: '#05040a' }); px0 += tw + 4;
        }
      }
    } else LOT_drawStats(g, cx0, gy, cw, foot - gy - 2, h);
    const shop = LOT_shopOpen();
    E.font.text(g, shop ? 'RIGHT-CLICK OR DRAG OUT TO SELL TO ' + LOT_npcName(shop) : 'CLICK EQUIP  •  DRAG MOVE  •  RIGHT-CLICK DROP  •  I CLOSES', x + w / 2, foot + 2, '#5a5478', { align: 'center', font: 'tiny', outline: false });
    LOT_end(g);
  } };

/* =============================================================================
 * THE SHOPKEEPERS: portraits that talk, lines of dialogue, and prices
 * ============================================================================= */
const LOT_NPC = {
  vendor: { name: 'COBB', title: 'Merchant', bg: '#2a2014', border: '#c8a060',
    rig: { build: 'bulky', weapon: null, outfit: 'coat', sleeves: 'long', hat: { style: 'cap', color: '#6a4a2a' }, colors: { skin: '#e8b890', hair: '#8a8078', cloth: '#b89a5a', coat: '#6a3a2a', pants: '#3a3028', boot: '#4a3020', belt: '#c8a040', trim: '#e8c860' } } },
  smith: { name: 'HARROW', title: 'Blacksmith', bg: '#2a1810', border: '#ff9a4a',
    rig: { build: 'bulky', weapon: null, outfit: 'tunic', sleeves: 'none', hair: 'short', colors: { skin: '#c88a64', hair: '#2a1a14', cloth: '#5a3a2a', pants: '#2a2428', boot: '#2a1c14', belt: '#8a6a3a', trim: '#3a2418' } } },
  mystic: { name: 'SEREN', title: 'Mystic', bg: '#1c1430', border: '#b070ff',
    rig: { build: 'heroic', weapon: null, outfit: 'robe', sleeves: 'long', hair: 'long', face: { eyes: 'big' }, colors: { skin: '#f0d0c0', hair: '#e8e0f8', cloth: '#4a2a7a', pants: '#2a1a4a', boot: '#2a1a3a', belt: '#c890ff', trim: '#e8c8ff', iris: '#8a4ae0' } } }
};
const LOT_LINES = {
  vendor: {
    greet: ['Coin for goods, goods for coin. Simple as that.', 'Fresh from the deep, most of it. Best not to ask.', 'Everything here has been down there and back.', 'Buying, selling, and the odd mystery parcel.'],
    buy: ['A fine choice. Mostly.', 'Sold! No refunds, no questions.', 'It suits you. It suited the last owner too.'],
    sell: ['I\'ll find a buyer. Eventually.', 'Hm. It\'s worth something to someone.', 'Into the pile it goes.'],
    buyback: ['Changed your mind? Happens to the best.'],
    gamble: ['Wrapped in cloth, sealed in wax. Could be anything.', 'Let\'s see what the dark gives you.', 'No peeking before you pay.'],
    lucky: ['Now THAT is a find. Don\'t tell the others.', 'The deep favors you today!'],
    poor: ['Your purse says no, friend.', 'Come back with more coin.'], full: ['Your pack is full. Make some room first.'] },
  smith: {
    greet: ['Bring it to the anvil. I\'ll make it sing.', 'Steel remembers the forge. So do I.', 'Every blade can be better. Most of them need it.'],
    reforge: ['Melted, hammered, reborn.', 'There. Same bones, new temper.', 'Didn\'t like the old one anyway.'],
    temper: ['Hotter fire, harder edge.', 'Now it can keep up with you.'],
    salvage: ['Broken down. The good bits are yours.', 'Melted, sorted, stacked. Scrap for the forge, dust for Seren.', 'Nothing wasted in this forge.'],
    essence: ['Its power came out whole. Seren can bind it to something else.', 'Hear that hum? That\'s the power it held, bottled.'],
    unique: ['That one isn\'t mine to change. Old magic in it.'], max: ['Can\'t make it any better than you are.'],
    poor: ['Coal isn\'t free, friend.'], pick: ['Put something on the anvil first.'],
    mats: ['Not enough scrap and dust. Salvage what you don\'t need.', 'I forge with scrap, friend. Bring me something to break.'] },
  mystic: {
    greet: ['The deep whispers in every thread. I can change what it says.', 'Show me what you carry.', 'Sit. The weave is listening.'],
    enchant: ['Choose. The weave will not wait.', 'Three threads. Pull one.'], chosen: ['It is woven.', 'So it shall be.'],
    transmute: ['Rise. Become more than you were.', 'It remembers what it could have been.'],
    respec: ['Forget, and learn again.', 'Your path unravels. Walk it anew.'], confirm: ['Are you certain? Ask again.'],
    unique: ['That one is already whole. I cannot touch it.'], poor: ['The weave asks for gold, not promises.'], pick: ['Place something on the altar.'],
    mats: ['The weave needs rune dust. Harrow breaks spare things into it.', 'Not enough dust. Salvage something first.'],
    nocore: ['An imprint burns two ember cores. Salvage a legendary at Harrow\'s.'], imprint: ['Bound. It remembers a new power now.', 'The power takes. Feel it settle.'],
    noess: ['You carry no power that fits it. Salvage legendaries to bottle theirs.'], rare: ['Only a rare or a legendary can hold a power. Transmute it first.'] }
};
const LOT_SAY = { svc: null, text: '', t: 0 };
function LOT_say(svc, kind) { const L0 = LOT_LINES[svc] && LOT_LINES[svc][kind]; if (!L0) return; let t = rnd.pick(L0); if (L0.length > 1 && t === LOT_SAY.text) t = rnd.pick(L0); LOT_SAY.svc = svc; LOT_SAY.text = t; LOT_SAY.t = 0; }
function LOT_sayUpdate(dt) { LOT_SAY.t += dt; for (const k in LOT_NPC) { const r = LOT_NPC[k]._rig; if (r) r.update(dt, { x: 0, y: 0, facing: Math.PI / 2, expr: LOT_SAY.svc === k && LOT_SAY.t * 45 >= LOT_SAY.text.length ? 'smile' : null }); } }
const LOT_npcOf = svc => { const d = UI.data(svc); return d && d.npc ? d.npc : null; };
function LOT_npcName(svc) { const n = LOT_npcOf(svc); return (n && n.S && n.S.name) || LOT_NPC[svc].name; }
function LOT_npcRig(svc) { const n = LOT_npcOf(svc); if (n && n.rig) return n.rig; const D = LOT_NPC[svc]; if (!D._rig) { D._rig = new E.Humanoid(Object.assign({}, D.rig, { colors: Object.assign({}, D.rig.colors) })); D._rig.update(0, { x: 0, y: 0, facing: Math.PI / 2 }); } return D._rig; }
/** the shopkeeper's portrait, name and a speech balloon that types its line (the mouth moves while it types) */
function LOT_npcHeader(g, x, y, w, svc) {
  const D = LOT_NPC[svc], n = LOT_npcOf(svc), rig = LOT_npcRig(svc), name = LOT_npcName(svc), title = (n && n.S && n.S.title) || D.title, PS = 34;
  const typing = LOT_SAY.svc === svc && LOT_SAY.t * 45 < LOT_SAY.text.length; rig._talk = typing;
  rig.drawPortrait(g, x + 2, y + 2, PS, { zoom: 2.3, turn: .45, bg: D.bg, border: D.border });
  const nx = x + PS + 9; E.font.text(g, name, nx, y, GOLD, { outline: false, shadow: '#05040a' });
  E.font.text(g, (title || '').toUpperCase(), nx + E.font.width(name) + 5, y + 2, '#9a90b0', { font: 'tiny', outline: false });
  const bx = nx - 2, by = y + 9, bw = x + w - bx, text = LOT_SAY.svc === svc ? LOT_SAY.text : '', lines = E.font.wrap(text, bw - 8).slice(0, 3), bh = Math.max(20, lines.length * 9 + 5);
  E.ui.box(g, bx, by, bw, bh, { bg: ['#f4ecdc', '#d8ccb4'], border: '#3a2a3a', shadow: false });
  px.poly(g, [[bx + 1, by + 5], [bx - 4, by + 8], [bx + 1, by + 11]], '#3a2a3a'); px.poly(g, [[bx + 2, by + 6], [bx - 1, by + 8], [bx + 2, by + 10]], '#ece2d0');
  let left = Math.floor(LOT_SAY.t * 45);
  lines.forEach((l, i) => { const s = l.slice(0, Math.max(0, left)); left -= l.length + 1; if (s) E.font.text(g, s, bx + 4, by + 3 + i * 9, '#2a1a2a', { outline: false }); });
  if (!typing && text && Math.floor(performance.now() / 400) % 2) px.rect(g, bx + bw - 7, by + bh - 5, 3, 2, '#6a5a6a');
}
/* prices follow the items' own value curve (itemValue), so no service turns a profit when the result is sold:
   tempering always costs more than the sell value it adds, and a gamble costs more than a gamble is worth on average
   (about 4x a common's value: 43% common, 35% magic, 17% rare, 5% legendary or unique) */
const LOT_COST = {
  buy: it => Math.round(it.value * 4),
  reforge: it => Math.round(it.value * 1.5 + 25 * SCALE.gold(it.ilvl)),
  temper: (it, to) => Math.round(Math.max((to - it.ilvl) * (8 + it.value * .12) * Math.sqrt(SCALE.gold(to)), (itemValue(to, it.rarity) - it.value) * 1.1)),
  enchant: it => Math.round((20 * SCALE.gold(it.ilvl) + it.value * .6) * (1 + (it.enchants || 0) * .35)),
  transmute: it => Math.round(it.rarity === 0 ? 10 + it.value * 3 : 60 * SCALE.gold(it.ilvl) + it.value * 4),
  gamble: (slot, d) => Math.round((slot === 'weapon' ? 9 : slot === 'amulet' ? 8 : slot === 'ring' ? 7 : 6) * itemValue(d, 0)),
  respec: h => Math.round(15 * h.level * (1 + h.level * .08))
};
for (const k in LOT_COST) { const f = LOT_COST[k]; LOT_COST[k] = (...a) => { const v = f(...a); return TUNE.prices === 1 ? v : Math.round(v * TUNE.prices); }; }   // (Tuning's Shop prices)
/** pay or complain: true if the gold was taken */
function LOT_pay(h, n, svc) { if (h.gold < n) { LOT_say(svc, 'poor'); sfx('cancel', { vol: .5 }); return false; } h.gold -= n; return true; }

/* =============================================================================
 * MATERIALS: salvage breaks items into them and crafting spends them with the gold, so salvaging is not selling.
 * They live in the stash (h.stash.mats, saved with it); a legendary's power comes out as an ESSENCE (h.stash.ess)
 * that Seren can imprint on another item of a slot it fits (Diablo IV's aspects). Yields grow a step every 20 item
 * levels, so deep salvage keeps up with deep crafting.
 * ============================================================================= */
const LOT_MATS = {
  scrap: { name: 'Iron Scrap', color: '#b8bcc8', desc: 'Salvaged from anything. Harrow reforges and tempers with it.' },
  dust: { name: 'Rune Dust', color: '#8ab4ff', desc: 'Salvaged from magic items and better. Reforging, enchanting and transmuting use it.' },
  core: { name: 'Ember Core', color: '#ff9a3a', desc: 'Salvaged from legendary and unique items. An imprint burns two.' }
};
const LOT_MAT_IDS = ['scrap', 'dust', 'core'];
/** what crafting costs besides gold */
const LOT_MATCOST = {
  reforge: it => ({ scrap: 1 + it.rarity, dust: it.rarity }),
  temper: (it, to) => ({ scrap: clamp(Math.ceil((to - it.ilvl) / 2), 1, 24) }),
  enchant: it => ({ dust: 1 + (it.enchants || 0) }),
  transmute: it => ({ dust: it.rarity === 0 ? 1 : 3 }),
  imprint: () => ({ core: 2 })
};
LOT_COST.imprint = it => Math.round(40 * SCALE.gold(it.ilvl) + it.value * 2);
/** what an item breaks into: { scrap, dust, core, ess (a power id or null) } */
function LOT_yield(it) {
  const k = 1 + Math.floor((it.ilvl || 1) / 20), r = it.rarity, pw = it.power && REG.powers[it.power];
  return { scrap: [1, 2, 2, 3, 3][r] * k, dust: [0, 1, 2, 3, 3][r] * k, core: r === 3 ? 1 + (it.ilvl >= 40 ? 1 : 0) : r === 4 ? 2 : 0,
    ess: pw && (r === 3 || (r === 4 && pw.slots && pw.slots.length)) ? pw.id : null };   // (a unique-only power stays with its unique)
}
const LOT_yieldText = y => LOT_MAT_IDS.filter(k => y[k]).map(k => '+' + y[k] + ' ' + LOT_MATS[k].name.split(' ')[1].toUpperCase()).join('  ') + (y.ess ? '  +ESSENCE' : '');
/** a material's 7 px icon: stacked ingots, a glittering heap of dust, a faceted core that glows */
function LOT_matIcon(g, id, x, y) {
  if (id === 'ess') { const t = E.tones('#ffb070'); px.blend(g, .4, 'add', () => px.disc(g, x + 3.5, y + 4, 3.5, '#ff8a2a')); px.disc(g, x + 3.5, y + 4.5, 2.4, t.sh); px.disc(g, x + 3.2, y + 4, 1.6, t.base); px.dot(g, x + 3, y + 3, t.hi); px.dot(g, x + 5, y + 1, t.lt); px.dot(g, x + 4, y, t.hi); return; }
  const t = E.tones(LOT_MATS[id].color);
  if (id === 'scrap') { px.rect(g, x, y + 4, 7, 3, t.deep); px.rect(g, x + 1, y + 4, 5, 1, t.lt); px.rect(g, x + 1, y + 5, 5, 1, t.sh); px.rect(g, x + 1, y + 1, 5, 3, t.deep); px.rect(g, x + 2, y + 1, 3, 1, t.hi); px.rect(g, x + 2, y + 2, 3, 1, t.base); }
  else if (id === 'dust') { px.ell(g, x + 3.5, y + 5.2, 3.5, 1.9, t.deep); px.ell(g, x + 3.5, y + 4.6, 2.8, 1.6, t.sh); px.ell(g, x + 3.2, y + 4.2, 1.8, 1.1, t.base); const k = Math.floor(performance.now() / 300) % 3; px.dot(g, x + [2, 4, 5][k], y + [3, 2, 4][k], t.hi); px.dot(g, x + 3, y + 1, t.lt); }
  else { px.blend(g, .35, 'add', () => px.disc(g, x + 3.5, y + 3.5, 4, t.base)); px.poly(g, [[x + 3.5, y], [x + 7, y + 3.5], [x + 3.5, y + 7], [x, y + 3.5]], t.deep); px.poly(g, [[x + 3.5, y + 1], [x + 6, y + 3.5], [x + 3.5, y + 6], [x + 1, y + 3.5]], t.base); px.rect(g, x + 2, y + 3, 2, 1, t.hi); px.dot(g, x + 3, y + 2, '#ffffff'); }
}
/** how many essences he holds */
const LOT_essN = h => Object.values(LOT_stash(h).ess).reduce((a, n) => a + n, 0);
/** the materials in a row (icon, count), each with its tooltip; align 'right' ends the row at x. Returns its width */
function LOT_matsRow(g, x, y, h, align = 'left') {
  const S = LOT_stash(h), items = LOT_MAT_IDS.map(k => [k, S.mats[k] || 0]).concat([['ess', LOT_essN(h)]]), tiny = { font: 'tiny', outline: false };
  const ws = items.map(([, n]) => 9 + E.font.width(fmt(n), { font: 'tiny' }) + 4), W0 = ws.reduce((a, b) => a + b, 0);
  let xx = align === 'right' ? x - W0 : x;
  items.forEach(([k, n], i) => {
    LOT_matIcon(g, k, xx, y - 1); E.font.text(g, fmt(n), xx + 9, y, n ? '#e8e0f8' : '#5a5478', tiny);
    const tip = k === 'ess' ? [{ t: 'Essences  ' + n, c: '#ffb070' }, { t: 'Powers salvaged from legendaries. Seren imprints one on a rare or legendary item of a slot it fits.', c: '#c8c0d8' }].concat(Object.entries(S.ess).filter(([, c]) => c > 0).slice(0, 8).map(([id, c]) => ({ t: (powerSpec(id) ? powerSpec(id).name : id) + (c > 1 ? '  x' + c : ''), c: '#ff9a4a' })))
      : [{ t: LOT_MATS[k].name + '  ' + fmt(n), c: LOT_MATS[k].color }, { t: LOT_MATS[k].desc, c: '#c8c0d8' }];
    LOT_hot(xx - 1, y - 2, ws[i], 9, { tip }); xx += ws[i];
  });
  return W0;
}
/** can he pay gold and materials? say why not (the NPC's line) */
function LOT_afford(h, gold, need, svc, quiet) {
  const S = LOT_stash(h), short = LOT_MAT_IDS.filter(k => (need[k] || 0) > (S.mats[k] || 0));
  if (h.gold < gold) { if (!quiet) { LOT_say(svc, 'poor'); sfx('cancel', { vol: .5 }); } return false; }
  if (short.length) { if (!quiet) { LOT_say(svc, short.includes('core') ? 'nocore' : 'mats'); sfx('cancel', { vol: .5 }); } return false; }
  return true;
}
function LOT_payAll(h, gold, need, svc) { if (!LOT_afford(h, gold, need, svc)) return false; const S = LOT_stash(h); h.gold -= gold; for (const k of LOT_MAT_IDS) if (need[k]) S.mats[k] -= need[k]; return true; }
/** a crafting button: the verb at the left, the price at the right (gold, then each material, red where he is short) */
function LOT_costBtn(g, x, y, w, BH, label, gold, need, h, fn, o = {}) {
  LOT_btn(g, x, y, w, BH, '', fn, o);
  const S = LOT_stash(h), dis = o.disabled, ty = y + Math.round((BH - 7) / 2);
  E.font.text(g, label, x + 5, ty, dis ? '#6a6488' : '#e8e0f8', { outline: false, shadow: '#05040a' });
  if (dis && !o.showCost) return;
  let xx = x + w - 5;
  if (need && need.ess && o.gain) { xx -= 7; LOT_matIcon(g, 'ess', xx, ty); xx -= 5; }
  for (const k of LOT_MAT_IDS.slice().reverse()) if (need && need[k]) { const s = (o.gain ? '+' : '') + need[k], sw = E.font.width(s, { font: 'tiny' }); xx -= sw; E.font.text(g, s, xx, ty + 1, o.gain ? '#a8f0b0' : (S.mats[k] || 0) >= need[k] ? '#e8e0f8' : '#ff7a6a', { font: 'tiny', outline: false }); xx -= 9; LOT_matIcon(g, k, xx, ty); xx -= 4; }
  if (gold) { const s = fmt(gold), sw = E.font.width(s, { font: 'tiny' }); xx -= sw; E.font.text(g, s, xx, ty + 1, h.gold >= gold ? GOLD : '#ff7a6a', { font: 'tiny', outline: false }); xx -= 6; LOT_coin(g, xx, ty + 1, true); }
}
/** salvage at the forge: materials (and a legendary's essence), never gold; rares and better ask twice */
function LOT_salvage(h, it, at) {
  if (!it || LOT_worn(h, it)) return false;
  if (it.rarity >= 2 && LOT_UI.confirm !== it.uid) { LOT_UI.confirm = it.uid; LOT_UI.confirmT = 2.5; notify('SALVAGE ' + it.name.toUpperCase() + '? AGAIN TO CONFIRM', '#ffd36a', 2.2); sfx('select', { vol: .5 }); return false; }
  if (!LOT_take(h, it)) return false;
  LOT_UI.confirm = null; const y = LOT_yield(it), S = LOT_stash(h);
  for (const k of LOT_MAT_IDS) if (y[k]) S.mats[k] = (S.mats[k] || 0) + y[k];
  if (y.ess) S.ess[y.ess] = (S.ess[y.ess] || 0) + 1;
  if (at) { LOT_float(at[0] + 8, at[1] - 2, LOT_yieldText(y), y.ess ? '#ffb070' : '#d8e0f0'); LOT_burst(at[0] + 8, at[1] + 8, '#c8ccd8', 8); if (y.dust) LOT_burst(at[0] + 8, at[1] + 8, '#8ab4ff', 5); if (y.core) LOT_burst(at[0] + 8, at[1] + 8, '#ff9a3a', 8); }
  sfx('clang', { vol: .45, pitch: 1.2 }); if (y.ess) sfx('chime', { vol: .5 }); LOT_say('smith', y.ess ? 'essence' : 'salvage');
  return true;
}
/** the right-hand column every shop shares. Each block is labelled from above: 'WORN' over the worn row (the smith and
 *  the mystic work on those too), then 'YOUR BAG n/40' over the bag; the gold (and the materials, where crafting
 *  spends them) sits at the right of the first line */
function LOT_shopBag(g, x, y, w, bottom, h, mode, worn, mats) {
  const tiny = { font: 'tiny', outline: false }, bagLabel = yy => { E.font.text(g, 'YOUR BAG', x, yy, '#9a90b0', tiny); E.font.text(g, h.bag.length + '/' + BAG_MAX, x + 38, yy, h.bag.length >= BAG_MAX ? '#ff8a7a' : '#6a6488', tiny); };
  LOT_gold(g, x + w, y - 1, h, 'right');
  if (mats) LOT_matsRow(g, x + w - E.font.width(fmt(h.gold)) - 14, y, h, 'right');
  let gy = y + 9;
  if (worn) {
    E.font.text(g, 'WORN', x, y, '#9a90b0', tiny);
    const WS = clamp(Math.floor(w / 10), 14, 19);
    SLOTS.forEach((s, i) => { const it = h.gear[s], cx = x + i * WS; LOT_itemCell(g, cx, gy, WS - 1, it, { key: 'worn:' + s, sel: mode.sel && mode.sel === it, seam: 1, click: () => mode.select(it), alt: null, drop: T => { if (T && T.kind === 'anvil') mode.select(it); }, tipO: { equipped: true, hint: [{ t: 'CLICK: ' + (mode.kind === 'smith' ? 'PUT ON THE ANVIL' : 'PLACE ON THE ALTAR'), c: '#8a80a8' }] } }); if (!it) drawItemIconEx(g, LOT_ghost(s), cx + Math.floor((WS - 17) / 2), gy + Math.floor((WS - 17) / 2), 1, { alpha: .35, anim: false }); });
    gy += WS + 3; px.rect(g, x, gy, w, 1, '#3a3050'); gy += 3;   // a rule between what he wears and what he carries
    bagLabel(gy); gy += 9;
  } else bagLabel(y);
  const cols = 8, rows = 5, CS = clamp(Math.min(Math.floor(w / cols), Math.floor((bottom - gy) / rows)), 14, 24);
  LOT_bagGrid(g, x + Math.floor((w - CS * cols) / 2), gy, cols, rows, CS, h, mode);
  return gy + rows * CS;
}

/* =============================================================================
 * COBB'S WARES (vendor): buy, sell, buy back, gamble
 * ============================================================================= */
const LOT_SHOP = { stock: [], forL: null, buyback: [], tab: 'buy', reveal: null };
const LOT_GAMBLE = ['weapon', 'helm', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'amulet', 'ring'];
/** a new stock every time Emberhold is built (every visit), scaled to the deepest depth reached */
function LOT_restock(h) {
  if (LOT_SHOP.forL === ED.L && LOT_SHOP.stock.length) return;
  const d = Math.max(1, h.maxDepth || 1); LOT_SHOP.stock = []; LOT_SHOP.buyback = []; LOT_SHOP.forL = ED.L;
  for (let i = 0; i < 18; i++) { const q = rnd(), rar = d >= 3 && q < .05 ? 3 : q < .3 ? 2 : q < .85 ? 1 : 0; LOT_SHOP.stock.push(makeItem({ ilvl: Math.max(1, d + rnd.int(-1, 1)), rarity: rar })); }
  LOT_SHOP.stock.sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || b.rarity - a.rarity);
}
function LOT_buy(h, it, list, price, at, j) {
  if (!it || !list.includes(it)) return;
  if (h.bag.length >= BAG_MAX) { LOT_say('vendor', 'full'); sfx('cancel', { vol: .5 }); return; }
  if (!LOT_pay(h, price, 'vendor')) return;
  list.splice(list.indexOf(it), 1); h.bag.push(it); it._new = true; if (j !== undefined) LOT_moveBag(h, it, j);
  sfx('coin', { vol: .6, pitch: .8 }); LOT_say('vendor', list === LOT_SHOP.buyback ? 'buyback' : 'buy'); if (at) LOT_burst(at[0] + 10, at[1] + 10, RARITY[it.rarity].color, 10);
}
function LOT_gamble(h, slot, at) {
  const d = Math.max(1, h.maxDepth || 1);
  if (h.bag.length >= BAG_MAX) { LOT_say('vendor', 'full'); sfx('cancel', { vol: .5 }); return; }
  if (!LOT_pay(h, LOT_COST.gamble(slot, d), 'vendor')) return;
  const it = makeItem({ slot, ilvl: d, rarity: rollRarity(d, rnd, (h.stats.magicFind || 0) + 60, .4) }); h.bag.push(it); it._new = true;
  LOT_SHOP.reveal = { it, t: 0 }; LOT_say('vendor', it.rarity >= 3 ? 'lucky' : 'gamble');
  sfx(it.rarity === 4 ? 'secret' : it.rarity === 3 ? 'powerup' : it.rarity === 2 ? 'key' : 'pickup', { vol: .6 }); if (at) LOT_burst(at[0], at[1], RARITY[it.rarity].color, 6 + it.rarity * 5);
}
LOT_PANELS.vendor = { get title() { return LOT_npcName('vendor') + "'S GOODS"; }, hotkeyPanel: true, w: W => Math.min(W - 8, 480), h: (W, H) => Math.min(H - 8, 262),
  open() { LOT_SHOP.tab = 'buy'; LOT_SHOP.reveal = null; LOT_UI.focus = null; LOT_UI.press = null; if (ED.hero) LOT_restock(ED.hero); LOT_say('vendor', 'greet'); },
  close() { LOT_UI.press = null; const r = LOT_npcRig('vendor'); if (r) r._talk = false; },
  update() { LOT_update(); if (LOT_SHOP.reveal) LOT_SHOP.reveal.t += LOT_UI.rdt; if (game.input.pressed('map')) { const T0 = ['buy', 'buyback', 'gamble']; LOT_SHOP.tab = T0[(T0.indexOf(LOT_SHOP.tab) + 1) % 3]; sfx('select', { vol: .4 }); } },
  wheel() {},
  draw(g, x, y, w, hh) {
    const h = ED.hero; if (!h) return; LOT_begin(this, x, y, w, hh); LOT_restock(h);
    const pad = 7, top = y + 19, lw = Math.floor((w - pad * 2 - 8) * .5), rx = x + pad + lw + 8, rw = x + w - pad - rx, foot = y + hh - 10;
    LOT_npcHeader(g, x + pad, top, lw, 'vendor');
    const ty = top + 42, T0 = LOT_SHOP.tab;
    LOT_tabBtn(g, x + pad, ty, 34, 'BUY', T0 === 'buy', () => { LOT_SHOP.tab = 'buy'; }, 'buy');
    LOT_tabBtn(g, x + pad + 36, ty, 50, 'BUY BACK', T0 === 'buyback', () => { LOT_SHOP.tab = 'buyback'; }, 'buyback');
    LOT_tabBtn(g, x + pad + 88, ty, 44, 'GAMBLE', T0 === 'gamble', () => { LOT_SHOP.tab = 'gamble'; LOT_say('vendor', 'gamble'); }, 'gamble');
    const ay = ty + 16, ah = foot - ay - 2;
    if (LOT_UI.active) LOT_UI.targets.push({ x: x + pad, y: ay, w: lw, h: ah, kind: 'sell' });   // drag an item here to sell it
    E.ui.box(g, x + pad, ay, lw, ah, { bg: ['#16122a', '#0a0812'], border: '#3a3050', shadow: false });
    if (T0 === 'gamble') LOT_gambleArea(g, x + pad, ay, lw, ah, h);
    else {
      const list = T0 === 'buy' ? LOT_SHOP.stock : LOT_SHOP.buyback, cols = 6, CS = clamp(Math.floor((lw - 8) / cols), 16, 26), rows = Math.max(1, Math.floor((ah - 6) / (CS + 8))), gx = x + pad + Math.floor((lw - CS * cols) / 2);
      if (!list.length) E.font.text(g, T0 === 'buy' ? 'SOLD OUT. COME BACK AFTER A DESCENT.' : 'NOTHING SOLD YET.', x + pad + lw / 2, ay + ah / 2 - 3, '#6a6488', { align: 'center', font: 'tiny', outline: false });
      for (let i = 0; i < Math.min(list.length, cols * rows); i++) {
        const it = list[i], cx = gx + (i % cols) * CS, cy = ay + 4 + Math.floor(i / cols) * (CS + 8), price = T0 === 'buy' ? LOT_COST.buy(it) : it.value, can = h.gold >= price;
        LOT_itemCell(g, cx, cy, CS - 1, it, { key: 'stock:' + i, cmp: true, dim: !can, click: () => LOT_buy(h, it, list, price, [cx, cy]), alt: () => LOT_buy(h, it, list, price, [cx, cy]),
          drop: T => { if (T && T.kind === 'bag') LOT_buy(h, it, list, price, [cx, cy], T.i); },
          tipO: { price: { t: (T0 === 'buy' ? 'BUY FOR ' : 'BUY BACK FOR ') + fmt(price) + ' GOLD', c: can ? GOLD : '#ff7a6a' }, hint: [{ t: 'CLICK OR DRAG TO THE BAG TO BUY', c: '#8a80a8' }] } });
        const ps = fmt(price), pw0 = E.font.width(ps, { font: 'tiny' }) + 6, px0 = cx + Math.max(0, Math.floor((CS - 1 - pw0) / 2)); LOT_coin(g, px0, cy + CS + 1, true); E.font.text(g, ps, px0 + 6, cy + CS + 1, can ? GOLD : '#a04a4a', { font: 'tiny', outline: false });
      }
    }
    LOT_shopBag(g, rx, top, rw, foot - 4, h, { kind: 'vendor' }, false);
    E.font.text(g, 'CLICK BUY  •  RIGHT-CLICK OR DRAG TO COBB SELLS  •  TAB', x + w / 2, foot + 1, '#5a5478', { align: 'center', font: 'tiny', outline: false });
    LOT_end(g);
  } };
/** the gamble tab: a mystery parcel for each kind of item, and the reveal when one is opened */
function LOT_gambleArea(g, x, y, w, h, hero) {
  const d = Math.max(1, hero.maxDepth || 1), cols = 5, bw = Math.floor((w - 10) / cols), bh = 30, R = LOT_SHOP.reveal;
  LOT_GAMBLE.forEach((s, i) => {
    const bx = x + 5 + (i % cols) * bw + (i >= cols ? Math.floor(bw / 2) : 0), by = y + 5 + Math.floor(i / cols) * (bh + 3), cost = LOT_COST.gamble(s, d), can = hero.gold >= cost;
    const over = LOT_hot(bx, by, bw - 2, bh, { click: () => LOT_gamble(hero, s, [bx + bw / 2, by + 10]), tip: [{ t: 'A sealed ' + SLOT_NAMES[s].toLowerCase(), c: GOLD }, { t: 'Pay ' + fmt(cost) + ' gold for an unknown ' + SLOT_NAMES[s].toLowerCase() + ' of depth ' + d + '. The odds of a rare or better are good.', c: '#c8c0d8' }] });
    const focus = LOT_nav('gam:' + s, bx, by, bw - 2, bh, { act: () => LOT_gamble(hero, s, [bx + bw / 2, by + 10]) }), lit = (over && !UI.keyNav) || focus;
    E.ui.box(g, bx, by, bw - 2, bh, { bg: lit ? ['#3a2e20', '#1e160e'] : ['#2a2018', '#140e0a'], border: lit ? GOLD : '#6a5030', shadow: false });
    // a parcel tied with string, the silhouette of what might be inside
    const pxx = bx + Math.floor((bw - 2) / 2) - 8, pyy = by + 3; drawItemIconEx(g, LOT_ghost(s), pxx, pyy, 1, { alpha: .6, anim: false });
    E.font.text(g, '?', pxx + 13, pyy - 1, lit ? '#fff6d8' : '#c8a060', { font: 'tiny', outline: '#0c0818' });
    LOT_coin(g, bx + 3, by + bh - 8); E.font.text(g, fmt(cost), bx + 11, by + bh - 8, can ? GOLD : '#a04a4a', { font: 'tiny', outline: false });
  });
  if (R && R.t < 2.2) {   // the reveal: the parcel bursts and the item spins in, framed in its rarity
    const cx = x + w / 2, cy = y + 5 + 2 * (bh + 3) + Math.max(18, (h - 2 * (bh + 3) - 8) / 2), u = clamp(R.t / .45, 0, 1), it = R.it, rc = RARITY[it.rarity].color, a = R.t > 1.8 ? (2.2 - R.t) / .4 : 1;
    px.blend(g, .3 * a * u, 'add', () => { for (let i = 0; i < 12; i++) { const an = i / 12 * TAU + R.t * .7, L0 = 26 + 6 * Math.sin(R.t * 4 + i); px.poly(g, [[cx, cy], [cx + Math.cos(an - .11) * L0, cy + Math.sin(an - .11) * L0 * .8], [cx + Math.cos(an + .11) * L0, cy + Math.sin(an + .11) * L0 * .8]], i % 2 || it.rarity < 2 ? rc : '#ffffff'); } });
    px.blend(g, .35 * a, 'add', () => px.disc(g, cx, cy, 16 * u + 4, rc));
    const sx = Math.max(1, Math.round(Math.abs(Math.cos((1 - u) * Math.PI * 1.5)) * 18));
    px.blend(g, a, 'normal', () => { E.ui.box(g, cx - sx, cy - 18, sx * 2, 36, { bg: ['#241c34', '#0c0818'], border: (LOT_RAR[it.rarity] || LOT_RAR[0]).bd, shadow: false }); if (u >= 1) drawItemIconEx(g, it, cx - 16, cy - 16, 2); });
    if (u >= 1) E.font.text(g, it.name, cx, cy + 21, rc, { align: 'center', outline: '#0c0818' });
  }
}

/* =============================================================================
 * HARROW'S FORGE (smith): reforge, temper, salvage
 * ============================================================================= */
const LOT_SMITH = { sel: null, flash: 0, select: null };
const LOT_owned = (h, it) => !!it && (h.bag.includes(it) || !!LOT_worn(h, it));
/** after changing an item: if he wears it, his stats, powers and look follow */
function LOT_refit(h, it) { if (LOT_worn(h, it)) { refreshPowers(h); computeStats(h); dressHero(h); } LOT_CMP.clear(); }
function LOT_reforge(h, it) {
  const fresh = makeItem({ base: it.base, rarity: it.rarity, ilvl: it.ilvl, power: it.power, grade: it.grade, R: rnd });
  it.affixes = fresh.affixes; if (it.rarity === 1) it.name = fresh.name; delete it.enchIdx; it.enchants = 0;
  if (it.slot === 'weapon') {
    it.el = fresh.el; const fc = (fresh.look && fresh.look.colors) || {}, bc = ((REG.itemBases[it.base] || {}).look || {}).colors || {};
    it.look.colors = it.look.colors || {}; for (const k of ['metal', 'metalDk', 'orb']) { const v = fc[k] || bc[k]; if (v) it.look.colors[k] = v; else delete it.look.colors[k]; }
  }
  LOT_refit(h, it);
}
function LOT_temper(h, it, to) {
  if (to <= it.ilvl) return;
  rescaleItem(it, to);   // (40-loot-core: base, implicits and every line keep their tier position and roll, hybrids too)
  it.ilvl = to; it.value = itemValue(to, it.rarity);   // the same gold curve as a fresh drop of that level
  LOT_refit(h, it);
}
LOT_PANELS.smith = { get title() { return LOT_npcName('smith') + "'S FORGE"; }, hotkeyPanel: true, w: W => Math.min(W - 8, 480), h: (W, H) => Math.min(H - 8, 262),
  open() { LOT_SMITH.sel = null; LOT_UI.focus = null; LOT_UI.press = null; LOT_SMITH.select = it => { if (!it) return; LOT_SMITH.sel = it; LOT_SMITH.flash = .15; sfx('select', { vol: .5 }); }; LOT_say('smith', 'greet'); },
  close() { LOT_UI.press = null; const r = LOT_npcRig('smith'); if (r) r._talk = false; },
  update() { LOT_update(); LOT_SMITH.flash = Math.max(0, LOT_SMITH.flash - LOT_UI.rdt); },
  wheel() {},
  draw(g, x, y, w, hh) {
    const h = ED.hero; if (!h) return; LOT_begin(this, x, y, w, hh);
    if (LOT_SMITH.sel && !LOT_owned(h, LOT_SMITH.sel)) LOT_SMITH.sel = null;
    const pad = 7, top = y + 19, lw = Math.floor((w - pad * 2 - 8) * .5), rx = x + pad + lw + 8, rw = x + w - pad - rx, foot = y + hh - 10, it = LOT_SMITH.sel, t = performance.now() / 1000;
    LOT_npcHeader(g, x + pad, top, lw, 'smith');
    // the anvil: the forge glows behind it and the chosen item floats over it
    const ay = top + 42, ah = hh >= 250 ? 66 : hh >= 226 ? 58 : 52, cx = x + pad + Math.round(lw / 2);
    if (LOT_UI.active) LOT_UI.targets.push({ x: x + pad, y: ay, w: lw, h: ah, kind: 'anvil' });
    E.ui.box(g, x + pad, ay, lw, ah, { bg: ['#2a1810', '#0c0806'], border: '#5a3a2a', shadow: false });
    const [icx, icy] = LOT_forgeScene(g, x + pad, ay, lw, ah, t);
    if (it) {
      const bob = Math.round(Math.sin(t * 2.2) * 1.5), ix = icx - 16, iy = Math.max(ay + 2, icy - 14) + bob;
      px.blend(g, .3, 'add', () => px.ell(g, icx, iy + 16, 14, 12, RARITY[it.rarity].color));
      drawItemIconEx(g, it, ix, iy, 2);
      if (LOT_SMITH.flash > 0) px.blend(g, LOT_SMITH.flash / .15, 'add', () => px.ell(g, icx, iy + 16, 16, 16, '#fff0c0'));
      const over = LOT_hot(ix, iy, 32, 32, {}); if (over && !UI.keyNav) LOT_UI.tip = { it, anchor: [ix, iy, 32, 32], o: { equipped: !!LOT_worn(h, it), compare: false } };
    } else E.font.text(g, 'PICK AN ITEM FROM YOUR BAG', icx, ay + 8, '#c89a6a', { align: 'center', font: 'tiny', outline: '#0c0806' });
    // the name and the three services
    let by = ay + ah + 3;
    if (it) { E.font.text(g, it.name.length > 30 ? it.name.slice(0, 29) + '.' : it.name, cx, by, RARITY[it.rarity].color, { align: 'center', outline: false, shadow: '#05040a' }); E.font.text(g, 'ITEM LEVEL ' + it.ilvl + (LOT_worn(h, it) ? '  •  WORN' : ''), cx, by + 9, '#8a80a8', { align: 'center', font: 'tiny', outline: false }); }
    by += 18;
    const bw = lw, d = Math.max(1, h.maxDepth || 1), uniq = it && it.rarity === 4, bx = x + pad, BH = 13;
    const rc = it && !uniq && it.rarity >= 1 ? LOT_COST.reforge(it) : 0, tc = it && it.ilvl < d ? LOT_COST.temper(it, d) : 0, rm = it ? LOT_MATCOST.reforge(it) : null, tm = it && it.ilvl < d ? LOT_MATCOST.temper(it, d) : null;
    LOT_costBtn(g, bx, by, bw, BH, it ? (uniq ? 'REFORGE (UNIQUE)' : it.rarity < 1 ? 'REFORGE (COMMON)' : 'REFORGE') : 'REFORGE', rc, rm, h, () => {
      if (!it) return LOT_say('smith', 'pick'); if (uniq) return LOT_say('smith', 'unique'); if (it.rarity < 1) return;
      if (!LOT_payAll(h, rc, rm, 'smith')) return; LOT_reforge(h, it); LOT_forgeFx(icx, icy, it); LOT_say('smith', 'reforge');
    }, { key: 'reforge', disabled: !it || uniq || it.rarity < 1, tip: [{ t: 'Reforge', c: GOLD }, { t: 'Reroll every affix. The base, rarity, item level and legendary power stay. Costs gold, Iron Scrap and Rune Dust.', c: '#c8c0d8' }] });
    by += BH + 3;
    LOT_costBtn(g, bx, by, bw, BH, it ? (it.ilvl >= d ? 'TEMPER (AT ' + d + ')' : 'TEMPER TO ' + d) : 'TEMPER', tc, tm, h, () => {
      if (!it) return LOT_say('smith', 'pick'); if (it.ilvl >= d) return LOT_say('smith', 'max');
      if (!LOT_payAll(h, tc, tm, 'smith')) return; LOT_temper(h, it, d); LOT_forgeFx(icx, icy, it); LOT_say('smith', 'temper');
    }, { key: 'temper', disabled: !it || it.ilvl >= d, tip: [{ t: 'Temper', c: GOLD }, { t: 'Raise the item level to your deepest depth (' + d + '). Damage, armor and affixes grow with it. Costs gold and Iron Scrap.', c: '#c8c0d8' }] });
    by += BH + 3;
    const worn = it && LOT_worn(h, it), yl = it && !worn ? LOT_yield(it) : null;
    LOT_costBtn(g, bx, by, bw, BH, it ? (worn ? 'SALVAGE (WORN)' : 'SALVAGE' + (yl.ess ? ' + ESSENCE' : '')) : 'SALVAGE', 0, yl, h, () => {
      if (!it) return LOT_say('smith', 'pick'); if (worn) return; if (LOT_salvage(h, it, [icx - 8, icy])) { LOT_SMITH.sel = null; LOT_forgeFx(icx, icy, it); }
    }, { key: 'salvage', disabled: !it || !!worn, color: '#4a2a2a', gain: true, tip: [{ t: 'Salvage', c: GOLD }, { t: 'Break it into materials for crafting (no gold: sell to Cobb for that). A legendary also gives up its power as an essence Seren can imprint on another item.', c: '#c8c0d8' }] });
    LOT_shopBag(g, rx, top, rw, foot - 4, h, { kind: 'smith', sel: it, select: LOT_SMITH.select }, true, true);
    E.font.text(g, 'CLICK OR DRAG AN ITEM TO THE ANVIL  •  RIGHT-CLICK SALVAGES INTO MATERIALS', x + w / 2, foot + 1, '#5a5478', { align: 'center', font: 'tiny', outline: false });
    LOT_end(g);
  } };
/** an anvil in pixel art (k = size): a stepped foot, a waist, a horned body with a lit top */
function LOT_anvil(g, cx, by, k = 1) {
  const t = E.tones('#6e6c80'), X = v => cx + v * k, Y = v => by + v * k;
  px.poly(g, [[X(-11), Y(0)], [X(11), Y(0)], [X(7), Y(-5)], [X(-7), Y(-5)]], t.deep); px.rect(g, X(-7), Y(-5), 14 * k, 1, t.sh);
  px.rect(g, X(-4), Y(-10), 8 * k, 5 * k, t.sh); px.rect(g, X(-4), Y(-10), 2 * k, 5 * k, t.base);
  px.poly(g, [[X(-22), Y(-15)], [X(-8), Y(-11)], [X(13), Y(-11)], [X(13), Y(-18)], [X(-10), Y(-18)], [X(-17), Y(-17)]], t.base);
  px.poly(g, [[X(-8), Y(-11)], [X(13), Y(-11)], [X(13), Y(-13)], [X(-8), Y(-13)]], t.sh);
  px.rect(g, X(-10), Y(-18), 23 * k, 2, t.lt); px.rect(g, X(-6), Y(-18), 10 * k, 1, t.hi); px.dot(g, X(-22), Y(-15), t.hi); px.rect(g, X(12), Y(-18), 1, 7 * k, '#c8703a');
  px.rect(g, X(3), Y(-10), 1, 5 * k, '#a85a30'); px.rect(g, X(7), Y(-5), 1, 5 * k, '#a85a30');   // the forge's light on the far edges
}
/** Harrow's forge: a brick wall, the forge mouth with breathing coals, the anvil, his hammer, embers rising */
function LOT_forgeScene(g, x, y, w, h, t) {
  const fy = y + h - 5, br = E.tones('#4a2a22');
  for (let row = 0; row * 6 < h - 16; row++) for (let col = -1; col * 12 < w; col++) {
    const bx = x + 2 + col * 12 + (row % 2) * 6, by = y + 2 + row * 6; if (bx < x + 2 || bx + 11 > x + w - 2) continue;
    px.rect(g, bx, by, 11, 5, row % 3 ? br.deep : '#2a1812'); px.rect(g, bx, by, 11, 1, br.sh);
  }
  const mx = x + w - 30, my = y + 8;   // the forge mouth: a dark arch full of coals
  px.poly(g, [[mx - 16, fy - 8], [mx - 16, my + 10], [mx - 10, my + 3], [mx, my], [mx + 10, my + 3], [mx + 16, my + 10], [mx + 16, fy - 8]], '#120806');
  px.blend(g, .5 + .15 * Math.sin(t * 3), 'add', () => px.ell(g, mx, fy - 13, 13, 7, '#c8401a'));
  for (let i = 0; i < 9; i++) { const cx = mx - 11 + (i % 5) * 5.5 + (i > 4 ? 2.7 : 0), cy = fy - 12 - (i > 4 ? 3 : 0), k = .5 + .5 * Math.sin(t * (2 + i * .7) + i); px.disc(g, cx, cy, 2, k > .6 ? '#ffd070' : '#ff7a2a'); px.dot(g, cx - 1, cy - 1, k > .8 ? '#fff6c0' : '#ffb040'); }
  px.rect(g, mx - 17, fy - 9, 34, 3, '#3a2a28'); px.rect(g, mx - 17, fy - 9, 34, 1, '#5a4440');
  px.blend(g, .22 + .08 * Math.sin(t * 3), 'add', () => { px.ell(g, x + w * .45, fy - 3, w * .42, 9, '#ff6a1a'); px.ell(g, mx, fy - 8, 22, 12, '#ff9a3a'); });
  for (let i = 0; i < 6; i++) { const u = (t * .45 + i * .17) % 1, ex = mx - 8 + ((i * 37) % 17) + Math.sin(t * 2 + i) * 3, ey = fy - 14 - u * (h - 18); if (ey > y + 2) px.blend(g, 1 - u, 'add', () => px.dot(g, ex, ey, u < .3 ? '#fff0b0' : '#ff8a3a')); }
  const ax = x + Math.round(w * .38); LOT_anvil(g, ax, fy, 1.25);
  px.line(g, ax + 20, fy, ax + 27, fy - 19, '#5a3620', 2); px.rect(g, ax + 23, fy - 23, 9, 5, '#5a5a6a'); px.rect(g, ax + 23, fy - 23, 9, 1, '#9a9aaa');   // his hammer against the anvil
  return [ax - 4, fy - 30];
}
/** sparks off the anvil and a ring of the hammer */
function LOT_forgeFx(x, y, it) { LOT_burst(x, y, '#ffb040', 16); LOT_burst(x, y, RARITY[it.rarity].color, 8); LOT_SMITH.flash = .15; sfx('clang', { vol: .6 }); sfx('hit', { vol: .3, pitch: .7 }); }

/* =============================================================================
 * SEREN'S ALTAR (mystic): enchant one affix, transmute the rarity, respec
 * ============================================================================= */
const LOT_MYST = { sel: null, ench: null, imp: false, respecT: 0, select: null };
/** the essences that fit an item's slot: [[power id, count]] */
const LOT_essFor = (h, it) => { const slot = it.slot === 'ring2' ? 'ring' : it.slot; return Object.entries(LOT_stash(h).ess).filter(([id, n]) => n > 0 && powerFits(id, slot)); };   // (powerFits: composed powers too)
/** bind a power to a rare or a legendary: it becomes (or stays) legendary with that power, its affixes kept */
function LOT_imprint(h, it, id) {
  const S = LOT_stash(h); if (!S.ess[id]) return false;
  S.ess[id]--; if (S.ess[id] <= 0) delete S.ess[id];
  it.power = id; it.rarity = 3; it.name = itemName(it, rnd); it.value = itemValue(it.ilvl, 3); if (it.look) tintLegend(it, rnd);
  LOT_refit(h, it); return true;
}
/** two new affixes the chosen line could become (never a stat the item already has) */
function LOT_enchantOptions(it, idx) {
  const slot = it.slot === 'ring2' ? 'ring' : it.slot, cur = it.affixes[idx], taken = new Set(it.affixes.filter((a, i) => i !== idx).flatMap(a => [(REG.itemAffixes[a.id] || {}).stat || a.stat].concat((a.also || []).map(b => b.stat))));   // (a hybrid's second stat is taken too)
  const opts = Object.values(REG.itemAffixes).filter(A => !taken.has(A.stat) && !(A.also || []).some(([b]) => REG.itemAffixes[b] && taken.has(REG.itemAffixes[b].stat)) && A.id !== cur.id && (A.minIlvl || 1) <= it.ilvl && A.slots.includes(slot)), out = [];
  while (out.length < 2 && opts.length) { const A = rnd.weighted(opts, a => a.weight || 10); opts.splice(opts.indexOf(A), 1); out.push(rollAffix(A, it.ilvl, rnd)); }
  return out;
}
function LOT_transmute(h, it) {
  if (it.rarity >= 2) return;
  const to = it.rarity + 1, [n0, n1] = RARITY[to].n, want = rnd.int(n0, n1), taken = new Set(it.affixes.flatMap(a => [(REG.itemAffixes[a.id] || {}).stat || a.stat].concat((a.also || []).map(b => b.stat)))), slot = it.slot === 'ring2' ? 'ring' : it.slot;
  while (it.affixes.length < want) {
    const kind = it.affixes.length % 2 ? 'suffix' : 'prefix', opts = Object.values(REG.itemAffixes).filter(A => !taken.has(A.stat) && !(A.also || []).some(([b]) => REG.itemAffixes[b] && taken.has(REG.itemAffixes[b].stat)) && (A.minIlvl || 1) <= it.ilvl && A.slots.includes(slot) && (to < 2 || A.kind === kind || rnd() < .3));
    if (!opts.length) break; const A = rnd.weighted(opts, a => a.weight || 10); taken.add(A.stat); it.affixes.push(rollAffix(A, it.ilvl, rnd));
  }
  it.rarity = to; it.name = itemName(it, rnd); it.value = itemValue(it.ilvl, to);
  if (to >= 2 && it.slot === 'weapon' && it.el === 'phys') { const ea = it.affixes.find(a => /^inc(Fire|Frost|Storm|Void|Venom)$/.test(a.stat)); if (ea) it.el = ea.stat.slice(3).toLowerCase(); }
  if (to >= 2 && it.look) tintLegend(it, rnd);
  LOT_refit(h, it);
}
/** give back every skill and passive point (respecHero from the skills module when it exists) */
function LOT_respec(h) {
  if (typeof respecHero === 'function') { respecHero(h); computeStats(h); return true; }
  let sk = 0; for (const id in h.skills) { const k = h.skills[id], keep = characterOf(h).skills.includes(id) ? 1 : 0; sk += Math.max(0, (k.rank || 0) - keep); k.rank = Math.min(k.rank || 0, keep); k.rune = null; }
  h.slots = h.slots.map(id => id && h.skills[id] && h.skills[id].rank > 0 ? id : null);
  h.pts.skill += sk; if (Array.isArray(h.tree)) { h.pts.passive += h.tree.length; h.tree = []; }
  computeStats(h); notify('SKILLS AND PASSIVES RESET', '#c890ff', 2.5);
}
LOT_PANELS.mystic = { get title() { return LOT_npcName('mystic') + "'S ALTAR"; }, hotkeyPanel: true, w: W => Math.min(W - 8, 480), h: (W, H) => Math.min(H - 8, 262),
  open() { LOT_MYST.sel = null; LOT_MYST.ench = null; LOT_MYST.imp = false; LOT_UI.focus = null; LOT_UI.press = null; LOT_MYST.select = it => { if (!it || LOT_MYST.ench) return; LOT_MYST.sel = it; LOT_MYST.imp = false; sfx('select', { vol: .5 }); }; LOT_say('mystic', 'greet'); },
  close() { LOT_UI.press = null; const r = LOT_npcRig('mystic'); if (r) r._talk = false; },
  update() { LOT_update(); LOT_MYST.respecT = Math.max(0, LOT_MYST.respecT - LOT_UI.rdt); },
  wheel() {},
  draw(g, x, y, w, hh) {
    const h = ED.hero; if (!h) return; LOT_begin(this, x, y, w, hh);
    if (LOT_MYST.sel && !LOT_owned(h, LOT_MYST.sel)) { LOT_MYST.sel = null; LOT_MYST.ench = null; LOT_MYST.imp = false; }
    const pad = 7, top = y + 19, lw = Math.floor((w - pad * 2 - 8) * .5), rx = x + pad + lw + 8, rw = x + w - pad - rx, foot = y + hh - 10, it = LOT_MYST.sel, t = performance.now() / 1000;
    LOT_npcHeader(g, x + pad, top, lw, 'mystic');
    // the altar: a void orb that breathes, runes turning around it, the item floating in its light
    const ay = top + 42, ah = hh >= 226 ? 40 : 34, ax = x + pad;
    if (LOT_UI.active) LOT_UI.targets.push({ x: ax, y: ay, w: lw, h: ah, kind: 'anvil' });
    E.ui.box(g, ax, ay, lw, ah, { bg: ['#1a1030', '#08060e'], border: '#4a2a6a', shadow: false });
    const ox = ax + 22, oy = ay + ah / 2, pul = .5 + .5 * Math.sin(t * 2);
    px.blend(g, .25 + .15 * pul, 'add', () => px.disc(g, ox, oy, 15, '#6a30c0'));
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t * .7; px.dot(g, ox + Math.cos(a) * 16, oy + Math.sin(a) * 6 + 8, i % 2 ? '#c890ff' : '#6a4a90'); }
    px.poly(g, [[ox - 8, ay + ah - 3], [ox + 8, ay + ah - 3], [ox + 5, ay + ah - 10], [ox - 5, ay + ah - 10]], '#3a2a4a'); px.rect(g, ox - 5, ay + ah - 10, 10, 1, '#6a5a7a');
    if (it) {
      const iy = ay + 4 + Math.round(Math.sin(t * 2.4) * 1.5); drawItemIconEx(g, it, ox - 16, iy, 2);
      const over = LOT_hot(ox - 16, iy, 32, 32, {}); if (over && !UI.keyNav) LOT_UI.tip = { it, anchor: [ox - 16, iy, 32, 32], o: { equipped: !!LOT_worn(h, it), compare: false } };
      const nl = E.font.wrap(it.name, lw - 50).slice(0, 2);
      nl.forEach((l, i) => E.font.text(g, l, ax + 44, ay + 5 + i * 9, RARITY[it.rarity].color, { outline: false, shadow: '#05040a' }));
      E.font.text(g, RARITY[it.rarity].name.toUpperCase() + '  •  ITEM LEVEL ' + it.ilvl, ax + 44, ay + 7 + nl.length * 9, '#8a80a8', { font: 'tiny', outline: false });
    } else { px.blend(g, .7, 'add', () => px.disc(g, ox, oy, 6, '#b070ff')); px.disc(g, ox, oy, 3, '#ecd8ff'); E.font.text(g, 'PLACE AN ITEM ON THE ALTAR', ax + 44, oy - 3, '#8a6aa8', { font: 'tiny', outline: false }); }
    // the affixes: click one to enchant it (after the first, only that line may change again); or the essences to imprint
    let ly = ay + ah + 3; const BH = 13, lastY = foot - 3 * (BH + 3) - 1;
    if (it && LOT_MYST.imp) {
      const list = LOT_essFor(h, it), ic = LOT_COST.imprint(it), im = LOT_MATCOST.imprint(it);
      E.font.text(g, 'IMPRINT A POWER', ax + 2, ly, '#ffb070', { font: 'tiny', outline: false });
      LOT_btn(g, ax + lw - 44, ly - 2, 44, 10, 'CANCEL', () => { LOT_MYST.imp = false; }, { key: 'impx', color: '#2a2040' }); ly += 9;
      if (!list.length) E.font.wrap('NO ESSENCE FITS A ' + SLOT_NAMES[it.slot].toUpperCase() + '. SALVAGE LEGENDARIES AT HARROW\'S FORGE TO BOTTLE THEIR POWERS.', lw - 4, { font: 'tiny' }).slice(0, 3).forEach((l, i) => E.font.text(g, l, ax + 2, ly + 2 + i * 8, '#8a80a8', { font: 'tiny', outline: false }));
      list.forEach(([id, n], i) => {
        const p = powerSpec(id); if (ly + 12 > lastY) return;
        LOT_costBtn(g, ax, ly, lw, 12, (p.name.length > 20 ? p.name.slice(0, 19) + '.' : p.name) + (n > 1 ? ' x' + n : ''), ic, im, h, () => {
          if (!LOT_payAll(h, ic, im, 'mystic')) return; if (!LOT_imprint(h, it, id)) return; LOT_MYST.imp = false; LOT_burst(ox, oy, '#ff9a3a', 20); LOT_burst(ox, oy, '#fff0a0', 10); sfx('powerup', { vol: .55 }); LOT_say('mystic', 'imprint');
        }, { key: 'ess' + i, color: '#3a2430', tip: [{ t: p.name, c: '#ffb070' }, { t: p.desc, c: '#ff9a4a' }, { t: 'Imprint it: the item becomes legendary with this power (its affixes stay). A power it had is replaced.', c: '#c8c0d8' }] });
        ly += 13;
      });
    } else if (it && LOT_MYST.ench) {
      const E0 = LOT_MYST.ench; E.font.text(g, 'CHOOSE ONE', ax + 2, ly, '#c890ff', { font: 'tiny', outline: false }); ly += 8;
      [E0.cur].concat(E0.opts).forEach((a, i) => {
        const rt = LOT_rangeText(it, a), base = (i ? '' : 'KEEP: ') + affixText(a), room = 34 - (rt ? rt.length + 2 : 0);   // the roll's range always shows: the name gives way
        const label = (base.length > room ? base.slice(0, room - 1) + '.' : base) + (rt ? '  ' + rt : '');
        if (ly + 11 > lastY) return;
        LOT_btn(g, ax, ly, lw, 11, label, () => { it.affixes[E0.idx] = a; it.enchIdx = E0.idx; it.enchants = (it.enchants || 0) + 1; if (it.rarity === 1) it.name = itemName(it, rnd); LOT_MYST.ench = null; LOT_refit(h, it); LOT_burst(ox, oy, '#c890ff', 14); sfx('chime', { vol: .5 }); LOT_say('mystic', 'chosen'); },
          { key: 'opt' + i, color: i ? '#3a2458' : '#2a2438' });
        ly += 12;
      });
    } else if (it) {
      if (it.rarity === 4) E.font.text(g, 'A UNIQUE CANNOT BE ENCHANTED.', ax + 2, ly + 2, '#8a80a8', { font: 'tiny', outline: false });
      else if (!it.affixes.length) E.font.text(g, 'NO AFFIXES TO ENCHANT. TRANSMUTE IT FIRST.', ax + 2, ly + 2, '#8a80a8', { font: 'tiny', outline: false });
      else {
        const cost = LOT_COST.enchant(it), em = LOT_MATCOST.enchant(it), S = LOT_stash(h);
        E.font.text(g, 'ENCHANT ONE LINE  ' + fmt(cost) + ' GOLD  +' + em.dust + ' DUST', ax + 2, ly, h.gold >= cost && (S.mats.dust || 0) >= em.dust ? '#c890ff' : '#c87a8a', { font: 'tiny', outline: false }); ly += 8;
        it.affixes.forEach((a, i) => {
          if (ly + 11 > lastY) return; const locked = it.enchIdx !== undefined && it.enchIdx !== i, label = statText(a.stat, a.v);
          LOT_btn(g, ax, ly, lw, 11, (locked ? '' : '▸ ') + (label.length > 32 ? label.slice(0, 31) + '.' : label), () => {
            if (locked) return; if (!LOT_payAll(h, cost, em, 'mystic')) return; LOT_MYST.ench = { idx: i, cur: a, opts: LOT_enchantOptions(it, i) }; LOT_burst(ox, oy, '#b070ff', 10); sfx('warp', { vol: .4 }); LOT_say('mystic', 'enchant');
          }, { key: 'aff' + i, disabled: locked, color: '#2a2040', tip: locked ? [{ t: 'Locked', c: '#9a90b0' }, { t: 'Only the line enchanted before can change again.', c: '#c8c0d8' }] : [{ t: 'Enchant for ' + fmt(cost) + ' gold and ' + em.dust + ' Rune Dust', c: '#c890ff' }, { t: 'Reroll this line: keep it, or take one of two new ones.', c: '#c8c0d8' }] });
          ly += 12;
        });
      }
    }
    // transmute, imprint and respec at the bottom
    const by = foot - 3 * (BH + 3), tcost = it && it.rarity < 2 ? LOT_COST.transmute(it) : 0, tm = it && it.rarity < 2 ? LOT_MATCOST.transmute(it) : null, rcost = LOT_COST.respec(h);
    LOT_costBtn(g, ax, by, lw, BH, it ? (it.rarity >= 2 ? 'TRANSMUTE (RARE IS THE LIMIT)' : 'TRANSMUTE TO ' + RARITY[it.rarity + 1].name.toUpperCase()) : 'TRANSMUTE', tcost, tm, h, () => {
      if (!it) return LOT_say('mystic', 'pick'); if (it.rarity >= 2 || LOT_MYST.ench) return; if (!LOT_payAll(h, tcost, tm, 'mystic')) return;
      LOT_transmute(h, it); LOT_burst(ox, oy, RARITY[it.rarity].color, 18); sfx('powerup', { vol: .5 }); LOT_say('mystic', 'transmute');
    }, { key: 'transmute', disabled: !it || it.rarity >= 2 || !!LOT_MYST.ench, color: '#3a2458', tip: [{ t: 'Transmute', c: '#c890ff' }, { t: 'Common becomes magic, magic becomes rare: new affixes are woven in. Rare is as far as it goes; a power makes it legendary (imprint).', c: '#c8c0d8' }] });
    const canImp = it && it.rarity >= 2 && it.rarity < 4 && !LOT_MYST.ench, nEss = it ? LOT_essFor(h, it).length : 0;
    LOT_btn(g, ax, by + BH + 3, lw, BH, it && it.rarity === 4 ? 'IMPRINT (UNIQUE)' : it && it.rarity < 2 ? 'IMPRINT (RARE OR LEGENDARY)' : LOT_MYST.imp ? 'CHOOSE A POWER ABOVE' : 'IMPRINT A POWER' + (it ? '  (' + nEss + ' FIT' + (nEss === 1 ? 'S' : '') + ')' : ''), () => {
      if (!it) return LOT_say('mystic', 'pick'); if (it.rarity === 4) return LOT_say('mystic', 'unique'); if (it.rarity < 2) return LOT_say('mystic', 'rare'); if (LOT_MYST.ench) return;
      if (!nEss) return LOT_say('mystic', 'noess'); LOT_MYST.imp = !LOT_MYST.imp; sfx('warp', { vol: .35 });
    }, { key: 'imprint', disabled: !canImp, color: '#3a2430', active: LOT_MYST.imp, tip: [{ t: 'Imprint', c: '#ffb070' }, { t: 'Bind a salvaged power (an essence) to a rare or legendary item of a slot it fits. Costs gold and two Ember Cores.', c: '#c8c0d8' }] });
    const pts = Object.entries(h.skills).reduce((a, [id, k]) => a + Math.max(0, (k.rank || 0) - (characterOf(h).skills.includes(id) ? 1 : 0)), 0) + (Array.isArray(h.tree) ? h.tree.length : 0);   // what a respec would give back (nothing: no charge)
    LOT_btn(g, ax, by + 2 * (BH + 3), lw, BH, LOT_MYST.respecT > 0 ? 'CONFIRM RESPEC  ' + fmt(rcost) : 'RESPEC ALL POINTS  ' + fmt(rcost), () => {
      if (pts <= 0) return; if (LOT_MYST.respecT <= 0) { LOT_MYST.respecT = 3; LOT_say('mystic', 'confirm'); return; }
      if (!LOT_pay(h, rcost, 'mystic')) return; LOT_MYST.respecT = 0; LOT_respec(h); LOT_burst(ox, oy, '#ecd8ff', 20); sfx('warp', { vol: .6 }); LOT_say('mystic', 'respec');
    }, { key: 'respec', disabled: pts <= 0, color: LOT_MYST.respecT > 0 ? '#5a2a3a' : '#2a2040', tip: [{ t: 'Respec', c: '#c890ff' }, { t: 'Every skill and passive point comes back to spend again.', c: '#c8c0d8' }] });
    LOT_shopBag(g, rx, top, rw, foot - 4, h, { kind: 'mystic', sel: it, select: LOT_MYST.select }, true, true);
    E.font.text(g, 'CLICK OR DRAG AN ITEM TO THE ALTAR', x + w / 2, foot + 1, '#5a5478', { align: 'center', font: 'tiny', outline: false });
    LOT_end(g);
  } };

/* =============================================================================
 * THE STASH: the chest in Emberhold (56-town opens it: UI.open('stash')). Four tabs of forty, kept in h.stash with the
 * materials and essences (saved: 'stash' is a save key). A click moves an item between the bag and the stash (shift
 * too), a drag places it on a cell or a tab, a right-click wears it. Old saves (no stash, or a bare list) are fitted.
 * ============================================================================= */
const LOT_STASH_TABS = 4, LOT_STASH_N = 40, LOT_ST = { tab: 0, openT: 0, bump: 0, motes: [] }, LOT_STASH_OK = new WeakSet();
/** the stash, made whole: { tabs: [4 x 40 cells, null when empty], mats: {}, ess: {} }. Items kept there get uids
 *  above every new one (the save's own uid scan only knows the bag and the gear) */
function LOT_stash(h) {
  let S = h.stash;
  if (S && LOT_STASH_OK.has(S)) return S;
  if (Array.isArray(S)) { const items = S.filter(Boolean); S = { tabs: [] }; for (let i = 0; i < items.length; i += LOT_STASH_N) S.tabs.push(items.slice(i, i + LOT_STASH_N)); }
  if (!S || typeof S !== 'object') S = {};
  if (!Array.isArray(S.tabs)) S.tabs = [];
  while (S.tabs.length < LOT_STASH_TABS) S.tabs.push([]);
  let mx = 0;
  for (const T of S.tabs) for (let i = 0; i < LOT_STASH_N; i++) { if (!T[i]) T[i] = null; else if (typeof T[i].uid === 'number') mx = Math.max(mx, T[i].uid); }
  if (mx >= itemUid) itemUid = mx + 1;
  S.mats = S.mats && typeof S.mats === 'object' ? S.mats : {}; S.ess = S.ess && typeof S.ess === 'object' ? S.ess : {};
  h.stash = S; LOT_STASH_OK.add(S); return S;
}
const LOT_stashFree = (S, t) => S.tabs[t].indexOf(null);
const LOT_stashCount = (S, t) => S.tabs[t].reduce((a, q) => a + (q ? 1 : 0), 0);
/** from the bag (or off him, into an empty cell) into the stash: tab t, cell i (or the first free cell of t, then of the
 *  other tabs). A filled cell swaps: its item goes into the bag where this one was */
function LOT_toStash(h, it, t = LOT_ST.tab, i) {
  const S = LOT_stash(h); if (!it) return false;
  let tt = t, j = i;
  if (j === undefined) { j = LOT_stashFree(S, tt); for (let k = 1; j < 0 && k < LOT_STASH_TABS; k++) { tt = (t + k) % LOT_STASH_TABS; j = LOT_stashFree(S, tt); } }
  if (j < 0) { notify('THE STASH IS FULL', '#ff8a7a', 1.4); sfx('cancel', { vol: .4 }); return false; }
  const bi = h.bag.indexOf(it), prev = S.tabs[tt][j]; if (prev === it) return false;
  if (bi < 0 && (prev || !LOT_worn(h, it))) return false;
  if (!LOT_take(h, it)) return false;
  S.tabs[tt][j] = it; it._new = false; if (prev) { h.bag.splice(Math.min(bi, h.bag.length), 0, prev); prev._new = true; }
  if (tt !== LOT_ST.tab) LOT_ST.tabFlash = { t: tt, k: .6 };
  LOT_ST.bump = .35; sfx('pickup', { vol: .4, pitch: .85 }); return true;
}
/** from the stash into the bag (at bag index j, or the end). A full bag swaps with the item at j */
function LOT_fromStash(h, t, i, j) {
  const S = LOT_stash(h), it = S.tabs[t][i]; if (!it) return false;
  if (h.bag.length >= BAG_MAX) {
    if (j !== undefined && h.bag[j]) { const o = h.bag[j]; h.bag[j] = it; S.tabs[t][i] = o; sfx('pickup', { vol: .4 }); LOT_ST.bump = .35; return true; }
    notify('BAG FULL', '#ff8a7a', 1.2); sfx('cancel', { vol: .4 }); return false;
  }
  S.tabs[t][i] = null; h.bag.push(it); if (j !== undefined) LOT_moveBag(h, it, j); else sfx('pickup', { vol: .4, pitch: 1.1 });
  LOT_ST.bump = .35; return true;
}
/** a stashed item straight onto him; what it replaces takes its cell */
function LOT_stashWear(h, t, i, slot) {
  const S = LOT_stash(h), it = S.tabs[t][i]; if (!it) return; slot = slot || LOT_slotFor(h, it);
  if (!LOT_fits(it, slot)) { notify('THAT GOES IN THE ' + SLOT_NAMES[it.slot].toUpperCase() + ' SLOT', '#ff9a7a', 1.2); return; }
  const old = h.gear[slot]; h.gear[slot] = it; S.tabs[t][i] = old || null; it._new = false;
  refreshPowers(h); computeStats(h); dressHero(h); sfx('pickup', { vol: .5 }); if (it.rarity >= 3) sfx('powerup', { vol: .35, pitch: 1.4 });
}
function LOT_stashDrop(h, t, i, T) {
  const S = LOT_stash(h), it = S.tabs[t][i]; if (!it || !T) return;
  if (T.kind === 'bag') LOT_fromStash(h, t, i, T.i);
  else if (T.kind === 'stash') { const o = S.tabs[T.tab][T.i]; S.tabs[T.tab][T.i] = it; S.tabs[t][i] = o || null; sfx('select', { vol: .3 }); }
  else if (T.kind === 'stashTab' && T.tab !== t) { const j = LOT_stashFree(S, T.tab); if (j < 0) { notify('THAT TAB IS FULL', '#ff8a7a', 1.2); return; } S.tabs[T.tab][j] = it; S.tabs[t][i] = null; LOT_ST.tabFlash = { t: T.tab, k: .6 }; sfx('pickup', { vol: .4, pitch: .85 }); }
  else if (T.kind === 'slot') LOT_stashWear(h, t, i, T.slot);
}
/** the chest: dark planks, iron bands and corners, a brass lock. The lid swings back on its hinge (a little overshoot)
 *  and shows its inside; the mouth is dark and full of gold that catches a warm light; motes rise out of it. It hops
 *  when something goes in or out */
function LOT_chestDraw(g, x, y, open) {
  const W = 34, wood = E.tones('#7a4a2e'), iron = E.tones('#5e6072'), brass = E.tones('#d8a040'), bx = x, BH = 13, by = y + 17, o = clamp(open, 0, 1.25), hinge = by - 4;
  if (o < .12) {   // shut: the lid's top and its front face
    px.rect(g, bx - 1, by - 9, W + 2, 10, wood.deep); px.rect(g, bx, by - 8, W, 2, wood.lt); px.rect(g, bx, by - 6, W, 5, wood.base); px.rect(g, bx, by - 2, W, 1, wood.sh);
    for (const q of [5, W - 8]) { px.rect(g, bx + q, by - 9, 3, 10, iron.sh); px.rect(g, bx + q, by - 9, 1, 10, iron.lt); }
  } else {
    const lh = Math.round(3 + 10 * Math.min(1, o)), top = hinge - lh - Math.round(Math.max(0, o - 1) * 8);
    px.blend(g, .28 * Math.min(1, o), 'add', () => px.poly(g, [[bx + 4, hinge], [bx + W - 4, hinge], [bx + W + 3, top - 7], [bx - 3, top - 7]], '#ffb040'));   // light pouring up behind the lid
    px.rect(g, bx - 1, top, W + 2, hinge - top + 1, wood.deep); px.rect(g, bx, top + 1, W, hinge - top - 1, wood.sh);   // the lid's inside
    for (let yy = top + 3; yy < hinge - 1; yy += 3) px.rect(g, bx, yy, W, 1, wood.deep);
    for (const q of [5, W - 8]) px.rect(g, bx + q, top, 3, hinge - top + 1, iron.deep);
    px.rect(g, bx - 1, top, W + 2, 1, wood.lt);   // its edge catches the light
    px.rect(g, bx, hinge, W, by - hinge, '#160a06');   // the mouth, and the hoard in it
    for (let i = 0; i < 9; i++) { const cx = bx + 3 + i * 3.4, k = (Math.floor(performance.now() / 180) + i * 5) % 11; px.rect(g, cx, by - 2 - (i % 2), 2, 1, i % 3 ? '#e8a830' : '#ffd23a'); if (k === 0) px.dot(g, cx, by - 3 - (i % 2), '#fffbe0'); }
    px.blend(g, .35 * Math.min(1, o), 'add', () => px.rect(g, bx + 1, hinge, W - 2, by - hinge, '#ff9a2a'));
  }
  // the body: planks, bands, corners, the lock
  px.rect(g, bx - 1, by, W + 2, BH + 1, wood.deep); px.rect(g, bx, by + 1, W, BH - 1, wood.base); px.rect(g, bx, by + 1, W, 1, wood.lt);
  for (const r of [5, 9]) px.rect(g, bx, by + r, W, 1, wood.sh);
  for (const q of [5, W - 8]) { px.rect(g, bx + q, by, 3, BH + 1, iron.sh); px.rect(g, bx + q, by, 1, BH + 1, iron.lt); px.dot(g, bx + q + 1, by + 3, iron.hi); px.dot(g, bx + q + 1, by + BH - 3, iron.hi); }
  for (const cx of [bx - 1, bx + W - 2]) { px.rect(g, cx, by + BH - 2, 3, 3, iron.base); px.dot(g, cx + 1, by + BH - 2, iron.hi); }
  const lk = bx + W / 2 - 2; px.rect(g, lk, by, 5, 6, brass.deep); px.rect(g, lk + 1, by + 1, 3, 4, brass.base); px.dot(g, lk + 1, by + 1, brass.hi); px.rect(g, lk + 2, by + 3, 1, 2, '#2a1808');
  // motes rising out of it
  for (const m of LOT_ST.motes) { const a = Math.min(1, m.t * 3, (m.max - m.t) * 2) * Math.min(1, o); if (a > 0) px.blend(g, a, 'add', () => px.dot(g, bx + W / 2 + m.x, hinge - m.y, m.c)); }
}
LOT_PANELS.stash = { title: 'STASH', hotkeyPanel: true, w: W => Math.min(W - 8, 480), h: (W, H) => Math.min(H - 8, 262),
  open() { LOT_UI.focus = null; LOT_UI.press = null; LOT_ST.openT = 0; LOT_ST.motes.length = 0; if (ED.hero) LOT_stash(ED.hero); sfx('door', { vol: .4 }); },
  close() { LOT_UI.press = null; if (typeof saveGame === 'function') saveGame(); },   // what went in is kept, even if the tab closes now
  update() {
    LOT_update(); const dt = LOT_UI.rdt; LOT_ST.openT += dt; LOT_ST.bump = Math.max(0, LOT_ST.bump - dt); if (LOT_ST.tabFlash) LOT_ST.tabFlash.k -= dt;
    if (Math.random() < dt * 6) LOT_ST.motes.push({ x: (Math.random() - .5) * 22, y: 0, vy: 8 + Math.random() * 10, t: 0, max: .8 + Math.random() * .8, c: Math.random() < .3 ? '#fff0b0' : '#ffb040' });
    for (let i = LOT_ST.motes.length - 1; i >= 0; i--) { const m = LOT_ST.motes[i]; m.t += dt; m.y += m.vy * dt; m.x += Math.sin(m.t * 5 + i) * 4 * dt; if (m.t > m.max) LOT_ST.motes.splice(i, 1); }
    if (game.input.pressed('map')) { LOT_ST.tab = (LOT_ST.tab + 1) % LOT_STASH_TABS; sfx('select', { vol: .4 }); }
  },
  wheel(d) { LOT_ST.tab = (LOT_ST.tab + (d > 0 ? 1 : LOT_STASH_TABS - 1)) % LOT_STASH_TABS; sfx('select', { vol: .3 }); },
  draw(g, x, y, w, hh) {
    const h = ED.hero; if (!h) return; LOT_begin(this, x, y, w, hh);
    const S = LOT_stash(h), pad = 7, top = y + 19, lw = Math.floor((w - pad * 2 - 8) * .5), rx = x + pad + lw + 8, rw = x + w - pad - rx, foot = y + hh - 10, tiny = { font: 'tiny', outline: false };
    // the chest, its name, what it holds
    const u = clamp(LOT_ST.openT / .45, 0, 1), open = clamp(E.ease.outBack(u) + Math.sin(Math.min(1, LOT_ST.bump / .35) * Math.PI) * .25, 0, 1.2);
    E.ui.box(g, x + pad, top, 42, 36, { bg: ['#2a1c14', '#0e0806'], border: '#5a4030', shadow: false });
    LOT_chestDraw(g, x + pad + 4, top + 3, open);
    const nx = x + pad + 48;
    E.font.text(g, 'THE STASH', nx, top + 1, GOLD, { outline: false, shadow: '#05040a' });
    const total = S.tabs.reduce((a, T, t) => a + LOT_stashCount(S, t), 0);
    E.font.text(g, total + ' / ' + LOT_STASH_TABS * LOT_STASH_N + ' KEPT  •  SAFE BETWEEN DESCENTS', nx, top + 11, '#8a80a8', tiny);
    E.font.text(g, 'MATERIALS', nx, top + 21, '#9a90b0', tiny); LOT_matsRow(g, nx + 40, top + 21, h);
    // the tabs (an item dragged onto one goes into it)
    const ty = top + 40, tw = Math.floor((lw - 6) / LOT_STASH_TABS);
    for (let t = 0; t < LOT_STASH_TABS; t++) {
      const tx = x + pad + t * (tw + 2), n = LOT_stashCount(S, t), fl = LOT_ST.tabFlash && LOT_ST.tabFlash.t === t && LOT_ST.tabFlash.k > 0;
      if (LOT_UI.active) LOT_UI.targets.push({ x: tx, y: ty, w: tw, h: 12, kind: 'stashTab', tab: t });
      LOT_tabBtn(g, tx, ty, tw, ['I', 'II', 'III', 'IV'][t] + '  ' + n, LOT_ST.tab === t, () => { LOT_ST.tab = t; }, 'st' + t);
      if (fl) px.blend(g, LOT_ST.tabFlash.k, 'add', () => px.rect(g, tx + 1, ty + 1, tw - 2, 10, '#ffd36a'));
    }
    // the grid of the open tab
    const gy = ty + 15, cols = 8, rows = LOT_STASH_N / cols, CS = clamp(Math.min(Math.floor(lw / cols), Math.floor((foot - 3 - gy) / rows)), 14, 26), gx = x + pad + Math.floor((lw - CS * cols) / 2), T0 = LOT_ST.tab;
    E.ui.box(g, gx - 2, gy - 2, CS * cols + 3, CS * rows + 3, { bg: ['#1a1410', '#0a0806'], border: '#3a2c20', shadow: false });
    for (let i = 0; i < LOT_STASH_N; i++) {
      const it = S.tabs[T0][i], cx = gx + (i % cols) * CS, cy = gy + Math.floor(i / cols) * CS;
      LOT_itemCell(g, cx, cy, CS - 1, it, { key: 'stash:' + T0 + ':' + i, target: { kind: 'stash', tab: T0, i }, cmp: true, seam: 1,
        click: () => LOT_fromStash(h, T0, i), alt: () => LOT_stashWear(h, T0, i), drop: T => LOT_stashDrop(h, T0, i, T), tipO: { hint: LOT_hints(h, 'stashed') } });
    }
    // the bag, on the right: a click stores
    LOT_shopBag(g, rx, top, rw, foot - 4, h, { kind: 'stash', select: it => LOT_toStash(h, it) }, false, false);
    E.font.text(g, 'CLICK MOVES BETWEEN BAG AND STASH  •  DRAG PLACES  •  RIGHT-CLICK WEARS  •  TAB: NEXT TAB', x + w / 2, foot + 1, '#5a5478', { align: 'center', font: 'tiny', outline: false });
    LOT_end(g);
  } };

/* the loot panels' state for tests and tools (window.__edLoot is started in 41-loot.js) */
Object.assign(window.__edLoot, { ui: LOT_UI, shop: LOT_SHOP, smith: LOT_SMITH, mystic: LOT_MYST, stashUI: LOT_ST, stash: () => LOT_stash(ED.hero), toStash: (it, t, i) => LOT_toStash(ED.hero, it, t, i), fromStash: (t, i, j) => LOT_fromStash(ED.hero, t, i, j), salvage: it => LOT_salvage(ED.hero, it), yield: LOT_yield, imprint: (it, id) => LOT_imprint(ED.hero, it, id),
  /** put on a legendary with power id, or the unique id: __edLoot.wear('emberwheel') */
  wear(id) { const h = ED.hero, d = Math.max(1, h.maxDepth || 1), pw = REG.powers[id], it = REG.uniques[id] ? makeItem({ unique: id, ilvl: d }) : pw ? makeItem({ rarity: 3, power: id, slot: (pw.slots && pw.slots[0]) || 'weapon', ilvl: d }) : null; if (!it) return null; h.bag.push(it); equip(h, it, LOT_slotFor(h, it)); return it.name; } });
