# Character animation integration

`src/actors/animation.js` uses the pinned engine's actual `Mocap.load`, `Mocap.drive`, `lib.sample` and `lib.blend` on `E.Humanoid` rigs. It does not substitute a separate skeleton or renderer. `assets/animation/urban.js` contains 30 selected clips (364 readable key poses, about 110 KB) with upstream `sources`, each clip's `src`/original metadata, and `fit` records intact.

Load order is deliberately sequential: pinned `src/mocap/readable.js`, pinned `src/mocap/mocap.js`, selected `assets/animation/urban.js`, then `assets/animation/bridge.js`. The bridge exposes the upstream classic scripts' lexical globals to the ES module adapter. All resources are local. A failed script rejects with a useful resource path for the boot error screen.

## Root integration contract

```js
const animations = await AnimationSystem.load({ E, world });
animations.register(player.actor, { role: 'mara', getState: () => ({
  health: state.player.health,
  dead: state.player.health <= 0,
  crouched: player.crouched,
  inCover: player.inCover,
  peekSide: player.coverSide,
  aiming: player.aiming,
  aimPitch: runtime.camera.pitch,
  armed: player.weapon !== 'unarmed',
  weapon: player.weapon,
  reloading: state.player.inventory.weapons[player.weapon]?.reloadEndTick > state.tick,
  seated: !!vehicles.occupant(player.actor),
  transition: vehicles.transitions.get(player.actor),
  exiting: vehicles.transitions.get(player.actor)?.kind === 'exit',
  vault: player.vault > 0,
  blocking: state.player.combat.blocking,
  dodging: state.player.combat.dodgingUntilTick > state.tick
}) });
```

Register Jun, crew, police, contacts and pedestrians similarly. Plain actors with no callback still choose locomotion, crouch, aim, seated and death from native `actor` / `actor.anim` fields. For crew, return `{health:e.health,dead:e.health<=0,aiming:e.visible}`. Talk/phone layers use `{talking:true}` / `{phone:true}`. `trigger(actor, 'shot'|'hit'|'reload'|'interact'|'melee'|'vault', {duration?})` starts presentation only; gameplay remains authoritative. Reload, impact and shot triggers never change ammo, health or mission state. `reset()` clears animation history for a new run/checkpoint restore.

The fixed sequence is intentions → `vehicles.preStep(dt)` → `world.step(dt)` **once** → `vehicles.postStep(dt)` → `animations.update(dt)` → camera/presentation. Registration sets `actor.pose=false`; the adapter explicitly invokes its rig update once after physics. Vehicle attachment skips its own rig update when `actor.data.animationManaged` is true. Native engine rendering then reads the finished joints. This avoids advancing the rig twice.

## Layers and authored adjustments

Locomotion selects idle, walk, jog, sprint and crouched gaits from actual physical speed, with cadence scaled to speed. A 160 ms crossfade handles state changes. Upper-body capture replaces chest/head/arms while retaining the locomotion pelvis and leg points. Weapon aim has up/neutral/down variants; reload, phone, talk, hit and shooting can layer over movement. Unarmed guard uses the selected block clip; jab/cross and three dodge directions are available. SMG support shifts the left-hand grip; cover shifts the upper body along the requested peek direction.

Vault, seat enter/exit, driving and death are exclusive captures. Door reach is authored over the entering seat pose while VehicleSystem owns the validated physical interpolation and door hinge. Death plays once and holds its final pose. The captured root-motion track is exposed for diagnostics but never applied or subtracted: the pinned readable decoder already samples it in place, and physical movement has one owner. The visual state is exposed as `actor.data.animation` for tests and filmstrips.

These are integration mechanisms, not evidence that every gameplay trigger or art-quality gate has passed. Final motion acceptance requires observing the integrated game, seat alignment, hand placement and both depot routes.

## Reproduce selected clips

Read `node vendor/my-3d2dge/tools/anim-set.mjs --help` first (it prints usage and exits 2). The set was cut from pinned `src/mocap/sets/quaternius.js` plus `mesh2motion.js` using `tools/anim-set.mjs`, `--name EWA93`, `--out assets/animation/urban.js`. The selection is named by the 30 keys in `MOCAP.EWA93.clips`; 27 come from Quaternius Universal Animation Libraries and three directional dodges from Mesh2Motion community additions. Both selected sources carry CC0 records in the source set. The original project bridge and animation adapter are project-authored code.
