import type { App } from '../../app';
import { mix, type Gfx, type Sprite } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import { FLAME_CENTER, FLAME_DOWN, FLAME_LEFT, FLAME_RIGHT, FLAME_UP } from '../../game/core/types';
import { sprites } from '../../gfx/sprites';

/**
 * "Bomberman Show Time": a short wordless skit with White and Black Bomberman after every
 * tenth stage of the Modern Normal Game. Each has its own set and props, as in the
 * original: a circus tent with a ring of fire and a springboard (stage 10), a shopping
 * street with a present and two angels (20), a hall whose red doors let out monsters (30)
 * and a forest with a hammer, a cracking boulder and chicks (40). The gags are this
 * remake's own.
 */

/** Feet line of everybody on the set. */
const GROUND = 178;
/** Foot of the hall's red doors. */
const DOORSTEP = 126;

type Facing = 'down' | 'up' | 'left' | 'right';

interface Actor {
  x: number;
  /** Height above the ground (jumps, falls, floating angels). */
  hop: number;
  facing: Facing;
  moving: boolean;
  burnt: boolean;
  cheer: boolean;
  angel: boolean;
  visible: boolean;
  emote: string | null;
  /** Black's hammer swing, 0 (raised) .. 1 (struck); null when he has none. */
  hammer: number | null;
}

interface Mob {
  x: number;
  hop: number;
  dir: 1 | -1;
  dead: number;
  /** Monsters: how far out of the doors (0 in the doorway .. 1 at the front); below 0 not out yet. */
  out: number;
}

interface ShowState {
  a: [Actor, Actor];
  /** Springboard x and how far it is pressed (0..1). */
  spring: { x: number; press: number } | null;
  ring: { x: number; flare: number } | null;
  gift: { x: number; hop: number; open: boolean; carried: boolean } | null;
  bomb: { x: number; hop: number } | null;
  boom: { x: number; t: number } | null;
  /** The hall's red doors, 0 shut .. 1 open. */
  door: number;
  monsters: Mob[];
  /** The boulder: cracks 0..3, then 4 = broken. */
  rock: { x: number; stage: number; t: number } | null;
  chicks: Mob[];
}

interface Beat {
  len: number;
  /** Called every frame of the beat with progress 0..1. */
  act?: (s: ShowState, k: number, first: boolean) => void;
  sfx?: string;
}

const walk = (who: Actor, x0: number, x1: number, k: number): void => {
  who.x = x0 + (x1 - x0) * k;
  who.moving = k < 1;
  who.facing = x1 < x0 ? 'left' : 'right';
};

const arc = (k: number, height: number): number => Math.sin(Math.min(1, Math.max(0, k)) * Math.PI) * height;

type SetName = 'circus' | 'street' | 'hall' | 'forest';

function skits(): { set: SetName; beats: Beat[] }[] {
  return [
    // Stage 10: through the ring of fire off a springboard. White sails through; Black
    // comes up short.
    {
      set: 'circus',
      beats: [
        { len: 1, act: (s) => ((s.spring = { x: 92, press: 0 }), (s.ring = { x: 150, flare: 0 })) },
        { len: 44, act: (s, k) => walk(s.a[0], -20, 56, k) },
        { len: 36, act: (s) => (s.a[0].emote = '!') },
        { len: 20, act: (s, k) => ((s.a[0].emote = null), walk(s.a[0], 56, 92, k)) },
        { len: 10, act: (s, k) => (s.spring!.press = k) },
        { len: 46, sfx: 'jump', act: (s, k) => ((s.spring!.press = 0), (s.a[0].x = 92 + 116 * k), (s.a[0].hop = arc(k, 76)), (s.a[0].facing = 'right')) },
        { len: 12, sfx: 'land', act: (s) => ((s.a[0].hop = 0), (s.a[0].facing = 'down')) },
        { len: 50, act: (s) => ((s.a[0].cheer = true), (s.a[0].emote = '♥')) },
        { len: 44, act: (s, k) => ((s.a[0].emote = null), walk(s.a[1], -20, 56, k)) },
        { len: 30, act: (s) => (s.a[1].emote = '!') },
        { len: 20, act: (s, k) => ((s.a[1].emote = null), walk(s.a[1], 56, 92, k)) },
        { len: 10, act: (s, k) => (s.spring!.press = k * 0.5) },
        { len: 22, sfx: 'jump', act: (s, k) => ((s.spring!.press = 0), (s.a[1].x = 92 + 50 * k), (s.a[1].hop = 40 * Math.sin(k * Math.PI * 0.5)), (s.a[1].facing = 'right')) },
        { len: 30, sfx: 'explode', act: (s, k) => ((s.ring!.flare = 1 - k), (s.a[1].burnt = true), (s.a[1].hop = 40 * (1 - k) * (1 - k))) },
        { len: 40, act: (s) => ((s.a[1].hop = 0), (s.a[0].cheer = false), (s.a[0].facing = 'left'), (s.a[0].emote = '?')) },
        { len: 70, act: (s) => ((s.a[0].emote = null), (s.a[1].emote = '...')) },
      ],
    },
    // Stage 20: a present for Black. It's a bomb; both of them float off as angels.
    {
      set: 'street',
      beats: [
        { len: 1, act: (s) => ((s.a[1].x = 186), (s.a[1].facing = 'left'), (s.gift = { x: 0, hop: 0, open: false, carried: true })) },
        { len: 56, act: (s, k) => (walk(s.a[0], -20, 110, k), (s.gift!.x = s.a[0].x + 10)) },
        { len: 20, act: (s, k) => ((s.a[0].moving = false), (s.gift!.carried = false), (s.gift!.x = 120 + 18 * k), (s.gift!.hop = arc(k, 10))) },
        { len: 40, act: (s) => ((s.gift!.hop = 0), (s.a[0].emote = '♥')) },
        { len: 40, act: (s) => ((s.a[0].emote = null), (s.a[1].emote = '♥')) },
        { len: 24, act: (s, k) => ((s.a[1].emote = null), walk(s.a[1], 186, 160, k)) },
        { len: 20, sfx: 'item', act: (s) => ((s.a[1].moving = false), (s.gift!.open = true), (s.bomb = { x: 138, hop: 0 })) },
        { len: 24, act: (s, k) => (s.bomb!.hop = arc(k, 22)) },
        { len: 40, act: (s) => ((s.bomb!.hop = 0), (s.a[0].emote = '!'), (s.a[1].emote = '!')) },
        { len: 30, sfx: 'explode', act: (s, _k, first) => { if (first) s.boom = { x: 138, t: 0 }; s.bomb = null; s.gift = null; s.a[0].emote = s.a[1].emote = null; s.a[0].burnt = s.a[1].burnt = true; } },
        { len: 110, act: (s, k) => { for (const a of s.a) { a.burnt = false; a.angel = true; a.facing = 'down'; a.hop = k * 150; } } },
        { len: 30 },
      ],
    },
    // Stage 30: the red doors open and monsters march out; White's bomb catches them, and
    // Black with them.
    {
      set: 'hall',
      beats: [
        { len: 1, act: (s) => ((s.a[0].x = 86), (s.a[1].x = 170), (s.a[0].facing = 'up'), (s.a[1].facing = 'up')) },
        { len: 40 },
        { len: 50, sfx: 'door', act: (s, k) => (s.door = k) },
        { len: 80, act: (s, k) => { for (let n = 0; n < 4; n++) { const m = s.monsters[n]; m.out = Math.min(1, k * 1.7 - n * 0.22); m.x = 128 + (n - 1.5) * 12 * Math.max(0, m.out); } } },
        { len: 30, act: (s) => ((s.a[0].emote = '!'), (s.a[1].emote = '!'), (s.a[0].facing = 'down'), (s.a[1].facing = 'down')) },
        { len: 30, sfx: 'place', act: (s, k, first) => { s.a[0].emote = s.a[1].emote = null; if (first) s.bomb = { x: 104, hop: 0 }; walk(s.a[0], 86, 50, k); } },
        { len: 70, act: (s, k) => { s.a[0].moving = false; for (const m of s.monsters) m.x += m.x < 128 ? -0.35 : 0.2; if (k > 0.6) s.a[1].emote = '?'; } },
        { len: 36, sfx: 'explode', act: (s, _k, first) => { if (first) s.boom = { x: 104, t: 0 }; s.bomb = null; s.a[1].emote = null; for (const m of s.monsters) m.dead = Math.max(1, m.dead); s.a[1].burnt = true; } },
        { len: 50, act: (s) => ((s.monsters = []), (s.a[0].facing = 'right'), (s.a[0].cheer = true), (s.a[0].emote = '♥')) },
        { len: 70, act: (s) => ((s.a[0].emote = null), (s.a[1].emote = '...')) },
      ],
    },
    // Stage 40: Black takes a hammer to a boulder; it cracks open and a brood of chicks
    // chases him off.
    {
      set: 'forest',
      beats: [
        { len: 1, act: (s) => ((s.rock = { x: 128, stage: 0, t: 0 }), (s.a[1].hammer = 0)) },
        { len: 50, act: (s, k) => walk(s.a[1], 280, 162, k) },
        { len: 40, act: (s, k) => walk(s.a[0], -20, 70, k) },
        { len: 30, act: (s) => ((s.a[0].moving = false), (s.a[0].emote = '?')) },
        ...[1, 2, 3].map(
          (n): Beat => ({
            len: 24,
            sfx: 'punch',
            act: (s, k) => {
              s.a[0].emote = null;
              s.a[1].facing = 'left';
              s.a[1].hammer = k < 0.5 ? k * 2 : 1 - (k - 0.5) * 2;
              if (k >= 0.5) s.rock!.stage = n;
            },
          }),
        ),
        { len: 20, sfx: 'block', act: (s) => ((s.rock!.stage = 4), (s.a[1].hammer = 0)) },
        { len: 40, act: (s, k) => { s.rock!.t++; for (let n = 0; n < 4; n++) { const c = s.chicks[n]; c.x = 128 + (n - 1.5) * 10 * k; c.hop = arc((k * 3 + n * 0.3) % 1, 6); } } },
        { len: 30, act: (s) => (s.a[1].emote = '!') },
        {
          len: 90,
          act: (s, k) => {
            s.rock = null;
            s.a[1].emote = null;
            s.a[1].hammer = null;
            walk(s.a[1], 162, 300, k);
            s.chicks.forEach((c, n) => ((c.x = 128 + (n - 1.5) * 10 + (300 - 128) * Math.max(0, k * 1.1 - 0.1)), (c.hop = arc((s.a[1].x / 20 + n * 0.3) % 1, 6)), (c.dir = 1)));
            if (k > 0.3) s.a[0].emote = '♥';
          },
        },
        { len: 40, act: (s) => ((s.a[0].emote = null), (s.a[0].facing = 'down'), (s.a[0].cheer = true)) },
      ],
    },
  ];
}

export class ShowTimeScene implements Scene {
  private readonly beats: Beat[];
  private readonly set: SetName;
  private beat = 0;
  private t = 0;
  private titleT = 0;
  private readonly s: ShowState;
  private readonly flames: Sprite[];

  constructor(
    private readonly app: App,
    episode: number,
    private readonly done: () => void,
  ) {
    const all = skits();
    const skit = all[(episode - 1) % all.length];
    this.beats = skit.beats;
    this.set = skit.set;
    const actor = (x: number): Actor => ({ x, hop: 0, facing: 'right', moving: false, burnt: false, cheer: false, angel: false, visible: true, emote: null, hammer: null });
    const mob = (): Mob => ({ x: 128, hop: 0, dir: 1, dead: 0, out: -1 });
    this.s = {
      a: [actor(-40), actor(-40)],
      spring: null,
      ring: null,
      gift: null,
      bomb: null,
      boom: null,
      door: 0,
      monsters: [mob(), mob(), mob(), mob()],
      rock: null,
      chicks: [mob(), mob(), mob(), mob()],
    };
    const f = sprites().flame[2];
    this.flames = [f[FLAME_CENTER | FLAME_LEFT | FLAME_RIGHT | FLAME_UP | FLAME_DOWN], f[FLAME_LEFT | FLAME_RIGHT], f[FLAME_RIGHT], f[FLAME_LEFT], f[FLAME_UP | FLAME_DOWN], f[FLAME_UP]];
  }

  enter(): void {
    this.app.audio.music('showTime', { restart: true });
  }

  update(): void {
    const pad = this.app.input.menu;
    if (pad.pressed('start')) {
      this.finish();
      return;
    }
    if (this.titleT < 120) {
      this.titleT++;
      return;
    }
    const b = this.beats[this.beat];
    if (!b) {
      this.finish();
      return;
    }
    if (this.t === 0 && b.sfx) this.app.audio.sfx(b.sfx);
    b.act?.(this.s, Math.min(1, this.t / b.len), this.t === 0);
    if (this.s.boom && ++this.s.boom.t > 36) this.s.boom = null;
    for (const m of this.s.monsters) if (m.dead) m.dead++;
    this.t++;
    if (this.t > b.len) {
      this.beat++;
      this.t = 0;
      for (const a of this.s.a) a.moving = false;
    }
  }

  private finish(): void {
    this.app.audio.stopMusic();
    this.done();
  }

  render(g: Gfx): void {
    const frame = this.app.frame;
    const s = this.s;
    if (this.set === 'circus') drawCircus(g);
    else if (this.set === 'street') drawStreet(g);
    else if (this.set === 'hall') drawHall(g, s.door);
    else drawForest(g, frame);
    if (this.titleT < 120) {
      const k = Math.min(1, this.titleT / 30);
      g.text('BOMBERMAN', g.width / 2, 60 - (1 - k) * 40, { align: 'center', scale: 3, gradient: ['#ffffff', '#ffb000'], outline: '#401000' });
      g.text('SHOW TIME', g.width / 2, 92, { align: 'center', scale: 2, gradient: ['#fff0a0', '#ff5070'], outline: '#401000' });
      return;
    }
    const ctx = g.ctx;
    ctx.imageSmoothingEnabled = false;
    const sp = sprites();
    if (s.spring) drawSpring(g, s.spring.x, s.spring.press);
    if (s.ring) drawRing(g, s.ring.x, s.ring.flare, frame);
    if (s.rock) drawRock(g, s.rock.x, s.rock.stage, s.rock.t);
    for (const m of s.monsters) {
      if (m.out < 0) continue;
      const e = sp.enemies.balloom;
      // Coming out of the doorway, they grow as they come forward.
      const size = Math.round(16 + 16 * m.out);
      const bottom = Math.round(DOORSTEP + (GROUND - DOORSTEP) * m.out);
      if (m.dead) {
        const shrink = Math.max(0, size - m.dead);
        if (shrink > 0) ctx.drawImage(e.dead, Math.round(m.x - shrink / 2), bottom - shrink, shrink, shrink);
      } else ctx.drawImage((m.x < 128 ? e.left : e.right)[Math.floor(frame / 8) % e.right.length], Math.round(m.x - size / 2), bottom - size, size, size);
    }
    if (s.gift && !s.gift.carried) drawGift(g, s.gift.x, GROUND - s.gift.hop, s.gift.open);
    if (s.bomb) ctx.drawImage(sp.bomb[Math.floor(frame / 8) % 3], s.bomb.x - 16, GROUND - 32 - s.bomb.hop, 32, 32);
    s.a.forEach((a, i) => {
      if (!a.visible) return;
      const set = sp.bombers[i];
      const img = a.burnt ? set.death[4] : a.cheer ? set.win[Math.floor(frame / 10) % set.win.length] : a.moving ? set.walk[a.facing][Math.floor(frame / 6) % 4] : set.walk[a.facing][0];
      const top = GROUND - 48 - a.hop;
      if (a.angel) {
        // A halo and little wings, floating up.
        const sway = Math.round(Math.sin((frame + i * 20) / 12) * 3);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#ffffff';
        for (const dx of [-14, 14]) {
          ctx.beginPath();
          ctx.ellipse(a.x + sway + dx, top + 26, 7, 10, dx < 0 ? -0.4 : 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.drawImage(img, a.x - 16 + sway, top, 32, 48);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffe040';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(a.x + sway, top - 4, 9, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.drawImage(img, a.x - 16, top, 32, 48);
        // White carries the present in front of him.
        if (i === 0 && s.gift?.carried) drawGift(g, a.x + 8, GROUND - 12, false);
      }
      if (a.hammer !== null) drawHammer(g, a.x - 10, top + 24, a.hammer);
      if (a.emote) drawEmote(g, a.x, top - 6, a.emote);
    });
    for (const c of s.chicks) if (s.rock?.stage === 4 || (!s.rock && c.x !== 128)) drawChick(g, c.x, GROUND - c.hop, frame);
    if (s.boom) {
      const { x } = s.boom;
      const y = GROUND - 16;
      const f = this.flames;
      const put = (img: Sprite, dx: number, dy: number): void => ctx.drawImage(img, x - 16 + dx * 32, y - 16 + dy * 32, 32, 32);
      put(f[0], 0, 0);
      put(f[1], -1, 0);
      put(f[3], -2, 0);
      put(f[1], 1, 0);
      put(f[2], 2, 0);
      put(f[4], 0, -1);
      put(f[5], 0, -2);
    }
  }
}

/** A thought bubble with a single sign in it: ! ? ♥ or ... */
function drawEmote(g: Gfx, cx: number, bottom: number, sign: string): void {
  const w = sign === '...' ? 26 : 16;
  const x = Math.round(cx - w / 2);
  const y = bottom - 16;
  g.rect(x + 1, y, w - 2, 14, '#000000');
  g.rect(x, y + 1, w, 12, '#000000');
  g.rect(x + 1, y + 1, w - 2, 12, '#ffffff');
  g.rect(cx - 1, y + 14, 3, 2, '#000000');
  g.rect(cx, y + 13, 1, 2, '#ffffff');
  const color = sign === '!' ? '#e02020' : sign === '?' ? '#2050e0' : sign === '♥' ? '#f04090' : '#202020';
  g.text(sign, cx + 1, y + 4, { align: 'center', color });
}

function drawSpring(g: Gfx, x: number, press: number): void {
  const h = Math.round(12 - press * 6);
  for (let i = 0; i < h; i += 3) g.rect(x - 9 + (i % 6 ? 2 : 0), GROUND - 2 - i, 16, 2, '#9098a8');
  g.rect(x - 12, GROUND - 2, 24, 2, '#505060');
  g.rect(x - 13, GROUND - h - 5, 26, 4, '#e06818');
  g.rect(x - 13, GROUND - h - 5, 26, 1, '#ffb070');
}

function drawRing(g: Gfx, x: number, flare: number, frame: number): void {
  const cy = GROUND - 94;
  g.rect(x - 1, cy + 30, 3, GROUND - cy - 30, '#8a8a98');
  g.rect(x - 8, GROUND - 3, 17, 3, '#6a6a78');
  const ctx = g.ctx;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#c04010';
  ctx.beginPath();
  ctx.ellipse(x + 0.5, cy, 12, 30, 0, 0, Math.PI * 2);
  ctx.stroke();
  const n = 14;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + frame / 10;
    const fx = x + Math.cos(a) * 12;
    const fy = cy + Math.sin(a) * 30;
    const flick = (frame + k * 3) % 6 < 3;
    const size = 3 + Math.round(flare * 4);
    g.rect(fx - 2, fy - (flick ? size + 1 : size), 4, flick ? size + 2 : size + 1, k % 2 ? '#ffd040' : '#ff7010');
  }
}

function drawGift(g: Gfx, cx: number, bottom: number, open: boolean): void {
  const x = Math.round(cx - 12);
  const y = Math.round(bottom - 20);
  g.rect(x, y, 24, 20, '#401010');
  g.rect(x + 1, y + 1, 22, 18, '#e03048');
  g.rect(x + 10, y + 1, 4, 18, '#ffd040');
  const lid = open ? -10 : 0;
  g.rect(x - 2, y - 5 + lid, 28, 7, '#401010');
  g.rect(x - 1, y - 4 + lid, 26, 5, '#f04860');
  g.rect(x + 10, y - 4 + lid, 4, 5, '#ffd040');
  if (!open) {
    g.rect(x + 5, y - 9, 6, 4, '#ffd040');
    g.rect(x + 13, y - 9, 6, 4, '#ffd040');
  }
}

function drawHammer(g: Gfx, x: number, y: number, swing: number): void {
  const ctx = g.ctx;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-1.2 + swing * 1.9);
  ctx.fillStyle = '#7a4a20';
  ctx.fillRect(-2, -26, 4, 26);
  ctx.fillStyle = '#303038';
  ctx.fillRect(-9, -34, 18, 10);
  ctx.fillStyle = '#6a6a78';
  ctx.fillRect(-9, -34, 18, 2);
  ctx.restore();
}

function drawRock(g: Gfx, x: number, stage: number, t: number): void {
  const ctx = g.ctx;
  if (stage >= 4) {
    // Broken: pieces scattering and settling.
    const k = Math.min(1, t / 20);
    for (let n = 0; n < 6; n++) {
      const dx = (n - 2.5) * 12 * (0.4 + k);
      const lift = Math.sin(Math.min(1, k * 1.4) * Math.PI) * (10 + (n % 3) * 6);
      g.rect(x + dx - 5, GROUND - 10 - lift, 10, 9, '#6a6e78');
      g.rect(x + dx - 4, GROUND - 9 - lift, 8, 3, '#a8acb8');
    }
    return;
  }
  ctx.fillStyle = '#383c48';
  ctx.beginPath();
  ctx.ellipse(x, GROUND - 22, 28, 23, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a8e9c';
  ctx.beginPath();
  ctx.ellipse(x, GROUND - 22, 26, 21, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b8bcc8';
  ctx.beginPath();
  ctx.ellipse(x - 8, GROUND - 32, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cracks, more of them with every blow.
  const cracks: [number, number, number, number][][] = [
    [],
    [[-2, -40, 4, -26], [4, -26, 0, -16]],
    [[-2, -40, 4, -26], [4, -26, 0, -16], [0, -16, 10, -6], [4, -26, 16, -30]],
    [[-2, -40, 4, -26], [4, -26, 0, -16], [0, -16, 10, -6], [4, -26, 16, -30], [0, -16, -14, -12], [-14, -12, -20, -24]],
  ];
  ctx.strokeStyle = '#202028';
  ctx.lineWidth = 2;
  for (const [x0, y0, x1, y1] of cracks[stage] ?? []) {
    ctx.beginPath();
    ctx.moveTo(x + x0, GROUND + y0);
    ctx.lineTo(x + x1, GROUND + y1);
    ctx.stroke();
  }
}

function drawChick(g: Gfx, x: number, bottom: number, frame: number): void {
  const ctx = g.ctx;
  const y = Math.round(bottom);
  ctx.fillStyle = '#6a4a00';
  ctx.beginPath();
  ctx.ellipse(x, y - 7, 7.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe030';
  ctx.beginPath();
  ctx.ellipse(x, y - 7, 6.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  g.rect(x + 1, y - 10, 2, 2, '#000000');
  g.rect(x + 5, y - 8, 3, 2, '#f08010');
  if (Math.floor(frame / 5) % 2) g.rect(x - 6, y - 8, 3, 2, '#f0c010');
  g.rect(x - 3, y - 1, 2, 2, '#f08010');
  g.rect(x + 1, y - 1, 2, 2, '#f08010');
}

// ------------------------------------------------------------------ sets

/** The circus tent: striped canvas, red drapes, a round ring on the floor and a row of seats. */
function drawCircus(g: Gfx): void {
  for (let x = 0; x < g.width; x += 16) {
    g.rect(x, 0, 8, 126, '#e02830');
    g.rect(x + 8, 0, 8, 126, '#ffd63a');
  }
  // Scalloped valance.
  for (let x = 0; x < g.width; x += 16) {
    g.ctx.fillStyle = x % 32 ? '#e02830' : '#ffd63a';
    g.ctx.beginPath();
    g.ctx.arc(x + 8, 22, 9, 0, Math.PI);
    g.ctx.fill();
  }
  g.rect(0, 18, g.width, 5, '#c8a020');
  // The way in at the back.
  g.ctx.fillStyle = '#f070a0';
  g.ctx.beginPath();
  g.ctx.moveTo(104, 126);
  g.ctx.lineTo(128, 64);
  g.ctx.lineTo(152, 126);
  g.ctx.fill();
  g.ctx.fillStyle = '#301020';
  g.ctx.beginPath();
  g.ctx.moveTo(116, 126);
  g.ctx.lineTo(128, 88);
  g.ctx.lineTo(140, 126);
  g.ctx.fill();
  // Drapes either side.
  for (const [x0, dir] of [[0, 1], [g.width, -1]] as [number, number][]) {
    for (let i = 0; i < 34; i++) g.rect(x0 + dir * i - (dir < 0 ? 1 : 0), 0, 1, 196 - i * 2, i % 6 < 3 ? '#b01828' : '#d02838');
  }
  // The floor and the ring.
  g.rect(0, 126, g.width, 98, '#2a1a3a');
  const ctx = g.ctx;
  ctx.fillStyle = '#1878c0';
  ctx.beginPath();
  ctx.ellipse(128, 170, 124, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#48c8f0';
  ctx.beginPath();
  ctx.ellipse(128, 170, 116, 29, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe860';
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    const r = k % 2 ? 9 : 26;
    ctx.lineTo(128 + Math.cos(a) * r * 1.8, 170 + Math.sin(a) * r * 0.5);
  }
  ctx.fill();
  // Seats along the front.
  const seat = ['#f050a0', '#ffd030', '#30c8e8', '#f08020', '#40c060', '#e03040'];
  for (let k = 0; k < 11; k++) {
    const x = k * 24 - 4;
    g.rect(x, 200, 22, 24, '#201028');
    g.rect(x + 1, 201, 20, 23, seat[k % seat.length]);
    g.rect(x + 3, 203, 16, 3, mix(seat[k % seat.length], '#ffffff', 0.45));
    ctx.fillStyle = '#ff60b0';
    ctx.beginPath();
    ctx.arc(x + 11, 199, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A shopping street: brick shopfronts with striped awnings, trees and lamps, pavement, road. */
function drawStreet(g: Gfx): void {
  g.rect(0, 0, g.width, 128, '#b8603a');
  for (let y = 0; y < 128; y += 6) {
    g.rect(0, y, g.width, 1, '#8a4428');
    for (let x = (y / 6) % 2 ? 0 : 6; x < g.width; x += 12) g.rect(x, y, 1, 6, '#8a4428');
  }
  const awning = [['#ffffff', '#e03040'], ['#ffffff', '#3070e0'], ['#ffe040', '#40a040']];
  for (let k = 0; k < 3; k++) {
    const x = 10 + k * 86;
    // Shop window and door.
    g.rect(x, 66, 64, 56, '#403028');
    g.rect(x + 3, 70, 36, 30, '#a8d8f8');
    g.rect(x + 3, 70, 36, 3, '#e8f8ff');
    g.rect(x + 44, 72, 17, 50, '#6a3a18');
    // Awning.
    for (let i = 0; i < 64; i += 8) g.rect(x + i, 50, 8, 14, awning[k][(i / 8) % 2]);
    g.rect(x - 2, 62, 68, 3, '#402010');
    // Upstairs windows.
    g.rect(x + 8, 12, 16, 22, '#305078');
    g.rect(x + 40, 12, 16, 22, '#305078');
    g.rect(x + 8, 12, 16, 3, '#90b8e0');
    g.rect(x + 40, 12, 16, 3, '#90b8e0');
  }
  // Pavement, kerb and road.
  g.rect(0, 122, g.width, 4, '#b04030');
  g.rect(0, 126, g.width, 60, '#a8b8a0');
  for (let y = 132; y < 186; y += 10) g.rect(0, y, g.width, 1, '#98a890');
  g.rect(0, 186, g.width, 6, '#707880');
  g.rect(0, 192, g.width, 32, '#404448');
  for (let x = 8; x < g.width; x += 48) g.rect(x, 206, 26, 4, '#f0f0f0');
  // Trees and lamps along the pavement.
  const ctx = g.ctx;
  for (const x of [38, 124, 210]) {
    g.rect(x - 3, 86, 6, 42, '#6a4020');
    ctx.fillStyle = '#207a28';
    ctx.beginPath();
    ctx.arc(x, 80, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#40a840';
    ctx.beginPath();
    ctx.arc(x - 5, 74, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const x of [80, 168]) {
    g.rect(x - 1, 60, 3, 68, '#304038');
    g.rect(x - 5, 54, 11, 8, '#304038');
    g.rect(x - 4, 55, 9, 5, '#fff4b0');
  }
}

/** A hall: striped ceiling, lights, tiled back wall with red double doors, a golden floor. */
function drawHall(g: Gfx, door: number): void {
  for (let x = 0; x < g.width; x += 16) {
    g.rect(x, 0, 8, 18, '#d02830');
    g.rect(x + 8, 0, 8, 18, '#30a050');
  }
  g.rect(0, 18, g.width, 20, '#e8e0d0');
  for (let x = 6; x < g.width; x += 20) g.rect(x, 24, 8, 8, '#fff8d0');
  g.rect(0, 38, g.width, 88, '#c8ccd4');
  for (let y = 38; y < 126; y += 11) g.rect(0, y, g.width, 1, '#a8acb8');
  for (let x = 0; x < g.width; x += 16) g.rect(x, 38, 1, 88, '#a8acb8');
  // The doors, sliding open onto darkness.
  g.rect(104, 70, 48, 56, '#100810');
  const w = Math.round(24 * (1 - door));
  g.rect(104, 70, w, 56, '#c81828');
  g.rect(152 - w, 70, w, 56, '#c81828');
  if (w > 3) {
    g.rect(104 + w - 3, 96, 2, 6, '#ffd040');
    g.rect(152 - w + 1, 96, 2, 6, '#ffd040');
  }
  g.frame(102, 68, 52, 58, '#701018');
  // Golden parquet floor in perspective.
  g.rect(0, 126, g.width, 98, '#d8a830');
  for (let k = 0, y = 126; y < g.height; k++, y += 4 + k * 2) g.rect(0, y, g.width, 1, '#b08820');
  for (let i = -8; i <= 8; i++) {
    g.ctx.strokeStyle = '#b89020';
    g.ctx.lineWidth = 1;
    g.ctx.beginPath();
    g.ctx.moveTo(128 + i * 16, 126);
    g.ctx.lineTo(128 + i * 48, 224);
    g.ctx.stroke();
  }
}

/** A forest clearing: big trunks, leaves overhead, bright grass with patches of sun. */
function drawForest(g: Gfx, frame: number): void {
  for (let y = 0; y < 130; y++) g.rect(0, y, g.width, 1, mix('#f0e080', '#a8c850', y / 130));
  const ctx = g.ctx;
  for (const [x, w] of [[20, 26], [84, 18], [150, 22], [224, 30]] as [number, number][]) {
    g.rect(x - w / 2, 0, w, 150, '#5a3818');
    g.rect(x - w / 2, 0, 4, 150, '#7a5028');
    g.rect(x + w / 2 - 5, 0, 5, 150, '#3a2410');
  }
  for (let k = 0; k < 14; k++) {
    ctx.fillStyle = k % 2 ? '#2a7a28' : '#40a038';
    ctx.beginPath();
    ctx.arc((k * 41) % 270 - 6, 6 + (k % 3) * 10, 22 + (k % 4) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  g.rect(0, 130, g.width, 94, '#48b030');
  for (let k = 0; k < 7; k++) {
    ctx.fillStyle = '#c8e050';
    ctx.globalAlpha = 0.5 + 0.1 * Math.sin((frame + k * 30) / 40);
    ctx.beginPath();
    ctx.ellipse((k * 53) % 250 + 10, 150 + (k * 29) % 60, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let x = 2; x < g.width; x += 7) g.rect(x, 128 + ((x * 13) % 6), 2, 5, '#309020');
}
