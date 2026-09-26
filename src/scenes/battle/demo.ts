import type { App } from '../../app';
import { arenasFor } from '../../game/battle/arenas';
import { charactersFor } from '../../game/battle/characters';
import { defaultConfig, type Level } from '../../game/battle/config';
import { goTitle } from '../nav';
import { BattleMatch } from './match';

/** Length of the attract-mode game before it returns to the title. */
export const DEMO_TICKS = 40 * 60;

/** Title-screen attract mode: five computer players fight on a random stage. */
export function startDemo(app: App): void {
  const cfg = defaultConfig();
  const levels: Level[] = ['beginner', 'normal', 'advanced'];
  cfg.level = levels[Math.floor(Math.random() * levels.length)];
  cfg.stage = Math.floor(Math.random() * arenasFor(cfg.level).length);
  cfg.rules.com = 'strong';
  cfg.rules.cart = 'off';
  const chars = charactersFor(cfg.level)
    .map((c) => c.id)
    .sort(() => Math.random() - 0.5);
  cfg.players.forEach((p, i) => {
    p.type = 'com';
    p.devices = [];
    p.character = cfg.level === 'beginner' ? 'bomberman' : chars[i % chars.length];
  });
  new BattleMatch(app, cfg, () => goTitle(app), true).start();
}
