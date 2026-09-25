import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { InputManager, PlayerController, StaticBotController } from './input';
import { RobotEntity, type DamageReport, type RobotCallbacks, type ShotResult } from './robot';
import { COLORS, GAME } from './config';
import { MUTATIONS, type MutationId } from './mutations';
import type { BodySlot, TargetSnapshot } from './types';
import type { PhysicsMode } from './world';

export interface HUDRefs {
  healthFill: HTMLElement;
  healthLabel: HTMLElement;
  shieldFill: HTMLElement;
  shieldLabel: HTMLElement;
  damageLayer: HTMLElement;
  modeLabel: HTMLElement;
  ammoLabel: HTMLElement;
  mutationStrip: HTMLElement;
  toast: HTMLElement;
  hitMarker: HTMLElement;
  damageVignette: HTMLElement;
  loadoutPanel: HTMLElement;
  loadoutBody: HTMLElement;
  partCatalog: HTMLElement;
  loadoutToggle: HTMLButtonElement;
  loadoutClose: HTMLButtonElement;
  espMarker: HTMLElement;
  targetNoiseButton: HTMLButtonElement;
}

const SLOT_LABELS: Record<BodySlot, string> = {
  head: 'HEAD',
  'sensor-left': 'S-L',
  'sensor-right': 'S-R',
  'arm-left': 'A-L',
  'arm-right': 'A-R',
  torso: 'TORSO',
  core: 'CORE',
  'leg-left': 'L-L',
  'leg-right': 'L-R',
  utility: 'UTIL',
};

export class Game {
  readonly input: InputManager;
  private readonly robots: RobotEntity[] = [];
  private readonly player: RobotEntity;
  private readonly dummy: RobotEntity;
  private readonly firstCamera: FreeCamera;
  private readonly thirdCamera: ArcRotateCamera;
  private readonly tracerPool: Array<{ mesh: LinesMesh; expiresAt: number }> = [];
  private tracerCursor = 0;
  private dummyRespawnTimer: number | null = null;
  private toastTimer: number | null = null;
  private loadoutOpen = false;
  private weaponRoot!: TransformNode;
  private muzzleFlash!: AbstractMesh;
  private weaponKick = 0;
  private muzzleClock = 0;
  private weaponBobPhase = 0;
  private lastHealthDisplay = -1;
  private lastShieldDisplay = -1;
  private readonly damageNumbers: Array<{
    element: HTMLElement;
    point: Vector3;
    born: number;
    shield: boolean;
  }> = [];
  private lastMutationRevision = -1;
  private lastAliveDisplay = true;

  constructor(
    private readonly scene: Scene,
    private readonly canvas: HTMLCanvasElement,
    private readonly hud: HUDRefs,
    physicsMode: PhysicsMode,
  ) {
    this.input = new InputManager(canvas);
    const callbacks = this.callbacks();

    this.player = new RobotEntity(
      scene,
      'player',
      'player',
      new PlayerController(this.input),
      new Vector3(GAME.playerSpawn.x, GAME.playerSpawn.y, GAME.playerSpawn.z),
      Color3.FromHexString(COLORS.player),
      callbacks,
      physicsMode,
    );
    this.robots.push(this.player);

    this.dummy = new RobotEntity(
      scene,
      'target-dummy',
      'enemy',
      new StaticBotController(),
      new Vector3(GAME.targetSpawn.x, GAME.targetSpawn.y, GAME.targetSpawn.z),
      Color3.FromHexString(COLORS.enemy),
      callbacks,
      physicsMode,
    );
    this.dummy.yaw = Math.PI;
    this.robots.push(this.dummy);

    this.firstCamera = new FreeCamera('first-camera', this.player.eyePosition, scene);
    this.firstCamera.minZ = 0.05;
    this.firstCamera.fov = 1.05;
    this.firstCamera.inputs.clear();

    this.thirdCamera = new ArcRotateCamera('third-camera', Math.PI, 1.12, 5.2, this.player.root.position, scene);
    this.thirdCamera.minZ = 0.1;
    this.thirdCamera.inputs.clear();
    scene.activeCamera = this.firstCamera;

    this.createViewModel();
    this.createTracerPool();
    this.hud.modeLabel.textContent = 'SANDBOX // TARGET 01';

    this.hud.loadoutToggle.addEventListener('click', this.openLoadout);
    this.hud.loadoutClose.addEventListener('click', this.closeLoadout);
    this.hud.loadoutBody.addEventListener('click', this.onBodySlotClick);
    this.hud.partCatalog.addEventListener('click', this.onPartCatalogClick);
    this.hud.targetNoiseButton.addEventListener('click', this.pulseTargetNoise);
    window.addEventListener('keydown', this.onKeyDown);

    this.renderLoadout();
    this.updateHUD();
    this.toast('SANDBOX ONLINE // TARGET DUMMY READY');
  }

  update(dt: number): void {
    if (!this.loadoutOpen) {
      this.player.update(dt);
      this.dummy.update(dt);
    }

    this.updateTracers();
    this.updateCamera();
    this.updateDamageNumbers();
    this.updateViewModel(dt);
    this.updateHUD();
    this.updateESP();
  }

  dispose(): void {
    this.input.dispose();
    if (this.dummyRespawnTimer !== null) window.clearTimeout(this.dummyRespawnTimer);
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.hud.loadoutToggle.removeEventListener('click', this.openLoadout);
    this.hud.loadoutClose.removeEventListener('click', this.closeLoadout);
    this.hud.loadoutBody.removeEventListener('click', this.onBodySlotClick);
    this.hud.partCatalog.removeEventListener('click', this.onPartCatalogClick);
    this.hud.targetNoiseButton.removeEventListener('click', this.pulseTargetNoise);
    window.removeEventListener('keydown', this.onKeyDown);
    this.weaponRoot.dispose(false, true);
    for (const item of this.damageNumbers) item.element.remove();
    this.damageNumbers.length = 0;
    for (const robot of this.robots) robot.dispose();
  }

  private callbacks(): RobotCallbacks {
    return {
      getTargets: (robot) => this.getTargets(robot),
      resolveShot: (robot, origin, direction, range) => this.resolveShot(robot, origin, direction, range),
      onDamage: (robot, report, attacker) => {
        if (robot === this.player) this.pulseDamage();
        if (attacker === this.player && robot !== this.player) {
          this.pulseHit();
          this.spawnDamageNumber(report);
        }
      },
      onDeath: (robot) => {
        if (robot === this.dummy) this.scheduleDummyRespawn();
      },
      onShot: (robot, result) => {
        if (robot === this.player) {
          this.weaponKick = Math.min(1.35, this.weaponKick + 0.72);
          this.muzzleClock = 0.045;
        }
        this.spawnTracer(robot.eyePosition, result.hitPoint, robot.faction === 'player');
      },
    };
  }

  private getTargets(robot: RobotEntity): TargetSnapshot[] {
    const targets: TargetSnapshot[] = [];
    for (const other of this.robots) {
      if (other === robot || other.faction === robot.faction || !other.alive) continue;
      targets.push(other.snapshot(this.hasLineOfSight(robot, other)));
    }
    return targets;
  }

  private hasLineOfSight(observer: RobotEntity, target: RobotEntity): boolean {
    const origin = observer.eyePosition;
    const destination = target.eyePosition;
    const delta = destination.subtract(origin);
    const distance = delta.length();
    if (distance <= 0.001) return true;

    const ray = new Ray(origin, delta.scale(1 / distance), distance);
    const obstruction = this.scene.pickWithRay(
      ray,
      (mesh: AbstractMesh) =>
        mesh.isPickable &&
        mesh.isEnabled() &&
        mesh.metadata?.robotId === undefined,
    );
    return !obstruction?.hit;
  }

  private resolveShot(shooter: RobotEntity, origin: Vector3, direction: Vector3, range: number): ShotResult {
    const ray = new Ray(origin, direction, range);
    const hit = this.scene.pickWithRay(
      ray,
      (mesh: AbstractMesh) => mesh.isPickable && mesh.isEnabled() && mesh.metadata?.robotId !== shooter.id,
    );
    if (!hit?.hit || !hit.pickedPoint || !hit.pickedMesh) {
      return { victim: null, hitPoint: origin.add(direction.scale(range)) };
    }

    const robotId = hit.pickedMesh.metadata?.robotId as string | undefined;
    const victim = robotId
      ? this.robots.find((candidate) => candidate.id === robotId && candidate !== shooter && candidate.alive) ?? null
      : null;
    return { victim, hitPoint: hit.pickedPoint.clone() };
  }

  private scheduleDummyRespawn(): void {
    if (this.dummyRespawnTimer !== null) window.clearTimeout(this.dummyRespawnTimer);
    this.toast('TARGET DOWN // RESETTING');
    this.dummyRespawnTimer = window.setTimeout(() => {
      this.dummyRespawnTimer = null;
      this.dummy.respawn(new Vector3(GAME.targetSpawn.x, GAME.targetSpawn.y, GAME.targetSpawn.z));
    }, 650);
  }

  private openLoadout = (): void => {
    this.setLoadoutOpen(true);
  };

  private closeLoadout = (): void => {
    this.setLoadoutOpen(false);
  };

  private setLoadoutOpen(open: boolean): void {
    this.loadoutOpen = open;
    this.hud.loadoutPanel.classList.toggle('hidden', !open);
    document.body.classList.toggle('menu-open', open);
    if (open) {
      if (document.pointerLockElement) document.exitPointerLock();
      this.renderLoadout();
    }
  }

  private onBodySlotClick = (event: Event): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-body-slot]');
    if (!button) return;
    const slot = button.dataset.bodySlot as BodySlot | undefined;
    if (!slot) return;
    const installed = this.player.loadout.instanceAt(slot);
    if (!installed) return;

    const definition = MUTATIONS[installed.id];
    if (this.player.removeMutation(installed.instanceId)) {
      this.toast(`${definition.code} EJECTED`);
      this.renderLoadout();
    }
  };

  private onPartCatalogClick = (event: Event): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-part-id]');
    if (!button || button.disabled) return;
    const id = button.dataset.partId as MutationId | undefined;
    if (!id || !(id in MUTATIONS)) return;

    const installed = this.player.addMutation(id);
    if (!installed) {
      this.toast(`${MUTATIONS[id].code} // NO COMPATIBLE FREE MOUNT`);
      return;
    }

    this.toast(`${MUTATIONS[id].code} -> ${installed.slots.map((slot) => SLOT_LABELS[slot]).join('+')}`);
    this.renderLoadout();
  };

  private renderLoadout(): void {
    for (const button of this.hud.loadoutBody.querySelectorAll<HTMLButtonElement>('[data-body-slot]')) {
      const slot = button.dataset.bodySlot as BodySlot;
      const installed = this.player.loadout.instanceAt(slot);
      button.classList.toggle('is-occupied', Boolean(installed));
      button.dataset.category = installed ? MUTATIONS[installed.id].category : '';
      const code = installed ? MUTATIONS[installed.id].code : SLOT_LABELS[slot];
      button.innerHTML = `<span>${SLOT_LABELS[slot]}</span><strong>${code}</strong>`;
      button.title = installed ? `Tap to remove ${MUTATIONS[installed.id].name}` : `${SLOT_LABELS[slot]} free`;
    }

    const cards = Object.values(MUTATIONS).map((definition) => {
      const pattern = this.player.loadout.availablePattern(definition.id);
      const installedCount = this.player.loadout.count(definition.id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'part-card';
      button.dataset.partId = definition.id;
      button.dataset.category = definition.category;
      button.disabled = !pattern;
      const footprint = definition.mounts
        .map((mount) => mount.map((slot) => SLOT_LABELS[slot]).join('+'))
        .join(' / ');
      button.innerHTML = `
        <span class="part-card__icon">${definition.icon}</span>
        <span class="part-card__copy">
          <small>${definition.category.toUpperCase()} // ${definition.code}${installedCount ? ` ×${installedCount}` : ''}</small>
          <strong>${definition.name}</strong>
          <em>${definition.description}</em>
          <b>${pattern ? `FREE: ${pattern.map((slot) => SLOT_LABELS[slot]).join('+')}` : `BLOCKED: ${footprint}`}</b>
        </span>`;
      return button;
    });
    this.hud.partCatalog.replaceChildren(...cards);
  }

  private pulseTargetNoise = (): void => {
    this.dummy.pulseNoise(1);
    this.toast('TARGET NOISE BURST // 1.0');
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Tab' || event.code === 'KeyC') {
      event.preventDefault();
      this.setLoadoutOpen(!this.loadoutOpen);
    } else if (event.code === 'Escape' && this.loadoutOpen) {
      this.setLoadoutOpen(false);
    }
  };

  private updateCamera(): void {
    const eye = this.player.eyePosition;
    const forward = this.player.forward;
    if (this.player.cameraMode === 'first') {
      this.scene.activeCamera = this.firstCamera;
      this.firstCamera.position.copyFrom(eye);
      this.firstCamera.setTarget(eye.add(forward));
      this.player.meshParts.forEach((mesh) => { mesh.visibility = 0; });
    } else {
      this.scene.activeCamera = this.thirdCamera;
      this.thirdCamera.alpha = Math.PI / 2 - this.player.yaw;
      this.thirdCamera.beta = 1.15 + this.player.pitch * 0.3;
      this.thirdCamera.radius = 5.4;
      this.thirdCamera.target.copyFrom(this.player.root.position.add(new Vector3(0, 1.0, 0)));
      this.player.meshParts.forEach((mesh) => { mesh.visibility = 1; });
    }
  }

  private createViewModel(): void {
    this.weaponRoot = new TransformNode('viewmodel-root', this.scene);
    this.weaponRoot.parent = this.firstCamera;

    const metal = new StandardMaterial('viewmodel-metal', this.scene);
    metal.diffuseColor = new Color3(0.08, 0.11, 0.11);
    metal.specularColor = Color3.Black();
    metal.freeze();

    const accent = new StandardMaterial('viewmodel-accent', this.scene);
    accent.diffuseColor = new Color3(0.18, 0.25, 0.21);
    accent.specularColor = Color3.Black();
    accent.freeze();

    const glow = new StandardMaterial('viewmodel-glow', this.scene);
    glow.diffuseColor = Color3.Black();
    glow.emissiveColor = Color3.FromHexString(COLORS.player).scale(0.95);
    glow.freeze();

    const addBox = (
      name: string,
      width: number,
      height: number,
      depth: number,
      x: number,
      y: number,
      z: number,
      material: StandardMaterial,
    ): AbstractMesh => {
      const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, this.scene);
      mesh.parent = this.weaponRoot;
      mesh.position.set(x, y, z);
      mesh.material = material;
      mesh.isPickable = false;
      mesh.renderingGroupId = 2;
      return mesh;
    };

    addBox('viewmodel-receiver', 0.22, 0.16, 0.54, 0, 0, 0, metal);
    addBox('viewmodel-stock', 0.18, 0.20, 0.25, -0.02, -0.04, -0.31, accent);
    addBox('viewmodel-barrel', 0.10, 0.10, 0.48, 0.01, 0.015, 0.47, metal);
    addBox('viewmodel-sight', 0.05, 0.06, 0.12, 0, 0.12, 0.04, glow);
    this.muzzleFlash = addBox('viewmodel-muzzle', 0.13, 0.13, 0.08, 0.01, 0.015, 0.74, glow);
    this.muzzleFlash.setEnabled(false);
    this.weaponRoot.position.set(0.34, -0.29, 0.72);
  }

  private updateViewModel(dt: number): void {
    const enabled = this.player.cameraMode === 'first' && this.player.alive && !this.loadoutOpen;
    this.weaponRoot.setEnabled(enabled);
    if (!enabled) return;

    this.weaponKick = Math.max(0, this.weaponKick - dt * 7.5);
    this.muzzleClock = Math.max(0, this.muzzleClock - dt);
    this.muzzleFlash.setEnabled(this.muzzleClock > 0);

    const planarSpeed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    const moveAmount = Math.min(1, planarSpeed / 8);
    this.weaponBobPhase += dt * (5.5 + planarSpeed * 0.7);
    const sway = Math.sin(this.weaponBobPhase) * 0.012 * moveAmount;
    const bob = Math.abs(Math.cos(this.weaponBobPhase)) * 0.009 * moveAmount;

    this.weaponRoot.position.set(
      0.34 + sway,
      -0.29 + bob - this.weaponKick * 0.022,
      0.72 - this.weaponKick * 0.075,
    );
    this.weaponRoot.rotation.set(0.025 + this.weaponKick * 0.085, 0, -sway * 0.65);
  }

  private updateHUD(): void {
    const shieldDisplay = Math.ceil(this.player.shield);
    if (shieldDisplay !== this.lastShieldDisplay) {
      this.lastShieldDisplay = shieldDisplay;
      const shieldPct = Math.max(0, this.player.shield / this.player.stats.maxShield);
      this.hud.shieldFill.style.transform = `scaleX(${shieldPct})`;
      this.hud.shieldLabel.textContent = shieldDisplay.toString();
    }

    const healthDisplay = Math.ceil(this.player.health);
    if (healthDisplay !== this.lastHealthDisplay) {
      this.lastHealthDisplay = healthDisplay;
      const healthPct = Math.max(0, this.player.health / this.player.stats.maxHealth);
      this.hud.healthFill.style.transform = `scaleX(${healthPct})`;
      this.hud.healthLabel.textContent = healthDisplay.toString();
    }

    if (this.player.alive !== this.lastAliveDisplay) {
      this.lastAliveDisplay = this.player.alive;
      this.hud.ammoLabel.textContent = this.player.alive ? '∞' : 'OFFLINE';
    }

    if (this.player.loadout.revision !== this.lastMutationRevision) {
      this.lastMutationRevision = this.player.loadout.revision;
      this.hud.mutationStrip.replaceChildren(...this.player.loadout.entries().map(({ definition, stacks }) => {
        const chip = document.createElement('span');
        chip.dataset.category = definition.category;
        chip.textContent = `${definition.code}${stacks > 1 ? `×${stacks}` : ''}`;
        return chip;
      }));
      if (this.loadoutOpen) this.renderLoadout();
    }
  }

  private spawnDamageNumber(report: DamageReport): void {
    const amount = report.shieldDamage > 0 ? report.shieldDamage : report.healthDamage;
    if (amount <= 0) return;

    const element = document.createElement('span');
    const shield = report.shieldDamage > 0;
    element.className = `damage-number damage-number--${shield ? 'shield' : 'health'}${report.shieldBroke ? ' is-break' : ''}`;
    element.textContent = Math.round(amount).toString();
    element.dataset.layer = shield ? 'SHIELD' : 'HEALTH';
    this.hud.damageLayer.appendChild(element);
    this.damageNumbers.push({
      element,
      point: report.point.clone(),
      born: performance.now(),
      shield,
    });
  }

  private updateDamageNumbers(): void {
    const now = performance.now();
    for (let index = this.damageNumbers.length - 1; index >= 0; index -= 1) {
      const item = this.damageNumbers[index]!;
      const age = (now - item.born) / 900;
      if (age >= 1) {
        item.element.remove();
        this.damageNumbers.splice(index, 1);
        continue;
      }

      const projected = this.projectWorldPoint(item.point);
      if (!projected) {
        item.element.style.opacity = '0';
        continue;
      }

      const rise = 34 * age;
      const scale = item.shield && age < 0.13 ? 1.16 : 1;
      item.element.style.left = `${projected.x}px`;
      item.element.style.top = `${projected.y}px`;
      item.element.style.opacity = `${Math.max(0, 1 - age * age)}`;
      item.element.style.transform = `translate(-50%, calc(-50% - ${rise}px)) scale(${scale})`;
    }
  }

  private projectWorldPoint(point: Vector3): { x: number; y: number } | null {
    if (!this.scene.activeCamera) return null;
    const engine = this.scene.getEngine();
    const renderWidth = engine.getRenderWidth();
    const renderHeight = engine.getRenderHeight();
    const viewport = this.scene.activeCamera.viewport.toGlobal(renderWidth, renderHeight);
    const projected = Vector3.Project(
      point,
      Matrix.Identity(),
      this.scene.getTransformMatrix(),
      viewport,
    );

    if (projected.z < 0 || projected.z > 1) return null;
    return {
      x: projected.x * (this.canvas.clientWidth / renderWidth),
      y: projected.y * (this.canvas.clientHeight / renderHeight),
    };
  }

  private updateESP(): void {
    const sense = this.player.stats.wallSense;
    const shouldShow = this.dummy.alive && (
      sense === 2 ||
      (sense === 1 && this.dummy.noisy)
    );

    if (!shouldShow) {
      this.hud.espMarker.classList.add('hidden');
      return;
    }

    const projected = this.projectWorldPoint(this.dummy.eyePosition);
    if (!projected) {
      this.hud.espMarker.classList.add('hidden');
      return;
    }

    const { x, y } = projected;
    this.hud.espMarker.classList.remove('hidden');
    this.hud.espMarker.dataset.mode = sense === 2 ? 'xray' : 'echo';
    this.hud.espMarker.textContent = sense === 2 ? 'XRAY // TARGET' : 'ECHO // SIGNAL';
    this.hud.espMarker.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
  }

  private createTracerPool(): void {
    const origin = Vector3.Zero();
    for (let index = 0; index < 36; index += 1) {
      const mesh = MeshBuilder.CreateLines(`tracer-${index}`, { points: [origin, origin] }, this.scene);
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.setEnabled(false);
      this.tracerPool.push({ mesh, expiresAt: 0 });
    }
  }

  private spawnTracer(start: Vector3, end: Vector3, friendly: boolean): void {
    if (Vector3.DistanceSquared(start, end) <= 0.0004 || this.tracerPool.length === 0) return;
    const tracer = this.tracerPool[this.tracerCursor]!;
    this.tracerCursor = (this.tracerCursor + 1) % this.tracerPool.length;
    MeshBuilder.CreateLines(tracer.mesh.name, { points: [start, end], instance: tracer.mesh }, this.scene);
    tracer.mesh.color = friendly ? new Color3(0.45, 1, 0.67) : new Color3(1, 0.25, 0.2);
    tracer.mesh.setEnabled(true);
    tracer.expiresAt = performance.now() + 48;
  }

  private updateTracers(): void {
    const now = performance.now();
    for (const tracer of this.tracerPool) {
      if (tracer.mesh.isEnabled() && now >= tracer.expiresAt) tracer.mesh.setEnabled(false);
    }
  }

  private pulseHit(): void {
    this.hud.hitMarker.classList.remove('is-active');
    void this.hud.hitMarker.offsetWidth;
    this.hud.hitMarker.classList.add('is-active');
  }

  private pulseDamage(): void {
    this.hud.damageVignette.classList.remove('is-active');
    void this.hud.damageVignette.offsetWidth;
    this.hud.damageVignette.classList.add('is-active');
  }

  private toast(message: string): void {
    this.hud.toast.textContent = message;
    this.hud.toast.classList.remove('hidden');
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastTimer = null;
      this.hud.toast.classList.add('hidden');
    }, 1200);
  }
}
