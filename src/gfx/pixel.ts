import { ctx2d, makeCanvas } from '../engine/gfx';

/**
 * Minimal pixel-plotting canvas used to author sprites procedurally
 * (bombs, flames, blocks, items). Everything is drawn on whole pixels.
 */
export class PixelCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.canvas = makeCanvas(w, h);
    this.ctx = ctx2d(this.canvas);
  }

  px(x: number, y: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  hline(x0: number, x1: number, y: number, color: string): void {
    this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, color);
  }

  vline(x: number, y0: number, y1: number, color: string): void {
    this.rect(x, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, color);
  }

  /** Filled ellipse centred on (cx, cy) (may be at half-pixel positions). */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    this.ctx.fillStyle = color;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  circle(cx: number, cy: number, r: number, color: string): void {
    this.ellipse(cx, cy, r, r, color);
  }

  /** Filled rectangle with the four corner pixels knocked out. */
  roundRect(x: number, y: number, w: number, h: number, color: string, r = 1): void {
    this.rect(x + r, y, w - 2 * r, h, color);
    this.rect(x, y + r, w, h - 2 * r, color);
    if (r > 1) {
      this.rect(x + 1, y + 1, w - 2, h - 2, color);
    }
  }

  /** Pixel-art rows (same format as pixelSprite) drawn at an offset. */
  rows(rows: readonly string[], palette: Readonly<Record<string, string>>, ox = 0, oy = 0): void {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const c = palette[ch];
        if (c) this.px(ox + x, oy + y, c);
      }
    }
  }

  /** Outline every opaque pixel's transparent neighbours with `color`. */
  outline(color: string): void {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const d = img.data;
    const solid = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < this.w && y < this.h && d[(y * this.w + x) * 4 + 3] > 0;
    const marks: [number, number][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) marks.push([x, y]);
      }
    }
    for (const [x, y] of marks) this.px(x, y, color);
  }
}
