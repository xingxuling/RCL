import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  RCL_NATIVE_VM_CANONICAL_BUILD_SUPPORT_FORMAT,
  RCL_NATIVE_VM_CANONICAL_HEADER,
  RCL_NATIVE_VM_CANONICAL_MAKEFILE,
  nativeVmCanonicalBuildSupportRoots,
} from './native-vm-canonical-build-support.mjs';

export const RCL_NATIVE_VM_MATERIALIZATION_FORMAT = 'taowind.rcl-native-vm-materialization.v0.2';
export const RCL_NATIVE_VM_MATERIALIZATION_VERSION = '0.2.0';
const CACHE_MANIFEST_FORMAT = 'taowind.rcl-native-vm-source-cache.v0.1';
const BUILD_ENV_KEYS = ['CC', 'CFLAGS', 'CPPFLAGS', 'LDFLAGS'];

function errorWith(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'RCLNativeVMMaterializationError';
  error.code = code;
  error.details = details;
  return error;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readTextIfPresent(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function stableBuildEnvironment(env) {
  return Object.fromEntries(BUILD_ENV_KEYS.map(key => [key, env[key] ?? null]));
}

function loadCacheManifest(manifestPath) {
  try { return JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch { return null; }
}

function validCachedBinary(vmPath, manifestPath, sourceRoot) {
  if (!fs.existsSync(vmPath) || !fs.existsSync(manifestPath)) return null;
  const manifest = loadCacheManifest(manifestPath);
  if (manifest?.format !== CACHE_MANIFEST_FORMAT || manifest?.sourceRoot !== sourceRoot) return null;
  const binary = fs.readFileSync(vmPath);
  if (sha256(binary) !== manifest.binarySha256) return null;
  return manifest;
}

function resolveBuildSupport(nativeDir) {
  const repositoryMakefile = readTextIfPresent(path.join(nativeDir, 'Makefile'));
  const repositoryHeader = readTextIfPresent(path.join(nativeDir, 'rclvm.h'));
  return {
    makefile: repositoryMakefile ?? RCL_NATIVE_VM_CANONICAL_MAKEFILE,
    header: repositoryHeader ?? RCL_NATIVE_VM_CANONICAL_HEADER,
    provenance: {
      makefile: repositoryMakefile === null ? 'embedded-canonical-support' : 'repository-source',
      header: repositoryHeader === null ? 'embedded-canonical-support' : 'repository-source',
    },
  };
}

export function defaultNativeVmPath(root, platform = process.platform) {
  return path.join(root, 'native', platform === 'win32' ? 'rclvm.exe' : 'rclvm');
}

export function materializeNativeVm(root, options = {}) {
  if (typeof root !== 'string' || root.length === 0) throw new TypeError('root must be a non-empty path');

  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const explicitVmPath = options.vmPath ?? null;
  const vmPath = explicitVmPath ?? defaultNativeVmPath(root, platform);
  if (fs.existsSync(vmPath)) {
    return {
      format: RCL_NATIVE_VM_MATERIALIZATION_FORMAT,
      version: RCL_NATIVE_VM_MATERIALIZATION_VERSION,
      vmPath,
      built: false,
      cached: false,
      provenance: explicitVmPath ? 'explicit-binary' : 'bundled-or-prebuilt-binary',
      binarySha256: sha256(fs.readFileSync(vmPath)),
    };
  }

  if (explicitVmPath) {
    throw errorWith('RCL_NATIVE_VM_MISSING', `Native VM binary is missing at ${vmPath}`, {
      vmPath,
      explicitPath: true,
      buildAttempted: false,
    });
  }
  if (options.buildIfMissing === false) {
    throw errorWith('RCL_NATIVE_VM_MISSING', `Native VM binary is missing at ${vmPath}`, {
      vmPath,
      explicitPath: false,
      buildAttempted: false,
    });
  }
  if (platform === 'win32') {
    throw errorWith('RCL_NATIVE_VM_MISSING', `Native VM binary is missing at ${vmPath}; automatic source materialization is currently limited to Makefile platforms`, {
      vmPath,
      platform,
      buildAttempted: false,
    });
  }

  const nativeDir = path.join(root, 'native');
  const sourcePath = path.join(nativeDir, 'rclvm.c');
  if (!fs.existsSync(sourcePath)) {
    throw errorWith('RCL_NATIVE_VM_SOURCE_MISSING', 'Native VM implementation source rclvm.c is missing', {
      vmPath,
      missing: [sourcePath],
      buildAttempted: false,
    });
  }

  const source = fs.readFileSync(sourcePath);
  const support = resolveBuildSupport(nativeDir);
  const supportRoots = nativeVmCanonicalBuildSupportRoots();
  const makePath = options.makePath ?? options.env?.MAKE ?? process.env.MAKE ?? 'make';
  const buildEnv = { ...process.env, ...(options.env ?? {}) };
  const sourceDescriptor = {
    format: RCL_NATIVE_VM_CANONICAL_BUILD_SUPPORT_FORMAT,
    platform,
    arch,
    sourceSha256: sha256(source),
    makefileSha256: sha256(support.makefile),
    headerSha256: sha256(support.header),
    buildTool: makePath,
    buildEnvironment: stableBuildEnvironment(buildEnv),
  };
  const sourceRoot = sha256(JSON.stringify(sourceDescriptor));
  const cacheRoot = path.resolve(options.cacheRoot ?? path.join(os.tmpdir(), 'taowind-rcl-native-vm-cache'));
  const stageDir = path.join(cacheRoot, `${platform}-${arch}-${sourceRoot.slice(0, 24)}`);
  const stagedVmPath = path.join(stageDir, 'rclvm');
  const manifestPath = path.join(stageDir, 'materialization-manifest.json');
  const cachedManifest = validCachedBinary(stagedVmPath, manifestPath, sourceRoot);
  if (cachedManifest) {
    return {
      format: RCL_NATIVE_VM_MATERIALIZATION_FORMAT,
      version: RCL_NATIVE_VM_MATERIALIZATION_VERSION,
      vmPath: stagedVmPath,
      built: false,
      cached: true,
      provenance: 'staged-source-cache',
      sourceRoot,
      supportProvenance: cachedManifest.supportProvenance,
      binarySha256: cachedManifest.binarySha256,
      build: cachedManifest.build,
    };
  }

  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });
  fs.copyFileSync(sourcePath, path.join(stageDir, 'rclvm.c'));
  fs.writeFileSync(path.join(stageDir, 'Makefile'), support.makefile);
  fs.writeFileSync(path.join(stageDir, 'rclvm.h'), support.header);

  const spawn = options.spawnSyncImpl ?? spawnSync;
  const run = spawn(makePath, ['-C', stageDir, 'rclvm'], {
    cwd: root,
    encoding: 'utf8',
    env: buildEnv,
    maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
    timeout: options.buildTimeout ?? 120_000,
  });

  const commonDetails = {
    vmPath: stagedVmPath,
    requestedVmPath: vmPath,
    sourceRoot,
    stageDir,
    makePath,
    supportProvenance: support.provenance,
    supportRoots,
  };
  if (run.error) {
    throw errorWith('RCL_NATIVE_VM_BUILD_TOOL', `Unable to invoke native VM build tool '${makePath}': ${run.error.message}`, {
      ...commonDetails,
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      buildAttempted: true,
    });
  }
  if (run.status !== 0) {
    throw errorWith('RCL_NATIVE_VM_BUILD_FAILED', `Native VM source materialization failed with status ${run.status}`, {
      ...commonDetails,
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      buildAttempted: true,
    });
  }
  if (!fs.existsSync(stagedVmPath)) {
    throw errorWith('RCL_NATIVE_VM_BUILD_OUTPUT_MISSING', `Native VM build completed without creating ${stagedVmPath}`, {
      ...commonDetails,
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      buildAttempted: true,
    });
  }

  const binarySha256 = sha256(fs.readFileSync(stagedVmPath));
  const build = {
    tool: makePath,
    target: 'rclvm',
    stageDir,
    binarySha256,
  };
  const manifest = {
    format: CACHE_MANIFEST_FORMAT,
    materializationFormat: RCL_NATIVE_VM_MATERIALIZATION_FORMAT,
    sourceRoot,
    sourceDescriptor,
    supportProvenance: support.provenance,
    supportRoots,
    build,
    binarySha256,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    format: RCL_NATIVE_VM_MATERIALIZATION_FORMAT,
    version: RCL_NATIVE_VM_MATERIALIZATION_VERSION,
    vmPath: stagedVmPath,
    built: true,
    cached: false,
    provenance: 'staged-repository-source-makefile',
    sourceRoot,
    supportProvenance: support.provenance,
    binarySha256,
    build,
  };
}
