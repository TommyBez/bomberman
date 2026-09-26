import { Bomber } from '../core/bomber';
import { Grid } from '../core/grid';
import { overlaps } from '../core/movement';
import { ALL_DIRS, Cell, DX, DY, tileCenter } from '../core/types';
import { World, type Blast, type Bomb, type ItemCell } from '../core/world';
import { Enemy, type EnemyEnv } from './enemy';
import { ENEMY_ORDER, type EnemyKind } from './enemies';
import { SECRET_POINTS, type BonusStageDef, type CampaignItem, type SecretPanel, type StageDef } from './stages';

export type { CampaignItem };

export const CAMPAIGN_W = 31;
export const CAMPAIGN_H = 13;
/** 3:00 on the clock (the NES had 200 s). */
export const STAGE_TICKS = 180 * 60;
export const BONUS_TICKS = 30 * 60;
/** Flak Jacket invincibility. */
export const FLAK_TICKS = 35 * 60;
export const MAX_BOMBS = 10;
export const MAX_FIRE = 5;
export const FUSE_TICKS = 159;
/** Monsters released when the exit door or the stage item is caught in a blast. */
export const PENALTY_SPAWN = 8;
export const TIMEOUT_SPAWN = 10;
/** Bombs needed for the Golden Bomberman panel. */
export const GOLDEN_BOMBS = 248;
/** Soft blocks to break after the last kill for the Nakamoto-san panel. */
export const NAKAMOTO_BLOCKS = 16;

/** Player power-ups that persist between stages (some are lost on a miss). */
export interface PlayerPowers {
  bombs: number;
  fire: number;
  speed: boolean;
  remote: boolean;
  bombpass: boolean;
  wallpass: boolean;
  fireman: boolean;
}

export function freshPowers(): PlayerPowers {
  return { bombs: 1, fire: 1, speed: false, remote: false, bombpass: false, wallpass: false, fireman: false };
}

/** Only Fire and Bomb survive a miss (per the PlayStation manual). */
export function powersAfterDeath(p: PlayerPowers): PlayerPowers {
  return { ...freshPowers(), bombs: p.bombs, fire: p.fire };
}

export type StageOutcome = 'playing' | 'clear' | 'dead';

export interface ScorePopup {
  x: number;
  y: number;
  points: number;
  age: number;
}

export interface SecretState {
  panel: SecretPanel;
  /** Panel is on the field waiting to be collected. */
  shown: boolean;
  tx: number;
  ty: number;
  collected: boolean;
  failed: boolean;
}

export class CampaignWorld extends World implements EnemyEnv {
  enemies: Enemy[] = [];
  readonly player: Bomber;
  readonly stage: StageDef;
  readonly bonus: BonusStageDef | null;
  exitTx = -1;
  exitTy = -1;
  timeLeft: number;
  score = 0;
  outcome: StageOutcome = 'playing';
  /** Frames since the outcome was decided. */
  outcomeTimer = 0;
  popups: ScorePopup[] = [];
  /** Pontans already released because time ran out. */
  timeUp = false;
  kills = 0;
  softTotal = 0;
  softBroken = 0;
  /** Soft blocks broken after the last monster died (Nakamoto-san). */
  softAfterClear = 0;
  secret: SecretState;
  /** Outer-ring tiles walked (Louie / Yo-yo panels). */
  private ring = new Set<number>();
  private ringTotal = 0;
  private killsByBomb = new Map<number, number>();
  private doorOpenAnnounced = false;
  private spawnedFrom = new Set<string>();
  private blastLine: Uint8Array;
  private blastLineTick = -1;

  constructor(stage: StageDef, powers: PlayerPowers, seed: number, bonus: BonusStageDef | null = null) {
    super(
      Grid.classic(CAMPAIGN_W, CAMPAIGN_H),
      {
        fuseTicks: FUSE_TICKS,
        flameTicks: 30,
        burnTicks: 30,
        chainDelay: 0,
        maxBombs: MAX_BOMBS,
        maxFire: MAX_FIRE,
        baseSpeed: 0.75,
        speedStep: 0.25,
        maxSpeedLevel: 1,
        flamesStopAtItems: false,
      },
      seed,
    );
    this.stage = stage;
    this.bonus = bonus;
    this.timeLeft = bonus ? BONUS_TICKS : STAGE_TICKS;
    this.blastLine = new Uint8Array(this.grid.w * this.grid.h);
    this.player = new Bomber(0, 1, 1);
    const s = this.player.stats;
    s.bombs = powers.bombs;
    s.fire = powers.fire;
    s.speed = powers.speed ? 1 : 0;
    s.remote = powers.remote;
    s.bombPass = powers.bombpass;
    s.wallPass = powers.wallpass;
    s.flamePass = powers.fireman;
    this.bombers.push(this.player);
    this.secret = { panel: stage.secret, shown: false, tx: 0, ty: 0, collected: false, failed: !!bonus };
    for (let y = 1; y < this.grid.h - 1; y++) {
      for (let x = 1; x < this.grid.w - 1; x++) if (this.isRing(x, y)) this.ringTotal++;
    }
    if (bonus) this.setupBonus();
    else this.generate();
  }

  /** Current power-ups (to carry into the next stage). */
  powers(): PlayerPowers {
    const s = this.player.stats;
    return {
      bombs: s.bombs,
      fire: s.fire,
      speed: s.speed > 0,
      remote: s.remote,
      bombpass: s.bombPass,
      wallpass: s.wallPass,
      fireman: s.flamePass,
    };
  }

  // ---------------------------------------------------------------- generation

  /** Board generation as in the original: exit brick, item brick, then 50 + 2×stage bricks in all. */
  private generate(): void {
    const rng = this.rng;
    const free: [number, number][] = [];
    for (let y = 1; y < this.grid.h - 1; y++) {
      for (let x = 1; x < this.grid.w - 1; x++) {
        if (this.grid.get(x, y) !== Cell.Floor) continue;
        if (x < 3 && y < 3) continue; // spawn pocket
        free.push([x, y]);
      }
    }
    rng.shuffle(free);
    const softCount = Math.min(free.length - 20, 50 + 2 * this.stage.number);
    const soft = free.slice(0, softCount);
    for (const [x, y] of soft) this.grid.set(x, y, Cell.Soft);
    this.softTotal = softCount;
    [this.exitTx, this.exitTy] = soft[0];
    this.setItem(soft[1][0], soft[1][1], this.stage.item, true);

    // Monsters start on empty floor, a few steps away from the player.
    const spots = free.slice(softCount).filter(([x, y]) => x + y >= 6);
    rng.shuffle(spots);
    let i = 0;
    for (const [kind, count] of Object.entries(this.stage.enemies) as [EnemyKind, number][]) {
      for (let n = 0; n < count; n++) {
        const [x, y] = spots[i++ % spots.length];
        const e = new Enemy(kind, x, y, rng.pick(ALL_DIRS));
        e.walkTimer = 32 + rng.int(97);
        this.enemies.push(e);
      }
    }
  }

  /** Bonus stage: an open field, endless monsters and an invincible Bomberman. */
  private setupBonus(): void {
    this.player.invincible = Number.MAX_SAFE_INTEGER;
    for (let n = 0; n < 8; n++) this.spawnBonusEnemy();
  }

  private spawnBonusEnemy(): void {
    const kind = this.bonus?.enemy ?? 'balloom';
    for (let tries = 0; tries < 60; tries++) {
      const x = 1 + this.rng.int(this.grid.w - 2);
      const y = 1 + this.rng.int(this.grid.h - 2);
      if (this.grid.get(x, y) !== Cell.Floor) continue;
      if (Math.abs(x - this.player.tx) + Math.abs(y - this.player.ty) < 5) continue;
      const e = new Enemy(kind, x, y, this.rng.pick(ALL_DIRS));
      e.grace = 30;
      this.enemies.push(e);
      return;
    }
  }

  // ---------------------------------------------------------------- queries

  exitRevealed(): boolean {
    return this.exitTx >= 0 && this.grid.get(this.exitTx, this.exitTy) === Cell.Floor;
  }

  livingEnemies(): number {
    let n = 0;
    for (const e of this.enemies) if (e.alive) n++;
    return n;
  }

  private isRing(x: number, y: number): boolean {
    return x === 1 || y === 1 || x === this.grid.w - 2 || y === this.grid.h - 2;
  }

  ringProgress(): number {
    return this.ring.size / this.ringTotal;
  }

  enemyCanEnter(e: Enemy, tx: number, ty: number): boolean {
    const c = this.grid.get(tx, ty);
    if (c === Cell.Hard) return false;
    if (c === Cell.Soft && !e.type.wallPass) return false;
    const bomb = this.bombAt[this.idx(tx, ty)];
    if (bomb && !bomb.passers.has(e)) return false;
    return true;
  }

  playerTile(): [number, number] | null {
    const p = this.player;
    if (!p.alive || this.bonus) return null;
    return [p.tx, p.ty];
  }

  inBlastLine(tx: number, ty: number): boolean {
    if (this.blastLineTick !== this.tick) this.computeBlastLines();
    return this.grid.inside(tx, ty) && this.blastLine[this.idx(tx, ty)] === 1;
  }

  private computeBlastLines(): void {
    this.blastLineTick = this.tick;
    this.blastLine.fill(0);
    for (const b of this.bombs) {
      this.blastLine[this.idx(b.tx, b.ty)] = 1;
      for (const d of ALL_DIRS) {
        for (let i = 1; i <= b.range; i++) {
          const x = b.tx + DX[d] * i;
          const y = b.ty + DY[d] * i;
          if (this.grid.get(x, y) !== Cell.Floor) break;
          this.blastLine[this.idx(x, y)] = 1;
        }
      }
    }
    for (let i = 0; i < this.flameTimer.length; i++) if (this.flameTimer[i] > 0) this.blastLine[i] = 1;
  }

  clearLine(ax: number, ay: number, bx: number, by: number, wallPass: boolean): boolean {
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    let x = ax + dx;
    let y = ay + dy;
    while (x !== bx || y !== by) {
      const c = this.grid.get(x, y);
      if (c === Cell.Hard) return false;
      if (c === Cell.Soft && !wallPass) return false;
      if (this.bombAt[this.idx(x, y)]) return false;
      x += dx;
      y += dy;
    }
    return true;
  }

  protected override extraCanPlace(_b: Bomber, tx: number, ty: number): boolean {
    // No bombs on the exit door.
    return !(tx === this.exitTx && ty === this.exitTy);
  }

  protected override tileHasBlockingBody(tx: number, ty: number, self: Bomb | null): boolean {
    if (super.tileHasBlockingBody(tx, ty, self)) return true;
    return this.enemies.some((e) => e.alive && e.tx === tx && e.ty === ty);
  }

  protected override addPassers(bomb: Bomb): void {
    super.addPassers(bomb);
    for (const e of this.enemies) {
      if (e.alive && Math.abs(e.x - bomb.x) < 16 && Math.abs(e.y - bomb.y) < 16) bomb.passers.add(e);
    }
  }

  // ---------------------------------------------------------------- update hooks

  protected override preUpdate(): void {
    if (this.outcome !== 'playing') {
      this.outcomeTimer++;
      return;
    }
    if (this.timeLeft > 0) {
      this.timeLeft--;
      if (this.timeLeft === 0) this.onTimeUp();
    }
    if (this.bonus && this.livingEnemies() < 10 && this.tick % 15 === 0) this.spawnBonusEnemy();
  }

  private onTimeUp(): void {
    if (this.bonus) {
      this.finish('clear');
      return;
    }
    this.timeUp = true;
    this.emit({ type: 'timeUp' });
    // Extra monsters appear all over the stage.
    for (let n = 0; n < TIMEOUT_SPAWN; n++) {
      for (let tries = 0; tries < 80; tries++) {
        const x = 1 + this.rng.int(this.grid.w - 2);
        const y = 1 + this.rng.int(this.grid.h - 2);
        if (this.grid.get(x, y) === Cell.Hard) continue;
        if (Math.abs(x - this.player.tx) + Math.abs(y - this.player.ty) < 7) continue;
        const e = new Enemy('pontan', x, y, this.rng.pick(ALL_DIRS));
        e.grace = 30;
        this.enemies.push(e);
        break;
      }
    }
  }

  protected override updateEnemies(): void {
    for (const e of this.enemies) e.update(this);
    // Drop monsters whose death animation finished.
    this.enemies = this.enemies.filter((e) => e.alive || e.deathTimer < ENEMY_DEATH_TICKS);
  }

  protected override onExplode(bomb: Bomb, _blast: Blast): void {
    // The exit door caught in a blast releases a pack of monsters.
    if (this.exitRevealed() && this.flameAt(this.exitTx, this.exitTy) && this.flameSource[this.idx(this.exitTx, this.exitTy)] === bomb.id) {
      this.release(this.exitTx, this.exitTy, `door:${bomb.id}`);
    }
    if (!this.secret.shown && !this.secret.collected && this.secret.panel === 'golden' && this.bombsExploded >= GOLDEN_BOMBS) {
      this.showSecret();
    }
  }

  protected override onItemBurn(tx: number, ty: number, _it: ItemCell): void {
    this.release(tx, ty, `item:${tx},${ty}`);
  }

  /** A bombed door or item releases a pack of tougher monsters. */
  private release(tx: number, ty: number, key: string): void {
    if (this.bonus || this.spawnedFrom.has(key)) return;
    this.spawnedFrom.add(key);
    const kind = this.penaltyKind();
    for (let n = 0; n < PENALTY_SPAWN; n++) {
      const e = new Enemy(kind, tx, ty, ALL_DIRS[n % 4]);
      e.grace = 40;
      e.walkTimer = 16 + this.rng.int(64);
      this.enemies.push(e);
    }
    this.emit({ type: 'spawn', tx, ty });
  }

  /** Monster released as a penalty: one step tougher than the stage's toughest. */
  penaltyKind(): EnemyKind {
    if (this.timeUp) return 'pontan';
    let top = 0;
    for (const [kind, count] of Object.entries(this.stage.enemies) as [EnemyKind, number][]) {
      if (count > 0) top = Math.max(top, ENEMY_ORDER.indexOf(kind));
    }
    return ENEMY_ORDER[Math.min(ENEMY_ORDER.length - 1, top + 1)];
  }

  protected override onSoftHit(tx: number, ty: number, bomb: Bomb): void {
    super.onSoftHit(tx, ty, bomb);
    // Wall-passing monsters inside a bombed block are caught as well.
    for (const e of this.enemies) {
      if (e.alive && e.grace <= 0 && e.tx === tx && e.ty === ty) this.killEnemy(e, bomb.id);
    }
  }

  protected override applyFlames(): void {
    super.applyFlames();
    for (const e of this.enemies) {
      if (!e.alive || e.grace > 0) continue;
      const i = this.idx(e.tx, e.ty);
      if (this.flameTimer[i] > 0) this.killEnemy(e, this.flameSource[i]);
    }
  }

  /** Kill a monster; several from the same bomb double in value one after another. */
  private killEnemy(e: Enemy, bombId: number): void {
    e.alive = false;
    e.deathTimer = 0;
    this.kills++;
    const n = this.killsByBomb.get(bombId) ?? 0;
    this.killsByBomb.set(bombId, n + 1);
    const points = e.type.points * Math.pow(2, Math.min(n, 10));
    this.addScore(points, e.x, e.y);
    this.emit({ type: 'enemyDeath', x: e.x, y: e.y, points, kind: e.kind });
    const sp = this.secret.panel;
    if ((sp === 'b' || sp === 'yoyo' || sp === 'angel') && !this.secret.shown) this.secret.failed = true;
    if (this.livingEnemies() === 0) this.ring.clear();
  }

  addScore(points: number, x: number, y: number): void {
    this.score += points;
    this.popups.push({ x, y, points, age: 0 });
  }

  protected override onBlockGone(tx: number, ty: number): void {
    super.onBlockGone(tx, ty);
    this.softBroken++;
    if (!this.bonus && this.livingEnemies() === 0) this.softAfterClear++;
    if (tx === this.exitTx && ty === this.exitTy) this.emit({ type: 'door', tx, ty });
  }

  protected override applyItem(b: Bomber, kind: string): void {
    const s = b.stats;
    switch (kind as CampaignItem) {
      case 'bomb':
        s.bombs = Math.min(MAX_BOMBS, s.bombs + 1);
        break;
      case 'fire':
        s.fire = Math.min(MAX_FIRE, s.fire + 1);
        break;
      case 'speed':
        s.speed = 1;
        break;
      case 'wallpass':
        s.wallPass = true;
        break;
      case 'remote':
        s.remote = true;
        break;
      case 'bombpass':
        s.bombPass = true;
        break;
      case 'fireman':
        s.flamePass = true;
        break;
      case 'flak':
        b.invincible = FLAK_TICKS;
        break;
    }
    this.addScore(1000, tileCenter(b.tx), tileCenter(b.ty));
  }

  private finish(outcome: StageOutcome): void {
    this.outcome = outcome;
    this.outcomeTimer = 0;
    if (outcome === 'clear') {
      this.player.frozen = true;
      this.emit({ type: 'stageClear' });
    }
  }

  // ---------------------------------------------------------------- secrets

  private updateSecret(): void {
    const s = this.secret;
    const p = this.player;
    if (this.bonus || s.collected || s.failed) return;
    if (s.shown) {
      if (p.tx === s.tx && p.ty === s.ty) {
        s.collected = true;
        s.shown = false;
        const pts = SECRET_POINTS[s.panel];
        this.addScore(pts, tileCenter(s.tx), tileCenter(s.ty));
        this.emit({ type: 'item', tx: s.tx, ty: s.ty, item: `secret:${s.panel}`, who: 0 });
      }
      return;
    }
    const cleared = this.livingEnemies() === 0;
    if (this.isRing(p.tx, p.ty) && this.grid.get(p.tx, p.ty) === Cell.Floor) {
      if ((s.panel === 'louie' && cleared) || (s.panel === 'yoyo' && this.kills === 0)) this.ring.add(this.idx(p.tx, p.ty));
    }
    switch (s.panel) {
      case 'b':
        if (this.kills === 0 && this.exitRevealed() && p.tx === this.exitTx && p.ty === this.exitTy) this.showSecret();
        break;
      case 'louie':
      case 'yoyo':
        if (this.ring.size >= this.ringTotal) this.showSecret();
        break;
      case 'nakamoto':
        if (cleared && this.softAfterClear >= NAKAMOTO_BLOCKS) this.showSecret();
        break;
      case 'angel':
        if (this.kills === 0 && this.softBroken >= this.softTotal) this.showSecret();
        break;
      case 'golden':
        break;
    }
  }

  private showSecret(): void {
    const s = this.secret;
    if (s.shown || s.collected) return;
    // Appear on an empty floor tile close to Bomberman.
    const p = this.player;
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let y = 1; y < this.grid.h - 1; y++) {
      for (let x = 1; x < this.grid.w - 1; x++) {
        if (this.grid.get(x, y) !== Cell.Floor || this.bombAt[this.idx(x, y)] || this.items[this.idx(x, y)]) continue;
        if (x === this.exitTx && y === this.exitTy) continue;
        const d = Math.abs(x - p.tx) + Math.abs(y - p.ty);
        if (d >= 3 && d < bestD) {
          bestD = d;
          best = [x, y];
        }
      }
    }
    if (!best) return;
    s.tx = best[0];
    s.ty = best[1];
    s.shown = true;
    this.emit({ type: 'door', tx: s.tx, ty: s.ty });
  }

  // ---------------------------------------------------------------- end of tick

  protected override postUpdate(): void {
    for (const p of this.popups) p.age++;
    this.popups = this.popups.filter((p) => p.age < 60);
    if (this.killsByBomb.size > 64) this.killsByBomb.clear();
    const p = this.player;
    if (this.outcome !== 'playing') return;

    // Touching a monster is fatal (unless invincible).
    if (p.alive && p.invincible <= 0) {
      for (const e of this.enemies) {
        if (e.alive && overlaps(p, e, 5, 5)) {
          this.kill(p, null);
          break;
        }
      }
    }
    if (!p.alive) {
      this.finish('dead');
      return;
    }
    this.updateSecret();

    if (!this.bonus && this.livingEnemies() === 0 && !this.doorOpenAnnounced) {
      this.doorOpenAnnounced = true;
      this.emit({ type: 'doorOpen' });
    }

    // Exit: step into the revealed doors once every monster is gone.
    if (
      !this.bonus &&
      this.exitRevealed() &&
      this.livingEnemies() === 0 &&
      p.tx === this.exitTx &&
      p.ty === this.exitTy &&
      Math.abs(p.x - tileCenter(this.exitTx)) < 5 &&
      Math.abs(p.y - tileCenter(this.exitTy)) < 5
    ) {
      p.x = tileCenter(this.exitTx);
      p.y = tileCenter(this.exitTy);
      this.finish('clear');
    }
  }
}

/** Length of a monster's death animation (shrink + score). */
export const ENEMY_DEATH_TICKS = 90;
