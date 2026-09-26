import type { App } from '../../app';
import { HUD_H } from '../../config';
import type { Gfx } from '../../engine/gfx';
import { ALL_DEVICES } from '../../engine/input';
import type { Scene } from '../../engine/scene';
import { CampaignWorld, ENEMY_DEATH_TICKS } from '../../game/campaign/campaignWorld';
import type { CampaignSession } from '../../game/campaign/session';
import type { BonusStageDef } from '../../game/campaign/stages';
import type { GameEvent } from '../../game/core/events';
import { TILE } from '../../game/core/types';
import { THEMES, themeForStage } from '../../gfx/tiles';
import { FieldRenderer, type Actor, type View } from '../../render/field';
import { clockText, hudIcons, hudStrip } from '../../render/hud';
import { drawBanner } from '../../render/ui';

type Phase = 'card' | 'ready' | 'play' | 'dying' | 'clear';

export type StageExit = 'clear' | 'dead' | 'quit';

const CARD_TICKS = 150;
const READY_TICKS = 90;
const DYING_TICKS = 190;
const CLEAR_TICKS = 210;
/** Top of the field on screen: the top wall row hides under the HUD strip. */
const FIELD_OY = HUD_H - TILE;

/** One Normal Game stage (or bonus stage) from the stage card to clear / miss. */
export class StageScene implements Scene {
  private world: CampaignWorld;
  private phase: Phase = 'card';
  private timer = 0;
  private paused = false;
  private pauseSel = 0;
  private camX = 0;
  private shake = 0;
  private readonly field: FieldRenderer;
  private readonly retro: boolean;
  private readonly themeName: string;

  constructor(
    private readonly app: App,
    private readonly session: CampaignSession,
    private readonly bonus: BonusStageDef | null,
    private readonly done: (exit: StageExit, world: CampaignWorld) => void,
  ) {
    this.retro = session.version === 'retro';
    this.themeName = themeForStage(session.stageNumber, this.retro);
    this.field = new FieldRenderer(this.themeName, this.retro);
    this.world = new CampaignWorld(session.stage, session.powers, (Math.random() * 2 ** 31) | 0, bonus);
    this.updateCamera();
  }

  enter(): void {
    this.app.input.players[0].devices = [...ALL_DEVICES];
    this.phase = 'card';
    this.timer = 0;
    this.app.audio.music(this.retro ? 'stageStartRetro' : 'stageStart', { restart: true });
  }

  private get music(): string {
    if (this.bonus) return this.retro ? 'bonusRetro' : 'bonus';
    return this.retro ? 'stageRetro' : 'stage';
  }

  update(): void {
    const pad = this.app.input.players[0];
    this.timer++;
    if (this.shake > 0) this.shake--;

    if (this.phase === 'card') {
      if (this.timer >= CARD_TICKS || (this.timer > 30 && (pad.pressed('start') || pad.pressed('a')))) {
        this.phase = 'ready';
        this.timer = 0;
      }
      return;
    }
    if (this.phase === 'ready') {
      if (this.timer === 1) this.app.audio.music(this.music, { restart: true });
      if (this.timer >= READY_TICKS) {
        this.phase = 'play';
        this.timer = 0;
      }
      return;
    }

    if (this.paused) {
      this.updatePause();
      return;
    }
    if (this.phase === 'play' && pad.pressed('start')) {
      this.paused = true;
      this.pauseSel = 0;
      this.app.audio.sfx('pause');
      return;
    }

    const p = this.world.player;
    p.intent =
      this.phase === 'play'
        ? { dirs: pad.dirs, bomb: pad.pressed('a'), special: pad.pressed('b'), specialHeld: pad.held('b'), bombHeld: pad.held('a') }
        : { dirs: [], bomb: false, special: false, specialHeld: false, bombHeld: false };
    this.world.update();
    for (const e of this.world.events) this.onEvent(e);
    this.updateCamera();

    if (this.phase === 'play') {
      if (this.world.outcome === 'dead') {
        this.phase = 'dying';
        this.timer = 0;
        this.app.audio.stopMusic(0.05);
        this.app.audio.sfx('die');
        this.app.input.rumble(pad.devices, 1, 400);
      } else if (this.world.outcome === 'clear') {
        this.phase = 'clear';
        this.timer = 0;
        if (this.bonus) this.app.audio.sfx('timeUp');
        this.app.audio.music(this.retro ? 'stageClearRetro' : 'stageClear', { restart: true });
      }
      if (!this.bonus && this.world.timeLeft === 30 * 60) this.app.audio.tempo(1.2);
      return;
    }
    if (this.phase === 'dying') {
      if (this.timer === 60) this.app.audio.music(this.retro ? 'deathRetro' : 'death', { restart: true });
      if (this.timer >= DYING_TICKS) this.done('dead', this.world);
      return;
    }
    if (this.phase === 'clear' && this.timer >= CLEAR_TICKS) this.done('clear', this.world);
  }

  private updatePause(): void {
    const pad = this.app.input.players[0];
    if (pad.repeat('up') || pad.repeat('down')) {
      this.pauseSel = 1 - this.pauseSel;
      this.app.audio.sfx('menuMove');
    }
    if (pad.pressed('start') || pad.pressed('a')) {
      if (this.pauseSel === 0) {
        this.paused = false;
        this.app.audio.sfx('pause');
      } else {
        this.app.audio.sfx('menuBack');
        this.app.audio.stopMusic();
        this.done('quit', this.world);
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
        this.shake = Math.max(this.shake, e.size > 6 ? 6 : 4);
        break;
      case 'item':
        a.sfx(e.item.startsWith('secret') ? 'bigItem' : 'item');
        break;
      case 'enemyDeath':
        a.sfx('enemyDie');
        break;
      case 'doorOpen':
      case 'door':
        a.sfx('door');
        break;
      case 'spawn':
        a.sfx('spawn');
        break;
      case 'timeUp':
        a.sfx('timeUp');
        break;
      case 'block':
        break;
      default:
        break;
    }
  }

  private updateCamera(): void {
    const fieldW = this.world.grid.w * TILE;
    const w = this.app.gfx.width;
    this.camX = Math.max(0, Math.min(fieldW - w, Math.round(this.world.player.x) - w / 2));
  }

  // ------------------------------------------------------------------ rendering

  render(g: Gfx): void {
    if (this.phase === 'card') {
      this.renderCard(g);
      return;
    }
    const theme = THEMES[this.themeName];
    g.clear(theme.backdrop);
    const shakeY = this.shake > 0 ? (this.shake % 2 ? 1 : -1) : 0;
    const v: View = { ox: -this.camX, oy: FIELD_OY + shakeY, x0: this.camX, x1: this.camX + g.width };
    const w = this.world;
    const s = this.field.s;
    // The tall top wall (HUD strip) sits behind the field so heads in row 1 overlap it.
    hudStrip(g, theme, HUD_H);
    this.field.drawTiles(g, w, v, true);
    if (w.exitRevealed()) {
      const open = w.livingEnemies() === 0;
      const img = this.retro ? s.retroDoor : open ? s.doorOpen[Math.min(2, Math.floor(this.app.frame / 6) % 6 < 3 ? 2 : 1)] : s.door;
      g.image(img, v.ox + w.exitTx * TILE, v.oy + w.exitTy * TILE);
    }
    this.field.drawItems(g, w, v, this.app.frame, this.retro);
    if (w.secret.shown) {
      const items = this.retro ? s.retroItems : s.items;
      const flash = this.retro ? s.retroItemsFlash : s.itemsFlash;
      const key = `secret_${w.secret.panel}`;
      g.image((Math.floor(this.app.frame / 6) % 2 ? flash : items)[key], v.ox + w.secret.tx * TILE, v.oy + w.secret.ty * TILE);
    }
    this.field.drawFlames(g, w, v);
    const actors: Actor[] = [];
    this.field.bombActors(w, actors);
    for (const e of w.enemies) {
      const sp = (this.retro ? s.retroEnemies : s.enemies)[e.kind];
      if (!e.alive) {
        // Shrink away, then vanish (score floats up meanwhile).
        const t = e.deathTimer;
        if (t < ENEMY_DEATH_TICKS - 20) {
          const k = t < 30 ? 1 : 1 - (t - 30) / (ENEMY_DEATH_TICKS - 50);
          actors.push({
            y: e.y,
            draw: (gg, ox, oy) => {
              const size = Math.max(2, Math.round(16 * k));
              gg.ctx.drawImage(sp.dead, 0, 0, 16, 16, Math.round(ox + e.x - size / 2), Math.round(oy + e.y + 8 - size), size, size);
            },
          });
        } else {
          const f = Math.min(3, Math.floor((t - (ENEMY_DEATH_TICKS - 20)) / 5));
          actors.push({ y: e.y, draw: (gg, ox, oy) => gg.image(s.puff[f], ox + e.x - 8, oy + e.y - 8) });
        }
        continue;
      }
      const frames = e.dir === 'left' || e.dir === 'up' ? sp.left : sp.right;
      const img = frames[Math.floor(e.anim / 10) % frames.length];
      const blink = e.grace > 0 && Math.floor(e.grace / 3) % 2 === 0;
      if (!blink) actors.push({ y: e.y, draw: (gg, ox, oy) => gg.image(img, ox + e.x - 8, oy + e.y - 8) });
    }
    const pa = this.field.bomberActor(w.player, 0, this.app.frame);
    if (pa && !(this.phase === 'clear' && !this.bonus && this.timer > 40)) actors.push(pa);
    this.field.drawActors(g, actors, v);
    for (const pop of w.popups) {
      g.text(String(pop.points), v.ox + pop.x, v.oy + pop.y - 12 - pop.age / 4, { align: 'center', color: '#ffffff', outline: '#000000' });
    }
    this.renderHud(g);
    if (this.phase === 'ready') {
      const txt = this.timer < 55 ? 'READY' : 'START!';
      drawBanner(g, txt, g.height / 2 + 6, this.timer < 55 ? '#ffe040' : '#ff6040');
    }
    if (this.phase === 'clear' && this.bonus) drawBanner(g, "TIME'S UP!", g.height / 2 + 6, '#ffe040');
    if (this.world.timeUp && this.phase === 'play' && this.world.tick % 60 < 40 && this.timer < 600) {
      // flashing warning after the clock ran out
    }
    if (this.paused) this.renderPause(g);
  }

  private renderHud(g: Gfx): void {
    if (this.retro) {
      this.renderRetroHud(g);
      return;
    }
    const w = this.world;
    const icons = hudIcons();
    const y = 12;
    const txt = { color: '#ffffff', outline: '#000000' };
    const score = this.session.score + w.score;
    g.text('SC', 6, y, { ...txt, color: '#ffe040' });
    g.text(String(score).padStart(7, ' '), 20, y, txt);
    const hurry = !this.bonus && w.timeLeft <= 30 * 60 && Math.floor(this.app.frame / 15) % 2 === 0;
    g.image(icons.clock, 72, y - 1);
    g.text(clockText(w.timeLeft), 84, y, { ...txt, color: hurry ? '#ff4040' : '#ffffff' });
    if (this.bonus) g.text('BONUS', 118, y, { ...txt, color: Math.floor(this.app.frame / 20) % 2 ? '#ffe040' : '#ff9020' });
    else {
      g.image(icons.heads[0], 118, y - 2);
      g.text(`×${String(Math.max(0, this.session.lives)).padStart(2, '0')}`, 130, y, txt);
    }
    g.image(icons.bomb, 162, y - 2);
    g.text(`×${String(w.player.stats.bombs).padStart(2, '0')}`, 174, y, txt);
    g.image(icons.fire, 206, y - 2);
    g.text(`×${w.player.stats.fire}`, 218, y, txt);
  }

  /** The 1985 status bar: TIME, score and LEFT in black on the grey strip. */
  private renderRetroHud(g: Gfx): void {
    const w = this.world;
    const y = 12;
    const txt = { color: '#000000' };
    const secs = Math.max(0, Math.ceil(w.timeLeft / 60));
    const hurry = !this.bonus && secs <= 30 && Math.floor(this.app.frame / 15) % 2 === 0;
    g.text(this.bonus ? 'BONUS' : 'TIME', 8, y, txt);
    g.text(String(secs).padStart(3, ' '), 44, y, { color: hurry ? '#d82800' : '#000000' });
    g.text(String(this.session.score + w.score), 164, y, { ...txt, align: 'right' });
    g.text(`LEFT ${Math.max(0, this.session.lives)}`, 200, y, txt);
  }

  private renderCard(g: Gfx): void {
    g.clear('#000000');
    if (this.bonus && this.retro) {
      g.text('BONUS STAGE', g.width / 2, g.height / 2 - 4, { align: 'center', color: '#fcfcfc' });
      return;
    }
    if (this.bonus) {
      g.text('BONUS STAGE', g.width / 2, g.height / 2 - 20, { align: 'center', scale: 2, gradient: ['#fff8a0', '#ff9020'], outline: '#401000' });
      g.text('DEFEAT AS MANY MONSTERS', g.width / 2, g.height / 2 + 10, { align: 'center', color: '#ffffff' });
      g.text('AS YOU CAN IN 30 SECONDS!', g.width / 2, g.height / 2 + 22, { align: 'center', color: '#ffffff' });
      return;
    }
    const n = this.session.stageNumber;
    if (this.retro) {
      // Plain white on black, like 1985.
      g.text(`STAGE ${String(n).padStart(2, ' ')}`, g.width / 2, g.height / 2 - 4, { align: 'center', color: '#fcfcfc' });
      return;
    }
    g.text(`STAGE ${n}`, g.width / 2, g.height / 2 - 12, { align: 'center', scale: 2, gradient: ['#ffffff', '#a0c8ff'], outline: '#102040' });
    const icons = hudIcons();
    g.image(icons.heads[0], g.width / 2 - 20, g.height / 2 + 14);
    g.text(`× ${String(Math.max(0, this.session.lives)).padStart(2, '0')}`, g.width / 2 - 6, g.height / 2 + 16, { color: '#ffffff' });
  }

  private renderPause(g: Gfx): void {
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
