import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { transaction, STORES, closeDatabase } from '../js/core/storage.js';
import { saveProduct, archiveProduct, saveEntity, removeEntity } from '../js/services/productService.js';
import { recordMovement, addPurchase, receivePurchase, removePurchase } from '../js/services/inventoryService.js';
import { exportBackup, importBackup, validateBackup, demoData, saveMarket } from '../js/services/backupService.js';
import { report, summary, periodMovements } from '../js/services/reportService.js';
import { csv } from '../js/utils/helpers.js';
import { status } from '../js/utils/formatters.js';
const base = { name: 'Arroz', sku: 'ARR-001', categoryId: 'c', supplierId: 's', unit: 'un', cost: 2.5, price: 4, min: 3, max: 20, quantity: 8, description: '' };
beforeEach(async () => {
  await transaction(data => { STORES.forEach(s => { data[s] = []; }); data.categories.push({ id: 'c', name: 'Alimentos' }); data.suppliers.push({ id: 's', name: 'Fornecedor' }); });
});
test('Cadastro, atualização e SKU único preservam histórico e saldo', async () => {
  const p = await saveProduct(base);
  let data = await transaction(); assert.equal(data.products[0].quantity, 8); assert.equal(data.movements[0].before, 0); assert.equal(data.movements[0].after, 8);
  const historical = structuredClone(data.movements);
  await saveProduct({ ...base, name: 'Arroz integral', quantity: 999, cost: 3 }, p.id);
  data = await transaction(); assert.equal(data.products[0].name, 'Arroz integral'); assert.equal(data.products[0].quantity, 8); assert.deepEqual(data.movements, historical);
  await assert.rejects(saveProduct({ ...base, sku: 'arr-001' }), /SKU/);
  await assert.rejects(saveProduct({ ...base, unit: 'kg' }, p.id), /unidade/);
});
test('Limites, preço, categorias e precisão são validados', async () => {
  for (const invalid of [{ quantity: -1 }, { quantity: 1.2 }, { min: 10, max: 2 }, { cost: 1.999 }, { cost: '' }, { categoryId: 'missing' }, { supplierId: 'missing' }, { name: ' ' }]) await assert.rejects(saveProduct({ ...base, ...invalid }));
  const data = await transaction(); assert.equal(data.products.length, 0); assert.equal(data.movements.length, 0);
});
test('Entrada, saída e ajuste possuem saldos coerentes e nenhuma saída negativa é salva', async () => {
  const p = await saveProduct(base);
  await recordMovement({ productId: p.id, type: 'entry', quantity: 4, reason: 'Entrega' });
  await recordMovement({ productId: p.id, type: 'exit', quantity: 10, reason: 'Venda' });
  let data = await transaction(); assert.equal(data.products[0].quantity, 2); assert.equal(status(data.products[0]), 'low');
  const previous = JSON.stringify(data);
  await assert.rejects(recordMovement({ productId: p.id, type: 'exit', quantity: 3, reason: 'Venda' }), /suficiente/);
  assert.equal(JSON.stringify(await transaction()), previous);
  await recordMovement({ productId: p.id, type: 'adjustment', quantity: 0, reason: 'Contagem física' });
  data = await transaction(); assert.equal(status(data.products[0]), 'empty'); const last = data.movements.sort((a, b) => b.seq - a.seq)[0]; assert.equal(last.quantity, -2); assert.equal(last.before, 2); assert.equal(last.after, 0);
  validateBackup(await exportBackup());
});
test('Transações concorrentes serializam saídas e evitam saldo negativo', async () => {
  const p = await saveProduct({ ...base, quantity: 10 });
  const results = await Promise.allSettled([recordMovement({ productId: p.id, type: 'exit', quantity: 7, reason: 'Venda A' }), recordMovement({ productId: p.id, type: 'exit', quantity: 7, reason: 'Venda B' })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); const data = await transaction(); assert.equal(data.products[0].quantity, 3); assert.equal(data.movements.length, 2);
});
test('Quilogramas e litros aceitam frações sem erro acumulado no saldo', async () => {
  const p = await saveProduct({ ...base, unit: 'kg', quantity: .3 });
  await recordMovement({ productId: p.id, type: 'exit', quantity: .1, reason: 'Venda fracionada' });
  assert.equal((await transaction()).products[0].quantity, .2);
  await assert.rejects(recordMovement({ productId: p.id, type: 'entry', quantity: .0001, reason: 'Inválida' }));
});
test('Lista de compras recebe parcialmente e atualiza estoque e histórico atomicamente', async () => {
  const p = await saveProduct(base); const purchase = await addPurchase(p.id, 12);
  await receivePurchase(purchase.id, 5); let data = await transaction(); assert.equal(data.products[0].quantity, 13); assert.equal(data.purchases[0].received, 5); assert.equal(data.movements.length, 2);
  const previous = JSON.stringify(data); await assert.rejects(receivePurchase(purchase.id, 8)); assert.equal(JSON.stringify(await transaction()), previous);
  await addPurchase(p.id, 3); data = await transaction(); assert.equal(data.purchases.length, 1); assert.equal(data.purchases[0].quantity, 8); assert.equal(data.purchases[0].received, 5);
  await receivePurchase(purchase.id, 3); data = await transaction(); assert.equal(data.products[0].quantity, 16); assert.equal(data.purchases[0].received, data.purchases[0].quantity);
  await assert.rejects(receivePurchase(purchase.id, 1)); validateBackup(await exportBackup());
});
test('Arquivamento e restauração preservam registros e respeitam compras pendentes', async () => {
  const p = await saveProduct(base); await assert.rejects(archiveProduct(p.id), /Zere/);
  await recordMovement({ productId: p.id, type: 'adjustment', quantity: 0, reason: 'Baixa' });
  const purchase = await addPurchase(p.id, 5); await assert.rejects(archiveProduct(p.id), /lista/); await removePurchase(purchase.id);
  await archiveProduct(p.id); assert.equal(summary(await transaction()).total, 0);
  await assert.rejects(recordMovement({ productId: p.id, type: 'entry', quantity: 1, reason: 'Inválido' }));
  await archiveProduct(p.id, false); assert.equal(summary(await transaction()).total, 1); assert.equal((await transaction()).movements.length, 2);
});
test('Cadastros de categorias e fornecedores impedem remoção de referências', async () => {
  await saveProduct(base); await assert.rejects(removeEntity('categories', 'c')); await assert.rejects(removeEntity('suppliers', 's'));
  await saveEntity('categories', 'Higiene'); let data = await transaction(); const hygiene = data.categories.find(c => c.name === 'Higiene');
  await saveEntity('categories', 'Cuidados', hygiene.id); await assert.rejects(saveEntity('categories', 'cuidados'));
  await removeEntity('categories', hygiene.id); assert.equal((await transaction()).categories.length, 1);
});
test('Backup exportado restaura todos os dados; importações inválidas não substituem nada', async () => {
  const p = await saveProduct(base); await addPurchase(p.id, 4); await saveMarket('Mercado do teste');
  const backup = await exportBackup(); await importBackup(demoData()); await importBackup(backup); assert.deepEqual(await transaction(), backup.data);
  const bad = structuredClone(backup); bad.data.products[0].quantity = 100;
  await assert.rejects(importBackup(bad), /saldo/); assert.deepEqual(await transaction(), backup.data);
  const broken = structuredClone(backup); broken.data.movements[0].before = 4; await assert.rejects(importBackup(broken), /histórico/);
  const duplicate = structuredClone(backup); duplicate.data.products.push(duplicate.data.products[0]); await assert.rejects(importBackup(duplicate), /duplicado/);
});
test('Demonstração é coerente, indicadores usam dados reais e relatórios excluem ajustes', async () => {
  const demo = demoData(); validateBackup(demo); await importBackup(demo);
  const data = await transaction(); const s = summary(data); assert.equal(s.total, 12); assert.ok(s.empty >= 2); assert.ok(s.low >= 2); assert.ok(s.excess >= 2);
  assert.equal(s.value, data.products.reduce((sum, p) => sum + p.quantity * p.cost, 0));
  const r = report(data, 7); assert.equal(r.activity.reduce((s, p) => s + p.count, 0), 14); assert.equal(r.entries, 40); assert.equal(r.exits, 100);
  assert.equal(periodMovements(data, 7).filter(m => m.type === 'adjustment').length, 0);
});
test('CSV trata aspas, separadores, quebras de linha e fórmulas', () => {
  const output = csv([['Nome', 'Quantidade'], ['=SUM(A1)', 2], ['Café; "Especial"\n500g', 1]]);
  assert.ok(output.startsWith('\uFEFF')); assert.ok(output.includes('"\'=SUM(A1)"')); assert.ok(output.includes('"Café; ""Especial""\n500g"'));
});
test('Fechar e reabrir a conexão mantém produtos, histórico, compras e preferências', async () => {
  const p = await saveProduct(base); await addPurchase(p.id, 4); await saveMarket('Mercado persistente');
  const before = await transaction(); closeDatabase(); const after = await transaction(); assert.deepEqual(after, before);
});
