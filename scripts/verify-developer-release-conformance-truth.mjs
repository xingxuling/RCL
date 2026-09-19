#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
  foundationDirectCapabilityRegistrySnapshot,
} from '../src/foundation-direct-capability-registry.mjs';
import {
  FOUNDATION_NATIVE_BRIDGE_BATCHES,
  FOUNDATION_NATIVE_BRIDGE_DOMAINS,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from '../src/foundation-native-bridge-capability-registry.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-developer-release-truth-proof-'));
const outDir = path.join(tmpRoot, 'release');

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_DEVELOPER_RELEASE_CONFORMANCE_TRUTH_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exitCode = 1;
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
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function extractArchiveText(archivePath, member) {
  const extract = spawnSync('tar', ['-xOf', archivePath, member], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (extract.status !== 0) {
    fail(`Unable to extract packaged ${member} from developer release.`, {
      exitCode: extract.status,
      stderr: extract.stderr,
    });
    return null;
  }
  return extract.stdout;
}

try {
  const build = spawnSync(
    process.execPath,
    ['scripts/build-developer-release.mjs', outDir],
    { cwd: ROOT, encoding: 'utf8', env: process.env },
  );
  if (build.status !== 0) {
    fail('Developer release build failed before conformance truth could be inspected.', {
      exitCode: build.status,
      signal: build.signal ?? null,
      stdout: build.stdout,
      stderr: build.stderr,
    });
  } else {
    const manifestPath = path.join(outDir, 'release-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const archivePath = path.join(outDir, manifest.artifact.fileName);
    const archiveBytes = fs.readFileSync(archivePath);
    const archiveSha256 = crypto.createHash('sha256').update(archiveBytes).digest('hex');
    if (archiveSha256 !== manifest.artifact.sha256) {
      fail('Developer release archive hash diverged from release manifest.', {
        expected: manifest.artifact.sha256,
        actual: archiveSha256,
      });
    }

    const reportText = extractArchiveText(archivePath, 'package/foundation-conformance.json');
    const truthText = extractArchiveText(archivePath, 'package/foundation-conformance-truth.json');
    const capabilityTruthText = extractArchiveText(
      archivePath,
      'package/src/foundation-capability-registry-truth.json',
    );
    if (reportText !== null && truthText !== null && capabilityTruthText !== null) {
      const report = JSON.parse(reportText);
      const truth = report?.canonicalExecutionTruth;
      const truthSnapshot = JSON.parse(truthText);
      const capabilityTruthSnapshot = JSON.parse(capabilityTruthText);
      const expectedDirect = [...FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS].sort();
      const actualDirect = [...(truth?.implementationDomains ?? [])].sort();
      const directRegistry = foundationDirectCapabilityRegistrySnapshot();
      const bridgeRegistry = foundationNativeBridgeCapabilityRegistrySnapshot();
      const stalePhrases = [
        'Declared Foundation-domain syntax still rejects lowering',
        'declared domain syntax is still not Native VM syntax',
        'Unsupported declared-domain lowering remains explicit and is not counted as native mode',
      ];

      if (JSON.stringify(truthSnapshot) !== JSON.stringify(truth)) {
        fail('Packaged compact truth snapshot diverged from packaged conformance report truth.', {
          snapshotTruthRoot: truthSnapshot?.truthRoot ?? null,
          reportTruthRoot: truth?.truthRoot ?? null,
        });
      }
      if (report?.executionLayers?.nativeVm !== 'hybrid') {
        fail('Packaged developer release still exposes bridge-only Native VM truth.', {
          nativeVm: report?.executionLayers?.nativeVm ?? null,
        });
      }
      if (truth?.status !== 'implementation-bound') {
        fail('Developer release must expose implementation-bound truth without fabricating deployment evidence.', {
          truthStatus: truth?.status ?? null,
        });
      }
      if (JSON.stringify(actualDirect) !== JSON.stringify(expectedDirect)) {
        fail('Developer release direct-lowering implementation registry drifted.', {
          expectedDirect,
          actualDirect,
        });
      }
      if ((truth?.verifiedDirectDomains ?? []).length !== 0) {
        fail('Developer release fabricated deployment-bound direct-native verification.', {
          verifiedDirectDomains: truth?.verifiedDirectDomains ?? null,
        });
      }
      if (truth?.truthBoundary?.allFoundationDomainsNativeClaimed !== false) {
        fail('Developer release must fail closed on all-Foundation direct-native claims.');
      }
      if (truth?.truthBoundary?.providerBridgeRemovedGlobally !== false) {
        fail('Developer release must preserve the Provider bridge truth boundary.');
      }

      const {
        truthRoot: packagedCapabilityTruthRoot,
        ...packagedCapabilityTruthPayload
      } = capabilityTruthSnapshot;
      const recomputedCapabilityTruthRoot = sha256Canonical(packagedCapabilityTruthPayload);
      if (packagedCapabilityTruthRoot !== recomputedCapabilityTruthRoot) {
        fail('Packaged capability truth root does not match its canonical payload.', {
          packagedCapabilityTruthRoot: packagedCapabilityTruthRoot ?? null,
          recomputedCapabilityTruthRoot,
        });
      }
      if (capabilityTruthSnapshot?.direct?.registryRoot !== directRegistry.registryRoot) {
        fail('Packaged capability truth direct registry root diverged from executable registry.', {
          packagedRoot: capabilityTruthSnapshot?.direct?.registryRoot ?? null,
          executableRoot: directRegistry.registryRoot,
        });
      }
      if (
        JSON.stringify(capabilityTruthSnapshot?.direct?.domains)
        !== JSON.stringify(FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS)
      ) {
        fail('Packaged capability truth direct domain set diverged from executable registry.', {
          packagedDomains: capabilityTruthSnapshot?.direct?.domains ?? null,
          executableDomains: FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
        });
      }
      if (capabilityTruthSnapshot?.providerBridge?.registryRoot !== bridgeRegistry.registryRoot) {
        fail('Packaged capability truth Provider bridge registry root diverged from executable registry.', {
          packagedRoot: capabilityTruthSnapshot?.providerBridge?.registryRoot ?? null,
          executableRoot: bridgeRegistry.registryRoot,
        });
      }
      if (
        JSON.stringify(capabilityTruthSnapshot?.providerBridge?.domains)
        !== JSON.stringify(FOUNDATION_NATIVE_BRIDGE_DOMAINS)
      ) {
        fail('Packaged capability truth Provider bridge domain set diverged from executable registry.', {
          packagedDomains: capabilityTruthSnapshot?.providerBridge?.domains ?? null,
          executableDomains: FOUNDATION_NATIVE_BRIDGE_DOMAINS,
        });
      }
      if (
        capabilityTruthSnapshot?.providerBridge?.batches?.length
        !== FOUNDATION_NATIVE_BRIDGE_BATCHES.length
      ) {
        fail('Packaged capability truth Provider batch count diverged from executable registry.', {
          packagedBatchCount: capabilityTruthSnapshot?.providerBridge?.batches?.length ?? null,
          executableBatchCount: FOUNDATION_NATIVE_BRIDGE_BATCHES.length,
        });
      }
      if (
        capabilityTruthSnapshot?.truthBoundary?.directImplementationDoesNotImplyDeploymentVerification
        !== true
        || capabilityTruthSnapshot?.truthBoundary?.providerBridgeDoesNotImplyDirectNativeExecution
        !== true
        || capabilityTruthSnapshot?.truthBoundary?.allFoundationDomainsDirectNativeClaimed
        !== false
      ) {
        fail('Packaged capability truth boundary overclaimed deployment/direct-native guarantees.', {
          truthBoundary: capabilityTruthSnapshot?.truthBoundary ?? null,
        });
      }

      if (manifest?.capabilityTruth?.snapshot !== 'src/foundation-capability-registry-truth.json') {
        fail('Release manifest is not bound to the packaged capability truth snapshot.');
      }
      if (manifest?.capabilityTruth?.truthRoot !== packagedCapabilityTruthRoot) {
        fail('Release manifest capability truth root diverged from packaged snapshot.', {
          manifestTruthRoot: manifest?.capabilityTruth?.truthRoot ?? null,
          packagedTruthRoot: packagedCapabilityTruthRoot ?? null,
        });
      }
      if (manifest?.capabilityTruth?.directRegistryRoot !== directRegistry.registryRoot) {
        fail('Release manifest direct registry root diverged from executable registry.', {
          manifestRoot: manifest?.capabilityTruth?.directRegistryRoot ?? null,
          executableRoot: directRegistry.registryRoot,
        });
      }
      if (manifest?.capabilityTruth?.directImplementationDomainCount !== FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS.length) {
        fail('Release manifest direct implementation domain count drifted.', {
          manifestCount: manifest?.capabilityTruth?.directImplementationDomainCount ?? null,
          executableCount: FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS.length,
        });
      }
      if (manifest?.capabilityTruth?.providerBridgeRegistryRoot !== bridgeRegistry.registryRoot) {
        fail('Release manifest Provider bridge registry root diverged from executable registry.', {
          manifestRoot: manifest?.capabilityTruth?.providerBridgeRegistryRoot ?? null,
          executableRoot: bridgeRegistry.registryRoot,
        });
      }
      if (manifest?.capabilityTruth?.providerBridgeDomainCount !== FOUNDATION_NATIVE_BRIDGE_DOMAINS.length) {
        fail('Release manifest Provider bridge domain count drifted.', {
          manifestCount: manifest?.capabilityTruth?.providerBridgeDomainCount ?? null,
          executableCount: FOUNDATION_NATIVE_BRIDGE_DOMAINS.length,
        });
      }
      if (manifest?.capabilityTruth?.providerBatchCount !== FOUNDATION_NATIVE_BRIDGE_BATCHES.length) {
        fail('Release manifest Provider batch count drifted.', {
          manifestCount: manifest?.capabilityTruth?.providerBatchCount ?? null,
          executableCount: FOUNDATION_NATIVE_BRIDGE_BATCHES.length,
        });
      }
      if (manifest?.capabilityTruth?.verifiedInStagedSource !== true) {
        fail('Release manifest does not prove capability truth was verified in the exact staged source tree.');
      }
      if (manifest?.capabilityTruth?.deploymentEvidenceClaimed !== false) {
        fail('Release manifest incorrectly turns capability implementation truth into deployment evidence.');
      }
      if (manifest?.capabilityTruth?.allFoundationDomainsDirectNativeClaimed !== false) {
        fail('Release manifest incorrectly claims all Foundation domains are direct native.');
      }

      if (manifest?.conformanceTruth?.snapshot !== 'foundation-conformance-truth.json') {
        fail('Release manifest is not bound to the packaged compact truth snapshot.');
      }
      if (manifest?.conformanceTruth?.truthRoot !== truth?.truthRoot) {
        fail('Release manifest truth root diverged from packaged canonical truth.', {
          manifestTruthRoot: manifest?.conformanceTruth?.truthRoot ?? null,
          packagedTruthRoot: truth?.truthRoot ?? null,
        });
      }
      if (manifest?.conformanceTruth?.materializedFromStagedSource !== true) {
        fail('Release manifest does not bind conformance truth to staged source materialization.');
      }
      if (manifest?.conformanceTruth?.deploymentEvidenceClaimed !== false) {
        fail('Release manifest incorrectly claims deployment-bound evidence.');
      }
      for (const phrase of stalePhrases) {
        if (reportText.includes(phrase) || truthText.includes(phrase)) {
          fail('Stale bridge-only execution truth leaked into the developer release archive.', { phrase });
        }
      }

      if (!process.exitCode) {
        console.log(JSON.stringify({
          ok: true,
          status: 'RCL_DEVELOPER_RELEASE_CONFORMANCE_TRUTH_VERIFIED',
          artifact: manifest.artifact.fileName,
          artifactSha256: archiveSha256,
          nativeVm: report.executionLayers.nativeVm,
          truthStatus: truth.status,
          truthRoot: truth.truthRoot,
          capabilityTruthRoot: packagedCapabilityTruthRoot,
          directRegistryRoot: directRegistry.registryRoot,
          providerBridgeRegistryRoot: bridgeRegistry.registryRoot,
          packagedCapabilityTruthBound: true,
          compactTruthSnapshotBound: true,
          directImplementationDomains: actualDirect,
          verifiedDirectDomains: truth.verifiedDirectDomains,
          providerBridgeDomains: truth.verifiedBridgeDomains,
          truthBoundary: truth.truthBoundary,
        }, null, 2));
      }
    }
  }
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

if (process.exitCode) process.exit(process.exitCode);
