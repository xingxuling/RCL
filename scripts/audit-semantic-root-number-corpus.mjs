#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runRealityNative, RCLNativeVMError } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, 'output', 'semantic-state-root-number-corpus');
const outputPath = path.join(outputDir, 'report.json');

const cases = [
  ['zero', '0'],
  ['negative-zero', '-0'],
  ['one-tenth', '0.1'],
  ['binary-rounding', '0.30000000000000004'],
  ['fifteen-significant', '1.23456789012345'],
  ['seventeen-significant', '1.2345678901234567'],
  ['max-safe-integer', '9007199254740991'],
  ['max-safe-minus-one', '9007199254740990'],
  ['large-decimal', '1234567890123456'],
  ['small-decimal', '0.000000000000001'],
];

const records = [];
for (const [id, literal] of cases) {
  const source = `reality NumericRoot_${id.replaceAll('-', '_')} {\n  facet corpus.value : Number = ${literal}\n}`;
  try {
    const result = runRealityNative(source, { requireNativeStateRoot: true });
    records.push({
      id,
      literal,
      status: 'parity',
      value: result.state['corpus.value'],
      stateRoot: result.stateRoot,
      nativeStateRoot: result.nativeStateRoot,
      semanticStateRoot: result.semanticStateRoot,
    });
  } catch (error) {
    records.push({
      id,
      literal,
      status: 'mismatch',
      code: error instanceof RCLNativeVMError ? error.code : error?.code ?? 'UNKNOWN',
      message: error instanceof Error ? error.message : String(error),
      details: error?.details ?? null,
    });
  }
}

const mismatches = records.filter(record => record.status !== 'parity');
const report = {
  format: 'rcl.semantic-state-root-number-corpus.v1',
  algorithmUnderAudit: 'rcl.semantic-state-root.v1',
  admittedSurface: 'RCL Number literals accepted by the current compiler and executed by the current native VM',
  conclusion: mismatches.length === 0
    ? 'NO_MISMATCH_OBSERVED_IN_CORPUS'
    : 'V1_NUMBER_SERIALIZATION_NOT_PROVEN_OVER_ADMITTED_CORPUS',
  caseCount: records.length,
  parityCount: records.length - mismatches.length,
  mismatchCount: mismatches.length,
  records,
  boundary: {
    changesAlgorithm: false,
    promotesCapability: false,
    requiredNextStep: mismatches.length === 0
      ? 'expand randomized and cross-platform differential corpus before proof claim'
      : 'define a separately versioned canonical Number encoding; do not silently mutate v1',
  },
};
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
