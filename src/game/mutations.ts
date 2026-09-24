import type { BodySlot, ControlIntent, RobotStats } from './types';

export type MutationId = 'aim-assist' | 'triggerbot' | 'speedhack' | 'bhop' | 'recoil-null' | 'overclock';

export interface MutationDefinition {
  id: MutationId;
  name: string;
  code: string;
  description: string;
  slots: readonly BodySlot[];
  stackable: boolean;
  applyStats(stats: RobotStats, stacks: number): void;
  mutateIntent?(intent: ControlIntent, moving: boolean, grounded: boolean, stacks: number): void;
}

export const MUTATIONS: Record<MutationId, MutationDefinition> = {
  'aim-assist': {
    id: 'aim-assist',
    name: 'Magnetic Optics',
    code: 'AIM_ASSIST',
    description: 'Crosshair magnetism bends your look vector toward nearby targets.',
    slots: ['head', 'sensor-left', 'sensor-right'],
    stackable: true,
    applyStats: (stats, stacks) => { stats.aimAssist += 0.09 * stacks; },
  },
  triggerbot: {
    id: 'triggerbot',
    name: 'Deadman Trigger',
    code: 'TRIGGERBOT',
    description: 'The weapon fires itself when a hostile enters a narrow aim cone.',
    slots: ['arm-left', 'arm-right'],
    stackable: true,
    applyStats: (stats, stacks) => { stats.triggerAngle += 0.012 * stacks; },
  },
  speedhack: {
    id: 'speedhack',
    name: 'Clock Skew Legs',
    code: 'SPEEDHACK',
    description: 'Movement servos run outside certified clock tolerances.',
    slots: ['leg-left', 'leg-right'],
    stackable: true,
    applyStats: (stats, stacks) => { stats.moveSpeed *= 1 + 0.16 * stacks; },
  },
  bhop: {
    id: 'bhop',
    name: 'Momentum Exploit',
    code: 'BHOP_MACRO',
    description: 'Moving on the ground automatically queues a jump and preserves velocity.',
    slots: ['leg-left', 'leg-right', 'core'],
    stackable: true,
    applyStats: (stats, stacks) => { stats.momentumRetention = Math.min(0.97, stats.momentumRetention + 0.09 * stacks); },
    mutateIntent: (intent, moving, grounded) => { if (moving && grounded) intent.jump = true; },
  },
  'recoil-null': {
    id: 'recoil-null',
    name: 'Counter-Recoil Servo',
    code: 'RECOIL_NULL',
    description: 'Arm servos cancel an increasing fraction of weapon kick.',
    slots: ['arm-left', 'arm-right'],
    stackable: true,
    applyStats: (stats, stacks) => { stats.recoil *= Math.max(0.12, 1 - 0.32 * stacks); },
  },
  overclock: {
    id: 'overclock',
    name: 'Unsafe Overclock',
    code: 'OVERCLOCK',
    description: 'Higher fire cadence and damage in exchange for harder recoil.',
    slots: ['core', 'utility'],
    stackable: true,
    applyStats: (stats, stacks) => {
      stats.fireInterval *= Math.max(0.55, 1 - 0.1 * stacks);
      stats.damage *= 1 + 0.09 * stacks;
      stats.recoil *= 1 + 0.1 * stacks;
    },
  },
};

export class MutationLoadout {
  private readonly stacks = new Map<MutationId, number>();

  add(id: MutationId): void {
    this.stacks.set(id, (this.stacks.get(id) ?? 0) + 1);
  }

  has(id: MutationId): boolean {
    return (this.stacks.get(id) ?? 0) > 0;
  }

  count(id: MutationId): number {
    return this.stacks.get(id) ?? 0;
  }

  entries(): Array<{ definition: MutationDefinition; stacks: number }> {
    return [...this.stacks.entries()].map(([id, stacks]) => ({ definition: MUTATIONS[id], stacks }));
  }

  applyStats(base: RobotStats): RobotStats {
    const result = { ...base };
    for (const [id, stacks] of this.stacks) MUTATIONS[id].applyStats(result, stacks);
    return result;
  }

  mutateIntent(intent: ControlIntent, moving: boolean, grounded: boolean): void {
    for (const [id, stacks] of this.stacks) MUTATIONS[id].mutateIntent?.(intent, moving, grounded, stacks);
  }
}

export function drawMutationChoices(count: number): MutationDefinition[] {
  const all = Object.values(MUTATIONS);
  const copy = [...all];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, count);
}
