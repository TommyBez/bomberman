/**
 * The eight monsters of the Normal Game. Speeds are pixels per frame: the original's
 * speed classes 1–4 map to 0.25 px steps (Ballom = 0.5 px/frame as measured on the NES;
 * the player walks 0.75 px/frame, 1.0 with Speed Up).
 */
export type EnemyKind = 'balloom' | 'oneal' | 'doll' | 'minvo' | 'kondoria' | 'ovapi' | 'pass' | 'pontan';

export type Smarts = 'low' | 'mid' | 'high';

export interface EnemyType {
  kind: EnemyKind;
  /** Japanese / NES name. */
  name: string;
  /** Name used by the North American PlayStation manual. */
  usName: string;
  points: number;
  speed: number;
  smarts: Smarts;
  wallPass: boolean;
  /** Steers clear of bomb blast lines (Pass). */
  dodgesBombs?: boolean;
  /** Charges in a straight line once it spots the player (Pontan). */
  charges?: boolean;
  blurb: string;
}

export const SPEED_SLOWEST = 0.25;
export const SPEED_SLOW = 0.5;
export const SPEED_NORMAL = 0.75;
export const SPEED_FAST = 1;
export const SPEED_FASTEST = 1.25;

export const ENEMY_TYPES: Record<EnemyKind, EnemyType> = {
  balloom: { kind: 'balloom', name: 'BALLOM', usName: 'BALLOM', points: 100, speed: SPEED_SLOW, smarts: 'low', wallPass: false, blurb: 'SLOW AND ERRATIC' },
  oneal: { kind: 'oneal', name: 'ONIL', usName: 'ONIL', points: 200, speed: SPEED_NORMAL, smarts: 'mid', wallPass: false, blurb: 'LIKES TO AMBUSH' },
  doll: { kind: 'doll', name: 'DAHL', usName: 'BLOCKHEAD', points: 400, speed: SPEED_NORMAL, smarts: 'low', wallPass: false, blurb: 'FLOATS ABOUT AIMLESSLY' },
  minvo: { kind: 'minvo', name: 'MINVO', usName: 'MINBOW', points: 800, speed: SPEED_FAST, smarts: 'mid', wallPass: false, blurb: 'FAST BUT EASY TO BEAT' },
  kondoria: { kind: 'kondoria', name: 'KONDORIA', usName: 'AMEBAN', points: 1000, speed: SPEED_SLOWEST, smarts: 'high', wallPass: true, blurb: 'OOZES THROUGH SOFT BLOCKS' },
  ovapi: { kind: 'ovapi', name: 'OVAPI', usName: 'FLOATSAM', points: 2000, speed: SPEED_SLOW, smarts: 'mid', wallPass: true, blurb: 'FLOATS THROUGH SOFT BLOCKS' },
  pass: { kind: 'pass', name: 'PASS', usName: 'TIGLON', points: 4000, speed: SPEED_FAST, smarts: 'high', wallPass: false, dodgesBombs: true, blurb: 'FAST AND DODGES BOMBS' },
  pontan: { kind: 'pontan', name: 'PONTAN', usName: 'FOTON', points: 8000, speed: SPEED_FASTEST, smarts: 'high', wallPass: true, charges: true, blurb: 'THE MOST DANGEROUS OF ALL' },
};

/** Difficulty order, used to choose which monsters pour out of a bombed exit door. */
export const ENEMY_ORDER: EnemyKind[] = ['balloom', 'oneal', 'doll', 'minvo', 'kondoria', 'ovapi', 'pass', 'pontan'];
