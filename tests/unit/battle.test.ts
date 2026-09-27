import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/engine/rng';
import { alternateArena, ARENAS } from '../../src/game/battle/arenas';
import { BATTLE_FIRE_CAP, BATTLE_MAX_FIRE, BattleWorld, customCounts, HURRY_TICKS, perimeterPath, spiralOrder, stageItems } from '../../src/game/battle/battleWorld';
import { defaultConfig, type BattleConfig } from '../../src/game/battle/config';
import { NO_INTENT, type Bomber } from '../../src/game/core/bomber';
import { ALL_DIRS, Cell, tileCenter } from '../../src/game/core/types';
import { HUT_OPEN_TICKS } from '../../src/game/battle/gimmicks';

function config(level: BattleConfig['level'], players = 5): BattleConfig {
  const cfg = defaultConfig();
  cfg.level = level;
  cfg.players.forEach((p, i) => (p.type = i < players ? 'com' : 'off'));
  cfg.rules.cart = 'on';
  cfg.rules.suddenDeath = 'on';
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

  it('Full Fire reaches edge to edge; Fire items stop at their cap', () => {
    const w = new BattleWorld({ cfg: config('beginner', 2), arena: ARENAS[0], seed: 2 });
    const b = w.bombers[0];
    for (let x = 1; x < w.grid.w - 1; x++) for (const y of [1, w.grid.h - 2]) w.grid.set(x, y, Cell.Floor);
    for (let y = 1; y < w.grid.h - 1; y++) w.grid.set(1, y, Cell.Floor);
    for (let i = 0; i < 20; i++) w.giveItem(b, 'fire', true);
    expect(b.stats.fire).toBe(BATTLE_FIRE_CAP);
    w.giveItem(b, 'fullfire', true);
    const shape = w.bombShape(b, 1, 1);
    const blast = w.computeBlast(1, 1, shape.range, false, null);
    const reached = new Set(blast.tiles.map((t) => `${t.x},${t.y}`));
    expect(reached.has(`${w.grid.w - 2},1`)).toBe(true); // far right column
    expect(reached.has(`1,${w.grid.h - 2}`)).toBe(true); // bottom row
    // A Fire item never lowers maximum fire.
    w.giveItem(b, 'fire', true);
    expect(b.stats.fire).toBe(BATTLE_MAX_FIRE);
  });

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

  it('Impotent lays no bombs at all (not even Multi Bomb); Feeble means firepower 1 on any bomb', () => {
    const w = new BattleWorld({ cfg: config('advanced', 2), arena: ARENAS[0], seed: 2 });
    const b = w.bombers[0];
    b.stats.bombs = 4;
    b.stats.lineBomb = true;
    b.curse = 'impotent';
    expect(w.canPlaceBomb(b)).toBe(false);
    b.intent = { ...NO_INTENT, action: true };
    w.update();
    expect(w.bombs).toHaveLength(0);
    b.curse = 'feeble';
    b.stats.bombType = 'power';
    expect(w.bombShape(b).range).toBe(1);
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

  it('gives Beginner stages only the most basic items, alternates included', () => {
    const basic = new Set(['bomb', 'fire', 'speed', 'kick', 'bombpass', 'skull', 'wallpass']);
    for (const arena of ARENAS.filter((a) => a.level === 'beginner')) {
      for (const def of [arena, alternateArena(arena)]) {
        const items = stageItems('beginner', def);
        for (const [k, n] of Object.entries(items)) if (n) expect(basic.has(k), `${def.id} ${k}`).toBe(true);
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
    cfg.rules.suddenDeath = 'on';
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

  const collide = (kinds: [string, string], squares: [number, number] = [0, 0]) => {
    const w = new BattleWorld({ cfg: config('beginner', 2), arena: ARENAS[0], seed: 8 });
    for (let y = 1; y < 12; y++) for (let x = 1; x < 14; x++) if (w.grid.get(x, y) === Cell.Soft) w.grid.set(x, y, Cell.Floor);
    const [a] = w.bombers;
    a.x = tileCenter(1);
    a.y = tileCenter(9);
    a.stats.bombs = 2;
    const left = w.placeBomb(a, 4, 5)!;
    const right = w.placeBomb(a, 10, 5)!;
    left.kind = kinds[0] as typeof left.kind;
    right.kind = kinds[1] as typeof right.kind;
    left.square = squares[0];
    right.square = squares[1];
    w.startSlide(left, 'right', 3);
    w.startSlide(right, 'left', 3);
    for (let t = 0; t < 40; t++) w.update();
    return { w, a, bombs: w.bombs.filter((x) => !x.exploded) };
  };

  it('merges kicked bombs: Dangerous (5×5), and Super Dangerous (7×7) from two Power Bombs', () => {
    expect(collide(['normal', 'power']).bombs[0]).toMatchObject({ kind: 'super', square: 2 });
    expect(collide(['power', 'power']).bombs[0]).toMatchObject({ kind: 'ultra', square: 3 });
    expect(collide(['super', 'super'], [2, 2]).bombs[0]).toMatchObject({ kind: 'ultra', square: 3 });
  });

  it('a merged bomb gives its owner the bomb slot back when it blows', () => {
    const { w, a, bombs } = collide(['normal', 'normal']);
    expect(a.activeBombs).toBe(1);
    w.explode(bombs[0]);
    expect(a.activeBombs).toBe(0);
  });

  it('Metabomb fire burns through items', () => {
    const w = new BattleWorld({ cfg: config('beginner', 2), arena: ARENAS[0], seed: 8 });
    for (let x = 1; x < 14; x++) w.grid.set(x, 5, Cell.Floor);
    w.setItem(6, 5, 'bomb', false);
    const normal = w.computeBlast(4, 5, 5, false, null, 0);
    const meta = w.computeBlast(4, 5, 5, true, null, 0);
    expect(normal.tiles.some((t) => t.x === 7 && t.y === 5)).toBe(false);
    expect(meta.tiles.some((t) => t.x === 7 && t.y === 5)).toBe(true);
  });

  it('a bomb landing on a bomber stuns them and knocks items loose', () => {
    const w = new BattleWorld({ cfg: config('beginner', 2), arena: ARENAS[0], seed: 8 });
    for (let x = 1; x < 14; x++) w.grid.set(x, 5, Cell.Floor);
    const [a, b] = w.bombers;
    b.x = tileCenter(8);
    b.y = tileCenter(5);
    w.giveItem(b, 'bomb', true);
    w.giveItem(b, 'fire', true);
    a.x = tileCenter(4);
    a.y = tileCenter(5);
    const bomb = w.placeBomb(a)!;
    w.throwTo(bomb, 8, 5);
    for (let t = 0; t < 60 && bomb.flight; t++) w.update();
    expect(b.stunned).toBeGreaterThan(0);
    expect(b.collected).toHaveLength(0);
  });

  it('holding a bomb with the Power Glove bats a thrown bomb straight back', () => {
    const w = new BattleWorld({ cfg: config('normal', 2), arena: ARENAS[0], seed: 8 });
    for (let x = 1; x < 14; x++) w.grid.set(x, 5, Cell.Floor);
    const [a, b] = w.bombers;
    b.x = tileCenter(8);
    b.y = tileCenter(5);
    a.x = tileCenter(4);
    a.y = tileCenter(5);
    w.giveItem(b, 'glove', true);
    const own = w.placeBomb(b)!;
    b.intent = { ...NO_INTENT, bomb: true, bombHeld: true };
    w.update();
    expect(b.carrying).toBe(own);
    b.intent = { ...NO_INTENT, bombHeld: true };
    const bomb = w.placeBomb(a)!;
    w.throwTo(bomb, 8, 5);
    expect(bomb.flight?.dir).toBe('right');
    for (let t = 0; t < 60 && bomb.flight?.dir !== 'left'; t++) w.update();
    expect(bomb.flight?.dir).toBe('left');
    expect(b.stunned).toBe(0);
    expect(b.collected).toContain('glove');
    expect(b.carrying).toBe(own);
  });

  it('hatching Blue Roo gives Bomb Kick and switches Bomb Pass off', () => {
    let found = false;
    for (let seed = 1; seed < 80 && !found; seed++) {
      const w = new BattleWorld({ cfg: config('normal', 2), arena: ARENAS.find((d) => d.level === 'normal')!, seed });
      const b = w.bombers[0];
      w.giveItem(b, 'bombpass', true);
      w.giveItem(b, 'egg', true);
      if (b.partner !== 'louieBlue') continue;
      found = true;
      expect(b.stats).toMatchObject({ kick: true, bombPass: false });
    }
    expect(found).toBe(true);
  });

  it('a blast inside a snow hut lifts the roof only for a while', () => {
    const arena = ARENAS.find((a) => a.id === 'n8')!;
    const w = new BattleWorld({ cfg: config('normal', 2), arena, seed: 3 });
    const i = w.gim.features.findIndex((f) => f?.kind === 'cover' && f.style === 'hut');
    expect(i).toBeGreaterThanOrEqual(0);
    const [x, y] = [i % w.grid.w, Math.floor(i / w.grid.w)];
    w.gim.onBlastAt(x, y);
    expect(w.gim.features[i]).toMatchObject({ kind: 'cover', open: HUT_OPEN_TICKS });
    expect(w.gim.boosts(x, y)).toBe(true);
    for (let t = 0; t < HUT_OPEN_TICKS; t++) w.gim.update();
    expect(w.gim.features[i]).toMatchObject({ kind: 'cover', style: 'hut', open: 0 });
  });

  const advanced = (seed = 4) => {
    const cfg = config('advanced', 2);
    const w = new BattleWorld({ cfg, arena: ARENAS.find((a) => a.id === 'a1')!, seed });
    for (let y = 1; y < 12; y++) for (let x = 1; x < 14; x++) if (w.grid.get(x, y) === Cell.Soft) w.grid.set(x, y, Cell.Floor);
    for (const f of w.gim.features.keys()) w.gim.features[f] = null;
    w.items.fill(null);
    const [a, b] = w.bombers;
    a.x = tileCenter(3);
    a.y = tileCenter(5);
    b.x = tileCenter(9);
    b.y = tileCenter(5);
    return { w, a, b };
  };
  const press = (w: BattleWorld, who: Bomber, intent: Partial<typeof NO_INTENT>, ticks = 1) => {
    for (let t = 0; t < ticks; t++) {
      who.intent = { ...NO_INTENT, ...(t === 0 ? intent : {}) };
      for (const o of w.bombers) if (o !== who) o.intent = NO_INTENT;
      w.update();
    }
  };

  it('Bomber Bazooka: the rocket knocks out whoever it reaches, then ten weak seconds', () => {
    const { w, a, b } = advanced();
    a.character = 'bazooka';
    b.character = 'bomberman';
    press(w, a, { dirs: ['right'], special: true }, 30);
    expect(b.alive).toBe(false);
    expect(a.weak).toBeGreaterThan(0);
    expect(w.bombShape(a).range).toBe(1);
    expect(w.canPlaceBomb(a)).toBe(true);
    w.placeBomb(a);
    expect(w.canPlaceBomb(a, a.tx + 1, a.ty)).toBe(false);
  });

  it('Kotetsu: the shockwave knocks items loose without killing', () => {
    const { w, a, b } = advanced();
    a.character = 'kotetsu';
    w.giveItem(b, 'bomb', true);
    w.giveItem(b, 'fire', true);
    press(w, a, { dirs: ['right'], special: true }, 30);
    expect(b.alive).toBe(true);
    expect(b.stunned).toBeGreaterThan(0);
    expect(b.collected).toHaveLength(0);
  });

  it('Green Roo and Boar charge until blocked; the Boar rams a soft block along', () => {
    const { w, a } = advanced();
    a.partner = 'dox';
    w.grid.set(7, 5, Cell.Soft);
    press(w, a, { dirs: ['right'], special: true }, 40);
    expect(a.dash).toBe(null);
    expect(a.tx).toBe(6);
    expect(w.grid.get(7, 5)).toBe(Cell.Floor);
    expect(w.grid.get(8, 5)).toBe(Cell.Soft);
  });

  it('Monkey lifts a soft block (revealing what it hid) and puts it down again', () => {
    const { w, a } = advanced();
    a.partner = 'simeon';
    a.facing = 'right';
    w.grid.set(4, 5, Cell.Soft);
    w.setItem(4, 5, 'fire', true);
    press(w, a, { special: true }, 1);
    expect(a.liftedBlock).toBe(true);
    expect(w.grid.get(4, 5)).toBe(Cell.Floor);
    expect(w.items[w.idx(4, 5)]?.hidden).toBe(false);
    // Can't put it down on the revealed item; turn and drop it elsewhere.
    press(w, a, { special: true }, 1);
    expect(a.liftedBlock).toBe(true);
    a.facing = 'left';
    press(w, a, { special: true }, 1);
    expect(a.liftedBlock).toBe(false);
    expect(w.grid.get(2, 5)).toBe(Cell.Soft);
  });

  it('Brown Louie lays every bomb you carry in a line; the Multi Bomb item stops at four', () => {
    const { w, a } = advanced();
    a.character = 'bomberman';
    a.stats.bombs = 7;
    a.facing = 'right';
    a.x = tileCenter(1);
    a.y = tileCenter(5);
    a.partner = 'louieBrown';
    press(w, a, { special: true }, 1);
    expect(w.bombs.filter((b) => b.owner === a)).toHaveLength(7);
    for (const b of [...w.bombs]) w.removeBomb(b);
    a.partner = null;
    a.stats.lineBomb = true;
    press(w, a, { action: true }, 1);
    expect(w.bombs.filter((b) => b.owner === a)).toHaveLength(4);
  });

  it('Pink Louie hops a soft block or a bomb, never a pillar', () => {
    const { w, a } = advanced();
    a.character = 'bomberman';
    a.partner = 'louiePink';
    a.x = tileCenter(3);
    a.y = tileCenter(4);
    a.facing = 'right';
    // (4, 4) is a pillar: no hop.
    press(w, a, { special: true }, 1);
    expect(a.airborne).toBe(0);
    // Over a soft block at (4, 3) to (5, 3).
    a.y = tileCenter(3);
    w.grid.set(4, 3, Cell.Soft);
    press(w, a, { special: true }, 1);
    expect(a.airborne).toBeGreaterThan(0);
  });

  it('a Land Mine shows itself when stepped on and goes off a couple of seconds later', () => {
    const { w, a, b } = advanced();
    a.mineNext = true;
    const mine = w.placeBomb(a, 7, 5)!;
    expect(mine.hidden).toBe(true);
    for (let t = 0; t < 40; t++) w.update();
    b.x = tileCenter(7);
    b.y = tileCenter(5);
    b.intent = NO_INTENT;
    w.update();
    expect(mine.hidden).toBe(false);
    expect(mine.exploded).toBe(false);
    for (let t = 0; t < 60; t++) w.update();
    expect(mine.exploded).toBe(false);
    for (let t = 0; t < 70; t++) w.update();
    expect(mine.exploded).toBe(true);
  });

  it('a trapped CPU on Pink Roo jumps over the blocks to safety', () => {
    const { w, a } = advanced();
    a.partner = 'louiePink';
    a.character = 'bomberman';
    w.grid.set(3, 4, Cell.Soft);
    w.grid.set(3, 6, Cell.Soft);
    w.grid.set(3, 3, Cell.Floor);
    w.grid.set(3, 7, Cell.Floor);
    a.stats.bombs = 3;
    for (const x of [2, 4]) {
      const bomb = w.placeBomb(a, x, 5)!;
      bomb.range = 1;
      bomb.fuse = 60;
    }
    a.x = tileCenter(3);
    a.y = tileCenter(5);
    const cpu = new CpuPlayer(w, a, 'strong');
    let jumped = false;
    for (let t = 0; t < 30 && !jumped; t++) {
      a.intent = cpu.think();
      for (const o of w.bombers) if (o !== a) o.intent = NO_INTENT;
      w.update();
      jumped = a.airborne > 0;
    }
    expect(jumped).toBe(true);
  });

  it('a stocked egg brings back the same partner', () => {
    const { w, a } = advanced();
    a.partner = 'drakko';
    a.eggs = 1;
    w.kill(a, null);
    expect(a.alive).toBe(true);
    expect(a.partner).toBe('drakko');
    expect(a.eggs).toBe(0);
  });

  it("Shelly's shell stops fire from behind", () => {
    const { w, a } = advanced();
    a.partner = 'coney';
    a.facing = 'right';
    a.stats.bombs = 2;
    const behind = w.placeBomb(a, 1, 5)!;
    behind.range = 3;
    w.explode(behind);
    w.update();
    expect(a.alive).toBe(true);
    expect(a.partner).toBe('coney');
  });

  it('triangle stops a kicked bomb; square punches without stopping anything', () => {
    const { w, a } = advanced();
    a.stats.kick = true;
    a.stats.punch = true;
    a.stats.bombs = 2;
    const bomb = w.placeBomb(a, 5, 5)!;
    w.startSlide(bomb, 'right', 2);
    bomb.kicker = a;
    press(w, a, { action: true }, 2);
    expect(bomb.slide).toBe('right');
    press(w, a, { stop: true }, 1);
    expect(bomb.slide).toBe(null);
    // Punch the bomb right in front.
    a.facing = 'right';
    const next = w.placeBomb(a, 4, 5)!;
    press(w, a, { action: true }, 1);
    expect(next.flight).not.toBe(null);
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

  it('Sudden Death: Off drops blocks round the edge, On fills the arena', () => {
    const order = (mode: 'off' | 'on', seed = 3): [number, number][] => {
      const cfg = config('normal', 2);
      cfg.rules.suddenDeath = mode;
      return new BattleWorld({ cfg, arena: ARENAS.find((a) => a.id === 'n5')!, seed })['pressureOrder'];
    };
    const off = order('off');
    expect(off.every(([x, y]) => x <= 2 || y <= 2 || x >= 12 || y >= 10)).toBe(true);
    expect(order('on').length).toBeGreaterThan(off.length);
  });

  it('pressure blocks come down fast: several along the top within two seconds of Hurry', () => {
    for (const mode of ['off', 'on'] as const) {
      const cfg = config('normal', 2);
      cfg.rules.suddenDeath = mode;
      cfg.rules.time = 1;
      const w = new BattleWorld({ cfg, arena: ARENAS.find((a) => a.id === 'n5')!, seed: 3 });
      // Out of the blocks' way in the middle.
      w.bombers.forEach((b, i) => {
        b.x = tileCenter(5 + 4 * i);
        b.y = tileCenter(5);
      });
      while (!w['hurry']) w.update();
      for (let t = 0; t < 120; t++) w.update();
      const down = w.falling.length + [...Array(13).keys()].filter((i) => w.grid.get(i + 1, 1) === Cell.Hard).length;
      expect(down, mode).toBeGreaterThanOrEqual(6);
    }
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
  }, 60_000);

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
  }, 60_000);
});
