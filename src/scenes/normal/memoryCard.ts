import type { App } from '../../app';
import type { Gfx } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import { loadSlots, saveSlot, type SaveData } from '../../game/campaign/session';
import { drawHand, drawMenuBackdrop, drawPanel, drawWindow, MENU_TEXT } from '../../render/ui';

/**
 * The MEMORY CARD screen (3 files), backed by browser storage.
 * mode 'save' writes `data`; mode 'load' calls `onLoad` with the chosen file.
 */
export class MemoryCardScene implements Scene {
  private sel = 0;
  private slots: (SaveData | null)[] = loadSlots();
  private msg = '';
  private msgT = 0;

  constructor(
    private readonly app: App,
    private readonly mode: 'save' | 'load',
    private readonly data: SaveData | null,
    private readonly back: () => void,
    private readonly onLoad?: (d: SaveData) => void,
  ) {}

  update(): void {
    const pad = this.app.input.menu;
    if (this.msgT > 0) {
      this.msgT--;
      if (this.msgT === 0 && this.mode === 'save' && this.msg === 'SAVED!') this.back();
      return;
    }
    if (pad.repeat('up')) {
      this.sel = (this.sel + 2) % 3;
      this.app.audio.sfx('menuMove');
    } else if (pad.repeat('down')) {
      this.sel = (this.sel + 1) % 3;
      this.app.audio.sfx('menuMove');
    } else if (pad.pressed('a') || pad.pressed('start')) {
      pad.swallow();
      if (this.mode === 'save' && this.data) {
        saveSlot(this.sel, this.data);
        this.slots = loadSlots();
        this.msg = 'SAVED!';
        this.msgT = 60;
        this.app.audio.sfx('menuOk');
      } else if (this.mode === 'load') {
        const d = this.slots[this.sel];
        if (d && this.onLoad) {
          this.app.audio.sfx('menuOk');
          this.onLoad(d);
        } else {
          this.msg = 'NO DATA';
          this.msgT = 45;
          this.app.audio.sfx('menuBack');
        }
      }
    } else if (pad.pressed('b') || pad.pressed('select')) {
      pad.swallow();
      this.app.audio.sfx('menuBack');
      this.back();
    }
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    // The question, with the two button hints in the corner.
    drawWindow(g, this.mode === 'save' ? 'SAVE' : 'LOAD', 14, 24, 228, 82, 'card');
    const ask = this.msgT > 0 ? [this.msg] : this.mode === 'save' ? ['WHICH FILE DO YOU', 'WANT TO SAVE TO?'] : ['WHICH DATA DO YOU', 'WANT TO LOAD?'];
    ask.forEach((l, i) => g.text(l, 28, 44 + i * 13, MENU_TEXT));
    g.text('A: OK', 232, 84, { align: 'right', color: '#ff6878', outline: '#300818' });
    g.text('B: CANCEL', 232, 94, { align: 'right', color: '#88a0ff', outline: '#101840' });
    // The three files.
    drawPanel(g, 14, 116, 228, 86);
    for (let i = 0; i < 3; i++) {
      const y = 132 + i * 22;
      if (i === this.sel) drawHand(g, 26, y - 1, this.app.frame);
      g.text(`FILE ${i + 1}`, 44, y, MENU_TEXT);
      const d = this.slots[i];
      if (d) {
        g.text('STAGE', 120, y, MENU_TEXT);
        g.text(String(d.stage), 204, y, { align: 'right', color: '#ffb050', outline: MENU_TEXT.outline });
      } else g.text('NO DATA', 120, y, MENU_TEXT);
    }
  }
}
