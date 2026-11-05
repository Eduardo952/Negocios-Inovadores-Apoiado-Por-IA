import { escapeHTML as e } from '../utils/helpers.js';
import { icon } from './icons.js';
import { status, statusLabels, typeLabels, number } from '../utils/formatters.js';
export function badge(product) { const s = status(product); return `<span class="badge ${s}"><span class="badge-dot"></span>${statusLabels[s]}</span>`; }
export function movementBadge(type) { return `<span class="movement-type ${type}">${icon(type === 'entry' ? 'down' : type === 'exit' ? 'up' : 'arrows')}${typeLabels[type]}</span>`; }
export const productName = p => `<span class="product-name"><span class="product-tile" aria-hidden="true">${icon('box')}</span><span><strong>${e(p.name)}</strong><small>${e(p.sku)}</small></span></span>`;
export const empty = (title, description, action = '') => `<div class="empty-state">${icon('shelf')}<h3>${e(title)}</h3><p>${e(description)}</p>${action}</div>`;
export function table(headers, rows, label = 'Registros') { return `<div class="table-scroll" role="region" aria-label="${e(label)}" tabindex="0"><table><thead><tr>${headers.map(h => `<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`; }
export function pagination(total, page, size = 10) {
  const pages = Math.max(1, Math.ceil(total / size));
  return `<div class="pagination"><span>${total ? (page - 1) * size + 1 : 0}–${Math.min(page * size, total)} de ${number(total)} registros</span><div><button class="button small secondary" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Anterior</button><span>${page} / ${pages}</span><button class="button small secondary" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Próxima</button></div></div>`;
}
