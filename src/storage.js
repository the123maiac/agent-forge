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
    chunks: [],
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
  }
  return s;
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
