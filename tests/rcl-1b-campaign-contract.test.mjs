import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'native-ai', 'rcl-1b-campaign-contract.v0.1.json'), 'utf8'));

test('RCL-1B campaign freezes a genuine randomly initialized ~1B target', () => {
  assert.equal(contract.status, 'NORTH_STAR_FROZEN');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.milestone, 'RCL_1B_V1_RELEASE_CANDIDATE');
  assert.equal(contract.target.initialization, 'random');
  assert.equal(contract.target.layers, 24);
  assert.equal(contract.target.hiddenSize, 2048);
  assert.equal(contract.target.attentionHeads, 16);
  assert.equal(contract.target.kvHeads, 4);
  assert.equal(contract.target.contextLength, 8192);
  assert.equal(contract.target.trainingPrecisionTarget, 'bf16');
  assert.equal(contract.target.optimizer, 'adamw');
});

test('RCL-1B scale ladder cannot terminate at a rehearsal rung', () => {
  assert.deepEqual(contract.scaleLadder.map((item) => item.id), ['RCL-10M', 'RCL-100M', 'RCL-300M', 'RCL-1B']);
  assert.equal(contract.scaleLadder.at(-1).role, 'final-first-generation-model');
  assert.ok(contract.antiCheating.includes('NO_EARLY_SCALE_RUNG_RELABELED_AS_FINAL'));
});

test('RCL-1B requires the missing scale organs before 10M promotion', () => {
  const required = new Set(contract.pre10MGates);
  for (const gate of [
    'GENERAL_TOKENIZER_ARTIFACT',
    'POSITIONAL_GENOME',
    'MULTI_HEAD_OR_GQA',
    'MULTI_BLOCK_PARAMETRIC_MODEL',
    'TENSOR_ADAMW',
    'ACCELERATOR_BACKEND',
    'MIXED_PRECISION',
    'DATASET_PROVENANCE_PIPELINE',
    'CHECKPOINT_LINEAGE',
    'EVALUATION_BASELINE',
  ]) assert.equal(required.has(gate), true, `missing gate ${gate}`);
});

test('RCL-1B contract does not claim the model already exists', () => {
  assert.ok(contract.claimsNotGranted.includes('1B_MODEL_ALREADY_TRAINED'));
  assert.ok(contract.claimsNotGranted.includes('GPU_BACKEND_ALREADY_VERIFIED'));
  assert.ok(contract.antiCheating.includes('NO_THIRD_PARTY_CHECKPOINT_AS_INITIAL_MODEL'));
  assert.ok(contract.antiCheating.includes('NO_SILENT_FRAMEWORK_SEMANTIC_OWNER'));
});
