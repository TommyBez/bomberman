import { load, save } from '../../engine/storage';
import { freshPowers, powersAfterDeath, type PlayerPowers } from './campaignWorld';
import { bonusAfter, STAGES, type BonusStageDef, type StageDef } from './stages';

/** "×02" on the HUD at the start: three tries in total. */
export const START_LIVES = 2;
export const MAX_LIVES = 99;

export type Version = 'modern' | 'retro';

export interface SaveData {
  stage: number;
  score: number;
  lives: number;
  powers: PlayerPowers;
  version: Version;
  date: string;
}

/** Progress through the Normal Game (survives stage restarts). */
export class CampaignSession {
  stageIndex = 0;
  score = 0;
  lives = START_LIVES;
  powers: PlayerPowers = freshPowers();
  /** Bonus stage queued to play before the next regular stage. */
  pendingBonus: BonusStageDef | null = null;
  /** Intermission ("Bomberman Show Time") queued after this many cleared stages. */
  pendingShow = 0;
  /** The player said yes to "Save this game?" at the start (Game Over then offers SAVE). */
  cardSave = true;

  constructor(readonly version: Version = 'modern') {}

  static topScore(): number {
    const v = load<number>('topScore', 0);
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
  }

  static saveTop(score: number): void {
    if (score > CampaignSession.topScore()) save('topScore', score);
  }

  static fromSave(d: SaveData): CampaignSession {
    const s = new CampaignSession(d.version);
    s.stageIndex = Math.max(0, Math.min(STAGES.length - 1, d.stage - 1));
    s.score = d.score;
    s.lives = Math.max(START_LIVES, d.lives);
    s.powers = { ...freshPowers(), ...d.powers };
    return s;
  }

  toSave(): SaveData {
    return {
      stage: this.stageNumber,
      score: this.score,
      lives: this.lives,
      powers: { ...this.powers },
      version: this.version,
      date: new Date().toISOString().slice(0, 10),
    };
  }

  get stage(): StageDef {
    return STAGES[Math.min(this.stageIndex, STAGES.length - 1)];
  }

  get stageNumber(): number {
    return this.stageIndex + 1;
  }

  get finalStage(): boolean {
    return this.stageIndex >= STAGES.length - 1;
  }

  /** A miss: returns false when the game is over. */
  loseLife(powers: PlayerPowers): boolean {
    this.powers = powersAfterDeath(powers);
    this.lives--;
    return this.lives >= 0;
  }

  /** Stage cleared: +1 life, queue the bonus stage / intermission, move on. */
  clearStage(powers: PlayerPowers): void {
    this.powers = { ...powers };
    this.lives = Math.min(MAX_LIVES, this.lives + 1);
    const n = this.stageNumber;
    this.pendingBonus = bonusAfter(n);
    if (this.version === 'modern' && n % 10 === 0 && n < 50) this.pendingShow = n;
    if (!this.finalStage) this.stageIndex++;
  }

  /** Continue after a game over: same stage, fresh lives, score reset. */
  continueGame(): void {
    this.lives = START_LIVES;
    this.score = 0;
    this.powers = powersAfterDeath(this.powers);
    this.pendingBonus = null;
  }
}

// ------------------------------------------------------------------ memory card (3 files)

export function loadSlots(): (SaveData | null)[] {
  const slots = load<unknown>('saves', null);
  const list = Array.isArray(slots) ? slots : [];
  return [0, 1, 2].map((i) => (validSave(list[i]) ? list[i] : null));
}

function validSave(d: unknown): d is SaveData {
  if (!d || typeof d !== 'object') return false;
  const s = d as Partial<SaveData>;
  return (
    Number.isInteger(s.stage) && s.stage! >= 1 && s.stage! <= STAGES.length &&
    typeof s.score === 'number' && Number.isFinite(s.score) &&
    Number.isInteger(s.lives) &&
    (s.version === 'modern' || s.version === 'retro') &&
    !!s.powers && typeof s.powers === 'object'
  );
}

export function saveSlot(i: number, data: SaveData): void {
  const slots = loadSlots();
  slots[i] = data;
  save('saves', slots);
}
