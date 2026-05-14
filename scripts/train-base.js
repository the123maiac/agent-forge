/* Offline training pipeline.
   Runs in Node using @tensorflow/tfjs-node (native TF, much faster than the
   browser build), trains a char-level LSTM on the assembled base corpus,
   and saves the weights to ../public/models/base/ so the browser app can
   fetch them at startup without any local training.

   Run: `node scripts/train-base.js`
*/

const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'models', 'base');
const META_PATH = path.join(OUT_DIR, 'meta.json');
const VOCAB_PATH = path.join(OUT_DIR, 'vocab.json');

const EPOCHS = parseInt(process.env.EPOCHS || '25', 10);
const LSTM_UNITS = parseInt(process.env.UNITS || '128', 10);
const EMBED_DIM = parseInt(process.env.EMBED || '32', 10);
const SEQ_LEN = parseInt(process.env.SEQ || '80', 10);
const BATCH_SIZE = parseInt(process.env.BATCH || '64', 10);
const STRIDE = parseInt(process.env.STRIDE || '3', 10);

/* Pull text from the same source the browser ships, so what the model
   learns matches what the user sees in retrieval. */
function loadCorpus() {
  const buf = [];
  const baseFile = path.join(__dirname, '..', 'src', 'baseCorpus.js');
  const dsFile = path.join(__dirname, '..', 'src', 'datasets.js');
  // baseCorpus.js — extract E('title', 'text') literals.
  const baseSrc = fs.readFileSync(baseFile, 'utf8');
  for (const m of baseSrc.matchAll(/E\('[^']*',\s*("(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)\s*\)/g)) {
    try { buf.push(JSON.parse(m[1].replace(/^`|`$/g, '"'))); } catch {}
  }
  // datasets.js — extract `text: '...'` and `text: "..."` literals.
  const dsSrc = fs.readFileSync(dsFile, 'utf8');
  for (const m of dsSrc.matchAll(/text:\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g)) {
    try {
      // Convert single-quoted JS literal to JSON-safe.
      let s = m[1];
      if (s.startsWith("'")) s = '"' + s.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"';
      buf.push(JSON.parse(s));
    } catch {}
  }
  return buf.join('\n\n');
}

const SPECIALS = ['<PAD>', '<UNK>'];
function buildVocab(text) {
  const set = new Set();
  for (const ch of text) set.add(ch);
  const list = [...SPECIALS, ...[...set].sort()];
  const charToIdx = new Map(list.map((c, i) => [c, i]));
  return { charToIdx, idxToChar: list, vocabSize: list.length };
}

function buildModel({ vocabSize, embedDim, lstmUnits }) {
  const model = tf.sequential();
  model.add(tf.layers.embedding({ inputDim: vocabSize, outputDim: embedDim }));
  model.add(tf.layers.lstm({ units: lstmUnits, returnSequences: true, recurrentInitializer: 'glorotNormal' }));
  model.add(tf.layers.dense({ units: vocabSize, activation: 'softmax' }));
  model.compile({ optimizer: tf.train.adam(0.003), loss: 'categoricalCrossentropy' });
  return model;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const text = loadCorpus();
  console.log(`corpus: ${text.length} chars`);

  const vocab = buildVocab(text);
  console.log(`vocab: ${vocab.vocabSize} symbols`);

  // Encode the corpus to a Uint16 array of indices once.
  const unk = vocab.charToIdx.get('<UNK>');
  const encoded = new Uint16Array(text.length);
  for (let i = 0; i < text.length; i++) {
    encoded[i] = vocab.charToIdx.get(text[i]) ?? unk;
  }

  // Build sliding-window training samples.
  const samples = Math.max(0, Math.floor((encoded.length - SEQ_LEN - 1) / STRIDE) + 1);
  console.log(`samples: ${samples} (seqLen=${SEQ_LEN}, stride=${STRIDE})`);

  const Xs = new Int32Array(samples * SEQ_LEN);
  const Ys = new Int32Array(samples * SEQ_LEN);
  for (let s = 0, off = 0; s < samples; s++, off += SEQ_LEN) {
    const start = s * STRIDE;
    for (let k = 0; k < SEQ_LEN; k++) {
      Xs[off + k] = encoded[start + k];
      Ys[off + k] = encoded[start + k + 1];
    }
  }

  const xs = tf.tensor2d(Xs, [samples, SEQ_LEN], 'int32');
  const yIdx = tf.tensor2d(Ys, [samples, SEQ_LEN], 'int32');
  const ys = tf.oneHot(yIdx, vocab.vocabSize);
  yIdx.dispose();

  const model = buildModel({ vocabSize: vocab.vocabSize, embedDim: EMBED_DIM, lstmUnits: LSTM_UNITS });
  console.log(`model: ${model.countParams()} params`);
  model.summary(120);

  const t0 = Date.now();
  const history = await model.fit(xs, ys, {
    epochs: EPOCHS,
    batchSize: BATCH_SIZE,
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`epoch ${String(epoch + 1).padStart(2)}/${EPOCHS}  loss ${logs.loss.toFixed(4)}  elapsed ${sec}s`);
      }
    }
  });
  xs.dispose(); ys.dispose();

  const finalLoss = history.history.loss[history.history.loss.length - 1];

  await model.save(`file://${OUT_DIR}`);
  fs.writeFileSync(VOCAB_PATH, JSON.stringify({ idxToChar: vocab.idxToChar }));
  fs.writeFileSync(META_PATH, JSON.stringify({
    version: Date.now(),
    epochs: EPOCHS,
    embedDim: EMBED_DIM,
    lstmUnits: LSTM_UNITS,
    seqLen: SEQ_LEN,
    vocabSize: vocab.vocabSize,
    finalLoss,
    params: model.countParams(),
    corpusChars: text.length,
    trainedAt: new Date().toISOString()
  }, null, 2));

  console.log(`\nsaved to ${OUT_DIR}`);
  console.log(`final loss: ${finalLoss.toFixed(4)}`);
  console.log(`elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
