import crypto from 'node:crypto';
import {
  FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS as REGISTRY_DIRECT_IMPLEMENTATION_DOMAINS,
  canonicalFoundationDirectDomainId,
  foundationDirectImplementation,
} from './foundation-direct-capability-registry.mjs';

export const FOUNDATION_CONFORMANCE_TRUTH_FORMAT = 'taowind.rcl-foundation-conformance-truth.v0.1';
export const FOUNDATION_CONFORMANCE_TRUTH_VERSION = '0.1.0';

// Compatibility export only: the canonical direct-capability registry owns the
// actual domain set. Consumers importing the historical truth-module symbol now
// receive the exact frozen registry array rather than a shadow copy.
export const FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS = REGISTRY_DIRECT_IMPLEMENTATION_DOMAINS;

function array(value) {
  return Array.isArray(value) ? value : [];
}

export function canonicalFoundationConformanceDomainId(value) {
  return canonicalFoundationDirectDomainId(value);
}

function uniqueSorted(values) {
  return [...new Set(array(values).filter(value => typeof value === 'string' && value.length > 0))].sort();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function sha256Canonical(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
}

function directImplementation(domain) {
  const implementation = foundationDirectImplementation(domain);
  if (implementation) return implementation;
  fail(
    'RCL_FOUNDATION_CONFORMANCE_DIRECT_IMPLEMENTATION_PROVENANCE_UNKNOWN',
    `No direct implementation provenance is registered for '${domain}'.`,
    { domain },
  );
}

function domainKnown(report, domain) {
  return Boolean(report?.domains && Object.prototype.hasOwnProperty.call(report.domains, domain));
}

function categoryFor(report, id) {
  const groups = [
    report?.contract?.domains,
    report?.contract?.compositePlanes,
    report?.contract?.metaRealityPlanes,
    report?.contract?.crossDomainAxes,
  ];
  for (const group of groups) {
    const item = array(group).find(candidate => candidate?.id === id);
    if (item?.category) return item.category;
  }
  return '';
}

function csvCell(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `"${String(text ?? '').replaceAll('"', '""')}"`;
}

export function reconcileFoundationConformanceTruth(report, deployment = {}, options = {}) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    fail('RCL_FOUNDATION_CONFORMANCE_REPORT_REQUIRED', 'Foundation conformance report object is required.');
  }
  if (!report.domains || typeof report.domains !== 'object' || Array.isArray(report.domains)) {
    fail('RCL_FOUNDATION_CONFORMANCE_DOMAINS_REQUIRED', 'Foundation conformance report must contain a domain map.');
  }

  const implementationDomains = uniqueSorted(
    options.implementationDomains ?? FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
  );
  if (implementationDomains.length === 0) {
    fail(
      'RCL_FOUNDATION_CONFORMANCE_DIRECT_IMPLEMENTATION_EMPTY',
      'At least one implemented declared-domain direct-lowering domain is required.',
    );
  }
  for (const domain of implementationDomains) {
    if (!domainKnown(report, domain)) {
      fail(
        'RCL_FOUNDATION_CONFORMANCE_DIRECT_IMPLEMENTATION_UNKNOWN_DOMAIN',
        `Implemented direct-lowering domain '${domain}' is absent from the conformance contract.`,
        { domain },
      );
    }
  }

  const verifiedParityDomains = uniqueSorted(
    array(deployment?.foundationParityDomains).map(canonicalFoundationConformanceDomainId),
  );
  const verifiedExtensionDomains = uniqueSorted(
    array(deployment?.foundationDirectExtensionDomains).map(canonicalFoundationConformanceDomainId),
  );
  const verifiedDirectDomains = uniqueSorted([
    ...verifiedParityDomains,
    ...verifiedExtensionDomains,
  ]);
  const baseBridgeDomains = uniqueSorted(
    Object.entries(report.domains)
      .filter(([, item]) => item?.mode === 'bridge')
      .map(([id]) => id),
  );
  const deploymentBridgeDomains = uniqueSorted(
    array(deployment?.foundationNativeBridgeDomains).map(canonicalFoundationConformanceDomainId),
  );
  const verifiedBridgeDomains = deploymentBridgeDomains.length > 0
    ? deploymentBridgeDomains
    : baseBridgeDomains;

  for (const domain of verifiedDirectDomains) {
    if (!implementationDomains.includes(domain)) {
      fail(
        'RCL_FOUNDATION_CONFORMANCE_VERIFIED_DIRECT_WITHOUT_IMPLEMENTATION',
        `Deployment evidence claims direct-native verification for '${domain}' without an implementation declaration.`,
        { domain, implementationDomains },
      );
    }
    if (!domainKnown(report, domain)) {
      fail(
        'RCL_FOUNDATION_CONFORMANCE_VERIFIED_DIRECT_UNKNOWN_DOMAIN',
        `Deployment evidence claims direct-native verification for unknown domain '${domain}'.`,
        { domain },
      );
    }
  }
  for (const domain of verifiedBridgeDomains) {
    if (!domainKnown(report, domain)) {
      fail(
        'RCL_FOUNDATION_CONFORMANCE_VERIFIED_BRIDGE_UNKNOWN_DOMAIN',
        `Deployment evidence claims Provider bridge verification for unknown domain '${domain}'.`,
        { domain },
      );
    }
  }

  const requiredCurrentDirectDomains = uniqueSorted(
    options.requiredDirectDomains ?? FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
  );
  const missingCurrentDirectEvidence = requiredCurrentDirectDomains.filter(
    domain => !verifiedDirectDomains.includes(domain),
  );
  const requireDeploymentEvidence = options.requireDeploymentEvidence === true;
  const deploymentEvidenceComplete = Boolean(
    deployment?.extendedEvidenceBound === true
    && deployment?.replayEvidenceBound === true
    && deployment?.foundationParityBound === true
    && deployment?.directExtensionEvidenceBound === true
    && deployment?.foundationNativeBridgeBound === true
    && deployment?.foundationNativeBridgeFederationBound === true
    && missingCurrentDirectEvidence.length === 0
  );

  if (requireDeploymentEvidence && !deploymentEvidenceComplete) {
    fail(
      'RCL_FOUNDATION_CONFORMANCE_DEPLOYMENT_EVIDENCE_INCOMPLETE',
      'Canonical conformance truth reconciliation requires complete deployment-bound direct and Provider-bridge evidence.',
      {
        missingCurrentDirectEvidence,
        extendedEvidenceBound: deployment?.extendedEvidenceBound === true,
        replayEvidenceBound: deployment?.replayEvidenceBound === true,
        foundationParityBound: deployment?.foundationParityBound === true,
        directExtensionEvidenceBound: deployment?.directExtensionEvidenceBound === true,
        foundationNativeBridgeBound: deployment?.foundationNativeBridgeBound === true,
        foundationNativeBridgeFederationBound: deployment?.foundationNativeBridgeFederationBound === true,
      },
    );
  }

  const reconciled = clone(report);
  reconciled.executionLayers = {
    ...(reconciled.executionLayers ?? {}),
    nativeVm: 'hybrid',
    nativeDirect: {
      mode: 'declared-domain-direct-lowering',
      implementationDomains,
      verifiedDomains: verifiedDirectDomains,
      parityVerifiedDomains: verifiedParityDomains,
      extensionVerifiedDomains: verifiedExtensionDomains,
      deploymentEvidenceBound: deploymentEvidenceComplete,
      canonicalVmBinarySha256: isSha256(deployment?.binarySha256) ? deployment.binarySha256 : null,
      canonicalVmSourceRoot: isSha256(deployment?.sourceRoot) ? deployment.sourceRoot : null,
      executionAttestationRoot: isSha256(deployment?.executionAttestationRoot)
        ? deployment.executionAttestationRoot
        : null,
      providerBridgeCoexists: verifiedBridgeDomains.length > 0,
    },
  };

  reconciled.executionLayers.nativeVmLimitation = deploymentEvidenceComplete
    ? `Native VM truth is hybrid: declared-domain direct-native execution is deployment-bound for ${verifiedDirectDomains.join(', ')}; Provider bridge remains a separately verified compatibility path for ${verifiedBridgeDomains.join(', ')}. No all-Foundation direct-native claim is made.`
    : `Native VM truth is hybrid: declared-domain direct lowering is implemented for ${implementationDomains.join(', ')}; deployment-bound direct-native verification in this invocation covers ${verifiedDirectDomains.length > 0 ? verifiedDirectDomains.join(', ') : 'no domains yet'}. Provider bridge remains separately tracked, and unverified domains are not counted as direct-native.`;

  for (const [id, item] of Object.entries(reconciled.domains)) {
    const directImplemented = implementationDomains.includes(id);
    const directVerified = verifiedDirectDomains.includes(id);
    const bridgeVerified = verifiedBridgeDomains.includes(id);
    const referenceNative = item.referenceRuntimeMode === 'native';
    const baseMode = item.mode ?? 'none';
    const baseImplementation = item.implementation ?? null;
    const availableModes = uniqueSorted([
      ...(directImplemented ? ['native-direct'] : []),
      ...(bridgeVerified || baseMode === 'bridge' ? ['bridge'] : []),
      ...(referenceNative ? ['reference-native'] : []),
    ]);

    item.baseConformanceMode = item.baseConformanceMode ?? baseMode;
    item.directLoweringImplemented = directImplemented;
    item.directNativeVerified = directVerified;
    item.providerBridgeVerified = bridgeVerified;
    item.availableModes = availableModes;

    if (directVerified) {
      if (baseMode === 'bridge' || bridgeVerified) item.providerBridgeImplementation = baseImplementation;
      item.mode = 'native-direct';
      item.implementation = directImplementation(id);
      item.knownLimitations = [
        'Declared-domain direct lowering is deployment-bound on the canonical native VM for this domain.',
        ...(bridgeVerified
          ? ['RclVmProviderV1 remains a separately verified compatibility path and does not downgrade the direct-native path.']
          : []),
        'This domain-level result does not claim that every Foundation domain is direct-native.',
      ];
    } else if (directImplemented) {
      item.knownLimitations = [
        'Declared-domain direct lowering is implemented, but deployment-bound native verification is not available in this invocation.',
        ...(bridgeVerified || baseMode === 'bridge'
          ? ['The Provider bridge remains the currently verified compatibility path for this domain.']
          : []),
        'The domain is not counted as direct-native until deployment evidence is bound.',
      ];
    } else if (bridgeVerified || baseMode === 'bridge') {
      item.knownLimitations = [
        'Provider bridge execution is verified for this domain; no declared-domain direct-native proof is claimed.',
      ];
    } else if (referenceNative) {
      item.knownLimitations = [
        'Reference Runtime coverage is verified; no Provider bridge or declared-domain direct-native conformance is claimed for this domain.',
      ];
    } else {
      item.knownLimitations = [
        'No Reference Runtime, Provider bridge, or declared-domain direct-native conformance is claimed for this domain.',
      ];
    }
  }

  const truthPayload = {
    nativeVmMode: 'hybrid',
    implementationDomains,
    verifiedDirectDomains,
    verifiedParityDomains,
    verifiedExtensionDomains,
    verifiedBridgeDomains,
    deploymentEvidenceComplete,
    canonicalVmBinarySha256: isSha256(deployment?.binarySha256) ? deployment.binarySha256 : null,
    canonicalVmSourceRoot: isSha256(deployment?.sourceRoot) ? deployment.sourceRoot : null,
    executionAttestationRoot: isSha256(deployment?.executionAttestationRoot)
      ? deployment.executionAttestationRoot
      : null,
    truthBoundary: {
      allFoundationDomainsNativeClaimed: false,
      providerBridgeRemovedGlobally: false,
      directImplementationIsNotEquivalentToDeploymentVerification: true,
      directAndBridgeModesMayCoexistPerDomain: true,
      missingCurrentDirectEvidence,
    },
  };
  const truthRoot = sha256Canonical(truthPayload);
  reconciled.canonicalExecutionTruth = {
    format: FOUNDATION_CONFORMANCE_TRUTH_FORMAT,
    version: FOUNDATION_CONFORMANCE_TRUTH_VERSION,
    status: deploymentEvidenceComplete ? 'deployment-bound' : 'implementation-bound',
    ...truthPayload,
    truthRoot,
  };

  return reconciled;
}

export function renderFoundationConformanceCsv(report) {
  const rows = [
    'project,domain,category,mode,referenceRuntimeMode,implementation,directLoweringImplemented,directNativeVerified,providerBridgeVerified,availableModes,knownLimitations',
  ];
  for (const [id, item] of Object.entries(report.domains ?? {})) {
    rows.push([
      report.project ?? 'RCL',
      id,
      categoryFor(report, id),
      item.mode ?? 'none',
      item.referenceRuntimeMode ?? 'none',
      item.implementation ?? '',
      item.directLoweringImplemented === true,
      item.directNativeVerified === true,
      item.providerBridgeVerified === true,
      array(item.availableModes).join('|'),
      array(item.knownLimitations).join('; '),
    ].map(csvCell).join(','));
  }
  return `${rows.join('\n')}\n`;
}

export function renderFoundationConformanceMarkdown(report) {
  const truth = report.canonicalExecutionTruth ?? {};
  const execution = report.executionLayers ?? {};
  const lines = [
    '# RCL Foundation Conformance',
    '',
    `- status: **${report.status ?? 'unknown'}**`,
    `- contract: ${report.contract?.format ?? 'unknown'} ${report.contract?.version ?? ''}`.trimEnd(),
    `- contract root: \`${report.contract?.root ?? 'unknown'}\``,
    `- reference runtime: ${execution.referenceRuntime ?? 'unknown'}`,
    `- native VM truth: ${execution.nativeVm ?? 'unknown'}`,
    `- canonical execution truth: **${truth.status ?? 'unknown'}**`,
    `- direct lowering implemented: ${array(truth.implementationDomains).join(', ') || 'none'}`,
    `- direct-native verified: ${array(truth.verifiedDirectDomains).join(', ') || 'none'}`,
    `- Provider bridge verified: ${array(truth.verifiedBridgeDomains).join(', ') || 'none'}`,
    `- truth root: \`${truth.truthRoot ?? 'none'}\``,
    '',
    '## Execution truth by domain',
    '',
    '| Domain | Mode | Direct implemented | Direct verified | Bridge verified | Available modes |',
    '| --- | --- | --- | --- | --- | --- |',
    ...Object.entries(report.domains ?? {}).map(([id, item]) => (
      `| ${id} | ${item.mode ?? 'none'} | ${item.directLoweringImplemented === true ? 'yes' : 'no'} | ${item.directNativeVerified === true ? 'yes' : 'no'} | ${item.providerBridgeVerified === true ? 'yes' : 'no'} | ${array(item.availableModes).join(', ') || 'none'} |`
    )),
    '',
    '## Conformance checks',
    '',
    '| Check | Status |',
    '| --- | --- |',
    ...array(report.checks).map(item => `| ${item.id} | ${item.passed ? 'pass' : 'fail'} |`),
    '',
    'Truth boundary: direct-lowering implementation, deployment-bound direct-native evidence, Reference Runtime coverage, and Provider bridge evidence are tracked independently. A domain may expose both direct-native and bridge paths; no all-Foundation direct-native claim is made.',
  ];
  return `${lines.join('\n')}\n`;
}
