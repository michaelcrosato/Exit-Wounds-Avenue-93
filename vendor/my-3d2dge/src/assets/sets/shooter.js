/* shooter: a set of my-3D2dge's asset store (written by tools/asset-*.mjs; entries may be edited by hand).
 * The shooter starter's hay in the fields (src/starter/30-shooter.js)
 * 2 shapes, 2 materials, 0 sprites. docs/ASSETS.md is the format; docs/ASSET-IMPORT.md how it was made.
 * "sources" records each download (its url, date, sha256 and license); an entry's src names its download, orig the file in
 * it, and fit how close it is: a shape's silhouette IoU at game scale (mean and worst view) and color dE.
 * Load it with E.addAssets(window.ASSETS['shooter']): its ids become 'shooter:id'. */
(window.ASSETS = window.ASSETS || {})['shooter'] = { set: 'shooter', format: 1, credit: 'The shooter starter\'s hay in the fields (src/starter/30-shooter.js)',
sources: {'kenney-graveyard':{label:'Kenney Graveyard Kit',origin:'Kenney (kenney.nl), graveyard-kit',license:'CC0 1.0',url:'https://kenney.nl/media/pages/assets/graveyard-kit/ba8d4b4517-1760691807/kenney_graveyard-kit_5.0.zip',page:'https://kenney.nl/assets/graveyard-kit',fetched:'2026-10-14',sha256:'1a93613f2e5675f3310acf49ec9ef13ae7adeb756ac3b205bfb6cc9311a81062',licenseHash:'a48e274258386c6b',dir:'graveyard-kit',scale:2,factors:'srgb'}},
materials: {
birch: '#d99972 thatch',
wool: '#c5575d cloth'},
shapes: {
'hay-bale-bundled': {about:'golden hay bale tied with two red bands',tags:'farm graveyard barn',mats:{a:'birch',b:'wool'},parts:[['box','a',[0,0,0.4],[19.5,13,11.5]],['lathe','b',[-7,0,6],[[0,0],[8,0.4],[7.5,3.1],[0,3.1],[0,11],[7.5,11],[7.5,14],[0,14]],{rot:[0,90,0]}]],src:'kenney-graveyard',orig:'Models/GLB format/hay-bale-bundled.glb',fit:{iou:0.87,worst:0.84,dE:5}},
'hay-bale': {about:'rectangular golden hay bale',tags:'farm graveyard barn',mats:{a:'birch'},parts:[['box','a',[0,0,0],[19.5,13,11.5]]],src:'kenney-graveyard',orig:'Models/GLB format/hay-bale.glb',fit:{iou:0.85,worst:0.81,dE:6}}},
sprites: {
}};
