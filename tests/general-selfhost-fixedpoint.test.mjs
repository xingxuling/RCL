import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { compileReality } from '../src/compiler.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const compilerSource = `${read('selfhost/compiler-core.rcl')}\n${read('selfhost/compiler-main.rcl')}`;
const MINIMUM_NATIVE_INSTRUCTION_HEADROOM = 180_000_000;

function bytesU16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value >>> 0);
  return [...buffer];
}

function bytesU32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return [...buffer];
}

function bytesI32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32LE(value | 0);
  return [...buffer];
}

function bytesF64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeDoubleLE(Number(value));
  return [...buffer];
}

function callBuiltin(id, args) {
  switch (id) {
    case 1: return String(args[0]).includes(String(args[1]));
    case 2: return String(args[0]).startsWith(String(args[1]));
    case 3: return String(args[0]).endsWith(String(args[1]));
    case 4: return args[0].length;
    case 5: return String(args[0]).toLowerCase();
    case 6: return String(args[0]).toUpperCase();
    case 7: return String(args[0]);
    case 8: return String(args[0]).trim();
    case 9: {
      const at = String(args[0]).indexOf(String(args[1]));
      return at < 0 ? String(args[0]) : String(args[0]).slice(0, at);
    }
    case 10: {
      const source = String(args[0]);
      const marker = String(args[1]);
      const at = source.indexOf(marker);
      return at < 0 ? source : source.slice(at + marker.length);
    }
    case 11: return Number(args[0]);
    case 12: return [];
    case 13: return [...args[0], args[1]];
    case 14: return args[0][args[1]];
    case 15: return String(args[0]).charAt(args[1]);
    case 16: return String(args[0]).slice(args[1], args[1] + args[2]);
    case 17: return /^\s$/u.test(String(args[0]));
    case 18: return /^[0-9]$/u.test(String(args[0]));
    case 19: return /^[_\p{L}]$/u.test(String(args[0]));
    case 20: return /^[_\p{L}\p{N}]$/u.test(String(args[0]));
    case 21: return { offset: args[0], line: args[1], column: args[2], length: args[3] };
    case 46:
      if (!args[0]) {
        const error = new Error(`${args[1]}: ${args[2]}`);
        error.code = args[1];
        throw error;
      }
      return true;
    case 62: return [...args[0], ...args[1]];
    case 63: return [args[0] & 0xff];
    case 64: return bytesU16(args[0]);
    case 65: return bytesU32(args[0]);
    case 66: return bytesI32(args[0]);
    case 67: return bytesF64(args[0]);
    case 68: return [...Buffer.from(String(args[0]), 'utf8')];
    case 69: return [...Buffer.from(String(args[0]), 'hex')];
    case 70: return crypto.createHash('sha256').update(String(args[0])).digest('hex');
    default: throw new Error(`Test RBC host does not implement builtin ${id}`);
  }
}

function buildFunctionOwners(program, functionNames) {
  const haltIndex = program.instructions.findIndex(instruction => instruction.op === 31);
  assert.ok(haltIndex >= 0, 'profiled compiler artifact must contain HALT');
  const functionStarts = [haltIndex + 1];
  for (let index = haltIndex + 1; index < program.instructions.length - 1; index += 1) {
    if (program.instructions[index].op === 34) functionStarts.push(index + 1);
  }
  assert.equal(functionStarts.length, functionNames.length, 'function profile layout must match source reckons');
  const mainOwner = functionNames.length;
  const owners = new Int32Array(program.instructions.length);
  owners.fill(mainOwner, 0, haltIndex + 1);
  for (let index = 0; index < functionStarts.length; index += 1) {
    owners.fill(index, functionStarts[index], functionStarts[index + 1] ?? program.instructions.length);
  }
  return { owners, mainOwner };
}

function runCompilerArtifact(bytecode, source, { budget = 300_000_000, profileFunctionNames = null } = {}) {
  const program = decodeBytecode(bytecode);
  const profileLayout = profileFunctionNames ? buildFunctionOwners(program, profileFunctionNames) : null;
  const functionSteps = profileLayout ? new Float64Array(profileFunctionNames.length + 1) : null;
  const stack = [];
  const state = new Map();
  const frames = [];
  let locals = [];
  let ip = 0;
  let steps = 0;

  const pop = () => {
    assert.ok(stack.length > 0, `stack underflow at instruction ${ip}`);
    return stack.pop();
  };

  while (true) {
    assert.ok(++steps <= budget, `RBC execution exceeded ${budget} instructions`);
    if (functionSteps) functionSteps[profileLayout.owners[ip]] += 1;
    const ins = program.instructions[ip];
    assert.ok(ins, `instruction pointer escaped at ${ip}`);
    ip += 1;
    switch (ins.op) {
      case 0: break;
      case 1: stack.push(program.numbers[ins.a]); break;
      case 2: stack.push(ins.a !== 0); break;
      case 3: stack.push(program.strings[ins.a]); break;
      case 4: stack.push(state.get(program.strings[ins.a])); break;
      case 5: state.set(program.strings[ins.a], pop()); break;
      case 6: {
        const right = pop(); const left = pop();
        stack.push(typeof left === 'string' || typeof right === 'string' ? String(left) + String(right) : left + right);
        break;
      }
      case 7: { const right = pop(); stack.push(pop() - right); break; }
      case 8: { const right = pop(); stack.push(pop() * right); break; }
      case 9: { const right = pop(); stack.push(pop() / right); break; }
      case 10: { const right = pop(); stack.push(pop() === right); break; }
      case 11: { const right = pop(); stack.push(pop() !== right); break; }
      case 12: { const right = pop(); stack.push(pop() < right); break; }
      case 13: { const right = pop(); stack.push(pop() <= right); break; }
      case 14: { const right = pop(); stack.push(pop() > right); break; }
      case 15: { const right = pop(); stack.push(pop() >= right); break; }
      case 16: { const right = pop(); stack.push(Boolean(pop()) && Boolean(right)); break; }
      case 17: { const right = pop(); stack.push(Boolean(pop()) || Boolean(right)); break; }
      case 18: stack.push(!pop()); break;
      case 19: stack.push(-pop()); break;
      case 20: ip = ins.a; break;
      case 21: if (!pop()) ip = ins.a; break;
      case 30: {
        const args = stack.splice(stack.length - ins.b, ins.b);
        stack.push(callBuiltin(ins.a, args));
        break;
      }
      case 31: {
        const functionProfile = functionSteps
          ? [...profileFunctionNames, '<main>']
            .map((name, index) => ({ name, steps: functionSteps[index] }))
            .filter(item => item.steps > 0)
            .sort((left, right) => right.steps - left.steps)
          : null;
        return { output: Buffer.from(state.get('compiler.output')), state, steps, functionProfile };
      }
      case 32: stack.push(locals[ins.a]); break;
      case 33: {
        const args = stack.splice(stack.length - ins.b, ins.b);
        const tailCall = program.instructions[ip]?.op === 34 && frames.length > 0;
        if (!tailCall) frames.push({ ip, locals });
        locals = args;
        ip = ins.a;
        break;
      }
      case 34: {
        const result = pop();
        const frame = frames.pop();
        assert.ok(frame, 'RETURN without CALL');
        ip = frame.ip;
        locals = frame.locals;
        stack.push(result);
        break;
      }
      case 35: {
        assert.equal(program.strings[ins.a], 'compiler_input');
        assert.equal(program.strings[ins.b], 'source');
        assert.equal(program.strings[ins.c], '{}');
        stack.push(source);
        break;
      }
      case 44: { const right = pop(); stack.push(pop() % right); break; }
      default: throw new Error(`Test RBC host does not implement opcode ${ins.op} at ${ins.index}`);
    }
  }
}

function assertRbcEqual(actual, expected, label) {
  if (actual.equals(expected)) return;
  const left = decodeBytecode(actual);
  const right = decodeBytecode(expected);
  const stringIndex = left.strings.findIndex((value, index) => value !== right.strings[index]);
  const numberIndex = left.numbers.findIndex((value, index) => !Object.is(value, right.numbers[index]));
  const instructionIndex = left.instructions.findIndex((value, index) => {
    const other = right.instructions[index];
    return !other || value.op !== other.op || value.flags !== other.flags || value.a !== other.a || value.b !== other.b || value.c !== other.c;
  });
  const instructionDifferences = [];
  for (let index = 0; index < Math.max(left.instructions.length, right.instructions.length) && instructionDifferences.length < 20; index += 1) {
    const value = left.instructions[index];
    const other = right.instructions[index];
    if (!value || !other || value.op !== other.op || value.flags !== other.flags || value.a !== other.a || value.b !== other.b || value.c !== other.c) {
      instructionDifferences.push([index, value, other]);
    }
  }
  assert.fail(`${label}: ${JSON.stringify({
    bytes: [actual.length, expected.length],
    roots: [left.sourceRoot, right.sourceRoot],
    stringCounts: [left.strings.length, right.strings.length],
    firstStringDifference: stringIndex < 0 ? null : [stringIndex, left.strings[stringIndex], right.strings[stringIndex]],
    numberCounts: [left.numbers.length, right.numbers.length],
    firstNumberDifference: numberIndex < 0 ? null : [numberIndex, left.numbers[numberIndex], right.numbers[numberIndex]],
    instructionCounts: [left.instructions.length, right.instructions.length],
    firstInstructionDifference: instructionIndex < 0 ? null : [instructionIndex, left.instructions[instructionIndex], right.instructions[instructionIndex]],
    instructionDifferences,
  })}`);
}

let fixedPointEvidence;

function getFixedPointEvidence() {
  if (fixedPointEvidence) return fixedPointEvidence;
  const c0 = compileRealityToBytecode(compilerSource);
  const functionNames = compileReality(compilerSource).reckons.map(reckon => reckon.name);
  const first = runCompilerArtifact(c0, compilerSource, { profileFunctionNames: functionNames });
  const c1 = first.output;
  assertRbcEqual(c1, c0, 'the RCL compiler must reproduce its bootstrap artifact');
  const second = runCompilerArtifact(c1, compilerSource);
  const c2 = second.output;
  assertRbcEqual(c2, c1, 'C1 and C2 must be byte-identical');
  fixedPointEvidence = { c0, c1, c2, first, second };
  return fixedPointEvidence;
}

test('general RCL compiler reaches a byte-identical C1/C2 fixed point after one JS bootstrap', { timeout: 300_000 }, t => {
  const { c1, first, second } = getFixedPointEvidence();
  assert.equal(decodeBytecode(c1).program, 'RCLGeneralSelfHostCompiler');
  assert.ok(first.steps > 0);
  assert.ok(second.steps > 0);
  assert.ok(first.functionProfile?.length > 0);
  t.diagnostic(JSON.stringify({
    executedInstructions: first.steps,
    topFunctions: first.functionProfile.slice(0, 20),
  }));
});

test('general RCL compiler reaches a byte-identical C1/C2 fixed point through native rclc', { timeout: 300_000 }, t => {
  const jsFunctionProfile = getFixedPointEvidence().first.functionProfile;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-general-native-fixedpoint-'));
  try {
    const sourcePath = path.join(directory, 'compiler.rcl');
    const c0Path = path.join(directory, 'compiler-c0.rbc');
    const c1Path = path.join(directory, 'compiler-c1.rbc');
    const c2Path = path.join(directory, 'compiler-c2.rbc');
    const c0 = compileRealityToBytecode(compilerSource);
    fs.writeFileSync(sourcePath, compilerSource);
    fs.writeFileSync(c0Path, c0);

    const startedAt = Date.now();
    const firstStartedAt = Date.now();
    const first = runNativeCompiler(c0Path, sourcePath, c1Path, {
      outputState: 'compiler.output',
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    const firstElapsedMs = Date.now() - firstStartedAt;
    assertRbcEqual(first.bytecode, c0, 'native C0 must reproduce C1 byte-for-byte');

    const secondStartedAt = Date.now();
    const second = runNativeCompiler(c1Path, sourcePath, c2Path, {
      outputState: 'compiler.output',
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    const secondElapsedMs = Date.now() - secondStartedAt;
    const totalElapsedMs = Date.now() - startedAt;
    assertRbcEqual(second.bytecode, first.bytecode, 'native C1 and C2 must be byte-identical');
    assert.ok(totalElapsedMs < 240_000, `native C0 -> C1 -> C2 took ${totalElapsedMs}ms`);
    assert.ok(first.peakStackDepth > 0 && second.peakStackDepth > 0);
    assert.ok(first.peakCallFrames > 0 && second.peakCallFrames > 0);
    assert.ok(first.executedInstructions > 0 && first.executedInstructions <= first.instructionBudget);
    assert.ok(second.executedInstructions > 0 && second.executedInstructions <= second.instructionBudget);
    assert.ok(first.instructionBudget - first.executedInstructions >= MINIMUM_NATIVE_INSTRUCTION_HEADROOM);
    assert.ok(second.instructionBudget - second.executedInstructions >= MINIMUM_NATIVE_INSTRUCTION_HEADROOM);
    t.diagnostic(JSON.stringify({
      firstElapsedMs,
      secondElapsedMs,
      totalElapsedMs,
      c0Bytes: c0.length,
      c1Bytes: first.bytecode.length,
      c2Bytes: second.bytecode.length,
      firstPeakStackDepth: first.peakStackDepth,
      secondPeakStackDepth: second.peakStackDepth,
      firstPeakCallFrames: first.peakCallFrames,
      secondPeakCallFrames: second.peakCallFrames,
      firstExecutedInstructions: first.executedInstructions,
      secondExecutedInstructions: second.executedInstructions,
      instructionBudget: first.instructionBudget,
      minimumInstructionHeadroom: MINIMUM_NATIVE_INSTRUCTION_HEADROOM,
      firstInstructionHeadroom: first.instructionBudget - first.executedInstructions,
      secondInstructionHeadroom: second.instructionBudget - second.executedInstructions,
      topFunctions: jsFunctionProfile.slice(0, 20),
    }));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('self-hosted C1 matches JS RBC for core and rule fixtures', { timeout: 300_000 }, () => {
  const { c1 } = getFixedPointEvidence();
  const fixtures = [
    'examples/selfhost-core/literal.rcl',
    'examples/selfhost-core/text-truth.rcl',
    'examples/selfhost-core/reckon-choose.rcl',
    'examples/selfhost-core/subject-warrants.rcl',
    'examples/selfhost-core/emergence-multi.rcl',
    'examples/selfhost-core/resonance-multi.rcl',
    'examples/rcl-native-absorption-kernel.rcl',
    'examples/whole-language-parser-target.rcl',
    'examples/selfhost-core/dynamic-provider-v12.rcl',
    'examples/selfhost-core/native-ui-minimal.rcl',
  ];

  for (const fixture of fixtures) {
    const source = read(fixture);
    const selfHosted = runCompilerArtifact(c1, source).output;
    const bootstrapOracle = compileRealityToBytecode(source);
    assert.deepEqual(selfHosted, bootstrapOracle, `${fixture} must match JS RBC byte-for-byte`);
  }
});

test('self-hosted compiler rejects the native-core sources rejected by JS', { timeout: 300_000 }, () => {
  const { c1 } = getFixedPointEvidence();
  const rejected = [
    'realty Misspelled { facet world.value : Number = 1 }',
    'reality Trailing { facet world.value : Number = 1 } trailing',
    'reality Unclosed { facet world.value : Number = 1',
    'reality UnknownTop { mystery unsupported }',
    'reality UnknownPath { facet world.value : Number = missing.value }',
    'reality UnknownCall { facet world.value : Number = missing_call(1) }',
    'reality WrongLiteral { facet world.value : Number = "one" }',
    'reality UnsupportedNative { physical universe { } }',
    'reality MissingUIView { ui App { } }',
  ];

  for (const source of rejected) {
    assert.throws(() => compileRealityToBytecode(source), undefined, `JS must reject: ${source}`);
    assert.throws(() => runCompilerArtifact(c1, source), undefined, `self-host must reject: ${source}`);
  }
});

test('self-hosted compiler owns the minimal and Counter Native UI semantic-root slices', { timeout: 300_000 }, () => {
  const { c1 } = getFixedPointEvidence();
  const minimalSource = read('examples/selfhost-core/native-ui-minimal.rcl');
  const selfHosted = runCompilerArtifact(c1, minimalSource).output;
  const bootstrapOracle = compileRealityToBytecode(minimalSource);
  assertRbcEqual(selfHosted, bootstrapOracle, 'minimal Native UI RBC and program root must match JS exactly');

  const expandedSource = read('examples/native-ui/counter.rcl');
  const expandedSelfHosted = runCompilerArtifact(c1, expandedSource).output;
  const expandedOracle = compileRealityToBytecode(expandedSource);
  assertRbcEqual(expandedSelfHosted, expandedOracle, 'Counter Native UI RBC and semantic root must match JS exactly');

  const baselineRoot = decodeBytecode(expandedOracle).sourceRoot;
  const mutations = [
    ['derived text', '"计数：" + count', '"数量：" + count'],
    ['layout gap', 'gap 12', 'gap 13'],
    ['theme color', '"#172033" inherit', '"#172034" inherit'],
    ['event increment', 'count + 1', 'count + 2'],
  ];
  for (const [label, before, after] of mutations) {
    assert.ok(expandedSource.includes(before), `${label} mutation anchor must exist`);
    const source = expandedSource.replace(before, after);
    const oracle = compileRealityToBytecode(source);
    const selfHosted = runCompilerArtifact(c1, source).output;
    assertRbcEqual(selfHosted, oracle, `${label} mutation must remain byte-identical`);
    assert.notEqual(decodeBytecode(oracle).sourceRoot, baselineRoot, `${label} mutation must change the reality root`);
  }

  const unsupportedEventParameter = `reality ParameterizedUI {
    ui App {
      state value : Text = ""
      view Root {
        input Field {
          bind value <- value
          on input(value : Text) { set value <- value }
        }
      }
    }
  }`;
  assert.doesNotThrow(() => compileRealityToBytecode(unsupportedEventParameter));
  assert.throws(() => runCompilerArtifact(c1, unsupportedEventParameter), undefined,
    'event-parameter UI grammar must remain fail-closed until self-hosted');
});

test('dynamic provider lowering is exact RBC v1.2 with expression operands', { timeout: 300_000 }, () => {
  const { c1 } = getFixedPointEvidence();
  const source = read('examples/selfhost-core/dynamic-provider-v12.rcl');
  const selfHosted = runCompilerArtifact(c1, source).output;
  const bootstrapOracle = compileRealityToBytecode(source);
  assertRbcEqual(selfHosted, bootstrapOracle, 'dynamic provider RBC must match JS exactly');
  const decoded = decodeBytecode(selfHosted);
  assert.equal(decoded.version.minor, 2);
  const provider = decoded.instructions.find(instruction => instruction.op === 35);
  assert.ok(provider);
  assert.equal(provider.flags, 1);
  assert.deepEqual([provider.a, provider.b, provider.c], [0, 0, 0]);

  const literalSource = 'reality LiteralProvider { facet provider.reply : Text = provider_call("echo", "echo.text", "request") }';
  const literalBytes = runCompilerArtifact(c1, literalSource).output;
  assertRbcEqual(literalBytes, compileRealityToBytecode(literalSource), 'literal provider RBC must match JS exactly');
  const literalDecoded = decodeBytecode(literalBytes);
  assert.equal(literalDecoded.version.minor, 1);
  const literalProvider = literalDecoded.instructions.find(instruction => instruction.op === 35);
  assert.ok(literalProvider);
  assert.equal(literalProvider.flags, 0);

  const modSource = 'reality ModFeature { facet math.value : Number = 11 % 4 }';
  const modBytes = runCompilerArtifact(c1, modSource).output;
  assertRbcEqual(modBytes, compileRealityToBytecode(modSource), 'MOD RBC must match JS exactly');
  const modDecoded = decodeBytecode(modBytes);
  assert.equal(modDecoded.version.minor, 2);
  assert.ok(modDecoded.instructions.some(instruction => instruction.op === 44));
});
