/* stealth: a set of my-3D2dge's asset store (written by tools/asset-*.mjs; entries may be edited by hand).
 * The stealth starter's stacked planks on the roofs (src/starter/70-stealth.js)
 * 1 shapes, 1 materials, 0 sprites. docs/ASSETS.md is the format; docs/ASSET-IMPORT.md how it was made.
 * "sources" records each download (its url, date, sha256 and license); an entry's src names its download, orig the file in
 * it, and fit how close it is: a shape's silhouette IoU at game scale (mean and worst view) and color dE.
 * Load it with E.addAssets(window.ASSETS['stealth']): its ids become 'stealth:id'. */
(window.ASSETS = window.ASSETS || {})['stealth'] = { set: 'stealth', format: 1, credit: 'The stealth starter\'s stacked planks on the roofs (src/starter/70-stealth.js)',
sources: {'kenney-survival':{label:'Kenney Survival Kit',origin:'Kenney (kenney.nl), survival-kit',license:'CC0 1.0',url:'https://kenney.nl/media/pages/assets/survival-kit/4065a8185b-1712149243/kenney_survival-kit.zip',page:'https://kenney.nl/assets/survival-kit',fetched:'2026-10-14',sha256:'c3586341b5932c87eb43d75d915434f47daed168b17ed36a03e8ca9977c7443e',licenseHash:'62c8356876481204',dir:'survival-kit',scale:3.5,factors:'srgb'}},
materials: {
clay: '#cc7853 planks bw=3'},
shapes: {
'resource-planks': {about:'small pile of loose wooden planks',tags:'item camp survival',mats:{a:'clay'},parts:[['prism','a',[0,-0.5,0],[[-2.3,0],[-2.7,1.7],[-7,1.7],[-7,3.8],[0.1,3.8],[0.1,1.7],[3.3,1.7],[3.3,0]],29,{axis:'y'}],['box','a',[4,-1.3,1.7],[5.5,32.5,1.7]],['prism','a',[0,0,0],[[-8,-12],[-10.5,16],[-5,16.5],[-2.4,-11.5]],1.7],['prism','a',[0,0,0],[[5.5,-10.5],[3.5,-10.5],[4.5,17],[10.5,17.5],[9,-10.5]],1.7],['prism','a',[0,0,3.5],[[2.3,-12.5],[-5,9.5],[0,12],[7.5,-10.5]],1.7]],src:'kenney-survival',orig:'Models/GLB format/resource-planks.glb',fit:{iou:0.96,worst:0.95,dE:6}}},
sprites: {
}};
