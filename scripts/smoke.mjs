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

async function bootCase(browser, label, query, expectedBackend, contextOptions = {}) {
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

  await page.goto(origin + base + query, { waitUntil: 'domcontentloaded' });
  await page.locator('#start-button').click();
  try {
    await page.locator('#start-panel').waitFor({ state: 'hidden', timeout: 15_000 });
  } catch (error) {
    const backendAtFailure = await page.locator('#backend-label').textContent().catch(() => null);
    const bootText = await page.locator('#start-panel p').textContent().catch(() => null);
    throw new Error(
      label + ': boot never completed. stage=' + backendAtFailure +
      '\nboot=' + bootText +
      '\nruntime=' + (runtimeErrors.length ? runtimeErrors.join('\n') : '(none)') +
      '\noriginal=' + (error instanceof Error ? error.message : String(error))
    );
  }
  await page.waitForTimeout(500);

  const backend = await page.locator('#backend-label').textContent();
  const expected = Array.isArray(expectedBackend) ? expectedBackend : [expectedBackend];
  if (!expected.some((value) => backend?.includes(value))) {
    throw new Error(label + ': unexpected backend label: ' + backend + ' expected one of ' + expected.join(', '));
  }

  const canvas = await page.locator('#game').evaluate((node) => ({
    width: node.width,
    height: node.height,
    clientWidth: node.clientWidth,
    clientHeight: node.clientHeight,
  }));
  if (canvas.width <= 0 || canvas.height <= 0 || canvas.clientWidth <= 0 || canvas.clientHeight <= 0) {
    throw new Error(label + ': canvas never acquired a drawable size: ' + JSON.stringify(canvas));
  }

  if (runtimeErrors.length) {
    throw new Error(label + ': runtime errors:\n' + runtimeErrors.join('\n'));
  }

  if (contextOptions.hasTouch) {
    const touchDisplay = await page.locator('#touch-controls').evaluate((node) => getComputedStyle(node).display);
    if (touchDisplay === 'none') {
      throw new Error(label + ': touch-capable boot succeeded but touch controls are hidden.');
    }
  }

  console.log('Smoke passed:', label, backend, canvas);
  await context.close();
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=swiftshader', '--enable-webgl'],
  });
  await bootCase(browser, 'kinematic safety path', '?backend=webgl&physics=kinematic&seed=1', 'WEBGL2 · KINEMATIC');
  await bootCase(
    browser,
    'iOS automatic path',
    '?backend=webgl&seed=1',
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

// Vite preview can leave a grandchild/pipe alive after its npm wrapper is killed.
// Reaching this line means every assertion passed, so terminate the smoke harness explicitly.
process.exit(0);
