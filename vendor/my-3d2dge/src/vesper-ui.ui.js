// Vesper's interface rebuilt on E.Shell: the title, the HUD (objective and distance, status, health, awareness, seals,
// the hold-to-interact prompt, the parry tip, the district name, the control bar, the minimap), toasts, the tutorial
// card, pause, settings, help, the district map with a waypoint, and the results. Vesper wrote these by hand in 15.2k
// tokens of HTML, CSS and glue; this file is all of it here (the lab's question: does it come to a quarter?).
const PAPER = 'rgba(12,24,27,.86)';
const ui = new E.Shell(game, {
  theme: { ink: '#f2ead6', paper: PAPER, accent: '#d9b77c', muted: '#9fb2a8', line: 'rgba(184,206,190,.22)', titleFont: 'Georgia, serif' }, store: 'vesper-ui-settings',
  settings: { items: ['sound', 'volume', 'motion', { key: 'cones', label: 'Sight cones', value: true }, { key: 'contrast', label: 'High contrast', value: false }],
    onChange: s => { sim.opts.cones = s.cones; ui.root.style.setProperty('--paper', s.contrast ? '#000' : PAPER); } },
  screens: {
    pause: { kicker: 'The city can wait', text: () => sim.objective().title, actions: () => [sim.checkpoint && ['Return to checkpoint', () => begin(true)], ['Restart contract', () => begin(false)], ['District map', districtMap], ['Title', title]] },
    help: { kicker: 'A courier of the Guild', title: 'Controls & contract',
      keys: [['W A S D', 'Move (the stick on touch)'], ['SPACE', 'Jump, climb, leap a gap'], ['SHIFT', 'Sprint'], ['C', 'Sneak; hide in tall grass'], ['E', 'Hold to interact'], ['M', 'District map'], ['ESC', 'Pause']],
      sections: [['The contract', 'The city will arrest forty-seven citizens at dawn. Read the patrols from the bell tower, steal the ledger from the archive roof, and leave Meridian by boat.'],
        ['The watch', 'Guards see what lies in their cone and not behind a roof. Crouch in tall grass to vanish. Three cipher seals are hidden in the district.']] } } });
sim.opts.cones = ui.settings.cones;
const STEP = { survey: '01', ledger: '02', escape: '03', complete: '04', failed: '—' };
const LABELS = [['THE BELL WARD', 64, 150], ['ARCHIVE', 176, 22], ['LANTERN ROW', 300, 22], ['OLD HARBOUR', 200, 166]];
sim.frozen = () => !!ui.screen;
function title() {
  ui.show('title', { kicker: 'A city of secrets', name: 'VESPER', subtitle: 'The Ninth Bell', meta: ['STEALTH', 'PARKOUR', 'ONE COMPLETE MISSION'], footer: 'The free city of Meridian · the Old Harbour · dusk',
    text: 'Above the streets. Beyond their reach.\n\nThe city will arrest forty-seven citizens at dawn.\nSteal the ledger. Stop the man who signed it.',
    actions: () => [['Enter the district →', () => begin(false)], E.store.get('vesper-ui-cp') && ['Continue from checkpoint', () => begin(true)], ['Controls & mission', () => ui.show('help')]] });
}
function begin(cp) {
  sim.restart(cp); ui.hide(); game.audio.sfx('select');
  if (cp) { ui.toast('Checkpoint restored', sim.objective().title); ui.tutorial('Checkpoint restored', sim.objective().detail, 12); }
  else { ui.toast('Meridian · The Old Harbour', 'Reach the bell tower. The city is still unaware of you.'); ui.tutorial('Take the high route', 'Jump at a wall to climb it, at a gap to leap it. Hold E at a marked place.', 18); }
}
const marks = all => [...sim.seals.filter(s => all && !sim.collected.has(s.id)).map(s => ({ x: s.x, y: s.y, kind: 'diamond', color: '#90cdb5', label: all && 'Cipher seal' })),
  ...sim.guards.filter(g => all || Math.hypot(g.x - sim.player.x, g.y - sim.player.y) < 140).map(g => ({ x: g.x, y: g.y, color: g.mode === 'chase' ? '#f39578' : '#c38870' })),
  sim.objective().marker && Object.assign({ kind: 'ring', color: '#ffe0a0', label: all && sim.objective().title }, sim.objective().marker),
  sim.waypoint && Object.assign({ kind: 'cross', color: '#b7ede2' }, sim.waypoint)].filter(Boolean);
function districtMap() {
  ui.show('map', { kicker: 'The free city of Meridian', title: 'The district', text: sim.objective().title + ' — ' + sim.objective().detail, map: sim.map, at: sim.player, markers: () => marks(true), labels: LABELS,
    onPick: (x, y) => { sim.waypoint = { x, y }; } });
}
function status() {
  const p = sim.player;
  if (p.hidden) return { text: 'HIDDEN', color: '#8fe0cb' };
  if (sim.detected) return { text: 'IN PURSUIT', color: '#f19a7a' };
  if (sim.alert > .2) return { text: 'WATCHED', color: '#efca83' };
  return { text: p.crouch ? 'SNEAKING' : 'UNSEEN', color: '#9ed0b6' };
}
sim.onStep = () => {
  const p = sim.player, o = sim.objective(), st = status(), I = game.input;
  if (I.pressed('map') && !ui.screen) districtMap();
  ui.hud({ objective: { step: STEP[sim.phase] + ' / 03', title: o.title, text: o.detail, at: o.marker, from: p }, status: st,
    bars: [{ value: p.hp, max: p.maxHp, kind: 'pips' }, { label: 'AWARENESS', value: sim.alert, max: 1, color: st.color }], counts: [['CIPHER SEALS', sim.collected.size + ' / 3']],
    prompt: sim.interaction && { key: 'E', label: sim.interaction.label, hint: I.lastDevice === 'touch' ? 'HOLD USE' : 'HOLD TO INTERACT', progress: sim.interaction.progress },
    tip: sim.detected && { title: 'You are seen', text: 'Break the line of sight, or hide crouched in tall grass.' },
    place: p.y < 6 * 16 ? 'The Archive Quarter' : p.x > 18 * 16 ? 'The Bell Ward' : 'The Old Harbour',
    keys: [['W A S D', 'Move'], ['SPACE', 'Parkour'], ['C', 'Sneak'], ['E', 'Interact'], ['M', 'Map']],
    buttons: [['❚❚ Pause', () => { game.paused = true; }], ['Map', districtMap]],
    minimap: { map: sim.map, at: p, markers: marks(false), onClick: districtMap } });
};
sim.on = (type, d = {}) => {
  if (type === 'seal') ui.toast('Cipher seal ' + d.count + ' of 3', d.count === 3 ? 'The Guild will want these.' : 'Two more are hidden in the district.');
  else if (type === 'phase' && d.phase !== 'complete') ui.toast('Objective', sim.objective().title);
  else if (type === 'checkpoint') ui.toast('Checkpoint saved', 'You can return here from the pause menu.');
  else if (type === 'spotted') ui.toast('Spotted', 'A guard has seen you.', 2);
  else if (type === 'complete' || type === 'failed') results(type === 'complete');
};
function results(win) {
  const t = Math.round(sim.time), det = sim.stats.detections, n = sim.collected.size;
  ui.show('results', { emblem: win ? '✦' : '◇', kicker: win ? 'Contract complete' : 'Contract interrupted', title: win ? 'The names are safe.' : 'The watch found you.',
    text: win ? 'The ledger leaves Meridian by sea. Forty-seven citizens will see another dawn.' : sim.failureReason,
    stats: [[Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'), 'MISSION TIME'], [det, 'DETECTIONS'], [n + '/3', 'CIPHER SEALS']],
    medals: [['Unseen', !det], ['All seals', n === 3], ['Under three minutes', win && t < 180]],
    actions: [[win ? 'Play again →' : sim.checkpoint ? 'Return to checkpoint →' : 'Try again →', () => begin(!win && sim.checkpoint)], ['Title', title]] });
}
game.start({ scenes: { play }, scene: 'play' });
title();
