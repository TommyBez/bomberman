import type { App } from '../../app';
import { HUD_H } from '../../config';
import type { Gfx } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import { CpuPlayer } from '../../game/battle/ai';
import type { ArenaDef } from '../../game/battle/arenas';
import { BattleWorld, DISEASE_NAMES } from '../../game/battle/battleWorld';
import type { BattleItem } from '../../game/battle/config';
import { NO_INTENT } from '../../game/core/bomber';
import type { GameEvent } from '../../game/core/events';
import { TILE } from '../../game/core/types';
import { THEMES } from '../../gfx/tiles';
import { BattleRenderer } from '../../render/battleField';
import type { View } from '../../render/field';
import { clockText, hudIcons, hudStrip } from '../../render/hud';
import { drawBanner } from '../../render/ui';
import { goTitle } from '../nav';
import { DEMO_TICKS } from './demo';
import type { BattleMatch } from './match';

type Phase = 'ready' | 'play' | 'end';

/** Arena origin: 8 px margins left/right; the top wall row hides behind the HUD strip. */
const OX = 8;
const OY = HUD_H - TILE;

interface Popup {
  text: string;
  x: number;
  y: number;
  t: number;
  color: string;
}

/** One game (round) of the Battle Game. */
export class BattleRoundScene implements Scene {
  readonly world: BattleWorld;
  private readonly renderer: BattleRenderer;
  private readonly cpus = new Map<number, CpuPlayer>();
  private phase: Phase = 'ready';
  private t = 0;
  private paused = false;
  private pauseSel = 0;
  private banner: { text: string; t: number; color: string } | null = null;
  private popups: Popup[] = [];
  private shake = 0;

  constructor(
    private readonly app: App,
    private readonly match: BattleMatch,
    arena: ArenaDef,
    prizes: (BattleItem | null)[],
    gold: boolean[],
  ) {
    this.world = new BattleWorld({ cfg: match.cfg, arena, prizes, gold, seed: (Math.random() * 2 ** 31) | 0 });
    this.renderer = new BattleRenderer(this.world);
    const cfg = match.cfg;
    for (const b of this.world.bombers) {
      const slot = cfg.players[b.id];
      if (slot.type === 'com') this.cpus.set(b.id, new CpuPlayer(this.world, b, cfg.rules.com));
      else this.app.input.players[b.id].devices = [...slot.devices];
    }
  }

  enter(): void {
    this.app.audio.music('battle', { restart: true });
    for (const c of this.app.input.players) c.swallow();
  }

  update(): void {
    this.t++;
    if (this.shake > 0) this.shake--;
    const input = this.app.input;
    if (this.match.demo && (input.menu.anyPressed() || (this.phase === 'play' && this.t > DEMO_TICKS))) {
      input.menu.swallow();
      goTitle(this.app);
      return;
    }
    if (this.phase === 'ready') {
      if (this.t > 110) {
        this.phase = 'play';
        this.t = 0;
      }
      return;
    }
    if (this.paused) {
      this.updatePause();
      return;
    }
    if (this.phase === 'play' && !this.match.demo && input.systemPausePressed()) {
      this.paused = true;
      this.pauseSel = 0;
      this.app.audio.sfx('pause');
      return;
    }
    const w = this.world;
    for (const b of w.bombers) {
      const cpu = this.cpus.get(b.id);
      if (this.phase !== 'play') {
        b.intent = NO_INTENT;
      } else if (cpu) {
        b.intent = cpu.think();
      } else {
        const c = input.players[b.id];
        b.intent = { dirs: c.dirs, bomb: c.pressed('a'), special: c.pressed('b'), specialHeld: c.held('b'), bombHeld: c.held('a'), action: c.pressed('c') };
      }
    }
    w.update();
    for (const e of w.events) this.onEvent(e);
    for (const p of this.popups) p.t++;
    this.popups = this.popups.filter((p) => p.t < 70);
    if (this.banner) {
      this.banner.t++;
      if (this.banner.t > 100) this.banner = null;
    }
    if (this.phase === 'play' && w.result) {
      this.phase = 'end';
      this.t = 0;
      if (w.result.draw) {
        this.app.audio.music('draw', { restart: true });
      } else {
        this.app.audio.music('victory', { restart: true });
      }
    }
    if (this.phase === 'end' && this.t > 200) this.match.roundOver(this.world);
  }

  private updatePause(): void {
    const pad = this.app.input.menu;
    if (pad.repeat('up') || pad.repeat('down')) {
      this.pauseSel = 1 - this.pauseSel;
      this.app.audio.sfx('menuMove');
    }
    if (pad.pressed('a') || pad.pressed('start')) {
      pad.swallow();
      if (this.pauseSel === 0) {
        this.paused = false;
        this.app.audio.sfx('pause');
      } else {
        this.app.audio.sfx('menuBack');
        this.match.quit();
      }
    } else if (pad.pressed('b') || pad.pressed('select')) {
      this.paused = false;
    }
  }

  private onEvent(e: GameEvent): void {
    const a = this.app.audio;
    switch (e.type) {
      case 'bomb':
        a.sfx('place');
        break;
      case 'explode':
        a.sfx('explode');
        this.shake = Math.max(this.shake, e.size > 8 ? 6 : 3);
        break;
      case 'item':
        a.sfx(e.item.startsWith('partner') ? 'bigItem' : 'item');
        break;
      case 'skull': {
        a.sfx('skull');
        const b = this.world.bomber(e.who);
        if (b) this.popups.push({ text: DISEASE_NAMES[e.curse as keyof typeof DISEASE_NAMES] ?? 'SICK!', x: b.x, y: b.y - 20, t: 0, color: '#d080ff' });
        break;
      }
      case 'death':
        a.sfx('die');
        break;
      case 'kick':
        a.sfx('kick');
        break;
      case 'punch':
        a.sfx('punch');
        break;
      case 'bounce':
        a.sfx('bounce');
        break;
      case 'stun':
        a.sfx('stun');
        break;
      case 'warp':
        a.sfx('warp');
        break;
      case 'jump':
        a.sfx('jump');
        break;
      case 'land':
        a.sfx('land');
        break;
      case 'pressure':
        a.sfx('block');
        break;
      case 'shake':
        this.shake = Math.max(this.shake, e.frames);
        break;
      case 'hurry':
        a.sfx('hurry');
        a.tempo(1.25);
        this.banner = { text: 'HURRY!', t: 0, color: '#ff6040' };
        break;
      case 'timeUp':
        a.sfx('timeUp');
        this.banner = { text: "TIME'S UP!", t: 0, color: '#ffe040' };
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------ rendering

  render(g: Gfx): void {
    const w = this.world;
    const theme = THEMES[w.arena.theme] ?? THEMES.battle;
    g.clear(theme.backdrop);
    const sy = this.shake > 0 ? (this.shake % 2 ? 1 : -1) : 0;
    const v: View = { ox: OX, oy: OY + sy, x0: 0, x1: w.grid.w * TILE };
    hudStrip(g, theme, HUD_H);
    this.renderer.draw(g, v, this.app.frame, true);
    this.renderHud(g);
    this.renderer.drawCarts(g, v, this.app.frame);
    for (const p of this.popups) g.text(p.text, v.ox + p.x, v.oy + p.y - p.t / 3, { align: 'center', color: p.color, outline: '#000000' });
    if (this.phase === 'ready') drawBanner(g, this.t < 60 ? 'READY' : 'START!', g.height / 2 + 6, this.t < 60 ? '#ffe040' : '#ff6040');
    if (this.banner && this.banner.t < 90) drawBanner(g, this.banner.text, g.height / 2 + 6, this.banner.color);
    if (this.phase === 'end' && w.result && this.t > 20) {
      const r = w.result;
      let text = 'DRAW GAME';
      if (!r.draw) text = this.match.cfg.tag ? `TEAM ${r.team === 0 ? 'A' : 'B'} WINS!` : `PLAYER ${(r.winner ?? 0) + 1} WINS!`;
      drawBanner(g, text, g.height / 2 + 6, r.draw ? '#a0c0ff' : '#ffe040');
    }
    if (this.match.demo && Math.floor(this.app.frame / 30) % 2 === 0) {
      g.text('DEMO PLAY', g.width / 2, g.height - 12, { align: 'center', color: '#ffe040', outline: '#000000' });
    }
    if (this.paused) {
      g.ctx.globalAlpha = 0.55;
      g.rect(0, 0, g.width, g.height, '#000000');
      g.ctx.globalAlpha = 1;
      drawBanner(g, 'PAUSE!', 86, '#ffe040');
      ['CONTINUE', 'QUIT'].forEach((o, i) => {
        const sel = i === this.pauseSel;
        g.text((sel ? '▶ ' : '  ') + o, g.width / 2 - 30, 116 + i * 14, { color: sel ? '#ffe040' : '#ffffff', outline: '#000000' });
      });
    }
  }

  private renderHud(g: Gfx): void {
    const w = this.world;
    const icons = hudIcons();
    const txt = { color: '#ffffff', outline: '#000000' };
    g.image(icons.clock, 8, 9);
    const hurry = w.hurry && Math.floor(this.app.frame / 15) % 2 === 0;
    g.text(w.unlimited ? '∞' : clockText(w.timeLeft), 20, 10, { ...txt, color: hurry ? '#ff4040' : '#ffffff' });
    const cfg = this.match.cfg;
    let x = 60;
    for (let i = 0; i < 5; i++) {
      if (cfg.players[i].type === 'off') continue;
      const b = w.bomber(i);
      const dead = !b || !b.alive;
      const head = b?.gold ? icons.gold : dead ? icons.crying[i] : icons.heads[i];
      g.image(head, x, 8);
      const wins = cfg.tag ? this.match.teamWins[cfg.players[i].team] : this.match.wins[i];
      g.text(String(wins), x + 12, 10, { ...txt, color: dead ? '#808090' : '#ffffff' });
      if (cfg.tag) g.rect(x, 19, 10, 2, cfg.players[i].team === 0 ? '#ff5050' : '#5080ff');
      x += 38;
    }
  }
}
