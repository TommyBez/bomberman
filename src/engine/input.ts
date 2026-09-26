/**
 * Input: keyboard, gamepads and an on-screen touch pad, all mapped onto virtual
 * PlayStation-style controllers: D-pad, A (○ bomb), B (× special), C (□ punch / push /
 * multi bomb), D (△ stop a kicked bomb / back), START and SELECT.
 *
 *  - `menu` merges every device, so anyone can drive the menus.
 *  - `players[i]` read only the devices assigned to player slot i (battle mode).
 *  - Directions keep a "most recently pressed wins" order, which is what makes
 *    Bomberman feel responsive when sliding around pillars.
 */

export type Dir = 'up' | 'down' | 'left' | 'right';
export type Button = Dir | 'a' | 'b' | 'c' | 'd' | 'start' | 'select';
export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];
const BUTTONS: readonly Button[] = ['up', 'down', 'left', 'right', 'a', 'b', 'c', 'd', 'start', 'select'];

/**
 * Gamepad face-button layouts (Option → Controller), listed as the buttons for the
 * bottom, right, left and top face buttons. Type B is the original PlayStation layout
 * (○ bombs, × specials).
 */
export const PAD_LAYOUTS: { name: string; face: [Button, Button, Button, Button] }[] = [
  { name: 'TYPE A', face: ['a', 'b', 'c', 'd'] },
  { name: 'TYPE B', face: ['b', 'a', 'c', 'd'] },
  { name: 'TYPE C', face: ['a', 'c', 'b', 'd'] },
  { name: 'TYPE D', face: ['c', 'b', 'a', 'd'] },
];

export type DeviceId = 'kb' | 'kb1' | 'kb2' | 'pad0' | 'pad1' | 'pad2' | 'pad3' | 'touch';
export const ALL_DEVICES: readonly DeviceId[] = ['kb', 'pad0', 'pad1', 'pad2', 'pad3', 'touch'];

type KeyMap = Record<string, Button>;

/** Single player / menus: every sensible key works. */
const KB_SOLO: KeyMap = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  Space: 'a', KeyX: 'a', KeyJ: 'a', KeyF: 'a',
  KeyZ: 'b', KeyK: 'b', KeyG: 'b', ShiftLeft: 'b', ShiftRight: 'b',
  KeyC: 'c', KeyL: 'c', KeyE: 'c',
  KeyV: 'd', KeyQ: 'd', KeyI: 'd',
  Enter: 'start', NumpadEnter: 'start', KeyP: 'start',
  Escape: 'select', Backspace: 'select', Tab: 'select',
};

/** Battle, keyboard player 1 (left hand). */
const KB1: KeyMap = {
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  Space: 'a', KeyF: 'a',
  ShiftLeft: 'b', KeyG: 'b',
  KeyE: 'c', KeyR: 'c',
  KeyQ: 'd', KeyT: 'd',
};

/** Battle, keyboard player 2 (right hand). */
const KB2: KeyMap = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'a', NumpadEnter: 'a', Numpad0: 'a', Slash: 'a',
  ShiftRight: 'b', Period: 'b', NumpadDecimal: 'b',
  ControlRight: 'c', Comma: 'c', Numpad1: 'c', Backslash: 'c',
  Quote: 'd', Semicolon: 'd', Numpad2: 'd',
};

const KEYMAPS: Partial<Record<DeviceId, KeyMap>> = { kb: KB_SOLO, kb1: KB1, kb2: KB2 };

/** Keys that open the pause menu in battle regardless of who presses them. */
const SYSTEM_PAUSE_KEYS = new Set(['Escape', 'KeyP', 'Backspace']);

const REPEAT_DELAY = 18;
const REPEAT_RATE = 6;

export class Controller {
  devices: DeviceId[];
  private cur = new Set<Button>();
  private prev = new Set<Button>();
  private holdFrames = new Map<Button, number>();
  private dirStack: Dir[] = [];

  constructor(devices: DeviceId[] = []) {
    this.devices = devices;
  }

  /** Recompute state from the raw device state. Called once per game tick. */
  update(input: Input): void {
    const next = new Set<Button>();
    for (const d of this.devices) {
      for (const b of input.deviceState(d)) next.add(b);
    }
    this.prev = this.cur;
    this.cur = next;
    for (const b of BUTTONS) {
      if (next.has(b)) this.holdFrames.set(b, (this.holdFrames.get(b) ?? 0) + 1);
      else this.holdFrames.delete(b);
    }
    this.dirStack = this.dirStack.filter((d) => next.has(d));
    for (const d of DIRS) {
      if (next.has(d) && !this.dirStack.includes(d)) this.dirStack.push(d);
    }
  }

  /** Forget everything (e.g. when switching scenes) so a held key does not re-trigger. */
  swallow(): void {
    this.prev = new Set(this.cur);
    for (const b of this.cur) this.holdFrames.set(b, REPEAT_DELAY * 4);
  }

  held(b: Button): boolean {
    return this.cur.has(b);
  }

  pressed(b: Button): boolean {
    return this.cur.has(b) && !this.prev.has(b);
  }

  released(b: Button): boolean {
    return !this.cur.has(b) && this.prev.has(b);
  }

  /** Pressed, or held long enough to auto-repeat (menus). */
  repeat(b: Button): boolean {
    const f = this.holdFrames.get(b) ?? 0;
    if (f === 1) return true;
    return f > REPEAT_DELAY && (f - REPEAT_DELAY) % REPEAT_RATE === 0;
  }

  /** The most recently pressed direction that is still held. */
  get dir(): Dir | null {
    return this.dirStack.length ? this.dirStack[this.dirStack.length - 1] : null;
  }

  /** Every held direction, most recent first. */
  get dirs(): Dir[] {
    return [...this.dirStack].reverse();
  }

  anyPressed(): boolean {
    for (const b of this.cur) if (!this.prev.has(b)) return true;
    return false;
  }
}

export class Input {
  readonly menu = new Controller([...ALL_DEVICES]);
  readonly players: Controller[] = [0, 1, 2, 3, 4].map(() => new Controller());
  private keys = new Set<string>();
  /** Keys pressed since the last poll (so a tap shorter than a frame still registers). */
  private tapped = new Set<string>();
  private touchTapped = new Set<Button>();
  private padStates: Set<Button>[] = [new Set(), new Set(), new Set(), new Set()];
  private touchState = new Set<Button>();
  private systemPause = false;
  private systemPausePrev = false;
  private gestureListeners: (() => void)[] = [];
  /** True once a real touch has been seen; used to show the on-screen pad. */
  touchActive = false;
  /** While typing text (passwords), letter/digit keys and Backspace are not buttons. */
  textEntry = false;
  /** Gamepad vibration (Option → Controller). */
  vibration = true;
  /** Face-button layout (index into PAD_LAYOUTS) for each of the four gamepads. */
  padLayouts: number[] = [0, 0, 0, 0];
  private focusLost = false;

  attach(win: Window): void {
    win.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isBound(e.code)) e.preventDefault();
      if (!e.repeat) this.tapped.add(e.code);
      this.keys.add(e.code);
      this.gesture();
    });
    win.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    win.addEventListener('blur', () => {
      this.keys.clear();
      this.focusLost = true;
    });
    win.addEventListener('pointerdown', () => this.gesture());
    win.addEventListener('gamepadconnected', () => this.gesture());
  }

  /** Register a callback run on the first user gesture (needed to unlock WebAudio). */
  onGesture(fn: () => void): void {
    this.gestureListeners.push(fn);
  }

  private gesture(): void {
    for (const fn of this.gestureListeners) fn();
  }

  /** Wire the on-screen touch controller. */
  attachTouch(doc: Document): void {
    const body = doc.body;
    const win = doc.defaultView as Window;
    const enable = (): void => {
      if (!this.touchActive) {
        this.touchActive = true;
        body.classList.add('touch');
        win.dispatchEvent(new Event('resize'));
      }
    };
    if (win.matchMedia?.('(pointer: coarse)').matches) enable();
    win.addEventListener('touchstart', enable, { passive: true });

    const pad = doc.getElementById('tp-dpad');
    if (pad) {
      const active = new Map<number, Dir[]>();
      const recompute = (): void => {
        for (const d of DIRS) this.touchState.delete(d);
        for (const dirs of active.values()) for (const d of dirs) this.touchState.add(d);
      };
      const track = (e: PointerEvent): void => {
        const r = pad.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const dead = r.width * 0.1;
        const dirs: Dir[] = [];
        if (Math.hypot(dx, dy) > dead) {
          const ax = Math.abs(dx);
          const ay = Math.abs(dy);
          if (ax >= ay * 0.45) dirs.push(dx < 0 ? 'left' : 'right');
          if (ay >= ax * 0.45) dirs.push(dy < 0 ? 'up' : 'down');
        }
        active.set(e.pointerId, dirs);
        recompute();
      };
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pad.setPointerCapture(e.pointerId);
        track(e);
        this.gesture();
      });
      pad.addEventListener('pointermove', (e) => {
        if (active.has(e.pointerId)) track(e);
      });
      const end = (e: PointerEvent): void => {
        active.delete(e.pointerId);
        recompute();
      };
      pad.addEventListener('pointerup', end);
      pad.addEventListener('pointercancel', end);
    }

    const bindButton = (id: string, ...buttons: Button[]): void => {
      const el = doc.getElementById(id);
      if (!el) return;
      const pointers = new Set<number>();
      const sync = (): void => {
        for (const button of buttons) {
          if (pointers.size) this.touchState.add(button);
          else this.touchState.delete(button);
        }
        el.classList.toggle('on', pointers.size > 0);
      };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        pointers.add(e.pointerId);
        for (const button of buttons) this.touchTapped.add(button);
        sync();
        this.gesture();
      });
      const end = (e: PointerEvent): void => {
        pointers.delete(e.pointerId);
        sync();
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    };
    bindButton('tb-a', 'a');
    bindButton('tb-b', 'b');
    // The on-screen C button covers both □ (punch/push) and △ (stop a kicked bomb).
    bindButton('tb-c', 'c', 'd');
    bindButton('tb-start', 'start');
    bindButton('tb-select', 'select');
  }

  /** Poll gamepads and advance every controller by one tick. */
  poll(): void {
    this.pollPads();
    this.systemPausePrev = this.systemPause;
    let sys = false;
    for (const k of SYSTEM_PAUSE_KEYS) if (this.keys.has(k)) sys = true;
    for (const p of this.padStates) if (p.has('start')) sys = true;
    if (this.touchState.has('start')) sys = true;
    for (const k of this.tapped) if (SYSTEM_PAUSE_KEYS.has(k)) sys = true;
    this.systemPause = sys;
    this.menu.update(this);
    for (const c of this.players) c.update(this);
    this.tapped.clear();
    this.touchTapped.clear();
  }

  /** True once after the window lost focus (games pause themselves). */
  takeFocusLoss(): boolean {
    const lost = this.focusLost;
    this.focusLost = false;
    return lost;
  }

  /** START/ESC pressed on any device this tick (battle pause). */
  systemPausePressed(): boolean {
    return this.systemPause && !this.systemPausePrev;
  }

  /** Raw button set for a device. */
  deviceState(dev: DeviceId): Set<Button> {
    if (dev === 'touch') {
      if (!this.touchTapped.size) return this.touchState;
      return new Set([...this.touchState, ...this.touchTapped]);
    }
    if (dev.startsWith('pad')) return this.padStates[Number(dev.slice(3))] ?? new Set();
    const map = KEYMAPS[dev];
    const out = new Set<Button>();
    if (!map) return out;
    for (const code of this.keys) {
      const b = map[code];
      if (b && !this.typing(code)) out.add(b);
    }
    for (const code of this.tapped) {
      const b = map[code];
      if (b && !this.typing(code)) out.add(b);
    }
    return out;
  }

  private typing(code: string): boolean {
    return this.textEntry && (code.startsWith('Key') || code.startsWith('Digit') || code === 'Backspace');
  }

  /** Rumble every gamepad among `devices` (strength 0..1). */
  rumble(devices: readonly DeviceId[], strength: number, ms: number): void {
    if (!this.vibration || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (const d of devices) {
      if (!d.startsWith('pad')) continue;
      const act = (pads[Number(d.slice(3))] as (Gamepad & { vibrationActuator?: GamepadHapticActuator | null }) | null)?.vibrationActuator;
      if (!act || !('playEffect' in act)) continue;
      const s = Math.max(0, Math.min(1, strength));
      void act.playEffect('dual-rumble', { duration: ms, strongMagnitude: s, weakMagnitude: Math.min(1, s * 0.7 + 0.2) }).catch(() => {});
    }
  }

  /** Names of connected gamepads (index → id). */
  connectedPads(): boolean[] {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    return [0, 1, 2, 3].map((i) => !!pads[i]);
  }

  private pollPads(): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < 4; i++) {
      const s = this.padStates[i];
      const hadInput = s.size > 0;
      s.clear();
      const p = pads[i];
      if (!p || !p.connected) continue;
      const btn = (n: number): boolean => !!p.buttons[n]?.pressed;
      const ax = p.axes[0] ?? 0;
      const ay = p.axes[1] ?? 0;
      if (btn(12) || ay < -0.5) s.add('up');
      if (btn(13) || ay > 0.5) s.add('down');
      if (btn(14) || ax < -0.5) s.add('left');
      if (btn(15) || ax > 0.5) s.add('right');
      const face = (PAD_LAYOUTS[this.padLayouts[i]] ?? PAD_LAYOUTS[0]).face;
      for (let k = 0; k < 4; k++) if (btn(k)) s.add(face[k]);
      if (btn(4) || btn(5)) s.add('b');
      if (btn(6) || btn(7)) s.add('c');
      if (btn(9)) s.add('start');
      if (btn(8)) s.add('select');
      if (!hadInput && s.size > 0) this.gesture();
    }
  }
}

function isBound(code: string): boolean {
  return code in KB_SOLO || code in KB1 || code in KB2 || SYSTEM_PAUSE_KEYS.has(code);
}
