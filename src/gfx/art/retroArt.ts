/**
 * Original 8-bit style Bomberman frames for the Retro version: 16×16, three colours
 * plus black (like an NES sprite palette). Padded to 16×24 when compiled so they share
 * the drawing offsets of the modern sprites.
 */

export const RETRO_PALETTE: Record<string, string> = {
  k: '#000000',
  w: '#fcfcfc',
  s: '#fcb8a8',
  r: '#d82800',
};

const HEAD_FRONT = [
  '......kkkk......',
  '....kkwwwwkk....',
  '...kwwwwwwwwk...',
  '..kwwwwwwwwwwk..',
  '..kwkkkkkkkkwk..',
  '..kwksksskskwk..',
  '..kwksksskskwk..',
  '..kwksssssskwk..',
  '..kwwkkkkkkwwk..',
  '...kkwwwwwwkk...',
];

const HEAD_BACK = [
  '......kkkk......',
  '....kkwwwwkk....',
  '...kwwwwwwwwk...',
  '..kwwwwwwwwwwk..',
  '..kwwwwwwwwwwk..',
  '..kwwwwwwwwwwk..',
  '..kwwwwwwwwwwk..',
  '..kwwwwwwwwwwk..',
  '..kwwwwwwwwwwk..',
  '...kkwwwwwwkk...',
];

const HEAD_LEFT = [
  '......kkkk......',
  '....kkwwwwkk....',
  '...kwwwwwwwwk...',
  '..kwwwwwwwwwwk..',
  '..kkkkkkwwwwwk..',
  '..kskssswwwwwk..',
  '..kskssswwwwwk..',
  '..ksssskwwwwwk..',
  '..kkkkkwwwwwwk..',
  '...kkwwwwwwkk...',
];

const BODY_FRONT = [
  '.kskkwwwwwwkksk.',
  '.ksskwwwwwwkssk.',
  '..kkkwwwwwwkkk..',
  '....kwwkkwwk....',
  '...ksskkkssk....',
  '...kkkk..kkkk...',
];

const BODY_FRONT_A = [
  '.kskkwwwwwwkksk.',
  '.ksskwwwwwwkssk.',
  '..kkkwwwwwwkkk..',
  '....kwwkkwwk....',
  '...ksskkwwk.....',
  '...kkkk.kssk....',
];

const BODY_FRONT_B = [
  '.kskkwwwwwwkksk.',
  '.ksskwwwwwwkssk.',
  '..kkkwwwwwwkkk..',
  '....kwwkkwwk....',
  '.....kwwkkssk...',
  '....kssk.kkkk...',
];

const BODY_LEFT = [
  '...kskwwwwwk....',
  '..ksskwwwwwk....',
  '...kkkwwwwwk....',
  '....kwwkwwk.....',
  '...ksskssk......',
  '...kkkkkkk......',
];

const BODY_LEFT_A = [
  '...kskwwwwwk....',
  '..ksskwwwwwk....',
  '...kkkwwwwwk....',
  '...kwwk.kwwk....',
  '..kssk...kssk...',
  '..kkkk...kkkk...',
];

const BODY_LEFT_B = [
  '...kskwwwwwk....',
  '..ksskwwwwwk....',
  '...kkkwwwwwk....',
  '.....kwwwk......',
  '....ksssk.......',
  '....kkkkk.......',
];

const pad = (rows: string[]): string[] => [...Array(8).fill('................'), ...rows];
const f = (head: string[], body: string[]): string[] => pad([...head, ...body]);

export const RETRO_FRAMES = {
  down0: f(HEAD_FRONT, BODY_FRONT),
  down1: f(HEAD_FRONT, BODY_FRONT_A),
  down2: f(HEAD_FRONT, BODY_FRONT_B),
  up0: f(HEAD_BACK, BODY_FRONT),
  up1: f(HEAD_BACK, BODY_FRONT_A),
  up2: f(HEAD_BACK, BODY_FRONT_B),
  left0: f(HEAD_LEFT, BODY_LEFT),
  left1: f(HEAD_LEFT, BODY_LEFT_A),
  left2: f(HEAD_LEFT, BODY_LEFT_B),
};
