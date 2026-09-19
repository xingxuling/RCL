import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
  reconcileFoundationConformanceTruth,
  renderFoundationConformanceCsv,
  renderFoundationConformanceMarkdown,
} from '../src/foundation-conformance-truth.mjs';

const direct = [...FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS];
const bridge = [
  'quantitative', 'knowledge', 'perception', 'natural-language-reality', 'understanding-reality',
  'creative-reality', 'meta-spacetime', 'meta-acceleration', 'meta-compression', 'physical',
  'embodiment', 'energy', 'elemental', 'neural', 'metacomputation', 'computation',
];
const allDomains = [...new Set([...direct, ...bridge, 'scientific', 'spiritual', 'execution-reality'])];

function report() {
  return {
    format: 'taowind.foundation-conformance-report.v0.1',
    project: 'RCL',
    contract: { format: 'test-contract', version: '1', root: 'a'.repeat(64) },
    executionLayers: {
      referenceRuntime: 'native',
      nativeVm: 'bridge',
      nativeVmLimitation: 'Declared Foundation-domain syntax still rejects lowering.',
    },
    domains: Object.fromEntries(allDomains.map(id => [id, {
      mode: bridge.includes(id) ? 'bridge' : 'none',
      referenceRuntimeMode: 'native',
      implementation: bridge.includes(id) ? `bridge:${id}` : `reference:${id}`,
      knownLimitations: ['stale'],
    }])),
    checks: [{ id: 'base', passed: true }],
    status: 'pass',
  };
}

function deployment(overrides = {}) {
  return {
    replayEvidenceBound: true,
    foundationParityBound: true,
    directExtensionEvidenceBound: true,
    foundationNativeBridgeBound: true,
    foundationNativeBridgeFederationBound: true,
    extendedEvidenceBound: true,
    foundationParityDomains: ['perception', 'physical', 'neural', 'genetic', 'living'],
    foundationDirectExtensionDomains: ['quantitative', 'energy'],
    foundationNativeBridgeDomains: bridge,
    binarySha256: '1'.repeat(64),
    sourceRoot: '2'.repeat(64),
    executionAttestationRoot: '3'.repeat(64),
    ...overrides,
  };
}

test('reconciles stale bridge-only truth into direct + bridge coexistence without all-domain overclaim', () => {
  const reconciled = reconcileFoundationConformanceTruth(report(), deployment(), {
    requireDeploymentEvidence: true,
  });
  assert.equal(reconciled.executionLayers.nativeVm, 'hybrid');
  assert.equal(reconciled.canonicalExecutionTruth.status, 'deployment-bound');
  assert.deepEqual(reconciled.canonicalExecutionTruth.verifiedDirectDomains, [...direct].sort());
  assert.equal(reconciled.canonicalExecutionTruth.truthBoundary.allFoundationDomainsNativeClaimed, false);
  assert.equal(reconciled.canonicalExecutionTruth.truthBoundary.providerBridgeRemovedGlobally, false);
  assert.equal(reconciled.domains.quantitative.mode, 'native-direct');
  assert.equal(reconciled.domains.quantitative.directNativeVerified, true);
  assert.equal(reconciled.domains.quantitative.providerBridgeVerified, true);
  assert.deepEqual(reconciled.domains.quantitative.availableModes, ['bridge', 'native-direct', 'reference-native']);
  assert.equal(reconciled.domains.energy.mode, 'native-direct');
  assert.equal(reconciled.domains.energy.directNativeVerified, true);
  assert.equal(reconciled.domains.energy.providerBridgeVerified, true);
  assert.equal(reconciled.domains.genetic.mode, 'native-direct');
  assert.equal(reconciled.domains.genetic.providerBridgeVerified, false);
  assert.equal(reconciled.domains.knowledge.mode, 'bridge');
  assert.equal(reconciled.domains.knowledge.directNativeVerified, false);
  assert.match(reconciled.executionLayers.nativeVmLimitation, /No all-Foundation direct-native claim/);
});

test('structural reconciliation corrects the global no-direct-lowering claim before deployment evidence is available', () => {
  const reconciled = reconcileFoundationConformanceTruth(report(), {}, {
    requireDeploymentEvidence: false,
  });
  assert.equal(reconciled.executionLayers.nativeVm, 'hybrid');
  assert.equal(reconciled.canonicalExecutionTruth.status, 'implementation-bound');
  assert.deepEqual(reconciled.canonicalExecutionTruth.verifiedDirectDomains, []);
  assert.deepEqual(reconciled.canonicalExecutionTruth.verifiedBridgeDomains, [...bridge].sort());
  assert.equal(reconciled.domains.quantitative.directLoweringImplemented, true);
  assert.equal(reconciled.domains.quantitative.directNativeVerified, false);
  assert.equal(reconciled.domains.quantitative.mode, 'bridge');
  assert.equal(reconciled.domains.energy.directLoweringImplemented, true);
  assert.equal(reconciled.domains.energy.directNativeVerified, false);
  assert.equal(reconciled.domains.energy.mode, 'bridge');
  assert.match(reconciled.executionLayers.nativeVmLimitation, /direct lowering is implemented/);
  assert.doesNotMatch(reconciled.executionLayers.nativeVmLimitation, /syntax still rejects lowering/);
});

test('fails closed when required deployment-bound direct evidence is incomplete', () => {
  assert.throws(
    () => reconcileFoundationConformanceTruth(report(), deployment({
      extendedEvidenceBound: false,
      foundationDirectExtensionDomains: [],
      directExtensionEvidenceBound: false,
    }), { requireDeploymentEvidence: true }),
    error => error?.code === 'RCL_FOUNDATION_CONFORMANCE_DEPLOYMENT_EVIDENCE_INCOMPLETE'
      && error?.details?.missingCurrentDirectEvidence?.includes('quantitative')
      && error?.details?.missingCurrentDirectEvidence?.includes('energy'),
  );
});

test('rejects verified direct evidence for a domain without a declared direct implementation', () => {
  assert.throws(
    () => reconcileFoundationConformanceTruth(report(), deployment({
      foundationDirectExtensionDomains: ['quantitative', 'energy', 'knowledge'],
    })),
    error => error?.code === 'RCL_FOUNDATION_CONFORMANCE_VERIFIED_DIRECT_WITHOUT_IMPLEMENTATION'
      && error?.details?.domain === 'knowledge',
  );
});

test('truth root is deterministic under evidence array reordering', () => {
  const a = reconcileFoundationConformanceTruth(report(), deployment());
  const b = reconcileFoundationConformanceTruth(report(), deployment({
    foundationParityDomains: ['living', 'genetic', 'neural', 'physical', 'perception'],
    foundationDirectExtensionDomains: ['energy', 'quantitative'],
    foundationNativeBridgeDomains: [...bridge].reverse(),
  }));
  assert.equal(a.canonicalExecutionTruth.truthRoot, b.canonicalExecutionTruth.truthRoot);
});

test('CSV and Markdown expose reconciled truth rather than stale global bridge claims', () => {
  const reconciled = reconcileFoundationConformanceTruth(report(), deployment(), {
    requireDeploymentEvidence: true,
  });
  const csv = renderFoundationConformanceCsv(reconciled);
  const markdown = renderFoundationConformanceMarkdown(reconciled);
  assert.match(csv, /directNativeVerified/);
  assert.match(csv, /"quantitative".*"native-direct"/);
  assert.match(csv, /"energy".*"native-direct"/);
  assert.match(markdown, /native VM truth: hybrid/);
  assert.match(markdown, /direct-native verified:/);
  assert.doesNotMatch(markdown, /Declared Foundation-domain syntax still rejects lowering/);
});
