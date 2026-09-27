/**
 * One-bar drum patterns (16 steps) shared by the songs; see sequencer.ts for the letters.
 * Each style has a matching fill for the last bar of a phrase.
 */

export const DRUM_BEAT = 'k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2';
export const DRUM_FILL = 'k:2 h:2 s:2 h:2 k:2 s:1 s:1 t:2 m:1 f:1';
export const ROCK_BEAT = 'k:2 h:2 s:2 h:1 k:1 k:2 h:2 s:2 h:2';
export const ROCK_FILL = 'k:2 h:2 s:2 h:1 k:1 s:1 s:1 s:1 s:1 t:1 t:1 m:1 f:1';
/** Handclaps on the backbeat and a skip on the "and" of three. */
export const CLAP_BEAT = 'k:2 h:2 p:2 h:2 k:2 k:2 p:2 h:2';
export const CLAP_FILL = 'k:2 h:2 p:2 h:2 k:2 p:1 p:1 t:2 m:1 f:1';
/** Light shaker groove. */
export const SOFT_BEAT = 'k:4 z:2 z:2 p:4 z:2 z:2';
export const SOFT_FILL = 'k:4 z:2 z:2 p:2 p:2 t:2 m:1 f:1';
/** Toms under the backbeat. */
export const TRIBAL_BEAT = 'k:2 t:2 m:2 h:2 s:2 t:1 t:1 m:2 f:2';
export const TRIBAL_FILL = 'k:2 t:1 t:1 m:1 m:1 f:2 s:1 s:1 s:1 s:1 t:1 m:1 f:2';
/** Rolling toms for the jungle. */
export const JUNGLE_BEAT = 'k:2 t:1 t:1 s:2 m:2 k:1 k:1 t:2 s:2 f:2';
export const JUNGLE_FILL = 't:1 t:1 m:1 m:1 f:2 k:2 t:1 t:1 m:1 m:1 f:1 f:1 c:2';
/** Syncopated kick for the funk tunes. */
export const FUNK_BEAT = 'k:2 h:1 k:1 s:2 h:1 k:1 h:2 k:2 s:2 h:2';
export const FUNK_FILL = 'k:2 h:1 k:1 s:2 h:1 k:1 s:1 s:1 t:1 t:1 m:1 m:1 f:2';
/** Train-wheel gallop. */
export const GALLOP_BEAT = 'k:2 h:1 h:1 s:2 h:1 h:1 k:2 h:1 h:1 s:2 h:1 h:1';
export const GALLOP_FILL = 'k:2 h:1 h:1 s:2 h:1 h:1 s:1 s:1 s:1 s:1 t:1 m:1 f:2';
/** A lilt for the sea shanty. */
export const SWAY_BEAT = 'k:4 h:2 h:2 s:4 h:2 h:2';
export const SWAY_FILL = 'k:4 h:2 h:2 s:2 s:1 s:1 t:2 f:2';
/** Circus march. */
export const MARCH_BEAT = 'k:4 s+h:4 k:4 s+h:4';
export const MARCH_FILL = 'k:4 s:4 s:2 s:2 s:1 s:1 c:2';
/** Open hats on the off-beats, for the game show. */
export const DISCO_BEAT = 'k:2 o:2 k+s:2 o:2 k:2 o:2 k+s:2 o:2';
export const DISCO_FILL = 'k:2 o:2 k+s:2 o:2 s:1 s:1 s:1 s:1 t:1 m:1 f:1 c:1';

/** Sixteen bars of `beat` with `fill` closing each eight. */
export function sixteenBars(beat: string, fill: string): string {
  return `[${beat}]7 ${fill} | [${beat}]7 ${fill}`;
}
