/**
 * Things that happened during a simulation tick. The simulation never touches audio
 * or the DOM; scenes read these events to play sounds, shake the screen, pop scores…
 */
export type GameEvent =
  | { type: 'bomb'; tx: number; ty: number }
  | { type: 'explode'; tx: number; ty: number; size: number }
  | { type: 'block'; tx: number; ty: number }
  | { type: 'item'; tx: number; ty: number; item: string; who: number }
  | { type: 'itemBurn'; tx: number; ty: number }
  | { type: 'death'; who: number }
  | { type: 'enemyDeath'; x: number; y: number; points: number; kind: string }
  | { type: 'score'; x: number; y: number; points: number }
  | { type: 'door'; tx: number; ty: number }
  | { type: 'doorOpen' }
  | { type: 'spawn'; tx: number; ty: number }
  | { type: 'kick'; tx: number; ty: number }
  | { type: 'punch'; tx: number; ty: number }
  | { type: 'bounce'; tx: number; ty: number }
  | { type: 'land'; tx: number; ty: number }
  | { type: 'stun'; who: number }
  | { type: 'skull'; who: number; curse: string }
  | { type: 'warp'; tx: number; ty: number }
  | { type: 'jump'; tx: number; ty: number }
  | { type: 'hurry' }
  | { type: 'pressure'; tx: number; ty: number }
  | { type: 'timeUp' }
  | { type: 'stageClear' }
  | { type: 'shake'; frames: number };
