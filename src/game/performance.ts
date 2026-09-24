import type { SupportedEngine } from './world';
import { GAME } from './config';

export class AdaptiveResolution {
  private renderScale: number = GAME.initialRenderScale;
  private elapsed = 0;
  private frameCount = 0;
  private displayFps = 60;

  constructor(private readonly engine: SupportedEngine) {
    this.apply();
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.frameCount += 1;
    if (this.elapsed < GAME.resolutionSampleSeconds) return;
    const fps = this.frameCount / this.elapsed;
    this.displayFps = fps;
    if (fps < GAME.lowFpsThreshold && this.renderScale > GAME.minRenderScale) {
      this.renderScale = Math.max(GAME.minRenderScale, this.renderScale - GAME.renderScaleStep);
      this.apply();
    } else if (fps > GAME.highFpsThreshold && this.renderScale < GAME.maxRenderScale) {
      this.renderScale = Math.min(GAME.maxRenderScale, this.renderScale + GAME.renderScaleStep * 0.5);
      this.apply();
    }
    this.elapsed = 0;
    this.frameCount = 0;
  }

  get label(): string {
    return `${Math.round(this.displayFps)} FPS · ${Math.round(this.renderScale * 100)}% RES`;
  }

  private apply(): void {
    // Intentionally ignore devicePixelRatio. A DPR-3 phone rendering at CSS resolution
    // already cuts fragment work dramatically, and the slight softness suits the art direction.
    this.engine.setHardwareScalingLevel(1 / this.renderScale);
  }
}
