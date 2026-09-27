import type { App } from '../../app';
import { mix, type Gfx } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import { ENEMY_ORDER, ENEMY_TYPES } from '../../game/campaign/enemies';
import { CampaignSession } from '../../game/campaign/session';
import { sprites } from '../../gfx/sprites';
import { goTitle } from '../nav';

const INTRO_TICKS = 8 * 60;
/** Each monster's turn in the cast roll. */
const CAST_TICKS = 3 * 60;
const OUTRO_TICKS = 9 * 60;
const CAST_END = INTRO_TICKS + ENEMY_ORDER.length * CAST_TICKS;

/** Staff lines carried by each monster in turn. */
const CAST_CREDITS: [string, string][] = [
  ['GAME DESIGN AFTER', 'BOMBERMAN (1985)'],
  ['AND BOMBERMAN FOR', 'PLAYSTATION (1998)'],
  ['PROGRAMMING', 'THIS FAN REMAKE'],
  ['PIXEL ART', 'THIS FAN REMAKE'],
  ['MUSIC AND SOUND', 'THIS FAN REMAKE'],
  ['SPECIAL THANKS', 'EVERYONE WHO EVER'],
  ['', 'BLEW UP A SOFT BLOCK'],
  ['AND YOU!', ''],
];

/** A backdrop gradient (top, bottom) for each monster. */
const CAST_SKIES: [string, string][] = [
  ['#1c5cc0', '#58b0f0'],
  ['#8a2c14', '#f09040'],
  ['#2c2ca0', '#6c64e8'],
  ['#1c6a50', '#48c890'],
  ['#502080', '#a860e0'],
  ['#1c3c8a', '#58a0e8'],
  ['#80204c', '#e058b0'],
  ['#704010', '#f0c040'],
];

/**
 * Ending after stage 50: dawn over the hills with fireworks, then the staff roll as a cast
 * roll of the eight monsters (each alone on a coloured backdrop, as in the original), then
 * Bomberman's bow.
 */
export class EndingScene implements Scene {
  private t = 0;
  private sparks: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];

  constructor(
    private readonly app: App,
    private readonly session: CampaignSession,
  ) {
    CampaignSession.saveTop(session.score);
  }

  enter(): void {
    this.app.audio.music(this.session.version === 'retro' ? 'endingRetro' : 'ending', { restart: true });
  }

  update(): void {
    this.t++;
    const outdoors = this.t < INTRO_TICKS || this.t >= CAST_END;
    if (outdoors && this.t % 50 === 0) this.firework();
    for (const s of this.sparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.03;
      s.life--;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    const pad = this.app.input.menu;
    if (this.t > CAST_END + OUTRO_TICKS || (this.t > 240 && pad.pressed('start'))) {
      this.app.audio.stopMusic(0.5);
      goTitle(this.app);
    }
  }

  private firework(): void {
    const x = 40 + Math.random() * 176;
    const y = 30 + Math.random() * 60;
    const c = ['#ff6060', '#ffe040', '#60c0ff', '#80ff80', '#ff80ff'][Math.floor(Math.random() * 5)];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const v = 0.8 + Math.random() * 0.6;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 50 + Math.random() * 20, c });
    }
    this.app.audio.sfx('explode');
  }

  render(g: Gfx): void {
    if (this.t >= INTRO_TICKS && this.t < CAST_END) return this.renderCast(g, this.t - INTRO_TICKS);
    const t = this.t;
    const outro = t >= CAST_END;
    // Dawn sky over the hills.
    const k = outro ? 1 : Math.min(1, t / 600);
    for (let y = 0; y < g.height; y++) {
      g.rect(0, y, g.width, 1, mix(mix('#101040', '#4080e0', k), mix('#402060', '#ffb070', k), y / g.height));
    }
    g.ctx.fillStyle = mix('#ffe080', '#fff8e0', k);
    g.ctx.beginPath();
    g.ctx.arc(226, 160 - k * 50, 14, 0, Math.PI * 2);
    g.ctx.fill();
    for (const s of this.sparks) g.rect(s.x, s.y, 1, 1, s.c);
    g.ctx.fillStyle = '#1e5a2a';
    g.ctx.beginPath();
    g.ctx.moveTo(0, 180);
    for (let x = 0; x <= g.width; x += 8) g.ctx.lineTo(x, 172 + Math.sin(x / 30) * 6);
    g.ctx.lineTo(g.width, g.height);
    g.ctx.lineTo(0, g.height);
    g.ctx.fill();
    const sp = sprites().bombers[0];
    g.ctx.imageSmoothingEnabled = false;
    if (outro) {
      g.ctx.drawImage(sp.win[Math.floor(t / 20) % 2], g.width / 2 - 16, 124, 32, 48);
      g.text('THANK YOU FOR PLAYING!', g.width / 2, 60, { align: 'center', color: '#ffe040', outline: '#000000' });
      g.text(`SCORE ${this.session.score}`, g.width / 2, 204, { align: 'center', color: '#ffffff', outline: '#000000' });
      return;
    }
    const walkX = Math.min(112, -32 + t * 0.6);
    const img = walkX < 112 ? sp.walk.right[Math.floor(t / 7) % 4] : sp.win[Math.floor(t / 20) % 2];
    g.ctx.drawImage(img, walkX, 124, 32, 48);
    if (t > 120) {
      const a = Math.min(1, (t - 120) / 40);
      g.ctx.globalAlpha = a;
      g.text('CONGRATULATIONS!', g.width / 2, 50, { align: 'center', scale: 2, gradient: ['#fff8a0', '#ffb000'], outline: '#401000' });
      g.text('BOMBERMAN HAS CLEARED', g.width / 2, 78, { align: 'center', color: '#ffffff', outline: '#000000' });
      g.text('ALL 50 STAGES!', g.width / 2, 90, { align: 'center', color: '#ffffff', outline: '#000000' });
      g.ctx.globalAlpha = 1;
    }
  }

  /** One monster at a time, big, bobbing over its shadow, with its name and a staff line. */
  private renderCast(g: Gfx, t: number): void {
    const n = Math.min(ENEMY_ORDER.length - 1, Math.floor(t / CAST_TICKS));
    const local = t - n * CAST_TICKS;
    const kind = ENEMY_ORDER[n];
    const [top, bottom] = CAST_SKIES[n];
    for (let y = 0; y < g.height; y++) g.rect(0, y, g.width, 1, mix(top, bottom, y / g.height));
    // Slide in from the right, stay, slide out to the left.
    const inK = Math.min(1, local / 30);
    const outK = Math.max(0, (local - (CAST_TICKS - 30)) / 30);
    const x = 128 + (1 - inK) * (1 - inK) * 200 - outK * outK * 200;
    const bob = Math.round(Math.sin(local / 12) * 4);
    const ctx = g.ctx;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000020';
    ctx.beginPath();
    ctx.ellipse(x, 148, 34 - bob, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const e = sprites().enemies[kind];
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(e.left[Math.floor(local / 10) % e.left.length], Math.round(x - 40), 60 + bob, 80, 80);
    const fade = Math.min(1, local / 40, (CAST_TICKS - local) / 30);
    ctx.globalAlpha = Math.max(0, fade);
    g.text(ENEMY_TYPES[kind].name, g.width / 2, 160, { align: 'center', scale: 2, color: '#ffffff', outline: '#101030' });
    const [a, b] = CAST_CREDITS[n];
    if (a) g.text(a, g.width / 2, 186, { align: 'center', color: '#fff4a0', outline: '#101030' });
    if (b) g.text(b, g.width / 2, 198, { align: 'center', color: '#ffffff', outline: '#101030' });
    ctx.globalAlpha = 1;
  }
}
