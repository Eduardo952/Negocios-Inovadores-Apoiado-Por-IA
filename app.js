'use strict';

// No dependencies or requests: all personal data stays in this browser.
const STORAGE_KEY = 'cronus.v1';
const DURATIONS = { focus: 25 * 60, break: 5 * 60 };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const initialState = () => ({ profile: null, tasks: [], study: {}, sessions: {}, messages: [], timer: { mode: 'focus', remaining: DURATIONS.focus, running: false, endAt: null, accountedAt: null } });
let state = initialState();
let storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && typeof saved === 'object') {
    if (saved.profile && typeof saved.profile.name === 'string') state.profile = { name: saved.profile.name.slice(0, 40), brand: String(saved.profile.brand || 'CRONUS').slice(0, 24), focus: Array.isArray(saved.profile.focus) ? saved.profile.focus.filter(v => typeof v === 'string') : [] };
    state.tasks = Array.isArray(saved.tasks) ? saved.tasks.filter(t => t && typeof t.id === 'string' && typeof t.title === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date)).map(t => ({ ...t, done: !!t.done })) : [];
    for (const key of ['study', 'sessions']) {
      if (saved[key] && typeof saved[key] === 'object') state[key] = Object.fromEntries(Object.entries(saved[key]).filter(([date, n]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(n) && n >= 0));
    }
    state.messages = Array.isArray(saved.messages) ? saved.messages.filter(m => m && typeof m.name === 'string' && typeof m.text === 'string').slice(-30) : [];
    const t = saved.timer;
    if (t && Object.hasOwn(DURATIONS, t.mode) && Number.isFinite(t.remaining) && t.remaining >= 0 && t.remaining <= DURATIONS[t.mode]) {
      state.timer = { ...t, running: !!t.running && Number.isFinite(t.endAt) && Number.isFinite(t.accountedAt) };
    }
  }
} catch { storageAvailable = false; }

let toastTimeout;
function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 4500);
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { if (storageAvailable) notify('Não foi possível salvar. Seus dados durarão apenas nesta sessão.'); storageAvailable = false; }
}
function uid() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

// Split credited focus time at local midnight, including a session resumed after reload.
function creditStudy(start, end) {
  while (start < end) {
    const date = new Date(start);
    const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    const until = Math.min(end, midnight);
    const key = dayKey(date);
    state.study[key] = (state.study[key] || 0) + (until - start) / 1000;
    start = until;
  }
}
function syncTimer() {
  const t = state.timer;
  if (!t.running) return;
  const now = Date.now();
  const end = Math.min(now, t.endAt);
  if (t.mode === 'focus' && end > t.accountedAt) creditStudy(t.accountedAt, end);
  t.accountedAt = Math.max(t.accountedAt, end);
  t.remaining = Math.max(0, Math.min(DURATIONS[t.mode], (t.endAt - now) / 1000));
  if (t.remaining === 0) {
    if (t.mode === 'focus') {
      const date = dayKey(new Date(t.endAt));
      state.sessions[date] = (state.sessions[date] || 0) + 1;
      notify('Foco concluído! Respire e faça uma pausa de 5 minutos.');
    } else notify('Pausa concluída. Pronto para o próximo passo?');
    t.running = false;
    t.endAt = null;
    t.accountedAt = null;
  }
  save();
  renderTimer();
  renderStats();
}
function renderTimer() {
  const t = state.timer;
  const seconds = Math.ceil(t.remaining);
  $('#timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('#clock-progress').style.strokeDashoffset = String(797.965 * (1 - t.remaining / DURATIONS[t.mode]));
  $('#toggle-timer').textContent = t.running ? 'Ⅱ  Pausar' : `${t.remaining === 0 ? '↻' : '▶'}  ${t.remaining === 0 ? 'Nova sessão' : t.remaining < DURATIONS[t.mode] ? 'Continuar' : t.mode === 'focus' ? 'Iniciar foco' : 'Iniciar pausa'}`;
  $('#timer-state').textContent = t.remaining === 0 ? 'Sessão concluída. Muito bem.' : t.running ? (t.mode === 'focus' ? 'Só você e o próximo passo.' : 'Respire. Você merece.') : t.remaining < DURATIONS[t.mode] ? 'No seu ritmo. Sem pressa.' : 'Pronto quando você estiver.';
  $('#timer-caption').textContent = t.mode === 'focus' ? 'UM PASSO DE CADA VEZ' : 'DESCANSAR TAMBÉM FAZ PARTE';
  $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === t.mode)));
}
$('#toggle-timer').addEventListener('click', () => {
  const wasRunning = state.timer.running;
  syncTimer();
  const t = state.timer;
  if (wasRunning) { t.running = false; t.endAt = null; t.accountedAt = null; }
  else {
    if (t.remaining === 0) t.remaining = DURATIONS[t.mode];
    t.running = true;
    t.accountedAt = Date.now();
    t.endAt = t.accountedAt + t.remaining * 1000;
  }
  save(); renderTimer();
});
function resetTimer(mode = state.timer.mode) {
  syncTimer();
  state.timer = { mode, remaining: DURATIONS[mode], running: false, endAt: null, accountedAt: null };
  save(); renderTimer();
}
$('#reset-timer').addEventListener('click', () => resetTimer());
$$('[data-mode]').forEach(button => button.addEventListener('click', () => { if (state.timer.mode !== button.dataset.mode) resetTimer(button.dataset.mode); }));

let taskFilter = 'all';
function renderTasks() {
  const today = dayKey();
  const tasks = state.tasks.filter(t => taskFilter === 'all' || (taskFilter === 'done' ? t.done : !t.done)).sort((a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date));
  const list = $('#task-list');
  list.replaceChildren();
  $('#task-count').textContent = state.tasks.filter(t => !t.done).length;
  if (!tasks.length) {
    const empty = document.createElement('li'); empty.className = 'empty';
    const title = document.createElement('strong'); title.textContent = taskFilter === 'done' ? 'Cada conquista começa com um passo.' : taskFilter === 'pending' && state.tasks.length ? 'Tudo em dia. Aproveite a conquista!' : 'Abra espaço para o que importa.';
    empty.append(title, document.createTextNode('Adicione uma tarefa e comece no seu ritmo.')); list.append(empty);
  }
  tasks.forEach(task => {
    const row = document.createElement('li'); row.className = `task-item${task.done ? ' done' : ''}`;
    const label = document.createElement('label');
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.done;
    const content = document.createElement('span');
    const title = document.createElement('span'); title.className = 'task-text'; title.textContent = task.title;
    const meta = document.createElement('span'); meta.className = 'task-meta';
    const dateLabel = new Date(`${task.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    meta.textContent = task.done ? `Concluída · prazo ${dateLabel}` : `${task.date === today ? 'Hoje' : task.date < today ? 'Prazo vencido' : 'Planejada'} · ${dateLabel}`;
    content.append(title, meta); label.append(checkbox, content);
    checkbox.addEventListener('change', () => { task.done = checkbox.checked; save(); renderTasks(); renderStats(); });
    const remove = document.createElement('button'); remove.className = 'delete-task'; remove.textContent = '×'; remove.setAttribute('aria-label', `Excluir ${task.title}`);
    remove.addEventListener('click', () => { state.tasks = state.tasks.filter(t => t.id !== task.id); save(); renderTasks(); renderStats(); });
    row.append(label, remove); list.append(row);
  });
  const done = state.tasks.filter(t => t.done).length;
  $('#task-summary').textContent = state.tasks.length ? `${done} de ${state.tasks.length} passos concluídos. Você está construindo algo.` : 'Seu planejamento começa com uma tarefa.';
}
$('#task-date').value = dayKey();
$('#task-form').addEventListener('submit', event => {
  event.preventDefault();
  const title = $('#task-title').value.trim();
  if (!title) { $('#task-title').setCustomValidity('Escreva o nome da tarefa.'); $('#task-title').reportValidity(); return; }
  state.tasks.push({ id: uid(), title, date: $('#task-date').value, done: false });
  $('#task-title').value = ''; taskFilter = 'all'; updateFilters(); save(); renderTasks(); renderStats(); $('#task-title').focus();
});
$('#task-title').addEventListener('input', () => $('#task-title').setCustomValidity(''));
$('#focus-task').addEventListener('click', () => $('#task-title').focus());
function updateFilters() { $$('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === taskFilter))); }
$$('[data-filter]').forEach(b => b.addEventListener('click', () => { taskFilter = b.dataset.filter; updateFilters(); renderTasks(); }));

function renderStats() {
  const seconds = Object.values(state.study).reduce((sum, n) => sum + n, 0);
  $('#study-hours').textContent = (seconds / 3600).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  $('#study-hours').title = `${Math.floor(seconds / 60)} minutos de foco`;
  const studied = date => (state.study[dayKey(date)] || 0) >= 60;
  let streak = 0;
  const cursor = new Date();
  if (!studied(cursor)) cursor.setDate(cursor.getDate() - 1);
  while (studied(cursor)) { streak++; cursor.setDate(cursor.getDate() - 1); }
  $('#streak').textContent = streak;
  $('#streak').title = 'Um dia conta a partir de 1 minuto de foco.';
  const dots = $('#week-dots'); dots.replaceChildren();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(); date.setDate(date.getDate() - i);
    const dot = document.createElement('span'); dot.textContent = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][date.getDay()];
    const description = `${date.toLocaleDateString('pt-BR')}: ${studied(date) ? 'estudou' : 'sem estudo registrado'}`;
    dot.title = description; dot.setAttribute('aria-label', description); if (studied(date)) dot.className = 'studied'; dots.append(dot);
  }
  const done = state.tasks.filter(t => t.done).length;
  const percent = state.tasks.length ? Math.round(done / state.tasks.length * 100) : 0;
  $('#completion').replaceChildren(document.createTextNode(String(percent)));
  const symbol = document.createElement('span'); symbol.textContent = '%'; $('#completion').append(symbol);
  $('#completion-bar').value = percent;
  $('#completion-detail').textContent = `${done} de ${state.tasks.length} tarefas`;
  const sessions = state.sessions[dayKey()] || 0;
  $('#session-count').textContent = `${sessions} ${sessions === 1 ? 'sessão hoje' : 'sessões hoje'}`;
}

function renderProfile() {
  if (!state.profile) return;
  const { name, brand, focus } = state.profile;
  $('#greeting').textContent = `Olá, ${name}!`;
  $('#avatar').textContent = [...name][0].toLocaleUpperCase('pt-BR');
  $$('[data-brand]').forEach(el => { el.textContent = brand; });
  document.title = `${brand} — seu espaço de estudos`;
  $('#today-label').textContent = `${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).toLocaleUpperCase('pt-BR')}${focus.length ? ` / ${focus.join(' + ').toLocaleUpperCase('pt-BR')}` : ''}`;
}
function openProfile() {
  $('#user-name').value = state.profile?.name || '';
  $('#app-name').value = state.profile?.brand || 'CRONUS';
  $$('[data-focus]').forEach(b => b.setAttribute('aria-pressed', String(state.profile?.focus.includes(b.dataset.focus) || false)));
  $('#onboarding').showModal();
}
$('#edit-profile').addEventListener('click', openProfile);
$('#onboarding').addEventListener('cancel', event => { if (!state.profile) event.preventDefault(); });
$$('[data-focus]').forEach(b => b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));
$('#profile-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('#user-name').value.trim(); const brand = $('#app-name').value.trim();
  if (!name || !brand) { const input = !name ? $('#user-name') : $('#app-name'); input.setCustomValidity('Preencha este campo com um nome.'); input.reportValidity(); return; }
  state.profile = { name, brand, focus: $$('[data-focus][aria-pressed="true"]').map(b => b.dataset.focus) };
  save(); renderProfile(); $('#onboarding').close(); notify('Seu espaço está pronto. Vamos dar o primeiro passo.');
});
['#user-name', '#app-name'].forEach(s => $(s).addEventListener('input', () => $(s).setCustomValidity('')));

const demoMessages = [
  { name: 'Ana Costa', text: 'Um capítulo de cada vez. Começando minha sessão de leitura agora.', time: 'Exemplo' },
  { name: 'João Lima', text: 'Terminei aquela lista de exercícios. Pequenas vitórias também contam!', time: 'Exemplo' }
];
function renderMessages() {
  const list = $('#messages'); list.replaceChildren();
  [...demoMessages, ...state.messages].forEach(message => {
    const row = document.createElement('li'); row.className = 'message';
    const avatar = document.createElement('span'); avatar.className = 'message-avatar'; avatar.setAttribute('aria-hidden', 'true'); avatar.textContent = message.name.split(/\s+/).map(n => [...n][0]).slice(0, 2).join('').toUpperCase();
    const body = document.createElement('div'); body.className = 'message-body';
    const name = document.createElement('strong'); name.textContent = message.name;
    const time = document.createElement('small'); time.textContent = message.time || 'Você · local';
    const text = document.createElement('p'); text.textContent = message.text;
    body.append(name, time, text); row.append(avatar, body); list.append(row);
  });
  list.scrollTop = list.scrollHeight;
}
$('#message-form').addEventListener('submit', event => {
  event.preventDefault(); const text = $('#message').value.trim(); if (!text) return;
  state.messages.push({ name: state.profile?.name || 'Você', text, time: 'Você · local' }); state.messages = state.messages.slice(-30);
  save(); renderMessages(); $('#message').value = '';
});

renderProfile(); renderTasks(); renderTimer(); renderStats(); renderMessages(); syncTimer();
if (!state.profile) openProfile();
if (!storageAvailable) notify('Armazenamento indisponível ou dados inválidos. Você pode usar esta sessão normalmente.');
setInterval(syncTimer, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { syncTimer(); renderProfile(); renderStats(); renderTasks(); } });
window.addEventListener('pagehide', syncTimer);
// Apply changes from other tabs without reload/save loops.
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try {
    const incoming = JSON.parse(event.newValue);
    if (!incoming.timer || !Array.isArray(incoming.tasks) || !Array.isArray(incoming.messages) || !incoming.study || !incoming.sessions) return;
    state = incoming;
    renderProfile(); renderTimer(); renderTasks(); renderStats(); renderMessages();
  } catch { /* Ignore externally corrupted storage events. */ }
});
