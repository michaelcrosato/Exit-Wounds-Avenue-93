# Importing ready-made assets

The asset store (`src/assets/`) holds objects, materials and sprites converted from CC0 libraries, as text a game loads
with one call: `E.addAssets(window.ASSETS['kenney-furniture'])`, then `r.shape('kenney-furniture:bed-single', x, y, 0,
{ facing })`. `docs/ASSETS.md` is the card for using and writing entries; this page is how the store is made, so a model
or a person can add a library the same way, then how the engine draws a shape, why the format is data, the traps and the
measures. The Asset Lab (`/asset-lab`) shows every entry.

Every entry records where it came from: its set's `sources` hold each download (url, date, sha256 or commit, license and a
hash of the license text as fetched), the entry's `src` names one of them, `orig` the file in it, and `fit` how close it
is. Binaries never enter the repository (principle 4): downloads stay in `.cache/assets/`, and only text is committed.

## The pipeline

```
asset-fetch  ->  .cache/assets/<lib>/        the downloads, and a record of each in the set's catalog ($sources)
             ->  src/assets/catalogs/<set>.tsv   the ledger: every file, its size, triangles, fit, used, flags, a note
asset-sheet --grid                            contact sheets of a set, for curating it
(curate)     ->  src/assets/catalogs/<set>.json  "id": ["tags", "what it looks like"], $skip with reasons, $mats
asset-import ->  src/assets/sets/<set>.js     the set: sources, materials, shapes, sprites, each entry with src, orig, fit
asset-set    ->  a smaller set (a game's own), with the shapes and materials its entries use (src/assets/sets/tavern.js;
                 emberdeep.js, Emberdeep's set dressing; platformer.js, shooter.js, brawler.js, animlab.js, the kits')
asset-find   ->  search every set and the core library
```

| Tool | npm | What |
| --- | --- | --- |
| `tools/asset-fetch.mjs <lib> <name> ...` | `assets:fetch` | Downloads into `.cache/assets/<lib>/`, checks the license (its text names CC0 1.0 or the public-domain mark, and no other license, or it stops), records the download and surveys every file into the set's ledger. `--survey` rewrites the ledgers, keeping their notes (and the rows of downloads not in `.cache`). |
| `tools/asset-import.mjs <set> [--catalog] [--scale k] [--tol .9] [--only a,b] [--list]` | `assets:import` | Converts the set's downloads (below) and writes `src/assets/sets/<set>.js`; `--catalog` takes only the ids its catalog describes, with their descriptions and `$mats`; `--only` converts those ids and leaves the rest of the set and its ledger as they are; `--list` prints the ledger. |
| `tools/asset-sheet.mjs <set file> --grid` | `assets:sheet` | Contact sheets, 30 entries a page, and a page of the kit's colors with the entries using each. `tools/asset-sheet.mjs file.js#id` draws one entry in every view and lints it. |
| `tools/asset-set.mjs a.js b.js --ids x,set:y --name n --out f.js` | `assets:set` | Cuts a set by ids, with every shape they place (`use`) and every material those name, and their downloads' records. |
| `tools/asset-find.mjs "tavern table" [--kind shape] [--show set:id]` | `assets:find` | Searches ids, tags and descriptions; `--show` prints an entry to copy. |

### Models to shapes

1. **Read** each glTF (binary, or `.gltf` with its buffer): z up, metres to units (x16), times the kit's `scale` (in its
   source record, so a re-import keeps it), the footprint centred, the lowest point on the floor. A kit's colors come from
   its palette texture (sampled at each triangle's UVs) or from its materials' color factors. The spec makes factors linear;
   Kenney writes them as sRGB (its renders agree), so its records say `factors: 'srgb'`.
2. **Split** by color (a kit's gradient shades of one swatch count as one color) and by connectivity.
3. **Fit** each color's pieces together first, then halves of them, down to single pieces: the simplest primitive whose
   voxels (the visual hull, skin cells left out) match the part's at an IoU of `--tol` (.9) or better, cheapest in tokens
   first: box, ball, cyl, lathe or prism along any axis, wedge. A part nothing fits becomes boxes merged at a unit. A grid
   of at most about 400,000 cells per part.
4. **Fold** mirrored pairs into `['mirror', 'x' | 'y', part]`, drop parts no view shows, keep 40.
5. **Colors**: the kit's palette is built from every model in its ledger (so names never move): each color named after
   its nearest core material (`oak`, then `oak-b`), keeping the kit's own hex on that material's pattern (D31). A
   curator's `$mats` gives a color another core material's pattern (`"linen": "birch"`: this pale pink is wood), or
   `none` (flat: paint, plastic, small items).
6. **Measure** (below) and write. An entry whose mean fit is under .8, or one of its views under .6, stays out of the set,
   flagged `fit` in the ledger.

### PBR sets to materials

1. The source's id picks the pattern family: Bricks to bricks, WoodFloor and Planks to planks, PavingStones and Rock to
   stones, Tiles to tiles, MetalPlates and Metal to metal, RoofingTiles to shingles, Fabric and Leather to cloth, Grass to
   foliage, Bark to bark, Marble, Concrete, Plaster and Snow to noise, Ground and Gravel to speck.
2. The ramp: the color map's pixels in five clusters (k-means), kept as the material's own `ramp` where `E.tones` misses
   them by more than dE 8, with E.tones' lightness (our light bands) and the clusters' hue and chroma.
3. The numbers: where a line across the height map crosses a joint (the steepest few percent of its slope; of a few cuts,
   the one every line agrees on best), across and along, times the physical size (ambientCG's API gives it in cm), at twice
   life (as props are drawn). Rivets only on riveted plates, at least 6 units apart.
4. The fit: our material drawn flat at game scale against the color map shrunk the same way: the mean color's dE, and a
   structure score (how close the joints' periods and the contrast are, 0 to 1). JPEG maps are decoded by Chromium.

### Pixel packs to sprites

Each tile of the pack's commonest size becomes rows with one character per color, from one palette for the whole pack
(`.` is clear). Tiles with partial transparency are left out (flagged `translucent`). Exact: the assets suite redraws
each sprite and compares it with its source image pixel for pixel, where the download is in `.cache`.

## Adding a library, step by step

1. **Check its license** on its own page, and that it is CC0 (or the public-domain mark). Anything else waits for the
   owner (`DOCTRINE.md`: adding a license is hard to undo). Record what the page says in this file's table.
2. **Fetch**: `node tools/asset-fetch.mjs kenney pirate-kit` (or `kaykit <repo>`, or `ambientcg <ids>`). A new kind of
   source needs a branch in `asset-fetch.mjs` that records `label`, `origin`, `license`, `url`, `fetched`, `sha256` (or
   `commit`) and `licenseHash`, and a `dir`.
3. **Find the kit's scale**: its barrels, chests and tables should stand about 19, 14 and 12 units tall beside the
   26-unit hero. `node tools/asset-import.mjs <set> --scale 2 --only barrel,chest,table` and look at the sheet.
4. **Import it all**: `node tools/asset-import.mjs <set> --scale 2`, then `node tools/asset-sheet.mjs
   src/assets/sets/<set>.js --grid`.
5. **Curate from the sheets**: in `src/assets/catalogs/<set>.json`, describe every entry worth keeping (`"id": ["tags",
   "what it looks like"]`: kind and place in the tags, colors and main parts in the description), put the rest in `$skip`
   with a reason (structural pieces, which TileMap and materials do; conversions that read badly; near-duplicates; things
   under a pixel; characters), and give `$mats` for colors whose pattern is wrong. A set of a few hundred is a job for
   one subagent with the sheets; Phase 2 used one per two or three kits.
6. **Re-import from the catalog**: `node tools/asset-import.mjs <set> --catalog`. Look at the sheets again.
7. **Test**: `node tools/assets-test.mjs` (the store's section: provenance, licenses, catalogs, ledgers, fit, exact
   sprites, every set loads and draws). Rebuild (`node tools/build.mjs`): the Asset Lab inlines every set.

## The sources

Checked on 2026-10-14, each license read where the tool fetched it (its hash is in the set's `sources`).

| Set | Library | License, where stated | Entries |
| --- | --- | --- | --- |
| `kenney-*` (furniture, survival, graveyard, mini-dungeon, food, pirate, holiday, platformer, nature, fantasy-town) | Kenney's 3D kits (kenney.nl/assets) | CC0 1.0: `License.txt` in each zip, and each kit's page | shapes |
| `kenney-tiny-dungeon`, `kenney-tiny-town`, `kenney-tiny-battle` | Kenney's Tiny packs | CC0 1.0: `License.txt` in each zip | sprites |
| `kaykit-*` (dungeon-remastered, furniture-bits, restaurant-bits, halloween-bits) | KayKit by Kay Lousberg (github.com/KayKit-Game-Assets) | CC0 1.0: `LICENSE.txt` in each repository (the itch pages add a non-binding request not to resell unmodified copies) | shapes |
| `ambientcg` | ambientCG (ambientcg.com), 1K JPEG maps | CC0 1.0: ambientcg.com/license | materials |

Not taken: Quaternius' models (its site-wide license now forbids repackaging), CC BY libraries (game-icons.net, the Icosa
Gallery: credit per author, waiting on the owner), copyleft packs (LPC, OpenMoji), and Tiny Swords, Sprout Lands and
Cute Fantasy (no redistribution). The 0x72 and Ninja Adventure packs are CC0 but on itch, which the fetch can't reach.

## Fit

- **Shapes**: the silhouette IoU at game scale against the source's own triangles, drawn through the engine's rasterizer's
  projection, in 8 views (isometric, three-quarter, top-down from the characters' angle, brawler, side, and the
  isometric view turned three more ways): mean and worst; and the color dE of each triangle's own color against its part's.
  The store holds a mean of .8 or better, no view under .6.
- **Materials**: `{ dE, structure }` as above.
- **Sprites**: 0, exact.

## Costs and limits

- A shape costs 60 to 1,000 tokens (40 parts at most); the median converted one about 300, against about 120 for one
  written by hand: write by hand what a game uses often, and cut a set of what it uses (`asset-set`).
- Organic, ornate and structural models read badly or are better done otherwise: plants as generators (`tree`, `pine`,
  `bush`), walls and floors as a TileMap with materials, bodies as rigs.
- A kit color is shared by every entry that uses it: a `$mats` choice can't differ between two entries of one set.
- Glow, lights, flames, moving parts and held items are not converted: add `lights` and `flames` to an entry by hand.
- Kits embed the engine, never the store (D32): a game loads the sets it uses.

## How the engine draws a shape

- **Rasterized at game size** into a depth buffer: each primitive becomes triangles, with a segment every few pixels of
  its projected size, so small things stay crisp. Each pixel keeps its depth, normal, surface coordinates, material slot
  and part.
- **Shading:** the normal against the light (the view's upper left, in every view) picks a band of the material's ramp,
  and the pattern moves it a step or two. Top edges are lit, creases where parts meet are dark, and the outline is the
  characters' (`r.outline`).
- **Cached:** one picture per entry, params, materials, mirror, view, facing (32 steps) and size, the 800 most recent;
  the shadow (the footprint's hull, darker where parts meet the floor) is a picture of its own per view. A frame copies
  them: 300 shapes in view cost about 4 ms headless; the first frame makes each picture once (about 0.7 ms). Editing a
  material redraws the pictures that use it.
- **Queued like a prop,** outline baked in; a flash, an x-ray or see-through go through `r.actor`'s composite. GPU
  lighting gets the picture's own pixels; a glowing material's pixels are drawn again after the lighting.
- **Steep views** (top-down) draw shapes from `E.charView`'s lower angle, as they draw characters (`charView: false`).
- **Sorting:** one point plus `bias`, as props; standing raised, the footprint lifts it over wall blocks under it, and
  anything on a `map.solid` shape (a jar on a table) sorts after that shape.
- **Cosmetic:** no gameplay reads a picture. Generators seed their noise from their params, never `Math.random`, so an
  entry draws the same pixels everywhere and filmstrip comparisons hold.
- **In 3D** (`engine/my-3d2dge-3d.js`, `world.shape`): the same resolved parts as triangles (`E.shapeMesh`), each
  material's pattern a tile of one atlas (`E.materialTile`) on one toon material, instanced per kind; the box both
  engines collide with is `E.shapeBox`.

## Why data, and not meshes, voxels or SVG

Work on models that make 3D content (LL3M, 3D-GPT, MeshLLM, CAD-Recode, 3DCodeBench, SGP-Bench, 2025-26) agrees: a
small documented vocabulary of parts, parametric generators, and a loop that renders the result and checks it. Meshes
are long and can't be edited by name (import only); voxels blow up on round and ornate things (a barrel became 761
boxes; one lathe is 4 lines); SVG loses quality as pictures get complex, and for pixel art rows of palette indices are
smaller and exact. Hence named parts, `use` and generators, and `tools/asset-sheet.mjs` as the render-and-check step.
Pattern names follow MaterialX's and Blender's texture nodes where they overlap (noise, Voronoi, brick, checker), which
models already know (principle 7).

## Traps

- **Exact primitive detection fails** on most real parts (bevels and welds defeat it): fit by voxel IoU.
- **Round things are boxes' weak spot, ornate detail becomes noise:** a part budget (40), coarser cells, or `$skip`.
- **Real scale is small beside our hero, and Kenney's colors are sRGB** in a field glTF calls linear: each kit's
  `scale` and `factors: 'srgb'` are in its source record.
- **Anything that glows or moves** stays a prop, or uses an entry's `flames` and `lights`; shapes with states (lids,
  doors) and held items are not in the format.
- **The doctrine check's boundary scan** skips `src/assets/sets/` (data can hold strings like `._w`).
- **Kits must fit a 200k context:** they embed the engine, never the store (D32, D34).
- **`fetch()` doesn't work from `file://`:** sets are `.js` files that assign a global.
- **Licenses drift.** Quaternius' site-wide license now forbids repackaging while pack pages still say CC0: snapshot
  each license at fetch time (its hash is in the record), and take CC0 only until the owner says otherwise (CC BY
  libraries such as game-icons.net and the Icosa Gallery need credit per author).

## Measures

| Measure | Before the store | Now |
| --- | --- | --- |
| Objects a game can place without drawing code | 38 flat props | 25 core shapes and 475 from CC0 libraries, each with provenance and fit (mean silhouette IoU .90) |
| Surfaces | 7 floor textures, 8 faces, 6 roofs, 13 tile styles, closed | 129 materials in one open registry, on every surface |
| 2D pictures in a library | none | 460 sprites, exact |
| A hand-written object | 236-480 characters of drawing code per prop, one picture | a median of 125 tokens, right in every view and in 3D |
| An agent writes an object from a one-line brief | | 10 of 10 valid and drawn on the first try (canvas code: 10 of 10 ran), at 81% fewer tokens than canvas code (2,966 against 15,784; medians 332 and 1,570); a blind judge's look score 5.9 and 5.7 against canvas code's 7.4 and 6.6 |
| The benchmark judge on a re-run | 6/10 | not run (D36: the owner's answer didn't come in time) |

The authoring test (2026-10-15): fresh agents had only `docs/ASSETS.md`, with the catalogs and
`asset-find`, and wrote ten objects from one-line briefs (an anvil, a market stall, a gravestone, a campfire, a throne,
a beehive, a trough, a weapon rack, a wheelbarrow, an altar) without drawing them; other fresh agents had only `API.md`
and wrote the same ten as canvas code. Two blind judges (one sheet each, the two kinds in random order) found the shapes
better built (the wheelbarrow, the rack, the stall, the trough, crisp outlines) and the canvas code better at the one cue
that makes an object (a skep's coils, an anvil's horn) and smoother at small sizes, where a busy pattern on a small part
read as speckle; the card's recipe now says so. The first sheet drew shapes as sprites, without their flames.

## Who uses the store, and what still draws by its own code
Every page that draws a world takes from the store or the core library:
- **Emberdeep:** its set `emberdeep.js` dresses the dungeons (`53-scenes.js`) and the town.
- **The 2D kits:** each loads a cut of its own (`src/assets/sets/<genre>.js`, 597 to 1,391 tokens), next to the core shapes it draws.
- **The 3D kits:** `action3d.js` and `platformer3d.js`, through `world.shape`.
- **Emberwell and the Perspective Lab:** the core library.
- **The stress test:** its Shapes slider.
- **The Mocap Lab:** its Props button, off by default.
- **The two 3D prototypes:** core shapes as one three.js mesh each, from `E.shapeMesh`, solid from `E.shapeBox`.
- **The handoff package:** carries the whole store.

What still draws by its own code was reviewed against the store (v0.42.0):
- **The core library (25 shapes, median 125 tokens).** Every one has counterparts in the store, at two to five times the tokens and in a kit's own colours. The core stays: it is in every page at no cost and tuned to the house look. A game cuts store entries for variety.
- **Emberdeep's town, the moving and the used.** The forge (fire, bellows, anvil, quench), the stall's awning and the stash's lid, the waystone, the lamps, lanterns and swinging signs, the trees and the scarecrow that sway. They move or open, so they stay code, by the card's limit (still objects only).
- **Emberdeep's town, the still.** The coop, the coal heap and the weapon rack have no counterpart in the 23 sets. The log pile (the store has logs and planks) and the memorial's standing stones (stone-tall-c) keep their drawn look: the log ends in the forge's palette, and the candles' glow on the stones. The store's woodpile and graves stand beside them.
- **Emberdeep's dungeons.** The props are the engine's procedural ones: bones, skulls, broken pillars and statues, candles, grass, banners, recoloured per theme and depth. The store has no bones or skulls, and a store candle has no flame. The decorations (runestones, crucibles, chains, icicles, glow-worms, gears, vents, waterfalls, rifts) animate. All of them stay. The store comes in as scenes beside them.

Nothing that draws well by its own code was replaced. The store fills what nothing drew.

## Tests

`npm run test:assets` (`tools/assets-test.mjs`), section 7: every download CC0 or the public-domain mark with its record;
every entry's `src`, `orig` and `fit`; every entry in its set's catalog and every catalog id in its set; every download in
the ledger, every ledger row naming a download, the rows marked used as many as the set's entries; every `$skip` with a
reason; shapes at a mean IoU of .8 and no view under .6; sprites exact against their sources (where fetched); a cut set
equal to the entries it was cut from; every set loads (`E.addAssets`) and every shape in it draws.
