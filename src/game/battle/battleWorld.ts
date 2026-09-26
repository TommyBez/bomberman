import { Bomber, type Curse } from '../core/bomber';
import { Grid } from '../core/grid';
import { ALL_DIRS, Cell, DX, DY, OPPOSITE, TILE, tileCenter, type Dir } from '../core/types';
import { World, type Bomb } from '../core/world';
import type { ArenaDef } from './arenas';

export const BATTLE_W = 15;
export const BATTLE_H = 13;

export type BattleItem =
  | 'bombs'
  | 'flames'
  | 'speed'
  | 'fullfire'
  | 'kick'
  | 'punch'
  | 'remote'
  | 'skull'
  | 'glove'
  | 'line'
  | 'pierce'
  | 'heart';

export const CURSES: Curse[] = ['slow', 'fast', 'reverse', 'diarrhea', 'noBomb', 'lowFire', 'shortFuse'];
export const CURSE_TICKS = 15 * 60;

export interface BattleOptions {
  players: number;
  /** Round time in ticks (before the Hurry Up pressure blocks). */
  roundTicks: number;
  /** Items hidden under soft blocks: kind → count. */
  items: Partial<Record<BattleItem, number>>;
  /** Fraction of free tiles that receive a soft block. */
  softDensity: number;
  /** Pressure blocks close the arena when time runs out. */
  suddenDeath: boolean;
  arena: ArenaDef;
  /** Handicap: starting bombs / fire per player. */
  startBombs: number[];
  startFire: number[];
}

/** Classic start corners (+ centre for the fifth bomber). */
export function spawnPoints(w: number, h: number): [number, number][] {
  return [
    [1, 1],
    [w - 2, h - 2],
    [w - 2, 1],
    [1, h - 2],
    [Math.floor(w / 2), Math.floor(h / 2)],
  ];
}

export type RoundResult = { winner: number | null; draw: boolean };

export class BattleWorld extends World {
  readonly opts: BattleOptions;
  timeLeft: number;
  hurry = false;
  /** Order of tiles the pressure blocks will fill. */
  private pressureOrder: [number, number][] = [];
  private pressureIndex = 0;
  private pressureTick = 0;
  /** Blocks currently falling: tile → frames until impact. */
  falling: { tx: number; ty: number; t: number }[] = [];
  result: RoundResult | null = null;
  /** Frames since the round result was decided. */
  endTimer = 0;
  /** Frames since the last bomber died (a short grace lets simultaneous deaths draw). */
  private lastDeathTick = -1000;

  constructor(opts: BattleOptions, seed?: number) {
    super(buildArenaGrid(opts.arena), { fuseTicks: 150, flameTicks: 30, burnTicks: 30, chainDelay: 0, maxBombs: 8, maxFire: 8, baseSpeed: 1, speedStep: 0.25, maxSpeedLevel: 4, kickSpeed: 4, throwWraps: true }, seed);
    this.opts = opts;
    this.timeLeft = opts.roundTicks;
    const spawns = opts.arena.spawns ?? spawnPoints(this.grid.w, this.grid.h);
    for (let i = 0; i < opts.players; i++) {
      const [x, y] = spawns[i];
      const b = new Bomber(i, x, y);
      b.stats.bombs = opts.startBombs[i] ?? 1;
      b.stats.fire = opts.startFire[i] ?? 2;
      this.bombers.push(b);
    }
    this.fillSoftBlocks(spawns.slice(0, Math.max(4, opts.players)));
    this.pressureOrder = spiralOrder(this.grid.w, this.grid.h);
  }

  private fillSoftBlocks(spawns: [number, number][]): void {
    const free: [number, number][] = [];
    const reserved = new Set<string>();
    for (const [sx, sy] of spawns) {
      reserved.add(`${sx},${sy}`);
      for (const d of ALL_DIRS) {
        reserved.add(`${sx + DX[d]},${sy + DY[d]}`);
      }
    }
    for (let y = 1; y < this.grid.h - 1; y++) {
      for (let x = 1; x < this.grid.w - 1; x++) {
        if (this.grid.get(x, y) !== Cell.Floor) continue;
        if (reserved.has(`${x},${y}`)) continue;
        if (this.opts.arena.noSoft?.some(([ax, ay]) => ax === x && ay === y)) continue;
        free.push([x, y]);
      }
    }
    this.rng.shuffle(free);
    const n = Math.round(free.length * this.opts.softDensity);
    const soft = free.slice(0, n);
    for (const [x, y] of soft) this.grid.set(x, y, Cell.Soft);
    // Hide the items under soft blocks.
    let i = 0;
    for (const [kind, count] of Object.entries(this.opts.items) as [BattleItem, number][]) {
      for (let c = 0; c < count && i < soft.length; c++, i++) {
        const [x, y] = soft[i];
        this.setItem(x, y, kind, true);
      }
    }
  }

  alive(): Bomber[] {
    return this.bombers.filter((b) => b.alive);
  }

  // ---------------------------------------------------------------- items

  protected override applyItem(b: Bomber, kind: string): void {
    const s = b.stats;
    switch (kind as BattleItem) {
      case 'bombs':
        s.bombs = Math.min(this.rules.maxBombs, s.bombs + 1);
        break;
      case 'flames':
        s.fire = Math.min(this.rules.maxFire, s.fire + 1);
        break;
      case 'fullfire':
        s.fire = this.rules.maxFire;
        s.fullFire = true;
        break;
      case 'speed':
        s.speed = Math.min(this.rules.maxSpeedLevel, s.speed + 1);
        break;
      case 'kick':
        s.kick = true;
        break;
      case 'punch':
        s.punch = true;
        break;
      case 'glove':
        s.glove = true;
        break;
      case 'remote':
        s.remote = true;
        break;
      case 'line':
        s.lineBomb = true;
        break;
      case 'pierce':
        s.pierce = true;
        break;
      case 'heart':
        b.invincible = Math.max(b.invincible, 0);
        break;
      case 'skull': {
        const curse = this.rng.pick(CURSES);
        this.applyCurse(b, curse, CURSE_TICKS);
        this.emit({ type: 'skull', who: b.id, curse });
        break;
      }
    }
  }

  // ---------------------------------------------------------------- special actions

  /** B: remote detonation, else punch the bomb in front, else stop our kicked bombs. */
  protected override onSpecial(b: Bomber): void {
    if (b.stats.remote && this.detonateRemote(b)) return;
    if (b.stats.punch && this.punch(b)) return;
    // Stop any bomb this bomber kicked that is still sliding.
    for (const bomb of this.bombs) {
      if (bomb.slide && bomb.owner === b) {
        bomb.slide = null;
        bomb.x = tileCenter(bomb.tx);
        bomb.y = tileCenter(bomb.ty);
      }
    }
  }

  private punch(b: Bomber): boolean {
    const d = b.facing;
    const tx = b.tx + DX[d];
    const ty = b.ty + DY[d];
    const bomb = this.bombAtTile(tx, ty);
    if (!bomb || bomb.flight) return false;
    const nearX = Math.abs(b.x - tileCenter(b.tx)) < 4;
    const nearY = Math.abs(b.y - tileCenter(b.ty)) < 4;
    if (!(nearX && nearY)) return false;
    this.launch(bomb, d, 3);
    this.emit({ type: 'punch', tx, ty });
    return true;
  }

  /** A on your own bomb with the line-bomb item lays the rest of your bombs in a row. */
  protected override onBombButtonOnBomb(b: Bomber): void {
    if (!b.stats.lineBomb) return;
    const here = this.bombAtTile(b.tx, b.ty);
    if (!here) return;
    const d = b.facing;
    let x = b.tx;
    let y = b.ty;
    while (b.activeBombs < b.stats.bombs) {
      x += DX[d];
      y += DY[d];
      if (!this.canPlaceBomb(b, x, y) || this.tileHasBlockingBody(x, y, null) || this.items[this.idx(x, y)]) break;
      this.placeBomb(b, x, y);
    }
  }

  protected override updateBomber(b: Bomber): void {
    // Glove: hold A on your bomb to lift it, release to throw.
    if (b.alive && b.stats.glove && !b.stunned) {
      if (b.carrying) {
        if (!b.intent.bombHeld) {
          const bomb = b.carrying;
          b.carrying = null;
          this.launch(bomb, b.facing, 3, tileCenter(b.tx), tileCenter(b.ty));
          this.emit({ type: 'punch', tx: b.tx, ty: b.ty });
        }
      } else if (b.intent.bomb) {
        const bomb = this.bombAtTile(b.tx, b.ty);
        if (bomb && !bomb.flight && !bomb.slide && Math.abs(b.x - bomb.x) < 6 && Math.abs(b.y - bomb.y) < 6) {
          this.bombAt[this.idx(bomb.tx, bomb.ty)] = null;
          bomb.held = true;
          b.carrying = bomb;
          b.intent = { ...b.intent, bomb: false };
        }
      }
    }
    super.updateBomber(b);
    if (b.carrying) {
      b.carrying.x = b.x;
      b.carrying.y = b.y - 12;
    }
  }

  // ---------------------------------------------------------------- round flow

  protected override preUpdate(): void {
    if (this.result) {
      this.endTimer++;
      return;
    }
    if (this.timeLeft > 0) {
      this.timeLeft--;
      if (this.timeLeft === 0 && this.opts.suddenDeath) {
        this.hurry = true;
        this.emit({ type: 'hurry' });
      }
    }
    if (this.hurry) this.updatePressure();
  }

  private updatePressure(): void {
    // A new block starts falling every few frames, spiralling inward.
    this.pressureTick++;
    if (this.pressureTick % 8 === 0 && this.pressureIndex < this.pressureOrder.length) {
      const [tx, ty] = this.pressureOrder[this.pressureIndex++];
      this.falling.push({ tx, ty, t: 10 });
    }
    for (const f of this.falling) {
      f.t--;
      if (f.t === 0) this.land(f.tx, f.ty);
    }
    this.falling = this.falling.filter((f) => f.t > 0);
  }

  private land(tx: number, ty: number): void {
    if (this.grid.get(tx, ty) === Cell.Hard) return;
    const i = this.idx(tx, ty);
    this.grid.set(tx, ty, Cell.Hard);
    this.burnTimer[i] = 0;
    this.items[i] = null;
    const bomb = this.bombAt[i];
    if (bomb) {
      // Crushed bombs vanish (they do not explode).
      bomb.exploded = true;
      this.bombs = this.bombs.filter((b) => b !== bomb);
      this.bombAt[i] = null;
      if (bomb.owner) bomb.owner.activeBombs = Math.max(0, bomb.owner.activeBombs - 1);
    }
    for (const b of this.bombers) {
      if (b.alive && b.tx === tx && b.ty === ty) this.kill(b, null);
    }
    this.emit({ type: 'pressure', tx, ty });
  }

  protected override onBomberDeath(): void {
    this.lastDeathTick = this.tick;
  }

  protected override postUpdate(): void {
    // Skull curses spread by touch.
    const living = this.alive();
    for (let i = 0; i < living.length; i++) {
      for (let j = i + 1; j < living.length; j++) {
        const a = living[i];
        const b = living[j];
        if (Math.abs(a.x - b.x) < 10 && Math.abs(a.y - b.y) < 10 && (a.curse || b.curse) && a.curse !== b.curse) {
          if (this.tick % 30 !== 0) continue;
          const ca = a.curse;
          const cta = a.curseTimer;
          if (b.curse) this.applyCurse(a, b.curse, b.curseTimer);
          else a.curse = null;
          if (ca) this.applyCurse(b, ca, cta);
          else b.curse = null;
        }
      }
    }
    if (this.result) return;
    // Wait a moment after a death so simultaneous blasts end in a draw.
    if (living.length <= 1 && this.tick - this.lastDeathTick > 45) {
      this.result = living.length === 1 ? { winner: living[0].id, draw: false } : { winner: null, draw: true };
      if (living.length === 1) {
        living[0].frozen = true;
        living[0].wins++;
      }
      this.endTimer = 0;
    }
  }

  /** Bombers stand on items only after the block burns away; they may also slide over flames. */
  protected override onSlideStop(_bomb: Bomb): void {}
}

/** Tiles of the playable interior in a clockwise spiral from the outer ring inward. */
export function spiralOrder(w: number, h: number): [number, number][] {
  const out: [number, number][] = [];
  let x0 = 1;
  let y0 = 1;
  let x1 = w - 2;
  let y1 = h - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push([x, y0]);
    for (let y = y0 + 1; y <= y1; y++) out.push([x1, y]);
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push([x, y1]);
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push([x0, y]);
    x0++;
    y0++;
    x1--;
    y1--;
  }
  return out;
}

export function buildArenaGrid(arena: ArenaDef): Grid {
  const g = Grid.classic(BATTLE_W, BATTLE_H);
  for (const [x, y] of arena.extraHard ?? []) g.set(x, y, Cell.Hard);
  for (const [x, y] of arena.removeHard ?? []) g.set(x, y, Cell.Floor);
  return g;
}

export function facingOpposite(d: Dir): Dir {
  return OPPOSITE[d];
}

export { TILE };
