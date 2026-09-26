import type { App } from '../../app';
import { goMainMenu } from '../nav';

/** Battle Game setup flow (implemented in the next step). */
export class BattleSetup {
  constructor(private readonly app: App) {}

  start(): void {
    goMainMenu(this.app, 1);
  }
}
