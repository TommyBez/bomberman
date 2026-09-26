import { load, save } from './engine/storage';

/** Options that are not sound volumes (those live with the AudioManager). */
export interface Settings {
  /** Screen position nudge in pixels ("Can you read this?"). */
  offsetY: number;
  vibration: boolean;
  stereo: boolean;
}

export function loadSettings(): Settings {
  return { offsetY: 0, vibration: true, stereo: true, ...load<Partial<Settings>>('settings', {}) };
}

export function saveSettings(s: Settings): void {
  save('settings', s);
}

/** Shift the displayed picture (overscan compensation), like the PlayStation option. */
export function applyScreenOffset(y: number): void {
  const c = document.getElementById('screen');
  if (c) c.style.transform = y ? `translateY(${y * 2}px)` : '';
}
