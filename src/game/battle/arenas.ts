import type { Dir } from '../core/types';
import type { BattleItem, Level } from './config';

/**
 * The 24 battle stages (3 levels × 8), laid out as 15×13 ASCII maps.
 *
 *   #  hard block          .  floor (random soft block)   _  floor, never a soft block
 *   x  soft block always   1-5 start positions             O  regenerating tyre (soft block)
 *   > < ^ v  conveyor belt   R L U D  floor arrow (redirects kicked bombs)   @  rotating arrow
 *   W  warp hole   T  trampoline   S  seesaw end ("SS" is one seesaw, "S_S" a three-tile one)
 *   a-e  speed sign 1-5   !  stop sign   =  rail   s  switch
 *   P  pipe (hides)   H  snow hut (hides, max fire)   F  foliage (hides, max fire)
 *   ~  water   b  deck / bridge (never soft)   i  cracked ice   G  flower door (turnstile)
 *   p  pipe mouth: blasts and kicked bombs travel to its partner
 *   J  bend pipe (see `bends`)   w  border gap that wraps to the other side
 *   B  bridge under a soft block   Y  scenery in place of a pillar (palm, bush, trunk…)
 *
 * Belts may run through the border wall: like 'w', they lead round to the far side.
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
  /** Linked pipe mouths or flowers ('p'). */
  portalPairs?: [[number, number], [number, number]][];
  /**
   * Head in the Clouds: the cloud floor (inclusive tile rectangles). The rest is the sky
   * floor; nobody walks, and nothing slides or burns, from one floor to the other, and the
   * trampolines ('T') bounce you across.
   */
  cloud?: [number, number, number, number][];
  /** Rails: stop stations (tiles where the trolley pauses). */
  stations?: [number, number][];
  /**
   * Changing rails: layouts drawn from tile (3, 3) ('=' rail, 'W' trolley warp). The
   * rails switch between them at random; the alternate stage adds `altRailLayouts`.
   */
  railLayouts?: string[][];
  altRailLayouts?: string[][];
  /**
   * Which way each flower (Round and Round) or pipe mouth (Every Which Way) opens ("x,y"):
   * blasts only get in from that side, and come out of the partner's opening.
   */
  faces?: Record<string, Dir>;
  /** Area spared by the sudden-death blocks (inclusive tile rectangle). */
  refuge?: [number, number, number, number];
  /** Players start with maximum fire. */
  maxFire?: boolean;
  /** A picture painted on the floor (Super Power's emblem). */
  decal?: 'emblem';
  /** Trolley starts here heading this way. */
  trolley?: { x: number; y: number; dir: Dir; warps?: boolean };
  spawns?: [number, number][];
  extraHard?: [number, number][];
  removeHard?: [number, number][];
  noSoft?: [number, number][];
  /** The alternate ("ura") version of a stage. */
  alternate?: boolean;
  /**
   * The alternate's own layout, where it differs from the stage's: its map (pillars and
   * gimmicks; '.' tiles get the alternate's fixed blocks) and anything else that moves.
   */
  alt?: Partial<Omit<ArenaDef, 'alt' | 'id' | 'level' | 'alternate'>>;
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

/** The standard arena with the fifth start left to `spawns`. */
const STD_NO5 = STD.map((row) => row.replace('5', '.'));

/** Rail layouts are drawn from this tile (x and y). */
export const RAIL_ORIGIN = 3;

/**
 * Switcheroo's rail layouts (x 3–11, y 3–9): three on the stage, three more on its
 * alternate. The first is the layout seen in the original; every one runs over the wooden
 * junction at (7, 9) and keeps off the starts.
 */
const SWITCHEROO_RAILS: string[][] = [
  ['......===', '......=.=', '......=.=', '......=.=', '..=====.=', '..=.....=', '..======='],
  ['===......', '=.=......', '=.=......', '=.=......', '=.=====..', '=.....=..', '=======..'],
  ['=========', '=.......=', '=.......=', '=.......=', '=.......=', '=.......=', '========='],
  ['..=====..', '..=...=..', '..=...=..', '..=...=..', '..=====..', '....=....', '========='],
  ['=========', '=.=...=.=', '=.=...=.=', '=.=...=.=', '===...===', '=.......=', '========='],
  ['=========', '=.......=', '===...===', '=.......=', '===...===', '=.......=', '========='],
];

export const ARENAS: ArenaDef[] = [
  // ------------------------------------------------------------------ BEGINNER
  {
    id: 'b1', name: 'NORMAL', jpName: 'STANDARD', level: 'beginner', gimmick: null, theme: 'battle', density: 0.7,
    blurb: 'THE CLASSIC ARENA. NO TRAPS.',
    map: STD,
    // The alternate, from its stage art: walls down both sides and bars across the middle
    // rows.
    alt: {
      map: [
        '###############',
        '#1_........._3#',
        '#_#.#.###.#.#_#',
        '#.#.........#.#',
        '#.#.###.###.#.#',
        '#.#.........#.#',
        '#.#.#.#5#.#.#.#',
        '#.#.........#.#',
        '#.#.###.###.#.#',
        '#.#.........#.#',
        '#_#.#.###.#.#_#',
        '#4_........._2#',
        '###############',
      ],
    },
  },
  {
    id: 'b2', name: 'SEESAW PARK', jpName: 'SEESAW PARK', level: 'beginner', gimmick: 'seesaw', theme: 'seesawpark', density: 0.5,
    blurb: 'STEP ON A SEESAW TO LAUNCH WHAT IS ON THE OTHER END.',
    items: { bomb: 5, fire: 5, speed: 3, skull: 2, kick: 0 },
    // Four long seesaws, each tipping on the tile between two pillars.
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#..S_S...S_S..#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#.#.#5#.#.#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#..S_S...S_S..#',
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
    // A road network walled with cones; the one soft block is the tyre on the stop sign's
    // corner, which comes back after it is blown up.
    map: [
      '###############',
      '#1_........._3#',
      '#_#####.#####_#',
      '#.#.........#.#',
      '#.#.#######.#.#',
      '#..c...O...c..#',
      '#.#.###!###.#.#',
      '#.#.........#.#',
      '#.#.###.###.#.#',
      '#.#....5....#.#',
      '#_#####.#####_#',
      '#4_........._2#',
      '###############',
    ],
    // The alternate, from its stage art: the cones rearranged.
    alt: {
      map: [
        '###############',
        '#1_........._3#',
        '#_#####.#####_#',
        '#.#.........#.#',
        '#.#.#.#.#.#.#.#',
        '#..c#.#O...c..#',
        '#.#.#.#!#.#.#.#',
        '#.#.#.#.#.#.#.#',
        '#.#.#.#.#.#.#.#',
        '#.#....5....#.#',
        '#_#####.#####_#',
        '#4_........._2#',
        '###############',
      ],
    },
  },
  {
    id: 'b4', name: 'TAKE THE TRAIN', jpName: 'GO GO TROCCO', level: 'beginner', gimmick: 'train', theme: 'forest', density: 0.6,
    blurb: 'RIDE THE TROLLEY. DON\'T GET HIT BY IT! SWITCH CHANGES ROUTE.',
    // One line with three dead-end stations; the switch in the middle sets the points at
    // (9, 3). Soft blocks lie on the rails too: the trolley smashes them.
    spawns: [[1, 1], [13, 11], [13, 1], [1, 11], [7, 6]],
    stations: [[3, 5], [7, 7], [11, 9]],
    trolley: { x: 8, y: 3, dir: 'right' },
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#....=======..#',
      '#.#.#=#.#=#=#.#',
      '#..=.=.s.=.=..#',
      '#.#=#=#.#=#=#.#',
      '#..=.=.===.=..#',
      '#.#=#=#.#.#=#.#',
      '#..===.....=..#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
    // The alternate, from its stage art: a new line, two branches meeting at points at
    // (7, 9), with a spur up the middle.
    alt: {
      stations: [[3, 3], [11, 3], [7, 5]],
      trolley: { x: 3, y: 3, dir: 'right' },
      spawns: [[1, 1], [13, 11], [13, 1], [1, 11], [7, 4]],
      map: [
        '###############',
        '#1_........._3#',
        '#_#.#.#.#.#.#_#',
        '#..===...===..#',
        '#.#.#=#5#=#.#.#',
        '#....=.=.===..#',
        '#.#.#=#=#.#=#.#',
        '#..===.=.s.=..#',
        '#.#=#.#=#.#=#.#',
        '#..=========..#',
        '#_#.#.#.#.#.#_#',
        '#4_........._2#',
        '###############',
      ],
    },
  },
  {
    id: 'b5', name: 'ONE-WAY STREET', jpName: 'MAGATTE BON', level: 'beginner', gimmick: 'arrows', theme: 'planks', density: 0.6,
    blurb: 'FLOOR ARROWS TURN KICKED BOMBS.',
    items: { kick: 4 },
    // Three rings of arrows: round the start corners one way, the middle ring the other,
    // the inner ring the first way again.
    spawns: [[1, 1], [13, 11], [13, 1], [1, 11], [7, 6]],
    map: [
      '###############',
      '#D_........._L#',
      '#_#.#.#.#.#.#_#',
      '#..R.......D..#',
      '#.#.#.#.#.#.#.#',
      '#....D...L....#',
      '#.#.#.#.#.#.#.#',
      '#....R...U....#',
      '#.#.#.#.#.#.#.#',
      '#..U.......L..#',
      '#_#.#.#.#.#.#_#',
      '#R_........._U#',
      '###############',
    ],
    // The alternate, from its stage art: new arrows, the corners running the other way.
    alt: {
      map: [
        '###############',
        '#R_........._D#',
        '#_#.#.#.#.#.#_#',
        '#..D.L........#',
        '#.#.#.#.#.#.#.#',
        '#....U...L....#',
        '#.#.#.#5#.#.#.#',
        '#..R.......D..#',
        '#.#.#.#.#.#.#.#',
        '#........U.L..#',
        '#_#.#.#.#.#.#_#',
        '#U_........._L#',
        '###############',
      ],
    },
  },
  {
    id: 'b6', name: 'PIPE CITY', jpName: 'DOKAN DE BOKAN', level: 'beginner', gimmick: 'pipes', theme: 'pipecity', density: 0.55,
    blurb: 'PIPES HIDE BOMBERS AND BOMBS.',
    // Four crossroads of pipe, each round a tile between four pillars.
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#P#.#_#',
      '#.......PPP...#',
      '#.#P#.#.#P#.#.#',
      '#.PPP.........#',
      '#.#P#.#5#.#P#.#',
      '#.........PPP.#',
      '#.#.#P#.#.#P#.#',
      '#...PPP.......#',
      '#_#.#P#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
    // The alternate, from its stage art: two pipe crossroads and four T-pieces, two of them
    // along the side walls.
    alt: {
      map: [
        '###############',
        '#1_.....PPP._3#',
        '#_#.#.#.#P#.#_#',
        '#.............#',
        '#P#.#P#.#.#.#.#',
        '#PP.PPP.......#',
        '#P#.#P#5#P#.#P#',
        '#.......PPP.PP#',
        '#.#.#.#.#P#.#P#',
        '#.............#',
        '#_#.#P#.#.#.#_#',
        '#4_.PPP....._2#',
        '###############',
      ],
    },
  },
  {
    id: 'b7', name: 'FACTORY', jpName: 'GURUGURU BELCON', level: 'beginner', gimmick: 'conveyor', theme: 'plant', density: 0.55,
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
    // The alternate, from its stage art: the belt loop bends into a cross.
    alt: {
      map: [
        '###############',
        '#1_........._3#',
        '#_#.#.#.#.#.#_#',
        '#....>>>>v....#',
        '#.#.#^#.#v#.#.#',
        '#..>>^...>>v..#',
        '#.#^#.#5#.#v#.#',
        '#..^<<...v<<..#',
        '#.#.#^#.#v#.#.#',
        '#....^<<<<....#',
        '#_#.#.#.#.#.#_#',
        '#4_........._2#',
        '###############',
      ],
    },
  },
  {
    id: 'b8', name: 'WARP DESERT', jpName: 'SARASARA WARP', level: 'beginner', gimmick: 'warp', theme: 'desert', density: 0.55,
    blurb: 'WARP HOLES SEND YOU TO ANOTHER HOLE.',
    // A sand pit inward of each corner; six of the pillars are palm trees.
    map: [
      '###############',
      '#1_........._3#',
      '#_Y.#.#.#.#.Y_#',
      '#..W.......W..#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#.Y.#5#.Y.#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#..W.......W..#',
      '#_Y.#.#.#.#.Y_#',
      '#4_........._2#',
      '###############',
    ],
    // The alternate, from its stage art: a pyramid beside each palm.
    alt: {
      map: [
        '###############',
        '#1_........._3#',
        '#_Y##.#.#.##Y_#',
        '#..W.......W..#',
        '#.#.#.#.#.#.#.#',
        '#.............#',
        '#.#.Y##5##Y.#.#',
        '#.............#',
        '#.#.#.#.#.#.#.#',
        '#..W.......W..#',
        '#_Y##.#.#.##Y_#',
        '#4_........._2#',
        '###############',
      ],
    },
  },
  // ------------------------------------------------------------------ NORMAL
  {
    id: 'n1', name: 'ALL TOGETHER NOW', jpName: 'USHIRO NO SHOUMEN', level: 'normal', gimmick: 'center', theme: 'battle', density: 0.8,
    blurb: 'EVERYONE STARTS TOGETHER IN THE MIDDLE!',
    // Blocks all round, the middle clear: five starts packed round the centre.
    spawns: [[5, 5], [9, 7], [9, 5], [5, 7], [7, 5]],
    map: [
      '###############',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#.#_#_#_#.#.#',
      '#..._1_5_3_...#',
      '#.#.#_#_#_#.#.#',
      '#..._4___2_...#',
      '#.#.#_#_#_#.#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '###############',
    ],
    // The alternate, from its stage art: ten more pillars, two capping the start box.
    alt: {
      map: [
        '###############',
        '#.............#',
        '#.#.###.###.#.#',
        '#.............#',
        '#.#.#_###_#.#.#',
        '#.#._1_5_3_.#.#',
        '#.#.#_#_#_#.#.#',
        '#.#._4___2_.#.#',
        '#.#.#_###_#.#.#',
        '#.............#',
        '#.#.###.###.#.#',
        '#.............#',
        '###############',
      ],
    },
  },
  {
    id: 'n2', name: 'SEESAW LAND', jpName: 'SEESAW LAND', level: 'normal', gimmick: 'seesawLinked', theme: 'seesawland', density: 0.5,
    blurb: 'ALL THE SEESAWS ARE LINKED AND MOVE TOGETHER.',
    // SeeSaw Park's four long seesaws, all tipping at once.
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#..S_S...S_S..#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#.#.#5#.#.#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#..S_S...S_S..#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
    // The alternate, from its stage art: five seesaws in a zigzag.
    alt: {
      map: [
        '###############',
        '#1_....S_S.._3#',
        '#_#.#.#.#.#.#_#',
        '#....S_S......#',
        '#.#.#.#.#.#.#.#',
        '#......S_S....#',
        '#.#.#.#5#.#.#.#',
        '#....S_S......#',
        '#.#.#.#.#.#.#.#',
        '#......S_S....#',
        '#_#.#.#.#.#.#_#',
        '#4_........._2#',
        '###############',
      ],
    },
  },
  {
    id: 'n3', name: 'HEAD IN THE CLOUDS', jpName: 'FUWAFUWA BON', level: 'normal', gimmick: 'clouds', theme: 'sky', density: 0.5,
    blurb: 'TWO FLOORS: A CLOUD IN THE MIDDLE, THE SKY ROUND IT. TRAMPOLINES BOUNCE YOU ACROSS.',
    // A cloud bank between the middle pillars; eight trampolines, half on each floor.
    cloud: [[4, 4, 10, 8]],
    map: [
      '###############',
      '#1_......T.._3#',
      '#_#.#.#.#.#.#_#',
      '#......T......#',
      '#.#.#.#.#.#.#.#',
      '#....T.....T..#',
      '#.#.#.#5#.#.#.#',
      '#..T.....T....#',
      '#.#.#.#.#.#.#.#',
      '#......T......#',
      '#_#.#.#.#.#.#_#',
      '#4_..T......_2#',
      '###############',
    ],
    // The alternate, from its stage art: the cloud covers the upper-left half.
    alt: {
      cloud: [[1, 1, 12, 1], [1, 2, 11, 2], [1, 3, 10, 3], [1, 4, 9, 4], [1, 5, 8, 5], [1, 6, 7, 6], [1, 7, 6, 7], [1, 8, 5, 8], [1, 9, 4, 9], [1, 10, 3, 10], [1, 11, 2, 11]],
      map: [
        '###############',
        '#1_......T.._3#',
        '#_#.#.#.#.#.#_#',
        '#......T......#',
        '#.#.#.#.#.#.#.#',
        '#....T.....T..#',
        '#.#.#.#5#.#.#.#',
        '#..T.....T....#',
        '#.#.#.#.#.#.#.#',
        '#......T......#',
        '#_#.#.#.#.#.#_#',
        '#4_..T......_2#',
        '###############',
      ],
    },
  },
  {
    id: 'n4', name: 'SWITCHEROO', jpName: 'KARAKURI TROCCO', level: 'normal', gimmick: 'switcheroo', theme: 'yard', density: 0.55,
    blurb: 'THE RAILS ARE RELAID AT RANDOM. WATCH WHERE THE TROLLEY GOES!',
    // Every layout runs over the wooden junction at (7, 9), where the trolley stops.
    spawns: [[1, 1], [13, 11], [13, 1], [1, 11], [7, 5]],
    stations: [[7, 9]],
    trolley: { x: 9, y: 4, dir: 'up' },
    railLayouts: SWITCHEROO_RAILS.slice(0, 3),
    altRailLayouts: SWITCHEROO_RAILS.slice(3),
    altPattern: 4, // the rails leave little room: a denser pattern
    map: STD_NO5,
  },
  {
    id: 'n5', name: 'BLOCK WORLD', jpName: 'BLOCK WORLD', level: 'normal', gimmick: 'blockworld', theme: 'toy', density: 0.55,
    blurb: 'SOME ARROWS SPIN, SENDING KICKED BOMBS EVERYWHERE.',
    items: { kick: 4 },
    // Six fixed arrows (blocks may hide them) and two spinning ones.
    map: [
      '###############',
      '#1_R.......D_3#',
      '#_#.#.#.#.#.#_#',
      '#..@...L......#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#.#.#5#.#.#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#......R...@..#',
      '#_#.#.#.#.#.#_#',
      '#4_U.......L_2#',
      '###############',
    ],
    // The alternate, from its stage art: ten fixed arrows, with the spinners moved to the
    // middle column.
    alt: {
      spawns: [[1, 1], [13, 11], [13, 1], [1, 11], [7, 6]],
      map: [
        '###############',
        '#D_....D...._L#',
        '#_#.#.#.#.#.#_#',
        '#..R...@...D..#',
        '#.#.#.#.#.#.#.#',
        '#.............#',
        '#.#.#.#5#.#.#.#',
        '#.............#',
        '#.#.#.#.#.#.#.#',
        '#..U...@...L..#',
        '#_#.#.#.#.#.#_#',
        '#R_....U...._U#',
        '###############',
      ],
    },
  },
  {
    id: 'n6', name: 'EVERY WHICH WAY', jpName: 'KARAKURI DOKAN', level: 'normal', gimmick: 'portals', theme: 'frost', density: 0.55,
    blurb: 'A BLAST INTO A PIPE\'S MOUTH COMES OUT OF ITS PARTNER.',
    // Eight pipes between pillars, each opening one way.
    portalPairs: [[[5, 4], [2, 5]], [[9, 8], [12, 7]], [[9, 2], [10, 5]], [[5, 10], [4, 7]]],
    faces: {
      '9,2': 'down', '5,4': 'up', '2,5': 'right', '10,5': 'right',
      '4,7': 'left', '12,7': 'left', '9,8': 'down', '5,10': 'up',
    },
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#p#.#_#',
      '#.............#',
      '#.#.#p#.#.#.#.#',
      '#.p.......p...#',
      '#.#.#.#5#.#.#.#',
      '#...p.......p.#',
      '#.#.#.#.#p#.#.#',
      '#.............#',
      '#_#.#p#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
  },
  {
    id: 'n7', name: 'COMING AND GOING', jpName: 'SWITCH BELCON', level: 'normal', gimmick: 'switchbelt', theme: 'pinkplant', density: 0.5,
    blurb: 'HIT THE BLUE SWITCH TO REVERSE THE BELTS.',
    // Two belt rings either side of a clear middle lane, the switch at its top.
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#_#.#.#_#',
      '#..>>v.s.>>v..#',
      '#.#^#v#_#^#v#.#',
      '#..^.v._.^.v..#',
      '#.#^#v#5#^#v#.#',
      '#..^.v._.^.v..#',
      '#.#^#v#_#^#v#.#',
      '#..^<<._.^<<..#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
    // The alternate, from its stage art: the two belt rings become one big loop.
    alt: {
      map: [
        '###############',
        '#1_........._3#',
        '#_#.#.#.#.#.#_#',
        '#..>>>>>>>>v..#',
        '#.#^#.#s#.#v#.#',
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
  },
  {
    id: 'n8', name: 'WINTER WONDERLAND', jpName: 'TSURUTSURU BON', level: 'normal', gimmick: 'winter', theme: 'snow', density: 0.5,
    blurb: 'HIDE IN THE SNOW HUTS. CRACKED ICE GIVES WAY UNDERFOOT OR IN A BLAST.',
    // Three big snow huts stand where pillars would; cracked ice inward of each corner.
    map: [
      '###############',
      '#1_........._3#',
      '#_#.HHH.#.#.#_#',
      '#..iHHH....i..#',
      '#.#.HHH.#.HHH.#',
      '#.........HHH.#',
      '#.#.#.#5#.HHH.#',
      '#.............#',
      '#.#.#.HHH.#.#.#',
      '#..i..HHH..i..#',
      '#_#.#.HHH.#.#_#',
      '#4_........._2#',
      '###############',
    ],
    // The alternate, from its stage art: a snow hut in each corner.
    alt: {
      map: [
        '###############',
        '#1_........._3#',
        '#_HHH.#.#.HHH_#',
        '#.HHH.....HHH.#',
        '#.HHH.#.#.HHH.#',
        '#....i...i....#',
        '#.#.#.#5#.#.#.#',
        '#....i...i....#',
        '#.HHH.#.#.HHH.#',
        '#.HHH.....HHH.#',
        '#_HHH.#.#.HHH_#',
        '#4_........._2#',
        '###############',
      ],
    },
  },
  // ------------------------------------------------------------------ ADVANCED
  {
    id: 'a1', name: 'SUPER POWER', jpName: 'GINGIN POWER', level: 'advanced', gimmick: 'superpower', theme: 'superpower', density: 0.7,
    blurb: 'EVERYONE STARTS WITH MAXIMUM FIRE!',
    maxFire: true,
    decal: 'emblem',
    // Few blocks, always the same: an L round each corner and a ring round the middle.
    map: [
      '###############',
      '#1_x_______x_3#',
      '#_#x#_#_#_#x#_#',
      '#xxx_______xxx#',
      '#_#_#_#x#_#_#_#',
      '#____x___x____#',
      '#_#_#_#5#_#_#_#',
      '#____x___x____#',
      '#_#_#_#x#_#_#_#',
      '#xxx_______xxx#',
      '#_#x#_#_#_#x#_#',
      '#4_x_______x_2#',
      '###############',
    ],
    // The alternate keeps the stage's art; only its blocks (a fixed pattern) and items differ.
    alt: { map: STD },
  },
  {
    id: 'a2', name: 'ROBO BOMBER', jpName: 'BOMBER ROBO', level: 'advanced', gimmick: 'robot', theme: 'robocity', density: 0.55,
    blurb: 'A GIANT ROBOT STOMPS AROUND. IT LEAVES AT 1:00.',
    // Blocks on every other tile; the robot stands in the middle, so the fifth start is at
    // the top.
    map: [
      '###############',
      '#1__x__5__x__3#',
      '#_#x#x#_#x#x#_#',
      '#_x_x_x_x_x_x_#',
      '#x#x#x#x#x#x#x#',
      '#_x_x_x_x_x_x_#',
      '#x#x#x#x#x#x#x#',
      '#_x_x_x_x_x_x_#',
      '#x#x#x#x#x#x#x#',
      '#_x_x_x_x_x_x_#',
      '#_#x#x#x#x#x#_#',
      '#4__x_x_x_x__2#',
      '###############',
    ],
    // The alternate keeps the stage's art; only its blocks (a fixed pattern) and items differ.
    alt: { map: STD_NO5.map((row, y) => (y === 1 ? '#1_....5...._3#' : row)) },
  },
  {
    id: 'a3', name: 'ROUND AND ROUND', jpName: 'KURUKURU DOKAN', level: 'advanced', gimmick: 'flowers', theme: 'pond', density: 0.5,
    blurb: 'PUSH A FLOWER TO TURN IT. A BLAST INTO ITS MOUTH BURSTS OUT OF ITS PARTNER.',
    // Four bushes stand in for pillars, each with a pair of flowers either side of it.
    portalPairs: [[[3, 4], [5, 4]], [[10, 3], [10, 5]], [[4, 7], [4, 9]], [[9, 8], [11, 8]]],
    faces: {
      '3,4': 'up', '5,4': 'down', '10,3': 'right', '10,5': 'left',
      '4,7': 'right', '4,9': 'left', '9,8': 'up', '11,8': 'down',
    },
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#.........p...#',
      '#.#pYp#.#.Y.#.#',
      '#.........p...#',
      '#.#.#.#5#.#.#.#',
      '#...p.........#',
      '#.#.Y.#.#pYp#.#',
      '#...p.........#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
    // The alternate, from its stage art: two of the bushes move.
    alt: {
      portalPairs: [[[3, 4], [5, 4]], [[8, 3], [8, 5]], [[6, 7], [6, 9]], [[9, 8], [11, 8]]],
      faces: {
        '3,4': 'up', '5,4': 'down', '8,3': 'right', '8,5': 'left',
        '6,7': 'right', '6,9': 'left', '9,8': 'up', '11,8': 'down',
      },
      map: [
        '###############',
        '#1_........._3#',
        '#_#.#.#.#.#.#_#',
        '#.......p.....#',
        '#.#pYp#.Y.#.#.#',
        '#.......p.....#',
        '#.#.#.#5#.#.#.#',
        '#.....p.......#',
        '#.#.#.Y.#pYp#.#',
        '#.....p.......#',
        '#_#.#.#.#.#.#_#',
        '#4_........._2#',
        '###############',
      ],
    },
  },
  {
    id: 'a4', name: 'DESTINATION UNKNOWN', jpName: 'FUSHIGI NA TROCCO', level: 'advanced', gimmick: 'mystery', theme: 'space', density: 0.55,
    blurb: 'THE TROLLEY WARPS BETWEEN HOLES. BOMBERS ON FOOT CAN\'T.',
    spawns: [[1, 1], [13, 11], [13, 1], [1, 11], [7, 7]],
    // Unlike Switcheroo's, these rails are painted on the stage: four pieces, each from a
    // dead end (where the trolley stops) into a warp hole. Stars lie on the rails too.
    stations: [[5, 3], [3, 9], [11, 3], [9, 9]],
    trolley: { x: 5, y: 3, dir: 'right', warps: true },
    map: [
      '###############',
      '#1_........._3#',
      '#_#.#.#.#.#.#_#',
      '#....=====.=..#',
      '#.#.#.#.#=#=#.#',
      '#..==W...W.=..#',
      '#.#=#.#.#.#=#.#',
      '#..=.W.5.W==..#',
      '#.#=#=#.#.#.#.#',
      '#..=.=====....#',
      '#_#.#.#.#.#.#_#',
      '#4_........._2#',
      '###############',
    ],
    // The alternate, from its stage art: four straight rails, each ending in a warp hole.
    alt: {
      stations: [[4, 3], [11, 4], [10, 9], [3, 8]],
      trolley: { x: 4, y: 3, dir: 'right', warps: true },
      map: [
        '###############',
        '#1_........._3#',
        '#_#.#.#.#.#.#_#',
        '#...======W...#',
        '#.#W#.#.#.#=#.#',
        '#..=.......=..#',
        '#.#=#.#.#.#=#.#',
        '#..=...5...=..#',
        '#.#=#.#.#.#W#.#',
        '#...W======...#',
        '#_#.#.#.#.#.#_#',
        '#4_........._2#',
        '###############',
      ],
    },
  },
  {
    id: 'a5', name: 'KING OF THE JUNGLE', jpName: 'JUNGLE TUNNEL', level: 'advanced', gimmick: 'jungle', theme: 'jungle', density: 0.5,
    blurb: 'LEAVES HIDE BOMBS (AND BOOST THEM). FIXED AND SPINNING ARROWS. EDGES WRAP.',
    // Four big trees in a pinwheel: a plus of leafy tiles under each canopy, the trunks
    // standing in for the two pillars below it. Tunnels through the hedge lead round.
    map: [
      '#####w###w#####',
      '#1_........._3#',
      '#_#.#.#.#F#.#_#',
      'w..R...DFFFD..w',
      '#.#F#.#.YFY.#.#',
      '#.FFF......@..#',
      '#.YFY.#5#.#F#.#',
      '#..@......FFF.#',
      '#.#.#F#.#.YFY.#',
      'w..UFFFU...L..w',
      '#_#.YFY.#.#.#_#',
      '#4_........._2#',
      '#####w###w#####',
    ],
    // The alternate, from its stage art: a tree in each corner.
    alt: {
      map: [
        '#####w###w#####',
        '#1_........._3#',
        '#_#F#.#.#.#F#_#',
        'w.FFF..D..FFF.w',
        '#.YFY.#.#.YFY.#',
        '#..........@..#',
        '#.#.#.#5#.#.#.#',
        '#..@..........#',
        '#.#F#.#.#.#F#.#',
        'w.FFF..U..FFF.w',
        '#_YFY.#.#.YFY_#',
        '#4_........._2#',
        '#####w###w#####',
      ],
    },
  },
  {
    id: 'a6', name: 'INCOMING!', jpName: 'MAGARE FIRE', level: 'advanced', gimmick: 'incoming', theme: 'incoming', density: 0.5,
    blurb: 'BENT PIPES TURN KICKED BOMBS AND BLASTS AROUND CORNERS.',
    // Four L-shaped pipes, three tiles each, walled in behind their elbows. Eight of the
    // pillars are gold.
    bends: {
      '3,3': { left: 'down', up: 'right' },
      '4,3': { left: 'left', right: 'right' },
      '3,4': { up: 'up', down: 'down' },
      '11,3': { right: 'down', up: 'left' },
      '10,3': { left: 'left', right: 'right' },
      '11,4': { up: 'up', down: 'down' },
      '3,9': { left: 'up', down: 'right' },
      '3,8': { up: 'up', down: 'down' },
      '4,9': { left: 'left', right: 'right' },
      '11,9': { right: 'up', down: 'left' },
      '11,8': { up: 'up', down: 'down' },
      '10,9': { left: 'left', right: 'right' },
    },
    map: [
      '###############',
      '#1_........._3#',
      '#_Y#Y.#.#.###_#',
      '#.#JJ.....JJ#.#',
      '#.#J#.#.Y.YJ#.#',
      '#.............#',
      '#.#.#.#5#.#.#.#',
      '#.............#',
      '#.#JY.Y.#.#J#.#',
      '#.#JJ.....JJ#.#',
      '#_###.#.#.Y#Y_#',
      '#4_........._2#',
      '###############',
    ],
    // The alternate, from its stage art: two of the pipes move to the middle.
    alt: {
      bends: {
        '3,3': { left: 'down', up: 'right' },
        '4,3': { left: 'left', right: 'right' },
        '3,4': { up: 'up', down: 'down' },
        '9,5': { left: 'down', up: 'right' },
        '10,5': { left: 'left', right: 'right' },
        '9,6': { up: 'up', down: 'down' },
        '5,7': { down: 'left', right: 'up' },
        '5,6': { up: 'up', down: 'down' },
        '4,7': { left: 'left', right: 'right' },
        '11,9': { right: 'up', down: 'left' },
        '11,8': { up: 'up', down: 'down' },
        '10,9': { left: 'left', right: 'right' },
      },
      map: [
        '###############',
        '#1_........._3#',
        '#_Y#Y.#.#.#.#_#',
        '#.#JJ.........#',
        '#.#J#.#.Y#Y.#.#',
        '#.......#JJ...#',
        '#.#.#J#5#J#.#.#',
        '#...JJ#.......#',
        '#.#.Y#Y.#.#J#.#',
        '#.........JJ#.#',
        '#_#.#.#.#.Y#Y_#',
        '#4_........._2#',
        '###############',
      ],
    },
  },
  {
    id: 'a7', name: 'THE FAST LANE', jpName: 'KARAKURI BELCON', level: 'advanced', gimmick: 'fastlane', theme: 'fastlane', density: 0.45,
    blurb: 'BLUE SWITCHES REVERSE THE BELTS, RED ONES CHANGE THEIR SPEED. EDGES WRAP.',
    // One long belt loop in four L-shaped runs, each passing through the wall to the far
    // side. Red switch at the top (speed), blue at the bottom (reverse).
    map: [
      '#####^###v#####',
      '#1_..^...v.._3#',
      '#_#.#^#.#v#.#_#',
      '#....^.k.v....#',
      '#.#.#^#.#v#.#.#',
      '>>>>>^...>>>>>>',
      '#.#.#.#5#.#.#.#',
      '<<<<<<...v<<<<<',
      '#.#.#^#.#v#.#.#',
      '#....^.s.v....#',
      '#_#.#^#.#v#.#_#',
      '#4_..^...v.._2#',
      '#####^###v#####',
    ],
    // The alternate, from its stage art: two separate loops, one up and down, one across.
    alt: {
      map: [
        '#####^###v#####',
        '#1_..^...v.._3#',
        '#_#.#^#.#v#.#_#',
        '#....^<<<<....#',
        '#.#.#.#k#.#.#.#',
        '>>>v.......>>>>',
        '#.#v#.#5#.#^#.#',
        '<<<<.......^<<<',
        '#.#.#.#s#.#.#.#',
        '#....>>>>v....#',
        '#_#.#^#.#v#.#_#',
        '#4_..^...v.._2#',
        '#####^###v#####',
      ],
    },
  },
  {
    id: 'a8', name: 'THE SEVEN SEAS', jpName: 'KAIZOKU DOKAN', level: 'advanced', gimmick: 'seas', theme: 'sea', density: 0.4,
    blurb: 'WALK ON THE DECKS AND BRIDGES. BOMBS SINK. WATCH FOR FISH!',
    // Four ship decks joined by bridges piled with floats, a raft in the middle, barrels
    // standing in the sea.
    map: [
      '###############',
      '#1_..~~B~~.._3#',
      '#_#.#~#B#~#.#_#',
      '#....BBBBB....#',
      '#.#B#~#b#~#B#.#',
      '#~~B~~bbb~~B~~#',
      '#~#B#~#5#~#B#~#',
      '#~~B~~bbb~~B~~#',
      '#.#B#~#b#~#B#.#',
      '#....BBBBB....#',
      '#_#.#~#B#~#.#_#',
      '#4_..~~B~~.._2#',
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
  const base: ArenaDef = { ...def, ...def.alt };
  const pattern = base.altPattern ?? (index + LEVEL_OFFSET[def.level]) % ALT_PATTERNS.length;
  const h = base.map.length;
  const w = base.map[0].length;
  const spawns: [number, number][] = base.spawns ? [...base.spawns] : [];
  base.map.forEach((row, y) => [...row].forEach((ch, x) => ch >= '1' && ch <= '5' && spawns.push([x, y])));
  const map = base.map.map((row, y) =>
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
  const alt: ArenaDef = { ...base, id: `${def.id}x`, map, density: 0, items, alternate: true, alt: undefined };
  altCache.set(def.id, alt);
  return alt;
}

/** The stage to play: the regular layout or its alternate. */
export function arenaFor(level: Level, stage: number, alternate = false): ArenaDef {
  const list = arenasFor(level);
  const def = list[Math.max(0, Math.min(list.length - 1, stage))];
  return alternate ? alternateArena(def) : def;
}
