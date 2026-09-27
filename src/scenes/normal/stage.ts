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
import { sprites } from '../../gfx/sprites';
import { THEMES, themeForStage } from '../../gfx/tiles';
import { FieldRenderer, type Actor, type View } from '../../render/field';
import { clockText, HUD_HURRY, HUD_TEXT, hudIcons, hudStrip } from '../../render/hud';
import { drawWord, PauseMenu } from '../../render/ui';

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
  private readonly pauseMenu: PauseMenu;
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
    this.pauseMenu = new PauseMenu(app);
    this.retro = session.version === 'retro';
    this.themeName = themeForStage(session.stageNumber, this.retro);
    this.field = new FieldRenderer(this.themeName, this.retro);
    this.world = new CampaignWorld(session.stage, session.powers, (Math.random() * 2 ** 31) | 0, bonus);
    this.updateCamera();
  }

  enter(): void {
    this.app.input.players[0].devices = [...ALL_DEVICES];
    this.app.input.takeFocusLoss();
    this.phase = 'card';
    this.timer = 0;
    this.app.audio.music(this.retro ? 'stageStartRetro' : 'stageStart', { restart: true });
  }

  private get music(): string {
    if (this.bonus) return this.retro ? 'bonusRetro' : 'bonus';
    if (this.retro) return 'stageRetro';
    // Each area of ten stages has its own theme.
    return ['stage', 'world2', 'world3', 'world4', 'world5'][Math.min(4, Math.floor((this.session.stageNumber - 1) / 10))];
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
    const focusLost = this.app.input.takeFocusLoss();
    if (this.phase === 'play' && (pad.pressed('start') || focusLost)) {
      this.paused = true;
      this.pauseMenu.reset();
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
        else if (!this.retro) this.app.audio.sfx('voiceClear');
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
    const choice = this.pauseMenu.update(this.app.input.players[0]);
    if (choice === 'continue') {
      this.paused = false;
      this.app.audio.sfx('pause');
    } else if (choice === 'quit') {
      this.app.audio.sfx('menuBack');
      this.app.audio.stopMusic();
      this.done('quit', this.world);
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
        this.app.input.rumble(this.app.input.players[0].devices, 0.35, 90);
        break;
      case 'item':
        a.sfx(e.item.startsWith('secret') ? 'bigItem' : 'item');
        // In the Modern version Bomberman speaks up when he gets an item.
        if (!this.retro) a.sfx('voiceItem');
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
    hudStrip(g, theme, HUD_H, v.ox);
    this.field.drawTiles(g, w, v, true);
    if (w.exitRevealed()) {
      const open = w.livingEnemies() === 0;
      const img = this.retro ? s.retroDoor : open ? s.doorOpen[Math.min(2, Math.floor(this.app.frame / 6) % 6 < 3 ? 2 : 1)] : s.door;
      g.image(img, v.ox + w.exitTx * TILE, v.oy + w.exitTy * TILE);
    }
    this.field.drawItems(g, w, v, this.app.frame, this.retro);
    // A hidden panel blinks for its last three seconds.
    if (w.secret.shown && (w.secret.left > 180 || Math.floor(this.app.frame / 4) % 2 === 0)) {
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
    if (this.phase === 'ready') drawWord(g, this.timer < 55 ? 'READY' : 'START', g.height / 2 + 6, 'ready');
    if (this.phase === 'clear' && this.bonus) drawWord(g, "TIME'S UP!", g.height / 2 + 6, 'timeUp');
    if (this.paused) this.pauseMenu.draw(g);
  }

  /** Score, clock, lives, bombs and fire. Retro uses the same bar as Modern, on its grey strip. */
  private renderHud(g: Gfx): void {
    const w = this.world;
    const icons = hudIcons();
    const y = 12;
    const score = this.session.score + w.score;
    g.text('SC', 6, y, HUD_TEXT);
    g.text(String(score).padStart(7, ' '), 20, y, HUD_TEXT);
    const hurry = !this.bonus && w.timeLeft <= 30 * 60 && Math.floor(this.app.frame / 15) % 2 === 0;
    g.image(icons.clock, 72, y - 1);
    g.text(clockText(w.timeLeft), 84, y, hurry ? HUD_HURRY : HUD_TEXT);
    if (this.bonus) g.text('BONUS', 118, y, Math.floor(this.app.frame / 20) % 2 ? HUD_TEXT : HUD_HURRY);
    else {
      g.image(icons.heads[0], 118, y - 2);
      g.text(`×${String(Math.max(0, this.session.lives)).padStart(2, '0')}`, 130, y, HUD_TEXT);
    }
    g.image(icons.bomb, 162, y - 2);
    g.text(`×${String(w.player.stats.bombs).padStart(2, '0')}`, 174, y, HUD_TEXT);
    g.image(icons.fire, 206, y - 2);
    g.text(`×${w.player.stats.fire}`, 218, y, HUD_TEXT);
  }

  private renderCard(g: Gfx): void {
    g.clear('#000000');
    if (this.retro) {
      // Plain white on black, like 1985.
      const text = this.bonus ? 'BONUS STAGE' : `STAGE ${String(this.session.stageNumber).padStart(2, ' ')}`;
      g.text(text, g.width / 2, g.height / 2 - 4, { align: 'center', color: '#fcfcfc' });
      return;
    }
    // A burst of blue light; Bomberman beams down into it as a streak of light, lands with
    // his back to us and turns round. Then the stage, in white on blue.
    const t = this.timer;
    drawLightBurst(g, g.width / 2, 92, t);
    const ctx = g.ctx;
    ctx.imageSmoothingEnabled = false;
    if (t < BEAM_TICKS) drawBeam(g, g.width / 2, 106 * (t / BEAM_TICKS), t);
    else {
      const walk = sprites().bombers[0].walk;
      const img = t < BEAM_TICKS + 22 ? walk.up[0] : t < BEAM_TICKS + 27 ? walk.left[0] : walk.down[0];
      ctx.drawImage(img, g.width / 2 - 16, 58, 32, 48);
      // The flash as he lands.
      const f = t - BEAM_TICKS;
      if (f < 8) {
        ctx.globalAlpha = 1 - f / 8;
        g.rect(g.width / 2 - 20 - f * 2, 56, 40 + f * 4, 52, '#ffffff');
        ctx.globalAlpha = 1;
      }
    }
    if (t >= BEAM_TICKS + 27) {
      const label = this.bonus ? 'BONUS' : `STAGE ${this.session.stageNumber}`;
      g.text(label, g.width / 2, 150, { align: 'center', scale: 2, color: '#ffffff', outline: '#1848a8' });
      if (!this.bonus) {
        g.image(hudIcons().heads[0], g.width / 2 - 20, 176);
        g.text(`× ${String(Math.max(0, this.session.lives)).padStart(2, '0')}`, g.width / 2 - 6, 178, { color: '#ffffff', outline: '#1848a8' });
      }
    }
  }
}

/** Ticks Bomberman takes to beam down on the stage card. */
const BEAM_TICKS = 24;

/** Bomberman beaming down: a streak of white light with pink and red edges, its foot at y. */
function drawBeam(g: Gfx, cx: number, y: number, t: number): void {
  const top = y - 90;
  const bands: [number, string][] = [
    [9, '#c02858'],
    [7, '#ff6090'],
    [5, '#ffc0d8'],
    [2, '#ffffff'],
  ];
  for (const [half, color] of bands) g.rect(cx - half, top, half * 2, y - top, color);
  // Sparks thrown off either side.
  for (let k = 0; k < 6; k++) {
    const sy = top + ((t * 7 + k * 31) % Math.max(1, y - top));
    const sx = cx + (k % 2 ? 1 : -1) * (11 + ((t + k * 5) % 5));
    g.rect(sx, sy, 2, 2, k % 3 ? '#ffffff' : '#ffc0e0');
  }
}

/** Rays of pale light spreading from a bright centre into deep blue, turning slowly. */
function drawLightBurst(g: Gfx, cx: number, cy: number, t: number): void {
  const ctx = g.ctx;
  const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 190);
  glow.addColorStop(0, '#f4ffff');
  glow.addColorStop(0.12, '#9cecfc');
  glow.addColorStop(0.35, '#2aa8e0');
  glow.addColorStop(0.7, '#1466b8');
  glow.addColorStop(1, '#0a3478');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, g.width, g.height);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#e8ffff';
  const turn = t / 240;
  for (let k = 0; k < 14; k++) {
    const a = turn + (k * Math.PI * 2) / 14;
    const spread = 0.07 + (k % 3) * 0.025;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a - spread) * 260, cy + Math.sin(a - spread) * 260);
    ctx.lineTo(cx + Math.cos(a + spread) * 260, cy + Math.sin(a + spread) * 260);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
