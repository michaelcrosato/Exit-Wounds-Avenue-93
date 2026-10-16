/* =============================================================================
 * THE 3D PROTOTYPE, once "Stress test: 3D world" (temporary lab; docs/LAB-3D.md): the stress test built again from the ground up as a 3D game.
 * It tries to do the same things (a torch-lit hall, the hero, a crowd of walkers, slimes and wisps that take turns to
 * attack, waves, a particle storm, the panel, the numbers and the benchmark) the way a 3D game would, and is allowed
 * to feel different:
 *   physics    Rapier 0.19.3 (SIMD): every monster is a rigid body (the crowd pushes and piles up by itself, knockback
 *              is momentum, big hits launch bodies into the air, the fallen fly and slide), the hero is a character
 *              controller that walks, dashes and jumps, crates and barrels are knocked about
 *   world      a hall written as text (10-hall): walls, pillars, low walls to jump, a raised rune dais, two galleries
 *              up stairs; every mesh and texture made by code
 *   shared     the animation system, unchanged: the engine's rigs (E.Humanoid, E.Blob), its moves (E.MOVES,
 *              E.Attack, E.Combo), its particles' emitters and its pixel font; the floor's texture is the 2D hall's own
 *   drawing    three.js r182 (WebGPURenderer: WebGPU, or WebGL 2 by itself); characters as Cards (the engine draws
 *              each rig onto a card) or Puppets (3D parts on the same joints)
 * One coordinate system for the game and the physics: the engine's own units, z up (16 units = 1 metre = one tile),
 * so the rigs, moves and reaches read exactly as in the 2D games. Rapier runs in those units (its length unit is 16,
 * gravity points down z); three.js gets metres, y up, at the drawing's edge (toThree).
 * Parts (one module, joined in name order by tools/build.mjs; they share one scope):
 *   00-setup    imports, units, the renderer, helpers and the materials the parts share
 *   10-hall     the level as ASCII text, its floor heights and walkable grid, colliders, meshes, braziers, lights
 *   20-sim      the game on Rapier: hero, monsters, combat, waves, props, shots, particles; fixed steps, state hash
 *   30-crowd    characters as Cards or Puppets in instanced batches; crates and barrels from their bodies
 *   35-effects  telegraphs, trails, bolts, particles; damage numbers and notes on a pixel overlay
 *   40-cameras  the views (orthographic or perspective), side scrolling with depth, custom, chase, first person, fly,
 *               fixed; what the keys and mouse mean in each
 *   45-filters  Clean, Comic cel or Pixel on the scene, the characters and objects, or the hall; bloom; FXAA
 *   50-frame    the loop (game steps, then one picture), lights, the resolution, the warm-up
 *   60-panel    the panel, the metrics, presets, the benchmark, window.__sw
 * The rules (tools/stress-world-test.mjs checks them, as for the 3D Proof): WebGPURenderer and node materials
 * only, no compute shaders or storage buffers, nothing read back from the GPU into gameplay. Gameplay (20-sim) never
 * reads the renderer: the same inputs give the same state and the same hash on WebGPU, WebGL 2 or no renderer.
 * ============================================================================= */
import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import RAPIER from '@dimforge/rapier3d-simd-compat';

const E = window.My3D2dge, { clamp, lerp, approach, TAU } = E;
const QS = new URLSearchParams(location.search);
const U = 16;                                   // engine units per metre (one floor tile)
const STEP = 1 / 60;                            // the longest game step (seconds); the proof run uses exactly this
const OUTLINE = '#0c0818';                      // the engine's outline color
const $ = id => document.getElementById(id);
/** anything that stops the page says so on it (and in window.__sw.error for tests) */
function fail(e) {
  const msg = String(e && e.message || e), L = $('loading3d');
  if (L) { L.hidden = false; L.textContent = 'The 3D world stopped: ' + msg; }
  window.__sw = Object.assign(window.__sw || {}, { error: msg });
  console.error(e);
}
addEventListener('error', e => fail(e.error || e.message));
addEventListener('unhandledrejection', e => fail(e.reason));
/** engine units (z up) -> three metres (y up) */
const toThree = (x, y, z, out = new THREE.Vector3()) => out.set(x / U, z / U, y / U);
/** '#rrggbb' -> linear RGB floats for instance colors (cached) */
const _lin = new Map(), _c = new THREE.Color();
function lin(hex) { let v = _lin.get(hex); if (!v) { _c.set(hex); v = [_c.r, _c.g, _c.b]; _lin.set(hex, v); } return v; }
/** a whole-number hash of a list of numbers, by their exact float32 bits (FNV-1a): equal state, equal hash */
const _F32 = new Float32Array(1), _I32 = new Uint32Array(_F32.buffer);
function hashNumbers(list) {
  let h = 0x811c9dc5;
  for (const n of list) { _F32[0] = n; h ^= _I32[0]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/* ---- the renderer: WebGPU, or WebGL 2 by itself; ?backend=webgl forces WebGL 2 ---- */
const canvas3d = $('view'), over = $('over'), og = over.getContext('2d');
const renderer = new THREE.WebGPURenderer({ canvas: canvas3d, antialias: false, forceWebGL: QS.get('backend') === 'webgl' });
await renderer.init();
const BACKEND = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor('#06050b');
renderer.info.autoReset = false;   // (the frame resets it: with a filter on, one frame is several renders)
const scene = new THREE.Scene();
scene.background = new THREE.Color('#06050b');
scene.fog = new THREE.Fog('#06050b', 30, 90);   // the far end of the hall fades into the dark (metres; the panel can turn it off)

/* ---- materials shared by the parts ---- */
/** a texture function (x, y) -> [r, g, b] baked into a crisp texture (the engine's texture style: pixel by pixel) */
function bake(fn, w, h, repeat = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y), i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  return t;
}
/* the puppets' toon look: three bands of light (shadow, base, lit), like the engine's tones */
const TOON_BANDS = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 3, 1);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();
/** the materials of characters and objects (not the hall): while a filter is on they write 1 into the filters' mask
 *  (45-filters), so a filter can take the characters and objects, or the hall, alone */
const OBJ_MATS = new Set(); let OBJ_MRT = null;
function objMat(m) { OBJ_MATS.add(m); if (OBJ_MRT) { m.mrtNode = OBJ_MRT; m.needsUpdate = true; } return m; }
/* outlines: an inverted hull. The same (instanced) mesh again, back faces only, each vertex pushed OUTLINE_PX pixels
 * outward on the screen (along its normal for round parts, away from the part's centre for boxes) */
const OUTLINE_PX = TSL.uniform(new THREE.Vector2(.01, .01));   // clip-space size of the push, set per frame (one game pixel)
const _outline = {};
function outlineMat(mode = 'normal') {
  if (_outline[mode]) return _outline[mode];
  const { Fn, vec4, positionLocal, normalLocal, modelViewMatrix, cameraProjectionMatrix } = TSL;
  const m = objMat(new THREE.MeshBasicNodeMaterial({ color: OUTLINE, side: THREE.BackSide, fog: false }));
  m.vertexNode = Fn(() => {
    const mvp = cameraProjectionMatrix.mul(modelViewMatrix), pos = mvp.mul(vec4(positionLocal, 1));
    const out = mode === 'center' ? positionLocal : normalLocal;
    const pos2 = mvp.mul(vec4(positionLocal.add(out.normalize().mul(.01)), 1));
    const dir = pos2.xy.div(pos2.w).sub(pos.xy.div(pos.w)).normalize();
    return vec4(pos.xy.add(dir.mul(OUTLINE_PX).mul(pos.w)), pos.z, pos.w);
  })();
  return (_outline[mode] = m);
}
