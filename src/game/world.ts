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
import HavokPhysics from '@babylonjs/havok';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { COLORS, GAME } from './config';

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

  const engine = new Engine(canvas, false, {
    preserveDrawingBuffer: false,
    stencil: false,
    powerPreference: 'high-performance',
  }, false);
  return { engine, backend: 'webgl2' };
}

export async function createWorld(engine: SupportedEngine): Promise<WorldBundle> {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString(`${COLORS.sky}ff`);
  scene.skipPointerMovePicking = true;
  scene.constantlyUpdateMeshUnderPointer = false;

  const requested = new URLSearchParams(location.search).get('physics');
  const forceKinematic = requested === 'kinematic';
  const forceHavok = requested === 'havok';

  let physicsMode: PhysicsMode = 'kinematic';
  let physicsFallbackReason: string | null = null;

  if (!forceKinematic) {
    try {
      const havok = await withTimeout(HavokPhysics(), 5000, 'Havok/WASM initialization timed out');
      const physics = new HavokPlugin(true, havok);
      scene.enablePhysics(new Vector3(0, GAME.gravity, 0), physics);
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

  const hemi = new HemisphericLight('ambient', new Vector3(0.2, 1, 0), scene);
  hemi.intensity = 0.78;
  hemi.diffuse = new Color3(0.58, 0.68, 0.64);
  hemi.groundColor = new Color3(0.08, 0.12, 0.12);
  const key = new DirectionalLight('key', new Vector3(-0.5, -1, 0.7), scene);
  key.intensity = 0.45;
  key.diffuse = new Color3(0.82, 0.92, 0.85);

  buildArena(scene, physicsMode);
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
): Mesh {
  const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
  mesh.position.copyFrom(position);
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

function buildArena(scene: Scene, physicsMode: PhysicsMode): void {
  const floorMat = material(scene, 'floor-mat', COLORS.floor);
  const wallMat = material(scene, 'wall-mat', COLORS.wall);
  const trimMat = material(scene, 'trim-mat', COLORS.trim);
  const dangerMat = material(scene, 'danger-mat', '#ff3d55', true);
  const half = GAME.arenaHalfSize;

  staticBox(scene, physicsMode, 'floor', new Vector3(half * 2, 0.5, half * 2), new Vector3(0, -0.25, 0), floorMat);
  staticBox(scene, physicsMode, 'north-wall', new Vector3(half * 2, 4, 0.6), new Vector3(0, 2, half), wallMat);
  staticBox(scene, physicsMode, 'south-wall', new Vector3(half * 2, 4, 0.6), new Vector3(0, 2, -half), wallMat);
  staticBox(scene, physicsMode, 'east-wall', new Vector3(0.6, 4, half * 2), new Vector3(half, 2, 0), wallMat);
  staticBox(scene, physicsMode, 'west-wall', new Vector3(0.6, 4, half * 2), new Vector3(-half, 2, 0), wallMat);

  const obstacles = [
    [-8, 1.15, -3, 3, 2.3, 6], [8, 1.15, 3, 3, 2.3, 6],
    [-3, 0.8, 7, 6, 1.6, 2.2], [3, 0.8, -7, 6, 1.6, 2.2],
    [-12, 1.4, 12, 2.5, 2.8, 2.5], [12, 1.4, -12, 2.5, 2.8, 2.5],
  ] as const;
  obstacles.forEach(([x, y, z, sx, sy, sz], index) =>
    staticBox(scene, physicsMode, `cover-${index}`, new Vector3(sx, sy, sz), new Vector3(x, y, z), index % 2 ? wallMat : trimMat),
  );

  for (let x = -18; x <= 18; x += 6) {
    const strip = MeshBuilder.CreateBox(`strip-${x}`, { width: 2.4, height: 0.018, depth: 0.06 }, scene);
    strip.position.set(x, 0.015, 0);
    strip.material = dangerMat;
    strip.isPickable = false;
    strip.freezeWorldMatrix();
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
