import { icon } from './icons.js';
export const pages = [{ id: 'dashboard', name: 'Visão geral', icon: 'grid' }, { id: 'products', name: 'Produtos', icon: 'box' }, { id: 'inventory', name: 'Estoque', icon: 'shelf' }, { id: 'movements', name: 'Movimentações', icon: 'arrows' }, { id: 'replenishment', name: 'Reposição', icon: 'cart' }, { id: 'reports', name: 'Relatórios', icon: 'chart' }, { id: 'settings', name: 'Configurações', icon: 'settings' }];
export function initSidebar() {
  document.querySelector('#sidebar').innerHTML = `<a class="brand" href="#dashboard"><img src="assets/icons/mark.svg" alt="" width="36" height="36">prateleira<span>®</span></a><div class="sidebar-caption">GESTÃO DO DIA A DIA</div><nav aria-label="Páginas"><span class="nav-indicator"></span>${pages.map((p, i) => `<a href="#${p.id}" data-nav="${p.id}" style="--nav-index:${i}">${icon(p.icon)}<span>${p.name}</span>${p.id === 'replenishment' ? '<span id="purchase-count" class="nav-count" hidden>0</span>' : ''}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-note">${icon('leaf')}<strong>Mais cuidado.<br>Menos desperdício.</strong><p>Um estoque organizado faz o mercado crescer.</p></div><div class="local-info"><span class="local-dot"></span> Seu estoque, neste dispositivo</div></div>`;
  const toggle = document.querySelector('#menu-toggle'); const shade = document.querySelector('#menu-shade');
  const close = () => { document.body.classList.remove('menu-open'); toggle.setAttribute('aria-expanded', 'false'); shade.hidden = true; };
  toggle.onclick = () => { const open = document.body.classList.toggle('menu-open'); toggle.setAttribute('aria-expanded', String(open)); shade.hidden = !open; if (open) document.querySelector('#sidebar nav a').focus(); };
  shade.onclick = close; document.querySelector('#sidebar nav').addEventListener('click', close);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.body.classList.contains('menu-open')) { close(); toggle.focus(); } });
}
export function updateSidebar(page) {
  const index = Math.max(0, pages.findIndex(p => p.id === page));
  document.querySelector('.nav-indicator').style.transform = `translateY(${index * 48}px)`;
  document.querySelectorAll('[data-nav]').forEach(a => { if (a.dataset.nav === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.querySelector('#page-label').textContent = pages[index].name;
  document.title = `Prateleira — ${pages[index].name}`;
}
