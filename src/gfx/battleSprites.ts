import type { Sprite } from '../engine/gfx';
import { CHARACTERS, PARTNERS } from '../game/battle/characters';
import type { Dir } from '../game/core/types';
import {
  arrowTile,
  beltTile,
  bendTile,
  bridgeTile,
  cartSprite,
  coverSprite,
  flowerTile,
  drawAccessory,
  fishSprite,
  holeTile,
  iceTile,
  cloudTile,
  partnerSprite,
  pressureBlock,
  railTile,
  robotSprite,
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

/** Sprites for a character in a player colour (or gold after winning Hyper Bomber). */
export function characterSprites(character: string, color: number, gold = false): BomberSprites {
  const key = `${character}:${color}:${gold ? 1 : 0}`;
  let s = charCache.get(key);
  if (s) return s;
  const look = CHARACTERS[character]?.look ?? 'none';
  const colors = gold ? GOLD : BOMBER_COLORS[color % BOMBER_COLORS.length];
  s = buildBomber(colors, look === 'none' ? undefined : (p, dir) => drawAccessory(p, look, dir as Dir));
  charCache.set(key, s);
  return s;
}

export interface GimmickSprites {
  belt: Record<Dir, Sprite[]>;
  arrow: Record<Dir, Sprite>;
  arrowSpin: Record<Dir, Sprite>;
  warp: Sprite[];
  trampoline: Sprite[];
  seesaw: Sprite[][]; // [end][down]
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
  foliage: Sprite[];
  trolley: Record<Dir, Sprite[]>;
  robot: Sprite[];
  robotStomp: Sprite[];
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
    foliage: [0, 1, 2].map((v) => coverSprite('foliage', v)),
    trolley: rec((d) => [0, 1].map((f) => trolleySprite(d, f))),
    robot: [0, 1, 2].map((f) => robotSprite(f, false, 0)),
    robotStomp: [0, 6, 12].map((lift) => robotSprite(0, true, lift)),
    fish: [0, 1].map(fishSprite),
    carts: BOMBER_COLORS.map((c) => cartSprite(c.suit[1])),
    pressure: pressureBlock('#9aa2b4'),
    partners,
  };
  return gim;
}

export { bendTile };
