import { transaction } from '../core/storage.js';
import { requireThat, quantity, text } from '../utils/validators.js';
import { uid, round } from '../utils/helpers.js';
export function applyMovement(data, product, type, amount, reason, options = {}) {
  requireThat(product && !product.archived, 'Produto indisponível para movimentação.', 'productId');
  requireThat(['entry', 'exit', 'adjustment'].includes(type), 'Selecione o tipo de movimentação.', 'type');
  const value = quantity(amount, product.unit);
  requireThat(type === 'adjustment' || value > 0, 'Informe uma quantidade maior que zero.', 'quantity');
  const before = product.quantity;
  const after = round(type === 'adjustment' ? value : type === 'entry' ? before + value : before - value);
  requireThat(after >= 0, `Não há quantidade suficiente para essa saída. Saldo disponível: ${before} ${product.unit}.`, 'quantity');
  requireThat(after <= 1e9, 'O saldo ultrapassa o limite permitido.', 'quantity');
  requireThat(after !== before || options.initial, 'O novo saldo já é igual ao saldo atual.', 'quantity');
  const movement = { id: uid(), productId: product.id, productName: product.name, sku: product.sku, unit: product.unit, type, quantity: type === 'adjustment' ? round(after - before) : value, before, after, cost: product.cost, date: options.date || new Date().toISOString(), reason: text(reason, 'Motivo', 'reason', 240), seq: data.movements.reduce((max, m) => Math.max(max, m.seq), 0) + 1 };
  data.movements.push(movement); product.quantity = after; product.updatedAt = movement.date;
  return movement;
}
export function recordMovement(input) {
  return transaction(data => applyMovement(data, data.products.find(p => p.id === input.productId), input.type, input.quantity, input.reason));
}
export function addPurchase(productId, amount) {
  return transaction(data => {
    const p = data.products.find(p => p.id === productId && !p.archived);
    requireThat(p, 'Produto não encontrado.');
    const qty = quantity(amount, p.unit); requireThat(qty > 0, 'Informe uma quantidade maior que zero.', 'quantity');
    const existing = data.purchases.find(row => row.productId === productId && row.received < row.quantity);
    if (existing) { requireThat(existing.received + qty <= 1e9, 'A quantidade total da compra ultrapassa o limite permitido.', 'quantity'); existing.quantity = round(existing.received + qty); return existing; }
    const row = { id: uid(), productId, quantity: qty, received: 0, createdAt: new Date().toISOString() }; data.purchases.push(row); return row;
  });
}
export function removePurchase(id) {
  return transaction(data => { const row = data.purchases.find(p => p.id === id); requireThat(row, 'Item não encontrado.'); if (row.received > 0) row.quantity = row.received; else data.purchases = data.purchases.filter(p => p.id !== id); });
}
export function receivePurchase(id, amount) {
  return transaction(data => {
    const row = data.purchases.find(p => p.id === id); requireThat(row, 'Item não encontrado.');
    const product = data.products.find(p => p.id === row.productId);
    requireThat(product, 'Produto não encontrado.');
    const qty = quantity(amount, product.unit);
    requireThat(qty > 0 && qty <= round(row.quantity - row.received), 'Informe uma quantidade entre zero e o saldo pendente da compra.', 'quantity');
    applyMovement(data, product, 'entry', qty, 'Recebimento da lista de compras');
    row.received = round(row.received + qty);
  });
}
