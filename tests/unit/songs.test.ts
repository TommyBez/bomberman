import { describe, expect, it } from 'vitest';
import { compileSong, parseTrack } from '../../src/audio/sequencer';
import { SONGS } from '../../src/audio/songs';
import { BATTLE_STAGE_MUSIC } from '../../src/audio/battleSongs';
import { ARENAS } from '../../src/game/battle/arenas';
import { DRUMS } from '../../src/audio/synth';

describe('songs', () => {
  for (const [name, song] of Object.entries(SONGS)) {
    it(`${name}: every track parses into whole bars of equal length`, () => {
      const lengths = song.tracks.map((t) => parseTrack(t.data, DRUMS.has(t.inst)).length);
      for (const len of lengths) expect(len % 16, `${name} track length ${len}`).toBe(0);
      expect(new Set(lengths).size, `${name} lengths ${lengths.join(',')}`).toBe(1);
      const compiled = compileSong(song);
      expect(compiled.length).toBe(lengths[0]);
    });

    it(`${name}: every bar line falls on a bar boundary`, () => {
      for (const t of song.tracks) {
        const drums = DRUMS.has(t.inst);
        let step = 0;
        t.data.split('|').forEach((seg, i) => {
          step += parseTrack(seg, drums).length;
          expect(step % 16, `${name} ${t.inst}: bar line ${i + 1} is at step ${step}`).toBe(0);
        });
      }
    });
  }

  it('parses notes, chords, ties and repeats', () => {
    const { events, length } = parseTrack('L2 C4 E4+G4:4 ~:2 r [D4]3', false);
    expect(length).toBe(2 + 4 + 2 + 2 + 6);
    expect(events[0]).toMatchObject({ step: 0, len: 2, notes: [60] });
    expect(events[1]).toMatchObject({ step: 2, len: 6, notes: [64, 67] });
    expect(events.slice(2).map((e) => e.step)).toEqual([10, 12, 14]);
  });

  it('every battle stage theme is a real song, keyed by a real stage', () => {
    const ids = new Set(ARENAS.map((a) => a.id));
    for (const [id, song] of Object.entries(BATTLE_STAGE_MUSIC)) {
      expect(ids.has(id), id).toBe(true);
      expect(SONGS[song], song).toBeDefined();
    }
  });
});
