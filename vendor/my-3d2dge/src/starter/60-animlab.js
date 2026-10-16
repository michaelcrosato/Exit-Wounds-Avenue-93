/* =====================================================================================
 * SLICE 6  ANIMATION LAB. Every animation the rigs can do, on every skin, from every view: locomotion, every E.MOVES
 * attack (with its wind / hit / recover timeline and frozen key poses), combos, poses, reactions, stances and gun aims.
 * Up / Down pick the animation, Left / Right the skin, L lines every skin up, F turns them round, B shows the skeleton,
 * T the weapon trail, Space pauses, . steps one frame, S plays at quarter speed, J (or Enter) replays, H hides the HUD,
 * Esc goes back to the title. The shell's camera keys work: V view, - = zoom, [ ] turn, 0 reset.
 * HOW IT WORKS: one clock drives every subject, so the lineup stays in sync. A move is an E.Attack, a combo an E.Combo,
 * and a straw dummy takes the hits with hit-stop. Everything else is a list of timed phases whose fields go straight
 * into rig.update. Blobs turn every move into their own attack: a bite, a leap, a pounce (the bat darts and dives) or a spit.
 * ===================================================================================== */
const ANIMLAB = (() => {
  const T = 16, CX = 12 * T, CY = 5 * T, LY = CY + 24, RING = 26, BEAM = CY - 9, TOPZ = 66;   // the spot, the lineup's line, the chalk ring, the rack's beam (y, top)
  const RUNG = 6, REST = .5, CHAIN = .45;   // ladder rung spacing, a pause after each move, how far into a recover a combo presses on

  /* ---- SKINS: 8 Humanoids and 3 Blobs. Any skin plays any animation (a mage can punch). A blob's leap is its own attack:
   * how far it gathers back and reaches, how high it jumps (a dive if negative), its squash in the air and on landing,
   * and when in the strike it hits ---- */
  const SKINS = [
    { name: 'KNIGHT', rig: { build: 'heroic', armor: true, cape: { len: 7, width: 8, seg: 2.6, body: 5.2 }, colors: { cloth: '#3a5ab0', cape: '#b02a3a', capeIn: '#8a1c2c', hair: '#e0b050', trim: '#e8c860' } } },
    { name: 'MAGE', rig: { weapon: 'staff', outfit: 'robe', sleeves: 'long', hair: 'long', hat: { style: 'pointed', color: '#4a2a8a' }, colors: { cloth: '#6a3ab0', hair: '#e8e4f0', trim: '#e8c860' } } },
    { name: 'BRAWLER', rig: { build: 'bulky', weapon: null, sleeves: 'none', hat: { style: 'band', color: '#e03a3a' }, colors: { cloth: '#f0f0f0', pants: '#2f5fd0', belt: '#f0f0f0', glove: '#c83a2a', hair: '#5a3220' } } },
    { name: 'ROGUE', rig: { hair: 'ponytail', outfit: 'tunic', face: { eyes: 'big' }, colors: { cloth: '#3a7a52', pants: '#3a3448', hair: '#c8402a', boot: '#4a3028' } } },
    { name: 'SOLDIER', rig: { build: 'heroic', weapon: 'gun', hat: { style: 'helmet', color: '#56643a' }, sleeves: 'long', colors: { cloth: '#6a7a44', pants: '#4a4a36', boot: '#3a2e22', glove: '#3a3a2a', hair: '#3a2a20', metal: '#7a8490', metalDk: '#3a4250' } } },
    { name: 'SKELETON', rig: { build: 'skeleton', weapon: null } },   // a bare-handed ghoul: its claw is a real claw
    { name: 'LICH', rig: { build: 'skeleton', weapon: 'staff', outfit: 'robe', hood: true, eyeGlow: '#6af0ff', colors: { bone: '#c8c8b0', cloth: '#3a2458', trim: '#c8a040' } } },
    { name: 'SWORDSWOMAN', rig: { build: 'heroic', armor: true, hair: 'long', face: { eyes: 'big' }, colors: { cloth: '#c83a4a', hair: '#f0d070', trim: '#e8c860', skin: '#f4d0b0' } } },
    { name: 'SLIME', leap: { back: 3, reach: 15, h: 9, air: .25, land: -.45, hit: .9 }, blob: { R: 7, colors: { dk: '#1e5a86', base: '#4fa8e0', lt: '#b8ecff' } } },
    { name: 'RABITE', leap: { back: 2, reach: 16, h: 8, air: .1, land: -.35, hit: .9 }, blob: { R: 6.5, ears: 'rabbit', feet: true, tail: true, mouth: true, face: 'front', colors: { dk: '#b0862a', base: '#f2d468', lt: '#fff6c0', inner: '#f5a3b8' } } },
    { name: 'BAT', fly: 14, leap: { back: 4, reach: 14, h: -9, air: -.15, land: .25, hit: .5 }, blob: { R: 4.5, wings: true, feet: true, mouth: 'fangs', colors: { dk: '#2e1a40', base: '#5e3a80', lt: '#9a70c0', wing: '#3e2458' } } }
  ];
  const actors = SKINS.map((s, i) => ({ s, i, x: CX, y: CY, z: 0, dx: 0,
    rig: s.rig && new E.Humanoid(Object.assign({ size: 1.3 }, s.rig)), blob: s.blob && new E.Blob(s.blob) }));

  /* ---- MOVES: E.MOVES as they are, plus a few lab overrides where a move misread (reported as engine requests):
   * the uppercut ends in front of the head, so the recover blends back through the front; the throw winds down
   * and back into a lob; the plunge gets time to jump. Side views already chop weapon swings in the screen plane. There
   * the fist and claw moves get their own screen-plane arcs too (a looping overhand hook, a rising elbow, a raking claw),
   * the backslash is a low-to-level backhand (not a copy of rising), the spin coils the blade back behind the shoulder
   * before its windmill, and the uppercut uses the far fist, clear of the face ---- */
  const FIX = { uppercut: { a1: 1, reach: 9.5, hop: 6, lunge: 2 }, throw: { a0: -2.6, a1: .4 }, plunge: { wind: .3 } };
  const V = { plane: 'side' }, SIDE = { hook: { ...V, a0: 1.9, a1: -.25 }, elbow: { ...V, a0: -.8, a1: 1.1 }, claw: { ...V, a0: 1.8, a1: -1.1 },
    backslash: { a0: -1.6, a1: .4, crouch: .3 }, spin: { a0: 2.6, wind: .14 }, uppercut: { hand: 'L' } };
  // hitAt: 0, since the lab finds the moment of contact itself (see aimDummy): the tip's farthest reach
  const move = m => new E.Attack(m, Object.assign({ hitAt: 0 }, FIX[m], game.view.pitchDeg < 15 && SIDE[m]));
  // the plunge is a jumping down-stab (Zelda II): the body rises in the wind-up and drops with the stab into the ground
  const LIFT = { plunge: A => A.phase === 'wind' ? 20 * E.ease.outQuad(A.u) : A.phase === 'active' ? 20 * (1 - E.ease.inQuad(A.u)) : 0 };

  /* ---- ANIMATIONS. A phase is [label, seconds, rig state, onStart(actor)]. A function field animates over the phase
   * (u: 0..1). Extra fields: speed (x the rig's speedRef), ring (walk round the chalk ring; the lineup walks in place),
   * dx (moves along the facing; the legs step with it unless slide: true), squat (squash deeper into a crouch), turn
   * (face the camera by up to that many radians). Everything else (pose, expr, hurt, air, down...) is the engine's ---- */
  const arc = h => u => h * 4 * u * (1 - u);                               // height of a hop over its phase
  const fwd = (a, d, z) => [a.x + Math.cos(face) * d, a.y + Math.sin(face) * d, a.z + z];
  const chest = a => (a.rig ? 22 : a.blob.o.R);
  const hit = a => { P.impact(...fwd(a, 5, chest(a)), 7, '#ffe070'); (a.rig || a.blob).kick(-3); a.flash = .05; A.sfx('hit'); };   // a 3-frame flash
  const jump = a => { (a.rig || a.blob).kick(4); P.dust(a.x, a.y, 0, 4); A.sfx('jump'); };
  const land = a => { (a.rig || a.blob).kick(-5); P.dust(a.x, a.y, 0, 6); A.sfx('land'); };
  const fire = a => {
    if (!a.rig || a.rig.o.weapon !== 'gun') return;
    const [x, y, z] = a.rig.tip(), h = a.rig.hand(), d = Math.hypot(x - h[0], y - h[1], z - h[2]) || 1, sp = 280 / d;   // along the barrel
    shots.fire({ x, y, z, vx: (x - h[0]) * sp, vy: (y - h[1]) * sp, vz: (z - h[2]) * sp, r: 1.2, life: .5 });
    P.impact(x, y, z, 4, '#fff0a0'); P.sparks(x, y, z, 4, face, { color: '#ffd060' }); a.rig.kick(-2); A.sfx('shoot');
  };
  const loop = (group, name, phases, o) => Object.assign({ group, name, phases }, o);
  const pose = (name, f) => loop('POSES', name.toUpperCase(), [[name.toUpperCase(), 1.6, Object.assign({ pose: name }, f)], ['STAND', .9, {}]]);
  const stance = name => loop('STANCES', name.toUpperCase(), [['HOLD', 1.2, { stance: name }], ['STEP', 1.4, { stance: name, speed: .45 }]]);
  // a gun burst: each shot kicks the muzzle up and the shoulder back for a few frames, then settles on the aim
  const shot = aim => [['FIRE', .05, { point: true, aim: aim + .35, dx: -1.2, slide: true }, fire], ['RECOIL', .17, { point: true, aim: u => aim + .35 * (1 - u), dx: u => -1.2 * (1 - u), slide: true }]];
  const gun = (name, aim) => loop('GUN', name, [['AIM', .4, { point: true, aim }], ...shot(aim), ...shot(aim), ...shot(aim), ['HOLD', .5, { point: true, aim }], ['LOWER', .8, {}]]);
  // getting up from the floor: the body sits up onto one knee (the engine bends the knees on the way), then stands
  const getUp = dx => [['SIT UP', .32, { pose: 'kneel', dx }], ['KNEEL', .12, { pose: 'kneel', dx }], ['STAND UP', .3, { dx }]];
  // climb with the back to the camera, a rung at a time: each pull lifts the body one rung, then the hands grip.
  // drive() passes the real climbing speed (vz), which paces the rig's hand-over-hand
  const CLIMB = { climb: true, facing: -Math.PI / 2 }, climb = [];
  for (const [z0, z1] of [[0, 3], [3, 9], [9, 15], [15, 21], [21, 15], [15, 9], [9, 3], [3, 0]])
    climb.push([z1 > z0 ? 'UP' : 'DOWN', .3, { ...CLIMB, z: u => lerp(z0, z1, E.ease.inOut(u)) }], ['GRIP', z1 === 21 ? .5 : .14, { ...CLIMB, z: z1 }]);
  // E.MOVES by group; a move added to E.MOVES later still shows up, under MORE
  const SETS = [['BLADES', 'slash backslash overhead rising thrust spin plunge twohand'], ['FISTS', 'jab cross hook uppercut haymaker elbow'],
    ['KICKS', 'kick roundhouse sweep flyingkick knee axekick'], ['MAGIC & MORE', 'cast throw bash claw']].map(([g, s]) => [g, s.split(' ')]);
  SETS.push(['MORE', Object.keys(E.MOVES).filter(m => !SETS.some(([, list]) => list.includes(m)))]);
  const ANIMS = [
    loop('LOCOMOTION', 'IDLE', [['IDLE', 3, {}]]),
    loop('LOCOMOTION', 'WALK', [['WALK', 3.2, { speed: .5, ring: true }]]),
    loop('LOCOMOTION', 'RUN', [['RUN', 2.4, { speed: 1.15, ring: true }]]),
    loop('LOCOMOTION', 'DASH', [['DASH', .32, { speed: 2.4, dash: true, ring: true }, a => P.dust(a.x, a.y, 0, 5)], ['SKID', .4, { speed: u => 1.2 * (1 - u), ring: true }], ['IDLE', .7, { ring: true }]]),
    loop('LOCOMOTION', 'JUMP / AIR', [['CROUCH', .12, { pose: 'crouch', squat: .12 }], ['AIR', .62, { air: true, z: arc(20) }, jump], ['LAND', .16, { pose: 'crouch', squat: .15 }, land], ['IDLE', .7, {}]]),
    loop('LOCOMOTION', 'CROUCH', [['CROUCH', 1.4, { pose: 'crouch' }], ['STAND', .9, {}]]),
    loop('LOCOMOTION', 'CLIMB', climb, { ladder: true }),
    ...SETS.flatMap(([group, list]) => list.map(m => ({ group, name: m.toUpperCase(), move: m }))),
    { group: 'COMBOS', name: 'JAB-CROSS-HOOK-UPPERCUT', combo: ['jab', 'cross', 'hook', 'uppercut'] },
    { group: 'COMBOS', name: 'SLASH-BACKSLASH-SPIN', combo: ['slash', 'backslash', 'spin'] },
    { group: 'COMBOS', name: 'KICK-ROUNDHOUSE', combo: ['kick', 'roundhouse'] },
    // cheer: the fists pump and the weapon goes up point first, then a little victory hop. wave: the camera-side hand.
    // Both turn to the camera (turn: radians), so the raised arms frame the face instead of crossing it
    loop('POSES', 'CHEER', [['CHEER', .6, { pose: 'cheer', expr: 'smile', turn: .8 }], ['HOP', .36, { pose: 'cheer', expr: 'smile', turn: .8, air: true, z: arc(7) }, jump],
      ['CHEER', .7, { pose: 'cheer', expr: 'smile', turn: .8, squat: .1 }, land], ['STAND', .9, {}]]),
    pose('wave', { expr: 'smile', turn: .8 }), pose('cast'), pose('guard'), pose('block'), pose('kneel'), pose('hips', { expr: 'smile' }),
    // pose 'down' topples the body with bent knees, faster and faster; 'die' staggers (hurt holds the stagger until the
    // topple, see the engine requests), then the knees give
    loop('POSES', 'DOWN AND GET UP', [['FALL', .2, { pose: 'down', hurt: true, expr: 'wince' }], ['LIE', 1.2, { pose: 'down' }, land], ...getUp(0), ['STAND', 1, {}]]),
    loop('POSES', 'DIE', [['DIE', .62, { pose: 'die', hurt: u => u < .72, expr: 'wince' }], ['LIE', 1.4, { pose: 'die' }, land], ...getUp(0), ['STAND', 1, {}]]),
    loop('REACTIONS', 'HURT', [['HIT', .35, { hurt: true, expr: 'wince' }, hit], ['RECOVER', .8, {}]]),
    // knocked back and down from right of the spot, so the flight stays centred on the stage
    loop('REACTIONS', 'KNOCKBACK', [['HIT', .3, { hurt: true, expr: 'wince', slide: true, dx: u => 8 - 16 * E.ease.outQuad(u) }, hit], ['STAGGER', .35, { hurt: u => u < .5, dx: -8 }],
      ['RETURN', 1, { dx: u => -8 + 16 * u }], ['IDLE', .5, { dx: 8 }]]),
    loop('REACTIONS', 'KNOCKED DOWN', [['HIT', .42, { hurt: true, expr: 'wince', air: true, slide: true, down: u => .6 * u * u, dx: u => 11 - 22 * u, z: arc(9) }, hit],
      ['DOWN', 1, { down: 1, dx: -11 }, land], ...getUp(-11), ['RETURN', 1.2, { dx: u => -11 + 22 * u }], ['IDLE', .4, { dx: 11 }]]),
    stance('guard'), stance('ready'),
    gun('POINT', 0), gun('AIM UP', .7), gun('AIM DOWN', -.5)
  ];
  // the timeline of each animation: [label, seconds, color]. Moves and combos read their phases from the E.MOVES spec
  const PH = { WIND: '#f0c040', HIT: '#f05a4a', RECOVER: '#5a9ae8', REST: '#5a5478' }, PAL = ['#7ac8a0', '#d898e0', '#f0b070', '#70b0e8', '#e8e070'];
  const hitSegs = (m, share = 1, pre = '') => { const s = move(m).spec; return [[pre + 'WIND', s.wind, PH.WIND], [pre + 'HIT', s.active, PH.HIT], [pre + 'RECOVER', s.recover * share, PH.RECOVER]]; };
  const GROUPS = [...new Set(ANIMS.map(a => a.group))];
  for (const a of ANIMS) {
    a.segs = a.move ? hitSegs(a.move) : a.combo ? a.combo.flatMap((m, i) => hitSegs(m, i < a.combo.length - 1 ? CHAIN : 1, m.toUpperCase() + ' ')) : a.phases.map((p, i) => [p[0], p[1], PAL[i % 5]]);
    if (!a.phases) a.segs.push(['REST', REST, PH.REST]);
    a.len = a.segs.reduce((s, p) => s + p[1], 0);
  }

  /* ---- THE PLAYER: one clock (t) and one Attack or Combo drive every subject ---- */
  let ai = 0, anim, t, ph, attack, combo, skin = 0, lineup = false, face = 0, paused = false, trail = true, bones = false, hidden = false, keys = null, keysFor = '', viewKey = '';
  const shots = new E.Bullets(game, { plane: 'ground' });            // spells, thrown knives and bullets
  const dum = { x: CX, y: CY, d: 20, hz: [], hu: [], r: 6, lean: 0, v: 0 };   // the straw dummy: it rocks back when hit
  const dummyOn = () => !lineup && !!(anim.combo || anim.move && !LIFT[anim.move]);
  function play(i) {
    ai = (i + ANIMS.length) % ANIMS.length; anim = ANIMS[ai]; t = 0; ph = -1;
    attack = anim.move ? move(anim.move) : null;                          // an E.MOVES name: timing and body motion included
    combo = anim.combo ? new E.Combo(anim.combo.map(move), { window: .3 }) : null;
    for (const a of actors) a.dx = 0;
    shots.clear(); aimDummy(); settle();
  }
  function pick(i) { skin = (i + actors.length) % actors.length; aimDummy(); settle(); }
  const shown = () => (lineup ? actors : [actors[skin]]);
  function phaseAt() {                           // the current phase of a looping animation, its fields evaluated at u
    let t0 = 0, i = 0; const P = anim.phases;
    while (i < P.length - 1 && t >= t0 + P[i][1]) t0 += P[i++][1];
    const [, len, f, on] = P[i], u = clamp((t - t0) / len, 0, 1), st = {};
    for (const k in f) st[k] = typeof f[k] === 'function' ? f[k](u) : f[k];
    return [i, st, on];
  }
  function tick(dt) {
    if (t >= anim.len) t = 0;
    if (t === 0) { ph = -1; if (attack) attack.start(); if (combo) { combo.cancel(); combo.press(); } }
    t += dt;
    let st, on = null;
    const atk = attack || combo;
    if (atk) {
      // a combo presses on once a hit is well into its recover, as a player would
      if (combo && combo.current.phase === 'recover' && combo.current.u >= CHAIN && combo.step < combo.moves.length - 1) combo.press();
      const began = atk.update(dt), cur = combo ? combo.current : attack, spec = cur.spec;
      if (began === 'active') A.sfx('whoosh', { pitch: spec.kick ? .8 : 1 });
      st = { attack: atk.state, expr: atk.state && (cur.phase === 'active' ? 'shout' : 'angry') };   // a gritted wind-up, a shout on the strike
      if (LIFT[spec.name] && st.attack) { st.z = LIFT[spec.name](st.attack); st.air = st.z > 1; }
      if (began) on = a => release(a, spec.name, began);
      // the dummy takes the hit when the blade, fist, foot or leaping blob reaches it
      if (dummyOn() && st.attack && st.attack.u >= dum.hu[combo ? combo.step : 0]) atk.hits([dum], () => true, () => strike());
    } else { let i; [i, st, on] = phaseAt(); if (i === ph) on = null; ph = i; }
    for (const a of shown()) drive(a, st, dt, on);
    shots.update(dt, map);
    for (const b of shots.list) if (b.z < 0) { b.dead = true; P.dust(b.x, b.y, 0, 3); }   // a thrown knife lands
    if (dummyOn()) shots.hit([dum], b => strike(b.z));
    dum.v += (-70 * dum.lean - 6 * dum.v) * dt; dum.lean += dum.v * dt;
  }
  function strike(at) {   // hit-stop, a star where the blow lands on the sack, and a rock back
    const z = clamp(at || dum.hz[combo ? combo.step : 0] || 18, 4, 34);
    game.hitFx(dum.x - Math.cos(face) * 4, dum.y - Math.sin(face) * 4, z, { power: .6, angle: face }); dum.v += 5;
  }
  // the dummy stands where the move lands: a scratch rig plays the wind and the strike, and the farthest point of the
  // blade tip, fist or foot (a blob: its leap at the hit) sets the distance and the moment; the nearest hit of a combo wins
  function aimDummy() {
    const a = actors[skin];
    let d = 99; dum.hz = []; dum.hu = [];
    for (const m of anim.combo || (anim.move ? [anim.move] : [])) {
      let far = -99, hz = 18, hu = a.blob ? a.s.leap.hit : .5;
      if (MISSILE[m]) { far = 30; hu = 2; }   // only the missile hits
      else if (a.blob) { const j = leap(a.s.leap, { spec: { name: m }, phase: 'active', u: hu }); far = j.dx + a.blob.o.R; hz = (a.s.fly || 0) + j.z + a.blob.o.R; }
      else {
        const rig = new E.Humanoid(Object.assign({ size: 1.3 }, a.s.rig)), spec = move(m).spec;
        rig.draw(SCRATCH, 0, 0, game.view);    // tells it the view (the swing plane)
        for (const phase of ['wind', 'active']) for (let i = 1, n = Math.ceil(spec[phase] * 60); i <= n; i++) {
          rig.update(1 / 60, { x: 0, y: 0, facing: 0, attack: { spec, phase, u: i / n } });
          const p = rig.trail.length ? rig.trail[rig.trail.length - 1].t : rig.tip();
          if (phase === 'active' && p[0] > far) { far = p[0]; hz = p[2]; hu = Math.min(.9, i / n); }
        }
      }
      d = Math.min(d, far); dum.hz.push(hz); dum.hu.push(hu);
    }
    dum.d = clamp(d + 3, 10, 34);
  }
  // what leaves the hand as the strike ends: a spell from a cast, a knife from a throw (the dummy stands farther off);
  // a blob spits a glob (the bat screeches a ring of sound). The plunge hits the ground
  const MISSILE = { cast: { vz: 0, grav: 0, r: 3, color: '#7fe3ff' }, throw: { vz: 20, grav: 250, r: 1.2, color: '#dce8f1' } };
  function release(a, name, phase) {
    if (phase !== 'recover') return;
    if (name === 'plunge') { const [x, y] = a.rig ? a.rig.tip() : [a.x, a.y]; game.hitFx(x, y, 1, { power: .5, sound: 'stomp' }); land(a); }
    if (!MISSILE[name]) return;
    const c = Math.cos(face), s = Math.sin(face), R = a.blob && a.blob.o.R;
    let x = a.x + c * R, y = a.y + s * R, z = a.z + R * .9, k;   // a blob: from its mouth
    if (a.rig) { const h = a.rig.hand(); k = (h[0] - a.x) * c + (h[1] - a.y) * s; x = a.x + c * k; y = a.y + s * k; z = h[2]; }   // from the hand, on the facing line
    const spit = a.blob && { vz: a.s.fly ? 0 : 30, grav: a.s.fly ? 0 : 260, r: a.s.fly ? 2.5 : 1.8, color: a.s.fly ? '#e0c8ff' : a.s.blob.colors.lt };
    shots.fire(Object.assign({ x, y, z, vx: c * 160, vy: s * 160, life: 2 }, spit || MISSILE[name]));
    if (name === 'cast' || a.s.fly) { P.ring(x, y, 2, 9, spit ? spit.color : '#7fe3ff', .3, z); A.sfx('laser'); } else A.sfx('shoot');
  }
  // Blobs have no limbs: a move becomes the creature's own attack on the same clock (k: 0..1 wind, 1..2 hit, 2..3 recover).
  // Quick strikes are a short, low bite (the bat: a dart), big and rising ones a high pounce (the bat: a steep dive),
  // everything else the creature's leap; a cast or a throw is a spit: rear back, then stretch forward
  const BITE = new Set('jab cross elbow knee kick thrust bash'.split(' ')), POUNCE = new Set('overhead rising uppercut plunge twohand flyingkick axekick'.split(' '));
  function leap(L, A) {
    const k = { wind: 0, active: 1, recover: 2 }[A.phase] + A.u, m = A.spec.name;
    if (MISSILE[m]) return k < 1 ? { dx: -2 * k, z: 0, squash: -.5 * k } : k < 2 ? { dx: lerp(-2, 2, E.ease.outQuad(k - 1)), z: 0, squash: .3 } : { dx: 2 * (1 - E.ease.inOut(k - 2)), z: 0, squash: .3 * (3 - k) };
    const reach = L.reach * (BITE.has(m) ? .6 : 1), h = L.h * (BITE.has(m) ? .3 : POUNCE.has(m) ? 1.5 : 1);
    if (k < .5) return { dx: -L.back * k * 2, z: 0, squash: -.6 * k };                                        // gather
    if (k < 2) { const u = (k - .5) / 1.5; return { dx: lerp(-L.back, reach, E.ease.outQuad(u)), z: h * Math.sin(u * Math.PI), squash: u < .85 ? L.air : L.land }; }
    const u = k - 2; return { dx: reach * (1 - E.ease.inOut(u)), z: 0, squash: L.land * (1 - u) };                // land on the target, back off
  }
  // everything else becomes squash and stretch, hops, and the bat's flaps or roost (upside down, wings fanning, feet up)
  const LOW = new Set(['crouch', 'kneel', 'guard']);
  function blobState(a, st) {
    const j = st.attack ? leap(a.s.leap, st.attack) : null, flat = st.down || 0, low = LOW.has(st.pose) || flat > .5, hang = !!a.s.fly && (low || !!st.climb);
    const sp = Math.min(1, (st.speed || 0) + (st.pose === 'cheer' ? 1 : 0)), h = Math.abs(Math.sin(t * 9)) * sp;   // hops while walking or cheering
    return { dx: (st.dx || 0) + (j ? j.dx : 0), hang, flap: hang ? .2 : j && j.z < -2 ? .25 : 1, walk: sp, squint: !!st.hurt || flat > .5,
      z: hang ? TOPZ - 4 - 2 * a.blob.o.R : Math.max(0, (a.s.fly ? a.s.fly + Math.sin(t * 5) * 1.5 : h * 5) + (st.z || 0) + (j ? j.z : 0)),
      squash: hang ? .15 : j ? j.squash : st.air ? .25 : flat ? -.45 * flat : low || st.hurt ? -.3 : (h - .5) * .3 * sp };
  }
  // the lineup stands along the screen's x axis in every view and turn, spaced to stay on the floor
  const gap = () => { const w = game.view.yaw; return Math.min(24, 168 / (5 * Math.abs(Math.cos(w)) + .01), 74 / (5 * Math.abs(Math.sin(w)) + .01)); };
  const slot = a => { const w = game.view.yaw, k = (a.i - (SKINS.length - 1) / 2) * gap(); return [CX + Math.cos(w) * k, LY - Math.sin(w) * k]; };
  const fit = () => game.setZoom(clamp((game.W - 24) / ((10 * gap() + 30) * game.view.scale / game.zoom), .5, 2));
  // hair and capes are simulated: when a rig jumps across the stage (a new animation or skin, the lineup) it first plays
  // the current pose unseen for a moment, so nothing whips across the screen (standing: a fall or a death still plays
  // from the start). A draw now and then tells it the view
  const SCRATCH = E.ctx2d(E.mkCanvas(4, 4));
  function settle() {
    const st = anim.phases ? Object.assign(phaseAt()[1], { pose: null, down: 0 }) : {};
    for (const a of shown()) for (let i = 0; i < 90; i++) { drive(a, st, 1 / 60); if (a.rig && i % 30 === 0) a.rig.draw(SCRATCH, 0, 0, game.view); }
  }
  function drive(a, st, dt, on) {
    const b = a.blob && blobState(a, st), dx = b ? b.dx : st.dx || 0;
    // velocity makes the legs step: a speed, or the real motion of dx (a slide keeps the feet planted)
    const v = st.speed !== undefined ? st.speed * (a.rig ? a.rig.o.speedRef : 50) : st.slide ? 0 : (dx - a.dx) / dt;
    let f = st.facing === undefined ? face : st.facing, x, y;
    a.turn = lerp(a.turn || 0, st.turn || 0, Math.min(1, dt * 8));   // turn toward the camera, smoothly
    if (a.turn > .01) { const c = Math.atan2(game.view.fy, game.view.fx) - f; f += clamp(Math.atan2(Math.sin(c), Math.cos(c)), -a.turn, a.turn); }
    if (st.ring && !lineup) {                    // round the ring: the feet really plant, capes and hair trail, every side shows
      a.ang = (a.ang || 0) + v * dt / RING; f = a.ang + Math.PI / 2;
      x = CX + Math.cos(a.ang) * RING; y = CY + Math.sin(a.ang) * RING;
    } else { const [sx, sy] = lineup ? slot(a) : [CX, CY]; x = sx + Math.cos(face) * dx; y = (b && b.hang ? BEAM : sy) + Math.sin(face) * dx; }
    const k = a.s.fly ? Math.min(1, dt * 10) : 1, z0 = a.z;   // the bat glides (up to its roost); everyone else is placed exactly
    a.x = lerp(a.x, x, k); a.y = lerp(a.y, y, k); a.z = lerp(a.z, b ? b.z : st.z || 0, k); a.dx = dx; a.flash = (a.flash || 0) - dt;
    if (b) a.blob.update(dt, Object.assign(b, { look: [Math.cos(f), Math.sin(f)] }));
    else {
      a.rig.o.cheat = st.climb ? 0 : .5;        // on the ladder the back faces the camera squarely
      // vz: the real climbing speed paces the hands
      a.rig.update(dt, Object.assign({}, st, { x: a.x, y: a.y, z: a.z, vx: v * Math.cos(f), vy: v * Math.sin(f), vz: (a.z - z0) / dt, facing: f }));
      if (st.squat) a.rig.kick(-260 * st.squat * dt);   // keep pushing the squash spring: a deeper crouch (about -squat)
    }
    if (on) on(a);
  }

  /* ---- STAGE: a sand training square in a flagstone yard, a wall at the back, a rack to climb and roost on ---- */
  const bg = new E.Backdrop('dusk');
  const SAND = { base: '#b8966a', dark: '#9a7a52', light: '#d2b486' }, CHALK = E.hex('#f2ecd8'), EDGE = E.hex('#5a3e2a');
  const STONE = { stones: ['#8a8496', '#948ea0', '#7e7890'].map(E.hex), mortar: E.hex('#4a4458'), hi: E.hex('#aaa4b6'), lo: E.hex('#686276'), speck: E.hex('#5a5468') };
  function floorTex(x, y) {
    if (x < 30 || x > 354 || y < 36 || y > 182) return E.tex.flagstone(x, y, STONE);
    if (x < 32 || x > 352 || y < 38 || y > 180) return EDGE;                                          // a timber edge round the sand
    const rx = Math.abs(((x - CX) % 16 + 24) % 16 - 8), ry = Math.abs(y - CY), ring = Math.abs(Math.hypot(x - CX, y - CY) - RING);
    if ((rx > 7.4 && ry < 3) || ry < .5 && Math.abs(x - CX) < 6 || ring < .6) return CHALK;            // chalk: a mark every 16 units, the spot, a ring
    return E.tex.dirt(x, y, SAND);
  }
  const map = new E.TileMap({ rows: ['#'.repeat(24), ...Array(11).fill('.'.repeat(24))], legend: { '#': 1 }, floorTex, ao: 6,
    types: { 1: { h: 26, face: 'stone', roof: 'slab', side: '#6a6480', top: '#8a84a0' } } });
  const WOOD = ['#a8743e', '#6e4628'], SACK = ['#c8a468', '#8a6a3c', '#5a3a22'];
  function rack(r) {                             // posts and a beam, queued in short pieces so they sort right in every view
    for (const x of [22, 362]) r.queue(x, BEAM, 0, g => r.box(g, x - 2, BEAM - 2, 0, x + 2, BEAM + 2, TOPZ, ...WOOD));
    for (let x = 20; x < 364; x += 24) r.queue(x + 12, BEAM, TOPZ, g => r.box(g, x, BEAM - 1.5, TOPZ - 4, Math.min(x + 24, 364), BEAM + 1.5, TOPZ, ...WOOD));
  }
  function ladder(r, x) {                        // two rails and rungs, just behind the climber, up to the beam
    const y = CY - 3, w = Math.max(1, Math.round(r.view.scale * .7));
    r.queue(x, y, 0, g => {
      const L = (x0, z0, x1, z1) => { const a = r.w(x0, y, z0), b = r.w(x1, y, z1); px.line(g, a[0], a[1], b[0], b[1], WOOD[1], w); };
      for (const s of [-7, 7]) L(x + s, 0, x + s, TOPZ - 4);
      for (let z = 3; z < TOPZ - 4; z += RUNG) L(x - 7, z, x + 7, z);
    });
  }
  function dummy(r) {                            // a straw sack on a post; it leans away from the hit and springs back
    r.shadow(dum.x, dum.y, 5, .4);
    r.actor(dum.x, dum.y, 0, (g, ox, oy) => {
      const v = r.view, s = v.scale, L = Math.sin(dum.lean), at = h => { const p = v.p(Math.cos(face) * L * h, Math.sin(face) * L * h, h); return [ox + p[0], oy + p[1]]; };
      const [x0, y0] = at(0), [x1, y1] = at(30), [bx, by] = at(19), [hx, hy] = at(31);
      px.line(g, x0, y0, x1, y1, WOOD[1], Math.max(1, Math.round(s * 1.4)));
      px.ell(g, bx, by, 4.5 * s, 7 * s, SACK[1]); px.ell(g, bx - .6, by - .6, 4.5 * s - 1, 7 * s - 1, SACK[0]);
      px.line(g, bx - 4 * s, by + 2 * s, bx + 4 * s, by + 2 * s, SACK[2], Math.max(1, Math.round(s * .6)));   // a rope round the waist
      px.disc(g, hx, hy, 3.4 * s, SACK[1]); px.disc(g, hx - .6, hy - .6, 3.4 * s - 1, SACK[0]);
    });
  }
  const PROPS = [['torch', 60, 17, 8], ['torch', 324, 17, 8], ['banner', 132, 17, 0, { color: '#8a2a4a' }], ['banner', 252, 17, 0, { color: '#2a4a8a' }],
    ['barrel', 16, 118, 0], ['barrel', 20, 132, 0], ['crate', 368, 124, 0], ['pot', 356, 140, 0]];
  // spears racked against the wall, from the asset store (docs/ASSETS.md), cut into the page's 'animlab' set
  // (src/assets/sets/animlab.js), turning with the view like the rigs [id, x, y, facing, scale]; none without the set
  const SHAFT = { b: '#7a5634 none' };   // (the kit's shaft is a plank pattern: on a pole it reads as stripes)
  const RACK = E.addAssets((window.ASSETS || {}).animlab || { set: 'animlab' }).shapes.length ? [88, 95, 102, 280, 287].map((x, i) => ['animlab:weapon-spear', x, 19 + (i & 1), 1.5 + i * .07, 1.1]) : [];

  /* ---- KEY POSES: each extreme of a move frozen at a phase and u, drawn once into small images ---- */
  function keyPoses() {
    const a = actors[skin], v = game.view, id = ai + ':' + skin + ':' + v.id + ':' + v.yawDeg + ':' + face;
    if (keysFor === id) return keys;
    keysFor = id; keys = [];
    if (!a.rig || !(anim.move || anim.combo)) return keys;
    const view = new E.View('key', 'Key', v.yawDeg, v.pitchDeg, .6, v.zBoost);
    const list = anim.move ? [['WIND', anim.move, 'wind', 1], ['HIT', anim.move, 'active', 1], ['FOLLOW', anim.move, 'recover', .3]] : anim.combo.map(m => [m.toUpperCase(), m, 'active', 1]);
    for (const [label, m, phase, u] of list) {
      const rig = new E.Humanoid(Object.assign({ size: 1.3 }, a.s.rig)), cv = E.mkCanvas(40, 36), g = E.ctx2d(cv), spec = move(m).spec;
      rig.draw(g, 20, 32, view);                 // the first draw tells the rig the view: side views chop in the screen plane
      for (let i = 0; i < 40; i++) rig.update(1 / 60, { x: 0, y: 0, facing: face, attack: { spec, phase, u } });
      g.clearRect(0, 0, 40, 36); rig.draw(g, 20, 32, view); keys.push({ label, cv });
    }
    return keys;
  }

  /* ---- DRAW ---- */
  function draw(r) {
    const list = shown();
    bg.draw(r); map.drawFloor(r);
    for (const a of list) r.shadow(a.x, a.y, (a.rig ? 6 : a.blob.o.R) * Math.max(.4, 1 - a.z / 60), .45);
    map.queueWalls(r); rack(r);
    for (const [kind, x, y, z, o] of PROPS) r.prop(kind, x, y, z, o);
    for (const [id, x, y, facing, scale] of RACK) r.shape(id, x, y, 0, { facing, scale, mats: SHAFT });
    if (anim.ladder) for (const a of list) ladder(r, a.x);
    if (dummyOn()) dummy(r);
    for (const a of list) {
      r.actor(a.x, a.y, a.z, (g, ox, oy) => (a.rig || a.blob).draw(g, ox, oy, r.view), { flash: a.flash > 0 });
      // the glowing path of the blade, fist or foot. Only the ribbon (2+ samples): the engine's fallback arc for the
      // first frame is drawn at the wrong height for rel moves (see the engine requests)
      if (a.rig && trail && a.rig.trail.length > 1) a.rig.drawSmear(r);
    }
    shots.draw(r);
    if (bones) r.overlay(() => { for (const a of list) if (a.rig) a.rig.debug(r); });
    if (!hidden) r.overlay(g => hud(g, r));
  }

  /* ---- HUD: E.ui.box windows and E.font text. The timeline bar shows the loop's phases and where the clock is.
   * The top line stays free for the shell's notes (ZOOM 2x, SIDE VIEW) ---- */
  const WIN = { bg: ['#2c2458', '#0e0a20'], border: '#b0a0e8' }, SEE = Object.assign({ alpha: .75 }, WIN);
  const TXT = { outline: false, shadow: '#07050e' }, TINY = Object.assign({ font: 'tiny' }, TXT), RIGHT = o => Object.assign({ align: 'right' }, o);
  const LEGEND = ['↑↓ ANIMATION  ←→ SKIN  V VIEW  - = ZOOM  [ ] TURN  0 RESET  F FLIP', 'SPACE PAUSE  . STEP  S SLOW  T TRAIL  B BONES  L LINEUP  J REPLAY  H HUD'];
  function hud(g, r) {
    const W = r.W, H = r.H, N = ANIMS.length, a = actors[skin], lead = anim.group + ' ▸ ', T0 = Math.max(0, Math.round(corner()[1]) - 9);   // T0: under the corner's buttons (they stay up in a lab)
    E.ui.box(g, 4, T0 + 11, W - 8, 34, WIN);
    E.font.title(g, 'ANIMATION LAB', 10, T0 + 15, { scale: 1, colors: ['#fff6d0', '#ffd060', '#e8782a'], depth: 1 });
    E.font.text(g, lineup ? 'LINEUP: ALL ' + actors.length + ' SKINS' : '← ' + a.s.name + ' →', W - 10, T0 + 15, '#ffffff', RIGHT(TXT));
    E.font.text(g, lead, 10, T0 + 26, '#a8a0d8', TXT);
    E.font.text(g, anim.name, 10 + E.font.width(lead), T0 + 26, '#ffe070', TXT);
    const cam = [game.view.label + ' view', 'zoom ' + +game.zoom.toFixed(2) + 'x', game.yaw ? 'turn ' + game.yaw + ' deg' : '', paused ? 'paused' : game.timeScale < 1 ? 'slow .25x' : 'speed 1x'];
    E.font.text(g, cam.filter(Boolean).join('    '), 10, T0 + 37, paused ? '#ff9a7a' : '#c8c0f0', TINY);
    if (!lineup) {
      // the animation list: the neighbours of the current one, groups in alternating tints
      E.ui.box(g, 4, T0 + 48, 100, 61, SEE);
      for (let k = -3; k <= 3; k++) {
        const n = ANIMS[(ai + k + N) % N], odd = GROUPS.indexOf(n.group) % 2;
        E.font.text(g, (k ? '  ' : '> ') + n.name, 8, T0 + 52 + (k + 3) * 8, k ? (odd ? '#d0b890' : '#a8a0d8') : '#ffffff', TINY);
      }
      E.font.text(g, (ai + 1) + '/' + N, 100, T0 + 101, '#8a82b0', RIGHT(TINY));
      // key poses of a move; the one playing now is lit
      const cur = attack ? ['wind', 'active', 'recover'].indexOf(attack.phase) : combo && combo.busy ? combo.step : -1;
      keyPoses().forEach((k, i) => {
        const y = T0 + 48 + i * 39, lit = i === cur;
        E.ui.box(g, W - 46, y, 42, 38, lit ? { bg: ['#5a4a2a', '#1a1208'], border: '#ffe070' } : SEE);
        g.drawImage(k.cv, W - 45, y + 1);
        E.font.text(g, k.label, W - 25, y + 31, lit ? '#ffe070' : '#c8c0f0', Object.assign({ align: 'center' }, TINY));
      });
    }
    // the timeline: one bar per phase (the current one lit), the clock as a white mark, the phase's name and the time; clear
    // of the touch buttons when they show: beside them where there is room, else above them
    const ta = game.input.touchArea(), side = ta && ta.x0 > 200, B = ta && !side ? Math.floor(ta.y0) - 2 : H, BW = side ? Math.floor(ta.x0) - 8 : W - 8;
    E.ui.box(g, 4, B - 36, BW, 33, WIN);
    const bx = 10, bw = BW - 116, by = B - 31;
    let t0 = 0, label = '';
    for (const [name, secs, c] of anim.segs) {
      const x0 = bx + Math.round(t0 / anim.len * bw), x1 = bx + Math.round((t0 + secs) / anim.len * bw), on = t > t0 && t <= t0 + secs;
      px.rect(g, x0, by + (on ? 0 : 1), Math.max(1, x1 - x0 - 1), on ? 7 : 5, on ? c : E.shade(c, -.35));
      if (on) label = name;
      t0 += secs;
    }
    px.rect(g, bx + Math.round(Math.min(1, t / anim.len) * bw), by - 2, 1, 11, '#ffffff');
    E.font.text(g, label + '  ' + t.toFixed(2) + ' / ' + anim.len.toFixed(2) + 's', BW - 2, by + 1, '#ffe8b0', RIGHT(TINY));
    (touch() ? ['STICK ↑↓ ANIMATION   ←→ SKIN', 'THE BUTTONS: REPLAY, SLOW, HOLD'] : LEGEND).forEach((s, i) => E.font.text(g, s, 10, B - 21 + i * 8, '#b8b0e0', TINY));
  }

  /* ---- UPDATE: keys, then the clock (paused: . steps one 60th of a second) ---- */
  function update(dt) {
    const inp = game.input, vk = game.view.id + game.view.yawDeg;
    if (vk !== viewKey) { viewKey = vk; if (lineup) fit(); play(ai); }   // a new view or turn: moves pick their swing plane again
    if (inp.pressed('turn')) game.note('TURN ' + game.yaw + ' DEG');     // the pixel font has no degree sign
    if (inp.repeat('up')) play(ai - 1);
    if (inp.repeat('down')) play(ai + 1);
    if (inp.repeat('left')) pick(skin - 1);
    if (inp.repeat('right')) pick(skin + 1);
    if (inp.pressed('replay')) { paused = false; play(ai); }
    if (inp.pressed('hold')) paused = !paused;
    if (inp.pressed('slow')) { game.timeScale = game.timeScale < 1 ? 1 : .25; game.note(game.timeScale < 1 ? 'SLOW MOTION' : 'FULL SPEED'); }
    if (inp.pressed('trail')) { trail = !trail; game.note('TRAIL ' + (trail ? 'ON' : 'OFF')); }
    if (inp.pressed('bones')) { bones = !bones; game.note('SKELETON ' + (bones ? 'ON' : 'OFF')); }
    if (inp.pressed('flip')) { face = Math.PI - face; play(ai); game.note(Math.cos(face) > 0 ? 'FACING RIGHT' : 'FACING LEFT'); }
    if (inp.pressed('hud')) hidden = !hidden;
    if (inp.pressed('lineup')) { lineup = !lineup; if (lineup) fit(); else game.setZoom(1.5); play(ai); game.note(lineup ? 'LINEUP: EVERY SKIN' : 'ONE SKIN'); }
    if (inp.pressed('back')) game.go('title');
    dum.x = CX + Math.cos(face) * dum.d; dum.y = CY + Math.sin(face) * dum.d;
    if (!paused) tick(dt); else if (inp.pressed('step')) tick(1 / 60);
    // look at the spot (between the subject and the dummy, or after a knocked-back subject), up with a climber;
    // side-on views keep the feet near the bottom of the screen
    const a = actors[skin], lead = dummyOn() ? dum.d / 2 : 0, chase = anim.group === 'REACTIONS' ? .7 : 0, low = game.view.pitchDeg < 40 ? Math.max(20, 70 / -game.view.bz) : 20;
    const x = lineup ? CX : lerp(CX, a.x, chase) + Math.cos(face) * lead, y = lineup ? LY : lerp(CY, a.y, chase) + Math.sin(face) * lead;
    game.focus(x, y, lineup ? 12 : a.s.fly ? Math.max(a.z, a.s.fly) + 5 : low + (anim.ladder ? a.z : 0));   // a flier stays mid-screen
  }
  function enter() {
    game.cam.bounds = null; game.cam.room = null; game.timeScale = 1; L.enabled = false; A.music(null);
    game.resetCamera(); lineup = false; paused = false; viewKey = ''; play(ai);
  }
  return { view: 'side', views: ['side', 'brawler', 'threequarter', 'iso', 'topdown'], res: 'ps1', propSize: 1.3, camera: { zoom: [.5, 3], start: 1.5, rotate: true }, touch: ['replay', 'slow', 'hold'],   // the stick picks (up, down) and dresses (left, right)
    input: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], replay: ['KeyJ', 'Enter'], hold: ['Space'], step: ['Period'],
      slow: ['KeyS'], trail: ['KeyT'], bones: ['KeyB'], lineup: ['KeyL'], flip: ['KeyF'], hud: ['KeyH'], turn: ['BracketLeft', 'BracketRight'], back: ['Escape'] },
    enter, exit() { game.timeScale = 1; game.resetCamera(); }, update, draw,
    // for tools and tests: __game.scenes.animlab.select('overhead', 'mage') or select('poses-cast') (spaces and dashes ignored)
    select(name, skinName) {
      const key = s => s.toUpperCase().replace(/[^A-Z]/g, ''), i = ANIMS.findIndex(a => key(a.group + a.name) === key(name) || key(a.name) === key(name)); if (i >= 0) play(i);
      if (skinName) pick(Math.max(0, actors.findIndex(a => a.s.name === skinName.toUpperCase())));
    } };
})();
scenes.animlab = ANIMLAB;
