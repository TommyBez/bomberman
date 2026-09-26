import { flipX, mix, pixelSprite, silhouette, type Sprite } from '../engine/gfx';
import { ENEMY_ORDER, type EnemyKind } from '../game/campaign/enemies';
import { FLAME_CENTER, FLAME_DOWN, FLAME_LEFT, FLAME_RIGHT, FLAME_UP } from '../game/core/types';
import { BOMBER_FRAMES, BOMBER_PALETTE } from './art/bomberArt';
import { RETRO_FRAMES, RETRO_PALETTE } from './art/retroArt';
import { ITEM_ICONS, ITEM_PALETTE } from './art/itemArt';
import { drawEnemy, ENEMY_ANIM_FRAMES } from './enemyArt';
import { BOMB_FRAMES, drawBomb, drawFlame, drawPuff, FLAME_PHASES, REMOTE_BOMB_COLORS, RETRO_BOMB_COLORS } from './fx';
import { PixelCanvas } from './pixel';
import { buildTiles, THEMES, type TileSet } from './tiles';

export interface BomberColors {
  name: string;
  helmet: [string, string, string]; // highlight, base, shade
  suit: [string, string, string];
  accent: [string, string, string];
  belt: [string, string];
  /** Colour used for HUD text / win markers. */
  ui: string;
}

export const BOMBER_COLORS: BomberColors[] = [
  { name: 'WHITE', helmet: ['#ffffff', '#e4e4f4', '#a4a4cc'], suit: ['#6aa0ff', '#2c64ec', '#1a3494'], accent: ['#ffb0d6', '#ff4f9a', '#b0205e'], belt: ['#ffe040', '#c08c00'], ui: '#ffffff' },
  { name: 'BLACK', helmet: ['#8a8aa8', '#4a4a64', '#262636'], suit: ['#5a5a70', '#30303e', '#18181e'], accent: ['#ffb0d6', '#ff4f9a', '#b0205e'], belt: ['#ffe040', '#c08c00'], ui: '#a0a0c0' },
  { name: 'RED', helmet: ['#ffd0d0', '#ff5050', '#b01818'], suit: ['#ff9090', '#e02828', '#901010'], accent: ['#fff0a0', '#ffd020', '#b08000'], belt: ['#ffffff', '#a0a0b0'], ui: '#ff6060' },
  { name: 'BLUE', helmet: ['#d0e0ff', '#5890ff', '#2050c0'], suit: ['#80b0ff', '#3068e8', '#1838a0'], accent: ['#ffffff', '#c8d0e8', '#8088a8'], belt: ['#ffe040', '#c08c00'], ui: '#70a0ff' },
  { name: 'GREEN', helmet: ['#d8ffd0', '#58d858', '#208c30'], suit: ['#90f090', '#30b040', '#187020'], accent: ['#fff0a0', '#ffc020', '#b07800'], belt: ['#ffffff', '#a0a0b0'], ui: '#70ff70' },
];

export type BomberDir = 'down' | 'up' | 'left' | 'right';

export interface BomberSprites {
  walk: Record<BomberDir, Sprite[]>; // [stand, stepA, stand, stepB]
  /** Death animation frames. */
  death: Sprite[];
  /** Victory pose frames. */
  win: Sprite[];
  flash: Record<BomberDir, Sprite>;
}

function bomberPalette(c: BomberColors): Record<string, string> {
  return {
    ...BOMBER_PALETTE,
    W: c.helmet[0],
    w: c.helmet[1],
    g: c.helmet[2],
    c: c.suit[0],
    b: c.suit[1],
    B: c.suit[2],
    q: c.accent[0],
    p: c.accent[1],
    P: c.accent[2],
    y: c.belt[0],
    Y: c.belt[1],
  };
}

export function buildBomber(
  c: BomberColors,
  decorate?: (p: PixelCanvas, dir: BomberDir) => void,
  frames: typeof BOMBER_FRAMES = BOMBER_FRAMES,
  palette?: Record<string, string>,
): BomberSprites {
  const pal = palette ?? bomberPalette(c);
  const F = frames;
  const s = (rows: string[], dir: BomberDir): Sprite => {
    const base = pixelSprite(rows, pal);
    if (!decorate) return base;
    const p = new PixelCanvas(16, 24);
    p.ctx.drawImage(base, 0, 0);
    decorate(p, dir);
    return p.canvas;
  };
  const down = [s(F.down0, 'down'), s(F.down1, 'down'), s(F.down0, 'down'), s(F.down2, 'down')];
  const up = [s(F.up0, 'up'), s(F.up1, 'up'), s(F.up0, 'up'), s(F.up2, 'up')];
  const left = [s(F.left0, 'left'), s(F.left1, 'left'), s(F.left0, 'left'), s(F.left2, 'left')];
  const right = decorate
    ? [s(F.left0, 'right'), s(F.left1, 'right'), s(F.left0, 'right'), s(F.left2, 'right')].map(flipX)
    : left.map(flipX);
  // Death: flash, blacken, then crumble into smoke.
  const burnt = pixelSprite(F.down0, {
    ...pal,
    W: '#686878', w: '#484858', g: '#303040', c: '#383848', b: '#282838', B: '#181828',
    s: '#584838', S: '#403020', q: '#605060', p: '#483848', P: '#302030', y: '#504830', Y: '#383020', e: '#ffffff',
    r: '#402020',
  });
  const death: Sprite[] = [
    down[0],
    silhouette(down[0], '#ffffff'),
    down[0],
    silhouette(down[0], '#ffffff'),
    burnt,
    squash(burnt, 0.75),
    squash(burnt, 0.5),
    squash(burnt, 0.28),
  ];
  const win = [s(F.down0, 'down'), s(F.down1, 'down')];
  return {
    walk: { down, up, left, right },
    death,
    win,
    flash: {
      down: silhouette(down[0], '#ffffff'),
      up: silhouette(up[0], '#ffffff'),
      left: silhouette(left[0], '#ffffff'),
      right: silhouette(right[0], '#ffffff'),
    },
  };
}

/** Vertically squash a sprite toward its bottom edge (melting effect). */
function squash(src: Sprite, k: number): Sprite {
  const p = new PixelCanvas(src.width, src.height);
  const h = Math.max(1, Math.round(src.height * k));
  const w = Math.round(src.width * (1 + (1 - k) * 0.4));
  p.ctx.drawImage(src, Math.round((src.width - w) / 2), src.height - h, w, h);
  return p.canvas;
}

export interface EnemySprites {
  right: Sprite[];
  left: Sprite[];
  dead: Sprite;
}

export interface Sprites {
  bombers: BomberSprites[];
  /** 8-bit style Bomberman for the Retro version. */
  retroBomber: BomberSprites;
  bomb: Sprite[];
  remoteBomb: Sprite[];
  retroBomb: Sprite[];
  retroFlame: Sprite[][];
  retroEnemies: Record<EnemyKind, EnemySprites>;
  /** flame[phase][bits] */
  flame: Sprite[][];
  puff: Sprite[];
  tiles: Record<string, TileSet>;
  enemies: Record<EnemyKind, EnemySprites>;
  items: Record<string, Sprite>;
  itemsFlash: Record<string, Sprite>;
  /** NES-style flat yellow panels for the Retro version. */
  retroItems: Record<string, Sprite>;
  retroItemsFlash: Record<string, Sprite>;
  door: Sprite;
  doorOpen: Sprite[];
  retroDoor: Sprite;
  shadow: Sprite;
}

function itemPanel(icon: string[], bg: string): Sprite {
  const p = new PixelCanvas(16, 16);
  p.rect(0, 0, 16, 16, '#000000');
  p.rect(1, 1, 14, 14, mix(bg, '#000000', 0.35));
  p.rect(1, 1, 13, 13, bg);
  p.rect(1, 1, 13, 1, mix(bg, '#ffffff', 0.55));
  p.rect(1, 1, 1, 13, mix(bg, '#ffffff', 0.55));
  p.rows(icon, ITEM_PALETTE, 2, 2);
  return p.canvas;
}

const ITEM_BG: Record<string, string> = {
  skull: '#6a3a8a',
  geta: '#6a3a8a',
  heart: '#e05a90',
  flak: '#3a9a5a',
  egg: '#50a8a0',
};

function retroPanel(icon: string[]): Sprite {
  const p = new PixelCanvas(16, 16);
  p.rect(0, 0, 16, 16, '#000000');
  p.rect(1, 1, 14, 14, '#f8b800');
  p.rect(1, 1, 14, 1, '#fce0a8');
  p.rows(icon, { ...ITEM_PALETTE_RETRO }, 2, 2);
  return p.canvas;
}

/** Retro icons use fewer colours (NES-like). */
const ITEM_PALETTE_RETRO: Record<string, string> = Object.fromEntries(
  Object.keys(ITEM_PALETTE).map((k) => [k, k === 'k' ? '#000000' : ['w', 'G', 'l', 'y', 'V', 'E', 's', 'N', 'q'].includes(k) ? '#fcfcfc' : ['r', 'R', 'p', 'P', 'o', 'n'].includes(k) ? '#d82800' : '#000000']),
);

/**
 * The exit: a pair of doors (PlayStation), closed until every monster is gone,
 * then swinging open (frames 0..3).
 */
function drawDoor(open: number): Sprite {
  const p = new PixelCanvas(16, 16);
  p.rect(0, 0, 16, 16, '#000000');
  p.rect(1, 1, 14, 15, '#8a92a8');
  p.rect(1, 1, 14, 1, '#d8dcef');
  p.rect(1, 1, 1, 15, '#d8dcef');
  p.rect(14, 1, 1, 15, '#4a5068');
  p.rect(3, 3, 10, 13, '#000000');
  if (open === 0) {
    for (const [x0, hinge] of [[4, 4], [8, 11]] as [number, number][]) {
      p.rect(x0, 4, 4, 12, '#b0602a');
      p.rect(x0, 4, 4, 1, '#e09a58');
      p.rect(x0 + 1, 6, 2, 3, '#7a3a10');
      p.rect(x0 + 1, 10, 2, 4, '#7a3a10');
      p.px(hinge, 9, '#ffe040');
    }
    p.vline(7, 4, 15, '#3a1a00');
  } else {
    const w = [3, 2, 1][Math.min(2, open - 1)];
    p.rect(4, 4, 8, 12, '#fff4b0');
    p.rect(5, 5, 6, 11, '#ffffff');
    p.rect(4, 4, w, 12, '#b0602a');
    p.rect(12 - w, 4, w, 12, '#b0602a');
  }
  return p.canvas;
}

function drawRetroDoor(): Sprite {
  const p = new PixelCanvas(16, 16);
  p.rect(0, 0, 16, 16, '#000000');
  p.rect(1, 1, 14, 14, '#bcbcbc');
  p.rect(3, 3, 10, 12, '#000000');
  p.rect(4, 4, 8, 11, '#fcfcfc');
  p.rect(5, 5, 6, 10, '#000000');
  p.rect(1, 1, 14, 1, '#fcfcfc');
  return p.canvas;
}

let cache: Sprites | null = null;

export function sprites(): Sprites {
  if (cache) return cache;
  const bitsList = [
    FLAME_CENTER, FLAME_LEFT, FLAME_RIGHT, FLAME_UP, FLAME_DOWN,
  ];
  void bitsList;
  const flame: Sprite[][] = [];
  const retroFlame: Sprite[][] = [];
  for (let ph = 0; ph < FLAME_PHASES; ph++) {
    const row: Sprite[] = [];
    const rrow: Sprite[] = [];
    for (let bits = 0; bits < 32; bits++) {
      row.push(drawFlame(bits, ph));
      rrow.push(drawFlame(bits, ph, true));
    }
    flame.push(row);
    retroFlame.push(rrow);
  }
  const enemies = {} as Record<EnemyKind, EnemySprites>;
  const retroEnemies = {} as Record<EnemyKind, EnemySprites>;
  for (const k of ENEMY_ORDER) {
    enemies[k] = {
      right: Array.from({ length: ENEMY_ANIM_FRAMES }, (_, i) => drawEnemy(k, i, 'right')),
      left: Array.from({ length: ENEMY_ANIM_FRAMES }, (_, i) => drawEnemy(k, i, 'left')),
      dead: drawEnemy(k, 0, 'right', true),
    };
    retroEnemies[k] = {
      right: Array.from({ length: ENEMY_ANIM_FRAMES }, (_, i) => drawEnemy(k, i, 'right', false, true)),
      left: Array.from({ length: ENEMY_ANIM_FRAMES }, (_, i) => drawEnemy(k, i, 'left', false, true)),
      dead: drawEnemy(k, 0, 'right', true, true),
    };
  }
  const items: Record<string, Sprite> = {};
  const itemsFlash: Record<string, Sprite> = {};
  const retroItems: Record<string, Sprite> = {};
  const retroItemsFlash: Record<string, Sprite> = {};
  for (const [name, icon] of Object.entries(ITEM_ICONS)) {
    const bg = ITEM_BG[name] ?? (name.startsWith('secret_') ? '#e0a020' : '#4a80d0');
    items[name] = itemPanel(icon, bg);
    itemsFlash[name] = itemPanel(icon, mix(bg, '#ffffff', 0.45));
    retroItems[name] = retroPanel(icon);
    retroItemsFlash[name] = silhouette(retroItems[name], '#fcfcfc');
  }
  const shadow = new PixelCanvas(14, 5);
  shadow.ellipse(7, 2.5, 6.5, 2.2, 'rgba(0,0,0,0.35)');
  const tiles: Record<string, TileSet> = {};
  for (const [name, theme] of Object.entries(THEMES)) tiles[name] = buildTiles(theme);
  cache = {
    bombers: BOMBER_COLORS.map((c) => buildBomber(c)),
    retroBomber: buildBomber(BOMBER_COLORS[0], undefined, RETRO_FRAMES, RETRO_PALETTE),
    bomb: Array.from({ length: BOMB_FRAMES }, (_, i) => drawBomb(i)),
    remoteBomb: Array.from({ length: BOMB_FRAMES }, (_, i) => drawBomb(i, REMOTE_BOMB_COLORS)),
    retroBomb: Array.from({ length: BOMB_FRAMES }, (_, i) => drawBomb(i, RETRO_BOMB_COLORS)),
    retroFlame,
    retroEnemies,
    flame,
    puff: [0, 1, 2, 3].map(drawPuff),
    tiles,
    enemies,
    items,
    itemsFlash,
    retroItems,
    retroItemsFlash,
    door: drawDoor(0),
    doorOpen: [1, 2, 3].map(drawDoor),
    retroDoor: drawRetroDoor(),
    shadow: shadow.canvas,
  };
  return cache;
}

/** Tile set for a theme name (built lazily for themes added later). */
export function tileSet(name: string): TileSet {
  const s = sprites();
  if (!s.tiles[name]) s.tiles[name] = buildTiles(THEMES[name] ?? THEMES.m1);
  return s.tiles[name];
}
