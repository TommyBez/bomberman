import { mix } from '../engine/gfx';
import type { EnemyKind } from '../game/campaign/enemies';
import { PixelCanvas } from './pixel';

/** Procedurally drawn designs for the eight single-player enemies (16×16): Modern and Retro. */

export const ENEMY_ANIM_FRAMES = 4;

type Look = 'left' | 'right';

interface Face {
  /** eye centres */
  ex: [number, number];
  ey: number;
  look: Look;
  mood: 'happy' | 'angry' | 'sleepy' | 'dead' | 'plain';
  mouthY: number;
}

function eyes(p: PixelCanvas, f: Face): void {
  const off = f.look === 'left' ? -1 : 0;
  for (const x of f.ex) {
    if (f.mood === 'dead') {
      p.px(x - 1, f.ey - 1, '#000000');
      p.px(x + 1, f.ey - 1, '#000000');
      p.px(x, f.ey, '#000000');
      p.px(x - 1, f.ey + 1, '#000000');
      p.px(x + 1, f.ey + 1, '#000000');
      continue;
    }
    if (f.mood === 'sleepy') {
      p.rect(x - 1, f.ey, 3, 1, '#000000');
      p.px(x - 1, f.ey - 1, '#ffffff');
      p.px(x + 1, f.ey - 1, '#ffffff');
      continue;
    }
    p.rect(x - 1, f.ey - 1, 3, 4, '#000000');
    p.rect(x - 1, f.ey - 1, 2, 3, '#ffffff');
    p.rect(x + off, f.ey, 1, 2, '#101030');
    if (f.mood === 'angry') {
      const sx = x < 8 ? 1 : -1;
      p.px(x - sx, f.ey - 2, '#000000');
      p.px(x, f.ey - 2, '#000000');
      p.px(x + sx, f.ey - 3, '#000000');
    }
  }
}

function mouth(p: PixelCanvas, cx: number, y: number, mood: Face['mood'], wide = 2): void {
  if (mood === 'dead') {
    p.rect(cx - wide, y, wide * 2, 1, '#000000');
    p.px(cx - wide - 1, y + 1, '#000000');
    p.px(cx + wide, y + 1, '#000000');
    return;
  }
  if (mood === 'angry') {
    p.rect(cx - wide, y, wide * 2, 2, '#000000');
    for (let i = -wide; i < wide; i += 2) p.px(cx + i, y, '#ffffff');
    return;
  }
  p.px(cx - wide - 1, y - 1, '#000000');
  p.rect(cx - wide, y, wide * 2, 1, '#000000');
  p.px(cx + wide, y - 1, '#000000');
}

let flat = false;

function body(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, base: string): void {
  p.ellipse(cx, cy, rx + 1, ry + 1, '#000000');
  if (flat) {
    p.ellipse(cx, cy, rx, ry, base);
    return;
  }
  p.ellipse(cx, cy, rx, ry, mix(base, '#000000', 0.3));
  p.ellipse(cx - 0.6, cy - 0.7, rx - 0.8, ry - 0.9, base);
  p.ellipse(cx - rx * 0.42, cy - ry * 0.45, Math.max(1, rx * 0.28), Math.max(1, ry * 0.22), mix(base, '#ffffff', 0.55));
}

/** Big round eyes (the Modern designs'), pupils looking the way the monster goes. */
function bigEyes(p: PixelCanvas, xs: [number, number], y: number, look: Look, dead: boolean, pupil = '#101030'): void {
  for (const x of xs) {
    p.circle(x, y, 2.4, '#000000');
    p.circle(x, y, 1.7, '#ffffff');
    if (dead) {
      p.px(Math.round(x) - 1, y - 1, '#000000');
      p.px(Math.round(x), y, '#000000');
      p.px(Math.round(x) + 1, y + 1, '#000000');
    } else p.rect(Math.round(x) + (look === 'left' ? -1 : 0), y - 1, 1, 2, pupil);
  }
}

/** Body colours: the PlayStation's Modern designs, and its Retro (1985 NES palette) ones. */
const MODERN: Record<EnemyKind, string> = {
  balloom: '#ff8c1a',
  oneal: '#b8e0ff',
  doll: '#d82020',
  minvo: '#ff6a18',
  kondoria: '#30c0b0',
  ovapi: '#f068a8',
  pass: '#ffd02a',
  pontan: '#ff58a8',
};
const RETRO: Record<EnemyKind, string> = {
  balloom: '#f87858',
  oneal: '#40c0f8',
  doll: '#b8108c',
  minvo: '#f87858',
  kondoria: '#40c0f8',
  ovapi: '#b8108c',
  pass: '#f87858',
  pontan: '#f87858',
};

/**
 * The eight monsters (16×16). Modern follows the PlayStation's designs: an orange balloon
 * (Ballom), a pale-blue drop (Onil), a red barrel (Dahl), an orange ball with a gaping mouth
 * (Minvo), a teal blob (Doria), a pink octopus (Ovape), a yellow tiger (Pass), a pink coin
 * (Pontan). Retro (`retro`) is its 1985 look: the same shapes, flat, in the NES palette,
 * with Minvo grinning, Ovape a ghost and Pass spotted.
 */
export function drawEnemy(kind: EnemyKind, frame: number, look: Look, dead = false, retro = false): HTMLCanvasElement {
  flat = retro;
  const p = new PixelCanvas(16, 16);
  const f = frame % ENEMY_ANIM_FRAMES;
  const bob = f === 1 || f === 2 ? 1 : 0;
  const mood = (m: Face['mood']): Face['mood'] => (dead ? 'dead' : m);
  const col = (retro ? RETRO : MODERN)[kind];
  const lite = mix(col, '#ffffff', 0.55);
  switch (kind) {
    case 'balloom': {
      // A balloon with a tied knot, bobbing gently.
      const sq = f % 2 ? 0.4 : 0;
      p.px(8, 15, '#000000');
      p.rect(7, 13 + bob - 1, 3, 2, '#000000');
      p.px(8, 13 + bob - 1, mix(col, '#000000', 0.3));
      body(p, 7.5, 7 + bob * 0.5, 6.4 + sq, 6.2 - sq, col);
      eyes(p, { ex: [5, 10], ey: 6 + bob, look, mood: mood('happy'), mouthY: 10 });
      mouth(p, 8, 10 + bob, mood('happy'));
      break;
    }
    case 'oneal': {
      // A drop whose tip leans with the sway.
      const sway = [0, 1, 0, -1][f];
      body(p, 7.5, 9.5, 6.2, 5.4 - (f % 2) * 0.3, col);
      for (let i = 0; i < 4; i++) {
        const dx = i < 2 ? sway : 0;
        p.rect(7 - i + dx, 1 + i, 2 + i * 2, 1, '#000000');
        if (i > 0) p.rect(8 - i + dx, 1 + i, i * 2, 1, i === 1 ? lite : col);
      }
      p.px(5, 7, '#ffffff');
      eyes(p, { ex: [5, 10], ey: 9, look, mood: mood('angry'), mouthY: 13 });
      mouth(p, 8, 13, mood('plain'), 1);
      break;
    }
    case 'doll': {
      // A barrel with bands and big round eyes.
      const y0 = 2 + bob;
      const band = mix(col, '#000000', 0.4);
      p.roundRect(1, y0, 14, 13 - bob, '#000000', 4);
      p.roundRect(2, y0 + 1, 12, 11 - bob, col, 3);
      p.rect(2, y0 + 4, 12, 1, band);
      p.rect(2, y0 + 8, 12, 1, band);
      p.rect(4, y0 + 1, 3, 2, lite);
      bigEyes(p, [5.5, 10.5], y0 + 6, look, dead, retro ? '#000000' : '#1830c0');
      break;
    }
    case 'minvo': {
      body(p, 7.5, 8, 6.4, 6.2 - (f % 2) * 0.4, col);
      if (retro) {
        // A wide, toothy grin.
        eyes(p, { ex: [5, 10], ey: 6, look, mood: mood('happy'), mouthY: 10 });
        if (dead) mouth(p, 8, 11, 'dead', 3);
        else {
          p.rect(4, 10, 8, 3, '#000000');
          for (let x = 5; x < 11; x += 2) p.px(x, 10, '#ffffff');
        }
      } else {
        bigEyes(p, [5, 10], 6, look, dead);
        if (dead) mouth(p, 8, 12, 'dead', 2);
        else {
          p.ellipse(8.5, 12, 3, 1.6 + (f % 2) * 0.6, '#000000');
          p.ellipse(8.5, 12, 2, 0.8 + (f % 2) * 0.6, '#a01818');
        }
      }
      break;
    }
    case 'kondoria': {
      // A blob with two ear bumps and a wavering base.
      p.ctx.globalAlpha = retro ? 1 : 0.92;
      p.ellipse(3.5, 3.5, 2.4, 2.4, '#000000');
      p.ellipse(11.5, 3.5, 2.4, 2.4, '#000000');
      p.ellipse(7.5, 9, 7, 5.8, '#000000');
      p.ellipse(3.5, 3.5, 1.4, 1.4, col);
      p.ellipse(11.5, 3.5, 1.4, 1.4, col);
      p.ellipse(7.5, 9, 6, 4.8, col);
      p.ellipse(6, 7, 3, 2, lite);
      const wave = f % 2;
      for (let x = 2; x < 14; x++) if ((x + wave) % 3 === 0) p.px(x, 14, col);
      p.ctx.globalAlpha = 1;
      eyes(p, { ex: [5, 10], ey: 9, look, mood: mood('happy'), mouthY: 12 });
      mouth(p, 8, 12, mood('happy'), 1);
      break;
    }
    case 'ovapi': {
      if (retro) {
        // A ghost with a wavy hem.
        p.ellipse(7.5, 7, 6.8, 6.4, '#000000');
        p.rect(1, 7, 14, 7, '#000000');
        p.ellipse(7.5, 7, 5.8, 5.4, col);
        p.rect(2, 7, 12, 6, col);
        const wave = f % 2;
        for (let x = 1; x < 15; x++) {
          const down = (x + wave) % 3 === 0;
          p.px(x, 13, down ? col : '#000000');
          p.px(x, 14, down ? '#000000' : 'rgba(0,0,0,0)');
        }
        eyes(p, { ex: [5, 10], ey: 7, look, mood: mood('plain'), mouthY: 11 });
        mouth(p, 8, 11, mood('plain'), 1);
        break;
      }
      // An octopus on four wriggling legs.
      p.ellipse(7.5, 6.5, 6.4, 5.8, '#000000');
      p.ellipse(7.5, 6.5, 5.4, 4.8, col);
      p.ellipse(5.5, 4, 1.8, 1.2, lite);
      for (let n = 0; n < 4; n++) {
        const x = 2 + n * 3.4;
        const kick = (n + f) % 2;
        p.rect(Math.round(x) - 1, 10, 4, 5 - kick, '#000000');
        p.rect(Math.round(x), 10, 2, 4 - kick, col);
      }
      p.rect(3, 10, 10, 1, col);
      bigEyes(p, [5.5, 9.5], 6, look, dead, '#108080');
      break;
    }
    case 'pass': {
      // A tiger's face: ears, stripes (spots in Retro) and fangs.
      const mark = retro ? '#ffffff' : mix(col, '#000000', 0.35);
      p.rect(1, 1, 4, 4, '#000000');
      p.rect(11, 1, 4, 4, '#000000');
      p.rect(2, 2, 2, 2, lite);
      p.rect(12, 2, 2, 2, lite);
      body(p, 7.5, 8.5, 6.4, 6, col);
      p.rect(7, 3, 2, 2, mark);
      p.px(1, 8, mark);
      p.px(2, 9, mark);
      p.px(14, 8, mark);
      p.px(13, 9, mark);
      eyes(p, { ex: [5, 10], ey: 7, look, mood: mood('angry'), mouthY: 11 });
      if (!dead) {
        p.rect(6, 11, 4, 2, '#000000');
        p.px(6, 13, '#ffffff');
        p.px(9, 13, '#ffffff');
        p.px(7, 11, '#ff3060');
        p.px(8, 11, '#ff3060');
      } else mouth(p, 8, 11, 'dead');
      break;
    }
    case 'pontan': {
      // A coin with a face, spinning.
      const rx = [6.6, 4.8, 2.2, 4.8][f];
      const rim = retro ? '#b8108c' : '#b01860';
      p.ellipse(7.5, 7.5, rx + 1, 7.4, '#000000');
      p.ellipse(7.5, 7.5, rx, 6.4, rim);
      p.ellipse(7.5 - rx * 0.12, 7, rx * 0.82, 5.6, col);
      if (rx > 4) {
        p.ellipse(7.5 - rx * 0.4, 4.5, 1.4, 1.2, retro ? '#ffffff' : '#ffe860');
        eyes(p, { ex: [f === 0 ? 5 : 6, f === 0 ? 10 : 9], ey: 7, look, mood: mood('angry'), mouthY: 11 });
        mouth(p, 8, 11, mood('angry'), f === 0 ? 2 : 1);
      } else p.rect(7, 2, 1, 11, retro ? '#ffffff' : '#ffe860');
      break;
    }
  }
  return p.canvas;
}
