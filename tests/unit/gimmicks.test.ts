import { describe, expect, it } from 'vitest';
import { alternateArena, ARENAS, RAIL_ORIGIN, type ArenaDef } from '../../src/game/battle/arenas';
import { BattleWorld } from '../../src/game/battle/battleWorld';
import { defaultConfig } from '../../src/game/battle/config';
import { CpuPlayer } from '../../src/game/battle/ai';
import { NO_INTENT } from '../../src/game/core/bomber';
import { ALL_DIRS, Cell, DX, DY, tileCenter, toTile } from '../../src/game/core/types';

function world(id: string, alternate = false, players = 2, seed = 4): BattleWorld {
  const def = ARENAS.find((a) => a.id === id)!;
  const cfg = defaultConfig();
  cfg.level = def.level;
  cfg.players.forEach((p, i) => (p.type = i < players ? 'com' : 'off'));
  return new BattleWorld({ cfg, arena: alternate ? alternateArena(def) : def, seed });
}

function railTiles(layout: string[]): [number, number][] {
  const out: [number, number][] = [];
  layout.forEach((row, dy) => [...row].forEach((ch, dx) => ch !== '.' && out.push([RAIL_ORIGIN + dx, RAIL_ORIGIN + dy])));
  return out;
}

describe('changing rails (Switcheroo, Destination Unknown)', () => {
  for (const id of ['n4', 'a4']) {
    const def = ARENAS.find((a) => a.id === id) as ArenaDef;
    it(`${id}: three layouts, six on the alternate, all connected and on open floor`, () => {
      expect(def.railLayouts).toHaveLength(3);
      expect([...def.railLayouts!, ...def.altRailLayouts!]).toHaveLength(6);
      const starts = def.spawns!;
      for (const layout of [...def.railLayouts!, ...def.altRailLayouts!]) {
        const tiles = railTiles(layout);
        const key = new Set(tiles.map(([x, y]) => `${x},${y}`));
        for (const [x, y] of tiles) {
          expect(x % 2 === 0 && y % 2 === 0, `rail on a pillar at ${x},${y}`).toBe(false);
          // The stage's own layouts stay clear of soft blocks; none comes near a start.
          if (def.railLayouts!.includes(layout)) expect(def.map[y][x], `rail at ${x},${y}`).toBe('_');
          for (const [sx, sy] of starts) expect(Math.abs(sx - x) + Math.abs(sy - y), `rail at ${x},${y}`).toBeGreaterThan(1);
        }
        for (const [x, y] of def.stations!) expect(key.has(`${x},${y}`), `station ${x},${y}`).toBe(true);
        // One network: every rail reachable from the first.
        const seen = new Set([`${tiles[0][0]},${tiles[0][1]}`]);
        const queue = [tiles[0]];
        while (queue.length) {
          const [x, y] = queue.pop()!;
          for (const d of ALL_DIRS) {
            const k = `${x + DX[d]},${y + DY[d]}`;
            if (key.has(k) && !seen.has(k)) {
              seen.add(k);
              queue.push([x + DX[d], y + DY[d]]);
            }
          }
        }
        // Destination Unknown's halves may join only through the warp holes.
        if (id === 'n4') expect(seen.size).toBe(tiles.length);
        if (id === 'a4') expect(layout.join('').split('W')).toHaveLength(3);
      }
      const t = def.trolley!;
      expect(railTiles(def.railLayouts![0]).some(([x, y]) => x === t.x && y === t.y)).toBe(true);
    });

    for (const alternate of [false, true]) {
      it(`${id}${alternate ? 'x' : ''}: the rails are relaid now and then, never from under the trolley`, () => {
        const w = world(id, alternate);
        const seen = new Set<number>([w.gim.railLayout]);
        for (let t = 0; t < 60 * 90; t++) {
          w.update();
          seen.add(w.gim.railLayout);
          const tr = w.gim.trolleys[0];
          expect(w.gim.at(toTile(tr.x), toTile(tr.y))?.kind, `tick ${t}`).toBe('rail');
        }
        expect(seen.size).toBeGreaterThan(1);
      });
    }
  }
});

describe('trolley forecast (what the CPU players watch)', () => {
  it('follows both branches at a junction and jumps between warp holes', () => {
    const w = world('a4');
    const tr = w.gim.trolleys[0];
    // Head right along the top rail toward the warp hole at (7, 3).
    tr.x = tileCenter(5);
    tr.y = tileCenter(3);
    tr.dir = 'right';
    tr.stop = 0;
    const f = w.gim.trolleyForecast(400);
    const at = (x: number, y: number): number | undefined => f.get(y * w.grid.w + x);
    expect(at(6, 3)).toBeLessThan(at(7, 3)!);
    // Out of the other hole at (7, 9), still heading right.
    expect(at(8, 9)).toBeDefined();
    expect(at(8, 9)!).toBeLessThan(at(11, 9)!);
  });

  it('counts the wait at a station before the trolley moves on', () => {
    const w = world('b4');
    const tr = w.gim.trolleys[0];
    tr.x = tileCenter(3);
    tr.y = tileCenter(6);
    tr.dir = 'down';
    tr.stop = 80;
    const f = w.gim.trolleyForecast(400);
    expect(f.get(7 * w.grid.w + 3)!).toBeGreaterThanOrEqual(80);
  });

  for (const id of ['n4', 'a4']) {
    it(`${id}: CPU players seldom get run over`, () => {
      let runOver = 0;
      let deaths = 0;
      for (let seed = 1; seed <= 3; seed++) {
        const w = world(id, false, 5, seed * 31);
        const ais = w.bombers.map((b) => new CpuPlayer(w, b, 'normal'));
        const kill = w.kill.bind(w);
        w.kill = (b, killer, force) => {
          if (b.alive && !killer && force) runOver++;
          if (b.alive) deaths++;
          kill(b, killer, force);
        };
        // Stop before Hurry!: falling blocks also kill with no killer.
        for (let t = 0; t < 60 * 110 && !w.result; t++) {
          w.bombers.forEach((b, i) => (b.intent = ais[i].think()));
          w.update();
        }
      }
      expect(runOver).toBeLessThanOrEqual(Math.max(2, deaths * 0.25));
    }, 60_000);
  }
});

describe('Round and Round flowers', () => {
  it('a blast into a flower bursts out of its partner, which way its mouth faces', () => {
    const w = world('a3');
    // (7,4) faces up and is paired with (7,8), which faces down.
    const blast = w.computeBlast(7, 3, 3, false, null);
    const lit = new Set(blast.tiles.map((t) => `${t.x},${t.y}`));
    expect(lit.has('7,9')).toBe(true);
    expect(lit.has('7,10')).toBe(true);
    // A blast that meets the back of a flower stops there.
    const back = w.computeBlast(7, 5, 3, false, null);
    expect(back.tiles.some((t) => t.y > 8)).toBe(false);
  });

  it('pushing against a flower turns it a quarter, clockwise', () => {
    const w = world('a3');
    const b = w.bombers[0];
    w.grid.set(7, 3, Cell.Floor);
    b.x = tileCenter(7);
    b.y = tileCenter(3);
    const f = w.gim.at(7, 4)!;
    expect(f).toMatchObject({ kind: 'flower', face: 'up' });
    b.intent = { ...NO_INTENT, dirs: ['down'] };
    for (let t = 0; t < 30; t++) w.update();
    expect(f).toMatchObject({ kind: 'flower', face: 'right' });
    // Facing a pillar now: a blast from above no longer gets in.
    b.intent = NO_INTENT;
    const lit = new Set(w.computeBlast(7, 3, 3, false, null).tiles.map((t) => `${t.x},${t.y}`));
    expect(lit.has('7,9')).toBe(false);
  });
});

describe('The Fast Lane switches', () => {
  it('blue switches reverse the belts, red switches change their speed', () => {
    const w = world('a7');
    const find = (mode: string): [number, number] => {
      const i = w.gim.features.findIndex((f) => f?.kind === 'switch' && f.mode === mode);
      return [i % w.grid.w, Math.floor(i / w.grid.w)];
    };
    const [rx, ry] = find('reverse');
    const [sx, sy] = find('speed');
    const b = w.bombers[0];
    const stepOn = (x: number, y: number): void => {
      b.x = tileCenter(x) + 16;
      b.y = tileCenter(y);
      w.update();
      b.x = tileCenter(x);
      w.update();
    };
    expect([w.gim.beltReverse, w.gim.beltSpeed]).toEqual([false, 1]);
    stepOn(rx, ry);
    expect([w.gim.beltReverse, w.gim.beltSpeed]).toEqual([true, 1]);
    stepOn(sx, sy);
    expect(w.gim.beltReverse).toBe(true);
    expect(w.gim.beltSpeed).toBeGreaterThan(1);
  });
});

describe('King of the Jungle', () => {
  it('has fixed arrows as well as spinning ones (it grew out of Block World)', () => {
    const w = world('a5');
    const arrows = w.gim.features.filter((f) => f?.kind === 'arrow');
    expect(arrows.some((f) => f?.kind === 'arrow' && f.rotating)).toBe(true);
    expect(arrows.some((f) => f?.kind === 'arrow' && !f.rotating)).toBe(true);
  });
});
