import { transaction } from '../core/storage.js';
import { text, numeric, quantity, requireThat } from '../utils/validators.js';
import { uid, normalize } from '../utils/helpers.js';
import { applyMovement } from './inventoryService.js';
export const UNITS = ['un', 'kg', 'l', 'cx', 'pct'];
export function validateProduct(input, data, id) {
  const p = { name: text(input.name, 'Nome', 'name'), sku: text(input.sku, 'SKU', 'sku', 40).toUpperCase(), description: text(input.description || '', 'Descrição', 'description', 500, true), categoryId: input.categoryId, supplierId: input.supplierId || '', unit: input.unit, cost: numeric(input.cost, 'Preço de custo', 'cost', 2), price: numeric(input.price, 'Preço de venda', 'price', 2) };
  requireThat(UNITS.includes(p.unit), 'Selecione uma unidade válida.', 'unit');
  requireThat(data.categories.some(c => c.id === p.categoryId), 'Selecione uma categoria.', 'categoryId');
  requireThat(!p.supplierId || data.suppliers.some(s => s.id === p.supplierId), 'Selecione um fornecedor válido.', 'supplierId');
  requireThat(!data.products.some(item => item.id !== id && normalize(item.sku) === normalize(p.sku)), 'Já existe um produto com este SKU, inclusive nos arquivados.', 'sku');
  p.min = quantity(input.min, p.unit, 'min'); p.max = quantity(input.max, p.unit, 'max');
  requireThat(p.max > 0 && p.max >= p.min, 'O máximo deve ser maior que zero e igual ou superior ao mínimo.', 'max');
  return p;
}
export function saveProduct(input, id = null) {
  return transaction(data => {
    const fields = validateProduct(input, data, id);
    if (id) {
      const p = data.products.find(p => p.id === id); requireThat(p && !p.archived, 'Produto não encontrado ou arquivado.');
      requireThat(fields.unit === p.unit, 'A unidade não pode mudar após o cadastro, para preservar o histórico.', 'unit');
      Object.assign(p, fields, { updatedAt: new Date().toISOString() }); return p;
    }
    const p = { ...fields, id: uid(), quantity: 0, archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    data.products.push(p); applyMovement(data, p, 'adjustment', input.quantity, 'Saldo inicial do cadastro', { initial: true }); return p;
  });
}
export function archiveProduct(id, archived = true) {
  return transaction(data => {
    const p = data.products.find(p => p.id === id); requireThat(p, 'Produto não encontrado.');
    if (archived) {
      requireThat(p.quantity === 0, 'Zere o saldo com uma saída ou ajuste antes de arquivar este produto.');
      requireThat(!data.purchases.some(row => row.productId === id && row.quantity > row.received), 'Remova este produto da lista de compras antes de arquivá-lo.');
    }
    p.archived = archived;
  });
}
export function saveEntity(kind, name, id = null) {
  return transaction(data => {
    requireThat(['categories', 'suppliers'].includes(kind), 'Cadastro inválido.');
    const value = text(name, 'Nome', 'name', 80);
    requireThat(!data[kind].some(row => row.id !== id && normalize(row.name) === normalize(value)), 'Este nome já está cadastrado.', 'name');
    if (id) { const row = data[kind].find(row => row.id === id); requireThat(row, 'Registro não encontrado.'); row.name = value; }
    else data[kind].push({ id: uid(), name: value });
  });
}
export function removeEntity(kind, id) {
  return transaction(data => {
    requireThat(['categories', 'suppliers'].includes(kind), 'Cadastro inválido.');
    const key = kind === 'categories' ? 'categoryId' : 'supplierId';
    requireThat(!data.products.some(p => p[key] === id), 'Este registro está vinculado a um produto. Edite o produto antes de remover.');
    data[kind] = data[kind].filter(row => row.id !== id);
  });
}
