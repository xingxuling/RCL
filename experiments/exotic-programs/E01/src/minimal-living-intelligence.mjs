import { compileReality } from '../../../../src/compiler.mjs';
import { realityRoot } from '../../../../src/canonical.mjs';
import { metabolizeExternalCapability } from '../../../../src/capability-metabolism.mjs';
import {
  attachIndependentDifferentialEvidence,
  createExecutionObservation,
  runIndependentDifferentialAbsorption,
} from '../../../../src/differential-absorption-runner.mjs';
import { createContentAddressedRealityStore } from '../../../../src/reality-store.mjs';
import { semanticStateRoot } from '../../../../src/semantic-state-root.mjs';

export const E01_FORMAT = 'rcl.exotic-program.e01-minimal-living-intelligence.v0.1';
export const E01_CAPABILITY = 'weighted_sum';
export const E01_MAX_ATTEMPTS = 8;

export const E01_BUILTIN_CAPABILITIES = Object.freeze([
  'observe',
  'remember',
  'compare',
  'branch',
  'sequence',
  'basic_arithmetic',
  'structured_data',
  'goal_evaluation',
  'capability_query',
]);

function clone(value) {
  return structuredClone(value);
}

function capabilityInventory() {
  return Object.fromEntries(E01_BUILTIN_CAPABILITIES.map(id => [id, {
    id,
    tier: 'fixed-language',
    canonical: true,
    acquiredAt: 'genesis',
  }]));
}

function initialState(subjectId) {
  return {
    format: 'rcl.e01-living-intelligence-state.v0.1',
    subjectId,
    version: 0,
    goal: {
      id: 'complete-three-bounded-tasks',
      targetTasks: ['task-a', 'task-b', 'task-c'],
      terminationPolicy: 'bounded-attempts-and-honest-closure',
    },
    observations: [],
    memory: [],
    capabilityInventory: capabilityInventory(),
    installedOrgans: {},
    taskResults: {},
    failureLog: [],
    donorTrials: [],
    growthHistory: [],
    attemptCount: 0,
    retryBudget: 2,
    terminated: false,
  };
}

function bodyProjection(state) {
  return {
    subjectId: state.subjectId,
    goal: state.goal,
    capabilityInventory: state.capabilityInventory,
    installedOrgans: state.installedOrgans,
  };
}

function preservedProjection(state) {
  return {
    subjectId: state.subjectId,
    goal: state.goal,
    observations: state.observations,
    memory: state.memory,
    taskResults: state.taskResults,
    failureLog: state.failureLog,
  };
}

function weightedCases() {
  return [
    {
      id: 'weighted-basic',
      input: { values: [2, 4, 6], weights: [1, 2, 1] },
      expected: 16,
    },
    {
      id: 'weighted-negative',
      input: { values: [5, -2, 3], weights: [2, 3, 1] },
      expected: 7,
    },
  ];
}

function calculateWeightedSum(input) {
  if (!input || !Array.isArray(input.values) || !Array.isArray(input.weights)
      || input.values.length !== input.weights.length || input.values.length === 0) {
    throw Object.assign(new Error('weighted_sum requires equal non-empty values and weights'), {
      code: 'E01_WEIGHTED_SUM_INPUT',
      details: { input },
    });
  }
  return input.values.reduce((sum, value, index) => sum + value * input.weights[index], 0);
}

function calculateUnweightedSum(input) {
  return input.values.reduce((sum, value) => sum + value, 0);
}

function observationFor(value) {
  return {
    output: { value },
    effects: ['read-local-structured-data'],
    evidence: ['e01:weighted-sum-observation'],
    resourceDelta: { operations: 1 },
    authority: { mode: 'bounded-local-computation' },
    receipts: ['e01:weighted-sum-receipt'],
  };
}

function createWeightedSumSpec(candidateId) {
  const cases = weightedCases();
  return {
    id: candidateId,
    version: '0.1.0',
    source: {
      ecosystem: 'e01-human-selected-donor',
      construct: 'weighted_sum',
      version: 'donor-v0.1',
      license: 'campaign-fixture',
      referenceRoot: realityRoot({ candidateId, cases }),
    },
    operation: {
      name: 'weighted_sum',
      inputs: ['WeightedValues'],
      outputs: ['Number'],
    },
    semantics: {
      description: 'Multiply aligned values and weights, then reduce deterministically.',
      effects: [{
        name: 'ReadLocalState',
        deterministic: true,
        replay: 'deterministic',
        evidenceRequired: true,
      }],
      invariants: [
        'values and weights have equal non-zero length',
        'the same input yields the same Number output',
      ],
      failureModes: ['malformed-input', 'length-mismatch'],
      resourceModel: ['one bounded reduction per invocation'],
      authority: ['local structured input only'],
    },
    lowering: {
      targets: ['candidate-organ'],
      providerRequired: false,
      nativeLoweringWitness: {
        kind: 'e01-harness-candidate-organ',
        implementation: 'javascript-function-bound-by-evidence',
      },
    },
    evidence: {
      equivalenceCases: cases.map(testCase => ({
        id: testCase.id,
        input: testCase.input,
        sourceOutput: { value: testCase.expected },
        absorbedOutput: { value: testCase.expected },
        sourceEvidence: 'e01:declared-reference',
        absorbedEvidence: 'e01:declared-donor',
      })),
      provenance: ['human-selected donor fixture', 'E01 fixed weighted-sum cases'],
    },
    synthesis: {
      tags: ['e01', 'bounded', 'arithmetic', 'candidate-organ'],
      compatibleWith: ['basic_arithmetic', 'structured_data'],
      conflictsWith: [],
    },
  };
}

function createDonorCandidate({ id, mode }) {
  const execute = mode === 'valid' ? calculateWeightedSum : calculateUnweightedSum;
  const descriptor = { id, mode, capability: E01_CAPABILITY, runtime: `e01-donor-${mode}` };
  return Object.freeze({
    ...descriptor,
    spec: createWeightedSumSpec(id),
    execute,
    root: realityRoot(descriptor),
  });
}

function makeFailure(task, reason, failureClass, details = {}) {
  const failure = {
    kind: 'rcl.e01.failure.v0.1',
    taskId: task.id,
    failureKind: 'CAPABILITY_FAILURE',
    failureClass,
    requiredCapability: task.requiredCapability ?? null,
    reason,
    details,
  };
  return Object.freeze({ ...failure, root: realityRoot(failure) });
}

function taskA() {
  return {
    id: 'task-a',
    kind: 'threshold-compare',
    input: { scores: [4, 7, 5], threshold: 6 },
    goal: 'identify-a-score-at-or-above-threshold',
  };
}

function weightedTask(id) {
  return {
    id,
    kind: 'weighted-sum',
    requiredCapability: E01_CAPABILITY,
    input: weightedCases()[0].input,
    expected: weightedCases()[0].expected,
    goal: 'compute-weighted-score',
  };
}

export class MinimalLivingIntelligenceSubject {
  constructor({ programRoot, subjectId = 'e01-mind', maxAttempts = E01_MAX_ATTEMPTS } = {}) {
    this.programRoot = programRoot;
    this.maxAttempts = maxAttempts;
    this.store = createContentAddressedRealityStore();
    this._state = initialState(subjectId);
    this._organImplementations = new Map();
    this._currentCommit = null;
    this._receipts = [];
    this.transition('subject.genesis', {
      programRoot,
      builtins: E01_BUILTIN_CAPABILITIES,
    }, () => {});
  }

  get state() {
    return this._state;
  }

  get currentCommit() {
    return this._currentCommit;
  }

  get receipts() {
    return [...this._receipts];
  }

  bodyRoot(state = this._state) {
    return realityRoot(bodyProjection(state));
  }

  stateRoot(state = this._state) {
    return semanticStateRoot(state);
  }

  hasCapability(capabilityId) {
    return Object.hasOwn(this._state.capabilityInventory, capabilityId);
  }

  transition(type, payload, mutate) {
    const next = clone(this._state);
    mutate(next);
    next.version += 1;
    const eventRoot = this.store.putEvent({
      type,
      subject: next.subjectId,
      payload,
      metadata: { programRoot: this.programRoot, stateVersion: next.version },
    });
    const historyEntry = {
      sequence: next.growthHistory.length + 1,
      type,
      payload,
      eventRoot,
    };
    next.growthHistory.push(historyEntry);
    const stateRoot = this.stateRoot(next);
    const bodyRoot = this.bodyRoot(next);
    const evidenceRoot = this.store.putEvidence({
      format: 'rcl.e01-state-receipt.v0.1',
      eventRoot,
      stateRoot,
      bodyRoot,
      stateVersion: next.version,
    }, { type: 'e01-state-receipt', subject: next.subjectId });
    const commitRoot = this.store.snapshotState(next, {
      message: type,
      parent: this._currentCommit,
      events: [eventRoot],
      evidence: [evidenceRoot],
      author: 'e01-minimal-living-intelligence',
    });
    this._state = next;
    this._currentCommit = commitRoot;
    this._receipts.push({ type, eventRoot, evidenceRoot, stateRoot, bodyRoot, commitRoot });
    return Object.freeze({ type, eventRoot, evidenceRoot, stateRoot, bodyRoot, commitRoot });
  }

  observeTask(task, reason = 'normal') {
    const observation = {
      taskId: task.id,
      reason,
      input: task.input,
      availableCapabilities: Object.keys(this._state.capabilityInventory).sort(),
      stateVersionBefore: this._state.version,
    };
    this.transition('observation.recorded', observation, next => {
      next.observations.push(observation);
      next.memory.push({ type: 'observation', taskId: task.id, input: task.input, reason });
      next.attemptCount += 1;
    });
    return observation;
  }

  executeTask(task, { reason = 'normal' } = {}) {
    if (this._state.terminated) {
      return { status: 'BLOCKED', failure: makeFailure(task, 'subject-already-terminated', 'EXPERIMENT_DESIGN_LIMIT') };
    }
    if (this._state.attemptCount >= this.maxAttempts) {
      const failure = makeFailure(task, 'bounded-attempt-budget-exhausted', 'PERFORMANCE_LIMIT', { maxAttempts: this.maxAttempts });
      this.transition('task.terminated-by-budget', { taskId: task.id, failureRoot: failure.root }, next => {
        next.failureLog.push(failure);
        next.taskResults[task.id] = { status: 'BLOCKED', failureRoot: failure.root };
      });
      return { status: 'BLOCKED', failure };
    }

    this.observeTask(task, reason);
    if (task.kind === 'threshold-compare') {
      const highest = Math.max(...task.input.scores);
      const result = { highest, threshold: task.input.threshold, satisfied: highest >= task.input.threshold };
      this.transition('task.completed', { taskId: task.id, result, usedCapability: 'compare' }, next => {
        next.taskResults[task.id] = { status: 'VERIFIED', result, usedCapability: 'compare' };
        next.memory.push({ type: 'task-completed', taskId: task.id, result });
      });
      return { status: 'VERIFIED', result, usedCapability: 'compare' };
    }

    const organ = this._state.installedOrgans[task.requiredCapability];
    const implementation = this._organImplementations.get(task.requiredCapability);
    if (!organ || !implementation) {
      const failure = makeFailure(
        task,
        `missing capability '${task.requiredCapability}'`,
        'ORGAN_LIMIT',
        { capabilityInventory: Object.keys(this._state.capabilityInventory).sort() },
      );
      this.transition('task.failed-capability-gap', { taskId: task.id, failure }, next => {
        next.failureLog.push(failure);
        next.taskResults[task.id] = {
          status: 'BLOCKED',
          failureKind: failure.failureKind,
          failureClass: failure.failureClass,
          requiredCapability: failure.requiredCapability,
          failureRoot: failure.root,
        };
        next.memory.push({
          type: 'capability-gap',
          taskId: task.id,
          requiredCapability: failure.requiredCapability,
          failureRoot: failure.root,
        });
      });
      return { status: 'BLOCKED', failure };
    }

    try {
      const value = implementation(task.input);
      const result = {
        value,
        expected: task.expected,
        satisfied: value === task.expected,
      };
      if (!result.satisfied) {
        const failure = makeFailure(task, 'installed organ returned a non-equivalent result', 'ORGAN_LIMIT', { value, expected: task.expected });
        this.transition('task.failed-organ-result', { taskId: task.id, failure }, next => {
          next.failureLog.push(failure);
          next.taskResults[task.id] = { status: 'BLOCKED', failureRoot: failure.root };
        });
        return { status: 'BLOCKED', failure, usedCapability: task.requiredCapability };
      }
      this.transition('task.completed-with-organ', { taskId: task.id, result, usedCapability: task.requiredCapability }, next => {
        next.taskResults[task.id] = { status: 'VERIFIED', result, usedCapability: task.requiredCapability };
        next.memory.push({ type: 'task-completed-with-organ', taskId: task.id, result, usedCapability: task.requiredCapability });
      });
      return { status: 'VERIFIED', result, usedCapability: task.requiredCapability };
    } catch (error) {
      const failure = makeFailure(task, error.message, 'ORGAN_LIMIT', { code: error.code ?? 'E01_ORGAN_ERROR' });
      this.transition('task.failed-organ-execution', { taskId: task.id, failure }, next => {
        next.failureLog.push(failure);
        next.taskResults[task.id] = { status: 'BLOCKED', failureRoot: failure.root };
      });
      return { status: 'BLOCKED', failure, usedCapability: task.requiredCapability };
    }
  }

  retryTask(task) {
    if (this._state.retryBudget <= 0) {
      const failure = makeFailure(task, 'retry-budget-exhausted', 'PERFORMANCE_LIMIT');
      return { status: 'BLOCKED', failure };
    }
    this.transition('task.retry-requested', { taskId: task.id, remainingBefore: this._state.retryBudget }, next => {
      next.retryBudget -= 1;
      next.memory.push({ type: 'retry', taskId: task.id });
    });
    return this.executeTask(task, { reason: 'capability-installed-retry' });
  }

  installCandidateOrgan({ capabilityId, organId, execute, evidence }) {
    const bodyRootBefore = this.bodyRoot();
    const preservedBefore = preservedProjection(this._state);
    const preservedMemoryPrefixLength = preservedBefore.memory.length;
    const preservedRootBefore = realityRoot(preservedBefore);
    const descriptor = {
      id: organId,
      capabilityId,
      tier: 'candidate-organ',
      canonical: false,
      evidenceRoot: evidence.root,
      metabolismRoot: evidence.metabolismRoot,
      differentialRoot: evidence.differentialRoot,
    };
    this.transition('organ.candidate-installed', descriptor, next => {
      next.capabilityInventory[capabilityId] = {
        id: capabilityId,
        tier: 'candidate-organ',
        canonical: false,
        acquiredAt: next.version + 1,
        evidenceRoot: evidence.root,
      };
      next.installedOrgans[capabilityId] = descriptor;
      next.memory.push({ type: 'organ-installed', capabilityId, organId, evidenceRoot: evidence.root });
    });
    this._organImplementations.set(capabilityId, execute);
    const preservedAfter = preservedProjection(this._state);
    const preservedRootAfter = realityRoot({
      ...preservedAfter,
      memory: preservedAfter.memory.slice(0, preservedMemoryPrefixLength),
    });
    return Object.freeze({
      status: 'VERIFIED',
      descriptor,
      bodyRootBefore,
      bodyRootAfter: this.bodyRoot(),
      preservedRootBefore,
      preservedRootAfter,
      preservedMemoryPrefixLength,
      preservedStateUnchanged: preservedRootBefore === preservedRootAfter,
    });
  }

  removeCandidateOrgan(capabilityId) {
    const bodyRootBefore = this.bodyRoot();
    this.transition('organ.candidate-removed', { capabilityId }, next => {
      delete next.capabilityInventory[capabilityId];
      delete next.installedOrgans[capabilityId];
      next.memory.push({ type: 'organ-removed', capabilityId });
    });
    this._organImplementations.delete(capabilityId);
    return Object.freeze({
      status: 'VERIFIED',
      capabilityId,
      bodyRootBefore,
      bodyRootAfter: this.bodyRoot(),
      presentAfter: this.hasCapability(capabilityId),
    });
  }

  terminate(reason) {
    this.transition('subject.terminated', { reason, attemptCount: this._state.attemptCount }, next => {
      next.terminated = true;
      next.memory.push({ type: 'termination', reason });
    });
  }
}

function adapterFor(calculator) {
  return input => createExecutionObservation(observationFor(calculator(input)));
}

export async function evaluateAndMaybeInstallDonor(subject, {
  taskId,
  candidates,
  selectedCandidateId,
}) {
  const candidateIds = candidates.map(candidate => candidate.id);
  const selected = candidates.find(candidate => candidate.id === selectedCandidateId);
  if (!selected) {
    const failure = {
      kind: 'rcl.e01.donor-selection-failure.v0.1',
      taskId,
      failureClass: 'EXPERIMENT_DESIGN_LIMIT',
      reason: 'human selected donor is not in the offered candidate set',
      candidateIds,
      selectedCandidateId,
    };
    const result = { status: 'BLOCKED', failureRoot: realityRoot(failure), candidateIds, selectedCandidateId };
    subject.transition('donor.selection-failed', result, next => {
      next.donorTrials.push(result);
      next.memory.push({ type: 'donor-selection-failed', taskId, candidateIds, selectedCandidateId });
    });
    return { ...result, failureClass: failure.failureClass, evidence: null };
  }

  subject.transition('donor.selected-by-human', {
    taskId,
    actor: 'human',
    candidateIds,
    selectedCandidateId: selected.id,
  }, next => {
    next.memory.push({ type: 'human-donor-selection', taskId, selectedCandidateId: selected.id, candidateIds });
  });

  const cases = weightedCases();
  let metabolism;
  let differential;
  let envelope;
  let error = null;
  try {
    metabolism = metabolizeExternalCapability(selected.spec, { subject: subject.state.subjectId });
    differential = await runIndependentDifferentialAbsorption({
      capability: selected.spec.id,
      source: {
        id: `${selected.id}-reference`,
        runtime: 'e01-reference-function',
        artifactRoot: realityRoot({ kind: 'reference', capability: E01_CAPABILITY }),
        execute: adapterFor(calculateWeightedSum),
      },
      absorbed: {
        id: `${selected.id}-candidate`,
        runtime: selected.runtime,
        artifactRoot: selected.root,
        execute: adapterFor(selected.execute),
      },
      cases: cases.map(testCase => ({ id: testCase.id, input: testCase.input, tags: ['e01', 'weighted-sum'] })),
      repeats: 2,
      timeoutMs: 2_000,
      requireDeterministicReplay: true,
      requireNegativeControl: true,
      negativeControls: [{
        id: `${selected.id}-ignore-weights-control`,
        adapter: {
          id: `${selected.id}-ignore-weights-control-adapter`,
          runtime: 'e01-negative-control',
          artifactRoot: selected.root,
          execute: adapterFor(calculateUnweightedSum),
        },
        mustDifferCaseIds: cases.map(testCase => testCase.id),
      }],
    });
    envelope = attachIndependentDifferentialEvidence(metabolism, differential);
  } catch (caught) {
    error = {
      code: caught.code ?? caught.name ?? 'E01_DONOR_ERROR',
      message: caught.message,
      details: caught.details ?? null,
    };
  }

  const bodyRootBefore = subject.bodyRoot();
  const verified = !error
    && metabolism.assessment.stage === 'native-candidate'
    && differential.passed === true
    && envelope.promotionEligible === true;
  const failureClass = verified ? null : 'EVIDENCE_LIMIT';
  const summary = {
    taskId,
    status: verified ? 'VERIFIED' : 'BLOCKED',
    selectedCandidateId: selected.id,
    candidateIds,
    humanSelected: true,
    metabolismRoot: metabolism?.root ?? null,
    differentialRoot: differential?.root ?? null,
    envelopeRoot: envelope?.root ?? null,
    metabolismStage: metabolism?.assessment?.stage ?? null,
    differentialPassed: differential?.passed === true,
    failureClass,
    error,
  };
  subject.transition('donor.evaluated', summary, next => {
    next.donorTrials.push(summary);
    next.memory.push({
      type: 'donor-evaluation',
      taskId,
      selectedCandidateId: selected.id,
      status: summary.status,
      metabolismRoot: summary.metabolismRoot,
      differentialRoot: summary.differentialRoot,
      envelopeRoot: summary.envelopeRoot,
    });
  });

  if (!verified) {
    const bodyRootAfter = subject.bodyRoot();
    return {
      ...summary,
      bodyRootBefore,
      bodyRootAfter,
      contaminationFree: bodyRootBefore === bodyRootAfter,
      candidateNotInstalled: !subject.hasCapability(E01_CAPABILITY),
      evidence: { metabolism, differential, envelope },
    };
  }

  const installation = subject.installCandidateOrgan({
    capabilityId: E01_CAPABILITY,
    organId: selected.id,
    execute: selected.execute,
    evidence: {
      root: envelope.root,
      metabolismRoot: metabolism.root,
      differentialRoot: differential.root,
    },
  });
  return {
    ...summary,
    bodyRootBefore,
    bodyRootAfter: installation.bodyRootAfter,
    contaminationFree: true,
    candidateNotInstalled: false,
    installation,
    evidence: { metabolism, differential, envelope },
  };
}

export async function runMinimalLivingIntelligence({ programSource, subjectId = 'e01-mind' } = {}) {
  if (typeof programSource !== 'string' || programSource.trim().length === 0) {
    throw new TypeError('E01 requires the RCL program source');
  }
  const program = compileReality(programSource);
  const subject = new MinimalLivingIntelligenceSubject({ programRoot: program.programRoot, subjectId });
  const initialBodyRoot = subject.bodyRoot();
  const initialStateRoot = subject.stateRoot();

  const resultA = subject.executeTask(taskA());
  const taskB = weightedTask('task-b');
  const resultBInitial = subject.executeTask(taskB);
  const donorB = await evaluateAndMaybeInstallDonor(subject, {
    taskId: taskB.id,
    candidates: [
      createDonorCandidate({ id: 'weighted_sum_valid_donor', mode: 'valid' }),
      createDonorCandidate({ id: 'weighted_sum_wrong_donor', mode: 'wrong' }),
    ],
    selectedCandidateId: 'weighted_sum_valid_donor',
  });
  const resultBRetry = subject.retryTask(taskB);
  const removeB = subject.removeCandidateOrgan(E01_CAPABILITY);
  const resultBReplay = subject.executeTask(taskB, { reason: 'after-organ-deletion-replay' });

  const taskC = weightedTask('task-c');
  const resultCInitial = subject.executeTask(taskC);
  const donorC = await evaluateAndMaybeInstallDonor(subject, {
    taskId: taskC.id,
    candidates: [
      createDonorCandidate({ id: 'weighted_sum_wrong_donor', mode: 'wrong' }),
      createDonorCandidate({ id: 'weighted_sum_wrong_donor_alt', mode: 'wrong' }),
    ],
    selectedCandidateId: 'weighted_sum_wrong_donor',
  });
  subject.terminate('task-c-honest-blocked-closure');

  const checks = {
    taskFailureVsCapabilityFailure: resultA.status === 'VERIFIED'
      && resultBInitial.failure?.failureKind === 'CAPABILITY_FAILURE'
      && resultCInitial.failure?.failureKind === 'CAPABILITY_FAILURE',
    capabilityGapDescribed: resultBInitial.failure?.requiredCapability === E01_CAPABILITY
      && resultCInitial.failure?.requiredCapability === E01_CAPABILITY,
    persistentState: subject.state.goal.id === 'complete-three-bounded-tasks'
      && subject.state.memory.some(item => item.taskId === 'task-a'),
    differentialEvidenceBeforeInstall: donorB.status === 'VERIFIED'
      && donorB.differentialPassed === true
      && donorB.envelopeRoot !== null,
    retryUsesNewOrgan: resultBRetry.status === 'VERIFIED'
      && resultBRetry.usedCapability === E01_CAPABILITY,
    statePreservedAcrossInstall: donorB.installation?.preservedStateUnchanged === true,
    deleteReproducesOriginalFailure: removeB.presentAfter === false
      && resultBReplay.status === 'BLOCKED'
      && resultBReplay.failure?.root === resultBInitial.failure?.root,
    failedDonorDoesNotContaminateBody: donorC.status === 'BLOCKED'
      && donorC.contaminationFree === true
      && donorC.candidateNotInstalled === true,
    honestCClosure: resultCInitial.status === 'BLOCKED'
      && donorC.status === 'BLOCKED'
      && donorC.failureClass === 'EVIDENCE_LIMIT',
    boundedTermination: subject.state.terminated === true
      && subject.state.attemptCount <= E01_MAX_ATTEMPTS,
    growthHistoryComplete: subject.state.growthHistory.some(item => item.type === 'organ.candidate-installed')
      && subject.state.growthHistory.some(item => item.type === 'organ.candidate-removed')
      && subject.state.growthHistory.some(item => item.type === 'donor.evaluated')
      && subject.state.growthHistory.some(item => item.type === 'subject.terminated'),
    candidateNeverCanonical: donorB.installation?.descriptor.canonical === false
      && !Object.values(subject.state.installedOrgans).some(item => item.canonical === true),
  };

  const reportWithoutRoot = {
    format: E01_FORMAT,
    version: '0.1.0',
    status: Object.values(checks).every(Boolean) ? 'VERIFIED' : 'BLOCKED',
    subjectId,
    program: {
      name: program.name,
      programRoot: program.programRoot,
      sourceRoot: realityRoot(programSource),
      compiled: true,
    },
    initialBodyRoot,
    initialStateRoot,
    finalBodyRoot: subject.bodyRoot(),
    finalStateRoot: subject.stateRoot(),
    maxAttempts: E01_MAX_ATTEMPTS,
    attempts: subject.state.attemptCount,
    builtins: E01_BUILTIN_CAPABILITIES,
    taskResults: {
      taskA: resultA,
      taskBInitial: resultBInitial,
      taskBRetry: resultBRetry,
      taskBReplayAfterDeletion: resultBReplay,
      taskCInitial: resultCInitial,
    },
    donorTrials: [donorB, donorC].map(trial => ({
      taskId: trial.taskId,
      status: trial.status,
      selectedCandidateId: trial.selectedCandidateId,
      candidateIds: trial.candidateIds,
      humanSelected: trial.humanSelected,
      metabolismRoot: trial.metabolismRoot,
      differentialRoot: trial.differentialRoot,
      envelopeRoot: trial.envelopeRoot,
      metabolismStage: trial.metabolismStage,
      differentialPassed: trial.differentialPassed,
      failureClass: trial.failureClass,
      contaminationFree: trial.contaminationFree,
      candidateNotInstalled: trial.candidateNotInstalled,
      installation: trial.installation ?? null,
    })),
    checks,
    failureClasses: {
      taskBInitial: resultBInitial.failure?.failureClass ?? null,
      taskCInitial: resultCInitial.failure?.failureClass ?? null,
      taskCDonor: donorC.failureClass,
    },
    honestClosure: {
      taskA: 'VERIFIED',
      taskB: 'VERIFIED after candidate-organ assimilation and bounded retry',
      taskC: 'BLOCKED after donor differential failure; no installation',
    },
    authorityBoundary: {
      humanDonorSelection: true,
      networkSearch: false,
      candidateOrganCanonical: false,
      canonicalLanguageModified: false,
      rbc13CanonicalModified: false,
    },
    store: subject.store.summary(),
    finalCommitRoot: subject.currentCommit,
    receiptRoots: subject.receipts.map(receipt => receipt.commitRoot),
    growthHistoryRoot: realityRoot(subject.state.growthHistory),
    boundary: 'E01 verifies one bounded living-intelligence lifecycle. It is not an LLM, not autonomous network donor search, not canonical organ promotion, and not general intelligence evidence.',
  };
  const report = Object.freeze({ ...reportWithoutRoot, root: realityRoot(reportWithoutRoot) });
  return Object.freeze({
    report,
    program,
    finalState: clone(subject.state),
    growthHistory: clone(subject.state.growthHistory),
    donorEvidence: { donorB: donorB.evidence, donorC: donorC.evidence },
  });
}
