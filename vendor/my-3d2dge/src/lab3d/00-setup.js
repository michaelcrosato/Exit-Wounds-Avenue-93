/* =============================================================================
 * THE 3D PROOF, once "3D world lab" (temporary lab; docs/LAB-3D.md): our characters in a fully 3D world.
 * three.js r182 (WebGPURenderer: WebGPU, falling back to WebGL 2 by itself) and Rapier 0.19.3 (SIMD), vendored in
 * vendor/ and loaded through the import map in src/lab3d.template.html. The engine (window.My3D2dge), the mocap
 * player (Mocap, window.MOCAP) and Dan's body (window.DanRig) are classic scripts inlined above this module,
 * unchanged; this module only reads them.
 *
 * The parts (joined in name order into one module by tools/build.mjs, so they share one scope; read the headers):
 *   00-setup       imports, units, the address options, small helpers
 *   10-materials   procedural textures (drawn by code, pixel by pixel) and the node materials
 *   20-world       the room from its ASCII map: walls, pillars, floor, crates' meshes, torches, the sun
 *   30-physics     Rapier: colliders from the same map, crates, the hero's controller, the fixed step, the hash
 *   40-characters  the cast (hero, mocap figure, Dan): Card mode (the engine draws) and Puppet mode (3D parts)
 *   50-cameras     the engine's five fixed views (with its height boost), orbit, fly, chase, fix
 *   60-panel       the render loop, the look options, the panel and keys, window.__lab3d
 *
 * Coordinates. three.js is y-up, in metres. The engine is z-up in its own units: 16 units = 1 metre = 1 floor tile.
 *   engine (x, y, z)  <->  three (x / U, z / U, y / U)          (toThree / toEngine below)
 *   an engine angle a (facing, yaw) turns about three's y axis by -a
 * The rules (tools/lab3d-test.mjs checks them): WebGPURenderer and node materials only (never WebGLRenderer,
 * ShaderMaterial, onBeforeCompile, EffectComposer); no compute shaders or storage buffers (WebGPU-only); nothing read
 * back from the GPU into gameplay. Gameplay (30-physics) runs on the CPU at a fixed 60 Hz and never reads the renderer.
 * ============================================================================= */
import * as THREE from 'three/webgpu';
import { Fn, vec4, uniform, positionLocal, normalLocal, modelViewMatrix, cameraProjectionMatrix } from 'three/tsl';
import RAPIER from '@dimforge/rapier3d-simd-compat';

const E = window.My3D2dge, DanRig = window.DanRig, { clamp, lerp } = E;   // (Mocap is the mocap player's own global)
const U = 16;                                   // engine units per metre (one floor tile)
const STEP = 1 / 60;                            // the fixed gameplay step (seconds)
const LINES = 240;                              // the engine's picture height in pixels: fixed views frame this many lines at zoom 1
const OUTLINE = '#0c0818';                      // the engine's outline color (sprites, portraits)
const QS = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
/** anything that stops the lab says so on the page (and in window.__lab3d.error for tests) */
function fail(e) {
  const msg = String(e && e.message || e), L = $('loading');
  if (L) { L.hidden = false; L.textContent = 'The lab stopped: ' + msg; }
  window.__lab3d = Object.assign(window.__lab3d || {}, { error: msg });
}
addEventListener('error', e => fail(e.error || e.message));
addEventListener('unhandledrejection', e => fail(e.reason));

/** engine units (z up) -> three metres (y up), and back */
const toThree = (x, y, z, out = new THREE.Vector3()) => out.set(x / U, z / U, y / U);
const toEngine = v => [v.x * U, v.z * U, v.y * U];
/** a whole-number hash of a list of numbers, by their exact float32 bits (FNV-1a): equal state, equal hash */
const F32 = new Float32Array(1), I32 = new Uint32Array(F32.buffer);
function hashNumbers(list) {
  let h = 0x811c9dc5;
  for (const n of list) { F32[0] = n; h ^= I32[0]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
