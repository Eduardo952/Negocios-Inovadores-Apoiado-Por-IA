import { transaction } from './storage.js';
export let snapshot;
let listener = () => {};
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('prateleira-updates') : null;
export async function refresh() { snapshot = await transaction(); listener(snapshot); return snapshot; }
export function subscribe(callback) { listener = callback; }
export async function commit(action) { const result = await action(); await refresh(); channel?.postMessage('changed'); return result; }
channel?.addEventListener('message', () => refresh().catch(console.error));
