import type { Gfx } from '../engine/gfx';
import type { Controller } from '../engine/input';
import { drawWindow, MENU_DIM, MENU_TEXT, MENU_VALUE } from './ui';

/** One row of a commands page: a heading, a label with its keys, or three columns. */
type Row =
  | { head: string }
  | { left: string; right: string }
  | { cols: readonly [string, string, string] };

interface Page {
  title: string;
  tab: string;
  rows: readonly Row[];
  /** A short line under the rows (battle-only marks, extra keys). */
  note?: string;
}

/**
 * What the buttons do, then how to press them. Starred lines are Battle Game only:
 * the Normal Game uses A to bomb, B to detonate a remote, and the menu buttons.
 */
const PAGES: readonly Page[] = [
  {
    title: 'COMMANDS',
    tab: 'ACTIONS',
    rows: [
      { left: 'A', right: 'BOMB OR CONFIRM' },
      { left: 'HOLD A', right: 'POWER GLOVE *' },
      { left: 'B', right: 'REMOTE OR BACK' },
      { left: 'B ALONE', right: 'PARTNER ABILITY *' },
      { left: 'B + WAY', right: 'CHARACTER SPECIAL *' },
      { left: 'C', right: 'PUSH, PUNCH, MULTI *' },
      { left: 'D', right: 'STOP KICKED BOMB *' },
      { left: 'START', right: 'PAUSE' },
      { left: 'SELECT', right: 'BACK' },
    ],
    note: '* BATTLE GAME ONLY',
  },
  {
    title: 'KEYBOARD',
    tab: 'KEYS',
    rows: [
      { head: 'ONE PLAYER AND MENUS' },
      { left: 'MOVE', right: 'ARROWS / WASD' },
      { left: 'A', right: 'SPACE / X / J / F' },
      { left: 'B', right: 'Z / SHIFT / K / G' },
      { left: 'C', right: 'C / E / L' },
      { left: 'D', right: 'Q / V / I' },
      { left: 'START', right: 'ENTER / P' },
      { left: 'SELECT', right: 'ESC / BS / TAB' },
    ],
  },
  {
    title: 'BATTLE KEYS',
    tab: 'BATTLE',
    rows: [
      { head: 'TWO PLAYERS, ONE KEYBOARD' },
      { cols: ['', 'P1', 'P2'] },
      { cols: ['MOVE', 'WASD', 'ARROWS'] },
      { cols: ['A', 'SPACE F', 'ENTER /'] },
      { cols: ['B', 'LSHIFT G', 'RSHIFT .'] },
      { cols: ['C', 'E / R', 'CTRL ,'] },
      { cols: ['D', 'Q / T', 'QUOTE ;'] },
    ],
    note: 'P2 A IS ALSO NUMPAD 0',
  },
  {
    title: 'GAMEPAD',
    tab: 'PAD',
    rows: [
      { left: 'MOVE', right: 'D-PAD / STICK' },
      { left: 'BOTTOM', right: 'BOMB (A)' },
      { left: 'RIGHT', right: 'SPECIAL (B)' },
      { left: 'LEFT', right: 'PUNCH (C)' },
      { left: 'TOP', right: 'STOP (D)' },
      { left: 'L1 / R1', right: 'SPECIAL TOO' },
      { left: 'L2 / R2', right: 'PUNCH TOO' },
      { left: 'START', right: 'PAUSE' },
      { left: 'SELECT', right: 'BACK' },
      { left: 'TOUCH C', right: 'PUNCH AND STOP' },
      { left: 'REMAP', right: 'OPTION, CONTROLLER' },
    ],
  },
];

const INK = { color: MENU_VALUE, outline: MENU_TEXT.outline };
const DIM = { color: MENU_DIM, outline: MENU_TEXT.outline };

/**
 * Commands reference. Left and right (or A) turn the page; B, D, Start and Select close it.
 * `update` returns true once the player has closed it.
 */
export class CommandsHelp {
  private page: number;

  constructor(page = 0) {
    this.page = ((page % PAGES.length) + PAGES.length) % PAGES.length;
  }

  update(pad: Controller, sfx: (name: string) => void): boolean {
    const n = PAGES.length;
    if (pad.repeat('left')) {
      this.page = (this.page + n - 1) % n;
      sfx('menuMove');
    } else if (pad.repeat('right') || pad.pressed('a')) {
      this.page = (this.page + 1) % n;
      sfx('menuMove');
    } else if (pad.pressed('b') || pad.pressed('d') || pad.pressed('start') || pad.pressed('select')) {
      pad.swallow();
      sfx('menuBack');
      return true;
    }
    return false;
  }

  /** The reference window. Pass `dim` to darken a game picture behind it. */
  draw(g: Gfx, dim = false): void {
    if (dim) {
      g.ctx.globalAlpha = 0.55;
      g.rect(0, 0, g.width, g.height, '#000000');
      g.ctx.globalAlpha = 1;
    }
    const page = PAGES[this.page];
    drawWindow(g, page.title, 8, 16, 240, 196, 'option');
    this.drawTabs(g, 34);
    const lh = 12;
    let y = 50;
    for (const row of page.rows) {
      if ('head' in row) g.text(row.head, 20, y, INK);
      else if ('cols' in row) this.drawCols(g, y, row.cols);
      else {
        g.text(row.left, 20, y, MENU_TEXT);
        g.text(row.right, 112, y, INK);
      }
      y += lh;
    }
    if (page.note) g.text(page.note, 20, 178, DIM);
    g.text('← → PAGE', 20, 194, DIM);
    g.text(`${this.page + 1}/${PAGES.length}`, g.width / 2, 194, { ...DIM, align: 'center' });
    g.text('B BACK', 236, 194, { ...DIM, align: 'right' });
  }

  private drawTabs(g: Gfx, y: number): void {
    const gap = 10;
    const widths = PAGES.map((p) => p.tab.length * 6 - 1);
    const total = widths.reduce((a, w) => a + w, 0) + gap * (PAGES.length - 1);
    let x = Math.round((g.width - total) / 2);
    PAGES.forEach((p, i) => {
      const on = i === this.page;
      g.text(p.tab, x, y, on ? INK : DIM);
      if (on) g.rect(x, y + 9, widths[i], 1, MENU_VALUE);
      x += widths[i] + gap;
    });
  }

  private drawCols(g: Gfx, y: number, cols: readonly [string, string, string]): void {
    const xs = [20, 108, 178];
    cols.forEach((cell, i) => {
      if (!cell) return;
      g.text(cell, xs[i], y, i === 0 ? MENU_TEXT : INK);
    });
  }
}
