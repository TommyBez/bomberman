import { mix } from '../engine/gfx';
import type { EnemyKind } from '../game/campaign/enemies';
import { PixelCanvas } from './pixel';

/** Original, procedurally drawn designs for the eight single-player enemies (16×16). */

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

/** `retro` draws flat, NES-like colours without shading. */
export function drawEnemy(kind: EnemyKind, frame: number, look: Look, dead = false, retro = false): HTMLCanvasElement {
  flat = retro;
  const p = new PixelCanvas(16, 16);
  const f = frame % ENEMY_ANIM_FRAMES;
  const bob = f === 1 || f === 2 ? 1 : 0;
  const mood = (m: Face['mood']): Face['mood'] => (dead ? 'dead' : m);
  switch (kind) {
    case 'balloom': {
      // Orange balloon with a tied knot, bobbing gently.
      const sq = f % 2 ? 0.4 : 0;
      p.px(8, 15, '#000000');
      p.rect(7, 13 + bob - 1, 3, 2, '#000000');
      p.px(8, 13 + bob - 1, '#c05010');
      body(p, 7.5, 7 + bob * 0.5, 6.4 + sq, 6.2 - sq, '#ff8c1a');
      eyes(p, { ex: [5, 10], ey: 6 + bob, look, mood: mood('happy'), mouthY: 10 });
      mouth(p, 8, 10 + bob, mood('happy'));
      break;
    }
    case 'oneal': {
      // Blue onion creature with a swaying sprout.
      const sway = [0, 1, 0, -1][f];
      p.rect(7 + sway, 1, 2, 3, '#000000');
      p.px(8 + sway, 2, '#80e060');
      p.px(8 + sway, 1, '#40a030');
      body(p, 7.5, 9, 6.6, 5.6 - (f % 2) * 0.3, '#3c78ff');
      p.ellipse(7.5, 4.6, 3.2, 1.6, '#000000');
      p.ellipse(7.5, 4.8, 2.4, 1.1, '#3c78ff');
      eyes(p, { ex: [5, 10], ey: 8, look, mood: mood('angry'), mouthY: 12 });
      mouth(p, 8, 12, mood('plain'));
      break;
    }
    case 'doll': {
      // Pink round doll with rosy cheeks and tiny hands.
      const hand = f % 2;
      body(p, 7.5, 8 + bob * 0.5, 6.2, 6.4, '#ff8ccf');
      p.rect(0, 9 - hand, 2, 2, '#000000');
      p.px(0, 9 - hand, '#ffd0e8');
      p.rect(14, 8 + hand, 2, 2, '#000000');
      p.px(15, 8 + hand, '#ffd0e8');
      eyes(p, { ex: [5, 10], ey: 7 + bob, look, mood: mood('happy'), mouthY: 11 });
      if (!dead) {
        p.px(3, 10 + bob, '#ff4090');
        p.px(12, 10 + bob, '#ff4090');
      }
      mouth(p, 8, 11 + bob, mood('happy'), 1);
      break;
    }
    case 'minvo': {
      // Red sun-face with rotating spikes and a toothy grin.
      const spikes: [number, number][] = f % 2 ? [[7, 0], [15, 7], [7, 15], [0, 7]] : [[2, 2], [13, 2], [13, 13], [2, 13]];
      for (const [x, y] of spikes) {
        p.rect(x, y, 2, 2, '#000000');
        p.px(x + (x < 8 ? 1 : 0), y + (y < 8 ? 1 : 0), '#ffd040');
      }
      body(p, 7.5, 7.5, 5.8, 5.8, '#f03838');
      eyes(p, { ex: [5, 10], ey: 6, look, mood: mood('angry'), mouthY: 10 });
      mouth(p, 8, 10, mood('angry'), 3);
      break;
    }
    case 'kondoria': {
      // Translucent blue droplet that drifts through walls.
      p.ctx.globalAlpha = 0.9;
      p.ellipse(7.5, 9.5, 6.6, 5.6, '#000000');
      p.rect(6, 1 + bob, 3, 5, '#000000');
      p.ellipse(7.5, 9.5, 5.6, 4.6, '#2090d0');
      p.rect(7, 2 + bob, 1, 4, '#2090d0');
      p.ellipse(7.5, 8.8, 4.6, 3.8, '#58c0f0');
      p.px(5, 7, '#e0f8ff');
      p.px(4, 8, '#e0f8ff');
      p.ctx.globalAlpha = 1;
      eyes(p, { ex: [5, 10], ey: 9, look, mood: mood('sleepy'), mouthY: 12 });
      mouth(p, 8, 12, mood('plain'), 1);
      break;
    }
    case 'ovapi': {
      // Purple ghost with a wavy hem.
      p.ctx.globalAlpha = 0.92;
      p.ellipse(7.5, 7, 6.8, 6.4, '#000000');
      p.rect(1, 7, 14, 7, '#000000');
      p.ellipse(7.5, 7, 5.8, 5.4, '#9048d8');
      p.rect(2, 7, 12, 6, '#9048d8');
      const wave = f % 2;
      for (let x = 1; x < 15; x++) {
        const down = (x + wave) % 3 === 0;
        p.px(x, 13, down ? '#9048d8' : '#000000');
        p.px(x, 14, down ? '#000000' : 'rgba(0,0,0,0)');
      }
      p.ellipse(5.5, 4.5, 1.6, 1.2, '#c8a0ff');
      p.ctx.globalAlpha = 1;
      eyes(p, { ex: [5, 10], ey: 7, look, mood: mood('plain'), mouthY: 11 });
      mouth(p, 8, 11, mood('plain'), 1);
      break;
    }
    case 'pass': {
      // Orange tiger face with ears, stripes and fangs.
      p.rect(1, 1, 4, 4, '#000000');
      p.rect(11, 1, 4, 4, '#000000');
      p.rect(2, 2, 2, 2, '#ffa030');
      p.rect(12, 2, 2, 2, '#ffa030');
      body(p, 7.5, 8.5, 6.4, 6, '#ff9020');
      p.rect(7, 3, 2, 2, '#402000');
      p.px(1, 8, '#402000');
      p.px(2, 9, '#402000');
      p.px(14, 8, '#402000');
      p.px(13, 9, '#402000');
      eyes(p, { ex: [5, 10], ey: 7 + bob * 0, look, mood: mood('angry'), mouthY: 11 });
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
      // Golden coin with a face, spinning.
      const widths = [6.6, 4.8, 2.2, 4.8];
      const rx = widths[f];
      p.ellipse(7.5, 7.5, rx + 1, 7.4, '#000000');
      p.ellipse(7.5, 7.5, rx, 6.4, '#c08000');
      p.ellipse(7.5 - rx * 0.12, 7, rx * 0.82, 5.6, '#ffd030');
      if (rx > 4) {
        p.ellipse(7.5 - rx * 0.4, 4.5, 1.2, 1.2, '#fff8c0');
        eyes(p, { ex: [f === 0 ? 5 : 6, f === 0 ? 10 : 9], ey: 6, look, mood: mood('angry'), mouthY: 10 });
        mouth(p, 8, 10, mood('angry'), f === 0 ? 2 : 1);
      } else {
        p.rect(7, 2, 1, 11, '#fff8c0');
      }
      break;
    }
  }
  return p.canvas;
}
