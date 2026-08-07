import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createExecutionObservation } from './differential-absorption-runner.mjs';
import { runtimeType } from './quantity.mjs';
import { semanticValue, verifyNativeSemanticStateRoot } from './semantic-state-root.mjs';
import { assembleRbc13DomainCallProgram } from './rbc13-domain-bytecode-candidate.mjs';
import { materializeRbc13DomainVmWithPublicApi } from '../scripts/materialize-rbc13-domain-vm-public-api.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const RBC13_DOMAIN_NATIVE_RUNTIME_FORMAT = 'taowind.rcl-rbc13-domain-native-runtime.v0.1';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function commandExists(command) {
  const probe = spawnSync('sh', ['-lc', `command -v ${command}`], { encoding: 'utf8' });
  return probe.status === 0;
}

export function resolveDomainCandidateCompiler(options = {}) {
  if (process.platform === 'win32') return null;
  const requested = options.compiler ?? process.env.RCL_DOMAIN_CC ?? null;
  if (requested) return commandExists(requested) ? requested : null;
  if (commandExists('cc')) return 'cc';
  if (commandExists('gcc')) return 'gcc';
  return null;
}

function pureOperationObservation(output, receipts = [], metadata = null) {
  return createExecutionObservation({
    status: 'ok',
    output,
    effects: [{ kind: 'internal-domain-evaluation', externalMutation: false, persistentMutation: false }],
    evidence: [{ kind: 'semantic-contract', contract: 'rbc13-domain-operation-differential.v0.1' }],
    resourceDelta: { externalResourcesCreated: 0, externalResourcesMutated: 0, persistentStateMutation: false },
    authority: { required: false, boundary: 'pure-internal-domain-operation' },
    exitCode: 0,
    receipts,
    metadata,
  });
}

function quantityLike(value) {
  return Boolean(value) && typeof value === 'object' && value.kind === 'Quantity'
    && typeof value.type === 'string' && typeof value.value === 'number';
}

function lowerStructuredArg(calls, value, label) {
  if (!quantityLike(value)) return value;
  const target = `__rbc13.arg.${label}`;
  calls.push({
    domain: 'quantity',
    operation: 'make',
    args: [value.type, value.value, value.unit ?? ''],
    target,
  });
  return { $state: target };
}

export function buildRbc13NativeOperationProgram(input, options = {}) {
  const domain = String(input?.domain ?? '');
  const operation = String(input?.operation ?? '');
  const operationKey = `${domain}.${operation}`;
  const rawArgs = Array.isArray(input?.args) ? input.args : [];
  const calls = [];
  const args = rawArgs.map((value, index) => lowerStructuredArg(calls, value, `${index + 1}`));
  const target = options.target ?? '__rbc13.result';
  calls.push({ domain, operation, args, target, dynamic: options.dynamic === true });
  const bytecode = assembleRbc13DomainCallProgram({
    program: `Rbc13Native_${operationKey.replaceAll('.', '_')}`,
    sourceRoot: `candidate:native:${operationKey}`,
    calls,
  });
  return Object.freeze({ operationKey, target, calls: Object.freeze(calls), bytecode, bytecodeRoot: sha256(bytecode) });
}

function parsePayload(run, context) {
  const stdout = String(run.stdout ?? '').trim();
  if (!stdout) {
    const error = new Error(`Candidate native host produced no JSON output for ${context}`);
    error.code = 'RCL_RBC13_NATIVE_OUTPUT_MISSING';
    error.details = { status: run.status, stderr: String(run.stderr ?? '') };
    throw error;
  }
  try {
    return JSON.parse(stdout);
  } catch (cause) {
    const error = new Error(`Candidate native host produced invalid JSON for ${context}`);
    error.code = 'RCL_RBC13_NATIVE_OUTPUT_JSON';
    error.details = { stdout, stderr: String(run.stderr ?? ''), cause: String(cause?.message ?? cause) };
    throw error;
  }
}

function semanticErrorDetails(payload, input) {
  const code = String(payload?.code ?? '');
  const args = Array.isArray(input?.args) ? input.args : [];
  if (code === 'RCL_MEASUREMENT_TYPE') {
    return { baseType: args[0], actual: runtimeType(args[1]) };
  }
  if (code === 'RCL_UNCERTAINTY_TYPE') {
    return { baseType: args[0], actual: runtimeType(args[2]) };
  }
  if (code === 'RCL_CONFIDENCE_RANGE') {
    return { confidence: Number(args[3]) };
  }
  if (code === 'RCL_KNOWLEDGE_TYPE') {
    return { baseType: args[0], actual: runtimeType(args[1]) };
  }
  if (code === 'RCL_KNOWLEDGE_CONFIDENCE_RANGE') {
    return { confidence: Number(args[2]) };
  }
  return null;
}

function throwSemanticNativeError(payload, receipt, input) {
  const error = new Error(String(payload?.message ?? 'Candidate DOMAIN_CALL failed'));
  error.code = String(payload?.code ?? 'RCL_RBC13_NATIVE_FAILURE');
  error.details = semanticErrorDetails(payload, input);
  Object.defineProperty(error, 'nativeReceipt', {
    value: receipt,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  throw error;
}

export function buildRbc13DomainCandidateHost(options = {}) {
  const compiler = resolveDomainCandidateCompiler(options);
  if (!compiler) {
    const error = new Error('No supported C compiler is available for the RBC 1.3 Domain Organ candidate host');
    error.code = 'RCL_RBC13_NATIVE_COMPILER_MISSING';
    throw error;
  }
  const root = path.resolve(options.root ?? ROOT);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-rbc13-domain-native-'));
  const generatedVmPath = path.join(tempDir, 'rclvm-rbc13-domain-candidate.c');
  const hostPath = path.join(tempDir, 'rbc13-domain-candidate-host');
  const currentNativePath = path.join(root, 'native', 'rclvm.c');
  const currentNative = fs.readFileSync(currentNativePath, 'utf8');
  const materializedVm = materializeRbc13DomainVmWithPublicApi(currentNative);
  fs.writeFileSync(generatedVmPath, materializedVm);

  const sourceFiles = [
    'native/rcl_domain_value.c',
    'native/rcl_domain_value.h',
    'native/rcl_domain_organ.c',
    'native/rcl_domain_organ.h',
    'native/rcl_domain_admitted_organs.c',
    'native/rcl_domain_admitted_organs.h',
    'native/rcl_domain_vm_value_bridge.inc',
    'native/rcl_domain_vm_candidate.h',
    'native/domain_vm_opcode45_candidate_host.c',
    'scripts/materialize-rbc13-domain-vm-candidate.mjs',
    'scripts/materialize-rbc13-domain-vm-public-api.mjs',
  ];
  const sourceRoots = Object.fromEntries(sourceFiles.map(relative => [relative, sha256File(path.join(root, relative))]));
  const implementationRoot = sha256(JSON.stringify({
    format: 'rcl.rbc13-domain-native-implementation.v0.1',
    materializedVmRoot: sha256(materializedVm),
    sourceRoots,
  }));

  const build = spawnSync(compiler, [
    '-std=c11', '-Wall', '-Wextra', '-pedantic',
    `-I${path.join(root, 'native')}`, `-I${tempDir}`,
    path.join(root, 'native', 'rcl_domain_value.c'),
    path.join(root, 'native', 'rcl_domain_organ.c'),
    path.join(root, 'native', 'rcl_domain_admitted_organs.c'),
    path.join(root, 'native', 'domain_vm_opcode45_candidate_host.c'),
    '-lcrypto', '-lm', '-o', hostPath,
  ], { cwd: root, encoding: 'utf8', timeout: options.buildTimeout ?? 120_000 });
  if (build.status !== 0) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    const error = new Error('Failed to build the RBC 1.3 Domain Organ candidate host');
    error.code = 'RCL_RBC13_NATIVE_BUILD_FAILED';
    error.details = { compiler, status: build.status, stdout: build.stdout, stderr: build.stderr };
    throw error;
  }

  const hostRoot = sha256File(hostPath);
  const compilerVersion = spawnSync(compiler, ['--version'], { encoding: 'utf8' }).stdout?.split(/\r?\n/)[0]?.trim() ?? compiler;
  let closed = false;

  function execute(input, context = {}) {
    if (closed) {
      const error = new Error('RBC 1.3 Domain Organ candidate host has been closed');
      error.code = 'RCL_RBC13_NATIVE_HOST_CLOSED';
      throw error;
    }
    const program = buildRbc13NativeOperationProgram(input, context);
    const rbcPath = path.join(tempDir, `${context.caseId ?? program.operationKey.replaceAll('.', '_')}.rbc`);
    fs.writeFileSync(rbcPath, program.bytecode);
    const started = process.hrtime.bigint();
    const run = spawnSync(hostPath, [rbcPath, '--candidate-minimum'], {
      encoding: 'utf8',
      timeout: context.timeout ?? options.runTimeout ?? 30_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    const runtimeMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const payload = parsePayload(run, context.caseId ?? program.operationKey);
    const receipt = Object.freeze({
      format: 'rcl.rbc13-domain-native-receipt.v0.1',
      operationKey: program.operationKey,
      caseId: context.caseId ?? null,
      hostRoot,
      implementationRoot,
      bytecodeRoot: program.bytecodeRoot,
      bytecodeBytes: program.bytecode.length,
      exitStatus: run.status,
      runtimeMs: Number(runtimeMs.toFixed(3)),
      nativeStateRoot: payload?.stateRoot ?? null,
      nativeStateRootAlgorithm: payload?.stateRootAlgorithm ?? null,
    });
    if (run.status !== 0) throwSemanticNativeError(payload, receipt, input);
    const verified = verifyNativeSemanticStateRoot(payload, { requireNativeRoot: true });
    if (!Object.prototype.hasOwnProperty.call(verified.state ?? {}, program.target)) {
      const error = new Error(`Candidate native state is missing ${program.target}`);
      error.code = 'RCL_RBC13_NATIVE_RESULT_MISSING';
      error.details = { receipt, state: verified.state };
      throw error;
    }
    return pureOperationObservation(
      semanticValue(verified.state[program.target]),
      [{ ...receipt, nativeStateRoot: verified.stateRoot, stateRootVerified: verified.stateRootVerified }],
      {
        operationKey: program.operationKey,
        stateRoot: verified.stateRoot,
        stateRootVerified: verified.stateRootVerified,
        bytecodeRoot: program.bytecodeRoot,
      },
    );
  }

  function close() {
    if (closed) return;
    closed = true;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return Object.freeze({
    format: RBC13_DOMAIN_NATIVE_RUNTIME_FORMAT,
    compiler,
    compilerVersion,
    hostPath,
    hostRoot,
    implementationRoot,
    materializedVmRoot: sha256(materializedVm),
    sourceRoots: Object.freeze(sourceRoots),
    execute,
    close,
  });
}
