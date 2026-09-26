import { describe, expect, it } from 'vitest';
import { Grid } from '../../src/game/core/grid';
import { moveBody, type Body } from '../../src/game/core/movement';
import { Cell, tileCenter } from '../../src/game/core/types';

function world(): { grid: Grid; canEnter: (x: number, y: number) => boolean } {
  const grid = Grid.classic(15, 13);
  return { grid, canEnter: (x, y) => grid.get(x, y) === Cell.Floor };
}

const at = (tx: number, ty: number): Body => ({ x: tileCenter(tx), y: tileCenter(ty) });

describe('moveBody', () => {
  it('moves freely along an open corridor', () => {
    const { canEnter } = world();
    const b = at(1, 1);
    const d = moveBody(b, 'right', 1.5, canEnter);
    expect(d).toBeCloseTo(1.5);
    expect(b.x).toBeCloseTo(tileCenter(1) + 1.5);
    expect(b.y).toBe(tileCenter(1));
  });

  it('stops exactly at the tile centre in front of a wall', () => {
    const { canEnter } = world();
    const b = at(1, 1);
    // (0,1) is the border wall
    const d = moveBody(b, 'left', 3, canEnter);
    expect(d).toBe(0);
    expect(b.x).toBe(tileCenter(1));
    b.x = tileCenter(1) + 2;
    moveBody(b, 'left', 5, canEnter);
    expect(b.x).toBe(tileCenter(1));
  });

  it('cannot walk into a pillar lane from an aligned position', () => {
    const { canEnter } = world();
    // (2,2) is a pillar; from (2,1) going down is blocked.
    const b = at(2, 1);
    expect(moveBody(b, 'down', 2, canEnter)).toBe(0);
  });

  it('slides around a pillar corner (corner assist)', () => {
    const { canEnter } = world();
    // Standing slightly right of column 2's centre on row 1; column 3 leads down.
    const b: Body = { x: tileCenter(2) + 7, y: tileCenter(1) };
    const before = b.x;
    const d = moveBody(b, 'down', 1, canEnter);
    expect(d).toBeGreaterThan(0);
    expect(b.x).toBeGreaterThan(before); // nudged toward column 3
    expect(b.y).toBe(tileCenter(1));
    for (let i = 0; i < 20; i++) moveBody(b, 'down', 1, canEnter);
    expect(b.x).toBe(tileCenter(3));
    expect(b.y).toBeGreaterThan(tileCenter(1));
  });

  it('does not assist when too far from the open lane', () => {
    const { canEnter } = world();
    const b: Body = { x: tileCenter(2) + 2, y: tileCenter(1) };
    expect(moveBody(b, 'down', 1, canEnter)).toBe(0);
  });

  it('re-centres on its own lane when that lane is open', () => {
    const { canEnter } = world();
    const b: Body = { x: tileCenter(1) + 3, y: tileCenter(1) };
    moveBody(b, 'down', 1, canEnter);
    expect(b.x).toBe(tileCenter(1) + 2);
  });

  it('is blocked by soft blocks', () => {
    const { grid, canEnter } = world();
    grid.set(3, 1, Cell.Soft);
    const b = at(2, 1);
    for (let i = 0; i < 10; i++) moveBody(b, 'right', 1, canEnter);
    expect(b.x).toBe(tileCenter(2));
  });
});
