# my-3D2dge API index (v0.46.1)

Every public name in `engine/my-3d2dge.js`, one line each: its signature (and default, for a field) and what its doc comment says (a long one's options on lines of their own: `new E.Game({ expand })`). Written by `node tools/api-index.mjs` from the engine itself; `doctrine-check` fails when a public name has no description here. Search it for a name; `API.md` and the agent edition's header are the overviews. † marks a name the agent edition (`my-3d2dge-agent.js`) doesn't have.

## Units and the height rules

| Quantity | Unit |
| --- | --- |
| Distances, positions, sizes in the world | world units: one floor tile is 16; x east, y south, z up |
| Speeds, gravity | world units per second, per second squared |
| Time, `dt` | seconds (`dt` is one fixed step: 1/120 s of real time times `game.timeScale`) |
| Angles, `facing`, `dir` | radians: 0 east, π/2 south (a direction may also be a ground vector `[dx, dy]`) |
| Screen positions | pixels of the game's own low-resolution buffer (`game.screen.W` × `H`) |
| Colors | `'#rrggbb'` strings |

- A body's `z` is its feet. A cell's top is `map.height(cx, cy)`: 0 on the floor; a wall is solid from 0 up to its `h`.
- A body stands on the highest top within `z + 2` under its footprint (`E.HEIGHTS.step`, `Body.step`).
- Eyes are at `z + 30` and a target is seen at `z + 22` (`E.HEIGHTS.eye`, `chest`; a body's own `eye` and `chest` override them).
- Two things are on the same level when `|dz| <= 8` (`E.HEIGHTS.level`), unless a call says otherwise.
- Collision, standing, sight (`map.sight`, `map.ray`), reach (`E.targets`, `E.inArc` with `dz`) and navigation (`E.FlowField`) all follow these rules. `E.dist` is 3D; `E.overlap` is flat.

## Examples

Each runs in `tools/contract-test.mjs`.

```js headless
// a game with no display, in Node or a test: fixed steps, scripted input, its state
const E = My3D2dge, game = new E.Game({ headless: true, res: 'snes' });
const hero = new E.Body({ x: 40, y: 40, r: 5 });
game.start({ update(dt) { hero.vx = game.input.move()[0] * 80; if (game.input.pressed('jump')) hero.jump(210); hero.update(dt); }, draw() {} });
game.input.hold('right'); game.input.tap('jump');
game.advance(0.25);   // 30 fixed steps of 1/120 s, at once
if (!(hero.x > 55 && hero.z > 20)) throw new Error('the hero should run right and be in the air');
game.dispose();
```

```js heights
// a guard on a roof, a hero in the street: sight, reach and a climb read heights the same way
const E = My3D2dge, map = new E.TileMap({ rows: ['#######', '#.....#', '#..RR.#', '#######'], legend: { '#': 1, R: 2 }, types: { 1: { h: 80 }, 2: { h: 40 } } });
const guard = { x: 56, y: 40, z: 40, facing: Math.PI }, hero = { x: 36, y: 40, z: 0, r: 5 };
if (!map.sight(guard, hero)) throw new Error('eyes on a roof see down into the street');
if (E.targets(guard, [hero], { range: 60 }).length) throw new Error('not on the same level: no melee target');
const up = map.ledge(hero, 0);   // east, toward the roof
if (!up || up.z !== 40) throw new Error('a ledge to climb onto the roof');
```

## Contents

The line each section starts on, and the name its classes' instances go by: `E.Attack: slash` lists its members as `slash.start`.

- 80 The engine object (E = My3D2dge)
- 91 Math
- 148 Pixel primitives
- 167 Views (projections); E.View: view
- 194 Screen; game.screen
- 215 Input; E.Input: input
- 287 Pixel font
- 298 Lighting; game.lights
- 312 Particles; E.Particles: game.particles
- 332 Renderer; r
- 375 Game; E.Game: game
- 484 Standard features; settings, fullscreen
- 503 Humanoid rig; E.Attack: slash, E.Combo: combo, E.Humanoid: rig
- 574 Blob rig; E.Blob: blob
- 594 Tile map; E.TileMap: map
- 650 Materials
- 671 Flow field; E.FlowField: flow
- 689 Texture helpers for floortex functions
- 700 Platform map; E.PlatformMap: level, E.Platformer: hero
- 762 Body; E.Body: body
- 782 Actions; E.Action: action, E.Mover: mover, E.Suspicion: suspicion
- 842 Bullets; E.Bullets: shots
- 862 Spatial hash; E.SpatialHash: grid
- 872 Audio; game.audio
- 893 Backdrops; E.Backdrop: backdrop
- 912 Ui; E.Dialog: talk, E.Menu: menu, E.Shell: shell
- 992 Gpu lighting (webgpu); game.gpu
- 1012 Sessions

## The engine object (E = My3D2dge)

- `E.DEG: 0.017453292519943295`: π/180, one degree in radians (angle * DEG)
- `E.TAU: 6.283185307179586`: 2π, a full turn in radians
- `E.build: "dev-build"`: the commit this copy was built from, a placeholder in the repo that tools/stamp.mjs replaces when the site deploys (e.g. 'a1b2c3d 2026-10-07')
- `E.current: null`: the latest game made (My3D2dge.current, for tools and tests)
- `E.name: "my-3D2dge"`: the engine's name, 'my-3D2dge'
- `E.version: "0.46.1"`: the release (package.json, written everywhere by node tools/version.mjs)
- `E.versionLabel()`: 'v0.7.0 · a1b2c3d 2026-10-07': the label to show on screens and in reports
- `E.warn(key, msg)`: one console warning per distinct problem, prefixed so tools (and people) can spot engine advice: warn(key, message)

## 1. Math

- `E.HEIGHTS: eye, chest, level, step`: the numbers of THE HEIGHT RULES, which collision, standing, sight, reach, navigation and drawing all read (API.md, "Heights", and the API index's head give the rules), in world units above a body's feet. The defaults fit a size-1.3 Humanoid; a body's own eye and chest override these (crouching lowers them)
- `E.V3`: small 3D vector helpers on [x, y, z] arrays
- `E.V3.add(a, b)`: a + b
- `E.V3.dot(a, b)`: dot product
- `E.V3.len(a)`: length
- `E.V3.lerp(a, b, t)`: the point t of the way from a to b
- `E.V3.mul(a, s)`: a scaled by s
- `E.V3.norm(a)`: unit vector the same way
- `E.V3.rz(v, a)`: v turned by angle a (radians) about the z axis
- `E.V3.sub(a, b)`: a - b
- `E.angDiff(a, b)`: the shortest signed turn from angle a to angle b, -π..π (radians)
- `E.angleTo(a, b)`: ground angle from a to b (radians, 0 = east, PI/2 = south)
- `E.approach(a, b, s)`: a moved toward b by at most s, never past it: approach(speed, top, accel * dt)
- `E.approachAng(a, b, s)`: angle a turned toward b by at most s radians: facing = approachAng(facing, target, turnSpeed * dt)
- `E.bayer(x, y)` †: the 4 x 4 ordered-dither threshold 0..1 at pixel (x, y): pixel on when value > bayer(x, y)
- `E.chance(p)`: true with probability p (0..1)
- `E.clamp(v, a, b)`: v kept between a and b
- `E.ctx2d(c)`: a canvas's 2D context with smoothing off (crisp pixels)
- `E.dist(a, b)`: distance between two objects with x, y (and optional z)
- `E.ease`: easing curves for u 0..1
- `E.ease.inOut(u)`: slow start and end
- `E.ease.inQuad(u)`: slow start, fast end
- `E.ease.outBack(u)`: overshoots past 1, then settles: pop-ups, landings
- `E.ease.outCubic(u)`: fast start, smooth stop
- `E.ease.outQuad(u)`: fast start, smooth stop (gentler than outCubic)
- `E.hash2(x, y)`: a fixed random number 0..1 for whole-number grid coordinates (texture specks, scatter that never flickers)
- `E.hex(h)`: '#rrggbb' or '#rgb' (or an [r, g, b] array) -> [r, g, b]
- `E.hsl(hh, s, l)`: '#rrggbb' from hue (degrees), saturation and lightness (0..1)
- `E.ik3(a, b, L1, L2, hint)`: two-bone IK in 3D: returns [joint, end]. hint points the way the joint should bend.
- `E.inArc(a, facing, b, range, halfAngle, dz)`: melee cone on the ground: is b (with optional radius r) within range of a and within halfAngle of facing? dz (optional) also limits the height difference, so a hero on a roof can't hit a guard in the street (left out, height is ignored)
- `E.lerp(a, b, t)`: a + (b - a) * t: the point t of the way from a to b (t 0..1)
- `E.lerpAng(a, b, t)`: an angle t of the way from a to b by the shorter way round
- `E.mix(h1, h2, t)`: the color t of the way from h1 to h2 ('#rrggbb')
- `E.mkCanvas(w, h)`: a new canvas of w x h pixels (scratch images and sprite sheets). With no document (Node: a headless game) a stand-in whose drawing does nothing, so sprites and other images made while a game loads don't stop it
- `E.noise2(x, y)`: smooth value noise 0..1 over the plane (one bump per whole unit): blotches, clouds, wobble
- `E.overlap(a, b)`: circles on the ground plane: { x, y, r }
- `E.overlapBox(a, b)`: side-view boxes: { x (center), z (feet), w, h } (the Platformer / PlatformMap convention)
- `E.pick(list)`: a random item of list (Math.random)
- `E.prune(list, fn)`: remove items in place: prune(bullets, b => b.dead)
- `E.ramp(c, n = 5, strength = 1)`: a ramp of n colors from dark to light around a base color (hue shifted), for palettes and gradients
- `E.rand(a = 1, b)`: rand() 0..1, rand(b) 0..b, rand(a, b) a..b
- `E.randInt(a, b)`: whole number from a to b, both included
- `E.rng(s)`: a seeded random stream: const R = E.rng(42); R() gives 0..1, the same numbers for the same seed (mulberry32)
- `E.sameLevel(a, b, tol = HEIGHTS.level)`: within tol (default E.HEIGHTS.level, 8) of the same height: sameLevel(hero, guard)
- `E.shade(h, a)`: shade('#336699', -0.3) darker, (+0.3) lighter. Hue-shifted like painted pixel art: darker drifts cool, lighter drifts warm
- `E.smoothDamp(cur, target, vel, st, dt)`: critically damped follow: [next, nextVelocity] = smoothDamp(cur, target, vel, smoothTime, dt); settles in about smoothTime seconds without overshoot
- `E.store`: saved data that survives reloads (localStorage, JSON). Never throws.
- `E.store.get(key, fallback = null)`: the value saved under key (any JSON), or fallback
- `E.store.remove(key)`: forget key
- `E.store.set(key, value)`: save value (any JSON) under key; false when storage is blocked
- `E.targets(from, list, o = {})`: the things in list that `from` can reach, nearest first, each as { target, d (ground distance), dz, angle (from -> it) }: melee auto-aim, lock-on, takedowns, interaction prompts. o: { range, arc (half angle around facing, radians; default all round), facing (default from.facing), dz (most height difference, default E.HEIGHTS.level), sight: map (only those its eyes see), filter: t => bool }. A target's r adds to the range
- `E.toHex(c)`: [r, g, b] -> '#rrggbb'
- `E.toHsl(h)`: a color's hue (degrees), saturation and lightness (0..1): toHsl('#e05a3a') -> [h, s, l]
- `E.tones(c, strength = 1)`: five shades of a color for painted-looking pixel art: { deep, sh, base, lt, hi }. Shadows drift toward blue-violet, highlights toward warm yellow (strength 0..2, default 1).

## 2. Pixel primitives

- `E.px`: the pixel primitives: px.rect, px.line, px.dot, px.disc, px.poly, px.sprite, ... (each snaps to whole pixels)
- `px.blend(g, a, mode, fn)`: draw fn() at alpha a (stepped, like PS1 hardware) with a blend mode: 'normal', 'add', 'multiply', 'screen' (E.style.trans = 'dither' dithers instead)
- `px.col(g, c)`: set the fill color (px.* do it themselves)
- `px.ddisc(g, cx, cy, r, c, a, wx = 0, wy = 0)`: soft disc that fades toward its edge (glows, smoke, dust): stepped alpha rings, or dithering in 'dither' style
- `px.disc(g, cx, cy, r, c)`: a filled circle
- `px.dot(g, x, y, c)`: one pixel
- `px.ell(g, cx, cy, rx, ry, c)`: a filled ellipse
- `px.glow(g, e = 1)`: GPU lighting: what follows glows (0..1). No effect in Canvas mode, so call it freely.
- `px.line(g, x0, y0, x1, y1, c, w = 1)`: a line w pixels thick, no smoothing
- `px.poly(g, pts, c)`: a filled polygon through [[x, y], ...]
- `px.polyDither(g, pts, c, a, wx = 0, wy = 0)`: translucent polygon: a = 0..1 opacity (stepped alpha, or a dither pattern in 'dither' style). wx/wy = world pixel offset for the pattern
- `px.rect(g, x, y, w, h, c)`: a filled rectangle, snapped to whole pixels
- `px.reset(g)`: forget the color cache (after drawing on g with the canvas API directly)
- `px.sprite(g, spr, x, y, flip = false)`: draw a sprite with its top-left corner at buffer pixel (x, y). flip mirrors it left-right.
- `E.sprite(rows, colors = {}, scale = 1)`: Pixel sprite written as strings. Each character is one pixel; colors maps a character to a hex color; '.' and ' ' are transparent. scale (whole number) enlarges each pixel. const COIN = E.sprite(['.yy.', 'yYYy', 'yYYy', '.yy.'], { y: '#f0b020', Y: '#fff0a0' }); Draw it with r.sprite(x, y, z, COIN) (depth sorted) or px.sprite(g, COIN, sx, sy).
- `E.style: trans`: Translucency style. 'alpha' (default, PS1 / N64 / SNES color math): real transparency in 1/8 steps, plus blend modes. 'dither' (NES, Game Boy, Genesis look): ordered-dither patterns. Set E.style.trans = 'dither' for the older look.

## 3. Views (projections)

- `E.VIEWS: iso, threequarter, topdown, brawler, side, overhead`: the ready-made views: iso (yaw 45, pitch 30), threequarter (pitch 55), topdown (80), brawler (25), side (0) and overhead (90, scale 1: world x/y = screen pixels); new E.Game({ view: 'iso' }) and game.setView('side') take their names
- `E.VIEW_ORDER: iso, threequarter, topdown, brawler, side`: the order game.nextView() cycles through when a game doesn't set game.views ('overhead' is left out)
- `new E.View(id, label, yaw, pitch, scale = 1, zBoost = 1) → view`: new E.View(id, label, yaw, pitch, scale, zBoost): an orthographic camera (degrees; scale = screen pixels per world unit; zBoost stretches heights)
- `view.depth(x, y, z = 0)`: true camera depth: use it to sort parts inside one object
- `view.order(x, y, z = 0)`: painter's order for whole objects standing on the ground
- `view.p(x, y, z = 0)`: world -> projected screen pixels (not yet camera-relative)
- `view.screenDirToGround(dx, dy)`: a direction the player pushed on screen (x right, y down) -> normalized ground direction
- `view.set(yaw, pitch, scale = 1, zBoost = 1)`: change the angles and scale in place (game.setView and rotateView use their own copies); returns the view
- `view.toGround(sx, sy)`: projected screen point -> ground point (z = 0). null in side view
- `view.ax`, `view.ay`: screen x = ax * x + ay * y (the projection's first row)
- `view.bx`, `view.by`, `view.bz`: screen y = bx * x + by * y + bz * z (the second row; bz < 0 lifts things up the screen)
- `view.dx`, `view.dy`, `view.dz`: the direction toward the camera, for true depth (view.depth)
- `view.fx`, `view.fy`: the ground direction that points at the camera (the front of a wall faces it)
- `view.id`: its name ('iso', or yours)
- `view.inv`: the inverse of the ground projection (screen -> ground at z 0), null in side views
- `view.isSide`: a side view (pitch 1 or less: x right, z up, y is depth)
- `view.isTop`: looking straight down (pitch 89 or more)
- `view.label`: its name for people ('Isometric')
- `view.pitch`, `view.yaw`: the same angles in radians
- `view.pitchDeg`: the tilt, 0 side view to 90 straight down
- `view.scale`: screen pixels per world unit
- `view.yawDeg`: the turn about the up axis, degrees (0: north is up the screen; iso is 45)
- `view.zBoost`: how much heights are stretched on screen (1 = true)
- `E.charView(view)`: the view a rig in `view` is drawn from (the sprite-like angle above; the view itself outside pitch 40-89)

## 4. Screen

- `E.RES: nes, snes, gb, gbc, gba, genesis, md, pce, n64, ps1, wide`: classic console resolutions for new Game({ res: 'snes' }) (width x height in pixels)
- `game.screen.clear` †: true when the game's bg is null (or 'transparent'): the buffer and the canvas are cleared instead of filled, so a picture under the canvas shows through the game's (a 3D world drawn by engine/my-3d2dge-3d.js)
- `game.screen.clientToScreen(cx, cy)`: browser client coords -> projected screen pixels (same space as view.p)
- `game.screen.resize()`: fit the buffer to the canvas again (on window resize; after changing sizing options, setOptions does it)
- `game.screen.setOptions(o)`: change sizing at runtime, e.g. { minH: 400, maxW: 1080, maxH: 660 } to pull the camera back
- `game.screen.setScale(v)`: how a fixed resolution fills the screen: 'sharp' | 'fill' | 'auto' (see scale)
- `game.screen.H = 200`, `game.screen.W = 320`: the buffer's size in game pixels
- `game.screen.OX = 0`, `game.screen.OY = 0`: the letterbox margins on the canvas, in canvas pixels
- `game.screen.S = 3`: the whole-number scale up to the canvas
- `game.screen.buf`: the low-resolution buffer the game draws into (W + 2 by H + 2 pixels; null when headless)
- `game.screen.canvas`: the page's canvas (null in a headless game); o: the sizing options (the game's o)
- `game.screen.ctx`: its 2D context (r.ctx is the same)
- `game.screen.dpr = 1`: the device pixel ratio used (at most 3)
- `game.screen.fx = 0`, `game.screen.fy = 0`: its sub-pixel part (0..1, applied when presenting)
- `game.screen.ix = 0`, `game.screen.iy = 0`: the camera's whole-pixel offset this frame
- `game.screen.listeners = []` †: functions called after every resize
- `game.screen.portrait`: true while the screen is taller than wide (a phone held upright)
- `game.screen.scale = 'auto'`: how a fixed resolution fills the screen: 'sharp' (whole-number scale, every pixel the same size, black bars unless o.expand grows the picture into them), 'fill' (the largest fit, pixels a device pixel apart in size) or 'auto' (fill on high-density screens, phones and tablets, where that difference can't be seen; sharp elsewhere). game.settings.scale sets it

## 5. Input

- `new E.Input(screen, map, signal) → input`: signal: an AbortSignal that removes every listener this adds (game.dispose()). A screen without a canvas (headless) gets no DOM listeners: input comes from press(code), release(code), tap(action) and hold(action, on)
- `E.Input.DEFAULT { attack, dash, skill, jump }`: top-down / isometric action (Zelda, Diablo): Space dashes, J or click attacks
- `E.Input.PLATFORMER { jump, attack, dash, skill }`: side-scrollers (Mario, Mega Man): Space / Z / K jump, X / J attack or shoot, Shift / C dash
- `E.Input.SHMUP { fire, bomb }`: shoot-'em-ups (1942, Gradius): Space / Z / J fire (hold for autofire), X / K bomb
- `E.Input.THIRDPERSON { sprint, jump, crouch, interact, attack, block, dodge, use, map }` †: third-person action and stealth (Assassin's Creed, Metal Gear): WASD / stick move, Shift sprint, Space jump and parkour, C crouch (a toggle), E interact, J attack, K block, L dodge, Q use, M map. Pad: A jump, B crouch, X attack, Y interact, LB block, RB dodge, LT use, RT or L3 sprint, Back map
- `input.anyPressed()`: any action pressed this step (title screens: "press any button")
- `input.bindButtons(root)` †: wire every element with data-act="<action>" inside root to the action
- `input.bindings` †: the player's bindings over the preset: { action: { keys: [codes], pad: [codes] } } (game.settings.bindings keeps them)
- `input.buffered(a, win = .15)`: was it pressed within the last `win` seconds and not yet consumed? (input buffering)
- `input.clear()`: Release all devices and discard buffered input on focus loss or a modal transition.
- `input.clicked()` †: where a click or tap on the canvas landed, in screen pixels [x, y] (the HUD's space: r.W, r.H), during the step after it lifted (a press that drags away, like the touch stick's, is none); else null. Menus and dialogs answer to it; a HUD button of your own can: if (hit(input.clicked())) ...
- `input.codeLabel(code)`: a code as a person reads it: 'W' (or the keyboard's own letter there), 'Space', '↑', 'Left click', and a gamepad button by its symbol on the controller in use ('A', '✕', 'B'...; glyphs picks the family)
- `input.consume(a)`: mark a buffered press of action a as used, so buffered(a) is false until the next press
- `input.consumeAll()`: forget every pending press (after closing a menu or dialog, so the same press does not also attack)
- `input.down(a)`: is the action held right now?
- `input.drag()` †: how far the touch stick's finger moved since the last step, in screen pixels [dx, dy] (the HUD's space), or null while no finger holds it: to steer one to one (a shooter's ship follows the thumb) instead of by the stick's direction
- `input.hold(a, on = true)`: hold an action down (on) or let it go (false), as its key would
- `input.label(a, device = this.lastDevice)`: the key or button to show in a prompt for action a, on the device the player used last (or the one named: 'keyboard' | 'mouse' | 'gamepad' | 'touch'), with their bindings: input.label('jump') -> 'Space', 'A' or '✕'
- `input.mouseScreen()`: mouse position in projected screen pixels, or null
- `input.move()`: movement intent in screen directions: x right, y down, length <= 1
- `input.padStyle()`: the controller family whose symbols label() shows: glyphs, or with glyphs 'auto' the one its name says
- `input.pointer()` †: the mouse pointer in screen pixels [x, y] (the HUD's space), or null before it has moved over the canvas
- `input.press(code)`: press a key or button code ('KeyJ', 'Mouse0', 'Pad0', 'Act:attack') as if the person did: scripted input, tests, bots
- `input.pressed(a)`: true only during the first update step after the press (menus, jumps, one-shot actions)
- `input.rebind(a, device, code)` †: bind action a to one code for a device ('keys' = keyboard and mouse, 'pad' = gamepad), in place of that device's codes: input.rebind('attack', 'keys', 'KeyF'). Returns null when done, the action that already uses the code (nothing changes: free it first), or 'reserved' for the codes the menus keep (Escape, Enter, F keys, Start, the d-pad). The arrow keys and the d-pad always move as well
- `input.rebindable(a, map = this.preset)` †: can the player rebind action a? Every action but the menu's (start, pause, confirm, cancel: they are how a player gets back to the menu), and those the game hides with new E.Game({ menu: { controls: { a: false } } })
- `input.release(code)`: let go of a code pressed with press()
- `input.released(a)`: true only during the first update step after the action was let go
- `input.repeat(a, delay = .3, rate = .08)`: pressed, then repeats while held (after `delay` s, every `rate` s): menu cursors, puzzle pieces
- `input.resetBindings()` †: forget the player's bindings: every action back to its preset's codes
- `input.rumble(strength = .5, seconds = .15)` †: shake the gamepad: strength 0..1 for seconds (scaled by rumbleScale; nothing where the controller can't). Returns true when it rumbled
- `input.screenPoint(cx, cy)` †: browser client coords -> screen pixels [x, y] (the HUD's space, with no camera), or null without a canvas
- `input.stopRumble()` †: stop a rumble now (pause, focus lost, unplugged)
- `input.suppress(a)` †: Suppress a held action until the next tick (a HUD widget owns the pointer this step).
- `input.suppressCode(code)` †: A widget owns this button; other devices bound to the same action still work.
- `input.tap(a)`: press an action for one update step, as a quick tap of its key (scripted input, tests, an AI): pressed() and down() are true in the next step, released() in the one after
- `input.tick(dt)`: advance input by one step: read the gamepad and turn presses since the last step into this step's pressed() and released() (the engine calls it every step)
- `input.touchArea()` †: where the touch buttons cover the screen, in screen pixels { x0, y0, x1, y1 } (the same space as r.W and r.H), or null while none show: keep a prompt or a box clear of it (a bottom E.Dialog does by itself)
- `input.touchButtons(actions, o = {})` †: On-screen buttons for phones and tablets (shown on touch screens; the player's settings can show them always or hide them, put them on the left, and size them): input.touchButtons(['jump', 'attack'], { labels: { jump: 'A', attack: 'B' }, force }). The other half of the screen is a move stick (past halfway it presses up, down, left and right too, as a d-pad does: menus and ladders). START is the corner's menu button, top right: it opens the menu, or pauses a pausable scene into it (without the corner a START button there starts a title and pauses, as a gamepad's Start)
- `input.touchSet(a, label = null, show = true)` †: one touch button as the moment changes: its label (TALK beside someone, NEXT in a dialog; null: its own) and whether it shows (false: nothing for it to do here). Cheap to call every step: input.touchSet('confirm', near ? 'TALK' : null, near || talking)
- `input.unbind(a, device)` †: take away action a's codes for one device ('keys' or 'pad'); the arrow keys and d-pad stay on the moves
- `input.use(map)`: switch key layout at runtime: input.use(E.Input.PLATFORMER) or input.use('SHMUP'). The player's own bindings (bindings, set by rebind() and the Controls screen) are laid over it. Every preset (E.Input.DEFAULT, PLATFORMER, THIRDPERSON, SHMUP) has the moves (up, down, left, right) and the menu's actions (start, pause, confirm, cancel)
- `input.zoom()` †: the camera zoom the player asked for since the last step, as a factor (1.1: 10% closer, .9: farther; 1: none): the wheel, - and = and a pinch, where the scene lets them zoom. The game applies it (game.zoomBy)
- `input.aimSource = 'move'` †: what aims right now: 'move' | 'mouse' | 'pad'
- `input.clock = 0`: seconds of input time (the steps' dt added up)
- `input.deadzone = .18`: how far a gamepad stick moves before it counts (0..0.8)
- `input.glyphs = 'auto'`: the gamepad's button symbols for label(): 'auto' (from the controller's name) | 'xbox' | 'playstation' | 'nintendo' | 'generic' (positions)
- `input.held`: the key and button codes down right now ('KeyD', 'Mouse0', 'Pad0', 'Act:jump')
- `input.lastDevice = 'keyboard'`: 'keyboard' | 'mouse' | 'gamepad' | 'touch', the last one used (show the right button prompts)
- `input.map`: each action's codes ({ jump: ['Space', 'Pad0', 'Act:jump'] }); every action also answers to 'Act:<name>' (DOM buttons with data-act, tap, hold)
- `input.mouse`: { cx, cy } its page position, active once it has moved over the canvas, t the input clock when it last moved
- `input.names = null` †: the actions' names on the Controls screen ({ attack: 'Sword' }; false hides one from rebinding: the game's menu.controls); onBindings(b): called with the player's new bindings (the game saves and applies them)
- `input.padAim = null` †: its right stick, or null when centered
- `input.padAxes = []` †: the gamepad's raw axes
- `input.padId = ''`, `input.padIndex = null`: the gamepad in use (null and '' without one)
- `input.padLost = false`: true for the step after the gamepad in use was unplugged (a pausable scene pauses)
- `input.padMove = [0, 0]`: the gamepad's left stick after the dead zone
- `input.padPrev = []`: which gamepad buttons were down at the last step
- `input.preset` †: the layout last given to use() (E.Input.DEFAULT, PLATFORMER, SHMUP or your own)
- `input.rumbleScale = .6` †: vibration strength 0..1 (0 = off; game.settings.rumble sets it)
- `input.screen`: the game's screen (mouse positions are read through it)
- `input.steer = 'stick'` †: 'stick' (a stick drawn under the thumb) or 'drag' (a finger anywhere on the screen but the buttons steers by drag(), with no stick drawn: a shooter's ship that follows the thumb)
- `input.stick = [0, 0]` †: the touch stick's direction [x, y], length <= 1
- `input.stickDeadzone = .12` †: the part of that radius a thumb moves before the stick counts (0..0.5)
- `input.stickId` †: the pointer (finger) holding the touch stick
- `input.stickOn = false` †: a finger is on it
- `input.stickRadius = 44` †: how far (CSS pixels) a finger drags for full tilt
- `input.stickSide = 'left'` †: 'left' or 'right', the half of the screen the stick lives on
- `input.touchEnabled = true` †: false turns the touch stick off

## 6. Pixel font

- `E.font`: Pixel fonts. 'normal' (default) is a 5x7 proportional font with lower case; 'tiny' is the 3x5 upper-case font. text(g, str, x, y, color, opts) where opts is an outline color, false, or { font: 'normal' | 'tiny', outline: '#0b0814' | false, shadow: '#000' (1 px drop shadow), gradient: ['#fff', '#8ad'] (top to bottom), scale: 1, align: 'left' | 'center' | 'right', wrap: maxWidthPx, lineGap } '\n' starts a new line. Returns { w, h } of the drawn block. title(...) draws big logo text.
- `E.font.default` †: the font used when none is named: 'normal' (5 x 7) or 'tiny' (3 x 5)
- `E.font.height(lines = 1, o, lineGap)`: the height in pixels of that many lines (with o's scale and font, and lineGap between them)
- `E.font.lineHeight(o)`: pixels from one line to the next
- `E.font.text(g, s, x, y, color = '#ffffff', o = '#0b0814')`: draw text at (x, y) (its top-left; align: 'center' or 'right' moves it) in color. o: an outline color, or { outline, shadow, gradient, scale, align, wrap, font }; returns { w, h }
- `E.font.title(g, s, x, y, o = {})`: Big logo text for title screens: scaled glyphs with a vertical color gradient, an outline and an extruded 3D edge. title(g, 'CASTLE OF NIGHT', x, y, { scale: 3, colors: ['#fff6c8', '#ffd36a', '#e07a2a'], outline: '#1a0c10', depth: 3, depthColor: '#6a2a1a', align: 'center' })
- `E.font.width(s, o)`: width in pixels of the widest line. opts: a scale number or { font, scale }
- `E.font.wrap(s, maxW, o)`: split text into lines no wider than maxW pixels

## 7. Lighting

- `game.lights.add(x, y, z, radius, intensity = 1, o)` †: radius in world units; intensity ~0.5..1.5. opts (GPU lighting only): { color: '#ffaa55', shadow: true }
- `game.lights.caster(x, y, r, top)` †: something that blocks light (GPU shadows): a cylinder of radius r from the floor up to height top
- `game.lights.heat(x, y, z, width, strength = 1)` †: heat shimmer above a point (GPU only). width in world units, strength ~0.5..1.5
- `game.lights.render(r)` †: darken the frame by the lights (the renderer calls it after the queue, when enabled)
- `game.lights.ambient = .15` †: how lit unlit places are, 0 (black) .. 1
- `game.lights.dark = [10, 6, 24]` †: the color of darkness, [r, g, b]
- `game.lights.enabled = false` †: false (the default) turns the canvas lighting off
- `game.lights.glow = [255, 200, 140, 0]` †: the color, [r, g, b, a], where light is brightest
- `game.lights.glowAt = 1.7` †: the light level (1 = fully lit) above which it glows
- `game.lights.levels = [.9, .7, .48, .26, .08, 0]` †: the darkness of each lighting band, darkest first (dithered between them)
- `game.lights.list = []` †: this frame's lights from add()

## 8. Particles

- `new E.Particles(game) → game.particles` †: game.particles; game: its game
- `game.particles.add(p)`: add one particle { x, y, z, vx, vy, vz, life, max (seconds), g (gravity, > 0 pulls down), drag, bounce (0..1), kind: 'dust' | 'spark' | 'bit' | 'ember' | 'ring' | 'text', color, size }; returns it, or null when full
- `game.particles.bits(x, y, z, n, colors)`: n pieces of debris that fly, fall and bounce (colors: a list to pick from)
- `game.particles.draw(r)`: queue them for drawing (the renderer calls it)
- `game.particles.dust(x, y, z, n, o = {})`: n puffs of dust from (x, y, z) that drift and fade. o: { speed: 30, color, size }
- `game.particles.explosion(x, y, z, size = 1, o = {})`: a full explosion in one call: fireball, smoke, sparks, debris, shockwave ring, screen shake and flash, sound. explosion(x, y, z, size = 1, { debris: ['#6a5a4a'], sound: true, flash: true })
- `game.particles.fire(x, y, z, n = 6, o = {})`: fireball puffs for explosions and fire breath
- `game.particles.glints(x, y, z, n = 5, color = '#fff6c0', spread = 10)`: twinkling star glints for magic, treasure and pickups
- `game.particles.impact(x, y, z, size = 6, color = '#ffe070')`: a hit star at the point of impact: impact(x, y, z, size = 6, color)
- `game.particles.ring(x, y, r0, r1, color, dur = .35, z = 0)`: a ring on the ground growing from radius r0 to r1 over dur seconds (shockwaves, landings)
- `game.particles.smoke(x, y, z, n = 4, o = {})`: rising smoke puffs: smoke(x, y, z, n, { size, color, dark, light })
- `game.particles.sparks(x, y, z, n, dir = null, o = {})`: n bright sparks thrown from (x, y, z), every way or around angle dir (radians). o: { color, speed }
- `game.particles.text(x, y, z, text, color = '#fff2c4', o = {})`: floating number or word: text(x, y, z, '12', color, { scale: 2, bounce: true }) (bounce: lands and holds, Final Fantasy style)
- `game.particles.update(dt)`: move and age them by dt (the engine calls it every step)
- `game.particles.ground = null` †: null (the floor is z 0), or (x, y, z) -> the floor's height under a particle (a side-scroller's platforms, a 3D level: engine/my-3d2dge-3d.js sets it), asked again when a particle enters a new 8-unit cell
- `game.particles.list = []`: the live particles
- `game.particles.max = 900`: at most this many at once (add() skips the rest)

## 9. Renderer

- `r.H`: the screen's height in game pixels
- `r.W`: the screen's width in game pixels
- `r.actor(x, y, z, drawFn, o = {})`: Queue a character. drawFn(g, ox, oy) must draw with (ox, oy) as the projected position of world point (x, y, z). The engine adds outline, rim light, hit flash, afterimages and x-ray silhouettes. opts: {outline=true, rim=true, flash=false, alpha=1, xray=false, ghost:{color, life, alpha, owner}, hides, bias, every, key}
- `r.actor({ xray })`: true shows a checkered silhouette wherever a wall (or a prop, or anything queued with hides) is drawn in front of the actor; xray: { color, outline, actors } picks the fill color, adds a solid 1-px outline in that color around the hidden part (reads through busy pillars and dark walls), and with actors: true other bodies drawn in front hide it too (a hero lost in a crowd keeps his shape)
- `r.actor({ hides })`: true: this actor counts as an x-ray occluder even when no x-ray actor asked for actors
- `r.actor({ ghost })`: ghost.owner (any {x, y, z}, usually the actor itself) keeps its afterimages sorted behind the live body
- `r.actor({ every, key })`: every: n, key (any object, the character's own): its finished image is drawn again for n - 1 frames before drawFn runs again, at the place it is now (a background character animating at a lower rate, as classic games' townsfolk do: a phone's frame keeps the time for the ones that matter); not while it flashes, with a ghost, x-ray or GPU lighting
- `r.bh`: the buffer's height (H + 2)
- `r.box(g, x0, y0, z0, x1, y1, z1, top, side)`: extruded box prop (crate, pedestal, table). Call inside a queue fn with its g.
- `r.bw`: the buffer's width (W + 2: a pixel of margin each side for the sub-pixel camera)
- `r.ctx`: the low-resolution buffer's 2D context: draw on it with E.px
- `r.decal(fn, o)`: draw on the floor before the queue. opts.emissive (0..1) makes it glow under GPU lighting
- `r.glowDisc(g, cx, cy, rad, color, a)`: glow halo from a cache: additive light rings (alpha style) or a dithered disc (dither style). a = 0..1 strength
- `r.groundArc(x, y, r0, r1, a0, a1, color, alpha = 1, z = 0, g = this.tgt)`: a band of a ring on the ground from radius r0 to r1 and angle a0 to a1 (radians): melee telegraphs, sight cones
- `r.groundDisc(x, y, rad, color, alpha = 1, z = 0)`: a dithered disc lying on the ground (radius in world units, z its height): shadows, auras, area attacks
- `r.groundPts(x, y, rad, n = 18, z = 0)`: n screen points round a circle of radius rad on the ground at (x, y), height z: the outline of a ring or a fan
- `r.groundRing(x, y, rad, color, alpha = 1, z = 0)`: a ring lying on the ground (radius in world units)
- `r.marker(x, y, z = 0, o = {})`: an objective marker over a world point: a bobbing diamond (and its label) while it is on screen, an arrow at the screen's edge pointing to it while it is off (offscreen: false hides it then). o: { label, color: '#ffd040', offscreen: 'arrow' }
- `r.overlay(fn)`: draw fn(g) on top of everything, in screen pixels (HUD, dialog, menus)
- `r.prop(name, x, y, z, o = {})` †: set dressing from E.prop: r.prop('torch', x, y, z, { size, color, flip, light: true, halo: true, bias, hides, footprint }) feet on the world point; flames animate and glow. light: true also adds a warm light to game.lights. A prop drawn in front of an x-ray actor (a pillar, a statue, a brazier) shows the actor's silhouette through it; hides: false opts a prop out.
- `r.queue(x, y, z, fn, o)`: queue a depth-sorted draw. fn(g) draws into g. opts: {bias, occluder, hides, xray, emissive, solid (hides a glow behind it), footprint} occluder: a wall (x-ray silhouettes show through it, it sorts as a block). hides: only lets x-ray silhouettes show through it (props, sprites, bodies), nothing else changes
- `r.shadow(x, y, rad, alpha = .5, color = '#0c0818', z = 0)`: soft contact shadow under a character: a cached dithered ellipse, correct for the current view. z = height of the surface it falls on (0 = floor; the top of a block or platform otherwise)
- `r.shape(id, x, y, z = 0, o = {})` †: Queue a shape standing at (x, y, z), feet on the point, depth sorted like an actor: r.shape(id | entry, x, y, z, o). o: { facing (radians, where its front points; default PI/2, south, as written), scale, mats: { slot: material }, flip (mirror it x to -x before facing), params (a generator's: { h: 30 }), bias, hides (default true: x-ray silhouettes show through it), footprint, light (add its lights to game.lights), shadow (default true), charView (default true: steep views draw it from the characters' lower angle), flash, alpha, xray }
- `r.sightCone(obs, o = {})` †: an observer's view on the ground: a dithered fan fov wide (radians) about its facing, out to range, cut short where the map hides a body's chest (map.ray, the height rules), draped over the ground below. o: { range: 120, fov: 1.6, facing, map, eye, color: '#ffe080', alpha: .3, rays }. Call it in draw (it is a decal: under walls and bodies)
- `r.sky(colors, o = {})`: background of dithered color bands, top to bottom: r.sky(['#0b1030', '#3b2d6b', '#e0806a']). Call first in draw.
- `r.sprite(x, y, z, spr, o = {})`: Queue a pixel sprite (from E.sprite) standing at world point (x, y, z). Depth sorted like an actor. opts: { flip, anchor: 'bottom' (feet on the point, default; E.shapeSprite's: its own feet) | 'center' | 'top', glow: 0..1, bias, flash, outline, alpha, xray, ghost } (the last five use the actor path)
- `r.starfield(o = {})`: scrolling star dots for space and night skies. opts: { count: 70, speed: 30 px/s, dir: 'down' | 'up' | 'left' | 'right', colors, layers: 3, seed }
- `r.text(str, x, y, color = '#ffffff', o)`: HUD text in screen pixels, drawn on top and never lit: r.text('SCORE 120', 4, 4, '#fff', { align, scale, outline })
- `r.textAt(x, y, z, str, color = '#ffffff', o = {})`: text floating at a world point (names, prompts): r.textAt(x, y, z, 'OPEN', '#ffe08a')
- `r.tgt` †: current draw target for ground helpers (switches during GPU info and overlay passes)
- `r.view`: the view this frame is drawn in (the game's, with zoom and turn)
- `r.visible(x, y, z = 0, mx = 60, up = 30, down = 90)`: is a world point near the visible area? margins in pixels (characters extend upward from their feet)
- `r.w(x, y, z = 0)`: world -> buffer pixel coords
- `r.game`: its game; items: this frame's queue (sorted by depth when the frame ends)
- `r.gpu = false` †: true during a frame drawn with GPU lighting (draw code can check r.gpu)
- `r.ix`, `r.iy`: the camera's whole-pixel offset this frame (a world point is at r.w(x, y, z) on the buffer)
- `r.outline = '#140c1c'`: the color of the 1-pixel outline round every actor
- `r.rim = '#ffe2b8'` †: the rim light's color on actors' lit edges
- `r.rimAlpha = .28` †: its strength 0..1
- `r.xrayColor = '#8fe3ff'` †: the default color of x-ray silhouettes

## 10. Game

- `new E.Game(o = {}) → game`: new E.Game({ canvas, view, views, res, expand, input, bg, step: 1 / 120, loop: true, headless: false, menu, fullscreen: 'tap', corner: true, backGesture: true, autoPause: true, id, pace, camera }). The standard features (section 10b) every game gets: menu, fullscreen, corner, backGesture, autoPause.
- `new E.Game({ res })`: a fixed resolution ('ps1' or [w, h]), whole pixels
- `new E.Game({ expand })`: true makes res the least the screen shows and grows the picture to fill the window, any shape, no bars (expand: { maxW, maxH } stops it growing there)
- `new E.Game({ bg })`: the color behind everything, or null: the canvas is clear, and the game draws its HUD and menus over a picture under it (a 3D world, engine/my-3d2dge-3d.js)
- `new E.Game({ headless })`: no screen, renderer, sound or DOM input (tests, tools, a simulation in Node, where it is the default): scenes update and draw is skipped; drive it with advance() and input.press / release / tap / hold
- `new E.Game({ loop })`: false makes a game in a page that runs only by advance()
- `new E.Game({ menu })`: the pause, settings and controls screens ({ items, settings, controls, quit } adjusts them, false leaves them out)
- `new E.Game({ fullscreen })`: 'tap' (a phone goes full screen at its first tap and when a game starts, unless the player turned it off), 'button' (only when asked) or false
- `new E.Game({ corner, backGesture })`: corner: the menu and full-screen buttons (top right; top left on a touch screen); backGesture: a phone's back steps back in the game first (false: it leaves the page)
- `new E.Game({ autoPause })`: a pausable scene pauses when the page is hidden or loses focus
- `new E.Game({ id })`: the name the player's settings are saved under (the page's path)
- `new E.Game({ pace })`: false draws every refresh of a fast display even when the frames can't keep up (by default it draws every other one, evenly), unless the player picks Frame rate 60
- `new E.Game({ camera })`: the camera of every scene without its own (a scene's camera option: the player's zoom, start)
- `game.H`: the screen's height in game pixels (W is its width)
- `game.W`: internal buffer size in pixels (HUD layout)
- `game.advance(seconds = this.o.step, o = {})`: run the game for `seconds` of real time in exact fixed steps, at once, without requestAnimationFrame: tests, tools and headless runs (advance(1) is 120 updates). o.draw: then draw one frame (not in a headless game). Returns the updates run
- `game.after(seconds, fn)`: run fn once after `seconds` of game time. Cleared on scene change. Returns { cancel() }
- `game.back()`: a step back, as a phone's back gesture asks for (the engine calls it for one; a back button of the game's own can): the open menu screen goes back one; else the scene's own back() takes it (it returns true when it did); else a scene in play pauses into the menu, and a paused one goes on. Returns false where there is nowhere to go (a title)
- `game.cornerArea()` †: where the corner's buttons (menu and full screen, top right; the touch START) cover the screen, in screen pixels { x0, y0, x1, y1 } (r.W and r.H's space), or null while none show: keep a HUD clear of it
- `game.dispose()`: end the game for good: stop the loop and remove everything the engine added to the page (its listeners on the window, the document, the canvas and the buttons, the touch controls, the GPU lighting's canvas) and close the sound. Tests and tools that make many games call it; the canvas stays
- `game.enableGPU(o = {})` †: turn on WebGPU lighting (falls back to Canvas lighting automatically). opts: { map, bands, ambient, ... }
- `game.every(seconds, fn)`: run fn every `seconds` of game time. Cleared on scene change. Returns { cancel() }
- `game.flash(color = '#ffffff', seconds = .12, strength = 1)`: flash the whole screen with a color for `seconds` (dithered fade out): hits, explosions, lightning. Shorter when reduceMotion, dimmer by the player's settings.flashes
- `game.focus(x, y, z = 0)`: camera follows this world point. Side-scrollers: game.focus(x, 0, z)
- `game.follow(target, o = {})`: keep the camera on an object automatically (instead of calling focus every update). opts: { z: extra height to look at (default 16), lead: look ahead in the facing / moving direction }. follow(null) stops.
- `game.freeze(s)`: hit-stop: the game stands still for s seconds (.04-.08 for a hit); input still ticks
- `game.go(name, data, o = {})`: switch scene: game.go('play', { level: 2 }). It fades through black (dithered) unless opts.fade is 0
- `game.hitFx(x, y, z, o = {})`: everything a good hit needs in one call: hit-stop, shake, an impact star, sparks along the hit direction, a sound, a damage number and a rumble on a gamepad. hitFx(x, y, z, { power: 1, angle, damage, color, sound: 'hit', rumble: true })
- `game.menu(name)`: open the menu (the corner's menu button and the touch START do it): a pausable scene (or a game started without scenes) pauses on its pause screen; any other scene, a title, waits under the settings. menu('settings') or menu('controls') opens that screen. Without a menu (menu: false, or the agent edition) it pauses a scene in play. Returns true when a menu opened
- `game.mouseGround()`: mouse position on the ground (world units), or null
- `game.nextView(dir = 1)`: cycle through game.views (or every view): bind it to a key for players who like to switch
- `game.note(text, seconds = 1.2)`: a short notice at the top of the screen (zoom level, saved, ...): game.note('ZOOM 1.5x', 1)
- `game.onView(f)` †: call f(view) whenever the view changes (re-bake caches, move HUD)
- `game.pause(reason = 'player')`: pause the game, saying why ('player' | 'focus' | 'controller' | 'menu': pauseReason); returns true if it paused. The player resumes (Escape, Start, Resume); resume() does it from code
- `game.resetCamera()` †: undo setZoom and rotateView: the scene's own zoom again (camera.start, or camera.tall on a screen held upright; 1 without), no turn. The player's zoom stays (settings.zoom)
- `game.resume()`: take the game out of pause (and close the pause screen)
- `game.rotateView(deg)` †: turn the camera around the vertical axis in ground views: game.rotateView(45) (degrees). Side views never turn
- `game.setView(v)`: switch the view: an id from E.VIEWS ('iso', 'side', ...) or a View; keeps zoom and turn
- `game.setZoom(z)` †: camera zoom on top of the view: game.setZoom(1.5) (.5 .. 3), the game's own; where the scene lets the player zoom (camera.zoom), theirs multiplies it (game.zoom is the two together). Characters, maps, props, particles and lights are drawn by code, so they re-rasterize crisply at the new size; HUD text and overlays stay the same.
- `game.shake(a)`: shake the screen by a (pixels, decaying; at most 10 in all); none when reduceMotion, scaled by the player's settings.shake
- `game.shaking` †: how hard the screen shakes now (0 still, up to 10): shake() adds to it and it dies away. A camera of the game's own (a 3D world's) shakes by it
- `game.start(hooks)`: Start the loop. Either one scene: game.start({ update(dt), draw(r) }) or several: game.start({ scenes: { title: {...}, play: {...} }, scene: 'title' }) A scene is { enter(data), exit(), update(dt), draw(r), back(), pausable, view, views, input, res, expand, touch, camera } (all optional). start() with nothing resumes a stopped loop. A headless game, or one made with loop: false, runs only by advance().
- `game.start({ view, views, input, res, expand, touch })`: a scene's, applied when it starts: input ('PLATFORMER'), res ('snes'), expand (true), touch (['jump', 'attack']); res and expand stay until another scene sets them
- `game.start({ back })`: a scene's back() takes a phone's back gesture (game.back()) first: return true when it went back somewhere (a sub-menu closed)
- `game.start({ camera })`: a scene's { zoom: [.75, 2], start: 1, tall: 1.5, wheel: true }: the player zooms the camera within zoom (the wheel, - and =, a pinch, Settings, Camera zoom: theirs, kept, on top of the game's; false or none: they can't; a function of the game: a range per screen shape, g => [g.upright ? 1 : .85, 2]), from start, the zoom it starts at (tall: on a screen held upright, game.upright; 1 without); wheel: false leaves the mouse wheel to the game
- `game.start({ boot })`: { title, version, steps: [[label, fn]], messages, min, checks, accent } runs the boot first (section 10c): the steps one a frame behind the boot screen (all at once when headless or loop: false); boot: false hides a splash
- `game.stop()`: stop the loop; the game keeps its state, and start() resumes it
- `game.upright`: true while the game's screen (r.W x r.H) is upright, taller than 1.3 times its width: a phone held upright, with expand: true (a fixed res keeps its own shape on any phone, so it is never upright there). A scene's camera.tall zoom applies then: it zooms a tall picture in to fill it
- `game.zoomBy(k)` †: the player zooms the camera by a factor (1.1: 10% closer, .9: farther), as the wheel, - and = and a pinch do (a zoom button of the game's own can): within the scene's camera.zoom range, kept as their setting (settings.zoom, on top of the game's zoom), and noted at the top of the screen ('ZOOM 1.65x': the number a scene's camera.start takes). Does nothing where the scene doesn't let the player zoom. Returns the zoom
- `game.zoomRange()` †: the zooms the player may take the camera to here, [min, max] (the scene's camera.zoom, or the game's; a function of the game gives one per screen shape or level), or null where they can't (camera.zoom false or none)
- `game.alpha = .5`: the fraction of a fixed step (0..1) of real time not yet run: interpolate drawing with it if motion must be smooth at any refresh rate. The accumulator starts half a step in, so frame times that wobble keep a steady step count
- `game.audio`: chip-sound synthesizer: game.audio.sfx('jump'), game.audio.music(song)
- `game.baseView` †: the chosen view without zoom and turn
- `game.bootError = null`: the error a boot step failed with (the game did not start), or null
- `game.booted`: a promise of the game once its boot (start's boot option, section 10c) has run and it has started: await it in a test whose boot steps return promises
- `game.cam`: camera
- `game.cam.x`, `game.cam.y`: the camera's position in projected pixels (its top-left corner)
- `game.cam.vx`, `game.cam.vy`: how fast it is moving there
- `game.cam.tx`, `game.cam.ty`, `game.cam.tz`: the world point it is following (focus sets it)
- `game.cam.smooth`: seconds of lag
- `game.cam.bounds`: clamp rect
- `game.cam.snap`: true makes it jump there at the next step instead of gliding (a new level, a teleport)
- `game.cam.room`: [w, h] world units for screen-by-screen rooms
- `game.cam.moving`: sliding between rooms
- `game.cam.offset`: [dx, dy] screen pixels from the screen's centre to where the focus sits (above a phone's touch buttons: [0, -40])
- `game.debug = null`: a game's own handle for tools and tests: game.debug = { snapshot() { return {...} }, teleport(x, y, z) {...} }. tools/check.mjs prints snapshot() and tools/replay.mjs logs it at the end
- `game.disposed = true`: true after dispose()
- `game.drawEvery = 1`: 1, or 2 while a fast display (a 120 Hz phone) refreshes quicker than the game can draw (a frame's cost, or refreshes missed: its GPU behind): every other refresh is drawn, evenly, instead of random ones missed (the updates still run every refresh). The player's Frame rate setting (game.settings.frameRate: 'auto', '60', 'full') can fix it at 2 or 1
- `game.errors = []`: the errors caught in update and draw, each { where, scene, message, stack }, once per kind
- `game.fadeTime = .22`: seconds for the dithered fade between scenes (0 = instant cuts)
- `game.fps = 60`: frames drawn per second over the last half second of real time
- `game.fullscreen`: full screen: game.fullscreen.toggle(), .on, .supported
- `game.gpu = null` †: the WebGPU lighting after enableGPU(), or null
- `game.headless`: true for a game with no display (o.headless, or no DOM: Node)
- `game.hitstop = 0`: seconds of hit-stop left (freeze)
- `game.hz = 60`: the display's refresh rate, measured
- `game.input`: keyboard, mouse, gamepad and touch, read as actions (pressed, down, move, ...)
- `game.lights` †: canvas lighting (lights.enabled, lights.add in draw)
- `game.o`: the options the game was made with, the defaults filled in (view, res, expand, minW, minH, maxW, maxH, bg, step, input, loop, headless)
- `game.particles`: dust, sparks, debris and text in the world
- `game.pauseOverlay = true`: false hides the engine's PAUSED overlay (a game drawing its own pause screen)
- `game.pauseReason = null`: why the game paused: 'player' | 'focus' (the page was hidden) | 'controller' (unplugged) | 'menu', or null
- `game.paused = false`: true while paused (a pausable scene toggles it on 'pause'; steps still run, scenes don't update)
- `game.r`: the renderer handed to draw(r) (null when headless)
- `game.real = 0`: seconds the game has stepped through, pauses and hit-stop included (blinking HUD, notes)
- `game.reduceMotion`: the player asked for less motion (prefers-reduced-motion): shake and flashes are softened
- `game.scene = null`: the scene running
- `game.sceneName = null`: its name ('main' for a game started with one scene)
- `game.scenes = null`: the scenes given to start(), by name
- `game.screen`: the low-resolution screen (its W, H, scale and buffer)
- `game.settings`: the player's choices (game.settings.volume, game.settings.set('volume', .5), your own from menu.settings), saved and applied (section 10b)
- `game.shell = null` †: the E.Shell over this game (an HTML interface: screens and HUD), or null
- `game.stats`: per-frame timings (ms) and counts, for profiling overlays
- `game.stats.updateMs`, `game.stats.renderMs`: milliseconds the last frame spent updating and drawing
- `game.stats.frameMs`: the real time since the last frame
- `game.stats.steps`: the updates it ran
- `game.stats.items`: what it queued for drawing
- `game.stats.actors`: actors drawn
- `game.stats.culled`: actors skipped off screen
- `game.time = 0`: game seconds since start (it stops during pause and hit-stop, and slows with timeScale)
- `game.timeScale = 1`: game speed, 1 normal, .25 slow motion, 0 stopped
- `game.view`: the view the game draws in now (the chosen one, with zoom and turn: read it, change it with setView)
- `game.views`: views this game is designed for (view cycling and the checker use it). null = every view
- `game.yaw = 0` †: its turn in degrees on top of the view (rotateView)
- `game.zoom = 1` †: the camera's zoom now (1 = as the view is): the game's (setZoom, a scene's camera.start) times the player's (settings.zoom: the wheel, a pinch), within the scene's camera.zoom range
- `E.showError(title, e)`: show an error in the red box at the top of the page (the engine does it for errors in update and draw); a click hides it. Before play has started it shows on the boot screen instead, as a report a player can screenshot

## 10b. Standard features

- `E.bootSplash(title = '')`: the boot screen's markup, for the very start of a page's <body>: it shows from the first paint, its bar moving while the page's scripts load (a pure CSS animation), and says so if the game's script never runs. The engine takes it over
- `E.diagnose(game = E.current)`: the report a bug needs, at any time (and on the boot screen when a game can't start): { engine, game, time, page, browser, device, screen, canvas, gpu, sound, storage, input, scene, errors, text (all of it, one line each, for a screenshot or a bug report), short (one line) }. game: the game to report on (E.current)
- `settings.default(key)`: a setting's default value
- `settings.define(sp)`: add a setting: { key, label, type: 'toggle' | 'slider' | 'select', value, min, max, step, options: [[value, label]] or [value], help, group: 'Game', apply(game, value) }. Its saved value is loaded (when it is a valid one) and applied; it shows on the settings screen. Returns its value
- `settings.keys(group)`: the keys of a group's settings, in order ('Display', 'Sound', 'Comfort', 'Controller', 'Touch', 'Game'), or every key
- `settings.reset(group)`: put a group's settings (or all of them) back to their defaults; a game's saves are not touched
- `settings.set(key, v)`: change a setting: checked (a slider kept in range, a choice among its options), saved, applied, onChange told. Returns the value kept (the old one when v is not a valid value)
- `settings.spec(key)`: the spec a setting was defined with (its label, type, range, options), or undefined
- `settings.saved`: false when the last save failed (storage blocked or full: the choices last for this visit)
- `fullscreen.enter(quiet)`: go full screen. Browsers allow it only from a tap, click or key press: call it from one (a button, the menu, a key's update step). Returns a promise of whether it worked (a refusal is kept in failed and noted on screen, unless quiet)
- `fullscreen.exit()`: leave full screen (Escape and the phone's back gesture do it too)
- `fullscreen.on`: true while the page is full screen
- `fullscreen.standalone`: true when the page was opened from a home screen as an app (no browser bars: nothing to go full screen from)
- `fullscreen.supported`: true where this page can go full screen (not an iPhone, which has Add to Home Screen instead; not a frame without permission; not headless)
- `fullscreen.toggle()`: full screen on or off, as the player asked (the corner's button, the menu): their choice is kept in settings.fullscreen, so a game starting on a phone goes full screen by itself only while they haven't turned it off
- `fullscreen.failed = null`: game: the game it serves; failed: why the last request was refused (a message), or null

## 11. Humanoid rig

- `new E.Attack(spec = {}, over) → slash`: new E.Attack(spec) or new E.Attack('slash', { reach: 9 }): a name from E.MOVES plus overrides
- `slash.active`: true while the strike can connect
- `slash.busy`: true from the wind-up to the end of the recovery
- `slash.cancel()`: stop the swing at once (hurt, dodged into)
- `slash.hits(targets, test, fn)`: during 'active', call fn(target) once per swing for each target where test(target) is true. Returns how many were hit
- `slash.start(canCancel = false)`: begin a swing if idle (or when canCancel and already recovering). Returns true if it started
- `slash.state`: what Humanoid.update wants as `attack` (null when idle)
- `slash.u`: 0..1 progress through the current phase
- `slash.update(dt)`: advance the swing by dt seconds; returns the phase that began during it ('active' = play the swing sound), or null
- `slash.hit`: the targets this swing has hit (each is hit once)
- `slash.phase = null`: 'wind' | 'active' | 'recover', or null when idle
- `slash.spec`: the move: seconds of wind, active and recover, and its shape for the rig (a0, a1, z0, z1, reach, hitAt)
- `slash.t = 0`: seconds into the phase
- `new E.Combo(specs, o = {}) → combo`: new E.Combo(items, { window: .3 }): items are move names, specs or Attacks
- `combo.active`: true while the current hit can connect
- `combo.busy`: true while a hit of the chain is swinging
- `combo.cancel()`: stop the chain; the next press starts it over
- `combo.current`: the Attack of the current hit
- `combo.hits(targets, test, fn)`: the current hit's hits(targets, test, fn): fn(target) once per swing where test(target) is true
- `combo.press()`: start or continue the chain. Returns true if a hit started
- `combo.state`: what Humanoid.update wants as `attack` (null when idle)
- `combo.update(dt)`: advance the current hit; returns the phase that began, as Attack.update
- `combo.idle = 99`: seconds since the last hit ended
- `combo.moves`: the Attacks
- `combo.step = -1`: the index of the current hit (-1 before the first)
- `combo.window`: seconds after a hit ends that a press still chains
- `new E.Humanoid(o = {}) → rig`: new E.Humanoid({ size: 1.3, build, weapon, outfit, hair, hat, sleeves, armor, hood, cape, colors, ... }): a character rig posed from math every step (API.md, "Characters", lists the options); update(dt, state) each step, draw(g, ox, oy, view) inside r.actor. hat: 'cap' | 'band' | 'crown' | 'helmet' | 'pointed' (or { style, color }); hood: true
- `rig.debug(r)` †: skeleton overlay for debugging, draws straight into the buffer
- `rig.draw(g, ox, oy, view)`: draw into g with (ox, oy) = projected position of the rig's root
- `rig.drawPortrait(g, x, y, size = 40, o = {})` †: a close-up bust for dialog boxes and menus, drawn live from the rig (blinks, hair and hats included): rig.drawPortrait(g, x, y, 40, { zoom: 3, turn: .6, bg: '#1a2050', frame: true }) // inside r.overlay(g => ...) zoom: pixels per world unit (3 = face fills the frame), turn: 0 = facing you, .6 = three-quarter. The bust stays upright while the rig kneels or lies down (upright: false shows the real pose); cape: false hides the cape; tint: '#808080' greys it out (a KO'd party member).
- `rig.drawSmear(r, colors = ['#ffffff', '#dff8ff', '#8fe0f2', '#4bb1d4'])` †: motion smear for the current swing, queued in front of the rig
- `rig.hand(which = 'R')`: world position of a hand ('R' holds the weapon): spawn bullets, sparks or thrown things here
- `rig.head()`: world position of the head (for speech bubbles, portraits, halos)
- `rig.kick(v)`: a squash-and-stretch kick: + stretches (a jump), - squashes (a landing, a hit)
- `rig.land(strength = 1)` †: a heavy landing: knees bend deep and spring back over a moment; strength 1 or more drops a hand to the ground (a three-point landing), .3-.6 is a soft one. Call it on the step the body lands
- `rig.tip()`: world position of the weapon tip (sword tip, gun muzzle, staff orb)
- `rig.update(dt, s = {})`: s: { x, y, z, vx, vy, facing, dash, hurt, attack, air, point } air: true while jumping or falling (legs tuck), point: true to hold the weapon hand forward (aiming a gun) attack: { spec, phase: 'wind' | 'active' | 'recover', u: 0..1 }. spec.kick = true swings the right foot instead of the hand also aim (radians up), crouch, sprint, climb, hang (hangZ: the top it hangs from, above the feet), flip: 0..1 (a roll), pose: 'cheer' | 'cast' | 'guard' | 'kneel' | 'crouch' | 'wave' | 'hips' | 'down' | 'die', stance: 'guard' | 'ready', down: 0..1
- `rig.worldOffset(p)`: where a point in the rig's own frame ([forward, right, up]; a joint such as rig.J.head, or one offset from it) sits, in world units from the rig's feet: add rig.x, y, z for the world point, or project it to draw at a joint
- `rig.C`: its colors (skin, hair, cloth, pants, boot, belt, cape, capeIn, metal, hilt, eye, ...), the defaults with o.colors over them; change one and it shows at the next draw
- `rig.J`: its joints this step in its own frame ({ hipL, kneeL, footL, shC, head, handR, ... }; rig.worldOffset(J.handR) gives one in the world)
- `rig.atkZ = 10`: the height of the weapon hand during an attack
- `rig.blink = 2`: seconds to the next blink
- `rig.capeL = null`: the cape's left edge points (null until it has a cape and has moved)
- `rig.capeR = []`: the cape's right edge points
- `rig.dieT`: pose 'die': a stagger, the knees give, then the body topples
- `rig.downW`: how far down it is, 0..1 (state down, pose 'down' or 'die'): it falls faster and faster and gets up steadily
- `rig.expr` †: the face shown ('smile', 'shout', 'angry', 'wince'), or null
- `rig.facing = 0`: the angle it faces, radians
- `rig.hop`: how high an attack's hop lifts it now
- `rig.hurtW = 0`: 0..1, how far into the hurt flinch
- `rig.lunge`: how far the body leans into an attack now, world units
- `rig.o`: its options, with the build's proportions and the defaults filled in (size, build, weapon, outfit, ...; legUpper, torso, headR and the other lengths are at size 1)
- `rig.phase = 0`: the walk cycle's phase, radians
- `rig.poseW`: held poses: 'cheer' (item get, victory), 'cast' (both hands forward), 'guard' (fists up), 'kneel', 'crouch', 'wave', 'hips' (hands on hips), and down: 0..1 (knocked flat). stance: 'guard' (fists up while moving) | 'ready' (weapon held forward)
- `rig.reach = 7`: how far it reaches forward
- `rig.spin = 0`: the body's extra turn during a spinning move, radians
- `rig.sq = 0`: squash and stretch, -0.45..0.45 (kick adds to it)
- `rig.sqV = 0`: its speed
- `rig.t`: seconds of its own clock (idle breathing, blinks)
- `rig.trail = []` †: recent points of the blade (or fist) tip, for the swing's smear
- `rig.x = 0`, `rig.y = 0`, `rig.z = 0`: where its feet are (from the last update)
- `E.MOVES: slash, backslash, overhead, rising, thrust, spin, plunge, twohand, jab, cross, hook, uppercut, haymaker, elbow, ... (24)`: a library of named attacks with timing and body motion (anticipation, lunge, step, twist, hop). new E.Attack('overhead'), new E.Attack('thrust', { reach: 10 }), new E.Combo(['jab', 'cross', 'hook', 'uppercut']) rig.update(dt, { ..., attack: E.move('roundhouse', .5) }) // any move at any moment, for previews and cutscenes The same move works on every build and in every view: heights are relative to the shoulders (rel: true), reaches scale with arm length, and horizontal swings turn into screen-plane swings in side views. A move's spec fields:
- `E.MOVES { a0, a1, z0, z1 }`: a0 / a1 angles (+ = the right side, or up in the screen plane), z0 / z1 heights
- `E.MOVES { reach, r0, r1, hand, plane, blade }`: reach, or r0 / r1 (an extending thrust); hand: 'R' | 'L' | 'both', plane: 'side' (always vertical), blade: 0 (no trail)
- `E.MOVES { wind, active, recover }`: the phases' seconds
- `E.MOVES { kick, spin, lunge, hop, crouch, lean, twist, hold }`: the body's motion (kick: true swings the right foot)
- `E.knockback(from, target, speed = 160, up = 0)`: push a target away from a point (attacker): uses target.push (E.Body) or its vx / vy. up = upward speed (knock into the air)
- `E.move(name, u = .5, phase = 'active')`: any move from E.MOVES at any moment, for previews and cutscenes: rig.update(dt, { ..., attack: E.move('roundhouse', .5) }) (u 0..1 through phase)

## 12. Blob rig

- `new E.Blob(o = {}) → blob`: new E.Blob({ R: 6.5, colors, ears, horns, wings, feet, tail, mouth, face }): a squash-and-stretch rig for slimes and jellies; blob.update(dt, state) each step, blob.draw(g, ox, oy, view) in an r.actor
- `blob.draw(g, ox, oy, view)`: draw(g, ox, oy, view). Creature features from the constructor options: ears: 'rabbit' | 'cat', horns: true, wings: true (flapping bat wings), feet: true, tail: true, mouth: true | 'fangs', face: 'front' (eyes always on the camera side, for Mana-style monsters) update(dt, { flap: 0..1, hang: true }) slows or folds the wings and hangs a bat upside down from its anchor.
- `blob.kick(v)`: a squash kick: + stretches (a hop), - squashes (a landing, a hit)
- `blob.update(dt, s = {})`: s: {squash target -0.4..0.4, look:[dx,dy] ground dir, squint}
- `blob.C`: its colors: dk, base, lt, spec, eye, pupil
- `blob.flap`: the wings' speed now, 0 (folded) .. 1
- `blob.flapP`: the wing beat's phase
- `blob.hang`: roosting upside down
- `blob.look = [1, 0]`: where its eyes look, a ground direction
- `blob.o`: its options (R: the radius, 6.5; ears, horns, wings, feet, tail, mouth, face, colors)
- `blob.scale = 1`: drawing scale (1)
- `blob.sq = 0`: squash -0.45..0.45 (- flat, + tall)
- `blob.sqV = 0`: its speed
- `blob.squint = false`: eyes narrowed
- `blob.t = 0`: its clock, seconds
- `blob.target = 0`: the squash it springs toward
- `blob.walk`: 0..1, how fast it is walking (its feet patter)

## 13. Tile map

- `new E.TileMap(o = {}) → map`: Walls standing on a floor (top-down, isometric, brawler). Either { rows: [...ASCII...], legend: { '#': 1, '@': 'hero' }, types, floorTex } (recommended) or { w, h, cells: [ids...], floor: [tags...], blocked: [0 | 1...], types, floorTex } (built in code: fill, setFloor; with no cells it starts as open floor).
- `new E.TileMap({ types })`: types[id] = { h, top, side, line, course, cut, cutH, face, roof }
- `new E.TileMap({ types[id].face })`: the wall's material (E.MATERIALS): 'brick' (default) | 'stone' | 'rock' | 'plank' | 'timber' | 'plaster' | 'hedge' | 'none' | any material id or '#hex pattern'
- `new E.TileMap({ types[id].roof })`: the top's material: 'speckle' (default) | 'plain' | 'tiles' (roof shingles) | 'slab' (paving) | 'leaves' | 'grass' | any material id or '#hex pattern'
- `new E.TileMap({ floorTex })`: floorTex(x, y, floorTag, view) -> [r, g, b] or [r, g, b, glow]
- `new E.TileMap({ floorMat, floorMats })`: a material for the floor, floorMats: { tag: material } for tagged cells (in place of floorTex)
- `new E.TileMap({ block })`: ['water', 'lava'] floor tags nobody can walk on (or put block: true in a legend entry)
- `map.arcClear(a, b, apex = 20, r = 0)`: does a jump arc from a to b (feet, { x, y, z }) clear every top on the way? The arc is a parabola peaking apex above the higher end; r > 0 also checks a track on each side of it. Jumps, throws, aerial takedowns
- `map.block(cx, cy, on = true)`: mark a cell blocked or free at runtime (a bridge appears, lava cools)
- `map.bounds(view)`: projected pixel bounds of the whole map for this view, { x0, y0, x1, y1 } with an 8-pixel margin (camera clamping: game.cam.bounds = v => map.bounds(v))
- `map.cell(cx, cy)`: the wall type id at a cell (0 = floor, -1 outside the map)
- `map.center(cx, cy)`: the world point at a cell's center
- `map.collide(b)`: push a circle { x, y, r } out of walls. If the body has a number z, walls lower than z + step (default 2) do not block it (it is standing or jumping above them). Returns true when it touched a wall.
- `map.drawFloor(r)`: draw the baked floor (first thing in draw, after r.sky); walls come from queueWalls(r)
- `map.drop(from, dir, o = {})`: what lies past the edge ahead: the first drop of more than step within reach (default 12) of `from` in direction dir, and the ground a body of its radius lands on just past it: { x, y, z, fall } or null (no edge, or a wall first). AI that won't walk off roofs, hop-downs, fall warnings
- `map.fill(cx, cy, w, h, id)`: put wall type id in every cell of a w x h block of cells (0 clears them): build maps in code
- `map.find(tag)`: first spawn with this tag ({ x, y, z, cx, cy }), or null
- `map.findAll(tag)`: every spawn with this tag
- `map.floorAt(x, y)`: floor tag from the legend ({ floor: 'water' }) at a world point, or null
- `map.groundAt(x, y, r = 0, z = 1e9, step = 2)`: highest surface under a circle footprint that a body at height z can stand on (floor = 0)
- `map.height(cx, cy)`: a cell's top: its wall's h, 0 on the floor, 1e9 outside the map (the height rules: E.HEIGHTS)
- `map.heightAt(x, y)`: wall height at a world point (0 on the floor)
- `map.landing(from, dir, o = {})`: where a jump from `from` in direction dir lands across a gap: past the first drop ahead (a top more than step below its feet), the nearest spot min..max away that rises at most rise and falls at most drop from its feet, stands above the gap's bottom, has room to stand, and that a jump arc peaking apex above the higher end clears (arcClear). { x, y, z, d } or null (a wall before any gap, or nowhere to land). o: { min: 35, max: 83, rise: 11, drop: 18, apex: 20 }
- `map.ledge(from, dir, o = {})`: a ledge to climb: in direction dir from `from`, the nearest top that rises min..rise above its feet within reach, with room to stand past the edge, looking straight ahead and spread radians to each side (a gap first means a jump: landing). { x, y, z (the spot to stand on top), rise, facing (the angle climbed), edge: [x, y] (where the hands grip) } or null. o: { reach: 18, min: 4, rise: 82, spread: .28 }
- `map.los(x0, y0, x1, y1)`: line of sight across the ground (true if nothing solid in between). It ignores heights: sight() is the one that sees over a low wall and from a roof
- `map.queueWalls(r)`: queue every visible wall box. Call once per frame after drawFloor.
- `map.ray(a, b, o = {})`: the first cell top that rises above the straight segment from a to b ({ x, y, z } world points; o.eye and o.target lift each end): { clear, t (0..1 along it), x, y, z } where it stops (b's point when clear). It walks every cell the segment crosses, not samples; a top level with the segment doesn't block it, and outside the map is solid
- `map.set(cx, cy, v)`: put wall type v at a cell (0 opens it: a door, a broken wall); bumps version, so caches and flow fields rebuild
- `map.setFloor(cx, cy, tag, block)`: give a cell a floor tag ('water', 'grass', what floorTex and floorAt read), and block it (deep water, lava) or not
- `map.sight(a, b, o = {})`: can a's eyes (z + eye) see b's chest (z + chest)? E.HEIGHTS gives both unless o ({ eye, target }) or the bodies' own eye and chest say otherwise. A guard sees over a planter lower than its eyes, and down from a roof
- `map.solid(id, x, y, z = 0, o = {})` †: make a shape solid in this map: map.solid(id | entry, x, y, z, o) with r.shape's placement (facing, scale, flip, params) -> the solid ({ x, y (the footprint's middle), z, top, hx, hy, c, s, shape, px, py (where it was placed) }; map.solids holds them; what stands on one sorts after it). A body overlapping its span in height is pushed out of its footprint; one coming down onto it lands on its top; one wholly below passes under. Register solids before the bodies' updates; drawing never sets them
- `map.solidAt(x, y)`: solidCell at a world point
- `map.solidCell(cx, cy)`: true where a cell has a wall (or is outside the map); walkable() also counts blocked floor
- `map.standable(x, y, z, r = 5, step = HEIGHTS.step)`: can a body of radius r stand at (x, y) with its feet at z? Nothing under its footprint rises above z + step (it would collide), no blocked floor (water, lava) is under it at floor level, and a top within step below z holds it up
- `map.toCell(x, y)`: world point -> [cx, cy] cell (center(cx, cy) goes back)
- `map.walkable(cx, cy)`: true where a body can walk: no wall and not a blocked floor (water, lava). Pathfinding uses this.
- `map.T`: the tile size in world units (16)
- `map.ao`: contact shadow width (world units) along the foot of walls; 0 turns it off
- `map.blocked`: cells nobody can walk on (deep water, lava, pits): legend { floor: 'water', block: true } or TileMap { block: ['water'] }
- `map.cells`: the wall type id of every cell, row by row (index cy * w + cx; change one with set)
- `map.cutaway`: walls between the camera and the floor drop low (types with cut: true; false turns it off)
- `map.floorMat` †: a material (E.MATERIALS id or '#hex pattern') for every floor cell
- `map.floorMats` †: { tag: material } for the cells with that floor tag, over floorMat (untagged cells have the tag null). Either stands in for floorTex
- `map.floorTags`: each cell's floor tag from the legend ('water', 'lava', ...), row by row, or null for a map built from cells
- `map.floorTex`: floorTex(x, y, tag, view) -> [r, g, b], the floor's color per pixel
- `map.floors`: the baked floor images by view (floors = {} re-bakes them after floorTex changes)
- `map.h`, `map.w`: the map's size in cells
- `map.light`: the direction light comes from, for shading wall faces
- `map.shimmer` †: animated sparkle on floor cells tagged 'water' or 'lava'
- `map.spawns`: spawn points from the ASCII rows: { tag, ch, cx, cy, x, y, z } (x, y = cell center)
- `map.types`: the wall types by id ({ h, top, side, face, roof, cut, ... })
- `map.version = 0`: counts every change to cells and blocked cells (set, block), so caches and flow fields know to rebuild
- `E.parseLevel(rows, legend = {})`: Parse an ASCII level (top row first; every character is one tile). legend maps a character to a number -> tile / wall type id (0 = empty) a string -> a spawn tag; the cell stays empty and spawns[] gets { tag, ch, cx, cy } an object -> any of { tile: id, floor: 'water', spawn: 'hero', block: true } (block: nobody can walk on this cell) '.' and ' ' are empty unless the legend says otherwise. Unknown characters warn once and become empty.

## 13b. Materials

- `E.MATERIALS: brick, stone, rock, plank, timber, plaster, hedge, speckle, plain, tiles, slab, leaves, grass, flagstone, ... (61)`: the materials by id: { color, pattern, ...its numbers, ramp, glow } or a painter of a surface (face, roof, floor, tile); add your own: E.MATERIALS.oak = { color: '#8a5a36', pattern: 'planks', bw: 3 }. Any material id takes '#hex pattern key=value' too
- `E.PATTERNS`: the patterns, by name: (s, m) => a tone step (-1 .. +2) at a point s of a surface, for a material m's numbers. Add your own: E.PATTERNS.waves = (s, m) => Math.sin(s.u / (m.size || 3)) > .8 ? 1 : 0
- `E.PATTERNS.bark(s)` †: fissures running up a trunk; a cut end shows its rings
- `E.PATTERNS.bricks(s, m)` †: running bond, bw x bh (6 x 3), mortar a step darker (mortar: its step)
- `E.PATTERNS.cloth(s, m)` †: a fine weave and soft folds (fold .9)
- `E.PATTERNS.crate(s, m)` †: a framed and braced crate side (frame 2 wide, a diagonal brace, boards bw 3 inside); lids are planks
- `E.PATTERNS.foliage(s, m)` †: leaf clumps (size 3.5), each lit at its top and dark at its foot, a few bright leaves
- `E.PATTERNS.glaze(s)` †: a glossy shine where the light is strongest, a few specks
- `E.PATTERNS.metal(s, m)` †: hard light (a shine where lit, darker in shade); rivet: a rivet every rivet units
- `E.PATTERNS.noise(s, m)` †: soft patches (scale 4)
- `E.PATTERNS.none()` †: the light's bands alone
- `E.PATTERNS.planks(s, m)` †: boards bw wide (3) with joints and butt ends every len (14); along u on lids and flat sides, along v (staves) on turned surfaces; dir: 'v' turns them on flat faces
- `E.PATTERNS.shingles(s, m)` †: staggered rows of roof tiles (course 2.5, bw 4)
- `E.PATTERNS.speck(s, m)` †: dark and light specks (amount .08)
- `E.PATTERNS.stones(s, m)` †: irregular stones (Voronoi cells about size across, 5) with dark joints and a lit rim
- `E.PATTERNS.thatch(s, m)` †: straw in overlapping courses (course 3)
- `E.PATTERNS.tiles(s, m)` †: square tiles size (4) with grout
- `E.material(id, local, kind = 'material', depth = 0)`: a material ready to draw: { q (its entry), ramp (five [r, g, b], dark to light), hexes (the same as '#rrggbb'), pat (its pattern), glow }. id: an id (looked up in local first, a set's own, then E.MATERIALS), a shorthand string or an entry; kind names the surface, for the warning when the id is unknown (then null)

## 14. Flow field

- `new E.FlowField(map, o = {}) → flow`: new E.FlowField(map, { step: 2, climb: 0, drop: 0, jump: 0 }): distances over the tops a body can stand on (E.HEIGHTS). With no options it covers the floor (and walls no higher than step, which bodies walk over); a target on a roof gets a field across the roofs it connects to
- `new E.FlowField({ step, climb, drop })`: next-door cells connect when their tops differ by at most step, or going up by up to climb and down by up to drop (agents that climb walls or hop down)
- `new E.FlowField({ jump })`: (world units) links tops across a gap that a jump clears, straight along a row or column, by map.landing's rules (up to jumpRise higher, 11, and jumpDrop lower, 18): an agent with E.Mover's leap chases across roofs. With jump, distances are travel: a jump of k cells costs k, and a climb 1 plus its rise in cells (climbing is slow), so a chase leaps a gap rather than drop into the street and climb back up
- `flow.dir(x, y, fx, fy)`: normalized ground direction to walk from (x, y) toward the target (straight at it where the field doesn't reach)
- `flow.next(x, y)` †: the next cell to head for from (x, y): { x, y, z (its center and top), kind: 'walk' | 'climb' | 'drop' | 'jump', edge (how far (x, y) is from the side of its cell it leaves by) }, or null where the field doesn't reach (or at the target). An AI standing on the ground presses jump for a 'climb' or a 'jump' once edge is under its radius plus a little (E.Mover climbs or leaps; a press in the air would be kept for the landing)
- `flow.update(x, y)`: aim the field at a world point; it rebuilds only when the target's cell or the map (map.version) changes
- `flow.climb`: how much higher a next-door top may be (an agent that climbs walls)
- `flow.d`: each cell's distance in steps to the target cell (1e9 where it can't get there), row by row
- `flow.drop`: how much lower (an agent that hops down)
- `flow.jump` †: the widest gap jumped (world units, 0 = none)
- `flow.jumpDrop`, `flow.jumpRise` †: how much higher and lower a jump may land
- `flow.map`: the map it paths over
- `flow.step`: the height difference walked over freely (2)
- `flow.tx = -1`, `flow.ty = -1`: the target's cell
- `flow.version = -1`: the map's version it was built for

## 15. Texture helpers for floortex functions

- `E.tex`: floor textures for a TileMap's floorTex(x, y), each giving [r, g, b] at a world point; as materials too: floorMat: 'grass'
- `E.tex.checker(x, y, o = {})`: checkerboard tiles (castle floors, bonus rooms). o: { a, b, size }
- `E.tex.dirt(x, y, o = {})`: dirt, sand or snow: base color with soft noise and specks. o: { base, dark, light }
- `E.tex.flagstone(x, y, pal, size = 16)`: stone flagstones with running-bond rows. pal: {stones:[hex..], mortar, hi, lo, speck}
- `E.tex.grass(x, y, o = {})`: grass with darker tufts and a few flowers. o: { base, dark, light, flower } hex colors
- `E.tex.plain(x, y, o = {})`: plain color with light noise, for roads, carpets and space floors. o: { base, amount }
- `E.tex.planks(x, y, o = {})`: wooden floor boards running along x. o: { base, dark, line }
- `E.tex.water(x, y, o = {})`: water with static ripple lines (baked, so it does not move). o: { base, dark, light }

## 16. Platform map

- `new E.PlatformMap(o = {}) → level`: { rows: [...ASCII, top row first...], legend: { '#': 1, '@': 'hero' }, types: { 1: {...} }, tile: 16, depth: 16 }. Tile kinds: 'solid' (default) | 'oneway' | 'ladder' | 'slope' | 'hazard' | 'deco' | 'back'
- `level.bounds(view)`: projected pixel bounds of the level for this view (use for game.cam.bounds)
- `level.cell(cx, cz)`: tile id at column cx, row cz (cz = 0 is the bottom). Left and right of the level are solid walls unless edges: 'open'
- `level.cellsTouching(b, what)`: tiles overlapped by a body box { x, z, w, h }: [{ cx, cz, id, kind }] (optionally only one kind or id)
- `level.center(cx, cz)`: a cell's center -> [x, z]
- `level.draw(r)`: draw the level as the background layer: call right after r.sky() and before anything else
- `level.find(tag)`: the first spawn with this tag ({ x, y: 0, z, cx, cz }), or null
- `level.findAll(tag)`: every spawn with this tag
- `level.groundBelow(x, z)`: top of the highest solid or one-way tile at or below height z in this column, or null over a pit
- `level.height`: the level's height in world units (width is its width)
- `level.kind(cx, cz)`: a cell's kind: 'solid', 'oneway', 'ladder', 'slope', 'hazard', 'deco' or 'back', null when empty ('solid' outside)
- `level.kindAt(x, z)`: kind() at a world point
- `level.move(b, dt, solids)`: Move a body { x, z, vx, vz, w, h } (x = center, z = feet, vz > 0 = up) by its velocity, colliding with the level. Sets b.onGround, b.onOneWay, b.hitWall (-1 left, 1 right, 0), b.hitCeiling, b.bumped ({ cx, cz, id } of a ceiling tile hit from below, for ? blocks and bricks) and b.ground (the moving solid it stands on). One-way tiles hold the body from above unless b.drop > 0. solids: optional array of extra boxes { x, z, w, h, vx, vz, oneway } (moving platforms, elevators, crates) that also carry what stands on them.
- `level.set(cx, cz, id)`: put tile type id at a cell (0 clears it; cz counts from the bottom row); bumps version
- `level.slopeZ(cx, cz, x)`: surface height of a slope tile at world x
- `level.solidAt(x, z)`: true where a world point is inside a solid tile
- `level.toCell(x, z)`: a world point -> [cx, cz]
- `level.touching(b, what)`: does the body box overlap a tile of this kind ('hazard', 'ladder', ...) or id?
- `level.width`: width and height of the level in world units
- `level.T`: the tile size (16)
- `level.cells`: stored bottom row first: cz = 0 is the lowest row and z grows upward
- `level.depth`: how deep tiles are drawn in tilted views, world units (the tile size)
- `level.edges`: 'solid' (the default) makes the level's left and right edges walls, 'open' lets bodies walk off them
- `level.h`, `level.w`: the level's size in cells
- `level.spawns`: spawn points: { tag, ch, cx, cz, x, y: 0, z } with x = cell center and z = bottom of the cell (feet)
- `level.types`: the tile types by id, with their defaults filled in ({ kind, style, side, top, ... })
- `level.version = 0`: counts every change to the cells (set)
- `new E.Platformer(o = {}) → hero`: a side-scroller character body with modern, forgiving controls (coyote time, jump buffering, variable jump height, optional double jump, wall jump, dash, ladders, knockback). const hero = new E.Platformer({ x, z, w: 8, h: 22 }); update: hero.update(dt, level, game.input) (or an intent object for enemies: { x: -1..1, jump, jumpPressed, up, down, dash }) then read hero.onGround, hero.jumped, hero.landed, hero.facing (1 or -1), hero.climbing, hero.air draw a Humanoid with rig.update(dt, hero.rigState()) Units: world units per second. One tile = 16. A 285 jump with gravity 800 clears about 3 tiles.
- `hero.knock(dir, speed = 130, up = 170, stun = .3)`: push the body (getting hit): dir = -1 / 1
- `hero.rigState(extra)`: state for Humanoid.update: rig.update(dt, hero.rigState({ attack }))
- `hero.update(dt, level, ctl = {}, solids)`: move it one step: ctl is game.input or an intent { x: -1..1, jump, jumpPressed, up, down, dash } (enemies, bots); solids: moving platforms [{ x, z, w, h, vx, vz }] to stand on
- `hero.accel = 900`, `hero.airAccel = 650`, `hero.decel = 1100`: how fast it speeds up and slows down on the ground and in the air
- `hero.air = false`: in the air, not climbing
- `hero.airJumps = 0`: extra jumps in the air (1 = double jump)
- `hero.buffer = .13`: seconds a jump pressed before landing is kept
- `hero.climb = 70`: ladder speed
- `hero.climbing = false`: on a ladder
- `hero.coyote = .09`: seconds a jump still works after walking off a ledge
- `hero.cut = .45`: the share of upward speed kept when jump is let go early (short hops)
- `hero.dash = 0`: dash speed (0 = no dash)
- `hero.dashTime = .22`: seconds a dash lasts
- `hero.dashing = 0`: seconds of dash left
- `hero.drop = 0`: seconds left of dropping through a one-way platform
- `hero.facing = 1`: 1 right, -1 left
- `hero.fallGravity = 1150`: while falling (snappier landings)
- `hero.gravity = 800`: while rising
- `hero.h = 22`, `hero.w = 8`: its box (x is its center, z its feet)
- `hero.hitWall`: keep wall contact while holding toward it
- `hero.jump = 285`: the jump's starting speed
- `hero.jumped = false`, `hero.landed = false`: it jumped or landed this step
- `hero.maxFall = 330`: the fastest fall
- `hero.onGround = false`: standing on something
- `hero.run = 95`: top running speed
- `hero.stun = 0`: seconds of knockback left (no control)
- `hero.vx = 0`, `hero.vz = 0`: its speed
- `hero.wallJump = false`: jumps off walls
- `hero.wallSlide = 70`: the slowest fall against a wall
- `hero.x = 0`, `hero.z = 0`: its feet's position (side view: x right, z up)
- `hero.y = 0`: its depth (0)

## 17. Body

- `new E.Body(o = {}) → body`: new E.Body({ x, y, r: 5, ... })
- `body.jump(v = 220)`: leave the ground with upward speed v (only when standing). Returns true if it jumped
- `body.push(ix, iy, iz = 0)`: add an impulse (knockback, explosion): push(vx, vy, vz)
- `body.update(dt, map)`: move it one step: speed, friction, walls (map.collide: lower walls are walked onto), gravity and the ground under it (map.groundAt)
- `body.bounce = 0`: 0..1, how much speed it keeps off walls and the floor
- `body.bounced = false`: it hit the ground and bounced up this step (dust, a thud)
- `body.friction = 0`: slows vx and vy per second (0 = none)
- `body.gravity = 700`: pulls z down (world units per second squared)
- `body.groundZ = 0`: the height of what is under it
- `body.h = 32` †: its height (32, a standing actor's: it spans z to z + h, so it passes under a solid shape above that and walks into one in that span)
- `body.hitWall = false`: it touched a wall this step
- `body.landed = false`: it landed this step
- `body.onGround = true`: standing
- `body.r = 5`: its radius
- `body.step = 2`: the height it walks up without jumping (E.HEIGHTS.step)
- `body.vx = 0`, `body.vy = 0`, `body.vz = 0`: its speed, world units per second
- `body.x = 0`, `body.y = 0`, `body.z = 0`: its position (z = feet)

## 17b. Actions

- `E.ACTIONS: climbUp, vault, hopDown, roll, getUp, takedown` †: the actions E.Action plays. Add your own: E.ACTIONS.name = { beats, setup, at }; setup(A) and at(A, beat, u) get the action: its options A.o, A.start (where the body began), A.body; setup may change A.beats. Play one: mover.play('takedown', { other })
- `new E.Action(name, o = {}) → action`: new E.Action(name, { body, to, other, dir, dist, top, aerial, reverse, speed: 1 }): play E.ACTIONS[name] on a body (and on o.other for a paired action). It moves them itself: run update(dt) every step instead of their physics, and feed rigState() to the rig. Each body ends standing where the action put it
- `action.canCancel` †: true during a beat marked as one the action may be cut short in (spec.cancel)
- `action.cancel()` †: stop now: the bodies stay where they are
- `action.invulnerable` †: true while hits should miss (spec.safe: [from, to] of the action's progress)
- `action.otherState(extra)` †: the rig state for the other body of a paired action (the victim of a takedown)
- `action.rigState(extra)` †: the rig state for the body (merge extra over it): x, y, z, its speed, facing and the beat's pose
- `action.u` †: 0..1 through the whole action
- `action.update(dt)` †: move the bodies one step; returns true while the action runs (false once it has ended)
- `action.beat` †: the name of the beat playing now
- `action.beats` †: [[name, seconds], ...]
- `action.body`, `action.other` †: the bodies it moves
- `action.done = false` †: it has ended (or was cancelled)
- `action.duration` †: the action's length in seconds (o.speed shortens it)
- `action.name` †: the action's name
- `action.o` †: the options it was given
- `action.spec` †: its E.ACTIONS entry
- `action.start` †: where the body was when it began
- `action.t = 0` †: seconds played
- `new E.Mover(o = {}) → mover`: new E.Mover({ x, y, z, r: 5, ... }): any of its fields, below, as options. An E.Body: it has body.jump, push and the body's fields too
- `mover.dodge(dir, dist = 34)` †: a dodge roll toward dir (an angle or [dx, dy]; default its facing) when it stands free. Returns the action, or null
- `mover.play(name, o = {})` †: start an action now (E.ACTIONS name, its options): it moves the body until it ends
- `mover.respawn()` †: back to the last safe spot (after water, a pit, a fall it shouldn't survive)
- `mover.rigState(extra)` †: the rig state: rig.update(dt, hero.rigState({ attack })): its motion, crouch, sprint and landing, or the playing action's pose; extra is merged over it
- `mover.update(dt, map, ctl = {}, view)` †: one step. ctl: game.input (needs the actions move, jump, and sprint / crouch if it has them; screen directions turn into ground ones through view, the game's by default) or an intent { move: [dx, dy], sprint, crouch, jumpPressed }
- `mover.accel = 700`, `mover.airAccel = 260` †: how fast it gets there
- `mover.action = null` †: the E.Action playing, or null
- `mover.buffer = .12` †: seconds a jump press is kept
- `mover.climb = true` †: climbs ledges (true)
- `mover.climbMax = 82` †: the highest ledge it climbs
- `mover.coyote = .1` †: seconds a jump still works after leaving an edge
- `mover.crouch = false` †: sneaking (a toggle)
- `mover.facing = 0` †: the angle it faces
- `mover.fell = 0`, `mover.hurt = false`, `mover.inHazard = false` †: what happened this step
- `mover.gapAssist = true` †: a jump at a gap aims for the far side
- `mover.hopMax = 48` †: drops up to this deep are hopped down
- `mover.hurtAt = 72`, `mover.rollAt = 26` †: fall heights that roll and that hurt
- `mover.jumpSpeed = 220` †: a jump's upward speed
- `mover.lastSafe = null` †: the last spot it stood safely, for respawn()
- `mover.run = 85`, `mover.sneak = 32`, `mover.sprintSpeed = 125`, `mover.walk = 50` †: top speeds (world units a second)
- `mover.sprinting = false` †: sprinting now
- `mover.turn = 14` †: how fast it turns, radians a second
- `mover.vault = 14` †: walls up to this high are vaulted at a run
- `new E.Suspicion(o = {}) → suspicion`: new E.Suspicion({ rise, decay, notice, search, alert, forget }): a guard's mind (its fields, below, are its options). Its level rises while it sees the target (faster the more exposed and nearer), decays while it doesn't, and names a state: 'calm', 'notice' (turn and look), 'search' (go to last), 'alert' (chase). An alert guard that loses the target searches for forget seconds. Each step: suspicion.update(dt, seen, target)
- `suspicion.hear(strength, at)` †: a noise heard (strength 0..1, from E.hears) at a point: at least noticed, never more than searching
- `suspicion.reset()` †: back to calm
- `suspicion.update(dt, seen, target)` †: one step: seen is E.sees' result (or true / false), target the body seen. Returns the state
- `suspicion.alert = 1`, `suspicion.notice = .3`, `suspicion.search = .65` †: the levels where each state starts
- `suspicion.changed = false` †: the state changed this step
- `suspicion.decay = .3`, `suspicion.rise = 1.5` †: per second
- `suspicion.forget = 6` †: seconds an alert guard searches after losing the target
- `suspicion.last = null` †: where it last saw or heard the target ({ x, y, z }), or null
- `suspicion.level = 0` †: 0..1.2, how suspicious
- `suspicion.since = 0` †: seconds since it last saw or heard anything
- `suspicion.state = 'calm'` †: 'calm' | 'notice' | 'search' | 'alert'
- `E.hears(lis, noise, map)`: how loud a noise ({ x, y, z, loud: its radius in world units, 80 }) is where listener stands: 1 at the noise, 0 at its radius and beyond, halved when a top of map stands between them (a wall muffles it)
- `E.sees(obs, tgt, o = {})`: can observer see target? { seen, d (ground distance), angle (observer -> target), exposure: 0..1 }. The target must be within range and inside the cone fov wide (radians) about the observer's facing; exposure is the share of three points on it (its feet, its chest, its head) that the observer's eyes see past every top of o.map, times the target's own exposure (default 1) and .6 when it crouches (it also shows lower). o: { range: 120, fov: 1.6, facing, map, eye }

## 18. Bullets

- `new E.Bullets(game, o = {}) → shots`: new E.Bullets(game, { plane: 'ground' | 'side', max: 800, sparks: true }); game: its game
- `shots.burst(base, vels)`: fire several at once from a pattern list of [vx, v2] (v2 = vy on the ground plane, vz in side view)
- `shots.clear(team)`: remove every bullet, or only one team's
- `shots.draw(r)`: queue them for drawing (glowing cores, or their sprites)
- `shots.fire(b)`: fire one bullet. Fields: x, y, z, vx, vy, vz, r, dmg, life, team, color, core, sprite, pierce, grav, data
- `shots.hit(targets, fn, team)`: test bullets of `team` against targets (objects with x, y, z and r, or w/h in side view). fn(bullet, target). Returns hits
- `shots.update(dt, map)`: move them one step; with a map they stop at walls (a TileMap, or a PlatformMap in side views)
- `shots.list = []`: the live bullets
- `shots.max`: at most this many at once
- `shots.plane`: 'ground' (they fly over x and y) or 'side' (x and z)
- `shots.sparks`: a puff of sparks where one hits a wall
- `E.pattern`: velocity helpers for bullet patterns. Angles in radians (0 = east / right). Each returns [vx, v2] or a list of them
- `E.pattern.aim(a, b, speed)`: aim from a to b on the ground plane (x, y); aimSide uses x, z
- `E.pattern.aimSide(a, b, speed)`: a velocity from a toward b in a side view (x, z)
- `E.pattern.dir(angle, speed)`: one velocity at an angle
- `E.pattern.ring(n, speed, offset = 0)`: n bullets in a full circle, rotated by offset
- `E.pattern.spread(angle, n, arc, speed)`: n bullets fanned across `arc` radians around `angle`

## 19. Spatial hash

- `new E.SpatialHash(cell = 32) → grid`: new E.SpatialHash(cell = 32): buckets things by position, to find what is near cheaply; map: the buckets
- `grid.add(o, x = o.x, y = o.y)`: put o in the bucket at (x, y)
- `grid.build(list, xk = 'x', yk = 'y')`: clear, then add every live thing in list (skips o.dead); do it once a step
- `grid.clear()`: empty it
- `grid.near(x, y, r, fn)`: call fn(o) for everything in the cells touching the circle (check the exact distance yourself)
- `grid.query(x, y, r)`: what lies within about r of (x, y), as a list (near() calls a function instead)
- `grid.cell`: new E.SpatialHash(cell = 32): buckets things by position, to find what is near cheaply. cell: the bucket size in world units; map: the buckets

## 20. Audio

- `E.note(n)`: note name -> frequency: E.note('A4') = 440, E.note('C#5'), E.note('Bb2'). Numbers pass through
- `E.songs: title, adventure, dungeon, boss, victory`: ready-made chiptune loops (original compositions). game.audio.music('adventure')
- `game.audio.define(name, voice)`: add or replace a named sound: audio.define('zap', { wave: 'saw', freq: 1200, to: 200, dur: .2 })
- `game.audio.duck(on = true)`: quiet the music (to 35%) while on: under a game's own pause, map or dialog screen. The engine also ducks it while game.paused
- `game.audio.music(song, o = {})`: Loop a song (or play once with { loop: false }). song = { bpm: 120, steps: 4, tracks: [ { wave: 'square', vol: .2, notes: 'C5 - E5 - G5 - . . | ...' }, one token per step { wave: 'triangle', notes: 'C3 . C3 . G2 . G2 .' }, { wave: 'drums', notes: 'k . h . s . h . k k h . s . h .' } ] } tokens: C4 F#3 Bb2 = note, '-' holds the previous note, '.' = rest, '|' is ignored (bar lines). steps = steps per beat (4 = sixteenth notes). Each track loops on its own length. E.songs has ready-made loops: title, adventure, dungeon, boss, victory.
- `game.audio.mute(on = !this.muted)`: toggle (or set) mute; returns the new state
- `game.audio.ready`: true once the browser lets the game make sound
- `game.audio.setVolume(v)`: set the master volume, 0..1
- `game.audio.sfx(what, o = {})`: Play a sound effect: a preset name ('jump', 'coin', 'hit', 'explode', ...), a voice object, or a list of voices. opts: { vol: 0..1, pitch: multiplier, vary: random pitch spread (default 0.03) }
- `game.audio.stopMusic()`: stop the music (it fades out over 60 ms)
- `game.audio.ctx = null`: the Web Audio context, made at the first sound (null before, or where there is none)
- `game.audio.ducked = false`: true while duck(true) holds the music down
- `game.audio.failed = null`: why there is no sound (a message), or null
- `game.audio.musicVolume = .5`, `game.audio.sfxVolume = 1`: 0..1 for effects and music
- `game.audio.muted = false`: true while mute() is on
- `game.audio.presets`: the named sound effects, sfx(name) plays one and define(name, voice) adds one
- `game.audio.song = null`: the music playing (null for none)
- `game.audio.volume = .7`: master volume 0..1

## 21b. Backdrops

- `new E.Backdrop(o = {}) → backdrop`: new E.Backdrop('castle-night') (a preset: E.Backdrop.presets) or new E.Backdrop({ sky: [colors top to bottom], sun, moon, stars, layers: [{ kind: 'mountains' | 'hills' | 'forest' | 'city' | 'castle' | 'clouds' | 'sea' | 'fog' | 'stalactites', color, y, height, parallax, seed }] }): a parallax sky and scenery drawn behind a level. sun, moon: { x, y (0..1 of the screen), r, color }
- `E.Backdrop.presets` †: the preset names, all ten: day, dusk, night, castle-night, city-night, desert, forest, ocean, cave, space
- `backdrop.draw(r)` †: draw the backdrop first in draw(r), before the level; it scrolls with the camera by each layer's parallax
- `backdrop.layers` †: its scenery layers, back to front, with their defaults filled in
- `backdrop.sky` †: the sky's gradient colors, top to bottom
- `E.PROPS: torch, candle, candelabra, chandelier, brazier, window, banner, pillar, statue, crate, barrel, chest, pot, sign, fence, lamp, door, tree, pine, bush, flowers, grass, rock, crystal, bones, skull, vines, cobweb, lantern, streetlamp, awning, hydrant, trashcan, firedrum, sandbags, cactus, palm, mushroom` †: the names of the built-in props for r.prop(name, x, y, z, opts) and E.prop(name, opts)
- `E.SHAPES: barrel, crate, chest, table, chair, stool, bench, bed, bookcase, shelf, pot, jar, sack, cart, ... (25)`: the shapes by id: { about, tags, mats: { slot: material }, parts | make(params), params, foot, lights, flames } (the core library's, the sets' as 'SET:id' from E.addAssets, and your own: E.SHAPES.stool = {...})
- `E.addAssets(set)`: register a store set (src/assets/sets/*.js: { set, format: 1, credit, sources, materials, shapes, sprites }): its entries are named 'SET:id' (so one set never changes another's, or the core's) and find their own set's materials and shapes first. An id that is already there warns and keeps the first. Returns { shapes: [ids], materials: [ids], sprites: { id: sprite } } (sprites are E.sprite data; a color may be 'material:tone', tone deep | sh | base | lt | hi)
- `E.materialTile(id, o = {})`: a material's pattern as a tile of pixels, for a 3D renderer's texture: E.materialTile(id, { size: 32 (world units square: it repeats every size; a face pattern's whole face), px: 2 (pixels a unit), lid: false (true: as on a face looking up), curved (as on a turned face), band: 2 (the light: 0 dark .. 4 bright) }) -> { w, h, rgba (Uint8ClampedArray, top row first, v up the tile) }; null for an unknown material
- `E.prop(name, o = {})`: build (and cache) a prop: { frames: [sprite], glow: [sprite] | null, w, h }
- `E.shapeBox(id, x, y, z = 0, o = {})`: where a placed shape stands, as both engines collide with it: E.shapeBox(id | entry, x, y, z, { facing, scale, flip, params }) -> { x, y (its footprint's middle), z, top, hx, hy (half its footprint, along its own x and y), c, s (the turn's cosine and sine) }; null for an unknown shape. map.solid makes one solid; world.shape gives it a collider
- `E.shapeInfo(id, o = {})`: what a shape draws, for tools and tests: E.shapeInfo(id, { view: 'iso', facing, scale, mats, params }) -> { w, h, ox, oy, tris, prims (its primitives), parts (each primitive's pixels on screen: 0 is never seen there), colors (distinct), pixels, bounds [x0, y0, z0, x1, y1, z1], rgba }; null for an unknown shape
- `E.shapeMesh(id, o = {})`: a shape's triangles, for a 3D renderer (the 3D engine's world.shape): E.shapeMesh(id | entry, { params, mats, seg }) -> { groups: [{ mat, key, lid, curved, face, pos, nrm, uv }], bounds [x0, y0, z0, x1, y1, z1] } in the entry's own units and frame (z up, its front +y, its own scale applied: place it with the placement's facing, scale and flip). The same parts as r.shape draws; null for an unknown shape
- `E.shapeMesh({ seg })`: seg(r): the segments round a radius r (default 8 to 24)
- `E.shapeMesh() → groups`: each one's mat (the material ready to draw: E.material's), key (its id), lid (true: the faces looking up or down, which some patterns draw their own way), curved (turned or round faces: planks run up them), face (a pattern drawn once per face, the crate's sides and bark's ends: uv runs 0 to 1 across each face), pos, nrm, uv (Float32Arrays: three numbers a corner, three corners a triangle; uv two a corner, world units across the surface)
- `E.shapeSprite(id, o = {})`: a shape as a sprite (E.sprite's kind: r.sprite, px.sprite, inventories, HUDs, portraits): E.shapeSprite(id, { view: 'iso', facing, size (its scale, 1), mats, params, outline: true | a color | false }). The view is a name or a View, as given (r.shape draws steep views from the characters' angle: E.charView(view) gives that); a bag icon is the item's shape seen at an angle. r.sprite stands it on its feet (foot: [x, y] in the sprite) unless an anchor is given

## 21. Ui

- `new E.Dialog(game, o = {}) → talk`: new E.Dialog(game, { speed, lines, place, color, nameColor, voice, bg, border }): a dialog box that types its text; say() opens it, update(dt) and draw(r) run it
- `talk.close()`: close it now (and forget pending presses, so the same press doesn't also attack)
- `talk.draw(r)`: draw it (anywhere in draw: it goes to the overlay)
- `talk.pageLen`: the letters on the page shown
- `talk.say(text, o = {})`: open with one string or a list of strings (each starts a new page). opts: { name, onDone, choices, onChoice, portrait: rig (a live close-up of that Humanoid beside the text) or a function (g, x, y, size), portraitSize: 40, portraitOpts: { zoom, turn, bg } } choices: ['YES', 'NO'], shown on the last page; onChoice(i) gets the one picked
- `talk.typing`: true while the page is still typing
- `talk.update(dt)`: type and turn pages (confirm finishes the line, then turns the page); returns true while open and modal, so gameplay can wait: if (talk.update(dt)) return;
- `talk.auto`: seconds each page stays after typing
- `talk.bg = '#141a3a'`, `talk.border = '#e8e4ff'`: the box's colors
- `talk.choice = 0`: the choice under the cursor
- `talk.choices`: the answers offered on the last page, or null
- `talk.color = '#ffffff'`: the text's color
- `talk.game`: its game
- `talk.i = 0`: the page shown
- `talk.lines = 3`: text lines per page
- `talk.modal`: false lets play go on (radio chatter)
- `talk.name`: the speaker's name shown on the box
- `talk.nameColor = '#ffd36a'`: the speaker's name's color
- `talk.onChoice`: called with the index picked
- `talk.onDone`: called when the last page closes
- `talk.open = false`: true while it shows
- `talk.pages = []`: the text wrapped into pages of lines
- `talk.place = 'bottom'`: 'bottom' | 'top' | 'middle'
- `talk.portrait`: the portrait beside the text (a Humanoid, or a function (g, x, y, size)), or null; pSize: its size in pixels; pOpts: its options ({ zoom, turn, bg })
- `talk.shown = 0`: letters typed so far on it
- `talk.speed = 50`: letters typed per second
- `talk.voice = 'text'`: the sound effect each letter blips ('text'; null for silence)
- `new E.Menu(game, items, o = {}) → menu`: Menu with a cursor (title screens, pause menus, shops, battle commands). const menu = new E.Menu(game, ['START', 'OPTIONS', { label: 'CONTINUE', disabled: !save }], { onPick(i, item) {...}, onCancel() {...} }); update: menu.update(dt) draw: menu.draw(r) opts: { x: 'center' | px, y: 'center' | px, title, box: true, color, pick: '#ffd36a', columns: 1 }
- `menu.draw(r)`: draw it to the overlay
- `menu.selected`: the entry under the cursor
- `menu.update()`: move the cursor (up, down; held keys repeat; the mouse over an entry) and pick (confirm, or a click or tap on an entry) or cancel; returns true when it picked or cancelled
- `menu.active = true`: false stops it reading input
- `menu.bg = '#141a3a'`, `menu.border = '#e8e4ff'`: the window's colors
- `menu.box = true`: draw a window round it
- `menu.color = '#ffffff'`: the entries' color
- `menu.dim = '#6a6488'`: disabled entries' color
- `menu.game`: its game
- `menu.i = 0`: the one under the cursor
- `menu.items`: the entries (strings, or { label, disabled })
- `menu.onCancel = null`: called on cancel
- `menu.onMove = null`: called (i, item) when the cursor moves
- `menu.onPick = null`: called (i, item) on confirm
- `menu.pick = '#ffd36a'`: the color of the one under the cursor
- `menu.sound = true`: false silences it
- `menu.title = null`: a heading, or null
- `menu.x = 'center'`, `menu.y = 'center'`: where it sits, 'center' or pixels
- `new E.Shell(game, o = {}) → shell`: new E.Shell(game, { theme, screens: { name: spec }, settings: { items, onChange(settings, key) }, store: 'shell-settings', meters: .125, standard: true }): an HTML interface over the game (see the section's header)
- `new E.Shell({ theme })`: CSS variables (ink, paper, accent, muted, danger, line, font, titleFont)
- `new E.Shell({ screens })`: specs ui.show(name) starts from (the pause screen follows game.paused; screens: { pause: false } leaves it out)
- `new E.Shell({ settings })`: settings.items: the game's own settings, { key, label, type: 'toggle' | 'slider' | 'select', min, max, step, options, value } (kept in game.settings, beside the standard ones)
- `new E.Shell({ store, meters })`: store: where an older version saved them; meters: meters per world unit for distances
- `new E.Shell({ standard })`: false leaves out the standard menu (the pause screen's Settings, Controls, Full screen and Quit, and the settings' groups)
- `shell.back()` †: what cancel does: the screen's own back(), or close it (back to the screen under it; closing the pause screen resumes)
- `shell.dispose()` †: take its elements away and let go of the game (game.dispose() does it)
- `shell.hide()` †: close every screen (and resume, when the menu paused the game)
- `shell.hud(st = {})` †: the HUD, from this step's state (call it every step; a piece left out is hidden, and only what changed is redrawn)
- `shell.hud({ objective })` †: { step: '01 / 04', title, text, at: { x, y, z }, from: hero } (the distance in meters, and above or below)
- `shell.hud({ status, place, tip })` †: status: 'UNSEEN' or { text, color }; place: 'The Old Harbour'; tip: 'text' or { title, text }
- `shell.hud({ bars, counts })` †: bars: [{ label, value, max, kind: 'bar' | 'pips', color }] (health, stamina, a meter); counts: [[label, value]]
- `shell.hud({ prompt })` †: { key: 'E' (or act: 'interact': its key on the player's device), label, hint, progress: 0..1 }
- `shell.hud({ keys, buttons })` †: keys: [['WASD', 'Move'], ...] (hidden on touch screens); buttons: [[label, fn or action]] (top right: pause and map where there is no Escape key)
- `shell.hud({ minimap })` †: { map, at (with facing), markers: [{ x, y, kind: 'dot' | 'diamond' | 'ring' | 'cross', color }], onClick }
- `shell.screen` †: the name of the open screen ('pause', 'settings', 'controls', ...), or null while the game plays
- `shell.settings` †: the player's settings: game.settings (the standard ones and the game's own, by key)
- `shell.show(name, spec = {})` †: open a screen: 'title' | 'pause' | 'settings' | 'help' | 'results' | 'map' or a name of your own, from spec over o.screens[name]. A spec: { kicker, title, text (strings or functions), actions: [[label, fn] or { label, fn, act, primary, disabled }], back (fn for cancel) }. From another screen it stacks (back() returns); shown again, it updates (the new spec over the old). 'settings' takes its items
- `shell.show('title')` †: { name, subtitle, meta: [...], footer }
- `shell.show('help')` †: { keys: [[key, what]], sections: [[heading, text]] }
- `shell.show('results')` †: { emblem, stats: [[value, label]], medals: [[label, earned]] }
- `shell.show('map')` †: { map, at, markers (a list or a function), labels: [[text, x, y]], onPick(x, y) }
- `shell.toast(title, text = '', seconds = 4)` †: a message that slides in at the top for a few seconds
- `shell.tutorial(title, text = '', seconds = 15)` †: a tutorial card (bottom left, dismissable) for some seconds; tutorial(null) takes it away
- `shell.root = null` †: game: the game it is over; o: its options; root: its DOM element (null in a headless game)
- `E.ui`: pixel-drawn interface pieces for r.overlay
- `E.ui.bar(g, x, y, w, h, frac, color = '#e0463c', o = {})`: a bar (a meter: health, magic, stamina, a boss's): ui.bar(g, x, y, w, h, 0..1, '#e0463c')
- `E.ui.box(g, x, y, w, h, o = {})`: window frame: ui.box(g, x, y, w, h, { bg, border, shadow, gradient }) bg: one color (drawn as a soft top-to-bottom gradient, like Final Fantasy windows) or [top, bottom] colors. gradient: false for a flat fill.
- `E.ui.counter(g, x, y, label, value, color = '#ffffff', o = {})`: label + value, e.g. ui.counter(g, 4, 4, 'RUPEES', 12)
- `E.ui.hearts(g, x, y, hp, max, o = {})`: row of hearts: hp and max in hearts (halves allowed, e.g. 2.5 of 3)

## 22. Gpu lighting (webgpu)

- `game.gpu.active(view)` †: true when it lights frames in this view (ready, enabled and a ground view)
- `game.gpu.snapshot()` †: offscreen mode only: read the last frame back as a PNG data URL
- `game.gpu.status()` †: 'loading' | 'on' | 'off' | 'unavailable'
- `game.gpu.adapterInfo` †: the GPU's description from the browser (vendor, architecture), or null
- `game.gpu.ambient` †: the unlit color, [r, g, b] 0..1
- `game.gpu.bands = 6` †: how many light bands (fewer is more retro)
- `game.gpu.enabled = true` †: false switches it off for now (the canvas lighting takes over)
- `game.gpu.failed = null` †: why it couldn't start, or null
- `game.gpu.glow = .22` †: the strength of px.glow surfaces
- `game.gpu.map = null` †: the TileMap it measures walls on
- `game.gpu.offscreen = false` †: render into a texture instead of the page (automated tests; read it with snapshot())
- `game.gpu.onStatus = null` †: called (gpu) when its status changes
- `game.gpu.ready = false` †: true once the GPU is set up
- `game.gpu.shadows = true` †: casters block light
- `game.gpu.skipped` †: never queue more than two frames: a slow GPU drops frames instead of building up lag
- `game.gpu.spill = 1.1` †: how far light spills past its radius
- `game.gpu.wrap = .45` †: how far light wraps round wall corners, 0..1

## 23. Sessions

- `E.session` †: records a play session on any device and replays it exactly (this section's header says how)
- `E.session.frame` †: the frames run since the page loaded
- `E.session.record(on)` †: turn recording on or off for the next page loads (each load is a session of its own)
- `E.session.recording` †: true while this page load is recorded
- `E.session.replaying` †: true while it is a replay
- `E.session.wanted()` †: true when recording is on for page loads (record(true))
