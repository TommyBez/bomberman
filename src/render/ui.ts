import type { App } from '../app';
import { mix, textWidth, type Gfx } from '../engine/gfx';
import type { Controller } from '../engine/input';
import { PixelCanvas } from '../gfx/pixel';

/** Big outlined banner text across the screen ("READY", "PAUSE!", "HURRY!"…). */
export function drawBanner(g: Gfx, text: string, y: number, color = '#ffe040', scale = 2): void {
  const h = 7 * scale + 10;
  g.ctx.globalAlpha = 0.55;
  g.rect(0, y - h / 2, g.width, h, '#000000');
  g.ctx.globalAlpha = 1;
  g.rect(0, y - h / 2, g.width, 1, mix(color, '#ffffff', 0.4));
  g.rect(0, y + h / 2 - 1, g.width, 1, mix(color, '#000000', 0.4));
  g.text(text, g.width / 2, y - (7 * scale) / 2, { align: 'center', scale, gradient: ['#ffffff', color], outline: '#000000' });
}

/** Greedy word wrap for the fixed-width font. */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > maxChars) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * A menu window: the wallpaper shows through darkened (tinted by `top`/`bottom`) inside a
 * magenta double frame.
 */
export function drawPanel(g: Gfx, x: number, y: number, w: number, h: number, top = '#3050c8', bottom = '#101868'): void {
  const ctx = g.ctx;
  g.rect(x + 3, y + 3, w, h, 'rgba(40,0,40,0.35)');
  ctx.globalAlpha = 0.62;
  g.rect(x, y, w, h, '#1a0828');
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < h; i++) g.rect(x, y + i, w, 1, mix(top, bottom, i / h));
  ctx.globalAlpha = 1;
  // Frame: dark edge, magenta band with a light inner line, dark inner edge.
  g.frame(x - 3, y - 3, w + 6, h + 6, '#300028');
  g.frame(x - 2, y - 2, w + 4, h + 4, '#e050c8');
  g.frame(x - 1, y - 1, w + 2, h + 2, '#ffb8f0');
  g.frame(x, y, w, h, '#700060');
}

/** Title plate at the top of menu screens. */
export function drawTitleBar(g: Gfx, text: string, _frame: number): void {
  const tw = textWidth(text, 2);
  const w = Math.min(g.width - 8, tw + 28);
  const x = Math.round((g.width - w) / 2);
  const y = 3;
  const h = 22;
  g.rect(x + 2, y + 2, w, h, 'rgba(40,0,40,0.4)');
  g.rect(x - 2, y - 2, w + 4, h + 4, '#300028');
  g.rect(x - 1, y - 1, w + 2, h + 2, '#e050c8');
  for (let i = 0; i < h; i++) g.rect(x, y + i, w, 1, mix('#fff6b0', '#f4c040', i / (h - 1)));
  g.rect(x, y, w, 1, '#ffffff');
  g.rect(x, y + h - 1, w, 1, '#c08020');
  // Notched ends, like a ribbon label.
  g.rect(x - 2, y + h / 2 - 3, 3, 6, '#e050c8');
  g.rect(x + w - 1, y + h / 2 - 3, 3, 6, '#e050c8');
  g.text(text, g.width / 2, y + 4, { align: 'center', scale: 2, gradient: ['#ffffff', '#a8d8ff'], outline: '#182060' });
}

let wallpaper: HTMLCanvasElement | null = null;

/** The menu wallpaper: pink and yellow tiles with a bomb or a Bomberman helmet on each. */
function wallpaperTile(): HTMLCanvasElement {
  if (wallpaper) return wallpaper;
  const p = new PixelCanvas(64, 64);
  const tile = (ox: number, oy: number, yellow: boolean): void => {
    const [base, shade, light] = yellow ? ['#f8cc60', '#eeb440', '#fde08c'] : ['#f8c4d4', '#eea8c0', '#ffdce8'];
    p.rect(ox, oy, 32, 32, base);
    p.rect(ox, oy, 32, 1, light);
    p.rect(ox, oy, 1, 32, light);
    p.rect(ox, oy + 31, 32, 1, shade);
    p.rect(ox + 31, oy, 1, 32, shade);
    if (yellow) {
      // A bomb with its fuse, a shade darker than the tile.
      p.circle(ox + 15, oy + 18, 8, '#eeb848');
      p.circle(ox + 12, oy + 15, 2.2, '#fbd67a');
      p.rect(ox + 19, oy + 8, 3, 3, '#eeb848');
      p.rect(ox + 21, oy + 5, 2, 4, '#eeb848');
      p.rect(ox + 23, oy + 3, 2, 2, '#fde08c');
    } else {
      // A Bomberman helmet with its antenna ball, a shade lighter than the tile.
      const hi = '#fde2ec';
      p.circle(ox + 16, oy + 5, 2.5, hi);
      p.rect(ox + 15, oy + 7, 2, 3, hi);
      p.roundRect(ox + 7, oy + 10, 18, 16, hi, 5);
      p.roundRect(ox + 10, oy + 14, 12, 8, '#f0b4c8', 2);
      p.rect(ox + 13, oy + 15, 2, 5, hi);
      p.rect(ox + 18, oy + 15, 2, 5, hi);
    }
  };
  tile(0, 0, true);
  tile(32, 0, false);
  tile(0, 32, false);
  tile(32, 32, true);
  wallpaper = p.canvas;
  return wallpaper;
}

/** Menu background: the tiled wallpaper, drifting slowly down and to the right. */
export function drawMenuBackdrop(g: Gfx, frame: number): void {
  const tile = wallpaperTile();
  const off = (frame >> 2) % 64;
  for (let y = off - 64; y < g.height; y += 64) for (let x = off - 64; x < g.width; x += 64) g.image(tile, x, y);
}

export interface MenuItem {
  label: string;
  /** Current value text (for option rows). */
  value?: () => string;
  /** Left/right changes the value. */
  change?: (dir: -1 | 1) => void;
  /** A / START on the item. */
  action?: () => void;
  disabled?: () => boolean;
  /** Short help line shown under the menu. */
  help?: string | (() => string);
}

/** Vertical menu with a blinking cursor; handles its own input and sounds. */
export class Menu {
  index = 0;

  constructor(
    private readonly app: App,
    public items: MenuItem[],
    private readonly onBack?: () => void,
  ) {}

  update(): void {
    const pad = this.app.input.menu;
    const n = this.items.length;
    if (pad.repeat('up')) {
      this.move(-1);
    } else if (pad.repeat('down')) {
      this.move(1);
    }
    const item = this.items[this.index];
    if (!item) return;
    const disabled = item.disabled?.() ?? false;
    if (item.change && !disabled) {
      if (pad.repeat('left')) {
        item.change(-1);
        this.app.audio.sfx('select');
      } else if (pad.repeat('right')) {
        item.change(1);
        this.app.audio.sfx('select');
      }
    }
    if ((pad.pressed('a') || pad.pressed('start')) && item.action && !disabled) {
      this.app.audio.sfx('menuOk');
      pad.swallow();
      item.action();
    } else if ((pad.pressed('b') || pad.pressed('d') || pad.pressed('select')) && this.onBack) {
      this.app.audio.sfx('menuBack');
      pad.swallow();
      this.onBack();
    }
    void n;
  }

  private move(d: number): void {
    const n = this.items.length;
    for (let k = 0; k < n; k++) {
      this.index = (this.index + d + n) % n;
      if (!this.items[this.index].disabled?.()) break;
    }
    this.app.audio.sfx('menuMove');
  }

  /** Draw rows starting at (x, y); `valueX` aligns option values. */
  draw(g: Gfx, x: number, y: number, opts: { lineH?: number; valueX?: number; center?: boolean; width?: number } = {}): void {
    const lh = opts.lineH ?? 14;
    this.items.forEach((it, i) => {
      const sel = i === this.index;
      const disabled = it.disabled?.() ?? false;
      const color = disabled ? '#707090' : sel ? '#ffe040' : '#ffffff';
      const yy = y + i * lh;
      if (sel) {
        const blink = Math.floor(this.app.frame / 8) % 2 === 0;
        const w = opts.width ?? (opts.valueX ? opts.valueX - x + 70 : textWidth(it.label) + 20);
        const bx = opts.center ? x - w / 2 : x - 12;
        g.ctx.globalAlpha = 0.25;
        g.rect(bx, yy - 3, w + 12, 13, '#ffffff');
        g.ctx.globalAlpha = 1;
        if (blink) g.text('▶', opts.center ? x - textWidth(it.label) / 2 - 10 : x - 10, yy, { color: '#ffe040', outline: '#000000' });
      }
      g.text(it.label, x, yy, { color, outline: '#000000', align: opts.center ? 'center' : 'left' });
      if (it.value) {
        const v = it.value();
        const vx = opts.valueX ?? x + 120;
        const arrows = sel && it.change && !disabled;
        g.text(arrows ? `← ${v} →` : v, vx, yy, { color: disabled ? '#707090' : sel ? '#ffffff' : '#a8c0ff', outline: '#000000', align: 'center' });
      }
    });
    const h = this.items[this.index]?.help;
    const help = typeof h === 'function' ? h() : h;
    if (help) g.text(help, g.width / 2, g.height - 14, { align: 'center', color: '#c8d0ff', outline: '#000000' });
  }
}

/** In-game pause: CONTINUE / QUIT, and QUIT asks YES / NO first (as on PlayStation). */
export class PauseMenu {
  private sel = 0;
  private confirming = false;

  constructor(private readonly app: App) {}

  reset(): void {
    this.sel = 0;
    this.confirming = false;
  }

  /** Feed one tick of input; returns what the player chose, if anything. */
  update(pad: Controller): 'continue' | 'quit' | null {
    const sfx = (n: string): void => this.app.audio.sfx(n);
    if (pad.repeat('up') || pad.repeat('down')) {
      this.sel = 1 - this.sel;
      sfx('menuMove');
    }
    if (pad.pressed('start') || pad.pressed('a')) {
      pad.swallow();
      if (!this.confirming) {
        if (this.sel === 0) return 'continue';
        this.confirming = true;
        this.sel = 1; // NO is the safe default
        sfx('menuOk');
        return null;
      }
      if (this.sel === 0) return 'quit';
      this.confirming = false;
      this.sel = 1;
      sfx('menuBack');
      return null;
    }
    if (pad.pressed('b') || pad.pressed('d') || pad.pressed('select')) {
      pad.swallow();
      if (!this.confirming) return 'continue';
      this.confirming = false;
      this.sel = 1;
      sfx('menuBack');
    }
    return null;
  }

  draw(g: Gfx): void {
    g.ctx.globalAlpha = 0.55;
    g.rect(0, 0, g.width, g.height, '#000000');
    g.ctx.globalAlpha = 1;
    drawBanner(g, 'PAUSE!', 86, '#ffe040');
    if (this.confirming) g.text('QUIT THIS GAME?', g.width / 2, 108, { align: 'center', color: '#ffb0b0', outline: '#000000' });
    const options = this.confirming ? ['YES', 'NO'] : ['CONTINUE', 'QUIT'];
    options.forEach((o, i) => {
      const sel = i === this.sel;
      g.text((sel ? '▶ ' : '  ') + o, g.width / 2 - 30, (this.confirming ? 122 : 116) + i * 14, { color: sel ? '#ffe040' : '#ffffff', outline: '#000000' });
    });
  }
}
