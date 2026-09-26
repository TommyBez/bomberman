/**
 * Fixed-timestep main loop. The simulation always advances in 1/60 s ticks
 * (like the original hardware's frame-locked logic); rendering happens once per
 * animation frame.
 */
export const TICK_RATE = 60;
const STEP_MS = 1000 / TICK_RATE;
const MAX_CATCH_UP = 5;

export class Loop {
  private acc = 0;
  private last = 0;
  private running = false;
  private rafId = 0;

  constructor(
    private readonly tick: () => void,
    private readonly draw: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    let elapsed = now - this.last;
    this.last = now;
    // A backgrounded tab resumes without fast-forwarding the game.
    if (elapsed > 250) elapsed = STEP_MS;
    this.acc += elapsed;
    let steps = 0;
    while (this.acc >= STEP_MS && steps < MAX_CATCH_UP) {
      this.tick();
      this.acc -= STEP_MS;
      steps++;
    }
    if (steps === MAX_CATCH_UP) this.acc = 0;
    this.draw();
    this.rafId = requestAnimationFrame(this.frame);
  };
}
