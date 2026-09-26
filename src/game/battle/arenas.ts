import type { Dir } from '../core/types';
import type { BattleItem, Level } from './config';

/**
 * The 24 battle stages (3 levels × 8), laid out as 15×13 ASCII maps.
 *
 *   #  hard block          .  floor (random soft block)   _  floor, never a soft block
 *   x  soft block always   1-5 start positions             O  regenerating tyre (soft block)
 *   > < ^ v  conveyor belt   R L U D  floor arrow (redirects kicked bombs)   @  rotating arrow
 *   W  warp hole   T  trampoline   S  seesaw end (two in a row form one seesaw)
 *   a-e  speed sign 1-5   !  stop sign   =  rail   s  switch
 *   P  pipe (hides)   H  snow hut (hides, max fire)   F  foliage (hides, max fire)
 *   ~  water   b  deck / bridge (never soft)   i  cracked ice   G  flower door (turnstile)
 *   p  pipe mouth: blasts and kicked bombs travel to its partner
 *   J  bend pipe (see `bends`)   w  border gap that wraps to the other side
 */

export type Gimmick =
  | 'seesaw'
  | 'seesawLinked'
  | 'signs'
  | 'train'
  | 'arrows'
  | 'pipes'
  | 'conveyor'
  | 'warp'
  | 'center'
  | 'clouds'
  | 'switcheroo'
  | 'blockworld'
  | 'portals'
  | 'switchbelt'
  | 'winter'
  | 'superpower'
  | 'robot'
  | 'flowers'
  | 'mystery'
  | 'jungle'
  | 'incoming'
  | 'fastlane'
  | 'seas';

export interface ArenaDef {
  id: string;
  name: string;
  jpName: string;
  level: Level;
  gimmick: Gimmick | null;
  blurb: string;
  map: string[];
  /** Colour theme for tiles. */
  theme: string;
  /** Fraction of '.' tiles that get a soft block. */
  density: number;
  /** Stage-specific item counts (merged over the level defaults). */
  items?: Partial<Record<BattleItem, number>>;
  /** Bend pipes ('J'): "x,y" → incoming direction → outgoing direction. */
  bends?: Record<string, Partial<Record<Dir, Dir>>>;
  /** Linked pipe mouths ('p'). */
  portalPairs?: [[number, number], [number, number]][];
  /** Trampolines ('T') that bounce you onto each other (two-floor stages). */
  trampolinePairs?: [[number, number], [number, number]][];
  /** Rows (inclusive) drawn as the lower, cloud floor. */
  lowerFloor?: [number, number];
  /** Rails: stop stations (tiles where the trolley pauses). */
  stations?: [number, number][];
  /**
   * Changing rails: layouts drawn from tile (3, 3) ('=' rail, 'W' trolley warp). The
   * rails switch between them at random; the alternate stage adds `altRailLayouts`.
   */
  railLayouts?: string[][];
  altRailLayouts?: string[][];
  /** Round and Round: which way each flower's mouth faces at the start ("x,y"). */
  flowerFaces?: Record<string, Dir>;
  /** Area spared by the sudden-death blocks (inclusive tile rectangle). */
  refuge?: [number, number, number, number];
  /** Players start with maximum fire. */
  maxFire?: boolean;
  /** Trolley starts here heading this way. */
  trolley?: { x: number; y: number; dir: Dir; warps?: boolean };
  spawns?: [number, number][];
  extraHard?: [number, number][];
  removeHard?: [number, number][];
  noSoft?: [number, number][];
  /** The alternate ("ura") version of a stage. */
  alternate?: boolean;
  /** Which fixed block pattern the alternate uses (by default it follows the stage order). */
  altPattern?: number;
}

const STD = [
  '###############',
  '#1_........._3#',
  '#_#.#.#.#.#.#_#',
  '#.............#',
  '#.#.#.#.#.#.#.#',
  '#.............#',
  '#.#.#.#5#.#.#.#',
  '#.............#',
  '#.#.#.#.#.#.#.#',
  '#.............#',
  '#_#.#.#.#.#.#_#',
  '#4_........._2#',
  '###############',
];

/** Rail layouts are drawn from this tile (x and y). */
export const RAIL_ORIGIN = 3;

/**
 * Switcheroo's rail layouts (x 3–11, y 3–9): three on the stage, three more on its
 * alternate. Every layout runs down columns 3 and 11 so both stations stay on the rails.
 */
const SWITCHEROO_RAILS: string[][] = [
  ['=========', '=...=...=', '=...=...=', '=...=...=', '=...=...=', '=...=...=', '========='],
  ['=========', '=.......=', '=.......=', '=.......=', '=========', '=.......=', '========='],
  ['=========', '=.......=', '=====...=', '=...=...=', '=...=====', '=.......=', '========='],
  ['=========', '=.=.....=', '=.=.....=', '=.=.....=', '=.=======', '=.=.....=', '========='],
  ['=========', '=...=...=', '=...=...=', '=...=...=', '=========', '=.......=', '========='],
  ['=====....', '=...=....', '=...=....', '=...=...=', '=========', '=.......=', '========='],
];

/**
 * Destination Unknown's layouts: the warp holes ('W') at (7, 3) and (7, 9) are always there,
 * and nothing runs next to the centre start at (7, 7).
 */
const MYSTERY_RAILS: string[][] = [
  ['====W====', '=.......=', '=.......=', '=.......=', '=.......=', '=.......=', '====W===='],
  ['====W====', '=.......=', '=========', '=.......=', '=.......=', '=.......=', '====W===='],
  ['====W====', '=.=...=.=', '=.=...=.=', '=.=...=.=', '=.=...=.=', '=.=...=.=', '====W===='],
  ['====W====', '=.=.....=', '===.....=', '=.......=', '=.....===', '=.....=.=', '====W===='],
  ['====W====', '=...=...=', '=========', '=.......=', '=.......=', '=.......=', '====W===='],
  ['====W....', '=...=....', '=========', '=.......=', '=.......=', '=.......=', '=...W===='],
];

/**
 * Keep the tiles the stage's rail layouts use free of soft blocks. (The alternate's extra
 * layouts may run under blocks: the trolley smashes them.)
 */
function reserveRails(map: string[], layouts: string[][]): string[] {
  const rows = map.map((r) => [...r]);
  for (const layout of layouts) {
    layout.forEach((row, dy) =>
      [...row].forEach((ch, dx) => {
        const y = RAIL_ORIGIN + dy;
        const x = RAIL_ORIGIN + dx;
        if (ch !== '.' && rows[y][x] === '.') rows[y][x] = '_';
      }),
    );
  }
  return rows.map((r) => r.join(''));
}

export const ARENAS: ArenaDef[] = [
  // ------------------------------------------------------------------ BEGINNER
  {
    id: 'b1', name: 'NORMAL', jpName: 'STANDARD', level: 'beginner', gimmick: null, theme: 'battle', density: 0.7,
    blurb: 'THE CLASSIC ARENA. NO TRAPS.',
    map: STD,
  },
  {
    id: 'b2', name: 'SEESAW PARK', jpName: 'SEESAW PARK', level: 'beginner', gimmick: 'seesaw', theme: 'park', density: 0.5,
    blurb: 'STEP ON A SEESAW TO LAUNCH WHAT IS ON THE OTHER END.',
    items: { bomb: 5, fire: 5, speed: 3, skull: 2, kick: 0 },
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#..SS.....SS..#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#.#.#5#.#.#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#..SS.....SS..#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  {
    id: 'b3', name: 'LIFE IN THE SLOW LANE', jpName: 'NORONORO BYUN', level: 'beginner', gimmick: 'signs', theme: 'road', density: 0,
    blurb: 'SIGNS SET YOUR SPEED. "!" STOPS YOU COLD.',
    items: { bomb: 3, fire: 3, speed: 1, kick: 1, skull: 1 },
    spawns: [[1, 1], [13, 11], [13, 1], [1, 11], [7, 9]],
    map: [
      '###############',
      '#1_e........_3#',
      '#_#.#.#.#.#.#_#',
      '#....c.!.b....#',
      '#.#.#.#.#.#.#.#',
      '#a.........!..#',
      '#.#.#.#O#.#.#.#',
      '#..!.........a#',
      '#.#.#.#.#.#.#.#',
      '#d...b.5.c....#',
      '#_#.#.#.#.#.#_#',
      '#4_........e_2#',
      '###############',
    ],
  },
  {
    id: 'b4', name: 'TAKE THE TRAIN', jpName: 'GO GO TROCCO', level: 'beginner', gimmick: 'train', theme: 'mine', density: 0.6,
    blurb: 'RIDE THE TROLLEY. DON\'T GET HIT BY IT! SWITCH CHANGES ROUTE.',
    spawns: [[1, 1], [13, 11], [13, 1], [1, 11], [9, 5]],
    stations: [[3, 6], [11, 6]],
    trolley: { x: 3, y: 3, dir: 'right' },
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#..=========..#',
      '#.#=#.#=#.#=#.#',
      '#..=...=.5.=..#',
      '#s#=#.#=#.#=#.#',
      '#..=...=...=..#',
      '#.#=#.#=#.#=#.#',
      '#..=========..#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  {
    id: 'b5', name: 'ONE-WAY STREET', jpName: 'MAGATTE BON', level: 'beginner', gimmick: 'arrows', theme: 'street', density: 0.6,
    blurb: 'FLOOR ARROWS TURN KICKED BOMBS.',
    items: { kick: 4 },
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#..R...D...D..#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#R#.#5#.#L#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#..U...U...L..#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  {
    id: 'b6', name: 'PIPE CITY', jpName: 'DOKAN DE BOKAN', level: 'beginner', gimmick: 'pipes', theme: 'city', density: 0.55,
    blurb: 'PIPES HIDE BOMBERS AND BOMBS.',
    map: [
      '###############',
      '#1_....P...._3#',
      '#_#.#.#P#.#.#_#',
      '#......P......#',
      '#.#.#.#.#.#.#.#',
      '#PPPPP........#',
      '#.#.#.#5#.#.#.#',
      '#........PPPPP#',
      '#.#.#.#.#.#.#.#',
      '#......P......#',
      '#_#.#.#P#.#.#_#',
      '#4_....P...._2#',
      '###############',
    ],
  },
  {
    id: 'b7', name: 'FACTORY', jpName: 'GURUGURU BELCON', level: 'beginner', gimmick: 'conveyor', theme: 'factory', density: 0.55,
    blurb: 'CONVEYOR BELTS CARRY BOMBERS AND BOMBS.',
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#..>>>>>>>>v..#',
      '#.#^#.#.#.#v#.#',
      '#..^.......v..#',
      '#.#^#.#5#.#v#.#',
      '#..^.......v..#',
      '#.#^#.#.#.#v#.#',
      '#..^<<<<<<<<..#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  {
    id: 'b8', name: 'WARP DESERT', jpName: 'SARASARA WARP', level: 'beginner', gimmick: 'warp', theme: 'desert', density: 0.55,
    blurb: 'WARP HOLES SEND YOU TO ANOTHER HOLE.',
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#........W....#',
      '#.#.#.#.#.#.#.#',
      '#..W..........#',
      '#.#.#.#5#.#.#.#',
      '#..........W..#',
      '#.#.#.#.#.#.#.#',
      '#....W........#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  // ------------------------------------------------------------------ NORMAL
  {
    id: 'n1', name: 'ALL TOGETHER NOW', jpName: 'USHIRO NO SHOUMEN', level: 'normal', gimmick: 'center', theme: 'battle', density: 0.65,
    blurb: 'EVERYONE STARTS TOGETHER IN THE MIDDLE!',
    spawns: [[5, 5], [9, 7], [9, 5], [5, 7], [7, 6]],
    map: [
      '###############',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#....1_._3....#',
      '#.#.#_#5#_#.#.#',
      '#....4_._2....#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '###############',
    ],
  },
  {
    id: 'n2', name: 'SEESAW LAND', jpName: 'SEESAW LAND', level: 'normal', gimmick: 'seesawLinked', theme: 'park', density: 0.5,
    blurb: 'ALL THE SEESAWS ARE LINKED AND MOVE TOGETHER.',
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#..SS.....SS..#',
      '#.#.#.#.#.#.#.#',
      '#......SS.....#',
      '#.#.#.#5#.#.#.#',
      '#.....SS......#',
      '#.#.#.#.#.#.#.#',
      '#..SS.....SS..#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  {
    id: 'n3', name: 'HEAD IN THE CLOUDS', jpName: 'FUWAFUWA BON', level: 'normal', gimmick: 'clouds', theme: 'sky', density: 0.5,
    blurb: 'TWO FLOORS: THE SKY ABOVE, THE CLOUDS BELOW. TRAMPOLINES TAKE YOU BETWEEN THEM.',
    lowerFloor: [7, 11],
    trampolinePairs: [
      [[7, 1], [7, 9]],
      [[4, 5], [4, 7]],
      [[10, 5], [10, 7]],
    ],
    map: [
      '###############',
      '#1_....T...._3#',
      '#_#.#.#.#.#.#_#',
      '#......5......#',
      '#.#.#.#.#.#.#.#',
      '#...T.....T...#',
      '###############',
      '#...T.....T...#',
      '#.#.#.#.#.#.#.#',
      '#......T......#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  {
    id: 'n4', name: 'SWITCHEROO', jpName: 'KARAKURI TROCCO', level: 'normal', gimmick: 'switcheroo', theme: 'mine', density: 0.55,
    blurb: 'THE RAILS ARE RELAID AT RANDOM. WATCH WHERE THE TROLLEY GOES!',
    spawns: [[1, 1], [13, 11], [13, 1], [1, 11], [9, 5]],
    stations: [[3, 6], [11, 6]],
    trolley: { x: 3, y: 3, dir: 'right' },
    railLayouts: SWITCHEROO_RAILS.slice(0, 3),
    altRailLayouts: SWITCHEROO_RAILS.slice(3),
    altPattern: 4, // the rails leave little room: a denser pattern
    map: reserveRails(
      [
        '###############',
        '#1_........._3#',
        '#_#.#.#.#.#.#_#',
        '#.............#',
        '#.#.#.#.#.#.#.#',
        '#........5....#',
        '#.#.#.#.#.#.#.#',
        '#.............#',
        '#.#.#.#.#.#.#.#',
        '#.............#',
        '#_#.#.#.#.#.#_#',
        '#4_........._2#',
        '###############',
      ],
      SWITCHEROO_RAILS.slice(0, 3),
    ),
  },
  {
    id: 'n5', name: 'BLOCK WORLD', jpName: 'BLOCK WORLD', level: 'normal', gimmick: 'blockworld', theme: 'toy', density: 0.55,
    blurb: 'SOME ARROWS SPIN, SENDING KICKED BOMBS EVERYWHERE.',
    items: { kick: 4 },
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#..R...D...D..#',
      '#.#.#.#.#.#.#.#',
      '#..@.......@..#',
      '#.#.#.#5#.#.#.#',
      '#..@.......@..#',
      '#.#.#.#.#.#.#.#',
      '#..U...U...L..#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  {
    id: 'n6', name: 'EVERY WHICH WAY', jpName: 'KARAKURI DOKAN', level: 'normal', gimmick: 'portals', theme: 'city', density: 0.55,
    blurb: 'A BLAST ENTERING ONE PIPE COMES OUT OF ITS PARTNER.',
    portalPairs: [[[7, 2], [7, 10]], [[1, 6], [13, 6]]],
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#p#.#.#_#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#p#.#.#5#.#.#p#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#_#.#.#p#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  {
    id: 'n7', name: 'COMING AND GOING', jpName: 'SWITCH BELCON', level: 'normal', gimmick: 'switchbelt', theme: 'factory', density: 0.5,
    blurb: 'HIT THE BLUE SWITCH TO REVERSE THE BELTS.',
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#.>>>>>>>>>>>.#',
      '#.#.#.#.#.#.#.#',
      '#......s......#',
      '#.#.#.#5#.#.#.#',
      '#......s......#',
      '#.#.#.#.#.#.#.#',
      '#.<<<<<<<<<<<.#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  {
    id: 'n8', name: 'WINTER WONDERLAND', jpName: 'TSURUTSURU BON', level: 'normal', gimmick: 'winter', theme: 'snow', density: 0.5,
    blurb: 'HIDE IN THE HUTS. THIN ICE BREAKS AFTER TWO CROSSINGS.',
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#..H..i.i..H..#',
      '#.#.#.#.#.#.#.#',
      '#....i...i....#',
      '#.#.#H#5#H#.#.#',
      '#....i...i....#',
      '#.#.#.#.#.#.#.#',
      '#..H..i.i..H..#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  // ------------------------------------------------------------------ ADVANCED
  {
    id: 'a1', name: 'SUPER POWER', jpName: 'GINGIN POWER', level: 'advanced', gimmick: 'superpower', theme: 'volcano', density: 0.7,
    blurb: 'EVERYONE STARTS WITH MAXIMUM FIRE!',
    maxFire: true,
    map: STD,
  },
  {
    id: 'a2', name: 'ROBO BOMBER', jpName: 'BOMBER ROBO', level: 'advanced', gimmick: 'robot', theme: 'factory', density: 0.55,
    blurb: 'A GIANT ROBOT STOMPS AROUND. IT LEAVES AT 1:00.',
    map: STD,
  },
  {
    id: 'a3', name: 'ROUND AND ROUND', jpName: 'KURUKURU DOKAN', level: 'advanced', gimmick: 'flowers', theme: 'garden', density: 0.5,
    blurb: 'PUSH A FLOWER TO TURN IT. A BLAST INTO ITS MOUTH BURSTS OUT OF ITS PARTNER.',
    portalPairs: [[[7, 4], [7, 8]], [[3, 6], [11, 6]], [[3, 3], [11, 9]], [[11, 3], [3, 9]]],
    flowerFaces: {
      '7,4': 'up', '7,8': 'down', '3,6': 'down', '11,6': 'up',
      '3,3': 'right', '11,9': 'left', '11,3': 'down', '3,9': 'up',
    },
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#..p.......p..#',
      '#.#.#.#p#.#.#.#',
      '#.............#',
      '#.#p#.#5#.#p#.#',
      '#.............#',
      '#.#.#.#p#.#.#.#',
      '#..p.......p..#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  {
    id: 'a4', name: 'DESTINATION UNKNOWN', jpName: 'FUSHIGI NA TROCCO', level: 'advanced', gimmick: 'mystery', theme: 'mine', density: 0.55,
    blurb: 'THE TROLLEY WARPS BETWEEN HOLES. BOMBERS ON FOOT CAN\'T.',
    spawns: [[1, 1], [13, 11], [13, 1], [1, 11], [7, 7]],
    stations: [[3, 6], [11, 6]],
    trolley: { x: 3, y: 3, dir: 'right', warps: true },
    railLayouts: MYSTERY_RAILS.slice(0, 3),
    altRailLayouts: MYSTERY_RAILS.slice(3),
    map: reserveRails(
      [
        '###############',
        '#1_........._3#',
        '#_#.#.#.#.#.#_#',
        '#.............#',
        '#.#.#.#.#.#.#.#',
        '#.............#',
        '#.#.#.#.#.#.#.#',
        '#......5......#',
        '#.#.#.#.#.#.#.#',
        '#.............#',
        '#_#.#.#.#.#.#_#',
        '#4_........._2#',
        '###############',
      ],
      MYSTERY_RAILS.slice(0, 3),
    ),
  },
  {
    id: 'a5', name: 'KING OF THE JUNGLE', jpName: 'JUNGLE TUNNEL', level: 'advanced', gimmick: 'jungle', theme: 'jungle', density: 0.5,
    blurb: 'LEAVES HIDE BOMBS (AND BOOST THEM). FIXED AND SPINNING ARROWS. EDGES WRAP.',
    map: [
      '###############',
      '#1_..FFF...._3#',
      '#_#.#F#F#.#.#_#',
      '#R...FFF.D@...#',
      '#.#.#.#.#.#.#.#',
      'w...@.....FFF.w',
      '#.#.#.#5#.#F#.#',
      'w.FFF.....@...w',
      '#.#F#.#.#.#.#.#',
      '#...@U.FFF...L#',
      '#_#.#.#F#F#.#_#',
      '#4_....FFF.._2#',
      '###############',
    ],
  },
  {
    id: 'a6', name: 'INCOMING!', jpName: 'MAGARE FIRE', level: 'advanced', gimmick: 'incoming', theme: 'city', density: 0.5,
    blurb: 'BENT PIPES TURN KICKED BOMBS AND BLASTS AROUND CORNERS.',
    bends: {
      '3,3': { left: 'down', up: 'right' },
      '11,3': { right: 'down', up: 'left' },
      '3,9': { left: 'up', down: 'right' },
      '11,9': { right: 'up', down: 'left' },
    },
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#..J.......J..#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#.#.#5#.#.#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#..J.......J..#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  {
    id: 'a7', name: 'THE FAST LANE', jpName: 'KARAKURI BELCON', level: 'advanced', gimmick: 'fastlane', theme: 'factory', density: 0.45,
    blurb: 'BLUE SWITCHES REVERSE THE BELTS, RED ONES CHANGE THEIR SPEED. EDGES WRAP.',
    map: [
      '#######w#######',
      '#1_........._3#',
      '#_#.#.#v#.#.#_#',
      '#.....svk.....#',
      '#.#.#.#v#.#.#.#',
      'w>>>>>>>>>>>>>w',
      '#.#.#.#5#.#.#.#',
      'w<<<<<<<<<<<<<w',
      '#.#.#.#^#.#.#.#',
      '#.....k^s.....#',
      '#_#.#.#^#.#.#_#',
      '#4_........._2#',
      '#######w#######',
    ],
  },
  {
    id: 'a8', name: 'THE SEVEN SEAS', jpName: 'KAIZOKU DOKAN', level: 'advanced', gimmick: 'seas', theme: 'sea', density: 0.4,
    blurb: 'WALK ON THE DECKS AND BRIDGES. BOMBS SINK. WATCH FOR FISH!',
    map: [
      '###############',
      '#1_...~~~..._3#',
      '#_#.#.bbb.#.#_#',
      '#.....~b~.....#',
      '#.#.#.~b~.#.#.#',
      '#~~b~~bbb~~b~~#',
      '#~~b~~b5b~~b~~#',
      '#~~b~~bbb~~b~~#',
      '#.#.#.~b~.#.#.#',
      '#.....~b~.....#',
      '#_#.#.bbb.#.#_#',
      '#4_...~~~..._2#',
      '###############',
    ],
  },
];

export function arenasFor(level: Level): ArenaDef[] {
  return ARENAS.filter((a) => a.level === level);
}

// ------------------------------------------------------------------ alternate stages

/**
 * Passwords that open each level's alternate stages (typed on the password screen, as
 * in the original game): same gimmicks, a fixed block placement and a different mix of
 * items, sometimes with Wall Pass.
 */
export const ALT_CODES: Record<string, Level> = { '56565656': 'beginner', '16161616': 'normal', '49894989': 'advanced' };

const ALT_ITEMS: Record<Level, Partial<Record<BattleItem, number>>> = {
  beginner: { bomb: 5, fire: 5, speed: 2, kick: 3, bombpass: 1, skull: 1 },
  normal: { bomb: 4, fire: 4, speed: 2, kick: 2, bombpass: 1, glove: 2, punch: 2, push: 1, line: 2, rubber: 1, pierce: 0, egg: 2, skull: 2 },
  advanced: { bomb: 4, fire: 4, speed: 2, kick: 2, bombpass: 1, glove: 1, punch: 1, push: 2, line: 1, powerbomb: 2, rubber: 1, pierce: 2, mine: 2, fullfire: 1, egg: 2, skull: 2 },
};

/** Fixed block placements for the alternate stages (true = soft block). */
const ALT_PATTERNS: ((x: number, y: number, w: number, h: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 1, // checkerboard
  (x, y, w, h) => Math.min(x, y, w - 1 - x, h - 1 - y) % 2 === 1, // rings
  (x, y) => x % 4 === 3 || y % 4 === 3, // walls of blocks
  () => true, // packed
  (x, y) => (x + 2 * y) % 3 !== 0, // diagonals
  (x, y) => (x * 7 + y * 13) % 4 === 0, // scattered
];
/** Patterns that leave room for Wall Pass to shine. */
const WALLPASS_PATTERNS = new Set([1, 3]);
const LEVEL_OFFSET: Record<Level, number> = { beginner: 0, normal: 2, advanced: 4 };

const altCache = new Map<string, ArenaDef>();

export function alternateArena(def: ArenaDef): ArenaDef {
  const cached = altCache.get(def.id);
  if (cached) return cached;
  const index = arenasFor(def.level).indexOf(def);
  const pattern = def.altPattern ?? (index + LEVEL_OFFSET[def.level]) % ALT_PATTERNS.length;
  const h = def.map.length;
  const w = def.map[0].length;
  const spawns: [number, number][] = def.spawns ? [...def.spawns] : [];
  def.map.forEach((row, y) => [...row].forEach((ch, x) => ch >= '1' && ch <= '5' && spawns.push([x, y])));
  const map = def.map.map((row, y) =>
    [...row]
      .map((ch, x) => {
        if (ch !== '.') return ch;
        // Keep every start position's pocket open.
        if (spawns.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) <= 2)) return '_';
        return ALT_PATTERNS[pattern](x, y, w, h) ? 'x' : '_';
      })
      .join(''),
  );
  const items = { ...ALT_ITEMS[def.level], ...(WALLPASS_PATTERNS.has(pattern) ? { wallpass: 1 } : {}) };
  const alt: ArenaDef = { ...def, id: `${def.id}x`, map, density: 0, items, alternate: true };
  altCache.set(def.id, alt);
  return alt;
}

/** The stage to play: the regular layout or its alternate. */
export function arenaFor(level: Level, stage: number, alternate = false): ArenaDef {
  const list = arenasFor(level);
  const def = list[Math.max(0, Math.min(list.length - 1, stage))];
  return alternate ? alternateArena(def) : def;
}
