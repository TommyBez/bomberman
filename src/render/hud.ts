import type { Gfx, Sprite } from '../engine/gfx';
import { PixelCanvas } from '../gfx/pixel';
import { TILE } from '../game/core/types';
import { BOMBER_COLORS, tileSet, type BomberColors } from '../gfx/sprites';
import type { Theme } from '../gfx/tiles';

/** Small 9×9 icons used on the HUD strip. */
export interface HudIcons {
  heads: Sprite[];
  crying: Sprite[];
  gold: Sprite;
  bomb: Sprite;
  fire: Sprite;
  clock: Sprite;
  trophy: Sprite;
}

/** A bomber's small head icon in the given colours. */
export function headSprite(c: BomberColors, crying = false): Sprite {
  const p = new PixelCanvas(10, 10);
  p.px(4, 0, '#000000');
  p.px(5, 0, '#000000');
  p.px(4, 1, c.accent[1]);
  p.px(5, 1, c.accent[0]);
  p.circle(5, 5.6, 4.6, '#000000');
  p.circle(5, 5.6, 3.8, c.helmet[1]);
  p.px(2, 4, c.helmet[0]);
  p.rect(2, 5, 6, 3, '#000000');
  p.rect(3, 5, 4, 2, '#ffcf9c');
  if (crying) {
    p.px(3, 5, '#000000');
    p.px(6, 5, '#000000');
    p.px(3, 7, '#40a0ff');
    p.px(6, 7, '#40a0ff');
  } else {
    p.px(3, 5, '#1c1c3c');
    p.px(6, 5, '#1c1c3c');
    p.px(3, 6, '#1c1c3c');
    p.px(6, 6, '#1c1c3c');
  }
  return p.canvas;
}

let icons: HudIcons | null = null;

export function hudIcons(): HudIcons {
  if (icons) return icons;
  const bomb = new PixelCanvas(10, 10);
  bomb.circle(4.5, 5.5, 4.2, '#000000');
  bomb.circle(4.5, 5.5, 3.4, '#2c2c58');
  bomb.px(3, 4, '#9aa0e0');
  bomb.rect(6, 1, 2, 2, '#000000');
  bomb.px(8, 0, '#ffd040');
  const fire = new PixelCanvas(10, 10);
  fire.ellipse(5, 6, 4.2, 3.8, '#000000');
  fire.ellipse(5, 6, 3.4, 3.1, '#e02000');
  fire.rect(4, 1, 2, 4, '#e02000');
  fire.px(4, 0, '#000000');
  fire.ellipse(5, 6.5, 2.2, 2.2, '#ff9000');
  fire.ellipse(5, 7, 1.2, 1.2, '#ffe040');
  const clock = new PixelCanvas(10, 10);
  clock.circle(4.5, 5, 4.4, '#000000');
  clock.circle(4.5, 5, 3.6, '#ffffff');
  clock.vline(4, 2, 5, '#000000');
  clock.hline(4, 6, 5, '#000000');
  clock.px(4, 0, '#000000');
  const trophy = new PixelCanvas(10, 10);
  trophy.rect(1, 0, 8, 1, '#000000');
  trophy.rect(2, 1, 6, 4, '#ffd040');
  trophy.rect(2, 1, 2, 3, '#fff0a0');
  trophy.px(1, 2, '#ffd040');
  trophy.px(8, 2, '#ffd040');
  trophy.rect(4, 5, 2, 2, '#c09000');
  trophy.rect(2, 7, 6, 2, '#c09000');
  trophy.rect(2, 9, 6, 1, '#000000');
  const gold: BomberColors = { ...BOMBER_COLORS[0], helmet: ['#fff4b0', '#ffd040', '#c09000'] };
  icons = {
    heads: BOMBER_COLORS.map((c) => headSprite(c)),
    crying: BOMBER_COLORS.map((c) => headSprite(c, true)),
    gold: headSprite(gold),
    bomb: bomb.canvas,
    fire: fire.canvas,
    clock: clock.canvas,
    trophy: trophy.canvas,
  };
  return icons;
}

/**
 * The tall top wall that carries the HUD: two rows of the stage's own wall blocks, lined
 * up with the columns of a field whose left edge is at `ox`, between `x0` and `x1`.
 */
export function hudStrip(g: Gfx, theme: Theme, h = 32, ox = 0, x0 = 0, x1 = g.width): void {
  const walls = tileSet(theme.name).walls;
  const n = walls.length;
  const first = Math.floor((x0 - ox) / TILE);
  const last = Math.ceil((x1 - ox) / TILE);
  g.ctx.save();
  g.ctx.beginPath();
  g.ctx.rect(x0, 0, x1 - x0, h);
  g.ctx.clip();
  for (let row = 0; row * TILE < h; row++) {
    const y = h - TILE * (row + 1);
    for (let tx = first; tx < last; tx++) g.image(walls[(((tx * 7 + row * 3) % n) + n) % n], ox + tx * TILE, y);
    // Rows above the field's own top row are the wall's top, catching more light.
    if (row > 0) {
      g.ctx.globalAlpha = 0.16;
      g.rect(x0, y, x1 - x0, TILE, '#ffffff');
      g.ctx.globalAlpha = 1;
    }
  }
  g.ctx.restore();
}

/** The golden HUD digits of the original (yellow fading to orange, black outline). */
export const HUD_TEXT = { gradient: ['#fff070', '#ff9800'] as [string, string], outline: '#000000' };
/** The same text while the clock is running out. */
export const HUD_HURRY = { gradient: ['#ffb0a0', '#e82000'] as [string, string], outline: '#000000' };
/** A knocked-out player's greyed win count. */
export const HUD_DIM = { gradient: ['#c0c0cc', '#707080'] as [string, string], outline: '#000000' };

export function clockText(ticks: number): string {
  const secs = Math.max(0, Math.ceil(ticks / 60));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}
