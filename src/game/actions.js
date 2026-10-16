/** @typedef {'keyboard'|'gamepad'|'replay'} InputDevice */
/** @typedef {'interact'|'fire'|'aim'|'reload'|'sprint'|'crouch'|'vault'|'dodge'|'cover'|'wheel'|'phone'|'map'|'pause'|'confirm'|'back'|'up'|'down'|'left'|'right'|'shoulder'|'horn'|'radio'|'lookBehind'|'handbrake'} Action */
/**
 * @typedef {object} ActionFrame
 * @property {number} tick
 * @property {InputDevice} device
 * @property {number} moveX
 * @property {number} moveY
 * @property {number} lookX
 * @property {number} lookY
 * @property {number} throttle
 * @property {number} brake
 * @property {Set<Action>} held
 * @property {Set<Action>} pressed
 * @property {Set<Action>} released
 */
export const ACTIONS = Object.freeze(['interact', 'fire', 'aim', 'reload', 'sprint', 'crouch', 'vault', 'dodge', 'cover', 'wheel', 'phone', 'map', 'pause', 'confirm', 'back', 'up', 'down', 'left', 'right', 'shoulder', 'horn', 'radio', 'lookBehind', 'handbrake']);
/** @param {number} tick @param {InputDevice} device @returns {ActionFrame} */
export function emptyActionFrame(tick = 0, device = 'keyboard') {
  return { tick, device, moveX: 0, moveY: 0, lookX: 0, lookY: 0, throttle: 0, brake: 0, held: new Set(), pressed: new Set(), released: new Set() };
}
/** Clear edges and held state on blur, disconnect, pause or pointer-lock loss. @param {ActionFrame} frame */
export function clearActionFrame(frame) {
  frame.moveX = frame.moveY = frame.lookX = frame.lookY = frame.throttle = frame.brake = 0;
  frame.held.clear(); frame.pressed.clear(); frame.released.clear();
  return frame;
}
/** @param {ActionFrame} frame */
export function serializeActionFrame(frame) { return { ...frame, held: [...frame.held], pressed: [...frame.pressed], released: [...frame.released] }; }
