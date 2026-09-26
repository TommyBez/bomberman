import { DX, DY, TILE, isHorizontal, tileCenter, toTile, type Dir } from './types';

/** Anything that walks the grid. Coordinates are the pixel centre of the body. */
export interface Body {
  x: number;
  y: number;
}

export type CanEnter = (tx: number, ty: number) => boolean;

const EPS = 1e-6;
/** How far (px) from the neighbouring lane the corner-assist still kicks in. */
const ASSIST_REACH = 10;

/**
 * Advance a body one tick in direction `dir` using classic Bomberman corridor rules:
 *  - a body may always move inside its own tile toward the tile centre;
 *  - it may pass the centre only if the next tile can be entered;
 *  - when not aligned with the lane of travel it first slides sideways toward the lane
 *    that leads somewhere (the "corner assist" that makes turning around pillars easy).
 * Returns the distance actually travelled (0 = fully blocked).
 */
export function moveBody(body: Body, dir: Dir, speed: number, canEnter: CanEnter, assist = true): number {
  let remaining = speed;
  let travelled = 0;
  while (remaining > EPS) {
    const step = Math.min(1, remaining);
    const d = stepBody(body, dir, step, canEnter, assist);
    if (d <= EPS) break;
    travelled += d;
    remaining -= step;
  }
  return travelled;
}

function stepBody(body: Body, dir: Dir, amount: number, canEnter: CanEnter, assist: boolean): number {
  const horiz = isHorizontal(dir);
  const dx = DX[dir];
  const dy = DY[dir];
  const tx = toTile(body.x);
  const ty = toTile(body.y);
  const cx = tileCenter(tx);
  const cy = tileCenter(ty);
  // Offset from the lane centre on the axis perpendicular to travel.
  const off = horiz ? body.y - cy : body.x - cx;

  if (Math.abs(off) > EPS) {
    if (!assist) return 0;
    const ownOpen = canEnter(tx + dx, ty + dy);
    if (ownOpen) {
      // Slide back to the centre of our own lane.
      const move = Math.min(amount, Math.abs(off));
      if (horiz) body.y -= Math.sign(off) * move;
      else body.x -= Math.sign(off) * move;
      return move;
    }
    // Own lane is blocked: try the neighbouring lane we are leaning toward.
    const s = Math.sign(off);
    const nx = horiz ? tx : tx + s;
    const ny = horiz ? ty + s : ty;
    const distToNeighbour = TILE - Math.abs(off);
    if (distToNeighbour <= ASSIST_REACH && canEnter(nx, ny) && canEnter(nx + dx, ny + dy)) {
      const move = Math.min(amount, distToNeighbour);
      if (horiz) body.y += s * move;
      else body.x += s * move;
      return move;
    }
    return 0;
  }

  // Aligned: snap exactly onto the lane and move along it.
  if (horiz) body.y = cy;
  else body.x = cx;
  const pos = horiz ? body.x : body.y;
  const center = horiz ? cx : cy;
  const sign = horiz ? dx : dy;
  let next = pos + sign * amount;
  const pastCenter = sign > 0 ? next > center : next < center;
  if (pastCenter && !canEnter(tx + dx, ty + dy)) {
    next = center;
  }
  const moved = Math.abs(next - pos);
  if (horiz) body.x = next;
  else body.y = next;
  return moved;
}

/** True when the body sits exactly on a tile centre. */
export function atCenter(body: Body): boolean {
  return (
    Math.abs(body.x - tileCenter(toTile(body.x))) < EPS && Math.abs(body.y - tileCenter(toTile(body.y))) < EPS
  );
}

export function tileOf(body: Body): [number, number] {
  return [toTile(body.x), toTile(body.y)];
}

/** Overlap test between two square bodies with the given half-sizes. */
export function overlaps(a: Body, b: Body, halfA: number, halfB: number): boolean {
  return Math.abs(a.x - b.x) < halfA + halfB && Math.abs(a.y - b.y) < halfA + halfB;
}
