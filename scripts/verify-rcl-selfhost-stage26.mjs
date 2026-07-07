#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runReality } from '../src/runtime.mjs';
import { DEFAULT_NATIVE_VM_PATH, runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-expression-ast-source-lowering-stage26.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage26-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage26-expression-ast-source-lowering-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage26-expression-ast-source-lowered-target.rbc');
const referenceRbcPath = path.join(outputDir, 'stage26-expression-ast-source-js-reference.rbc');

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

function sha256File(filePath) {
  return fs.existsSync(filePath)
    ? crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    : null;
}

function nativeExeFormat(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, mz: false, pe: false };
  const buffer = fs.readFileSync(filePath);
  const peOffset = buffer.length >= 0x40 ? buffer.readUInt32LE(0x3c) : -1;
  const peSignature = peOffset >= 0 && peOffset + 4 <= buffer.length
    ? buffer.toString('ascii', peOffset, peOffset + 4)
    : '';
  return {
    exists: true,
    bytes: buffer.length,
    mz: buffer.length >= 2 && buffer.toString('ascii', 0, 2) === 'MZ',
    pe: peSignature === 'PE\u0000\u0000',
    peOffset,
    sha256: sha256(buffer),
  };
}

function instructionNames(decoded) {
  return decoded.instructions.map(instruction => instruction.name);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  }
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const interpreterArtifact = Buffer.from(compileRealityToBytecode(rclSource));
const interpreterRun = runNativeBytecode(interpreterArtifact, { maxBuffer: 96 * 1024 * 1024, timeout: 60_000 });
const state = interpreterRun.state;
const sourceText = state['source.full'];
const compilerProgram = compileReality(sourceText);
const referenceRbc = Buffer.from(compileRealityToBytecode(sourceText));
const targetRbc = Buffer.from(state['target.rbc_bytes']);
const decodedInterpreter = decodeBytecode(interpreterArtifact);
const decodedTarget = decodeBytecode(targetRbc);
const decodedReference = decodeBytecode(referenceRbc);
const targetNativeRun = runNativeBytecode(targetRbc, { maxBuffer: 32 * 1024 * 1024 });
const targetReferenceRun = await runReality(compilerProgram);
const interpreterNames = instructionNames(decodedInterpreter);
const targetNames = instructionNames(decodedTarget);
const nativeFormat = nativeExeFormat(DEFAULT_NATIVE_VM_PATH);

const expectedTargetState = {
  'seed.raw': ' request ',
  'seed.trimmed': 'request',
  'metrics.request_size': 7,
  'metrics.has_request': true,
};

const expectedStrings = [
  'RuntimeExpressionAstSourceLoweringTarget',
  'c922c1c276fa78a4138cc59ac7956712497366f3d939974bf93b8013b5187a0f',
  ' request ',
  'seed.raw',
  'seed.trimmed',
  'metrics.request_size',
  'request',
  'metrics.has_request',
];

const checks = {
  nativeVmIsRealWindowsExecutable: process.platform !== 'win32'
    ? fs.existsSync(DEFAULT_NATIVE_VM_PATH)
    : nativeFormat.exists === true && nativeFormat.mz === true && nativeFormat.pe === true,
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_EXPRESSION_AST_SOURCE_LOWERING_SUBSET_VERIFIED',
  rclRecursivelyParsedExpressionAst: state['parser.token_count'] === 57
    && state['parser.first_token'] === 'reality'
    && state['parser.program_token'] === 'RuntimeExpressionAstSourceLoweringTarget'
    && state['parser.facet_end_index'] === 55
    && state['parser.eof_kind'] === 'EOF'
    && state['compiler.facet_count'] === 4
    && state['compiler.expression_node_count'] === 9
    && state['compiler.literal_expr_kind'] === 'LiteralExpr'
    && state['compiler.trim_expr_kind'] === 'CallExpr'
    && state['compiler.trim_arg0_kind'] === 'PathExpr'
    && state['compiler.length_arg0_name'] === 'trim'
    && state['compiler.length_nested_arg0_path'] === 'seed.raw'
    && state['compiler.contains_arg0_path'] === 'seed.trimmed'
    && state['compiler.contains_arg1_text'] === 'request',
  rclGeneratedTargetRbcMatchesJsCompiler: targetRbc.equals(referenceRbc)
    && sha256(targetRbc) === sha256(referenceRbc),
  rclParsedSourceFieldsMatchCompilerShape: state['compiler.program'] === compilerProgram.name
    && state['source.root'] === compilerProgram.programRoot
    && compilerProgram.facets.length === 4
    && compilerProgram.facets[0].path === 'seed.raw'
    && compilerProgram.facets[1].value.name === 'trim'
    && compilerProgram.facets[2].value.name === 'length'
    && compilerProgram.facets[2].value.args[0].name === 'trim'
    && compilerProgram.facets[3].value.name === 'contains',
  decodedTargetShapeMatches: decodedTarget.program === 'RuntimeExpressionAstSourceLoweringTarget'
    && decodedTarget.sourceRoot === compilerProgram.programRoot
    && JSON.stringify(decodedTarget.strings) === JSON.stringify(expectedStrings)
    && JSON.stringify(decodedTarget.strings) === JSON.stringify(decodedReference.strings)
    && decodedTarget.numbers.length === 0
    && decodedTarget.instructions.length === 14
    && JSON.stringify(targetNames) === JSON.stringify([
      'PUSH_STRING', 'STORE_STATE',
      'LOAD_STATE', 'CALL_BUILTIN', 'STORE_STATE',
      'LOAD_STATE', 'CALL_BUILTIN', 'CALL_BUILTIN', 'STORE_STATE',
      'LOAD_STATE', 'PUSH_STRING', 'CALL_BUILTIN', 'STORE_STATE',
      'HALT',
    ])
    && decodedTarget.instructions[3]?.builtin === 'TRIM'
    && decodedTarget.instructions[7]?.builtin === 'LENGTH'
    && decodedTarget.instructions[11]?.builtin === 'CONTAINS'
    && decodedTarget.instructions[11]?.b === 2,
  rclGeneratedTargetRunsInNativeVm: targetNativeRun.status === 'ok'
    && sameJson(targetNativeRun.state, expectedTargetState)
    && sameJson(targetNativeRun.state, targetReferenceRun.state),
  decodedInterpreterContainsExpressionAstRuntime: interpreterNames.includes('CALL')
    && interpreterNames.includes('RETURN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'MAKE_PARSE_STATE')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'PARSE_NODES')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_APPEND')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'TOKEN_TEXT')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'TOKEN_KIND')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'EXPECT_TOKEN')
    && decodedInterpreter.strings.includes('RCL_OWNED_EXPRESSION_AST_SOURCE_LOWERING_SUBSET_VERIFIED')
    && decodedInterpreter.strings.includes('LiteralExpr')
    && decodedInterpreter.strings.includes('PathExpr')
    && decodedInterpreter.strings.includes('CallExpr'),
  boundaryHonest: state['selfhost.boundary'] === 'expression_ast_source_lowering_subset_not_complete_parser_compiler_or_runtime'
    && state['gate.rcl_owned_expression_ast_subset'] === true
    && state['gate.rcl_owned_nested_call_lowering_subset'] === true
    && state['gate.rcl_owned_target_native_execution_subset'] === true
    && state['gate.rcl_owned_parser_complete'] === false
    && state['gate.rcl_owned_expression_ast_complete'] === false
    && state['gate.rcl_owned_rule_bytecode_lowering_complete'] === false
    && state['gate.rcl_compiler_self_emits_without_stage0'] === false
    && state['gate.rcl_owned_runtime_complete'] === false
    && state['gate.rcl_owned_runtime_root_hashing_complete'] === false
    && state['gate.native_vm_host_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage26.verification.v1',
  rclFile: path.relative(root, rclPath).replaceAll(path.sep, '/'),
  interpreterArtifactFile: path.relative(root, interpreterArtifactPath).replaceAll(path.sep, '/'),
  targetRbcFile: path.relative(root, targetRbcPath).replaceAll(path.sep, '/'),
  referenceRbcFile: path.relative(root, referenceRbcPath).replaceAll(path.sep, '/'),
  stageStatus: state['selfhost.stage_status'],
  selfHostClaim: state['selfhost.claim'],
  checks,
  nativeVm: {
    path: path.relative(root, DEFAULT_NATIVE_VM_PATH).replaceAll(path.sep, '/'),
    defaultPath: DEFAULT_NATIVE_VM_PATH,
    sha256: sha256File(DEFAULT_NATIVE_VM_PATH),
    executableFormat: nativeFormat,
  },
  parser: {
    tokenCount: state['parser.token_count'],
    firstToken: state['parser.first_token'],
    programToken: state['parser.program_token'],
    facetEndIndex: state['parser.facet_end_index'],
    eofKind: state['parser.eof_kind'],
  },
  compiler: {
    sourceRoot: compilerProgram.programRoot,
    program: compilerProgram.name,
    facetCount: state['compiler.facet_count'],
    expressionNodeCount: state['compiler.expression_node_count'],
    literalExprKind: state['compiler.literal_expr_kind'],
    trimExprName: state['compiler.trim_expr_name'],
    trimArg0Path: state['compiler.trim_arg0_path'],
    lengthExprName: state['compiler.length_expr_name'],
    lengthArg0Name: state['compiler.length_arg0_name'],
    lengthNestedArg0Path: state['compiler.length_nested_arg0_path'],
    containsExprName: state['compiler.contains_expr_name'],
    containsArg0Path: state['compiler.contains_arg0_path'],
    containsArg1Text: state['compiler.contains_arg1_text'],
  },
  interpreterArtifact: {
    program: decodedInterpreter.program,
    bytes: interpreterArtifact.length,
    sha256: sha256(interpreterArtifact),
    instructionCount: decodedInterpreter.instructions.length,
  },
  target: {
    program: decodedTarget.program,
    sourceRoot: decodedTarget.sourceRoot,
    bytes: targetRbc.length,
    sha256: sha256(targetRbc),
    referenceSha256: sha256(referenceRbc),
    exactReferenceMatch: targetRbc.equals(referenceRbc),
    strings: decodedTarget.strings,
    instructions: decodedTarget.instructions,
    nativeRun: {
      status: targetNativeRun.status,
      state: targetNativeRun.state,
      metrics: targetNativeRun.metrics,
    },
  },
  reference: {
    program: decodedReference.program,
    sourceRoot: decodedReference.sourceRoot,
    bytes: referenceRbc.length,
    strings: decodedReference.strings,
    instructions: decodedReference.instructions,
    runtimeState: targetReferenceRun.state,
  },
  boundaries: {
    implementedNow: 'A native-running RCL artifact recursively parses literal, path and builtin call expressions into RCL-owned expression records, lowers nested trim/length and two-argument contains calls to bytecode, emits a target RBC byte-identical to the JS compiler output, and the generated target runs successfully in native rclvm.exe.',
    notYetImplemented: 'This is still a constrained expression AST subset. It is not a complete parser, not typed expression nodes in the native VM ABI, not rule/emergence source lowering, not pure RCL compiler fixed point, and not a complete RCL-owned runtime.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(interpreterArtifactPath, interpreterArtifact);
fs.writeFileSync(targetRbcPath, targetRbc);
fs.writeFileSync(referenceRbcPath, referenceRbc);
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));

if (!payload.ok) process.exitCode = 1;
