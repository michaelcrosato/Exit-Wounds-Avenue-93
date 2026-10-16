# Objects and materials as data

The full engine draws still objects (barrels, tables, trees, wells) from a few lines of data, in every view and facing,
with the house shading and outline, and gives every surface (floors, wall faces, wall tops, platform tiles, the objects'
own faces) a material from one open registry. An object costs one to a few hundred tokens of data (the core's median is
125); you check it headless with one command. Read this card whole before you write one. (The agent edition keeps the
registries and ignores the calls: `E.addAssets` returns empty lists, the others null.)

## Use one

```js
// in draw(r): feet on the point, depth sorted like an actor; its front toward facing
r.shape('barrel', x, y, 0, { facing: Math.PI / 2 });
// once, before the updates: bodies stop at it, a body coming down lands on it, one wholly below passes under
map.solid('table', 120, 80, 0, { facing: 0 });
// a sprite of it, for an inventory or a HUD (r.sprite, px.sprite)
const icon = E.shapeSprite('chest', { view: 'iso' });
```

- **r.shape options:** facing (radians, where the front points: 0 east, π/2 south, as written), scale, mats ({ slot:
  material }), flip (mirrors it x to -x, collision too), params (a generator's: { h: 30 }), bias, hides (default true),
  light (adds its lights to game.lights), shadow (default true).
- **map.solid** takes the same id and placement, so one object can feed both calls. Bodies span z to z + h (E.Body's h, 32).
- **In 3D** the 3D engine draws the same entries, materials and boxes: `world.shape(id, x, y, z, o)` (its header).
- **Steep views** (top-down) draw shapes from the characters' lower angle, as rigs are drawn. The light comes from the
  viewer's upper left in every view.
- **Glow and fire:** a material with glow: 1 ignores the light and stays bright in the dark; an entry's flames ([[x, y, z,
  w, h]]) draw the engine's animated flame (r.shape only: a sprite has none). Anything else that moves stays a prop
  (r.prop) or your own code.
- **Dressing a generated level:** a scene is a few entries as [id, across, forward] from an anchor (a wall spot, forward
  into the room); place it whole or not at all, each part on free floor, after the level's own random picks and from a
  seeded stream of its own, so the level stays as its seed builds it (Emberdeep's `src/emberdeep/53-scenes.js`).

## The core library

**Shapes** (sized for a 26-unit hero; generators take params): barrel, crate, chest, table, chair, stool, bench, bed,
bookcase, shelf, pot, jar, sack, cart, well, sign, lamppost, anvil; fence { len: 16 }, pine { h: 41, tiers: 4 },
tree { h: 40, seed: 1 }, bush { r: 7 }, grass { h: 6, n: 6 }, rock { r: 7.5, seed: 2 }, crystal { h: 18, seed: 1 }.
`r.shape('pine', x, y, 0, { params: { h: 30 } })`; `E.SHAPES.barrel.about` says what each is.

**Materials:** woods oak walnut birch crate plank planks wood; stones stone cobble marble granite sandstone slate rock
brick flagstone ruin; metals iron steel gold copper bronze metal rusted; clay glazed porcelain; cloth linen burlap wool velvet leather;
plants bark needles leaves shrub moss straw hedge grass; ground dirt sand snow mud; water ice crystal flame bone shingle;
walls timber plaster; tops speckle plain tiles slab; tiles block bonus ground pipe checker.

## Materials on surfaces

```js
E.MATERIALS.mossy = { color: '#6a7a5a', pattern: 'stones', size: 6 };   // or the shorthand '#6a7a5a stones size=6'
const types = { 1: { h: 32, top: '#6a6280', side: '#4a4360', face: 'cobble', roof: 'slate' } };   // TileMap walls
const map = new E.TileMap({ rows, legend, types, floorMat: 'flagstone', floorMats: { water: 'water' } });   // floors
const level = new E.PlatformMap({ rows, legend, types: { 1: { kind: 'solid', style: 'block', mat: 'mossy' } } });
```

floorMats is keyed by the floor tags of the legend ('~': { floor: 'water' }); either stands in for floorTex.

A material is `{ color, pattern, ...the pattern's numbers, ramp, glow, over }`. Its five tones come from `E.tones(color)`
(or its own `ramp` of five, dark to light); the light picks a band, the pattern moves it a step, so a material works on
every surface and in every palette and recolors with one hex. An unknown name warns with the list of names.
Overlays, the last on top, each in its own color's tones: `over: [['moss', '#5f7a3a', { up: .6 }], ['cracks']]`; moss on
what looks up, cracks (the material a step darker), dirt near the ground (h 6), rust; each takes amount and size.

| Pattern | Numbers | What |
| --- | --- | --- |
| none | | the light alone |
| planks | bw 3, len 14, dir | boards with joints; staves on round parts; dir: 'v' turns them |
| crate | frame 2, bw 3 | a framed, braced side; planks on its lid |
| bricks | bw 6, bh 3, mortar | running bond |
| stones | size 5 | irregular stones (Voronoi), dark joints, a lit rim |
| tiles | size 4 | square tiles, grout |
| speck, noise | amount .08; scale 4 | specks; soft patches |
| foliage | size 3.5 | leaf clumps lit on top |
| bark | | fissures; rings on a cut end |
| metal | rivet | a shine where lit; rivets |
| cloth | fold .9 | weave and folds |
| glaze | | a glossy shine |
| thatch, shingles | course; bw | straw courses; roof tiles |

Your own pattern: `E.PATTERNS.waves = (s, m) => Math.sin(s.u / (m.size || 3)) > .8 ? 1 : 0` (s.u, s.v: world units
across and up the surface; s.lid, s.curved, s.lit, s.W, s.H; return a step, -1 to +2). A material may also paint one kind
of surface its own way, per pixel: `face(wx, z, tones, type, cx, cy, fi, nh, h)` or `roof(wx, wy, tones, type)` returning
a color or null, `floor(x, y, tag, view)` returning [r, g, b].

## Write one

Units: 16 = 1 m = one tile; x east, y south, z up. The origin is the middle of the footprint on the ground; write it
facing south (+y). Use whole or half units: a pixel at game size is about 0.7 units.

```js
E.SHAPES.stool = { about: 'round three-legged stool', tags: 'furniture tavern', mats: { w: 'oak', l: 'walnut' },
  parts: [['cyl','w',[0,0,8],5,1.5], ['ring',3,3,['box','l',[0,0,0],[1.5,1.5,8],{rot:[0,-8,0]}]]] };
```

An entry: `about`, `tags`, `mats` (slot to material; a slot name that is not in mats is a material itself), and `parts`, or
`make(params)` returning parts with `params` its defaults. Optional: `scale` (times the placement's), `foot: [x0, y0,
x1, y1]` (the footprint for collision, and for sorting when it stands raised; the bounds by default), `lights: [[x, y,
z, color, radius]]`, `flames: [[x, y, z, w, h]]`.

| Part | Form | Notes |
| --- | --- | --- |
| box | `['box', m, at, [w, d, h], { rot }]` | at: the bottom middle |
| cyl | `['cyl', m, at, r, h, { r2, seg, sq }]` | r2: top radius (0: a cone); sq squashes y; seg: 6 for a hexagon |
| lathe | `['lathe', m, at, [[r, z], ...], { seg }]` | a profile turned about z, bottom to top; [0, z] closes an end |
| ball | `['ball', m, at, r, { sz }]` | at: its centre; sz below 1 flattens it |
| prism | `['prism', m, at, [[a, b], ...], h, { axis }]` | an outline pushed h: up z (outline x, y), or centred along y (outline x, z) or x (outline y, z) |
| wedge | `['wedge', m, at, [w, d, h]]` | h tall at the back, down to the floor at the front |
| rock | `['rock', m, at, r, { sz, seed, rough }]` | a lumpy, faceted ball; below the floor is not drawn |
| use | `['use', id, at, { rot, scale, mats, ...params }]` | another shape inside this one |
| mirror | `['mirror', 'x' \| 'y' \| 'xy', part]` | the part and its mirror copies |
| ring, row | `['ring', n, radius, part]`, `['row', n, [dx, dy, dz], part]` | n copies round z (the part moved out to radius); n copies in a line, centred |
| group | `['group', at, rot, [parts]]` | parts moved and turned together |

Every part takes `{ rot }`: a yaw in degrees, or [x, y, z] degrees. Write arrays densely (`[0,0,8]`, not `[0, 0, 8]`):
spaces cost a third more tokens.

### Worked entries

```js
barrel: { about: 'oak barrel, two iron hoops', tags: 'container wood', mats: { w: 'oak', h: 'iron' },
  parts: [['lathe','w',[0,0,0],[[0,0],[5,0],[6,3],[6.5,8],[6,13],[5,16],[0,16]]], ['row',2,[0,0,9],['cyl','h',[0,0,7.5],6.5,1.5]]] },
crate: { about: 'wooden crate, framed and braced', tags: 'container wood', mats: { c: 'crate' }, parts: [['box','c',[0,0,0],[15,15,14]]] },
table: { about: 'plank table, four legs', tags: 'furniture tavern', mats: { t: 'oak', l: 'walnut' },
  parts: [['box','t',[0,0,10],[24,14,2]], ['mirror','xy',['box','l',[10,5,0],[2,2,10]]]] },
chest: { about: 'oak chest, round lid, iron bands', tags: 'container treasure', mats: { w: 'oak', b: 'iron', l: 'gold' },
  parts: [['box','w',[0,0,0],[16,10,8]], ['prism','w',[0,0,8],[[-5,0],[5,0],[4,3],[0,5],[-4,3]],16,{axis:'x'}],
    ['mirror','x',['box','b',[5.5,0,0],[1.5,11,8.5]]], ['box','l',[0,5,5],[3,1,3]]] },
lamppost: { about: 'iron street lamp, glowing head', tags: 'town light', mats: { m: 'iron', g: 'flame' }, lights: [[0,0,40,'#ffd070',70]],
  parts: [['cyl','m',[0,0,0],2.5,3], ['cyl','m',[0,0,3],1,34], ['box','g',[0,0,37],[4,4,5]], ['cyl','m',[0,0,42],3.5,3,{r2:0,seg:4}]] },
fence: { about: 'rail fence, len long (16)', tags: 'village farm', mats: { w: 'oak' }, params: { len: 16 },
  make: p => [['mirror','x',['box','w',[p.len / 2 - 1,0,0],[2,2,12]]], ['row',2,[0,0,5],['box','w',[0,0,6],[p.len - 2,1,1.5]]]] },
```

A generator seeds its noise from its params (`E.rng(seed)`), never `Math.random`, so it draws the same pixels everywhere.

## Make one: the recipe

1. **Read this card whole.**
2. **Find** the nearest entry: `node tools/asset-find.mjs "tavern table"` searches the core library and the store's sets
   (`src/assets/sets/`, about a thousand objects, materials and sprites converted from CC0 libraries, each with where it
   came from) and `--show set:id` prints one; the Asset Lab (`/asset-lab`) shows them all.
3. **Copy** it and change its names, parts and materials, or write a new one from the parts above. Give the cue a player
   knows it by parts of its own (a skep's coils as stacked rings, an anvil's horn, a barrow's open tub dark inside), and
   keep small parts plain ('none', 'glaze'): a busy pattern on a part a few pixels wide reads as speckle.
4. **Look:** `node tools/asset-sheet.mjs mine.js#stool` (a file that sets `E.SHAPES.stool`, or a store set; a core id
   alone works too: `node tools/asset-sheet.mjs barrel`). It draws `check-output/asset-sheet/stool.png`: every view and
   four facings, beside the hero, on a light and a dark floor. It lints what reads badly: too small from above, a part
   under a pixel, too few tones, low contrast with the floor, its tokens. Read the picture, fix, repeat.
5. **Use** it: `E.SHAPES.stool = {...}` and `r.shape('stool', ...)`; or a set file
   (`(window.ASSETS = window.ASSETS || {}).MINE = { set: 'MINE', format: 1, materials, shapes }`) and
   `E.addAssets(window.ASSETS.MINE)`, which names its entries 'MINE:stool' so they never collide, and returns the names.
   A store set loads the same way (its script, then `E.addAssets(window.ASSETS['kenney-furniture'])`);
   `node tools/asset-set.mjs <sets> --ids a,b --name mine --out mine.js` cuts the few a game uses, with what they need
   (Emberdeep's set dressing loads `src/assets/sets/emberdeep.js`, cut so).

## Limits

- Still objects. Lids that open, swinging signs and held weapons are code (or props) for now.
- A shape sorts by one point, as props do; a long one (a bed, a cart) may cross a body walking right beside it.
- Collision is the footprint's box, turned with the shape, and the bounds' height: a table is solid under its top too.
- Bigger than about 240 pixels on screen, a shape skips the actors' effects (flash, x-ray).
