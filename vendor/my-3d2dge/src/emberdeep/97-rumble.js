/* =============================================================================
 * RUMBLE: a controller feels what the screen shows (the engine's input.rumble, scaled by game.settings.rumble: the
 * Vibration slider in Controls, saved by the engine). Every screen shake rumbles in proportion (explosions, slams,
 * meteors, an execution), and the hero's own moments have their own: a blow taken (harder the more life it took), a
 * perfect dodge, an elite's or a boss's fall, a level up, his death. Nothing happens without a controller that can.
 * Turning Shake off in Settings leaves the hero's own moments. Private names start with RMB_.
 * ============================================================================= */
const RMB_ = { hitT: 0 };
{ const s0 = game.shake.bind(game); game.shake = n => { s0(n); if (n >= 1.5) game.input.rumble(Math.min(1, n / 8), Math.min(.4, .06 + n * .02)); }; }   // (after 01-tune.js's own wrap)
BUS.on('hurt', e => { const h = e.tgt; if (h && h === ED.hero && e.dmg > 0) game.input.rumble(.25 + .75 * Math.min(1, e.dmg / (h.maxHp * .25)), .12); });
BUS.on('hit', e => { if (e.hit && e.hit.crit && e.src === ED.hero && game.time - RMB_.hitT > .1) { RMB_.hitT = game.time; game.input.rumble(.18, .05); } });   // a crit ticks (ten a second at most)
BUS.on('perfectDodge', () => game.input.rumble(.35, .1));
BUS.on('kill', e => { const m = e.tgt; if (m && m.team === 'foe' && m.elite && !m.boss) game.input.rumble(.5, .16); });
BUS.on('bossDown', () => game.input.rumble(1, .6));
BUS.on('heroLevel', () => game.input.rumble(.3, .2));
BUS.on('heroDie', () => game.input.rumble(.9, .45));
