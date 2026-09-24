import type { ControlIntent, RobotController, ControllerContext } from './types';

const DEADZONE = 0.15;

export function primaryGamepad(): Gamepad | null {
  const pads = navigator.getGamepads();
  for (let index = 0; index < pads.length; index += 1) {
    const pad = pads[index];
    if (pad) return pad;
  }
  return null;
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

  constructor(private readonly canvas: HTMLCanvasElement) {
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
  }

  requestPointerLock(): void {
    if (document.pointerLockElement === this.canvas || !('requestPointerLock' in this.canvas)) return;
    try {
      // iOS/WebKit may expose Pointer Lock while refusing a particular request.
      // A rejected lock is non-fatal because gamepad input does not depend on it.
      void Promise.resolve(this.canvas.requestPointerLock()).catch(() => undefined);
    } catch {
      // Older/partial implementations can throw synchronously.
    }
  }

  sample(): ControlIntent {
    const pad = primaryGamepad();
    let moveX = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    let moveY = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    let lookX = this.pointerDX * 0.0022;
    let lookY = this.pointerDY * 0.0022;
    let fire = this.firing;
    let jump = this.consumeJump();
    let sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    let toggleCamera = this.consumeCamera();

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
  };
}

export class PlayerController implements RobotController {
  readonly kind = 'player' as const;
  constructor(private readonly input: InputManager) {}
  sample(_context: ControllerContext): ControlIntent {
    return this.input.sample();
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
      // Search rather than tracking an opponent through geometry before ever seeing them.
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
