import { describe, expect, it } from 'vitest';
import { ALT_CODES, alternateArena, arenaFor, ARENAS, arenasFor } from '../../src/game/battle/arenas';
import { BattleWorld } from '../../src/game/battle/battleWorld';
import { defaultConfig } from '../../src/game/battle/config';
import { ALL_DIRS, Cell, DX, DY } from '../../src/game/core/types';

const VALID = new Set([...'#._x12345O><^vRLUD@WTSabcde!=skPHF~bipJwBY']);

describe('battle arenas', () => {
  it('has 8 stages per level', () => {
    expect(arenasFor('beginner')).toHaveLength(8);
    expect(arenasFor('normal')).toHaveLength(8);
    expect(arenasFor('advanced')).toHaveLength(8);
  });

  for (const a of ARENAS) {
    it(`${a.id} ${a.name}: 15×13 map with valid tiles and five starts`, () => {
      expect(a.map).toHaveLength(13);
      a.map.forEach((row, y) => {
        expect(row.length, `row ${y}: "${row}"`).toBe(15);
        for (const ch of row) expect(VALID.has(ch), `bad tile "${ch}" in row ${y}`).toBe(true);
      });
      const starts = a.spawns ?? [];
      if (!a.spawns) {
        for (let n = 1; n <= 5; n++) {
          const y = a.map.findIndex((r) => r.includes(String(n)));
          expect(y, `start ${n}`).toBeGreaterThan(0);
          starts.push([a.map[y].indexOf(String(n)), y]);
        }
      }
      expect(starts).toHaveLength(5);
      for (const [x, y] of starts) {
        const ch = a.map[y][x];
        expect('#~'.includes(ch), `start (${x},${y}) is "${ch}"`).toBe(false);
      }
      for (const [k, v] of Object.entries(a.bends ?? {})) {
        const [x, y] = k.split(',').map(Number);
        expect(a.map[y][x]).toBe('J');
        expect(Object.keys(v).length).toBeGreaterThan(0);
      }
      for (const pair of a.portalPairs ?? []) for (const [x, y] of pair) expect(a.map[y][x]).toBe('p');
    });
  }
});


describe('alternate battle stages', () => {
  it('one password per level', () => {
    expect(new Set(Object.values(ALT_CODES))).toEqual(new Set(['beginner', 'normal', 'advanced']));
    for (const code of Object.keys(ALT_CODES)) expect(code).toMatch(/^\d{8}$/);
  });

  for (const def of ARENAS) {
    it(`${def.id}x: fixed blocks, same gimmicks, open starts`, () => {
      const alt = alternateArena(def);
      expect(alt.alternate).toBe(true);
      expect(arenaFor(def.level, arenasFor(def.level).indexOf(def), true)).toBe(alt);
      expect(alt.map).toHaveLength(13);
      // Only '.' tiles of the alternate's own layout change.
      const base = def.alt?.map ?? def.map;
      expect(base).toHaveLength(13);
      alt.map.forEach((row, y) => [...row].forEach((ch, x) => (base[y][x] === '.' ? expect('x_').toContain(ch) : expect(ch).toBe(base[y][x]))));
      for (const row of base) for (const ch of row) expect(VALID.has(ch), `bad tile "${ch}"`).toBe(true);
      const cfg = defaultConfig();
      cfg.level = def.level;
      cfg.players.forEach((p) => (p.type = 'com'));
      const w = new BattleWorld({ cfg, arena: alt, seed: 5 });
      expect(w.grid.count(Cell.Soft)).toBeGreaterThan(5);
      // Every bomber can step off its start tile.
      for (const b of w.bombers) {
        const open = ALL_DIRS.filter((d) => w.bomberCanEnter(b, b.tx + DX[d], b.ty + DY[d]));
        expect(open.length, `start ${b.id} at ${b.tx},${b.ty}`).toBeGreaterThan(0);
      }
      for (let t = 0; t < 300; t++) w.update();
    });
  }
});
