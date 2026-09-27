import type { App } from '../../app';
import { mix, type Gfx } from '../../engine/gfx';
import type { Scene } from '../../engine/scene';
import type { BattleItem } from '../../game/battle/config';
import { bomberColors, characterSprites } from '../../gfx/battleSprites';
import { dizzySprite } from '../../gfx/poses';
import { BOMBER_COLORS, sprites } from '../../gfx/sprites';
import { headSprite } from '../../render/hud';
import { drawHand, drawPanel, MENU_TEXT } from '../../render/ui';
import type { BattleMatch } from './match';

/** The seven prize panels of the original's Hyper Bomber. */
export const PRIZES: BattleItem[] = ['fire', 'bomb', 'speed', 'heart', 'line', 'kick', 'geta'];

/** The panels circle the pillar on this ellipse; the front of it is straight above the thrower. */
const ORBIT = { cx: 128, cy: 104, rx: 92, ry: 16 };
const SPIN = 0.035;
const THROWS = 3;
/** Where the yo-yo leaves the thrower's hand, and how fast it flies. */
const HAND_Y = 158;
const YOYO_SPEED = 5;

/**
 * Hyper Bomber, the winner's prize game on a TV-show set: item panels circle a pillar, and a
 * yo-yo thrown when one passes in front grabs it. The winner may decline; whoever plays turns
 * gold for the next game, and a grabbed item is theirs from its start.
 */
export class HyperBomberScene implements Scene {
  private phase: 'ask' | 'play' | 'done' = 'ask';
  private sel = 0;
  private t = 0;
  private spin = Math.random() * Math.PI * 2;
  private yoyo: { y: number; dir: -1 | 1; carrying: number | null } | null = null;
  /** Index into PRIZES of the grabbed panel. */
  private won: number | null = null;
  private throwsLeft = THROWS;
  private readonly cpu: boolean;
  private cpuWait: number;

  constructor(
    private readonly app: App,
    private readonly match: BattleMatch,
    private readonly slot: number,
  ) {
    this.cpu = match.cfg.players[slot].type === 'com';
    this.cpuWait = 40 + Math.floor(Math.random() * 60);
  }

  enter(): void {
    this.app.audio.music('hyperBomber', { restart: true });
  }

  private angle(k: number): number {
    return this.spin + (k * Math.PI * 2) / PRIZES.length;
  }

  /** The panel in front of the pillar, straight above the thrower, if any. */
  private panelInFront(): number | null {
    for (let k = 0; k < PRIZES.length; k++) {
      if (k === this.won) continue;
      const a = this.angle(k);
      if (Math.sin(a) > 0 && Math.abs(Math.cos(a) * ORBIT.rx) < 10) return k;
    }
    return null;
  }

  /** Would a yo-yo thrown now reach the front just as a panel gets there? (for the CPU) */
  private goodMoment(): boolean {
    const ticks = (HAND_Y - (ORBIT.cy + ORBIT.ry)) / YOYO_SPEED;
    for (let k = 0; k < PRIZES.length; k++) {
      const a = this.angle(k) + SPIN * ticks;
      if (Math.sin(a) > 0 && Math.abs(Math.cos(a) * ORBIT.rx) < 6) return true;
    }
    return false;
  }

  update(): void {
    this.t++;
    this.spin += SPIN;
    const menu = this.app.input.menu;
    if (this.phase === 'ask') {
      if (this.cpu) {
        if (this.t > 40) this.phase = 'play';
        return;
      }
      if (menu.repeat('left') || menu.repeat('right')) {
        this.sel = 1 - this.sel;
        this.app.audio.sfx('menuMove');
      }
      if (menu.pressed('a') || menu.pressed('start')) {
        menu.swallow();
        this.app.audio.sfx('menuOk');
        if (this.sel === 0) this.phase = 'play';
        else this.match.continueAfterResults(null);
      } else if (menu.pressed('b') || menu.pressed('d') || menu.pressed('select')) {
        menu.swallow();
        this.app.audio.sfx('menuBack');
        this.match.continueAfterResults(null);
      }
      return;
    }
    if (this.phase === 'done') {
      if (this.t > 150 || menu.pressed('start') || menu.pressed('a')) {
        menu.swallow();
        // Win or miss, the challenger turns gold for the next game.
        if (this.won !== null) this.match.prizes[this.slot] = PRIZES[this.won];
        this.match.gold[this.slot] = true;
        this.match.playRound();
      }
      return;
    }
    const pad = this.app.input.players[this.slot];
    const throwNow = this.cpu ? --this.cpuWait <= 0 || (this.cpuWait < 90 && this.goodMoment() && Math.random() < 0.3) : pad.pressed('a') || menu.pressed('a');
    if (!this.yoyo && throwNow && this.throwsLeft > 0) {
      this.yoyo = { y: HAND_Y, dir: -1, carrying: null };
      this.throwsLeft--;
      this.cpuWait = 60 + Math.floor(Math.random() * 60);
      this.app.audio.sfx('punch');
    }
    const yo = this.yoyo;
    if (!yo) return;
    yo.y += yo.dir * YOYO_SPEED;
    if (yo.dir < 0 && yo.y <= ORBIT.cy + ORBIT.ry) {
      const k = this.panelInFront();
      if (k !== null) {
        yo.carrying = k;
        this.won = k;
        this.app.audio.sfx('item');
      }
      yo.dir = 1;
    }
    if (yo.dir > 0 && yo.y >= HAND_Y) {
      this.yoyo = null;
      if (yo.carrying !== null || this.throwsLeft === 0) {
        this.phase = 'done';
        this.t = 0;
        this.app.audio.sfx(yo.carrying !== null ? 'bigItem' : 'menuBack');
      }
    }
  }

  render(g: Gfx): void {
    drawSet(g, this.t, this.phase === 'done' && this.won !== null);
    const p = this.match.cfg.players[this.slot];
    // Panels behind the pillar, the pillar, then the panels in front of it.
    const order = PRIZES.map((_, k) => k).filter((k) => k !== this.won).sort((a, b) => Math.sin(this.angle(a)) - Math.sin(this.angle(b)));
    for (const k of order) if (Math.sin(this.angle(k)) < 0) this.drawPanelAt(g, k);
    drawPillar(g, this.t);
    for (const k of order) if (Math.sin(this.angle(k)) >= 0) this.drawPanelAt(g, k);
    const g2 = g.ctx;
    g2.imageSmoothingEnabled = false;
    // The thrower, seen from behind; then gold and cheering, or sat down seeing stars.
    if (this.phase === 'done' && this.won !== null) {
      const sp = characterSprites(p.character, this.slot, true);
      g2.drawImage(sp.win[Math.floor(this.t / 10) % 2], 112, 150, 32, 48);
      drawPrize(g, PRIZES[this.won], 128, 138 - Math.round(Math.abs(Math.sin(this.t / 8)) * 6), 1);
    } else if (this.phase === 'done') {
      g2.drawImage(dizzySprite(Math.floor(this.t / 12) % 2, bomberColors(this.slot)), 104, 150, 48, 48);
    } else {
      const sp = characterSprites(p.character, this.slot);
      g2.drawImage(sp.walk.up[this.yoyo ? 1 : 0], 112, 150, 32, 48);
    }
    const yo = this.yoyo;
    if (yo) {
      g.rect(128, yo.y, 1, HAND_Y - yo.y, '#ffffff');
      if (yo.carrying !== null) drawPrize(g, PRIZES[yo.carrying], 128, yo.y - 4, 1);
      g2.fillStyle = '#e03018';
      g2.beginPath();
      g2.arc(128.5, yo.y, 4, 0, Math.PI * 2);
      g2.fill();
      g.rect(126, yo.y - 1, 5, 1, '#ffd070');
    }
    // Yo-yos left.
    for (let n = 0; n < this.throwsLeft; n++) {
      g2.fillStyle = '#e03018';
      g2.beginPath();
      g2.arc(14.5 + n * 11, 209.5, 4, 0, Math.PI * 2);
      g2.fill();
      g.rect(12 + n * 11, 209, 5, 1, '#ffd070');
    }
    if (this.phase === 'ask') {
      drawPanel(g, 32, 118, 192, 72);
      g.text(`PLAYER ${this.slot + 1}`, g.width / 2, 130, { align: 'center', ...MENU_TEXT });
      g.text('CHALLENGE HYPER BOMBER?', g.width / 2, 146, { align: 'center', ...MENU_TEXT });
      ['YES', 'NO'].forEach((o, i) => {
        const x = 104 + i * 56;
        g.text(o, x, 170, MENU_TEXT);
        if (i === this.sel) drawHand(g, x - 16, 169, this.app.frame);
      });
    } else if (this.phase === 'play' && !this.cpu) {
      const ink = { align: 'center' as const, color: '#ffffff', outline: '#c01870' };
      g.text('PRESS A TO THROW THE YO-YO', g.width / 2, 204, ink);
      g.text('AND GRAB AN ITEM!', g.width / 2, 214, ink);
    }
  }

  private drawPanelAt(g: Gfx, k: number): void {
    const a = this.angle(k);
    const depth = (Math.sin(a) + 1) / 2;
    const x = ORBIT.cx + Math.cos(a) * ORBIT.rx;
    const y = ORBIT.cy + Math.sin(a) * ORBIT.ry;
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(Math.sin(this.t / 14 + k * 1.3) * 0.3);
    drawPrize(g, PRIZES[k], 0, 0, 0.7 + depth * 0.3, 0.45 * (1 - depth));
    ctx.restore();
  }
}

let prizePanels: Map<BattleItem, HTMLCanvasElement> | null = null;

/** A prize panel: the item in a red frame, centred on (cx, cy). */
function drawPrize(g: Gfx, item: BattleItem, cx: number, cy: number, scale: number, shade = 0): void {
  prizePanels ??= new Map();
  let img = prizePanels.get(item);
  if (!img) {
    img = document.createElement('canvas');
    img.width = 22;
    img.height = 22;
    const c = img.getContext('2d')!;
    c.fillStyle = '#400808';
    c.fillRect(0, 0, 22, 22);
    c.fillStyle = '#e02818';
    c.fillRect(1, 1, 20, 20);
    c.fillStyle = '#ff9070';
    c.fillRect(1, 1, 20, 1);
    c.drawImage(sprites().items[item], 3, 3);
    prizePanels.set(item, img);
  }
  const s = Math.round(22 * scale);
  const ctx = g.ctx;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
  if (shade > 0) {
    ctx.globalAlpha = shade;
    g.rect(Math.round(cx - s / 2), Math.round(cy - s / 2), s, s, '#101030');
    ctx.globalAlpha = 1;
  }
}

/** The tall pillar the panels circle, topped by a striped disc. */
function drawPillar(g: Gfx, t: number): void {
  const x = ORBIT.cx;
  const top = ORBIT.cy;
  for (let dx = -9; dx <= 9; dx++) {
    const k = Math.abs(dx) / 9;
    g.rect(x + dx, top, 1, 178 - top, mix('#f4f8ff', '#8898c8', k * k));
  }
  for (let y = top + 12; y < 176; y += 14) g.rect(x - 9, y, 19, 2, '#4868c0');
  const ctx = g.ctx;
  const ring = (rx: number, ry: number, color: string, dy = 0): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x + 0.5, top + dy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  ring(24, 7, '#202858', 2);
  ring(24, 7, '#d82838');
  ring(20, 5.5, '#ffffff');
  ring(15, 4, '#3858d0');
  // A light blinking on top.
  ring(3, 2, Math.floor(t / 15) % 2 ? '#fff6a0' : '#f0b020', -3);
}

const CROWD_HELMETS: [string, string, string][] = [
  ['#ffffff', '#e4e4f4', '#a4a4cc'],
  ['#8a8aa8', '#4a4a64', '#262636'],
  ['#ffb0a0', '#f05040', '#a02018'],
  ['#b0d0ff', '#4c84f0', '#2048a0'],
  ['#b8f0b0', '#48c050', '#207828'],
  ['#fff4a0', '#f0d020', '#a08800'],
  ['#ffc8e8', '#f070b8', '#a03070'],
];
let crowdHeads: HTMLCanvasElement[] | null = null;

/**
 * The TV-show set: lights on a truss, the neon HYPER BOMBER sign between two Bomberman
 * emblems, a grandstand crowd that cheers a win, and the stage floor.
 */
function drawSet(g: Gfx, t: number, cheering: boolean): void {
  crowdHeads ??= CROWD_HELMETS.map((helmet) => headSprite({ ...BOMBER_COLORS[0], helmet }));
  for (let y = 0; y < g.height; y++) g.rect(0, y, g.width, 1, mix('#0c1030', '#1c2868', y / g.height));
  // The crowd, row upon row.
  for (let row = 0; row < 5; row++) {
    for (let col = -1; col < 27; col++) {
      const x = col * 10 + (row % 2) * 5;
      const hop = cheering ? Math.max(0, Math.round(Math.sin(t / 4 + col * 1.7 + row) * 3)) : Math.floor((t / 20 + col + row) % 7) === 0 ? 1 : 0;
      g.image(crowdHeads[(col * 3 + row * 5 + 21) % crowdHeads.length], x, 40 + row * 10 - hop);
    }
  }
  g.ctx.globalAlpha = 0.25;
  g.rect(0, 40, g.width, 52, '#0c1030');
  g.ctx.globalAlpha = 1;
  // Trusses with lamps, above and below the stand.
  const truss = (y: number): void => {
    g.rect(0, y, g.width, 8, '#383c58');
    g.rect(0, y, g.width, 1, '#8088b0');
    g.rect(0, y + 7, g.width, 1, '#181a28');
    for (let x = 0; x < g.width; x += 8) {
      g.rect(x, y + 1, 1, 6, '#5a6080');
      g.rect(x + 1, y + 3, 6, 1, '#5a6080');
    }
  };
  truss(0);
  truss(92);
  for (let k = 0; k < 8; k++) {
    const x = 16 + k * 32;
    const on = cheering ? Math.floor(t / 6 + k) % 2 === 0 : true;
    g.rect(x - 3, 6, 7, 5, '#202030');
    g.rect(x - 2, 8, 5, 3, on ? '#fff8c0' : '#807850');
    g.rect(x - 2, 97, 5, 3, Math.floor(t / 10 + k) % 3 === 0 ? '#ff80c0' : '#80e0ff');
  }
  // The neon sign.
  g.rect(52, 12, 152, 24, '#200828');
  const glow = Math.floor(t / 20) % 4 === 0 ? '#ff9ad8' : '#ff50b0';
  g.frame(52, 12, 152, 24, '#40d8ff');
  g.frame(54, 14, 148, 20, glow);
  g.text('HYPER BOMBER', g.width / 2, 17, { align: 'center', scale: 2, gradient: ['#ffe0f4', '#ff60c0'], outline: '#600838' });
  // Bomberman emblems either side of it.
  for (const ex of [6, 206]) {
    g.rect(ex, 14, 44, 30, '#601018');
    g.rect(ex + 1, 15, 42, 28, '#e03830');
    g.rect(ex + 3, 17, 38, 24, '#200c18');
    g.ctx.fillStyle = '#303868';
    g.ctx.beginPath();
    g.ctx.arc(ex + 22, 26, 6, 0, Math.PI * 2);
    g.ctx.fill();
    g.rect(ex + 25, 18, 3, 3, '#ffd040');
    g.rect(ex + 20, 23, 2, 2, '#c0c8ff');
    g.text('BOMBER', ex + 22, 33, { align: 'center', color: '#ffd8a0' });
  }
  // The stage floor, with a spotlight on the challenger.
  g.rect(0, 100, g.width, g.height - 100, '#141c50');
  for (let y = 104; y < g.height; y += 8) g.rect(0, y, g.width, 1, '#1c2868');
  g.ctx.globalAlpha = 0.18;
  g.ctx.fillStyle = '#fff8d0';
  g.ctx.beginPath();
  g.ctx.moveTo(116, 0);
  g.ctx.lineTo(140, 0);
  g.ctx.lineTo(168, 204);
  g.ctx.lineTo(88, 204);
  g.ctx.closePath();
  g.ctx.fill();
  g.ctx.globalAlpha = 1;
}
