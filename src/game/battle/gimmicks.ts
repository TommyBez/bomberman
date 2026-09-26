import type { Bomber } from '../core/bomber';
import { moveBody } from '../core/movement';
import { ALL_DIRS, Cell, DX, DY, OPPOSITE, TILE, isHorizontal, tileCenter, toTile, type Dir } from '../core/types';
import type { Bomb } from '../core/world';
import { RAIL_ORIGIN, type ArenaDef } from './arenas';
import type { BattleWorld } from './battleWorld';

export type Feature =
  /** `rev`: where the belt runs when reversed (back toward the tile that feeds it, round corners too). */
  | { kind: 'conveyor'; dir: Dir; rev: Dir }
  | { kind: 'arrow'; dir: Dir; rotating: boolean }
  | { kind: 'warp'; index: number }
  | { kind: 'trampoline'; to?: [number, number] }
  /** A seesaw's ends (0, 1) and, on three-tile seesaws, its pivot (2). */
  | { kind: 'seesaw'; id: number; end: 0 | 1 | 2 }
  | { kind: 'sign'; speed: number }
  | { kind: 'tyre' }
  | { kind: 'rail'; trolleyWarp: boolean }
  | { kind: 'switch'; mode: 'points' | 'reverse' | 'speed' }
  | { kind: 'cover'; style: 'pipe' | 'hut' | 'foliage'; open?: number }
  | { kind: 'bridge' }
  | { kind: 'ice'; cracks: number }
  | { kind: 'hole' }
  | { kind: 'water' }
  | { kind: 'portal'; to: [number, number] }
  | { kind: 'bend'; turn: Partial<Record<Dir, Dir>> }
  /** Round and Round: turns a quarter when pushed; a blast into its mouth leaves its partner's. */
  | { kind: 'flower'; to: [number, number]; face: Dir; push: number; turn: number }
  | { kind: 'gap' }
  /** A hard block drawn as a piece of scenery (palm, bush, tree trunk, gold boulder). */
  | { kind: 'prop'; style: PropStyle };

export type PropStyle = 'palm' | 'bush' | 'trunk' | 'gold';

/** Which prop 'Y' stands for on each stage. */
const PROPS: Partial<Record<string, PropStyle>> = { warp: 'palm', flowers: 'bush', jungle: 'trunk', incoming: 'gold' };

export interface Seesaw {
  a: [number, number];
  b: [number, number];
  /** The middle tile of a three-tile seesaw. */
  pivot?: [number, number];
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

/** One of the robot's four feet: where it stands, or where it is stepping to. */
export interface RobotFoot {
  tx: number;
  ty: number;
  /** While the foot is in the air: the tile it lands on, and ticks until it does. */
  to: [number, number] | null;
  lift: number;
}

/**
 * Robo Bomber's giant: a body high above the arena on four long legs. It walks two tiles
 * at a time, one foot after another; whoever a foot comes down on is stunned and drops
 * items. With a minute left it leaves.
 */
export interface Robot {
  /** Body centre (px), over the tile it walks over. */
  x: number;
  y: number;
  /** The body's tile at the start of this walk and where it is walking to. */
  from: [number, number];
  goal: [number, number];
  feet: RobotFoot[];
  /** Feet that have stepped on this walk (0–4); resting while `rest` counts down. */
  stepped: number;
  rest: number;
  leaving: number;
  gone: boolean;
}

/** Where each foot stands relative to the body's tile: the four diagonals, two tiles out. */
export const ROBOT_FEET: [number, number][] = [[-2, -2], [2, 2], [2, -2], [-2, 2]];
/** Ticks a foot is in the air for one step. */
export const ROBOT_STEP = 26;

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
/** Belt speed multiplier with a speed switch on (The Fast Lane). */
const FAST_BELT = 2.2;
/** Ticks of pushing that turn a flower. */
const FLOWER_PUSH = 18;
/** How long the trolley waits at a station. */
const STATION_STOP = 100;
/** How far ahead (ticks) the CPU players look at the trolley's route. */
const TROLLEY_HORIZON = 150;
/** The rails change at random every 8 to 16 seconds. */
const RAIL_CHANGE_TICKS = 8 * 60;
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
  /** Switcheroo / Destination Unknown: the rail layouts (tile lists) and the current one. */
  private railLayouts: [number, number, boolean][][] = [];
  railLayout = 0;
  /** Frames left of the blink after the rails were relaid. */
  railFlash = 0;
  private railChangeAt = 0;
  private railPending = false;
  private forecast: Map<number, number> | null = null;
  private forecastTick = -1;
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
      case 'v': {
        const dir: Dir = ch === '>' ? 'right' : ch === '<' ? 'left' : ch === '^' ? 'up' : 'down';
        this.set(x, y, { kind: 'conveyor', dir, rev: OPPOSITE[dir] });
        return Cell.Floor;
      }
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
        if (g === 'mystery' && this.arena.railLayouts) return Cell.Floor; // laid by the rail layouts
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
        // Two ends side by side ("SS"), or three tiles round a pivot ("S_S").
        const open = (f: Feature | null): f is Extract<Feature, { kind: 'seesaw' }> => !!f && f.kind === 'seesaw' && f.end === 0 && this.seesaws[f.id].b[0] === -1;
        const left = this.at(x - 1, y);
        const left2 = this.at(x - 2, y);
        if (open(left)) {
          const s = this.seesaws[left.id];
          s.b = [x, y];
          this.set(x, y, { kind: 'seesaw', id: left.id, end: 1 });
        } else if (!left && open(left2) && '_.'.includes(this.arena.map[y][x - 1])) {
          const s = this.seesaws[left2.id];
          s.b = [x, y];
          s.pivot = [x - 1, y];
          this.set(x - 1, y, { kind: 'seesaw', id: left2.id, end: 2 });
          this.set(x, y, { kind: 'seesaw', id: left2.id, end: 1 });
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
        this.set(x, y, { kind: 'switch', mode: g === 'train' ? 'points' : 'reverse' });
        return Cell.Floor;
      case 'k':
        this.set(x, y, { kind: 'switch', mode: 'speed' });
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
        if (g === 'flowers') this.set(x, y, { kind: 'flower', to: [x, y], face: this.arena.flowerFaces?.[`${x},${y}`] ?? 'up', push: 0, turn: 0 });
        else this.set(x, y, { kind: 'portal', to: [x, y] });
        return Cell.Hard;
      case 'J':
        this.set(x, y, { kind: 'bend', turn: this.arena.bends?.[`${x},${y}`] ?? {} });
        return Cell.Hard;
      case 'B':
        // A bridge that starts under a soft block.
        this.set(x, y, { kind: 'bridge' });
        return Cell.Soft;
      case 'Y':
        this.set(x, y, { kind: 'prop', style: PROPS[g ?? ''] ?? 'palm' });
        return Cell.Hard;
      case 'w':
        this.set(x, y, { kind: 'gap' });
        return Cell.Floor;
      default:
        return null;
    }
  }

  /** After the whole map is parsed. */
  finish(): void {
    const g = this.w.grid;
    // Floor in the border wall (a gap, or a belt running through it) wraps round.
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        if ((x === 0 || y === 0 || x === g.w - 1 || y === g.h - 1) && g.get(x, y) !== Cell.Hard) this.wrap = true;
      }
    }
    // Reversed belts run back toward the tile that feeds them, so they turn the corners too.
    for (let i = 0; i < this.features.length; i++) {
      const f = this.features[i];
      if (!f || f.kind !== 'conveyor') continue;
      const x = i % g.w;
      const y = Math.floor(i / g.w);
      const feeds = ALL_DIRS.filter((d) => {
        const n = this.step(x, y, d);
        const nf = n && this.at(n[0], n[1]);
        return !!nf && nf.kind === 'conveyor' && nf.dir === OPPOSITE[d];
      });
      f.rev = feeds.includes(OPPOSITE[f.dir]) || !feeds.length ? OPPOSITE[f.dir] : feeds[0];
    }
    for (const pair of this.arena.portalPairs ?? []) {
      const [a, b] = pair;
      for (const [from, to] of [[a, b], [b, a]]) {
        const f = this.at(from[0], from[1]);
        if (f && f.kind === 'flower') f.to = to;
        else this.set(from[0], from[1], { kind: 'portal', to });
      }
    }
    if (this.arena.railLayouts) {
      const layouts = this.arena.alternate ? [...this.arena.railLayouts, ...(this.arena.altRailLayouts ?? [])] : this.arena.railLayouts;
      this.railLayouts = layouts.map((rows) => {
        const tiles: [number, number, boolean][] = [];
        rows.forEach((row, dy) => [...row].forEach((ch, dx) => (ch === '=' || ch === 'W') && tiles.push([RAIL_ORIGIN + dx, RAIL_ORIGIN + dy, ch === 'W'])));
        return tiles;
      });
      this.layRails(0);
      this.railChangeAt = RAIL_CHANGE_TICKS;
    }
    for (const [a, b] of this.arena.trampolinePairs ?? []) {
      this.set(a[0], a[1], { kind: 'trampoline', to: b });
      this.set(b[0], b[1], { kind: 'trampoline', to: a });
    }
    for (const [x, y] of this.arena.stations ?? []) this.stations.add(this.idx(x, y));
    const t = this.arena.trolley;
    if (t) this.trolleys.push({ x: tileCenter(t.x), y: tileCenter(t.y), dir: t.dir, speed: 1.2, stop: 0, riders: [], flash: 0 });
    if (this.arena.gimmick === 'robot') {
      const feet = ROBOT_FEET.map(([dx, dy]) => ({ tx: 7 + dx, ty: 5 + dy, to: null, lift: 0 }));
      this.robot = { x: tileCenter(7), y: tileCenter(5), from: [7, 5], goal: [7, 5], feet, stepped: 4, rest: 150, leaving: 0, gone: false };
    }
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

  /**
   * Tiles that must never receive a random soft block. Blocks do lie on belts, rails,
   * bridges and thin ice (the trolley smashes the ones on its rails).
   */
  blocksSoft(x: number, y: number): boolean {
    const f = this.at(x, y);
    if (!f) return false;
    if (f.kind === 'rail') return f.trolleyWarp;
    return f.kind !== 'ice' && f.kind !== 'conveyor' && f.kind !== 'bridge';
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

  /** Extra walkability rules: nobody walks into a moving trolley. */
  canEnter(b: Bomber, tx: number, ty: number): boolean {
    for (const t of this.trolleys) {
      if (t.stop <= 0 && toTile(t.x) === tx && toTile(t.y) === ty && !t.riders.includes(b)) return false;
    }
    return true;
  }

  /** Map out-of-bounds coordinates through the wrap-around gaps. */
  wrapTile(tx: number, ty: number): [number, number] {
    if (!this.wrap) return [tx, ty];
    const g = this.w.grid;
    return [((tx % g.w) + g.w) % g.w, ((ty % g.h) + g.h) % g.h];
  }

  /** A walkable tile in the border wall: whatever leaves the arena through it comes back on the far side. */
  gapAt(x: number, y: number): boolean {
    if (!this.wrap) return false;
    const g = this.w.grid;
    return g.inside(x, y) && (x === 0 || y === 0 || x === g.w - 1 || y === g.h - 1) && g.get(x, y) !== Cell.Hard;
  }

  /** The tile one step from (x, y) toward `d`, through the border gaps; null off the edge. */
  step(x: number, y: number, d: Dir): [number, number] | null {
    const nx = x + DX[d];
    const ny = y + DY[d];
    if (this.w.grid.inside(nx, ny)) return [nx, ny];
    return this.gapAt(x, y) ? this.wrapTile(nx, ny) : null;
  }

  /**
   * Through a run of bent pipe tiles that starts at (x, y) heading `d`: each tile turns (or
   * keeps) the direction. The tile beyond the last one and the direction out, or null if
   * the pipe is closed that way.
   */
  throughBends(x: number, y: number, d: Dir): [number, number, Dir] | null {
    let cx = x;
    let cy = y;
    let cd = d;
    for (let k = 0; k < 16; k++) {
      const f = this.at(cx, cy);
      if (!f || f.kind !== 'bend') return [cx, cy, cd];
      const nd = f.turn[cd];
      if (!nd) return null;
      cd = nd;
      cx += DX[cd];
      cy += DY[cd];
    }
    return null;
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

  /** Where a flame goes next: pipes and flowers teleport it, bends turn it, gaps wrap it. */
  flameNext(x: number, y: number, d: Dir): [number, number, Dir] | null {
    const n = this.step(x, y, d);
    if (!n) return null;
    const [nx, ny] = n;
    const f = this.at(nx, ny);
    if (!f) return [nx, ny, d];
    if (f.kind === 'portal') {
      const [px, py] = f.to;
      return [px + DX[d], py + DY[d], d];
    }
    if (f.kind === 'bend') return this.throughBends(nx, ny, d);
    if (f.kind === 'flower') {
      // In through the mouth, out of the partner's mouth.
      const to = this.at(f.to[0], f.to[1]);
      if (f.face !== OPPOSITE[d] || !to || to.kind !== 'flower') return null;
      return [f.to[0] + DX[to.face], f.to[1] + DY[to.face], to.face];
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
    // A flower pushed for a moment turns a quarter, clockwise.
    for (let i = 0; i < this.features.length; i++) {
      const f = this.features[i];
      if (f && f.kind === 'flower') {
        if (f.turn > 0) f.turn--;
        if (f.push > FLOWER_PUSH) {
          f.face = CLOCKWISE[f.face];
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

  /** Which way a belt runs now (switches may have reversed it). */
  beltDir(f: { dir: Dir; rev: Dir }): Dir {
    return this.beltReverse ? f.rev : f.dir;
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
      const n = this.step(bomb.tx, bomb.ty, d);
      if ((n && w.bombCanEnter(n[0], n[1], bomb)) || Math.abs(bomb.x - tileCenter(bomb.tx)) + Math.abs(bomb.y - tileCenter(bomb.ty)) > 0.01) {
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
      const out = this.throughBends(nx, ny, d);
      if (!out) return 'blocked';
      const [ox, oy, nd] = out;
      if (w.bombCanEnter(ox, oy, bomb)) {
        w.moveBomb(bomb, ox, oy);
        bomb.slide = nd;
        return 'moved';
      }
      return 'blocked';
    }
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
        this.toggleSwitch(f.mode);
        break;
      case 'seesaw':
        if (f.end !== 2) this.stepSeesaw(f.id, f.end);
        break;
      default:
        break;
    }
  }

  /** Points switch (trolley junctions), belt reverse switch, or belt speed switch. */
  private toggleSwitch(mode: 'points' | 'reverse' | 'speed'): void {
    if (mode === 'points') this.switchOn = !this.switchOn;
    else if (mode === 'reverse') this.beltReverse = !this.beltReverse;
    else this.beltSpeed = this.beltSpeed > 1 ? 1 : FAST_BELT;
    this.w.emit({ type: 'warp', tx: 0, ty: 0 });
  }

  /** Is this switch on (drawn pressed)? */
  switchState(mode: 'points' | 'reverse' | 'speed'): boolean {
    return mode === 'points' ? this.switchOn : mode === 'reverse' ? this.beltReverse : this.beltSpeed > 1;
  }

  /** A bomber pushes against the tile ahead: flowers turn after a moment of pushing. */
  push(tx: number, ty: number): void {
    const f = this.at(tx, ty);
    if (f && f.kind === 'flower') f.push++;
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
        if (f && (f.kind === 'trampoline' || f.kind === 'warp' || f.kind === 'seesaw' || f.kind === 'rail')) continue;
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

  /** The trolley's warp holes on the current rails. */
  warpHoles(): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 0; i < this.features.length; i++) {
      const f = this.features[i];
      if (f && f.kind === 'rail' && f.trolleyWarp) out.push([i % this.w.grid.w, Math.floor(i / this.w.grid.w)]);
    }
    return out;
  }

  private railAt(x: number, y: number): boolean {
    const f = this.at(x, y);
    return !!f && f.kind === 'rail';
  }

  /** Lay rail layout `n`, lifting the rails of the current one. Blocks that fell stay put. */
  private layRails(n: number): void {
    const g = this.w.grid;
    for (const [x, y] of this.railLayouts[this.railLayout] ?? []) if (this.at(x, y)?.kind === 'rail') this.set(x, y, null);
    for (const [x, y, warp] of this.railLayouts[n]) {
      const c = g.get(x, y);
      if (c === Cell.Floor || c === Cell.Soft) this.set(x, y, { kind: 'rail', trolleyWarp: warp });
    }
    this.railLayout = n;
  }

  /** The trolley reached a tile centre while a relay is due: switch to a layout that keeps it on the rails. */
  private relayRails(tx: number, ty: number): void {
    const w = this.w;
    const options = this.railLayouts.map((_, n) => n).filter((n) => n !== this.railLayout && this.railLayouts[n].some(([x, y]) => x === tx && y === ty));
    if (!options.length) return;
    this.layRails(w.rng.pick(options));
    this.railPending = false;
    this.railFlash = 40;
    this.railChangeAt = this.tick + RAIL_CHANGE_TICKS + w.rng.int(RAIL_CHANGE_TICKS);
    w.emit({ type: 'warp', tx, ty });
  }

  private updateTrolleys(): void {
    const w = this.w;
    // Switcheroo: the rail junctions rearrange every few seconds.
    if (this.arena.gimmick === 'switcheroo' && this.tick % 300 === 0) this.switchOn = w.rng.chance(0.5);
    // Karakuri trolleys: now and then the whole rail layout changes.
    if (this.railFlash > 0) this.railFlash--;
    if (this.railLayouts.length > 1 && this.tick >= this.railChangeAt) this.railPending = true;
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

  /**
   * Where the trolleys will run over the next `horizon` ticks: tile index → ticks until the
   * trolley reaches it. Follows the rails as the trolley does: both ways at junctions, the
   * wait at stations, turning back at dead ends and jumping between warp holes.
   */
  trolleyForecast(horizon = TROLLEY_HORIZON): Map<number, number> {
    if (this.forecast && this.forecastTick === this.tick) return this.forecast;
    const out = new Map<number, number>();
    const mark = (x: number, y: number, time: number): void => {
      const i = this.idx(x, y);
      if (time <= horizon && (out.get(i) ?? Infinity) > time) out.set(i, Math.max(0, time));
    };
    for (const t of this.trolleys) {
      const tx = toTile(t.x);
      const ty = toTile(t.y);
      const perTile = TILE / t.speed;
      const half = perTile / 2;
      mark(tx, ty, 0);
      // How far the centre of the current tile still lies ahead (negative: already passed).
      const ahead = isHorizontal(t.dir) ? (tileCenter(tx) - t.x) * DX[t.dir] : (tileCenter(ty) - t.y) * DY[t.dir];
      const wait = Math.max(0, t.stop);
      const queue: [number, number, Dir, number][] =
        ahead > 1e-6 ? [[tx, ty, t.dir, wait + ahead / t.speed]] : [[tx + DX[t.dir], ty + DY[t.dir], t.dir, wait + (TILE + ahead) / t.speed]];
      const best = new Map<string, number>();
      while (queue.length) {
        const [x, y, d, time] = queue.shift()!;
        if (time - half > horizon) continue;
        const key = `${x},${y},${d}`;
        if ((best.get(key) ?? Infinity) <= time) continue;
        best.set(key, time);
        mark(x, y, time - half);
        const f = this.at(x, y);
        // A warp hole sends the trolley to any of the others: follow them all.
        const exits: [number, number][] = [[x, y]];
        if (f && f.kind === 'rail' && f.trolleyWarp) {
          const others = this.warpHoles().filter(([hx, hy]) => hx !== x || hy !== y);
          if (others.length) exits.splice(0, 1, ...others);
        }
        for (const [cx, cy] of exits) {
          let now = time;
          mark(cx, cy, now - half);
          if (this.stations.has(this.idx(cx, cy))) now += STATION_STOP;
          const options = ALL_DIRS.filter((nd) => nd !== OPPOSITE[d] && this.railAt(cx + DX[nd], cy + DY[nd]));
          for (const nd of options.length ? options : [OPPOSITE[d]]) queue.push([cx + DX[nd], cy + DY[nd], nd, now + perTile]);
        }
      }
    }
    this.forecast = out;
    this.forecastTick = this.tick;
    return out;
  }

  private trolleyAtCenter(t: Trolley): void {
    const w = this.w;
    let tx = toTile(t.x);
    let ty = toTile(t.y);
    if (this.railPending) this.relayRails(tx, ty);
    const f = this.at(tx, ty);
    if (f && f.kind === 'rail' && f.trolleyWarp && t.flash === 0) {
      // Destination Unknown: the trolley drops into a warp hole and comes out of another.
      const others = this.warpHoles().filter(([hx, hy]) => hx !== tx || hy !== ty);
      if (others.length) {
        [tx, ty] = w.rng.pick(others);
        t.x = tileCenter(tx);
        t.y = tileCenter(ty);
        t.flash = 20;
        for (const r of t.riders) {
          r.x = t.x;
          r.y = t.y;
        }
        w.emit({ type: 'warp', tx, ty });
      }
    }
    if (this.stations.has(this.idx(tx, ty))) {
      t.stop = STATION_STOP;
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
    if (w.grid.get(tx, ty) === Cell.Soft) {
      // The trolley smashes soft blocks on its rails; whatever they hid shows up.
      w.grid.set(tx, ty, Cell.Floor);
      const item = w.items[this.idx(tx, ty)];
      if (item) item.hidden = false;
    }
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
    if (r.stepped >= 4) {
      if (--r.rest > 0) return;
      const prev = r.from;
      r.from = r.goal;
      r.goal = this.robotGoal(r.from, prev);
      r.stepped = 0;
    }
    // One foot at a time: lift it, carry it to its place round the new goal, stamp it down.
    const k = r.stepped;
    const foot = r.feet[k];
    if (!foot.to) {
      foot.to = [r.goal[0] + ROBOT_FEET[k][0], r.goal[1] + ROBOT_FEET[k][1]];
      foot.lift = ROBOT_STEP;
    }
    if (--foot.lift <= 0) {
      [foot.tx, foot.ty] = foot.to;
      foot.to = null;
      foot.lift = 0;
      this.robotStomp(foot.tx, foot.ty);
      r.stepped++;
      if (r.stepped >= 4) r.rest = 50 + w.rng.int(70);
    }
    // The body glides along as the feet move.
    const k2 = Math.min(1, (r.stepped + (foot.to ? 1 - foot.lift / ROBOT_STEP : 0)) / 4);
    r.x = tileCenter(r.from[0] + (r.goal[0] - r.from[0]) * k2);
    r.y = tileCenter(r.from[1] + (r.goal[1] - r.from[1]) * k2);
  }

  /** Two tiles on, keeping all four feet inside the arena; it turns back only at a dead end. */
  private robotGoal([x, y]: [number, number], prev: [number, number]): [number, number] {
    const options = ALL_DIRS.map((d): [number, number] => [x + DX[d] * 2, y + DY[d] * 2]).filter(([nx, ny]) => this.robotCanStand(nx, ny));
    const onward = options.filter(([nx, ny]) => nx !== prev[0] || ny !== prev[1]);
    return this.w.rng.pick(onward.length ? onward : options);
  }

  /** The body's tile keeps all four feet inside the walls. */
  private robotCanStand(x: number, y: number): boolean {
    return x >= 3 && y >= 3 && x <= this.w.grid.w - 4 && y <= this.w.grid.h - 4;
  }

  /** A foot comes down: whoever stands under it is stunned and drops items. */
  private robotStomp(tx: number, ty: number): void {
    const w = this.w;
    for (const b of w.bombers) {
      if (!b.alive || b.airborne > 0 || b.tx !== tx || b.ty !== ty) continue;
      b.stunned = Math.max(b.stunned, 90);
      w.scatterItems(b, 2);
      w.emit({ type: 'stun', who: b.id });
    }
    w.emit({ type: 'pressure', tx, ty });
    w.emit({ type: 'shake', frames: 6 });
  }

  /**
   * Where the robot's feet will come down over the next `horizon` ticks: tile index →
   * ticks until the stamp (what the CPU players keep clear of).
   */
  robotForecast(horizon = 120): Map<number, number> {
    const out = new Map<number, number>();
    const r = this.robot;
    if (!r || r.gone || r.leaving > 0) return out;
    // The next walk's goal isn't chosen yet while resting: every way it might go counts.
    const walks: { goal: [number, number]; start: number; from: number }[] = [];
    if (r.stepped >= 4) {
      for (const d of ALL_DIRS) {
        const gx = r.goal[0] + DX[d] * 2;
        const gy = r.goal[1] + DY[d] * 2;
        if (this.robotCanStand(gx, gy)) walks.push({ goal: [gx, gy], start: r.rest + ROBOT_STEP, from: 0 });
      }
    } else {
      const foot = r.feet[r.stepped];
      walks.push({ goal: r.goal, start: foot.to ? foot.lift : ROBOT_STEP, from: r.stepped });
    }
    for (const { goal, start, from } of walks) {
      for (let k = from; k < 4; k++) {
        const t = start + (k - from) * ROBOT_STEP;
        if (t > horizon) break;
        const i = this.idx(goal[0] + ROBOT_FEET[k][0], goal[1] + ROBOT_FEET[k][1]);
        out.set(i, Math.min(out.get(i) ?? Infinity, t));
      }
    }
    return out;
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

function w_bombAt(w: BattleWorld, x: number, y: number): Bomb | null {
  return w.bombAtTile(x, y);
}
