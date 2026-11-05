import { icon } from './icons.js';
import { escapeHTML as e } from '../utils/helpers.js';
let opener; let closing = false; let closeCallback;
export function closeModal() {
  const dialog = document.querySelector('#modal'); if (!dialog.open || closing) return;
  closing = true; dialog.classList.add('closing');
  setTimeout(() => { dialog.close(); dialog.classList.remove('closing'); closing = false; document.body.classList.remove('modal-open'); if (opener?.isConnected) opener.focus(); else document.querySelector('#content').focus({ preventScroll: true }); closeCallback?.(); closeCallback = null; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 170);
}
export function openModal(title, body, { wide = false, onClose } = {}) {
  const dialog = document.querySelector('#modal');
  if (!dialog.open) opener = document.activeElement;
  closing = false; dialog.className = wide ? 'wide' : '';
  dialog.innerHTML = `<header class="modal-header"><div><span class="eyebrow">PRATELEIRA / MEU MERCADO</span><h2 id="modal-title">${e(title)}</h2></div><button class="icon-button" data-close aria-label="Fechar janela">${icon('close')}</button></header>${body}`;
  dialog.querySelector('[data-close]').onclick = closeModal;
  dialog.oncancel = event => { event.preventDefault(); closeModal(); };
  dialog.onclick = event => { if (event.target.closest('[data-cancel]')) closeModal(); };
  closeCallback = onClose;
  document.body.classList.add('modal-open'); if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => (dialog.querySelector('[autofocus]') || dialog.querySelector('input,select,textarea') || dialog.querySelector('button')).focus());
  return dialog;
}
export function confirmAction(title, message, callback, label = 'Confirmar') {
  const dialog = openModal(title, `<p class="modal-description">${e(message)}</p><p class="form-error" role="alert"></p><div class="modal-actions"><button class="button secondary" data-cancel>Cancelar</button><button class="button primary" id="confirm-action">${e(label)}</button></div>`);
  dialog.querySelector('#confirm-action').onclick = async event => {
    const button = event.currentTarget; button.disabled = true; button.classList.add('busy');
    try { await callback(); closeModal(); } catch (error) { dialog.querySelector('.form-error').textContent = error.message; } finally { button.disabled = false; button.classList.remove('busy'); }
  };
}
export function bindForm(dialog, submit) {
  const form = dialog.querySelector('form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    form.querySelectorAll('.field-error,.form-error').forEach(n => n.textContent = '');
    form.querySelectorAll('[aria-invalid]').forEach(n => n.removeAttribute('aria-invalid'));
    const button = form.querySelector('[type=submit]'); button.disabled = true; button.classList.add('busy');
    try { await submit(Object.fromEntries(new FormData(form))); closeModal(); }
    catch (error) {
      const field = error.field && form.elements.namedItem(error.field);
      if (field) { field.setAttribute('aria-invalid', 'true'); const hint = field.closest('.field')?.querySelector('.field-error'); if (hint) hint.textContent = error.message; field.focus(); }
      form.querySelector('.form-error').textContent = error.message;
    } finally { button.disabled = false; button.classList.remove('busy'); }
  });
}
