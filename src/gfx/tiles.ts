import { mix } from '../engine/gfx';
import { PixelCanvas } from './pixel';

/** Colour theme for a playfield. All tiles are generated procedurally from it. */
export interface Theme {
  name: string;
  /** Screen colour around the playfield. */
  backdrop: string;
  floor: string;
  floorAlt: string;
  /** Style of floor detail. */
  floorStyle: 'grass' | 'checker' | 'plain' | 'tiles' | 'sand' | 'ice' | 'metal';
  hard: string;
  hardStyle: 'bevel' | 'pillar' | 'stone' | 'crystal';
  wall: string;
  wallStyle: 'bevel' | 'brick' | 'stone' | 'metal';
  soft: string;
  softStyle: 'brick' | 'crate' | 'bush' | 'ice' | 'rock';
}

export const THEMES: Record<string, Theme> = {
  classic: {
    name: 'classic',
    backdrop: '#1a1a1a',
    floor: '#2e8b3a',
    floorAlt: '#35963f',
    floorStyle: 'grass',
    hard: '#a8a8b0',
    hardStyle: 'bevel',
    wall: '#8c8c98',
    wallStyle: 'bevel',
    soft: '#b86838',
    softStyle: 'brick',
  },
};

export interface TileSet {
  floor: HTMLCanvasElement;
  /** Floor with a shadow cast by a block in the tile above. */
  floorShadow: HTMLCanvasElement;
  hard: HTMLCanvasElement;
  wall: HTMLCanvasElement;
  soft: HTMLCanvasElement;
  /** Soft block burning frames. */
  burn: HTMLCanvasElement[];
}

const BURN_FRAMES = 6;

export function buildTiles(theme: Theme): TileSet {
  return {
    floor: floorTile(theme, false),
    floorShadow: floorTile(theme, true),
    hard: hardTile(theme.hard, theme.hardStyle),
    wall: wallTile(theme),
    soft: softTile(theme),
    burn: Array.from({ length: BURN_FRAMES }, (_, i) => burnTile(theme, i)),
  };
}

export const BURN_FRAME_COUNT = BURN_FRAMES;

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
        if (hash(i, 3) > 0.5) p.px(x, Math.max(0, y - 1), mix(t.floorAlt, '#ffffff', 0.15));
      }
      for (let i = 0; i < 6; i++) {
        p.px(Math.floor(hash(i, 7) * 16), Math.floor(hash(i, 8) * 16), mix(t.floor, '#000000', 0.18));
      }
      break;
    case 'checker':
      p.rect(0, 0, 8, 8, t.floorAlt);
      p.rect(8, 8, 8, 8, t.floorAlt);
      break;
    case 'tiles':
      p.rect(0, 15, 16, 1, mix(t.floor, '#000000', 0.25));
      p.rect(15, 0, 1, 16, mix(t.floor, '#000000', 0.25));
      p.rect(0, 0, 15, 1, mix(t.floor, '#ffffff', 0.18));
      p.rect(0, 0, 1, 15, mix(t.floor, '#ffffff', 0.18));
      p.rect(3, 3, 10, 10, t.floorAlt);
      break;
    case 'sand':
      for (let i = 0; i < 24; i++) {
        p.px(Math.floor(hash(i, 11) * 16), Math.floor(hash(i, 12) * 16), i % 2 ? t.floorAlt : mix(t.floor, '#ffffff', 0.2));
      }
      break;
    case 'ice':
      p.rect(0, 0, 16, 16, t.floor);
      for (let i = 0; i < 16; i++) p.px(i, (i * 7) % 16, mix(t.floor, '#ffffff', 0.45));
      p.rect(2, 11, 3, 1, mix(t.floor, '#ffffff', 0.6));
      p.rect(10, 4, 4, 1, mix(t.floor, '#ffffff', 0.6));
      p.rect(0, 15, 16, 1, t.floorAlt);
      p.rect(15, 0, 1, 16, t.floorAlt);
      break;
    case 'metal':
      p.rect(0, 0, 16, 16, t.floor);
      p.rect(0, 0, 16, 1, mix(t.floor, '#ffffff', 0.25));
      p.rect(0, 15, 16, 1, mix(t.floor, '#000000', 0.35));
      p.px(2, 2, t.floorAlt);
      p.px(13, 2, t.floorAlt);
      p.px(2, 13, t.floorAlt);
      p.px(13, 13, t.floorAlt);
      break;
    case 'plain':
      break;
  }
  if (shadow) {
    const sh = mix(t.floor, '#000000', 0.38);
    p.rect(0, 0, 16, 3, sh);
    p.rect(0, 3, 16, 1, mix(t.floor, '#000000', 0.2));
  }
  return p.canvas;
}

/** Indestructible block. */
export function hardTile(base: string, style: Theme['hardStyle']): HTMLCanvasElement {
  const p = new PixelCanvas(16, 16);
  const light = mix(base, '#ffffff', 0.45);
  const lighter = mix(base, '#ffffff', 0.75);
  const dark = mix(base, '#000000', 0.35);
  const darker = mix(base, '#000000', 0.6);
  switch (style) {
    case 'bevel':
    default:
      p.rect(0, 0, 16, 16, darker);
      p.rect(0, 0, 15, 15, light);
      p.rect(1, 1, 14, 14, dark);
      p.rect(1, 1, 13, 13, base);
      p.rect(0, 0, 15, 1, lighter);
      p.rect(0, 0, 1, 15, lighter);
      // inner panel
      p.rect(4, 4, 8, 8, mix(base, '#000000', 0.12));
      p.rect(4, 4, 8, 1, dark);
      p.rect(4, 4, 1, 8, dark);
      p.rect(5, 11, 7, 1, light);
      p.rect(11, 5, 1, 7, light);
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
      p.px(7, 10, light);
      break;
    case 'crystal':
      p.rect(0, 0, 16, 16, darker);
      p.rect(1, 1, 14, 14, base);
      for (let i = 0; i < 7; i++) p.hline(1 + i, 14 - i, 1 + i, i % 2 ? light : lighter);
      for (let i = 0; i < 6; i++) p.hline(2 + i, 13 - i, 14 - i, dark);
      break;
  }
  return p.canvas;
}

function wallTile(t: Theme): HTMLCanvasElement {
  if (t.wallStyle === 'bevel') return hardTile(t.wall, 'bevel');
  const p = new PixelCanvas(16, 16);
  const base = t.wall;
  const light = mix(base, '#ffffff', 0.35);
  const dark = mix(base, '#000000', 0.4);
  if (t.wallStyle === 'brick') {
    p.rect(0, 0, 16, 16, dark);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let col = -1; col < 3; col++) {
        const x = col * 8 + off;
        p.rect(x, row * 4, 7, 3, base);
        p.rect(x, row * 4, 7, 1, light);
      }
    }
  } else if (t.wallStyle === 'stone') {
    p.rect(0, 0, 16, 16, dark);
    p.roundRect(0, 0, 8, 8, base, 1);
    p.roundRect(8, 0, 8, 8, mix(base, '#000000', 0.1), 1);
    p.roundRect(0, 8, 8, 8, mix(base, '#000000', 0.08), 1);
    p.roundRect(8, 8, 8, 8, base, 1);
    p.rect(1, 1, 5, 1, light);
    p.rect(9, 9, 5, 1, light);
  } else {
    p.rect(0, 0, 16, 16, base);
    p.rect(0, 0, 16, 2, light);
    p.rect(0, 14, 16, 2, dark);
    p.px(3, 5, dark);
    p.px(12, 5, dark);
    p.px(3, 10, dark);
    p.px(12, 10, dark);
  }
  return p.canvas;
}

/** Destructible block. */
function softTile(t: Theme): HTMLCanvasElement {
  const p = new PixelCanvas(16, 16);
  const base = t.soft;
  const light = mix(base, '#ffffff', 0.4);
  const dark = mix(base, '#000000', 0.35);
  const mortar = mix(base, '#000000', 0.55);
  switch (t.softStyle) {
    case 'brick':
    default: {
      p.rect(0, 0, 16, 16, mortar);
      const rows = [0, 4, 8, 12];
      rows.forEach((y, r) => {
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
    case 'crate':
      p.rect(0, 0, 16, 16, dark);
      p.rect(1, 1, 14, 14, base);
      p.rect(1, 1, 14, 1, light);
      p.rect(1, 1, 1, 14, light);
      p.rect(1, 7, 14, 2, dark);
      p.rect(7, 1, 2, 14, dark);
      break;
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
      p.circle(8, 9, 7.5, dark);
      p.circle(7.5, 8, 6.6, base);
      p.circle(5.5, 5.5, 2.5, light);
      p.px(10, 11, dark);
      p.px(11, 10, dark);
      break;
  }
  return p.canvas;
}

/** A soft block being consumed by fire. */
function burnTile(t: Theme, frame: number): HTMLCanvasElement {
  const p = new PixelCanvas(16, 16);
  const soft = softTile(t);
  const k = frame / (BURN_FRAMES - 1);
  // The block darkens and crumbles from the top while flames lick it.
  p.ctx.globalAlpha = 1;
  p.ctx.drawImage(soft, 0, 0);
  p.ctx.globalCompositeOperation = 'source-atop';
  p.ctx.fillStyle = `rgba(40,10,0,${0.25 + k * 0.6})`;
  p.ctx.fillRect(0, 0, 16, 16);
  p.ctx.globalCompositeOperation = 'source-over';
  const eaten = Math.floor(k * 14);
  for (let x = 0; x < 16; x++) {
    const h = eaten + Math.floor(hash(x, frame, 3) * 3);
    p.ctx.clearRect(x, 0, 1, Math.min(16, h));
  }
  const flameCols = ['#ff4000', '#ff9a00', '#ffe040', '#ffffff'];
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(hash(i, frame, 9) * 14) + 1;
    const top = Math.min(15, eaten + Math.floor(hash(i, frame, 5) * 6));
    const len = 2 + Math.floor(hash(i, frame, 6) * 5) - Math.floor(k * 3);
    for (let j = 0; j < len; j++) p.px(x, Math.max(0, top - j), flameCols[Math.min(3, j)]);
  }
  return p.canvas;
}
