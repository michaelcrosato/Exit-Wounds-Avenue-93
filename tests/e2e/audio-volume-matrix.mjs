/** Objective S13 settings coverage. All setting changes use ordinary menu keys.
 * Web Audio observers preserve native calls; an analyser tee measures the real
 * master output. No application setters, gain setters, state fixtures or clock
 * shortcuts are used. This does not assess intelligibility or physical listening.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const levels = [0, 0.5, 1];
const controls = ['masterVolume', 'musicVolume', 'dialogueVolume'];
function reflectedMatrix(dimensions) {
  if (!dimensions) return [[]];
  const tail = reflectedMatrix(dimensions - 1);
  return levels.flatMap((value, index) => (index % 2 ? [...tail].reverse() : tail).map(rest => [value, ...rest]));
}
const matrix = reflectedMatrix(3).map(values => Object.fromEntries(controls.map((control, index) => [control, values[index]])));
const persistenceCases = [
  { masterVolume: 0, musicVolume: 0.5, dialogueVolume: 1 },
  { masterVolume: 0.5, musicVolume: 1, dialogueVolume: 0 },
  { masterVolume: 1, musicVolume: 0, dialogueVolume: 0.5 },
];
const subtitleCases = [
  { scale: 0.8, mix: { masterVolume: 0, musicVolume: 1, dialogueVolume: 1 } },
  { scale: 1, mix: { masterVolume: 1, musicVolume: 0, dialogueVolume: 1 } },
  { scale: 1.4, mix: { masterVolume: 1, musicVolume: 1, dialogueVolume: 0 } },
];
assert.equal(matrix.length, 27);
assert.equal(new Set(matrix.map(row => JSON.stringify(row))).size, 27);
for (let i = 1; i < matrix.length; i++) assert.equal(controls.filter(name => matrix[i][name] !== matrix[i - 1][name]).length, 1);
if (process.argv.includes('--plan')) {
  console.log(JSON.stringify({ browserStarted: false, matrixRows: matrix.length, levels, controls, persistenceCases, subtitleCases }, null, 2));
  process.exit(0);
}

const engine = process.env.EWA93_AUDIO_MATRIX_ENGINE || 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
const baseURL = process.env.EWA93_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.EWA93_AUDIO_MATRIX_OUTPUT || `/tmp/ewa93-audio-volume-matrix-${Date.now()}`;
await mkdir(output, { recursive: true });
const sourcePaths = ['src/systems/audio.js', 'src/ui/interface.js', 'src/ui/interface.css', 'src/main.js', 'src/game/save.js', 'tests/e2e/audio-volume-matrix.mjs'];
async function sourceHashes() {
  return Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, createHash('sha256').update(await readFile(new URL(`../../${path}`, import.meta.url))).digest('hex')])));
}
const report = {
  test: 'S13 objective audio volume matrix', status: 'running', startedAt: new Date().toISOString(),
  engine, baseURL, sourceHashes: await sourceHashes(), servedSourceHashes: {},
  method: 'Normal settings menu keyboard input; native Web Audio target/connection observers and a measurement-only analyser tee.',
  usesGameAdvance: false, matrix: [], persistence: [], subtitles: [], settingChanges: [], menuActions: [], errors: [],
  limits: ['Does not assess subjective dialogue intelligibility, speaker/headphone listening, timbre quality or operating-system output volume.'],
};
const browser = await ({ chromium, firefox, webkit }[engine]).launch({ headless: true, args: engine === 'chromium' ? ['--enable-unsafe-swiftshader'] : [] });
report.browserVersion = browser.version();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
await context.addInitScript(() => {
  const audit = window.__ewa93AudioVolumeAudit = {
    targets: [], bootstrapConnections: [], labels: null, parameters: null,
    sources: { effects: 0, music: 0, dialogue: 0 }, graph: null, analyser: null, captureDestination: null,
  };
  const nativeTarget = AudioParam.prototype.setTargetAtTime;
  AudioParam.prototype.setTargetAtTime = function (value, startTime, timeConstant) {
    const result = Reflect.apply(nativeTarget, this, arguments);
    if (!audit.parameters || audit.parameters.has(this)) audit.targets.push({ parameter: this, target: Number(value), startTime, timeConstant, observedAtMs: performance.now() });
    return result;
  };
  const nativeConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (destination) {
    const result = Reflect.apply(nativeConnect, this, arguments);
    if (!audit.labels) audit.bootstrapConnections.push([this, destination]);
    else {
      const bus = audit.labels.get(destination);
      if (bus && !audit.labels.has(this)) audit.sources[bus] = (audit.sources[bus] || 0) + 1;
    }
    return result;
  };
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
const hashJobs = [];
page.on('response', response => {
  const path = new URL(response.url()).pathname.replace(/^\/+/, '');
  if (!sourcePaths.includes(path)) return;
  hashJobs.push(response.body().then(body => { report.servedSourceHashes[path] = createHash('sha256').update(body).digest('hex'); }).catch(() => {}));
});
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });

async function focusMenu(name) {
  await page.locator('.screen [data-focused="true"]').waitFor();
  const entries = await page.locator('.screen [data-action]:not(:disabled),.screen [data-setting]:not(:disabled)').evaluateAll(nodes => nodes.map(node => ({ action: node.dataset.action, setting: node.dataset.setting, focused: node.dataset.focused === 'true' })));
  const target = entries.findIndex(entry => entry.action === name || entry.setting === name);
  const current = entries.findIndex(entry => entry.focused);
  assert.notEqual(target, -1, `Visible menu must contain ${name}.`);
  assert.notEqual(current, -1, 'The normal menu must have a focused control.');
  const down = (target - current + entries.length) % entries.length;
  const up = (current - target + entries.length) % entries.length;
  for (let index = 0; index < Math.min(down, up); index++) await page.keyboard.press(down <= up ? 'ArrowDown' : 'ArrowUp');
  const focused = await page.locator('.screen [data-focused="true"]').evaluate(node => node.dataset.action || node.dataset.setting);
  assert.equal(focused, name);
}
async function menu(action) {
  await focusMenu(action); await page.keyboard.press('Enter');
  report.menuActions.push(action);
}
async function setSlider(name, target) {
  const input = page.locator(`[data-setting="${name}"]`);
  const before = Number(await input.inputValue());
  const live = await page.evaluate(name => window.__exitWounds.app.settings[name], name);
  if (Math.abs(before - target) < 1e-8 && Math.abs(live - target) < 1e-8) return;
  await focusMenu(name);
  const range = await input.evaluate(node => ({ min: Number(node.min), max: Number(node.max), step: Number(node.step) }));
  assert.ok(target >= range.min && target <= range.max);
  if (target === range.max) await page.keyboard.press('End');
  else {
    await page.keyboard.press('Home');
    const increments = Math.round((target - range.min) / range.step);
    for (let index = 0; index < increments; index++) await page.keyboard.press('ArrowRight');
  }
  await page.waitForFunction(({ name, target }) => Math.abs(Number(document.querySelector(`[data-setting="${name}"]`)?.value) - target) < 1e-8 && Math.abs(window.__exitWounds.app.settings[name] - target) < 1e-8, { name, target });
  report.settingChanges.push({ control: name, before, value: target });
}
async function setMix(mix) { for (const name of controls) await setSlider(name, mix[name]); }
async function installMeasurement() {
  await page.waitForFunction(() => window.__exitWounds?.app.audio.ctx?.state === 'running');
  return page.evaluate(() => {
    const audio = window.__exitWounds.app.audio, audit = window.__ewa93AudioVolumeAudit, c = audio.ctx;
    if (!audit.analyser) {
      const linked = (from, to) => audit.bootstrapConnections.some(([a, b]) => a === from && b === to);
      audit.graph = { masterToDestination: linked(audio.master, c.destination), effectsToMaster: linked(audio.effects, audio.master), musicToMaster: linked(audio.music, audio.master), dialogueToMaster: linked(audio.dialogue, audio.master) };
      audit.labels = new Map([[audio.master, 'master'], [audio.effects, 'effects'], [audio.music, 'music'], [audio.dialogue, 'dialogue']]);
      audit.parameters = new Set([audio.master.gain, audio.effects.gain, audio.music.gain, audio.dialogue.gain]);
      for (const [from, to] of audit.bootstrapConnections) {
        const label = audit.labels.get(to);
        if (label && !audit.labels.has(from)) audit.sources[label] = (audit.sources[label] || 0) + 1;
      }
      audit.bootstrapConnections = [];
      audit.targets = audit.targets.filter(event => audit.parameters.has(event.parameter));
      audit.analyser = c.createAnalyser(); audit.analyser.fftSize = 2048;
      audit.captureDestination = c.createMediaStreamDestination();
      audio.master.connect(audit.analyser); audit.analyser.connect(audit.captureDestination);
    }
    return { graph: audit.graph, contextState: c.state, sampleRate: c.sampleRate };
  });
}
async function openSettings() {
  await menu('openSettings');
  await page.locator('[data-setting="masterVolume"]').waitFor();
  const measurement = await installMeasurement();
  assert.ok(Object.values(measurement.graph).every(Boolean), 'All three real buses must feed the real master/destination graph.');
  return measurement;
}
async function readMix() {
  return page.evaluate(() => {
    const a = window.__exitWounds.app, audio = a.audio, audit = window.__ewa93AudioVolumeAudit;
    const buses = { master: audio.master, music: audio.music, dialogue: audio.dialogue, effects: audio.effects };
    const gains = {}, scheduled = {};
    for (const [name, bus] of Object.entries(buses)) {
      gains[name] = bus.gain.value;
      const event = audit.targets.findLast(event => event.parameter === bus.gain);
      scheduled[name] = event && { target: event.target, startTime: event.startTime, timeConstant: event.timeConstant };
    }
    const stored = JSON.parse(localStorage.getItem('exit-wounds-avenue-93.settings.v1'))?.settings;
    return { settings: Object.fromEntries(['masterVolume', 'musicVolume', 'dialogueVolume'].map(name => [name, a.settings[name]])), stored: stored && Object.fromEntries(['masterVolume', 'musicVolume', 'dialogueVolume'].map(name => [name, stored[name]])), gains, scheduled, audioTime: audio.ctx.currentTime, contextState: audio.ctx.state, graph: audit.graph };
  });
}
async function settledMix(expected) {
  await page.waitForFunction(expected => {
    const a = window.__exitWounds.app.audio, audit = window.__ewa93AudioVolumeAudit;
    const buses = [[a.master, expected.masterVolume], [a.music, expected.musicVolume], [a.dialogue, expected.dialogueVolume], [a.effects, 1]];
    return a.ctx.state === 'running' && buses.every(([bus, value]) => {
      const event = audit.targets.findLast(event => event.parameter === bus.gain);
      return event && Math.abs(event.target - value) < 1e-8 && a.ctx.currentTime - event.startTime >= Math.max(0.5, event.timeConstant * 10) && Math.abs(bus.gain.value - value) < 0.001;
    });
  }, expected, { polling: 50, timeout: 15000 });
  const value = await readMix();
  assert.deepEqual(value.settings, expected); assert.deepEqual(value.stored, expected);
  assert.ok(Object.values(value.graph).every(Boolean));
  value.effectiveTargets = { effects: expected.masterVolume, music: expected.masterVolume * expected.musicVolume, dialogue: expected.masterVolume * expected.dialogueVolume };
  value.effectiveGains = { effects: value.gains.master * value.gains.effects, music: value.gains.master * value.gains.music, dialogue: value.gains.master * value.gains.dialogue };
  for (const bus of ['effects', 'music', 'dialogue']) assert.ok(Math.abs(value.effectiveGains[bus] - value.effectiveTargets[bus]) < 0.002);
  return value;
}
async function rms() {
  return page.evaluate(async () => {
    const analyser = window.__ewa93AudioVolumeAudit.analyser, data = new Float32Array(analyser.fftSize), readings = [];
    for (let index = 0; index < 4; index++) {
      await new Promise(resolve => setTimeout(resolve, 40)); analyser.getFloatTimeDomainData(data);
      let sum = 0, peak = 0; for (const value of data) { sum += value * value; peak = Math.max(peak, Math.abs(value)); }
      readings.push({ rms: Math.sqrt(sum / data.length), peak });
    }
    return { mean: readings.reduce((sum, value) => sum + value.rms, 0) / readings.length, peak: Math.max(...readings.map(value => value.peak)) };
  });
}
async function loadTitle(reload = false) {
  if (reload) await page.reload({ waitUntil: 'domcontentloaded' });
  else await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-action="newGame"]').waitFor({ state: 'visible', timeout: 90000 });
}
async function gameplayKey(key) {
  const tick = await page.evaluate(() => window.__exitWounds.app.state?.tick);
  await page.keyboard.down(key);
  try { await page.waitForFunction(tick => { const a = window.__exitWounds.app; return a.ui.screen !== 'playing' || a.state.tick > tick; }, tick, { timeout: 15000 }); }
  finally { await page.keyboard.up(key); }
}
async function callSubtitle() {
  await gameplayKey('KeyT');
  await page.locator('.screen--phone').waitFor();
  const action = await page.locator('.screen [data-action]').evaluateAll(nodes => ['answerEliCall', 'returnEliCall', 'phoneReplay'].find(action => nodes.some(node => node.dataset.action === action)));
  assert.ok(action, 'The real phone must offer the ringing/interrupted Eli call.');
  await menu(action);
  await page.waitForFunction(() => { const a = window.__exitWounds.app, text = document.querySelector('#hud-subtitle')?.textContent || ''; return a.ui.screen === 'playing' && a.dialogueCurrent?.speaker === 'Eli' && text.includes(a.dialogueCurrent.text); });
}
async function captionSample(expectedScale, mix) {
  await settledMix(mix);
  const value = await page.evaluate(() => {
    const a = window.__exitWounds.app, node = document.querySelector('#hud-subtitle'), style = getComputedStyle(node), box = node.getBoundingClientRect();
    return { setting: a.settings.subtitleScale, stored: JSON.parse(localStorage.getItem('exit-wounds-avenue-93.settings.v1')).settings.subtitleScale, cssScale: Number(getComputedStyle(document.documentElement).getPropertyValue('--subtitle-scale')), fontSize: Number.parseFloat(style.fontSize), text: node.textContent, visible: style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0, hudScale: a.settings.hudScale, sources: { ...window.__ewa93AudioVolumeAudit.sources } };
  });
  assert.equal(value.setting, expectedScale); assert.equal(value.stored, expectedScale); assert.equal(value.cssScale, expectedScale); assert.ok(value.visible && value.text.startsWith('Eli:'));
  assert.equal(value.hudScale, 1, 'Subtitle scaling must leave the HUD scale independent.');
  return { scale: expectedScale, mix, ...value };
}

try {
  await loadTitle(); report.audio = await openSettings();
  await focusMenu('quality'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#s-quality').inputValue(), 'low');
  for (let index = 0; index < matrix.length; index++) {
    const expected = matrix[index]; await setMix(expected);
    const measured = await settledMix(expected), outputLevel = await rms();
    if (expected.masterVolume === 0) assert.ok(outputLevel.peak < 0.00001, `Master mute must silence the actual measured mix at row ${index}.`);
    else assert.ok(outputLevel.mean > 0.0001, `The live city mix must reach master at row ${index}.`);
    report.matrix.push({ index, expected, changedControl: index ? controls.find(name => expected[name] !== matrix[index - 1][name]) : 'initial', ...measured, outputLevel });
  }
  for (const expected of persistenceCases) {
    await setMix(expected); await settledMix(expected); await loadTitle(true);
    const loaded = await page.evaluate(() => Object.fromEntries(['masterVolume', 'musicVolume', 'dialogueVolume'].map(name => [name, window.__exitWounds.app.settings[name]])));
    assert.deepEqual(loaded, expected);
    await openSettings(); const measured = await settledMix(expected);
    for (const name of controls) assert.equal(Number(await page.locator(`[data-setting="${name}"]`).inputValue()), expected[name]);
    report.persistence.push({ expected, loaded, ...measured });
  }
  for (let index = 0; index < subtitleCases.length; index++) {
    const { scale, mix } = subtitleCases[index];
    if (index) { await gameplayKey('Escape'); await openSettings(); }
    await setSlider('subtitleScale', scale); await setMix(mix); await settledMix(mix);
    await menu('settingsBack');
    if (!index) await menu('newGame'); else await menu('resume');
    await page.waitForFunction(() => window.__exitWounds.app.ui.screen === 'playing');
    await callSubtitle(); report.subtitles.push(await captionSample(scale, mix));
  }
  const base = report.subtitles.find(value => value.scale === 1).fontSize;
  for (const value of report.subtitles) assert.ok(Math.abs(value.fontSize / base - value.scale) < 0.015, 'Actual subtitle typography must follow the independent scale.');
  assert.ok(report.subtitles.some(value => value.mix.masterVolume === 0 && value.visible));
  assert.ok(report.subtitles.some(value => value.mix.dialogueVolume === 0 && value.visible));
  assert.ok(report.subtitles.at(-1).sources.music > 0 && report.subtitles.at(-1).sources.dialogue > 0, 'Normal game radio and Eli cues must reach their real independent buses.');

  await loadTitle(true); await openSettings();
  assert.equal(Number(await page.locator('[data-setting="subtitleScale"]').inputValue()), 1.4);
  const finalMix = subtitleCases.at(-1).mix; await settledMix(finalMix);
  await menu('settingsBack'); await menu('continue');
  await page.waitForFunction(() => window.__exitWounds.app.ui.screen === 'playing');
  await callSubtitle(); report.subtitleReload = await captionSample(1.4, finalMix);
  assert.ok(Math.abs(report.subtitleReload.fontSize - report.subtitles.at(-1).fontSize) < 0.05);
  report.checks = { all27GainCombinations: true, actualScheduledAndSettledParameters: true, independentBusGraph: true, measuredMasterMute: true, allThreeLevelsPersistForEveryChannel: true, subtitleScaling: true, captionsRemainWithMasterOrDialogueMuted: true, subtitleScalePersists: true };
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  report.lastMix = await readMix().catch(() => null);
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  console.error(error.stack); process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString(); report.wallSeconds = (Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000;
  await Promise.allSettled(hashJobs); report.finalSourceHashes = await sourceHashes();
  report.sourceUnchanged = Object.keys(report.sourceHashes).every(path => report.sourceHashes[path] === report.finalSourceHashes[path]);
  if (report.status === 'passed' && !report.sourceUnchanged) { report.status = 'failed'; report.error = 'Audio/UI/settings source changed during the check.'; process.exitCode = 1; }
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await page.evaluate(() => { const audio = window.__exitWounds?.app.audio, audit = window.__ewa93AudioVolumeAudit; if (audio?.master && audit?.analyser) audio.master.disconnect(audit.analyser); audit?.captureDestination?.stream.getTracks().forEach(track => track.stop()); }).catch(() => {});
  await context.close(); await browser.close();
  console.log(JSON.stringify({ status: report.status, rows: report.matrix.length, reloadCases: report.persistence.length, subtitleCases: report.subtitles.length, checks: report.checks, output }));
}
