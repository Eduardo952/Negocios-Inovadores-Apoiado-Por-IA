import { icon } from './icons.js';
import { escapeHTML as e } from '../utils/helpers.js';
export function toast(message, type = 'success') {
  const node = document.createElement('div'); node.className = `toast toast-${type}`;
  node.innerHTML = `${icon(type === 'success' ? 'check' : 'alert')}<span>${e(message)}</span><button class="icon-button" aria-label="Fechar notificação">${icon('close')}</button>`;
  const close = () => { node.classList.add('leaving'); setTimeout(() => node.remove(), 200); };
  node.querySelector('button').onclick = close;
  $('#toasts')?.append(node);
  setTimeout(close, type === 'error' ? 9000 : 5000);
}
const $ = selector => document.querySelector(selector);
