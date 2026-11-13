// Optional browser regression suite. Start the app locally, then run
// PLAYWRIGHT_MODULE=<installed playwright module path> npm run test:stock-ui.
// Every database request is mocked; non-local application URLs are rejected.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const resolveModule = createRequire(import.meta.url);
const { chromium } = resolveModule(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.STOCK_TEST_BASE_URL || 'http://127.0.0.1:3014';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname), 'Only a local test server is allowed');
const output = process.env.STOCK_TEST_OUTPUT_DIR || path.join(root, 'node_modules/.cache/stock-status');
fs.mkdirSync(output, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message) {
  for (let count = 0; count < 200; count++) { if (await check()) return; await pause(25); }
  throw new Error(message);
}

async function scenario(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
  const state = {
    products: Array.from({ length: 225 }, (_, i) => ({ id: `p${i}`, name: i ? `Produit ${String(i).padStart(3, '0')}` : 'Abricots moelleux', code: `P${i}`, supplier_id: 'epsilon', category_id: 'fruit', purchase_price: 3, sale_price: 6 })),
    product_markets: Array.from({ length: 225 }, (_, i) => ['a', 'b'].map(market_id => ({ product_id: `p${i}`, market_id, status: i === 1 ? 'low' : 'available', reorder_quantity: 5, reorder_unit: 'kg' }))).flat(),
    product_alternative_suppliers: [],
    markets: [{ id: 'a', name: 'Marché A' }, { id: 'b', name: 'Marché B' }],
    suppliers: [{ id: 'epsilon', name: 'Epsilon', phone_number: '0102030405' }],
    categories: [{ id: 'fruit', name: 'Fruits' }],
  };
  const jobs = [];
  const reads = {};
  const inFlight = new Map();
  let maxStatusInFlight = 0;
  let releaseInitial;
  const initialGate = new Promise(resolve => { releaseInitial = resolve; });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (['localhost', '127.0.0.1'].includes(url.hostname)) return route.continue();
    if (!url.pathname.startsWith('/rest/v1/')) return route.abort();
    const table = url.pathname.replace('/rest/v1/', '');
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,PATCH,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 200, headers, body: '{}' });
    if (request.method() === 'GET') {
      reads[table] = (reads[table] || 0) + 1;
      await initialGate;
      return route.fulfill({ status: 200, headers, body: JSON.stringify(state[table] || []) });
    }
    assert.equal(request.method(), 'PATCH');
    assert.equal(table, 'product_markets');
    const body = request.postDataJSON();
    const productId = url.searchParams.get('product_id').replace('eq.', '');
    const ids = url.searchParams.get('market_id').slice(4, -1).split(',').map(id => id.replaceAll('"', ''));
    if (body.status) {
      const count = (inFlight.get(productId) || 0) + 1;
      inFlight.set(productId, count);
      maxStatusInFlight = Math.max(maxStatusInFlight, count);
    }
    await new Promise(resolve => {
      jobs.push({ body, productId, ids, async finish(failure) {
        if (body.status) inFlight.set(productId, inFlight.get(productId) - 1);
        if (failure === 'network') await route.abort('internetdisconnected');
        else if (failure) await route.fulfill({ status: 503, headers, body: JSON.stringify({ code: 'TEST_FAILURE', message: 'Unavailable' }) });
        else {
          const rows = state.product_markets.filter(row => row.product_id === productId && ids.includes(row.market_id));
          rows.forEach(row => Object.assign(row, body));
          await route.fulfill({ status: 200, headers, body: JSON.stringify(rows) });
        }
        resolve();
      } });
    });
  });
  const card = () => page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Abricots moelleux', exact: true }) });
  const selected = async name => until(async () => (await card().getByRole('button', { name, exact: true }).getAttribute('aria-pressed')) === 'true', `${name} was not selected optimistically`);
  const waitJob = index => until(() => jobs.length > index, `Request ${index} was not sent`);
  const quiet = async () => {
    assert.equal(await page.getByText(/^(Actualisation en cours|Mise à jour du stock|Opération en cours)/).count(), 0);
    assert.equal(await page.getByRole('dialog').count(), 0);
    if (await card().count()) for (const name of ['Disponible', 'À racheter', 'Épuisé']) assert.equal(await card().getByRole('button', { name, exact: true }).isEnabled(), true);
  };
  try {
    await page.goto(`${baseUrl}/stock`);
    await page.getByRole('status', { name: 'Chargement du stock…', exact: true }).waitFor();
    releaseInitial();
    await card().waitFor();
    await page.getByText('225 produits', { exact: true }).waitFor();
    const initialReads = { ...reads };

    // Nothing on the server is acknowledged until the assertions below complete.
    await card().evaluate(element => {
      const button = [...element.querySelectorAll('button')].find(button => button.textContent === 'À racheter');
      button.addEventListener('click', () => {
        const started = performance.now();
        const observer = new MutationObserver(() => {
          if (button.getAttribute('aria-pressed') === 'true') {
            window.stockStatusLatency = performance.now() - started;
            observer.disconnect();
          }
        });
        observer.observe(button, { attributes: true, attributeFilter: ['aria-pressed'] });
      }, { once: true, capture: true });
    });
    await card().getByRole('button', { name: 'À racheter', exact: true }).click();
    await selected('À racheter');
    const optimisticLatencyMs = await page.evaluate(() => window.stockStatusLatency);
    assert.ok(optimisticLatencyMs < 150, `Click-to-status update took ${optimisticLatencyMs}ms`);
    await waitJob(0);
    assert.equal(state.product_markets[0].status, 'available');
    await quiet();
    assert.equal(await card().getByLabel('Quantité à racheter').inputValue(), '5');
    await page.getByRole('button', { name: 'À racheter', exact: true }).first().click();
    await page.getByText('2 produits', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Tous', exact: true }).click();

    // A quantity acknowledgement must not overwrite a newer optimistic status.
    await card().getByLabel('Quantité à racheter').fill('7,5');
    await card().getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await waitJob(1);
    await card().getByRole('button', { name: 'Épuisé', exact: true }).click();
    await selected('Épuisé');
    await quiet();
    await jobs[1].finish();
    await selected('Épuisé');
    await jobs[0].finish();
    await waitJob(2);
    assert.equal(jobs[2].body.status, 'out');
    await selected('Épuisé');
    assert.equal(await card().getByLabel('Quantité à racheter').inputValue(), '7,5');

    // Filters and counts react before the pending out request is acknowledged.
    await page.getByRole('button', { name: 'En rupture', exact: true }).click();
    await page.getByText('1 produit', { exact: true }).waitFor();
    await card().getByRole('button', { name: 'Disponible', exact: true }).click();
    await page.getByText('0 produits', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Tous', exact: true }).click();
    await selected('Disponible');
    await page.getByText('225 produits', { exact: true }).waitFor();
    await jobs[2].finish();
    await waitJob(3);
    await selected('Disponible');
    await jobs[3].finish();
    await quiet();

    // A burst sends the first write, then only the latest queued selection.
    await card().getByRole('button', { name: 'À racheter', exact: true }).click();
    await waitJob(4);
    await card().evaluate(element => {
      for (const name of ['Épuisé', 'Disponible', 'À racheter', 'Épuisé']) {
        [...element.querySelectorAll('button')].find(button => button.textContent === name).click();
      }
    });
    await selected('Épuisé');
    assert.equal(jobs.length, 5);
    await jobs[4].finish();
    await waitJob(5);
    assert.equal(jobs[5].body.status, 'out');
    await selected('Épuisé');
    await jobs[5].finish();

    // Both HTTP and disconnected-network failures roll back to the saved state.
    for (const [index, failure] of [[6, 'http'], [7, 'network']]) {
      await card().getByRole('button', { name: 'Disponible', exact: true }).click();
      await selected('Disponible');
      await waitJob(index);
      await quiet();
      await jobs[index].finish(failure);
      await selected('Épuisé');
      await page.getByText('Modification impossible. Le dernier statut enregistré a été rétabli.', { exact: true }).first().waitFor();
      await quiet();
    }
    const errorCount = await page.getByText('Modification impossible. Le dernier statut enregistré a été rétabli.', { exact: true }).count();
    await card().getByRole('button', { name: 'À racheter', exact: true }).click();
    await waitJob(8);
    await card().getByRole('button', { name: 'Disponible', exact: true }).click();
    await selected('Disponible');
    await jobs[8].finish('http');
    await waitJob(9);
    await selected('Disponible');
    assert.ok(await page.getByText('Modification impossible. Le dernier statut enregistré a été rétabli.', { exact: true }).count() <= errorCount);
    await jobs[9].finish();
    assert.deepEqual(reads, initialReads, 'No full-list refetch after status or quantity writes');

    // The queue survives client-side navigation and another stock-page mount.
    await card().getByRole('button', { name: 'À racheter', exact: true }).click();
    await waitJob(10);
    await page.getByRole('link', { name: 'Catalogue', exact: true }).click();
    await page.getByRole('heading', { name: 'Catalogue', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Stock', exact: true }).click();
    await selected('À racheter');
    await card().getByRole('button', { name: 'Épuisé', exact: true }).click();
    await selected('Épuisé');
    assert.equal(jobs.length, 11);
    await jobs[10].finish();
    await waitJob(11);
    await selected('Épuisé');
    await jobs[11].finish();
    assert.equal(maxStatusInFlight, 1);
    assert.equal(state.product_markets[0].status, 'out');
    assert.equal(state.product_markets[0].reorder_quantity, 7.5);
    assert.deepEqual(errors, []);
    await quiet();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: path.join(output, `stock-instant-${width}.png`) });
    console.log(JSON.stringify({ width, products: 225, optimisticLatencyMs, statusWrites: jobs.filter(job => job.body.status).length, maxStatusInFlight, normalUpdateRefetches: 0, failuresRolledBack: 2, runtimeErrors: errors.length }));
  } catch (error) {
    await page.screenshot({ path: path.join(output, `failure-${width}.png`), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(output, `failure-${width}.txt`), await page.locator('body').innerText().catch(() => ''));
    throw error;
  } finally { await context.close(); }
}

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
try { for (const width of [1280, 390]) await scenario(browser, width); }
finally { await browser.close(); }
