const scriptLoads = new Map();
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

function loadClassic(url) {
  const key = url.href;
  if (scriptLoads.has(key)) return scriptLoads.get(key);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = key;
    script.onload = () => resolve(script);
    script.onerror = () => { script.remove(); scriptLoads.delete(key); reject(new Error(`Animation resource could not load: ${url.pathname}`)); };
    document.head.appendChild(script);
  });
  scriptLoads.set(key, promise); return promise;
}

/** Selects authoritative animation channels; animation never moves physics or awards gameplay events. */
export function chooseAnimationState(actor, state = {}) {
  const anim = actor.anim || {}, speed = Math.hypot(actor.vx || 0, actor.vy || 0) / 16;
  const dead = state.dead ?? (state.health === 0 || actor.alive === false || anim.pose === 'die');
  if (dead) return { base: 'Death01', speed: 1, exclusive: 'death' };
  if (state.transition || anim.seatTransition) return { base: state.exiting ? 'Sitting_Exit' : 'Sitting_Enter', speed: 1, exclusive: 'seat' };
  if (state.seated || actor.vehicleId || anim.seated) return { base: 'Driving_Loop', speed: 1, exclusive: 'driving' };
  if (state.vault) return { base: 'ClimbUp_1m_RM', speed: 1.8, exclusive: 'vault' };
  if (state.dodging) return { base: state.dodgeX > .25 ? 'Dodge_right' : state.dodgeX < -.25 ? 'Dodge_left' : 'Dodge_back', speed: 1.5, exclusive: 'dodge' };
  const crouch = state.crouched ?? anim.crouch;
  let base = crouch ? speed > .15 ? 'Crouch_Fwd_Loop' : 'Crouch_Idle_Loop' : speed > 4 ? 'Sprint_Loop' : speed > 2.5 ? 'Jog_Fwd_Loop' : speed > .15 ? 'Walk_Loop' : 'Idle_Loop';
  if (!actor.grounded && actor.vz > 5) base = 'Jump_Start';
  else if (!actor.grounded && Math.abs(actor.vz || 0) > 5) base = 'Jump_Loop';
  else if (actor.landed) base = 'Jump_Land';
  const gaitSpeed = base.includes('Walk') ? 1.4 : base.includes('Jog') ? 3 : base.includes('Sprint') ? 5 : base.includes('Crouch_Fwd') ? 1.1 : 1;
  let upper = null;
  if (state.reloading) upper = 'Pistol_Reload';
  else if (state.phone) upper = 'Idle_TalkingPhone_Loop';
  else if (state.interacting) upper = 'Interact';
  else if (state.melee) upper = state.combo === 2 ? 'Punch_Cross' : 'Punch_Jab';
  else if (state.blocking) upper = 'Sword_Block';
  else if (state.aiming || anim.point) upper = (state.aimPitch ?? anim.aim ?? 0) < -.25 ? 'Pistol_Aim_Down' : (state.aimPitch ?? anim.aim ?? 0) > .25 ? 'Pistol_Aim_Up' : 'Pistol_Aim_Neutral';
  else if (state.talking || anim.pose === 'talk') upper = 'Idle_Talking_Loop';
  else if (state.armed && speed < .15) upper = 'Pistol_Idle_Loop';
  return { base, upper, speed: speed > .15 && /Walk|Jog|Sprint|Crouch_Fwd/.test(base) ? clamp(speed / gaitSpeed, .45, 1.65) : 1 };
}

/**
 * Actual pinned Mocap runtime with lower-body capture, masked upper-body layers and exclusive actions.
 * register disables world.step's automatic pose. Call update AFTER world.step + vehicles.postStep.
 */
export class AnimationSystem {
  /** @param {{E:any,world:any}} options */
  static async load({ E, world }) {
    if (!globalThis.ExitWoundsMocap) {
      // Deliberately sequential: readable -> mocap -> selected set -> lexical-global bridge.
      await loadClassic(new URL('../../vendor/my-3d2dge/src/mocap/readable.js', import.meta.url));
      await loadClassic(new URL('../../vendor/my-3d2dge/src/mocap/mocap.js', import.meta.url));
      await loadClassic(new URL('../../assets/animation/urban.js', import.meta.url));
      await loadClassic(new URL('../../assets/animation/bridge.js', import.meta.url));
    } else if (!globalThis.MOCAP?.EWA93) await loadClassic(new URL('../../assets/animation/urban.js', import.meta.url));
    return new AnimationSystem({ E, world, Mocap: globalThis.ExitWoundsMocap.runtime, library: globalThis.ExitWoundsMocap.runtime.load(globalThis.MOCAP.EWA93) });
  }
  /** @param {{E:any,world:any,Mocap:any,library:any}} options */
  constructor({ E, world, Mocap, library }) {
    this.E = E; this.world = world; this.Mocap = Mocap; this.lib = library; this.entries = new Map(); this.time = 0;
    this.upperPoints = library.points.filter(name => ['spine1', 'spine2', 'chest', 'neck', 'head', 'headTop', 'faceF', 'chestF'].includes(name) || /^(clav|sh|elbow|wrist|index|knuck|pinky|fist)[LR]$/.test(name));
  }
  /** @param {any} actor @param {{role?:string,getState?:(actor:any)=>any}} options */
  register(actor, { role = 'civilian', getState = () => ({}) } = {}) {
    if (!actor?.rig || this.entries.has(actor)) return false;
    this.Mocap.drive(actor.rig, this.lib);
    actor.data ||= {}; actor.data.animationManaged = true;
    const oldPose = actor.pose; actor.pose = false;
    this.entries.set(actor, { actor, role, getState, oldPose, base: null, baseTime: 0, upper: null, upperTime: 0, gait: 0, blend: 1, previous: null, current: null, hitTime: 0, shotTime: 0, action: null, actionTime: 0, previousHealth: null });
    return true;
  }
  /** One-shot presentation events: hit, shot, reload, interact, melee. */
  trigger(actor, action, options = {}) {
    const entry = this.entries.get(actor); if (!entry) return false;
    if (action === 'hit') entry.hitTime = .28;
    else if (action === 'shot') entry.shotTime = .18;
    else { entry.action = action; entry.actionTime = 0; entry.actionDuration = options.duration || ({ reload: 1.4, interact: .8, melee: .32, vault: .7 }[action] || .7); }
    return true;
  }
  update(dt) {
    this.time += dt;
    for (const entry of this.entries.values()){if(entry.actor.flash>0)entry.actor.flash=Math.max(0,entry.actor.flash-dt);this.pose(entry, dt);}
  }
  pose(entry, dt) {
    const actor = entry.actor, rig = actor.rig, state = { ...entry.getState(actor) }, animation = actor.anim || {};
    if (entry.previousHealth != null && state.health < entry.previousHealth) entry.hitTime = .28;
    if (Number.isFinite(state.health)) entry.previousHealth = state.health;
    if (entry.action) {
      entry.actionTime += dt;
      if (entry.actionTime >= entry.actionDuration) entry.action = null;
      else if (entry.action === 'reload') state.reloading = true;
      else if (entry.action === 'interact') state.interacting = true;
      else if (entry.action === 'melee') state.melee = true;
      else if (entry.action === 'vault') state.vault = true;
    }
    const selected = chooseAnimationState(actor, state);
    if (entry.base !== selected.base) {
      entry.previous = entry.current ? new Float32Array(entry.current) : null;
      if (entry.previous && entry.current.src) entry.previous.src = entry.current.src;
      entry.base = selected.base; entry.baseTime = 0; entry.blend = 0;
    }
    const baseClip = this.lib.clip(entry.base);
    entry.baseTime += dt * selected.speed;
    // Gait phase follows travelled speed rather than wall-clock time; idle cannot slide the feet.
    let pose = this.lib.sample(baseClip, entry.baseTime);
    if (selected.upper && !selected.exclusive) {
      if (entry.upper !== selected.upper) { entry.upper = selected.upper; entry.upperTime = 0; }
      entry.upperTime += dt;
      const clip = this.lib.clip(entry.upper), upper = this.lib.sample(clip, entry.upperTime);
      pose = this.layerUpper(pose, upper, 1);
    } else { entry.upper = null; entry.upperTime = 0; }
    entry.shotTime = Math.max(0, entry.shotTime - dt); entry.hitTime = Math.max(0, entry.hitTime - dt);
    if (entry.shotTime > 0 && !selected.exclusive) pose = this.layerUpper(pose, this.lib.sample(this.lib.clip('Pistol_Shoot'), .18 - entry.shotTime), .85);
    if (entry.hitTime > 0 && selected.exclusive !== 'death' && selected.exclusive !== 'driving') pose = this.layerUpper(pose, this.lib.sample(this.lib.clip('Hit_Chest'), .28 - entry.hitTime), Math.sin(entry.hitTime / .28 * Math.PI) * .7);
    if (entry.previous && entry.blend < 1) { entry.blend = Math.min(1, entry.blend + dt / .16); pose = this.lib.blend(entry.previous, pose, entry.blend); }
    // The pinned readable decoder samples root tracks in place. Inspect, but never apply/subtract, moveAt.
    const rootMotion = this.lib.moveAt(baseClip, entry.baseTime);
    if(state.weapon==='smg'&&selected.upper?.startsWith('Pistol_Aim'))for(const name of ['wristL','indexL','knuckL','pinkyL','fistL'])pose[this.lib.idx[name]*3]+=130;
    if(state.inCover&&!selected.exclusive){const lean=clamp(state.peekSide||0,-1,1)*100;for(const name of this.upperPoints)pose[this.lib.idx[name]*3+1]+=lean;}
    if(selected.exclusive==='seat'&&state.transition&&typeof state.transition==='object'){
      const phase=clamp(state.transition.time/state.transition.duration),reach=Math.sin(clamp(phase/.55)*Math.PI)*.7;
      const index=this.lib.idx.fistR*3;pose[index]+=220*reach;pose[index+1]+=(state.transition.seat%2===0?-1:1)*240*reach;
    }
    rig.mocap = pose; rig.mocapW = 1; rig.mocapMask = null; rig.mocapBlade = false;
    entry.current = pose;
    rig.update(dt, { x: actor.x, y: actor.y, z: actor.z, vx: actor.vx || 0, vy: actor.vy || 0, facing: actor.facing, air: !actor.grounded && !actor.fly, ...animation });
    actor.data.animation = { base: entry.base, upper: entry.upper, exclusive: selected.exclusive || null, rootMotion:rootMotion||null, phase: baseClip.loop ? (entry.baseTime % baseClip.dur) / baseClip.dur : clamp(entry.baseTime / baseClip.dur) };
  }
  layerUpper(lower, upper, weight) {
    const pose = /** @type {any} */ (new Float32Array(lower)); pose.src = lower.src;
    // Align the upper capture's pelvis to the locomotion pelvis before masking.
    const hip = this.lib.idx.pelvis * 3, offset = [lower[hip] - upper[hip], lower[hip + 1] - upper[hip + 1], lower[hip + 2] - upper[hip + 2]];
    for (const name of this.upperPoints) {
      const index = this.lib.idx[name] * 3;
      for (let axis = 0; axis < 3; axis++) pose[index + axis] = lower[index + axis] + (upper[index + axis] + offset[axis] - lower[index + axis]) * weight;
    }
    return pose;
  }
  reset(actor = null) {
    for (const entry of actor ? [this.entries.get(actor)].filter(Boolean) : this.entries.values()) { entry.base = null; entry.baseTime = entry.upperTime = entry.hitTime = entry.shotTime = 0; entry.action = null; entry.previous = null; entry.current = null; entry.previousHealth = null; entry.actor.flash=0; }
  }
  unregister(actor) { const entry = this.entries.get(actor); if (!entry) return; actor.pose = entry.oldPose; actor.data.animationManaged = false; actor.rig.mocap = null; this.entries.delete(actor); }
  dispose() { for (const actor of [...this.entries.keys()]) this.unregister(actor); }
}
