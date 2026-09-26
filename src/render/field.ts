import type { Gfx } from '../engine/gfx';
import type { Bomber } from '../game/core/bomber';
import { Cell, TILE } from '../game/core/types';
import type { World } from '../game/core/world';
import { BURN_FRAME_COUNT } from '../gfx/tiles';
import { sprites, tileSet, type Sprites } from '../gfx/sprites';

/** Something drawn in the y-sorted actor pass. */
export interface Actor {
  /** Sort key: the actor's foot line in world px. */
  y: number;
  draw(g: Gfx, ox: number, oy: number): void;
}

export interface View {
  /** Screen position of world pixel (0,0). */
  ox: number;
  oy: number;
  /** Visible world rectangle (for culling). */
  x0: number;
  x1: number;
}

const BOMB_PULSE = [0, 1, 2, 1];

export function flamePhase(timer: number, total: number): number {
  const p = 1 - timer / total;
  if (p < 0.08) return 0;
  if (p < 0.16) return 1;
  if (p < 0.72) return 2;
  if (p < 0.86) return 3;
  return 4;
}

export class FieldRenderer {
  readonly s: Sprites = sprites();
  /** A picture painted on the floor, covering tiles from (tx, ty). */
  decal: { img: HTMLCanvasElement; tx: number; ty: number } | null = null;

  constructor(
    public theme: string,
    public retro = false,
  ) {}

  /** The floor tile, with its part of the floor picture if there is one. */
  floorAt(g: Gfx, img: CanvasImageSource, tx: number, ty: number, x: number, y: number): void {
    g.image(img, x, y);
    const d = this.decal;
    if (!d) return;
    const sx = (tx - d.tx) * TILE;
    const sy = (ty - d.ty) * TILE;
    if (sx < 0 || sy < 0 || sx >= d.img.width || sy >= d.img.height) return;
    g.ctx.drawImage(d.img, sx, sy, TILE, TILE, x, y, TILE, TILE);
  }

  /** Floor, blocks, burning blocks. */
  drawTiles(g: Gfx, world: World, v: View, skipTopRow = false): void {
    const ts = tileSet(this.theme);
    const grid = world.grid;
    const tx0 = Math.max(0, Math.floor(v.x0 / TILE));
    const tx1 = Math.min(grid.w - 1, Math.floor((v.x1 - 1) / TILE));
    for (let ty = skipTopRow ? 1 : 0; ty < grid.h; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const x = v.ox + tx * TILE;
        const y = v.oy + ty * TILE;
        const c = grid.get(tx, ty);
        if (c === Cell.Hard) {
          const border = tx === 0 || ty === 0 || tx === grid.w - 1 || ty === grid.h - 1;
          // Round pillars stand on the floor.
          if (!border) this.floorAt(g, ts.floor, tx, ty, x, y);
          g.image(border ? ts.walls[(tx * 7 + ty * 3) % ts.walls.length] : ts.hard, x, y);
          continue;
        }
        const above = grid.get(tx, ty - 1);
        this.floorAt(g, above === Cell.Hard || above === Cell.Soft ? ts.floorShadow : ts.floor, tx, ty, x, y);
        if (c === Cell.Soft) this.drawSoft(g, world, tx, ty, x, y);
      }
    }
  }

  /** A soft block (or one burning away) on a tile. */
  drawSoft(g: Gfx, world: World, tx: number, ty: number, x: number, y: number): void {
    const ts = tileSet(this.theme);
    const bt = world.burnTimer[world.idx(tx, ty)];
    if (bt > 0) {
      const f = Math.min(BURN_FRAME_COUNT - 1, Math.floor((1 - bt / world.rules.burnTicks) * BURN_FRAME_COUNT));
      g.image(ts.burn[f], x, y);
    } else {
      g.image(ts.soft, x, y);
    }
  }

  drawItems(g: Gfx, world: World, v: View, frame: number, retro = false): void {
    const set = retro ? this.s.retroItems : this.s.items;
    const flash = retro ? this.s.retroItemsFlash : this.s.itemsFlash;
    const grid = world.grid;
    for (let i = 0; i < world.items.length; i++) {
      const it = world.items[i];
      if (!it || it.hidden) continue;
      const tx = i % grid.w;
      const ty = Math.floor(i / grid.w);
      if ((tx + 1) * TILE < v.x0 || tx * TILE > v.x1) continue;
      const x = v.ox + tx * TILE;
      const y = v.oy + ty * TILE;
      if (it.burning > 0) {
        const f = Math.min(3, Math.floor((20 - it.burning) / 5));
        g.image(this.s.puff[f], x, y);
        continue;
      }
      const img = Math.floor(frame / 8) % 2 ? flash[it.kind] : set[it.kind];
      if (img) g.image(img, x, y);
    }
  }

  drawFlames(g: Gfx, world: World, v: View): void {
    const grid = world.grid;
    for (let i = 0; i < world.flameTimer.length; i++) {
      const t = world.flameTimer[i];
      if (t <= 0) continue;
      const tx = i % grid.w;
      const ty = Math.floor(i / grid.w);
      const ph = flamePhase(t, world.rules.flameTicks);
      g.image((this.retro ? this.s.retroFlame : this.s.flame)[ph][world.flameBits[i]], v.ox + tx * TILE, v.oy + ty * TILE);
    }
  }

  /** Bombs on the ground (flying bombs are drawn as actors). */
  bombActors(world: World, actors: Actor[]): void {
    for (const b of world.bombs) {
      if (b.held) continue;
      const frames = this.retro ? this.s.retroBomb : b.remote ? this.s.remoteBomb : this.s.bomb;
      const img = frames[BOMB_PULSE[Math.floor(b.age / 8) % 4]];
      if (b.flight) {
        const f = b.flight;
        const k = f.t / f.dur;
        const lift = Math.sin(k * Math.PI) * f.height;
        actors.push({
          y: b.y + 1000,
          draw: (g, ox, oy) => {
            g.image(this.s.shadow, ox + b.x - 7, oy + b.y + 4);
            g.image(img, ox + b.x - 8, oy + b.y - 8 - lift);
          },
        });
        continue;
      }
      actors.push({ y: b.y - 1, draw: (g, ox, oy) => g.image(img, ox + b.x - 8, oy + b.y - 8) });
    }
  }

  bomberActor(b: Bomber, colorIndex: number, frame: number): Actor | null {
    const sp = this.retro ? this.s.retroBomber : this.s.bombers[colorIndex % this.s.bombers.length];
    if (!b.alive) {
      const f = Math.floor(b.deathTimer / 8);
      if (b.deathTimer < 0 || f >= sp.death.length) return null;
      return { y: b.y, draw: (g, ox, oy) => g.image(sp.death[f], ox + b.x - 8, oy + b.y - 16) };
    }
    if (b.invincible > 0 && b.invincible < 100000 && Math.floor(frame / 3) % 2 === 0) {
      // blink while temporarily invincible
      return { y: b.y, draw: (g, ox, oy) => g.image(sp.flash[b.facing], ox + b.x - 8, oy + b.y - 16) };
    }
    const cycle = sp.walk[b.facing];
    const img = b.moving ? cycle[Math.floor(b.walkTick / 7) % 4] : cycle[0];
    return {
      y: b.y,
      draw: (g, ox, oy) => {
        g.image(img, ox + b.x - 8, oy + b.y - 16);
      },
    };
  }

  /** Sort and draw actors. */
  drawActors(g: Gfx, actors: Actor[], v: View): void {
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw(g, v.ox, v.oy);
  }
}
