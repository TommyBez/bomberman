import { describe, expect, it } from 'vitest';
import { alternateArena, ARENAS, RAIL_ORIGIN, type ArenaDef } from '../../src/game/battle/arenas';
import { HUT_OPEN_TICKS } from '../../src/game/battle/gimmicks';
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

describe('changing rails (Switcheroo)', () => {
  for (const id of ['n4']) {
    const def = ARENAS.find((a) => a.id === id) as ArenaDef;
    it(`${id}: three layouts, six on the alternate, all connected, clear of pillars and starts`, () => {
      expect(def.railLayouts).toHaveLength(3);
      expect([...def.railLayouts!, ...def.altRailLayouts!]).toHaveLength(6);
      const starts = def.spawns!;
      for (const layout of [...def.railLayouts!, ...def.altRailLayouts!]) {
        const tiles = railTiles(layout);
        const key = new Set(tiles.map(([x, y]) => `${x},${y}`));
        for (const [x, y] of tiles) {
          expect(x % 2 === 0 && y % 2 === 0, `rail on a pillar at ${x},${y}`).toBe(false);
          // None comes near a start.
          for (const [sx, sy] of starts) expect(Math.abs(sx - x) + Math.abs(sy - y), `rail at ${x},${y}`).toBeGreaterThan(1);
        }
        for (const [x, y] of def.stations!) expect(key.has(`${x},${y}`), `station ${x},${y}`).toBe(true);
        const holes = railTiles(layout).filter(([x, y]) => layout[y - RAIL_ORIGIN][x - RAIL_ORIGIN] === 'W');
        // One network: every rail reachable from the first (warp holes would join pieces).
        const seen = new Set([`${tiles[0][0]},${tiles[0][1]}`]);
        const queue = [tiles[0]];
        while (queue.length) {
          const [x, y] = queue.pop()!;
          const next = ALL_DIRS.map((d): [number, number] => [x + DX[d], y + DY[d]]);
          if (holes.some(([hx, hy]) => hx === x && hy === y)) next.push(...holes);
          for (const [nx, ny] of next) {
            const k = `${nx},${ny}`;
            if (key.has(k) && !seen.has(k)) {
              seen.add(k);
              queue.push([nx, ny]);
            }
          }
        }
        expect(seen.size).toBe(tiles.length);
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
  it('follows both branches at a junction', () => {
    const w = world('b4');
    const tr = w.gim.trolleys[0];
    // Head right toward the points at (9, 3).
    tr.x = tileCenter(7);
    tr.y = tileCenter(3);
    tr.dir = 'right';
    tr.stop = 0;
    const f = w.gim.trolleyForecast(400);
    const at = (x: number, y: number): number | undefined => f.get(y * w.grid.w + x);
    expect(at(8, 3)).toBeLessThan(at(9, 3)!);
    expect(at(10, 3)).toBeDefined();
    expect(at(9, 4)).toBeDefined();
  });

  it('a warp hole may lead to any of the others', () => {
    const w = world('a4');
    const tr = w.gim.trolleys[0];
    // Along the top rail and down into the hole at (9, 5).
    tr.x = tileCenter(7);
    tr.y = tileCenter(3);
    tr.dir = 'right';
    tr.stop = 0;
    const f = w.gim.trolleyForecast(400);
    const at = (x: number, y: number): number | undefined => f.get(y * w.grid.w + x);
    expect(at(9, 4)).toBeLessThan(at(9, 5)!);
    // Out of any other hole, onto the rail piece that leads away from it.
    for (const [x, y] of [[5, 8], [10, 7], [4, 5]]) {
      expect(at(x, y), `${x},${y}`).toBeDefined();
      expect(at(x, y)!).toBeGreaterThan(at(9, 4)!);
    }
    // And the trolley really goes to a hole other than the one it fell into.
    tr.x = tileCenter(9);
    tr.y = tileCenter(4);
    tr.dir = 'down';
    for (let t = 0; t < 20; t++) w.gim.update();
    expect(['5,5', '5,7', '9,7', '4,5', '5,8', '10,7']).toContain(`${toTile(tr.x)},${toTile(tr.y)}`);
  });

  for (const alternate of [false, true]) {
    it(`Destination Unknown${alternate ? ' (alternate)' : ''}: painted rails, each piece from a dead end into a warp hole`, () => {
      const w = world('a4', alternate);
      const rails = new Set<string>();
      const holes: string[] = [];
      w.gim.features.forEach((f, i) => {
        if (f?.kind !== 'rail') return;
        const k = `${i % w.grid.w},${Math.floor(i / w.grid.w)}`;
        rails.add(k);
        if (f.trolleyWarp) holes.push(k);
      });
      expect(holes).toHaveLength(4);
      const ends = [...rails].filter((k) => {
        const [x, y] = k.split(',').map(Number);
        return ALL_DIRS.filter((d) => rails.has(`${x + DX[d]},${y + DY[d]}`)).length === 1;
      });
      // Four dead ends (the stations) plus the holes at the other ends.
      const dead = ends.filter((k) => !holes.includes(k));
      expect(dead.sort()).toEqual(w.arena.stations!.map(([x, y]) => `${x},${y}`).sort());
      // The rails never change.
      for (let t = 0; t < 60 * 30; t++) w.update();
      const after = new Set<string>();
      w.gim.features.forEach((f, i) => f?.kind === 'rail' && after.add(`${i % w.grid.w},${Math.floor(i / w.grid.w)}`));
      expect(after).toEqual(rails);
    });
  }

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

describe('CPU players and stage hazards', () => {
  it('Robo Bomber: CPUs keep out of the stomp and seldom blow themselves up', () => {
    let selfKills = 0;
    let hits = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const w = world('a2', false, 5, seed * 101);
      const ais = w.bombers.map((b) => new CpuPlayer(w, b, 'normal'));
      const kill = w.kill.bind(w);
      w.kill = (b, killer, force) => {
        if (b.alive) hits++;
        if (b.alive && killer === b && !b.curse) selfKills++;
        kill(b, killer, force);
      };
      for (let t = 0; t < 60 * 110 && !w.result; t++) {
        w.bombers.forEach((b, i) => (b.intent = ais[i].think()));
        w.update();
      }
    }
    // Before CPUs knew about the stomp, half of all hits here were their own bombs.
    expect(selfKills).toBeLessThanOrEqual(Math.max(3, hits * 0.25));
  }, 120_000);

  it('a bomb resting on a belt counts as a threat along the belt, not just where it lies', () => {
    const w = world('b7');
    // Clear the crates off the belt.
    w.gim.features.forEach((f, k) => f?.kind === 'conveyor' && w.grid.set(k % w.grid.w, Math.floor(k / w.grid.w), Cell.Floor));
    const i = w.gim.features.findIndex((f) => f?.kind === 'conveyor');
    const x = i % w.grid.w;
    const y = Math.floor(i / w.grid.w);
    const b = w.bombers[0];
    const bomb = w.placeBomb(b, x, y);
    expect(bomb).toBeTruthy();
    const ai = new CpuPlayer(w, w.bombers[1], 'normal') as unknown as { blastOrigins(b: unknown, fuse: number): [number, number][] };
    expect(ai.blastOrigins(bomb, 150).length).toBeGreaterThan(1);
  });
});

describe('Round and Round flowers', () => {
  const clear = (w: BattleWorld): void => {
    for (let y = 1; y < w.grid.h - 1; y++) for (let x = 1; x < w.grid.w - 1; x++) if (w.grid.get(x, y) === Cell.Soft) w.grid.set(x, y, Cell.Floor);
  };

  it('a blast into a flower bursts out of its partner, which way its mouth faces', () => {
    const w = world('a3');
    clear(w);
    // (3,4) faces up; its partner on the far side of the bush, (5,4), faces down.
    const blast = w.computeBlast(3, 3, 3, false, null);
    const lit = new Set(blast.tiles.map((t) => `${t.x},${t.y}`));
    expect(lit.has('5,5')).toBe(true);
    expect(lit.has('5,6')).toBe(true);
    // A blast that meets the back of a flower stops there.
    const back = new Set(w.computeBlast(3, 5, 3, false, null).tiles.map((t) => `${t.x},${t.y}`));
    expect(back.has('3,3')).toBe(false);
    expect(back.has('5,6')).toBe(false);
  });

  it('pushing against a flower turns it a quarter, clockwise', () => {
    const w = world('a3');
    clear(w);
    const b = w.bombers[0];
    b.x = tileCenter(3);
    b.y = tileCenter(3);
    const f = w.gim.at(3, 4)!;
    expect(f).toMatchObject({ kind: 'flower', face: 'up' });
    b.intent = { ...NO_INTENT, dirs: ['down'] };
    for (let t = 0; t < 30; t++) w.update();
    expect(f).toMatchObject({ kind: 'flower', face: 'right' });
    // Facing the bush now: a blast from above no longer gets in.
    b.intent = NO_INTENT;
    const lit = new Set(w.computeBlast(3, 3, 3, false, null).tiles.map((t) => `${t.x},${t.y}`));
    expect(lit.has('5,5')).toBe(false);
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

describe('stage maps read from the original', () => {
  const clearAll = (w: BattleWorld): void => {
    for (let y = 1; y < w.grid.h - 1; y++) for (let x = 1; x < w.grid.w - 1; x++) if (w.grid.get(x, y) === Cell.Soft) w.grid.set(x, y, Cell.Floor);
  };

  it('SeeSaw Park: three-tile seesaws tip over their pivot and fling what stands on the far end', () => {
    const w = world('b2');
    clearAll(w);
    expect(w.gim.seesaws).toHaveLength(4);
    const s = w.gim.seesaws[0];
    expect([s.a, s.pivot, s.b]).toEqual([[3, 3], [4, 3], [5, 3]]);
    const [me, other] = w.bombers;
    // Whoever stands on the lowered end is thrown when someone steps on the raised one.
    const down = s.down === 0 ? s.a : s.b;
    const up = s.down === 0 ? s.b : s.a;
    other.x = tileCenter(down[0]);
    other.y = tileCenter(down[1]);
    w.update();
    // Standing on the pivot does nothing.
    me.x = tileCenter(4);
    me.y = tileCenter(3);
    w.update();
    expect(other.airborne).toBe(0);
    me.x = tileCenter(up[0]);
    w.update();
    expect(other.airborne).toBeGreaterThan(0);
  });

  it('The Fast Lane: the belts run through the walls, and reversed they still turn the corners', () => {
    const w = world('a7');
    clearAll(w);
    const b = w.bombers[0];
    // On the belt heading up column 5, just below the top wall.
    b.x = tileCenter(5);
    b.y = tileCenter(1);
    b.intent = NO_INTENT;
    for (let t = 0; t < 70; t++) w.update();
    // Out through the gap at the top, back in at the bottom.
    expect(b.ty).toBeGreaterThan(9);
    expect(b.tx).toBe(5);
    expect(w.gim.beltAt(5, 5)!.dir).toBe('up');
    w.gim.beltReverse = true;
    // Reversed, (5, 5) carries things back along row 5, not down off the belt.
    expect(w.gim.beltAt(5, 5)!.dir).toBe('left');
    expect(w.gim.beltAt(9, 5)!.dir).toBe('up');
    expect(w.gim.beltAt(4, 5)!.dir).toBe('left');
  });

  it('a bomb resting on a belt rides it through the wall', () => {
    const w = world('a7');
    clearAll(w);
    const bomb = w.placeBomb(w.bombers[0], 12, 5)!;
    bomb.fuse = 600;
    for (let t = 0; t < 110; t++) w.update();
    // Along row 5 to the right, round through the side walls and on toward the corner.
    expect(bomb.exploded).toBe(false);
    expect(bomb.tx).toBeLessThan(6);
    expect(bomb.ty).toBe(5);
  });

  it('Incoming!: a blast goes in one end of an L-pipe and out of the other', () => {
    const w = world('a6');
    clearAll(w);
    // Leftward into the arm at (4, 3), round the elbow at (3, 3), out of (3, 4) heading down.
    const lit = new Set(w.computeBlast(6, 3, 4, false, null).tiles.map((t) => `${t.x},${t.y}`));
    expect(lit.has('5,3')).toBe(true);
    expect(lit.has('3,5')).toBe(true);
    expect(lit.has('3,6')).toBe(true);
    // A kicked bomb takes the same way round.
    const bomb = w.placeBomb(w.bombers[0], 6, 3)!;
    bomb.fuse = 600;
    w.startSlide(bomb, 'left', 3);
    const path: string[] = [];
    for (let t = 0; t < 40; t++) {
      w.update();
      if (path[path.length - 1] !== `${bomb.tx},${bomb.ty}`) path.push(`${bomb.tx},${bomb.ty}`);
    }
    expect(path.slice(0, 4)).toEqual(['6,3', '5,3', '3,5', '3,6']);
    expect(bomb.slide).not.toBe(null);
  });

  it('Destination Unknown: stars lie on the rails too, and the trolley smashes them', () => {
    let onRails = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const w = world('a4', false, 2, seed);
      w.gim.features.forEach((f, i) => f?.kind === 'rail' && w.grid.get(i % w.grid.w, Math.floor(i / w.grid.w)) === Cell.Soft && onRails++);
      const t = w.gim.trolleys[0];
      expect(w.grid.get(toTile(t.x), toTile(t.y))).toBe(Cell.Floor);
      for (let k = 0; k < 600; k++) {
        w.update();
        expect(w.grid.get(toTile(t.x), toTile(t.y))).not.toBe(Cell.Soft);
      }
    }
    expect(onRails).toBeGreaterThan(0);
  });

  it('The Seven Seas: every bridge starts piled with floats, with items under them', () => {
    const w = world('a8');
    const bridges = w.gim.features.map((f, i) => (f?.kind === 'bridge' ? i : -1)).filter((i) => i >= 0);
    const piled = bridges.filter((i) => w.grid.get(i % w.grid.w, Math.floor(i / w.grid.w)) === Cell.Soft);
    // Bridges and the walkway (24 tiles) are piled; the raft in the middle is clear.
    expect(piled).toHaveLength(24);
    expect(piled.some((i) => w.items[i])).toBe(true);
    expect(w.grid.get(7, 5)).toBe(Cell.Floor);
    // All thirty barrels stand in the sea.
    let barrels = 0;
    for (let y = 1; y < w.grid.h - 1; y++) for (let x = 1; x < w.grid.w - 1; x++) if (w.grid.get(x, y) === Cell.Hard) barrels++;
    expect(barrels).toBe(30);
  });

  it('palms, bushes, trunks and gold boulders are pillars all the same', () => {
    for (const id of ['b8', 'a3', 'a5', 'a6']) {
      const w = world(id);
      const props = w.gim.features.map((f, i) => (f?.kind === 'prop' ? i : -1)).filter((i) => i >= 0);
      expect(props.length, id).toBeGreaterThan(0);
      for (const i of props) expect(w.grid.get(i % w.grid.w, Math.floor(i / w.grid.w))).toBe(Cell.Hard);
    }
  });

  it('Robo Bomber: a foot coming down stuns whoever stands under it', () => {
    const w = world('a2', false, 2, 7);
    const r = w.gim.robot!;
    // Start the next walk: the first foot lifts toward its place round the new goal.
    r.rest = 1;
    w.gim.update();
    const foot = r.feet[0];
    expect(foot.to).not.toBe(null);
    const [tx, ty] = foot.to!;
    expect([tx - r.goal[0], ty - r.goal[1]]).toEqual([-2, -2]);
    // The CPUs see it coming.
    expect(w.gim.robotForecast().get(ty * w.grid.w + tx)).toBeLessThanOrEqual(26);
    const b = w.bombers[0];
    w.grid.set(tx, ty, Cell.Floor);
    b.x = tileCenter(tx);
    b.y = tileCenter(ty);
    b.stats.bombs = 4;
    b.collected.push('bomb', 'bomb', 'bomb');
    b.intent = NO_INTENT;
    for (let t = 0; t < 30; t++) w.update();
    expect(foot.to).toBe(null);
    expect([foot.tx, foot.ty]).toEqual([tx, ty]);
    expect(b.stunned).toBeGreaterThan(0);
    expect(b.stats.bombs).toBeLessThan(4);
  });

  it('Robo Bomber: blocks on every other tile, and the robot strides over them', () => {
    const w = world('a2', false, 2, 7);
    const r = w.gim.robot!;
    let soft = 0;
    for (let y = 1; y < w.grid.h - 1; y++) for (let x = 1; x < w.grid.w - 1; x++) if (w.grid.get(x, y) === Cell.Soft) {
      soft++;
      expect((x + y) % 2).toBe(1);
    }
    expect(soft).toBeGreaterThan(50);
    const start = `${toTile(r.x)},${toTile(r.y)}`;
    const seen = new Set<string>([start]);
    for (let t = 0; t < 60 * 20; t++) {
      w.update();
      seen.add(`${toTile(r.x)},${toTile(r.y)}`);
    }
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe('Normal stages read from the original', () => {
  const clearAll = (w: BattleWorld): void => {
    for (let y = 1; y < w.grid.h - 1; y++) for (let x = 1; x < w.grid.w - 1; x++) if (w.grid.get(x, y) === Cell.Soft) w.grid.set(x, y, Cell.Floor);
  };

  it('Head in the Clouds: the cloud and the sky are two floors, joined only by trampolines', () => {
    const w = world('n3');
    clearAll(w);
    const b = w.bombers[0];
    // On the cloud's edge at (5, 5): the sky at (3, 5) lies beyond a drop.
    b.x = tileCenter(4);
    b.y = tileCenter(5);
    b.intent = { ...NO_INTENT, dirs: ['left'] };
    for (let t = 0; t < 40; t++) w.update();
    expect(b.tx).toBe(4);
    // A blast on the cloud stops at its edge.
    const lit = new Set(w.computeBlast(4, 5, 4, false, null).tiles.map((t) => `${t.x},${t.y}`));
    expect(lit.has('5,5')).toBe(true);
    expect(lit.has('3,5')).toBe(false);
    // A trampoline on the sky throws you onto the cloud.
    b.intent = NO_INTENT;
    b.x = tileCenter(9);
    b.y = tileCenter(1);
    for (let t = 0; t < 120 && !(b.airborne === 0 && w.gim.floorOf(b.tx, b.ty) === 1); t++) w.update();
    expect(w.gim.floorOf(b.tx, b.ty)).toBe(1);
  });

  it('Every Which Way: a pipe only takes a blast by its mouth, and fires it out of its partner\'s', () => {
    const w = world('n6');
    clearAll(w);
    // Down into (5, 4), whose mouth faces up: out of (2, 5), heading right.
    const lit = new Set(w.computeBlast(5, 3, 4, false, null).tiles.map((t) => `${t.x},${t.y}`));
    expect(lit.has('3,5')).toBe(true);
    expect(lit.has('4,5')).toBe(true);
    // From below, the back of the same pipe stops the blast.
    const back = new Set(w.computeBlast(5, 5, 1, false, null).tiles.map((t) => `${t.x},${t.y}`));
    expect(back.has('5,3')).toBe(false);
    expect(back.has('4,5')).toBe(true);
  });

  it('Winter Wonderland: a blast in a big hut lifts its whole roof, and cracked ice gives way to fire', () => {
    const w = world('n8');
    clearAll(w);
    w.gim.onBlastAt(5, 3);
    for (let y = 2; y <= 4; y++) for (let x = 4; x <= 6; x++) expect(w.gim.at(x, y)).toMatchObject({ kind: 'cover', open: HUT_OPEN_TICKS });
    const other = w.gim.at(11, 5);
    expect(other?.kind === 'cover' && other.style === 'hut' && !other.open).toBe(true);
    // A bomb beside the cracked ice at (3, 3): its blast opens a hole there.
    const bomb = w.placeBomb(w.bombers[0], 2, 3)!;
    w.bombers[0].x = tileCenter(1);
    w.bombers[0].y = tileCenter(1);
    w.explode(bomb);
    w.update();
    expect(w.grid.get(3, 3)).toBe(Cell.Void);
    expect(w.gim.at(3, 3)?.kind).toBe('hole');
  });

  it('Switcheroo: every layout runs over the wooden junction where the trolley stops', () => {
    const def = ARENAS.find((a) => a.id === 'n4')!;
    for (const layout of [...def.railLayouts!, ...def.altRailLayouts!]) expect(layout[9 - RAIL_ORIGIN][7 - RAIL_ORIGIN]).toBe('=');
  });
});
