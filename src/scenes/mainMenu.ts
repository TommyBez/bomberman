import type { App } from '../app';
import type { Gfx } from '../engine/gfx';
import type { Scene } from '../engine/scene';
import { CampaignSession } from '../game/campaign/session';
import { sprites } from '../gfx/sprites';
import { drawMenuBackdrop, drawPanel, drawTitleBar, Menu } from '../render/ui';
import { BattleSetup } from './battle/setup';
import { goMainMenu, goTitle } from './nav';
import { startNormalGame } from './normal/flow';
import { MemoryCardScene } from './normal/memoryCard';
import { PasswordScene } from './normal/password';
import { OptionScene } from './option';

/** NORMAL GAME / BATTLE GAME / OPTION. */
export class MainMenuScene implements Scene {
  private readonly menu: Menu;

  constructor(
    private readonly app: App,
    index = 0,
  ) {
    this.menu = new Menu(
      app,
      [
        { label: 'NORMAL GAME', action: () => app.scenes.go(new NormalMenuScene(app)), help: 'THE CLASSIC 50-STAGE GAME (1 PLAYER)' },
        { label: 'BATTLE GAME', action: () => new BattleSetup(app).start(), help: 'UP TO 5 PLAYERS BATTLE IT OUT' },
        { label: 'OPTION', action: () => app.scenes.go(new OptionScene(app)), help: 'PASSWORD, SOUND, SCREEN, CONTROLS' },
      ],
      () => goTitle(app),
    );
    this.menu.index = index;
  }

  enter(): void {
    this.app.audio.music('title');
  }

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'BOMBERMAN', this.app.frame);
    drawPanel(g, 58, 70, 140, 70);
    this.menu.draw(g, 128, 84, { center: true, lineH: 18, width: 100 });
    const sp = sprites().bombers;
    const f = Math.floor(this.app.frame / 8) % 4;
    g.image(sp[0].walk.right[f], 24, 150);
    g.image(sp[1].walk.left[f], 216, 150);
  }
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

/** "Select Version": Modern or Retro. */
class VersionSelectScene implements Scene {
  private sel = 0;
  private checking = -1;

  constructor(private readonly app: App) {}

  update(): void {
    const pad = this.app.input.menu;
    if (this.checking >= 0) {
      this.checking++;
      if (this.checking > 70 || pad.pressed('a') || pad.pressed('start')) {
        pad.swallow();
        startNormalGame(this.app, new CampaignSession(this.sel === 0 ? 'modern' : 'retro'));
      }
      return;
    }
    if (pad.repeat('left') || pad.repeat('right')) {
      this.sel = 1 - this.sel;
      this.app.audio.sfx('menuMove');
    } else if (pad.pressed('a') || pad.pressed('start')) {
      pad.swallow();
      this.app.audio.sfx('menuOk');
      this.app.audio.stopMusic(0.3);
      this.checking = 0;
    } else if (pad.pressed('b') || pad.pressed('select')) {
      pad.swallow();
      this.app.audio.sfx('menuBack');
      this.app.scenes.go(new NormalMenuScene(this.app));
    }
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'SELECT VERSION', this.app.frame);
    if (this.checking >= 0) {
      drawPanel(g, 40, 90, 176, 40, '#303030', '#101010');
      g.text('CHECKING MEMORY CARD...', g.width / 2, 106, { align: 'center', color: '#ffffff', outline: '#000000' });
      return;
    }
    const sp = sprites();
    const boxes: [string, string, boolean][] = [
      ['MODERN', 'NEW GRAPHICS & MUSIC', false],
      ['RETRO', 'THE CLASSIC 1985 LOOK', true],
    ];
    boxes.forEach(([name, sub, retro], i) => {
      const x = 16 + i * 120;
      const sel = i === this.sel;
      drawPanel(g, x, 44, 104, 136, sel ? '#4868e0' : '#28305c', sel ? '#162070' : '#0c1030');
      g.text(name, x + 52, 52, { align: 'center', scale: 2, color: sel ? '#ffe040' : '#ffffff', outline: '#000000' });
      // little preview of the look
      const tiles = retro ? sp.tiles.retro : sp.tiles.m1;
      for (let yy = 0; yy < 4; yy++) {
        for (let xx = 0; xx < 5; xx++) {
          const img = yy === 0 || xx === 0 || xx === 4 ? tiles.walls[0] : (xx + yy) % 2 === 0 ? tiles.hard : (xx * yy) % 3 === 0 ? tiles.soft : tiles.floor;
          g.image(img, x + 12 + xx * 16, 76 + yy * 16);
        }
      }
      g.image(sp.bombers[0].walk.down[Math.floor(this.app.frame / 8) % 4], x + 28, 92);
      g.text(sub, x + 52, 150, { align: 'center', color: '#c8d0ff', outline: '#000000' });
      if (sel && Math.floor(this.app.frame / 10) % 2 === 0) g.text('▶', x + 6, 56, { color: '#ffe040', outline: '#000000' });
    });
    g.text('← → CHOOSE   A: START   B: BACK', g.width / 2, 200, { align: 'center', color: '#c8d0ff', outline: '#000000' });
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
