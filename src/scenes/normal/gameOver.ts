import type { App } from '../../app';
import type { Gfx } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import { encodePassword } from '../../game/campaign/password';
import type { CampaignSession } from '../../game/campaign/session';
import { mix } from '../../engine/gfx';
import { PixelCanvas } from '../../gfx/pixel';
import { Menu } from '../../render/ui';
import { goTitle } from '../nav';
import type { NormalFlow } from './flow';
import { MemoryCardScene } from './memoryCard';

/** GAME OVER: Continue (same stage) / Save / Quit, with the stage password. */
export class GameOverScene implements Scene {
  private readonly menu: Menu;
  private readonly password: string;
  private t = 0;

  constructor(
    private readonly app: App,
    private readonly flow: NormalFlow,
    private readonly session: CampaignSession,
  ) {
    this.password = encodePassword({
      stage: session.stageNumber,
      bombs: session.powers.bombs,
      fire: session.powers.fire,
      modern: session.version === 'modern',
    });
    this.menu = new Menu(app, [
      { label: 'CONTINUE', action: () => this.flow.continueGame() },
      {
        label: 'SAVE',
        action: () =>
          this.app.scenes.go(new MemoryCardScene(this.app, 'save', this.session.toSave(), () => this.app.scenes.go(new GameOverScene(this.app, this.flow, this.session)))),
        disabled: () => !this.session.cardSave,
      },
      { label: 'QUIT', action: () => goTitle(this.app) },
    ]);
  }

  enter(): void {
    this.app.audio.music(this.session.version === 'retro' ? 'gameOverRetro' : 'gameOver', { restart: true });
  }

  update(): void {
    this.t++;
    if (this.t > 40) this.menu.update();
  }

  render(g: Gfx): void {
    for (let y = 0; y < g.height; y++) g.rect(0, y, g.width, 1, mix('#40e0b8', '#2048e0', y / g.height));
    const drop = Math.min(1, this.t / 40);
    const ty = 26 + Math.round((1 - drop * drop) * -50);
    g.text('GAME OVER', g.width / 2 + 3, ty + 3, { align: 'center', scale: 3, color: '#1830a0' });
    g.text('GAME OVER', g.width / 2, ty, { align: 'center', scale: 3, gradient: ['#ffe060', '#f07010'], outline: '#402000' });
    // Bomberman sits there, seeing stars.
    g.ctx.imageSmoothingEnabled = false;
    g.ctx.drawImage(dizzySprite(Math.floor(this.t / 12) % 2), 104, 86, 48, 48);
    if (this.t > 40) this.menu.draw(g, 176, 100, { lineH: 14 });
    // The password bar.
    g.rect(28, 186, 200, 20, '#401808');
    g.rect(29, 187, 198, 18, '#f08020');
    g.rect(31, 189, 194, 14, '#ffd070');
    g.rect(31, 189, 194, 1, '#fff4c0');
    g.text('PASSWORD', 40, 193, { gradient: ['#ff6040', '#b01000'], outline: '#401000' });
    g.text(this.password.split('').join(' '), 176, 193, { align: 'center', gradient: ['#ffffff', '#80c0ff'], outline: '#102060' });
  }
}

let dizzy: HTMLCanvasElement[] | null = null;

/** Bomberman sitting on the floor with swirling eyes (two frames). */
function dizzySprite(frame: number): HTMLCanvasElement {
  if (!dizzy) {
    dizzy = [0, 1].map((f) => {
      const p = new PixelCanvas(24, 24);
      // Feet stuck out in front, body, arms.
      p.ellipse(5.5, 20, 4.5, 3.2, '#000000');
      p.ellipse(18.5, 20, 4.5, 3.2, '#000000');
      p.ellipse(5.5, 19.6, 3.6, 2.4, '#f050a0');
      p.ellipse(18.5, 19.6, 3.6, 2.4, '#f050a0');
      p.ellipse(4.5, 18.8, 1.5, 0.8, '#ffb0d8');
      p.ellipse(17.5, 18.8, 1.5, 0.8, '#ffb0d8');
      p.rect(8, 15, 8, 6, '#000000');
      p.rect(9, 15, 6, 5, '#3060e0');
      p.rect(9, 19, 6, 1, '#202020');
      p.circle(6.5, 16, 2.2, '#000000');
      p.circle(17.5, 16, 2.2, '#000000');
      p.circle(6.5, 16, 1.4, '#f050a0');
      p.circle(17.5, 16, 1.4, '#f050a0');
      // Head, antenna, face.
      p.rect(11, 1, 2, 3, '#000000');
      p.circle(12, 1.5, 1.6, '#f050a0');
      p.roundRect(3, 3, 18, 13, '#000000', 5);
      p.roundRect(4, 4, 16, 11, '#ffffff', 4);
      p.roundRect(6, 6, 12, 8, '#000000', 2);
      p.roundRect(7, 7, 10, 6, '#ffc890', 2);
      // Swirling eyes (the spiral turns between frames).
      const spiral = f ? ['.aaa', 'a...', 'a.a.', 'aaa.'] : ['aaa.', '...a', '.a.a', '.aaa'];
      p.rows(spiral, { a: '#803010' }, 7, 8);
      p.rows(spiral, { a: '#803010' }, 13, 8);
      return p.canvas;
    });
  }
  return dizzy[frame % 2];
}
