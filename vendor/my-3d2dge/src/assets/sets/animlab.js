/* animlab: a set of my-3D2dge's asset store (written by tools/asset-*.mjs; entries may be edited by hand).
 * The animation lab's spears (src/starter/60-animlab.js)
 * 1 shapes, 2 materials, 0 sprites. docs/ASSETS.md is the format; docs/ASSET-IMPORT.md how it was made.
 * "sources" records each download (its url, date, sha256 and license); an entry's src names its download, orig the file in
 * it, and fit how close it is: a shape's silhouette IoU at game scale (mean and worst view) and color dE.
 * Load it with E.addAssets(window.ASSETS['animlab']): its ids become 'animlab:id'. */
(window.ASSETS = window.ASSETS || {})['animlab'] = { set: 'animlab', format: 1, credit: 'The animation lab\'s spears (src/starter/60-animlab.js)',
sources: {'kenney-mini-dungeon':{label:'Kenney Mini Dungeon',origin:'Kenney (kenney.nl), mini-dungeon',license:'CC0 1.0',url:'https://kenney.nl/media/pages/assets/mini-dungeon/6cd72dc849-1785314274/kenney_mini-dungeon.zip',page:'https://kenney.nl/assets/mini-dungeon',fetched:'2026-10-14',sha256:'19c4648680cb1d2e8836cade96cbf9781c0c1f45fbc6d2ce41cee8239a3ec4d8',licenseHash:'f8b470068a1c0438',dir:'mini-dungeon',scale:2.5,factors:'srgb'}},
materials: {
steel: '#9da4c5 metal',
'clay-b': '#ca704e planks bw=3'},
shapes: {
'weapon-spear': {about:'upright spear, grey steel head, wooden shaft',tags:'weapon dungeon',mats:{a:'steel',b:'clay-b'},parts:[['prism','a',[0,0,0],[[-1.4,16],[-2.9,20],[-0.8,24],[0.7,24],[3,20],[1.5,16]],2.8,{axis:'y'}],['cyl','a',[0,0,12],2.7,4],['box','b',[0,0,0],[2.8,2.8,12]]],src:'kenney-mini-dungeon',orig:'Models/GLB format/weapon-spear.glb',fit:{iou:0.88,worst:0.82,dE:3}}},
sprites: {
}};
