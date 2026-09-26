import type { App } from '../app';
import { MainMenuScene } from './mainMenu';
import { TitleScene } from './title';

/** Central navigation helpers (keeps scene modules free of circular constructor chains). */
export function goTitle(app: App): void {
  app.audio.stopMusic(0.2);
  app.scenes.go(new TitleScene(app));
}

export function goMainMenu(app: App, index = 0): void {
  app.scenes.go(new MainMenuScene(app, index));
}
