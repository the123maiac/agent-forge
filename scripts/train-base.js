const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'models', 'base');
const META_PATH = path.join(OUT_DIR, 'meta.json');
const VOCAB_PATH = path.join(OUT_DIR, 'vocab.json');

const EPOCHS = parseInt(process.env.EPOCHS || '18', 10);
const LSTM_UNITS = parseInt(process.env.UNITS || '192', 10);
const EMBED_DIM = parseInt(process.env.EMBED || '48', 10);
const SEQ_LEN = parseInt(process.env.SEQ || '100', 10);
const BATCH_SIZE = parseInt(process.env.BATCH || '128', 10);
const STRIDE = parseInt(process.env.STRIDE || '16', 10);
const MAX_SAMPLES = parseInt(process.env.MAX_SAMPLES || '0', 10);

function loadCorpus() {
  const buf = [];
  const baseFile = path.join(__dirname, '..', 'src', 'baseCorpus.js');
  const dsFile = path.join(__dirname, '..', 'src', 'datasets.js');
  const baseSrc = fs.readFileSync(baseFile, 'utf8');
  for (const m of baseSrc.matchAll(/E\('[^']*',\s*("(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)\s*\)/g)) {
    try { buf.push(JSON.parse(m[1].replace(/^`|`$/g, '"'))); } catch {}
  }
  const dsSrc = fs.readFileSync(dsFile, 'utf8');
  for (const m of dsSrc.matchAll(/text:\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g)) {
    try {
      let s = m[1];
      if (s.startsWith("'")) s = '"' + s.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"';
      buf.push(JSON.parse(s));
    } catch {}
  }
  try {
    for (const f of fs.readdirSync(path.join(__dirname, '..', 'data', 'corpus'))) {
      if (f.endsWith('.txt')) buf.push(fs.readFileSync(path.join(__dirname, '..', 'data', 'corpus', f), 'utf8'));
    }
  } catch {}
  return buf.join('\n\n');
}

const SPECIALS = ['<PAD>', '<UNK>'];
function buildVocab(text) {
  const set = new Set();
  for (const ch of text) set.add(ch);
  const list = [...SPECIALS, ...[...set].sort()];
  return { charToIdx: new Map(list.map((c, i) => [c, i])), idxToChar: list, vocabSize: list.length };
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
  console.log(`corpus: ${text.length.toLocaleString()} chars`);

  const vocab = buildVocab(text);
  console.log(`vocab: ${vocab.vocabSize} symbols`);

  const unk = vocab.charToIdx.get('<UNK>');
  const encoded = new Uint16Array(text.length);
  for (let i = 0; i < text.length; i++) encoded[i] = vocab.charToIdx.get(text[i]) ?? unk;

  let totalSamples = Math.max(0, Math.floor((encoded.length - SEQ_LEN - 1) / STRIDE) + 1);
  if (MAX_SAMPLES > 0 && MAX_SAMPLES < totalSamples) totalSamples = MAX_SAMPLES;
  const stepsPerEpoch = Math.floor(totalSamples / BATCH_SIZE);
  console.log(`samples: ${totalSamples.toLocaleString()} (seqLen=${SEQ_LEN}, stride=${STRIDE})`);
  console.log(`steps per epoch: ${stepsPerEpoch.toLocaleString()}`);

  function makeDataset() {
    return tf.data.generator(function* () {
      const order = new Uint32Array(totalSamples);
      for (let i = 0; i < totalSamples; i++) order[i] = i;
      for (let i = totalSamples - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const x = new Array(SEQ_LEN), y = new Array(SEQ_LEN);
      for (let i = 0; i < totalSamples; i++) {
        const s = order[i] * STRIDE;
        for (let k = 0; k < SEQ_LEN; k++) {
          x[k] = encoded[s + k];
          y[k] = encoded[s + k + 1];
        }
        yield { xs: tf.tensor1d(x, 'int32'), ys: tf.tensor1d(y, 'int32') };
      }
    })
    .batch(BATCH_SIZE)
    .map(({ xs, ys }) => ({ xs, ys: tf.oneHot(ys, vocab.vocabSize) }))
    .prefetch(4);
  }

  const model = buildModel({ vocabSize: vocab.vocabSize, embedDim: EMBED_DIM, lstmUnits: LSTM_UNITS });
  console.log(`model: ${model.countParams().toLocaleString()} params`);
  model.summary(120);

  const t0 = Date.now();
  let lastLoss = NaN;
  await model.fitDataset(makeDataset(), {
    epochs: EPOCHS,
    batchesPerEpoch: stepsPerEpoch,
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        lastLoss = logs.loss;
        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`epoch ${String(epoch + 1).padStart(2)}/${EPOCHS}  loss ${logs.loss.toFixed(4)}  elapsed ${sec}s`);
        // CHECKPOINT EVERY EPOCH — Ctrl+C is now safe.
        await model.save(`file://${OUT_DIR}`);
        fs.writeFileSync(VOCAB_PATH, JSON.stringify({ idxToChar: vocab.idxToChar }));
        fs.writeFileSync(META_PATH, JSON.stringify({
          version: Date.now(), epochs: epoch + 1, embedDim: EMBED_DIM,
          lstmUnits: LSTM_UNITS, seqLen: SEQ_LEN, vocabSize: vocab.vocabSize,
          finalLoss: logs.loss, params: model.countParams(),
          corpusChars: text.length, trainedAt: new Date().toISOString()
        }, null, 2));
      }
    }
  });
  console.log(`\nsaved to ${OUT_DIR}`);
  console.log(`final loss: ${lastLoss.toFixed(4)}`);
  console.log(`elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch(err => { console.error(err); process.exit(1); });
