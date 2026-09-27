import { DEFAULT_FACES, type FaceButton, type PadFaces } from './engine/input';
import { load, save } from './engine/storage';

/** Options that are not sound volumes (those live with the AudioManager). */
export interface Settings {
  /** Screen position nudge in pixels ("Can you read this?"). */
  offsetY: number;
  /** Vibration for each of the four gamepads. */
  vibration: boolean[];
  stereo: boolean;
  /** What each gamepad's bottom, right, left and top face buttons do. */
  padFaces: PadFaces[];
}

/** The face-button presets that earlier versions stored by number. */
const OLD_LAYOUTS: PadFaces[] = [
  ['a', 'b', 'c', 'd'],
  ['b', 'a', 'c', 'd'],
  ['a', 'c', 'b', 'd'],
  ['c', 'b', 'a', 'd'],
];

function validFaces(v: unknown): v is PadFaces {
  return Array.isArray(v) && v.length === 4 && new Set(v).size === 4 && v.every((b) => (['a', 'b', 'c', 'd'] as unknown[]).includes(b));
}

export function loadSettings(): Settings {
  const s = load<Partial<Settings> & { padLayouts?: unknown; vibration?: unknown }>('settings', {});
  const vib = s.vibration;
  return {
    offsetY: typeof s.offsetY === 'number' && Math.abs(s.offsetY) <= 16 ? Math.round(s.offsetY) : 0,
    vibration: [0, 1, 2, 3].map((i) => (typeof vib === 'boolean' ? vib : Array.isArray(vib) && typeof vib[i] === 'boolean' ? vib[i] : true)),
    stereo: typeof s.stereo === 'boolean' ? s.stereo : true,
    padFaces: [0, 1, 2, 3].map((i) => {
      const faces = Array.isArray(s.padFaces) ? s.padFaces[i] : undefined;
      if (validFaces(faces)) return [...faces] as PadFaces;
      const old = Array.isArray(s.padLayouts) ? s.padLayouts[i] : undefined;
      return [...(typeof old === 'number' && OLD_LAYOUTS[old] ? OLD_LAYOUTS[old] : DEFAULT_FACES)] as [FaceButton, FaceButton, FaceButton, FaceButton];
    }),
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
