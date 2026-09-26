import type { App } from '../../app';
import type { Gfx } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import { loadSlots, saveSlot, type SaveData } from '../../game/campaign/session';
import { drawMenuBackdrop, drawPanel, drawTitleBar } from '../../render/ui';

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
    drawTitleBar(g, this.mode === 'save' ? 'SAVE' : 'LOAD', this.app.frame);
    g.text('MEMORY CARD SLOT 1', g.width / 2, 36, { align: 'center', color: '#c0c0c0', outline: '#000000' });
    for (let i = 0; i < 3; i++) {
      const y = 52 + i * 48;
      const sel = i === this.sel;
      drawPanel(g, 28, y, 200, 40, sel ? '#4868e0' : '#303860', sel ? '#182070' : '#101428');
      g.text(`FILE ${i + 1}`, 38, y + 6, { color: sel ? '#ffe040' : '#ffffff', outline: '#000000' });
      const d = this.slots[i];
      if (d) {
        g.text(`STAGE ${String(d.stage).padStart(2, '0')}  ${d.version === 'retro' ? 'RETRO' : 'MODERN'}`, 38, y + 18, { color: '#ffffff', outline: '#000000' });
        g.text(`SCORE ${d.score}`, 38, y + 28, { color: '#a8c0ff', outline: '#000000' });
        g.text(d.date, 220, y + 6, { color: '#a8c0ff', outline: '#000000', align: 'right' });
      } else {
        g.text('NO DATA', 38, y + 22, { color: '#808098', outline: '#000000' });
      }
    }
    if (this.msgT > 0) g.text(this.msg, g.width / 2, 204, { align: 'center', scale: 2, color: '#ffe040', outline: '#000000' });
    else g.text('A: SELECT   B: BACK', g.width / 2, 208, { align: 'center', color: '#c8d0ff', outline: '#000000' });
  }
}
