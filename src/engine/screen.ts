/**
 * Low-resolution frame buffer blitted to the visible canvas with nearest-neighbour
 * scaling. Integer scaling is used whenever the window is large enough so every
 * game pixel stays perfectly square.
 */
export class Screen {
  readonly buffer: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private readonly out: CanvasRenderingContext2D;

  constructor(
    private readonly display: HTMLCanvasElement,
    readonly width: number,
    readonly height: number,
  ) {
    this.buffer = document.createElement('canvas');
    this.buffer.width = width;
    this.buffer.height = height;
    const ctx = this.buffer.getContext('2d', { alpha: false });
    const out = display.getContext('2d', { alpha: false });
    if (!ctx || !out) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
    this.out = out;
    this.ctx.imageSmoothingEnabled = false;
    window.addEventListener('resize', () => this.fit());
    window.visualViewport?.addEventListener('resize', () => this.fit());
    this.fit();
  }

  /** Recompute the on-screen size of the canvas. */
  fit(): void {
    const dpr = window.devicePixelRatio || 1;
    const touch = document.body.classList.contains('touch');
    const vw = window.innerWidth;
    let vh = window.innerHeight;
    const portrait = vh > vw;
    // On phones held upright keep the lower part of the screen for the touch pad.
    if (touch && portrait) vh = Math.max(this.height, Math.min(vh * 0.6, vh - 230));
    let scale = Math.min((vw * dpr) / this.width, (vh * dpr) / this.height);
    if (scale >= 2) scale = Math.floor(scale);
    const devW = Math.max(1, Math.round(this.width * scale));
    const devH = Math.max(1, Math.round(this.height * scale));
    this.display.width = devW;
    this.display.height = devH;
    this.display.style.width = `${devW / dpr}px`;
    this.display.style.height = `${devH / dpr}px`;
    const stage = this.display.parentElement;
    if (stage) stage.style.alignItems = touch && portrait ? 'flex-start' : 'center';
    this.out.imageSmoothingEnabled = false;
  }

  /** Copy the frame buffer to the visible canvas. */
  present(): void {
    this.out.imageSmoothingEnabled = false;
    this.out.drawImage(this.buffer, 0, 0, this.display.width, this.display.height);
  }
}
