import type { DeviceId } from '../../engine/input';

export type Level = 'beginner' | 'normal' | 'advanced';
export type ComLevel = 'weak' | 'normal' | 'strong';
export type CartRule = 'off' | 'on' | 'super';
/** Off / On / Random (Random decides anew for every game). */
export type Tristate = 'off' | 'on' | 'random';
export type SlotType = 'human' | 'com' | 'off';

/** Every item that can appear in the Battle Game. */
export type BattleItem =
  | 'bomb'
  | 'fire'
  | 'speed'
  | 'geta'
  | 'kick'
  | 'bombpass'
  | 'glove'
  | 'punch'
  | 'push'
  | 'line'
  | 'powerbomb'
  | 'rubber'
  | 'pierce'
  | 'fullfire'
  | 'mine'
  | 'heart'
  | 'egg'
  | 'skull'
  | 'remote'
  | 'wallpass'
  | 'flak';

export const ITEM_NAMES: Record<BattleItem, string> = {
  bomb: 'BOMB UP',
  fire: 'FIRE UP',
  speed: 'SPEED UP',
  geta: 'STEEL SHOES',
  kick: 'BOMB KICK',
  bombpass: 'BOMB PASS',
  glove: 'POWER GLOVE',
  punch: 'PUNCH',
  push: 'PUSH',
  line: 'MULTI BOMB',
  powerbomb: 'POWER BOMB',
  rubber: 'RUBBER BOMB',
  pierce: 'METABOMB',
  fullfire: 'FULL FIRE',
  mine: 'LAND MINE',
  heart: 'HEART',
  egg: 'EGG',
  skull: 'SKULL',
  remote: 'REMOTE CONTROL',
  wallpass: 'WALL PASS',
  flak: 'FLAK JACKET',
};

/**
 * The 15 items the Custom Battle "Set Item" screen offers, column by column as on the
 * original screen. Land Mine, Multi Bomb, Wall Pass, Egg and Steel Shoes can't be placed
 * there; Remote Control belongs to the Normal Game only; the Flak Jacket appears in
 * battle only through this screen.
 */
export const CUSTOM_ITEMS: BattleItem[] = [
  'bomb', 'fire', 'speed', 'flak', 'bombpass',
  'kick', 'glove', 'punch', 'push', 'pierce',
  'rubber', 'powerbomb', 'fullfire', 'heart', 'skull',
];

/** Hit points a Custom Battle handicap can give (1 = normal). */
export const MAX_HP = 5;

export interface Rules {
  com: ComLevel;
  /** Games needed to win the set (1–5). */
  wins: number;
  /** Minutes per game (1–5), 0 = unlimited. */
  time: number;
  /** Pressure blocks: off = outer rings only, on = whole arena, random = a random fall pattern. */
  suddenDeath: Tristate;
  /** Shuffle the starting spots. */
  randomPosition: Tristate;
  /** Skull items can be burnt by blasts. */
  skullBomb: boolean;
  hyperBomber: boolean;
  cart: CartRule;
}

export const DEFAULT_RULES: Rules = {
  com: 'weak',
  wins: 3,
  time: 3,
  suddenDeath: 'off',
  randomPosition: 'off',
  skullBomb: false,
  hyperBomber: true,
  cart: 'off',
};

export interface PlayerSlot {
  type: SlotType;
  devices: DeviceId[];
  character: string;
  team: 0 | 1;
  /** Custom Battle handicap: hits this player survives (1 = normal). */
  hp: number;
}

export interface BattleConfig {
  mode: 'royal' | 'custom';
  level: Level;
  tag: boolean;
  rules: Rules;
  players: PlayerSlot[];
  stage: number;
  /** Custom Battle item counts (overrides the stage's defaults). */
  customItems?: Partial<Record<BattleItem, number>>;
  /** Which stage the custom counts were made for ("level:stage"); they reset per stage. */
  customFor?: string;
  /** Play the alternate layouts (once unlocked for the level). */
  alternate?: boolean;
}

export const DEFAULT_DEVICES: DeviceId[][] = [['kb1', 'pad0', 'touch'], ['kb2', 'pad1'], ['pad2'], ['pad3'], []];

export function defaultConfig(): BattleConfig {
  return {
    mode: 'royal',
    level: 'beginner',
    tag: false,
    rules: { ...DEFAULT_RULES },
    players: [0, 1, 2, 3, 4].map((i) => ({
      type: i === 0 ? 'human' : i < 4 ? 'com' : 'off',
      devices: [...DEFAULT_DEVICES[i]],
      character: 'bomberman',
      team: (i % 2) as 0 | 1,
      hp: 1,
    })),
    stage: 0,
  };
}

/**
 * Default item mix per level (per stage tweaks are applied by the arena). Beginner keeps
 * to the basics; Normal adds lots of Power Gloves and Pushes plus Eggs; Advanced adds the
 * special bombs. Steel Shoes and Hearts only come from Hyper Bomber (or Custom Battle).
 */
export const LEVEL_ITEMS: Record<Level, Partial<Record<BattleItem, number>>> = {
  beginner: { bomb: 6, fire: 6, speed: 3, kick: 2, bombpass: 1, skull: 2 },
  normal: { bomb: 5, fire: 5, speed: 2, kick: 2, bombpass: 1, glove: 2, punch: 1, push: 2, line: 1, pierce: 1, egg: 3, skull: 2 },
  advanced: { bomb: 5, fire: 5, speed: 2, kick: 2, bombpass: 1, glove: 1, punch: 1, push: 1, line: 1, powerbomb: 1, rubber: 1, pierce: 1, mine: 1, fullfire: 1, egg: 3, skull: 2 },
};

export const LEVEL_NAMES: Record<Level, string> = { beginner: 'BEGINNER', normal: 'NORMAL', advanced: 'ADVANCED' };
