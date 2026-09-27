import type { App } from '../../app';
import { textWidth, type Gfx } from '../../engine/gfx';
import type { DeviceId } from '../../engine/input';
import type { Scene } from '../../engine/scene';
import { arenaFor, arenasFor, type ArenaDef } from '../../game/battle/arenas';
import { altUnlocked } from '../../game/battle/unlocks';
import { type CharacterDef, charactersFor, CHARACTERS } from '../../game/battle/characters';
import { CUSTOM_ITEMS, defaultConfig, LEVEL_NAMES, MAX_HP, type BattleConfig, type Level } from '../../game/battle/config';
import { customCounts, softBlockCount, stageItems } from '../../game/battle/battleWorld';
import { load, save } from '../../engine/storage';
import { characterSprites } from '../../gfx/battleSprites';
import { sprites } from '../../gfx/sprites';
import { drawHand, drawMenuBackdrop, drawMenuWindow, drawWindow, Menu, MENU_TEXT, MENU_VALUE, type MenuItem } from '../../render/ui';
import { goMainMenu } from '../nav';
import { drawDisplayCase, stageSnapshot } from './preview';
import { BattleMatch } from './match';

const DEVICE_NAMES: Record<string, string> = {
  kb1: 'KEYS 1',
  kb2: 'KEYS 2',
  pad0: 'PAD 1',
  pad1: 'PAD 2',
  pad2: 'PAD 3',
  pad3: 'PAD 4',
};
const DEVICE_OPTIONS: DeviceId[][] = [['kb1', 'pad0', 'touch'], ['kb2', 'pad1'], ['pad0'], ['pad1'], ['pad2'], ['pad3'], ['kb1'], ['kb2']];

function deviceLabel(devs: DeviceId[]): string {
  return devs
    .filter((d) => d !== 'touch')
    .map((d) => DEVICE_NAMES[d] ?? d)
    .join('+');
}

/** Generic menu screen used by the setup steps. */
class MenuScene implements Scene {
  constructor(
    private readonly app: App,
    private readonly title: string,
    readonly menu: Menu,
    private readonly opts: { valueX?: number; lineH?: number } = {},
  ) {}

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawMenuWindow(g, this.title, this.menu, this.opts);
  }
}

/** Walks the player through the Battle Game setup screens. */
export class BattleSetup {
  cfg: BattleConfig;

  constructor(private readonly app: App) {
    this.cfg = restoreConfig(load<Partial<BattleConfig> | null>('battleConfig', null));
  }

  start(): void {
    this.selectMode();
  }

  private persist(): void {
    save('battleConfig', { ...this.cfg, customItems: this.cfg.customItems });
  }

  private go(scene: Scene): void {
    this.app.scenes.go(scene, 8);
  }

  // 1. Select Mode
  private selectMode(): void {
    const menu = new Menu(
      this.app,
      [
        { label: 'BATTLE ROYAL', action: () => ((this.cfg.mode = 'royal'), this.selectLevel()) },
        { label: 'CUSTOM BATTLE', action: () => ((this.cfg.mode = 'custom'), this.selectLevel()) },
      ],
      () => goMainMenu(this.app, 1),
    );
    menu.index = this.cfg.mode === 'custom' ? 1 : 0;
    this.go(new MenuScene(this.app, 'SELECT MODE', menu));
  }

  // 2. Select Level
  private selectLevel(): void {
    const levels: Level[] = ['beginner', 'normal', 'advanced'];
    const menu = new Menu(
      this.app,
      levels.map((l) => ({
        label: LEVEL_NAMES[l],
        action: () => {
          if (this.cfg.level !== l) this.cfg.stage = 0;
          this.cfg.level = l;
          for (const p of this.cfg.players) if (!CHARACTERS[p.character]?.levels.includes(l)) p.character = 'bomberman';
          this.singleTag();
        },
      })),
      () => this.selectMode(),
    );
    menu.index = levels.indexOf(this.cfg.level);
    this.go(new MenuScene(this.app, 'SELECT LEVEL', menu));
  }

  // 3. Single? Tag?
  private singleTag(): void {
    const menu = new Menu(
      this.app,
      [
        { label: 'SINGLE MATCH', action: () => ((this.cfg.tag = false), this.rules()) },
        { label: 'TAG MATCH', action: () => ((this.cfg.tag = true), this.rules()) },
      ],
      () => this.selectLevel(),
    );
    menu.index = this.cfg.tag ? 1 : 0;
    this.go(new MenuScene(this.app, 'SINGLE? TAG?', menu));
  }

  // 4. Rules Options
  private rules(): void {
    const r = this.cfg.rules;
    const beginner = this.cfg.level === 'beginner';
    const onOff = (v: boolean): string => (v ? 'ON' : 'OFF');
    const coms = ['weak', 'normal', 'strong'] as const;
    const carts = ['off', 'on', 'super'] as const;
    const tri = ['off', 'on', 'random'] as const;
    const offOn = ['off', 'on'] as const;
    const cycle = <T,>(list: readonly T[], v: T, d: number): T => list[(list.indexOf(v) + d + list.length) % list.length];
    const items: MenuItem[] = [
      { label: 'COMPUTER', value: () => r.com.toUpperCase(), change: (d) => (r.com = cycle(coms, r.com, d)) },
      { label: 'GAMES PER MATCH', value: () => String(r.wins), change: (d) => (r.wins = Math.max(1, Math.min(5, r.wins + d))) },
      { label: "TIME'S UP!", value: () => (r.time === 0 ? '∞' : `${r.time}:00`), change: (d) => (r.time = (r.time + d + 6) % 6) },
      { label: 'SUDDEN DEATH', value: () => r.suddenDeath.toUpperCase(), change: (d) => (r.suddenDeath = cycle(offOn, r.suddenDeath, d)), disabled: () => beginner },
      { label: 'RANDOM POSITION', value: () => r.randomPosition.toUpperCase(), change: (d) => (r.randomPosition = cycle(tri, r.randomPosition, d)), disabled: () => beginner },
      { label: 'SKULL BOMB', value: () => onOff(r.skullBomb), change: () => (r.skullBomb = !r.skullBomb), disabled: () => beginner },
      // Tag matches never have Hyper Bomber; the Single setting is kept for later.
      { label: 'HYPER BOMBER', value: () => onOff(r.hyperBomber && !this.cfg.tag), change: () => (r.hyperBomber = !r.hyperBomber), disabled: () => this.cfg.tag },
      { label: 'BOMBER CART', value: () => r.cart.toUpperCase(), change: (d) => (r.cart = cycle(carts, r.cart, d)) },
    ];
    // No OK row: A or START on any row goes on.
    for (const it of items) it.action = () => (this.persist(), this.players());
    if (beginner) {
      r.suddenDeath = 'off';
      r.randomPosition = 'off';
      r.skullBomb = false;
    }
    const menu = new Menu(this.app, items, () => this.singleTag());
    this.go(new MenuScene(this.app, 'RULES OPTIONS', menu, { valueX: 186, lineH: 20 }));
  }

  // 5. How many players?
  private players(): void {
    this.go(new PlayersScene(this.app, this, () => this.rules()));
  }

  afterPlayers(): void {
    this.persist();
    this.go(new CharacterScene(this.app, this));
  }

  afterCharacters(): void {
    if (this.cfg.tag) this.go(new TeamScene(this.app, this));
    else this.selectStage();
  }

  backFromCharacters(): void {
    this.players();
  }

  selectStage(): void {
    this.go(new StageSelectScene(this.app, this));
  }

  afterStage(): void {
    this.persist();
    if (this.cfg.mode === 'custom') this.go(new CustomScene(this.app, this));
    else this.launch();
  }

  backFromStage(): void {
    if (this.cfg.tag) this.go(new TeamScene(this.app, this));
    else this.go(new CharacterScene(this.app, this));
  }

  launch(): void {
    this.persist();
    new BattleMatch(this.app, structuredClone(this.cfg), () => this.selectStage()).start();
  }
}

// ------------------------------------------------------------------ players

/**
 * How many players?: each of the five is a human, a computer or off. A or START goes on
 * (with at least two playing); C picks which controller a human uses.
 */
class PlayersScene implements Scene {
  private row = 0;

  constructor(
    private readonly app: App,
    private readonly setup: BattleSetup,
    private readonly back: () => void,
  ) {}

  update(): void {
    const pad = this.app.input.menu;
    const players = this.setup.cfg.players;
    const rows = players.length;
    if (pad.repeat('up') || pad.repeat('down')) {
      this.row = (this.row + (pad.repeat('up') ? rows - 1 : 1)) % rows;
      this.app.audio.sfx('menuMove');
    }
    const p = players[this.row];
    const types = ['human', 'com', 'off'] as const;
    if (pad.repeat('left') || pad.repeat('right')) {
      const d = pad.repeat('left') ? -1 : 1;
      p.type = types[(types.indexOf(p.type) + d + 3) % 3];
      this.app.audio.sfx('select');
    }
    if (pad.pressed('c') && p.type === 'human') {
      // Cycle the controller for this human player.
      const cur = DEVICE_OPTIONS.findIndex((o) => o.join() === p.devices.join());
      p.devices = [...DEVICE_OPTIONS[(cur + 1) % DEVICE_OPTIONS.length]];
      this.app.audio.sfx('select');
    }
    if (pad.pressed('a') || pad.pressed('start')) {
      pad.swallow();
      if (players.filter((q) => q.type !== 'off').length >= 2) {
        this.app.audio.sfx('menuOk');
        this.setup.afterPlayers();
      } else this.app.audio.sfx('menuBack');
    } else if (pad.pressed('b') || pad.pressed('d') || pad.pressed('select')) {
      pad.swallow();
      this.app.audio.sfx('menuBack');
      this.back();
    }
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawWindow(g, 'HOW MANY PLAYERS?', 14, 30, 228, 172);
    const colors = { human: '#a8d8ff', com: '#ffb050', off: MENU_VALUE };
    this.setup.cfg.players.forEach((p, i) => {
      const y = 60 + i * 28;
      if (i === this.row) drawHand(g, 42, y - 1, this.app.frame);
      g.text(`${i + 1} PLAYER`, 58, y, MENU_TEXT);
      g.text(p.type === 'human' ? 'HUMAN' : p.type === 'com' ? 'COMPUTER' : 'OFF', 178, y, { align: 'center', color: colors[p.type], outline: MENU_TEXT.outline });
      // Which controller a human answers, small and quiet under the choice.
      if (p.type === 'human' && i === this.row) g.text(deviceLabel(p.devices), 178, y + 11, { align: 'center', color: '#98a890', outline: MENU_TEXT.outline });
    });
  }
}

// ------------------------------------------------------------------ characters

/**
 * Character select: every human moves their own cursor with their own controller at the
 * same time; the display case up top shows everybody's current pick (CPUs included).
 * START on any controller settles everyone's current choice.
 */
class CharacterScene implements Scene {
  private readonly roster: CharacterDef[];
  private readonly cursor: number[];
  private readonly done: boolean[];
  private readonly humans: number[];
  private t = 0;
  private finishing = -1;

  constructor(
    private readonly app: App,
    private readonly setup: BattleSetup,
  ) {
    const cfg = setup.cfg;
    this.roster = charactersFor(cfg.level);
    this.humans = cfg.players.map((p, i) => (p.type === 'human' ? i : -1)).filter((i) => i >= 0);
    this.cursor = cfg.players.map((p) => Math.max(0, this.roster.findIndex((c) => c.id === p.character)));
    this.done = cfg.players.map((p) => p.type !== 'human');
    // Computer players keep a valid pick from last time, or get one at random.
    cfg.players.forEach((p, i) => {
      if (p.type === 'com' && !this.roster.some((c) => c.id === p.character)) {
        this.cursor[i] = Math.floor(Math.random() * this.roster.length);
        p.character = this.roster[this.cursor[i]].id;
      }
    });
  }

  enter(): void {
    // Each human answers their own controller here, as in the battle itself.
    const input = this.app.input;
    this.setup.cfg.players.forEach((p, i) => {
      if (p.type === 'human') input.players[i].devices = [...p.devices];
    });
    for (const c of input.players) c.swallow();
  }

  update(): void {
    this.t++;
    const cfg = this.setup.cfg;
    if (this.roster.length === 1) {
      for (const p of cfg.players) p.character = this.roster[0].id;
      this.setup.afterCharacters();
      return;
    }
    if (this.finishing >= 0) {
      if (++this.finishing > 30) this.setup.afterCharacters();
      return;
    }
    const cols = 4;
    const n = this.roster.length;
    for (const i of this.humans) {
      const c = this.app.input.players[i];
      if (this.done[i]) {
        if (c.pressed('b') || c.pressed('d')) {
          this.done[i] = false;
          this.app.audio.sfx('menuBack');
        }
        continue;
      }
      let k = this.cursor[i];
      if (c.repeat('left')) k = (k + n - 1) % n;
      if (c.repeat('right')) k = (k + 1) % n;
      if (c.repeat('up')) k = (k + n - cols) % n;
      if (c.repeat('down')) k = (k + cols) % n;
      if (k !== this.cursor[i]) {
        this.cursor[i] = k;
        cfg.players[i].character = this.roster[k].id;
        this.app.audio.sfx('menuMove');
      }
      if (c.pressed('a')) {
        cfg.players[i].character = this.roster[k].id;
        this.done[i] = true;
        this.app.audio.sfx('menuOk');
      } else if (c.pressed('b') || c.pressed('d')) {
        this.app.audio.sfx('menuBack');
        this.setup.backFromCharacters();
        return;
      }
    }
    const menu = this.app.input.menu;
    if (menu.pressed('start')) {
      menu.swallow();
      for (const i of this.humans) {
        cfg.players[i].character = this.roster[this.cursor[i]].id;
        this.done[i] = true;
      }
      this.app.audio.sfx('menuOk');
    } else if (menu.pressed('select')) {
      this.app.audio.sfx('menuBack');
      this.setup.backFromCharacters();
      return;
    }
    if (this.done.every(Boolean)) this.finishing = 0;
  }

  render(g: Gfx): void {
    const cfg = this.setup.cfg;
    drawMenuBackdrop(g, this.app.frame);
    drawWindow(g, 'SELECT CHARACTER', 10, 22, 236, 176);
    // The display case: everybody's current pick.
    drawDisplayCase(g, 16, 34, 224, 56);
    const slots = cfg.players.map((p, i) => ({ p, i })).filter(({ p }) => p.type !== 'off');
    slots.forEach(({ p, i }, k) => {
      const x = 128 + (k - (slots.length - 1) / 2) * 42;
      const sp = characterSprites(p.character, i);
      const img = this.done[i] && p.type === 'human' ? sp.win[Math.floor(this.t / 12) % 2] : sp.walk.down[0];
      g.image(img, x - 8, 54);
    });
    // The roster stands on the window's squares; each human's badge floats over their pick.
    const cellW = 54;
    const cellH = 46;
    const x0 = 128 - (Math.min(4, this.roster.length) * cellW) / 2;
    this.roster.forEach((ch, k) => {
      const x = x0 + (k % 4) * cellW;
      const y = 104 + Math.floor(k / 4) * cellH;
      g.image(characterSprites(ch.id, 0).walk.down[0], x + cellW / 2 - 8, y + 16);
    });
    this.humans.forEach((i, h) => {
      const k = this.cursor[i];
      const same = this.humans.filter((j) => this.cursor[j] === k);
      const x = x0 + (k % 4) * cellW + cellW / 2 + (same.indexOf(i) - (same.length - 1) / 2) * 20;
      const y = 104 + Math.floor(k / 4) * cellH;
      if (this.done[i] || Math.floor((this.t + h * 5) / 8) % 2 === 0) drawBadge(g, `${i + 1}P`, x, y + 2, CURSOR_COLORS[i]);
    });
  }
}

/** A player's rounded badge ("1P") over the character they point at. */
function drawBadge(g: Gfx, text: string, x: number, y: number, color: string): void {
  const w = textWidth(text) + 6;
  const left = Math.round(x - w / 2);
  g.rect(left + 1, y, w - 2, 11, '#101828');
  g.rect(left, y + 1, w, 9, '#101828');
  g.rect(left + 1, y + 1, w - 2, 9, color);
  g.rect(left + 2, y + 1, w - 4, 1, '#ffffff');
  g.text(text, x, y + 2, { align: 'center', color: '#ffffff', outline: '#101828' });
}

/** Badge colour for each player slot. */
const CURSOR_COLORS = ['#48b8f0', '#f070c0', '#f05848', '#f0b030', '#50c850'];

// ------------------------------------------------------------------ teams

class TeamScene implements Scene {
  private sel = 0;

  constructor(
    private readonly app: App,
    private readonly setup: BattleSetup,
  ) {}

  private active(): number[] {
    return this.setup.cfg.players.map((p, i) => (p.type !== 'off' ? i : -1)).filter((i) => i >= 0);
  }

  update(): void {
    const pad = this.app.input.menu;
    const act = this.active();
    if (pad.repeat('left')) this.sel = (this.sel + act.length - 1) % act.length;
    if (pad.repeat('right')) this.sel = (this.sel + 1) % act.length;
    const p = this.setup.cfg.players[act[this.sel]];
    if (pad.repeat('up')) p.team = 0;
    if (pad.repeat('down')) p.team = 1;
    if (pad.repeat('left') || pad.repeat('right') || pad.repeat('up') || pad.repeat('down')) this.app.audio.sfx('menuMove');
    if (pad.pressed('a') || pad.pressed('start')) {
      const teams = new Set(act.map((i) => this.setup.cfg.players[i].team));
      if (teams.size === 2) {
        pad.swallow();
        this.app.audio.sfx('menuOk');
        this.setup.selectStage();
      } else this.app.audio.sfx('menuBack');
    } else if (pad.pressed('b') || pad.pressed('d')) {
      pad.swallow();
      this.setup.backFromCharacters();
    }
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawWindow(g, 'SELECT TEAM MEMBERS', 8, 20, 240, 190);
    // One display case per team, with the VS badge between them.
    drawDisplayCase(g, 16, 34, 224, 60);
    drawDisplayCase(g, 16, 132, 224, 60);
    drawVsBadge(g, 128, 113);
    const act = this.active();
    act.forEach((i, k) => {
      const p = this.setup.cfg.players[i];
      const x = Math.round(16 + (224 * (k + 0.5)) / act.length);
      const y = p.team === 0 ? 58 : 156;
      g.image(characterSprites(p.character, i).walk.down[0], x - 8, y);
      if (k === this.sel && Math.floor(this.app.frame / 8) % 2 === 0) drawBrackets(g, x - 13, y - 4, 26, 32);
    });
  }
}

/** The big VS between the two teams. */
function drawVsBadge(g: Gfx, cx: number, cy: number): void {
  const w = 56;
  const h = 28;
  const x = cx - w / 2;
  const y = cy - h / 2;
  g.rect(x + 2, y, w - 4, h, '#6a4008');
  g.rect(x, y + 2, w, h - 4, '#6a4008');
  g.rect(x + 2, y + 1, w - 4, h - 2, '#f8c828');
  g.rect(x + 1, y + 2, w - 2, h - 4, '#f8c828');
  g.rect(x + 3, y + 2, w - 6, 2, '#fff0a0');
  g.rect(x + 3, y + h - 4, w - 6, 2, '#d89818');
  g.text('VS', cx + 1, cy - 6, { align: 'center', scale: 2, color: '#e02818', outline: '#fff8e0' });
}

/** Four corner marks round the player being moved. */
function drawBrackets(g: Gfx, x: number, y: number, w: number, h: number): void {
  for (const [bx, by, sx, sy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
    g.rect(sx > 0 ? bx : bx - 4, by, 5, 1, '#ffffff');
    g.rect(bx, sy > 0 ? by : by - 4, 1, 5, '#ffffff');
    g.rect(sx > 0 ? bx + 1 : bx - 4, by + sy, 4, 1, '#506070');
  }
}

// ------------------------------------------------------------------ stage select

class StageSelectScene implements Scene {
  private stages: ArenaDef[];
  private slide = 0;

  constructor(
    private readonly app: App,
    private readonly setup: BattleSetup,
  ) {
    this.stages = arenasFor(setup.cfg.level);
    if (setup.cfg.stage >= this.stages.length) setup.cfg.stage = 0;
    this.altOpen = altUnlocked(setup.cfg.level);
    if (!this.altOpen) setup.cfg.alternate = false;
  }

  private readonly altOpen: boolean;

  private get arena(): ArenaDef {
    const cfg = this.setup.cfg;
    return arenaFor(cfg.level, cfg.stage, this.altOpen && !!cfg.alternate);
  }

  enter(): void {
    this.app.audio.music('select');
  }

  update(): void {
    const pad = this.app.input.menu;
    const n = this.stages.length;
    if (this.slide !== 0) this.slide -= Math.sign(this.slide) * 2;
    if (pad.repeat('left')) {
      this.setup.cfg.stage = (this.setup.cfg.stage + n - 1) % n;
      this.slide = -16;
      this.app.audio.sfx('menuMove');
    } else if (pad.repeat('right')) {
      this.setup.cfg.stage = (this.setup.cfg.stage + 1) % n;
      this.slide = 16;
      this.app.audio.sfx('menuMove');
    } else if (this.altOpen && (pad.repeat('up') || pad.repeat('down'))) {
      this.setup.cfg.alternate = !this.setup.cfg.alternate;
      this.app.audio.sfx('select');
    } else if (pad.pressed('a') || pad.pressed('start')) {
      pad.swallow();
      this.app.audio.sfx('menuOk');
      this.setup.afterStage();
    } else if (pad.pressed('b') || pad.pressed('d') || pad.pressed('select')) {
      pad.swallow();
      this.app.audio.sfx('menuBack');
      this.setup.backFromStage();
    }
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawWindow(g, 'SELECT STAGE', 8, 20, 240, 196);
    const cfg = this.setup.cfg;
    const n = this.stages.length;
    const alt = this.altOpen && !!cfg.alternate;
    const at = (k: number): ArenaDef => arenaFor(cfg.level, (cfg.stage + k + n * 2) % n, alt);
    const dx = this.slide * 3;
    // The next-but-one stage far behind, then the two neighbours, then the chosen one raised.
    drawCard(g, stageSnapshot(at(2)), 78 + dx / 2, 38, 100, 87, 0.45);
    drawCard(g, stageSnapshot(at(-1)), 14 + dx, 70, 88, 76, 0.2);
    drawCard(g, stageSnapshot(at(1)), 154 + dx, 70, 88, 76, 0.2);
    g.ctx.globalAlpha = 0.35;
    g.rect(69 + dx, 64, 126, 110, '#200818');
    g.ctx.globalAlpha = 1;
    drawCard(g, stageSnapshot(this.arena), 65 + dx, 58, 120, 104, 0);
    drawScroll(g, this.arena.name, 36, alt);
    // Once a level's alternates are unlocked, up/down flips to them.
    if (this.altOpen && Math.floor(this.app.frame / 20) % 2 === 0) {
      const x = g.width / 2 + Math.max(120, textWidth(this.arena.name) + 36) / 2 + 8;
      g.text('↑', x, 33, { color: '#fff4a0', outline: '#402000' });
      g.text('↓', x, 43, { color: '#fff4a0', outline: '#402000' });
    }
    drawStageArrow(g, 20, 180, -1);
    drawStageArrow(g, 224, 180, 1);
  }
}

/** A stage picture in its pale frame; `dim` shades cards further back. */
function drawCard(g: Gfx, img: HTMLCanvasElement, x: number, y: number, w: number, h: number, dim: number): void {
  x = Math.round(x);
  g.rect(x - 3, y - 3, w + 6, h + 6, '#6a6a20');
  g.rect(x - 2, y - 2, w + 4, h + 4, '#f4ec98');
  g.rect(x - 1, y - 1, w + 2, h + 2, '#b8b050');
  g.ctx.imageSmoothingEnabled = true;
  g.ctx.drawImage(img, x, y, w, h);
  g.ctx.imageSmoothingEnabled = false;
  if (dim > 0) {
    g.ctx.globalAlpha = dim;
    g.rect(x - 3, y - 3, w + 6, h + 6, '#281830');
    g.ctx.globalAlpha = 1;
  }
}

/** The stage's name on an orange scroll with red rolled ends; alternates get pink lettering. */
function drawScroll(g: Gfx, name: string, y: number, alternate: boolean): void {
  const w = Math.max(120, textWidth(name) + 36);
  const x = Math.round((g.width - w) / 2);
  const h = 15;
  const band = ['#b05010', '#f0a030', '#ffd060', '#fff0a0', '#ffd868', '#f8b840', '#f0a030', '#e89028', '#d88020', '#c87018', '#b86010', '#a85010', '#984808', '#883c08', '#702c04'];
  for (let i = 0; i < h; i++) g.rect(x, y + i, w, 1, band[i]);
  for (const ex of [x - 5, x + w - 2]) {
    g.rect(ex, y - 1, 7, h + 2, '#601008');
    g.rect(ex + 1, y, 5, h, '#e03818');
    g.rect(ex + 2, y + 1, 1, h - 2, '#ff9070');
  }
  g.text(name, g.width / 2, y + 4, { align: 'center', color: alternate ? '#ffa0e0' : '#78f060', outline: alternate ? '#501040' : '#104010' });
}

/** The yellow arrow buttons in the bottom corners: a triangle and a bar. */
function drawStageArrow(g: Gfx, x: number, y: number, dir: -1 | 1): void {
  const ink = (dx: number, dy: number, w: number, h: number, color: string): void => g.rect(dir < 0 ? x + dx : x - dx - w, y + dy, w, h, color);
  for (let i = 0; i < 8; i++) {
    const h = 2 + i * 2;
    ink(i, 8 - i - 1, 1, h + 2, '#804010');
    ink(i, 8 - i, 1, h, i < 2 ? '#ffe890' : '#f8c830');
  }
  ink(10, -1, 5, 20, '#804010');
  ink(11, 0, 3, 18, '#f8c830');
  ink(11, 0, 1, 18, '#ffe890');
}

// ------------------------------------------------------------------ custom setting

class CustomScene implements Scene {
  private readonly menu: Menu;

  constructor(
    private readonly app: App,
    setup: BattleSetup,
  ) {
    const cfg = setup.cfg;
    // Item kinds and amounts depend on the stage: start from its own mix.
    const alt = !!cfg.alternate && altUnlocked(cfg.level);
    const key = `${cfg.level}:${cfg.stage}${alt ? 'x' : ''}`;
    if (!cfg.customItems || cfg.customFor !== key) {
      cfg.customItems = customCounts(stageItems(cfg.level, arenaFor(cfg.level, cfg.stage, alt)));
      cfg.customFor = key;
    }
    this.menu = new Menu(
      app,
      [
        { label: 'ITEM SELECT', action: () => app.scenes.go(new ItemSetScene(app, setup, () => app.scenes.go(new CustomScene(app, setup)))) },
        { label: 'HANDICAP', action: () => app.scenes.go(new HitPointScene(app, setup, () => app.scenes.go(new CustomScene(app, setup)))) },
        { label: 'START BATTLE', action: () => setup.launch() },
      ],
      () => setup.selectStage(),
    );
  }

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawMenuWindow(g, 'CUSTOM SETTING', this.menu);
  }
}

/** The Set Item grid: three columns of five, filled column by column, as in the original. */
const ITEM_ROWS = 5;
const ITEM_COLS = 3;

class ItemSetScene implements Scene {
  /** Index into CUSTOM_ITEMS, or CUSTOM_ITEMS.length for END. */
  private sel = 0;
  /** Items hide under soft blocks, so the stage's block count is the limit. */
  private readonly capacity: number;

  constructor(
    private readonly app: App,
    private readonly setup: BattleSetup,
    private readonly back: () => void,
  ) {
    const cfg = setup.cfg;
    this.capacity = softBlockCount(cfg, arenaFor(cfg.level, cfg.stage, !!cfg.alternate && altUnlocked(cfg.level)));
  }

  private total(): number {
    return Object.values(this.setup.cfg.customItems ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  }

  private get onEnd(): boolean {
    return this.sel === CUSTOM_ITEMS.length;
  }

  private move(dc: number, dr: number): void {
    const end = CUSTOM_ITEMS.length;
    let col = this.onEnd ? ITEM_COLS - 1 : Math.floor(this.sel / ITEM_ROWS);
    let row = this.onEnd ? ITEM_ROWS : this.sel % ITEM_ROWS;
    if (dr) row = (row + dr + ITEM_ROWS + 1) % (ITEM_ROWS + 1);
    if (dc && row < ITEM_ROWS) col = (col + dc + ITEM_COLS) % ITEM_COLS;
    this.sel = row === ITEM_ROWS ? end : col * ITEM_ROWS + row;
    this.app.audio.sfx('menuMove');
  }

  update(): void {
    const pad = this.app.input.menu;
    if (pad.repeat('left')) this.move(-1, 0);
    if (pad.repeat('right')) this.move(1, 0);
    if (pad.repeat('up')) this.move(0, -1);
    if (pad.repeat('down')) this.move(0, 1);
    if (pad.pressed('start') || pad.pressed('select') || (this.onEnd && pad.pressed('a'))) {
      pad.swallow();
      this.app.audio.sfx('menuOk');
      this.back();
      return;
    }
    if (this.onEnd) return;
    const items = this.setup.cfg.customItems!;
    const kind = CUSTOM_ITEMS[this.sel];
    if (pad.repeat('a') && this.total() < this.capacity && (items[kind] ?? 0) < 9) {
      items[kind] = (items[kind] ?? 0) + 1;
      this.app.audio.sfx('select');
    }
    if ((pad.repeat('b') || pad.repeat('c') || pad.repeat('d')) && (items[kind] ?? 0) > 0) {
      items[kind] = (items[kind] ?? 0) - 1;
      this.app.audio.sfx('select');
    }
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawWindow(g, 'SET ITEM', 14, 30, 228, 172);
    const items = this.setup.cfg.customItems!;
    const s = sprites();
    const count = { color: MENU_VALUE, outline: MENU_TEXT.outline };
    CUSTOM_ITEMS.forEach((kind, i) => {
      const x = 44 + Math.floor(i / ITEM_ROWS) * 70;
      const y = 50 + (i % ITEM_ROWS) * 24;
      if (i === this.sel) drawHand(g, x - 16, y + 4, this.app.frame);
      g.image(s.items[kind], x, y);
      g.text(`×${items[kind] ?? 0}`, x + 20, y + 5, count);
    });
    // "n more" to place, and END.
    const left = this.capacity - this.total();
    g.text(`${left} MORE`, 44, 180, { ...MENU_TEXT, color: left > 0 ? MENU_TEXT.color : '#ff9080' });
    if (this.onEnd) drawHand(g, 170, 179, this.app.frame);
    g.text('END', 186, 180, MENU_TEXT);
  }
}

class HitPointScene implements Scene {
  private readonly menu: Menu;

  constructor(
    private readonly app: App,
    setup: BattleSetup,
    private readonly back: () => void,
  ) {
    const items: MenuItem[] = setup.cfg.players.map((p, i) => ({
      label: `PLAYER ${i + 1}`,
      value: () => (p.type === 'off' ? '-' : String(p.hp)),
      change: (d: -1 | 1) => (p.hp = Math.max(1, Math.min(MAX_HP, p.hp + d))),
      disabled: () => p.type === 'off',
    }));
    items.push({ label: 'END', action: () => this.back() });
    this.menu = new Menu(app, items, () => this.back());
  }

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawMenuWindow(g, 'SET HIT POINTS', this.menu, { lineH: 20, valueX: 170 });
  }
}

/** Merge a stored configuration over the defaults, dropping anything malformed. */
function restoreConfig(saved: Partial<BattleConfig> | null): BattleConfig {
  const cfg = defaultConfig();
  if (!saved || typeof saved !== 'object') return cfg;
  if (saved.mode === 'royal' || saved.mode === 'custom') cfg.mode = saved.mode;
  if (saved.level === 'beginner' || saved.level === 'normal' || saved.level === 'advanced') cfg.level = saved.level;
  if (typeof saved.tag === 'boolean') cfg.tag = saved.tag;
  if (Number.isInteger(saved.stage) && saved.stage! >= 0 && saved.stage! < 8) cfg.stage = saved.stage!;
  if (saved.rules && typeof saved.rules === 'object') {
    const rules = { ...saved.rules } as Record<string, unknown>;
    // Older saves stored these two as booleans, and Sudden Death once had a Random setting.
    for (const k of ['suddenDeath', 'randomPosition']) if (typeof rules[k] === 'boolean') rules[k] = rules[k] ? 'on' : 'off';
    if (rules.suddenDeath === 'random') rules.suddenDeath = 'on';
    for (const k of Object.keys(cfg.rules) as (keyof typeof cfg.rules)[]) {
      const v = rules[k];
      if (typeof v === typeof cfg.rules[k]) (cfg.rules as unknown as Record<string, unknown>)[k] = v;
    }
    if (!['off', 'on', 'random'].includes(cfg.rules.randomPosition)) cfg.rules.randomPosition = 'off';
    if (!['off', 'on'].includes(cfg.rules.suddenDeath)) cfg.rules.suddenDeath = 'off';
  }
  if (Array.isArray(saved.players)) {
    cfg.players.forEach((p, i) => {
      const q = saved.players![i];
      if (!q || typeof q !== 'object') return;
      if (q.type === 'human' || q.type === 'com' || q.type === 'off') p.type = q.type;
      if (Array.isArray(q.devices)) p.devices = q.devices.filter((d) => typeof d === 'string');
      if (typeof q.character === 'string' && CHARACTERS[q.character]) p.character = q.character;
      if (q.team === 0 || q.team === 1) p.team = q.team;
      if (Number.isInteger(q.hp) && q.hp >= 1 && q.hp <= MAX_HP) p.hp = q.hp;
    });
  }
  if (saved.customItems && typeof saved.customItems === 'object') cfg.customItems = customCounts(saved.customItems);
  if (typeof saved.customFor === 'string') cfg.customFor = saved.customFor;
  if (typeof saved.alternate === 'boolean') cfg.alternate = saved.alternate;
  return cfg;
}
