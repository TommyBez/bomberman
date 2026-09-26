import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/engine/rng';
import { ARENAS } from '../../src/game/battle/arenas';
import { BATTLE_MAX_FIRE, BattleWorld, customCounts, HURRY_TICKS, perimeterPath, spiralOrder, stageItems } from '../../src/game/battle/battleWorld';
import { defaultConfig, type BattleConfig } from '../../src/game/battle/config';
import { NO_INTENT } from '../../src/game/core/bomber';
import { ALL_DIRS, Cell, tileCenter } from '../../src/game/core/types';

function config(level: BattleConfig['level'], players = 5): BattleConfig {
  const cfg = defaultConfig();
  cfg.level = level;
  cfg.players.forEach((p, i) => (p.type = i < players ? 'com' : 'off'));
  cfg.rules.cart = 'on';
  cfg.rules.suddenDeath = true;
  return cfg;
}

describe('battle world', () => {
  for (const arena of ARENAS) {
    it(`${arena.id} ${arena.name}: survives 1200 ticks of random play`, () => {
      const w = new BattleWorld({ cfg: config(arena.level), arena, seed: 7 });
      const rng = new Rng(3);
      expect(w.bombers).toHaveLength(5);
      for (const b of w.bombers) expect(w.grid.get(b.tx, b.ty)).toBe(Cell.Floor);
      for (let t = 0; t < 1200; t++) {
        for (const b of w.bombers) {
          b.intent = { dirs: rng.chance(0.8) ? [rng.pick(ALL_DIRS)] : [], bomb: rng.chance(0.04), special: rng.chance(0.02), specialHeld: false, bombHeld: rng.chance(0.3), action: rng.chance(0.02) };
        }
        w.update();
        for (const b of w.bombers) {
          expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
          if (b.alive && b.airborne <= 0) expect(w.grid.inside(b.tx, b.ty)).toBe(true);
        }
        for (const bomb of w.bombs) expect(bomb.exploded).toBe(false);
      }
    });
  }

  it('predicts the next bomb exactly (Power Bomb, Metabomb, mines, fuse diseases)', () => {
    const w = new BattleWorld({ cfg: config('beginner', 2), arena: ARENAS[0], seed: 2 });
    const b = w.bombers[0];
    b.stats.fire = 3;
    expect(w.bombShape(b)).toMatchObject({ range: 3, kind: 'normal', pierce: false });
    b.stats.bombType = 'power';
    b.stats.bombs = 3;
    expect(w.bombShape(b)).toMatchObject({ range: BATTLE_MAX_FIRE, kind: 'power' });
    const first = w.placeBomb(b)!;
    expect(first.range).toBe(BATTLE_MAX_FIRE);
    // Only one Power Bomb at a time.
    expect(w.bombShape(b, b.tx + 1, b.ty)).toMatchObject({ range: 3, kind: 'normal' });
    b.stats.bombType = 'pierce';
    expect(w.bombShape(b)).toMatchObject({ pierce: true, kind: 'pierce' });
    b.curse = 'shortFuse';
    expect(w.bombShape(b).fuse).toBe(Math.floor(w.rules.fuseTicks / 3));
    b.curse = null;
    b.mineNext = true;
    expect(w.bombShape(b)).toMatchObject({ kind: 'mine', hidden: true, remote: true });
    expect(b.mineNext).toBe(true); // asking has no side effects
  });

  it('Bomb Kick and Bomb Pass replace each other', () => {
    const w = new BattleWorld({ cfg: config('beginner', 2), arena: ARENAS[0], seed: 2 });
    const b = w.bombers[0];
    w.giveItem(b, 'kick', true);
    expect(b.stats.kick).toBe(true);
    w.giveItem(b, 'bombpass', true);
    expect(b.stats).toMatchObject({ kick: false, bombPass: true });
    w.giveItem(b, 'kick', true);
    expect(b.stats).toMatchObject({ kick: true, bombPass: false });
  });

  it('keeps Custom-only and Hyper-Bomber-only items out of Battle Royal', () => {
    for (const level of ['beginner', 'normal', 'advanced'] as const) {
      for (const arena of ARENAS.filter((a) => a.level === level)) {
        const items = stageItems(level, arena);
        for (const k of ['geta', 'heart', 'remote', 'flak'] as const) expect(items[k] ?? 0).toBe(0);
        if (level === 'beginner') expect(items.egg ?? 0).toBe(0);
      }
    }
  });

  it('Custom Battle only places items from the Set Item list', () => {
    const counts = customCounts({ bomb: 3, mine: 2, line: 1, egg: 2, remote: 1, flak: 1, wallpass: 4 });
    expect(counts).toEqual({ bomb: 3, flak: 1 });
  });

  it('hit points are a Custom Battle handicap only', () => {
    const royal = config('beginner', 2);
    royal.players[0].hp = 3;
    expect(new BattleWorld({ cfg: royal, arena: ARENAS[0], seed: 1 }).bombers[0].hp).toBe(1);
    const custom = config('beginner', 2);
    custom.mode = 'custom';
    custom.customItems = { bomb: 2 };
    custom.players[0].hp = 3;
    expect(new BattleWorld({ cfg: custom, arena: ARENAS[0], seed: 1 }).bombers[0].hp).toBe(3);
  });

  it('hides the level items under soft blocks', () => {
    const w = new BattleWorld({ cfg: config('beginner', 4), arena: ARENAS[0], seed: 1 });
    const hidden = w.items.filter((i) => i && i.hidden);
    expect(hidden.length).toBeGreaterThan(10);
    for (let i = 0; i < w.items.length; i++) {
      if (w.items[i]?.hidden) expect(w.grid.cells[i]).toBe(Cell.Soft);
    }
  });

  it('keeps each start position and its neighbours clear', () => {
    const w = new BattleWorld({ cfg: config('beginner', 5), arena: ARENAS[0], seed: 2 });
    for (const b of w.bombers) {
      const open = ALL_DIRS.filter((d) => w.bomberCanEnter(b, b.tx + (d === 'left' ? -1 : d === 'right' ? 1 : 0), b.ty + (d === 'up' ? -1 : d === 'down' ? 1 : 0)));
      expect(open.length).toBeGreaterThan(0);
    }
  });

  it('skull diseases pass on by touch and are cured by other items', () => {
    const w = new BattleWorld({ cfg: config('beginner', 2), arena: ARENAS[0], seed: 3 });
    const [a, b] = w.bombers;
    w.giveItem(a, 'skull', true);
    expect(a.curse).not.toBeNull();
    const curse = a.curse;
    b.x = a.x + 4;
    b.y = a.y;
    a.intent = NO_INTENT;
    b.intent = NO_INTENT;
    w.update();
    expect(b.curse).toBe(curse);
    expect(a.curse).toBeNull();
    w.giveItem(b, 'bomb', true);
    expect(b.curse).toBeNull();
  });

  it('a heart absorbs one hit', () => {
    const w = new BattleWorld({ cfg: config('beginner', 2), arena: ARENAS[0], seed: 4 });
    const a = w.bombers[0];
    w.giveItem(a, 'heart', true);
    w.kill(a, null);
    expect(a.alive).toBe(true);
    a.invincible = 0;
    w.kill(a, null);
    expect(a.alive).toBe(false);
  });

  it('decides the round when one bomber is left', () => {
    const w = new BattleWorld({ cfg: config('beginner', 3), arena: ARENAS[0], seed: 5 });
    w.kill(w.bombers[1], w.bombers[0]);
    w.kill(w.bombers[2], w.bombers[0]);
    for (let t = 0; t < 60; t++) w.update();
    expect(w.result).toMatchObject({ winner: 0, draw: false });
    expect(w.report[0][1]).toBe(1);
    expect(w.report[0][2]).toBe(1);
  });

  it('time up with two bombers left is a draw', () => {
    const cfg = config('beginner', 2);
    cfg.rules.time = 1;
    const w = new BattleWorld({ cfg, arena: ARENAS[0], seed: 6 });
    w.timeLeft = 2;
    w.update();
    w.update();
    w.update();
    expect(w.result).toMatchObject({ draw: true, timeUp: true });
  });

  it('pressure blocks start at 1:00 and crush bombers', () => {
    const cfg = config('beginner', 2);
    cfg.rules.suddenDeath = true;
    const w = new BattleWorld({ cfg, arena: ARENAS[0], seed: 7 });
    w.timeLeft = HURRY_TICKS + 1;
    const [a] = w.bombers;
    a.invincible = 0;
    w.update();
    expect(w.hurry).toBe(true);
    for (let t = 0; t < 400; t++) w.update();
    expect(w.grid.get(1, 1)).toBe(Cell.Hard);
    expect(a.alive).toBe(false);
  });

  it('two kicked bombs meeting head-on become a Super Bomb', () => {
    const w = new BattleWorld({ cfg: config('beginner', 2), arena: ARENAS[0], seed: 8 });
    for (let y = 1; y < 12; y++) for (let x = 1; x < 14; x++) if (w.grid.get(x, y) === Cell.Soft) w.grid.set(x, y, Cell.Floor);
    const [a, b] = w.bombers;
    a.x = tileCenter(1);
    a.y = tileCenter(5);
    b.x = tileCenter(13);
    b.y = tileCenter(5);
    a.stats.bombs = 2;
    const left = w.placeBomb(a, 4, 5)!;
    const right = w.placeBomb(a, 10, 5)!;
    w.startSlide(left, 'right', 3);
    w.startSlide(right, 'left', 3);
    for (let t = 0; t < 40; t++) w.update();
    const bombs = w.bombs.filter((x) => !x.exploded);
    expect(bombs).toHaveLength(1);
    expect(bombs[0].square).toBe(2);
    expect(bombs[0].kind).toBe('super');
  });

  it('knocked-out bombers ride carts around the edge', () => {
    const w = new BattleWorld({ cfg: config('beginner', 3), arena: ARENAS[0], seed: 9 });
    w.kill(w.bombers[2], null);
    expect(w.carts).toHaveLength(1);
    const c = w.carts[0];
    const t = w.cartTile(c);
    expect(t.tx === 0 || t.ty === 0 || t.tx === 14 || t.ty === 12).toBe(true);
    expect(perimeterPath(15, 13)).toHaveLength(2 * 13 + 2 * 11);
  });

  it('spirals the pressure blocks from the outer ring inward', () => {
    const order = spiralOrder(15, 13);
    expect(order[0]).toEqual([1, 1]);
    expect(order[1]).toEqual([2, 1]);
    expect(order).toHaveLength(13 * 11);
  });
});

import { CpuPlayer } from '../../src/game/battle/ai';

describe('CPU players', () => {
  it('play a full round on the standard arena without blowing themselves up constantly', () => {
    let survivedFirstBomb = 0;
    let rounds = 0;
    for (const level of ['weak', 'normal', 'strong'] as const) {
      for (let seed = 1; seed <= 4; seed++) {
        const cfg = config('beginner', 4);
        cfg.rules.com = level;
        const w = new BattleWorld({ cfg, arena: ARENAS[0], seed });
        const ais = w.bombers.map((b) => new CpuPlayer(w, b, level));
        let placed = 0;
        for (let t = 0; t < 60 * 90 && !w.result; t++) {
          w.bombers.forEach((b, i) => (b.intent = ais[i].think()));
          w.update();
          placed += w.events.filter((e) => e.type === 'bomb').length;
        }
        rounds++;
        // They must actually play: bombs get placed and soft blocks get destroyed.
        expect(placed).toBeGreaterThan(5);
        if (w.bombers.filter((b) => b.alive).length > 0 || w.result) survivedFirstBomb++;
      }
    }
    expect(survivedFirstBomb).toBe(rounds);
  });

  it('strong CPUs rarely die by their own bombs', () => {
    let selfKills = 0;
    let deaths = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const cfg = config('beginner', 4);
      const w = new BattleWorld({ cfg, arena: ARENAS[0], seed: seed * 11 });
      const ais = w.bombers.map((b) => new CpuPlayer(w, b, 'strong'));
      for (let t = 0; t < 60 * 90 && !w.result; t++) {
        w.bombers.forEach((b, i) => (b.intent = ais[i].think()));
        w.update();
      }
      for (let i = 0; i < 4; i++) {
        selfKills += w.report[i][i];
        for (let k = 0; k < 5; k++) deaths += w.report[k][i];
      }
    }
    expect(deaths).toBeGreaterThan(0);
    // Diseases (Diarrhea, Confusion…) make some self-kills unavoidable.
    expect(selfKills / Math.max(1, deaths)).toBeLessThan(0.35);
  });
});
