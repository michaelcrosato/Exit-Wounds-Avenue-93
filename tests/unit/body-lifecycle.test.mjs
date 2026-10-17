import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '../../vendor/my-3d2dge/vendor/rapier3d-simd-compat-0.19.3/rapier.js';
import { setBodyEnabled } from '../../src/engine/body-lifecycle.js';

before(async () => { await RAPIER.init({}); });

function fixture(compound = false) {
  const world = new RAPIER.World({ x: 0, y: 0, z: -156.96 });
  world.timestep = 1 / 120;
  world.lengthUnit = 16;
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, -8));
  const floor = world.createCollider(RAPIER.ColliderDesc.cuboid(200, 200, 8), ground);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0, 13.7).lockRotations());
  const capsule = world.createCollider(RAPIER.ColliderDesc.capsule(9, 4.7)
    .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
    .setMass(86).setCollisionGroups(0x0008ffff).setSolverGroups(0x00010001), body);
  const colliders = [capsule];
  if (compound) colliders.push(world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 2)
    .setTranslation(12, 0, 0).setMass(2).setCollisionGroups(0x0002ffff).setSolverGroups(0x00020002), body));
  return { world, ground, floor, body, capsule, colliders };
}

function counts(world) {
  let bodies = 0, colliders = 0;
  world.bodies.forEach(() => bodies++);
  world.colliders.forEach(() => colliders++);
  return { bodies, colliders };
}

function solverContacts(world, capsule, floor) {
  let count = 0;
  world.contactPair(capsule, floor, manifold => { count += manifold.numSolverContacts(); });
  return count;
}

for (const compound of [false, true]) {
  test(`touching dynamic ${compound ? 'compound body preserves distinct masks and idempotence' : 'capsule survives suspension'} for 50 Rapier SIMD cycles`, () => {
    const { world, ground, floor, body, capsule, colliders } = fixture(compound);
    const baselineCounts = counts(world), bodyHandle = body.handle, groundHandle = ground.handle;
    const bodyType = body.bodyType(), mass = body.mass();
    const original = colliders.map(collider => ({ collider, handle: collider.handle,
      solverGroups: collider.solverGroups(), collisionGroups: collider.collisionGroups(), sensor: collider.isSensor() }));
    let completed = false;
    try {
      world.step();
      assert.ok(solverContacts(world, capsule, floor) > 0, 'fixture must have a real ground contact before suspension');
      for (let cycle = 0; cycle < 50; cycle++) {
        // A subsequent suspension must capture current masks, not retain an earlier cycle's cache.
        if (compound && cycle === 25) {
          original[0].solverGroups = 0x00040004;
          original[1].solverGroups = 0x00080008;
          for (const saved of original) saved.collider.setSolverGroups(saved.solverGroups);
        }
        setBodyEnabled(body, false);
        setBodyEnabled(body, false);
        assert.equal(body.isEnabled(), false);
        for (const saved of original) {
          assert.equal(saved.collider.solverGroups(), 0, `cycle ${cycle}: every collider must stop generating solver constraints`);
          assert.equal(saved.collider.collisionGroups(), saved.collisionGroups);
          assert.equal(saved.collider.isSensor(), saved.sensor);
        }
        // This step traps in the pinned SIMD build with body.setEnabled(false) alone.
        world.step();
        setBodyEnabled(body, true);
        setBodyEnabled(body, true);
        for (const saved of original) assert.equal(saved.collider.solverGroups(), saved.solverGroups,
          `cycle ${cycle}: duplicate suspension must not replace the original mask with zero`);
        body.setTranslation({ x: (cycle % 2) * 16, y: 0, z: 13.7 }, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        for (let tick = 0; tick < 4; tick++) world.step();

        assert.equal(body.isEnabled(), true);
        assert.equal(body.bodyType(), bodyType);
        assert.equal(body.mass(), mass);
        assert.equal(world.getRigidBody(bodyHandle), body);
        assert.equal(world.getRigidBody(groundHandle), ground);
        assert.deepEqual(counts(world), baselineCounts);
        for (const saved of original) {
          assert.equal(world.getCollider(saved.handle), saved.collider);
          assert.equal(saved.collider.isEnabled(), true);
          assert.equal(saved.collider.solverGroups(), saved.solverGroups);
          assert.equal(saved.collider.collisionGroups(), saved.collisionGroups);
          assert.equal(saved.collider.isSensor(), saved.sensor);
        }
        assert.ok(solverContacts(world, capsule, floor) > 0, `cycle ${cycle}: restored body must participate in ground solving`);
        assert.ok(body.translation().z >= 13.6, 'restored capsule must not fall through the floor');
      }
      completed = true;
    } finally {
      // Preserve the initiating exception if a regression poisons WASM; do not query/free it afterward.
      if (completed) world.free();
    }
  });
}
