import { load, save } from '../engine/storage';
import { compileSong, MusicPlayer, type CompiledSong, type SongDef } from './sequencer';
import { SFX } from './sfx';
import { Synth } from './synth';

export interface AudioSettings {
  music: number; // 0..10
  sfx: number; // 0..10
}

/**
 * Front door for all sound. Safe to call before the browser allows audio: requests
 * are remembered and the current song starts as soon as the first gesture unlocks
 * the AudioContext.
 */
export class AudioManager {
  private synth: Synth | null = null;
  private player: MusicPlayer | null = null;
  private compiled = new Map<string, CompiledSong>();
  private wanted: { name: string; onEnd?: () => void } | null = null;
  private current: string | null = null;
  private lastSfx = new Map<string, number>();
  private stereo = true;
  readonly settings: AudioSettings;

  constructor(private readonly songs: Record<string, SongDef>) {
    const stored = load<Partial<AudioSettings>>('audio', {});
    const vol = (v: unknown, d: number): number => (typeof v === 'number' && v >= 0 && v <= 10 ? Math.round(v) : d);
    this.settings = { music: vol(stored.music, 7), sfx: vol(stored.sfx, 8) };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        const ctx = this.synth?.ctx;
        if (!ctx) return;
        if (document.hidden) void ctx.suspend();
        else void ctx.resume();
      });
    }
  }

  get unlocked(): boolean {
    return this.synth !== null && this.synth.ctx.state === 'running';
  }

  /** Must be called from a user gesture handler. */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.synth) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.synth = new Synth(new Ctor({ latencyHint: 'interactive' }));
      } catch {
        return;
      }
      this.player = new MusicPlayer(this.synth);
      this.applyVolumes();
      this.setStereo(this.stereo);
    }
    const ctx = this.synth.ctx;
    if (ctx.state !== 'running') {
      void ctx.resume().then(() => this.startWanted());
    } else {
      this.startWanted();
    }
  }

  private startWanted(): void {
    if (this.wanted && this.player && !this.player.playing) {
      const w = this.wanted;
      this.playNow(w.name, w.onEnd);
    }
  }

  applyVolumes(): void {
    if (!this.synth) return;
    const curve = (v: number): number => Math.pow(v / 10, 1.6);
    this.synth.musicBus.gain.value = curve(this.settings.music) * 0.55;
    this.synth.sfxBus.gain.value = curve(this.settings.sfx) * 0.9;
    save('audio', this.settings);
  }

  /** STEREO / MONO output (mono downmixes at the destination). */
  setStereo(on: boolean): void {
    this.stereo = on;
    const dest = this.synth?.ctx.destination;
    if (!dest) return;
    try {
      dest.channelCountMode = 'explicit';
      dest.channelInterpretation = 'speakers';
      dest.channelCount = on ? Math.min(2, dest.maxChannelCount) : 1;
    } catch {
      // Some browsers refuse to change the destination layout; keep the default.
    }
  }

  /** Start a song (restarts it if `restart`, otherwise keeps playing if already current). */
  music(name: string, opts: { restart?: boolean; onEnd?: () => void } = {}): void {
    if (!opts.restart && this.current === name && this.player?.playing) return;
    this.wanted = { name, onEnd: opts.onEnd };
    this.current = name;
    if (this.player && this.unlocked) this.playNow(name, opts.onEnd);
  }

  private playNow(name: string, onEnd?: () => void): void {
    const def = this.songs[name];
    if (!def || !this.player) return;
    let c = this.compiled.get(name);
    if (!c) {
      c = compileSong(def);
      this.compiled.set(name, c);
    }
    this.player.play(c, () => {
      if (this.current === name) {
        this.current = null;
        this.wanted = null;
      }
      onEnd?.();
    });
  }

  stopMusic(fade = 0.1): void {
    this.wanted = null;
    this.current = null;
    this.player?.stop(fade);
  }

  tempo(scale: number): void {
    this.player?.setTempoScale(scale);
  }

  get song(): string | null {
    return this.current;
  }

  sfx(name: string): void {
    const s = this.synth;
    if (!s || s.ctx.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    // Throttle identical effects (e.g. ten bombs chaining in the same frame).
    const now = s.ctx.currentTime;
    const last = this.lastSfx.get(name) ?? -1;
    if (now - last < 0.035) return;
    this.lastSfx.set(name, now);
    fn(s, now + 0.005, s.sfxBus);
  }
}
