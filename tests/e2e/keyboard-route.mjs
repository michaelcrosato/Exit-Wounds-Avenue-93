/**
 * Title-to-credits keyboard/mouse route, with the broker ending by default.
 * Every menu/gameplay action is an ordinary keyboard or native mouse event. Semantic
 * game reads guide the driver; no pad fixture, director call, actor/state write,
 * save injection, damage shortcut, or objective shortcut is used.
 *
 * Default timing is ordinary browser time. EWA93_KEYBOARD_TIMING=accelerated
 * permits only the engine's existing fixed-step clock to run between events.
 * That supplemental mode is a reachability diagnostic, never V02 certification.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const engine = process.env.EWA93_KEYBOARD_ENGINE || 'chromium';
const cdpURL = process.env.EWA93_KEYBOARD_CDP;
const timing = process.env.EWA93_KEYBOARD_TIMING || 'realtime';
const ending = process.env.EWA93_ENDING || 'broker';
const baseURL = process.env.EWA93_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.EWA93_KEYBOARD_OUTPUT || `/tmp/ewa93-keyboard-${timing}-${ending}-${Date.now()}`;
assert.ok(['realtime', 'accelerated'].includes(timing));
assert.ok(['broker', 'reporter'].includes(ending));
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
await mkdir(output, { recursive: true });
// Chromium's headless CDP mouse movement produces opposite warp events under
// pointer lock. A private X server plus native XTest motion preserves real,
// trusted relative mouse events without injecting DOM/gameplay events.
const nativeWindows = engine === 'chromium' && process.platform === 'win32' && process.env.EWA93_KEYBOARD_NATIVE_MOUSE !== '0';
const nativeMouse = engine === 'chromium' && process.platform === 'linux' && !cdpURL && process.env.EWA93_KEYBOARD_NATIVE_MOUSE !== '0';
let xServer, display = process.env.DISPLAY;
if (nativeMouse) {
  display = `:${200 + process.pid % 5000}`;
  // Explicit numbering also works with WSLg's nonstandard /tmp X socket mode,
  // where Xvfb -displayfd can fail even though its abstract socket is usable.
  xServer = spawn('Xvfb', [display, '-screen', '0', '1280x900x24', '-nolisten', 'tcp'], { stdio: 'ignore' });
  await new Promise(resolve => setTimeout(resolve, 300));
  process.on('exit', () => xServer.kill());
}
const nativeScript = `import ctypes,sys
x=ctypes.CDLL('libX11.so.6');t=ctypes.CDLL('libXtst.so.6')
x.XOpenDisplay.restype=ctypes.c_void_p;d=x.XOpenDisplay(None)
if not d: raise RuntimeError('Cannot open private X display')
t.XTestFakeMotionEvent.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_ulong]
t.XTestFakeRelativeMotionEvent.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_ulong]
t.XTestFakeButtonEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]
if sys.argv[1]=='abs':t.XTestFakeMotionEvent(d,-1,int(sys.argv[2]),int(sys.argv[3]),0)
if sys.argv[1]=='rel':t.XTestFakeRelativeMotionEvent(d,int(sys.argv[2]),int(sys.argv[3]),0)
if sys.argv[1]=='button':t.XTestFakeButtonEvent(d,int(sys.argv[2]),int(sys.argv[3]),0)
x.XFlush.argtypes=[ctypes.c_void_p];x.XFlush(d)
x.XCloseDisplay.argtypes=[ctypes.c_void_p];x.XCloseDisplay(d)`;
let windowsMouse;
const windowsPending = [];
if (nativeWindows) {
  windowsMouse = spawn('powershell.exe', ['-NoProfile', '-Command', `Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class Ewa93Mouse {
 public delegate bool WindowCallback(IntPtr window, IntPtr data);
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, uint data, UIntPtr extra);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window, out Rect rect);
 [DllImport("user32.dll")] public static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
 [DllImport("user32.dll")] static extern bool EnumWindows(WindowCallback callback, IntPtr data);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window, StringBuilder text, int size);
 [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window, int command);
 [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr window);
 [DllImport("user32.dll")] static extern bool AttachThreadInput(uint first, uint second, bool attach);
 [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
 static IntPtr Find(uint process) {
  IntPtr match=IntPtr.Zero;
  EnumWindows((window,data)=>{uint owner;GetWindowThreadProcessId(window,out owner);if(owner==process&&IsWindowVisible(window)){var text=new StringBuilder(512);GetWindowText(window,text,512);if(text.ToString().Contains("Exit Wounds Avenue-93")){match=window;return false;}}return true;},IntPtr.Zero);
  return match;
 }
 public static string Inspect(uint process) {
  var result=new StringBuilder();
  EnumWindows((window,data)=>{uint owner;GetWindowThreadProcessId(window,out owner);if(owner==process){var text=new StringBuilder(512);GetWindowText(window,text,512);result.Append(window.ToString()+":"+IsWindowVisible(window)+":"+text.ToString()+";");}return true;},IntPtr.Zero);
  return result.ToString();
 }
 public static string Center(uint process) {
  IntPtr match=Find(process);if(match==IntPtr.Zero)return "missing";
  Rect rect;GetWindowRect(match,out rect);SetCursorPos((rect.Left+rect.Right)/2,(rect.Top+rect.Bottom)/2);
  return rect.Left+","+rect.Top+","+rect.Right+","+rect.Bottom;
 }
 public static bool Activate(uint process) {
  IntPtr match=Find(process);if(match==IntPtr.Zero)return false;
  ShowWindow(match,9);BringWindowToTop(match);if(SetForegroundWindow(match))return true;
  uint foregroundProcess;uint foregroundThread=GetWindowThreadProcessId(GetForegroundWindow(),out foregroundProcess);uint currentThread=GetCurrentThreadId();
  bool attached=foregroundThread!=currentThread&&AttachThreadInput(currentThread,foregroundThread,true);
  ShowWindow(match,9);BringWindowToTop(match);bool result=SetForegroundWindow(match);
  if(attached)AttachThreadInput(currentThread,foregroundThread,false);
  return result;
 }
}
'@
[void][Ewa93Mouse]::SetProcessDPIAware()
[Console]::WriteLine('ready')
while ($line = [Console]::ReadLine()) {
 $parts = $line.Split(' '); $a = [int]$parts[1]; $b = [int]$parts[2]
 if ($parts[0] -eq 'focus') { $taskWindowPid = [uint32]0; [void][Ewa93Mouse]::GetWindowThreadProcessId([Ewa93Mouse]::GetForegroundWindow(),[ref]$taskWindowPid); $name = if ($taskWindowPid) { (Get-Process -Id $taskWindowPid -ErrorAction SilentlyContinue).ProcessName } else { 'none' }; [Console]::WriteLine('focus:' + $name); continue }
 if ($parts[0] -eq 'activate') { [Console]::WriteLine('activate:' + [Ewa93Mouse]::Activate([uint32]$a)); continue }
 if ($parts[0] -eq 'center') { [Console]::WriteLine('center:' + [Ewa93Mouse]::Center([uint32]$a)); continue }
 if ($parts[0] -eq 'inspect') { [Console]::WriteLine('inspect:' + [Ewa93Mouse]::Inspect([uint32]$a)); continue }
 if ($parts[0] -eq 'alttab') { [Ewa93Mouse]::keybd_event(18,0,0,[UIntPtr]::Zero);[Ewa93Mouse]::keybd_event(9,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 80;[Ewa93Mouse]::keybd_event(9,0,2,[UIntPtr]::Zero);[Ewa93Mouse]::keybd_event(18,0,2,[UIntPtr]::Zero);[Console]::WriteLine('ok');continue }
 if ($parts[0] -eq 'altup') { [Ewa93Mouse]::keybd_event(18,0,2,[UIntPtr]::Zero);[Console]::WriteLine('ok');continue }
 if ($parts[0] -eq 'abs') { [void][Ewa93Mouse]::SetCursorPos($a,$b) }
 elseif ($parts[0] -eq 'rel') { [Ewa93Mouse]::mouse_event(8193,$a,$b,0,[UIntPtr]::Zero) }
 elseif ($parts[0] -eq 'button') { $flag = if ($a -eq 3) { if ($b) {8} else {16} } else { if ($b) {2} else {4} }; [Ewa93Mouse]::mouse_event($flag,0,0,0,[UIntPtr]::Zero) }
 [Console]::WriteLine('ok')
}`], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let buffer = '';
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Native Windows mouse helper did not start.')), 15000);
    windowsMouse.on('error', reject);
    windowsMouse.stdout.on('data', chunk => {
      buffer += String(chunk);
      while (buffer.includes('\n')) {
        const end = buffer.indexOf('\n'), line = buffer.slice(0, end).trim(); buffer = buffer.slice(end + 1);
        if (line === 'ready') { clearTimeout(timeout); resolve(); }
        else if (line === 'ok') windowsPending.shift()?.();
        else if (line.startsWith('focus:')) windowsPending.shift()?.(line.slice(6));
        else if (line.startsWith('activate:')) windowsPending.shift()?.(line.slice(9) === 'True');
        else if (line.startsWith('center:')) windowsPending.shift()?.(line.slice(7));
        else if (line.startsWith('inspect:')) windowsPending.shift()?.(line.slice(8));
      }
    });
    windowsMouse.stderr.on('data', chunk => process.stderr.write(chunk));
  });
  process.on('exit', () => windowsMouse.kill());
}
async function native(op, a, b) {
  if (nativeWindows) return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Native Windows mouse command timed out.')), 5000);
    windowsPending.push(value => { clearTimeout(timeout); resolve(value); });
    windowsMouse.stdin.write(`${op} ${Math.round(a)} ${Math.round(b)}\n`);
  });
  execFileSync('python3', ['-c', nativeScript, op, String(Math.round(a)), String(Math.round(b))], { env: { ...process.env, DISPLAY: display } });
}
const browser = cdpURL ? await chromium.connectOverCDP(cdpURL) : await ({ chromium, firefox, webkit }[engine]).launch({
  headless: nativeMouse || nativeWindows ? false : process.env.EWA93_KEYBOARD_HEADED !== '1',
  handleSIGTERM: false,
  env: { ...process.env, DISPLAY: display },
  args: engine === 'chromium' ? ['--enable-unsafe-swiftshader'] : [],
});
let nativeBrowserPid = 0;
if (nativeWindows) {
  const protocol = await browser.newBrowserCDPSession();
  nativeBrowserPid = (await protocol.send('SystemInfo.getProcessInfo')).processInfo.find(p => p.type === 'browser')?.id || 0;
  assert.ok(nativeBrowserPid, 'The native mouse driver must identify its dedicated browser process.');
}
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce',
  ...(timing === 'realtime' ? { recordVideo: { dir: `${output}/video`, size: { width: 1280, height: 720 } } } : {}),
});
const page = await context.newPage();
let focusProtocol;
if (engine === 'chromium') {
  // Playwright enables focus emulation by default, which hides real tab/window
  // blur from the page. Disable it so the recovery check observes native focus.
  focusProtocol = await context.newCDPSession(page);
  await focusProtocol.send('Emulation.setFocusEmulationEnabled', { enabled: false });
}
page.setDefaultTimeout(60000);
const report = {
  testVersion: 1, engine, browserVersion: browser.version(), ending, baseURL,
  environment: { platform: process.platform, node: process.version, cdp: cdpURL || null, nativeMouse: nativeWindows ? 'Win32' : nativeMouse ? 'XTest' : 'Playwright' },
  seed: 93, timing, usesGameAdvance: timing === 'accelerated', ordinaryTimeCompletion: false,
  inputPath: nativeWindows ? 'Playwright keyboard events and native Win32 mouse; no gamepad fixture' : nativeMouse ? 'Playwright keyboard events and native XTest mouse; no gamepad fixture' : 'Playwright keyboard/mouse browser events; no gamepad fixture',
  limitations: ['Automated skilled route; does not establish fresh-player pacing or physical controller support.'],
  startedAt: new Date().toISOString(), status: 'running', errors: [], checks: {}, checkpoints: [], actions: [], browserEvents: [], loadedSourceHashes: {},
};
report.sourceHashes = Object.fromEntries(await Promise.all(['src/main.js', 'src/ui/interface.css', 'src/actors/companion.js', 'src/engine/vehicles.js', 'src/world/district.js', 'tests/e2e/keyboard-route.mjs'].map(async path => [path, createHash('sha256').update(await readFile(new URL(`../../${path}`, import.meta.url))).digest('hex')])));
const resourceHashJobs = [];
page.on('response', response => {
  const path = new URL(response.url()).pathname.replace(/^\/+/, '');
  if (!/^src\/.*\.(js|css)$/.test(path)) return;
  resourceHashJobs.push(response.body().then(bytes => { report.loadedSourceHashes[path] = createHash('sha256').update(bytes).digest('hex'); }).catch(() => {}));
});
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') report.errors.push(message.text());
  if (message.text().startsWith('__EWA93_BROWSER_EVENT__')) report.browserEvents.push(JSON.parse(message.text().slice('__EWA93_BROWSER_EVENT__'.length)));
});
const keys = new Set();
const mouseButtons = new Set();
let mouseX = 640, mouseY = 360;
let windowsMousePixelsPerCount = 1.6, lastWindowsMouseCountX = 0;
let interactKey = 'KeyF';
let lastProgressAt = 0;
let cancelled = false;
process.once('SIGTERM', () => { cancelled = true; });

function log(action, detail = {}) { report.actions.push({ wallTime: new Date().toISOString(), action, ...detail }); }
async function read() {
  return page.evaluate(() => {
    const a = window.__exitWounds?.app, s = a?.state;
    if (!a) return { screen: document.querySelector('.screen')?.getAttribute('aria-label') || 'booting' };
    const p = s?.player.position;
    const muzzleRaw = a.player?.actor.rig?.tip?.();
    const muzzle = muzzleRaw ? { x: muzzleRaw[0] / 16, y: muzzleRaw[1] / 16, z: muzzleRaw[2] / 16 } : null;
    return {
      screen: a.ui.screen, tick: s?.tick, elapsed: s?.elapsed, runId: s?.runId,
      runtimeMetadata: a.runtime?.metadata,
      phase: s?.mission.phase, mission: s?.mission, position: p,
      health: s?.player.health, armor: s?.player.armor, wallet: s?.player.wallet,
      playerVisual: { damageFlash: a.player?.damageFlash, actorFlash: a.player?.actor.flash },
      inventory: s?.player.inventory, wanted: s?.wanted, jun: s?.actors.jun,
      junPath: a.jun?.path, junTarget: a.jun?.target, junMode: a.jun?.mode,
      district: s?.district, vehicleId: s?.player.vehicleId,
      transactions: s?.economy.transactions,
      vehicles: a.runtime?.vehicles.list.map(v => ({ id: v.id, position: v.position, yaw: v.yaw, speed: v.speed / 16, health: v.health, disabled: v.disabled, sleeping: v.body.isSleeping(), appearance: v.appearance, controls: { throttle: v.controls.throttle || 0, brake: v.controls.brake || 0, reverse: !!v.controls.reverse, handbrake: !!v.controls.handbrake }, seats: v.seats.map(actor => actor?.id || null) })),
      transitions: [...(a.runtime?.vehicles.transitions || [])].map(([actor, transition]) => ({ actor: actor.id, kind: transition.kind, vehicle: transition.vehicle.id })),
      vaulting: !!a.vaultState,
      inCover: !!a.player?.inCover, coverId: a.cover?.active?.id || null,
      yaw: a.runtime?.camera.yaw, pitch: a.runtime?.camera.pitch,
      cameraShoulder: a.runtime?.camera.shoulder,
      eye: a.runtime?.camera.eye ? { x: a.runtime.camera.eye.x / 16, y: a.runtime.camera.eye.y / 16, z: a.runtime.camera.eye.z / 16 } : null,
      pointerLocked: document.pointerLockElement?.id || null, focused: document.hasFocus(), hidden: document.hidden,
      inputHeld: [...(a.runtime?.input.engine.held || [])], device: a.runtime?.input.lastFrame?.device,
      inputMove: { x: a.runtime?.input.lastFrame?.moveX || 0, y: a.runtime?.input.lastFrame?.moveY || 0 },
      inputDrive: { throttle: a.runtime?.input.lastFrame?.throttle || 0, brake: a.runtime?.input.lastFrame?.brake || 0 },
      bindings: a.runtime?.input.engine.map.interact,
      prompt: document.querySelector('#hud-prompt')?.textContent,
      toast: document.querySelector('#hud-toast')?.textContent,
      crew: (a.crew?.enemies || []).map(e => {
        const q = a.crew.positionOf(e);
        // Match the actual aim point: a 1.2m test would hide a visible head
        // behind the authored 1.25m cargo cover and delay normal return fire.
        return { id: e.id, health: e.health, position: q, velocity: { x: e.actor.vx / 16, y: e.actor.vy / 16, z: e.actor.vz / 16 },
          muzzleClear: !!muzzle && a.runtime.queries.lineOfSight(muzzle, { x: q.x, y: q.y, z: q.z + 1.45 }, { ignore: [a.player.actor], target: e.actor }),
          lineOfSight: !!p && a.runtime.queries.lineOfSight(
            { x: p.x, y: p.y, z: p.z + 1.5 },
            { x: q.x, y: q.y, z: q.z + 1.45 },
            { ignore: [a.player.actor], target: e.actor }),
        };
      }),
    };
  });
}
function healthy(s) {
  if (s.mission?.failure || ['retry', 'error'].includes(s.screen)) throw new Error(`Mission failure: ${JSON.stringify(s.mission?.failure || s.screen)}`);
  return s;
}
async function step(seconds = 0.05) {
  if (cancelled) throw new Error('Route interrupted by its test operator.');
  if (timing === 'accelerated') {
    // Only the existing engine clock is invoked. All input is already present
    // from trusted browser events; the callback changes no gameplay objects.
    await page.evaluate(seconds => window.__exitWounds.runtime.game.advance(seconds), seconds);
  } else {
    await page.waitForTimeout(seconds * 1000);
  }
  const s = healthy(await read());
  if (Date.now() - lastProgressAt > 45000) {
    console.log(JSON.stringify({ progress: s.phase || s.screen, elapsed: s.elapsed, position: s.position, health: s.health, armor: s.armor }));
    lastProgressAt = Date.now();
  }
  return s;
}
async function until(predicate, message, { seconds = 15, quantum = 0.05 } = {}) {
  const start = Date.now();
  // Wall time limits cover software-rendering delays as well as simulation time.
  while (Date.now() - start < seconds * 1000) {
    const s = await step(quantum);
    if (predicate(s)) return s;
  }
  throw new Error(`${message}; state=${JSON.stringify(await read())}`);
}
async function setKeys(wanted = []) {
  const next = new Set(wanted);
  for (const key of keys) if (!next.has(key)) { await page.keyboard.up(key); keys.delete(key); log('key-up', { key }); }
  for (const key of next) if (!keys.has(key)) { await page.keyboard.down(key); keys.add(key); log('key-down', { key }); }
}
async function releaseAll() {
  await setKeys();
  for (const button of [...mouseButtons]) await mouseUp(button).catch(() => {});
  mouseButtons.clear();
}
async function mouseDown(button) {
  if (nativeWindows && !await page.evaluate(() => document.hasFocus())) throw new Error('Native mouse target lost foreground before button press.');
  if (nativeMouse || nativeWindows) await native('button', button === 'right' ? 3 : 1, 1);
  else await page.mouse.down({ button });
  mouseButtons.add(button); log('mouse-down', { button });
}
async function mouseUp(button) {
  if (nativeMouse || nativeWindows) await native('button', button === 'right' ? 3 : 1, 0);
  else await page.mouse.up({ button });
  mouseButtons.delete(button); log('mouse-up', { button });
}
async function press(key, seconds = 0.05) {
  log('key-press', { key, seconds });
  const before = await read();
  await page.keyboard.down(key);
  try {
    const after = await step(seconds);
    if (timing === 'realtime' && before.screen === 'playing' && after.screen === 'playing' && after.tick === before.tick) {
      await until(s => s.tick > before.tick || s.screen !== 'playing', 'The normal key press must reach an ordinary game frame', { seconds: 10 });
    }
  } finally { await page.keyboard.up(key); }
  return step(0.025);
}
async function menuFocus(action) {
  // show() schedules initial focus on the next rendered frame. Do not race
  // that frame with a burst of arrows on a slow software renderer.
  await page.locator('.screen [data-focused="true"]').waitFor();
  const list = await page.locator('.screen [data-action]:not(:disabled),.screen [data-setting]:not(:disabled)').evaluateAll(elements => elements.map(e => ({
    action: e.dataset.action, setting: e.dataset.setting, focused: e.dataset.focused === 'true',
  })));
  const target = list.findIndex(e => e.action === action || e.setting === action);
  assert.notEqual(target, -1, `Menu action ${action} must be visible.`);
  for (let i = 0; i < list.length * 2; i++) {
    const focused = await page.locator('.screen [data-focused="true"]').getAttribute('data-action');
    const setting = await page.locator('.screen [data-focused="true"]').getAttribute('data-setting');
    if (focused === action || setting === action) return;
    await page.keyboard.press('ArrowDown');
  }
  throw new Error(`Keyboard focus must reach ${action}.`);
}
async function menu(action) {
  await menuFocus(action); await page.keyboard.press('Enter'); await step(0.025); log('menu', { actionName: action });
}
async function note(name) {
  const s = await read();
  const liveCombat = s.screen === 'playing' && s.phase === 'RECOVERY' && s.crew.some(e => e.health > 0);
  report.checkpoints.push({ name, ...s, ...(liveCombat ? { screenshotSkipped: 'Avoid software-renderer screenshot latency while enemies can fire; ordinary-time mode records video.' } : {}) });
  const storage = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('exit-wounds-avenue-93.')).map(key => [key, localStorage.getItem(key)])));
  await writeFile(`${output}/${name}-storage.json`, JSON.stringify(storage, null, 2));
  if (!liveCombat) await page.screenshot({ path: `${output}/${name}.png` });
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checkpoint: name, phase: s.phase, elapsed: s.elapsed, position: s.position, health: s.health, armor: s.armor }));
}
async function moveMouse(dx, dy) {
  log('relative-mouse', { dx, dy });
  // Under pointer lock Chromium reports relative movement for these ordinary
  // mouse events; coordinates are intentionally accumulated, never reset by JS.
  if (nativeWindows) {
    // Windows applies its current pointer acceleration to injected native
    // counts. Damped corrections converge without changing the user's OS
    // mouse settings; bounded moves also avoid pointer-lock edge clipping.
    const counts = value => Math.abs(value) < 0.6 ? 0 : Math.sign(value) * Math.max(1, Math.min(40, Math.round(Math.abs(value) / windowsMousePixelsPerCount)));
    lastWindowsMouseCountX = counts(dx);
    await native('rel', lastWindowsMouseCountX, counts(dy));
    // Native cursor recentering runs on the Windows message pump, not on the
    // accelerated game clock. Let it finish before another relative event.
    await page.waitForTimeout(20);
  } else if (nativeMouse) {
    const before = timing === 'realtime' ? await read() : null;
    await native('rel', dx, dy);
    if (before && (dx || dy)) {
      // On a slow software renderer, a native event can arrive after a short
      // timeout. Observe its ordinary camera update before correcting again;
      // otherwise several unconsumed deltas would overshoot together.
      await page.waitForFunction(({ yaw, pitch }) => {
        const camera = window.__exitWounds?.runtime.camera;
        const app = window.__exitWounds?.app;
        return app?.ui.screen !== 'playing' || camera && (Math.abs(camera.yaw - yaw) > 1e-6 || Math.abs(camera.pitch - pitch) > 1e-6);
      }, { yaw: before.yaw, pitch: before.pitch }, { timeout: 10000 });
    }
  }
  else { mouseX += dx; mouseY += dy; await page.mouse.move(mouseX, mouseY); }
  await step(timing === 'accelerated' ? 1 / 120 : 0.017);
}
async function lockMouse() {
  const before = await read();
  if (before.pointerLocked === 'screen') return;
  const weapon = before.inventory?.equipped;
  if (weapon && weapon !== 'unarmed') await equip('unarmed');
  mouseX = 640; mouseY = 350;
  if (nativeMouse || nativeWindows) {
    if (nativeWindows) {
      await page.bringToFront(); await page.waitForTimeout(150);
      const activated = await native('activate', nativeBrowserPid, 0);
      if (!activated) report.nativeWindowDiagnostics = await native('inspect', nativeBrowserPid, 0);
      assert.equal(activated, true, 'The dedicated game window must be activated before native input.');
      // Alt+Tab releases Alt in the destination window. Clear it again after
      // reactivation so Chrome's thread cannot retain an OS-level Alt latch.
      await native('altup', 0, 0);
      await page.waitForTimeout(50);
    }
    if (nativeWindows) report.nativeWindowBounds = await native('center', nativeBrowserPid, 0);
    else {
      const location = await page.evaluate(({ x, y }) => ({ x: screenX + (outerWidth - innerWidth) / 2 + x, y: screenY + outerHeight - innerHeight - (outerWidth - innerWidth) / 2 + y }), { x: mouseX, y: mouseY });
      await native('abs', location.x, location.y);
    }
    await page.waitForTimeout(30);
    await mouseDown('left'); await mouseUp('left');
  } else await page.mouse.click(mouseX, mouseY);
  await until(s => s.pointerLocked === 'screen', 'Mouse click did not acquire pointer lock', { seconds: 5 });
  if (weapon && weapon !== 'unarmed') await equip(weapon);
}
async function equip(weapon) {
  await setKeys(); await page.keyboard.down('Tab');
  await until(s => s.screen === 'wheel', 'Tab must open weapon wheel');
  await menuFocus(weapon === 'pistol' ? 'chooseWeaponPistol' : weapon === 'smg' ? 'chooseWeaponSmg' : 'chooseWeapon');
  await page.keyboard.up('Tab');
  await until(s => s.screen === 'playing' && s.inventory.equipped === weapon, `Weapon wheel must equip ${weapon}`);
  log('keyboard-weapon-wheel', { weapon });
}
async function interact(expectedPhase) {
  await setKeys(); await step(0.15); await press(interactKey); log('interact', { key: interactKey, expectedPhase });
  if (expectedPhase) await until(s => s.phase === expectedPhase, `${interactKey} interaction should reach ${expectedPhase}`, { seconds: 10 });
}
async function walk(x, y, { sprint = true, radius = 1.1, allowDetour = true, engage = true } = {}) {
  let s = healthy(await read()), previousDistance = Infinity, stagnant = 0;
  for (let count = 0; count < 2200; count++) {
    assert.equal(s.screen, 'playing', `Route unexpectedly left gameplay at (${x}, ${y}).`);
    if (engage && s.phase === 'RECOVERY' && s.crew.some(e => e.health > 0 && e.lineOfSight && e.muzzleClear && Math.hypot(e.position.x - s.position.x, e.position.y - s.position.y) < 30)) {
      await setKeys(); log('respond-to-nearby-crew', { position: s.position });
      await fight(); s = await read();
    }
    const dx = x - s.position.x, dy = y - s.position.y, distance = Math.hypot(dx, dy);
    if (distance <= radius) { await setKeys(); await step(0.025); return; }
    const desiredYaw = Math.atan2(dy, dx), delta = Math.atan2(Math.sin(desiredYaw - s.yaw), Math.cos(desiredYaw - s.yaw));
    if (Math.abs(delta) > 0.02) {
      await setKeys(); await moveMouse(Math.round(delta / 0.0023), 0); s = await read(); continue;
    }
    await setKeys(['KeyW', ...(sprint ? ['ShiftLeft'] : [])]);
    const next = await step(Math.min(0.16, Math.max(0.025, distance / (sprint ? 5.15 : 3.05) * 0.45)));
    const progress = Math.hypot(next.position.x - s.position.x, next.position.y - s.position.y);
    stagnant = progress < 0.004 || distance > previousDistance - 0.002 ? stagnant + 1 : 0;
    if (stagnant > 12 && allowDetour) {
      await setKeys();
      const side = await page.evaluate(({ x, y }) => {
        const a = window.__exitWounds.app, p = a.player.position, distance = Math.max(0.01, Math.hypot(x - p.x, y - p.y));
        const tx = -(y - p.y) / distance, ty = (x - p.x) / distance;
        return [1, -1].map(sign => ({ x: p.x + tx * sign * 1.3, y: p.y + ty * sign * 1.3, z: p.z }))
          .find(q => a.runtime.queries.capsuleClear({ x: q.x * 16, y: q.y * 16, z: q.z * 16 }, a.player.actor.r, a.player.actor.half, { ignore: [a.player.actor] })) || null;
      }, { x, y });
      if (side) {
        log('walk-around-obstruction', { goal: { x, y }, side });
        await walk(side.x, side.y, { sprint: false, radius: 0.25, allowDetour: false, engage });
        s = await read(); previousDistance = Infinity; stagnant = 0; continue;
      }
    }
    if (stagnant > 65) throw new Error(`Physical keyboard route blocked approaching (${x},${y}) at ${JSON.stringify(next.position)}; prompt=${next.prompt}`);
    previousDistance = distance; s = next;
  }
  throw new Error(`Keyboard route could not converge to (${x},${y}); ${JSON.stringify(s.position)}`);
}
async function route(points, options) { for (const [x, y] of points) await walk(x, y, options); }
async function stopCar() {
  for (let i = 0; i < 160; i++) {
    const s = await read(), car = s.vehicles.find(v => v.id === s.vehicleId);
    assert.equal(s.screen, 'playing', 'Driving unexpectedly left gameplay.');
    assert.ok(car, 'A live car must be occupied before braking.');
    if (Math.abs(car.speed) < 0.12) { await setKeys(); await step(0.05); return; }
    await setKeys(['Space', ...(car.speed > 0.7 ? ['KeyS'] : [])]); await step(0.08);
  }
  throw new Error('Keyboard braking did not stop the vehicle.');
}
async function drive(x, y, { radius = 2.3, speed = 5, reverse = false } = {}) {
  let stagnant = 0, shunts = 0;
  for (let i = 0; i < 1800; i++) {
    const s = await read(), car = s.vehicles.find(v => v.id === s.vehicleId);
    assert.equal(s.screen, 'playing', 'Driving unexpectedly left gameplay.');
    assert.ok(car && car.health > 0 && !car.disabled, `Drive requires a usable occupied vehicle: ${JSON.stringify(car)}`);
    const dx = x - car.position.x, dy = y - car.position.y, distance = Math.hypot(dx, dy);
    if (distance < radius) { await stopCar(); log('drive-waypoint', { x, y, vehicle: car.id }); return; }
    const desiredYaw = Math.atan2(dy, dx) + (reverse ? Math.PI : 0);
    const delta = Math.atan2(Math.sin(desiredYaw - car.yaw), Math.cos(desiredYaw - car.yaw)) * (reverse ? -1 : 1);
    const desired = Math.min(speed, distance < 8 ? 2.4 : Math.abs(delta) > 0.55 ? 3 : speed);
    await setKeys([
      ...(delta > 0.065 ? ['KeyD'] : delta < -0.065 ? ['KeyA'] : []),
      ...(reverse
        ? Math.abs(car.speed) < desired - 0.2 ? ['KeyS'] : Math.abs(car.speed) > desired + 0.5 ? ['Space'] : []
        : car.speed < desired - 0.2 ? ['KeyW'] : car.speed > desired + 0.5 ? ['KeyS'] : []),
    ]);
    const next = await step(0.08), nextCar = next.vehicles.find(v => v.id === car.id);
    stagnant = Math.hypot(nextCar.position.x - car.position.x, nextCar.position.y - car.position.y) < 0.005 ? stagnant + 1 : 0;
    if (stagnant > 35 && !reverse && shunts < 3) {
      // A real reverse-and-steer correction handles a bumper caught on a gate
      // post or traffic. No body/velocity/transform correction is injected.
      await setKeys(['KeyS', delta > 0 ? 'KeyA' : 'KeyD']); await step(1);
      await stopCar(); shunts++; stagnant = 0; log('reverse-shunt', { vehicle: car.id, goal: { x, y }, shunts }); continue;
    }
    if (stagnant > 85) throw new Error(`Physical keyboard driving blocked toward (${x},${y}); car=${JSON.stringify(nextCar)}`);
  }
  throw new Error(`Keyboard steering could not converge to (${x},${y}); state=${JSON.stringify(await read())}`);
}
async function driveRoute(points, options) { for (const [x, y] of points) await drive(x, y, options); }
async function boardVan() {
  const before = await read(), van = before.vehicles.find(v => v.id === 'yard-van');
  if (!before.vehicleId) {
    const sideX = -Math.sin(van.yaw), sideY = Math.cos(van.yaw);
    const side = (before.position.x - van.position.x) * sideX + (before.position.y - van.position.y) * sideY >= 0 ? 1 : -1;
    await walk(van.position.x + sideX * side * 2.75, van.position.y + sideY * side * 2.75, { sprint: false, radius: 0.25 });
  }
  await interact();
  await until(s => s.vehicleId === 'yard-van' && !s.transitions.some(t => t.actor === 'mara'), 'The yard van must be entered through the remapped key', { seconds: 30, quantum: 0.1 });
  await until(s => s.jun.vehicleId === 'yard-van' && s.jun.seat === 'passenger' && !s.transitions.some(t => t.actor === 'jun'), 'Jun must reach and board the actual free passenger seat', { seconds: 60, quantum: 0.2 });
}
async function exitVan() {
  await stopCar(); await interact();
  await until(s => !s.vehicleId && !s.transitions.length, 'Mara and Jun must have usable vehicle exits', { seconds: 30, quantum: 0.1 });
}
async function aimAt(targetId, maxCorrections = 64) {
  for (let count = 0; count < maxCorrections; count++) {
    const s = await read(), target = s.crew.find(e => e.id === targetId);
    assert.equal(s.screen, 'playing', 'Mouse aiming unexpectedly left gameplay.');
    if (!target || target.health <= 0) return;
    const eye = s.eye || { ...s.position, z: s.position.z + 1.5 };
    const point = { x: target.position.x + target.velocity.x * 0.06, y: target.position.y + target.velocity.y * 0.06, z: target.position.z + 1.45 };
    const dx = point.x - eye.x, dy = point.y - eye.y;
    const px = point.x - s.position.x, py = point.y - s.position.y, range = Math.hypot(px, py);
    // Solve shoulder parallax directly instead of chasing the orbiting eye.
    const yaw = Math.atan2(py, px) - Math.asin(Math.max(-0.95, Math.min(0.95, s.cameraShoulder * 0.62 / Math.max(0.1, range))));
    const delta = Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw));
    const pitch = Math.atan2(point.z - eye.z, Math.hypot(dx, dy));
    const angularRadius = Math.atan2(0.18, Math.hypot(dx, dy));
    if (Math.abs(delta) < Math.max(0.0017, angularRadius) && Math.abs(pitch - s.pitch) < Math.max(0.002, angularRadius)) return;
    await moveMouse(Math.round(delta / 0.0023), Math.round((s.pitch - pitch) / 0.0021));
  }
}
async function fight() {
  await setKeys();
  const ineffective = new Map();
  await mouseDown('right'); await step(0.05);
  try {
    for (let burst = 0; burst < 48; burst++) {
      const s = await read();
      assert.equal(s.screen, 'playing', 'Combat unexpectedly left gameplay.');
      const target = s.crew.filter(e => e.health > 0 && e.lineOfSight && (!s.inCover || e.muzzleClear) && (ineffective.get(e.id) || 0) < 2 && Math.hypot(e.position.x - s.position.x, e.position.y - s.position.y) < 35)
        .sort((a, b) => Math.hypot(a.position.x - s.position.x, a.position.y - s.position.y) - Math.hypot(b.position.x - s.position.x, b.position.y - s.position.y))[0];
      if (!target) return;
      const distance = Math.hypot(target.position.x - s.position.x, target.position.y - s.position.y);
      const preferred = s.inventory.weapons.smg.owned && !report.checks.smgHit ? 'smg' : 'pistol';
      if (s.inventory.equipped !== preferred) {
        await mouseUp('right'); await equip(preferred); await mouseDown('right'); await step(0.025); continue;
      }
      const ammo = s.inventory.weapons[s.inventory.equipped];
      if (!ammo.magazine && !ammo.reserve) throw new Error('No ammunition remains during the ordinary mouse encounter.');
      if (!ammo.magazine) { await press('KeyR'); await step(s.inventory.equipped === 'smg' ? 1.95 : 1.45); }
      // Acquire promptly, then track while firing. Waiting for a moving
      // flanker to remain perfectly centered leaves Mara exposed indefinitely
      // on a low-frame-rate renderer, unlike normal player fire-and-correct.
      await aimAt(target.id, 3);
      await mouseDown('left');
      // Continue normal mouse tracking while the trigger is held, just as a
      // player follows a moving target instead of firing at its old position.
      for (let tracking = 0; tracking < 6; tracking++) {
        await aimAt(target.id, 1); await step(0.035);
        if ((await read()).crew.find(e => e.id === target.id).health <= 0) break;
      }
      await mouseUp('left');
      const after = await step(0.025), remaining = after.crew.find(e => e.id === target.id).health;
      ineffective.set(target.id, remaining === target.health ? (ineffective.get(target.id) || 0) + 1 : 0);
      log('mouse-burst', { target: target.id, weapon: after.inventory.equipped, before: target.health, after: remaining, ammo: after.inventory.weapons[after.inventory.equipped].magazine });
      if (after.inventory.equipped === 'smg' && after.inventory.weapons.smg.magazine < s.inventory.weapons.smg.magazine) report.checks.smgFired = true;
      if (after.inventory.equipped === 'smg' && remaining < target.health) report.checks.smgHit = true;
      if (burst % 5 === 0) console.log(JSON.stringify({ combatBurst: burst, target: target.id, health: after.health, armor: after.armor, crew: after.crew.map(e => [e.id, e.health]) }));
    }
    throw new Error('Mouse fire did not resolve reachable visible enemies within 48 bursts.');
  } finally {
    for (const button of [...mouseButtons]) await mouseUp(button);
  }
}

try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-action="newGame"]').waitFor({ state: 'visible', timeout: 90000 });
  await menu('openSettings'); await menuFocus('quality');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#s-quality').inputValue(), 'low');
  await menu('openControls'); await menu('openRebind'); await menu('rebind:interact');
  await page.keyboard.press(interactKey); await step(0.025);
  assert.ok((await read()).bindings.includes(interactKey)); report.checks.remap = true;
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await until(s => s.screen === 'title', 'Escape should return from remapping to title');
  await menu('newGame'); await page.locator('.hud').waitFor(); await note('01-new-game-remapped');

  // Reacquiring pointer lock uses an unarmed click so it cannot fire a pistol.
  await equip('unarmed'); await lockMouse();
  const yawBefore = (await read()).yaw; await moveMouse(84, 0);
  const yawMoved = Math.abs((await read()).yaw - yawBefore);
  assert.ok(yawMoved > 0.01, 'Locked mouse movement must turn the camera.');
  if (nativeWindows && lastWindowsMouseCountX) {
    windowsMousePixelsPerCount = Math.max(0.5, Math.min(3, yawMoved / 0.0023 / Math.abs(lastWindowsMouseCountX)));
    report.nativeMousePixelsPerCount = windowsMousePixelsPerCount;
  }
  await press('Escape');
  await until(s => s.screen === 'pause' && !s.pointerLocked, 'Escape/pointer-lock exit should pause');
  const paused = await read(); await step(0.3); assert.equal((await read()).tick, paused.tick);
  await menu('resume'); await lockMouse(); report.checks.pointerLockExitReentry = true;
  await note('02-pointer-lock-recovered');

  await page.keyboard.down('KeyW'); keys.add('KeyW'); await step(0.08);
  await focusProtocol?.send('Emulation.setFocusEmulationEnabled', { enabled: false });
  await page.evaluate(() => {
    for (const type of ['blur', 'focus', 'visibilitychange']) (type === 'visibilitychange' ? document : window).addEventListener(type, event => {
      console.info('__EWA93_BROWSER_EVENT__' + JSON.stringify({ type, trusted: event.isTrusted, focused: document.hasFocus(), hidden: document.hidden, at: performance.now() }));
    });
  });
  const beforeFocusEvents = report.browserEvents.length;
  let otherTab;
  if (nativeWindows) { await native('alttab', 0, 0); report.focusLossMethod = 'Native Windows Alt+Tab'; }
  else { otherTab = await context.newPage(); await otherTab.goto('about:blank'); await otherTab.bringToFront(); report.focusLossMethod = 'Browser tab switch'; }
  await page.waitForTimeout(300);
  const lostFocus = await read();
  assert.equal(lostFocus.screen, 'pause', 'Switching to another browser tab must pause gameplay.');
  assert.ok(report.browserEvents.slice(beforeFocusEvents).some(e => e.trusted && ((e.type === 'blur' && !e.focused) || (e.type === 'visibilitychange' && e.hidden))), 'A trusted browser focus/visibility event must prove actual focus loss.');
  if (nativeWindows) { await native('activate', nativeBrowserPid, 0); await native('altup', 0, 0); }
  await page.bringToFront(); await otherTab?.close(); await page.keyboard.up('KeyW'); keys.delete('KeyW');
  await menu('resume');
  await step(0.4); // Allow ordinary character deceleration after cleared input.
  const beforeDrift = await read(); await step(0.25); const afterDrift = await read();
  report.focusRecovery = { before: beforeDrift.position, after: afterDrift.position, held: afterDrift.inputHeld, move: afterDrift.inputMove };
  assert.deepEqual(afterDrift.inputMove, { x: 0, y: 0 }, 'Focus loss must clear the normalized movement input.');
  assert.ok(Math.hypot(afterDrift.position.x - beforeDrift.position.x, afterDrift.position.y - beforeDrift.position.y) < 0.05, 'Focus-loss recovery must clear held movement.');
  report.checks.focusLoss = true; await lockMouse();

  await page.keyboard.down('KeyW'); keys.add('KeyW'); await step(0.08); await press('Escape');
  await until(s => s.screen === 'pause', 'Escape should pause while a movement key is held');
  const pauseState = await read(); await step(0.2); assert.equal((await read()).tick, pauseState.tick);
  await setKeys(); await menu('resume'); await lockMouse(); report.checks.pause = true;
  await equip('pistol'); await note('03-input-recovery-checked');

  await route([[91, 307], [104.5, 307.5]]);
  await until(s => /^F\s*·.*Eli/.test(s.prompt || ''), 'The normal remapped Eli prompt must refresh');
  assert.match((await read()).prompt, /^F\s*·/, 'The interaction HUD must display the remapped key.');
  report.checks.remappedPrompt = true;
  await press('KeyE'); assert.equal((await read()).phase, 'INTRO', 'Old E binding must no longer interact.');
  await interact('COLLECTION'); report.checks.remappedInteraction = true; await note('04-job-accepted');
  await route([[94, 307], [94, 278], [70, 270], [70, 214], [111.5, 216]]);
  await interact('APPROACH'); await note('05-bea-market');
  await route([[164, 216], [164, 245]], { radius: 0.4 });
  await walk(154, 245, { sprint: false, radius: 0.25 });
  await until(s => /^F\s*·.*toolbox/i.test(s.prompt || ''), 'The normal remapped toolbox prompt must refresh');
  report.remappedToolboxPrompt = (await read()).prompt;
  assert.match(report.remappedToolboxPrompt, /^F\s*·.*toolbox/i, 'The toolbox prompt must reflect the remapped interaction key.');
  await interact();
  assert.equal((await read()).mission.favor, 'carrying'); await note('05a-toolbox-collected');
  await route([[70, 245], [70, 270], [94, 278], [94, 304]]);
  await walk(104.8, 304, { radius: 0.35 }); await interact();
  assert.equal((await read()).mission.favor, 'earned'); report.checks.toolboxFavor = true; await note('05b-toolbox-returned');
  await route([[94, 304], [94, 278], [70, 270], [70, 214], [111.5, 216]]);
  await route([[143, 216], [143, 223]]); await interact();
  assert.equal((await read()).armor, 100, 'Armor purchase must be live before combat.');
  await route([[143, 212], [249, 212], [424, 212], [424, 88], [406, 88], [402, 88]]);
  await interact('RECOVERY');
  await until(s => !s.vaulting && s.position.x < 398, 'The service barrier must be physically vaulted', { seconds: 15, quantum: 0.1 });
  assert.equal((await read()).mission.route, 'service'); report.checks.serviceVault = true; await note('06-service-vault');
  for (let attempt = 0; ; attempt++) {
    try {
      if (attempt > 0) {
        await route([[396, 78.4], [391, 78.4]], { radius: 0.4, engage: false });
        await press('KeyQ');
        assert.equal((await read()).coverId, 'rear-cabinet', 'The retry tactic must enter authored rear cover through Q.');
        await walk(390.4, 78.45, { sprint: false, radius: 0.2, engage: false });
      }
      await fight();
      if ((await read()).inCover) { await press('KeyQ'); await walk(388, 78.4, { radius: 0.4 }); }
      // Advance behind the east cargo stack and take its north/west corner.
      // Long pistol duels leave Mara exposed and waste her ammunition.
      await walk(388, 111); await fight();
      await route([[388, 122], [377, 122], [378.1, 127]], { radius: 0.4 });
      if (!(await read()).inventory.weapons.smg.owned) await interact();
      assert.equal((await read()).inventory.weapons.smg.owned, true, 'The depot SMG must be collected by the actual interaction.');
      report.checks.smgPickup = true; await fight(); await note('07-service-fight-smg');
      await route([[377, 122], [365, 122], [365, 140], [348, 142]]); await fight();
      await route([[310, 142], [310, 112], [312, 104]]);
      await walk(319, 104.5, { radius: 0.4 });
      if (!(await read()).inventory.pickups.includes('depot-ammo')) await interact();
      assert.ok((await read()).inventory.pickups.includes('depot-ammo'), 'The depot ammunition must be collected through the live interaction.');
      await walk(333, 103); await fight(); await walk(333, 90.5); await fight();
      await walk(332, 88); await interact();
      assert.equal((await read()).mission.junReached, true, 'Jun must be reached by the remapped interaction.');
      await walk(324, 84); await interact('EXTRACTION'); await note('08-case-alarm');
      break;
    } catch (error) {
      const failed = await read();
      if (failed.screen !== 'retry' || !failed.mission.failure?.reason.startsWith('Mara is down') || attempt >= 4) throw error;
      report.tacticalRetries = (report.tacticalRetries || 0) + 1;
      await note(`06a-normal-retry-${attempt + 1}`);
      await releaseAll(); await menu('retryCheckpoint');
      await until(s => s.phase === 'RECOVERY', 'Normal retry must restore the service encounter');
      await lockMouse();
    }
  }
  await route([[333, 89], [333, 104], [312, 104], [310, 112], [310, 142], [348, 142], [360, 143], [362, 148]], { sprint: false });
  await boardVan();
  assert.ok(['EVASION', 'DECISION'].includes((await read()).phase));
  report.checks.vanPassengerExtraction = true; await note('09-van-passenger-extraction');
  await driveRoute([[356, 154], [348, 179], [348, 191], [338, 202], [252, 202], [240, 214]], { speed: 5 });
  // Long ordinary road legs pull away from foot officers before the garage.
  // Waiting at the service point while still visible cannot clear a pursuit.
  await driveRoute([[240, 320], [252, 332], [404, 332], [416, 344], [416, 368], [404, 380], [72, 380]], { speed: 8 });
  await until(s => s.wanted.tier === 0, 'The van must lose actual sight and leave the search region', { seconds: 60, quantum: 0.2 });
  report.checks.wantedClearedWithVan = true; await note('09b-wanted-cleared-waterfront');
  await driveRoute([[60, 368], [60, 282], [72, 270], [94, 282], [94, 301]], { speed: 6 });
  await exitVan();
  await walk(94, 305.5);
  await until(s => !s.wanted.visible, 'The garage respray requires actual loss of police sight', { seconds: 30, quantum: 0.1 });
  const beforeRepair = await read(); await interact(); const afterRepair = await read();
  assert.equal(afterRepair.mission.favor, 'consumed', `Garage interaction must consume the earned repair favor; ${afterRepair.toast}`);
  assert.ok(afterRepair.playerVisual.actorFlash <= 0, 'The combat hit flash must have expired before the garage aftermath.');
  assert.equal(afterRepair.wallet, beforeRepair.wallet, 'The earned repair must cost no money.');
  assert.equal(afterRepair.vehicles.find(v => v.id === 'yard-van').appearance, beforeRepair.vehicles.find(v => v.id === 'yard-van').appearance + 1);
  report.checks.freeRespray = true; await note('09a-free-garage-respray');
  await walk(91, 301); await boardVan();
  // The bay is a drive-through. Align slowly beside the original sedan, then
  // take the long eastbound road target instead of U-turning in the north lane.
  await driveRoute([[97.5, 310], [97.5, 320]], { speed: 1.5, radius: 0.6 });
  await drive(98, 330, { speed: 2.5, radius: 1 });
  report.checks.southGarageExit = true; await note('09c-south-drive-through');
  await driveRoute([[228, 332], [240, 344], [252, 344], [263, 350]], { speed: 5 });
  await exitVan(); await walk(270, 354, { sprint: false });
  await until(s => s.phase === 'DECISION', 'Wanted heat must clear normally before the handoff decision', { seconds: 90, quantum: 0.2 });
  await interact(); await menu(ending === 'broker' ? 'chooseBroker' : 'chooseReporter'); await lockMouse(); await note('10-choice');
  await boardVan();
  if (ending === 'broker') {
    // Back away from the pump-station wall before turning the loaded van.
    await drive(252, 340, { reverse: true, speed: 2.5 });
    await driveRoute([[240, 332], [240, 320], [240, 64], [228, 52], [120, 52], [108, 65], [108, 86]], { speed: 5 });
    await exitVan();
    await route([[100, 78], [110, 78]], { sprint: false, radius: 0.4 });
    await route([[100, 78], [94, 88]], { sprint: false, radius: 0.4 });
  } else {
    await driveRoute([[272, 380], [368, 380], [380, 368], [380, 356]], { speed: 5 });
    await exitVan(); await walk(383, 358, { sprint: false, radius: 0.4 });
  }
  await until(s => Math.hypot(s.position.x - s.jun.position.x, s.position.y - s.jun.position.y) < 7.5, 'Jun must physically accompany the handoff', { seconds: 30, quantum: 0.1 });
  await note('10a-jun-at-handoff');
  await interact('AFTERMATH'); await note('11-handoff');
  const completed = await read();
  assert.equal(completed.mission.ending, ending); assert.equal(completed.mission.completed, true);
  assert.equal(completed.wallet, ending === 'broker' ? 1220 : 620);
  assert.equal(completed.mission.rewardPaid, true); assert.equal(completed.jun.state, 'safe');
  assert.ok(completed.mission.messages.includes(`${ending}-ending`), 'The chosen ending must save its distinct closing message.');
  assert.equal(completed.district.contractorTakeover, ending === 'broker');
  assert.equal(completed.district.marketShuttered, ending === 'broker');
  assert.equal(completed.district.investigationNotice, ending === 'reporter');
  await menu('endingContinue'); await lockMouse();
  if (ending === 'broker') await route([[108, 61], [70, 61], [70, 214], [143, 216], [143, 223]]);
  else await route([[381, 358], [380, 380], [267, 372], [249, 342], [249, 212], [143, 212], [143, 223]]);
  const beforePurchase = await read();
  assert.ok(beforePurchase.armor < 100, 'The real encounter must have left room for a useful post-mission armor purchase.');
  await interact(); const purchased = await read();
  assert.equal(purchased.armor, 100); assert.equal(purchased.wallet, beforePurchase.wallet - 60);
  assert.equal(purchased.mission.completed, true); assert.equal(purchased.mission.ending, ending);
  report.checks.postMissionPurchase = true; await note('12-post-mission-purchase');
  await press('Escape'); await until(s => s.screen === 'pause', 'Escape must expose post-mission credits');
  await menu('openCredits'); await page.locator('.source-info').waitFor(); await note('13-credits');
  assert.deepEqual(report.errors, []);
  for (const check of ['remap', 'remappedPrompt', 'pointerLockExitReentry', 'focusLoss', 'pause', 'remappedInteraction', 'toolboxFavor', 'serviceVault', 'smgPickup', 'smgFired', 'smgHit', 'vanPassengerExtraction', 'wantedClearedWithVan', 'freeRespray', 'southGarageExit', 'postMissionPurchase']) {
    assert.equal(report.checks[check], true, `Required route check must pass: ${check}`);
  }
  report.ordinaryTimeCompletion = timing === 'realtime';
  report.status = 'passed';
} catch (error) {
  report.status = cancelled ? 'interrupted' : 'blocked'; report.blocker = error.message; report.lastState = await read().catch(() => null);
  if (cancelled) report.operatorInterrupted = true;
  if (nativeWindows) report.foregroundProcess = await native('focus', 0, 0).catch(() => null);
  await page.screenshot({ path: `${output}/blocker.png` }).catch(() => {});
  console.error(error.stack); process.exitCode = 1;
} finally {
  await releaseAll().catch(() => {});
  report.finishedAt = new Date().toISOString();
  report.wallSeconds = (Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000;
  if (page.video()) report.video = await page.video().path().catch(() => null);
  await Promise.allSettled(resourceHashJobs);
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(`Keyboard route ${report.status} (${timing}); evidence: ${output}`);
  await context.close(); await browser.close(); xServer?.kill(); windowsMouse?.kill();
}
