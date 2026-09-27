import type { App } from '../app';
import type { Gfx } from '../engine/gfx';
import type { Scene } from '../engine/scene';
import { SONGS } from '../audio/songs';
import { SFX } from '../audio/sfx';
import { PAD_LAYOUTS } from '../engine/input';
import { drawHand, drawMenuBackdrop, drawMenuWindow, drawWindow, Menu, MENU_TEXT, MENU_VALUE, type MenuItem } from '../render/ui';
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
        { label: 'PASSWORD', action: () => app.scenes.go(new PasswordScene(app, () => app.scenes.go(new OptionScene(app)))) },
        { label: 'SOUND OPTIONS', action: () => app.scenes.go(new SoundScene(app)) },
        { label: 'SCREEN OPTIONS', action: () => app.scenes.go(new ScreenScene(app)) },
        { label: 'CONTROLLER', action: () => app.scenes.go(new ControllerScene(app)) },
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
    drawMenuWindow(g, 'OPTION', this.menu, { lineH: 24, style: 'option' });
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
          label: 'AUDIO',
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
          value: () => String(this.song).padStart(2, '0'),
          change: (d) => (this.song = (this.song + d + SONG_LIST.length) % SONG_LIST.length),
          action: () => a.music(SONG_LIST[this.song], { restart: true }),
        },
        {
          label: 'SE TEST',
          value: () => String(this.fx).padStart(3, '0'),
          change: (d) => (this.fx = (this.fx + d + SFX_LIST.length) % SFX_LIST.length),
          action: () => a.sfx(SFX_LIST[this.fx]),
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
    drawMenuWindow(g, 'SOUND OPTION', this.menu, { lineH: 22, valueX: 186, style: 'option' });
  }
}

/**
 * SCREEN OPTIONS: a banner along the very top edge of the picture, and a choice to move the
 * picture up or down until all of it can be read.
 */
class ScreenScene implements Scene {
  private settings = loadSettings();
  private row = 0;

  constructor(private readonly app: App) {}

  update(): void {
    const pad = this.app.input.menu;
    if (pad.repeat('up') || pad.repeat('down')) {
      this.row = 1 - this.row;
      this.app.audio.sfx('menuMove');
    }
    if (pad.repeat('a')) {
      const y = Math.max(-16, Math.min(16, this.settings.offsetY + (this.row === 0 ? -1 : 1)));
      if (y !== this.settings.offsetY) {
        this.settings.offsetY = y;
        applyScreenOffset(y);
        this.app.audio.sfx('select');
      }
    } else if (pad.pressed('b') || pad.pressed('d') || pad.pressed('start') || pad.pressed('select')) {
      pad.swallow();
      saveSettings(this.settings);
      this.app.audio.sfx('menuBack');
      this.app.scenes.go(new OptionScene(this.app));
    }
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawReadBanner(g);
    drawWindow(g, 'SCREEN OPTIONS', 14, 46, 228, 158, 'option');
    const text = { align: 'center' as const, ...MENU_TEXT };
    g.text('PLEASE ADJUST THE', g.width / 2, 74, text);
    g.text('STATUS DISPLAY.', g.width / 2, 88, text);
    ['MOVE DISPLAY UP', 'MOVE DISPLAY DOWN'].forEach((label, i) => {
      const y = 126 + i * 24;
      g.text(label, 72, y, MENU_TEXT);
      if (i === this.row) drawHand(g, 56, y - 1, this.app.frame);
    });
  }
}

/** The red-lettered scroll along the top edge of the screen options. */
function drawReadBanner(g: Gfx): void {
  const x = 20;
  const w = g.width - 40;
  const y = 1;
  const h = 15;
  // Rolled ends, then the paper between them.
  for (const ex of [x - 6, x + w]) {
    g.rect(ex, y + 1, 6, h - 2, '#a04010');
    g.rect(ex + 1, y + 2, 4, h - 4, '#f09838');
    g.rect(ex + 2, y + 3, 1, h - 6, '#ffd890');
  }
  g.rect(x, y, w, h, '#803008');
  for (let i = 1; i < h - 1; i++) g.rect(x, y + i, w, 1, i < 3 ? '#fff0c8' : i > h - 4 ? '#f0b060' : '#ffdc98');
  g.text('● CAN YOU READ THIS? ●', g.width / 2, y + 4, { align: 'center', color: '#e02010', outline: '#fff8e8' });
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
        },
        { label: 'KEYBOARD', action: () => (this.keys = true) },
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
    if (this.keys) return this.renderKeys(g);
    drawWindow(g, 'CONTROLLER OPTIONS', 12, 22, 232, 136);
    this.menu.draw(g, 30, 42, { lineH: 16, valueX: 128 });
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
      g.text('A BOMB  B SPECIAL  C PUNCH  D STOP', g.width / 2, 174, { align: 'center', ...MENU_TEXT });
    }
  }

  private renderKeys(g: Gfx): void {
    drawWindow(g, 'CONTROLLER OPTIONS', 8, 22, 240, 190);
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
      const y = 44 + i * 15;
      g.text(a, 18, y, { color: b ? MENU_TEXT.color : MENU_VALUE, outline: MENU_TEXT.outline });
      if (b) g.text(b, 238, y, { color: MENU_VALUE, outline: MENU_TEXT.outline, align: 'right' });
    });
  }
}
