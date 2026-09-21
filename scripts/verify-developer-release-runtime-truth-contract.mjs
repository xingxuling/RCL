#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  foundationRuntimeTruthContractRoot,
  verifyFoundationRuntimeTruthContract,
} from '../src/foundation-runtime-truth-contract.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-developer-release-runtime-truth-'));
const outDir = path.join(tmpRoot, 'release');
const unpackDir = path.join(tmpRoot, 'unpacked');

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_DEVELOPER_RELEASE_RUNTIME_TRUTH_CONTRACT_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exitCode = 1;
}

function expectRejected(label, candidate, rootDir) {
  const result = verifyFoundationRuntimeTruthContract(candidate, { rootDir });
  if (result.ok === true) fail(`Negative control did not fail closed: ${label}`, { result });
}

try {
  const build = spawnSync(process.execPath, ['scripts/build-developer-release.mjs', outDir], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  if (build.status !== 0) {
    fail('Developer release build failed before runtime truth contract inspection.', {
      exitCode: build.status,
      signal: build.signal ?? null,
      stdout: build.stdout,
      stderr: build.stderr,
    });
  } else {
    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'release-manifest.json'), 'utf8'));
    const archivePath = path.join(outDir, manifest.artifact.fileName);
    const archiveBytes = fs.readFileSync(archivePath);
    const archiveSha256 = crypto.createHash('sha256').update(archiveBytes).digest('hex');
    if (archiveSha256 !== manifest.artifact.sha256) {
      fail('Developer release archive hash diverged from release manifest.', {
        expected: manifest.artifact.sha256,
        actual: archiveSha256,
      });
    }

    fs.mkdirSync(unpackDir, { recursive: true });
    const extract = spawnSync('tar', ['-xzf', archivePath, '-C', unpackDir], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    if (extract.status !== 0) {
      fail('Unable to extract developer release archive.', {
        exitCode: extract.status,
        stderr: extract.stderr,
      });
    } else {
      const packageRoot = path.join(unpackDir, 'package');
      const contractPath = path.join(packageRoot, 'runtime-truth-contract.json');
      if (!fs.existsSync(contractPath)) {
        fail('Developer release archive is missing runtime-truth-contract.json.');
      } else {
        const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
        const verification = verifyFoundationRuntimeTruthContract(contract, { rootDir: packageRoot });
        if (verification.ok !== true) {
          fail('Packaged runtime truth contract did not verify against exact packaged source bytes.', { verification });
        }

        if (manifest?.runtimeTruthContract?.snapshot !== 'runtime-truth-contract.json') {
          fail('Release manifest is not bound to the packaged runtime truth contract.');
        }
        if (manifest?.runtimeTruthContract?.contractRoot !== contract.contractRoot) {
          fail('Release manifest runtime truth contract root diverged from packaged contract.', {
            manifestRoot: manifest?.runtimeTruthContract?.contractRoot ?? null,
            packagedRoot: contract.contractRoot ?? null,
          });
        }
        if (manifest?.runtimeTruthContract?.sourceBindingCount !== contract.sourceBindings?.length) {
          fail('Release manifest runtime truth source-binding count drifted.');
        }
        if (manifest?.runtimeTruthContract?.surfaceCount !== contract.surfaces?.length) {
          fail('Release manifest runtime truth surface count drifted.');
        }
        if (manifest?.runtimeTruthContract?.verifiedInStagedSource !== true) {
          fail('Release manifest does not prove runtime truth contract verification in the exact staged source tree.');
        }
        if (manifest?.runtimeTruthContract?.deploymentEvidenceClaimed !== false) {
          fail('Release manifest fabricates deployment evidence from packaged runtime source truth.');
        }
        if (manifest?.runtimeTruthContract?.runtimeSurfaceAvailabilityClaimed !== false) {
          fail('Release manifest fabricates hosted runtime endpoint availability.');
        }
        if (manifest?.runtimeTruthContract?.deploymentMustReverifyRuntimeTruth !== true) {
          fail('Release manifest lost the deployment-time runtime truth re-verification requirement.');
        }

        const rootTamper = structuredClone(contract);
        rootTamper.capabilityTruth.truthRoot = '0'.repeat(64);
        rootTamper.contractRoot = foundationRuntimeTruthContractRoot(rootTamper);
        expectRejected('capability-truth-root-drift', rootTamper, packageRoot);

        const sourceHashTamper = structuredClone(contract);
        sourceHashTamper.sourceBindings[0].sha256 = '1'.repeat(64);
        sourceHashTamper.contractRoot = foundationRuntimeTruthContractRoot(sourceHashTamper);
        expectRejected('runtime-source-hash-drift', sourceHashTamper, packageRoot);

        const overclaim = structuredClone(contract);
        overclaim.truthBoundary.deploymentEvidenceClaimed = true;
        overclaim.truthBoundary.runtimeSurfaceAvailabilityClaimed = true;
        overclaim.contractRoot = foundationRuntimeTruthContractRoot(overclaim);
        expectRejected('deployment-truth-overclaim', overclaim, packageRoot);

        const runtimeHealthPath = path.join(packageRoot, 'api', 'runtime-health.mjs');
        const originalRuntimeHealth = fs.readFileSync(runtimeHealthPath);
        try {
          fs.appendFileSync(runtimeHealthPath, '\n// cycle75 negative-control source drift\n');
          const sourceDrift = verifyFoundationRuntimeTruthContract(contract, { rootDir: packageRoot });
          if (sourceDrift.ok === true) {
            fail('Packaged runtime source drift did not invalidate the runtime truth contract.');
          }
        } finally {
          fs.writeFileSync(runtimeHealthPath, originalRuntimeHealth);
        }

        if (!process.exitCode) {
          console.log(JSON.stringify({
            ok: true,
            status: 'RCL_DEVELOPER_RELEASE_RUNTIME_TRUTH_CONTRACT_VERIFIED',
            artifact: manifest.artifact.fileName,
            artifactSha256: archiveSha256,
            contractRoot: contract.contractRoot,
            capabilityTruthRoot: contract.capabilityTruth.truthRoot,
            directRegistryRoot: contract.capabilityTruth.directRegistryRoot,
            providerBridgeRegistryRoot: contract.capabilityTruth.providerBridgeRegistryRoot,
            sourceBindingCount: contract.sourceBindings.length,
            surfaceCount: contract.surfaces.length,
            exactPackagedSourceBytesBound: true,
            negativeControls: [
              'capability-truth-root-drift',
              'runtime-source-hash-drift',
              'deployment-truth-overclaim',
              'packaged-runtime-source-byte-drift',
            ],
            truthBoundary: contract.truthBoundary,
          }, null, 2));
        }
      }
    }
  }
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

if (process.exitCode) process.exit(process.exitCode);
