#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createFoundationRuntimeTruthContract,
  verifyFoundationRuntimeTruthContract,
} from '../src/foundation-runtime-truth-contract.mjs';
import {
  createFoundationReleaseDeploymentAttestation,
  foundationReleaseDeploymentAttestationRoot,
  verifyFoundationReleaseDeploymentAttestation,
} from '../src/foundation-release-deployment-source-parity.mjs';
import { runtimeCapabilityTruthSurface } from '../api/capability-truth.mjs';
import { releaseRuntimeTruthStatus } from '../api/release-runtime-truth.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-cycle79-release-deployment-'));
const OUT = path.join(TMP, 'release');
const UNPACK = path.join(TMP, 'unpacked');
const PUBLIC_ATTESTATION_PATH = path.join(ROOT, 'public', 'developer-release-runtime-truth-attestation.json');
const GENERATED_MODULE_PATH = path.join(ROOT, 'src', 'generated', 'developer-release-runtime-truth-attestation.mjs');

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, status: 'RCL_CYCLE79_RELEASE_DEPLOYMENT_BIND_FAILED', message, ...details }, null, 2));
  process.exit(1);
}

function reroot(candidate) {
  candidate.attestationRoot = foundationReleaseDeploymentAttestationRoot(candidate);
  return candidate;
}

function expectRejected(label, candidate, context) {
  const result = verifyFoundationReleaseDeploymentAttestation(candidate, context);
  if (result.ok === true) fail(`Negative control did not fail closed: ${label}`, { result });
}

try {
  const build = spawnSync(process.execPath, ['scripts/build-developer-release.mjs', OUT], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  if (build.status !== 0) {
    fail('Developer release build failed.', { exitCode: build.status, stdout: build.stdout, stderr: build.stderr });
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'release-manifest.json'), 'utf8'));
  const archivePath = path.join(OUT, manifest.artifact.fileName);
  const archiveBytes = fs.readFileSync(archivePath);
  const artifactSha256 = crypto.createHash('sha256').update(archiveBytes).digest('hex');
  if (artifactSha256 !== manifest.artifact.sha256) {
    fail('Developer release archive hash diverged from release manifest.', { expected: manifest.artifact.sha256, actual: artifactSha256 });
  }

  fs.mkdirSync(UNPACK, { recursive: true });
  const extract = spawnSync('tar', ['-xzf', archivePath, '-C', UNPACK], { cwd: ROOT, encoding: 'utf8' });
  if (extract.status !== 0) fail('Unable to extract developer release archive.', { exitCode: extract.status, stderr: extract.stderr });
  const packageRoot = path.join(UNPACK, 'package');
  const releaseContract = JSON.parse(fs.readFileSync(path.join(packageRoot, 'runtime-truth-contract.json'), 'utf8'));
  const releaseContractVerification = verifyFoundationRuntimeTruthContract(releaseContract, { rootDir: packageRoot });
  if (releaseContractVerification.ok !== true) {
    fail('Packaged runtime truth contract failed exact package-source verification.', { releaseContractVerification });
  }
  if (manifest?.runtimeTruthContract?.contractRoot !== releaseContract.contractRoot) {
    fail('Release manifest runtime truth contract root diverged from packaged contract.');
  }

  const deploymentContract = createFoundationRuntimeTruthContract(ROOT);
  const deploymentContractVerification = verifyFoundationRuntimeTruthContract(deploymentContract, { rootDir: ROOT });
  if (deploymentContractVerification.ok !== true) {
    fail('Current deployment source-tree runtime truth contract failed verification.', { deploymentContractVerification });
  }
  if (releaseContract.contractRoot !== deploymentContract.contractRoot) {
    fail('Developer release and deployment source-tree runtime truth contracts diverged.', {
      releaseContractRoot: releaseContract.contractRoot,
      deploymentContractRoot: deploymentContract.contractRoot,
    });
  }

  const runtimeCapabilityTruth = runtimeCapabilityTruthSurface();
  const attestation = createFoundationReleaseDeploymentAttestation({
    artifactFileName: manifest.artifact.fileName,
    artifactSha256,
    releaseContract,
    deploymentContract,
  });
  const verification = verifyFoundationReleaseDeploymentAttestation(attestation, {
    deploymentContract,
    runtimeCapabilityTruth,
  });
  if (verification.ok !== true) fail('Release/deployment source parity attestation did not verify.', { verification });

  const rootDrift = structuredClone(attestation);
  rootDrift.developerRelease.runtimeTruthContractRoot = '0'.repeat(64);
  reroot(rootDrift);
  expectRejected('release-contract-root-drift', rootDrift, { deploymentContract, runtimeCapabilityTruth });

  const capabilityDrift = structuredClone(attestation);
  capabilityDrift.deploymentSource.capabilityTruthRoot = '1'.repeat(64);
  reroot(capabilityDrift);
  expectRejected('deployment-capability-root-drift', capabilityDrift, { deploymentContract, runtimeCapabilityTruth });

  const installOverclaim = structuredClone(attestation);
  installOverclaim.truthBoundary.releaseArtifactInstalledAsRuntimeClaimed = true;
  reroot(installOverclaim);
  expectRejected('release-installed-runtime-overclaim', installOverclaim, { deploymentContract, runtimeCapabilityTruth });

  const surfaceOverclaim = structuredClone(attestation);
  surfaceOverclaim.truthBoundary.runtimeSurfaceAvailabilityClaimed = true;
  reroot(surfaceOverclaim);
  expectRejected('runtime-surface-availability-overclaim', surfaceOverclaim, { deploymentContract, runtimeCapabilityTruth });

  fs.mkdirSync(path.dirname(PUBLIC_ATTESTATION_PATH), { recursive: true });
  fs.writeFileSync(PUBLIC_ATTESTATION_PATH, `${JSON.stringify(attestation, null, 2)}\n`);
  fs.mkdirSync(path.dirname(GENERATED_MODULE_PATH), { recursive: true });
  fs.writeFileSync(
    GENERATED_MODULE_PATH,
    `// Generated by Cycle 79 deployment build after release/source parity verification.\n`
      + `export const FOUNDATION_RELEASE_RUNTIME_TRUTH_ATTESTATION = Object.freeze(${JSON.stringify(attestation, null, 2)});\n`
      + `export const FOUNDATION_RELEASE_RUNTIME_TRUTH_DEPLOYMENT_CONTRACT = Object.freeze(${JSON.stringify(deploymentContract, null, 2)});\n`,
  );

  const endpointTruth = releaseRuntimeTruthStatus({ attestation, deploymentContract, runtimeSurface: runtimeCapabilityTruth });
  if (endpointTruth.ok !== true) fail('Release runtime truth endpoint logic did not verify bound attestation.', { endpointTruth });

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_CYCLE79_RELEASE_DEPLOYMENT_SOURCE_PARITY_VERIFIED',
    artifact: manifest.artifact.fileName,
    artifactSha256,
    releaseContractRoot: releaseContract.contractRoot,
    deploymentContractRoot: deploymentContract.contractRoot,
    attestationRoot: attestation.attestationRoot,
    capabilityTruthRoot: deploymentContract.capabilityTruth.truthRoot,
    directRegistryRoot: deploymentContract.capabilityTruth.directRegistryRoot,
    providerBridgeRegistryRoot: deploymentContract.capabilityTruth.providerBridgeRegistryRoot,
    sourceBindingCount: deploymentContract.sourceBindings.length,
    surfaceCount: deploymentContract.surfaces.length,
    negativeControls: [
      'release-contract-root-drift',
      'deployment-capability-root-drift',
      'release-installed-runtime-overclaim',
      'runtime-surface-availability-overclaim',
    ],
    truthBoundary: attestation.truthBoundary,
  }, null, 2));
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
