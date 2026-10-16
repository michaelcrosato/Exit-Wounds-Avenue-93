import test from 'node:test';
import assert from 'node:assert/strict';
import { navigatePatrol } from '../../src/actors/patrol-navigation.js';
import { ROAD_GRAPH } from '../../src/world/roads.js';

const target = { x: 240, y: 202, z: 0 };

test('Quay-to-Rivet patrol consumes its origin even after overshooting the turn', () => {
  let nav = navigatePatrol({ graph: ROAD_GRAPH, position: { x: 416, y: 242 }, yaw: -Math.PI / 2, speed: 0, target });
  assert.equal(nav.cursor.route[0].id, 'r21'); assert.equal(nav.cursor.index, 0);
  assert.ok(nav.controls.throttle > 0, 'The first leg is ahead, so the cruiser should depart.');
  nav = navigatePatrol({ graph: ROAD_GRAPH, position: { x: 416, y: 215 }, yaw: -Math.PI / 2, speed: 9, target, cursor: nav.cursor });
  assert.ok(nav.targetSpeed < 8, 'A 90-degree turn must slow before its corner.');
  assert.ok(nav.controls.brake > 0);
  nav = navigatePatrol({ graph: ROAD_GRAPH, position: { x: 416, y: 192 }, yaw: -Math.PI / 2, speed: 6, target, cursor: nav.cursor });
  assert.equal(nav.cursor.index, 1, 'Passing the inbound road node consumes it despite a >8 m overshoot.');
  for (const position of [{ x: 401, y: 198 }, { x: 412, y: 212 }, { x: 390, y: 203 }]) {
    nav = navigatePatrol({ graph: ROAD_GRAPH, position, yaw: Math.PI, speed: 4, target, cursor: nav.cursor });
    assert.equal(nav.cursor.index, 1, 'The origin may never become the target again after a corner overshoot.');
    assert.ok(nav.waypoint.x < position.x, 'Forward look-ahead must continue west toward Rivet.');
  }
});

test('patrol already on the outgoing edge skips the nearest node behind it', () => {
  const nav = navigatePatrol({ graph: ROAD_GRAPH, position: { x: 61, y: 61 }, yaw: Math.PI / 2,
    speed: 0, target: { x: 380, y: 355 } });
  assert.equal(nav.cursor.index, 1);
  assert.ok(nav.waypoint.y > 61); assert.ok(Math.abs(nav.headingError) < .3);
  assert.ok(nav.controls.throttle > 0); assert.equal(nav.controls.brake, 0);
});

test('a heading behind a stationary cruiser produces a slow moving turn', () => {
  const nav = navigatePatrol({ graph: ROAD_GRAPH, position: { x: 240, y: 325 }, yaw: Math.PI,
    speed: 0, target: { x: 380, y: 355 } });
  assert.ok(Math.abs(nav.controls.steer) > .9);
  assert.ok(nav.controls.throttle > 0); assert.equal(nav.controls.brake, 0);
  assert.ok(nav.targetSpeed <= 2.5);
});

test('same-goal suspect motion preserves the consumed route and final arrival parks', () => {
  let nav = navigatePatrol({ graph: ROAD_GRAPH, position: { x: 416, y: 192 }, yaw: Math.PI, speed: 3,
    target, cursor: { route: [{ id: 'r21', x: 416, y: 202, z: 0 }, { id: 'r11', x: 240, y: 202, z: 0 }],
      index: 1, anchor: { x: 416, y: 242, z: 0 }, goalId: 'r11', target } });
  nav = navigatePatrol({ graph: ROAD_GRAPH, position: { x: 400, y: 202 }, yaw: Math.PI, speed: 3,
    target: { x: 241, y: 203 }, cursor: nav.cursor });
  assert.equal(nav.cursor.index, 1); assert.deepEqual(nav.cursor.target, { x: 241, y: 203, z: 0 });
  nav = navigatePatrol({ graph: ROAD_GRAPH, position: { x: 241, y: 203 }, yaw: Math.PI, speed: 0,
    target: { x: 241, y: 203 }, cursor: nav.cursor });
  assert.equal(nav.arrived, true); assert.equal(nav.controls.throttle, 0);
  assert.equal(nav.controls.brake, 1); assert.equal(nav.controls.handbrake, true);
});
