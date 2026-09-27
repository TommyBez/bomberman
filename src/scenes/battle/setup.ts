import type { App } from '../../app';
import type { Gfx } from '../../engine/gfx';
import type { DeviceId } from '../../engine/input';
import type { Scene } from '../../engine/scene';
import { arenaFor, arenasFor, type ArenaDef } from '../../game/battle/arenas';
import { altUnlocked } from '../../game/battle/unlocks';
import { type CharacterDef, charactersFor, CHARACTERS } from '../../game/battle/characters';
import { CUSTOM_ITEMS, defaultConfig, ITEM_NAMES, LEVEL_NAMES, MAX_HP, type BattleConfig, type Level } from '../../game/battle/config';
import { customCounts, softBlockCount, stageItems } from '../../game/battle/battleWorld';
import { load, save } from '../../engine/storage';
import { characterSprites } from '../../gfx/battleSprites';
import { sprites } from '../../gfx/sprites';
import { drawMenuBackdrop, drawPanel, drawTitleBar, Menu, type MenuItem } from '../../render/ui';
import { goMainMenu } from '../nav';
import { drawArenaPreview, drawBomberIcon } from './preview';
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
    private readonly opts: { x?: number; y?: number; w?: number; h?: number; valueX?: number; center?: boolean; lineH?: number; footer?: string } = {},
  ) {}

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, this.title, this.app.frame);
    const o = this.opts;
    const lh = o.lineH ?? 18;
    const h = o.h ?? this.menu.items.length * lh + 20;
    const w = o.w ?? 160;
    const x = o.x ?? (g.width - w) / 2;
    const y = o.y ?? Math.max(36, (g.height - h) / 2 + 6);
    drawPanel(g, x, y, w, h, '#28a068', '#0c4028');
    if (o.center ?? !o.valueX) this.menu.draw(g, x + w / 2, y + 12, { center: true, lineH: lh, width: w - 40 });
    else this.menu.draw(g, x + 16, y + 12, { lineH: lh, valueX: o.valueX ?? x + w - 50 });
    if (o.footer) g.text(o.footer, g.width / 2, g.height - 14, { align: 'center', color: '#c8ffe0', outline: '#000000' });
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
        { label: 'BATTLE ROYAL', action: () => ((this.cfg.mode = 'royal'), this.selectLevel()), help: 'THE STANDARD BATTLE GAME' },
        { label: 'CUSTOM BATTLE', action: () => ((this.cfg.mode = 'custom'), this.selectLevel()), help: 'CHOOSE ITEMS AND HANDICAPS' },
      ],
      () => goMainMenu(this.app, 1),
    );
    menu.index = this.cfg.mode === 'custom' ? 1 : 0;
    this.go(new MenuScene(this.app, 'SELECT MODE', menu));
  }

  // 2. Select Level
  private selectLevel(): void {
    const levels: Level[] = ['beginner', 'normal', 'advanced'];
    const help: Record<Level, string> = {
      beginner: 'SIMPLE STAGES, BASIC ITEMS',
      normal: 'TRAPS, EGGS AND PARTNERS',
      advanced: 'SPECIAL MOVES, TRICKY STAGES',
    };
    const menu = new Menu(
      this.app,
      levels.map((l) => ({
        label: LEVEL_NAMES[l],
        help: help[l],
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
        { label: 'SINGLE MATCH', action: () => ((this.cfg.tag = false), this.rules()), help: 'EVERYONE FOR THEMSELVES' },
        { label: 'TAG MATCH', action: () => ((this.cfg.tag = true), this.rules()), help: 'TWO TEAMS' },
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
    const suddenHelp = (): string => ({ off: 'BLOCKS FALL AROUND THE EDGE', on: 'BLOCKS FILL THE WHOLE ARENA' })[r.suddenDeath];
    const shuffleHelp = (): string =>
      ({ off: 'FIXED STARTING SPOTS', on: 'SHUFFLE THE STARTING SPOTS', random: 'SHUFFLE OR NOT, EACH GAME' })[r.randomPosition];
    const cycle = <T,>(list: readonly T[], v: T, d: number): T => list[(list.indexOf(v) + d + list.length) % list.length];
    const items: MenuItem[] = [
      { label: 'COMPUTER', value: () => r.com.toUpperCase(), change: (d) => (r.com = cycle(coms, r.com, d)), help: 'CPU PLAYER STRENGTH' },
      { label: 'GAMES PER MATCH', value: () => String(r.wins), change: (d) => (r.wins = Math.max(1, Math.min(5, r.wins + d))), help: 'WINS NEEDED FOR THE SET' },
      { label: "TIME'S UP!", value: () => (r.time === 0 ? '∞' : `${r.time}:00`), change: (d) => (r.time = (r.time + d + 6) % 6), help: 'TIME LIMIT PER GAME' },
      { label: 'SUDDEN DEATH', value: () => r.suddenDeath.toUpperCase(), change: (d) => (r.suddenDeath = cycle(offOn, r.suddenDeath, d)), disabled: () => beginner, help: suddenHelp },
      { label: 'RANDOM POSITION', value: () => r.randomPosition.toUpperCase(), change: (d) => (r.randomPosition = cycle(tri, r.randomPosition, d)), disabled: () => beginner, help: shuffleHelp },
      { label: 'SKULL BOMB', value: () => onOff(r.skullBomb), change: () => (r.skullBomb = !r.skullBomb), disabled: () => beginner, help: 'SKULLS CAN BE BURNT BY BLASTS' },
      // Tag matches never have Hyper Bomber; the Single setting is kept for later.
      { label: 'HYPER BOMBER', value: () => onOff(r.hyperBomber && !this.cfg.tag), change: () => (r.hyperBomber = !r.hyperBomber), disabled: () => this.cfg.tag, help: 'WINNER PLAYS FOR A BONUS ITEM' },
      { label: 'BOMBER CART', value: () => r.cart.toUpperCase(), change: (d) => (r.cart = cycle(carts, r.cart, d)), help: 'KNOCKED-OUT PLAYERS FIGHT ON' },
      { label: 'OK', action: () => (this.persist(), this.players()) },
    ];
    if (beginner) {
      r.suddenDeath = 'off';
      r.randomPosition = 'off';
      r.skullBomb = false;
    }
    const menu = new Menu(this.app, items, () => this.singleTag());
    this.go(new MenuScene(this.app, 'RULES OPTIONS', menu, { w: 232, valueX: 190, lineH: 16, x: 12 }));
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
    const rows = players.length + 1;
    if (pad.repeat('up')) this.row = (this.row + rows - 1) % rows;
    if (pad.repeat('down')) this.row = (this.row + 1) % rows;
    if (pad.repeat('up') || pad.repeat('down')) this.app.audio.sfx('menuMove');
    if (this.row < players.length) {
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
    }
    if (pad.pressed('a') || pad.pressed('start')) {
      const active = players.filter((p) => p.type !== 'off').length;
      if (this.row === players.length || pad.pressed('start')) {
        if (active >= 2) {
          this.app.audio.sfx('menuOk');
          pad.swallow();
          this.setup.afterPlayers();
        } else this.app.audio.sfx('menuBack');
      }
    } else if (pad.pressed('b') || pad.pressed('select')) {
      pad.swallow();
      this.app.audio.sfx('menuBack');
      this.back();
    }
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'HOW MANY PLAYERS?', this.app.frame);
    drawPanel(g, 12, 34, 232, 150, '#28a068', '#0c4028');
    const players = this.setup.cfg.players;
    players.forEach((p, i) => {
      const y = 44 + i * 24;
      const sel = i === this.row;
      if (sel) {
        g.ctx.globalAlpha = 0.25;
        g.rect(16, y - 4, 224, 22, '#ffffff');
        g.ctx.globalAlpha = 1;
      }
      drawBomberIcon(g, i, p.type === 'off' ? -1 : i, 24, y - 2, this.app.frame, p.character);
      g.text(`P${i + 1}`, 44, y + 4, { color: '#ffe040', outline: '#000000' });
      const label = p.type === 'human' ? 'HUMAN' : p.type === 'com' ? 'COMPUTER' : 'OFF';
      g.text(sel ? `← ${label} →` : label, 120, y + 4, { color: p.type === 'off' ? '#80a090' : '#ffffff', outline: '#000000', align: 'center' });
      if (p.type === 'human') g.text(deviceLabel(p.devices), 234, y + 4, { color: '#a8ffc8', outline: '#000000', align: 'right' });
    });
    const okSel = this.row === players.length;
    g.text((okSel ? '▶ ' : '') + 'OK', g.width / 2, 168, { align: 'center', color: okSel ? '#ffe040' : '#ffffff', outline: '#000000' });
    g.text('← →: HUMAN/COMPUTER/OFF   C: CONTROLLER', g.width / 2, 194, { align: 'center', color: '#c8ffe0', outline: '#000000' });
    g.text('AT LEAST 2 PLAYERS', g.width / 2, 206, { align: 'center', color: '#c8ffe0', outline: '#000000' });
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
        if (c.pressed('b')) {
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
      } else if (c.pressed('b')) {
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
    drawPanel(g, 10, 24, 236, 172, '#503080', '#281040');
    drawTitleBar(g, 'SELECT CHARACTER', this.app.frame);
    // The display case: everybody's current pick.
    g.rect(16, 32, 224, 50, '#2a8a3c');
    for (let y = 32; y < 60; y += 4) g.rect(16, y, 224, 1, '#33983f');
    g.rect(16, 66, 224, 2, '#8a5a20');
    for (let x = 18; x < 240; x += 6) g.rect(x, 60, 1, 6, '#a06a28');
    g.rect(16, 68, 224, 14, '#cce8f8');
    g.rect(16, 68, 224, 1, '#ffffff');
    g.frame(15, 31, 226, 52, '#80c0e8');
    g.rect(15, 31, 226, 3, '#e8f4ff');
    const slots = cfg.players.map((p, i) => ({ p, i })).filter(({ p }) => p.type !== 'off');
    slots.forEach(({ p, i }, k) => {
      const x = 128 + (k - (slots.length - 1) / 2) * 44;
      const sp = characterSprites(p.character, i);
      const img = this.done[i] && p.type === 'human' ? sp.win[Math.floor(this.t / 12) % 2] : sp.walk.down[0];
      g.image(img, x - 8, 44);
      g.text(p.type === 'com' ? 'COM' : `${i + 1}P`, x, 72, { align: 'center', color: CURSOR_COLORS[i], outline: '#000000' });
    });
    // The roster, with each human's cursor.
    const cellW = 54;
    const cellH = 42;
    const x0 = 128 - (Math.min(4, this.roster.length) * cellW) / 2;
    this.roster.forEach((ch, k) => {
      const x = x0 + (k % 4) * cellW;
      const y = 90 + Math.floor(k / 4) * cellH;
      g.rect(x + 2, y + 2, cellW - 4, cellH - 4, (k + Math.floor(k / 4)) % 2 ? 'rgba(90,60,120,0.55)' : 'rgba(120,80,40,0.55)');
      g.image(characterSprites(ch.id, 0).walk.down[0], x + cellW / 2 - 8, y + 10);
    });
    this.humans.forEach((i, h) => {
      const k = this.cursor[i];
      const x = x0 + (k % 4) * cellW;
      const y = 90 + Math.floor(k / 4) * cellH;
      const inset = h * 2;
      const blink = this.done[i] || Math.floor((this.t + h * 5) / 8) % 2 === 0;
      if (blink) g.frame(x + 1 + inset, y + 1 + inset, cellW - 2 - inset * 2, cellH - 2 - inset * 2, CURSOR_COLORS[i]);
      g.text(`${i + 1}P`, x + 4 + h * 12, y + 3, { color: CURSOR_COLORS[i], outline: '#000000' });
    });
    // What the first human is pointing at.
    const lead = this.humans[0] ?? 0;
    const sel = this.roster[this.cursor[lead]];
    g.text(sel.name, 128, 178, { align: 'center', color: '#ffe040', outline: '#000000' });
    const info = sel.special ? `SPECIAL: ${sel.specialName} (B + DIRECTION)` : 'A: CHOOSE  B: BACK  START: ALL SET';
    g.text(info, 128, 202, { align: 'center', color: '#ffffff', outline: '#401030' });
  }
}

/** Cursor and label colour for each player slot. */
const CURSOR_COLORS = ['#ffffff', '#a0a0b0', '#ff5050', '#50a0ff', '#60e060'];

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
    } else if (pad.pressed('b')) {
      pad.swallow();
      this.setup.backFromCharacters();
    }
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'SELECT TEAM MEMBERS', this.app.frame);
    drawPanel(g, 12, 36, 232, 70, '#c04040', '#401010');
    drawPanel(g, 12, 112, 232, 70, '#4060d0', '#101850');
    g.text('TEAM A', 20, 42, { color: '#ffd0d0', outline: '#000000' });
    g.text('TEAM B', 20, 118, { color: '#d0e0ff', outline: '#000000' });
    const act = this.active();
    act.forEach((i, k) => {
      const p = this.setup.cfg.players[i];
      const x = 30 + k * 44;
      const y = p.team === 0 ? 60 : 136;
      drawBomberIcon(g, i, i, x, y, this.app.frame, p.character);
      g.text(`P${i + 1}`, x + 8, y + 30, { align: 'center', color: k === this.sel ? '#ffe040' : '#ffffff', outline: '#000000' });
      if (k === this.sel && Math.floor(this.app.frame / 8) % 2 === 0) g.text('↑↓', x + 8, y - 10, { align: 'center', color: '#ffe040', outline: '#000000' });
    });
    g.text('← → PLAYER   ↑ ↓ TEAM   A: OK', g.width / 2, 196, { align: 'center', color: '#c8ffe0', outline: '#000000' });
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
    } else if (pad.pressed('b') || pad.pressed('select')) {
      pad.swallow();
      this.app.audio.sfx('menuBack');
      this.setup.backFromStage();
    }
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'SELECT STAGE', this.app.frame);
    const a = this.arena;
    const ox = 53 + this.slide;
    drawPanel(g, ox - 5, 33, 160, 138, '#28a068', '#0c4028');
    drawArenaPreview(g, a, ox, 38, 10);
    g.text('◀', 20, 96, { scale: 2, color: '#ffe040', outline: '#000000' });
    g.text('▶', 224, 96, { scale: 2, color: '#ffe040', outline: '#000000' });
    // Name banner
    drawPanel(g, 24, 173, 208, 17, '#1c6848', '#082818');
    g.text(`${this.setup.cfg.stage + 1}/8  ${a.name}${a.alternate ? ' ALT' : ''}`, g.width / 2, 178, { align: 'center', color: a.alternate ? '#ff9ad0' : '#ffe040', outline: '#000000' });
    g.text(a.blurb, g.width / 2, 196, { align: 'center', color: '#ffffff', outline: '#000000' });
    g.text(LEVEL_NAMES[this.setup.cfg.level] + (this.altOpen ? '   ↑↓ ALTERNATE' : ''), g.width / 2, 210, { align: 'center', color: '#a8ffc8', outline: '#000000' });
  }
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
        { label: 'ITEM SELECTION', action: () => app.scenes.go(new ItemSetScene(app, setup, () => app.scenes.go(new CustomScene(app, setup)))) },
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
    drawTitleBar(g, 'CUSTOM SETTING', this.app.frame);
    drawPanel(g, 48, 70, 160, 72, '#28a068', '#0c4028');
    this.menu.draw(g, 128, 84, { center: true, lineH: 18, width: 120 });
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
    if ((pad.repeat('b') || pad.repeat('c')) && (items[kind] ?? 0) > 0) {
      items[kind] = (items[kind] ?? 0) - 1;
      this.app.audio.sfx('select');
    }
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'ITEM SELECTION', this.app.frame);
    drawPanel(g, 16, 30, 224, 156, '#28a068', '#0c4028');
    const items = this.setup.cfg.customItems!;
    const s = sprites();
    const txt = { color: '#ffffff', outline: '#000000' };
    CUSTOM_ITEMS.forEach((kind, i) => {
      const x = 36 + Math.floor(i / ITEM_ROWS) * 72;
      const y = 38 + (i % ITEM_ROWS) * 24;
      if (i === this.sel) g.frame(x - 3, y - 3, 44, 22, '#ffe040');
      g.image(s.items[kind], x, y);
      g.text(`×${items[kind] ?? 0}`, x + 20, y + 5, txt);
    });
    const left = this.capacity - this.total();
    g.text(`LEFT ${left}`, 36, 165, { ...txt, color: left > 0 ? '#c8ffe0' : '#ff8080' });
    if (this.onEnd) g.frame(174, 159, 46, 18, '#ffe040');
    g.text('END', 197, 165, { ...txt, align: 'center' });
    const name = this.onEnd ? 'START THE BATTLE' : ITEM_NAMES[CUSTOM_ITEMS[this.sel]];
    g.text(name, g.width / 2, 192, { align: 'center', color: '#ffe040', outline: '#000000' });
    g.text('A: MORE  B: LESS  START: END', g.width / 2, 206, { align: 'center', color: '#c8ffe0', outline: '#000000' });
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
    items.push({ label: 'EXIT', action: () => this.back() });
    this.menu = new Menu(app, items, () => this.back());
  }

  update(): void {
    this.menu.update();
  }

  render(g: Gfx): void {
    drawMenuBackdrop(g, this.app.frame);
    drawTitleBar(g, 'HANDICAP', this.app.frame);
    drawPanel(g, 28, 48, 200, 130, '#28a068', '#0c4028');
    this.menu.draw(g, 44, 62, { lineH: 18, valueX: 170 });
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
