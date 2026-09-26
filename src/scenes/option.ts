import type { App } from '../app';
import type { Gfx } from '../engine/gfx';
import type { Scene } from '../engine/scene';
import { SONGS } from '../audio/songs';
import { SFX } from '../audio/sfx';
import { PAD_LAYOUTS } from '../engine/input';
import { drawMenuBackdrop, drawPanel, drawTitleBar, Menu, type MenuItem } from '../render/ui';
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

/** Colours of the bottom, right, left and top face buttons in the diagram. */
const FACE_COLORS = ['#6080ff', '#ff6060', '#e080ff', '#40c080'];

/** CONTROLLER: a button layout for each gamepad, vibration, and the keyboard keys. */
class ControllerScene implements Scene {
  private settings = loadSettings();
  private readonly menu: Menu;
  private keys = false;

  constructor(private readonly app: App) {
    const input = app.input;
    const layoutItem = (i: number): MenuItem => ({
      label: `PAD ${i + 1}`,
      value: () => PAD_LAYOUTS[this.settings.padLayouts[i]].name,
      change: (d) => {
        this.settings.padLayouts[i] = (this.settings.padLayouts[i] + d + PAD_LAYOUTS.length) % PAD_LAYOUTS.length;
        input.padLayouts = [...this.settings.padLayouts];
        saveSettings(this.settings);
      },
      help: () => (input.connectedPads()[i] ? 'CONNECTED' : 'NOT CONNECTED'),
    });
    this.menu = new Menu(
      app,
      [
        layoutItem(0),
        layoutItem(1),
        layoutItem(2),
        layoutItem(3),
        {
          label: 'VIBRATION',
          value: () => (this.settings.vibration ? 'ON' : 'OFF'),
          change: () => {
            this.settings.vibration = !this.settings.vibration;
            saveSettings(this.settings);
            input.vibration = this.settings.vibration;
            if (this.settings.vibration) input.rumble(input.menu.devices, 0.8, 250);
          },
          help: 'RUMBLES ON EXPLOSIONS AND KNOCK-OUTS',
        },
        { label: 'KEYBOARD', action: () => (this.keys = true), help: 'SHOW THE KEYBOARD CONTROLS' },
        { label: 'EXIT', action: () => this.leave() },
      ],
      () => this.leave(),
    );
  }

  private leave(): void {
    this.app.scenes.go(new OptionScene(this.app));
  }

  update(): void {
    if (this.keys) {
      const pad = this.app.input.menu;
      if (pad.pressed('a') || pad.pressed('b') || pad.pressed('d') || pad.pressed('start') || pad.pressed('select')) {
        pad.swallow();
        this.keys = false;
        this.app.audio.sfx('menuBack');
      }
      return;
    }
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'CONTROLLER', this.app.frame);
    if (this.keys) return this.renderKeys(g);
    drawPanel(g, 12, 34, 232, 126);
    this.menu.draw(g, 26, 44, { lineH: 16, valueX: 128 });
    // The selected gamepad's face buttons (bottom, right, left, top).
    const sel = this.menu.index;
    if (sel <= 3) {
      const layout = PAD_LAYOUTS[this.settings.padLayouts[sel]];
      const cx = 205;
      const cy = 78;
      const pos: [number, number][] = [[0, 15], [15, 0], [-15, 0], [0, -15]];
      layout.face.forEach((fn, k) => {
        const [dx, dy] = pos[k];
        g.rect(cx + dx - 6, cy + dy - 6, 13, 13, '#101830');
        g.rect(cx + dx - 5, cy + dy - 5, 11, 11, FACE_COLORS[k]);
        g.text(fn.toUpperCase(), cx + dx + 1, cy + dy - 3, { align: 'center', color: '#ffffff', outline: '#000000' });
      });
      g.text('A BOMB  B SPECIAL  C PUNCH  D STOP', g.width / 2, 168, { align: 'center', color: '#c8d0ff', outline: '#000000' });
    }
  }

  private renderKeys(g: Gfx): void {
    drawPanel(g, 8, 34, 240, 176);
    const lines: [string, string][] = [
      ['ONE PLAYER / MENUS', ''],
      ['MOVE', 'ARROWS / WASD'],
      ['BOMB (A)', 'SPACE / X / J'],
      ['SPECIAL (B)', 'Z / SHIFT / K'],
      ['PUNCH, PUSH (C)', 'C / E / L'],
      ['STOP KICK (D)', 'Q / V / I'],
      ['PAUSE', 'ENTER / P'],
      ['BACK', 'ESC / BACKSPACE'],
      ['BATTLE P1', 'WASD SPC LSHIFT E Q'],
      ['BATTLE P2', 'ARROWS ENTER RSHIFT RCTRL \''],
      ['TOUCH', 'ON-SCREEN PAD'],
    ];
    lines.forEach(([a, b], i) => {
      const y = 42 + i * 14;
      g.text(a, 16, y, { color: b ? '#ffe040' : '#ffffff', outline: '#000000' });
      if (b) g.text(b, 240, y, { color: '#ffffff', outline: '#000000', align: 'right' });
    });
    g.text('A: BACK', g.width / 2, 198, { align: 'center', color: '#a8c0ff', outline: '#000000' });
  }
}
