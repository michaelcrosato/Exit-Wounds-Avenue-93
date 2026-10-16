Morrow Ward's district art is original procedural work in `src/world/district.js`.
It generates brick, concrete and asphalt maps from deterministic canvas drawing;
all street signs, facades, road markings, garage/shop/office interiors, overpass,
containers, cover, waterfront safety barriers and rain geometry are authored in
that module. There are no downloaded world textures or models.

`src/world/roads.js` contains the original street and pedestrian routes.
`src/world/interactions.js` contains the corresponding original place names,
interaction anchors and actor/vehicle placement.

Ambient residents use the pinned engine's Humanoid rig with the six original
outfit palettes in `src/world/pedestrians.js`. Ambient cars use the same original
vehicle visual and Rapier wheel implementation as the playable cars.

These original sources are included in this project; no separate reuse license is granted. Engine, Three and Rapier notices
remain separate in the root third-party notices and vendored dependency notices.
The root asset manifest records the source files and their final SHA-256 hashes.
