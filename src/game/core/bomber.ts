import type { Dir } from './types';
import { tileCenter } from './types';
import type { Body } from './movement';

/** What a controller (human or CPU) wants a bomber to do this tick. */
export interface Intent {
  /** Held directions, most important first. */
  dirs: Dir[];
  /** A (drop bomb / Power Glove) pressed this tick. */
  bomb: boolean;
  /** B (remote / partner / special) pressed this tick. */
  special: boolean;
  /** B held. */
  specialHeld: boolean;
  /** A held (Power Glove carries while held). */
  bombHeld: boolean;
  /** C (punch / push / multi bomb / stop kicked bomb) pressed this tick. */
  action?: boolean;
}

export const NO_INTENT: Intent = { dirs: [], bomb: false, special: false, specialHeld: false, bombHeld: false, action: false };

/** Skull diseases (PlayStation manual names). */
export type Curse =
  | 'superspeed'
  | 'superslow'
  | 'diarrhea'
  | 'impotent'
  | 'feeble'
  | 'streaking'
  | 'confusion'
  | 'shortFuse'
  | 'slowFuse'
  | 'warp';

export type BombType = 'normal' | 'remote' | 'power' | 'rubber' | 'pierce' | 'mine';

export interface BomberStats {
  bombs: number;
  fire: number;
  /** Speed level: 0 = base; items add, Steel Shoes subtract. */
  speed: number;
  remote: boolean;
  wallPass: boolean;
  bombPass: boolean;
  flamePass: boolean;
  kick: boolean;
  punch: boolean;
  push: boolean;
  glove: boolean;
  pierce: boolean;
  lineBomb: boolean;
  fullFire: boolean;
  /** Special bomb (battle): at most one kind at a time. */
  bombType: BombType;
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
    push: false,
    glove: false,
    pierce: false,
    lineBomb: false,
    fullFire: false,
    bombType: 'normal',
  };
}

export interface Jump {
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  height: number;
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
  /** Remaining frames of invulnerability (Flak Jacket / hit recovery blink). */
  invincible = 0;
  curse: Curse | null = null;
  curseTimer = 0;
  /** Frames left stunned. */
  stunned = 0;
  /** Bomb currently carried with the Power Glove. */
  carrying: import('./world').Bomb | null = null;
  /** Another bomber lifted with the Power Glove. */
  carryingBomber: Bomber | null = null;
  /** Walk-cycle frame counter (advances while moving). */
  walkTick = 0;
  intent: Intent = NO_INTENT;
  /** Set when the bomber stands in the exit or wins; freezes control. */
  frozen = false;
  /** Frames left in the air (trampoline, seesaw, thrown). */
  airborne = 0;
  jump: Jump | null = null;
  /** Riding a trolley. */
  riding = false;
  /** Speed forced by a road sign (px per tick). */
  speedOverride: number | null = null;
  wins = 0;
  kills = 0;
  /** Battle: team (tag match), character, extra hit points, heart, partner. */
  team = 0;
  character = 'bomberman';
  hp = 1;
  heart = false;
  partner: string | null = null;
  eggs = 0;
  gold = false;
  /** Power-ups collected this round (scattered on hits / dropped on death). */
  collected: string[] = [];
  /** Next bomb is an invisible land mine. */
  mineNext = false;
  /** Advanced characters: special cooldown and post-special "weak" period. */
  specialCooldown = 0;
  weak = 0;
  /** Streaking disease: keeps running this way. */
  streak: Dir | null = null;

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
