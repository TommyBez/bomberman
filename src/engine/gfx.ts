import { ADVANCE, GLYPH_H, GLYPH_W, glyph, textWidth } from './font';

export type Sprite = HTMLCanvasElement;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/**
 * Build a sprite from rows of palette characters. '.' and ' ' are transparent.
 * Rows may be shorter than the widest row (padded with transparency).
 */
export function pixelSprite(rows: readonly string[], palette: Readonly<Record<string, string>>): Sprite {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = makeCanvas(w, h);
  const ctx = ctx2d(c);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = palette[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

export function flipX(src: Sprite): Sprite {
  const c = makeCanvas(src.width, src.height);
  const ctx = ctx2d(c);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

/** Replace exact colours (hex "#rrggbb") in a sprite. */
export function recolor(src: Sprite, map: Readonly<Record<string, string>>): Sprite {
  const c = makeCanvas(src.width, src.height);
  const ctx = ctx2d(c);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const lut = new Map<number, [number, number, number]>();
  for (const [from, to] of Object.entries(map)) lut.set(hexKey(from), hexRgb(to));
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const hit = lut.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (hit) {
      d[i] = hit[0];
      d[i + 1] = hit[1];
      d[i + 2] = hit[2];
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** A solid-colour silhouette of a sprite (hit flashes, shadows, outlines). */
export function silhouette(src: Sprite, color: string): Sprite {
  const c = makeCanvas(src.width, src.height);
  const ctx = ctx2d(c);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Add a 1px dark outline around a sprite (grows it by 1px on each side). */
export function outlined(src: Sprite, color = '#000000'): Sprite {
  const c = makeCanvas(src.width + 2, src.height + 2);
  const ctx = ctx2d(c);
  const sil = silhouette(src, color);
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) ctx.drawImage(sil, dx, dy);
  ctx.drawImage(src, 1, 1);
  return c;
}

export function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function hexKey(hex: string): number {
  const [r, g, b] = hexRgb(hex);
  return (r << 16) | (g << 8) | b;
}

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexRgb(a);
  const [br, bg, bb] = hexRgb(b);
  const f = (x: number, y: number): string =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${f(ar, br)}${f(ag, bg)}${f(ab, bb)}`;
}

export type Align = 'left' | 'center' | 'right';

export interface TextOptions {
  color?: string;
  /** Draw a 1px outline (in this colour) around each glyph. */
  outline?: string;
  /** Draw a drop shadow (in this colour) at +1,+1 (scaled). */
  shadow?: string;
  align?: Align;
  scale?: number;
  /** Vertical gradient: top colour → bottom colour (overrides color). */
  gradient?: [string, string];
}

/** Glyph atlas per colour, so text is drawn with drawImage instead of per-pixel fills. */
class FontCache {
  private atlases = new Map<string, { canvas: HTMLCanvasElement; index: Map<string, number> }>();

  atlas(color: string | [string, string]): { canvas: HTMLCanvasElement; index: Map<string, number> } {
    const key = typeof color === 'string' ? color : color.join('>');
    let a = this.atlases.get(key);
    if (a) return a;
    const chars = FONT_CHARS;
    const canvas = makeCanvas(chars.length * (GLYPH_W + 1), GLYPH_H);
    const ctx = ctx2d(canvas);
    const index = new Map<string, number>();
    chars.forEach((ch, i) => {
      index.set(ch, i);
      for (const [x, y] of glyph(ch)) {
        ctx.fillStyle = typeof color === 'string' ? color : mix(color[0], color[1], y / (GLYPH_H - 1));
        ctx.fillRect(i * (GLYPH_W + 1) + x, y, 1, 1);
      }
    });
    a = { canvas, index };
    this.atlases.set(key, a);
    return a;
  }
}

const FONT_CHARS = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?-+=/\'"()*#%&<>_[]©→←↑↓▶♥×',
];

export class Gfx {
  private fonts = new FontCache();

  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly width: number,
    readonly height: number,
  ) {}

  clear(color = '#000000'): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  frame(x: number, y: number, w: number, h: number, color: string): void {
    this.rect(x, y, w, 1, color);
    this.rect(x, y + h - 1, w, 1, color);
    this.rect(x, y, 1, h, color);
    this.rect(x + w - 1, y, 1, h, color);
  }

  image(img: CanvasImageSource, x: number, y: number): void {
    this.ctx.drawImage(img, Math.round(x), Math.round(y));
  }

  /** Draw text in the bitmap font. Returns the drawn width. */
  text(str: string, x: number, y: number, opts: TextOptions = {}): number {
    const s = opts.scale ?? 1;
    const upper = str.toUpperCase();
    const w = textWidth(upper, s);
    let x0 = x;
    if (opts.align === 'center') x0 = x - Math.floor(w / 2);
    else if (opts.align === 'right') x0 = x - w;
    x0 = Math.round(x0);
    const y0 = Math.round(y);
    if (opts.shadow) this.rawText(upper, x0 + s, y0 + s, opts.shadow, s);
    if (opts.outline) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        this.rawText(upper, x0 + dx * s, y0 + dy * s, opts.outline, s);
      }
    }
    this.rawText(upper, x0, y0, opts.gradient ?? opts.color ?? '#ffffff', s);
    return w;
  }

  private rawText(str: string, x: number, y: number, color: string | [string, string], s: number): void {
    const { canvas, index } = this.fonts.atlas(color);
    let cx = x;
    for (const ch of str) {
      const i = index.get(ch) ?? index.get('?')!;
      if (ch !== ' ') {
        this.ctx.drawImage(canvas, i * (GLYPH_W + 1), 0, GLYPH_W, GLYPH_H, cx, y, GLYPH_W * s, GLYPH_H * s);
      }
      cx += ADVANCE * s;
    }
  }
}

export { textWidth };
