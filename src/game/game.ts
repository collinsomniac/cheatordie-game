import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { BotController, InputManager, PlayerController, primaryGamepad } from './input';
import { RobotEntity, type RobotCallbacks, type ShotResult } from './robot';
import { COLORS, GAME } from './config';
import { drawMutationChoices, type MutationDefinition } from './mutations';
import type { TargetSnapshot } from './types';
import { RandomSource, mixSeed, runSeedFromLocation } from './rng';

export interface HUDRefs {
  healthFill: HTMLElement;
  healthLabel: HTMLElement;
  waveLabel: HTMLElement;
  ammoLabel: HTMLElement;
  mutationStrip: HTMLElement;
  upgradePanel: HTMLElement;
  upgradeCards: HTMLElement;
  toast: HTMLElement;
  hitMarker: HTMLElement;
  damageVignette: HTMLElement;
}

export class Game {
  readonly input: InputManager;
  readonly seed: number;
  private readonly upgradeRandom: RandomSource;
  private readonly robots: RobotEntity[] = [];
  private readonly player: RobotEntity;
  private readonly firstCamera: FreeCamera;
  private readonly thirdCamera: ArcRotateCamera;
  private wave = 0;
  private waveTransition = false;
  private upgradeOpen = false;
  private readonly tracerPool: Array<{ mesh: LinesMesh; expiresAt: number }> = [];
  private tracerCursor = 0;
  private upgradeChoices: MutationDefinition[] = [];
  private upgradeIndex = 0;
  private upgradePadLatch = false;
  private waveOfferTimer: number | null = null;
  private respawnTimer: number | null = null;
  private toastTimer: number | null = null;
  private weaponRoot!: TransformNode;
  private muzzleFlash!: AbstractMesh;
  private weaponKick = 0;
  private muzzleClock = 0;
  private weaponBobPhase = 0;
  private lastHealthDisplay = -1;
  private lastMutationRevision = -1;
  private lastAliveDisplay = true;

  constructor(
    private readonly scene: Scene,
    canvas: HTMLCanvasElement,
    private readonly hud: HUDRefs,
  ) {
    this.input = new InputManager(canvas);
    this.seed = runSeedFromLocation();
    this.upgradeRandom = new RandomSource(mixSeed(this.seed, 0x55504752));
    const callbacks = this.callbacks();
    this.player = new RobotEntity(scene, 'player', 'player', new PlayerController(this.input), new Vector3(GAME.playerSpawn.x, GAME.playerSpawn.y, GAME.playerSpawn.z), Color3.FromHexString(COLORS.player), callbacks);
    this.robots.push(this.player);

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

    window.addEventListener('keydown', this.onUpgradeKey);
    this.spawnWave();
  }

  update(dt: number): void {
    if (this.upgradeOpen) {
      this.handleUpgradeGamepad();
      return;
    }
    if (!this.player.alive) {
      this.updateTracers();
      this.updateCamera(dt);
      this.updateViewModel(dt);
      this.updateHUD();
      return;
    }

    for (const robot of this.robots) robot.update(dt);
    this.updateTracers();
    this.updateCamera(dt);
    this.updateViewModel(dt);
    this.updateHUD();

    if (!this.player.alive) return;

    let aliveEnemies = 0;
    for (const robot of this.robots) {
      if (robot.faction === 'enemy' && robot.alive) aliveEnemies += 1;
    }
    if (aliveEnemies === 0 && !this.waveTransition) {
      this.waveTransition = true;
      this.clearWaveOffer();
      this.waveOfferTimer = window.setTimeout(() => this.offerUpgrade(), 550);
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onUpgradeKey);
    this.input.dispose();
    this.clearWaveOffer();
    if (this.respawnTimer !== null) window.clearTimeout(this.respawnTimer);
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.weaponRoot.dispose(false, true);
    for (const robot of this.robots) robot.dispose();
  }

  private callbacks(): RobotCallbacks {
    return {
      getTargets: (robot) => this.getTargets(robot),
      resolveShot: (robot, origin, direction, range) => this.resolveShot(robot, origin, direction, range),
      onDamage: (robot, _amount, attacker) => {
        if (robot === this.player) this.pulseDamage();
        if (attacker === this.player && robot !== this.player) this.pulseHit();
      },
      onDeath: (robot) => {
        if (robot === this.player) this.playerDied();
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
    if (!hit?.hit || !hit.pickedPoint || !hit.pickedMesh) return { victim: null, hitPoint: origin.add(direction.scale(range)) };
    const robotId = hit.pickedMesh.metadata?.robotId as string | undefined;
    const victim = robotId ? this.robots.find((candidate) => candidate.id === robotId && candidate !== shooter && candidate.alive) ?? null : null;
    return { victim, hitPoint: hit.pickedPoint.clone() };
  }

  private spawnWave(): void {
    this.clearWaveOffer();
    this.wave += 1;
    this.waveTransition = false;
    this.upgradeOpen = false;
    this.hud.upgradePanel.classList.add('hidden');
    this.hud.waveLabel.textContent = `WAVE ${String(this.wave).padStart(2, '0')}`;

    for (let i = this.robots.length - 1; i >= 1; i -= 1) {
      this.robots[i]?.dispose();
      this.robots.splice(i, 1);
    }

    const count = Math.min(2 + Math.floor((this.wave - 1) * 0.75), 9);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + 0.7;
      const radius = 10 + (i % 3) * 3;
      const position = new Vector3(Math.sin(angle) * radius, 1.05, Math.cos(angle) * radius);
      const difficulty = Math.min(1, (this.wave - 1) / 9);
      const bot = new RobotEntity(
        this.scene,
        `enemy-${this.wave}-${i}`,
        'enemy',
        new BotController({
          aggression: 0.45 + difficulty * 0.45,
          preferredDistance: 9 - difficulty * 2.2,
          strafe: 0.45 + difficulty * 0.35,
          lookResponse: 2.2 + difficulty * 3.5,
          fireCone: 0.085 - difficulty * 0.03,
        }, new RandomSource(mixSeed(this.seed, this.wave, i)).next),
        position,
        Color3.FromHexString(i % 2 ? COLORS.enemy : COLORS.enemyAccent),
        this.callbacks(),
      );
      if (this.wave >= 3 && i === 0) bot.addMutation('speedhack');
      if (this.wave >= 4 && i === 1) bot.addMutation('recoil-null');
      if (this.wave >= 5 && i === 0) bot.addMutation('triggerbot');
      this.robots.push(bot);
    }

    this.toast(`WAVE ${this.wave} // ${count} HOSTILE${count === 1 ? '' : 'S'}`);
  }

  private offerUpgrade(): void {
    this.waveOfferTimer = null;
    if (!this.player.alive) return;
    if (this.robots.some((robot) => robot.faction === 'enemy' && robot.alive)) return;
    this.upgradeOpen = true;
    const choices = drawMutationChoices(99, this.upgradeRandom.next)
      .filter((choice) => this.player.loadout.availableSlot(choice.id) !== null)
      .slice(0, 3);

    if (choices.length === 0) {
      this.toast('CHASSIS SATURATED // NO COMPATIBLE SOCKETS');
      this.waveOfferTimer = window.setTimeout(() => this.spawnWave(), 900);
      return;
    }

    this.upgradeChoices = choices;
    this.upgradeIndex = 0;
    this.hud.upgradeCards.replaceChildren();
    choices.forEach((choice, index) => {
      const button = document.createElement('button');
      button.className = 'upgrade-card';
      const mount = this.player.loadout.availableSlot(choice.id);
      button.innerHTML = `<span>0${index + 1} // ${choice.code}</span><strong>${choice.name}</strong><p>${choice.description}</p><small>MOUNT: ${mount ?? 'none'} · COMPAT: ${choice.slots.join(' · ')}</small>`;
      button.addEventListener('click', () => this.chooseUpgrade(choice));
      this.hud.upgradeCards.append(button);
    });
    this.hud.upgradePanel.classList.remove('hidden');
    this.renderUpgradeSelection();
  }

  private chooseUpgrade(choice: MutationDefinition): void {
    if (!this.upgradeOpen) return;
    const slot = this.player.addMutation(choice.id);
    if (!slot) {
      this.toast(`${choice.code} REJECTED // NO FREE SOCKET`);
      return;
    }
    this.toast(`${choice.code} -> ${slot.toUpperCase()}`);
    this.spawnWave();
  }

  private onUpgradeKey = (event: KeyboardEvent): void => {
    if (!this.upgradeOpen) return;
    const numeric = Number(event.key);
    if (numeric >= 1 && numeric <= this.upgradeChoices.length) {
      this.chooseUpgrade(this.upgradeChoices[numeric - 1]!);
      return;
    }
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.moveUpgradeSelection(-1);
    if (event.code === 'ArrowRight' || event.code === 'KeyD') this.moveUpgradeSelection(1);
    if (event.code === 'Enter' || event.code === 'Space') this.chooseUpgrade(this.upgradeChoices[this.upgradeIndex]!);
  };

  private handleUpgradeGamepad(): void {
    const pad = primaryGamepad();
    if (!pad) return;
    const left = Boolean(pad.buttons[14]?.pressed) || (pad.axes[0] ?? 0) < -0.65;
    const right = Boolean(pad.buttons[15]?.pressed) || (pad.axes[0] ?? 0) > 0.65;
    const accept = Boolean(pad.buttons[0]?.pressed);
    const active = left || right || accept;
    if (active && !this.upgradePadLatch) {
      if (left) this.moveUpgradeSelection(-1);
      else if (right) this.moveUpgradeSelection(1);
      else if (accept) this.chooseUpgrade(this.upgradeChoices[this.upgradeIndex]!);
    }
    this.upgradePadLatch = active;
  }

  private moveUpgradeSelection(delta: number): void {
    if (!this.upgradeChoices.length) return;
    this.upgradeIndex = (this.upgradeIndex + delta + this.upgradeChoices.length) % this.upgradeChoices.length;
    this.renderUpgradeSelection();
  }

  private renderUpgradeSelection(): void {
    [...this.hud.upgradeCards.children].forEach((node, index) => {
      node.classList.toggle('is-selected', index === this.upgradeIndex);
    });
  }

  private playerDied(): void {
    this.clearWaveOffer();
    this.upgradeOpen = false;
    this.hud.upgradePanel.classList.add('hidden');
    this.toast('CHASSIS FAILURE // REBOOTING');
    if (this.respawnTimer !== null) window.clearTimeout(this.respawnTimer);
    this.respawnTimer = window.setTimeout(() => {
      this.respawnTimer = null;
      this.player.respawn(new Vector3(GAME.playerSpawn.x, GAME.playerSpawn.y, GAME.playerSpawn.z));
      this.wave = Math.max(0, this.wave - 1);
      this.spawnWave();
    }, 1200);
  }

  private clearWaveOffer(): void {
    if (this.waveOfferTimer !== null) {
      window.clearTimeout(this.waveOfferTimer);
      this.waveOfferTimer = null;
    }
  }

  private updateCamera(_dt: number): void {
    const eye = this.player.eyePosition;
    const forward = this.player.forward;
    if (this.player.cameraMode === 'first') {
      this.scene.activeCamera = this.firstCamera;
      this.firstCamera.position.copyFrom(eye);
      this.firstCamera.setTarget(eye.add(forward));
      this.player.meshParts.forEach((mesh) => { mesh.visibility = 0; });
    } else {
      this.scene.activeCamera = this.thirdCamera;
      const alpha = Math.PI / 2 - this.player.yaw;
      this.thirdCamera.alpha = alpha;
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
    const enabled = this.player.cameraMode === 'first' && this.player.alive;
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
    this.weaponRoot.rotation.set(
      0.025 + this.weaponKick * 0.085,
      0,
      -sway * 0.65,
    );
  }

  private updateHUD(): void {
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
      this.hud.mutationStrip.replaceChildren(...this.player.loadout.entries().map(({ definition, stacks, slots }) => {
        const chip = document.createElement('span');
        const slotLabel = slots.map((slot) => slot.replace('-left', 'L').replace('-right', 'R')).join('/');
        chip.textContent = `${definition.code}${stacks > 1 ? `×${stacks}` : ''} [${slotLabel}]`;
        return chip;
      }));
    }
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
