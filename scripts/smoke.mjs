import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:4173';
const base = '/cheatordie-game/';
const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NO_COLOR: '1' },
});

preview.stdout.on('data', (chunk) => process.stdout.write('[preview] ' + chunk));
preview.stderr.on('data', (chunk) => process.stderr.write('[preview] ' + chunk));

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin + base);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Vite preview did not become reachable.');
}

async function bootCase(browser, label, query, expectedDebug, contextOptions = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ...contextOptions,
  });
  const page = await context.newPage();
  const runtimeErrors = [];

  page.on('pageerror', (error) => runtimeErrors.push(error.stack || error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push('console: ' + message.text());
  });

  const join = query.includes('?') ? '&' : '?';
  await page.goto(origin + base + query + join + 'debug=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#start-button').click();

  try {
    await page.locator('#start-panel').waitFor({ state: 'hidden', timeout: 15_000 });
  } catch (error) {
    const stage = await page.locator('#backend-label').textContent().catch(() => null);
    const bootText = await page.locator('#start-panel p').textContent().catch(() => null);
    throw new Error(
      label + ': boot never completed. stage=' + stage +
      '\nboot=' + bootText +
      '\nruntime=' + (runtimeErrors.length ? runtimeErrors.join('\n') : '(none)') +
      '\noriginal=' + (error instanceof Error ? error.message : String(error))
    );
  }

  await page.waitForTimeout(600);

  const ready = await page.locator('#backend-label').textContent();
  if (ready !== 'SYSTEM READY') {
    throw new Error(label + ': user-facing state was not SYSTEM READY: ' + ready);
  }

  const debug = await page.locator('#perf').textContent();
  if (!debug?.includes(expectedDebug)) {
    throw new Error(label + ': unexpected debug runtime: ' + debug + ' expected ' + expectedDebug);
  }

  const canvas = await page.locator('#game').evaluate((node) => ({
    width: node.width,
    height: node.height,
    clientWidth: node.clientWidth,
    clientHeight: node.clientHeight,
  }));
  const viewportFit = await page.locator('#app').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      appWidth: rect.width,
      appHeight: rect.height,
      visualWidth: window.visualViewport?.width ?? window.innerWidth,
      visualHeight: window.visualViewport?.height ?? window.innerHeight,
    };
  });
  if (Math.abs(viewportFit.appWidth - viewportFit.visualWidth) > 2 ||
      Math.abs(viewportFit.appHeight - viewportFit.visualHeight) > 2) {
    throw new Error(label + ': app does not match visual viewport: ' + JSON.stringify(viewportFit));
  }

  const vitals = await page.evaluate(() => ({
    shield: document.querySelector('#shield-label')?.textContent,
    health: document.querySelector('#health-label')?.textContent,
  }));
  if (vitals.shield !== '100' || vitals.health !== '100') {
    throw new Error(label + ': expected 100 shield / 100 health, got ' + JSON.stringify(vitals));
  }
  if (canvas.width <= 0 || canvas.height <= 0 || canvas.clientWidth <= 0 || canvas.clientHeight <= 0) {
    throw new Error(label + ': canvas never acquired a drawable size: ' + JSON.stringify(canvas));
  }

  // Chassis editor is part of the default sandbox contract, not a later wave-only screen.
  await page.locator('#loadout-toggle').click();
  await page.locator('#loadout-panel').waitFor({ state: 'visible', timeout: 2_000 });
  const partCount = await page.locator('.part-card').count();
  if (partCount < 8) throw new Error(label + ': chassis catalog did not render expected parts.');

  const firstAvailable = page.locator('.part-card:not(:disabled)').first();
  await firstAvailable.click();
  const occupiedSlots = await page.locator('.slot.is-occupied').count();
  if (occupiedSlots < 1) throw new Error(label + ': installing a part did not occupy body sockets.');
  await page.locator('#target-noise').click();
  await page.locator('#loadout-close').click();

  if (runtimeErrors.length) {
    throw new Error(label + ': runtime errors:\n' + runtimeErrors.join('\n'));
  }

  if (contextOptions.hasTouch) {
    const touchDisplay = await page.locator('#touch-controls').evaluate((node) => getComputedStyle(node).display);
    if (touchDisplay === 'none') {
      throw new Error(label + ': touch-capable boot succeeded but touch controls are hidden.');
    }

    const layout = await page.evaluate(() => {
      const app = document.querySelector('#app')?.getBoundingClientRect();
      const selectors = ['fire', 'jump', 'sprint', 'camera'];
      const controls = selectors.map((key) => {
        const rect = document.querySelector('[data-layout-key="' + key + '"]')?.getBoundingClientRect();
        return rect ? { key, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null;
      });
      return app ? { app: { left: app.left, top: app.top, right: app.right, bottom: app.bottom }, controls } : null;
    });
    if (!layout || layout.controls.some((control) =>
      !control ||
      control.left < layout.app.left ||
      control.top < layout.app.top ||
      control.right > layout.app.right ||
      control.bottom > layout.app.bottom
    )) {
      throw new Error(label + ': one or more default touch controls are outside the visible app: ' + JSON.stringify(layout));
    }

    await page.locator('#controls-edit-toggle').click();
    const editing = await page.evaluate(() => document.body.classList.contains('controls-editing'));
    if (!editing) throw new Error(label + ': EDIT HUD did not unlock touch layout.');
    await page.locator('#controls-edit-toggle').click();
  }

  console.log('Smoke passed:', label, debug, canvas, 'parts=' + partCount, 'occupied=' + occupiedSlots);
  await context.close();
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=swiftshader', '--enable-webgl'],
  });

  await bootCase(
    browser,
    'kinematic desktop path',
    '?backend=webgl&physics=kinematic',
    'WEBGL2 · KINEMATIC',
  );

  await bootCase(
    browser,
    'iOS landscape path',
    '?backend=webgl',
    'WEBGL2 · KINEMATIC',
    {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1',
      hasTouch: true,
      isMobile: true,
      screen: { width: 932, height: 430 },
      viewport: { width: 932, height: 430 },
    },
  );
} finally {
  await browser?.close();
  preview.kill('SIGTERM');
}

process.exit(0);
