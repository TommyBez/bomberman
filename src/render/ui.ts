import type { App } from '../app';
import { mix, textWidth, type Gfx } from '../engine/gfx';
import type { Controller } from '../engine/input';
import { PixelCanvas } from '../gfx/pixel';

/** The original's big call-outs, each word with its own colours and outline. */
export type WordStyle = 'ready' | 'hurry' | 'timeUp' | 'pause' | 'demo';

const WORD_STYLES: Record<WordStyle, { ink: [string, string]; edge: string; scale: number }> = {
  ready: { ink: ['#fff030', '#fffef0'], edge: '#1838a0', scale: 4 },
  hurry: { ink: ['#e0ec38', '#fffce0'], edge: '#1c5010', scale: 3 },
  timeUp: { ink: ['#88ecf8', '#ffffff'], edge: '#28148c', scale: 3 },
  pause: { ink: ['#ffc088', '#fff8ec'], edge: '#c83818', scale: 3 },
  demo: { ink: ['#a0ecff', '#ffffff'], edge: '#3c1890', scale: 2 },
};

/** A call-out word centred on the screen at height `y`, with a dark drop shadow. */
export function drawWord(g: Gfx, text: string, y: number, style: WordStyle): void {
  const st = WORD_STYLES[style];
  const top = y - (7 * st.scale) / 2;
  const shade = mix(st.edge, '#000000', 0.5);
  g.text(text, g.width / 2 + st.scale - 1, top + st.scale - 1, { align: 'center', scale: st.scale, color: shade, outline: shade });
  g.text(text, g.width / 2, top, { align: 'center', scale: st.scale, gradient: st.ink, outline: st.edge });
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
 * A menu window inside a magenta double frame. Its inside is the wallpaper's pattern in
 * purple and olive, as in the original; `top`/`bottom` instead tint the wallpaper showing
 * through (for boxes that need a colour of their own).
 */
export function drawPanel(g: Gfx, x: number, y: number, w: number, h: number, top?: string, bottom?: string): void {
  const ctx = g.ctx;
  g.rect(x + 3, y + 3, w, h, 'rgba(40,0,40,0.35)');
  if (top && bottom) {
    ctx.globalAlpha = 0.62;
    g.rect(x, y, w, h, '#1a0828');
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < h; i++) g.rect(x, y + i, w, 1, mix(top, bottom, i / h));
    ctx.globalAlpha = 1;
  } else {
    const tile = patternTile(WINDOW);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (let ty = y; ty < y + h; ty += 64) for (let tx = x; tx < x + w; tx += 64) g.image(tile, tx, ty);
    ctx.restore();
  }
  // Frame: dark edge, magenta band with a light inner line, dark inner edge.
  g.frame(x - 3, y - 3, w + 6, h + 6, '#300028');
  g.frame(x - 2, y - 2, w + 4, h + 4, '#e050c8');
  g.frame(x - 1, y - 1, w + 2, h + 2, '#ffb8f0');
  g.frame(x, y, w, h, '#700060');
}

/**
 * The plates' three families in the original: pink with yellow lettering for the game's own
 * menus, pale yellow with pale blue lettering for the options, salmon with pink lettering
 * for the memory card.
 */
export type PlateStyle = 'game' | 'option' | 'card';

const PLATES: Record<PlateStyle, { plate: [string, string]; ink: [string, string]; outline: string }> = {
  game: { plate: ['#ffdce2', '#f4b4c4'], ink: ['#fffc90', '#f0c418'], outline: '#402008' },
  option: { plate: ['#fff8c0', '#f4e080'], ink: ['#ffffff', '#90bcf4'], outline: '#182858' },
  card: { plate: ['#ffc4a8', '#f4987c'], ink: ['#fff0fc', '#f890d0'], outline: '#500828' },
};

/** Name plate of a menu screen, at the top of the screen or at `y`. */
export function drawTitleBar(g: Gfx, text: string, _frame: number, style: PlateStyle = 'game', y = 3): void {
  const p = PLATES[style];
  const tw = textWidth(text, 2);
  const w = Math.min(g.width - 8, tw + 28);
  const x = Math.round((g.width - w) / 2);
  const h = 22;
  g.rect(x + 2, y + 2, w, h, 'rgba(40,0,40,0.4)');
  g.rect(x - 1, y - 1, w + 2, h + 2, '#284878');
  for (let i = 0; i < h; i++) g.rect(x, y + i, w, 1, mix(p.plate[0], p.plate[1], i / (h - 1)));
  g.rect(x, y, w, 1, '#ffffff');
  // A row of stitches along each long edge.
  for (let sx = x + 2; sx < x + w - 2; sx += 3) {
    g.rect(sx, y + 1, 1, 1, '#6888b8');
    g.rect(sx, y + h - 2, 1, 1, '#6888b8');
  }
  g.text(text, g.width / 2, y + 4, { align: 'center', scale: 2, gradient: p.ink, outline: p.outline });
}

/** A menu window with its name plate across the top edge, the way the original draws them. */
export function drawWindow(g: Gfx, title: string, x: number, y: number, w: number, h: number, style: PlateStyle = 'game'): void {
  drawPanel(g, x, y, w, h);
  drawTitleBar(g, title, 0, style, y - 11);
}

/**
 * A plain menu screen's window: full width, centred on the screen, sized to its rows, with
 * the rows centred (or, with `valueX`, labels on the left and values in a column).
 */
export function drawMenuWindow(g: Gfx, title: string, menu: Menu, opts: { lineH?: number; valueX?: number; style?: PlateStyle } = {}): void {
  const lh = opts.lineH ?? 28;
  const n = menu.items.length;
  const h = n * lh + 32;
  const y = Math.round((g.height - h) / 2) + 6;
  drawWindow(g, title, 14, y, 228, h, opts.style);
  const top = y + Math.round((h - ((n - 1) * lh + 7)) / 2) + 4;
  if (opts.valueX) menu.draw(g, 40, top, { lineH: lh, valueX: opts.valueX });
  else menu.draw(g, g.width / 2, top, { center: true, lineH: lh });
}

let hand: HTMLCanvasElement | null = null;

/** The menu cursor: a white glove pointing right, bobbing a little. */
export function drawHand(g: Gfx, x: number, y: number, frame: number): void {
  if (!hand) {
    const p = new PixelCanvas(12, 8);
    p.rows(
      ['...kkkk.....', '..kwwwwkkkkk', '.kwwwwwwwwwk', 'kwwwwwkkkkkk', 'kwwwwwwwk...', 'kwwwwwwwk...', 'kwwwwwwk....', '.kkkkkk.....'],
      { k: '#200818', w: '#ffffff' },
    );
    hand = p.canvas;
  }
  g.image(hand, x + (Math.floor(frame / 10) % 2), y);
}

/** Colours of the bomb squares and the helmet squares of a pattern. */
interface PatternPalette {
  bomb: [string, string, string, string, string];
  helmet: [string, string, string, string, string];
}

/** The menu wallpaper: pink and yellow squares. */
const WALLPAPER: PatternPalette = {
  bomb: ['#f8cc60', '#eeb440', '#fde08c', '#eeb848', '#fbd67a'],
  helmet: ['#f8c4d4', '#eea8c0', '#ffdce8', '#fde2ec', '#f0b4c8'],
};
/** Inside a menu window: the same squares in olive and purple. */
const WINDOW: PatternPalette = {
  bomb: ['#a08a44', '#8c7836', '#b09c58', '#927e3a', '#b8a460'],
  helmet: ['#9474b0', '#80629c', '#a484c0', '#a888c2', '#8a6aa6'],
};

const patterns = new Map<PatternPalette, HTMLCanvasElement>();

/** A 64×64 repeat of the pattern: a bomb on every other square, a Bomberman helmet between. */
function patternTile(pal: PatternPalette): HTMLCanvasElement {
  const cached = patterns.get(pal);
  if (cached) return cached;
  const p = new PixelCanvas(64, 64);
  const tile = (ox: number, oy: number, bomb: boolean): void => {
    const [base, shade, light, mark, glint] = bomb ? pal.bomb : pal.helmet;
    p.rect(ox, oy, 32, 32, base);
    p.rect(ox, oy, 32, 1, light);
    p.rect(ox, oy, 1, 32, light);
    p.rect(ox, oy + 31, 32, 1, shade);
    p.rect(ox + 31, oy, 1, 32, shade);
    if (bomb) {
      // A bomb with its fuse, a shade darker than the square.
      p.circle(ox + 15, oy + 18, 8, mark);
      p.circle(ox + 12, oy + 15, 2.2, glint);
      p.rect(ox + 19, oy + 8, 3, 3, mark);
      p.rect(ox + 21, oy + 5, 2, 4, mark);
      p.rect(ox + 23, oy + 3, 2, 2, light);
    } else {
      // A Bomberman helmet with its antenna ball, a shade lighter than the square.
      p.circle(ox + 16, oy + 5, 2.5, mark);
      p.rect(ox + 15, oy + 7, 2, 3, mark);
      p.roundRect(ox + 7, oy + 10, 18, 16, mark, 5);
      p.roundRect(ox + 10, oy + 14, 12, 8, glint, 2);
      p.rect(ox + 13, oy + 15, 2, 5, mark);
      p.rect(ox + 18, oy + 15, 2, 5, mark);
    }
  };
  tile(0, 0, true);
  tile(32, 0, false);
  tile(0, 32, false);
  tile(32, 32, true);
  patterns.set(pal, p.canvas);
  return p.canvas;
}

/** Menu background: the tiled wallpaper, drifting slowly down and to the right. */
export function drawMenuBackdrop(g: Gfx, frame: number): void {
  const tile = patternTile(WALLPAPER);
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
}

/** Menu lettering: pale green with a dark outline, values in pale yellow. */
export const MENU_TEXT = { color: '#b8f4a4', outline: '#0c2c10' };
export const MENU_VALUE = '#fff4a0';
export const MENU_DIM = '#6c7c60';

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
  draw(g: Gfx, x: number, y: number, opts: { lineH?: number; valueX?: number; center?: boolean } = {}): void {
    const lh = opts.lineH ?? 14;
    this.items.forEach((it, i) => {
      const sel = i === this.index;
      const disabled = it.disabled?.() ?? false;
      const color = disabled ? MENU_DIM : MENU_TEXT.color;
      const yy = y + i * lh;
      // The white glove points at the selected item.
      if (sel) drawHand(g, (opts.center ? x - textWidth(it.label) / 2 : x) - 16, yy - 1, this.app.frame);
      g.text(it.label, x, yy, { color, outline: MENU_TEXT.outline, align: opts.center ? 'center' : 'left' });
      if (it.value) {
        const v = it.value();
        const vx = opts.valueX ?? x + 120;
        const arrows = sel && it.change && !disabled;
        g.text(arrows ? `← ${v} →` : v, vx, yy, { color: disabled ? MENU_DIM : MENU_VALUE, outline: MENU_TEXT.outline, align: 'center' });
      }
    });
  }
}

/** In-game pause: RESUME / QUIT, and QUIT asks YES / NO first (as on PlayStation). */
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

  /** PAUSE! and the choices, as in the original: the chosen word white, the other grey. */
  draw(g: Gfx): void {
    g.ctx.globalAlpha = 0.5;
    g.rect(0, 0, g.width, g.height, '#000000');
    g.ctx.globalAlpha = 1;
    drawWord(g, 'PAUSE!', 70, 'pause');
    const options = this.confirming ? ['YES', 'NO'] : ['RESUME', 'QUIT'];
    options.forEach((o, i) => {
      const sel = i === this.sel;
      const style = sel ? { gradient: ['#ffffff', '#b8ccff'] as [string, string], outline: '#1838a0' } : { color: '#808898', outline: '#282c38' };
      g.text(o, g.width / 2, 104 + i * 24, { align: 'center', scale: 2, ...style });
    });
  }
}
