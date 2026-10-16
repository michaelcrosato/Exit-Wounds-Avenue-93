/* platformer3d: a set of my-3D2dge's asset store (written by tools/asset-*.mjs; entries may be edited by hand).
 * The 3D platformer starter's signposts (src/starter3d/20-platformer.js)
 * 1 shapes, 2 materials, 0 sprites. docs/ASSETS.md is the format; docs/ASSET-IMPORT.md how it was made.
 * "sources" records each download (its url, date, sha256 and license); an entry's src names its download, orig the file in
 * it, and fit how close it is: a shape's silhouette IoU at game scale (mean and worst view) and color dE.
 * Load it with E.addAssets(window.ASSETS['platformer3d']): its ids become 'platformer3d:id'. */
(window.ASSETS = window.ASSETS || {})['platformer3d'] = { set: 'platformer3d', format: 1, credit: 'The 3D platformer starter\'s signposts (src/starter3d/20-platformer.js)',
sources: {'kenney-platformer':{label:'Kenney Platformer Kit',origin:'Kenney (kenney.nl), platformer-kit',license:'CC0 1.0',url:'https://kenney.nl/media/pages/assets/platformer-kit/1585cf62b4-1775122253/kenney_platformer-kit.zip',page:'https://kenney.nl/assets/platformer-kit',fetched:'2026-10-14',sha256:'899605d237367688c6b42e41fff2206c0fb8d626163158294556353f7baa7c1b',licenseHash:'e1185354d8f0f055',dir:'platformer-kit',scale:2.5,factors:'srgb'}},
materials: {
clay: '#d07b56 planks bw=3',
oak: '#985941 planks bw=3'},
shapes: {
arrows: {about:'wooden signpost with two arrow boards',tags:'sign platformer forest',mats:{a:'clay',b:'oak'},parts:[['prism','a',[0,1,0],[[-7.5,12],[-8.5,21],[2.8,21.5],[3.1,24],[10.5,19],[4.5,12],[3.8,14.5]],3.7,{axis:'y'}],['prism','a',[0,1,0],[[-4,24],[-10,30],[-10,31],[-9,32],[-3.1,36],[-2.8,33.5],[9,33],[8,24],[-3.6,26.5]],3.7,{axis:'y'}],['cyl','b',[0,-0.6,0],2.6,36,{r2:1.4}],['box','a',[0,-0.7,36],[3,2.5,0.5]]],src:'kenney-platformer',orig:'Models/GLB format/arrows.glb',fit:{iou:0.89,worst:0.87,dE:3}}},
sprites: {
}};
