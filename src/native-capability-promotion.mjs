import { realityRoot } from './canonical.mjs';
import { DEFAULT_NATIVE_VM_PATH, verifyNativeParity } from './native-vm.mjs';
import { createNativeRuntimeObservation } from './native-capability-implementation.mjs';
import {
  alignDifferentialCases,
  assertImplementationManifestFormat,
  validateDifferentialReport,
  validateMetabolismReport,
  verifyManifestCase,
  verifyManifestIntegrity,
} from './native-capability-evidence-integrity.mjs';
import {
  RCL_NATIVE_CAPABILITY_PROMOTION_VERSION,
  RCL_NATIVE_PROMOTION_REPORT_FORMAT,
  RCLNativeCapabilityPromotionError,
  assertObject,
  executableFormat,
} from './native-capability-promotion-shared.mjs';

export {
  RCL_NATIVE_CAPABILITY_PROMOTION_VERSION,
  RCL_NATIVE_IMPLEMENTATION_MANIFEST_FORMAT,
  RCL_NATIVE_PROMOTION_REPORT_FORMAT,
  RCL_NATIVE_PROMOTION_STATUSES,
  RCLNativeCapabilityPromotionError,
} from './native-capability-promotion-shared.mjs';
export {
  createNativeCapabilityImplementationManifest,
  createNativeRuntimeObservation,
} from './native-capability-implementation.mjs';

export async function promoteCapabilityToNative(input) {
  const raw = assertObject(input, 'RCL_NATIVE_PROMOTION_REQUEST_INVALID', 'Native capability promotion request must be an object');
  const manifest = assertImplementationManifestFormat(raw.implementationManifest);
  verifyManifestIntegrity(manifest);
  const capability = manifest.capability;
  const metabolism = validateMetabolismReport(raw.metabolismReport, capability);
  const differential = validateDifferentialReport(raw.differentialReport, capability);
  const differentialById = alignDifferentialCases(manifest, differential);
  const vmPath = raw.vmPath ?? DEFAULT_NATIVE_VM_PATH;
  const vmFormat = executableFormat(vmPath);

  if (!vmFormat.exists) {
    const report = {
      format: RCL_NATIVE_PROMOTION_REPORT_FORMAT,
      version: RCL_NATIVE_CAPABILITY_PROMOTION_VERSION,
      capability,
      status: 'native-blocked',
      verified: false,
      promotionEligible: false,
      implementationRoot: manifest.root,
      metabolismRoot: metabolism.root,
      differentialRoot: differential.root,
      nativeVm: { path: vmPath, ...vmFormat },
      cases: [],
      gaps: ['native-vm-missing'],
      boundary: 'The native VM was not available, so no native-runtime claim is made.',
    };
    return Object.freeze({ ...report, root: realityRoot(report) });
  }

  const caseReports = [];
  for (const caseManifest of manifest.cases) {
    const integrity = verifyManifestCase(caseManifest);
    if (!integrity.intact) {
      throw new RCLNativeCapabilityPromotionError('RCL_NATIVE_IMPLEMENTATION_DRIFT', `Native implementation case '${caseManifest.id}' no longer matches its manifest`, {
        caseId: caseManifest.id,
        checks: integrity.checks,
        current: integrity.current,
      });
    }

    const parity = await verifyNativeParity(caseManifest.source, {
      nativeRuntime: { vmPath, timeout: raw.timeout ?? 30_000 },
      referenceRuntime: raw.referenceRuntime ?? {},
    });
    const referenceObservation = createNativeRuntimeObservation(parity.reference);
    const nativeObservation = createNativeRuntimeObservation(parity.native);
    const differentialCase = differentialById.get(caseManifest.id);
    const absorbedRoot = differentialCase.absorbed.primary.semanticRoot;
    const checks = {
      nativeParity: parity.ok === true,
      referenceMatchesDifferential: referenceObservation.semanticRoot === absorbedRoot,
      nativeMatchesDifferential: nativeObservation.semanticRoot === absorbedRoot,
      nativeMatchesReference: nativeObservation.semanticRoot === referenceObservation.semanticRoot,
      bytecodeIntegrity: integrity.intact,
    };
    const caseReport = {
      id: caseManifest.id,
      program: integrity.decoded.program,
      programRoot: integrity.current.programRoot,
      bytecodeSha256: integrity.current.bytecodeSha256,
      byteLength: integrity.current.byteLength,
      instructionCount: integrity.current.instructionCount,
      differentialAbsorbedSemanticRoot: absorbedRoot,
      referenceObservationRoot: referenceObservation.semanticRoot,
      nativeObservationRoot: nativeObservation.semanticRoot,
      parity: parity.parity,
      checks,
      verified: Object.values(checks).every(Boolean),
      nativeReceiptRoot: realityRoot({
        vmSha256: vmFormat.sha256,
        bytecodeSha256: integrity.current.bytecodeSha256,
        observationRoot: nativeObservation.root,
        programRoot: integrity.current.programRoot,
      }),
    };
    caseReports.push(Object.freeze({ ...caseReport, root: realityRoot(caseReport) }));
  }

  const verified = caseReports.length > 0 && caseReports.every(item => item.verified);
  const report = {
    format: RCL_NATIVE_PROMOTION_REPORT_FORMAT,
    version: RCL_NATIVE_CAPABILITY_PROMOTION_VERSION,
    capability,
    status: verified ? 'native-verified' : 'native-rejected',
    verified,
    promotionEligible: verified,
    proofChain: [
      { kind: 'metabolism', root: metabolism.root, stage: metabolism.assessment.stage },
      { kind: 'independent-differential', root: differential.root, score: differential.score },
      { kind: 'implementation-manifest', root: manifest.root, caseCount: manifest.cases.length },
      { kind: 'native-vm', root: vmFormat.sha256, executableKind: vmFormat.kind },
    ],
    implementationRoot: manifest.root,
    metabolismRoot: metabolism.root,
    differentialRoot: differential.root,
    nativeVm: { path: vmPath, ...vmFormat },
    caseCount: caseReports.length,
    verifiedCaseCount: caseReports.filter(item => item.verified).length,
    failedCaseCount: caseReports.filter(item => !item.verified).length,
    cases: caseReports,
    gaps: verified ? [] : caseReports.filter(item => !item.verified).map(item => `case:${item.id}`),
    bindingProofLevel: 'observed-output-plus-declared-artifact-root',
    boundary: 'native-verified proves the declared case set across external/source differential evidence, the RCL reference runtime, deterministic RBC compilation and the selected native VM binary. It does not prove complete semantics beyond the cases or cross-platform parity on untested hosts.',
  };
  return Object.freeze({ ...report, root: realityRoot({ ...report, cases: caseReports.map(item => item.root) }) });
}
