import type { App } from '../../app';
import { mix, type Gfx } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import { CampaignSession } from '../../game/campaign/session';
import { sprites } from '../../gfx/sprites';
import { goTitle } from '../nav';

const CREDITS = [
  'CONGRATULATIONS!',
  '',
  'BOMBERMAN HAS CLEARED',
  'ALL 50 STAGES!',
  '',
  '',
  '- STAFF -',
  '',
  'GAME DESIGN AFTER THE ORIGINAL',
  'BOMBERMAN (1985) AND',
  'BOMBERMAN FOR PLAYSTATION (1998)',
  '',
  'PROGRAMMING, PIXEL ART,',
  'MUSIC AND SOUND',
  'THIS FAN REMAKE',
  '',
  'SPECIAL THANKS',
  'EVERYONE WHO EVER',
  'BLEW UP A SOFT BLOCK',
  '',
  '',
  'THANK YOU FOR PLAYING!',
];

/** Ending after stage 50: Bomberman reaches the surface, fireworks and a staff roll. */
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
    if (this.t % 50 === 0) this.firework();
    for (const s of this.sparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.03;
      s.life--;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    const pad = this.app.input.menu;
    if (this.t > 60 * 30 || (this.t > 240 && pad.pressed('start'))) {
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
    // Dawn sky over the hills.
    const k = Math.min(1, this.t / 600);
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
    const walkX = Math.min(40, -16 + this.t * 0.5);
    const img = walkX < 40 ? sp.walk.right[Math.floor(this.t / 7) % 4] : sp.win[Math.floor(this.t / 20) % 2];
    g.image(img, walkX, 150);
    // Staff roll: scrolls through the sky band, fading at its edges, and stops on the last line.
    const lineH = 12;
    const top = Math.max(84 - (CREDITS.length - 1) * lineH, 150 - (this.t - 120) * 0.35);
    CREDITS.forEach((line, i) => {
      const y = top + i * lineH;
      if (!line || y < 14 || y > 150) return;
      g.ctx.globalAlpha = Math.min(1, (y - 14) / 16, (150 - y) / 16);
      g.text(line, g.width / 2, y, { align: 'center', color: i === 0 || i === CREDITS.length - 1 ? '#ffe040' : '#ffffff', outline: '#000000' });
    });
    g.ctx.globalAlpha = 1;
    g.text(`SCORE ${this.session.score}`, g.width / 2, 204, { align: 'center', color: '#ffffff', outline: '#000000' });
  }
}
