# Codex, the Unwritten

Codex is the second playable hero in Emberdeep. Open **CHARACTER** on the title, choose **Codex**, then **PLAY AS CODEX**. The same dialog has a live animation preview and a gallery shortcut. Keyboard, mouse, controller and touch all use the existing customizable controls.

![The actual Codex rig, shown in six poses](assets/codex-showcase.png)

[Animated preview](assets/codex-motion.gif)

## Identity and animation

Codex is a lost archive that wrote itself a soul. The silhouette is an open book suspended beneath an ivory mask and a segmented brass halo. Detached gauntlets manipulate a feather quill; three paper leaves orbit the torso; two silk bookmarks trail beneath it. The palette is parchment, dark ink, brass, sea-green light and lilac. Weapon elements change the quill's light, and rare armor gilds the binding.

`CodexRig` is a separate geometry and animation implementation. It does not extend or reskin the humanoid rig. The body has no leg cycle: movement uses a continuous hover, lateral bank, forward lean and travelling bookmark bends. Acceleration is softer than the Wanderer's. Foldstep compresses the entire rig into a fast-moving sigil, with page-like afterimages and a papery synthesized sound. Casting poses trace a seal, snap the folio open, gather the hands inward, or raise them over the archive. Wounds, knockdowns, drinking, death and recovery have their own rig responses. The title, inventory turntable, gallery and spectral echo preserve the character's body.

The hover is cosmetic. Codex still collides with walls, is affected by ground hazards, and needs a dodge or a movement skill to cross gaps.

## Combat

Each Quillshot hit inscribes a manuscript page, up to three. The orbiting leaves and HUD diamonds become gold. The next signature spell consumes all three pages on release, becoming **Illuminated**. Cancelling its wind-up does not spend the pages.

| Slot | Spell | Role | Rune choices |
| --- | --- | --- | --- |
| LMB / X | Quillshot | Free ranged generator; earns Ember and manuscript pages. | Double Script: two quills. True Name: homing and extra pierce. |
| RMB / Y | Margin Seal | Delayed frost burst at the aim point; slows the pack. | Binding Clause: stun. Postscript: a second burst. |
| 1 / B | Razor Folio | Five piercing pages fan out and return. | Loose Leaves: seven pages. Paper Cuts: bleeding. |
| 2 / LB | Revision | Restores life, cleanses damaging ailments, replenishes one dodge. | Hardcover: armor. Free Verse: movement speed. |
| 3 / RB | Living Index | Three orbiting leaves cut nearby enemies for four seconds. | Wide Margins: reach/duration. Book Ward: resistances. |
| 4 / RT | The Last Word | Pulls a pack inward and closes the archive in a void blast. | Full Stop: stun. Afterword: lingering damage. |

Illuminated offensive spells deal 50% more damage; Revision's healing is multiplied by 1.5. Margin Seal and The Last Word also gain radius. All six start at rank 1; spending points improves them normally, and rank 2 enables a rune. Shared skills and the full gear, crafting, passive and endless mastery systems remain available. Respecs retain starting ranks without refunding free points.

## Persistence and integration

- `ed:save` remains the Wanderer's slot, including legacy saves without a character field.
- `ed:save:codex` holds Codex's separate progression, inventory, stash, skills and records.
- `ed:character` remembers the chosen hero. `?character=codex` or `?character=wanderer` overrides selection for that page load and works with existing scene/depth links.
- Settings → Tools act on the current hero, whose rig is Codex's own. Gallery saves remain isolated.
- Codex is a playable character like any other (`docs/CHARACTERS.md`): `21-codex.js` draws and animates it and registers it with `def('characters', 'codex', ...)` (its body, starting gear, arrival, title pose, menu notes); `29-codex-skills.js` defines its combat. `18-characters.js` holds what every character shares, and `63-character-menu.js` the selection and preview.
- `npm run character:check -- codex` runs the character test and draws its character sheet; `tools/ed-codex-test.mjs` keeps what is Codex's own (its pages, its signature spells, the legacy-save handover).

## Verification and reproduction

`npm test` rebuilds the standalone game and runs the controls suite plus the Codex browser suite. Character checks cover legacy-save preservation, independent continuation, actual menu selection, movement/dodge input, inventory and progression, every signature spell, empowerment, runes, healing, sandbox isolation, shared skills/equipment/passives/echoes, all four camera views, death/revival, gamepad input and phone layout/touch input. Tests use Chromium and a simulated standard gamepad; physical devices were not available.

Run short scene/combat checks with `npm run test:smoke -- --character codex --secs 2 --out check-output/codex-smoke`. This exercises title, town, gallery, proving grounds and depths 1–20. The smoke test is not an exhaustive balance assessment of the endless generator.

`npm run showcase:codex -- --frames` renders the actual rig into a pose sheet and 120 frames under `check-output/codex-showcase/`. The checked-in GIF is a 15 fps loop of those frames. No generated image or external asset is substituted for the playable model.
