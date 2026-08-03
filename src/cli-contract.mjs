import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '..');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function packageMetadata() {
  const pkg = readJson(path.join(PACKAGE_ROOT, 'package.json'));
  const contract = readJson(path.join(PACKAGE_ROOT, 'VERSION-CONTRACT.json'));
  return { pkg, contract };
}

function nativeCandidates() {
  if (process.platform === 'win32') {
    return ['native/rclvm.exe', 'native/rclc.exe', 'native/rclfoundation.exe'];
  }
  return ['native/rclvm', 'native/rclc', 'native/rclfoundation'];
}

function checkRecord(id, status, detail, evidence = null) {
  return { id, status, detail, ...(evidence ? { evidence } : {}) };
}

export function getVersionPayload() {
  const { pkg, contract } = packageMetadata();
  return {
    name: pkg.name,
    version: pkg.version,
    contractFormat: contract.format,
    canonicalRepository: contract.repository,
    canonicalBranch: contract.canonicalBranch,
    canonical: contract.canonical === true,
    verifiedCeiling: contract.verifiedCeiling,
    boundary: contract.boundary,
  };
}

export function printVersion({ json = false } = {}) {
  const payload = getVersionPayload();
  if (json) console.log(JSON.stringify(payload, null, 2));
  else console.log(`${payload.name} ${payload.version}`);
  return payload;
}

export function runDoctor() {
  const { pkg, contract } = packageMetadata();
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const checks = [];

  checks.push(
    checkRecord(
      'node-runtime',
      nodeMajor >= 18 ? 'pass' : 'fail',
      `Node.js ${process.versions.node}; required >=18`,
    ),
  );

  checks.push(
    checkRecord(
      'version-contract',
      pkg.version === contract.packageVersion ? 'pass' : 'fail',
      `package.json=${pkg.version}; VERSION-CONTRACT=${contract.packageVersion}`,
      'VERSION-CONTRACT.json',
    ),
  );

  checks.push(
    checkRecord(
      'canonical-source',
      contract.canonical === true ? 'pass' : 'warn',
      contract.canonical === true
        ? `${contract.repository}@${contract.canonicalBranch} is declared canonical`
        : 'source package is not declared canonical',
      'VERSION-CONTRACT.json',
    ),
  );

  const requiredSources = [
    'src/cli.mjs',
    'src/index.mjs',
    'selfhost/compiler-core.rcl',
    'selfhost/compiler-main.rcl',
    'examples/hello-reality.rcl',
  ];
  const missingSources = requiredSources.filter((relative) => !fs.existsSync(path.join(PACKAGE_ROOT, relative)));
  checks.push(
    checkRecord(
      'required-sources',
      missingSources.length === 0 ? 'pass' : 'fail',
      missingSources.length === 0
        ? `all ${requiredSources.length} required sources are present`
        : `missing: ${missingSources.join(', ')}`,
    ),
  );

  const natives = nativeCandidates().filter((relative) => fs.existsSync(path.join(PACKAGE_ROOT, relative)));
  checks.push(
    checkRecord(
      'host-native-tools',
      natives.length > 0 ? 'pass' : 'warn',
      natives.length > 0
        ? `available: ${natives.join(', ')}`
        : `no host-native executable found for ${process.platform}/${process.arch}; JavaScript reference runtime remains usable`,
    ),
  );

  const selfhostArtifact = 'selfhost/compiler.rbc';
  checks.push(
    checkRecord(
      'selfhost-artifact',
      fs.existsSync(path.join(PACKAGE_ROOT, selfhostArtifact)) ? 'pass' : 'warn',
      fs.existsSync(path.join(PACKAGE_ROOT, selfhostArtifact))
        ? `${selfhostArtifact} is present`
        : `${selfhostArtifact} is absent; run npm run build:selfhost-compiler`,
    ),
  );

  let tempStatus = 'pass';
  let tempDetail = `temporary directory writable: ${os.tmpdir()}`;
  const probe = path.join(os.tmpdir(), `rcl-doctor-${process.pid}-${Date.now()}.tmp`);
  try {
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
  } catch (error) {
    tempStatus = 'fail';
    tempDetail = `temporary directory is not writable: ${error.message}`;
  }
  checks.push(checkRecord('filesystem', tempStatus, tempDetail));

  const failures = checks.filter((check) => check.status === 'fail');
  const warnings = checks.filter((check) => check.status === 'warn');
  return {
    ok: failures.length === 0,
    command: 'doctor',
    package: pkg.name,
    version: pkg.version,
    platform: process.platform,
    architecture: process.arch,
    runtime: `node ${process.versions.node}`,
    compilerBoundary: {
      nativeCoreCompilerSelfHosting: contract.boundary.nativeCoreCompilerSelfHosting,
      fullSelfHosting: contract.boundary.fullSelfHosting,
      completeRuntime: contract.boundary.completeRuntime,
      jsReferenceRuntimeStillRequired: contract.boundary.jsReferenceRuntimeStillRequired,
    },
    summary: {
      pass: checks.length - failures.length - warnings.length,
      warn: warnings.length,
      fail: failures.length,
    },
    checks,
  };
}

export function checkSourceFile(file, tryCompileReality) {
  if (!file) {
    return {
      ok: false,
      command: 'check',
      diagnostics: [
        {
          code: 'RCL_CLI_FILE_REQUIRED',
          severity: 'error',
          message: 'Usage: rcl check <file.rcl>',
        },
      ],
    };
  }

  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return {
      ok: false,
      command: 'check',
      file: absolute,
      diagnostics: [
        {
          code: 'RCL_CLI_FILE_NOT_FOUND',
          severity: 'error',
          message: `RCL source file not found: ${absolute}`,
        },
      ],
    };
  }

  const source = fs.readFileSync(absolute, 'utf8');
  const startedAt = performance.now();
  const result = tryCompileReality(source);
  const durationMs = Number((performance.now() - startedAt).toFixed(3));
  const diagnostics = result.diagnostics ?? [];

  return {
    ok: result.ok === true,
    command: 'check',
    file: absolute,
    bytes: Buffer.byteLength(source),
    durationMs,
    compiler: 'rcl-javascript-reference-compiler',
    authenticity: 'canonical-source-reference-check',
    boundary: 'This validates source with the canonical JavaScript reference compiler; it does not claim whole-language native runtime execution.',
    diagnostics,
    summary: result.ok === true
      ? `RCL source accepted with ${diagnostics.length} diagnostic(s)`
      : `RCL source rejected with ${diagnostics.length} diagnostic(s)`,
  };
}

export function printPublicHelp() {
  console.log(`RCL public CLI contract

Core verification:
  rcl --version                 Print package version
  rcl version --json            Print version contract metadata
  rcl doctor                    Inspect runtime, sources, native tools and boundaries
  rcl check <file.rcl>          Validate source without executing it

Core execution:
  rcl compile <file.rcl>        Compile with the JavaScript reference compiler
  rcl run <file.rcl>            Execute with the JavaScript reference runtime
  rcl bytecode <file.rcl>       Emit self-hosted RBC bytecode
  rcl native <file.rcl>         Compile and execute through the host native VM

Use the project README for the complete advanced command catalogue.`);
}
