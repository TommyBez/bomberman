import type { App } from '../app';
import type { Gfx } from '../engine/gfx';
import type { Scene } from '../engine/scene';
import { CampaignSession } from '../game/campaign/session';
import { drawMenuBackdrop, drawPanel, drawTitleBar, Menu } from '../render/ui';
import { goMainMenu } from './nav';
import { startNormalGame } from './normal/flow';
import { MemoryCardScene } from './normal/memoryCard';
import { PasswordScene } from './normal/password';

/** NORMAL GAME from the title's mode menu. */
export function openNormalGame(app: App): void {
  app.scenes.go(new NormalMenuScene(app));
}

/** NORMAL GAME → NEW GAME / CONTINUE. */
class NormalMenuScene implements Scene {
  private readonly menu: Menu;

  constructor(private readonly app: App) {
    this.menu = new Menu(
      app,
      [
        { label: 'NEW GAME', action: () => app.scenes.go(new VersionSelectScene(app)), help: 'START FROM STAGE 1' },
        { label: 'CONTINUE', action: () => app.scenes.go(new ContinueFromScene(app)), help: 'PASSWORD OR MEMORY CARD' },
      ],
      () => goMainMenu(app, 0),
    );
  }

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'NORMAL GAME', this.app.frame);
    drawPanel(g, 58, 80, 140, 52);
    this.menu.draw(g, 128, 94, { center: true, lineH: 18, width: 100 });
  }
}

/** "Which version?": Modern or Retro, then the memory card question. */
class VersionSelectScene implements Scene {
  private readonly menu: Menu;

  constructor(private readonly app: App) {
    this.menu = new Menu(
      app,
      [
        { label: 'MODERN', action: () => app.scenes.go(new SaveQuestionScene(app, 'modern')), help: 'NEW LOOK AND MUSIC, SHOW TIME SKITS' },
        { label: 'RETRO', action: () => app.scenes.go(new SaveQuestionScene(app, 'retro')), help: 'THE CLASSIC 1985 LOOK AND SOUND' },
      ],
      () => app.scenes.go(new NormalMenuScene(app)),
    );
  }

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawPanel(g, 40, 64, 176, 76, '#503080', '#281040');
    drawTitleBar(g, 'WHICH VERSION?', this.app.frame);
    this.menu.draw(g, 104, 88, { lineH: 20 });
  }
}

/** "To save this game you need a memory card. Save?" YES / NO, then the game starts. */
class SaveQuestionScene implements Scene {
  private readonly menu: Menu;

  constructor(
    private readonly app: App,
    version: 'modern' | 'retro',
  ) {
    const start = (save: boolean): void => {
      this.app.audio.stopMusic(0.3);
      const s = new CampaignSession(version);
      s.cardSave = save;
      startNormalGame(this.app, s);
    };
    this.menu = new Menu(
      app,
      [
        { label: 'YES', action: () => start(true) },
        { label: 'NO', action: () => start(false) },
      ],
      () => app.scenes.go(new VersionSelectScene(app)),
    );
  }

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawPanel(g, 20, 56, 216, 112, '#503080', '#281040');
    drawTitleBar(g, 'MEMORY CARD CHECK', this.app.frame);
    const lines = ['TO SAVE THIS GAME YOU NEED', 'A MEMORY CARD (THIS BROWSER).', 'SAVE THIS GAME?'];
    lines.forEach((l, i) => g.text(l, 36, 72 + i * 13, { color: '#ffffff', outline: '#000000' }));
    this.menu.draw(g, 72, 128, { lineH: 16 });
  }
}

/** "Continue from:" PASSWORD / MEMORY CARD. */
class ContinueFromScene implements Scene {
  private readonly menu: Menu;

  constructor(private readonly app: App) {
    this.menu = new Menu(
      app,
      [
        { label: 'PASSWORD', action: () => app.scenes.go(new PasswordScene(app, () => app.scenes.go(new ContinueFromScene(app)))), help: 'ENTER YOUR 8-CHARACTER PASSWORD' },
        {
          label: 'MEMORY CARD',
          action: () =>
            app.scenes.go(
              new MemoryCardScene(app, 'load', null, () => app.scenes.go(new ContinueFromScene(app)), (d) => startNormalGame(app, CampaignSession.fromSave(d))),
            ),
          help: 'LOAD A SAVED GAME',
        },
      ],
      () => app.scenes.go(new NormalMenuScene(app)),
    );
  }

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'CONTINUE FROM:', this.app.frame);
    drawPanel(g, 58, 80, 140, 52);
    this.menu.draw(g, 128, 94, { center: true, lineH: 18, width: 110 });
  }
}
