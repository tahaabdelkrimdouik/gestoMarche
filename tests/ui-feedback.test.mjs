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


const { validateProduct, productSaveError } = loadTS('lib/productValidation.ts');
const product = { name: 'Tomates', code: 'TOM001', category_id: 'legumes', supplier_id: null };

test('blank and whitespace product codes are rejected before any database request', async () => {
  for (const code of ['', '   ', '\t']) {
    const queries = queryModule({});
    await assert.rejects(() => queries.saveProductDetails({ ...product, code }));
    assert.equal(queries.calls.length, 0);
    assert.equal(validateProduct({ ...product, code }).code, 'Le code produit est obligatoire.');
  }
  assert.deepEqual(validateProduct(product), {});
  assert.ok(validateProduct({ ...product, name: ' ' }).name);
  assert.ok(validateProduct({ ...product, category_id: '' }).category_id);
});

test('product saves trim names and codes, and omit hidden prices to preserve existing values', async () => {
  const queries = queryModule({});
  await queries.saveProductDetails({ ...product, name: ' Tomates ', code: ' TOM001 ' }, 'existing');
  const details = queries.calls[0].args.p_details;
  assert.equal(details.name, 'Tomates');
  assert.equal(details.code, 'TOM001');
  assert.equal(Object.hasOwn(details, 'purchase_price'), false);
  assert.equal(Object.hasOwn(details, 'sale_price'), false);
});

test('raw backend messages are never displayed as product validation errors', () => {
  for (const error of [new Error('SQL private information'), { code: '42501', message: 'SQL details' }, null]) {
    assert.equal(productSaveError(error), 'Enregistrement impossible. Vérifiez votre connexion et réessayez.');
  }
  assert.match(productSaveError({ code: '23505' }), /code produit est déjà utilisé/);
});

test('failed stock relationships reject instead of showing products as available', async () => {
  const failure = { code: '42501', message: 'Permission denied' };
  const queries = queryModule({ products: { data: [{ ...product, id: 'tomates' }] }, product_markets: { error: failure } });
  await assert.rejects(queries.fetchProducts, error => error === failure);
});

test('failed order items reject instead of showing empty orders', async () => {
  const failure = { code: '42501', message: 'Permission denied' };
  const queries = queryModule({ orders: { data: [{ id: 'order', client_name: 'Client', created_at: '' }] }, order_items: { error: failure } });
  await assert.rejects(queries.fetchOrders, error => error === failure);
});
