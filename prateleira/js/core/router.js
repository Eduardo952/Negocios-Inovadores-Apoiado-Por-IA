import { updateSidebar } from '../components/sidebar.js';
export function route() { const [page, query = ''] = location.hash.slice(1).split('?'); return { page: page || 'dashboard', params: new URLSearchParams(query) }; }
export function startRouter(onRoute) {
  const run = () => { const current = route(); updateSidebar(current.page); onRoute(current, true); };
  window.addEventListener('hashchange', run); run();
}
