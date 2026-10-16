/* =============================================================================
 * THE LOOP: each display frame steps the game (20-sim) in equal steps no longer than STEP (one at 60 Hz or more, two
 * at 30 fps: the physics and the rigs never take a step longer than a sixtieth), then draws one picture. The panel's
 * numbers time the three parts: physics (Rapier's world step), game logic (the rest of the steps: AI, combat, the
 * rigs' animation, particles) and drawing (on the CPU: posing the instanced batches, drawing the cards, three.js's
 * render call; what the GPU does after is in the frame time, not here).
 *   resolution   pixels (the 2D page's own pixel size: the picture at 200 to 330 lines, enlarged with whole pixels),
 *                balanced (half the screen's resolution) or full (the screen's); P cycles them; ?res=pixels|balanced|full
 *   look         Card or Puppet (30-crowd), C switches; ?look=card|puppet
 *   warm-up      the first frame (and the first after a filter change) also draws everything once, empty, so every
 *                shader and pipeline is built before the fight needs it (a new one mid-fight stalls a frame)
 * ============================================================================= */
const RES = ['pixels', 'balanced', 'full'];
const R3 = { look: ['card', 'puppet'].includes(QS.get('look')) ? QS.get('look') : 'card', res: RES.includes(QS.get('res')) ? QS.get('res') : QS.get('pixels') === '0' ? 'full' : 'pixels' };
const SCR = { W: 1, H: 1, S: 1, rw: 1, rh: 1, key: '' };   // W x H: the picture in engine pixels (S screen pixels each); rw x rh: what three.js draws
/** the picture's size: the engine's pixels as the 2D page picks them (a whole number of screen pixels each, 330 lines at
 *  most), half the screen's resolution or all of it; the overlay (text) always at the engine's pixels */
function fit() {
  const st = $('stage'), dpr = Math.min(3, devicePixelRatio || 1), cw = st.clientWidth, ch = st.clientHeight, pw = Math.max(1, Math.round(cw * dpr)), ph = Math.max(1, Math.round(ch * dpr));
  const key = [pw, ph, R3.res].join(','); if (key === SCR.key) return; SCR.key = key;
  const S = Math.max(1, Math.ceil(ph / 330)), W = Math.max(1, Math.round(pw / S)), H = Math.max(1, Math.round(ph / S));
  const rw = R3.res === 'pixels' ? W : R3.res === 'balanced' ? Math.round(pw / 2) : pw, rh = R3.res === 'pixels' ? H : R3.res === 'balanced' ? Math.round(ph / 2) : ph;
  Object.assign(SCR, { W, H, S, rw, rh, dpr });
  renderer.setPixelRatio(1); renderer.setSize(rw, rh, false);
  over.width = W; over.height = H;
  for (const c of [canvas3d, over]) { c.style.width = cw + 'px'; c.style.height = ch + 'px'; }
  canvas3d.classList.toggle('pixels', R3.res !== 'full');
}
let warmed = false;
/** draw one picture with every batch, atlas page, prop, trail and floor shape in it (empty, scaled to nothing), so each
 *  material builds its shader and GPU pipelines now, shadow passes too */
function warmUp(cam, view) {
  ARCS.prepare(8); RINGS.prepare(12); RIBBONS.prepare(6); ATLAS.prepare(view, 2);
  const Z = new THREE.Matrix4().makeScale(0, 0, 0), inst = [PROP_MESH.crate, PROP_MESH.barrel], pools = [...ARCS.list, ...RINGS.list, ...RIBBONS.list];
  for (const b of [...Object.values(BATCH), ...Object.values(PART)]) { inst.push(b.mesh); if (b.shell) inst.push(b.shell); }
  for (const pg of ATLAS.pages) inst.push(pg.mesh);
  const counts = inst.map(m => m.count);
  for (const m of inst) { m.setMatrixAt(0, Z); m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.needsUpdate = true; m.count = 1; }
  for (const m of pools) m.visible = true;
  const shadows = shadowLights.map(L => [L.castShadow, L.intensity]);
  shadowLights.forEach(L => { L.castShadow = true; L.intensity = Math.max(L.intensity, .001); });
  renderFrame(cam);
  shadowLights.forEach((L, i) => { L.castShadow = shadows[i][0]; L.intensity = shadows[i][1]; });
  inst.forEach((m, i) => { m.count = counts[i]; });
  for (const m of pools) m.visible = false;
  warmed = true;
}
const STATS = { drawn: 0, culled: 0, calls: 0, tris: 0, frames: 0, scale: 1, bodies: 0, props: 0, lights: 0, physics: 0, logic: 0, draw: 0, steps: 0 };
const FOG = scene.fog;
/** one picture of the game as it stands */
function drawFrame(dt) {
  fit();
  const pose = cameraPose(dt), cam = placeCamera(pose, SCR.rw, SCR.rh);
  // the fog starts a little past the hero, however far the camera is (an orthographic one stands far back)
  scene.fog = S.fog ? FOG : null;
  const dH = Math.hypot(cam.position.x - hero.x / U, cam.position.y - hero.z / U, cam.position.z - hero.y / U); FOG.near = dH + 12; FOG.far = dH + 70;
  placeCut();
  let lights = lightHall(SIM.real, S.lights, S.torchLights, S.shadows, hero.x, hero.y);
  animateBraziers(S.lights, dt);
  const h = hero; heroLight.position.set(h.x / U, (h.z + 40) / U, h.y / U); heroLight.intensity = S.torchLights && !h.dead ? LIGHT.hero : 0; if (heroLight.intensity) lights++;
  // the wisps nearest the hero carry lights when the panel says so (up to 4)
  const wisps = S.monsterLights ? enemies.filter(e => e.type === 'wisp' && e.alive).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y)) : [];
  wispLights.forEach((L, i) => { const e = wisps[i]; L.intensity = e ? LIGHT.wisp : 0; if (e) { L.position.set(e.x / U, e.z / U, e.y / U); lights++; } });
  const view = cardView();
  renderer.info.reset();
  if (!warmed) warmUp(cam, view);
  const first = CAM.mode === 'first', crowd = drawCrowd({ view, vis: visible, look: R3.look, outlines: S.outlines, v: CV, hideHero: first, near: first ? [hero.x, hero.y, 12] : null });
  VISIBLE = SEEN;
  STATS.props = drawProps(visible);
  lights += drawEffects(CV, { hideHero: first });
  renderFrame(cam);
  drawOverlay((x, y, z) => project(x, y, z, SCR.W, SCR.H), SCR.W, SCR.H, CAM.mode === 'first' || (CAM.locked && CAM.mode === 'chase'));
  const info = renderer.info.render;
  Object.assign(STATS, { drawn: crowd.drawn, culled: crowd.culled, calls: info.drawCalls, tris: info.triangles, scale: CV.scale, lights, bodies: SIM.world.bodies.len() });
  STATS.frames++;
}

/* ---- the loop ---- */
let lastT = performance.now();
function tick(now) {
  requestAnimationFrame(tick);   // (scheduled first, so an error never stops the loop)
  const dt = Math.min(.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
  const steps = Math.max(1, Math.ceil(dt / STEP - 1e-6)), h = dt / steps;
  SIM.ms.logic = SIM.ms.physics = 0;
  try { for (let i = 0; i < steps; i++) { INPUT.tick(h); SIM.step(h, controls()); } } catch (e) { fail(e); return; }
  const t1 = performance.now();
  try { drawFrame(dt); } catch (e) { fail(e); return; }
  STATS.physics = SIM.ms.physics; STATS.logic = SIM.ms.logic; STATS.draw = performance.now() - t1; STATS.steps = steps;
  hud();
}
