import { PixelCanvas } from './pixel';
import { BOMBER_COLORS, type BomberColors } from './sprites';

const dizzyCache = new Map<string, HTMLCanvasElement[]>();

/**
 * A bomber sitting on the floor with swirling eyes, feet out in front (two frames: the
 * spirals turn). Game Over and a missed Hyper Bomber throw.
 */
export function dizzySprite(frame: number, c: BomberColors = BOMBER_COLORS[0]): HTMLCanvasElement {
  let frames = dizzyCache.get(c.name);
  if (!frames) {
    const helmet = c.helmet[0];
    const pink = c.accent[1];
    frames = [0, 1].map((f) => {
      const p = new PixelCanvas(24, 24);
      // Feet stuck out in front, body, arms.
      p.ellipse(5.5, 20, 4.5, 3.2, '#000000');
      p.ellipse(18.5, 20, 4.5, 3.2, '#000000');
      p.ellipse(5.5, 19.6, 3.6, 2.4, pink);
      p.ellipse(18.5, 19.6, 3.6, 2.4, pink);
      p.ellipse(4.5, 18.8, 1.5, 0.8, c.accent[0]);
      p.ellipse(17.5, 18.8, 1.5, 0.8, c.accent[0]);
      p.rect(8, 15, 8, 6, '#000000');
      p.rect(9, 15, 6, 5, c.suit[1]);
      p.rect(9, 19, 6, 1, '#202020');
      p.circle(6.5, 16, 2.2, '#000000');
      p.circle(17.5, 16, 2.2, '#000000');
      p.circle(6.5, 16, 1.4, pink);
      p.circle(17.5, 16, 1.4, pink);
      // Head, antenna, face.
      p.rect(11, 1, 2, 3, '#000000');
      p.circle(12, 1.5, 1.6, pink);
      p.roundRect(3, 3, 18, 13, '#000000', 5);
      p.roundRect(4, 4, 16, 11, helmet, 4);
      p.roundRect(6, 6, 12, 8, '#000000', 2);
      p.roundRect(7, 7, 10, 6, '#ffc890', 2);
      // Swirling eyes.
      const spiral = f ? ['.aaa', 'a...', 'a.a.', 'aaa.'] : ['aaa.', '...a', '.a.a', '.aaa'];
      p.rows(spiral, { a: '#803010' }, 7, 8);
      p.rows(spiral, { a: '#803010' }, 13, 8);
      return p.canvas;
    });
    dizzyCache.set(c.name, frames);
  }
  return frames[frame % 2];
}
