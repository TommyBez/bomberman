import type { Bomber } from '../core/bomber';
import { moveBody } from '../core/movement';
import { ALL_DIRS, Cell, DX, DY, OPPOSITE, TILE, isHorizontal, tileCenter, toTile, type Dir } from '../core/types';
import type { Bomb } from '../core/world';
import type { ArenaDef } from './arenas';
import type { BattleWorld } from './battleWorld';

export type Feature =
  | { kind: 'conveyor'; dir: Dir }
  | { kind: 'arrow'; dir: Dir; rotating: boolean }
  | { kind: 'warp'; index: number }
  | { kind: 'trampoline'; to?: [number, number] }
  | { kind: 'seesaw'; id: number; end: 0 | 1 }
  | { kind: 'sign'; speed: number }
  | { kind: 'tyre' }
  | { kind: 'rail'; trolleyWarp: boolean }
  | { kind: 'switch' }
  | { kind: 'cover'; style: 'pipe' | 'hut' | 'foliage'; open?: number }
  | { kind: 'bridge' }
  | { kind: 'ice'; cracks: number }
  | { kind: 'hole' }
  | { kind: 'water' }
  | { kind: 'portal'; to: [number, number] }
  | { kind: 'bend'; turn: Partial<Record<Dir, Dir>> }
  | { kind: 'door'; open: 'h' | 'v'; push: number; turn: number }
  | { kind: 'gap' };

export interface Seesaw {
  a: [number, number];
  b: [number, number];
  /** Which end is currently down (0 = a, 1 = b). */
  down: 0 | 1;
  /** Tilt animation frames left. */
  anim: number;
}

export interface Trolley {
  x: number;
  y: number;
  dir: Dir;
  speed: number;
  stop: number;
  riders: Bomber[];
  /** Frames of the warp flash. */
  flash: number;
}

export interface Robot {
  x: number;
  y: number;
  dir: Dir;
  stomp: number;
  cooldown: number;
  leaving: number;
  gone: boolean;
}

export interface Fish {
  tx: number;
  ty: number;
  t: number;
}

/** Conveyor belt speed in px per tick (×2 when a Fast Lane switch is on). */
export const BELT_SPEED = 0.5;
/** How long a hut stays roofless after a blast inside it. */
export const HUT_OPEN_TICKS = 300;
const SIGN_SPEEDS = [0.55, 0.8, 1.1, 1.5, 2.0];
const TYRE_RESPAWN = 8 * 60;

export class Gimmicks {
  readonly features: (Feature | null)[];
  seesaws: Seesaw[] = [];
  warps: [number, number][] = [];
  trolleys: Trolley[] = [];
  robot: Robot | null = null;
  fish: Fish[] = [];
  switchOn = false;
  /** Belt speed multiplier and direction flip (Fast Lane / Coming and Going). */
  beltSpeed = 1;
  beltReverse = false;
  wrap = false;
  private tyres: { tx: number; ty: number; timer: number }[] = [];
  private stations = new Set<number>();
  /** Last tile of each bomber (index by bomber id) for "entered a tile" triggers. */
  private lastTile = new Map<number, number>();
  /** Warp/trampoline cooldown: the tile a bomber must leave before it triggers again. */
  private lock = new Map<number, number>();
  tick = 0;

  constructor(
    private readonly w: BattleWorld,
    readonly arena: ArenaDef,
  ) {
    this.features = new Array<Feature | null>(w.grid.w * w.grid.h).fill(null);
  }

  idx(x: number, y: number): number {
    return y * this.w.grid.w + x;
  }

  at(x: number, y: number): Feature | null {
    const g = this.w.grid;
    if (!g.inside(x, y)) return null;
    return this.features[this.idx(x, y)];
  }

  set(x: number, y: number, f: Feature | null): void {
    this.features[this.idx(x, y)] = f;
  }

  // ------------------------------------------------------------------ parsing

  /** Called for each map character; returns the grid cell to use (null = default). */
  parseTile(ch: string, x: number, y: number): number | null {
    const g = this.arena.gimmick;
    switch (ch) {
      case '>':
      case '<':
      case '^':
      case 'v':
        this.set(x, y, { kind: 'conveyor', dir: ch === '>' ? 'right' : ch === '<' ? 'left' : ch === '^' ? 'up' : 'down' });
        return Cell.Floor;
      case 'R':
      case 'L':
      case 'U':
      case 'D':
        this.set(x, y, { kind: 'arrow', dir: ch === 'R' ? 'right' : ch === 'L' ? 'left' : ch === 'U' ? 'up' : 'down', rotating: false });
        return Cell.Floor;
      case '@':
        this.set(x, y, { kind: 'arrow', dir: 'up', rotating: true });
        return Cell.Floor;
      case 'W':
        if (g === 'mystery') {
          this.set(x, y, { kind: 'rail', trolleyWarp: true });
        } else {
          this.set(x, y, { kind: 'warp', index: this.warps.length });
          this.warps.push([x, y]);
        }
        return Cell.Floor;
      case 'T':
        this.set(x, y, { kind: 'trampoline' });
        return Cell.Floor;
      case 'S': {
        const left = this.at(x - 1, y);
        if (left && left.kind === 'seesaw' && left.end === 0 && this.seesaws[left.id].b[0] === -1) {
          const s = this.seesaws[left.id];
          s.b = [x, y];
          this.set(x, y, { kind: 'seesaw', id: left.id, end: 1 });
        } else {
          const id = this.seesaws.length;
          this.seesaws.push({ a: [x, y], b: [-1, -1], down: this.seesaws.length % 2 === 0 ? 0 : 1, anim: 0 });
          this.set(x, y, { kind: 'seesaw', id, end: 0 });
        }
        return Cell.Floor;
      }
      case 'a':
      case 'b':
      case 'c':
      case 'd':
      case 'e':
        if (ch === 'b' && g === 'seas') {
          this.set(x, y, { kind: 'bridge' });
          return Cell.Floor;
        }
        this.set(x, y, { kind: 'sign', speed: ch.charCodeAt(0) - 96 });
        return Cell.Floor;
      case '!':
        this.set(x, y, { kind: 'sign', speed: 0 });
        return Cell.Floor;
      case 'O':
        this.set(x, y, { kind: 'tyre' });
        this.tyres.push({ tx: x, ty: y, timer: 0 });
        return Cell.Soft;
      case '=':
        this.set(x, y, { kind: 'rail', trolleyWarp: false });
        return Cell.Floor;
      case 's':
        this.set(x, y, { kind: 'switch' });
        return Cell.Floor;
      case 'P':
        this.set(x, y, { kind: 'cover', style: 'pipe' });
        return Cell.Floor;
      case 'H':
        this.set(x, y, { kind: 'cover', style: 'hut' });
        return Cell.Floor;
      case 'F':
        this.set(x, y, { kind: 'cover', style: 'foliage' });
        return Cell.Floor;
      case 'i':
        this.set(x, y, { kind: 'ice', cracks: 0 });
        return Cell.Floor;
      case '~':
        this.set(x, y, { kind: 'water' });
        return Cell.Void;
      case 'p':
        this.set(x, y, { kind: 'portal', to: [x, y] });
        return Cell.Hard;
      case 'J':
        this.set(x, y, { kind: 'bend', turn: this.arena.bends?.[`${x},${y}`] ?? {} });
        return Cell.Hard;
      case 'G':
        this.set(x, y, { kind: 'door', open: (x + y) % 4 === 0 ? 'h' : 'v', push: 0, turn: 0 });
        return Cell.Floor;
      case 'w':
        this.set(x, y, { kind: 'gap' });
        this.wrap = true;
        return Cell.Floor;
      default:
        return null;
    }
  }

  /** After the whole map is parsed. */
  finish(): void {
    for (const pair of this.arena.portalPairs ?? []) {
      const [a, b] = pair;
      this.set(a[0], a[1], { kind: 'portal', to: b });
      this.set(b[0], b[1], { kind: 'portal', to: a });
    }
    for (const [a, b] of this.arena.trampolinePairs ?? []) {
      this.set(a[0], a[1], { kind: 'trampoline', to: b });
      this.set(b[0], b[1], { kind: 'trampoline', to: a });
    }
    for (const [x, y] of this.arena.stations ?? []) this.stations.add(this.idx(x, y));
    const t = this.arena.trolley;
    if (t) this.trolleys.push({ x: tileCenter(t.x), y: tileCenter(t.y), dir: t.dir, speed: 1.2, stop: 0, riders: [], flash: 0 });
    if (this.arena.gimmick === 'robot') this.robot = { x: tileCenter(7), y: tileCenter(5), dir: 'left', stomp: 0, cooldown: 200, leaving: 0, gone: false };
    // Unpaired seesaw ends become plain floor.
    this.seesaws = this.seesaws.filter((s) => s.b[0] >= 0);
  }

  /** The tile itself if it is clear, else the closest clear floor tile around it. */
  landingNear(x: number, y: number): [number, number] | null {
    const w = this.w;
    const clear = (tx: number, ty: number): boolean =>
      w.grid.get(tx, ty) === Cell.Floor && !w.bombAt[this.idx(tx, ty)] && !w.bombers.some((o) => o.alive && o.airborne <= 0 && o.tx === tx && o.ty === ty);
    if (clear(x, y)) return [x, y];
    for (const d of ALL_DIRS) if (clear(x + DX[d], y + DY[d])) return [x + DX[d], y + DY[d]];
    return null;
  }

  /** Tiles that must never receive a random soft block. */
  blocksSoft(x: number, y: number): boolean {
    const f = this.at(x, y);
    return !!f && f.kind !== 'ice';
  }

  coverAt(x: number, y: number): 'pipe' | 'hut' | 'foliage' | null {
    const f = this.at(x, y);
    return f && f.kind === 'cover' ? f.style : null;
  }

  /** Bombs laid in huts or under leaves get maximum fire. */
  boosts(x: number, y: number): boolean {
    const c = this.coverAt(x, y);
    return c === 'hut' || c === 'foliage';
  }

  // ------------------------------------------------------------------ movement hooks

  /** Extra walkability rules: doors, the trolley and the robot. */
  canEnter(b: Bomber, tx: number, ty: number): boolean {
    const f = this.at(tx, ty);
    if (f && f.kind === 'door') {
      const dir = dirBetween(b.tx, b.ty, tx, ty);
      if (dir && (isHorizontal(dir) ? f.open !== 'h' : f.open !== 'v')) {
        f.push++;
        return false;
      }
    }
    for (const t of this.trolleys) {
      if (t.stop <= 0 && toTile(t.x) === tx && toTile(t.y) === ty && !t.riders.includes(b)) return false;
    }
    const r = this.robot;
    if (r && !r.gone && toTile(r.x) === tx && toTile(r.y) === ty) return false;
    return true;
  }

  /** Map out-of-bounds coordinates through the wrap-around gaps. */
  wrapTile(tx: number, ty: number): [number, number] {
    if (!this.wrap) return [tx, ty];
    const g = this.w.grid;
    return [((tx % g.w) + g.w) % g.w, ((ty % g.h) + g.h) % g.h];
  }

  wrapBody(b: { x: number; y: number }): void {
    if (!this.wrap) return;
    const W = this.w.grid.w * TILE;
    const H = this.w.grid.h * TILE;
    if (b.x < 0) b.x += W;
    if (b.x >= W) b.x -= W;
    if (b.y < 0) b.y += H;
    if (b.y >= H) b.y -= H;
  }

  /** Where a flame goes next: pipes teleport it, bends turn it, gaps wrap it. */
  flameNext(x: number, y: number, d: Dir): [number, number, Dir] | null {
    let nx = x + DX[d];
    let ny = y + DY[d];
    if (!this.w.grid.inside(nx, ny)) {
      if (!this.wrap || this.at(x, y)?.kind !== 'gap') return null;
      [nx, ny] = this.wrapTile(nx, ny);
    }
    const f = this.at(nx, ny);
    if (!f) return [nx, ny, d];
    if (f.kind === 'portal') {
      const [px, py] = f.to;
      return [px + DX[d], py + DY[d], d];
    }
    if (f.kind === 'bend') {
      const nd = f.turn[d];
      if (!nd) return null;
      return [nx + DX[nd], ny + DY[nd], nd];
    }
    if (f.kind === 'door') {
      if (isHorizontal(d) ? f.open !== 'h' : f.open !== 'v') return null;
    }
    return [nx, ny, d];
  }

  // ------------------------------------------------------------------ per tick

  update(): void {
    this.tick++;
    const w = this.w;
    for (const f of this.features) if (f && f.kind === 'cover' && f.open) f.open--;
    // Rotating arrows turn clockwise every three seconds.
    if (this.tick % 180 === 0) {
      for (const f of this.features) {
        if (f && f.kind === 'arrow' && f.rotating) f.dir = CLOCKWISE[f.dir];
      }
    }
    // Pushed flower doors turn a quarter.
    for (let i = 0; i < this.features.length; i++) {
      const f = this.features[i];
      if (f && f.kind === 'door') {
        if (f.turn > 0) f.turn--;
        if (f.push > 18) {
          f.open = f.open === 'h' ? 'v' : 'h';
          f.push = 0;
          f.turn = 12;
          w.emit({ type: 'warp', tx: i % w.grid.w, ty: Math.floor(i / w.grid.w) });
        } else if (f.push > 0 && this.tick % 30 === 0) {
          f.push = Math.max(0, f.push - 6);
        }
      }
    }
    for (const s of this.seesaws) if (s.anim > 0) s.anim--;
    this.updateConveyors();
    this.updateTrolleys();
    this.updateRobot();
    this.updateFish();
    this.updateTyres();
    for (const b of w.bombers) this.watchTile(b);
  }

  private beltDir(f: { dir: Dir }): Dir {
    return this.beltReverse ? OPPOSITE[f.dir] : f.dir;
  }

  /** The conveyor on a tile: where it carries bombers and how fast (px/frame). */
  beltAt(x: number, y: number): { dir: Dir; speed: number } | null {
    const f = this.at(x, y);
    if (!f || f.kind !== 'conveyor') return null;
    return { dir: this.beltDir(f), speed: BELT_SPEED * this.beltSpeed };
  }

  private updateConveyors(): void {
    const w = this.w;
    const speed = BELT_SPEED * this.beltSpeed;
    for (const b of w.bombers) {
      if (!b.alive || b.airborne > 0 || b.riding) continue;
      const f = this.at(b.tx, b.ty);
      if (!f || f.kind !== 'conveyor') continue;
      moveBody(b, this.beltDir(f), speed, (tx, ty) => w.bomberCanEnter(b, tx, ty));
      this.wrapBody(b);
    }
    for (const bomb of w.bombs) {
      if (bomb.flight || bomb.held || bomb.slide) continue;
      const f = this.at(bomb.tx, bomb.ty);
      if (!f || f.kind !== 'conveyor') continue;
      const d = this.beltDir(f);
      if (w.bombCanEnter(bomb.tx + DX[d], bomb.ty + DY[d], bomb) || Math.abs(bomb.x - tileCenter(bomb.tx)) + Math.abs(bomb.y - tileCenter(bomb.ty)) > 0.01) {
        w.startSlide(bomb, d, speed, true);
      }
    }
  }

  /** A kicked / conveyed bomb reached the centre of a tile: arrows and belts steer it. */
  steerBomb(bomb: Bomb): void {
    const f = this.at(bomb.tx, bomb.ty);
    if (!f) {
      if (bomb.conveyed) {
        bomb.slide = null;
        bomb.conveyed = false;
      }
      return;
    }
    if (f.kind === 'arrow') {
      bomb.slide = f.dir;
      return;
    }
    if (f.kind === 'conveyor') {
      if (bomb.conveyed) bomb.slide = this.beltDir(f);
      return;
    }
    if (bomb.conveyed) {
      bomb.slide = null;
      bomb.conveyed = false;
    }
    if (f.kind === 'warp' && this.warps.length > 1) {
      const [nx, ny] = this.warps[(f.index + 1) % this.warps.length];
      if (!w_bombAt(this.w, nx, ny)) this.w.moveBomb(bomb, nx, ny);
    }
  }

  /** Can a sliding bomb move from its tile in `d`? Handles pipes, bends and water. */
  slideThrough(bomb: Bomb, d: Dir): 'ok' | 'blocked' | 'moved' | 'sink' {
    const w = this.w;
    let nx = bomb.tx + DX[d];
    let ny = bomb.ty + DY[d];
    if (!w.grid.inside(nx, ny)) {
      if (!this.wrap) return 'blocked';
      [nx, ny] = this.wrapTile(nx, ny);
      if (w.bombCanEnter(nx, ny, bomb)) {
        w.moveBomb(bomb, nx, ny);
        return 'moved';
      }
      return 'blocked';
    }
    const f = this.at(nx, ny);
    if (f?.kind === 'portal') {
      const [px, py] = f.to;
      const ox = px + DX[d];
      const oy = py + DY[d];
      if (w.bombCanEnter(ox, oy, bomb)) {
        w.moveBomb(bomb, ox, oy);
        return 'moved';
      }
      return 'blocked';
    }
    if (f?.kind === 'bend') {
      const nd = f.turn[d];
      if (!nd) return 'blocked';
      const ox = nx + DX[nd];
      const oy = ny + DY[nd];
      if (w.bombCanEnter(ox, oy, bomb)) {
        w.moveBomb(bomb, ox, oy);
        bomb.slide = nd;
        return 'moved';
      }
      return 'blocked';
    }
    if (f?.kind === 'door' && (isHorizontal(d) ? f.open !== 'h' : f.open !== 'v')) return 'blocked';
    if (w.grid.get(nx, ny) === Cell.Void) return 'sink';
    return 'ok';
  }

  // ------------------------------------------------------------------ tile triggers

  /** Fire tile-entry and centre triggers (warps, trampolines, seesaws, signs, switches, ice). */
  private watchTile(b: Bomber): void {
    if (!b.alive || b.airborne > 0) return;
    const i = this.idx(b.tx, b.ty);
    const prev = this.lastTile.get(b.id);
    const w = this.w;
    if (prev !== undefined && prev !== i) {
      // Left a tile.
      const pf = this.features[prev];
      if (pf && pf.kind === 'ice') {
        pf.cracks++;
        if (pf.cracks >= 2) this.breakIce(prev);
      }
      const lock = this.lock.get(b.id);
      if (lock === prev) this.lock.delete(b.id);
      this.onEnter(b, b.tx, b.ty);
    }
    this.lastTile.set(b.id, i);
    // Centre triggers
    const f = this.features[i];
    if (!f || this.lock.get(b.id) === i) return;
    const centred = Math.abs(b.x - tileCenter(b.tx)) < 3 && Math.abs(b.y - tileCenter(b.ty)) < 3;
    if (!centred) return;
    if (f.kind === 'warp' && this.warps.length > 1) {
      for (let k = 1; k < this.warps.length; k++) {
        const [nx, ny] = this.warps[(f.index + k) % this.warps.length];
        if (!w_bombAt(w, nx, ny) && !w.bombers.some((o) => o !== b && o.alive && o.tx === nx && o.ty === ny)) {
          b.x = tileCenter(nx);
          b.y = tileCenter(ny);
          this.lock.set(b.id, this.idx(nx, ny));
          this.lastTile.set(b.id, this.idx(nx, ny));
          w.emit({ type: 'warp', tx: nx, ty: ny });
          break;
        }
      }
    } else if (f.kind === 'trampoline') {
      // Paired trampolines lead to the other floor; lone ones throw you somewhere.
      const target = f.to ? this.landingNear(f.to[0], f.to[1]) : this.randomLanding(b.tx, b.ty, 4);
      if (target) {
        this.lock.set(b.id, f.to ? this.idx(target[0], target[1]) : i);
        w.jump(b, target[0], target[1], 70, 64);
        w.emit({ type: 'jump', tx: b.tx, ty: b.ty });
      }
    }
  }

  private onEnter(b: Bomber, tx: number, ty: number): void {
    const f = this.at(tx, ty);
    if (!f) return;
    const w = this.w;
    switch (f.kind) {
      case 'sign':
        if (f.speed === 0) {
          b.stunned = Math.max(b.stunned, 120);
          w.emit({ type: 'stun', who: b.id });
        } else {
          b.speedOverride = SIGN_SPEEDS[f.speed - 1];
          w.emit({ type: 'warp', tx, ty });
        }
        break;
      case 'switch':
        this.toggleSwitch();
        break;
      case 'seesaw':
        this.stepSeesaw(f.id, f.end);
        break;
      default:
        break;
    }
  }

  private toggleSwitch(): void {
    const w = this.w;
    this.switchOn = !this.switchOn;
    const g = this.arena.gimmick;
    if (g === 'switchbelt') this.beltReverse = this.switchOn;
    if (g === 'fastlane') {
      this.beltReverse = this.switchOn;
      this.beltSpeed = this.switchOn ? 2.2 : 1;
    }
    w.emit({ type: 'warp', tx: 0, ty: 0 });
  }

  private stepSeesaw(id: number, end: 0 | 1): void {
    const linked = this.arena.gimmick === 'seesawLinked';
    const list = linked ? this.seesaws : [this.seesaws[id]];
    const s0 = this.seesaws[id];
    if (!s0 || s0.down === end) return;
    for (const s of list) {
      // The end that was down rises and flings whatever stands on it.
      const upEnd = s.down === 0 ? s.a : s.b;
      s.down = s.down === 0 ? 1 : 0;
      s.anim = 12;
      this.fling(upEnd[0], upEnd[1]);
    }
    this.w.emit({ type: 'jump', tx: s0.a[0], ty: s0.a[1] });
  }

  private fling(tx: number, ty: number): void {
    const w = this.w;
    for (const b of w.bombers) {
      if (!b.alive || b.airborne > 0 || b.tx !== tx || b.ty !== ty) continue;
      const target = this.randomLanding(tx, ty, 3);
      if (target) w.jump(b, target[0], target[1], 60, 56);
    }
    const bomb = w.bombAtTile(tx, ty);
    if (bomb && !bomb.flight && !bomb.held) {
      const target = this.randomLanding(tx, ty, 3);
      if (target) w.throwTo(bomb, target[0], target[1]);
    }
  }

  /** A random empty floor tile at least `minDist` away. */
  randomLanding(fromX: number, fromY: number, minDist: number): [number, number] | null {
    const w = this.w;
    const cands: [number, number][] = [];
    for (let y = 1; y < w.grid.h - 1; y++) {
      for (let x = 1; x < w.grid.w - 1; x++) {
        if (w.grid.get(x, y) !== Cell.Floor || w.bombAtTile(x, y)) continue;
        const f = this.at(x, y);
        if (f && (f.kind === 'trampoline' || f.kind === 'warp' || f.kind === 'seesaw' || f.kind === 'rail' || f.kind === 'door')) continue;
        if (Math.abs(x - fromX) + Math.abs(y - fromY) < minDist) continue;
        cands.push([x, y]);
      }
    }
    return cands.length ? w.rng.pick(cands) : null;
  }

  private breakIce(i: number): void {
    const w = this.w;
    const x = i % w.grid.w;
    const y = Math.floor(i / w.grid.w);
    if (w.bombers.some((b) => b.alive && b.tx === x && b.ty === y) || w.bombAtTile(x, y)) {
      const f = this.features[i];
      if (f && f.kind === 'ice') f.cracks = 1; // try again when it is free
      return;
    }
    this.features[i] = { kind: 'hole' };
    w.grid.set(x, y, Cell.Void);
    w.items[i] = null;
    w.emit({ type: 'block', tx: x, ty: y });
  }

  /** A blast went off inside a hut: the roof is blown off for a while. */
  onBlastAt(tx: number, ty: number): void {
    const f = this.at(tx, ty);
    if (f && f.kind === 'cover' && f.style === 'hut') f.open = HUT_OPEN_TICKS;
  }

  // ------------------------------------------------------------------ trolleys

  private railAt(x: number, y: number): boolean {
    const f = this.at(x, y);
    return !!f && f.kind === 'rail';
  }

  private updateTrolleys(): void {
    const w = this.w;
    // Switcheroo: the rail junctions rearrange every few seconds.
    if (this.arena.gimmick === 'switcheroo' && this.tick % 300 === 0) this.switchOn = w.rng.chance(0.5);
    for (const t of this.trolleys) {
      if (t.flash > 0) t.flash--;
      if (t.stop > 0) {
        t.stop--;
        if (t.stop === 0) {
          // Whoever stands on the trolley rides along.
          t.riders = w.bombers.filter((b) => b.alive && b.tx === toTile(t.x) && b.ty === toTile(t.y));
          for (const r of t.riders) r.riding = true;
        }
        continue;
      }
      let budget = t.speed;
      while (budget > 1e-6) {
        const cx = tileCenter(toTile(t.x));
        const cy = tileCenter(toTile(t.y));
        const along = isHorizontal(t.dir) ? t.x : t.y;
        const sign = isHorizontal(t.dir) ? DX[t.dir] : DY[t.dir];
        const center = isHorizontal(t.dir) ? cx : cy;
        let next = center;
        if ((center - along) * sign <= 1e-9) next = center + sign * TILE;
        const dist = Math.abs(next - along);
        const step = Math.min(budget, dist);
        if (isHorizontal(t.dir)) t.x += sign * step;
        else t.y += sign * step;
        budget -= step;
        if (Math.abs(step - dist) < 1e-6) {
          if (isHorizontal(t.dir)) t.x = next;
          else t.y = next;
          this.trolleyAtCenter(t);
          if (t.stop > 0) break;
        }
      }
      for (const r of t.riders) {
        r.x = t.x;
        r.y = t.y;
      }
      this.trolleyCrush(t);
    }
  }

  private trolleyAtCenter(t: Trolley): void {
    const w = this.w;
    let tx = toTile(t.x);
    let ty = toTile(t.y);
    const f = this.at(tx, ty);
    if (f && f.kind === 'rail' && f.trolleyWarp && t.flash === 0) {
      // Destination Unknown: jump to the other warp on the rails.
      for (let i = 0; i < this.features.length; i++) {
        const g = this.features[i];
        if (g && g.kind === 'rail' && g.trolleyWarp && i !== this.idx(tx, ty)) {
          tx = i % w.grid.w;
          ty = Math.floor(i / w.grid.w);
          t.x = tileCenter(tx);
          t.y = tileCenter(ty);
          t.flash = 20;
          for (const r of t.riders) {
            r.x = t.x;
            r.y = t.y;
          }
          w.emit({ type: 'warp', tx, ty });
          break;
        }
      }
    }
    if (this.stations.has(this.idx(tx, ty))) {
      t.stop = 100;
      for (const r of t.riders) r.riding = false;
      t.riders = [];
    }
    // Choose the next rail.
    const options = ALL_DIRS.filter((d) => d !== OPPOSITE[t.dir] && this.railAt(tx + DX[d], ty + DY[d]));
    if (!options.length) {
      t.dir = OPPOSITE[t.dir];
      return;
    }
    if (options.length === 1) {
      t.dir = options[0];
      return;
    }
    // Junction: the switch decides between going straight and turning.
    const straight = options.includes(t.dir);
    const turns = options.filter((d) => d !== t.dir);
    t.dir = this.switchOn || !straight ? turns[this.tick % turns.length] : t.dir;
  }

  private trolleyCrush(t: Trolley): void {
    const w = this.w;
    const tx = toTile(t.x);
    const ty = toTile(t.y);
    for (const b of w.bombers) {
      if (!b.alive || b.airborne > 0 || t.riders.includes(b)) continue;
      if (Math.abs(b.x - t.x) < 11 && Math.abs(b.y - t.y) < 11) w.kill(b, null, true);
    }
    const bomb = w.bombAtTile(tx, ty);
    if (bomb && !bomb.flight) w.crushBomb(bomb);
    if (w.grid.get(tx, ty) === Cell.Soft) w.grid.set(tx, ty, Cell.Floor);
  }

  // ------------------------------------------------------------------ robot

  private updateRobot(): void {
    const r = this.robot;
    const w = this.w;
    if (!r || r.gone) return;
    if (w.timeLeft > 0 && w.timeLeft <= 60 * 60 && r.leaving === 0) r.leaving = 1;
    if (r.leaving > 0) {
      r.leaving++;
      if (r.leaving > 90) r.gone = true;
      return;
    }
    if (r.stomp > 0) {
      r.stomp--;
      if (r.stomp === 20) {
        // Impact: everyone close by is stunned and loses items.
        for (const b of w.bombers) {
          if (!b.alive || b.airborne > 0) continue;
          if (Math.abs(b.tx - toTile(r.x)) + Math.abs(b.ty - toTile(r.y)) <= 2) {
            b.stunned = Math.max(b.stunned, 90);
            w.scatterItems(b, 2);
            w.emit({ type: 'stun', who: b.id });
          }
        }
        w.emit({ type: 'pressure', tx: toTile(r.x), ty: toTile(r.y) });
        w.emit({ type: 'shake', frames: 12 });
      }
      return;
    }
    r.cooldown--;
    if (r.cooldown <= 0) {
      r.stomp = 50;
      r.cooldown = 150 + w.rng.int(120);
      return;
    }
    // Lumber along the corridors.
    const speed = 0.5;
    const atC = r.x === tileCenter(toTile(r.x)) && r.y === tileCenter(toTile(r.y));
    const walk = (tx: number, ty: number): boolean => {
      if (w.grid.get(tx, ty) !== Cell.Floor) return false;
      if (w.bombAtTile(tx, ty)) return false;
      return true;
    };
    if (atC) {
      const tx = toTile(r.x);
      const ty = toTile(r.y);
      const open = ALL_DIRS.filter((d) => walk(tx + DX[d], ty + DY[d]));
      if (!open.length) return;
      if (!open.includes(r.dir) || w.rng.chance(0.25)) {
        const turns = open.filter((d) => d !== OPPOSITE[r.dir]);
        r.dir = w.rng.pick(turns.length ? turns : open);
      }
    }
    r.x += DX[r.dir] * speed;
    r.y += DY[r.dir] * speed;
  }

  // ------------------------------------------------------------------ fish

  private updateFish(): void {
    const w = this.w;
    if (this.arena.gimmick !== 'seas') return;
    for (const f of this.fish) f.t++;
    this.fish = this.fish.filter((f) => f.t < 50);
    if (this.tick % 140 === 0) {
      const spots: [number, number][] = [];
      for (let y = 1; y < w.grid.h - 1; y++) {
        for (let x = 1; x < w.grid.w - 1; x++) {
          if (w.grid.get(x, y) !== Cell.Void) continue;
          if (ALL_DIRS.some((d) => w.grid.get(x + DX[d], y + DY[d]) === Cell.Floor)) spots.push([x, y]);
        }
      }
      if (spots.length) {
        const [tx, ty] = w.rng.pick(spots);
        this.fish.push({ tx, ty, t: 0 });
      }
    }
    for (const f of this.fish) {
      if (f.t !== 25) continue;
      for (const b of w.bombers) {
        if (!b.alive || b.airborne > 0) continue;
        if (Math.abs(b.tx - f.tx) + Math.abs(b.ty - f.ty) === 1) {
          w.scatterItems(b, 1);
          b.stunned = Math.max(b.stunned, 40);
          w.emit({ type: 'stun', who: b.id });
        }
      }
    }
  }

  // ------------------------------------------------------------------ tyre

  private updateTyres(): void {
    const w = this.w;
    for (const t of this.tyres) {
      if (w.grid.get(t.tx, t.ty) === Cell.Soft) continue;
      t.timer++;
      if (t.timer < TYRE_RESPAWN) continue;
      const busy = w.bombAtTile(t.tx, t.ty) || w.bombers.some((b) => b.alive && b.tx === t.tx && b.ty === t.ty) || w.itemAt(t.tx, t.ty);
      if (busy) continue;
      t.timer = 0;
      w.grid.set(t.tx, t.ty, Cell.Soft);
      w.setItem(t.tx, t.ty, w.randomPoolItem(), true);
    }
  }
}

const CLOCKWISE: Record<Dir, Dir> = { up: 'right', right: 'down', down: 'left', left: 'up' };

function dirBetween(ax: number, ay: number, bx: number, by: number): Dir | null {
  if (bx > ax) return 'right';
  if (bx < ax) return 'left';
  if (by > ay) return 'down';
  if (by < ay) return 'up';
  return null;
}

function w_bombAt(w: BattleWorld, x: number, y: number): Bomb | null {
  return w.bombAtTile(x, y);
}
