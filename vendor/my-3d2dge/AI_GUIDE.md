# my-3D2dge guide for AI models

This guide is for an AI (or a person) asked to build, port, remaster or remix a game with my-3D2dge. `API.md` is the compact reference; it is embedded at the top of both single files (`dist/my-3d2dge.html` and `dist/my-3d2dge-compact.html`). This guide explains the ideas, the workflow for remaking a classic, recipes for each genre, and the checks to run before handing a game back. Everything here matches `engine/my-3d2dge.js` v0.46.1.

For an AI coding agent that reads files instead of a pasted page, hand over `dist/my-3d2dge-agent.js`, the agent edition. It is the essential engine in one readable file, and its header (about 8k tokens) is a complete manual with three example games. Games written for it run unchanged on the full engine, which adds the lighting, props, backdrops, touch controls and camera tools this guide also covers.

## North star

my-3D2dge is a general-purpose retro-modern 2D engine built for AI models. It exists so that any model can:

- port, remaster, reimagine and remix games from the 8-bit to 64-bit eras;
- make spiritual successors that feel like modern remasters, with better visuals, physics and controls;
- mash up mechanics across titles and genres.

It aims for **consistent quality**: the engine carries the hard parts (feel, physics, rendering, sound, UI), so each game only has to describe its rules and content.

## The mental model

1. **The world is 3D, the camera is 2D.** Game logic works in world units: x east, y south, z up, one tile = 16 units. A `View` projects world points to screen pixels. Switch the view and the same game renders as isometric, three-quarter, top-down, brawler, side-on or any custom angle.
2. **Characters are puppets, not sprite sheets.** A `Humanoid` is a 3D skeleton posed by math every step (IK legs and arms, gait from velocity, jumps, attacks, cape cloth). A `Blob` is a squashy sphere. Both project through the current view. Small objects can be string sprites (`E.sprite`).
3. **Genre kits.** Each kit handles one hard problem and knows nothing about genres, so they combine freely:
   - `TileMap` + `Body`: ground-plane levels and physics.
   - `PlatformMap` + `Platformer`: side-scrolling levels and a platformer controller.
   - `Bullets` + `E.pattern`: projectiles.
   - `Dialog` + `Menu`: text boxes and menus.
   - scenes: title, play, game over.
   - `game.audio`: chip sound.

## Remake workflow (port, remaster, reimagine, remix)

1. **Name the core loop.** Mega Man: run, jump, shoot, reach the boss. Zelda: explore rooms, fight, find keys, open doors. 1942: dodge, shoot, survive waves, beat the boss. Write it as one sentence at the top of the game.
2. **Pick the view and the kit.** Use the genre playbook in `API.md`. A side-scroller is `PlatformMap` + `Platformer` in `'side'`; a top-down game is `TileMap` + `Body`. Pick a console resolution (`res: 'nes'` or `'snes'`) so pixels are whole and the HUD's are known, and `expand: true` so the game fills any screen: the resolution is then the least it shows, and the HUD anchors to `r.W` and `r.H`.
3. **Copy the closest starter slice.** The six slices in the single file (adventure, platformer, brawler, shooter, RPG battle, stealth) are complete games with gameplay, HUD, win and lose, and music. Start from one and change it, and ship only your game with its own title and game-over scenes. Do not start from an empty file.
4. **Rebuild the content.** Levels are ASCII rows with a legend, enemies are small factories, items are sprites. Keep the original's layout ideas but make your own maps; for a remix, change the rules on purpose.
5. **Modernize.** The engine gives you most of it for free:
   - forgiving controls: coyote time, jump buffering, variable jump height, input buffering;
   - hit feedback: hit-stop, shake, sparks, damage numbers;
   - smooth animation, lighting and glow;
   - a 2.5D view (`views: ['side', 'brawler']`);
   - pause, save data, touch controls.
6. **Tune the feel** with the feel numbers in `API.md`, then check the game with the skeleton overlay (`rig.debug(r)`) and in slow motion (`game.timeScale = .25`).
7. **Verify** with the checker and look at the screenshots (see the checklist at the end).

## Visual craft: aim for PS1 / N64 era 2D, not NES
Players judge a remake in the first screenshot. The engine's defaults reach SNES quality by themselves; games reach the PS1/N64 bar (Symphony of the Night, Metal Slug, Legend of Mana, Klonoa) when they use every layer of the look kit.

**Why games look cheap, and the fix for each:**
- *Tiny stick characters.* Use the HD Humanoid (the default) at `size: 1.2-1.4` on a 320x240 `res`, pick a `build` (`'heroic'` for tall heroes, `'bulky'` for brawlers and bosses, `'chibi'` for Mana-style RPGs), and dress every character: outfit, hair, hat, armor, sleeves, cape, and a palette of 4-6 colors per character (skin, hair, cloth, pants, boot, trim). Give enemies different silhouettes (hunch, bulky, blobs with `ears`, `horns`, `wings`, `feet`, `tail`, `mouth: 'fangs'`). Use poses (`pose: 'cheer'` on victory, `'cast'` for spells, `'guard'`, `'kneel'`, `'down'` for the defeated) instead of leaving everyone in the idle stance.
- *Empty backgrounds.* Side views get an `E.Backdrop` (a preset or custom layers of mountains, castle, forest, city, clouds, fog) with parallax. Ground views get textured floors from `E.tex.*` with floor tags (water, lava shimmer), and walls with a material: `face: 'stone' | 'rock' | 'plank' | 'timber' | 'plaster' | 'hedge'` and `roof: 'tiles' | 'slab' | 'leaves' | 'grass'`. Never leave every wall the same brick.
- *Flat colors.* Shade everything with `E.tones(hex)`: `deep` and `sh` on the shadow side, `base`, `lt` on lit edges, a `hi` sparkle. Shadows lean cool, highlights warm; never shade by only darkening.
- *Bare rooms.* Put 3-8 props on every screen with `r.prop`: candles, chandeliers and stained-glass windows in castles; crates, barrels, signs and lamps in towns; trees, bushes, flowers, rocks and grass outdoors; crystals, bones, skulls, cobwebs and vines in caves; awnings, lanterns, streetlamps, hydrants, trash cans and fire drums on streets; sandbags, cactus and palms in deserts; mushrooms in forests. Tint props with `color` so they match the palette, and set `E.style.propSize = 1.4` when heroes are size 1.2+ so a door is taller than the hero.
- *Weak hits.* Every hit gets hit-stop (`game.freeze(.04-.08)`), shake, sparks and a sound. Every death and explosion gets `particles.explosion(x, y, z, size)` and, for big ones, `game.flash`. Pickups get `particles.glints`.
- *NES typography.* Use the default 5x7 font with a drop shadow for HUD text, `E.ui.box` gradient panels and bars, and `E.font.title` with a 3-4 color gradient and extrusion for logos.
- *Faceless dialog.* Every talking character gets a portrait: `talk.say(lines, { name, portrait: rig })`, and `rig.drawPortrait(g, x, y, 40)` on HUDs and RPG party and status screens.
- *Muddy lighting.* Use lights for mood, not darkness: a few warm lights (`r.prop(..., { light: true })`) over an ambient of .4-.6; GPU lighting in top-down dungeons.

**Art recipes by classic** (combine with the genre recipes below):
- *Symphony of the Night:* `res: 'ps1'`, the `'castle-night'` backdrop, PlatformMap `stone` tiles with `moss` and `brick` walls, `'back'` tiles for the rear wall, candles and candelabras every few tiles, chandeliers, stained-glass `window` props, banners and statues. The hero is `build: 'heroic'`, `outfit: 'coat'`, `hair: 'long'`, `cape`, pale skin and silver hair, and the sword chops in the screen plane by itself in the side view; enemies are skeletons (`build: 'skeleton'`, add `outfit: 'robe'` and a staff for a lich), bats (`Blob` with `wings: true, mouth: 'fangs'`), cobwebs and vines on the walls.
- *Metal Slug:* the `'desert'` backdrop, `ground` and `metal` tiles, crates, barrels, sandbags, palms and cactus, `broken` pillars, `particles.explosion` everywhere (with `particles.ground` set so debris bounces on platforms), `bulky` soldiers with `weapon: 'gun'`, `point: true` while firing, and screen shake on every blast.
- *Legend of Mana / Secret of Mana:* the `threequarter` view, `E.tex.grass` / `dirt` / `water` floors by floor tag (a river with `block: true` and a plank bridge), houses of `timber` or `plaster` walls under `tiles` roofs, `hedge` walls with `leaves` tops and `rock` cliffs with `grass` tops, trees, bushes, flowers, fences and mushrooms as props, `chibi` characters with `face: { eyes: 'big' }` and bright palettes, rabbites (`Blob` with `ears: 'rabbit', feet: true`), and dialog boxes with portraits.
- *Klonoa and 2.5D platformers:* PlatformMap in the `brawler` view (tiles show their top faces), a bright `'day'` or `'forest'` backdrop, props in front of and behind the play plane (`y` of -12 and +12), and a soft camera `lead`.
- *Final Fight / Streets of Rage:* the `brawler` view, a long street TileMap with brick and `plaster` building walls, awnings, streetlamps, hydrants, trash cans and burning fire drums along the sidewalk, `bulky` heroes and thugs with varied palettes, and big impacts.

## Animation: fluid, varied, readable
Broken animation ruins a good-looking game faster than flat art. The Humanoid rig animates procedurally, so use its vocabulary instead of moving joints by hand:
- **Moves, not raw specs.** `new E.Attack('overhead')`, `new E.Combo(['jab', 'cross', 'hook', 'uppercut'])`. Every move in `E.MOVES` winds up, strikes with a lunge, step, lean and twist, follows through, holds, and eases back to the stance. It never sweeps backwards through its own arc.
- **A move set per character.** A knight gets `overhead`, `thrust` and `spin`; a mage `cast`; a rogue `jab`, `thrust` and `backslash`; a monk `jab`, `cross`, `roundhouse` and `flyingkick`; a brute `haymaker`, `bash` and `sweep`; a beast `claw`. Two heroes must never share one swing.
- **Stances and poses between attacks.** Brawlers walk with `stance: 'guard'`, knights with `stance: 'ready'`. Win with `pose: 'cheer'`, cast with `'cast'`, block with `'block'` (weapons) or `'guard'` (fists), duck with `'crouch'`, taunt with `'hips'` or `'wave'`, fall with `down`, die with `'die'` (stagger, knees, topple), and climb ladders with `climb: true`. Faces act too: `expr: 'smile' | 'shout' | 'angry' | 'wince'`, and a Dialog portrait's mouth moves while its line types.
- **Enemies telegraph.** Give enemy attacks a longer `wind` (.2-.35 s) than the hero's, so players can read and dodge them. Flash and knock back on hit, lie `down` on death.
- **Check the motion.** `node tools/filmstrip.mjs game.html#scene --steps "... rec:16:2 press:KeyJ" --crop x,y,w,h` records the swing frame by frame. Look for the wind-up, the strike and a clean settle. Add `--seed 1` for a repeatable strip, and `--compare before.html` (a copy of the page from before your change) to see exactly which pixels your change moved.

## Hard rules

1. **Game logic in world units, `dt` everywhere.** Never store screen pixels. Convert only when drawing (`r.w(x, y, z)`) or reading the mouse (`game.mouseGround()`). `update(dt)` runs in exact fixed steps: every 1/120 s of real time is one step of `dt = 1/120 * game.timeScale`, so the same inputs play the same at 60, 90, 120 or 144 Hz.
2. **Draw only with engine primitives** (`E.px.*`, `E.font`, `E.ui`, sprites, props, `r.*` helpers). `ctx.arc`, `ctx.stroke`, `ctx.fillText`, canvas gradients and scaled `drawImage` anti-alias and break the pixel look. Translucency goes through the engine helpers (`px.blend`, `px.polyDither`, `px.ddisc`, `r.glowDisc`, `r.shadow`): stepped alpha with blend modes by default (PS1 / N64 / SNES color math), or ordered dithering with `E.style.trans = 'dither'` for NES, Game Boy and Genesis looks.
3. **Anything that overlaps goes through the queue**: `r.actor`, `r.sprite` or `r.queue`. Only backgrounds are drawn directly (`r.sky`, `map.drawFloor`, `level.draw`, parallax shapes).
4. **Animate with continuous values** (phases, velocities, eased timers), never frame lists.
5. **Read input in `update`**: `pressed` for one-shot actions, `down` for held, `buffered` + `consume` for combat.
6. **Keep games single-file.** In the repo, edit `engine/my-3d2dge.js` and `src/*`, then run `node tools/build.mjs`. In a shared single file, replace only the code between `GAME START` and `GAME END`.
7. **Don't rebuild the standard features** (below): the pause menu, settings, key rebinding, full screen and pausing on focus loss come with every game. Adjust them with `new E.Game({ menu: {...} })`.

## Standard features (built in: adjust them, don't rebuild them)
Every `new E.Game(...)` comes with what players expect of a modern release, so your code goes to the game itself. They're tested on both editions, they work with keys, mouse, gamepad and touch, and the player's choices are saved per game.
- **Pause menu** (full engine): a pausable scene pauses on Escape, P, Start, the touch START button or the corner's menu button, and shows Resume, your items, Settings, Controls, Full screen, Help (when your `E.Shell` has one) and Quit to title (it asks first; Keep playing has the focus). Arrows, d-pad and stick move, Enter or A chooses, Escape or B goes back one screen, P or Start closes the menu. The game sees none of those presses.
- **Settings** (`game.settings`): Display (full screen; pixel scaling for a fixed `res`: Auto, Sharp, Fill), Sound (sound, volume, music, effects), Comfort (reduce motion, screen shake, screen flashes), and yours. Saved per game with a version (`E.store` key `settings:` + the page's path, or `id`); a bad saved value falls back to its default, and where storage is blocked the game plays on (`game.settings.saved` is false).
- **Controls**: every action of the current preset, rebound by pressing the new key, mouse button or gamepad button (a conflict is said and nothing changes; Escape, Enter, the F keys, Start, the arrow keys and the d-pad stay with the menus, so a player can't lock themselves out), the controller (dead zone, invert aim, button symbols: Xbox, PlayStation, Nintendo or positions, vibration) and the touch buttons (always, automatic or hidden; right or left side; size; opacity). Restore defaults resets the controls and never touches a save.
- **Full screen** (`game.fullscreen`): a phone's first tap goes full screen, the top-right button and the menu toggle it, and once the player leaves it the game never forces it back. Where a browser can't (an iPhone), the settings say to use Share, then Add to Home Screen; the page carries the home-screen app tags.
- **Pausing by itself**: a pausable scene pauses when the page is hidden, the window loses focus or the controller in use is unplugged (`game.pauseReason` says which), and only the player resumes.
- **The corner**: a menu button and a full-screen button at the top right, inside the safe area. They show on titles, game overs and pauses, for a moment when the mouse nears the top, and the menu stays on a touch screen with no touch buttons; in play they're gone. Keep a title's art clear of the top-right 110 x 60 CSS pixels, or pass `corner: false`.
- **Phones**: a viewport that reaches the safe areas (pinch zoom left alone), no page scrolling, zooming, selection or callouts on the canvas, touch buttons inside the safe areas, a touch stick with a dead zone that also presses the directions past halfway (menus, dialog choices, ladders), a bottom dialog that keeps clear of the touch buttons, menus picked by a tap or click on an entry and dialogs turned by a tap on the box (a title needs no touch buttons), and a fixed `res` filling a high-density screen (`expand: true` fills every screen).
- **Boot** (a loading screen and a crash report): heavy setup (a procedural level, a big table, baked caches, data from a promise) goes in boot steps, run one a frame behind a boot screen that shows the system's checks (engine, browser, screen, canvas, GPU, sound, storage, input), each step, a progress bar and lines of the game's own, like the Sims' "Reticulating splines"; then the game draws a warm-up frame under it, so play starts without a hitch. `game.start({ scenes, scene: 'title', boot: { title: 'VESPER', version: '1.0', steps: [['Raising the harbour', () => { map = buildHarbour(); }], ['Waking the guards', () => loadGuards()]], messages: ['Counting the bells', 'Oiling the hinges'], min: 0 } })`. A step may return a promise; headless (and with `loop: false`) the steps run at once and `await game.booted` waits for any promise. If a step throws, or anything fails before play, the screen becomes a report a player can screenshot: what failed, the error, a short code, the engine and game versions, browser, screen, canvas, GPU, sound, storage and input, with Try again, Copy report and Continue. `E.diagnose()` gives the same report any time (`.text`, `.short`); after play, errors go to the red box with its short line. `E.bootSplash(title)` is the screen's markup for the very start of `<body>`, so it shows while the page's scripts load (the starter files and the handoff template have it). Keep a boot short: no step should wait on purpose (`min` is for a splash you want seen).
- **Juice that respects the player**: `game.shake` and `game.flash` follow the comfort settings, `game.hitFx` rumbles a gamepad (the vibration setting; `rumble: false` skips it), and `game.input.rumble(strength, seconds)` does it for your own moments.

Adjust them:
```js
const game = new E.Game({ canvas: 'screen', res: 'ps1', view: 'side', input: 'PLATFORMER',
  menu: {
    items: [['Restart level', () => game.go('play', { level })]],                 // pause-menu buttons after Resume
    settings: [{ key: 'hints', label: 'Hints', value: true },                      // yours, beside the standard ones
      { key: 'difficulty', options: ['Easy', 'Normal', 'Hard'], value: 'Normal', help: 'How hard enemies hit' }],
    controls: { attack: 'Sword', skill: 'Magic', debug: false },                  // names on the Controls screen; false hides one
    quit: 'title'                                                                  // the scene Quit goes to (false: no Quit)
  } });
const hurt = { Easy: .5, Normal: 1, Hard: 1.5 }[game.settings.difficulty];       // read them anywhere, any time
r.text('PRESS ' + game.input.label('jump') + ' TO JUMP', 8, 8, '#fff');           // 'SPACE', 'A' or '✕', after the player's rebinding
```
- Leave parts out: `menu: false` (you draw your own pause: the canvas PAUSED overlay comes back), `fullscreen: 'button'` (no tap) or `false`, `corner: false`, `autoPause: false`, `id: 'mygame'` (the name the settings are saved under).
- A canvas title menu can offer OPTIONS: `game.menu('settings')` opens the settings over the title, which waits; `game.menu('controls')` the controls.
- From code: `game.settings.set('volume', .5)` (checked, saved, applied), `game.settings.reset('Sound')`, `game.fullscreen.toggle()` (browsers allow it only from a key, click or tap), `game.pause(reason)`, `game.resume()`.
- Your own `E.Shell` takes over from the engine's and keeps the standard menu (`standard: false` leaves it out).
- The agent edition has `game.settings`, `game.fullscreen`, the corner, the pausing and `input.label`, but not the menu screens: its corner's menu button pauses and resumes.

What stays your game's job, because only the game knows it:
- Every gameplay scene `pausable: true`, so the menu and the pausing reach it; titles and game overs not.
- Prompts from `game.input.label(action)` (or `ui.hud({ prompt: { act: 'interact' } })`), never hard-coded keys; touch buttons (`touch: [...]`) for every action a level needs (the stick moves).
- The assists your mechanics call for, as settings: difficulty, aim assist, auto-fire, hold or toggle for a sustained action, hints after repeated failure.
- Saves: `E.store` with a version in what you save, written at checkpoints (not on page close); ask before overwriting or deleting progress.
- Information never in color alone; flashes short (`game.flash` already follows the settings).

## Frame order

`game.start(...)` runs this every animation frame:

1. The clock adds the frame's real time (at most 50 ms) to what is left from the last frame, and runs one step for each whole 1/120 s of it: 2 steps a frame at 60 Hz, 1 at 120 Hz, 1 or 0 at 144 Hz. Each step ticks input, then (except during hit-stop and pause) runs the timers, the current scene's `update(dt)`, particles and the camera. The rest waits for the next frame: `game.alpha` (0..1) is how much of a step it holds, for interpolating drawing.
   - Slow motion (`game.timeScale = .3`) makes each step shorter (`dt = 1/120 * .3`), never fewer, so it stays smooth. Above 1 a step is split so none is longer than 1/120 s.
   - Paused, or at `timeScale` 0, the steps still run with `dt` 0, so input keeps ticking.
2. The renderer clears the buffer and positions the camera.
3. The scene's `draw(r)`. Draw backgrounds first, then register decals, queue items, actors, sprites, overlays and lights.
4. The renderer finishes the frame, in this order:
   1. particles and afterimages are queued;
   2. decals draw (ground marks, shadows, telegraphs);
   3. the queue sorts and draws by depth;
   4. lighting darkens the frame;
   5. overlays draw on top (HUD, dialog, menus, damage numbers);
   6. the frame is presented with a sub-pixel camera offset.
5. With GPU lighting active, every queue item is also drawn into a hidden info image, and WebGPU does the lighting and presentation.

An error in `update` or `draw` does not stop the loop. It is shown in a red box on screen and logged once to the console (`game.errors` keeps the list).

## Systems in more depth

### Views and resolution
- Presets: `iso` (yaw 45, pitch 30), `threequarter` (pitch 55), `topdown` (pitch 80), `brawler` (pitch 25), `side` (pitch 0).
- `overhead` (pitch 90, scale 1) makes world x/y equal screen pixels, for shooters, puzzle and arcade games. It is not in the default view cycle.
- Make your own with `new E.View(id, label, yaw, pitch, scale, zBoost)`.
- `res` fixes the internal resolution with whole-number scaling. Without it, the size adapts to the window between `minH` and `maxW` × `maxH`; `portrait: { maxH }` lets the view grow on a screen held upright (a phone), so it fills the screen.
- `res` with `expand: true` (what the starter kits use) fills any window with no bars: `res` is the least the screen shows, and `r.W` × `r.H` grows on the long side (a 16:9 monitor shows about 427×240 of `'ps1'`, an ultrawide 640×270, a phone held upright 320×690). The game's job is what fills the extra space, edge to edge, with the HUD over the world's corners (never a band of nothing). The kits show the ways. A wider screen shows more level (the adventure's neighbouring rooms, dimmed a little: they wait) or widens the play area itself (the shooter's waves spread across the whole screen). A taller one shows more world (the forest round the adventure's rooms, the RPG's sky darkening to stars), zooms a side view in (the platformer, the brawler and the RPG's battle at 1.5x, a scene's `camera.tall`, the battle's two sides closing up to fit) and lifts the level onto a band below it (the platformer's soil, the brawler's foreground wall). A painted backdrop is painted at the screen's size and zoom, its ground meeting the floor's edge. Keep prompts clear of `game.input.touchArea()` and HUDs clear of `game.cornerArea()` (the menu button stays at the top right on a phone). On a phone, make the controls smart: a button there only when it has something to do (`input.touchSet`: TALK beside someone), taps on what you see (the RPG's commands and foes), a thumb that steers from anywhere on the screen (`input.steer = 'drag'`, `input.drag()`: the shooter's ship goes 1.5x as far, so one swipe crosses it), what a phone player shouldn't have to hold done for them (the shooter fires by itself), buttons a thumb hits (44 CSS px and more: the RPG's battle pads, with AUTO), and a camera that never shows ground a fighter can't walk to (the brawler stops at a fight's lock). And keep the frame a phone's: a 120 Hz screen gives 8.3 ms, and frames that miss it (their cost, or the GPU behind them) are drawn every other refresh (`game.drawEvery`), so draw background characters at half rate (`r.actor(..., { every: 2, key })`: the adventure's townsfolk) and leave GPU lighting to a computer (its main pointer fine). Settings, Display, Show frame rate reads it on the device, and Frame rate lets the player fix it (60: every other refresh of a 120 Hz screen; Full: every refresh). `npm run test:phone` checks the kits on an emulated phone.
- `game.views` limits view cycling (`game.nextView()`) and tells the checker which views to test.

### Scenes
A scene is `{ enter(data), exit(), update(dt), draw(r), pausable, view, views, input, res, expand, touch, camera }`.
- `game.go('play', data)` switches before the next step; timers and particles are cleared and the camera snaps.
- `pausable: true` lets `pause` (Escape, P, Start, the touch START) toggle `game.paused`: the pause menu opens (the canvas PAUSED overlay with `menu: false`) and the music is ducked. It also lets the page pause the scene by itself when it is hidden or loses focus.

### Camera
- `game.follow(hero, { z, lead })` once, or `game.focus(x, y, z)` every update.
- `cam.bounds = v => map.bounds(v)` (or `level.bounds`) keeps it inside the level.
- `cam.room = [w, h]` snaps the target to the center of the current room; the camera then slides, so Zelda- and Metroid-style room transitions come for free. Freeze gameplay while `cam.moving` is true.
- The player's zoom: a scene's `camera: { zoom: [.75, 2], start: 1, tall: 1.5 }` sets how close the camera starts (`start`; `tall` on a phone held upright) and how far the player may take it (`zoom`): the mouse wheel, `-` and `=`, a two-finger pinch (both fingers moving, so a thumb on the stick isn't one) and Settings, Camera zoom. Their zoom is kept, a factor on top of the scene's, so it carries across scenes and screen shapes; each change shows `ZOOM 1.65x` at the top, the number to make `start` when tuning by feel. `zoom` may be a function of the game, a range per screen shape (the adventure's: out to .85x on a wide screen, none upright, where its forest is sized for 1x); `zoom: false` where zooming would break the game (the shooter's playfield is the screen), `wheel: false` where the wheel is the game's.
- Screen shake respects the player's reduced-motion setting.

### TileMap (ground-plane levels)
- ASCII `rows` and a `legend`: a number is a wall type, a string is a spawn tag, `{ tile, floor, spawn }` combines them.
- Wall `types[id] = { h, top, side, line, course, cut, cutH }`. `cut` lowers a wall when it stands between the camera and the floor.
- `floorTex(x, y, floorTag)` colors the floor per pixel; it is baked once per view. Ready-made: `E.tex.flagstone`, `grass`, `dirt`, `water`, `planks`, `checker`, `plain`.
- `map.set(cx, cy, 0)` opens doors or breaks walls; the floor and wall caches rebuild themselves.
- Collision is height-aware: `collide(body)` ignores walls lower than `body.z + step`, and `groundAt(x, y, r, z)` returns the surface to stand on.
- Things standing on a block sort after it, and `r.shadow(..., surfaceZ)` draws on top of blocks.
- `map.block(cx, cy, on)` and `map.set(...)` bump `map.version`; a `FlowField` rebuilds at its next `update` when it changes.
- Maps built in code: `new E.TileMap({ w, h, types })` starts as open floor; `map.fill(cx, cy, w, h, id)` puts a block of wall type `id` in (0 clears it), and `map.setFloor(cx, cy, tag, block)` tags a floor cell (`'grass'`, `'water'`) and blocks it or not.
- Facades come from wall-type options: `windows: { w, h, step, from, lit }` (or `true`), `door: { chance, color }`, `shutters: color`, `balcony: { z, color }`, `arch: { chance }`. For anything else, `types[id].decorate(face)` paints each wall face as it is baked (so it costs nothing per frame): `face.side`, `face.u0..u1` along the wall in world units (patterns line up across cells), `face.z0..z1`, `face.at(u, z)`, `face.quad(u0, z0, u1, z1, color)`, `face.line`, `face.dot`, `face.tones`, `face.view`.
- A big thing over several blocks (a canopy over a tower, a cart across two cells) sorts by its whole base: `r.queue(x, y, z, fn, { footprint: [x0, y0, x1, y1] })` lifts it over every block under it. `r.prop` and `r.sprite` take `footprint` too.

### Heights: roofs, ledges, sight and reach
One rule for collision, standing, sight, reach, navigation and drawing, so a game with roofs never writes its own:
- World units, one tile = 16, z up. A body's `z` is its feet. A cell's top is `map.height(cx, cy)`: 0 on the floor, and a wall is solid from 0 up to its `h` (one column per cell: no passages under things yet).
- A body stands on the highest top within `z + step` under its footprint (`step` 2, `Body.step`), so a kerb of 2 is walked over and a block of 14 is jumped onto.
- Eyes are at `z + E.HEIGHTS.eye` (30) and a target is seen at `z + E.HEIGHTS.chest` (22), the heights of a size-1.3 Humanoid. A body's own `eye` and `chest` override them: a crouching hero sets `hero.chest = 8`.
- "The same level" is `|dz| <= E.HEIGHTS.level` (8) unless a call says otherwise. `E.dist` is 3D; `E.overlap` and `E.inArc` are flat unless you pass `dz`.

The queries on a `TileMap` (`dir` is an angle in radians or a ground vector `[dx, dy]`; `from` is a body or any `{ x, y, z, r }`):
- `map.ray(a, b, { eye, target })` walks every cell between two points and returns `{ clear, t, x, y, z }`, where it stops. `map.sight(a, b)` is eyes to chest; `los()` only looks across the ground (a 12-unit planter blocks it, not `sight`).
- `map.standable(x, y, z, r)`: room to stand, held up, not in deep water.
- `map.ledge(from, dir, { reach: 18, min: 4, rise: 82, spread: .28 })` → `{ x, y, z, rise, facing, edge: [x, y] }`: the nearest top to pull up onto, and where the hands grip.
- `map.landing(from, dir, { min: 35, max: 83, rise: 11, drop: 18, apex: 20 })` → `{ x, y, z, d }`: a spot across a gap that a jump arc clears.
- `map.drop(from, dir)` → `{ x, y, z, fall }`: what lies past the edge ahead (hop-downs, fall warnings, guards that won't walk off roofs).
- `map.arcClear(a, b, apex, r)`: a parabola from feet to feet, peaking `apex` above the higher end, clears every top (jumps, throws, aerial takedowns).

Reach and perception:
- `E.targets(from, list, { range, arc, facing, dz, sight: map, filter })` → `[{ target, d, dz, angle }]`, nearest first. `dz` defaults to the same level; `arc` is a half angle around `facing`. Melee auto-aim, lock-on, takedowns and interaction prompts use it.
- `E.inArc(a, facing, b, range, halfAngle, dz)` and `E.sameLevel(a, b, tol)`.

Navigation: `new E.FlowField(map, { step: 2, climb: 0, drop: 0, jump: 0 })` walks the tops a body can stand on. Next-door cells connect when their tops differ by at most `step`, or by up to `climb` going up and `drop` going down. A guard on a roof gets a field across the roofs; with `climb` and `drop` set, it chases between levels. With `jump` (the widest gap, world units) it also links roofs across a gap a jump clears, and a climb costs more than a leap, so a chase leaps rather than drop to the street and climb back. `flow.next(x, y)` → `{ x, y, z, kind: 'walk' | 'climb' | 'drop' | 'jump', edge }` says where to head: an AI on the ground presses jump for a `climb` or a `jump` once `edge` (the distance to the side of its cell it leaves by) is under its radius plus a little, and `E.Mover` does the climb or the leap.

```js
const seen = map.sight(guard, hero) && E.inArc(guard, guard.facing, hero, 120, .7);   // eyes over planters, not through roofs
if (input.pressed('jump')) {
  const up = map.ledge(hero, hero.facing);   // a wall to climb in front?
  const across = !up && map.landing(hero, hero.facing);   // or a gap to clear?
  if (up) climbTo(up); else if (across) leapTo(across); else hero.jump(210);
}
const prey = E.targets(hero, guards, { range: 22, arc: 1.2, facing: hero.facing, sight: map })[0];   // the same level by default
if (prey && input.pressed('attack')) takedown(prey.target);
```

### PlatformMap (side-scrolling levels)
- Tiles live on the x/z plane; the ASCII top row is the highest.
- Kinds:
  - `solid`;
  - `slope`: `dir: 1` rises to the right, `-1` to the left, `from` / `to` (0..1) for gentle slopes; bodies walk up and down them and step up onto low ledges;
  - `oneway`: you stand on it and jump up through it, and down + jump drops through;
  - `ladder`: climbable, and you can stand on its top;
  - `hazard`: not solid; test it with `touching(body, 'hazard')`;
  - `deco`: drawn in the play plane;
  - `back`: a darker background wall.
- Styles give each tile its look: `ground` (grass top when open to the sky), `brick`, `block` (bevelled), `bonus` (`?` block, `glyph` option), `pipe`, `plank`, `spikes`, `ladder`, `liquid`, `plain`.
- In `side` the level is flat like an NES or SNES game. In a tilted view with yaw 0 (`brawler` or custom), tiles show top faces and the level becomes a 2.5D diorama.
- `move(body, dt, solids)` moves any box `{ x, z, vx, vz, w, h }` with sub-steps. It reports:
  - `onGround` and `onOneWay`;
  - `hitWall`: -1 left, 1 right, 0 none;
  - `hitCeiling`;
  - `bumped`: the tile hit from below;
  - `ground`: the moving solid it stands on.
- `solids` are extra boxes (moving platforms, elevators, crates); a body standing on one is carried by its `vx` / `vz`.

### Platformer (side-scroller controller)
- Defaults feel like a modern NES remaster: run 95, jump 285 (about 3 tiles), gravity 800 rising and 1150 falling, fall cap 330.
- Forgiving controls: coyote time 0.09 s, jump buffer 0.13 s, jump cut 0.45 when jump is released early.
- Optional moves: `airJumps` (double jump), `wallJump` (with wall slide), `dash`, `climb` speed.
- `update(dt, level, input | intent, solids)`. The same controller runs enemies: pass `{ x, jump, jumpPressed }` from your AI.
- `rigState(extra)` returns the object `Humanoid.update` wants, including the airborne pose.

### Body (ground-plane physics)
- Velocity with optional `friction` (per second) and `bounce` (off walls and the floor).
- `push(ix, iy, iz)` adds knockback; `jump(v)` jumps with `gravity`.
- It lands on the highest walkable surface: the floor, or the top of a block low enough to step onto.
- Use it for heroes, enemies, bombs, crates, pickups and balls.

### Mover and actions (third-person ground controller)
`E.Mover` is the ground views' answer to `Platformer`: a `Body` with a third-person game's movement.
- `new E.Mover({ x, y, z })`; each step `hero.update(dt, map, game.input)` with `input: 'THIRDPERSON'` (move, Shift sprint, Space jump and parkour, C crouch, J attack, K block, L dodge; touch buttons), or an AI's intent `{ move: [dx, dy], sprint, crouch, jumpPressed }`. Screen directions turn into ground ones through the view.
- Walk 50, run 85, sprint 125 and sneak 32 with acceleration; a jump with coyote time and a buffer, once a press.
- A jump press is parkour first: a ledge up to `climbMax` (82) is climbed (`climbUp`; crouch while hanging lets go), a wall up to `vault` (14) is vaulted at a run, a gap ahead is leapt (it aims for the far side's landing), a drop up to `hopMax` (48) is hopped down; otherwise it jumps.
- Falls: past `rollAt` (26) at speed it rolls, past `hurtAt` (72) it sets `hurt`. `lastSafe` and `respawn()` bring it back from water and pits (`inHazard`).
- `hero.rigState(extra)` feeds `rig.update`: its crouch (a sneaking gait), sprint lean, air, landing, or the playing action's pose.
- Actions (`E.ACTIONS`): `climbUp` (played backwards to climb down), `vault`, `hopDown`, `roll` (invulnerable in its middle), `getUp`, and `takedown`, a paired action that moves two bodies: `hero.play('takedown', { other: guard, aerial, map })`. While `hero.action` plays it moves the body instead of physics; `act.beat`, `act.u`, `act.canCancel`, `act.invulnerable`, `act.otherState()` for the victim's rig. Your own: `E.ACTIONS.slide = { beats: [['go', .4]], setup(A) {}, at(A, beat, u) { return { x, y, z, state } } }`.

### Perception (sight, hearing, suspicion)
- `E.sees(guard, hero, { map, range: 120, fov: 1.6, eye })` → `{ seen, d, angle, exposure }`: inside the cone, and three points on the hero (feet, chest, head) checked against every top with `map.ray`. Crouching shows less and lower; `hero.exposure` (0..1) is cover you set: tall grass, shadow.
- `E.hears(guard, { x, y, z, loud: 80 }, map)`: 1 at the noise, 0 at its radius, halved through a wall.
- `const mind = new E.Suspicion({ rise, decay, notice, search, alert, forget })`; each step `mind.update(dt, E.sees(...), hero)` → `'calm' | 'notice' | 'search' | 'alert'` (it rises faster the nearer and more exposed the hero is), `mind.last` (where it last saw or heard), `mind.changed`. An alert guard that loses the hero searches for `forget` seconds; `mind.hear(strength, at)` notices a noise.
- Drawing: `r.sightCone(guard, { map, range, fov, color, alpha })` (cut short by walls) and `r.marker(x, y, z, { label, color })`, an objective marker that becomes an arrow at the screen's edge.

### Attack (melee timing)
- `new E.Attack(spec)` owns the wind-up, active and recover timers of one move; the spec is also the Humanoid attack spec.
- `start()` begins a swing (pass `true` to chain from recover into a combo); `update(dt)` returns the phase that just began, which is where swing sounds go.
- `hits(targets, test, fn)` calls `fn` once per target per swing while active. `state` feeds `rig.update({ attack })`.
- `E.Combo([spec1, spec2, spec3], { window })` chains attacks: `press()` flows into the next hit during recover (or shortly after), otherwise restarts. `E.knockback(from, target, speed, up)` pushes the target away.

### Bullets and patterns
- A pool on the `'ground'` plane (top-down) or the `'side'` plane.
- Bullets die on walls with a small spark; `hit(targets, fn, team)` tests circles (side targets use their box center).
- `burst(base, E.pattern.spread(...))` fires a pattern: `dir`, `aim`, `aimSide`, `spread`, `ring`.
- Bullets glow under GPU lighting. Set `sprite` for custom art and `pierce` to pass through targets.

### Humanoid
- Proportions: `legUpper legLower hipZ torso shoulderHalf headR armUpper armLower limbW torsoW`.
- Style: `lean hunch stride swing speedRef`.
- Gear: `weapon` (`'sword'`, `'gun'`, `'staff'`), `hat` (`'cap'`, `'pointed'`, `'helmet'`, `'band'`, `'crown'`), `hood`, `cape`, `eyeGlow`, `colors`.
- `update(dt, { x, y, z, vx, vy, facing, dash, hurt, air, point, attack })`.
- Attacks:
  - You own the timing: move `phase` from `'wind'` to `'active'` to `'recover'` with your own timers, and pass `u` (0 to 1) within the phase.
  - `spec.a0` / `a1` are hand angles relative to facing; `z0` / `z1` are heights.
  - `spin: true` swings a full circle, `kick: true` swings the right foot, `blade: 0` hides the smear.
- `hand()` and `tip()` give world points for spawning bullets or sparks; `worldOffset(p)` gives where any point in the rig's own frame (a joint in `J`) sits from its feet. `debug(r)` draws the skeleton.

### Audio
- Browsers start sound only after the first key press or click; the engine waits for it.
- `sfx(name)` ignores the same sound fired twice in 35 ms, and varies the pitch slightly so repeats don't sound robotic.
- `music(song)` loops tracks of its own step notation. Every track loops on its own length, so short drum or bass loops can run under long melodies.
- Built-in songs: `title`, `adventure`, `dungeon`, `boss`, `victory` (plays once).

### Text and UI
- `E.font` is a 5x7 proportional pixel font with lower case (the old 3x5 font is `font: 'tiny'`), with `scale`, `align`, `wrap`, outline, drop `shadow` and `gradient`; `E.font.title` draws extruded gradient logos.
- `E.ui.box/bar/hearts` draw classic windows and meters inside `r.overlay`.
- `Dialog` does typewriter text with blips, pages, speaker names and choices; `update` returns true while it is open, so the world waits.
- `Menu` handles up and down with key repeat, confirm, cancel and disabled items.

### Shell (an HTML interface: screens and HUD)
A modern adaptation (Assassin's Creed, Breath of the Wild) wants readable HTML screens over the pixel world, not pixel windows. `E.Shell` builds them from data, so you write none of the HTML, CSS or focus handling. It shows the game's state and holds none of it: you pass values in each step and callbacks for the buttons.
- `const ui = new E.Shell(game, { theme: { ink, paper, accent, muted, danger, line, font, titleFont }, settings: { items: [{ key: 'cones', label: 'Sight cones', value: true }], onChange(s, key) {} }, screens: { pause: {...}, help: {...} } })`. It takes over from the engine's own and keeps the standard menu (see Standard features). Your items join `game.settings` (`ui.settings` is the same object), saved and checked with the rest; `onChange` hears every change.
- Screens: `ui.show(name, spec)`, `ui.back()`, `ui.hide()`, `ui.screen` (the open one's name, or null). Every spec takes `kicker`, `title`, `text` (strings or functions), `actions: [[label, fn], { label, act, primary, disabled }]` (falsy entries are skipped, so `cond && [...]` works; `act` taps an input action) and `back`. Then: `'title'` (`name`, `subtitle`, `meta`, `footer`), `'pause'` (Resume first, then your actions, then Settings, Controls, Full screen, Help and Quit to title; it opens while `game.paused` and Resume unpauses; `screens: { pause: false }` leaves it out), `'settings'`, `'controls'`, `'help'` (`keys: [[key, what]]`, `sections: [[heading, text]]`), `'results'` (`emblem`, `stats: [[value, label]]`, `medals: [[label, earned]]`) and `'map'` (`map`, `at`, `markers`, `labels`, `onPick(x, y)` for a waypoint). A screen opened from another stacks; cancel goes back.
- The HUD, each step: `ui.hud({ objective: { step, title, text, at, from }, status, bars: [{ label, value, max, kind: 'pips' | 'bar', color }], counts: [[label, value]], prompt: { key, label, hint, progress }, tip, place, keys, buttons: [[label, fn]], minimap: { map, at, markers, onClick } })`. A piece left out is hidden, only what changed is redrawn, and the HUD hides while a screen is open. `objective` shows the distance in meters (`meters: .125` a world unit) and whether the target is above or below. `ui.toast(title, text, seconds)` and `ui.tutorial(title, text, seconds)` come and go on their own.
- Input: the game's own input moves the focus (keys, d-pad, stick: up / down / left / right, a slider or a choice turns left and right), confirm presses, cancel goes back, pause closes the menu; touch taps. While a screen is open the game's actions are held back, so a menu press doesn't also attack. Touch players reach the menu with the touch START or the corner's button; `buttons: [['Map', openMap]]` adds your own.
- It honors reduced motion and the safe-area insets, is headless-safe (it keeps its screens' names and draws nothing), and `game.dispose()` takes it away. The Labs page's "Vesper's interface on E.Shell" rebuilds a model's hand-written 15.2k-token interface in 2.1k tokens (`src/vesper-ui.ui.js`).

### Lighting
- Canvas lighting: set `lights.enabled` and `ambient`, then call `lights.add(x, y, z, radius, intensity)` every frame. Light is measured on the ground in ground views, and on screen in side views and for PlatformMaps.
- GPU lighting (`game.enableGPU({ map })`) needs WebGPU and a TileMap. It adds:
  - colored lights, and soft shadows cast by walls and `lights.caster(...)`;
  - light that wraps around characters;
  - glow from `px.glow`, emissive decals and actors, and `[r, g, b, glow]` floor texels;
  - bloom and heat shimmer (`lights.heat`).
- GPU lighting falls back to Canvas lighting by itself. Tune the settings, not the shaders.

### Errors and warnings
- Runtime errors appear in a red box (click to hide) and in the console, labeled with `update` or `draw` and the scene.
- Setup errors (before `game.start`) are shown too.
- One-time `my-3D2dge:` warnings flag:
  - unknown views, actions, sounds, songs, resolutions and input presets;
  - legend characters, wall or tile types missing from `types`;
  - uneven level rows and non-hex colors;
  - lights with bad numbers, and PlatformMaps drawn in the wrong view.
- The checker prints them all.

### Testing without a browser
A game runs in Node with no screen, so its rules can be tested in a second, exactly:
- `new E.Game()` is headless where there is no DOM (or with `{ headless: true }`): no screen, renderer, sound or DOM input; scenes update and `draw` is skipped. Sprites made while the game loads get a stand-in canvas.
- `game.advance(seconds)` runs exact fixed steps at once: `advance(1)` is 120 updates. In a page, `new E.Game({ loop: false })` waits for `advance` too, and `advance(s, { draw: true })` draws a frame after.
- Input: `game.input.tap('jump')` presses an action for one step (`pressed` and `down` in the next step, `released` in the one after); `hold('right')` holds it until `hold('right', false)`; `press(code)` and `release(code)` press keys.
- `game.debug = { snapshot() { return { scene, hero, score } }, teleport(x, y, z) {...} }`: your game's handle. Tests read it; `tools/check.mjs` prints it after play; `tools/replay.mjs` logs it at the end of a replay.
- `game.stop()` stops the loop, `game.start()` resumes it, `game.dispose()` ends the game and removes every listener the engine added to the page.

```js
// game/test.mjs in the handoff package: load the engine and the game into one context, then drive it
const ctx = { console }; vm.createContext(ctx);
for (const f of ['../my-3d2dge.js', './game.js']) vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const game = ctx.My3D2dge.current;
game.input.tap('start'); game.advance(.5);
game.debug.teleport(100, 88, 0, 0); game.input.tap('jump'); game.advance(1.1);
if (game.debug.snapshot().hero[2] !== 32) throw new Error('the hero should have climbed onto the roof');
```

### The handoff package
`dist/handoff/` (on the site: `/handoff/`; `node tools/handoff.mjs --zip <file>` zips it for a chat) holds what a coding agent needs to build on the full engine without the repository: both editions, `API.md`, `API-INDEX.md`, this guide, `tools/check.mjs`, `filmstrip.mjs` and `replay.mjs`, a `package.json` pinning Playwright, and `game/`, a template game with a headless test. `tools/build.mjs` writes it; its sources are `src/handoff/`.

### Recorded sessions (a bug from a phone, replayed exactly)
- `E.session.record(true)` turns recording on for every later page load (`?record=1` does it for one load). It starts before the game's code and keeps everything a game's next frame depends on:
  - a seed for `Math.random`;
  - each display frame's time (`performance.now` and `Date.now` read it during that frame);
  - every input and the frame it arrived before: keys, pointer and touch, wheel, clicks and form edits, focus, visibility, resize, full screen;
  - gamepad readings, the media queries the game asked, the safe-area insets, the screen, and the save (`localStorage`) at the start;
  - a checksum every 60 frames.
- `E.session.share()` saves the session: the share sheet on a phone, a download elsewhere. In Emberdeep it is Settings → Tools → Record a session; on any recorded page the standard pause menu has Save session (a phone has no console). `node tools/replay.mjs <file> --pacing` reads the device's refreshes from it without replaying: the refresh, the ones missed second by second, how unevenly (a report of choppy play).
- `node tools/replay.mjs session.json` replays it in headless Chromium at the recorded screen size, frame by frame, and reports the first checksum that differs. Useful options:
  - `--to 1800` stops at a frame; `--shots 600,1200` saves screenshots;
  - `--log "__ed.ED.hero"` prints any state at the end;
  - `--page` replays on another page. Fix the bug, rebuild, and replay the same session to see it gone.
- `game.stateHash = () => [hero.x, hero.y, hero.hp, foes.length]` adds a game's own state to the checksum, so a replay stops at the first frame where that state differs.
- Why it works: the clock turns the same frame times into the same fixed steps, so the same frame times, inputs and seed give the same game.
- Any browser: while recording and replaying, `Math.sin`, `cos`, `tan`, `atan`, `atan2`, `asin`, `acos`, `exp`, `log`, `log2`, `log10`, `pow`, `hypot` and `cbrt` are the engine's portable versions (`E.session.math`).
  - Browsers may round these differently in the last bit: an iPhone's Safari and Chromium use different libraries.
  - The portable versions are built only from `+ - * /` and `sqrt`, which are exact everywhere.
  - So a session recorded in one browser replays in another bit for bit.
  - `sin`, `cos`, `atan`, `atan2`, `exp` and `log` are fdlibm's algorithms, the same bits as Chromium's own.
  - The others are within a few units in the last place.
  - `node tools/cross-engine-math.cjs` checks this in Safari's own engine. It runs the same code in V8 and in JavaScriptCore, through Bun (`BUN=/path/to/bun`).
  - Native math gives different bits in the two engines, and so does a Humanoid animated with it.
  - The portable math, and the same Humanoid with it, give the same bits in both.
- Limits:
  - the GPU lighting is off while recording, because it starts up on real time;
  - a session is one page load;
  - replay on the build it was recorded on: its version and build are in the file.

## Genre recipes

**Side-scroller (Mario, Mega Man, Castlevania).**
```js
const level = new E.PlatformMap({ rows: LEVEL, legend: { '#': 1, '=': 2, '?': 3, '@': 'hero', 'g': 'walker' },
  types: { 1: { style: 'ground', side: '#8a5a32' }, 2: { kind: 'oneway' }, 3: { style: 'bonus', side: '#e8a830' } } });
const s = level.find('hero'), hero = new E.Platformer({ x: s.x, z: s.z }), rig = new E.Humanoid({ weapon: 'gun', hat: 'cap' });
// scene: { view: 'side', views: ['side', 'brawler'], input: 'PLATFORMER', res: 'snes', pausable: true, ... }
// update: hero.update(dt, level, game.input, lifts); if (hero.jumped) game.audio.sfx('jump');
//         if (hero.bumped) { ...change level.set(cx, cz, id)... }
//         rig.update(dt, hero.rigState({ point: game.input.down('attack') })); game.focus(hero.x, 0, hero.z + 24);
// draw:   r.sky([...]); level.draw(r); r.actor(hero.x, 0, hero.z, (g, ox, oy) => rig.draw(g, ox, oy, r.view));
```
- Enemies are boxes moved by `level.move(e, dt)` with your own gravity: turn at `hitWall`, and at ledges using `groundBelow`.
- Stomp when `hero.vz < 0` and the hero's feet are above the enemy's middle.
- Pits: `hero.z < -40`. Spikes: `level.touching(hero, 'hazard')`.

**Zelda-like adventure.**
- Build rooms with `TileMap` rows and set `game.cam.room = [roomW, roomH]`.
- The hero is a `Body` moved by `screenDirToGround(input.move())`. A sword swing is an `E.Attack` with `hits(foes, f => E.inArc(...), ...)`.
- Talk with `Dialog`, and open a locked door with `map.set(cx, cy, 0)` after checking a key count. Only run enemies in the hero's room, and freeze everything while `cam.moving`.

**Beat-'em-up (Final Fight, Streets of Rage).** Start from the BRAWLER slice.
- Use the `brawler` view with a long `TileMap` floor strip (walls along the top edge only) and `cam.bounds` that scroll right.
- Heroes and thugs are `Body` + `Humanoid` with `weapon: null`. Punches are attack specs with `blade: 0`; kicks use `kick: true, z0: 6, z1: 9`.
- Hits need `E.inArc` plus a small y difference (same lane). Knock down with `body.push(dx, dy, 120)` and let gravity drop them.

**Fighting game (Street Fighter II).**
- Use the `side` view with a one-screen `PlatformMap` floor. Two `Platformer`s; the CPU fighter passes an intent object.
- Hurtboxes and hitboxes are `overlapBox` boxes placed from `rig.hand()` during `'active'`. Add health bars (`E.ui.bar`), a round timer (`game.every(1, ...)`) and `game.freeze` on hits.

**Shoot-'em-up (1942, Gradius).**
- Use `view: 'overhead'` and `res: [224, 256]`, so world x/y equal screen pixels.
- Ships are sprites, and the backdrop is `r.starfield({ dir: 'down' })` (or `'left'` for horizontal shooters).
- A timeline array spawns waves; enemies move on formulas (sine lines, dives aimed with `E.pattern.aim`).
- Bosses fire `E.pattern.ring` and `spread`. A bomb clears `shots.clear('foe')`.

**JRPG (Dragon Quest, Final Fantasy).**
- Towns and dungeons are `TileMap` rooms with `Dialog` NPCs; shops use `say(text, { choices })`.
- Battles are a scene in the `brawler` view with rigs lined up, a `Menu` of commands and a queue of actions. Each action steps forward, swings, applies damage and steps back.
- Keep party data in one object and save it with `E.store.set('save', party)`.

**Puzzle (Tetris, Dr. Mario).**
- Use `view: 'overhead'`, `res: 'nes'`, and a 2D array grid drawn with `px.rect`.
- `input.repeat('left', .17, .05)` gives the classic delayed auto-shift; `game.every(speed, fall)` drives gravity.
- Clear lines with particles and `sfx('coin')`.

**3D-era remake (Mario 64, Ocarina, Crash).**
- Use the `iso` or `threequarter` view with a `TileMap` whose wall heights are platforms (h 8, 16, 24...). The hero is a `Body` with `jump(260)`; walls lower than the hero's feet are walkable, so the level becomes a height map you platform across.
- Add GPU lighting for mood and `cam.bounds` for framing.

**Third-person stealth and parkour (Assassin's Creed, Metal Gear, Tenchu).** Start from the STEALTH slice.
```js
const map = new E.TileMap({ rows: CITY, legend: { '#': 1, A: 2, ',': { floor: 'grass' }, '@': 'hero' },
  types: { 1: { h: 64, cut: true }, 2: { h: 40, face: 'plaster', roof: 'tiles', windows: true, door: { chance: .5 } } } });
const hero = new E.Mover({ x, y }), guard = new E.Mover({ x: gx, y: gy, walk: 30, run: 70 });
guard.mind = new E.Suspicion(); guard.flow = new E.FlowField(map, { climb: 56, drop: 56, jump: 60 });
// scene: { view: 'iso', views: ['iso', 'threequarter'], input: 'THIRDPERSON', touch: ['jump', 'attack', 'block', 'crouch'], ... }
// update: hero.exposure = hero.crouch && map.floorAt(hero.x, hero.y) === 'grass' ? 0 : 1; hero.update(dt, map, game.input);
//         const st = guard.mind.update(dt, E.sees(guard, hero, { map, range: 110 }), hero);
//         goal: 'alert' the hero, 'search' guard.mind.last, else the next patrol point; guard.flow.update(goal.x, goal.y);
//         const nx = guard.flow.next(guard.x, guard.y);   // walk toward nx; jump for a 'climb' or 'jump' once nx.edge < guard.r + 4
//         guard.update(dt, map, { move, jumpPressed });   rig.update(dt, hero.rigState({ attack: slash.state }));
// draw:   map.drawFloor(r); map.queueWalls(r); r.sightCone(guard, { map, range: 110 }); actors; r.marker(goal.x, goal.y, goal.z, { label: 'LEDGER' });
```
- Roofs a jump apart (three or four cells, heights within 11 up and 18 down of each other), several heights, and `cut: true` on the walls nearest the camera so the street stays visible.
- Takedowns: from behind (same level, close, outside the guard's view, not alert) or from a roof above (`aerial: true`); mark the guard down, and feed its rig `act.otherState()` while the action plays.
- Telegraph guards' swings (`new E.Attack('overhead', { wind: .38 })`) and let a block in the wind-up's last moments parry and stun them.
- A checkpoint where the objective is taken: respawn there, and reset the guards.

**Mash-ups.** The kits don't depend on each other. Some examples:
- a platformer with Zelda rooms: `cam.room` in the side view;
- a shooter with RPG shops: scenes plus `Menu`;
- a brawler with bullet-hell bosses: `Bullets` with the `'ground'` plane;
- a puzzle game with dialog cutscenes: `Dialog`.

## Building a big game: lessons from Emberdeep
`examples/emberdeep.html` is the engine's signature game: an endless Diablo-style hack-and-slash of about 1.8 MB of code, built from 30+ source files. Its structure (`src/emberdeep/DESIGN.md`) scales to any large game.

- **A spine, then content.** A small core defines:
  - the shared state;
  - one damage pipeline for every unit;
  - a handful of effect verbs (projectile, nova, ground area, telegraph, strike, meteor, chain, beam, wave, pull);
  - the hero's action model;
  - the monster runtime;
  - the level builder;
  - the UI kit.
  Content never edits the core.
- **Registries make a language.** Every part is registered: `def('skills' | 'archetypes' | 'affixes' | 'bosses' | 'patterns' | 'itemBases' | 'powers' | 'mechanics' | 'themes' | 'layouts' | 'npcs', id, spec)`. Parts refer to each other by id and combine freely. A monster is an archetype × an element × affixes × depth scaling × a palette. A level is a layout × a theme × mechanics × a monster pool. A boss is a body × an element × patterns.
- **An event bus instead of hooks everywhere.** Legendary powers, passive keystones, mechanics and tips listen to `hit`, `kill`, `skill`, `dodge`, `step` and `draw` events and check whether they apply. Adding a power never touches the combat code.
- **Procedural forever.** A recipe per depth draws from the registries. Past the hand-planned depths it composes new combinations in a fixed order (every pair of mechanics, then every triple), recolors themes by depth, varies packs (elements, shared affixes, giants, swarms) and assembles bosses from a pattern library. Both sides of the power curve grow exponentially, the monsters' a little faster.
- **New animation on the rigs.** Post-process the Humanoid's joints after `rig.update`:
  - a dodge roll turns every joint around the hips;
  - drinking re-solves one arm with `E.ik3`;
  - held tools are drawn from the hand and elbow joints.
  New creature rigs (IK-legged spiders, a path-following serpent) are posed in 3D and projected with `view.p`.
- **Test like a player.**
  - An autopilot drives the hero through a virtual input for balance runs and an attract-mode demo.
  - Scripted headless playtests (`tools/ed-play.mjs`) and a smoke test over every scene and depth (`tools/ed-smoke.mjs`) keep a big game honest.
  - A Gallery scene plays every skill and monster for visual review.

## Where to find more: animation and examples
The engine files carry the engine; the repo (github.com/michaelcrosato/my-3d2dge) also holds a store of motion and a whole game of worked examples. Take from it rather than inventing a walk cycle or a spider from nothing, but take only what a game needs: the store's files are large (a clip set is 75-820 KB, each motion-capture subject about 2.5 MB), so search them and never read one whole. All of it runs at https://my-3d2dge.vercel.app/labs.

**Motion clips** (`docs/MOCAP.md`): 325 curated clips and all 2,548 takes of the CMU motion capture database, in a readable text format of key poses (whole numbers, a legend in every file's header) that plays on any Humanoid at its own build, on either engine (the full engine also turns the face and hair with the body, for rolls and cartwheels). Every clip is free to use: Quaternius and Mesh2Motion are CC0, CMU is free for all uses.
- **Find** a clip by what it does. The curated sets have catalogs, each clip's name with its tags and a description: `src/mocap/catalogs/quaternius.json` (88 clips: idles, walks, runs, jumps, sword, gun, shield, magic and fist attacks, dodges, hits, deaths, sitting, talking, work), `mesh2motion.json` (177: idles, attacks, emotes and gestures, dodges, climbing, sneaking, zombies, chores) and `cmu.json` (60 moments cut from motion capture: gaits, fights and kicks, dodges, falls and get-ups, chores, monsters and zombies acted by people). The motion-capture takes are in a ledger, one a line with its category, length and description: `node tools/cmu.mjs ledger kick` searches it, or grep `src/mocap/catalogs/cmu-takes.tsv`.
- **Take** the clips you want into a small set of your own: `node tools/anim-set.mjs src/mocap/sets/quaternius.js examples/cmu-lib/CMU_10.js --clips Idle_Loop,10_01 --name MINE --out mine.js` (the curated sets are `src/mocap/sets/<set>.js`; take `NN_xx` is in `examples/cmu-lib/CMU_NN.js`). A clip copied by hand also needs its set's preamble (its `sources`, the bodies it was measured on), so use the tool when you can run commands.
- **Play** it: load `src/mocap/readable.js`, `src/mocap/mocap.js` and the set after the engine, then `const lib = Mocap.load(MOCAP.MINE); Mocap.drive(rig, lib);` once, and each step `rig.mocap = lib.sample(lib.clip('Idle_Loop'), t)` before `rig.update`. `rig.mocapW` (0 to 1) fades a clip in and out over the rig's own animation, `rig.mocapMask = 'upper'` plays only the chest, head and arms over the rig's own walk, and `lib.moveAt(clip, t)` says how far a travelling clip has carried the body.
- **Edit** it: a clip is text. Change a key pose's numbers to fix or vary it (the Mocap Lab's AI panel shows a clip as text and plays an edit).

**Objects and materials** (`docs/ASSETS.md`, full engine): still objects written as a few lines of named parts (a barrel is a turned profile of oak and two iron hoops), drawn from any view and facing with `r.shape('barrel', x, y, 0, { facing })` and made solid with `map.solid(...)`; materials (`E.MATERIALS`) dress floors, walls and platform tiles. The card has the format, the core library and the recipe: copy the nearest entry, change it, look at it with `node tools/asset-sheet.mjs mine.js#stool`, use it.

**Worked examples** (`src/emberdeep/`, `src/emberdeep/DESIGN.md`): Emberdeep registers every part on one line, so one search lists them all: `grep -nE "def\(['\"](archetypes|characters|skills)" src/emberdeep/*.js` gives the 28 monster, boss and dummy bodies (with tags: beast, spider, flying, ranged...), the 3 heroes and the skills (Codex's six come from one helper in `29-codex-skills.js`). Bodies that are not people are classes: `grep -n "^class " src/emberdeep/*.js` (an eight-legged crawler with IK legs, a burrowing serpent, a floating eye with a beam, Codex the living book, Dan the scythed beast on reverse-kneed legs). Perception and paired actions in play: `32-wardens.js` (a sentry's mind from `E.Suspicion` and `E.sees`, its cone from `r.sightCone`, an alarm heard through `E.hears`) and `23-executions.js` (`E.ACTIONS.takedown` on the hero and a monster at once, the target from `E.targets`). They lean on the game's helpers and shared state, so adapt them rather than paste them; `docs/CHARACTERS.md` is the recipe for a new body and what makes one read at game scale.

**Starters**: `dist/kits/my-3d2dge-<adventure|platformer|brawler|shooter|rpg|stealth|animlab>.html`, one vertical slice per genre, each a complete game to copy from.

**Real 3D**: `dist/my-3d2dge-3d.js` puts a three.js and Rapier world under a game (make the game with `bg: null`); its header is its manual, with a complete game. Its kits, `dist/kits/my-3d2dge-3d-<action|platformer>.html`, are served, not opened from a disk (they load `vendor/`). `docs/ENGINE-3D.md` says how it fits the engine.

## Performance
- **Rigs:** projection costs microseconds. The outline composite is the expensive part, so crowds should use `outline: false`.
- **Walls, floors and PlatformMap chunks** are baked once per view.
- **Canvas lighting** scans pixels inside each light, so keep radii sensible or use GPU lighting.
- **Particles** are capped at 900 (`game.particles.max`) and bullets at 800 per pool.
- **Crowd separation:** use `E.SpatialHash`, not all-pairs checks.
- `examples/stress-test.html` benchmarks a device and prints a copyable report.

## Checklist before handing a game back
- One IIFE between `GAME START` and `GAME END`, starting with `const E = My3D2dge`, holding only your game (no leftover starter menu or slices). No other files, libraries or network requests.
- A title scene, a gameplay scene with `pausable: true`, and a game-over or win path back to the title.
- No pause menu, settings screen, key rebinding or full-screen code of your own: they're standard. Your settings, names and menu items go in `new E.Game({ menu: {...} })`; prompts come from `game.input.label(action)`.
- The camera follows the player and the level is visible. The HUD uses screen pixels (`r.text`, `r.overlay`), anchored to `r.W` and `r.H`. With `expand: true`, look at it on a wide monitor and on a phone both ways (`tools/check.mjs` takes `--size 390x844@3`).
- Sounds for jumping, hitting, pickups and dying; music per scene.
- Positions and speeds are in world units, `dt` is used everywhere, and nothing draws with anti-aliased canvas calls.
- Every view in `views` looks right (press `V`), and the skeleton overlay and slow motion look right.
- `node tools/check.mjs game.html` passes; look at its screenshots, not only its exit code.
