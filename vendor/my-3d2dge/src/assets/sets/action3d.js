/* action3d: a set of my-3D2dge's asset store (written by tools/asset-*.mjs; entries may be edited by hand).
 * The 3D action starter's barrels in the hall (src/starter3d/10-action.js)
 * 1 shapes, 2 materials, 0 sprites. docs/ASSETS.md is the format; docs/ASSET-IMPORT.md how it was made.
 * "sources" records each download (its url, date, sha256 and license); an entry's src names its download, orig the file in
 * it, and fit how close it is: a shape's silhouette IoU at game scale (mean and worst view) and color dE.
 * Load it with E.addAssets(window.ASSETS['action3d']): its ids become 'action3d:id'. */
(window.ASSETS = window.ASSETS || {})['action3d'] = { set: 'action3d', format: 1, credit: 'The 3D action starter\'s barrels in the hall (src/starter3d/10-action.js)',
sources: {'kenney-mini-dungeon':{label:'Kenney Mini Dungeon',origin:'Kenney (kenney.nl), mini-dungeon',license:'CC0 1.0',url:'https://kenney.nl/media/pages/assets/mini-dungeon/6cd72dc849-1785314274/kenney_mini-dungeon.zip',page:'https://kenney.nl/assets/mini-dungeon',fetched:'2026-10-14',sha256:'19c4648680cb1d2e8836cade96cbf9781c0c1f45fbc6d2ce41cee8239a3ec4d8',licenseHash:'f8b470068a1c0438',dir:'mini-dungeon',scale:2.5,factors:'srgb'}},
materials: {
steel: '#9da4c5 metal',
'clay-b': '#ca704e planks bw=3'},
shapes: {
barrel: {about:'squat wooden barrel, two wide blue-grey iron hoops',tags:'container dungeon tavern',mats:{a:'steel',b:'clay-b'},parts:[['lathe','b',[0,0,0],[[0,0],[8,0],[10,5.5],[10,13.5],[8,19],[0,19]]],['lathe','a',[0,0,3.8],[[0,0],[10.5,0],[10.5,4],[0,4],[0,7.5],[10.5,7.5],[10.5,11.5],[0,11.5]]]],src:'kenney-mini-dungeon',orig:'Models/GLB format/barrel.glb',fit:{iou:0.92,worst:0.91,dE:4}}},
sprites: {
}};
