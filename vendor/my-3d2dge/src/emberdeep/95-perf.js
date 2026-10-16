/* =============================================================================
 * PERFORMANCE GOVERNOR: keeps the game fluid on slower machines. When the frame rate stays low it drops the
 * outlines on ordinary monsters, caps particles and lets glows draw over what stands in front of them (the renderer's
 * glow mask, canvas lighting only); when there is headroom again it brings them back.
 * PERF.low is read by drawFoe (30-monsters-core.js). Settings > Graphics > Particles still sets the ceiling, and its
 * Automatic quality turns the governor off.
 * It samples on the wall clock (slow motion, perfect dodges and 3x bot runs must not skew it): low after 3 s under
 * 45 fps, back after `need` samples at 57+. A machine that drops straight back (within 25 s) waits twice as long next
 * time, so a borderline one settles instead of flickering its outlines on and off. ED.perf exposes it for tools.
 * ============================================================================= */
const PERF = { low: false, bad: 0, good: 0, t: 0, need: 20, since: -99, n: 0 };
ED.perf = PERF;
/** full quality again at once (Settings > Graphics > Automatic quality turned off) */
function perfRestore() { if (!PERF.low) return; PERF.low = false; PERF.bad = 0; P.max = [500, 1000, 1600][OPT.fx === undefined ? 2 : OPT.fx]; game.r.glowMask = true; }
BUS.on('step', () => {
  if (OPT.autoQuality === false) return;   // the player keeps full quality whatever the frame rate
  const now = wallClock(); if (now - PERF.t < .5) return; PERF.t = now;
  const fps = game.fps, cap = [500, 1000, 1600][OPT.fx === undefined ? 2 : OPT.fx];
  if (!PERF.low) {
    PERF.bad = fps < 45 ? PERF.bad + 1 : 0;
    if (PERF.bad >= 6) { PERF.low = true; PERF.good = 0; PERF.n++; P.max = Math.min(cap, 700); game.r.glowMask = false; if (now - PERF.since < 25) PERF.need = Math.min(160, PERF.need * 2); }
  } else { PERF.good = fps >= 57 ? PERF.good + 1 : 0; if (PERF.good >= PERF.need) { PERF.low = false; PERF.bad = 0; P.max = cap; game.r.glowMask = true; PERF.since = now; } }
});
