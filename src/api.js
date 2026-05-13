export const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
export const FIRECRAWL_URL = 'https://api.firecrawl.dev/v1/scrape';
export const FIRECRAWL_CRAWL = 'https://api.firecrawl.dev/v1/crawl';

export async function nvidiaChat({ apiKey, model, messages, maxTokens = 256, temperature = 0.8 }) {
  const res = await fetch(NVIDIA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature })
  });
  if (!res.ok) throw new Error(`NVIDIA ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

export async function firecrawlScrape({ apiKey, url }) {
  const res = await fetch(FIRECRAWL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ url, formats: ['markdown'] })
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return {
    markdown: data?.data?.markdown || data?.markdown || '',
    title: data?.data?.metadata?.title || url
  };
}

async function pollCrawl(jobUrl, headers, onProgress) {
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const r = await fetch(jobUrl, { headers });
    if (!r.ok) throw new Error(`Firecrawl status ${r.status}`);
    const j = await r.json();
    onProgress?.(j);
    if (j.status === 'completed') return j;
    if (j.status === 'failed') throw new Error('crawl failed');
    await new Promise(res => setTimeout(res, 2500));
  }
  throw new Error('crawl timeout');
}

export async function firecrawlCrawl({ apiKey, url, limit, onProgress }) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
  const start = await fetch(FIRECRAWL_CRAWL, {
    method: 'POST', headers,
    body: JSON.stringify({ url, limit, scrapeOptions: { formats: ['markdown'] } })
  });
  if (!start.ok) throw new Error(`Firecrawl ${start.status}: ${(await start.text()).slice(0, 200)}`);
  const sd = await start.json();
  const jobUrl = sd.url || (sd.id ? `${FIRECRAWL_CRAWL}/${sd.id}` : null);
  if (!jobUrl) throw new Error('no crawl job url');
  const done = await pollCrawl(jobUrl, headers, onProgress);
  return (done.data || []).map(d => ({
    markdown: d.markdown || d?.content?.markdown || '',
    title: d.metadata?.title || d.metadata?.sourceURL || url
  }));
}
