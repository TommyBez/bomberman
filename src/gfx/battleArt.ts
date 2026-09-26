import { mix, type Sprite } from '../engine/gfx';
import type { Dir } from '../game/core/types';
import { PixelCanvas } from './pixel';
import type { Theme } from './tiles';

/** Arena colour themes for the battle stages. */
export const BATTLE_THEMES: Record<string, Theme> = {
  // SeeSaw Park: an orange checkered floor, hedge blocks, footballs.
  seesawpark: { name: 'seesawpark', backdrop: '#102010', floor: '#f0a040', floorAlt: '#f8c860', floorStyle: 'checker', hard: '#3a9a3c', hardStyle: 'hedgeBlock', wall: '#806040', wallStyle: 'hedge', soft: '#f8f8f8', softStyle: 'ball', hud: ['#3a7a30', '#1a4010'], shadow: 0.3 },
  // SeeSaw Land: a teal polka-dot floor, red roofs, grey rocks.
  seesawland: { name: 'seesawland', backdrop: '#081818', floor: '#2a8a8a', floorAlt: '#1e6a5a', floorStyle: 'dots', hard: '#e04838', hardStyle: 'roof', wall: '#2c6a3a', wallStyle: 'hedge', soft: '#a8a8b0', softStyle: 'rock', hud: ['#2c6a3a', '#103018'], shadow: 0.3 },
  // Take the Train: a green forest clearing with stone cones and bushes.
  forest: { name: 'forest', backdrop: '#081408', floor: '#4aa040', floorAlt: '#58b04c', floorStyle: 'grass', hard: '#b8bcc4', hardStyle: 'boulder', wall: '#2c7a24', wallStyle: 'hedge', soft: '#3c8a30', softStyle: 'bush', hud: ['#3a8a2c', '#185010'], shadow: 0.3 },
  // One-Way Street: a plank floor, pale blue posts, green blocks.
  planks: { name: 'planks', backdrop: '#140c04', floor: '#d08a40', floorAlt: '#e09a50', floorStyle: 'wood', hard: '#98c8e8', hardStyle: 'drum', wall: '#8a5020', wallStyle: 'stone', soft: '#50a848', softStyle: 'crate', hud: ['#8a5020', '#402008'], shadow: 0.3 },
  // Pipe City: a yellow floor, grey blocks, cream boulders, blue pipes.
  pipecity: { name: 'pipecity', backdrop: '#141004', floor: '#f0c838', floorAlt: '#e8b828', floorStyle: 'plain', hard: '#a0a6b8', hardStyle: 'bevel', wall: '#8a7040', wallStyle: 'stone', soft: '#f0ecd8', softStyle: 'rock', pipe: '#78b8e8', hud: ['#8a7040', '#403010'], shadow: 0.3 },
  // Factory: a purple floor, grey blocks, hazard-striped soft blocks.
  plant: { name: 'plant', backdrop: '#100c18', floor: '#8878c0', floorAlt: '#9888cc', floorStyle: 'metal', hard: '#a0a4b0', hardStyle: 'metal', wall: '#505058', wallStyle: 'metal', soft: '#e8c040', softAlt: '#6a6a78', softStyle: 'hazard', hud: ['#50505a', '#202028'], shadow: 0.3 },
  // Coming and Going: a pink floor with blue-grey blocks.
  pinkplant: { name: 'pinkplant', backdrop: '#180c18', floor: '#d898c8', floorAlt: '#e0a8d0', floorStyle: 'metal', hard: '#8898b8', hardStyle: 'metal', wall: '#6a5070', wallStyle: 'metal', soft: '#90a8d0', softAlt: '#5a6a90', softStyle: 'hazard', hud: ['#6a5070', '#301830'], shadow: 0.3 },
  // Switcheroo: a green railway yard, blue orbs, orange barrels.
  yard: { name: 'yard', backdrop: '#0c1408', floor: '#8cc850', floorAlt: '#a0d460', floorStyle: 'tiles', hard: '#5a88d8', hardStyle: 'orb', wall: '#8a6a30', wallStyle: 'stone', soft: '#f09030', softStyle: 'barrel', hud: ['#8a6a30', '#403010'], shadow: 0.3 },
  // Every Which Way: an icy white floor, bushes, orange pipes.
  frost: { name: 'frost', backdrop: '#0c1418', floor: '#dcecf4', floorAlt: '#c4dcec', floorStyle: 'ice', hard: '#d86040', hardStyle: 'bevel', wall: '#5a8aa0', wallStyle: 'stone', soft: '#58a848', softStyle: 'bush', pipe: '#e08830', hud: ['#5a8aa0', '#203848'], shadow: 0.2 },
  road: { name: 'road', backdrop: '#101010', floor: '#707078', floorAlt: '#808088', floorStyle: 'plain', hard: '#d83838', hardStyle: 'bevel', wall: '#50505a', wallStyle: 'metal', soft: '#303038', softStyle: 'rock', hud: ['#50505a', '#202028'], shadow: 0.3 },
  // Warp Desert: sand, pyramids, skulls.
  desert: { name: 'desert', backdrop: '#201408', floor: '#f0d060', floorAlt: '#e0c050', floorStyle: 'sand', hard: '#b87838', hardStyle: 'pyramid', wall: '#a06a40', wallStyle: 'stone', soft: '#f4f0e0', softStyle: 'skull', hud: ['#a06a40', '#502c10'], shadow: 0.3 },
  // Head in the Clouds: sky floor, cloud puffs, orange lanterns.
  sky: { name: 'sky', backdrop: '#3060c0', floor: '#e8f0ff', floorAlt: '#d0e0ff', floorStyle: 'plain', hard: '#f8fbff', hardStyle: 'boulder', wall: '#5080e0', wallStyle: 'bevel', soft: '#f08830', softAlt: '#ffd070', softStyle: 'buoy', hud: ['#4070d0', '#183070'], shadow: 0.18 },
  // Block World: a harlequin floor with toy blocks.
  toy: { name: 'toy', backdrop: '#200820', floor: '#f0c030', floorAlt: '#8040c0', floorStyle: 'harlequin', hard: '#e05050', hardAlt: '#40a050', hardStyle: 'checker', wall: '#8040a0', wallStyle: 'bevel', soft: '#e04040', softAlt: '#40b050', softStyle: 'toy', hud: ['#8040a0', '#401850'], shadow: 0.3 },
  snow: { name: 'snow', backdrop: '#101828', floor: '#e8f0f8', floorAlt: '#d0e0f0', floorStyle: 'plain', hard: '#7aa8d8', hardStyle: 'crystal', wall: '#6890b8', wallStyle: 'stone', soft: '#ffffff', softStyle: 'snow', hud: ['#5078a8', '#203858'], shadow: 0.2 },
  // King of the Jungle: orange dirt, tree stumps, red mushrooms.
  jungle: { name: 'jungle', backdrop: '#081408', floor: '#d8a448', floorAlt: '#c89034', floorStyle: 'sand', hard: '#9a6430', hardStyle: 'drum', wall: '#2c7a24', wallStyle: 'hedge', soft: '#e03a30', softStyle: 'mushroom', hud: ['#3a8a2c', '#185010'], shadow: 0.3 },
  // The Seven Seas: wooden decks, golden barrels, red-and-white floats.
  sea: { name: 'sea', backdrop: '#081830', floor: '#b08050', floorAlt: '#a07040', floorStyle: 'wood', hard: '#e8b830', hardStyle: 'drum', wall: '#503018', wallStyle: 'stone', soft: '#e03030', softAlt: '#fff4f0', softStyle: 'buoy', hud: ['#2050a0', '#0c2050'], shadow: 0.3 },
  // Super Power: the standard green arena (with the big emblem in the middle).
  superpower: { name: 'superpower', backdrop: '#101820', floor: '#3c9a3a', floorAlt: '#48aa44', floorStyle: 'grass', hard: '#a4aabc', hardStyle: 'bevel', wall: '#b0b6c4', wallStyle: 'bevel', soft: '#dde1ec', softAlt: '#8894b4', softStyle: 'brick', hud: ['#c8ccd8', '#9ca2b4'], shadow: 0.38 },
  // Robo Bomber: city pavement, orange blocks, red soft blocks, skyscraper walls.
  robocity: { name: 'robocity', backdrop: '#100c20', floor: '#6a7282', floorAlt: '#76808e', floorStyle: 'tiles', hard: '#e89840', hardStyle: 'bevel', wall: '#5a4a90', wallStyle: 'brick', soft: '#d83a34', softStyle: 'brick', hud: ['#5a4a90', '#281c50'], shadow: 0.32 },
  // Round and Round: a blue pond, grey boulders, lily pads.
  pond: { name: 'pond', backdrop: '#081810', floor: '#5a84d8', floorAlt: '#78a0ea', floorStyle: 'water', hard: '#9aa0aa', hardStyle: 'boulder', wall: '#3a8a30', wallStyle: 'hedge', soft: '#58b840', softStyle: 'leaf', hud: ['#3a8a30', '#185010'], shadow: 0.25 },
  // Destination Unknown: a starry purple floor, white capsules, yellow stars.
  space: { name: 'space', backdrop: '#0c0820', floor: '#5a3ca8', floorAlt: '#ffe060', floorStyle: 'stars', hard: '#eef2ff', hardAlt: '#4a7ae0', hardStyle: 'capsule', wall: '#b8c0d0', wallStyle: 'metal', soft: '#ffd030', softStyle: 'star', hud: ['#8890b0', '#404868'], shadow: 0.3 },
  // Incoming!: purple tiles, orange orbs, pale crystal blocks, brass pipes.
  incoming: { name: 'incoming', backdrop: '#100818', floor: '#9a7ac8', floorAlt: '#a888d4', floorStyle: 'tiles', hard: '#e88838', hardStyle: 'orb', wall: '#c89838', wallStyle: 'metal', soft: '#dce6ff', softStyle: 'ice', hud: ['#b08030', '#584010'], shadow: 0.3 },
  // The Fast Lane: green floor, grey drums, pink cogs, a brass frame.
  fastlane: { name: 'fastlane', backdrop: '#101008', floor: '#5aa83a', floorAlt: '#68b448', floorStyle: 'grass', hard: '#a8acb8', hardStyle: 'drum', wall: '#d8a838', wallStyle: 'metal', soft: '#f09080', softStyle: 'gear', hud: ['#c89830', '#604810'], shadow: 0.32 },
};

// ------------------------------------------------------------------ floor gimmicks

export function beltTile(dir: Dir, frame: number): Sprite {
  const p = new PixelCanvas(16, 16);
  p.rect(0, 0, 16, 16, '#303038');
  const horiz = dir === 'left' || dir === 'right';
  if (horiz) {
    p.rect(0, 1, 16, 1, '#60606c');
    p.rect(0, 14, 16, 1, '#18181c');
  } else {
    p.rect(1, 0, 1, 16, '#60606c');
    p.rect(14, 0, 1, 16, '#18181c');
  }
  const sign = dir === 'right' || dir === 'down' ? 1 : -1;
  for (let k = 0; k < 2; k++) {
    const o = (((k * 8 + frame * 2 * sign) % 16) + 16) % 16;
    for (let i = 0; i < 4; i++) {
      const a = sign > 0 ? o + i : o - i;
      const col = i < 2 ? '#e0c040' : '#a08020';
      if (horiz) {
        p.px(((a % 16) + 16) % 16, 4 + i, col);
        p.px(((a % 16) + 16) % 16, 11 - i, col);
      } else {
        p.px(4 + i, ((a % 16) + 16) % 16, col);
        p.px(11 - i, ((a % 16) + 16) % 16, col);
      }
    }
  }
  return p.canvas;
}

export function arrowTile(dir: Dir, rotating: boolean): Sprite {
  const p = new PixelCanvas(16, 16);
  p.roundRect(1, 1, 14, 14, rotating ? '#4060c0' : '#c04040', 2);
  p.roundRect(2, 2, 12, 12, rotating ? '#5070d8' : '#d85050', 2);
  const pts: [number, number][] = [];
  for (let i = 0; i < 5; i++) for (let j = -i; j <= i; j++) pts.push([j, i]);
  const stem: [number, number][] = [];
  for (let i = 5; i < 9; i++) for (let j = -1; j <= 1; j++) stem.push([j, i]);
  for (const [a, b] of [...pts, ...stem]) {
    let x = a;
    let y = b - 5;
    if (dir === 'down') y = -y - 1;
    if (dir === 'right') [x, y] = [-y - 1, a];
    if (dir === 'left') [x, y] = [y, a];
    p.px(8 + x, 8 + y, '#ffffff');
  }
  return p.canvas;
}

export function warpTile(frame: number): Sprite {
  const p = new PixelCanvas(16, 16);
  p.circle(7.5, 7.5, 7.5, '#201040');
  for (let r = 7; r > 0; r -= 1.5) {
    const a = frame * 0.4 + r;
    for (let k = 0; k < 3; k++) {
      const t = a + (k * Math.PI * 2) / 3;
      p.px(7.5 + Math.cos(t) * r, 7.5 + Math.sin(t) * r, r > 4 ? '#8060ff' : '#e0c0ff');
    }
  }
  p.circle(7.5, 7.5, 1.6, '#ffffff');
  return p.canvas;
}

export function trampolineTile(squash: number): Sprite {
  const p = new PixelCanvas(16, 16);
  p.circle(7.5, 8, 7.5, '#303030');
  p.circle(7.5, 8 + squash, 6.2, '#f04040');
  p.circle(7.5, 8 + squash, 4.2, '#ffffff');
  p.circle(7.5, 8 + squash, 2.2, '#f04040');
  return p.canvas;
}

export function seesawTile(end: 0 | 1, down: boolean): Sprite {
  const p = new PixelCanvas(16, 16);
  const y = down ? 9 : 5;
  p.rect(0, y, 16, 5, '#000000');
  p.rect(0, y + 1, 16, 3, down ? '#a06030' : '#d09050');
  p.rect(0, y + 1, 16, 1, '#f0c080');
  if (end === 0) p.rect(15, 10, 1, 6, '#606060');
  else p.rect(0, 10, 1, 6, '#606060');
  if (!down) p.rect(3, y + 5, 10, 2, 'rgba(0,0,0,0.3)');
  return p.canvas;
}

export function signTile(speed: number): Sprite {
  const p = new PixelCanvas(16, 16);
  p.circle(7.5, 7.5, 7.5, '#000000');
  p.circle(7.5, 7.5, 6.6, speed === 0 ? '#ffe040' : '#ffffff');
  p.circle(7.5, 7.5, 5.2, speed === 0 ? '#e02020' : '#2060e0');
  const label = speed === 0 ? '!' : String(speed);
  const glyphs: Record<string, string[]> = {
    '!': ['.#.', '.#.', '.#.', '...', '.#.'],
    '1': ['.#.', '##.', '.#.', '.#.', '###'],
    '2': ['##.', '..#', '.#.', '#..', '###'],
    '3': ['##.', '..#', '.#.', '..#', '##.'],
    '4': ['#.#', '#.#', '###', '..#', '..#'],
    '5': ['###', '#..', '##.', '..#', '##.'],
  };
  glyphs[label].forEach((row, y) => {
    for (let x = 0; x < 3; x++) if (row[x] === '#') p.px(6 + x, 5 + y, '#ffffff');
  });
  return p.canvas;
}

export function tyreSprite(): Sprite {
  const p = new PixelCanvas(16, 16);
  p.circle(7.5, 8, 7.5, '#101010');
  p.circle(7.5, 8, 6.4, '#303030');
  p.circle(7.5, 8, 3.4, '#a0a0a0');
  p.circle(7.5, 8, 2, '#505050');
  for (let a = 0; a < 8; a++) p.px(7.5 + Math.cos(a) * 5.4, 8 + Math.sin(a) * 5.4, '#505050');
  return p.canvas;
}

/** Rails: `h` / `v` straight or corner pieces by connected neighbours (bit flags U=1 R=2 D=4 L=8). */
export function railTile(conn: number, warp: boolean): Sprite {
  const p = new PixelCanvas(16, 16);
  const sleeper = '#7a4a28';
  const metal = '#c0c0d0';
  const up = conn & 1;
  const right = conn & 2;
  const down = conn & 4;
  const left = conn & 8;
  if (up || down) for (let y = 1; y < 16; y += 4) if ((y < 8 && up) || (y >= 8 && down)) p.rect(3, y, 10, 2, sleeper);
  if (left || right) for (let x = 1; x < 16; x += 4) if ((x < 8 && left) || (x >= 8 && right)) p.rect(x, 3, 2, 10, sleeper);
  if (up) {
    p.rect(5, 0, 1, 9, metal);
    p.rect(10, 0, 1, 9, metal);
  }
  if (down) {
    p.rect(5, 7, 1, 9, metal);
    p.rect(10, 7, 1, 9, metal);
  }
  if (left) {
    p.rect(0, 5, 9, 1, metal);
    p.rect(0, 10, 9, 1, metal);
  }
  if (right) {
    p.rect(7, 5, 9, 1, metal);
    p.rect(7, 10, 9, 1, metal);
  }
  if (warp) {
    p.circle(7.5, 7.5, 5, '#6040c0');
    p.circle(7.5, 7.5, 3, '#c0a0ff');
  }
  return p.canvas;
}

/** Floor switch: blue (points, belt reverse) or red with chevrons (belt speed). */
export function switchTile(on: boolean, speed = false): Sprite {
  const p = new PixelCanvas(16, 16);
  p.roundRect(2, 2, 12, 12, '#202030', 2);
  const [up, down, shine] = speed ? ['#ff5030', '#a02010', '#ffc0a0'] : ['#4080ff', '#2040a0', '#a0c8ff'];
  p.roundRect(3, on ? 5 : 3, 10, 9, on ? down : up, 2);
  p.rect(5, on ? 6 : 4, 6, 2, shine);
  if (speed) {
    const y = on ? 9 : 7;
    for (const x of [5, 8]) {
      p.px(x, y, shine);
      p.px(x + 1, y + 1, shine);
      p.px(x, y + 2, shine);
    }
  }
  return p.canvas;
}

/** The lower floor of Head in the Clouds: soft, puffy cloud tops (four variants). */
export function cloudTile(variant: number): Sprite {
  const p = new PixelCanvas(16, 16);
  p.rect(0, 0, 16, 16, '#c8dcf0');
  const puffs: [number, number, number][][] = [
    [[4, 5, 4], [11, 4, 3], [9, 11, 4], [2, 12, 3]],
    [[5, 10, 4], [12, 11, 3], [9, 3, 4], [2, 4, 3]],
    [[3, 3, 3], [10, 7, 5], [3, 12, 3], [14, 14, 2]],
    [[8, 4, 4], [3, 9, 3], [12, 12, 4], [14, 3, 2]],
  ];
  for (const [x, y, r] of puffs[variant % puffs.length]) {
    p.circle(x, y + 1, r, '#a8c4e4');
    p.circle(x, y, r, '#f4f8ff');
    p.circle(x - 1, y - 1, Math.max(1, r - 2), '#ffffff');
  }
  return p.canvas;
}

export function iceTile(cracks: number): Sprite {
  const p = new PixelCanvas(16, 16);
  p.rect(0, 0, 16, 16, '#8ec8f0');
  p.rect(1, 1, 14, 14, '#a8d8f8');
  for (let i = 0; i < 6; i++) p.px(3 + i, 9 - i, '#e8f8ff');
  for (let i = 0; i < 4; i++) p.px(9 + i, 13 - i, '#e8f8ff');
  if (cracks > 0) {
    const pts: [number, number][] = [[2, 8], [4, 7], [6, 9], [8, 7], [10, 10], [12, 8], [14, 9]];
    for (const [x, y] of pts) p.px(x, y, '#406080');
    p.px(7, 5, '#406080');
    p.px(7, 6, '#406080');
    p.px(9, 11, '#406080');
  }
  return p.canvas;
}

export function holeTile(frame: number): Sprite {
  const p = new PixelCanvas(16, 16);
  p.rect(0, 0, 16, 16, '#b8e0f8');
  p.ellipse(7.5, 8, 7.4, 6.8, '#103050');
  p.ellipse(7.5, 8.5, 6.4, 5.8, '#184a78');
  p.px(4 + (frame % 4), 8, '#4080b0');
  return p.canvas;
}

export function waterTile(frame: number): Sprite {
  const p = new PixelCanvas(16, 16);
  p.rect(0, 0, 16, 16, '#1c58b0');
  for (let y = 2; y < 16; y += 5) {
    for (let x = 0; x < 16; x++) {
      if ((x + frame + y) % 8 < 3) p.px(x, y + ((x + frame) % 8 < 4 ? 0 : 1), '#5890e0');
    }
  }
  p.px((frame * 3) % 16, (frame * 5) % 16, '#b0d0ff');
  return p.canvas;
}

export function bridgeTile(horizontal: boolean): Sprite {
  const p = new PixelCanvas(16, 16);
  p.rect(0, 0, 16, 16, '#1c58b0');
  if (horizontal) {
    p.rect(0, 1, 16, 14, '#000000');
    for (let x = 0; x < 16; x += 4) {
      p.rect(x, 2, 3, 12, '#b07a48');
      p.rect(x, 2, 3, 1, '#e0b080');
    }
  } else {
    p.rect(1, 0, 14, 16, '#000000');
    for (let y = 0; y < 16; y += 4) {
      p.rect(2, y, 12, 3, '#b07a48');
      p.rect(2, y, 12, 1, '#e0b080');
    }
  }
  return p.canvas;
}

/** A pipe mouth (Every Which Way): blasts go in here and out of its partner. */
export function portalTile(pipe = '#30a040'): Sprite {
  const p = new PixelCanvas(16, 16);
  p.circle(7.5, 7.5, 7.5, '#000000');
  p.circle(7.5, 7.5, 6.6, pipe);
  p.circle(7.5, 7.5, 5.2, mix(pipe, '#ffffff', 0.35));
  p.circle(7.5, 7.5, 4, mix(pipe, '#000000', 0.8));
  p.circle(6, 6, 1.2, mix(pipe, '#ffffff', 0.7));
  return p.canvas;
}

const pipeCache = new Map<string, { h: Sprite; v: Sprite; mouth: Sprite }>();

/** Pipe covers and mouths in a stage's pipe colour. */
export function pipeSprites(color = '#30a040'): { h: Sprite; v: Sprite; mouth: Sprite } {
  let set = pipeCache.get(color);
  if (!set) {
    set = { h: coverSprite('pipe', 0, color), v: coverSprite('pipe', 1, color), mouth: portalTile(color) };
    pipeCache.set(color, set);
  }
  return set;
}

export function bendTile(turn: Partial<Record<Dir, Dir>>): Sprite {
  // Orange pipe work, as on Incoming!
  const p = new PixelCanvas(16, 16);
  p.rect(0, 0, 16, 16, '#703008');
  p.rect(1, 1, 14, 14, '#e07a28');
  p.rect(2, 2, 12, 1, '#ffc070');
  // Show which sides are open.
  const open = new Set<Dir>();
  for (const [from, to] of Object.entries(turn) as [Dir, Dir][]) {
    open.add(OPP[from]);
    open.add(to);
  }
  const hole = '#2a0c00';
  if (open.has('up')) p.rect(5, 0, 6, 6, hole);
  if (open.has('down')) p.rect(5, 10, 6, 6, hole);
  if (open.has('left')) p.rect(0, 5, 6, 6, hole);
  if (open.has('right')) p.rect(10, 5, 6, 6, hole);
  p.rect(5, 5, 6, 6, hole);
  return p.canvas;
}

const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/**
 * Round and Round's flower: petals round a trumpet whose mouth faces `face` (blasts go in
 * and come out there). White petals while it turns.
 */
export function flowerTile(face: Dir, turning: boolean): Sprite {
  const p = new PixelCanvas(16, 16);
  const petal = turning ? '#ffffff' : '#f070b0';
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    p.circle(7.5 + Math.cos(a) * 4.6, 7.5 + Math.sin(a) * 4.6, 3.3, '#000000');
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    p.circle(7.5 + Math.cos(a) * 4.5, 7.5 + Math.sin(a) * 4.5, 2.7, petal);
  }
  p.circle(7.5, 7.5, 4, '#000000');
  p.circle(7.5, 7.5, 3.3, '#ffe040');
  // The mouth: a dark throat opening toward `face`.
  const mx = 7.5 + DXY[face][0] * 3.5;
  const my = 7.5 + DXY[face][1] * 3.5;
  p.circle(mx, my, 2.9, '#000000');
  p.circle(mx, my, 2.1, '#5a1030');
  p.circle(7.5 - DXY[face][0] * 1.2, 7.5 - DXY[face][1] * 1.2, 1, '#fff8c0');
  return p.canvas;
}

const DXY: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** Overlays that hide whoever stands under them. */
export function coverSprite(style: 'pipe' | 'hut' | 'foliage', variant: number, pipe = '#30a040'): Sprite {
  const p = new PixelCanvas(16, 16);
  if (style === 'pipe') {
    const horiz = variant === 0;
    const [dark, light] = [mix(pipe, '#000000', 0.5), mix(pipe, '#ffffff', 0.45)];
    if (horiz) {
      p.rect(0, 2, 16, 12, dark);
      p.rect(0, 3, 16, 10, pipe);
      p.rect(0, 4, 16, 3, light);
      p.rect(0, 11, 16, 1, dark);
    } else {
      p.rect(2, 0, 12, 16, dark);
      p.rect(3, 0, 10, 16, pipe);
      p.rect(4, 0, 3, 16, light);
    }
  } else if (style === 'hut') {
    p.ellipse(7.5, 10.5, 8.2, 7.6, '#203858');
    p.ellipse(7.5, 10, 7.4, 6.8, '#f4faff');
    for (let y = 5; y < 16; y += 3) p.rect(1, y, 14, 1, '#9cc0e0');
    for (let x = 3; x < 14; x += 4) p.rect(x, 4, 1, 12, '#b8d4ec');
    p.ellipse(7.5, 14, 3.4, 4, '#203858');
    p.ellipse(7.5, 14.5, 2.4, 3.2, '#0c1c30');
  } else {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + variant;
      p.circle(7.5 + Math.cos(a) * 4, 7.5 + Math.sin(a) * 4, 4.2, k % 2 ? '#2c7020' : '#40902c');
    }
    p.circle(7.5, 7.5, 4, '#50a838');
    p.px(5, 5, '#90e070');
    p.px(10, 8, '#90e070');
  }
  return p.canvas;
}

// ------------------------------------------------------------------ entities

export function trolleySprite(dir: Dir, frame: number): Sprite {
  const p = new PixelCanvas(20, 18);
  const horiz = dir === 'left' || dir === 'right';
  p.roundRect(1, 3, 18, 12, '#000000', 2);
  p.roundRect(2, 4, 16, 10, '#c05020', 2);
  p.rect(2, 4, 16, 2, '#ff9050');
  p.rect(4, 7, 12, 5, '#602010');
  const wy = 14;
  for (const wx of horiz ? [5, 14] : [4, 15]) {
    p.circle(wx, wy, 2.4, '#202020');
    p.px(wx + (frame % 2 ? 1 : -1), wy, '#a0a0a0');
  }
  return p.canvas;
}

export function robotSprite(frame: number, stomping: boolean, lift: number): Sprite {
  const p = new PixelCanvas(40, 48);
  const oy = stomping ? -lift : 0;
  const legY = 34;
  const step = frame % 2;
  // legs
  p.rect(9, legY - step * 2, 8, 12 + step * 2, '#303038');
  p.rect(23, legY - (1 - step) * 2, 8, 12 + (1 - step) * 2, '#303038');
  p.rect(7, 44, 12, 4, '#505058');
  p.rect(21, 44, 12, 4, '#505058');
  // body
  p.roundRect(4, 14 + oy, 32, 22, '#000000', 3);
  p.roundRect(5, 15 + oy, 30, 20, '#d0d4e0', 3);
  p.rect(8, 20 + oy, 24, 10, '#4060c0');
  p.rect(10, 22 + oy, 20, 6, '#80a0ff');
  // head
  p.roundRect(10, 2 + oy, 20, 14, '#000000', 3);
  p.roundRect(11, 3 + oy, 18, 12, '#e0e4f0', 3);
  p.rect(13, 7 + oy, 14, 4, '#200000');
  p.rect(14 + (frame % 3) * 4, 8 + oy, 3, 2, '#ff3030');
  p.rect(19, 0 + oy, 2, 3, '#606060');
  p.circle(20, 0 + oy, 1.5, '#ffe040');
  // arms
  p.rect(0, 18 + oy, 5, 12, '#303038');
  p.rect(35, 18 + oy, 5, 12, '#303038');
  return p.canvas;
}

export function fishSprite(frame: number): Sprite {
  const p = new PixelCanvas(16, 16);
  const flip = frame % 2;
  p.ellipse(8, 8, 6, 3.4, '#000000');
  p.ellipse(8, 8, 5.2, 2.6, '#f08030');
  p.ellipse(7, 7, 3, 1.2, '#ffc080');
  p.px(flip ? 11 : 4, 7, '#000000');
  const tx = flip ? 2 : 13;
  p.rect(tx, 6, 2, 5, '#f08030');
  p.rect(5, 10, 6, 1, '#c05010');
  return p.canvas;
}

export function cartSprite(color: string): Sprite {
  const p = new PixelCanvas(18, 12);
  p.roundRect(0, 2, 18, 8, '#000000', 2);
  p.roundRect(1, 3, 16, 6, color, 2);
  p.rect(1, 3, 16, 2, mix(color, '#ffffff', 0.4));
  p.circle(4, 10, 2, '#202020');
  p.circle(14, 10, 2, '#202020');
  return p.canvas;
}

export function pressureBlock(base: string): Sprite {
  const p = new PixelCanvas(16, 16);
  p.rect(0, 0, 16, 16, '#000000');
  p.rect(0, 0, 15, 15, mix(base, '#ffffff', 0.4));
  p.rect(1, 1, 14, 14, mix(base, '#000000', 0.35));
  p.rect(1, 1, 13, 13, base);
  p.rect(4, 4, 7, 7, mix(base, '#ffffff', 0.2));
  return p.canvas;
}

// ------------------------------------------------------------------ partners

/** A rideable partner seen from the front-ish side (drawn under the rider). */
export function partnerSprite(kind: string, color: string, frame: number, facing: Dir): Sprite {
  const p = new PixelCanvas(20, 16);
  const hop = frame % 2;
  const dark = mix(color, '#000000', 0.35);
  const light = mix(color, '#ffffff', 0.4);
  const left = facing === 'left';
  const body = (): void => {
    p.ellipse(10, 9 - hop, 8, 5.5, '#000000');
    p.ellipse(10, 9 - hop, 7.2, 4.6, color);
    p.ellipse(9, 7 - hop, 4, 2, light);
  };
  const legs = (): void => {
    p.rect(4, 13, 4, 3, dark);
    p.rect(12, 13, 4, 3, dark);
    p.rect(4 + hop, 15, 4, 1, '#000000');
    p.rect(12 - hop, 15, 4, 1, '#000000');
  };
  if (kind.startsWith('louie')) {
    // A kangaroo-like roo with long ears and a tail.
    legs();
    body();
    const hx = left ? 3 : 17;
    p.circle(hx, 6 - hop, 3.6, '#000000');
    p.circle(hx, 6 - hop, 2.8, color);
    p.rect(hx - 2, 0 - hop, 2, 4, dark);
    p.rect(hx + 1, 0 - hop, 2, 4, dark);
    p.px(left ? hx - 1 : hx + 1, 5 - hop, '#000000');
    const tx = left ? 18 : 1;
    p.rect(tx, 9 - hop, 2, 5, dark);
  } else if (kind === 'pytera') {
    p.ellipse(10, 9 - hop, 8, 5, '#000000');
    p.ellipse(10, 9 - hop, 7, 4, color);
    p.rect(0, 5 - hop * 2, 6, 3, dark);
    p.rect(14, 5 - hop * 2, 6, 3, dark);
    p.rect(left ? 1 : 15, 8 - hop, 4, 2, '#ffe040');
  } else if (kind === 'simeon') {
    legs();
    body();
    p.circle(left ? 4 : 16, 5 - hop, 3.4, color);
    p.circle(left ? 4 : 16, 6 - hop, 1.8, '#ffd0a0');
  } else if (kind === 'drakko') {
    legs();
    body();
    for (let i = 0; i < 4; i++) p.px(6 + i * 3, 3 - hop, '#f0e040');
    p.circle(left ? 3 : 17, 7 - hop, 3, color);
  } else if (kind === 'coney') {
    legs();
    p.circle(10, 7 - hop, 6.6, '#000000');
    p.circle(10, 7 - hop, 5.8, color);
    p.circle(10, 7 - hop, 3.4, light);
    p.circle(10, 7 - hop, 1.6, dark);
  } else {
    legs();
    body();
    p.rect(left ? 0 : 16, 8 - hop, 4, 4, dark);
    p.px(left ? 1 : 18, 7 - hop, '#ffffff');
  }
  return p.canvas;
}

// ------------------------------------------------------------------ character accessories

/** Draw a character's accessory onto a 16×24 bomber frame (in place). */
export function drawAccessory(p: PixelCanvas, look: string, dir: Dir): void {
  const back = dir === 'up';
  const side = dir === 'left' || dir === 'right';
  const flipX = (x: number): number => (dir === 'right' ? 15 - x : x);
  switch (look) {
    case 'ushanka':
      p.rect(3, 2, 10, 4, '#000000');
      p.rect(4, 2, 8, 3, '#6a4a30');
      p.rect(2, 5, 3, 5, '#6a4a30');
      p.rect(11, 5, 3, 5, '#6a4a30');
      p.rect(6, 3, 4, 1, '#e02020');
      break;
    case 'mohawk':
      for (let i = 0; i < 6; i++) p.rect(6 + (i % 2), i, 3, 2, i % 2 ? '#ff40a0' : '#c020e0');
      break;
    case 'sombrero':
      p.rect(0, 5, 16, 2, '#000000');
      p.rect(1, 5, 14, 1, '#e0c060');
      p.rect(4, 0, 8, 5, '#000000');
      p.rect(5, 1, 6, 4, '#e0c060');
      p.rect(5, 3, 6, 1, '#e02020');
      break;
    case 'horns':
      p.rect(1, 3, 2, 3, '#f0f0e0');
      p.rect(0, 1, 2, 3, '#f0f0e0');
      p.rect(13, 3, 2, 3, '#f0f0e0');
      p.rect(14, 1, 2, 3, '#f0f0e0');
      p.rect(3, 5, 10, 2, '#806040');
      break;
    case 'cap':
      p.rect(4, 3, 8, 3, '#000000');
      p.rect(5, 3, 6, 2, '#2060e0');
      if (!back) p.rect(side ? (dir === 'left' ? 1 : 10) : 4, 5, side ? 5 : 8, 2, '#1040a0');
      break;
    case 'bow':
      p.rect(9, 2, 6, 4, '#000000');
      p.rect(10, 2, 2, 3, '#ff60b0');
      p.rect(13, 2, 2, 3, '#ff60b0');
      p.rect(12, 3, 1, 2, '#ffffff');
      break;
    case 'queue':
      p.rect(5, 3, 6, 3, '#000000');
      p.rect(6, 3, 4, 2, '#e02020');
      if (back || side) p.rect(flipX(back ? 7 : 12), 6, 2, 8, '#202020');
      break;
    case 'crown':
      p.rect(4, 1, 8, 4, '#000000');
      p.rect(5, 2, 6, 3, '#ffd040');
      p.px(5, 1, '#ffd040');
      p.px(8, 1, '#ffd040');
      p.px(10, 1, '#ffd040');
      p.px(7, 3, '#e02040');
      break;
    case 'jetpack':
      if (back) {
        p.rect(3, 15, 4, 7, '#606070');
        p.rect(9, 15, 4, 7, '#606070');
        p.rect(4, 22, 2, 2, '#ff8020');
        p.rect(10, 22, 2, 2, '#ff8020');
      } else {
        p.rect(flipX(13), 12, 3, 7, '#606070');
      }
      p.rect(4, 3, 8, 2, '#c0c0d0');
      break;
    case 'bazooka':
      p.rect(side ? 0 : 10, 13, side ? 16 : 6, 3, '#000000');
      p.rect(side ? 1 : 11, 14, side ? 14 : 4, 1, '#508040');
      p.rect(4, 3, 8, 2, '#508040');
      break;
    case 'hammer':
      p.rect(flipX(13), 8, 1, 9, '#8a5a30');
      p.rect(flipX(12), 6, 3, 3, '#808088');
      p.rect(4, 3, 8, 2, '#c02020');
      break;
    case 'tiara':
      p.rect(5, 3, 6, 2, '#000000');
      p.rect(6, 3, 4, 1, '#ffd040');
      p.px(7, 2, '#40e0ff');
      p.px(8, 2, '#40e0ff');
      break;
    case 'cowboy':
      p.rect(1, 5, 14, 2, '#000000');
      p.rect(2, 5, 12, 1, '#a06030');
      p.rect(4, 1, 8, 4, '#000000');
      p.rect(5, 2, 6, 3, '#a06030');
      break;
    case 'kabuto':
      p.rect(3, 2, 10, 4, '#000000');
      p.rect(4, 3, 8, 2, '#303048');
      p.rect(2, 0, 2, 3, '#ffd040');
      p.rect(12, 0, 2, 3, '#ffd040');
      p.rect(7, 1, 2, 2, '#ffd040');
      break;
    default:
      break;
  }
}
