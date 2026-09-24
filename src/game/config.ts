export const GAME = {
  gravity: -24,
  fixedStep: 1 / 60,
  maxFrameDt: 1 / 15,
  arenaHalfSize: 24,
  playerSpawn: { x: 0, y: 1.05, z: -13 },
  targetFps: 60,
  minRenderScale: 0.62,
  maxRenderScale: 1.0,
  initialRenderScale: 0.88,
  renderScaleStep: 0.06,
  lowFpsThreshold: 49,
  highFpsThreshold: 58,
  resolutionSampleSeconds: 2.0,
} as const;

export const COLORS = {
  floor: '#121719',
  wall: '#20292b',
  trim: '#4d5a56',
  player: '#8fffb2',
  enemy: '#ff5a5f',
  enemyAccent: '#ffb347',
  emissive: '#8fffb2',
  sky: '#050708',
} as const;
