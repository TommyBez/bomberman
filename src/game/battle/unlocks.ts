import { load, save } from '../../engine/storage';
import type { Level } from './config';

/** Which levels' alternate battle stages have been opened with their password. */
export function altUnlocked(level: Level): boolean {
  const u = load<Record<string, unknown>>('altStages', {});
  return !!u && typeof u === 'object' && u[level] === true;
}

export function unlockAlt(level: Level): void {
  const u = load<Record<string, unknown>>('altStages', {});
  save('altStages', { ...(u && typeof u === 'object' ? u : {}), [level]: true });
}
