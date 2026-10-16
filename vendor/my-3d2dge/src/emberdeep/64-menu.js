/* =============================================================================
 * SETTINGS: one window for everything the game can change, its pages listed down the side.
 *   Game      Graphics, Sound, Interface, Controls
 *   Playtest  Difficulty (the quick multipliers), Tools (the switches, travel, spawning, build experiments, recording:
 *             62-developer.js)
 *   Tuning    the game's rule numbers (01-tune.js), a page per section
 *   Help      every key, where to change what, the version and the labs
 * The search box finds a setting on any page. The page last open comes back next time. Opened from the title and the
 * pause menu, or UI.open('settings', { tab }); menuGo(tab, knob) jumps to one setting. The pages are HTML (the form
 * helpers of 61-controls.js), driven by mouse, touch, keys and a pad (updateForm).
 * ============================================================================= */
const MENU_GROUPS = [
  ['Game', [['graphics', 'Graphics'], ['sound', 'Sound'], ['interface', 'Interface'], ['controls', 'Controls']]],
  ['Playtest', [['difficulty', 'Difficulty'], ['tools', 'Tools']]],
  ['Tuning', TUNE_SECTIONS.map(S => [S.id, S.name])],
  ['Help', [['help', 'Keys & help']]]
];
const MENU_TABS = MENU_GROUPS.flatMap(([, tabs]) => tabs);
const menuTabName = id => (MENU_TABS.find(t => t[0] === id) || [id, id])[1];

/* ---------- the pieces a page is made of ---------- */
/** a setting: its name, the key that does it in play, what it does; the control goes in its head (a switch) or under it */
function menuSetting(el, label, about, keys) {
  const row = formElement('div', '', el, { class: 'ed-set' }), head = formElement('div', '', row, { class: 'ed-set-head' });
  formElement('span', label, head, { class: 'ed-set-name' });
  if (keys) formElement('kbd', keys, head, { title: 'In play' });
  if (about) formElement('p', typeof about === 'function' ? about() : about, row, { class: 'ed-about' });
  return row;
}
/** one button per choice ([value, label, tip]), the chosen one pressed */
function menuSeg(row, label, options, cur, pick) {
  const seg = formElement('div', '', row, { class: 'ed-seg ed-seg-wrap', role: 'group', 'aria-label': label });
  for (const [v, t, tip] of options) {
    const b = formButton(seg, t, () => { pick(v); menuRender(); });
    b.setAttribute('aria-pressed', String(v === cur)); if (tip) b.title = tip;
  }
}
/** a switch in the setting's head */
function menuSwitch(row, label, on, set, disabled) {
  const b = formElement('input', '', row.querySelector('.ed-set-head'), { type: 'checkbox', 'aria-label': label });
  b.checked = !!on; b.disabled = !!disabled; b.onchange = () => { set(b.checked); menuRender(); };
}
/** a slider with its value beside it */
function menuSlider(row, label, v, min, max, step, fmt, set) {
  const ctl = formElement('div', '', row, { class: 'ed-knob-ctl' });
  const r = formElement('input', '', ctl, { type: 'range', min, max, step, 'aria-label': label }), out = formElement('output', fmt(v), ctl, { class: 'ed-val' });
  r.value = v; r.oninput = () => { set(+r.value); out.textContent = fmt(+r.value); };
}

/* ---------- the camera and the picture ---------- */
const CAM_ZOOM = 1.25;   // the game's own zoom (OPT_DEFAULT.zoom)
function setCamZoom(z) { game.setZoom(z); OPT.zoom = z; saveOpts(); }
/** the game's own camera again: its zoom (kept), no turn */
function resetCamera() { game.resetCamera(); setCamZoom(CAM_ZOOM); }
/* pixel size: how many screen pixels make one game pixel. Large is the game's own sizing (BASE: the biggest whole
   number that still shows 320 x 220 game pixels); Medium and Small take three quarters and half of that, never under
   two CSS pixels a game pixel (smaller would make the text unreadable: a phone keeps Large). Smaller pixels show more
   of the world and cost more to draw. It is worked out again whenever the window changes */
const PIXELS = [['Large', 1], ['Medium', .75], ['Small', .5]], PIX = { key: '' };
function applyPixels() {
  const sc = game.screen, dpr = sc.dpr, rc = canvas.getBoundingClientRect(), pw = Math.round(rc.width * dpr), ph = Math.round(rc.height * dpr);
  if (!pw || !ph) return;
  const base = Math.max(1, Math.min(Math.floor(ph / BASE.minH), Math.floor(pw / BASE.minW))), k = (PIXELS[OPT.pixels] || PIXELS[0])[1];
  const S = Math.min(base, Math.max(Math.ceil(2 * dpr), Math.round(base * k)));
  const o = S >= base ? { minH: BASE.minH, minW: BASE.minW, maxW: BASE.maxW, maxH: BASE.maxH, portrait: BASE.portrait }
    : { minH: Math.floor(ph / S), minW: Math.floor(pw / S), maxW: Math.ceil(pw / S), maxH: Math.ceil(ph / S), portrait: { maxH: Math.ceil(ph / S) } };
  const key = JSON.stringify(o); if (key === PIX.key) return;
  PIX.key = key; sc.setOptions(o);
}
addEventListener('resize', applyPixels);   // after the engine's own resize (registered first): the size it chose, then ours
const pixelsNow = () => { const sc = game.screen; return 'Now ' + Math.round(sc.S / sc.dpr * 100) / 100 + ' screen pixels to a game pixel, ' + sc.W + ' × ' + sc.H + ' game pixels.'; };
const gpuState = () => { const s = game.gpu ? game.gpu.status() : null; return s === 'unavailable' ? 'WebGPU is not available in this browser.' : s === 'loading' ? 'Starting…' : ''; };

/* ---------- the settings of Graphics, Sound and Interface: data, so the search finds them too ----------
 * { page, group, label, keys, about (text or a function), ctl(row, label): the control, show(): whether it applies
 *   here } or { page, group, knob: a tuning knob's id (01-tune.js), drawn as the tuning pages draw it } */
const MENU_SET = [
  { page: 'graphics', group: 'Camera', label: 'View', keys: 'V', about: 'Where the camera looks from. Kept for your next visit.', ctl: (row, l) => menuSeg(row, l, VIEW_IDS.map(id => [id, E.VIEWS[id].label, VIEW_TIPS[id]]), game.baseView.id, chooseView) },
  { page: 'graphics', group: 'Camera', label: 'Camera zoom', keys: '- and =, the wheel', about: 'Closer or farther; 1.25× is the game\'s own. Characters and objects redraw sharp at any zoom, but the floor and walls are scaled, so above 1.25× they look blockier. Kept for your next visit.', ctl: (row, l) => menuSeg(row, l, ZOOMS.map(z => [z, z + '×' + (z === CAM_ZOOM ? ' (default)' : '')]), OPT.zoom, setCamZoom) },
  { page: 'graphics', group: 'Camera', label: 'Camera turn', keys: '[ and ]', about: 'Turns the camera around the hero in 45° steps. Not kept after a reload.', ctl: (row, l) => menuSeg(row, l, [0, 45, 90, 135, 180, 225, 270, 315].map(d => [d, d + '°']), game.yaw || 0, d => game.rotateView(d - (game.yaw || 0))) },
  { page: 'graphics', group: 'Camera', label: 'Reset the camera', keys: '0', about: 'Back to the game\'s own camera: 1.25× zoom, no turn.', ctl: row => formButton(row, 'Reset the camera', () => { resetCamera(); formStatus('The camera is back to 1.25×, no turn.'); }) },
  { page: 'graphics', group: 'Camera', knob: 'camSmooth' },
  { page: 'graphics', group: 'Camera', knob: 'camLead' },
  { page: 'graphics', group: 'Picture', label: 'Pixel size', about: () => 'How big a game pixel is on your screen. Large is the classic look; Medium and Small draw finer pixels and show more of the world, and cost more to draw. A phone keeps Large, so the text stays readable. ' + pixelsNow(), ctl: (row, l) => menuSeg(row, l, PIXELS.map(([t], i) => [i, t + (i ? '' : ' (default)')]), OPT.pixels || 0, v => { OPT.pixels = v; saveOpts(); applyPixels(); }) },
  { page: 'graphics', group: 'Picture', label: 'Frame rate', about: 'Auto: every refresh while the game keeps up, every other one, evenly, when it can\'t. 60: every other refresh on a 120 Hz screen. Full: every refresh.', ctl: (row, l) => menuSeg(row, l, [['auto', 'Auto'], ['60', '60'], ['full', 'Full']], game.settings.frameRate, v => game.settings.set('frameRate', v)) },
  { page: 'graphics', group: 'Picture', label: 'Full screen', show: () => FS.can(), about: 'The game fills the whole screen. A phone goes full screen from the title\'s first tap unless you leave it.', ctl: (row, l) => menuSwitch(row, l, FS.on(), () => FS.toggle()) },
  { page: 'graphics', group: 'Light', label: 'GPU lighting', about: () => 'Light and shadow worked out per pixel on the graphics card (WebGPU): smoother falloff and colored light. ' + gpuState(), ctl: (row, l) => menuSwitch(row, l, OPT.gpu, v => { OPT.gpu = v; if (game.gpu) game.gpu.enabled = v; saveOpts(); }, game.gpu && game.gpu.status() === 'unavailable') },
  { page: 'graphics', group: 'Light', label: 'Full lighting', about: 'No darkness: every place lit evenly, to see a level whole. Torches, glows and the minimap\'s fog stay.', ctl: (row, l) => menuSwitch(row, l, OPT.fullLight, v => { OPT.fullLight = v; saveOpts(); }) },
  { page: 'graphics', group: 'Light', knob: 'ambient' },
  { page: 'graphics', group: 'Effects', label: 'Outlines', about: 'A dark line around every character and monster, so they read against the floor.', ctl: (row, l) => menuSwitch(row, l, OPT.outlines !== false, v => { OPT.outlines = v; saveOpts(); }) },
  { page: 'graphics', group: 'Effects', label: 'Particles', about: 'How many sparks, embers and dust motes can be alive at once: 500, 1,000 or 1,600.', ctl: (row, l) => menuSeg(row, l, [[0, 'Low'], [1, 'Medium'], [2, 'High (default)']], OPT.fx === undefined ? 2 : OPT.fx, v => { OPT.fx = v; P.max = [500, 1000, 1600][v]; saveOpts(); }) },
  { page: 'graphics', group: 'Effects', label: 'Screen shake', about: 'The screen shakes with big hits, explosions and bosses.', ctl: (row, l) => menuSwitch(row, l, OPT.shake, v => { OPT.shake = v; saveOpts(); }) },
  { page: 'graphics', group: 'Effects', knob: 'shake' },
  { page: 'graphics', group: 'Effects', label: 'Screen flashes', about: 'The flash that lights the screen on a death, a boss\'s rage, a big spell. 0 turns them off.', ctl: (row, l) => menuSlider(row, l, game.settings.flashes, 0, 1, .1, v => Math.round(v * 100) + '%', v => game.settings.set('flashes', v)) },
  { page: 'graphics', group: 'Effects', label: 'Reduce motion', about: 'No screen shake, and shorter flashes. It starts on when your system asks for reduced motion.', ctl: (row, l) => menuSwitch(row, l, game.reduceMotion, v => game.settings.set('motion', v)) },
  { page: 'graphics', group: 'Effects', label: 'Skip off-screen animation', about: 'Monsters out of sight are not posed every frame: faster with a big crowd, and a monster takes up its pose as it comes into view.', ctl: (row, l) => menuSwitch(row, l, OPT.lod, v => { OPT.lod = v; saveOpts(); }) },
  { page: 'graphics', group: 'Effects', label: 'Automatic quality', about: () => 'When frames run long, ordinary monsters lose their outlines and particles are capped until there is room again. ' + (PERF.low ? 'Reduced now: frames have been running long.' : 'Full quality now.'), ctl: (row, l) => menuSwitch(row, l, OPT.autoQuality !== false, v => { OPT.autoQuality = v; saveOpts(); if (!v) perfRestore(); }) },
  { page: 'graphics', group: 'Overlays', label: 'Frame rate and timings', about: 'At the top of the screen: frames a second, the update\'s and the drawing\'s cost, and how many monsters are alive.', ctl: (row, l) => menuSwitch(row, l, OPT.perfOverlay, v => { OPT.perfOverlay = v; saveOpts(); }) },
  { page: 'graphics', group: 'Overlays', label: 'Collision circles', about: 'The circle every body collides with: yours blue, the monsters\' red.', ctl: (row, l) => menuSwitch(row, l, OPT.hitboxes, v => { OPT.hitboxes = v; saveOpts(); }) },
  { page: 'sound', group: 'Volume', label: 'Master volume', about: 'Everything at once; music and effects are mixed under it.', ctl: (row, l) => menuSlider(row, l, game.settings.volume, 0, 1, .05, v => Math.round(v * 100) + '%', v => game.settings.set('volume', v)) },
  { page: 'sound', group: 'Volume', label: 'Music', ctl: (row, l) => menuSlider(row, l, OPT.music, 0, 1, .1, v => Math.round(v * 10) + ' / 10', v => { OPT.music = v; saveOpts(); applyAudioOpts(); }) },
  { page: 'sound', group: 'Volume', label: 'Sound effects', ctl: (row, l) => menuSlider(row, l, OPT.sfx, 0, 1, .1, v => Math.round(v * 10) + ' / 10', v => { OPT.sfx = v; saveOpts(); applyAudioOpts(); }) },
  { page: 'sound', group: 'Volume', label: 'Mute', keys: 'M', about: 'Silences everything. Not kept after a reload.', ctl: (row, l) => menuSwitch(row, l, A.muted, v => A.mute(v)) },
  { page: 'sound', group: 'Volume', label: 'Sound in the background', about: 'Keep playing sound while the page is hidden (another tab, the phone locked).', ctl: (row, l) => menuSwitch(row, l, game.settings.background, v => game.settings.set('background', v)) },
  { page: 'interface', group: 'Combat', label: 'Damage numbers', about: 'The numbers that rise from every hit.', ctl: (row, l) => menuSwitch(row, l, OPT.numbers, v => { OPT.numbers = v; saveOpts(); }) },
  { page: 'interface', group: 'Combat', label: 'Health bars', about: 'Bars over hurt monsters and elites (a boss always has its own bar).', ctl: (row, l) => menuSwitch(row, l, OPT.bars, v => { OPT.bars = v; saveOpts(); }) },
  { page: 'interface', group: 'Loot', label: 'Loot labels', keys: 'Z shows all while held', about: 'Which items on the ground show their names.', ctl: (row, l) => menuSeg(row, l, [[0, 'All'], [1, 'Magic and better'], [2, 'Rare and better']], OPT.labels, v => { OPT.labels = v; saveOpts(); }) },
  { page: 'interface', group: 'Screen', label: 'Hide the HUD', keys: 'H', about: 'The orbs, the skill bar, the minimap and the notices go, for screenshots. Not kept after a reload.', ctl: (row, l) => menuSwitch(row, l, UI.hideHud, v => { UI.hideHud = v; }) },
  { page: 'interface', group: 'Screen', label: 'Tips', about: 'Each hint shows once per hero, at the moment it matters.', ctl: row => formButton(row, 'Show the tips again', () => { if (ED.hero) ED.hero.tips = []; formStatus('The tips will show again as they come up.'); }) }
];
/** a page's settings, grouped under their headings */
function menuSettings(el, list) {
  let group = null;
  for (const it of list) {
    if (it.show && !it.show()) continue;
    if (it.group !== group) { group = it.group; formElement('h4', group, el); }
    if (it.knob) { const K = tuneKnob(it.knob); if (K) devKnobRow(el, K); continue; }
    it.ctl(menuSetting(el, it.label, it.about, it.keys), it.label);
  }
}
const menuSetText = it => it.knob ? (K => K ? K.label + ' ' + K.about : '')(tuneKnob(it.knob)) : it.label + ' ' + (typeof it.about === 'function' ? it.about() : it.about || '') + ' ' + (it.keys || '');

/* ---------- the pages ---------- */
const MENU_INTRO = {
  graphics: 'How the game looks: the camera, the picture, light and effects. Changes show at once behind this window and are kept for your next visit.',
  sound: 'Music and sound effect volumes.',
  interface: 'What the screen shows over the game.',
  difficulty: 'Quick multipliers for playtesting, 0.25× to 4×: drag a bar, use the arrow keys, or type a value (1.4 is 140%). Green is easier than the shipped game, red is harder.'
};
function difficultyPage(el) {
  const ez = Math.round(DIFF_ROWS.reduce((a, [k, , , up]) => a + Math.log2(DIFF[k] || 1) * up, 0) * 2);   // a one-glance summary: how far from the default, and which way
  formElement('p', ez ? (ez > 0 ? 'Easier' : 'Harder') + ' than the shipped game.' : 'As the shipped game.', el, { class: 'ed-meta' });
  for (const [k, label, about, up] of DIFF_ROWS) {
    const v = DIFF[k], easy = (v - 1) * up, row = formElement('div', '', el, { class: 'ed-knob' + (v !== 1 ? ' ed-changed' : '') });
    const head = formElement('div', '', row, { class: 'ed-knob-head' });
    formElement('label', label, head, { for: 'diff-' + k });
    formElement('output', +v.toFixed(2) + '×', head, { class: 'ed-val' + (v === 1 ? '' : easy > 0 ? ' ed-easy' : ' ed-hard') });
    formElement('p', about, row, { class: 'ed-about' });
    const ctl = formElement('div', '', row, { class: 'ed-knob-ctl' });
    // a log scale: 1x in the middle, 0.25x and 4x at the ends
    const r = formElement('input', '', ctl, { type: 'range', id: 'diff-' + k, min: -2, max: 2, step: .01, 'aria-label': label });
    r.value = Math.log2(v);
    const num = formElement('input', '', ctl, { type: 'number', min: .25, max: 4, step: .01, 'aria-label': label + ' value' });
    num.value = v;
    const rb = formButton(ctl, '↺', () => { setDiff(k, 1); menuRender(); });
    rb.setAttribute('aria-label', 'Reset ' + label); rb.title = 'Back to 1×';
    r.oninput = () => { setDiff(k, Math.pow(2, +r.value)); head.querySelector('output').textContent = +DIFF[k].toFixed(2) + '×'; num.value = DIFF[k]; };
    r.onchange = () => menuRender();   // (drawn again on release: the colors and the summary; a redraw mid-drag would drop the bar)
    num.onchange = () => { const n = parseFloat(num.value); if (isFinite(n) && n > 0) setDiff(k, n); menuRender(); };
  }
  formButton(formElement('div', '', el, { class: 'ed-row' }), 'Reset difficulty', () => { settingsReset(); menuRender(); formStatus('Difficulty is back to the shipped game.'); });
}
/** every key, as bound now (Controls changes them), and the ones fixed to the keyboard */
function helpPage(el) {
  devSection(el, 'Keys', 'As bound now; Controls changes them. The camera, sound and screen keys are fixed.');
  const t = formElement('div', '', el, { class: 'ed-keys' });
  const key = (what, keys) => { formElement('span', what, t); formElement('kbd', keys, t); };
  for (const [a, label] of CONTROL_ACTIONS) key(label, actionLabel(a) || 'Unbound');
  key('Menu', 'Esc');
  key('Settings: the next or previous page', 'LB / RB on a pad');
  for (const [what, keys] of [['Change the view', 'V'], ['Zoom out / in', '- / ='], ['Turn the camera', '[ / ]'], ['Reset the camera', '0'], ['Mute', 'M'], ['Hide the HUD', 'H']]) key(what, keys);
  devGuide(el);
  devSection(el, 'This build', null);
  formElement('p', 'Emberdeep on my-3D2dge ' + E.versionLabel(), el, { class: 'ed-meta ed-version' });   // the release and the commit it was built from
  formButton(el, 'All labs ↗', () => location.assign('labs.html')).title = 'The Labs page: every lab, test page and demo';
}
/** the search's results: matching settings on every page, then the tuning's knobs and inspectors */
function menuSearch(el, q) {
  let n = 0;
  for (const [id, name] of MENU_TABS) {
    const list = MENU_SET.filter(it => it.page === id && (!it.show || it.show()) && menuSetText(it).toLowerCase().includes(q));
    if (!list.length) continue;
    formElement('h3', name, el); menuSettings(el, list); n += list.length;
  }
  for (const [k, label, about] of DIFF_ROWS) if ((label + ' ' + about + ' difficulty').toLowerCase().includes(q)) { formElement('h3', 'Difficulty', el); formButton(el, label + ' →', () => menuGo('difficulty')); n++; break; }
  n += devSearch(el, q);
  if (!n) formElement('p', 'Nothing matches. Try a simpler word (zoom, light, speed, life, drop, boss...), or ask Claude where it lives.', el, { class: 'ed-dev-blurb' });
}

/* ---------- the window ---------- */
function menuOpen(data) {
  if (data && data.tab) DEV_UI.tab = data.tab;
  if (!MENU_TABS.some(t => t[0] === DEV_UI.tab)) DEV_UI.tab = 'graphics';
  DEV_UI.find = '';
  openForm('Settings', el => {
    el.classList.add('ed-menu');
    formElement('p', '', el, { 'data-status': '', role: 'status', class: 'ed-status' });
    const find = formElement('input', '', el, { type: 'search', placeholder: 'Find a setting…', 'aria-label': 'Find a setting', class: 'ed-find' });
    find.oninput = () => { DEV_UI.find = find.value; menuRender(); };
    const body = formElement('div', '', el, { class: 'ed-menu-body' }), nav = formElement('nav', '', body, { class: 'ed-menu-nav', 'aria-label': 'Pages' });
    for (const [group, tabs] of MENU_GROUPS) {
      formElement('h4', group, nav);
      const list = formElement('div', '', nav, { role: 'tablist', 'aria-label': group, 'aria-orientation': 'vertical' });
      for (const [id, name] of tabs) {
        const b = formButton(list, '', () => menuGo(id));
        b.dataset.tab = id; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', name);
        formElement('span', name, b); formElement('span', '', b, { class: 'ed-badge' });
      }
    }
    formElement('section', '', body, { class: 'ed-tab-body', role: 'tabpanel' });
  });
  menuRender();
}
/** draw the open page again (after a change, a search, a new page) */
function menuRender() {
  const el = FORM.el, body = el && el.querySelector('.ed-tab-body');
  if (!body) return;
  const tab = DEV_UI.tab, q = DEV_UI.find.trim().toLowerCase();
  for (const b of el.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(!q && b.dataset.tab === tab));
  el.classList.toggle('ed-see', tab === 'graphics' && !q);   // the game shows through around the window while its look changes
  const y = body.scrollTop; body.textContent = '';
  if (q) { formElement('h3', 'Results for “' + DEV_UI.find.trim() + '”', body); menuSearch(body, q); }
  else {
    formElement('h3', menuTabName(tab), body, { class: 'ed-page-title' });
    if (MENU_INTRO[tab]) formElement('p', MENU_INTRO[tab], body, { class: 'ed-dev-intro' });
    if (tab === 'difficulty') difficultyPage(body);
    else if (tab === 'controls') controlsPage(body);
    else if (tab === 'tools') devToolsPage(body);
    else if (tab === 'help') helpPage(body);
    else if (TUNE_SECTIONS.some(S => S.id === tab)) devTuneTab(body, tab);
    else menuSettings(body, MENU_SET.filter(it => it.page === tab));
  }
  body.scrollTop = DEV_UI.flash ? 0 : y;
  devBadges();
}
/** open a page (and flash one tuning knob on it) */
function menuGo(tab, knobId) {
  const changed = tab !== DEV_UI.tab;
  DEV_UI.tab = tab; E.store.set('ed:menu:tab', tab);
  DEV_UI.find = ''; const f = FORM.el && FORM.el.querySelector('.ed-find'); if (f) f.value = '';
  DEV_UI.flash = knobId || null;
  if (knobId) { const K = tuneKnob(knobId); if (K && K.tier === 2) DEV_UI.tier = 2; }
  const body = FORM.el && FORM.el.querySelector('.ed-tab-body'); if (body && changed) body.scrollTop = 0;
  menuRender();
  if (knobId && FORM.el) { const r = FORM.el.querySelector('[data-knob="' + knobId + '"]'); if (r) r.scrollIntoView({ block: 'center' }); }
  DEV_UI.flash = null;
}
/** the window's step: a pad's shoulder buttons (LB, RB) turn the page and put the focus on its first setting, so a
 *  pad needn't walk the list of pages; the rest is every window's (updateForm: up, down, change, confirm, back) */
const MENU_PAD = { prev: [] };
function menuUpdate() {
  const now = game.input.padPrev || [], was = MENU_PAD.prev;
  if (!FORM.capture) for (const [b, d] of [[4, -1], [5, 1]]) if (now[b] && !was[b]) {
    const i = MENU_TABS.findIndex(t => t[0] === DEV_UI.tab);
    menuGo(MENU_TABS[(i + d + MENU_TABS.length) % MENU_TABS.length][0]);
    const f = FORM.el && FORM.el.querySelector('.ed-tab-body button, .ed-tab-body input, .ed-tab-body select'); if (f) f.focus();
  }
  MENU_PAD.prev = now.slice();
  updateForm();
}
UI.def('settings', { dom: true, captureKeys: true, open: menuOpen, close: closeForm, update: menuUpdate });
// full screen comes and goes over an open window: bring the window back on top of it
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => { const el = FORM.el; if (el && el.open) { el.close(); el.showModal(); } });
