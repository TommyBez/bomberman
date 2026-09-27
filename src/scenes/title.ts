import type { App } from '../app';
import { mix, type Gfx } from '../engine/gfx';
import type { Scene } from '../engine/scene';
import { PixelCanvas } from '../gfx/pixel';
import { sprites } from '../gfx/sprites';
import { Menu } from '../render/ui';
import { startDemo } from './battle/demo';
import { BattleSetup } from './battle/setup';
import { openContinue, openNewGame } from './mainMenu';
import { OptionScene } from './option';

const DEMO_IDLE_TICKS = 20 * 60;
/** Left alone this long, Bomberman nods off (a bubble at his nose) until the demo starts. */
const DOZE_TICKS = 10 * 60;

/** The title's big orange lettering. */
const TITLE_TEXT = { scale: 2, gradient: ['#fff070', '#f07800'] as [string, string], outline: '#3c1400' };

/**
 * Title screen: the logo over a tiled blue wallpaper, Bomberman's big face and PRESS
 * START BUTTON. START brings up the mode menu right here, under the logo.
 */
export class TitleScene implements Scene {
  private t = 0;
  /** Ticks without input; the demo starts after 20 seconds. */
  private idle = 0;
  /** Ticks left of the startled look (woken up) and of the happy one (menu opened). */
  private startled = 0;
  private pleased = 0;
  /**
   * NORMAL GAME / BATTLE GAME / OPTION once START has been pressed, and in its place
   * NEW GAME / CONTINUE once NORMAL GAME has been chosen.
   */
  private menu: Menu | null = null;

  constructor(
    private readonly app: App,
    /** Come back straight to the mode menu with this item selected. */
    private readonly menuIndex?: number,
    /** ...or to the Normal Game's NEW GAME / CONTINUE with this one selected. */
    normalIndex?: number,
  ) {
    if (normalIndex !== undefined) this.openNormal(normalIndex);
    else if (menuIndex !== undefined) this.openMenu(menuIndex);
    // Coming back to a menu, the logo is already in place.
    if (this.menu) this.t = 90;
  }

  /** Which face Bomberman pulls. */
  private expression(): Expression {
    if (this.startled > 0) return 'wide';
    if (this.idle > DOZE_TICKS) return 'sleep';
    if (this.pleased > 0) return 'happy';
    if (this.t % 1500 > 1460) return 'wink';
    if (this.t % 260 > 252) return 'blink';
    return 'determined';
  }

  private openMenu(index: number): void {
    const app = this.app;
    this.menu = new Menu(
      app,
      [
        { label: 'NORMAL GAME', action: () => this.openNormal(0) },
        { label: 'BATTLE GAME', action: () => new BattleSetup(app).start() },
        { label: 'OPTION', action: () => app.scenes.go(new OptionScene(app)) },
      ],
      () => {
        this.menu = null;
        this.t = 30;
      },
    );
    this.menu.index = index;
  }

  private openNormal(index: number): void {
    const app = this.app;
    this.menu = new Menu(
      app,
      [
        { label: 'NEW GAME', action: () => openNewGame(app) },
        { label: 'CONTINUE', action: () => openContinue(app) },
      ],
      () => this.openMenu(0),
    );
    this.menu.index = index;
  }

  enter(): void {
    this.app.audio.music('title', { restart: this.menuIndex === undefined });
  }

  update(): void {
    this.t++;
    const pad = this.app.input.menu;
    const dozing = this.idle > DOZE_TICKS;
    this.idle = pad.anyPressed() ? 0 : this.idle + 1;
    if (dozing && this.idle === 0) this.startled = 40;
    if (this.startled > 0) this.startled--;
    if (this.pleased > 0) this.pleased--;
    if (this.menu) {
      this.menu.update();
    } else if (this.t > 20 && (pad.pressed('start') || pad.pressed('a'))) {
      this.app.audio.sfx('menuOk');
      pad.swallow();
      this.openMenu(0);
      this.pleased = 45;
      return;
    }
    if (this.idle === DEMO_IDLE_TICKS) startDemo(this.app);
  }

  /** Chunky 3D logo: letters drop in one by one, the "O" is a lit bomb. */
  private drawLogo(g: Gfx, cx: number, top: number): void {
    const word = 'BOMBERMAN';
    const s = 4;
    const adv = 6 * s;
    const x0 = Math.round(cx - (word.length * adv - s) / 2);
    const pos = [...word].map((ch, i) => {
      const k = Math.max(0, Math.min(1, (this.t - i * 4) / 16));
      const fall = Math.round((1 - k * k) * -70);
      const wave = this.t > 80 ? Math.round(Math.sin((this.t + i * 9) / 18) * 1.5) : 0;
      return { ch, x: x0 + i * adv, y: top + fall + wave };
    });
    // Red-to-yellow letters with a dark red extrusion.
    for (const p of pos) if (p.ch !== 'O') for (let d = 4; d >= 1; d--) g.text(p.ch, p.x + d, p.y + d, { scale: s, color: '#3c0a04' });
    for (const p of pos) if (p.ch !== 'O') g.text(p.ch, p.x, p.y, { scale: s, color: '#2a0602', outline: '#2a0602' });
    for (const p of pos) {
      if (p.ch === 'O') this.drawBombLetter(g, p.x + 10, p.y + 15);
      else g.text(p.ch, p.x, p.y, { scale: s, gradient: ['#fff060', '#e82410'] });
    }
  }

  private drawBombLetter(g: Gfx, cx: number, cy: number): void {
    const disc = (x: number, y: number, r: number, color: string): void => {
      for (let dy = -r; dy <= r; dy++) {
        const w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
        g.rect(x - w, y + dy, w * 2 + 1, 1, color);
      }
    };
    for (let d = 4; d >= 1; d--) disc(cx + d, cy + d, 13, '#3c0a04');
    disc(cx, cy, 13, '#2a0602');
    disc(cx, cy, 10, '#202848');
    disc(cx - 1, cy - 1, 8, '#343c64');
    disc(cx - 4, cy - 4, 3, '#8890c0');
    g.rect(cx - 5, cy - 5, 2, 2, '#ffffff');
    // Cap and fuse with a flickering spark.
    g.rect(cx + 5, cy - 14, 6, 4, '#102060');
    g.rect(cx + 6, cy - 13, 4, 2, '#a0a8c8');
    g.rect(cx + 9, cy - 18, 2, 5, '#c08040');
    g.rect(cx + 10, cy - 20, 2, 3, '#c08040');
    const f = Math.floor(this.t / 3) % 3;
    const spark = ['#ffffff', '#ffe040', '#ff8020'][f];
    g.rect(cx + 10 - f, cy - 23 - f, 3 + f * 2, 3 + f * 2, '#ff6010');
    g.rect(cx + 11 - f / 2, cy - 22 - f / 2, 1 + f, 1 + f, spark);
  }

  render(g: Gfx): void {
    // Blue wallpaper tiled with faint wordmarks.
    for (let y = 0; y < g.height; y++) g.rect(0, y, g.width, 1, mix('#38d8f8', '#1438c8', y / g.height));
    const off = (this.t >> 2) % 48;
    g.ctx.globalAlpha = 0.16;
    for (let y = -48 + off; y < g.height; y += 48) {
      for (let x = -64 + off; x < g.width; x += 64) {
        g.rect(x + 1, y + 1, 62, 46, '#ffffff');
        g.text('BOMBER', x + 32, y + 14, { align: 'center', color: '#1438c8' });
        g.text('MAN', x + 32, y + 26, { align: 'center', color: '#1438c8' });
      }
    }
    g.ctx.globalAlpha = 1;
    // A starburst behind the end of the logo, then the logo.
    drawStarburst(g, 214, 26, this.t);
    this.drawLogo(g, g.width / 2, 12);
    // Bomberman's big face.
    const bob = Math.round(Math.sin(this.t / 24) * 2);
    g.ctx.imageSmoothingEnabled = false;
    g.ctx.drawImage(bigHead(this.expression()), g.width / 2 - 40, 58 + bob, 80, 72);
    if (this.idle > DOZE_TICKS) {
      // A bubble at his nose, swelling and shrinking as he breathes.
      const r = 3 + 5 * (0.5 - 0.5 * Math.cos((this.idle - DOZE_TICKS) / 24));
      const ctx = g.ctx;
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#88d8ff';
      ctx.beginPath();
      ctx.arc(142 + r * 0.6, 108 + bob, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      g.rect(140 + r * 0.3, 105 + bob - r * 0.4, 2, 2, '#ffffff');
    }
    if (this.menu) {
      // The modes in the title's orange lettering, straight on the wallpaper, with a bomb for a cursor.
      this.menu.items.forEach((it, i) => {
        const y = 144 + i * 20;
        g.text(it.label, 76, y, TITLE_TEXT);
        if (i === this.menu!.index) g.image(sprites().bomb[Math.floor(this.t / 8) % 3], 56 + (Math.floor(this.t / 10) % 2), y - 2);
      });
    } else if (Math.floor(this.t / 30) % 2 === 0 || this.t < 30) {
      g.text('PRESS START BUTTON', g.width / 2, 160, { align: 'center', ...TITLE_TEXT });
    }
    if (!this.menu) g.text('FAN REMAKE - NOT AN OFFICIAL PRODUCT', g.width / 2, 206, { align: 'center', color: '#ffffff', outline: '#102060' });
  }
}

/** A spiky yellow-and-red burst (behind the logo). */
function drawStarburst(g: Gfx, cx: number, cy: number, t: number): void {
  const ctx = g.ctx;
  const spikes = 12;
  const layer = (outer: number, inner: number, color: string): void => {
    ctx.beginPath();
    for (let k = 0; k < spikes * 2; k++) {
      const r = k % 2 ? inner : outer + (k % 4 === 0 ? 3 : 0);
      const a = (k / (spikes * 2)) * Math.PI * 2 + t / 200;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  layer(30, 18, '#e02810');
  layer(25, 14, '#ff9000');
  layer(19, 10, '#fff040');
}

type Expression = 'determined' | 'blink' | 'wink' | 'happy' | 'wide' | 'sleep';

const heads = new Map<Expression, HTMLCanvasElement>();

/** Bomberman's face, big: white helmet, pink antenna ball, and a look of his own. */
function bigHead(look: Expression): HTMLCanvasElement {
  const cached = heads.get(look);
  if (cached) return cached;
  const p = new PixelCanvas(40, 36);
  p.rect(19, 2, 2, 5, '#000000');
  p.circle(19.5, 3, 3.4, '#000000');
  p.circle(19.5, 3, 2.6, '#f050a0');
  p.circle(18.5, 2, 0.9, '#ffc0e0');
  p.ellipse(20, 20.5, 18.5, 14.8, '#000000');
  p.ellipse(20, 20.5, 17.5, 13.8, '#c8cce4');
  p.ellipse(19.5, 19.5, 16.5, 12.8, '#ffffff');
  p.ellipse(12, 11.5, 3, 1.6, '#f4f6ff');
  p.roundRect(8, 13, 24, 17, '#000000', 5);
  p.roundRect(9, 14, 22, 15, '#ffc890', 4);
  p.rect(9, 26, 22, 3, '#f0a868');
  const brows = (): void => {
    for (let i = 0; i < 5; i++) {
      p.px(11 + i, 14 + (i >> 1), '#000000');
      p.px(11 + i, 15 + (i >> 1), '#000000');
      p.px(28 - i, 14 + (i >> 1), '#000000');
      p.px(28 - i, 15 + (i >> 1), '#000000');
    }
  };
  const open = (x: number): void => {
    p.roundRect(x, 17, 4, 9, '#000000', 2);
    p.px(x + 1, 18, '#ffffff');
  };
  const shut = (x: number): void => p.rect(x - 1, 21, 6, 2, '#000000');
  switch (look) {
    case 'determined':
      open(13);
      open(23);
      brows();
      break;
    case 'blink':
      shut(13);
      shut(23);
      brows();
      break;
    case 'wink':
      open(13);
      shut(23);
      brows();
      p.rect(24, 25, 4, 1, '#000000');
      p.px(28, 24, '#000000');
      break;
    case 'happy':
      // Eyes screwed up in two arches.
      for (const x of [12, 22]) {
        p.rect(x + 1, 18, 4, 2, '#000000');
        p.rect(x, 20, 2, 4, '#000000');
        p.rect(x + 4, 20, 2, 4, '#000000');
      }
      break;
    case 'wide':
      for (const x of [15, 25]) {
        p.circle(x, 21, 4.2, '#000000');
        p.circle(x, 21, 3.3, '#ffffff');
        p.rect(x, 21, 2, 2, '#000000');
      }
      break;
    case 'sleep':
      // Eyes shut in two U shapes.
      for (const x of [12, 22]) {
        p.rect(x, 18, 2, 4, '#000000');
        p.rect(x + 4, 18, 2, 4, '#000000');
        p.rect(x + 1, 22, 4, 2, '#000000');
      }
      break;
  }
  heads.set(look, p.canvas);
  return p.canvas;
}
