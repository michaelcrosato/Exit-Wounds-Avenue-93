import { GRAVITY, m } from './units.js';
import { ACTION_MAP, InputAdapter } from './input.js';
import { QuerySystem } from './queries.js';
import { OrbitCamera } from './camera.js';
import { VehicleSystem } from './vehicles.js';

export const ENGINE_METADATA = Object.freeze({ name: 'my-3d2dge', version: '0.46.1', build: 'dev-build', commit: 'cfa866aa45474868350cad1a7fc015e612f9305f', patch: 'EWA93-P1-analog-input+P2-three-stage-fallback', unitsPerMetre: 16, gravity: GRAVITY });

/** Full engine plus 3D world. Canvas arguments accept elements or their DOM IDs. */
/** @param {any} options */
export async function bootEngine({ canvas3d = 'view', canvasHud = 'screen', settings = {} } = {}) {
  await import(new URL('../../vendor/my-3d2dge/engine/my-3d2dge-3d.js', import.meta.url).href);
  const E = globalThis.My3D2dge;
  if (!E?.Game || !E?.World3D) throw new Error('The full my-3d2dge engine must load before bootEngine.');
  const game = new E.Game({ canvas: canvasHud, bg: null, step: 1 / 120, input: ACTION_MAP, minW: 320, minH: 240, maxW: 7680, maxH: 4320, loop: true, id: 'exit-wounds-avenue-93', menu: false, corner: false, fullscreen: false, backGesture: false, autoPause: false });
  game.fadeTime = 0; game.pauseOverlay = false;
  // The DOM interface owns pause and display; never allow retro defaults to shrink the HUD.
  game.screen.setOptions({ minW: 320, minH: 240, maxW: 7680, maxH: 4320 });
  await E.World3D.init(game, { canvas: canvas3d, backend: settings.backend });
  const world = new E.World3D(game, {
    level: { rows: [' '], bottom: -160 }, gravity: GRAVITY, look: 'puppet', res: settings.quality === 'high' ? 'full' : 'balanced', outlines: false,
    // Keep shadow-caster identity stable. Three r182 can retain a disposed
    // shadow node when castShadow is switched off and back on at runtime.
    shadows: true, camera: { mode: 'fixed', mouseLook: false },
    fog: { color: '#7b8f98', near: m(80), far: m(330) }, sky: '#788b96', ambient: ['#b4c9cd', '#3c4246', 1.65],
    sun: { color: '#d2dfdc', intensity: 1.35, dir: [.5, .2, -.8], area: m(70), map: 1024 }, filter: { look: 'clean', bloom: 0, fxaa: true }
  });
  // Coarse dimensions are logical metadata; static district colliders own the ground.
  world.width = m(480); world.depth = m(420); world.bottom = m(-10);
  const input = new InputAdapter(game, settings), queries = new QuerySystem(E, world), camera = new OrbitCamera(world, queries, settings), vehicles = new VehicleSystem(E, world, queries);
  // Native floor helpers only know tile floors. Urban meshes, stairs, props and vehicle bodies are Rapier geometry.
  world.floorAt = (x, y, z = m(2)) => queries.floorAt(x, y, z);
  world.ground = (x, y) => queries.floorAt(x, y, m(3));
  const shadowLights = [world._sun, ...(world._shadowLights || [])].filter(Boolean).map(light => ({
    shadow: light.shadow, intensity: light.shadow.intensity, autoUpdate: light.shadow.autoUpdate
  }));
  const setQuality = quality => {
    world.res = quality === 'high' ? 'full' : 'balanced';
    world.shadows = true;
    const low = quality === 'low';
    for (const light of shadowLights) {
      light.shadow.intensity = low ? 0 : light.intensity;
      light.shadow.autoUpdate = low ? false : light.autoUpdate;
      light.shadow.needsUpdate = !low;
    }
  };
  const metadata = { ...ENGINE_METADATA, version: E.version, build: E.build, backend: E.World3D.backend };
  const runtime = {
    E, world, game, input, queries, camera, vehicles, metadata, setQuality,
    start({ update = dt => {}, draw = r => {}, onError = null } = {}) {
      let failed = false;
      const fail = error => { failed = true; game.stop(); if (onError) onError(error); else throw error; };
      game.start({
        update(dt) { if (failed) return; try { update(dt); } catch (error) { fail(error); } },
        draw(r) { if (failed) return; try { world.draw(r); draw(r); } catch (error) { fail(error); } },
        pausable: false, input: ACTION_MAP
      });
      return runtime;
    },
    async prepare() { await world.prepare(); },
    stop() { game.stop(); },
    dispose() { game.stop(); input.dispose(); vehicles.dispose(); world.dispose(); game.dispose(); }
  };
  setQuality(settings.quality);
  return runtime;
}
export const createEngineRuntime = bootEngine;
