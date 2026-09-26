import { Rng } from '../../engine/rng';
import { Bomber, type Curse } from './bomber';
import type { GameEvent } from './events';
import { Grid } from './grid';
import { moveBody, type Body } from './movement';
import {
  ALL_DIRS,
  Cell,
  DX,
  DY,
  FLAME_BIT,
  FLAME_CENTER,
  FLAME_DOWN,
  FLAME_LEFT,
  FLAME_RIGHT,
  FLAME_UP,
  OPPOSITE,
  TILE,
  tileCenter,
  toTile,
  type Dir,
} from './types';

export interface WorldRules {
  /** Bomb fuse in ticks. */
  fuseTicks: number;
  /** How long an explosion stays deadly, in ticks. */
  flameTicks: number;
  /** Soft block burning animation length (the block stays solid meanwhile). */
  burnTicks: number;
  /** Delay before a bomb caught in a blast explodes. */
  chainDelay: number;
  maxBombs: number;
  maxFire: number;
  /** Walking speed in px per tick without speed items. */
  baseSpeed: number;
  /** Extra px per tick per speed item. */
  speedStep: number;
  maxSpeedLevel: number;
  /** Flames that reach a revealed item destroy it. */
  flamesBurnItems: boolean;
  /** Flames stop on the tile of the item they burn. */
  flamesStopAtItems: boolean;
  /** Speed of a kicked bomb, px per tick. */
  kickSpeed: number;
  /** Punched/thrown bombs wrap around the arena edges. */
  throwWraps: boolean;
}

export const DEFAULT_RULES: WorldRules = {
  fuseTicks: 150,
  flameTicks: 30,
  burnTicks: 30,
  chainDelay: 3,
  maxBombs: 10,
  maxFire: 10,
  baseSpeed: 1,
  speedStep: 0.25,
  maxSpeedLevel: 4,
  flamesBurnItems: true,
  flamesStopAtItems: true,
  kickSpeed: 4,
  throwWraps: true,
};

export interface Bomb extends Body {
  id: number;
  owner: Bomber | null;
  tx: number;
  ty: number;
  range: number;
  fuse: number;
  /** Waits for its owner's detonation signal. */
  remote: boolean;
  pierce: boolean;
  /** Bodies allowed to overlap the bomb (they were on it when it appeared). */
  passers: Set<object>;
  /** Kicked: sliding direction. */
  slide: Dir | null;
  /** Punched / thrown flight. */
  flight: Flight | null;
  /** Ticks until a chain-reaction detonation (-1 = not triggered). */
  chain: number;
  /** Order of placement (remote detonates oldest first). */
  serial: number;
  exploded: boolean;
  /** Carried by a glove bomber (not on the field). */
  held: boolean;
  age: number;
  /** >0: square blast radius (Super Bomb 2, Ultra Bomb 3). */
  square: number;
  /** Special bomb type (battle). */
  kind: BombKind;
  /** Land mine: invisible, explodes when stepped on. */
  hidden: boolean;
  /** Carried by a conveyor belt (stops when the belt ends) rather than kicked. */
  conveyed: boolean;
  /** Current sliding speed (px per tick). */
  slideSpeed: number;
  /** Bomber who kicked it (power bomb damage, super bomb merges). */
  kicker: Bomber | null;
}

export type BombKind = 'normal' | 'remote' | 'power' | 'rubber' | 'pierce' | 'mine' | 'super' | 'ultra';

/** The properties a bomb gets when it is placed. */
export interface BombShape {
  fuse: number;
  range: number;
  remote: boolean;
  pierce: boolean;
  kind: BombKind;
  hidden: boolean;
}

export interface BlastTile {
  x: number;
  y: number;
  bits: number;
}

export interface BlastHit {
  tx: number;
  ty: number;
  kind: 'soft' | 'bomb' | 'item';
}

export interface Blast {
  tiles: BlastTile[];
  hits: BlastHit[];
}

export interface Flight {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  t: number;
  dur: number;
  dir: Dir;
  /** Peak height of the arc in px. */
  height: number;
  /** Target tile (after wrapping). */
  ttx: number;
  tty: number;
}

export interface ItemCell {
  kind: string;
  hidden: boolean;
  /** >0 while the item burns away. */
  burning: number;
  age: number;
}

export class World {
  readonly grid: Grid;
  readonly rules: WorldRules;
  readonly rng: Rng;
  bombs: Bomb[] = [];
  readonly bombAt: (Bomb | null)[];
  readonly flameTimer: Int16Array;
  readonly flameBits: Uint8Array;
  readonly flameOwner: (Bomber | null)[];
  /** Id of the bomb whose blast lit each flame tile (chain bonuses, kill credit). */
  readonly flameSource: Int32Array;
  readonly burnTimer: Int16Array;
  readonly items: (ItemCell | null)[];
  bombers: Bomber[] = [];
  events: GameEvent[] = [];
  tick = 0;
  /** Bombs exploded so far (secret panel bookkeeping). */
  bombsExploded = 0;
  private bombSerial = 0;
  private nextBombId = 1;

  constructor(grid: Grid, rules: Partial<WorldRules> = {}, seed?: number) {
    this.grid = grid;
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.rng = new Rng(seed);
    const n = grid.w * grid.h;
    this.bombAt = new Array<Bomb | null>(n).fill(null);
    this.flameTimer = new Int16Array(n);
    this.flameBits = new Uint8Array(n);
    this.flameOwner = new Array<Bomber | null>(n).fill(null);
    this.flameSource = new Int32Array(n);
    this.burnTimer = new Int16Array(n);
    this.items = new Array<ItemCell | null>(n).fill(null);
  }

  idx(tx: number, ty: number): number {
    return ty * this.grid.w + tx;
  }

  emit(e: GameEvent): void {
    this.events.push(e);
  }

  // ---------------------------------------------------------------- queries

  bombAtTile(tx: number, ty: number): Bomb | null {
    if (!this.grid.inside(tx, ty)) return null;
    return this.bombAt[this.idx(tx, ty)];
  }

  flameAt(tx: number, ty: number): boolean {
    return this.grid.inside(tx, ty) && this.flameTimer[this.idx(tx, ty)] > 0;
  }

  itemAt(tx: number, ty: number): ItemCell | null {
    if (!this.grid.inside(tx, ty)) return null;
    const it = this.items[this.idx(tx, ty)];
    return it && !it.hidden ? it : null;
  }

  isBurning(tx: number, ty: number): boolean {
    return this.grid.inside(tx, ty) && this.burnTimer[this.idx(tx, ty)] > 0;
  }

  /** Walkability for a bomber (mode hooks may add obstacles). */
  bomberCanEnter(b: Bomber, tx: number, ty: number): boolean {
    const c = this.grid.get(tx, ty);
    if (c === Cell.Hard || c === Cell.Void) return false;
    if (c === Cell.Soft && !b.stats.wallPass) return false;
    const bomb = this.bombAt[this.idx(tx, ty)];
    if (bomb && !b.stats.bombPass && !bomb.passers.has(b)) return false;
    return this.extraCanEnter(b, tx, ty);
  }

  /** Hook: extra obstacles for bombers (e.g. arena gimmicks). */
  protected extraCanEnter(_b: Bomber, _tx: number, _ty: number): boolean {
    return true;
  }

  /** Can a sliding / landing bomb occupy this tile? */
  bombCanEnter(tx: number, ty: number, self: Bomb | null = null): boolean {
    if (!this.grid.inside(tx, ty)) return false;
    if (this.grid.get(tx, ty) !== Cell.Floor) return false;
    const other = this.bombAt[this.idx(tx, ty)];
    if (other && other !== self) return false;
    return !this.tileHasBlockingBody(tx, ty, self);
  }

  /** Hook: bodies that stop kicked bombs (bombers here; enemies in the campaign). */
  protected tileHasBlockingBody(tx: number, ty: number, _self: Bomb | null): boolean {
    for (const b of this.bombers) {
      if (b.alive && !b.airborne && b.tx === tx && b.ty === ty) return true;
    }
    return false;
  }

  speedOf(b: Bomber): number {
    if (b.curse === 'superslow') return this.rules.baseSpeed * 0.5;
    if (b.curse === 'superspeed') return this.rules.baseSpeed + (this.rules.maxSpeedLevel + 2) * this.rules.speedStep;
    if (b.speedOverride !== null) return b.speedOverride;
    const level = Math.max(-1, Math.min(b.stats.speed, this.rules.maxSpeedLevel));
    return this.rules.baseSpeed + level * this.rules.speedStep;
  }

  // ---------------------------------------------------------------- main update

  update(): void {
    this.events = [];
    this.tick++;
    this.preUpdate();
    for (const b of this.bombers) this.updateBomber(b);
    this.updateEnemies();
    this.updateBombs();
    this.updateFlames();
    this.applyFlames();
    this.updateBurning();
    this.updateItems();
    this.pickups();
    this.postUpdate();
  }

  protected preUpdate(): void {}
  protected updateEnemies(): void {}
  protected postUpdate(): void {}

  // ---------------------------------------------------------------- bombers

  protected updateBomber(b: Bomber): void {
    if (!b.alive) {
      if (b.deathTimer >= 0) b.deathTimer++;
      return;
    }
    if (b.invincible > 0) b.invincible--;
    if (b.curse && b.curseTimer > 0) {
      b.curseTimer--;
      if (b.curseTimer <= 0) b.curse = null;
    }
    if (b.airborne > 0) {
      this.updateJump(b);
      return;
    }
    if (b.frozen || b.riding) {
      b.moving = false;
      return;
    }
    if (b.stunned > 0) {
      b.stunned--;
      b.moving = false;
      return;
    }

    const intent = b.intent;
    let dirs = intent.dirs;
    if (b.curse === 'confusion') dirs = dirs.map((d) => OPPOSITE[d]);
    if (b.curse === 'streaking') {
      // Once moving, keep running until something is in the way.
      if (dirs.length) b.streak = dirs[0];
      else if (b.streak) dirs = [b.streak];
    }

    // Movement
    b.moving = false;
    if (dirs.length) {
      const speed = this.speedOf(b);
      const canEnter = (tx: number, ty: number): boolean => this.bomberCanEnter(b, tx, ty);
      b.facing = dirs[0];
      for (const d of dirs) {
        const moved = moveBody(b, d, speed, canEnter);
        if (moved > 0) {
          b.moving = true;
          b.facing = d;
          break;
        }
      }
      this.afterMove(b);
      if (!b.moving) {
        if (b.curse === 'streaking') b.streak = null;
        this.onBlocked(b, dirs[0]);
      }
      if (b.moving) b.walkTick++;
    }

    // Bomb placement (A)
    const wantsBomb = intent.bomb || b.curse === 'diarrhea';
    if (wantsBomb && b.curse !== 'impotent') {
      const placed = this.placeBomb(b);
      if (!placed && intent.bomb) this.onBombButtonOnBomb(b);
    }
    // Special (B)
    if (intent.special) this.onSpecial(b);
    // Stop kicked bombs (△) takes priority over the action button (□).
    const stopped = intent.stop ? this.onStop(b) : false;
    if (intent.action && !stopped) this.onAction(b);
  }

  /** Hook: after a movement step (wrap-around arenas normalise coordinates here). */
  protected afterMove(_b: Bomber): void {}

  /** □ button (battle): push / punch / multi bomb. */
  protected onAction(_b: Bomber): void {}

  /** △ button (battle): stop this bomber's kicked bombs. Returns true if any stopped. */
  protected onStop(_b: Bomber): boolean {
    return false;
  }

  /** Send a bomber flying to a tile (trampolines, seesaws, glove throws). */
  jump(b: Bomber, tx: number, ty: number, dur: number, height: number): void {
    b.jump = { fx: b.x, fy: b.y, tx: tileCenter(tx), ty: tileCenter(ty), t: 0, dur, height };
    b.airborne = dur;
    b.moving = false;
  }

  private updateJump(b: Bomber): void {
    const j = b.jump;
    if (!j) {
      b.airborne = 0;
      return;
    }
    j.t++;
    const k = Math.min(1, j.t / j.dur);
    b.x = j.fx + (j.tx - j.fx) * k;
    b.y = j.fy + (j.ty - j.fy) * k;
    b.airborne = j.dur - j.t;
    if (b.airborne <= 0) {
      b.airborne = 0;
      b.jump = null;
      b.x = j.tx;
      b.y = j.ty;
      this.onLand(b);
    }
  }

  /** Hook: a jumping bomber touched down. */
  protected onLand(b: Bomber): void {
    this.emit({ type: 'land', tx: b.tx, ty: b.ty });
  }

  /** Hook: bomber pushed against an obstacle (kick lives here in battle rules). */
  protected onBlocked(b: Bomber, dir: Dir): void {
    if (!b.stats.kick) return;
    const tx = b.tx;
    const ty = b.ty;
    // Only kick when centred on our tile, facing the bomb.
    if (Math.abs(b.x - tileCenter(tx)) > 0.01 || Math.abs(b.y - tileCenter(ty)) > 0.01) return;
    const bomb = this.bombAtTile(tx + DX[dir], ty + DY[dir]);
    if (!bomb || (bomb.slide && !bomb.conveyed) || bomb.flight || bomb.hidden) return;
    if (this.slideCheck(bomb, dir) === 'blocked') return;
    this.startSlide(bomb, dir, this.rules.kickSpeed);
    bomb.kicker = b;
    this.emit({ type: 'kick', tx: bomb.tx, ty: bomb.ty });
  }

  /** Hook: A pressed but no bomb could be placed (line bomb / glove pick-up). */
  protected onBombButtonOnBomb(_b: Bomber): void {}

  /** B button: remote detonation by default. */
  protected onSpecial(b: Bomber): void {
    if (b.stats.remote) this.detonateRemote(b);
  }

  canPlaceBomb(b: Bomber, tx = b.tx, ty = b.ty): boolean {
    const cap = b.curse === 'feeble' ? 1 : b.stats.bombs;
    if (!b.alive || b.activeBombs >= cap) return false;
    if (!this.grid.inside(tx, ty) || this.grid.get(tx, ty) !== Cell.Floor) return false;
    if (this.bombAt[this.idx(tx, ty)]) return false;
    return this.extraCanPlace(b, tx, ty);
  }

  protected extraCanPlace(_b: Bomber, _tx: number, _ty: number): boolean {
    return true;
  }

  /** The bomb `b` would place at (tx, ty) next: fuse, range and type. No side effects. */
  bombShape(b: Bomber, tx = b.tx, ty = b.ty): BombShape {
    let fuse = this.rules.fuseTicks;
    if (b.curse === 'shortFuse') fuse = Math.floor(fuse / 3);
    if (b.curse === 'slowFuse') fuse = fuse * 2;
    const shape: BombShape = {
      fuse,
      range: b.curse === 'feeble' ? 1 : b.stats.fullFire ? this.rules.maxFire : b.stats.fire,
      remote: b.stats.remote,
      pierce: b.stats.pierce,
      kind: 'normal',
      hidden: false,
    };
    this.shapeBomb(b, tx, ty, shape);
    return shape;
  }

  /** Hook: special bomb types (battle). */
  protected shapeBomb(_b: Bomber, _tx: number, _ty: number, _shape: BombShape): void {}

  placeBomb(b: Bomber, tx = b.tx, ty = b.ty): Bomb | null {
    if (!this.canPlaceBomb(b, tx, ty)) return null;
    const shape = this.bombShape(b, tx, ty);
    const bomb: Bomb = {
      id: this.nextBombId++,
      owner: b,
      tx,
      ty,
      x: tileCenter(tx),
      y: tileCenter(ty),
      range: shape.range,
      fuse: shape.fuse,
      remote: shape.remote,
      pierce: shape.pierce,
      passers: new Set(),
      slide: null,
      flight: null,
      chain: -1,
      serial: this.bombSerial++,
      exploded: false,
      held: false,
      age: 0,
      square: 0,
      kind: shape.kind,
      hidden: shape.hidden,
      conveyed: false,
      slideSpeed: this.rules.kickSpeed,
      kicker: null,
    };
    this.onBombPlaced(b, bomb);
    this.addPassers(bomb);
    this.bombs.push(bomb);
    this.bombAt[this.idx(tx, ty)] = bomb;
    b.activeBombs++;
    this.emit({ type: 'bomb', tx, ty });
    return bomb;
  }

  /** Hook: a bomb landed on (or slammed into) a bomber. */
  protected onBombHit(victim: Bomber, _bomb: Bomb): void {
    victim.stunned = Math.max(victim.stunned, 60);
    this.emit({ type: 'stun', who: victim.id });
  }

  /** Hook: a bomb was just placed. */
  protected onBombPlaced(_b: Bomber, _bomb: Bomb): void {}

  protected addPassers(bomb: Bomb): void {
    for (const o of this.bombers) {
      if (o.alive && Math.abs(o.x - bomb.x) < TILE && Math.abs(o.y - bomb.y) < TILE) bomb.passers.add(o);
    }
  }

  /** Detonate the oldest remote bomb of this bomber. */
  detonateRemote(b: Bomber): boolean {
    let oldest: Bomb | null = null;
    for (const bomb of this.bombs) {
      if (bomb.owner === b && bomb.remote && !bomb.flight && !bomb.held && !bomb.exploded) {
        if (!oldest || bomb.serial < oldest.serial) oldest = bomb;
      }
    }
    if (!oldest) return false;
    this.explode(oldest);
    return true;
  }

  /**
   * The bomber is hit (flame, monster, pressure block…). Hearts, hit points and partners may
   * absorb the hit unless `force` (crushing hazards).
   */
  kill(b: Bomber, killer: Bomber | null = null, force = false): void {
    if (!b.alive) return;
    if (!force && this.absorbHit(b, killer)) return;
    b.alive = false;
    b.deathTimer = 0;
    b.moving = false;
    if (b.carrying) {
      const bomb = b.carrying;
      b.carrying = null;
      bomb.held = false;
      this.dropCarried(b, bomb);
    }
    // Remote bombs of a dead bomber revert to normal fuses.
    for (const bomb of this.bombs) if (bomb.owner === b) bomb.remote = false;
    if (killer && killer !== b) killer.kills++;
    this.emit({ type: 'death', who: b.id });
    this.onBomberDeath(b, killer);
  }

  protected onBomberDeath(_b: Bomber, _killer: Bomber | null): void {}

  /** Hook: return true if the hit was absorbed (heart, hit points, partner). */
  protected absorbHit(_b: Bomber, _killer: Bomber | null): boolean {
    return false;
  }

  protected dropCarried(b: Bomber, bomb: Bomb): void {
    // Put it back on the field where the bomber stood.
    bomb.tx = b.tx;
    bomb.ty = b.ty;
    bomb.x = tileCenter(b.tx);
    bomb.y = tileCenter(b.ty);
    if (this.bombAt[this.idx(bomb.tx, bomb.ty)]) {
      this.explode(bomb);
      return;
    }
    this.bombAt[this.idx(bomb.tx, bomb.ty)] = bomb;
  }

  applyCurse(b: Bomber, curse: Curse, ticks = 0): void {
    b.curse = curse;
    b.curseTimer = ticks;
  }

  // ---------------------------------------------------------------- bombs

  protected updateBombs(): void {
    // Passers leave once they no longer overlap the bomb.
    for (const bomb of this.bombs) {
      bomb.age++;
      for (const p of [...bomb.passers]) {
        const body = p as Body & { alive?: boolean };
        if (body.alive === false || Math.abs(body.x - bomb.x) >= TILE || Math.abs(body.y - bomb.y) >= TILE) {
          bomb.passers.delete(p);
        }
      }
    }
    for (const bomb of [...this.bombs]) {
      if (bomb.exploded || bomb.held) continue;
      if (bomb.flight) {
        this.updateFlight(bomb);
        continue;
      }
      if (bomb.slide) this.updateSlide(bomb);
      if (bomb.chain >= 0) {
        if (bomb.chain === 0) {
          this.explode(bomb);
          continue;
        }
        bomb.chain--;
      }
      if (!bomb.remote) {
        bomb.fuse--;
        if (bomb.fuse <= 0) this.explode(bomb);
      }
    }
  }

  protected updateSlide(bomb: Bomb): void {
    let remaining = bomb.slideSpeed;
    let guard = 0;
    while (remaining > 1e-6 && bomb.slide && guard++ < 24) {
      const cx = tileCenter(bomb.tx);
      const cy = tileCenter(bomb.ty);
      const atC = Math.abs(bomb.x - cx) < 1e-6 && Math.abs(bomb.y - cy) < 1e-6;
      if (atC) {
        this.onSlideCenter(bomb);
        if (!bomb.slide || bomb.exploded) break;
        const res = this.slideCheck(bomb, bomb.slide);
        if (res === 'sink') {
          this.sinkBomb(bomb);
          return;
        }
        if (res === 'moved') continue;
        if (res === 'blocked') {
          const dir = bomb.slide;
          bomb.slide = null;
          this.onSlideBlocked(bomb, dir);
          if (!bomb.exploded && !bomb.slide) this.onSlideStop(bomb);
          break;
        }
      }
      const dir: Dir = bomb.slide;
      // Never step past the next tile centre, so every centre is visited exactly.
      const along = DX[dir] !== 0 ? bomb.x : bomb.y;
      const sign = DX[dir] !== 0 ? DX[dir] : DY[dir];
      let nextCenter = tileCenter(Math.floor(along / TILE));
      if ((nextCenter - along) * sign <= 1e-9) nextCenter += sign * TILE;
      const step = Math.min(1, remaining, Math.abs(nextCenter - along));
      remaining -= step;
      bomb.x += DX[dir] * step;
      bomb.y += DY[dir] * step;
      if (Math.abs(Math.abs(nextCenter - along) - step) < 1e-6) {
        if (DX[dir] !== 0) bomb.x = nextCenter;
        else bomb.y = nextCenter;
      }
      this.afterBombMove(bomb);
      const ntx = toTile(bomb.x);
      const nty = toTile(bomb.y);
      if (ntx !== bomb.tx || nty !== bomb.ty) {
        const occupant = this.grid.inside(ntx, nty) ? this.bombAt[this.idx(ntx, nty)] : null;
        if (occupant && occupant !== bomb) {
          // Ran into another bomb mid-tile: back up to our tile centre and stop.
          bomb.x = tileCenter(bomb.tx);
          bomb.y = tileCenter(bomb.ty);
          bomb.slide = null;
          this.onSlideBlocked(bomb, dir);
          if (!bomb.exploded && !bomb.slide) this.onSlideStop(bomb);
          return;
        }
        if (this.bombAt[this.idx(bomb.tx, bomb.ty)] === bomb) this.bombAt[this.idx(bomb.tx, bomb.ty)] = null;
        bomb.tx = ntx;
        bomb.ty = nty;
        this.bombAt[this.idx(ntx, nty)] = bomb;
        this.onSlideEnter(bomb);
        if (bomb.exploded) return;
      }
    }
  }

  /** Hook: a sliding bomb sits exactly on a tile centre (arrows, belts steer it here). */
  protected onSlideCenter(_bomb: Bomb): void {}

  /** Hook: may a sliding bomb continue from its tile in `dir`? */
  protected slideCheck(bomb: Bomb, dir: Dir): 'ok' | 'blocked' | 'moved' | 'sink' {
    return this.bombCanEnter(bomb.tx + DX[dir], bomb.ty + DY[dir], bomb) ? 'ok' : 'blocked';
  }

  /** Hook: a sliding bomb ran into something (merges, rubber bounces, power bomb hits). */
  protected onSlideBlocked(_bomb: Bomb, _dir: Dir): void {}

  /** Hook: wrap-around arenas normalise a moving bomb. */
  protected afterBombMove(_bomb: Bomb): void {}

  /** Start a bomb sliding (kick or conveyor). */
  startSlide(bomb: Bomb, dir: Dir, speed: number, conveyed = false): void {
    bomb.slide = dir;
    bomb.slideSpeed = speed;
    bomb.conveyed = conveyed;
    bomb.passers.clear();
  }

  /** Teleport a bomb onto another tile centre. */
  moveBomb(bomb: Bomb, tx: number, ty: number): void {
    if (this.bombAt[this.idx(bomb.tx, bomb.ty)] === bomb) this.bombAt[this.idx(bomb.tx, bomb.ty)] = null;
    bomb.tx = tx;
    bomb.ty = ty;
    bomb.x = tileCenter(tx);
    bomb.y = tileCenter(ty);
    this.bombAt[this.idx(tx, ty)] = bomb;
    if (this.flameTimer[this.idx(tx, ty)] > 0) this.explode(bomb);
  }

  /** Remove a bomb without an explosion (crushed, sunk). */
  removeBomb(bomb: Bomb): void {
    if (bomb.exploded) return;
    bomb.exploded = true;
    this.bombs = this.bombs.filter((b) => b !== bomb);
    if (this.bombAt[this.idx(bomb.tx, bomb.ty)] === bomb) this.bombAt[this.idx(bomb.tx, bomb.ty)] = null;
    if (bomb.owner) bomb.owner.activeBombs = Math.max(0, bomb.owner.activeBombs - 1);
  }

  crushBomb(bomb: Bomb): void {
    this.removeBomb(bomb);
    this.emit({ type: 'pressure', tx: bomb.tx, ty: bomb.ty });
  }

  sinkBomb(bomb: Bomb): void {
    this.removeBomb(bomb);
    this.emit({ type: 'bounce', tx: bomb.tx, ty: bomb.ty });
  }

  /** Lob a bomb to an exact tile (seesaws, bomber carts). */
  throwTo(bomb: Bomb, tx: number, ty: number): void {
    if (this.bombAt[this.idx(bomb.tx, bomb.ty)] === bomb) this.bombAt[this.idx(bomb.tx, bomb.ty)] = null;
    bomb.slide = null;
    bomb.held = false;
    bomb.passers.clear();
    const dx = tx - bomb.tx;
    const dy = ty - bomb.ty;
    const dir: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
    const dist = Math.max(1, Math.abs(dx) + Math.abs(dy));
    bomb.flight = {
      sx: bomb.x,
      sy: bomb.y,
      ex: tileCenter(tx),
      ey: tileCenter(ty),
      t: 0,
      dur: 16 + dist * 4,
      dir,
      height: 18 + dist * 3,
      ttx: tx,
      tty: ty,
    };
  }

  /** Hook: a sliding bomb entered a new tile (flames there detonate it). */
  protected onSlideEnter(bomb: Bomb): void {
    if (this.flameTimer[this.idx(bomb.tx, bomb.ty)] > 0) this.explode(bomb);
  }

  protected onSlideStop(_bomb: Bomb): void {}

  /** Launch a bomb through the air `dist` tiles in `dir` (punch / throw). */
  launch(bomb: Bomb, dir: Dir, dist: number, fromX = bomb.x, fromY = bomb.y): void {
    if (this.bombAt[this.idx(bomb.tx, bomb.ty)] === bomb) this.bombAt[this.idx(bomb.tx, bomb.ty)] = null;
    bomb.slide = null;
    bomb.held = false;
    bomb.passers.clear();
    const [ttx, tty] = this.wrapTarget(toTile(fromX) + DX[dir] * dist, toTile(fromY) + DY[dir] * dist);
    bomb.flight = {
      sx: fromX,
      sy: fromY,
      ex: fromX + DX[dir] * dist * TILE,
      ey: fromY + DY[dir] * dist * TILE,
      t: 0,
      dur: 8 + dist * 6,
      dir,
      height: 10 + dist * 4,
      ttx,
      tty,
    };
  }

  /** Wrap a tile coordinate into the playable interior (edges are walls). */
  protected wrapTarget(tx: number, ty: number): [number, number] {
    const w = this.grid.w;
    const h = this.grid.h;
    if (!this.rules.throwWraps) return [Math.max(1, Math.min(w - 2, tx)), Math.max(1, Math.min(h - 2, ty))];
    const iw = w - 2;
    const ih = h - 2;
    const wx = ((((tx - 1) % iw) + iw) % iw) + 1;
    const wy = ((((ty - 1) % ih) + ih) % ih) + 1;
    return [wx, wy];
  }

  protected updateFlight(bomb: Bomb): void {
    const f = bomb.flight!;
    f.t++;
    const k = Math.min(1, f.t / f.dur);
    bomb.x = f.sx + (f.ex - f.sx) * k;
    bomb.y = f.sy + (f.ey - f.sy) * k;
    if (f.t < f.dur) return;
    // Landed (logically at the wrapped target tile).
    const tx = f.ttx;
    const ty = f.tty;
    bomb.x = tileCenter(tx);
    bomb.y = tileCenter(ty);
    bomb.tx = tx;
    bomb.ty = ty;
    const victim = this.bombers.find((b) => b.alive && !b.airborne && b.tx === tx && b.ty === ty);
    if (victim) this.onBombHit(victim, bomb);
    if (!victim && this.grid.get(tx, ty) === Cell.Void) {
      bomb.flight = null;
      this.sinkBomb(bomb);
      return;
    }
    if (victim || !this.bombCanLand(tx, ty)) {
      // Bounce one more tile onward.
      this.emit({ type: 'bounce', tx, ty });
      bomb.flight = null;
      this.launch(bomb, f.dir, 1, bomb.x, bomb.y);
      bomb.flight!.dur = 10;
      bomb.flight!.height = 8;
      return;
    }
    bomb.flight = null;
    this.bombAt[this.idx(tx, ty)] = bomb;
    // A thrown bomb's fuse restarts at a short delay if it had run down mid-air.
    if (!bomb.remote && bomb.fuse < 30) bomb.fuse = 30;
    this.emit({ type: 'land', tx, ty });
    if (this.flameTimer[this.idx(tx, ty)] > 0) this.explode(bomb);
  }

  protected bombCanLand(tx: number, ty: number): boolean {
    return this.grid.get(tx, ty) === Cell.Floor && !this.bombAt[this.idx(tx, ty)];
  }

  // ---------------------------------------------------------------- explosions

  /** Detonate a bomb now, lighting flames and triggering chain reactions. */
  explode(bomb: Bomb): void {
    if (bomb.exploded) return;
    bomb.exploded = true;
    this.bombs = this.bombs.filter((b) => b !== bomb);
    if (this.bombAt[this.idx(bomb.tx, bomb.ty)] === bomb) this.bombAt[this.idx(bomb.tx, bomb.ty)] = null;
    if (bomb.owner) bomb.owner.activeBombs = Math.max(0, bomb.owner.activeBombs - 1);
    if (bomb.held) {
      bomb.held = false;
      for (const b of this.bombers) if (b.carrying === bomb) b.carrying = null;
    }
    const { tx, ty } = bomb;
    const owner = bomb.owner;
    this.bombsExploded++;
    const blast = this.computeBlast(tx, ty, bomb.range, bomb.pierce, bomb, bomb.square);
    for (const t of blast.tiles) this.light(t.x, t.y, t.bits, owner, bomb.id);
    this.emit({ type: 'explode', tx, ty, size: blast.tiles.length });
    for (const h of blast.hits) {
      if (h.kind === 'soft') {
        this.onSoftHit(h.tx, h.ty, bomb);
        this.burnBlock(h.tx, h.ty);
      } else if (h.kind === 'item') this.burnItem(h.tx, h.ty);
      else if (h.kind === 'bomb') {
        const other = this.bombAt[this.idx(h.tx, h.ty)];
        if (other && !other.exploded && other.chain < 0) {
          other.chain = this.rules.chainDelay;
          if (other.chain === 0) this.explode(other);
        }
      }
    }
    this.onExplode(bomb, blast);
  }

  /**
   * Work out which tiles a blast covers (also used by the CPU players to predict danger).
   * `square` > 0 makes a square blast of that radius (Super / Ultra bombs).
   */
  computeBlast(tx: number, ty: number, range: number, pierce: boolean, self: Bomb | null, square = 0): Blast {
    const bits = new Map<number, number>();
    const hits: BlastHit[] = [];
    const add = (x: number, y: number, b: number): void => {
      const i = this.idx(x, y);
      bits.set(i, (bits.get(i) ?? 0) | b);
    };
    add(tx, ty, FLAME_CENTER);
    if (square > 0) {
      for (let y = ty - square; y <= ty + square; y++) {
        for (let x = tx - square; x <= tx + square; x++) {
          if ((x === tx && y === ty) || !this.grid.inside(x, y)) continue;
          const c = this.grid.get(x, y);
          if (c === Cell.Hard) continue;
          if (c === Cell.Soft) {
            hits.push({ tx: x, ty: y, kind: 'soft' });
            continue;
          }
          add(x, y, FLAME_CENTER | FLAME_UP | FLAME_DOWN | FLAME_LEFT | FLAME_RIGHT);
          const other = this.bombAt[this.idx(x, y)];
          if (other && other !== self) hits.push({ tx: x, ty: y, kind: 'bomb' });
          const item = this.items[this.idx(x, y)];
          if (item && !item.hidden && item.burning === 0) hits.push({ tx: x, ty: y, kind: 'item' });
        }
      }
    } else {
      for (const dir of ALL_DIRS) {
        let x = tx;
        let y = ty;
        let d: Dir = dir;
        let prev = this.idx(tx, ty);
        for (let i = 1; i <= range; i++) {
          const step = this.flameNext(x, y, d);
          if (!step) break;
          const [nx, ny, nd] = step;
          const cell = this.grid.get(nx, ny);
          if (cell === Cell.Hard) break;
          if (cell === Cell.Soft) {
            hits.push({ tx: nx, ty: ny, kind: 'soft' });
            if (pierce && this.burnTimer[this.idx(nx, ny)] === 0) {
              x = nx;
              y = ny;
              d = nd;
              continue;
            }
            break;
          }
          bits.set(prev, (bits.get(prev) ?? 0) | FLAME_BIT[d]);
          add(nx, ny, FLAME_BIT[OPPOSITE[nd]]);
          prev = this.idx(nx, ny);
          x = nx;
          y = ny;
          d = nd;
          const other = this.bombAt[this.idx(nx, ny)];
          if (other && other !== self) {
            hits.push({ tx: nx, ty: ny, kind: 'bomb' });
            break;
          }
          const item = this.items[this.idx(nx, ny)];
          if (item && !item.hidden && item.burning === 0 && this.rules.flamesBurnItems) {
            hits.push({ tx: nx, ty: ny, kind: 'item' });
            // Metabomb fire burns straight through items.
            if (this.rules.flamesStopAtItems && !pierce) break;
          }
          if (this.stopFlameAt(nx, ny)) break;
        }
      }
    }
    const tiles: BlastTile[] = [];
    for (const [i, b] of bits) tiles.push({ x: i % this.grid.w, y: Math.floor(i / this.grid.w), bits: b });
    return { tiles, hits };
  }

  /** Next tile a flame travelling `d` from (x, y) reaches (hooks: pipes, bends, wrapping). */
  protected flameNext(x: number, y: number, d: Dir): [number, number, Dir] | null {
    return [x + DX[d], y + DY[d], d];
  }

  /** Hook: tiles where flames stop without a block (e.g. special floors). */
  protected stopFlameAt(_tx: number, _ty: number): boolean {
    return false;
  }

  protected onExplode(_bomb: Bomb, _blast: Blast): void {}

  /** Hook: a blast reached a soft block (anything hiding inside it is caught too). */
  protected onSoftHit(tx: number, ty: number, bomb: Bomb): void {
    for (const b of this.bombers) {
      if (b.alive && b.tx === tx && b.ty === ty && !this.flameProof(b)) this.kill(b, bomb.owner);
    }
  }

  protected light(tx: number, ty: number, bits: number, owner: Bomber | null, source: number): void {
    const i = this.idx(tx, ty);
    // Expired flames have their bits cleared, so OR-ing merges overlapping blasts.
    this.flameBits[i] |= bits;
    this.flameTimer[i] = this.rules.flameTicks;
    this.flameOwner[i] = owner;
    this.flameSource[i] = source;
    this.onLight(tx, ty, owner, source);
  }

  /** Hook: a tile has just been set on fire. */
  protected onLight(_tx: number, _ty: number, _owner: Bomber | null, _source: number): void {}

  burnBlock(tx: number, ty: number): void {
    const i = this.idx(tx, ty);
    if (this.grid.get(tx, ty) !== Cell.Soft || this.burnTimer[i] > 0) return;
    this.burnTimer[i] = this.rules.burnTicks;
    this.emit({ type: 'block', tx, ty });
  }

  burnItem(tx: number, ty: number): void {
    const it = this.items[this.idx(tx, ty)];
    if (!it || it.hidden || it.burning > 0) return;
    it.burning = 20;
    this.emit({ type: 'itemBurn', tx, ty });
    this.onItemBurn(tx, ty, it);
  }

  protected onItemBurn(_tx: number, _ty: number, _it: ItemCell): void {}

  protected updateFlames(): void {
    const t = this.flameTimer;
    for (let i = 0; i < t.length; i++) {
      if (t[i] > 0) {
        t[i]--;
        if (t[i] === 0) {
          this.flameBits[i] = 0;
          this.flameOwner[i] = null;
        }
      }
    }
  }

  /** Everything standing in fire burns. */
  protected applyFlames(): void {
    for (const b of this.bombers) {
      if (!b.alive || b.airborne) continue;
      const i = this.idx(b.tx, b.ty);
      if (this.flameTimer[i] > 0 && !this.flameProof(b)) this.kill(b, this.flameOwner[i]);
    }
    for (const bomb of [...this.bombs]) {
      if (bomb.exploded || bomb.flight || bomb.held) continue;
      if (this.flameTimer[this.idx(bomb.tx, bomb.ty)] > 0 && bomb.chain < 0) {
        bomb.chain = this.rules.chainDelay;
      }
    }
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it && !it.hidden && it.burning === 0 && this.flameTimer[i] > 0 && this.rules.flamesBurnItems && it.age > 2) {
        const tx = i % this.grid.w;
        const ty = Math.floor(i / this.grid.w);
        this.burnItem(tx, ty);
      }
    }
  }

  flameProof(b: Bomber): boolean {
    return b.invincible > 0 || b.stats.flamePass;
  }

  protected updateBurning(): void {
    const t = this.burnTimer;
    for (let i = 0; i < t.length; i++) {
      if (t[i] > 0) {
        t[i]--;
        if (t[i] === 0) {
          const tx = i % this.grid.w;
          const ty = Math.floor(i / this.grid.w);
          this.grid.set(tx, ty, Cell.Floor);
          this.onBlockGone(tx, ty);
        }
      }
    }
  }

  /** Hook: a soft block finished burning; reveal what was hidden under it. */
  protected onBlockGone(tx: number, ty: number): void {
    const it = this.items[this.idx(tx, ty)];
    if (it && it.hidden) {
      it.hidden = false;
      it.age = 0;
    }
  }

  protected updateItems(): void {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it || it.hidden) continue;
      it.age++;
      if (it.burning > 0) {
        it.burning--;
        if (it.burning === 0) this.items[i] = null;
      }
    }
  }

  protected pickups(): void {
    for (const b of this.bombers) {
      if (!b.alive || b.airborne) continue;
      const i = this.idx(b.tx, b.ty);
      const it = this.items[i];
      if (it && !it.hidden && it.burning === 0) {
        this.items[i] = null;
        this.applyItem(b, it.kind);
        this.emit({ type: 'item', tx: b.tx, ty: b.ty, item: it.kind, who: b.id });
      }
    }
  }

  /** Hook: give an item to a bomber. */
  protected applyItem(_b: Bomber, _kind: string): void {}

  /** Put an item (hidden under a block or visible) on a tile. */
  setItem(tx: number, ty: number, kind: string, hidden: boolean): void {
    this.items[this.idx(tx, ty)] = { kind, hidden, burning: 0, age: 0 };
  }
}
