import { Bomber, type Curse } from '../core/bomber';
import { Grid } from '../core/grid';
import { ALL_DIRS, Cell, DX, DY, OPPOSITE, TILE, tileCenter, toTile, type Dir } from '../core/types';
import { World, type Blast, type Bomb, type BombShape } from '../core/world';
import type { ArenaDef } from './arenas';
import { CHARACTERS, PARTNERS, type PartnerKind } from './characters';
import { CUSTOM_ITEMS, LEVEL_ITEMS, MAX_HP, type BattleConfig, type BattleItem, type Level } from './config';
import { Gimmicks } from './gimmicks';

export const BATTLE_W = 15;
export const BATTLE_H = 13;
export const BATTLE_MAX_BOMBS = 8;
export const BATTLE_MAX_FIRE = 8;
/** Hurry! starts with one minute left. */
export const HURRY_TICKS = 60 * 60;
export const DISEASES: Curse[] = ['superspeed', 'superslow', 'diarrhea', 'impotent', 'feeble', 'streaking', 'confusion', 'shortFuse', 'slowFuse', 'warp'];
export const DISEASE_NAMES: Record<Curse, string> = {
  superspeed: 'SUPERSPEED',
  superslow: 'SUPERSLOW',
  diarrhea: 'DIARRHEA',
  impotent: 'IMPOTENT',
  feeble: 'FEEBLE',
  streaking: 'STREAKING',
  confusion: 'CONFUSION',
  shortFuse: 'SHORT-TEMPERED',
  slowFuse: 'SLOW MOTION',
  warp: 'WARP',
};

export type RoundResult = { winner: number | null; team: number | null; draw: boolean; timeUp: boolean };

/** A knocked-out bomber riding the cart around the arena edge. */
export interface Cart {
  who: number;
  /** Position along the perimeter path in px. */
  pos: number;
  charge: number;
  bomb: Bomb | null;
  facing: Dir;
}

/** Spawn spots in the arena map, keyed by player number 1–5. */
export function mapSpawns(arena: ArenaDef): [number, number][] {
  if (arena.spawns) return arena.spawns;
  const out: [number, number][] = [];
  for (let n = 1; n <= 5; n++) {
    const y = arena.map.findIndex((r) => r.includes(String(n)));
    out.push([arena.map[y].indexOf(String(n)), y]);
  }
  return out;
}

/** Tiles of the playable interior in a clockwise spiral from the top-left, ring by ring. */
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

export interface RoundSetup {
  cfg: BattleConfig;
  arena: ArenaDef;
  /** Hyper Bomber prizes for this round, per player slot. */
  prizes?: (BattleItem | null)[];
  gold?: boolean[];
  seed?: number;
}

export class BattleWorld extends World {
  readonly cfg: BattleConfig;
  readonly arena: ArenaDef;
  readonly gim: Gimmicks;
  timeLeft: number;
  readonly unlimited: boolean;
  hurry = false;
  timeUp = false;
  /** Falling pressure blocks (tile + frames to impact). */
  falling: { tx: number; ty: number; t: number }[] = [];
  private pressureOrder: [number, number][] = [];
  private pressureIndex = 0;
  private pressureInterval = 12;
  result: RoundResult | null = null;
  endTimer = 0;
  /** report[killer][victim] (killer = victim for accidents and hazards). */
  readonly report: number[][] = [0, 1, 2, 3, 4].map(() => [0, 0, 0, 0, 0]);
  carts: Cart[] = [];
  readonly perimeter: [number, number][];
  itemPool: BattleItem[] = [];
  private lastDeathTick = -1000;
  private diseaseCooldown = new Map<number, number>();
  private warpTimer = new Map<number, number>();
  private lifted = new Map<number, Bomber>();

  constructor(setup: RoundSetup) {
    const { cfg, arena } = setup;
    const grid = new Grid(BATTLE_W, BATTLE_H);
    super(
      grid,
      {
        fuseTicks: 150,
        flameTicks: 30,
        burnTicks: 30,
        chainDelay: 3,
        maxBombs: BATTLE_MAX_BOMBS,
        maxFire: BATTLE_MAX_FIRE,
        baseSpeed: 1,
        speedStep: 0.25,
        maxSpeedLevel: 4,
        kickSpeed: 3,
        throwWraps: true,
        flamesStopAtItems: true,
      },
      setup.seed,
    );
    this.cfg = cfg;
    this.arena = arena;
    this.gim = new Gimmicks(this, arena);
    this.unlimited = cfg.rules.time === 0;
    this.timeLeft = this.unlimited ? Number.POSITIVE_INFINITY : cfg.rules.time * 60 * 60;
    this.perimeter = perimeterPath(BATTLE_W, BATTLE_H);

    // Build the static layout.
    const softSpots: [number, number][] = [];
    const always: [number, number][] = [];
    arena.map.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        const special = this.gim.parseTile(ch, x, y);
        let cell: number = Cell.Floor;
        if (special !== null) cell = special;
        else if (ch === '#') cell = Cell.Hard;
        else if (ch === 'x') always.push([x, y]);
        else if (ch === '.') softSpots.push([x, y]);
        grid.set(x, y, cell as 0 | 1 | 2 | 3);
      }
    });
    this.gim.finish();

    // Bombers.
    let spawns = mapSpawns(arena).slice();
    const active = cfg.players.map((p, i) => ({ p, i })).filter(({ p }) => p.type !== 'off');
    if (cfg.rules.randomPosition && cfg.level !== 'beginner') spawns = this.rng.shuffle(spawns.slice(0, 5));
    const reserved = new Set<string>();
    for (const { p, i } of active) {
      const [sx, sy] = spawns[i];
      const b = new Bomber(i, sx, sy);
      b.team = cfg.tag ? p.team : i;
      b.character = p.character;
      // Hit points are a Custom Battle handicap only.
      b.hp = cfg.mode === 'custom' ? Math.max(1, Math.min(MAX_HP, p.hp)) : 1;
      b.stats.bombs = 1;
      b.stats.fire = arena.maxFire ? BATTLE_MAX_FIRE : 2;
      b.gold = setup.gold?.[i] ?? false;
      this.bombers.push(b);
      reserved.add(`${sx},${sy}`);
      for (const d of ALL_DIRS) reserved.add(`${sx + DX[d]},${sy + DY[d]}`);
      // Two-step pocket so the first bomb can always be escaped.
      const open = ALL_DIRS.filter((d) => grid.get(sx + DX[d], sy + DY[d]) === Cell.Floor);
      if (open[0]) reserved.add(`${sx + 2 * DX[open[0]]},${sy + 2 * DY[open[0]]}`);
    }

    // Soft blocks.
    const free = softSpots.filter(([x, y]) => !reserved.has(`${x},${y}`) && !this.gim.blocksSoft(x, y));
    this.rng.shuffle(free);
    const soft = [...always, ...free.slice(0, Math.round(free.length * arena.density))];
    for (const [x, y] of soft) grid.set(x, y, Cell.Soft);

    // Items hidden under soft blocks.
    const counts = cfg.mode === 'custom' && cfg.customItems ? customCounts(cfg.customItems) : stageItems(cfg.level, arena);
    for (const [kind, n] of Object.entries(counts) as [BattleItem, number][]) {
      for (let k = 0; k < n; k++) this.itemPool.push(kind);
    }
    const hideable = this.rng.shuffle(soft.filter(([x, y]) => this.gim.at(x, y)?.kind !== 'tyre'));
    this.rng.shuffle(this.itemPool);
    this.itemPool.slice(0, hideable.length).forEach((kind, k) => this.setItem(hideable[k][0], hideable[k][1], kind, true));

    // Hyper Bomber prizes are equipped from the start.
    setup.prizes?.forEach((prize, i) => {
      const b = this.bombers.find((o) => o.id === i);
      if (b && prize) this.giveItem(b, prize, false);
    });

    // Sudden death plan.
    const refuge = arena.refuge;
    this.pressureOrder = spiralOrder(BATTLE_W, BATTLE_H).filter(([x, y]) => {
      if (grid.get(x, y) === Cell.Hard) return false;
      if (refuge && x >= refuge[0] && x <= refuge[2] && y >= refuge[1] && y <= refuge[3]) return false;
      if (!cfg.rules.suddenDeath) return x <= 2 || y <= 2 || x >= BATTLE_W - 3 || y >= BATTLE_H - 3;
      return true;
    });
    this.pressureInterval = Math.max(6, Math.floor((HURRY_TICKS - 8 * 60) / Math.max(1, this.pressureOrder.length)));
  }

  alive(): Bomber[] {
    return this.bombers.filter((b) => b.alive);
  }

  bomber(id: number): Bomber | undefined {
    return this.bombers.find((b) => b.id === id);
  }

  randomPoolItem(): BattleItem {
    const pool: BattleItem[] = ['bomb', 'fire', 'speed', 'bomb', 'fire', 'kick', 'skull'];
    return this.rng.pick(pool);
  }

  // ---------------------------------------------------------------- walkability hooks

  protected override extraCanEnter(b: Bomber, tx: number, ty: number): boolean {
    return this.gim.canEnter(b, tx, ty);
  }

  override bomberCanEnter(b: Bomber, tx: number, ty: number): boolean {
    if (!this.grid.inside(tx, ty)) {
      if (!this.gim.wrap) return false;
      const [wx, wy] = this.gim.wrapTile(tx, ty);
      if (this.gim.at(b.tx, b.ty)?.kind !== 'gap') return false;
      return this.bomberCanEnter(b, wx, wy);
    }
    // Hidden land mines do not block anybody.
    const bomb = this.bombAt[this.idx(tx, ty)];
    if (bomb && bomb.hidden) {
      const c = this.grid.get(tx, ty);
      return c === Cell.Floor && this.extraCanEnter(b, tx, ty);
    }
    return super.bomberCanEnter(b, tx, ty);
  }

  protected override afterMove(b: Bomber): void {
    this.gim.wrapBody(b);
  }

  protected override afterBombMove(bomb: Bomb): void {
    if (!this.gim.wrap) return;
    const before = bomb.x + bomb.y * 1000;
    this.gim.wrapBody(bomb);
    if (before !== bomb.x + bomb.y * 1000) {
      if (this.bombAt[this.idx(bomb.tx, bomb.ty)] === bomb) this.bombAt[this.idx(bomb.tx, bomb.ty)] = null;
      bomb.tx = toTile(bomb.x);
      bomb.ty = toTile(bomb.y);
      this.bombAt[this.idx(bomb.tx, bomb.ty)] = bomb;
    }
  }

  protected override flameNext(x: number, y: number, d: Dir): [number, number, Dir] | null {
    return this.gim.flameNext(x, y, d);
  }

  protected override onSlideCenter(bomb: Bomb): void {
    this.gim.steerBomb(bomb);
  }

  protected override slideCheck(bomb: Bomb, dir: Dir): 'ok' | 'blocked' | 'moved' | 'sink' {
    const g = this.gim.slideThrough(bomb, dir);
    if (g !== 'ok') return g;
    return this.bombCanEnter(bomb.tx + DX[dir], bomb.ty + DY[dir], bomb) ? 'ok' : 'blocked';
  }

  override bombCanEnter(tx: number, ty: number, self: Bomb | null = null): boolean {
    if (!super.bombCanEnter(tx, ty, self)) return false;
    const f = this.gim.at(tx, ty);
    if (f && f.kind === 'door') return true;
    for (const t of this.gim.trolleys) if (toTile(t.x) === tx && toTile(t.y) === ty) return false;
    return true;
  }

  // ---------------------------------------------------------------- bombs

  protected override shapeBomb(b: Bomber, tx: number, ty: number, s: BombShape): void {
    if (b.mineNext) {
      s.kind = 'mine';
      s.hidden = true;
      s.remote = true;
      return;
    }
    switch (b.stats.bombType) {
      case 'remote':
        s.kind = 'remote';
        s.remote = true;
        break;
      case 'power':
        // Only one Power Bomb at a time; the rest are ordinary.
        if (!this.bombs.some((o) => o.owner === b && o.kind === 'power' && !o.exploded)) {
          s.kind = 'power';
          s.range = BATTLE_MAX_FIRE;
        }
        break;
      case 'rubber':
        s.kind = 'rubber';
        break;
      case 'pierce':
        s.kind = 'pierce';
        s.pierce = true;
        break;
      default:
        break;
    }
    if (this.gim.boosts(tx, ty)) s.range = BATTLE_MAX_FIRE;
  }

  protected override onBombPlaced(b: Bomber, bomb: Bomb): void {
    if (bomb.kind === 'mine') b.mineNext = false;
  }

  protected override onSlideBlocked(bomb: Bomb, dir: Dir): void {
    const nx = bomb.tx + DX[dir];
    const ny = bomb.ty + DY[dir];
    const other = this.bombAtTile(nx, ny);
    // Two kicked bombs meeting head-on merge into a Super (or Ultra) bomb.
    if (other && other.slide === OPPOSITE[dir] && !other.conveyed && !bomb.conveyed) {
      const ultra = bomb.square > 0 || other.square > 0 || bomb.kind === 'power' || other.kind === 'power';
      this.removeBomb(other);
      if (bomb.owner) bomb.owner.activeBombs++;
      if (other.owner && bomb.owner !== other.owner) other.owner.activeBombs = Math.max(0, other.owner.activeBombs);
      bomb.square = ultra ? 3 : 2;
      bomb.kind = ultra ? 'ultra' : 'super';
      bomb.fuse = Math.max(bomb.fuse, 90);
      bomb.remote = false;
      this.emit({ type: 'kick', tx: bomb.tx, ty: bomb.ty });
      return;
    }
    // A kicked Power Bomb hurts whoever it slams into.
    if (bomb.kind === 'power' && !bomb.conveyed) {
      for (const b of this.bombers) {
        if (b.alive && b.tx === nx && b.ty === ny) this.kill(b, bomb.kicker ?? bomb.owner);
      }
    }
    // Rubber bombs bounce back.
    if (bomb.kind === 'rubber' && !bomb.conveyed && this.slideCheck(bomb, OPPOSITE[dir]) !== 'blocked') {
      bomb.slide = OPPOSITE[dir];
      this.emit({ type: 'bounce', tx: bomb.tx, ty: bomb.ty });
    }
  }

  protected override updateBombs(): void {
    super.updateBombs();
    // Land mines go off when somebody steps on them.
    for (const bomb of [...this.bombs]) {
      if (!bomb.hidden || bomb.exploded || bomb.age < 30) continue;
      if (this.bombers.some((b) => b.alive && b.airborne <= 0 && b.tx === bomb.tx && b.ty === bomb.ty && (b !== bomb.owner || bomb.age > 90))) {
        bomb.hidden = false;
        this.explode(bomb);
      }
    }
  }

  protected override onExplode(bomb: Bomb, _blast: Blast): void {
    this.gim.onBlastAt(bomb.tx, bomb.ty);
    // A cart bomb is done: the cart may throw again.
    for (const c of this.carts) if (c.bomb === bomb) c.bomb = null;
  }

  override burnItem(tx: number, ty: number): void {
    const it = this.items[this.idx(tx, ty)];
    if (it && it.kind === 'skull' && !this.cfg.rules.skullBomb) return;
    super.burnItem(tx, ty);
  }

  // ---------------------------------------------------------------- items

  protected override applyItem(b: Bomber, kind: string): void {
    this.giveItem(b, kind as BattleItem, true);
  }

  /** Apply an item's effect. `pickup` = collected from the field (records it for scattering). */
  giveItem(b: Bomber, kind: BattleItem, pickup: boolean): void {
    const s = b.stats;
    if (kind !== 'skull' && b.curse) {
      b.curse = null; // any other item cures a disease
      b.streak = null;
    }
    if (pickup && kind !== 'skull' && kind !== 'egg' && kind !== 'heart' && kind !== 'flak') b.collected.push(kind);
    switch (kind) {
      case 'bomb':
        s.bombs = Math.min(BATTLE_MAX_BOMBS, s.bombs + 1);
        break;
      case 'fire':
        s.fire = Math.min(BATTLE_MAX_FIRE, s.fire + 1);
        break;
      case 'fullfire':
        s.fire = BATTLE_MAX_FIRE;
        break;
      case 'speed':
        s.speed = Math.min(this.rules.maxSpeedLevel, s.speed + 1);
        b.speedOverride = null;
        break;
      case 'geta':
        s.speed = Math.max(-1, s.speed - 1);
        break;
      case 'kick':
        // Bomb Kick and Bomb Pass can't be combined: the newer one wins.
        s.kick = true;
        s.bombPass = false;
        break;
      case 'bombpass':
        s.bombPass = true;
        s.kick = false;
        break;
      case 'glove':
        s.glove = true;
        break;
      case 'punch':
        s.punch = true;
        break;
      case 'push':
        s.push = true;
        break;
      case 'line':
        s.lineBomb = true;
        break;
      case 'remote':
      case 'powerbomb':
      case 'rubber':
      case 'pierce':
        s.bombType = kind === 'powerbomb' ? 'power' : kind;
        s.remote = kind === 'remote';
        s.pierce = kind === 'pierce';
        break;
      case 'mine':
        b.mineNext = true;
        break;
      case 'heart':
        b.heart = true;
        break;
      case 'wallpass':
        s.wallPass = true;
        break;
      case 'flak':
        b.invincible = Math.max(b.invincible, 10 * 60);
        break;
      case 'egg':
        this.hatch(b);
        break;
      case 'skull': {
        const curse = this.rng.pick(DISEASES);
        this.applyCurse(b, curse, 0);
        if (curse === 'warp') this.warpTimer.set(b.id, 120 + this.rng.int(240));
        this.emit({ type: 'skull', who: b.id, curse });
        break;
      }
    }
  }

  private hatch(b: Bomber): void {
    if (this.cfg.level === 'beginner') return;
    if (b.partner) {
      if (this.cfg.level === 'advanced' && b.eggs < 1) b.eggs++;
      return;
    }
    const kinds = PARTNERS.filter((p) => p.level === this.cfg.level).map((p) => p.kind);
    b.partner = this.rng.pick(kinds);
    b.stats.kick = b.stats.kick || b.partner === 'louieBlue';
    this.emit({ type: 'item', tx: b.tx, ty: b.ty, item: `partner:${b.partner}`, who: b.id });
  }

  /** Knock some collected power-ups out of a bomber onto the floor. */
  scatterItems(b: Bomber, n: number): void {
    for (let k = 0; k < n && b.collected.length; k++) {
      const kind = b.collected.splice(this.rng.int(b.collected.length), 1)[0] as BattleItem;
      this.revokeItem(b, kind);
      this.dropItem(kind, b.tx, b.ty);
    }
  }

  private revokeItem(b: Bomber, kind: BattleItem): void {
    const s = b.stats;
    switch (kind) {
      case 'bomb':
        s.bombs = Math.max(1, s.bombs - 1);
        break;
      case 'fire':
        s.fire = Math.max(1, s.fire - 1);
        break;
      case 'fullfire':
        s.fire = Math.min(BATTLE_MAX_FIRE, 2 + b.collected.filter((k) => k === 'fire').length);
        break;
      case 'speed':
        s.speed = Math.max(0, s.speed - 1);
        break;
      case 'geta':
        s.speed = Math.min(this.rules.maxSpeedLevel, s.speed + 1);
        break;
      case 'kick':
        s.kick = false;
        break;
      case 'bombpass':
        s.bombPass = false;
        break;
      case 'wallpass':
        s.wallPass = false;
        break;
      case 'glove':
        s.glove = false;
        break;
      case 'punch':
        s.punch = false;
        break;
      case 'push':
        s.push = false;
        break;
      case 'line':
        s.lineBomb = false;
        break;
      case 'remote':
      case 'powerbomb':
      case 'rubber':
      case 'pierce':
        s.bombType = 'normal';
        s.remote = false;
        s.pierce = false;
        break;
      default:
        break;
    }
  }

  /** Put a visible item on a random free floor tile near (fx, fy). */
  dropItem(kind: BattleItem, fx: number, fy: number): void {
    const spots: [number, number][] = [];
    for (let y = 1; y < this.grid.h - 1; y++) {
      for (let x = 1; x < this.grid.w - 1; x++) {
        if (this.grid.get(x, y) !== Cell.Floor || this.items[this.idx(x, y)] || this.bombAt[this.idx(x, y)]) continue;
        if (this.flameTimer[this.idx(x, y)] > 0) continue;
        if (this.bombers.some((b) => b.alive && b.tx === x && b.ty === y)) continue;
        const f = this.gim.at(x, y);
        if (f && f.kind !== 'cover' && f.kind !== 'ice' && f.kind !== 'bridge') continue;
        spots.push([x, y]);
      }
    }
    if (!spots.length) return;
    spots.sort((a, b) => Math.abs(a[0] - fx) + Math.abs(a[1] - fy) - (Math.abs(b[0] - fx) + Math.abs(b[1] - fy)));
    const near = spots.slice(0, Math.min(spots.length, 12));
    const [x, y] = this.rng.pick(near);
    this.setItem(x, y, kind, false);
  }

  // ---------------------------------------------------------------- hits

  protected override absorbHit(b: Bomber, killer: Bomber | null): boolean {
    if (b.invincible > 0) return true;
    if (b.partner) {
      // The partner takes the hit.
      b.partner = null;
      b.invincible = 90;
      if (b.eggs > 0) {
        b.eggs--;
        this.hatch(b);
      }
      this.emit({ type: 'stun', who: b.id });
      return true;
    }
    if (b.heart) {
      b.heart = false;
      b.invincible = 120;
      this.emit({ type: 'stun', who: b.id });
      return true;
    }
    if (b.hp > 1) {
      b.hp--;
      b.invincible = 120;
      this.emit({ type: 'stun', who: b.id });
      return true;
    }
    void killer;
    return false;
  }

  override flameProof(b: Bomber): boolean {
    return b.invincible > 0 || b.stats.flamePass || b.airborne > 0;
  }

  protected override onBomberDeath(b: Bomber, killer: Bomber | null): void {
    this.lastDeathTick = this.tick;
    this.report[killer ? killer.id : b.id][b.id]++;
    if (b.carryingBomber) {
      b.carryingBomber.airborne = 0;
      b.carryingBomber = null;
    }
    // Everything the bomber collected spills back onto the field.
    const drop = b.collected.splice(0, 8) as BattleItem[];
    for (const kind of drop) this.dropItem(kind, b.tx, b.ty);
    b.curse = null;
    // Bomber Cart: ride around the edge.
    if (this.cfg.rules.cart !== 'off' && !this.result) {
      const cart: Cart = { who: b.id, pos: this.nearestPerimeter(b.tx, b.ty), charge: 0, bomb: null, facing: 'down' };
      this.carts.push(cart);
    }
    // Super Bomber Cart: a cart bomb that hits somebody swaps them.
    if (this.cfg.rules.cart === 'super' && killer && killer !== b && !killer.alive) {
      const cart = this.carts.find((c) => c.who === killer.id);
      if (cart) {
        this.carts = this.carts.filter((c) => c !== cart);
        this.revive(killer, b.tx, b.ty);
      }
    }
  }

  private revive(b: Bomber, tx: number, ty: number): void {
    b.alive = true;
    b.deathTimer = -1;
    b.x = tileCenter(tx);
    b.y = tileCenter(ty);
    b.invincible = 120;
    b.stats.bombs = 1;
    b.stats.fire = 2;
    b.activeBombs = this.bombs.filter((o) => o.owner === b).length;
    this.emit({ type: 'warp', tx, ty });
  }

  // ---------------------------------------------------------------- specials (B)

  protected override onSpecial(b: Bomber): void {
    if (b.partner && this.partnerAbility(b)) return;
    if (this.cfg.level === 'advanced' && b.intent.dirs.length && this.characterSpecial(b, b.intent.dirs[0])) return;
    if (b.stats.remote) this.detonateRemote(b);
  }

  private partnerAbility(b: Bomber): boolean {
    const d = b.facing;
    const fx = b.tx + DX[d];
    const fy = b.ty + DY[d];
    switch (b.partner as PartnerKind) {
      case 'louieYellow':
      case 'dox': {
        // Kick / shove the soft block ahead.
        if (this.grid.get(fx, fy) !== Cell.Soft || this.burnTimer[this.idx(fx, fy)] > 0) return false;
        let x = fx;
        let y = fy;
        const limit = b.partner === 'dox' ? 1 : 12;
        for (let i = 0; i < limit; i++) {
          const nx = x + DX[d];
          const ny = y + DY[d];
          if (this.grid.get(nx, ny) !== Cell.Floor || this.bombAt[this.idx(nx, ny)] || this.items[this.idx(nx, ny)] || this.bombers.some((o) => o.alive && o.tx === nx && o.ty === ny)) break;
          x = nx;
          y = ny;
        }
        if (x === fx && y === fy) return false;
        const item = this.items[this.idx(fx, fy)];
        this.grid.set(fx, fy, Cell.Floor);
        this.grid.set(x, y, Cell.Soft);
        this.items[this.idx(fx, fy)] = null;
        if (item) this.items[this.idx(x, y)] = item;
        this.emit({ type: 'kick', tx: x, ty: y });
        return true;
      }
      case 'louieBlue': {
        const bomb = this.bombAtTile(fx, fy);
        if (!bomb || bomb.flight) return false;
        this.launch(bomb, d, 4);
        this.emit({ type: 'punch', tx: fx, ty: fy });
        return true;
      }
      case 'louieGreen': {
        b.streak = d;
        this.applyCurse(b, 'streaking', 0);
        b.curseTimer = 60;
        return true;
      }
      case 'louiePink': {
        const lx = b.tx + DX[d] * 2;
        const ly = b.ty + DY[d] * 2;
        const [wx, wy] = this.gim.wrapTile(lx, ly);
        if (!this.grid.inside(wx, wy) || this.grid.get(wx, wy) !== Cell.Floor || this.bombAt[this.idx(wx, wy)]) return false;
        this.jump(b, wx, wy, 24, 18);
        this.emit({ type: 'jump', tx: b.tx, ty: b.ty });
        return true;
      }
      case 'louieBrown':
      case 'coney':
        return this.lineBomb(b);
      case 'pytera': {
        if (b.carrying) {
          const bomb = b.carrying;
          b.carrying = null;
          this.launch(bomb, d, 3, tileCenter(b.tx), tileCenter(b.ty));
          return true;
        }
        const bomb = this.bombAtTile(fx, fy);
        if (!bomb || bomb.flight || bomb.square) return false;
        this.bombAt[this.idx(bomb.tx, bomb.ty)] = null;
        bomb.held = true;
        b.carrying = bomb;
        return true;
      }
      case 'simeon': {
        // Lift a soft block, or put it down again.
        if (this.grid.get(fx, fy) === Cell.Soft && this.burnTimer[this.idx(fx, fy)] === 0 && !b.carrying) {
          this.grid.set(fx, fy, Cell.Floor);
          b.eggs = Math.max(b.eggs, 0);
          b.speedOverride = b.speedOverride ?? null;
          (b as Bomber & { block?: boolean }).block = true;
          return true;
        }
        if ((b as Bomber & { block?: boolean }).block && this.grid.get(fx, fy) === Cell.Floor && !this.bombAt[this.idx(fx, fy)] && !this.bombers.some((o) => o.alive && o.tx === fx && o.ty === fy)) {
          this.grid.set(fx, fy, Cell.Soft);
          (b as Bomber & { block?: boolean }).block = false;
          return true;
        }
        return false;
      }
      case 'drakko': {
        for (const o of this.bombers) {
          if (o === b || !o.alive) continue;
          if (Math.abs(o.tx - b.tx) + Math.abs(o.ty - b.ty) <= 1) {
            o.stunned = Math.max(o.stunned, 60);
            this.scatterItems(o, 2);
          }
        }
        this.emit({ type: 'shake', frames: 8 });
        return true;
      }
      default:
        return false;
    }
  }

  private characterSpecial(b: Bomber, d: Dir): boolean {
    const ch = CHARACTERS[b.character];
    if (!ch?.special || b.specialCooldown > 0 || b.weak > 0) return false;
    b.facing = d;
    switch (ch.special) {
      case 'jet':
        b.speedOverride = 2.4;
        b.specialCooldown = 180;
        b.weak = -1; // becomes weak when the dash ends
        break;
      case 'bazooka': {
        for (let i = 1; i <= 12; i++) {
          const x = b.tx + DX[d] * i;
          const y = b.ty + DY[d] * i;
          const c = this.grid.get(x, y);
          if (c === Cell.Hard) break;
          if (c === Cell.Soft) {
            this.burnBlock(x, y);
            break;
          }
        }
        b.specialCooldown = 30;
        b.weak = 600;
        break;
      }
      case 'great':
        b.invincible = 5 * 60;
        b.specialCooldown = 5 * 60;
        b.weak = -1;
        break;
      case 'hammer':
      case 'sword': {
        const o = this.bombers.find((v) => v !== b && v.alive && v.tx === b.tx + DX[d] && v.ty === b.ty + DY[d]);
        if (o) {
          o.stunned = Math.max(o.stunned, 45);
          this.scatterItems(o, 3);
        }
        b.specialCooldown = 150;
        break;
      }
      case 'laser': {
        for (let i = 1; i <= 6; i++) {
          const x = b.tx + DX[d] * i;
          const y = b.ty + DY[d] * i;
          if (this.grid.get(x, y) === Cell.Hard || this.grid.get(x, y) === Cell.Soft) break;
          for (const o of this.bombers) {
            if (o !== b && o.alive && o.tx === x && o.ty === y) {
              o.stunned = Math.max(o.stunned, 45);
              this.scatterItems(o, 2);
            }
          }
        }
        b.specialCooldown = 180;
        break;
      }
      case 'pistol': {
        for (let i = 1; i <= 12; i++) {
          const x = b.tx + DX[d] * i;
          const y = b.ty + DY[d] * i;
          const c = this.grid.get(x, y);
          if (c === Cell.Hard || c === Cell.Soft) break;
          const bomb = this.bombAtTile(x, y);
          if (bomb) {
            this.explode(bomb);
            break;
          }
        }
        b.specialCooldown = 120;
        break;
      }
      default:
        return false;
    }
    this.emit({ type: 'punch', tx: b.tx, ty: b.ty });
    return true;
  }

  // ---------------------------------------------------------------- actions (C)

  protected override onAction(b: Bomber): void {
    // Stop our kicked bombs.
    let stopped = false;
    for (const bomb of this.bombs) {
      if (bomb.slide && !bomb.conveyed && bomb.kicker === b) {
        bomb.slide = null;
        const tx = toTile(bomb.x);
        const ty = toTile(bomb.y);
        this.moveBomb(bomb, tx, ty);
        stopped = true;
      }
    }
    if (stopped) return;
    const d = b.facing;
    const fx = b.tx + DX[d];
    const fy = b.ty + DY[d];
    if (b.stats.push) {
      const o = this.bombers.find((v) => v !== b && v.alive && v.airborne <= 0 && v.tx === fx && v.ty === fy);
      if (o) {
        const nx = fx + DX[d];
        const ny = fy + DY[d];
        if (this.bomberCanEnter(o, nx, ny)) {
          o.x = tileCenter(nx);
          o.y = tileCenter(ny);
        }
        o.stunned = Math.max(o.stunned, 20);
        this.emit({ type: 'punch', tx: fx, ty: fy });
        return;
      }
    }
    if (b.stats.punch) {
      const bomb = this.bombAtTile(fx, fy);
      if (bomb && !bomb.flight && !bomb.hidden && bomb.square === 0) {
        this.launch(bomb, d, 3);
        if (bomb.kind === 'rubber') bomb.flight!.dur += 4;
        this.emit({ type: 'punch', tx: fx, ty: fy });
        return;
      }
    }
    if (b.stats.lineBomb) this.lineBomb(b);
  }

  /** Multi Bomb: lay the remaining bombs (up to four) in a row ahead. */
  private lineBomb(b: Bomber): boolean {
    const d = b.facing;
    let x = b.tx;
    let y = b.ty;
    let placed = 0;
    if (this.placeBomb(b, x, y)) placed++;
    while (placed < 4 && b.activeBombs < b.stats.bombs) {
      x += DX[d];
      y += DY[d];
      if (!this.canPlaceBomb(b, x, y) || this.tileHasBlockingBody(x, y, null) || this.items[this.idx(x, y)]) break;
      this.placeBomb(b, x, y);
      placed++;
    }
    return placed > 0;
  }

  // ---------------------------------------------------------------- Power Glove (A)

  protected override updateBomber(b: Bomber): void {
    if (b.alive && b.specialCooldown > 0) {
      b.specialCooldown--;
      if (b.specialCooldown === 0 && b.weak === -1) {
        b.weak = 600;
        if (CHARACTERS[b.character]?.special === 'jet') b.speedOverride = null;
      }
    }
    if (b.weak > 0) {
      b.weak--;
      if (b.weak === 0) b.speedOverride = null;
      else b.speedOverride = 0.6;
    }
    if (b.alive && b.stats.glove && !b.stunned && b.airborne <= 0) {
      if (b.carrying || b.carryingBomber) {
        if (!b.intent.bombHeld) {
          if (b.carrying) {
            const bomb = b.carrying;
            b.carrying = null;
            this.launch(bomb, b.facing, 3, tileCenter(b.tx), tileCenter(b.ty));
          } else if (b.carryingBomber) {
            const o = b.carryingBomber;
            b.carryingBomber = null;
            this.lifted.delete(o.id);
            const [tx, ty] = this.gim.randomLanding(b.tx, b.ty, 0) ? this.landingAhead(b) : [b.tx, b.ty];
            this.jump(o, tx, ty, 30, 24);
            o.stunned = 60;
          }
          this.emit({ type: 'punch', tx: b.tx, ty: b.ty });
        }
      } else if (b.intent.bomb) {
        const bomb = this.bombAtTile(b.tx, b.ty);
        const other = this.bombers.find((o) => o !== b && o.alive && o.airborne <= 0 && Math.abs(o.x - b.x) < 8 && Math.abs(o.y - b.y) < 8);
        if (bomb && !bomb.flight && !bomb.slide && bomb.square === 0 && !bomb.hidden && Math.abs(b.x - bomb.x) < 7 && Math.abs(b.y - bomb.y) < 7) {
          this.bombAt[this.idx(bomb.tx, bomb.ty)] = null;
          bomb.held = true;
          b.carrying = bomb;
          b.intent = { ...b.intent, bomb: false };
        } else if (other && !bomb) {
          b.carryingBomber = other;
          this.lifted.set(other.id, b);
          b.intent = { ...b.intent, bomb: false };
        }
      }
    }
    // A lifted bomber hangs over the carrier's head.
    const carrier = this.lifted.get(b.id);
    if (carrier) {
      if (!carrier.alive || carrier.carryingBomber !== b) this.lifted.delete(b.id);
      else {
        b.x = carrier.x;
        b.y = carrier.y;
        b.moving = false;
        return;
      }
    }
    super.updateBomber(b);
    if (b.carrying) {
      b.carrying.x = b.x;
      b.carrying.y = b.y - 12;
    }
  }

  private landingAhead(b: Bomber): [number, number] {
    for (let dist = 3; dist >= 1; dist--) {
      const [x, y] = this.gim.wrapTile(b.tx + DX[b.facing] * dist, b.ty + DY[b.facing] * dist);
      if (this.grid.inside(x, y) && this.grid.get(x, y) === Cell.Floor && !this.bombAt[this.idx(x, y)]) return [x, y];
    }
    return [b.tx, b.ty];
  }

  protected override onLand(b: Bomber): void {
    super.onLand(b);
    if (this.grid.get(b.tx, b.ty) === Cell.Void || this.grid.get(b.tx, b.ty) === Cell.Hard) {
      // Landed somewhere impossible: hop to the nearest floor.
      const t = this.gim.randomLanding(b.tx, b.ty, 0);
      if (t) {
        b.x = tileCenter(t[0]);
        b.y = tileCenter(t[1]);
      }
    }
    if (this.grid.get(b.tx, b.ty) === Cell.Soft) this.grid.set(b.tx, b.ty, Cell.Floor);
  }

  // ---------------------------------------------------------------- round flow

  protected override preUpdate(): void {
    if (this.result) {
      this.endTimer++;
      return;
    }
    this.gim.update();
    if (!this.unlimited && this.timeLeft > 0) {
      this.timeLeft--;
      if (this.timeLeft === HURRY_TICKS || (this.tick === 1 && this.timeLeft < HURRY_TICKS)) {
        this.hurry = true;
        this.emit({ type: 'hurry' });
      }
      if (this.timeLeft === 0) {
        this.timeUp = true;
        this.emit({ type: 'timeUp' });
      }
    }
    if (this.hurry && !this.timeUp) this.updatePressure();
    this.updateCarts();
    this.updateDiseases();
  }

  private updatePressure(): void {
    if (this.tick % this.pressureInterval === 0 && this.pressureIndex < this.pressureOrder.length) {
      const [tx, ty] = this.pressureOrder[this.pressureIndex++];
      this.falling.push({ tx, ty, t: 16 });
    }
    for (const f of this.falling) {
      f.t--;
      if (f.t === 0) this.pressureLand(f.tx, f.ty);
    }
    this.falling = this.falling.filter((f) => f.t > 0);
  }

  private pressureLand(tx: number, ty: number): void {
    const i = this.idx(tx, ty);
    this.grid.set(tx, ty, Cell.Hard);
    this.burnTimer[i] = 0;
    this.items[i] = null;
    this.gim.set(tx, ty, null);
    const bomb = this.bombAt[i];
    if (bomb) this.crushBomb(bomb);
    for (const b of this.bombers) {
      if (b.alive && b.tx === tx && b.ty === ty) this.kill(b, null, true);
    }
    this.emit({ type: 'pressure', tx, ty });
  }

  private updateDiseases(): void {
    const living = this.alive();
    for (const b of living) {
      const cd = this.diseaseCooldown.get(b.id) ?? 0;
      if (cd > 0) this.diseaseCooldown.set(b.id, cd - 1);
      if (b.curse === 'warp') {
        const t = (this.warpTimer.get(b.id) ?? 200) - 1;
        this.warpTimer.set(b.id, t);
        if (t <= 0) {
          this.warpTimer.set(b.id, 180 + this.rng.int(300));
          const others = living.filter((o) => o !== b && o.airborne <= 0);
          if (others.length) {
            const o = this.rng.pick(others);
            const [x, y] = [b.x, b.y];
            b.x = tileCenter(o.tx);
            b.y = tileCenter(o.ty);
            o.x = tileCenter(toTile(x));
            o.y = tileCenter(toTile(y));
            this.emit({ type: 'warp', tx: b.tx, ty: b.ty });
          }
        }
      }
    }
    // Touching passes the disease on.
    for (let i = 0; i < living.length; i++) {
      for (let j = 0; j < living.length; j++) {
        const a = living[i];
        const b = living[j];
        if (a === b || !a.curse || b.curse || a.airborne > 0 || b.airborne > 0) continue;
        if ((this.diseaseCooldown.get(a.id) ?? 0) > 0) continue;
        if (Math.abs(a.x - b.x) < 12 && Math.abs(a.y - b.y) < 12) {
          this.applyCurse(b, a.curse, 0);
          if (a.curse === 'warp') this.warpTimer.set(b.id, 180);
          a.curse = null;
          a.streak = null;
          this.diseaseCooldown.set(b.id, 60);
          this.emit({ type: 'skull', who: b.id, curse: b.curse! });
        }
      }
    }
  }

  // ---------------------------------------------------------------- bomber carts

  private nearestPerimeter(tx: number, ty: number): number {
    let best = 0;
    let bestD = Infinity;
    this.perimeter.forEach(([x, y], i) => {
      const d = Math.abs(x - tx) + Math.abs(y - ty);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best * TILE;
  }

  /** Cart tile and the direction it throws into the arena. */
  cartTile(c: Cart): { tx: number; ty: number; x: number; y: number; into: Dir } {
    const n = this.perimeter.length;
    const f = c.pos / TILE;
    const i = ((Math.floor(f) % n) + n) % n;
    const j = (i + 1) % n;
    const k = f - Math.floor(f);
    const [ax, ay] = this.perimeter[i];
    const [bx, by] = this.perimeter[j];
    const x = tileCenter(ax) + (tileCenter(bx) - tileCenter(ax)) * k;
    const y = tileCenter(ay) + (tileCenter(by) - tileCenter(ay)) * k;
    const [tx, ty] = this.perimeter[Math.round(f) % n];
    const into: Dir = ty === 0 ? 'down' : ty === this.grid.h - 1 ? 'up' : tx === 0 ? 'right' : 'left';
    return { tx, ty, x, y, into };
  }

  private updateCarts(): void {
    const total = this.perimeter.length * TILE;
    for (const c of this.carts) {
      const b = this.bomber(c.who);
      if (!b || b.alive) continue;
      const it = b.intent;
      const t = this.cartTile(c);
      // Steering follows the arena edge: along the top/bottom use left/right, along the sides up/down.
      const horizontalSide = t.into === 'down' || t.into === 'up';
      let move = 0;
      for (const d of it.dirs) {
        if (horizontalSide && (d === 'left' || d === 'right')) move = d === 'right' ? 1 : -1;
        if (!horizontalSide && (d === 'up' || d === 'down')) move = d === 'down' ? 1 : -1;
        if (move) break;
      }
      // On the bottom and left sides the path runs backwards relative to the screen.
      if (t.into === 'up' || t.into === 'right') move = -move;
      c.pos = (((c.pos + move * 1.5) % total) + total) % total;
      if (move) c.facing = move > 0 ? 'right' : 'left';
      if (c.bomb) continue;
      if (it.bombHeld) c.charge = Math.min(90, c.charge + 1);
      else if (c.charge > 0) {
        const dist = 1 + Math.floor(c.charge / 15);
        c.charge = 0;
        this.cartThrow(b, t, dist);
      }
    }
  }

  private cartThrow(b: Bomber, t: { tx: number; ty: number; into: Dir }, dist: number): void {
    let tx = t.tx + DX[t.into] * dist;
    let ty = t.ty + DY[t.into] * dist;
    tx = Math.max(1, Math.min(this.grid.w - 2, tx));
    ty = Math.max(1, Math.min(this.grid.h - 2, ty));
    const bomb: Bomb = {
      id: 100000 + this.tick,
      owner: b,
      tx: t.tx,
      ty: t.ty,
      x: tileCenter(t.tx),
      y: tileCenter(t.ty),
      range: 2,
      fuse: 120,
      remote: false,
      pierce: false,
      passers: new Set(),
      slide: null,
      flight: null,
      chain: -1,
      serial: 0,
      exploded: false,
      held: false,
      age: 0,
      square: 0,
      kind: 'normal',
      hidden: false,
      conveyed: false,
      slideSpeed: this.rules.kickSpeed,
      kicker: null,
    };
    this.bombs.push(bomb);
    this.throwTo(bomb, tx, ty);
    const cart = this.carts.find((c) => c.who === b.id);
    if (cart) cart.bomb = bomb;
    this.emit({ type: 'punch', tx: t.tx, ty: t.ty });
  }

  // ---------------------------------------------------------------- result

  protected override postUpdate(): void {
    if (this.result) return;
    const living = this.alive();
    const teams = new Set(living.map((b) => b.team));
    const grace = this.tick - this.lastDeathTick > 45;
    if (this.timeUp) {
      if (teams.size <= 1 && living.length) this.finish(living[0]);
      else this.result = { winner: null, team: null, draw: true, timeUp: true };
      return;
    }
    if (grace && teams.size <= 1) {
      if (living.length) this.finish(living[0]);
      else this.result = { winner: null, team: null, draw: true, timeUp: false };
    }
  }

  private finish(winner: Bomber): void {
    if (this.cfg.tag) {
      this.result = { winner: null, team: winner.team, draw: false, timeUp: false };
      for (const b of this.alive()) b.frozen = true;
    } else {
      this.result = { winner: winner.id, team: winner.team, draw: false, timeUp: false };
      winner.frozen = true;
    }
    this.endTimer = 0;
  }

  /** Items spill out on hits (thrown bombs on heads). */
  protected override updateFlight(bomb: Bomb): void {
    const f = bomb.flight!;
    const landing = f.t + 1 >= f.dur;
    if (landing) {
      const victim = this.bombers.find((b) => b.alive && b.airborne <= 0 && b.tx === f.ttx && b.ty === f.tty);
      if (victim && bomb.owner && bomb.owner !== victim) this.scatterItems(victim, 1);
    }
    super.updateFlight(bomb);
    // Rubber bombs keep bouncing in random directions.
    if (landing && !bomb.flight && bomb.kind === 'rubber' && !bomb.exploded && this.rng.chance(0.6)) {
      const d = this.rng.pick(ALL_DIRS);
      this.launch(bomb, d, 1 + this.rng.int(2));
    }
  }
}

/** Border tiles clockwise from the top-left corner (the Bomber Cart track). */
export function perimeterPath(w: number, h: number): [number, number][] {
  const out: [number, number][] = [];
  for (let x = 1; x < w - 1; x++) out.push([x, 0]);
  for (let y = 1; y < h - 1; y++) out.push([w - 1, y]);
  for (let x = w - 2; x >= 1; x--) out.push([x, h - 1]);
  for (let y = h - 2; y >= 1; y--) out.push([0, y]);
  return out;
}

/** The items hidden in a stage in Battle Royal: the level's mix with the stage's tweaks. */
export function stageItems(level: Level, arena: ArenaDef): Partial<Record<BattleItem, number>> {
  return { ...LEVEL_ITEMS[level], ...(arena.items ?? {}) };
}

/** Custom Battle counts, limited to what the Set Item screen offers. */
export function customCounts(items: Partial<Record<BattleItem, number>>): Partial<Record<BattleItem, number>> {
  const out: Partial<Record<BattleItem, number>> = {};
  for (const kind of CUSTOM_ITEMS) {
    const n = items[kind];
    if (typeof n === 'number' && n > 0) out[kind] = Math.min(9, Math.floor(n));
  }
  return out;
}

/** How many soft blocks (and so hidden items at most) a stage gets. */
export function softBlockCount(cfg: BattleConfig, arena: ArenaDef): number {
  return new BattleWorld({ cfg, arena, seed: 1 }).grid.count(Cell.Soft);
}
