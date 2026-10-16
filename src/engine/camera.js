import { m } from './units.js';
/** Shoulder orbit with a near-plane-sized sweep against every physical occluder. */
export class OrbitCamera {
  constructor(world, queries, settings = {}) {
    this.world = world; this.queries = queries; this.yaw = -Math.PI / 2; this.pitch = -.22; this.shoulder = 1; this.distance = m(5.4); this.lastLook = 0; this.behindAngle=0;
    this.settings = { sensitivity: 1, invertY: false, ...settings }; this.settings.invertY=settings.invertY===true||settings.invertY==='true'; this.eye = null; this.shakeEnergy=0;this.shakeStrength=Number(settings.shakeStrength??settings.shake??.5);
    world.camera.set('fixed'); world.camera.mouseLook = false;
  }
  shake(amount=.5){this.shakeEnergy=Math.min(1,this.shakeEnergy+Math.max(0,amount));}
  ground(frame) { const c = Math.cos(this.yaw), s = Math.sin(this.yaw); return { x: -s * frame.moveX - c * frame.moveY, y: c * frame.moveX - s * frame.moveY }; }
  update(dt, frame, target, options = {}) {
    if (!target) return;
    this.world.camera.target = target;
    const vehicle = options.vehicle, aiming = !!options.aiming, sensitivity = this.settings.sensitivity;
    const lookX = frame.lookX || 0, lookY = frame.lookY || 0;
    this.yaw += lookX * dt * 2.6 * sensitivity + (frame.mouseX || 0) * .0023 * sensitivity;
    this.pitch = Math.max(-.9, Math.min(.42, this.pitch - (lookY * dt * 1.9 + (frame.mouseY || 0) * .0021) * sensitivity * (this.settings.invertY ? -1 : 1)));
    if (Math.abs(lookX) + Math.abs(frame.mouseX || 0) > .02) this.lastLook = this.world.time;
    if (frame.pressed?.has('shoulder') && !vehicle) this.shoulder *= -1;
    if (vehicle && this.world.time - this.lastLook > 1.8 && Math.abs(vehicle.speed || 0) > m(2)) {
      const heading = vehicle.yaw + ((vehicle.speed || 0) < 0 ? Math.PI : 0), difference = Math.atan2(Math.sin(heading - this.yaw), Math.cos(heading - this.yaw));
      this.yaw += difference * Math.min(1, dt * 1.4);
    }
    this.behindAngle=vehicle?this.behindAngle+((frame.held?.has('shoulder')?Math.PI:0)-this.behindAngle)*(1-Math.exp(-dt*12)):0;
    const viewYaw=this.yaw+this.behindAngle;
    const height = vehicle ? m(1.3) : aiming ? m(1.5) : m(1.48), shoulder = vehicle ? 0 : aiming ? m(.62) * this.shoulder : m(.32) * this.shoulder;
    const focus = { x: target.x - Math.sin(viewYaw) * shoulder, y: target.y + Math.cos(viewYaw) * shoulder, z: (target.z ?? 0) + height };
    const desiredDistance = vehicle ? m(7.5) + Math.min(m(3), Math.abs(vehicle.speed || 0) * .1) : aiming ? m(2.6) : m(5.4);
    const cp = Math.cos(this.pitch), direction = { x: Math.cos(viewYaw) * cp, y: Math.sin(viewYaw) * cp, z: Math.sin(this.pitch) };
    const wanted = { x: focus.x - direction.x * desiredDistance, y: focus.y - direction.y * desiredDistance, z: focus.z - direction.z * desiredDistance };
    const ignored = [target, target.body, vehicle, vehicle?.body].filter(Boolean);
    const hit = this.queries.sphereSweep(focus, wanted, m(.22), { ignore: ignored, ignoreActors: true });
    const fraction = hit ? Math.max(.025, (hit.time_of_impact ?? hit.timeOfImpact) - m(.08) / desiredDistance) : 1;
    const safeDistance = Math.max(m(.28), desiredDistance * fraction);
    this.distance = safeDistance < this.distance ? safeDistance : this.distance + (safeDistance - this.distance) * (1 - Math.exp(-dt * 5));
    const eye = { x: focus.x - direction.x * this.distance, y: focus.y - direction.y * this.distance, z: focus.z - direction.z * this.distance };
    if(this.hiddenActor&&(this.hiddenActor!==target||this.distance>m(1.55))){this.hiddenActor.visible=this.hiddenVisibility;this.hiddenActor=null;}
    if(!this.hiddenActor&&target.rig&&this.distance<m(1.2)){this.hiddenActor=target;this.hiddenVisibility=target.visible;target.visible=false;}
    this.eye = eye;
    this.shakeEnergy*=Math.exp(-dt*12);const shake=this.shakeEnergy*(this.world.game.reduceMotion?0:this.shakeStrength)*m(.1),time=this.world.time;
    const renderEye={x:eye.x+Math.sin(time*83)*shake,y:eye.y+Math.sin(time*71)*shake,z:eye.z+Math.sin(time*57)*shake*.6};
    this.world.camera.fixed = { ...renderEye, yaw: viewYaw, pitch: this.pitch, fov: aiming ? 54 : vehicle ? 68 : 62, ortho: false };
    this.world.camera.yaw = viewYaw; this.world.camera.update(0);
  }
  aimRay(range = m(120)) {
    const eye = this.eye || this.world.camera.pose, cp = Math.cos(this.pitch);
    return { from: { x: eye.x, y: eye.y, z: eye.z }, to: { x: eye.x + Math.cos(this.yaw) * cp * range, y: eye.y + Math.sin(this.yaw) * cp * range, z: eye.z + Math.sin(this.pitch) * range } };
  }
  reset(target, yaw = -Math.PI / 2) { this.yaw = yaw; this.pitch = -.22; this.distance = m(5.4); this.eye = null; if (target) this.update(0, {}, target); }
}
