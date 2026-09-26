import type { SongDef } from './sequencer';

/**
 * Original compositions for this remake (written for this project; no melodies are
 * taken from the commercial games). Notation is documented in sequencer.ts.
 * Every track is a whole number of 16-step bars; tests/unit/songs.test.ts checks it.
 */

const DRUM_BEAT = 'k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2';
const DRUM_FILL = 'k:2 h:2 s:2 h:2 k:2 s:1 s:1 t:2 m:1 f:1';
const ROCK_BEAT = 'k:2 h:2 s:2 h:1 k:1 k:2 h:2 s:2 h:2';
const ROCK_FILL = 'k:2 h:2 s:2 h:1 k:1 s:1 s:1 s:1 s:1 t:1 t:1 m:1 f:1';

// ------------------------------------------------------------------ TITLE (C major)
const title: SongDef = {
  bpm: 150,
  loop: true,
  tracks: [
    {
      inst: 'lead',
      vol: 0.32,
      pan: 0.1,
      data: `
        C5:2 E5:2 G5:2 C6:4 G5:2 E5:2 G5:2 | A5:4 G5:2 E5:2 F5:4 E5:2 D5:2 |
        C5:2 E5:2 G5:2 C6:4 G5:2 A5:2 B5:2 | C6:6 B5:2 A5:2 G5:2 E5:2 D5:2 |
        F5:2 A5:2 C6:2 F6:4 C6:2 A5:2 C6:2 | B5:4 A5:2 G5:2 E5:4 G5:4 |
        A5:2 G5:2 F5:2 E5:2 D5:2 E5:2 F5:2 D5:2 | C5:8 r:4 G4:2 B4:2 |
        A5:3 G5:1 A5:2 C6:2 B5:2 A5:2 E5:4 | F5:3 E5:1 F5:2 A5:2 G5:2 F5:2 C5:4 |
        D5:2 G5:2 B5:2 D6:4 C6:2 B5:2 G5:2 | E6:4 D6:2 C6:2 G5:8 |
        A5:3 G5:1 A5:2 C6:2 E6:4 D6:2 C6:2 | F6:4 E6:2 D6:2 C6:2 A5:2 F5:4 |
        D6:2 C6:2 B5:2 A5:2 G5:2 F5:2 E5:2 D5:2 | C5:4 G4:2 C5:2 E5:2 G5:2 C6:4`,
    },
    {
      inst: 'pulse',
      vol: 0.13,
      pan: -0.35,
      data: `
        [r:2 E4+G4:2]4 | [r:2 E4+A4:2]2 [r:2 F4+A4:2]2 | [r:2 E4+G4:2]4 | [r:2 E4+G4:2]2 [r:2 D4+G4:2]2 |
        [r:2 F4+A4:2]4 | [r:2 D4+G4:2]2 [r:2 E4+G4:2]2 | [r:2 D4+F4:2]2 [r:2 D4+G4:2]2 | [r:2 E4+G4:2]4 |
        A3+C4+E4:16 | F3+A3+C4:16 | G3+B3+D4:16 | G3+C4+E4:16 |
        A3+C4+E4:16 | F3+A3+C4:16 | D4+F4+A4:8 G3+B3+D4:8 | G3+C4+E4:16`,
    },
    {
      inst: 'bass',
      vol: 0.42,
      data: `
        C3:2 C4:2 C3:2 C4:2 C3:2 C4:2 G2:2 G3:2 | A2:2 A3:2 A2:2 A3:2 F2:2 F3:2 F2:2 F3:2 |
        C3:2 C4:2 C3:2 C4:2 E3:2 E4:2 G2:2 G3:2 | C3:2 C4:2 C3:2 C4:2 G2:2 G3:2 G2:2 G3:2 |
        F2:2 F3:2 F2:2 F3:2 F2:2 F3:2 A2:2 A3:2 | G2:2 G3:2 G2:2 G3:2 E2:2 E3:2 E2:2 E3:2 |
        D3:2 D4:2 D3:2 D4:2 G2:2 G3:2 G2:2 G3:2 | C3:2 C4:2 G2:2 G3:2 C3:4 G2:4 |
        A2:2 A3:2 E3:2 A3:2 A2:2 A3:2 E3:2 A3:2 | F2:2 F3:2 C3:2 F3:2 F2:2 F3:2 C3:2 F3:2 |
        G2:2 G3:2 D3:2 G3:2 G2:2 G3:2 D3:2 G3:2 | C3:2 C4:2 G3:2 C4:2 C3:2 C4:2 G2:2 B2:2 |
        A2:2 A3:2 E3:2 A3:2 A2:2 A3:2 E3:2 A3:2 | F2:2 F3:2 C3:2 F3:2 F2:2 F3:2 C3:2 F3:2 |
        D3:2 D4:2 A2:2 D3:2 G2:2 G3:2 D3:2 G3:2 | C3:2 C4:2 G2:2 C3:2 C3:2 E3:2 G3:2 B3:2`,
    },
    {
      inst: 'kick',
      vol: 0.5,
      data: `[${DRUM_BEAT}]7 ${DRUM_FILL} | [${DRUM_BEAT}]7 ${DRUM_FILL}`,
    },
  ],
};

// ------------------------------------------------------------------ STAGE (G major, bouncy)
const stage: SongDef = {
  bpm: 138,
  loop: true,
  tracks: [
    {
      inst: 'lead',
      vol: 0.3,
      pan: 0.12,
      data: `
        G4:2 r:1 G4:1 B4:2 D5:2 G5:2 D5:2 B4:2 D5:2 | C5:2 B4:2 A4:2 G4:2 A4:4 r:4 |
        E5:2 r:1 E5:1 G5:2 E5:2 C5:2 E5:2 G5:2 E5:2 | F#5:4 E5:2 D5:2 A4:4 r:4 |
        G4:2 r:1 G4:1 B4:2 D5:2 G5:2 A5:2 B5:2 G5:2 | E5:4 G5:2 E5:2 B4:4 r:4 |
        C5:2 E5:2 G5:2 E5:2 D5:2 F#5:2 A5:2 F#5:2 | G5:6 D5:2 B4:2 G4:2 r:4 |
        B4:2 E5:2 G5:2 B5:4 A5:2 G5:2 E5:2 | C5:2 E5:2 G5:2 C6:4 B5:2 A5:2 G5:2 |
        A5:3 G5:1 F#5:2 E5:2 D5:4 F#5:4 | G5:4 D5:2 B4:2 G4:4 r:4 |
        B4:2 E5:2 G5:2 B5:4 C6:2 B5:2 G5:2 | E5:2 G5:2 C6:2 E6:4 D6:2 C6:2 G5:2 |
        A5:2 C6:2 B5:2 A5:2 F#5:2 A5:2 D6:2 C6:2 | B5:4 G5:2 D5:2 G5:4 r:4`,
    },
    {
      inst: 'pluck',
      vol: 0.16,
      pan: -0.3,
      data: `
        [r:2 B3+D4:2]4 | [r:2 B3+D4:2]4 | [r:2 C4+E4:2]4 | [r:2 D4+F#4:2]4 |
        [r:2 B3+D4:2]4 | [r:2 B3+E4:2]4 | [r:2 C4+E4:2]2 [r:2 D4+F#4:2]2 | [r:2 B3+D4:2]4 |
        [r:2 B3+E4:2]4 | [r:2 C4+E4:2]4 | [r:2 D4+F#4:2]4 | [r:2 B3+D4:2]4 |
        [r:2 B3+E4:2]4 | [r:2 C4+E4:2]4 | [r:2 C4+E4:2]2 [r:2 D4+F#4:2]2 | [r:2 B3+D4:2]4`,
    },
    {
      inst: 'slap',
      vol: 0.4,
      data: `
        G2:2 r:2 G3:2 G2:2 D3:2 r:2 G3:2 D3:2 | G2:2 r:2 G3:2 G2:2 B2:2 r:2 D3:2 B2:2 |
        C3:2 r:2 C4:2 C3:2 G2:2 r:2 C3:2 G2:2 | D3:2 r:2 D4:2 D3:2 A2:2 r:2 D3:2 F#3:2 |
        G2:2 r:2 G3:2 G2:2 D3:2 r:2 G3:2 D3:2 | E2:2 r:2 E3:2 E2:2 B2:2 r:2 E3:2 B2:2 |
        C3:2 r:2 C4:2 C3:2 D3:2 r:2 D4:2 D3:2 | G2:2 r:2 G3:2 G2:2 D3:2 D3:2 G2:4 |
        E2:2 r:2 E3:2 E2:2 B2:2 r:2 E3:2 B2:2 | C3:2 r:2 C4:2 C3:2 G2:2 r:2 C3:2 G2:2 |
        D3:2 r:2 D4:2 D3:2 A2:2 r:2 D3:2 A2:2 | G2:2 r:2 G3:2 G2:2 D3:2 r:2 G3:2 D3:2 |
        E2:2 r:2 E3:2 E2:2 B2:2 r:2 E3:2 B2:2 | C3:2 r:2 C4:2 C3:2 G2:2 r:2 C3:2 G2:2 |
        A2:2 r:2 A3:2 A2:2 D3:2 r:2 D4:2 D3:2 | G2:2 r:2 G3:2 G2:2 D3:2 F#3:2 G3:4`,
    },
    {
      inst: 'kick',
      vol: 0.45,
      data: `[${DRUM_BEAT}]7 ${DRUM_FILL} | [${DRUM_BEAT}]7 ${DRUM_FILL}`,
    },
  ],
};

// ------------------------------------------------------------------ BATTLE (D minor, driving)
const battle: SongDef = {
  bpm: 160,
  loop: true,
  tracks: [
    {
      inst: 'lead',
      vol: 0.3,
      pan: 0.1,
      data: `
        D5:2 r:1 D5:1 F5:2 A5:2 D6:3 C6:1 A5:2 F5:2 | G5:2 F5:2 E5:2 D5:2 E5:2 F5:2 E5:4 |
        D5:2 r:1 D5:1 F5:2 Bb5:2 D6:3 C6:1 Bb5:2 F5:2 | E5:2 F5:2 G5:2 E5:2 C5:4 r:4 |
        D5:2 r:1 D5:1 F5:2 A5:2 D6:3 C6:1 A5:2 F5:2 | A5:2 G5:2 F5:2 E5:2 F5:2 G5:2 A5:4 |
        Bb5:4 A5:2 G5:2 F5:2 G5:2 A5:2 Bb5:2 | A5:4 C#6:4 E6:4 r:4 |
        F5:2 Bb5:2 D6:2 F6:4 D6:2 Bb5:2 F5:2 | E5:2 G5:2 C6:2 E6:4 C6:2 G5:2 E5:2 |
        F5:2 A5:2 D6:2 F6:4 E6:2 D6:2 A5:2 | D6:6 C6:2 A5:2 F5:2 D5:4 |
        D6:3 C6:1 Bb5:2 A5:2 Bb5:2 C6:2 D6:4 | E6:3 D6:1 C6:2 Bb5:2 C6:2 D6:2 E6:4 |
        F6:2 E6:2 D6:2 C#6:2 Bb5:2 A5:2 G5:2 E5:2 | A5:8 C#6:4 E6:4`,
    },
    {
      inst: 'brass',
      vol: 0.16,
      pan: -0.3,
      data: `
        [F4+A4:3 r:1 F4+A4:2 r:2 r:8]2 | [F4+Bb4:3 r:1 F4+Bb4:2 r:2 r:8] [E4+G4:3 r:1 E4+G4:2 r:2 r:8] |
        [F4+A4:3 r:1 F4+A4:2 r:2 r:8]2 | [F4+Bb4:3 r:1 F4+Bb4:2 r:2 r:8] [E4+A4:3 r:1 C#4+E4:2 r:2 r:8] |
        F4+Bb4:8 D4+F4:8 | E4+G4:8 C4+E4:8 | F4+A4:8 D4+F4:8 | F4+A4:16 |
        F4+Bb4:8 D4+F4:8 | E4+G4:8 C4+G4:8 | E4+A4:8 C#4+E4:8 | E4+A4:16`,
    },
    {
      inst: 'bass',
      vol: 0.45,
      data: `
        [D3:2 D3:2 D4:2 D3:2]4 | [Bb2:2 Bb2:2 Bb3:2 Bb2:2]2 | [C3:2 C3:2 C4:2 C3:2]2 |
        [D3:2 D3:2 D4:2 D3:2]4 | [Bb2:2 Bb2:2 Bb3:2 Bb2:2]2 | [A2:2 A2:2 A3:2 A2:2]2 |
        [Bb2:2 Bb2:2 Bb3:2 Bb2:2]2 | [C3:2 C3:2 C4:2 C3:2]2 | [D3:2 D3:2 D4:2 D3:2]4 |
        [Bb2:2 Bb2:2 Bb3:2 Bb2:2]2 | [C3:2 C3:2 C4:2 C3:2]2 | [A2:2 A2:2 A3:2 A2:2]4`,
    },
    {
      inst: 'kick',
      vol: 0.5,
      data: `[${ROCK_BEAT}]7 ${ROCK_FILL} | [${ROCK_BEAT}]7 ${ROCK_FILL}`,
    },
  ],
};

// ------------------------------------------------------------------ SELECT / MENU (F major, relaxed)
const select: SongDef = {
  bpm: 120,
  loop: true,
  tracks: [
    {
      inst: 'flute',
      vol: 0.26,
      data: `
        A4:2 C5:2 F5:4 E5:2 D5:2 C5:4 | Bb4:2 D5:2 F5:4 E5:2 C5:2 G4:4 |
        A4:2 C5:2 F5:4 G5:2 A5:2 Bb5:4 | A5:4 G5:4 F5:8 |
        D5:2 F5:2 A5:4 G5:2 F5:2 D5:4 | C5:2 E5:2 G5:4 F5:2 E5:2 C5:4 |
        Bb4:2 D5:2 F5:4 E5:2 D5:2 C5:2 E5:2 | F5:12 r:4`,
    },
    {
      inst: 'pad',
      vol: 0.1,
      data: `F3+A3+C4:16 | Bb3+D4+F4:8 C4+E4+G4:8 | F3+A3+C4:16 | C4+E4+G4:8 F3+A3+C4:8 |
             D4+F4+A4:16 | C4+E4+G4:16 | Bb3+D4+F4:8 C4+E4+G4:8 | F3+A3+C4:16`,
    },
    {
      inst: 'bass',
      vol: 0.35,
      data: `[F2:4 C3:4 F3:4 C3:4] | Bb2:4 F3:4 C3:4 G3:4 | [F2:4 C3:4 F3:4 C3:4] | C3:4 G3:4 F2:4 C3:4 |
             D3:4 A3:4 D3:4 A2:4 | C3:4 G3:4 C3:4 G2:4 | Bb2:4 F3:4 C3:4 G3:4 | F2:4 C3:4 F3:8`,
    },
    { inst: 'kick', vol: 0.3, data: '[k:4 z:2 z:2 p:4 z:2 z:2]8' },
  ],
};

// ------------------------------------------------------------------ BONUS (fast, happy)
const bonus: SongDef = {
  bpm: 176,
  loop: true,
  tracks: [
    {
      inst: 'square',
      vol: 0.24,
      data: `
        C5:1 E5:1 G5:1 C6:1 E6:2 C6:2 G5:2 E5:2 C5:2 E5:2 | D5:1 F5:1 A5:1 D6:1 F6:2 D6:2 A5:2 F5:2 D5:2 F5:2 |
        E5:1 G5:1 B5:1 E6:1 G6:2 E6:2 B5:2 G5:2 E5:2 G5:2 | F5:2 E5:2 D5:2 C5:2 G5:4 G4:4 |
        C5:1 E5:1 G5:1 C6:1 E6:2 C6:2 G5:2 E5:2 C5:2 E5:2 | A5:1 C6:1 E6:1 A6:1 E6:2 C6:2 A5:2 E5:2 A5:2 C6:2 |
        F5:2 A5:2 C6:2 A5:2 G5:2 B5:2 D6:2 B5:2 | C6:4 G5:4 C5:8`,
    },
    {
      inst: 'bass',
      vol: 0.4,
      data: `[C3:2 C4:2]4 | [D3:2 D4:2]4 | [E3:2 E4:2]4 | F3:2 F4:2 F3:2 F4:2 G2:2 G3:2 G2:2 G3:2 |
             [C3:2 C4:2]4 | [A2:2 A3:2]4 | F2:2 F3:2 F2:2 F3:2 G2:2 G3:2 G2:2 G3:2 | C3:2 C4:2 G2:2 G3:2 C3:8`,
    },
    { inst: 'kick', vol: 0.45, data: '[k:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2]8' },
  ],
};

// ------------------------------------------------------------------ ENDING (warm, C major)
const ending: SongDef = {
  bpm: 108,
  loop: true,
  tracks: [
    {
      inst: 'flute',
      vol: 0.26,
      data: `
        E5:4 G5:4 C6:6 B5:2 | A5:4 G5:4 E5:8 | F5:4 A5:4 D6:6 C6:2 | B5:4 G5:4 D5:8 |
        E5:4 G5:4 C6:6 D6:2 | E6:4 D6:4 C6:4 A5:4 | F5:4 A5:4 G5:4 B5:4 | C6:16`,
    },
    {
      inst: 'pad',
      vol: 0.12,
      data: `C4+E4+G4:16 | A3+C4+E4:16 | D4+F4+A4:16 | G3+B3+D4:16 |
             C4+E4+G4:16 | A3+C4+E4:16 | F3+A3+C4:8 G3+B3+D4:8 | C4+E4+G4:16`,
    },
    {
      inst: 'bell',
      vol: 0.12,
      pan: 0.4,
      data: `[C6:4 G5:4 E5:4 G5:4] [A5:4 E5:4 C5:4 E5:4] [D6:4 A5:4 F5:4 A5:4] [B5:4 G5:4 D5:4 G5:4]
             [C6:4 G5:4 E5:4 G5:4] [A5:4 E5:4 C5:4 E5:4] [F5:4 C5:4 G5:4 D5:4] [C6:4 G5:4 E5:4 C5:4]`,
    },
    {
      inst: 'bass',
      vol: 0.35,
      data: `C3:8 G2:8 | A2:8 E2:8 | D3:8 A2:8 | G2:8 D3:8 | C3:8 G2:8 | A2:8 E2:8 | F2:8 G2:8 | C3:16`,
    },
  ],
};

// ------------------------------------------------------------------ JINGLES
const stageStart: SongDef = {
  bpm: 150,
  loop: false,
  tracks: [
    { inst: 'lead', vol: 0.32, data: 'G4:2 C5:2 E5:2 G5:2 E5:2 G5:2 C6:4 | B5:2 A5:2 G5:2 A5:2 C6:8' },
    { inst: 'pulse', vol: 0.14, data: 'E4+G4:4 r:4 E4+G4:4 r:4 | F4+A4:4 D4+G4:4 E4+G4:8' },
    { inst: 'bass', vol: 0.42, data: 'C3:4 G2:4 C3:4 E3:4 | F2:4 G2:4 C3:8' },
    { inst: 'kick', vol: 0.5, data: 'k:4 s:4 k:4 s:4 | k:2 s:2 s:2 s:2 c:8' },
  ],
};

const stageClear: SongDef = {
  bpm: 140,
  loop: false,
  tracks: [
    { inst: 'lead', vol: 0.32, data: 'G5:2 G5:2 G5:2 E5:2 C6:4 G5:4 | A5:2 B5:2 C6:2 D6:2 E6:4 D6:4 | C6:12 r:4' },
    { inst: 'pulse', vol: 0.14, data: 'E5:4 C5:4 E5:4 E5:4 | F5:4 F5:4 G5:4 B4:4 | E5+G5:12 r:4' },
    { inst: 'bass', vol: 0.42, data: 'C3:4 E3:4 G3:4 E3:4 | F3:4 A3:4 G3:4 B3:4 | C3:12 r:4' },
    { inst: 'kick', vol: 0.5, data: 'k:4 h:4 s:4 h:4 | k:4 h:4 s:2 s:2 s:2 s:2 | c+k:12 r:4' },
  ],
};

const death: SongDef = {
  bpm: 120,
  loop: false,
  tracks: [
    { inst: 'square', vol: 0.26, data: 'E5:2 D#5:2 D5:2 C#5:2 C5:4 B4:4 | A4:2 G#4:2 G4:2 F#4:2 F4:8' },
    { inst: 'bass', vol: 0.4, data: 'E3:8 D3:8 | C3:8 B2:8' },
  ],
};

const gameOver: SongDef = {
  bpm: 96,
  loop: false,
  tracks: [
    { inst: 'lead', vol: 0.28, data: 'A4:4 C5:4 E5:4 D5:4 | C5:4 B4:4 A4:8 | F4:4 A4:4 C5:4 B4:4 | A4:16' },
    { inst: 'pad', vol: 0.12, data: 'A3+C4+E4:16 | E3+G#3+B3:16 | F3+A3+C4:16 | A3+C4+E4:16' },
    { inst: 'bass', vol: 0.38, data: 'A2:16 | E2:16 | F2:16 | A2:16' },
  ],
};

const victory: SongDef = {
  bpm: 150,
  loop: false,
  tracks: [
    { inst: 'lead', vol: 0.3, data: 'G4:2 C5:2 E5:2 G5:4 E5:2 G5:4 | A5:2 G5:2 F5:2 E5:2 D5:4 G5:4 | C6:12 r:4' },
    { inst: 'brass', vol: 0.16, data: 'E4+G4:8 C4+E4:8 | F4+A4:8 D4+G4:8 | E4+G4+C5:12 r:4' },
    { inst: 'bass', vol: 0.4, data: 'C3:4 G2:4 C3:4 E3:4 | F2:4 A2:4 G2:4 B2:4 | C3:12 r:4' },
    { inst: 'kick', vol: 0.5, data: 'k:4 s:4 k:4 s:4 | k:4 s:4 k:2 s:2 s:2 s:2 | c+k:12 r:4' },
  ],
};

const champion: SongDef = {
  bpm: 132,
  loop: false,
  tracks: [
    {
      inst: 'lead',
      vol: 0.3,
      data: `C5:2 E5:2 G5:2 C6:6 B5:2 C6:2 | D6:4 C6:2 B5:2 A5:4 G5:4 |
             F5:2 A5:2 C6:2 F6:6 E6:2 D6:2 | E6:4 D6:4 C6:4 B5:4 |
             C6:2 E6:2 G6:4 E6:2 C6:2 G5:4 | C6:16`,
    },
    {
      inst: 'brass',
      vol: 0.15,
      data: `E4+G4:16 | F4+A4:8 D4+G4:8 | F4+A4:16 | G4+B4:8 F4+G4:8 | E4+G4:16 | E4+G4+C5:16`,
    },
    {
      inst: 'bass',
      vol: 0.4,
      data: `C3:4 G2:4 C3:4 G2:4 | F2:4 C3:4 G2:4 D3:4 | F2:4 C3:4 F2:4 C3:4 | G2:4 D3:4 G2:4 B2:4 | C3:4 G2:4 C3:4 E3:4 | C3:16`,
    },
    {
      inst: 'kick',
      vol: 0.5,
      data: `[k:2 h:2 s:2 h:2]2 | [k:2 h:2 s:2 h:2]2 | [k:2 h:2 s:2 h:2]2 | k:2 h:2 s:2 h:2 s:1 s:1 s:1 s:1 t:2 f:2 | [k:2 h:2 s:2 h:2]2 | c+k:16`,
    },
  ],
};

const draw: SongDef = {
  bpm: 110,
  loop: false,
  tracks: [
    { inst: 'square', vol: 0.24, data: 'G4:4 F#4:4 F4:4 E4:4 | D#4:4 D4:4 C#4:8' },
    { inst: 'bass', vol: 0.36, data: 'C3:8 B2:8 | Bb2:8 A2:8' },
  ],
};

const hurry: SongDef = {
  bpm: 180,
  loop: false,
  tracks: [
    { inst: 'square', vol: 0.26, data: '[B5:2 F#5:2]4 | [B5:2 F#5:2]4' },
    { inst: 'kick', vol: 0.45, data: '[k:2 s:2]8' },
  ],
};

export const SONGS: Record<string, SongDef> = {
  title,
  stage,
  battle,
  select,
  bonus,
  ending,
  stageStart,
  stageClear,
  death,
  gameOver,
  victory,
  champion,
  draw,
  hurry,
};
