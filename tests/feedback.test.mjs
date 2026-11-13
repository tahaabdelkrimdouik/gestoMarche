import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resolveModule = createRequire(import.meta.url);

// Exercise the repository's TypeScript without adding another test runtime.
function loadTS(relativePath, mocks = {}) {
  const filename = path.resolve(root, relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = { exports: {} };
  const localRequire = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.')) return loadTS(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)), mocks);
    return resolveModule(name);
  };
  new Function('require', 'module', 'exports', outputText)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

const { normalizeAlternativeSupplierIds, needsReplenishment, replenishmentStatus } = loadTS('lib/suppliers.ts');
const { getReorderDetails, parseReorderQuantity } = loadTS('lib/reorder.ts');

function queryModule(tables, rpcError = null) {
  const calls = [];
  const supabase = {
    from(table) {
      calls.push({ table });
      const result = tables[table] || { data: [], error: null };
      const builder = {
        select() { return this; }, order() { return this; }, in() { return this; },
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
      };
      return builder;
    },
    async rpc(name, args) { calls.push({ rpc: name, args }); return { error: rpcError }; },
  };
  return { calls, ...loadTS('lib/queries.ts', { '@/lib/supabaseClient': { supabase } }) };
}

const product = { id: 'apricots', name: 'Abricots moelleux', supplier_id: 'epsilon', code: '231', category_id: 'fruit', purchase_price: 3, sale_price: 6 };
const stock = { product_id: product.id, market_id: 'market-a', status: 'out', reorder_quantity: 5.125, reorder_unit: 'kg' };

test('alternative suppliers exclude duplicates, the primary supplier and empty ids', () => {
  assert.deepEqual(normalizeAlternativeSupplierIds(['socofram', 'epsilon', 'socofram', '', 'other'], 'epsilon'), ['socofram', 'other']);
  assert.deepEqual(normalizeAlternativeSupplierIds([], null), []);
});

test('low and out products are included once, while available/unassigned products are excluded', () => {
  const products = [
    { product_markets: [{ status: 'low' }] },
    { product_markets: [{ status: 'out' }] },
    { product_markets: [{ status: 'available' }, { status: 'out' }, { status: 'low' }] },
    { product_markets: [{ status: 'available' }] },
    { product_markets: [] },
  ];
  assert.equal(products.filter(needsReplenishment).length, 3);
  assert.equal(replenishmentStatus(products[0]), 'low');
  assert.equal(replenishmentStatus(products[2]), 'out');
});

test('reorder details select a low or depleted market before an available market', () => {
  const available = { market_id: 'a', status: 'available', reorder_quantity: 1, reorder_unit: 'piece' };
  const out = { ...stock, status: 'out' };
  assert.deepEqual(getReorderDetails([available, out]), { quantity: 5.125, unit: 'kg' });
  assert.deepEqual(getReorderDetails([out, { ...out, status: 'low', reorder_quantity: 12, reorder_unit: 'bocal' }]), { quantity: 12, unit: 'bocal' });
  assert.deepEqual(getReorderDetails([]), { quantity: 1, unit: 'piece' });
});

test('inline quantities retain decimal and unit validation', () => {
  assert.equal(parseReorderQuantity('5,125', 'kg').value, 5.125);
  assert.equal(parseReorderQuantity('5.125', 'kg').value, 5.125);
  for (const value of ['0', '-1', '1,5', '100000', 'texte']) assert.ok(parseReorderQuantity(value, 'piece').error);
  assert.ok(parseReorderQuantity('1.2345', 'kg').error);
});

test('catalogue loads existing products without alternatives and preserves stock quantities and units', async () => {
  const queries = queryModule({ products: { data: [product] }, product_markets: { data: [stock] } });
  const [result] = await queries.fetchProducts();
  assert.deepEqual(result.alternative_supplier_ids, []);
  assert.deepEqual(result.product_markets, [{ market_id: 'market-a', status: 'out', reorder_quantity: 5.125, reorder_unit: 'kg' }]);
});

test('catalogue joins explicit alternatives without creating or merging products', async () => {
  const otherProduct = { ...product, id: 'other-apricots', supplier_id: 'socofram' };
  const queries = queryModule({
    products: { data: [product, otherProduct] }, product_markets: { data: [stock] },
    product_alternative_suppliers: { data: [{ product_id: product.id, supplier_id: 'socofram' }] },
  });
  const results = await queries.fetchProducts();
  assert.equal(results.length, 2);
  assert.deepEqual(results[0].alternative_supplier_ids, ['socofram']);
  assert.deepEqual(results[1].alternative_supplier_ids, []);
  assert.deepEqual(results[1].product_markets, []);
});

test('missing alternatives migration keeps legacy reads working; other errors are not treated as empty links', async () => {
  for (const code of ['42P01', 'PGRST205']) {
    const queries = queryModule({ products: { data: [product] }, product_markets: { data: [stock] }, product_alternative_suppliers: { data: null, error: { code } } });
    assert.deepEqual((await queries.fetchProducts())[0].alternative_supplier_ids, []);
  }
  const failure = { code: '42501', message: 'Permission denied' };
  const queries = queryModule({ products: { data: [product] }, product_alternative_suppliers: { error: failure } });
  await assert.rejects(queries.fetchProducts, error => error === failure);
});

test('product save uses one atomic RPC, never sends market data, and keeps the primary supplier', async () => {
  const queries = queryModule({});
  await queries.saveProductDetails({ ...product, alternative_supplier_ids: ['socofram', 'epsilon', 'socofram'] }, product.id);
  assert.equal(queries.calls.length, 1);
  assert.equal(queries.calls[0].rpc, 'save_product_details');
  assert.deepEqual(queries.calls[0].args.p_alternative_supplier_ids, ['socofram']);
  assert.equal(queries.calls[0].args.p_details.supplier_id, 'epsilon');
  assert.equal(Object.hasOwn(queries.calls[0].args.p_details, 'product_markets'), false);
});

test('omitted alternatives preserve links, while an empty selection removes them', async () => {
  const queries = queryModule({});
  await queries.saveProductDetails(product, product.id);
  await queries.saveProductDetails({ ...product, alternative_supplier_ids: [] }, product.id);
  assert.equal(queries.calls[0].args.p_alternative_supplier_ids, null);
  assert.deepEqual(queries.calls[1].args.p_alternative_supplier_ids, []);
});

test('failed saves propagate and missing migrations produce a French deployment message', async () => {
  const migration = queryModule({}, { code: 'PGRST202' });
  await assert.rejects(() => migration.saveProductDetails(product), /mise à jour de la base de données/);
  const error = { code: '23503' };
  const invalid = queryModule({}, error);
  await assert.rejects(() => invalid.saveProductDetails(product), result => result === error);
});
