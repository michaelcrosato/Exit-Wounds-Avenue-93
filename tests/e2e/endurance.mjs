/**
 * Supplemental V08 lifecycle probe. The default executes >=1,800 seconds of
 * fixed-step gameplay, NOT 30 minutes of wall-clock play or rendered animation.
 * Keyboard/menu actions are ordinary browser input. Player/car/police placement and a
 * reported tier-3 incident are explicitly staged once per cycle for repeatability.
 * Instrumentation is installed before boot and retains only WeakRefs to targets,
 * callbacks and audio nodes so the probe does not itself keep those objects alive.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { chromium, firefox, webkit } from 'playwright';

const engine = process.env.EWA93_ENDURANCE_ENGINE || 'chromium';
const timing = process.env.EWA93_ENDURANCE_TIMING || 'accelerated';
const cdpEndpoint = process.env.EWA93_ENDURANCE_CDP || null;
const cycles = Number(process.env.EWA93_ENDURANCE_CYCLES || 30);
const cycleSeconds = Number(process.env.EWA93_ENDURANCE_CYCLE_SECONDS || 60);
const baseURL = process.env.EWA93_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.EWA93_ENDURANCE_OUTPUT || `/tmp/ewa93-endurance-${Date.now()}`;
const stopFile = process.env.EWA93_ENDURANCE_STOP_FILE || `${output}/STOP`;
assert.ok(['chromium', 'webkit', 'firefox'].includes(engine));
assert.ok(['accelerated', 'realtime'].includes(timing));
assert.ok(!cdpEndpoint || engine === 'chromium', 'CDP attach requires Chromium.');
assert.ok(Number.isInteger(cycles) && cycles >= 3 && cycles <= 240);
assert.ok(cycleSeconds >= 30 && cycleSeconds <= 300);
await mkdir(output, { recursive: true });
const fingerprintDirectories = ['src', 'assets', 'vendor/my-3d2dge/vendor/three-0.182.0', 'vendor/my-3d2dge/vendor/rapier3d-simd-compat-0.19.3'];
const fingerprintFiles = ['index.html', 'tests/e2e/endurance.mjs', 'vendor/my-3d2dge/engine/my-3d2dge.js',
  'vendor/my-3d2dge/engine/my-3d2dge-3d.js', 'vendor/my-3d2dge/src/mocap/readable.js', 'vendor/my-3d2dge/src/mocap/mocap.js'];
async function listFiles(relative) {
  const entries = await readdir(new URL(`../../${relative}/`, import.meta.url), { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? listFiles(`${relative}/${entry.name}`) : [`${relative}/${entry.name}`]))).flat();
}
async function fingerprintSources() {
  const paths = [...new Set([...fingerprintFiles, ...(await Promise.all(fingerprintDirectories.map(listFiles))).flat()])].sort();
  return Object.fromEntries(await Promise.all(paths.map(async path => [path,
    createHash('sha256').update(await readFile(new URL(`../../${path}`, import.meta.url))).digest('hex')])));
}
const initialSourceHashes = await fingerprintSources();
const browser = cdpEndpoint ? await chromium.connectOverCDP(cdpEndpoint) : await ({ chromium, webkit, firefox }[engine]).launch({
  headless: true,
  args: engine === 'chromium' ? ['--enable-unsafe-swiftshader'] : [],
});
const context = await browser.newContext({ viewport: { width: 960, height: 600 }, reducedMotion: 'reduce' });
await context.addInitScript(() => {
  const originalAdd = EventTarget.prototype.addEventListener;
  const originalRemove = EventTarget.prototype.removeEventListener;
  const listenerIndex = new WeakMap();
  let listeners = new Set(), audioNodes = new Set(), nextNode = 0;
  const audioContexts = new Set(), contextIndex = new WeakSet(), intervals = new Map();
  const originalInterval = window.setInterval, originalClearInterval = window.clearInterval;
  window.setInterval = function(callback, delay, ...args) {
    const id = originalInterval.call(this, callback, delay, ...args); intervals.set(id, { delay }); return id;
  };
  window.clearInterval = function(id) { intervals.delete(id); return originalClearInterval.call(this, id); };
  const createdAudio = {}, audioSources = new Map();
  const totals = { adds: 0, removes: 0, onceCompleted: 0, aborted: 0, audioStarted: 0, audioEnded: 0 };
  const captureOf = options => typeof options === 'boolean' ? options : !!options?.capture;
  const removeEntry = entry => listeners.delete(entry);
  EventTarget.prototype.addEventListener = function(type, callback, options) {
    if (!callback || options?.signal?.aborted) return originalAdd.call(this, type, callback, options);
    let types = listenerIndex.get(this);
    if (!types) listenerIndex.set(this, types = new Map());
    const key = `${type}:${captureOf(options)}`;
    let callbacks = types.get(key);
    if (!callbacks) types.set(key, callbacks = new WeakMap());
    const prior = callbacks.get(callback);
    if (prior && listeners.has(prior)) return;
    const entry = { target: new WeakRef(this), callback: new WeakRef(callback), type, capture: captureOf(options) };
    const wrapped = function(event) {
      if (options?.once) { removeEntry(entry); totals.onceCompleted++; }
      return typeof callback === 'function' ? callback.call(this, event) : callback.handleEvent(event);
    };
    entry.wrapped = new WeakRef(wrapped);
    callbacks.set(callback, entry); listeners.add(entry); totals.adds++;
    if (options?.signal) originalAdd.call(options.signal, 'abort', () => { removeEntry(entry); totals.aborted++; }, { once: true });
    return originalAdd.call(this, type, wrapped, options);
  };
  EventTarget.prototype.removeEventListener = function(type, callback, options) {
    const entry = callback && listenerIndex.get(this)?.get(`${type}:${captureOf(options)}`)?.get(callback);
    if (entry) { removeEntry(entry); totals.removes++; return originalRemove.call(this, type, entry.wrapped.deref(), options); }
    return originalRemove.call(this, type, callback, options);
  };
  if (typeof BaseAudioContext !== 'undefined') for (const method of [
    'createBufferSource', 'createOscillator', 'createGain', 'createBiquadFilter', 'createStereoPanner', 'createDynamicsCompressor',
  ]) {
    const original = BaseAudioContext.prototype[method];
    if (!original) continue;
    BaseAudioContext.prototype[method] = function(...args) {
      if (!contextIndex.has(this)) { contextIndex.add(this); audioContexts.add(new WeakRef(this)); }
      const node = original.apply(this, args), entry = { id: ++nextNode, type: method, ref: new WeakRef(node) };
      createdAudio[method] = (createdAudio[method] || 0) + 1; audioNodes.add(entry);
      if (method === 'createBufferSource' || method === 'createOscillator') {
        const start = node.start;
        node.start = function(...startArgs) {
          const result = start.apply(this, startArgs); audioSources.set(entry.id, entry); totals.audioStarted++; return result;
        };
        originalAdd.call(node, 'ended', () => { audioSources.delete(entry.id); totals.audioEnded++; }, { once: true });
      }
      return node;
    };
  }
  window.__endurance = {
    snapshot() {
      listeners = new Set([...listeners].filter(entry => entry.target.deref() && entry.callback.deref()));
      audioNodes = new Set([...audioNodes].filter(entry => entry.ref.deref()));
      for (const [id, entry] of audioSources) if (!entry.ref.deref()) audioSources.delete(id);
      const byType = {}, byTarget = {}, audioLiveByType = {};
      let detachedDOMTargets = 0;
      const detached = new Set();
      for (const entry of listeners) {
        const target = entry.target.deref();
        byType[entry.type] = (byType[entry.type] || 0) + 1;
        const label = target === window ? 'window' : target === document ? 'document' : target?.constructor?.name || 'unknown';
        byTarget[label] = (byTarget[label] || 0) + 1;
        if (target instanceof Node && target !== document && !target.isConnected) detached.add(target);
      }
      detachedDOMTargets = detached.size;
      for (const entry of audioNodes) audioLiveByType[entry.type] = (audioLiveByType[entry.type] || 0) + 1;
      const contexts = [...audioContexts].map(ref => ref.deref()).filter(Boolean);
      return { timers: { activeIntervals: intervals.size }, listeners: { active: listeners.size, detachedDOMTargets, byType, byTarget },
        audio: { contexts: contexts.length, contextStates: contexts.map(context => context.state), liveNodes: audioNodes.size, liveByType: audioLiveByType, activeSources: audioSources.size, created: { ...createdAudio } }, totals: { ...totals } };
    },
  };
});
const page = await context.newPage();
page.setDefaultTimeout(90000);
const cdp = engine === 'chromium' ? await context.newCDPSession(page) : null;
const report = {
  testVersion: 4, engine, browserVersion: browser.version(), timing, baseURL, output,
  stopFile,
  browserConnection: cdpEndpoint ? 'Isolated context on dedicated existing Chromium CDP; disconnect after test' : 'Fresh browser launched by Playwright',
  memoryMethod: cdp ? 'CDP HeapProfiler.collectGarbage plus Runtime.getHeapUsage and Memory.getDOMCounters' : 'Weak resource counters; forced-GC heap trend unavailable',
  host: { platform: platform(), release: release(), cpu: cpus()[0]?.model, logicalCPUs: cpus().length },
  configuredCycles: cycles, configuredCycleSeconds: cycleSeconds, targetSimulationSeconds: 1800,
  input: 'Playwright keyboard events for entry, drive, brake, horn, exit and pause; public restart/confirmation UI',
  staging: ['Move the selected existing car and Mara to the central intersection before each pursuit.',
    'Restore the chosen car to healthy/unlocked/stationary for this lifecycle scenario.',
    'Place the existing patrol cars/officers about 24 metres around the occupied car before each report, to exercise nearby perception and response.',
    'Submit a diagnostic tier-3 police report identifying the occupied car; normal police, traffic, physics and clearance remain live.',
    ...(timing === 'accelerated' ? ['Stop requestAnimationFrame updates and call the engine fixed-step clock between browser inputs; render selected evidence frames.'] : [])],
  limitations: ['This diagnostic route is not an ordinary-input mission or fresh-player playthrough.',
    'AudioContext, setInterval and Web Audio scheduling use actual wall time, even when gameplay uses accelerated fixed steps.',
    'Heap sampling uses forced GC in Chromium and instrumentation changes allocation/timing; it cannot establish an uninstrumented memory budget.',
    'A 30-minute-equivalent accelerated pass does not satisfy actual 30-minute wall-clock V08 play.',
    'Local before/after fingerprints do not detect edit-and-revert or prove a remote source URL serves this workspace.'],
  startedAt: new Date().toISOString(), status: 'running', advancedSimulationSeconds: 0,
  completedCycles: 0, retries: 0, vehicleEntries: 0, vehicleSwitches: 0, pursuitSeconds: 0, errors: [], networkErrors: [], samples: [], cycleRecords: [],
};
if (cdpEndpoint) {
  const browserSession = await browser.newBrowserCDPSession(), info = await browserSession.send('SystemInfo.getInfo');
  report.gpuInfo = { devices: info.gpu.devices.map(device => ({ name: device.deviceString, driverVersion: device.driverVersion })),
    glRenderer: info.gpu.auxAttributes?.glRenderer, glVendor: info.gpu.auxAttributes?.glVendor, featureStatus: info.gpu.featureStatus };
  await browserSession.detach();
}
report.sourceHashes = initialSourceHashes;
report.sourceFingerprintScope = { directories: fingerprintDirectories, files: fingerprintFiles,
  method: 'Local file hashes before navigation and after capture; caller freezes source and serves this workspace.' };
page.on('crash', () => report.errors.push({ kind: 'crash', message: 'Browser page crashed.' }));
page.on('pageerror', error => report.errors.push({ kind: 'pageerror', message: error.message }));
page.on('console', message => { if (message.type() === 'error') report.errors.push({ kind: 'console', message: message.text() }); });
page.on('requestfailed', request => report.networkErrors.push({ url: request.url(), error: request.failure()?.errorText }));
page.on('response', response => { if (response.status() >= 400) report.networkErrors.push({ url: response.url(), status: response.status() }); });
const wallStarted = Date.now();
let cycleStartSimulation = 0, cancelled = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { cancelled = true; });
const held = new Set();

async function checkStop() {
  if (!cancelled) {
    try { await access(stopFile); cancelled = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (cancelled) throw new Error('Endurance probe interrupted by stop request.');
}
async function flushReport() { await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); }
async function state() {
  return page.evaluate(() => {
    const a = window.__exitWounds.app;
    return { tick: a.state.tick, elapsed: a.state.elapsed, screen: a.ui.screen,
      failure: a.state.mission.failure, error: a.error?.message, phase: a.state.mission.phase,
      vehicleId: a.state.player.vehicleId, position: { ...a.player.position },
      vehicleSpeed: (a.runtime.vehicles.get(a.state.player.vehicleId)?.speed || 0) / 16, wantedTier: a.state.wanted.tier, wantedStatus: a.state.wanted.status,
      transition: a.runtime.vehicles.transitions.has(a.player.actor),
      nativeLoopRunning: a.runtime.game._running, enginePaused: a.runtime.game.paused, timeScale: a.runtime.game.timeScale,
      renderedFrames: a.runtime.world.stats.frames, hidden: document.hidden, focused: document.hasFocus(),
      chasingOfficers: a.police.officers.filter(officer => officer.mode === 'chase').length, toast: document.querySelector('#hud-toast')?.textContent, prompt: document.querySelector('#hud-prompt')?.textContent };
  });
}
async function advance(seconds) {
  let lastProgressAt = Date.now();
  for (let remaining = seconds; remaining > 1e-6;) {
    await checkStop();
    const chunk = Math.min(remaining, 2), before = await state();
    if (timing === 'realtime') {
      assert.equal(before.nativeLoopRunning, true, 'Normal-rate probe requires the native frame loop to keep running.');
      assert.equal(before.enginePaused, false, 'The engine clock must run during active normal-rate gameplay.');
      assert.equal(before.timeScale, 1, 'Normal-rate probe must not change the engine time scale.');
    }
    if (before.failure || before.error || before.screen === 'retry' || before.screen === 'error') throw new Error(`Unexpected runtime/failure before step: ${JSON.stringify(before)}`);
    if (timing === 'accelerated') await page.evaluate(s => window.__exitWounds.runtime.game.advance(s), chunk);
    else await page.waitForTimeout(chunk * 1000);
    const after = await state(), simulated = Math.max(0, (after.tick - before.tick) / 120);
    assert.ok(Math.abs((after.elapsed - before.elapsed) - simulated) < .001, 'Gameplay elapsed time diverged from the fixed-step tick accounting.');
    if (simulated > 0) lastProgressAt = Date.now();
    else if (Date.now() - lastProgressAt > 10000) throw new Error(`Gameplay clock made no progress for 10 wall seconds: ${JSON.stringify(after)}`);
    report.advancedSimulationSeconds += simulated;
    if (before.wantedTier) report.pursuitSeconds += simulated;
    if (after.failure || after.error || after.screen !== 'playing') throw new Error(`Unexpected runtime/failure after step: ${JSON.stringify(after)}`);
    remaining -= timing === 'accelerated' ? chunk : simulated;
  }
}
async function keyDown(code) { await page.keyboard.down(code); held.add(code); }
async function keyUp(code) { await page.keyboard.up(code); held.delete(code); }
async function tap(code) { await keyDown(code); await advance(.025); await keyUp(code); await advance(.025); }
async function retry() {
  for (const code of [...held]) await keyUp(code);
  await keyDown('Escape');
  if (timing === 'accelerated') await page.evaluate(() => window.__exitWounds.runtime.game.advance(.025));
  await keyUp('Escape');
  await page.locator('.screen--pause [data-action="restartCheckpoint"]').click();
  await page.locator('.screen--confirm [data-action="confirmYes"]').click();
  await page.locator('.hud').waitFor();
  report.retries++;
  const s = await state(); assert.equal(s.screen, 'playing'); assert.equal(s.vehicleId, null); assert.equal(s.wantedTier, 0);
}
async function snapshot(label, { capture = false } = {}) {
  await checkStop();
  if (capture && timing === 'accelerated') await page.evaluate(() => window.__exitWounds.runtime.game.advance(0, { draw: true }));
  // Let finite audio sources drain in real AudioContext time before comparing.
  await page.waitForTimeout(1100);
  await checkStop();
  let heap = null;
  if (cdp) {
    await cdp.send('HeapProfiler.collectGarbage');
    heap = await cdp.send('Runtime.getHeapUsage');
  }
  const sample = await page.evaluate(({ label, simulationSeconds }) => {
    const a = window.__exitWounds.app, r = a.runtime, w = r.world, pw = w.pw;
    const instrumentation = window.__endurance.snapshot();
    const bodyHandles = new Set(); let colliders = 0, enabledBodies = 0;
    pw.forEachRigidBody(body => { bodyHandles.add(body.handle); if (body.isEnabled()) enabledBodies++; }); pw.forEachCollider(() => colliders++);
    const orphanedQueries = [...r.queries.entities.keys()].filter(handle => !bodyHandles.has(handle));
    const actors = w.actors, seatedActors = [...r.vehicles.seated.keys()];
    const invalidSeats = seatedActors.filter(actor => {
      const { vehicle, seat } = r.vehicles.seated.get(actor);
      return vehicle.seats[seat] !== actor || actor.body !== null || !actor._seatBody || actor._seatBody.isEnabled();
    }).map(actor => actor.id);
    const unattachedActors = actors.filter(actor => !actor.body && !r.vehicles.seated.has(actor)).map(actor => actor.id || '(anonymous)');
    let sceneNodes = 0; const cpuGeometries = new Set(), cpuMaterials = new Set();
    w.scene.traverse(node => {
      sceneNodes++; if (node.geometry) cpuGeometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) cpuMaterials.add(material);
    });
    const renderer = r.E.World3D.renderer;
    const memory = renderer?.info?.memory, savedCheckpoint = a.saveStore.load();
    return { label, at: new Date().toISOString(), simulationSeconds, tick: a.state.tick, elapsed: a.state.elapsed,
      screen: a.ui.screen, phase: a.state.mission.phase, health: a.state.player.health,
      physics: { bodies: bodyHandles.size, enabledBodies, colliders },
      entities: { actors: actors.length, vehicles: r.vehicles.list.length, props: w.props.length, things: w.things.length,
        shapes: w.shapes.length, sceneNodes, cpuGeometries: cpuGeometries.size, cpuMaterials: cpuMaterials.size, animationBindings: a.animations.entries.size, queryEntities: r.queries.entities.size, seated: seatedActors.length,
        transitions: r.vehicles.transitions.size, maraSeated: !!r.vehicles.occupant(a.player.actor), maraBodyEnabled: !!a.player.actor.body?.isEnabled(), orphanedQueries, invalidSeats, unattachedActors,
        downedCrew: a.crew.enemies.filter(actor => actor.health <= 0).length,
        downedOfficers: a.police.officers.filter(actor => actor.health <= 0).length },
      renderer: { backend: r.metadata.backend, calls: w.stats.calls, triangles: w.stats.tris,
        geometries: memory?.geometries ?? null, textures: memory?.textures ?? null },
      engine: { nativeLoopRunning: r.game._running, paused: r.game.paused, timeScale: r.game.timeScale, renderedFrames: w.stats.frames, hidden: document.hidden, focused: document.hasFocus(), resizeListeners: r.game.screen.listeners.length, timers: r.game._timers.length, particles: r.game.particles.list.length, errors: r.game.errors.length },
      histories: { incidents: a.state.crime.incidents.length, reports: a.state.crime.reports.length,
        receivedReports: a.state.wanted.reportsReceived.length, handledEvents: a.state.mission.processedEvents.length },
      save: { valid: savedCheckpoint.ok, reason: savedCheckpoint.reason || null, primaryBytes: new Blob([localStorage.getItem(a.saveStore.key) || '']).size,
        backupBytes: new Blob([localStorage.getItem(a.saveStore.backupKey) || '']).size,
        logicalBytes: new Blob([JSON.stringify(a.state)]).size },
      audioContext: { state: a.audio.ctx?.state || 'absent', currentTime: a.audio.ctx?.currentTime ?? null,
        radioTimer: !!a.audio.radioTimer, rainTimer: !!a.audio.rainTimer }, ...instrumentation };
  }, { label, simulationSeconds: report.advancedSimulationSeconds });
  sample.heap = heap; sample.domCounters = cdp ? await cdp.send('Memory.getDOMCounters') : null; sample.wallSeconds = (Date.now() - wallStarted) / 1000;
  report.samples.push(sample);
  if (capture) {
    await page.screenshot({ path: `${output}/${label}.png`, timeout: 90000 });
  }
  assert.equal(sample.screen, 'playing');
  assert.deepEqual(sample.entities.orphanedQueries, [], 'Query registry retains freed bodies.');
  assert.deepEqual(sample.entities.invalidSeats, [], 'A seated actor has invalid ownership/collision state.');
  assert.deepEqual(sample.entities.unattachedActors, [], 'Actors lost both their body and seat.');
  if (timing === 'realtime') {
    assert.equal(sample.engine.nativeLoopRunning, true); assert.equal(sample.engine.paused, false); assert.equal(sample.engine.timeScale, 1);
  }
  if (!sample.entities.maraSeated) assert.equal(sample.entities.maraBodyEnabled, true, 'Mara’s on-foot body stayed disabled after exit/retry.');
  assert.ok(sample.histories.incidents <= 256 && sample.histories.reports <= 384 && sample.histories.receivedReports <= 384);
  assert.ok(sample.save.valid && sample.save.primaryBytes > 0, 'The stored checkpoint must remain readable and nonempty.');
  assert.equal(sample.audioContext.state, 'running', 'Audio must be unlocked and live for this probe.');
  await flushReport();
  console.log(JSON.stringify({ label, simulation: Math.round(sample.simulationSeconds), wall: Math.round(sample.wallSeconds),
    bodies: sample.physics.bodies, actors: sample.entities.actors, listeners: sample.listeners.active,
    audioNodes: sample.audio.liveNodes, activeSources: sample.audio.activeSources, heap: sample.heap?.usedSize }));
  return sample;
}
function evaluateBounds() {
  const stable = report.samples.filter(sample => sample.label.startsWith('cycle-') && Number(sample.label.slice(6)) >= 3);
  assert.ok(stable.length, 'At least three completed cycles are needed for a stabilization comparison.');
  const first = stable[0], last = stable.at(-1);
  for (const sample of stable) {
    assert.equal(sample.physics.bodies, first.physics.bodies, 'Physics body count grew after repeated retry.');
    assert.equal(sample.physics.enabledBodies, first.physics.enabledBodies, 'Enabled-body count changed after repeated retry.');
    assert.equal(sample.physics.colliders, first.physics.colliders, 'Collider count grew after repeated retry.');
    for (const key of ['actors', 'vehicles', 'props', 'things', 'shapes', 'sceneNodes', 'cpuGeometries', 'animationBindings', 'queryEntities', 'seated', 'transitions'])
      assert.equal(sample.entities[key], first.entities[key], `Entity count ${key} changed after retry.`);
    assert.ok(Math.abs(sample.entities.cpuMaterials - first.entities.cpuMaterials) <= 2, 'Scene materials grew beyond cached traffic-signal substitutions.');
    if (sample.domCounters && first.domCounters) {
      assert.equal(sample.domCounters.documents, first.domCounters.documents, 'Browser documents accumulated.');
      assert.ok(sample.domCounters.nodes <= first.domCounters.nodes + 32, 'Native DOM node count grew after GC.');
      assert.ok(sample.domCounters.jsEventListeners <= first.domCounters.jsEventListeners + 12, 'Native browser listener count grew after GC.');
    }
    assert.equal(sample.engine.resizeListeners, first.engine.resizeListeners, 'Engine resize listeners accumulated.');
    assert.equal(sample.engine.timers, first.engine.timers, 'Engine timers accumulated.');
    assert.equal(sample.engine.errors, 0, 'Engine recorded an error.');
    assert.ok(sample.listeners.active <= first.listeners.active + 2, 'Active listeners grew after warmup.');
    assert.ok(sample.listeners.detachedDOMTargets <= first.listeners.detachedDOMTargets, 'Detached DOM targets retained active listeners.');
    assert.equal(sample.timers.activeIntervals, first.timers.activeIntervals, 'Intervals accumulated after retry.');
    assert.equal(sample.audio.contexts, first.audio.contexts, 'Audio contexts accumulated after retry.');
    assert.ok(sample.audio.activeSources <= first.audio.activeSources + 6, 'Audio sources accumulated after their scheduled end.');
    if (cdp) assert.ok(sample.audio.liveNodes <= first.audio.liveNodes + 24, 'Live AudioNodes accumulated after source drain and forced GC.');
    assert.ok(sample.save.primaryBytes <= first.save.primaryBytes + 4096, 'Checkpoint save grew beyond a small timing allowance.');
    assert.ok(sample.save.backupBytes <= first.save.backupBytes + 4096, 'Previous-good backup grew beyond a small timing allowance.');
    assert.ok(sample.save.logicalBytes <= first.save.logicalBytes + 8192, 'Logical state grew beyond a bounded post-retry allowance.');

  }
  report.rendererCacheTrend = {};
  for (const key of ['geometries', 'textures']) if (first.renderer[key] != null) {
    const values = stable.map(sample => sample.renderer[key]), tail = values.slice(-Math.max(1, Math.ceil(values.length / 3)));
    report.rendererCacheTrend[key] = { warm: first.renderer[key], min: Math.min(...values), max: Math.max(...values),
      finalThirdMin: Math.min(...tail), finalThirdMax: Math.max(...tail), growthAllowance: 32, finalThirdRangeAllowance: 2 };
    assert.ok(Math.max(...values) <= first.renderer[key] + 32, `Renderer ${key} grew beyond bounded lazy realization.`);
    assert.ok(Math.max(...tail) - Math.min(...tail) <= 2, `Renderer ${key} did not stabilize in the final third.`);
  }
  const heapSamples = stable.filter(sample => sample.heap);
  if (heapSamples.length >= 6) {
    // Compare early/late thirds after GC, plus a fitted slope. This is a leak
    // alarm with a generous 8 MiB noise budget, not proof of a flat native heap.
    const third = Math.max(2, Math.floor(heapSamples.length / 3));
    const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const early = median(heapSamples.slice(0, third).map(sample => sample.heap.usedSize));
    const late = median(heapSamples.slice(-third).map(sample => sample.heap.usedSize));
    const xs = heapSamples.map(sample => sample.simulationSeconds / 60), ys = heapSamples.map(sample => sample.heap.usedSize);
    const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
    const slope = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0) / xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
    report.heapTrend = { postGC: true, earlyMedianBytes: early, lateMedianBytes: late, deltaBytes: late - early,
      slopeBytesPerSimulationMinute: slope, samples: heapSamples.length, allowanceBytes: 8 * 1024 * 1024,
      sustainedSlopeAlarmBytesPerSimulationMinute: 128 * 1024, sustainedDeltaAllowanceBytes: 2 * 1024 * 1024 };
    const wallXs = heapSamples.map(sample => sample.wallSeconds / 60), wallMx = wallXs.reduce((sum, x) => sum + x, 0) / wallXs.length;
    report.heapTrend.slopeBytesPerWallMinute = wallXs.reduce((sum, x, i) => sum + (x - wallMx) * (ys[i] - my), 0) / wallXs.reduce((sum, x) => sum + (x - wallMx) ** 2, 0);
    assert.ok(!(slope > 128 * 1024 && late - early > 2 * 1024 * 1024), `Sustained post-GC heap growth: ${Math.round(slope)} bytes per simulated minute, ${late - early} bytes median growth.`);
    assert.ok(late - early <= 8 * 1024 * 1024, `Post-GC heap grew ${late - early} bytes after warmup.`);
    const backingEarly = median(heapSamples.slice(0, third).map(sample => sample.heap.backingStorageSize || 0));
    const backingLate = median(heapSamples.slice(-third).map(sample => sample.heap.backingStorageSize || 0));
    report.heapTrend.backingStorage = { earlyMedianBytes: backingEarly, lateMedianBytes: backingLate, deltaBytes: backingLate - backingEarly, allowanceBytes: 8 * 1024 * 1024 };
    assert.ok(backingLate - backingEarly <= 8 * 1024 * 1024, `Browser-reported external backing storage grew ${backingLate - backingEarly} bytes after warmup.`);
  } else report.heapTrend = { postGC: !!cdp, unavailable: 'Six post-warmup Chromium samples required for a heap-trend assertion.' };
  report.stability = { warmupCycle: 3, comparedSamples: stable.length, first: first.label, last: last.label };
}

try {
  const bootStart = Date.now();
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-action="newGame"]').waitFor();
  report.titleReadyMs = Date.now() - bootStart;
  assert.equal(await page.evaluate(() => !!window.__exitWounds), true, 'Serve source: packaged builds deliberately remove the diagnostic hook.');
  await page.locator('[data-action="openSettings"]').click(); await page.locator('#s-quality').selectOption('low');
  await page.locator('[data-action="settingsBack"]').click(); await page.locator('[data-action="newGame"]').click();
  await page.locator('.hud').waitFor();
  if (timing === 'accelerated') await page.evaluate(() => { window.__enduranceAccelerated = true; window.__exitWounds.runtime.game.stop(); });
  await advance(1);
  // Establish the intended safe retry baseline through the public phone UI.
  // Leaving the opening ring unresolved can itself request a checkpoint.
  if (await page.evaluate(() => window.__exitWounds.app.eliCall?.status === 'ringing')) {
    await keyDown('KeyT');
    if (timing === 'accelerated') await page.evaluate(() => window.__exitWounds.runtime.game.advance(.025));
    await page.locator('[data-action="declineEliCall"]').waitFor(); await keyUp('KeyT');
    await page.locator('[data-action="declineEliCall"]').click(); await page.locator('.hud').waitFor();
    assert.equal(await page.evaluate(() => window.__exitWounds.app.eliCall.status), 'declined');
    report.openingCallChoice = 'Declined via normal KeyT phone and Decline call UI before staging.';
  }
  report.environment = await page.evaluate(() => {
    const a = window.__exitWounds.app, canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2'), ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return { userAgent: navigator.userAgent, width: innerWidth, height: innerHeight, devicePixelRatio,
      quality: a.settings.quality, resolution: a.runtime.world.res, backend: a.runtime.metadata.backend,
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'not exposed',
      diagnosticHook: true, renderingEveryStep: !window.__enduranceAccelerated };
  });
  await snapshot('boot', { capture: true });
  const vehicleIds = ['mara-sedan', 'yard-van', 'patrol-3'];
  for (let index = 0; index < cycles; index++) {
    await checkStop();
    cycleStartSimulation = report.advancedSimulationSeconds;
    const vehicleId = vehicleIds[index % vehicleIds.length];
    const cycle = { cycle: index + 1, vehicleId, staged: true };
    report.cycleRecords.push(cycle);
    await page.evaluate(id => {
      const a = window.__exitWounds.app, v = a.runtime.vehicles.get(id);
      if (a.runtime.vehicles.seated.has(a.player.actor)) throw new Error('Previous retry did not clear Mara’s seat.');
      v.body.setTranslation({ x: 240 * 16, y: 202 * 16, z: .8 * 16 }, true);
      v.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      v.body.setLinvel({ x: 0, y: 0, z: 0 }, true); v.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      v.health = 100; v.disabled = false; v.locked = false;
      a.runtime.vehicles.postStep(0); a.player.place({ x: 240, y: 200.4, z: .05 });
      a.runtime.camera.reset(a.player.actor, 0); a.syncState(); a.updateHUD();
    }, vehicleId);
    await tap('KeyE'); await advance(1.2);
    assert.equal((await state()).vehicleId, vehicleId, `Normal E input did not enter ${vehicleId}.`);
    report.vehicleEntries++;
    if (index > 0) report.vehicleSwitches++;
    cycle.beforeDrive = await state();
    await keyDown('KeyW'); await advance(1); await keyUp('KeyW');
    cycle.afterDrive = await state();
    cycle.drivenMetres = Math.hypot(cycle.afterDrive.position.x - cycle.beforeDrive.position.x, cycle.afterDrive.position.y - cycle.beforeDrive.position.y);
    assert.ok(cycle.drivenMetres > .15, `Throttle input did not move ${vehicleId}.`);
    await keyDown('KeyS'); await advance(2.5); await keyUp('KeyS');
    // S is brake/reverse, so finish with handbrake to stop without reversing.
    await keyDown('Space'); await advance(1);
    await tap('KeyH');
    await page.evaluate(index => {
      const a = window.__exitWounds.app, p = a.player.position;
      const offsets = [[-24, 0], [0, 24], [24, 0]];
      for (let pair = 0; pair < 3; pair++) {
        const car = a.runtime.vehicles.get(`patrol-${pair + 1}`), [dx, dy] = offsets[pair];
        const x = p.x + dx, y = p.y + dy, yaw = Math.atan2(-dy, -dx);
        if (car.id !== a.state.player.vehicleId) {
          car.body.setTranslation({ x: x * 16, y: y * 16, z: .8 * 16 }, true);
          car.body.setRotation({ x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) }, true);
          car.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
        for (let seat = 0; seat < 2; seat++) a.police.officers[pair * 2 + seat].actor.place((x + (seat ? -1 : 1)) * 16, (y + 2.5) * 16, .05 * 16);
      }
      a.runtime.vehicles.postStep(0);
      a.wanted.receiveReport({ id: `${a.state.runId}:endurance:${index}`, crimeId: `endurance-${index}`,
        severity: 3, kind: 'alarm', position: { ...a.player.position }, observedPersonId: null,
        observedVehicleId: a.state.player.vehicleId, tick: a.state.tick });
    }, index);
    await advance(1); cycle.pursuitStart = await state();
    assert.ok(cycle.pursuitStart.chasingOfficers > 0, 'The staged report did not produce any actual nearby police pursuit.');
    await advance(19);
    cycle.pursuit = await state(); assert.equal(cycle.pursuit.wantedTier, 3);
    // Capture an active pursuit separately from the comparable post-retry samples.
    if (index < 3 || (index + 1) % 10 === 0) await snapshot(`pursuit-${index + 1}`, { capture: true });
    // A pursuing car can shove a handbraked cruiser above the 2 m/s exit
    // threshold. Use the service brake and wait for a valid physical exit.
    await keyDown('KeyS'); cycle.exitAttempts = [];
    for (let attempt = 0; attempt < 40; attempt++) {
      await advance(.2); const beforeExit = await state();
      if (Math.abs(beforeExit.vehicleSpeed) > 1.7) continue;
      await tap('KeyE'); await advance(.95);
      const afterExit = await state(); cycle.exitAttempts.push({ before: beforeExit, after: afterExit });
      if (!afterExit.vehicleId) break;
    }
    await keyUp('KeyS'); await keyUp('Space');
    cycle.afterExit = await state(); assert.equal(cycle.afterExit.vehicleId, null, 'Normal brake/slow E exit must restore Mara’s body.');
    await retry();
    // Ordinary free-roam time after restart fills the remainder of each minute.
    const remaining = Math.max(0, cycleSeconds - (report.advancedSimulationSeconds - cycleStartSimulation));
    await advance(remaining);
    report.completedCycles++;
    await snapshot(`cycle-${index + 1}`, { capture: (index + 1) % 10 === 0 || index + 1 === cycles });
  }
  await checkStop();
  evaluateBounds();
  assert.deepEqual(report.errors, [], 'Browser/runtime errors occurred.');
  assert.deepEqual(report.networkErrors, [], 'Failed runtime requests occurred.');
  report.completedThirtyMinuteSimulation = report.advancedSimulationSeconds >= 1800;
  report.completedThirtyMinuteWallClockPlay = timing === 'realtime' && (Date.now() - wallStarted) >= 1800000 && report.advancedSimulationSeconds >= 1800;
  report.status = 'passed';
} catch (error) {
  report.status = cancelled ? 'interrupted' : 'failed'; report.failure = error.stack || error.message;
  report.lastState = await state().catch(() => null);
  await page.screenshot({ path: `${output}/${cancelled ? 'interrupted' : 'failure'}.png`, timeout: 90000 }).catch(() => {});
  console.error(error.stack); process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString(); report.wallSeconds = (Date.now() - wallStarted) / 1000;
  report.completedThirtyMinuteSimulation = report.advancedSimulationSeconds >= 1800;
  report.completedThirtyMinuteWallClockPlay = timing === 'realtime' && report.wallSeconds >= 1800 && report.completedThirtyMinuteSimulation;
  report.normalRateEvidence = timing === 'realtime' ? { requiredNativeFrameLoop: true, requiredTimeScale: 1,
    allSamplesNativeLoopRunning: report.samples.length > 0 && report.samples.every(sample => sample.engine.nativeLoopRunning),
    allSamplesTimeScaleOne: report.samples.length > 0 && report.samples.every(sample => sample.engine.timeScale === 1),
    firstRenderedFrameCount: report.samples[0]?.engine.renderedFrames ?? null, lastRenderedFrameCount: report.samples.at(-1)?.engine.renderedFrames ?? null,
    accountedGameplayToWallRatio: report.advancedSimulationSeconds / report.wallSeconds,
    accountedGameplayExcludesSnapshotAndMenuGaps: true } : null;
  const comparison = report.samples.filter(sample => sample.label.startsWith('cycle-') && Number(sample.label.slice(6)) >= 3);
  const range = values => { const numbers = values.filter(Number.isFinite); return numbers.length ? { min: Math.min(...numbers), max: Math.max(...numbers) } : null; };
  report.resourceRanges = Object.fromEntries([
    ['bodies', sample => sample.physics.bodies], ['enabledBodies', sample => sample.physics.enabledBodies], ['colliders', sample => sample.physics.colliders],
    ['actors', sample => sample.entities.actors], ['vehicles', sample => sample.entities.vehicles],
    ['listeners', sample => sample.listeners.active], ['detachedDOMTargets', sample => sample.listeners.detachedDOMTargets],
    ['audioNodes', sample => sample.audio.liveNodes], ['audioSources', sample => sample.audio.activeSources],
    ['audioContexts', sample => sample.audio.contexts], ['intervals', sample => sample.timers.activeIntervals],
    ['primarySaveBytes', sample => sample.save.primaryBytes], ['backupSaveBytes', sample => sample.save.backupBytes],
    ['logicalStateBytes', sample => sample.save.logicalBytes], ['sceneNodes', sample => sample.entities.sceneNodes],
    ['cpuGeometries', sample => sample.entities.cpuGeometries], ['cpuMaterials', sample => sample.entities.cpuMaterials],
    ['rendererGeometries', sample => sample.renderer.geometries], ['rendererTextures', sample => sample.renderer.textures],
    ['nativeDOMNodes', sample => sample.domCounters?.nodes ?? null], ['nativeListeners', sample => sample.domCounters?.jsEventListeners ?? null],
  ].map(([key, pick]) => [key, range(comparison.map(pick))]));
  try {
    const finalHashes = await fingerprintSources();
    report.sourceFingerprintDifferences = [...new Set([...Object.keys(report.sourceHashes), ...Object.keys(finalHashes)])]
      .filter(path => report.sourceHashes[path] !== finalHashes[path]).sort();
    report.sourceFingerprintEndpointsEqual = report.sourceFingerprintDifferences.length === 0;
  } catch (error) {
    report.sourceFingerprintEndpointsEqual = false; report.sourceFingerprintError = error.message;
  }
  if (!report.sourceFingerprintEndpointsEqual && report.status === 'passed') {
    report.status = 'invalidated-by-source-drift';
    report.failure = 'Game source or runtime assets changed during the capture; rerun on frozen source.';
    process.exitCode = 1;
  }
  await flushReport();
  console.log(`Endurance ${report.status}; ${report.advancedSimulationSeconds.toFixed(2)} simulated seconds in ${report.wallSeconds.toFixed(2)} wall seconds; evidence: ${output}`);
  report.cleanupErrors = [];
  try { await context.close(); } catch (error) { report.cleanupErrors.push({ action: 'close-owned-context', message: error.message }); }
  try { await browser.close(); } catch (error) { report.cleanupErrors.push({ action: 'disconnect-or-close-browser', message: error.message }); }
  if (report.cleanupErrors.length) await flushReport();
}
