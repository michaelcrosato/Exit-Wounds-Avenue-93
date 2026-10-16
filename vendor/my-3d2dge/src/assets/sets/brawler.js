/* brawler: a set of my-3D2dge's asset store (written by tools/asset-*.mjs; entries may be edited by hand).
 * The brawler starter's alley boxes (src/starter/50-brawler.js)
 * 2 shapes, 2 materials, 0 sprites. docs/ASSETS.md is the format; docs/ASSET-IMPORT.md how it was made.
 * "sources" records each download (its url, date, sha256 and license); an entry's src names its download, orig the file in
 * it, and fit how close it is: a shape's silhouette IoU at game scale (mean and worst view) and color dE.
 * Load it with E.addAssets(window.ASSETS['brawler']): its ids become 'brawler:id'. */
(window.ASSETS = window.ASSETS || {})['brawler'] = { set: 'brawler', format: 1, credit: 'The brawler starter\'s alley boxes (src/starter/50-brawler.js)',
sources: {'kenney-survival':{label:'Kenney Survival Kit',origin:'Kenney (kenney.nl), survival-kit',license:'CC0 1.0',url:'https://kenney.nl/media/pages/assets/survival-kit/4065a8185b-1712149243/kenney_survival-kit.zip',page:'https://kenney.nl/assets/survival-kit',fetched:'2026-10-14',sha256:'c3586341b5932c87eb43d75d915434f47daed168b17ed36a03e8ca9977c7443e',licenseHash:'62c8356876481204',dir:'survival-kit',scale:3.5,factors:'srgb'}},
materials: {
clay: '#cc7853 planks bw=3',
sandstone: '#e9b18b bark'},
shapes: {
box: {about:'brown box with a pale tape strip',tags:'container camp survival',mats:{a:'clay',b:'sandstone'},parts:[['box','a',[0,0,0],[14,14,14]],['mirror','y',['box','b',[0,6.5,10],[4,1,5]]],['box','b',[0,7.5,13],[4,1,1]],['box','b',[0,0,14],[4,12,1]],['box','b',[0,7,0.5],[4,1,0.5]],['box','b',[0,7,1],[4,0.5,3]]],src:'kenney-survival',orig:'Models/GLB format/box.glb',fit:{iou:0.93,worst:0.89,dE:5}},
'box-open': {about:'open brown box, top flaps folded out',tags:'container camp survival',mats:{a:'clay',c:'sandstone'},parts:[['box','a',[0,0,0],[14,14,16.5]],['mirror','x',['box','c',[2.9,0,16],[0.5,13,1.1]]],['mirror','x',['box','c',[2.1,0,16.5],[1.1,13,0.5]]],['mirror','x',['box','c',[1.9,0,17],[0.5,13,0.5]]],['box','c',[0,7,10.5],[4,0.5,3.5]],['box','c',[0,7.5,13],[4,0.5,0.5]],['box','c',[0,7,0.5],[4,1,0.5]],['box','c',[0,7,1],[4,0.5,3]]],src:'kenney-survival',orig:'Models/GLB format/box-open.glb',fit:{iou:0.87,worst:0.82,dE:4}}},
sprites: {
}};
