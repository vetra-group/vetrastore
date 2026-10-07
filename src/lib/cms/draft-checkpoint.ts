// Private browser recovery only. These records are never submitted implicitly.
const DATABASE = "vetra-cms-recovery";
const STORE = "checkpoints";
export const CHECKPOINT_TTL = 7 * 24 * 60 * 60 * 1000;
export type Checkpoint<T> = { key: string; owner: string; at: number; value: T };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Recovery storage is blocked"));
  });
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? request.error ?? new Error("Recovery storage unavailable")); };
    } catch (error) { db.close(); reject(error); }
  });
}

export function checkpointScope(owner: string): string {
  let tab = sessionStorage.getItem("vetra-cms-editing-tab");
  if (!tab) { tab = crypto.randomUUID(); sessionStorage.setItem("vetra-cms-editing-tab", tab); }
  return `${owner}:${tab}`;
}
export async function writeCheckpoint<T>(key: string, owner: string, value: T) {
  await transaction("readwrite", (store) => store.put({ key, owner, value, at: Date.now() } satisfies Checkpoint<T>));
}
export async function deleteCheckpoint(key: string) {
  await transaction("readwrite", (store) => store.delete(key));
}
export async function readCheckpoint<T>(key: string, owner: string): Promise<Checkpoint<T> | null> {
  const record = await transaction("readonly", (store) => store.get(key)) as Checkpoint<T> | undefined;
  if (!record || record.owner !== owner || record.key !== key) return null;
  if (!Number.isFinite(record.at) || Date.now() - record.at >= CHECKPOINT_TTL || record.at > Date.now() + 60000) { await deleteCheckpoint(key); return null; }
  return record;
}
