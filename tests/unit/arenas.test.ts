import { describe, expect, it } from 'vitest';
import { ARENAS, arenasFor } from '../../src/game/battle/arenas';

const VALID = new Set([...'#._x12345O><^vRLUD@WTSabcde!=sPHF~biGpJw']);

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
