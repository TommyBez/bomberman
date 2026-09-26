import type { Synth } from './synth';

/** Procedural sound effects. Each function schedules nodes on the sfx bus at time t. */
type SfxFn = (s: Synth, t: number, out: AudioNode) => void;

function tone(
  s: Synth,
  out: AudioNode,
  t: number,
  type: OscillatorType | PeriodicWave,
  f0: number,
  f1: number,
  dur: number,
  vol: number,
  curve: 'lin' | 'exp' = 'exp',
): void {
  const ctx = s.ctx;
  const o = ctx.createOscillator();
  if (type instanceof PeriodicWave) o.setPeriodicWave(type);
  else o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  else o.frequency.linearRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
  o.onended = () => g.disconnect();
}

function noise(
  s: Synth,
  out: AudioNode,
  t: number,
  dur: number,
  vol: number,
  filter: BiquadFilterType,
  f0: number,
  f1: number,
  q = 1,
): void {
  const ctx = s.ctx;
  const n = s.noiseSource();
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(f).connect(g).connect(out);
  n.start(t);
  n.stop(t + dur + 0.02);
  n.onended = () => g.disconnect();
}

function arp(s: Synth, out: AudioNode, t: number, notes: number[], stepDur: number, vol: number, inst: 'bell' | 'lead' | 'square' | 'pluck' = 'square'): void {
  notes.forEach((m, i) => s.note(inst, m, t + i * stepDur, stepDur * 0.9, vol, out, 0, 0.25));
}

export const SFX: Record<string, SfxFn> = {
  place: (s, t, o) => {
    tone(s, o, t, 'triangle', 420, 140, 0.09, 0.55);
    noise(s, o, t, 0.05, 0.15, 'lowpass', 2000, 400);
  },
  explode: (s, t, o) => {
    noise(s, o, t, 0.9, 0.95, 'lowpass', 2600, 90, 0.7);
    noise(s, o, t, 0.35, 0.45, 'bandpass', 900, 200, 0.8);
    tone(s, o, t, 'sine', 120, 32, 0.45, 0.9);
    tone(s, o, t, 'triangle', 70, 30, 0.6, 0.5);
  },
  item: (s, t, o) => arp(s, o, t, [72, 76, 79, 84, 88, 91], 0.045, 0.35, 'square'),
  bigItem: (s, t, o) => arp(s, o, t, [67, 72, 76, 79, 84, 88, 91, 96], 0.05, 0.35, 'square'),
  skull: (s, t, o) => {
    tone(s, o, t, s.pulse(0.25), 300, 90, 0.35, 0.3, 'lin');
    tone(s, o, t + 0.08, s.pulse(0.25), 280, 70, 0.4, 0.25, 'lin');
  },
  die: (s, t, o) => {
    for (let i = 0; i < 6; i++) tone(s, o, t + i * 0.09, s.pulse(0.5), 880 - i * 110, 700 - i * 110, 0.08, 0.28);
    tone(s, o, t + 0.55, 'triangle', 300, 60, 0.5, 0.5);
  },
  enemyDie: (s, t, o) => {
    tone(s, o, t, s.pulse(0.25), 900, 200, 0.18, 0.3);
    noise(s, o, t, 0.12, 0.2, 'bandpass', 3000, 800, 2);
  },
  menuMove: (s, t, o) => tone(s, o, t, s.pulse(0.5), 1320, 1320, 0.04, 0.2),
  menuOk: (s, t, o) => arp(s, o, t, [76, 83, 88], 0.05, 0.3, 'square'),
  menuBack: (s, t, o) => arp(s, o, t, [79, 72], 0.06, 0.25, 'square'),
  pause: (s, t, o) => arp(s, o, t, [84, 79, 84, 91], 0.06, 0.25, 'square'),
  kick: (s, t, o) => {
    tone(s, o, t, 'triangle', 260, 90, 0.1, 0.6);
    noise(s, o, t, 0.08, 0.25, 'lowpass', 1500, 300);
  },
  punch: (s, t, o) => {
    noise(s, o, t, 0.2, 0.35, 'bandpass', 600, 2400, 1.5);
    tone(s, o, t, 'triangle', 180, 90, 0.1, 0.4);
  },
  bounce: (s, t, o) => tone(s, o, t, 'sine', 180, 520, 0.12, 0.4, 'lin'),
  stun: (s, t, o) => {
    for (let i = 0; i < 3; i++) tone(s, o, t + i * 0.07, 'sine', 1800 - i * 200, 1500 - i * 200, 0.06, 0.2);
  },
  door: (s, t, o) => arp(s, o, t, [79, 83, 86, 91], 0.07, 0.35, 'bell'),
  hurry: (s, t, o) => {
    for (let i = 0; i < 4; i++) {
      tone(s, o, t + i * 0.24, s.pulse(0.5), 988, 988, 0.1, 0.25);
      tone(s, o, t + i * 0.24 + 0.12, s.pulse(0.5), 740, 740, 0.1, 0.25);
    }
  },
  block: (s, t, o) => {
    tone(s, o, t, 'sine', 90, 35, 0.25, 0.8);
    noise(s, o, t, 0.2, 0.4, 'lowpass', 1200, 150);
  },
  warp: (s, t, o) => tone(s, o, t, 'triangle', 200, 1600, 0.35, 0.35, 'exp'),
  jump: (s, t, o) => tone(s, o, t, 'sine', 150, 900, 0.25, 0.45, 'exp'),
  land: (s, t, o) => tone(s, o, t, 'triangle', 300, 80, 0.08, 0.4),
  count: (s, t, o) => tone(s, o, t, s.pulse(0.25), 1760, 1760, 0.03, 0.14),
  oneUp: (s, t, o) => arp(s, o, t, [76, 79, 88, 84, 86, 91], 0.07, 0.3, 'square'),
  spawn: (s, t, o) => {
    tone(s, o, t, s.pulse(0.125), 200, 600, 0.3, 0.3, 'lin');
    noise(s, o, t, 0.3, 0.2, 'bandpass', 400, 2000, 3);
  },
  timeUp: (s, t, o) => {
    for (let i = 0; i < 6; i++) tone(s, o, t + i * 0.1, s.pulse(0.5), i % 2 ? 660 : 880, i % 2 ? 660 : 880, 0.09, 0.25);
  },
  conveyor: (s, t, o) => noise(s, o, t, 0.05, 0.08, 'bandpass', 800, 700, 4),
  coin: (s, t, o) => arp(s, o, t, [88, 95], 0.06, 0.3, 'square'),
  select: (s, t, o) => tone(s, o, t, s.pulse(0.25), 660, 990, 0.06, 0.25, 'lin'),
};
