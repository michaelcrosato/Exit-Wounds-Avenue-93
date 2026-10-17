import { U } from '../engine/units.js';
import { setBodyEnabled } from '../engine/body-lifecycle.js';
import { DISTRICT_BOUNDS, ROAD_SEGMENTS, ROAD_GRAPH, FOOT_GRAPH, findGraphPath, nearestGraphNode } from './roads.js';
import { LOCATIONS, INTERACTABLES, SPAWN_POINTS } from './interactions.js';

/**
 * Morrow Ward is original procedural architecture, authored in metres.
 * Only this renderer adapter knows that Rapier uses 16 units/m and Three uses Y-up.
 * The real E.World3D scene and Rapier world own every visible/collidable object.
 */
export function createDistrict({ E, world, rain = true, quality = 'high' }) {
  const T = E.THREE, R = E.RAPIER;
  if (!T || !R || !world?.scene || !world?.pw) throw new Error('Morrow Ward needs an initialized E.World3D.');
  const root = new T.Group(); root.name = 'Morrow Ward — original district'; world.scene.add(root);
  const resources = new Set(), bodies = [], obstacles = [], cover = [], landmarks = [], lamps = [], roofVolumes = [], trafficSignals = [], softProps = [];
  const buckets = new Map(), materials = new Map(), unique = new Set(), pickups = new Map();
  const own = value => { resources.add(value); return value; };
  const palette = {
    asphalt: '#313c43', pavement: '#777d7d', concrete: '#808a89', pale: '#b0b1a5', brick: '#695652',
    brickRed: '#885f51', brickDark: '#4e4d4c', steel: '#506773', rust: '#8b6853', teal: '#386b70',
    cream: '#c9bea0', trim: '#2c373d', yellow: '#d3ac57', paint: '#d8d0b6', wood: '#887052',
    black: '#232b30', glass: '#587e8d', warm: '#e9b778', light: '#f8d59a', green: '#617160', water: '#2f5366', signalRed: '#d5574c', signalAmber: '#e2ba62', signalGreen: '#8cc4a1', oil: '#343b37', orange: '#b56838', blue: '#557b86', paper: '#ddd4bb',
  };
  let seed = 932026, caseDoor = null, caseDoorTarget = 0, caseDoorBody = null;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  function texture(kind) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d'); if (!c) return null;
    c.fillStyle = kind === 'brick' ? '#a18c82' : kind === 'concrete' ? '#b0b2aa' : '#999da0'; c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2500; i++) { const k = 60 + rnd() * 140 | 0; c.fillStyle = `rgba(${k},${k},${k},${.07 + rnd() * .16})`; c.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 3, 1 + rnd() * 3); }
    if (kind === 'brick') {
      c.strokeStyle = '#d1c7b5'; c.lineWidth = 1.8;
      for (let y = 0; y <= 128; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(128, y); c.stroke();
        for (let x = ((y / 16) % 2) * 16; x <= 128; x += 32) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 16); c.stroke(); } }
    }
    const map = own(new T.CanvasTexture(canvas)); map.wrapS = map.wrapT = T.RepeatWrapping; map.colorSpace = T.SRGBColorSpace; return map;
  }
  const brickMap = texture('brick'), roadMap = texture('asphalt'), concreteMap = texture('concrete');
  function material(key) {
    if (materials.has(key)) return materials.get(key);
    const emissive = ['warm', 'light', 'signalRed', 'signalAmber', 'signalGreen'].includes(key), water = key === 'water', glass = key === 'glass';
    const map = key.startsWith('brick') ? brickMap : key === 'asphalt' ? roadMap : ['concrete', 'pavement'].includes(key) ? concreteMap : null;
    const mat = own(new T.MeshStandardNodeMaterial({
      color: palette[key] || key, map, roughness: water ? .22 : key === 'asphalt' ? .38 : glass ? .17 : .77,
      metalness: ['steel', 'trim', 'teal'].includes(key) ? .46 : .03,
      ...(emissive ? { emissive: palette[key], emissiveIntensity: key === 'light' ? 1.5 : .7 } : {}),
      ...(glass ? { transparent: true, opacity: .54, depthWrite: false } : {}),
    }));
    // World-space projection preserves brick/asphalt scale across differently sized instances.
    // This uses the engine's pinned TSL path and works with its WebGPU and WebGL2 renderers.
    const N = E.TSL;
    if (map && N?.positionWorld && N?.normalWorld) {
      const p = N.positionWorld, n = N.normalWorld;
      const wallUV = N.select(n.x.abs().greaterThan(.5), N.vec2(p.z, p.y), N.vec2(p.x, p.y));
      const uv = N.select(n.y.abs().greaterThan(.5), p.xz, wallUV).mul(key.startsWith('brick') ? N.vec2(1, 1.3889) : N.vec2(.5, .5));
      mat.colorNode = N.texture(map, uv).rgb.mul(N.color(palette[key] || key));
    }
    materials.set(key, mat); return mat;
  }
  const cube = own(new T.BoxGeometry(1, 1, 1)), cylinder = own(new T.CylinderGeometry(1, 1, 1, 10));
  const matrix = new T.Matrix4(), pos = new T.Vector3(), scale = new T.Vector3(), quat = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
  const addInstance = (key, geo, x, y, z, w, d, h, yaw = 0) => {
    const bucketKey = `${key}:${geo === cylinder ? 'cyl' : 'box'}`;
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, { key, geo, instances: [] });
    buckets.get(bucketKey).instances.push({ x, y, z, w, d, h, yaw });
  };
  function solid(id, x, y, z, w, d, h, yaw = 0, extras = {}) {
    const body = world.pw.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x * U, y * U, (z + h / 2) * U).setRotation({ x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) }));
    body.userData = { id, kind: extras.kind || 'district', surface: extras.surface || 'concrete' };
    const collider = world.pw.createCollider(R.ColliderDesc.cuboid(w * U / 2, d * U / 2, h * U / 2).setFriction(extras.friction ?? .8).setCollisionGroups(0x0001ffff), body);
    bodies.push(body);
    const obstacle = { id, x, y, z, w, d, h, yaw, body, collider, ...extras }; obstacles.push(obstacle); return obstacle;
  }
  function box(id, x, y, z, w, d, h, key = 'concrete', extras = {}) {
    addInstance(key, cube, x, y, z + h / 2, w, d, h, extras.yaw || 0);
    return extras.solid === false ? null : solid(id, x, y, z, w, d, h, extras.yaw || 0, extras);
  }
  function tube(x, y, z, r, h, key = 'steel') { addInstance(key, cylinder, x, y, z + h / 2, r, r, h); }
  function specialBox(id, x, y, z, w, d, h, key, extras = {}) {
    const mesh = new T.Mesh(cube, material(key)); mesh.name = id; mesh.position.set(x, z + h / 2, y); mesh.scale.set(w, h, d);
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); unique.add(mesh);
    if (extras.solid !== false) solid(id, x, y, z, w, d, h, 0, extras);
    return mesh;
  }
  function sign(text, x, y, z, w, h, { bg = '#26393e', fg = '#e6d5af', yaw = 0, detail = '' } = {}) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const c = canvas.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, 1024, 256);
    c.strokeStyle = fg; c.lineWidth = 6; c.strokeRect(14, 14, 996, 228);
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${text.length > 23 ? 52 : 68}px sans-serif`;
    c.fillText(text, 512, detail ? 99 : 129, 950);
    if (detail) { c.font = '25px sans-serif'; c.fillText(detail, 512, 181, 950); }
    // Original weathering, sparse enough to preserve the words at gameplay distance.
    c.fillStyle = bg; c.globalAlpha = .3; for (let i = 0; i < 36; i++) c.fillRect(rnd() * 1024, rnd() * 256, 2 + rnd() * 15, 1); c.globalAlpha = 1;
    const map = own(new T.CanvasTexture(canvas)); map.colorSpace = T.SRGBColorSpace;
    const mat = own(new T.MeshStandardNodeMaterial({ map, roughness: .72, emissive: '#b9a47e', emissiveMap: map, emissiveIntensity: .14, side: T.FrontSide }));
    const mesh = new T.Mesh(own(new T.PlaneGeometry(w, h)), mat); mesh.position.set(x, z, y); mesh.rotation.y = -yaw;
    const back = new T.Mesh(mesh.geometry, own(new T.MeshStandardNodeMaterial({ color: bg, roughness: .8, side: T.BackSide }))); back.position.z = -.005; mesh.add(back);
    root.add(mesh); unique.add(mesh); landmarks.push({ text, x, y, z }); return mesh;
  }
  function floorStencil(text, x, y, z, w, d, yaw = 0, ink = '#d3b779') {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
    const c = canvas.getContext('2d'); c.fillStyle = ink; c.font = '800 75px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 100, 495);
    c.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 130; i++) c.fillRect(rnd() * 512, rnd() * 192, 1 + rnd() * 5, 1 + rnd() * 3);
    const map = own(new T.CanvasTexture(canvas)); map.colorSpace = T.SRGBColorSpace;
    const mesh = new T.Mesh(own(new T.PlaneGeometry(w, d)), own(new T.MeshStandardNodeMaterial({ map, transparent: true, opacity: .67, depthWrite: false, roughness: .83 })));
    mesh.rotation.set(-Math.PI / 2, 0, -yaw); mesh.position.set(x, z, y); root.add(mesh); unique.add(mesh);
  }
  function chair(id, x, y, z = 0, yaw = 0) {
    box(`${id}-seat`, x, y, z + .43, .56, .53, .12, 'trim', { solid: false, yaw });
    const bx = x - Math.sin(yaw) * .23, by = y + Math.cos(yaw) * .23;
    box(`${id}-back`, bx, by, z + .53, .56, .1, .57, 'blue', { solid: false, yaw });
    for (const dx of [-.2, .2]) for (const dy of [-.18, .18]) box(`${id}-leg`, x + dx, y + dy, z, .06, .06, .45, 'steel', { solid: false });
    solid(id, x, y, z, .58, .56, 1.1, yaw, { kind: 'furniture' });
  }
  function shelf(id, x, y, w, d, height = 3.1) {
    solid(id, x, y, 0, w, d, height, 0, { kind: 'storage' });
    for (const dx of [-w / 2 + .06, w / 2 - .06]) for (const dy of [-d / 2 + .06, d / 2 - .06]) box(`${id}-upright`, x + dx, y + dy, 0, .1, .1, height, 'steel', { solid: false });
    for (let level = 0; level < 4; level++) {
      const z = .12 + level * .8;
      box(`${id}-shelf`, x, y, z, w, d, .09, 'steel', { solid: false });
      for (let i = 0; i < 3; i++) box(`${id}-stock`, x - w * .32 + i * w * .32, y + (i % 2 ? -.12 : .12), z + .1, w * .24, d * .67, .35 + (i % 2) * .12, ['cream', 'teal', 'rust'][(i + level) % 3], { solid: false });
    }
  }
  function striplight(id, x, y, z, length, yaw = 0) {
    box(`${id}-housing`, x, y, z, length + .2, .37, .17, 'steel', { solid: false, yaw });
    box(`${id}-tube`, x, y, z - .055, length, .18, .08, 'light', { solid: false, yaw });
  }
  function puddle(x, y, z, w, d, oil = false) {
    const key = oil ? 'oil-patch' : 'wet-patch';
    if (!materials.has(key)) materials.set(key, own(new T.MeshStandardNodeMaterial({ color: oil ? '#252d2b' : '#8ca1a5', roughness: oil ? .3 : .12, metalness: oil ? .12 : .3, transparent: true, opacity: oil ? .45 : .22, depthWrite: false })));
    const mesh = new T.Mesh(own(new T.CircleGeometry(1, 16)), materials.get(key)); mesh.rotation.set(-Math.PI / 2, 0, rnd() * Math.PI); mesh.position.set(x, z, y); mesh.scale.set(w, d, 1); root.add(mesh); unique.add(mesh);
  }
  function serviceRamp(id, x, y, width, length, northHeight, southHeight) {
    const vertices = [
      [-width / 2, -length / 2, -.16], [width / 2, -length / 2, -.16], [width / 2, length / 2, -.16], [-width / 2, length / 2, -.16],
      [-width / 2, -length / 2, northHeight], [width / 2, -length / 2, northHeight], [width / 2, length / 2, southHeight], [-width / 2, length / 2, southHeight],
    ];
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices.flatMap(v => [v[0], v[2], v[1]]), 3));
    const faces = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
    for (let i = 0; i < faces.length; i += 3) [faces[i + 1], faces[i + 2]] = [faces[i + 2], faces[i + 1]];
    geometry.setIndex(faces);
    const flat = own(geometry.toNonIndexed()); geometry.dispose(); flat.computeVertexNormals();
    const mesh = new T.Mesh(flat, material('concrete')); mesh.position.set(x, 0, y); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); unique.add(mesh);
    const body = world.pw.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x * U, y * U, 0)); body.userData = { id, kind: 'service-ramp', surface: 'concrete' };
    const collider = world.pw.createCollider(R.ColliderDesc.convexHull(new Float32Array(vertices.flatMap(v => v.map(n => n * U)))).setFriction(.95).setCollisionGroups(0x0001ffff), body);
    bodies.push(body); obstacles.push({ id, x, y, z: 0, w: width, d: length, h: Math.max(northHeight, southHeight), yaw: 0, body, collider, kind: 'ramp', northHeight, southHeight });
  }
  function softCone(id, x, y) {
    const body = world.pw.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x * U, y * U, .4 * U).setLinearDamping(.55).setAngularDamping(.7).setCcdEnabled(true));
    body.userData = { id, kind: 'soft-prop', surface: 'plastic' };
    const collider = world.pw.createCollider(R.ColliderDesc.cuboid(.24 * U, .24 * U, .37 * U).setMass(.7).setFriction(.6).setRestitution(.06).setCollisionGroups(0x0002ffff), body);
    const group = new T.Group(); group.name = id; group.position.set(x, .4, y); root.add(group);
    const base = new T.Mesh(cube, material('black')); base.scale.set(.56, .07, .56); base.position.y = -.34; group.add(base);
    const cone = new T.Mesh(own(new T.ConeGeometry(.23, .65, 10)), material('orange')); cone.position.y = -.01; group.add(cone);
    const band = new T.Mesh(own(new T.CylinderGeometry(.09, .14, .16, 10)), material('paint')); band.position.y = .1; group.add(band);
    bodies.push(body); softProps.push({ id, body, collider, mesh: group, spawn: { x, y, z: .4 } });
  }
  function coverBox(id, x, y, w, d, h, key = 'concrete', yaw = 0) {
    const obstacle = box(id, x, y, 0, w, d, h, key, { yaw, cover: true, kind: 'cover' });
    const c = Math.cos(yaw), s = Math.sin(yaw);
    cover.push({ id, x, y, z: 0, w, d, h, height: h, normalX: -s, normalY: c, flank: true, yaw, low: h <= 1.3, normal: { x: -s, y: c }, tangent: { x: c, y: s }, obstacle,
      positions: [{ x: x - s * (d / 2 + .65), y: y + c * (d / 2 + .65), z: 0 }, { x: x + s * (d / 2 + .65), y: y - c * (d / 2 + .65), z: 0 }] });
  }
  function crate(id, x, y, w = 1.4, d = 1.2, h = 1.2, covered = false) {
    if (covered) coverBox(id, x, y, w, d, h, 'wood'); else box(id, x, y, 0, w, d, h, 'wood');
    for (const dx of [-w * .37, w * .37]) box(`${id}-band`, x + dx, y, .05, .08, d + .03, h - .1, 'trim', { solid: false });
    box(`${id}-lid`, x, y, h - .09, w + .04, d + .04, .09, 'wood', { solid: false });
  }
  function container(id, x, y, w = 12.2, d = 2.5, key = 'teal') {
    box(id, x, y, 0, w, d, 2.65, key, { kind: 'container' });
    for (let dx = -w / 2 + .35; dx < w / 2; dx += .65) box(`${id}-rib`, x + dx, y - d / 2 - .025, .15, .065, .05, 2.4, 'trim', { solid: false });
    for (const yy of [-d / 2 + .08, d / 2 - .08]) box(`${id}-rail`, x, y + yy, 2.5, w + .12, .12, .12, 'steel', { solid: false });
    box(`${id}-door`, x + w / 2 + .02, y, .12, .08, d - .2, 2.4, 'steel', { solid: false });
  }
  function railing(id, x, y, length, yaw = 0, height = 1.15, z = 0) {
    // A single collision rail is honest about the visible non-vaultable waterfront boundary.
    box(id, x, y, z, length, .12, height, 'steel', { yaw });
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let t = -length / 2; t <= length / 2; t += 2.4) box(`${id}-post`, x + c * t, y + s * t, z, .13, .13, height + .12, 'steel', { solid: false });
    // Dark recessed panels make the collision plane read as a safety barrier, not passable bars.
    box(`${id}-panel`, x, y, z + .14, length, .16, height - .3, 'trim', { solid: false, yaw });
  }
  function fence(id, x, y, length, yaw = 0, gap = false) {
    const h = gap ? .95 : 2.6;
    box(id, x, y, 0, length, .18, h, 'steel', { yaw, kind: gap ? 'vault' : 'fence' });
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let t = -length / 2; t <= length / 2; t += 2.8) box(`${id}-post`, x + c * t, y + s * t, 0, .14, .24, h + .17, 'trim', { solid: false });
    box(`${id}-cap`, x, y, h - .1, length, .25, .12, 'cream', { solid: false, yaw });
  }
  function lamp(id, x, y, facing = 0, warm = true) {
    tube(x, y, 0, .13, 7.6, 'trim');
    box(`${id}-base`, x, y, 0, .6, .6, .25, 'concrete', { solid: false });
    solid(id, x, y, 0, .35, .35, 7.4, 0, { kind: 'streetlight' });
    const dx = Math.cos(facing) * 1.6, dy = Math.sin(facing) * 1.6;
    box(`${id}-arm`, x + dx / 2, y + dy / 2, 7.4, 1.9, .12, .13, 'trim', { solid: false, yaw: facing });
    box(`${id}-bulb`, x + dx, y + dy, 7.25, .75, .4, .13, warm ? 'light' : 'warm', { solid: false, yaw: facing });
    lamps.push({ x: x + dx, y: y + dy, z: 7.2, color: warm ? '#ffc78a' : '#b9d8eb', power: 18, reach: 24 });
    // Thin translucent pools provide a wet surface cue without dozens of expensive lights.
    const mat = material('warm');
    if (!materials.has('lamp-pool')) materials.set('lamp-pool', own(new T.MeshBasicNodeMaterial({ color: '#caa16d', transparent: true, opacity: .065, depthWrite: false })));
    const pool = new T.Mesh(own(new T.CircleGeometry(4.8, 18)), materials.get('lamp-pool')); pool.rotation.x = -Math.PI / 2; pool.position.set(x + dx, .038, y + dy); root.add(pool); unique.add(pool);
    return mat;
  }

  // A single level-sized floor, authored solids above it, and explicit visible harbor boundaries.
  box('ward-ground', 239, 210, -.6, 434, 372, .6, 'pavement', { surface: 'concrete' });
  box('harbor-seawall-east', 455, 210, -3.5, 2, 372, 3.5, 'brickDark');
  box('harbor-seawall-south', 239, 395, -3.5, 434, 2, 3.5, 'brickDark');
  specialBox('Calder Bay', 265, 285, -2, 1000, 1000, .15, 'water', { solid: false });
  railing('east-waterfront-rail', 451.5, 245, 296, Math.PI / 2);
  railing('south-waterfront-rail', 246, 391, 410);
  sign('CALDER BAY / DEEP WATER', 444, 355, 2.1, 5, 1.25, { yaw: Math.PI / 2, detail: 'NO ACCESS — RECOVERY AT LOW WATER YARD' });

  function road(segment) {
    const dx = segment.b[0] - segment.a[0], dy = segment.b[1] - segment.a[1], length = Math.hypot(dx, dy), yaw = Math.atan2(dy, dx), x = (segment.a[0] + segment.b[0]) / 2, y = (segment.a[1] + segment.b[1]) / 2;
    box(segment.id, x, y, .005, length + segment.width, segment.width, .025, 'asphalt', { solid: false, yaw });
    if (!segment.service) {
      for (const side of [-1, 1]) {
        const offset = side * (segment.width / 2 + 1.5), sx = x - Math.sin(yaw) * offset, sy = y + Math.cos(yaw) * offset;
        // Sidewalks are rendered slabs: the common ground stays traversable and avoids a hidden curb wall.
        box(`${segment.id}-pavement`, sx, sy, .014, length + segment.width, 2.6, .016, 'pavement', { solid: false, yaw });
        box(`${segment.id}-curb`, sx + Math.sin(yaw) * side * 1.25, sy - Math.cos(yaw) * side * 1.25, .016, length + segment.width, .2, .018, 'pale', { solid: false, yaw });
      }
      for (let t = 13; t < length - 7; t += 12) {
        const px = segment.a[0] + Math.cos(yaw) * t, py = segment.a[1] + Math.sin(yaw) * t;
        const atIntersection = [60, 240, 416].some(v => Math.abs(px - v) < 12) && [52, 202, 332, 380].some(v => Math.abs(py - v) < 12);
        if (!atIntersection) box('lane-dash', px, py, .041, 4, .11, .009, 'paint', { solid: false, yaw });
      }
    }
  }
  ROAD_SEGMENTS.forEach(road);
  // Redraw the intersection tops after the sidewalks; no seams or collision steps across the road.
  for (const x of [60, 240, 416]) for (const y of [52, 202, 332, 380]) {
    box('intersection', x, y, .035, 20, 20, .006, 'asphalt', { solid: false });
    if (y === 202 || (x === 240 && y === 332)) {
      for (let i = -4; i <= 4; i++) {
        box('crossing-north', x + i * 1.3, y - 11, .043, .65, 3, .006, 'paint', { solid: false });
        box('crossing-west', x - 11, y + i * 1.3, .043, 3, .65, .006, 'paint', { solid: false });
      }
    }
  }
  // Subtle puddles occupy road edges; all remain driveable.
  const puddleMat = own(new T.MeshStandardNodeMaterial({ color: '#788d94', roughness: .13, metalness: .28, transparent: true, opacity: .3, depthWrite: false }));
  const puddleGeo = own(new T.CircleGeometry(1, 18));
  for (let i = 0; i < 38; i++) {
    const seg = ROAD_SEGMENTS[i % 7], t = .1 + rnd() * .8, dx = seg.b[0] - seg.a[0], dy = seg.b[1] - seg.a[1], len = Math.hypot(dx, dy);
    const side = i % 2 ? 1 : -1, off = seg.width / 2 - .8;
    const puddle = new T.Mesh(puddleGeo, puddleMat); puddle.rotation.x = -Math.PI / 2; puddle.rotation.z = rnd() * Math.PI;
    puddle.position.set(seg.a[0] + dx * t - dy / len * off * side, .044, seg.a[1] + dy * t + dx / len * off * side); puddle.scale.set(1.5 + rnd() * 3, .45 + rnd() * .8, 1); root.add(puddle); unique.add(puddle);
  }

  function building(id, x, y, w, d, floors = 3, key = 'brick', front = 'south', label = '') {
    const h = floors * 3.6;
    box(id, x, y, 0, w, d, h, key, { kind: 'building' });
    box(`${id}-plinth`, x, y, 0, w + .35, d + .35, .6, 'brickDark', { solid: false });
    box(`${id}-cornice`, x, y, h - .2, w + .65, d + .65, .35, 'pale', { solid: false });
    box(`${id}-roof`, x, y, h + .15, w - 1, d - 1, .12, 'trim', { solid: false });
    for (let floor = 0; floor < floors; floor++) {
      const z = floor * 3.6 + 1.2;
      for (let xx = -w / 2 + 2.2; xx < w / 2 - 1; xx += 4) {
        for (const s of [-1, 1]) {
          const yy = y + s * (d / 2 + .035), lit = rnd() > .69;
          box('window-frame', x + xx, yy, z, 1.8, .12, 1.8, 'trim', { solid: false });
          box('window-pane', x + xx, yy + s * .075, z + .1, 1.5, .04, 1.55, lit ? 'warm' : 'glass', { solid: false });
          box('window-mullion', x + xx, yy + s * .1, z + .1, .075, .055, 1.55, 'trim', { solid: false });
        }
      }
      for (let yy = -d / 2 + 2.5; yy < d / 2 - 1; yy += 4.5) {
        for (const s of [-1, 1]) {
          const xx = x + s * (w / 2 + .04);
          box('side-window', xx, y + yy, z, .12, 1.7, 1.75, rnd() > .83 ? 'warm' : 'glass', { solid: false });
        }
      }
      if (floor) box('facade-floor-band', x, y, floor * 3.6, w + .1, d + .1, .16, 'pale', { solid: false });
    }
    // Clearly shuttered doors belong to closed facades; only authored hero spaces advertise interaction.
    const sy = y + (front === 'north' ? -1 : 1) * (d / 2 + .09);
    box(`${id}-closed-shutter`, x, sy, .02, 2.4, .15, 2.9, 'steel', { solid: false });
    for (let z = .4; z < 2.8; z += .3) box('shutter-slat', x, sy + (front === 'north' ? -.08 : .08), z, 2.3, .03, .035, 'trim', { solid: false });
    if (label) sign(label, x, sy + (front === 'north' ? -.12 : .12), 4.2, Math.min(w - 2, 13), 1.4, { yaw: front === 'north' ? Math.PI : 0 });
    // Chimneys, tank housings and ducts keep each roof's silhouette inhabited.
    box('rooftop-services', x - w * .2, y + d * .2, h + .2, 2.6, 3.1, 1.8, 'steel', { solid: false });
    tube(x + w * .3, y - d * .25, h + .2, .38, 2.7, 'brickDark');
  }

  // Streets define blocks; facades leave real rear lanes and readable pedestrian shortcuts.
  [
    ['mercers-row', 159, 31, 111, 17, 3, 'brickRed', 'south', 'MERCER STORAGE'],
    ['ferry-houses', 37, 119, 24, 95, 4, 'brick', 'south', ''],
    ['rivet-works', 201, 119, 43, 99, 4, 'brickDark', 'south', 'RIVET TOOL & DIE'],
    ['northline-office-block', 277, 109, 36, 81, 3, 'brickRed', 'south', 'CALDER LOGISTICS'],
    ['east-warehouse', 440, 52, 20, 39, 3, 'brickDark', 'south', ''],
    ['ferry-south-row', 36, 268, 23, 95, 4, 'brick', 'south', ''],
    ['market-back', 133, 256, 116, 14, 3, 'brickDark', 'north', ''],
    ['avenue-tenements', 198, 234, 42, 40, 5, 'brickRed', 'north', 'UNION WORKROOMS'],
    ['motor-supply', 159, 303, 69, 32, 2, 'brick', 'south', 'SERRANO PARTS / CLOSED'],
    ['junction-office', 277, 242, 34, 53, 4, 'brick', 'north', 'HARBOR ACCOUNTS'],
    ['south-factory', 344, 269, 75, 89, 3, 'brickDark', 'south', 'EASTBANK RECOVERY'],
    ['quay-archive', 440, 270, 20, 85, 3, 'brick', 'north', 'PORT ARCHIVE'],
    ['western-foundry', 152, 357, 126, 24, 2, 'brickDark', 'south', 'MORROW FOUNDRY / EST. 1931'],
    ['quiet-station', 288, 354, 28, 22, 1, 'brickRed', 'south', 'PUMP STATION 04'],
  ].forEach(args => building(...args));

  // A — Eli's complete drive-through interior, two open doors and sheltered repair apron.
  box('garage-floor', 97.5, 305, -.02, 35, 30, .1, 'concrete');
  box('garage-west', 80, 305, 0, .5, 30, 6.8, 'brickRed');
  box('garage-east', 115, 305, 0, .5, 30, 6.8, 'brickRed');
  for (const y of [290, 320]) {
    box('garage-door-left', 84, y, 0, 8, .5, 6.8, 'brickRed');
    box('garage-door-right', 107.5, y, 0, 15, .5, 6.8, 'brickRed');
    box('garage-door-lintel', 94, y, 4.7, 12, .65, 2.1, 'steel');
    box('garage-rolled-door', 94, y, 4.65, 11.8, .9, .5, 'cream', { solid: false });
  }
  const garageRoof = specialBox('garage-roof', 97.5, 305, 6.8, 36, 31, .28, 'trim');
  roofVolumes.push({ mesh: garageRoof, minX: 80, maxX: 115, minY: 290, maxY: 320, ceiling: 6.8 });
  box('garage-office-wall', 108, 295, 0, .16, 10, 2.8, 'steel');
  box('garage-office-glass', 108, 295, 1.2, .18, 9.6, 1.2, 'glass', { solid: false });
  box('garage-workbench', 111.5, 306, 0, 5, 1.2, 1, 'wood');
  box('garage-bench-top', 111.5, 306, 1, 5.2, 1.4, .12, 'steel', { solid: false });
  for (let i = 0; i < 6; i++) box('garage-tool', 109.5 + i * .65, 306, 1.12, .35, .25, .22, i % 2 ? 'yellow' : 'steel', { solid: false });
  box('garage-tool-board', 114.6, 309, 1.3, .12, 7, 1.6, 'trim', { solid: false });
  for (let i = 0; i < 7; i++) box('hanging-wrench', 114.45, 306.5 + i * .7, 1.65, .05, .12, .65, 'pale', { solid: false });
  box('service-desk', 111, 293.3, 0, 3.8, 1.3, .9, 'wood');
  box('desk-radio', 111.8, 293.3, .92, .65, .35, .36, 'trim', { solid: false });
  box('garage-coffee', 110, 293.2, .94, .2, .2, .27, 'cream', { solid: false });
  for (const x of [83.5, 104.5]) box('hydraulic-lift-post', x, 311, 0, .45, .45, 3.5, 'teal');
  for (let i = 0; i < 3; i++) { tube(83.5, 300 + i * 1.2, .05, .55, .85, 'black'); tube(83.5, 300 + i * 1.2, .91, .55, .25, 'black'); }
  box('toolbox-return-shelf', 107, 304, 0, 2.4, .8, .85, 'steel');
  sign('ELI’S MOTOR WORKS', 97.5, 320.4, 6.1, 28, 2.2, { bg: '#294d50', detail: 'RECOVERY • REPAIR • WE KEEP YOU MOVING' });
  sign('DRIVE THROUGH / BOTH BAYS OPEN', 94, 289.6, 3.8, 10, .8, { yaw: Math.PI, bg: '#4e635b' });
  box('garage-canopy', 97, 322.5, 4.4, 36, 5, .22, 'teal', { solid: false });
  for (const x of [82, 112]) box('garage-canopy-post', x, 324, 0, .16, .16, 4.4, 'steel');
  for (const x of [89, 101]) box('garage-striplight', x, 306, 6.4, 6, .3, .12, 'light', { solid: false });
  for (const y of [293, 317]) box('garage-walllight', 114.5, y, 3.5, .2, 1.1, .4, 'light', { solid: false });
  lamps.push({ x: 95, y: 306, z: 5.4, color: '#ffd19a', power: 19, reach: 26 });
  sign('MORROW WARD', 67, 283, 3.3, 11, 1.35, { yaw: -Math.PI / 2, detail: 'CALDER BAY / AVENUE 93' });

  // The active bay remains broad; working storage, rebuild equipment and a small office occupy its edges.
  for (const y of [293, 299, 305, 311, 317]) {
    box('garage-roof-girder', 97.5, y, 6.15, 34.4, .18, .34, 'steel', { solid: false });
    for (const x of [80.45, 114.55]) box('garage-wall-brace', x, y, .2, .2, .25, 6, 'steel', { solid: false });
  }
  for (const x of [80.28, 114.72]) {
    box('garage-painted-dado', x, 305, .15, .045, 29.4, 1.25, 'cream', { solid: false });
    box('garage-service-conduit', x + (x < 90 ? .035 : -.035), 305, 3.15, .06, 29.1, .065, 'steel', { solid: false });
  }
  for (const [x, y] of [[82.4, 294], [82.4, 317]]) shelf('garage-parts-rack', x, y, 3, 2.8);
  box('rebuild-bench', 83.4, 307, 0, 4.1, 1.25, .88, 'steel');
  box('rebuild-engine-block', 83.4, 307, .9, 1.25, .8, .5, 'trim', { solid: false });
  for (let i = 0; i < 4; i++) { tube(82.95 + i * .3, 307, 1.4, .11, .14, 'steel'); box('engine-exhaust-port', 83 + i * .28, 306.56, 1.08, .15, .15, .17, 'black', { solid: false }); }
  for (const x of [82.4, 84.4]) tube(x, 306.85, .94, .18, .3, 'orange');
  box('rolling-tool-chest', 109.1, 314.1, .12, 2.3, 1, 1.1, 'teal');
  for (let i = 0; i < 4; i++) {
    box('tool-chest-drawer', 109.1, 313.57, .24 + i * .23, 2.05, .04, .18, 'steel', { solid: false });
    box('tool-chest-pull', 109.1, 313.52, .29 + i * .23, .6, .06, .04, 'pale', { solid: false });
  }
  for (const x of [108.25, 109.95]) for (const y of [313.76, 314.44]) tube(x, y, .04, .13, .15, 'black');
  tube(112.8, 316.8, .08, .48, 1.4, 'orange');
  solid('air-compressor', 112.8, 316.8, .08, 1, 1, 1.75, 0, { kind: 'equipment' });
  box('compressor-motor', 112.8, 316.8, 1.48, .75, .55, .35, 'trim', { solid: false });
  box('compressor-gauge', 112.8, 316.42, 1.15, .2, .06, .2, 'cream', { solid: false });
  const hose = new T.Mesh(own(new T.TorusGeometry(.66, .028, 5, 24)), material('black')); hose.rotation.x = -Math.PI / 2; hose.position.set(111.8, .12, 317.1); root.add(hose); unique.add(hose);
  chair('office-chair-eli', 111.1, 294.65);
  box('service-counter-screen', 110.9, 293.3, .92, .8, .15, .55, 'trim', { solid: false });
  box('service-counter-screen-glow', 110.9, 293.2, 1.01, .62, .025, .37, 'blue', { solid: false });
  sign('REPAIR + RESPRAY / $80', 114.61, 303.1, 2.7, 6.2, .85, { yaw: Math.PI / 2, bg: '#385d59', detail: 'BRING YOUR CAR INTO THE MARKED BAY' });
  sign('KEEP THE WARD RUNNING', 80.31, 300.4, 3.8, 8, 1.15, { yaw: -Math.PI / 2, bg: '#5e4d3b', detail: 'ELI SERRANO / MUNICIPAL RECOVERY LOCAL 11' });
  sign('WORK ORDERS / LATE SHIFT', 114.62, 296.5, 2.1, 5, 1.55, { yaw: Math.PI / 2, bg: '#b9ae8d', fg: '#35403c', detail: 'BRAKES  /  TOW-IN  /  COLLECTION  /  COFFEE' });
  for (const x of [88.5, 99.5]) box('repair-bay-edge', x, 305, .086, .09, 26, .009, 'yellow', { solid: false });
  for (const y of [292, 318]) box('repair-bay-end', 94, y, .086, 11, .09, .009, 'yellow', { solid: false });
  floorStencil('SERVICE / 01', 94, 315.2, .098, 7.7, 1.7, 0);
  floorStencil('KEEP CLEAR', 94, 293.5, .098, 6.3, 1.4, 0);
  for (const x of [83.5, 104.5]) {
    box('lift-foot', x, 311, .08, 1.3, 1.1, .12, 'steel', { solid: false });
    box('lift-swing-arm', x + (x < 90 ? 1.2 : -1.2), 311.3, .2, 2.4, .23, .16, 'yellow');
  }
  for (const [x, y, w, d] of [[83.4, 307, 1.8, .75], [104.5, 314, 1.4, .7], [92, 319, 2.3, .55], [96.5, 291, 1.6, .6]]) puddle(x, y, .099, w, d, x < 89 || x > 100);

  // An optional, genuinely sloped inspection lane joins the north service lane to Foundry Road.
  box('inspection-lane', 120, 301, .008, 5.5, 64, .025, 'asphalt', { solid: false });
  serviceRamp('inspection-ramp-north', 120, 296, 4.4, 10, 0, .65);
  box('inspection-deck', 120, 305, -.16, 4.4, 8, .81, 'concrete', { kind: 'service-ramp' });
  serviceRamp('inspection-ramp-south', 120, 314, 4.4, 10, .65, 0);
  for (const x of [118.02, 121.98]) box('inspection-deck-edge', x, 305, .655, .12, 8, .012, 'yellow', { solid: false });
  floorStencil('INSPECTION', 120, 305, .67, 3.6, 1.4, Math.PI / 2);
  sign('INSPECTION LANE', 115.35, 316.6, 2.6, 7, 1, { yaw: -Math.PI / 2, bg: '#67583e', detail: 'LOW RAMP / WALKING SPEED / BOTH ENDS OPEN' });
  softCone('inspection-soft-cone-west', 119.05, 323.4);
  softCone('inspection-soft-cone-east', 120.95, 323.4);

  // B — the market has two genuinely open service counters; neighboring shutters are closed.
  box('market-floor', 114, 232, -.01, 84, 24, .12, 'concrete');
  box('market-rear-wall', 114, 243, 0, 84, .45, 4.2, 'brick');
  for (const x of [73, 104, 128, 155]) box('market-pier', x, 232, 0, .55, 22, 4.2, 'brickRed');
  box('market-top', 114, 221, 3.4, 84, .6, .9, 'steel');
  const marketRoof = specialBox('market-roof', 114, 232, 4.3, 85, 24, .25, 'trim');
  roofVolumes.push({ mesh: marketRoof, minX: 73, maxX: 156, minY: 221, maxY: 244, ceiling: 4.3 });
  box('market-awning', 114, 217.8, 3.25, 86, 6.8, .16, 'teal', { solid: false });
  for (let x = 76; x < 155; x += 5) box('awning-stripe', x, 217.8, 3.24, 1.5, 6.9, .2, 'cream', { solid: false });
  for (const x of [77, 151]) box('awning-post', x, 215.4, 0, .13, .13, 3.25, 'steel');
  // Service counters leave broad customer aisles behind the pavement.
  box('food-counter', 91, 229, 0, 13, 1.1, 1.04, 'cream');
  box('food-worktop', 91, 229, 1.04, 13.2, 1.3, .1, 'steel', { solid: false });
  for (const x of [87, 90, 93, 96]) {
    box('food-tray', x, 229, 1.16, 1.5, .75, .08, 'wood', { solid: false });
    for (const dx of [-.43, 0, .43]) box('bread', x + dx, 229, 1.23, .35, .42, .18, 'yellow', { solid: false });
  }
  box('shop-fridge', 77, 239, 0, 2.2, 1.2, 2.4, 'cream');
  box('shop-fridge-glass', 77, 238.35, .3, 1.7, .04, 1.7, 'glass', { solid: false });
  box('workwear-counter', 140, 230, 0, 16, 1.1, 1.05, 'steel');
  for (const x of [135, 139, 143, 147]) {
    box('vest-display', x, 241, 1.5, .66, .22, .78, 'green', { solid: false });
    for (const dx of [-.23, .23]) box('vest-shoulder', x + dx, 241, 2.2, .13, .22, .24, 'green', { solid: false });
    box('vest-reflector', x, 240.87, 1.82, .66, .035, .075, 'yellow', { solid: false });
    box('vest-pocket', x, 240.86, 1.6, .36, .035, .16, 'trim', { solid: false });
  }
  sign('MORROW MARKET', 114, 220.5, 4.15, 39, 1.8, { yaw: Math.PI, bg: '#3b5b50', detail: 'HOT FOOD • WORKWEAR • NEIGHBORHOOD GOODS' });
  sign('SOUP & BREAD / $10', 91, 221.4, 2.75, 17, .8, { bg: '#746347', yaw: Math.PI });
  sign('HARBOR WORKWEAR / $60', 141, 221.4, 2.75, 20, .8, { bg: '#3c4a53', yaw: Math.PI });
  lamps.push({ x: 91, y: 226, z: 3.1, color: '#ffd5a3', power: 10, reach: 18 }, { x: 141, y: 226, z: 3.1, color: '#dfd9bb', power: 10, reach: 18 });
  const closedShop = specialBox('disputed-store-shutter', 116, 221.25, 0, 21, .2, 3.35, 'steel', { solid: false });
  // This storefront is explicitly noninteractive in both endings; its takeover notice changes.
  const marketNotice = sign('LEASE UNDER REVIEW', 116, 221.05, 1.8, 8, 1.1, { yaw: Math.PI, bg: '#7c715c' });
  const toolboxMesh = specialBox('misplaced-toolbox', 153, 245, .05, .95, .5, .4, 'teal');
  const toolboxHandle = specialBox('toolbox-handle', 153, 245, .45, .4, .08, .15, 'steel', { solid: false });
  pickups.set('toolbox', { meshes: [toolboxMesh, toolboxHandle], body: obstacles.find(o => o.id === 'misplaced-toolbox')?.body });
  for (const x of [82, 163]) { box('market-bin', x, 214.5, 0, .9, .9, 1.2, 'green'); box('market-bin-lid', x, 214.5, 1.2, 1, 1, .1, 'trim', { solid: false }); }
  for (const x of [115, 145]) { box('market-bench-seat', x, 210.5, .43, 3, .6, .15, 'wood', { solid: false }); box('bench-back', x, 210.8, .57, 3, .12, .6, 'wood', { solid: false }); for (const dx of [-1, 1]) box('bench-leg', x + dx, 210.5, 0, .13, .5, .43, 'steel', { solid: false }); }
  for (const x of [80, 91, 101, 134, 145, 152]) striplight('market-counter-light', x, 225.5, 3.65, 2.1);
  tube(85, 229, 1.15, .39, .46, 'steel'); tube(85, 229, 1.62, .42, .045, 'pale');
  for (const x of [98.8, 100.4]) {
    box('food-supply-stack', x, 240.9, 0, 1.2, 1.1, 1.15, 'wood');
    for (let i = 0; i < 3; i++) box('supply-crate-slat', x, 240.3, .13 + i * .32, 1.1, .045, .16, 'cream', { solid: false });
  }
  sign('HOT MEAL / TEN DOLLARS', 91, 228.38, .72, 5.6, .64, { yaw: Math.PI, bg: '#6b553a', detail: 'SOUP  +  BREAD  /  NO ONE LEFT COLD' });
  sign('HARBOR WORKWEAR', 140, 229.38, .73, 7, .65, { yaw: Math.PI, bg: '#355359', detail: 'PROTECTIVE VEST / $60 / ASK AT THE COUNTER' });
  sign('MORROW NIGHT MARKET', 113, 243.27, 2.7, 17, 1.2, { bg: '#614c40', detail: 'LOOK AFTER YOUR NEIGHBORS' });
  for (const [x, y, z] of [[89, 216.9, .04], [130, 214.4, .04], [153, 221.1, .117]]) puddle(x, y, z, 1.2 + rnd(), .45 + rnd() * .2);
  for (const x of [81, 110, 135, 154]) box('market-gutter-joint', x, 214.55, 3.11, .07, .13, .14, 'rust', { solid: false });

  // C — an elevated freight line frames the market and interrupts police sight at the junction.
  box('elevated-deck', 240, 185, 10.2, 442, 11, 1.1, 'concrete');
  for (const y of [181, 189]) {
    box('overpass-girder', 240, y, 9.4, 444, .65, 1.6, 'steel', { solid: false });
    box('overpass-parapet', 240, y + (y < 185 ? -1 : 1) * 1.2, 11.3, 442, .3, .95, 'trim', { solid: false });
  }
  for (let x = 26; x < 457; x += 7) box('rail-sleeper', x, 185, 11.32, .25, 5.2, .16, 'wood', { solid: false });
  for (const y of [183.8, 186.2]) box('rail-line', 240, y, 11.5, 442, .13, .16, 'steel', { solid: false });
  for (const x of [29, 101, 165, 304, 368, 450]) {
    for (const y of [181, 189]) box(`overpass-pillar-${x}-${y}`, x, y, 0, 1.65, 1.65, 10.2, 'concrete', { kind: 'pillar' });
    box('overpass-capital', x, 185, 8.8, 2.4, 13, 1.3, 'concrete', { solid: false });
  }
  sign('AVENUE 93', 248, 190, 5.8, 12, 1.4, { bg: '#244f52', detail: '← FERRY ST.     QUAY ST. →' });
  sign('NORTHLINE DISPATCH →', 268, 209, 3.7, 13, 1.4, { bg: '#48564d' });
  for (const x of [101, 165, 304, 368]) {
    box('overpass-pillar-warning', x, 189.85, .1, 1.65, .035, .65, 'yellow', { solid: false });
    for (const dx of [-.6, -.2, .2, .6]) box('overpass-pillar-stripe', x + dx, 189.88, .1, .11, .035, .65, 'black', { solid: false });
    box('overpass-storm-pipe', x + 1.3, 185, .15, .18, .18, 9.1, 'rust', { solid: false });
  }
  sign('RIVET / AVENUE 93', 235, 190.4, 3.55, 8.5, 1, { bg: '#2c4f51', detail: 'MORROW WARD / FREIGHT LINE 06' });
  for (const [x, y] of [[221, 190], [253, 199], [235, 218]]) {
    box('junction-drain', x, y, .041, 1.1, .65, .014, 'trim', { solid: false });
    for (let i = 0; i < 6; i++) box('drain-slat', x - .43 + i * .17, y, .057, .055, .57, .008, 'steel', { solid: false });
    puddle(x + .7, y + .3, .065, 1.8, .55);
  }
  for (const [x, y] of [[228, 190], [251, 214], [228, 321], [251, 344]]) {
    tube(x, y, 0, .09, 5.3, 'trim'); box('traffic-signal', x, y, 3.8, .45, .35, 1.2, 'black', { solid: false });
    const red = specialBox('traffic-light-red', x, y - .2, 4.56, .22, .07, .22, 'signalRed', { solid: false });
    const amber = specialBox('traffic-light-amber', x, y - .2, 4.2, .22, .07, .22, 'signalAmber', { solid: false });
    const green = specialBox('traffic-light-green', x, y - .2, 3.87, .22, .07, .22, 'signalGreen', { solid: false });
    trafficSignals.push({ red, amber, green, horizontal: x === 228, definition: ROAD_GRAPH.signals.find(s => s.id === (y < 250 ? 'r11' : 'r12')) });
  }

  // D — complete depot compound, front gate, rear vault, ten tactically placed cover objects.
  box('depot-hardstand', 349, 117, .001, 102, 94, .08, 'asphalt', { solid: false });
  fence('depot-west-fence', 299, 117, 94, Math.PI / 2);
  fence('depot-north-fence', 349, 69, 102);
  fence('depot-south-fence-west', 319.5, 164, 41);
  fence('depot-south-fence-east', 378.5, 164, 43);
  fence('depot-east-north', 400, 76.5, 15, Math.PI / 2);
  fence('depot-east-vault', 400, 88, 8, Math.PI / 2, true);
  fence('depot-east-south', 400, 128, 72, Math.PI / 2);
  for (const x of [340, 356]) { box('depot-gate-post', x, 164, 0, .7, .7, 4.3, 'steel'); box('depot-warning-lamp', x, 164, 3.8, .4, .4, .4, 'warm', { solid: false }); }
  box('depot-open-gate-west', 337, 160.4, 0, .2, 6.8, 2.6, 'steel');
  box('depot-open-gate-east', 359, 160.4, 0, .2, 6.8, 2.6, 'steel');
  sign('NORTHLINE DISPATCH', 349, 164.4, 4.5, 27, 2.2, { bg: '#34494f', detail: 'AUTHORIZED RECOVERY CREW ONLY' });
  sign('SERVICE / LOW BARRIER', 400.2, 89, 2.1, 7, 1, { yaw: -Math.PI / 2, bg: '#705f42' });
  box('depot-office-floor', 334, 87, -.02, 32, 28, .12, 'concrete');
  box('office-west-wall', 318, 87, 0, .4, 28, 6.5, 'brickRed');
  box('office-east-wall', 350, 87, 0, .4, 28, 6.5, 'brickRed');
  box('office-north-wall', 334, 73, 0, 32, .4, 6.5, 'brickRed');
  // Front door is 4.6m wide and 2.9m tall, with a real interior beyond it.
  box('office-south-west', 323.1, 101, 0, 10.2, .4, 6.5, 'brickRed');
  box('office-south-east', 342.9, 101, 0, 14.2, .4, 6.5, 'brickRed');
  box('office-door-lintel', 333, 101, 2.9, 9.6, .4, 3.6, 'brickRed');
  // The upper floor leaves the east stairwell open along its whole flight.
  box('office-upper-floor', 328.5, 87, 3.05, 21, 28, .18, 'wood');
  box('office-stair-landing', 344.4, 76.4, 3.05, 10.5, 6.8, .18, 'wood');
  for (let i = 0; i < 16; i++) {
    const h = (i + 1) * .2;
    box(`office-step-${i}`, 343, 89 - i * .68, 0, 3.2, .7, h, 'concrete', { kind: 'stair' });
    box('stair-tread', 343, 89 - i * .68, h, 3.2, .13, .035, 'yellow', { solid: false });
  }
  railing('office-balustrade', 339.1, 86, 12, Math.PI / 2, 1.15, 3.23);
  const officeRoof = specialBox('office-roof', 334, 87, 6.5, 33, 29, .25, 'trim');
  roofVolumes.push({ mesh: officeRoof, minX: 317.6, maxX: 350.4, minY: 72.6, maxY: 101.4, ceiling: 6.5 });
  sign('PAYROLL & DISPATCH', 333, 101.35, 4.7, 21, 1.5, { bg: '#6a624d', detail: 'VISITORS REPORT TO OFFICE' });
  for (const x of [321, 345]) for (const z of [1.1, 4.3]) box('office-front-window', x, 101.25, z, 3.4, .06, 1.6, 'glass', { solid: false });
  for (const x of [322, 336]) { box('office-desk', x, 92, 0, 3.2, 1.5, .82, 'wood'); box('office-monitor', x, 92.4, .84, .7, .18, .55, 'trim', { solid: false }); box('office-desk-leg', x - 1.1, 92, 0, .12, 1.1, .8, 'steel', { solid: false }); }
  box('office-upper-desk', 327, 83, 3.23, 4, 1.5, .8, 'wood');
  for (const x of [323, 333]) box('office-paper', x, 92, .84, .55, .35, .035, 'cream', { solid: false });
  box('payroll-cabinet-back', 320.5, 82, 0, .1, 2.3, 2.1, 'steel');
  for (const y of [80.9, 83.1]) box('payroll-cabinet-side', 321, y, 0, 1.1, .1, 2.1, 'steel');
  for (const z of [.05, .97, 2.05]) box('payroll-cabinet-shelf', 321, 82, z, 1.1, 2.3, .08, 'steel');
  caseDoor = new T.Group(); caseDoor.name = 'wired payroll cabinet door'; caseDoor.position.set(321.58, .1, 80.85); root.add(caseDoor);
  const doorPanel = new T.Mesh(cube, material('pale')); doorPanel.scale.set(.08, 1.96, 2.3); doorPanel.position.set(0, .98, 1.15); doorPanel.castShadow = true; caseDoor.add(doorPanel);
  const doorHandle = new T.Mesh(cube, material('trim')); doorHandle.scale.set(.12, .25, .08); doorHandle.position.set(.09, 1.02, 1.95); caseDoor.add(doorHandle);
  caseDoorBody = solid('payroll-cabinet-door', 321.58, 82, .1, .08, 2.3, 1.96).body;
  pickups.set('case', { meshes: [specialBox('payroll-case', 321, 82, 1.05, .7, 1, .25, 'black', { solid: false })] });
  box('wired-alarm', 318.3, 81, 2.5, .16, .65, .65, 'rust', { solid: false });
  box('alarm-cable', 318.25, 84, 2.7, .045, 6, .045, 'black', { solid: false });
  box('office-fluorescent', 331, 89, 6.1, 9, .25, .12, 'light', { solid: false });
  box('office-downstairs-fluorescent', 331, 89, 2.8, 5, .25, .1, 'light', { solid: false });
  lamps.push({ x: 333, y: 89, z: 2.55, color: '#e9e2c5', power: 4, reach: 18, maxFocusZ: 2.7 });

  // Dispatch is a working late-shift office: consoles, records, staff table and live alarm hardware.
  for (const x of [322, 336]) {
    chair('dispatch-desk-chair', x, 94.1);
    box('dispatch-keyboard', x, 91.8, .84, .6, .22, .045, 'cream', { solid: false });
    box('dispatch-monitor-screen', x, 92.29, .98, .57, .025, .32, 'blue', { solid: false });
    box('dispatch-desk-phone', x + 1.1, 91.9, .84, .34, .25, .13, 'trim', { solid: false });
    tube(x - 1, 92.1, .85, .09, .18, 'cream');
  }
  box('dispatch-console', 331.8, 75.7, 0, 13, 1.2, .97, 'steel');
  box('dispatch-console-top', 331.8, 75.7, .97, 13.1, 1.3, .08, 'trim', { solid: false });
  for (const x of [326.5, 330.5, 334.5, 337]) {
    box('console-terminal', x, 75.7, 1.05, .82, .2, .55, 'trim', { solid: false });
    box('console-terminal-screen', x, 75.84, 1.12, .66, .025, .38, 'blue', { solid: false });
    for (let i = 0; i < 3; i++) box('terminal-readout', x, 75.86, 1.2 + i * .08, .44 - i * .08, .015, .017, 'paint', { solid: false });
  }
  sign('NORTHLINE / DISPATCH BOARD', 330.8, 73.28, 2.3, 12.5, 1.5, { bg: '#3e5557', detail: 'NIGHT SHIFT  /  06:00 RETURNS  /  UNPAID LOADS ON HOLD' });
  // Glazed records/staff divisions make human-sized work areas around the open extraction aisle.
  for (const p of [{ x: 328, y: 79, w: .12, d: 10 }, { x: 322.75, y: 86, w: 6.5, d: .12 }, { x: 339.2, y: 96.6, w: .12, d: 8 }]) {
    solid('office-glazed-partition', p.x, p.y, .1, p.w, p.d, 2.55, 0, { kind: 'office-partition' });
    box('partition-base-panel', p.x, p.y, .1, p.w, p.d, .9, 'cream', { solid: false });
    box('partition-glass', p.x, p.y, 1.05, p.w, p.d, 1.35, 'glass', { solid: false });
    box('partition-top-rail', p.x, p.y, 2.42, p.w + .04, p.d + .04, .12, 'steel', { solid: false });
    const length = Math.max(p.w, p.d);
    for (let offset = -length / 2; offset <= length / 2; offset += 1.5) box('partition-mullion', p.x + (p.w > p.d ? offset : 0), p.y + (p.d > p.w ? offset : 0), .1, .075, .075, 2.55, 'steel', { solid: false });
  }
  box('records-door-header', 327, 86, 2.49, 2.1, .15, .18, 'steel', { solid: false });
  sign('PAYROLL RECORDS', 327, 86.12, 2.78, 2.9, .45, { bg: '#615940' });
  for (const y of [75.7, 88, 97]) {
    box('office-files', 319.15, y, 0, .95, 1.5, 2.25, 'steel');
    for (let i = 0; i < 4; i++) { box('file-drawer-front', 319.66, y, .15 + i * .52, .04, 1.35, .43, 'pale', { solid: false }); box('file-drawer-pull', 319.7, y, .36 + i * .52, .05, .3, .035, 'trim', { solid: false }); }
  }
  box('staff-table', 325.3, 97.7, 0, 4.4, 1.65, .78, 'wood');
  chair('staff-chair-west', 323.6, 99.2);
  chair('staff-chair-east', 326.8, 99.2);
  for (const x of [324.3, 326.1]) { tube(x, 97.7, .8, .08, .17, 'cream'); box('staff-paperwork', x + .4, 97.6, .8, .5, .35, .025, 'paper', { solid: false }); }
  box('dispatch-kitchenette', 348.6, 96.2, 0, 1.8, 5.2, .9, 'cream');
  box('dispatch-sink', 348.6, 96.8, .91, 1.2, 1.2, .07, 'steel', { solid: false });
  box('coffee-machine', 348.6, 94.9, .92, .55, .7, .65, 'trim', { solid: false });
  box('coffee-machine-panel', 348.28, 94.9, 1.1, .04, .44, .2, 'pale', { solid: false });
  sign('PAYROLL RECORDS / SEALED', 318.24, 82.2, 2.55, 5.8, .76, { yaw: -Math.PI / 2, bg: '#6b5541', detail: 'CABINET 03 / OPENING SIGNALS THE DISPATCHER' });
  sign('STAFF / STAIRS', 347.2, 100.74, 2.15, 3.7, .68, { yaw: Math.PI, bg: '#3c555b', detail: 'UPPER DISPATCH OFFICE' });
  box('alarm-wire-to-cabinet', 319.93, 81, 2.69, 3.3, .035, .035, 'black', { solid: false });
  box('cabinet-contact-wire', 321.57, 81, 2.1, .035, .035, .6, 'black', { solid: false });
  box('cabinet-magnetic-contact', 321.58, 81, 1.94, .12, .19, .1, 'orange', { solid: false });
  const cabinetAlarm = specialBox('cabinet-alarm-led', 318.42, 80.86, 2.72, .07, .13, .13, 'signalGreen', { solid: false });
  floorStencil('DISPATCH', 333, 97.7, .106, 5.5, 1.05);
  box('office-wall-baseboard', 334, 74.2, .12, 31, .08, .22, 'trim', { solid: false });
  for (const [x, width] of [[323.1, 10.2], [342.9, 14.2]]) box('office-front-baseboard', x, 100.74, .12, width, .08, .22, 'trim', { solid: false });
  for (const x of [318.35, 349.65]) box('office-side-baseboard', x, 87, .12, .08, 27, .22, 'trim', { solid: false });
  for (const [x, y, z, length] of [[327, 81.5, 2.79, 3.1], [325.5, 96, 2.79, 3.1], [333, 90, 6.1, 4]]) striplight('dispatch-light', x, y, z, length);
  lamps.push({ x: 325.2, y: 82, z: 2.42, color: '#e1ddc7', power: 2.8, reach: 12, maxFocusZ: 2.7 }, { x: 324.8, y: 96, z: 2.43, color: '#e1ddc7', power: 2.2, reach: 11, maxFocusZ: 2.7 });
  // The upper office reads differently from the records floor without occupying its stair landing.
  box('upper-office-file-bank', 322, 75.5, 3.23, 5, 1.2, 1.9, 'steel');
  chair('upper-dispatch-chair', 327, 84.5, 3.23);
  box('upper-desk-terminal', 327, 83.2, 4.05, .8, .18, .6, 'trim', { solid: false });
  box('upper-desk-screen', 327, 83.08, 4.17, .64, .025, .35, 'blue', { solid: false });
  lamps.push({ x: 327, y: 83, z: 5.8, color: '#e6dfc8', power: 5, reach: 15, minFocusZ: 2.8 });
  sign('MORROW / ROUTE CONTROL', 329, 73.27, 5.25, 13, 1.25, { bg: '#3b4f54', detail: 'FERRY STREET — RIVET AVENUE — QUAY STREET' });
  box('ammo-table', 320, 106, 0, 3, 1.2, .8, 'steel');
  pickups.set('depot-ammo', { meshes: [specialBox('ammo-box', 320, 106, .8, .7, .5, .24, 'yellow', { solid: false })] });
  coverBox('gate-concrete-west', 330, 148, 6, .9, 1.05);
  coverBox('gate-concrete-east', 373, 151, 6, .9, 1.05);
  crate('west-stack-a', 317, 135, 4, 2.2, 1.25, true);
  crate('west-stack-b', 325, 120, 3.6, 2.2, 1.65, true);
  coverBox('office-barrier', 334, 110, 5.8, .8, 1.05);
  coverBox('center-low-cover', 350, 129, 5, 1, 1.05);
  crate('east-cargo-stack', 381, 127, 4.8, 2.3, 1.25, true);
  coverBox('east-barrier', 385, 143, 4.8, .9, 1.05);
  coverBox('rear-generator', 377, 102, 4.2, 2.4, 1.6, 'steel');
  coverBox('rear-cabinet', 391, 81, 2, 3.8, 1.35, 'steel');
  pickups.set('depot-smg', { meshes: [specialBox('smg-pickup', 380.8, 127, 1.28, 1.1, .18, .16, 'black', { solid: false })] });
  container('depot-container', 371, 76, 12.2, 2.5, 'rust');
  container('depot-container-north', 386, 76, 12.2, 2.5, 'teal');
  for (const [x, y] of [[306, 151], [391, 153], [308, 78], [359, 124]]) lamp(`depot-lamp-${x}`, x, y, x < 350 ? 0 : Math.PI);
  lamps.push({ x: 348, y: 162, z: 3.8, color: '#ffd099', power: 28, reach: 27 });
  sign('KEEP THE FLANK CLEAR', 309, 114, 2.1, 8, 1, { yaw: Math.PI / 2, bg: '#7a6d48' });
  floorStencil('NO PARKING / ACCESS', 348, 154.6, .09, 10.5, 1.25);
  for (const y of [116, 136, 156]) for (let x = 303; x < 399; x += 7) box('depot-yard-joint', x, y, .084, 5.6, .026, .006, 'trim', { solid: false });
  for (const [x, y] of [[330, 139], [371, 112], [389, 96], [347, 158]]) puddle(x, y, .09, 2 + rnd(), .65 + rnd() * .3);
  for (const item of cover) {
    if (item.id.includes('concrete') || item.id.includes('barrier') || item.id.includes('low-cover')) {
      box('cover-reflector', item.x, item.y + item.d / 2 + .012, item.h - .22, Math.min(1.5, item.w - .2), .025, .11, 'yellow', { solid: false });
      box('cover-bottom-stain', item.x, item.y + item.d / 2 + .014, .05, item.w - .1, .025, .2, 'trim', { solid: false });
    }
  }

  // E — container concealment, two drive exits, foot return and a quiet actual drop.
  box('waterfront-yard', 383, 355, .002, 102, 42, .07, 'asphalt', { solid: false });
  container('waterfront-container-a', 349, 348, 12.2, 2.5, 'rust');
  container('waterfront-container-b', 365, 365, 12.2, 2.5, 'teal');
  container('waterfront-container-c', 400, 347, 12.2, 2.5, 'steel');
  container('waterfront-container-d', 439, 363, 12.2, 2.5, 'rust');
  container('waterfront-container-e', 343, 368, 12.2, 2.5, 'cream');
  box('maintenance-shed', 404, 362, 0, 8, 10, 3.5, 'steel');
  box('maintenance-shed-roof', 404, 362, 3.5, 9, 11, .2, 'trim', { solid: false });
  box('reporter-dropbox', 385, 360, 0, 1.2, 1.1, 1.7, 'teal');
  box('reporter-letter-slot', 385, 359.42, 1.25, .7, .05, .09, 'black', { solid: false });
  sign('THE MORROW RECORD', 385, 359.36, 2.15, 7, 1.1, { yaw: Math.PI, bg: '#294c54', detail: 'COMMUNITY MAIL / CONFIDENTIAL TIP DROP' });
  sign('LOW WATER MAINTENANCE', 379, 339, 4.1, 24, 1.6, { yaw: Math.PI, bg: '#4a666b' });
  const reporterNotice = sign('A WARD WORTH KEEPING', 405, 356.9, 2.2, 6, 1.2, { yaw: Math.PI, bg: '#4f6255' });
  lamp('waterfront-lamp', 389, 356, -Math.PI / 2);
  for (const x of [277, 315]) lamp('quayside-lamp', x, 387, -Math.PI / 2, false);
  sign('WATERFRONT RETURN ←', 435, 379, 2.6, 12, 1.1, { yaw: Math.PI, bg: '#3b5966' });
  sign('LOW WATER / MORROW WARD', 379, 339.2, 4.1, 24, 1.6, { bg: '#4a666b', detail: 'PUBLIC WALKWAY / KEEP THE QUAY CLEAR' });
  sign('THE MORROW RECORD', 385, 360.62, 2.15, 6.4, 1.1, { bg: '#294c54', detail: 'A WARD WORTH KEEPING' });
  box('maintenance-window-frame', 402.5, 356.91, 1.0, 2.6, .14, 1.4, 'trim', { solid: false });
  box('maintenance-lit-window', 402.5, 356.82, 1.12, 2.25, .035, 1.12, 'warm', { solid: false });
  for (const x of [401.9, 403.1]) box('maintenance-window-divider', x, 356.78, 1.12, .075, .05, 1.12, 'trim', { solid: false });
  box('maintenance-closed-door', 406.4, 356.85, .03, 1.2, .1, 2.5, 'teal', { solid: false });
  box('maintenance-door-lock', 406.0, 356.75, 1.05, .12, .06, .12, 'pale', { solid: false });
  striplight('maintenance-entry-light', 406.2, 356.5, 2.9, 1.8);
  sign('STAFF ONLY', 406.4, 356.72, 1.9, .9, .35, { yaw: Math.PI, bg: '#475651' });
  for (const y of [342, 373, 386]) {
    tube(448.4, y, .02, .26, .7, 'steel');
    box('quay-bollard-head', 448.4, y, .58, .9, .35, .16, 'steel', { solid: false });
    solid('quay-bollard', 448.4, y, 0, .9, .52, .77, 0, { kind: 'quay-equipment' });
  }
  const mooringRope = own(new T.TorusGeometry(.65, .045, 5, 24));
  for (const [x, y] of [[447.2, 372.9], [447.6, 386]]) { const rope = new T.Mesh(mooringRope, material('wood')); rope.rotation.x = -Math.PI / 2; rope.position.set(x, .1, y); root.add(rope); unique.add(rope); }
  box('pallet-jack-base', 344, 365.2, .08, 1.1, 2.1, .24, 'yellow');
  for (const x of [343.6, 344.4]) box('pallet-jack-fork', x, 364.3, .08, .18, 2.7, .12, 'yellow', { solid: false });
  box('pallet-jack-handle', 344, 366.05, .32, .07, .07, 1.15, 'trim', { solid: false });
  box('pallet-jack-grip', 344, 366.05, 1.44, .52, .08, .1, 'trim', { solid: false });
  sign('LOW WATER / BAY 04', 343, 366.7, 1.65, 8, .8, { yaw: Math.PI, bg: '#5f6253', detail: 'RETURN TOOLS / PROTECT THE WATER' });
  for (const [x, y] of [[389.5, 359], [412.6, 352.3], [442.2, 375]]) puddle(x, y, .09, 2.1, .7);

  // F — broker court is enclosed by brickwork, opens onto the north loop and has a turn-around.
  box('broker-court-ground', 104, 87, .002, 60, 48, .06, 'asphalt', { solid: false });
  building('broker-warehouse', 128, 84, 21, 43, 2, 'brickDark', 'north');
  box('broker-west-wall', 77, 86, 0, .5, 44, 3.3, 'brick');
  box('broker-south-wall', 100, 108, 0, 47, .5, 3.3, 'brick');
  box('broker-north-wall', 87, 62, 0, 21, .5, 3.3, 'brick');
  box('broker-loading-dock', 119, 88, 0, 5, 15, .9, 'concrete');
  box('broker-drop-safe', 91, 91, 0, 1.4, 1.2, 1.6, 'steel');
  sign('NORTHLINE / PRIVATE LOADING', 100, 108.3, 2.5, 24, 1.35, { bg: '#4b4844', detail: 'NO PUBLIC COLLECTIONS' });
  sign('SECURE COURIER DROP', 91, 90.35, 2.25, 6, 1.1, { yaw: Math.PI, bg: '#514650' });
  lamp('broker-lamp', 82, 102, -Math.PI / 2);
  crate('broker-packages', 117, 100, 2, 1.5, 1.4);
  sign('COURIER BAY / 02', 117.37, 87.4, 3.7, 12, 1.4, { yaw: Math.PI / 2, bg: '#50454b', detail: 'SEALED DELIVERIES / NO SIGNATURE REQUIRED' });
  for (const y of [82.8, 88, 93.2]) box('loading-dock-bumper', 116.39, y, .22, .2, 1.3, .6, 'black', { solid: false });
  box('broker-safe-panel', 91, 90.37, .18, 1.14, .055, 1.2, 'trim', { solid: false });
  box('broker-safe-handle', 91.38, 90.3, .68, .075, .08, .28, 'pale', { solid: false });
  floorStencil('COURIER / 02', 100, 92, .075, 6.3, 1.2);

  // Place lights along the two loops, leaving hero spaces as warmer compositions.
  for (const y of [72, 153, 237, 305, 362]) { lamp('west-streetlight', 49, y, 0); lamp('east-streetlight', 427, y, Math.PI); }
  for (const x of [88, 183, 281, 385]) { lamp('avenue-light', x, 213, -Math.PI / 2); lamp('foundry-light', x, 342.8, -Math.PI / 2); }
  for (const x of [143, 305, 378]) lamp('mercer-light', x, 42, Math.PI / 2);
  lamp('garage-street-lamp', 110, 326, Math.PI);
  const practicalLights = Array.from({ length: quality === 'low' ? 2 : 4 }, () => { const light = new T.PointLight('#ffd099', 15, 22, 1.3); root.add(light); return light; });

  // Enclosed boundaries read as buildings/retaining walls; no invisible street ends.
  box('west-boundary-wall', 23, 210, 0, 2, 372, 4.2, 'brickDark');
  box('north-boundary-wall', 239, 24, 0, 434, 2, 3.2, 'brickDark');
  for (const [x, y] of [[60, 25], [240, 25], [416, 25]]) { box('road-end-planter', x, y + 7, 0, 10, 1.4, 1.1, 'concrete'); sign('PORT ACCESS CLOSED', x, y + 7.8, 2.1, 9, .85, { detail: 'USE THE AVENUE' }); }
  // Original skyline silhouettes beyond the playable district; they have no advertised doors.
  for (let i = 0; i < 23; i++) {
    const x = 5 + i * 23, y = -22 - rnd() * 38, h = 15 + rnd() * 42;
    box('north-skyline', x, y, -1, 13 + rnd() * 12, 18 + rnd() * 19, h, i % 2 ? 'brickDark' : 'steel', { solid: false });
  }
  for (let i = 0; i < 10; i++) box('across-the-bay-skyline', 525 + i * 19, 110 + i * 26, -1, 14 + rnd() * 22, 24, 18 + rnd() * 50, 'brickDark', { solid: false });

  // Flush repeated architecture into one instanced draw per material/primitive family.
  for (const [name, bucket] of buckets) {
    const mesh = new T.InstancedMesh(bucket.geo, material(bucket.key), bucket.instances.length); mesh.name = `Morrow ${name}`;
    bucket.instances.forEach((a, i) => { pos.set(a.x, a.z, a.y); scale.set(a.w, a.h, a.d); quat.setFromAxisAngle(up, -a.yaw); matrix.compose(pos, quat, scale); mesh.setMatrixAt(i, matrix); });
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = !['glass', 'warm', 'light', 'paint'].includes(bucket.key); mesh.receiveShadow = true; mesh.computeBoundingSphere(); root.add(mesh); unique.add(mesh);
  }
  const rainCount = quality === 'low' ? 150 : 420;
  const rainPositions = new Float32Array(rainCount * 6), rainSeeds = Array.from({ length: rainCount }, () => [rnd(), rnd(), rnd()]);
  const rainGeometry = own(new T.BufferGeometry()); rainGeometry.setAttribute('position', new T.BufferAttribute(rainPositions, 3));
  const rainLines = new T.LineSegments(rainGeometry, own(new T.LineBasicNodeMaterial({ color: '#b2c3cb', transparent: true, opacity: .24, depthWrite: false })));
  rainLines.name = 'local autumn rain'; rainLines.frustumCulled = false; rainLines.visible = rain; root.add(rainLines);
  const takeoverSign = sign('NORTHLINE ACQUISITION / CLOSED', 116, 220.95, 2.2, 17, 1.25, { yaw: Math.PI, bg: '#493d3a', detail: 'PRIVATE CONTRACTOR PROPERTY' });
  const inquirySign = sign('WAGE DIVERSION / INQUIRY OPENED', 116, 220.95, 2.2, 17, 1.25, { yaw: Math.PI, bg: '#344f53', detail: 'THE MORROW RECORD / WORKERS HEARD' });
  if (takeoverSign) takeoverSign.visible = false;
  if (inquirySign) inquirySign.visible = false;
  let elapsed = 0, ending = null, rainEnabled = rain;

  const districtRoadGraph = { ...ROAD_GRAPH, nodes: [...ROAD_GRAPH.nodes], edges: [...ROAD_GRAPH.edges] };
  const inspectionNodes = [
    { id: 'inspection-south', x: 120, y: 332, z: 0 }, { id: 'inspection-entry', x: 120, y: 321, z: 0 },
    { id: 'inspection-south-crest', x: 120, y: 309, z: .65 }, { id: 'inspection-deck', x: 120, y: 305, z: .65 },
    { id: 'inspection-north-crest', x: 120, y: 301, z: .65 }, { id: 'inspection-exit', x: 120, y: 289, z: 0 },
    { id: 'inspection-north', x: 120, y: 270, z: 0 },
  ];
  districtRoadGraph.nodes.push(...inspectionNodes.map(node => ({ ...node, intersection: false, radius: 3 })));
  const connectInspection = (from, to, ramp = false) => {
    const properties = { width: 4.4, lanes: 1, speed: 3, service: true, ...(ramp ? { action: 'ramp' } : {}) };
    districtRoadGraph.edges.push({ from, to, ...properties }, { from: to, to: from, ...properties });
  };
  connectInspection('r02', 'inspection-south'); connectInspection('inspection-south', 'r12');
  inspectionNodes.forEach((node, i) => { if (i) connectInspection(inspectionNodes[i - 1].id, node.id, i >= 2 && i <= 5); });
  connectInspection('garage-lane-bay', 'inspection-north');
  const district = {
    root, bounds: DISTRICT_BOUNDS, units: 'metres', locations: LOCATIONS,
    interactables: INTERACTABLES.map(value => ({ ...value })), roadGraph: districtRoadGraph, footGraph: FOOT_GRAPH,
    cover, spawnPoints: SPAWN_POINTS, landmarks, obstacles, lamps, interiorVolumes: roofVolumes,
    features: { inspectionRamp: { id: 'eli-inspection-ramp', x: 120, minY: 291, maxY: 319, width: 4.4, height: .65, northApproach: { x: 120, y: 286, z: 0 }, southApproach: { x: 120, y: 325, z: 0 } }, softProps },
    artStats: { instancedBatches: buckets.size, primitiveInstances: [...buckets.values()].reduce((sum, bucket) => sum + bucket.instances.length, 0), signs: landmarks.length, staticBodies: obstacles.length, softBodies: softProps.length },
    signatureViews: {
      garage: { eye: { x: 69, y: 346, z: 5 }, target: { x: 97, y: 312, z: 3 } },
      market: { eye: { x: 80, y: 184, z: 4 }, target: { x: 120, y: 226, z: 2.7 } },
      depot: { eye: { x: 354, y: 155, z: 3.1 }, target: { x: 341, y: 104, z: 2.8 } },
      junction: { eye: { x: 252, y: 227, z: 3.8 }, target: { x: 230, y: 180, z: 6 } },
      waterfront: { eye: { x: 367, y: 379, z: 3.2 }, target: { x: 434, y: 347, z: 2.5 } },
    },
    path(graphName, fromId, toId) { return findGraphPath(graphName === 'road' ? districtRoadGraph : FOOT_GRAPH, fromId, toId); },
    nearestNode(graphName, point) { return nearestGraphNode(graphName === 'road' ? districtRoadGraph : FOOT_GRAPH, point); },
    contains(point) { return point.x >= 22 && point.x <= 456 && point.y >= 24 && point.y <= 396; },
    isWater(point) { return point.x > 456 || point.y > 396; },
    surfaceAt(point) {
      if (point.x > 117.25 && point.x < 122.75 && point.y > 270 && point.y < 333) return point.y > 291 && point.y < 319 ? 'concrete' : 'asphalt';
      for (const seg of ROAD_SEGMENTS) {
        const dx = seg.b[0] - seg.a[0], dy = seg.b[1] - seg.a[1], den = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, ((point.x - seg.a[0]) * dx + (point.y - seg.a[1]) * dy) / den));
        if (Math.hypot(point.x - seg.a[0] - t * dx, point.y - seg.a[1] - t * dy) < seg.width / 2) return 'asphalt';
      }
      if (point.x > 318 && point.x < 350 && point.y > 73 && point.y < 101) return point.z > 2.8 ? 'wood' : 'concrete';
      return 'concrete';
    },
    setEnding(value) {
      if (ending === value) return; ending = value;
      // These are visible world consequences; mission/UI own payment and persistence.
      if (marketNotice) marketNotice.visible = value !== 'reporter';
      if (reporterNotice) reporterNotice.visible = value !== 'broker';
      closedShop.material = value === 'broker' ? material('brickDark') : material('steel');
      if (takeoverSign) takeoverSign.visible = value === 'broker';
      if (inquirySign) inquirySign.visible = value === 'reporter';
    },
    setPickupCollected(id, collected) {
      const pickup = pickups.get(id); if (!pickup) return;
      for (const mesh of pickup.meshes) mesh.visible = !collected;
      setBodyEnabled(pickup.body, !collected);
      if (id === 'case') { caseDoorTarget = collected ? 1.3 : 0; setBodyEnabled(caseDoorBody, !collected); cabinetAlarm.material = material(collected ? 'signalRed' : 'signalGreen'); }
    },
    /** @param {number} dt @param {{x:number,y:number,z?:number}} focus @param {number} [signalTime] */
    update(dt, focus = SPAWN_POINTS.player, signalTime = elapsed) {
      elapsed += dt;
      if (caseDoor) caseDoor.rotation.y += (caseDoorTarget - caseDoor.rotation.y) * Math.min(1, dt * 7);
      for (const prop of softProps) {
        const p = prop.body.translation(), q = prop.body.rotation(); prop.mesh.position.set(p.x / U, p.z / U, p.y / U); prop.mesh.quaternion.set(-q.x, -q.z, -q.y, q.w);
      }
      for (const signal of trafficSignals) {
        const s = signal.definition, phase = ((signalTime - (signal.horizontal ? 0 : s.period / 2)) % s.period + s.period) % s.period;
        const green = phase < s.green, amber = !green && phase < s.green + s.amber;
        signal.red.material = material(!green && !amber ? 'signalRed' : 'trim');
        signal.amber.material = material(amber ? 'signalAmber' : 'trim');
        signal.green.material = material(green ? 'signalGreen' : 'trim');
      }
      let indoors = false;
      for (const interior of roofVolumes) {
        const inside = focus.x > interior.minX - 2 && focus.x < interior.maxX + 2 && focus.y > interior.minY - 2 && focus.y < interior.maxY + 2 && (focus.z || 0) < interior.ceiling;
        interior.mesh.visible = true; indoors ||= inside;
      }
      rainLines.visible = rainEnabled && !indoors;
      const sorted = lamps.filter(l => (l.minFocusZ === undefined || (focus.z || 0) >= l.minFocusZ) && (l.maxFocusZ === undefined || (focus.z || 0) <= l.maxFocusZ))
        .map(l => ({ l, distance: Math.hypot(focus.x - l.x, focus.y - l.y, ((focus.z || 0) + 1.5 - l.z) * .7) })).sort((a, b) => a.distance - b.distance);
      practicalLights.forEach((light, i) => { const l = sorted[i]?.l; if (!l) { light.intensity = 0; return; } light.position.set(l.x, l.z, l.y); light.color.set(l.color); light.intensity = l.power; light.distance = l.reach || 22; });
      if (rainLines.visible) {
        for (let i = 0; i < rainCount; i++) {
          const s = rainSeeds[i], z = ((s[2] * 16 - elapsed * 14) % 16 + 16) % 16, x = focus.x + (s[0] - .5) * 70, y = focus.y + (s[1] - .5) * 70;
          const offset = i * 6; rainPositions[offset] = x; rainPositions[offset + 1] = z; rainPositions[offset + 2] = y; rainPositions[offset + 3] = x + .1; rainPositions[offset + 4] = z - .8; rainPositions[offset + 5] = y + .15;
        }
        rainGeometry.attributes.position.needsUpdate = true;
      }
    },
    setRain(enabled) { rainEnabled = !!enabled; rainLines.visible = rainEnabled; },
    dispose() {
      root.removeFromParent();
      for (const body of bodies) { try { if (world.pw.getRigidBody(body.handle)) world.pw.removeRigidBody(body); } catch { /* World reset already freed the old physics world. */ } }
      for (const resource of resources) resource.dispose?.();
      resources.clear();
    },
  };
  district.update(0);
  return district;
}

export { LOCATIONS, INTERACTABLES, SPAWN_POINTS, DISTRICT_BOUNDS, ROAD_GRAPH, FOOT_GRAPH };
