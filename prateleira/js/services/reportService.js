import { status } from '../utils/formatters.js';
import { round, localDate } from '../utils/helpers.js';
export const activeProducts = data => data.products.filter(p => !p.archived);
export function summary(data) {
  const products = activeProducts(data);
  return { total: products.length, units: round(products.reduce((sum, p) => sum + p.quantity, 0)), value: products.reduce((sum, p) => sum + p.quantity * p.cost, 0), low: products.filter(p => status(p) === 'low').length, empty: products.filter(p => status(p) === 'empty').length, excess: products.filter(p => status(p) === 'excess').length };
}
export function periodMovements(data, days = 30, now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - Number(days) + 1);
  return data.movements.filter(m => new Date(m.date) >= start && new Date(m.date) <= now);
}
export function report(data, days = 30) {
  const movements = periodMovements(data, days);
  const entries = movements.filter(m => m.type === 'entry'); const exits = movements.filter(m => m.type === 'exit');
  const activity = activeProducts(data).map(p => {
    const rows = movements.filter(m => m.productId === p.id && m.type !== 'adjustment');
    const last = data.movements.filter(m => m.productId === p.id && m.type !== 'adjustment').sort((a, b) => b.seq - a.seq)[0];
    return { ...p, count: rows.length, volume: round(rows.reduce((sum, m) => sum + m.quantity, 0)), lastDate: last?.date || p.createdAt, neverMoved: !last };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
  return { movements, activity, entries: round(entries.reduce((s, m) => s + m.quantity, 0)), exits: round(exits.reduce((s, m) => s + m.quantity, 0)), entryValue: entries.reduce((s, m) => s + m.quantity * m.cost, 0), exitValue: exits.reduce((s, m) => s + m.quantity * m.cost, 0) };
}
export function chartData(data, days = 7) {
  const rows = periodMovements(data, days);
  const buckets = [];
  for (let i = Number(days) - 1; i >= 0; i--) {
    const day = new Date(); day.setHours(12, 0, 0, 0); day.setDate(day.getDate() - i);
    const key = localDate(day); const matching = rows.filter(m => localDate(m.date) === key);
    buckets.push({ label: day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), entry: matching.filter(m => m.type === 'entry').reduce((s, m) => s + m.quantity, 0), exit: matching.filter(m => m.type === 'exit').reduce((s, m) => s + m.quantity, 0) });
  }
  return buckets;
}
