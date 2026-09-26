import type { Gfx } from '../engine/gfx';
import type { BattleWorld } from '../game/battle/battleWorld';
import type { Bomber } from '../game/core/bomber';
import { Cell, DX, DY, TILE, toTile } from '../game/core/types';
import { characterSprites, gimmickSprites } from '../gfx/battleSprites';
import { bendTile } from '../gfx/battleArt';
import { sprites } from '../gfx/sprites';
import { FieldRenderer, type Actor, type View } from './field';

const bendCache = new Map<string, HTMLCanvasElement>();

/** Draws a battle arena: tiles, gimmicks, bombs, flames, bombers, carts, pressure blocks. */
export class BattleRenderer {
  readonly field: FieldRenderer;

  constructor(private readonly w: BattleWorld) {
    this.field = new FieldRenderer(w.arena.theme);
  }

  draw(g: Gfx, v: View, frame: number, hudStripDrawn: boolean): void {
    const w = this.w;
    const gs = gimmickSprites();
    this.field.drawTiles(g, w, v, hudStripDrawn);
    this.drawFloorGimmicks(g, v, frame);
    this.field.drawItems(g, w, v, frame);
    this.field.drawFlames(g, w, v);
    // Bombs (hidden land mines are invisible to everybody).
    const actors: Actor[] = this.bombActorsVisible();
    for (const b of w.bombers) {
      const a = this.bomberActor(b, frame);
      if (a) actors.push(a);
    }
    for (const t of w.gim.trolleys) {
      const img = gs.trolley[t.dir][Math.floor(frame / 6) % 2];
      actors.push({ y: t.y - 2, draw: (gg, ox, oy) => (t.flash % 4 < 2 ? gg.image(img, ox + t.x - 10, oy + t.y - 10) : undefined) });
    }
    const r = w.gim.robot;
    if (r && !r.gone) {
      const img = r.stomp > 20 ? gs.robotStomp[Math.min(2, Math.floor((50 - r.stomp) / 10))] : r.stomp > 0 ? gs.robotStomp[0] : gs.robot[Math.floor(frame / 12) % 3];
      const rise = r.leaving > 0 ? r.leaving * 3 : 0;
      actors.push({ y: r.y + 8, draw: (gg, ox, oy) => gg.image(img, ox + r.x - 20, oy + r.y - 40 - rise) });
    }
    for (const f of w.gim.fish) {
      const k = f.t / 50;
      const lift = Math.sin(k * Math.PI) * 18;
      actors.push({ y: f.ty * TILE + 20, draw: (gg, ox, oy) => gg.image(gs.fish[Math.floor(f.t / 6) % 2], ox + f.tx * TILE, oy + f.ty * TILE - lift) });
    }
    this.field.drawActors(g, actors, v);
    this.drawCovers(g, v);
    this.drawPressure(g, v);
  }

  private bombActorsVisible(): Actor[] {
    const w = this.w;
    const out: Actor[] = [];
    const s = sprites();
    for (const b of w.bombs) {
      if (b.held || b.hidden) continue;
      const frames = b.remote ? s.remoteBomb : s.bomb;
      const pulse = [0, 1, 2, 1][Math.floor(b.age / (b.square ? 4 : 8)) % 4];
      const img = frames[pulse];
      const scale = b.square === 3 ? 1.6 : b.square === 2 ? 1.3 : 1;
      if (b.flight) {
        const f = b.flight;
        const k = f.t / f.dur;
        const lift = Math.sin(k * Math.PI) * f.height;
        out.push({
          y: b.y + 1000,
          draw: (gg, ox, oy) => {
            gg.image(s.shadow, ox + b.x - 7, oy + b.y + 4);
            gg.image(img, ox + b.x - 8, oy + b.y - 8 - lift);
          },
        });
        continue;
      }
      out.push({
        y: b.y - 1,
        draw: (gg, ox, oy) => {
          if (scale === 1) gg.image(img, ox + b.x - 8, oy + b.y - 8);
          else {
            const sz = Math.round(16 * scale);
            gg.ctx.drawImage(img, Math.round(ox + b.x - sz / 2), Math.round(oy + b.y + 8 - sz), sz, sz);
            if (Math.floor(b.age / 4) % 2) gg.text(b.square === 3 ? 'U' : 'S', ox + b.x, oy + b.y - 3, { align: 'center', color: '#ff4040', outline: '#000000' });
          }
        },
      });
    }
    return out;
  }

  private bomberActor(b: Bomber, frame: number): Actor | null {
    const w = this.w;
    const sp = characterSprites(b.character, b.id, b.gold);
    const gs = gimmickSprites();
    if (!b.alive) {
      const f = Math.floor(b.deathTimer / 8);
      if (b.deathTimer < 0 || f >= sp.death.length) return null;
      return { y: b.y, draw: (g, ox, oy) => g.image(sp.death[f], ox + b.x - 8, oy + b.y - 16) };
    }
    // Hidden inside a pipe / hut / foliage: nothing to draw (covers are drawn on top anyway).
    const lift = b.jump ? Math.sin((b.jump.t / b.jump.dur) * Math.PI) * b.jump.height : 0;
    const blink = b.invincible > 0 && b.invincible < 100000 && Math.floor(frame / 3) % 2 === 0;
    const cycle = sp.walk[b.facing];
    let img = b.moving ? cycle[Math.floor(b.walkTick / 7) % 4] : cycle[0];
    if (w.result && b.frozen && w.result.winner === b.id) img = sp.win[Math.floor(frame / 12) % 2];
    if (blink) img = sp.flash[b.facing];
    const partner = b.partner;
    const riderUp = partner ? 7 : 0;
    const sick = b.curse && Math.floor(frame / 6) % 3 === 0;
    return {
      y: b.y,
      draw: (g, ox, oy) => {
        const x = ox + b.x;
        const y = oy + b.y;
        if (lift > 0) g.image(sprites().shadow, x - 7, y + 4);
        if (partner) {
          const pf = gs.partners[partner]?.[b.facing === 'left' ? 'left' : 'right'];
          if (pf) g.image(pf[b.moving ? Math.floor(b.walkTick / 6) % 2 : 0], x - 10, y - 8 - lift);
        }
        if (sick) {
          g.ctx.globalAlpha = 0.6;
          g.image(sp.flash[b.facing], x - 8, y - 16 - lift - riderUp);
          g.ctx.globalAlpha = 1;
        } else g.image(img, x - 8, y - 16 - lift - riderUp);
        if (b.carrying || b.carryingBomber) {
          const bomb = sprites().bomb[1];
          if (b.carrying) g.image(bomb, x - 8, y - 30 - riderUp);
        }
        if (b.stunned > 0 && lift === 0) {
          for (let k = 0; k < 3; k++) {
            const a = frame / 8 + (k * Math.PI * 2) / 3;
            g.rect(x + Math.cos(a) * 7, y - 18 + Math.sin(a) * 2 - riderUp, 2, 2, '#ffe040');
          }
        }
        if (b.heart) g.rect(x + 5, y - 17 - riderUp, 2, 2, '#ff4060');
      },
    };
  }

  private drawFloorGimmicks(g: Gfx, v: View, frame: number): void {
    const w = this.w;
    const gs = gimmickSprites();
    const gim = w.gim;
    for (let i = 0; i < gim.features.length; i++) {
      const f = gim.features[i];
      if (!f) continue;
      const tx = i % w.grid.w;
      const ty = Math.floor(i / w.grid.w);
      const x = v.ox + tx * TILE;
      const y = v.oy + ty * TILE;
      switch (f.kind) {
        case 'conveyor': {
          const d = gim.beltReverse ? ({ up: 'down', down: 'up', left: 'right', right: 'left' } as const)[f.dir] : f.dir;
          g.image(gs.belt[d][Math.floor((frame * gim.beltSpeed) / 3) % 8], x, y);
          break;
        }
        case 'arrow':
          g.image(f.rotating ? gs.arrowSpin[f.dir] : gs.arrow[f.dir], x, y);
          break;
        case 'warp':
          g.image(gs.warp[Math.floor(frame / 4) % 8], x, y);
          break;
        case 'trampoline': {
          const busy = w.bombers.some((b) => b.alive && b.airborne > 50 && b.jump && Math.abs(b.jump.fx - (tx * TILE + 8)) < 2 && Math.abs(b.jump.fy - (ty * TILE + 8)) < 2);
          g.image(gs.trampoline[busy ? 2 : 0], x, y);
          break;
        }
        case 'seesaw': {
          const s = gim.seesaws[f.id];
          if (!s) break;
          const down = (s.down === 0 && f.end === 0) || (s.down === 1 && f.end === 1);
          g.image(gs.seesaw[f.end][down ? 1 : 0], x, y);
          break;
        }
        case 'sign':
          g.image(gs.sign[f.speed], x, y);
          break;
        case 'tyre':
          if (w.grid.get(tx, ty) === Cell.Soft && w.burnTimer[i] === 0) g.image(gs.tyre, x, y);
          break;
        case 'rail': {
          let conn = 0;
          const isRail = (xx: number, yy: number): boolean => gim.at(xx, yy)?.kind === 'rail';
          if (isRail(tx, ty - 1)) conn |= 1;
          if (isRail(tx + 1, ty)) conn |= 2;
          if (isRail(tx, ty + 1)) conn |= 4;
          if (isRail(tx - 1, ty)) conn |= 8;
          g.image(f.trolleyWarp ? gs.railWarp[conn] : gs.rail[conn], x, y);
          break;
        }
        case 'switch':
          g.image(gim.switchOn ? gs.switchOn : gs.switchOff, x, y);
          break;
        case 'ice':
          g.image(gs.ice[Math.min(1, f.cracks)], x, y);
          break;
        case 'hole':
          g.image(gs.hole[Math.floor(frame / 10) % 4], x, y);
          break;
        case 'water':
          g.image(gs.water[(Math.floor(frame / 8) + tx + ty) % 8], x, y);
          break;
        case 'bridge': {
          const horiz = gim.at(tx - 1, ty)?.kind === 'bridge' || gim.at(tx + 1, ty)?.kind === 'bridge';
          g.image(horiz ? gs.bridgeH : gs.bridgeV, x, y);
          break;
        }
        case 'portal':
          g.image(w.arena.gimmick === 'flowers' ? gs.flower : gs.pipeMouth, x, y);
          break;
        case 'bend': {
          const key = JSON.stringify(f.turn);
          let img = bendCache.get(key);
          if (!img) {
            img = bendTile(f.turn);
            bendCache.set(key, img);
          }
          g.image(img, x, y);
          break;
        }
        case 'door':
          g.image(gs.door[f.open][f.turn > 0 ? 1 : 0], x, y);
          break;
        default:
          break;
      }
    }
  }

  /** Pipes, huts and foliage hide whatever is beneath them. */
  private drawCovers(g: Gfx, v: View): void {
    const w = this.w;
    const gs = gimmickSprites();
    const gim = w.gim;
    for (let i = 0; i < gim.features.length; i++) {
      const f = gim.features[i];
      if (!f || f.kind !== 'cover') continue;
      const tx = i % w.grid.w;
      const ty = Math.floor(i / w.grid.w);
      const x = v.ox + tx * TILE;
      const y = v.oy + ty * TILE;
      if (f.style === 'pipe') {
        const horiz = gim.at(tx - 1, ty)?.kind === 'cover' || gim.at(tx + 1, ty)?.kind === 'cover';
        g.image(horiz ? gs.pipeH : gs.pipeV, x, y);
      } else if (f.style === 'hut') g.image(gs.hut, x, y);
      else g.image(gs.foliage[(tx + ty) % 3], x, y);
    }
  }

  private drawPressure(g: Gfx, v: View): void {
    const gs = gimmickSprites();
    for (const f of this.w.falling) {
      const drop = f.t * 10;
      const x = v.ox + f.tx * TILE;
      const y = v.oy + f.ty * TILE;
      g.ctx.globalAlpha = 0.35;
      g.rect(x + 2, y + 10, 12, 5, '#000000');
      g.ctx.globalAlpha = 1;
      g.image(gs.pressure, x, y - drop);
    }
  }

  /** Bomber carts ride the arena edge (drawn after the HUD so the top track shows). */
  drawCarts(g: Gfx, v: View, frame: number): void {
    const w = this.w;
    const gs = gimmickSprites();
    for (const c of w.carts) {
      const b = w.bomber(c.who);
      if (!b || b.alive) continue;
      const t = w.cartTile(c);
      const x = v.ox + t.x;
      // The top track runs along the lower edge of the tall top wall, below the HUD text.
      const y = v.oy + t.y + (t.into === 'down' ? 6 : 0);
      const head = characterSprites(b.character, b.id, b.gold).walk.down[0];
      g.ctx.drawImage(head, 0, 3, 16, 13, Math.round(x - 8), Math.round(y - 14), 16, 13);
      g.image(gs.carts[b.id % gs.carts.length], x - 9, y - 4);
      if (c.charge > 0) {
        const dist = 1 + Math.floor(c.charge / 15);
        const tx = t.tx + DX[t.into] * dist;
        const ty = t.ty + DY[t.into] * dist;
        if (Math.floor(frame / 4) % 2) g.frame(v.ox + tx * TILE, v.oy + ty * TILE, 16, 16, '#ff4040');
      }
    }
    void toTile;
    void DY;
  }
}
