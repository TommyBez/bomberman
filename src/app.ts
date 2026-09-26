import type { AudioManager } from './audio/audio';
import type { Gfx } from './engine/gfx';
import type { Input } from './engine/input';
import type { SceneManager } from './engine/scene';

/** Shared services handed to every scene. */
export interface App {
  gfx: Gfx;
  input: Input;
  audio: AudioManager;
  scenes: SceneManager;
  /** Frames since boot (for blinking text etc.). */
  frame: number;
}
