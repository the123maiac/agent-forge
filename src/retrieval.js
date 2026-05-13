/* Tight stoplist — keep question words (what/how/why etc.) and modals
   (can/do/will etc.) because they carry real intent in dialogue. */
const STOP = new Set([
  'the','a','an','and','or','but','of','in','on','at','to','for',
  'is','are','was','were','be','been','being','it','this','that',
  'these','those','i','you','he','she','we','they','my','your','our','their',
  'as','by','with','from','up','about','into','over','after',
  'have','has','had','if','then','so','not','no'
]);

function termsRaw(text) {
  return (text || '').toLowerCase().match(/[a-z0-9]{2,}/g) || [];
}
export function terms(text) {
  return termsRaw(text).filter(t => !STOP.has(t));
}

export function retrieveScored(chunks, query, topK = 6) {
  if (!chunks.length) return [];
  let qTerms = terms(query);
  let tokens = terms;
  if (!qTerms.length) {
    // Query was entirely stopwords — fall back to all-word matching.
    qTerms = termsRaw(query);
    tokens = termsRaw;
    if (!qTerms.length) return chunks.slice(0, topK).map(c => ({ chunk: c, score: 0 }));
  }
  const df = new Map();
  const docTerms = chunks.map(c => {
    const t = tokens(c.title + ' ' + c.text);
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
    const norm = Math.max(1, Math.sqrt(docTerms[i].length));
    return { chunk: c, score: s / norm };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.filter(x => x.score > 0).slice(0, topK);
}

export function retrieveChunks(chunks, query, topK = 6) {
  const scored = retrieveScored(chunks, query, topK);
  if (scored.length) return scored.map(x => x.chunk);
  return chunks.slice(0, Math.min(topK, chunks.length));
}

/* If a chunk is in "Q: ...\nA: ..." form, return the answer body. */
export function extractAnswer(text) {
  const m = (text || '').match(/(?:^|\n)\s*A:\s*([\s\S]+?)(?:\n\s*Q:|$)/i);
  return m ? m[1].trim() : null;
}
