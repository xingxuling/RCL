import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(
  root,
  'docs/reality-hub/lovable/v0.94.0-alpha.1/reality-hub-consumer-manifest.json',
);

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

test('Lovable consumer manifest is version locked to the canonical private prerelease', () => {
  const manifest = readManifest();

  assert.equal(manifest.format, 'taowind.rcl.reality-hub-consumer.v1');
  assert.equal(manifest.authority.repository, 'xingxuling/RCL');
  assert.equal(manifest.authority.repositoryVisibility, 'private');
  assert.equal(manifest.authority.releaseTag, 'rcl-v0.94.0-alpha.1-reality-hub.2');
  assert.equal(manifest.authority.githubAuthenticationRequired, true);
  assert.equal(manifest.authority.anonymousPublicDownload, false);
  assert.equal(manifest.versions.rcl, '0.94.0-alpha.1');
  assert.equal(manifest.versions.tutorSkill, '1.1.1');
});

test('Lovable consumer manifest preserves all published artifact hashes', () => {
  const manifest = readManifest();

  assert.equal(
    manifest.artifacts.runtime.sha256,
    '2d456d733ef94454cf9e5a36196ad248742f4fbd35c5635df2718138fa6348c9',
  );
  assert.equal(
    manifest.artifacts.tutorSkill.sha256,
    '17d1019c375d626067ba0c5730a2bd1ba0702ba9daba37e861d45aacbff1863f',
  );
  assert.equal(
    manifest.artifacts.integrationPack.sha256,
    '751018ae2020a716f0d62555ba9d8d8ff4144fe59fa0277b66d8ed246406b1bb',
  );

  for (const artifact of Object.values(manifest.artifacts)) {
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(artifact.bytes) && artifact.bytes > 0);
    assert.match(artifact.downloadUrl, /^https:\/\/github\.com\/xingxuling\/RCL\/releases\/download\//);
  }
});

test('Canonical MCP adapter is server-side, non-native by default and never silently falls back', () => {
  const manifest = readManifest();
  const canonical = manifest.compilerAdapters.find(
    (adapter) => adapter.id === 'rcl-mcp-0.94.0-alpha.1',
  );

  assert.ok(canonical);
  assert.equal(canonical.canonical, true);
  assert.equal(canonical.serverSideOnly, true);
  assert.equal(canonical.defaultOperation, 'rcl_compile_source');
  assert.deepEqual(canonical.defaultArguments, { runNative: false });
  assert.equal(canonical.nativeExecutionRequiresExplicitUserAction, true);
  assert.equal(canonical.silentFallbackToDemoForbidden, true);
  assert.equal(manifest.selectionPolicy.onCanonicalFailure, 'block-and-report');
  assert.ok(
    manifest.selectionPolicy.never.includes(
      'silently fall back to demo after a canonical request',
    ),
  );
});

test('Truth boundary does not overclaim self-hosting, runtime completion or check execution', () => {
  const { truthBoundary } = readManifest();

  assert.equal(truthBoundary.canonicalSource, true);
  assert.equal(truthBoundary.referenceCompiler, 'javascript');
  assert.equal(truthBoundary.nativeCoreCompilerSelfHosting, 'verified-declared-subset');
  assert.equal(truthBoundary.fullSelfHosting, false);
  assert.equal(truthBoundary.completeNativeRuntime, false);
  assert.equal(truthBoundary.javascriptReferenceRuntimeStillRequired, true);
  assert.equal(truthBoundary.checkNeverExecutesProgram, true);
});
