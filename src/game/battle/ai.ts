import type { Bomber, Intent } from '../core/bomber';
import { ALL_DIRS, Cell, DX, DY, TILE, tileCenter, toTile, type Dir } from '../core/types';
import type { Bomb } from '../core/world';
import type { BattleWorld } from './battleWorld';
import { CHARACTERS, type Personality } from './characters';
import type { ComLevel } from './config';

const INF = Number.POSITIVE_INFINITY;

interface Node {
  x: number;
  y: number;
  t: number;
  first: Dir | null;
  prev: number;
}

const DIFFICULTY: Record<ComLevel, { replan: number; slack: number; mistake: number; bombChance: number; attackRange: number }> = {
  weak: { replan: 18, slack: 14, mistake: 0.12, bombChance: 0.35, attackRange: 3 },
  normal: { replan: 9, slack: 8, mistake: 0.04, bombChance: 0.7, attackRange: 5 },
  strong: { replan: 4, slack: 4, mistake: 0, bombChance: 1, attackRange: 9 },
};

/** A computer-controlled bomber. */
export class CpuPlayer {
  /** Waypoint tiles to walk through (each finished at its centre). */
  private path: [number, number][] = [];
  private timer = 0;
  private wantBomb = false;
  private wantSpecial = false;
  private wantAction = false;
  private specialDir: Dir | null = null;
  private holdA = 0;
  private readonly diff: (typeof DIFFICULTY)[ComLevel];
  private readonly pers: Personality;
  private danger: Float32Array;
  private dangerTick = -1;
  private cartTarget = 0;

  constructor(
    private readonly w: BattleWorld,
    private readonly me: Bomber,
    level: ComLevel,
  ) {
    this.diff = DIFFICULTY[level];
    this.pers = CHARACTERS[me.character]?.personality ?? CHARACTERS.bomberman.personality;
    this.danger = new Float32Array(w.grid.w * w.grid.h);
    this.timer = w.rng.int(this.diff.replan);
  }

  private idx(x: number, y: number): number {
    return y * this.w.grid.w + x;
  }

  private get tileTime(): number {
    return TILE / Math.max(0.3, this.w.speedOf(this.me));
  }

  /** Called every tick; returns this tick's intent. */
  think(): Intent {
    const me = this.me;
    if (!me.alive) return this.cartThink();
    if (me.airborne > 0 || me.stunned > 0 || me.frozen || me.riding) return { dirs: [], bomb: false, special: false, specialHeld: false, bombHeld: false };
    // Power Glove: carry briefly, then release to throw.
    if (me.carrying || me.carryingBomber) {
      this.holdA--;
      return { dirs: [], bomb: false, special: false, specialHeld: false, bombHeld: this.holdA > 0 };
    }
    this.computeDanger();
    const here = this.danger[this.idx(me.tx, me.ty)];
    const inDanger = here < INF;
    this.timer--;
    const stale = this.timer <= -90;
    if ((this.timer <= 0 && !this.path.length) || (inDanger && !this.pathSafe()) || stale) {
      this.timer = this.diff.replan;
      this.plan();
    }
    let dirs = this.followPath();
    if (this.wantSpecial && this.specialDir) {
      dirs = [this.specialDir];
      this.specialDir = null;
    }
    const intent: Intent = { dirs, bomb: this.wantBomb, special: this.wantSpecial, specialHeld: false, bombHeld: false, action: this.wantAction };
    this.wantBomb = false;
    this.wantSpecial = false;
    this.wantAction = false;
    return intent;
  }

  // ------------------------------------------------------------------ danger

  /** Ticks until each tile burns (INF = safe for the foreseeable future). */
  private computeDanger(extra: Bomb | null = null, into: Float32Array = this.danger): void {
    const w = this.w;
    if (!extra && this.dangerTick === w.tick) return;
    if (!extra) this.dangerTick = w.tick;
    into.fill(INF);
    for (let i = 0; i < w.flameTimer.length; i++) if (w.flameTimer[i] > 0) into[i] = 0;
    const bombs: { b: Bomb; t: number }[] = [];
    for (const b of w.bombs) {
      if (b.exploded || b.held) continue;
      if (b.hidden && b.owner !== this.me) continue;
      let t = b.fuse;
      if (b.remote) t = b.owner === this.me ? 240 : 45;
      if (b.chain >= 0) t = Math.min(t, b.chain);
      if (b.flight) t = Math.max(t, b.flight.dur - b.flight.t);
      bombs.push({ b, t });
    }
    if (extra) bombs.push({ b: extra, t: extra.fuse });
    // Chain reactions: process in time order, pulling neighbours earlier.
    const done = new Set<Bomb>();
    while (bombs.length) {
      bombs.sort((a, b) => a.t - b.t);
      const { b, t } = bombs.shift()!;
      if (done.has(b)) continue;
      done.add(b);
      const tx = b.flight ? b.flight.ttx : b.tx;
      const ty = b.flight ? b.flight.tty : b.ty;
      const blast = w.computeBlast(tx, ty, b.range, b.pierce, b, b.square);
      for (const tile of blast.tiles) {
        const i = this.idx(tile.x, tile.y);
        if (t < into[i]) into[i] = t;
      }
      for (const h of blast.hits) {
        if (h.kind !== 'bomb') continue;
        const other = bombs.find((o) => o.b.tx === h.tx && o.b.ty === h.ty);
        if (other && other.t > t) other.t = t + w.rules.chainDelay;
      }
    }
    // Pressure blocks about to fall.
    for (const f of w.falling) into[this.idx(f.tx, f.ty)] = Math.min(into[this.idx(f.tx, f.ty)], f.t);
    // Trolleys: the tiles right ahead of them.
    for (const tr of w.gim.trolleys) {
      if (tr.stop > 0) continue;
      let x = toTile(tr.x);
      let y = toTile(tr.y);
      for (let k = 0; k < 3; k++) {
        into[this.idx(x, y)] = Math.min(into[this.idx(x, y)], k * (TILE / tr.speed));
        x += DX[tr.dir];
        y += DY[tr.dir];
        if (!w.grid.inside(x, y)) break;
      }
    }
  }

  private pathSafe(): boolean {
    let t = 0;
    for (const [x, y] of this.path) {
      t += this.tileTime;
      const dt = this.danger[this.idx(x, y)];
      if (dt <= t + this.diff.slack && dt + this.w.rules.flameTicks >= t) return false;
    }
    return this.path.length > 0 || this.danger[this.idx(this.me.tx, this.me.ty)] === INF;
  }

  // ------------------------------------------------------------------ search

  private walkable(x: number, y: number): boolean {
    return this.w.bomberCanEnter(this.me, x, y) || (x === this.me.tx && y === this.me.ty);
  }

  /**
   * BFS from the bomber's tile honouring blast timing. Returns every reachable node
   * (index → node) so callers can pick goals.
   */
  private search(danger: Float32Array, maxSteps = 40): Map<number, Node> {
    const me = this.me;
    const w = this.w;
    const tt = this.tileTime;
    const start: Node = { x: me.tx, y: me.ty, t: 0, first: null, prev: -1 };
    const nodes = new Map<number, Node>([[this.idx(me.tx, me.ty), start]]);
    let frontier = [start];
    for (let step = 0; step < maxSteps && frontier.length; step++) {
      const next: Node[] = [];
      for (const n of frontier) {
        for (const d of ALL_DIRS) {
          let nx = n.x + DX[d];
          let ny = n.y + DY[d];
          if (!w.grid.inside(nx, ny)) {
            if (!w.gim.wrap || w.gim.at(n.x, n.y)?.kind !== 'gap') continue;
            [nx, ny] = w.gim.wrapTile(nx, ny);
          }
          const i = this.idx(nx, ny);
          if (nodes.has(i)) continue;
          if (!this.walkable(nx, ny)) continue;
          const t = n.t + tt;
          const dt = danger[i];
          // Would we be standing in fire while passing through?
          if (dt < INF && dt <= t + tt && dt + w.rules.flameTicks + 2 >= t) continue;
          const node: Node = { x: nx, y: ny, t, first: n.first ?? d, prev: this.idx(n.x, n.y) };
          nodes.set(i, node);
          next.push(node);
        }
      }
      frontier = next;
    }
    return nodes;
  }

  private pathTo(nodes: Map<number, Node>, target: Node): [number, number][] {
    const tiles: [number, number][] = [];
    let n: Node | undefined = target;
    while (n && n.prev >= 0) {
      tiles.unshift([n.x, n.y]);
      n = nodes.get(n.prev);
    }
    return tiles;
  }

  // ------------------------------------------------------------------ planning

  private plan(): void {
    const w = this.w;
    const me = this.me;
    const rng = w.rng;
    this.path = [];
    const nodes = this.search(this.danger);
    const hereIdx = this.idx(me.tx, me.ty);
    const inDanger = this.danger[hereIdx] < INF;

    if (inDanger) {
      // Escape to the closest safe tile.
      let best: Node | null = null;
      let bestLeast: Node | null = null;
      for (const n of nodes.values()) {
        const d = this.danger[this.idx(n.x, n.y)];
        if (d === INF) {
          if (!best || n.t < best.t) best = n;
        } else if (!bestLeast || d > this.danger[this.idx(bestLeast.x, bestLeast.y)]) {
          bestLeast = n;
        }
      }
      const target = best ?? bestLeast;
      if (target) this.setPath(nodes, target);
      return;
    }

    // Remote bombs: detonate when an opponent is inside one of our blasts.
    if (me.stats.remote && this.remoteWorthIt()) {
      this.wantSpecial = true;
      return;
    }

    // Consider dropping a bomb right here.
    if (this.shouldBomb()) {
      this.wantBomb = true;
      return;
    }

    // Character specials (Advanced).
    if (w.cfg.level === 'advanced' && this.trySpecial()) return;

    // Push / punch when useful.
    if ((me.stats.punch || me.stats.push) && rng.chance(0.2 * this.pers.aggression) && this.enemyAhead(4)) this.wantAction = true;

    // Choose a goal.
    let best: Node | null = null;
    let bestScore = -INF;
    const enemies = w.alive().filter((b) => b !== me && b.team !== me.team);
    for (const n of nodes.values()) {
      if (n === nodes.get(hereIdx)) continue;
      const i = this.idx(n.x, n.y);
      if (this.danger[i] < INF) continue;
      let score = -n.t / 60;
      const item = w.items[i];
      if (item && !item.hidden && item.burning === 0) {
        score += item.kind === 'skull' ? -4 : 3 + this.pers.greed * 4;
      }
      // Next to soft blocks: a good place to bomb.
      let soft = 0;
      for (const d of ALL_DIRS) if (w.grid.get(n.x + DX[d], n.y + DY[d]) === Cell.Soft) soft++;
      score += soft * 0.8;
      // Toward opponents.
      for (const e of enemies) {
        const dist = Math.abs(e.tx - n.x) + Math.abs(e.ty - n.y);
        if (dist <= this.diff.attackRange) score += (this.pers.aggression * 3) / (1 + dist);
      }
      const f = w.gim.at(n.x, n.y);
      if (f && (f.kind === 'trampoline' || f.kind === 'warp' || f.kind === 'seesaw')) score -= 1.5;
      if (f && f.kind === 'rail') score -= 1;
      if (f && f.kind === 'ice' && f.cracks > 0) score -= 2;
      score += rng.next() * 0.6;
      if (score > bestScore) {
        bestScore = score;
        best = n;
      }
    }
    if (best) this.setPath(nodes, best);
  }

  private setPath(nodes: Map<number, Node>, target: Node): void {
    this.path = this.pathTo(nodes, target);
    if (this.w.rng.chance(this.diff.mistake) && this.path.length > 1) this.path.pop();
  }

  /** Direction toward the next waypoint; waypoints complete at their tile centre. */
  private followPath(): Dir[] {
    const me = this.me;
    while (this.path.length) {
      const [wx, wy] = this.path[0];
      if (me.tx === wx && me.ty === wy && Math.abs(me.x - tileCenter(wx)) < 1.5 && Math.abs(me.y - tileCenter(wy)) < 1.5) {
        this.path.shift();
        continue;
      }
      if (me.tx === wx && me.ty === wy) return this.toCenter();
      return [stepDir(me.tx, me.ty, wx, wy, this.w.grid.w, this.w.grid.h)];
    }
    return this.toCenter();
  }

  /** Idle: settle on the tile centre (needed to lay bombs cleanly). */
  private toCenter(): Dir[] {
    const me = this.me;
    const dx = tileCenter(me.tx) - me.x;
    const dy = tileCenter(me.ty) - me.y;
    if (Math.abs(dx) > 0.9) return [dx > 0 ? 'right' : 'left'];
    if (Math.abs(dy) > 0.9) return [dy > 0 ? 'down' : 'up'];
    return [];
  }

  private remoteWorthIt(): boolean {
    const w = this.w;
    const me = this.me;
    const mine = w.bombs.filter((b) => b.owner === me && b.remote && !b.flight && !b.held);
    if (!mine.length) return false;
    const oldest = mine.reduce((a, b) => (a.serial < b.serial ? a : b));
    const blast = w.computeBlast(oldest.tx, oldest.ty, oldest.range, oldest.pierce, oldest, oldest.square);
    const tiles = new Set(blast.tiles.map((t) => this.idx(t.x, t.y)));
    if (tiles.has(this.idx(me.tx, me.ty))) return false;
    const enemyHit = w.alive().some((b) => b !== me && b.team !== me.team && tiles.has(this.idx(b.tx, b.ty)));
    const blocks = blast.hits.filter((h) => h.kind === 'soft').length;
    return enemyHit || (blocks > 0 && oldest.age > 200);
  }

  private shouldBomb(): boolean {
    const w = this.w;
    const me = this.me;
    if (!w.canPlaceBomb(me) || me.curse === 'impotent') return false;
    if (Math.abs(me.x - tileCenter(me.tx)) > 4 || Math.abs(me.y - tileCenter(me.ty)) > 4) return false;
    if (!w.rng.chance(this.diff.bombChance)) return false;
    const range = me.curse === 'feeble' ? 1 : me.stats.fullFire ? w.rules.maxFire : me.stats.fire;
    const blast = w.computeBlast(me.tx, me.ty, range, me.stats.pierce, null, 0);
    const tiles = new Set(blast.tiles.map((t) => this.idx(t.x, t.y)));
    let value = 0;
    for (const h of blast.hits) {
      if (h.kind === 'soft') value += 1;
      if (h.kind === 'item') value -= 2;
    }
    for (const e of w.alive()) {
      if (e === me) continue;
      if (tiles.has(this.idx(e.tx, e.ty))) value += e.team === me.team ? -10 : 3 + this.pers.aggression * 4;
    }
    if (value <= 0) return false;
    // Would we still get away?
    const fake: Bomb = {
      id: -1, owner: me, tx: me.tx, ty: me.ty, x: me.x, y: me.y, range, fuse: w.rules.fuseTicks, remote: false, pierce: me.stats.pierce,
      passers: new Set([me]), slide: null, flight: null, chain: -1, serial: 0, exploded: false, held: false, age: 0, square: 0,
      kind: 'normal', hidden: false, conveyed: false, slideSpeed: 0, kicker: null,
    };
    const hypo = new Float32Array(this.danger.length);
    this.computeDanger(fake, hypo);
    const i = this.idx(me.tx, me.ty);
    w.bombAt[i] = fake;
    const nodes = this.search(hypo, 12);
    w.bombAt[i] = null;
    const margin = 20 + this.pers.caution * 30;
    for (const n of nodes.values()) {
      if (hypo[this.idx(n.x, n.y)] === INF && n.t + margin < w.rules.fuseTicks) return true;
    }
    return false;
  }

  private enemyAhead(range: number): boolean {
    const w = this.w;
    const me = this.me;
    for (let k = 1; k <= range; k++) {
      const x = me.tx + DX[me.facing] * k;
      const y = me.ty + DY[me.facing] * k;
      if (w.grid.get(x, y) === Cell.Hard) return false;
      if (w.alive().some((b) => b !== me && b.team !== me.team && b.tx === x && b.ty === y)) return true;
    }
    return false;
  }

  private trySpecial(): boolean {
    const me = this.me;
    const ch = CHARACTERS[me.character];
    if (!ch?.special || me.specialCooldown > 0 || me.weak !== 0) return false;
    const rng = this.w.rng;
    for (const d of ALL_DIRS) {
      const saved = me.facing;
      me.facing = d;
      const hit = this.enemyAhead(ch.special === 'hammer' || ch.special === 'sword' ? 1 : 6);
      me.facing = saved;
      if (hit && rng.chance(0.3 + this.pers.aggression * 0.3)) {
        this.path = [];
        me.facing = d;
        this.specialDir = d;
        this.wantSpecial = true;
        return true;
      }
    }
    return false;
  }

  // ------------------------------------------------------------------ bomber cart

  private cartThink(): Intent {
    const w = this.w;
    const cart = w.carts.find((c) => c.who === this.me.id);
    const none: Intent = { dirs: [], bomb: false, special: false, specialHeld: false, bombHeld: false };
    if (!cart || w.result) return none;
    const targets = w.alive();
    if (!targets.length) return none;
    const t = w.cartTile(cart);
    if (this.cartTarget === 0 || w.tick % 120 === 0) this.cartTarget = w.rng.int(targets.length) + 1;
    const tgt = targets[(this.cartTarget - 1) % targets.length];
    const horizontal = t.into === 'down' || t.into === 'up';
    let dirs: Dir[] = [];
    if (horizontal) {
      if (tgt.tx > t.tx) dirs = ['right'];
      else if (tgt.tx < t.tx) dirs = ['left'];
    } else if (tgt.ty > t.ty) dirs = ['down'];
    else if (tgt.ty < t.ty) dirs = ['up'];
    const aligned = horizontal ? tgt.tx === t.tx : tgt.ty === t.ty;
    if (aligned && !cart.bomb) {
      const want = Math.abs(horizontal ? tgt.ty - t.ty : tgt.tx - t.tx);
      this.holdA = this.holdA || Math.max(1, (want - 1) * 15 + 5);
    }
    let hold = false;
    if (this.holdA > 0) {
      this.holdA--;
      hold = this.holdA > 0;
    }
    return { dirs: aligned ? [] : dirs, bomb: false, special: false, specialHeld: false, bombHeld: hold };
  }
}

function stepDir(ax: number, ay: number, bx: number, by: number, w: number, h: number): Dir {
  let dx = bx - ax;
  let dy = by - ay;
  if (Math.abs(dx) > 1) dx = -Math.sign(dx); // wrapped
  if (Math.abs(dy) > 1) dy = -Math.sign(dy);
  void w;
  void h;
  if (dx > 0) return 'right';
  if (dx < 0) return 'left';
  if (dy > 0) return 'down';
  return 'up';
}
