import { describe, expect, it } from 'vitest';
import { Bomber, NO_INTENT } from '../../src/game/core/bomber';
import { Grid } from '../../src/game/core/grid';
import { Cell, FLAME_CENTER, FLAME_LEFT, FLAME_RIGHT, tileCenter } from '../../src/game/core/types';
import { World } from '../../src/game/core/world';

function setup(): { world: World; p: Bomber } {
  const world = new World(Grid.classic(15, 13), { chainDelay: 0 }, 42);
  const p = new Bomber(0, 1, 1);
  world.bombers.push(p);
  return { world, p };
}

function run(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i++) world.update();
}

describe('World bombs', () => {
  it('places a bomb and explodes after the fuse', () => {
    const { world, p } = setup();
    p.stats.fire = 2;
    const bomb = world.placeBomb(p)!;
    expect(bomb).toBeTruthy();
    expect(p.activeBombs).toBe(1);
    p.x = tileCenter(3);
    p.y = tileCenter(3); // step aside onto a safe tile
    run(world, world.rules.fuseTicks - 1);
    expect(world.bombs.length).toBe(1);
    world.update();
    expect(world.bombs.length).toBe(0);
    expect(p.activeBombs).toBe(0);
    expect(world.flameAt(1, 1)).toBe(true);
    expect(world.flameAt(3, 1)).toBe(true);
    expect(world.flameAt(4, 1)).toBe(false); // range 2
    expect(world.flameAt(0, 1)).toBe(false); // border wall
    expect(world.flameBits[world.idx(1, 1)] & FLAME_CENTER).toBeTruthy();
    expect(world.flameBits[world.idx(2, 1)] & (FLAME_LEFT | FLAME_RIGHT)).toBe(FLAME_LEFT | FLAME_RIGHT);
  });

  it('respects bomb capacity and one bomb per tile', () => {
    const { world, p } = setup();
    expect(world.placeBomb(p)).toBeTruthy();
    expect(world.placeBomb(p)).toBeNull();
    p.stats.bombs = 2;
    expect(world.placeBomb(p)).toBeNull(); // same tile
    p.x = tileCenter(3);
    expect(world.placeBomb(p)).toBeTruthy();
    expect(p.activeBombs).toBe(2);
  });

  it('stops at soft blocks and burns them, revealing hidden items', () => {
    const { world, p } = setup();
    p.stats.fire = 5;
    world.grid.set(3, 1, Cell.Soft);
    world.grid.set(5, 1, Cell.Soft);
    world.setItem(3, 1, 'fire', true);
    const bomb = world.placeBomb(p)!;
    p.x = tileCenter(1);
    p.y = tileCenter(3);
    world.explode(bomb);
    expect(world.flameAt(2, 1)).toBe(true);
    expect(world.flameAt(3, 1)).toBe(false);
    expect(world.isBurning(3, 1)).toBe(true);
    expect(world.isBurning(5, 1)).toBe(false); // shielded by the first block
    expect(world.itemAt(3, 1)).toBeNull(); // still hidden while burning
    run(world, world.rules.burnTicks);
    expect(world.grid.get(3, 1)).toBe(Cell.Floor);
    expect(world.itemAt(3, 1)?.kind).toBe('fire');
  });

  it('chains bomb explosions', () => {
    const { world, p } = setup();
    p.stats.bombs = 3;
    p.stats.fire = 2;
    const a = world.placeBomb(p, 1, 1)!;
    world.placeBomb(p, 3, 1);
    world.placeBomb(p, 3, 3);
    p.x = tileCenter(5);
    p.y = tileCenter(5);
    world.explode(a);
    expect(world.bombs.length).toBe(0);
    expect(world.flameAt(5, 1)).toBe(true); // from the second bomb
    expect(world.flameAt(3, 5)).toBe(true); // from the third bomb
  });

  it('kills bombers standing in flames', () => {
    const { world, p } = setup();
    const bomb = world.placeBomb(p)!;
    world.explode(bomb);
    world.update();
    expect(p.alive).toBe(false);
  });

  it('lets the owner walk off a fresh bomb but not back on', () => {
    const { world, p } = setup();
    world.placeBomb(p);
    p.intent = { ...NO_INTENT, dirs: ['right'] };
    run(world, 20);
    expect(p.x).toBeGreaterThanOrEqual(tileCenter(2));
    p.intent = { ...NO_INTENT, dirs: ['left'] };
    run(world, 20);
    expect(p.x).toBe(tileCenter(2)); // blocked by the bomb now
  });

  it('remote bombs wait for the detonator', () => {
    const { world, p } = setup();
    p.stats.remote = true;
    world.placeBomb(p);
    p.x = tileCenter(3);
    p.y = tileCenter(3);
    run(world, world.rules.fuseTicks * 3);
    expect(world.bombs.length).toBe(1);
    p.intent = { ...NO_INTENT, special: true };
    world.update();
    expect(world.bombs.length).toBe(0);
  });

  it('kicked bombs slide until blocked', () => {
    const { world, p } = setup();
    p.stats.kick = true;
    world.placeBomb(p, 3, 1);
    p.intent = { ...NO_INTENT, dirs: ['right'] };
    run(world, 20); // walk up to the bomb and kick it
    p.intent = NO_INTENT;
    run(world, 60);
    const bomb = world.bombs[0];
    expect(bomb.tx).toBe(13); // slid to the far wall
    expect(bomb.slide).toBeNull();
  });
});
