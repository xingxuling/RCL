import path from 'node:path';
import {
  assertArray, assertFiniteNumber, assertObject, assertText, atomicDirectory,
  artifactManifest, escapeHtml, identifier, receipt, writeJson, writeText,
} from './common.mjs';
import { runReality } from '../index.mjs';
import { runAuthorizedProvider } from './rcl-driver.mjs';

export const NEURO_FORGE_VERSION = '0.1.0-alpha.1';

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function sigmoid(value) { return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value)))); }
function tanh(value) { return Math.tanh(value); }
function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }

export function validateNeuroBlueprint(input) {
  const blueprint = structuredClone(assertObject(input, 'neural blueprint'));
  blueprint.name = assertText(blueprint.name, 'name', { max: 120 });
  blueprint.model = assertObject(blueprint.model ?? {}, 'model');
  blueprint.model.inputSize = Math.round(assertFiniteNumber(blueprint.model.inputSize, 'model.inputSize', { min: 1, max: 64 }));
  blueprint.model.hiddenSize = Math.round(assertFiniteNumber(blueprint.model.hiddenSize ?? 4, 'model.hiddenSize', { min: 1, max: 256 }));
  blueprint.model.outputSize = Math.round(assertFiniteNumber(blueprint.model.outputSize, 'model.outputSize', { min: 1, max: 32 }));
  blueprint.training = assertObject(blueprint.training ?? {}, 'training');
  blueprint.training.epochs = Math.round(assertFiniteNumber(blueprint.training.epochs ?? 4000, 'training.epochs', { min: 1, max: 50000 }));
  blueprint.training.learningRate = assertFiniteNumber(blueprint.training.learningRate ?? 0.3, 'training.learningRate', { min: 0.00001, max: 2 });
  blueprint.training.seed = Math.round(assertFiniteNumber(blueprint.training.seed ?? 42, 'training.seed', { min: 0, max: 0xffffffff }));
  blueprint.training.logEvery = Math.max(1, Math.round(assertFiniteNumber(blueprint.training.logEvery ?? Math.max(1, blueprint.training.epochs / 20), 'training.logEvery', { min: 1, max: 10000 })));
  blueprint.deployment = assertObject(blueprint.deployment ?? {}, 'deployment');
  blueprint.deployment.minAccuracy = assertFiniteNumber(blueprint.deployment.minAccuracy ?? 0.95, 'deployment.minAccuracy', { min: 0, max: 1 });
  blueprint.dataset = assertArray(blueprint.dataset, 'dataset', { min: 2 }).map((row, index) => {
    const item = assertObject(row, `dataset[${index}]`);
    item.input = assertArray(item.input, `dataset[${index}].input`, { min: blueprint.model.inputSize }).map((value, i) => assertFiniteNumber(value, `dataset[${index}].input[${i}]`, { min: -100000, max: 100000 })).slice(0, blueprint.model.inputSize);
    item.target = assertArray(item.target, `dataset[${index}].target`, { min: blueprint.model.outputSize }).map((value, i) => assertFiniteNumber(value, `dataset[${index}].target[${i}]`, { min: 0, max: 1 })).slice(0, blueprint.model.outputSize);
    return item;
  });
  const operationBudget = blueprint.training.epochs * blueprint.dataset.length *
    ((blueprint.model.inputSize * blueprint.model.hiddenSize) + (blueprint.model.hiddenSize * blueprint.model.outputSize));
  if (operationBudget > 50_000_000) {
    throw new Error(`Neural blueprint exceeds the v0.1 operation budget: ${operationBudget.toLocaleString()} > 50,000,000`);
  }
  return blueprint;
}

function randomMatrix(rows, cols, random, scale) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => (random() * 2 - 1) * scale));
}

function createModel(blueprint) {
  const random = mulberry32(blueprint.training.seed);
  const inputScale = Math.sqrt(2 / blueprint.model.inputSize);
  const hiddenScale = Math.sqrt(2 / blueprint.model.hiddenSize);
  return {
    format: 'rcl.neuro-forge.mlp.v0.1',
    name: blueprint.name,
    inputSize: blueprint.model.inputSize,
    hiddenSize: blueprint.model.hiddenSize,
    outputSize: blueprint.model.outputSize,
    activation: 'tanh+sigmoid',
    weights1: randomMatrix(blueprint.model.hiddenSize, blueprint.model.inputSize, random, inputScale),
    bias1: Array(blueprint.model.hiddenSize).fill(0),
    weights2: randomMatrix(blueprint.model.outputSize, blueprint.model.hiddenSize, random, hiddenScale),
    bias2: Array(blueprint.model.outputSize).fill(0),
  };
}

export function predict(model, input) {
  const hidden = model.weights1.map((row, h) => tanh(row.reduce((sum, weight, i) => sum + weight * input[i], model.bias1[h])));
  const output = model.weights2.map((row, o) => sigmoid(row.reduce((sum, weight, h) => sum + weight * hidden[h], model.bias2[o])));
  return { hidden, output };
}

function evaluate(model, dataset) {
  let loss = 0;
  let correct = 0;
  const predictions = dataset.map((row, index) => {
    const output = predict(model, row.input).output;
    for (let o = 0; o < output.length; o += 1) {
      const p = clamp(output[o], 1e-9, 1 - 1e-9);
      loss += -(row.target[o] * Math.log(p) + (1 - row.target[o]) * Math.log(1 - p));
    }
    const predicted = output.map(value => value >= 0.5 ? 1 : 0);
    const exact = predicted.every((value, i) => value === Math.round(row.target[i]));
    if (exact) correct += 1;
    return { index, input: row.input, target: row.target, output, predicted, correct: exact };
  });
  return { loss: loss / (dataset.length * model.outputSize), accuracy: correct / dataset.length, predictions };
}

export function trainMlp(blueprintInput) {
  const blueprint = validateNeuroBlueprint(blueprintInput);
  const model = createModel(blueprint);
  const history = [];
  const n = blueprint.dataset.length;
  for (let epoch = 1; epoch <= blueprint.training.epochs; epoch += 1) {
    const gradW1 = Array.from({ length: model.hiddenSize }, () => Array(model.inputSize).fill(0));
    const gradB1 = Array(model.hiddenSize).fill(0);
    const gradW2 = Array.from({ length: model.outputSize }, () => Array(model.hiddenSize).fill(0));
    const gradB2 = Array(model.outputSize).fill(0);

    for (const row of blueprint.dataset) {
      const { hidden, output } = predict(model, row.input);
      const delta2 = output.map((value, o) => value - row.target[o]);
      for (let o = 0; o < model.outputSize; o += 1) {
        gradB2[o] += delta2[o];
        for (let h = 0; h < model.hiddenSize; h += 1) gradW2[o][h] += delta2[o] * hidden[h];
      }
      const delta1 = Array(model.hiddenSize).fill(0);
      for (let h = 0; h < model.hiddenSize; h += 1) {
        let propagated = 0;
        for (let o = 0; o < model.outputSize; o += 1) propagated += model.weights2[o][h] * delta2[o];
        delta1[h] = propagated * (1 - hidden[h] * hidden[h]);
        gradB1[h] += delta1[h];
        for (let i = 0; i < model.inputSize; i += 1) gradW1[h][i] += delta1[h] * row.input[i];
      }
    }

    const rate = blueprint.training.learningRate / n;
    for (let h = 0; h < model.hiddenSize; h += 1) {
      model.bias1[h] -= rate * gradB1[h];
      for (let i = 0; i < model.inputSize; i += 1) model.weights1[h][i] -= rate * gradW1[h][i];
    }
    for (let o = 0; o < model.outputSize; o += 1) {
      model.bias2[o] -= rate * gradB2[o];
      for (let h = 0; h < model.hiddenSize; h += 1) model.weights2[o][h] -= rate * gradW2[o][h];
    }

    if (epoch === 1 || epoch === blueprint.training.epochs || epoch % blueprint.training.logEvery === 0) {
      const metrics = evaluate(model, blueprint.dataset);
      history.push({ epoch, loss: metrics.loss, accuracy: metrics.accuracy });
    }
  }
  const metrics = evaluate(model, blueprint.dataset);
  return { blueprint, model, metrics, history };
}

function deploymentGateSource(blueprint, metrics) {
  const reality = identifier(`${blueprint.name}_DeploymentGate`, 'NeuroDeploymentGate');
  const accuracy = metrics.accuracy.toFixed(12);
  const loss = metrics.loss.toFixed(12);
  const threshold = blueprint.deployment.minAccuracy.toFixed(12);
  return `# Neural fitting is a Provider result. RCL decides whether that result may become deployed reality.
reality ${reality} {
  facet model.accuracy : Number = ${accuracy}
  facet model.loss : Number = ${loss}
  facet model.deployed : Truth = false

  subject evaluator {
    warrant model.deploy on model
  }

  neural trained_model {
    facet signal : Number = model.accuracy
    facet gate : Number = 0
    pathway qualification {
      when trained_model.signal >= ${threshold}
      transmit trained_model.gate <- trained_model.signal
      preserve trained_model.gate >= ${threshold}
      witness "neural:qualification-signal"
    }
  }

  quantitative metrics {
    measure accuracy : Number = model.accuracy
      uncertainty 0
      confidence 1
      scale ratio
      evidence "neuro-forge:evaluation"
    derive qualified : Truth = measure_value(metrics.accuracy) >= ${threshold}
    preserve confidence(metrics.accuracy) >= 0.99
    preserve metrics.qualified
  }

  knowledge assessment {
    claim deployment_ready : Truth = model.accuracy >= ${threshold}
      confidence 1
      evidence "neuro-forge:dataset-evaluation"
      source "deterministic-mlp-trainer"
      scope "model"
      status observed
    preserve supported(assessment.deployment_ready, 0.99)
  }

  science validation {
    hypothesis qualified : Truth = model.accuracy >= ${threshold}
      confidence 1
      evidence "hypothesis:accuracy-threshold"
    experiment replay tests qualified
      repeats 3
      tolerance 0
      method "deterministic-seed-replay"
      evidence "experiment:training-replay"
    conclude accepted from qualified
      confidence 1
      evidence "conclusion:model-qualified"
    preserve reproducible(validation.replay)
    preserve scientific_value(validation.accepted) == true
  }

  emergence deploy {
    cause evaluator
    when knowledge_value(assessment.deployment_ready) and trained_model.gate >= ${threshold}
    needs model.deploy on model
    alter model.deployed <- true
    preserve model.accuracy >= ${threshold}
    witness "neuro-forge:deployment-gate"
  }

  propagate trained_model steps 1
  quantify metrics
  learn assessment
  investigate validation
  foresee deploy
  realize deploy
}`;
}

function reportHtml(training, deployment) {
  const rows = training.metrics.predictions.map(item => `<tr><td>${item.input.join(', ')}</td><td>${item.target.join(', ')}</td><td>${item.output.map(value => value.toFixed(4)).join(', ')}</td><td>${item.correct ? '✓' : '✕'}</td></tr>`).join('');
  const history = training.history.map(item => `<li>epoch ${item.epoch}: loss ${item.loss.toFixed(6)}, accuracy ${(item.accuracy * 100).toFixed(1)}%</li>`).join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(training.blueprint.name)}</title><style>body{font:16px system-ui;margin:0;background:#f6f3fa;color:#211a27;padding:24px}main{max-width:900px;margin:auto}.hero,section{background:white;border:1px solid #ded5e5;border-radius:24px;padding:24px;margin:18px 0}h1{font-size:clamp(2rem,7vw,4rem)}.metric{display:flex;gap:20px;flex-wrap:wrap}.metric strong{font-size:2rem}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #eee}code{background:#eee8f2;padding:2px 6px;border-radius:6px}</style><main><div class="hero"><p>RCL NEURO FORGE</p><h1>${escapeHtml(training.blueprint.name)}</h1><div class="metric"><p><strong>${(training.metrics.accuracy * 100).toFixed(1)}%</strong><br>accuracy</p><p><strong>${training.metrics.loss.toFixed(5)}</strong><br>loss</p><p><strong>${deployment.state['model.deployed'] ? 'DEPLOYED' : 'BLOCKED'}</strong><br>RCL gate</p></div></div><section><h2>预测</h2><table><thead><tr><th>输入</th><th>目标</th><th>输出</th><th>结果</th></tr></thead><tbody>${rows}</tbody></table></section><section><h2>训练轨迹</h2><ol>${history}</ol></section><section><h2>结构解释</h2><p>神经网络负责“从样本中长出拟合能力”，RCL负责“这个能力是否有证据、是否满足阈值、是否获准部署”。一个像肌肉，一个像骨架与门禁。</p></section></main></html>`;
}

async function writeNeuroArtifacts(blueprint, root) {
  const training = trainMlp(blueprint);
  writeJson(root, 'blueprint.json', training.blueprint);
  writeJson(root, 'model.json', training.model);
  writeJson(root, 'metrics.json', training.metrics);
  writeJson(root, 'training-history.json', training.history);
  const gateSource = deploymentGateSource(training.blueprint, training.metrics);
  writeText(root, 'deployment-gate.rcl', gateSource);
  const deployment = await runReality(gateSource);
  writeJson(root, 'deployment-run.json', deployment);
  writeText(root, 'report.html', reportHtml(training, deployment));
  return { training, deployment };
}

export async function forgeNeural(input, outputDir) {
  const blueprint = validateNeuroBlueprint(input);
  let finalReceipt;
  await atomicDirectory(outputDir, async temp => {
    let buildResult;
    const authorized = await runAuthorizedProvider({
      realityName: `${blueprint.name} Neuro Forge`,
      subject: 'neural_architect',
      host: 'neuro_forge',
      capability: 'train',
      warrant: 'model.train',
      target: 'forge',
      request: blueprint,
      witness: 'rcl:neuro-forge:authorized-training',
      purpose: 'train_and_verify_neural_model',
      provider: async parsed => {
        const validated = validateNeuroBlueprint(parsed);
        buildResult = await writeNeuroArtifacts(validated, temp);
        const providerManifest = artifactManifest(temp, {
          framework: 'RCL Neuro Forge', version: NEURO_FORGE_VERSION,
          status: buildResult.deployment.state['model.deployed'] ? 'verified' : 'blocked',
          metadata: { name: validated.name, accuracy: buildResult.training.metrics.accuracy, loss: buildResult.training.metrics.loss },
        });
        return receipt({
          framework: 'RCL Neuro Forge', capability: 'model.train', outputDir, manifest: providerManifest,
          details: { accuracy: buildResult.training.metrics.accuracy, deployed: buildResult.deployment.state['model.deployed'] },
        });
      },
    });
    writeText(temp, 'authority.rcl', authorized.source);
    writeJson(temp, 'rcl-run.json', authorized.result);
    const deployed = buildResult.deployment.state['model.deployed'];
    const manifest = artifactManifest(temp, {
      framework: 'RCL Neuro Forge', version: NEURO_FORGE_VERSION,
      status: deployed ? 'verified' : 'blocked',
      metadata: {
        name: blueprint.name,
        accuracy: buildResult.training.metrics.accuracy,
        loss: buildResult.training.metrics.loss,
        deployed,
        executionRoot: authorized.result.stateRoot,
        deploymentRoot: buildResult.deployment.stateRoot,
      },
    });
    writeJson(temp, 'manifest.json', manifest);
    finalReceipt = receipt({
      framework: 'RCL Neuro Forge', capability: 'model.train', outputDir, manifest,
      details: {
        model: path.join(outputDir, 'model.json'),
        report: path.join(outputDir, 'report.html'),
        accuracy: buildResult.training.metrics.accuracy,
        loss: buildResult.training.metrics.loss,
        deployed,
      },
    });
  });
  return finalReceipt;
}
