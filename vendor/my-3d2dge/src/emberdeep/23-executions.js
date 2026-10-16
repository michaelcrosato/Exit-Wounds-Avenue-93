/* =============================================================================
 * EXECUTIONS AND TAKEDOWNS: the engine's paired action (E.ACTIONS.takedown, played by E.Action on two bodies at
 * once) in a hack-and-slash, picked with E.targets, marked with r.marker, heard with E.hears.
 *   reeling    a humanoid monster your hit staggers (knockback, a stun) or crits at or under TUNE.exeLife of its life
 *              (elites at 60% of it) reels for TUNE.exeWindow seconds: its outline flickers
 *   execute    E near a reeling monster (40 units): the hero leaps onto it (the aerial takedown), the two bodies play
 *              one action and it drops. He is untouchable while it plays; a dodge charge and TUNE.exeHeal of his life
 *              come back
 *   takedown   E close behind (22 units) a monster that takes them (archetype takedown: true: the Warden,
 *              32-wardens.js) before it raises the alarm (m.alarmed): the ground takedown, from its back
 *   the noise  an execution carries 110 units, a takedown 40: monsters that hear it (E.hears, halved through a wall)
 *              wake with their packs; a mind of its own (o.hear(k, noise): the Warden's) is told instead
 * The one E would take (the nearest the hero can see, E.targets) gets a marker over its head and the prompt
 * '[E] Execute the Skeleton'. BUS 'execute' { h, m, kind: 'finish' | 'silent' } when it drops. The autopilot takes
 * every one it can, so the title's demo shows them off. Private names start with EXE_.
 * ============================================================================= */
const EXE = { range: { finish: 40, silent: 22 }, noise: { finish: 110, silent: 40 }, cur: null, told: {} };
/** what E would do to monster m now: 'silent' (a takedown from behind), 'finish' (an execution) or null */
function exeKind(h, m) {
  if (!m.alive || m.spawnT > 0 || m.exeBy || m.boss || m.arch.bossBody || m.canFly || m.air || (m.z || 0) > 2 || m.st.freeze || !(m.rig instanceof E.Humanoid)) return null;
  if (m.arch.takedown && !m.alarmed && Math.abs(E.angDiff(m.facing, angTo(m, h))) > 1.9) return 'silent';   // from its back (more than ~110 degrees off its facing)
  return m.reelT > game.time ? 'finish' : null;
}
/** the monster E would take now (the nearest in reach that the hero sees; an execution leaps further than a takedown
 *  creeps): { m, kind }, or null */
function exeTarget(h) {
  if (!h || !h.alive || h.dead || h.dodgeT > 0 || (h.act && !h.act.free) || h.potionT > 0) return null;
  const L0 = ED.L, reach = m => { const k = exeKind(h, m); return !!k && Math.hypot(m.x - h.x, m.y - h.y) <= EXE.range[k] + m.r; };
  const near = E.targets(h, ED.foes, { range: EXE.range.finish, sight: L0 && L0.map, filter: reach });
  return near.length ? { m: near[0].target, kind: exeKind(h, near[0].target) } : null;
}
/** a monster hears a noise of strength k (E.hears): a mind of its own is told, any other wakes with its pack */
function hearNoise(o, noise, k) {
  if (o.hear) { o.hear(k, noise); return; }
  if (o.ai.aware) return;
  o.ai.aware = true; for (const q of ED.foes) if (q.pack && q.pack === o.pack) q.ai.aware = true;
  if (game.time - (AI.alertT || -9) > .6) { AI.alertT = game.time; P.text(o.x, o.y, (o.z || 0) + (o.head || 24) * (o.scale || 1) + 8, '!', '#ff6a5a', { scale: 2 }); sfx('blip', { vol: .5, pitch: .7 }); }
}
/** every monster in earshot of a noise { x, y, z, loud } hears it */
function makeNoise(noise, except) {
  const map = ED.L && ED.L.map; let n = 0;
  for (const o of ED.foes) { if (o === except || !o.alive || o.spawnT > 0) continue; const k = E.hears(o, noise, map); if (k > .05) { hearNoise(o, noise, k); n++; } }
  return n;
}

/* ---------- reeling: a heavy hit near the end of its life opens a humanoid up ---------- */
BUS.on('hit', e => {
  const m = e.tgt, s = e.src, hit = e.hit;
  if (!m || m.team !== 'foe' || !m.alive || m.hp <= 0 || !s || s.team !== 'hero' || TUNE.exeLife <= 0 || m.boss || m.arch.bossBody || !(m.rig instanceof E.Humanoid)) return;
  if (m.hp > m.maxHp * TUNE.exeLife * (m.elite ? .6 : 1) || !((hit.kb || 0) > 20 || hit.stun || hit.crit)) return;
  if (!(m.reelT > game.time)) P.ring(m.x, m.y, 3, 16, '#ffb04a', .3);   // (it starts to reel)
  m.reelT = game.time + TUNE.exeWindow;
});

/* ---------- the action: both bodies, one E.Action ---------- */
/** start an execution ('finish': the aerial takedown) or a takedown ('silent': from its back) of monster m */
function exeStart(h, m, kind) {
  const aerial = kind === 'finish', A = new E.Action('takedown', { body: h, other: m, aerial, speed: aerial ? 1.2 : 1 });
  m.exeBy = h; m.atk = null; m.vx = m.vy = 0; m.reelT = 0;
  m.st.stun = { t: A.duration + .5, p: 0 };   // held: the monster loop gives a stunned monster no mind and no walk
  h.inv = Math.max(h.inv, A.duration + .05); h.slotQ = null; h.dodgeQ = 0;
  if (aerial) { sfx('whoosh', { vol: .7 }); P.dust(h.x, h.y, 0, 6, { speed: 40 }); }
  let struck = false, felled = false;
  const fell = () => { if (felled) return; felled = true; EXE_fell(h, m, kind); };
  return startAction(h, { name: 'execute', moveK: 0, cancel: false, interrupt: false, face: A.facing, z: h.z, rig: A.rigState(),
    update(dt) {
      const going = A.update(dt);
      this.rig = A.rigState(); this.z = h.z; this.face = h.facing;   // (the action moves him: updateHero keeps its height and facing)
      if (m.alive && !felled) { const s = A.otherState({ expr: 'wince' }); delete s.x; delete s.y; delete s.z; m.rigState = s; if (m.st.stun) m.st.stun.t = Math.max(m.st.stun.t, .3); }
      if (!struck && A.beat === 'strike') { struck = true; EXE_strike(h, m, kind); }
      if (A.beat === 'recover' || !going) fell();
      return going;
    },
    end() { fell(); m.exeBy = null; m.rigState = null; }
  });
}
function EXE_strike(h, m, kind) {
  const z = (m.z || 0) + (m.head || 28) * (m.scale || 1) * .55, el = (h.look && h.look.el) || 'phys';
  m.flash = .1; m.rig.kick(3);
  game.freeze(.04); shake(kind === 'finish' ? 4 : 2); slowMo(.4, .22, 'execute');   // (hit stop runs on the slowed clock: keep it short)
  P.impact(m.x, m.y, z, 7, '#ffe6a0'); P.sparks(m.x, m.y, z, 10, angTo(h, m), { color: '#ffd36a' }); if (el !== 'phys') elBurst(m.x, m.y, z, el, 8);
  sfx(kind === 'finish' ? 'slash2' : 'slash', { vol: .8, pitch: kind === 'silent' ? .8 : 1 }); sfx('thud', { vol: .5 });
  game.input.rumble(kind === 'finish' ? .8 : .45, .18);
}
function EXE_fell(h, m, kind) {
  if (m.alive) { killUnit(m, { src: h, amount: m.hp, el: (h.look && h.look.el) || 'phys', tags: ['execute', 'melee'] }); m.rig.dieT = 1; }   // it lies where the action dropped it: the corpse's topple starts at its end
  if (!h.alive || h.dead) return;
  h.hp = Math.min(h.maxHp, h.hp + h.maxHp * TUNE.exeHeal); h.dodges = Math.min(h.maxDodge, h.dodges + 1);
  P.text(h.x, h.y, (h.head || 26) + 10, kind === 'silent' ? 'SILENT' : 'EXECUTED', kind === 'silent' ? '#8fe3ff' : '#ffb04a');
  makeNoise({ x: m.x, y: m.y, z: 10, loud: EXE.noise[kind] }, m);
  BUS.emit('execute', { h, m, kind });
}

/* ---------- each step: the prompt, the key, the autopilot, the flicker ---------- */
BUS.on('step', () => {
  const h = ED.hero; EXE.cur = null;
  if (!h || ED.mode === 'title' || ED.mode === 'gallery' || UI.modal) return;
  for (const m of ED.foes) if (m.reelT > game.time && m.alive && !m.exeBy && Math.floor(game.time * 8) % 2) m.rimT = Math.max(m.rimT || 0, 1 / 60);   // the outline flickers (a glory-kill flash)
  const t = EXE.cur = exeTarget(h); if (!t) return;
  if (h.bot && !h.bot.manual) { exeStart(h, t.m, t.kind); EXE.cur = null; return; }   // the autopilot takes every one it can
  if (!EXE.told[t.kind]) { EXE.told[t.kind] = true; tip(t.kind, t.kind === 'silent' ? 'IT HAS NOT SEEN YOU: E TAKES IT DOWN FROM BEHIND, QUIETLY' : 'A WOUNDED FOE REELS (ITS OUTLINE FLICKERS)  •  E EXECUTES IT: LIFE AND A DODGE COME BACK', '#ffb04a'); }
  UI.prompt = '[E] ' + (t.kind === 'silent' ? 'Take down ' : 'Execute ') + (t.m.elite === 2 ? t.m.name : 'the ' + t.m.name);
  const inp = game.input;
  if (inp.pressed('interact')) { inp.consume('interact'); exeStart(h, t.m, t.kind); EXE.cur = null; }
});
BUS.on('draw', e => {
  const t = EXE.cur; if (!t || !t.m.alive || t.m.exeBy) return;
  const m = t.m; e.r.marker(m.x, m.y, (m.z || 0) + (m.head || 28) * (m.scale || 1) + 4, { color: t.kind === 'silent' ? '#8fe3ff' : '#ff8a4a', offscreen: false });
});
