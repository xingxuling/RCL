import { compileReality } from './compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from './bytecode.mjs';
import { realityRoot } from './canonical.mjs';
import { createExecutionObservation } from './differential-absorption-runner.mjs';
import {
  RCL_NATIVE_CAPABILITY_PROMOTION_VERSION,
  RCL_NATIVE_IMPLEMENTATION_MANIFEST_FORMAT,
  RCLNativeCapabilityPromotionError,
  assertObject,
  nonEmptyString,
  safeIdentifier,
  sha256,
} from './native-capability-promotion-shared.mjs';

function normalizeImplementationCase(input, index) {
  const raw = assertObject(input, 'RCL_NATIVE_IMPLEMENTATION_CASE_INVALID', 'Native implementation case must be an object');
  const id = safeIdentifier(raw.id ?? `case_${index + 1}`);
  const source = nonEmptyString(raw.source, 'RCL_NATIVE_IMPLEMENTATION_SOURCE_REQUIRED', `Native implementation case '${id}' requires RCL source`);
  const program = compileReality(source);
  const bytecode = compileRealityToBytecode(program);
  const decoded = decodeBytecode(bytecode);
  const record = {
    id,
    source,
    sourceTextRoot: realityRoot(source),
    program: decoded.program,
    programRoot: program.programRoot,
    bytecodeSha256: sha256(bytecode),
    byteLength: bytecode.length,
    instructionCount: decoded.instructions.length,
  };
  return Object.freeze({ ...record, root: realityRoot(record) });
}

export function createNativeCapabilityImplementationManifest(input) {
  const raw = assertObject(input, 'RCL_NATIVE_IMPLEMENTATION_MANIFEST_INVALID', 'Native implementation manifest request must be an object');
  const capability = safeIdentifier(nonEmptyString(raw.capability, 'RCL_NATIVE_IMPLEMENTATION_CAPABILITY', 'Capability id is required'));
  const cases = (Array.isArray(raw.cases) ? raw.cases : []).map(normalizeImplementationCase);
  if (cases.length === 0) {
    throw new RCLNativeCapabilityPromotionError('RCL_NATIVE_IMPLEMENTATION_CASES_REQUIRED', 'At least one native implementation case is required');
  }
  const ids = new Set();
  for (const item of cases) {
    if (ids.has(item.id)) {
      throw new RCLNativeCapabilityPromotionError('RCL_NATIVE_IMPLEMENTATION_CASE_DUPLICATE', `Duplicate native implementation case '${item.id}'`);
    }
    ids.add(item.id);
  }
  const manifest = {
    format: RCL_NATIVE_IMPLEMENTATION_MANIFEST_FORMAT,
    version: RCL_NATIVE_CAPABILITY_PROMOTION_VERSION,
    capability,
    proofLevel: 'content-addressed-case-programs',
    cases,
    boundary: 'The manifest commits to case-specific RCL source, program roots and RBC hashes. It does not prove that the independent differential adapter actually executed these artifacts until the artifact-root binding is checked.',
  };
  return Object.freeze({ ...manifest, root: realityRoot({ ...manifest, cases: cases.map(item => item.root) }) });
}

function compactTransition(record) {
  return Object.freeze({
    rule: record.rule ?? null,
    ruleKind: record.ruleKind ?? null,
    mode: record.mode ?? null,
    status: record.status ?? null,
    actor: record.actor ?? null,
    changes: record.changes ?? [],
  });
}

export function createNativeRuntimeObservation(run) {
  const raw = assertObject(run, 'RCL_NATIVE_RUN_INVALID', 'Native/reference runtime result must be an object');
  const history = Array.isArray(raw.history) ? raw.history : [];
  const projections = Array.isArray(raw.projections) ? raw.projections : [];
  return createExecutionObservation({
    output: {
      state: raw.state ?? {},
      projections: projections.map(compactTransition),
      history: history.map(compactTransition),
    },
    effects: history.map(record => ({
      rule: record.rule ?? null,
      actor: record.actor ?? null,
      changes: record.changes ?? [],
    })),
    evidence: history.flatMap(record => (record.witnesses ?? []).map(witness => ({
      rule: record.rule ?? null,
      witness,
    }))),
    resourceDelta: history.flatMap(record => record.changes ?? []),
    authority: history.map(record => ({
      rule: record.rule ?? null,
      actor: record.actor ?? null,
      needs: record.authority?.needs ?? [],
      activeWarrants: record.authority?.activeWarrants ?? [],
    })),
    exitCode: 0,
    receipts: [{
      runtimeFormat: raw.format ?? null,
      program: raw.program ?? null,
      programRoot: raw.programRoot ?? null,
      stateRoot: raw.stateRoot ?? null,
      metrics: raw.metrics ?? null,
    }],
  });
}
