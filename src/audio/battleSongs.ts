import {
  DISCO_BEAT,
  DISCO_FILL,
  DRUM_BEAT,
  DRUM_FILL,
  FUNK_BEAT,
  FUNK_FILL,
  GALLOP_BEAT,
  GALLOP_FILL,
  JUNGLE_BEAT,
  JUNGLE_FILL,
  sixteenBars,
  SOFT_BEAT,
  SOFT_FILL,
  SWAY_BEAT,
  SWAY_FILL,
} from './grooves';
import type { SongDef } from './sequencer';

/**
 * Battle Game themes for the stage families (`battle` in songs.ts is the standard one) and
 * the Hyper Bomber game show. Original compositions for this remake.
 */

// ------------------------------------------------------------------ PARK: seesaws and toy blocks (A major ska)
export const battlePark: SongDef = {
  bpm: 152,
  loop: true,
  tracks: [
    {
      inst: 'lead',
      vol: 0.3,
      pan: 0.1,
      data: `
        E5:2 A5:2 C#6:2 A5:2 E5:2 A5:2 C#6:4 | D6:2 C#6:2 B5:2 A5:2 F#5:4 A5:4 |
        G#5:2 B5:2 E6:2 B5:2 G#5:2 B5:2 E6:4 | F#6:2 E6:2 D6:2 C#6:2 B5:4 A5:4 |
        E5:2 A5:2 C#6:2 E6:2 D6:2 C#6:2 B5:2 A5:2 | F#5:2 A5:2 D6:2 F#6:2 E6:2 D6:2 C#6:2 B5:2 |
        B5:2 G#5:2 E5:2 G#5:2 B5:2 D6:2 C#6:2 B5:2 | A5:6 E5:2 A5:2 r:6 |
        C#6:3 C#6:1 A5:2 F#5:2 A5:2 C#6:2 F#6:4 | D6:3 D6:1 A5:2 F#5:2 A5:2 D6:2 F#6:4 |
        E6:4 C#6:2 A5:2 E5:4 A5:4 | B5:4 G#5:2 E5:2 B4:4 E5:4 |
        F#5:2 A5:2 C#6:2 F#6:2 E6:2 C#6:2 A5:4 | D6:2 F#6:2 A6:2 F#6:2 E6:2 D6:2 A5:4 |
        B5:2 D6:2 F#6:4 E6:2 D6:2 B5:4 | E6:4 D6:2 C#6:2 B5:4 G#5:4`,
    },
    {
      inst: 'pluck',
      vol: 0.16,
      pan: -0.3,
      data: `
        [r:2 C#4+E4+A4:2]4 | [r:2 D4+F#4+A4:2]4 | [r:2 E4+G#4+B4:2]4 | [r:2 D4+F#4+A4:2]4 |
        [r:2 C#4+E4+A4:2]4 | [r:2 D4+F#4+A4:2]4 | [r:2 E4+G#4+B4:2]4 | [r:2 C#4+E4+A4:2]4 |
        [r:2 C#4+F#4+A4:2]4 | [r:2 D4+F#4+A4:2]4 | [r:2 C#4+E4+A4:2]4 | [r:2 E4+G#4+B4:2]4 |
        [r:2 C#4+F#4+A4:2]4 | [r:2 D4+F#4+A4:2]4 | [r:2 D4+F#4+B4:2]4 | [r:2 E4+G#4+B4:2]4`,
    },
    {
      inst: 'bass',
      vol: 0.42,
      data: `
        A2:4 C#3:4 E3:4 C#3:4 | D3:4 F#3:4 A3:4 F#3:4 | E3:4 G#3:4 B3:4 G#3:4 | D3:4 F#3:4 A3:4 F#3:4 |
        A2:4 C#3:4 E3:4 C#3:4 | D3:4 F#3:4 A3:4 F#3:4 | E3:4 G#3:4 B3:4 G#3:4 | A2:4 E3:4 A3:4 E3:4 |
        F#2:4 A2:4 C#3:4 A2:4 | D3:4 F#3:4 A3:4 F#3:4 | A2:4 C#3:4 E3:4 C#3:4 | E3:4 G#3:4 B3:4 G#3:4 |
        F#2:4 A2:4 C#3:4 A2:4 | D3:4 F#3:4 A3:4 F#3:4 | B2:4 D3:4 F#3:4 D3:4 | E3:4 G#3:4 B3:4 G#3:4`,
    },
    { inst: 'kick', vol: 0.46, data: sixteenBars(DRUM_BEAT, DRUM_FILL) },
  ],
};

// ------------------------------------------------------------------ RAILS: trolleys, roads and arrows (D major gallop)
export const battleRails: SongDef = {
  bpm: 168,
  loop: true,
  tracks: [
    {
      inst: 'lead',
      vol: 0.29,
      pan: 0.1,
      data: `
        A4:2 D5:2 F#5:2 A5:2 A5:4 F#5:2 A5:2 | B5:2 A5:2 F#5:2 D5:2 E5:4 F#5:4 |
        G5:2 B5:2 D6:2 B5:2 G5:4 B5:2 D6:2 | F#6:4 E6:2 D6:2 A5:8 |
        A5:2 D6:2 A5:2 F#5:2 D5:2 F#5:2 A5:4 | B5:2 D6:2 F#6:2 D6:2 B5:4 F#5:4 |
        G#5:2 B5:2 D6:2 E6:2 D6:2 B5:2 G#5:4 | A5:4 C#6:2 E6:2 G6:4 E6:4 |
        D6:3 B5:1 G5:4 B5:2 D6:2 G6:4 | F#6:3 D6:1 A5:4 D6:2 F#6:2 A6:4 |
        G6:4 F#6:2 E6:2 D6:4 B5:4 | A5:4 F#5:2 D5:2 A5:8 |
        B5:2 D6:2 G6:2 D6:2 B5:2 D6:2 G6:4 | A6:2 F#6:2 D6:2 F#6:2 A6:4 F#6:4 |
        E6:2 C#6:2 A5:2 C#6:2 E6:2 G6:2 E6:2 C#6:2 | D6:8 A5:4 r:4`,
    },
    {
      inst: 'pluck',
      vol: 0.14,
      pan: -0.3,
      data: `
        [r:2 F#3+A3+D4:2]4 | [r:2 F#3+A3+D4:2]4 | [r:2 G3+B3+D4:2]4 | [r:2 F#3+A3+D4:2]4 |
        [r:2 F#3+A3+D4:2]4 | [r:2 F#3+B3+D4:2]4 | [r:2 G#3+D4+E4:2]4 | [r:2 G3+C#4+E4:2]4 |
        [r:2 G3+B3+D4:2]4 | [r:2 F#3+A3+D4:2]4 | [r:2 G3+B3+D4:2]4 | [r:2 F#3+A3+D4:2]4 |
        [r:2 G3+B3+D4:2]4 | [r:2 F#3+A3+D4:2]4 | [r:2 G3+C#4+E4:2]4 | [r:2 F#3+A3+D4:2]4`,
    },
    {
      inst: 'bass',
      vol: 0.42,
      data: `
        [D3:2 r:2 A2:2 r:2]2 | [D3:2 r:2 A2:2 r:2]2 | [G2:2 r:2 D3:2 r:2]2 | [D3:2 r:2 A2:2 r:2]2 |
        [D3:2 r:2 A2:2 r:2]2 | [B2:2 r:2 F#2:2 r:2]2 | E3:2 r:2 B2:2 r:2 E3:2 r:2 G#2:2 r:2 | A2:2 r:2 E2:2 r:2 A2:2 r:2 C#3:2 r:2 |
        [G2:2 r:2 D3:2 r:2]2 | [D3:2 r:2 A2:2 r:2]2 | [G2:2 r:2 D3:2 r:2]2 | [D3:2 r:2 A2:2 r:2]2 |
        [G2:2 r:2 D3:2 r:2]2 | [D3:2 r:2 A2:2 r:2]2 | A2:2 r:2 E2:2 r:2 A2:2 r:2 C#3:2 r:2 | [D3:2 r:2 A2:2 r:2]2`,
    },
    { inst: 'kick', vol: 0.44, data: sixteenBars(GALLOP_BEAT, GALLOP_FILL) },
  ],
};

// ------------------------------------------------------------------ MACHINE: belts, switches and robots (E minor funk)
export const battleMachine: SongDef = {
  bpm: 124,
  loop: true,
  tracks: [
    {
      inst: 'square',
      vol: 0.27,
      pan: 0.1,
      data: `
        E5:2 r:2 G5:2 A5:1 B5:3 r:2 A5:2 G5:2 | E5:2 D5:2 E5:4 r:8 |
        A5:2 r:2 C6:2 D6:1 E6:3 r:2 D6:2 C6:2 | A5:2 G5:2 A5:4 r:8 |
        G5:2 B5:2 E6:4 D6:2 B5:2 G5:4 | F#5:2 A5:2 D#6:4 C6:2 A5:2 F#5:4 |
        E5:1 F#5:1 G5:2 B5:2 E6:2 D6:2 B5:2 G5:4 | E5:4 r:12 |
        C6:2 C6:2 r:2 A5:2 C6:2 E6:2 D6:4 | C6:2 C6:2 r:2 A5:2 F#5:2 A5:2 C6:4 |
        B5:2 B5:2 r:2 G5:2 B5:2 D6:2 F#6:4 | E6:4 D6:2 B5:2 G5:4 E5:4 |
        C6:2 A5:2 F#5:2 A5:2 C6:2 E6:2 D6:4 | D#6:4 C6:2 A5:2 F#5:4 D#5:4 |
        E5:2 G5:2 B5:2 E6:2 G6:4 F#6:2 E6:2 | D#6:4 F#6:4 B5:4 D#6:4`,
    },
    {
      inst: 'organ',
      vol: 0.13,
      pan: -0.3,
      data: `
        [r:2 G3+B3+D4:1 r:1 r:2 G3+B3+D4:2 r:2 G3+B3+D4:1 r:1 r:2 G3+B3+D4:2]2 |
        [r:2 G3+C4+E4:1 r:1 r:2 G3+C4+E4:2 r:2 G3+C4+E4:1 r:1 r:2 G3+C4+E4:2]2 |
        r:2 G3+B3+E4:1 r:1 r:2 G3+B3+E4:2 r:2 G3+B3+E4:1 r:1 r:2 G3+B3+E4:2 |
        r:2 A3+D#4+F#4:1 r:1 r:2 A3+D#4+F#4:2 r:2 A3+D#4+F#4:1 r:1 r:2 A3+D#4+F#4:2 |
        [r:2 G3+B3+D4:1 r:1 r:2 G3+B3+D4:2 r:2 G3+B3+D4:1 r:1 r:2 G3+B3+D4:2]2 |
        r:2 G3+C4+E4:1 r:1 r:2 G3+C4+E4:2 r:2 G3+C4+E4:1 r:1 r:2 G3+C4+E4:2 |
        r:2 A3+C4+F#4:1 r:1 r:2 A3+C4+F#4:2 r:2 A3+C4+F#4:1 r:1 r:2 A3+C4+F#4:2 |
        r:2 F#3+B3+D4:1 r:1 r:2 F#3+B3+D4:2 r:2 F#3+B3+D4:1 r:1 r:2 F#3+B3+D4:2 |
        r:2 G3+B3+E4:1 r:1 r:2 G3+B3+E4:2 r:2 G3+B3+E4:1 r:1 r:2 G3+B3+E4:2 |
        r:2 A3+C4+E4:1 r:1 r:2 A3+C4+E4:2 r:2 A3+C4+E4:1 r:1 r:2 A3+C4+E4:2 |
        r:2 A3+D#4+F#4:1 r:1 r:2 A3+D#4+F#4:2 r:2 A3+D#4+F#4:1 r:1 r:2 A3+D#4+F#4:2 |
        r:2 G3+B3+D4:1 r:1 r:2 G3+B3+D4:2 r:2 G3+B3+D4:1 r:1 r:2 G3+B3+D4:2 |
        r:2 A3+D#4+F#4:1 r:1 r:2 A3+D#4+F#4:2 r:2 A3+D#4+F#4:1 r:1 r:2 A3+D#4+F#4:2`,
    },
    {
      inst: 'slap',
      vol: 0.52,
      data: `
        [E2:2 r:1 E2:1 E3:2 r:2 D3:2 E3:2 r:2 B2:2]2 | [A2:2 r:1 A2:1 A3:2 r:2 G3:2 A3:2 r:2 E3:2]2 |
        C3:2 r:1 C3:1 C4:2 r:2 B3:2 C4:2 r:2 G3:2 | B2:2 r:1 B2:1 B3:2 r:2 A3:2 B3:2 r:2 F#3:2 |
        [E2:2 r:1 E2:1 E3:2 r:2 D3:2 E3:2 r:2 B2:2]2 |
        A2:2 r:1 A2:1 A3:2 r:2 G3:2 A3:2 r:2 E3:2 | D3:2 r:1 D3:1 D4:2 r:2 C4:2 D4:2 r:2 A3:2 |
        G2:2 r:1 G2:1 G3:2 r:2 F#3:2 G3:2 r:2 D3:2 | C3:2 r:1 C3:1 C4:2 r:2 B3:2 C4:2 r:2 G3:2 |
        F#2:2 r:1 F#2:1 F#3:2 r:2 E3:2 F#3:2 r:2 C3:2 | B2:2 r:1 B2:1 B3:2 r:2 A3:2 B3:2 r:2 F#3:2 |
        E2:2 r:1 E2:1 E3:2 r:2 D3:2 E3:2 r:2 B2:2 | B2:2 r:1 B2:1 B3:2 r:2 A3:2 B3:2 r:2 F#3:2`,
    },
    { inst: 'kick', vol: 0.52, data: sixteenBars(FUNK_BEAT, FUNK_FILL) },
  ],
};

// ------------------------------------------------------------------ SEA: pipes, ponds and pirates (D Dorian shanty)
export const battleSea: SongDef = {
  bpm: 138,
  loop: true,
  tracks: [
    {
      inst: 'lead',
      vol: 0.29,
      pan: 0.1,
      data: `
        D5:3 E5:1 F5:2 A5:2 D6:3 C6:1 A5:4 | G5:3 A5:1 G5:2 E5:2 C5:3 D5:1 E5:4 |
        F5:3 G5:1 A5:2 D6:2 C6:3 A5:1 F5:4 | E5:3 F5:1 E5:2 C5:2 A4:8 |
        D5:3 E5:1 F5:2 A5:2 D6:3 E6:1 F6:4 | E6:3 D6:1 C6:2 G5:2 E5:3 G5:1 C6:4 |
        B5:3 A5:1 G5:2 B5:2 D6:3 C6:1 B5:4 | A5:3 G5:1 F5:2 E5:2 D5:8 |
        A5:4 C6:4 F6:6 E6:2 | E6:4 D6:2 C6:2 G5:8 |
        F6:4 E6:2 D6:2 A5:4 D6:4 | C6:4 B5:2 A5:2 E5:8 |
        F5:3 G5:1 A5:2 C6:2 F6:3 E6:1 C6:4 | E6:3 D6:1 C6:2 G5:2 E6:3 F6:1 G6:4 |
        G6:3 F6:1 D6:2 B5:2 G5:3 A5:1 B5:4 | C#6:4 E6:4 A5:4 C#6:4`,
    },
    {
      inst: 'organ',
      vol: 0.1,
      pan: -0.25,
      data: `
        [r:4 F3+A3+D4:4]2 | [r:4 E3+G3+C4:4]2 | [r:4 F3+A3+D4:4]2 | [r:4 E3+A3+C4:4]2 |
        [r:4 F3+A3+D4:4]2 | [r:4 E3+G3+C4:4]2 | [r:4 D3+G3+B3:4]2 | [r:4 F3+A3+D4:4]2 |
        [r:4 F3+A3+C4:4]2 | [r:4 E3+G3+C4:4]2 | [r:4 F3+A3+D4:4]2 | [r:4 E3+A3+C4:4]2 |
        [r:4 F3+A3+C4:4]2 | [r:4 E3+G3+C4:4]2 | [r:4 D3+G3+B3:4]2 | [r:4 E3+A3+C#4:4]2`,
    },
    {
      inst: 'bass',
      vol: 0.42,
      data: `
        [D3:4 A2:4]2 | [C3:4 G2:4]2 | [D3:4 A2:4]2 | [A2:4 E2:4]2 |
        [D3:4 A2:4]2 | [C3:4 G2:4]2 | [G2:4 D3:4]2 | [D3:4 A2:4]2 |
        [F2:4 C3:4]2 | [C3:4 G2:4]2 | [D3:4 A2:4]2 | [A2:4 E2:4]2 |
        [F2:4 C3:4]2 | [C3:4 G2:4]2 | [G2:4 D3:4]2 | A2:4 E3:4 A2:4 C#3:4`,
    },
    { inst: 'kick', vol: 0.42, data: sixteenBars(SWAY_BEAT, SWAY_FILL) },
  ],
};

// ------------------------------------------------------------------ WILD: desert, jungle and fireballs (A minor pentatonic)
export const battleWild: SongDef = {
  bpm: 150,
  loop: true,
  tracks: [
    {
      inst: 'flute',
      vol: 0.28,
      pan: 0.1,
      data: `
        A5:2 C6:2 D6:2 E6:2 G6:3 E6:1 D6:2 C6:2 | A5:4 r:2 G5:2 A5:8 |
        G5:2 B5:2 D6:2 E6:2 D6:3 B5:1 A5:2 G5:2 | A5:4 r:2 E5:2 A5:8 |
        E6:2 G6:2 A6:4 G6:2 E6:2 D6:4 | C6:2 D6:2 E6:4 D6:2 C6:2 A5:4 |
        F5:2 A5:2 C6:4 G5:2 B5:2 D6:4 | E6:4 D6:2 C6:2 A5:8 |
        C6:4 A5:2 F5:2 A5:4 C6:4 | D6:4 B5:2 G5:2 B5:4 D6:4 |
        E6:2 D6:2 C6:2 A5:2 C6:2 D6:2 E6:4 | A6:8 G6:4 E6:4 |
        F6:3 E6:1 C6:2 A5:2 F6:3 E6:1 C6:4 | G6:3 F6:1 D6:2 B5:2 G6:3 F6:1 D6:4 |
        E6:2 B5:2 G5:2 B5:2 E6:2 G6:2 B6:4 | G#6:4 E6:4 B5:4 G#5:4`,
    },
    {
      inst: 'pad',
      vol: 0.09,
      data: `
        A3+C4+E4:16 | A3+C4+E4:16 | G3+B3+D4:16 | A3+C4+E4:16 | A3+C4+E4:16 | A3+C4+E4:16 | F3+A3+C4:8 G3+B3+D4:8 | A3+C4+E4:16 |
        F3+A3+C4:16 | G3+B3+D4:16 | A3+C4+E4:16 | A3+C4+E4:16 | F3+A3+C4:16 | G3+B3+D4:16 | G3+B3+E4:16 | G#3+B3+E4:16`,
    },
    {
      inst: 'slap',
      vol: 0.48,
      data: `
        [A2:2 r:1 A2:1 C3:2 A2:2 D3:2 A2:1 E3:1 G3:2 A2:2]2 | G2:2 r:1 G2:1 B2:2 G2:2 C3:2 G2:1 D3:1 F3:2 G2:2 |
        [A2:2 r:1 A2:1 C3:2 A2:2 D3:2 A2:1 E3:1 G3:2 A2:2]3 | F2:2 r:1 F2:1 A2:2 C3:2 G2:2 r:1 G2:1 B2:2 D3:2 |
        A2:2 r:1 A2:1 C3:2 A2:2 D3:2 A2:1 E3:1 G3:2 A2:2 |
        F2:2 r:1 F2:1 A2:2 F2:2 C3:2 F2:1 G2:1 A2:2 F2:2 | G2:2 r:1 G2:1 B2:2 G2:2 C3:2 G2:1 D3:1 F3:2 G2:2 |
        [A2:2 r:1 A2:1 C3:2 A2:2 D3:2 A2:1 E3:1 G3:2 A2:2]2 |
        F2:2 r:1 F2:1 A2:2 F2:2 C3:2 F2:1 G2:1 A2:2 F2:2 | G2:2 r:1 G2:1 B2:2 G2:2 C3:2 G2:1 D3:1 F3:2 G2:2 |
        E2:2 r:1 E2:1 G2:2 E2:2 A2:2 E2:1 B2:1 D3:2 E2:2 | E2:2 r:1 E2:1 G#2:2 E2:2 B2:2 E2:1 B2:1 D3:2 E2:2`,
    },
    { inst: 'kick', vol: 0.48, data: sixteenBars(JUNGLE_BEAT, JUNGLE_FILL) },
  ],
};

// ------------------------------------------------------------------ SKY: clouds and snow (E major, airy)
export const battleSky: SongDef = {
  bpm: 136,
  loop: true,
  tracks: [
    {
      inst: 'flute',
      vol: 0.25,
      pan: 0.1,
      data: `
        B5:4 D#6:4 E6:6 F#6:2 | G#6:4 E6:4 C#6:8 | C#6:4 E6:4 G#6:6 A6:2 | F#6:6 E6:2 D#6:8 |
        B5:4 D#6:4 E6:4 G#6:4 | B6:6 A6:2 G#6:4 E6:4 | A6:4 F#6:4 D#6:4 B5:4 | E6:12 r:4 |
        C#6:2 E6:2 G#6:4 F#6:2 E6:2 C#6:4 | D#6:2 F#6:2 B6:4 A6:2 F#6:2 D#6:4 |
        D#6:4 F#6:4 B6:6 A#6:2 | G#6:4 E6:4 C#6:6 B5:2 |
        A5:4 C#6:4 E6:4 F#6:4 | D#6:4 F#6:4 A6:4 B6:4 | E6:4 D#6:4 C#6:4 A5:4 | B5:4 D#6:4 F#6:4 A6:4`,
    },
    {
      inst: 'bell',
      vol: 0.1,
      pan: -0.35,
      data: `
        [E5:2 G#5:2 B5:2 D#6:2]2 | [C#5:2 E5:2 G#5:2 B5:2]2 | [A4:2 C#5:2 E5:2 G#5:2]2 | [B4:2 D#5:2 F#5:2 B5:2]2 |
        [E5:2 G#5:2 B5:2 D#6:2]2 | [C#5:2 E5:2 G#5:2 B5:2]2 | F#4:2 A4:2 C#5:2 E5:2 B4:2 D#5:2 F#5:2 A5:2 | [E5:2 G#5:2 B5:2 E6:2]2 |
        [A4:2 C#5:2 E5:2 G#5:2]2 | [B4:2 D#5:2 F#5:2 A5:2]2 | [G#4:2 B4:2 D#5:2 F#5:2]2 | [C#5:2 E5:2 G#5:2 B5:2]2 |
        [F#4:2 A4:2 C#5:2 E5:2]2 | [B4:2 D#5:2 F#5:2 A5:2]2 | [A4:2 C#5:2 D#5:2 E5:2]2 | [B4:2 D#5:2 F#5:2 A5:2]2`,
    },
    {
      inst: 'bass',
      vol: 0.36,
      data: `
        E2:8 B2:8 | C#3:8 G#2:8 | A2:8 E3:8 | B2:8 F#2:8 | E2:8 B2:8 | C#3:8 G#2:8 | F#2:8 B2:8 | E2:8 B2:8 |
        A2:8 E3:8 | B2:8 A2:8 | G#2:8 D#3:8 | C#3:8 G#2:8 | F#2:8 C#3:8 | B2:8 A2:8 | A2:8 E3:8 | B2:8 D#3:8`,
    },
    { inst: 'kick', vol: 0.34, data: sixteenBars(SOFT_BEAT, SOFT_FILL) },
  ],
};

// ------------------------------------------------------------------ HYPER BOMBER: the game show (G minor disco)
export const hyperBomber: SongDef = {
  bpm: 128,
  loop: true,
  tracks: [
    {
      inst: 'square',
      vol: 0.23,
      pan: 0.1,
      data: `
        G5:2 Bb5:2 D6:4 C6:2 Bb5:2 A5:4 | G5:2 Bb5:2 Eb6:4 D6:2 C6:2 Bb5:4 |
        A5:2 C6:2 F6:4 Eb6:2 D6:2 C6:4 | F#5:4 A5:4 D6:8 |
        G6:4 F6:2 D6:2 Bb5:4 G5:4 | G6:4 Eb6:2 Bb5:2 G5:4 Eb5:4 |
        C6:2 Eb6:2 G6:4 F#6:2 D6:2 A5:4 | G5:8 r:8 |
        Bb5:2 Bb5:2 r:2 Bb5:2 G5:2 Bb5:2 Eb6:4 | C6:2 C6:2 r:2 C6:2 A5:2 C6:2 F6:4 |
        D6:2 D6:2 r:2 D6:2 A5:2 D6:2 F6:4 | G6:4 F6:2 D6:2 Bb5:8 |
        Eb6:2 D6:2 Eb6:2 G6:2 Bb6:4 G6:4 | F6:2 Eb6:2 D6:2 C6:2 A5:4 F5:4 |
        F#5:2 A5:2 D6:2 F#6:2 A6:4 F#6:4 | C6:2 A5:2 F#5:2 D5:2 F#5:2 A5:2 C6:4`,
    },
    {
      inst: 'pulse',
      vol: 0.12,
      pan: -0.3,
      data: `
        [r:2 D4+G4+Bb4:2]4 | [r:2 Eb4+G4+Bb4:2]4 | [r:2 C4+F4+A4:2]4 | [r:2 D4+F#4+A4:2]4 |
        [r:2 D4+G4+Bb4:2]4 | [r:2 Eb4+G4+Bb4:2]4 | [r:2 C4+Eb4+G4:2]2 [r:2 D4+F#4+A4:2]2 | [r:2 D4+G4+Bb4:2]4 |
        [r:2 Eb4+G4+Bb4:2]4 | [r:2 C4+F4+A4:2]4 | [r:2 D4+F4+A4:2]4 | [r:2 D4+G4+Bb4:2]4 |
        [r:2 Eb4+G4+Bb4:2]4 | [r:2 C4+F4+A4:2]4 | [r:2 D4+F#4+A4:2]4 | [r:2 C4+F#4+A4:2]4`,
    },
    {
      inst: 'bass',
      vol: 0.44,
      data: `
        [G2:2 G3:2]4 | [Eb2:2 Eb3:2]4 | [F2:2 F3:2]4 | [D2:2 D3:2]4 |
        [G2:2 G3:2]4 | [Eb2:2 Eb3:2]4 | [C3:2 C4:2]2 [D2:2 D3:2]2 | [G2:2 G3:2]4 |
        [Eb2:2 Eb3:2]4 | [F2:2 F3:2]4 | [D2:2 D3:2]4 | [G2:2 G3:2]4 |
        [Eb2:2 Eb3:2]4 | [F2:2 F3:2]4 | [D2:2 D3:2]4 | [D2:2 D3:2]2 F#2:2 F#3:2 A2:2 C3:2`,
    },
    { inst: 'kick', vol: 0.46, data: sixteenBars(DISCO_BEAT, DISCO_FILL) },
  ],
};

/** Each stage family has its own theme (keyed by stage id; the standard stages play `battle`). */
export const BATTLE_STAGE_MUSIC: Record<string, string> = {
  b2: 'battlePark', n2: 'battlePark', n5: 'battlePark',
  b3: 'battleRails', b4: 'battleRails', b5: 'battleRails', n4: 'battleRails', a4: 'battleRails',
  b7: 'battleMachine', n7: 'battleMachine', a7: 'battleMachine', a2: 'battleMachine',
  b6: 'battleSea', n6: 'battleSea', a3: 'battleSea', a8: 'battleSea',
  b8: 'battleWild', a5: 'battleWild', a6: 'battleWild',
  n3: 'battleSky', n8: 'battleSky',
};
