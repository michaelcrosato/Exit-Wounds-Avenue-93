/* =============================================================================
 * FILTERS (the panel's Filters section, N cycles the look): one look over the finished picture, on the entire scene,
 * on the characters and objects only, or on the environment (the hall) only.
 *   Clean      no filter: the scene goes straight to the screen, no extra pass (the benchmark's baseline)
 *   Comic cel  light in a few flat bands (shade bands, keeping each color's hue), colors pushed (colour punch), and ink
 *              where the picture changes sharply (ink strength, ink width), on the darker side of the edge, and round
 *              each character's and object's silhouette
 *   Pixel      the picture in square blocks (pixel size, in the picture's own pixels), a few levels per channel
 *              (colours per channel), ordered Bayer 4 x 4 dithering between the levels (dither)
 *   Bloom      bright parts glow: what is brighter than a threshold, blurred at a quarter of the size, added back
 *   FXAA       edge smoothing over the result (the classic FXAA: blend along the edge's direction)
 *   Cel and Pixel work in display colors (sRGB), as the engine's palettes are written, so bands and levels fall
 *   where the eye expects them.
 * Characters and objects apart from the hall: with a filter on, the scene draws into two targets at once (MRT): the
 * picture, and a mask every character and object material writes 1 to (objMat, 00-setup: characters, crates, barrels,
 * braziers) while the floor, walls, pillars, galleries and the dais leave 0. Glows, trails and particles that add light leave the mask as it is.
 * All TSL in PostProcessing (three/webgpu), the same on WebGPU and WebGL 2; no add-ons.
 *   ?fx=cel|pixel  &fxto=objects|env  &bloom=1  &fxaa=1  open with a filter
 * ============================================================================= */
const { pass, mrt, output, rtt, float, vec2, vec3, vec4, uv, uniform, floor, mod, abs, max, min, mix, select, smoothstep, luminance, saturation, sRGBTransferOETF } = TSL;
const FX = {
  look: ['cel', 'pixel'].includes(QS.get('fx')) ? QS.get('fx') : 'clean', apply: ['objects', 'env'].includes(QS.get('fxto')) ? QS.get('fxto') : 'all',
  bands: 4, ink: .9, inkW: 1.5, punch: 1.3, px: 4, levels: 8, dither: .35, bloom: QS.get('bloom') === '1', fxaa: QS.get('fxaa') === '1',
  active() { return this.look !== 'clean' || this.bloom || this.fxaa; }
};
const UF = {
  bands: uniform(4), ink: uniform(.9), inkW: uniform(1.5), punch: uniform(1.3), px: uniform(4), levels: uniform(8), dither: uniform(.35),
  apply: uniform(0), texel: uniform(new THREE.Vector2(1, 1)), qtexel: uniform(new THREE.Vector2(1, 1))
};
const post = new THREE.PostProcessing(renderer);
post.outputColorTransform = false;   // (the filters end in display colors themselves)
const scenePass = pass(scene, camP);   // (its camera is set each frame: perspective or orthographic)
scenePass.setMRT(mrt({ output, mask: float(0) }));
const OBJ_MASK = mrt({ mask: float(1) });
const colTex = scenePass.getTextureNode('output'), maskTex = scenePass.getTextureNode('mask');
const INK = vec3(.047, .031, .094);   // the engine's outline color
/** the scene at uv in display colors, and the mask */
const sceneAt = u => sRGBTransferOETF(colTex.sample(u).rgb);
const maskAt = u => maskTex.sample(u).r;
/** how much of the filter to keep at a pixel whose mask is m: everywhere, characters and objects, or the hall */
const keep = m => select(UF.apply.equal(0), float(1), select(UF.apply.equal(1), m, float(1).sub(m)));
function celLook() {
  const u = uv(), c = sceneAt(u), l = luminance(c);
  // brightness rounded to N flat bands (the darkest kept above black), the hue kept
  const q = max(floor(l.mul(UF.bands).add(.5)), .5).div(UF.bands), banded = c.mul(q.div(max(l, .002)));
  const punched = saturation(banded, UF.punch);
  // ink, on the darker side of an edge only (so a line is ink width thick, not twice that): where a neighbour ink width
  // away is much brighter, and round each character's and object's silhouette (the mask falling away beside it)
  const o = UF.texel.mul(UF.inkW), m = maskAt(u);
  let edge = float(0), rim = float(0);
  for (const d of [vec2(o.x, 0), vec2(o.x.negate(), 0), vec2(0, o.y), vec2(0, o.y.negate())]) {
    edge = max(edge, luminance(sceneAt(u.add(d))).sub(l)); rim = max(rim, m.sub(maskAt(u.add(d))));
  }
  const inked = mix(punched, INK, max(smoothstep(.16, .36, edge), rim).mul(UF.ink));
  return mix(c, min(max(inked, vec3(0)), vec3(1)), keep(m));
}
function pixelLook() {
  const u = uv(), res = vec2(1).div(UF.texel), blk = floor(u.mul(res).div(UF.px)), cu = blk.add(.5).mul(UF.px).div(res);
  const c = sceneAt(cu);
  // ordered dithering: a 4 x 4 Bayer threshold from the block's position (two 2 x 2 levels: 2 * (x xor y) + y)
  const b2 = (x, y) => abs(x.sub(y)).mul(2).add(y);
  const bx = mod(blk.x, 2), by = mod(blk.y, 2), bx2 = mod(floor(blk.x.div(2)), 2), by2 = mod(floor(blk.y.div(2)), 2);
  const bayer = b2(bx, by).mul(4).add(b2(bx2, by2)).add(.5).div(16).sub(.5);
  const L = UF.levels.sub(1), q = floor(c.mul(L).add(bayer.mul(UF.dither)).add(.5)).div(L);
  // which parts: the block's own mask for characters and objects (whole blocks), the pixel's own for the hall
  const m = select(UF.apply.equal(1), maskAt(cu), maskAt(u));
  return mix(sceneAt(u), min(max(q, vec3(0)), vec3(1)), keep(m));
}
/** bloom: the bright parts at a quarter of the size, blurred across and down (9 taps each way) */
const BLOOM_W = [.227, .194, .121, .054, .016];
function bloomOf() {
  const bright = rtt(vec4(sceneAt(uv()).mul(smoothstep(.72, 1, luminance(sceneAt(uv())))), 1), 1, 1);
  const blur = (src, dir) => {
    let acc = src.sample(uv()).rgb.mul(BLOOM_W[0]);
    for (let i = 1; i < 5; i++) acc = acc.add(src.sample(uv().add(dir.mul(i * 1.6))).rgb.mul(BLOOM_W[i])).add(src.sample(uv().sub(dir.mul(i * 1.6))).rgb.mul(BLOOM_W[i]));
    return rtt(vec4(acc, 1), 1, 1);
  };
  const h = blur(bright, vec2(UF.qtexel.x, 0)), v = blur(h, vec2(0, UF.qtexel.y));
  return { targets: [bright, h, v], glow: v.sample(uv()).rgb };
}
/** FXAA over a finished picture (a texture node): the classic version, blending along the edge it finds */
function fxaa(src) {
  const u = uv(), t = UF.texel, L = p => luminance(src.sample(p).rgb);
  const nw = L(u.add(vec2(-1, -1).mul(t))), ne = L(u.add(vec2(1, -1).mul(t))), sw = L(u.add(vec2(-1, 1).mul(t))), se = L(u.add(vec2(1, 1).mul(t))), m = L(u);
  const lo = min(m, min(min(nw, ne), min(sw, se))), hi = max(m, max(max(nw, ne), max(sw, se)));
  const dir0 = vec2(nw.add(ne).sub(sw.add(se)).negate(), nw.add(sw).sub(ne.add(se)));
  const reduce = max(nw.add(ne).add(sw).add(se).mul(.25 / 8), 1 / 128), rcp = float(1).div(min(abs(dir0.x), abs(dir0.y)).add(reduce));
  const dir = min(vec2(8), max(vec2(-8), dir0.mul(rcp))).mul(t);
  const a = src.sample(u.add(dir.mul(1 / 3 - .5))).rgb.add(src.sample(u.add(dir.mul(2 / 3 - .5))).rgb).mul(.5);
  const b = a.mul(.5).add(src.sample(u.add(dir.mul(-.5))).rgb.add(src.sample(u.add(dir.mul(.5))).rgb).mul(.25));
  const lb = luminance(b);
  return select(lb.lessThan(lo).or(lb.greaterThan(hi)), a, b);
}
let fxTargets = [], fxaaTarget = null, fxKey = '';
/** the output graph for the look and the switches (built again only when one of those changes; sliders are uniforms) */
function buildFX() {
  let col = FX.look === 'cel' ? celLook() : FX.look === 'pixel' ? pixelLook() : sceneAt(uv());
  fxTargets = [];
  if (FX.bloom) { const b = bloomOf(); fxTargets = b.targets; col = col.add(b.glow.mul(.6)); }
  fxaaTarget = null;
  if (FX.fxaa) { fxaaTarget = rtt(vec4(col, 1)); col = fxaa(fxaaTarget); }
  post.outputNode = vec4(col, 1); post.needsUpdate = true;
}
/** tag (or untag) the character and object materials for the mask: only while a filter is on, since a material with
 *  its own MRT outputs can't draw straight to the screen */
function tagMaterials(on) {
  OBJ_MRT = on ? OBJ_MASK : null;
  for (const m of OBJ_MATS) { m.mrtNode = OBJ_MRT; m.needsUpdate = true; }
}
let fxWas = false;
const _sz = new THREE.Vector2();
/** draw the frame: straight to the screen, or through the filters */
function renderFrame(cam) {
  const on = FX.active();
  if (on !== fxWas) { fxWas = on; tagMaterials(on); warmed = false; }
  if (!on) { renderer.render(scene, cam); return; }
  const key = [FX.look, FX.bloom, FX.fxaa].join(); if (key !== fxKey) { fxKey = key; buildFX(); warmed = false; }
  renderer.getDrawingBufferSize(_sz);
  UF.texel.value.set(1 / _sz.x, 1 / _sz.y);
  const qw = Math.max(1, Math.round(_sz.x / 4)), qh = Math.max(1, Math.round(_sz.y / 4));
  for (const t of fxTargets) if (t.width !== qw || t.height !== qh) t.setSize(qw, qh);
  UF.qtexel.value.set(1 / qw, 1 / qh);
  UF.bands.value = FX.bands; UF.ink.value = FX.ink; UF.inkW.value = FX.inkW; UF.punch.value = FX.punch;
  UF.px.value = FX.px; UF.levels.value = FX.levels; UF.dither.value = FX.dither; UF.apply.value = FX.apply === 'all' ? 0 : FX.apply === 'objects' ? 1 : 2;
  scenePass.camera = cam;
  post.render();
}

/* ---- the panel ---- */
const FX_NOTES = {
  clean: 'Clean: no filter, the picture as the scene draws it (no extra pass).',
  cel: 'Comic cel: flat bands of light, pushed colors and ink lines.',
  pixel: 'Pixel: square blocks, a few colors per channel, dithered between them.'
};
const FX_SLIDERS = { bands: v => v, ink: v => v.toFixed(2), inkW: v => v.toFixed(2), punch: v => v.toFixed(2), px: v => v, levels: v => v, dither: v => v.toFixed(2) };
function syncFX() {
  document.querySelectorAll('[data-fx]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fx === FX.look)));
  $('fxApply').value = FX.apply; $('fxApply').disabled = FX.look === 'clean';
  $('fxCel').hidden = FX.look !== 'cel'; $('fxPixel').hidden = FX.look !== 'pixel';
  for (const k in FX_SLIDERS) { $('fx-' + k).value = FX[k]; $('fx-' + k + 'Out').textContent = FX_SLIDERS[k](FX[k]); }
  $('fxBloom').checked = FX.bloom; $('fxFxaa').checked = FX.fxaa;
  $('fxNote').textContent = FX_NOTES[FX.look] + (FX.active() ? ' Filters draw the scene into a target first and then over the screen: their cost shows in the frame time.' : '');
}
function setFX(k, v) { FX[k] = v; syncFX(); }
document.querySelectorAll('[data-fx]').forEach(b => b.addEventListener('click', () => { setFX('look', b.dataset.fx); b.blur(); }));
$('fxApply').addEventListener('change', e => { setFX('apply', e.target.value); e.target.blur(); });
for (const k in FX_SLIDERS) $('fx-' + k).addEventListener('input', e => setFX(k, +e.target.value));
$('fxBloom').addEventListener('change', e => { setFX('bloom', e.target.checked); e.target.blur(); });
$('fxFxaa').addEventListener('change', e => { setFX('fxaa', e.target.checked); e.target.blur(); });
addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.code !== 'KeyN' || (e.target && ['SELECT', 'TEXTAREA'].includes(e.target.tagName))) return;
  const L = ['clean', 'cel', 'pixel']; setFX('look', L[(L.indexOf(FX.look) + 1) % L.length]); note(FX.look === 'clean' ? 'NO FILTER' : FX.look === 'cel' ? 'COMIC CEL' : 'PIXEL');
});
