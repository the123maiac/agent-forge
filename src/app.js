import { DATASETS } from './datasets.js';
import { initialState, save as saveState, defaultAgent, moveLegacyChunksToDB } from './storage.js';
import * as db from './db.js';
import { buildMarkov, generateMarkov, applyVoice } from './markov.js';
import { retrieveChunks, retrieveScored, extractAnswer } from './retrieval.js';
import { nvidiaChat, firecrawlScrape, firecrawlCrawl } from './api.js';
import {
  buildVocab, buildModel, trainModel, sample,
  saveModel, loadModel, deleteModel,
  vocabToJSON, vocabFromJSON
} from './neural.js';

/* ---------- State ---------- */
let state = initialState();
const save = () => saveState(state);
save();
const active = () => state.agents.find(a => a.id === state.activeId) || state.agents[0];

/* Chunks cache (active agent kept hot, others fetched on demand). */
const chunkCache = new Map(); // agentId -> chunks[]
async function getChunks(agentId) {
  if (chunkCache.has(agentId)) return chunkCache.get(agentId);
  const rows = await db.getAllForAgent(agentId);
  chunkCache.set(agentId, rows);
  return rows;
}
function invalidateChunks(agentId) { chunkCache.delete(agentId); }
async function refreshCounts(agentId) {
  const rows = await getChunks(agentId);
  const a = state.agents.find(x => x.id === agentId);
  if (!a) return;
  a.chunkCount = rows.length;
  a.chunkChars = rows.reduce((n, r) => n + (r.text || '').length, 0);
  save();
}

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
const fileInput = $('fileInput'), folderInput = $('folderInput'), dropEl = $('drop');
const ingestBar = $('ingestBar'), ingestInfo = $('ingestInfo'), ingestFill = $('ingestFill'), ingestCancel = $('ingestCancel');
let ingestAbort = false;
const scrapeUrl = $('scrapeUrl'), scrapeBtn = $('scrapeBtn');
const playShell = $('playShell'), playInput = $('playInput'), playSend = $('playSend'), playCrumbs = $('playCrumbs');
const toolGrid = $('toolGrid');
const toastEl = $('toast');

const neuralPanel = $('neuralPanel');
const epSlider = $('epSlider'), epVal = $('epVal');
const huSlider = $('huSlider'), huVal = $('huVal');
const slSlider = $('slSlider'), slVal = $('slVal');
const trainBtn = $('trainBtn'), resetNeuralBtn = $('resetNeuralBtn');
const neuralStatus = $('neuralStatus');
const neuralProgress = $('neuralProgress');
const neuralConsole = $('neuralConsole');

/* Loaded neural models, keyed by agent id.
   Kept out of `state` because they hold tf.LayersModel objects. */
const neuralCache = new Map(); // agentId -> { model, vocab }

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
    meta.textContent = `${a.chunkCount.toLocaleString()} chunks · ${a.ngram}-gram`;
    btn.append(row, meta);
    btn.addEventListener('click', async (e) => {
      if (e.target === close) {
        e.stopPropagation();
        if (state.agents.length <= 1) { toast('Need at least one agent.', true); return; }
        if (!confirm(`Delete agent "${a.name}"?`)) return;
        await db.deleteAllForAgent(a.id);
        invalidateChunks(a.id);
        state.agents = state.agents.filter(x => x.id !== a.id);
        if (state.activeId === a.id) state.activeId = state.agents[0].id;
        save(); await renderAll();
        return;
      }
      state.activeId = a.id;
      save(); await renderAll();
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
  neuralPanel.hidden = a.mode !== 'neural';
  if (a.mode === 'nvidia') {
    if (state.keys.nvidia) { dot.classList.add('is-ready'); trainStatusText.textContent = `ready · NVIDIA ${a.model}`; }
    else { dot.classList.add('is-warn'); trainStatusText.textContent = 'NVIDIA key required'; }
  } else if (a.mode === 'taught') {
    if (!state.keys.nvidia) { dot.classList.add('is-warn'); trainStatusText.textContent = 'add NVIDIA key, then synthesize in Knowledge'; }
    else if (a.chunkCount === 0) { trainStatusText.textContent = 'add seed chunks, then synthesize'; }
    else { dot.classList.add('is-ready'); trainStatusText.textContent = `teacher ready · ${a.chunkCount} chunks · synthesize in Knowledge`; }
  } else if (a.mode === 'neural') {
    if (a.chunkCount === 0) { trainStatusText.textContent = 'add training data, then click train'; }
    else if (a.neural?.trained) { dot.classList.add('is-ready'); trainStatusText.textContent = `neural net trained · final loss ${(+a.neural.finalLoss).toFixed(3)} · ${a.neural.params} params`; }
    else { dot.classList.add('is-warn'); trainStatusText.textContent = `${a.chunkCount} chunks ready · click train`; }
    renderNeuralPanel();
  } else {
    if (a.chunkCount === 0) { trainStatusText.textContent = 'awaiting training data'; }
    else { dot.classList.add('is-ready'); trainStatusText.textContent = `trained · ${a.chunkCount} chunks · ${a.ngram}-gram`; }
  }
}

function renderNeuralPanel() {
  const a = active();
  const cfg = a.neural || {};
  epSlider.value = cfg.epochs || 20; epVal.textContent = epSlider.value; paintTrack(epSlider);
  huSlider.value = cfg.lstmUnits || 96; huVal.textContent = huSlider.value; paintTrack(huSlider);
  slSlider.value = cfg.seqLen || 60; slVal.textContent = slSlider.value; paintTrack(slSlider);
  neuralStatus.className = 'neural-status';
  if (a.neural?.trained) {
    neuralStatus.classList.add('is-ready');
    neuralStatus.textContent = `trained · loss ${(+a.neural.finalLoss).toFixed(3)} · vocab ${a.neural.vocabSize}`;
  } else if (a.chunkCount === 0) {
    neuralStatus.classList.add('is-warn');
    neuralStatus.textContent = 'load knowledge first';
  } else {
    neuralStatus.textContent = 'no model · click train';
  }
}

async function renderKnowledge() {
  const a = active();
  chunksEl.replaceChildren();
  // Don't render every chunk if we have thousands — just the most recent 200.
  // The full set still trains models; this is just the display list.
  const all = await getChunks(a.id);
  const visible = all.slice(-200).reverse();
  if (all.length > visible.length) {
    const note = document.createElement('div');
    note.className = 'chunks-note';
    note.textContent = `showing ${visible.length} of ${all.length.toLocaleString()} chunks (most recent first)`;
    chunksEl.append(note);
  }
  for (const c of visible) {
    const el = document.createElement('div'); el.className = 'chunk';
    const left = document.createElement('div');
    const t = document.createElement('div'); t.className = 'ct'; t.textContent = c.title || 'untitled';
    const b = document.createElement('div'); b.className = 'cb'; b.textContent = c.text;
    const meta = document.createElement('div'); meta.className = 'cmeta';
    meta.textContent = `${(c.text || '').length} chars · ${c.source || 'manual'}`;
    left.append(t, b, meta);
    const del = document.createElement('span'); del.className = 'del'; del.textContent = '×';
    del.addEventListener('click', async () => {
      await db.deleteOne(c.id);
      invalidateChunks(a.id);
      await refreshCounts(a.id);
      await renderAll();
    });
    el.append(left, del);
    chunksEl.append(el);
  }
  kChunks.textContent = a.chunkCount.toLocaleString();
  kChars.textContent = a.chunkChars.toLocaleString();
  await renderQuota();

  const fcOn = !!state.keys.firecrawl;
  scrapeBtn.disabled = !fcOn;
  scrapeBtn.title = fcOn ? 'scrape via Firecrawl' : 'add a Firecrawl key in Training';
}

async function renderQuota() {
  const q = await db.quota();
  const el = document.getElementById('quotaBar');
  if (!el || !q.quota) return;
  const pct = q.usage / q.quota;
  el.style.setProperty('--p', (pct * 100).toFixed(1) + '%');
  const label = document.getElementById('quotaLabel');
  if (label) label.textContent = `${fmtBytes(q.usage)} of ~${fmtBytes(q.quota)} (${(pct * 100).toFixed(1)}%)`;
}

function fmtBytes(n) {
  if (n == null) return '?';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 100 ? 0 : 1)} ${u[i]}`;
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
  } else if (a.mode === 'neural') {
    playCrumbs.textContent = a.neural?.trained
      ? `neural net · ${a.neural.params} params · loss ${(+a.neural.finalLoss).toFixed(3)}`
      : 'neural net · not trained · click train';
    playInput.placeholder = a.neural?.trained ? `prompt ${a.name}…` : 'train the neural net first…';
  } else {
    const tag = a.mode === 'taught' ? 'taught n-gram' : 'n-gram';
    playCrumbs.textContent = a.chunkCount ? `${tag} · ${a.ngram}-gram · ${a.chunkCount} chunks` : 'not trained · add knowledge to begin';
    playInput.placeholder = a.chunkCount ? `say something to ${a.name}…` : `train ${a.name} first…`;
  }
  if (!playShell.dataset.hasMessages) {
    playShell.replaceChildren();
    const empty = document.createElement('div'); empty.className = 'empty';
    const g = document.createElement('span'); g.className = 'glyph'; g.textContent = a.mark;
    const t = document.createElement('div'); t.className = 't'; t.textContent = `say something to ${a.name}`;
    const s = document.createElement('div'); s.className = 's';
    s.textContent = a.mode === 'nvidia'
      ? (state.keys.nvidia ? 'powered by NVIDIA build · grounded in your chunks' : 'no key yet — paste your nvapi key first')
      : a.mode === 'neural'
        ? (a.neural?.trained ? 'real neural net · sampling char by char' : 'train the neural net first')
        : (a.chunkCount ? (a.mode === 'taught' ? 'trained locally from synthesized data' : 'trained locally — runs in your browser') : 'no model yet — train me first');
    empty.append(g, t, s);
    playShell.append(empty);
  }
}

async function renderAll() {
  renderSidebar();
  renderHead();
  renderIdentity();
  renderTrainStatus();
  await renderKnowledge();
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

async function addChunks(items, source = 'manual') {
  const a = active();
  const rows = items.map(it => ({
    id: crypto.randomUUID(),
    agentId: a.id,
    title: it.title || 'untitled',
    text: it.text,
    source,
    ts: Date.now()
  }));
  await db.addChunksBatch(rows);
  invalidateChunks(a.id);
  await refreshCounts(a.id);
  await renderAll();
}

async function loadDataset(key) {
  const ds = DATASETS[key];
  if (!ds) return;
  const a = active();
  if (a.datasets.includes(key)) { toast(`${ds.name} already loaded`); return; }
  a.datasets.push(key);
  const items = ds.items.map(it => ({ title: `${ds.name} · ${it.title}`, text: it.text }));
  await addChunks(items, 'dataset:' + key);
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

dropEl.addEventListener('dragover', e => { e.preventDefault(); dropEl.classList.add('is-drag'); });
dropEl.addEventListener('dragleave', () => dropEl.classList.remove('is-drag'));
dropEl.addEventListener('drop', async e => {
  e.preventDefault();
  dropEl.classList.remove('is-drag');
  await ingestFiles([...(e.dataTransfer.files || [])]);
});
$('pickFiles').addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
$('pickFolder').addEventListener('click', (e) => { e.stopPropagation(); folderInput.click(); });
fileInput.addEventListener('change', async () => {
  await ingestFiles([...fileInput.files]);
  fileInput.value = '';
});
folderInput.addEventListener('change', async () => {
  await ingestFiles([...folderInput.files]);
  folderInput.value = '';
});
ingestCancel.addEventListener('click', () => { ingestAbort = true; });

function showIngest(text) {
  ingestBar.hidden = false;
  ingestInfo.textContent = text;
}
function setIngestPct(p) { ingestFill.style.width = (p * 100).toFixed(1) + '%'; }
function hideIngest() { ingestBar.hidden = true; setIngestPct(0); }

const TEXT_LIKE = /\.(txt|md|markdown|json|csv|tsv|log|xml|html?|yaml|yml|py|js|jsx|ts|tsx|java|rs|c|cpp|h|hpp|go|rb|sh|sql|toml|ini|cfg|conf)$/i;

async function ingestFiles(files) {
  if (!files.length) return;
  ingestAbort = false;
  const a = active();
  const eligible = files.filter(f => TEXT_LIKE.test(f.name) || f.type.startsWith('text/'));
  if (!eligible.length) { toast('no text-like files found', true); return; }
  const totalBytes = eligible.reduce((n, f) => n + f.size, 0);
  let doneBytes = 0;
  let totalChunks = 0;
  showIngest(`preparing ${eligible.length.toLocaleString()} file${eligible.length > 1 ? 's' : ''} · ${fmtBytes(totalBytes)}…`);
  const t0 = performance.now();
  try {
    for (let i = 0; i < eligible.length; i++) {
      if (ingestAbort) { toast('ingest cancelled', true); break; }
      const f = eligible[i];
      let fileBytesAtStart = doneBytes;
      const written = await db.ingestFile(f, a.id, {
        chunkChars: 1000,
        batchSize: 250,
        onProgress: ({ bytes, name, chunksWritten }) => {
          if (ingestAbort) throw new Error('cancelled');
          const overall = fileBytesAtStart + bytes;
          setIngestPct(Math.min(1, overall / totalBytes));
          ingestInfo.textContent = `file ${i + 1}/${eligible.length} · ${name} · ${fmtBytes(overall)} of ${fmtBytes(totalBytes)} · ${(totalChunks + chunksWritten).toLocaleString()} chunks`;
        }
      });
      totalChunks += written;
      doneBytes += f.size;
    }
    invalidateChunks(a.id);
    await refreshCounts(a.id);
    await renderAll();
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    toast(`ingested ${totalChunks.toLocaleString()} chunks from ${eligible.length.toLocaleString()} files · ${secs}s`);
  } catch (err) {
    if (err.message !== 'cancelled') toast(err.message || 'ingest failed', true);
    invalidateChunks(a.id);
    await refreshCounts(a.id);
    await renderAll();
  } finally {
    hideIngest();
    ingestAbort = false;
  }
}

/* ---------- Neural training ---------- */
epSlider.addEventListener('input', () => { epVal.textContent = epSlider.value; paintTrack(epSlider); });
huSlider.addEventListener('input', () => { huVal.textContent = huSlider.value; paintTrack(huSlider); });
slSlider.addEventListener('input', () => { slVal.textContent = slSlider.value; paintTrack(slSlider); });

async function corpusFor(a) {
  const rows = await getChunks(a.id);
  return rows.map(c => `${c.title}\n${c.text}`).join('\n\n').slice(0, 60000);
}

function logEpoch(epoch, total, loss) {
  neuralConsole.hidden = false;
  const line = document.createElement('div');
  const ep = document.createElement('span'); ep.className = 'epoch'; ep.textContent = `epoch ${String(epoch).padStart(2, ' ')}/${total} · `;
  const ls = document.createElement('span'); ls.className = 'loss'; ls.textContent = `loss ${loss.toFixed(4)}`;
  line.append(ep, ls);
  neuralConsole.appendChild(line);
  neuralConsole.scrollTop = neuralConsole.scrollHeight;
}

async function ensureNeural(a) {
  if (neuralCache.has(a.id)) return neuralCache.get(a.id);
  if (!a.neural?.trained) return null;
  const model = await loadModel(a.id);
  const vocab = vocabFromJSON(a.neural.vocabJSON);
  if (!model || !vocab) return null;
  const entry = { model, vocab };
  neuralCache.set(a.id, entry);
  return entry;
}

trainBtn.addEventListener('click', async () => {
  const a = active();
  if (a.chunkCount === 0) { toast('add chunks first', true); return; }
  if (!window.tf) { toast('TensorFlow.js not loaded — check your connection', true); return; }
  const epochs = +epSlider.value, lstmUnits = +huSlider.value, seqLen = +slSlider.value;
  trainBtn.disabled = true;
  resetNeuralBtn.disabled = true;
  trainBtn.textContent = 'training…';
  neuralProgress.classList.add('is-running');
  neuralConsole.replaceChildren();
  neuralConsole.hidden = false;

  try {
    const text = await corpusFor(a);
    const vocab = buildVocab(text);
    if (vocab.vocabSize > 200) {
      // Very rare on natural text — char-level is bounded
      toast(`large vocab (${vocab.vocabSize}) — training will be slow`);
    }
    const model = buildModel({ vocabSize: vocab.vocabSize, embedDim: 24, lstmUnits });
    const params = model.countParams();
    neuralProgress.textContent = `compiled · ${params} params · ${text.length} chars · ${vocab.vocabSize} symbols`;

    let finalLoss = NaN;
    await trainModel(model, text, vocab, { epochs, seqLen, batchSize: 32, stride: 3 }, async (epoch, loss) => {
      finalLoss = loss;
      logEpoch(epoch, epochs, loss);
      neuralProgress.textContent = `epoch ${epoch}/${epochs} · loss ${loss.toFixed(3)}`;
    });

    await saveModel(model, a.id);
    neuralCache.set(a.id, { model, vocab });
    a.neural = {
      trained: true,
      epochs, lstmUnits, seqLen,
      vocabSize: vocab.vocabSize,
      params,
      finalLoss,
      vocabJSON: vocabToJSON(vocab),
      trainedAt: Date.now()
    };
    save(); renderAll();
    neuralProgress.textContent = `done · loss ${finalLoss.toFixed(3)}`;
    toast(`neural net trained · loss ${finalLoss.toFixed(3)}`);
  } catch (err) {
    console.error(err);
    toast(err.message || 'training failed', true);
    neuralProgress.textContent = 'failed';
  } finally {
    trainBtn.disabled = false;
    resetNeuralBtn.disabled = false;
    trainBtn.textContent = '▶ train neural net';
    neuralProgress.classList.remove('is-running');
  }
});

resetNeuralBtn.addEventListener('click', async () => {
  const a = active();
  if (!a.neural?.trained && !neuralCache.has(a.id)) { toast('no model to reset'); return; }
  if (!confirm('Delete this agent\'s trained neural model?')) return;
  await deleteModel(a.id);
  neuralCache.delete(a.id);
  a.neural = null;
  save(); renderAll();
  neuralConsole.replaceChildren();
  neuralConsole.hidden = true;
  neuralProgress.textContent = '';
  toast('model deleted');
});

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
  if (!a.chunkCount) { toast('add at least one seed chunk first', true); return; }
  const btn = $('synthBtn');
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'synthesizing…';
  try {
    const allChunks = await getChunks(a.id);
    const seedTxt = allChunks.slice(0, 8).map(c => `[${c.title}]\n${c.text}`).join('\n\n---\n\n').slice(0, 8000);
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
$('exportAgent').addEventListener('click', async () => {
  const a = active();
  const chunks = await getChunks(a.id);
  const bundle = { ...a, chunks };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
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
    const allChunks = await getChunks(a.id);
    const hits = retrieveChunks(allChunks, msg, 6);
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
  } else if (a.mode === 'neural') {
    const entry = await ensureNeural(a);
    if (!entry) throw new Error('no trained model — click train in the Training tab');
    const length = Math.min(220, Math.max(60, a.maxTokens * 3));
    const seed = msg.slice(-80);
    const raw = await sample(entry.model, seed, length, a.temperature, entry.vocab);
    return applyVoice(raw.trim(), a.voice);
  } else {
    if (!a.chunkCount) throw new Error('no training data — add chunks first');
    const localChunks = await getChunks(a.id);

    // 1. Retrieval first: if the user's message strongly matches a chunk, surface it directly.
    const scored = retrieveScored(localChunks, msg, 5);
    if (scored.length) {
      const top = scored[0];
      const answer = extractAnswer(top.chunk.text);
      // Q&A chunk with a decent match → return the A: body verbatim.
      if (answer && top.score >= 0.4) {
        return applyVoice(answer, a.voice);
      }
      // Plain chunk with a very strong match → return it as the response.
      if (!answer && top.score >= 1.2) {
        return applyVoice(top.chunk.text.trim(), a.voice);
      }
    }

    // 2. Focused Markov: train on the retrieved subset for relevance, fall back to the full corpus.
    const focus = scored.filter(x => x.score > 0).map(x => x.chunk);
    const useChunks = focus.length >= 2 ? focus : localChunks;
    let model = buildMarkov(useChunks, a.ngram);
    let raw = generateMarkov(model, msg, a.maxTokens, a.temperature);
    if (!raw && useChunks !== localChunks) {
      model = buildMarkov(localChunks, a.ngram);
      raw = generateMarkov(model, msg, a.maxTokens, a.temperature);
    }
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
(async () => {
  // One-time migration: any chunks still living on the agent objects
  // (from pre-IDB versions) move into IndexedDB. Idempotent.
  try {
    const moved = await moveLegacyChunksToDB(state, db.addChunksBatch);
    if (moved) { save(); toast(`migrated chunks for ${moved} agent${moved > 1 ? 's' : ''} to IndexedDB`); }
  } catch (err) {
    console.error('migration failed', err);
  }
  // Refresh counts from IDB for every agent so the sidebar shows true totals.
  for (const a of state.agents) {
    try { await refreshCounts(a.id); } catch {}
  }
  await renderAll();
})();
