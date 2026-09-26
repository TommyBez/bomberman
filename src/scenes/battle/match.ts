import type { App } from '../../app';
import { mix, type Gfx } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import { arenaFor } from '../../game/battle/arenas';
import { altUnlocked } from '../../game/battle/unlocks';
import type { BattleWorld } from '../../game/battle/battleWorld';
import { CHARACTERS } from '../../game/battle/characters';
import { ITEM_NAMES, type BattleConfig, type BattleItem } from '../../game/battle/config';
import { characterSprites } from '../../gfx/battleSprites';
import { PixelCanvas } from '../../gfx/pixel';
import { sprites } from '../../gfx/sprites';
import { hudIcons } from '../../render/hud';
import { drawMenuBackdrop, drawPanel, drawTitleBar, Menu } from '../../render/ui';
import { goMainMenu, goTitle } from '../nav';
import { BattleRoundScene } from './round';

/** A set of games: rounds until someone (or a team) reaches the required wins. */
export class BattleMatch {
  wins = [0, 0, 0, 0, 0];
  teamWins = [0, 0];
  readonly report: number[][] = [0, 1, 2, 3, 4].map(() => [0, 0, 0, 0, 0]);
  prizes: (BattleItem | null)[] = [null, null, null, null, null];
  gold = [false, false, false, false, false];
  games = 0;
  draws = 0;

  constructor(
    private readonly app: App,
    readonly cfg: BattleConfig,
    private readonly onChangeStage: () => void,
    /** Attract mode: a single all-CPU game that any button interrupts. */
    readonly demo = false,
  ) {}

  start(): void {
    this.playRound();
  }

  playRound(): void {
    const arena = arenaFor(this.cfg.level, this.cfg.stage, !!this.cfg.alternate && altUnlocked(this.cfg.level));
    const prizes = this.prizes;
    const gold = this.gold;
    this.prizes = [null, null, null, null, null];
    this.gold = [false, false, false, false, false];
    this.app.scenes.go(new BattleRoundScene(this.app, this, arena, prizes, gold));
  }

  /** QUIT on the victory screen: back to the main menu, cursor on BATTLE GAME. */
  quit(): void {
    this.app.audio.stopMusic();
    goMainMenu(this.app, 1);
  }

  /** START → QUIT → YES during play is a soft reset: back to the title screen. */
  abandon(): void {
    this.app.audio.stopMusic();
    goTitle(this.app);
  }

  /** Called by the round scene when a game is over. */
  roundOver(w: BattleWorld): void {
    if (this.demo) {
      goTitle(this.app);
      return;
    }
    const r = w.result!;
    let winnerSlot: number | null = null;
    // A draw is void: it counts as no game at all.
    if (!r.draw) {
      this.games++;
      for (let k = 0; k < 5; k++) for (let v = 0; v < 5; v++) this.report[k][v] += w.report[k][v];
    }
    if (r.draw) this.draws++;
    else if (this.cfg.tag && r.team !== null) this.teamWins[r.team]++;
    else if (r.winner !== null) {
      this.wins[r.winner]++;
      winnerSlot = r.winner;
    }
    const results = new ResultsScene(this.app, this, r.draw, winnerSlot, r.team);
    this.app.scenes.go(r.draw ? new DrawScene(this.app, this, () => this.app.scenes.go(results)) : results);
  }

  get champion(): { slot: number | null; team: number | null } | null {
    const need = this.cfg.rules.wins;
    if (this.cfg.tag) {
      const t = this.teamWins.findIndex((n) => n >= need);
      return t >= 0 ? { slot: null, team: t } : null;
    }
    const s = this.wins.findIndex((n) => n >= need);
    return s >= 0 ? { slot: s, team: null } : null;
  }

  /** After the results (and the optional Hyper Bomber): next game or the victory screen. */
  continueAfterResults(winnerSlot: number | null): void {
    const champ = this.champion;
    if (champ) {
      this.app.scenes.go(new VictoryScene(this.app, this, champ.slot, champ.team));
      return;
    }
    if (winnerSlot !== null && this.cfg.rules.hyperBomber && !this.cfg.tag) {
      this.app.scenes.go(new HyperBomberScene(this.app, this, winnerSlot));
      return;
    }
    this.playRound();
  }

  playAgain(): void {
    this.wins = [0, 0, 0, 0, 0];
    this.teamWins = [0, 0];
    for (const row of this.report) row.fill(0);
    this.games = 0;
    this.playRound();
  }

  changeStage(): void {
    this.onChangeStage();
  }
}

// ------------------------------------------------------------------ results

class ResultsScene implements Scene {
  private t = 0;
  private showReport = false;

  constructor(
    private readonly app: App,
    private readonly match: BattleMatch,
    private readonly draw: boolean,
    private readonly winner: number | null,
    private readonly team: number | null,
  ) {}

  enter(): void {
    this.app.audio.music('select', { restart: true });
  }

  update(): void {
    this.t++;
    const pad = this.app.input.menu;
    if (pad.pressed('right') || pad.pressed('left')) {
      this.showReport = !this.showReport;
      this.app.audio.sfx('menuMove');
    }
    if (this.t > 40 && (pad.pressed('a') || pad.pressed('start'))) {
      pad.swallow();
      this.app.audio.sfx('menuOk');
      this.match.continueAfterResults(this.winner);
    }
  }

  render(g: Gfx): void {
    if (this.showReport) {
      this.renderReport(g);
      return;
    }
    drawMenuBackdrop(g, this.app.frame);
    const cfg = this.match.cfg;
    drawPanel(g, 14, 20, 228, 172, '#503080', '#281040');
    drawTitleBar(g, `${cfg.rules.wins} POINT MATCH`, this.app.frame);
    const slots = cfg.players.map((p, i) => ({ p, i })).filter(({ p }) => p.type !== 'off');
    const floor = 170;
    // Tag: two halves, one trophy pile per team.
    const place = (k: number): number => {
      if (!cfg.tag) return 128 + (k - (slots.length - 1) / 2) * 44;
      const team = slots[k].p.team;
      const mates = slots.filter(({ p }) => p.team === team);
      const m = mates.findIndex(({ i }) => i === slots[k].i);
      return (team === 0 ? 71 : 185) + (m - (mates.length - 1) / 2) * 30;
    };
    if (cfg.tag) {
      g.rect(127, 32, 2, 152, '#e050c8');
      g.text('TEAM A', 71, 36, { align: 'center', color: '#ff9090', outline: '#000000' });
      g.text('TEAM B', 185, 36, { align: 'center', color: '#90b0ff', outline: '#000000' });
    }
    const drop = Math.min(1, this.t / 40);
    const pile = (x: number, wins: number, fresh: boolean): void => {
      for (let n = 0; n < wins; n++) {
        let y = floor - 34 - n * 17;
        // This game's trophy drops onto the pile.
        if (fresh && n === wins - 1) y = Math.round(40 + (y - 40) * drop * drop);
        g.image(trophySprite(), x - 8, y);
      }
    };
    slots.forEach(({ p, i }, k) => {
      const x = place(k);
      const won = !this.draw && (cfg.tag ? this.team !== null && p.team === this.team : this.winner === i);
      const sp = characterSprites(p.character, i);
      const img = won ? sp.win[Math.floor(this.t / 12) % 2] : sp.walk.down[0];
      g.image(img, x - 8, floor - 8);
      g.text(`${i + 1}P`, x, floor + 18, { align: 'center', color: '#ffffff', outline: '#000000' });
      if (!cfg.tag) pile(x, this.match.wins[i], won);
    });
    if (cfg.tag) for (const team of [0, 1]) pile(team === 0 ? 71 : 185, this.match.teamWins[team], !this.draw && this.team === team);
    // The hand points on to the Battle Report.
    if (Math.floor(this.t / 20) % 2 === 0) g.text('\u2192', 248, 104, { align: 'center', scale: 2, color: '#ffe040', outline: '#401030' });
    g.text('A: NEXT', g.width / 2, 204, { align: 'center', color: '#ffffff', outline: '#401030' });
  }

  /** Who each player knocked out, and who knocked them out, one face per KO. */
  private renderReport(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    const cfg = this.match.cfg;
    drawPanel(g, 14, 20, 228, 172, '#503080', '#281040');
    drawTitleBar(g, 'BATTLE REPORT', this.app.frame);
    const slots = cfg.players.map((p, i) => ({ p, i })).filter(({ p }) => p.type !== 'off');
    const icons = hudIcons();
    const colW = 44;
    const x0 = 128 - (slots.length * colW) / 2;
    const rows = 5;
    slots.forEach(({ p, i }, k) => {
      const x = x0 + k * colW;
      // Portrait.
      g.rect(x + 2, 34, colW - 4, 30, '#182060');
      g.frame(x + 2, 34, colW - 4, 30, '#6080e0');
      g.image(characterSprites(p.character, i).walk.down[0], x + colW / 2 - 8, 37);
      // KO and KO'D columns.
      const half = (colW - 4) / 2;
      g.rect(x + 2, 66, half - 1, 12, '#c02040');
      g.rect(x + 2 + half, 66, half - 1, 12, '#3050c0');
      g.text('KO', x + 2 + half / 2, 69, { align: 'center', color: '#ffffff' });
      g.text('OUT', x + 2 + half * 1.5, 69, { align: 'center', color: '#ffffff' });
      const beat: number[] = [];
      const lost: number[] = [];
      for (let o = 0; o < 5; o++) {
        for (let n = 0; n < this.match.report[i][o]; n++) if (o !== i) beat.push(o);
        for (let n = 0; n < this.match.report[o][i]; n++) lost.push(o);
      }
      const list = (faces: number[], cx: number): void => {
        for (let r = 0; r < rows; r++) {
          const y = 80 + r * 20;
          g.frame(cx - 10, y, 20, 19, '#8070a0');
          if (r === rows - 1 && faces.length > rows) {
            g.text(`+${faces.length - rows + 1}`, cx, y + 6, { align: 'center', color: '#ffe040', outline: '#000000' });
          } else if (faces[r] !== undefined) g.image(icons.heads[faces[r]], cx - 5, y + 4);
        }
      };
      list(beat, x + 2 + half / 2);
      list(lost, x + 2 + half * 1.5);
    });
    if (Math.floor(this.app.frame / 20) % 2 === 0) g.text('\u2190', 8, 104, { align: 'center', scale: 2, color: '#ffe040', outline: '#401030' });
    g.text('A: NEXT', g.width / 2, 204, { align: 'center', color: '#ffffff', outline: '#401030' });
  }
}

let trophy: HTMLCanvasElement | null = null;

/** A gold cup, one per game won. */
function trophySprite(): HTMLCanvasElement {
  if (trophy) return trophy;
  const p = new PixelCanvas(16, 16);
  p.rows(
    [
      '..kkkkkkkkkkkk..',
      '.kkYYYyyyyyyykk.',
      'kykYYYyyyyyyykyk',
      'kykYYyyyyyyyykyk',
      'kykYYyyyyyyyykyk',
      '.kkkYyyyyyyykkk.',
      '...kyyyyyyyyk...',
      '....kyyyyyyk....',
      '.....kkyykk.....',
      '......kyyk......',
      '......kyyk......',
      '.....kyyyyk.....',
      '....kyyyyyyk....',
      '...kddddddddk...',
      '...kkkkkkkkkk...',
      '................',
    ],
    { k: '#402000', y: '#e8a818', Y: '#fff080', d: '#a86808' },
  );
  trophy = p.canvas;
  return trophy;
}

// ------------------------------------------------------------------ draw

/** "Draw": nobody won, the game doesn't count. Everyone lines up under a sunset sky. */
class DrawScene implements Scene {
  private t = 0;

  constructor(
    private readonly app: App,
    private readonly match: BattleMatch,
    private readonly next: () => void,
  ) {}

  enter(): void {
    this.app.audio.music('select', { restart: true });
  }

  update(): void {
    this.t++;
    const pad = this.app.input.menu;
    if (this.t > 40 && (pad.pressed('a') || pad.pressed('start'))) {
      pad.swallow();
      this.app.audio.sfx('menuOk');
      this.next();
    }
  }

  render(g: Gfx): void {
    for (let y = 0; y < g.height; y++) g.rect(0, y, g.width, 1, mix('#ffd860', '#f07818', y / g.height));
    // Sun glow and clouds.
    g.ctx.globalAlpha = 0.35;
    for (let r = 40; r > 0; r -= 8) {
      g.ctx.beginPath();
      g.ctx.arc(128, 96, r, 0, Math.PI * 2);
      g.ctx.fillStyle = '#fff8d0';
      g.ctx.fill();
    }
    g.ctx.globalAlpha = 1;
    const cloud = (cx: number, cy: number, w: number): void => {
      g.ctx.fillStyle = '#e8a060';
      for (let k = 0; k < 5; k++) {
        g.ctx.beginPath();
        g.ctx.ellipse(cx + (k - 2) * w * 0.22, cy + 3 + (k % 2) * 4, w * 0.2, w * 0.14, 0, 0, Math.PI * 2);
        g.ctx.fill();
      }
      g.ctx.fillStyle = '#fff4dc';
      for (let k = 0; k < 5; k++) {
        g.ctx.beginPath();
        g.ctx.ellipse(cx + (k - 2) * w * 0.22, cy + (k % 2) * 4, w * 0.19, w * 0.13, 0, 0, Math.PI * 2);
        g.ctx.fill();
      }
    };
    const drift = Math.sin(this.t / 90) * 3;
    cloud(44 + drift, 30, 90);
    cloud(212 - drift, 40, 80);
    // Flag poles either side.
    for (const x of [14, 238]) {
      g.rect(x, 20, 3, 150, '#ffffff');
      g.rect(x + 2, 20, 1, 150, '#c0c0c0');
      g.rect(x - 1, 16, 5, 5, '#e03030');
      const fx = x < 128 ? x + 3 : x - 21;
      const wave = Math.floor(this.t / 12) % 2;
      g.rect(fx, 24 + wave, 21, 16, '#fff8f0');
      g.frame(fx, 24 + wave, 21, 16, '#c04020');
      g.image(sprites().bomb[0], fx + 3, 24 + wave);
    }
    // A rail along the back of the stage, then the stage floor.
    g.rect(0, 150, g.width, 2, '#a05010');
    for (let x = 4; x < g.width; x += 12) g.rect(x, 150, 2, 20, '#a05010');
    g.rect(0, 168, g.width, 56, '#e8b068');
    for (let y = 176; y < g.height; y += 10) g.rect(0, y, g.width, 1, '#c88840');
    // The plate.
    const bob = Math.round(Math.sin(this.t / 20) * 2);
    g.ctx.fillStyle = '#c05018';
    for (const [dx, dy, r] of [[-78, 4, 22], [-44, -6, 26], [0, -10, 28], [44, -6, 26], [78, 4, 22], [-30, 14, 24], [30, 14, 24]]) {
      g.ctx.beginPath();
      g.ctx.arc(128 + dx, 110 + dy + bob, r + 2, 0, Math.PI * 2);
      g.ctx.fill();
    }
    g.ctx.fillStyle = '#fff4dc';
    for (const [dx, dy, r] of [[-78, 4, 22], [-44, -6, 26], [0, -10, 28], [44, -6, 26], [78, 4, 22], [-30, 14, 24], [30, 14, 24]]) {
      g.ctx.beginPath();
      g.ctx.arc(128 + dx, 110 + dy + bob, r, 0, Math.PI * 2);
      g.ctx.fill();
    }
    g.text('DRAW', 128, 96 + bob, { align: 'center', scale: 4, gradient: ['#ff8040', '#c01808'], outline: '#401000' });
    // Everybody, lined up.
    const slots = this.match.cfg.players.map((p, i) => ({ p, i })).filter(({ p }) => p.type !== 'off');
    slots.forEach(({ p, i }, k) => {
      const x = 128 + (k - (slots.length - 1) / 2) * 40;
      const sp = characterSprites(p.character, i);
      const step = Math.floor((this.t + k * 7) / 16) % 4;
      g.image(sp.walk.down[step === 1 ? 0 : step], x - 8, 172);
    });
    if (this.t > 40 && Math.floor(this.t / 30) % 2 === 0) g.text('THIS GAME DOES NOT COUNT', 128, 208, { align: 'center', color: '#ffffff', outline: '#602000' });
  }
}

// ------------------------------------------------------------------ Hyper Bomber

/** Hyper Bomber panels; Steel Shoes and Hearts are only won here (or set in Custom Battle). */
const PRIZES: BattleItem[] = ['bomb', 'fire', 'speed', 'geta', 'kick', 'bombpass', 'glove', 'punch', 'fullfire', 'heart', 'line', 'pierce', 'push'];

/** The winner throws a yo-yo at moving item panels to win an item for the next game. */
class HyperBomberScene implements Scene {
  private phase: 'ask' | 'play' | 'done' = 'ask';
  private sel = 0;
  private t = 0;
  private panels: { item: BattleItem; x: number }[] = [];
  private yoyo: { y: number; dir: number } | null = null;
  private hit: BattleItem | null = null;
  private throwsLeft = 3;
  private readonly cpu: boolean;
  private cpuDelay = 0;

  constructor(
    private readonly app: App,
    private readonly match: BattleMatch,
    private readonly slot: number,
  ) {
    this.cpu = match.cfg.players[slot].type === 'com';
    const shuffled = [...PRIZES].sort(() => Math.random() - 0.5);
    this.panels = shuffled.slice(0, 6).map((item, i) => ({ item, x: i * 44 }));
    this.cpuDelay = 30 + Math.floor(Math.random() * 60);
  }

  enter(): void {
    this.app.audio.music('bonus', { restart: true });
  }

  update(): void {
    this.t++;
    const pad = this.cpu ? null : this.app.input.players[this.slot];
    const menu = this.app.input.menu;
    if (this.phase === 'ask') {
      if (this.cpu) {
        if (this.t > 40) this.phase = 'play';
        return;
      }
      if (menu.pressed('left') || menu.pressed('right') || menu.pressed('up') || menu.pressed('down')) {
        this.sel = 1 - this.sel;
        this.app.audio.sfx('menuMove');
      }
      if (menu.pressed('a') || menu.pressed('start')) {
        menu.swallow();
        this.app.audio.sfx('menuOk');
        if (this.sel === 0) this.phase = 'play';
        else this.match.continueAfterResults(null);
      }
      return;
    }
    // Panels glide across the screen.
    for (const p of this.panels) p.x = (p.x + 1.4) % 264;
    if (this.phase === 'done') {
      if (this.t > 120 || menu.pressed('start')) {
        // Win or miss, the challenger turns gold for the next game.
        if (this.hit) this.match.prizes[this.slot] = this.hit;
        this.match.gold[this.slot] = true;
        this.match.playRound();
      }
      return;
    }
    const throwNow = this.cpu ? --this.cpuDelay <= 0 : !!pad && (pad.pressed('a') || pad.pressed('b') || menu.pressed('a'));
    if (!this.yoyo && throwNow && this.throwsLeft > 0) {
      this.yoyo = { y: 180, dir: -1 };
      this.throwsLeft--;
      this.cpuDelay = 40 + Math.floor(Math.random() * 60);
      this.app.audio.sfx('punch');
    }
    if (this.yoyo) {
      this.yoyo.y += this.yoyo.dir * 5;
      if (this.yoyo.dir < 0 && this.yoyo.y <= 72) {
        // Did it hit a panel?
        const hitPanel = this.panels.find((p) => Math.abs(p.x - 8 - 120) < 12);
        if (hitPanel) {
          this.hit = hitPanel.item;
          this.phase = 'done';
          this.t = 0;
          this.app.audio.sfx('bigItem');
        }
        this.yoyo.dir = 1;
      }
      if (this.yoyo.y >= 180) {
        this.yoyo = null;
        if (this.throwsLeft === 0 && this.phase === 'play') {
          this.phase = 'done';
          this.t = 0;
          this.app.audio.sfx('menuBack');
        }
      }
    }
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'HYPER BOMBER', this.app.frame);
    const p = this.match.cfg.players[this.slot];
    const sp = characterSprites(p.character, this.slot, this.hit !== null);
    if (this.phase === 'ask') {
      drawPanel(g, 32, 60, 192, 100, '#a07820', '#402800');
      g.text(`PLAYER ${this.slot + 1}`, g.width / 2, 70, { align: 'center', color: '#ffe040', outline: '#000000' });
      g.text('CHALLENGE HYPER BOMBER?', g.width / 2, 88, { align: 'center', color: '#ffffff', outline: '#000000' });
      g.image(sp.walk.down[Math.floor(this.app.frame / 8) % 4], g.width / 2 - 8, 100);
      ['YES', 'NO'].forEach((o, i) => {
        const x = g.width / 2 - 30 + i * 60;
        g.text((i === this.sel ? '▶' : ' ') + o, x, 140, { align: 'center', color: i === this.sel ? '#ffe040' : '#ffffff', outline: '#000000' });
      });
      return;
    }
    // Panel rail
    g.rect(0, 50, g.width, 30, '#201000');
    const items = sprites().items;
    for (const pn of this.panels) {
      const x = pn.x - 8;
      g.image(items[pn.item], x - 8, 56);
      g.image(items[pn.item], x - 8 - 264, 56);
    }
    g.rect(120, 48, 16, 2, '#ff4040');
    // Thrower
    g.image(sp.walk.up[0], 120, 184);
    if (this.yoyo) {
      g.rect(128, this.yoyo.y, 1, 184 - this.yoyo.y, '#ffffff');
      g.ctx.fillStyle = '#e02020';
      g.ctx.beginPath();
      g.ctx.arc(128.5, this.yoyo.y, 4, 0, Math.PI * 2);
      g.ctx.fill();
    }
    g.text(`THROWS: ${this.throwsLeft}`, 8, 34, { color: '#ffffff', outline: '#000000' });
    if (this.phase === 'done') {
      drawPanel(g, 40, 100, 176, 50, '#a07820', '#402800');
      if (this.hit) {
        g.text('GOT IT!', g.width / 2, 108, { align: 'center', scale: 2, color: '#ffe040', outline: '#000000' });
        g.text(ITEM_NAMES[this.hit], g.width / 2, 130, { align: 'center', color: '#ffffff', outline: '#000000' });
      } else {
        g.text('TOO BAD!', g.width / 2, 116, { align: 'center', scale: 2, color: '#ffffff', outline: '#000000' });
      }
    } else if (!this.cpu) {
      g.text('A: THROW THE YO-YO!', g.width / 2, 160, { align: 'center', color: '#fff0a0', outline: '#000000' });
    }
  }
}

// ------------------------------------------------------------------ victory

class VictoryScene implements Scene {
  private t = 0;
  private readonly menu: Menu;
  private confetti: { x: number; y: number; vy: number; c: string }[] = [];

  constructor(
    private readonly app: App,
    private readonly match: BattleMatch,
    private readonly slot: number | null,
    private readonly team: number | null,
  ) {
    this.menu = new Menu(app, [
      { label: 'PLAY AGAIN', action: () => this.match.playAgain() },
      { label: 'CHANGE STAGE', action: () => this.match.changeStage() },
      { label: 'QUIT', action: () => this.match.quit() },
    ]);
    for (let i = 0; i < 60; i++) this.confetti.push({ x: Math.random() * 256, y: Math.random() * -224, vy: 0.5 + Math.random(), c: ['#ff5050', '#ffe040', '#50c0ff', '#80ff80', '#ff80ff'][i % 5] });
  }

  enter(): void {
    this.app.audio.music('champion', { restart: true });
  }

  update(): void {
    this.t++;
    for (const c of this.confetti) {
      c.y += c.vy;
      c.x += Math.sin((c.y + this.t) / 20) * 0.3;
      if (c.y > 224) c.y = -4;
    }
    if (this.t > 90) this.menu.update();
  }

  render(g: Gfx): void {
    for (let y = 0; y < g.height; y++) g.rect(0, y, g.width, 1, mix('#402080', '#f0a020', y / g.height));
    for (const c of this.confetti) g.rect(c.x, c.y, 2, 3, c.c);
    g.text('VICTORY', g.width / 2, 20, { align: 'center', scale: 3, gradient: ['#ffffff', '#ffd040'], outline: '#401000' });
    const cfg = this.match.cfg;
    const winners = cfg.players.map((p, i) => ({ p, i })).filter(({ p, i }) => p.type !== 'off' && (this.team !== null ? p.team === this.team : i === this.slot));
    winners.forEach(({ p, i }, k) => {
      const sp = characterSprites(p.character, i);
      const img = sp.win[Math.floor(this.t / 12) % 2];
      const x = g.width / 2 - (winners.length * 40) / 2 + k * 40 + 4;
      g.ctx.imageSmoothingEnabled = false;
      g.ctx.drawImage(img, x, 64, 32, 48);
    });
    const name = this.team !== null ? `TEAM ${this.team === 0 ? 'A' : 'B'}` : `PLAYER ${(this.slot ?? 0) + 1}  ${CHARACTERS[cfg.players[this.slot ?? 0].character]?.name ?? ''}`;
    g.text(name, g.width / 2, 124, { align: 'center', color: '#ffffff', outline: '#000000' });
    g.text(`${this.match.games} GAMES PLAYED`, g.width / 2, 136, { align: 'center', color: '#fff0c0', outline: '#000000' });
    if (this.t > 90) {
      drawPanel(g, 64, 150, 128, 62, '#6040a0', '#201040');
      this.menu.draw(g, 128, 160, { center: true, lineH: 16, width: 100 });
    }
  }
}
