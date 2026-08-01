import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runReality } from '../src/runtime.mjs';
import { compileReality } from '../src/compiler.mjs';
import { metabolizeExternalCapability } from '../src/capability-metabolism.mjs';
import {
  createExecutionObservation,
  runIndependentDifferentialAbsorption,
} from '../src/differential-absorption-runner.mjs';
import {
  RCL_NATIVE_PROMOTION_REPORT_FORMAT,
  RCLNativeCapabilityPromotionError,
  createNativeCapabilityImplementationManifest,
  createNativeRuntimeObservation,
  promoteCapabilityToNative,
} from '../src/native-capability-promotion.mjs';

const capabilitySpec = JSON.parse(fs.readFileSync(new URL('../examples/capability-metabolism-sql-transaction.json', import.meta.url), 'utf8'));

const commitSource = `reality NativeAtomicCommit {
  facet account.balance : Number = 10
  facet transaction.status : Text = "pending"
  subject owner { warrant account.commit on account }
  emergence commit {
    cause owner
    when account.balance >= 3
    needs account.commit on account
    alter account.balance <- account.balance - 3
    alter transaction.status <- "committed"
    preserve account.balance >= 0
    witness "transaction:commit"
  }
  realize commit
}`;

const rollbackSource = `reality NativeRollback {
  facet account.balance : Number = 10
  facet transaction.status : Text = "rolled-back"
}`;

const implementation = createNativeCapabilityImplementationManifest({
  capability: 'relational_transaction',
  cases: [
    { id: 'atomic_commit', source: commitSource },
    { id: 'rollback_on_failure', source: rollbackSource },
  ],
});

function manualObservation({ state, history = [] }) {
  return createExecutionObservation({
    output: {
      state,
      projections: [],
      history: history.map(record => ({
        rule: record.rule,
        ruleKind: record.ruleKind,
        mode: record.mode,
        status: record.status,
        actor: record.actor,
        changes: record.changes,
      })),
    },
    effects: history.map(record => ({ rule: record.rule, actor: record.actor, changes: record.changes })),
    evidence: history.flatMap(record => record.witnesses.map(witness => ({ rule: record.rule, witness }))),
    resourceDelta: history.flatMap(record => record.changes),
    authority: history.map(record => ({
      rule: record.rule,
      actor: record.actor,
      needs: record.authority.needs,
      activeWarrants: record.authority.activeWarrants,
    })),
    exitCode: 0,
  });
}

function sourceTransaction(input) {
  if (input.write.balance === 7) {
    return manualObservation({
      state: { 'account.balance': 7, 'transaction.status': 'committed' },
      history: [{
        rule: 'commit',
        ruleKind: 'Emergence',
        mode: 'realize',
        status: 'realized',
        actor: 'owner',
        changes: [
          { target: 'account.balance', before: 10, after: 7, source: 'alter' },
          { target: 'transaction.status', before: 'pending', after: 'committed', source: 'alter' },
        ],
        authority: {
          needs: [{ capability: 'account.commit', target: 'account' }],
          activeWarrants: [{ subject: 'owner', capability: 'account.commit', target: 'account' }],
        },
        witnesses: ['transaction:commit'],
      }],
    });
  }
  return manualObservation({ state: { 'account.balance': 10, 'transaction.status': 'rolled-back' } });
}

async function absorbedRcl(_input, context) {
  const source = context.caseId === 'atomic_commit' ? commitSource : rollbackSource;
  return createNativeRuntimeObservation(await runReality(source));
}

async function buildDifferential({ mutateArtifactRoot = false } = {}) {
  return runIndependentDifferentialAbsorption({
    capability: 'relational_transaction',
    source: {
      id: 'sql_semantics_reference',
      runtime: 'manual-sql-reference',
      execute: input => sourceTransaction(input),
    },
    absorbed: {
      id: 'rcl_reference_candidate',
      runtime: 'rcl-js-reference',
      artifactRoot: mutateArtifactRoot ? 'wrong-root' : implementation.root,
      execute: absorbedRcl,
    },
    cases: capabilitySpec.evidence.equivalenceCases.map(item => ({ id: item.id, input: item.input })),
    repeats: 2,
    negativeControls: [{
      id: 'transaction_state_mutant',
      adapter: {
        id: 'mutated_rcl_candidate',
        runtime: 'mutated-rcl-reference',
        artifactRoot: implementation.root,
        execute(input, context) {
          if (context.caseId === 'rollback_on_failure') return sourceTransaction(input);
          return createExecutionObservation({
            output: {
              state: { 'account.balance': 13, 'transaction.status': 'committed' },
              projections: [],
              history: [],
            },
            exitCode: 0,
          });
        },
      },
      mustDifferCaseIds: ['atomic_commit'],
    }],
  });
}

test('native promotion verifies the full metabolism -> differential -> RBC -> native VM chain', async () => {
  const metabolism = metabolizeExternalCapability(capabilitySpec);
  const differential = await buildDifferential();
  const report = await promoteCapabilityToNative({
    metabolismReport: metabolism,
    differentialReport: differential,
    implementationManifest: implementation,
  });

  assert.equal(report.format, RCL_NATIVE_PROMOTION_REPORT_FORMAT);
  assert.equal(report.status, 'native-verified');
  assert.equal(report.verified, true);
  assert.equal(report.promotionEligible, true);
  assert.equal(report.caseCount, 2);
  assert.equal(report.verifiedCaseCount, 2);
  assert.equal(report.failedCaseCount, 0);
  assert.ok(report.cases.every(item => item.parity.state));
  assert.ok(report.cases.every(item => item.checks.nativeMatchesDifferential));
  assert.ok(report.nativeVm.sha256);
});

test('implementation manifests commit to deterministic RBC artifacts', () => {
  const again = createNativeCapabilityImplementationManifest({
    capability: 'relational_transaction',
    cases: [
      { id: 'atomic_commit', source: commitSource },
      { id: 'rollback_on_failure', source: rollbackSource },
    ],
  });
  assert.equal(again.root, implementation.root);
  assert.deepEqual(again.cases.map(item => item.bytecodeSha256), implementation.cases.map(item => item.bytecodeSha256));
  assert.equal(again.cases[0].programRoot, compileReality(commitSource).programRoot);
});

test('native promotion rejects differential evidence not bound to the implementation manifest', async () => {
  const metabolism = metabolizeExternalCapability(capabilitySpec);
  const differential = await buildDifferential({ mutateArtifactRoot: true });
  await assert.rejects(
    () => promoteCapabilityToNative({ metabolismReport: metabolism, differentialReport: differential, implementationManifest: implementation }),
    error => error instanceof RCLNativeCapabilityPromotionError && error.code === 'RCL_NATIVE_ARTIFACT_BINDING',
  );
});

test('native promotion rejects non-native-candidate metabolism stages', async () => {
  const metabolism = metabolizeExternalCapability({
    ...capabilitySpec,
    lowering: { ...capabilitySpec.lowering, providerRequired: true, nativeLoweringWitness: null },
  });
  const differential = await buildDifferential();
  await assert.rejects(
    () => promoteCapabilityToNative({
      metabolismReport: metabolism,
      differentialReport: differential,
      implementationManifest: implementation,
    }),
    error => error instanceof RCLNativeCapabilityPromotionError && error.code === 'RCL_NATIVE_CANDIDATE_REQUIRED',
  );
});

test('missing native VM produces an explicit blocked report without a native claim', async () => {
  const metabolism = metabolizeExternalCapability(capabilitySpec);
  const differential = await buildDifferential();
  const report = await promoteCapabilityToNative({
    metabolismReport: metabolism,
    differentialReport: differential,
    implementationManifest: implementation,
    vmPath: new URL('../native/definitely-missing-rclvm', import.meta.url).pathname,
  });
  assert.equal(report.status, 'native-blocked');
  assert.equal(report.verified, false);
  assert.deepEqual(report.gaps, ['native-vm-missing']);
});

test('native promotion rejects stale roots after nested differential evidence tampering', async () => {
  const metabolism = metabolizeExternalCapability(capabilitySpec);
  const differential = structuredClone(await buildDifferential());
  differential.cases[0].absorbed.primary.output.state['account.balance'] = 999;
  await assert.rejects(
    () => promoteCapabilityToNative({ metabolismReport: metabolism, differentialReport: differential, implementationManifest: implementation }),
    error => error instanceof RCLNativeCapabilityPromotionError
      && ['RCL_NATIVE_OBSERVATION_SEMANTIC_INTEGRITY', 'RCL_NATIVE_OBSERVATION_INTEGRITY'].includes(error.code),
  );
});

test('capability absorption stack exposes metabolism, differential and native promotion together', async () => {
  const stack = await import('../src/capability-absorption-stack.mjs');
  assert.equal(typeof stack.metabolizeExternalCapability, 'function');
  assert.equal(typeof stack.runIndependentDifferentialAbsorption, 'function');
  assert.equal(typeof stack.promoteCapabilityToNative, 'function');
  assert.ok(stack.RCL_NATIVE_PROMOTION_STATUSES.includes('native-verified'));
});
