import { snapshot, commit } from '../core/state.js';
import { openModal, bindForm, confirmAction } from './modal.js';
import { toast } from './toast.js';
import { icon } from './icons.js';
import { badge, table, movementBadge, empty } from './table.js';
import { escapeHTML as e } from '../utils/helpers.js';
import { money, number, dateTime } from '../utils/formatters.js';
import { saveProduct, archiveProduct, UNITS, saveEntity, removeEntity } from '../services/productService.js';
import { recordMovement, addPurchase, receivePurchase, removePurchase } from '../services/inventoryService.js';
export function field(name, label, value = '', { type = 'text', required = true, options, hint = '', attrs = '', full = false } = {}) {
  const control = options ? `<select id="f-${name}" name="${name}" ${required ? 'required' : ''} ${attrs}>${options.map(o => `<option value="${e(o.value)}" ${String(value) === String(o.value) ? 'selected' : ''}>${e(o.label)}</option>`).join('')}</select>` : type === 'textarea' ? `<textarea id="f-${name}" name="${name}" rows="3" maxlength="500" ${attrs}>${e(value)}</textarea>` : `<input id="f-${name}" name="${name}" type="${type}" value="${e(value)}" ${required ? 'required' : ''} ${attrs}>`;
  return `<div class="field ${full ? 'full' : ''}"><label for="f-${name}">${e(label)}${!required ? ' <span>(opcional)</span>' : ''}</label>${control.replace(/<(input|select|textarea) /, `<$1 aria-describedby="error-${name}${hint ? ` hint-${name}` : ''}" `)}${hint ? `<small id="hint-${name}">${e(hint)}</small>` : ''}<span class="field-error" id="error-${name}"></span></div>`;
}
export const formEnd = (label = 'Salvar alterações') => `<p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="button secondary" data-cancel>Cancelar</button><button type="submit" class="button primary">${e(label)}</button></div></form>`;
export function productForm(id) {
  const p = snapshot.products.find(p => p.id === id);
  if (id && !p) { toast('Produto não encontrado.', 'error'); return; }
  if (!snapshot.categories.length) {
    confirmAction('Vamos organizar as categorias?', 'Cadastre ao menos uma categoria em Configurações antes de adicionar o primeiro produto.', () => { location.hash = 'settings'; }, 'Ir para configurações'); return;
  }
  const values = p || { name: '', sku: '', categoryId: '', supplierId: '', description: '', unit: 'un', cost: '', price: '', min: '', max: '', quantity: 0 };
  const moneyAttrs = 'min="0" max="1000000000" step="0.01" inputmode="decimal"';
  const qtyAttrs = 'min="0" max="1000000000" step="0.001" inputmode="decimal"';
  const body = `<form class="modal-form"><div class="form-section-title">01 <span>Identificação</span></div><div class="form-grid">${field('name', 'Nome do produto', values.name, { full: true, attrs: 'maxlength="120" autofocus' })}${field('sku', 'SKU / código interno', values.sku, { attrs: 'maxlength="40"' })}${field('categoryId', 'Categoria', values.categoryId, { options: [{ value: '', label: 'Selecione…' }, ...snapshot.categories.map(c => ({ value: c.id, label: c.name }))] })}${field('supplierId', 'Fornecedor', values.supplierId, { required: false, options: [{ value: '', label: 'Não informado' }, ...snapshot.suppliers.map(s => ({ value: s.id, label: s.name }))] })}${field('unit', 'Unidade de medida', values.unit, { options: UNITS.map(u => ({ value: u, label: ({ un: 'Unidade (un)', kg: 'Quilograma (kg)', l: 'Litro (l)', cx: 'Caixa (cx)', pct: 'Pacote (pct)' })[u] })), attrs: p ? 'disabled' : '', hint: p ? 'A unidade é preservada pelo histórico.' : 'Unidades, caixas e pacotes usam números inteiros.' })}${p ? `<input type="hidden" name="unit" value="${e(p.unit)}">` : ''}${field('description', 'Descrição', values.description, { type: 'textarea', required: false, full: true })}</div><div class="form-section-title">02 <span>Valores e limites</span></div><div class="form-grid">${field('cost', 'Preço de custo (R$)', values.cost, { type: 'number', attrs: moneyAttrs })}${field('price', 'Preço de venda (R$)', values.price, { type: 'number', attrs: moneyAttrs })}${field('min', 'Estoque mínimo', values.min, { type: 'number', attrs: qtyAttrs })}${field('max', 'Estoque máximo desejado', values.max, { type: 'number', attrs: qtyAttrs })}${!p ? field('quantity', 'Quantidade inicial', 0, { type: 'number', attrs: qtyAttrs, full: true, hint: 'O saldo inicial gera um registro no histórico.' }) : `<p class="inline-note full">Saldo atual: <strong>${number(p.quantity)} ${e(p.unit)}</strong>. Para alterar quantidades, registre uma movimentação.</p>`}</div>${formEnd(p ? 'Salvar alterações' : 'Cadastrar produto')}`;
  const dialog = openModal(p ? 'Editar produto' : 'Um novo lugar na prateleira', body, { wide: true });
  bindForm(dialog, async input => { await commit(() => saveProduct(input, id)); toast(p ? 'Os dados do produto foram atualizados.' : 'Produto adicionado ao estoque.'); });
}
export function movementForm(id, initialType = 'entry') {
  const products = snapshot.products.filter(p => !p.archived);
  if (!products.length) { toast('Cadastre um produto antes de movimentar o estoque.', 'attention'); return; }
  const selected = products.find(p => p.id === id) || products[0];
  const dialog = openModal('Registrar movimentação', `<form class="modal-form"><p class="modal-description">Cada movimento deixa um registro. O saldo é atualizado ao confirmar.</p><div class="form-grid">${field('productId', 'Produto', selected.id, { options: products.map(p => ({ value: p.id, label: `${p.name} · ${p.sku}` })), full: true })}${field('type', 'Tipo de movimentação', initialType, { options: [{ value: 'entry', label: '↓ Entrada' }, { value: 'exit', label: '↑ Saída' }, { value: 'adjustment', label: '↔ Ajuste de saldo' }] })}${field('quantity', 'Quantidade', '', { type: 'number', attrs: 'min="0" step="0.001" max="1000000000" autofocus' })}<div class="balance-preview full" id="balance-preview"></div>${field('reason', 'Motivo', '', { full: true, attrs: 'maxlength="240" placeholder="Ex.: entrega do fornecedor, venda, perda…"' })}</div>${formEnd('Confirmar movimentação')}`);
  const form = dialog.querySelector('form');
  const preview = () => {
    const p = products.find(p => p.id === form.elements.productId.value); const type = form.elements.type.value; const value = Number(form.elements.quantity.value);
    const next = type === 'adjustment' ? value : p.quantity + (type === 'exit' ? -value : value);
    dialog.querySelector('label[for=f-quantity]').textContent = type === 'adjustment' ? 'Novo saldo contado' : 'Quantidade movimentada';
    form.elements.quantity.step = ['kg', 'l'].includes(p.unit) ? '.001' : '1';
    dialog.querySelector('#balance-preview').innerHTML = `<span>Saldo atual <strong>${number(p.quantity)} ${e(p.unit)}</strong></span>${icon('arrow')}<span>Após a operação <strong class="${next < 0 ? 'text-critical' : ''}">${number(next)} ${e(p.unit)}</strong></span>`;
  };
  form.addEventListener('input', preview); form.addEventListener('change', preview); preview();
  bindForm(dialog, async input => { await commit(() => recordMovement(input)); toast(input.type === 'entry' ? `Entrada de ${number(input.quantity)} registrada.` : input.type === 'exit' ? `Saída de ${number(input.quantity)} registrada.` : 'Saldo ajustado. Histórico preservado.'); });
}
export function productDetails(id) {
  const p = snapshot.products.find(p => p.id === id); if (!p) return;
  const category = snapshot.categories.find(c => c.id === p.categoryId)?.name || '—';
  const supplier = snapshot.suppliers.find(s => s.id === p.supplierId)?.name || 'Não informado';
  const movements = snapshot.movements.filter(m => m.productId === id).sort((a, b) => b.seq - a.seq).slice(0, 6);
  const dialog = openModal(p.name, `<div class="details-heading"><span class="mono">${e(p.sku)}</span>${p.archived ? '<span class="badge">Arquivado</span>' : badge(p)}</div><div class="details-stock"><strong>${number(p.quantity)} <small>${e(p.unit)}</small></strong><span>disponíveis no estoque</span></div><dl class="detail-grid"><div><dt>Categoria</dt><dd>${e(category)}</dd></div><div><dt>Fornecedor</dt><dd>${e(supplier)}</dd></div><div><dt>Custo / venda</dt><dd>${money(p.cost)} / ${money(p.price)}</dd></div><div><dt>Mínimo / máximo</dt><dd>${number(p.min)} / ${number(p.max)} ${e(p.unit)}</dd></div></dl>${p.description ? `<p class="product-description">${e(p.description)}</p>` : ''}<div class="section-heading"><h3>Últimos movimentos</h3><a class="text-button" href="#movements?product=${encodeURIComponent(id)}" id="all-history">Ver histórico ${icon('arrow')}</a></div>${movements.length ? table(['Tipo', 'Quantidade', 'Saldo', 'Data'], movements.map(m => `<tr><td>${movementBadge(m.type)}</td><td>${number(m.quantity)} ${e(m.unit)}</td><td>${number(m.after)}</td><td>${dateTime(m.date)}</td></tr>`)) : empty('Sem movimentações', 'Os próximos registros aparecerão aqui.')}<div class="modal-actions wrap">${p.archived ? `<button class="button primary" data-action="restore" data-id="${e(id)}">Restaurar produto</button>` : `<button class="button quiet" data-action="archive" data-id="${e(id)}">${icon('archive')}Arquivar</button><button class="button secondary" data-action="edit" data-id="${e(id)}">Editar</button><button class="button primary" data-action="move" data-id="${e(id)}">${icon('arrows')}Movimentar</button>`}</div>`, { wide: true });
  dialog.querySelector('#all-history').onclick = async () => { const { closeModal } = await import('./modal.js'); closeModal(); };
}
export function purchaseForm(id) {
  const p = snapshot.products.find(p => p.id === id); if (!p) return;
  const row = snapshot.purchases.find(row => row.productId === id && row.received < row.quantity);
  const suggested = row ? row.quantity - row.received : Math.max(0, p.max - p.quantity);
  const dialog = openModal(row ? 'Ajustar lista de compras' : 'Adicionar à lista de compras', `<form class="modal-form"><p class="modal-description"><strong>${e(p.name)}</strong><br>Saldo: ${number(p.quantity)} ${e(p.unit)} · Máximo desejado: ${number(p.max)} ${e(p.unit)}</p>${field('quantity', 'Quantidade a comprar', suggested, { type: 'number', attrs: `min="0.001" max="1000000000" step="${['kg', 'l'].includes(p.unit) ? '.001' : '1'}" autofocus`, hint: 'Define a quantidade ainda pendente, sem alterar recebimentos anteriores.' })}<p class="inline-note">Custo unitário atual: ${money(p.cost)}.</p>${formEnd(row ? 'Atualizar lista' : 'Adicionar à lista')}`);
  bindForm(dialog, async input => { await commit(() => addPurchase(id, input.quantity)); toast(row ? 'Quantidade da lista atualizada.' : 'Produto adicionado à lista de compras.'); });
}
export function receiveForm(id) {
  const row = snapshot.purchases.find(p => p.id === id); if (!row) return;
  const p = snapshot.products.find(p => p.id === row.productId); const pending = row.quantity - row.received;
  const dialog = openModal('Receber mercadoria', `<form class="modal-form"><p class="modal-description"><strong>${e(p.name)}</strong><br>Faltam ${number(pending)} ${e(p.unit)} para concluir esta compra.</p>${field('quantity', 'Quantidade recebida', pending, { type: 'number', attrs: `min="0.001" max="${pending}" step="${['kg', 'l'].includes(p.unit) ? '.001' : '1'}" autofocus` })}<p class="inline-note">Você pode receber parte da compra. A entrada e o saldo da lista serão salvos juntos.</p>${formEnd('Confirmar recebimento')}`);
  bindForm(dialog, async input => { await commit(() => receivePurchase(id, input.quantity)); toast('Recebimento registrado. Estoque atualizado.'); });
}
export function entityForm(kind, id) {
  const row = snapshot[kind].find(r => r.id === id); const label = kind === 'categories' ? 'categoria' : 'fornecedor';
  const dialog = openModal(`${row ? 'Editar' : 'Adicionar'} ${label}`, `<form class="modal-form">${field('name', 'Nome', row?.name || '', { attrs: 'maxlength="80" autofocus' })}${formEnd(row ? 'Salvar alterações' : 'Adicionar')}`);
  bindForm(dialog, async input => { await commit(() => saveEntity(kind, input.name, id)); toast('Cadastro salvo.'); });
}
export async function handleAction(action, id, target) {
  if (action === 'new-product') return productForm();
  if (action === 'edit') return productForm(id);
  if (action === 'details') return productDetails(id);
  if (action === 'move') return movementForm(id, target.dataset.type || 'entry');
  if (action === 'purchase') return purchaseForm(id);
  if (action === 'receive') return receiveForm(id);
  if (action === 'archive' || action === 'restore') return confirmAction(action === 'archive' ? 'Arquivar produto?' : 'Restaurar produto?', action === 'archive' ? 'O produto sairá das listas ativas. Seu histórico será preservado. Só é possível arquivar produtos sem saldo e sem compras pendentes.' : 'O produto voltará a aparecer no estoque ativo.', async () => { await commit(() => archiveProduct(id, action === 'archive')); toast(action === 'archive' ? 'Produto arquivado. Histórico preservado.' : 'Produto restaurado.'); }, action === 'archive' ? 'Arquivar' : 'Restaurar');
  if (action === 'remove-purchase') return confirmAction('Remover da lista?', 'A quantidade ainda pendente será removida. Recebimentos já registrados permanecerão no histórico.', async () => { await commit(() => removePurchase(id)); toast('Item removido da lista.'); }, 'Remover');
  if (action === 'entity') return entityForm(target.dataset.kind, id);
  if (action === 'remove-entity') return confirmAction('Remover cadastro?', 'O registro só será removido se não estiver vinculado a nenhum produto, inclusive arquivados.', async () => { await commit(() => removeEntity(target.dataset.kind, id)); toast('Cadastro removido.'); }, 'Remover');
}
