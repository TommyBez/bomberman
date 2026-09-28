import type { App } from '../app';
import type { Gfx } from '../engine/gfx';
import type { Scene } from '../engine/scene';
import { CommandsHelp } from '../render/commands';
import { drawMenuBackdrop } from '../render/ui';

/** The commands reference, opened from Option (or Controller → Keyboard). */
export class CommandsScene implements Scene {
  private readonly help: CommandsHelp;

  constructor(
    private readonly app: App,
    private readonly onBack: () => void,
    page = 0,
  ) {
    this.help = new CommandsHelp(page);
  }

  update(): void {
    if (this.help.update(this.app.input.menu, (n) => this.app.audio.sfx(n))) this.onBack();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    this.help.draw(g);
  }
}
