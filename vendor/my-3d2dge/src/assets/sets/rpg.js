/* rpg: a set of my-3D2dge's asset store (written by tools/asset-*.mjs; entries may be edited by hand).
 * The RPG battle starter's broken column on the plaza (src/starter/40-rpg.js)
 * 1 shapes, 1 materials, 0 sprites. docs/ASSETS.md is the format; docs/ASSET-IMPORT.md how it was made.
 * "sources" records each download (its url, date, sha256 and license); an entry's src names its download, orig the file in
 * it, and fit how close it is: a shape's silhouette IoU at game scale (mean and worst view) and color dE.
 * Load it with E.addAssets(window.ASSETS['rpg']): its ids become 'rpg:id'. */
(window.ASSETS = window.ASSETS || {})['rpg'] = { set: 'rpg', format: 1, credit: 'The RPG battle starter\'s broken column on the plaza (src/starter/40-rpg.js)',
sources: {'kenney-nature':{label:'Kenney Nature Kit',origin:'Kenney (kenney.nl), nature-kit',license:'CC0 1.0',url:'https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip',page:'https://kenney.nl/assets/nature-kit',fetched:'2026-10-14',sha256:'fa7974a0d342bfe63c38664ba9f8ec1a4aab8ea25f099bdc56870e33588c4d9d',licenseHash:'cb96b75e3560ac78',dir:'nature-kit',scale:2.2,factors:'srgb'}},
materials: {
'ice-e': '#add2d8 noise'},
shapes: {
'statue-column-damaged': {about:'broken grey stone column, jagged top',tags:'ruin column temple',mats:{a:'ice-e'},parts:[['box','a',[0,0,0],[12,12,6]],['box','a',[0,0,6],[10,10,1]],['box','a',[0,0,7],[8,8,11]],['box','a',[-3,-3,18],[2,2,7]],['mirror','y',['box','a',[3,3,18],[2,2,4]]],['box','a',[-3,3,18],[2,2,5]]],src:'kenney-nature',orig:'Models/GLTF format/statue_columnDamaged.glb',fit:{iou:0.9,worst:0.86,dE:8}}},
sprites: {
}};
