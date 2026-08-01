import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  RCLCapabilityMetabolismError,
  normalizeExternalCapabilitySpec,
  extractCapabilitySemanticKernel,
  evaluateDeclaredEquivalence,
  renderCapabilityAsRcl,
  metabolizeExternalCapability,
  synthesizeAbsorbedCapabilities,
} from '../src/capability-metabolism.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));

test('capability metabolism normalizes and extracts an external semantic kernel', () => {
  const spec = normalizeExternalCapabilitySpec(read('capability-metabolism-sql-transaction.json'));
  const kernel = extractCapabilitySemanticKernel(spec);
  assert.equal(spec.id, 'relational_transaction');
  assert.equal(kernel.sourceIdentity, 'sql:serializable transaction@SQL:2016');
  assert.deepEqual(kernel.operation.inputs, ['TransactionState', 'WriteSet']);
  assert.equal(kernel.effects.length, 2);
  assert.equal(kernel.invariants.length, 3);
  assert.match(kernel.root, /^[0-9a-f]{64}$/);
});

test('capability metabolism renders compilable RCL and materializes a native candidate report', () => {
  const input = read('capability-metabolism-sql-transaction.json');
  const generated = renderCapabilityAsRcl(input);
  assert.equal(generated.program.name, 'AbsorbedRelationalTransaction');
  assert.equal(generated.program.dialects[0].id, 'relational_transaction');
  assert.match(generated.source, /operation commit_transaction/);

  const report = metabolizeExternalCapability(input, { subject: 'founder-twin' });
  assert.equal(report.assessment.stage, 'native-candidate');
  assert.equal(report.equivalence.passed, true);
  assert.equal(report.equivalence.caseCount, 2);
  assert.equal(report.assessment.runtimeIndependence, 0.75);
  assert.equal(report.synthesisHooks.exportedInvariants.length, 3);
  assert.match(report.commit, /^[0-9a-f]{64}$/);
  assert.match(report.root, /^[0-9a-f]{64}$/);
});

test('declared equivalence rejects mismatched absorbed output without claiming native parity', () => {
  const input = read('capability-metabolism-sql-transaction.json');
  input.evidence.equivalenceCases[0].absorbedOutput.state.balance = 8;
  const equivalence = evaluateDeclaredEquivalence(input);
  const report = metabolizeExternalCapability(input);
  assert.equal(equivalence.passed, false);
  assert.equal(equivalence.failedCount, 1);
  assert.equal(report.assessment.stage, 'rejected');
  assert.ok(report.assessment.gaps.includes('equivalence-mismatch'));
  assert.match(report.boundary, /not a native-runtime claim/);
});

test('capability metabolism requires effects, invariants and lowering targets', () => {
  const input = read('capability-metabolism-sql-transaction.json');
  input.semantics.effects = [];
  assert.throws(
    () => normalizeExternalCapabilitySpec(input),
    error => error instanceof RCLCapabilityMetabolismError && error.code === 'RCL_METABOLISM_EFFECTS_REQUIRED',
  );
});

test('absorbed capabilities synthesize into a compound organ with cross-domain edges', () => {
  const transaction = metabolizeExternalCapability(read('capability-metabolism-sql-transaction.json'));
  const ownership = metabolizeExternalCapability(read('capability-metabolism-ownership.json'));
  const compound = synthesizeAbsorbedCapabilities([transaction, ownership], {
    id: 'transactional_owned_reality',
  });
  assert.equal(compound.id, 'transactional_owned_reality');
  assert.deepEqual(compound.capabilities, ['relational_transaction', 'ownership_lifecycle']);
  assert.equal(compound.status, 'candidate');
  assert.equal(compound.crossDomainGain, 1);
  assert.ok(compound.effects.includes('AlterReality'));
  assert.ok(compound.effects.includes('Authority'));
  assert.equal(compound.invariants.length, 6);
  assert.match(compound.root, /^[0-9a-f]{64}$/);
});
