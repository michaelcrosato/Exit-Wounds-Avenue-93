// A new playable character for Emberdeep, from a template that already works: it registers with def('characters')
// (src/emberdeep/18-characters.js), has two starting skills of its own, and passes `npm run character:check -- <id>`
// before anything is changed. Then make it yours: the brief, the look, the skills (docs/CHARACTERS.md is the recipe).
// Usage: npm run new:character -- <id> [--body humanoid|custom] [--name "Ranger"] [--title "The Far-Sighted"]
//   --body humanoid (the default): the engine's Humanoid dressed in a look of its own. It gets every move, pose, captured
//          clip, cloth cape and hair, the paper doll and the Echo for free. Pick this unless the body is the point.
//   --body custom: a procedural body of its own (like Codex, 21-codex.js) that keeps the body contract: more to write,
//          nothing borrowed. Start here when the hero is not a person (a book, a wisp, a beast).
// Writes src/emberdeep/22-char-<id>.js (one file: no other file changes) and prints the next steps.
//        node tools/new-character.mjs --test   writes both templates to a scratch page and runs the character test on
//                                               them (npm test runs this, so the templates never rot)
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), dir = join(root, 'src/emberdeep');
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const cap = s => s[0].toUpperCase() + s.slice(1);

/** the file for a character: its registration, its body (custom) or its look (humanoid), and two skills of its own */
function template(id, body, name, title) {
  const P = id.toUpperCase().replace(/[^A-Z0-9]/g, '') + '_', Rig = cap(id) + 'Rig';
  const head = `/* =============================================================================
 * ${name.toUpperCase()}, ${title}: a playable character (18-characters.js; the recipe is docs/CHARACTERS.md)
 * Written by \`npm run new:character -- ${id} --body ${body}\`: every part works and passes \`npm run character:check -- ${id}\`.
 * Make it yours, checking after each step:
 *   1. the brief (desc and style below): who it is, how it moves, how it fights, its silhouette in a few words;
 *   2. its ${body === 'custom' ? 'body (' + Rig + ': the parts it is made of, how they move, its colors)' : 'look (the Humanoid\'s options: build, outfit, hair, hat, cape, colors)'};
 *   3. its skills (${P}strike, ${P}bolt: rename, reshape, add up to six; the spec is at the top of 25-skills-core.js);
 *   4. its movement numbers, its stats, and the hooks it needs (kit, dropIn, titlePose, menuNotes: 18-characters.js).
 * Names at the top level of this file share the game's one scope: keep the ${P} prefix on everything new.
 * ============================================================================= */
`;
  const skills = `
/* ---------- its own skills: character: '${id}' keeps them its own (the others never see them) ---------- */
def('skills', '${id}_strike', {
  name: '${name} Strike', kind: 'basic', tags: ['melee', 'attack'], el: 'phys', cost: 0, gen: 6, unlock: 1, color: '#5a4a6a', character: '${id}',
  runes: [{ id: 'heavy', name: 'Heavy Strike', desc: 'An overhead blow: slower, harder, knocks back further.' }, { id: 'rend', name: 'Rending Strike', desc: 'Every hit makes the enemy bleed.' }],
  desc: (rank, rune) => 'A quick strike at the enemy in front. Generates Ember.' + (rune === 'heavy' ? ' An overhead blow that hits harder.' : rune === 'rend' ? ' Hits cause bleeding.' : ''),
  icon: (g, x, y, s) => ICON.sword(g, x, y, s),
  cast(h, ctx) {
    h.facing = h.aim;
    const heavy = ctx.rune === 'heavy', atk = new E.Attack(heavy ? 'overhead' : 'slash'); atk.start();   // any move of E.MOVES, or your own spec
    return swingAction(h, atk, { name: '${id}_strike', range: 28, half: 1.25, push: heavy ? 90 : 60,
      hit: u => ctx.hit(heavy ? 1.5 : 1, { kb: heavy ? 180 : 80, extra: { ang: angTo(h, u), status: ctx.rune === 'rend' ? 'bleed' : undefined, statusChance: ctx.rune === 'rend' ? 1 : undefined } }),
      onHit: u => { const a = angTo(h, u); game.freeze(heavy ? .06 : .04); shake(heavy ? 3 : 2); P.sparks(lerp(h.x, u.x, .6), lerp(h.y, u.y, .6), 10, 7, a); sfx('hit', { vol: .5 }); } });
  }
});
def('skills', '${id}_bolt', {
  name: '${name} Bolt', kind: 'core', tags: ['spell', 'proj'], el: 'void', cost: 8, unlock: 1, color: '#3a2a5a', character: '${id}',
  runes: [{ id: 'split', name: 'Scatter', desc: 'Throws three bolts in a fan.' }, { id: 'pierce', name: 'Lance', desc: 'The bolt passes through two more enemies.' }],
  desc: (rank, rune) => 'Hurl a bolt of void from the free hand.' + (rune === 'split' ? ' Three bolts in a fan.' : rune === 'pierce' ? ' It pierces two more enemies.' : ''),
  icon: (g, x, y, s) => ICON.orb(g, x, y, s, '#b88aff'),
  cast(h, ctx) {
    const atk = new E.Attack('cast'); atk.start(); h.facing = h.aim;
    return { name: '${id}_bolt', atk, moveK: .55, face: h.aim, cancel: true, speed: h.castMul, rig: { attack: null }, free: false,
      update(dt) {
        const began = atk.update(dt); this.rig.attack = atk.state;
        if (began === 'active') {
          const [hx, hy] = h.rig.hand('L'), n = 1 + ctx.proj + (ctx.rune === 'split' ? 2 : 0);
          for (let i = 0; i < n; i++) FX.bolt({ team: 'hero', src: h, x: hx, y: hy, z: 11, ang: h.aim + (n > 1 ? (i / (n - 1) - .5) * .22 * (n - 1) : 0), speed: 260, life: 1.1, r: 3, el: 'void',
            pierce: ctx.pierce + (ctx.rune === 'pierce' ? 2 : 0), chain: ctx.chains, hit: ctx.hit(1, { kb: 70 }), look: { kind: 'bolt', color: '#b88aff', core: '#f0e0ff' } });
          sfx('shoot', { vol: .6 }); P.glints(hx, hy, 11, 4, '#d8c0ff', 8);
        }
        this.free = !atk.state || atk.state.phase === 'recover';
        return atk.busy;
      } };
  }
});
`;
  const entry = (extra) => `
/* ---------- the character ---------- */
def('characters', '${id}', {
  name: '${name}', title: '${title}', color: '#c8a0ff',
  desc: 'TODO the brief: who ${name} is and why they go down, in a sentence or two.',
  style: 'TODO how it plays · in three · short phrases',
  skills: ['${id}_strike', '${id}_bolt'],                         // starting skills: LMB, RMB, then 1-4
  speed: 84, acceleration: 1000, dodgeTime: .27, dodgeSpeed: 255,   // the Wanderer's numbers: make them its own
${extra}});
`;
  if (body === 'humanoid') return head + skills + entry(`  // its look under the gear: any E.Humanoid option (build chibi | heroic | bulky, outfit tunic | robe | coat, hair short | spiky | long |
  // ponytail, hat, armor, sleeves) and colors. Gear still changes it; the Echo and the paper doll wear it too
  look: { build: 'heroic', outfit: 'coat', hair: 'ponytail', colors: { hair: '#c8a062', skin: '#e8b890' } },
  kit(h) {   // its starting gear, over the shared kit (longsword, tunic, shoes, cape): name it and color it
    h.gear.chest.name = 'Traveller\\'s Coat'; h.gear.chest.look.colors.cloth = '#4a3a6a';
    h.gear.cloak.look.colors = { cape: '#2a2440', capeIn: '#c8a0ff' };
  }
`);
  // a custom body: everything the BODY CONTRACT asks (18-characters.js), drawn from continuous, eased values
  return head + `
/** ${name}'s body: a hooded figure that floats, with two hands of light. Local frame: f forward, r right, z up */
class ${Rig} {
  constructor(hero) {
    this.hero = hero;
    this.o = { size: 1, weapon: null, bladeLen: 9, hunch: 0, lean: 0 };
    this.C = { robe: '#3a4a7a', trim: '#e0c070', face: '#1a1426', eye: '#bff6ff', glow: '#8fe0ff', metal: '#dce8f1', hilt: '#e0c070' };
    this.t = Math.random() * 10; this.phase = 0; this.facing = 0; this.x = this.y = this.z = 0;
    this.run = this.fold = this.fall = this.lift = this.wave = this.guard = this.hurt = this.swing = this.recoil = 0;
    this.J = {}; this.state = {}; this.trail = [];
    this.update(0, {});
  }
  kick(v) { this.recoil = clamp(this.recoil + v * .15, -2, 2); }
  _w(p) { const c = Math.cos(this.facing), s = Math.sin(this.facing), k = this.o.size; return [(p[0] * c - p[1] * s) * k, (p[0] * s + p[1] * c) * k, p[2] * k]; }
  _at(p) { const w = this._w(p); return [this.x + w[0], this.y + w[1], this.z + w[2]]; }
  hand(side = 'R') { return this._at(this.J['hand' + side] || this.J.handR); }
  head() { return this._at(this.J.head); }
  tip() { return this._at(E.V3.add(this.J.handR, E.V3.mul(this.J.bladeDir, this.o.bladeLen))); }
  update(dt, s = {}) {
    this.t += dt; this.state = s; this.x = s.x || 0; this.y = s.y || 0; this.z = s.z || 0; this.facing = s.facing || 0;
    const sp = Math.min(1, Math.hypot(s.vx || 0, s.vy || 0) / 90), st = s.attack;
    this.phase += dt * (2 + sp * 8);   // the gait clock (footsteps read it)
    // every weight eases toward its state, so nothing snaps from one pose to the next
    this.run = approach(this.run, s.run || sp, dt * 5);
    this.fold = approach(this.fold, s.dash ? 1 : s.pose === 'crouch' || s.pose === 'kneel' ? .4 : 0, dt * (s.dash ? 16 : 8));
    this.fall = approach(this.fall, s.pose === 'die' || s.down ? 1 : 0, dt * 3);
    this.lift = approach(this.lift, s.pose === 'cast' || s.pose === 'cheer' ? 1 : 0, dt * 7);
    this.wave = approach(this.wave, s.pose === 'wave' ? 1 : 0, dt * 7);
    this.guard = approach(this.guard, s.stance === 'guard' || s.pose === 'block' ? 1 : 0, dt * 8);
    this.hurt = approach(this.hurt, s.hurt ? 1 : 0, dt * 12);
    this.recoil *= Math.exp(-dt * 10);
    // the strike: the right hand draws back in the wind-up, sweeps across in the strike, returns in the recovery
    const sw = st ? (st.phase === 'wind' ? -E.ease.outQuad(st.u) : st.phase === 'active' ? -1 + 2 * E.ease.outCubic(st.u) : 1 - E.ease.inOut(st.u)) : 0;
    this.swing = approach(this.swing, sw, dt * 24);
    const f = this.fall, fold = this.fold, bob = Math.sin(this.t * 2.6) * .7 * (1 - f), hov = (3 + bob + this.recoil + this.run) * (1 - f) - this.hurt;
    const top = 21 * (1 - .45 * fold), lean = this.run * 2 - this.hurt * 1.5, up = this.lift * 8, w = this.swing;
    const J = {
      hipC: [0, 0, 6 + hov], shC: [lean * .5, 0, top + hov], head: [lean, 0, top + 7 + hov],
      handL: [3 + this.guard * 4, -7 - up * .4, 13 + hov + up + this.wave * (9 + Math.sin(this.t * 8) * 2)],
      handR: [3 + Math.abs(w) * 5 + this.guard * 4, 7 - w * 6, 13 + hov + up * .6 + w * 3],
      bladeDir: E.V3.norm([.8, -w * .5, .4 + w * .2])
    };
    for (const k of ['handL', 'handR']) { J[k][1] *= 1 - fold * .7; J[k][2] = lerp(J[k][2], 8, fold); }
    if (f > 0) { const a = f * 1.45, c = Math.cos(a), sn = Math.sin(a); for (const k in J) if (k !== 'bladeDir') { const p = J[k]; J[k] = [p[0] * c - p[2] * sn, p[1], Math.max(1, p[0] * sn + p[2] * c)]; } }
    this.J = J;
  }
  draw(g, ox, oy, sourceView) {
    const view = E.charView ? E.charView(sourceView) : sourceView, J = this.J, z = view.zoom || 1, k = this.o.size * (view.scale || 1);
    this._lastView = view;   // (rigScreen and held items project with it)
    const S = p => { const w = this._w(p), s = view.p(w[0], w[1], w[2]); return [ox + s[0], oy + s[1], view.depth(w[0], w[1], w[2])]; };
    const robe = E.tones(this.C.robe), trim = E.tones(this.C.trim), glow = E.tones(this.C.glow), parts = [];
    const hip = S(J.hipC), sh = S(J.shC), hd = S(J.head), r = Math.max(1, 3.4 * k);
    // the robe: a cone from the shoulders to a wide hem, its side away from the light a tone darker
    parts.push({ d: hip[2], f: () => {
      const hw = 6 * k * (1 - this.fold * .3), sw = 3.2 * k;
      px.poly(g, [[sh[0] - sw, sh[1]], [sh[0] + sw, sh[1]], [hip[0] + hw, hip[1] + 2 * k], [hip[0] - hw, hip[1] + 2 * k]], robe.base);
      px.poly(g, [[sh[0] + sw * .2, sh[1]], [sh[0] + sw, sh[1]], [hip[0] + hw, hip[1] + 2 * k], [hip[0] + hw * .2, hip[1] + 2 * k]], robe.sh);
      px.line(g, hip[0] - hw, hip[1] + 2 * k, hip[0] + hw, hip[1] + 2 * k, trim.base, Math.max(1, Math.round(k)));
      px.line(g, sh[0] - sw * .4, sh[1] + 1, sh[0] - sw * .2, hip[1], robe.lt);
    } });
    // the hood and the dark face inside it, two eyes when it faces the camera
    parts.push({ d: hd[2], f: () => {
      px.disc(g, hd[0], hd[1], r * 1.25, robe.sh); px.disc(g, hd[0] - .5, hd[1] - .5, r * 1.1, robe.base); px.disc(g, hd[0] - r * .35, hd[1] - r * .4, r * .45, robe.lt);
      const fwd = S(E.V3.add(J.head, [2.4, 0, -.4]));
      if (fwd[2] > hd[2] - .1) { px.disc(g, fwd[0], fwd[1], r * .7, this.C.face); const e = Math.max(1, Math.round(z)); px.rect(g, fwd[0] - 1.5 * e, fwd[1] - .5, e, e, this.C.eye); px.rect(g, fwd[0] + .5 * e, fwd[1] - .5, e, e, this.C.eye); }
    } });
    // the hands of light (and the wand in the right one)
    for (const side of ['L', 'R']) { const p = S(J['hand' + side]); parts.push({ d: p[2], f: () => {
      if (side === 'R') { const t = S(E.V3.add(J.handR, E.V3.mul(J.bladeDir, this.o.bladeLen))); px.line(g, p[0], p[1], t[0], t[1], trim.sh, Math.max(1, Math.round(k * .8))); px.disc(g, t[0], t[1], Math.max(1, 1.2 * k), glow.hi); }
      px.disc(g, p[0], p[1], Math.max(1, 1.9 * k), glow.base); px.disc(g, p[0] - .4, p[1] - .4, Math.max(1, 1 * k), glow.hi);
    } }); }
    parts.sort((a, b) => a.d - b.d);
    for (const p of parts) p.f();
  }
  drawSmear(r) {   // the wand's tip leaves a short streak of light while it strikes
    const s = this.state; if (!(s.attack && s.attack.phase === 'active')) { this.trail.length = 0; return; }
    const p = this.tip(); this.trail.unshift(p); this.trail.length = Math.min(5, this.trail.length);
    for (let i = 1; i < this.trail.length; i++) { const a = this.trail[i - 1], b = this.trail[i]; r.queue(a[0], a[1], a[2], g => px.line(g, ...r.w(...a), ...r.w(...b), i < 2 ? '#f0fbff' : this.C.glow), { emissive: true }); }
  }
  drawPortrait(g, x, y, size = 40) { this.draw(g, x + size / 2, y + size * 1.2, new E.View('portrait', '${name}', 0, 15, size / 27)); }
}
` + skills + entry(`  rig: h => new ${Rig}(h),   // its own body (it keeps the body contract: checkRig('${id}') says what is missing)
  ownLayers: true,           // it animates its own dodge (fold), potion and wounds; the Wanderer's layers would bend a Humanoid's joints
  head: 30                   // how tall it is: bars, numbers and effects sit there
`);
}

if (process.argv.includes('--test')) {
  // both templates on a scratch page (the game plus the two files), then the character test on each
  const tmp = join(root, 'check-output/new-character'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  const extra = { '22-char-tplhuman.js': template('tplhuman', 'humanoid', 'Tplhuman', 'The Template'), '22-char-tplbody.js': template('tplbody', 'custom', 'Tplbody', 'The Template') };
  const files = readdirSync(dir).filter(f => f.endsWith('.js')).concat(Object.keys(extra)).sort();
  const esc = s => s.replaceAll('</script', '<\\/script');
  let html = readFileSync(join(root, 'src/emberdeep.template.html'), 'utf8');
  html = html.replace(/<!-- @inline-raw (\S+) -->/g, (_, f) => esc(readFileSync(join(root, f), 'utf8')));
  html = html.replace(/<!-- @inline-parts (\S+) -->/g, () => `<script>\n${files.map(f => esc(extra[f] || readFileSync(join(dir, f), 'utf8'))).join('\n')}\n</script>`);
  html = html.replace(/<!-- @inline (\S+) -->/g, (_, f) => `<script>\n${esc(readFileSync(join(root, f), 'utf8'))}\n</script>`);
  writeFileSync(join(tmp, 'page.html'), html);
  let ok = true;
  for (const id of ['tplhuman', 'tplbody']) {
    const r = spawnSync(process.execPath, ['tools/ed-character-test.mjs', '--character', id, '--page', join(tmp, 'page.html'), '--quick', '--out', join(tmp, id)], { cwd: root, encoding: 'utf8' });
    process.stdout.write((r.stdout || '') + (r.stderr || '')); if (r.status) ok = false;
  }
  console.log(ok ? 'new-character templates: both pass the character test' : 'new-character templates FAILED');
  process.exit(ok ? 0 : 1);
}

const id = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && !(i > 0 && all[i - 1].startsWith('--') && all[i - 1] !== '--test'));
if (!id || !/^[a-z][a-z0-9]{1,15}$/.test(id)) { console.error('Usage: npm run new:character -- <id> [--body humanoid|custom] [--name "Ranger"] [--title "The Far-Sighted"]\n  id: lower case letters and digits, 2-16 long (it names the save slot, the skills and the file)'); process.exit(2); }
const body = opt('body', 'humanoid'); if (!['humanoid', 'custom'].includes(body)) { console.error('--body is humanoid or custom'); process.exit(2); }
const file = join(dir, '22-char-' + id + '.js');
const taken = readdirSync(dir).some(f => f.endsWith('.js') && new RegExp(`def\\(['"]characters['"],\\s*['"]${id}['"]`).test(readFileSync(join(dir, f), 'utf8')));
if (existsSync(file) || taken || id === 'wanderer') { console.error(`a character "${id}" exists already`); process.exit(1); }
const q = t => t.replace(/[\\']/g, m => '\\' + m);   // (the name and title go inside quotes in the file)
writeFileSync(file, template(id, body, q(opt('name', cap(id))), q(opt('title', 'The Unnamed'))));
const syn = spawnSync(process.execPath, ['tools/ed-syntax.mjs', '--all'], { cwd: root, encoding: 'utf8' });
console.log(`wrote src/emberdeep/22-char-${id}.js (${body} body, two skills of its own)${syn.status ? '\n' + syn.stdout + syn.stderr : ''}
next:
  npm run character:check -- ${id}     the test and the sheet: it passes as written
  then follow docs/CHARACTERS.md: the brief, the ${body === 'custom' ? 'body' : 'look'}, the skills, checking after each
  play it: examples/emberdeep.html?character=${id}#town (after node tools/build.mjs)`);
