import { mix, silhouette, type Gfx } from '../../engine/gfx';
import type { ArenaDef } from '../../game/battle/arenas';
import { characterSprites } from '../../gfx/battleSprites';
import { THEMES } from '../../gfx/tiles';

const previewCache = new Map<string, HTMLCanvasElement>();

/** Mini-map of a battle stage for the stage-select carousel. */
export function drawArenaPreview(g: Gfx, a: ArenaDef, x: number, y: number, scale: number): void {
  const key = `${a.id}:${scale}`;
  let c = previewCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = 15 * scale;
    c.height = 13 * scale;
    const ctx = c.getContext('2d')!;
    const t = THEMES[a.theme] ?? THEMES.battle;
    let seed = a.id.charCodeAt(1) * 31;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    a.map.forEach((row, ty) => {
      for (let tx = 0; tx < row.length; tx++) {
        const ch = row[tx];
        let col = t.floor;
        if (ch === '#') col = tx === 0 || ty === 0 || tx === 14 || ty === 12 ? t.wall : t.hard;
        else if (ch === 'x' || (ch === '.' && rnd() < a.density)) col = t.soft;
        else if ('><^v'.includes(ch)) col = '#e0c040';
        else if ('RLUD@'.includes(ch)) col = '#e05050';
        else if (ch === 'W') col = '#8060ff';
        else if (ch === 'T') col = '#ff4040';
        else if (ch === 'S') col = '#c08850';
        else if ('abcde!'.includes(ch) && a.gimmick === 'signs') col = '#4080ff';
        else if (ch === '=') col = '#a0a0b0';
        else if (ch === 's') col = '#2060ff';
        else if (ch === 'P' || ch === 'p' || ch === 'J') col = '#30a040';
        else if (ch === 'H') col = '#f0f8ff';
        else if (ch === 'F') col = '#2c7020';
        else if (ch === '~') col = '#1c58b0';
        else if (ch === 'b') col = '#b07a48';
        else if (ch === 'i') col = '#b8e0f8';
        else if (ch === 'G') col = '#f070b0';
        else if (ch === 'O') col = '#303030';
        else if ('12345'.includes(ch)) col = mix(t.floor, '#ffffff', 0.35);
        ctx.fillStyle = col;
        ctx.fillRect(tx * scale, ty * scale, scale, scale);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(tx * scale, ty * scale + scale - 1, scale, 1);
      }
    });
    previewCache.set(key, c);
  }
  g.image(c, x, y);
}

/** A player's bomber (character + colour); colour -1 draws a dim silhouette for OFF slots. */
export function drawBomberIcon(g: Gfx, _player: number, color: number, x: number, y: number, frame: number, character = 'bomberman', big = false): void {
  const sp = characterSprites(character, Math.max(0, color));
  let img = sp.walk.down[frame ? Math.floor(frame / 8) % 4 : 0];
  if (color < 0) img = silhouette(img, '#304038');
  if (big) {
    g.ctx.imageSmoothingEnabled = false;
    g.ctx.drawImage(img, x - 4, y - 8, 24, 36);
  } else g.image(img, x, y);
}
