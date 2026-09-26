import { DRUMS, type InstrumentName, type Synth } from './synth';

/**
 * Song notation (one string per track), step = 1/16 note:
 *   C5:4      note C in octave 5, 4 steps long      (octave may be omitted → previous)
 *   C#5 Eb4   sharps / flats
 *   C4+E4+G4  chord
 *   r:2       rest                 ~:2  tie (extend previous note)
 *   L2        default length for tokens without ':n'
 *   > <       octave up / down for tokens that omit their octave
 *   [ ... ]3  repeat group 3 times (nestable; no count = play once)
 *   |         bar line (ignored)
 * Drum tracks use letters: k kick, s snare, h hat, o open hat, c crash, t/m/f toms,
 * p clap, z shaker — combine with '+', e.g. "k+h:2".
 */

export interface TrackDef {
  inst: InstrumentName;
  vol: number;
  pan?: number;
  send?: number;
  /** Transpose in semitones. */
  tr?: number;
  data: string;
}

export interface SongDef {
  bpm: number;
  /** Render with NES-style voices (pulse / triangle / noise, no reverb). */
  retro?: boolean;
  /** Step to jump back to when looping (default 0). */
  loopStep?: number;
  loop: boolean;
  tracks: TrackDef[];
}

interface NoteEvent {
  step: number;
  len: number;
  notes: number[];
  drums: InstrumentName[];
}

const DRUM_KEYS: Record<string, [InstrumentName, number]> = {
  k: ['kick', 36], s: ['snare', 38], h: ['hat', 42], o: ['ohat', 46], c: ['crash', 49],
  t: ['tom', 57], m: ['tom', 52], f: ['tom', 45], p: ['clap', 39], z: ['shaker', 70],
};

const NOTE_BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function expandRepeats(src: string): string {
  // Innermost-first expansion of [ ... ]n groups.
  const re = /\[([^[\]]*)\](\d*)/;
  let s = src;
  for (let guard = 0; guard < 1000 && re.test(s); guard++) {
    s = s.replace(re, (_m, body: string, n: string) => {
      const times = n ? parseInt(n, 10) : 1;
      return Array(times).fill(body).join(' ');
    });
  }
  return s;
}

export function parseTrack(data: string, drumTrack: boolean): { events: NoteEvent[]; length: number } {
  const tokens = expandRepeats(data).replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
  const events: NoteEvent[] = [];
  let step = 0;
  let defLen = 4;
  let octave = 4;
  let last: NoteEvent | null = null;
  for (const tok of tokens) {
    if (tok === '>') {
      octave++;
      continue;
    }
    if (tok === '<') {
      octave--;
      continue;
    }
    if (/^L\d+$/.test(tok)) {
      defLen = parseInt(tok.slice(1), 10);
      continue;
    }
    const [body, lenStr] = tok.split(':');
    const len = lenStr ? parseFloat(lenStr) : defLen;
    if (body === 'r') {
      step += len;
      last = null;
      continue;
    }
    if (body === '~' || body === '-') {
      if (last) last.len += len;
      step += len;
      continue;
    }
    const ev: NoteEvent = { step, len, notes: [], drums: [] };
    for (const part of body.split('+')) {
      if (drumTrack) {
        const d = DRUM_KEYS[part];
        if (!d) throw new Error(`Unknown drum "${part}" in "${tok}"`);
        ev.drums.push(d[0]);
        ev.notes.push(d[1]);
      } else {
        const m = /^([A-G])([#b]?)(-?\d)?$/.exec(part);
        if (!m) throw new Error(`Bad note "${part}" in "${tok}"`);
        if (m[3] !== undefined) octave = parseInt(m[3], 10);
        const semis = NOTE_BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
        ev.notes.push((octave + 1) * 12 + semis);
      }
    }
    events.push(ev);
    last = ev;
    step += len;
  }
  return { events, length: step };
}

export interface CompiledSong {
  def: SongDef;
  length: number;
  byStep: Map<number, { track: TrackDef; ev: NoteEvent }[]>;
}

export function compileSong(def: SongDef): CompiledSong {
  const byStep = new Map<number, { track: TrackDef; ev: NoteEvent }[]>();
  let length = 0;
  for (const track of def.tracks) {
    const { events, length: len } = parseTrack(track.data, DRUMS.has(track.inst));
    length = Math.max(length, len);
    for (const ev of events) {
      const list = byStep.get(ev.step) ?? [];
      list.push({ track, ev });
      byStep.set(ev.step, list);
    }
  }
  return { def, length, byStep };
}

/** Lookahead scheduler: queues notes slightly ahead of the audio clock. */
export class MusicPlayer {
  private song: CompiledSong | null = null;
  private bus: GainNode | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tempoScale = 1;
  private onEnd: (() => void) | null = null;

  constructor(private readonly synth: Synth) {}

  get playing(): boolean {
    return this.song !== null;
  }

  play(song: CompiledSong, onEnd?: () => void): void {
    this.stop(0.03);
    const ctx = this.synth.ctx;
    this.song = song;
    this.onEnd = onEnd ?? null;
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(this.synth.musicBus);
    this.step = 0;
    this.tempoScale = 1;
    this.nextTime = ctx.currentTime + 0.06;
    this.timer = setInterval(() => this.pump(), 25);
    this.pump();
  }

  setTempoScale(scale: number): void {
    this.tempoScale = scale;
  }

  stop(fade = 0.08): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const bus = this.bus;
    if (bus) {
      const t = this.synth.ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + fade);
      setTimeout(() => bus.disconnect(), (fade + 0.5) * 1000);
    }
    this.bus = null;
    this.song = null;
  }

  private pump(): void {
    const song = this.song;
    const bus = this.bus;
    if (!song || !bus) return;
    const ctx = this.synth.ctx;
    const stepDur = 60 / (song.def.bpm * this.tempoScale) / 4;
    // If the page stalled, skip ahead instead of bunching notes together.
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.02;
    while (this.nextTime < ctx.currentTime + 0.15) {
      if (this.step >= song.length) {
        if (song.def.loop) {
          this.step = song.def.loopStep ?? 0;
        } else {
          const cb = this.onEnd;
          const endAt = this.nextTime;
          if (this.timer) clearInterval(this.timer);
          this.timer = null;
          this.song = null;
          if (cb) setTimeout(cb, Math.max(0, (endAt - ctx.currentTime) * 1000));
          return;
        }
      }
      const list = song.byStep.get(this.step);
      if (list) {
        for (const { track, ev } of list) {
          const dur = ev.len * stepDur * 0.92;
          if (ev.drums.length) {
            for (let i = 0; i < ev.drums.length; i++) {
              this.synth.note(ev.drums[i], ev.notes[i], this.nextTime, dur, track.vol, bus, track.pan ?? 0, track.send ?? 0.15, song.def.retro);
            }
          } else {
            for (const n of ev.notes) {
              this.synth.note(track.inst, n + (track.tr ?? 0), this.nextTime, dur, track.vol, bus, track.pan ?? 0, track.send ?? 0.3, song.def.retro);
            }
          }
        }
      }
      this.step++;
      this.nextTime += stepDur;
    }
  }
}
