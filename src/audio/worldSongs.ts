import { CLAP_BEAT, CLAP_FILL, MARCH_BEAT, MARCH_FILL, ROCK_BEAT, ROCK_FILL, SOFT_BEAT, SOFT_FILL, sixteenBars, TRIBAL_BEAT, TRIBAL_FILL } from './grooves';
import type { SongDef } from './sequencer';

/**
 * Normal Game themes for areas 2–5 (area 1 plays `stage`) and the Show Time skits.
 * Original compositions for this remake, like everything in songs.ts.
 */

// ------------------------------------------------------------------ AREA 2: toy box (F major, bouncy)
export const world2: SongDef = {
  bpm: 144,
  loop: true,
  tracks: [
    {
      inst: 'lead',
      vol: 0.3,
      pan: 0.12,
      data: `
        C5:2 F5:2 A5:2 F5:2 C6:4 A5:2 F5:2 | D5:2 F5:2 A5:2 D6:2 C6:2 A5:2 F5:4 |
        D5:2 F5:2 Bb5:3 A5:1 G5:2 F5:2 D5:4 | E5:2 G5:2 C6:4 Bb5:2 A5:2 G5:4 |
        C5:2 F5:2 A5:2 F5:2 C6:4 D6:2 C6:2 | A5:2 F5:2 D5:2 F5:2 A5:4 G5:2 F5:2 |
        G5:2 A5:2 Bb5:2 D6:2 C6:2 Bb5:2 G5:2 E5:2 | F5:6 E5:2 F5:2 r:6 |
        F5:3 F5:1 Bb5:2 D6:2 C6:2 Bb5:2 A5:2 G5:2 | E5:3 E5:1 G5:2 C6:2 Bb5:2 A5:2 G5:4 |
        E5:2 A5:2 C6:2 E6:2 D6:2 C6:2 A5:4 | F5:2 A5:2 D6:4 C6:2 A5:2 F5:4 |
        D6:2 C6:2 Bb5:2 A5:2 Bb5:2 C6:2 D6:4 | E6:2 D6:2 C6:2 Bb5:2 C6:2 D6:2 E6:4 |
        C#6:2 A5:2 E5:2 G5:2 A5:2 C#6:2 E6:4 | F6:4 D6:4 C6:4 G5:4`,
    },
    {
      inst: 'bell',
      vol: 0.1,
      pan: 0.45,
      data: `
        r:16 | r:8 A6:2 F6:2 D6:4 | r:16 | r:8 G6:2 E6:2 C6:4 |
        r:16 | r:8 A6:2 F6:2 D6:4 | r:16 | F6:2 C6:2 A5:2 F5:2 r:8 |
        r:8 F6:4 D6:4 | r:8 G6:4 E6:4 | r:8 E6:4 C6:4 | r:8 F6:4 D6:4 |
        r:8 F6:4 D6:4 | r:8 G6:4 E6:4 | r:8 E6:4 C#6:4 | r:16`,
    },
    {
      inst: 'pluck',
      vol: 0.15,
      pan: -0.3,
      data: `
        [r:2 A3+C4+F4:2]4 | [r:2 A3+D4+F4:2]4 | [r:2 Bb3+D4+F4:2]4 | [r:2 G3+C4+E4:2]4 |
        [r:2 A3+C4+F4:2]4 | [r:2 A3+D4+F4:2]4 | [r:2 G3+Bb3+F4:2]2 [r:2 G3+C4+E4:2]2 | [r:2 A3+C4+F4:2]4 |
        [r:2 Bb3+D4+F4:2]4 | [r:2 G3+C4+E4:2]4 | [r:2 A3+C4+E4:2]4 | [r:2 A3+D4+F4:2]4 |
        [r:2 Bb3+D4+F4:2]4 | [r:2 G3+C4+E4:2]4 | [r:2 G3+C#4+E4:2]4 | [r:2 A3+D4+F4:2]2 [r:2 G3+C4+E4:2]2`,
    },
    {
      inst: 'bass',
      vol: 0.4,
      data: `
        F2:2 r:2 C3:2 r:2 F3:2 r:2 C3:2 r:2 | D2:2 r:2 A2:2 r:2 D3:2 r:2 A2:2 r:2 |
        Bb2:2 r:2 F2:2 r:2 Bb2:2 r:2 D3:2 r:2 | C3:2 r:2 G2:2 r:2 C3:2 r:2 E3:2 r:2 |
        F2:2 r:2 C3:2 r:2 F3:2 r:2 C3:2 r:2 | D2:2 r:2 A2:2 r:2 D3:2 r:2 A2:2 r:2 |
        G2:2 r:2 D3:2 r:2 C3:2 r:2 G2:2 r:2 | F2:2 r:2 C3:2 r:2 F3:4 r:4 |
        Bb2:2 r:2 F2:2 r:2 Bb2:2 r:2 D3:2 r:2 | C3:2 r:2 G2:2 r:2 C3:2 r:2 E3:2 r:2 |
        A2:2 r:2 E3:2 r:2 A3:2 r:2 E3:2 r:2 | D2:2 r:2 A2:2 r:2 D3:2 r:2 A2:2 r:2 |
        Bb2:2 r:2 F2:2 r:2 Bb2:2 r:2 D3:2 r:2 | C3:2 r:2 G2:2 r:2 C3:2 r:2 E3:2 r:2 |
        A2:2 r:2 E3:2 r:2 G3:2 r:2 C#3:2 r:2 | D3:2 r:2 A2:2 r:2 C3:2 r:2 G2:2 r:2`,
    },
    { inst: 'kick', vol: 0.42, data: sixteenBars(CLAP_BEAT, CLAP_FILL) },
  ],
};

// ------------------------------------------------------------------ AREA 3: water (A minor, flowing)
export const world3: SongDef = {
  bpm: 124,
  loop: true,
  tracks: [
    {
      inst: 'flute',
      vol: 0.26,
      pan: 0.1,
      data: `
        E5:4 A5:4 C6:6 B5:2 | A5:4 F5:4 C5:8 | E5:4 G5:4 C6:4 D6:2 E6:2 | D6:6 B5:2 G5:8 |
        E5:4 A5:4 C6:6 E6:2 | F6:4 E6:2 D6:2 C6:4 A5:4 | D6:4 C6:2 A5:2 F5:4 A5:4 | G#5:8 B5:4 E5:4 |
        C6:3 A5:1 F5:4 A5:4 C6:4 | D6:3 B5:1 G5:4 B5:4 D6:4 | E6:6 D6:2 B5:4 G5:4 | A5:8 C6:4 E6:4 |
        F6:4 E6:2 D6:2 A5:4 D6:4 | B5:4 D6:2 G6:2 F6:4 D6:4 | E6:4 D6:2 C6:2 G5:4 C6:4 | B5:4 G#5:4 E5:4 D6:4`,
    },
    {
      inst: 'pluck',
      vol: 0.12,
      pan: -0.35,
      data: `
        [A3:1 E4:1 A4:1 C5:1 E5:1 C5:1 A4:1 E4:1]2 | [F3:1 C4:1 F4:1 A4:1 C5:1 A4:1 F4:1 C4:1]2 |
        [C4:1 G4:1 C5:1 E5:1 G5:1 E5:1 C5:1 G4:1]2 | [G3:1 D4:1 G4:1 B4:1 D5:1 B4:1 G4:1 D4:1]2 |
        [A3:1 E4:1 A4:1 C5:1 E5:1 C5:1 A4:1 E4:1]2 | [F3:1 C4:1 F4:1 A4:1 C5:1 A4:1 F4:1 C4:1]2 |
        [D4:1 A4:1 D5:1 F5:1 A5:1 F5:1 D5:1 A4:1]2 | [E3:1 B3:1 E4:1 G#4:1 B4:1 G#4:1 E4:1 B3:1]2 |
        [F3:1 C4:1 F4:1 A4:1 C5:1 A4:1 F4:1 C4:1]2 | [G3:1 D4:1 G4:1 B4:1 D5:1 B4:1 G4:1 D4:1]2 |
        [E3:1 B3:1 E4:1 G4:1 B4:1 G4:1 E4:1 B3:1]2 | [A3:1 E4:1 A4:1 C5:1 E5:1 C5:1 A4:1 E4:1]2 |
        [D4:1 A4:1 D5:1 F5:1 A5:1 F5:1 D5:1 A4:1]2 | [G3:1 D4:1 G4:1 B4:1 D5:1 B4:1 G4:1 D4:1]2 |
        [C4:1 G4:1 C5:1 E5:1 G5:1 E5:1 C5:1 G4:1]2 | [E3:1 B3:1 D4:1 G#4:1 B4:1 G#4:1 D4:1 B3:1]2`,
    },
    {
      inst: 'pad',
      vol: 0.09,
      data: `
        A3+C4+E4:16 | F3+A3+C4:16 | G3+C4+E4:16 | G3+B3+D4:16 | A3+C4+E4:16 | F3+A3+C4:16 | F3+A3+D4:16 | G#3+B3+E4:16 |
        F3+A3+C4:16 | G3+B3+D4:16 | G3+B3+E4:16 | A3+C4+E4:16 | F3+A3+D4:16 | G3+B3+D4:16 | G3+C4+E4:16 | G#3+B3+D4:16`,
    },
    {
      inst: 'bass',
      vol: 0.36,
      data: `
        A2:8 E2:8 | F2:8 C3:8 | C3:8 G2:8 | G2:8 D3:8 | A2:8 E2:8 | F2:8 C3:8 | D3:8 A2:8 | E2:8 B2:8 |
        F2:8 C3:8 | G2:8 D3:8 | E2:8 B2:8 | A2:8 E2:8 | D3:8 A2:8 | G2:8 D3:8 | C3:8 G2:8 | E2:8 D3:8`,
    },
    { inst: 'kick', vol: 0.34, data: sixteenBars(SOFT_BEAT, SOFT_FILL) },
  ],
};

// ------------------------------------------------------------------ AREA 4: treasure (E Phrygian, adventurous)
export const world4: SongDef = {
  bpm: 140,
  loop: true,
  tracks: [
    {
      inst: 'lead',
      vol: 0.31,
      pan: 0.1,
      data: `
        E5:2 F5:2 G#5:2 A5:2 B5:4 A5:2 G#5:2 | A5:2 G#5:2 F5:2 E5:2 F5:4 r:4 |
        E5:2 F5:2 G#5:2 B5:2 C6:4 B5:2 A5:2 | D6:2 B5:2 G5:2 B5:2 C6:2 A5:2 F5:4 |
        E6:4 D6:2 C6:2 B5:4 G#5:4 | A5:2 C6:2 B5:2 A5:2 G#5:2 A5:2 F5:4 |
        F5:2 A5:2 D6:4 C6:2 B5:2 A5:4 | G#5:4 F5:2 E5:8 r:2 |
        A5:2 C6:2 E6:4 D6:2 C6:2 B5:2 A5:2 | G5:2 B5:2 D6:4 C6:2 B5:2 A5:2 G5:2 |
        F5:2 A5:2 C6:4 B5:2 A5:2 G#5:2 F5:2 | G#5:4 B5:4 E6:8 |
        E6:3 D6:1 C6:2 B5:2 C6:3 B5:1 A5:4 | D6:3 C6:1 B5:2 A5:2 B5:3 A5:1 G5:4 |
        C6:3 B5:1 A5:2 G#5:2 A5:2 B5:2 C6:4 | B5:4 G#5:4 F5:4 E5:4`,
    },
    {
      inst: 'organ',
      vol: 0.14,
      pan: -0.3,
      data: `
        G#3+B3+E4:3 r:1 G#3+B3+E4:2 r:2 r:4 G#3+B3+E4:2 r:2 | A3+C4+F4:3 r:1 A3+C4+F4:2 r:2 r:4 A3+C4+F4:2 r:2 |
        G#3+B3+E4:3 r:1 G#3+B3+E4:2 r:2 r:4 G#3+B3+E4:2 r:2 | G3+B3+D4:3 r:1 G3+B3+D4:2 r:2 A3+C4+F4:3 r:1 A3+C4+F4:2 r:2 |
        G#3+B3+E4:3 r:1 G#3+B3+E4:2 r:2 r:4 G#3+B3+E4:2 r:2 | A3+C4+F4:3 r:1 A3+C4+F4:2 r:2 r:4 A3+C4+F4:2 r:2 |
        A3+D4+F4:3 r:1 A3+D4+F4:2 r:2 r:4 A3+D4+F4:2 r:2 | G#3+B3+E4:3 r:1 G#3+B3+E4:2 r:2 r:4 G#3+B3+E4:2 r:2 |
        A3+C4+E4:3 r:1 A3+C4+E4:2 r:2 r:4 A3+C4+E4:2 r:2 | G3+B3+D4:3 r:1 G3+B3+D4:2 r:2 r:4 G3+B3+D4:2 r:2 |
        A3+C4+F4:3 r:1 A3+C4+F4:2 r:2 r:4 A3+C4+F4:2 r:2 | G#3+B3+E4:3 r:1 G#3+B3+E4:2 r:2 r:4 G#3+B3+E4:2 r:2 |
        A3+C4+E4:3 r:1 A3+C4+E4:2 r:2 r:4 A3+C4+E4:2 r:2 | G3+B3+D4:3 r:1 G3+B3+D4:2 r:2 r:4 G3+B3+D4:2 r:2 |
        A3+C4+F4:3 r:1 A3+C4+F4:2 r:2 r:4 A3+C4+F4:2 r:2 | G#3+B3+E4:3 r:1 G#3+B3+E4:2 r:2 r:4 G#3+B3+E4:2 r:2`,
    },
    {
      inst: 'slap',
      vol: 0.48,
      data: `
        E2:2 E3:2 E2:2 F2:2 E2:2 E3:2 D3:2 C3:2 | F2:2 F3:2 F2:2 E2:2 F2:2 F3:2 C3:2 A2:2 |
        E2:2 E3:2 E2:2 F2:2 E2:2 E3:2 D3:2 C3:2 | G2:2 G3:2 G2:2 D3:2 F2:2 F3:2 F2:2 C3:2 |
        E2:2 E3:2 E2:2 F2:2 E2:2 E3:2 D3:2 C3:2 | F2:2 F3:2 F2:2 E2:2 F2:2 F3:2 C3:2 A2:2 |
        D2:2 D3:2 D2:2 A2:2 D2:2 D3:2 F3:2 A2:2 | E2:2 E3:2 E2:2 B2:2 E2:2 E3:2 F3:2 G#3:2 |
        A2:2 A3:2 A2:2 E3:2 A2:2 A3:2 G3:2 E3:2 | G2:2 G3:2 G2:2 D3:2 G2:2 G3:2 F3:2 D3:2 |
        F2:2 F3:2 F2:2 E2:2 F2:2 F3:2 C3:2 A2:2 | E2:2 E3:2 E2:2 B2:2 E2:2 E3:2 F3:2 G#3:2 |
        A2:2 A3:2 A2:2 E3:2 A2:2 A3:2 G3:2 E3:2 | G2:2 G3:2 G2:2 D3:2 G2:2 G3:2 F3:2 D3:2 |
        F2:2 F3:2 F2:2 E2:2 F2:2 F3:2 C3:2 A2:2 | E2:2 E3:2 E2:2 B2:2 E2:2 E3:2 F3:2 G#3:2`,
    },
    { inst: 'kick', vol: 0.5, data: sixteenBars(TRIBAL_BEAT, TRIBAL_FILL) },
  ],
};

// ------------------------------------------------------------------ AREA 5: candy fortress (Bb major, the home stretch)
export const world5: SongDef = {
  bpm: 156,
  loop: true,
  tracks: [
    {
      inst: 'lead',
      vol: 0.28,
      pan: 0.1,
      data: `
        F5:2 Bb5:2 D6:2 F6:4 D6:2 Bb5:2 D6:2 | G5:2 Bb5:2 D6:2 G6:4 F6:2 D6:2 Bb5:2 |
        Eb6:3 D6:1 C6:2 Bb5:2 G5:2 Bb5:2 Eb6:4 | D6:2 C6:2 A5:2 F5:2 C6:4 A5:4 |
        F5:2 Bb5:2 D6:2 F6:4 G6:2 F6:2 D6:2 | Bb6:4 A6:2 G6:2 D6:4 Bb5:4 |
        C6:2 Eb6:2 G6:2 Eb6:2 F6:2 Eb6:2 D6:2 C6:2 | Bb5:6 F5:2 Bb5:2 D6:2 F6:4 |
        G6:4 F6:2 Eb6:2 Bb5:4 G5:4 | A5:4 C6:2 F6:2 Eb6:4 C6:4 |
        D6:2 F6:2 A6:4 G6:2 F6:2 D6:4 | Bb5:4 D6:2 G6:2 F6:4 D6:4 |
        C6:2 Eb6:2 G6:4 F6:2 Eb6:2 C6:4 | A5:2 C6:2 F6:4 Eb6:2 C6:2 A5:4 |
        Bb5:4 Db6:4 C6:4 Eb6:4 | F6:8 Eb6:2 D6:2 C6:2 A5:2`,
    },
    {
      inst: 'brass',
      vol: 0.14,
      pan: -0.3,
      data: `
        D4+F4+Bb4:2 r:2 D4+F4+Bb4:2 r:4 D4+F4+Bb4:2 r:2 D4+F4+Bb4:2 | D4+G4+Bb4:2 r:2 D4+G4+Bb4:2 r:4 D4+G4+Bb4:2 r:2 D4+G4+Bb4:2 |
        Eb4+G4+Bb4:2 r:2 Eb4+G4+Bb4:2 r:4 Eb4+G4+Bb4:2 r:2 Eb4+G4+Bb4:2 | C4+F4+A4:2 r:2 C4+F4+A4:2 r:4 C4+F4+A4:2 r:2 C4+F4+A4:2 |
        D4+F4+Bb4:2 r:2 D4+F4+Bb4:2 r:4 D4+F4+Bb4:2 r:2 D4+F4+Bb4:2 | D4+G4+Bb4:2 r:2 D4+G4+Bb4:2 r:4 D4+G4+Bb4:2 r:2 D4+G4+Bb4:2 |
        C4+Eb4+G4:2 r:2 C4+Eb4+G4:2 r:2 C4+F4+A4:2 r:2 C4+F4+A4:2 r:2 | D4+F4+Bb4:2 r:2 D4+F4+Bb4:2 r:4 D4+F4+Bb4:2 r:2 D4+F4+Bb4:2 |
        Eb4+G4+Bb4:2 r:2 Eb4+G4+Bb4:2 r:4 Eb4+G4+Bb4:2 r:2 Eb4+G4+Bb4:2 | C4+F4+A4:2 r:2 C4+F4+A4:2 r:4 C4+F4+A4:2 r:2 C4+F4+A4:2 |
        D4+F4+A4:2 r:2 D4+F4+A4:2 r:4 D4+F4+A4:2 r:2 D4+F4+A4:2 | D4+G4+Bb4:2 r:2 D4+G4+Bb4:2 r:4 D4+G4+Bb4:2 r:2 D4+G4+Bb4:2 |
        C4+Eb4+G4:2 r:2 C4+Eb4+G4:2 r:4 C4+Eb4+G4:2 r:2 C4+Eb4+G4:2 | C4+F4+A4:2 r:2 C4+F4+A4:2 r:4 C4+F4+A4:2 r:2 C4+F4+A4:2 |
        Db4+Gb4+Bb4:2 r:2 Db4+Gb4+Bb4:2 r:2 C4+Eb4+Ab4:2 r:2 C4+Eb4+Ab4:2 r:2 | C4+F4+A4:8 Eb4+F4+A4:8`,
    },
    {
      inst: 'bass',
      vol: 0.44,
      data: `
        [Bb2:2 Bb3:2]4 | [G2:2 G3:2]4 | [Eb2:2 Eb3:2]4 | [F2:2 F3:2]4 |
        [Bb2:2 Bb3:2]4 | [G2:2 G3:2]4 | [C3:2 C4:2]2 [F2:2 F3:2]2 | [Bb2:2 Bb3:2]4 |
        [Eb2:2 Eb3:2]4 | [F2:2 F3:2]4 | [D2:2 D3:2]4 | [G2:2 G3:2]4 |
        [C3:2 C4:2]4 | [F2:2 F3:2]4 | [Gb2:2 Gb3:2]2 [Ab2:2 Ab3:2]2 | [F2:2 F3:2]4`,
    },
    { inst: 'kick', vol: 0.48, data: sixteenBars(ROCK_BEAT, ROCK_FILL) },
  ],
};

// ------------------------------------------------------------------ SHOW TIME (C major, circus march)
export const showTime: SongDef = {
  bpm: 132,
  loop: true,
  tracks: [
    {
      inst: 'lead',
      vol: 0.3,
      pan: 0.1,
      data: `
        E5:2 D#5:2 E5:2 G5:2 C6:4 G5:4 | F5:2 E5:2 F5:2 G5:2 B5:4 G5:4 |
        D6:2 C#6:2 D6:2 B5:2 G5:2 F5:2 D5:4 | E5:4 G5:4 C5:8 |
        E5:2 D#5:2 E5:2 G5:2 C6:4 E6:4 | F6:2 E6:2 D6:2 C6:2 A5:4 F5:4 |
        G5:2 F#5:2 G5:2 B5:2 D6:2 F6:2 E6:2 D6:2 | C6:8 G5:4 r:4 |
        A5:3 G#5:1 A5:2 C6:2 F6:4 C6:4 | G5:3 F#5:1 G5:2 C6:2 E6:4 C6:4 |
        F5:2 G5:2 A5:2 B5:2 D6:2 F6:2 E6:2 D6:2 | E6:4 C6:4 G5:8 |
        A5:3 G#5:1 A5:2 C6:2 F6:4 A6:4 | G6:3 F#6:1 G6:2 E6:2 C6:4 E6:4 |
        F#6:2 D6:2 A5:2 C6:2 B5:2 D6:2 G6:2 F6:2 | E6:4 C6:4 C5:4 r:4`,
    },
    {
      inst: 'brass',
      vol: 0.14,
      pan: -0.3,
      data: `
        [r:4 E4+G4+C5:2 r:2]2 | [r:4 F4+G4+B4:2 r:2]2 | [r:4 F4+G4+B4:2 r:2]2 | [r:4 E4+G4+C5:2 r:2]2 |
        [r:4 E4+G4+C5:2 r:2]2 | [r:4 F4+A4+C5:2 r:2]2 | [r:4 F4+G4+B4:2 r:2]2 | [r:4 E4+G4+C5:2 r:2]2 |
        [r:4 F4+A4+C5:2 r:2]2 | [r:4 E4+G4+C5:2 r:2]2 | [r:4 F4+G4+B4:2 r:2]2 | [r:4 E4+G4+C5:2 r:2]2 |
        [r:4 F4+A4+C5:2 r:2]2 | [r:4 E4+G4+C5:2 r:2]2 | r:4 F#4+A4+C5:2 r:2 r:4 F4+G4+B4:2 r:2 | [r:4 E4+G4+C5:2 r:2]2`,
    },
    {
      inst: 'bass',
      vol: 0.42,
      data: `
        C3:4 r:4 G2:4 r:4 | G2:4 r:4 D3:4 r:4 | G2:4 r:4 D3:4 r:4 | C3:4 r:4 G2:4 r:4 |
        C3:4 r:4 G2:4 r:4 | F2:4 r:4 C3:4 r:4 | G2:4 r:4 D3:4 r:4 | C3:4 r:4 G2:4 r:4 |
        F2:4 r:4 C3:4 r:4 | C3:4 r:4 G2:4 r:4 | G2:4 r:4 D3:4 r:4 | C3:4 r:4 G2:4 r:4 |
        F2:4 r:4 C3:4 r:4 | C3:4 r:4 G2:4 r:4 | D3:4 r:4 G2:4 r:4 | C3:4 r:4 G2:4 r:4`,
    },
    { inst: 'kick', vol: 0.4, data: sixteenBars(MARCH_BEAT, MARCH_FILL) },
  ],
};
