/**
 * Original pixel art for the bomber characters (16×24, feet on the bottom row,
 * the head overlapping the tile above like in the 16-bit/32-bit games).
 * Palette letters are remapped per player colour in sprites.ts.
 */

export const BOMBER_PALETTE: Record<string, string> = {
  k: '#000000', // outline
  W: '#ffffff', // helmet highlight
  w: '#e4e4f4', // helmet
  g: '#a4a4cc', // helmet shade
  s: '#ffcf9c', // skin
  S: '#ee9a6a', // skin shade
  e: '#1c1c3c', // eyes
  p: '#ff4f9a', // accent (antenna, gloves, boots)
  q: '#ffb0d6', // accent highlight
  P: '#b0205e', // accent shade
  c: '#6aa0ff', // suit highlight
  b: '#2c64ec', // suit
  B: '#1a3494', // suit shade
  y: '#ffe040', // belt
  Y: '#c08c00', // belt shade
};

// Head rows shared by several frames -------------------------------------------------
const HEAD_FRONT = [
  '.......kk.......',
  '......kqpk......',
  '......kppk......',
  '.......kk.......',
  '.....kkkkkk.....',
  '...kkWWwwwwkk...',
  '..kWWwwwwwwwgk..',
  '.kWWwwwwwwwwwgk.',
  'kWWwwwwwwwwwwwgk',
  'kWwwkkkkkkkkwwgk',
  'kwwksssssssskwgk',
  'kwwksesssseskwgk',
  'kwwksesssseskwgk',
  'kwwkSssssssSkwgk',
  'kgwwkkkkkkkkwggk',
  '.kggwwwwwwwwggk.',
  '..kkggggggggkk..',
];

const HEAD_BACK = [
  '.......kk.......',
  '......kqpk......',
  '......kppk......',
  '.......kk.......',
  '.....kkkkkk.....',
  '...kkWWwwwwkk...',
  '..kWWwwwwwwwgk..',
  '.kWWwwwwwwwwwgk.',
  'kWWwwwwwwwwwwwgk',
  'kWwwwwwwwwwwwwgk',
  'kwwwwwwwwwwwwggk',
  'kwwwwwwwwwwwwggk',
  'kwwwwwwwwwwwwggk',
  'kgwwwwwwwwwwwggk',
  'kggwwwwwwwwwgggk',
  '.kgggwwwwwwgggk.',
  '..kkggggggggkk..',
];

const HEAD_LEFT = [
  '.........kk.....',
  '........kqpk....',
  '........kppk....',
  '.........kk.....',
  '.....kkkkkk.....',
  '...kkWWwwwwkk...',
  '..kWWwwwwwwwgk..',
  '.kWWwwwwwwwwwgk.',
  'kWWwwwwwwwwwwwgk',
  'kkkkkkkkwwwwwwgk',
  'ksssssskwwwwwwgk',
  'ksesssskwwwwwwgk',
  'ksesssskwwwwwwgk',
  'kSssssskwwwwwggk',
  'kkkkkkkkwwwwwggk',
  '.kgwwwwwwwwgggk.',
  '..kkggggggggkk..',
];

// Bodies ------------------------------------------------------------------------------
const BODY_FRONT_STAND = [
  '.kqpkcbbbbBkpqk.',
  '.kppkcbbbbBkppk.',
  '..kkkyyyyyYkkk..',
  '....kbbkkbBk....',
  '...kqppkkqppk...',
  '...kpPPkkpPPk...',
  '...kkkkk.kkkk...',
];

const BODY_FRONT_WALK_A = [
  '.kqpkcbbbbBkpqk.',
  '.kppkcbbbbBkppk.',
  '..kkkyyyyyYkkk..',
  '....kbbkkbBk....',
  '...kqppk.kbBk...',
  '...kpPPk.kqppk..',
  '...kkkkk.kkkkk..',
];

const BODY_FRONT_WALK_B = [
  '.kqpkcbbbbBkpqk.',
  '.kppkcbbbbBkppk.',
  '..kkkyyyyyYkkk..',
  '....kbbkkbBk....',
  '...kbBk.kqppk...',
  '..kqppk.kpPPk...',
  '..kkkkk.kkkkk...',
];

const BODY_BACK_STAND = [
  '.kqpkBbbbbBkpqk.',
  '.kppkBbbbbBkppk.',
  '..kkkYyyyyYkkk..',
  '....kbbkkbBk....',
  '...kpppkkpppk...',
  '...kPPPkkPPPk...',
  '...kkkkk.kkkk...',
];

const BODY_BACK_WALK_A = [
  '.kqpkBbbbbBkpqk.',
  '.kppkBbbbbBkppk.',
  '..kkkYyyyyYkkk..',
  '....kbbkkbBk....',
  '...kpppk.kbBk...',
  '...kPPPk.kpppk..',
  '...kkkkk.kkkkk..',
];

const BODY_BACK_WALK_B = [
  '.kqpkBbbbbBkpqk.',
  '.kppkBbbbbBkppk.',
  '..kkkYyyyyYkkk..',
  '....kbbkkbBk....',
  '...kbBk.kpppk...',
  '..kpppk.kPPPk...',
  '..kkkkk.kkkkk...',
];

const BODY_LEFT_STAND = [
  '...kkkcbbbBk....',
  '..kqpkcbbbBk....',
  '..kppkyyyyYk....',
  '...kkkbbbbBk....',
  '....kbbkkbBk....',
  '..kqppkkppPk....',
  '..kkkkkkkkkk....',
];

const BODY_LEFT_WALK_A = [
  '...kkkcbbbBk....',
  '..kqpkcbbbBk....',
  '..kppkyyyyYk....',
  '...kkkbbbbBk....',
  '..kbbkk..kbBk...',
  '.kqppk...kppPk..',
  '.kkkkk...kkkkk..',
];

const BODY_LEFT_WALK_B = [
  '...kkkcbbbBk....',
  '..kqpkcbbbBk....',
  '..kppkyyyyYk....',
  '...kkkbbbbBk....',
  '.....kbbbBk.....',
  '....kqppPPk.....',
  '....kkkkkkk.....',
];

const f = (head: string[], body: string[]): string[] => [...head, ...body];

/** Walk cycles: [stand, stepA, stand, stepB]. Right-facing frames are mirrored from left. */
export const BOMBER_FRAMES = {
  down0: f(HEAD_FRONT, BODY_FRONT_STAND),
  down1: f(HEAD_FRONT, BODY_FRONT_WALK_A),
  down2: f(HEAD_FRONT, BODY_FRONT_WALK_B),
  up0: f(HEAD_BACK, BODY_BACK_STAND),
  up1: f(HEAD_BACK, BODY_BACK_WALK_A),
  up2: f(HEAD_BACK, BODY_BACK_WALK_B),
  left0: f(HEAD_LEFT, BODY_LEFT_STAND),
  left1: f(HEAD_LEFT, BODY_LEFT_WALK_A),
  left2: f(HEAD_LEFT, BODY_LEFT_WALK_B),
};
