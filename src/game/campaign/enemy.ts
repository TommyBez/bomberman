import type { Rng } from '../../engine/rng';
import type { Body } from '../core/movement';
import { ALL_DIRS, DX, DY, OPPOSITE, TILE, tileCenter, toTile, type Dir } from '../core/types';
import { ENEMY_TYPES, type EnemyKind, type EnemyType } from './enemies';

/** Environment a monster needs to think and move (implemented by CampaignWorld). */
export interface EnemyEnv {
  rng: Rng;
  enemyCanEnter(e: Enemy, tx: number, ty: number): boolean;
  /** Tile of the player, or null when the player cannot be targeted. */
  playerTile(): [number, number] | null;
  /** Is this tile inside the blast line of a bomb that is on the field? */
  inBlastLine(tx: number, ty: number): boolean;
  /** Clear straight line (no hard block / bomb) between two tiles on the same row/column. */
  clearLine(ax: number, ay: number, bx: number, by: number, wallPass: boolean): boolean;
}

let nextId = 1;

export class Enemy implements Body {
  readonly id = nextId++;
  readonly type: EnemyType;
  x: number;
  y: number;
  dir: Dir;
  alive = true;
  /** Frames since death (death animation), -1 while alive. */
  deathTimer = -1;
  /** Frames of immunity after spawning (from a bombed door or item). */
  grace = 0;
  anim = 0;
  /** Frames left on the current heading before picking a new random one. */
  walkTimer = 0;
  /** Charging (Pontan) until the next junction. */
  charging = false;

  constructor(kind: EnemyKind, tx: number, ty: number, dir: Dir) {
    this.type = ENEMY_TYPES[kind];
    this.x = tileCenter(tx);
    this.y = tileCenter(ty);
    this.dir = dir;
  }

  get kind(): EnemyKind {
    return this.type.kind;
  }

  get tx(): number {
    return toTile(this.x);
  }

  get ty(): number {
    return toTile(this.y);
  }

  private atCenter(): boolean {
    return this.x === tileCenter(this.tx) && this.y === tileCenter(this.ty);
  }

  /** Tile whose centre the enemy is currently heading for. */
  targetTile(): [number, number] {
    const tx = this.tx;
    const ty = this.ty;
    if (this.atCenter()) return [tx + DX[this.dir], ty + DY[this.dir]];
    const cx = tileCenter(tx);
    const cy = tileCenter(ty);
    const ahead = DX[this.dir] ? Math.sign(cx - this.x) === DX[this.dir] : Math.sign(cy - this.y) === DY[this.dir];
    return ahead ? [tx, ty] : [tx + DX[this.dir], ty + DY[this.dir]];
  }

  get speed(): number {
    return this.charging ? this.type.speed * 1.25 : this.type.speed;
  }

  update(env: EnemyEnv): void {
    if (!this.alive) {
      this.deathTimer++;
      return;
    }
    if (this.grace > 0) this.grace--;
    this.anim++;
    if (this.walkTimer > 0) this.walkTimer--;
    // Something (a bomb) appeared in our way between tiles: turn around.
    if (!this.atCenter()) {
      const [ttx, tty] = this.targetTile();
      if ((ttx !== this.tx || tty !== this.ty) && !env.enemyCanEnter(this, ttx, tty)) {
        this.dir = OPPOSITE[this.dir];
        this.charging = false;
      } else if (this.type.dodgesBombs && env.inBlastLine(ttx, tty) && !env.inBlastLine(this.tx, this.ty)) {
        // Pass: never walk into a blast line on purpose.
        this.dir = OPPOSITE[this.dir];
      }
    }
    let budget = this.speed;
    let guard = 0;
    while (budget > 1e-6 && guard++ < 8) {
      if (this.atCenter()) {
        this.think(env);
        if (!env.enemyCanEnter(this, this.tx + DX[this.dir], this.ty + DY[this.dir])) return;
      }
      const along = DX[this.dir] !== 0 ? this.x : this.y;
      const sign = DX[this.dir] !== 0 ? DX[this.dir] : DY[this.dir];
      let nextCenter = tileCenter(Math.floor(along / TILE));
      if ((nextCenter - along) * sign <= 1e-9) nextCenter += sign * TILE;
      const dist = Math.abs(nextCenter - along);
      const step = Math.min(budget, dist);
      if (DX[this.dir] !== 0) this.x += sign * step;
      else this.y += sign * step;
      if (Math.abs(step - dist) < 1e-6) {
        if (DX[this.dir] !== 0) this.x = nextCenter;
        else this.y = nextCenter;
      }
      budget -= step;
    }
  }

  /** Choose a heading at a tile centre. */
  private think(env: EnemyEnv): void {
    const rng = env.rng;
    let open = ALL_DIRS.filter((d) => env.enemyCanEnter(this, this.tx + DX[d], this.ty + DY[d]));
    if (!open.length) return;
    if (this.type.dodgesBombs) {
      const safe = open.filter((d) => !env.inBlastLine(this.tx + DX[d], this.ty + DY[d]));
      if (safe.length) open = safe;
    }
    const t = this.type;
    const goal = env.playerTile();

    // Pontan: spot the player along a row/column and charge.
    if (t.charges && goal && (goal[0] === this.tx || goal[1] === this.ty)) {
      if (env.clearLine(this.tx, this.ty, goal[0], goal[1], t.wallPass)) {
        const d: Dir = goal[0] === this.tx ? (goal[1] < this.ty ? 'up' : 'down') : goal[0] < this.tx ? 'left' : 'right';
        if (open.includes(d)) {
          this.dir = d;
          this.charging = true;
          return;
        }
      }
    }
    this.charging = false;

    // Hunting: smart monsters path toward the player; Onil & co. ambush when close.
    if (goal) {
      const chance = t.smarts === 'high' ? 0.85 : t.smarts === 'mid' ? 0.5 : 0;
      const range = t.smarts === 'high' ? 12 : 5;
      if (chance > 0 && rng.chance(chance)) {
        const d = this.pathStep(env, goal, range);
        if (d && open.includes(d)) {
          this.dir = d;
          return;
        }
      }
    }

    // Wandering: keep the heading until blocked or the walk timer runs out.
    const forwardOpen = open.includes(this.dir);
    if (forwardOpen && this.walkTimer > 0) {
      // Erratic monsters sometimes turn back on a whim.
      if (t.smarts === 'low' && rng.chance(0.03) && open.includes(OPPOSITE[this.dir])) this.dir = OPPOSITE[this.dir];
      return;
    }
    const choices = open.length > 1 ? open.filter((d) => d !== OPPOSITE[this.dir] || rng.chance(0.25)) : open;
    this.dir = rng.pick(choices.length ? choices : open);
    this.walkTimer = 32 + rng.int(97);
  }

  /** First step of a shortest path to `goal` (BFS limited to `range` steps). */
  private pathStep(env: EnemyEnv, goal: [number, number], range: number): Dir | null {
    const sx = this.tx;
    const sy = this.ty;
    if (Math.abs(goal[0] - sx) + Math.abs(goal[1] - sy) > range) return null;
    const key = (x: number, y: number): number => y * 1024 + x;
    const seen = new Set<number>([key(sx, sy)]);
    let frontier: [number, number, Dir][] = [];
    for (const d of ALL_DIRS) {
      const nx = sx + DX[d];
      const ny = sy + DY[d];
      if (env.enemyCanEnter(this, nx, ny)) {
        frontier.push([nx, ny, d]);
        seen.add(key(nx, ny));
      }
    }
    for (let depth = 1; depth <= range && frontier.length; depth++) {
      const next: [number, number, Dir][] = [];
      for (const [x, y, first] of frontier) {
        if (x === goal[0] && y === goal[1]) return first;
        for (const d of ALL_DIRS) {
          const nx = x + DX[d];
          const ny = y + DY[d];
          const k = key(nx, ny);
          if (seen.has(k)) continue;
          if (!env.enemyCanEnter(this, nx, ny)) continue;
          seen.add(k);
          next.push([nx, ny, first]);
        }
      }
      frontier = next;
    }
    return null;
  }
}
