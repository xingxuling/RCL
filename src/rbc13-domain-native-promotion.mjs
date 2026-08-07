import { realityRoot } from './canonical.mjs';
import { createExecutionObservation, runIndependentDifferentialAbsorption } from './differential-absorption-runner.mjs';
import { invokeRbc13DomainCallReference } from './rbc13-domain-call-salvage.mjs';
import { buildAllRbc13DomainOrganCandidatePlans } from './rbc13-domain-organ-candidate-plan.mjs';
import { rbc13DomainOperationCases } from './rbc13-domain-operation-differential.mjs';
import {
  buildRbc13DomainCandidateHost,
  buildRbc13NativeOperationProgram,
  resolveDomainCandidateCompiler,
} from './rbc13-domain-native-runtime.mjs';
import { admitNativeVerifiedDomainOrgan } from './domain-operation-organ.mjs';

export const RBC13_DOMAIN_NATIVE_PROMOTION_VERSION = '0.1.0-alpha.1';
export const RBC13_DOMAIN_NATIVE_PROMOTION_REPORT_FORMAT =
  'rcl.domain-organ-native-promotion-report.v0.1';

function pureOperationObservation(output) {
  return createExecutionObservation({
    status: 'ok',
    output,
    effects: [{ kind: 'internal-domain-evaluation', externalMutation: false, persistentMutation: false }],
    evidence: [{ kind: 'semantic-contract', contract: 'rbc13-domain-operation-differential.v0.1' }],
    resourceDelta: { externalResourcesCreated: 0, externalResourcesMutated: 0, persistentStateMutation: false },
    authority: { required: false, boundary: 'pure-internal-domain-operation' },
    exitCode: 0,
  });
}

function currentExecute(input) {
  return pureOperationObservation(invokeRbc13DomainCallReference(
    input?.domain,
    input?.operation,
    input?.args ?? [],
  ));
}

function positiveCaseIds(cases) {
  return new Set(cases.filter(item => item.tags?.includes('positive')).map(item => item.id));
}

function nativeRootChecks(nativeDifferential, cases) {
  const positives = positiveCaseIds(cases);
  const checks = [];
  for (const item of nativeDifferential.cases ?? []) {
    if (!positives.has(item.id)) continue;
    for (const run of item.absorbed?.runs ?? []) {
      const receipt = run.observation?.receipts?.find(candidate => candidate?.format === 'rcl.rbc13-domain-native-receipt.v0.1');
      checks.push(Object.freeze({
        caseId: item.id,
        repetition: run.repetition,
        receiptPresent: Boolean(receipt),
        stateRootVerified: receipt?.stateRootVerified === true,
        nativeStateRoot: receipt?.nativeStateRoot ?? null,
        bytecodeRoot: receipt?.bytecodeRoot ?? null,
        hostRoot: receipt?.hostRoot ?? null,
        passed: Boolean(receipt) && receipt.stateRootVerified === true,
      }));
    }
  }
  return checks;
}

function deterministicCaseManifest(operationKey, cases) {
  return Object.freeze(cases.map(testCase => {
    const first = buildRbc13NativeOperationProgram(testCase.input);
    const second = buildRbc13NativeOperationProgram(testCase.input);
    const deterministic = first.bytecode.equals(second.bytecode) && first.bytecodeRoot === second.bytecodeRoot;
    const manifest = {
      id: testCase.id,
      operationKey,
      inputRoot: realityRoot(testCase.input),
      bytecodeVersion: '1.3',
      opcode: 45,
      bytecodeRoot: first.bytecodeRoot,
      byteLength: first.bytecode.length,
      callCount: first.calls.length,
      deterministic,
    };
    return Object.freeze({ ...manifest, root: realityRoot(manifest) });
  }));
}

async function runNativeDifferential(plan, runtime, options = {}) {
  const cases = rbc13DomainOperationCases(plan.operationKey);
  return runIndependentDifferentialAbsorption({
    capability: plan.differential.capability,
    source: {
      id: `current_${plan.operationKey.replaceAll('.', '_')}_promotion_oracle`,
      runtime: 'rcl-current-source-modules',
      provenance: ['src/rbc13-domain-call-salvage.mjs', 'src/quantity.mjs', 'src/knowledge.mjs'],
      execute: currentExecute,
    },
    absorbed: {
      id: `native_${plan.operationKey.replaceAll('.', '_')}_opcode45_candidate`,
      runtime: 'rcl-rbc13-domain-candidate-native-process',
      artifactRoot: runtime.hostRoot,
      provenance: [
        'native/rcl_domain_admitted_organs.c',
        'native/rcl_domain_organ.c',
        'native/rcl_domain_value.c',
        'scripts/materialize-rbc13-domain-vm-public-api.mjs',
      ],
      execute(input, context) {
        return runtime.execute(input, {
          caseId: `${plan.operationKey.replaceAll('.', '_')}_${context.caseId}`,
          timeout: options.runTimeout,
        });
      },
    },
    cases,
    repeats: options.nativeRepeats ?? 2,
    timeoutMs: options.differentialTimeout ?? 60_000,
    requireDeterministicReplay: true,
    requireNegativeControl: false,
    negativeControls: [],
  });
}

export async function promoteRbc13DomainOrganPlan(plan, runtime, options = {}) {
  if (!plan || plan.format !== 'taowind.rcl-rbc13-domain-organ-candidate-plan.v0.1') {
    throw new TypeError('A valid RBC13 Domain Organ candidate plan is required');
  }
  if (!runtime || runtime.format !== 'taowind.rcl-rbc13-domain-native-runtime.v0.1') {
    throw new TypeError('A built RBC13 Domain Organ candidate runtime is required');
  }
  if (!plan.differential?.passed || !plan.differential?.promotionEligible) {
    const error = new Error(`Operation ${plan.operationKey} has not cleared its semantic differential gate`);
    error.code = 'RCL_RBC13_DOMAIN_SEMANTIC_GATE';
    throw error;
  }

  const cases = rbc13DomainOperationCases(plan.operationKey);
  const caseManifest = deterministicCaseManifest(plan.operationKey, cases);
  const nativeDifferential = await runNativeDifferential(plan, runtime, options);
  const rootChecks = nativeRootChecks(nativeDifferential, cases);
  const bytecodeDeterministic = caseManifest.every(item => item.deterministic);
  const replayDeterministic = nativeDifferential.cases.every(item => item.absorbed?.deterministic === true);
  const currentNativeEquivalent = nativeDifferential.passed === true
    && nativeDifferential.cases.every(item => item.comparison?.passed === true);
  const nativeRootsVerified = rootChecks.length > 0 && rootChecks.every(item => item.passed);
  const hostBound = typeof runtime.hostRoot === 'string' && /^[a-f0-9]{64}$/.test(runtime.hostRoot);
  const sharedImplementationBound = typeof runtime.implementationRoot === 'string'
    && /^[a-f0-9]{64}$/.test(runtime.implementationRoot);
  const operationImplementationRoot = realityRoot({
    operationKey: plan.operationKey,
    implementationId: plan.candidate.implementation.id,
    sharedImplementationRoot: runtime.implementationRoot,
    materializedVmRoot: runtime.materializedVmRoot,
    sourceRoot: runtime.sourceRoots['native/rcl_domain_admitted_organs.c'],
  });

  const checks = Object.freeze({
    semanticDifferentialPassed: true,
    semanticDifferentialPromotionEligible: true,
    nativeDifferentialPassed: nativeDifferential.passed === true,
    currentNativeEquivalent,
    bytecodeDeterministic,
    replayDeterministic,
    nativeRootsVerified,
    hostBound,
    sharedImplementationBound,
    caseCountAligned: nativeDifferential.caseCount === caseManifest.length,
  });
  const verified = Object.values(checks).every(Boolean);
  const caseReports = caseManifest.map(manifest => {
    const differentialCase = nativeDifferential.cases.find(item => item.id === manifest.id);
    const report = {
      id: manifest.id,
      manifestRoot: manifest.root,
      bytecodeRoot: manifest.bytecodeRoot,
      byteLength: manifest.byteLength,
      deterministicBytecode: manifest.deterministic,
      semanticEquivalent: differentialCase?.comparison?.equivalent === true,
      replayPassed: differentialCase?.comparison?.replayPassed === true,
      sourceSemanticRoot: differentialCase?.comparison?.sourceSemanticRoot ?? null,
      nativeSemanticRoot: differentialCase?.comparison?.absorbedSemanticRoot ?? null,
      verified: manifest.deterministic
        && differentialCase?.comparison?.passed === true,
    };
    return Object.freeze({ ...report, root: realityRoot(report) });
  });

  const report = {
    format: RBC13_DOMAIN_NATIVE_PROMOTION_REPORT_FORMAT,
    version: RBC13_DOMAIN_NATIVE_PROMOTION_VERSION,
    operationKey: plan.operationKey,
    capability: plan.differential.capability,
    status: verified ? 'native-verified' : 'native-rejected',
    verified,
    promotionEligible: verified,
    candidateRoot: plan.candidate.root,
    semanticDifferentialRoot: plan.differential.differentialRoot,
    nativeDifferentialRoot: nativeDifferential.root,
    implementationRoot: operationImplementationRoot,
    sharedImplementationRoot: runtime.implementationRoot,
    nativeVm: {
      experimental: true,
      materializedFromCurrentSource: true,
      hostRoot: runtime.hostRoot,
      materializedVmRoot: runtime.materializedVmRoot,
      compiler: runtime.compiler,
      compilerVersion: runtime.compilerVersion,
    },
    checks,
    caseCount: caseReports.length,
    verifiedCaseCount: caseReports.filter(item => item.verified).length,
    failedCaseCount: caseReports.filter(item => !item.verified).length,
    cases: caseReports,
    nativeRootChecks: rootChecks,
    proofChain: [
      { kind: 'operation-semantic-differential', root: plan.differential.differentialRoot },
      { kind: 'native-process-differential', root: nativeDifferential.root },
      { kind: 'operation-implementation', root: operationImplementationRoot },
      { kind: 'candidate-native-host', root: runtime.hostRoot },
    ],
    gaps: verified ? [] : Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name),
    bindingProofLevel: 'current-source-materialized-candidate-vm-plus-vm-emitted-semantic-root',
    boundary:
      'native-verified is operation-, case-, host- and experimental-RBC-bound. It proves the declared cases through an independently invoked C candidate host materialized from current native VM source. It does not admit RBC 1.3 into the canonical language or prove the other quarantined historical operations.',
  };
  return Object.freeze({
    ...report,
    root: realityRoot({
      ...report,
      cases: caseReports.map(item => item.root),
      nativeRootChecks: rootChecks.map(item => realityRoot(item)),
    }),
    nativeDifferential,
  });
}

export async function promoteAllRbc13DomainOrgans(options = {}) {
  const compiler = resolveDomainCandidateCompiler(options);
  if (!compiler) {
    return Object.freeze({
      format: 'rcl.domain-organ-native-promotion-suite.v0.1',
      status: 'native-blocked',
      verified: false,
      blocker: 'native-compiler-missing',
      reports: Object.freeze([]),
    });
  }

  const plans = await buildAllRbc13DomainOrganCandidatePlans(options);
  const runtime = buildRbc13DomainCandidateHost({ ...options, compiler });
  try {
    const reports = [];
    const verifiedOrgans = [];
    for (const plan of plans) {
      const report = await promoteRbc13DomainOrganPlan(plan, runtime, options);
      reports.push(report);
      if (report.verified) {
        verifiedOrgans.push(admitNativeVerifiedDomainOrgan({
          candidate: plan.candidate,
          nativePromotionReport: report,
          canonicalAdmission: false,
        }));
      }
    }
    const verified = reports.length === plans.length && reports.every(item => item.verified);
    const suite = {
      format: 'rcl.domain-organ-native-promotion-suite.v0.1',
      status: verified ? 'native-verified' : 'native-rejected',
      verified,
      hostRoot: runtime.hostRoot,
      sharedImplementationRoot: runtime.implementationRoot,
      reportRoots: reports.map(item => item.root),
      verifiedOrganRoots: verifiedOrgans.map(item => item.root),
      canonicalAdmission: false,
      boundary: 'Suite verification does not canonize RBC 1.3. Each result remains bounded to the declared operation corpus and selected materialized native host.',
    };
    return Object.freeze({ ...suite, root: realityRoot(suite), reports: Object.freeze(reports), verifiedOrgans: Object.freeze(verifiedOrgans) });
  } finally {
    runtime.close();
  }
}
