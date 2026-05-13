const STOP = new Set([
  'the','a','an','and','or','but','of','in','on','at','to','for',
  'is','are','was','were','be','been','being','it','this','that',
  'these','those','i','you','he','she','we','they','my','your','our','their',
  'as','by','with','from','up','about','into','over','after',
  'do','does','did','have','has','had','can','could','should','would','will',
  'if','then','so','not','no','what','which','who','whom','where','when','why','how'
]);

export function terms(text) {
  return (text || '').toLowerCase().match(/[a-z0-9]{2,}/g)?.filter(t => !STOP.has(t)) || [];
}

export function retrieveChunks(chunks, query, topK = 6) {
  if (!chunks.length) return [];
  const qTerms = terms(query);
  if (!qTerms.length) return chunks.slice(0, topK);
  const df = new Map();
  const docTerms = chunks.map(c => {
    const t = terms(c.title + ' ' + c.text);
    for (const w of new Set(t)) df.set(w, (df.get(w) || 0) + 1);
    return t;
  });
  const N = chunks.length;
  const idf = (w) => Math.log(1 + N / (1 + (df.get(w) || 0)));
  const scored = chunks.map((c, i) => {
    const tf = new Map();
    for (const w of docTerms[i]) tf.set(w, (tf.get(w) || 0) + 1);
    let s = 0;
    for (const q of qTerms) if (tf.has(q)) s += tf.get(q) * idf(q);
    return { c, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const hits = scored.filter(x => x.s > 0).slice(0, topK).map(x => x.c);
  return hits.length ? hits : chunks.slice(0, Math.min(topK, chunks.length));
}
