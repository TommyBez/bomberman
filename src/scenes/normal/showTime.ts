import type { App } from '../../app';
import { mix, type Gfx, type Sprite } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import { FLAME_CENTER, FLAME_DOWN, FLAME_LEFT, FLAME_RIGHT, FLAME_UP } from '../../game/core/types';
import { sprites } from '../../gfx/sprites';
import { drawPanel, wrapText } from '../../render/ui';

/**
 * "Bomberman Show Time": a short comedy skit between White and Black Bomberman shown
 * after every tenth stage of the Modern Normal Game. The first is a jump through a ring
 * of fire, as on the PlayStation; the scripts and jokes are this remake's own.
 */

interface Actor {
  x: number;
  y: number;
  facing: 'down' | 'up' | 'left' | 'right';
  moving: boolean;
  burnt: boolean;
  visible: boolean;
  hop: number;
}

interface Beat {
  /** Length in frames. */
  len: number;
  /** Speaker and line shown in the dialogue box. */
  say?: [0 | 1, string];
  /** Called every frame of the beat with progress 0..1. */
  act?: (s: ShowState, k: number) => void;
}

interface ShowState {
  a: [Actor, Actor];
  bomb: { x: number; y: number; visible: boolean; size: number } | null;
  boom: { x: number; y: number; t: number } | null;
  prop: string | null;
  propX: number;
  propY: number;
}

const walkTo = (who: Actor, x0: number, x1: number, k: number): void => {
  who.x = x0 + (x1 - x0) * k;
  who.moving = k < 1;
  who.facing = x1 < x0 ? 'left' : 'right';
};

function skits(): Beat[][] {
  return [
    // 1. The ring of fire (stage 10's show on the PlayStation is a jump through one)
    [
      { len: 30, act: (s) => ((s.prop = 'ring'), (s.propX = 150), (s.propY = 150), (s.a[1].x = 200), (s.a[1].facing = 'left')) },
      { len: 110, say: [1, 'LADIES AND GENTLEBOMBS... THE RING OF FIRE!'], act: (s) => (s.a[1].facing = 'down') },
      { len: 90, say: [0, 'YOU WANT ME TO JUMP THROUGH THAT?'], act: (s) => (s.a[0].facing = 'right') },
      { len: 90, say: [1, "DON'T WORRY. IT'S PERFECTLY SAFE."], act: (s) => (s.a[1].facing = 'left') },
      { len: 40, act: (s, k) => walkTo(s.a[0], 80, 112, k) },
      { len: 40, act: (s, k) => ((s.a[0].x = 112 + 60 * k), (s.a[0].hop = Math.sin(k * Math.PI) * 22), (s.a[0].moving = true), (s.a[0].facing = 'right')) },
      { len: 80, say: [0, 'TA-DA!'], act: (s) => ((s.a[0].hop = 0), (s.a[0].facing = 'down')) },
      { len: 90, say: [1, 'PFF. ANYONE CAN DO THAT. WATCH!'], act: (s, k) => ((s.a[1].x = 200 + 30 * k), (s.a[1].facing = 'right'), (s.a[1].moving = k < 1)) },
      { len: 40, act: (s, k) => walkTo(s.a[1], 230, 188, k) },
      { len: 36, act: (s, k) => ((s.a[1].x = 188 - 38 * k), (s.a[1].hop = Math.sin(k * Math.PI) * 6), (s.a[1].moving = true), (s.a[1].facing = 'left')) },
      { len: 60, act: (s, k) => { if (k === 0 || !s.boom) s.boom = { x: 150, y: 150, t: 0 }; s.a[1].hop = 0; s.a[1].moving = false; s.a[1].burnt = true; if (k > 0.5) s.prop = null; } },
      { len: 110, say: [0, 'PERFECTLY SAFE, HUH?'], act: (s) => (s.a[0].facing = 'left') },
    ],
    // 2. Hide and seek
    [
      { len: 20, act: (s) => ((s.prop = 'block'), (s.propX = 170), (s.propY = 140), (s.a[1].visible = false)) },
      { len: 110, say: [0, 'WHERE IS BLACK HIDING?'], act: (s) => (s.a[0].facing = 'right') },
      { len: 90, say: [1, '(HEE HEE... HE WILL NEVER FIND ME)'] },
      { len: 60, say: [0, "MAYBE BEHIND THAT BLOCK?"], act: (s, k) => walkTo(s.a[0], 80, 140, k) },
      { len: 40, act: (s, k) => ((s.bomb = { x: 156, y: 150, visible: true, size: 1 }), walkTo(s.a[0], 140, 90, k)) },
      { len: 60, act: (s, k) => { if (!s.boom) s.boom = { x: 156, y: 150, t: 0 }; s.bomb = null; if (k > 0.3) { s.prop = null; s.a[1].visible = true; s.a[1].burnt = true; s.a[1].x = 175; s.a[1].hop = Math.sin(k * Math.PI) * 26; } } },
      { len: 110, say: [1, 'FOUND ME... *COUGH*'], act: (s) => ((s.a[1].hop = 0), (s.a[1].facing = 'left')) },
      { len: 80, say: [0, "YOU'RE IT!"] },
    ],
    // 3. The magic trick
    [
      { len: 30, act: (s) => ((s.prop = 'hat'), (s.propX = 150), (s.propY = 150)) },
      { len: 110, say: [1, 'LADIES AND GENTLEBOMBS! MAGIC!'], act: (s) => ((s.a[1].x = 170), (s.a[1].facing = 'down')) },
      { len: 100, say: [1, 'I PUT A BOMB INTO MY HAT...'], act: (s) => (s.bomb = { x: 150, y: 138, visible: true, size: 1 }) },
      { len: 60, act: (s, k) => s.bomb && (s.bomb.y = 138 + k * 12) },
      { len: 90, say: [1, '...AND IT BECOMES A RABBIT!'], act: (s) => (s.bomb = null) },
      { len: 60, act: (s, k) => { if (!s.boom) s.boom = { x: 150, y: 150, t: 0 }; if (k > 0.2) { s.prop = null; s.a[1].burnt = true; } } },
      { len: 110, say: [0, 'CLAP... CLAP...'], act: (s) => (s.a[0].facing = 'right') },
    ],
    // 4. The birthday cake
    [
      { len: 30, act: (s) => ((s.prop = 'cake'), (s.propX = 128), (s.propY = 150)) },
      { len: 110, say: [0, 'HAPPY BIRTHDAY, BLACK! I MADE A CAKE!'], act: (s) => ((s.a[0].x = 90), (s.a[0].facing = 'right')) },
      { len: 100, say: [1, 'WOW! THE CANDLES LOOK FUNNY...'], act: (s) => ((s.a[1].x = 166), (s.a[1].facing = 'left')) },
      { len: 90, say: [0, "THEY'RE FUSES. BLOW THEM OUT!"] },
      { len: 50, act: (s) => (s.a[1].hop = 0) },
      { len: 60, act: (s, k) => { if (!s.boom) s.boom = { x: 136, y: 150, t: 0 }; if (k > 0.2) { s.prop = null; s.a[1].burnt = true; s.a[0].burnt = true; } } },
      { len: 120, say: [1, '...BEST BIRTHDAY EVER.'], act: (s) => ((s.a[0].facing = 'down'), (s.a[1].facing = 'down')) },
    ],
  ];
}

export class ShowTimeScene implements Scene {
  private beats: Beat[];
  private beat = 0;
  private t = 0;
  private titleT = 0;
  private s: ShowState;
  private readonly flames: Sprite[];

  constructor(
    private readonly app: App,
    episode: number,
    private readonly done: () => void,
  ) {
    const all = skits();
    this.beats = all[(episode - 1) % all.length];
    const mk = (x: number, facing: Actor['facing']): Actor => ({ x, y: 150, facing, moving: false, burnt: false, visible: true, hop: 0 });
    this.s = { a: [mk(80, 'right'), mk(280, 'left')], bomb: null, boom: null, prop: null, propX: 0, propY: 0 };
    const f = sprites().flame[2];
    this.flames = [f[FLAME_CENTER | FLAME_LEFT | FLAME_RIGHT | FLAME_UP | FLAME_DOWN], f[FLAME_LEFT | FLAME_RIGHT], f[FLAME_RIGHT], f[FLAME_LEFT], f[FLAME_UP | FLAME_DOWN], f[FLAME_DOWN], f[FLAME_UP]];
  }

  enter(): void {
    this.app.audio.music('select', { restart: true });
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
    const k = Math.min(1, this.t / b.len);
    b.act?.(this.s, k);
    if (this.s.boom) {
      if (this.s.boom.t === 0) this.app.audio.sfx('explode');
      this.s.boom.t++;
      if (this.s.boom.t > 36) this.s.boom = null;
    }
    this.t++;
    if (this.t > b.len || (b.say && this.t > 20 && pad.pressed('a'))) {
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
    // Stage with curtains and a spotlight.
    g.clear('#1a0810');
    for (let y = 0; y < 170; y++) g.rect(0, y, g.width, 1, mix('#301020', '#50182c', y / 170));
    g.rect(0, 166, g.width, 58, '#6a3a1a');
    for (let x = 0; x < g.width; x += 16) g.rect(x, 166, 1, 58, '#4a2810');
    g.rect(0, 166, g.width, 2, '#a86a3a');
    for (let x = 0; x < 34; x += 6) {
      g.rect(x, 0, 4, 170, '#b01828');
      g.rect(g.width - x - 4, 0, 4, 170, '#b01828');
    }
    g.rect(0, 0, g.width, 14, '#b01828');
    for (let x = 0; x < g.width; x += 8) g.rect(x, 12, 6, 4, '#ffd040');
    g.ctx.globalAlpha = 0.12;
    g.ctx.fillStyle = '#fff8c0';
    g.ctx.beginPath();
    g.ctx.moveTo(110, 14);
    g.ctx.lineTo(146, 14);
    g.ctx.lineTo(220, 170);
    g.ctx.lineTo(36, 170);
    g.ctx.fill();
    g.ctx.globalAlpha = 1;

    if (this.titleT < 120) {
      const k = Math.min(1, this.titleT / 30);
      g.text('BOMBERMAN', g.width / 2, 60 - (1 - k) * 40, { align: 'center', scale: 3, gradient: ['#ffffff', '#ffb000'], outline: '#401000' });
      g.text('SHOW TIME', g.width / 2, 92, { align: 'center', scale: 2, gradient: ['#fff0a0', '#ff5070'], outline: '#401000' });
      return;
    }
    const sp = sprites();
    const s = this.s;
    // props
    if (s.prop === 'block') g.image(sp.tiles.m1?.soft ?? sp.bomb[0], s.propX - 8, s.propY - 8);
    if (s.prop === 'hat') {
      g.rect(s.propX - 7, s.propY - 2, 14, 10, '#000000');
      g.rect(s.propX - 10, s.propY + 7, 20, 3, '#000000');
      g.rect(s.propX - 6, s.propY, 12, 2, '#c02030');
    }
    if (s.prop === 'ring') {
      // A burning hoop on a stand.
      g.rect(s.propX - 1, s.propY - 6, 3, 14, '#6a3a1a');
      g.rect(s.propX - 6, s.propY + 6, 13, 3, '#6a3a1a');
      g.ctx.lineWidth = 3;
      g.ctx.strokeStyle = '#c04010';
      g.ctx.beginPath();
      g.ctx.ellipse(s.propX + 0.5, s.propY - 18, 6, 12, 0, 0, Math.PI * 2);
      g.ctx.stroke();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + this.app.frame / 10;
        const fx = s.propX + Math.cos(a) * 6;
        const fy = s.propY - 18 + Math.sin(a) * 12;
        const flick = (this.app.frame + k * 3) % 6 < 3;
        g.rect(fx - 1, fy - (flick ? 3 : 2), 3, flick ? 4 : 3, k % 2 ? '#ffd040' : '#ff7010');
      }
    }
    if (s.prop === 'cake') {
      g.rect(s.propX - 14, s.propY - 4, 28, 14, '#000000');
      g.rect(s.propX - 13, s.propY - 3, 26, 12, '#f8e0c0');
      g.rect(s.propX - 13, s.propY - 3, 26, 3, '#ff80b0');
      for (let i = -9; i <= 9; i += 6) {
        g.rect(s.propX + i, s.propY - 9, 1, 6, '#c08850');
        if (Math.floor(this.app.frame / 4) % 2) g.rect(s.propX + i, s.propY - 11, 1, 2, '#ffd040');
      }
    }
    if (s.bomb) g.image(sp.bomb[Math.floor(this.app.frame / 8) % 3], s.bomb.x - 8, s.bomb.y - 8);
    s.a.forEach((a, i) => {
      if (!a.visible) return;
      const set = sp.bombers[i];
      const img = a.burnt ? set.death[4] : a.moving ? set.walk[a.facing][Math.floor(this.app.frame / 7) % 4] : set.walk[a.facing][0];
      g.image(img, a.x - 8, a.y - 16 - a.hop);
    });
    if (s.boom) {
      const { x, y } = s.boom;
      const f = this.flames;
      g.image(f[0], x - 8, y - 8);
      g.image(f[1], x - 24, y - 8);
      g.image(f[3], x - 40, y - 8);
      g.image(f[1], x + 8, y - 8);
      g.image(f[2], x + 24, y - 8);
      g.image(f[4], x - 8, y - 24);
      g.image(f[6], x - 8, y - 40);
    }
    const b = this.beats[this.beat];
    if (b?.say) {
      const [who, line] = b.say;
      drawPanel(g, 12, 176, 232, 40, who === 0 ? '#4060d0' : '#404058', who === 0 ? '#101868' : '#14141c');
      g.text(who === 0 ? 'WHITE' : 'BLACK', 20, 182, { color: '#ffe040', outline: '#000000' });
      let budget = Math.floor(this.t / 2);
      wrapText(line, 36).forEach((l, i) => {
        g.text(l.slice(0, Math.max(0, budget)), 20, 195 + i * 10, { color: '#ffffff', outline: '#000000' });
        budget -= l.length + 1;
      });
    }
    g.text('START: SKIP', g.width - 4, 2, { align: 'right', color: '#ffe0e0' });
  }
}
