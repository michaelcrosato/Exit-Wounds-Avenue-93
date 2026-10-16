/** All advertised static interactions, services and mission anchors. Metre coordinates. */
export const LOCATIONS = Object.freeze({
  garage: { id: 'garage', letter: 'A', name: 'Eli’s Motor Works', x: 94, y: 306, z: 0, radius: 26, color: '#e9ae63', description: 'Your garage, a borrowed car and one last collection.' },
  market: { id: 'market', letter: 'B', name: 'Morrow Market', x: 113, y: 216, z: 0, radius: 34, color: '#a8c7ad', description: 'Bea Moss, hot food and workwear under the old line.' },
  junction: { id: 'junction', letter: 'C', name: 'Rivet Junction', x: 240, y: 202, z: 0, radius: 30, color: '#8ca4b8', description: 'The elevated line splits two busy street loops.' },
  depot: { id: 'depot', letter: 'D', name: 'Northline Dispatch', x: 348, y: 124, z: 0, radius: 61, color: '#d0ad6f', description: 'A street gate, rear service lane and payroll office.' },
  waterfront: { id: 'waterfront', letter: 'E', name: 'Low Water Maintenance', x: 382, y: 356, z: 0, radius: 33, color: '#89aeba', description: 'Container cover and the neighborhood reporter’s drop.' },
  broker: { id: 'broker', letter: 'F', name: 'Northline Loading Court', x: 91, y: 88, z: 0, radius: 27, color: '#b8a8bd', description: 'A quiet loading court, away from the avenue.' },
});

export const INTERACTABLES = Object.freeze([
  { id: 'eli', kind: 'contact', name: 'Eli Serrano', x: 106, y: 307, z: 0, radius: 3, facing: Math.PI, action: 'talk-eli', location: 'garage' },
  { id: 'garage-repair', kind: 'service', name: 'Repair / respray · $80', x: 94, y: 305, z: 0, radius: 6, action: 'repair', price: 80, location: 'garage' },
  { id: 'toolbox-return', kind: 'favor-drop', name: 'Return Eli’s toolbox', x: 106, y: 304, z: .9, radius: 2.5, action: 'return-toolbox', location: 'garage' },
  { id: 'bea', kind: 'contact', name: 'Bea Moss', x: 113, y: 216, z: 0, radius: 3, facing: Math.PI / 2, action: 'talk-bea', location: 'market' },
  { id: 'food', kind: 'service', name: 'Hot meal · $10', x: 96, y: 224, z: 0, radius: 2.6, action: 'buy-food', price: 10, location: 'market' },
  { id: 'armor', kind: 'service', name: 'Workwear armor · $60', x: 143, y: 224, z: 0, radius: 2.6, action: 'buy-armor', price: 60, location: 'market' },
  { id: 'toolbox', kind: 'favor-pickup', name: 'Eli’s misplaced toolbox', x: 153, y: 245, z: .08, radius: 2.4, action: 'take-toolbox', location: 'market' },
  { id: 'depot-observation', kind: 'observation', name: 'Observe Northline Dispatch', x: 349, y: 184, z: 0, radius: 9, action: 'observe-depot', location: 'depot' },
  { id: 'depot-front-gate', kind: 'open-gate', name: 'Street gate', x: 348, y: 163, z: 0, radius: 3, action: 'enter-depot-front', location: 'depot' },
  { id: 'depot-rear-vault', kind: 'vault', name: 'Vault low service barrier', x: 400, y: 88, z: 0, radius: 5, action: 'vault', height: .95, destination: { x: 396, y: 88, z: 0 }, landings: [{ x: 396, y: 88, z: 0 }, { x: 404, y: 88, z: 0 }], location: 'depot' },
  { id: 'case', kind: 'mission', name: 'Open payroll cabinet', x: 324, y: 83, z: 0, radius: 2.8, action: 'recover-case', location: 'depot' },
  { id: 'jun', kind: 'companion', name: 'Jun Park', x: 331, y: 88, z: 0, radius: 3.1, action: 'talk-jun', location: 'depot' },
  { id: 'depot-ammo', kind: 'pickup', name: 'Pistol ammunition', x: 320, y: 106, z: .8, radius: 2.5, action: 'take-ammo', amount: 36, location: 'depot' },
  { id: 'depot-smg', kind: 'pickup', name: 'Compact SMG', x: 380, y: 127, z: .9, radius: 2.5, action: 'take-smg', reserve: 90, location: 'depot' },
  { id: 'quiet-stop', kind: 'decision', name: 'Hear Jun’s account', x: 272, y: 354, z: 0, radius: 12, action: 'decision', location: 'waterfront' },
  { id: 'reporter-drop', kind: 'handoff', name: 'Reporter drop · $600', x: 385, y: 358, z: 0, radius: 4, action: 'handoff-reporter', ending: 'reporter', payment: 600, location: 'waterfront' },
  { id: 'broker-drop', kind: 'handoff', name: 'Broker drop · $1,200', x: 91, y: 88, z: 0, radius: 4, action: 'handoff-broker', ending: 'broker', payment: 1200, location: 'broker' },
]);

export const SPAWN_POINTS = Object.freeze({
  player: { x: 91, y: 311, z: .05, yaw: 0 },
  eli: { x: 106, y: 307, z: .05, yaw: Math.PI },
  bea: { x: 113, y: 216, z: .18, yaw: Math.PI / 2 },
  sedan: { x: 94, y: 324.8, z: .6, yaw: 0, kind: 'sedan', color: '#556e77' },
  van: { x: 365, y: 148, z: .6, yaw: Math.PI / 2, kind: 'van', color: '#aaa58c' },
  alternateCar: { x: 393, y: 369, z: .6, yaw: Math.PI / 2, kind: 'sedan', color: '#9d7356' },
  patrols: [{ x: 61, y: 61, z: .6, yaw: Math.PI / 2 }, { x: 240, y: 325, z: .6, yaw: Math.PI }, { x: 416, y: 242, z: .6, yaw: -Math.PI / 2 }],
  jun: { x: 331, y: 88, z: .05, yaw: Math.PI / 2 },
  crew: [
    { id: 'gate-guard', role: 'guard', x: 339, y: 150, z: .05, yaw: Math.PI / 2 },
    { id: 'rear-guard', role: 'guard', x: 391, y: 91, z: .05, yaw: 0 },
    { id: 'yard-rusher', role: 'rusher', x: 366, y: 119, z: .05, yaw: Math.PI / 2 },
    { id: 'office-rusher', role: 'rusher', x: 331, y: 97, z: .05, yaw: Math.PI / 2 },
    { id: 'west-flanker', role: 'flanker', x: 313, y: 110, z: .05, yaw: 0 },
    { id: 'east-flanker', role: 'flanker', x: 382, y: 131, z: .05, yaw: Math.PI },
  ],
  recover: { garage: { x: 91, y: 329, z: .1 }, depot: { x: 348, y: 184, z: .1 }, waterfront: { x: 380, y: 378, z: .1 } },
});

/** Proximity arbitration leaves mission conditions to the mission director. */
export function nearbyInteractions(position, entries = INTERACTABLES) {
  return entries.map(entry => ({ entry, distance: Math.hypot(position.x - entry.x, position.y - entry.y, (position.z || 0) - entry.z) }))
    .filter(({ entry, distance }) => distance <= entry.radius)
    .sort((a, b) => a.distance - b.distance).map(({ entry }) => entry);
}
