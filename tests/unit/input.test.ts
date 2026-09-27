import { afterEach, describe, expect, it } from 'vitest';
import { Input } from '../../src/engine/input';
import { loadSettings } from '../../src/settings';

type Nav = { getGamepads?: () => unknown[] };
const g = globalThis as unknown as { navigator?: Nav };
const original = g.navigator;

function fakePad(pressed: number[]): unknown {
  return { connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: 0 })) };
}

function withPad(pressed: number[]): void {
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [fakePad(pressed), null, null, null] }, configurable: true });
}

describe('gamepad layouts', () => {
  afterEach(() => Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true }));

  it('by default: bottom bombs, right specials, left punches, top stops', () => {
    const input = new Input();
    withPad([0, 3]);
    input.poll();
    expect([...input.deviceState('pad0')].sort()).toEqual(['a', 'd']);
  });

  it('each gamepad can be set up like the PlayStation: circle (right) bombs, cross (bottom) specials', () => {
    const input = new Input();
    input.padFaces[0] = ['b', 'a', 'c', 'd'];
    withPad([1]);
    input.poll();
    expect([...input.deviceState('pad0')]).toEqual(['a']);
    withPad([0, 2]);
    input.poll();
    expect([...input.deviceState('pad0')].sort()).toEqual(['b', 'c']);
  });

  it('L1 + L2 + R1 + R2 + SELECT + START is a soft reset (once per press)', () => {
    const input = new Input();
    withPad([4, 5, 6, 7, 8]);
    input.poll();
    expect(input.takeSoftReset()).toBe(false);
    withPad([4, 5, 6, 7, 8, 9]);
    input.poll();
    expect(input.takeSoftReset()).toBe(true);
    input.poll();
    expect(input.takeSoftReset()).toBe(false);
  });

  it('settings keep a gamepad set up with an old numbered layout, and reject broken ones', () => {
    const store = new Map<string, string>();
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
      configurable: true,
    });
    try {
      store.set('bomberman.settings', JSON.stringify({ padLayouts: [1, 0, 0, 0], vibration: false }));
      let s = loadSettings();
      expect(s.padFaces[0]).toEqual(['b', 'a', 'c', 'd']);
      expect(s.padFaces[1]).toEqual(['a', 'b', 'c', 'd']);
      expect(s.vibration).toEqual([false, false, false, false]);
      store.set('bomberman.settings', JSON.stringify({ padFaces: [['a', 'a', 'c', 'd'], ['d', 'c', 'b', 'a']], vibration: [true, false] }));
      s = loadSettings();
      expect(s.padFaces[0]).toEqual(['a', 'b', 'c', 'd']);
      expect(s.padFaces[1]).toEqual(['d', 'c', 'b', 'a']);
      expect(s.vibration).toEqual([true, false, true, true]);
    } finally {
      if (saved) Object.defineProperty(globalThis, 'localStorage', saved);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});
