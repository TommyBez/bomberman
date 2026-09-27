import type { App } from '../../app';
import { mix, type Gfx } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import { arenaFor } from '../../game/battle/arenas';
import { altUnlocked } from '../../game/battle/unlocks';
import type { BattleWorld } from '../../game/battle/battleWorld';
import type { BattleConfig, BattleItem } from '../../game/battle/config';
import { characterSprites } from '../../gfx/battleSprites';
import { PixelCanvas } from '../../gfx/pixel';
import { BOMBER_COLORS, sprites } from '../../gfx/sprites';
import { headSprite, hudIcons } from '../../render/hud';
import { drawMenuBackdrop, drawPanel, drawWindow, Menu } from '../../render/ui';
import { goMainMenu, goTitle } from '../nav';
import { HyperBomberScene } from './hyperBomber';
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
    drawWindow(g, `${cfg.rules.wins} POINT MATCH`, 14, 22, 228, 186);
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
    // An arrow points on to the Battle Report.
    if (Math.floor(this.t / 20) % 2 === 0) g.text('\u2192', 248, 104, { align: 'center', scale: 2, color: '#f8c830', outline: '#603008' });
  }

  /**
   * The Battle Report on its pale board: each player's portrait, then a pink FRAGGED
   * column (who they knocked out) and a blue FRAGGED BY column (who knocked them out),
   * one face per knock-out.
   */
  private renderReport(g: Gfx): void {
    const cfg = this.match.cfg;
    g.rect(0, 0, g.width, g.height, '#fbf4ec');
    g.frame(5, 5, g.width - 10, g.height - 10, '#e05a80');
    g.frame(6, 6, g.width - 12, g.height - 12, '#e05a80');
    g.frame(9, 9, g.width - 18, g.height - 18, '#f4b0c4');
    const slots = cfg.players.map((p, i) => ({ p, i })).filter(({ p }) => p.type !== 'off');
    const icons = hudIcons();
    const colW = 46;
    const x0 = 128 - (slots.length * colW) / 2;
    const rows = 4;
    slots.forEach(({ p, i }, k) => {
      const x = x0 + k * colW;
      // Portrait.
      g.rect(x + 2, 14, colW - 4, 31, '#1a2a78');
      g.frame(x + 3, 15, colW - 6, 29, '#4a64c8');
      g.image(characterSprites(p.character, i).walk.down[0], x + colW / 2 - 8, 18);
      // The two tabs, lettered sideways.
      const tabs: [string, number, string, string][] = [
        ['FRAGGED', x + 2, '#f0508c', '#ffe850'],
        ['FRAGGED BY', x + 24, '#5c78d8', '#ffffff'],
      ];
      for (const [label, tx, bg, ink] of tabs) {
        g.rect(tx, 48, 20, 63, bg);
        g.rect(tx, 48, 20, 1, mix(bg, '#ffffff', 0.5));
        g.rect(tx, 110, 20, 1, mix(bg, '#000000', 0.35));
        sideways(g, label, tx + 10, 48 + Math.round((63 - label.length * 6) / 2), ink, mix(bg, '#000000', 0.55));
      }
      const beat: number[] = [];
      const lost: number[] = [];
      for (let o = 0; o < 5; o++) {
        for (let n = 0; n < this.match.report[i][o]; n++) if (o !== i) beat.push(o);
        for (let n = 0; n < this.match.report[o][i]; n++) lost.push(o);
      }
      const list = (faces: number[], cx: number, fill: string, edge: string): void => {
        for (let r = 0; r < rows; r++) {
          const y = 114 + r * 24;
          g.rect(cx, y, 20, 22, fill);
          g.frame(cx, y, 20, 22, edge);
          if (r === rows - 1 && faces.length > rows) {
            g.text(`+${faces.length - rows + 1}`, cx + 10, y + 8, { align: 'center', color: '#e03050', outline: '#ffffff' });
          } else if (faces[r] !== undefined) g.image(icons.heads[faces[r]], cx + 5, y + 6);
        }
      };
      list(beat, x + 2, '#fce4ee', '#f0a8c4');
      list(lost, x + 24, '#dcf6f8', '#98d8e0');
    });
    if (Math.floor(this.app.frame / 20) % 2 === 0) g.text('\u2190', 8, 104, { align: 'center', scale: 2, color: '#f8c830', outline: '#603008' });
  }
}

/** Text turned a quarter clockwise, reading downwards from (cx, y). */
function sideways(g: Gfx, text: string, cx: number, y: number, color: string, outline: string): void {
  const ctx = g.ctx;
  ctx.save();
  ctx.translate(cx + 4, y);
  ctx.rotate(Math.PI / 2);
  g.text(text, 0, 0, { color, outline });
  ctx.restore();
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
  }
}

// ------------------------------------------------------------------ victory

class VictoryScene implements Scene {
  private t = 0;
  private readonly menu: Menu;

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
  }

  enter(): void {
    this.app.audio.music('champion', { restart: true });
  }

  update(): void {
    this.t++;
    if (this.t > 90) this.menu.update();
  }

  render(g: Gfx): void {
    const cfg = this.match.cfg;
    const tag = this.team !== null;
    if (tag) drawGarland(g, this.t);
    else drawRing(g);
    drawVictoryWord(g, g.width / 2, 10, this.t);
    // The winners are tossed in the air, their shadows on the floor below.
    const winners = cfg.players.map((p, i) => ({ p, i })).filter(({ p, i }) => p.type !== 'off' && (tag ? p.team === this.team : i === this.slot));
    const ground = tag ? 150 : 138;
    winners.forEach(({ p, i }, k) => {
      const cx = g.width / 2 + (k - (winners.length - 1) / 2) * 52;
      const phase = ((this.t + k * 22) % 56) / 56;
      const lift = Math.round(60 * 4 * phase * (1 - phase));
      g.ctx.globalAlpha = 0.3;
      g.ctx.fillStyle = '#102040';
      g.ctx.beginPath();
      g.ctx.ellipse(cx, ground + 1, 12 - lift / 10, 3.5 - lift / 40, 0, 0, Math.PI * 2);
      g.ctx.fill();
      g.ctx.globalAlpha = 1;
      const img = characterSprites(p.character, i).win[lift > 24 ? 1 : 0];
      g.ctx.imageSmoothingEnabled = false;
      g.ctx.drawImage(img, cx - 16, ground - 46 - lift, 32, 48);
    });
    if (this.t > 90) {
      drawPanel(g, 64, 164, 128, 50);
      this.menu.draw(g, 128, 172, { center: true, lineH: 14 });
    }
  }
}

/** The single winner's ring: a pale canvas with a faded bomb and name, ropes and corner posts, on blue tiles. */
function drawRing(g: Gfx): void {
  g.rect(0, 0, g.width, g.height, '#2a60c4');
  for (let y = 0; y < g.height; y += 16) g.rect(0, y, g.width, 1, '#3a74d8');
  for (let x = 0; x < g.width; x += 16) g.rect(x, 0, 1, g.height, '#3a74d8');
  for (let y = 15; y < g.height; y += 16) g.rect(0, y, g.width, 1, '#1e4ca8');
  const x0 = 40;
  const y0 = 40;
  const w = 176;
  const h = 120;
  g.rect(x0 - 6, y0 - 6, w + 12, h + 12, '#1a3c90');
  for (let i = 0; i < h; i++) {
    const k = Math.abs(i / h - 0.5) * 2;
    for (let j = 0; j < w; j += 4) {
      const kk = Math.max(k, Math.abs(j / w - 0.5) * 2);
      g.rect(x0 + j, y0 + i, 4, 1, mix('#e4fcff', '#70d0ec', kk * kk));
    }
  }
  // The faded bomb and name printed on the canvas.
  g.ctx.globalAlpha = 0.45;
  g.ctx.fillStyle = '#58b8d8';
  g.ctx.beginPath();
  g.ctx.arc(128, 84, 14, 0, Math.PI * 2);
  g.ctx.fill();
  g.rect(136, 66, 4, 6, '#58b8d8');
  g.text('BOMBERMAN', 128, 104, { align: 'center', scale: 2, color: '#58b8d8' });
  g.ctx.globalAlpha = 1;
  // Ropes and corner posts.
  for (const [off, color] of [[3, '#f070b0'], [5, '#ffffff'], [7, '#f070b0']] as [number, string][]) {
    g.frame(x0 + off, y0 + off, w - off * 2, h - off * 2, color);
  }
  for (const [px, py] of [[x0 + 4, y0 + 4], [x0 + w - 5, y0 + 4], [x0 + 4, y0 + h - 5], [x0 + w - 5, y0 + h - 5]]) {
    g.ctx.fillStyle = '#101c50';
    g.ctx.beginPath();
    g.ctx.arc(px, py, 6, 0, Math.PI * 2);
    g.ctx.fill();
    g.ctx.fillStyle = '#3050c0';
    g.ctx.beginPath();
    g.ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    g.ctx.fill();
    g.rect(px - 2, py - 3, 2, 2, '#c8d8ff');
  }
}

const GARLAND_HELMETS: [string, string, string][] = [
  ['#ffc0d8', '#f870a8', '#b83870'],
  ['#ffd8a0', '#f89830', '#b05c10'],
  ['#fff4a0', '#f0d820', '#a89000'],
  ['#c0f8c0', '#40d060', '#208838'],
  ['#c0f8ff', '#30c8e8', '#1880a0'],
  ['#e0c8ff', '#a060f0', '#6030a8'],
];
let garlandHeads: HTMLCanvasElement[] | null = null;

/** The tag team's backdrop: pale blue inside a garland of bomber heads, with more flying across. */
function drawGarland(g: Gfx, t: number): void {
  garlandHeads ??= GARLAND_HELMETS.map((helmet) => headSprite({ ...BOMBER_COLORS[0], helmet }));
  const heads = garlandHeads;
  g.rect(0, 0, g.width, g.height, '#98c0f4');
  const shift = Math.floor(t / 8);
  for (let x = 0, n = 0; x < g.width; x += 11, n++) {
    for (const y of [1, 11, g.height - 21, g.height - 11]) g.image(heads[(n + shift + y) % heads.length], x, y);
  }
  for (let y = 21, n = 0; y < g.height - 21; y += 11, n++) {
    for (const x of [1, 11, g.width - 21, g.width - 11]) g.image(heads[(n + shift + x) % heads.length], x, y);
  }
  // Heads flying out from the middle along the diagonals.
  for (let k = 0; k < 8; k++) {
    const d = ((t * 0.6 + k * 24) % 96) + 8;
    const [sx, sy] = [[-1, -1], [1, -1], [-1, 1], [1, 1]][k % 4];
    g.image(heads[k % heads.length], 123 + sx * d * 1.1, 106 + sy * d * 0.7);
  }
}

const VICTORY_COLORS = ['#f03838', '#f89020', '#f8e030', '#38c850', '#28c0e8', '#3868f0', '#b048e8'];

/** VICTORY in big letters, each a different colour, the colours marching along. */
function drawVictoryWord(g: Gfx, cx: number, y: number, t: number): void {
  const word = 'VICTORY';
  const step = 19;
  const x0 = cx - (word.length * step) / 2 + 2;
  [...word].forEach((ch, k) => {
    const color = VICTORY_COLORS[(k + 7 - (Math.floor(t / 6) % 7)) % 7];
    const x = x0 + k * step;
    g.text(ch, x + 2, y + 2, { scale: 3, color: '#182048' });
    g.text(ch, x, y, { scale: 3, gradient: [mix(color, '#ffffff', 0.5), color], outline: '#182048' });
  });
}

