import type { Gfx } from './gfx';

export interface Scene {
  /** Called when the scene becomes active (after the fade-out of the previous one). */
  enter?(): void;
  exit?(): void;
  update(): void;
  render(g: Gfx): void;
}

/**
 * Owns the active scene and performs black fade transitions between scenes,
 * the way the PlayStation menus and stage changes fade through black.
 */
export class SceneManager {
  private current: Scene | null = null;
  private pending: Scene | null = null;
  private alpha = 0;
  private state: 'idle' | 'out' | 'in' = 'idle';
  private speed = 1 / 12;

  get scene(): Scene | null {
    return this.current;
  }

  get transitioning(): boolean {
    return this.state !== 'idle';
  }

  /** Switch scene; `frames` is the length of each half of the fade (0 = cut). */
  go(scene: Scene, frames = 12): void {
    if (frames <= 0 || !this.current) {
      this.swap(scene);
      this.alpha = frames > 0 ? 1 : 0;
      this.state = frames > 0 ? 'in' : 'idle';
      this.speed = frames > 0 ? 1 / frames : 1;
      return;
    }
    this.pending = scene;
    this.speed = 1 / frames;
    this.state = 'out';
  }

  update(): void {
    if (this.state === 'out') {
      this.alpha = Math.min(1, this.alpha + this.speed);
      if (this.alpha >= 1 && this.pending) {
        const next = this.pending;
        this.pending = null;
        this.swap(next);
        this.state = 'in';
      }
      return; // the old scene is frozen while fading out
    }
    if (this.state === 'in') {
      this.alpha = Math.max(0, this.alpha - this.speed);
      if (this.alpha <= 0) this.state = 'idle';
    }
    this.current?.update();
  }

  render(g: Gfx): void {
    this.current?.render(g);
    if (this.alpha > 0) {
      g.ctx.globalAlpha = Math.min(1, this.alpha);
      g.clear('#000000');
      g.ctx.globalAlpha = 1;
    }
  }

  private swap(next: Scene): void {
    this.current?.exit?.();
    this.current = next;
    next.enter?.();
  }
}
