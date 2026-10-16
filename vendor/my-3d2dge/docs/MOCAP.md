# Importing ready-made animation

my-3D2dge animates with code, but its rigs can also play animation made for 3D games. Imported animation is stored in one format that both people and AI models can read and edit: **readable key poses**, plain JSON with whole numbers (below). It is organised in **sets**:

- **QUATERNIUS** (`src/mocap/sets/quaternius.js`): every free clip of [Quaternius' Universal Animation Library 1](https://quaternius.com/packs/universalanimationlibrary.html) and [Library 2](https://quaternius.com/packs/universalanimationlibrary2.html) (both CC0). 88 clips: 45 from the first library plus its T-pose, and 42 from the second. It is the library a game or a model picks from.
- **MESH2MOTION** (`src/mocap/sets/mesh2motion.js`): the human animations of [Mesh2Motion](https://github.com/Mesh2Motion/mesh2motion-app) (CC0), from three origins:
  - 86 of Quaternius' clips as Mesh2Motion re-exported them (one defective copy is skipped);
  - 75 clips its contributors animated (ladder, wall and pipe climbs, ledge hang, bow, backflip, dodges, crawling, flying, dances, emotes, deaths);
  - 16 it motion-captured itself with a Sony mocopi suit (fishing, golf, cheers, salutes, turns).

  That makes 177 clips, and every one records which origin it came from (see [Where each clip came from](#where-each-clip-came-from)).
- **CMU** (`src/mocap/sets/cmu.js`): 60 moments cut from the [CMU Graphics Lab Motion Capture Database](http://mocap.cs.cmu.edu/) (2,548 takes, free for all uses), picked for what a game like Emberdeep needs: gaits (run, sneak, limp, clutching the stomach, crouched, backwards, a one-foot hop, each one cycle looping in place), traversal (a skid stop, a jump over, a dive roll, ducking under), fighting (a punch combination, blocks, karate front, roundhouse and side kicks, stepping punches, a jab, a sword lunge, a spinning jump kick), falls and three ways of getting up, townsfolk at work (sweeping, washing a window, chopping wood, digging, raking, fishing, drinking, lifting and carrying boxes, sitting down), gestures (a wave, a shrug, a stretch and yawn, a curtsey, waiting, looking about, a handshake), monsters acted by people (a zombie, a gorilla, Frankenstein's monster, a robot, a monkey, a bear, a dragon, a ghost, a chicken) and acrobatics (a cartwheel, a backflip, a spin jump, a breakdance helicopter). Every clip records its take and the seconds it came from. Every take of the database is converted, measured and listed in the ledger, `src/mocap/catalogs/cmu-takes.tsv`, with the next ones to import marked `pick` (see [Importing from CMU](#importing-from-cmu-step-by-step)).
- **HERO** (`src/mocap/sets/hero.js`): the 15 clips Emberdeep's hero, the Wanderer, has adopted (see [The hero's clips](#the-heros-clips-in-emberdeep)): 8 from QUATERNIUS and 7 from MESH2MOTION, picked with `tools/anim-set.mjs`. It is the only set the game ships.

`examples/mocap-lab.html` plays any of the sets (**G** switches) on two figures:

- **a look-alike of the libraries' mannequin**: an orange figure with an egg-shaped head and purple joint rings. Its proportions and limb thickness are measured from the first library's own mesh.
- **the engine's hero** (the Emberdeep swordsman, an HD `Humanoid`), playing the same clip retargeted to his chibi build. His cape and hair follow, and in sword clips his blade follows his fist.

Both work in every view, at any camera turn or zoom, in slow motion and frame by frame.

To bring in another library, follow [Adding a library, step by step](#adding-a-library-step-by-step); [Where to get more animation](#where-to-get-more-animation) lists the sources, what they cost and what each one takes.

## Pipeline

```
.blend / .fbx / .bvh ──tools/to-glb.py──▶ .glb
CMU takes (.asf + .amc) ──tools/cmu.mjs get──▶ .cache/cmu ──tools/anim-import.mjs --cmu──▶ src/mocap/sets/cmu.js
libraries (.glb) ──tools/anim-import.mjs──▶ src/mocap/sets/quaternius.js ──tools/anim-set.mjs──▶ src/mocap/sets/hero.js
                                                     │                                                    │
                                                     └──────────── Mocap.load(set) ◀──────────────────────┘
                                                                        │
                                              lib.sample(clip, t) ──▶ Mannequin.draw / Mocap.drive(humanoid)
```

1. **Import** (Node, no dependencies):

   ```
   node tools/anim-import.mjs UAL1.glb UAL2.glb --sources UAL1,UAL2 --name QUATERNIUS \
     --catalog src/mocap/catalogs/quaternius.json --out src/mocap/sets/quaternius.js
   ```

   (`npm run mocap:import -- ...`; `--list` prints a file's clips and bones and writes nothing; `--clips A,B` imports only those; `--tol 30` is the key-pose budget in mm.) For each library it:
   - recognises the rig: Rigify `DEF-` bones (Library 1) or Unreal-style names (`pelvis`, `spine_01`, `upperarm_l`; Library 2);
   - measures the rest body from the T-pose, finds forward and right (heels to toes, left thigh to right), and fits how that library's animators share a turn of the hips-to-chest between the spine bones (Library 1: 0, 0, 0.25, 1; Library 2: 0, 0, 0.55, 1);
   - samples every clip at 30 fps, runs forward kinematics to 36 body points, turns each frame into a readable pose, and keeps only the key poses needed to stay within the budget (`fit`);
   - takes each clip's tags and description from the catalog, written by hand from watching each clip.

   A clip whose name is already in the set (from an earlier library) is skipped, and a clip with no catalog entry is reported.
2. **Pick a set for a game**: `node tools/anim-set.mjs src/mocap/sets/quaternius.js --clips Death01,LayToIdle --name HERO --out src/mocap/sets/hero.js --credit "..."` (`npm run mocap:set -- ...`) copies those clips, key for key, with the proportions of the libraries they came from.
3. **The set file** is one script that sets `window.MOCAP[name]` and needs no network. Its header comment carries the credit and the legend, so a model that opens the file can read it at once:

   ```
   (window.MOCAP = window.MOCAP || {})["HERO"] = {
   "set": "HERO", "format": 1, "credit": "...", "from": "QUATERNIUS", "fps": 30,
   "sources": { "UAL1": { "file": ..., "rig": "rigify", "rest": {...} }, "UAL2": {...} },   // the bodies the clips were measured on
   "body": { "height": 1829, "segs": [...], "bands": [...] },                              // the mannequin's measured mesh
   "fit": { "Death01": [10, 71], ... },                                                    // average and worst error vs the capture, mm
   "clips": { "Death01": { "clip": "Death01", "src": "UAL1", "dur": 2.4, "loop": false, "tags": ["death"],
                           "desc": "staggers and falls flat on the back", "keys": [ ...key poses... ] }, ... } };
   ```

   | Set | Clips | Key poses | Size | Gzipped | As tokens |
   |---|---|---|---|---|---|
   | QUATERNIUS | 88 | 1,295 | 378 KB | 72 KB | ~190k for all; a typical clip ~2,100 |
   | MESH2MOTION | 177 | 2,798 | 800 KB | 155 KB | ~400k for all |
   | CMU | 60 | 2,376 | 705 KB | 162 KB | ~360k for all |
   | HERO | 15 | 238 | 74 KB | 17 KB | ~34k |

   For comparison, the old raw form (every frame of the first library's 46 clips as base64 Int16) was 591 KB, 232 KB gzipped, and unreadable.
4. **Play**: `const lib = Mocap.load(window.MOCAP.HERO)`. Then:
   - `lib.clip(name)` returns the clip;
   - `lib.sample(clip, t)` returns the pose at time t, in-betweening the key poses (loops wrap, one-shots hold their last pose);
   - `lib.moveAt(clip, t)` returns how far a travelling clip has carried the body;
   - `lib.blend(a, b, k)` crossfades two poses;
   - `lib.text(clip)` gives the clip as a model reads it;
   - `lib.replace(name, edited)`, `lib.restore(name)` and `lib.edited(name)` swap in an edited clip and back.

   `src/mocap/readable.js` (`MocapReadable`) holds the format itself, shared by the browser and the Node tools.
5. **Draw or drive**:
   - `new Mocap.Mannequin(lib, { height }).draw(g, ox, oy, view, pose, facing)` draws the look-alike. It is built from shaded capsules sorted by camera depth, the way the engine's HD rigs are drawn.
   - `Mocap.drive(humanoid, lib)` makes a `Humanoid` take `rig.mocap = pose` after it poses itself.

## Adding a library, step by step

This is the whole process of translating a 3D animation library into our format. Each step names its tool. Everything runs in Node, except the conversion from Blender, FBX or BVH files.

**1. Check the license.** The converted set is committed to this public repository and ships inside games, so the source must allow sharing derived data.
- CC0 is ideal.
- CC BY works, with the credit in the set (`--credit`) and the README.
- "No derivatives", "non-commercial" and Mixamo-style terms are out.

See [Where to get more animation](#where-to-get-more-animation).

**2. Get the files to where the tools run.** Keep source files out of this repository: Library 1 Pro is 41 MB, and only the converted set is committed.
- **On your machine:** anywhere on disk.
- **In a Claude Code cloud session:** put the zip in a private GitHub repository the session can add, or give a direct download link. A repository is the simplest channel for a 40–50 MB file. The Google Drive connector cannot carry files this large.

**3. Convert to GLB, if it isn't one.** `tools/anim-import.mjs` reads glTF binary only. `tools/to-glb.py` converts `.blend`, `.fbx` and `.bvh` files with Blender's Python module, so no Blender install is needed:

```
python3 -m venv /tmp/bpyenv && /tmp/bpyenv/bin/pip install bpy              # once: bpy 5.x needs Python 3.11 (about 1 GB)
/tmp/bpyenv/bin/python tools/to-glb.py library.blend library.glb --list     # what is inside: armatures, meshes, actions
/tmp/bpyenv/bin/python tools/to-glb.py library.blend library.glb
```

- Every action in the file becomes one clip.
- A Rigify source file also carries control bones; `--deform-only` keeps only the `DEF-` bones the importer maps.
- A file without a skinned mesh (a `.bvh`, or a `.blend` that links its mesh from another file) still imports. The mesh only shapes the look-alike mannequin.

**4. Inspect it.** `npm run mocap:import -- library.glb --list` prints the rig it recognises, the clips and the bones, and writes nothing.
- **`rig rigify` or `rig unreal`:** go on to step 5.
- **`rig not recognised`:** add the skeleton to `RIGS` in `tools/anim-import.mjs`.
  - A map names the bone for each body point: the pelvis, the spine and chest, the neck and head, and per side the collarbone, upper arm, forearm, hand, index, middle and pinky knuckles, thigh, shin, foot and toes.
  - Bone names match whatever their case.
  - Once the map is in, a contact sheet (step 7) and the fit (step 6) show whether it is right.

**5. Import into a set.** Use one set per source family (QUATERNIUS, MESH2MOTION...), so each keeps its own credit:

```
npm run mocap:import -- ual1-pro.glb ual2-source.glb --sources UAL1,UAL2 --name QUATERNIUS \
  --catalog src/mocap/catalogs/quaternius.json --out src/mocap/sets/quaternius.js
```

- **Order matters.** A clip whose name an earlier file already took is skipped. A bigger edition of a library (Library 1 Pro also holds the Standard clips) goes in place of the smaller one, not after it.
- **The rest pose.** Each library's body is measured from its T-pose or `Rest Pose` clip, and `--rest` names another (one per file, comma-separated). Without one, the importer uses the first clip's first frame. That still gives the right proportions, but it tilts the reference posture if that clip starts bent. On Mesh2Motion's addon clips, measuring from the right rest pose cut the average error from about 32 mm to 19.
- **Options.** `--tol` (default 30 mm) is the key-pose budget; `--clips A,B` imports only those clips.

**6. Read the fit.**
- The importer prints, for each library, the spine shares it fitted.
- The set records each clip's average and worst error against its capture (`fit`). Our sets average 14 to 16 mm; one pixel is about 24 mm at the default zoom.
- `npm run test:mocap` fails a clip that averages over 40 mm or reaches 300 mm at worst, and a set that averages over 20 mm.
- Look at the clips over 30 mm in the lab. The usual culprits are known limits of the format:
  - hard wrist bends: the format treats the hand as a straight continuation of the forearm;
  - a spine curled into a C (a crouched sneak, a roll on the ground): the chest's turn is shared along the spine in fixed proportions.
- A clip that reads wrong goes in the catalog's `"$skip"` with the reason, so it is left out on the record.

**7. Write the catalog.** A model picks clips by their one-line descriptions, so every clip needs one, written from watching it.

```
npm run mocap:sheet -- src/mocap/sets/quaternius.js --uncataloged src/mocap/catalogs/quaternius.json
```

- This draws contact sheets into `check-output/anim-sheets/`: each clip the catalog lacks, as a row of eight frames from start to end.
- For each clip, add `"Name": ["tags", "what the body does"]` to the catalog, then import again so the words go into the set.
  - A third element, `"SET/clip"`, names the clip it was made from when it is a copy or an edit of another set's clip.
  - The catalog's `"$sources"` says where each library came from, and `"$skip"` lists the clips left out, with the reason (see [Where each clip came from](#where-each-clip-came-from)).
- **Tags** are lowercase words the lab groups by: idle, walk, run, crouch, crawl, strafe, turn, jump, dodge, climb, slide, fly, attack, stance, block, shield, sword, unarmed, magic, gun, bow, throw, kick, hurt, death, getup, interact, work, item, chest, carry, eat, farm, fish, sport, talk, emote, gesture, dance, cheer, exercise, sit, rest, lie, swim, zombie, reference. Add any others that help a search (air, prop, root-motion).
- **`loop` and `once`** in the tags say whether the clip loops, for libraries whose names don't (Quaternius ends looping clips in `_Loop`; Mesh2Motion doesn't). The importer takes them out of the tags.
- **Describe the body, not the intent.** "Bends forward and lifts a chest's lid with both hands" is something a model can match to a moment in a game.

**8. Add it to the lab.** Add one line to `src/mocap.template.html`, next to the other sets: `<!-- @inline src/mocap/sets/mesh2motion.js -->`. The lab makes a button for every set it carries, and `tools/mocap-test.mjs` checks every one. Then run `npm run build` and look through the clips.

**9. Test and commit.** Run `npm test`. Commit the set and the catalog, never the source files, and add the source and its license to the table below.

**10. Use it in a game.** A game ships only the clips it plays: `npm run mocap:set` picks them into a small set (as the hero's), and the game inlines that set. The picked clips keep their `src` and `orig`, and the set keeps their libraries' records.

### Importing from CMU, step by step

The [CMU database](http://mocap.cs.cmu.edu/) holds 2,548 takes by more than 100 people: walks in every style, runs, dances, sports, martial arts, acrobatics, playground games, everyday chores, people acting animals. It is "free for all uses", and the data "may be copied, modified, or redistributed without permission". Takes are raw: recordings of one action or several, so each clip is a stretch cut from one.

**All of it, and the ledger.** Every take has been downloaded, converted and measured, and the results are kept in **`src/mocap/catalogs/cmu-takes.tsv`**: one line a take with its category, its length, the stretch where it moves, how closely the readable format keeps to it, how far it travels, how low and high the hips go, its flags (upside down, off the floor, loose, short, undescribed) and which clips of the CMU set use it. A `note` column is yours: `pick` (next to import), `skip: why`. To do it again on another computer:

```
node tools/cmu.mjs all       # the site's 1 GB archive, unpacked: 2,548 takes, 3.3 GB in .cache/cmu (not committed)
node tools/cmu.mjs survey    # converts and measures every take (about 10 minutes) and rewrites the ledger, keeping the notes
node tools/cmu.mjs ledger combat --status none --top 20   # query it: a category or words, and none | used | pick | skip
```

**Every take in the lab.** `node tools/cmu.mjs library` writes the whole database to `examples/cmu-lib/` for the mocap lab's **CMU library** (`mocap-lab.html?set=library`): one set file a subject, long takes in 10-second parts, and an index of every take by category. It is fitted within 50 mm instead of 30 (about 65 MB of text, 15 MB as served compressed, instead of 92), because it is for browsing: a take picked for a game is cut again, at 30 mm, into the CMU set. The lab loads the index when the library opens and a subject's file (17 KB to 2.6 MB) when one of its takes is picked; the page itself stays the same size. The contact-sheet tool reads the library's files like any set, so `--every 0.5` on one shows a whole take to choose the seconds from.

**1. Find takes.** The ledger is the quickest: `node tools/cmu.mjs ledger getup` lists the takes in a category or with the words, with their length, active stretch, fit and flags. `node tools/cmu.mjs find cartwheel` searches the site's own index (2,435 takes listed, downloaded once to `.cache/cmu/index.tsv`; the archive also holds 113 takes the site never described, in the ledger as `fps?`). `node tools/cmu.mjs subject 13` lists one subject's takes. (`npm run mocap:cmu -- find kick`.)

**2. Pick a stretch.** Import the whole take once to look at it: a catalog whose `"$pick"` names it, then a contact sheet with a frame every half second, each marked with its time:

```
{ "$pick": { "T13_29": ["13_29"] } }
node tools/anim-import.mjs --cmu --catalog check-output/cmu/look.json --name CMU --out check-output/cmu/look.js
node tools/anim-sheet.mjs check-output/cmu/look.js --every 0.5 --frames 16 --out check-output/cmu
```

Narrow it with `--every 0.1` around the moment. When the frames are too small to judge (a fast move like a jumping jack), measure it instead: `tools/asf-amc.mjs` exports `readAsf`, `readAmc` and `pose`, which give every bone's position frame by frame (hands above the head, feet apart, hips height).

**3. Write the catalog** (`src/mocap/catalogs/cmu.json`):
- `"$sources"`: one `"CMU"` record (label, origin, license, url); the importer copies it for each subject, naming the subject and linking its page.
- `"$pick"`: each clip's take and the seconds to keep, `"Cartwheel": ["49_06", 1.0, 3.6]` (no end: to the end of the take). The take alone, `"Wave_Hello": ["141_16"]`, keeps the stretch where it moves, from the ledger: enough for a take of one action.
- an entry per clip, `[tags, what the body does]`, as for any library. The tag `loop` asks for a loop.

**4. Import:**

```
node tools/anim-import.mjs --cmu --catalog src/mocap/catalogs/cmu.json --name CMU --title CMU \
  --credit "CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), free for all uses; ..." --out src/mocap/sets/cmu.js
```

It downloads the takes it needs (to `.cache/cmu`, not committed), reads each subject's skeleton and each take, and fits the picked stretches like any other clips. On the way it:
- **places the body points** on CMU's bones by forward kinematics (pelvis, spine, neck, head, collarbones, arms, the knuckle line, legs, feet), at 30 fps from the take's 120 or 60;
- **turns each clip to face forward and start at the origin**, from the hips' heading at its first frame;
- **finds the floor** (the height the lowest foot point keeps most often over the subject's takes), so standing hips read as 100;
- **cuts loops**: for a clip tagged `loop` it searches the stretch for the cycle whose end best matches its start, in pose and in speed, among spans that keep moving (a pause matches itself perfectly). It prints the cycle and how far its seam is off, spreads that remainder over the cycle so the loop closes exactly, and plays it in place, facing the way it travels, with the hips' sway kept.

**5. Check.** `npm run mocap:sheet -- src/mocap/sets/cmu.js` for the contact sheets, the lab (`?set=cmu`) to play each clip on both figures, and `npm test`. The lab names each clip's take ("From CMU motion capture, subject 49 (modern dance, gymnastics) (free for all uses ...), take 49_06 at 1.00 to 3.60 s").

What the first nine showed (and the next 51 bore out):
- **Accuracy:** 10 to 24 mm from the capture on average (Quaternius: 14); 18 mm across all 60 clips, and 17 mm across all 2,548 takes. 56 takes fit looser than 30 mm (fast acrobatics, hard-bent wrists).
- **The loops:** the walk's cycle closed within 23 mm; the boxer's guard bounce, which is not strictly periodic, within 92 mm, then exactly after spreading.
- **What needed fixing on the way:** the first loop search picked a pause in the jumping jacks (now refused); the first floor estimate, a low percentile of foot heights, caught a landing's dip and put one subject's standing hips at 112 (now the most common height).
- **The next 51:** a take's description is a hint, not a promise: "Looking Around" was crouched searching the ground (it became `Search_Ground`), a "Robot" walk stood still for nine seconds, a "JumpTwist" fell into breakdancing, a duck ended lying down. A contact sheet of every new clip (`npm run mocap:sheet`) caught each one; a frame every half second of the whole take (`--every 0.5` on the converted library) showed the seconds to cut instead. Gaits whose feet meet between steps (a limp, a robot) match themselves after one step, which would always lead with the same foot: a loop pick's fourth number sets the shortest cycle, `["139_19", 3, 8, 0.9]`.

### Where each clip came from

Every set records the origin of every clip, so a clip's history survives being copied into another set or edited by a model:

- **`sources`**: one record per library the set was imported from. It gives the `file` and `rig`, plus a `label`, `origin`, `license` and `url`, written by hand in the catalog's `"$sources"`.

  ```
  "M2M_QUATERNIUS": { "label": "Quaternius, via Mesh2Motion", "origin": "Quaternius' Universal Animation Library 1 and 2
     as Mesh2Motion re-exported them ... Library 1's clips run 25% longer than in Quaternius' own files ...",
     "license": "CC0 1.0", "url": "https://github.com/Mesh2Motion/mesh2motion-app" }
  ```
- **`src`** on each clip: the library it came from (the key into `sources`).
- **`orig`** on a clip that is a copy or an edit of another set's clip: that clip, as `SET/clip`. Mesh2Motion's `Walk` says `"orig": "QUATERNIUS/Walk_Loop"`.
- **`take`** on a clip cut from a motion capture database: the recording and the seconds used, as `"13_29 2.30-3.42"` (CMU subject 13, take 29, from 2.30 s to 3.42 s). Each CMU subject is its own library (`CMU_13`), and its record names the subject and links its page.
- **`"$skip"`** in the catalog: the clips left out on purpose, each with the reason.

How Mesh2Motion's origins were established:
- **Its base clips:** each was matched to a Quaternius clip by motion, with every frame of both compared after scaling to the same length.
  - 77 match their same-named or renamed Quaternius clip closely. 8 more are Quaternius' clips with small edits (trimmed, or ending back on their feet). All 84 kept carry an `orig`.
  - Two (`Death_D`, `Hit_Chest`) differ from every free Quaternius clip, so they carry the library but no `orig`.
  - Mesh2Motion's copy of `Sword_Regular_A_Rec` whips the body round in its last frames, so it is skipped: Quaternius' own clip is in the Quaternius set.
- **Its hand-animated clips:** each has its own Blender file in [mesh2motion-assets](https://github.com/Mesh2Motion/mesh2motion-assets) (`rigs/human`).
- **Its motion captures:** the raw mocopi BVH files and the retargeting add-on are in the same repository (`motion-capture`).

The lab shows the origin under each clip's name ("From Quaternius, via Mesh2Motion (CC0 1.0), made from QUATERNIUS Walk_Loop"), and the catalog adds the library to each line. `tools/mocap-test.mjs` fails a clip whose library has no origin or license on record, or whose `orig` names a clip that doesn't exist.

**What it costs:**
- every 100 clips adds about 450 KB to the lab (85 KB gzipped);
- a model reading one clip spends about 2,200 tokens;
- the catalog grows by about 30 tokens per clip.

## Retargeting onto a Humanoid

The hero's skeleton is 15 points with fixed bone lengths. The source's skeleton is a real adult's. `Mocap.drive` keeps the hero's build and borrows the clip's directions:

- **Hips:** height scaled by the ratio of the two hip heights. The pelvis takes the clip's left-to-right axis.
- **Spine, shoulders, head:** each takes the clip's direction at the hero's own length (`torso`, `shoulderHalf`, `neck + headR`).
- **Feet and hands:** placed in proportion to the leg and arm lengths, then solved with the engine's two-bone IK (`E.ik3`). The knee and elbow bend the way the clip's do. The sole, not the ankle, meets the floor.
- **Turning:** the rig turns to wherever the clip's chest faces, flat on the floor (`rig.spin`), and reads the clip in that turned frame. A spinning kick turns his face, hair, cape and belt buckle round with him, not just his limbs. A chest that faces up or down (lying, bent double) has no heading to trust, so the rig keeps facing ahead.
- **Tilting:** the details the rig draws around its joints (the face, hair, belt, toes) follow the clip's chest and head (`rig.mocapTilt`, read by `Humanoid._offsets`). He goes upside down in a cartwheel, rolls and leans with the body, and bows his head when the clip does. Each tilt is measured from the clip's own library's rest pose, so a head that a library holds slightly forward at rest still reads level.
- **Sword:** with `rig.mocapBlade = true`, it runs along the knuckles (pinky to index), the way a blade sits in a fist. Otherwise it keeps the rig's own angle, and as the body goes down it drops flat on the floor beside the hand. Either way the blade never goes through the floor: with the hands planted (a cartwheel, a crouch, harvesting) it lowers no further than to lie along it.
- **Lying down:** the rig's knocked-down measure (`downW`) follows the clip's torso, for the game to read (shadows, what a body on the floor can do).
- **Blending:** `rig.mocapW` (0 to 1) fades a clip in and out over the rig's own animation; `rig.mocapMask = 'upper'` plays only the chest, head and arms over the rig's own legs (reaching for loot while walking).

## The readable format (for AI models)

Each key pose names what an animator would, as three lines (torso, arms, legs) of whole numbers:

```
{"t":0.13,
   "hips":[-2,-2,90], "body":[14,-25,1], "chest":[-2,43,6], "head":[-10,11,-1],
   "shL":[16,5], "shR":[-6,-1], "armL":[60,-44,66,132,155], "armR":[84,-27,47,133,-157],
   "legL":[-35,14,-93,44,6], "legR":[-66,19,-72,28,-32], "footL":[25,11,0], "footR":[20,44,-1]}
```

- **hips:** the pelvis, in percent of standing hip height.
- **body, chest, head:** turn, lean and tilt in degrees, each relative to the part below it.
- **shL, shR:** how far each shoulder swings forward and shrugs up, in degrees.
- **arms and legs:** `[forward, out, up, bend, twist]`:
  - the first three give the direction from the shoulder to the fist (or the hip to the ankle), as percentages;
  - bend is the elbow or knee in degrees (0 = straight);
  - twist is how far the elbow or knee swings round from its natural direction.
- **feet:** `[down, out, toes]` in degrees.
- **blade** (sword clips only): the direction of the blade. **root** (clips that travel): how far the body has moved.

The legend that explains it costs about 450 tokens and is read once. It is in every set file's header and in `MocapReadable.LEGEND`.

Why it is shaped this way:

- **Limbs are directions plus a bend, not joint angles.** An arm swinging through straight down has no angle that flips, and a bend in degrees is well conditioned: storing reach as a fraction moved a nearly straight knee 56 mm per rounding step. It is also exactly what the engine's IK rigs consume.
- **It does not depend on body size,** so the same clip fits the chibi, heroic and bulky builds, and the two libraries' different skeletons.
- **"out" is mirror-friendly,** so `mirror()` swaps L and R and flips the signs of turns and tilts.
- **Whole numbers are cheap.** In cl100k, `-0.35` costs several tokens and `-35` costs one or two. Named fields cost about a quarter more than bare rows, but they make edits safe ("which column was `legR`?").
- **The spine is fitted per library.** How much of the hips-to-chest turn each spine bone takes is measured from each library's clips at import, because a library's animators decide how the spine bends. Each clip names its source (`src`), and plays back with that library's spine.
- **Keys are chosen by the format's own error** (`fit`), and the fitter stops adding keys where the remaining error is the format's limit, not the in-betweening.
- **Numbers continue from key to key, so in-betweens never jump:**
  - **Twist:** measured from a reference carried smoothly from one rest direction to wherever the limb points. An earlier reference blended two fixed directions; where those faced apart it flipped, and in-betweens put the elbow on the wrong side.
  - **Turn, lean and tilt:** each has a second reading (turn + 180, 180 − lean, tilt + 180). The encoder takes whichever continues from the key before, so a body leaning past horizontal in a flip keeps leaning.
  - **Key times:** stored to the millisecond, so a key lands exactly on its frame.

The QUATERNIUS set stays 13.9 mm per body point from the capture on average, MESH2MOTION 16.1 mm (each clip's average and worst are in the set's `fit`). One pixel is about 24 mm at the default zoom. Its biggest misses are elbows and wrists when a wrist bends hard: the format treats the hand as a straight continuation of the forearm.

**The catalog.** A model picks a clip from one line per clip, never from motion data: `name | seconds | loop or once | tags | what the body does | library (= the clip it was made from)`. The QUATERNIUS set's 88 clips cost about 2,500 tokens, MESH2MOTION's 177 about 6,400; the lab's **Catalog** tab shows each set's. The words come from `src/mocap/catalogs/`. The model then opens only the clips it uses.

**Editing in the lab.** The **This clip as text** tab shows the current clip:
- **Apply** (Ctrl+Enter) plays an edit on both figures; **Reset** brings the imported clip back.
- **Mirror** swaps sides.
- **Copy for a model** copies the legend with the clip.
- A broken edit is rejected with the key and the missing field named.

To keep an edit, paste it into the set file: the clips there are the same text.

### How the format was chosen

Before the readable form became the committed one, the lab played one clip five ways side by side, measured over the first library's 46 clips:

| Stored as | Poses | Size, gzipped | Worst error | A model can read it |
|---|---|---|---|---|
| Captured: every frame, 30 fps | 2,078 | 118 KB | 0 mm | no (binary) |
| 15 fps: every second frame | 1,069 | 76 KB | 360 mm | no |
| Key poses, 10 mm budget | 905 | 78 KB | 10 mm | no |
| Key poses, 40 mm budget | 515 | 51 KB | 40 mm | no |
| **Readable key poses** | **615** | **31 KB** | 214 mm (about 12 mm on average) | **yes** |

Side by side in motion the readable version could not be told from the capture, so it became the only stored form. (Halving the frame rate was the wrong cut: no smaller than key poses at 10 mm, and it can skip a punch's moment of contact.)

## The hero's clips in Emberdeep

`src/emberdeep/96-hero-clips.js` plays the HERO set on the Wanderer, each clip at a moment his procedural animation had no answer for. The set is picked from two sets:

```
npm run mocap:set -- src/mocap/sets/quaternius.js src/mocap/sets/mesh2motion.js --name HERO --title Hero \
  --clips "QUATERNIUS:Death01,...,Land_Three_Point,Death_A,..." --out src/mocap/sets/hero.js --credit "..."
```

A name both sets have is picked as `SET:Clip`. Each clip keeps its `src`, so the hero's set still says where every clip came from.

| Moment | Clip | Library | When |
|---|---|---|---|
| death | `Death01` | Quaternius | A plain killing blow: a stagger back, then flat on his back. |
| worn down | `Death_A` | Mesh2Motion, hand-animated | The killing blow was a tick of poison, fire or bleeding: he clutches his chest and sinks onto his side (played 1.4× fast). |
| crushed | `Death_B` | Mesh2Motion, hand-animated | A crushing blow kills him (a knockdown, a boss, or half his life at once): thrown back off his feet. |
| get-up | `LayToIdle` | Quaternius | Revived (back in town, a retry, the developer's revive): he gets up off the ground. |
| landing | `Land_Three_Point` | Mesh2Motion, hand-animated | He drops in from above (every new depth, the waystone, the first arrival): a three-point landing, from the moment his feet touch. |
| nod, then listening | `Head Nod`, `Idle Listening` | Mesh2Motion, hand-animated | Someone talks to him: he nods, then listens, weight on one leg and a hand on the hip. |
| arms folded | `Idle_FoldArms_Loop` | Quaternius | A shopkeeper serves him. |
| open the stash | `Chest_Open` | Quaternius | The stash's panel opens: he turns to the chest, bends and lifts the lid. |
| use the waystone | `Interact` | Quaternius | The waystone's panel opens: he turns to it and works it with his hands. |
| pick up | `PickUp_Table` | Quaternius | Loot goes in his bag: a quick reach with the upper body, so he keeps walking. |
| heavy blow | `Hit_Chest`, `Hit_Head` | Quaternius | A hit for more than 12% of his life that does not knock him down: the upper body snaps back while his legs take the stagger. |
| boss victory | `Victory` | Mesh2Motion, hand-animated | A boss falls: he jumps with a fist raised. |
| level up | `Victory Fist Pump` | Mesh2Motion, hand-animated | He gains a level: a fist pump. |

- **The YOU DIED panel** waits until he is down, whichever fall plays (each death records the clip time by which it lands).
- **The two celebrations** wait up to 3 seconds for him to stand still, so they never cut into a fight.
- **Moving, rolling, attacking or a flinch** takes the body back at once: the clip fades out in a few frames.
- **Codex** has his own rig and plays none of them.
- **The gallery's POSES reel** plays each one: `#gallery/poses/captured-death`, `worn-down`, `crushed`, `captured-get-up`, `landing`, `head-nod`, `listening`, `arms-folded`, `open-the-stash`, `use-the-waystone`, `pick-up`, `hit-in-the-chest`, `hit-in-the-head`, `boss-victory`, `level-up`.

**To adopt another clip:**
1. Add it to the `anim-set.mjs` command above and run it again.
2. Give the clip a moment in `HCL_MOVES`, and a trigger.

## What the clips assume

- **In-place jumps.** `Jump_Start`, `Jump_Loop` and the `NinjaJump_*` clips keep the root on the floor while the feet point down. A game supplies the vertical arc. The lab lifts the figure until its lowest point touches the floor.
- **Props.** Sitting clips expect a chair, `PickUp_Table` a table, `Chest_Open` a chest, `Walk_Carry_Loop` a box, `Idle_Rail_*` a railing, `Farm_*` and `TreeChopping_Loop` their tools, `Driving_Loop` a seat and a wheel, the `Pistol_*` clips a gun, and the `Shield_*` clips a shield. The figures mime them.
- **Root motion.** The `_RM` clips (and the `Sword_Regular_*` combo, `Sword_Block`) move the root. The lab moves the figures and the camera follows.
- **Combos.** `Sword_Regular_A`, `B` and `C` are one combo's strikes, each with a recovery (`_Rec`) for when the chain stops; `Sword_Regular_Combo` is the whole chain.

## Limits

- **The hero's face and hair follow `facing`,** not the clip's head (see 3 above). The mannequin uses the clip's own face direction.
- **Fingers are not imported.** Hands are fists, which suits pixel art at this size.
- **Two bone maps, plus CMU:** Rigify `DEF-` bones and Unreal-style names (any case) in GLB files, and CMU's own skeleton files (ASF/AMC), which `tools/asf-amc.mjs` reads directly. Another skeleton (100STYLE's BVH) needs its own map in `tools/anim-import.mjs`; `tools/to-glb.py` already turns BVH and FBX files into GLB.
- **CMU's hands have one finger bone and a thumb.** The knuckle line is set across the hand toward the thumb, so a CMU fist turns with the wrist but never curls.
- **The mannequin's body is measured from the first library's mesh.** The second library's skeleton has the same proportions, so its clips play on the same figure.

## Where to get more animation

Prices and contents as of October 2026.

| Source | Humanoid clips | Cost | License | Files | In our pipeline |
|---|---|---|---|---|---|
| Quaternius Universal Animation Library 1, Standard | 45 + T-pose | free | CC0 | GLB | imported (QUATERNIUS) |
| Quaternius Universal Animation Library 2, Standard | 42 | free | CC0 | GLB | imported (QUATERNIUS) |
| [Library 1 Pro](https://quaternius.itch.io/universal-animation-library) | 120+ | $9.99 | CC0 | GLB, FBX | Drop-in: same skeleton as Standard. Import it in place of the Standard file. |
| [Library 2 Source](https://quaternius.itch.io/universal-animation-library-2) (Library 2 has no Pro tier) | 130+ | $14.99 | CC0 | .blend only | `tools/to-glb.py`, then import. Library 1's Source edition ($14.99) is the same route. |
| [Mesh2Motion](https://github.com/Mesh2Motion/mesh2motion-app) humans (`static/animations/human-*.glb`) | 178: 87 Quaternius clips re-exported, 75 hand-animated (climbs, ledge hang, bow, backflip, dodges, crawl, flying, dances, emotes), 16 of its own mocopi captures | free | CC0 | GLB | Imported (MESH2MOTION, 177 clips; one defective re-export skipped). 16.1 mm on average. |
| [CMU motion capture, retargeted by RancidMilk](https://rancidmilk.itch.io/free-character-animations) | 2,000+ | free | CMU's terms: use, change and share freely, credit mocap.cs.cmu.edu, never sell the data itself | FBX, on a Quaternius character | `tools/to-glb.py`; not tried yet. It needs a bone map if the rig is not one we read. |
| CMU raw ([mocap.cs.cmu.edu](http://mocap.cs.cmu.edu)) | 2,548 takes, about ten hours (the site lists 2,435: 2,109 at 120 fps, 326 at 60; its archive holds 113 more, undescribed) | free | "free for all uses"; "may be copied, modified, or redistributed without permission" | ASF/AMC (BVH conversions elsewhere) | **Imported (CMU), all of it surveyed**: `tools/cmu.mjs all` downloads every take, `survey` converts and measures each into the ledger, `anim-import --cmu` cuts the picked moments (loops cut to their best cycle). 60 in the CMU set, 17.8 mm on average. See [Importing from CMU](#importing-from-cmu-step-by-step). |
| [100STYLE](https://zenodo.org/record/8127870) | 100 walking and running styles | free | CC BY 4.0 (credit required) | BVH | Same route as raw CMU: a bone map, then cutting into loops. |
| Mixamo | thousands | free account | Adobe's terms forbid redistributing the animations in an editable form | FBX | No: a converted set in an open repository is exactly that. |
| Bandai Namco Research motion dataset | 3,000 | free | CC BY-NC-ND 4.0 | BVH | No: retargeting is a derivative. |

## Tests

`npm run test:mocap` (part of `npm test`) runs two checks.

`tools/mocap-test.mjs` plays every clip of every set the lab carries at four moments, on both figures and across all five views. It fails on any of these:

- a page error or engine warning;
- a pose or hero joint that is not a number;
- a figure that draws nothing, or a cast that draws the wrong number of figures;
- a foot under the floor;
- clip text that does not read back the same, or that is not restored by mirroring twice;
- a clip without a recorded fit, one more than 40 mm from its capture on average (300 mm at worst), or a set more than 20 mm on average;
- a clip whose library has no origin or license on record, whose `orig` names a clip that doesn't exist, or whose `take` is not a take and a stretch of seconds;
- a clip of a picked set (the hero's) that is not key for key the clip it was picked from;
- a broken edit accepted, or rejected without a clear message;
- an edit applied in the panel that does not play, or that Reset does not undo.

`tools/ed-clips-test.mjs` plays Emberdeep and checks each of the hero's moments: the stash (and that he turns to it), the waystone, a talk, walking off, loot, a heavy blow, death (the YOU DIED panel waits until he has landed, and he lies on his back), the get-up in town, and every gallery entry.
