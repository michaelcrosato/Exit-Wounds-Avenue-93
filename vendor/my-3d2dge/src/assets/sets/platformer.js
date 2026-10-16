/* platformer: a set of my-3D2dge's asset store (written by tools/asset-*.mjs; entries may be edited by hand).
 * A night graveyard's stones for the platformer starter (src/starter/20-platformer.js)
 * 3 shapes, 2 materials, 0 sprites. docs/ASSETS.md is the format; docs/ASSET-IMPORT.md how it was made.
 * "sources" records each download (its url, date, sha256 and license); an entry's src names its download, orig the file in
 * it, and fit how close it is: a shape's silhouette IoU at game scale (mean and worst view) and color dE.
 * Load it with E.addAssets(window.ASSETS['platformer']): its ids become 'platformer:id'. */
(window.ASSETS = window.ASSETS || {})['platformer'] = { set: 'platformer', format: 1, credit: 'A night graveyard\'s stones for the platformer starter (src/starter/20-platformer.js)',
sources: {'kenney-graveyard':{label:'Kenney Graveyard Kit',origin:'Kenney (kenney.nl), graveyard-kit',license:'CC0 1.0',url:'https://kenney.nl/media/pages/assets/graveyard-kit/ba8d4b4517-1760691807/kenney_graveyard-kit_5.0.zip',page:'https://kenney.nl/assets/graveyard-kit',fetched:'2026-10-14',sha256:'1a93613f2e5675f3310acf49ec9ef13ae7adeb756ac3b205bfb6cc9311a81062',licenseHash:'a48e274258386c6b',dir:'graveyard-kit',scale:2,factors:'srgb'}},
materials: {
steel: '#99a0c0 speck',
iron: '#636982 speck'},
shapes: {
'crypt-a': {about:'stone sarcophagus with gabled lid on a low base',tags:'grave graveyard crypt',mats:{a:'steel'},parts:[['prism','a',[0,0,0],[[-5.5,8],[-6,9.5],[-8,9.5],[-8,12.5],[-1.3,17],[1.3,17],[8.5,12.5],[8.5,10],[6,9.5],[6,8]],31.5,{axis:'y'}],['box','a',[0,0,0],[20,35.5,4]],['box','a',[0,0,4],[16,31.5,4]]],src:'kenney-graveyard',orig:'Models/GLB format/crypt-a.glb',fit:{iou:0.95,worst:0.93,dE:5}},
cross: {about:'grey stone cross with flared arms on a square base',tags:'grave graveyard',mats:{a:'steel'},parts:[['box','a',[0,0,3],[6,4,26]],['mirror','x',['box','a',[4.5,0,21],[3,4,5]]],['box','a',[0,0,0],[8,8,3.2]],['prism','a',[0,0,0],[[-7,20],[-10.5,22.5],[-10.5,24.5],[-7,27.5],[-6.5,27.5],[-6,27],[-6,20]],5,{axis:'y'}],['prism','a',[0,0,0],[[6.5,20],[6,20],[6,27],[6.5,27.5],[7,27.5],[10.5,24.5],[10.5,22.5],[7.5,20]],5,{axis:'y'}],['prism','a',[0,0,0],[[-3.3,29],[-3.7,29],[-3.7,30],[-0.8,33.5],[0.8,33.5],[3.8,30],[3.8,29],[3.4,29]],5,{axis:'y'}],['prism','a',[0,2.5,0],[[0,21],[-2.6,23.5],[-0.1,26],[2.7,23.5]],1.4,{axis:'y'}]],src:'kenney-graveyard',orig:'Models/GLB format/cross.glb',fit:{iou:0.9,worst:0.88,dE:5}},
'urn-round': {about:'dark grey lidded funeral urn on a footed base',tags:'decoration graveyard crypt',mats:{a:'iron',b:'steel'},parts:[['lathe','a',[0,0,4],[[0,0],[2.6,0],[3.2,1.5],[3.7,4.5],[3.7,5],[0,5]]],['lathe','a',[0,0,0],[[0,0],[3.2,0],[3.1,1.8],[2.4,2.5],[1.6,2.5],[1.9,4],[0,4]]],['lathe','a',[0,0,9],[[0,0],[4,0],[4,0.9],[3.6,1.6],[1,1.6],[1.4,2.5],[0,2.5]]],['lathe','b',[0,0,5.5],[[0,0],[2.4,0],[2.9,3.2],[0,3.3],[0,4.5],[0.9,4.5],[1.4,5.5],[1,6.5],[0,6.5]]],['box','b',[0,0,2],[2,5,0.5]],['mirror','x',['box','b',[1.5,0,2],[1,4,0.5]]],['mirror','x',['box','b',[2.3,0,2],[0.5,2,0.5]]]],src:'kenney-graveyard',orig:'Models/GLB format/urn-round.glb',fit:{iou:0.93,worst:0.92,dE:4}}},
sprites: {
}};
