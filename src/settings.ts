import { load, save } from './engine/storage';

/** Options that are not sound volumes (those live with the AudioManager). */
export interface Settings {
  /** Screen position nudge in pixels ("Can you read this?"). */
  offsetY: number;
  vibration: boolean;
  stereo: boolean;
}

export function loadSettings(): Settings {
  const s = load<Partial<Settings>>('settings', {});
  return {
    offsetY: typeof s.offsetY === 'number' && Math.abs(s.offsetY) <= 16 ? Math.round(s.offsetY) : 0,
    vibration: typeof s.vibration === 'boolean' ? s.vibration : true,
    stereo: typeof s.stereo === 'boolean' ? s.stereo : true,
  };
}

export function saveSettings(s: Settings): void {
  save('settings', s);
}

/** Shift the displayed picture (overscan compensation), like the PlayStation option. */
export function applyScreenOffset(y: number): void {
  const c = document.getElementById('screen');
  if (c) c.style.transform = y ? `translateY(${y * 2}px)` : '';
}
