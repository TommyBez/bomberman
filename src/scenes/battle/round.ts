import type { App } from '../../app';
import { BATTLE_STAGE_MUSIC } from '../../audio/battleSongs';
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
import { characterHead, characterSprites, gimmickSprites } from '../../gfx/battleSprites';
import { THEMES } from '../../gfx/tiles';
import { BattleRenderer } from '../../render/battleField';
import type { View } from '../../render/field';
import { clockText, HUD_DIM, HUD_HURRY, HUD_TEXT, hudIcons, hudStrip } from '../../render/hud';
import { CommandsHelp } from '../../render/commands';
import { drawWord, PauseMenu, type WordStyle } from '../../render/ui';
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
  private readonly pauseMenu: PauseMenu;
  /** Commands reference, opened from the pause menu. */
  private help: CommandsHelp | null = null;
  private banner: { text: string; t: number; style: WordStyle } | null = null;
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
    this.pauseMenu = new PauseMenu(app);
    // Build this round's sprites now (during the menu fade), not on its first frames.
    gimmickSprites();
    for (const b of this.world.bombers) characterSprites(b.character, b.id, b.gold);
    const cfg = match.cfg;
    for (const b of this.world.bombers) {
      const slot = cfg.players[b.id];
      if (slot.type === 'com') this.cpus.set(b.id, new CpuPlayer(this.world, b, cfg.rules.com));
      else this.app.input.players[b.id].devices = [...slot.devices];
    }
  }

  enter(): void {
    this.app.audio.music(BATTLE_STAGE_MUSIC[this.world.arena.id] ?? 'battle', { restart: true });
    for (const c of this.app.input.players) c.swallow();
    this.app.input.takeFocusLoss();
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
    const focusLost = input.takeFocusLoss() && this.cpus.size < this.world.bombers.length;
    if (this.phase === 'play' && !this.match.demo && (input.systemPausePressed() || focusLost)) {
      this.paused = true;
      this.pauseMenu.reset();
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
        b.intent = { dirs: c.dirs, bomb: c.pressed('a'), special: c.pressed('b'), specialHeld: c.held('b'), bombHeld: c.held('a'), action: c.pressed('c'), stop: c.pressed('d') };
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
    if (this.help) {
      if (this.help.update(pad, (n) => this.app.audio.sfx(n))) this.help = null;
      return;
    }
    const choice = this.pauseMenu.update(pad);
    if (choice === 'continue') {
      this.paused = false;
      this.app.audio.sfx('pause');
    } else if (choice === 'commands') {
      this.help = new CommandsHelp();
    } else if (choice === 'quit') {
      this.app.audio.sfx('menuBack');
      this.match.abandon();
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
        this.rumbleHumans(0.3, 80);
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
        if (!this.cpus.has(e.who)) this.app.input.rumble(this.app.input.players[e.who]?.devices ?? [], 1, 400);
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
        this.banner = { text: 'HURRY!', t: 0, style: 'hurry' };
        break;
      case 'timeUp':
        a.sfx('timeUp');
        this.banner = { text: "TIME'S UP!", t: 0, style: 'timeUp' };
        break;
      default:
        break;
    }
  }

  /** Vibration for every human player's gamepad. */
  private rumbleHumans(strength: number, ms: number): void {
    for (const b of this.world.bombers) if (!this.cpus.has(b.id)) this.app.input.rumble(this.app.input.players[b.id].devices, strength, ms);
  }

  // ------------------------------------------------------------------ rendering

  render(g: Gfx): void {
    const w = this.world;
    const theme = THEMES[w.arena.theme] ?? THEMES.battle;
    g.clear(theme.backdrop);
    const sy = this.shake > 0 ? (this.shake % 2 ? 1 : -1) : 0;
    const v: View = { ox: OX, oy: OY + sy, x0: 0, x1: w.grid.w * TILE };
    hudStrip(g, theme, HUD_H, OX, OX, OX + w.grid.w * TILE);
    this.renderer.draw(g, v, this.app.frame, true);
    this.renderHud(g);
    this.renderer.drawCarts(g, v, this.app.frame);
    for (const p of this.popups) g.text(p.text, v.ox + p.x, v.oy + p.y - p.t / 3, { align: 'center', color: p.color, outline: '#000000' });
    if (this.phase === 'ready') drawWord(g, this.t < 60 ? 'READY' : 'START', g.height / 2 + 6, 'ready');
    if (this.banner && this.banner.t < 90) drawWord(g, this.banner.text, g.height / 2 + 6, this.banner.style);
    // The winner's cheer says it all (the results come next); a time-up says so, as the
    // original does, and a draw gets its own screen.
    if (this.phase === 'end' && w.result?.draw && w.result.timeUp && this.t > 20) drawWord(g, "TIME'S UP!", g.height / 2 + 6, 'timeUp');
    if (this.match.demo && Math.floor(this.app.frame / 30) % 2 === 0) {
      drawWord(g, 'DEMO PLAY', g.height - 14, 'demo');
    }
    if (this.paused) {
      if (this.help) this.help.draw(g, true);
      else this.pauseMenu.draw(g);
    }
  }

  private renderHud(g: Gfx): void {
    const w = this.world;
    const icons = hudIcons();
    g.image(icons.clock, 8, 9);
    const hurry = w.hurry && Math.floor(this.app.frame / 15) % 2 === 0;
    g.text(w.unlimited ? '∞' : clockText(w.timeLeft), 20, 10, hurry ? HUD_HURRY : HUD_TEXT);
    const cfg = this.match.cfg;
    // Each player's own character, then their wins.
    let x = 56;
    for (let i = 0; i < 5; i++) {
      if (cfg.players[i].type === 'off') continue;
      const b = w.bomber(i);
      const dead = !b || !b.alive;
      g.image(characterHead(cfg.players[i].character, i, !!b?.gold, dead), x, 4);
      const wins = cfg.tag ? this.match.teamWins[cfg.players[i].team] : this.match.wins[i];
      g.text(String(wins), x + 18, 10, dead ? HUD_DIM : HUD_TEXT);
      if (cfg.tag) g.rect(x + 2, 19, 12, 2, cfg.players[i].team === 0 ? '#ff5050' : '#5080ff');
      x += 38;
    }
  }
}
