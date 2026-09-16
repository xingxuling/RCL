#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const publicDir = path.join(root, 'public');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');
const buildProofPath = path.join(publicDir, 'rcl-native-build-proof.json');
const conformancePath = path.join(root, 'foundation-conformance.json');
const proofPath = path.join(publicDir, 'rcl-foundation-native-federation-determinism-proof.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}
function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_NATIVE_FEDERATION_ROOT_STABILIZATION_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function deterministicExecutionLayer(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(deterministicExecutionLayer);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'metrics')
    .map(([key, item]) => [key, deterministicExecutionLayer(item)]));
}
function deterministicConformanceProjection(report) {
  return {
    format: report?.format ?? null,
    project: report?.project ?? null,
    contract: report?.contract ?? null,
    executionLayers: deterministicExecutionLayer(report?.executionLayers ?? {}),
    domains: report?.domains ?? {},
    realityRobustness: report?.realityRobustness ?? {},
    fixtures: report?.fixtures ?? [],
    checks: Array.isArray(report?.checks)
      ? report.checks.map(item => ({ id: item?.id ?? null, passed: item?.passed === true }))
      : [],
    status: report?.status ?? null,
  };
}
function deterministicFederationCore(federation, conformanceDeterministicRoot) {
  return {
    format: federation?.format ?? null,
    domains: federation?.domains ?? [],
    providerBatches: federation?.providerBatches ?? {},
    hostBinarySha256: federation?.hostBinarySha256 ?? null,
    compilerBinarySha256: federation?.compilerBinarySha256 ?? null,
    hostSourceRoot: federation?.hostSourceRoot ?? null,
    canonicalVmSourceRoot: federation?.canonicalVmSourceRoot ?? null,
    conformanceContractRoot: federation?.conformanceContractRoot ?? null,
    conformanceDeterministicRoot,
    batchAProofSha256: federation?.batchAProofSha256 ?? null,
    extensionProofSha256: federation?.extensionProofSha256 ?? null,
    declaredDomainDirectLoweringVerified: federation?.declaredDomainDirectLoweringVerified === true,
  };
}

try {
  for (const requiredPath of [manifestPath, buildProofPath, conformancePath]) {
    if (!fs.existsSync(requiredPath)) fail('Required federation evidence input is missing', { requiredPath });
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const buildProof = JSON.parse(fs.readFileSync(buildProofPath, 'utf8'));
  const conformanceBytes = fs.readFileSync(conformancePath);
  const conformance = JSON.parse(conformanceBytes.toString('utf8'));
  const federation = manifest?.foundationNativeBridgeFederationProof;
  if (
    federation?.format !== 'taowind.rcl-vercel-foundation-native-provider-federation.v0.1'
    || federation?.status !== 'deployment-bound'
    || federation?.verified !== true
    || federation?.declaredDomainDirectLoweringVerified !== false
    || !isSha256(federation?.conformanceReportSha256)
    || federation.conformanceReportSha256 !== sha256(conformanceBytes)
    || !isSha256(federation?.federationRoot)
  ) {
    fail('Existing provider federation proof is not a valid deployment-bound input', {
      federation,
      actualConformanceReportSha256: sha256(conformanceBytes),
    });
  }

  const projection = deterministicConformanceProjection(conformance);
  const projectionBytes = Buffer.from(JSON.stringify(projection));
  const conformanceDeterministicRoot = sha256(projectionBytes);
  if (!isSha256(conformanceDeterministicRoot)) fail('Deterministic conformance root is invalid');

  const telemetryMutation = clone(conformance);
  for (const layer of Object.values(telemetryMutation?.executionLayers ?? {})) {
    if (layer && typeof layer === 'object' && !Array.isArray(layer) && layer.metrics) {
      layer.metrics = {
        ...layer.metrics,
        runtimeMs: Number(layer.metrics.runtimeMs ?? 0) + 123.456,
        replayMs: Number(layer.metrics.replayMs ?? 0) + 78.9,
        processRssDeltaBytes: Number(layer.metrics.processRssDeltaBytes ?? 0) + 4096,
      };
    }
  }
  const telemetryMutationRoot = sha256(Buffer.from(JSON.stringify(
    deterministicConformanceProjection(telemetryMutation),
  )));
  if (telemetryMutationRoot !== conformanceDeterministicRoot) {
    fail('Telemetry-only mutation changed deterministic conformance identity', {
      conformanceDeterministicRoot,
      telemetryMutationRoot,
    });
  }

  const semanticMutation = clone(conformance);
  const firstPassingCheck = semanticMutation?.checks?.find(item => item?.passed === true);
  if (!firstPassingCheck) fail('Conformance report has no passing check for semantic mutation control');
  firstPassingCheck.passed = false;
  const semanticMutationRoot = sha256(Buffer.from(JSON.stringify(
    deterministicConformanceProjection(semanticMutation),
  )));
  if (semanticMutationRoot === conformanceDeterministicRoot) {
    fail('Semantic conformance mutation did not change deterministic conformance identity', {
      check: firstPassingCheck.id,
      conformanceDeterministicRoot,
    });
  }

  const deterministicCore = deterministicFederationCore(federation, conformanceDeterministicRoot);
  const stableFederationRoot = sha256(Buffer.from(JSON.stringify(deterministicCore)));
  const providerMutation = clone(deterministicCore);
  const firstBatchId = Object.keys(providerMutation.providerBatches ?? {})[0];
  if (!firstBatchId) fail('Federation proof has no provider batch for mutation control');
  providerMutation.providerBatches[firstBatchId].finalStateRoot = '0'.repeat(64);
  const providerMutationRoot = sha256(Buffer.from(JSON.stringify(providerMutation)));
  if (providerMutationRoot === stableFederationRoot) {
    fail('Provider execution mutation did not change stable federation identity', { firstBatchId });
  }

  const stabilizedFederation = {
    ...federation,
    federationRootContract: 'taowind.rcl-foundation-native-provider-federation-root.deterministic-evidence.v0.1',
    conformanceDeterministicRoot,
    federationRoot: stableFederationRoot,
    conformanceTelemetry: {
      reportSha256: federation.conformanceReportSha256,
      excludedFromFederationIdentity: true,
      reason: 'Wall-clock and process telemetry are audit evidence but are intentionally excluded from reproducible semantic federation identity.',
    },
  };
  manifest.foundationNativeBridgeFederationProof = stabilizedFederation;
  buildProof.foundationNativeBridgeFederation = stabilizedFederation;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(buildProofPath, `${JSON.stringify(buildProof, null, 2)}\n`);

  const proof = {
    ok: true,
    format: 'taowind.rcl-vercel-foundation-native-provider-federation-determinism-proof.v0.1',
    status: 'deterministic-federation-root-verified',
    verified: true,
    conformanceReportSha256: federation.conformanceReportSha256,
    conformanceDeterministicRoot,
    telemetryMutationRoot,
    semanticMutationRoot,
    stableFederationRoot,
    providerMutationRoot,
    mutationControls: {
      telemetryExcluded: telemetryMutationRoot === conformanceDeterministicRoot,
      semanticChangeDetected: semanticMutationRoot !== conformanceDeterministicRoot,
      providerExecutionChangeDetected: providerMutationRoot !== stableFederationRoot,
    },
    truthBoundary: {
      reportTelemetryStillAuditable: true,
      reportTelemetryPartOfStableIdentity: false,
      deterministicConformanceFactsBound: true,
      providerExecutionRootsBound: true,
      declaredDomainDirectLoweringVerified: false,
    },
  };
  fs.writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_NATIVE_FEDERATION_ROOT_STABILIZED',
    conformanceReportSha256: proof.conformanceReportSha256,
    conformanceDeterministicRoot,
    stableFederationRoot,
    telemetryMutationInvariant: proof.mutationControls.telemetryExcluded,
    semanticMutationDetected: proof.mutationControls.semanticChangeDetected,
    providerExecutionMutationDetected: proof.mutationControls.providerExecutionChangeDetected,
    declaredDomainDirectLoweringVerified: false,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  });
}
