import { describe, expect, it } from 'vitest';
import { CampaignWorld, freshPowers, powersAfterDeath, STAGE_TICKS } from '../../src/game/campaign/campaignWorld';
import { decodePassword, encodePassword, PASSWORD_LENGTH } from '../../src/game/campaign/password';
import { CampaignSession, START_LIVES } from '../../src/game/campaign/session';
import { bonusAfter, BONUS_STAGES, STAGES } from '../../src/game/campaign/stages';
import { Cell, tileCenter } from '../../src/game/core/types';

describe('stage table', () => {
  it('has 50 stages with the original rosters', () => {
    expect(STAGES).toHaveLength(50);
    expect(STAGES[0]).toMatchObject({ item: 'fire', enemies: { balloom: 6 } });
    expect(STAGES[3]).toMatchObject({ item: 'speed', enemies: { balloom: 1, oneal: 1, doll: 2, minvo: 2 } });
    expect(STAGES[49]).toMatchObject({ item: 'flak', enemies: { kondoria: 1, ovapi: 2, pass: 5, pontan: 2 } });
    // Speed Up exists only on stage 4.
    expect(STAGES.filter((s) => s.item === 'speed').map((s) => s.number)).toEqual([4]);
    for (const s of STAGES) {
      const n = Object.values(s.enemies).reduce((a, b) => a + (b ?? 0), 0);
      expect(n).toBeGreaterThanOrEqual(6);
      expect(n).toBeLessThanOrEqual(10);
    }
  });

  it('schedules nine bonus stages after every fifth stage', () => {
    const after = STAGES.map((s) => s.number).filter((n) => bonusAfter(n));
    expect(after).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45]);
    expect(BONUS_STAGES.map((b) => b.enemy)).toEqual(['balloom', 'oneal', 'doll', 'minvo', 'kondoria', 'ovapi', 'pass', 'pontan', 'pontan']);
  });

  it('assigns exactly one hidden panel per stage', () => {
    expect(STAGES[0].secret).toBe('louie');
    expect(STAGES[1].secret).toBe('golden');
    expect(STAGES[2].secret).toBe('nakamoto');
    expect(STAGES[3].secret).toBe('yoyo');
    expect(STAGES[4].secret).toBe('angel');
    expect(STAGES[5].secret).toBe('b');
  });
});

describe('CampaignWorld generation', () => {
  it('builds 50 + 2×stage soft blocks, a hidden exit and item, and the roster', () => {
    for (const n of [1, 20, 50]) {
      const w = new CampaignWorld(STAGES[n - 1], freshPowers(), 1234 + n);
      expect(w.grid.count(Cell.Soft)).toBe(50 + 2 * n);
      expect(w.grid.get(w.exitTx, w.exitTy)).toBe(Cell.Soft);
      const hidden = w.items.filter((it) => it && it.hidden);
      expect(hidden).toHaveLength(1);
      const total = Object.values(STAGES[n - 1].enemies).reduce((a, b) => a + (b ?? 0), 0);
      expect(w.enemies).toHaveLength(total);
      // spawn pocket stays open
      expect(w.grid.get(1, 1)).toBe(Cell.Floor);
      expect(w.grid.get(2, 1)).toBe(Cell.Floor);
      expect(w.grid.get(1, 2)).toBe(Cell.Floor);
      expect(w.timeLeft).toBe(STAGE_TICKS);
    }
  });

  it('releases Pontans when the clock runs out', () => {
    const w = new CampaignWorld(STAGES[0], freshPowers(), 7);
    w.player.invincible = 1e9;
    w.timeLeft = 1;
    w.update();
    expect(w.timeUp).toBe(true);
    expect(w.enemies.filter((e) => e.kind === 'pontan').length).toBeGreaterThan(0);
  });

  it('clears the stage when Bomberman enters the open exit', () => {
    const w = new CampaignWorld(STAGES[0], freshPowers(), 99);
    for (const e of w.enemies) e.alive = false;
    w.enemies = [];
    w.grid.set(w.exitTx, w.exitTy, Cell.Floor);
    w.player.x = tileCenter(w.exitTx);
    w.player.y = tileCenter(w.exitTy);
    w.update();
    expect(w.outcome).toBe('clear');
  });

  it('bombing the revealed exit releases monsters', () => {
    const w = new CampaignWorld(STAGES[0], freshPowers(), 5);
    w.player.invincible = 1e9;
    w.grid.set(w.exitTx, w.exitTy, Cell.Floor);
    const before = w.enemies.length;
    // Put a bomb right on the (now uncovered) exit and blow it up.
    w.player.x = tileCenter(w.exitTx);
    w.player.y = tileCenter(w.exitTy);
    const bomb = w.placeBomb(w.player, w.exitTx + (w.grid.get(w.exitTx + 1, w.exitTy) === Cell.Floor ? 1 : -1), w.exitTy);
    if (bomb) {
      w.explode(bomb);
      expect(w.enemies.length).toBe(before + 8);
    }
  });
});

describe('session', () => {
  it('awards a life for every cleared stage and keeps only fire/bombs after a miss', () => {
    const s = new CampaignSession('modern');
    expect(s.lives).toBe(START_LIVES);
    s.clearStage({ ...freshPowers(), bombs: 3, fire: 2, remote: true });
    expect(s.lives).toBe(START_LIVES + 1);
    expect(s.stageNumber).toBe(2);
    expect(s.loseLife(s.powers)).toBe(true);
    expect(s.powers).toEqual(powersAfterDeath({ ...freshPowers(), bombs: 3, fire: 2, remote: true }));
    expect(s.powers.remote).toBe(false);
    expect(s.powers.bombs).toBe(3);
  });

  it('queues bonus stages and intermissions', () => {
    const s = new CampaignSession('modern');
    s.stageIndex = 4;
    s.clearStage(freshPowers());
    expect(s.pendingBonus?.enemy).toBe('balloom');
    s.stageIndex = 9;
    s.clearStage(freshPowers());
    expect(s.pendingShow).toBe(10);
  });
});

describe('passwords', () => {
  it('round-trips every stage', () => {
    for (let stage = 1; stage <= 50; stage++) {
      const d = { stage, bombs: 1 + (stage % 10), fire: 1 + (stage % 5), modern: stage % 2 === 0 };
      const pw = encodePassword(d, stage * 7);
      expect(pw).toHaveLength(PASSWORD_LENGTH);
      expect(decodePassword(pw)).toEqual(d);
    }
  });

  it('rejects typos', () => {
    const pw = encodePassword({ stage: 12, bombs: 4, fire: 3, modern: true }, 99);
    const typo = (pw[0] === 'A' ? 'B' : 'A') + pw.slice(1);
    expect(decodePassword(typo)).toBeNull();
    expect(decodePassword('SHORT')).toBeNull();
  });
});

describe('memory card', () => {
  it('ignores corrupted save data', async () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const { loadSlots, saveSlot, CampaignSession } = await import('../../src/game/campaign/session');
    store.set('bomberman.saves', '{"not":"an array"}');
    expect(loadSlots()).toEqual([null, null, null]);
    store.set('bomberman.saves', JSON.stringify([{ stage: 99 }, 'junk', null]));
    expect(loadSlots()).toEqual([null, null, null]);
    const s = new CampaignSession('retro');
    s.stageIndex = 11;
    saveSlot(2, s.toSave());
    const slots = loadSlots();
    expect(slots[2]?.stage).toBe(12);
    expect(CampaignSession.fromSave(slots[2]!).version).toBe('retro');
    store.set('bomberman.topScore', '"lots"');
    expect(CampaignSession.topScore()).toBe(0);
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});
