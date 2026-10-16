/* =============================================================================
 * TIPS: one-time hints, each shown once per save (h.tips), at the moment it matters
 * A tip never talks over a title: it waits for the level card to fade, for a boss's name card to pass and for a
 * boss's fall to be seen (its column of light, its chest). A dead hero gets none: the death screen is his.
 * ============================================================================= */
let TIP_hold = 0;   // game.real until which tips wait (a boss's roar and name card, a boss's fall)
function tip(id, text, color = '#bff6ff', dur = 5) {
  const h = ED.hero; if (!h || ED.demo || (h.bot && !ED.demo && BOT_RUN.on) || !h.alive || h.dead) return;   // (a tip put off is not spent: it can come later)
  h.tips = h.tips || []; if (h.tips.includes(id)) return;
  // a boss that just fell holds them too: its kill hands out the level-ups (and their tip) before 'bossDown' is heard
  const B = ED.boss, fell = B && !B.alive ? 3 - (game.real - (B._tipFellAt || (B._tipFellAt = game.real))) : 0;
  const wait = Math.max(UI.cardT, TIP_hold - game.real, UI.modal ? 1 : 0, fell);
  if (wait > 0) { game.after(wait + .6, () => tip(id, text, color, dur)); return; }   // never over the level card or a boss card, never lost in a panel
  h.tips.push(id); notify(text, color, dur);
}
BUS.on('bossWake', () => { TIP_hold = game.real + 4.2; });
BUS.on('bossDown', () => { TIP_hold = Math.max(TIP_hold, game.real + 3); });   // the kill, the column and the chest read first
BUS.on('kill', e => { if (e.tgt && e.tgt.boss && !e.tgt._tipFellAt) e.tgt._tipFellAt = game.real; });   // (the hold above counts from the fall itself)
BUS.on('levelStart', e => {
  if (e.L.depth === 1) game.after(6.5, () => tip('roll', 'SPACE ROLLS THROUGH ATTACKS  •  ROLL JUST AS A BLOW LANDS AND TIME SLOWS'));
  if (e.L.depth === 1) game.after(14, () => tip('exit', 'THE WAYSTONE AT THE FAR END TAKES YOU DEEPER  •  T OPENS A PORTAL HOME'));
  if (e.L.depth === 2 && OPT.labels > 0) game.after(20, () => tip('filter', 'PLAIN ITEMS ARE HIDDEN  •  HOLD Z TO SEE ALL LOOT  •  THE FILTER IS IN SETTINGS', '#d8d0c0'));
});
BUS.on('hurt', e => { const h = ED.hero; if (h && h.alive && !h.dead && h.hp > 0 && h.hp < h.maxHp * .45 && h.potions > 0) tip('potion', 'Q DRINKS A POTION  •  POTIONS REFILL IN TOWN AND DROP FROM MONSTERS', '#ff9aa8'); });
BUS.on('heroLevel', () => tip('points', 'LEVEL UP!  K SPENDS SKILL POINTS  •  P OPENS THE PASSIVE TREE', '#ffe070', 6));
// the loot tips (the bag, a first legendary) live with the loot, in 41-loot.js
BUS.on('spawn', e => { if (e.m.elite === 2 && ED.mode === 'level') game.after(1, () => tip('elite', 'GOLD NAMES ARE RARE ELITES: EXTRA AFFIXES, EXTRA LOOT', '#ffd36a')); });
BUS.on('perfectDodge', () => tip('perfect', 'PERFECT DODGE: A ROLL THROUGH A STRIKE SLOWS TIME', '#8fe3ff'));
