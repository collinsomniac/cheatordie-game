import type { ControlIntent, RobotController, ControllerContext } from './types';

const DEADZONE = 0.15;
const TOUCH_LOOK_X = 0.00315;
const TOUCH_LOOK_Y = 0.00265;

export function primaryGamepad(): Gamepad | null {
  const pads = navigator.getGamepads();
  for (let index = 0; index < pads.length; index += 1) {
    const pad = pads[index];
    if (pad) return pad;
  }
  return null;
}

interface TouchSample {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  fire: boolean;
  jump: boolean;
  sprint: boolean;
  toggleCamera: boolean;
}

class TouchControls {
  private moveX = 0;
  private moveY = 0;
  private lookAccumX = 0;
  private lookAccumY = 0;
  private fire = false;
  private sprintHeld = false;
  private jumpQueued = false;
  private cameraQueued = false;
  private movePointer: number | null = null;
  private lookPointer: number | null = null;
  private firePointer: number | null = null;
  private lookLastX = 0;
  private lookLastY = 0;
  private fireLastX = 0;
  private fireLastY = 0;

  private readonly moveStick: HTMLElement | null;
  private readonly moveKnob: HTMLElement | null;
  private readonly lookZone: HTMLElement | null;
  private readonly fireButton: HTMLElement | null;
  private readonly jumpButton: HTMLElement | null;
  private readonly sprintButton: HTMLElement | null;
  private readonly cameraButton: HTMLElement | null;

  constructor(root: HTMLElement | null) {
    this.moveStick = root?.querySelector<HTMLElement>('[data-touch-stick="move"]') ?? null;
    this.moveKnob = this.moveStick?.querySelector<HTMLElement>('.touch-stick__knob') ?? null;
    this.lookZone = root?.querySelector<HTMLElement>('[data-touch-look]') ?? null;
    this.fireButton = root?.querySelector<HTMLElement>('[data-touch-button="fire"]') ?? null;
    this.jumpButton = root?.querySelector<HTMLElement>('[data-touch-button="jump"]') ?? null;
    this.sprintButton = root?.querySelector<HTMLElement>('[data-touch-button="sprint"]') ?? null;
    this.cameraButton = root?.querySelector<HTMLElement>('[data-touch-button="camera"]') ?? null;

    this.bindMovement();
    this.bindLookSurface();
    this.bindFire();
    this.bindHold(this.sprintButton, (value) => { this.sprintHeld = value; });
    this.bindTap(this.jumpButton, () => { this.jumpQueued = true; });
    this.bindTap(this.cameraButton, () => { this.cameraQueued = true; });
  }

  sample(): TouchSample {
    const lookX = this.lookAccumX;
    const lookY = this.lookAccumY;
    this.lookAccumX = 0;
    this.lookAccumY = 0;

    const jump = this.jumpQueued;
    const toggleCamera = this.cameraQueued;
    this.jumpQueued = false;
    this.cameraQueued = false;

    const autoSprint = this.moveY > 0.82 && Math.hypot(this.moveX, this.moveY) > 0.9;
    return {
      moveX: this.moveX,
      moveY: this.moveY,
      lookX,
      lookY,
      fire: this.fire,
      jump,
      sprint: this.sprintHeld || autoSprint,
      toggleCamera,
    };
  }

  clear(): void {
    this.moveX = 0;
    this.moveY = 0;
    this.lookAccumX = 0;
    this.lookAccumY = 0;
    this.fire = false;
    this.sprintHeld = false;
    this.jumpQueued = false;
    this.cameraQueued = false;
    this.movePointer = null;
    this.lookPointer = null;
    this.firePointer = null;
    this.resetMoveKnob();
    this.lookZone?.classList.remove('is-active');
    this.fireButton?.classList.remove('is-active');
    this.sprintButton?.classList.remove('is-active');
  }

  dispose(): void {
    this.clear();
  }

  private bindMovement(): void {
    const element = this.moveStick;
    if (!element) return;

    const update = (event: PointerEvent): void => {
      if (this.movePointer !== event.pointerId) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.37);
      let x = (event.clientX - cx) / radius;
      let y = (event.clientY - cy) / radius;
      const length = Math.hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }

      // Small physical dead zone prevents micro-drift without flattening the rest of the curve.
      const magnitude = Math.hypot(x, y);
      if (magnitude < 0.08) {
        x = 0;
        y = 0;
      }

      this.moveX = x;
      this.moveY = -y;
      if (this.moveKnob) {
        this.moveKnob.style.transform = `translate(${x * radius * 0.53}px, ${y * radius * 0.53}px)`;
      }
    };

    element.addEventListener('pointerdown', (event) => {
      if (this.movePointer !== null) return;
      event.preventDefault();
      this.movePointer = event.pointerId;
      element.setPointerCapture?.(event.pointerId);
      update(event);
    });
    element.addEventListener('pointermove', update);

    const release = (event: PointerEvent): void => {
      if (this.movePointer !== event.pointerId) return;
      event.preventDefault();
      this.movePointer = null;
      this.moveX = 0;
      this.moveY = 0;
      this.resetMoveKnob();
    };
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('lostpointercapture', release);
  }

  private bindLookSurface(): void {
    const element = this.lookZone;
    if (!element) return;

    element.addEventListener('pointerdown', (event) => {
      if (this.lookPointer !== null) return;
      event.preventDefault();
      this.lookPointer = event.pointerId;
      this.lookLastX = event.clientX;
      this.lookLastY = event.clientY;
      element.setPointerCapture?.(event.pointerId);
      element.classList.add('is-active');
    });

    element.addEventListener('pointermove', (event) => {
      if (this.lookPointer !== event.pointerId) return;
      event.preventDefault();
      this.addLookDelta(event.clientX - this.lookLastX, event.clientY - this.lookLastY);
      this.lookLastX = event.clientX;
      this.lookLastY = event.clientY;
    });

    const release = (event: PointerEvent): void => {
      if (this.lookPointer !== event.pointerId) return;
      event.preventDefault();
      this.lookPointer = null;
      element.classList.remove('is-active');
    };
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('lostpointercapture', release);
  }

  private bindFire(): void {
    const element = this.fireButton;
    if (!element) return;

    element.addEventListener('pointerdown', (event) => {
      if (this.firePointer !== null) return;
      event.preventDefault();
      this.firePointer = event.pointerId;
      this.fireLastX = event.clientX;
      this.fireLastY = event.clientY;
      this.fire = true;
      element.setPointerCapture?.(event.pointerId);
      element.classList.add('is-active');
    });

    // Fire-drag mirrors modern mobile shooters: keep firing while the same thumb fine-aims.
    element.addEventListener('pointermove', (event) => {
      if (this.firePointer !== event.pointerId) return;
      event.preventDefault();
      this.addLookDelta(event.clientX - this.fireLastX, event.clientY - this.fireLastY);
      this.fireLastX = event.clientX;
      this.fireLastY = event.clientY;
    });

    const release = (event: PointerEvent): void => {
      if (this.firePointer !== event.pointerId) return;
      event.preventDefault();
      this.firePointer = null;
      this.fire = false;
      element.classList.remove('is-active');
    };
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('lostpointercapture', release);
  }

  private addLookDelta(dx: number, dy: number): void {
    // Clamp pathological pointer jumps but preserve 1:1 relative response inside the useful range.
    this.lookAccumX += Math.max(-80, Math.min(80, dx)) * TOUCH_LOOK_X;
    this.lookAccumY += Math.max(-80, Math.min(80, dy)) * TOUCH_LOOK_Y;
  }

  private bindHold(element: HTMLElement | null, setValue: (value: boolean) => void): void {
    if (!element) return;
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      element.setPointerCapture?.(event.pointerId);
      setValue(true);
      element.classList.add('is-active');
    });
    const release = (event: PointerEvent): void => {
      event.preventDefault();
      setValue(false);
      element.classList.remove('is-active');
    };
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('lostpointercapture', release);
  }

  private bindTap(element: HTMLElement | null, action: () => void): void {
    if (!element) return;
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      action();
      element.classList.add('is-active');
    });
    const release = (): void => element.classList.remove('is-active');
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
  }

  private resetMoveKnob(): void {
    if (this.moveKnob) this.moveKnob.style.transform = 'translate(0px, 0px)';
  }
}

function deadzone(value: number): number {
  const abs = Math.abs(value);
  if (abs < DEADZONE) return 0;
  return Math.sign(value) * ((abs - DEADZONE) / (1 - DEADZONE));
}

export class InputManager {
  private readonly keys = new Set<string>();
  private pointerDX = 0;
  private pointerDY = 0;
  private firing = false;
  private jumpQueued = false;
  private cameraQueued = false;
  private gamepadCameraLatch = false;
  private readonly touch: TouchControls;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.touch = new TouchControls(document.querySelector<HTMLElement>('#touch-controls'));
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.touch.dispose();
  }

  requestPointerLock(): void {
    if (document.pointerLockElement === this.canvas || !('requestPointerLock' in this.canvas)) return;
    try {
      void Promise.resolve(this.canvas.requestPointerLock()).catch(() => undefined);
    } catch {
      // Partial Pointer Lock implementations are non-fatal because gamepad/touch do not depend on it.
    }
  }

  sample(): ControlIntent {
    const pad = primaryGamepad();
    const touch = this.touch.sample();

    let moveX = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    let moveY = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    let lookX = this.pointerDX * 0.0022;
    let lookY = this.pointerDY * 0.0022;
    let fire = this.firing;
    let jump = this.consumeJump();
    let sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    let toggleCamera = this.consumeCamera();

    moveX += touch.moveX;
    moveY += touch.moveY;
    lookX += touch.lookX;
    lookY += touch.lookY;
    fire ||= touch.fire;
    jump ||= touch.jump;
    sprint ||= touch.sprint;
    toggleCamera ||= touch.toggleCamera;

    if (pad) {
      moveX += deadzone(pad.axes[0] ?? 0);
      moveY += -deadzone(pad.axes[1] ?? 0);
      const rx = deadzone(pad.axes[2] ?? 0);
      const ry = deadzone(pad.axes[3] ?? 0);
      lookX += rx * 0.052;
      lookY += ry * 0.042;
      fire ||= (pad.buttons[7]?.value ?? 0) > 0.18;
      jump ||= Boolean(pad.buttons[0]?.pressed);
      sprint ||= Boolean(pad.buttons[10]?.pressed);
      const cameraPressed = Boolean(pad.buttons[3]?.pressed);
      if (cameraPressed && !this.gamepadCameraLatch) toggleCamera = true;
      this.gamepadCameraLatch = cameraPressed;
    }

    this.pointerDX = 0;
    this.pointerDY = 0;
    const length = Math.hypot(moveX, moveY);
    if (length > 1) {
      moveX /= length;
      moveY /= length;
    }

    return { moveX, moveY, lookX, lookY, fire, jump, sprint, toggleCamera };
  }

  private consumeJump(): boolean {
    const value = this.jumpQueued;
    this.jumpQueued = false;
    return value;
  }

  private consumeCamera(): boolean {
    const value = this.cameraQueued;
    this.cameraQueued = false;
    return value;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (event.code === 'Space' && !event.repeat) this.jumpQueued = true;
    if (event.code === 'KeyV' && !event.repeat) this.cameraQueued = true;
    this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.firing = true;
      this.requestPointerLock();
    }
  };

  private onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) this.firing = false;
  };

  private onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement === this.canvas) {
      this.pointerDX += event.movementX;
      this.pointerDY += event.movementY;
    }
  };

  private clear = (): void => {
    this.keys.clear();
    this.firing = false;
    this.pointerDX = 0;
    this.pointerDY = 0;
    this.touch.clear();
  };
}

export class PlayerController implements RobotController {
  readonly kind = 'player' as const;
  constructor(private readonly input: InputManager) {}
  sample(_context: ControllerContext): ControlIntent {
    return this.input.sample();
  }
}

export class StaticBotController implements RobotController {
  readonly kind = 'bot' as const;
  sample(_context: ControllerContext): ControlIntent {
    return { moveX: 0, moveY: 0, lookX: 0, lookY: 0, fire: false, jump: false, sprint: false, toggleCamera: false };
  }
}

export interface BotTuning {
  aggression: number;
  preferredDistance: number;
  strafe: number;
  lookResponse: number;
  fireCone: number;
}

interface RememberedPoint {
  x: number;
  y: number;
  z: number;
}

export class BotController implements RobotController {
  readonly kind = 'bot' as const;
  private orbitSign: number;
  private retargetClock = 0;
  private lastSeen: RememberedPoint | null = null;
  private lastX: number | null = null;
  private lastZ: number | null = null;
  private stuckClock = 0;
  private evadeClock = 0;

  constructor(
    private readonly tuning: BotTuning,
    private readonly random: () => number = Math.random,
  ) {
    this.orbitSign = this.random() < 0.5 ? -1 : 1;
  }

  sample(context: ControllerContext): ControlIntent {
    const target = context.targets.find((candidate) => candidate.alive);
    if (!target) return this.empty();

    if (target.visible) {
      this.lastSeen = { x: target.position.x, y: target.position.y, z: target.position.z };
    }

    const remembered = target.visible ? target.position : this.lastSeen;
    if (!remembered) {
      return {
        moveX: this.orbitSign * 0.28,
        moveY: 0.18,
        lookX: this.orbitSign * 0.014,
        lookY: 0,
        fire: false,
        jump: false,
        sprint: false,
        toggleCamera: false,
      };
    }

    const dx = remembered.x - context.position.x;
    const dy = remembered.y - context.position.y;
    const dz = remembered.z - context.position.z;
    const flatDistance = Math.hypot(dx, dz);
    if (!target.visible && flatDistance < 1.2) this.lastSeen = null;

    const desiredYaw = Math.atan2(dx, dz);
    const desiredPitch = -Math.atan2(dy, Math.max(0.001, flatDistance));
    const yawError = this.wrapAngle(desiredYaw - context.yaw);
    const pitchError = desiredPitch - context.pitch;

    this.retargetClock -= context.dt;
    if (this.retargetClock <= 0) {
      this.retargetClock = 0.7 + this.random() * 1.4;
      if (this.random() < 0.35) this.orbitSign *= -1;
    }

    let forward = flatDistance > this.tuning.preferredDistance + 1.5
      ? 1
      : flatDistance < this.tuning.preferredDistance - 1.5
        ? -0.7
        : 0.1;
    let strafe = this.orbitSign * this.tuning.strafe;
    let jump = false;

    if (this.lastX !== null && this.lastZ !== null) {
      const displacement = Math.hypot(context.position.x - this.lastX, context.position.z - this.lastZ);
      if ((Math.abs(forward) > 0.2 || Math.abs(strafe) > 0.2) && displacement < 0.008) {
        this.stuckClock += context.dt;
      } else {
        this.stuckClock = Math.max(0, this.stuckClock - context.dt * 2);
      }
    }
    this.lastX = context.position.x;
    this.lastZ = context.position.z;

    if (this.stuckClock > 0.42) {
      this.stuckClock = 0;
      this.evadeClock = 0.72;
      this.orbitSign *= -1;
    }
    if (this.evadeClock > 0) {
      this.evadeClock = Math.max(0, this.evadeClock - context.dt);
      strafe = this.orbitSign;
      forward = -0.45;
      jump = this.evadeClock > 0.5;
    }

    return {
      moveX: strafe,
      moveY: forward,
      lookX: yawError * this.tuning.lookResponse * context.dt,
      lookY: pitchError * this.tuning.lookResponse * context.dt,
      fire:
        target.visible &&
        Math.abs(yawError) < this.tuning.fireCone &&
        Math.abs(pitchError) < this.tuning.fireCone * 0.8 &&
        flatDistance < 12 + 18 * this.tuning.aggression,
      jump,
      sprint: flatDistance > this.tuning.preferredDistance + 5,
      toggleCamera: false,
    };
  }

  reset(): void {
    this.lastSeen = null;
    this.lastX = null;
    this.lastZ = null;
    this.stuckClock = 0;
    this.evadeClock = 0;
    this.retargetClock = 0;
  }

  private empty(): ControlIntent {
    return { moveX: 0, moveY: 0, lookX: 0, lookY: 0, fire: false, jump: false, sprint: false, toggleCamera: false };
  }

  private wrapAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }
}
