import type { App } from '../../app';
import type { Gfx } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import { encodePassword } from '../../game/campaign/password';
import type { CampaignSession } from '../../game/campaign/session';
import { mix } from '../../engine/gfx';
import { dizzySprite } from '../../gfx/poses';
import { sprites } from '../../gfx/sprites';
import { Menu } from '../../render/ui';
import { goTitle } from '../nav';
import type { NormalFlow } from './flow';
import { MemoryCardScene } from './memoryCard';

/**
 * GAMEOVER: Continue (same stage) / Save / Quit, with the stage password. Bomberman sits
 * seeing stars; on Continue he gets up and dashes off.
 */
export class GameOverScene implements Scene {
  private readonly menu: Menu;
  private readonly password: string;
  private t = 0;
  private leaving: 'continue' | 'quit' | null = null;
  private leaveT = 0;

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
      { label: 'CONTINUE', action: () => this.leave('continue') },
      {
        label: 'SAVE',
        action: () =>
          this.app.scenes.go(new MemoryCardScene(this.app, 'save', this.session.toSave(), () => this.app.scenes.go(new GameOverScene(this.app, this.flow, this.session)))),
        disabled: () => !this.session.cardSave,
      },
      { label: 'QUIT', action: () => this.leave('quit') },
    ]);
  }

  private leave(how: 'continue' | 'quit'): void {
    this.leaving = how;
    this.leaveT = 0;
    if (how === 'quit') this.app.audio.stopMusic(0.6);
  }

  enter(): void {
    this.app.audio.music(this.session.version === 'retro' ? 'gameOverRetro' : 'gameOver', { restart: true });
  }

  update(): void {
    this.t++;
    if (this.leaving) {
      this.leaveT++;
      if (this.leaving === 'continue' && this.leaveT > 60) this.flow.continueGame();
      else if (this.leaving === 'quit' && this.leaveT > 40) goTitle(this.app);
      return;
    }
    if (this.t > 40) this.menu.update();
  }

  render(g: Gfx): void {
    for (let y = 0; y < g.height; y++) g.rect(0, y, g.width, 1, mix('#40e0b8', '#2048e0', y / g.height));
    const drop = Math.min(1, this.t / 40);
    const ty = 26 + Math.round((1 - drop * drop) * -50);
    g.text('GAMEOVER', g.width / 2 + 3, ty + 3, { align: 'center', scale: 3, color: '#1830a0' });
    g.text('GAMEOVER', g.width / 2, ty, { align: 'center', scale: 3, gradient: ['#ffe060', '#f07010'], outline: '#402000' });
    g.ctx.imageSmoothingEnabled = false;
    if (this.leaving === 'continue') {
      // Up on his feet with a determined look, then off at a dash.
      const walk = sprites().bombers[0].walk;
      const k = this.leaveT - 20;
      if (k < 0) g.ctx.drawImage(walk.down[0], 112, 86, 32, 48);
      else g.ctx.drawImage(walk.right[Math.floor(k / 3) % 4], 112 + k * 6, 86, 32, 48);
    } else {
      // Bomberman sits there, seeing stars.
      g.ctx.drawImage(dizzySprite(Math.floor(this.t / 12) % 2), 104, 86, 48, 48);
    }
    if (this.t > 40 && !this.leaving) this.menu.draw(g, 176, 100, { lineH: 14 });
    // The password bar.
    g.rect(28, 186, 200, 20, '#401808');
    g.rect(29, 187, 198, 18, '#f08020');
    g.rect(31, 189, 194, 14, '#ffd070');
    g.rect(31, 189, 194, 1, '#fff4c0');
    g.text('PASSWORD', 40, 193, { gradient: ['#ff6040', '#b01000'], outline: '#401000' });
    g.text(this.password.split('').join(' '), 176, 193, { align: 'center', gradient: ['#ffffff', '#80c0ff'], outline: '#102060' });
  }
}
