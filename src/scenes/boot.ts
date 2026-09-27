import type { App } from '../app';
import { flipX, pixelSprite, type Gfx } from '../engine/gfx';
import type { Scene } from '../engine/scene';
import { CampaignSession } from '../game/campaign/session';
import { startNormalGame } from './normal/flow';
import { EndingScene } from './normal/ending';
import { ShowTimeScene } from './normal/showTime';
import { goTitle } from './nav';
import { BattleMatch } from './battle/match';
import { ARENAS } from '../game/battle/arenas';
import { defaultConfig } from '../game/battle/config';
import { BOMBER_FRAMES, BOMBER_PALETTE } from '../gfx/art/bomberArt';
import { BOMB_FRAMES, drawBomb, drawFlame, drawPuff, FLAME_PHASES } from '../gfx/fx';
import { FLAME_CENTER, FLAME_DOWN, FLAME_LEFT, FLAME_RIGHT, FLAME_UP } from '../game/core/types';
import { buildTiles, THEMES } from '../gfx/tiles';
import { drawEnemy, ENEMY_ANIM_FRAMES } from '../gfx/enemyArt';
import { ENEMY_ORDER } from '../game/campaign/enemies';

/**
 * First scene: routes to the title screen, or to a debug shortcut from the URL hash
 * (#play=N, #play=Nr, #battle=<stage>, #demo=<stage>, #show=N, #ending, and the #sprites / #arena /
 * #enemies art previews).
 */
export class BootScene implements Scene {
  private bombs = [0, 1, 2].map((i) => drawBomb(i));
  private flames: HTMLCanvasElement[][] = [];
  private puffs = [0, 1, 2, 3].map((i) => drawPuff(i));
  private bomber = Object.fromEntries(Object.entries(BOMBER_FRAMES).map(([k, v]) => [k, pixelSprite(v, BOMBER_PALETTE)]));

  constructor(private readonly app: App) {
    const shapes = [
      FLAME_CENTER | FLAME_LEFT | FLAME_RIGHT | FLAME_UP | FLAME_DOWN,
      FLAME_LEFT | FLAME_RIGHT,
      FLAME_UP | FLAME_DOWN,
      FLAME_LEFT,
      FLAME_RIGHT,
      FLAME_UP,
      FLAME_DOWN,
      FLAME_CENTER,
    ];
    for (let ph = 0; ph < FLAME_PHASES; ph++) this.flames.push(shapes.map((b) => drawFlame(b, ph)));
  }

  update(): void {
    if (this.started) return;
    this.started = true;
    const h = location.hash;
    if (h.startsWith('#play')) {
      // Dev shortcut: #play, #play=12, #play=12r (retro)
      const m = /^#play(?:=(\d+)(r?))?/.exec(h);
      const s = new CampaignSession(m?.[2] ? 'retro' : 'modern');
      if (m?.[1]) s.stageIndex = Math.max(0, Math.min(49, Number(m[1]) - 1));
      startNormalGame(this.app, s);
    } else if (h.startsWith('#battle') || h.startsWith('#demo')) {
      // Dev shortcut: #battle=a5 / #demo=a5, with an x suffix for the alternate layout
      // (only once that level's alternates have been opened).
      const id = h.split('=')[1] ?? 'b1';
      const arena = ARENAS.find((a) => a.id === id.replace(/x$/, '')) ?? ARENAS[0];
      const cfg = defaultConfig();
      cfg.level = arena.level;
      cfg.stage = ARENAS.filter((a) => a.level === arena.level).indexOf(arena);
      cfg.alternate = id.endsWith('x');
      cfg.rules.cart = 'on';
      cfg.players.forEach((p, i) => (p.type = h.startsWith('#demo') || i > 0 ? 'com' : 'human'));
      const chars = ['bomberman', 'cossack', 'punk', 'mexican', 'barbarian', 'great', 'jet', 'bazooka', 'hammer', 'lady'];
      if (arena.level !== 'beginner') cfg.players.forEach((p, i) => (p.character = chars[(i + (arena.level === 'advanced' ? 5 : 0)) % chars.length]));
      new BattleMatch(this.app, cfg, () => goTitle(this.app)).start();
    } else if (h === '#ending') {
      this.app.scenes.go(new EndingScene(this.app, new CampaignSession('modern')));
    } else if (h.startsWith('#show')) {
      // Dev shortcut: #show=1..4, the Show Time skit after stage 10, 20, 30 or 40.
      const n = Math.max(1, Math.min(4, Number(h.split('=')[1]) || 1));
      this.app.scenes.go(new ShowTimeScene(this.app, n, () => goTitle(this.app)));
    } else if (!['#arena', '#enemies', '#sprites'].includes(h)) {
      goTitle(this.app);
    }
  }

  private started = false;

  private tiles = buildTiles(THEMES.m1);

  render(g: Gfx): void {
    if (location.hash === '#arena') return this.renderArena(g);
    if (location.hash === '#enemies') return this.renderEnemies(g);
    g.clear('#207830');
    const t = this.app.frame;
    g.text('SPRITE PREVIEW', 4, 4, { color: '#ffffff', shadow: '#000000' });
    for (let i = 0; i < BOMB_FRAMES; i++) g.image(this.bombs[i], 8 + i * 20, 20);
    g.image(this.bombs[Math.floor(t / 10) % 3], 72, 20);
    this.flames.forEach((row, ph) => row.forEach((c, i) => g.image(c, 8 + i * 18, 44 + ph * 18)));
    // assembled cross explosion
    const ph = [0, 1, 2, 3, 4, 3, 2, 1][Math.floor(t / 6) % 8];
    const row = this.flames[ph];
    const ox = 200;
    const oy = 60;
    g.image(row[0], ox, oy);
    g.image(row[1], ox - 16, oy);
    g.image(row[3], ox - 32, oy);
    g.image(row[1], ox + 16, oy);
    g.image(row[4], ox + 32, oy);
    g.image(row[2], ox, oy - 16);
    g.image(row[5], ox, oy - 32);
    g.image(row[2], ox, oy + 16);
    g.image(row[6], ox, oy + 32);
    this.puffs.forEach((c, i) => g.image(c, 8 + i * 18, 140));
    const keys = Object.keys(this.bomber);
    keys.forEach((k, i) => g.image(this.bomber[k], 8 + i * 18, 170));
    g.image(flipX(this.bomber.left1), 8 + keys.length * 18, 170);
    const walk = ['down0', 'down1', 'down0', 'down2'][Math.floor(t / 8) % 4];
    g.image(this.bomber[walk], 280, 170);
  }

  private renderArena(g: Gfx): void {
    g.clear('#000000');
    const W = 15;
    const H = 13;
    const ox = 40;
    const oy = 24;
    const cell = (x: number, y: number): number => {
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) return 3;
      if (x % 2 === 0 && y % 2 === 0) return 1;
      if (x + y < 4 || x + y > W + H - 6) return 0;
      return (x * 7 + y * 13) % 5 < 3 ? 2 : 0;
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = cell(x, y);
        const img =
          c === 3 ? this.tiles.wall : c === 1 ? this.tiles.hard : c === 2 ? this.tiles.soft : cell(x, y - 1) ? this.tiles.floorShadow : this.tiles.floor;
        g.image(img, ox + x * 16, oy + y * 16);
      }
    }
    const t = this.app.frame;
    g.image(this.tiles.burn[Math.floor(t / 8) % this.tiles.burn.length], ox + 16 * 5, oy + 16 * 3);
    g.image(this.bombs[Math.floor(t / 10) % 3], ox + 16 * 3, oy + 16 * 1);
    const ph = [0, 1, 2, 3, 4, 3, 2, 1][Math.floor(t / 6) % 8];
    const row = this.flames[ph];
    g.image(row[0], ox + 16 * 7, oy + 16 * 7);
    g.image(row[1], ox + 16 * 6, oy + 16 * 7);
    g.image(row[4], ox + 16 * 5, oy + 16 * 7);
    g.image(row[1], ox + 16 * 8, oy + 16 * 7);
    g.image(row[3], ox + 16 * 9, oy + 16 * 7);
    g.image(row[6], ox + 16 * 7, oy + 16 * 6);
    g.image(row[5], ox + 16 * 7, oy + 16 * 8);
    g.image(this.bomber.down0, ox + 16 * 1, oy + 16 * 1 - 8);
    g.image(this.bomber.left1, ox + 16 * 11, oy + 16 * 9 - 8);
    g.rect(0, 0, g.width, 22, '#000000');
    g.text('TIME 3:00', 8, 8, { color: '#ffffff' });
  }

  private enemyArt = ENEMY_ORDER.map((k) => ({
    k,
    frames: Array.from({ length: ENEMY_ANIM_FRAMES }, (_, i) => drawEnemy(k, i, 'right')),
    left: drawEnemy(k, 0, 'left'),
    dead: drawEnemy(k, 0, 'right', true),
  }));

  private renderEnemies(g: Gfx): void {
    g.clear('#2e8b3a');
    this.enemyArt.forEach((e, row) => {
      const y = 6 + row * 29;
      g.text(e.k, 4, y + 5, { color: '#ffffff', shadow: '#000000' });
      e.frames.forEach((c, i) => g.image(c, 70 + i * 20, y));
      g.image(e.left, 160, y);
      g.image(e.dead, 180, y);
      g.image(e.frames[Math.floor(this.app.frame / 8) % ENEMY_ANIM_FRAMES], 210, y);
    });
  }
}
