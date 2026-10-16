# Standard features: what every game gets, and the quality prompt they answer

Games built on the engine used to start without the things players expect of a modern release: no full screen, no
settings, no way to rebind a key, a pause that ignored a hidden tab. The owner then had to send each builder a long
quality prompt ("Universal Game Controls, Display, Accessibility, and Quality Upgrade", v2) and pay for the output tokens
it took to write them, game by game. Since v0.23.0 the engine gives them to every game with no code (engine section 10b,
and `E.Shell`'s standard menu), and the manuals say so up front: a few hundred input tokens instead of thousands of output
tokens per game.

This file is that prompt's review: its requirement matrix (section 2 of the prompt), the action coverage of the presets,
what stays each game's job, and how it was verified. How to use and adjust the features: `AI_GUIDE.md`, "Standard
features"; the API card's section of the same name; the full engine's header, point 8a.

## What a game gets, and how it adjusts it

| Feature | With no code | Adjust | Leave out |
| --- | --- | --- | --- |
| Pause menu (full engine) | a pausable scene pauses on Escape, P, Start, the touch START or the corner's menu button: Resume, Settings, Controls, Full screen, Help, Quit to title (asks first) | `menu: { items: [['Restart', fn]], quit: 'title' }` | `menu: false` (the canvas PAUSED overlay) |
| Settings | `game.settings`: Display (full screen, camera zoom where a scene allows it, pixel scaling), Sound (sound, volume, music, effects, sound in the background), Comfort (reduce motion, shake, flashes), saved per game | `menu: { settings: [{ key, label, value, options, min, max }] }`, read `game.settings.key` | |
| Controls | every action of the preset rebound by pressing the new key or button; the controller (dead zone, invert aim, button symbols, vibration); the touch buttons (visibility, side, size, opacity); restore defaults | `menu: { controls: { attack: 'Sword', debug: false } }` | |
| Full screen | `game.fullscreen`; a phone's first tap; the corner's button; the menu; the player's choice kept | | `fullscreen: 'button'` (no tap) or `false` |
| Pausing by itself | a pausable scene pauses when the page is hidden, the window loses focus or the controller in use is unplugged; only the player resumes (`game.pauseReason`) | `game.pause(reason)`, `game.resume()` | `autoPause: false` |
| The corner | menu and full-screen buttons, top right in the safe area: on titles, pauses and game overs, when the mouse nears the top, and the menu on a touch screen without touch buttons | `game.menu('settings')` from a canvas title's OPTIONS | `corner: false` |
| Prompts | `game.input.label(action)`: the key or button on the device in use, after rebinding, in the controller's own symbols | `settings.glyphs` | |
| Boot (v0.24.0) | a page's splash from its first paint (the built pages have it); the game's heavy setup one step a frame behind a boot screen (the system's checks, a progress bar, the game's own lines), then a warm-up frame; any error before play becomes a report to screenshot | `game.start({ boot: { title, version, steps, messages, min } })`; `E.diagnose()` | `boot: false` |
| Phones | a viewport reaching the safe areas, no page gestures on the canvas, touch buttons in the safe areas, a stick with a dead zone, a fixed resolution filling a high-density screen | `settings.scale` | |

The agent edition has `game.settings`, `game.fullscreen`, the corner, the pausing and `input.label`, not the menu screens
(its corner's menu button pauses and resumes). Emberdeep and the labs with panels of their own keep theirs (`menu: false,
corner: false, fullscreen: 'button'`); Emberdeep's full screen now goes through `game.fullscreen`.

## Requirement matrix

Status: **built in** (the engine does it for every game), **already met** (it did before v0.23.0), **the game's job** (only
the game knows it; the manuals say so), **deferred** (production hardening, principle 10: done when a game heads to
production, which pays for it), **not applicable** (with the reason).

| Prompt section | Requirement | Before (v0.22.4) | Now (v0.23.0) | Status | Verified by |
| --- | --- | --- | --- | --- | --- |
| 3 Display | Separate CSS size from the render buffer; a pixel-ratio limit; sharp UI text | low-res buffer, whole-number upscale, ratio capped at 3; HTML text | same | already met | existing suites |
| 3 Display | Use the whole area without stretching | a fixed `res` letterboxed at a whole-number scale: up to a fifth of a phone's screen black | `scale`: Auto (fill on screens of 2x density and up), Sharp, Fill; since v0.26.0 `expand: true` makes `res` the least the screen shows and fills every shape with no bars (the starter kits use it) | built in | `standard-test` (fill at 3x, whole with Sharp, expand at five shapes); phone screenshots |
| 3 Display | Portrait and landscape both work | adaptive size and `portrait` options; a fixed `res` letterboxes | same, and a fixed `res` fills more; with `expand` it fills both ways (what fills the extra space is the game's job: since v0.27.0 the kits fill it edge to edge, the HUD over the world's corners, `AI_GUIDE.md`) | already met | phone emulation, both ways |
| 3 Display | Safe areas | the Shell's panels and Emberdeep's HUD keep out of them | the corner and the touch buttons too; the viewport reaches them (`viewport-fit=cover`) | built in; a canvas HUD under a notch is the game's job | `standard-test` (viewport) |
| 3 Display | After a resize or rotation: rebase drags, recalculate input | canvas and mouse mapping recalculated | the touch stick is lifted on a resize, input cleared on a full-screen change | built in | code review; phone emulation |
| 3 Display | Folds and hinges | none | none | deferred | |
| 3 Display | The on-screen keyboard | no text fields | no text fields | not applicable | |
| 4 Full screen | A clear control, from a player action, of the whole page (game, HUD, menus) | Emberdeep only | `game.fullscreen` on `document.documentElement`; a phone's first tap, the corner, the menu | built in | `standard-test`; phone screenshots |
| 4 Full screen | Handle refusals and changes; never force it back after the player leaves | Emberdeep only | a refusal noted on screen and kept in `failed`; the player's choice saved on every change, and a phone's tap honors it. Since v0.27.0 the choice is what the player turns off (the corner's button, the menu); leaving by a back gesture or Escape is not one: a game started by a tap goes full screen again (D24) | built in; a deviation, D24 | `standard-test` (turned off, reload, tap: stays out; a gesture left it, a game started: back) |
| 4 Full screen | Explain what a platform can't do | Emberdeep's README note | the settings row: "On an iPhone: Share, then Add to Home Screen"; the home-screen app tags added to the page | built in | code review (no iPhone here) |
| 4 Full screen | Pointer lock, orientation lock, wake lock | none | none: the engine's cameras need no pointer lock, both orientations work, wake lock is not asked for | not applicable (pointer, orientation); deferred (wake lock) | |
| 4 Full screen | No page gestures on the game, menus still scroll, pinch zoom not disabled | `touch-action: none` in the pages' own CSS | set on every game's canvas by the engine; the menu is a separate layer that scrolls; the viewport leaves zoom alone | built in | `standard-test` |
| 4 Full screen | A PWA manifest, offline play, updates at a safe point | none | none | deferred: the site is the review surface, not a store release | |
| 5 Input | Named actions, several sources, pressed / held / released, buffering, clearing on focus loss | yes | same; menus hold the game's input back; the touch START is the gamepad's Start (since v0.27.0 the corner's menu button, top right, there in play on a touch screen) | already met, extended | contract and standard suites |
| 5 Input | Radial dead zones; no drift; no duplicate events | the gamepad's sticks | the touch stick too (12%); prompts follow the last device used | built in | code review |
| 6 Keyboard and mouse | Remap gameplay actions and mouse buttons; conflicts shown before applying; recovery from a lost essential | Emberdeep only | `input.rebind` and the Controls screen; menu keys reserved; restore defaults | built in | `standard-test` (rebind, conflict, reserved, cancel, saved) |
| 6 Keyboard and mouse | Labels true to the keyboard layout | QWERTY codes | the browser's layout map where it gives one (an AZERTY Z), the code's position elsewhere | built in | code review (Chromium only) |
| 6 Gamepads | Sticks, buttons, triggers, d-pad; menus without a mouse | yes (standard mapping) | same; the menu by d-pad and stick | already met | contract (focus by input) |
| 6 Gamepads | Dead zone, inversion, remapping, restore defaults | dead zone and inversion as fields | settings on the Controls screen | built in | `standard-test` |
| 6 Gamepads | Symbols by family, a manual choice, a positional fallback | Emberdeep's labels | Xbox, PlayStation, Nintendo from the controller's name, or chosen; "Positions" | built in | `standard-test` |
| 6 Gamepads | Disconnects: clear its input, pause, a message, keep playing on another device | input released | a pausable scene pauses with "Controller disconnected" | built in | `standard-test` |
| 6 Gamepads | Vibration where there is an actuator, an off and a strength setting, stopped on pause | none | `input.rumble`, `hitFx` rumbles, the Vibration slider, stopped on pause, focus loss and unplugging | built in | code review (no controller here) |
| 6 Gamepads | Non-standard mappings, analog trigger values, adaptive triggers | standard mapping assumed | same | deferred | |
| 7 Touch | A floating stick from the first contact, neutral on release, ownership per finger | yes | a dead zone; side, size, opacity and visibility from settings; a laptop's touch screen shows the buttons once touched; since v0.26.0 the stick past halfway presses the directions (menus, dialog choices, ladders) and a bottom dialog keeps clear of the buttons (`input.touchArea()`); since v0.26.1 a tap or click on an `E.Menu` entry picks it and a tap on a dialog turns its page; since v0.27.0 `input.drag()` steers one to one (the stick's finger, per step) | built in | `standard-test` (side, size, hidden, stick directions, menu and dialog taps, drag) |
| 7 Touch | Camera and aim by touch, pinch zoom | Emberdeep's own | since v0.32.0 the player's zoom: a two-finger pinch (both fingers moving: not the stick), the wheel, - and =, Settings, Camera zoom, within a scene's `camera.zoom`, kept on top of the zoom the scene starts at | built in (zoom, where a scene allows it); aim the game's job (the engine has no free camera) | `phone-test` (zoom) |
| 8 Context actions | Stable positions; hidden controls get no input; tap and hold | the touch buttons don't move | same; hidden corner buttons are `display: none`; since v0.27.0 `input.touchSet(a, label, show)` relabels a button or hides it while it has nothing to do (a hidden one lets go and leaves `touchArea()`), as the adventure's TALK and the stealth's TAKE DOWN and PARRY do | built in; which action fits the moment is the game's job | `standard-test` (relabel, hide, back) |
| 9 Camera comfort | Shake, flashes, motion | reduce motion (from the system) | settings for each, applied to `game.shake` and `game.flash` | built in | `standard-test` |
| 10 Assistance | Aim assist, auto-fire, input buffering, hold or toggle | `buffered` | a place for them (`menu.settings`); since v0.27.0 the shooter kit fires by itself on a touch screen and the RPG kit takes taps on its commands and foes | the game's job | phone screenshots |
| 11 Menus and accessibility | Full menu use by touch, mouse, keys, gamepad; focus shown, set on open, restored on close, scrolled into view | the Shell's pause and settings | the same for every game, with focus restored on the way back; since v0.27.0 every screen has a close button at the top right (where the menu button was), one over another a back arrow at the top left, and a sideways swipe goes back a screen | built in | contract, `standard-test` (close, back, swipe) |
| 11 Menus and accessibility | The back gesture never strands the player | none: a phone's back left the page | since v0.27.0 an entry of the game's own in the page's history, added on a tap while there is somewhere to go back to: back closes the menu screen, pauses play into the menu, or takes a scene's own `back()` (`game.back()`), and only then leaves; `overscroll-behavior: none` stops pull to refresh and the sideways swipe off the page | built in (`backGesture: false` leaves it out) | `standard-test` (back in play opens the menu) |
| 11 Menus and accessibility | Names and states; 44-pixel targets; 200% text; contrast; not color alone | roles on switches and dialogs | `role=switch`, `aria-checked`, a live status line on the Controls screen, 44-pixel buttons; the theme's ink on paper is high contrast | built in for menus; gameplay is the game's job | code review; no screen-reader run |
| 11 Menus and accessibility | Subtitles and captions | `Dialog` shows speech as text | same | the game's job | |
| 12 Settings | Display, interface, keyboard, gamepad, touch, camera, audio and gameplay groups | the Shell's sound, volume and motion | every group the engine can make work (see the table above); frame-rate limit, brightness, text size and HUD scale are not offered because nothing would honor them yet | built in where it can take effect | |
| 12 Settings | Versioned, validated, blocked storage, migration, restore defaults per group | none | `{ v: 2, values }` under `settings:<path>` (v0.27.0: version 2, D24); each value checked on load; a broken save loads as defaults; blocked storage plays on (`saved: false`); the Shell's older saves carried over; `reset(group)` | built in | `standard-test` |
| 13 Saving | Atomic, versioned saves, checkpoints, confirm before loss | `E.store` | same; Quit to title asks first | the game's job | |
| 13 Pause | Pause reasons kept apart; focus never resumes; explicit resume | Emberdeep only | `pauseReason`; focus loss and unplugging pause, nothing resumes by itself | built in | `standard-test` |
| 13 Recovery | Clear recovery for failed loads; real progress when it can be measured, an honest indicator when not | the red box, for developers | the boot screen: each step and a bar (measured by steps), a moving bar while the page loads; a failure before play shows what failed, the error, a code and the system, with Try again, Copy report and Continue | built in (v0.24.0) | `standard-test` (the screen, the report, Continue) |
| 13 Pause | Long suspensions: no backlog | the clock takes at most 50 ms a frame | same | already met | contract (the clock) |
| 13 Pause | Restart and reload without leaks | `dispose()` removes every listener | the corner and menus too | already met | contract (dispose) |
| 14 Audio | Starts after a gesture; volumes per channel; settings before the first sound | yes; the Shell's volume | master, music, effects and mute saved and applied when the game is made | built in | `standard-test` |
| 14 Audio | The background | music kept playing, choppy, in a hidden tab | the sound sleeps while the page is hidden unless "Sound in the background" is on | built in | code review |
| 15 Performance | No cost when unused | | the menu is built only when it opens; the corner compares one number a frame | built in | the full suite's timings |
| 16 First use | Instructions for the active input; settings before demanding play | | `input.label`; the corner's menu on a title opens the settings | built in; tutorials are the game's job | `standard-test` |
| 17 Verification | Evidence a player can send: environment, build, reproduction | sessions (`E.session`) for developers | the failure report and `E.diagnose()`: engine and game versions, build, browser, device, screen, canvas, GPU, sound, storage, input, scene | built in (v0.24.0) | `standard-test` |
| 17 Verification | Physical devices, browsers, controllers | | headless Chromium on Linux, phones emulated (390 x 844 and 844 x 390 at 3x) | deferred: no physical phone, iPhone or controller was used | |

## Action coverage (the presets)

What each action answers to in every preset, before the player rebinds. Touch: the move stick is the screen's free side
(the left, or the right for a left-handed player); a scene's `touch: [...]` lists the buttons it needs; START is the
menu. Gamepad buttons are named by position, with the Xbox symbol (`input.label` shows the family's own).

| Action | Keyboard and mouse | Gamepad | Touch | Presets |
| --- | --- | --- | --- | --- |
| up / down / left / right | WASD, arrows | left stick (past halfway), d-pad | the stick (past halfway it presses these too) | all |
| start | Enter | Start | START | all (menus) |
| pause | Escape, P | Start | START, the corner's menu | all (pausable scenes) |
| confirm | Enter, Space, J, Z | A (south) | a tap on a menu | all (menus) |
| cancel | Escape, Backspace, X, K | B (east) | the menu's Back | all (menus) |
| attack | J, X, left click | A, RT (DEFAULT); X (PLATFORMER, THIRDPERSON) | a scene's button | DEFAULT, PLATFORMER, THIRDPERSON |
| dash | Space, Shift, K (DEFAULT); Shift, C, L (PLATFORMER) | B, LT (DEFAULT); B, RB (PLATFORMER) | a scene's button | DEFAULT, PLATFORMER |
| skill | L, E, right click (DEFAULT); E, V, right click | X, RB (DEFAULT); Y | a scene's button | DEFAULT, PLATFORMER |
| jump | Z (DEFAULT); Space, Z, K | Y (DEFAULT); A | a scene's button | DEFAULT, PLATFORMER, THIRDPERSON (Space) |
| sprint, crouch, interact, block, dodge, use, map | Shift; C, Ctrl; E, F; K, right click; L; Q; M, Tab | RT, L3; B; Y; LB; RB; LT; View | a scene's buttons | THIRDPERSON |
| fire, bomb | Space, Z, J, click (hold); X, K, right click | A, RT; B, LT | a scene's buttons | SHMUP |
| menu (the engine's) | the corner's button | | START, the corner's button | every game |
| full screen (the engine's) | the corner's button, the menu (F11 is the browser's own) | the menu | a phone's first tap, the corner, the menu | every game |

Common actions never need a stick click or a two-button chord. On a touch screen without the engine's touch buttons, the
corner's menu button stays in reach while playing.

## What stays the game's job

The manuals list these where a builder reads them (`AI_GUIDE.md`, Standard features; the API card): every gameplay scene
`pausable: true`; prompts from `input.label`; touch buttons for every action a level needs; the assists its mechanics
call for, as settings; its own saves, versioned, written at checkpoints, confirmed before a loss; a canvas HUD clear of a
phone's notch; nothing told by color alone.

## Verification (v0.23.0)

| Case | Environment | Evidence | Result |
| --- | --- | --- | --- |
| Settings, pausing, labels, rebinding, the touch START, boot steps and their failures (both editions) | Node 24 | automated (`tools/standard-test.mjs`) | pass |
| The boot screen, the report, an error before and after play, `boot: false` (both editions); Emberdeep's first paint on a slowed CPU (0.16 s, was 1.6 s) | headless Chromium (4x CPU slowdown for the timing) | automated (`tools/standard-test.mjs`, 94 checks in all); screenshots | pass |
| The page, the corner, the pause menu, Settings, Controls, rebinding, Quit, saved settings, bad and blocked storage, full screen, touch buttons, a game's own Shell, `menu: false` (both editions) | headless Chromium, desk and emulated phones | automated (`tools/standard-test.mjs`) | pass |
| The menus by eye: title, play, pause, settings, controls, rebound | Chromium at 1280 x 720; emulated phone 390 x 844 and 844 x 390 at 3x | screenshots | pass |
| The rest of the engine, Emberdeep and the labs | headless Chromium | `npm run test:changed` (all 20 suites) | pass |
| A physical phone, an iPhone, a physical gamepad (rumble, symbols), a screen reader, a fold | none here | none | not tested |
