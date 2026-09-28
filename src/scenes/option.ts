import type { App } from '../app';
import type { Gfx } from '../engine/gfx';
import type { Scene } from '../engine/scene';
import { SONGS } from '../audio/songs';
import { SFX } from '../audio/sfx';
import type { DeviceId, FaceButton, PadFaces } from '../engine/input';
import { PixelCanvas } from '../gfx/pixel';
import { drawHand, drawMenuBackdrop, drawMenuWindow, drawWindow, Menu, MENU_TEXT, MENU_VALUE } from '../render/ui';
import { applyScreenOffset, loadSettings, saveSettings } from '../settings';
import { CommandsScene } from './commands';
import { goMainMenu } from './nav';
import { PasswordScene } from './normal/password';

const SONG_LIST = Object.keys(SONGS);
const SFX_LIST = Object.keys(SFX);

/** OPTION: Commands / Password / Sound / Screen / Controller. */
export class OptionScene implements Scene {
  private readonly menu: Menu;

  /** `index`: the row to start on (the one a sub-screen was opened from). */
  constructor(
    private readonly app: App,
    index = 0,
  ) {
    this.menu = new Menu(
      app,
      [
        { label: 'COMMANDS', action: () => app.scenes.go(new CommandsScene(app, () => app.scenes.go(new OptionScene(app, 0)))) },
        { label: 'PASSWORD', action: () => app.scenes.go(new PasswordScene(app, () => app.scenes.go(new OptionScene(app, 1)))) },
        { label: 'SOUND OPTIONS', action: () => app.scenes.go(new SoundScene(app)) },
        { label: 'SCREEN OPTIONS', action: () => app.scenes.go(new ScreenScene(app)) },
        { label: 'CONTROLLER', action: () => app.scenes.go(new ControllerScene(app)) },
      ],
      () => goMainMenu(app, 2),
    );
    this.menu.index = index;
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
    // Audio, music test and sound-effect test as in the original; volumes come after them.
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
      ],
      () => this.leave(),
    );
  }

  private leave(): void {
    this.app.audio.music('title');
    this.app.scenes.go(new OptionScene(this.app, 2));
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
    // Up and down move the picture straight away (the glove shows which way); A moves it again.
    let d = 0;
    if (pad.repeat('up')) [this.row, d] = [0, -1];
    else if (pad.repeat('down')) [this.row, d] = [1, 1];
    else if (pad.repeat('a')) d = this.row === 0 ? -1 : 1;
    if (d) {
      const y = Math.max(-16, Math.min(16, this.settings.offsetY + d));
      if (y !== this.settings.offsetY) {
        this.settings.offsetY = y;
        applyScreenOffset(y);
      }
      this.app.audio.sfx('select');
    } else if (pad.pressed('b') || pad.pressed('d') || pad.pressed('start') || pad.pressed('select')) {
      pad.swallow();
      saveSettings(this.settings);
      this.app.audio.sfx('menuBack');
      this.app.scenes.go(new OptionScene(this.app, 3));
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

/** CONTROLLER OPTIONS: a page for each gamepad, and the keyboard commands. */
class ControllerScene implements Scene {
  private readonly menu: Menu;

  constructor(
    private readonly app: App,
    index = 0,
  ) {
    this.menu = new Menu(
      app,
      [
        ...[0, 1, 2, 3].map((i) => ({ label: `CONTROLLER ${i + 1}`, action: () => app.scenes.go(new PadScene(app, i)) })),
        {
          label: 'KEYBOARD',
          action: () => app.scenes.go(new CommandsScene(app, () => app.scenes.go(new ControllerScene(app, 4)), 1)),
        },
      ],
      () => this.leave(),
    );
    this.menu.index = index;
  }

  private leave(): void {
    this.app.scenes.go(new OptionScene(this.app, 4));
  }

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawMenuWindow(g, 'CONTROLLER OPTIONS', this.menu, { lineH: 22 });
  }
}

/** The four functions, in the order the controller page lists them, with their names. */
const FUNCTIONS: [FaceButton, string, string][] = [
  ['a', 'SET BOMB', 'POWER GLOVE'],
  ['b', 'REMOTE CONTROL', 'SPECIAL'],
  ['d', 'KICK STOP', ''],
  ['c', 'PUSH & PUNCH', 'MULTI BOMB'],
];
/** Face buttons in the PlayStation's order: ○ (right), × (bottom), △ (top), □ (left). */
const FACE_ORDER = [1, 0, 3, 2];

/**
 * CONTROLLER n: vibration, and which face button does each function. Moving a function to
 * another button swaps it with the one that was there.
 */
class PadScene implements Scene {
  private settings = loadSettings();
  private row = 0;

  constructor(
    private readonly app: App,
    private readonly pad: number,
  ) {}

  private leave(): void {
    this.app.scenes.go(new ControllerScene(this.app, this.pad));
  }

  private apply(): void {
    saveSettings(this.settings);
    this.app.input.vibration = [...this.settings.vibration];
    this.app.input.padFaces = this.settings.padFaces.map((f) => [...f] as PadFaces);
  }

  update(): void {
    const pad = this.app.input.menu;
    const rows = FUNCTIONS.length + 1;
    if (pad.repeat('up') || pad.repeat('down')) {
      this.row = (this.row + (pad.repeat('up') ? rows - 1 : 1)) % rows;
      this.app.audio.sfx('menuMove');
    }
    const d = pad.repeat('left') ? -1 : pad.repeat('right') || pad.pressed('a') ? 1 : 0;
    if (d) {
      if (this.row === 0) {
        const on = !this.settings.vibration[this.pad];
        this.settings.vibration[this.pad] = on;
        this.apply();
        if (on) this.app.input.rumble([`pad${this.pad}` as DeviceId], 0.8, 250);
      } else {
        const faces = this.settings.padFaces[this.pad];
        const fn = FUNCTIONS[this.row - 1][0];
        const from = faces.indexOf(fn);
        const to = FACE_ORDER[(FACE_ORDER.indexOf(from) + d + 4) % 4];
        [faces[from], faces[to]] = [faces[to], faces[from]];
        this.apply();
      }
      this.app.audio.sfx('select');
    } else if (pad.pressed('b') || pad.pressed('d') || pad.pressed('start') || pad.pressed('select')) {
      pad.swallow();
      this.app.audio.sfx('menuBack');
      this.leave();
    }
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawWindow(g, `CONTROLLER ${this.pad + 1}`, 14, 24, 228, 184, 'option');
    const cursor = (y: number): void => drawHand(g, 26, y, this.app.frame);
    g.text('VIBRATION', 46, 44, MENU_TEXT);
    g.text(this.settings.vibration[this.pad] ? 'ON' : 'OFF', 196, 44, { align: 'center', color: MENU_VALUE, outline: MENU_TEXT.outline });
    if (this.row === 0) cursor(43);
    const faces = this.settings.padFaces[this.pad];
    FUNCTIONS.forEach(([fn, line1, line2], k) => {
      const y = 62 + k * 34;
      drawPennant(g, 42, y, 136, 26);
      const ink = { color: '#503010' };
      if (line2) {
        g.text(line1, 50, y + 5, ink);
        g.text(line2, 58, y + 14, ink);
      } else g.text(line1, 50, y + 10, ink);
      g.image(faceIcon(faces.indexOf(fn)), 188, y + 5);
      if (this.row === k + 1) cursor(y + 9);
    });
  }
}

/** A yellow label with a pointed right end, like the original's function tags. */
function drawPennant(g: Gfx, x: number, y: number, w: number, h: number): void {
  const tip = 10;
  for (let i = 0; i < h; i++) {
    const inset = Math.round(Math.abs(i - (h - 1) / 2) * (tip / (h / 2)));
    g.rect(x, y + i, w - inset, 1, '#6a4a10');
    if (i > 0 && i < h - 1) g.rect(x + 1, y + i, w - inset - 2, 1, i < 3 ? '#fff4a0' : i > h - 5 ? '#e0b830' : '#f8dc58');
  }
}

/** Colours and symbols of the bottom (×), right (○), left (□) and top (△) face buttons. */
const FACE_ICONS: [string, string[]][] = [
  ['#7890ff', ['k.....k', '.k...k.', '..k.k..', '...k...', '..k.k..', '.k...k.', 'k.....k']],
  ['#ff5858', ['..kkk..', '.k...k.', 'k.....k', 'k.....k', 'k.....k', '.k...k.', '..kkk..']],
  ['#f080d8', ['kkkkkkk', 'k.....k', 'k.....k', 'k.....k', 'k.....k', 'k.....k', 'kkkkkkk']],
  ['#48d090', ['...k...', '..k.k..', '..k.k..', '.k...k.', '.k...k.', 'k.....k', 'kkkkkkk']],
];
const faceIcons: HTMLCanvasElement[] = [];

/** A round dark button with its coloured symbol. */
function faceIcon(k: number): HTMLCanvasElement {
  if (faceIcons[k]) return faceIcons[k];
  const [color, rows] = FACE_ICONS[k];
  const p = new PixelCanvas(17, 17);
  p.circle(8, 8, 8.2, '#101018');
  p.circle(8, 8, 7.2, '#404454');
  p.circle(7.5, 7.5, 6, '#2c2e3a');
  p.rows(rows, { k: color }, 5, 5);
  faceIcons[k] = p.canvas;
  return p.canvas;
}
