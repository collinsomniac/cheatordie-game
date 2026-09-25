import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import { Scene } from '@babylonjs/core/scene';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import '@babylonjs/core/Collisions/collisionCoordinator';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { GAME } from './config';

export type SupportedEngine = Engine | WebGPUEngine;
export type PhysicsMode = 'havok' | 'kinematic';

export interface EngineBundle {
  engine: SupportedEngine;
  backend: 'webgpu' | 'webgl2';
}

export interface WorldBundle {
  scene: Scene;
  physicsMode: PhysicsMode;
  physicsFallbackReason: string | null;
}

export async function createEngine(canvas: HTMLCanvasElement): Promise<EngineBundle> {
  const params = new URLSearchParams(location.search);
  const requestedBackend = params.get('backend');
  const forcedWebGL = requestedBackend === 'webgl';
  const forcedWebGPU = requestedBackend === 'webgpu';

  if (!forcedWebGL && await WebGPUEngine.IsSupportedAsync) {
    try {
      const engine = new WebGPUEngine(canvas, {
        antialias: false,
        adaptToDeviceRatio: false,
        powerPreference: 'high-performance',
      });
      await engine.initAsync();
      engine.compatibilityMode = params.get('compat') === '1';
      return { engine, backend: 'webgpu' };
    } catch (error) {
      if (forcedWebGPU) throw error;
      console.warn('WebGPU initialization failed; falling back to WebGL2.', error);
    }
  } else if (forcedWebGPU) {
    throw new Error('WebGPU was explicitly requested but is not supported by this browser/device.');
  }

  return {
    engine: new Engine(canvas, false, {
      preserveDrawingBuffer: false,
      stencil: false,
      powerPreference: 'high-performance',
    }, false),
    backend: 'webgl2',
  };
}

export async function createWorld(engine: SupportedEngine): Promise<WorldBundle> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.19, 0.29, 0.34, 1);
  scene.skipPointerMovePicking = true;
  scene.constantlyUpdateMeshUnderPointer = false;

  const requested = new URLSearchParams(location.search).get('physics');
  const isiOS =
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const mobileSafeDefault = requested === null && isiOS;
  const forceKinematic = requested === 'kinematic' || mobileSafeDefault;
  const forceHavok = requested === 'havok';

  let physicsMode: PhysicsMode = 'kinematic';
  let physicsFallbackReason: string | null = mobileSafeDefault
    ? 'iOS safe default: native kinematic collisions.'
    : null;

  if (!forceKinematic) {
    try {
      const { default: HavokPhysics } = await import('@babylonjs/havok');
      const havok = await withTimeout(HavokPhysics(), 5000, 'Havok/WASM initialization timed out');
      scene.enablePhysics(new Vector3(0, GAME.gravity, 0), new HavokPlugin(true, havok));
      physicsMode = 'havok';
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (forceHavok) throw new Error(`Havok initialization failed: ${reason}`);
      physicsFallbackReason = reason;
      console.warn('Havok initialization failed; using native kinematic collisions.', error);
    }
  }

  if (physicsMode === 'kinematic') {
    scene.collisionsEnabled = true;
    scene.gravity.copyFromFloats(0, GAME.gravity, 0);
  }

  const ambient = new HemisphericLight('dustlab-ambient', new Vector3(0.1, 1, 0.15), scene);
  ambient.intensity = 0.82;
  ambient.diffuse = new Color3(0.78, 0.79, 0.68);
  ambient.groundColor = new Color3(0.20, 0.16, 0.12);

  const sun = new DirectionalLight('dustlab-sun', new Vector3(-0.45, -1, 0.56), scene);
  sun.intensity = 0.72;
  sun.diffuse = new Color3(1.0, 0.82, 0.62);

  buildDustlab(scene, physicsMode);
  return { scene, physicsMode, physicsFallbackReason };
}

function material(scene: Scene, name: string, hex: string, emissive = false): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  const color = Color3.FromHexString(hex);
  mat.diffuseColor = emissive ? Color3.Black() : color;
  mat.emissiveColor = emissive ? color : Color3.Black();
  mat.specularColor = Color3.Black();
  mat.freeze();
  return mat;
}

function staticBox(
  scene: Scene,
  physicsMode: PhysicsMode,
  name: string,
  size: Vector3,
  position: Vector3,
  mat: StandardMaterial,
  rotation = Vector3.Zero(),
): Mesh {
  const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
  mesh.position.copyFrom(position);
  mesh.rotation.copyFrom(rotation);
  mesh.material = mat;
  mesh.isPickable = true;

  if (physicsMode === 'havok') {
    new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0.72, restitution: 0 }, scene);
  } else {
    mesh.checkCollisions = true;
  }

  mesh.freezeWorldMatrix();
  return mesh;
}

function decoBox(
  scene: Scene,
  name: string,
  size: Vector3,
  position: Vector3,
  mat: StandardMaterial,
): Mesh {
  const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
  mesh.position.copyFrom(position);
  mesh.material = mat;
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  return mesh;
}

function buildDustlab(scene: Scene, physicsMode: PhysicsMode): void {
  const sand = material(scene, 'dust-sand', '#a48a63');
  const plaster = material(scene, 'dust-plaster', '#c2aa80');
  const shade = material(scene, 'dust-shade', '#5c5142');
  const stone = material(scene, 'dust-stone', '#716652');
  const crate = material(scene, 'dust-crate', '#735136');
  const dark = material(scene, 'dust-dark', '#242825');
  const signalA = material(scene, 'dust-signal-a', '#ff6a58', true);
  const signalB = material(scene, 'dust-signal-b', '#6bd6ff', true);

  // Ground plane and outer silhouette.
  staticBox(scene, physicsMode, 'dust-floor', new Vector3(72, 0.5, 56), new Vector3(0, -0.25, 0), sand);
  staticBox(scene, physicsMode, 'dust-north', new Vector3(72, 5, 0.8), new Vector3(0, 2.5, 28), plaster);
  staticBox(scene, physicsMode, 'dust-south', new Vector3(72, 5, 0.8), new Vector3(0, 2.5, -28), plaster);
  staticBox(scene, physicsMode, 'dust-east', new Vector3(0.8, 5, 56), new Vector3(36, 2.5, 0), plaster);
  staticBox(scene, physicsMode, 'dust-west', new Vector3(0.8, 5, 56), new Vector3(-36, 2.5, 0), plaster);

  // SOUTH SPAWN COURT: open movement tuning space.
  staticBox(scene, physicsMode, 'spawn-wall-l', new Vector3(13, 4.2, 1.0), new Vector3(-22, 2.1, -13), plaster);
  staticBox(scene, physicsMode, 'spawn-wall-r', new Vector3(12, 4.2, 1.0), new Vector3(22, 2.1, -13), plaster);
  staticBox(scene, physicsMode, 'spawn-center-cover', new Vector3(5, 2.2, 2.4), new Vector3(2, 1.1, -17), stone);

  // MID: broken sightline through a doorway-like gap.
  staticBox(scene, physicsMode, 'mid-left', new Vector3(16, 5.2, 1.0), new Vector3(-15, 2.6, 0), plaster);
  staticBox(scene, physicsMode, 'mid-right', new Vector3(16, 5.2, 1.0), new Vector3(15, 2.6, 0), plaster);
  staticBox(scene, physicsMode, 'mid-door-cap', new Vector3(10, 1.4, 1.0), new Vector3(0, 4.5, 0), shade);
  staticBox(scene, physicsMode, 'mid-box-l', new Vector3(3, 2.4, 3), new Vector3(-5.2, 1.2, 5.0), crate);
  staticBox(scene, physicsMode, 'mid-box-r', new Vector3(2.5, 1.6, 4), new Vector3(5.6, 0.8, 6.0), crate);

  // LONG lane on the east side.
  staticBox(scene, physicsMode, 'long-inner-s', new Vector3(1.0, 4.4, 15), new Vector3(14, 2.2, -18.5), plaster);
  staticBox(scene, physicsMode, 'long-inner-n', new Vector3(1.0, 4.4, 17), new Vector3(14, 2.2, 18.5), plaster);
  staticBox(scene, physicsMode, 'long-outer-mid', new Vector3(1.0, 4.4, 24), new Vector3(29, 2.2, 6), plaster);
  staticBox(scene, physicsMode, 'long-corner', new Vector3(8, 4.4, 1.0), new Vector3(25, 2.2, -8), plaster);
  staticBox(scene, physicsMode, 'long-cover-a', new Vector3(3.3, 2.6, 3.3), new Vector3(20.5, 1.3, 11.5), crate);
  staticBox(scene, physicsMode, 'long-cover-b', new Vector3(2.4, 1.8, 5), new Vector3(25.2, 0.9, 18.0), stone);

  // SHORT / CATWALK grammar on the west: raised walkway with broad ramps.
  staticBox(scene, physicsMode, 'short-support', new Vector3(15, 2.0, 6), new Vector3(-20, 1.0, 5), shade);
  staticBox(scene, physicsMode, 'short-walk', new Vector3(18, 0.7, 5.5), new Vector3(-18, 2.35, 5), plaster);
  staticBox(scene, physicsMode, 'short-ramp-s', new Vector3(7, 0.75, 5.5), new Vector3(-9.5, 1.1, 5), plaster, new Vector3(0, 0, -0.28));
  staticBox(scene, physicsMode, 'short-ramp-n', new Vector3(7, 0.75, 5.5), new Vector3(-27.0, 1.1, 5), plaster, new Vector3(0, 0, 0.28));
  staticBox(scene, physicsMode, 'short-rail', new Vector3(18, 1.0, 0.35), new Vector3(-18, 3.2, 2.35), dark);

  // TUNNEL-LIKE west lane. No crouch requirement: this is routing/occlusion, not literal Dust II geometry.
  staticBox(scene, physicsMode, 'tunnel-wall-l', new Vector3(0.8, 4.0, 17), new Vector3(-31, 2.0, -15), stone);
  staticBox(scene, physicsMode, 'tunnel-wall-r', new Vector3(0.8, 4.0, 17), new Vector3(-23, 2.0, -15), stone);
  staticBox(scene, physicsMode, 'tunnel-roof', new Vector3(8.8, 0.7, 17), new Vector3(-27, 4.15, -15), shade);
  staticBox(scene, physicsMode, 'tunnel-break', new Vector3(4.0, 2.1, 1.2), new Vector3(-27, 1.05, -6.8), crate);

  // NORTH TEST COURT around the stationary dummy.
  staticBox(scene, physicsMode, 'north-house-l', new Vector3(10, 4.5, 8), new Vector3(-18, 2.25, 19), plaster);
  staticBox(scene, physicsMode, 'north-house-r', new Vector3(9, 5.5, 9), new Vector3(23, 2.75, 20), plaster);
  staticBox(scene, physicsMode, 'target-backstop', new Vector3(11, 3.2, 1.0), new Vector3(8, 1.6, 18), dark);
  staticBox(scene, physicsMode, 'target-cover-l', new Vector3(2.4, 1.7, 2.4), new Vector3(2.6, 0.85, 11.5), crate);
  staticBox(scene, physicsMode, 'target-cover-r', new Vector3(2.4, 2.7, 2.4), new Vector3(13.2, 1.35, 10.5), crate);

  // Cheap repeating props create more believable scale without adding texture or loader cost.
  const crates: ReadonlyArray<readonly [number, number, number, number]> = [
    [-7, 1.0, -10, 2], [-4.8, .6, -10.3, 1.2],
    [18, .7, -2, 1.4], [20.0, 1.2, -2.2, 2.4],
    [-12, .75, 15, 1.5], [-9.8, .75, 15, 1.5],
    [30, .7, -20, 1.4], [-31, .7, 20, 1.4],
  ];
  crates.forEach(([x, y, z, size], index) => {
    staticBox(scene, physicsMode, `dust-crate-${index}`, new Vector3(size, size * 1.05, size), new Vector3(x, y, z), crate);
  });

  // Minimal emissive navigation language: red = long/test court, blue = short/tunnel.
  for (let z = -20; z <= 20; z += 8) {
    decoBox(scene, `long-signal-${z}`, new Vector3(.08, .8, 1.8), new Vector3(13.45, 1.3, z), signalA);
  }
  for (let x = -28; x <= -12; x += 4) {
    decoBox(scene, `short-signal-${x}`, new Vector3(1.6, .08, .08), new Vector3(x, 2.8, 2.15), signalB);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}
