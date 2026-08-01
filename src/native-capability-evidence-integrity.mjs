import { compileReality } from './compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from './bytecode.mjs';
import { realityRoot } from './canonical.mjs';
import { RCL_DIFFERENTIAL_ABSORPTION_REPORT_FORMAT } from './differential-absorption-runner.mjs';
import {
  RCL_NATIVE_IMPLEMENTATION_MANIFEST_FORMAT,
  RCLNativeCapabilityPromotionError,
  assertObject,
  assertRoot,
  sha256,
  withoutRoot,
} from './native-capability-promotion-shared.mjs';

function verifyObservationIntegrity(observation, context) {
  const value = assertObject(observation, 'RCL_NATIVE_OBSERVATION_INTEGRITY', 'Differential execution observation is missing');
  const semantic = {
    status: value.status,
    output: value.status === 'ok' ? (value.output ?? null) : null,
    error: value.status === 'error' ? (value.error ?? null) : null,
    effects: value.effects ?? [],
    evidence: value.evidence ?? [],
    resourceDelta: value.resourceDelta ?? null,
    authority: value.authority ?? null,
    exitCode: value.exitCode ?? null,
  };
  assertRoot(
    value.semanticRoot,
    realityRoot(semantic),
    'RCL_NATIVE_OBSERVATION_SEMANTIC_INTEGRITY',
    'Differential observation semantic root does not match its content',
    context,
  );
  assertRoot(
    value.root,
    realityRoot(withoutRoot(value)),
    'RCL_NATIVE_OBSERVATION_INTEGRITY',
    'Differential observation root does not match its content',
    context,
  );
}

function verifyAdapterRunIntegrity(run, context) {
  const value = assertObject(run, 'RCL_NATIVE_ADAPTER_RUN_INTEGRITY', 'Differential adapter run is missing');
  for (const item of value.runs ?? []) {
    verifyObservationIntegrity(item.observation, context);
    assertRoot(
      item.root,
      realityRoot({ repetition: item.repetition, observationRoot: item.observation.root }),
      'RCL_NATIVE_EXECUTION_RUN_INTEGRITY',
      'Differential execution run root does not match its observation',
      context,
    );
  }
  verifyObservationIntegrity(value.primary, context);
  assertRoot(
    value.root,
    realityRoot({
      ...withoutRoot(value),
      runs: (value.runs ?? []).map(item => item.root),
      primary: value.primary.root,
    }),
    'RCL_NATIVE_ADAPTER_RUN_INTEGRITY',
    'Differential adapter run root does not match its content',
    context,
  );
}

function verifyDifferentialCaseIntegrity(caseReport) {
  const value = assertObject(caseReport, 'RCL_NATIVE_DIFFERENTIAL_CASE_INTEGRITY', 'Differential case report is missing');
  const context = { caseId: value.id };
  verifyAdapterRunIntegrity(value.source, { ...context, side: 'source' });
  verifyAdapterRunIntegrity(value.absorbed, { ...context, side: 'absorbed' });
  assertRoot(
    value.comparison.root,
    realityRoot(withoutRoot(value.comparison)),
    'RCL_NATIVE_COMPARISON_INTEGRITY',
    'Differential comparison root does not match its content',
    context,
  );
  assertRoot(
    value.root,
    realityRoot({
      ...withoutRoot(value),
      source: value.source.root,
      absorbed: value.absorbed.root,
      comparison: value.comparison.root,
    }),
    'RCL_NATIVE_DIFFERENTIAL_CASE_INTEGRITY',
    'Differential case root does not match its content',
    context,
  );
}

function verifyDifferentialIntegrity(report) {
  for (const caseReport of report.cases ?? []) verifyDifferentialCaseIntegrity(caseReport);
  for (const control of report.negativeControls ?? []) {
    for (const comparison of control.comparisons ?? []) {
      assertRoot(
        comparison.root,
        realityRoot(withoutRoot(comparison)),
        'RCL_NATIVE_CONTROL_COMPARISON_INTEGRITY',
        'Negative-control comparison root does not match its content',
        { controlId: control.id },
      );
    }
    for (const run of control.runs ?? []) verifyAdapterRunIntegrity(run, { controlId: control.id });
    assertRoot(
      control.root,
      realityRoot({
        ...withoutRoot(control),
        comparisons: (control.comparisons ?? []).map(item => item.root),
        runs: (control.runs ?? []).map(item => item.root),
      }),
      'RCL_NATIVE_CONTROL_INTEGRITY',
      'Negative-control report root does not match its content',
      { controlId: control.id },
    );
  }
  assertRoot(
    report.root,
    realityRoot({
      ...withoutRoot(report),
      cases: (report.cases ?? []).map(item => item.root),
      negativeControls: (report.negativeControls ?? []).map(item => item.root),
    }),
    'RCL_NATIVE_DIFFERENTIAL_INTEGRITY',
    'Independent differential report root does not match its content',
  );
}

function verifyMetabolismIntegrity(report) {
  for (const item of report.equivalence?.cases ?? []) {
    assertRoot(
      item.root,
      realityRoot(withoutRoot(item)),
      'RCL_NATIVE_METABOLISM_CASE_INTEGRITY',
      'Metabolism equivalence-case root does not match its content',
      { caseId: item.id },
    );
  }
  assertRoot(
    report.equivalence?.root,
    realityRoot({
      ...withoutRoot(report.equivalence),
      cases: (report.equivalence?.cases ?? []).map(item => item.root),
    }),
    'RCL_NATIVE_METABOLISM_EQUIVALENCE_INTEGRITY',
    'Metabolism equivalence root does not match its content',
  );
  assertRoot(
    report.assessment?.root,
    realityRoot(withoutRoot(report.assessment)),
    'RCL_NATIVE_METABOLISM_ASSESSMENT_INTEGRITY',
    'Metabolism assessment root does not match its content',
  );
  assertRoot(
    report.root,
    realityRoot({
      ...withoutRoot(report),
      generatedRcl: undefined,
      equivalence: report.equivalence.root,
      assessment: report.assessment.root,
    }),
    'RCL_NATIVE_METABOLISM_INTEGRITY',
    'Capability metabolism report root does not match its content',
  );
}

export function verifyManifestIntegrity(manifest) {
  for (const item of manifest.cases ?? []) {
    assertRoot(
      item.root,
      realityRoot(withoutRoot(item)),
      'RCL_NATIVE_IMPLEMENTATION_CASE_INTEGRITY',
      'Native implementation case root does not match its content',
      { caseId: item.id },
    );
  }
  assertRoot(
    manifest.root,
    realityRoot({ ...withoutRoot(manifest), cases: (manifest.cases ?? []).map(item => item.root) }),
    'RCL_NATIVE_IMPLEMENTATION_INTEGRITY',
    'Native implementation manifest root does not match its content',
  );
}

export function validateMetabolismReport(report, capability) {
  const value = assertObject(report, 'RCL_NATIVE_METABOLISM_REPORT_REQUIRED', 'Capability metabolism report is required');
  if (value.format !== 'rcl.capability-metabolism-report.v0.1') {
    throw new RCLNativeCapabilityPromotionError('RCL_NATIVE_METABOLISM_FORMAT', 'Unsupported capability metabolism report format', { format: value.format });
  }
  if (value.capability !== capability) {
    throw new RCLNativeCapabilityPromotionError('RCL_NATIVE_CAPABILITY_MISMATCH', 'Metabolism report capability does not match implementation manifest', {
      expected: capability,
      actual: value.capability,
    });
  }
  verifyMetabolismIntegrity(value);
  if (value.assessment?.stage !== 'native-candidate') {
    throw new RCLNativeCapabilityPromotionError('RCL_NATIVE_CANDIDATE_REQUIRED', 'Only native-candidate metabolism reports may enter native promotion', {
      stage: value.assessment?.stage,
    });
  }
  return value;
}

export function validateDifferentialReport(report, capability) {
  const value = assertObject(report, 'RCL_NATIVE_DIFFERENTIAL_REPORT_REQUIRED', 'Independent differential report is required');
  if (value.format !== RCL_DIFFERENTIAL_ABSORPTION_REPORT_FORMAT) {
    throw new RCLNativeCapabilityPromotionError('RCL_NATIVE_DIFFERENTIAL_FORMAT', 'Unsupported independent differential report format', { format: value.format });
  }
  if (value.capability !== capability) {
    throw new RCLNativeCapabilityPromotionError('RCL_NATIVE_CAPABILITY_MISMATCH', 'Differential report capability does not match implementation manifest', {
      expected: capability,
      actual: value.capability,
    });
  }
  verifyDifferentialIntegrity(value);
  if (value.passed !== true || value.promotionEligible !== true) {
    throw new RCLNativeCapabilityPromotionError('RCL_NATIVE_DIFFERENTIAL_PASS_REQUIRED', 'Native promotion requires a passed, promotion-eligible independent differential report', {
      passed: value.passed,
      promotionEligible: value.promotionEligible,
    });
  }
  return value;
}

export function alignDifferentialCases(manifest, differential) {
  const differentialById = new Map((differential.cases ?? []).map(item => [item.id, item]));
  const manifestIds = manifest.cases.map(item => item.id);
  const differentialIds = [...differentialById.keys()];
  const missing = manifestIds.filter(id => !differentialById.has(id));
  const extra = differentialIds.filter(id => !manifestIds.includes(id));
  if (missing.length > 0 || extra.length > 0) {
    throw new RCLNativeCapabilityPromotionError('RCL_NATIVE_CASE_ALIGNMENT', 'Native implementation and differential case sets must match exactly', { missing, extra });
  }
  for (const id of manifestIds) {
    const artifactRoot = differentialById.get(id)?.absorbed?.adapter?.artifactRoot ?? null;
    if (artifactRoot !== manifest.root) {
      throw new RCLNativeCapabilityPromotionError('RCL_NATIVE_ARTIFACT_BINDING', `Differential case '${id}' is not bound to the native implementation manifest`, {
        caseId: id,
        expectedArtifactRoot: manifest.root,
        actualArtifactRoot: artifactRoot,
      });
    }
  }
  return differentialById;
}

export function verifyManifestCase(caseManifest) {
  const program = compileReality(caseManifest.source);
  const bytecode = compileRealityToBytecode(program);
  const decoded = decodeBytecode(bytecode);
  const current = {
    sourceTextRoot: realityRoot(caseManifest.source),
    programRoot: program.programRoot,
    bytecodeSha256: sha256(bytecode),
    byteLength: bytecode.length,
    instructionCount: decoded.instructions.length,
  };
  const checks = {
    sourceTextRoot: current.sourceTextRoot === caseManifest.sourceTextRoot,
    programRoot: current.programRoot === caseManifest.programRoot,
    bytecodeSha256: current.bytecodeSha256 === caseManifest.bytecodeSha256,
    byteLength: current.byteLength === caseManifest.byteLength,
    instructionCount: current.instructionCount === caseManifest.instructionCount,
  };
  return { program, bytecode, decoded, current, checks, intact: Object.values(checks).every(Boolean) };
}

export function assertImplementationManifestFormat(manifest) {
  const value = assertObject(manifest, 'RCL_NATIVE_IMPLEMENTATION_MANIFEST_REQUIRED', 'Native implementation manifest is required');
  if (value.format !== RCL_NATIVE_IMPLEMENTATION_MANIFEST_FORMAT) {
    throw new RCLNativeCapabilityPromotionError('RCL_NATIVE_IMPLEMENTATION_FORMAT', 'Unsupported native implementation manifest format', { format: value.format });
  }
  return value;
}
