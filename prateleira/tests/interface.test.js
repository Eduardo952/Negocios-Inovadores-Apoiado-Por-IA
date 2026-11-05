import 'fake-indexeddb/auto';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transaction } from '../js/core/storage.js';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:8080/', pretendToBeVisual: true });
for (const name of ['window', 'document', 'location', 'localStorage', 'FormData', 'HTMLElement']) globalThis[name] = dom.window[name];
globalThis.matchMedia = dom.window.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.BroadcastChannel = class { addEventListener() {} postMessage() {} };
dom.window.scrollTo = () => {};
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
const downloads = [];
globalThis.URL.createObjectURL = blob => { downloads.push(blob); return 'blob:test'; };
globalThis.URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = function () {};
const $ = s => document.querySelector(s);
const waitFor = async (predicate, message = 'Condition timed out') => { for (let i = 0; i < 100; i++) { if (await predicate()) return; await new Promise(r => setTimeout(r, 20)); } throw new Error(message); };
const input = (selector, value) => { const el = $(selector); assert.ok(el, selector); el.value = value; el.dispatchEvent(new dom.window.Event(el.tagName === 'SELECT' || el.type === 'date' ? 'change' : 'input', { bubbles: true })); };
const submit = () => $('#modal form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
const close = async () => { if ($('#modal').open) { $('#modal [data-close]').click(); await waitFor(() => !$('#modal').open); } };
const go = async (hash, selector) => { location.hash = hash; await waitFor(() => document.querySelector('[data-nav][aria-current="page"]')?.dataset.nav === hash.split('?')[0] && $(selector)); };
test('Fluxos reais da interface com DOM e IndexedDB de teste', async t => {
  await import('../js/app.js');
  await t.test('Estado vazio e carga demonstrativa exigem confirmação', async () => {
    assert.match($('#content').textContent, /Um bom começo/);
    await go('settings', '#load-demo'); $('#load-demo').click(); assert.ok($('#modal').open); assert.equal((await transaction()).products.length, 0);
    $('#confirm-action').click(); await waitFor(() => !$('#modal').open); assert.equal((await transaction()).products.length, 12); assert.equal($('#market-name').textContent, 'Mercado da Vila');
  });
  await t.test('Busca sem acento, categoria, situação e paginação', async () => {
    await go('products', '#product-search'); assert.equal(document.querySelectorAll('#product-results tbody tr').length, 10);
    $('#product-results [data-page="2"]').click(); assert.equal(document.querySelectorAll('#product-results tbody tr').length, 2);
    input('#product-search', 'cafe'); assert.equal(document.querySelectorAll('#product-results tbody tr').length, 1); assert.match($('#product-results').textContent, /Café/);
    input('#product-search', ''); input('#status-filter', 'empty'); assert.equal(document.querySelectorAll('#product-results tbody tr').length, 2);
    input('#category-filter', 'c5'); assert.match($('#product-results').textContent, /Nenhum produto/);
    input('#status-filter', ''); input('#category-filter', '');
  });
  let id;
  await t.test('Cadastro pelo modal é seguro e reflete imediatamente na tabela', async () => {
    $('[data-action="new-product"]').click();
    input('#f-name', '<img src=x onerror=alert(1)> Teste'); input('#f-sku', 'TEST-001'); input('#f-categoryId', 'c1'); input('#f-cost', '2.50'); input('#f-price', '4'); input('#f-min', '3'); input('#f-max', '20'); input('#f-quantity', '4');
    submit(); await waitFor(() => !$('#modal').open);
    const data = await transaction(); id = data.products.find(p => p.sku === 'TEST-001').id; assert.ok(id);
    input('#product-search', 'TEST-001'); assert.equal(document.querySelectorAll('#product-results tbody tr').length, 1); assert.equal($('#product-results img'), null); assert.match($('#product-results').textContent, /<img src=x/);
  });
  await t.test('Edição mantém saldo, valida SKU e preserva os campos com erro', async () => {
    $(`[data-action="edit"][data-id="${id}"]`).click(); input('#f-name', 'Produto de teste'); input('#f-sku', 'ARR-001'); submit();
    await waitFor(() => $('#modal .form-error').textContent.length > 0); assert.ok($('#modal').open); assert.equal($('#f-name').value, 'Produto de teste'); assert.equal($('#f-sku').getAttribute('aria-invalid'), 'true');
    input('#f-sku', 'TEST-001'); submit(); await waitFor(() => !$('#modal').open); assert.equal((await transaction()).products.find(p => p.id === id).quantity, 4);
  });
  await t.test('Saída inválida preserva formulário; saída válida atualiza estoque e reposição', async () => {
    await go('inventory', '#product-search'); input('#product-search', 'TEST-001');
    $(`[data-action="move"][data-id="${id}"][data-type="exit"]`).click(); input('#f-quantity', '5'); input('#f-reason', 'Venda de teste'); submit();
    await waitFor(() => $('#modal .form-error').textContent.includes('suficiente')); assert.equal($('#f-quantity').value, '5'); assert.equal((await transaction()).products.find(p => p.id === id).quantity, 4);
    input('#f-quantity', '4'); submit(); await waitFor(() => !$('#modal').open); assert.match($('#product-results').textContent, /Esgotado/);
    await go('replenishment', '#purchase-product'); assert.ok($(`[data-action="purchase"][data-id="${id}"]`));
  });
  let purchaseId;
  await t.test('Compra e recebimento parcial alteram lista, indicador e estoque juntos', async () => {
    $(`[data-action="purchase"][data-id="${id}"]`).click(); input('#f-quantity', '10'); submit(); await waitFor(() => !$('#modal').open);
    assert.equal($('#purchase-count').textContent, '1'); assert.match($('.shopping-items').textContent, /Produto de teste/);
    purchaseId = (await transaction()).purchases.find(p => p.productId === id).id;
    $(`[data-action="receive"][data-id="${purchaseId}"]`).click(); input('#f-quantity', '3'); submit(); await waitFor(() => !$('#modal').open);
    assert.equal((await transaction()).products.find(p => p.id === id).quantity, 3); assert.match($('.shopping-items').textContent, /3 un já recebidos/);
  });
  await t.test('Arquivar exige saldo zero e nenhuma compra pendente; restauração funciona', async () => {
    await go('inventory', '#product-search'); input('#product-search', 'TEST-001');
    $(`[data-action="move"][data-id="${id}"][data-type="adjustment"]`).click(); input('#f-quantity', '0'); input('#f-reason', 'Baixa de teste'); submit(); await waitFor(() => !$('#modal').open);
    await go('replenishment', '#purchase-product'); $(`[data-action="remove-purchase"][data-id="${purchaseId}"]`).click(); $('#confirm-action').click(); await waitFor(() => !$('#modal').open); assert.equal($('#purchase-count').hidden, true);
    await go('products', '#product-search'); input('#product-search', 'TEST-001'); $(`[data-action="details"][data-id="${id}"]`).click(); $('#modal [data-action="archive"]').click(); $('#confirm-action').click(); await waitFor(() => !$('#modal').open);
    assert.match($('#product-results').textContent, /Nenhum produto/); $('#archived-filter').click(); assert.ok($('[data-action="restore"]')); $('[data-action="restore"]').click(); $('#confirm-action').click(); await waitFor(() => !$('#modal').open);
    assert.equal((await transaction()).products.find(p => p.id === id).archived, false);
  });
  await t.test('Histórico filtra produto, tipo e datas e exporta CSV', async () => {
    await go(`movements?product=${id}`, '#movement-product'); assert.equal($('#movement-product').value, id); assert.equal(document.querySelectorAll('#movement-results tbody tr').length, 4);
    input('#movement-type', 'exit'); assert.equal(document.querySelectorAll('#movement-results tbody tr').length, 1);
    const count = downloads.length; $('#export-movements').click(); assert.equal(downloads.length, count + 1); assert.match(await downloads.at(-1).text(), /Venda de teste/);
    input('#movement-from', '2099-01-01'); input('#movement-to', '2000-01-01'); assert.match($('#movement-results').textContent, /Revise o período/);
  });
  await t.test('Relatórios mudam período e exportam valores; tema e backup são funcionais', async () => {
    await go('reports', '#report-period'); input('#report-period', '7'); assert.match($('#report-content').textContent, /7 dias/); $('#export-report').click(); assert.match(await downloads.at(-1).text(), /Operações no período/);
    await go('settings', '#theme-select'); input('#theme-select', 'dark'); assert.equal(document.documentElement.dataset.theme, 'dark'); assert.equal(localStorage.getItem('prateleira-theme'), 'dark');
    $('#export-backup').click(); await waitFor(() => downloads.at(-1).type === 'application/json'); const backup = JSON.parse(await downloads.at(-1).text()); assert.equal(backup.data.products.length, 13);
    const fileInput = $('#backup-file'); Object.defineProperty(fileInput, 'files', { value: [{ size: 1000, text: async () => JSON.stringify(backup) }], configurable: true }); fileInput.dispatchEvent(new dom.window.Event('change'));
    await waitFor(() => $('#modal').open); assert.match($('#modal').textContent, /13 produtos/); $('#confirm-action').click(); await waitFor(() => !$('#modal').open); assert.equal((await transaction()).products.length, 13);
  });
  await close(); dom.window.close();
});
