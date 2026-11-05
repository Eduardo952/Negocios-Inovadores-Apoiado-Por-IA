import { refresh, subscribe, snapshot } from './core/state.js';
import { startRouter, route } from './core/router.js';
import { initSidebar } from './components/sidebar.js';
import { handleAction } from './components/forms.js';
import { toast } from './components/toast.js';
import { escapeHTML as e } from './utils/helpers.js';
import * as dashboard from './pages/dashboard.js';
import * as products from './pages/products.js';
import * as inventory from './pages/inventory.js';
import * as movements from './pages/movements.js';
import * as replenishment from './pages/replenishment.js';
import * as reports from './pages/reports.js';
import * as settings from './pages/settings.js';
const pages = { dashboard, products, inventory, movements, replenishment, reports, settings };
const root = document.querySelector('#content');
settings.applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (settings.getTheme() === 'system') settings.applyTheme(); });
initSidebar();
function render(current = route(), fresh = false) {
  const page = pages[current.page];
  if (!page) { location.hash = 'dashboard'; return; }
  const focused = document.activeElement; const focusedId = root.contains(focused) ? focused.id : null;
  const selection = focused && ['text', 'search'].includes(focused.type) ? [focused.selectionStart, focused.selectionEnd] : null;
  root.innerHTML = page.render(snapshot, current.params, fresh);
  page.mount?.(root, snapshot);
  if (fresh) {
    root.classList.remove('page-enter'); void root.offsetWidth; root.classList.add('page-enter');
    window.scrollTo({ top: 0, behavior: 'instant' });
    root.focus({ preventScroll: true });
  } else if (focusedId) { const next = document.getElementById(focusedId); next?.focus({ preventScroll: true }); if (selection && next?.setSelectionRange) next.setSelectionRange(...selection); }
  const name = snapshot.settings[0]?.name || 'Meu mercado';
  document.querySelector('#market-name').textContent = name;
  document.querySelector('.store-avatar').textContent = [...name][0].toUpperCase();
  document.querySelector('.breadcrumb').firstChild.textContent = `${name} `;
  const count = snapshot.purchases.filter(r => r.quantity > r.received).length;
  const badge = document.querySelector('#purchase-count'); badge.textContent = count; badge.hidden = !count;
}
document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]'); if (!target || target.disabled) return;
  Promise.resolve(handleAction(target.dataset.action, target.dataset.id, target)).catch(error => toast(error.message, 'error'));
});
try {
  await refresh();
  subscribe(() => render());
  startRouter(render);
} catch (error) {
  root.innerHTML = `<section class="fatal-error"><h1>Não conseguimos abrir seu estoque.</h1><p>${e(error.message)}</p><p>Os dados existentes não foram substituídos. Verifique se o navegador permite armazenamento local e tente novamente.</p><button class="button primary" id="retry">Tentar novamente</button></section>`;
  document.querySelector('#retry').onclick = () => location.reload();
}
