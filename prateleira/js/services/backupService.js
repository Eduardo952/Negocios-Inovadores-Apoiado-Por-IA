import { transaction, STORES } from '../core/storage.js';
import { requireThat, text, numeric, quantity } from '../utils/validators.js';
import { validateProduct } from './productService.js';
import { round, normalize } from '../utils/helpers.js';
import { applyMovement } from './inventoryService.js';
export function validateBackup(input) {
  requireThat(input?.version === 1 && input.data && typeof input.data === 'object', 'Este arquivo não é um backup compatível do Prateleira.');
  const data = structuredClone(input.data);
  for (const store of STORES) {
    requireThat(Array.isArray(data[store]) && data[store].length <= 100000, `A seção ${store} está inválida ou excede o limite.`);
    const ids = new Set();
    for (const row of data[store]) {
      requireThat(row && typeof row.id === 'string' && row.id.length > 0 && row.id.length <= 100 && !ids.has(row.id), `Identificador inválido ou duplicado em ${store}.`); ids.add(row.id);
    }
  }
  for (const kind of ['categories', 'suppliers']) {
    const names = new Set();
    for (const row of data[kind]) { row.name = text(row.name, 'Nome', 'name', 80); requireThat(!names.has(normalize(row.name)), 'Existem categorias ou fornecedores duplicados.'); names.add(normalize(row.name)); }
  }
  const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  for (const p of data.products) {
    Object.assign(p, validateProduct(p, data, p.id)); quantity(p.quantity, p.unit);
    requireThat(typeof p.archived === 'boolean' && (!p.archived || p.quantity === 0), 'Produto arquivado com saldo ou estado inválido.');
    requireThat(validDate(p.createdAt) && validDate(p.updatedAt), 'Datas de produto inválidas.');
  }
  const balances = new Map(data.products.map(p => [p.id, 0])); const sequence = new Set();
  for (const m of [...data.movements].sort((a, b) => a.seq - b.seq)) {
    const p = data.products.find(p => p.id === m.productId);
    requireThat(p && ['entry', 'exit', 'adjustment'].includes(m.type), 'Movimentação vinculada a um produto ou tipo inválido.');
    requireThat(Number.isSafeInteger(m.seq) && m.seq > 0 && !sequence.has(m.seq), 'Sequência de movimentações inválida.'); sequence.add(m.seq);
    requireThat(validDate(m.date) && m.unit === p.unit, 'Data ou unidade da movimentação inválida.');
    text(m.productName, 'Produto', '', 120); text(m.sku, 'SKU', '', 40); text(m.reason, 'Motivo', '', 240); numeric(m.cost, 'Custo', '', 2);
    quantity(m.before, p.unit); quantity(m.after, p.unit); quantity(Math.abs(m.quantity), p.unit);
    requireThat(typeof m.quantity === 'number' && Number.isFinite(m.quantity) && (m.type === 'adjustment' || m.quantity > 0), 'Quantidade de movimentação inválida.');
    const delta = m.type === 'exit' ? -m.quantity : m.quantity;
    requireThat(m.before === balances.get(p.id) && round(m.before + delta) === m.after, 'O histórico possui saldos inconsistentes. A importação foi cancelada.');
    balances.set(p.id, m.after);
  }
  for (const p of data.products) requireThat(balances.get(p.id) === p.quantity, 'O saldo de um produto não corresponde ao histórico.');
  const pending = new Set();
  for (const row of data.purchases) {
    const p = data.products.find(p => p.id === row.productId); requireThat(p, 'Compra vinculada a produto inexistente.');
    quantity(row.quantity, p.unit); quantity(row.received, p.unit);
    requireThat(row.quantity > 0 && row.received <= row.quantity && validDate(row.createdAt), 'Quantidade ou data de compra inválida.');
    if (row.received < row.quantity) { requireThat(!p.archived && !pending.has(p.id), 'Compra duplicada ou vinculada a produto arquivado.'); pending.add(p.id); }
  }
  requireThat(data.settings.length <= 1 && (!data.settings.length || data.settings[0].id === 'market'), 'Configurações inválidas.');
  if (data.settings.length) data.settings[0].name = text(data.settings[0].name, 'Nome do mercado', 'name', 80);
  return data;
}
export async function exportBackup() { return { application: 'Prateleira', version: 1, exportedAt: new Date().toISOString(), data: await transaction() }; }
export async function importBackup(input) {
  const validated = validateBackup(input);
  return transaction(data => { for (const store of STORES) data[store] = validated[store]; });
}
export function saveMarket(name) { return transaction(data => { data.settings = [{ id: 'market', name: text(name, 'Nome do mercado', 'name', 80) }]; }); }
export function demoData() {
  const data = Object.fromEntries(STORES.map(s => [s, []]));
  data.categories = [{ id: 'c1', name: 'Mercearia' }, { id: 'c2', name: 'Bebidas' }, { id: 'c3', name: 'Limpeza' }, { id: 'c4', name: 'Hortifruti' }, { id: 'c5', name: 'Laticínios' }];
  data.suppliers = [{ id: 's1', name: 'Distribuidora Horizonte' }, { id: 's2', name: 'Cooperativa da Serra' }];
  data.settings = [{ id: 'market', name: 'Mercado da Vila' }];
  const dateAgo = days => { const d = new Date(); d.setDate(d.getDate() - days); d.setHours(9, 0, 0, 0); return d.toISOString(); };
  const seeds = [
    ['Arroz branco', 'ARR-001', 'c1', 'pct', 18.9, 24.9, 12, 60, 35],
    ['Feijão carioca', 'FEI-002', 'c1', 'pct', 6.4, 8.9, 15, 50, 18],
    ['Café torrado 500 g', 'CAF-003', 'c1', 'pct', 16.5, 22.9, 10, 40, 9],
    ['Leite integral 1 L', 'LEI-004', 'c5', 'un', 4.2, 5.79, 24, 96, 16],
    ['Óleo de soja 900 ml', 'OLE-005', 'c1', 'un', 5.9, 8.49, 12, 48, 15],
    ['Água mineral 500 ml', 'AGU-006', 'c2', 'un', 1.15, 2.5, 24, 120, 151],
    ['Detergente neutro', 'DET-007', 'c3', 'un', 1.8, 2.99, 12, 48, 78],
    ['Banana prata', 'BAN-008', 'c4', 'kg', 3.5, 6.99, 5, 25, 16],
    ['Açúcar cristal 1 kg', 'ACU-009', 'c1', 'pct', 3.1, 4.79, 10, 40, 36],
    ['Macarrão espaguete', 'MAC-010', 'c1', 'pct', 2.9, 4.49, 10, 36, 25],
    ['Sabão em pó 1 kg', 'SAB-011', 'c3', 'un', 8.2, 12.9, 8, 30, 42],
    ['Queijo minas', 'QUE-012', 'c5', 'kg', 25, 39.9, 3, 12, 6.5]
  ];
  seeds.forEach((s, index) => {
    const [name, sku, categoryId, unit, cost, price, min, max, initial] = s;
    const p = { id: `p${index + 1}`, name, sku, categoryId, unit, cost, price, min, max, supplierId: categoryId === 'c4' || categoryId === 'c5' ? 's2' : 's1', description: 'Produto do conjunto demonstrativo.', quantity: 0, archived: false, createdAt: dateAgo(45), updatedAt: dateAgo(45) };
    data.products.push(p); applyMovement(data, p, 'adjustment', initial, 'Saldo inicial demonstrativo', { initial: true, date: dateAgo(45) });
  });
  const events = [[6, 0, 'exit', 8], [6, 8, 'exit', 6], [5, 1, 'exit', 12], [5, 4, 'exit', 15], [4, 0, 'entry', 20], [4, 7, 'exit', 4.5], [3, 2, 'exit', 9], [3, 5, 'exit', 10], [2, 3, 'exit', 10], [2, 9, 'entry', 12], [1, 0, 'exit', 15], [1, 8, 'entry', 8], [0, 11, 'exit', 2.5], [0, 9, 'exit', 8]];
  for (const [days, index, type, qty] of events) applyMovement(data, data.products[index], type, qty, type === 'entry' ? 'Entrega do fornecedor · demonstração' : 'Venda no balcão · demonstração', { date: days === 0 ? new Date().toISOString() : dateAgo(days) });
  return { application: 'Prateleira', version: 1, exportedAt: new Date().toISOString(), data };
}
