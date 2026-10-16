/** Morrow Ward's authored navigation. Coordinates are metres, X east / Y south / Z up. */
export const DISTRICT_BOUNDS = Object.freeze({ minX: 22, minY: 24, maxX: 456, maxY: 396, waterEast: 457, waterSouth: 397 });

export const ROAD_SEGMENTS = Object.freeze([
  { id: 'mercer-north', name: 'Mercer Street', a: [60, 52], b: [416, 52], width: 14 },
  { id: 'avenue-93', name: 'Avenue 93', a: [60, 202], b: [416, 202], width: 17 },
  { id: 'foundry-road', name: 'Foundry Road', a: [60, 332], b: [416, 332], width: 15 },
  { id: 'ferry-west', name: 'Ferry Street', a: [60, 52], b: [60, 380], width: 14 },
  { id: 'rivet-central', name: 'Rivet Avenue', a: [240, 52], b: [240, 380], width: 16 },
  { id: 'quay-east', name: 'Quay Street', a: [416, 52], b: [416, 380], width: 14 },
  { id: 'waterfront-return', name: 'Low Water Way', a: [60, 380], b: [416, 380], width: 11 },
  { id: 'depot-front', name: 'Dispatch access', a: [348, 202], b: [348, 157], width: 11, service: true },
  { id: 'depot-service', name: 'Dispatch service lane', a: [416, 88], b: [400, 88], width: 6, service: true },
  { id: 'garage-lane', name: 'Eli’s service lane', a: [60, 270], b: [240, 270], width: 7, service: true },
  { id: 'garage-apron', name: 'Eli’s north bay', a: [94, 270], b: [94, 289], width: 9, service: true },
  { id: 'garage-south', name: 'Eli’s south bay', a: [94, 318], b: [94, 332], width: 10, service: true },
  { id: 'waterfront-entry', name: 'Maintenance yard approach', a: [380, 332], b: [380, 380], width: 10, service: true },
  { id: 'broker-entry', name: 'Northline loading', a: [108, 52], b: [108, 96], width: 8, service: true },
]);

const roadNodes = [];
const roadEdges = [];
const xs = [60, 240, 416], ys = [52, 202, 332, 380];
for (let yi = 0; yi < ys.length; yi++) for (let xi = 0; xi < xs.length; xi++) {
  roadNodes.push({ id: `r${xi}${yi}`, x: xs[xi], y: ys[yi], z: 0, intersection: true, radius: 10 });
}
const edge = (from, to, extras = {}) => {
  roadEdges.push({ from, to, width: 14, lanes: 2, speed: 12, ...extras });
  roadEdges.push({ from: to, to: from, width: 14, lanes: 2, speed: 12, ...extras });
};
for (let yi = 0; yi < ys.length; yi++) for (let xi = 0; xi < xs.length - 1; xi++) edge(`r${xi}${yi}`, `r${xi + 1}${yi}`, yi === 3 ? { width: 11, speed: 8 } : {});
for (let xi = 0; xi < xs.length; xi++) for (let yi = 0; yi < ys.length - 1; yi++) edge(`r${xi}${yi}`, `r${xi}${yi + 1}`);
const appendRoad = (node, connect, extras = {}) => { roadNodes.push({ z: 0, ...node }); edge(connect, node.id, { speed: 6, ...extras }); };
appendRoad({ id: 'garage-apron', x: 94, y: 329 }, 'r02');
appendRoad({ id: 'garage-lane-west', x: 60, y: 270 }, 'r02', { width: 7, service: true });
edge('garage-lane-west', 'r01', { width: 7, service: true });
appendRoad({ id: 'garage-lane-bay', x: 94, y: 270 }, 'garage-lane-west', { width: 7, service: true });
appendRoad({ id: 'garage-north', x: 94, y: 277 }, 'garage-lane-bay', { width: 7, service: true });
appendRoad({ id: 'market-parking', x: 132, y: 202 }, 'r01');
edge('market-parking', 'r11');
appendRoad({ id: 'depot-turn', x: 348, y: 202 }, 'r11');
edge('depot-turn', 'r21');
appendRoad({ id: 'depot-gate', x: 348, y: 160 }, 'depot-turn', { width: 10, service: true });
appendRoad({ id: 'depot-yard', x: 348, y: 137 }, 'depot-gate', { width: 10, service: true });
appendRoad({ id: 'waterfront-north', x: 380, y: 332 }, 'r12');
edge('waterfront-north', 'r22');
appendRoad({ id: 'waterfront-yard', x: 380, y: 355 }, 'waterfront-north', { width: 9, service: true });
appendRoad({ id: 'waterfront-south', x: 380, y: 380 }, 'waterfront-yard', { width: 9, service: true });
edge('waterfront-south', 'r13');
edge('waterfront-south', 'r23');
appendRoad({ id: 'broker-road', x: 108, y: 52 }, 'r00');
edge('broker-road', 'r10');
appendRoad({ id: 'broker-court', x: 108, y: 87 }, 'broker-road', { width: 8, service: true });

export const ROAD_GRAPH = Object.freeze({
  units: 'metres', nodes: roadNodes, edges: roadEdges,
  loops: [
    ['r00', 'r10', 'r11', 'r01', 'r00'],
    ['r10', 'r20', 'r21', 'r11', 'r10'],
    ['r01', 'r11', 'r12', 'r02', 'r01'],
    ['r11', 'r21', 'r22', 'r12', 'r11'],
    ['r02', 'r12', 'r22', 'r23', 'r13', 'r03', 'r02'],
  ],
  signals: [{ id: 'r11', period: 18, green: 7.5, amber: 1.5 }, { id: 'r12', period: 22, green: 9.5, amber: 1.5 }],
});

const footNodes = [];
const footEdges = [];
const walk = (id, x, y, z = 0, extras = {}) => { footNodes.push({ id, x, y, z, ...extras }); };
const link = (from, to, extras = {}) => { footEdges.push({ from, to, ...extras }, { from: to, to: from, ...extras }); };
for (let yi = 0; yi < ys.length; yi++) for (let xi = 0; xi < xs.length; xi++) {
  const id = `f${xi}${yi}`;
  walk(id, xs[xi] + 9.7, ys[yi] + (yi === 0 ? 8.8 : 9.7), .02);
  if (xi) link(`f${xi - 1}${yi}`, id, { crossing: true });
  if (yi) link(`f${xi}${yi - 1}`, id, { crossing: true });
}
[
  ['garage', 91, 310], ['garage-service', 106, 308], ['garage-north', 94, 278], ['garage-lane-west', 71, 270], ['garage-south-door', 94, 326], ['garage-south-walk', 94, 341.7],
  ['market', 113, 216], ['food', 96, 224], ['armor', 143, 224], ['toolbox', 151, 245], ['market-east-walk', 164, 216], ['market-east-alley', 164, 245], ['market-west-alley', 70, 245],
  ['broker', 91, 88], ['broker-gate', 108, 61],
  ['depot-observe', 349, 184], ['depot-gate', 348, 160], ['depot-yard', 348, 142],
  ['depot-cover-west', 310, 140], ['depot-flank-west', 310, 112], ['depot-flank-north', 312, 104],
  ['depot-office-door', 333, 103], ['depot-office', 333, 91], ['depot-case', 324, 84],
  ['depot-rear-out', 406, 88], ['depot-vault', 401.5, 88], ['depot-rear-in', 394, 88],
  ['depot-flank-east', 388, 111], ['depot-cover-east', 389, 137],
  ['waterfront', 385, 358], ['waterfront-north', 380, 325], ['waterfront-south', 380, 380],
  ['quiet-stop', 272, 354], ['quiet-south-walk', 267, 372], ['quay-foot', 442, 352], ['waterfront-front-walk', 390, 352], ['waterfront-west-walk', 381, 358],
].forEach(([id, x, y]) => walk(id, x, y));
[
  ['f02', 'garage-south-walk'], ['garage-south-walk', 'garage-south-door'], ['garage-south-door', 'garage'], ['garage', 'garage-service'], ['garage', 'garage-north'], ['garage-north', 'garage-lane-west'], ['garage-lane-west', 'f01'],
  ['f01', 'market'], ['market', 'food'], ['market', 'armor'], ['market', 'market-east-walk'], ['market-east-walk', 'market-east-alley'], ['market-east-alley', 'toolbox'], ['toolbox', 'market-west-alley'], ['market-west-alley', 'f01'],
  ['f00', 'broker-gate'], ['broker-gate', 'broker'],
  ['f11', 'depot-observe'], ['f21', 'depot-observe'], ['depot-observe', 'depot-gate'], ['depot-gate', 'depot-yard'],
  ['depot-yard', 'depot-cover-west'], ['depot-cover-west', 'depot-flank-west'], ['depot-flank-west', 'depot-flank-north'],
  ['depot-flank-north', 'depot-office-door'], ['depot-office-door', 'depot-office'], ['depot-office', 'depot-case'],
  ['depot-yard', 'depot-cover-east'], ['depot-cover-east', 'depot-flank-east'], ['depot-flank-east', 'depot-rear-in'],
  ['f20', 'depot-rear-out'], ['depot-rear-out', 'depot-vault'], ['depot-flank-east', 'depot-office-door'],
  ['f22', 'waterfront-north'], ['waterfront-north', 'waterfront-west-walk'], ['waterfront-west-walk', 'waterfront'], ['waterfront-west-walk', 'waterfront-south'],
  ['waterfront', 'waterfront-front-walk'], ['waterfront-front-walk', 'quay-foot'], ['waterfront-south', 'f23'], ['waterfront-south', 'quiet-south-walk'], ['quiet-south-walk', 'quiet-stop'], ['quiet-stop', 'f12'],
].forEach(([a, b]) => link(a, b));
link('depot-vault', 'depot-rear-in', { action: 'vault', height: .95 });
walk('office-stair-bottom', 342.7, 89, 0);
walk('office-stair-top', 342.7, 78, 3.2);
walk('office-stair-landing-east', 343, 76.5, 3.2);
walk('office-stair-landing-west', 333, 76.5, 3.2);
walk('office-upper', 333, 85, 3.2);
link('depot-office', 'office-stair-bottom');
link('office-stair-bottom', 'office-stair-top', { action: 'stairs' });
link('office-stair-top', 'office-stair-landing-east');
link('office-stair-landing-east', 'office-stair-landing-west');
link('office-stair-landing-west', 'office-upper');
export const FOOT_GRAPH = Object.freeze({ units: 'metres', nodes: footNodes, edges: footEdges });

/** Euclidean A* over either authored graph. Returns positions, including both endpoints. */
export function findGraphPath(graph, fromId, toId) {
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  if (!nodes.has(fromId) || !nodes.has(toId)) return [];
  const target = nodes.get(toId), open = new Set([fromId]), previous = new Map(), costs = new Map([[fromId, 0]]);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
  while (open.size) {
    let id, score = Infinity;
    for (const key of open) { const value = costs.get(key) + distance(nodes.get(key), target); if (value < score) { id = key; score = value; } }
    if (id === toId) { const path = []; while (id) { path.unshift(nodes.get(id)); id = previous.get(id); } return path; }
    open.delete(id);
    for (const e of graph.edges) {
      if (e.from !== id || !nodes.has(e.to)) continue;
      const cost = costs.get(id) + distance(nodes.get(id), nodes.get(e.to)) + (e.action === 'vault' ? 4 : 0);
      if (cost < (costs.get(e.to) ?? Infinity)) { costs.set(e.to, cost); previous.set(e.to, id); open.add(e.to); }
    }
  }
  return [];
}

export function nearestGraphNode(graph, point) {
  let best = null, distance = Infinity;
  for (const node of graph.nodes) { const d = Math.hypot(node.x - point.x, node.y - point.y, (node.z || 0) - (point.z || 0)); if (d < distance) { distance = d; best = node; } }
  return best;
}
