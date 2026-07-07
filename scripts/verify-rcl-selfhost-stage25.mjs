#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { DEFAULT_NATIVE_VM_PATH, RCLNativeVMError, runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-facet-ast-source-lowering-stage25.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage25-verification.json');
const interpreterArtifactPath = path.join(outputDir, 'stage25-facet-ast-source-lowering-interpreter.rbc');
const targetRbcPath = path.join(outputDir, 'stage25-facet-ast-source-lowered-target.rbc');
const referenceRbcPath = path.join(outputDir, 'stage25-facet-ast-source-js-reference.rbc');

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

function sha256File(filePath) {
  return fs.existsSync(filePath)
    ? crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    : null;
}

function runNativeFailure(bytecode) {
  try {
    const run = runNativeBytecode(bytecode, { maxBuffer: 32 * 1024 * 1024 });
    return { ok: false, unexpectedlyRan: true, run };
  } catch (error) {
    if (error instanceof RCLNativeVMError) {
      return {
        ok: true,
        unexpectedlyRan: false,
        code: error.code,
        message: error.message,
        status: error.details?.status ?? null,
      };
    }
    throw error;
  }
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

const rclSource = fs.readFileSync(rclPath, 'utf8');
const interpreterArtifact = Buffer.from(compileRealityToBytecode(rclSource));
const interpreterRun = runNativeBytecode(interpreterArtifact, { maxBuffer: 64 * 1024 * 1024 });
const state = interpreterRun.state;
const sourceText = state['source.full'];
const compilerProgram = compileReality(sourceText);
const referenceRbc = Buffer.from(compileRealityToBytecode(sourceText));
const targetRbc = Buffer.from(state['target.rbc_bytes']);
const decodedInterpreter = decodeBytecode(interpreterArtifact);
const decodedTarget = decodeBytecode(targetRbc);
const decodedReference = decodeBytecode(referenceRbc);
const targetNativeFailure = runNativeFailure(targetRbc);
const interpreterNames = instructionNames(decodedInterpreter);
const targetNames = instructionNames(decodedTarget);
const nativeFormat = nativeExeFormat(DEFAULT_NATIVE_VM_PATH);
const builtinInstruction = decodedTarget.instructions.find(instruction => instruction.name === 'CALL_BUILTIN');
const providerInstruction = decodedTarget.instructions.find(instruction => instruction.name === 'CALL_PROVIDER');
const facetStarts = state['compiler.facet_starts'];

const expectedStrings = [
  'RuntimeFacetAstSourceLoweringTarget',
  'a6fe77a8799110b50c730cee5cdddde9f7114b73ff3cb994875fe405ce27fe3e',
  'request',
  'seed.request',
  'metrics.request_size',
  'echo',
  'echo.text',
  'provider.reply',
];

const checks = {
  nativeVmIsRealWindowsExecutable: process.platform !== 'win32'
    ? fs.existsSync(DEFAULT_NATIVE_VM_PATH)
    : nativeFormat.exists === true && nativeFormat.mz === true && nativeFormat.pe === true,
  interpreterRunsInNativeVm: interpreterRun.status === 'ok'
    && state['selfhost.stage_status'] === 'RCL_OWNED_FACET_AST_SOURCE_LOWERING_SUBSET_VERIFIED',
  rclRecursivelyParsedFacetList: state['parser.token_count'] === 41
    && state['parser.first_token'] === 'reality'
    && state['parser.program_token'] === 'RuntimeFacetAstSourceLoweringTarget'
    && state['parser.facet_end_index'] === 39
    && state['parser.eof_kind'] === 'EOF'
    && JSON.stringify(facetStarts) === JSON.stringify([3, 11, 24]),
  rclBuiltLiteralFacetAst: state['compiler.literal_ast_count'] === 1
    && state['compiler.literal_ast_kind'] === 'FacetDecl'
    && state['compiler.literal_ast_path'] === 'seed.request'
    && state['compiler.literal_ast_type'] === 'Text'
    && state['compiler.literal_ast_literal_kind'] === 'Text'
    && state['compiler.literal_ast_literal_text'] === 'request',
  rclGeneratedTargetRbcMatchesJsCompiler: targetRbc.equals(referenceRbc)
    && sha256(targetRbc) === sha256(referenceRbc),
  rclParsedSourceFieldsMatchCompilerShape: state['compiler.program'] === compilerProgram.name
    && state['source.root'] === compilerProgram.programRoot
    && state['compiler.literal_facet_path'] === compilerProgram.facets[0].path
    && state['compiler.builtin_facet_path'] === compilerProgram.facets[1].path
    && state['compiler.provider_facet_path'] === compilerProgram.facets[2].path
    && state['compiler.builtin_call_name'] === compilerProgram.facets[1].value.name
    && state['compiler.builtin_arg0'] === compilerProgram.facets[1].value.args[0].path
    && state['compiler.provider_call_name'] === compilerProgram.facets[2].value.name
    && state['compiler.provider_arg0'] === compilerProgram.facets[2].value.args[0].value
    && state['compiler.provider_arg1'] === compilerProgram.facets[2].value.args[1].value
    && state['compiler.provider_arg2'] === compilerProgram.facets[2].value.args[2].value,
  decodedTargetShapeMatches: decodedTarget.program === 'RuntimeFacetAstSourceLoweringTarget'
    && decodedTarget.sourceRoot === compilerProgram.programRoot
    && JSON.stringify(decodedTarget.strings) === JSON.stringify(expectedStrings)
    && JSON.stringify(decodedTarget.strings) === JSON.stringify(decodedReference.strings)
    && decodedTarget.numbers.length === 0
    && decodedTarget.instructions.length === 8
    && targetNames[0] === 'PUSH_STRING'
    && targetNames[1] === 'STORE_STATE'
    && targetNames[2] === 'LOAD_STATE'
    && targetNames[3] === 'CALL_BUILTIN'
    && targetNames[4] === 'STORE_STATE'
    && targetNames[5] === 'CALL_PROVIDER'
    && targetNames[6] === 'STORE_STATE'
    && targetNames[7] === 'HALT'
    && decodedTarget.instructions[2]?.a === 3
    && builtinInstruction?.builtin === 'LENGTH'
    && builtinInstruction?.b === 1
    && providerInstruction?.a === 5
    && providerInstruction?.b === 6
    && providerInstruction?.c === 2,
  nativeVmRejectsTargetWithProviderMissingAfterLiteralAndBuiltinPrefix: targetNativeFailure.ok === true
    && targetNativeFailure.code === 'RCL_NATIVE_PROVIDER_MISSING'
    && targetNativeFailure.message === "Provider 'echo' is not registered for capability 'echo.text'",
  decodedInterpreterContainsFacetAstParserRuntime: interpreterNames.includes('CALL')
    && interpreterNames.includes('RETURN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'MAKE_PARSE_STATE')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'PARSE_NODES')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'FACET_AST')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'AST_KIND')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'AST_PATH')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'AST_LITERAL_TEXT')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'EXPECT_TOKEN')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'TOKEN_TEXT')
    && decodedInterpreter.instructions.some(instruction => instruction.builtin === 'SEQUENCE_APPEND')
    && decodedInterpreter.strings.includes('RCL_OWNED_FACET_AST_SOURCE_LOWERING_SUBSET_VERIFIED'),
  boundaryHonest: state['selfhost.boundary'] === 'facet_ast_source_lowering_subset_not_complete_parser_compiler_or_runtime'
    && state['gate.rcl_owned_recursive_facet_parser_subset'] === true
    && state['gate.rcl_owned_literal_facet_ast_subset'] === true
    && state['gate.rcl_owned_ast_driven_bytecode_lowering_subset'] === true
    && state['gate.rcl_owned_path_load_lowering_subset'] === true
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
  format: 'rcl.selfhost.stage25.verification.v1',
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
    facetStarts,
    facetEndIndex: state['parser.facet_end_index'],
    eofKind: state['parser.eof_kind'],
  },
  compiler: {
    sourceRoot: compilerProgram.programRoot,
    program: compilerProgram.name,
    literalAst: {
      count: state['compiler.literal_ast_count'],
      kind: state['compiler.literal_ast_kind'],
      path: state['compiler.literal_ast_path'],
      type: state['compiler.literal_ast_type'],
      literalKind: state['compiler.literal_ast_literal_kind'],
      literalText: state['compiler.literal_ast_literal_text'],
    },
    literalFacetPath: state['compiler.literal_facet_path'],
    builtinFacetPath: state['compiler.builtin_facet_path'],
    builtinCallName: state['compiler.builtin_call_name'],
    builtinArg0: state['compiler.builtin_arg0'],
    providerFacetPath: state['compiler.provider_facet_path'],
    providerCallName: state['compiler.provider_call_name'],
    providerArg0: state['compiler.provider_arg0'],
    providerArg1: state['compiler.provider_arg1'],
    providerArg2: state['compiler.provider_arg2'],
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
    nativeFailure: targetNativeFailure,
  },
  reference: {
    program: decodedReference.program,
    sourceRoot: decodedReference.sourceRoot,
    bytes: referenceRbc.length,
    strings: decodedReference.strings,
    instructions: decodedReference.instructions,
  },
  boundaries: {
    implementedNow: 'A native-running RCL artifact tokenizes source text, recursively parses a three-facet list into a ParseState, builds a real native AstNode for the literal facet, and emits bytecode for literal storage, LOAD_STATE plus LENGTH, and provider_call. The target bytecode is byte-identical to the JS compiler output.',
    notYetImplemented: 'This is a constrained facet-list and expression lowering subset. It is not complete expression AST construction, not a complete parser, not rule/emergence lowering from source, not a pure RCL compiler fixed point, and not a complete RCL-owned runtime.',
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
