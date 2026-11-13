import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { QueryClient } from '@tanstack/react-query';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { outputText } = ts.transpileModule(fs.readFileSync(path.join(root, 'lib/stockStatus.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const loaded = { exports: {} };
new Function('module', 'exports', outputText)(loaded, loaded.exports);
const { createStockStatusUpdater, patchProductMarkets, getStockStatus, PRODUCTS_QUERY_KEY } = loaded.exports;
const tick = () => new Promise(resolve => setImmediate(resolve));

const fixture = () => [
  { id: 'apricots', name: 'Abricots moelleux', supplier_id: 'epsilon', alternative_supplier_ids: ['socofram'], product_markets: [
    { market_id: 'a', status: 'available', reorder_quantity: 5.125, reorder_unit: 'kg' },
    { market_id: 'b', status: 'available', reorder_quantity: 12, reorder_unit: 'bocal' },
  ] },
  { id: 'figs', name: 'Figues', product_markets: [{ market_id: 'a', status: 'available', reorder_quantity: 4, reorder_unit: 'boite' }] },
];

function setup(t) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(PRODUCTS_QUERY_KEY, fixture());
  const server = fixture();
  const calls = [];
  let failures = 0;
  const updater = createStockStatusUpdater(client, write => new Promise((resolve, reject) => {
    calls.push({ ...write, reject, resolve(savedIds = write.marketIds) {
      for (const market of server.find(product => product.id === write.productId).product_markets) {
        if (savedIds.includes(market.market_id)) market.status = write.status;
      }
      resolve(savedIds);
    } });
  }), () => failures++);
  t.after(() => { updater.dispose(); client.clear(); });
  return {
    client, server, calls, updater,
    get failures() { return failures; },
    data: () => client.getQueryData(PRODUCTS_QUERY_KEY),
    statuses: (id = 'apricots') => client.getQueryData(PRODUCTS_QUERY_KEY).find(product => product.id === id).product_markets.map(market => market.status),
    update: (status, marketIds = ['a', 'b'], productId = 'apricots') => updater.update({ productId, marketIds, status }),
  };
}

test('status is optimistic before the request resolves; other products, units and quantities retain identity/data', async t => {
  const s = setup(t);
  const before = s.data();
  s.update('low', ['a']);
  assert.deepEqual(s.statuses(), ['low', 'available']);
  assert.equal(s.calls.length, 1);
  assert.equal(s.data()[1], before[1]);
  assert.equal(s.data()[0].product_markets[1], before[0].product_markets[1]);
  assert.equal(s.data()[0].product_markets[0].reorder_quantity, 5.125);
  assert.equal(s.data()[0].product_markets[0].reorder_unit, 'kg');
  assert.deepEqual(s.data()[0].alternative_supplier_ids, ['socofram']);
  assert.equal(s.client.getMutationCache().getAll().length, 0);
  s.calls[0].resolve();
  await tick();
  assert.deepEqual(s.statuses(), ['low', 'available']);
  assert.equal(s.client.getQueryState(PRODUCTS_QUERY_KEY).isInvalidated, false);
});

test('rapid clicks coalesce behind the in-flight request and the last selection wins on server and cache', async t => {
  const s = setup(t);
  s.update('low');
  s.update('out');
  s.update('available');
  s.update('out');
  assert.deepEqual(s.statuses(), ['out', 'out']);
  assert.equal(s.calls.length, 1, 'No concurrent writes to the same product');
  s.calls[0].resolve();
  await tick();
  assert.equal(s.calls.length, 2);
  assert.equal(s.calls[1].status, 'out');
  assert.deepEqual(s.statuses(), ['out', 'out'], 'Older success must not flash its status');
  s.calls[1].resolve();
  await tick();
  assert.deepEqual(s.server[0].product_markets.map(market => market.status), ['out', 'out']);
  assert.equal(s.calls.length, 2);
  assert.equal(s.failures, 0);
});

test('failure rolls back only affected rows and preserves another product and concurrent quantity saves', async t => {
  const s = setup(t);
  s.update('low', ['a']);
  s.update('out', ['a'], 'figs');
  assert.equal(s.calls.length, 2, 'Different products save independently');
  s.client.setQueryData(PRODUCTS_QUERY_KEY, products => patchProductMarkets(products, 'apricots', ['a'], { reorder_quantity: 7.5, reorder_unit: 'kg' }));
  s.calls[1].resolve();
  s.calls[0].reject(new Error('Network offline'));
  await tick();
  assert.deepEqual(s.statuses(), ['available', 'available']);
  assert.deepEqual(s.statuses('figs'), ['out']);
  assert.equal(s.data()[0].product_markets[0].reorder_quantity, 7.5);
  assert.equal(s.failures, 1);
});

test('a failed obsolete request cannot roll back or report an error over a newer selection', async t => {
  const s = setup(t);
  s.update('low');
  s.update('out');
  s.calls[0].reject(new Error('Old request failed'));
  await tick();
  assert.deepEqual(s.statuses(), ['out', 'out']);
  assert.equal(s.failures, 0);
  assert.equal(s.calls[1].status, 'out');
  s.calls[1].resolve();
  await tick();
  assert.equal(s.failures, 0);
});

test('failure of the newest request restores the last acknowledged state, not the initial snapshot', async t => {
  const s = setup(t);
  s.update('low');
  s.update('out');
  s.calls[0].resolve();
  await tick();
  s.calls[1].reject(new Error('Newest request failed'));
  await tick();
  assert.deepEqual(s.statuses(), ['low', 'low']);
  assert.deepEqual(s.server[0].product_markets.map(market => market.status), ['low', 'low']);
  assert.equal(s.failures, 1);
});

test('all-market and single-market clicks preserve each market’s latest intent', async t => {
  const s = setup(t);
  s.update('low');
  s.update('out', ['a']);
  s.update('available', ['b']);
  assert.deepEqual(s.statuses(), ['out', 'available']);
  s.calls[0].resolve();
  await tick();
  assert.deepEqual(s.calls[1].marketIds, ['a']);
  assert.equal(s.calls[1].status, 'out');
  s.calls[1].resolve();
  await tick();
  assert.deepEqual(s.calls[2].marketIds, ['b']);
  assert.equal(s.calls[2].status, 'available');
  s.calls[2].resolve();
  await tick();
  assert.deepEqual(s.server[0].product_markets.map(market => market.status), ['out', 'available']);
  assert.deepEqual(s.statuses(), ['out', 'available']);
});

test('returning to the original state after an uncertain failure still sends the latest intent', async t => {
  const s = setup(t);
  s.update('low');
  s.update('available');
  s.calls[0].reject(new Error('Lost response'));
  await tick();
  assert.equal(s.calls.length, 2);
  assert.equal(s.calls[1].status, 'available');
  assert.deepEqual(s.statuses(), ['available', 'available']);
  s.calls[1].resolve();
  await tick();
  assert.equal(s.failures, 0);
});

test('partial acknowledgements preserve actual saved rows and roll back only refused rows', async t => {
  const s = setup(t);
  s.update('low');
  s.calls[0].resolve(['a']);
  await tick();
  assert.deepEqual(s.statuses(), ['low', 'available']);
  assert.deepEqual(s.server[0].product_markets.map(market => market.status), ['low', 'available']);
  assert.equal(s.failures, 1);
});

test('a refresh during a pending write retains optimistic statuses while accepting fresh non-status fields', async t => {
  const s = setup(t);
  s.update('low', ['a']);
  const refreshed = fixture();
  refreshed[0].product_markets[0].reorder_quantity = 8.25;
  refreshed[1].name = 'Figues fraîches';
  await s.client.fetchQuery({ queryKey: PRODUCTS_QUERY_KEY, queryFn: async () => refreshed, staleTime: 0 });
  assert.deepEqual(s.statuses(), ['low', 'available']);
  assert.equal(s.data()[0].product_markets[0].reorder_quantity, 8.25);
  assert.equal(s.data()[1].name, 'Figues fraîches');
  s.calls[0].resolve();
  await tick();
  assert.deepEqual(s.statuses(), ['low', 'available']);
});

test('a read started before the click cannot overwrite optimistic or confirmed stock when it finishes late', async t => {
  const s = setup(t);
  let finishRead;
  const read = s.client.fetchQuery({ queryKey: PRODUCTS_QUERY_KEY, queryFn: () => new Promise(resolve => { finishRead = resolve; }), staleTime: 0 }).catch(() => {});
  s.update('out');
  s.calls[0].resolve();
  await tick();
  finishRead(fixture());
  await read;
  assert.deepEqual(s.statuses(), ['out', 'out']);
  assert.equal(s.client.getQueryState(PRODUCTS_QUERY_KEY).status, 'success', 'Cancellation must not become a refresh error banner');
  assert.equal(s.client.getQueryState(PRODUCTS_QUERY_KEY).fetchStatus, 'idle');
});

test('queued duplicates already acknowledged by the server do not issue redundant writes', async t => {
  const s = setup(t);
  s.update('low');
  s.update('out');
  s.update('low');
  s.calls[0].resolve();
  await tick();
  assert.equal(s.calls.length, 1);
  assert.deepEqual(s.statuses(), ['low', 'low']);
});

test('unchanged, empty or missing targets are no-ops', t => {
  const s = setup(t);
  const original = s.data();
  s.update('available');
  s.update('low', []);
  s.update('low', ['missing']);
  s.update('low', ['a'], 'missing');
  assert.equal(s.calls.length, 0);
  assert.equal(s.data(), original);
});

test('quantity-only patches preserve statuses and aggregated/specific stock statuses remain correct', t => {
  const s = setup(t);
  s.client.setQueryData(PRODUCTS_QUERY_KEY, products => patchProductMarkets(products, 'apricots', ['a'], { status: 'out' }));
  s.client.setQueryData(PRODUCTS_QUERY_KEY, products => patchProductMarkets(products, 'apricots', ['a'], { reorder_quantity: 6.5 }));
  assert.equal(getStockStatus(s.data()[0], 'all'), 'out');
  assert.equal(getStockStatus(s.data()[0], 'a'), 'out');
  assert.equal(getStockStatus(s.data()[0], 'b'), 'available');
  assert.equal(s.data()[0].product_markets[0].reorder_quantity, 6.5);
});
