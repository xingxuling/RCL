import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransformerLifecycle, advanceTransformerLifecycle, transformerLifecycleGapReport } from '../src/production-transformer-lifecycle.mjs';

const r = c => c.repeat(64);
const base = () => createTransformerLifecycle({
  lifecycleId: 'rcl-10m-candidate', modelSpecRoot: r('a'), optimizerContractRoot: r('b'), numericalProfileRoot: r('c'), providerPlanRoot: r('d'),
});

function advanceAll() {
  let s = base();
  s = advanceTransformerLifecycle(s, 'DATA_ADMITTED', { admitted:true, licenseReviewed:true, privacyReviewed:true, poisonReviewed:true, corpusAdmissionRoot:r('e') });
  s = advanceTransformerLifecycle(s, 'TOKENIZER_FROZEN', { corpusAdmissionRoot:r('e'), tokenizerRoot:r('f') });
  s = advanceTransformerLifecycle(s, 'TRAINING_READY', { providerPlanRoot:r('d'), resourceBudgetFrozen:true, checkpointPolicyFrozen:true, evaluationProtocolFrozen:true });
  s = advanceTransformerLifecycle(s, 'TRAINING', { externalProviderExecutionStarted:true, rclExecutedTraining:false });
  s = advanceTransformerLifecycle(s, 'CHECKPOINTED', { atomicCheckpointVerified:true, checkpointRoot:r('1') });
  s = advanceTransformerLifecycle(s, 'EVALUATED', { checkpointRoot:r('1'), heldoutProtocolRespected:true, contaminated:false, evaluationRoot:r('2') });
  return advanceTransformerLifecycle(s, 'SERVING_CANDIDATE', { evaluationRoot:r('2'), autoregressiveReplayVerified:true, servingEvaluationRoot:r('3') });
}

test('AI022 lifecycle closes the RCL-owned phase semantics without claiming provider execution ownership', () => {
  const s = advanceAll();
  assert.equal(s.phase, 'SERVING_CANDIDATE');
  assert.equal(s.history.length, 7);
  assert.equal(s.authority.trainingProviderOwnsExecution, true);
  assert.equal(s.authority.canonicalPromotionPerformed, false);
  assert.equal(transformerLifecycleGapReport(s).productionEvidenceComplete, true);
});

test('AI022 rejects skipped phases and missing corpus governance evidence', () => {
  assert.throws(() => advanceTransformerLifecycle(base(), 'TOKENIZER_FROZEN', {}), /NON_SEQUENTIAL/u);
  assert.throws(() => advanceTransformerLifecycle(base(), 'DATA_ADMITTED', { admitted:true, corpusAdmissionRoot:r('e') }), /LICENSE_REVIEW/u);
});

test('AI022 preserves corpus, checkpoint and evaluation lineage', () => {
  let s = advanceTransformerLifecycle(base(), 'DATA_ADMITTED', { admitted:true, licenseReviewed:true, privacyReviewed:true, poisonReviewed:true, corpusAdmissionRoot:r('e') });
  assert.throws(() => advanceTransformerLifecycle(s, 'TOKENIZER_FROZEN', { corpusAdmissionRoot:r('9'), tokenizerRoot:r('f') }), /CORPUS_LINEAGE/u);
  s = advanceTransformerLifecycle(s, 'TOKENIZER_FROZEN', { corpusAdmissionRoot:r('e'), tokenizerRoot:r('f') });
  s = advanceTransformerLifecycle(s, 'TRAINING_READY', { providerPlanRoot:r('d'), resourceBudgetFrozen:true, checkpointPolicyFrozen:true, evaluationProtocolFrozen:true });
  s = advanceTransformerLifecycle(s, 'TRAINING', { externalProviderExecutionStarted:true, rclExecutedTraining:false });
  s = advanceTransformerLifecycle(s, 'CHECKPOINTED', { atomicCheckpointVerified:true, checkpointRoot:r('1') });
  assert.throws(() => advanceTransformerLifecycle(s, 'EVALUATED', { checkpointRoot:r('9'), heldoutProtocolRespected:true, contaminated:false, evaluationRoot:r('2') }), /CHECKPOINT_LINEAGE/u);
});

test('AI022 rejects owner theft and contaminated evaluation', () => {
  let s = advanceTransformerLifecycle(base(), 'DATA_ADMITTED', { admitted:true, licenseReviewed:true, privacyReviewed:true, poisonReviewed:true, corpusAdmissionRoot:r('e') });
  s = advanceTransformerLifecycle(s, 'TOKENIZER_FROZEN', { corpusAdmissionRoot:r('e'), tokenizerRoot:r('f') });
  s = advanceTransformerLifecycle(s, 'TRAINING_READY', { providerPlanRoot:r('d'), resourceBudgetFrozen:true, checkpointPolicyFrozen:true, evaluationProtocolFrozen:true });
  assert.throws(() => advanceTransformerLifecycle(s, 'TRAINING', { externalProviderExecutionStarted:true, rclExecutedTraining:true }), /OWNER_THEFT/u);
  s = advanceTransformerLifecycle(s, 'TRAINING', { externalProviderExecutionStarted:true, rclExecutedTraining:false });
  s = advanceTransformerLifecycle(s, 'CHECKPOINTED', { atomicCheckpointVerified:true, checkpointRoot:r('1') });
  assert.throws(() => advanceTransformerLifecycle(s, 'EVALUATED', { checkpointRoot:r('1'), heldoutProtocolRespected:true, contaminated:true, evaluationRoot:r('2') }), /CONTAMINATED/u);
});

test('AI022 lifecycle roots are deterministic for identical evidence', () => {
  assert.equal(advanceAll().lifecycleRoot, advanceAll().lifecycleRoot);
});
