/* =============================================================================
 * MATERIALS: every texture is drawn by code, pixel by pixel, at the engine's density (16 pixels per metre: one per
 * engine unit) and shown with nearest filtering, so texels stay crisp pixel art at any distance.
 *   TEX.<name>(x, y) -> [r, g, b]     a texture is a function of the pixel (x right, y down), like the engine's E.tex
 *   bake(fn, w, h)                    -> a THREE.CanvasTexture of that function (repeats, sRGB, nearest)
 *   MAT.<name>                        the room's node materials (Lambert: lit by the sun and the torches, shadowed)
 *   toonMat(hex)                      a puppet part's material: toon bands in that color (cached per color)
 *   outlineMat(mode)                  the outline shell ('normal' for round parts, 'center' for boxes)
 *   OUTLINE_PX                        the outline's width on screen, set each frame by the render loop
 * A new texture: add a function to TEX and a material to MAT. Only node materials: they compile to WebGPU and WebGL 2.
 * ============================================================================= */
const RGB = s => E.hex(s);
const PAL = {
  floor: { stones: ['#6b6f5a', '#767a63', '#626653'].map(RGB), mortar: RGB('#3a3c31'), hi: RGB('#8b8f75'), lo: RGB('#51543f'), speck: RGB('#45473a') },
  brick: { bricks: ['#625d4d', '#6b6553', '#5a5546', '#676150'].map(RGB), mortar: RGB('#3d392f'), hi: RGB('#7d7662'), lo: RGB('#4c483b') },
  pillar: { blocks: ['#7d7662', '#857e69', '#76705c'].map(RGB), mortar: RGB('#4a4538'), hi: RGB('#a39b84'), lo: RGB('#615b4b') },
  top: { base: RGB('#8a8470'), dark: RGB('#77725f'), light: RGB('#9a947e') },
  wood: { planks: ['#9d6a3f', '#8f5f37', '#a87547'].map(RGB), frame: RGB('#6e4528'), line: RGB('#4a2e1c'), hi: RGB('#c08a55'), nail: RGB('#2e2420') }
};
const TEX = {
  /** the engine's own flagstones (E.tex.flagstone), the palette of the free camera room */
  floor: (x, y) => E.tex.flagstone(x, y, PAL.floor),
  /** bricks 8 x 4 pixels in running bond: a lit top edge, a dark mortar line, each brick its own tone */
  brick(x, y) {
    const P = PAL.brick, row = Math.floor(y / 4), off = (row & 1) * 4, col = Math.floor((x + off) / 8), lx = x + off - col * 8, ly = y - row * 4;
    if (ly === 3 || lx === 7) return P.mortar;
    if (ly === 0) return P.hi;
    const h = E.hash2(col, row), c = P.bricks[(h * P.bricks.length) | 0];
    return E.hash2(x * 7 + 1, y * 3 + 2) < .06 ? P.lo : c;
  },
  /** the pillars' stone: blocks 16 x 8 pixels, bevelled (lit top and left, dark bottom and right) */
  pillar(x, y) {
    const P = PAL.pillar, row = Math.floor(y / 8), off = (row & 1) * 8, col = Math.floor((x + off) / 16), lx = x + off - col * 16, ly = y - row * 8;
    if (ly === 7 || lx === 15) return P.mortar;
    if (ly === 0 || lx === 0) return P.hi;
    if (ly === 6 || lx === 14) return P.lo;
    const c = P.blocks[(E.hash2(col, row) * P.blocks.length) | 0];
    return E.noise2(x * .3, y * .3) > .78 ? P.lo : c;
  },
  /** wall and pillar tops: worn stone, soft noise */
  top(x, y) { const P = PAL.top, n = E.noise2(x * .2, y * .2); return n > .66 ? P.light : n < .3 ? P.dark : P.base; },
  /** a crate's face (12 x 12 pixels for a 0.75 m crate): a dark frame, three planks, a diagonal brace, four nails */
  crate(x, y) {
    const P = PAL.wood, n = 12;
    if (x === 0 || y === 0 || x === n - 1 || y === n - 1) return P.line;
    if (x === 1 || y === 1 || x === n - 2 || y === n - 2) return (x === 1 || x === n - 2) && (y === 1 || y === n - 2) ? P.nail : P.frame;
    if (Math.abs(x - y) <= .5 || Math.abs(x - y - 1) <= .5) return x === y ? P.hi : P.frame;   // the brace
    if ((y - 2) % 3 === 2) return P.line;
    return P.planks[Math.floor((y - 2) / 3) % P.planks.length];
  }
};
/** draw a texture function into a canvas and wrap it as a repeating, crisp three.js texture */
function bake(fn, w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y), i = (y * w + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const lambert = (map, extra) => new THREE.MeshLambertNodeMaterial(Object.assign({ map }, extra));
const MAT = {
  brick: lambert(bake(TEX.brick, 16, 16)),
  pillar: lambert(bake(TEX.pillar, 16, 16)),
  top: lambert(bake(TEX.top, 16, 16)),
  crate: lambert(bake(TEX.crate, 12, 12)),
  bracket: new THREE.MeshLambertNodeMaterial({ color: '#3a2e2a' }),
  flame: new THREE.MeshBasicNodeMaterial({ color: '#ffc040', fog: false }),
  flameCore: new THREE.MeshBasicNodeMaterial({ color: '#fff6d0', fog: false }),
  shadowBlob: new THREE.MeshBasicNodeMaterial({ color: '#000000', transparent: true, opacity: .35, depthWrite: false })
};
// (the floor's material is made with the room in 20-world, since its texture covers the whole room)

/* the puppets' toon look: three bands of light (shadow, base, lit), like our tones; one material per color */
const TOON_BANDS = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 3, 1);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();
const _toon = new Map();
function toonMat(hex, glow) {
  const key = hex + (glow ? ':glow' : '');
  if (!_toon.has(key)) _toon.set(key, glow ? new THREE.MeshBasicNodeMaterial({ color: hex }) : new THREE.MeshToonNodeMaterial({ color: hex, gradientMap: TOON_BANDS }));
  return _toon.get(key);
}

/* outlines: an inverted hull. The same mesh again, back faces only, each vertex pushed OUTLINE_PX pixels outward on the
 * screen (along its normal for round parts, away from the part's centre for boxes), in the engine's outline color */
const OUTLINE_PX = uniform(new THREE.Vector2(2 / LINES, 2 / LINES));   // clip-space size of the push (x, y), set per frame
const _outline = {};
function outlineMat(mode = 'normal') {
  if (_outline[mode]) return _outline[mode];
  const m = new THREE.MeshBasicNodeMaterial({ color: OUTLINE, side: THREE.BackSide, fog: false });
  m.vertexNode = Fn(() => {
    const mvp = cameraProjectionMatrix.mul(modelViewMatrix);
    const pos = mvp.mul(vec4(positionLocal, 1));
    const out = mode === 'center' ? positionLocal : normalLocal;
    const pos2 = mvp.mul(vec4(positionLocal.add(out.normalize().mul(.01)), 1));
    const dir = pos2.xy.div(pos2.w).sub(pos.xy.div(pos.w)).normalize();
    return vec4(pos.xy.add(dir.mul(OUTLINE_PX).mul(pos.w)), pos.z, pos.w);
  })();
  return (_outline[mode] = m);
}
