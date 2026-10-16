import { findGraphPath, nearestGraphNode } from '../world/roads.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const angle = value => Math.atan2(Math.sin(value), Math.cos(value));
const point = value => ({ x: value.x, y: value.y, z: value.z || 0 });

/**
 * @typedef {{route:Array<{id:string,x:number,y:number,z:number}>,index:number,
 * anchor:{x:number,y:number,z:number},goalId:string|null,target:{x:number,y:number,z:number}}} PatrolRouteCursor
 */

/** Has the car crossed the waypoint's incoming or outgoing road segment? */
function passedNode(position, node, before, after) {
  const crosses = (start, end, beyondStart) => {
    const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy);
    if (length < .01) return false;
    const along = ((position.x - start.x) * dx + (position.y - start.y) * dy) / length;
    const across = Math.abs((position.x - start.x) * dy - (position.y - start.y) * dx) / length;
    return across < 4.5 && (beyondStart ? along > .6 : along > length + .6);
  };
  return (before && crosses(before, node, false)) || (after && crosses(node, after, true));
}

/**
 * Advance a physical cruiser along an authored road graph. Distances and speed
 * are metres and metres/second. Keep the returned cursor for the next update;
 * do not recreate it from the car's nearest node every simulation step.
 *
 * The route begins with the nearest graph node, which may be behind a car
 * already travelling along its first edge. Reached/passed nodes are consumed
 * once. A forward look-ahead point then smooths corners while a braking-distance
 * speed limit prevents overshooting the turn and orbiting its origin.
 *
 * @param {{graph:any,position:{x:number,y:number,z?:number},yaw:number,speed:number,
 * target:{x:number,y:number,z?:number},cursor?:PatrolRouteCursor|null,wheelbase?:number,maxSteer?:number}} options
 */
export function navigatePatrol({ graph, position, yaw, speed, target, cursor = null, wheelbase = 2.87, maxSteer = .53 }) {
  const goal = nearestGraphNode(graph, target);
  const needsRoute = !cursor || cursor.goalId !== goal?.id;
  /** @type {PatrolRouteCursor} */
  const next = needsRoute ? (() => {
    const start = nearestGraphNode(graph, position);
    return { route: start && goal ? findGraphPath(graph, start.id, goal.id).map(node => ({ id: node.id, ...point(node) })) : [],
      index: 0, anchor: point(position), goalId: goal?.id || null, target: point(target) };
  })() : { ...cursor, target: point(target) };

  const reachedRadius = clamp(3.2 + Math.abs(speed) * .12, 3.2, 4.5);
  while (next.index < next.route.length) {
    const node = next.route[next.index], before = next.index ? next.route[next.index - 1] : next.anchor;
    const after = next.route[next.index + 1];
    if (distance(position, node) > reachedRadius && !passedNode(position, node, before, after)) break;
    next.index++;
  }

  const pending = next.route.slice(next.index).map(point);
  // A moving suspect or a service anchor can be offset from its nearest node.
  // Only the tail changes; this must never reset the already-consumed cursor.
  if (!pending.length || distance(pending[pending.length - 1], target) > .1) pending.push(point(target));
  const finalDistance = distance(position, target);
  let remaining = 0, previous = position;
  for (const node of pending) { remaining += distance(previous, node); previous = node; }

  const cruiseSpeed = 9;
  const currentNode = next.route[next.index];
  const followingNode = next.route[next.index + 1];
  let targetSpeed = cruiseSpeed;
  if (currentNode && followingNode) {
    const inbound = next.index ? next.route[next.index - 1] : next.anchor;
    const approach = Math.atan2(currentNode.y - inbound.y, currentNode.x - inbound.x);
    const departure = Math.atan2(followingNode.y - currentNode.y, followingNode.x - currentNode.x);
    const turn = Math.abs(angle(departure - approach));
    const cornerSpeed = turn > 2.2 ? 2.3 : turn > 1.1 ? 3.3 : turn > .6 ? 5.2 : cruiseSpeed;
    const brakingRoom = Math.max(0, distance(position, currentNode) - 5);
    targetSpeed = Math.min(targetSpeed, Math.sqrt(cornerSpeed ** 2 + 2 * 3 * brakingRoom));
  }
  const edgeStart = next.route[Math.max(0, next.index - 1)]?.id;
  const edgeEnd = currentNode?.id;
  const edge = graph.edges?.find(value => value.from === edgeStart && value.to === edgeEnd);
  if (edge?.speed) targetSpeed = Math.min(targetSpeed, edge.speed);
  targetSpeed = Math.min(targetSpeed, Math.sqrt(2 * 3 * Math.max(0, remaining - 2.5)));

  const lookAhead = clamp(4 + Math.abs(speed) * .45, 4, 8);
  let ahead = lookAhead, start = position, waypoint = pending[pending.length - 1] || point(target);
  for (const node of pending) {
    const length = distance(start, node);
    if (length > ahead && length > .001) {
      const fraction = ahead / length;
      waypoint = { x: start.x + (node.x - start.x) * fraction, y: start.y + (node.y - start.y) * fraction, z: node.z };
      break;
    }
    ahead -= length; start = node;
  }

  const headingError = angle(Math.atan2(waypoint.y - position.y, waypoint.x - position.x) - yaw);
  if (Math.abs(headingError) > 1.4) targetSpeed = Math.min(targetSpeed, 2.5);
  if (Math.abs(headingError) > 2.4) targetSpeed = Math.min(targetSpeed, 1.8);
  const steer = Math.abs(headingError) > Math.PI / 2 ? Math.sign(headingError) :
    clamp(Math.atan2(2 * wheelbase * Math.sin(headingError), lookAhead) / maxSteer, -1, 1);
  const arrived = finalDistance < 3 && Math.abs(speed) < .8;
  const error = targetSpeed - Math.max(0, speed);
  const brake = arrived ? 1 : error < -.25 ? clamp(-error * .2, 0, .85) : 0;
  const throttle = !arrived && !brake && error > .15 ? clamp(error * .2, .1, .5) : 0;
  return { controls: { steer, throttle, brake, handbrake: arrived }, cursor: next,
    waypoint, targetSpeed, remaining, arrived, headingError };
}
