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
  startButton.textContent = 'INITIALIZING…';
  try {
    // Keep the landing shell tiny; the engine/WASM path is fetched only after the player boots.
    const [{ createEngine, createScene }, { AdaptiveResolution }, { Game }, { GAME }] = await Promise.all([
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

    const { engine, backend } = await createEngine(canvas);
    backendLabel.textContent = backend.toUpperCase();
    const scene = await createScene(engine);
    const adaptive = new AdaptiveResolution(engine);
    const game = new Game(scene, canvas, hud);
    running = true;
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
      perf.textContent = `${backend.toUpperCase()} · ${adaptive.label}`;
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
    const body = startPanel.querySelector('p');
    if (body) body.textContent = `Failed to initialize the combat runtime: ${message}`;
  }
});

function requireElement<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}
