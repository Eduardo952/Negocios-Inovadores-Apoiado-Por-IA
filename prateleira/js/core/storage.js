const DB_NAME = 'prateleira-v1';
export const STORES = ['products', 'categories', 'suppliers', 'movements', 'purchases', 'settings'];
let database;
export function closeDatabase() { database?.close(); database = null; }
export function openDatabase() {
  if (database) return Promise.resolve(database);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => STORES.forEach(name => { if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' }); });
    request.onerror = () => reject(new Error('Não foi possível abrir o banco local. Verifique as permissões do navegador.'));
    request.onblocked = () => reject(new Error('Feche outras abas do Prateleira e tente novamente.'));
    request.onsuccess = () => { database = request.result; database.onversionchange = () => { database.close(); database = null; }; resolve(database); };
  });
}
// The callback is synchronous: IDB reads, business validation and related writes
// all happen in the same transaction. An exception aborts every related write.
export async function transaction(change = null) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, change ? 'readwrite' : 'readonly');
    const data = {}; let pending = STORES.length; let result; let failure;
    tx.oncomplete = () => resolve(change ? result : data);
    tx.onabort = () => reject(failure || new Error('Não foi possível salvar a operação. Nenhuma alteração foi aplicada.'));
    tx.onerror = () => { /* onabort handles the final error once. */ };
    STORES.forEach(name => {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => {
        data[name] = request.result;
        if (--pending || !change) return;
        try {
          const original = structuredClone(data);
          result = change(data);
          if (result instanceof Promise) throw new Error('Transações não aceitam callbacks assíncronos.');
          for (const store of STORES) {
            const oldRows = new Map(original[store].map(row => [row.id, JSON.stringify(row)]));
            for (const row of data[store]) {
              if (oldRows.get(row.id) !== JSON.stringify(row)) tx.objectStore(store).put(row);
              oldRows.delete(row.id);
            }
            for (const id of oldRows.keys()) tx.objectStore(store).delete(id);
          }
        } catch (error) { failure = error; tx.abort(); }
      };
    });
  });
}
