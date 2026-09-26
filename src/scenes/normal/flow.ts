import type { App } from '../../app';
import type { CampaignWorld } from '../../game/campaign/campaignWorld';
import { CampaignSession } from '../../game/campaign/session';
import { goTitle } from '../nav';
import { EndingScene } from './ending';
import { GameOverScene } from './gameOver';
import { ShowTimeScene } from './showTime';
import { StageScene, type StageExit } from './stage';

/**
 * Sequencing of the Normal Game:
 * stage → (bonus stage) → (Bomberman Show Time) → next stage … → ending,
 * with misses restarting the stage and Game Over offering Continue / Save / Quit.
 */
export class NormalFlow {
  constructor(
    private readonly app: App,
    readonly session: CampaignSession,
  ) {}

  start(): void {
    this.playStage();
  }

  private playStage(): void {
    this.app.scenes.go(new StageScene(this.app, this.session, null, (exit, world) => this.afterStage(exit, world)));
  }

  private playBonus(): void {
    const bonus = this.session.pendingBonus;
    this.session.pendingBonus = null;
    if (!bonus) {
      this.afterBonus();
      return;
    }
    this.app.scenes.go(
      new StageScene(this.app, this.session, bonus, (exit, world) => {
        this.session.score += world.score;
        CampaignSession.saveTop(this.session.score);
        if (exit === 'quit') {
          goTitle(this.app);
          return;
        }
        this.afterBonus();
      }),
    );
  }

  private afterBonus(): void {
    const show = this.session.pendingShow;
    if (show) {
      this.session.pendingShow = 0;
      this.app.scenes.go(new ShowTimeScene(this.app, show / 10, () => this.playStage()));
      return;
    }
    this.playStage();
  }

  private afterStage(exit: StageExit, world: CampaignWorld): void {
    this.session.score += world.score;
    CampaignSession.saveTop(this.session.score);
    if (exit === 'quit') {
      goTitle(this.app);
      return;
    }
    if (exit === 'dead') {
      if (this.session.loseLife(world.powers())) this.playStage();
      else this.app.scenes.go(new GameOverScene(this.app, this, this.session));
      return;
    }
    // Cleared.
    const wasFinal = this.session.finalStage;
    this.session.clearStage(world.powers());
    if (wasFinal) {
      this.app.scenes.go(new EndingScene(this.app, this.session));
      return;
    }
    if (this.session.pendingBonus) this.playBonus();
    else this.afterBonus();
  }

  /** Game Over → Continue. */
  continueGame(): void {
    this.session.continueGame();
    this.playStage();
  }
}

export function startNormalGame(app: App, session: CampaignSession): void {
  new NormalFlow(app, session).start();
}
