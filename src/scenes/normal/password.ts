import type { App } from '../../app';
import type { Gfx } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import { decodePassword, PASSWORD_ALPHABET, PASSWORD_LENGTH } from '../../game/campaign/password';
import { CampaignSession } from '../../game/campaign/session';
import { drawMenuBackdrop, drawPanel, drawTitleBar } from '../../render/ui';
import { startNormalGame } from './flow';

const COLS = 8;
const KEYS = [...PASSWORD_ALPHABET, '←', 'END'];

/** Password entry: pick characters from a grid (or type them on a keyboard). */
export class PasswordScene implements Scene {
  private chars: string[] = [];
  private cursor = 0;
  private error = 0;

  constructor(
    private readonly app: App,
    private readonly back: () => void,
  ) {}

  enter(): void {
    window.addEventListener('keydown', this.onKey);
    this.app.input.textEntry = true;
  }

  exit(): void {
    window.removeEventListener('keydown', this.onKey);
    this.app.input.textEntry = false;
  }

  /** Typing directly on a keyboard also works (letter keys stop acting as buttons here). */
  private onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace') {
      if (this.chars.pop()) this.app.audio.sfx('menuBack');
      return;
    }
    const k = e.key.toUpperCase();
    if (k.length === 1 && PASSWORD_ALPHABET.includes(k) && this.chars.length < PASSWORD_LENGTH) {
      this.chars.push(k);
      this.app.audio.sfx('select');
      if (this.chars.length === PASSWORD_LENGTH) this.cursor = KEYS.length - 1;
    }
  };

  update(): void {
    const pad = this.app.input.menu;
    if (this.error > 0) this.error--;
    const rows = Math.ceil(KEYS.length / COLS);
    const col = this.cursor % COLS;
    const row = Math.floor(this.cursor / COLS);
    const move = (c: number, r: number): void => {
      let idx = ((r + rows) % rows) * COLS + ((c + COLS) % COLS);
      if (idx >= KEYS.length) idx = KEYS.length - 1;
      this.cursor = idx;
      this.app.audio.sfx('menuMove');
    };
    if (pad.repeat('left')) move(col - 1, row);
    else if (pad.repeat('right')) move(col + 1, row);
    else if (pad.repeat('up')) move(col, row - 1);
    else if (pad.repeat('down')) move(col, row + 1);
    else if (pad.pressed('a')) {
      const k = KEYS[this.cursor];
      if (k === '←') this.chars.pop();
      else if (k === 'END') this.submit();
      else if (this.chars.length < PASSWORD_LENGTH) this.chars.push(k);
      this.app.audio.sfx('select');
      if (this.chars.length === PASSWORD_LENGTH && k !== 'END' && k !== '←') this.cursor = KEYS.length - 1;
    } else if (pad.pressed('start')) {
      this.submit();
    } else if (pad.pressed('b')) {
      if (this.chars.length) {
        this.chars.pop();
        this.app.audio.sfx('menuBack');
      } else {
        this.app.audio.sfx('menuBack');
        this.back();
      }
    } else if (pad.pressed('select')) {
      this.back();
    }
  }

  private submit(): void {
    const d = decodePassword(this.chars.join(''));
    if (!d) {
      this.error = 90;
      this.app.audio.sfx('skull');
      return;
    }
    this.app.audio.sfx('menuOk');
    const s = new CampaignSession(d.modern ? 'modern' : 'retro');
    s.stageIndex = d.stage - 1;
    s.powers.bombs = d.bombs;
    s.powers.fire = d.fire;
    startNormalGame(this.app, s);
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'PASSWORD', this.app.frame);
    drawPanel(g, 40, 38, 176, 34);
    for (let i = 0; i < PASSWORD_LENGTH; i++) {
      const x = 60 + i * 18;
      const ch = this.chars[i] ?? '';
      g.rect(x - 2, 62, 12, 1, i === this.chars.length ? '#ffe040' : '#8090c0');
      if (ch) g.text(ch, x + 4, 46, { align: 'center', scale: 2, color: '#ffffff', outline: '#000000' });
    }
    drawPanel(g, 32, 80, 192, 108, '#283070', '#0c1238');
    KEYS.forEach((k, i) => {
      const x = 52 + (i % COLS) * 22;
      const y = 90 + Math.floor(i / COLS) * 18;
      const sel = i === this.cursor;
      if (sel) g.rect(x - 7, y - 4, k.length > 1 ? 28 : 16, 15, '#ffe040');
      g.text(k, x + (k.length > 1 ? 6 : 1), y, { align: 'center', color: sel ? '#000000' : '#ffffff' });
    });
    if (this.error > 0) g.text('INVALID PASSWORD', g.width / 2, 196, { align: 'center', color: '#ff6060', outline: '#000000' });
    else g.text('A: ENTER  B: DELETE  START: OK', g.width / 2, 196, { align: 'center', color: '#c8d0ff', outline: '#000000' });
  }
}
