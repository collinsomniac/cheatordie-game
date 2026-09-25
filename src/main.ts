import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const startPanel = document.querySelector<HTMLElement>('#start-panel');
const startButton = document.querySelector<HTMLButtonElement>('#start-button');
const backendLabel = document.querySelector<HTMLElement>('#backend-label');
const perf = document.querySelector<HTMLElement>('#perf');

if (!canvas || !startPanel || !startButton || !backendLabel || !perf) throw new Error('Required game DOM missing');

let running = false;

startButton.addEventListener('click', async () => {
  if (running) return;
  startButton.disabled = true;
  startButton.textContent = 'ENTERING FULLSCREEN…';
  try {
    await enterGamePresentation();
    startButton.textContent = 'INITIALIZING…';
    // Keep the landing shell tiny; the engine/WASM path is fetched only after the player boots.
    backendLabel.textContent = 'LOADING MODULES';
    const [{ createEngine, createWorld }, { AdaptiveResolution }, { Game }, { GAME }] = await Promise.all([
      import('./game/world'),
      import('./game/performance'),
      import('./game/game'),
      import('./game/config'),
    ]);

    const hud = {
      healthFill: requireElement('#health-fill'),
      healthLabel: requireElement('#health-label'),
      waveLabel: requireElement('#wave-label'),
      ammoLabel: requireElement('#ammo-label'),
      mutationStrip: requireElement('#mutation-strip'),
      upgradePanel: requireElement('#upgrade-panel'),
      upgradeCards: requireElement('#upgrade-cards'),
      toast: requireElement('#toast'),
      hitMarker: requireElement('#hit-marker'),
      damageVignette: requireElement('#damage-vignette'),
    };

    backendLabel.textContent = 'GRAPHICS';
    const { engine, backend } = await createEngine(canvas);
    backendLabel.textContent = `${backend.toUpperCase()} · PHYSICS`;
    const { scene, physicsMode, physicsFallbackReason } = await createWorld(engine);
    backendLabel.textContent = `${backend.toUpperCase()} · ${physicsMode.toUpperCase()}`;
    if (physicsFallbackReason) console.info('Physics fallback reason:', physicsFallbackReason);
    const adaptive = new AdaptiveResolution(engine);
    const game = new Game(scene, canvas, hud, physicsMode);
    running = true;
    document.body.classList.add('game-running');
    startPanel.classList.add('hidden');
    game.input.requestPointerLock();

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
      perf.textContent = `${backend.toUpperCase()} · ${physicsMode.toUpperCase()} · ${adaptive.label} · SEED ${game.seed}`;
      scene.render();
    });

    const resize = (): void => engine.resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
  } catch (error) {
    console.error(error);
    backendLabel.textContent = 'BOOT ERROR';
    startButton.disabled = false;
    startButton.textContent = 'RETRY BOOT';
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error && error.stack ? `\n${error.stack.split('\n').slice(0, 4).join('\n')}` : '';
    const body = startPanel.querySelector('p');
    if (body) body.textContent = `Failed to initialize the combat runtime: ${message}${stack}`;
  }
});

function requireElement<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}


async function enterGamePresentation(): Promise<void> {
  const app = requireElement<HTMLElement>('#app');

  // Fullscreen is requested immediately from the boot gesture before async game loading
  // consumes transient user activation.
  if (!document.fullscreenElement && typeof app.requestFullscreen === 'function') {
    try {
      await app.requestFullscreen();
    } catch (error) {
      console.warn('Fullscreen request was rejected; continuing with the landscape gate.', error);
    }
  }

  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: 'landscape') => Promise<void>;
  };
  if (typeof orientation?.lock === 'function') {
    try {
      await orientation.lock('landscape');
    } catch (error) {
      console.info('Orientation lock unavailable; CSS landscape gate remains authoritative.', error);
    }
  }
}
