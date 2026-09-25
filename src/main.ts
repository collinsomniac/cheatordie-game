import './style.css';
import { TouchLayoutEditor } from './game/touchLayout';

syncVisualViewport();

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const startPanel = document.querySelector<HTMLElement>('#start-panel');
const startButton = document.querySelector<HTMLButtonElement>('#start-button');
const backendLabel = document.querySelector<HTMLElement>('#backend-label');
const bootStatus = document.querySelector<HTMLElement>('#boot-status');
const perf = document.querySelector<HTMLElement>('#perf');

if (!canvas || !startPanel || !startButton || !backendLabel || !bootStatus || !perf) {
  throw new Error('Required game DOM missing');
}

const app = requireElement<HTMLElement>('#app');
const touchControls = requireElement<HTMLElement>('#touch-controls');
const controlsEdit = requireElement<HTMLButtonElement>('#controls-edit-toggle');
const controlsReset = requireElement<HTMLButtonElement>('#controls-reset');
new TouchLayoutEditor(touchControls, controlsEdit, controlsReset);

const standalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
document.documentElement.dataset.displayMode = standalone ? 'installed' : 'browser';

app.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });
app.addEventListener('contextmenu', (event) => event.preventDefault());
app.addEventListener('selectstart', (event) => event.preventDefault());

const debugEnabled = new URLSearchParams(location.search).get('debug') === '1';
if (debugEnabled) perf.classList.remove('hidden');

let running = false;

startButton.addEventListener('click', async () => {
  if (running) return;
  startButton.disabled = true;
  startButton.textContent = 'ENTERING…';
  bootStatus.textContent = 'NEGOTIATING DISPLAY';

  try {
    await enterGamePresentation(app);
    syncVisualViewport();
    startButton.textContent = 'INITIALIZING…';
    bootStatus.textContent = 'LOADING RANGE';
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
      shieldFill: requireElement('#shield-fill'),
      shieldLabel: requireElement('#shield-label'),
      damageLayer: requireElement('#damage-layer'),
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
      targetSpinButton: requireElement<HTMLButtonElement>('#target-spin'),
    };

    bootStatus.textContent = 'INITIALIZING RENDERER';
    backendLabel.textContent = 'INITIALIZING RENDERER';
    const { engine, backend } = await createEngine(canvas);
    bootStatus.textContent = 'INITIALIZING WORLD';
    backendLabel.textContent = 'INITIALIZING WORLD';
    const { scene, physicsMode, physicsFallbackReason } = await createWorld(engine);
    const adaptive = new AdaptiveResolution(engine);
    const game = new Game(scene, canvas, hud, physicsMode);

    console.info('CHEAT OR DIE runtime', { backend, physicsMode, physicsFallbackReason });

    running = true;
    backendLabel.textContent = 'SYSTEM READY';
    bootStatus.textContent = 'SYSTEM READY';
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

    const resize = (): void => {
      syncVisualViewport();
      engine.resize();
    };
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
  } catch (error) {
    console.error(error);
    backendLabel.textContent = 'STARTUP FAILED';
    bootStatus.textContent = 'STARTUP FAILED';
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

function syncVisualViewport(): void {
  const viewport = window.visualViewport;
  const width = Math.round(viewport?.width ?? window.innerWidth);
  const height = Math.round(viewport?.height ?? window.innerHeight);
  document.documentElement.style.setProperty('--game-width', `${width}px`);
  document.documentElement.style.setProperty('--game-height', `${height}px`);
}

async function enterGamePresentation(appElement: HTMLElement): Promise<void> {
  if (!document.fullscreenElement && typeof appElement.requestFullscreen === 'function') {
    try {
      await appElement.requestFullscreen({ navigationUI: 'hide' });
    } catch (error) {
      console.info('Interactive fullscreen unavailable; using installed-app/visual-viewport presentation.', error);
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
