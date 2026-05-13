/* IndexedDB-backed chunk store. Unlocks the ~5 MB localStorage ceiling —
   IDB on modern browsers is bounded only by available disk (often tens of GB
   to hundreds, depending on the OS). */

const DB_NAME = 'forge-db';
const DB_VERSION = 1;
const STORE = 'chunks';

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('agentId', 'agentId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function objectStore(mode = 'readonly') {
  return openDB().then(db => db.transaction(STORE, mode).objectStore(STORE));
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* Batch insert in a single transaction — orders of magnitude faster than
   one transaction per put. */
export async function addChunksBatch(rows) {
  if (!rows.length) return 0;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    for (const r of rows) store.put(r);
    t.oncomplete = () => resolve(rows.length);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function getAllForAgent(agentId) {
  const idx = (await objectStore('readonly')).index('agentId');
  return wrap(idx.getAll(IDBKeyRange.only(agentId)));
}

export async function countForAgent(agentId) {
  const idx = (await objectStore('readonly')).index('agentId');
  return wrap(idx.count(IDBKeyRange.only(agentId)));
}

export async function deleteOne(id) {
  return wrap((await objectStore('readwrite')).delete(id));
}

export async function deleteAllForAgent(agentId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const idx = t.objectStore(STORE).index('agentId');
    const req = idx.openCursor(IDBKeyRange.only(agentId));
    let removed = 0;
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { cursor.delete(); removed++; cursor.continue(); }
    };
    t.oncomplete = () => resolve(removed);
    t.onerror = () => reject(t.error);
  });
}

/* Storage quota — browser tells us how much room we have. */
export async function quota() {
  if (!navigator.storage?.estimate) return { quota: null, usage: null };
  const { quota, usage } = await navigator.storage.estimate();
  return { quota, usage };
}

/* Stream-aware ingestion: never holds an entire file in memory.
   File.stream() → TextDecoderStream → buffer until ~1KB, write rows in batches. */
export async function ingestFile(file, agentId, { chunkChars = 1000, batchSize = 200, onProgress } = {}) {
  const reader = file.stream().pipeThrough(new TextDecoderStream('utf-8', { fatal: false })).getReader();
  let buf = '';
  let bytes = 0;
  let chunksWritten = 0;
  let batch = [];
  const flushBatch = async () => {
    if (!batch.length) return;
    await addChunksBatch(batch);
    chunksWritten += batch.length;
    batch = [];
  };
  const enqueue = (text) => {
    if (!text.trim()) return;
    batch.push({
      id: crypto.randomUUID(),
      agentId,
      title: file.name,
      text: text.trim(),
      source: 'file:' + file.name,
      ts: Date.now()
    });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += value;
    bytes += value.length; // approximate; chars not bytes, fine for progress
    while (buf.length >= chunkChars * 2) {
      // Prefer to split on a paragraph or sentence boundary near the target size.
      let cut = buf.indexOf('\n\n', chunkChars);
      if (cut === -1 || cut > chunkChars * 1.6) cut = buf.indexOf('. ', chunkChars);
      if (cut === -1 || cut > chunkChars * 1.6) cut = chunkChars;
      enqueue(buf.slice(0, cut));
      buf = buf.slice(cut);
      if (batch.length >= batchSize) await flushBatch();
    }
    onProgress?.({ bytes, fileSize: file.size, name: file.name, chunksWritten: chunksWritten + batch.length });
  }
  if (buf.trim()) enqueue(buf);
  await flushBatch();
  onProgress?.({ bytes, fileSize: file.size, name: file.name, chunksWritten, done: true });
  return chunksWritten;
}
