export const ACTION_MAP = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  menuUp: ['KeyW', 'ArrowUp', 'Pad12'], menuDown: ['KeyS', 'ArrowDown', 'Pad13'], menuLeft: ['KeyA', 'ArrowLeft', 'Pad14'], menuRight: ['KeyD', 'ArrowRight', 'Pad15'], back: ['Escape', 'Pad1'], vault: ['Space', 'Pad2'],
  confirm: ['Enter', 'Pad0'], cancel: ['Escape', 'Pad1'], start: ['Enter', 'Pad9'], pause: ['Escape', 'Pad9'],
  sprint: ['ShiftLeft', 'ShiftRight', 'Pad0'], jump: ['Space', 'Pad2'], crouch: ['KeyC', 'Pad10'],
  aim: ['Mouse2', 'Pad6'], fire: ['Mouse0', 'Pad7'], reload: ['KeyR', 'Pad1'], cover: ['KeyQ', 'Pad5'],
  interact: ['KeyE', 'Pad3'], wheel: ['Tab', 'Pad4'], shoulder: ['KeyV', 'Pad11'], phone: ['KeyT', 'Pad12'], map: ['KeyM', 'Pad13'],
  throttle: ['KeyW', 'Pad7'], brake: ['KeyS', 'Pad6'], handbrake: ['Space', 'Pad5'], horn: ['KeyH', 'Pad10'], radio: ['KeyX', 'Pad15']
};
export const ACTIONS = Object.keys(ACTION_MAP);
export function radialDeadzone(x, y, deadzone = .12) {
  const l = Math.hypot(x, y);
  if (l <= deadzone) return [0, 0];
  const scale = Math.min(1, (l - deadzone) / (1 - deadzone)) / l;
  return [x * scale, y * scale];
}
/** Normalizes the engine's existing poll; never calls navigator.getGamepads itself. */
export class InputAdapter {
  constructor(game, options = {}) {
    this.game = game; this.engine = game.input; this.options = { deadzone: .12, sensitivity: 1, invertY: false, ...options };
    this.engine.deadzone = this.options.deadzone; this.engine.touchEnabled = false; this.engine.glyphs = 'playstation';
    this.previous = new Set(); this.analogBlocked = new Set(); this.mouseDelta = [0, 0]; this.suspended = false; this.lastFrame = null;
    this.abort = new AbortController();
    if (typeof document !== 'undefined') {
      const signal = this.abort.signal;
      const canvas = game.screen.canvas;
      // PointerEvent pointerdown/up only describe the first/last mouse button. Preserve aim+fire chords.
      canvas?.addEventListener('mousedown',e=>this.engine.press('Mouse'+e.button),{signal});
      window.addEventListener('mouseup',e=>this.engine.release('Mouse'+e.button),{signal});
      document.addEventListener('mousemove', e => {
        if (document.pointerLockElement === canvas) { this.mouseDelta[0] += e.movementX; this.mouseDelta[1] += e.movementY; }
      }, { signal });
    }
  }
  poll(tick = 0, dt = 1 / 120) {
    const i = this.engine, held = new Set(), pressed = new Set(), released = new Set();
    for (const action of ACTIONS) {
      if (!this.suspended && i.down(action)) held.add(action);
      if (!this.suspended && i.pressed(action)) pressed.add(action);
      if (i.released(action) || (this.previous.has(action) && !held.has(action))) released.add(action);
    }
    const move = this.suspended ? [0, 0] : i.move();
    const axes = i.padAxes || [], look = this.suspended ? [0, 0] : radialDeadzone(axes[2] || 0, axes[3] || 0, this.options.deadzone);
    const mouse = this.mouseDelta.splice(0, 2); this.mouseDelta.push(0, 0);
    const values = i.padValues || [];
    for(const index of this.analogBlocked)if((values[index]||0)<=.04)this.analogBlocked.delete(index);
    const analog = action => {
      if (this.suspended) return 0;
      let value = 0;
      for (const code of i.map[action] || []) {
        if (/^Pad\d+$/.test(code)) { const index=Number(code.slice(3)); if(!this.analogBlocked.has(index))value = Math.max(value, values[index] || 0); }
        else if (i.held.has(code)) value = 1;
      }
      return value;
    };
    const frame = {
      tick, dt, device: i.lastDevice, deviceId: i.padId || '', mapping: i.padMapping || '', connected: i.padIndex !== null,
      moveX: move[0], moveY: move[1], lookX: look[0], lookY: look[1], mouseX: mouse[0], mouseY: mouse[1],
      throttle: analog('throttle'), brake: analog('brake'), aimValue: analog('aim'), fireValue: analog('fire'), held, pressed, released,
      down: action => held.has(action), wasPressed: action => pressed.has(action), wasReleased: action => released.has(action)
    };
    this.previous = held; this.lastFrame = frame; return frame;
  }
  clear() { (this.engine.padValues||[]).forEach((value,index)=>{if(value>.04)this.analogBlocked.add(index);}); this.engine.clear(); this.previous.clear(); this.mouseDelta = [0, 0]; }
  suspend() { this.clear(); this.suspended = true; }
  resume() { this.clear(); this.suspended = false; }
  consume(frame, actions = ACTIONS) {
    for (const action of actions) { frame.held.delete(action); frame.pressed.delete(action); frame.released.delete(action); this.engine.consume(action); }
    frame.moveX = frame.moveY = frame.lookX = frame.lookY = frame.throttle = frame.brake = 0;
  }
  serialize(frame = this.lastFrame) {
    if (!frame) return null;
    const { tick, dt, device, deviceId, mapping, connected, moveX, moveY, lookX, lookY, mouseX, mouseY, throttle, brake, aimValue, fireValue } = frame;
    return { tick, dt, device, deviceId, mapping, connected, moveX, moveY, lookX, lookY, mouseX, mouseY, throttle, brake, aimValue, fireValue, held: [...frame.held], pressed: [...frame.pressed], released: [...frame.released] };
  }
  rebind(action, device, code) {
    device=device==='keyboard'?'keys':device==='controller'?'pad':device;
    if(action==='vault')action='jump';
    let result=this.engine.map[action]?.includes(code)?null:this.engine.rebind(action,device,code);
    if(result&&result!=='reserved'&&this.engine.map[result]){
      const old=this.engine.map[action].filter(value=>!value.startsWith('Act:')&&!value.startsWith('PadAxis')&&(/^Pad/.test(value)===(device==='pad')));
      const bindings={...this.engine.bindings,[action]:{...(this.engine.bindings[action]||{}),[device]:[code]},[result]:{...(this.engine.bindings[result]||{}),[device]:old}};
      if(action==='jump')bindings.vault={...(bindings.vault||{}),[device]:[code]};
      if(result==='jump')bindings.vault={...(bindings.vault||{}),[device]:old};
      if(this.game.settings?.set)this.game.settings.set('bindings',bindings);else this.engine.bindings=bindings;
    }
    if(result===null&&action==='jump'){
      const bindings={...this.engine.bindings,vault:{...(this.engine.bindings.vault||{}),[device]:[code]}};
      if(this.game.settings?.set)this.game.settings.set('bindings',bindings);else this.engine.bindings=bindings;
    }
    this.clear();return result;
  }
  dispose() { this.abort.abort(); this.clear(); }
}
