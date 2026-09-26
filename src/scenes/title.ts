import type { App } from '../app';
import type { Gfx } from '../engine/gfx';
import type { Scene } from '../engine/scene';
import { CampaignSession } from '../game/campaign/session';
import { sprites } from '../gfx/sprites';
import { startDemo } from './battle/demo';
import { goMainMenu } from './nav';

const DEMO_IDLE_TICKS = 20 * 60;

/** Title screen: tiled logo background, big bouncing Bomberman, PRESS START BUTTON. */
export class TitleScene implements Scene {
  private t = 0;
  /** Ticks without input; the demo starts after 20 seconds. */
  private idle = 0;

  constructor(private readonly app: App) {}

  enter(): void {
    this.app.audio.music('title', { restart: true });
  }

  update(): void {
    this.t++;
    const pad = this.app.input.menu;
    if (this.t > 20 && (pad.pressed('start') || pad.pressed('a'))) {
      this.app.audio.sfx('menuOk');
      pad.swallow();
      goMainMenu(this.app);
      return;
    }
    this.idle = pad.anyPressed() ? 0 : this.idle + 1;
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
    for (const p of pos) if (p.ch !== 'O') for (let d = 4; d >= 1; d--) g.text(p.ch, p.x + d, p.y + d, { scale: s, color: '#0a1034' });
    for (const p of pos) if (p.ch !== 'O') g.text(p.ch, p.x, p.y, { scale: s, color: '#102060', outline: '#102060' });
    for (const p of pos) {
      if (p.ch === 'O') this.drawBombLetter(g, p.x + 10, p.y + 15);
      else g.text(p.ch, p.x, p.y, { scale: s, gradient: ['#ffffff', '#40a0ff'] });
    }
  }

  private drawBombLetter(g: Gfx, cx: number, cy: number): void {
    const disc = (x: number, y: number, r: number, color: string): void => {
      for (let dy = -r; dy <= r; dy++) {
        const w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
        g.rect(x - w, y + dy, w * 2 + 1, 1, color);
      }
    };
    for (let d = 4; d >= 1; d--) disc(cx + d, cy + d, 13, '#0a1034');
    disc(cx, cy, 13, '#102060');
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
    // Diagonally scrolling tiles of little bombs.
    g.clear('#f8a820');
    const off = (this.t >> 1) % 32;
    const bomb = sprites().bomb[1];
    for (let y = -32; y < g.height + 32; y += 32) {
      for (let x = -32; x < g.width + 32; x += 32) {
        const cx = x + off + ((y / 32) % 2 ? 16 : 0);
        const cy = y + off;
        g.ctx.globalAlpha = 0.18;
        g.image(bomb, cx, cy);
        g.ctx.globalAlpha = 1;
      }
    }
    for (let y = 0; y < g.height; y++) {
      g.ctx.globalAlpha = 0.35 * (y / g.height);
      g.rect(0, y, g.width, 1, '#c03000');
    }
    g.ctx.globalAlpha = 1;

    // Big Bomberman, scaled up pixel-perfectly, bobbing.
    const sp = sprites().bombers[0];
    const frame = sp.walk.down[Math.floor(this.t / 14) % 4];
    const bob = Math.round(Math.sin(this.t / 16) * 3);
    g.ctx.imageSmoothingEnabled = false;
    g.ctx.drawImage(frame, g.width / 2 - 32, 64 + bob, 64, 96);

    this.drawLogo(g, g.width / 2, 12);

    if (Math.floor(this.t / 30) % 2 === 0 || this.t < 30) {
      g.text('PRESS START BUTTON', g.width / 2, 172, { align: 'center', color: '#ffffff', outline: '#401000' });
    }
    const top = CampaignSession.topScore();
    g.text(`TOP ${top}`, g.width / 2, 188, { align: 'center', color: '#fff0a0', outline: '#401000' });
    g.text('FAN REMAKE - NOT AN OFFICIAL PRODUCT', g.width / 2, 210, { align: 'center', color: '#ffe0c0', outline: '#401000' });
  }
}
