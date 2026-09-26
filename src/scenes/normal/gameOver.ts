import type { App } from '../../app';
import type { Gfx } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import { encodePassword } from '../../game/campaign/password';
import type { CampaignSession } from '../../game/campaign/session';
import { sprites } from '../../gfx/sprites';
import { drawPanel, Menu } from '../../render/ui';
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
      { label: 'CONTINUE', action: () => this.flow.continueGame(), help: 'RESTART THIS STAGE' },
      {
        label: 'SAVE',
        action: () =>
          this.app.scenes.go(new MemoryCardScene(this.app, 'save', this.session.toSave(), () => this.app.scenes.go(new GameOverScene(this.app, this.flow, this.session)))),
        help: 'SAVE TO THE MEMORY CARD',
      },
      { label: 'QUIT', action: () => goTitle(this.app), help: 'BACK TO THE TITLE SCREEN' },
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
    g.clear('#000000');
    const drop = Math.min(1, this.t / 40);
    g.text('GAME OVER', g.width / 2, 24 + (1 - drop) * -30, { align: 'center', scale: 3, gradient: ['#ff8080', '#a00000'], outline: '#200000' });
    const sp = sprites().bombers[0];
    const f = Math.min(sp.death.length - 1, 4 + (Math.floor(this.t / 20) % 2));
    g.image(sp.death[f], g.width / 2 - 8, 60);
    drawPanel(g, 48, 92, 160, 52, '#402020', '#180808');
    g.text('PASSWORD', g.width / 2, 100, { align: 'center', color: '#ffb0b0', outline: '#000000' });
    g.text(this.password, g.width / 2, 116, { align: 'center', scale: 2, color: '#ffffff', outline: '#000000' });
    g.text(`STAGE ${this.session.stageNumber}`, g.width / 2, 133, { align: 'center', color: '#c0a0a0' });
    if (this.t > 40) this.menu.draw(g, g.width / 2, 156, { center: true, lineH: 14, width: 90 });
  }
}
