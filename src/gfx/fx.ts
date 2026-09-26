import { PixelCanvas } from './pixel';
import { FLAME_CENTER, FLAME_DOWN, FLAME_LEFT, FLAME_RIGHT, FLAME_UP } from '../game/core/types';

/** Procedurally drawn bombs and explosions. */

export const BOMB_FRAMES = 3;

/** A bomb pulsing through three sizes; `lit` adds the fuse spark. */
export function drawBomb(frame: number, palette: { body: string; mid: string; shine: string } = BOMB_COLORS): HTMLCanvasElement {
  const p = new PixelCanvas(16, 16);
  const r = [5.6, 6.1, 6.6][frame % BOMB_FRAMES];
  const cx = 7.5;
  const cy = 9.2;
  p.circle(cx, cy, r + 1, '#000000');
  p.circle(cx, cy, r, palette.body);
  p.ellipse(cx - 0.8, cy - 0.8, r - 1.4, r - 1.6, palette.mid);
  p.ellipse(cx - 2.2, cy - 2.4, 1.6, 1.3, palette.shine);
  p.px(Math.round(cx - 3), Math.round(cy - 3), '#ffffff');
  // fuse cap
  const top = Math.round(cy - r - 1);
  p.rect(9, top, 3, 2, '#000000');
  p.rect(10, top, 2, 1, '#a07048');
  p.px(11, top - 1, '#000000');
  p.px(12, top - 2, '#c08850');
  // spark
  const sparks = [
    [[12, top - 3, '#ffffff'], [13, top - 3, '#ffd040'], [12, top - 4, '#ff6020']],
    [[13, top - 3, '#ffffff'], [12, top - 4, '#ffd040'], [14, top - 4, '#ff6020']],
    [[12, top - 3, '#ffffa0'], [13, top - 4, '#ff9020'], [11, top - 4, '#ff4020']],
  ] as const;
  for (const [x, y, c] of sparks[frame % 3]) p.px(x, y, c);
  return p.canvas;
}

export const BOMB_COLORS = { body: '#181830', mid: '#2c2c58', shine: '#9aa0e0' };
export const REMOTE_BOMB_COLORS = { body: '#401010', mid: '#702020', shine: '#ffa0a0' };
export const RETRO_BOMB_COLORS = { body: '#000000', mid: '#000000', shine: '#fcfcfc' };

/** Explosion colours, outside → inside. */
const FLAME_LAYERS = ['#d81800', '#ff6a00', '#ffc020', '#fff4a0', '#ffffff'];
/** Three-colour 8-bit explosion for the Retro version. */
const RETRO_FLAME_LAYERS = ['#d82800', '#d82800', '#fc9838', '#fcfcfc', '#fcfcfc'];

export const FLAME_PHASES = 5;
const FLAME_HALF = [3, 5, 7, 6, 4];

type Seg = [number, number, number, number];

function segDist(px: number, py: number, [ax, ay, bx, by]: Seg): number {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2)) : 0;
  const dx = px - (ax + vx * t);
  const dy = py - (ay + vy * t);
  return Math.hypot(dx, dy);
}

/**
 * Draw one flame tile. `bits` says which neighbours it connects to (FLAME_* flags),
 * `phase` 0..4 is the animation step (0/4 thin, 2 thickest).
 */
export function drawFlame(bits: number, phase: number, retro = false): HTMLCanvasElement {
  const p = new PixelCanvas(16, 16);
  const half = FLAME_HALF[Math.max(0, Math.min(FLAME_PHASES - 1, phase))];
  const c = 8;
  const segs: Seg[] = [];
  const center = (bits & FLAME_CENTER) !== 0;
  const L = (bits & FLAME_LEFT) !== 0;
  const R = (bits & FLAME_RIGHT) !== 0;
  const U = (bits & FLAME_UP) !== 0;
  const D = (bits & FLAME_DOWN) !== 0;
  if (center) {
    if (L) segs.push([c, c, -2, c]);
    if (R) segs.push([c, c, 18, c]);
    if (U) segs.push([c, c, c, -2]);
    if (D) segs.push([c, c, c, 18]);
    segs.push([c, c, c, c]);
  } else {
    const tip = 15.5 - half;
    if (L && R) segs.push([-2, c, 18, c]);
    else if (L) segs.push([-2, c, tip, c]);
    else if (R) segs.push([18, c, 16 - tip, c]);
    if (U && D) segs.push([c, -2, c, 18]);
    else if (U) segs.push([c, -2, c, tip]);
    else if (D) segs.push([c, 18, c, 16 - tip]);
  }
  (retro ? RETRO_FLAME_LAYERS : FLAME_LAYERS).forEach((color, li) => {
    const r = half - li * 1.45 + (center ? 0.8 : 0);
    if (r <= 0.3) return;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        if (segs.some((s) => segDist(px, py, s) <= r)) p.px(x, y, color);
      }
    }
  });
  return p.canvas;
}

/** Smoke/dust puff used when blocks and enemies disappear (4 frames). */
export function drawPuff(frame: number): HTMLCanvasElement {
  const p = new PixelCanvas(16, 16);
  const blobs: [number, number, number][] = [
    [5, 6, 3],
    [10, 6, 3],
    [7.5, 10, 3.5],
    [4, 10, 2.5],
    [11, 10, 2.5],
  ];
  const grow = [0.6, 1, 1.15, 0.8][frame];
  const shade = ['#ffffff', '#e8e8f0', '#b8b8c8', '#8888a0'][frame];
  for (const [x, y, r] of blobs) {
    const spread = 1 + frame * 0.35;
    const bx = 7.5 + (x - 7.5) * spread;
    const by = 8 + (y - 8) * spread;
    p.circle(bx, by, r * grow + 0.8, '#404050');
    p.circle(bx, by, r * grow, shade);
  }
  return p.canvas;
}
