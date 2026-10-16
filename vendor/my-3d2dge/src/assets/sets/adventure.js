/* adventure: a set of my-3D2dge's asset store (written by tools/asset-*.mjs; entries may be edited by hand).
 * The adventure starter's village stump and shrine obelisks (src/starter/10-adventure.js)
 * 2 shapes, 2 materials, 0 sprites. docs/ASSETS.md is the format; docs/ASSET-IMPORT.md how it was made.
 * "sources" records each download (its url, date, sha256 and license); an entry's src names its download, orig the file in
 * it, and fit how close it is: a shape's silhouette IoU at game scale (mean and worst view) and color dE.
 * Load it with E.addAssets(window.ASSETS['adventure']): its ids become 'adventure:id'. */
(window.ASSETS = window.ASSETS || {})['adventure'] = { set: 'adventure', format: 1, credit: 'The adventure starter\'s village stump and shrine obelisks (src/starter/10-adventure.js)',
sources: {'kenney-nature':{label:'Kenney Nature Kit',origin:'Kenney (kenney.nl), nature-kit',license:'CC0 1.0',url:'https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip',page:'https://kenney.nl/assets/nature-kit',fetched:'2026-10-14',sha256:'fa7974a0d342bfe63c38664ba9f8ec1a4aab8ea25f099bdc56870e33588c4d9d',licenseHash:'cb96b75e3560ac78',dir:'nature-kit',scale:2.2,factors:'srgb'},'kenney-graveyard':{label:'Kenney Graveyard Kit',origin:'Kenney (kenney.nl), graveyard-kit',license:'CC0 1.0',url:'https://kenney.nl/media/pages/assets/graveyard-kit/ba8d4b4517-1760691807/kenney_graveyard-kit_5.0.zip',page:'https://kenney.nl/assets/graveyard-kit',fetched:'2026-10-14',sha256:'1a93613f2e5675f3310acf49ec9ef13ae7adeb756ac3b205bfb6cc9311a81062',licenseHash:'a48e274258386c6b',dir:'graveyard-kit',scale:2,factors:'srgb'}},
materials: {
copper: '#e68458 bark',
steel: '#99a0c0 speck'},
shapes: {
'stump-round': {about:'round brown tree stump, flared base',tags:'stump forest',mats:{a:'copper'},parts:[['lathe','a',[0,0,0],[[0,0],[6.5,0],[5,2.5],[5,7.5],[0,7.5]]]],src:'kenney-nature',orig:'Models/GLTF format/stump_round.glb',fit:{iou:0.89,worst:0.84,dE:0}},
'pillar-obelisk': {about:'stepped grey stone obelisk on a round base',tags:'decoration graveyard monument',mats:{a:'steel'},parts:[['box','a',[0.5,0.5,3],[9,9,1]],['box','a',[0,0,4],[8,8,16]],['box','a',[0,0,20],[6,6,9]],['box','a',[0,0,29],[4,4,2]],['box','a',[0,0,31],[2,2,2]],['cyl','a',[0,0,0],7,3.2],['cyl','a',[0,0,6.5],6,3.2]],src:'kenney-graveyard',orig:'Models/GLB format/pillar-obelisk.glb',fit:{iou:0.86,worst:0.84,dE:4}}},
sprites: {
}};
