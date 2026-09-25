import type { BodySlot, ControlIntent, RobotStats } from './types';

export type MutationId =
  | 'aim-assist'
  | 'triggerbot'
  | 'speedhack'
  | 'bhop'
  | 'recoil-null'
  | 'overclock'
  | 'acoustic-esp'
  | 'wallhack-array'
  | 'hardlock-suite';

export type MutationCategory = 'sensor' | 'aim' | 'movement' | 'weapon' | 'system' | 'package';

export interface MutationDefinition {
  id: MutationId;
  name: string;
  code: string;
  icon: string;
  category: MutationCategory;
  description: string;
  mounts: readonly (readonly BodySlot[])[];
  stackable: boolean;
  applyStats(stats: RobotStats, stacks: number): void;
  mutateIntent?(intent: ControlIntent, moving: boolean, grounded: boolean, stacks: number): void;
}

export interface InstalledMutation {
  instanceId: string;
  id: MutationId;
  slots: BodySlot[];
}

const singles = (...slots: BodySlot[]): readonly (readonly BodySlot[])[] => slots.map((slot) => [slot]);

export const MUTATIONS: Record<MutationId, MutationDefinition> = {
  'aim-assist': {
    id: 'aim-assist',
    name: 'Magnetic Optic',
    code: 'MAG-OPTIC',
    icon: '◉',
    category: 'aim',
    description: 'One-slot target magnetism. Helpful correction, not an automatic turn-and-kill system.',
    mounts: singles('head', 'sensor-left', 'sensor-right'),
    stackable: true,
    applyStats: (stats, stacks) => { stats.aimAssist += 0.075 * stacks; },
  },
  triggerbot: {
    id: 'triggerbot',
    name: 'Trigger Servo',
    code: 'TRIGGER',
    icon: '⌁',
    category: 'weapon',
    description: 'Fires when a visible target crosses a narrow confidence cone. You still have to aim it there.',
    mounts: singles('arm-left', 'arm-right'),
    stackable: true,
    applyStats: (stats, stacks) => { stats.triggerAngle += 0.010 * stacks; },
  },
  speedhack: {
    id: 'speedhack',
    name: 'Clock-Skew Actuator',
    code: 'SPEED',
    icon: '»',
    category: 'movement',
    description: 'One leg runs outside certified timing. Fast, but it competes directly with movement automation.',
    mounts: singles('leg-left', 'leg-right'),
    stackable: true,
    applyStats: (stats, stacks) => { stats.moveSpeed *= 1 + 0.14 * stacks; },
  },
  bhop: {
    id: 'bhop',
    name: 'Momentum Macro',
    code: 'BHOP',
    icon: '↟',
    category: 'movement',
    description: 'Automatically queues jumps while moving and retains more horizontal momentum.',
    mounts: singles('leg-left', 'leg-right', 'core'),
    stackable: true,
    applyStats: (stats, stacks) => { stats.momentumRetention = Math.min(0.97, stats.momentumRetention + 0.09 * stacks); },
    mutateIntent: (intent, moving, grounded) => { if (moving && grounded) intent.jump = true; },
  },
  'recoil-null': {
    id: 'recoil-null',
    name: 'Counter-Recoil Servo',
    code: 'RECOIL',
    icon: '≋',
    category: 'weapon',
    description: 'An arm-mounted counterforce unit. Reduces kick without touching target acquisition.',
    mounts: singles('arm-left', 'arm-right'),
    stackable: true,
    applyStats: (stats, stacks) => { stats.recoil *= Math.max(0.16, 1 - 0.30 * stacks); },
  },
  overclock: {
    id: 'overclock',
    name: 'Unsafe Overclock',
    code: 'OVERCLOCK',
    icon: '⚡',
    category: 'system',
    description: 'Pushes fire cadence and damage while increasing kick. A raw-output engine piece.',
    mounts: singles('core', 'utility'),
    stackable: true,
    applyStats: (stats, stacks) => {
      stats.fireInterval *= Math.max(0.58, 1 - 0.1 * stacks);
      stats.damage *= 1 + 0.08 * stacks;
      stats.recoil *= 1 + 0.1 * stacks;
    },
  },
  'acoustic-esp': {
    id: 'acoustic-esp',
    name: 'Acoustic Translator',
    code: 'ECHO-ESP',
    icon: '≈',
    category: 'sensor',
    description: 'One-slot situational ESP: translates loud movement or firing signatures into visual target data.',
    mounts: singles('sensor-left', 'sensor-right'),
    stackable: false,
    applyStats: (stats) => { stats.wallSense = Math.max(stats.wallSense, 1) as 1 | 2; },
  },
  'wallhack-array': {
    id: 'wallhack-array',
    name: 'Panoptic Array',
    code: 'XRAY',
    icon: '◇',
    category: 'sensor',
    description: 'Permanent through-cover target telemetry, balanced by consuming both sensor sockets at once.',
    mounts: [['sensor-left', 'sensor-right']],
    stackable: false,
    applyStats: (stats) => { stats.wallSense = 2; },
  },
  'hardlock-suite': {
    id: 'hardlock-suite',
    name: 'Hardlock Suite',
    code: 'HARDLOCK',
    icon: '⊕',
    category: 'package',
    description: 'A powerful prebuilt aim engine that occupies the head, both sensors, and both arms. Strong correction and auto-fire, but it dominates the chassis.',
    mounts: [['head', 'sensor-left', 'sensor-right', 'arm-left', 'arm-right']],
    stackable: false,
    applyStats: (stats) => {
      stats.aimAssist += 0.34;
      stats.triggerAngle += 0.021;
      stats.recoil *= 0.62;
    },
  },
};

export class MutationLoadout {
  private readonly installed: InstalledMutation[] = [];
  private _revision = 0;
  private nextInstance = 1;

  get revision(): number {
    return this._revision;
  }

  install(id: MutationId): InstalledMutation | null {
    const definition = MUTATIONS[id];
    if (!definition.stackable && this.has(id)) return null;
    const slots = this.availablePattern(id);
    if (!slots) return null;

    const item: InstalledMutation = {
      instanceId: `${id}-${this.nextInstance++}`,
      id,
      slots: [...slots],
    };
    this.installed.push(item);
    this._revision += 1;
    return item;
  }

  uninstall(instanceId: string): boolean {
    const index = this.installed.findIndex((item) => item.instanceId === instanceId);
    if (index < 0) return false;
    this.installed.splice(index, 1);
    this._revision += 1;
    return true;
  }

  availablePattern(id: MutationId): readonly BodySlot[] | null {
    const occupied = new Set(this.installed.flatMap((item) => item.slots));
    for (const pattern of MUTATIONS[id].mounts) {
      if (pattern.every((slot) => !occupied.has(slot))) return pattern;
    }
    return null;
  }

  has(id: MutationId): boolean {
    return this.installed.some((item) => item.id === id);
  }

  count(id: MutationId): number {
    let count = 0;
    for (const item of this.installed) if (item.id === id) count += 1;
    return count;
  }

  instanceAt(slot: BodySlot): InstalledMutation | null {
    return this.installed.find((item) => item.slots.includes(slot)) ?? null;
  }

  instances(): readonly InstalledMutation[] {
    return this.installed;
  }

  entries(): Array<{ definition: MutationDefinition; stacks: number; slots: BodySlot[] }> {
    const ids = new Set(this.installed.map((item) => item.id));
    return [...ids].map((id) => ({
      definition: MUTATIONS[id],
      stacks: this.count(id),
      slots: this.installed.filter((item) => item.id === id).flatMap((item) => item.slots),
    }));
  }

  applyStats(base: RobotStats): RobotStats {
    const result = { ...base };
    for (const { definition, stacks } of this.entries()) definition.applyStats(result, stacks);
    return result;
  }

  mutateIntent(intent: ControlIntent, moving: boolean, grounded: boolean): void {
    for (const { definition, stacks } of this.entries()) {
      definition.mutateIntent?.(intent, moving, grounded, stacks);
    }
  }
}
