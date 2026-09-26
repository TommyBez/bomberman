import { Cell } from './types';

/** The static block layer of a playfield. Everything outside the map counts as hard wall. */
export class Grid {
  readonly cells: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.cells = new Uint8Array(w * h);
  }

  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): Cell {
    if (!this.inside(x, y)) return Cell.Hard;
    return this.cells[y * this.w + x] as Cell;
  }

  set(x: number, y: number, c: Cell): void {
    if (this.inside(x, y)) this.cells[y * this.w + x] = c;
  }

  isHard(x: number, y: number): boolean {
    return this.get(x, y) === Cell.Hard;
  }

  isSoft(x: number, y: number): boolean {
    return this.get(x, y) === Cell.Soft;
  }

  isFloor(x: number, y: number): boolean {
    return this.get(x, y) === Cell.Floor;
  }

  /** Classic layout: solid border plus a pillar on every even/even coordinate. */
  static classic(w: number, h: number): Grid {
    const g = new Grid(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const border = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        const pillar = x % 2 === 0 && y % 2 === 0;
        g.set(x, y, border || pillar ? Cell.Hard : Cell.Floor);
      }
    }
    return g;
  }

  count(c: Cell): number {
    let n = 0;
    for (const v of this.cells) if (v === c) n++;
    return n;
  }
}
