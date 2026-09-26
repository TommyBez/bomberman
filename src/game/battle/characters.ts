import type { Level } from './config';

/**
 * Battle characters. Beginner: Bomberman only. Normal: Bomberman and seven "world bombers"
 * (same abilities, their own CPU personalities). Advanced: eight fighters with a special move
 * on B + direction. All designs in this remake are original.
 */
export type Special = 'jet' | 'bazooka' | 'great' | 'hammer' | 'laser' | 'pistol' | 'sword';

export interface Personality {
  /** 0..1: how eagerly the CPU attacks. */
  aggression: number;
  /** 0..1: how much it values items. */
  greed: number;
  /** 0..1: safety margin when escaping. */
  caution: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  levels: Level[];
  /** Accessory drawn over the bomber sprite. */
  look: 'none' | 'ushanka' | 'mohawk' | 'sombrero' | 'horns' | 'cap' | 'bow' | 'queue' | 'crown' | 'jetpack' | 'bazooka' | 'hammer' | 'tiara' | 'cowboy' | 'kabuto';
  special?: Special;
  specialName?: string;
  personality: Personality;
}

const P = (aggression: number, greed: number, caution: number): Personality => ({ aggression, greed, caution });

export const CHARACTERS: Record<string, CharacterDef> = {
  bomberman: { id: 'bomberman', name: 'BOMBERMAN', levels: ['beginner', 'normal', 'advanced'], look: 'none', personality: P(0.5, 0.5, 0.5) },
  cossack: { id: 'cossack', name: 'COSSACK BOMBER', levels: ['normal'], look: 'ushanka', personality: P(0.6, 0.4, 0.6) },
  punk: { id: 'punk', name: 'PUNK BOMBER', levels: ['normal'], look: 'mohawk', personality: P(0.9, 0.3, 0.3) },
  mexican: { id: 'mexican', name: 'MEXICAN BOMBER', levels: ['normal'], look: 'sombrero', personality: P(0.4, 0.8, 0.5) },
  barbarian: { id: 'barbarian', name: 'BARBARIAN BOMBER', levels: ['normal'], look: 'horns', personality: P(0.8, 0.5, 0.2) },
  kid: { id: 'kid', name: 'BOMBER THE KID', levels: ['normal'], look: 'cap', personality: P(0.5, 0.7, 0.4) },
  pretty: { id: 'pretty', name: 'PRETTY BOMBER', levels: ['normal'], look: 'bow', personality: P(0.3, 0.6, 0.8) },
  chen: { id: 'chen', name: 'BOMBER CHEN', levels: ['normal'], look: 'queue', personality: P(0.6, 0.6, 0.6) },
  great: { id: 'great', name: 'GREAT BOMBER', levels: ['advanced'], look: 'crown', special: 'great', specialName: 'INVINCIBLE', personality: P(0.7, 0.5, 0.5) },
  jet: { id: 'jet', name: 'JET BOMBER', levels: ['advanced'], look: 'jetpack', special: 'jet', specialName: 'JET DASH', personality: P(0.6, 0.7, 0.4) },
  bazooka: { id: 'bazooka', name: 'BAZOOKA BOMBER', levels: ['advanced'], look: 'bazooka', special: 'bazooka', specialName: 'BAZOOKA', personality: P(0.7, 0.4, 0.5) },
  hammer: { id: 'hammer', name: 'HAMMER BOMBER', levels: ['advanced'], look: 'hammer', special: 'hammer', specialName: 'HAMMER', personality: P(0.8, 0.4, 0.4) },
  lady: { id: 'lady', name: 'LADY BOMBER', levels: ['advanced'], look: 'tiara', special: 'laser', specialName: 'LASER BITS', personality: P(0.5, 0.6, 0.6) },
  honey: { id: 'honey', name: 'HONEY', levels: ['advanced'], look: 'cowboy', special: 'pistol', specialName: 'PISTOL', personality: P(0.6, 0.6, 0.5) },
  kotetsu: { id: 'kotetsu', name: 'KOTETSU', levels: ['advanced'], look: 'kabuto', special: 'sword', specialName: 'SWORD', personality: P(0.8, 0.3, 0.5) },
};

export function charactersFor(level: Level): CharacterDef[] {
  return Object.values(CHARACTERS).filter((c) => c.levels.includes(level));
}

export type PartnerKind =
  | 'louieYellow'
  | 'louieBlue'
  | 'louieGreen'
  | 'louiePink'
  | 'louieBrown'
  | 'pytera'
  | 'simeon'
  | 'drakko'
  | 'coney'
  | 'dox';

export interface PartnerDef {
  kind: PartnerKind;
  name: string;
  ability: string;
  level: Level;
  color: string;
}

/** Rideable partners hatched from eggs (Normal and Advanced levels). */
export const PARTNERS: PartnerDef[] = [
  { kind: 'louieYellow', name: 'YELLOW ROO', ability: 'BLOCK KICK', level: 'normal', color: '#f0d040' },
  { kind: 'louieBlue', name: 'BLUE ROO', ability: 'BOMB PASS KICK', level: 'normal', color: '#4a80f0' },
  { kind: 'louieGreen', name: 'GREEN ROO', ability: 'DASH', level: 'normal', color: '#40c060' },
  { kind: 'louiePink', name: 'PINK ROO', ability: 'JUMP', level: 'normal', color: '#f080c0' },
  { kind: 'louieBrown', name: 'BROWN ROO', ability: 'MULTI BOMB', level: 'normal', color: '#a06a38' },
  { kind: 'pytera', name: 'PTERY', ability: 'SWALLOW BOMB', level: 'advanced', color: '#e05040' },
  { kind: 'simeon', name: 'MONKEY', ability: 'LIFT BLOCK', level: 'advanced', color: '#c08850' },
  { kind: 'drakko', name: 'DRAKE', ability: 'HIP ATTACK', level: 'advanced', color: '#50b050' },
  { kind: 'coney', name: 'SHELLY', ability: 'MULTI BOMB + SHELL', level: 'advanced', color: '#e0a0e0' },
  { kind: 'dox', name: 'BOAR', ability: 'CHARGE', level: 'advanced', color: '#806040' },
];
