import type { Vector3 } from '@babylonjs/core/Maths/math.vector';

export type RobotFaction = 'player' | 'enemy';
export type CameraMode = 'first' | 'third';
export type BodySlot =
  | 'head'
  | 'sensor-left'
  | 'sensor-right'
  | 'arm-left'
  | 'arm-right'
  | 'torso'
  | 'core'
  | 'leg-left'
  | 'leg-right'
  | 'utility';

export interface ControlIntent {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  fire: boolean;
  jump: boolean;
  sprint: boolean;
  toggleCamera: boolean;
}

export interface RobotStats {
  maxHealth: number;
  moveSpeed: number;
  sprintMultiplier: number;
  airControl: number;
  jumpSpeed: number;
  acceleration: number;
  fireInterval: number;
  damage: number;
  range: number;
  recoil: number;
  aimAssist: number;
  triggerAngle: number;
  momentumRetention: number;
  wallSense: 0 | 1 | 2;
}

export interface TargetSnapshot {
  id: string;
  position: Vector3;
  velocity: Vector3;
  alive: boolean;
  visible: boolean;
}

export interface ControllerContext {
  position: Vector3;
  yaw: number;
  pitch: number;
  dt: number;
  targets: readonly TargetSnapshot[];
}

export interface RobotController {
  readonly kind: 'player' | 'bot';
  sample(context: ControllerContext): ControlIntent;
  reset?(): void;
}
