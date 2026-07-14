import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import {
  DEFAULT_NATIVE_COMPILER_PATH,
  RCLNativeVMError,
  runNativeBytecode,
  runNativeCompiler,
  runRealityNative,
} from '../src/native-vm.mjs';
import { runReality } from '../src/runtime.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assemblePushStressBytecode(pushCount) {
  const strings = ['NativeStackLimitStress', 'native:stack-limit'];
  const stringBytes = strings.map(value => Buffer.from(value));
  const headerBytes = 36;
  const poolBytes = stringBytes.reduce((total, value) => total + 4 + value.length, 0);
  const instructionCount = pushCount + 1;
  const buffer = Buffer.alloc(headerBytes + poolBytes + instructionCount * 16);
  buffer.write('RCLB', 0, 4, 'ascii');
  buffer.writeUInt16LE(1, 4);
  buffer.writeUInt16LE(1, 6);
  buffer.writeUInt32LE(0, 8);
  buffer.writeUInt32LE(0, 12);
  buffer.writeUInt32LE(1, 16);
  buffer.writeUInt32LE(strings.length, 20);
  buffer.writeUInt32LE(0, 24);
  buffer.writeUInt32LE(instructionCount, 28);
  let offset = headerBytes;
  for (const value of stringBytes) {
    buffer.writeUInt32LE(value.length, offset);
    offset += 4;
    value.copy(buffer, offset);
    offset += value.length;
  }
  for (let index = 0; index < pushCount; index++) {
    buffer.writeUInt8(2, offset);
    buffer.writeInt32LE(1, offset + 4);
    offset += 16;
  }
  buffer.writeUInt8(31, offset);
  return buffer;
}

function findZig() {
  const candidates = [
    process.env.ZIG,
    path.join(ROOT, '_tools', 'zig-x86_64-windows-0.16.0', 'zig.exe'),
    path.join(ROOT, '_tools', 'zig', 'zig.exe'),
    'zig',
  ].filter(Boolean);
  return candidates.find(candidate => spawnSync(candidate, ['version'], { encoding: 'utf8' }).status === 0) ?? null;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('native core bytecode implements MOD and JS-compatible and/or short circuiting', async () => {
  const source = `reality NativeCoreSemantics {
    facet logic.and : Truth = false and late.value
    facet logic.or : Truth = true or late.value
    facet math.mod : Number = 17 % 5
    facet late.value : Truth = true
  }`;
  const bytecode = compileRealityToBytecode(source);
  const decoded = decodeBytecode(bytecode);
  const names = decoded.instructions.map(instruction => instruction.name);

  assert.deepEqual(decodeBytecode(compileRealityToBytecode('reality Base11 { facet world.ready : Truth = true }')).version, { major: 1, minor: 1 });
  assert.deepEqual(decoded.version, { major: 1, minor: 2 });
  assert.deepEqual(
    decodeBytecode(compileRealityToBytecode('reality LiteralProvider11 { facet reply.value : Text = provider_call("echo", "echo.text", "request") }')).version,
    { major: 1, minor: 1 },
  );
  assert.equal(names.includes('MOD'), true);
  assert.equal(names.includes('AND'), false);
  assert.equal(names.includes('OR'), false);
  assert.ok(names.filter(name => name === 'JUMP_IF_FALSE').length >= 2);

  const native = runRealityNative(source);
  const reference = await runReality(source);
  assert.deepEqual(native.state, reference.state);
  assert.deepEqual(native.state, {
    'late.value': true,
    'logic.and': false,
    'logic.or': true,
    'math.mod': 2,
  });
});

test('native VM exports and verifies the canonical semantic authority state root', () => {
  const source = `reality NativeAuthorityStateRoot {
    facet world.ready : Truth = true
    facet world.value : Number = 7
  }`;
  const result = runRealityNative(source);
  assert.match(result.nativeStateRoot, /^[0-9a-f]{64}$/);
  assert.equal(result.stateRoot, result.nativeStateRoot);
  assert.equal(result.stateRootVerified, true);
});

test('native LOAD_STATE reports the reference runtime missing-state code and message', () => {
  const source = `reality NativeMissingState {
    facet early.value : Truth = late.value
    facet late.value : Truth = true
  }`;
  assert.throws(
    () => runRealityNative(source),
    error => error instanceof RCLNativeVMError
      && error.code === 'RCL_STATE_MISSING'
      && error.message === "Facet 'late.value' does not exist",
  );
});

test('native loader enforces RBC feature versions and rejects unknown future versions', () => {
  const base = compileRealityToBytecode('reality VersionBase { facet world.ready : Truth = true }');
  const future = Buffer.from(base);
  future.writeUInt16LE(4, 6);
  assert.throws(
    () => runNativeBytecode(future),
    error => error instanceof RCLNativeVMError && error.message.includes('RCL_NATIVE_BYTECODE_VERSION'),
  );

  const featureUnder11 = Buffer.from(compileRealityToBytecode('reality VersionFeature { facet math.mod : Number = 7 % 3 }'));
  featureUnder11.writeUInt16LE(1, 6);
  assert.throws(
    () => runNativeBytecode(featureUnder11),
    error => error instanceof RCLNativeVMError && error.message.includes('RCL_NATIVE_BYTECODE_FEATURE_VERSION'),
  );
});

test('native Value stack and CallFrame storage grow beyond the former fixed limits', () => {
  const source = `reality NativeDynamicStackStress {
    reckon descend(value : Number) -> Number = choose(value <= 0, 0, 1 + descend(value - 1))
    facet stress.result : Number = descend(6000)
  }`;
  const result = runRealityNative(source, { timeout: 60_000 });
  assert.equal(result.state['stress.result'], 6000);
  assert.ok(result.metrics.peakStackDepth > 4096, `peak stack was ${result.metrics.peakStackDepth}`);
  assert.ok(result.metrics.peakCallFrames > 2048, `peak frames were ${result.metrics.peakCallFrames}`);
});

test('native Value stack and CallFrame hard limits fail deterministically', () => {
  assert.throws(
    () => runNativeBytecode(assemblePushStressBytecode(131073), { timeout: 60_000 }),
    error => error instanceof RCLNativeVMError && error.code === 'RCL_NATIVE_STACK_LIMIT',
  );
  const frameLimitSource = `reality NativeFrameLimitStress {
    reckon descend(value : Number) -> Number = choose(value <= 0, 0, 1 + descend(value - 1))
    facet stress.result : Number = descend(33000)
  }`;
  assert.throws(
    () => runRealityNative(frameLimitSource, { timeout: 60_000 }),
    error => error instanceof RCLNativeVMError && error.code === 'RCL_NATIVE_CALL_DEPTH',
  );
});

test('native UTF-8 Text builtins preserve non-ASCII identifier characters', async () => {
  const source = `reality NativeUtf8Builtins {
    facet utf8.length : Number = length("世界")
    facet utf8.first : Text = char_at("世界", 0)
    facet utf8.second : Text = slice_text("世界", 1, 1)
    facet utf8.start : Truth = is_identifier_start(char_at("世界", 0))
    facet utf8.part : Truth = is_identifier_part(char_at("世界", 1))
  }`;
  const native = runRealityNative(source);
  const reference = await runReality(source);
  assert.deepEqual(native.state, reference.state);
  assert.deepEqual(native.state, {
    'utf8.first': '世',
    'utf8.length': 2,
    'utf8.part': true,
    'utf8.second': '界',
    'utf8.start': true,
  });

  const compilerSource = `${fs.readFileSync(path.join(ROOT, 'selfhost', 'compiler-core.rcl'), 'utf8')}\n${fs.readFileSync(path.join(ROOT, 'selfhost', 'compiler-main.rcl'), 'utf8')}`;
  const targetSource = 'reality NativeUtf8Identifier { facet 世界.就绪 : Truth = true }\n';
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-utf8-'));
  try {
    const compilerPath = path.join(directory, 'compiler.rbc');
    const sourcePath = path.join(directory, 'source.rcl');
    const outputPath = path.join(directory, 'output.rbc');
    fs.writeFileSync(compilerPath, compileRealityToBytecode(compilerSource));
    fs.writeFileSync(sourcePath, targetSource);
    const result = runNativeCompiler(compilerPath, sourcePath, outputPath, { outputState: 'compiler.output', timeout: 60_000 });
    assert.deepEqual(result.bytecode, compileRealityToBytecode(targetSource));
    assert.equal(runNativeBytecode(result.bytecode).state['世界.就绪'], true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('native rclc supplies compiler_input and exports the declared Sequence through the public state ABI', () => {
  assert.equal(fs.existsSync(DEFAULT_NATIVE_COMPILER_PATH), true, `missing native compiler at ${DEFAULT_NATIVE_COMPILER_PATH}`);
  const header = fs.readFileSync(path.join(ROOT, 'native', 'rclvm.h'), 'utf8');
  assert.match(header, /rclvm_instance_get_state_text/);
  assert.match(header, /rclvm_instance_get_state_bytes/);
  assert.match(header, /rclvm_free_bytes/);

  const targetSource = 'reality NativeCompilerTarget { facet world.ready : Truth = true }\n';
  const expectedTargetBytecode = compileRealityToBytecode(targetSource);
  const compilerSource = `reality NativeSelfhostIoCompiler {
    facet compiler.provider : Text = "compiler_input"
    facet compiler.capability : Text = "read_source"
    facet compiler.request : Text = "{\\"format\\":\\"rcl.source.v1\\"}"
    facet compiler.source : Text = provider_call(compiler.provider, compiler.capability, compiler.request)
    facet compiler.output_state : Text = choose(contains(compiler.source, "NativeCompilerTarget"), "compiler.emitted_bytes", "compiler.invalid_bytes")
    facet compiler.emitted_bytes : Sequence = hex_bytes("${expectedTargetBytecode.toString('hex')}")
    facet compiler.invalid_bytes : Sequence = bytes_u8(0)
  }`;
  const compilerBytecode = compileRealityToBytecode(compilerSource);
  const decodedCompiler = decodeBytecode(compilerBytecode);
  const providerInstruction = decodedCompiler.instructions.find(instruction => instruction.name === 'CALL_PROVIDER');
  assert.deepEqual(decodedCompiler.version, { major: 1, minor: 2 });
  assert.equal(providerInstruction?.flags, 1);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-selfhost-'));
  try {
    const compilerPath = path.join(directory, 'compiler.rbc');
    const sourcePath = path.join(directory, 'source.rcl');
    const outputPath = path.join(directory, 'output.rbc');
    fs.writeFileSync(compilerPath, compilerBytecode);
    fs.writeFileSync(sourcePath, targetSource);

    const result = runNativeCompiler(compilerPath, sourcePath, outputPath);
    assert.equal(result.status, 'ok');
    assert.equal(result.outputState, 'compiler.emitted_bytes');
    assert.equal(result.bytes, expectedTargetBytecode.length);
    assert.deepEqual(result.bytecode, expectedTargetBytecode);
    assert.deepEqual(fs.readFileSync(outputPath), expectedTargetBytecode);
    assert.equal(decodeBytecode(result.bytecode).program, 'NativeCompilerTarget');
    assert.equal(runNativeBytecode(result.bytecode).state['world.ready'], true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('native rclc rejects invalid RBC output without replacing an existing target', () => {
  const compilerSource = `reality InvalidNativeCompilerOutput {
    facet compiler.output_state : Text = "compiler.output"
    facet compiler.output : Sequence = hex_bytes("52434c42")
  }`;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-atomic-'));
  try {
    const compilerPath = path.join(directory, 'compiler.rbc');
    const sourcePath = path.join(directory, 'source.rcl');
    const outputPath = path.join(directory, 'output.rbc');
    const previous = Buffer.from('previous-target-must-survive');
    fs.writeFileSync(compilerPath, compileRealityToBytecode(compilerSource));
    fs.writeFileSync(sourcePath, 'reality IgnoredSource { facet world.ready : Truth = true }\n');
    fs.writeFileSync(outputPath, previous);
    assert.throws(
      () => runNativeCompiler(compilerPath, sourcePath, outputPath),
      error => error instanceof RCLNativeVMError && error.code === 'RCLC_OUTPUT_FAILURE',
    );
    assert.deepEqual(fs.readFileSync(outputPath), previous);
    assert.deepEqual(fs.readdirSync(directory).filter(name => name.includes('.tmp.')), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Windows native manifest tracks the exact required prebuilt path set and hashes', { skip: process.platform !== 'win32' }, () => {
  const manifestPath = path.join(ROOT, 'native', 'native-windows-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const expectedSources = [
    'native/rclvm.c',
    'native/rclvm.h',
    'native/rclc.c',
    'native/rclvmd.c',
    'native/provider_demo.c',
    'scripts/build-native-windows.mjs',
  ];
  const expectedArtifacts = [
    'native/rclvm.exe',
    'native/rclc.exe',
    'native/rclvmd.exe',
    'native/provider_demo.exe',
    'native/librclvm.a',
    'native/rclvm.dll',
    'native/rclvm.lib',
  ].sort();
  assert.deepEqual([...manifest.sources].sort(), [...expectedSources].sort());
  assert.deepEqual(manifest.artifacts.map(artifact => artifact.path).sort(), expectedArtifacts);
  assert.equal(new Set(manifest.artifacts.map(artifact => artifact.path)).size, expectedArtifacts.length);
  for (const artifact of manifest.artifacts) {
    const artifactPath = path.join(ROOT, artifact.path);
    assert.equal(fs.statSync(artifactPath).size, artifact.bytes, artifact.path);
    assert.equal(sha256File(artifactPath), artifact.sha256, artifact.path);
  }
  const sourceHash = crypto.createHash('sha256');
  for (const relative of expectedSources) {
    sourceHash.update(relative);
    sourceHash.update('\0');
    sourceHash.update(fs.readFileSync(path.join(ROOT, relative)));
    sourceHash.update('\0');
  }
  assert.equal(manifest.sourceSha256, sourceHash.digest('hex'));
});

test('Windows rclvm DLL supports an external import-library link and runtime load', { skip: process.platform !== 'win32' }, t => {
  const zig = findZig();
  if (!zig) {
    t.skip('Zig is unavailable; the checked DLL and import library are covered by the signed prebuilt manifest');
    return;
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rclvm-dll-abi-'));
  try {
    const sourcePath = path.join(directory, 'abi-smoke.c');
    const executablePath = path.join(directory, 'abi-smoke.exe');
    fs.writeFileSync(sourcePath, `#include <string.h>\n#include "rclvm.h"\nint main(void) {\n  char error[128] = {0};\n  if (!rclvm_version() || strncmp(rclvm_version(), "0.", 2) != 0) return 10;\n  if (rclvm_validate_bytecode(NULL, 0, error, sizeof(error)) != 0) return 11;\n  RclVmInstance *vm = rclvm_instance_create();\n  if (!vm) return 12;\n  rclvm_instance_destroy(vm);\n  return 0;\n}\n`);
    const compile = spawnSync(zig, [
      'cc', '-target', 'x86_64-windows-gnu', '-std=c11', '-DRCLVM_USE_DLL',
      `-I${path.join(ROOT, 'native')}`,
      sourcePath,
      path.join(ROOT, 'native', 'rclvm.lib'),
      '-o', executablePath,
    ], {
      encoding: 'utf8',
      timeout: 60_000,
      env: {
        ...process.env,
        ZIG_GLOBAL_CACHE_DIR: process.env.ZIG_GLOBAL_CACHE_DIR ?? path.join(ROOT, '_tools', 'zig-global-cache'),
        ZIG_LOCAL_CACHE_DIR: process.env.ZIG_LOCAL_CACHE_DIR ?? path.join(ROOT, '_tools', 'zig-local-cache'),
      },
    });
    assert.equal(compile.status, 0, compile.stderr || compile.stdout);
    const run = spawnSync(executablePath, [], {
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, PATH: `${path.join(ROOT, 'native')};${process.env.PATH ?? ''}` },
    });
    assert.equal(run.status, 0, run.stderr || run.stdout || run.error?.message);
    t.diagnostic(`linked ${path.basename(executablePath)} through native/rclvm.lib and loaded native/rclvm.dll`);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
