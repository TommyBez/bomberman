import type { App } from '../../app';
import type { Gfx } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import { ALT_CODES } from '../../game/battle/arenas';
import { LEVEL_NAMES } from '../../game/battle/config';
import { unlockAlt } from '../../game/battle/unlocks';
import { CLASSIC_CODES, decodePassword, PASSWORD_GLYPHS, PASSWORD_LENGTH } from '../../game/campaign/password';
import { CampaignSession } from '../../game/campaign/session';
import { STAGES } from '../../game/campaign/stages';
import { PixelCanvas } from '../../gfx/pixel';
import { sprites } from '../../gfx/sprites';
import { drawMenuBackdrop, drawPanel, drawWindow } from '../../render/ui';
import { startNormalGame } from './flow';

/**
 * Password entry as on the original: eight characters that start as "00000000"; up and
 * down turn the one under the hand, left and right move the hand. Typing on a keyboard
 * works too.
 */
export class PasswordScene implements Scene {
  private chars: string[] = Array.from({ length: PASSWORD_LENGTH }, () => PASSWORD_GLYPHS[0]);
  private cursor = 0;
  private error = 0;
  private notice = '';
  private noticeT = 0;

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
      if (this.cursor > 0) this.cursor--;
      this.app.audio.sfx('menuBack');
      return;
    }
    const k = e.key.toUpperCase();
    if (k.length === 1 && PASSWORD_GLYPHS.includes(k)) {
      this.chars[this.cursor] = k;
      this.cursor = Math.min(PASSWORD_LENGTH - 1, this.cursor + 1);
      this.app.audio.sfx('select');
    }
  };

  private turn(step: 1 | -1): void {
    const n = PASSWORD_GLYPHS.length;
    const i = PASSWORD_GLYPHS.indexOf(this.chars[this.cursor]);
    this.chars[this.cursor] = PASSWORD_GLYPHS[(i + step + n) % n];
    this.app.audio.sfx('menuMove');
  }

  update(): void {
    const pad = this.app.input.menu;
    if (this.error > 0) this.error--;
    if (this.noticeT > 0) this.noticeT--;
    if (pad.repeat('up')) this.turn(1);
    else if (pad.repeat('down')) this.turn(-1);
    else if (pad.repeat('left')) {
      this.cursor = (this.cursor + PASSWORD_LENGTH - 1) % PASSWORD_LENGTH;
      this.app.audio.sfx('menuMove');
    } else if (pad.repeat('right')) {
      this.cursor = (this.cursor + 1) % PASSWORD_LENGTH;
      this.app.audio.sfx('menuMove');
    } else if (pad.pressed('a')) {
      // A moves on; on the last character it enters the password.
      if (this.cursor < PASSWORD_LENGTH - 1) {
        this.cursor++;
        this.app.audio.sfx('select');
      } else this.submit();
    } else if (pad.pressed('start')) {
      this.submit();
    } else if (pad.pressed('b')) {
      this.app.audio.sfx('menuBack');
      if (this.cursor > 0) this.cursor--;
      else this.back();
    } else if (pad.pressed('select')) {
      this.back();
    }
  }

  private submit(): void {
    const code = this.chars.join('');
    // Battle Game codes open a level's alternate stages.
    const level = ALT_CODES[code];
    if (level) {
      unlockAlt(level);
      this.notice = `${LEVEL_NAMES[level]} ALTERNATE STAGES!`;
      this.noticeT = 150;
      this.chars = this.chars.map(() => PASSWORD_GLYPHS[0]);
      this.cursor = 0;
      this.app.audio.sfx('bigItem');
      return;
    }
    const classic = CLASSIC_CODES[code];
    if (classic) {
      this.app.audio.sfx('menuOk');
      const s = new CampaignSession(classic.retro ? 'retro' : 'modern');
      s.stageIndex = classic.stage - 1;
      if (classic.full) Object.assign(s.powers, { bombs: 10, fire: 5, speed: true, remote: true, bombpass: true, wallpass: true, fireman: true });
      else Object.assign(s.powers, collectedBefore(classic.stage));
      startNormalGame(this.app, s);
      return;
    }
    const d = decodePassword(code);
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
    drawWindow(g, 'PASSWORD', 12, 50, 232, 104, 'option');
    // The characters in their own inner frame, with the hand over the one being set.
    drawPanel(g, 58, 72, 140, 60, '#303880', '#101848');
    const x0 = 128 - (PASSWORD_LENGTH * 16) / 2;
    for (let i = 0; i < PASSWORD_LENGTH; i++) {
      const x = x0 + i * 16 + 8;
      g.text(this.chars[i], x, 104, { align: 'center', scale: 2, gradient: ['#ffffff', '#88c8ff'], outline: '#102050' });
    }
    const hx = x0 + this.cursor * 16 + 3;
    const bob = Math.floor(this.app.frame / 10) % 2;
    g.image(handSprite(), hx, 82 + bob);
    // Bomberman and a rival stand either side.
    const s = sprites();
    const wave = Math.floor(this.app.frame / 20) % 2;
    g.image(s.bombers[0].walk.down[wave], 24, 94);
    g.image(s.bombers[2].walk.down[wave ? 0 : 1], 216, 94);
    if (this.noticeT > 0) g.text(this.notice, g.width / 2, 172, { align: 'center', color: '#ffe040', outline: '#000000' });
    else if (this.error > 0) g.text('INVALID PASSWORD', g.width / 2, 172, { align: 'center', color: '#ff6060', outline: '#000000' });
  }
}

let hand: HTMLCanvasElement | null = null;

/** A white glove pointing down at the character being set. */
function handSprite(): HTMLCanvasElement {
  if (hand) return hand;
  const p = new PixelCanvas(10, 14);
  p.rows(
    [
      '..kkkkk...',
      '.kwwwwwk..',
      'kwwkwkwwk.',
      'kwwkwkwwkk',
      'kwwwwwwwwk',
      'kwwwwwwwwk',
      '.kwwwwwwk.',
      '..kwwwwk..',
      '...kwwk...',
      '...kwwk...',
      '...kwwk...',
      '...kwwk...',
      '....kk....',
    ],
    { k: '#200818', w: '#ffffff' },
  );
  hand = p.canvas;
  return hand;
}

/** Bomb and fire power-ups a player would have picked up in every stage before this one. */
function collectedBefore(stage: number): { bombs: number; fire: number } {
  const earlier = STAGES.slice(0, stage - 1);
  return {
    bombs: Math.min(10, 1 + earlier.filter((s) => s.item === 'bomb').length),
    fire: Math.min(5, 1 + earlier.filter((s) => s.item === 'fire').length),
  };
}
