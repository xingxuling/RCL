#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'native-windows-build.json');
const sourcePath = path.join(root, 'native', 'rclvm.c');
const exePath = path.join(root, 'native', 'rclvm.exe');
const compilerPath = path.join(root, 'native', 'rclc.exe');
const daemonPath = path.join(root, 'native', 'rclvmd.exe');
const providerDemoPath = path.join(root, 'native', 'provider_demo.exe');
const objectPath = path.join(root, 'native', 'rclvm.o');
const staticLibraryPath = path.join(root, 'native', 'librclvm.a');
const sharedLibraryPath = path.join(root, 'native', 'rclvm.dll');
const importLibraryPath = path.join(root, 'native', 'rclvm.lib');
const manifestPath = path.join(root, 'native', 'native-windows-manifest.json');
const recordPrebuilt = process.argv.includes('--record-prebuilt');

const sourceFiles = [
  'native/rclvm.c',
  'native/rclvm.h',
  'native/rclc.c',
  'native/rclvmd.c',
  'native/provider_demo.c',
  'scripts/build-native-windows.mjs',
];

const distributedArtifacts = [
  exePath,
  compilerPath,
  daemonPath,
  providerDemoPath,
  staticLibraryPath,
  sharedLibraryPath,
  importLibraryPath,
];

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function relativePath(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/');
}

function sourceSha256() {
  const hash = crypto.createHash('sha256');
  for (const relative of sourceFiles) {
    hash.update(relative);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(root, relative)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function artifactRecord(filePath) {
  return {
    path: relativePath(filePath),
    bytes: fs.statSync(filePath).size,
    sha256: sha256File(filePath),
  };
}

function createManifest() {
  const missing = distributedArtifacts.filter(filePath => !fs.existsSync(filePath));
  if (missing.length > 0) {
    throw new Error(`Cannot record prebuilt manifest; missing: ${missing.map(relativePath).join(', ')}`);
  }
  return {
    format: 'rcl.native-windows-prebuilt.v1',
    sourceSha256: sourceSha256(),
    sources: sourceFiles,
    artifacts: distributedArtifacts.map(artifactRecord),
  };
}

function writeManifest() {
  const manifest = createManifest();
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function verifyPrebuiltManifest() {
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, reason: 'PREBUILT_MANIFEST_MISSING', problems: [relativePath(manifestPath)] };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const problems = [];
  const actualSourceSha256 = sourceSha256();
  if (manifest.format !== 'rcl.native-windows-prebuilt.v1') problems.push('manifest format');
  if (manifest.sourceSha256 !== actualSourceSha256) problems.push('source hash');
  const expectedSources = [...sourceFiles].sort();
  const actualSources = Array.isArray(manifest.sources) ? [...manifest.sources].sort() : [];
  if (new Set(actualSources).size !== actualSources.length || JSON.stringify(actualSources) !== JSON.stringify(expectedSources)) problems.push('source path set');
  const expectedArtifactPaths = distributedArtifacts.map(relativePath).sort();
  const artifactRecords = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  const actualArtifactPaths = artifactRecords.map(artifact => artifact?.path).sort();
  if (new Set(actualArtifactPaths).size !== actualArtifactPaths.length || JSON.stringify(actualArtifactPaths) !== JSON.stringify(expectedArtifactPaths)) problems.push('artifact path set');
  const artifactsByPath = new Map(artifactRecords.map(artifact => [artifact?.path, artifact]));
  for (const artifactPath of expectedArtifactPaths) {
    const artifact = artifactsByPath.get(artifactPath);
    if (!artifact) continue;
    const filePath = path.join(root, artifactPath);
    if (!fs.existsSync(filePath)) {
      problems.push(`${artifactPath}: missing`);
      continue;
    }
    if (fs.statSync(filePath).size !== artifact.bytes) problems.push(`${artifactPath}: byte size`);
    if (sha256File(filePath) !== artifact.sha256) problems.push(`${artifactPath}: sha256`);
  }
  return {
    ok: problems.length === 0,
    reason: problems.length === 0 ? 'PREBUILT_NATIVE_ARTIFACTS_VERIFIED' : 'PREBUILT_VERIFICATION_FAILED',
    problems,
    manifest,
    actualSourceSha256,
  };
}

function candidateZigs() {
  return [
    process.env.ZIG,
    path.join(root, '_tools', 'zig-x86_64-windows-0.16.0', 'zig.exe'),
    path.join(root, '_tools', 'zig', 'zig.exe'),
    'zig',
  ].filter(Boolean);
}

function findZig() {
  for (const candidate of candidateZigs()) {
    const result = spawnSync(candidate, ['version'], { encoding: 'utf8' });
    if (result.status === 0) return { path: candidate, version: result.stdout.trim() };
  }
  return null;
}

if (recordPrebuilt) {
  const manifest = writeManifest();
  console.log(JSON.stringify({ ok: true, status: 'PREBUILT_MANIFEST_RECORDED', manifest }, null, 2));
  process.exit(0);
}

const zig = findZig();
if (!zig) {
  const verification = verifyPrebuiltManifest();
  const payload = {
    ok: verification.ok,
    format: 'rcl.native-windows-build.v1',
    status: verification.reason,
    compiler: 'prebuilt',
    sourceSha256: verification.actualSourceSha256,
    artifacts: verification.manifest?.artifacts ?? [],
    problems: verification.problems,
    message: verification.ok
      ? 'Zig is unavailable; the checked Windows native distribution matches its source and artifact manifest.'
      : 'Install Zig to rebuild, or regenerate the checked prebuilt distribution and record it with --record-prebuilt.',
  };
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  const write = verification.ok ? console.log : console.error;
  write(JSON.stringify(payload, null, 2));
  process.exit(verification.ok ? 0 : 1);
}

const env = {
  ...process.env,
  ZIG_GLOBAL_CACHE_DIR: process.env.ZIG_GLOBAL_CACHE_DIR ?? path.join(root, '_tools', 'zig-global-cache'),
  ZIG_LOCAL_CACHE_DIR: process.env.ZIG_LOCAL_CACHE_DIR ?? path.join(root, '_tools', 'zig-local-cache'),
};
const commonArgs = [
  'cc',
  '-target', 'x86_64-windows-gnu',
  '-O3',
  '-std=c11',
  '-Wall',
  '-Wextra',
  '-Wpedantic',
];

const targets = [
  {
    id: 'rclvm-object',
    path: objectPath,
    args: [...commonArgs, '-DRCLVM_EMBEDDED_ONLY', '-c', '-o', objectPath, sourcePath],
  },
  {
    id: 'rclvm-static',
    path: staticLibraryPath,
    args: ['ar', 'rcs', staticLibraryPath, objectPath],
  },
  {
    id: 'rclvm-shared',
    path: sharedLibraryPath,
    args: [
      ...commonArgs,
      '-DRCLVM_EMBEDDED_ONLY',
      '-DRCLVM_BUILD_DLL',
      '-shared',
      '-o', sharedLibraryPath,
      sourcePath,
      `-Wl,--out-implib,${importLibraryPath}`,
      '-lbcrypt',
      '-lm',
    ],
  },
  {
    id: 'rclvm',
    path: exePath,
    args: [...commonArgs, '-o', exePath, sourcePath, '-lbcrypt', '-lm'],
  },
  {
    id: 'rclvmd',
    path: daemonPath,
    args: [
      ...commonArgs,
      '-DRCLVM_EMBEDDED_ONLY',
      '-o', daemonPath,
      path.join(root, 'native', 'rclvmd.c'),
      sourcePath,
      '-lbcrypt',
      '-lm',
    ],
  },
  {
    id: 'rclc',
    path: compilerPath,
    args: [
      ...commonArgs,
      '-DRCLVM_EMBEDDED_ONLY',
      '-o', compilerPath,
      path.join(root, 'native', 'rclc.c'),
      sourcePath,
      '-lbcrypt',
      '-lm',
    ],
  },
  {
    id: 'provider_demo',
    path: providerDemoPath,
    args: [
      ...commonArgs,
      '-DRCLVM_EMBEDDED_ONLY',
      '-o', providerDemoPath,
      path.join(root, 'native', 'provider_demo.c'),
      sourcePath,
      '-lbcrypt',
      '-lm',
    ],
  },
];

function runBuild(target) {
  const build = spawnSync(zig.path, target.args, {
    cwd: root,
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    id: target.id,
    command: [zig.path, ...target.args],
    exitCode: build.status,
    stdout: build.stdout.trim(),
    stderr: build.stderr.trim(),
    artifact: fs.existsSync(target.path) ? {
      path: path.relative(root, target.path).replaceAll(path.sep, '/'),
      bytes: fs.statSync(target.path).size,
      sha256: sha256File(target.path),
    } : null,
  };
}

const builds = targets.map(runBuild);

const payload = {
  ok: builds.every(build => build.exitCode === 0 && build.artifact),
  format: 'rcl.native-windows-build.v1',
  zig,
  builds,
  artifact: fs.existsSync(exePath) ? {
    path: path.relative(root, exePath).replaceAll(path.sep, '/'),
    bytes: fs.statSync(exePath).size,
    sha256: sha256File(exePath),
  } : null,
  compilerArtifact: fs.existsSync(compilerPath) ? {
    path: path.relative(root, compilerPath).replaceAll(path.sep, '/'),
    bytes: fs.statSync(compilerPath).size,
    sha256: sha256File(compilerPath),
  } : null,
  libraries: {
    static: fs.existsSync(staticLibraryPath) ? {
      path: path.relative(root, staticLibraryPath).replaceAll(path.sep, '/'),
      bytes: fs.statSync(staticLibraryPath).size,
      sha256: sha256File(staticLibraryPath),
    } : null,
    shared: fs.existsSync(sharedLibraryPath) ? {
      path: path.relative(root, sharedLibraryPath).replaceAll(path.sep, '/'),
      bytes: fs.statSync(sharedLibraryPath).size,
      sha256: sha256File(sharedLibraryPath),
    } : null,
    import: fs.existsSync(importLibraryPath) ? {
      path: relativePath(importLibraryPath),
      bytes: fs.statSync(importLibraryPath).size,
      sha256: sha256File(importLibraryPath),
    } : null,
  },
};

if (payload.ok) {
  try {
    payload.manifest = writeManifest();
  } catch (error) {
    payload.ok = false;
    payload.manifestError = error.message;
  }
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));

if (!payload.ok) process.exitCode = 1;
