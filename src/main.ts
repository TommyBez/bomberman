import type { App } from './app';
import { AudioManager } from './audio/audio';
import { SONGS } from './audio/songs';
import { SCREEN_H, SCREEN_W } from './config';
import { Gfx } from './engine/gfx';
import { Input } from './engine/input';
import { Loop } from './engine/loop';
import { SceneManager } from './engine/scene';
import { Screen } from './engine/screen';
import { BootScene } from './scenes/boot';

function boot(): void {
  const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('#screen canvas missing');
  const screen = new Screen(canvas, SCREEN_W, SCREEN_H);
  const input = new Input();
  input.attach(window);
  input.attachTouch(document);
  const audio = new AudioManager(SONGS);
  input.onGesture(() => audio.unlock());

  const app: App = {
    gfx: new Gfx(screen.ctx, SCREEN_W, SCREEN_H),
    input,
    audio,
    scenes: new SceneManager(),
    frame: 0,
  };
  app.scenes.go(new BootScene(app), 0);

  const loop = new Loop(
    () => {
      input.poll();
      app.scenes.update();
      app.frame++;
    },
    () => {
      app.scenes.render(app.gfx);
      screen.present();
    },
  );
  loop.start();
  document.getElementById('boot')?.remove();
  canvas.focus();

  // Handle for automated browser tests and debugging.
  (window as unknown as { __bomberman: App }).__bomberman = app;
}

boot();
