import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha256 } from '../src/reality-compiler-kernel.mjs';
import {
  ingestIndependentAcquisitionObject,
  ingestIndependentAcquisitionFile,
  runIndependentFileControlPair,
} from '../src/frontier-independent-file-observation.mjs';

const producer = path.resolve('tools/frontier-independent-acquisition/produce-known-timing-dataset.mjs');

function produce(mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-frontier-independent-'));
  const file = path.join(dir, `${mode}.json`);
  const run = spawnSync(process.execPath, [producer, file, mode], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.equal(fs.existsSync(file), true);
  return { dir, file, payload: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

test('separate producer creates a preexisting interaction file that RCL later detects', () => {
  const produced = produce('interaction');
  const result = ingestIndependentAcquisitionFile(produced.file);
  assert.equal(result.ok, true);
  assert.equal(result.detected, true);
  assert.equal(result.modelWinner, 'H_interaction');
  assert.notEqual(result.producerProcessId, process.pid);
  assert.equal(result.dataProducedBeforeRclRead, true);
  assert.equal(result.externalRealityVerified, false);
});

test('separate producer additive control is not promoted to interaction', () => {
  const produced = produce('additive');
  const result = ingestIndependentAcquisitionFile(produced.file);
  assert.equal(result.ok, true);
  assert.equal(result.detected, false);
  assert.ok(result.modelWinner);
});

test('pair gate requires interaction detection and additive rejection', () => {
  const interaction = produce('interaction');
  const additive = produce('additive');
  const result = runIndependentFileControlPair(interaction.file, additive.file);
  assert.equal(result.ok, true);
  assert.equal(result.interactionWinner, 'H_interaction');
  assert.equal(result.additiveRejectedAsInteraction, true);
  assert.ok(result.additiveWinner);
  assert.equal(result.producerProcessesDifferFromIntake, true);
});

test('tampered independent file root is rejected before contract intake', () => {
  const produced = produce('interaction');
  produced.payload.rows[0].response += 1;
  const result = ingestIndependentAcquisitionObject(produced.payload);
  assert.equal(result.ok, false);
  assert.ok(result.validation.failures.includes('independent_file_root_mismatch'));
});

test('same-process or RCL-importing producer declaration is rejected', () => {
  const produced = produce('interaction');
  const sameProcess = structuredClone(produced.payload);
  sameProcess.producer.processId = process.pid;
  sameProcess.fileRoot = sha256({ ...sameProcess, fileRoot: undefined });
  let result = ingestIndependentAcquisitionObject(sameProcess);
  assert.equal(result.ok, false);
  assert.ok(result.validation.failures.includes('producer_process_must_differ_from_rcl_intake_process'));

  const importsRcl = structuredClone(produced.payload);
  importsRcl.producer.importsRcl = true;
  importsRcl.fileRoot = sha256({ ...importsRcl, fileRoot: undefined });
  result = ingestIndependentAcquisitionObject(importsRcl);
  assert.equal(result.ok, false);
  assert.ok(result.validation.failures.includes('producer_must_declare_no_rcl_imports'));
});
