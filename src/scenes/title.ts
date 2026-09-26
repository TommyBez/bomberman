import type { App } from '../app';
import { mix, type Gfx } from '../engine/gfx';
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

    // Logo
    const drop = Math.min(1, this.t / 30);
    const ly = 10 + Math.round((1 - drop) * -50);
    g.text('BOMBERMAN', g.width / 2 + 3, ly + 3, { align: 'center', scale: 4, color: '#401000' });
    g.text('BOMBERMAN', g.width / 2, ly, { align: 'center', scale: 4, gradient: ['#ffffff', '#40a0ff'], outline: '#102060' });
    g.rect(g.width / 2 - 70, ly + 32, 140, 2, mix('#102060', '#ffffff', 0.3));

    if (Math.floor(this.t / 30) % 2 === 0 || this.t < 30) {
      g.text('PRESS START BUTTON', g.width / 2, 172, { align: 'center', color: '#ffffff', outline: '#401000' });
    }
    const top = CampaignSession.topScore();
    g.text(`TOP ${top}`, g.width / 2, 188, { align: 'center', color: '#fff0a0', outline: '#401000' });
    g.text('FAN REMAKE - NOT AN OFFICIAL PRODUCT', g.width / 2, 210, { align: 'center', color: '#ffe0c0', outline: '#401000' });
  }
}
