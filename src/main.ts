import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const startPanel = document.querySelector<HTMLElement>('#start-panel');
const startButton = document.querySelector<HTMLButtonElement>('#start-button');
const backendLabel = document.querySelector<HTMLElement>('#backend-label');
const perf = document.querySelector<HTMLElement>('#perf');

if (!canvas || !startPanel || !startButton || !backendLabel || !perf) {
  throw new Error('Required game DOM missing');
}

const debugEnabled = new URLSearchParams(location.search).get('debug') === '1';
if (debugEnabled) perf.classList.remove('hidden');

let running = false;

startButton.addEventListener('click', async () => {
  if (running) return;
  startButton.disabled = true;
  startButton.textContent = 'ENTERING LANDSCAPE…';

  try {
    await enterGamePresentation();
    startButton.textContent = 'INITIALIZING…';
    backendLabel.textContent = 'LOADING RANGE';

    const [{ createEngine, createWorld }, { AdaptiveResolution }, { Game }, { GAME }] = await Promise.all([
      import('./game/world'),
      import('./game/performance'),
      import('./game/game'),
      import('./game/config'),
    ]);

    const hud = {
      healthFill: requireElement('#health-fill'),
      healthLabel: requireElement('#health-label'),
      modeLabel: requireElement('#mode-label'),
      ammoLabel: requireElement('#ammo-label'),
      mutationStrip: requireElement('#mutation-strip'),
      toast: requireElement('#toast'),
      hitMarker: requireElement('#hit-marker'),
      damageVignette: requireElement('#damage-vignette'),
      loadoutPanel: requireElement('#loadout-panel'),
      loadoutBody: requireElement('#loadout-body'),
      partCatalog: requireElement('#part-catalog'),
      loadoutToggle: requireElement<HTMLButtonElement>('#loadout-toggle'),
      loadoutClose: requireElement<HTMLButtonElement>('#loadout-close'),
      espMarker: requireElement('#esp-marker'),
      targetNoiseButton: requireElement<HTMLButtonElement>('#target-noise'),
    };

    backendLabel.textContent = 'INITIALIZING RENDERER';
    const { engine, backend } = await createEngine(canvas);
    backendLabel.textContent = 'INITIALIZING WORLD';
    const { scene, physicsMode, physicsFallbackReason } = await createWorld(engine);
    const adaptive = new AdaptiveResolution(engine);
    const game = new Game(scene, canvas, hud, physicsMode);

    console.info('CHEAT OR DIE runtime', { backend, physicsMode, physicsFallbackReason });

    running = true;
    backendLabel.textContent = 'SYSTEM READY';
    document.body.classList.add('game-running');
    startPanel.classList.add('hidden');

    let last = performance.now();
    let accumulator = 0;
    engine.runRenderLoop(() => {
      const now = performance.now();
      const frameDt = Math.min(GAME.maxFrameDt, (now - last) / 1000);
      last = now;
      accumulator = Math.min(accumulator + frameDt, GAME.fixedStep * 4);

      while (accumulator >= GAME.fixedStep) {
        game.update(GAME.fixedStep);
        accumulator -= GAME.fixedStep;
      }

      adaptive.update(frameDt);
      if (debugEnabled) {
        perf.textContent = `${backend.toUpperCase()} · ${physicsMode.toUpperCase()} · ${adaptive.label}`;
      }
      scene.render();
    });

    const resize = (): void => engine.resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
  } catch (error) {
    console.error(error);
    backendLabel.textContent = 'STARTUP FAILED';
    startButton.disabled = false;
    startButton.textContent = 'RETRY';

    const body = startPanel.querySelector('p');
    if (body) {
      if (debugEnabled) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error && error.stack
          ? `\n${error.stack.split('\n').slice(0, 4).join('\n')}`
          : '';
        body.textContent = `Startup failed: ${message}${stack}`;
      } else {
        body.textContent = 'The sandbox could not start. Reload the page and try again.';
      }
    }
  }
});

function requireElement<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}

async function enterGamePresentation(): Promise<void> {
  const app = requireElement<HTMLElement>('#app');

  // Keep browser chrome and accidental page gestures out of the core touch surface when supported.
  if (!document.fullscreenElement && typeof app.requestFullscreen === 'function') {
    try {
      await app.requestFullscreen({ navigationUI: 'hide' });
    } catch (error) {
      console.info('Fullscreen unavailable; continuing with landscape/touch containment.', error);
    }
  }

  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: 'landscape') => Promise<void>;
  };
  if (typeof orientation?.lock === 'function') {
    try {
      await orientation.lock('landscape');
    } catch (error) {
      console.info('Native orientation lock unavailable; CSS landscape gate remains active.', error);
    }
  }
}
