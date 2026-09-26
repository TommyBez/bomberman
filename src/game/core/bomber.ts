import type { Dir } from './types';
import { tileCenter } from './types';
import type { Body } from './movement';

/** What a controller (human or CPU) wants a bomber to do this tick. */
export interface Intent {
  /** Held directions, most important first. */
  dirs: Dir[];
  /** A (drop bomb) pressed this tick. */
  bomb: boolean;
  /** B (detonate / punch / stop) pressed this tick. */
  special: boolean;
  /** B held (glove: carry the bomb while held). */
  specialHeld: boolean;
  /** A held (glove pick-up is "A while standing on a bomb"). */
  bombHeld: boolean;
}

export const NO_INTENT: Intent = { dirs: [], bomb: false, special: false, specialHeld: false, bombHeld: false };

export type Curse =
  | 'slow'
  | 'fast'
  | 'reverse'
  | 'diarrhea'
  | 'noBomb'
  | 'lowFire'
  | 'shortFuse'
  | 'longFuse'
  | 'invisible';

export interface BomberStats {
  bombs: number;
  fire: number;
  /** Number of speed-up items collected (0 = base speed). */
  speed: number;
  remote: boolean;
  wallPass: boolean;
  bombPass: boolean;
  flamePass: boolean;
  kick: boolean;
  punch: boolean;
  glove: boolean;
  pierce: boolean;
  lineBomb: boolean;
  fullFire: boolean;
}

export function baseStats(): BomberStats {
  return {
    bombs: 1,
    fire: 1,
    speed: 0,
    remote: false,
    wallPass: false,
    bombPass: false,
    flamePass: false,
    kick: false,
    punch: false,
    glove: false,
    pierce: false,
    lineBomb: false,
    fullFire: false,
  };
}

export class Bomber implements Body {
  x: number;
  y: number;
  facing: Dir = 'down';
  moving = false;
  alive = true;
  /** Frames since death started (death animation), -1 while alive. */
  deathTimer = -1;
  stats: BomberStats = baseStats();
  activeBombs = 0;
  /** Remaining frames of invulnerability (Mystery item / respawn blink). */
  invincible = 0;
  curse: Curse | null = null;
  curseTimer = 0;
  /** Frames left stunned (hit on the head by a thrown bomb). */
  stunned = 0;
  /** Bomb currently carried with the glove. */
  carrying: import('./world').Bomb | null = null;
  /** Walk-cycle frame counter (advances while moving). */
  walkTick = 0;
  intent: Intent = NO_INTENT;
  /** Set when the bomber stands in the exit or wins; freezes control. */
  frozen = false;
  /** Jumping over the arena (trampoline) — frames left. */
  airborne = 0;
  wins = 0;
  kills = 0;

  constructor(
    readonly id: number,
    tx: number,
    ty: number,
  ) {
    this.x = tileCenter(tx);
    this.y = tileCenter(ty);
  }

  get tx(): number {
    return Math.floor(this.x / 16);
  }

  get ty(): number {
    return Math.floor(this.y / 16);
  }

  get dead(): boolean {
    return !this.alive;
  }
}
