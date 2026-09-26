import type { App } from '../app';
import { TitleScene } from './title';

/** Central navigation helpers (keeps scene modules free of circular constructor chains). */
export function goTitle(app: App): void {
  app.audio.stopMusic(0.2);
  app.scenes.go(new TitleScene(app));
}

/** Back to the title's mode menu (NORMAL GAME / BATTLE GAME / OPTION). */
export function goMainMenu(app: App, index = 0): void {
  app.scenes.go(new TitleScene(app, index));
}
