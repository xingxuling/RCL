import { realityRoot } from './canonical.mjs';
import { compileReality } from './compiler.mjs';
import { materializeRclAbsorptionKernel } from './absorption-kernel.mjs';
import { createContentAddressedRealityStore } from './reality-store.mjs';

export const RCL_CAPABILITY_METABOLISM_VERSION = '0.1.0-alpha.1';
export const RCL_CAPABILITY_SPEC_FORMAT = 'rcl.external-capability-spec.v0.1';

export const CAPABILITY_METABOLISM_STAGES = Object.freeze([
  'observed',
  'semantic-absorbed',
  'bridge-verified',
  'native-candidate',
  'rejected',
]);

export class RCLCapabilityMetabolismError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RCLCapabilityMetabolismError';
    this.code = code;
    this.details = details;
  }
}

function assertObject(value, code, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RCLCapabilityMetabolismError(code, message, { value });
  }
  return value;
}

function nonEmptyString(value, code, message) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RCLCapabilityMetabolismError(code, message, { value });
  }
  return value.trim();
}

function uniqueStrings(values = []) {
  return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
}

function safeIdentifier(value, fallback = 'absorbed_capability') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^([^A-Za-z_])/, '_$1')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function pascalIdentifier(value) {
  return safeIdentifier(value)
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function quote(value) {
  return JSON.stringify(String(value));
}

function normalizeEffect(effect) {
  if (typeof effect === 'string') {
    return Object.freeze({
      name: nonEmptyString(effect, 'RCL_METABOLISM_EFFECT_NAME', 'Effect name must be non-empty'),
      deterministic: true,
      replay: 'deterministic',
      evidenceRequired: false,
      description: '',
    });
  }
  assertObject(effect, 'RCL_METABOLISM_EFFECT_INVALID', 'Effect must be a string or object');
  return Object.freeze({
    name: nonEmptyString(effect.name, 'RCL_METABOLISM_EFFECT_NAME', 'Effect requires a name'),
    deterministic: effect.deterministic !== false,
    replay: String(effect.replay ?? (effect.deterministic === false ? 'requires-provider-receipt' : 'deterministic')),
    evidenceRequired: Boolean(effect.evidenceRequired),
    description: String(effect.description ?? ''),
  });
}

function normalizeEquivalenceCase(testCase, index) {
  assertObject(testCase, 'RCL_METABOLISM_EQUIVALENCE_INVALID', 'Equivalence case must be an object');
  const id = safeIdentifier(testCase.id ?? `case_${index + 1}`);
  if (!Object.hasOwn(testCase, 'sourceOutput') || !Object.hasOwn(testCase, 'absorbedOutput')) {
    throw new RCLCapabilityMetabolismError(
      'RCL_METABOLISM_EQUIVALENCE_OUTPUTS_REQUIRED',
      `Equivalence case '${id}' requires sourceOutput and absorbedOutput`,
      { id },
    );
  }
  return Object.freeze({
    id,
    input: testCase.input ?? null,
    sourceOutput: testCase.sourceOutput,
    absorbedOutput: testCase.absorbedOutput,
    sourceEvidence: testCase.sourceEvidence ?? null,
    absorbedEvidence: testCase.absorbedEvidence ?? null,
  });
}

export function normalizeExternalCapabilitySpec(input) {
  const raw = typeof input === 'string' ? JSON.parse(input) : input;
  assertObject(raw, 'RCL_METABOLISM_SPEC_INVALID', 'External capability specification must be an object or JSON object string');

  const source = assertObject(raw.source, 'RCL_METABOLISM_SOURCE_REQUIRED', 'Capability specification requires source metadata');
  const operation = assertObject(raw.operation, 'RCL_METABOLISM_OPERATION_REQUIRED', 'Capability specification requires an operation');
  const semantics = assertObject(raw.semantics, 'RCL_METABOLISM_SEMANTICS_REQUIRED', 'Capability specification requires semantics');
  const lowering = assertObject(raw.lowering, 'RCL_METABOLISM_LOWERING_REQUIRED', 'Capability specification requires lowering metadata');

  const effects = (semantics.effects ?? []).map(normalizeEffect);
  const invariants = uniqueStrings(semantics.invariants ?? []);
  const targets = uniqueStrings(lowering.targets ?? []);
  if (effects.length === 0) throw new RCLCapabilityMetabolismError('RCL_METABOLISM_EFFECTS_REQUIRED', 'At least one semantic effect is required');
  if (invariants.length === 0) throw new RCLCapabilityMetabolismError('RCL_METABOLISM_INVARIANTS_REQUIRED', 'At least one invariant is required');
  if (targets.length === 0) throw new RCLCapabilityMetabolismError('RCL_METABOLISM_TARGETS_REQUIRED', 'At least one lowering target is required');

  const id = safeIdentifier(nonEmptyString(raw.id, 'RCL_METABOLISM_ID_REQUIRED', 'Capability specification requires an id'));
  const normalized = {
    format: RCL_CAPABILITY_SPEC_FORMAT,
    id,
    version: String(raw.version ?? '0.1.0'),
    source: {
      ecosystem: nonEmptyString(source.ecosystem, 'RCL_METABOLISM_ECOSYSTEM_REQUIRED', 'Source ecosystem is required'),
      construct: nonEmptyString(source.construct, 'RCL_METABOLISM_CONSTRUCT_REQUIRED', 'Source construct is required'),
      version: String(source.version ?? 'unknown'),
      license: source.license ? String(source.license) : null,
      referenceRoot: source.referenceRoot ? String(source.referenceRoot) : null,
    },
    operation: {
      name: safeIdentifier(nonEmptyString(operation.name, 'RCL_METABOLISM_OPERATION_NAME_REQUIRED', 'Operation name is required')),
      inputs: uniqueStrings(operation.inputs ?? []),
      outputs: uniqueStrings(operation.outputs ?? []),
    },
    semantics: {
      description: String(semantics.description ?? ''),
      effects,
      invariants,
      failureModes: uniqueStrings(semantics.failureModes ?? []),
      resourceModel: uniqueStrings(semantics.resourceModel ?? []),
      authority: uniqueStrings(semantics.authority ?? []),
    },
    lowering: {
      targets: targets.map(target => safeIdentifier(target)),
      providerRequired: lowering.providerRequired !== false,
      provider: lowering.provider ? String(lowering.provider) : null,
      nativeLoweringWitness: lowering.nativeLoweringWitness ?? null,
    },
    evidence: {
      equivalenceCases: (raw.evidence?.equivalenceCases ?? []).map(normalizeEquivalenceCase),
      provenance: uniqueStrings(raw.evidence?.provenance ?? []),
    },
    synthesis: {
      tags: uniqueStrings(raw.synthesis?.tags ?? []),
      compatibleWith: uniqueStrings(raw.synthesis?.compatibleWith ?? []).map(item => safeIdentifier(item)),
      conflictsWith: uniqueStrings(raw.synthesis?.conflictsWith ?? []).map(item => safeIdentifier(item)),
    },
  };

  return Object.freeze({ ...normalized, root: realityRoot(normalized) });
}

export function extractCapabilitySemanticKernel(input) {
  const spec = input?.format === RCL_CAPABILITY_SPEC_FORMAT ? input : normalizeExternalCapabilitySpec(input);
  const kernel = {
    format: 'rcl.capability-semantic-kernel.v0.1',
    capability: spec.id,
    sourceIdentity: `${spec.source.ecosystem}:${spec.source.construct}@${spec.source.version}`,
    operation: spec.operation,
    effects: spec.semantics.effects,
    invariants: spec.semantics.invariants,
    failureModes: spec.semantics.failureModes,
    resourceModel: spec.semantics.resourceModel,
    authority: spec.semantics.authority,
    lowering: spec.lowering,
    synthesis: spec.synthesis,
    sourceRoot: spec.root,
  };
  return Object.freeze({ ...kernel, root: realityRoot(kernel) });
}

export function evaluateDeclaredEquivalence(input) {
  const spec = input?.format === RCL_CAPABILITY_SPEC_FORMAT ? input : normalizeExternalCapabilitySpec(input);
  const cases = spec.evidence.equivalenceCases.map(testCase => {
    const sourceRoot = realityRoot(testCase.sourceOutput);
    const absorbedRoot = realityRoot(testCase.absorbedOutput);
    const passed = sourceRoot === absorbedRoot;
    const result = {
      id: testCase.id,
      inputRoot: realityRoot(testCase.input),
      sourceRoot,
      absorbedRoot,
      passed,
      evidenceRoots: [testCase.sourceEvidence, testCase.absorbedEvidence].filter(Boolean).map(realityRoot),
    };
    return Object.freeze({ ...result, root: realityRoot(result) });
  });
  const passed = cases.length > 0 && cases.every(testCase => testCase.passed);
  const report = {
    format: 'rcl.declared-equivalence-report.v0.1',
    capability: spec.id,
    evidenceKind: 'declared-output-equivalence',
    caseCount: cases.length,
    passedCount: cases.filter(testCase => testCase.passed).length,
    failedCount: cases.filter(testCase => !testCase.passed).length,
    passed,
    cases,
    boundary: 'This verifies canonical equality of supplied source and absorbed outputs. It is not independent execution of the external runtime.',
  };
  return Object.freeze({ ...report, root: realityRoot({ ...report, cases: cases.map(testCase => testCase.root) }) });
}

export function renderCapabilityAsRcl(input) {
  const spec = input?.format === RCL_CAPABILITY_SPEC_FORMAT ? input : normalizeExternalCapabilitySpec(input);
  const realityName = `Absorbed${pascalIdentifier(spec.id)}`;
  const effectNames = spec.semantics.effects.map(effect => safeIdentifier(effect.name));
  const allowEffects = uniqueStrings([...effectNames, 'Evidence', 'Preserve']);
  if (spec.lowering.providerRequired) allowEffects.push('HostCall');

  const effectBlocks = spec.semantics.effects.map(effect => [
    `  effect ${safeIdentifier(effect.name)} {`,
    `    deterministic ${effect.deterministic ? 'true' : 'false'}`,
    `    replay ${quote(effect.replay)}`,
    `    evidence_required ${effect.evidenceRequired ? 'true' : 'false'}`,
    effect.description ? `    description ${quote(effect.description)}` : null,
    '  }',
  ].filter(Boolean).join('\n')).join('\n\n');

  const operationLines = [
    ...spec.operation.inputs.map(type => `      input ${safeIdentifier(type)}`),
    ...spec.operation.outputs.map(type => `      output ${safeIdentifier(type)}`),
    `      effect ${effectNames.join(', ')}`,
    `      lowers_to ${spec.lowering.targets.join(', ')}`,
  ];

  const source = [
    `reality ${realityName} {`,
    `  dialect ${spec.id} {`,
    '    layer semantic',
    `    domain ${safeIdentifier(spec.source.ecosystem)}`,
    `    description ${quote(spec.semantics.description || `Absorbed ${spec.source.ecosystem} ${spec.source.construct} capability.`)}`,
    `    lowers_to ${spec.lowering.targets.join(', ')}`,
    `    operation ${spec.operation.name} {`,
    ...operationLines,
    '    }',
    ...spec.semantics.invariants.map(invariant => `    invariant ${quote(invariant)}`),
    '  }',
    '',
    effectBlocks,
    '',
    `  capability_policy metabolize_${spec.id} {`,
    `    allow_effect ${uniqueStrings(allowEffects).join(', ')}`,
    spec.lowering.providerRequired ? null : '    deny_effect HostCall',
    `    budget max_host_calls ${spec.lowering.providerRequired ? 1 : 0}`,
    '    require_deterministic_replay false',
    '  }',
    '',
    `  store metabolism_${spec.id} {`,
    '    branch candidate',
    `    commit ${quote(`metabolize ${spec.source.ecosystem}:${spec.source.construct} into ${spec.id}`)}`,
    '  }',
    '',
    `  verify metabolize_${spec.id}`,
    `  snapshot metabolism_${spec.id}`,
    '}',
    '',
  ].filter(line => line !== null).join('\n');

  const program = compileReality(source);
  return Object.freeze({
    format: 'rcl.capability-metabolism-source.v0.1',
    capability: spec.id,
    source,
    program,
    root: realityRoot({ capability: spec.id, source, programRoot: program.programRoot }),
  });
}

function assessMetabolism(spec, equivalence) {
  const gaps = [];
  if (spec.evidence.equivalenceCases.length === 0) gaps.push('no-equivalence-cases');
  if (equivalence.failedCount > 0) gaps.push('equivalence-mismatch');
  if (spec.lowering.providerRequired) gaps.push('provider-dependency-remains');
  if (!spec.lowering.nativeLoweringWitness) gaps.push('native-lowering-witness-missing');
  if (spec.semantics.failureModes.length === 0) gaps.push('failure-model-missing');
  if (spec.semantics.resourceModel.length === 0) gaps.push('resource-model-missing');
  if (spec.semantics.authority.length === 0) gaps.push('authority-model-missing');

  let stage = 'semantic-absorbed';
  if (equivalence.failedCount > 0) stage = 'rejected';
  else if (equivalence.passed && spec.lowering.providerRequired) stage = 'bridge-verified';
  else if (equivalence.passed && !spec.lowering.providerRequired && spec.lowering.nativeLoweringWitness) stage = 'native-candidate';

  const retainedDimensions = [
    spec.operation.inputs.length > 0 || spec.operation.outputs.length > 0,
    spec.semantics.effects.length > 0,
    spec.semantics.invariants.length > 0,
    spec.semantics.failureModes.length > 0,
    spec.semantics.resourceModel.length > 0,
    spec.semantics.authority.length > 0,
    spec.lowering.targets.length > 0,
    equivalence.passed,
  ];
  const semanticRetention = retainedDimensions.filter(Boolean).length / retainedDimensions.length;
  const runtimeIndependence = spec.lowering.providerRequired ? 0.25 : (spec.lowering.nativeLoweringWitness ? 0.75 : 0.5);
  const evidenceStrength = equivalence.caseCount === 0 ? 0 : equivalence.passedCount / equivalence.caseCount;
  const assessment = {
    stage,
    semanticRetention,
    runtimeIndependence,
    evidenceStrength,
    compositeScore: Number((semanticRetention * 0.45 + runtimeIndependence * 0.3 + evidenceStrength * 0.25).toFixed(6)),
    gaps,
  };
  return Object.freeze({ ...assessment, root: realityRoot(assessment) });
}

export function metabolizeExternalCapability(input, options = {}) {
  const spec = normalizeExternalCapabilitySpec(input);
  const kernel = extractCapabilitySemanticKernel(spec);
  const generated = renderCapabilityAsRcl(spec);
  const absorption = materializeRclAbsorptionKernel(generated.program, {
    policyName: `metabolize_${spec.id}`,
    storeName: `metabolism_${spec.id}`,
  });
  const equivalence = evaluateDeclaredEquivalence(spec);
  const assessment = assessMetabolism(spec, equivalence);

  const store = createContentAddressedRealityStore();
  const specObject = store.putObject(spec, { type: 'external-capability-spec' });
  const kernelObject = store.putObject(kernel, { type: 'capability-semantic-kernel' });
  const generatedObject = store.putObject({ source: generated.source, programRoot: generated.program.programRoot }, { type: 'generated-rcl' });
  const equivalenceEvidence = store.putEvidence(equivalence, { type: equivalence.evidenceKind });
  const assessmentEvidence = store.putEvidence(assessment, { type: 'metabolism-assessment' });
  const event = store.putEvent({
    type: assessment.stage === 'rejected' ? 'capability.metabolism.rejected' : 'capability.metabolism.assessed',
    subject: options.subject ?? 'rcl',
    payload: { capability: spec.id, stage: assessment.stage, score: assessment.compositeScore },
    evidence: [equivalenceEvidence, assessmentEvidence],
  });
  const tree = store.putTree([
    { path: 'spec.json', root: specObject, type: 'external-capability-spec' },
    { path: 'semantic-kernel.json', root: kernelObject, type: 'capability-semantic-kernel' },
    { path: 'generated.rcl.json', root: generatedObject, type: 'generated-rcl' },
  ]);
  const commit = store.putCommit({
    tree,
    events: [event],
    evidence: [equivalenceEvidence, assessmentEvidence],
    message: `metabolize capability ${spec.id}`,
    author: options.subject ?? 'rcl',
    metadata: { stage: assessment.stage, source: kernel.sourceIdentity },
  });
  store.createBranch('candidate', commit);

  const report = {
    format: 'rcl.capability-metabolism-report.v0.1',
    version: RCL_CAPABILITY_METABOLISM_VERSION,
    capability: spec.id,
    sourceIdentity: kernel.sourceIdentity,
    specRoot: spec.root,
    semanticKernelRoot: kernel.root,
    generatedRclRoot: generated.root,
    absorptionRoot: absorption.root,
    equivalence,
    assessment,
    generatedRcl: generated.source,
    synthesisHooks: {
      tags: spec.synthesis.tags,
      compatibleWith: spec.synthesis.compatibleWith,
      conflictsWith: spec.synthesis.conflictsWith,
      exportedEffects: spec.semantics.effects.map(effect => effect.name),
      exportedInvariants: spec.semantics.invariants,
    },
    store: store.summary(),
    commit,
    boundary: 'A native-candidate is not a native-runtime claim. Native status requires independent execution and parity evidence from the target RCL runtime.',
  };
  return Object.freeze({ ...report, root: realityRoot({
    ...report,
    generatedRcl: undefined,
    equivalence: equivalence.root,
    assessment: assessment.root,
  }) });
}

export function synthesizeAbsorbedCapabilities(reports, options = {}) {
  if (!Array.isArray(reports) || reports.length < 2) {
    throw new RCLCapabilityMetabolismError('RCL_METABOLISM_SYNTHESIS_ARITY', 'At least two metabolism reports are required for synthesis');
  }
  for (const report of reports) {
    if (report?.format !== 'rcl.capability-metabolism-report.v0.1') {
      throw new RCLCapabilityMetabolismError('RCL_METABOLISM_SYNTHESIS_REPORT', 'Synthesis accepts only capability metabolism reports', { format: report?.format });
    }
    if (report.assessment.stage === 'rejected') {
      throw new RCLCapabilityMetabolismError('RCL_METABOLISM_SYNTHESIS_REJECTED', `Rejected capability '${report.capability}' cannot be synthesized`);
    }
  }

  const capabilities = reports.map(report => report.capability);
  const conflicts = [];
  for (const report of reports) {
    for (const conflict of report.synthesisHooks.conflictsWith) {
      if (capabilities.includes(conflict)) conflicts.push(`${report.capability}<->${conflict}`);
    }
  }
  const compound = {
    format: 'rcl.compound-capability-organ.v0.1',
    id: safeIdentifier(options.id ?? capabilities.join('_x_')),
    capabilities,
    sourceRoots: reports.map(report => report.root),
    effects: uniqueStrings(reports.flatMap(report => report.synthesisHooks.exportedEffects)),
    invariants: uniqueStrings(reports.flatMap(report => report.synthesisHooks.exportedInvariants)),
    tags: uniqueStrings(reports.flatMap(report => report.synthesisHooks.tags)),
    conflicts: uniqueStrings(conflicts),
    status: conflicts.length > 0 ? 'conflicted-candidate' : 'candidate',
    crossDomainGain: Math.max(0, capabilities.length * (capabilities.length - 1) / 2),
    boundary: 'Cross-domain gain counts possible pairwise synthesis edges; it is not a performance benchmark.',
  };
  return Object.freeze({ ...compound, root: realityRoot(compound) });
}
