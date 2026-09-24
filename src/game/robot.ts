import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PhysicsCharacterController } from '@babylonjs/core/Physics/v2/characterController';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { BodySlot, CameraMode, ControlIntent, RobotController, RobotFaction, RobotStats, TargetSnapshot } from './types';
import { MutationLoadout, type MutationId } from './mutations';
import { GAME } from './config';
import type { PhysicsMode } from './world';

const BASE_STATS: RobotStats = {
  maxHealth: 100,
  moveSpeed: 7.8,
  sprintMultiplier: 1.42,
  airControl: 0.34,
  jumpSpeed: 8.0,
  acceleration: 19,
  fireInterval: 0.115,
  damage: 22,
  range: 55,
  recoil: 0.016,
  aimAssist: 0,
  triggerAngle: 0,
  momentumRetention: 0.72,
};

interface RobotPalette {
  body: StandardMaterial;
  dark: StandardMaterial;
  glow: StandardMaterial;
}

const ROBOT_PALETTES = new WeakMap<Scene, Map<string, RobotPalette>>();

function getRobotPalette(scene: Scene, color: Color3): RobotPalette {
  let sceneCache = ROBOT_PALETTES.get(scene);
  if (!sceneCache) {
    sceneCache = new Map<string, RobotPalette>();
    ROBOT_PALETTES.set(scene, sceneCache);
  }

  const key = `${color.r.toFixed(3)}:${color.g.toFixed(3)}:${color.b.toFixed(3)}`;
  const cached = sceneCache.get(key);
  if (cached) return cached;

  const body = new StandardMaterial(`robot-body-${key}`, scene);
  body.diffuseColor = color;
  body.specularColor = Color3.Black();
  body.freeze();

  const dark = new StandardMaterial(`robot-dark-${key}`, scene);
  dark.diffuseColor = color.scale(0.34);
  dark.specularColor = Color3.Black();
  dark.freeze();

  const glow = new StandardMaterial(`robot-glow-${key}`, scene);
  glow.diffuseColor = Color3.Black();
  glow.emissiveColor = color.scale(0.9);
  glow.freeze();

  const palette = { body, dark, glow };
  sceneCache.set(key, palette);
  return palette;
}

export interface ShotResult {
  victim: RobotEntity | null;
  hitPoint: Vector3;
}

export interface RobotCallbacks {
  getTargets(robot: RobotEntity): TargetSnapshot[];
  resolveShot(robot: RobotEntity, origin: Vector3, direction: Vector3, range: number): ShotResult;
  onDamage(robot: RobotEntity, amount: number, attacker: RobotEntity): void;
  onDeath(robot: RobotEntity, attacker: RobotEntity): void;
  onShot(robot: RobotEntity, result: ShotResult): void;
}

export class RobotEntity {
  readonly root: TransformNode;
  readonly loadout = new MutationLoadout();
  readonly controller: RobotController;
  readonly id: string;
  readonly faction: RobotFaction;
  readonly meshParts: AbstractMesh[] = [];
  readonly character: PhysicsCharacterController | null;
  private readonly kinematicCollider: Mesh | null;
  health = 100;
  yaw = 0;
  pitch = 0;
  velocity = Vector3.Zero();
  grounded = false;
  cameraMode: CameraMode = 'first';
  alive = true;
  private fireCooldown = 0;
  private cameraToggleLatch = false;
  private readonly callbacks: RobotCallbacks;
  private palette!: RobotPalette;
  private cachedStats: RobotStats = { ...BASE_STATS };

  constructor(
    private readonly scene: Scene,
    id: string,
    faction: RobotFaction,
    controller: RobotController,
    spawn: Vector3,
    color: Color3,
    callbacks: RobotCallbacks,
    private readonly physicsMode: PhysicsMode,
  ) {
    this.id = id;
    this.faction = faction;
    this.controller = controller;
    this.callbacks = callbacks;
    this.root = new TransformNode(`${id}-root`, scene);
    this.root.position.copyFrom(spawn);
    this.root.rotationQuaternion = Quaternion.Identity();
    this.createBody(color);

    if (this.physicsMode === 'havok') {
      this.character = new PhysicsCharacterController(spawn, { capsuleHeight: 1.1, capsuleRadius: 0.38 }, scene);
      this.kinematicCollider = null;
    } else {
      this.character = null;
      this.kinematicCollider = MeshBuilder.CreateBox(`${id}-kinematic-collider`, { size: 0.2 }, scene);
      this.kinematicCollider.position.copyFrom(spawn);
      this.kinematicCollider.visibility = 0;
      this.kinematicCollider.isPickable = false;
      this.kinematicCollider.checkCollisions = false;
      this.kinematicCollider.ellipsoid.copyFromFloats(0.38, 0.92, 0.38);
      this.kinematicCollider.ellipsoidOffset.copyFromFloats(0, 0.92, 0);
    }

    this.health = this.stats.maxHealth;
  }

  get stats(): RobotStats {
    return this.cachedStats;
  }

  get eyePosition(): Vector3 {
    return this.root.position.add(new Vector3(0, 1.5, 0));
  }

  get forward(): Vector3 {
    const cp = Math.cos(this.pitch);
    return new Vector3(Math.sin(this.yaw) * cp, -Math.sin(this.pitch), Math.cos(this.yaw) * cp).normalize();
  }

  snapshot(visible: boolean): TargetSnapshot {
    return {
      id: this.id,
      position: this.eyePosition,
      velocity: this.velocity.clone(),
      alive: this.alive,
      visible,
    };
  }

  addMutation(id: MutationId): BodySlot | null {
    const slot = this.loadout.add(id);
    if (!slot) return null;
    this.cachedStats = this.loadout.applyStats(BASE_STATS);
    const stack = this.loadout.count(id);
    this.attachMutationVisual(id, slot, stack);
    return slot;
  }

  update(dt: number): void {
    if (!this.alive) return;
    const stats = this.stats;
    const needsTargets = this.controller.kind === 'bot' || stats.aimAssist > 0 || stats.triggerAngle > 0;
    const targets = needsTargets ? this.callbacks.getTargets(this) : [];
    const intent = this.controller.sample({
      position: this.root.position,
      yaw: this.yaw,
      pitch: this.pitch,
      dt,
      targets,
    });

    this.applyAimAssist(intent, stats, targets);
    this.yaw += intent.lookX;
    this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch + intent.lookY));

    if (intent.toggleCamera && !this.cameraToggleLatch) this.cameraMode = this.cameraMode === 'first' ? 'third' : 'first';
    this.cameraToggleLatch = intent.toggleCamera;

    const moving = Math.hypot(intent.moveX, intent.moveY) > 0.05;
    this.loadout.mutateIntent(intent, moving, this.grounded);
    this.move(intent, stats, dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    const triggerbot = stats.triggerAngle > 0 && this.hasTargetInCone(stats.triggerAngle, targets);
    if ((intent.fire || triggerbot) && this.fireCooldown <= 0) this.fire(stats);
  }

  takeDamage(amount: number, attacker: RobotEntity): void {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    this.callbacks.onDamage(this, amount, attacker);
    if (this.health <= 0) {
      this.alive = false;
      for (const mesh of this.meshParts) mesh.setEnabled(false);
      this.callbacks.onDeath(this, attacker);
    }
  }

  respawn(position: Vector3): void {
    this.alive = true;
    this.health = this.stats.maxHealth;
    this.velocity.setAll(0);
    if (this.character) {
      this.character.setVelocity(Vector3.Zero());
      this.character.setPosition(position);
    }
    if (this.kinematicCollider) this.kinematicCollider.position.copyFrom(position);
    this.root.position.copyFrom(position);
    for (const mesh of this.meshParts) mesh.setEnabled(true);
    this.controller.reset?.();
  }

  dispose(): void {
    this.character?.dispose();
    this.kinematicCollider?.dispose(false, true);
    // Materials are deliberately shared across robots and owned by the scene cache.
    this.root.dispose(false, false);
  }

  private createBody(color: Color3): void {
    this.palette = getRobotPalette(this.scene, color);
    this.addBox('torso', new Vector3(0.82, 0.72, 0.42), new Vector3(0, 1.05, 0), this.palette.dark);
    this.addBox('head', new Vector3(0.56, 0.42, 0.52), new Vector3(0, 1.66, 0), this.palette.body);
    this.addBox('visor', new Vector3(0.43, 0.10, 0.04), new Vector3(0, 1.7, 0.28), this.palette.glow, false);
    this.addBox('arm-l', new Vector3(0.21, 0.72, 0.21), new Vector3(-0.57, 1.03, 0), this.palette.body);
    this.addBox('arm-r', new Vector3(0.21, 0.72, 0.21), new Vector3(0.57, 1.03, 0), this.palette.body);
    this.addBox('leg-l', new Vector3(0.25, 0.72, 0.28), new Vector3(-0.23, 0.35, 0), this.palette.body);
    this.addBox('leg-r', new Vector3(0.25, 0.72, 0.28), new Vector3(0.23, 0.35, 0), this.palette.body);
    this.addBox('gun', new Vector3(0.16, 0.17, 0.74), new Vector3(0.51, 1.12, 0.47), this.palette.dark);
  }

  private addBox(
    name: string,
    size: Vector3,
    position: Vector3,
    material: StandardMaterial,
    pickable = true,
  ): Mesh {
    const mesh = MeshBuilder.CreateBox(`${this.id}-${name}`, { width: size.x, height: size.y, depth: size.z }, this.scene);
    mesh.parent = this.root;
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.isPickable = pickable;
    if (pickable) mesh.metadata = { robotId: this.id };
    this.meshParts.push(mesh);
    return mesh;
  }

  private attachMutationVisual(id: MutationId, slot: BodySlot, stack: number): void {
    const layer = (stack - 1) * 0.035;
    const side = slot.endsWith('left') ? -1 : slot.endsWith('right') ? 1 : 0;

    switch (id) {
      case 'aim-assist':
        if (slot === 'head') {
          this.addBox(`aim-head-${stack}`, new Vector3(0.24, 0.10, 0.22), new Vector3(0, 1.92, 0.03), this.palette.glow, false);
        } else {
          this.addBox(
            `aim-${slot}-${stack}`,
            new Vector3(0.10, 0.15, 0.24),
            new Vector3(side * 0.36, 1.72 + layer, 0.03),
            this.palette.glow,
            false,
          );
        }
        break;
      case 'triggerbot':
        this.addBox(
          `trigger-${slot}-${stack}`,
          new Vector3(0.13, 0.13, 0.21),
          new Vector3(side * 0.66, 1.18 + layer, 0.34),
          this.palette.glow,
          false,
        );
        break;
      case 'speedhack':
        this.addBox(
          `speed-${slot}-${stack}`,
          new Vector3(0.09, 0.38, 0.34),
          new Vector3(side * 0.39, 0.31, -0.03),
          this.palette.glow,
          false,
        );
        break;
      case 'bhop':
        if (slot === 'core') {
          this.addBox(`bhop-core-${stack}`, new Vector3(0.38, 0.16, 0.12), new Vector3(0, 0.82, -0.27), this.palette.glow, false);
        } else {
          this.addBox(
            `bhop-${slot}-${stack}`,
            new Vector3(0.31, 0.08, 0.42),
            new Vector3(side * 0.23, 0.02 + layer, 0.06),
            this.palette.dark,
            false,
          );
        }
        break;
      case 'recoil-null':
        this.addBox(
          `counterweight-${slot}-${stack}`,
          new Vector3(0.18, 0.17, 0.31),
          new Vector3(side * 0.64, 1.29 + layer, -0.13),
          this.palette.dark,
          false,
        );
        break;
      case 'overclock':
        this.addBox(
          `overclock-${slot}-${stack}`,
          slot === 'core' ? new Vector3(0.46, 0.25, 0.12) : new Vector3(0.22, 0.34, 0.14),
          slot === 'core' ? new Vector3(0, 1.10, -0.28) : new Vector3(-0.45, 1.25, -0.20),
          this.palette.glow,
          false,
        );
        break;
    }
  }

  private move(intent: ControlIntent, stats: RobotStats, dt: number): void {
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wish = new Vector3(
      intent.moveX * cos + intent.moveY * sin,
      0,
      intent.moveY * cos - intent.moveX * sin,
    );
    if (wish.lengthSquared() > 1) wish.normalize();

    if (this.character) {
      const support = this.character.checkSupport(dt, new Vector3(0, -1, 0));
      this.grounded = support.supportedState !== 0;
      this.applyHorizontalMotion(intent, wish, stats, dt);

      if (this.grounded) {
        if (!intent.jump) this.applyGroundRetention(wish, stats, dt);
        this.velocity.y = intent.jump ? stats.jumpSpeed : Math.max(this.velocity.y, -1.5);
      }

      this.character.setVelocity(this.velocity);
      this.character.integrate(dt, support, new Vector3(0, GAME.gravity, 0));
      this.velocity.copyFrom(this.character.getVelocity());
      this.root.position.copyFrom(this.character.getPosition());
    } else if (this.kinematicCollider) {
      this.grounded = this.checkKinematicGrounded();
      this.applyHorizontalMotion(intent, wish, stats, dt);

      if (this.grounded) {
        if (!intent.jump) this.applyGroundRetention(wish, stats, dt);
        this.velocity.y = intent.jump ? stats.jumpSpeed : -1.2;
      } else {
        this.velocity.y += GAME.gravity * dt;
      }

      const beforeY = this.kinematicCollider.position.y;
      this.kinematicCollider.moveWithCollisions(this.velocity.scale(dt));
      const movedY = this.kinematicCollider.position.y - beforeY;

      if (this.velocity.y < 0 && Math.abs(movedY) < 0.0005) {
        this.grounded = true;
        this.velocity.y = -1.2;
      } else if (this.velocity.y > 0 && movedY < this.velocity.y * dt * 0.25) {
        this.velocity.y = 0;
      }

      this.root.position.copyFrom(this.kinematicCollider.position);
    }

    this.root.rotationQuaternion = Quaternion.FromEulerAngles(0, this.yaw, 0);
  }

  private applyHorizontalMotion(intent: ControlIntent, wish: Vector3, stats: RobotStats, dt: number): void {
    const speed = stats.moveSpeed * (intent.sprint ? stats.sprintMultiplier : 1);
    const targetX = wish.x * speed;
    const targetZ = wish.z * speed;
    const control = this.grounded ? 1 : stats.airControl;
    const blend = 1 - Math.exp(-stats.acceleration * control * dt);
    this.velocity.x += (targetX - this.velocity.x) * blend;
    this.velocity.z += (targetZ - this.velocity.z) * blend;
  }

  private applyGroundRetention(wish: Vector3, stats: RobotStats, dt: number): void {
    const retention = wish.lengthSquared() > 0 ? stats.momentumRetention : 0.25;
    this.velocity.x *= Math.pow(retention, dt * 4);
    this.velocity.z *= Math.pow(retention, dt * 4);
  }

  private checkKinematicGrounded(): boolean {
    if (!this.kinematicCollider) return false;
    const origin = this.kinematicCollider.position.add(new Vector3(0, 0.12, 0));
    const ray = new Ray(origin, new Vector3(0, -1, 0), 0.26);
    const hit = this.scene.pickWithRay(
      ray,
      (mesh: AbstractMesh) =>
        mesh.isPickable &&
        mesh.isEnabled() &&
        mesh.metadata?.robotId === undefined,
    );
    return Boolean(hit?.hit);
  }

  private applyAimAssist(intent: ControlIntent, stats: RobotStats, targets: readonly TargetSnapshot[]): void {
    if (stats.aimAssist <= 0) return;
    const target = this.closestAimTarget(0.22, targets);
    if (!target) return;
    const delta = target.position.subtract(this.eyePosition);
    const desiredYaw = Math.atan2(delta.x, delta.z);
    const desiredPitch = -Math.atan2(delta.y, Math.hypot(delta.x, delta.z));
    intent.lookX += this.wrapAngle(desiredYaw - this.yaw) * stats.aimAssist;
    intent.lookY += (desiredPitch - this.pitch) * stats.aimAssist;
  }

  private hasTargetInCone(angle: number, targets: readonly TargetSnapshot[]): boolean {
    return this.closestAimTarget(angle, targets) !== null;
  }

  private closestAimTarget(maxAngle: number, targets: readonly TargetSnapshot[]): TargetSnapshot | null {
    let best: TargetSnapshot | null = null;
    let bestAngle = maxAngle;
    const forward = this.forward;
    const eye = this.eyePosition;
    for (const target of targets) {
      if (!target.alive || !target.visible) continue;
      const direction = target.position.subtract(eye).normalize();
      const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(forward, direction))));
      if (angle < bestAngle) {
        bestAngle = angle;
        best = target;
      }
    }
    return best;
  }

  private fire(stats: RobotStats): void {
    this.fireCooldown = stats.fireInterval;
    const direction = this.forward;
    const origin = this.eyePosition.add(direction.scale(0.45));
    const result = this.callbacks.resolveShot(this, origin, direction, stats.range);
    if (result.victim) result.victim.takeDamage(stats.damage, this);
    this.pitch = Math.max(-1.25, this.pitch - stats.recoil);
    this.callbacks.onShot(this, result);
  }

  private wrapAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  rayFromEyes(): Ray {
    return new Ray(this.eyePosition, this.forward, this.stats.range);
  }
}
