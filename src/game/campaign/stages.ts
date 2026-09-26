import type { EnemyKind } from './enemies';

/** Items of the Normal Game (PlayStation names). */
export type CampaignItem = 'fire' | 'bomb' | 'speed' | 'remote' | 'bombpass' | 'wallpass' | 'fireman' | 'flak';

/** Hidden score panels of the PlayStation remake. */
export type SecretPanel = 'b' | 'louie' | 'yoyo' | 'golden' | 'nakamoto' | 'angel';

export interface StageDef {
  number: number;
  item: CampaignItem;
  enemies: Partial<Record<EnemyKind, number>>;
  secret: SecretPanel;
}

export interface BonusStageDef {
  /** 1-based bonus stage index (after stage 5 × index). */
  index: number;
  enemy: EnemyKind;
}

const CODES: Record<string, EnemyKind> = {
  B: 'balloom',
  O: 'oneal',
  D: 'doll',
  M: 'minvo',
  K: 'kondoria',
  V: 'ovapi',
  P: 'pass',
  T: 'pontan',
};

/**
 * Stage roster (identical to the 1985 original, which the PlayStation remake keeps):
 * "count+letter" enemy codes and the single item hidden in the stage.
 */
const TABLE: [string, CampaignItem][] = [
  ['6B', 'fire'],
  ['3B 3O', 'bomb'],
  ['2B 2O 2D', 'remote'],
  ['1B 1O 2D 2M', 'speed'],
  ['4O 3D', 'bomb'],
  ['2O 3D 2M', 'bomb'],
  ['2O 3D 2K', 'fire'],
  ['1O 2D 4M', 'remote'],
  ['1O 1D 4M 1K', 'bombpass'],
  ['1O 1D 1M 3K 1V', 'wallpass'],
  ['1O 2D 3M 1K 1V', 'bomb'],
  ['1O 1D 1M 4K 1V', 'bomb'],
  ['3D 3M 3K', 'remote'],
  ['7K 1P', 'bombpass'],
  ['1D 3M 3K 1P', 'fire'],
  ['3M 4K 1P', 'wallpass'],
  ['5D 2K 1P', 'bomb'],
  ['3B 3O 2P', 'bombpass'],
  ['1B 1O 3D 1V 2P', 'bomb'],
  ['1O 1D 1M 2K 1V 2P', 'remote'],
  ['4K 3V 2P', 'bombpass'],
  ['4D 3M 1K 1P', 'remote'],
  ['2D 2M 2K 2V 1P', 'bomb'],
  ['1D 1M 4K 2V 1P', 'remote'],
  ['2O 1D 1M 2K 2V 1P', 'bombpass'],
  ['1B 1O 1D 1M 2K 1V 1P', 'flak'],
  ['1B 1O 5K 1V 1P', 'fire'],
  ['1O 3D 3M 1K 1P', 'bomb'],
  ['2K 5V 2P', 'remote'],
  ['3D 2M 1K 2V 1P', 'fireman'],
  ['2O 2D 2M 2K 2V', 'wallpass'],
  ['1O 1D 3M 4K 1P', 'bomb'],
  ['2D 2M 3K 1V 2P', 'remote'],
  ['2D 3M 3K 2P', 'flak'],
  ['2D 1M 3K 1V 2P', 'bombpass'],
  ['2D 2M 3K 3P', 'fireman'],
  ['2D 1M 3K 1V 3P', 'remote'],
  ['2D 2M 3K 3P', 'fire'],
  ['1D 1M 2K 2V 4P', 'wallpass'],
  ['1D 2M 3K 4P', 'flak'],
  ['1D 1M 3K 1V 4P', 'remote'],
  ['1M 3K 1V 5P', 'wallpass'],
  ['1M 2K 1V 6P', 'bombpass'],
  ['1M 2K 1V 6P', 'remote'],
  ['2K 2V 6P', 'flak'],
  ['2K 2V 6P', 'wallpass'],
  ['2K 2V 6P', 'bombpass'],
  ['2K 1V 6P 1T', 'remote'],
  ['1K 2V 6P 1T', 'fireman'],
  ['1K 2V 5P 2T', 'flak'],
];

const SECRET_STAGES: Record<SecretPanel, number[]> = {
  b: [6, 8, 14, 16, 22, 24, 30, 32, 38, 40, 46, 48],
  louie: [1, 7, 9, 15, 17, 23, 25, 31, 33, 39, 41, 47, 49],
  yoyo: [4, 12, 20, 28, 36, 44],
  golden: [2, 10, 18, 26, 34, 42, 50],
  nakamoto: [3, 11, 19, 27, 35, 43],
  angel: [5, 13, 21, 29, 37, 45],
};

function secretFor(stage: number): SecretPanel {
  for (const [panel, stages] of Object.entries(SECRET_STAGES) as [SecretPanel, number[]][]) {
    if (stages.includes(stage)) return panel;
  }
  return 'b';
}

export function parseRoster(code: string): Partial<Record<EnemyKind, number>> {
  const out: Partial<Record<EnemyKind, number>> = {};
  for (const part of code.split(/\s+/)) {
    const m = /^(\d+)([A-Z])$/.exec(part);
    if (!m) throw new Error(`Bad roster code ${part}`);
    const kind = CODES[m[2]];
    out[kind] = (out[kind] ?? 0) + parseInt(m[1], 10);
  }
  return out;
}

export const STAGES: StageDef[] = TABLE.map(([code, item], i) => ({
  number: i + 1,
  item,
  enemies: parseRoster(code),
  secret: secretFor(i + 1),
}));

/** Bonus stages follow stages 5, 10, …, 45 with the monsters in roster order. */
export const BONUS_STAGES: BonusStageDef[] = (['balloom', 'oneal', 'doll', 'minvo', 'kondoria', 'ovapi', 'pass', 'pontan', 'pontan'] as EnemyKind[]).map(
  (enemy, i) => ({ index: i + 1, enemy }),
);

/** Is there a bonus stage right after this (1-based) stage? */
export function bonusAfter(stage: number): BonusStageDef | null {
  if (stage % 5 !== 0 || stage >= 50) return null;
  return BONUS_STAGES[stage / 5 - 1] ?? null;
}

export const SECRET_POINTS: Record<SecretPanel, number> = {
  b: 10_000,
  louie: 20_000,
  yoyo: 30_000,
  golden: 500_000,
  nakamoto: 10_000_000,
  angel: 20_000_000,
};
