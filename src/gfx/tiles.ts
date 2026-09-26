import { mix } from '../engine/gfx';
import { BATTLE_THEMES } from './battleArt';
import { PixelCanvas } from './pixel';

/** Colour/style theme for a playfield. All tiles are generated procedurally from it. */
export interface Theme {
  name: string;
  /** Screen colour around the playfield. */
  backdrop: string;
  floor: string;
  floorAlt: string;
  floorStyle: 'grass' | 'checker' | 'plain' | 'tiles' | 'carpet' | 'sand' | 'ice' | 'metal' | 'nes' | 'wood' | 'water';
  hard: string;
  hardAlt?: string;
  hardStyle: 'bevel' | 'metal' | 'gem' | 'checker' | 'goldArrow' | 'candy' | 'nes' | 'stone' | 'crystal' | 'pillar';
  wall: string;
  wallAlt?: string;
  wallStyle: 'bevel' | 'metal' | 'balloon' | 'candy' | 'stone' | 'brick' | 'nes' | 'hedge';
  soft: string;
  softAlt?: string;
  softStyle: 'brick' | 'crate' | 'toy' | 'rock' | 'bush' | 'ice' | 'nes' | 'barrel' | 'snow';
  /** HUD strip colours (the tall top wall). */
  hud: [string, string];
  /** Floor shadow strength (0 = none, as on the NES). */
  shadow: number;
}

export const THEMES: Record<string, Theme> = {
  // Modern, stages 1–10: grass floor, grey stone blocks, pale stone bricks.
  m1: {
    name: 'm1', backdrop: '#101820',
    floor: '#3c9a3a', floorAlt: '#48aa44', floorStyle: 'grass',
    hard: '#a4aabc', hardStyle: 'bevel',
    wall: '#b0b6c4', wallStyle: 'bevel',
    soft: '#dde1ec', softAlt: '#8894b4', softStyle: 'brick',
    hud: ['#c8ccd8', '#9ca2b4'], shadow: 0.38,
  },
  // Modern, stages 11–20: blue carpet, pink gem blocks, balloon border.
  m2: {
    name: 'm2', backdrop: '#101030',
    floor: '#3456c0', floorAlt: '#3c62d0', floorStyle: 'carpet',
    hard: '#f06aa8', hardStyle: 'gem',
    wall: '#28206a', wallAlt: '#ffd040', wallStyle: 'balloon',
    soft: '#f0c040', softAlt: '#e05050', softStyle: 'toy',
    hud: ['#3a2c88', '#1c1448'], shadow: 0.35,
  },
  // Modern, stages 21–30: teal/pink checker blocks.
  m3: {
    name: 'm3', backdrop: '#101c1c',
    floor: '#b8a8d8', floorAlt: '#c4b6e2', floorStyle: 'tiles',
    hard: '#30b0a8', hardAlt: '#f080b0', hardStyle: 'checker',
    wall: '#208880', wallStyle: 'bevel',
    soft: '#f4a0c4', softStyle: 'crate',
    hud: ['#2a8a84', '#145450'], shadow: 0.3,
  },
  // Modern, stages 31–40: green floor, gold arrow blocks.
  m4: {
    name: 'm4', backdrop: '#141008',
    floor: '#2e8850', floorAlt: '#389458', floorStyle: 'plain',
    hard: '#e0b030', hardStyle: 'goldArrow',
    wall: '#a07818', wallStyle: 'stone',
    soft: '#a8a0a0', softStyle: 'rock',
    hud: ['#8a6a18', '#4a3808'], shadow: 0.36,
  },
  // Modern, stages 41–50: blue checker floor, pink blocks, candy-panel border.
  m5: {
    name: 'm5', backdrop: '#180c18',
    floor: '#4a78e0', floorAlt: '#3c66cc', floorStyle: 'checker',
    hard: '#f278b8', hardStyle: 'candy',
    wall: '#ffffff', wallAlt: '#f04890', wallStyle: 'candy',
    soft: '#f8e0f0', softAlt: '#e070b0', softStyle: 'crate',
    hud: ['#c03880', '#681848'], shadow: 0.3,
  },
  // Retro: the 1985 look.
  retro: {
    name: 'retro', backdrop: '#000000',
    floor: '#388700', floorAlt: '#388700', floorStyle: 'nes',
    hard: '#bcbcbc', hardStyle: 'nes',
    wall: '#bcbcbc', wallStyle: 'nes',
    soft: '#bcbcbc', softStyle: 'nes',
    hud: ['#bcbcbc', '#bcbcbc'], shadow: 0,
  },
  ...BATTLE_THEMES,
  // Battle arena default (Beginner "Normal"): grass, grey stone, pale stone bricks.
  battle: {
    name: 'battle', backdrop: '#101820',
    floor: '#3c9a3a', floorAlt: '#48aa44', floorStyle: 'grass',
    hard: '#a4aabc', hardStyle: 'bevel',
    wall: '#b0b6c4', wallStyle: 'bevel',
    soft: '#dde1ec', softAlt: '#8894b4', softStyle: 'brick',
    hud: ['#c8ccd8', '#9ca2b4'], shadow: 0.38,
  },
};

/** Theme for a Normal Game stage. */
export function themeForStage(stage: number, retro: boolean): string {
  if (retro) return 'retro';
  return `m${Math.min(5, Math.floor((stage - 1) / 10) + 1)}`;
}

export interface TileSet {
  floor: HTMLCanvasElement;
  /** Floor with a shadow cast by a block in the tile above. */
  floorShadow: HTMLCanvasElement;
  hard: HTMLCanvasElement;
  wall: HTMLCanvasElement;
  /** Decorative variants of the border wall (picked by tile position). */
  walls: HTMLCanvasElement[];
  soft: HTMLCanvasElement;
  /** Soft block burning frames. */
  burn: HTMLCanvasElement[];
}

const BURN_FRAMES = 6;
export const BURN_FRAME_COUNT = BURN_FRAMES;

export function buildTiles(theme: Theme): TileSet {
  return {
    floor: floorTile(theme, false),
    floorShadow: floorTile(theme, true),
    hard: hardTile(theme),
    wall: wallTile(theme, 0),
    walls: [0, 1, 2, 3].map((v) => wallTile(theme, v)),
    soft: softTile(theme),
    burn: Array.from({ length: BURN_FRAMES }, (_, i) => burnTile(theme, i)),
  };
}

function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function floorTile(t: Theme, shadow: boolean): HTMLCanvasElement {
  const p = new PixelCanvas(16, 16);
  p.rect(0, 0, 16, 16, t.floor);
  switch (t.floorStyle) {
    case 'grass':
      for (let i = 0; i < 18; i++) {
        const x = Math.floor(hash(i, 1) * 16);
        const y = Math.floor(hash(i, 2) * 16);
        p.px(x, y, t.floorAlt);
        if (hash(i, 3) > 0.5) p.px(x, Math.max(0, y - 1), mix(t.floorAlt, '#ffffff', 0.18));
      }
      for (let i = 0; i < 6; i++) p.px(Math.floor(hash(i, 7) * 16), Math.floor(hash(i, 8) * 16), mix(t.floor, '#000000', 0.18));
      break;
    case 'checker':
      p.rect(0, 0, 8, 8, t.floorAlt);
      p.rect(8, 8, 8, 8, t.floorAlt);
      p.rect(0, 0, 16, 1, mix(t.floor, '#ffffff', 0.12));
      break;
    case 'carpet':
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
          if (Math.abs(d - 6) < 0.6) p.px(x, y, t.floorAlt);
          if ((x + y) % 4 === 0 && d > 7) p.px(x, y, mix(t.floor, '#000000', 0.1));
        }
      }
      p.px(7, 7, mix(t.floorAlt, '#ffffff', 0.3));
      p.px(8, 8, mix(t.floorAlt, '#ffffff', 0.3));
      break;
    case 'tiles':
      p.rect(0, 15, 16, 1, mix(t.floor, '#000000', 0.22));
      p.rect(15, 0, 1, 16, mix(t.floor, '#000000', 0.22));
      p.rect(0, 0, 15, 1, mix(t.floor, '#ffffff', 0.25));
      p.rect(0, 0, 1, 15, mix(t.floor, '#ffffff', 0.25));
      p.rect(4, 4, 7, 7, t.floorAlt);
      break;
    case 'plain':
      for (let i = 0; i < 10; i++) p.px(Math.floor(hash(i, 11) * 16), Math.floor(hash(i, 12) * 16), i % 2 ? t.floorAlt : mix(t.floor, '#000000', 0.12));
      break;
    case 'sand':
      for (let i = 0; i < 24; i++) p.px(Math.floor(hash(i, 11) * 16), Math.floor(hash(i, 12) * 16), i % 2 ? t.floorAlt : mix(t.floor, '#ffffff', 0.2));
      break;
    case 'wood':
      for (let y = 0; y < 16; y += 4) {
        p.rect(0, y + 3, 16, 1, mix(t.floor, '#000000', 0.25));
        p.rect(0, y, 16, 1, mix(t.floor, '#ffffff', 0.12));
      }
      p.px(5, 1, t.floorAlt);
      p.px(12, 9, t.floorAlt);
      break;
    case 'ice':
      for (let i = 0; i < 16; i++) p.px(i, (i * 7) % 16, mix(t.floor, '#ffffff', 0.45));
      p.rect(2, 11, 3, 1, mix(t.floor, '#ffffff', 0.6));
      p.rect(10, 4, 4, 1, mix(t.floor, '#ffffff', 0.6));
      p.rect(0, 15, 16, 1, t.floorAlt);
      p.rect(15, 0, 1, 16, t.floorAlt);
      break;
    case 'water':
      for (let y = 2; y < 16; y += 5) {
        for (let x = 0; x < 16; x++) if ((x + y) % 6 < 3) p.px(x, y + (x % 6 < 3 ? 0 : 1), t.floorAlt);
      }
      break;
    case 'metal':
      p.rect(0, 0, 16, 1, mix(t.floor, '#ffffff', 0.25));
      p.rect(0, 15, 16, 1, mix(t.floor, '#000000', 0.35));
      for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) p.px(x, y, t.floorAlt);
      break;
    case 'nes':
      break;
  }
  if (shadow && t.shadow > 0) {
    p.rect(0, 0, 16, 3, mix(t.floor, '#000000', t.shadow));
    p.rect(0, 3, 16, 1, mix(t.floor, '#000000', t.shadow * 0.5));
  }
  return p.canvas;
}

function bevel(p: PixelCanvas, base: string, depth = 1): void {
  const light = mix(base, '#ffffff', 0.5);
  const dark = mix(base, '#000000', 0.45);
  p.rect(0, 0, 16, 16, mix(base, '#000000', 0.65));
  p.rect(0, 0, 15, 15, light);
  p.rect(depth, depth, 15 - depth, 15 - depth, dark);
  p.rect(depth, depth, 14 - depth, 14 - depth, base);
}

/** Indestructible pillar block. */
function hardTile(t: Theme): HTMLCanvasElement {
  const p = new PixelCanvas(16, 16);
  const base = t.hard;
  const light = mix(base, '#ffffff', 0.45);
  const lighter = mix(base, '#ffffff', 0.75);
  const dark = mix(base, '#000000', 0.35);
  const darker = mix(base, '#000000', 0.62);
  switch (t.hardStyle) {
    case 'metal':
      bevel(p, base);
      p.rect(3, 3, 10, 10, mix(base, '#ffffff', 0.12));
      p.rect(3, 12, 10, 1, dark);
      p.rect(12, 3, 1, 10, dark);
      for (const [x, y] of [[2, 2], [12, 2], [2, 12], [12, 12]]) {
        p.px(x, y, darker);
        p.px(x + 1, y + 1, lighter);
      }
      p.rect(5, 7, 6, 1, dark);
      p.rect(5, 8, 6, 1, light);
      break;
    case 'gem': {
      p.rect(0, 0, 16, 16, darker);
      p.rect(1, 1, 14, 14, base);
      // facets
      for (let i = 0; i < 6; i++) {
        p.hline(1 + i, 14 - i, 1 + i, i < 2 ? lighter : light);
        p.vline(1 + i, 1 + i, 14 - i, i < 2 ? light : mix(base, '#ffffff', 0.25));
        p.hline(1 + i, 14 - i, 14 - i, i < 2 ? darker : dark);
        p.vline(14 - i, 1 + i, 14 - i, dark);
      }
      p.rect(6, 6, 4, 4, mix(base, '#ffffff', 0.35));
      p.px(6, 6, '#ffffff');
      break;
    }
    case 'checker': {
      bevel(p, base);
      const alt = t.hardAlt ?? '#ffffff';
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) if ((x + y) % 2) p.rect(2 + x * 4, 2 + y * 4, 4, 4, alt);
      }
      p.rect(2, 2, 12, 1, mix(alt, '#ffffff', 0.4));
      break;
    }
    case 'goldArrow':
      bevel(p, base);
      p.rect(3, 3, 10, 10, mix(base, '#ffffff', 0.18));
      // embossed arrow
      for (let i = 0; i < 4; i++) p.hline(7 - i, 8 + i, 4 + i, dark);
      p.rect(6, 8, 4, 4, dark);
      for (let i = 0; i < 4; i++) p.hline(7 - i, 8 + i, 3 + i, lighter);
      p.rect(6, 7, 4, 4, light);
      break;
    case 'candy':
      p.rect(0, 0, 16, 16, darker);
      p.roundRect(0, 0, 15, 15, base, 2);
      p.roundRect(1, 1, 13, 13, mix(base, '#ffffff', 0.12), 2);
      p.rect(3, 2, 6, 2, lighter);
      p.rect(2, 3, 2, 4, lighter);
      p.rect(3, 12, 10, 1, dark);
      p.rect(12, 4, 1, 9, dark);
      break;
    case 'nes':
      p.rect(0, 0, 16, 16, '#000000');
      p.rect(0, 0, 15, 15, '#fcfcfc');
      p.rect(1, 1, 14, 14, '#747474');
      p.rect(1, 1, 13, 13, '#bcbcbc');
      break;
    case 'stone':
      p.rect(0, 0, 16, 16, dark);
      p.roundRect(0, 0, 15, 15, base, 2);
      p.rect(2, 1, 11, 2, light);
      p.rect(1, 2, 2, 10, light);
      p.px(2, 2, lighter);
      p.rect(3, 12, 11, 2, dark);
      p.rect(12, 3, 2, 10, dark);
      p.px(6, 6, dark);
      p.px(9, 8, dark);
      break;
    case 'crystal':
      p.rect(0, 0, 16, 16, darker);
      p.rect(1, 1, 14, 14, base);
      for (let i = 0; i < 7; i++) p.hline(1 + i, 14 - i, 1 + i, i % 2 ? light : lighter);
      for (let i = 0; i < 6; i++) p.hline(2 + i, 13 - i, 14 - i, dark);
      break;
    case 'pillar':
      p.rect(0, 0, 16, 16, darker);
      p.rect(1, 0, 14, 15, base);
      p.rect(1, 0, 3, 15, light);
      p.rect(2, 0, 1, 15, lighter);
      p.rect(11, 0, 3, 15, dark);
      p.rect(0, 12, 16, 4, dark);
      p.rect(0, 12, 16, 1, light);
      break;
    case 'bevel':
    default:
      bevel(p, base);
      p.rect(0, 0, 15, 1, lighter);
      p.rect(0, 0, 1, 15, lighter);
      p.rect(4, 4, 8, 8, mix(base, '#000000', 0.12));
      p.rect(4, 4, 8, 1, dark);
      p.rect(4, 4, 1, 8, dark);
      p.rect(5, 11, 7, 1, light);
      p.rect(11, 5, 1, 7, light);
      break;
  }
  return p.canvas;
}

/** Outer border wall (`variant` gives decorative variety). */
function wallTile(t: Theme, variant: number): HTMLCanvasElement {
  const p = new PixelCanvas(16, 16);
  const base = t.wall;
  const light = mix(base, '#ffffff', 0.35);
  const dark = mix(base, '#000000', 0.4);
  switch (t.wallStyle) {
    case 'metal':
      p.rect(0, 0, 16, 16, base);
      p.rect(0, 0, 16, 1, light);
      p.rect(0, 15, 16, 1, dark);
      p.rect(0, 7, 16, 1, dark);
      p.rect(0, 8, 16, 1, light);
      for (const [x, y] of [[2, 3], [13, 3], [2, 11], [13, 11]]) {
        p.px(x, y, dark);
        p.px(x + 1, y + 1, light);
      }
      break;
    case 'balloon': {
      p.rect(0, 0, 16, 16, base);
      const cols = ['#ff5070', '#ffd040', '#50c0ff', '#70e070'];
      const c = cols[variant % 4];
      p.circle(7.5, 6.5, 5.6, '#000000');
      p.circle(7.5, 6.5, 4.8, c);
      p.circle(6, 5, 1.6, mix(c, '#ffffff', 0.6));
      p.vline(7, 12, 15, t.wallAlt ?? '#ffffff');
      break;
    }
    case 'candy':
      p.rect(0, 0, 16, 16, base);
      for (let i = -16; i < 32; i += 6) {
        for (let k = 0; k < 3; k++) {
          for (let y = 0; y < 16; y++) {
            const x = i + k + y;
            if (x >= 0 && x < 16) p.px(x, y, t.wallAlt ?? '#f04890');
          }
        }
      }
      p.rect(0, 0, 16, 1, '#ffffff');
      p.rect(0, 15, 16, 1, mix(t.wallAlt ?? '#f04890', '#000000', 0.4));
      break;
    case 'brick':
      p.rect(0, 0, 16, 16, dark);
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 4 : 0;
        for (let col = -1; col < 3; col++) {
          const x = col * 8 + off;
          p.rect(x, row * 4, 7, 3, base);
          p.rect(x, row * 4, 7, 1, light);
        }
      }
      break;
    case 'stone':
      p.rect(0, 0, 16, 16, dark);
      p.roundRect(0, 0, 8, 8, base, 1);
      p.roundRect(8, 0, 8, 8, mix(base, '#000000', 0.1), 1);
      p.roundRect(0, 8, 8, 8, mix(base, '#000000', 0.08), 1);
      p.roundRect(8, 8, 8, 8, base, 1);
      p.rect(1, 1, 5, 1, light);
      p.rect(9, 9, 5, 1, light);
      break;
    case 'hedge':
      p.rect(0, 0, 16, 16, dark);
      for (let i = 0; i < 6; i++) p.circle(2 + hash(i, 9) * 12, 2 + hash(i, 10) * 12, 3.2, i % 2 ? base : light);
      break;
    case 'nes':
      return hardTile({ ...t, hardStyle: 'nes' });
    case 'bevel':
    default:
      return hardTile({ ...t, hard: t.wall, hardStyle: 'bevel' });
  }
  return p.canvas;
}

/** Destructible soft block. */
function softTile(t: Theme): HTMLCanvasElement {
  const p = new PixelCanvas(16, 16);
  const base = t.soft;
  const light = mix(base, '#ffffff', 0.42);
  const dark = mix(base, '#000000', 0.35);
  const mortar = t.softStyle === 'brick' && t.softAlt ? t.softAlt : mix(base, '#000000', 0.58);
  switch (t.softStyle) {
    case 'toy': {
      const alt = t.softAlt ?? '#e05050';
      p.rect(0, 0, 16, 16, mix(base, '#000000', 0.55));
      p.rect(0, 0, 15, 15, base);
      p.rect(0, 0, 15, 1, light);
      p.rect(0, 0, 1, 15, light);
      p.rect(3, 3, 9, 9, alt);
      p.rect(3, 3, 9, 1, mix(alt, '#ffffff', 0.4));
      p.rect(6, 5, 3, 5, '#ffffff');
      p.rect(5, 6, 5, 3, '#ffffff');
      break;
    }
    case 'crate': {
      const alt = t.softAlt ?? dark;
      p.rect(0, 0, 16, 16, mix(base, '#000000', 0.5));
      p.rect(1, 1, 14, 14, base);
      p.rect(1, 1, 14, 1, light);
      p.rect(1, 1, 1, 14, light);
      p.rect(1, 7, 14, 2, alt);
      p.rect(7, 1, 2, 14, alt);
      p.rect(14, 1, 1, 14, dark);
      p.rect(1, 14, 14, 1, dark);
      break;
    }
    case 'bush':
      p.circle(4.5, 5.5, 4.5, dark);
      p.circle(11, 5, 4.5, dark);
      p.circle(8, 10.5, 5.5, dark);
      p.circle(4.5, 5, 3.6, base);
      p.circle(11, 4.5, 3.6, base);
      p.circle(8, 10, 4.6, base);
      p.circle(3.5, 4, 1.4, light);
      p.circle(10, 3.5, 1.4, light);
      p.circle(7, 8.5, 1.6, light);
      break;
    case 'ice':
      p.rect(0, 0, 16, 16, dark);
      p.rect(1, 1, 14, 14, base);
      p.rect(2, 2, 5, 2, light);
      p.rect(2, 2, 2, 5, light);
      p.rect(10, 11, 3, 2, mix(base, '#ffffff', 0.7));
      break;
    case 'rock':
      p.circle(8, 9, 7.6, mix(base, '#000000', 0.6));
      p.circle(7.5, 8.2, 6.8, base);
      p.circle(5.5, 5.5, 2.6, light);
      p.px(10, 11, dark);
      p.px(11, 10, dark);
      p.px(4, 11, dark);
      break;
    case 'snow':
      p.ellipse(7.5, 9.5, 7.6, 6.4, '#5078a8');
      p.ellipse(7.5, 9, 6.8, 5.8, '#ffffff');
      p.ellipse(9, 11, 4.5, 3, '#d8e8f8');
      p.ellipse(5, 6, 2.4, 1.6, '#ffffff');
      p.px(4, 5, '#ffffff');
      p.rect(3, 14, 10, 1, '#5078a8');
      break;
    case 'barrel':
      p.rect(2, 0, 12, 16, '#000000');
      p.rect(3, 1, 10, 14, base);
      p.rect(3, 1, 3, 14, light);
      p.rect(3, 4, 10, 1, dark);
      p.rect(3, 11, 10, 1, dark);
      break;
    case 'nes':
      p.rect(0, 0, 16, 16, '#000000');
      for (const [y, off] of [[0, 0], [4, 4], [8, 0], [12, 4]] as [number, number][]) {
        for (let x = -off; x < 16; x += 8) {
          p.rect(x + 1, y + 1, 7, 3, '#bcbcbc');
          p.rect(x + 1, y + 1, 7, 1, '#fcfcfc');
        }
      }
      break;
    case 'brick':
    default: {
      p.rect(0, 0, 16, 16, mortar);
      [0, 4, 8, 12].forEach((y, r) => {
        const off = r % 2 ? -4 : 0;
        for (let x = off; x < 16; x += 8) {
          p.rect(x, y, 7, 3, base);
          p.rect(x, y, 7, 1, light);
          p.rect(x + 6, y, 1, 3, dark);
          p.rect(x, y + 2, 7, 1, dark);
          p.px(x, y, mix(light, '#ffffff', 0.4));
        }
      });
      p.rect(0, 15, 16, 1, mix(mortar, '#000000', 0.3));
      break;
    }
  }
  return p.canvas;
}

/** A soft block being consumed by fire. */
function burnTile(t: Theme, frame: number): HTMLCanvasElement {
  const p = new PixelCanvas(16, 16);
  const soft = softTile(t);
  const k = frame / (BURN_FRAMES - 1);
  p.ctx.drawImage(soft, 0, 0);
  p.ctx.globalCompositeOperation = 'source-atop';
  p.ctx.fillStyle = `rgba(255,${Math.round(120 - k * 100)},0,${0.3 + k * 0.25})`;
  p.ctx.fillRect(0, 0, 16, 16);
  p.ctx.fillStyle = `rgba(30,8,0,${k * 0.7})`;
  p.ctx.fillRect(0, 0, 16, 16);
  p.ctx.globalCompositeOperation = 'source-over';
  // Crumble: knock out pixels progressively.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (hash(x, y, 77) < k * 0.9) p.ctx.clearRect(x, y, 1, 1);
    }
  }
  const flameCols = ['#ff3000', '#ff9000', '#ffe040', '#ffffff'];
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(hash(i, frame, 9) * 14) + 1;
    const base = 15 - Math.floor(hash(i, frame, 5) * 4);
    const len = Math.max(1, 3 + Math.floor(hash(i, frame, 6) * 7) - Math.floor(k * 4));
    for (let j = 0; j < len; j++) p.px(x, Math.max(0, base - j), flameCols[Math.min(3, Math.floor((j / len) * 4))]);
  }
  return p.canvas;
}
