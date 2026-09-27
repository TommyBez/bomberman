import type { App } from '../app';
import type { Gfx } from '../engine/gfx';
import type { Scene } from '../engine/scene';
import { CampaignSession } from '../game/campaign/session';
import { drawHand, drawMenuBackdrop, drawMenuWindow, drawWindow, Menu, MENU_TEXT } from '../render/ui';
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
        { label: 'NEW GAME', action: () => app.scenes.go(new VersionSelectScene(app)) },
        { label: 'CONTINUE', action: () => app.scenes.go(new ContinueFromScene(app)) },
      ],
      () => goMainMenu(app, 0),
    );
  }

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawMenuWindow(g, 'NORMAL GAME', this.menu, { style: 'card' });
  }
}

/** "Which version?": Modern or Retro, then the memory card question. */
class VersionSelectScene implements Scene {
  private readonly menu: Menu;

  constructor(private readonly app: App) {
    this.menu = new Menu(
      app,
      [
        { label: 'MODERN', action: () => app.scenes.go(new SaveQuestionScene(app, 'modern')) },
        { label: 'RETRO', action: () => app.scenes.go(new SaveQuestionScene(app, 'retro')) },
      ],
      () => app.scenes.go(new NormalMenuScene(app)),
    );
  }

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawMenuWindow(g, 'SELECT VERSION', this.menu);
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
    // YES and NO sit side by side.
    const pad = this.app.input.menu;
    if (pad.repeat('left') || pad.repeat('right')) {
      this.menu.index = 1 - this.menu.index;
      this.app.audio.sfx('menuMove');
    }
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawWindow(g, 'MEMORY CARD CHECK', 14, 58, 228, 112, 'card');
    const lines = ['TO SAVE THIS GAME YOU NEED', 'A MEMORY CARD (THIS BROWSER).', 'SAVE THIS GAME?'];
    lines.forEach((l, i) => g.text(l, g.width / 2, 80 + i * 14, { align: 'center', ...MENU_TEXT }));
    this.menu.items.forEach((it, i) => {
      const x = 96 + i * 64;
      g.text(it.label, x, 142, MENU_TEXT);
      if (i === this.menu.index) drawHand(g, x - 16, 141, this.app.frame);
    });
  }
}

/** "Continue from:" PASSWORD / MEMORY CARD. */
class ContinueFromScene implements Scene {
  private readonly menu: Menu;

  constructor(private readonly app: App) {
    this.menu = new Menu(
      app,
      [
        { label: 'PASSWORD', action: () => app.scenes.go(new PasswordScene(app, () => app.scenes.go(new ContinueFromScene(app)))) },
        {
          label: 'MEMORY CARD',
          action: () =>
            app.scenes.go(
              new MemoryCardScene(app, 'load', null, () => app.scenes.go(new ContinueFromScene(app)), (d) => startNormalGame(app, CampaignSession.fromSave(d))),
            ),
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
    drawMenuWindow(g, 'CONTINUE FROM:', this.menu, { style: 'option' });
  }
}
