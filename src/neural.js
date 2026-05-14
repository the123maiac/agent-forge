/* Char-level RNN trained in the browser via TensorFlow.js.
   Real neural network: embedding → LSTM → time-distributed softmax,
   trained with backprop on the agent's chunks. */

const SPECIALS = ['<PAD>', '<UNK>'];

export function buildVocab(text) {
  const set = new Set();
  for (const ch of text) set.add(ch);
  const list = [...SPECIALS, ...[...set].sort()];
  const charToIdx = new Map(list.map((c, i) => [c, i]));
  return { charToIdx, idxToChar: list, vocabSize: list.length };
}

function encode(text, vocab) {
  const unk = vocab.charToIdx.get('<UNK>');
  const out = new Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const idx = vocab.charToIdx.get(text[i]);
    out[i] = idx == null ? unk : idx;
  }
  return out;
}

export function buildModel({ vocabSize, embedDim = 24, lstmUnits = 96 }) {
  const tf = window.tf;
  const model = tf.sequential();
  model.add(tf.layers.embedding({ inputDim: vocabSize, outputDim: embedDim, maskZero: false }));
  model.add(tf.layers.lstm({ units: lstmUnits, returnSequences: true, recurrentInitializer: 'glorotNormal' }));
  // A Dense applied to a rank-3 tensor operates on the last dim → [batch, seq, vocab] logits.
  model.add(tf.layers.dense({ units: vocabSize, activation: 'softmax' }));
  model.compile({
    optimizer: tf.train.adam(0.005),
    loss: 'categoricalCrossentropy'
  });
  return model;
}

export async function trainModel(model, text, vocab, opts, onEpochEnd) {
  const tf = window.tf;
  const { epochs = 20, seqLen = 60, batchSize = 32, stride = 3 } = opts;
  if (text.length < seqLen + 2) throw new Error('not enough text — add more chunks');
  const encoded = encode(text, vocab);

  const Xs = [], Ys = [];
  for (let i = 0; i + seqLen + 1 <= encoded.length; i += stride) {
    Xs.push(encoded.slice(i, i + seqLen));
    Ys.push(encoded.slice(i + 1, i + seqLen + 1));
  }
  if (!Xs.length) throw new Error('corpus too small for chosen sequence length');

  const xs = tf.tensor2d(Xs, [Xs.length, seqLen], 'int32');
  // One-hot encode targets to rank-3 [batch, seq, vocab] so the softmax output's
  // shape matches and categoricalCrossentropy can score it directly.
  const ysIdx = tf.tensor2d(Ys, [Ys.length, seqLen], 'int32');
  const ys = tf.tidy(() => tf.oneHot(ysIdx, vocab.vocabSize));
  ysIdx.dispose();

  try {
    await model.fit(xs, ys, {
      epochs, batchSize, shuffle: true,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          await onEpochEnd?.(epoch + 1, logs.loss);
          await tf.nextFrame();
        }
      }
    });
  } finally {
    xs.dispose();
    ys.dispose();
  }
  return { examples: Xs.length };
}

export async function sample(model, seed, length, temperature, vocab) {
  const tf = window.tf;
  const unk = vocab.charToIdx.get('<UNK>');
  let buf = seed && seed.length ? seed : ' ';
  let context = buf.split('').map(ch => vocab.charToIdx.get(ch) ?? unk);
  const MAX_CONTEXT = 160;

  let out = '';
  for (let i = 0; i < length; i++) {
    const trimmed = context.slice(-MAX_CONTEXT);
    const next = tf.tidy(() => {
      const input = tf.tensor2d([trimmed], [1, trimmed.length], 'int32');
      const probs = model.predict(input); // [1, seq, vocab] softmax probabilities
      const last = probs.slice([0, trimmed.length - 1, 0], [1, 1, vocab.vocabSize]).reshape([vocab.vocabSize]);
      // Sample with temperature: log-probs / T treated as logits for multinomial.
      const logits = last.clipByValue(1e-9, 1).log().div(Math.max(0.05, temperature));
      return tf.multinomial(logits, 1).asScalar();
    });
    const idx = (await next.data())[0];
    next.dispose();
    const ch = vocab.idxToChar[idx] || '';
    out += ch;
    context.push(idx);
    if (context.length > MAX_CONTEXT * 2) context = context.slice(-MAX_CONTEXT);
    // Early stop on a natural break after some output
    if (out.length > 30 && /[.!?]\s*$/.test(out) && Math.random() < 0.25) break;
  }
  return out;
}

/* IndexedDB persistence via tf.js native I/O */
export async function saveModel(model, agentId) {
  return model.save(`indexeddb://forge-neural-${agentId}`);
}
export async function loadModel(agentId) {
  const tf = window.tf;
  try {
    return await tf.loadLayersModel(`indexeddb://forge-neural-${agentId}`);
  } catch {
    return null;
  }
}
export async function deleteModel(agentId) {
  const tf = window.tf;
  try { await tf.io.removeModel(`indexeddb://forge-neural-${agentId}`); } catch {}
}

/* Vocab is small enough to keep in localStorage alongside agent state. */
export function vocabToJSON(vocab) {
  return { idxToChar: vocab.idxToChar };
}
export function vocabFromJSON(json) {
  if (!json || !Array.isArray(json.idxToChar)) return null;
  return {
    idxToChar: json.idxToChar,
    charToIdx: new Map(json.idxToChar.map((c, i) => [c, i])),
    vocabSize: json.idxToChar.length
  };
}

/* Shipped base model: pretrained offline with scripts/train-base.js,
   downloaded once and cached by the browser. Shared across every agent. */
let baseModelCache = null;
export async function loadBaseModel(baseUrl = './public/models/base') {
  if (baseModelCache) return baseModelCache;
  const tf = window.tf;
  const candidates = [baseUrl, './models/base'];
  let lastErr;
  for (const root of candidates) {
    try {
      const [model, vocabJson, metaJson] = await Promise.all([
        tf.loadLayersModel(`${root}/model.json`),
        fetch(`${root}/vocab.json`).then(r => r.json()),
        fetch(`${root}/meta.json`).then(r => r.json())
      ]);
      const vocab = vocabFromJSON(vocabJson);
      baseModelCache = { model, vocab, meta: metaJson };
      return baseModelCache;
    } catch (err) { lastErr = err; }
  }
  throw lastErr || new Error('base model not found');
}

export function getBaseModel() { return baseModelCache; }

/* Fine-tune the base model on per-agent text. Re-compiles to make the
   weights trainable in the browser session, runs continued training on
   the user's corpus. The base weights are the starting point, so even a
   couple of epochs nudges the model toward the user's domain. */
export async function fineTuneFromBase(text, { epochs = 5, seqLen = 60, batchSize = 32, stride = 3 }, onEpochEnd) {
  const tf = window.tf;
  if (!baseModelCache) throw new Error('base model not loaded');
  const { model, vocab } = baseModelCache;
  // Re-compile so subsequent .fit() actually runs.
  model.compile({ optimizer: tf.train.adam(0.001), loss: 'categoricalCrossentropy' });
  if (text.length < seqLen + 2) throw new Error('not enough text — add more chunks');

  const unk = vocab.charToIdx.get('<UNK>');
  const encoded = new Array(text.length);
  for (let i = 0; i < text.length; i++) encoded[i] = vocab.charToIdx.get(text[i]) ?? unk;

  const Xs = [], Ys = [];
  for (let i = 0; i + seqLen + 1 <= encoded.length; i += stride) {
    Xs.push(encoded.slice(i, i + seqLen));
    Ys.push(encoded.slice(i + 1, i + seqLen + 1));
  }
  if (!Xs.length) throw new Error('corpus too small for chosen sequence length');

  const xs = tf.tensor2d(Xs, [Xs.length, seqLen], 'int32');
  const ysIdx = tf.tensor2d(Ys, [Ys.length, seqLen], 'int32');
  const ys = tf.tidy(() => tf.oneHot(ysIdx, vocab.vocabSize));
  ysIdx.dispose();
  try {
    await model.fit(xs, ys, {
      epochs, batchSize, shuffle: true,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          await onEpochEnd?.(epoch + 1, logs.loss);
          await tf.nextFrame();
        }
      }
    });
  } finally {
    xs.dispose(); ys.dispose();
  }
  return { examples: Xs.length };
}
