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
  /** Rails: stop stations (tiles where the trolley pauses). */
  stations?: [number, number][];
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
    items: { bomb: 5, fire: 5, speed: 3, rubber: 2, skull: 2, kick: 0 },
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
    blurb: 'TRAMPOLINES BOUNCE YOU ACROSS. THE EDGES WRAP AROUND.',
    refuge: [5, 5, 9, 7],
    map: [
      '#######w#######',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#.............#',
      '#.#T#.#.#.#T#.#',
      '#.............#',
      'w.#.#.#5#.#.#.w',
      '#.............#',
      '#.#T#.#.#.#T#.#',
      '#.............#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '#######w#######',
    ],
  },
  {
    id: 'n4', name: 'SWITCHEROO', jpName: 'KARAKURI TROCCO', level: 'normal', gimmick: 'switcheroo', theme: 'mine', density: 0.55,
    blurb: 'THE TROLLEY RAILS REARRANGE THEMSELVES.',
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
      '#.#=#.#=#.#=#.#',
      '#..=========..#',
      '#.#=#.#=#.#=#.#',
      '#..=========..#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
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
    blurb: 'FLOWER DOORS TURN WHEN PUSHED. PAIRED FLOWERS SHARE BLASTS.',
    portalPairs: [[[7, 4], [7, 8]], [[3, 6], [11, 6]]],
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#..G.......G..#',
      '#.#.#.#p#.#.#.#',
      '#.....G.G.....#',
      '#.#p#.#5#.#p#.#',
      '#.....G.G.....#',
      '#.#.#.#p#.#.#.#',
      '#..G.......G..#',
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
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#..====W====..#',
      '#.#=#.#.#.#=#.#',
      '#..=.......=..#',
      '#.#=#.#.#.#=#.#',
      '#..=...5...=..#',
      '#.#=#.#.#.#=#.#',
      '#..====W====..#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  {
    id: 'a5', name: 'KING OF THE JUNGLE', jpName: 'JUNGLE TUNNEL', level: 'advanced', gimmick: 'jungle', theme: 'jungle', density: 0.5,
    blurb: 'LEAVES HIDE BOMBS (AND BOOST THEM). SPINNING ARROWS. EDGES WRAP.',
    map: [
      '###############',
      '#1_..FFF...._3#',
      '#_#.#F#F#.#.#_#',
      '#....FFF..@...#',
      '#.#.#.#.#.#.#.#',
      'w...@.....FFF.w',
      '#.#.#.#5#.#F#.#',
      'w.FFF.....@...w',
      '#.#F#.#.#.#.#.#',
      '#...@..FFF....#',
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
    blurb: 'SWITCHES CHANGE THE BELTS\' DIRECTION AND SPEED. EDGES WRAP.',
    map: [
      '#######w#######',
      '#1_........._3#',
      '#_#.#.#v#.#.#_#',
      '#.....sv......#',
      '#.#.#.#v#.#.#.#',
      'w>>>>>>>>>>>>>w',
      '#.#.#.#5#.#.#.#',
      'w<<<<<<<<<<<<<w',
      '#.#.#.#^#.#.#.#',
      '#......^s.....#',
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
