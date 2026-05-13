export function tokenize(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(\s+|[.!?,;:——()\[\]"'`])/)
    .filter(t => t && t.trim());
}

export function buildMarkov(chunks, n) {
  const map = new Map();
  const starts = [];
  for (const c of chunks) {
    const toks = tokenize(c.text || '');
    if (toks.length < n) continue;
    starts.push(toks.slice(0, n - 1));
    for (let i = 0; i <= toks.length - n; i++) {
      const key = toks.slice(i, i + n - 1).join('');
      const next = toks[i + n - 1];
      let bucket = map.get(key);
      if (!bucket) { bucket = new Map(); map.set(key, bucket); }
      bucket.set(next, (bucket.get(next) || 0) + 1);
    }
  }
  return { map, starts, n };
}

function pickWeighted(bucket, temperature) {
  const T = Math.max(0.05, temperature);
  let total = 0;
  const items = [];
  for (const [w, c] of bucket) {
    const weight = Math.pow(c, 1 / T);
    total += weight;
    items.push([w, weight]);
  }
  let r = Math.random() * total;
  for (const [w, weight] of items) {
    r -= weight;
    if (r <= 0) return w;
  }
  return items[items.length - 1][0];
}

export function generateMarkov(model, seed, maxTokens, temperature) {
  const { map, starts, n } = model;
  if (!starts.length) return '';
  let prefix;
  if (seed && seed.length) {
    const seedToks = tokenize(seed);
    if (seedToks.length >= n - 1) {
      prefix = seedToks.slice(-(n - 1));
      if (!map.has(prefix.join(''))) prefix = starts[Math.floor(Math.random() * starts.length)].slice();
    } else {
      prefix = starts[Math.floor(Math.random() * starts.length)].slice();
    }
  } else {
    prefix = starts[Math.floor(Math.random() * starts.length)].slice();
  }
  const out = [...prefix];
  for (let i = 0; i < maxTokens; i++) {
    const key = prefix.join('');
    const bucket = map.get(key);
    if (!bucket) break;
    const next = pickWeighted(bucket, temperature);
    out.push(next);
    prefix = [...prefix.slice(1), next];
    if (/[.!?](?!.)/.test(next) && out.length > 12 && Math.random() < 0.18) break;
  }
  return out.join(' ').replace(/\s+([.!?,;:])/g, '$1').replace(/\s+/g, ' ').trim();
}

export function applyVoice(text, voice) {
  if (!text) return text;
  switch (voice) {
    case 'concise': {
      const m = text.match(/[^.!?]+[.!?]/);
      return m ? m[0].trim() : text.split(' ').slice(0, 20).join(' ') + '…';
    }
    case 'poetic':
      return text.replace(/([.!?])\s+/g, '$1\n').replace(/,\s+/g, ',\n');
    case 'rigorous':
      return text + (text.endsWith('.') ? '' : '.');
    case 'playful':
      return text.replace(/\.$/, '!');
    default:
      return text;
  }
}
