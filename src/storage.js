export const STORAGE_KEY = 'forge.v1';

export const defaultKeys = () => ({
  nvidia: '', firecrawl: '', gworkspace: '', vector: '', vectorEndpoint: ''
});

export function defaultAgent(name = 'Atlas') {
  return {
    id: crypto.randomUUID(),
    name,
    mark: '◣',
    description: name === 'Atlas'
      ? 'A research-grade agent that scrapes, indexes, and summarizes the web.'
      : 'A custom agent.',
    prompt: name === 'Atlas'
      ? 'You are Atlas, a meticulous research agent. Cite sources. Think step by step.'
      : `You are ${name}. Be helpful.`,
    voice: 'neutral',
    temperature: 0.8,
    ngram: 3,
    maxTokens: 80,
    mode: 'scratch',
    model: 'meta/llama-3.1-8b-instruct',
    // Counts are cached for cheap UI rendering; the actual chunks live in IDB.
    chunkCount: 0,
    chunkChars: 0,
    // Every new agent piggybacks on the shared base corpus by default.
    useBase: true,
    datasets: [],
    tools: { firecrawl: false, gworkspace: false, vector: false }
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function migrate(s) {
  if (!s.agents) return s;
  for (const a of s.agents) {
    if (!a.mode) a.mode = a.engine === 'nvidia' ? 'nvidia' : 'scratch';
    if (!Array.isArray(a.datasets)) a.datasets = [];
    if (a.chunkCount == null) a.chunkCount = Array.isArray(a.chunks) ? a.chunks.length : 0;
    if (a.chunkChars == null) {
      a.chunkChars = Array.isArray(a.chunks)
        ? a.chunks.reduce((n, c) => n + (c.text || '').length, 0)
        : 0;
    }
    if (a.useBase == null) a.useBase = true;
  }
  return s;
}

/* If the loaded state still has a `chunks` array on any agent, move them
   into IndexedDB and strip them from the in-memory state. Returns the
   number of agents that needed migration. */
export async function moveLegacyChunksToDB(s, addBatch) {
  let migrated = 0;
  for (const a of s.agents || []) {
    if (Array.isArray(a.chunks) && a.chunks.length) {
      const rows = a.chunks.map(c => ({
        id: c.id || crypto.randomUUID(),
        agentId: a.id,
        title: c.title || 'untitled',
        text: c.text || '',
        source: c.source || 'legacy',
        ts: c.ts || Date.now()
      }));
      await addBatch(rows);
      a.chunkCount = rows.length;
      a.chunkChars = rows.reduce((n, r) => n + r.text.length, 0);
      delete a.chunks;
      migrated++;
    } else {
      delete a.chunks;
    }
  }
  return migrated;
}

export function initialState() {
  const s = migrate(load());
  if (!s.agents || s.agents.length === 0) {
    const a = defaultAgent('Atlas');
    return { agents: [a], activeId: a.id, keys: defaultKeys() };
  }
  if (!s.keys) s.keys = defaultKeys();
  return s;
}
