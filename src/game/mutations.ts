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
  | 'hardlock-suite'
  | 'dual-wield-rig'
  | 'spinbot-lite'
  | 'spinbot-rig'
  | 'resolver';

export type MutationCategory = 'sensor' | 'aim' | 'movement' | 'weapon' | 'system' | 'package';
export type MutationActivation = 'passive' | 'triggered';

export interface MutationDefinition {
  id: MutationId;
  name: string;
  code: string;
  icon: string;
  category: MutationCategory;
  activation: MutationActivation;
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
    activation: 'passive',
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
    activation: 'triggered',
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
    activation: 'passive',
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
    activation: 'triggered',
    description: 'Auto-queues the landing jump, preserves speed, and adds air authority. A movement engine rather than a raw speed multiplier.',
    mounts: singles('leg-left', 'leg-right', 'core'),
    stackable: true,
    applyStats: (stats, stacks) => {
      stats.momentumRetention = Math.max(stats.momentumRetention, Math.min(0.98, 0.89 + 0.035 * stacks));
      stats.airControl = Math.min(0.72, stats.airControl + 0.11 * stacks);
    },
    mutateIntent: (intent, moving, grounded) => { if (moving && grounded) intent.jump = true; },
  },
  'recoil-null': {
    id: 'recoil-null',
    name: 'Counter-Recoil Servo',
    code: 'RECOIL',
    icon: '≋',
    category: 'weapon',
    activation: 'passive',
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
    activation: 'passive',
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
    name: 'Telemetry Tap',
    code: 'TAG-ESP',
    icon: '▣',
    category: 'sensor',
    activation: 'passive',
    description: 'One sensor socket. Always exposes a through-cover identity/vitals tag, but never the target silhouette.',
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
    activation: 'passive',
    description: 'Both sensor sockets. Permanent full-body through-wall silhouette plus target telemetry.',
    mounts: [['sensor-left', 'sensor-right']],
    stackable: false,
    applyStats: (stats) => { stats.wallSense = 2; },
  },
  'hardlock-suite': {
    id: 'hardlock-suite',
    name: 'Rage Aimbot Suite',
    code: 'AIMBOT',
    icon: '⊕',
    category: 'package',
    activation: 'passive',
    description: 'Five-slot automated aim package: strong visible-target correction, trigger automation, recoil control, and a weak built-in resolver.',
    mounts: [['head', 'sensor-left', 'sensor-right', 'arm-left', 'arm-right']],
    stackable: false,
    applyStats: (stats) => {
      stats.aimAssist += 0.72;
      stats.triggerAngle += 0.045;
      stats.recoil *= 0.42;
      stats.resolver += 0.15;
    },
  },,
  'dual-wield-rig': {
    id: 'dual-wield-rig',
    name: 'Akimbo Harness',
    code: 'AKIMBO',
    icon: 'Ⅱ',
    category: 'weapon',
    activation: 'passive',
    description: 'Both arms plus torso stabilization. Fires two independently-originated carbine rays per trigger cycle.',
    mounts: [['arm-left', 'arm-right', 'torso']],
    stackable: false,
    applyStats: (stats) => {
      stats.dualWield = 1;
      stats.recoil *= 1.18;
    },
  },
  'spinbot-lite': {
    id: 'spinbot-lite',
    name: 'Yaw Scrambler',
    code: 'SPIN-L',
    icon: '↻',
    category: 'system',
    activation: 'passive',
    description: 'One core socket. Decouples visible body yaw from real aim with a slow deceptive rotation.',
    mounts: singles('core', 'utility'),
    stackable: false,
    applyStats: (stats) => {
      stats.antiAim = Math.max(stats.antiAim, 0.34);
      stats.spinRate = Math.max(stats.spinRate, 4.4);
    },
  },
  'spinbot-rig': {
    id: 'spinbot-rig',
    name: 'Rage Spinbot Rig',
    code: 'SPIN-X',
    icon: '⟳',
    category: 'package',
    activation: 'passive',
    description: 'Core + utility. Fast visual spin/jitter and strong anti-aim deception while the local camera remains stable.',
    mounts: [['core', 'utility']],
    stackable: false,
    applyStats: (stats) => {
      stats.antiAim = Math.max(stats.antiAim, 0.88);
      stats.spinRate = Math.max(stats.spinRate, 15.5);
    },
  },
  resolver: {
    id: 'resolver',
    name: 'Pose Resolver',
    code: 'RESOLVER',
    icon: '⌖',
    category: 'aim',
    activation: 'passive',
    description: 'Head + one sensor. Reduces anti-aim error fed into automated targeting without improving manual aim.',
    mounts: [['head', 'sensor-left'], ['head', 'sensor-right']],
    stackable: false,
    applyStats: (stats) => { stats.resolver += 0.72; },
  }
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
