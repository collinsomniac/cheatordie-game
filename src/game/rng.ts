export class RandomSource {
  readonly seed: number;
  private state: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.state = this.seed || 0x6d2b79f5;
  }

  next = (): number => {
    // Mulberry32: tiny, deterministic, and adequate for gameplay sequencing.
    let t = this.state += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runSeedFromLocation(): number {
  const requested = new URLSearchParams(location.search).get('seed');
  if (requested) {
    const parsed = Number.parseInt(requested, 10);
    if (Number.isFinite(parsed)) return parsed >>> 0;
  }

  const entropy = new Uint32Array(1);
  crypto.getRandomValues(entropy);
  return entropy[0] ?? 1;
}

export function mixSeed(base: number, a: number, b = 0): number {
  let value = (base ^ Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0xc2b2ae35, 0x27d4eb2f)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0;
}
