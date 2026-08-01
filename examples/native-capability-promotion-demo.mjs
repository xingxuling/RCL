import fs from 'node:fs';
import { runReality } from '../src/runtime.mjs';
import { metabolizeExternalCapability } from '../src/capability-metabolism.mjs';
import {
  createExecutionObservation,
  runIndependentDifferentialAbsorption,
} from '../src/differential-absorption-runner.mjs';
import {
  createNativeCapabilityImplementationManifest,
  createNativeRuntimeObservation,
  promoteCapabilityToNative,
} from '../src/native-capability-promotion.mjs';

const spec = JSON.parse(fs.readFileSync(new URL('./capability-metabolism-sql-transaction.json', import.meta.url), 'utf8'));
const sources = {
  atomic_commit: `reality NativeAtomicCommit {
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
  }`,
  rollback_on_failure: `reality NativeRollback {
    facet account.balance : Number = 10
    facet transaction.status : Text = "rolled-back"
  }`,
};

const implementation = createNativeCapabilityImplementationManifest({
  capability: spec.id,
  cases: Object.entries(sources).map(([id, source]) => ({ id, source })),
});

const expected = {};
for (const [id, source] of Object.entries(sources)) {
  expected[id] = createNativeRuntimeObservation(await runReality(source));
}

const differential = await runIndependentDifferentialAbsorption({
  capability: spec.id,
  source: {
    id: 'sql_semantics_reference',
    runtime: 'reference-semantics-fixture',
    execute(_input, context) {
      return createExecutionObservation({
        ...expected[context.caseId],
        receipts: [{ source: 'reference-semantics-fixture' }],
      });
    },
  },
  absorbed: {
    id: 'rcl_reference_candidate',
    runtime: 'rcl-js-reference',
    artifactRoot: implementation.root,
    async execute(_input, context) {
      return createNativeRuntimeObservation(await runReality(sources[context.caseId]));
    },
  },
  cases: spec.evidence.equivalenceCases.map(item => ({ id: item.id, input: item.input })),
  repeats: 2,
  negativeControls: [{
    id: 'wrong_state_mutant',
    adapter: {
      id: 'mutated_candidate',
      runtime: 'mutated-reference',
      artifactRoot: implementation.root,
      execute() {
        return createExecutionObservation({
          output: { state: { 'account.balance': 999 }, projections: [], history: [] },
          exitCode: 0,
        });
      },
    },
    mustDifferCaseIds: spec.evidence.equivalenceCases.map(item => item.id),
  }],
});

const metabolism = metabolizeExternalCapability(spec);
const promotion = await promoteCapabilityToNative({
  metabolismReport: metabolism,
  differentialReport: differential,
  implementationManifest: implementation,
});

console.log(JSON.stringify({
  capability: promotion.capability,
  metabolismStage: metabolism.assessment.stage,
  differentialPassed: differential.passed,
  differentialScore: differential.score,
  implementationRoot: implementation.root,
  nativeStatus: promotion.status,
  nativeVm: {
    kind: promotion.nativeVm.kind,
    sha256: promotion.nativeVm.sha256,
  },
  cases: promotion.cases.map(item => ({
    id: item.id,
    verified: item.verified,
    programRoot: item.programRoot,
    bytecodeSha256: item.bytecodeSha256,
  })),
  boundary: promotion.boundary,
}, null, 2));
