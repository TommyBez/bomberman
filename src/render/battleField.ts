import { mix, type Gfx } from '../engine/gfx';
import type { BattleWorld } from '../game/battle/battleWorld';
import type { Bomber } from '../game/core/bomber';
import { Cell, DX, DY, TILE, toTile, type Dir } from '../game/core/types';
import { characterSprites, gimmickSprites } from '../gfx/battleSprites';
import { bendSides, bendTile, pipeSprites, propSprite } from '../gfx/battleArt';
import { hardTile, THEMES } from '../gfx/tiles';
import { sprites, tileSet } from '../gfx/sprites';
import { ROBOT_FEET, ROBOT_STEP, type PropStyle } from '../game/battle/gimmicks';
import { FieldRenderer, type Actor, type View } from './field';

const bendCache = new Map<string, HTMLCanvasElement>();
const propCache = new Map<string, HTMLCanvasElement>();

function propImage(style: PropStyle, theme: string): HTMLCanvasElement {
  const key = `${style}:${theme}`;
  let img = propCache.get(key);
  if (!img) {
    const t = THEMES[theme];
    // Incoming!'s gold boulders are the stage's own pillars, gilded.
    const hard = style === 'gold' && t ? hardTile({ ...t, hard: '#ffc830' }) : tileSet(theme).hard;
    img = propSprite(style, hard);
    propCache.set(key, img);
  }
  return img;
}

/** Draws a battle arena: tiles, gimmicks, bombs, flames, bombers, carts, pressure blocks. */
export class BattleRenderer {
  readonly field: FieldRenderer;

  constructor(private readonly w: BattleWorld) {
    this.field = new FieldRenderer(w.arena.theme);
    // Super Power's big emblem, painted across the middle of the floor.
    if (w.arena.decal === 'emblem') this.field.decal = { img: emblemDecal(), tx: 4, ty: 3 };
  }

  draw(g: Gfx, v: View, frame: number, hudStripDrawn: boolean): void {
    const w = this.w;
    const gs = gimmickSprites();
    this.field.drawTiles(g, w, v, hudStripDrawn);
    this.drawLowerFloor(g, v);
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
    for (const f of w.gim.fish) {
      const k = f.t / 50;
      const lift = Math.sin(k * Math.PI) * 18;
      actors.push({ y: f.ty * TILE + 20, draw: (gg, ox, oy) => gg.image(gs.fish[Math.floor(f.t / 6) % 2], ox + f.tx * TILE, oy + f.ty * TILE - lift) });
    }
    // A stocked egg waddles behind its rider.
    for (const b of w.bombers) {
      if (!b.alive || b.eggs <= 0 || !b.partner || !b.trail.length) continue;
      const [ex, ey] = b.trail[0];
      actors.push({ y: ey - 0.5, draw: (gg, ox, oy) => drawEgg(gg, ox + ex, oy + ey, frame) });
    }
    for (const s of w.shots) actors.push({ y: s.y + 4, draw: (gg, ox, oy) => drawShot(gg, ox + s.x, oy + s.y, s.kind, s.dir, frame) });
    // Scenery standing in for pillars (palms, bushes, trunks) sorts with the bombers.
    w.gim.features.forEach((f, i) => {
      if (!f || f.kind !== 'prop') return;
      const px = (i % w.grid.w) * TILE;
      const py = Math.floor(i / w.grid.w) * TILE;
      const img = propImage(f.style, w.arena.theme);
      actors.push({ y: py + TILE - 1, draw: (gg, ox, oy) => gg.image(img, ox + px, oy + py - 8) });
    });
    this.field.drawActors(g, actors, v);
    this.drawCovers(g, v);
    this.drawRobot(g, v, frame);
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
        if (b.liftedBlock) g.image(tileSet(w.arena.theme).soft, x - 8, y - 32 - riderUp - lift);
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

  /** Two-floor stages: the lower rows are cloud tops. */
  private drawLowerFloor(g: Gfx, v: View): void {
    const w = this.w;
    const rows = w.arena.lowerFloor;
    if (!rows) return;
    const clouds = gimmickSprites().cloud;
    for (let ty = rows[0]; ty <= rows[1]; ty++) {
      for (let tx = 1; tx < w.grid.w - 1; tx++) {
        if (w.grid.get(tx, ty) !== Cell.Floor) continue;
        g.image(clouds[(tx * 3 + ty * 5) % clouds.length], v.ox + tx * TILE, v.oy + ty * TILE);
      }
    }
  }

  /** Plain floor on a tile (under scenery that replaces a pillar). */
  private floor(g: Gfx, tx: number, ty: number, x: number, y: number): void {
    const ts = tileSet(this.w.arena.theme);
    const above = this.w.grid.get(tx, ty - 1);
    this.field.floorAt(g, above === Cell.Hard || above === Cell.Soft ? ts.floorShadow : ts.floor, tx, ty, x, y);
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
          g.image(gs.belt[gim.beltDir(f)][Math.floor((frame * gim.beltSpeed) / 3) % 8], x, y);
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
          if (s.pivot) {
            // A three-tile plank, drawn whole from its pivot (level for a moment as it tips).
            if (f.end === 2) g.image(gs.seesawPlank[s.anim > 6 ? 1 : s.down === 0 ? 0 : 2], x - TILE, y);
            break;
          }
          const down = (s.down === 0 && f.end === 0) || (s.down === 1 && f.end === 1);
          g.image(gs.seesaw[f.end === 1 ? 1 : 0][down ? 1 : 0], x, y);
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
          // Freshly relaid rails blink for a moment.
          if (gim.railFlash > 0 && Math.floor(frame / 4) % 2 === 0) break;
          g.image(f.trolleyWarp ? gs.railWarp[conn] : gs.rail[conn], x, y);
          break;
        }
        case 'switch': {
          const on = gim.switchState(f.mode);
          if (f.mode === 'speed') g.image(on ? gs.speedSwitchOn : gs.speedSwitchOff, x, y);
          else g.image(on ? gs.switchOn : gs.switchOff, x, y);
          break;
        }
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
          this.floor(g, tx, ty, x, y);
          g.image(pipeSprites(THEMES[w.arena.theme]?.pipe).mouth, x, y);
          break;
        case 'flower':
          this.floor(g, tx, ty, x, y);
          g.image(gs.flower[f.face][f.turn > 0 ? 1 : 0], x, y);
          break;
        case 'bend': {
          // A run of pipe: its open ends that meet no more pipe are mouths.
          const mouths = bendSides(f.turn).filter((d) => gim.at(tx + DX[d], ty + DY[d])?.kind !== 'bend');
          const key = `${JSON.stringify(f.turn)}|${mouths.join()}`;
          let img = bendCache.get(key);
          if (!img) {
            img = bendTile(f.turn, mouths);
            bendCache.set(key, img);
          }
          this.floor(g, tx, ty, x, y);
          g.image(img, x, y);
          break;
        }
        case 'prop':
          // Drawn standing up with the actors; clear the pillar drawn here.
          this.floor(g, tx, ty, x, y);
          break;
        default:
          break;
      }
      // Blocks lying on belts, rails and bridges sit on top of them.
      if (w.grid.get(tx, ty) === Cell.Soft && f.kind !== 'tyre') this.field.drawSoft(g, w, tx, ty, x, y);
    }
  }

  /** Pipes, huts and foliage hide whatever is beneath them. */
  private drawCovers(g: Gfx, v: View): void {
    const w = this.w;
    const gs = gimmickSprites();
    const gim = w.gim;
    const same = (tx: number, ty: number, style: string): boolean => {
      const f = gim.at(tx, ty);
      return !!f && f.kind === 'cover' && f.style === style;
    };
    // Leafy tiles in a plus round a centre are one tree: a single canopy covers them.
    const canopied = new Set<number>();
    const trees: [number, number][] = [];
    for (let i = 0; i < gim.features.length; i++) {
      const tx = i % w.grid.w;
      const ty = Math.floor(i / w.grid.w);
      if (!same(tx, ty, 'foliage') || !ALL.every((d) => same(tx + DX[d], ty + DY[d], 'foliage'))) continue;
      trees.push([tx, ty]);
      canopied.add(i);
      for (const d of ALL) canopied.add(gim.idx(tx + DX[d], ty + DY[d]));
    }
    for (let i = 0; i < gim.features.length; i++) {
      const f = gim.features[i];
      if (!f || f.kind !== 'cover') continue;
      const tx = i % w.grid.w;
      const ty = Math.floor(i / w.grid.w);
      const x = v.ox + tx * TILE;
      const y = v.oy + ty * TILE;
      if (f.style === 'pipe') {
        const pipes = pipeSprites(THEMES[w.arena.theme]?.pipe);
        const links = ALL.filter((d) => same(tx + DX[d], ty + DY[d], 'pipe'));
        let img = pipes.v;
        if (links.length >= 3) img = pipes.cross;
        else if (links.length === 1) img = pipes.end[OPP[links[0]]];
        else if (links.includes('left') || links.includes('right')) img = pipes.h;
        g.image(img, x, y);
      } else if (f.style === 'hut') {
        // Roof blown off: the inside shows until it is rebuilt (blinking just before).
        if (!f.open || (f.open < 40 && Math.floor(f.open / 4) % 2 === 0)) g.image(gs.hut, x, y);
      } else if (!canopied.has(i)) g.image(gs.foliage[(tx + ty) % 3], x, y);
    }
    for (const [tx, ty] of trees) g.image(gs.canopy, v.ox + (tx - 1) * TILE - 2, v.oy + (ty - 1) * TILE - 8);
  }

  /** Robo Bomber's giant, high above everything on its four legs. */
  private drawRobot(g: Gfx, v: View, frame: number): void {
    const r = this.w.gim.robot;
    if (!r || r.gone) return;
    const gs = gimmickSprites();
    const rise = r.leaving > 0 ? r.leaving * 3 : 0;
    const bx = v.ox + r.x;
    const by = v.oy + r.y;
    const hover = 34 + Math.round(Math.sin(frame / 18) * 1.5) + rise;
    g.ctx.globalAlpha = 0.28;
    ellipse(g, bx, by + 4, 20, 6, '#000000');
    g.ctx.globalAlpha = 1;
    const legs = r.feet.map((f, k) => {
      let fx = f.tx * TILE + 8;
      let fy = f.ty * TILE + 8;
      let lift = 0;
      if (f.to) {
        const p = 1 - f.lift / ROBOT_STEP;
        const [txx, tyy] = [f.to[0] * TILE + 8, f.to[1] * TILE + 8];
        // The shadow of the coming foot darkens its landing tile.
        g.ctx.globalAlpha = 0.15 + p * 0.35;
        ellipse(g, v.ox + txx, v.oy + tyy + 3, 4 + p * 4, 2 + p * 2, '#000000');
        g.ctx.globalAlpha = 1;
        fx += (txx - fx) * p;
        fy += (tyy - fy) * p;
        lift = Math.sin(p * Math.PI) * 16;
      }
      lift += rise;
      const [dx, dy] = ROBOT_FEET[k];
      return { hx: bx + Math.sign(dx) * 17, hy: by - hover + 8, fx: v.ox + fx, fy: v.oy + fy - lift, back: dy < 0 };
    });
    const leg = (l: (typeof legs)[number]): void => {
      // Hip up on the body, a knee cocked above the midpoint, down to the foot.
      const kx = (l.hx + l.fx) / 2 + (l.fx > l.hx ? 4 : -4);
      const ky = Math.min(l.hy, l.fy) - 12;
      for (const [w, c] of [[6, '#1c1c2c'], [4, '#dde1ee'], [1, '#ffffff']] as const) {
        thick(g, l.hx, l.hy, kx, ky, w, c);
        thick(g, kx, ky, l.fx, l.fy - 3, w, c);
      }
      ellipse(g, kx, ky, 3.5, 3.5, '#1c1c2c');
      ellipse(g, kx, ky, 2.5, 2.5, '#8890a8');
      g.image(gs.robotFoot, l.fx - 8, l.fy - 6);
    };
    for (const l of legs) if (l.back) leg(l);
    g.image(gs.robotBody[Math.floor(frame / 20) % 2], bx - 24, by - hover - 26);
    for (const l of legs) if (!l.back) leg(l);
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

/** A line of `w`-pixel squares: pixel-crisp limbs. */
function thick(g: Gfx, x0: number, y0: number, x1: number, y1: number, w: number, color: string): void {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) g.rect(Math.round(x0 + ((x1 - x0) * i) / n - w / 2), Math.round(y0 + ((y1 - y0) * i) / n - w / 2), w, w, color);
}

/** A filled pixel ellipse. */
function ellipse(g: Gfx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    if (half > 0) g.rect(Math.round(cx) - half, Math.round(cy) + y, half * 2, 1, color);
  }
}

const ALL: Dir[] = ['up', 'right', 'down', 'left'];
const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** A small spotted egg (7×9) standing on (x, y). */
function drawEgg(g: Gfx, x: number, y: number, frame: number): void {
  const bob = Math.floor(frame / 10) % 2;
  const top = Math.round(y - 9 - bob);
  const left = Math.round(x - 4);
  const rows = ['..###..', '.#####.', '#######', '#######', '#######', '#######', '.#####.', '..###..'];
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] === '#') g.rect(left + i, top + j, 1, 1, '#000000');
  });
  g.rect(left + 2, top + 1, 3, 6, '#fff8f0');
  g.rect(left + 1, top + 2, 5, 4, '#fff8f0');
  g.rect(left + 2, top + 3, 1, 1, '#60c0f0');
  g.rect(left + 4, top + 5, 1, 1, '#60c0f0');
  g.rect(left + 2, top + 2, 1, 1, '#ffffff');
}

/** A Bazooka rocket or a sword shockwave. */
function drawShot(g: Gfx, x: number, y: number, kind: 'rocket' | 'wave', dir: Dir, frame: number): void {
  const horiz = dir === 'left' || dir === 'right';
  const sx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const sy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  const cy = y - 6;
  if (kind === 'rocket') {
    const [w, h] = horiz ? [10, 5] : [5, 10];
    g.rect(Math.round(x - w / 2) - 1, Math.round(cy - h / 2) - 1, w + 2, h + 2, '#000000');
    g.rect(Math.round(x - w / 2), Math.round(cy - h / 2), w, h, '#a8b0c0');
    g.rect(Math.round(x + sx * (w / 2 - 2) - (horiz ? 1 : 2)), Math.round(cy + sy * (h / 2 - 2) - (horiz ? 2 : 1)), horiz ? 3 : 5, horiz ? 5 : 3, '#e03030');
    const flick = frame % 2 ? '#ffe040' : '#ff8020';
    g.rect(Math.round(x - sx * (w / 2 + 3) - 2), Math.round(cy - sy * (h / 2 + 3) - 2), 4, 4, flick);
    return;
  }
  // Shockwave: a bright crescent with a dark rim.
  const c = frame % 4 < 2 ? '#ffffff' : '#a0e8ff';
  const pts: [number, number][] = [];
  for (let k = -6; k <= 6; k++) {
    const bend = Math.round((k * k) / 9);
    pts.push([Math.round(horiz ? x - sx * bend : x + k), Math.round(horiz ? cy + k : cy - sy * bend)]);
  }
  for (const [px, py] of pts) g.rect(px - 2, py - 2, 4, 4, '#103080');
  for (const [px, py] of pts) g.rect(px - 1, py - 1, 2, 2, '#50b0ff');
  for (const [px, py] of pts.slice(2, -2)) g.rect(px - 1, py - 1, 1, 1, c);
}

let emblem: HTMLCanvasElement | null = null;

/** A pink checkered sphere in a ring, seven tiles across. */
function emblemDecal(): HTMLCanvasElement {
  if (emblem) return emblem;
  const c = document.createElement('canvas');
  c.width = 112;
  c.height = 112;
  const ctx = c.getContext('2d')!;
  const cx = 56;
  const cy = 56;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#a01858';
  ctx.beginPath();
  ctx.arc(cx, cy, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe8f4';
  ctx.beginPath();
  ctx.arc(cx, cy, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 46, 0, Math.PI * 2);
  ctx.clip();
  for (let y = 0; y < 112; y += 12) {
    for (let x = 0; x < 112; x += 12) {
      const dark = ((x + y) / 12) % 2 === 0;
      const shade = Math.hypot(x + 6 - cx + 12, y + 6 - cy + 12) / 70;
      ctx.fillStyle = dark ? mix('#e04898', '#801040', shade) : mix('#ffd0e8', '#e080b0', shade);
      ctx.fillRect(x, y, 12, 12);
    }
  }
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx - 16, cy - 18, 16, 10, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  emblem = c;
  return c;
}
