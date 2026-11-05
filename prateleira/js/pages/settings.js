import { escapeHTML as e, download, localDate } from '../utils/helpers.js';
import { icon } from '../components/icons.js';
import { field } from '../components/forms.js';
import { commit } from '../core/state.js';
import { saveMarket, exportBackup, validateBackup, importBackup, demoData } from '../services/backupService.js';
import { confirmAction } from '../components/modal.js';
import { toast } from '../components/toast.js';
export function render(data) {
  const entity = (kind, title, description) => `<section class="panel settings-panel"><div class="section-heading"><div><h2>${title}</h2><p>${description}</p></div><button class="icon-button" data-action="entity" data-kind="${kind}" aria-label="Adicionar ${kind === 'categories' ? 'categoria' : 'fornecedor'}">${icon('plus')}</button></div><ul class="entity-list">${data[kind].map(row => `<li><span>${e(row.name)}</span><div><button class="icon-button" data-action="entity" data-kind="${kind}" data-id="${e(row.id)}" aria-label="Editar ${e(row.name)}">${icon('edit')}</button><button class="icon-button" data-action="remove-entity" data-kind="${kind}" data-id="${e(row.id)}" aria-label="Remover ${e(row.name)}">${icon('close')}</button></div></li>`).join('') || '<li class="muted">Nenhum cadastro ainda. Use o botão + para começar.</li>'}</ul></section>`;
  return `<section class="page-heading"><div><p class="eyebrow">DO SEU JEITO, COM TUDO NO LUGAR</p><h1>O espaço do seu mercado.</h1><p>Ajuste os cadastros, a aparência e os cuidados com seus dados.</p></div></section><div class="settings-grid"><section class="panel settings-panel"><div class="section-heading"><h2>Identidade e aparência</h2>${icon('shelf')}</div><form id="market-form">${field('name', 'Nome do mercado', data.settings[0]?.name || 'Meu mercado', { attrs: 'maxlength="80"' })}<p class="form-error" role="alert"></p><button class="button primary" type="submit">Salvar nome</button></form><div class="theme-control"><div><strong>Aparência</strong><p>Um ambiente confortável para a sua rotina.</p></div><label class="sr-only" for="theme-select">Tema da interface</label><select id="theme-select"><option value="light">Claro</option><option value="dark">Escuro</option><option value="system">Usar o sistema</option></select></div></section><section class="panel settings-panel data-settings"><div class="section-heading"><h2>Seus dados, sob cuidado</h2>${icon('archive')}</div><p>Os dados ficam no IndexedDB deste navegador. Exporte backups regularmente: limpar os dados do site ou trocar de dispositivo não transfere seu estoque.</p><div class="setting-action"><div><strong>Backup completo</strong><small>Produtos, histórico, compras e configurações em JSON.</small></div><button class="button secondary" id="export-backup">${icon('download')}Exportar</button></div><div class="setting-action"><div><strong>Restaurar um backup</strong><small>O arquivo será validado antes da confirmação.</small></div><button class="button secondary" id="import-backup">Importar</button><input class="sr-only" type="file" id="backup-file" accept=".json,application/json" tabindex="-1" aria-label="Arquivo de backup"></div><div class="setting-action"><div><strong>Conhecer com dados de exemplo</strong><small>12 produtos e um histórico de operações demonstrativas.</small></div><button class="button secondary" id="load-demo">Carregar exemplo</button></div></section>${entity('categories', 'Categorias', 'Uma organização que faz sentido para o seu mercado.')}${entity('suppliers', 'Fornecedores', 'Saiba com quem falar na próxima compra.')}</div><p class="data-note">Cadastros vinculados a produtos não podem ser removidos. Para preservar os registros, produtos são arquivados, nunca apagados do histórico.</p>`;
}
export function getTheme() { try { return localStorage.getItem('prateleira-theme') || 'light'; } catch { return 'light'; } }
export function applyTheme(value = getTheme()) { document.documentElement.dataset.theme = value === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value; }
export function mount(root) {
  const form = root.querySelector('#market-form');
  form.onsubmit = async event => {
    event.preventDefault(); const name = new FormData(form).get('name'); const button = form.querySelector('button'); button.disabled = true;
    try { await commit(() => saveMarket(name)); toast('Nome do mercado atualizado.'); } catch (error) { form.querySelector('.form-error').textContent = error.message; } finally { button.disabled = false; }
  };
  root.querySelector('#theme-select').value = getTheme();
  root.querySelector('#theme-select').onchange = event => { const value = event.target.value; applyTheme(value); try { localStorage.setItem('prateleira-theme', value); } catch { toast('Tema aplicado apenas nesta sessão.', 'attention'); } };
  root.querySelector('#export-backup').onclick = async () => { try { download(`prateleira-backup-${localDate()}.json`, JSON.stringify(await exportBackup(), null, 2)); toast('Backup preparado para download.'); } catch (error) { toast(error.message, 'error'); } };
  root.querySelector('#import-backup').onclick = () => root.querySelector('#backup-file').click();
  root.querySelector('#backup-file').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('O arquivo excede o limite de 20 MB.');
      const payload = JSON.parse(await file.text()); const validated = validateBackup(payload);
      confirmAction('Substituir pelos dados do backup?', `O arquivo contém ${validated.products.length} produtos e ${validated.movements.length} movimentações. Todos os dados atuais serão substituídos. Exporte um backup antes de continuar se quiser preservá-los.`, async () => { await commit(() => importBackup(payload)); toast('Backup restaurado. Dados conferidos e salvos.'); }, 'Restaurar backup');
    } catch (error) { toast(error instanceof SyntaxError ? 'O arquivo não contém um JSON válido.' : error.message, 'error'); }
    finally { event.target.value = ''; }
  };
  root.querySelector('#load-demo').onclick = () => confirmAction('Carregar o Mercado da Vila?', 'Os dados demonstrativos substituirão os dados atuais. Há produtos esgotados, abaixo do mínimo e em excesso. Exporte um backup antes de continuar se quiser preservar seu estoque.', async () => { await commit(() => importBackup(demoData())); toast('Mercado demonstrativo carregado. Explore à vontade.'); }, 'Carregar demonstração');
}
