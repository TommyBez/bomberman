import type { App } from '../app';
import type { Gfx } from '../engine/gfx';
import type { Scene } from '../engine/scene';
import { SONGS } from '../audio/songs';
import { SFX } from '../audio/sfx';
import { drawMenuBackdrop, drawPanel, drawTitleBar, Menu } from '../render/ui';
import { applyScreenOffset, loadSettings, saveSettings } from '../settings';
import { goMainMenu } from './nav';
import { PasswordScene } from './normal/password';

const SONG_LIST = Object.keys(SONGS);
const SFX_LIST = Object.keys(SFX);

/** OPTION: Password / Sound / Screen / Controller. */
export class OptionScene implements Scene {
  private readonly menu: Menu;

  constructor(private readonly app: App) {
    this.menu = new Menu(
      app,
      [
        { label: 'PASSWORD', action: () => app.scenes.go(new PasswordScene(app, () => app.scenes.go(new OptionScene(app)))), help: 'CONTINUE A NORMAL GAME' },
        { label: 'SOUND OPTIONS', action: () => app.scenes.go(new SoundScene(app)), help: 'VOLUME, MUSIC TEST, SOUND TEST' },
        { label: 'SCREEN OPTIONS', action: () => app.scenes.go(new ScreenScene(app)), help: 'ADJUST THE SCREEN POSITION' },
        { label: 'CONTROLLER', action: () => app.scenes.go(new ControllerScene(app)), help: 'CONTROLS FOR ALL PLAYERS' },
        { label: 'EXIT', action: () => goMainMenu(app, 2) },
      ],
      () => goMainMenu(app, 2),
    );
  }

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'OPTION', this.app.frame);
    drawPanel(g, 48, 50, 160, 104);
    this.menu.draw(g, 128, 62, { center: true, lineH: 18, width: 120 });
  }
}

class SoundScene implements Scene {
  private readonly menu: Menu;
  private song = 0;
  private fx = 0;
  private settings = loadSettings();

  constructor(private readonly app: App) {
    const a = app.audio;
    this.menu = new Menu(
      app,
      [
        {
          label: 'OUTPUT',
          value: () => (this.settings.stereo ? 'STEREO' : 'MONO'),
          change: () => {
            this.settings.stereo = !this.settings.stereo;
            saveSettings(this.settings);
            a.setStereo(this.settings.stereo);
          },
        },
        {
          label: 'MUSIC VOLUME',
          value: () => String(a.settings.music),
          change: (d) => {
            a.settings.music = Math.max(0, Math.min(10, a.settings.music + d));
            a.applyVolumes();
          },
        },
        {
          label: 'SE VOLUME',
          value: () => String(a.settings.sfx),
          change: (d) => {
            a.settings.sfx = Math.max(0, Math.min(10, a.settings.sfx + d));
            a.applyVolumes();
            a.sfx('place');
          },
        },
        {
          label: 'MUSIC TEST',
          value: () => SONG_LIST[this.song].toUpperCase(),
          change: (d) => (this.song = (this.song + d + SONG_LIST.length) % SONG_LIST.length),
          action: () => a.music(SONG_LIST[this.song], { restart: true }),
          help: 'A: PLAY',
        },
        {
          label: 'SE TEST',
          value: () => SFX_LIST[this.fx].toUpperCase(),
          change: (d) => (this.fx = (this.fx + d + SFX_LIST.length) % SFX_LIST.length),
          action: () => a.sfx(SFX_LIST[this.fx]),
          help: 'A: PLAY',
        },
        { label: 'EXIT', action: () => this.leave() },
      ],
      () => this.leave(),
    );
  }

  private leave(): void {
    this.app.audio.music('title');
    this.app.scenes.go(new OptionScene(this.app));
  }

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'SOUND OPTIONS', this.app.frame);
    drawPanel(g, 16, 44, 224, 124);
    this.menu.draw(g, 34, 56, { lineH: 18, valueX: 176 });
  }
}

class ScreenScene implements Scene {
  private settings = loadSettings();

  constructor(private readonly app: App) {}

  update(): void {
    const pad = this.app.input.menu;
    if (pad.repeat('up')) this.settings.offsetY = Math.max(-16, this.settings.offsetY - 1);
    if (pad.repeat('down')) this.settings.offsetY = Math.min(16, this.settings.offsetY + 1);
    if (pad.pressed('a') || pad.pressed('b') || pad.pressed('start') || pad.pressed('select')) {
      saveSettings(this.settings);
      applyScreenOffset(this.settings.offsetY);
      this.app.audio.sfx('menuOk');
      this.app.scenes.go(new OptionScene(this.app));
    }
    applyScreenOffset(this.settings.offsetY);
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'SCREEN OPTIONS', this.app.frame);
    drawPanel(g, 40, 70, 176, 70);
    g.text('CAN YOU READ THIS?', g.width / 2, 86, { align: 'center', scale: 1, color: '#ffffff', outline: '#000000' });
    g.text(`POSITION ${this.settings.offsetY > 0 ? '+' : ''}${this.settings.offsetY}`, g.width / 2, 106, { align: 'center', color: '#ffe040', outline: '#000000' });
    g.text('↑ ↓ MOVE   A: OK', g.width / 2, 124, { align: 'center', color: '#c8d0ff', outline: '#000000' });
    g.frame(0, 0, g.width, g.height, '#ffe040');
  }
}

class ControllerScene implements Scene {
  private settings = loadSettings();

  constructor(private readonly app: App) {}

  update(): void {
    const pad = this.app.input.menu;
    if (pad.pressed('left') || pad.pressed('right')) {
      this.settings.vibration = !this.settings.vibration;
      saveSettings(this.settings);
      this.app.input.vibration = this.settings.vibration;
      if (this.settings.vibration) this.app.input.rumble(this.app.input.menu.devices, 0.8, 250);
      this.app.audio.sfx('select');
    }
    if (pad.pressed('a') || pad.pressed('b') || pad.pressed('start') || pad.pressed('select')) {
      this.app.audio.sfx('menuOk');
      this.app.scenes.go(new OptionScene(this.app));
    }
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'CONTROLLER', this.app.frame);
    drawPanel(g, 8, 34, 240, 176);
    const lines: [string, string][] = [
      ['ONE PLAYER / MENUS', ''],
      ['MOVE', 'ARROWS / WASD'],
      ['BOMB (A)', 'SPACE / X / J'],
      ['DETONATE (B)', 'Z / SHIFT / K'],
      ['ACTION (C)', 'C / E / Q / L'],
      ['PAUSE', 'ENTER / P'],
      ['BACK', 'ESC / BACKSPACE'],
      ['BATTLE P1', 'WASD SPACE L-SHIFT E'],
      ['BATTLE P2', 'ARROWS ENTER R-SHIFT R-CTRL'],
      ['GAMEPADS', 'A BOMB, B DETONATE, X ACTION'],
      ['TOUCH', 'ON-SCREEN PAD'],
    ];
    lines.forEach(([a, b], i) => {
      const y = 42 + i * 13;
      g.text(a, 16, y, { color: b ? '#ffe040' : '#ffffff', outline: '#000000' });
      if (b) g.text(b, 240, y, { color: '#ffffff', outline: '#000000', align: 'right' });
    });
    g.text(`VIBRATION ← ${this.settings.vibration ? 'ON' : 'OFF'} →`, g.width / 2, 186, { align: 'center', color: '#a8c0ff', outline: '#000000' });
  }
}
