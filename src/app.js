import { DATASETS } from './datasets.js';
import { initialState, save as saveState, defaultAgent } from './storage.js';
import { buildMarkov, generateMarkov, applyVoice } from './markov.js';
import { retrieveChunks } from './retrieval.js';
import { nvidiaChat, firecrawlScrape, firecrawlCrawl } from './api.js';

/* ---------- State ---------- */
let state = initialState();
const save = () => saveState(state);
save();
const active = () => state.agents.find(a => a.id === state.activeId) || state.agents[0];

/* ---------- DOM refs ---------- */
const $ = (id) => document.getElementById(id);
const headMark = $('headMark'), headName = $('headName'), headDesc = $('headDesc');
const iName = $('iName'), iDesc = $('iDesc'), iPrompt = $('iPrompt'), iModel = $('iModel');
const tempSlider = $('tempSlider'), tempVal = $('tempVal');
const tokSlider = $('tokSlider'), tokVal = $('tokVal');
const promptCount = $('promptCount');
const markGrid = $('markGrid'), voicePills = $('voicePills'), ngrams = $('ngrams');
const modeCards = $('modeCards');
const datasetsEl = $('datasets');
const crawlLimit = $('crawlLimit');
const trainStatus = $('trainStatus'), trainStatusText = $('trainStatusText');
const agentList = $('agentList'), agentCount = $('agentCount');
const newAgent = $('newAgent');
const chunksEl = $('chunks'), kChunks = $('kChunks'), kChars = $('kChars');
const chunkTitle = $('chunkTitle'), chunkText = $('chunkText');
const fileInput = $('fileInput'), dropEl = $('drop');
const scrapeUrl = $('scrapeUrl'), scrapeBtn = $('scrapeBtn');
const playShell = $('playShell'), playInput = $('playInput'), playSend = $('playSend'), playCrumbs = $('playCrumbs');
const toolGrid = $('toolGrid');
const toastEl = $('toast');

/* ---------- Toast ---------- */
let toastT = null;
function toast(msg, isErr = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('is-err', isErr);
  toastEl.classList.add('is-show');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('is-show'), 2400);
}

/* ---------- Renderers ---------- */
function paintTrack(el) {
  const min = +el.min || 0, max = +el.max || 1;
  const p = ((+el.value - min) / (max - min)) * 100;
  el.style.setProperty('--p', p + '%');
}

function renderSidebar() {
  agentList.replaceChildren();
  for (const a of state.agents) {
    const btn = document.createElement('button');
    btn.className = 'agent' + (a.id === state.activeId ? ' is-active' : '');
    const row = document.createElement('div'); row.className = 'agent-row';
    const nameWrap = document.createElement('span'); nameWrap.className = 'agent-name';
    const glyph = document.createElement('span'); glyph.className = 'glyph'; glyph.textContent = a.mark;
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = a.name;
    nameWrap.append(glyph, nm);
    const close = document.createElement('span'); close.className = 'close'; close.textContent = '×'; close.title = 'remove';
    row.append(nameWrap, close);
    const meta = document.createElement('span'); meta.className = 'agent-meta';
    meta.textContent = `${a.chunks.length} chunks · ${a.ngram}-gram`;
    btn.append(row, meta);
    btn.addEventListener('click', (e) => {
      if (e.target === close) {
        e.stopPropagation();
        if (state.agents.length <= 1) { toast('Need at least one agent.', true); return; }
        if (!confirm(`Delete agent "${a.name}"?`)) return;
        state.agents = state.agents.filter(x => x.id !== a.id);
        if (state.activeId === a.id) state.activeId = state.agents[0].id;
        save(); renderAll();
        return;
      }
      state.activeId = a.id;
      save(); renderAll();
    });
    agentList.append(btn);
  }
  agentCount.textContent = state.agents.length;
}

function renderHead() {
  const a = active();
  headMark.textContent = a.mark;
  headName.textContent = a.name;
  headDesc.textContent = a.description;
}

function renderIdentity() {
  const a = active();
  iName.value = a.name;
  iDesc.value = a.description;
  iPrompt.value = a.prompt;
  promptCount.textContent = a.prompt.length + ' chars';
  tempSlider.value = a.temperature;
  tempVal.textContent = (+a.temperature).toFixed(2);
  paintTrack(tempSlider);
  tokSlider.value = a.maxTokens;
  tokVal.textContent = a.maxTokens;
  paintTrack(tokSlider);
  iModel.value = a.model;

  markGrid.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b.dataset.mark === a.mark));
  voicePills.querySelectorAll('.pill').forEach(p => p.classList.toggle('is-active', p.dataset.voice === a.voice));
  ngrams.querySelectorAll('.ngram').forEach(p => p.classList.toggle('is-active', +p.dataset.n === a.ngram));
  modeCards.querySelectorAll('.mode-card').forEach(p => p.classList.toggle('is-active', p.dataset.mode === a.mode));
}

function renderDatasets() {
  const a = active();
  datasetsEl.replaceChildren();
  for (const [key, ds] of Object.entries(DATASETS)) {
    const loaded = a.datasets.includes(key);
    const btn = document.createElement('button');
    btn.className = 'dataset' + (loaded ? ' is-loaded' : '');
    btn.dataset.ds = key;

    const nm = document.createElement('span'); nm.className = 'nm';
    const glyph = document.createElement('span'); glyph.className = 'glyph'; glyph.textContent = ds.glyph;
    const label = document.createElement('span'); label.textContent = ds.name;
    nm.append(glyph, label);

    const meta = document.createElement('span'); meta.className = 'meta'; meta.textContent = ds.desc;
    const ct = document.createElement('span'); ct.className = 'ct';
    ct.textContent = loaded ? 'loaded' : `${ds.items.length} chunks`;

    btn.append(nm, meta, ct);
    btn.addEventListener('click', () => loadDataset(key));
    datasetsEl.append(btn);
  }
}

function renderTrainStatus() {
  const a = active();
  const dot = trainStatus.querySelector('.status-dot');
  dot.className = 'status-dot';
  if (a.mode === 'nvidia') {
    if (state.keys.nvidia) { dot.classList.add('is-ready'); trainStatusText.textContent = `ready · NVIDIA ${a.model}`; }
    else { dot.classList.add('is-warn'); trainStatusText.textContent = 'NVIDIA key required'; }
  } else if (a.mode === 'taught') {
    if (!state.keys.nvidia) { dot.classList.add('is-warn'); trainStatusText.textContent = 'add NVIDIA key, then synthesize in Knowledge'; }
    else if (a.chunks.length === 0) { trainStatusText.textContent = 'add seed chunks, then synthesize'; }
    else { dot.classList.add('is-ready'); trainStatusText.textContent = `teacher ready · ${a.chunks.length} chunks · synthesize in Knowledge`; }
  } else {
    if (a.chunks.length === 0) { trainStatusText.textContent = 'awaiting training data'; }
    else { dot.classList.add('is-ready'); trainStatusText.textContent = `trained · ${a.chunks.length} chunks · ${a.ngram}-gram`; }
  }
}

function renderKnowledge() {
  const a = active();
  chunksEl.replaceChildren();
  let chars = 0;
  for (const c of a.chunks) {
    chars += (c.text || '').length;
    const el = document.createElement('div'); el.className = 'chunk';
    const left = document.createElement('div');
    const t = document.createElement('div'); t.className = 'ct'; t.textContent = c.title || 'untitled';
    const b = document.createElement('div'); b.className = 'cb'; b.textContent = c.text;
    const meta = document.createElement('div'); meta.className = 'cmeta';
    meta.textContent = `${(c.text || '').length} chars · ${c.source || 'manual'}`;
    left.append(t, b, meta);
    const del = document.createElement('span'); del.className = 'del'; del.textContent = '×';
    del.addEventListener('click', () => {
      a.chunks = a.chunks.filter(x => x.id !== c.id);
      save(); renderAll();
    });
    el.append(left, del);
    chunksEl.append(el);
  }
  kChunks.textContent = a.chunks.length;
  kChars.textContent = chars;

  const fcOn = !!state.keys.firecrawl;
  scrapeBtn.disabled = !fcOn;
  scrapeBtn.title = fcOn ? 'scrape via Firecrawl' : 'add a Firecrawl key in Training';
}

function renderTools() {
  const a = active();
  toolGrid.querySelectorAll('.tool[data-tool]').forEach(t => {
    const which = t.dataset.tool;
    const need = t.dataset.needs;
    const hasKey = !!state.keys[need];
    t.classList.toggle('is-on', !!a.tools[which]);
    t.classList.toggle('is-locked', !hasKey);
    const badge = t.querySelector('.badge');
    badge.textContent = a.tools[which] ? 'on' : 'off';
    const meta = t.querySelector('[data-meta]');
    meta.textContent = hasKey ? `${need} · ready` : `${need} · missing key`;
  });
}

function renderKeys() {
  document.querySelectorAll('[data-key]').forEach(input => {
    const k = input.dataset.key;
    input.value = state.keys[k] || '';
    input.classList.toggle('has-key', !!state.keys[k]);
  });
}

function renderPlayground() {
  const a = active();
  if (a.mode === 'nvidia') {
    playCrumbs.textContent = state.keys.nvidia ? `NVIDIA RAG · ${a.model}` : 'NVIDIA key required';
    playInput.placeholder = state.keys.nvidia ? `ask ${a.name}…` : `add a NVIDIA key first…`;
  } else {
    const tag = a.mode === 'taught' ? 'taught n-gram' : 'n-gram';
    playCrumbs.textContent = a.chunks.length ? `${tag} · ${a.ngram}-gram · ${a.chunks.length} chunks` : 'not trained · add knowledge to begin';
    playInput.placeholder = a.chunks.length ? `say something to ${a.name}…` : `train ${a.name} first…`;
  }
  if (!playShell.dataset.hasMessages) {
    playShell.replaceChildren();
    const empty = document.createElement('div'); empty.className = 'empty';
    const g = document.createElement('span'); g.className = 'glyph'; g.textContent = a.mark;
    const t = document.createElement('div'); t.className = 't'; t.textContent = `say something to ${a.name}`;
    const s = document.createElement('div'); s.className = 's';
    s.textContent = a.mode === 'nvidia'
      ? (state.keys.nvidia ? 'powered by NVIDIA build · grounded in your chunks' : 'no key yet — paste your nvapi key first')
      : (a.chunks.length ? (a.mode === 'taught' ? 'trained locally from synthesized data' : 'trained locally — runs in your browser') : 'no model yet — train me first');
    empty.append(g, t, s);
    playShell.append(empty);
  }
}

function renderAll() {
  renderSidebar();
  renderHead();
  renderIdentity();
  renderTrainStatus();
  renderKnowledge();
  renderDatasets();
  renderTools();
  renderKeys();
  renderPlayground();
}

/* ---------- Knowledge helpers ---------- */
function chunkize(text, maxChars = 1000) {
  const out = [];
  let buf = '';
  for (const para of text.split(/\n\n+/)) {
    if ((buf + '\n\n' + para).length > maxChars && buf) {
      out.push(buf.trim());
      buf = para;
    } else {
      buf = buf ? buf + '\n\n' + para : para;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function addChunks(items, source = 'manual') {
  const a = active();
  for (const it of items) {
    a.chunks.push({
      id: crypto.randomUUID(),
      title: it.title || 'untitled',
      text: it.text,
      source,
      ts: Date.now()
    });
  }
  save(); renderAll();
}

function loadDataset(key) {
  const ds = DATASETS[key];
  if (!ds) return;
  const a = active();
  if (a.datasets.includes(key)) { toast(`${ds.name} already loaded`); return; }
  const items = ds.items.map(it => ({ title: `${ds.name} · ${it.title}`, text: it.text }));
  addChunks(items, 'dataset:' + key);
  a.datasets.push(key);
  save(); renderAll();
  toast(`+${items.length} chunks from ${ds.name}`);
}

/* ---------- Tabs ---------- */
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('[data-panel]');
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.toggle('is-active', x === t));
  const which = t.dataset.tab;
  panels.forEach(p => p.hidden = p.dataset.panel !== which);
}));

/* ---------- Identity events ---------- */
markGrid.addEventListener('click', e => {
  const btn = e.target.closest('button[data-mark]');
  if (!btn) return;
  active().mark = btn.dataset.mark;
  save(); renderAll();
});
voicePills.addEventListener('click', e => {
  const btn = e.target.closest('.pill');
  if (!btn) return;
  active().voice = btn.dataset.voice;
  save(); renderIdentity();
});
ngrams.addEventListener('click', e => {
  const btn = e.target.closest('.ngram');
  if (!btn) return;
  active().ngram = +btn.dataset.n;
  save(); renderAll();
});
modeCards.addEventListener('click', e => {
  const btn = e.target.closest('.mode-card');
  if (!btn) return;
  active().mode = btn.dataset.mode;
  save(); renderAll();
});
iName.addEventListener('input', () => {
  active().name = iName.value.trim() || 'Untitled';
  save(); renderSidebar(); renderHead(); renderPlayground();
});
iDesc.addEventListener('input', () => { active().description = iDesc.value; save(); renderHead(); });
iPrompt.addEventListener('input', () => {
  active().prompt = iPrompt.value;
  promptCount.textContent = iPrompt.value.length + ' chars';
  save();
});
iModel.addEventListener('input', () => {
  active().model = iModel.value || 'meta/llama-3.1-8b-instruct';
  save(); renderTrainStatus();
});
tempSlider.addEventListener('input', () => {
  active().temperature = +tempSlider.value;
  tempVal.textContent = (+tempSlider.value).toFixed(2);
  paintTrack(tempSlider); save();
});
tokSlider.addEventListener('input', () => {
  active().maxTokens = +tokSlider.value;
  tokVal.textContent = tokSlider.value;
  paintTrack(tokSlider); save();
});

/* ---------- Keys ---------- */
document.querySelectorAll('[data-show]').forEach(b => {
  b.addEventListener('click', () => {
    const input = b.parentElement.querySelector('input');
    const isPw = input.type === 'password';
    input.type = isPw ? 'text' : 'password';
    b.textContent = isPw ? 'hide' : 'show';
  });
});
document.querySelectorAll('[data-save]').forEach(b => {
  b.addEventListener('click', () => {
    const input = b.parentElement.querySelector('input[data-key]');
    const k = input.dataset.key;
    state.keys[k] = input.value.trim();
    save(); renderAll();
    toast(state.keys[k] ? `${k} key saved` : `${k} key cleared`);
  });
});

/* ---------- Agents ---------- */
$('addAgent').addEventListener('click', () => {
  const v = newAgent.value.trim();
  if (!v) { toast('name required', true); return; }
  const a = defaultAgent(v);
  state.agents.push(a);
  state.activeId = a.id;
  save(); renderAll();
  newAgent.value = '';
  toast(`agent "${v}" created`);
});
newAgent.addEventListener('keydown', e => { if (e.key === 'Enter') $('addAgent').click(); });

/* ---------- Knowledge inputs ---------- */
$('addChunk').addEventListener('click', () => {
  const text = chunkText.value.trim();
  if (!text) { toast('paste some text first', true); return; }
  const title = chunkTitle.value.trim() || 'note';
  const parts = chunkize(text);
  addChunks(parts.map((t, i) => ({ title: parts.length > 1 ? `${title} #${i + 1}` : title, text: t })));
  chunkTitle.value = ''; chunkText.value = '';
  toast(`added ${parts.length} chunk${parts.length > 1 ? 's' : ''}`);
});

dropEl.addEventListener('click', () => fileInput.click());
dropEl.addEventListener('dragover', e => { e.preventDefault(); dropEl.classList.add('is-drag'); });
dropEl.addEventListener('dragleave', () => dropEl.classList.remove('is-drag'));
dropEl.addEventListener('drop', async e => {
  e.preventDefault();
  dropEl.classList.remove('is-drag');
  await ingestFiles([...(e.dataTransfer.files || [])]);
});
fileInput.addEventListener('change', async () => {
  await ingestFiles([...fileInput.files]);
  fileInput.value = '';
});
async function ingestFiles(files) {
  let total = 0;
  for (const f of files) {
    const text = await f.text();
    const parts = chunkize(text);
    addChunks(parts.map((t, i) => ({ title: parts.length > 1 ? `${f.name} #${i + 1}` : f.name, text: t })), 'file');
    total += parts.length;
  }
  if (total) toast(`ingested ${total} chunks from ${files.length} file${files.length > 1 ? 's' : ''}`);
}

/* ---------- Synthesize (NVIDIA teacher → permanent corpus) ---------- */
let synthCount = 10, synthStrategy = 'expand';
$('synthCount').addEventListener('click', e => {
  const b = e.target.closest('.pill'); if (!b) return;
  synthCount = +b.dataset.count;
  document.querySelectorAll('#synthCount .pill').forEach(p => p.classList.toggle('is-active', p === b));
});
$('synthStrategy').addEventListener('click', e => {
  const b = e.target.closest('.pill'); if (!b) return;
  synthStrategy = b.dataset.strat;
  document.querySelectorAll('#synthStrategy .pill').forEach(p => p.classList.toggle('is-active', p === b));
});

const STRATEGY_INSTRUCTIONS = {
  expand:     'Write NEW paragraphs that expand on the same topics, in the same voice. Each should add facts, depth, or angle the examples did not cover.',
  paraphrase: 'Rewrite the example material from different angles — different sentence structures, vocabulary, ordering — while preserving meaning.',
  qa:         'Produce question-and-answer pairs in this exact format inside each text field: "Q: …\\nA: …". Cover questions a curious user might ask about the material.',
  examples:   'Produce concrete worked examples, scenarios, or case studies that illustrate the same concepts.'
};

$('synthBtn').addEventListener('click', async () => {
  const a = active();
  if (!state.keys.nvidia) { toast('add an NVIDIA key in Training first', true); return; }
  if (!a.chunks.length) { toast('add at least one seed chunk first', true); return; }
  const btn = $('synthBtn');
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'synthesizing…';
  try {
    const seedTxt = a.chunks.slice(0, 8).map(c => `[${c.title}]\n${c.text}`).join('\n\n---\n\n').slice(0, 8000);
    const steering = $('synthSeed').value.trim();
    const sys = `You are a training-data generator for an agent named "${a.name}" whose role is: ${a.prompt}\n\n${STRATEGY_INSTRUCTIONS[synthStrategy]}\n\nReturn ONLY a JSON array of ${synthCount} objects, each: {"title": "...", "text": "..."}. The text field should be 2-4 sentences. No prose outside the JSON array.`;
    const userMsg = `Examples to learn from:\n\n${seedTxt}\n\n${steering ? 'Steering: ' + steering + '\n\n' : ''}Now produce ${synthCount} new training documents as JSON.`;
    const raw = await nvidiaChat({
      apiKey: state.keys.nvidia,
      model: a.model || 'meta/llama-3.1-8b-instruct',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
      maxTokens: Math.min(4000, synthCount * 200),
      temperature: 0.9
    });
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('no JSON array in response');
    let items;
    try { items = JSON.parse(match[0]); } catch (e) { throw new Error('JSON parse failed: ' + e.message); }
    if (!Array.isArray(items)) throw new Error('not an array');
    const cleaned = items
      .filter(x => x && typeof x.text === 'string' && x.text.trim().length > 20)
      .map(x => ({ title: (x.title || 'synthetic').toString().slice(0, 80), text: x.text.trim() }));
    if (!cleaned.length) throw new Error('no valid items returned');
    addChunks(cleaned, 'synthetic');
    toast(`+${cleaned.length} synthetic chunks · local model retrained`);
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = original;
  }
});

/* ---------- Scrape / Crawl ---------- */
scrapeBtn.addEventListener('click', async () => {
  const url = scrapeUrl.value.trim();
  const limit = Math.max(1, Math.min(50, parseInt(crawlLimit.value, 10) || 1));
  if (!url) { toast('enter a URL', true); return; }
  if (!state.keys.firecrawl) { toast('add a Firecrawl key first', true); return; }
  scrapeBtn.disabled = true;
  const original = scrapeBtn.textContent;
  try {
    if (limit === 1) {
      scrapeBtn.textContent = 'scraping…';
      const { markdown, title } = await firecrawlScrape({ apiKey: state.keys.firecrawl, url });
      if (!markdown) throw new Error('no markdown returned');
      const parts = chunkize(markdown);
      addChunks(parts.map((t, i) => ({ title: parts.length > 1 ? `${title} #${i + 1}` : title, text: t })), 'firecrawl');
      toast(`scraped ${parts.length} chunks from ${title}`);
    } else {
      scrapeBtn.textContent = 'crawling…';
      const docs = await firecrawlCrawl({
        apiKey: state.keys.firecrawl, url, limit,
        onProgress: (j) => { scrapeBtn.textContent = `${j.completed || 0}/${j.total || limit}…`; }
      });
      let total = 0;
      for (const d of docs) {
        if (!d.markdown) continue;
        const parts = chunkize(d.markdown);
        addChunks(parts.map((t, i) => ({ title: parts.length > 1 ? `${d.title} #${i + 1}` : d.title, text: t })), 'firecrawl');
        total += parts.length;
      }
      toast(`crawled ${docs.length} pages · ${total} chunks`);
    }
    scrapeUrl.value = '';
  } catch (err) {
    toast(err.message || 'scrape failed', true);
  } finally {
    scrapeBtn.disabled = false;
    scrapeBtn.textContent = original;
  }
});

/* ---------- Tools ---------- */
toolGrid.addEventListener('click', e => {
  const t = e.target.closest('.tool[data-tool]');
  if (!t) return;
  if (t.classList.contains('is-locked')) {
    toast(`add a ${t.dataset.needs} key in Training first`, true);
    return;
  }
  const which = t.dataset.tool;
  active().tools[which] = !active().tools[which];
  save(); renderTools();
});
$('exportAgent').addEventListener('click', () => {
  const a = active();
  const blob = new Blob([JSON.stringify(a, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `${a.name}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

/* ---------- Playground ---------- */
function appendMsg(who, text, cls = '') {
  playShell.dataset.hasMessages = '1';
  if (playShell.querySelector('.empty')) playShell.replaceChildren();
  const m = document.createElement('div'); m.className = `msg ${cls}`;
  const w = document.createElement('div'); w.className = 'who'; w.textContent = who;
  const b = document.createElement('div'); b.className = 'body'; b.textContent = text;
  m.append(w, b); playShell.append(m);
  playShell.scrollTop = playShell.scrollHeight;
  return b;
}

async function generate(msg) {
  const a = active();
  if (a.mode === 'nvidia') {
    if (!state.keys.nvidia) throw new Error('no NVIDIA key — add one in Training');
    const hits = retrieveChunks(a.chunks, msg, 6);
    let context = '';
    if (hits.length) {
      let buf = '\n\nKnowledge (use ONLY this to answer; if the answer is not here, say so):\n';
      for (let i = 0; i < hits.length; i++) {
        const c = hits[i];
        const block = `\n[${i + 1}] ${c.title}\n${c.text}\n`;
        if (buf.length + block.length > 12000) break;
        buf += block;
      }
      context = buf;
    }
    const sys = a.prompt + (context
      ? '\n\nGround every answer in the Knowledge below. Cite chunks like [1], [2] when relevant. If the Knowledge does not cover the question, say so plainly.'
      : '') + context;
    const out = await nvidiaChat({
      apiKey: state.keys.nvidia,
      model: a.model || 'meta/llama-3.1-8b-instruct',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }],
      maxTokens: a.maxTokens,
      temperature: a.temperature
    });
    return applyVoice(out, a.voice);
  } else {
    if (!a.chunks.length) throw new Error('no training data — add chunks first');
    const model = buildMarkov(a.chunks, a.ngram);
    const raw = generateMarkov(model, msg, a.maxTokens, a.temperature);
    if (!raw) throw new Error('not enough data — add more chunks or lower the n-gram order');
    return applyVoice(raw, a.voice);
  }
}

async function sendMessage() {
  const msg = playInput.value.trim();
  if (!msg) return;
  const a = active();
  appendMsg('you', msg, 'user');
  playInput.value = '';
  playSend.disabled = true; playSend.textContent = '…';
  const placeholder = appendMsg(a.name.toLowerCase(), 'thinking…', 'agent');
  try {
    const out = await generate(msg);
    placeholder.textContent = out || '(empty)';
  } catch (err) {
    placeholder.parentElement.classList.add('err');
    placeholder.textContent = err.message;
  } finally {
    playSend.disabled = false; playSend.textContent = 'send →';
    playShell.scrollTop = playShell.scrollHeight;
  }
}
playSend.addEventListener('click', sendMessage);
playInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

/* ---------- Init ---------- */
renderAll();
