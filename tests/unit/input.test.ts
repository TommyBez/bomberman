import { afterEach, describe, expect, it } from 'vitest';
import { Input, PAD_LAYOUTS } from '../../src/engine/input';

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

  it('Type A: bottom bombs, right specials, left punches, top stops', () => {
    const input = new Input();
    withPad([0, 3]);
    input.poll();
    expect([...input.deviceState('pad0')].sort()).toEqual(['a', 'd']);
  });

  it('Type B is the PlayStation layout: circle (right) bombs, cross (bottom) specials', () => {
    const input = new Input();
    input.padLayouts = [PAD_LAYOUTS.findIndex((l) => l.name === 'TYPE B'), 0, 0, 0];
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

  it('every layout maps the four face buttons to four different functions', () => {
    for (const l of PAD_LAYOUTS) expect(new Set(l.face).size).toBe(4);
  });
});
