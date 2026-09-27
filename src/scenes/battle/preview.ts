import { Gfx } from '../../engine/gfx';
import type { ArenaDef } from '../../game/battle/arenas';
import { BattleWorld } from '../../game/battle/battleWorld';
import { defaultConfig } from '../../game/battle/config';
import { TILE } from '../../game/core/types';
import { BattleRenderer } from '../../render/battleField';

const snapshots = new Map<string, HTMLCanvasElement>();

/**
 * A picture of a stage for the stage-select cards: the stage as it looks in play, drawn by
 * the game's own renderer with nobody on it and only its fixed blocks, at half size.
 */
export function stageSnapshot(a: ArenaDef): HTMLCanvasElement {
  const key = `${a.id}${a.alternate ? 'x' : ''}`;
  const cached = snapshots.get(key);
  if (cached) return cached;
  const cfg = defaultConfig();
  cfg.level = a.level;
  cfg.players.forEach((p) => (p.type = 'off'));
  const world = new BattleWorld({ cfg, arena: { ...a, density: 0 }, seed: 1 });
  const full = document.createElement('canvas');
  full.width = world.grid.w * TILE;
  full.height = world.grid.h * TILE;
  const g = new Gfx(full.getContext('2d')!, full.width, full.height);
  new BattleRenderer(world).draw(g, { ox: 0, oy: 0, x0: 0, x1: full.width }, 0, false);
  const c = document.createElement('canvas');
  c.width = full.width / 2;
  c.height = full.height / 2;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(full, 0, 0, c.width, c.height);
  snapshots.set(key, c);
  return c;
}

/**
 * The character-select display case: a shallow box seen from the front, with a pale ceiling
 * and floor, green back and side walls and a hedge along the back.
 */
export function drawDisplayCase(g: Gfx, x: number, y: number, w: number, h: number): void {
  const side = 10;
  g.rect(x, y, w, h, '#50bc60');
  // Back wall with faint stripes, and the hedge at its foot.
  const wallTop = y + 10;
  const wallBottom = y + h - 18;
  g.rect(x + side, wallTop, w - side * 2, wallBottom - wallTop, '#2e9a3e');
  for (let yy = wallTop + 2; yy < wallBottom - 2; yy += 4) g.rect(x + side, yy, w - side * 2, 1, '#34a646');
  g.rect(x + side, wallBottom - 3, w - side * 2, 3, '#1c6a28');
  for (let xx = x + side + 2; xx < x + w - side - 2; xx += 5) g.rect(xx, wallBottom - 2, 1, 1, '#f0d848');
  // Ceiling, narrowing into the back.
  g.rect(x, y, w, 6, '#eef4fa');
  for (let r = 0; r < 4; r++) g.rect(x + Math.round(r * 2.5), y + 6 + r, w - Math.round(r * 5), 1, r === 3 ? '#b8c8d8' : '#e0eaf4');
  // Floor, widening towards the front.
  for (let r = 0; r < 6; r++) {
    const inset = Math.round(side - (r * side) / 6);
    g.rect(x + inset, wallBottom + r, w - inset * 2, 1, r === 0 ? '#b0c4d8' : '#d4e4f2');
  }
  g.rect(x, y + h - 12, w, 12, '#dceaf6');
  for (let xx = x + 3; xx < x + w; xx += 8) g.rect(xx, y + h - 6, 4, 1, '#b8cce0');
  // Edges where the side walls meet the ceiling, back and floor.
  for (let r = 0; r < 4; r++) {
    g.rect(x + Math.round(r * 2.5), y + 6 + r, 1, 1, '#ffffff');
    g.rect(x + w - 1 - Math.round(r * 2.5), y + 6 + r, 1, 1, '#ffffff');
  }
  g.rect(x + side, wallTop, 1, wallBottom - wallTop, '#88d890');
  g.rect(x + w - side - 1, wallTop, 1, wallBottom - wallTop, '#88d890');
  g.frame(x - 1, y - 1, w + 2, h + 2, '#7898c0');
  g.rect(x - 1, y - 1, w + 2, 1, '#ffffff');
}
