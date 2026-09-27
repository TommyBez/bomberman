/**
 * 8-character passwords in the original's characters, 0–9 and A–G (like "93EB0G93").
 * 32 bits = stage(6) bombs(4) fire(3) version(1), scrambled with a 4-bit salt, plus a
 * 14-bit checksum, so consecutive passwords look unrelated and typos are caught.
 */
export const PASSWORD_ALPHABET = '0123456789ABCDEFG';
/** The characters the password roller turns through: the original's set runs to I. */
export const PASSWORD_GLYPHS = '0123456789ABCDEFGHI';
export const PASSWORD_LENGTH = 8;
const BASE = PASSWORD_ALPHABET.length;

export interface PasswordData {
  stage: number; // 1..50
  bombs: number; // 1..10
  fire: number; // 1..5
  modern: boolean;
}

function checksum(payload: number, salt: number): number {
  let h = 0x9e37 ^ (salt * 0x111);
  for (let i = 0; i < 4; i++) {
    h = Math.imul(h ^ ((payload >>> (i * 4)) & 0xf), 0x2f1b) & 0xffff;
    h = ((h << 5) | (h >>> 11)) & 0xffff;
  }
  return h & 0x3fff; // 14 bits
}

function keystream(salt: number): number {
  let x = ((salt + 1) * 2654435761) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0x5bd1e995) >>> 0;
  x ^= x >>> 15;
  return x & 0x3fff; // 14 bits, covers the payload
}

function packPayload(d: PasswordData): number {
  const stage = Math.max(1, Math.min(50, d.stage)) - 1;
  const bombs = Math.max(1, Math.min(10, d.bombs)) - 1;
  const fire = Math.max(1, Math.min(5, d.fire)) - 1;
  return (stage | (bombs << 6) | (fire << 10) | ((d.modern ? 1 : 0) << 13)) & 0x3fff;
}

/** The same progress always gives the same password (the salt is derived from it by default). */
export function encodePassword(d: PasswordData, salt = checksum(packPayload(d), 5) & 0xf): string {
  const payload = packPayload(d);
  const s = salt & 0xf;
  const scrambled = payload ^ keystream(s);
  // 32-bit value: [scrambled:14][salt:4][checksum:14]
  let v = (scrambled * 16 + s) * 16384 + checksum(payload, s);
  let out = '';
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    out = PASSWORD_ALPHABET[v % BASE] + out;
    v = Math.floor(v / BASE);
  }
  return out;
}

export function decodePassword(text: string): PasswordData | null {
  const t = text.toUpperCase().replace(/\s/g, '');
  if (t.length !== PASSWORD_LENGTH) return null;
  let v = 0;
  for (const ch of t) {
    const n = PASSWORD_ALPHABET.indexOf(ch);
    if (n < 0) return null;
    v = v * BASE + n;
  }
  if (v >= 2 ** 32) return null;
  const sum = v % 16384;
  const hi = Math.floor(v / 16384);
  const salt = hi % 16;
  const scrambled = Math.floor(hi / 16);
  const payload = (scrambled ^ keystream(salt)) & 0x3fff;
  if (checksum(payload, salt) !== sum) return null;
  const stage = (payload & 0x3f) + 1;
  const bombs = ((payload >>> 6) & 0xf) + 1;
  const fire = ((payload >>> 10) & 0x7) + 1;
  if (stage > 50 || bombs > 10 || fire > 5) return null;
  return { stage, bombs, fire, modern: ((payload >>> 13) & 1) === 1 };
}

/**
 * Codes from guides to the original PlayStation game: four that start at stages 10–40,
 * and "full power" codes for stages 1, 11, 21, 31 and 41, and stage 50 in either version.
 */
export const CLASSIC_CODES: Record<string, { stage: number; full: boolean; retro?: boolean }> = {
  '3G59E326': { stage: 10, full: false },
  '3D5D49C4': { stage: 20, full: false },
  '8D5E4B26': { stage: 30, full: false },
  '8D5A4BCE': { stage: 40, full: false },
  '46224622': { stage: 1, full: true },
  '10191019': { stage: 11, full: true },
  '12221222': { stage: 21, full: true },
  '26572657': { stage: 31, full: true },
  '38793879': { stage: 41, full: true },
  '93EB0G97': { stage: 50, full: true },
  '93EB0G93': { stage: 50, full: true, retro: true },
};
