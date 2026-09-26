/**
 * Tiny WebAudio synthesiser: a handful of instruments (pulse leads, saw brass,
 * bass, bells, pads and a drum kit) rendered with oscillators + a shared noise
 * buffer, mixed through a light reverb for a PlayStation-era "sampled" feel.
 */

export type InstrumentName =
  | 'lead' | 'lead2' | 'pulse' | 'square' | 'brass' | 'bass' | 'slap' | 'bell' | 'pad' | 'organ' | 'pluck' | 'flute'
  | 'kick' | 'snare' | 'hat' | 'ohat' | 'crash' | 'tom' | 'clap' | 'shaker';

export const DRUMS = new Set<InstrumentName>(['kick', 'snare', 'hat', 'ohat', 'crash', 'tom', 'clap', 'shaker']);

export class Synth {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly musicBus: GainNode;
  readonly sfxBus: GainNode;
  readonly reverbSend: GainNode;
  private noise: AudioBuffer;
  private pulseWaves = new Map<number, PeriodicWave>();

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    this.master.connect(comp).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);

    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(1.6, 2.8);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.22;
    this.reverbSend.connect(reverb).connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x3fffffff) - 1;
    }
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let seed = ch ? 99991 : 7771;
      for (let i = 0; i < len; i++) {
        seed = (seed * 16807) % 2147483647;
        const n = (seed / 2147483647) * 2 - 1;
        d[i] = n * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  /** Band-limited pulse wave with the given duty cycle (0..0.5). */
  pulse(duty: number): PeriodicWave {
    let w = this.pulseWaves.get(duty);
    if (w) return w;
    const n = 48;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * Math.cos(k * Math.PI * duty);
      imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * Math.sin(k * Math.PI * duty);
    }
    w = this.ctx.createPeriodicWave(real, imag);
    this.pulseWaves.set(duty, w);
    return w;
  }

  noiseSource(): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    return src;
  }

  /**
   * Play one note. `dest` is the bus (music or sfx); `send` routes a copy to the reverb.
   * Returns nothing; nodes clean themselves up after they stop.
   */
  note(
    inst: InstrumentName,
    midi: number,
    time: number,
    dur: number,
    vol: number,
    dest: AudioNode,
    pan = 0,
    send = 0.3,
    retro = false,
  ): void {
    if (retro) {
      this.retroNote(inst, midi, time, dur, vol, dest);
      return;
    }
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    let tail: AudioNode = out;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      out.connect(p);
      tail = p;
    }
    tail.connect(dest);
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      tail.connect(s).connect(this.reverbSend);
    }
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const g = out.gain;
    const end = time + dur;

    const env = (a: number, d: number, s: number, r: number, peak = vol): number => {
      const tau = d / 3 + 0.0001;
      const relStart = Math.max(time + a + 0.001, end);
      g.setValueAtTime(0, time);
      g.linearRampToValueAtTime(peak, time + a);
      g.setTargetAtTime(peak * s, time + a, tau);
      // Value of the decay curve when the release starts (keeps the ramp click-free).
      const held = peak * s + (peak - peak * s) * Math.exp(-(relStart - time - a) / tau);
      g.setValueAtTime(held, relStart);
      g.linearRampToValueAtTime(0, relStart + r);
      return relStart + r + 0.02;
    };

    const osc = (type: OscillatorType | PeriodicWave, f: number, detune = 0): OscillatorNode => {
      const o = ctx.createOscillator();
      if (type instanceof PeriodicWave) o.setPeriodicWave(type);
      else o.type = type;
      o.frequency.setValueAtTime(f, time);
      o.detune.value = detune;
      return o;
    };

    const run = (nodes: AudioScheduledSourceNode[], stopAt: number): void => {
      for (const n of nodes) {
        n.start(time);
        n.stop(stopAt);
      }
      nodes[0].onended = () => {
        out.disconnect();
        tail.disconnect();
      };
    };

    switch (inst) {
      case 'lead':
      case 'lead2':
      case 'pulse':
      case 'square': {
        const duty = inst === 'lead' ? 0.25 : inst === 'lead2' ? 0.125 : inst === 'pulse' ? 0.33 : 0.5;
        const o1 = osc(this.pulse(duty), freq, -4);
        const o2 = osc(this.pulse(duty), freq, 5);
        // gentle vibrato after the attack
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.5;
        const lg = ctx.createGain();
        lg.gain.setValueAtTime(0, time);
        lg.gain.linearRampToValueAtTime(dur > 0.25 ? freq * 0.006 : 0, time + Math.min(0.25, dur));
        lfo.connect(lg);
        lg.connect(o1.frequency);
        lg.connect(o2.frequency);
        const mixg = ctx.createGain();
        mixg.gain.value = 0.5;
        o1.connect(mixg);
        o2.connect(mixg);
        mixg.connect(out);
        const stop = env(0.006, 0.18, 0.72, 0.06);
        run([o1, o2, lfo], stop);
        break;
      }
      case 'brass': {
        const o1 = osc('sawtooth', freq, -6);
        const o2 = osc('sawtooth', freq, 6);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.Q.value = 2;
        f.frequency.setValueAtTime(freq * 1.5, time);
        f.frequency.linearRampToValueAtTime(freq * 6, time + 0.06);
        f.frequency.setTargetAtTime(freq * 3, time + 0.06, 0.12);
        o1.connect(f);
        o2.connect(f);
        f.connect(out);
        const stop = env(0.02, 0.25, 0.6, 0.08, vol * 0.6);
        run([o1, o2], stop);
        break;
      }
      case 'bass':
      case 'slap': {
        const o1 = osc(inst === 'bass' ? 'triangle' : 'sawtooth', freq);
        const o2 = osc(this.pulse(0.5), freq, 0);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(inst === 'slap' ? 2400 : 900, time);
        f.frequency.setTargetAtTime(inst === 'slap' ? 500 : 420, time, 0.08);
        const g2 = ctx.createGain();
        g2.gain.value = inst === 'bass' ? 0.35 : 0.2;
        o1.connect(f);
        o2.connect(g2).connect(f);
        f.connect(out);
        const stop = env(0.004, 0.2, inst === 'slap' ? 0.35 : 0.8, 0.05);
        run([o1, o2], stop);
        break;
      }
      case 'pluck': {
        const o1 = osc(this.pulse(0.25), freq);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(freq * 8, time);
        f.frequency.setTargetAtTime(freq * 1.2, time, 0.07);
        o1.connect(f).connect(out);
        const stop = env(0.002, 0.15, 0.0, 0.05);
        run([o1], Math.min(stop, time + 0.6));
        break;
      }
      case 'bell': {
        const o1 = osc('sine', freq);
        const o2 = osc('sine', freq * 2.76);
        const o3 = osc('sine', freq * 5.4);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.35, time);
        g2.gain.setTargetAtTime(0, time, 0.12);
        const g3 = ctx.createGain();
        g3.gain.setValueAtTime(0.15, time);
        g3.gain.setTargetAtTime(0, time, 0.05);
        o1.connect(out);
        o2.connect(g2).connect(out);
        o3.connect(g3).connect(out);
        g.setValueAtTime(0, time);
        g.linearRampToValueAtTime(vol, time + 0.003);
        g.setTargetAtTime(0, time + 0.003, Math.max(0.15, dur * 0.6));
        run([o1, o2, o3], time + Math.max(0.6, dur * 2.5));
        break;
      }
      case 'flute': {
        const o1 = osc('sine', freq);
        const o2 = osc('triangle', freq, 3);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5;
        const lg = ctx.createGain();
        lg.gain.value = freq * 0.008;
        lfo.connect(lg);
        lg.connect(o1.frequency);
        const g2 = ctx.createGain();
        g2.gain.value = 0.4;
        o1.connect(out);
        o2.connect(g2).connect(out);
        const stop = env(0.04, 0.2, 0.8, 0.1);
        run([o1, o2, lfo], stop);
        break;
      }
      case 'organ': {
        const o1 = osc('square', freq);
        const o2 = osc('sine', freq * 2);
        const o3 = osc('sine', freq / 2);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 2500;
        const m = ctx.createGain();
        m.gain.value = 0.35;
        o1.connect(m);
        o2.connect(m);
        o3.connect(m);
        m.connect(f).connect(out);
        const stop = env(0.01, 0.1, 0.9, 0.05);
        run([o1, o2, o3], stop);
        break;
      }
      case 'pad': {
        const o1 = osc('sawtooth', freq, -9);
        const o2 = osc('sawtooth', freq, 9);
        const o3 = osc('triangle', freq / 2);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = Math.min(3200, freq * 4);
        const m = ctx.createGain();
        m.gain.value = 0.3;
        o1.connect(m);
        o2.connect(m);
        o3.connect(m);
        m.connect(f).connect(out);
        const stop = env(0.12, 0.4, 0.8, 0.3);
        run([o1, o2, o3], stop);
        break;
      }
      case 'kick': {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(160, time);
        o.frequency.exponentialRampToValueAtTime(42, time + 0.12);
        o.connect(out);
        g.setValueAtTime(vol * 1.4, time);
        g.exponentialRampToValueAtTime(0.001, time + 0.25);
        run([o], time + 0.28);
        break;
      }
      case 'snare':
      case 'clap': {
        const n = this.noiseSource();
        const f = ctx.createBiquadFilter();
        f.type = inst === 'snare' ? 'highpass' : 'bandpass';
        f.frequency.value = inst === 'snare' ? 1200 : 1500;
        n.connect(f).connect(out);
        const nodes: AudioScheduledSourceNode[] = [n];
        if (inst === 'snare') {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.setValueAtTime(220, time);
          o.frequency.exponentialRampToValueAtTime(140, time + 0.08);
          const og = ctx.createGain();
          og.gain.setValueAtTime(0.7, time);
          og.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
          o.connect(og).connect(out);
          nodes.push(o);
        }
        g.setValueAtTime(vol, time);
        g.exponentialRampToValueAtTime(0.001, time + (inst === 'snare' ? 0.18 : 0.14));
        run(nodes, time + 0.22);
        break;
      }
      case 'hat':
      case 'ohat':
      case 'shaker': {
        const n = this.noiseSource();
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = inst === 'shaker' ? 5000 : 7000;
        n.connect(f).connect(out);
        const len = inst === 'ohat' ? 0.22 : inst === 'shaker' ? 0.06 : 0.04;
        g.setValueAtTime(vol * 0.7, time);
        g.exponentialRampToValueAtTime(0.001, time + len);
        run([n], time + len + 0.02);
        break;
      }
      case 'crash': {
        const n = this.noiseSource();
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 3500;
        n.connect(f).connect(out);
        g.setValueAtTime(vol * 0.7, time);
        g.exponentialRampToValueAtTime(0.001, time + 1.2);
        run([n], time + 1.25);
        break;
      }
      case 'tom': {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, time);
        o.frequency.exponentialRampToValueAtTime(freq * 0.55, time + 0.18);
        o.connect(out);
        g.setValueAtTime(vol, time);
        g.exponentialRampToValueAtTime(0.001, time + 0.3);
        run([o], time + 0.32);
        break;
      }
    }
  }

  /** NES-style voices: two pulse channels, triangle bass and a noise drum kit, no effects. */
  private retroNote(inst: InstrumentName, midi: number, time: number, dur: number, vol: number, dest: AudioNode): void {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(dest);
    const g = out.gain;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const stopAll = (nodes: AudioScheduledSourceNode[], at: number): void => {
      for (const n of nodes) {
        n.start(time);
        n.stop(at);
      }
      nodes[0].onended = () => out.disconnect();
    };
    const noiseBurst = (filterType: BiquadFilterType, f: number, len: number, level: number): void => {
      const n = this.noiseSource();
      const flt = ctx.createBiquadFilter();
      flt.type = filterType;
      flt.frequency.value = f;
      n.connect(flt).connect(out);
      g.setValueAtTime(level, time);
      g.exponentialRampToValueAtTime(0.001, time + len);
      stopAll([n], time + len + 0.02);
    };
    if (DRUMS.has(inst)) {
      switch (inst) {
        case 'kick': {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.setValueAtTime(180, time);
          o.frequency.exponentialRampToValueAtTime(50, time + 0.09);
          o.connect(out);
          g.setValueAtTime(vol * 1.3, time);
          g.exponentialRampToValueAtTime(0.001, time + 0.14);
          stopAll([o], time + 0.16);
          return;
        }
        case 'snare':
        case 'clap':
          noiseBurst('bandpass', 2200, 0.13, vol * 0.9);
          return;
        case 'hat':
        case 'shaker':
          noiseBurst('highpass', 9000, 0.03, vol * 0.5);
          return;
        case 'ohat':
          noiseBurst('highpass', 8000, 0.12, vol * 0.45);
          return;
        case 'crash':
          noiseBurst('highpass', 5000, 0.5, vol * 0.5);
          return;
        default:
          noiseBurst('lowpass', 900, 0.12, vol * 0.8);
          return;
      }
    }
    const o = ctx.createOscillator();
    const end = time + dur;
    if (inst === 'bass' || inst === 'slap') {
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, time);
      o.connect(out);
      g.setValueAtTime(vol * 1.1, time);
      g.setValueAtTime(vol * 1.1, Math.max(time, end - 0.01));
      g.linearRampToValueAtTime(0, end);
      stopAll([o], end + 0.02);
      return;
    }
    const duty = inst === 'lead2' ? 0.125 : inst === 'lead' || inst === 'pluck' || inst === 'bell' ? 0.25 : 0.5;
    o.setPeriodicWave(this.pulse(duty));
    o.frequency.setValueAtTime(freq, time);
    o.connect(out);
    const level = vol * (inst === 'pad' || inst === 'brass' || inst === 'organ' ? 0.55 : 0.8);
    g.setValueAtTime(level, time);
    g.setTargetAtTime(level * 0.6, time + 0.02, 0.12);
    const held = level * 0.6 + (level * 0.4) * Math.exp(-Math.max(0, end - time - 0.02) / 0.12);
    g.setValueAtTime(held, Math.max(time + 0.021, end - 0.012));
    g.linearRampToValueAtTime(0, end);
    stopAll([o], end + 0.02);
  }
}
