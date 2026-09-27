import type { Sprite } from '../engine/gfx';
import { CHARACTERS, PARTNERS } from '../game/battle/characters';
import type { Dir } from '../game/core/types';
import {
  arrowTile,
  beltTile,
  bendTile,
  bridgeTile,
  canopySprite,
  cartSprite,
  coverSprite,
  flowerTile,
  drawAccessory,
  fishSprite,
  holeTile,
  iceTile,
  iglooSprite,
  cloudTile,
  partnerSprite,
  pressureBlock,
  railTile,
  robotBody,
  robotFoot,
  seesawPlank,
  seesawTile,
  signTile,
  switchTile,
  trampolineTile,
  trolleySprite,
  tyreSprite,
  warpTile,
  waterTile,
} from './battleArt';
import { BOMBER_COLORS, buildBomber, type BomberColors, type BomberSprites } from './sprites';

const GOLD: BomberColors = {
  name: 'GOLD',
  helmet: ['#fff8c0', '#ffd040', '#c09000'],
  suit: ['#fff0a0', '#e0b020', '#a07800'],
  accent: ['#ffffff', '#fff0a0', '#c0a040'],
  belt: ['#ffffff', '#c0c0c0'],
  ui: '#ffd040',
};

const charCache = new Map<string, BomberSprites>();

/** A player's colours (or gold after winning Hyper Bomber). */
export function bomberColors(color: number, gold = false): BomberColors {
  return gold ? GOLD : BOMBER_COLORS[color % BOMBER_COLORS.length];
}

/** Sprites for a character in a player colour (or gold after winning Hyper Bomber). */
export function characterSprites(character: string, color: number, gold = false): BomberSprites {
  const key = `${character}:${color}:${gold ? 1 : 0}`;
  let s = charCache.get(key);
  if (s) return s;
  const look = CHARACTERS[character]?.look ?? 'none';
  s = buildBomber(bomberColors(color, gold), look === 'none' ? undefined : (p, dir) => drawAccessory(p, look, dir as Dir));
  charCache.set(key, s);
  return s;
}

const headCache = new Map<string, HTMLCanvasElement>();

/**
 * A character's head for the battle HUD: the top of their front-facing sprite, hat, bow or
 * mohawk and all; greyed out once they're knocked out.
 */
export function characterHead(character: string, color: number, gold = false, out = false): HTMLCanvasElement {
  const key = `${character}:${color}:${gold ? 1 : 0}:${out ? 1 : 0}`;
  let c = headCache.get(key);
  if (c) return c;
  const src = characterSprites(character, color, gold).walk.down[0];
  c = document.createElement('canvas');
  c.width = 16;
  c.height = 14;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0, 16, 14, 0, 0, 16, 14);
  if (out) {
    const img = ctx.getImageData(0, 0, 16, 14);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.round((img.data[i] * 0.3 + img.data[i + 1] * 0.59 + img.data[i + 2] * 0.11) * 0.7);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  }
  headCache.set(key, c);
  return c;
}

export interface GimmickSprites {
  belt: Record<Dir, Sprite[]>;
  arrow: Record<Dir, Sprite>;
  arrowSpin: Record<Dir, Sprite>;
  warp: Sprite[];
  trampoline: Sprite[];
  seesaw: Sprite[][]; // [end][down]
  /** Three-tile seesaws (48 wide): left end down, level, right end down. */
  seesawPlank: Sprite[];
  sign: Sprite[]; // 0 = stop, 1..5
  tyre: Sprite;
  rail: Sprite[]; // by connection bits (0..15)
  railWarp: Sprite[];
  switchOn: Sprite;
  switchOff: Sprite;
  speedSwitchOn: Sprite;
  speedSwitchOff: Sprite;
  ice: Sprite[];
  cloud: Sprite[];
  hole: Sprite[];
  water: Sprite[];
  bridgeH: Sprite;
  bridgeV: Sprite;
  flower: Record<Dir, Sprite[]>; // [still, turning]
  hut: Sprite;
  /** 3×3 snow huts: roofed, and with the roof blown off. */
  igloo: Sprite[];
  foliage: Sprite[];
  canopy: Sprite;
  trolley: Record<Dir, Sprite[]>;
  robotBody: Sprite[];
  robotFoot: Sprite;
  fish: Sprite[];
  carts: Sprite[];
  pressure: Sprite;
  partners: Record<string, Record<'left' | 'right', Sprite[]>>;
}

let gim: GimmickSprites | null = null;

export function gimmickSprites(): GimmickSprites {
  if (gim) return gim;
  const dirs: Dir[] = ['up', 'right', 'down', 'left'];
  const rec = <T,>(f: (d: Dir) => T): Record<Dir, T> => Object.fromEntries(dirs.map((d) => [d, f(d)])) as Record<Dir, T>;
  const partners: GimmickSprites['partners'] = {};
  for (const p of PARTNERS) {
    partners[p.kind] = {
      left: [0, 1].map((f) => partnerSprite(p.kind, p.color, f, 'left')),
      right: [0, 1].map((f) => partnerSprite(p.kind, p.color, f, 'right')),
    };
  }
  gim = {
    belt: rec((d) => [0, 1, 2, 3, 4, 5, 6, 7].map((f) => beltTile(d, f))),
    arrow: rec((d) => arrowTile(d, false)),
    arrowSpin: rec((d) => arrowTile(d, true)),
    warp: [0, 1, 2, 3, 4, 5, 6, 7].map(warpTile),
    trampoline: [0, 1, 2].map(trampolineTile),
    seesaw: [0, 1].map((end) => [false, true].map((down) => seesawTile(end as 0 | 1, down))),
    seesawPlank: ([-1, 0, 1] as const).map((t) => seesawPlank(t)),
    sign: [0, 1, 2, 3, 4, 5].map(signTile),
    tyre: tyreSprite(),
    rail: Array.from({ length: 16 }, (_, c) => railTile(c, false)),
    railWarp: Array.from({ length: 16 }, (_, c) => railTile(c, true)),
    switchOn: switchTile(true),
    switchOff: switchTile(false),
    speedSwitchOn: switchTile(true, true),
    speedSwitchOff: switchTile(false, true),
    ice: [iceTile(0), iceTile(1)],
    cloud: [0, 1, 2, 3].map((v) => cloudTile(v)),
    hole: [0, 1, 2, 3].map(holeTile),
    water: [0, 1, 2, 3, 4, 5, 6, 7].map(waterTile),
    bridgeH: bridgeTile(true),
    bridgeV: bridgeTile(false),
    flower: rec((d) => [flowerTile(d, false), flowerTile(d, true)]),
    hut: coverSprite('hut', 0),
    igloo: [iglooSprite(false), iglooSprite(true)],
    foliage: [0, 1, 2].map((v) => coverSprite('foliage', v)),
    canopy: canopySprite(),
    trolley: rec((d) => [0, 1].map((f) => trolleySprite(d, f))),
    robotBody: [0, 1].map(robotBody),
    robotFoot: robotFoot(),
    fish: [0, 1].map(fishSprite),
    carts: BOMBER_COLORS.map((c) => cartSprite(c.suit[1])),
    pressure: pressureBlock('#9aa2b4'),
    partners,
  };
  return gim;
}

export { bendTile };
