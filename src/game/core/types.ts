import type { Dir } from '../../engine/input';

export type { Dir };

export const TILE = 16;
export const HALF = TILE / 2;

export const Cell = { Floor: 0, Hard: 1, Soft: 2 } as const;
export type Cell = (typeof Cell)[keyof typeof Cell];

export const DX: Readonly<Record<Dir, number>> = { up: 0, down: 0, left: -1, right: 1 };
export const DY: Readonly<Record<Dir, number>> = { up: -1, down: 1, left: 0, right: 0 };
export const OPPOSITE: Readonly<Record<Dir, Dir>> = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const ALL_DIRS: readonly Dir[] = ['up', 'right', 'down', 'left'];

export function isHorizontal(d: Dir): boolean {
  return d === 'left' || d === 'right';
}

export function perpendicular(d: Dir): [Dir, Dir] {
  return isHorizontal(d) ? ['up', 'down'] : ['left', 'right'];
}

/** Pixel coordinate of the centre of tile index t along one axis. */
export function tileCenter(t: number): number {
  return t * TILE + HALF;
}

export function toTile(px: number): number {
  return Math.floor(px / TILE);
}

/** Bit flags describing which neighbours a flame tile connects to (for drawing). */
export const FLAME_UP = 1;
export const FLAME_RIGHT = 2;
export const FLAME_DOWN = 4;
export const FLAME_LEFT = 8;
export const FLAME_CENTER = 16;

export const FLAME_BIT: Readonly<Record<Dir, number>> = {
  up: FLAME_UP,
  right: FLAME_RIGHT,
  down: FLAME_DOWN,
  left: FLAME_LEFT,
};
