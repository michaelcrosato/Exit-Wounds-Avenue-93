/* =============================================================================
 * SOUND: extra effects and the game's songs (chip synth, no files). Themes pick a song by name: REG.songs[id]
 * (falling back to the engine's built-in songs: title, adventure, dungeon, boss, victory).
 * ============================================================================= */
A.define('zap', [{ wave: 'saw', freq: 1800, to: 300, dur: .12, vol: .16 }, { wave: 'noise', freq: 4000, to: 1200, dur: .1, vol: .18, filter: 'highpass' }]);
A.define('freeze', [{ wave: 'triangle', freq: 1400, to: 2400, dur: .18, vol: .22 }, { wave: 'noise', freq: 6000, dur: .15, vol: .1, filter: 'highpass' }]);
A.define('portal', { wave: 'sine', freq: 180, to: 900, dur: .7, vol: .3, vib: [9, .08] });
A.define('clang', [{ wave: 'square', freq: 1250, to: 1150, dur: .16, vol: .14 }, { wave: 'triangle', freq: 2500, dur: .25, vol: .1 }, { wave: 'noise', freq: 3000, dur: .05, vol: .2 }]);
A.define('thud', [{ wave: 'sine', freq: 90, to: 40, dur: .2, vol: .55 }, { wave: 'noise', freq: 400, to: 100, dur: .12, vol: .3, filter: 'lowpass' }]);
A.define('crack', [{ wave: 'noise', freq: 2500, to: 800, dur: .15, vol: .35, filter: 'bandpass' }, { wave: 'square', freq: 300, to: 120, dur: .08, vol: .12 }]);
A.define('bloop', { wave: 'sine', freq: 300, to: 120, dur: .12, vol: .3 });
A.define('roar', [{ wave: 'saw', freq: 110, to: 70, dur: .8, vol: .2, vib: [14, .12] }, { wave: 'noise', freq: 600, to: 200, dur: .8, vol: .25, filter: 'lowpass' }]);
A.define('chime', { wave: 'triangle', freq: 1320, arp: [0, 7, 12], step: .06, dur: .4, vol: .2 });
A.define('slash2', { wave: 'noise', freq: 3200, to: 900, dur: .1, vol: .22 });

/* stings: a short phrase over the music when a depth begins (a low bell and a falling minor arpeggio: down we go) and
 * when a boss wakes (a brass stab, a timpani hit and a rising cry). Both are ordinary sfx, so the sfx volume governs them */
A.define('stingDepth', [{ wave: 'triangle', freq: 'A4', arp: [0, -5, -9, -12], step: .11, dur: .5, vol: .16 }, { wave: 'sine', freq: 110, to: 104, dur: .9, vol: .22, vib: [5, .01] }, { wave: 'triangle', freq: 220, dur: .6, vol: .08 }]);
A.define('stingBoss', [{ wave: 'saw', freq: 'D3', dur: .5, vol: .1, vib: [6, .02] }, { wave: 'square', freq: 'A3', dur: .5, vol: .05 }, { wave: 'saw', freq: 'D4', to: 'F4', dur: .45, vol: .06 }, { wave: 'sine', freq: 70, to: 44, dur: .5, vol: .45 }, { wave: 'noise', freq: 900, to: 200, dur: .35, vol: .18, filter: 'lowpass' }]);
BUS.on('levelStart', e => { if (e.L && e.L.depth) game.after(.35, () => sfx('stingDepth')); });   // after the fade-in, before the drop-in thud
BUS.on('bossWake', () => sfx('stingBoss'));

/* songs: steps are sixteenth notes; every track loops on its own length, so each track's length must divide the song's
 * (an 8-step arpeggio under 16-step bars drifts a half bar and clashes: every chord below is written out for its bar) */
def('songs', 'town', { bpm: 88, steps: 4, tracks: [
  { wave: 'pulse', vol: .1, notes: 'D5 - - - F#5 - A5 - G5 - F#5 - E5 - - - | D5 - - - B4 - D5 - E5 - - - - - . . | F#5 - - - A5 - D6 - B5 - A5 - B5 - - - | A5 - G5 - F#5 - E5 - D5 - - - - - . .' },
  { wave: 'triangle', vol: .28, notes: 'D3 - . . A2 - . . D3 - . . A2 - . . | B2 - . . F#2 - . . B2 - . . F#2 - . . | G2 - . . D3 - . . G2 - . . D3 - . . | A2 - . . E3 - . . A2 - . . C#3 - . .' },
  { wave: 'square', vol: .04, notes: 'F#4 A4 D5 A4 F#4 A4 D5 A4 F#4 A4 D5 A4 F#4 A4 D5 A4 | D4 F#4 B4 F#4 D4 F#4 B4 F#4 D4 F#4 B4 F#4 D4 F#4 B4 F#4 | D4 G4 B4 G4 D4 G4 B4 G4 D4 G4 B4 G4 D4 G4 B4 G4 | C#4 E4 A4 E4 C#4 E4 A4 E4 C#4 E4 A4 E4 C#4 E4 A4 E4' },
  { wave: 'drums', vol: .06, notes: 'k . . . h . . . s . . . h . h .' } ] });
def('songs', 'deep', { bpm: 80, steps: 4, tracks: [
  { wave: 'pulse12', vol: .1, notes: 'A4 - - - - - C5 - B4 - - - E4 - - - | . . . . F4 - - - E4 - D4 - E4 - - - | A4 - - - - - C5 - D5 - - - E5 - - - | F5 - E5 - D5 - C5 - B4 - - - - - . .' },
  { wave: 'triangle', vol: .3, notes: 'A2 - - - A2 - - - A2 - - - A2 - . . | F2 - - - F2 - - - E2 - - - E2 - . . | A2 - - - A2 - - - G2 - - - G2 - . . | F2 - - - F2 - - - E2 - - - E2 - . .' },
  { wave: 'saw', vol: .025, notes: 'E4 - - - - - - - - - - - - - - - | C4 - - - - - - - B3 - - - - - - - | E4 - - - - - - - D4 - - - - - - - | C4 - - - - - - - B3 - - - - - - -' },
  { wave: 'drums', vol: .09, notes: 'k . . . . . h . k . k . . . h . | k . . . . . h . k . . . t . t t' } ] });
def('songs', 'deep2', { bpm: 104, steps: 4, tracks: [
  { wave: 'square', vol: .07, notes: 'E5 - . E5 G5 - E5 - D5 - . D5 B4 - . . | C5 - . C5 E5 - C5 - B4 - A4 - B4 - . . | E5 - . E5 G5 - A5 - B5 - A5 - G5 - E5 - | F5 - E5 - D5 - C5 - B4 - - - - - . .' },
  { wave: 'triangle', vol: .3, notes: 'E2 E3 . E2 E2 E3 . E2 G2 G3 . G2 G2 G3 . G2 | A2 A3 . A2 A2 A3 . A2 B2 B3 . B2 B2 B3 . B2' },
  { wave: 'drums', vol: .12, notes: 'k . h . s . h k k . h . s . h h' } ] });
def('songs', 'title', { bpm: 70, steps: 4, tracks: [
  { wave: 'pulse', vol: .09, notes: 'A4 - - - - - - - E5 - - - - - D5 - | C5 - - - - - B4 - A4 - - - - - - - | F4 - - - - - - - C5 - - - - - B4 - | A4 - - - G#4 - - - A4 - - - - - - -' },
  { wave: 'triangle', vol: .3, notes: 'A2 - - - - - - - A2 - - - - - - - | F2 - - - - - - - F2 - - - - - - - | D2 - - - - - - - D2 - - - - - - - | E2 - - - - - - - E2 - - - - - - -' },
  { wave: 'square', vol: .03, notes: 'A3 C4 E4 A4 E4 C4 A3 C4 A3 C4 E4 A4 E4 C4 A3 C4 | F3 A3 C4 F4 C4 A3 F3 A3 F3 A3 C4 F4 C4 A3 F3 A3 | D3 F3 A3 D4 A3 F3 D3 F3 D3 F3 A3 D4 A3 F3 D3 F3 | E3 G#3 B3 E4 B3 G#3 E3 G#3 E3 G#3 B3 E4 B3 G#3 E3 G#3' } ] });
/** play a song by name: the game's own first, then the engine's */
function playSong(id) { const s = REG.songs[id]; A.music(s || (E.songs[id] ? id : 'dungeon')); }
