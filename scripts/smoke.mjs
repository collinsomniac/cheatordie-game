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

async function bootCase(browser, label, query, expectedBackend) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
  if (!backend?.includes(expectedBackend)) {
    throw new Error(label + ': unexpected backend label: ' + backend);
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

  console.log('Smoke passed:', label, backend, canvas);
  await page.close();
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=swiftshader', '--enable-webgl'],
  });
  await bootCase(browser, 'kinematic safety path', '?backend=webgl&physics=kinematic&seed=1', 'WEBGL2 · KINEMATIC');
  await bootCase(browser, 'havok path', '?backend=webgl&physics=havok&seed=1', 'WEBGL2 · HAVOK');
} finally {
  await browser?.close();
  preview.kill('SIGTERM');
}
