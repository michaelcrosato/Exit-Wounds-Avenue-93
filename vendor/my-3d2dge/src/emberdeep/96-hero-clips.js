/* =============================================================================
 * HERO CLIPS: motion-captured moments the Wanderer plays on his own rig. The clips are the HERO animation set
 * (src/mocap/sets/hero.js: picked from the Quaternius and Mesh2Motion sets by tools/anim-set.mjs, in the readable
 * format; docs/MOCAP.md; each clip's src names its library), each one a moment his procedural animation had no answer for:
 *   death       Death01              he dies: staggers back and falls flat
 *   deathSink   Death_A              worn down (poison, fire, bleeding: the killing blow was a damage-over-time tick):
 *                                    he clutches his chest and sinks down onto his side
 *   deathBlown  Death_B              a crushing blow kills him (a knockdown, a boss, half his life at once): thrown back
 *                                    off his feet (the death panel waits until he is down, whichever fall it is)
 *   rise        LayToIdle            revived (back in town, a retry, the developer's revive): he gets up off the ground
 *   land        Land_Three_Point     he drops in from above (a new depth, the waystone, the first arrival): a three-point
 *                                    landing, one hand on the ground
 *   nod, listen Head Nod,            someone talks to him: he nods, then listens, weight on one leg, a hand on the hip
 *               Idle Listening
 *   wait        Idle_FoldArms_Loop   a shopkeeper serves him: arms folded while he waits
 *   chest       Chest_Open           the stash opens: he turns to it, bends and lifts the lid
 *   stone       Interact             the waystone's panel opens: he turns to it and works it with his hands
 *   pickup      PickUp_Table         loot goes in his bag: a quick reach (upper body only: he keeps walking)
 *   hitChest,   Hit_Chest, Hit_Head  a heavy blow that does not knock him down (over 12% of his life): the upper body
 *   hitHead                          snaps back while his legs take the stagger
 *   victory     Victory              a boss falls: he jumps with a fist raised
 *   levelUp     Victory Fist Pump    he gains a level: a fist pump
 * Mocap.drive retargets a clip onto his rig each step (his build, cape and hair stay his). Moving, rolling, attacking
 * or a flinch takes the body back at once (the clip fades out in a few frames). The two celebrations wait (up to 3 s)
 * for him to stand still, so they never cut into a fight. The gallery's POSES reel shows each one.
 * Codex has his own rig and plays none of them.
 * Hooks: updateHero, townLife and reviveHero are wrapped (the clip is stepped before the rig poses itself);
 * deathPanelDue waits for the fall; the pickup, hurt, heroDie, heroLevel and bossDown events start the rest.
 * ============================================================================= */
const HCL = { lib: typeof Mocap !== 'undefined' && window.MOCAP && window.MOCAP.HERO ? Mocap.load(window.MOCAP.HERO) : null };
// how each moment plays: speed, fade (seconds in and out), mask 'upper' (his legs keep walking), walk (moving does not
// cut it), hold (the last pose stays: he lies where he fell), landed (clip seconds by which a fall is down), at (clip
// seconds to start from), next (the moment that follows when this one ends)
const HCL_MOVES = {
  death: { clip: 'Death01', hold: true, landed: 1.4 },
  deathSink: { clip: 'Death_A', speed: 1.4, hold: true, landed: 3.75 },
  deathBlown: { clip: 'Death_B', hold: true, landed: 1.2 },
  rise: { clip: 'LayToIdle', speed: 1.1, instant: true, out: .25 },
  land: { clip: 'Land_Three_Point', at: .47, fade: .06, out: .3 },   // (from just before his feet touch: the game drops him)
  nod: { clip: 'Head Nod', next: 'listen' },
  listen: { clip: 'Idle Listening', fade: .3 },
  wait: { clip: 'Idle_FoldArms_Loop', fade: .35 },
  chest: { clip: 'Chest_Open', speed: 1.15 },
  stone: { clip: 'Interact', speed: 1.2 },
  pickup: { clip: 'PickUp_Table', speed: 1.5, mask: 'upper', walk: true },
  hitChest: { clip: 'Hit_Chest', mask: 'upper', walk: true },
  hitHead: { clip: 'Hit_Head', mask: 'upper', walk: true },
  victory: { clip: 'Victory', speed: 1.1 },
  levelUp: { clip: 'Victory Fist Pump', speed: 1.2 }
};
const HCL_DEATHS = new Set(['death', 'deathSink', 'deathBlown']);
/** which fall: worn down by a damage-over-time tick, or flung by a crushing blow, or the plain stagger and fall */
function HCL_deathFor(h, hit) {
  if (!hit) return 'death';
  if (hit.tags && hit.tags.includes('dot')) return 'deathSink';
  if ((hit.kb || 0) >= 200 || hit.knockdown || (hit.src && hit.src.boss) || (hit.dmg || hit.amount || 0) >= h.maxHp * .5) return 'deathBlown';
  return 'death';
}
const HCL_fit = h => !!(HCL.lib && h && h.rig instanceof E.Humanoid && characterOf(h).clips !== false);   // (a character with clips: false keeps its own animation)
/** start a moment (crossfading from whatever clip is on him); o.instant: at full weight from the first frame */
function HCL_play(h, id, o = {}) {
  const M = HCL_MOVES[id], c = M && HCL.lib.clip(M.clip); if (!c) return null;
  const was = h.HCL, from = was && was.w > 0 && h.HCL_pose ? Float32Array.from(h.HCL_pose) : null;
  h.HCL = { id, c, t: o.at !== undefined ? o.at : M.at || 0, speed: M.speed || 1, fade: M.fade || .12, w: o.instant || M.instant ? 1 : was ? was.w : 0, out: false, hold: !!(M.hold || o.hold), mask: o.full ? null : M.mask || null, walk: !!M.walk, from, blend: from ? .18 : 0, gal: !!o.gal };
  return h.HCL;
}
/** let the clip go: it fades out over `fade` seconds and the rig's own animation takes the body back */
function HCL_stop(h, fade = .15) { const k = h.HCL; if (k && !k.out) { k.out = true; k.fade = fade; } }
/** advance the clip and hand this step's pose to the rig (call before the rig updates) */
function HCL_step(h, dt) {
  const rig = h.rig, k = h.HCL, L = HCL.lib;
  if (rig.HCL !== L) { Mocap.drive(rig, L); rig.HCL = L; }   // a new rig (new gear dresses him again) is driven again
  if (!k) { rig.mocap = null; return; }
  k.t += dt * k.speed;
  if (k.t >= k.c.dur && !k.c.loop && !k.hold && !k.out) {
    const next = HCL_MOVES[k.id].next; if (next && !k.gal) { HCL_play(h, next); return HCL_step(h, 0); }   // one moment runs into the next
    k.out = true; k.fade = HCL_MOVES[k.id].out || .2;
  }
  k.w = k.out ? k.w - dt / k.fade : Math.min(1, k.w + dt / k.fade);
  if (k.w <= 0) { h.HCL = null; rig.mocap = null; return; }
  const pose = L.sample(k.c, k.t, h.HCL_pose || (h.HCL_pose = new Float32Array(L.P * 3)));
  if (k.from) { k.blend -= dt; if (k.blend <= 0) k.from = null; else L.blend(k.from, pose, 1 - k.blend / .18, pose); }
  rig.mocap = pose; rig.mocapW = E.ease.inOut(clamp(k.w, 0, 1)); rig.mocapMask = k.mask; rig.mocapBlade = false;
}
const HCL_waiting = () => !!(talk.open || (ED.L && ED.L.serving));
/** the moments that start from his state: dying, getting up after a revive, landing, a celebration he has earned */
function HCL_auto(h) {
  const k = h.HCL;
  if (h.dead) { if ((!k || !HCL_DEATHS.has(k.id)) && (h.z || 0) <= 1) HCL_play(h, HCL_deathFor(h, h.HCL_cause)); return; }
  if (h.HCL_rise) { h.HCL_rise = false; if (!(h.act && h.act.name === 'dropin') && !((h.z || 0) > 1)) HCL_play(h, 'rise'); }   // (dropped in from above, he lands on his feet)
  const a = h.act; if (a && a.name === 'dropin' && a.land !== undefined && !a.HCL_land) { a.HCL_land = true; HCL_play(h, 'land'); }   // his feet have just touched
  // a boss down or a level gained: celebrated once he stands still and nothing else is playing, if that is within 3 s
  const w = h.HCL_wish;
  if (w && (game.time > w.until)) h.HCL_wish = null;
  else if (w && !h.act && h.dodgeT <= 0 && Math.hypot(h.vx, h.vy) < 20 && (!k || k.out || k.walk)) { h.HCL_wish = null; HCL_play(h, w.id); }
}
/** a celebration to play when he is free: the bigger one wins */
function HCL_wishFor(h, id, rank) { if (!h.HCL_wish || h.HCL_wish.rank <= rank) h.HCL_wish = { id, rank, until: game.time + 3 }; }
/** what takes the body back: a roll or an action at once; moving or a flinch (unless the clip walks with him) */
function HCL_cancel(h) {
  const k = h.HCL; if (!k || k.out || k.gal || h.dead) return;
  if (h.dodgeT > 0 || (h.act && !(k.id === 'land' && h.act.name === 'dropin'))) return HCL_stop(h, .07);   // (the landing plays out under the drop-in)
  if (!k.walk && (Math.hypot(h.vx, h.vy) > 20 || h.hurtT > 0)) return HCL_stop(h, HCL_MOVES[k.id].out || .15);
  if ((k.id === 'wait' || k.id === 'nod' || k.id === 'listen') && !HCL_waiting()) HCL_stop(h, .3);
}
{ const base = updateHero;
  updateHero = function (h, dt, o) {
    if (!HCL_fit(h)) return base(h, dt, o);
    h.HCL_ui = null; HCL_auto(h); HCL_step(h, dt);
    base(h, dt, o);
    HCL_cancel(h);
  };
}
/** in town with a panel or a talk open (townLife poses him then, not updateHero): nod and listen, fold the arms, open the chest, work the stone */
{ const base = townLife;
  townLife = function (dt) {
    const h = ED.hero;
    if (HCL_fit(h) && !h.dead) {
      const L0 = ED.L, chest = UI.isOpen('stash') && (L0.things || []).find(t => t.kind === 'stash'), stone = UI.isOpen('waystone') && L0.waystone, at = chest || stone;
      if (at) h.facing = E.approachAng(h.facing, angTo(h, at), dt * 8);
      const want = chest ? 'chest' : stone ? 'stone' : L0.serving ? 'wait' : talk.open ? 'listen' : null;
      if (want !== h.HCL_ui) { h.HCL_ui = want; if (want && !(h.HCL && h.HCL.id === want && !h.HCL.out)) HCL_play(h, want === 'listen' ? 'nod' : want); }   // (a talk opens with a nod)
      HCL_step(h, dt);
    }
    return base(dt);
  };
}
{ const base = reviveHero;
  reviveHero = function (h) {
    const fell = !!(h && (h.dead || (h.HCL && HCL_DEATHS.has(h.HCL.id))));
    base(h);
    if (!HCL_fit(h)) return;
    if (h.HCL && HCL_DEATHS.has(h.HCL.id)) h.HCL = null;
    h.HCL_cause = null; h.HCL_wish = null;
    if (fell) h.HCL_rise = true;   // he gets up on his next step (unless he drops in from above)
  };
}
// the YOU DIED panel stops the world: it waits until he is down, so it never freezes him mid-fall
{ const base = deathPanelDue; deathPanelDue = h => base(h) && !(h.HCL && HCL_DEATHS.has(h.HCL.id) && h.HCL.t < HCL_MOVES[h.HCL.id].landed); }
BUS.on('heroDie', e => { if (e && e.h && HCL_fit(e.h)) e.h.HCL_cause = e.hit || null; });   // how he died picks the fall
BUS.on('bossDown', () => { const h = ED.hero; if (HCL_fit(h) && h.alive && !h.dead) HCL_wishFor(h, 'victory', 2); });
BUS.on('heroLevel', () => { const h = ED.hero; if (HCL_fit(h) && h.alive && !h.dead && ED.mode !== 'gallery') HCL_wishFor(h, 'levelUp', 1); });
BUS.on('pickup', () => {
  const h = ED.hero; if (!HCL_fit(h) || !h.alive || h.dead || h.act || h.dodgeT > 0 || (h.HCL && !h.HCL.out && !h.HCL.walk)) return;
  HCL_play(h, 'pickup');
});
BUS.on('hurt', e => {
  const h = ED.hero, hit = (e && e.hit) || {}; if (!e || e.tgt !== h || !HCL_fit(h) || !h.alive || h.dead) return;
  if ((hit.kb || 0) >= 200 || hit.knockdown || h.act || h.dodgeT > 0 || !(e.dmg > h.maxHp * .12)) return;   // knocked down: the rig's own fall
  if (h.HCL && !h.HCL.out && !h.HCL.walk) return;
  HCL_play(h, (h.HCL_hits = (h.HCL_hits || 0) + 1) % 2 ? 'hitChest' : 'hitHead');
});

/* ---- the gallery's POSES reel: each captured moment, played whole on the spot, then again ---- */
const HCL_GALLERY = [
  ['Captured death', 'death', 'Motion capture: a stagger, then flat on his back.'], ['Captured get-up', 'rise', 'Motion capture: up off the ground.'],
  ['Arms folded', 'wait', 'Waiting while someone talks.'], ['Open the stash', 'chest', 'He bends and lifts the lid.'],
  ['Use the waystone', 'stone', 'Hands on the stone.'], ['Pick up', 'pickup', 'A quick reach for loot.'],
  ['Hit in the chest', 'hitChest', 'A heavy blow snaps him back.'], ['Hit in the head', 'hitHead', 'A heavy blow to the head.'],
  ['Worn down', 'deathSink', 'Poisoned or burned: he sinks down.'], ['Crushed', 'deathBlown', 'A crushing blow throws him back.'],
  ['Landing', 'land', 'Dropped in: a three-point landing.'], ['Listening', 'listen', 'A hand on the hip while someone talks.'],
  ['Head nod', 'nod', 'He nods as a talk begins.'], ['Boss victory', 'victory', 'A boss falls: a jump, fist raised.'],
  ['Level up', 'levelUp', 'A fist pump for a new level.']
];
if (HCL.lib) for (const [name, id, cap] of HCL_GALLERY) GAL_POSES.push([name, { clip: id }, cap]);
{ const base = galItems;
  galItems = function () { const ids = base(); return GAL.reel === 3 && !HCL_fit(ED.hero) ? ids.filter(i => !GAL_POSES[i][1].clip) : ids; };
}
{ const base = galleryScene.update;
  galleryScene.update = function (dt) {
    const h = ED.hero;
    if (HCL_fit(h)) {
      const p = GAL.reel === 3 && GAL_POSES[GAL.cur], id = p && p[1].clip, k = h.HCL;
      if (id) {
        const again = k && k.gal && k.id === id && !k.c.loop && k.t > k.c.dur + 1.2;   // the end pose holds a moment, then the take runs again
        if (again) galReset();
        if (again || !k || !k.gal || k.id !== id || GAL.t < (h.HCL_galT || 0)) HCL_play(h, id, { gal: true, hold: true, full: true, instant: true });
        h.HCL_galT = GAL.t; HCL_step(h, dt);
      } else if (k && k.gal) { h.HCL = null; h.rig.mocap = null; }
    }
    return base.call(this, dt);
  };
}
