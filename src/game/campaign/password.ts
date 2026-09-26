/**
 * 8-character passwords (like the PlayStation version's "93EB0G93").
 * 40 bits = stage(6) bombs(4) fire(3) version(1) salt(10) checksum(16), scrambled
 * with a salt-seeded keystream so consecutive passwords look unrelated.
 */
export const PASSWORD_ALPHABET = '0123456789ABCDEFGHJKLMNPRSTUVWXY';
export const PASSWORD_LENGTH = 8;

export interface PasswordData {
  stage: number; // 1..50
  bombs: number; // 1..10
  fire: number; // 1..5
  modern: boolean;
}

function checksum(payload: number, salt: number): number {
  let h = 0x9e37 ^ salt;
  for (let i = 0; i < 4; i++) {
    h = Math.imul(h ^ ((payload >>> (i * 4)) & 0xf), 0x2f1b) & 0xffff;
    h = ((h << 5) | (h >>> 11)) & 0xffff;
  }
  return h;
}

function keystream(salt: number): number {
  let x = (salt * 2654435761) >>> 0;
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
export function encodePassword(d: PasswordData, salt = checksum(packPayload(d), 0x2a5) & 0x3ff): string {
  const payload = packPayload(d);
  const s = salt & 0x3ff;
  const scrambled = payload ^ keystream(s);
  const sum = checksum(payload, s);
  // 40-bit value: [scrambled:14][salt:10][checksum:16]
  const hi = (scrambled << 10) | s; // 24 bits
  const bits = hi * 65536 + sum; // < 2^40, exact in a double
  let out = '';
  let v = bits;
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    out = PASSWORD_ALPHABET[v % 32] + out;
    v = Math.floor(v / 32);
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
    v = v * 32 + n;
  }
  const sum = v % 65536;
  const hi = Math.floor(v / 65536);
  const salt = hi & 0x3ff;
  const scrambled = hi >>> 10;
  const payload = (scrambled ^ keystream(salt)) & 0x3fff;
  if (checksum(payload, salt) !== sum) return null;
  const stage = (payload & 0x3f) + 1;
  const bombs = ((payload >>> 6) & 0xf) + 1;
  const fire = ((payload >>> 10) & 0x7) + 1;
  if (stage > 50 || bombs > 10 || fire > 5) return null;
  return { stage, bombs, fire, modern: ((payload >>> 13) & 1) === 1 };
}
