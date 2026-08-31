import test from 'node:test';
import assert from 'node:assert/strict';
import { RCLRuntimeError } from '../src/errors.mjs';
import {
  creationProposal,
  isCreationProposal,
  scoreCreation,
  isCreation,
  selectCreation,
  evidenceConfidence,
} from '../src/cognition.mjs';
import { buildCreativeReality } from '../src/planes.mjs';

test('external candidate can exist as an unscored CreationProposal without fabricated judgment', () => {
  const proposal = creationProposal('Text', '{"candidate":"semantic-fork"}', {
    target: 'open-domain-structure',
    evidence: ['sga:candidate-root:1'],
    basedOn: ['sga:operator:semantic-fork'],
    formedAtRoot: 'context:root:1',
  });
  assert.equal(isCreationProposal(proposal), true);
  assert.equal(isCreation(proposal), false);
  assert.equal(proposal.status, 'proposal');
  assert.equal(Object.hasOwn(proposal, 'score'), false);
  assert.deepEqual(proposal.evidence, ['sga:candidate-root:1']);
});

test('scoreCreation requires all evaluator dimensions explicitly', () => {
  const proposal = creationProposal('Text', 'candidate');
  assert.throws(
    () => scoreCreation(proposal, { novelty: 0.8, utility: 0.9, feasibility: 0.7 }),
    error => error instanceof RCLRuntimeError && error.code === 'RCL_CREATION_SCORE_REQUIRED',
  );
});

test('independent scoring converts proposal into normal scored Create<T> candidate', () => {
  const proposal = creationProposal('Text', 'candidate', {
    evidence: ['generator:evidence'],
    basedOn: ['generator:root'],
  });
  const scored = scoreCreation(proposal, {
    novelty: 0.8,
    utility: 0.9,
    feasibility: 0.7,
    risk: 0.2,
    evidence: ['evaluator:evidence'],
    basedOn: ['evaluator:root'],
  });
  assert.equal(isCreation(scored), true);
  assert.equal(scored.status, 'candidate');
  assert.equal(scored.score, 0.815);
  assert.deepEqual(scored.evidence, ['generator:evidence', 'evaluator:evidence']);
  assert.deepEqual(scored.basedOn, ['generator:root', 'evaluator:root']);
  assert.equal(evidenceConfidence(scored), scored.score);
});

test('unscored proposal cannot be selected or treated as confidence-bearing creation', () => {
  const proposal = creationProposal('Text', 'candidate');
  assert.throws(
    () => selectCreation(proposal),
    error => error instanceof RCLRuntimeError && error.code === 'RCL_EXPECTED_CREATION',
  );
  assert.throws(
    () => evidenceConfidence(proposal),
    error => error instanceof RCLRuntimeError && error.code === 'RCL_EXPECTED_COGNITIVE_OBJECT',
  );
});

test('scored candidate preserves normal selection semantics', () => {
  const proposal = creationProposal('Text', 'candidate');
  const scored = scoreCreation(proposal, {
    novelty: 0.6,
    utility: 0.7,
    feasibility: 0.8,
    risk: 0.1,
  });
  const selected = selectCreation(scored, ['proposal:a', 'proposal:b']);
  assert.equal(selected.status, 'selected');
  assert.deepEqual(selected.selectedFrom, ['proposal:a', 'proposal:b']);
});

test('Creative Reality exposes proposals separately from scored and selected candidates', () => {
  const proposal = creationProposal('Text', 'proposal-value');
  const scored = scoreCreation(creationProposal('Text', 'candidate-value'), {
    novelty: 0.5,
    utility: 0.8,
    feasibility: 0.9,
    risk: 0.1,
  });
  const selected = selectCreation(scored, ['candidate:1']);
  const plane = buildCreativeReality(
    { name: 'FederatedCreativeReality', creations: [{ name: 'creative' }] },
    {
      'creative.proposal': proposal,
      'creative.candidate': scored,
      'creative.selected': selected,
    },
  );
  assert.equal(plane.proposals['creative.proposal'].kind, 'CreationProposal');
  assert.equal(plane.candidates['creative.candidate'].kind, 'Creation');
  assert.equal(plane.selected['creative.selected'].status, 'selected');
  assert.match(plane.root, /^[0-9a-f]{64}$/);
});
